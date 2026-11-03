'use strict';
// The desktop app's bridge (desktop/main.cjs; src/ui/platform.js): the only way the game's page reaches the computer.
// Sandboxed, with context isolation: the page gets these few functions, never Node or Electron.
const {contextBridge,ipcRenderer}=require('electron');

let quitRequest=0;
contextBridge.exposeInMainWorld('imperiumDesktop',Object.freeze({
  version:1,
  // The chronicle's save file: read(name) resolves to its text or null; write(name,text) resolves once it is on disk.
  saves:Object.freeze({read:name=>ipcRenderer.invoke('saves:read',name),write:(name,text)=>ipcRenderer.invoke('saves:write',name,text)}),
  // The Menu's Quit: the window closes after the page has answered a quit request.
  quit:()=>ipcRenderer.send('app:quit'),
  // When the window is closing, handler() runs; the page answers quitReady(saved) once its save has settled.
  onQuitRequest:handler=>{ipcRenderer.on('app:quit-request',(_event,id)=>{quitRequest=id;try{handler();}catch{ipcRenderer.send(`app:quit-ready:${id}`,false);}});},
  quitReady:saved=>{if(quitRequest)ipcRenderer.send(`app:quit-ready:${quitRequest}`,!!saved);},
  window:Object.freeze({
    isFullscreen:()=>ipcRenderer.invoke('window:is-fullscreen'),
    setFullscreen:value=>ipcRenderer.invoke('window:set-fullscreen',!!value),
    onFullscreenChange:handler=>{ipcRenderer.on('window:fullscreen',(_event,value)=>handler(!!value));}
  })
}));
