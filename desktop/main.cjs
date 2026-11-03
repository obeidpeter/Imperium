'use strict';
// Imperium's desktop app, for Steam (the Steam plan, docs/steam-plan.md; docs/desktop.md). One window around the game
// as `npm run build:desktop` builds it, served from its own files under one fixed origin, app://imperium. That origin is
// part of every save: the page's IndexedDB and localStorage belong to it, so it must never change. The page reaches
// this process only through the bridge in preload.cjs.
const {app,BrowserWindow,dialog,ipcMain,Menu,protocol,shell}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const fsp=require('node:fs/promises');

const SCHEME='app',HOST='imperium',ORIGIN=`${SCHEME}://${HOST}`;
protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true,codeCache:true}}]);
// On a laptop with two graphics chips, ask for the faster one: a browser tab often gets the other.
app.commandLine.appendSwitch('force_high_performance_gpu');
// Sound may start without a click: the soundscape resumes as the player left it.
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
// One copy at a time: a second launch brings the first window forward, so no two pages ever write one chronicle.
if(!app.requestSingleInstanceLock())app.exit(0);
// Steam (steam.cjs), before the app is ready, as its overlay sets Chromium switches: only with a Steam App ID.
const steam=require('./steam.cjs');
steam.start();

// The built game: beside the app in a package (electron-builder's extraResources), or the repository's build.
const gameRoot=()=>process.env.IMPERIUM_GAME_DIR?path.resolve(process.env.IMPERIUM_GAME_DIR):app.isPackaged?path.join(process.resourcesPath,'game'):path.resolve(__dirname,'..','dist-desktop');
// The app's own folder (%APPDATA%\Imperium on Windows); IMPERIUM_USER_DATA isolates a test run.
if(process.env.IMPERIUM_USER_DATA)app.setPath('userData',path.resolve(process.env.IMPERIUM_USER_DATA));
const savesDir=()=>path.join(app.getPath('userData'),'saves');
const windowStateFile=()=>path.join(app.getPath('userData'),'window.json');

// The same types as the development server (scripts/serve.mjs), with nosniff: module scripts and WebAssembly need them.
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.md':'text/plain; charset=utf-8',
  '.txt':'text/plain; charset=utf-8','.glb':'model/gltf-binary','.ktx2':'image/ktx2','.wasm':'application/wasm'};

async function serveGame(request){
  const url=new URL(request.url),root=gameRoot();
  if(url.host!==HOST)return new Response('Not found',{status:404});
  let requested=decodeURIComponent(url.pathname);if(requested.endsWith('/'))requested+='index.html';
  const file=path.resolve(root,'.'+requested);
  // Nothing outside the game's own folder.
  if(file!==root&&!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
  try{
    const info=await fsp.stat(file);if(!info.isFile())throw new Error('not a file');
    return new Response(await fsp.readFile(file),{status:200,headers:{'Content-Type':TYPES[path.extname(file).toLowerCase()]||'application/octet-stream',
      'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
  }catch{return new Response('Not found',{status:404});}
}

// Saves: one JSON file per name, written atomically (a temporary file renamed over it) with the previous copy kept as
// <name>.prev.json. The file is the chronicle on the desktop (src/ui/storage.js); Steam Cloud syncs <name>.json.
const SAVE_NAME=/^[a-z0-9-]{1,40}$/,SAVE_LIMIT=16*1024*1024;
const saveFile=name=>{if(!SAVE_NAME.test(String(name)))throw new Error('Invalid save name.');return path.join(savesDir(),`${name}.json`);};
async function readSave(name){try{return await fsp.readFile(saveFile(name),'utf8');}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function writeSave(name,text){
  if(typeof text!=='string'||text.length>SAVE_LIMIT)throw new Error('Invalid save data.');
  const file=saveFile(name),temporary=`${file}.${process.pid}.tmp`;
  await fsp.mkdir(savesDir(),{recursive:true});
  const handle=await fsp.open(temporary,'w');
  try{await handle.writeFile(text,'utf8');await handle.sync();}finally{await handle.close();}
  try{await fsp.copyFile(file,path.join(savesDir(),`${name}.prev.json`));}catch(error){if(error.code!=='ENOENT')throw error;}
  await fsp.rename(temporary,file);
}

function windowState(){try{return JSON.parse(fs.readFileSync(windowStateFile(),'utf8'));}catch{return {fullscreen:true};}}
function keepWindowState(win){
  try{fs.mkdirSync(path.dirname(windowStateFile()),{recursive:true});
    fs.writeFileSync(windowStateFile(),JSON.stringify({fullscreen:win.isFullScreen(),bounds:win.isFullScreen()?windowState().bounds:win.getNormalBounds()}));}catch{}
}

let win=null,quitting=false,quitRequest=0,crashed=false;
function createWindow(){
  const saved=windowState();
  win=new BrowserWindow({width:saved.bounds?.width??1280,height:saved.bounds?.height??800,x:saved.bounds?.x,y:saved.bounds?.y,minWidth:960,minHeight:600,
    fullscreen:saved.fullscreen!==false,backgroundColor:'#f0e7d5',title:'Imperium',show:false,
    icon:path.join(gameRoot(),'icons','icon-512.png'),
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});
  win.once('ready-to-show',()=>win.show());
  win.webContents.on('render-process-gone',()=>{crashed=true;});
  win.on('enter-full-screen',()=>win.webContents.send('window:fullscreen',true));
  win.on('leave-full-screen',()=>win.webContents.send('window:fullscreen',false));
  // Fullscreen belongs to the window, so Escape stays with the game: F11 and Alt+Enter toggle it.
  win.webContents.on('before-input-event',(event,input)=>{
    if(input.type!=='keyDown')return;
    if(input.key==='F11'||(input.key==='Enter'&&input.alt)){event.preventDefault();win.setFullScreen(!win.isFullScreen());}
    if(process.env.IMPERIUM_DEVTOOLS==='1'&&input.key==='F12')win.webContents.toggleDevTools();
  });
  // The game stays on its own origin. Web links open in the system browser; the game's own files (the credits'
  // licences) in a plain window without the bridge.
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(ORIGIN+'/')){event.preventDefault();if(/^https?:\/\//i.test(url))shell.openExternal(url);}});
  win.webContents.setWindowOpenHandler(({url})=>{
    if(/^https?:\/\//i.test(url))shell.openExternal(url);
    else if(url.startsWith(ORIGIN+'/')){const viewer=new BrowserWindow({width:900,height:720,title:'Imperium',autoHideMenuBar:true,
      webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});viewer.setMenu(null);viewer.loadURL(url);}
    return {action:'deny'};
  });
  // Closing saves first: the page answers once its save has settled (src/ui/app.js saveBeforeQuit). If it could not
  // save, the player chooses; a page that never answers (it failed to load) closes after ten seconds' wait.
  win.on('close',event=>{
    keepWindowState(win);
    if(quitting||crashed)return;
    event.preventDefault();
    const id=++quitRequest;
    const finish=saved=>{
      if(id!==quitRequest)return;quitRequest++;
      if(!saved&&dialog.showMessageBoxSync(win,{type:'warning',buttons:['Quit anyway','Keep playing'],defaultId:1,cancelId:1,title:'Imperium',
        message:'The chronicle could not be saved.',detail:'Quit anyway, losing what happened since the last save, or keep playing and export a save code from Settings.'})!==0)return;
      quitting=true;win.close();
    };
    const timer=setTimeout(()=>finish(false),10000);
    ipcMain.once(`app:quit-ready:${id}`,(_event,saved)=>{clearTimeout(timer);finish(!!saved);});
    win.webContents.send('app:quit-request',id);
  });
  win.on('closed',()=>{win=null;});
  win.loadURL(`${ORIGIN}/index.html`);
}

// Only the game's window may use the bridge.
const fromGame=event=>!!win&&event.sender===win.webContents&&event.senderFrame?.url?.startsWith(ORIGIN+'/');
ipcMain.handle('saves:read',(event,name)=>{if(!fromGame(event))throw new Error('Refused.');return readSave(name);});
ipcMain.handle('saves:write',(event,name,text)=>{if(!fromGame(event))throw new Error('Refused.');return writeSave(name,text);});
ipcMain.handle('window:is-fullscreen',event=>fromGame(event)&&win.isFullScreen());
ipcMain.handle('window:set-fullscreen',(event,value)=>{if(fromGame(event))win.setFullScreen(!!value);});
ipcMain.on('app:quit',event=>{if(fromGame(event))win.close();});
ipcMain.handle('steam:status',event=>fromGame(event)?steam.status():null);
ipcMain.handle('steam:unlock',(event,ids)=>{if(!fromGame(event))throw new Error('Refused.');return steam.unlock(ids);});

app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  protocol.handle(SCHEME,serveGame);
  createWindow();
});
app.on('window-all-closed',()=>app.quit());
