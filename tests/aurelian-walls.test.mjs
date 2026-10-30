import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';
import {AURELIAN_WALL_COMPONENTS,AURELIAN_WALL_MEASURES} from '../src/showcase/aurelian-walls-components.js';
import {aurelianWallPieces,aurelianWallsUrl} from '../src/showcase/aurelian-walls.js';
import {finaleLayout} from '../src/showcase/environment-finale.js';
import {hash} from '../src/showcase/environment-layout.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {sceneryPlacements,sceneryWorkingSet} from '../src/showcase/scenery-models.js';
import {clearOfBoxes} from '../src/showcase/stage-camera.js';
import {WORLD_CATALOG,worldModelUrl} from '../src/ui/world-catalog.js';

// Aurelian's walls and gate before the finale (worlds and gameplay plan, release 9).
const root=new URL('../',import.meta.url);
const report=JSON.parse(await readFile(new URL('art-source/models/processed/aurelian-walls-kit.json',root),'utf8'));
const compression=JSON.parse(await readFile(new URL('art-source/models/reports/aurelian-walls-kit-compress.json',root),'utf8'));
const campaign=JSON.parse(await readFile(new URL('tests/fixtures/campaign-3d.json',root),'utf8'));
const finale=campaign.scenes.find(s=>s.id==='ch12-confrontation');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const PIECES=['wall_curtain','wall_rising_low','wall_rising_mid','wall_rising_high','wall_tower','wall_gate'];
async function load(url){
  const bytes=await readFile(new URL(url,root)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
const box=p=>{const {min,max}=AURELIAN_WALL_COMPONENTS[p.piece];return {minX:p.x+min[0],maxX:p.x+max[0],minZ:p.z+min[2],maxZ:p.z+max[2]};};
const overlaps=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;

test('the walls kit ships its six pieces on the wall line, within its budget',async()=>{
  assert.deepEqual(report.components.map(c=>c.name).sort(),[...PIECES].sort());
  assert.deepEqual(Object.keys(AURELIAN_WALL_COMPONENTS).sort(),[...PIECES].sort());
  assert.match(report.authorship,/Original Blender-authored geometry/);assert.match(report.licence,/no third-party source assets/);
  assert.deepEqual(report.chapters,[12]);assert.deepEqual(WORLD_CATALOG['aurelian-walls-kit'].chapters,[12]);
  const bytes=await readFile(new URL(report.runtimePath,root)),info=await inspectModel(bytes);
  assert.deepEqual(budgetProblems(info,{bytes:600000,triangles:8000,texture:512,materials:5,minHeight:11,maxHeight:13}),[]);
  assert.equal(info.triangles,report.output.triangles);assert.equal(compression.geometryUnchanged,true);
  assert.equal(sha(bytes),compression.after.sha256);assert.equal(bytes.length,compression.after.bytes);
  assert.ok(info.textures.every(t=>t.mimeType==='image/ktx2'&&t.width===512&&t.height===512));
  // The wall's real proportions: 3.5 m thick, merlons on a walk 6.6 m up, towers higher still.
  assert.equal(AURELIAN_WALL_MEASURES.thickness,3.5);assert.equal(AURELIAN_WALL_MEASURES.walk,6.6);
  const scene=await load(report.runtimePath);scene.updateMatrixWorld(true);
  for(const name of PIECES){
    const piece=scene.getObjectByName(name);assert.ok(piece,name);assert.equal(piece.parent,scene,`${name} is a directly addressable root`);
    assert.deepEqual(piece.position.toArray(),[0,0,0],`${name} stands on the wall line's origin`);
    const b=new T.Box3().setFromObject(piece,true),declared=AURELIAN_WALL_COMPONENTS[name];
    b.min.toArray().forEach((v,i)=>assert.ok(Math.abs(v-declared.min[i])<.002,`${name} min ${i}: ${v} vs ${declared.min[i]}`));
    b.max.toArray().forEach((v,i)=>assert.ok(Math.abs(v-declared.max[i])<.002,`${name} max ${i}: ${v} vs ${declared.max[i]}`));
  }
  const tops=Object.fromEntries(PIECES.map(n=>[n,AURELIAN_WALL_COMPONENTS[n].max[1]]));
  assert.ok(tops.wall_rising_low<tops.wall_rising_mid&&tops.wall_rising_mid<tops.wall_rising_high&&tops.wall_rising_high<tops.wall_curtain&&tops.wall_curtain<tops.wall_tower);
});

test('the pieces follow the code-built curtain, off the board and clear of the cohorts before the gate',()=>{
  const e=finale.state.encounter,hx=e.width*2.5/2;
  for(const quality of ['balanced','performance']){
    const layout=finaleLayout(e,2.5,{quality}),pieces=aurelianWallPieces(layout,{height:(x,z)=>.01*x+.02*z});
    assert.equal(pieces[0].piece,'wall_gate');assert.equal(pieces[0].z,layout.gateZ);
    assert.equal(pieces.filter(p=>p.piece==='wall_gate').length,1);
    for(const p of pieces){
      assert.equal(p.x,layout.wallX);assert.equal(p.y,.01*p.x+.02*p.z,`${p.piece} stands on the ground`);
      assert.ok(box(p).minX>hx,`${p.piece} at ${p.z} stays off the board`);
      for(const block of layout.blocks)assert.ok(!overlaps(box(p),block.footprint),`${quality}: ${p.piece} at ${p.z} stands among the ${block.side}'s men`);
    }
    // Each side of the gate: 4 m stretches end to end, from the gate's flank to the curtain's reach.
    for(const sign of [-1,1]){
      const side=pieces.slice(1).filter(p=>Math.sign(p.z-layout.gateZ)===sign).map(p=>({...p,along:Math.abs(p.z-layout.gateZ)-2})).sort((a,b)=>a.along-b.along);
      assert.ok(Math.abs(side[0].along-AURELIAN_WALL_MEASURES.gateHalf)<1e-9,'the first stretch meets the gate');
      side.forEach((p,i)=>{
        if(i)assert.ok(Math.abs(p.along-side[i-1].along-4)<1e-9);
        // The code-built curtain's own choice (environment-finale.js): a tower about every
        // thirty metres, finished beside it, otherwise finished or still rising by the hash.
        const isTower=along=>Math.abs(((along-layout.gateGap)%30)-15)<2.1,k=Math.round(p.along*sign);
        const finished=hash(k,5)>.42||p.along<layout.gateGap+6||isTower(p.along-4)||isTower(p.along+4);
        if(isTower(p.along))assert.equal(p.piece,'wall_tower');
        else if(finished)assert.equal(p.piece,'wall_curtain');
        else assert.ok(/^wall_(rising_|curtain$)/.test(p.piece),`${p.piece} at ${p.along}`);
      });
      assert.ok(side.at(-1).along+4>=layout.reach);
    }
    assert.ok(pieces.some(p=>p.piece==='wall_tower')&&pieces.some(p=>p.piece.startsWith('wall_rising')),'towers and stretches still building');
  }
  // A cohort drawn up against a stretch still building finishes that stretch instead.
  const layout=finaleLayout(e,2.5),rising=aurelianWallPieces(layout).find(p=>p.piece.startsWith('wall_rising'));
  const crowded={...layout,blocks:[...layout.blocks,{side:'claimant',footprint:{minX:layout.wallX-4.5,maxX:layout.wallX-3.5,minZ:rising.z-.5,maxZ:rising.z+.5}}]};
  assert.equal(aurelianWallPieces(crowded).find(p=>p.z===rising.z).piece,'wall_curtain');
});

test('only the approach to Rome has the walls, and only above Performance',()=>{
  const url=worldModelUrl('aurelian-walls-kit');assert.equal(url,'assets/models/scenery/aurelian-walls-kit.glb');
  for(const s of campaign.scenes)assert.equal(aurelianWallsUrl(s.state.encounter,{chapter:s.chapter}),s.id==='ch12-confrontation'?url:null,s.id);
  const e=finale.state.encounter;
  assert.ok(sceneryWorkingSet(e,{chapter:12,quality:'balanced'}).includes(url));
  assert.deepEqual(sceneryWorkingSet(e,{chapter:12,quality:'performance'}),[]);
  // Aurelian's gate stands where the regional kit's arch would.
  assert.ok(sceneryPlacements(e,{chapter:12}).some(p=>p.component==='checkpoint_arch'));
  assert.ok(!sceneryPlacements(e,{chapter:12,withoutGate:true}).some(p=>p.component==='checkpoint_arch'));
});

test('the loaded kit replaces the code-built curtain and arch in five draws, and leaves the cached kit whole',async()=>{
  const e=finale.state.encounter,kit=await load(report.runtimePath),finished=new Set();
  const kitGeometries=new Set();kit.traverse(o=>{if(o.isMesh){kitGeometries.add(o.geometry);o.geometry.addEventListener('dispose',()=>finished.add(o.geometry));}});
  const finish=new Set(),build=(quality,wallsKit)=>createEnvironment(new T.Scene(),e,{chapter:12,quality,loadTextures:false,wallsKit,kitFinish:m=>finish.add(m)});
  const count=(world,name)=>{let n=0;world.group.traverse(o=>{if(o.name===name)n+=o.isInstancedMesh?o.count:1;});return n;};
  const plain=build('balanced',null),walled=build('balanced',kit);
  const layout=finaleLayout(e,2.5),pieces=aurelianWallPieces(layout),walls=walled.group.getObjectByName('Aurelian walls');
  assert.equal(plain.group.getObjectByName('Aurelian walls'),undefined);
  assert.ok(walls,'the walls stand in the finale');
  assert.deepEqual(walled.group.userData.finaleWalls.drawn.pieces,pieces.length);
  assert.equal(walls.children.length,report.materials.length,'one merged mesh for each of the kit\'s materials');
  const placed=pieces.reduce((n,p)=>n+report.components.find(c=>c.name===p.piece).triangles,0);
  assert.equal(walled.group.userData.finaleWalls.drawn.triangles,placed);
  for(const mesh of walls.children){
    assert.equal(mesh.castShadow,true);assert.equal(mesh.raycast(),undefined,'no piece takes picks');
    assert.ok(finish.has(mesh.material),'the kit\'s materials take the shared finish');assert.ok(!kitGeometries.has(mesh.geometry));
  }
  // No tree is planted in the walls, kit or code-built.
  for(const world of [plain,walled])for(const t of world.group.userData.regionalTrees)
    for(const p of pieces)assert.ok(!overlaps({minX:t.x-1,maxX:t.x+1,minZ:t.z-1,maxZ:t.z+1},box(p)),`a ${t.kind} at ${t.x.toFixed(1)}, ${t.z.toFixed(1)} grows in the ${p.piece}`);
  // The code-built curtain and the regional gate arch stand down; the masonry the rest of the scene uses stays.
  assert.ok(count(plain,'regional-fallback:12:checkpoint_arch:0')>0);assert.equal(count(walled,'regional-fallback:12:checkpoint_arch:0'),0);
  assert.ok(count(plain,'finale timber')>count(walled,'finale timber'),'the code-built scaffolds stand down');
  // On Performance the code-built curtain stands, kit or not.
  const performance=build('performance',kit);
  assert.equal(performance.group.getObjectByName('Aurelian walls'),undefined);assert.equal(performance.group.userData.finaleWalls,undefined);
  for(const world of [plain,performance])world.dispose();
  const merged=walls.children.map(m=>m.geometry),freed=new Set();for(const g of merged)g.addEventListener('dispose',()=>freed.add(g));
  walled.dispose();
  assert.equal(freed.size,merged.length,'disposing the world frees the merged walls');
  assert.equal(finished.size,0,'and leaves the cached kit\'s geometry alone');
});

test('the camera keeps to the field\'s side of the walls, wherever the view is turned',()=>{
  const world=createEnvironment(new T.Scene(),finale.state.encounter,{chapter:12,quality:'performance',loadTextures:false});
  const walls=world.group.userData.finaleOccupied,target=new T.Vector3(0,2.7,0),inside=(p,m)=>walls.some(({min,max})=>[0,1,2].every(k=>p[k]>min[k]-m&&p[k]<max[k]+m));
  assert.ok(walls.length>20);let drawn=0;
  for(let i=0;i<72;i++)for(const pitch of [.105,.3])for(const distance of [40,90]){
    const yaw=i/72*Math.PI*2,kept=clearOfBoxes(walls,target,{yaw,pitch,distance}),out=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
    assert.ok(kept<=distance&&kept>=8);
    const at=out.map((v,k)=>[target.x,target.y,target.z][k]+v*kept);
    assert.ok(!inside(at,1.5-1e-6),`yaw ${yaw.toFixed(2)}: the camera stands in a wall`);
    // Looking east (the camera west of the board) nothing changes.
    if(out[0]<=0)assert.equal(kept,distance);
    if(kept<distance)drawn++;
  }
  assert.ok(drawn>0,'some views come in to the walls\' face');
  // Every other field has no walls, and its camera is never moved.
  assert.equal(clearOfBoxes(undefined,target,{yaw:1,pitch:.1,distance:50}),50);
  world.dispose();
});
