import {SQUAD_STANDING} from '../../data/realtime-squads.js';

// A squad's standing orders as the company panel sets them in camp (guide
// "Squad standing orders"): each deployed veteran's squad keeps four, in the
// squad vocabulary, whether he leads it or marches with the soldier. A target
// 'squad:<veteran>' names another veteran's squad. Pure.

// Why one order cannot be kept, or null.
export function squadOrderProblem(slot){
  if(!Array.isArray(slot)||slot.length!==2||!SQUAD_STANDING.actions[slot[0]])return 'Choose an action.';
  const allowed=SQUAD_STANDING.targetsFor[slot[0]],t=slot[1];
  if(!allowed.length)return t===null||t==='objective'?null:'That order takes no target.';
  if(allowed.includes(t))return null;
  if(allowed.includes('squad')&&typeof t==='string'&&/^squad:[a-z][a-z0-9-]{0,39}$/.test(t))return null;
  return 'Choose a target that order can take.';
}
// The orders in words, for the panel: "withdraw to you when broken, then ...".
const TARGET_WORDS={hero:'you',nearest_enemy_group:'the nearest enemy group',enemy_cavalry:'enemy cavalry',enemy_archers:'enemy archers',objective:'the objective'};
export function summarizeSquadOrders(slots,{names={}}={}){
  const who=t=>typeof t==='string'&&t.startsWith('squad:')?`${names[t.slice(6)]??'another'}’s squad`:TARGET_WORDS[t]??'you';
  const parts=slots.map(([a,t])=>{
    switch(a){
      case 'advance_with_hero':return 'advance with you';
      case 'hold_line':return t==='objective'?'hold the marked ground':'hold the line';
      case 'attack_hero_target':return 'attack your target';
      case 'screen_flank':return `screen your flank against ${who(t)}`;
      case 'guard_standard':return t==='convoy'?'guard the column':`guard ${who(t)}`;
      case 'withdraw_when_broken':return 'fall back to you when broken';
      default:return a;
    }
  });
  return parts.length?`${parts[0][0].toUpperCase()}${parts[0].slice(1)}${parts.slice(1).map(p=>`; else ${p}`).join('')}.`:'None.';
}
