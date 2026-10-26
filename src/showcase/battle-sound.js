// Original procedural foley with an optional caller-owned recording bridge.
// No imports, timers or gameplay RNG.
export const BATTLE_SOUND_LIMITS=Object.freeze({voices:20,bufferSeconds:2,maxCueSeconds:1.3});
const level=(value,fallback=1)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
const noise=(duration,gain,frequency,type='lowpass',offset=0,q=.7)=>({source:'noise',duration,gain,frequency,type,q,offset,attack:.003});
const ring=(duration,gain,partials,offset=0)=>({source:'ring',duration,gain,partials,offset,attack:.001,frequency:6200,type:'lowpass',q:.7});

/** Event-sized sound recipes; side changes texture, never gameplay or volume. */
export function battleSoundPlan(kind,{side='player',intensity=1,surface,material,weapon,variant=0}={}){
  const aliases={step:'footstep',move:'footstep',block:'shield',brace:'shield',ward:'guard',rally:'inspire',order:'inspire',formation:'cornu',munitiones:'fieldwork',seal:'agreement',metal:'clash',strike:'clash',throw:'javelin',arrow:'bow',hurt:'impact'};
  const key=aliases[kind]??kind,amount=level(intensity),texture=side==='enemy'?31:side==='ally'?17:5;
  let layers=[];
  if(key==='footstep'){
    const hard=['stone','chamber','road','wall'].includes(surface),sand=['sand','dust'].includes(surface),loose=['rock','rubble','gravel'].includes(surface),wood=['bridge','wood'].includes(surface);
    layers=wood?[noise(.08,.24,220),ring(.12,.07,[[217,1],[583,.4]],.005),noise(.06,.025,1400,'highpass',.02)]
      :[noise(hard?.075:sand?.15:.105,.29,hard?330:sand?110:175),noise(loose?.16:.10,hard?.095:loose?.11:.06,hard?2300:loose?3100:sand?750:1600,'bandpass',.008,.85),noise(.08,.028,2800,'highpass',.035)];
  }
  else if(key==='hoof')layers=[noise(.075,.27,240),ring(.09,.085,[[173,1],[379,.35]],.005),noise(.065,.10,900,'bandpass',.09)];
  else if(key==='wade')layers=[{...noise(.25,.16,1700,'bandpass',0,.9),attack:.012,endFrequency:420},noise(.09,.18,180),noise(.22,.06,4200,'highpass',.035)];
  else if(key==='speech')layers=[{...noise(.2,.075,1100,'bandpass'),attack:.045,endFrequency:2100},noise(.07,.08,340,'lowpass',.02)];
  else if(key==='vote')layers=[noise(.025,.11,800),ring(.13,.025,[[291,1],[613,.2]],.003)];
  else if(key==='agreement')layers=[noise(.03,.12,920,'bandpass'),ring(.21,.045,[[352,1],[704,.35],[1056,.15]],.004)];
  // The oval shield is a resonant wooden body with a metal boss, not a bell.
  else if(key==='shield')layers=[noise(.14,.27,270),ring(.23,.09,[[193,1],[731,.48],[1319,.15]]),noise(.035,.055,2600,'highpass')];
  else if(key==='guard')layers=[noise(.13,.24,250),ring(.26,.095,[[211,1],[643,.45],[1187,.2]],.004),noise(.04,.05,2200,'highpass',.01)];
  else if(key==='inspire')layers=[ring(.34,.09,[[264,1],[396,.65],[528,.35]],.005),{...noise(.22,.055,880,'bandpass',.01,.9),attack:.04,endFrequency:1320}];
  else if(key==='cornu')layers=[ring(.42,.11,[[196,1],[294,.78],[392,.52],[588,.25]],.004),{...noise(.28,.045,740,'bandpass',.015,1.1),attack:.045,endFrequency:1180}];
  else if(key==='fieldwork')layers=[noise(.11,.22,220),ring(.18,.075,[[184,1],[412,.45]],.006),noise(.09,.08,1450,'bandpass',.04)];
  else if(key==='clash')layers=[noise(.045,.1,1700,'highpass'),ring(.28,.12,[[1523,1],[2711,.55],[4327,.24]],.003),noise(.12,.06,550,'bandpass',.01)];
  else if(key==='javelin')layers=[{...noise(.18,.07,1600,'bandpass',0,.8),attack:.035,endFrequency:4100},noise(.075,.03,700,'bandpass',.025)];
  else if(key==='bow')layers=[noise(.032,.11,1800,'highpass'),ring(.12,.06,[[163,1],[467,.35],[919,.12]],.001),{...noise(.09,.045,2800,'bandpass',.02),endFrequency:1100}];
  else if(key==='impact')layers=/mail|scale|metal|plate/.test(String(material??''))?[noise(.12,.25,210),ring(.16,.065,[[887,1],[1607,.4],[2213,.2]],.004),noise(.075,.065,2900,'highpass',.008)]
    :[noise(.12,.28,200),noise(.085,.09,950,'bandpass',.004),noise(.13,.045,2200,'lowpass',.015)];
  else if(key==='swing')layers=[{...noise(weapon==='spear'?.15:weapon==='knife'?.07:.11,.065,weapon==='spatha'?730:weapon==='knife'?1450:950,'bandpass',0,.65),attack:.018,endFrequency:weapon==='spear'?1900:2800}];
  else if(key==='cloth')layers=[{...noise(.19,.04,1300,'bandpass'),attack:.025,endFrequency:2300}];
  // A caller may request a single quiet gust. There is no self-starting loop.
  else if(key==='wind')layers=[{...noise(1.2,.027,620,'lowpass'),attack:.28,endFrequency:950}];
  const colour=1+(((Math.abs(Number(variant)||0)%5)-2)*.022);
  return {kind:key,texture,layers:amount?layers.map(layer=>({...layer,gain:layer.gain*amount,frequency:layer.frequency*(variant?colour:1)})):[]};
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
export function createBattleSound({AudioContext:Context=globalThis.AudioContext??globalThis.webkitAudioContext,document:page=globalThis.document,recordedCue=null,stopRecordings=null}={}){
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
    try{stopRecordings?.();}catch{}
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
    try{if(recordedCue?.(kind,options))return true;}catch{ /* Optional recording failure retains native foley. */ }
    const plan=battleSoundPlan(kind,{...options,variant:sequence%5+1});
    if(!plan.layers.length)return false;
    const priority=['shield','impact','bow','javelin'].includes(plan.kind)?2:['clash','vote','speech','guard','inspire','agreement','cornu','fieldwork'].includes(plan.kind)?1:0;
    // Quiet walking/rustle tails yield to a committed contact. Equal-priority
    // impacts retain the strict budget rather than stacking louder and louder.
    if(voices.size+plan.layers.length>BATTLE_SOUND_LIMITS.voices){
      const spare=[...voices].filter(v=>v.priority<priority);
      if(spare.length<voices.size+plan.layers.length-BATTLE_SOUND_LIMITS.voices)return false;
      for(const voice of spare){if(voices.size+plan.layers.length<=BATTLE_SOUND_LIMITS.voices)break;try{voice.source.stop();}catch{}cleanup(voice);}
    }
    const created=[],now=context.currentTime;
    try{
      sequence++;
      for(const layer of plan.layers){
        const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),pan=context.createStereoPanner?.();
        const voice={source,nodes:[source,filter,gain,...(pan?[pan]:[])],priority};voices.add(voice);created.push(voice);source.onended=()=>cleanup(voice);
        filter.type=layer.type;filter.frequency.setValueAtTime(layer.frequency,now+layer.offset);filter.Q.value=layer.q;
        if(layer.endFrequency)filter.frequency.exponentialRampToValueAtTime(layer.endFrequency,now+layer.offset+layer.duration);
        const start=now+layer.offset,end=start+layer.duration;
        gain.gain.setValueAtTime(.00001,start);gain.gain.linearRampToValueAtTime(layer.gain,start+layer.attack);gain.gain.exponentialRampToValueAtTime(.00001,end);
        source.connect(filter);filter.connect(gain);if(pan){pan.pan.value=Math.max(-1,Math.min(1,Number(options.pan)||0));gain.connect(pan);pan.connect(master);}else gain.connect(master);
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
