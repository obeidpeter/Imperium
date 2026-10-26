import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleSound,battleSoundPlan,BATTLE_SOUND_LIMITS} from '../src/showcase/battle-sound.js';

function platform(){
  const contexts=[],listeners=new Map(),page={hidden:false,addEventListener:(kind,fn)=>listeners.set(kind,fn),removeEventListener:(kind,fn)=>{if(listeners.get(kind)===fn)listeners.delete(kind);}};
  const param=()=>({value:0,events:[],setValueAtTime(...args){this.events.push(['set',...args]);},linearRampToValueAtTime(...args){this.events.push(['linear',...args]);},exponentialRampToValueAtTime(...args){this.events.push(['exponential',...args]);},setTargetAtTime(...args){this.events.push(['target',...args]);}});
  const node=()=>({disconnected:false,connect(target){this.target=target;},disconnect(){this.disconnected=true;}});
  class Context{
    constructor(){this.state='suspended';this.sampleRate=8000;this.currentTime=4;this.destination=node();this.sources=[];this.buffers=[];this.filters=[];this.panners=[];contexts.push(this);}
    createGain(){return {...node(),gain:param()};}
    createStereoPanner(){const panner={...node(),pan:param()};this.panners.push(panner);return panner;}
    createDynamicsCompressor(){return {...node(),...Object.fromEntries(['threshold','knee','ratio','attack','release'].map(key=>[key,param()]))};}
    createBuffer(channels,length,rate){const samples=new Float32Array(length),buffer={duration:length/rate,getChannelData:()=>samples};this.buffers.push(buffer);return buffer;}
    createBiquadFilter(){const filter={...node(),frequency:param(),Q:param()};this.filters.push(filter);return filter;}
    createBufferSource(){const source={...node(),start(...args){this.started=args;},stop(at){this.stops??=[];this.stops.push(at);},end(){this.onended?.();}};this.sources.push(source);return source;}
    async resume(){this.state='running';}
    async suspend(){this.state='suspended';}
    async close(){this.state='closed';}
  }
  return {contexts,page,listeners,Context,create:(extra={})=>createBattleSound({AudioContext:Context,document:page,...extra})};
}

test('Original foley plans are bounded, distinct and pure; invalid or silent cues produce no layers',()=>{
  const options=Object.freeze({side:'enemy',intensity:.6}),plans=['footstep','shield','guard','inspire','agreement','clash','javelin','bow','impact','cloth','wind'].map(kind=>battleSoundPlan(kind,options));
  assert.equal(new Set(plans.map(plan=>JSON.stringify(plan.layers))).size,11);
  for(const plan of plans){
    assert.deepEqual(plan,battleSoundPlan(plan.kind,options));
    assert.ok(plan.layers.length>0&&plan.layers.length<=3);
    for(const layer of plan.layers){assert.ok(layer.duration+layer.offset<=BATTLE_SOUND_LIMITS.maxCueSeconds);assert.ok(layer.attack>0&&layer.attack<layer.duration);assert.ok(layer.gain>0&&layer.gain<=.32);assert.ok(['noise','ring'].includes(layer.source));}
  }
  assert.equal(battleSoundPlan('unknown').layers.length,0);assert.equal(battleSoundPlan('impact',{intensity:0}).layers.length,0);
  assert.deepEqual(battleSoundPlan('throw'),battleSoundPlan('javelin'));
  assert.deepEqual(battleSoundPlan('ward'),battleSoundPlan('guard'));
  assert.deepEqual(battleSoundPlan('rally'),battleSoundPlan('inspire'));
  assert.deepEqual(battleSoundPlan('seal'),battleSoundPlan('agreement'));
  const first=battleSoundPlan('shield');first.layers[1].partials[0][0]=1;assert.notEqual(battleSoundPlan('shield').layers[1].partials[0][0],1);
});

test('Sound is silent and allocates no audio context until both enabled and explicitly unlocked',async()=>{
  const p=platform(),sound=p.create();assert.equal(await sound.unlock(),false);assert.equal(sound.cue('clash'),false);assert.equal(p.contexts.length,0);
  sound.setEnabled(true,.5);assert.equal(sound.cue('footstep'),false);assert.equal(p.contexts.length,0);
  assert.equal(await sound.unlock(),true);assert.equal(sound.cue('footstep'),true);
  const context=p.contexts[0];assert.equal(context.sources.length,3);assert.ok(context.filters.some(f=>f.type==='bandpass'));
  sound.setEnabled(false);assert.equal(context.state,'suspended');assert.equal(sound.cue('clash'),false);assert.ok(context.sources.every(s=>s.disconnected));
  sound.dispose();assert.equal(context.state,'closed');assert.equal(p.listeners.size,0);
});

test('Voice budget rejects a whole event, returns capacity on completion, and stop disconnects scheduled tails',async()=>{
  const p=platform(),sound=p.create();sound.setEnabled(true,1);await sound.unlock();let played=0;
  for(let i=0;i<100;i++)played+=Number(sound.cue('shield'));
  const context=p.contexts[0];assert.equal(played,Math.floor(BATTLE_SOUND_LIMITS.voices/3));assert.ok(context.sources.length<=BATTLE_SOUND_LIMITS.voices);
  context.sources.forEach(s=>s.end());assert.equal(sound.cue('bow'),true);
  sound.stop();assert.ok(context.sources.every(s=>s.disconnected));assert.equal(sound.cue('wind'),false);
  sound.dispose();sound.dispose();assert.equal(await sound.unlock(),false);
});

test('Committed contact can replace quiet walking tails without exceeding the live voice budget',async()=>{
  const p=platform(),sound=p.create();sound.setEnabled(true,.4);await sound.unlock();
  for(let i=0;i<6;i++)assert.equal(sound.cue('footstep'),true);
  const context=p.contexts[0],footsteps=[...context.sources];assert.equal(footsteps.length,18);
  assert.equal(sound.cue('block'),true,'A shield contact remains audible when incidental walking almost fills the budget.');
  assert.equal(context.sources.filter(s=>!s.disconnected).length,20);assert.equal(footsteps.filter(s=>s.disconnected).length,1);
  assert.equal(sound.cue('swing'),false,'A quiet extra swing cannot evict an impact or exceed capacity.');
  sound.dispose();assert.ok(context.sources.every(s=>s.disconnected));
});

test('Footing changes actual synthesis recipes and a swing does not invent a metal collision',()=>{
  const dirt=battleSoundPlan('footstep',{surface:'grass'}),stone=battleSoundPlan('footstep',{surface:'stone'}),swing=battleSoundPlan('swing');
  assert.notDeepEqual(dirt.layers,stone.layers);assert.ok(stone.layers[0].duration<dirt.layers[0].duration);
  assert.ok(swing.layers.length>0);assert.ok(swing.layers.every(l=>l.source==='noise'&&l.duration<.2&&l.gain<.1));
  const shield=battleSoundPlan('block');assert.ok(shield.layers.some(l=>l.source==='ring'&&l.partials[0][0]<250),'Wooden shield body has a low resonant mode.');
});

test('Material contacts, weapon swings and terrain footing differ; native spatial voices disconnect their panners',async()=>{
  const metal=battleSoundPlan('impact',{material:'metal'}),cloth=battleSoundPlan('impact',{material:'cloth'});
  assert.ok(metal.layers.some(l=>l.source==='ring'));assert.ok(cloth.layers.every(l=>l.source==='noise'));assert.notDeepEqual(metal.layers,cloth.layers);
  assert.notDeepEqual(battleSoundPlan('swing',{weapon:'spear'}).layers,battleSoundPlan('swing',{weapon:'knife'}).layers);
  const footing=['sand','wood','stone','grass','gravel'].map(surface=>JSON.stringify(battleSoundPlan('footstep',{surface}).layers));assert.equal(new Set(footing).size,5);
  const p=platform(),sound=p.create();sound.setEnabled(true);await sound.unlock();assert.equal(sound.cue('hoof',{pan:-.5}),true);
  const c=p.contexts[0];assert.ok(c.panners.length>0);assert.ok(c.panners.every(pan=>pan.pan.value===-.5));
  sound.stop();assert.ok(c.panners.every(pan=>pan.disconnected));sound.dispose();
});

test('Hiding the page immediately clears audio and a stale unlock cannot restart it',async()=>{
  const p=platform(),sound=p.create();sound.setEnabled(true);await sound.unlock();sound.cue('wind');
  p.page.hidden=true;p.listeners.get('visibilitychange')();assert.equal(p.contexts[0].state,'suspended');assert.ok(p.contexts[0].sources.every(s=>s.disconnected));
  assert.equal(await sound.unlock(),false);assert.equal(sound.cue('impact'),false);
  p.page.hidden=false;assert.equal(sound.cue('impact'),false,'Visibility alone must not resume sound');
  let resume;const context=p.contexts[0];context.resume=()=>new Promise(resolve=>{resume=()=>{context.state='running';resolve();};});
  const pending=sound.unlock();sound.setEnabled(false);resume();assert.equal(await pending,false);assert.equal(sound.cue('impact'),false);assert.equal(context.state,'suspended');
  sound.dispose();
});

test('An older gesture resolving after a newer one cannot revoke the current audio unlock',async()=>{
  const p=platform(),sound=p.create();sound.setEnabled(true);await sound.unlock();
  const context=p.contexts[0],pending=[];context.resume=()=>new Promise(resolve=>pending.push(resolve));
  const earlier=sound.unlock(),later=sound.unlock();pending[1]();assert.equal(await later,true);pending[0]();assert.equal(await earlier,false);
  assert.equal(sound.cue('footstep'),true);sound.dispose();
});

test('Synthesis uses local deterministic samples and audio-clock envelopes without game RNG or wall-clock timers',async()=>{
  const original=Math.random;Math.random=()=>{throw new Error('Global random must not be consumed');};
  const p=platform(),sound=p.create();
  try{
    sound.setEnabled(true);await sound.unlock();assert.equal(sound.cue('clash',{side:'enemy',intensity:.4}),true);
    const context=p.contexts[0];for(const buffer of context.buffers){const values=buffer.getChannelData(0);assert.ok(values.every(Number.isFinite));assert.ok(values.every(v=>Math.abs(v)<=1));}
    for(const source of context.sources){assert.ok(source.started[0]>=context.currentTime);assert.ok(source.stops[0]-context.currentTime<=BATTLE_SOUND_LIMITS.maxCueSeconds+.01);}
    const noise=context.buffers[0].getChannelData(0);assert.ok(new Set(noise.slice(0,100)).size>95);
    const q=platform(),other=q.create();other.setEnabled(true);await other.unlock();assert.deepEqual(q.contexts[0].buffers[0].getChannelData(0),noise);other.dispose();
  }finally{Math.random=original;sound.dispose();}
});

test('Unsupported or rejected audio remains optional and cannot throw into gameplay',async()=>{
  const unsupported=createBattleSound({AudioContext:null,document:null});unsupported.setEnabled(true);assert.equal(await unsupported.unlock(),false);assert.equal(unsupported.cue('impact'),false);unsupported.dispose();
  class Denied{constructor(){throw new Error('Unavailable');}}
  const denied=createBattleSound({AudioContext:Denied,document:null});denied.setEnabled(true);assert.equal(await denied.unlock(),false);assert.equal(denied.cue('clash'),false);denied.dispose();
});

test('Recorded effects share interruption/mute/dispose cancellation and a failing recording falls back to native synthesis',async()=>{
  const p=platform();let recorded=0,stops=0,fail=false;const sound=p.create({recordedCue:()=>{if(fail)throw new Error('Recording unavailable');recorded++;return true;},stopRecordings:()=>{stops++;}});
  sound.setEnabled(true);await sound.unlock();assert.equal(sound.cue('clash'),true);assert.equal(recorded,1);assert.equal(p.contexts[0].sources.length,0);
  sound.stop();assert.equal(stops,1);await sound.unlock();fail=true;assert.equal(sound.cue('clash'),true);assert.ok(p.contexts[0].sources.length>0);
  sound.setEnabled(false);assert.equal(stops,2);sound.dispose();assert.equal(stops,3);
});
