import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {createEnvironmentMaterials} from '../src/showcase/environment-materials.js';
import {createPropFactory} from '../src/showcase/environment-props.js';
import {addInhabitedEnvironment} from '../src/showcase/environment-inhabited.js';
import {createGroundHeight} from '../src/showcase/environment-layout.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
test('All 25 lived-in compositions preserve campaign data and keep their complete solid bounds outside legal ground',()=>{
  const names=new Set();
  for(const s of fixture.scenes){
    const e=s.state.encounter,before=JSON.stringify(s.state),profile=getSceneProfile(e,{chapter:s.chapter}),root=new T.Group(),geometries=new Set(),library=createEnvironmentMaterials({loadTextures:false,profile});root.userData.environmentLandmarks=[];
    const p=createPropFactory(library.materials,geometries,{quality:'performance'}),height=createGroundHeight(e,2.5,{profile});
    const samples=e.units.map(u=>height((u.x-3.5)*2.5,(u.y-3.5)*2.5));
    addInhabitedEnvironment({root,e,p,m:library.materials,profile,height,tileSize:2.5,quality:'performance'});
    assert.ok(root.userData.inhabitedSetpieces.length>=2,s.id);
    for(const b of root.userData.inhabitedSetpieces){names.add(b.name);assert.ok([...b.min,...b.max].every(Number.isFinite),s.id);assert.ok(b.min[0]>=10||b.max[0]<=-10||b.min[2]>=10||b.max[2]<=-10,s.id+' '+b.name+' wholly outside tactical rectangle');}
    root.traverse(o=>{if(o.isMesh)for(const a of Object.values(o.geometry.attributes))for(const n of a.array)assert.ok(Number.isFinite(n),s.id+' finite mesh');});
    assert.deepEqual(e.units.map(u=>height((u.x-3.5)*2.5,(u.y-3.5)*2.5)),samples);assert.equal(JSON.stringify(s.state),before);
    for(const g of geometries)g.dispose();library.dispose();
  }
  assert.ok(names.size>=15,'regional functional spaces are not one repeated tent');
});
