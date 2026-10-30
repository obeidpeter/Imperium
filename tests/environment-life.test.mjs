import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {LIFE_LAYOUT} from '../src/ui/world-layouts.js';
import {lifeSources} from '../src/showcase/environment-life.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {createEnvironment} from '../src/showcase/environment.js';

// Birds, hearth smoke and banners' cloth about the field (worlds and gameplay plan, release 9).
const campaign=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
const scene=id=>campaign.scenes.find(s=>s.id===id);

test('birds wheel high beyond the board by day, and hearths smoke where the layout has them',()=>{
  for(const s of campaign.scenes){
    const e=s.state.encounter,profile=getSceneProfile(e,{chapter:s.chapter}),corner=Math.hypot(e.width,e.height)*2.5/2;
    for(const quality of ['performance','balanced','high']){
      const life=lifeSources(e,profile,{quality}),again=lifeSources(e,profile,{quality});
      assert.deepEqual(life,again,`${s.id}: the same life on every visit`);
      if(quality==='performance'||profile.civic){assert.deepEqual(life,{birds:[],hearths:[]},`${s.id} ${quality}`);continue;}
      const day=profile.timeOfDay!=='night'&&!['rain','dust'].includes(profile.weather);
      assert.equal(life.birds.length,day?LIFE_LAYOUT.birds[quality]:0,`${s.id} ${quality}: birds by day only`);
      for(const b of life.birds){
        assert.ok(Math.hypot(b.x,b.z)-b.radius>corner+3,`${s.id}: a bird's circle passes over the board`);
        assert.ok(b.y+b.lift-1>=14,`${s.id}: birds fly high`);assert.ok(Math.abs(b.speed)>=.2&&Math.abs(b.speed)<=.4);
      }
      assert.ok(life.hearths.length<=LIFE_LAYOUT.maxHearths);
      for(const h of life.hearths){
        assert.ok(LIFE_LAYOUT.hearths[h.component],h.component);assert.equal(h.puffs,LIFE_LAYOUT.puffs[quality]);
        assert.ok(Math.abs(h.x)>e.width*1.25||Math.abs(h.z)>e.height*1.25,`${s.id}: a hearth on the board`);
      }
    }
  }
  // Chapter I's road passes the barracks and the forge; the rain over Chapter II's marsh keeps its birds down.
  const road=scene('ch1-road'),roadProfile=getSceneProfile(road.state.encounter,{chapter:1});
  assert.deepEqual(lifeSources(road.state.encounter,roadProfile).hearths.map(h=>h.component).sort(),['barrack_gable','forge_shelter']);
  const marsh=scene('ch2-marsh'),marshProfile=getSceneProfile(marsh.state.encounter,{chapter:2});
  assert.equal(marshProfile.weather,'rain');assert.equal(lifeSources(marsh.state.encounter,marshProfile).birds.length,0);
  assert.ok(lifeSources(marsh.state.encounter,marshProfile).hearths.length>0,'the fish smokers\' fire burns in the rain');
  // A night battle keeps its hearths and loses its birds.
  const night=getSceneProfile(road.state.encounter,{chapter:1,timeOfDay:'night'});
  assert.equal(night.timeOfDay,'night');assert.equal(lifeSources(road.state.encounter,night).birds.length,0);
});

test('the field\'s life is one instanced mesh that moves with the environment\'s clock, and is gone on Performance',()=>{
  const road=scene('ch1-road'),build=quality=>createEnvironment(new T.Scene(),road.state.encounter,{chapter:1,quality,loadTextures:false});
  const world=build('balanced'),meshes=[];world.group.traverse(o=>{if(o.name==='field life: birds and hearth smoke')meshes.push(o);});
  assert.equal(meshes.length,1);const [mesh]=meshes,life=world.group.userData.fieldLife;
  assert.equal(mesh.count,life.birds+life.hearths*LIFE_LAYOUT.puffs.balanced);assert.equal(life.quads,mesh.count);
  assert.equal(mesh.frustumCulled,false);assert.equal(mesh.castShadow,false);assert.equal(mesh.raycast(),undefined,'nothing takes picks');
  assert.ok(mesh.material.transparent&&!mesh.material.depthWrite);
  // Its time and wind follow the environment's update; a fixed time is a fixed picture.
  const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <color_fragment>'};mesh.material.onBeforeCompile(shader);const {uniforms}=shader;
  assert.match(shader.vertexShader,/lifeCentre/);assert.doesNotMatch(shader.vertexShader,/#include <project_vertex>/);
  world.update(12.5);assert.equal(uniforms.lifeTime.value,12.5);const wind=uniforms.lifeWind.value.clone();
  world.update(30);assert.equal(uniforms.lifeTime.value,30);assert.ok(!wind.equals(uniforms.lifeWind.value),'the smoke drifts with the changing wind');
  const disposed=[];mesh.geometry.addEventListener('dispose',()=>disposed.push('geometry'));mesh.material.addEventListener('dispose',()=>disposed.push('material'));
  world.dispose();assert.deepEqual(disposed.sort(),['geometry','material']);
  const performance=build('performance');let found=false;performance.group.traverse(o=>{if(o.name.startsWith('field life'))found=true;});
  assert.equal(found,false);assert.equal(performance.group.userData.fieldLife,undefined);performance.dispose();
});

test('every banner stirs in the wind at its own phase, and is still on Performance',()=>{
  const council=scene('ch7-council'),build=quality=>createEnvironment(new T.Scene(),council.state.encounter,{chapter:7,quality,loadTextures:false});
  const banners=world=>{const list=[];world.group.traverse(o=>{if(o.isMesh&&o.userData.windCloth)list.push(o);});return list;};
  const world=build('balanced'),list=banners(world);
  assert.ok(list.length>=2);assert.equal(world.group.userData.clothBanners,list.length);
  const pose=()=>list.map(o=>Array.from(o.geometry.attributes.position.array));
  world.update(1);const a=pose();world.update(2.5);const b=pose();
  for(const [i] of list.entries())assert.ok(a[i].some((v,k)=>Math.abs(v-b[i][k])>1e-4),`banner ${i} moves`);
  // Their tops are fixed to the crossbar; neighbours do not flutter in step.
  for(const o of list){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)>.89){const w=Math.abs(p.getX(i));assert.ok(w<=.66);}}
  assert.ok(a[0].some((v,k)=>Math.abs((v-b[0][k])-(a[1][k]-b[1][k]))>1e-4),'two banners stir differently');
  world.dispose();
  const still=build('performance'),stillList=banners(still),before=stillList.map(o=>Array.from(o.geometry.attributes.position.array));
  still.update(1);still.update(4);assert.deepEqual(stillList.map(o=>Array.from(o.geometry.attributes.position.array)),before);
  assert.equal(still.group.userData.clothBanners,undefined);still.dispose();
});
