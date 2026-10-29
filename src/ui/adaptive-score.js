// Original, locally synthesized percussion and string resonance. This short
// pulse accompanies the existing recording; it is not a new orchestral score.
export function adaptiveScoreSamples(mood,sampleRate=22050){
  if(!['engaged','urgent'].includes(mood))return null;
  const duration=2.4,samples=new Float32Array(Math.round(duration*sampleRate)),urgent=mood==='urgent';
  let seed=0x1a75ba11;
  const pulses=urgent?[0,.3,.6,.9,1.2,1.65,1.8,2.1]:[0,.6,1.2,1.8];
  for(let i=0;i<samples.length;i++){
    const t=i/sampleRate;let v=0;seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const noise=(seed>>>0)/2147483648-1;
    for(const [n,pulse]of pulses.entries()){
      const age=t-pulse;if(age<0||age>.28)continue;
      const accent=n%4===0?1:.52;
      v+=(Math.sin(2*Math.PI*(76*age+4*(1-Math.exp(-age*24))))*Math.exp(-age*25)*.29+
        noise*Math.exp(-age*90)*.10)*accent*Math.min(1,age/.004);
    }
    // Slow resonance leaves speech and metal transients above it unobscured.
    v+=(Math.sin(2*Math.PI*110*t)+.24*Math.sin(2*Math.PI*165*t))*.018*Math.sin(Math.PI*t/duration)**2;
    samples[i]=v*Math.min(1,t/.006,(duration-t)/.025);
  }
  samples[0]=samples[samples.length-1]=0;return {samples,sampleRate};
}

// Commands that actually reached a friendly squad, never an unsubmitted click
// or a concealed opponent. Several squads receiving one order make one signal.
export function commandSoundCue(events,world){
  for(const e of events){
    if(e.kind==='advance-sounded')return 'order-advance';
    if(e.kind==='rally')return 'order-rally';
    if(e.kind!=='order')continue;
    const squad=world.squads?.find(q=>q.id===e.squadId);if(!squad||squad.side==='enemy')continue;
    // The horse's orders (release 7): the charge sounds the advance, the feigned retreat the withdrawal.
    return ['withdraw','feigned_retreat'].includes(e.order)?'order-withdraw':e.order==='restore'?'order-rally':
      ['hold','line','shield-wall','lie_in_wait'].includes(e.order)?'order-hold':
      ['advance','attack','wedge','charge'].includes(e.order)?'order-advance':null;
  }
  return null;
}
