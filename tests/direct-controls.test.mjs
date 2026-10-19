import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Game from '../src/core/game.js';
import {directIntent,visibleUnitAt,nextReadyUnit,keyboardAction} from '../src/ui/direct-controls.js';
import {geometry,pickBattlePoint} from '../src/ui/renderer.js';
import {spriteHeight} from '../src/ui/unit-sprites.js';

function opening(){const s=Game.newGame('Direct controls');Game.choose(s,Game.getChapter(s).decision.options[0].id);Game.startEncounter(s);return s;}
test('One click on open ground walks there (or toward it); Confirm moves keeps the preview; nothing mutates the rules',()=>{
  const s=opening(),before=Game.serialize(s),targets=Game.getTargets(s,'hero','move');assert.ok(targets.length>1);
  const walk=directIntent(s,{point:targets[0]});assert.equal(walk.kind,'move');assert.equal(walk.action,'move');
  assert.deepEqual(walk.target,targets[0]);assert.deepEqual(walk.route,Game.moveRoute(s,'hero',targets[0]));assert.equal(walk.route.reachable,true);
  assert.ok(Game.preview(s,{unitId:'hero',action:'move',x:walk.target.x,y:walk.target.y}).ok,'A walk is an ordinary legal move');
  // Beyond reach: as far toward the clicked ground as the rules allow this turn.
  const far=directIntent(s,{point:{x:7,y:0}});assert.equal(far.kind,'move');assert.deepEqual(far.goal,{x:7,y:0});
  assert.ok(targets.some(t=>t.x===far.target.x&&t.y===far.target.y));assert.equal(far.route.reachable,false);
  // Choosing Move first behaves the same; another chosen command never turns a ground click into a walk.
  assert.equal(directIntent(s,{action:'move',point:targets[1]}).kind,'move');
  assert.equal(directIntent(s,{action:'strike',point:targets[0]}).kind,'preview');
  assert.equal(directIntent(s,{action:'strike',point:{x:7,y:0}}).kind,'inspect');
  // With Confirm moves on, the original contract: preview, then the same target again confirms.
  const first=directIntent(s,{point:targets[0],moveOnClick:false});assert.equal(first.kind,'preview');assert.equal(first.action,'move');
  const second=directIntent(s,{action:first.action,target:first.target,point:targets[0],moveOnClick:false});assert.equal(second.kind,'confirm');
  const other=directIntent(s,{action:first.action,target:first.target,point:targets[1],moveOnClick:false});assert.equal(other.kind,'preview');
  // Far ground previews the stop; the same far ground (or the stop) again confirms that stop.
  const farPreview=directIntent(s,{point:{x:7,y:0},moveOnClick:false});assert.equal(farPreview.kind,'preview');assert.equal(farPreview.action,'move');
  assert.deepEqual(farPreview.target,far.target,'Previewed and walked moves stop on the same tile');
  assert.equal(directIntent(s,{action:'move',target:farPreview.target,point:{x:7,y:0},moveOnClick:false}).kind,'confirm');
  assert.equal(directIntent(s,{action:'move',target:farPreview.target,point:farPreview.target,moveOnClick:false}).kind,'confirm');
  assert.equal(directIntent(s,{action:'strike',point:{x:7,y:0},moveOnClick:false}).kind,'inspect');
  assert.equal(Game.serialize(s),before,'Intentions never spend anything by themselves');
});
test('Invalid, hidden and uncommandable targets cannot become automatic commands',()=>{
  const s=opening(),hero=s.encounter.units.find(u=>u.id==='hero');
  assert.equal(directIntent(s,{point:{x:-1,y:0}}).kind,'none');
  assert.equal(directIntent(s,{point:hero}).kind,'select');
  const foe=s.encounter.units.find(u=>u.side==='enemy');
  if(foe){foe.hidden=true;assert.equal(visibleUnitAt(s.encounter,foe),null);assert.notEqual(directIntent(s,{point:foe}).target?.unitId,foe.id);}
  s.encounter.status='won';assert.equal(directIntent(s,{point:hero}).kind,'none');
});
test('Action hotkeys respect available action order and next-ready cycles only commandable figures',()=>{
  const s=opening(),available=Game.getActions(s,'hero');assert.equal(keyboardAction('1',available),available[0]);
  assert.equal(keyboardAction('9',[]),null);assert.equal(keyboardAction('Enter',available),null);
  const next=nextReadyUnit(s,'hero');assert.ok(Game.getActions(s,next).length);
  assert.equal(s.encounter.units.find(u=>u.id===next).hidden,undefined);
});
test('Figure picking uses visible bodies above their tiles, preserves terrain picking and ignores hidden units',()=>{
  const canvas={getBoundingClientRect:()=>({left:40,top:30,width:900,height:600})};
  const u={id:'figure',x:4,y:4,hp:10,side:'player',role:'infantry'},e={width:8,height:8,units:[u]},g=geometry(canvas,e),h=spriteHeight(g,u);
  const x=40+g.ox,y=30+g.oy+4*g.th-h*.65;
  assert.deepEqual(pickBattlePoint(canvas,e,x,y),{x:4,y:4,unitId:'figure'});
  u.hidden=true;assert.notEqual(pickBattlePoint(canvas,e,x,y).unitId,'figure');
  assert.deepEqual(pickBattlePoint(canvas,e,40+g.ox,30+g.oy),{x:0,y:0});
  assert.deepEqual(pickBattlePoint({getBoundingClientRect:()=>({width:0,height:0})},e,0,0),{x:-1,y:-1});
});

test('A legally earned capped delegate is inspected automatically while explicit speeches and useful reinforcement remain available',async()=>{
  const fixtures=JSON.parse(await readFile(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
  const scene=fixtures.scenes.find(scene=>scene.id==='board-ch11-adlection');
  const s=Game.deserialize(JSON.stringify(scene.state)),before=Game.serialize(s);
  const targets=Game.getTargets(s,'hero','record');
  const capped=targets.find(t=>Game.preview(s,{unitId:'hero',action:'record',x:t.x,y:t.y,targetId:t.unitId}).forecast.stanceChanges.every(c=>c.from===6&&c.to===6));
  assert.ok(capped,'The legal Chapter XI checkpoint must contain a capped reachable delegate.');
  assert.equal(directIntent(s,{point:capped}).kind,'inspect');
  const explicit=directIntent(s,{point:capped,action:'record'});
  assert.equal(explicit.kind,'preview');assert.equal(explicit.action,'record');
  assert.equal(directIntent(s,{point:capped,action:'record',target:explicit.target}).kind,'confirm');
  const reinforcement=targets.find(t=>{const f=Game.preview(s,{unitId:'hero',action:'record',x:t.x,y:t.y,targetId:t.unitId}).forecast;return f.votesBefore===f.votesAfter&&f.stanceChanges.some(c=>c.to>c.from);});
  assert.ok(reinforcement,'Already supportive delegates can still gain useful commitment.');
  const intent=directIntent(s,{point:reinforcement});assert.equal(intent.kind,'preview');
  assert.ok(Game.preview(s,{unitId:'hero',action:intent.action,x:intent.target.x,y:intent.target.y,targetId:intent.target.unitId}).forecast.stanceChanges.some(c=>c.to>c.from));
  assert.equal(Game.serialize(s),before,'Inspection and inferred previews must not spend a speech or alter the save.');
});
