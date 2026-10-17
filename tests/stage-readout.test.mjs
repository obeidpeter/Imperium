import test from 'node:test';
import assert from 'node:assert/strict';
import {actorVisible,actorReadout,effectReadout,missionReadouts,tacticalLinks,previewBadge} from '../src/showcase/stage-readout.js';
import {combatCues} from '../src/showcase/combat-presentation.js';
import {battleSoundPlan} from '../src/showcase/battle-sound.js';

test('Civic labels preserve voting, promises and withdrawn speaker votes without inventing health',()=>{
  const e={promises:['v'],staged:{agreements:[{personId:'lucan'}]}},voter={id:'v',role:'voter',side:'neutral',hp:1,stance:3,bloc:'Veterans'};
  const original=JSON.stringify({e,voter}),readout=actorReadout(voter,e);
  assert.equal(readout.type,'vote');assert.equal(readout.signal,'✓ +3 stance');assert.equal(readout.detail,'Veterans · Committed · Promised');
  assert.equal(actorReadout({...voter,id:'v2',negotiatorId:'lucan'},e).detail,'Veterans · Committed · Agreed');
  assert.equal(JSON.stringify({e,voter}),original);
  const speaker={id:'s',role:'speaker',side:'enemy',resolve:0,maxResolve:10,hp:0,vote:'against'};
  assert.equal(actorVisible(speaker),true);assert.deepEqual(actorReadout(speaker,e),{type:'resolve',tone:'opposition',value:0,ratio:0,signal:'Withdrawn',detail:'Vote retained · opposes'});
  assert.equal(actorVisible({...speaker,hidden:true}),false);
  assert.equal(actorVisible({role:'soldier',hp:0}),false);
});

test('World markers expose real objectives, active operation phases and the next announced wave',()=>{
  const mission={mode:'extract',points:[],waves:[{x:7,y:2,turn:3,arrived:true},{x:7,y:4,turn:6,arrived:false},{x:7,y:1,turn:9,arrived:false}]},e={kind:'battle',goal:{x:7,y:5},mission};
  assert.deepEqual(missionReadouts(e).map(m=>m.label),['Extraction','Reinforcements · turn 6']);
  assert.equal(missionReadouts({...e,operation:{index:1,phases:[{},{}]}})[0].label,'Phase 2 · Extraction');
  assert.deepEqual(missionReadouts({...e,kind:'contest'}),[]);
  assert.deepEqual(missionReadouts({...e,mission:{mode:'clear',waves:[],points:[]}}),[]);
  assert.equal(missionReadouts({...e,mission:{mode:'capture',points:[{x:2,y:2,secured:true}],waves:[]}})[0].tone,'secured');
});

test('Battle readouts, tactical links and floating preview badges distinguish combat, specialist and Contest forecasts',()=>{
  const e={},escort={role:'escort',hp:5,maxHp:10,side:'neutral'};
  assert.equal(actorReadout(escort,e).detail,'5/10 health · Protect');
  assert.equal(actorReadout({...escort,braced:true},e).signal,'Braced');
  assert.equal(actorReadout({...escort,intent:'Withdraw toward commander'},e).signal,'Withdrawing');
  assert.equal(actorReadout({...escort,morale:20},e).signal,'Low morale');
  assert.equal(actorReadout({...escort,hp:25},e).ratio,1);
  const hero={id:'hero',side:'player',hp:12,maxHp:14,x:2,y:2},protector={id:'ally0',side:'ally',hp:10,maxHp:10,x:2,y:3,specialization:'protector',guardTargetId:'hero'},ranged={id:'ally1',side:'ally',hp:9,maxHp:9,x:1,y:2,specialization:'ranged',specialistAmmo:2};
  const guardedEncounter={kind:'battle',units:[hero,protector,ranged]};
  assert.equal(actorReadout(protector,guardedEncounter).signal,'Guarding');
  assert.equal(actorReadout(hero,guardedEncounter).signal,'Guarded');
  assert.equal(actorReadout(hero,guardedEncounter).detail,'12/14 health · Ward −2');
  assert.equal(actorReadout(ranged,guardedEncounter).detail,'9/9 health · Volley 2');
  assert.deepEqual(tacticalLinks(guardedEncounter,{selected:'ally1',target:{x:4,y:2}}).map(l=>l.kind),['guard','aim']);
  assert.equal(effectReadout({type:'impact',political:true,delta:-3}).text,'-3 Resolve');
  assert.equal(effectReadout({type:'stance',delta:2}).text,'+2 stance');
  assert.equal(effectReadout({type:'impact',delta:-3}).ring,false);
  assert.equal(previewBadge(null,'strike'),null);
  assert.equal(previewBadge({ok:true,message:'Move to 2B.'},'move'),null);
  assert.deepEqual(previewBadge({ok:true,message:'Strike Raider: 4 damage. Flank; morale −12.'},'strike'),{text:'−4 HP · Flank',color:'#f3b78b'});
  assert.deepEqual(previewBadge({ok:true,message:'Guard Aurelius'},'guard'),{text:'Ward −2 dmg',color:'#edcf7c'});
  assert.deepEqual(previewBadge({ok:true,message:'Inspire Lucan'},'inspire'),{text:'+20 morale · +1 HP',color:'#a7d7a9'});
  assert.deepEqual(previewBadge({ok:true,forecast:{stanceChanges:[{from:-1,to:2}]}},'persuade'),{text:'+3 stance (-1 → 2)',color:'#c7d9a1'});
  assert.deepEqual(previewBadge({ok:true,forecast:{stanceChanges:[{from:0,to:1},{from:1,to:2}],votesBefore:3,votesAfter:5}},'address'),{text:'Support 3 → 5',color:'#c7d9a1'});
  assert.deepEqual(previewBadge({ok:true,forecast:{resolveChanges:[{from:8,to:4}]}},'denounce'),{text:'-4 Resolve',color:'#ecb394'});
  assert.deepEqual(previewBadge({ok:true,forecast:{bluntedIds:['rival']}},'rebut'),{text:'Blunt speech',color:'#89cfcb'});
});

test('Civic and specialist action audio use distinct foley plans; mounted and marsh movement use their actual surface',()=>{
  const civic=combatCues({tracks:[{pose:'brace',action:'guard',start:0,duration:400},{pose:'rally',action:'inspire',start:50,duration:400}],effects:[{type:'speech',start:70},{type:'stance',start:230,delta:2},{type:'impact',political:true,start:230,delta:-2}]});
  assert.deepEqual(civic.map(x=>x.kind),['speech','guard','inspire','vote','cloth']);
  const timeline={tracks:[{pose:'cavalry-move',start:0,duration:700,path:[{x:0,y:0},{x:1,y:0}]}],effects:[]};
  const mounted=combatCues(timeline,{encounter:{terrain:[['sand','sand']]}}),wet=combatCues(timeline,{encounter:{terrain:[['marsh','ford']]}});
  assert.ok(mounted.every(x=>x.kind==='hoof'));assert.ok(wet.every(x=>x.kind==='wade'));
  for(const kind of ['hoof','wade','speech','vote','guard','inspire','agreement'])assert.ok(battleSoundPlan(kind).layers.length>0);
});

