// The real app module, running in Node on the page skeleton of index.html in a
// small DOM (mini-dom.mjs): no canvas drawing, layout, audio or production
// storage. A test clicks the buttons and changes the controls the app rendered,
// and reads the page and what the app saved. `name` keeps each boot a fresh
// module instance; `settings` are stored preferences to start with.
import {readFileSync} from 'node:fs';
import {CONFIG} from '../src/config.js';
import {deserialize} from '../src/core/game.js';
import {Document} from './mini-dom.mjs';

export async function bootApp(t,{name,save=null,settings=null}={}){
  const originals=new Map(),set=(key,value)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
  const doc=new Document(),values=new Map(),frames=[],storage={reject:false,writes:0,keys:[]},pending=new Set();
  doc.body.innerHTML=/<body>([\s\S]*)<\/body>/.exec(readFileSync(new URL('../index.html',import.meta.url),'utf8'))[1].replace(/<script[\s\S]*?<\/script>/g,'');
  // The app's document listeners are async; remember their promises so a test can wait for them.
  const listen=doc.addEventListener.bind(doc);
  doc.addEventListener=(type,fn,options)=>listen(type,function(event){const result=fn.call(this,event);if(result?.then){pending.add(result);result.finally(()=>pending.delete(result));}},options);
  const win=Object.assign(new EventTarget(),{scrollTo(){},devicePixelRatio:1,innerWidth:1280,innerHeight:800});
  set('document',doc);set('window',win);
  set('navigator',{connection:{saveData:true},locks:{request:async(_name,fn)=>fn()},clipboard:{writeText:async()=>{}}});
  set('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));
  set('requestAnimationFrame',fn=>frames.push(fn));set('cancelAnimationFrame',()=>{});
  set('localStorage',{getItem:k=>values.get(k)??null,setItem(k,v){if(storage.reject)throw new Error('Storage intentionally unavailable');storage.writes++;storage.keys.push(k);values.set(k,v);},removeItem:k=>values.delete(k)});
  set('BroadcastChannel',class{postMessage(){}close(){}});set('CSS',{escape:text=>String(text).replace(/[^\w-]/g,c=>'\\'+c)});
  const nativeTimeout=globalThis.setTimeout,timeouts=[];set('setTimeout',(fn,delay,...args)=>{timeouts.push(delay);return delay===6500?0:nativeTimeout(fn,delay,...args);});
  if(settings)values.set('sacramentum.settings',JSON.stringify(settings));
  t.after(async()=>{await new Promise(setImmediate);for(const [key,descriptor]of originals)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];});
  const store=await import('../src/ui/storage.js');if(save)await store.saveLocal(save,{replace:true});
  storage.writes=0;storage.keys.length=0;
  await import(`../src/ui/app.js?${name}`);
  const settle=async()=>{for(let i=0;i<50&&pending.size;i++)await Promise.allSettled([...pending]);await new Promise(setImmediate);};
  const find=selector=>{const node=doc.querySelector(selector);if(!node)throw new Error(`Nothing on the page matches ${selector}`);return node;};
  const fire=(node,type)=>node.dispatchEvent(new Event(type,{bubbles:true,cancelable:true}));
  const button=(cmd,id)=>`[data-cmd="${cmd}"]${id===undefined?'':`[data-id="${id}"]`}`;
  return {
    doc,storage,
    timeouts, // every delay the app asked setTimeout for
    page:()=>doc.querySelector('#app').innerHTML,
    modal:()=>doc.querySelector('#modal'),
    find,
    // Clicks the button the app rendered for this command.
    async click(cmd,id){fire(find(button(cmd,id)),'click');await settle();},
    // Sends a command no rendered button offers, as a tampered page could.
    async command(cmd,id){const node=doc.createElement('button');node.dataset.cmd=cmd;if(id!==undefined)node.dataset.id=id;doc.body.append(node);fire(node,'click');node.remove();await settle();},
    // Sets a rendered control's properties, then sends its change event.
    async change(selector,props={}){const node=find(selector);Object.assign(node,props);fire(node,'change');await settle();},
    key(selector,key){const node=find(selector);const event=Object.defineProperty(new Event('keydown',{bubbles:true,cancelable:true}),'key',{value:key});node.dispatchEvent(event);return event;},
    // Runs the frames the app asked for (its deferred page work: focus, the board's bindings).
    frame(){const run=frames.splice(0);for(const fn of run)fn(performance.now());return run.length;},
    settle,
    // The tab goes to the background and comes back.
    async hide(){doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));for(let i=0;i<6;i++)await new Promise(resolve=>nativeTimeout(resolve,0));doc.hidden=false;},
    raw:()=>values.get(CONFIG.saveKey),
    saved:()=>deserialize(JSON.parse(values.get(CONFIG.saveKey)).payload),
    settings:()=>JSON.parse(values.get('sacramentum.settings')??'{}')
  };
}
