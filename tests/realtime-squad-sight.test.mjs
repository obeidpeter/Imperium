import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,queueCommand,step,worldHash} from '../src/core/realtime/simulation.js';
import {planDoctrine} from '../src/core/realtime/squad-ai.js';
import {squadById,squadModifiers,membersOf} from '../src/core/realtime/squads.js';
import {noticeOf,squadSight,unseen} from '../src/core/realtime/squad-sight.js';
import {battleVariety} from '../src/core/realtime/variety.js';
import {splitStreams} from '../src/core/realtime/rng-streams.js';
import {blowSetup} from '../src/core/realtime/combat.js';
import {EXCHANGE,MORALE,ORDERS,ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {ARCHETYPES} from '../src/data/realtime-forces.js';
import {ARENA,TIME} from '../src/data/realtime-rules.js';

// What squads see (worlds and gameplay plan, release 3): a notice meter for
// each hostile, ambushes on squads that have not seen their attacker, and the
// Lie in wait order.

const R=TIME.roundTicks;
const grass=(w=48,h=28)=>({id:'open',width:w,height:h,terrain:Array.from({length:h},()=>Array(w).fill('grass'))});
const hero=(over={})=>({id:'hero',name:'Hero',side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2},at:[6,60],face:[1,0],...over});
const roman=(id,at,over={})=>({id,name:`${id} squad`,side:'ally',role:'infantry',strength:16,maxStrength:16,damage:3,at,face:[1,0],member:{name:'Legionary',...ROMAN_SQUADS.infantry},
  standing:[['hold_line',null]],...over});
const goth=ARCHETYPES.gothic.infantry[0];
const band=(id,at,over={})=>({id,name:`${id} band`,side:'enemy',role:'infantry',strength:10,maxStrength:10,damage:4,at,face:[-1,0],anchor:at,
  member:{name:'Gothic warrior',attributes:goth.attributes,kit:goth.kit},...over});
const field=(squads,{actors=[hero()],chapter=5,command=3}={})=>createWorld({map:grass(),seed:3,actors,squads,chapter,command});
const run=(w,n)=>{for(let i=0;i<n;i++)step(w);};

test('a squad’s notice of each hostile fills by the perception rules when near, and stays empty far off',()=>{
  // Perception alone, four times a second, with every squad standing where it is.
  const w=field([roman('near',[20,30]),roman('far',[110,6]),band('goths',[30,30])]),look=ticks=>{for(let t=0;t<ticks;t+=TIME.aiInterval){w.tick+=TIME.aiInterval;squadSight(w);}};
  const goths=squadById(w,'goths');look(40);
  assert.ok(noticeOf(goths,'near')>0,'the squad 10 m off is being noticed');assert.ok(noticeOf(goths,'near')<100);
  assert.equal(noticeOf(goths,'far'),0,'one beyond sight is not');
  assert.ok(noticeOf(squadById(w,'near'),'goths')>0,'it works both ways');
  look(R);assert.equal(noticeOf(goths,'near'),100,'in plain sight it fills');
  // Out of sight it drains.
  for(const m of membersOf(w,squadById(w,'near'))){m.x+=80;}squadById(w,'near').x+=80;look(R);assert.equal(noticeOf(goths,'near'),0,'gone from sight, forgotten');
});

test('a squad that has not seen its attacker takes a whole hit at once, double the morale loss, and no Brace',()=>{
  // Our squad stands hidden at the enemy's front; neither has seen the other yet.
  const w=field([roman('ours',[20,30]),band('goths',[22.4,30])]),ours=squadById(w,'ours'),goths=squadById(w,'goths');
  for(const m of membersOf(w,ours))m.hidden=true;goths.braced=true;ours.notice={};goths.notice={};
  const setup=squadModifiers(w,ours,goths,{ambush:true}),plain=squadModifiers(w,ours,goths);
  assert.ok(!setup.modifiers.some(m=>m.label==='Brace'),'the brace is caught unready');assert.ok(plain.modifiers.some(m=>m.label==='Brace'));
  const strength=goths.strength,morale=goths.morale;
  w.tick=EXCHANGE.everyTicks-1;const events=[];while(!events.some(e=>e.kind==='exchange'&&e.squadId==='ours'))events.push(...step(w));
  assert.ok(events.some(e=>e.kind==='squad-ambush'&&e.squadId==='ours'&&e.targetSquadId==='goths'));
  const hit=events.find(e=>e.kind==='exchange'&&e.squadId==='ours');assert.equal(hit.damage,setup.damage*EXCHANGE.ambush.scale);assert.ok(hit.ambush);
  assert.equal(goths.strength,strength-setup.damage);
  const loss=Math.max(1,MORALE.hit-goths.moraleResistance)*EXCHANGE.ambush.morale;assert.ok(goths.morale<=morale-loss+1e-9,`morale ${morale} → ${goths.morale}`);
  assert.equal(noticeOf(goths,'ours'),100,'struck, it knows its attacker');assert.ok(membersOf(w,ours).every(m=>!m.hidden),'striking shows the men');
  // The next exchange is an ordinary tenth.
  const next=[];while(!next.some(e=>e.kind==='exchange'&&e.squadId==='ours'))next.push(...step(w));
  assert.ok(!next.some(e=>e.kind==='squad-ambush'));assert.ok(next.find(e=>e.kind==='exchange'&&e.squadId==='ours').damage<setup.damage);
});

test('the soldier’s first blow on a man of a squad that has not seen him is an ambush; struck, the squad knows him',()=>{
  const w=field([band('goths',[40,30])],{actors:[hero({at:[36.5,30]})]}),goths=squadById(w,'goths');goths.notice={};
  const soldier=w.actors.find(a=>a.id==='hero'),man=membersOf(w,goths).sort((a,b)=>Math.hypot(a.x-soldier.x,a.z-soldier.z)-Math.hypot(b.x-soldier.x,b.z-soldier.z))[0];
  assert.equal(blowSetup(w,soldier,man).ambush,true);
  goths.notice.hero=100;assert.equal(blowSetup(w,soldier,man).ambush,false,'once seen, no ambush');
  goths.notice.hero=0;goths.contact='someone';assert.equal(blowSetup(w,soldier,man).ambush,false,'a squad already fighting is not ambushed');
});

test('Lie in wait hides and halts the squad for one Command, springs on an enemy that comes near, and the enemy plans only against what it has seen',()=>{
  const w=field([roman('ours',[30,30]),band('goths',[80,30])]),ours=squadById(w,'ours');
  assert.equal(ORDERS.lie_in_wait.cost,1);
  assert.ok(queueCommand(w,{actorId:'hero',kind:'order',payload:{squads:['ours'],order:{kind:'lie_in_wait'}}}).ok);
  run(w,25);assert.equal(ours.order?.kind,'lie_in_wait');assert.ok(membersOf(w,ours).every(m=>m.hidden),'the men keep low');
  assert.equal(w.command.left,2);assert.equal(ours.plan.intent,'Lie in wait: fall on the first enemy to come near.');
  // Unseen, the enemy does not plan against it: its focus is the soldier.
  assert.ok(unseen(w,ours));planDoctrine(w);assert.equal(w.doctrine.focusId,'hero');
  // An enemy band walks up within reach: the squad falls on it, and the first exchange is an ambush.
  const goths=squadById(w,'goths');goths.x=38;goths.z=30;for(const m of membersOf(w,goths)){m.x+=-42;}goths.notice={};
  const events=[];for(let t=0;t<R&&!events.some(e=>e.kind==='squad-ambush');t++)events.push(...step(w));
  assert.ok(events.some(e=>e.kind==='squad-ambush'&&e.squadId==='ours'),'it springs the ambush');
  assert.equal(ours.order?.from??null,ours.order?'lie_in_wait':null);assert.ok(membersOf(w,ours).every(m=>!m.hidden));
});

test('a squad lying in wait is found out when an enemy’s notice of it fills, and the log says so',()=>{
  const w=field([roman('ours',[30,30]),band('goths',[38,30])]),ours=squadById(w,'ours'),goths=squadById(w,'goths');
  queueCommand(w,{actorId:'hero',kind:'order',payload:{squads:['ours'],order:{kind:'lie_in_wait'}}});run(w,25);
  assert.ok(membersOf(w,ours).every(m=>m.hidden));goths.notice={ours:99};
  const events=[];for(let t=0;t<20&&membersOf(w,ours).some(m=>m.hidden);t++)events.push(...step(w));
  assert.ok(membersOf(w,ours).every(m=>!m.hidden),'seen');assert.ok(events.some(e=>e.kind==='squad-seen'&&e.squadId==='ours'));
  assert.ok(w.log.some(l=>l.text==='ours squad is seen: it lies hidden no longer.'));assert.equal(unseen(w,ours),false);
});

test('squad sight draws no random number: two runs from the same state are the same world',()=>{
  const make=()=>field([roman('a',[20,30]),roman('b',[20,40]),band('g1',[50,30]),band('g2',[56,40])]);
  const a=make(),b=make();const streams={...a.rng};run(a,R*2);run(b,R*2);assert.equal(worldHash(a),worldHash(b));
  assert.equal(a.rng.world,streams.world,'no world draw in battle');
});

test('from Chapter IV a raider band may start lying in wait, never on Story: hidden and still, unknown to our squads, it falls on the first to come near',()=>{
  // The chance is the level's, drawn from the world stream (variety.js).
  const record=level=>({id:'ch5-wall',kind:'battle',width:8,height:8,goal:{x:2,y:4},difficulty:level,terrain:Array.from({length:8},()=>Array(8).fill('grass')),
    units:[{id:'hero',side:'player',x:0,y:4,hp:20},{id:'enemy0',side:'enemy',role:'raider',x:6,y:4,hp:10},{id:'enemy1',side:'enemy',role:'infantry',x:6,y:2,hp:10}],mission:{mode:'hold',waves:[]}});
  const lyingIn=level=>Array.from({length:40},(_,i)=>battleVariety({chapter:5,difficulty:level,encounterOptions:{}},record(level),splitStreams(i+1))).filter(v=>v.lying.enemy0).length;
  assert.equal(lyingIn('story'),0);assert.ok(lyingIn('standard')>5&&lyingIn('veteran')>lyingIn('standard')-6,`${lyingIn('standard')} and ${lyingIn('veteran')} of 40`);
  assert.ok(Array.from({length:40},(_,i)=>battleVariety({chapter:5,encounterOptions:{}},record('veteran'),splitStreams(i+1))).every(v=>!v.lying.enemy1),'only raiders lie in wait');
  // The band waits, hidden; our squad standing near does not know of it.
  const w=field([roman('ours',[20,30],{standing:[['advance_with_hero','hero'],['hold_line',null]]}),band('raiders',[45,30],{role:'raider',lying:true})],{actors:[hero({at:[14,30]})]});
  const raiders=squadById(w,'raiders');assert.ok(membersOf(w,raiders).every(m=>m.hidden));
  for(let t=0;t<40;t++)step(w);assert.equal(raiders.plan.intent,'Lie in wait.');
  assert.ok(!/raiders/.test(squadById(w,'ours').plan?.intent??''),'our squad does not go for a band it has not seen');
  // Our squad marches up to it: the band springs, and if unseen its first exchange is an ambush.
  const ours=squadById(w,'ours');ours.x=40;ours.z=30;for(const m of membersOf(w,ours))m.x+=20;ours.notice={};
  const events=[];for(let t=0;t<R&&!events.some(e=>e.kind==='squad-ambush');t++)events.push(...step(w));
  assert.ok(events.some(e=>e.kind==='squad-ambush'&&e.squadId==='raiders'&&e.targetSquadId==='ours'),'the hidden band falls on the squad');
  assert.equal(raiders.lying,false);assert.ok(membersOf(w,raiders).every(m=>!m.hidden),'striking shows its men');
});
