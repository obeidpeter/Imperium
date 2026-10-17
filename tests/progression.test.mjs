import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as G from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {playEncounter} from '../scripts/autoplay.mjs';
import {combatBreakdown} from '../src/core/battle.js';
import {PROGRESSION_OPERATIONS} from '../src/data/progression-operations.js';
import {BATTLE_OPERATIONS} from '../src/data/battle-operations.js';
import {applyOperationConsequences} from '../src/core/progression-operations.js';
const copy=x=>JSON.parse(JSON.stringify(x)),digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
const checkpoints=new Map(),alternateCheckpoints=new Map();
let primary,alternate;
function route(){return primary??=runProgressionCampaign({onCheckpoint:s=>checkpoints.set(G.getChapter(s).encounters[s.encounterIndex].id,copy(s))});}
function camp(id){route();return copy(checkpoints.get(id));}
function start(id){const s=camp(id);assert.ok(G.startEncounter(s).ok);return s;}
function inert(s,fn){const before=G.serialize(s),r=fn();assert.equal(r.ok,false,r.message);assert.equal(G.serialize(s),before);}

test('All 1,079 frozen v0.16 legal commands, every save/reload and all 25 retries remain byte-identical',async()=>{
  const f=JSON.parse(await readFile(new URL('./compatibility/campaign-v016-route.json',import.meta.url),'utf8')),s=G.deserialize(JSON.stringify(f.initial));
  assert.equal(s.progressionVersion,undefined);
  for(const [i,item]of f.trace.entries()){
    assert.ok(G[item.kind](s,...item.args).ok,`${i} ${item.kind}`);assert.equal(digest(s),item.sha256,`${i} ${item.kind}`);
    assert.equal(digest(G.deserialize(G.serialize(s))),item.sha256);
    if(item.kind==='startEncounter'){const retried=copy(s);assert.ok(G.retry(retried).ok);assert.equal(digest(retried),item.sha256);}
  }
  assert.equal(s.rank,'Augustus');
});

test('Two new legal full careers exercise all 22 operation alternatives, all three earned special actions, six agreements and exact retries',()=>{
  const a=route(),b=alternate??=runProgressionCampaign({alternate:true,onCheckpoint:s=>alternateCheckpoints.set(G.getChapter(s).encounters[s.encounterIndex].id,copy(s))});
  for(const r of [a,b]){
    assert.equal(r.rank,'Augustus');assert.equal(r.encounters.length,25);assert.ok(r.encounters.every(e=>e.status==='won'));
    assert.equal(r.checks.length,25);assert.ok(r.checks.every(x=>x.exactRetry));
    assert.deepEqual([...r.specialistActions].sort(),['guard','inspire','volley']);assert.equal(r.skills.length,5);assert.ok(r.skills.every(v=>v.service>=2&&v.chapter>=3));
    assert.equal(r.choices.length,11);assert.equal(r.agreements.length,6);assert.equal(new Set(r.agreements.map(a=>a.encounter)).size,6);
    assert.ok(r.operationResults.some(x=>x.outcome==='costly'));assert.ok(r.operationResults.every(x=>x.consumedBy));
    assert.equal(G.serialize(G.deserialize(G.serialize(r.state))),G.serialize(r.state));
  }
  for(const[id,options]of Object.entries(PROGRESSION_OPERATIONS))assert.deepEqual([a.choices.find(x=>x.encounter===id).id,b.choices.find(x=>x.encounter===id).id],options.map(x=>x.id));
  assert.notEqual(a.turns,b.turns);assert.notDeepEqual(a.state.progression.operationResults,b.state.progression.operationResults);
});

test('Operations do not edit v1 definitions; camp selection is pure until departure and rejects late/unknown choices',()=>{
  const before=JSON.stringify(BATTLE_OPERATIONS),s=camp('ch1-road'),supplies=s.supplies;
  const read=G.serialize(s);G.operationChoices(s);assert.equal(G.serialize(s),read);
  inert(s,()=>G.chooseOperation(s,'fabricated'));assert.ok(G.chooseOperation(s,'screen').ok);assert.equal(s.supplies,supplies);
  assert.ok(G.startEncounter(s).ok);assert.equal(s.encounter.operation.version,2);assert.equal(s.encounter.operation.branch,'screen');
  inert(s,()=>G.chooseOperation(s,'pursue'));assert.equal(playEncounter(s).status,'won');assert.equal(s.encounter.mission.mode,'capture');assert.equal(s.encounter.goal.x,0);
  assert.equal(JSON.stringify(BATTLE_OPERATIONS),before);
});

test('Earned veteran paths are permanent, old campaigns expose no training, and invalid choices cannot spend or mutate',()=>{
  const fresh=G.newGame('Recruit',275,{progression:true});inert(fresh,()=>G.specializeVeteran(fresh,'lucan','protector'));
  const legacy=G.newGame();assert.equal(G.veteranTraining(legacy).enabled,false);inert(legacy,()=>G.specializeVeteran(legacy,'lucan','protector'));
  const s=camp('ch5-mine');assert.equal(s.progression.specializations.naso,'leader');inert(s,()=>G.specializeVeteran(s,'naso','protector'));inert(s,()=>G.specializeVeteran(s,'missing','ranged'));
  const e=start('ch5-mine');inert(e,()=>G.specializeVeteran(e,'firmus','ranged'));
});

test('Protector guard previews exact mitigation, consumes one command and turn, does not stack, and expires at the next round',()=>{
  const s=start('ch5-mine'),e=s.encounter,u=e.units.find(x=>x.specialization==='protector'),hero=e.units.find(x=>x.id==='hero'),enemy=e.units.find(x=>x.side==='enemy');
  // Isolated position fixture from a legally earned deployment: test geometry,
  // spending and damage directly; no win or campaign progression is injected.
  u.x=1;u.y=3;hero.x=0;hero.y=3;enemy.x=0;enemy.y=4;enemy.damage=8;hero.facing='north';
  const c={unitId:u.id,action:'guard',x:hero.x,y:hero.y,targetId:hero.id},prior=digest(s),base=combatBreakdown(e,enemy,hero).damage;
  assert.ok(G.preview(s,c).ok);assert.equal(digest(s),prior);const commands=e.commandsLeft;assert.ok(G.act(s,c).ok);
  assert.equal(combatBreakdown(e,enemy,hero).damage,base-2);assert.equal(e.commandsLeft,commands-1);assert.ok(u.acted&&u.moved&&u.ordered&&u.braced);
  inert(s,()=>G.act(s,c));assert.ok(G.endTurn(s).ok);assert.equal(u.guardTargetId,undefined);
});

test('Leader capacity does not stack and Inspire respects range, action limits and explicit health trade-off',()=>{
  const s=start('ch9-wing'),e=s.encounter,leaders=e.units.filter(u=>u.specialization==='leader');assert.equal(leaders.length,2);assert.equal(e.commandCapacity,7);
  const leader=leaders[0],near=e.units.find(u=>u.id==='hero'),far=leaders[1];leader.x=0;leader.y=3;near.x=1;near.y=3;far.x=7;far.y=7;near.morale=40;far.morale=40;
  assert.ok(leader.maxHp<18);const c={unitId:leader.id,action:'inspire',x:leader.x,y:leader.y,targetId:leader.id},before=digest(s);assert.ok(G.preview(s,c).ok);assert.equal(digest(s),before);assert.ok(G.act(s,c).ok);
  assert.equal(near.morale,55);assert.equal(far.morale,40);assert.equal(near.braced,true);inert(s,()=>G.act(s,c));
});

test('Ranged specialization has two real volleys, exact preview damage and target/line-of-sight enforcement',()=>{
  const s=start('ch5-mine'),e=s.encounter,u=e.units.find(x=>x.specialization==='ranged'),target=e.units.find(x=>x.side==='enemy');u.x=0;u.y=0;target.x=4;target.y=0;target.hp=target.maxHp=30;
  for(let x=0;x<5;x++)e.terrain[0][x]='grass';
  const c={unitId:u.id,action:'volley',x:target.x,y:target.y,targetId:target.id},damage=combatBreakdown(e,u,target,true).damage,prior=digest(s);
  assert.ok(G.preview(s,c).ok);assert.equal(digest(s),prior);assert.ok(G.act(s,c).ok);assert.equal(target.hp,30-damage);assert.equal(u.specialistAmmo,1);inert(s,()=>G.act(s,c));
  u.acted=u.moved=u.ordered=false;e.commandsLeft=2;e.terrain[0][2]='wall';inert(s,()=>G.act(s,c));e.terrain[0][2]='grass';assert.ok(G.act(s,c).ok);assert.equal(u.specialistAmmo,0);
  u.acted=u.moved=u.ordered=false;assert.ok(!G.getActions(s,u.id).includes('volley'));inert(s,()=>G.act(s,c));
});

test('Named negotiators recur in all six chambers; fulfilled agreements produce actual later starting stance changes',()=>{
  const ids=['ch7-council','ch8-parley','ch10-tribunal','ch11-accounts','ch11-adlection','ch12-legitimacy'],names=[];
  for(const id of ids){const s=start(id);names.push(s.encounter.units.filter(u=>u.negotiatorId).map(u=>[u.negotiatorId,u.name]));}
  for(const list of names)assert.deepEqual(list,names[0]);
  if(!alternate)alternate=runProgressionCampaign({alternate:true,onCheckpoint:s=>alternateCheckpoints.set(G.getChapter(s).encounters[s.encounterIndex].id,copy(s))});
  const honoured=copy(alternateCheckpoints.get('ch10-tribunal')),neutral=copy(honoured);assert.ok(G.startEncounter(honoured).ok);const person='valens';assert.ok(honoured.progression.negotiators[person].fulfilled>0);
  // Counterfactual relationship-only fixture isolates the documented effect.
  neutral.progression.negotiators[person].trust--;assert.ok(G.startEncounter(neutral).ok);
  const unit=s=>s.encounter.units.find(u=>u.negotiatorId===person);assert.equal(unit(honoured).stance-unit(neutral).stance,1);
});

test('Agreement preview is inert; speech/duplicate limits apply; Retry discards staged agreements without changing relationships',()=>{
  const s=start('ch7-council'),initial=G.serialize(s),target=s.encounter.units.find(u=>G.agreementOptions(s,u.id).enabled);assert.ok(target);
  const before=digest(s);assert.ok(G.previewAgreement(s,target.id,'demand').ok);assert.equal(digest(s),before);inert(s,()=>G.negotiateAgreement(s,target.id,'unknown'));
  assert.ok(G.negotiateAgreement(s,target.id,'counteroffer').ok);assert.equal(s.encounter.units.find(u=>u.id==='hero').acted,true);assert.equal(s.progression.agreements.length,0);assert.equal(s.encounter.staged.agreements[0].cost,1);
  inert(s,()=>G.negotiateAgreement(s,target.id,'demand'));assert.ok(G.retry(s).ok);assert.equal(G.serialize(s),initial);
});

test('Agreement settlement checks due date, affordability and single payment; breaking alters later trust and public confidence',()=>{
  const s=start('ch7-council'),target=s.encounter.units.find(u=>G.agreementOptions(s,u.id).enabled);assert.ok(G.negotiateAgreement(s,target.id,'demand').ok);assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);
  const a=s.progression.agreements[0];inert(s,()=>G.settleAgreement(s,a.id,true));assert.ok(G.startEncounter(s).ok);assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);assert.ok(G.advanceChapter(s).ok);
  const low=copy(s);low.supplies=0;inert(low,()=>G.settleAgreement(low,a.id,true));const pub=low.meters.public;assert.ok(G.settleAgreement(low,a.id,false).ok);assert.equal(low.progression.negotiators[a.personId].trust,-2);assert.equal(low.meters.public,Math.max(0,pub-3));inert(low,()=>G.settleAgreement(low,a.id,false));
  s.supplies=3; // Isolated treasury fixture: verify exact payment independently of the route's spending policy.
  const supplies=s.supplies;assert.ok(G.settleAgreement(s,a.id,true).ok);assert.equal(s.supplies,supplies-3);assert.equal(s.progression.negotiators[a.personId].trust,2);inert(s,()=>G.settleAgreement(s,a.id,true));
});

test('Operation consequences alter a later field deployment once and are transactional across retries',()=>{
  const s=start('ch2-marsh'),hero=s.encounter.units.find(u=>u.id==='hero');assert.equal(hero.ammo,4);assert.deepEqual(s.encounter.appliedOperations,['ch1-road']);
  const initial=G.serialize(s);assert.ok(G.endTurn(s).ok);assert.ok(G.retry(s).ok);assert.equal(G.serialize(s),initial);
  assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);assert.equal(s.progression.operationResults[0].consumedBy,'ch2-marsh');assert.ok(G.startEncounter(s).ok);assert.equal(s.encounter.units.find(u=>u.id==='hero').ammo,3);
  // Explicit consequence fixtures exercise injured reserve restoration and
  // reinforcement timing without granting a campaign result.
  const reserve=camp('ch3-station'),e=copy(s.encounter);e.units.find(u=>u.side==='ally').hp=5;const hp=e.units.find(u=>u.side==='ally').hp;applyOperationConsequences(reserve,e);assert.equal(e.units.find(u=>u.side==='ally').hp,hp+2);
});

test('Malformed progression data, forged specializations and transaction versions are rejected without modifying the source save',()=>{
  const s=start('ch11-adlection'),before=G.serialize(s);
  const mutations=[x=>x.progressionVersion=2,x=>delete x.progression,x=>x.progression.specializations.naso='wizard',x=>x.progression.specializations.missing='leader',x=>x.progression.operationChoices['ch1-road']='invented',x=>x.progression.negotiators.valens.trust=99,x=>x.progression.agreements[0].cost=0,x=>delete x.encounter.progressionVersion,x=>delete x.snapshot.progressionVersion,x=>x.encounter.staged.agreements=[{id:'forged'}]];
  for(const mutate of mutations){const invalid=copy(s);mutate(invalid);assert.throws(()=>G.deserialize(JSON.stringify(invalid)));assert.equal(G.serialize(s),before);}
  const battle=start('ch9-city');const invalid=copy(battle);invalid.encounter.operation.branch='imaginary';assert.throws(()=>G.deserialize(JSON.stringify(invalid)));
});
