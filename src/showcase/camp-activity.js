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
  const phase=reducedMotion?.5:(Math.sin((Number.isFinite(time)?time:0)*.7+actor.id.length)+1)/2;
  return {motion:`camp-${routine}`,phase};
}
