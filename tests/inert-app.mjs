// An inert DOM for driving the real app module under Node: no canvas, layout,
// audio or production storage. The app renders its pages as HTML strings; a
// test sends the click and change events its buttons and controls send, and
// reads what the app saved. `name` keeps each boot a fresh module instance.
import {CONFIG} from '../src/config.js';
import {deserialize} from '../src/core/game.js';

export async function bootApp(t,{name,save=null}={}){
  const originals=new Map(),set=(key,value)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
  const callbacks=new Map(),values=new Map(),nodes=new Map();
  const node=(id='')=>({id,innerHTML:'',textContent:'',hidden:false,open:false,dataset:{},style:{setProperty(){}},isConnected:true,
    querySelectorAll:()=>[],querySelector:selector=>nodes.get(selector)??null,setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){},
    addEventListener(){},prepend(){},after(){},close(){this.open=false;},showModal(){this.open=true;}});
  for(const id of ['#app','#modal','#announcement','.system-feedback','.save-status','.modal-feedback','.modal-body','#panel-title','#action-feedback'])nodes.set(id,node(id));
  const doc={hidden:false,activeElement:null,documentElement:node(),
    addEventListener(type,fn){if(!callbacks.has(type))callbacks.set(type,[]);callbacks.get(type).push(fn);},removeEventListener(){},
    querySelector:selector=>nodes.get(selector)??null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>node()};
  set('document',doc);set('window',{addEventListener(){},scrollTo(){}});
  set('navigator',{connection:{saveData:true},locks:{request:async(_name,fn)=>fn()}});set('matchMedia',()=>({matches:true}));
  set('requestAnimationFrame',()=>1);set('cancelAnimationFrame',()=>{});
  set('localStorage',{getItem:k=>values.get(k)??null,setItem(k,v){values.set(k,v);},removeItem:k=>values.delete(k)});set('BroadcastChannel',class{postMessage(){}close(){}});
  const nativeTimeout=globalThis.setTimeout;set('setTimeout',(fn,delay,...args)=>delay===6500?0:nativeTimeout(fn,delay,...args));
  t.after(async()=>{await new Promise(setImmediate);for(const [key,descriptor]of originals)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];});
  const storage=await import('../src/ui/storage.js');if(save)await storage.saveLocal(save,{replace:true});
  await import(`../src/ui/app.js?${name}`);
  const dispatch=async(type,target)=>{for(const fn of callbacks.get(type)??[])await fn({target});};
  return {
    nodes,
    page:()=>nodes.get('#app').innerHTML,
    click:(cmd,id)=>dispatch('click',{closest:()=>({dataset:{cmd,id},disabled:false})}),
    change:control=>dispatch('change',{dataset:{},matches:()=>false,...control}),
    saved:()=>deserialize(JSON.parse(values.get(CONFIG.saveKey)).payload),
    settings:()=>JSON.parse(values.get('sacramentum.settings')??'{}')
  };
}
