import {ARCS,BASE_ATTRIBUTES,COMBAT,DAMAGE_TYPES,ITEMS,MISSILES,MOVEMENT,SHIELDS,TIME,TRAINING_PATHS,WEAPONS} from '../../data/realtime-rules.js';
import {crossesCover,groundHeight,navGrid,span} from './navigation.js';
import {randomInt,nextRandom} from './rng-streams.js';

// Character values and blow resolution (§3.5). Every division is floored,
// constants come from the rules data, and one setup serves both the forecast
// and the roll, so the forecast shows exactly the modifiers the roll applies.

const floor=Math.floor,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ticks=seconds=>Math.round(seconds*TIME.ticksPerSecond);
const TYPES=DAMAGE_TYPES.filter(t=>t!=='stun');

export function startingAttributes({path,attributes={}}={}){
  const base={...BASE_ATTRIBUTES},mods=TRAINING_PATHS[path]?.mods??{};
  for(const [k,v]of Object.entries(mods))base[k]+=v;
  return {...base,...attributes};
}
const worn=actor=>actor.kit.map(id=>ITEMS[id]).filter(Boolean);
export const weaponOf=actor=>WEAPONS[worn(actor).find(i=>i.weapon)?.weapon]??WEAPONS.unarmed;
export const shieldOf=actor=>SHIELDS[worn(actor).find(i=>i.shield)?.shield]??null;
export const restrictionOf=actor=>Math.max(0,worn(actor).reduce((sum,item)=>sum+(item.restriction??0),0));
// absorb sums over worn pieces; resist combines them as 1 − Π(1 − r), capped.
export function protectionOf(actor){
  const out={};
  for(const type of DAMAGE_TYPES){
    let absorb=0,pass=1;
    for(const item of worn(actor)){const p=item.protection?.[type];if(p){absorb+=p.absorb??0;pass*=1-(p.resist??0);}}
    out[type]={absorb,resist:Math.min(COMBAT.resistCap,1-pass)};
  }
  return out;
}
// Derived values depend only on the attributes and the kit, which are replaced
// (never edited in place) when they change; each set is computed once.
const derivedCache=new WeakMap();
export function derivedValues(actor){
  const known=derivedCache.get(actor);
  if(known&&known.attributes===actor.attributes&&known.kit===actor.kit&&known.effects===actor.effects)return known.values;
  const values=computeDerived(actor);derivedCache.set(actor,{attributes:actor.attributes,kit:actor.kit,effects:actor.effects,values});return values;
}
const NO_EFFECTS=Object.freeze({});
// Courses add their stated effects (soldier.js courseEffects): Long march takes
// 5 from Restriction, Work at the post adds 2 Attack, Hardening a tenth of Health.
function computeDerived(actor){
  const a=actor.attributes,fx=actor.effects??NO_EFFECTS,r=Math.max(0,restrictionOf(actor)+(fx.restriction??0)),weapon=weaponOf(actor),s=COMBAT.stagger;
  const attack=floor(a.str/5)+floor(a.agi/2)+a.combat-floor(r/10)+(fx.attack??0);
  return {health:floor((20+floor(a.con/2))*(1+(fx.health??0))),stamina:30+floor(a.con/2),restriction:r,attack,defence:10+floor(a.agi/2)+a.combat-floor(r/10),
    missile:attack+floor(a.agi/2)+floor(a.per/2)-floor(r/10),weapon,reach:weapon.reach,swingTicks:ticks(weapon.swing),
    recoveryTicks:ticks(clamp(.6-(a.agi+a.str)/100+r/100,0,1)),staggerBase:clamp(s.base-a.con/s.con,s.min,s.max),
    run:Math.max(MOVEMENT.runMin,MOVEMENT.run*(1-r/MOVEMENT.runRestriction)),
    staminaPerSecond:COMBAT.regen.stamina*(1+Math.max(0,a.con-10)/COMBAT.regen.staminaCon)*Math.max(COMBAT.regen.staminaFloor,1-r/100),
    healthPerSecond:floor((20+floor(a.con/2))*(1+(fx.health??0)))*(COMBAT.regen.healthBase+a.con/COMBAT.regen.healthCon)};
}
export const staggerTicks=(actor,stun=0)=>ticks(derivedValues(actor).staggerBase+Math.min(stun*COMBAT.stagger.stun,COMBAT.stagger.stunMax));

// Where `from` stands relative to `to`'s facing: in front, on the flank or behind.
export function arcOf(to,from){
  const dx=from.x-to.x,dz=from.z-to.z,d=span(dx,dz);if(!d)return 'front';
  const cos=(dx*to.fx+dz*to.fz)/d;return cos>=ARCS.front?'front':cos<=ARCS.rear?'rear':'flank';
}
export const braced=(world,actor)=>actor.braceUntil>world.tick;

// Everything a blow's outcome depends on except the dice. `missile` names a
// thrown weapon; melee uses the attacker's weapon.
// A missile is judged from where it left the hand (`from`), not from where
// its thrower stands when it lands.
// Whether a blow is an ambush (§3.5 step 9): the defender has not noticed the
// attacker (his notice meter for him is below 100), or a hidden attacker
// strikes a man of the party before anyone has spotted him.
export function unaware(defender,attacker){
  if(defender.ai)return (defender.ai.notice?.[attacker.id]??0)<100&&defender.ai.state!=='engage';
  return !!attacker.hidden;
}
export function blowSetup(world,attacker,defender,{missile=null,from=null,profile:override=null}={}){
  const grid=navGrid(world.map),A=derivedValues(attacker),D=derivedValues(defender),mods=[],src=from??attacker;
  const arc=arcOf(defender,src),rise=groundHeight(grid,defender.x,defender.z)-groundHeight(grid,src.x,src.z);
  let attack=missile?A.missile:A.attack,defence=D.defence;
  if(arc==='rear'){attack+=COMBAT.rearAttack;mods.push({label:'From behind',kind:'attack',value:COMBAT.rearAttack});}
  if(rise>=COMBAT.heightStep){defence+=COMBAT.heightDefence;mods.push({label:'He holds higher ground',kind:'defence',value:COMBAT.heightDefence});}
  if(missile&&-rise>=COMBAT.heightStep){attack+=COMBAT.heightDefence;mods.push({label:'Thrown downhill',kind:'attack',value:COMBAT.heightDefence});}
  if(missile&&crossesCover(grid,src,defender)){attack-=COMBAT.coverMissile;mods.push({label:'Through cover',kind:'attack',value:-COMBAT.coverMissile});}
  const far=span(defender.x-src.x,defender.z-src.z)>COMBAT.weatherRange,weather=missile&&far&&['rain','mist','dust'].includes(world.weather);
  if(weather){
    attack-=COMBAT.weatherMissile;
    mods.push({label:`${world.weather[0].toUpperCase()}${world.weather.slice(1)} beyond 20 m`,kind:'attack',value:-COMBAT.weatherMissile});
  }
  const ambush=!world.practice&&unaware(defender,attacker);
  if(ambush)mods.push({label:'Ambush: he has not seen you',kind:'attack',value:0});
  // A man carrying a casualty cannot block (§3.5 step 2).
  const shield=defender.carrying?null:shieldOf(defender),guard=braced(world,defender);let block=0;
  if(defender.carrying&&shieldOf(defender))mods.push({label:'Carrying a casualty: no block',kind:'block',value:0});
  if(shield&&arc==='front'&&!ambush){
    block=Math.min(COMBAT.blockCap,shield.block+(guard?COMBAT.braceBlock:0))*(defender.shieldStuck?COMBAT.stuckPilum:1);
    if(guard)mods.push({label:'Braced shield',kind:'block',value:COMBAT.braceBlock});
    if(defender.shieldStuck)mods.push({label:'Pilum stuck in his shield',kind:'block',value:-.5});
  }else if(shield)mods.push({label:arc==='rear'?'Behind his shield':'Past his shield (flank)',kind:'block',value:0});
  let flat=0;
  if(guard){flat-=COMBAT.braceProtection;mods.push({label:'Braced',kind:'damage',value:-COMBAT.braceProtection});}
  if(weather){flat-=COMBAT.weatherDamage;mods.push({label:'Weather on missiles',kind:'damage',value:-COMBAT.weatherDamage});}
  const profile=override??(missile?MISSILES[missile].damage:A.weapon.damage),mult=missile?1+(attacker.attributes.str-10)/COMBAT.thrownStrength
    :1+(attacker.attributes.str-10)/COMBAT.meleeStrength;
  return {attack,defence,block,arc,flat,mods,profile,mult,protection:protectionOf(defender),maxHealth:defender.maxHp,
    double:attacker.id===world.controlled,noStagger:guard,missile,ambush,ambushFactor:attacker.effects?.ambush??1};
}

// Out of r = 0..39: how many rolls hit (criticals always do, 0 never does).
export function hitRolls(attack,defence){let hits=0;for(let r=1;r<COMBAT.critical;r++)if(r+attack>defence)hits++;return hits+(COMBAT.roll-COMBAT.critical);}
// One type's damage from a raw amount.
const mitigate=(raw,p,critical)=>critical?raw*(1-p.resist):Math.max(0,raw-p.absorb)*(1-p.resist);
function total(setup,raws,critical){
  let sum=0;for(const t of TYPES)if(raws[t]!==undefined)sum+=mitigate(raws[t],setup.protection[t],critical);
  let dmg=Math.max(COMBAT.minimumDamage,floor(sum+1e-9)+setup.flat);if(critical&&setup.double)dmg*=COMBAT.criticalFactor;
  if(critical&&setup.ambush)dmg=floor(dmg*setup.ambushFactor);return dmg;
}
const extreme=(setup,end)=>Object.fromEntries(Object.entries(setup.profile).map(([t,range])=>[t,range[end]*setup.mult]));

// The forecast's numbers: chance to hit, to be blocked and to land, and the
// damage of a landed blow and of a critical, after armour.
export function blowForecast(setup){
  const hit=setup.ambush?1:hitRolls(setup.attack,setup.defence)/COMBAT.roll,critical=setup.ambush?1:(COMBAT.roll-COMBAT.critical)/COMBAT.roll;
  const lo=extreme(setup,0),hi=extreme(setup,1);
  return {hit,critical,block:setup.block,land:hit*(1-setup.block),arc:setup.arc,attack:setup.attack,defence:setup.defence,
    damage:{min:total(setup,lo,false),max:total(setup,hi,false)},criticalDamage:{min:total(setup,lo,true),max:total(setup,hi,true)},
    mods:setup.mods};
}

// Roll one blow on the combat stream: { roll, hit, critical, blocked, damage, stun, stagger }.
// The draws always come in the same order: the roll, the block, then each damage type.
export function rollBlow(world,setup){
  // An ambush always hits and counts as a critical; the roll is still drawn so the stream stays in step.
  const roll=randomInt(world.rng,'combat',0,COMBAT.roll-1),critical=setup.ambush||roll>=COMBAT.critical,hit=critical||roll>0&&roll+setup.attack>setup.defence;
  if(!hit)return {roll,hit,critical:false,blocked:false,damage:0,stun:0,stagger:false};
  const blocked=setup.block>0&&nextRandom(world.rng,'combat')<setup.block;
  if(blocked)return {roll,hit,critical,blocked,damage:0,stun:0,stagger:false};
  const raws={};for(const t of DAMAGE_TYPES){const range=setup.profile[t];if(range)raws[t]=randomInt(world.rng,'combat',range[0],range[1])*setup.mult;}
  const damage=total(setup,raws,critical),p=setup.protection.stun;
  const stun=raws.stun===undefined?0:Math.max(0,raws.stun-p.absorb)*(1-p.resist);
  return {roll,hit,critical,blocked,damage,stun,stagger:!setup.noStagger&&(damage>setup.maxHealth/COMBAT.staggerFraction||stun>0)};
}
