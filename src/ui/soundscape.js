import {SOUND_FILES,VOICE_LINES,foleyFor,soundscapeFor} from './soundscape-data.js';

const level=(value,fallback=.5)=>Number.isFinite(Number(value))?Math.min(1,Math.max(0,Number(value))):fallback;
const MAX_DECODED_BYTES=24*1024*1024,MAX_EFFECTS=8;
export const foleyGain=(id,peak)=>Number.isFinite(peak)&&peak>0?Math.min(40,(id==='foley-step'?.4:.8)/peak):0;
function foleyPlayback(buffer,id){
  let peak=0;for(let channel=0;channel<buffer.numberOfChannels;channel++){const samples=buffer.getChannelData(channel);for(let i=0;i<samples.length;i++)peak=Math.max(peak,Math.abs(samples[i]));}
  const threshold=Math.min(.012,peak*.08);let first=buffer.length;
  for(let channel=0;channel<buffer.numberOfChannels;channel++){const samples=buffer.getChannelData(channel);for(let i=0;i<Math.min(samples.length,buffer.sampleRate*.55);i++)if(Math.abs(samples[i])>threshold){first=Math.min(first,i);break;}}
  return {normalization:foleyGain(id,peak),start:first<Math.min(buffer.length,buffer.sampleRate*.55)?Math.max(0,(first-128)/buffer.sampleRate):0};
}

/** A gesture-unlocked, bounded local mixer. Audio never owns campaign state. */
export function createSoundscape({AudioContext:Context=globalThis.AudioContext??globalThis.webkitAudioContext,fetch:fetchFile=globalThis.fetch,document:page=globalThis.document,onCaption=()=>{},onUnavailable=()=>{},now=()=>globalThis.performance?.now()??Date.now()}={}){
  let context=null,master=null,disposed=false,unlocked=false,generation=0,powerGeneration=0,voice=null,voiceRequest=0,bytes=0,stamp=0,decodeTail=Promise.resolve();
  let settings={audio:false,audioVolume:.5,music:false,ambience:false,voices:false,soundtrackVolume:.45},scene={music:null,ambience:null},sceneKey=null;
  const cache=new Map(),pending=new Map(),loops=new Map(),retiring=new Map(),effects=new Set(),live=new Set(),requests=new Set(),failures=new Map();
  const active=()=>!disposed&&!page?.hidden&&unlocked&&context?.state==='running';
  const enabled=()=>[settings.audio,settings.music,settings.ambience,settings.voices].some(Boolean);
  function gain(node,value,seconds=.3){const p=node.gain,t=context.currentTime;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(value,t+seconds);}
  function stopNode(entry,fade=0){if(!entry)return;const fading=fade&&active();try{if(fading){gain(entry.gain,0,fade);entry.source.stop(context.currentTime+fade+.02);}else entry.source.stop();}catch{}if(!fading)entry.cleanup();}
  function make(buffer,{id,volume=1,pan=0,loop=false,start=0}={}){
    const source=context.createBufferSource(),g=context.createGain(),p=context.createStereoPanner?.();
    source.buffer=buffer;source.loop=loop;g.gain.value=volume;source.connect(g);
    if(p){p.pan.value=level((pan+1)/2)*2-1;g.connect(p);p.connect(master);}else g.connect(master);
    const entry={id,source,gain:g,pan:p};let ended=false;entry.cleanup=()=>{if(ended)return;ended=true;source.disconnect();g.disconnect();p?.disconnect();effects.delete(entry);live.delete(entry);for(const [key,item]of retiring)if(item===entry)retiring.delete(key);};
    source.onended=entry.cleanup;live.add(entry);try{source.start(0,start);return entry;}catch{entry.cleanup();return null;}
  }
  function evict(required){
    const protectedIds=new Set([...live].map(item=>item.id));
    for(const [id,item]of [...cache].sort((a,b)=>a[1].used-b[1].used)){
      if(bytes+required<=MAX_DECODED_BYTES)break;if(protectedIds.has(id))continue;cache.delete(id);bytes-=item.bytes;
    }
    // A crossfade is optional. End an old tail before rejecting the incoming
    // scene when both decoded music recordings would exceed the PCM budget.
    for(const entry of [...retiring.values()]){
      if(bytes+required<=MAX_DECODED_BYTES)break;stopNode(entry);
      const item=cache.get(entry.id);if(item&&![...live].some(node=>node.id===entry.id)){cache.delete(entry.id);bytes-=item.bytes;}
    }
  }
  async function buffer(id){
    if(cache.has(id)){const item=cache.get(id);item.used=++stamp;return item.buffer;}
    if(pending.has(id))return pending.get(id);
    if((failures.get(id)?.retryAt??0)>now())return null;
    if(!SOUND_FILES[id]||!context||disposed)return null;
    const controller=typeof AbortController==='function'?new AbortController():null;if(controller)requests.add(controller);
    const request=(async()=>{try{
      const response=await fetchFile(SOUND_FILES[id],controller?{signal:controller.signal}:undefined);if(!response.ok)throw new Error('Unavailable recording');
      const data=await response.arrayBuffer();if(data.byteLength>4*1024*1024)throw new Error('Recording too large');
      // Decode one recording at a time. Concurrent scene/voice requests share
      // pending work and cannot allocate a whole campaign of PCM simultaneously.
      const task=decodeTail.then(()=>disposed?null:context.decodeAudioData(data));decodeTail=task.catch(()=>null);
      const decoded=await task;if(!decoded)return null;const size=decoded.length*decoded.numberOfChannels*4;
      if(disposed)return null;if(!Number.isFinite(size)||size<=0||size>MAX_DECODED_BYTES)throw new Error('Decoded recording too large');evict(size);if(bytes+size>MAX_DECODED_BYTES)return null;
      cache.set(id,{buffer:decoded,bytes:size,used:++stamp,...(id.startsWith('foley-')?foleyPlayback(decoded,id):{})});bytes+=size;failures.delete(id);return decoded;
    }catch{if(!disposed){const attempts=(failures.get(id)?.attempts??0)+1;failures.set(id,{attempts,retryAt:now()+Math.min(60000,1000*2**Math.min(6,attempts))});onUnavailable(id);}return null;}finally{pending.delete(id);if(controller)requests.delete(controller);}})();pending.set(id,request);return request;
  }
  function musicVolume(){return settings.soundtrackVolume*.32*(voice?.35:1);}
  function stopVoice(){voiceRequest++;if(voice)stopNode(voice);voice=null;onCaption(null);const music=loops.get('music');if(music)gain(music.entry.gain,musicVolume());}
  function stopEffects(){for(const item of [...effects])stopNode(item);effects.clear();}
  function stopAll(){generation++;powerGeneration++;stopVoice();for(const item of [...live])stopNode(item);loops.clear();retiring.clear();effects.clear();}
  async function syncLoop(channel,id){
    const current=loops.get(channel),enabled=settings[channel]&&id&&active();
    if(current?.id===id&&enabled){gain(current.entry.gain,channel==='music'?musicVolume():settings.soundtrackVolume*.52);return;}
    if(!enabled){stopNode(retiring.get(channel));retiring.delete(channel);if(current){stopNode(current.entry);loops.delete(channel);}return;}
    if(current){stopNode(retiring.get(channel));retiring.set(channel,current.entry);stopNode(current.entry,.45);loops.delete(channel);}
    if(!enabled)return;const token=generation,decoded=await buffer(id);
    if(!decoded||token!==generation||!active()||!settings[channel]||scene[channel]!==id||loops.has(channel))return;
    const entry=make(decoded,{id,volume:0,loop:true});if(!entry)return;loops.set(channel,{id,entry});gain(entry.gain,channel==='music'?musicVolume():settings.soundtrackVolume*.52,.8);
  }
  function sync(){if(!active())return;void syncLoop('music',scene.music);void syncLoop('ambience',scene.ambience);if(settings.audio)for(const id of ['foley-step','foley-shield','foley-impact'])void buffer(id);}
  function configure(next={}){
    if(disposed)return;
    const previous=settings;settings={...settings,...next,audioVolume:level(next.audioVolume??settings.audioVolume),soundtrackVolume:level(next.soundtrackVolume??settings.soundtrackVolume,.45)};
    if(!settings.voices&&previous.voices)stopVoice();if(!settings.audio)stopEffects();
    if(voice)gain(voice.gain,settings.soundtrackVolume*.95,.1);
    if(!enabled()){stopAll();void context?.suspend().catch(()=>{});}else sync();
  }
  async function unlock(){
    if(disposed||!Context||page?.hidden||!enabled())return false;
    const token=powerGeneration;
    try{if(!context){context=new Context();master=context.createGain();master.gain.value=.8;const limiter=context.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=15;limiter.ratio.value=8;master.connect(limiter);limiter.connect(context.destination);}
      await context.resume();if(disposed||page?.hidden||!enabled()||token!==powerGeneration){if(!disposed&&(page?.hidden||!enabled()))void context.suspend().catch(()=>{});return false;}unlocked=true;sync();return true;
    }catch{return false;}
  }
  function update(state,screen){if(disposed)return;const next=soundscapeFor(state,screen),key=[screen??'game',state?.chapter,state?.phase,state?.encounterIndex,state?.encounter?.id].join('|');if(key!==sceneKey){stopVoice();sceneKey=key;}if(next.music!==scene.music||next.ambience!==scene.ambience){generation++;scene=next;}sync();}
  async function speak(id){
    if(!VOICE_LINES[id]||!settings.voices)return false;stopVoice();const request=++voiceRequest;
    if(!await unlock()||request!==voiceRequest)return false;const decoded=await buffer('voice-'+id);
    if(!decoded||request!==voiceRequest||!settings.voices||!active())return false;
    voice=make(decoded,{id:'voice-'+id,volume:settings.soundtrackVolume*.95});if(!voice)return false;const spoken=voice;
    const cleanup=voice.source.onended;voice.source.onended=()=>{cleanup();if(voice===spoken){voice=null;onCaption(null);const music=loops.get('music');if(music)gain(music.entry.gain,musicVolume(),.6);}};
    const music=loops.get('music');if(music)gain(music.entry.gain,musicVolume(),.15);onCaption(VOICE_LINES[id]);return true;
  }
  function cue(kind,{intensity=.7,pan=0}={}){
    if(!settings.audio||!active()||effects.size>=MAX_EFFECTS)return false;
    const id=foleyFor(kind),record=cache.get(id),decoded=record?.buffer;if(!decoded||!record.normalization)return false;record.used=++stamp;
    // Skip leading digital silence in a short recording; the impact remains on the visual contact frame.
    const entry=make(decoded,{id,volume:settings.audioVolume*level(intensity)*.65*record.normalization,pan,start:record.start});if(!entry)return false;effects.add(entry);return true;
  }
  const visibility=()=>{if(page?.hidden){stopAll();void context?.suspend().catch(()=>{});}else if(unlocked)void unlock();};page?.addEventListener('visibilitychange',visibility);
  return {configure,unlock,update,speak,stopVoice,cue,stopEffects,stop:stopAll,stats:()=>({decodedBytes:bytes,cached:cache.size,pending:pending.size,effects:effects.size,loops:loops.size,fadingLoops:retiring.size,sources:live.size,voice:Boolean(voice),unlocked}),
    dispose(){if(disposed)return;stopAll();disposed=true;page?.removeEventListener('visibilitychange',visibility);for(const request of requests)request.abort();requests.clear();pending.clear();cache.clear();failures.clear();bytes=0;void context?.close().catch(()=>{});}};
}

let shared;
export function campaignSoundscape(){return shared??=createSoundscape({onCaption:line=>{const node=globalThis.document?.querySelector('#voice-caption');if(!node)return;node.hidden=!line;node.textContent=line?`${line.speaker}: ${line.text}`:'';}});}
