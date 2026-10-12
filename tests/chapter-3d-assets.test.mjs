import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {chapterAssets,chapterOfflineAssets} from '../src/ui/art.js';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
async function paths(folder){
  const result=[];for(const entry of await readdir(new URL(folder,root),{withFileTypes:true})){const path=folder+entry.name;result.push(...entry.isDirectory()?await paths(path+'/'):['./'+path]);}return result;
}
const files=(await Promise.all(['src/showcase/','assets/showcase/','vendor/three/','showcase/'].map(paths))).flat();

test('Every chapter can be restored cold with actual renderer, sound, vendor and materials; image decoding stays image-only',async()=>{
  const stage=await readFile(new URL('src/showcase/stage.js',root),'utf8');
  for(let chapter=1;chapter<=12;chapter++){
    const group=chapterOfflineAssets(chapter,files);
    for(const required of ['./src/showcase/stage.js','./src/showcase/battle-sound.js','./vendor/three/three.module.js','./vendor/three/three.core.js','./vendor/three/LICENSE','./assets/showcase/earth.webp','./assets/showcase/stone.webp','./assets/showcase/timber.webp'])assert.ok(group.includes(required),`Chapter ${chapter}: ${required}`);
    assert.ok(!group.includes('./showcase/index.html'));assert.ok(!group.includes('./src/showcase/showcase.css'));
    assert.ok(chapterAssets(chapter).every(path=>/\.(webp|png|jpe?g)$/.test(path)),'An image decoder must never receive a JS/CSS dependency');
    for(const match of stage.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g))assert.ok(group.includes('./src/showcase/'+match[1].slice(2)),`Chapter ${chapter}: stage dependency omitted: ${match[1]}`);
  }
});

test('Shared dependencies use identical deduplicated URLs across chapters without losing any chapter-specific art',()=>{
  const first=chapterOfflineAssets(1,files).filter(path=>!chapterAssets(1).includes(path));
  for(let chapter=1;chapter<=12;chapter++){
    const art=chapterAssets(chapter),group=chapterOfflineAssets(chapter,[...files,...files]);
    assert.equal(new Set(group).size,group.length);
    assert.deepEqual(group.filter(path=>!art.includes(path)),first);
    for(const path of art)assert.ok(group.includes(path),`Chapter ${chapter} artwork lost: ${path}`);
  }
});

test('A cold restored Senate chapter retries missing 3D code, works offline and reuses it for the next chapter',async()=>{
  const template=await readFile(new URL('scripts/service-worker.template.js',root),'utf8'),base='https://sacramentum.test/game/',initial=['./index.html','./src/ui/app.js'];
  const groups=Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,chapterOfflineAssets(i+1,files)])),all=[...new Set([...initial,...files,...Object.values(groups).flat()])];
  const handlers={},stores=new Map(),messages=[],fetches=[],normal=p=>new URL(typeof p==='string'?p:p.url,base).href;
  let failed=normal('./src/showcase/stage.js'),offline=false;
  const cache=name=>{if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);return {match:async p=>m.get(normal(p))?.clone(),put:async(p,r)=>m.set(normal(p),r.clone()),keys:async()=>[...m.keys()]};};
  const fetcher=async p=>{const url=normal(p);fetches.push(url);if(offline||url===failed)throw Error('offline');return new Response('current:'+url);};
  const client={postMessage:m=>messages.push(m)},self={registration:{scope:base},location:{origin:new URL(base).origin},clients:{matchAll:async()=>[client],claim:async()=>{}},addEventListener:(k,v)=>handlers[k]=v};
  const code=template.replaceAll('__REVISION__','campaign-3d').replace('__ALL_FILES__',JSON.stringify(all)).replace('__INITIAL_FILES__',JSON.stringify(initial)).replace('__CHAPTER_FILES__',JSON.stringify(groups));
  vm.runInNewContext(code,{self,caches:{open:async n=>cache(n),keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n)},fetch:fetcher,URL,Request,Response,console});
  const fire=async(type,data={})=>{let p;handlers[type]({...data,waitUntil:v=>p=v,respondWith:v=>p=v});return p;};
  await fire('install');assert.deepEqual(fetches,initial.map(normal),'Initial installation must not fetch Three or shared scenes');
  await fire('message',{data:{type:'cache-chapter',chapter:11},source:client});
  assert.equal(messages.at(-1).ready,false,'Missing shared code cannot claim offline readiness');
  failed=null;await fire('message',{data:{type:'cache-chapter',chapter:11},source:client});assert.equal(messages.at(-1).ready,true);
  const count=fetches.filter(url=>url===normal('./vendor/three/three.module.js')).length;
  await fire('message',{data:{type:'cache-chapter',chapter:12},source:client});assert.equal(messages.at(-1).ready,true);
  assert.equal(fetches.filter(url=>url===normal('./vendor/three/three.module.js')).length,count,'Same-edition renderer must not redownload by chapter');
  assert.ok(!fetches.includes(normal('./showcase/index.html')));assert.ok(!fetches.includes(normal('./src/showcase/showcase.css')));
  assert.ok(!messages.some(m=>m.type==='offline-ready'),'Two restored chapters are not the complete campaign');
  offline=true;
  for(const path of groups[11]){const response=await fire('fetch',{request:{method:'GET',url:normal(path),mode:'cors'}});assert.equal(await response.text(),'current:'+normal(path));}
});
