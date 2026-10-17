import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.js';
import {createEnvironment,gridToWorld} from '../src/showcase/environment.js';
import {getSceneProfile,getCampaignSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {terrainAt} from '../src/showcase/environment-layout.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};

test('All legal campaign scene profiles expose stable lighting and distinct regional architecture without changing state',()=>{
  assert.equal(fixture.scenes.length,25);assert.equal(fixture.finalRank,'Augustus');assert.equal(getCampaignSceneProfile,getSceneProfile);
  const settings=new Set(),civic=new Set();
  for(const s of fixture.scenes){const e=freeze(s.state.encounter),before=JSON.stringify(e),profile=getSceneProfile(e,{chapter:s.chapter});assert.equal(profile.chapter,s.chapter);assert.equal(getSceneProfile(e).chapter,s.chapter);assert.equal(profile.civic,s.kind==='contest');assert.equal(profile.title,e.title);assert.ok(Object.isFrozen(profile));
    for(const key of ['sky','fog','sun','ambient','ambientGround'])assert.match(profile[key],/^#[0-9a-f]{6}$/i);
    for(const key of ['sunIntensity','ambientIntensity','fogDensity','exposure'])assert.ok(Number.isFinite(profile[key])&&profile[key]>0);
    settings.add(profile.setting);if(profile.civic)civic.add(profile.architecture);assert.equal(JSON.stringify(e),before);
  }
  assert.equal(settings.size,12);assert.equal(civic.size,5);assert.equal(getSceneProfile({id:'legacy',kind:'contest'},{chapter:11}).architecture,'senate');
});

test('Every legal battle and council builds finite bounded geometry, preserves its checkpoint and disposes resources',()=>{
  for(const s of fixture.scenes){const before=JSON.stringify(s.state),scene=new THREE.Scene(),world=createEnvironment(scene,s.state.encounter,{chapter:s.chapter,quality:'performance',loadTextures:false}),geometries=new Set();let triangles=0,disposed=0;
    world.group.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(o.isInstancedMesh)for(const n of o.instanceMatrix.array)assert.ok(Number.isFinite(n),s.id);if(o.material.vertexColors)assert.ok(o.geometry.attributes.color,s.id+' has its vertex colour input');});
    for(const g of geometries){for(const n of g.attributes.position.array)assert.ok(Number.isFinite(n),s.id);if(g.index)for(const index of g.index.array)assert.ok(index>=0&&index<g.attributes.position.count,s.id);g.addEventListener('dispose',()=>disposed++);}
    assert.ok(world.stats().meshes<150,s.id+' mesh budget');assert.ok(world.stats().instances<20000,s.id+' instance budget');assert.ok(triangles<650000,s.id+' triangle budget');
    if(s.chapter>1)assert.ok(world.group.userData.environmentLandmarks.length,s.id+' has architectural landmarks');
    world.update(0);world.update(.4);world.update(3);assert.equal(JSON.stringify(s.state),before,s.id+' presentation purity');world.dispose();world.dispose();assert.equal(disposed,geometries.size,s.id+' releases every used geometry');assert.equal(scene.children.length,0);
  }
});

test('Marshes use contiguous irregular water and asymmetric willows, while the legal causeways stay dry and clear',()=>{
  const s=fixture.scenes.find(s=>s.id==='ch2-marsh'),world=createEnvironment(new THREE.Scene(),s.state.encounter,{chapter:2,quality:'balanced',loadTextures:false}),flood=world.group.getObjectByName('continuous irregular marsh water');
  assert.ok(flood);assert.equal(world.group.getObjectByName('marsh pools'),undefined);assert.ok(world.group.getObjectByName('willow leaves'));assert.ok(world.group.getObjectByName('natural bark 0')?.isInstancedMesh,'Willows have solid, batched branching trunks');assert.ok(world.group.getObjectByName('marsh reed stems'));
  const color=flood.geometry.attributes.color,alphas=Array.from({length:color.count},(_,i)=>color.getW(i));assert.ok(alphas.some(a=>a===0));assert.ok(alphas.some(a=>a>.9));assert.ok(alphas.some(a=>a>.1&&a<.8));
  const e=s.state.encounter;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const type=terrainAt(e,x,y),p=gridToWorld({x,y},e);assert.ok(Math.abs(world.groundHeight(p.x,p.z)-(type==='marsh'?-.065:0))<1e-8);}
  assert.ok(world.profile.fogDensity<.022);world.dispose();
});

test('Authored rivers, fords, wall cover and civic floors remain distinct and legal standing centres stay free of architecture',()=>{
  for(const {id} of fixture.scenes){
    const s=fixture.scenes.find(s=>s.id===id),e=s.state.encounter,world=createEnvironment(new THREE.Scene(),e,{chapter:s.chapter,quality:'performance',loadTextures:false});world.group.updateMatrixWorld(true);
    const features=world.group.userData.terrainFeatures,solid=[];
    world.group.traverse(o=>{if(!o.isMesh||o===world.ground||o.material.transparent||o.material.side===THREE.DoubleSide||['continuous civic stone floor','authored boundary road'].includes(o.name))return;solid.push(o);});
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const type=terrainAt(e,x,y),p=gridToWorld({x,y},e),h=world.groundHeight(p.x,p.z);
      if(type==='river'){assert.ok(h<-.8);assert.ok(features.some(f=>f.type==='river'&&f.x===x&&f.y===y));continue;}
      if(type==='rock')continue;if(type==='ford')assert.ok(features.some(f=>f.type==='ford'&&f.x===x&&f.y===y));if(type==='wall')assert.ok(features.some(f=>f.type==='wall'&&f.x===x&&f.y===y));
      const ray=new THREE.Raycaster(new THREE.Vector3(p.x,h+2.2,p.z),new THREE.Vector3(0,-1,0),0,1.5),hits=ray.intersectObjects(solid,false);assert.equal(hits.length,0,`${id} ${x},${y}: no new solid architecture through a legal standing centre (${hits[0]?.object.name})`);
    }
    if(e.kind==='contest'){assert.ok(world.group.getObjectByName('continuous civic stone floor'));assert.equal(world.group.getObjectByName('meadow grass'),undefined);}world.dispose();
  }
});

test('Roman audience rooms have a real enclosing perimeter with an open tactical roof and region-specific depth',()=>{
  for(const id of ['ch10-tribunal','ch11-accounts','ch11-adlection','ch12-legitimacy']){
    const s=fixture.scenes.find(s=>s.id===id),world=createEnvironment(new THREE.Scene(),s.state.encounter,{chapter:s.chapter,quality:'balanced',loadTextures:false});
    const envelope=world.group.userData.interiorEnvelope;assert.ok(envelope);assert.ok(envelope.wallX>s.state.encounter.width*2.5/2+4);assert.ok(envelope.backZ<-(s.state.encounter.height*2.5/2+3));assert.ok(envelope.wallHeight>8);assert.equal(envelope.openRoof,true);
    assert.ok(world.group.userData.environmentLandmarks.includes('enclosed Roman audience hall'));
    assert.ok(world.stats().meshes<30,'Layered enclosure stays under thirty environment draw objects');
    world.group.updateMatrixWorld(true);
    for(const [x,z]of [[envelope.wallX,0],[-envelope.wallX,0],[0,envelope.backZ]]){
      const ray=new THREE.Raycaster(new THREE.Vector3(x,2,z+1),new THREE.Vector3(0,0,-1),0,2); // back wall only; side-wall proof uses transverse ray below
      if(x===0)assert.ok(ray.intersectObject(world.group,true).length,'Back wall is actual depth-bearing geometry');
      else {ray.set(new THREE.Vector3(x-Math.sign(x),2,z),new THREE.Vector3(Math.sign(x),0,0));assert.ok(ray.intersectObject(world.group,true).length,'Both side walls are solid enclosure');}
    }
    world.dispose();
  }
  for(const [id,landmark]of [['ch2-marsh','continuous muddy wetland banks'],['ch9-wing','connected Palmyrene urban edge']]){
    const s=fixture.scenes.find(s=>s.id===id),world=createEnvironment(new THREE.Scene(),s.state.encounter,{chapter:s.chapter,quality:'balanced',loadTextures:false});assert.ok(world.group.userData.environmentLandmarks.includes(landmark));assert.ok(world.stats().meshes<35);world.dispose();
  }
});
