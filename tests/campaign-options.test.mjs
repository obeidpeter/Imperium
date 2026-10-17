import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as G from '../src/core/game.js';
import {playEncounter,runCampaign} from '../scripts/autoplay.mjs';
import {debugJump} from '../src/core/debug.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {contestIntents} from '../src/core/contest.js';

const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
const copy=s=>JSON.parse(JSON.stringify(s));
const args=i=>i.kind==='act'?[i.payload]:i.kind==='choose'?[i.option]:i.kind==='startEncounter'?[i.options]:['prepare','negotiate','selectStratagem','allocate','judge'].includes(i.kind)?[i.value]:[];
function road(difficulty='standard'){
  const s=G.newGame('Company test',275,{difficulty});assert.ok(G.choose(s,'report').ok);assert.ok(G.startEncounter(s).ok);assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);assert.ok(G.swearOath(s).ok);return s;
}

test('All 1,041 frozen 0.14.1 legal commands, saved states and 25 encounter retries retain exact results',async()=>{
  const f=JSON.parse(await readFile(new URL('./compatibility/campaign-v014-route.json',import.meta.url),'utf8'));
  const s=G.deserialize(JSON.stringify(f.initial));assert.equal(G.companyPlan(s).legacy,true);
  for(const [index,item]of f.trace.entries()){
    assert.ok(G[item.kind](s,...item.args).ok,`${index}: ${item.kind}`);
    assert.equal(digest(s),item.sha256,`${index}: ${item.kind}`);
    assert.equal(digest(G.deserialize(G.serialize(s))),item.sha256,'Reload preserves the exact legacy result.');
    if(item.kind==='startEncounter'){const retry=copy(s);assert.ok(G.retry(retry).ok);assert.equal(digest(retry),item.sha256);}
  }
  assert.equal(s.rank,'Augustus');assert.equal(s.campaignRules,undefined);
});

test('Company selection is persistent, invalid choices are inert, and one supply package is paid exactly once per attempt',()=>{
  const s=road(),initial=G.serialize(s),supplies=s.supplies;
  for(const ids of [[],['lucan','naso'],['absent'],null]){assert.equal(G.selectCompany(s,ids).ok,false);assert.equal(G.serialize(s),initial);}
  assert.ok(G.selectCompany(s,['naso']).ok);assert.equal(G.companyPlan(s).selectedIds[0],'naso');
  assert.ok(G.prepareCompany(s,'support').ok);assert.ok(G.prepareCompany(s,'rearm').ok);assert.ok(G.prepareCompany(s,'rearm').ok);assert.equal(s.supplies,supplies);
  assert.ok(G.startEncounter(s).ok);assert.equal(s.supplies,supplies-2);assert.equal(s.encounter.units.find(u=>u.id==='hero').ammo,5);assert.equal(s.encounter.units.find(u=>u.id==='ally0').veteranId,'naso');
  const started=G.serialize(s);assert.equal(G.prepareCompany(s,'support').ok,false);assert.equal(G.selectCompany(s,['lucan']).ok,false);assert.equal(G.serialize(s),started);
  assert.ok(G.endTurn(s).ok);assert.ok(G.retry(s).ok);assert.equal(G.serialize(s),started);
  assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);assert.equal(s.companyOrders.package,'none');assert.equal(s.companyOrders.priority[0],'naso');
  const committed=G.serialize(s);assert.equal(G.commitEncounter(s).ok,false);assert.equal(G.serialize(s),committed);
});

test('Medical recovery restores only selected veterans and Retry cannot accumulate healing or spending',()=>{
  const s=road();s.company.find(v=>v.id==='naso').recovery=2;s.company.find(v=>v.id==='lucan').recovery=2; // Labelled company-condition fixture.
  assert.ok(G.selectCompany(s,['naso']).ok);assert.ok(G.prepareCompany(s,'recovery').ok);const supplies=s.supplies;
  assert.ok(G.startEncounter(s).ok);const ally=s.encounter.units.find(u=>u.id==='ally0');assert.equal(ally.hp,ally.maxHp);assert.equal(s.company.find(v=>v.id==='naso').recovery,0);assert.equal(s.company.find(v=>v.id==='lucan').recovery,2);
  const started=G.serialize(s);for(let i=0;i<3;i++){G.endTurn(s);assert.ok(G.retry(s).ok);assert.equal(G.serialize(s),started);assert.equal(s.supplies,supplies-2);}
});

test('Imported modern checkpoints reject old rule options; a rejected Retry leaves the entire live encounter intact',()=>{
  const s=road();G.startEncounter(s);const valid=G.serialize(s);
  for(const options of [{legacyLayout:true},{combatVersion:1},{politicsVersion:1},{combatVersion:3},null,[]]){
    for(const record of ['state','snapshot']){const invalid=JSON.parse(valid);(record==='state'?invalid:invalid.snapshot).encounterOptions=options;assert.throws(()=>G.deserialize(JSON.stringify(invalid)),/checkpoint options/);}
  }
  s.encounterOptions.legacyLayout=true;const before=JSON.stringify(s),response=G.retry(s);assert.equal(response.ok,false);assert.match(response.message,/Legacy encounter rules/);assert.equal(JSON.stringify(s),before);assert.equal(s.phase,'encounter');assert.ok(s.snapshot);assert.ok(s.encounter);
  const missingOath=JSON.parse(valid);missingOath.snapshot.oath=false;const untouched=JSON.stringify(missingOath);assert.equal(G.retry(missingOath).ok,false);assert.equal(JSON.stringify(missingOath),untouched,'Any failed start remains atomic, not just rule-version failure.');
});

test('Unaffordable or stale package choices cannot enter a battle or mutate a checkpoint',()=>{
  const s=road();s.supplies=1;const before=G.serialize(s);assert.equal(G.prepareCompany(s,'rearm').ok,false);assert.equal(G.serialize(s),before);
  s.supplies=3;assert.ok(G.prepareCompany(s,'support').ok);s.supplies=1;const stale=G.serialize(s);assert.equal(G.startEncounter(s).ok,false);assert.equal(G.serialize(s),stale);assert.ok(G.prepareCompany(s,'none').ok);assert.ok(G.startEncounter(s).ok);
});

test('Support gives only its advertised bounded opening benefits and finale selection matches the actual relief slots',()=>{
  const s=road(),plain=copy(s);G.startEncounter(plain);G.prepareCompany(s,'support');G.startEncounter(s);
  assert.equal(s.encounter.defence,plain.encounter.defence+15);
  for(const u of s.encounter.units){const before=plain.encounter.units.find(v=>v.id===u.id);assert.equal(u.hp,before.hp);assert.equal(u.morale,u.side==='enemy'?before.morale:Math.min(100,before.morale+15));}
  const finale=debugJump(G.newGame('Injected zero-standing selection'),12,true);finale.encounterIndex=1;finale.meters.army=0;assert.equal(G.companyPlan(finale).slots,3);finale.meters.army=100;assert.equal(G.companyPlan(finale).slots,5);
});

test('A completed intermediate phase at the deadline cannot grant an extra playable turn or a victory',()=>{
  const s=road();G.startEncounter(s);const e=s.encounter;
  // Controlled end-of-deadline state: the road screen completes, its fight has not.
  e.turn=e.turnLimit;for(const u of e.units)if(u.side==='enemy')u.hp=0;
  Object.assign(e.units.find(u=>u.id==='hero'),{x:2,y:3});Object.assign(e.units.find(u=>u.side==='ally'),{x:2,y:2});
  assert.ok(G.endTurn(s).ok);assert.equal(e.operation.index,1);assert.equal(e.turn,e.turnLimit);assert.equal(e.status,'lost');assert.equal(G.commitEncounter(s).ok,false);assert.ok(G.retry(s).ok);assert.equal(s.encounter.operation.index,0);
});

test('Rescue burden excludes healthy duplicate Lucan and leave substitutes Sabinus in the persistent deployment plan',()=>{
  for(const choice of ['carry','leave']){const s=debugJump(G.newGame('Injected rescue setup'),2,true);assert.ok(G.choose(s,choice).ok);const p=G.companyPlan(s);assert.equal(p.available.find(v=>v.id==='lucan')?.available,choice==='carry'?false:undefined);assert.ok(G.startEncounter(s).ok);const tagged=s.encounter.units.filter(u=>u.veteranId);assert.equal(new Set(tagged.map(u=>u.veteranId)).size,tagged.length);assert.equal(s.companyOrders.priority.includes('lucan'),choice==='carry');assert.doesNotThrow(()=>G.serialize(s));}
});

test('Chosen bowman changes actual attack reach from Chapter III while unselected veterans remain reserves',()=>{
  const s=debugJump(G.newGame('Injected role comparison'),3,true);G.choose(s,'claim');assert.ok(G.selectCompany(s,['felix']).ok);G.startEncounter(s);assert.equal(s.encounter.units.find(u=>u.veteranId==='felix').role,'archer');assert.equal(s.encounter.units.some(u=>u.veteranId==='lucan'),false);
  assert.equal(G.retry(s).ok,true);assert.equal(s.encounter.units.find(u=>u.id==='ally0').veteranId,'felix');
});

test('Difficulty changes announced reinforcement timing and deadlines without changing enemy health or damage',()=>{
  const states=['story','standard','veteran'].map(d=>{const s=road(d);G.startEncounter(s);return s;});
  const enemies=s=>s.encounter.units.filter(u=>u.side==='enemy').map(u=>({id:u.id,hp:u.hp,damage:u.damage}));
  assert.deepEqual(enemies(states[0]),enemies(states[1]));assert.deepEqual(enemies(states[2]),enemies(states[1]));
  assert.equal(states[0].encounter.turnLimit,states[1].encounter.turnLimit+3);
  assert.equal(states[0].encounter.mission.waves[0].turn,states[1].encounter.mission.waves[0].turn+2);
  assert.equal(states[2].encounter.mission.waves[0].turn,states[1].encounter.mission.waves[0].turn-1);
  const before=G.serialize(states[1]);for(const opts of [{legacyLayout:true},{combatVersion:1},{politicsVersion:1}])assert.equal(G.startEncounter(states[1],opts).ok,false);assert.equal(G.serialize(states[1]),before);
});

test('Authored phases are reached by legal play; crossing spawns a protected party and a new announced raid',async()=>{
  const run=await runCampaign(),s=G.newGame('Aurelius Marcellus',275),transitions=[];
  for(const item of run.trace){const old=s.encounter&&copy(s.encounter);assert.ok(G[item.kind](s,...args(item)).ok);assert.equal(JSON.stringify(G.deserialize(G.serialize(s))),JSON.stringify(s),'Every new route command survives reload.');
    const e=s.encounter;if(old?.operation&&e?.operation&&old.operation.index!==e.operation.index){assert.equal(e.status,'active','A phase is not a committed victory.');assert.equal(e.operation.index,old.operation.index+1);assert.equal(e.operation.completed.length,e.operation.index);transitions.push(e.id);if(e.id==='ch8-crossing'){assert.equal(e.mission.mode,'extract');assert.ok(e.units.some(u=>u.id==='last-ferry'&&u.role==='escort'));assert.ok(e.mission.waves.some(w=>!w.arrived));}}
    const before=JSON.stringify(s);G.tacticalAdvice(s);G.operationPhase(e);G.companyPlan(s);assert.equal(JSON.stringify(s),before,'UI guidance is pure.');
  }
  assert.equal(transitions.length,11);assert.ok(transitions.includes('ch1-road'));assert.ok(transitions.includes('ch8-crossing'));assert.deepEqual(s.completed,Array.from({length:12},(_,i)=>i+1));
});

test('Malformed or stripped modern campaign, deployment and phase fields are rejected',()=>{
  const s=road();G.startEncounter(s);const valid=G.serialize(s);
  for(const corrupt of [s=>s.difficulty='impossible',s=>s.campaignRules=3,s=>delete s.companyOrders,s=>s.companyOrders.priority[0]='felix',s=>s.companyOrders.package='free-health',s=>delete s.encounter.operation,s=>s.encounter.operation.index=99,s=>s.encounter.operation.startedTurn=99,s=>s.encounter.operation.completed=['invented'],s=>s.encounter.goal.x=0,s=>s.encounter.mission.points=[],s=>s.encounter.difficulty='story',s=>s.snapshot.difficulty='story',s=>delete s.encounter.companyPackage,s=>delete s.encounter.combatVersion]){const bad=JSON.parse(valid);corrupt(bad);assert.throws(()=>G.deserialize(JSON.stringify(bad)),/Invalid save/);}
  assert.throws(()=>G.newGame('Name',275,{difficulty:'impossible'}));
});

test('Chamber advice reports the actual deadline and cost, stays bounded, and changes with Resolve without consuming state',()=>{
  const s=debugJump(G.newGame('Injected chamber advice'),11,true);G.choose(s,'independent');G.startEncounter(s);const before=G.serialize(s),advice=G.tacticalAdvice(s);
  assert.equal(advice.length,3);assert.match(advice[0],new RegExp(`${G.voteCount(s).for}/13`));assert.match(advice[2],/two-supply obligation/);assert.equal(G.serialize(s),before);
  s.encounter.units.find(u=>u.id==='hero').resolve=3;s.encounter.units.find(u=>u.id==='hero').hp=3;assert.match(G.tacticalAdvice(s)[1],/four Resolve/);
  s.encounter.promises=['member0','member1'];assert.match(G.tacticalAdvice(s)[2],/once per recipient/);
});

test('Political difficulty strengthens lobbying while Veteran does not increase Resolve damage',()=>{
  const states=['story','standard','veteran'].map(d=>{const s=debugJump(G.newGame('Injected speech comparison',275,{difficulty:d}),11,true);G.choose(s,'independent');G.startEncounter(s);return s;});
  const amounts=states.map(s=>{const e=s.encounter;for(const u of e.units.filter(u=>u.role==='speaker'&&u.side!=='enemy')){u.x=0;u.y=u.id==='hero'?0:1;}return contestIntents(s).filter(p=>p.action==='lobby').map(p=>p.amount);});
  assert.ok(amounts.every(a=>a.length===2));assert.equal(amounts[0][0]+1,amounts[1][0]);assert.equal(amounts[1][0]+1,amounts[2][0]);
  for(const s of states){for(const u of s.encounter.units.filter(u=>u.role==='voter'))u.stance=-6;const hero=s.encounter.units.find(u=>u.id==='hero');hero.x=6;hero.y=3;}
  const pressure=states.map(s=>contestIntents(s).find(p=>p.action==='pressure')?.amount);assert.equal(pressure[1],pressure[2]);assert.ok(pressure[0]<pressure[1]);
});

test('All three difficulty routes and both rescue/civilian branches legally earn Augustus',async()=>{
  for(const difficulty of ['story','standard','veteran'])for(const choices of [{},{ch2:'leave',ch6:'obey',ch8:'soldiers'}]){const run=await runCampaign({difficulty,choices,allowFallback:true});assert.equal(run.encounters.length,CHAPTERS.reduce((n,c)=>n+c.encounters.length,0));assert.equal(run.encounters.every(e=>e.status==='won'),true);assert.equal(run.state.rank,'Augustus');assert.equal(G.deserialize(G.serialize(run.state)).difficulty,difficulty);}
});
