import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const template=await readFile(new URL('../scripts/service-worker.template.js',import.meta.url),'utf8');
const base='https://imperium.test/game/',revision='test-edition';
const initial=['./index.html','./src/ui/app.js','./assets/title.webp'];
const groups={1:['./assets/first.webp'],12:['./assets/final.webp']},flatGroups={1:['./assets/first-2d.webp']};
const files=[...initial,...groups[1],...groups[12],...flatGroups[1]];

function harness(){
  const handlers={},stores=new Map(),messages=[],fetches=[];
  let fail=null,offline=false,skipCalls=0;
  const normalize=path=>new URL(typeof path==='string'?path:path.url,base).href;
  const fetcher=async request=>{
    const url=normalize(request);fetches.push({url,cache:request.cache});
    if(offline||url===fail)throw Error('Unavailable');
    return new Response('current:'+url);
  };
  const cache=name=>{
    if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
    return {match:async path=>store.get(normalize(path))?.clone(),put:async(path,response)=>store.set(normalize(path),response.clone()),keys:async()=>[...store.keys()]};
  };
  const client={postMessage:message=>messages.push(message)};
  const self={registration:{scope:base},location:{origin:new URL(base).origin},clients:{matchAll:async()=>[client],claim:async()=>{}},skipWaiting:()=>{skipCalls++;},addEventListener:(name,handler)=>handlers[name]=handler};
  const code=template.replaceAll('__REVISION__',revision).replace('__ALL_FILES__',JSON.stringify(files)).replace('__INITIAL_FILES__',JSON.stringify(initial)).replace('__CHAPTER_FILES__',JSON.stringify(groups)).replace('__CHAPTER_FLAT_FILES__',JSON.stringify(flatGroups));
  vm.runInNewContext(code,{self,caches:{open:async name=>cache(name),keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)},fetch:fetcher,URL,Request,Response,console});
  const fire=async(name,data={})=>{let result;handlers[name]({...data,waitUntil:p=>{result=p;},respondWith:p=>{result=p;}});return result;};
  return {fire,client,messages,stores,fetches,cache,normalize,cacheName:'imperium-'+revision,setFail:path=>{fail=path?normalize(path):null;},setOffline:value=>{offline=value;},skipCalls:()=>skipCalls};
}

test('CACHE-01 install and activation fetch only the opening shell without forcing activation',async()=>{
  const h=harness();await h.fire('install');await h.fire('activate');
  assert.equal(h.fetches.length,initial.length);assert.equal(h.skipCalls(),0);
  assert.equal(h.stores.get(h.cacheName).has(h.normalize(groups[12][0])),false);
  await h.fire('message',{data:{type:'offline-status',chapter:1},source:h.client});
  assert.equal(h.messages.find(m=>m.type==='chapter-offline').ready,false);
  assert.equal(h.messages.some(m=>m.type==='offline-ready'),false);
});
test('CACHE-02 current chapter caching reports chapter-ready without claiming the full campaign',async()=>{
  const h=harness();await h.fire('install');
  await h.fire('message',{data:{type:'cache-chapter',chapter:1},source:h.client});
  const status=h.messages.at(-1);assert.equal(status.type,'chapter-offline');assert.equal(status.ready,true);assert.equal(status.chapter,1);
  assert.equal(h.stores.get(h.cacheName).size,initial.length+1);
  assert.equal(h.messages.some(m=>m.type==='offline-ready'),false);
});
test('CACHE-03 failed chapter fetch stays incomplete and a retry completes only that chapter',async()=>{
  const h=harness();await h.fire('install');h.setFail(groups[1][0]);
  await h.fire('message',{data:{type:'cache-chapter',chapter:1},source:h.client});
  assert.equal(h.messages.at(-1).ready,false);assert.ok(h.messages.some(m=>m.type==='offline-error'));
  h.setFail(null);await h.fire('message',{data:{type:'cache-chapter',chapter:1},source:h.client});
  assert.equal(h.messages.at(-1).ready,true);assert.equal(h.stores.get(h.cacheName).has(h.normalize(groups[12][0])),false);
});
test('CACHE-04 concurrent chapter and explicit whole-campaign requests share network fetches',async()=>{
  const h=harness();await h.fire('install');
  await Promise.all([h.fire('message',{data:{type:'cache-chapter',chapter:1},source:h.client}),h.fire('message',{data:'cache-campaign',source:h.client})]);
  assert.equal(h.stores.get(h.cacheName).size,files.length);
  for(const path of files)assert.equal(h.fetches.filter(f=>f.url===h.normalize(path)).length,1,path);
  assert.ok(h.messages.some(m=>m.type==='offline-ready'));
});
test('CACHE-05 new revision ignores old artwork and reloads reused HTTP asset URLs',async()=>{
  const h=harness();await h.fire('install');await h.cache('sacramentum-old').put(groups[12][0],new Response('OLD'));
  const request={method:'GET',url:h.normalize(groups[12][0]),mode:'cors'};
  const response=await h.fire('fetch',{request});assert.ok((await response.text()).startsWith('current:'));
  assert.equal(h.fetches.at(-1).cache,'reload');
  await h.fire('fetch',{request});assert.equal(h.fetches.filter(f=>f.url===request.url).length,1);
});
test('CACHE-06 offline navigation and downloaded chapter assets survive server unavailability',async()=>{
  const h=harness();await h.fire('install');await h.fire('message',{data:{type:'cache-chapter',chapter:1},source:h.client});h.setOffline(true);
  const shell=await h.fire('fetch',{request:{method:'GET',url:base,mode:'navigate'}});
  assert.ok((await shell.text()).includes('index.html'));
  const art=await h.fire('fetch',{request:{method:'GET',url:h.normalize(groups[1][0]),mode:'cors'}});
  assert.ok((await art.text()).includes('first.webp'));
  await assert.rejects(h.fire('fetch',{request:{method:'GET',url:h.normalize(groups[12][0]),mode:'cors'}}));
});
test('CACHE-07 incomplete initial install fails and leaves the old edition untouched',async()=>{
  const h=harness();for(const name of ['sacramentum-old','imperium-old'])await h.cache(name).put('./index.html',new Response('old working shell'));
  h.setFail(initial[1]);await assert.rejects(h.fire('install'));
  for(const name of ['sacramentum-old','imperium-old'])assert.equal(await(await h.cache(name).match('./index.html')).text(),'old working shell');
  assert.equal(h.skipCalls(),0);
});

test('CACHE-08 Imperium activation cleans both obsolete brands while retaining its complete current cache and unrelated apps',async()=>{
  const h=harness();
  for(const name of ['sacramentum-old','imperium-old','another-game-v1','unrelated-imperium-notes'])await h.cache(name).put('./index.html',new Response(name));
  await h.fire('install');await h.fire('message',{data:'cache-campaign',source:h.client});
  assert.ok(h.stores.has('sacramentum-old'),'Installation alone cannot retire the running old edition.');
  const current=[...h.stores.get(h.cacheName).keys()];await h.fire('activate');
  assert.ok(!h.stores.has('sacramentum-old'));assert.ok(!h.stores.has('imperium-old'));
  assert.deepEqual([...h.stores.get(h.cacheName).keys()],current);
  for(const name of ['another-game-v1','unrelated-imperium-notes'])assert.equal(await(await h.cache(name).match('./index.html')).text(),name);
  h.setOffline(true);const response=await h.fire('fetch',{request:{method:'GET',url:h.normalize(groups[12][0]),mode:'cors'}});
  assert.equal(await response.text(),'current:'+h.normalize(groups[12][0]));assert.equal(h.skipCalls(),0);
});
test('CACHE-09 a 3D player’s chapter leaves the 2D art out; the 2D view adds only that art to it',async()=>{
  const h=harness();await h.fire('install');
  await h.fire('message',{data:{type:'cache-chapter',chapter:1},source:h.client});
  assert.equal(h.messages.at(-1).ready,true);assert.equal(h.messages.at(-1).flat,false);
  assert.equal(h.stores.get(h.cacheName).has(h.normalize(flatGroups[1][0])),false,'A 3D player never downloads the 2D art');
  await h.fire('message',{data:{type:'offline-status',chapter:1,flat:true},source:h.client});
  const status=h.messages.at(-1);assert.equal(status.type,'chapter-offline');assert.equal(status.flat,true);
  assert.equal(status.ready,false,'The 2D view is not ready offline without its art');
  const before=h.fetches.length;
  await h.fire('message',{data:{type:'cache-chapter',chapter:1,flat:true},source:h.client});
  assert.equal(h.messages.at(-1).ready,true);assert.equal(h.messages.at(-1).flat,true);
  assert.deepEqual(h.fetches.slice(before).map(f=>f.url),flatGroups[1].map(h.normalize),'Only the 2D art is fetched; the 3D pack is reused');
  await h.fire('message',{data:{type:'cache-chapter',chapter:12,flat:true},source:h.client});
  assert.equal(h.messages.at(-1).ready,true,'A chapter without 2D art is ready for the 2D view with its pack alone');
});
