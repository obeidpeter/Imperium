import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {stageEncounter} from '../src/showcase/live-figures.js';
import {boardKitFamily,boardKitPieces} from '../src/showcase/structure-registry.js';
import {createBoardKitPieces,BOARD_KIT_NEAR} from '../src/showcase/board-kit.js';
import {BOARD_KIT_COMPONENTS} from '../src/showcase/board-kit-components.js';
import {createGroundHeight,gridToWorld,terrainAt} from '../src/showcase/environment-layout.js';
import {groundHeight,navGrid,walkable} from '../src/core/realtime/navigation.js';
import {WORLD_CATALOG,chapterWorldFiles} from '../src/ui/world-catalog.js';
import {BATTLE_STRUCTURES} from '../src/data/battle-structures.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {createBattlefieldFeatures} from '../src/showcase/battlefield-features.js';
import {createSceneryOcclusion} from '../src/showcase/environment-occlusion.js';

// The board kit on the field (worlds and gameplay plan, release 4): the pieces
// structure-registry.js places on battles reached by legal commands, checked
// against the rules' own map. Presentation is read-only: these tests prove
// where models stand, not anything a player does.
const camps=new Map();let campaign;
function battle(id){
  campaign??=runCommandCampaign({featureEdition:35,onCheckpoint:s=>{const e=G.getChapter(s).encounters[s.encounterIndex];if(!camps.has(e.id))camps.set(e.id,G.serialize(s));}});
  const s=G.deserialize(camps.get(id));assert.equal(G.startEncounter(s,{controls:'realtime'}).ok,true,id);
  const world=G.realtimeWorld(s);return {world,e:stageEncounter(s.encounter,world)};
}
// Pieces a man cannot walk through, and those he walks over (low, or the surface he stands on).
const SOLID=new Set(['wall_block','tower','gate_closed','gate_barred','gate_battered','gate_panel']);
const OVER=new Set(['breach_rubble','bridge_deck','bridge_damaged','bridge_stumps','breastwork','tower_stair','gate_frame','gate_open']);

test('every structure cell of every fortified battle gets its piece, and solid pieces stand only where the rules let no one walk',()=>{
  for(const id of Object.keys(BATTLE_STRUCTURES)){
    const {world:w,e}=battle(id),family=boardKitFamily(e),pieces=boardKitPieces(e,{height:createGroundHeight(e)}),g=navGrid(w.map);
    assert.ok(family,`${id}: a kit family`);
    assert.ok(WORLD_CATALOG[`board-kit-${family}`].chapters.includes(w.chapter),`${id}: its kit is in Chapter ${w.chapter}'s pack`);
    assert.ok(chapterWorldFiles(w.chapter).includes(`assets/models/scenery/board-kit-${family}.glb`));
    const at=new Map();for(const p of pieces){const k=p.cell.join(',');if(!at.has(k))at.set(k,[]);at.get(k).push(p.piece);}
    for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(terrainAt(e,x,y)==='wall')assert.deepEqual(at.get(`${x},${y}`),['wall_block'],`${id}: one curtain piece at ${x},${y}`);
    for(const p of w.fortifications.platforms){
      assert.ok(at.get(`${p.x},${p.y}`)?.includes('tower'),`${id}: a tower on its deck`);assert.ok(at.get(p.steps.join(','))?.includes('tower_stair'),`${id}: its stair`);
    }
    for(const p of pieces){
      assert.ok(SOLID.has(p.piece)||OVER.has(p.piece),`${id}: ${p.piece} is classified`);
      const centre={x:(p.cell[0]+.5)*2.5,z:(p.cell[1]+.5)*2.5};
      if(SOLID.has(p.piece)){
        const sheer=groundHeight(g,centre.x,centre.z)>=3.2,blocked=!walkable(g,centre.x,centre.z);
        assert.ok(sheer||blocked,`${id}: ${p.piece} at ${p.cell} stands where no one walks`);
      }
      const box=BOARD_KIT_COMPONENTS[`board-kit-${family}`][p.piece];assert.ok(box,`${id}: ${p.piece} exists in the kit`);
      if(['breach_rubble','breastwork'].includes(p.piece))assert.ok(box.max[1]<.7,`${id}: ${p.piece} is low enough to step over`);
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&Number.isFinite(p.yaw));
    }
  }
});

test('a tower’s piece stands at the rules’ deck height, and a bridge is walked at its deck',()=>{
  const {e}=battle('ch9-city'),height=createGroundHeight(e),pieces=boardKitPieces(e,{height});
  for(const p of pieces.filter(p=>p.piece==='tower')){const top=p.y+3.2,c=gridToWorld({x:p.cell[0],y:p.cell[1]},e);assert.ok(Math.abs(top-height(c.x,c.z))<1e-6,'the deck is the ground’s 3.2 m');}
  const bridge=pieces.filter(p=>p.piece.startsWith('bridge'));assert.ok(bridge.length>=3,'the footbridge spans its crossing');
  assert.equal(new Set(bridge.map(p=>p.deck)).size,1,'one level deck from bank to bank');
});

test('a gate shows its state: barred when held, battered when weak, open, or rubble when breached',()=>{
  const {e}=battle('ch9-city'),gate=e.field.objects.find(o=>o.kind==='gate'&&!o.gatePanel),piece=()=>boardKitPieces(e).filter(p=>p.cell.join()===[gate.x,gate.y].join()).map(p=>p.piece).sort();
  assert.equal(gate.holder,'enemy');assert.deepEqual(piece(),['gate_barred','gate_frame']);
  assert.ok(boardKitPieces(e).filter(p=>p.piece==='gate_panel').length>0,'the rest of its line is shut');
  gate.integrity=45;assert.deepEqual(piece(),['gate_battered','gate_frame']);
  gate.state='open';gate.holder=null;assert.deepEqual(piece(),['gate_frame','gate_open']);
  gate.state='breached';assert.deepEqual(piece(),['breach_rubble']);
});

test('the instanced pieces draw every placement, near or far by distance, and own only their instance buffers',()=>{
  // A stand-in kit: one box per piece and its far level, as the generated GLB holds them.
  const master=new T.Group(),geometry=new T.BoxGeometry(1,1,1),material=new T.MeshStandardMaterial();
  for(const name of ['wall_block','wall_block_far']){const root=new T.Group();root.name=name;const mesh=new T.Mesh(geometry,material);mesh.name=`${name}_masonry`;root.add(mesh);master.add(root);}
  const placements=[{piece:'wall_block',x:0,y:0,z:0,yaw:0},{piece:'wall_block',x:80,y:0,z:0,yaw:Math.PI/2}],group=new T.Group();
  const kit=createBoardKitPieces(group,master,placements);assert.deepEqual(kit.stats(),{pieces:1,drawn:1,instances:2});
  assert.equal(kit.update({x:0,z:0}),true);const meshes=group.children;
  assert.deepEqual(meshes.map(m=>m.count),[1,1],'one near, one beyond '+BOARD_KIT_NEAR+' m');
  assert.equal(kit.update({x:1,z:0}),false,'a small move keeps the levels');
  let disposed=false;geometry.addEventListener('dispose',()=>{disposed=true;});kit.dispose();
  assert.equal(group.children.length,0);assert.equal(disposed,false,'the shared master keeps its geometry');
});

// A stand-in kit: each piece and far level one box of its generated bounds.
function boxKit(family){
  const master=new T.Group(),material=new T.MeshStandardMaterial();
  for(const [name,b]of Object.entries(BOARD_KIT_COMPONENTS[`board-kit-${family}`])){
    const root=new T.Group();root.name=name;const mesh=new T.Mesh(new T.BoxGeometry(...b.max.map((v,i)=>v-b.min[i])),material);
    mesh.position.fromArray(b.max.map((v,i)=>(v+b.min[i])/2));mesh.name=`${name}_masonry`;root.add(mesh);master.add(root);
  }
  return master;
}
test('with the kit, its curtains and towers shade the ground in the bake as the code-built works do',()=>{
  const {e}=battle('ch9-city'),options={chapter:9,quality:'balanced',loadTextures:false};
  const built=createEnvironment(new T.Scene(),e,options),kit=createEnvironment(new T.Scene(),e,{...options,boardKit:boxKit(boardKitFamily(e))});
  const sky=(world,x,z)=>{const {field,ao}=world.occlusion;return ao[Math.floor((z-field.minZ)/field.cell)*field.nx+Math.floor((x-field.minX)/field.cell)];};
  // The foot of each curtain cell with open ground beside it, half a metre out.
  const feet=[];
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(terrainAt(e,x,y)==='wall')for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(['grass','sand','stone','road'].includes(terrainAt(e,x+dx,y+dy)??'')){const c=gridToWorld({x,y},e);feet.push({x:c.x+dx*1.75,z:c.z+dy*1.75});}
  }
  assert.ok(feet.length>8,'curtain feet to sample');
  const mean=(world,points)=>points.reduce((n,p)=>n+sky(world,p.x,p.z),0)/points.length;
  const open=[{x:0,z:-e.height*1.25-4}],kitFeet=mean(kit,feet),builtFeet=mean(built,feet);
  assert.ok(kitFeet<mean(kit,open)-.08,`the kit's curtains darken their feet (${kitFeet.toFixed(2)})`);
  assert.ok(Math.abs(kitFeet-builtFeet)<.12,`as the code-built curtains do (${kitFeet.toFixed(2)} and ${builtFeet.toFixed(2)})`);
  assert.equal(kit.group.getObjectByName('board kit wall_block_masonry'),undefined,'the passing group is gone');
  built.dispose();kit.dispose();
});

test('the camera cutaway covers every kit piece, and the kit replaces the code-built gates, bridges and platforms',()=>{
  const {e}=battle('ch9-city'),scene=new T.Scene(),features=createBattlefieldFeatures(scene,{heightAt:createGroundHeight(e),boardKit:boxKit(boardKitFamily(e))});
  assert.equal(features.sync(e),true);const cutaway=createSceneryOcclusion(features.group);
  const kit=[],other=[];features.group.traverse(o=>{if(o.isMesh)(o.name.startsWith('board kit')?kit:other).push(o);});
  assert.ok(kit.length>0&&kit.every(o=>o.isInstancedMesh&&o.material.userData.sceneryCutaway),'every kit piece fades for the camera');
  assert.ok(features.stats().boardKit.instances>0);assert.ok(cutaway.stats().meshes>=kit.length);
  // What remains code-built is the field's other works (braziers, stakes, carts...), not a second gate or deck.
  const objects=features.group.userData.fieldObjects;assert.ok(objects.every(o=>!['gate','bridge','breach'].includes(o.kind)),'no code-built gate, bridge or breach beside the kit');
  cutaway.dispose();features.dispose();
});
