// Run after npm run build. Development-only asset and worker regression checks.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {PRESENTATION_BUDGET as budget} from '../src/ui/presentation-budget.js';
import {CONFIG} from '../src/config.js';
import {chapterAudioAssets} from '../src/ui/art.js';

const manifest=JSON.parse(await readFile('docs/asset-manifest.json','utf8'));
for(const asset of manifest.assets){
  const data=await readFile(asset.path);
  assert.equal(data.length,asset.export.bytes,asset.id+' byte count');
  assert.equal(createHash('sha256').update(data).digest('hex'),asset.export.sha256,asset.id+' digest');
}
assert.ok(manifest.assets.filter(a=>a.path.startsWith('assets/portraits/')).reduce((s,a)=>s+a.export.bytes,0)<=400000);
assert.ok(manifest.assets.find(a=>a.id==='frontier-oath').export.bytes<=350000);
console.log('PASS asset manifest integrity and portrait/title budgets');

const code=await readFile('dist/sw.js','utf8'),build=JSON.parse(await readFile('dist/build-report.json','utf8'));
const {CONFIG:builtConfig}=await import('../dist/src/config.js');
assert.equal(builtConfig.saveKey,CONFIG.saveKey,'The built rename must keep the existing campaign store.');
assert.equal(builtConfig.version,build.version);
assert.ok(build.initialGzipBytes<=budget.initialGzipBytes&&build.chapterOneGzipBytes<=budget.chapterOneGzipBytes&&build.completeGzipBytes<=budget.completeGzipBytes);
assert.equal(Object.keys(build.chapterAssets).length,12);
for(const paths of Object.values(build.chapterAssets))for(const path of paths)assert.ok(build.initialAssets.includes(path)||build.deferredAssets.includes(path),path);
for(const path of [...build.initialAssets,...build.deferredAssets].filter(path=>path.startsWith('./assets/')))assert.ok(manifest.assets.some(asset=>'./'+asset.path===path),'Missing provenance: '+path);
console.log('PASS declared startup/chapter1/campaign budgets, chapter groups and bundled asset provenance');
const audioPaths=manifest.assets.filter(a=>a.path.startsWith('assets/audio/')).map(a=>'./'+a.path);
assert.equal(audioPaths.length,14,'All original generated audio files have provenance');
for(const path of audioPaths){assert.ok(build.deferredAssets.includes(path),'Audio stays out of installation: '+path);assert.ok(!build.initialAssets.includes(path));}
for(let chapter=1;chapter<=12;chapter++){
  const bundled=build.chapterAssets[chapter].filter(path=>path.startsWith('./assets/audio/'));
  assert.deepEqual([...bundled].sort(),[...chapterAudioAssets(chapter)].sort(),'Chapter '+chapter+' audio set');
}
assert.ok(build.chapterAssets[2].includes('./assets/audio/ambience-rain.mp3'));
for(const n of [5,6,9])assert.ok(build.chapterAssets[n].includes('./assets/audio/ambience-dry.mp3'));
assert.ok(!build.chapterAssets[1].includes('./assets/audio/music-council.mp3'));
console.log('PASS complete audio provenance, deferred installation and chapter-specific soundscape groups');
const base='https://imperium.test/',handlers={},stores=new Map(),messages=[];
const normalize=p=>new URL(typeof p==='string'?p:p.url,base).href;
const cacheName='imperium-'+build.revision;
let failing=null,offline=false;
const fetcher=async p=>{const url=normalize(p);if(offline||url===failing)throw Error('network unavailable');return new Response('current:'+url,{status:200});};
function cache(name){
  if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);
  return {match:async p=>map.get(normalize(p))?.clone(),put:async(p,r)=>map.set(normalize(p),r.clone()),add:async p=>{const r=await fetcher(p);map.set(normalize(p),r)},addAll:async ps=>{for(const p of ps){const r=await fetcher(p);map.set(normalize(p),r)}},keys:async()=>[...map.keys()]};
}
const caches={open:async n=>cache(n),keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n)};
const client={postMessage:m=>messages.push(m)};
const self={registration:{scope:base},location:{origin:new URL(base).origin},clients:{matchAll:async()=>[client],claim:async()=>{}},addEventListener:(n,f)=>handlers[n]=f};
vm.runInNewContext(code,{self,caches,fetch:fetcher,URL,Request,Response,console});
async function event(name,data={}){let promise;handlers[name]({...data,waitUntil:p=>{promise=p},respondWith:p=>{promise=p}});return promise;}
await event('install');
assert.equal(stores.get(cacheName).size,build.initialFiles);
assert.ok(!stores.get(cacheName).has(normalize('./assets/portraits/hero-emperor.webp')));
assert.ok(build.showcaseAssets.includes('./showcase/index.html'));
assert.ok(build.showcaseAssets.includes('./vendor/three/three.module.js'));
assert.ok(build.showcaseAssets.includes('./vendor/three/three.core.js'));
assert.ok(build.showcaseAssets.includes('./vendor/three/LICENSE'));
for(const path of build.showcaseAssets){
  assert.ok(!build.initialAssets.includes(path),'3D study leaked into initial shell: '+path);
  assert.ok(!stores.get(cacheName).has(normalize(path)),'3D study downloaded at installation: '+path);
}
const standalone=path=>path.startsWith('./showcase/')||path==='./src/showcase/showcase.css';
const retiredCharacterAtlas='./assets/showcase/character-materials-v015.webp';
const retiredAssets=[retiredCharacterAtlas,'./assets/showcase/earth.webp','./assets/showcase/stone.webp','./assets/showcase/timber.webp'];
const activeAtlases=['./assets/showcase/character-materials-v016.webp','./assets/showcase/foliage-v016.webp','./assets/textures/complexion-male-v018.webp'];
// Historical artwork remains part of the complete package, but is not a
// dependency of a current actor or a cold chapter restore.
assert.ok(build.showcaseAssets.includes(retiredCharacterAtlas),'Complete 3D inventory retains the historical character atlas');
assert.ok(build.deferredAssets.includes(retiredCharacterAtlas),'Historical atlas stays in the complete deferred pack');
assert.deepEqual(await readFile('dist/'+retiredCharacterAtlas.slice(2)),await readFile(retiredCharacterAtlas.slice(2)),'Built historical atlas preserves its source bytes');
for(const path of activeAtlases)assert.ok(build.showcaseAssets.includes(path),'Active atlas omitted from the complete inventory: '+path);
const femaleAssets=['./assets/models/roman-woman-v018.glb','./assets/textures/complexion-female-v018.webp'];
for(const path of femaleAssets)assert.ok(build.showcaseAssets.includes(path)&&build.deferredAssets.includes(path),'Complete deferred inventory retains female resources: '+path);
const shared3D=build.showcaseAssets.filter(path=>!femaleAssets.includes(path)&&!standalone(path)&&!retiredAssets.includes(path));
for(const [chapter,paths]of Object.entries(build.chapterAssets))for(const path of shared3D)assert.ok(paths.includes(path),'Chapter '+chapter+' omitted shared 3D resource: '+path);
for(const [chapter,paths]of Object.entries(build.chapterAssets)){
  for(const path of femaleAssets)assert.equal(paths.includes(path),Number(chapter)>=8,'Female resources are requested only for Chapter VIII and later: '+path);
  assert.ok(!paths.includes(retiredCharacterAtlas),'Chapter '+chapter+' still downloads the superseded atlas');
  for(const path of activeAtlases)assert.ok(paths.includes(path),'Chapter '+chapter+' omitted active atlas: '+path);
}
for(const path of build.showcaseAssets.filter(standalone))assert.ok(!Object.values(build.chapterAssets).flat().includes(path),'Standalone study page entered campaign cache: '+path);
console.log('PASS active chapter atlases exclude superseded artwork while the complete inventory preserves its exact bytes');
await event('message',{data:'offline-status',source:client});
assert.equal(messages.at(-1).type,'offline-progress');
console.log('PASS shell-only install and truthful partial status');

failing=normalize('./src/showcase/stage.js');
await event('message',{data:{type:'cache-chapter',chapter:11},source:client});
assert.equal(messages.at(-1).ready,false,'A cold later chapter must not claim readiness with missing renderer code');
failing=null;await event('message',{data:{type:'cache-chapter',chapter:11},source:client});
assert.equal(messages.at(-1).ready,true);
for(const path of shared3D)assert.ok(stores.get(cacheName).has(normalize(path)),'Cold Senate restore omitted: '+path);
for(const path of femaleAssets)assert.ok(stores.get(cacheName).has(normalize(path)),'Cold Senate restore omitted female resource: '+path);
assert.ok(!stores.get(cacheName).has(normalize(retiredCharacterAtlas)),'Cold Senate restore must not fetch historical character artwork');
assert.ok(!stores.get(cacheName).has(normalize('./assets/scenes/danube.webp')),'Cold later restore must not require opening chapter art');
console.log('PASS cold Chapter XI restore retries missing shared renderer and caches its own complete resource group');

await event('message',{data:{type:'cache-chapter',chapter:1},source:client});
assert.equal(messages.at(-1).type,'chapter-offline');assert.equal(messages.at(-1).ready,true);
assert.ok(!stores.get(cacheName).has(normalize('./assets/portraits/hero-emperor.webp')));
assert.ok(!messages.some(m=>m.type==='offline-ready'));
console.log('PASS chapter 1 caches separately and never claims all chapters are offline');
for(const path of chapterAudioAssets(1))assert.ok(stores.get(cacheName).has(normalize(path)),'Opening chapter omitted audio: '+path);

for(const path of shared3D)assert.ok(stores.get(cacheName).has(normalize(path)),'Chapter I failed to cache 3D dependency: '+path);
assert.ok(!stores.get(cacheName).has(normalize(retiredCharacterAtlas)),'Chapter I must not fetch historical character artwork');
for(const path of build.showcaseAssets.filter(standalone))assert.ok(!stores.get(cacheName).has(normalize(path)),'Chapter I downloaded standalone study page: '+path);
offline=true;
for(const path of shared3D){const resource=await event('fetch',{request:{method:'GET',url:normalize(path),mode:'cors'}});assert.equal(await resource.text(),'current:'+normalize(path));}
offline=false;
const studyPage=await event('fetch',{request:{method:'GET',url:normalize('./showcase/index.html'),mode:'navigate'}});
assert.equal(await studyPage.text(),'current:'+normalize('./showcase/index.html'));
console.log('PASS chapter-cached shared 3D dependencies survive offline reads; standalone page stays deferred until requested');

await cache('sacramentum-old').put('./assets/portraits/hero-emperor.webp',new Response('OLD ART'));
const fresh=await event('fetch',{request:{method:'GET',url:normalize('./assets/portraits/hero-emperor.webp'),mode:'cors'}});
assert.ok((await fresh.text()).startsWith('current:'));
console.log('PASS version-scoped lookup ignores old artwork');

failing=normalize(build.deferredAssets.find(p=>p.startsWith('./assets/')&&!stores.get(cacheName).has(normalize(p))));
await event('message',{data:'cache-campaign',source:client});
assert.equal(messages.at(-1).type,'offline-progress');
assert.ok(messages.some(m=>m.type==='offline-error'));
assert.ok(!messages.some(m=>m.type==='offline-ready'));
console.log('PASS failed deferred fetch does not claim offline readiness');

failing=null;await event('message',{data:'cache-campaign',source:client});
assert.equal(messages.at(-1).type,'offline-ready');
assert.equal(messages.at(-1).completed,build.files);
console.log('PASS retry completes all deferred assets and reports readiness');

offline=true;
const response=await event('fetch',{request:{method:'GET',url:base,mode:'navigate'}});
assert.ok((await response.text()).includes('index.html'));
for(const path of build.showcaseAssets)assert.ok(stores.get(cacheName).has(normalize(path)),'Complete download omitted 3D dependency: '+path);
const historicalAtlas=await event('fetch',{request:{method:'GET',url:normalize(retiredCharacterAtlas),mode:'cors'}});
assert.equal(await historicalAtlas.text(),'current:'+normalize(retiredCharacterAtlas),'Explicit complete download retains server-unavailable access to the historical atlas');
for(const path of audioPaths){const audio=await event('fetch',{request:{method:'GET',url:normalize(path),mode:'cors'}});assert.equal(await audio.text(),'current:'+normalize(path),'Server-unavailable audio: '+path);}
const offlineStudy=await event('fetch',{request:{method:'GET',url:normalize('./showcase/'),mode:'navigate'}});
assert.equal(await offlineStudy.text(),'current:'+normalize('./showcase/index.html'));
console.log('PASS server-unavailable navigation uses current shell cache');

assert.ok(!code.includes('skipWaiting('));await event('activate');
assert.ok(!stores.has('sacramentum-old'));
await cache('imperium-old').put('./index.html',new Response('OLD IMPERIUM'));
await cache('unrelated-game').put('./index.html',new Response('UNRELATED'));
const currentCount=stores.get(cacheName).size;await event('activate');
assert.ok(!stores.has('imperium-old'));assert.equal(stores.get(cacheName).size,currentCount);
assert.equal(await(await cache('unrelated-game').match('./index.html')).text(),'UNRELATED');
console.log('PASS both-brand activation cleanup preserves the current edition and unrelated caches; no forced skipWaiting');
