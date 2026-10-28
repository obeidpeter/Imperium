import {WORLD_VERSION} from './simulation.js';
import {STREAMS} from './rng-streams.js';
import {ITEMS} from '../../data/realtime-rules.js';
import {ENEMY_PLANS,ORDERS,SQUAD_STANDING} from '../../data/realtime-squads.js';
import {TEMPERAMENTS} from '../../data/realtime-variety.js';
import {validateFortifications} from './fortifications.js';
import {STRUCTURE_HEIGHTS} from '../../data/structures.js';

// A saved real-time world must be well formed before the simulation runs it:
// a save code can come from anywhere. These checks bound every list and type
// the systems read; they never repair a world, only refuse it.

const SIDES=new Set(['player','ally','enemy','neutral']),STATUS=new Set(['active','won','lost']);
const num=n=>typeof n==='number'&&Number.isFinite(n),int=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max,str=(s,max=120)=>typeof s==='string'&&s.length<=max;
const TERRAIN=new Set(['grass','marsh','sand','road','rock','ford','high','wall','chamber','river','stone','camp','floor','bench','rubble','ditch']);

export function validateWorld(world,fail){
  if(!world||typeof world!=='object'||world.version!==WORLD_VERSION)fail('real-time world version.');
  if(!int(world.tick,0,1e7)||!STATUS.has(world.status)||!str(world.heroId,40)||!str(world.controlled,40))fail('real-time world clock.');
  const m=world.map;
  if(!m||!int(m.width,1,200)||!int(m.height,1,200)||!Array.isArray(m.terrain)||m.terrain.length!==m.height
    ||m.terrain.some(row=>!Array.isArray(row)||row.length!==m.width||row.some(t=>!TERRAIN.has(t))))fail('real-time map.');
  if(!world.rng||typeof world.rng!=='object'||STREAMS.some(name=>!int(world.rng[name],0,4294967295)))fail('real-time random streams.');
  if(world.layout!==undefined&&(!world.layout||!['kx','ky'].every(k=>Array.isArray(world.layout[k])&&world.layout[k].length<=20&&world.layout[k].every(n=>int(n,1,8)))))
    fail('real-time map layout.');
  if(!Array.isArray(world.actors)||world.actors.length>240||new Set(world.actors.map(a=>a?.id)).size!==world.actors.length)fail('real-time actors.');
  for(const a of world.actors){
    if(!a||!str(a.id,40)||!str(a.name)||!SIDES.has(a.side)||![a.x,a.z,a.px,a.pz,a.fx,a.fz,a.hp,a.maxHp,a.stamina,a.maxStamina].every(num)
      ||a.x<0||a.z<0||a.x>m.width*2.5||a.z>m.height*2.5||a.hp<0||a.hp>a.maxHp||a.maxHp<1||a.maxHp>400||typeof a.alive!=='boolean'
      ||!Array.isArray(a.kit)||a.kit.length>16||!a.attributes||typeof a.attributes!=='object'||!Array.isArray(a.path)||a.path.length>400
      ||(a.talk!==undefined&&a.talk!==null&&!(typeof a.talk==='object'&&str(a.talk.tree,60))))fail('real-time actor.');
  }
  if(!Array.isArray(world.party)||world.party.length>3||world.party.some(id=>!world.actors.some(a=>a.id===id)))fail('real-time party.');
  if(!world.actors.some(a=>a.id===world.heroId)||!world.actors.some(a=>a.id===world.controlled))fail('real-time soldier.');
  for(const [key,max]of [['projectiles',400],['queue',400],['objects',60],['log',200],['used',40],['reveals',20],['spoils',60],['provoked',40]])
    if(!Array.isArray(world[key])||world[key].length>max)fail(`real-time ${key}.`);
  if(world.log.some(l=>!l||!str(l.text,400)||!int(l.tick,0,1e7)))fail('real-time battle log.');
  if(world.queue.some(c=>!c||!str(c.actorId,40)||!str(c.kind,20)||!int(c.tick,0,1e7)))fail('real-time command queue.');
  if(world.spoils.some(s=>!s||!ITEMS[s.itemId]||!str(s.from,40)))fail('real-time spoils.');
  if(world.provoked.some(p=>!p||!str(p.id,40)||!str(p.name)||!int(p.tick,0,1e7)))fail('real-time provocations.');
  if(world.actors.some(a=>a.loot!==undefined&&(!Array.isArray(a.loot)||a.loot.length>12||a.loot.some(id=>!ITEMS[id]))))fail('real-time loot.');
  validateSquads(world,fail);validateField(world,fail);validateBand(world,fail);validateFortifications(world,fail);
  const doctrine=world.doctrine;
  if(doctrine?.plan?.reason!==undefined&&!str(doctrine.plan.reason,240)||
    doctrine?.pressureTargetId!==undefined&&doctrine.pressureTargetId!==null&&!str(doctrine.pressureTargetId,40)||
    doctrine?.identity!==undefined&&(!doctrine.identity||!str(doctrine.identity.id,60)||!str(doctrine.identity.label,120)))fail('adaptive doctrine evidence.');
  if(m.elevations!==undefined&&(!Array.isArray(m.elevations)||m.elevations.length>256||m.elevations.some(c=>!Array.isArray(c)||c.length!==3||
    !int(c[0],0,m.width-1)||!int(c[1],0,m.height-1)||!STRUCTURE_HEIGHTS.includes(c[2]))))fail('real-time structure elevation.');
  // Deployment (deployment.js): the zone and whether the advance has sounded.
  const d=world.deployment;
  if(d!==undefined&&(!d||typeof d.done!=='boolean'||!int(d.placed,0,1000)||!d.zone||!['x0','x1','z0','z1'].every(k=>num(d.zone[k]))))fail('real-time deployment.');
  // The camp's preparations (campaign-encounter.js preparations()).
  if(world.approach!==undefined&&!['breach','diversion','advance'].includes(world.approach)||world.engineering!==undefined&&typeof world.engineering!=='boolean'
    ||world.walkUntil!==undefined&&!int(world.walkUntil,0,1e7))fail('real-time preparations.');
  const mission=world.mission;
  if(mission!==null&&mission!==undefined){
    if(typeof mission!=='object'||!str(mission.mode,20)||!mission.goal||!num(mission.goal.x)||!num(mission.goal.z)||!num(mission.radius)||!int(mission.deadline,1,40)
      ||!Array.isArray(mission.waves)||mission.waves.length>30||!Array.isArray(mission.points)||mission.points.length>16||!Array.isArray(mission.escorts)
      ||!int(mission.heldTicks,0,1e7)||!num(mission.defence))fail('real-time mission.');
    // Squads still to arrive: bounded like the ones on the field.
    const specs=[...Object.values(mission.squadTemplates??{}),...mission.waves.map(w=>w?.squad).filter(Boolean)];
    if((mission.squadTemplates!==undefined&&(typeof mission.squadTemplates!=='object'||Object.keys(mission.squadTemplates).length>6))
      ||specs.some(q=>!q||!str(q.name)||!SIDES.has(q.side)||!num(q.strength)||!num(q.maxStrength)||q.strength<=0||q.strength>q.maxStrength||q.maxStrength>100
        ||!q.member||!Array.isArray(q.member.kit)||q.member.kit.length>16||q.member.kit.some(id=>!ITEMS[id])||typeof q.member.attributes!=='object'
        ||Object.values(q.member.attributes).some(v=>!int(v,0,60))))fail('real-time reinforcements.');
  }
}

// A war band (bands.js, Chapters I–III): its morale, its men and those who fled.
function validateBand(world,fail){
  const b=world.band;if(b===undefined)return;
  if(!b||typeof b!=='object'||!num(b.morale)||b.morale<0||b.morale>100||!int(b.size,1,60)||!Array.isArray(b.members)||b.members.length>60||b.members.some(id=>!str(id,40))
    ||!['steady','shaken','broken'].includes(b.state)||!str(b.leaderId,40)||!['east','west','north','south'].includes(b.edge)||!int(b.contactTick,0,1e7)
    ||(b.start!==undefined&&!(num(b.start)&&b.start>=0&&b.start<=100))||(b.temperament!==undefined&&!TEMPERAMENTS.kinds[b.temperament])
    ||!Array.isArray(b.fled)||b.fled.length>60||b.fled.some(f=>!f||!str(f.id,40)||!str(f.name)||!(f.unitId===null||str(f.unitId,40))||!str(f.role,20)||!num(f.x)||!num(f.z)))
    fail('real-time war band.');
}
// Squads (from Chapter IV): bounded lists, values in range, every man a squad's.
const SQUAD_TARGETS=new Set([null,'hero','objective','convoy','nearest_enemy_group','enemy_cavalry','enemy_archers']);
export function squadSlotProblem(slot){
  if(!Array.isArray(slot)||slot.length!==2||!SQUAD_STANDING.actions[slot[0]])return 'NO_TARGET';
  const t=slot[1];return SQUAD_TARGETS.has(t)||(typeof t==='string'&&/^squad:[\w-]{1,40}$/.test(t))?null:'NO_TARGET';
}
// The field objects and the opportunity record (field-objects.js).
const FIELD_STATES={gate:['closed','open','breached'],bridge:['damaged','repaired','demolished'],barricade:['intact','dismantled'],brazier:['unlit','burning','spent'],
  stores:['available','secured','forgone','missed'],signal:['available','secured','forgone','missed'],
  breach:['intact','breached'],countermine:['active','disabled'],'siege-engine':['active','disabled']};
function validateField(world,fail){
  const f=world.field,m=world.map;
  for(const o of world.objects)if(o?.field&&(!FIELD_STATES[o.kind]?.includes(o.state)||!int(o.rounds,0,3)||typeof o.done!=='boolean'||!num(o.x)||!num(o.z)
    ||o.cells!==undefined&&(!Array.isArray(o.cells)||o.cells.length>16||o.cells.some(c=>!Array.isArray(c)||!int(c[0],0,m.width-1)||!int(c[1],0,m.height-1)))))fail('real-time field object.');
  if(f===undefined)return;
  if(!f||typeof f!=='object'||!int(f.deadline,1,30)||![null,'stores','signal'].includes(f.choice)||!['pending','secured','missed'].includes(f.outcome)||![2,3].includes(f.escortPace)
    ||typeof f.cavalryDenied!=='boolean'||!f.opportunities||['stores','signal'].some(k=>!str(f.opportunities[k]?.effect,20)))fail('real-time field.');
}
function validateSquads(world,fail){
  if(world.squads===undefined){if(world.command!==undefined&&world.command!==null)fail('real-time command.');return;}
  if(!Array.isArray(world.squads)||world.squads.length>24||new Set(world.squads.map(q=>q?.id)).size!==world.squads.length)fail('real-time squads.');
  const ids=new Map(world.actors.map(a=>[a.id,a]));
  for(const q of world.squads){
    if(!q||!str(q.id,40)||!str(q.name)||!SIDES.has(q.side)||![q.x,q.z,q.fx,q.fz,q.strength,q.maxStrength,q.perMan,q.morale,q.cohesion,q.suppression,q.runUp].every(num)
      ||q.strength<0||q.strength>q.maxStrength||q.maxStrength<=0||q.maxStrength>100||q.morale<0||q.morale>100||q.cohesion<0||q.cohesion>100||q.suppression<0||q.suppression>3
      ||!int(q.maxMen,1,12)||!Array.isArray(q.members)||q.members.length>12||q.members.some(id=>ids.get(id)?.squadId!==q.id)
      ||!Array.isArray(q.path)||q.path.length>400||(q.formation!==null&&!['line','shield-wall','wedge'].includes(q.formation))
      ||(q.standing!==null&&(!Array.isArray(q.standing)||q.standing.length>4||q.standing.some(slot=>squadSlotProblem(slot))))
      ||(q.pending!==null&&(typeof q.pending!=='object'||!int(q.pending.at,0,1e7)||!int(q.pending.cost,0,8)||!ORDERS[q.pending.order?.kind]||!str(q.pending.group??'',24)))
      ||(q.order!==null&&(typeof q.order!=='object'||!str(q.order.kind,20)))
      // What it has seen (squad-sight.js), the band's preference and a feint's ground (squad-ai.js).
      ||(q.notice!==undefined&&(!q.notice||typeof q.notice!=='object'||Object.keys(q.notice).length>80||Object.entries(q.notice).some(([k,v])=>!str(k,40)||!num(v)||v<0||v>100)))
      ||(q.pref!==undefined&&!ENEMY_PLANS.preferences.some(([p])=>p===q.pref))||(q.volleyRound!==undefined&&!int(q.volleyRound,1,1e5))||(q.temperament!==undefined&&!TEMPERAMENTS.kinds[q.temperament])
      ||(q.lying!==undefined&&typeof q.lying!=='boolean')||(q.spring!==undefined&&q.spring!==null&&!(str(q.spring?.targetId,40)&&typeof q.spring?.unseen==='boolean'))||(q.pulledBack!==undefined&&typeof q.pulledBack!=='boolean')||(q.feint!==undefined&&q.feint!==null&&!(num(q.feint?.x)&&num(q.feint?.z))))fail('real-time squad.');
  }
  if(world.actors.some(a=>a.squadId!==undefined&&!world.squads.some(q=>q.id===a.squadId)))fail('real-time squad member.');
  const c=world.command;
  if(c!==undefined&&c!==null&&(typeof c!=='object'||!int(c.capacity,0,8)||!int(c.left,0,8)||c.left>c.capacity||!int(c.round,1,1e5)))fail('real-time command.');
  if(world.queue.some(q=>q.kind==='order'&&(!Array.isArray(q.payload?.squads)||q.payload.squads.length>6||!ORDERS[q.payload.order?.kind]||typeof q.payload.costs!=='object')))
    fail('real-time orders.');
}
