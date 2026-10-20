import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {BattleStage,intersectGround} from '../src/showcase/stage.js';
import {createInkOverlay} from '../src/showcase/ink-overlay.js';
import {RIVER_WATER_LEVEL} from '../src/showcase/environment-layout.js';

function encounter(state='repaired'){
  return {id:'ch5-crossing',kind:'battle',featureEdition:31,width:5,height:5,
    terrain:Array.from({length:5},()=>Array(5).fill('grass')),units:[],
    field:{objects:[{id:'crossing',kind:'bridge',state,x:2,y:2}]}};
}
const ground=(x,z)=>Math.abs(x)<1.3?-.8:0;
function stageFixture(e=encounter(),quality='balanced'){
  const stage=Object.create(BattleStage.prototype);
  Object.assign(stage,{scene:new T.Scene(),encounter:e,quality,environment:{groundHeight:ground},
    actors:new Map(),labels:new Map(),labelRefs:new Map(),poseReset:new Set(),
    labelLayer:{dataset:{}},goalMarker:{visible:false},missionMarkers:new Map(),overlay:new T.Group()});
  stage.rebuildFieldFeatures();stage.fieldFeatures.sync(e);
  stage.surfaceHeight=(x,z)=>stage.fieldFeatures.surfaceHeight(x,z)??stage.environment.groundHeight(x,z);
  return stage;
}
function release(stage){
  stage.ink?.dispose();stage.fieldFeatures.dispose();
  if(stage.grid){stage.grid.geometry.dispose();stage.grid.material.dispose();}
  for(const line of stage.tacticalArcs??[]){line.geometry.dispose();line.material.dispose();}
}
function canvasFixture(){
  const previous=globalThis.OffscreenCanvas,counts={clears:0};
  globalThis.OffscreenCanvas=class{
    constructor(width,height){this.width=width;this.height=height;}
    getContext(){return new Proxy({clearRect(){counts.clears++;}},{get:(o,key)=>o[key]??(()=>{}),set:(o,key,value)=>{o[key]=value;return true;}});}
  };
  return {counts,restore(){if(previous===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=previous;}};
}

test('Repaired bridges pick the visible deck at shallow angles, and retain terrain fallback off the bridge',()=>{
  const stage=stageFixture(),target=stage.world({x:2,y:2}),origin=new T.Vector3(-6,2,1),ray=new T.Ray(origin,target.clone().sub(origin).normalize());
  const wrong=intersectGround(ray,ground);assert.notEqual(Math.round(wrong.x/2.5+2),2,'The old ground-only ray selects the far bank');
  Object.assign(stage,{canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})},
    camera:{},ndc:new T.Vector2(),hit:new T.Vector3(),ray:{ray,setFromCamera(){},intersectObjects:()=>[]}});
  const before=JSON.stringify(stage.encounter);
  assert.deepEqual(stage.pick({clientX:400,clientY:300}),{x:2,y:2});
  assert.ok(stage.hit.distanceTo(target)<.001);assert.equal(stage.world({x:4,y:4}).y,0);
  assert.equal(JSON.stringify(stage.encounter),before);release(stage);
});

test('Committed repair and removal redrape existing ink and grid once, without repainting the legal reach',()=>{
  const canvas=canvasFixture(),e=encounter('damaged'),stage=stageFixture(e);
  try{
    stage.ink=createInkOverlay(stage.scene,e,stage.surfaceHeight);stage.setGrid(false);
    const reach={targets:[{x:2,y:2}]};stage.ink.paint(reach);
    const ink=stage.ink.mesh.geometry.attributes.position,grid=stage.grid.geometry.attributes.position,texture=stage.ink.mesh.material.map;
    const centre=Array.from({length:ink.count},(_,i)=>i).find(i=>Math.abs(ink.getX(i))+Math.abs(ink.getZ(i))<1e-5);
    const deckEdge=Array.from({length:grid.count},(_,i)=>i).find(i=>Math.abs(grid.getX(i)+1.25)<1e-5&&Math.abs(grid.getZ(i))<1e-5);
    assert.notEqual(centre,undefined);assert.notEqual(deckEdge,undefined);
    assert.ok(Math.abs(ink.getY(centre)-(RIVER_WATER_LEVEL+.035))<1e-6);
    for(const method of ['updateChamberStandards','updateFieldworks','updateBattleDecals','updateInk','updateMoraleRings','updateReinforcementBeacons','updateTacticalLinks'])stage[method]=()=>{};
    e.field.objects[0].state='repaired';const state=JSON.stringify(e);stage.sync(e);
    assert.ok(Math.abs(ink.getY(centre)-.165)<1e-6);assert.ok(Math.abs(grid.getY(deckEdge)-.17)<1e-6);
    assert.equal(stage.grid.visible,false,'A hidden grid must stay hidden while its buffer is updated');
    const version=ink.version,gridVersion=grid.version,clears=canvas.counts.clears;stage.sync(e);
    assert.equal(ink.version,version);assert.equal(grid.version,gridVersion);
    assert.equal(stage.ink.paint(reach),false);assert.equal(canvas.counts.clears,clears);assert.equal(stage.ink.mesh.material.map,texture);
    assert.equal(JSON.stringify(e),state);
    e.featureEdition=undefined;stage.sync(e);
    assert.ok(Math.abs(ink.getY(centre)-(RIVER_WATER_LEVEL+.035))<1e-6);
    assert.ok(Math.abs(grid.getY(deckEdge)-(RIVER_WATER_LEVEL+.04))<1e-6);
    release(stage);assert.equal(stage.ink.redrape(),false,'Disposed buffers cannot be resurrected');
  }finally{canvas.restore();}
});

test('Ground movement links stay above the repaired deck for every sampled point on its footprint',()=>{
  const stage=stageFixture(),e=stage.encounter;
  e.units=[{id:'hero',side:'player',role:'soldier',hp:10,x:1,y:2,move:4}];stage.selected='hero';
  const before=JSON.stringify(e);stage.updateTacticalLinks({x:3,y:2},'move');
  const line=stage.tacticalArcs.find(l=>l.userData.linkKind==='path');assert.ok(line);
  const p=line.geometry.attributes.position;let overDeck=0;
  for(let i=0;i<p.count;i++)if(stage.fieldFeatures.surfaceHeight(p.getX(i),p.getZ(i))!==null){
    overDeck++;assert.ok(Math.abs(p.getY(i)-.24)<1e-6);
  }
  assert.ok(overDeck>=7);assert.equal(JSON.stringify(e),before);release(stage);
});

test('Fieldwork quality rebuild disposes old geometry, reduces Performance triangles, and samples the rebuilt ground',()=>{
  const stage=stageFixture();stage.encounter.field.objects.push({id:'stores',kind:'stores',state:'available',x:4,y:4});stage.fieldFeatures.sync(stage.encounter);
  const old=stage.fieldFeatures,balanced=old.stats().triangles,tracked=new Set();
  old.group.traverse(o=>{if(o.isMesh){tracked.add(o.geometry);tracked.add(o.material);}});
  let disposed=0;for(const resource of tracked)resource.addEventListener('dispose',()=>disposed++);
  const before=JSON.stringify(stage.encounter);stage.quality='performance';stage.environment={groundHeight:()=>.3};stage.rebuildFieldFeatures();
  assert.equal(disposed,tracked.size);assert.equal(old.group.parent,null);
  assert.equal(stage.fieldFeatures.sync(stage.encounter),true);
  assert.ok(stage.fieldFeatures.stats().triangles<balanced,'The selected quality reaches the actual fieldwork mesh kit');
  assert.ok(Math.abs(stage.world({x:2,y:2}).y-.43)<1e-9);
  assert.equal(stage.scene.children.filter(o=>o.name==='interactive-battlefield').length,1);
  assert.equal(stage.fieldFeatures.sync(stage.encounter),false);assert.equal(JSON.stringify(stage.encounter),before);release(stage);
});
