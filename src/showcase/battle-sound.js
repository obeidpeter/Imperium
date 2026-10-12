// Original procedural foley. No recordings, imports, timers or gameplay RNG.
export const BATTLE_SOUND_LIMITS=Object.freeze({voices:20,bufferSeconds:2,maxCueSeconds:1.3});
const level=(value,fallback=1)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
const noise=(duration,gain,frequency,type='lowpass',offset=0,q=.7)=>({source:'noise',duration,gain,frequency,type,q,offset,attack:.003});
const ring=(duration,gain,partials,offset=0)=>({source:'ring',duration,gain,partials,offset,attack:.001,frequency:6200,type:'lowpass',q:.7});

/** Event-sized sound recipes; side changes texture, never gameplay or volume. */
export function battleSoundPlan(kind,{side='player',intensity=1}={}){
  const aliases={step:'footstep',move:'footstep',block:'shield',brace:'shield',metal:'clash',strike:'clash',throw:'javelin',arrow:'bow',hurt:'impact'};
  const key=aliases[kind]??kind,amount=level(intensity),texture=side==='enemy'?31:side==='ally'?17:5;
  let layers=[];
  if(key==='footstep')layers=[noise(.105,.32,175),noise(.13,.07,1900,'bandpass',.008,.85),noise(.095,.032,2800,'highpass',.045)];
  else if(key==='shield')layers=[noise(.11,.2,490),ring(.32,.16,[[731,1],[1319,.55],[2683,.2]]),noise(.055,.08,2800,'highpass')];
  else if(key==='clash')layers=[noise(.045,.1,1700,'highpass'),ring(.28,.12,[[1523,1],[2711,.55],[4327,.24]],.003),noise(.12,.06,550,'bandpass',.01)];
  else if(key==='javelin')layers=[{...noise(.18,.07,1600,'bandpass',0,.8),attack:.035,endFrequency:4100},noise(.075,.03,700,'bandpass',.025)];
  else if(key==='bow')layers=[noise(.032,.11,1800,'highpass'),ring(.12,.06,[[163,1],[467,.35],[919,.12]],.001),{...noise(.09,.045,2800,'bandpass',.02),endFrequency:1100}];
  else if(key==='impact')layers=[noise(.12,.28,200),noise(.085,.09,950,'bandpass',.004),noise(.13,.045,2200,'lowpass',.015)];
  else if(key==='cloth')layers=[{...noise(.19,.04,1300,'bandpass'),attack:.025,endFrequency:2300}];
  // A caller may request a single quiet gust. There is no self-starting loop.
  else if(key==='wind')layers=[{...noise(1.2,.027,620,'lowpass'),attack:.28,endFrequency:950}];
  return {kind:key,texture,layers:amount?layers.map(layer=>({...layer,gain:layer.gain*amount})):[]};
}

function whiteNoise(context){
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*BATTLE_SOUND_LIMITS.bufferSeconds),context.sampleRate),data=buffer.getChannelData(0);
  let state=0x51a7c0de;
  for(let i=0;i<data.length;i++){state^=state<<13;state^=state>>>17;state^=state<<5;data[i]=((state>>>0)/4294967296)*2-1;}
  return buffer;
}
function metalBuffer(context,layer){
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*layer.duration),context.sampleRate),data=buffer.getChannelData(0);
  const normalizer=layer.partials.reduce((sum,[,gain])=>sum+gain,0);
  for(let i=0;i<data.length;i++){
    const t=i/context.sampleRate;
    data[i]=layer.partials.reduce((sum,[frequency,gain],index)=>sum+Math.sin(t*frequency*Math.PI*2+index*.71)*gain*Math.exp(-t*(12+index*13)),0)/normalizer;
  }
  return buffer;
}

/** The optional argument is a platform seam for tests; ordinary use takes none. */
export function createBattleSound({AudioContext:Context=globalThis.AudioContext??globalThis.webkitAudioContext,document:page=globalThis.document}={}){
  let enabled=false,volume=.5,context=null,master=null,compressor=null,noiseBuffer=null,ready=false,disposed=false,generation=0,sequence=0;
  const voices=new Set(),rings=new Map();
  const hidden=()=>Boolean(page?.hidden);
  function cleanup(voice){
    if(!voices.delete(voice))return;
    voice.source.onended=null;
    for(const node of voice.nodes){try{node.disconnect();}catch{}}
  }
  function stop(){
    ready=false;generation++;
    for(const voice of [...voices]){try{voice.source.stop();}catch{}cleanup(voice);}
    try{context?.suspend()?.catch(()=>{});}catch{}
  }
  function setEnabled(value,nextVolume=volume){
    enabled=value===true;volume=level(nextVolume,.5);
    if(!enabled||!volume){stop();return;}
    if(master){try{master.gain.setTargetAtTime(volume*.7,context.currentTime,.012);}catch{}}
  }
  async function unlock(){
    if(disposed||!enabled||!volume||hidden()||!Context)return false;
    const token=++generation;
    try{
      if(!context){
        context=new Context();master=context.createGain();compressor=context.createDynamicsCompressor();
        master.gain.value=volume*.7;
        compressor.threshold.value=-15;compressor.knee.value=12;compressor.ratio.value=3;compressor.attack.value=.003;compressor.release.value=.09;
        master.connect(compressor);compressor.connect(context.destination);noiseBuffer=whiteNoise(context);
      }
      await context.resume();
      if(token!==generation){if(!enabled||!volume||hidden()){try{await context?.suspend();}catch{}}return false;}
      ready=!disposed&&enabled&&volume>0&&!hidden()&&context.state==='running';
      return ready;
    }catch{
      if(token===generation)ready=false;
      if(context&&(!master||!compressor||!noiseBuffer)){try{context.close()?.catch(()=>{});master?.disconnect();compressor?.disconnect();}catch{}context=null;master=null;compressor=null;noiseBuffer=null;}
      return false;
    }
  }
  function cue(kind,options={}){
    if(disposed||!enabled||!volume||!ready||hidden()||context?.state!=='running')return false;
    const plan=battleSoundPlan(kind,options);
    if(!plan.layers.length||voices.size+plan.layers.length>BATTLE_SOUND_LIMITS.voices)return false;
    const created=[],now=context.currentTime;
    try{
      sequence++;
      for(const layer of plan.layers){
        const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
        const voice={source,nodes:[source,filter,gain]};voices.add(voice);created.push(voice);source.onended=()=>cleanup(voice);
        filter.type=layer.type;filter.frequency.setValueAtTime(layer.frequency,now+layer.offset);filter.Q.value=layer.q;
        if(layer.endFrequency)filter.frequency.exponentialRampToValueAtTime(layer.endFrequency,now+layer.offset+layer.duration);
        const start=now+layer.offset,end=start+layer.duration;
        gain.gain.setValueAtTime(.00001,start);gain.gain.linearRampToValueAtTime(layer.gain,start+layer.attack);gain.gain.exponentialRampToValueAtTime(.00001,end);
        source.connect(filter);filter.connect(gain);gain.connect(master);
        if(layer.source==='ring'){
          const key=JSON.stringify([layer.duration,layer.partials]);if(!rings.has(key))rings.set(key,metalBuffer(context,layer));source.buffer=rings.get(key);source.start(start);
        }else{
          source.buffer=noiseBuffer;
          const offset=((sequence*47+plan.texture*13)%601)/1000;
          source.start(start,offset);
        }
        source.stop(end+.006);
      }
      return true;
    }catch{
      for(const voice of created){try{voice.source.stop();}catch{}cleanup(voice);}
      return false;
    }
  }
  const visibility=()=>{if(hidden())stop();};
  page?.addEventListener?.('visibilitychange',visibility);
  function dispose(){
    if(disposed)return;stop();disposed=true;page?.removeEventListener?.('visibilitychange',visibility);
    try{master?.disconnect();compressor?.disconnect();context?.close()?.catch(()=>{});}catch{}
    rings.clear();noiseBuffer=null;context=null;master=null;compressor=null;
  }
  return {unlock,setEnabled,cue,stop,dispose};
}
