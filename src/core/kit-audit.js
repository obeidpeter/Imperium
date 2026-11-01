import {ITEMS,STARTING_KIT,SLOTS} from '../data/items.js';
import {WEAPONS,SHIELDS,TRAINING_PATHS,BASE_ATTRIBUTES} from '../data/realtime-rules.js';
import {PAY,DONATIVES,PROMOTION_ISSUE,TP,quartermasterStock,smithStock,SMITH} from '../data/soldier.js';
import {CAMP_CONTAINERS,FIELD_CONTAINERS} from '../data/containers.js';
import {CHAMPIONS} from '../data/champions.js';
import {CHAPTERS} from '../data/campaign.js';
import {ARCHETYPES,factionFor,tierFor} from '../data/realtime-forces.js';
import {ERRANDS} from '../data/dialogue.js';
import {tpAuditTotal} from './tp-audit.js';
import {createWorld} from './realtime/simulation.js';
import {forecast} from './realtime/abilities.js';
import {derivedValues} from './realtime/combat.js';

// The kit audit (release 11, docs/kit-audit.md): as the training-point audit
// fixes the most training a soldier can earn, this fixes, chapter by chapter,
// the coin he can have and the kit he can wear, by two reference soldiers:
// one who wears what the army issues and spends half his training, and one who
// also opens every container, buys the best upgrades he can afford and spends
// all of it. Its duels read the game's own blow forecast (combat.js). Pure.

const freeze=value=>Object.freeze(value);
// How much a piece is worth to a soldier who fights in the line: a weapon's mean
// damage per second of its swing, a shield's block, a belt's missiles, and a
// garment's protection against cut, point and crush; less its Restriction.
export function itemScore(id){
  const i=ITEMS[id];if(!i?.slot)return 0;
  const bonus=Object.values(i.bonus??{}).reduce((n,v)=>n+v,0)*2,weight=(i.restriction??0)*.3;
  if(i.weapon){const w=WEAPONS[i.weapon];if(!w||w.ranged)return 0;return Object.values(w.damage).reduce((n,[a,b])=>n+(a+b)/2,0)/w.swing*4-weight+bonus;}
  if(i.shield)return (SHIELDS[i.shield]?.block??0)*30-weight+bonus;
  if(i.belt)return (i.belt.pilum??0)*2+(i.belt.dart??0)+bonus;
  let p=0;for(const t of ['cut','pierce','crush']){const v=i.protection?.[t];if(v)p+=v.absorb*1.5+v.resist*20;}
  const stun=i.protection?.stun?i.protection.stun.absorb*.5+i.protection.stun.resist*5:0;
  return p+stun-weight+bonus;
}
const placeOf=id=>{const i=ITEMS[id];return i?.slot?`${i.slot}:${i.slot==='charm'?0:i.layer??0}`:null;};
const chapterOf=encounterId=>CHAPTERS.find(c=>c.encounters.some(e=>e.id===encounterId))?.id??null;
const sale=id=>Math.floor((ITEMS[id]?.value??0)*.5);

// What each source offers by the start of a chapter's battles: what the army has
// issued, the shelves, and what earlier chapters' containers and champions held
// together with this chapter's camp containers.
export function kitSources(chapter){
  const issued=[...Object.values(STARTING_KIT.recruit.worn),...STARTING_KIT.recruit.pack];
  for(let c=1;c<chapter;c++)issued.push(...(PROMOTION_ISSUE[c]??[]));
  const found=[...Object.entries(CAMP_CONTAINERS).filter(([c])=>Number(c)<=chapter).flatMap(([,list])=>list.flatMap(x=>x.contents)),
    ...Object.entries(FIELD_CONTAINERS).filter(([id])=>chapterOf(id)<chapter).flatMap(([,list])=>list.flatMap(x=>x.contents)),
    ...Object.entries(CHAMPIONS).filter(([id])=>chapterOf(id)<chapter).flatMap(([,c])=>c.loot)];
  const shop=[...new Set([...quartermasterStock(chapter),...smithStock(chapter)])];
  return {issued,found:found.filter(id=>ITEMS[id]),shop};
}
// The most coin a soldier can have drawn by a chapter's battles, before spending any:
// his first purse, pay, donatives and errands, and the sale of what he found.
export function incomeCeiling(chapter){
  let n=STARTING_KIT.recruit.denarii;
  for(let c=1;c<=chapter;c++)n+=PAY[c]??0;
  for(const [id,d]of Object.entries(DONATIVES))if(chapterOf(id)<chapter)n+=d;
  for(const e of Object.values(ERRANDS))if(e.chapter<=chapter)n+=e.reward?.denarii??0;
  for(const id of kitSources(chapter).found)if(!ITEMS[id].slot&&!ITEMS[id].keep&&ITEMS[id].kind!=='key')n+=sale(id);
  return n;
}
// The best piece for each place among those given.
export function bestLoadout(ids){
  const out={};for(const id of ids){const p=placeOf(id);if(!p||ITEMS[id].weapon&&WEAPONS[ITEMS[id].weapon]?.ranged)continue;
    if(!out[p]||itemScore(id)>itemScore(out[p])||itemScore(id)===itemScore(out[p])&&id<out[p])out[p]=id;}
  return out;
}
const loadoutScore=loadout=>Object.values(loadout).reduce((n,id)=>n+itemScore(id),0);
// The issued soldier wears the best the army gave him; the engaged one adds what he found and
// buys, the largest gain for its price first, within the coin he can have had.
export function referenceLoadouts(chapter){
  const src=kitSources(chapter),issued=bestLoadout(src.issued),owned=[...src.issued,...src.found.filter(id=>ITEMS[id].slot)];
  let engaged=bestLoadout(owned),purse=incomeCeiling(chapter);const bought=[];
  for(let guard=0;guard<30;guard++){
    const offer=src.shop.filter(id=>ITEMS[id]?.slot&&!(ITEMS[id].weapon&&WEAPONS[ITEMS[id].weapon]?.ranged))
      .map(id=>({id,gain:itemScore(id)-(engaged[placeOf(id)]?itemScore(engaged[placeOf(id)]):0),price:ITEMS[id].value}))
      .filter(o=>o.gain>1e-9&&o.price<=purse).sort((a,b)=>b.gain/Math.max(1,b.price)-a.gain/Math.max(1,a.price)||(a.id<b.id?-1:1))[0];
    if(!offer)break;purse-=offer.price;bought.push(offer.id);engaged=bestLoadout([...Object.values(engaged),offer.id]);
  }
  return {issued,engaged,bought,issuedScore:loadoutScore(issued),engagedScore:loadoutScore(engaged)};
}
// A legionary's attributes once he has spent `points` of training by his path's order.
const RAISE=['combat','str','con','agi'];
function trained(points){
  const a={...BASE_ATTRIBUTES};for(const [k,v]of Object.entries(TRAINING_PATHS.legionary.mods))a[k]+=v;
  let left=points,i=0;for(let guard=0;guard<200;guard++){const k=RAISE[i%RAISE.length];i++;const cost=a[k]<20?TP.below20:TP.from20+Math.floor((a[k]-20)/TP.step);if(left<cost)break;left-=cost;a[k]++;}
  return a;
}
// One duel by the game's forecast: the seconds each needs to fell the other, face to face.
const GRID=Array.from({length:4},()=>Array(4).fill('grass'));
function duel(soldier,foe){
  const world=createWorld({map:{id:'duel',width:4,height:4,terrain:GRID},seed:1,actors:[
    {id:'hero',name:'Soldier',side:'player',role:'soldier',attributes:soldier.attributes,kit:soldier.kit,at:[4,5],face:[1,0],drawn:true},
    {id:'foe',name:'Foe',side:'enemy',role:foe.role??'infantry',attributes:foe.attributes,kit:foe.kit,at:[5.4,5],face:[-1,0],drawn:true,alert:true,aware:['hero']}],controlled:'hero'});
  const hero=world.actors.find(a=>a.id==='hero'),enemy=world.actors.find(a=>a.id==='foe');
  const pace=(a,b)=>{const f=forecast(world,a.id,'strike',{actorId:b.id}).blow;if(!f)return Infinity;
    const mean=r=>(r.min+r.max)/2,per=(1-f.block)*((Math.max(0,f.hit-f.critical))*mean(f.damage)+f.critical*mean(f.criticalDamage));
    const d=derivedValues(a),seconds=(d.swingTicks+d.recoveryTicks)/20;return per>0?b.maxHp/(per/seconds):Infinity;};
  return {kill:pace(hero,enemy),die:pace(enemy,hero)};
}
const r1=n=>Number.isFinite(n)?Math.round(n*10)/10:null;
// One chapter's audit row.
export function kitAuditChapter(chapter){
  const loadouts=referenceLoadouts(chapter),earned=tpAuditTotal(chapter-1),faction=factionFor(chapter),tier=tierFor(chapter);
  const base=ARCHETYPES[faction].infantry[0],standard={role:'infantry',kit:[...base.kit],attributes:Object.fromEntries(Object.entries({...base.attributes,elo:8,auth:8})
    .map(([k,v])=>[k,Math.max(k==='combat'?1:4,v+(tier.mods[k]??0))]))};
  const champion=Object.entries(CHAMPIONS).find(([id])=>chapterOf(id)===chapter)?.[1]??null;
  const soldiers={issued:{attributes:trained(Math.floor(earned/2)),kit:Object.values(loadouts.issued)},engaged:{attributes:trained(earned),kit:Object.values(loadouts.engaged)}};
  const duels=Object.fromEntries(Object.entries(soldiers).map(([k,s])=>{const d=duel(s,standard),c=champion?duel(s,{...champion,kit:[...champion.kit],attributes:{...champion.attributes}}):null;
    return [k,{enemy:{kill:r1(d.kill),die:r1(d.die)},champion:c?{kill:r1(c.kill),die:r1(c.die)}:null}];}));
  return {chapter,income:incomeCeiling(chapter),issuedScore:Math.round(loadouts.issuedScore),engagedScore:Math.round(loadouts.engagedScore),
    bought:loadouts.bought,champion:champion?.name??null,duels};
}
// The audit's own checks: each smith piece affordable in its chapter, every fine or named piece
// better than the best standard piece of its place on the shelves by then, and an engaged
// soldier better equipped than an issued one from Chapter II.
export function kitAuditProblems(){
  const problems=[];
  for(const {chapter,items}of SMITH)for(const id of items)if(ITEMS[id].value>incomeCeiling(chapter))problems.push(`${id}: ${ITEMS[id].value} d is beyond Chapter ${chapter}'s ceiling.`);
  for(const i of Object.values(ITEMS).filter(x=>x.grade&&x.slot)){
    const chapter=SMITH.find(s=>s.items.includes(i.id))?.chapter??12,place=placeOf(i.id);
    const standard=quartermasterStock(chapter).filter(id=>!ITEMS[id].grade&&placeOf(id)===place&&!(ITEMS[id].weapon&&WEAPONS[ITEMS[id].weapon]?.ranged));
    const best=standard.reduce((m,id)=>Math.max(m,itemScore(id)),-Infinity);
    if(standard.length&&itemScore(i.id)<=best)problems.push(`${i.id} (${itemScore(i.id).toFixed(1)}) does not beat the standard ${place} (${best.toFixed(1)}).`);
  }
  for(let c=2;c<=12;c++){const l=referenceLoadouts(c);if(l.engagedScore<l.issuedScore*1.05)problems.push(`Chapter ${c}: the engaged soldier's kit is not better than the issued one's.`);}
  return problems;
}
export const KIT_AUDIT_CHAPTERS=freeze(Array.from({length:12},(_,i)=>i+1));
