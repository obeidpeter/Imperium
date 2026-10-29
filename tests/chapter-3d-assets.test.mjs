import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {chapterAssets,chapterAudioAssets,chapterFlatAssets,chapterOfflineAssets,isFlatArt,viewDecodes} from '../src/ui/art.js';
import {tacticalAssets} from '../src/ui/unit-sprites.js';
import {chapterBodies,actorBodyUrl,chapterHorses,horseBodyUrl} from '../src/ui/actor-body-catalog.js';
import {chapterWorldFiles} from '../src/ui/world-catalog.js';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
async function paths(folder){
  const result=[];for(const entry of await readdir(new URL(folder,root),{withFileTypes:true})){const path=folder+entry.name;result.push(...entry.isDirectory()?await paths(path+'/'):['./'+path]);}return result;
}
const files=(await Promise.all(['src/showcase/','assets/showcase/','assets/models/','assets/textures/','vendor/three/','showcase/'].map(paths))).flat();
const femaleAssets=['./assets/models/roman-woman-v018.glb','./assets/textures/complexion-female-v018.webp'];

test('Every chapter can be restored cold with actual renderer, sound, vendor and materials; image decoding stays image-only',async()=>{
  const stage=await readFile(new URL('src/showcase/stage.js',root),'utf8');
  for(let chapter=1;chapter<=12;chapter++){
    const group=chapterOfflineAssets(chapter,files);
    for(const required of ['./assets/models/roman-human-v017.glb','./assets/models/short-hair-v018.bin','./assets/textures/short-hair-v018.webp','./vendor/three/addons/loaders/GLTFLoader.js','./src/showcase/stage.js','./src/showcase/battle-sound.js','./vendor/three/three.module.js','./vendor/three/three.core.js','./vendor/three/LICENSE','./assets/showcase/earth-v017.webp','./assets/showcase/stone-v017.webp','./assets/showcase/timber-v017.webp'])assert.ok(group.includes(required),`Chapter ${chapter}: ${required}`);
    assert.ok(!group.includes('./showcase/index.html'));assert.ok(!group.includes('./src/showcase/showcase.css'));
    assert.ok(chapterAssets(chapter).every(path=>/\.(webp|png|jpe?g)$/.test(path)),'An image decoder must never receive a JS/CSS dependency');
    for(const match of stage.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g))assert.ok(group.includes('./src/showcase/'+match[1].slice(2)),`Chapter ${chapter}: stage dependency omitted: ${match[1]}`);
  }
});

// Props and modular kits follow the world catalog regardless of asset folder;
// generated character bodies belong to the chapters whose figures wear them.
const ownModels=chapter=>files.filter(path=>chapterWorldFiles(chapter).some(file=>path==='./'+file)||chapterBodies(chapter).some(id=>path==='./'+actorBodyUrl(id))||chapterHorses(chapter).some(id=>path==='./'+horseBodyUrl(id)));

test('Shared dependencies use identical deduplicated URLs across chapters without losing any chapter-specific art',()=>{
  const first=chapterOfflineAssets(1,files).filter(path=>!chapterAssets(1).includes(path)&&!chapterAudioAssets(1).includes(path)&&!ownModels(1).includes(path));
  for(let chapter=1;chapter<=12;chapter++){
    const art=chapterAssets(chapter),models=ownModels(chapter),group=chapterOfflineAssets(chapter,[...files,...files]);
    assert.equal(new Set(group).size,group.length);
    assert.deepEqual(group.filter(path=>!femaleAssets.includes(path)&&!art.includes(path)&&!chapterAudioAssets(chapter).includes(path)&&!models.includes(path)),first);
    for(const path of [...art.filter(path=>!isFlatArt(path)),...models])assert.ok(group.includes(path),`Chapter ${chapter} artwork lost: ${path}`);
  }
});

// A 3D player's pack leaves out the 2D art; the 2D view and painted figures add it.
test('Each chapter’s 2D art is outside its 3D pack and in its 2D extras, which hold nothing else',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const pack=chapterOfflineAssets(chapter,files),flat=chapterFlatAssets(chapter);
    assert.ok(flat.length&&flat.every(isFlatArt),`Chapter ${chapter}: its 2D extras are 2D art`);
    assert.ok(!pack.some(isFlatArt),`Chapter ${chapter}: the 3D pack carries no 2D art`);
    for(const path of chapterAssets(chapter))assert.ok(pack.includes(path)!==flat.includes(path),`Chapter ${chapter}: ${path} is in exactly one of the two`);
    for(const path of tacticalAssets({id:`ch${chapter}-test`,kind:'battle',units:[]}))assert.ok(isFlatArt(path),`The 2D board’s ${path} is 2D art`);
  }
});

test('A view decodes only the 2D art it draws: the board all of it, painted figures their atlases and sheets, sculpted none',()=>{
  const atlas='./assets/tactical/units-frontier.webp',sheet='./assets/animation/roman-actions.webp',ground='./assets/world/ground-materials.webp',props='./assets/tactical/environment-props.webp',scene='./assets/scenes/danube.webp';
  assert.equal(viewDecodes(scene),true,'The 3D view still decodes the chapter’s paintings');
  for(const path of [atlas,sheet,ground,props])assert.equal(viewDecodes(path),false,`Sculpted figures never draw ${path}`);
  assert.deepEqual([atlas,sheet,ground,props].map(path=>viewDecodes(path,{painted:true})),[true,true,false,false]);
  for(const path of [atlas,sheet,ground,props,scene])assert.equal(viewDecodes(path,{flat:true}),true);
});

test('Female anatomy and complexion are deferred through Chapter VII; male complexion is available for every cold restore',()=>{
  for(const female of femaleAssets){assert.ok(files.includes(female));for(let chapter=1;chapter<=12;chapter++)assert.equal(chapterOfflineAssets(chapter,files).includes(female),chapter>=8,`Chapter ${chapter}: ${female}`);}
  for(let chapter=1;chapter<=12;chapter++)assert.ok(chapterOfflineAssets(chapter,files).includes('./assets/textures/complexion-male-v018.webp'));
});

test('Cold chapters contain current character and foliage atlases while the superseded atlas remains in the full file inventory',()=>{
  const retired='./assets/showcase/character-materials-v015.webp';assert.ok(files.includes(retired),'The historical file is retained for the complete download');
  for(let chapter=1;chapter<=12;chapter++){
    const group=chapterOfflineAssets(chapter,files);assert.ok(!group.includes(retired),`Chapter ${chapter} must not download the unused atlas`);
    for(const current of ['./assets/showcase/character-materials-v016.webp','./assets/showcase/foliage-v016.webp'])assert.ok(group.includes(current),`Chapter ${chapter} needs ${current}`);
  }
});

test('A cold restored Senate chapter retries missing 3D code, works offline and reuses it for the next chapter',async()=>{
  const template=await readFile(new URL('scripts/service-worker.template.js',root),'utf8'),base='https://imperium.test/game/',initial=['./index.html','./src/ui/app.js'];
  const groups=Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,chapterOfflineAssets(i+1,files)])),all=[...new Set([...initial,...files,...Object.values(groups).flat()])];
  const handlers={},stores=new Map(),messages=[],fetches=[],normal=p=>new URL(typeof p==='string'?p:p.url,base).href;
  let failed=normal('./src/showcase/stage.js'),offline=false;
  const cache=name=>{if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);return {match:async p=>m.get(normal(p))?.clone(),put:async(p,r)=>m.set(normal(p),r.clone()),keys:async()=>[...m.keys()]};};
  const fetcher=async p=>{const url=normal(p);fetches.push(url);if(offline||url===failed)throw Error('offline');return new Response('current:'+url);};
  const client={postMessage:m=>messages.push(m)},self={registration:{scope:base},location:{origin:new URL(base).origin},clients:{matchAll:async()=>[client],claim:async()=>{}},addEventListener:(k,v)=>handlers[k]=v};
  const code=template.replaceAll('__REVISION__','campaign-3d').replace('__ALL_FILES__',JSON.stringify(all)).replace('__INITIAL_FILES__',JSON.stringify(initial)).replace('__CHAPTER_FILES__',JSON.stringify(groups)).replace('__CHAPTER_FLAT_FILES__',JSON.stringify(Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,chapterFlatAssets(i+1)]))));
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
  const retired='./assets/showcase/character-materials-v015.webp';assert.ok(!fetches.includes(normal(retired)),'Chapter installation never requests the retired atlas');
  assert.ok(!messages.some(m=>m.type==='offline-ready'),'Two restored chapters are not the complete campaign');
  offline=true;
  for(const path of groups[11]){const response=await fire('fetch',{request:{method:'GET',url:normal(path),mode:'cors'}});assert.equal(await response.text(),'current:'+normal(path));}
  offline=false;await fire('message',{data:'cache-campaign',source:client});assert.ok(messages.some(m=>m.type==='offline-ready'),'Explicit complete download still includes historical files');
  assert.ok(fetches.includes(normal(retired)));offline=true;const historical=await fire('fetch',{request:{method:'GET',url:normal(retired),mode:'cors'}});assert.equal(await historical.text(),'current:'+normal(retired));
});
