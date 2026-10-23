import {ITEMS} from '../data/items.js';
import {ATTRIBUTES} from '../data/realtime-rules.js';
import {attributeCost,courseEffects,placeFor,soldierAttributes,wornIds} from '../core/soldier.js';
import {derivedValues,protectionOf} from '../core/realtime/combat.js';
import {speakerProfile} from '../core/contest.js';
import {rallyRadius} from '../core/realtime/specialists.js';

// A hypothetical outfit/attribute is a new value, never a command or a change
// to the chronicle. The same calculators used by combat provide the numbers.
const actor=s=>({attributes:soldierAttributes(s),kit:wornIds(s),effects:courseEffects(s.courses)});
const values=s=>derivedValues(actor(s));
const metrics=[['Health','health'],['Stamina','stamina'],['Attack','attack'],['Defence','defence'],['Missile attack','missile'],
  ['Restriction','restriction'],['Run speed (m/s)','run'],['Recovery (seconds)','recoveryTicks',.05]];
const tidy=n=>Number(n.toFixed(2));
const changes=(before,after)=>metrics.map(([label,key,scale=1])=>({label,before:tidy(before[key]*scale),after:tidy(after[key]*scale)})).filter(r=>r.before!==r.after);

export function equipmentComparison(soldier,itemId){
  const item=ITEMS[itemId],place=placeFor(itemId,soldier.worn);if(!item?.slot||!place)return null;
  const proposed={...soldier,worn:{...soldier.worn,[place]:itemId}},before=values(soldier),after=values(proposed);
  const old=protectionOf(actor(soldier)),next=protectionOf(actor(proposed)),rows=changes(before,after);
  if(before.weapon.name!==after.weapon.name)rows.unshift({label:'Weapon',before:before.weapon.name,after:after.weapon.name});
  for(const type of Object.keys(old)){
    if(old[type].absorb!==next[type].absorb)rows.push({label:`${type} absorption`,before:old[type].absorb,after:next[type].absorb});
    if(Math.abs(old[type].resist-next[type].resist)>.0001)rows.push({label:`${type} resistance`,before:`${Math.round(old[type].resist*100)}%`,after:`${Math.round(next[type].resist*100)}%`});
  }
  return {place,replaced:ITEMS[soldier.worn[place]]?.name??'Empty place',item:item.name,rows};
}

export const ATTRIBUTE_EFFECTS=Object.freeze({
  str:'Melee and thrown damage, Attack, equipment requirements and recovery.',
  agi:'Attack, Defence, missile accuracy and recovery.',con:'Health, Stamina, regeneration and resistance to stagger.',
  per:'Missile accuracy and spotting enemies.',elo:'Resolve, Denounce and Rebut strength; quartermaster prices.',
  auth:'Rally reach and Resolve in the chamber.',combat:'Attack and Defence.',field:'Makes you harder to notice and trace after an ambush.'
});
export function attributeImprovement(state,key){
  const s=state.soldier;if(!s||!ATTRIBUTES.includes(key))return [];
  const next={...s,base:{...s.base,[key]:s.base[key]+1}},rows=changes(values(s),values(next));
  const before=speakerProfile(state),after=speakerProfile({...state,soldier:next});
  for(const metric of ['resolve','denounce','rebut'])if(before[metric]!==after[metric])rows.push({label:`Chamber ${metric}`,before:before[metric],after:after[metric]});
  const a=rallyRadius(actor(s)),b=rallyRadius(actor(next));if(a!==b)rows.push({label:'Rally reach (m)',before:tidy(a),after:tidy(b)});
  return rows;
}

export function attributeMilestone(state,key){
  const s=state.soldier;if(!s||!ATTRIBUTES.includes(key)||s.base[key]>=60)return null;
  let cost=0;
  for(let steps=1;s.base[key]+steps<=60;steps++){
    cost+=attributeCost(s.base[key]+steps-1);
    const prior={...state,soldier:{...s,base:{...s.base,[key]:s.base[key]+steps-1}}};
    const rows=attributeImprovement(prior,key);
    if(rows.length)return {steps,cost,value:s.base[key]+steps,rows};
  }
  return null;
}
