import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {createWorld,queueCommand,restoreWorld,snapshotWorld,step,worldHash,WORLD_VERSION} from '../src/core/realtime/simulation.js';
import {validateWorld} from '../src/core/realtime/validate.js';
import {deploying,soundTheAdvance} from '../src/core/realtime/deployment.js';
import {checkBattle} from '../src/core/battle.js';
import {convoyStep} from '../src/core/operations.js';
import {difficultyRule} from '../src/core/campaign-options.js';
import {climbersBeaten,fallBack,farBankVolley,lureMet,worksRound,worksSecured} from '../src/core/realtime/field-missions.js';
import {decideSquad,carryOut} from '../src/core/realtime/squad-ai.js';
import {squadById,squadCentre} from '../src/core/realtime/squads.js';
import {cardButtons,cardOrder,squadOrderOptions} from '../src/core/realtime/order-intents.js';
import {span} from '../src/core/realtime/navigation.js';
import {missionOperationDefinition,MISSION_OPPORTUNITIES} from '../src/data/mission-operations.js';
import {BATTLE_OPERATIONS} from '../src/data/battle-operations.js';
import {EXCHANGE,HORSE_ORDERS,ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {ARCHETYPES} from '../src/data/realtime-forces.js';
import {ARENA,FAR_BANK,TIME} from '../src/data/realtime-rules.js';
import {STRUCTURES} from '../src/data/structures.js';

// Release 7's missions (data/mission-operations.js; worlds and gameplay plan): version 3 of
// the operations for campaigns begun with them, in both paths; the siege works, the lure,
// the convoy, the fallback lines and the far bank's volleys; the horse's two orders; each
// battle's own opportunity pair. Camp checkpoints are reached from New Game by legal
// commands (the command campaign); a test that sets up a field by hand says so.

const R=TIME.roundTicks;
const MISSIONS=['ch4-gate','ch5-wall','ch6-wells','ch8-crossing','ch9-wing','ch10-road'];
const camps=new Map();
// Each re-authored battle's camp checkpoint, reached legally once: Chapter VI's with Varro left to his orders when asked.
function camp(id,{obey=false}={}){
  const key=`${id}${obey?':obey':''}`;
  if(!camps.has(key)){
    const stop=new Error('reached'),want=new Set(MISSIONS.map(m=>`${m}${obey?':obey':''}`));
    try{runCommandCampaign({featureEdition:35,missions:true,beforeCamp(s){if(obey&&s.chapter===6&&!s.decisions.ch6)assert.ok(G.choose(s,'obey').ok);},
      onCheckpoint(s){const data=G.getChapter(s).encounters[s.encounterIndex],k=`${data?.id}${obey?':obey':''}`;
        if(want.has(k)&&!camps.has(k))camps.set(k,G.serialize(s));if([...want].every(x=>camps.has(x)))throw stop;}});}
    catch(error){if(error!==stop)throw error;}
  }
  return G.deserialize(camps.get(key));
}
const turnBased=(id,options={})=>{const s=camp(id,options);assert.ok(G.startEncounter(s).ok);return s;};
function realtime(id,{advance=true,...options}={}){
  const s=camp(id,options);assert.ok(G.startEncounter(s,{controls:'realtime'}).ok);const world=G.realtimeWorld(s);
  if(advance&&deploying(world))soundTheAdvance(world);return {state:s,world};
}
const fail=message=>{throw new Error(message);};

test('New Game with the missions plays version 3 of the six re-authored battles, and a campaign begun before them keeps versions 1 and 2',()=>{
  for(const id of MISSIONS){
    const s=turnBased(id),e=s.encounter,spec=missionOperationDefinition(id,e.operation.branch??null);
    assert.equal(s.missionsVersion,1);assert.equal(e.missionsVersion,1);assert.equal(e.operation.version,3,id);
    assert.equal(e.mission.mode,spec.phases[0].mode,`${id}: the first phase is the mission's`);
    assert.doesNotThrow(()=>G.deserialize(G.serialize(s)),`${id}: the battle saves and loads`);
  }
  // The same battle from a campaign begun without the missions.
  const old=G.newGame('Before the missions',275,{featureEdition:35,progression:true});
  assert.equal(old.missionsVersion,undefined);
  const stop=new Error('reached');let state=null;
  try{runCommandCampaign({featureEdition:35,onCheckpoint(s){if(G.getChapter(s).encounters[s.encounterIndex]?.id==='ch5-wall'){state=G.deserialize(G.serialize(s));throw stop;}}});}
  catch(error){if(error!==stop)throw error;}
  // Before the missions Chapter V's wall had no operation phases: it was held for five rounds.
  assert.equal(BATTLE_OPERATIONS['ch5-wall'],undefined);
  assert.ok(G.startEncounter(state).ok);
  assert.equal(state.encounter.operation,undefined);assert.equal(state.encounter.missionsVersion,undefined);assert.equal(state.encounter.mission.mode,'hold');
  // A save claiming the missions where its battle does not, or the reverse, is refused.
  const s=turnBased('ch5-wall'),json=JSON.parse(G.serialize(s));
  assert.throws(()=>G.deserialize(JSON.stringify({...json,missionsVersion:2})));
  const mixed=structuredClone(json);delete mixed.encounter.missionsVersion;assert.throws(()=>G.deserialize(JSON.stringify(mixed)));
});

test('turn-based escalade: climbers hold each ladder\'s head, the line pays the pressure at each turn\'s end while a ladder stands, and beaten climbers lose their ladder',()=>{
  const s=turnBased('ch4-gate'),e=s.encounter;
  for(const id of ['ladder-north','ladder-south']){const u=e.units.find(x=>x.id===`${id}-climbers`);assert.ok(u,id);assert.equal(u.side,'enemy');assert.equal(u.hp,4);assert.equal(u.works,id);}
  const before=e.defence;assert.ok(G.endTurn(s).ok);
  assert.ok(e.log.some(l=>/siege works still stand/.test(l)));
  assert.equal(e.defence,before-difficultyRule(e).pressure,'the works cost the pressure, no more');
  // Injected: the company off the field but for the soldier, four tiles from either ladder's head, so no point can be
  // held; and the climbers of each ladder still standing struck down. Their ladders fall at the turn's end, before the
  // works are counted, so the line pays nothing more.
  const works=missionOperationDefinition('ch4-gate').phases[0].works,standing=works.filter((w,i)=>!e.mission.points[i].secured);
  assert.ok(standing.length,'a ladder still stands after the first turn');
  e.units=e.units.filter(u=>u.side!=='ally');
  for(const w of standing)e.units.find(u=>u.id===`${w.id}-climbers`).hp=0;
  const line=e.defence,from=e.log.length;assert.ok(G.endTurn(s).ok);
  for(const w of standing)assert.ok(e.log.slice(from).some(l=>l.includes(`The ladder at ${w.at[0]+1}${String.fromCharCode(65+w.at[1])} is thrown down.`)),w.id);
  assert.equal(e.operation.index,1,'both ladders down: the rear files come out');
  assert.ok(!e.log.slice(from).some(l=>/siege works still stand/.test(l)));assert.equal(e.defence,line,'no work stands at the turn\'s end');
});

test('turn-based feigned retreat: the phase ends when the armoured horse reaches the marker, or when none of it is left (injected positions)',()=>{
  for(const way of ['marker','broken']){
    const s=turnBased('ch9-wing'),e=s.encounter,horse=e.units.filter(u=>u.side==='enemy'&&u.role==='cavalry');assert.ok(horse.length);
    checkBattle(s);assert.equal(e.operation.index,0,'the riders are far from the marker');
    // Injected: one rider set beside the marker, or every rider struck down.
    if(way==='marker'){const free=[[0,0],[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:e.goal.x+dx,y:e.goal.y+dy})).find(p=>!e.units.some(u=>u.hp>0&&u.x===p.x&&u.y===p.y));Object.assign(horse[0],free);}
    else for(const u of horse)u.hp=0;
    checkBattle(s);assert.equal(e.operation.index,1,way);
  }
});

test('the turn-based convoy walks its road leg by leg, goes around anyone in it, halts beside an enemy and never steps next to one (labelled field)',()=>{
  // A labelled field: the relief convoy's north road (Chapter X's map), the wagons at its east end.
  const map=['...~....','...f====','...~..^.','sss~....','===f====','...~....','...f====','...~....'];
  const terrain=map.map(r=>[...r].map(k=>({'~':'river',f:'ford','=':'road','^':'high',s:'stone'})[k]??'grass'));
  const wagons={id:'convoy',side:'neutral',role:'escort',x:7,y:1,hp:24,escorted:true,move:2};
  const e={width:8,height:8,terrain,units:[wagons]},route=[[5,1],[3,1],[2,3]];
  const seen=[];for(let i=0;i<6&&!(wagons.x===2&&wagons.y===3);i++){convoyStep(e,wagons,route);seen.push(`${wagons.x},${wagons.y}`);}
  assert.equal(`${wagons.x},${wagons.y}`,'2,3','the wagons reach the stores');
  assert.ok(seen.includes('3,1'),'by the ford, not across the river');assert.equal(wagons.convoyLeg,2);
  // Someone in the road: the wagons go around him.
  const blocked={...wagons,x:3,y:1,convoyLeg:2},man={id:'hero',side:'player',x:2,y:2,hp:20},f2={...e,units:[blocked,man]};
  convoyStep(f2,blocked,route);assert.notEqual(`${blocked.x},${blocked.y}`,'3,1','he does not stop the wagons');assert.ok(blocked.x!==2||blocked.y!==2);
  // An enemy beside them: they halt; an enemy near the road: they never step next to him.
  const halted={...wagons,x:5,y:1},raider={id:'raider',side:'enemy',x:5,y:0,hp:7},f3={...e,units:[halted,raider]};
  convoyStep(f3,halted,route);assert.equal(`${halted.x},${halted.y}`,'5,1');
  const walker={...wagons,x:7,y:1},watcher={id:'raider',side:'enemy',x:5,y:0,hp:7},f4={...e,units:[walker,watcher]};
  convoyStep(f4,walker,route);assert.ok(Math.abs(walker.x-5)+Math.abs(walker.y-0)>1,'never beside an enemy');
});

test('real time: the ram batters the barred river gate and the line pays the pressure until its ground is held; then it burns',()=>{
  const {world:w}=realtime('ch5-wall'),m=w.mission;
  const ram=w.objects.find(o=>o.id==='ram'),gate=w.objects.find(o=>o.id==='ram-gate');
  assert.equal(ram.kind,'ram');assert.equal(ram.state,'active');assert.equal(ram.name,'Persian ram');
  assert.equal(gate.kind,'gate');assert.equal(gate.state,'closed');assert.equal(gate.holder,'ally');assert.equal(gate.integrity,STRUCTURES.gate.integrity+STRUCTURES.gate.bar);
  for(const [x,y]of gate.cells)assert.equal(w.map.terrain[y][x],'wall','the shut gate closes its road');
  validateWorld(w,fail);
  const defence=m.defence;worksRound(w);
  assert.equal(gate.integrity,STRUCTURES.gate.integrity+STRUCTURES.gate.bar-STRUCTURES.gate.batter*STRUCTURES.gate.ram);assert.equal(m.defence,defence-m.pressure);
  // The ram's ground held (its point secured, as missionTick finds it): it burns, and the works cost nothing more.
  m.points[0].secured=true;worksSecured(w,0);assert.equal(ram.state,'burnt');assert.equal(ram.done,true);
  const after=m.defence,integrity=gate.integrity;worksRound(w);assert.equal(m.defence,after);assert.equal(gate.integrity,integrity);
  validateWorld(w,fail);
});

test('real time: the ladders stand against the wall and their climbers hold the wall walk at each head; beaten, they lose their ladder',()=>{
  const {world:w}=realtime('ch4-gate');
  for(const id of ['ladder-north','ladder-south']){
    const ladder=w.objects.find(o=>o.id===id),climbers=w.squads.find(q=>q.unitId===`${id}-climbers`);
    assert.equal(ladder.kind,'ladder');assert.equal(ladder.state,'raised');assert.equal(ladder.field,true);
    assert.ok(climbers,`${id}: its climbers`);assert.equal(climbers.side,'enemy');assert.equal(climbers.name,'Gothic climbers');
    const i=w.mission.works.findIndex(x=>x.id===id),p=w.mission.points[i],c=squadCentre(w,climbers);
    assert.ok(span(c.x-p.x,c.z-p.z)<=w.mission.radius,'at the head of its ladder');
    assert.equal(climbers.holds,true,'they hold the head as a guard holds his approach');assert.equal(climbersBeaten(w,i),false);
  }
  // Injected: the north ladder's climbers broken while our men are still far off; at the next tick their ladder is thrown down.
  w.squads.find(q=>q.unitId==='ladder-north-climbers').broken=true;assert.equal(climbersBeaten(w,0),true);
  step(w);assert.equal(w.mission.points[0].secured,true);assert.equal(w.objects.find(o=>o.id==='ladder-north').state,'thrown');
  assert.equal(w.mission.points[1].secured,false,'the south ladder still stands');
  validateWorld(w,fail);
  const south=w.squads.find(q=>q.unitId==='ladder-south-climbers');decideSquad(w,south);assert.equal(south.plan.intent,'Guard this approach.');
});

test('real time: the armoured horse keeps its ground until a feigned retreat draws it out; the pursuers are strung out when the horse turns',()=>{
  const {world:w}=realtime('ch9-wing'),lure=w.mission.lure;assert.equal(lure,'cavalry');
  const enemyHorse=w.squads.filter(q=>q.side==='enemy'&&HORSE_ORDERS.roles.includes(q.role)),ours=w.squads.find(q=>q.side!=='enemy'&&HORSE_ORDERS.roles.includes(q.role));
  assert.ok(enemyHorse.length&&ours,'horse on both sides');
  for(let t=0;t<20;t++)step(w);
  for(const q of enemyHorse)assert.equal(q.plan?.intent,'Wait for an opening.','held back while no one comes near');
  assert.equal(lureMet(w),false);
  assert.ok(queueCommand(w,{actorId:w.heroId,kind:'order',payload:{squads:[ours.id],order:{kind:'feigned_retreat'}}}).ok);
  const seen=new Set(),drawn=new Map();
  for(let t=0;t<14*R&&w.status==='active'&&!seen.has('strung-out');t++){
    for(const e of step(w)){seen.add(e.kind);if(e.kind==='drawn')drawn.set(e.squadId,squadById(w,e.squadId).cohesion);
      if(e.kind==='strung-out')assert.ok(e.cohesion<drawn.get(e.squadId),'strung out costs cohesion');}
  }
  assert.ok(seen.has('drawn'),'the enemy horse gives chase');assert.ok(seen.has('strung-out'),'and is strung out when ours turn');
  assert.ok(enemyHorse.every(q=>!q.drawnBy),'the chase is over once they turn');
});

test('the horse\'s orders: horse only, on keys 8 and 9 of its card and in its Command list; a charge from close range wheels away first (labelled field)',()=>{
  // A labelled small field: one squad of horse, one of foot, a Palmyrene band of horse.
  const grass={id:'open',width:40,height:24,terrain:Array.from({length:24},()=>Array(40).fill('grass'))};
  const rider=ARCHETYPES.palmyrene.cavalry[0];
  const w=createWorld({map:grass,seed:4,command:4,chapter:9,
    actors:[{id:'hero',name:'Hero',side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2},at:[6,30],face:[1,0]}],
    squads:[{id:'horse',name:'First horse',side:'ally',role:'cavalry',strength:16,maxStrength:16,damage:3,at:[40,30],face:[1,0],member:{name:'Roman cavalryman',...ROMAN_SQUADS.cavalry},standing:[['hold_line',null]]},
      {id:'foot',name:'First squad',side:'ally',role:'infantry',strength:16,maxStrength:16,damage:3,at:[14,40],face:[1,0],member:{name:'Legionary',...ROMAN_SQUADS.infantry},standing:[['hold_line',null]]},
      {id:'cataphracts',name:'Palmyrene horse',side:'enemy',role:'cavalry',strength:10,maxStrength:10,damage:4,at:[50,30],face:[-1,0],anchor:[50,30],
        member:{name:'Palmyrene cataphract',attributes:rider.attributes,kit:rider.kit,mounted:true}}]});
  assert.equal(cardOrder(w,['foot'],7).reason,'NOT_HORSE');assert.equal(cardOrder(w,['foot'],8).reason,'NOT_HORSE');
  assert.deepEqual(cardButtons(w,['foot']).map(b=>b.key),[1,2,3,4,5,6,7],'foot see the card of seven');
  assert.deepEqual(cardButtons(w,['horse']).filter(b=>b.key>7).map(b=>[b.key,b.kind]),[[8,'charge'],[9,'feigned_retreat']]);
  const charge=cardOrder(w,['horse'],7);assert.deepEqual(charge.command.payload.order,{kind:'charge',targetId:'cataphracts'},'the nearest enemy group');
  const list=squadOrderOptions(w,{squadId:'horse'});
  assert.ok(list.some(o=>o.command?.payload.order.kind==='charge'&&o.command.payload.order.targetId==='cataphracts'));
  assert.ok(list.some(o=>o.command?.payload.order.kind==='feigned_retreat'));
  assert.ok(!squadOrderOptions(w,{squadId:'foot'}).some(o=>['charge','feigned_retreat'].includes(o.command?.payload.order.kind??o.label)),'nothing for foot');
  // Ten metres from its target, inside the run-up a charge needs: the squad wheels away first.
  const horse=squadById(w,'horse');assert.ok(span(squadCentre(w,horse).x-50,squadCentre(w,horse).z-30)<EXCHANGE.chargeRun);
  carryOut(w,horse,{kind:'charge',targetId:'cataphracts'});decideSquad(w,horse);
  assert.match(horse.plan.intent,/^Wheel away for the run-up/);assert.ok(horse.order.back,'a place to wheel to');
});

test('real time: the far bank\'s archers strike the group of ours most exposed in the water or on the landing at a round\'s end, until the enemy\'s archers are beaten (injected positions)',()=>{
  const {world:w}=realtime('ch8-crossing'),m=w.mission;assert.equal(m.fire,true);
  // Injected: the soldier set down on the landing, alone there.
  const hero=w.actors.find(a=>a.id===w.heroId);Object.assign(hero,{x:m.goal.x,z:m.goal.z});
  const hp=hero.hp;w.events=[];farBankVolley(w);
  assert.equal(hero.hp,hp-FAR_BANK.single);assert.ok(w.events.some(e=>e.kind==='burn'&&e.cause==='arrows'));
  // Injected: a squad's men beside him; the volley strikes the squad, not him.
  const squad=w.squads.find(q=>q.side!=='enemy'),strength=squad.strength,at=hero.hp;
  for(const id of squad.members){const a=w.actors.find(x=>x.id===id);Object.assign(a,{x:m.goal.x+.5,z:m.goal.z+.5});}
  farBankVolley(w);assert.equal(squad.strength,strength-FAR_BANK.squad);assert.equal(hero.hp,at,'one group a volley');
  for(const q of w.squads.filter(q=>q.side==='enemy'&&q.role==='archer'))for(const id of q.members)w.actors.find(a=>a.id===id).alive=false;
  const now=hero.hp;farBankVolley(w);assert.equal(hero.hp,now,'no archers, no volley');
});

test('real time: a convoy walks its road on its own, leg by leg, with no one beside it',()=>{
  const {world:w}=realtime('ch6-wells',{obey:true}),m=w.mission;assert.ok(m.convoy?.length);
  const bearer=w.actors.find(a=>m.escorts.includes(a.id)),start={x:bearer.x,z:bearer.z};assert.equal(bearer.escort.escorted,true);
  for(let t=0;t<3*R&&w.status==='active';t++)step(w);
  assert.ok(span(bearer.x-start.x,bearer.z-start.z)>4,'the column walks on its own');assert.ok(Number.isInteger(bearer.convoyLeg));
  validateWorld(w,fail);
  const bad=JSON.parse(snapshotWorld(w));bad.actors.find(a=>a.id===bearer.id).convoyLeg=99;assert.throws(()=>validateWorld(bad,fail));
});

test('real time: squads holding a line by order fall back to the next when it is given up',()=>{
  const {world:w}=realtime('ch6-wells',{obey:true}),m=w.mission,ours=w.squads.filter(q=>q.side!=='enemy');
  for(const q of ours)q.order={kind:'hold',since:w.tick};
  // Ours stand at the first line (injected): the squads' centres on its marker.
  const next=m.phaseMissions[1].goal;fallBack(w,squadCentre(w,ours[0]),next);
  const moved=ours.filter(q=>q.order.kind==='advance');assert.ok(moved.length>=1);
  for(const q of moved){assert.equal(q.order.x,next.x);assert.equal(q.order.from,'lines');}
  assert.ok(w.events.some(e=>e.kind==='fall-back'));
});

test('each re-authored battle has its own opportunity pair; a crossing deploys on its own bank',()=>{
  for(const id of MISSIONS){
    const s=camp(id),briefing=G.commandBriefing(s);
    assert.deepEqual(briefing.opportunities.map(o=>o.label),MISSION_OPPORTUNITIES[id].map(o=>o.label),id);
    assert.ok(G.startEncounter(s).ok);
    assert.deepEqual(['stores','signal'].map(k=>s.encounter.field.objects.find(o=>o.id===k)?.label),MISSION_OPPORTUNITIES[id].map(o=>o.label),`${id}: the field's labels`);
  }
  const {world:w}=realtime('ch8-crossing',{advance:false});assert.ok(deploying(w));
  assert.equal(w.deployment.zone.x1,(w.layout.kx[0]+w.layout.kx[1])*2.5,'two tiles: the near bank');
});

test('a version 3 battle\'s world saves, restores and validates exactly; the world version is 6',()=>{
  assert.equal(WORLD_VERSION,6);
  for(const id of ['ch4-gate','ch5-wall','ch9-wing']){
    const {world:w}=realtime(id);for(let t=0;t<R;t++)step(w);
    validateWorld(w,fail);const copy=restoreWorld(snapshotWorld(w));assert.equal(worldHash(copy),worldHash(w),id);
    for(let t=0;t<40;t++){step(w);step(copy);}assert.equal(worldHash(copy),worldHash(w),`${id} plays on alike`);
  }
  const {world:w}=realtime('ch5-wall'),bad=JSON.parse(snapshotWorld(w));bad.objects.find(o=>o.id==='ram').state='melted';
  assert.throws(()=>validateWorld(bad,fail));
});
