import {ESCORT_RULES,TIME,capabilityTasks} from '../data/realtime-rules.js';
import {ORDERS} from '../data/realtime-squads.js';
import {missionProgress} from '../core/realtime/mission.js';
import {DEFAULT_KEYMAP,firstKeyLabel} from './action-map.js';

// Presentation derived from the live world. Nothing here changes a mission,
// issues a command or remembers a warning in the save. The caller announces a
// changed warningKey, not each health/range/countdown update.
const alive=a=>a?.alive&&!a.down;
const distance=(a,b)=>a&&b?Math.hypot(a.x-b.x,a.z-b.z):Infinity;
const escorts=world=>(world.mission?.escorts??[]).map(id=>world.actors.find(a=>a.id===id)).filter(Boolean);
const atGoal=(world,a)=>distance(a,world.mission?.goal)<=world.mission?.radius;
const seconds=ticks=>Math.max(0,Math.ceil(ticks/TIME.ticksPerSecond));
const clock=ticks=>{const s=seconds(ticks);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const needed=world=>(world.mission?.required??[]).filter(id=>!world.used.includes(id));
const enemies=world=>world.actors.filter(a=>a.side==='enemy'&&alive(a)&&!a.hidden&&!a.carriedBy);

export function realtimeMissionText(text,world){
  // Old authored encounter and operation copy is also loaded from old saves.
  // Translate its vocabulary at the presentation boundary, not in those saves.
  const tileMetres=world.mission?.radius,numbers={one:1,two:2,three:3,four:4,five:5,six:6};
  return String(text??'').replace(/\bUse Assist on\b/g,'Use Bind wounds or Carry on')
    .replace(/\bAssist anyone\b/g,'Use Bind wounds or Carry on anyone')
    .replace(/\bAssist\b/g,'Bind wounds or Carry')
    .replace(/\bturns?\b/gi,word=>word.toLowerCase()==='turns'?'rounds':'round')
    .replace(/\b(one|two|three|four|five|six|\d+) tiles?\b/gi,(match,count)=>Number.isFinite(tileMetres)?`${Math.round((numbers[count.toLowerCase()]??Number(count))*tileMetres)} m`:match)
    .replace(/\b\d{1,2}[A-P]\b/g,'the marked ground');
}

function objective(world,base){
  const m=world.mission;if(!m)return realtimeMissionText(base,world);
  if(m.mode==='extract')return 'Protect every survivor and bring them, with your soldier, to the rally marker.';
  if(m.rescue)return 'Secure the stranded party. Use Bind wounds or Carry on anyone who cannot move.';
  return realtimeMissionText(m.objective??m.label??base,world);
}

function rescueNext(world){
  const m=world.mission,party=escorts(world),hero=world.actors.find(a=>a.id===world.heroId);
  const wounded=party.find(a=>a.alive&&!a.carriedBy&&(!a.escort?.escorted||a.down));
  if(wounded){
    const working=world.actors.find(a=>a.action?.what==='bind_wounds'&&a.action.targetId===wounded.id);
    if(working)return `Cover ${working.name} while he binds ${wounded.name}’s wounds (${seconds(working.action.end-world.tick)}s). A hit interrupts treatment.`;
    return `Reach ${wounded.name}. Clear his approach, then use Bind wounds; or sheathe your weapon and Carry him.`;
  }
  const carried=party.find(a=>a.carriedBy);
  if(carried)return `Carry ${carried.name} to the marker. You can only walk and cannot block; a clear route matters more than pursuit.`;
  if(m.pauseEscorts)return 'The rescued party waits here until this approach is secure. Clear enemies from the marked ground.';
  const behind=party.find(a=>a.alive&&!atGoal(world,a));
  if(behind)return `Escort ${behind.name} to the marker; stay within ${Math.round(m.followRange)} m. Keep a protector within ${ESCORT_RULES.cover} m when enemies approach.`;
  if(hero&&!atGoal(world,hero))return 'The survivors are at the marker. Bring your soldier inside it too.';
  if(m.holdRequired&&m.heldTicks<m.holdRequired*TIME.roundTicks)return `Keep the rally marker clear for ${seconds(m.holdRequired*TIME.roundTicks-m.heldTicks)} more seconds.`;
  return 'Keep every survivor safe until the objective is recorded.';
}

function nextStep(world){
  const m=world.mission;if(!m)return '';
  if(world.status==='won')return 'Record the result to continue the campaign.';
  if(world.status==='lost')return missionDefeatHelp(world);
  if(m.toldMissing&&needed(world).length)return `The ground is held: now ${capabilityTasks(needed(world))}.`;
  if(m.mode==='extract'||m.rescue)return rescueNext(world);
  if(m.gather)return `Bring your soldier and companion together within ${Math.round(m.gather)} m of the marker before pursuing enemies.`;
  switch(m.mode){
    case 'training':return 'Practise Move, Strike, Brace and Throw pilum. Pause whenever you need time to choose.';
    case 'clear':return 'Fight together. Account for arriving reinforcements; do not send your soldier alone into a group.';
    case 'recover':return world.used.includes('scout')?'Reach and recover the records chest. You do not need to defeat every enemy.':'Use Scout before approaching the records chest.';
    case 'hold':return `Keep a friend inside the marker and enemies outside it. ${seconds(Math.max(0,m.holdRequired*TIME.roundTicks-m.heldTicks))} seconds of control remain.`;
    case 'capture':case 'supply':return `${m.points.filter(p=>!p.secured).length} marked positions remain.${m.commander?' Your soldier must also stand at the main marker.':''}${m.mode==='supply'?' Keep enemies away from the stores.':''}`;
    case 'defection':return 'Rally near a rival band to weaken its morale and win its pledge. Three pledges, or clearing the opposition, resolves the field.';
    case 'settlement':return 'Escort the envoy to the claimant, bring your soldier near, and Rally. Keep the meeting together for two rounds.';
    case 'surrender':return m.points.every(p=>p.secured)?'Bring your soldier to the claimant’s standard.':'Secure both gate approaches before taking your soldier to the claimant’s standard.';
    default:return '';
  }
}

// A protected man's peril takes precedence over generic combat advice. Hidden
// attackers are never identified. A recent visible hit is evidence even when
// its attacker has already changed target or moved away.
function protectedWarning(world,keymap){
  const visible=enemies(world),men=escorts(world),pause=firstKeyLabel('pause',keymap);
  const danger=[];
  for(const a of men){
    if(!a.alive)return {warning:`${a.name} was lost. The protected party must survive.`,warningKey:`protected-lost:${a.id}`};
    const directed=visible.find(e=>e.lock===a.id||e.order?.targetId===a.id||e.action?.targetId===a.id);
    const close=visible.find(e=>distance(e,a)<=ESCORT_RULES.halt);
    const hit=a.lastHitTick>=0&&world.tick-a.lastHitTick<TIME.ticksPerSecond*3;
    if(directed||close||hit)danger.push(a);
  }
  if(danger.length){
    danger.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id.localeCompare(b.id));const a=danger[0],low=a.hp<=a.maxHp*.35;
    return {warning:`${a.name} ${low?'is critically hurt and in danger':'is in danger'} (${a.hp}/${a.maxHp} Health). Pause (${pause}); intercept the attacker and cover the rescue.`,
      // Switching between two endangered survivors at the same severity is a
      // text update, not a reason to interrupt a screen reader again.
      warningKey:`protected-${low?'critical':'danger'}`};
  }
  const left=world.mission.deadline*TIME.roundTicks-world.tick;
  if(left<=TIME.roundTicks*2&&left>0)return {warning:`Objective deadline in ${clock(left)}. ${nextStep(world)}`,warningKey:'mission-deadline'};
  const optional=world.field?.outcome==='pending'?world.field.deadline*TIME.roundTicks-world.tick:0;
  if(optional>0&&optional<=TIME.roundTicks*1.5)return {warning:`Optional opportunities close in ${clock(optional)}. Secure one only if the main objective is safe; the work needs 3 uninterrupted seconds.`,warningKey:'opportunity-deadline'};
  return {warning:'',warningKey:''};
}

function opportunity(world){
  const works=world.objects.filter(o=>['countermine','siege-engine'].includes(o.kind));
  const siege=works.some(o=>!o.done)?`Siege works: ${works.filter(o=>o.done).length}/${works.length} secured. Two 4s actions per site; one with engineer support from a nearby detail, your approach or the previous siege. Secure both with the company intact to earn support for the next battle.`:'';
  return [siege,fieldOpportunity(world)].filter(Boolean).join(' ');
}
function fieldOpportunity(world){
  const f=world.field;if(!f)return '';
  if(f.choice){const o=world.objects.find(o=>o.field&&o.kind===f.choice);return `${o?.name??'Field opportunity'} secured.`;}
  if(f.outcome!=='pending'||world.tick>=f.deadline*TIME.roundTicks)return 'Optional opportunities closed; the main objective remains.';
  const names=world.objects.filter(o=>o.field&&['stores','signal'].includes(o.kind)&&o.state==='available').map(o=>o.name);
  if(!names.length)return '';
  return `Optional: ${names.join(' or ')} · ${clock(f.deadline*TIME.roundTicks-world.tick)} left. Choose one; work takes 3s and a hit interrupts it.`;
}

function orderStatus(world){
  const squads=world.squads??[],name=id=>squads.find(s=>s.id===id)?.name??id,label=kind=>ORDERS[kind]?.name??kind;
  const queued=(world.queue??[]).filter(c=>c.kind==='order').at(-1);
  if(queued)return `${queued.payload.squads.map(name).join(', ')}: ${label(queued.payload.order.kind)} queued for the next simulation step.`;
  const pending=squads.filter(s=>s.pending&&s.side!=='enemy').sort((a,b)=>b.pending.at-a.pending.at)[0];
  if(pending)return `${pending.name}: ${label(pending.pending.order.kind)} on its way (${seconds(pending.pending.at-world.tick)}s).`;
  const issued=(world.log??[]).findLast(l=>l.kind==='order');
  if(issued)return `Last order: ${issued.text}`;
  const active=squads.find(s=>s.side!=='enemy'&&s.order);
  if(active)return `${active.name}: ${label(active.order.kind)} in effect.`;
  return squads.some(s=>s.side!=='enemy')?'Squads follow their standing orders; select a standard to give an order.':'';
}

function tactic(world){
  const m=world.mission,hero=world.actors.find(a=>a.id===world.heroId),squads=(world.squads??[]).some(s=>s.side!=='enemy');
  if(m?.mode==='extract'||m?.rescue)return squads?'Screen the rescue with a squad, bind wounds under its cover, then move the column and commander together.':'Pause to plan the rescue. Intercept the nearest raider before treating the casualty; healing is not protection. Keep close and leave together.';
  if(squads)return 'Hold a squad in front of the enemy, then bring your soldier around the flank. A side or rear strike bypasses the shield; withdraw before you are surrounded.';
  if(hero?.ammo?.pilum>0&&!world.used.includes('throw'))return 'Open with Throw pilum against a shield, then close together. A pilum stuck in the shield halves its blocking chance.';
  return 'Face the enemy’s wind-up and Brace. Moving or attacking ends your brace; use the recovery after his blow to reposition.';
}

export function missionReadout(world,{keymap=DEFAULT_KEYMAP,objective:base=''}={}){
  if(!world?.mission)return {objective:base,progress:'',next:'',warning:'',warningKey:'',opportunity:'',orderStatus:'',tactic:''};
  return {objective:objective(world,base),progress:missionProgress(world),next:nextStep(world),
    ...(world.status==='active'?protectedWarning(world,keymap):{warning:'',warningKey:''}),
    opportunity:opportunity(world),orderStatus:orderStatus(world),tactic:tactic(world)};
}

export function missionDefeatCause(world){
  const hero=world.actors.find(a=>a.id===world.heroId),m=world.mission;
  if(hero&&(!hero.alive||hero.down)){const by=world.actors.find(a=>a.id===hero.killedBy);return by?`You fell to ${by.name}.`:'Your soldier fell before the objective was secured.';}
  const lost=escorts(world).find(a=>!a.alive);
  if(lost){const by=world.actors.find(a=>a.id===lost.killedBy&&!a.hidden);return `${lost.name} was lost${by?` to ${by.name}`:''}. Every protected survivor must reach safety; your soldier’s remaining Health cannot replace that objective.`;}
  if(m?.defence<=0)return 'Enemy occupation exhausted the defended line. The marked ground needed a friendly screen.';
  if(m&&world.tick>=m.deadline*TIME.roundTicks){
    if(needed(world).length)return `The deadline passed before you could ${capabilityTasks(needed(world))}.`;
    if(m.mode==='extract')return 'The deadline passed before every survivor and your soldier reached the rally marker.';
    if(['capture','supply'].includes(m.mode))return 'The deadline passed before every required position was secured.';
    if(m.mode==='hold')return 'The deadline passed before the ground was held long enough.';
    if(m.mode==='recover')return 'The deadline passed before the ground was scouted and the records chest recovered.';
    if(m.mode==='settlement')return 'The deadline passed before the envoy’s meeting was supported by Rally and held for two rounds.';
    if(m.mode==='defection')return 'The deadline passed before three rival bands pledged, or the remaining opposition was defeated.';
    if(m.mode==='surrender')return 'The deadline passed before both gates were secured and your soldier reached the claimant’s standard.';
  }
  return m?.reason??'The objective was not held.';
}

export function missionDefeatHelp(world,keymap=DEFAULT_KEYMAP){
  const m=world.mission,hero=world.actors.find(a=>a.id===world.heroId),pause=firstKeyLabel('pause',keymap);
  if(m?.mode==='settlement')return `Pause (${pause}) and follow the envoy to the claimant’s marker. Keep your soldier within ${Math.round(m.radius*2)} m, use Rally, and sustain the meeting for two round endings. The envoy is protected by parley; he needs your presence and reassurance, not a rescue treatment.`;
  if(m?.escorts?.length)return `Retry restores the rescue checkpoint. Pause (${pause}) to identify the casualty, the nearest raider and the rally marker. Cover the approach before Bind wounds (3s, interrupted by a hit), or sheathe your weapon and Carry. Healing does not make him safe: keep a protector within ${ESCORT_RULES.cover} m of a threatened survivor, then escort every survivor and your soldier into the marker. No permanent companion fate is changed by this failed attempt.`;
  if(m?.defence<=0)return `Pause (${pause}) and put a friendly screen on the marked ground. Chasing enemies away leaves the stores or line exposed; hold the position while another group handles the flank.`;
  if(m&&world.tick>=m.deadline*TIME.roundTicks)return `Pause (${pause}) at the start and follow the objective strip. ${nextStep({...world,status:'active'})} Optional opportunities never replace the main objective.`;
  const log=(world.log??[]).map(l=>l.text).join('\n');
  if(/from the (rear|flank)/.test(log))return 'Flank or rear blows were recorded. Keep a rock, a wall or a companion at your back, and turn to face the man you fight.';
  if(hero?.ammo?.pilum>0&&!world.used?.includes('throw'))return 'Throw pilum before closing: a pilum that sticks in a shield halves its blocking chance. Keep your companion beside you while you approach.';
  return `Pause (${pause}) when the fight turns, brace against heavy blows and let your companions’ standing orders cover you.`;
}
