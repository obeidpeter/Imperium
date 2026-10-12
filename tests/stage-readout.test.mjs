import test from 'node:test';
import assert from 'node:assert/strict';
import {actorVisible,actorReadout,effectReadout,missionReadouts} from '../src/showcase/stage-readout.js';
import {combatCues} from '../src/showcase/combat-presentation.js';
import {battleSoundPlan} from '../src/showcase/battle-sound.js';

test('Civic labels preserve voting, promises and withdrawn speaker votes without inventing health',()=>{
  const e={promises:['v']},voter={id:'v',role:'voter',side:'neutral',hp:1,stance:3,bloc:'Veterans'};
  const original=JSON.stringify({e,voter}),readout=actorReadout(voter,e);
  assert.equal(readout.type,'vote');assert.equal(readout.signal,'✓ +3 stance');assert.equal(readout.detail,'Veterans · Committed · Promised');
  assert.equal(JSON.stringify({e,voter}),original);
  const speaker={id:'s',role:'speaker',side:'enemy',resolve:0,maxResolve:10,hp:0,vote:'against'};
  assert.equal(actorVisible(speaker),true);assert.deepEqual(actorReadout(speaker,e),{type:'resolve',tone:'opposition',value:0,ratio:0,signal:'Withdrawn',detail:'Vote retained · opposes'});
  assert.equal(actorVisible({...speaker,hidden:true}),false);
  assert.equal(actorVisible({role:'soldier',hp:0}),false);
});

test('World markers expose real objectives and the next announced wave, not unused goals or hidden foes',()=>{
  const mission={mode:'extract',points:[],waves:[{x:7,y:2,turn:3,arrived:true},{x:7,y:4,turn:6,arrived:false},{x:7,y:1,turn:9,arrived:false}]},e={kind:'battle',goal:{x:7,y:5},mission};
  assert.deepEqual(missionReadouts(e).map(m=>m.label),['Extraction','Reinforcements · turn 6']);
  assert.deepEqual(missionReadouts({...e,kind:'contest'}),[]);
  assert.deepEqual(missionReadouts({...e,mission:{mode:'clear',waves:[],points:[]}}),[]);
  assert.equal(missionReadouts({...e,mission:{mode:'capture',points:[{x:2,y:2,secured:true}],waves:[]}})[0].tone,'secured');
});

test('Battle readouts distinguish protection, bracing and announced intentions',()=>{
  const e={},escort={role:'escort',hp:5,maxHp:10,side:'neutral'};
  assert.equal(actorReadout(escort,e).detail,'5/10 health · Protect');
  assert.equal(actorReadout({...escort,braced:true},e).signal,'Braced');
  assert.equal(actorReadout({...escort,intent:'Withdraw toward commander'},e).signal,'Withdrawing');
  assert.equal(actorReadout({...escort,morale:20},e).signal,'Low morale');
  assert.equal(actorReadout({...escort,hp:25},e).ratio,1);
  assert.equal(effectReadout({type:'impact',political:true,delta:-3}).text,'-3 Resolve');
  assert.equal(effectReadout({type:'stance',delta:2}).text,'+2 stance');
  assert.equal(effectReadout({type:'impact',delta:-3}).ring,false);
});

test('Civic action audio avoids metal combat cues; mounted and marsh movement use their actual surface',()=>{
  const civic=combatCues({tracks:[],effects:[{type:'speech',start:70},{type:'stance',start:230,delta:2},{type:'impact',political:true,start:230,delta:-2}]});
  assert.deepEqual(civic.map(x=>x.kind),['speech','vote','cloth']);
  const timeline={tracks:[{pose:'cavalry-move',start:0,duration:700,path:[{x:0,y:0},{x:1,y:0}]}],effects:[]};
  const mounted=combatCues(timeline,{encounter:{terrain:[['sand','sand']]}}),wet=combatCues(timeline,{encounter:{terrain:[['marsh','ford']]}});
  assert.ok(mounted.every(x=>x.kind==='hoof'));assert.ok(wet.every(x=>x.kind==='wade'));
  for(const kind of ['hoof','wade','speech','vote'])assert.ok(battleSoundPlan(kind).layers.length>0);
});
