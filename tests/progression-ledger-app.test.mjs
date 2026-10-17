import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {CONFIG} from '../src/config.js';

test('Actual ledger settlement handlers retain storage-failure feedback after refreshing both debt types',async t=>{
  // A legally earned camp before the chapter XII decision resolves its debts.
  let checkpoint;runProgressionCampaign({beforeCamp:s=>{if(s.chapter===12&&s.encounterIndex===0)checkpoint=G.deserialize(G.serialize(s));}});
  const agreements=checkpoint.progression.agreements.filter(a=>a.status==='open'),obligation=checkpoint.obligations.find(a=>a.status==='open'&&checkpoint.chapter>=a.due);
  assert.ok(agreements.length>=2&&obligation);

  // Inert DOM integration: the actual app, public rules and storage modules run.
  // Setting modal.innerHTML really discards its feedback node, as a browser does.
  const originals=new Map(),set=(key,value)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
  const callbacks=new Map(),values=new Map(),nodes=new Map();let rejectWrites=false;
  const node=(id='')=>({id,innerHTML:'',textContent:'',hidden:false,open:false,dataset:{},style:{setProperty(){}},isConnected:true,querySelectorAll:()=>[],querySelector:selector=>nodes.get(selector)??null,setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){},addEventListener(){},prepend(){},after(){},close(){this.open=false;},showModal(){this.open=true;}});
  for(const id of ['#app','#announcement','.system-feedback','.save-status','#panel-title','#action-feedback'])nodes.set(id,node(id));
  const modal=node('#modal'),body=node('.modal-body');let modalHtml='',modalFeedback=null;
  Object.defineProperty(modal,'innerHTML',{get:()=>modalHtml,set:value=>{modalHtml=value;modalFeedback=null;}});
  body.prepend=note=>{modalFeedback=note;};modal.querySelector=selector=>selector==='.modal-feedback'?modalFeedback:selector==='.modal-body'?body:nodes.get(selector)??null;nodes.set('#modal',modal);
  const doc={hidden:false,activeElement:null,documentElement:node(),addEventListener(name,fn){if(!callbacks.has(name))callbacks.set(name,[]);callbacks.get(name).push(fn);},removeEventListener(){},querySelector:selector=>nodes.get(selector)??null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>node()};
  set('document',doc);set('window',{addEventListener(){},scrollTo(){}});set('navigator',{connection:{saveData:true},locks:{request:async(_name,fn)=>fn()}});set('matchMedia',()=>({matches:true}));set('requestAnimationFrame',()=>1);set('cancelAnimationFrame',()=>{});
  set('localStorage',{getItem:k=>values.get(k)??null,setItem(k,v){if(rejectWrites)throw new Error('Storage intentionally unavailable');values.set(k,v);},removeItem:k=>values.delete(k)});set('BroadcastChannel',class{postMessage(){}close(){}});
  const nativeTimeout=globalThis.setTimeout;set('setTimeout',(fn,delay,...args)=>delay===6500?0:nativeTimeout(fn,delay,...args));
  t.after(async()=>{await new Promise(setImmediate);for(const [key,descriptor]of originals)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];});
  const storage=await import('../src/ui/storage.js');await storage.saveLocal(checkpoint,{replace:true});await import('../src/ui/app.js?progression-ledger-feedback');
  const click=async(cmd,id)=>{const button={dataset:{cmd,id},disabled:false};for(const fn of callbacks.get('click')??[])await fn({target:{closest:()=>button}});};
  const persisted=()=>values.get(CONFIG.saveKey),initial=persisted();
  await click('continue');await click('ledger');assert.equal(modal.open,true);
  rejectWrites=true;
  for(const [cmd,id]of [['agreement-break',agreements[0].id],['settle-break',obligation.id]]){
    await click(cmd,id);assert.equal(persisted(),initial,'Failed persistence must retain the previous durable checkpoint');
    assert.match(modalFeedback?.textContent||'',/Safe browser storage is unavailable/,'Refreshing the ledger must preserve the latest save failure');
    assert.match(modalHtml,/broken/i,'The refreshed ledger must reflect the in-memory settlement');
  }
  await click('agreement-break',agreements[0].id);assert.match(modalFeedback?.textContent||'',/Resolve an open agreement/,'Invalid duplicate settlement feedback also survives refresh');assert.equal(persisted(),initial);
  rejectWrites=false;await click('agreement-break',agreements[1].id);
  const saved=G.deserialize(JSON.parse(persisted()).payload);assert.equal(saved.progression.agreements.find(a=>a.id===agreements[0].id).status,'broken');assert.equal(saved.progression.agreements.find(a=>a.id===agreements[1].id).status,'broken');assert.equal(saved.obligations.find(a=>a.id===obligation.id).status,'broken');
  assert.ok(modalFeedback?.textContent.includes(`${agreements[1].pledge} broken.`));assert.doesNotMatch(modalFeedback.textContent,/storage is unavailable/,'A later successful save replaces the stale error');
});
