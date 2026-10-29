import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';
import {CURIA_LAYOUT} from '../src/ui/world-layouts.js';
import {CURIA_KIT_COMPONENTS,CURIA_HALL} from '../src/showcase/curia-kit-components.js';
import {hasCuria,curiaPlacements,updateInteriorCutaway} from '../src/showcase/environment-curia.js';
import {sceneryPlacements,createSceneryModels} from '../src/showcase/scenery-models.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {createChamberWorld,MAGISTRATE} from '../src/core/realtime/chamber-world.js';

// The Curia of Chapters XI and XII (worlds and gameplay plan, release 9).
const root=new URL('../',import.meta.url);
const report=JSON.parse(await readFile(new URL('art-source/models/processed/roman-curia-kit.json',root),'utf8'));
const compression=JSON.parse(await readFile(new URL('art-source/models/reports/roman-curia-kit-compress.json',root),'utf8'));
const campaign=JSON.parse(await readFile(new URL('tests/fixtures/campaign-3d.json',root),'utf8'));
const contests=campaign.scenes.filter(s=>s.kind==='contest');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const HALF=10;// the 8 x 8 chamber board's half-width in metres
async function load(url){
  const bytes=await readFile(new URL(url,root)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}

test('the Curia kit ships its nine pieces, authored in place, within its budget',async()=>{
  const names=CURIA_LAYOUT.pieces.map(p=>p.component);
  assert.deepEqual(report.components.map(c=>c.name).sort(),[...names].sort());
  assert.deepEqual(Object.keys(CURIA_KIT_COMPONENTS).sort(),[...names].sort());
  assert.match(report.authorship,/Original Blender-authored geometry/);assert.match(report.licence,/no third-party source assets/);
  const bytes=await readFile(new URL(report.runtimePath,root)),info=await inspectModel(bytes);
  assert.deepEqual(budgetProblems(info,{bytes:1000000,triangles:25000,texture:512,materials:8,minHeight:20,maxHeight:22}),[]);
  assert.equal(info.triangles,report.output.triangles);assert.equal(compression.geometryUnchanged,true);
  assert.equal(sha(bytes),compression.after.sha256);assert.equal(bytes.length,compression.after.bytes);
  assert.ok(info.textures.every(t=>t.mimeType==='image/ktx2'&&t.width===512&&t.height===512));
  const scene=await load(report.runtimePath);scene.updateMatrixWorld(true);
  for(const name of names){
    const piece=scene.getObjectByName(name);assert.ok(piece,name);assert.equal(piece.parent,scene,`${name} is a directly addressable root`);
    assert.deepEqual(piece.position.toArray(),[0,0,0],`${name} stands at the hall's origin`);
    const b=new T.Box3().setFromObject(piece,true),declared=CURIA_KIT_COMPONENTS[name];
    b.min.toArray().forEach((v,i)=>assert.ok(Math.abs(v-declared.min[i])<.002,`${name} min ${i}: ${v} vs ${declared.min[i]}`));
    b.max.toArray().forEach((v,i)=>assert.ok(Math.abs(v-declared.max[i])<.002,`${name} max ${i}: ${v} vs ${declared.max[i]}`));
  }
  // The paving stands clear of the level terrain it would otherwise flicker through, while
  // the floor's foot stays at 0 (its frame reaches down) so placing it does not lower it.
  const floor=scene.getObjectByName('curia_floor'),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3();let upward=0;
  floor.traverse(o=>{
    if(!o.isMesh)return;const p=o.geometry.attributes.position,index=o.geometry.index;
    for(let t=0;t<(index?index.count:p.count);t+=3){
      const [i,j,k]=[0,1,2].map(q=>index?index.getX(t+q):t+q);a.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,k).applyMatrix4(o.matrixWorld);
      n.subVectors(c,b).cross(a.clone().sub(b)).normalize();
      if(n.y>.9){upward++;assert.ok(Math.min(a.y,b.y,c.y)>=.01,`an upward face of the floor lies ${Math.min(a.y,b.y,c.y).toFixed(3)} m above the ground`);}
    }
  });
  assert.ok(upward>0);assert.ok(Math.abs(new T.Box3().setFromObject(floor,true).min.y)<1e-6);
});

test('every piece but the floor stands outside the board, and the tribunal carries the presiding magistrate',()=>{
  for(const piece of CURIA_LAYOUT.pieces){
    const {min,max}=CURIA_KIT_COMPONENTS[piece.component];
    if(piece.floor)assert.ok(max[1]<=.03&&min[1]>=0,`${piece.component} lies flat`);
    else assert.ok(max[0]< -HALF||min[0]>HALF||max[2]< -HALF||min[2]>HALF,`${piece.component} stays off the board`);
    assert.ok(min[1]>=0,`${piece.component} stands on the ground`);
  }
  // The magistrate stands at the board's north edge at the tribunal's height (chamber-world.js).
  const e=structuredClone(contests.find(s=>s.id==='ch11-accounts').state.encounter);
  const world=createChamberWorld({chapter:11,encounter:e},{magistrate:true}),magistrate=world.actors.find(a=>a.id===MAGISTRATE);
  assert.equal(magistrate.stand,CURIA_HALL.tribunal);
  const tribunal=CURIA_KIT_COMPONENTS.curia_tribunal,standZ=magistrate.z-e.height*2.5/2;
  assert.ok(standZ-tribunal.max[2]<.4&&tribunal.max[2]< -HALF,'the tribunal stands just beyond the board, behind the magistrate');
  assert.ok(Math.abs(magistrate.x-e.width*2.5/2)<1e-9&&tribunal.min[0]<0&&tribunal.max[0]>0);
  // The senators' steps flank the board and the walls enclose the steps.
  assert.ok(CURIA_KIT_COMPONENTS.curia_steps_west.max[0]< -HALF&&CURIA_KIT_COMPONENTS.curia_steps_east.min[0]>HALF);
  assert.equal(CURIA_HALL.height,21);assert.ok(CURIA_HALL.inner.maxX>CURIA_KIT_COMPONENTS.curia_steps_east.max[0]-.001);
});

test('only the Senate Contests of Chapters XI and XII, on their own board, stand in the Curia',()=>{
  for(const s of contests){
    const e=s.state.encounter,inside=[11,12].includes(s.chapter);
    assert.equal(hasCuria(e,{chapter:s.chapter}),inside,s.id);
    assert.equal(curiaPlacements(e,{chapter:s.chapter}).length,inside?CURIA_LAYOUT.pieces.length:0,s.id);
    assert.equal(curiaPlacements({...e,width:24,height:24},{chapter:s.chapter}).length,0,`${s.id}: an expanded board keeps the code-built hall`);
    const placed=sceneryPlacements(e,{chapter:s.chapter});
    assert.equal(placed.some(p=>p.id===CURIA_LAYOUT.kit),inside,s.id);
    if(inside){
      // The first piece hides the code-built hall; walls cast no shadow and stand down by the camera.
      const pieces=placed.filter(p=>p.id===CURIA_LAYOUT.kit);
      assert.deepEqual(pieces[0].fallbackNames,[...CURIA_LAYOUT.replaces]);
      for(const p of pieces)assert.equal(!!p.cutaway,p.shadow===false,`${p.component}: a cutaway wall casts no shadow`);
      // Its props stand in their own places: none on the board, none in a wall.
      for(const p of placed.filter(p=>CURIA_LAYOUT.props[p.id]))assert.ok(Math.abs(p.x)>HALF||Math.abs(p.z)>HALF,p.id);
    }
  }
  assert.equal(hasCuria(campaign.scenes.find(s=>s.kind!=='contest'&&s.chapter===12).state.encounter,{chapter:12}),false);
});

test('a wall stands down only while the camera is beyond it, so none stands between the camera and the board',()=>{
  const group=new T.Group();
  for(const piece of CURIA_LAYOUT.pieces.filter(p=>p.cutaway)){const m=new T.Group();m.name=piece.component;m.userData.interiorCutaway=piece.cutaway;group.add(m);}
  const camera=new T.PerspectiveCamera(),down=()=>group.children.filter(m=>!m.visible).map(m=>m.name).sort();
  const at=(x,y,z)=>{camera.position.set(x,y,z);camera.updateMatrixWorld(true);return updateInteriorCutaway(group,camera);};
  // The chamber's own overview (yaw -0.28, pitch 0.76): only the entrance wall stands down.
  assert.equal(at(-6.6,21.5,22.9),1);assert.deepEqual(down(),['curia_facade']);
  at(-24,12,4);assert.deepEqual(down(),['curia_wall_west']);
  at(-24,12,26);assert.deepEqual(down(),['curia_facade','curia_wall_west']);
  assert.equal(at(1,3,2),0,'inside the hall every wall stands');
  at(2,8,-30);assert.deepEqual(down(),['curia_wall_north']);
  // Round every orbit the overview allows: a standing wall never separates the camera from a board corner.
  for(let yaw=0;yaw<Math.PI*2;yaw+=Math.PI/24)for(const pitch of [.105,.36,.76,1.05])for(const distance of [8,20,34,60,85]){
    const x=Math.sin(yaw)*Math.cos(pitch)*distance,y=Math.sin(pitch)*distance+.7,z=Math.cos(yaw)*Math.cos(pitch)*distance;at(x,y,z);
    for(const wall of group.children.filter(m=>m.visible)){
      const {normal:[nx,nz],face}=wall.userData.interiorCutaway;
      for(const [cx,cz]of [[-HALF,-HALF],[HALF,-HALF],[-HALF,HALF],[HALF,HALF]])
        assert.ok(!((nx*x+nz*z-face)*(nx*cx+nz*cz-face)<0),`${wall.name} would stand between a camera at ${[x,z].map(v=>v.toFixed(1))} and the board`);
    }
  }
});

test('the code-built hall and colonnades are whole stand-ins in Chapters XI and XII, and unchanged elsewhere',()=>{
  for(const s of contests.filter(s=>s.chapter>=10)){
    const world=createEnvironment(new T.Scene(),s.state.encounter,{chapter:s.chapter,quality:'balanced',loadTextures:false}),curia=s.chapter>=11;
    const hall=world.group.getObjectByName('enclosed Roman audience hall');assert.ok(hall,s.id);
    const meshes=[];hall.traverse(o=>{if(o.isMesh)meshes.push(o);});
    if(curia){
      assert.ok(meshes.length>0&&meshes.every(o=>o.userData.environmentDynamic),`${s.id}: the hall keeps its own geometry, so hiding it hides it whole`);
      const chamber=world.group.getObjectByName(s.chapter===11?'senate':'imperial court');let inside=0;chamber.traverse(o=>{if(o.isMesh)inside++;});
      assert.ok(inside>0,`${s.id}: the chamber's colonnades, arches, dais and banners stay in their group`);
    }else assert.ok(meshes.every(o=>!o.userData.environmentDynamic),`${s.id}: the tribunal's hall joins the scene's shared batches as before`);
    world.dispose();
  }
});

test('the loaded Curia hides the code-built hall, and disposing it brings the hall back',async()=>{
  const s=contests.find(s=>s.id==='ch12-legitimacy'),scene=new T.Scene(),world=createEnvironment(scene,s.state.encounter,{chapter:12,quality:'balanced',loadTextures:false});
  const cache=createSceneryModelCache({load}),models=createSceneryModels(scene,s.state.encounter,{chapter:12,cache});
  await models.ready;
  for(const name of ['enclosed Roman audience hall','imperial court'])assert.equal(scene.getObjectByName(name).visible,false,name);
  for(const piece of CURIA_LAYOUT.pieces){
    const model=models.group.getObjectByName(`curia:12:${piece.component}`);assert.ok(model,piece.component);
    model.traverse(o=>{if(o.isMesh){assert.equal(o.castShadow,piece.shadow!==false,piece.component);assert.equal(o.raycast(),undefined,'no piece takes picks');}});
    assert.ok(Math.abs(new T.Box3().setFromObject(model,true).min.y)<1e-6,`${piece.component} stands on the floor`);
  }
  const camera=new T.PerspectiveCamera();camera.position.set(-6.6,21.5,22.9);camera.updateMatrixWorld(true);
  assert.equal(models.updateCutaway(camera),1);assert.equal(models.group.getObjectByName('curia:12:curia_facade').visible,false);
  models.dispose();
  for(const name of ['enclosed Roman audience hall','imperial court'])assert.equal(scene.getObjectByName(name).visible,true,name);
  world.dispose();cache.clear();
});
