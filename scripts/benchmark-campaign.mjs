// Reproducible UI/scene acceptance: legal New Game -> public command snapshots
// -> the player's Restore dialog. No browser state, victory, position or actor
// is injected. SwiftShader captures establish browser correctness, not device FPS.
// node scripts/benchmark-campaign.mjs
// PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs node scripts/benchmark-campaign.mjs
// Optional installed browser: PLAYWRIGHT_EXECUTABLE_PATH=/absolute/chromium
// Optional: --base http://127.0.0.1:54934/ --images /absolute/evidence/directory
// --resume reuses only captures from the same dist revision and legal snapshot.
// Chapter V: Balanced at 1280x900; other inventory: Performance at 960x720; DPR 1.
import http from 'node:http';
import assert from 'node:assert/strict';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {serveRequest} from './serve.mjs';
import {runCommandCampaign} from './command-autoplay.mjs';
import * as Game from '../src/core/game.js';

const repo=fileURLToPath(new URL('../',import.meta.url));
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const images=resolve(arg('--images')||resolve(repo,'docs/images'));
const reportPath=resolve(arg('--report')||resolve(repo,'docs/evidence/benchmark-v034.json'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const externalBase=arg('--base')||process.env.BENCHMARK_BASE_URL;
const report={method:'Legal New Game and public commands only; snapshots restored through the visible Restore dialog; observations through DOM and public Export; no browser state injection.',build:externalBase?'external preview':'production dist',browser:'Chromium / SwiftShader',physicalDeviceTest:false,started:new Date().toISOString(),scenes:[],checks:[],errors:[]};
if(!externalBase)report.buildRevision=JSON.parse(await readFile(resolve(repo,'dist/build-report.json'),'utf8')).revision;
const snapshots=[],camps=[];
const campaign=runCommandCampaign({
  onEncounter:s=>snapshots.push({chapter:s.chapter,id:s.encounter.id,title:s.encounter.title,kind:s.encounter.kind,code:Game.encodeSave(s),serialized:Game.serialize(s)}),
  onCheckpoint:s=>camps.push({chapter:s.chapter,code:Game.encodeSave(s),serialized:Game.serialize(s)}),
});
report.campaign={rank:campaign.rank,encounters:campaign.encounters.length,completed:campaign.state.completed.length,exactRetries:campaign.checks.filter(c=>c.exactRetry).length};
const first=snapshots.filter(s=>s.chapter===5);
const representatives=Array.from({length:12},(_,i)=>snapshots.find(s=>s.chapter===i+1&&(i===0?s.id==='ch1-road':i===11?s.id==='ch12-confrontation':true)));
const captures=[...new Map([...first,...representatives].map(s=>[s.id,s])).values()];
assert.equal(new Set(captures.map(s=>s.chapter)).size,12);
assert.equal(first.length,2);
if(process.argv.includes('--resume')){
  const previous=JSON.parse(await readFile(reportPath,'utf8'));
  assert.ok(report.buildRevision&&report.buildRevision===previous.buildRevision,'Resume requires the exact recorded production build revision');
  for(const scene of previous.scenes??[]){
    const snapshot=captures.find(s=>s.id===scene.id);
    if(!snapshot||scene.sourceStateSha256!==hash(snapshot.serialized)||!scene.stateUnchanged)continue;
    if(!await access(resolve(repo,scene.screenshot)).then(()=>true,()=>false))continue;
    if(scene.chapter===5&&(!scene.horizon||!await access(resolve(repo,scene.horizon)).then(()=>true,()=>false)))continue;
    report.scenes.push({...scene,resumedFrom:previous.started});
  }
}
await mkdir(images,{recursive:true});await mkdir(resolve(reportPath,'..'),{recursive:true});
async function loadPlaywright(){
  for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){
    try{const m=await import(isAbsolute(specifier)?pathToFileURL(specifier).href:specifier);return m.chromium?m:m.default;}catch{}
  }
  throw new Error('Install Playwright separately, or set PLAYWRIGHT_MODULE to its index.js/index.mjs path.');
}
function unpack(code){
  const [prefix,body]=code.trim().split('.');
  const bytes=Buffer.from(body,'base64'),raw=prefix==='SAC1'?gunzipSync(bytes):bytes,parsed=JSON.parse(raw.toString('utf8'));
  return Game.deserialize(parsed.format===1?parsed.payload:raw.toString('utf8'));
}
let server,browser,base=externalBase;
const contexts=new Set();
async function open(options={}){
  const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,...options});
  contexts.add(context);const page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('pageerror',error=>report.errors.push({type:'page',message:error.message,url:page.url()}));
  page.on('console',message=>{if(message.type()==='error')report.errors.push({type:'console',message:message.text(),url:page.url()});});
  await page.goto(base,{waitUntil:'domcontentloaded'});return page;
}
async function close(page){contexts.delete(page.context());await page.context().close();}
async function menu(page,cmd){
  if(!await page.locator(`[data-cmd="${cmd}"]:visible`).count())await page.locator('[data-cmd="menu"]:visible').first().click();
  await page.locator(`[data-cmd="${cmd}"]:visible`).first().click();
}
async function closeModal(page){await page.locator('#modal [data-cmd="close-modal"]').first().click();}
async function settings(page,fn){await menu(page,'settings');await page.waitForSelector('#battle-view');await fn();await closeModal(page);}
const settled=page=>page.waitForFunction(()=>{const b=document.querySelector('#battle-board');return !b||b.dataset.bound==='true';});
async function restore(page,snapshot){
  await menu(page,'settings');await page.locator('#modal [data-cmd="restore"]').click();
  await page.locator('#restore-code').fill(snapshot.code);await page.locator('[data-cmd="import-code"]').click();
  await page.locator('[data-cmd="confirm-import"]').click();
  await page.waitForSelector(JSON.parse(snapshot.serialized).phase==='encounter'?'#battle-board':'.camp-page');
  await settled(page);
}
async function exported(page){
  await menu(page,'settings');await page.locator('#modal [data-cmd="export"]').click();
  const code=await page.locator('#save-code').inputValue();await closeModal(page);return unpack(code);
}
async function config(page,{view='3d',quality='balanced',text='1'}={}){
  await settings(page,async()=>{
    await page.selectOption('#battle-view',view);
    await page.selectOption('#graphics-quality',quality);
    await page.selectOption('#text-size',text);
    await page.check('#motion-setting');
    await page.uncheck('#adaptive-resolution');
    await page.uncheck('#guide-setting');
  });
}
async function ready3D(page){
  await page.locator('#battle-board').scrollIntoViewIfNeeded();await settled(page);
  await page.waitForFunction(()=>{
    const b=document.querySelector('#battle-board');
    if(b?.parentElement.dataset.ready!=='true'||b.dataset.actorAssets!=='imported')return false;
    try{return JSON.parse(b.dataset.renderStats).samples>=4;}catch{return false;}
  },null,{timeout:300000,polling:500});
}
async function inventory(page){
  return page.evaluate(()=>{
    const canvas=document.querySelector('#battle-board'),stats=JSON.parse(canvas.dataset.renderStats);
    return {scene:canvas.dataset.scene,chapter:Number(canvas.dataset.chapter),kind:canvas.dataset.kind,weather:canvas.dataset.weather,timeOfDay:canvas.dataset.timeOfDay,materials:canvas.dataset.materials,actorAssets:canvas.dataset.actorAssets,canvas:{width:canvas.width,height:canvas.height},stats};
  });
}
async function capture(page,id,{full=false,stage=true}={}){
  const path=resolve(images,`v034-${id}.png`);
  if(stage){const clip=await page.locator('.battle-stage').boundingBox();assert.ok(clip?.width&&clip?.height);await page.screenshot({path,clip,timeout:120000});}
  else await page.screenshot({path,fullPage:full,timeout:60000});
  return relative(repo,path).replaceAll('\\','/');
}
async function bounded(task,ms,message){
  let timer;
  try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]);}
  finally{clearTimeout(timer);}
}
async function run(name,fn){
  const start=Date.now();
  try{
    const detail=await bounded(fn(),fn===sceneInventory?31*60*1000:180000,`${name} exceeded its acceptance time budget`);
    report.checks.push({name,passed:true,milliseconds:Date.now()-start,...detail});console.log(`ok - ${name}`);
  }catch(error){
    report.checks.push({name,passed:false,milliseconds:Date.now()-start,error:error.message});console.error(`not ok - ${name}: ${error.message}`);
    for(const context of contexts){contexts.delete(context);await context.close().catch(()=>{});}
  }
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
}
async function sceneInventory(){
  const deadline=Date.now()+30*60*1000,failures=[];
  for(const snapshot of captures){
    if(report.scenes.some(s=>s.id===snapshot.id)){console.log(`  reusing verified ${snapshot.id} from the same build and legal snapshot`);continue;}
    const remaining=deadline-Date.now();assert.ok(remaining>0,'Scene inventory exceeded its 30-minute total budget');
    // Closing the context after every capture releases its actual WebGL context
    // and software raster resources, rather than waiting for canvas GC.
    const viewport=snapshot.chapter===5?{width:1280,height:900}:{width:960,height:720};
    const requestedQuality=snapshot.chapter===5?'balanced':'performance';
    const page=await open({viewport});let timer;
    try{
      const work=(async()=>{
      await config(page,{quality:requestedQuality});
      console.log(`  restoring ${snapshot.id}`);
      const started=Date.now();await restore(page,snapshot);console.log(`  waiting for ${snapshot.id} imported 3D frame`);await ready3D(page);
      const observed=await inventory(page);
      assert.equal(observed.chapter,snapshot.chapter);assert.equal(observed.kind,snapshot.kind);
      assert.ok(observed.stats.calls>0&&observed.stats.triangles>0,'The scene actually drew geometry');
      assert.equal(observed.actorAssets,'imported');
      console.log(`  capturing ${snapshot.id}`);const screenshot=await capture(page,snapshot.id);
      let horizon=null;
      if(snapshot.chapter===5){
        await page.locator('[data-cmd="camera-horizon"]').click();
        await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('#battle-board').dataset.renderStats).cameraView==='horizon';}catch{return false;}},null,{polling:300});
        horizon=await capture(page,`${snapshot.id}-horizon`);
      }
      const after=Game.serialize(await exported(page));
      assert.equal(after,snapshot.serialized,'Rendering, camera and settings leave the public save unchanged');
      report.scenes.push({chapter:snapshot.chapter,id:snapshot.id,title:snapshot.title,kind:snapshot.kind,sourceStateSha256:hash(snapshot.serialized),stateUnchanged:true,screenshot,horizon,viewport,deviceScaleFactor:1,requestedQuality,milliseconds:Date.now()-started,...observed});
      console.log(`  captured ${snapshot.id}: ${observed.stats.calls} draws, ${observed.stats.triangles} triangles, ${observed.stats.quality}`);
      await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
      })();
      await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${snapshot.id} exceeded its bounded scene budget`)),Math.min(remaining,snapshot.chapter===5?300000:150000));})]);
    }catch(error){
      failures.push({id:snapshot.id,message:error.message});
      report.sceneFailures??=[];report.sceneFailures.push({id:snapshot.id,error:error.message,observed:await bounded(page.evaluate(()=>{
      const board=document.querySelector('#battle-board');
      return {title:document.querySelector('h1')?.textContent,modalOpen:document.querySelector('#modal')?.open,board:board?{...board.dataset}:null,stage:board?.parentElement?{...board.parentElement.dataset}:null,announcement:document.querySelector('#announcement')?.textContent,feedback:document.querySelector('#action-feedback')?.textContent};
      }),3000,'Timed out reading failed-scene diagnostics').catch(()=>null)});
      console.error(`  failed ${snapshot.id}: ${error.message}`);
    }finally{clearTimeout(timer);await close(page);await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');}
  }
  assert.equal(failures.length,0,JSON.stringify(failures));
  assert.equal(new Set(report.scenes.map(s=>s.chapter)).size,12);
  assert.equal(report.scenes.length,captures.length,'Every requested scene has a completed capture and save-purity assertion');
  return {chapters:12,encounters:report.scenes.length,qualityPolicy:'Balanced Chapter V; Performance inventory elsewhere; viewport, DPR and observed quality recorded per scene'};
}
async function politicalCase(){
  const snapshot=snapshots.find(s=>s.kind==='contest'),page=await open();
  try{
    await config(page,{view:'2d'});await restore(page,snapshot);
    const state=Game.deserialize(snapshot.serialized),option=Game.caseOptions(state).find(c=>c.preview.ok),preview=Game.previewCase(state,option.id);
    await page.locator('details.command-intelligence > summary').filter({hasText:'Evidence & interests'}).click();
    await page.locator(`[data-cmd="inspect-case"][data-id="${option.id}"]`).click();
    assert.equal(await page.locator('.case-preview-table tbody tr').count(),preview.changes.length);
    const previewText=await page.locator('#modal').innerText();assert.match(previewText,/one speech/i);
    const screenshot=await capture(page,'political-case-preview',{stage:false});
    await closeModal(page);assert.equal(Game.serialize(await exported(page)),snapshot.serialized,'Inspecting a case spends nothing');
    await page.locator(`[data-cmd="inspect-case"][data-id="${option.id}"]`).click();
    await page.locator('[data-cmd="present-case"]').click();await settled(page);
    const committed=await exported(page);assert.ok(Game.presentCase(state,option.id).ok);
    assert.equal(Game.serialize(committed),Game.serialize(state),'UI commit matches the authoritative public case command exactly');
    return {encounter:snapshot.id,case:option.id,stanceChanges:preview.changes,screenshot,previewUnchanged:true,commitMatchesPublicCommand:true};
  }finally{await close(page);}
}
async function narrowReadability(){
  const page=await open({viewport:{width:320,height:780},isMobile:true,hasTouch:true});
  try{
    await config(page,{view:'2d',text:'2'});await restore(page,first[0]);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim()),'2');
    const measure=()=>page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+.5);}).slice(0,12).map(n=>({tag:n.tagName,class:n.className,width:Math.round(n.getBoundingClientRect().width)}))}));
    const battlefield=await measure();assert.ok(battlefield.width<=321,JSON.stringify(battlefield));
    const screenshot=await capture(page,'320px-200percent-text',{stage:false});
    await menu(page,'settings');const modal=await measure();assert.ok(modal.width<=321,JSON.stringify(modal));
    const settingsShot=await capture(page,'320px-200percent-settings',{stage:false});
    await closeModal(page);
    return {battlefield,modal,textScale:2,screenshot,settingsShot};
  }finally{await close(page);}
}
async function remappedKeyboard(){
  const page=await open(),snapshot=snapshots.find(s=>s.id==='ch1-training');
  try{
    await config(page,{view:'2d'});await restore(page,snapshot);
    await settings(page,()=>page.selectOption('#binding-undo','z'));
    await page.focus('#battle-board');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>/^Walked/.test(document.querySelector('#announcement').textContent));
    const moved=await exported(page),origin=Game.deserialize(snapshot.serialized).encounter.units.find(u=>u.id==='hero'),walked=moved.encounter.units.find(u=>u.id==='hero');
    assert.notEqual(`${walked.x},${walked.y}`,`${origin.x},${origin.y}`);
    await settled(page);await page.focus('#battle-board');await page.keyboard.press('z');
    await page.waitForFunction(()=>/movement restored/.test(document.querySelector('#announcement').textContent));
    const returned=(await exported(page)).encounter.units.find(u=>u.id==='hero');assert.equal(`${returned.x},${returned.y}`,`${origin.x},${origin.y}`);assert.equal(returned.moved,origin.moved);
    await menu(page,'help');assert.match(await page.locator('#modal').innerText(),/Z takes back|Undo Move \(Z\)/);await closeModal(page);
    await page.reload();await page.locator('[data-cmd="continue"]').first().click();
    await menu(page,'settings');assert.equal(await page.locator('#binding-undo').inputValue(),'z');await closeModal(page);
    return {undo:'z',walked:true,returned:true,persistedAfterReload:true};
  }finally{await close(page);}
}
async function practiceIsolation(){
  const page=await open(),snapshot=camps.find(s=>s.chapter===5);
  try{
    await config(page,{view:'2d'});await restore(page,snapshot);
    const primary=Game.serialize(await exported(page));
    await page.locator('.practice-library > summary').click();await page.locator('[data-cmd="archive-replay"]').first().click();
    await page.waitForSelector('.archive-banner');await settled(page);
    await page.locator('.archive-mutators > summary').click();
    await page.selectOption('#archive-weather','rain');await page.selectOption('#archive-time','dusk');await page.selectOption('#archive-difficulty','veteran');
    await page.locator('[data-cmd="apply-archive-mutators"]').click();await settled(page);
    await page.locator('[data-cmd="end-turn"]').click();
    await page.waitForFunction(()=>/TURN 2/.test(document.querySelector('.command-clock')?.textContent??''));await settled(page);
    assert.match(await page.locator('.command-clock').innerText(),/TURN 2/);
    assert.equal(Game.serialize(await exported(page)),primary,'Practice export preserves the active chronicle');
    const screenshot=await capture(page,'practice-isolation',{stage:false});
    await page.locator('[data-cmd="exit-archive"]').click();await page.waitForSelector('.camp-page');
    assert.equal(Game.serialize(await exported(page)),primary,'Returning restores the exact active chronicle');
    await page.reload();await page.locator('[data-cmd="continue"]').first().click();await page.waitForSelector('.camp-page');
    assert.equal(Game.serialize(await exported(page)),primary,'Reload loads the active chronicle, not practice');
    return {primaryStateSha256:hash(primary),changedWeather:true,changedDifficulty:true,playedTurn:true,exportUnchanged:true,exitUnchanged:true,reloadUnchanged:true,screenshot};
  }finally{await close(page);}
}
try{
  if(!base){const root=resolve(repo,'dist');await access(resolve(root,'index.html'));server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(done=>server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${server.address().port}/`;}
  const {chromium}=await loadPlaywright();
  const executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  browser=await chromium.launch({...(executablePath?{executablePath}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  report.browserVersion=browser.version();
  for(const [name,fn]of [['All twelve chapters render; both Chapter V encounters first',sceneInventory],['Political case preview and commit',politicalCase],['320px viewport at 200% text',narrowReadability],['Remapped keyboard action and persistence',remappedKeyboard],['Practice primary-save isolation',practiceIsolation]])await run(name,fn);
}catch(error){report.errors.push({type:'runner',message:error.stack||error.message});console.error(error);}
finally{
  for(const context of contexts)await context.close().catch(()=>{});await browser?.close();await new Promise(done=>server?server.close(done):done());
  report.completed=new Date().toISOString();report.passed=report.checks.length===5&&report.checks.every(c=>c.passed)&&!report.errors.length;
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(`${report.passed?'PASS':'FAIL'} - ${relative(repo,reportPath)}; ${report.scenes.length} captured scenes; ${report.errors.length} browser/runner errors`);
  process.exitCode=report.passed?0:1;
}
