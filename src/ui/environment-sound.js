// Original, locally synthesized environmental performances. These are sound
// textures, never simulated dialogue or recordings of an identifiable person.
// Each recipe has a hard duration; there are no background timers or streams.
export const ENVIRONMENT_SOUND_KINDS=Object.freeze(['river','wind','workshop','room','birds','reeds','insects','market','rigging','horses','march']);
export const ENVIRONMENT_BUFFER_LIMIT=768*1024;
const rate=22050;
const durations={river:1.6,wind:1.6,workshop:.7,room:1.4,birds:1.25,reeds:1.4,insects:1.35,market:1.6,rigging:1.1,horses:1.1,march:1.2};
export const environmentSoundFrequency=kind=>({river:2400,wind:850,workshop:4600,room:1100,birds:7500,reeds:3500,insects:6200,market:2100,rigging:3600,horses:2300,march:1400}[kind]??1200);
const pulse=(t,at,decay)=>t<at?0:Math.exp(-(t-at)*decay);
export function environmentSoundSamples(kind){
  if(!ENVIRONMENT_SOUND_KINDS.includes(kind))return null;
  const duration=durations[kind],samples=new Float32Array(Math.ceil(rate*duration));let seed=0x17c23,low=0;
  for(let i=0;i<samples.length;i++){
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    const n=((seed>>>0)/4294967296)*2-1,t=i/rate,window=Math.sin(Math.PI*i/samples.length)**2;
    low=low*.94+n*.06;let sound;
    if(kind==='river')sound=(low*2+n*.18)*(0.64+.24*Math.sin(t*13)+.12*Math.sin(t*31))*window;
    else if(kind==='wind')sound=(low*1.5+n*.03)*window;
    else if(kind==='workshop')sound=[0,.29,.55].reduce((s,at,j)=>s+pulse(t,at,25)*(n*.38+Math.sin((t-at)*(j%2?1457:1733)*6.283)*.22+Math.sin((t-at)*311*6.283)*.3),0);
    else if(kind==='birds'){
      const chirp=(at,duration,f)=>{const u=(t-at)/duration;return u<0||u>1?0:Math.sin(Math.PI*u)**2*Math.sin(6.283*(f*(t-at)+950*(t-at)*(t-at)))*.24;};
      sound=chirp(.12,.15,2150)+chirp(.36,.21,2850)+chirp(.82,.13,2340);
    }else if(kind==='reeds')sound=(n*.25+low*.8)*window*(.45+.55*Math.sin(t*8)**2);
    else if(kind==='insects')sound=(Math.sin(t*4370*6.283)+Math.sin(t*4511*6.283)*.35)*(.5+.5*Math.sin(t*41))**5*window*.075;
    else if(kind==='market'||kind==='room'){
      // Unvoiced crowd murmur with moving low formants: no words are implied.
      sound=(low*.9+Math.sin(t*147*6.283)*Math.sin(t*3.3)*.07+Math.sin(t*223*6.283)*Math.sin(t*5.1)*.05)*window*(kind==='room'?.55:1);
    }else if(kind==='rigging')sound=(Math.sin(6.283*(340*t+34*t*t))*.16+n*.07)*Math.sin(Math.PI*t/duration)**4+(pulse(t,.22,38)+pulse(t,.74,33))*low;
    else if(kind==='horses')sound=(low*2+n*.10)*window*(.4+.6*Math.sin(t*27)**2);
    else sound=[0,.16,.44,.61,.91].reduce((s,at)=>s+pulse(t,at,35)*(low*1.3+Math.sin((t-at)*145*6.283)*.13+n*.12),0);
    samples[i]=Math.max(-.8,Math.min(.8,sound));
  }
  // Gentle endpoints avoid a click even for the last hammer or marching step.
  const edge=Math.floor(rate*.008);for(let i=0;i<edge;i++){samples[i]*=i/edge;samples[samples.length-1-i]*=i/edge;}
  return {samples,sampleRate:rate};
}

const palettes=[['birds','march'],['reeds','birds'],['horses','birds'],['rigging','march'],['workshop','rigging'],['horses','wind'],['birds','march'],['rigging','reeds'],['market','insects'],['birds','market'],['market','room'],['march','market']];
export function regionalSoundPalette(chapter=1){return palettes[Math.max(1,Math.min(12,Math.floor(chapter)||1))-1].slice();}
