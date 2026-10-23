import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {getEncounterStaging,stagingEdge,createStagingRouteSampler} from '../src/showcase/environment-staging.js';
import {addEncounterPrecinct} from '../src/showcase/environment-precincts.js';
import {createEnvironmentMaterials} from '../src/showcase/environment-materials.js';
import {createPropFactory} from '../src/showcase/environment-props.js';
import {createGroundHeight,terrainAt} from '../src/showcase/environment-layout.js';
import {createEnvironment} from '../src/showcase/environment.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};

test('All 25 encounters have distinct immutable compositions and bounded overview recommendations',()=>{
  const keys=new Set(),forms=new Set();
  for(const s of fixture.scenes){const e=freeze(s.state.encounter),before=JSON.stringify(e),profile=getSceneProfile(e,{chapter:s.chapter}),a=profile.staging;keys.add(a.key);forms.add(a.form);
    assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.camera));assert.ok(a.title.length>15);assert.match(a.axis,/^(west|south)-(north|east|south)$/);assert.ok(Math.abs(a.camera.yaw)<=Math.PI);if(!profile.civic&&!profile.training&&a.landmarkEdge==='east')assert.ok(a.camera.yaw<0,'The camera looks toward the eastern destination');assert.ok(a.camera.pitch>=.6&&a.camera.pitch<=.75);assert.deepEqual(getEncounterStaging(e,{chapter:s.chapter,civic:e.kind==='contest',training:profile.training}),a);assert.equal(JSON.stringify(e),before);
  }assert.equal(keys.size,25);assert.ok(forms.size>=20);assert.equal(getSceneProfile({id:'ch1-drill'}).staging.key,'recruit-parade');assert.equal(getSceneProfile({id:'unknown',kind:'contest'},{chapter:11}).staging.form,'council');
});

test('Arrival routes use an actual boundary road and never mark the legal ground as decorative traffic',()=>{
  for(const s of fixture.scenes){const e=s.state.encounter,staging=getSceneProfile(e,{chapter:s.chapter}).staging,sample=createStagingRouteSampler(e,staging);
    for(let z=-10;z<=10;z+=.5)for(let x=-10;x<=10;x+=.5)assert.equal(sample(x,z),0,s.id+' preserves authored board');
    for(const edge of [staging.entranceEdge,staging.landmarkEdge]){const a=stagingEdge(e,edge),side=edge==='west'||edge==='east',boundary=[];
      for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(terrainAt(e,x,y)==='road'&&((edge==='west'&&x===0)||(edge==='east'&&x===e.width-1)||(edge==='north'&&y===0)||(edge==='south'&&y===e.height-1)))boundary.push(((side?y:x)-3.5)*2.5);
      if(boundary.length)assert.ok(boundary.includes(side?a.z:a.x),s.id+' no invented median road');
      const b=stagingEdge(e,edge,2.5,5);assert.ok(sample(b.x,b.z)>.95);assert.equal(sample(b.x*5,b.z*5),0);
    }
  }
});

test('Every new precinct leaves the complete playable rectangle and routes clear, including between tile centres',()=>{
  for(const s of fixture.scenes){const e=s.state.encounter,before=JSON.stringify(e),profile=getSceneProfile(e,{chapter:s.chapter}),root=new THREE.Group(),geometries=new Set(),library=createEnvironmentMaterials({loadTextures:false,profile}),p=createPropFactory(library.materials,geometries,{quality:'performance'});root.userData.environmentLandmarks=[];
    addEncounterPrecinct({root,e,p,m:library.materials,profile,height:createGroundHeight(e,2.5,{profile}),tileSize:2.5,quality:'performance'});root.updateMatrixWorld(true);
    const solids=[];root.traverse(o=>{if(o.isMesh&&o.name!=='connected precinct apron')solids.push(o);});
    // The entire play rectangle, not only occupied cells, remains free from
    // newly-authored structure. Roof/arch faces are included in this check.
    for(let z=-9.9;z<=9.9;z+=1.1)for(let x=-9.9;x<=9.9;x+=1.1){const ray=new THREE.Raycaster(new THREE.Vector3(x,16,z),new THREE.Vector3(0,-1,0),0,16);assert.equal(ray.intersectObjects(solids,false).length,0,s.id+` structure above ${x},${z}`);}
    root.traverse(o=>{if(!o.isMesh)return;for(const a of Object.values(o.geometry.attributes))for(const n of a.array)assert.ok(Number.isFinite(n),s.id);});
    const apron=root.getObjectByName('connected precinct apron');if(apron){const a=apron.geometry.attributes.position,n=apron.geometry.attributes.normal;for(let i=0;i<a.count;i++){assert.ok(Math.abs(a.getX(i))>10||Math.abs(a.getZ(i))>10,'Paving never covers the authored board');assert.ok(n.getY(i)>.75,'Paving top faces remain visible');}}
    assert.equal(JSON.stringify(e),before);for(const g of geometries)g.dispose();library.dispose();
  }
});

test('Staged landmarks stay batched and disposable in all three quality tiers',()=>{
  for(const id of ['ch2-marsh','ch9-city','ch11-adlection'])for(const quality of ['performance','balanced','high']){
    const s=fixture.scenes.find(s=>s.id===id),scene=new THREE.Scene(),before=JSON.stringify(s.state),world=createEnvironment(scene,s.state.encounter,{quality,loadTextures:false,chapter:s.chapter});
    assert.equal(world.group.userData.encounterStaging.key,world.profile.staging.key);assert.ok(world.group.userData.environmentLandmarks.includes(world.profile.staging.title));assert.ok(world.group.userData.precinctStructures.length>0);assert.ok(world.stats().meshes<42,id+' inhabited architecture remains a bounded set of material batches');
    let disposed=0;const geometries=new Set();world.group.traverse(o=>{if(o.isMesh)geometries.add(o.geometry);});for(const g of geometries)g.addEventListener('dispose',()=>disposed++);
    world.update(0);world.update(10);assert.equal(JSON.stringify(s.state),before);world.dispose();world.dispose();assert.equal(disposed,geometries.size);assert.equal(scene.children.length,0);
  }
});
