// Lets Node run the page's own decoders: a dedicated Worker runs its script in
// a vm context of its own (the Basis transcoder worker is a classic script),
// fetch reads file: URLs, and three's FileLoader finds a ProgressEvent. Tests
// use it to load KTX2 textures exactly as the page does. Returns a restore
// function and the URLs requested.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export function useNodeWorkers(){
  const saved={Worker:globalThis.Worker,fetch:globalThis.fetch,ProgressEvent:globalThis.ProgressEvent},requests=[],workers=[];
  class NodeWorker{
    constructor(url){
      const href=String(url),inbox=[],context={console,WebAssembly,TextDecoder,TextEncoder,setTimeout,clearTimeout,performance};
      context.self=context;context.addEventListener=(type,listener)=>{if(type==='message')inbox.push(listener);};
      this.listeners={message:[],error:[]};this.inbox=inbox;this.context=context;this.url=href;workers.push(href);
      // Messages are structured clones, as between a page and its workers.
      context.postMessage=(message,transfer=[])=>{const data=structuredClone(message,{transfer});queueMicrotask(()=>{for(const listener of this.listeners.message)listener({data});this.onmessage?.({data});});};
      vm.createContext(context);vm.runInContext(readFileSync(fileURLToPath(href),'utf8'),context,{filename:href});
    }
    addEventListener(type,listener){this.listeners[type]?.push(listener);}
    removeEventListener(type,listener){this.listeners[type]=(this.listeners[type]??[]).filter(l=>l!==listener);}
    postMessage(message,transfer=[]){const data=structuredClone(message,{transfer});queueMicrotask(()=>{for(const listener of this.inbox)listener({data});this.context.onmessage?.({data});});}
    terminate(){}
  }
  globalThis.Worker=NodeWorker;
  globalThis.fetch=async input=>{
    const url=String(input?.url??input);requests.push(url);
    if(!url.startsWith('file:'))throw new TypeError(`connect-src refuses ${url}`);
    return new Response(await readFile(new URL(url)));
  };
  globalThis.ProgressEvent??=class extends Event{constructor(type,init={}){super(type);Object.assign(this,init);}};
  return {requests,workers,restore(){for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}};
}
