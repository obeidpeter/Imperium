import {actorById,distanceBetween,forecast,liftable} from '../core/realtime/abilities.js';
import {objectById} from '../core/realtime/motion.js';
import {blowSummary} from '../core/realtime/intents.js';
import {ABILITIES} from '../data/realtime-rules.js';
import {DEFAULT_KEYMAP,firstKeyLabel} from './action-map.js';

// Presentation only. Read the current world each time; a selection never caches a
// combat forecast, consumes RNG, or silently acquires another opponent.
export function targetReadout(world,id,{abilityId='strike',keymap=DEFAULT_KEYMAP}={}){
  const actor=actorById(world,world.controlled),object=objectById(world,id),target=object??actorById(world,id);
  if(!actor||!target||target.hidden||object?.done&&!object.toggle)return {valid:false,text:'Target no longer available.',state:'unavailable'};
  const distance=Math.round(distanceBetween(actor,target)),where=`${target.name}, ${distance} metres`,actKey=firstKeyLabel('act_on_target',keymap);
  if(object)return {valid:true,text:`${where}. ${actKey} approaches and uses it.`,state:'object'};
  if(!target.alive)return {valid:!!target.loot?.length,text:`${target.name} has fallen.${target.loot?.length?` ${distance} metres. Sheathe weapons, then ${actKey} to search.`:' Target cleared.'}`,state:'fallen'};
  const health=`${target.hp}/${target.maxHp} Health`,down=liftable(target);
  let text=`${where} · ${health}.`;
  if(target.side!=='enemy')text+=down?` Needs rescue: Bind wounds, or sheathe weapons and ${actKey} to carry.`:target.talk?actor.drawn?` Sheathe your weapon, then ${actKey} to talk.`:` ${actKey} approaches to talk.`:'';
  const ability=ABILITIES[abilityId];
  if(ability&&(abilityId!=='strike'||target.side==='enemy')){
    const f=forecast(world,actor.id,abilityId,ability.target==='self'?{}:{actorId:id});
    text+=` ${f.name}: ${f.ok?(f.blow?blowSummary(f):f.heal?`restores up to ${f.heal} Health; ${f.bandages} bandages left.`:ability.summary):f.message}`;
  }
  if(target.side==='enemy'&&abilityId==='strike')text+=` ${actKey} orders an attack; ${firstKeyLabel('target_next_enemy',keymap)} changes target.`;
  return {valid:true,text,state:down?'rescue':'alive'};
}
