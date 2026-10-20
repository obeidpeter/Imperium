import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {createBattlefieldFeatures} from '../src/showcase/battlefield-features.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {createEnvironmentMaterials} from '../src/showcase/environment-materials.js';
import {createPropFactory} from '../src/showcase/environment-props.js';
import {groundArchitecturalFoundations} from '../src/showcase/environment-foundations.js';
const fixtures=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
const field=(objects,chapter=5)=>({id:`ch${chapter}-fieldwork`,kind:'battle',featureEdition:31,width:10,height:8,field:{objects}});
const feature=(kind,state)=>({id:kind,kind,state,x:4,y:3});
const meshes=group=>{const result=[];group.traverse(o=>{if(o.isMesh)result.push(o);});return result;};

test('V034 gates physically clear the travelling lane when opened, while keeping posts and lintel',()=>{
  const scene=new T.Scene(),view=createBattlefieldFeatures(scene),e=field([feature('gate','closed')]),before=JSON.stringify(e);
  view.sync(e);scene.updateMatrixWorld(true);
  const ray=new T.Raycaster(new T.Vector3(-3,1,-1.25),new T.Vector3(1,0,0),0,5);
  assert.ok(ray.intersectObjects(meshes(view.group),false).length>0,'Closed crossbar and leaves block the lane');
  assert.equal(JSON.stringify(e),before);
  e.field.objects[0].state='open';view.sync(e);scene.updateMatrixWorld(true);
  assert.equal(ray.intersectObjects(meshes(view.group),false).length,0,'Open leaves really swing to the sides');
  assert.ok(view.group.userData.fieldObjects[0].max[1]>2,'Lintel remains above the opening');
  view.dispose();
});

test('V034 repaired bridge footing follows unequal banks and agrees with rendered plank tops',()=>{
  const ground=(x,z)=>x*.12,scene=new T.Scene(),view=createBattlefieldFeatures(scene,{heightAt:ground}),e=field([feature('bridge','damaged')]);
  view.sync(e);assert.equal(view.surfaceHeight(-1.25,-1.25),null,'A damaged crossing never supplies a walking surface');
  e.field.objects[0].state='repaired';view.sync(e);scene.updateMatrixWorld(true);
  for(const offset of [-.8775,-.0975,.4875,1.0725]){
    const x=-1.25+offset,z=-1.25,h=view.surfaceHeight(x,z),ray=new T.Raycaster(new T.Vector3(x,3,z),new T.Vector3(0,-1,0),0,6),hits=ray.intersectObjects(meshes(view.group),false);
    assert.ok(hits.length>0);assert.ok(Math.abs(hits[0].point.y-h)<.012,`Actor surface and visible planks agree at ${offset}`);
  }
  assert.equal(view.surfaceHeight(-1.25,-.4),null,'Rope rail or adjacent tile cannot act as a platform');
  assert.equal(view.surfaceHeight(.3,-1.25),null,'Grounding is bounded to the crossing');
  view.dispose();
});

test('V034 detailed fieldwork remains within a fixed draw budget, with exact state and owned resource lifecycle',()=>{
  const kinds=['gate','bridge','barricade','stores','signal','brazier'],states=['closed','damaged','intact','available','available','burning'];
  for(const quality of ['performance','balanced','high']){
    const scene=new T.Scene(),view=createBattlefieldFeatures(scene,{quality}),e=field(kinds.map((kind,i)=>({...feature(kind,states[i]),x:i+1}))),before=JSON.stringify(e);
    view.sync(e);assert.equal(view.stats().objects,6);assert.ok(view.stats().drawBatches<=14);assert.ok(view.stats().triangles<22000);
    for(const o of meshes(view.group))for(const a of Object.values(o.geometry.attributes))for(const v of a.array)assert.ok(Number.isFinite(v));
    const old=meshes(view.group),tracked=new Set(old.flatMap(o=>[o.geometry,o.material]));let disposed=0;for(const r of tracked)r.addEventListener('dispose',()=>disposed++);
    view.update(7,false);view.update(99,true);view.sync(e);assert.deepEqual(meshes(view.group),old);assert.equal(JSON.stringify(e),before);
    e.field.objects[2].state='dismantled';e.field.objects[3].state='secured';e.field.objects[5].state='spent';view.sync(e);
    assert.equal(disposed,tracked.size,'Rebuild releases every previously rendered buffer and material');
    const barricade=view.group.userData.fieldObjects.find(o=>o.kind==='barricade');assert.ok(barricade.max[1]<.3,'Dismantled wood lies on the ground');
    view.dispose();view.dispose();assert.equal(scene.children.length,0);
  }
});

test('V034 regional palettes are distinct immutable production metadata across every chapter',()=>{
  const keys=new Set();
  for(let chapter=1;chapter<=12;chapter++){
    const e=field([feature('stores','available')],chapter),before=JSON.stringify(e),profile=getSceneProfile(e),view=createBattlefieldFeatures(new T.Scene());view.sync(e);
    assert.ok(Object.isFrozen(profile.artDirection));keys.add(profile.artDirection.key);
    assert.equal(view.stats().region,profile.artDirection.key);assert.equal(JSON.stringify(e),before);view.dispose();
  }assert.equal(keys.size,12);
});

test('V034 siege composition stays out of narrow and wide boards and within environment budgets',()=>{
  for(const id of ['ch5-mine','ch5-wall'])for(const quality of ['performance','balanced','high'])for(const width of [8,10]){
    const scene=fixtures.scenes.find(s=>s.id===id),e=structuredClone(scene.state.encounter);
    e.width=width;for(const row of e.terrain)while(row.length<width)row.push('grass');
    const before=JSON.stringify(e),world=createEnvironment(new T.Scene(),e,{quality,loadTextures:false});
    assert.ok(world.group.getObjectByName('fractured Euphrates curtain and mine works'));
    const bounds=world.group.userData.precinctStructures.find(s=>s.name==='Euphrates siege benchmark');
    assert.ok(bounds.min[0]>e.width*1.25||bounds.max[0]<-e.width*1.25||bounds.min[2]>e.height*1.25||bounds.max[2]<-e.height*1.25);
    assert.ok(world.stats().meshes<48);world.update(4);assert.equal(JSON.stringify(e),before);world.dispose();
  }
});

test('V034 masonry foundation skirts meet real slopes without changing the footprint or legal ground',()=>{
  const root=new T.Group(),geometries=new Set(),library=createEnvironmentMaterials({loadTextures:false}),m=library.materials,p=createPropFactory(m,geometries);
  const parent=p.group(root,16,1,0);p.plank(parent,0,.1,0,5,.2,4,m.stone);
  p.plank(root,0,.1,0,5,.2,4,m.stone); // An existing floor on the rule board must be ignored.
  const height=(x,z)=>.025*x+.05*z,record=groundArchitecturalFoundations({root,height,e:{width:10,height:8},tileSize:2.5,p,m});
  assert.equal(record.skirts,1);const skirt=root.getObjectByName('terrain-fitted masonry footing'),a=skirt.geometry.attributes.position;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i);assert.ok(x>=13.49&&x<=18.51&&z>=-2.01&&z<=2.01);
    assert.ok(y<=1.026);if(i%4<2)assert.ok(Math.abs(y-(height(x,z)-.06))<1e-6,'Bottom follows the sampled slope');
  }
  for(const g of geometries)g.dispose();library.dispose();
});
