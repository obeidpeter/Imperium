import test from 'node:test';
import assert from 'node:assert/strict';
import {audioDirection,soundscapeFor,SOUND_FILES} from '../src/ui/soundscape-data.js';

const field=chapter=>({chapter,phase:'encounter',encounter:{kind:'battle',id:`ch${chapter}-test`,status:'active',turn:1,turnLimit:10,units:[{id:'hero',side:'player',hp:10,maxHp:10,x:1,y:1}]}});
test('V034 twelve chapter directions stay bounded, deterministic and separate from recording selection',()=>{
  const titles=new Set(),profiles=new Set();
  for(let chapter=1;chapter<=12;chapter++){
    const state=field(chapter),before=JSON.stringify(state),result=audioDirection(state);
    assert.deepEqual(audioDirection(state),result);assert.equal(JSON.stringify(state),before);assert.ok(Object.isFrozen(result));titles.add(result.title);profiles.add([result.musicHz,result.ambienceHz,result.ambiencePan].join('|'));
    assert.ok(result.musicHz>=3000&&result.musicHz<=12000);assert.ok(result.ambienceHz>=2200&&result.ambienceHz<=12000);assert.ok(Math.abs(result.ambiencePan)<=.08);
    assert.equal(result.mood,'calm');assert.equal(result.musicGain,1);assert.ok(SOUND_FILES[soundscapeFor(state).music]);
  }assert.equal(titles.size,12);assert.equal(profiles.size,12);assert.equal(Object.keys(SOUND_FILES).length,14);
});

test('V034 concealed units and future campaign outcomes cannot leak into the soundtrack',()=>{
  const a=field(5),b=structuredClone(a),baseline=audioDirection(a);
  b.encounter.units.push({id:'ambush',hidden:true,side:'enemy',hp:99,maxHp:99,x:1,y:2});
  b.futureOutcome='disaster';b.encounter.secretReinforcements=100;assert.deepEqual(audioDirection(b),baseline);
  b.encounter.units[1].hidden=false;assert.equal(audioDirection(b).mood,'engaged');
  const before=JSON.stringify(b);audioDirection(b);assert.equal(JSON.stringify(b),before);
});

test('V034 only public pressure, visible results and actual weather steer the mix',()=>{
  const state=field(8);state.encounter.weather='rain';const calm=audioDirection(state);assert.equal(calm.ambienceOverride,'ambience-rain');
  state.encounter.turn=9;let urgent=audioDirection(state);assert.equal(urgent.mood,'urgent');assert.ok(urgent.musicGain<calm.musicGain);assert.ok(urgent.ambienceGain<=calm.ambienceGain);
  state.encounter.status='won';assert.equal(audioDirection(state).mood,'victory');assert.equal(audioDirection(state).pressure,0);
  state.encounter.status='lost';assert.equal(audioDirection(state).mood,'defeat');
  state.phase='camp';assert.equal(audioDirection(state).mood,'camp');assert.equal(audioDirection(state,'title').mood,'silent');
  state.phase='encounter';state.encounter.status='active';state.encounter.kind='contest';state.encounter.units[0].hp=1;
  urgent=audioDirection(state);assert.equal(urgent.weather,'clear');assert.equal(urgent.ambienceOverride,null);assert.equal(urgent.ambiencePan,0);
  assert.deepEqual(soundscapeFor(state),{music:'music-council',ambience:'ambience-council'});
});
