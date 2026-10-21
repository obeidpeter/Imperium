import test from 'node:test';
import assert from 'node:assert/strict';
import {createShowcaseSession} from '../src/showcase/session.js';
import {createWorld,queueCommand,routePreview,step,engaged} from '../src/core/realtime/simulation.js';
import {clearLine,findRoute,navGrid,walkable} from '../src/core/realtime/navigation.js';
import {pointerIntent,nextTarget} from '../src/core/realtime/intents.js';
import {derivedValues} from '../src/core/realtime/combat.js';
import {ARENA,MOVEMENT} from '../src/data/realtime-rules.js';

const map=createShowcaseSession().encounter;
const hero=(at,face=[1,0],extra={})=>({id:'hero',name:'Hero',side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2},at,face,...extra});
const raider=(id,at,face=[-1,0])=>({id,name:'Raider',side:'enemy',role:'raider',attributes:{str:13,agi:12,con:10,combat:8},kit:['tunic','jerkin','axe'],at,face});
const by=(w,id)=>w.actors.find(a=>a.id===id);
// A world with no enemy left is won at once; this one stands far off, unaware, so the fight goes on.
const idle=()=>raider('idle',[19,1.4],[0,-1]);
const flat=(rows,id='flat')=>({id,width:rows[0].length,height:rows.length,terrain:rows.map(r=>[...r].map(c=>({'.':'grass',X:'rock',m:'marsh',f:'ford','~':'river'}[c])))});

test('the walkability grid follows the encounter map at 0.5 m, rocks widened by the clearance',()=>{
  const g=navGrid(map);assert.equal(g.cols,40);assert.equal(g.rows,40);
  // ch1-road has rock at tiles (2,0)-(3,0) and (2,5)-(3,5).
  assert.equal(walkable(g,2.5*2.5,1.25),false);assert.equal(walkable(g,2.5*3.5,5.5*2.5),false);
  assert.equal(walkable(g,4.75,1.25),false,'half a metre beside a rock is kept clear');assert.equal(walkable(g,4.25,1.25),true);
  assert.equal(walkable(g,1.25,8.75),true);
});

test('A* with string pulling: a straight line where clear, round the rocks where not',()=>{
  const g=navGrid(map);
  const open=findRoute(g,{x:1.25,z:16},{x:18,z:16});assert.equal(open.points.length,1);assert.ok(Math.abs(open.length-16.75)<1e-9);
  const round=findRoute(g,{x:6.25,z:4},{x:6.25,z:17});assert.ok(round.points.length>=2,'it bends round the rock');
  assert.equal(round.reasonCode,undefined);
  let prev={x:6.25,z:4};for(const p of round.points){assert.ok(clearLine(g,prev,p),'every leg is walkable');prev=p;}
  assert.ok(round.length<13*1.5,'and stays short');
});

test('B6: a path longer than 8 m runs and a shorter one walks; W forces walking',()=>{
  const w=createWorld({map,seed:1,actors:[hero([1.25,16]),idle()]});
  assert.equal(routePreview(w,'hero',{x:13,z:16}).gait,'run');assert.equal(routePreview(w,'hero',{x:8,z:16}).gait,'walk');
  queueCommand(w,{actorId:'hero',kind:'move',payload:{x:13,z:16}});step(w);
  const run=derivedValues(by(w,'hero')).run;assert.equal(by(w,'hero').gait,'run');assert.ok(Math.abs(by(w,'hero').x-(1.25+run/20))<1e-9,'4.0 × (1 − Restriction/200) m/s');
  queueCommand(w,{actorId:'hero',kind:'setWalk',payload:{walk:true}});step(w);
  const x=by(w,'hero').x;step(w);assert.ok(Math.abs(by(w,'hero').x-x-MOVEMENT.walk/20)<1e-9,'walks at 1.6 m/s');
  assert.equal(routePreview(w,'hero',{x:19,z:16}).gait,'walk');assert.equal(pointerIntent(w,{pick:{x:19,z:16}}).cursor,'walk');
});

test('B8: an unreachable click stops at the nearest reachable point, with the blocked cursor and a reason code',()=>{
  const w=createWorld({map,seed:1,actors:[hero([1.25,16]),idle()]}),rock={x:2.5*3,z:2.5*5.5};
  const intent=pointerIntent(w,{pick:rock});assert.equal(intent.cursor,'blocked');assert.equal(intent.reason,'PATH_BLOCKED');assert.ok(intent.command);
  const route=routePreview(w,'hero',rock);assert.equal(route.reasonCode,'PATH_BLOCKED');assert.ok(walkable(navGrid(map),route.stopPoint.x,route.stopPoint.z));
  queueCommand(w,intent.command);for(let i=0;i<200;i++)step(w);
  const h=by(w,'hero');assert.ok(Math.hypot(h.x-route.stopPoint.x,h.z-route.stopPoint.z)<.6,'he stops there');assert.equal(h.order,null);
  assert.ok(w.log.length===0||w.events.every(e=>e.kind!=='hit'));
});

test('B9: an enemy facing you within 2 m stops you running; walking away never provokes a free blow',()=>{
  const w=createWorld({map,seed:3,actors:[hero([12,16],[1,0]),raider('r',[13.6,16],[-1,0])]});
  assert.equal(engaged(w,by(w,'hero')),true);
  const intent=pointerIntent(w,{pick:{x:1,z:16}});assert.equal(intent.cursor,'walk');assert.equal(intent.reason,'ENGAGED_CANNOT_RUN');
  // Turned away from you, he does not engage you.
  by(w,'r').fx=1;assert.equal(engaged(w,by(w,'hero')),false);by(w,'r').fx=-1;
  // The raider is still recovering from a blow: stepping away gives him nothing.
  by(w,'r').readyAt=40;by(w,'r').ai.state='engage';
  queueCommand(w,{actorId:'hero',kind:'move',payload:{x:1,z:16}});
  const x0=by(w,'hero').x;step(w);assert.ok(Math.abs(x0-by(w,'hero').x-MOVEMENT.walk/20)<1e-9,'walks while engaged');
  for(let i=0;i<30;i++){step(w);assert.ok(!w.events.some(e=>['hit','block','miss'].includes(e.kind)),'no free blow');}
});

test('B10: marsh slows to 0.6 and a ford to 0.5, and the route weighs them',()=>{
  for(const [ground,factor]of [['m',.6],['f',.5]]){
    const rows=Array.from({length:4},()=>ground.repeat(8)),w=createWorld({map:flat(rows),seed:1,actors:[hero([1.25,3.75]),raider('idle',[19,.5],[0,-1])]});
    queueCommand(w,{actorId:'hero',kind:'setWalk',payload:{walk:true}});queueCommand(w,{actorId:'hero',kind:'move',payload:{x:12,z:3.75}});
    step(w);assert.ok(Math.abs(by(w,'hero').x-1.25-MOVEMENT.walk*factor/20)<1e-9,`${ground} ×${factor}`);
  }
  // Firm ground round a marsh beats the straight line through it when it is quicker.
  const g=navGrid(flat(['........','..mmmm..','..mmmm..','........']));
  const r=findRoute(g,{x:1.25,z:3.75},{x:18.75,z:3.75}),through=17.5,around=r.length;
  assert.ok(r.points.some(p=>p.z<2.5||p.z>5),'the route leaves the marsh rows');assert.ok(around>through&&around<through/.6);
});

test('a click moves the soldier on the very next tick (50 ms of battle time)',()=>{
  const w=createWorld({map,seed:1,actors:[hero([1.25,16]),idle()]});
  queueCommand(w,{actorId:'hero',kind:'move',payload:{x:6,z:16}});const x=by(w,'hero').x;step(w);
  assert.ok(by(w,'hero').x>x);assert.equal(by(w,'hero').moving,true);
});

test('separation keeps bodies apart, never on blocked ground',()=>{
  const w=createWorld({map,seed:4,actors:[hero([6,16]),raider('a',[6.1,16.05]),raider('b',[6.05,15.9])]});
  for(let i=0;i<20;i++)step(w);
  const alive=w.actors.filter(a=>a.alive),g=navGrid(map);
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++)assert.ok(Math.hypot(alive[i].x-alive[j].x,alive[i].z-alive[j].z)>=MOVEMENT.radius*2-.05);
  for(const a of alive)assert.ok(walkable(g,a.x,a.z));
});

test('cursor states and the message line: attack, walk, run, blocked, ability valid and invalid',()=>{
  const w=createWorld({map,seed:2,actors:[hero([1.25,16]),raider('r',[14,16])]});
  const attack=pointerIntent(w,{pick:{actorId:'r'}});assert.equal(attack.cursor,'attack');assert.match(attack.message,/^Attack Raider: \d+% to hit/);
  assert.deepEqual(attack.command.payload,{targetId:'r'});
  queueCommand(w,{actorId:'hero',kind:'setOptions',payload:{drawToAttack:false}});step(w);
  assert.equal(pointerIntent(w,{pick:{actorId:'r'}}).cursor,'walk','Draw to attack off: a click only walks to him');
  assert.equal(pointerIntent(w,{pick:{x:12,z:12}}).cursor,'run');
  const pilum=pointerIntent(w,{pick:{actorId:'r'},button:'right',abilityId:'throw_pilum'});assert.equal(pilum.cursor,'ability_valid');
  by(w,'hero').ammo.pilum=0;const none=pointerIntent(w,{pick:{actorId:'r'},button:'right',abilityId:'throw_pilum'});
  assert.equal(none.cursor,'ability_invalid');assert.equal(none.reason,'NO_AMMO');assert.equal(none.command,null);
  assert.equal(pointerIntent(w,{button:'right',abilityId:'brace'}).cursor,'ability_valid');
});

test('T cycles visible enemies nearest first; Shift+T cycles friends',()=>{
  const w=createWorld({map,seed:2,actors:[hero([1.25,16]),raider('far',[18,16]),raider('near',[6,16]),{...raider('ally',[2,14]),side:'player',id:'ally'}]});
  assert.equal(nextTarget(w),'near');assert.equal(nextTarget(w,{current:'near'}),'far');assert.equal(nextTarget(w,{current:'far'}),'near');
  assert.equal(nextTarget(w,{friends:true}),'ally');
});
