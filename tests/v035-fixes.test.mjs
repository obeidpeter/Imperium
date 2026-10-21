import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three/three.module.js';
import {combatCues} from '../src/showcase/combat-presentation.js';
import {createFieldworkKit} from '../src/showcase/environment-fieldwork.js';
import {BattleStage} from '../src/showcase/stage.js';

const root=new URL('../',import.meta.url);

test('v0.35.1: a stale character handoff is reported by its own audit, not by npm test', async () => {
  const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
  assert.equal(pkg.scripts['audit:handoff'],'node scripts/check-character-handoff.mjs');
  assert.match(pkg.scripts.verify,/ && node scripts\/check-character-handoff\.mjs --warn$/,'verify prints the notice without failing');
  assert.doesNotMatch(await readFile(new URL('tests/character-handoff.test.mjs',root),'utf8'),/characterSourceDigest/,'The test suite checks the committed files only');
  // Whether the export is current or stale, only the audit says so: it fails exactly when stale, and --warn never fails.
  const script=fileURLToPath(new URL('scripts/check-character-handoff.mjs',root)),audit=spawnSync(process.execPath,[script],{encoding:'utf8'});
  assert.match(audit.stdout,/^Character handoff: /);assert.equal(audit.status===0,/match the current character source/.test(audit.stdout),audit.stdout+audit.stderr);
  assert.equal(spawnSync(process.execPath,[script,'--warn'],{encoding:'utf8'}).status,0);
});

test('v0.35.1: thinned footfalls leave every mover an even share of its own steps', () => {
  // Three soldiers walk 20 tiles at once (64 footfalls each) while 10 impacts land.
  const walk=(unitId,y)=>({unitId,start:100,duration:3000,path:Array.from({length:20},(_,x)=>({x,y}))});
  const timeline=Object.freeze({tracks:[walk('a',0),walk('b',1),walk('c',2)],effects:Array.from({length:10},(_,i)=>({type:'impact',start:200+i*100}))});
  const cues=combatCues(timeline),steps=cues.filter(c=>c.kind==='footstep'),alone=combatCues({tracks:[walk('a',0)],effects:[]});
  assert.equal(alone.length,64,'One walker alone keeps every footfall');
  assert.equal(cues.length,100);assert.equal(cues.filter(c=>c.kind==='impact').length,10,'Impacts are never evicted');
  assert.equal(steps.length,90);
  for(const id of ['a','b','c']){
    const own=steps.filter(c=>c.unitId===id);assert.equal(own.length,30,`${id} keeps a third of the room`);
    assert.equal(own[0].time,alone[0].time);assert.ok(own.at(-1).time>=alone.at(-3).time,`${id}'s steps still run to the end of its footfalls`);
  }
  assert.ok(cues.every((c,i)=>i===0||c.time>=cues[i-1].time));
  assert.deepEqual(combatCues(timeline),cues,'Deterministic');
});

test('v0.35.1: the signal flag is two-sided without changing the shared fieldwork materials', () => {
  const kit=createFieldworkKit({chapter:5}),parent=new T.Group();
  for(const state of ['available','secured'])kit.build(parent,{id:'signal',kind:'signal',state},{x:0,y:0,z:0});
  const meshes=[];parent.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.ok(meshes.every(o=>o.material.side===T.FrontSide),'No fieldwork material turns double-sided');
  const cloth=meshes.filter(o=>o.geometry.type==='PlaneGeometry');assert.equal(cloth.length,4,'A front and a reversed back for each flag');
  const [front,back]=cloth,n=front.geometry.attributes.normal,r=back.geometry.attributes.normal,fi=front.geometry.index.array,bi=back.geometry.index.array;
  for(let i=0;i<n.count;i++)assert.ok(Math.abs(n.getX(i)+r.getX(i))+Math.abs(n.getY(i)+r.getY(i))+Math.abs(n.getZ(i)+r.getZ(i))<1e-9);
  for(let i=0;i<fi.length;i+=3)assert.deepEqual([bi[i],bi[i+1],bi[i+2]],[fi[i],fi[i+2],fi[i+1]],'The back faces wind the other way');
  assert.notEqual(front.geometry,back.geometry);assert.equal(front.material,back.material,'Both faces batch with the shared material');
});

test('v0.35.1: bodies and spent arrows rest on a repaired bridge deck, like the units', () => {
  // A stage without a renderer: only its remains wiring is exercised.
  const stage=Object.create(BattleStage.prototype);
  Object.assign(stage,{encounter:{kind:'battle',width:10,height:8},scene:new T.Scene(),quality:'balanced',battleRemains:true,ceremony:null,
    environment:{ground:null,groundHeight:()=>.2},surfaceHeight:()=>1.3});
  stage.rebuildRemains();
  const make=()=>({geometry:new T.BoxGeometry(1,.2,.5),label:'test'});
  assert.ok(stage.remains.layUnit({id:'e1',hp:0},{key:'test',make,world:new T.Vector3(10,1.3,0),animate:false}));
  const body=stage.remains.group.children.find(c=>c.isInstancedMesh&&c.name==='fallen test'),m=new T.Matrix4(),p=new T.Vector3();
  body.getMatrixAt(0,m);p.setFromMatrixPosition(m);assert.ok(Math.abs(p.y-1.3)<1e-5,`The body lies on the deck (${p.y})`);
  assert.ok(stage.remains.arrows({from:{x:2,z:0},to:{x:10,z:0},count:3,seed:'deck'})>0);
  const arrows=stage.remains.group.children.find(c=>c.isInstancedMesh&&c!==body&&c.count>0);arrows.getMatrixAt(0,m);p.setFromMatrixPosition(m);
  assert.ok(Math.abs(p.y-(1.3-.07))<1e-5,'Arrows stand in the deck, not the river bed');
  stage.remains.dispose();
});
