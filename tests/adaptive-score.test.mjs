import test from 'node:test';
import assert from 'node:assert/strict';
import {audioDirection} from '../src/ui/soundscape-data.js';
import {adaptiveScoreSamples,commandSoundCue} from '../src/ui/adaptive-score.js';
import {battleSoundPlan} from '../src/showcase/battle-sound.js';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {ORDERS} from '../src/data/realtime-squads.js';

test('live real-time facts override stale saved battle pressure without leaking concealed units or changing state',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const state={chapter,phase:'encounter',encounter:{kind:'battle',status:'active',turn:1,turnLimit:10,units:[{id:'hero',hp:10,maxHp:10,x:0,y:0}]}},
      world={kind:'field',tick:0,status:'active',actors:[{id:'hero',hp:10,maxHp:10,x:3,z:3},{id:'ambush',side:'enemy',hidden:true,hp:10,x:3,z:4}],mission:{deadline:10}};
    const before=JSON.stringify([state,world]);assert.equal(audioDirection(state,'game',world).mood,'calm');assert.equal(JSON.stringify([state,world]),before);
    world.actors[1].hidden=false;assert.equal(audioDirection(state,'game',world).mood,'engaged');
    world.actors[0].hp=2;assert.equal(audioDirection(state,'game',world).mood,'urgent');assert.equal(audioDirection(state).mood,'calm','saved encounter remains separate');
    world.status='won';assert.equal(audioDirection(state,'game',world).mood,'victory');
  }
});
test('a legally started real-time Chapter V field supplies actual world kind, hero health and deadline',()=>{
  const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
  const state=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id==='camp-5').state));
  assert.ok(Game.choose(state,'countermine').ok);
  assert.ok(Game.startEncounter(state,{controls:'realtime'}).ok);const world=Game.realtimeWorld(state);assert.equal(world.kind,'field');
  const hero=world.actors.find(a=>a.id==='hero');assert.ok(hero.maxHp>0);
  // Deliberate low-health unit probe of a real converted world, not a claimed
  // manually played wound. Saved encounter units remain untouched.
  hero.hp=1;const before=Game.serialize(state);assert.equal(audioDirection(state,'game',world).mood,'urgent');assert.equal(Game.serialize(state),before);
});
test('new original percussion samples are finite, click-free, bounded and independent of gameplay RNG',()=>{
  const original=Math.random;Math.random=()=>{throw Error('No shared RNG');};
  try{for(const mood of ['engaged','urgent']){
    const a=adaptiveScoreSamples(mood);assert.deepEqual(a,adaptiveScoreSamples(mood));
    assert.equal(a.samples[0],0);assert.equal(a.samples.at(-1),0);assert.ok(a.samples.every(x=>Number.isFinite(x)&&Math.abs(x)<.6));
    assert.ok(Math.max(...a.samples)>.1);assert.ok(a.samples.byteLength<256*1024);
  }}finally{Math.random=original;}
  assert.equal(adaptiveScoreSamples('silent'),null);assert.notDeepEqual(adaptiveScoreSamples('urgent'),adaptiveScoreSamples('engaged'));
});
test('accepted friendly orders have distinct bounded signals; previews, delayed receipt and enemy orders stay silent',()=>{
  const world={squads:[{id:'friend',side:'ally'},{id:'foe',side:'enemy'}]},plans=[];
  for(const [order,cue]of [['hold','order-hold'],['withdraw','order-withdraw'],['advance','order-advance']]){
    assert.equal(commandSoundCue([{kind:'order',squadId:'friend',order}],world),cue);
    assert.equal(commandSoundCue([{kind:'order-given',squadId:'friend',order}],world),null);
    assert.equal(commandSoundCue([{kind:'order',squadId:'foe',order}],world),null);
    const plan=battleSoundPlan(cue);plans.push(JSON.stringify(plan.layers));assert.ok(plan.layers.length<=3);assert.ok(plan.layers.every(l=>l.offset+l.duration<=1.3));
  }
  assert.equal(new Set(plans).size,3);
  const signals={hold:'order-hold',restore:'order-rally',withdraw:'order-withdraw',line:'order-hold','shield-wall':'order-hold',wedge:'order-advance',lie_in_wait:'order-hold',advance:'order-advance',attack:'order-advance',
    // Release 7's horse orders.
    charge:'order-advance',feigned_retreat:'order-withdraw'};
  assert.deepEqual(Object.keys(signals).sort(),Object.keys(ORDERS).sort(),'cover the public command vocabulary');
  for(const [order,cue]of Object.entries(signals))assert.equal(commandSoundCue([{kind:'order',squadId:'friend',order}],world),cue);
  assert.notDeepEqual(battleSoundPlan('impact',{material:'cloth'}),battleSoundPlan('impact',{material:'metal'}));
  assert.notDeepEqual(battleSoundPlan('clash',{variant:1}).layers[1].partials,battleSoundPlan('clash',{variant:2}).layers[1].partials);
});
