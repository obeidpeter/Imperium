import {WORLD_VERSION} from './simulation.js';
import {STREAMS} from './rng-streams.js';

// A saved real-time world must be well formed before the simulation runs it:
// a save code can come from anywhere. These checks bound every list and type
// the systems read; they never repair a world, only refuse it.

const SIDES=new Set(['player','ally','enemy','neutral']),STATUS=new Set(['active','won','lost']);
const num=n=>typeof n==='number'&&Number.isFinite(n),int=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max,str=(s,max=120)=>typeof s==='string'&&s.length<=max;
const TERRAIN=new Set(['grass','marsh','sand','road','rock','ford','high','wall','chamber','river','stone','camp','floor','bench']);

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
      ||!Array.isArray(a.kit)||a.kit.length>16||!a.attributes||typeof a.attributes!=='object'||!Array.isArray(a.path)||a.path.length>400)fail('real-time actor.');
  }
  if(!Array.isArray(world.party)||world.party.length>3||world.party.some(id=>!world.actors.some(a=>a.id===id)))fail('real-time party.');
  if(!world.actors.some(a=>a.id===world.heroId)||!world.actors.some(a=>a.id===world.controlled))fail('real-time soldier.');
  for(const [key,max]of [['projectiles',400],['queue',400],['objects',60],['log',200],['used',40],['reveals',20]])
    if(!Array.isArray(world[key])||world[key].length>max)fail(`real-time ${key}.`);
  if(world.log.some(l=>!l||!str(l.text,400)||!int(l.tick,0,1e7)))fail('real-time battle log.');
  if(world.queue.some(c=>!c||!str(c.actorId,40)||!str(c.kind,20)||!int(c.tick,0,1e7)))fail('real-time command queue.');
  const mission=world.mission;
  if(mission!==null&&mission!==undefined){
    if(typeof mission!=='object'||!str(mission.mode,20)||!mission.goal||!num(mission.goal.x)||!num(mission.goal.z)||!num(mission.radius)||!int(mission.deadline,1,40)
      ||!Array.isArray(mission.waves)||mission.waves.length>30||!Array.isArray(mission.points)||mission.points.length>16||!Array.isArray(mission.escorts)
      ||!int(mission.heldTicks,0,1e7)||!num(mission.defence))fail('real-time mission.');
  }
}
