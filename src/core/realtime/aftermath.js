// The field after a victory (release 14): the won fight's world as the chronicle recorded it (game.js
// resolveRealtime), made peaceful. The living enemy have left the field; the fallen keep what they carried, the
// field's chests and caches stay where they were found, and the company stands at ease. Nothing fights, no enemy,
// squad, band or field system runs, and the world never ends (simulation.js `calm`). The road to camp stands where
// the soldier entered the field. Built from the chronicle and never saved: a reload shows the result and builds it
// again. What is searched or taken goes through the chronicle (game.js takeSpoils, openFieldContainer,
// takeFromContainer) and syncAftermath copies it back into the walking world; taking the road records the result
// (game.js commitEncounter). Pure: no randomness is drawn.
import {restoreWorld} from './simulation.js';
import {tileCentre} from './campaign-encounter.js';

export const AFTERMATH_EXIT='exit';

const won=state=>state?.phase==='encounter'&&state.encounter?.controls==='realtime'&&state.encounter.status==='won'
  &&state.encounter.kind==='battle'&&state.encounter.realtime?.world?.kind==='field';

// The road out of the field: where the soldier began (the encounter's own start tile), named for where it leads.
export function aftermathExitFor(state){
  if(!won(state))return null;
  const e=state.encounter,world=e.realtime.world,start=e.units.find(u=>u.id==='hero');if(!start||!world.layout)return null;
  const at=tileCentre(start,world.layout),practice=!!state.archiveReplay;
  return {id:AFTERMATH_EXIT,kind:'exit',name:practice?'The road back':'The road to camp',verb:'Take',
    hint:practice?'Back to your chronicle. Nothing here is recorded.':'Back to camp: taking it records the result.',
    x:+at.x.toFixed(2),z:+at.z.toFixed(2),exit:{to:practice?'archive':'camp'}};
}

// The walking world: a fresh copy each time, from the chronicle's resolved fight. Null unless a real-time battle
// stands won and unrecorded.
export function createAftermathWorld(state){
  if(!won(state))return null;
  const world=restoreWorld(state.encounter.realtime.world),exit=aftermathExitFor(state);
  world.status='active';world.aftermath=true;world.peaceful=true;world.mission=null;
  // The living enemy have left the field; the dead stay with what they carried, and nothing is in flight.
  world.actors=world.actors.filter(a=>a.side!=='enemy'||!a.alive);
  for(const s of world.squads??[])if(s.side==='enemy'){s.broken=true;s.fled=true;}
  for(const s of world.squads??[]){s.order=null;s.pending=null;s.goal=null;s.path=[];s.moving=false;s.contact=null;}
  world.projectiles=[];world.blows=[];world.queue=[];world.events=[];world.reveals=[];
  if(world.deployment)world.deployment.done=true;
  // Everyone still standing lowers his weapon and stops: a calm world gives no orders but the soldier's own.
  for(const a of world.actors)if(a.alive){a.drawn=false;a.order=null;a.action=null;a.path=[];a.moving=false;a.lock=null;}
  // The field's own works and opportunities are over.
  if(world.field)world.field={...world.field,outcome:world.field.outcome==='pending'?'missed':world.field.outcome};
  world.objects.push({id:exit.id,kind:'exit',name:exit.name,x:exit.x,z:exit.z,work_s:.3,toggle:true,done:false,verb:exit.verb,hint:exit.hint,exit:exit.exit});
  return world;
}

// What the chronicle's fight now holds, copied into the walking world: what the fallen still carry, what each chest
// or cache holds, and which locks are open. Positions, the clock and the soldier's walk are the page's.
export function syncAftermath(world,state){
  if(!world?.aftermath||!won(state))return world;
  const record=state.encounter.realtime.world;
  for(const a of world.actors){const r=record.actors.find(x=>x.id===a.id);if(r&&!a.alive)a.loot=[...(r.loot??[])];}
  for(const o of world.objects){const r=record.objects.find(x=>x.id===o.id);
    if(r&&o.kind==='container'){o.contents=[...(r.contents??[])];o.unlocked=!!r.unlocked;o.opened=!!r.opened;o.hidden=!!r.hidden;}}
  world.spoils=record.spoils.map(s=>({...s}));
  return world;
}

// What is still worth taking on a won field: the fallen who carry something, and the found chests and caches that
// hold something the soldier can reach. A locked one counts only while its key is among the spoils or on one of the
// fallen, or he is strong enough to force it: a key that left the field with a living enemy opens nothing. In
// Practice nothing is taken, so nothing is left behind.
export function fieldUnsearched(state){
  if(!won(state)||state.archiveReplay)return [];
  const world=state.encounter.realtime.world,hero=world.actors.find(a=>a.id===world.heroId);
  const keyHere=key=>world.spoils.some(s=>s.itemId===key)||world.actors.some(a=>!a.alive&&a.loot?.includes(key));
  const strong=lock=>{const need=Object.entries(lock.force??{});return need.length>0&&need.every(([k,v])=>(hero?.attributes?.[k]??0)>=v);};
  const reachable=o=>!o.lock||o.unlocked||keyHere(o.lock.key)||strong(o.lock);
  return [...world.actors.filter(a=>!a.alive&&a.side==='enemy'&&a.loot?.length).map(a=>({kind:'body',id:a.id,name:a.name})),
    ...world.objects.filter(o=>o.kind==='container'&&!o.hidden&&o.contents?.length&&reachable(o)).map(o=>({kind:'container',id:o.id,name:o.name,locked:!!o.lock&&!o.unlocked}))];
}
