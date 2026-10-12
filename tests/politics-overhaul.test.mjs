import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Game from '../src/core/game.js';
import {argumentForecast,contestIntents,politicalPosition,speechStrength} from '../src/core/contest.js';
import {reachable,distance} from '../src/core/shared.js';
import {politicalFixture,runPoliticalDiagnostics} from '../scripts/political-diagnostics.mjs';
const copy=structuredClone;
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
const fixture=()=>politicalFixture(11,'ch11-accounts');
const payload=(unit,action,target)=>({unitId:unit.id,action,x:target.x,y:target.y,targetId:target.id??target.unitId});

test('Bloc affinity and nearby allied cooperation produce different but bounded argument strengths',()=>{
  const state=fixture(),hero=state.encounter.units[0],member={interest:'service',bloc:'Veterans'};
  assert.equal(speechStrength(state,'record',member),5);assert.equal(speechStrength(state,'record',{...member,bloc:'Civic'}),4);
  assert.equal(speechStrength(state,'threaten',{interest:'law',bloc:'Civic'}),1,'resistance cannot make an argument zero or reverse it');
  assert.equal(politicalPosition(state,hero.id).persuadeBonus,1);const joined=speechStrength(state,'persuade',member,hero);
  const separate=copy(state);Object.assign(separate.encounter.units.find(u=>u.id==='speaker-ally'),{x:0,y:7});assert.equal(speechStrength(separate,'persuade',member,separate.encounter.units[0]),joined-1);
  const withdrawn=copy(state);withdrawn.encounter.units.find(u=>u.id==='speaker-ally').resolve=0;assert.equal(politicalPosition(withdrawn,hero.id).persuadeBonus,0);
});

test('Every currently legal argument applies its exact forecast including commitment, caps and Threaten backlash',()=>{
  const state=fixture(),hero=state.encounter.units[0];state.encounter.units.filter(u=>u.role==='voter').forEach((u,i)=>u.stance=[-6,-3,0,1,3,6][i%6]);
  let checked=0;
  for(const action of Game.getActions(state,hero.id).filter(a=>a!=='move'))for(const target of Game.getTargets(state,hero.id,action)){
    const trial=copy(state),unit=trial.encounter.units[0],command=payload(unit,action,target),before=copy(trial),preview=Game.preview(trial,command);
    assert.ok(preview.ok);assert.deepEqual(trial,before,'preview leaves state and RNG unchanged');assert.ok(preview.forecast);
    const frozen=freeze(copy(trial));assert.doesNotThrow(()=>argumentForecast(frozen,frozen.encounter.units[0],action,frozen.encounter.units.find(u=>u.id===target.unitId)));
    assert.ok(Game.act(trial,command).ok);
    for(const change of preview.forecast.stanceChanges)assert.equal(trial.encounter.units.find(u=>u.id===change.id).stance,change.to);
    for(const change of preview.forecast.resolveChanges)assert.equal(trial.encounter.units.find(u=>u.id===change.id).resolve,change.to);
    assert.equal(Game.voteCount(trial).for,preview.forecast.votesAfter);assert.equal(trial.encounter.staged.meters.public,0-preview.forecast.publicCost);checked++;
  }
  assert.ok(checked>=8);
});

test('Material promises show three supplies, stage once, retain recipient and two-promise limits, and retry exactly',()=>{
  const state=politicalFixture(11,'ch11-adlection'),initial=copy(state.encounter),hero=state.encounter.units[0],members=state.encounter.units.filter(u=>u.role==='voter');
  // Labelled local rule positioning, independent of the legal-route diagnostics.
  const target=members.find(u=>u.interest==='office');Object.assign(hero,{x:target.x-1,y:target.y});
  const command=payload(hero,'promise',target),preview=Game.preview(state,command);assert.ok(preview.ok);assert.equal(preview.forecast.promise.cost,3);assert.match(preview.message,/Honour: 3 supplies/);
  assert.ok(Game.act(state,command).ok);assert.equal(state.encounter.staged.obligations[0].cost,3);assert.equal(state.obligations.some(o=>o.id===preview.forecast.promise.id),false);
  hero.acted=false;assert.equal(Game.preview(state,command).ok,false,'same recipient cannot be promised twice');
  const second=members.find(u=>u.id!==target.id);Object.assign(hero,{x:second.x-1,y:second.y});assert.ok(Game.act(state,payload(hero,'promise',second)).ok);hero.acted=false;
  assert.equal(Game.getTargets(state,hero.id,'promise').length,0);assert.equal(state.encounter.staged.obligations.length,2);
  assert.ok(Game.retry(state).ok);assert.deepEqual(state.encounter,initial);assert.equal(state.encounter.staged.obligations.length,0);
});

test('Public rival intents are pure, legal, sequential, and exactly match the next End Turn',()=>{
  for(const [chapter,id]of[[7,'ch7-council'],[8,'ch8-parley'],[11,'ch11-adlection'],[12,'ch12-legitimacy']]){
    const state=politicalFixture(chapter,id),before=copy(state),plans=contestIntents(freeze(copy(state)));assert.deepEqual(state,before);
    const simulation=copy(state.encounter);
    for(const plan of plans){const actor=simulation.units.find(u=>u.id===plan.unitId),target=simulation.units.find(u=>u.id===plan.targetId);assert.ok(distance(actor,plan.destination)===0||reachable(simulation,actor,3).some(p=>p.x===plan.destination.x&&p.y===plan.destination.y));
      Object.assign(actor,plan.destination);if(plan.action==='wait')continue;assert.ok(distance(actor,target)<=(plan.action==='lobby'?1:3));if(plan.action==='lobby')target.stance=plan.stanceAfter;else target.resolve=plan.resolveAfter;
    }
    assert.ok(Game.endTurn(state).ok);for(const unit of simulation.units){const actual=state.encounter.units.find(u=>u.id===unit.id);assert.equal(actual.x,unit.x);assert.equal(actual.y,unit.y);assert.equal(actual.stance,unit.stance);assert.equal(actual.resolve,unit.resolve);}assert.deepEqual(state.encounter.turnEvents,plans.map(p=>p.message));
  }
});

test('Rebut changes the visible next intervention and limits a rival speech without removing its vote',()=>{
  const state=fixture(),hero=state.encounter.units[0],rival=state.encounter.units.find(u=>u.side==='enemy');Object.assign(hero,{x:6,y:3});
  const command=payload(hero,'rebut',rival);assert.ok(Game.preview(state,command).ok);assert.ok(Game.act(state,command).ok);
  const plan=contestIntents(state).find(p=>p.unitId===rival.id);assert.equal(plan.amount,1);assert.match(plan.message,/Rebut/);const total=Game.voteCount(state).total;Game.endTurn(state);assert.equal(rival.blunted,false);assert.equal(Game.voteCount(state).total,total);
});

test('Lobbyists defend swing votes, prosecutors exploit withdrawal, and brokers contest promised support',()=>{
  // Injected local positions isolate strategy; full legal approaches are tested below.
  const state=fixture(),e=state.encounter,hero=e.units[0],ally=e.units[1],rival=e.units[2],members=e.units.filter(u=>u.role==='voter');
  e.units=[hero,ally,rival,members[0],members[1]];Object.assign(hero,{x:6,y:3,resolve:3});Object.assign(ally,{x:0,y:0});Object.assign(rival,{x:7,y:3});
  Object.assign(members[0],{x:5,y:3,stance:1});Object.assign(members[1],{x:5,y:4,stance:1});
  e.rivalStyle='lobby';const lobby=contestIntents(state)[0];assert.equal(lobby.action,'lobby');assert.equal(lobby.stanceAfter,-1);
  e.turn=3;assert.deepEqual(contestIntents(state)[0],lobby,'an unchanged public position keeps its plan instead of obeying turn parity');
  e.rivalStyle='prosecutor';const prosecutor=contestIntents(state)[0];assert.equal(prosecutor.action,'pressure');assert.equal(prosecutor.targetId,hero.id);assert.equal(prosecutor.resolveAfter,0);
  hero.resolve=12;e.rivalStyle='broker';e.promises=[members[1].id];const broker=contestIntents(state)[0];assert.equal(broker.targetId,members[1].id);assert.equal(broker.amount,3);
  e.promises=[];assert.equal(contestIntents(state)[0].amount,2,'extra broker pressure depends on an actual promise');
});

test('Political version two preserves deadline-only voting and withdrawal keeps the fixed denominator',()=>{
  const state=fixture(),e=state.encounter;e.units.filter(u=>u.role==='voter').forEach(u=>u.stance=6);e.units.filter(u=>u.side==='enemy').forEach(u=>{u.resolve=0;u.hp=0;});
  const tally=Game.voteCount(state);assert.equal(tally.total,13);assert.equal(tally.majority,7);assert.equal(tally.against,2);Game.endTurn(state);assert.equal(e.status,'active');
  e.requiredAbility=null;e.requiredAbilities=[];while(e.status==='active')Game.endTurn(state);assert.equal(e.status,'won');assert.equal(e.turn,e.turnLimit);
});

test('All six chambers support debt-free and promised approaches, including zero-meter Senate and legitimacy',()=>{
  const report=runPoliticalDiagnostics({versions:[2]});assert.equal(report.runs.length,24);for(const row of report.runs)assert.equal(row.status,'won',`${row.id} ${row.profile} ${row.approach}`);
  const senate=report.runs.filter(r=>r.chapter>=11);assert.ok(senate.filter(r=>r.approach==='debt-free arguments').every(r=>r.futureSupplyCost===0));assert.ok(senate.filter(r=>r.approach==='promised coalition').every(r=>r.obligations.length===2&&r.futureSupplyCost>=4));
});

test('Frozen v0.6 active chamber keeps its exact next turn and Retry under old rules',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./compatibility/authored-contest-06.json',import.meta.url),'utf8')),state=Game.deserialize(fixture.serialized);
  assert.equal(state.encounterOptions.politicsVersion,1);assert.equal(state.encounter.politicsVersion,undefined);Game.endTurn(state);assert.deepEqual(state.encounter,fixture.afterEndTurn);
  assert.ok(Game.retry(state).ok);assert.deepEqual(state.encounter,fixture.initialEncounter);
  const material=state.encounter.units.find(u=>u.interest==='grain');assert.equal(speechStrength(state,'promise',material),6);
});
