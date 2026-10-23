import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundscape,foleyGain} from '../src/ui/soundscape.js';
import {SOUND_FILES,VOICE_LINES,soundscapeFor,briefingFor} from '../src/ui/soundscape-data.js';

const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function platform({size=65536,fail=[],amplitude=.3}={}){
  const contexts=[],listeners=new Map(),calls=[],captions=[],unavailable=[],held=new Map(),clock={now:0},page={hidden:false,addEventListener:(id,fn)=>listeners.set(id,fn),removeEventListener:id=>listeners.delete(id)};
  const param=()=>({value:0,events:[],cancelScheduledValues(){},setValueAtTime(value){this.value=value;},linearRampToValueAtTime(value,at){this.value=value;this.events.push({value,at});}});
  const node=()=>({disconnected:false,connect(target){this.target=target;},disconnect(){this.disconnected=true;}});
  class Context{
    constructor(){this.currentTime=1;this.state='suspended';this.destination=node();this.sources=[];this.filters=[];this.decodeCount=0;contexts.push(this);}
    createGain(){return {...node(),gain:param()};}
    createStereoPanner(){return {...node(),pan:param()};}
    createBiquadFilter(){const filter={...node(),frequency:param(),Q:param()};this.filters.push(filter);return filter;}
    createDynamicsCompressor(){return {...node(),threshold:param(),knee:param(),ratio:param()};}
    createBuffer(channels,length,sampleRate){const samples=new Float32Array(length);return {numberOfChannels:channels,length,sampleRate,getChannelData:()=>samples};}
    createBufferSource(){const source={...node(),start(at,offset){this.started=[at,offset];},stop(at){this.stopped=at??0;},end(){this.onended?.();}};this.sources.push(source);return source;}
    async resume(){this.state='running';}
    async suspend(){this.state='suspended';}
    async close(){this.state='closed';}
    async decodeAudioData(data){this.decodeCount++;const id=data.id,length=(typeof size==='function'?size(id):size)/4;return {id,length,numberOfChannels:1,sampleRate:8000,getChannelData:()=>Float32Array.from({length:512},(_,i)=>i>256?amplitude:0)};}
  }
  const response=id=>({ok:!fail.includes(id),arrayBuffer:async()=>Object.assign(new ArrayBuffer(8),{id})});
  const fetch=async(url,options)=>{const id=Object.keys(SOUND_FILES).find(key=>SOUND_FILES[key]===url);calls.push({id,signal:options?.signal});if(held.has(id))await held.get(id).promise;return response(id);};
  const sound=createSoundscape({AudioContext:Context,fetch,document:page,onCaption:line=>captions.push(line),onUnavailable:id=>unavailable.push(id),now:()=>clock.now});
  return {sound,contexts,page,listeners,calls,captions,unavailable,held,clock};
}
const field=(chapter=1)=>({chapter,phase:'encounter',encounterIndex:0,encounter:{id:`ch${chapter}-field`,kind:'battle'}});
const court=()=>({chapter:11,phase:'encounter',encounterIndex:0,encounter:{id:'ch11-accounts',kind:'contest'}});

test('Local mixer waits for explicit opt-in and a gesture; repeated updates share each load and loop',async()=>{
  const p=platform(),s=p.sound;s.update(field());assert.equal(await s.unlock(),false);assert.equal(p.contexts.length,0);assert.equal(p.calls.length,0);
  s.configure({music:true,ambience:true,audio:true});assert.equal(p.calls.length,0);await s.unlock();for(let i=0;i<10;i++)s.update(field());await settle();
  assert.equal(s.stats().loops,2);assert.equal(s.stats().sources,2);assert.equal(new Set(p.calls.map(c=>c.id)).size,p.calls.length);s.dispose();
});

test('Room transitions filter existing ambience; bounded local foley respects ambience mute and releases every source',async()=>{
  const p=platform(),s=p.sound;s.update(field());assert.equal(s.environmentCue('river'),false);
  s.configure({ambience:true,audio:true});await s.unlock();await settle();
  const filter=p.contexts[0].filters[0],open=filter.frequency.value;s.setSpace({enclosed:true});assert.ok(filter.frequency.value<open);s.setSpace({enclosed:false});assert.equal(filter.frequency.value,open);
  for(const kind of ['river','wind','workshop','room'])assert.equal(s.environmentCue(kind),true);
  assert.equal(s.stats().environmentBuffers,4);assert.equal(s.cue('footstep',{surface:'stone'}),false,'Paving uses the surface-aware stage foley.');
  s.configure({ambience:false});assert.equal(s.stats().effects,0);assert.equal(s.environmentCue('river'),false);
  s.dispose();assert.equal(s.stats().environmentBuffers,0);assert.equal(s.stats().sources,0);
});

test('Mute or hide during a pending resume cannot reopen the mixer or allocate a late source',async()=>{
  for(const cause of ['mute','hidden','dispose']){
    const p=platform(),s=p.sound;s.configure({music:true});await s.unlock();await settle();const c=p.contexts[0],wait=deferred();
    c.resume=async()=>{await wait.promise;c.state='running';};const unlock=s.unlock();
    if(cause==='mute')s.configure({music:false});else if(cause==='hidden'){p.page.hidden=true;p.listeners.get('visibilitychange')();}else s.dispose();
    wait.resolve();assert.equal(await unlock,false);assert.equal(s.stats().sources,0);assert.equal(s.cue('impact'),false);if(cause!=='dispose')assert.equal(c.state,'suspended');s.dispose();
  }
});

test('Only the latest requested scene starts after out-of-order downloads',async()=>{
  const p=platform(),s=p.sound;for(const id of ['music-battle','ambience-frontier'])p.held.set(id,deferred());
  s.configure({music:true,ambience:true});s.update(field());await s.unlock();s.update(court());await settle();
  assert.deepEqual(p.contexts[0].sources.map(x=>x.buffer.id).sort(),['ambience-council','music-council']);
  for(const hold of p.held.values())hold.resolve();await settle();assert.equal(s.stats().sources,2);s.dispose();
});

test('Rapid scene transitions keep at most one fading tail per channel and mute disconnects every tail',async()=>{
  const p=platform(),s=p.sound;s.configure({music:true,ambience:true});s.update(field());await s.unlock();await settle();
  for(const state of [court(),field(5),field(),court(),field(9)]){s.update(state);await settle();assert.ok(s.stats().sources<=4);assert.ok(s.stats().fadingLoops<=2);}
  const c=p.contexts[0];s.configure({music:false,ambience:false});assert.equal(s.stats().sources,0);assert.ok(c.sources.every(source=>source.disconnected));s.dispose();
});

test('Narration latest-request cancellation, ducking, scene cancellation and volume changes remain coherent',async()=>{
  const p=platform(),s=p.sound;s.configure({music:true,voices:true,soundtrackVolume:.5});s.update(field());await s.unlock();await settle();
  p.held.set('voice-arrival',deferred());const old=s.speak('arrival');await settle();assert.equal(await s.speak('varro'),true);
  p.held.get('voice-arrival').resolve();assert.equal(await old,false);const c=p.contexts[0],music=c.sources.find(x=>x.buffer.id==='music-battle'),voice=c.sources.find(x=>x.buffer.id==='voice-varro');
  assert.equal(p.captions.at(-1),VOICE_LINES.varro);assert.ok(music.target.gain.value<.5*.32);s.configure({soundtrackVolume:.2});assert.equal(voice.target.gain.value,.2*.95);
  s.update(field(3));assert.equal(s.stats().voice,false);assert.ok(voice.disconnected);assert.equal(p.captions.at(-1),null);assert.equal(music.target.gain.value,.2*.32);s.dispose();
});

test('Effect cap releases immediately on cancellation without stopping score, ambience or narration',async()=>{
  const p=platform(),s=p.sound;s.configure({music:true,ambience:true,audio:true,voices:true});s.update(field());await s.unlock();await settle();await s.speak('rally');
  for(let i=0;i<8;i++)assert.equal(s.cue('block'),true);assert.equal(s.cue('block'),false);assert.equal(s.stats().effects,8);
  s.stopEffects();assert.equal(s.stats().effects,0);assert.equal(s.stats().loops,2);assert.equal(s.stats().voice,true);assert.equal(s.cue('footstep'),true);
  s.configure({audio:false});assert.equal(s.stats().effects,0);assert.equal(s.stats().loops,2);s.dispose();
});

test('PCM memory stays bounded and an old crossfade yields capacity to the new scene',async()=>{
  const p=platform({size:8*1024*1024}),s=p.sound;s.configure({music:true,ambience:true});s.update(field());await s.unlock();await settle();
  s.update(court());await settle();assert.equal(s.stats().loops,2);assert.ok(s.stats().decodedBytes<=24*1024*1024);assert.ok(p.contexts[0].sources.filter(x=>!x.disconnected).some(x=>x.buffer.id==='ambience-council'));s.dispose();assert.equal(s.stats().decodedBytes,0);
});

test('Failed recordings do not prevent other channels, and disposing aborts pending fetches without late audio',async()=>{
  const p=platform({fail:['music-battle']}),s=p.sound;s.configure({music:true,ambience:true});s.update(field());await s.unlock();await settle();
  assert.equal(s.stats().loops,1);assert.deepEqual(p.unavailable,['music-battle']);p.held.set('voice-varro',deferred());s.configure({voices:true});const pending=s.speak('varro');await settle();
  s.dispose();assert.equal(p.listeners.size,0);assert.equal(s.stats().pending,0);assert.ok(p.calls.find(x=>x.id==='voice-varro').signal.aborted);p.held.get('voice-varro').resolve();assert.equal(await pending,false);assert.equal(s.stats().sources,0);
});

test('PCM decoding is serialized and page hiding cancels voice plus all pending play intents',async()=>{
  const p=platform(),s=p.sound;s.configure({voices:true});await s.unlock();const c=p.contexts[0],wait=deferred(),decode=c.decodeAudioData.bind(c);let concurrent=0,max=0;
  c.decodeAudioData=async data=>{concurrent++;max=Math.max(max,concurrent);await wait.promise;const value=await decode(data);concurrent--;return value;};
  const first=s.speak('arrival');await settle();const second=s.speak('council');await settle();p.page.hidden=true;p.listeners.get('visibilitychange')();wait.resolve();
  assert.equal(await first,false);assert.equal(await second,false);assert.equal(max,1);assert.equal(s.stats().sources,0);s.dispose();
});

test('Scene and briefing selection is read-only, all references are bundled recordings and unsupported audio is optional',async()=>{
  const state=Object.freeze({...court(),encounter:Object.freeze(court().encounter)});assert.deepEqual(soundscapeFor(state),{music:'music-council',ambience:'ambience-council'});assert.equal(briefingFor(state).id,'council');assert.equal(Object.keys(SOUND_FILES).length,14);
  for(const url of Object.values(SOUND_FILES))assert.match(url,/assets\/audio\/[^/]+\.mp3$/);
  const unsupported=createSoundscape({AudioContext:null,document:null});unsupported.configure({music:true});assert.equal(await unsupported.unlock(),false);assert.equal(unsupported.cue('impact'),false);unsupported.dispose();
});

test('Repeated renders cannot hammer a missing recording; retry backoff recovers when its local file returns',async()=>{
  const failures=['music-battle'],p=platform({fail:failures}),s=p.sound;s.configure({music:true});s.update(field());await s.unlock();await settle();
  for(let i=0;i<100;i++){s.update(field());s.configure({music:true});}await settle();assert.equal(p.calls.length,1);
  p.clock.now=2001;s.update(field());await settle();assert.equal(p.calls.length,2);for(let i=0;i<100;i++)s.update(field());await settle();assert.equal(p.calls.length,2);
  failures.length=0;p.clock.now=6002;s.update(field());await settle();assert.equal(p.calls.length,3);assert.equal(s.stats().loops,1);s.dispose();
});

test('Measured quiet footstep gets bounded playback gain, audible onset and no modification to decoded samples',async()=>{
  assert.ok(foleyGain('foley-step',.0115585)>34&&foleyGain('foley-step',.0115585)<35);assert.equal(foleyGain('foley-step',.000001),40);assert.equal(foleyGain('foley-step',0),0);assert.ok(foleyGain('foley-impact',1.0247)<1);
  const p=platform({amplitude:.0115585}),s=p.sound;s.configure({audio:true,audioVolume:.5});await s.unlock();await settle();assert.equal(s.cue('footstep',{intensity:.4}),true);
  const source=p.contexts[0].sources[0],peak=source.buffer.getChannelData(0)[300];assert.ok(Math.abs(peak-.0115585)<1e-8);assert.ok(source.target.gain.value>4&&source.target.gain.value<5);assert.ok(source.started[1]>0,'Quiet recording uses a peak-relative onset threshold.');s.dispose();
});

test('V034 public battlefield pressure changes existing loop colour and clarity without new voices, downloads or repeated fade restarts',async()=>{
  const p=platform(),s=p.sound,state=field(5);state.encounter.units=[{id:'hero',side:'player',hp:10,maxHp:10,x:1,y:1}];
  s.configure({music:true,ambience:true});s.update(state);await s.unlock();await settle();
  const c=p.contexts[0],music=c.sources.find(x=>x.buffer.id==='music-battle'),ambience=c.sources.find(x=>x.buffer.id==='ambience-dry'),musicFilter=music.target.target,ambientFilter=ambience.target.target;
  const originalGain=music.target.gain.value,originalCutoff=musicFilter.frequency.value,calls=p.calls.length,sources=c.sources.length;
  state.encounter.units[0].hp=2;s.update(state);await settle();
  assert.equal(s.stats().direction.mood,'urgent');assert.ok(music.target.gain.value<originalGain,'The score recedes so commands and contacts stay audible');
  assert.ok(musicFilter.frequency.value>originalCutoff,'Tension retains brighter musical transients');assert.ok(ambientFilter.frequency.value<5700);
  const ramps=musicFilter.frequency.events.length;
  for(let i=0;i<50;i++)s.update(state);await settle();assert.equal(musicFilter.frequency.events.length,ramps,'Stable rendering does not restart envelopes');
  assert.equal(p.calls.length,calls);assert.equal(c.sources.length,sources);assert.equal(s.stats().loops,2);
  s.configure({music:false,ambience:false});assert.equal(s.stats().sources,0);assert.ok(c.filters.every(f=>f.disconnected));s.dispose();
});

test('V034 narration restores the pressure mix and rain transitions retain bounded tails and hidden-page cancellation',async()=>{
  const p=platform(),s=p.sound,state=field(5);state.encounter.turn=8;state.encounter.turnLimit=9;
  s.configure({music:true,ambience:true,voices:true});s.update(state);await s.unlock();await settle();
  const c=p.contexts[0],music=c.sources.find(x=>x.buffer.id==='music-battle'),urgentGain=music.target.gain.value;
  await s.speak('rally');assert.ok(music.target.gain.value<urgentGain);c.sources.find(x=>x.buffer.id==='voice-rally').end();assert.equal(music.target.gain.value,urgentGain);
  state.encounter.weather='rain';s.update(state);await settle();assert.ok(c.sources.some(x=>x.buffer.id==='ambience-rain'));assert.ok(s.stats().sources<=4);
  p.page.hidden=true;p.listeners.get('visibilitychange')();assert.equal(s.stats().sources,0);assert.ok(c.filters.every(f=>f.disconnected));
  s.update(state);await settle();assert.equal(s.stats().sources,0);s.dispose();
});
