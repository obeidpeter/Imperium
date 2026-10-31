import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import * as G from '../src/core/game.js';
import {createCampGroundSampler,campServiceForProp} from '../src/showcase/camp-composition.js';
import {regionalPropPlacements,getRegionalKitPlacements,regionalPlacementBounds} from '../src/showcase/environment-regional-world.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {sampleCampActivity} from '../src/showcase/camp-activity.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const camp=chapter=>{const w=G.createCampWorld(G.deserialize(JSON.stringify(fixture.scenes.find(s=>s.id===`camp-${chapter}`).state)));return {...w.map,campPresentation:w.campPresentation};};
const overlap=(a,b)=>a.maxX>b.minX&&a.minX<b.maxX&&a.maxZ>b.minZ&&a.minZ<b.maxZ;

test('service wear reaches all seven real camp places without crossing blocked cells or changing the map',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const e=camp(chapter),before=JSON.stringify(e),props=regionalPropPlacements(e),ground=createCampGroundSampler(e,{props});
    assert.equal(ground.routes.length,7,`Chapter ${chapter}: all service areas have a route`);
    for(const r of ground.routes)for(const point of r.points){
      const x=Math.floor((point.x+e.width*1.25)/2.5),y=Math.floor((point.z+e.height*1.25)/2.5);
      assert.ok(!['river','rock','wall','rubble'].includes(e.terrain[y][x]),`${chapter}:${r.id} path avoids ${e.terrain[y][x]}`);
    }
    for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(['rock','river','wall'].includes(e.terrain[y][x]))assert.equal(ground.sample((x+.5)*2.5-e.width*1.25,(y+.5)*2.5-e.height*1.25),0);
    assert.deepEqual(createCampGroundSampler(e,{props}).routes,ground.routes);assert.equal(JSON.stringify(e),before);
  }
});

test('camp props form service groups with clear aisles and no overlap with architecture or other props',()=>{
  let grouped=0;
  for(let chapter=1;chapter<=12;chapter++){
    if(chapter===5)continue;
    const e=camp(chapter),props=regionalPropPlacements(e),occupied=getRegionalKitPlacements(e).map(regionalPlacementBounds),before=JSON.stringify(e);
    for(const p of props.filter(p=>p.court)){
      grouped++;assert.equal(p.court.service,campServiceForProp(p.id));
      const mouth=p.court.approach,south=mouth.z===e.height*1.25;
      for(const offset of [-.8,0,.8]){
        const x=Math.floor(((south?mouth.x+offset:mouth.x-Math.sign(mouth.x)*.1)+e.width*1.25)/2.5),y=Math.floor(((south?mouth.z-.1:mouth.z+offset)+e.height*1.25)/2.5);
        assert.ok(!['rock','wall','river','rubble'].includes(e.terrain[y][x]),`${chapter}:${p.id} apron meets an open boundary across its width`);
      }
      const box={minX:p.x-2.4,maxX:p.x+2.4,minZ:p.z-2.4,maxZ:p.z+2.4};
      assert.ok(box.maxX < -e.width*1.25||box.minX > e.width*1.25||box.maxZ < -e.height*1.25||box.minZ > e.height*1.25);
      assert.ok(occupied.every(b=>!overlap(box,b)),`${chapter}:${p.id} complete footprint is clear`);
      occupied.push(box);
    }
    assert.deepEqual(regionalPropPlacements(e),props);assert.equal(JSON.stringify(e),before);
  }
  assert.ok(grouped>=35,`${grouped} props receive service courts`);
  assert.equal(campServiceForProp('casualty-litter'),'valetudinarium');assert.equal(campServiceForProp('life-bread-oven'),'canabae');
});

test('shade solids remain inside validated pockets and reuse the environment disposal lifecycle',()=>{
  for(const chapter of [1,5,8,12]){
    const e=camp(chapter),before=JSON.stringify(e),scene=new T.Scene(),world=createEnvironment(scene,e,{chapter,quality:'performance',loadTextures:false});
    const shades=world.group.userData.campWorkyards.shades;assert.equal(shades.length,2);
    for(const s of shades){const p=e.campPresentation.sceneryPads.find(p=>p.id===s.id);assert.ok(s.x-s.width/2>p.x-p.width/2&&s.x+s.width/2<p.x+p.width/2);assert.ok(s.z-s.depth/2>p.z-p.depth/2&&s.z+s.depth/2<p.z+p.depth/2);}
    const geometries=new Set();world.group.traverse(o=>{if(o.isMesh)geometries.add(o.geometry);});let disposed=0;for(const g of geometries)g.addEventListener('dispose',()=>disposed++);
    world.update(90);assert.equal(JSON.stringify(e),before);world.dispose();assert.equal(disposed,geometries.size);assert.equal(scene.children.length,0);
  }
});

test('service workers have distinct bounded work/rest beats and attend a nearby player',()=>{
  const actors=[{id:'hero',x:100,z:100,alive:true},{id:'porter',x:0,z:0,alive:true},{id:'trader',x:5,z:0,alive:true}];
  const world={kind:'camp',heroId:'hero',actors,campPresentation:{ambient:actors.slice(1).map(a=>({id:a.id,routine:'carry'}))}},before=JSON.stringify(world);
  const phases=actors.slice(1).map(a=>Array.from({length:60},(_,time)=>sampleCampActivity(world,a,{time}).phase));
  assert.notDeepEqual(phases[0],phases[1]);assert.ok(phases.flat().every(p=>p>=0&&p<=1));assert.ok(phases.every(list=>list.filter(p=>p===0).length>=12));
  assert.equal(JSON.stringify(world),before);actors[0].x=0;actors[0].z=1;assert.equal(sampleCampActivity(world,actors[1],{time:4}),null);
});
