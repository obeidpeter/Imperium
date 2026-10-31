import {TIME} from '../data/realtime-rules.js';
import {missionDefeatHelp} from './realtime-mission-readout.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const clock=tick=>{const s=Math.floor(tick/TIME.ticksPerSecond);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const CATEGORY={secured:['Objective',100],pledge:['Allegiance',95],meeting:['Objective',85],pressure:['Defended line',90],
  'squad-broken':['Morale',85],'squad-destroyed':['Losses',85],'band-broken':['Morale',85],'band-leader-fell':['Morale',80],
  down:['Casualty',85],fall:['Casualty',45],'work-stopped':['Interrupted work',70],
  'squad-ambush':['Ambush',80],counter:['Charge checked',80],'strung-out':['Cavalry pursuit',80],
  heal:['Treatment',65],reinforcements:['Reinforcements',60],'squad-rallied':['Recovery',65],'enemy-plan':['Enemy manoeuvre',55]};
function classification(entry,world){
  if(entry.kind==='field'&&/opens a breach|pressure on the line has stopped|is open|is repaired|demolishes|burns\.|thrown down/.test(entry.text))return ['Engineering',95];
  if(entry.kind==='hit'&&/from the (rear|flank)/.test(entry.text))return ['Flank strike',60];
  if(entry.kind==='hit'&&/\(ambush\)/.test(entry.text))return ['Ambush',80];
  if(entry.kind==='fall'&&world.actors?.some(a=>(a.id===world.heroId||world.party?.includes(a.id))&&entry.text.startsWith(`${a.name} `)))return ['Casualty',98];
  return CATEGORY[entry.kind]??null;
}
function ownSquad(world,entry){return (world.squads??[]).find(s=>s.side!=='enemy'&&entry.text.startsWith(`${s.name} `));}
function suggestion(world,moments){
  // Suggest a countermeasure to an explicitly recorded event. Do not assign
  // a loss to an event merely because the two occurred near each other.
  for(const e of moments){
    if(e.kind==='pressure')return 'On retry, keep a friendly squad on the defended ground. If the record names siege works, disable those works while the line is covered.';
    if(e.kind==='work-stopped')return 'On retry, screen the worker before starting again. A hit interrupts the action; check the structure’s remaining stages before leaving it.';
    if(e.kind==='squad-broken'&&ownSquad(world,e))return 'On retry, keep a reserve near the squad that broke. Use Restore morale before it breaks, then reform behind a protected front.';
    if(e.kind==='down'&&world.actors?.some(a=>(a.id===world.heroId||world.party?.includes(a.id))&&e.text.startsWith(`${a.name} `)))
      return 'On retry, screen the casualty before treatment or carrying. Pause to choose a safe approach, then use Bind wounds or Carry under cover.';
  }
  return null;
}

// Old saves retain at most the battle log, not a complete replay. Quote its
// evidence exactly; never reconstruct damage, blame, positions or enemy intent.
export function realtimeDebrief(world,{keymap}={}){
  const log=(world?.log??[]).filter(e=>e&&typeof e.text==='string'&&e.text.trim()&&Number.isInteger(e.tick));
  const candidates=log.flatMap((e,index)=>{const c=classification(e,world);return c?[{...e,index,category:c[0],priority:c[1]}]:[];});
  candidates.sort((a,b)=>b.priority-a.priority||b.tick-a.tick||b.index-a.index);
  const picked=[],categories=new Set(),texts=new Set();
  for(const e of candidates){
    const sameMoment=picked.some(p=>p.tick===e.tick&&Number.isFinite(e.x)&&Number.isFinite(e.z)&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.hypot(p.x-e.x,p.z-e.z)<3);
    if(categories.has(e.category)||texts.has(e.text)||sameMoment)continue;
    picked.push(e);categories.add(e.category);texts.add(e.text);if(picked.length===3)break;
  }
  // A sparse/older record gets fewer highlights, never invented turning points.
  const moments=picked.sort((a,b)=>a.tick-b.tick||a.index-b.index).map(e=>({tick:e.tick,time:clock(e.tick),kind:e.kind,category:e.category,text:e.text,
    location:Number.isFinite(e.x)&&Number.isFinite(e.z)?`${Math.round(e.x)} m, ${Math.round(e.z)} m`:null}));
  const m=world?.mission,objectiveFailure=m&&(world.tick>=m.deadline*TIME.roundTicks||m.defence<=0||
    (m.escorts??[]).some(id=>world.actors.some(a=>a.id===id&&!a.alive)));
  // A confirmed objective/deadline loss takes precedence over incidental
  // combat events. The mission's own advice names its remaining requirement.
  const advice=world?.status==='lost'?(!objectiveFailure&&suggestion(world,moments)||missionDefeatHelp(world,keymap)):null;
  return {moments,advice,note:moments.length?'Highlights from the retained battle log.':'This save has no detailed turning points to review. Your result and rewards are unchanged.'};
}

export function debriefMarkup(debrief){
  if(!debrief.moments.length)return `<p class="rt-debrief-note">${esc(debrief.note)}</p>`;
  return `<section class="rt-debrief" aria-labelledby="rt-debrief-title"><h3 id="rt-debrief-title">Key recorded moments</h3>
    <ol>${debrief.moments.map(m=>`<li><div class="rt-moment-heading"><strong>${esc(m.category)}</strong><span>${esc(m.time)}${m.location?` · ${esc(m.location)}`:''}</span></div><p>${esc(m.text)}</p></li>`).join('')}</ol>
    <p class="rt-debrief-note">${esc(debrief.note)}</p></section>`;
}
