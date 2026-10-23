import {capabilityTasks,FIELD_BAR,TIME} from '../data/realtime-rules.js';
import {coalitionView,hourView} from '../core/chamber.js';

// Presentation only: reduce the first view without changing action order, keys,
// mission conditions or the detailed forecasts available to the player.
export function abilityGroups(ids,essential=[]){
  const visible=new Set([...FIELD_BAR,...essential]);
  return {primary:ids.filter(id=>visible.has(id)),more:ids.filter(id=>!visible.has(id))};
}

export function compactMissionReadout(world,full={}){
  const m=world.mission;if(!m)return {headline:full.objective??'',progress:'',deadline:'',order:''};
  let headline=full.objective??'',progress='';
  const points=m.points??[],secured=points.filter(p=>p.secured).length;
  switch(m.mode){
    case 'training':headline='Complete the drill.';progress=`${['move','strike','brace','throw'].filter(id=>world.used.includes(id)).length}/4 skills`;break;
    case 'clear':{headline='Defeat the enemy force.';const n=world.actors.filter(a=>a.side==='enemy'&&a.alive&&!a.hidden).length;progress=`${n} ${n===1?'enemy':'enemies'} in sight`;break;}
    case 'recover':headline=world.used.includes('scout')?'Recover the records chest.':'Scout the ground, then recover the chest.';break;
    case 'extract':{
      headline='Bring everyone, including your soldier, to the rally marker.';
      const party=(m.escorts??[]).map(id=>world.actors.find(a=>a.id===id)).filter(Boolean);
      progress=`${party.filter(a=>a.alive&&Math.hypot(a.x-m.goal.x,a.z-m.goal.z)<=m.radius).length}/${party.length} survivors at marker`;
      if(m.holdRequired>0){
        headline+=` Keep the marker clear for ${m.holdRequired} rounds.`;
        progress+=` · ${Math.min(m.holdRequired,Math.floor((m.heldTicks??0)/TIME.roundTicks))}/${m.holdRequired} rounds held`;
      }
      break;
    }
    case 'hold':headline='Hold the marked ground and keep enemies out.';progress=`${Math.min(m.holdRequired,Math.floor(m.heldTicks/TIME.roundTicks))}/${m.holdRequired} rounds held`;break;
    case 'capture':case 'supply':
      headline=m.gather?'Gather your soldier and companion at the marker.':m.commander&&secured===points.length?'Bring your soldier to the main marker.':m.mode==='supply'?'Secure the marked positions and protect the stores.':'Secure the marked positions.';
      progress=`${secured}/${points.length} positions`;break;
    case 'defection':headline='Win three pledges or defeat the opposition.';progress=`${m.defections??0}/${Math.min(3,m.rivals??3)} pledges`;break;
    case 'settlement':headline='Escort the envoy to the claimant, bring your soldier, and Rally.';progress=`${m.meeting??0}/2 meeting rounds`;break;
    case 'surrender':headline=secured===points.length?'Bring your soldier to the claimant’s standard.':'Secure both gate approaches.';progress=`${secured}/${points.length} approaches`;break;
  }
  // Required capability work and outcomes must never disappear behind details.
  if(m.toldMissing||world.status!=='active')headline=full.next||headline;
  else if(m.rescue&&m.mode!=='extract')headline='Protect and rescue the stranded party.';
  const required=(m.required??[]).filter(id=>!world.used.includes(id));
  if(required.length&&!m.toldMissing&&world.status==='active')headline+=` Required: ${capabilityTasks(required)}.`;
  const left=Number.isFinite(m.deadline)?Math.max(0,Math.ceil((m.deadline*TIME.roundTicks-world.tick)/TIME.ticksPerSecond)):null;
  const order=(world.queue??[]).some(c=>c.kind==='order')||(world.squads??[]).some(q=>q.side!=='enemy'&&q.pending)?full.orderStatus??'':'';
  return {headline,progress,deadline:left===null?'':`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')} left`,order};
}

// Identical vote forecasts can span multiple hours. Time/status changes must
// still refresh the compact countdown even when the delegate markup is equal.
export function chamberReadoutKey(state,coalitionMarkup=''){
  const e=state?.encounter;return `${e?.turn}:${e?.status}|${coalitionMarkup}`;
}

export function compactChamberReadout(state){
  const c=coalitionView(state),h=hourView(state);if(!c||!h)return {votes:'',projection:'',deadline:''};
  const projected=c.whip?.projectedVotesAfterRivals,active=state.encounter?.status==='active';
  const left=Math.max(0,h.of-h.hour+1);
  return {votes:`${c.votes.for}/${c.votes.total} support · ${c.votes.majority} needed`,
    projection:active&&Number.isFinite(projected)?`After rivals: ${projected}/${c.votes.total} projected if you change nothing.`:'',
    deadline:active?`${left} ${left===1?'hour':'hours'} to vote`:'Vote complete'};
}

// Each visible toolbar keeps one Tab stop. Hidden actions retain their original
// number shortcuts; choosing one opens its disclosure before focus can reach it.
export function revealAbility(bar,id,{focus=false}={}){
  const button=[...bar?.querySelectorAll('[data-ability]')??[]].find(b=>b.dataset.ability===id);
  if(!button)return null;
  const details=button.closest('details');if(details)details.open=true;
  const group=button.closest('[data-ability-group]')??bar;
  for(const b of group.querySelectorAll('[data-ability]'))b.tabIndex=b===button?0:-1;
  if(focus)button.focus({preventScroll:true});return button;
}

export function bindHudDisclosures(root){
  if(!root)return ()=>{};
  const close=details=>{if(!details?.open)return false;details.open=false;details.querySelector('summary')?.focus({preventScroll:true});return true;};
  const click=e=>{if(e.target.closest?.('[data-close-disclosure]'))close(e.target.closest('details'));};
  const key=e=>{if(e.key==='Escape'&&close(e.target.closest?.('details[open]'))){e.preventDefault();e.stopPropagation();}};
  root.addEventListener('click',click);root.addEventListener('keydown',key);
  return ()=>{root.removeEventListener('click',click);root.removeEventListener('keydown',key);};
}
