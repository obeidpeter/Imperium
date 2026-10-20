import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {createActorAssetCatalog,ACTOR_MODEL_URL,FEMALE_ACTOR_MODEL_URL} from '../src/showcase/actor-assets.js';
import {createActor} from '../src/showcase/actors.js';
import {ACTOR_CASES,actorResources} from '../tests/actor-model-cases.js';
import {PERFORMANCE_CLIPS,PERFORMANCE_SOURCE_HASH} from '../src/showcase/actor-performance-data.js';
import {characterPerformanceMatches} from './build-character-performance.mjs';

const source=JSON.parse(await readFile(new URL('./character-sources/performance-v034.json',import.meta.url),'utf8'));
assert.ok(characterPerformanceMatches(source,await readFile(new URL('../src/showcase/actor-performance-data.js',import.meta.url),'utf8')),'Character performance export is stale');
const load=url=>async()=>{const b=await readFile(new URL('../'+url,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const library=createActorAssetCatalog({maleLoad:load(ACTOR_MODEL_URL),femaleLoad:load(FEMALE_ACTOR_MODEL_URL)});
const samples=[];
for(const item of ACTOR_CASES)for(const quality of ['performance','balanced']){
  const before=JSON.stringify(item),a=createActor(item.unit,{...item.options,quality,assetLibrary:library});await a.ready;
  a.update({motion:'idle',resetPose:true,detailDistance:2});const near=actorResources(a.group);
  a.update({motion:'idle',resetPose:true,detailDistance:40});const overview=actorResources(a.group);
  assert.ok(near.visibleTriangles<65_000,`${item.id}/${quality}: near triangle budget`);
  assert.ok(overview.visibleTriangles<20_000&&overview.visibleTriangles<near.visibleTriangles*.8,`${item.id}/${quality}: overview reduction`);
  assert.ok(near.visibleMeshes<=35&&overview.visibleMeshes<=12,`${item.id}/${quality}: visible surface budget`);
  assert.ok(near.geometryArrayBytes<16_000_000,`${item.id}/${quality}: retained geometry array budget`);
  for(const motion of ['walk','turn','attack','brace','rally','speak'])for(const phase of [0,.371,.7,1]){
    a.update({motion,phase,time:phase*2,resetPose:true,groundHeight:()=>0});
    a.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),`${item.id}/${motion}: finite world transform`));
  }
  assert.equal(JSON.stringify(item),before);
  samples.push({id:item.id,chapter:item.options.chapter,quality,near,overview});a.dispose();
}
const report={
  scope:'Node construction of real imported production actors. Geometry/resource estimates, not measured GPU memory, browser FPS or human visual approval.',
  productionMethod:'Original code-authored geometry and JSON joint performances over retained licensed MakeHuman anatomy.',
  performance:{sourceHash:PERFORMANCE_SOURCE_HASH,clips:Object.keys(PERFORMANCE_CLIPS),keyframes:Object.values(PERFORMANCE_CLIPS).reduce((n,c)=>n+c.frames.length,0),newBitmapAnimationFrames:0},
  specimenCount:ACTOR_CASES.length,sampleCount:samples.length,
  maxima:{nearTriangles:Math.max(...samples.map(s=>s.near.visibleTriangles)),overviewTriangles:Math.max(...samples.map(s=>s.overview.visibleTriangles)),nearVisibleMeshes:Math.max(...samples.map(s=>s.near.visibleMeshes)),overviewVisibleMeshes:Math.max(...samples.map(s=>s.overview.visibleMeshes)),retainedGeometryArrayBytes:Math.max(...samples.map(s=>s.near.geometryArrayBytes))},
  samples
};
const output=process.argv.indexOf('--output');
if(output>=0){if(!process.argv[output+1])throw new Error('Missing output path');await writeFile(process.argv[output+1],JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({samples:report.sampleCount,clips:report.performance.clips.length,keyframes:report.performance.keyframes,maxima:report.maxima},null,2));
