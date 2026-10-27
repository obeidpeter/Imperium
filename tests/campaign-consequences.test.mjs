import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {createEncounterWorld} from '../src/core/realtime/campaign-encounter.js';
import {applyCampaignSupport} from '../src/core/realtime/campaign-support.js';
import {blowSetup} from '../src/core/realtime/combat.js';
import {workFortification} from '../src/core/realtime/fortifications.js';
import {commitFieldReport,delegateRecordBonus,fieldReportText,finaleCareerSupport,validateFieldReports} from '../src/core/campaign-consequences.js';
import {FINALE_RESERVE} from '../src/data/realtime-rules.js';
import {validateWorld} from '../src/core/realtime/validate.js';
import {worldHash} from '../src/core/realtime/simulation.js';
import {NEGOTIATORS} from '../src/data/negotiators.js';
const copy=structuredClone,fail=message=>{throw Error(message);},camps=new Map();
let campaign;
function camp(id){campaign??=runCommandCampaign({featureEdition:35,onCheckpoint:s=>camps.set(G.getChapter(s).encounters[s.encounterIndex].id,G.serialize(s))});return G.deserialize(camps.get(id));}

test('every current campaign battlefield builds validated structures and support from legally earned camp checkpoints',()=>{
  camp('ch5-mine');const seen=new Set();
  for(const text of camps.values()){
    const s=G.deserialize(text),data=G.getChapter(s).encounters[s.encounterIndex];if(data.kind!=='battle')continue;
    assert.ok(G.startEncounter(s,{controls:'realtime'}).ok);const w=G.realtimeWorld(s);validateWorld(w,fail);
    assert.equal(worldHash(G.realtimeWorld(G.deserialize(G.serialize(s)))),worldHash(w));seen.add(s.chapter);
  }
  assert.equal(seen.size,11,'Chapter XI has political chambers rather than a field battle');
});

test('a recovered supply operation repairs the next bridge at departure, while a counterfactual without support retains the damaged route',()=>{
  const s=camp('ch8-ferry');assert.ok(G.startEncounter(s,{controls:'realtime'}).ok);
  const supported=G.realtimeWorld(s),bare=copy(s);bare.encounter.appliedOperations=[];
  const unsupplied=createEncounterWorld(bare,bare.encounter);
  assert.equal(unsupplied.objects.find(o=>o.kind==='bridge').state,'damaged');
  assert.equal(supported.objects.find(o=>o.kind==='bridge').state,'repaired');
  assert.ok(supported.log.some(l=>l.text.includes('supply train repaired')));
  const started=worldHash(supported);assert.ok(G.retry(s).ok);assert.equal(worldHash(G.realtimeWorld(s)),started);
});

test('field reports distinguish intact siege work, incomplete work and withdrawal, commit once and cannot award on a loss',()=>{
  // Explicit transaction fixture: isolates the commit boundary, not a claimed playthrough.
  const s={progressionVersion:1,progression:{},history:[]},report={version:1,id:'ch5-mine',works:2,engineering:2,withdrawals:0,opportunity:false};
  const e={id:'ch5-mine',kind:'battle',status:'lost',staged:{fieldReport:report}};
  commitFieldReport(s,e);assert.equal(s.progression.fieldReports,undefined);
  e.status='won';commitFieldReport(s,e);assert.equal(s.progression.fieldReports.length,1);
  assert.match(fieldReportText(report),/engineers return intact/);
  assert.match(fieldReportText({...report,engineering:1}),/unfinished siege works/);
  assert.match(fieldReportText({...report,withdrawals:1}),/must recover/);
  commitFieldReport(s,e);assert.equal(s.progression.fieldReports.length,1);
  commitFieldReport(s,{id:'ch5-wall',kind:'battle',status:'won',staged:{}});
  assert.equal(s.progression.fieldReports[0].consumedBy,'ch5-wall');
});

test('recovered engineers offer one following field action of support, including after restoration',()=>{
  const s=camp('ch5-wall');s.progression.fieldReports=[{version:1,id:'ch5-mine',works:2,engineering:2,withdrawals:0,opportunity:true,consumedBy:null}];
  assert.doesNotThrow(()=>G.deserialize(G.serialize(s)));assert.ok(G.startEncounter(s,{controls:'realtime'}).ok);
  assert.equal(G.realtimeWorld(s).engineering,true);const start=worldHash(G.realtimeWorld(s));
  assert.equal(worldHash(G.realtimeWorld(G.deserialize(G.serialize(s)))),start);
  assert.ok(G.retry(s).ok);assert.equal(worldHash(G.realtimeWorld(s)),start);
});

test('recovered engineers speed the next field action’s work but add none of the Engineering approach’s defence',()=>{
  const supported=camp('ch5-wall'),plain=camp('ch5-wall');
  supported.progression.fieldReports=[{version:1,id:'ch5-mine',works:2,engineering:2,withdrawals:0,opportunity:true,consumedBy:null}];
  for(const s of [supported,plain])assert.ok(G.startEncounter(s,{controls:'realtime'}).ok);
  const [ws,wp]=[supported,plain].map(s=>G.realtimeWorld(s));
  assert.equal(ws.engineering,true);assert.notEqual(ws.approach,'breach');
  const blow=w=>{const enemy=w.actors.find(a=>a.side==='enemy'&&a.alive&&!a.hidden),man=w.actors.find(a=>a.alive&&w.squads.some(q=>q.side==='ally'&&q.id===a.squadId));
    return blowSetup(w,enemy,man);};
  const [bs,bp]=[ws,wp].map(blow);
  assert.equal(bs.defence,bp.defence,'earned support adds no defence');assert.ok(!bs.mods.some(m=>m.label==='Engineers’ works'));
  // A worker far from the engineer detail: the support alone completes a work in one action.
  const worker={id:'hero',x:-1000,z:-1000,effects:{}},[ms,mp]=[ws,wp].map(w=>w.objects.find(o=>o.kind==='countermine'));
  workFortification(ws,worker,ms);workFortification(wp,worker,mp);
  assert.equal(ms.progress,2);assert.equal(ms.done,true);assert.equal(mp.progress,1);assert.equal(mp.done,false);
});

test('representatives value relevant committed service and the final reserve reductions have independent monotonic requirements',()=>{
  const s={progressionVersion:1,tacticsEdition:35,progression:{operationResults:[],agreements:[]}};
  const first=copy(s);assert.equal(finaleCareerSupport(s).reservesRemoved,0);
  s.progression.operationResults=[{label:'Mine engineers',benefit:'intelligence',outcome:'clean'},{label:'Dispatches',benefit:'intelligence',outcome:'clean'}];
  const veteran=NEGOTIATORS.find(p=>p.bloc==='Veterans'),civic=NEGOTIATORS.find(p=>p.bloc==='Civic');
  assert.equal(delegateRecordBonus(s,veteran).amount,1);assert.equal(delegateRecordBonus(s,civic).amount,0);
  assert.equal(finaleCareerSupport(s).reservesRemoved,1);
  s.progression.agreements=[{personId:'faustus',status:'honoured'},{personId:'valens',status:'honoured'}];
  assert.equal(finaleCareerSupport(s).reservesRemoved,2);
  const world={practice:false,heroId:'hero',actors:[{id:'hero',x:0,z:0}],objects:[],tick:0,log:[],mission:{waves:FINALE_RESERVE.waves.map(w=>({round:w.turn,arrived:false,squad:{name:FINALE_RESERVE.name}}))}};
  applyCampaignSupport({...s,chapter:12},{type:'confrontation',route:FINALE_RESERVE.routes[0],appliedOperations:[]},world);
  assert.equal(world.mission.waves.filter(w=>w.arrived).length,2);
  assert.equal(finaleCareerSupport(first).reservesRemoved,0,'no career evidence still retains the guaranteed recovery route');
});

test('field report imports reject forged or unbounded data',()=>{
  const s=camp('ch5-wall');s.progression.fieldReports=[{version:1,id:'ch5-mine',works:2,engineering:2,withdrawals:0,opportunity:true,consumedBy:null}];
  validateFieldReports(s,fail);
  for(const mutate of [r=>r.engineering=3,r=>r.withdrawals=-1,r=>r.id='invented',r=>r.consumedBy='unplayed']){
    const bad=copy(s);mutate(bad.progression.fieldReports[0]);assert.throws(()=>validateFieldReports(bad,fail));
  }
});
