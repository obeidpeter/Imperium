import test from 'node:test';
import assert from 'node:assert/strict';
import {debriefMarkup,realtimeDebrief} from '../src/ui/realtime-debrief.js';
import {realtimeResult} from '../src/ui/realtime-view.js';

// Explicit log fixtures: test evidence selection and truthful fallbacks, not a
// claimed campaign play-through or reconstructed simulation history.
const event=(tick,kind,text,extra={})=>({tick,kind,text,...extra});
function record(log,status='lost'){return {tick:600,status,heroId:'hero',actors:[{id:'hero',name:'Hero',alive:true,hp:5,maxHp:30,ammo:{}}],party:[],squads:[],used:[],log,objects:[],mission:null};}

test('debrief selects at most three distinct recorded moments in chronological order, without mutation',()=>{
  const w=record([event(20,'secured','A position is secured.',{x:12,z:8}),event(30,'miss','Hero misses Raider.'),
    event(50,'pressure','Enemies hold the objective: the line weakens to 50.'),event(80,'pressure','Enemies hold the objective: the line weakens to 20.'),
    event(100,'squad-broken','First cohort breaks and falls back to regroup.'),event(120,'defeat','The line broke.')]);
  w.squads=[{id:'first',name:'First cohort',side:'ally'}];const before=JSON.stringify(w),d=realtimeDebrief(w);
  assert.deepEqual(d.moments.map(e=>e.tick),[20,80,100]);assert.equal(d.moments[0].location,'12 m, 8 m');
  assert.ok(d.moments.every(m=>w.log.some(e=>e.text===m.text&&e.tick===m.tick)));
  assert.match(d.advice,/friendly squad on the defended ground/);assert.equal(JSON.stringify(w),before);
});

test('an enemy morale break never blames the player; interrupted work produces specific advice',()=>{
  const w=record([event(20,'squad-broken','Enemy horse breaks and falls back to regroup.')]);w.squads=[{name:'Enemy horse',side:'enemy'}];
  assert.doesNotMatch(realtimeDebrief(w).advice,/squad that broke/);
  w.log.push(event(40,'work-stopped',"Hero's work is interrupted."));assert.match(realtimeDebrief(w).advice,/screen the worker.*remaining stages/);
});

test('sparse old logs do not invent three moments, positions or a causal explanation',()=>{
  const w=record([event(20,'unknown','An older saved entry.'),event(30,'victory','The objective is secured.')],'won');
  assert.deepEqual(realtimeDebrief(w).moments,[]);assert.match(realtimeDebrief(w).note,/no detailed turning points/);assert.equal(realtimeDebrief(w).advice,null);
  w.log=[event(20,'field','Hero opens a breach in the west wall. The rubble passage is open to both armies.')];
  const d=realtimeDebrief(w);assert.equal(d.moments.length,1);assert.equal(d.moments[0].location,null);assert.doesNotMatch(debriefMarkup(d),/undefined|NaN/);
});

test('one casualty and its squad destruction are one moment; deadline advice outranks incidental morale',()=>{
  const w=record([event(20,'fall','Enemy archer falls.',{x:10,z:10}),event(20,'squad-destroyed','Enemy archers is cut down.',{x:10,z:10}),
    event(40,'squad-broken','First cohort breaks and falls back to regroup.'),event(50,'enemy-plan','The enemy changes its plan: turn your left.')]);
  w.squads=[{name:'First cohort',side:'ally'}];w.mission={mode:'recover',deadline:2,required:['scout'],points:[]};
  const d=realtimeDebrief(w);assert.equal(d.moments.length,3);assert.ok(!d.moments.some(m=>m.kind==='fall'));
  assert.match(d.advice,/Use Scout before approaching the records chest/);assert.doesNotMatch(d.advice,/squad that broke/);
});

test('result renders actual evidence safely and keeps Continue, rewards and exact chronicle state',()=>{
  const world=record([event(20,'secured','<img src=x onerror=bad> position secured.')],'won');
  const state={chapter:5,encounter:{id:'ch5-mine',status:'won',realtime:{world},staged:{}}},before=JSON.stringify(state);
  const html=realtimeResult(state);assert.match(html,/Key recorded moments/);assert.match(html,/data-cmd="commit"/);
  assert.ok(!html.includes('<img src=x'));assert.match(html,/&lt;img/);assert.equal(JSON.stringify(state),before);
});
