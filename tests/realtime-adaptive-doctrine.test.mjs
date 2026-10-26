import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,snapshotWorld,restoreWorld,worldHash,queueCommand} from '../src/core/realtime/simulation.js';
import {planDoctrine,decideSquad} from '../src/core/realtime/squad-ai.js';
import {observeBattleSituation,scoreEnemyPlans} from '../src/core/realtime/adaptive-doctrine.js';
import {squadById,membersOf,squadSpeed} from '../src/core/realtime/squads.js';
import {fieldIntelligence} from '../src/core/realtime/intel.js';
import {ENEMY_PLANS,ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {ADAPTIVE_TACTICS,TACTICAL_IDENTITIES,realtimeAlliedRole} from '../src/data/realtime-tactics.js';
import {ARCHETYPES} from '../src/data/realtime-forces.js';
import {ARENA,TIME} from '../src/data/realtime-rules.js';
import {validateWorld} from '../src/core/realtime/validate.js';
import {createEncounterWorld} from '../src/core/realtime/campaign-encounter.js';
import {createBattle} from '../src/core/battle.js';
import {CHAPTERS} from '../src/data/campaign.js';
import * as G from '../src/core/game.js';

const map=(terrain='grass')=>({id:'adaptive-fixture',width:40,height:30,terrain:Array.from({length:30},()=>Array(40).fill(terrain))});
const roman=(id,at,over={})=>({id,name:id,side:'ally',role:'infantry',strength:16,maxStrength:16,at,face:[1,0],member:ROMAN_SQUADS.infantry,standing:[['hold_line',null]],...over});
const band=(id,at,role='infantry')=>({id,name:id,side:'enemy',faction:'persian',role,strength:10,maxStrength:10,at,face:[-1,0],anchor:at,member:ARCHETYPES.persian[role][0]});
const field=(over={})=>createWorld({map:map(),seed:37,chapter:5,command:3,actors:[{...ARENA.hero,at:[12,35]}],squads:[roman('line',[35,35]),band('foot',[65,35]),band('horse',[66,43],'cavalry'),band('bows',[72,28],'archer')],...over});
const observe=w=>observeBattleSituation(w,w.squads.filter(s=>s.side==='enemy'),w.squads.filter(s=>s.side==='ally'),[],w.actors.find(a=>a.id==='hero'));

test('Observed braced fronts produce flanking plans; wavering fronts produce pressure, with reasons and held-plan hysteresis',()=>{
  const w=field(),line=squadById(w,'line');line.braced=true;w.doctrine=null;planDoctrine(w);
  assert.ok(['flank-left','flank-right'].includes(w.doctrine.plan.id));assert.match(w.doctrine.plan.reason,/flank|Mobile/);
  assert.match(fieldIntelligence(w).doctrine.planSummary,/visible|flank|Mobile/);
  const first=w.doctrine.plan.id;line.braced=false;line.strength=7;line.morale=35;w.tick=TIME.roundTicks;planDoctrine(w);
  assert.equal(w.doctrine.plan.id,first,'A plan cannot thrash on each observation');
  w.tick=TIME.roundTicks*2;planDoctrine(w);assert.equal(w.doctrine.plan.id,'fix');assert.match(w.doctrine.plan.reason,/wavering/);
});

test('Adaptive evidence is read-only and bounded; hidden formations cannot affect plan scores',()=>{
  const w=field(),line=squadById(w,'line');for(const a of membersOf(w,line))a.hidden=true;
  const before=snapshotWorld(w),s=observe(w);assert.ok(!s.observed.includes('line'));assert.ok(s.observed.length<=ADAPTIVE_TACTICS.maxTargets);
  const scores=scoreEnemyPlans(w,ENEMY_PLANS.weights.siege,s);assert.equal(snapshotWorld(w),before,'Scoring consumes no RNG and changes no perception state');
  line.braced=true;line.strength=1;line.morale=0;
  assert.deepEqual(scoreEnemyPlans(w,ENEMY_PLANS.weights.siege,observe(w)),scores,'Unseen weakness and formation are not evidence');
});

test('Blocked flanks and unseen approaches are rejected without unbounded route search',()=>{
  const w=field(),s=observe(w);assert.ok(s.observed.includes('line'));
  const blocked={...s,braced:true,leftOpen:false,rightOpen:true,mobile:1};
  const plans=scoreEnemyPlans(w,ENEMY_PLANS.weights.siege,blocked),left=plans.find(p=>p.id==='flank-left'),right=plans.find(p=>p.id==='flank-right');assert.ok(right.score>left.score+5);
  const remote=field({squads:[roman('line',[12,10]),band('foot',[95,65]),band('horse',[95,60],'cavalry')]});
  assert.deepEqual(observe(remote).observed,[]);const unobserved=scoreEnemyPlans(remote,ENEMY_PLANS.weights.siege,observe(remote));assert.ok(unobserved.every(p=>p.score===0),'Unobserved openings preserve authored faction weights');
});

test('Mission pressure intercepts a seen civilian column and contests capture ground instead of following every soldier',()=>{
  const mission={mode:'extract',goal:{x:8,z:35},radius:5,points:[],escorts:['column']};
  const w=field({chapter:8,mission,actors:[{...ARENA.hero,at:[12,35]},{id:'column',name:'Household column',side:'neutral',role:'escort',kit:['tunic'],at:[42,35]}]});
  const interceptor=w.squads.find(s=>w.doctrine.roles[s.id]==='Intercept the column');assert.ok(interceptor);decideSquad(w,interceptor);assert.equal(interceptor.plan.targetId,'column');assert.match(interceptor.plan.intent,/route to safety/);
  const capture=field({chapter:4,mission:{...mission,mode:'capture',goal:{x:45,z:35},points:[{x:45,z:35,secured:false}],escorts:[]}});
  const defender=capture.squads.find(s=>capture.doctrine.roles[s.id]==='Contest the objective');assert.ok(defender);decideSquad(capture,defender);assert.match(defender.plan.intent,/mission ground/);
});

test('Adaptation and mounted movement resume exactly, and rejected commands do not consume a stream',()=>{
  const a=field(),before=worldHash(a);assert.equal(queueCommand(a,{actorId:'missing',kind:'attack',payload:{targetId:'line'}}).ok,false);assert.equal(worldHash(a),before);
  for(let i=0;i<117;i++)step(a);const b=restoreWorld(snapshotWorld(a));
  for(let i=0;i<450;i++){step(a);step(b);}assert.equal(worldHash(a),worldHash(b));
  assert.doesNotThrow(()=>validateWorld(a,message=>{throw Error(message);}));
  const cavalry=field({squads:[roman('horse',[20,35],{role:'cavalry',member:ROMAN_SQUADS.cavalry}),roman('foot',[20,45])]});
  const horse=squadById(cavalry,'horse'),foot=squadById(cavalry,'foot');horse.gait=foot.gait='run';
  assert.ok(squadSpeed(cavalry,horse)>squadSpeed(cavalry,foot)*1.3);assert.ok(membersOf(cavalry,horse).every(a=>a.mounted));
});

test('Regional support roles substitute an existing ally, retain strength and source records, and use valid saved kit',()=>{
  assert.equal(new Set(TACTICAL_IDENTITIES.map(x=>x.id)).size,12);
  for(const chapter of [4,5,7,8,9,10,12]){
    const ch=CHAPTERS.find(c=>c.id===chapter),data=ch.encounters.find(e=>e.kind==='battle');if(!data)continue;
    const state=G.newGame('Support fixture',275,{featureEdition:35,progression:true});state.chapter=chapter;state.encounterIndex=ch.encounters.indexOf(data);state.encounter=createBattle(state,data,{});
    const expected=[7,9,12].includes(chapter)?'cavalry':'engineer',before=JSON.stringify(state.encounter),world=createEncounterWorld(state);
    const support=world.squads.find(s=>s.side==='ally'&&s.role===expected);assert.ok(support,`Chapter ${chapter}: ${expected}`);
    const token=state.encounter.units.find(u=>u.id===support.unitId);assert.equal(support.maxStrength,token.maxHp);assert.equal(support.strength,token.hp);
    assert.equal(JSON.stringify(state.encounter),before);assert.doesNotThrow(()=>validateWorld(world,message=>{throw Error(message);}));
    if(expected==='cavalry'){assert.ok(membersOf(world,support).every(a=>a.mounted));assert.equal(support.maxMen,4);}
    else assert.equal(support.maxMen,6);
  }
  const original={id:'bow',side:'ally',role:'archer',hp:16};assert.equal(realtimeAlliedRole(9,{units:[original]},original),'archer');
});
