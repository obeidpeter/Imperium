// Cosmetic service routines. They never move a simulation actor, change a
// target position, schedule commands or consume gameplay randomness.
const ROUTINES=new Set(['watch','work','carry','rest']);
export function campActivityFor(world,actorId){
  if(world?.kind!=='camp')return null;
  const routine=world.campPresentation?.ambient?.find(a=>a.id===actorId)?.routine;
  return ROUTINES.has(routine)?routine:null;
}
export function sampleCampActivity(world,actor,{time=0,reducedMotion=false}={}){
  const routine=campActivityFor(world,actor?.id);
  if(!routine||!actor.alive||actor.moving||actor.action)return null;
  const hero=world.actors.find(a=>a.id===world.heroId);
  if(hero&&Math.hypot(actor.x-hero.x,actor.z-hero.z)<3.2)return null;
  // Unequal work/rest beats and a stable per-person offset avoid a camp of
  // synchronized swaying figures. No position or interaction target moves.
  let seed=0;for(const ch of actor.id)seed=(seed*31+ch.charCodeAt(0))>>>0;
  const duration={watch:14,work:9,carry:12,rest:17}[routine],seconds=Number.isFinite(time)?Math.max(0,time):0;
  const cycle=((seconds+seed%97/7)%duration)/duration;
  const active=cycle<.68?cycle/.68:1,beat=active>=1?0:Math.sin(active*Math.PI)**2;
  const phase=reducedMotion?.5:routine==='work'?beat*(.82+.18*Math.sin(active*Math.PI*6)):routine==='watch'?.5+.5*Math.sin(cycle*Math.PI*2)**3:beat;
  return {motion:`camp-${routine}`,phase};
}
