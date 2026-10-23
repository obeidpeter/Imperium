import {ATTRIBUTES,ATTRIBUTE_NAMES,BASE_ATTRIBUTES,TRAINING_PATHS,ABILITIES,FIELD_ORDER} from '../data/realtime-rules.js';
import {ITEMS,SLOTS,WORN_PLACES,PACK,STARTING_KIT} from '../data/items.js';
import {TP,COURSES,TRAINERS,DECORATIONS,DECORATION_AWARDS,TITLES,COMPANION_RANKS,COMPANIONS,PAY,DONATIVES,PROMOTION_ISSUE,APPEARANCE,PATHS,quartermasterStock}
  from '../data/soldier.js';
import {STANDING} from '../data/realtime-rules.js';
import {TRADER_STOCK} from '../data/camps.js';
import {slotProblem} from './realtime/party.js';
import {squadOrderProblem} from './realtime/squad-orders.js';
import {SQUAD_STANDING} from '../data/realtime-squads.js';
import {clone,result} from './shared.js';

// The soldier (build brief §3.5, §3.12–§3.13): his training path and
// appearance, base attributes, training points, courses, decorations and
// titles, the kit he wears by place and layer, his 10 × 6 pack, what he left
// on the ground in each area, and his purse. Pure functions over the campaign
// state; nothing here reads the clock or the random generator.

export const SOLDIER_VERSION=1;
const MAX_ATTRIBUTE=60,GROUND_LIMIT=24,PACK_LIMIT=60;
const sum=(a,b)=>{const out={...a};for(const [k,v]of Object.entries(b??{}))out[k]=(out[k]??0)+v;return out;};

export function createSoldier({path='legionary',appearance={},chosen=true}={}){
  if(!PATHS.includes(path))throw new Error('Choose Legionary, Explorator or Librarius training.');
  const base={...BASE_ATTRIBUTES};for(const [k,v]of Object.entries(TRAINING_PATHS[path].mods))base[k]+=v;
  const kit=STARTING_KIT.recruit,soldier={version:SOLDIER_VERSION,path,chosen,appearance:normalAppearance(appearance),base,tp:0,tpEarned:0,
    rewarded:{capabilities:[],encounters:[],errands:[],commendations:[]},courses:[],decorations:[],titles:[],worn:{...kit.worn},pack:[],ground:{},nextUid:1,
    denarii:kit.denarii,paid:[],issued:[],companions:{},flags:{},errands:{}};
  for(const id of kit.pack)packAdd(soldier,id);
  return soldier;
}
function normalAppearance(a={}){
  const pick=(key,value)=>Number.isInteger(value)&&value>=0&&value<APPEARANCE[key].length?value:0;
  return {hair:pick('hair',a.hair),beard:pick('beard',a.beard),tunic:pick('tunic',a.tunic),cloak:pick('cloak',a.cloak)};
}
// A chronicle begun before 0.40 has no soldier record, and loading it never
// adds one: it keeps its exact saved state. Until the player adopts a soldier
// (the one-time choice of training and appearance), the rules read a default
// Legionary with the kit his chapter would have issued.
export function soldierOf(state){
  if(state.soldier)return state.soldier;
  const s=createSoldier({path:'legionary',chosen:false});issuePromotions({soldier:s},Math.max(0,(state.chapter??1)-1));return s;
}
export function adoptSoldier(state,{path='legionary',appearance={}}={}){
  if(state.soldier?.chosen)return result(false,'Your soldier’s training is already chosen.');
  if(state.phase==='encounter')return result(false,'Choose your soldier’s training in camp.');
  if(!PATHS.includes(path))return result(false,'Choose Legionary, Explorator or Librarius training.');
  const kept=state.soldier,s=createSoldier({path,appearance});
  if(kept){s.tp=kept.tp;s.tpEarned=kept.tpEarned;s.rewarded=kept.rewarded;s.worn=kept.worn;s.pack=kept.pack;s.ground=kept.ground;s.nextUid=kept.nextUid;
    s.denarii=kept.denarii;s.paid=kept.paid;s.issued=kept.issued;s.companions=kept.companions;s.flags=kept.flags;s.errands=kept.errands;s.courses=kept.courses;
    s.decorations=kept.decorations;s.titles=kept.titles;}
  else issuePromotions({soldier:s},Math.max(0,state.chapter-1));
  state.soldier=s;return result(true,`${TRAINING_PATHS[path].name} training recorded.`);
}

// Effective attributes: base, plus decorations, titles and worn charms.
export function soldierAttributes(soldier){
  let out={...soldier.base};
  for(const id of soldier.decorations)out=sum(out,DECORATIONS[id]?.bonus);
  for(const id of soldier.titles)out=sum(out,TITLES[id]?.bonus);
  for(const id of wornIds(soldier))out=sum(out,ITEMS[id]?.bonus);
  return out;
}
// The merged effects of the courses taken, for the rules (combat.js reads them):
// these add up; the others replace a value.
const ADDITIVE=new Set(['restriction','attack','health','rallyRadius','resolve']);
export function courseEffects(courses=[]){
  const out={};
  for(const id of courses)for(const [k,v]of Object.entries(COURSES[id]?.effect??{}))out[k]=ADDITIVE.has(k)?(out[k]??0)+v:v;
  return out;
}

// Training points: 4 a point below 20, 5 from 20, 6 from 30, on the base value.
export const attributeCost=value=>value<20?TP.below20:TP.from20+Math.floor((value-20)/TP.step);
export function raiseAttribute(state,attribute){
  const s=state.soldier;if(!ATTRIBUTES.includes(attribute))return result(false,'Choose an attribute.');
  if(state.phase==='encounter')return result(false,'Spend training points in camp.');
  const value=s.base[attribute],cost=attributeCost(value);
  if(value>=MAX_ATTRIBUTE)return result(false,`${ATTRIBUTE_NAMES[attribute]} is already at its highest.`);
  if(s.tp<cost)return result(false,`Raising ${ATTRIBUTE_NAMES[attribute]} needs ${cost} training points.`);
  s.tp-=cost;s.base[attribute]++;return result(true,`${ATTRIBUTE_NAMES[attribute]} rises to ${s.base[attribute]} for ${cost} training points.`);
}
export function grantTP(state,amount,reason=''){
  const n=Math.max(0,Math.floor(amount));if(!n)return 0;state.soldier.tp+=n;state.soldier.tpEarned+=n;
  if(reason)state.log?.push?.(`${n} training ${n===1?'point':'points'}: ${reason}`);return n;
}

// Courses: once each, from a trainer whose chapter has come.
export function courseOptions(state,trainerId){
  const s=state.soldier,trainer=TRAINERS[trainerId];if(!trainer)return [];
  return Object.values(COURSES).filter(c=>c.trainer===trainerId).map(c=>{
    const taken=s.courses.includes(c.id),open=state.chapter>=trainer.chapter;
    const reason=taken?'Already taken.':!open?`${trainer.title} teaches from Chapter ${trainer.chapter}.`:s.tp<c.tp?`Needs ${c.tp} training points.`
      :s.denarii<c.denarii?`Needs ${c.denarii} denarii.`:null;
    return {...c,taken,available:!reason,reason};
  });
}
export function takeCourse(state,courseId){
  const c=COURSES[courseId];if(!c)return result(false,'Unknown course.');if(state.phase==='encounter')return result(false,'Courses are taught in camp.');
  const option=courseOptions(state,c.trainer).find(o=>o.id===courseId);if(!option.available)return result(false,option.reason);
  const s=state.soldier;s.tp-=c.tp;s.denarii-=c.denarii;s.courses.push(c.id);
  return result(true,`${c.name} learnt: ${c.summary}`);
}
// Techniques the soldier can use now, in the field bar's order.
export function knownAbilities(state){
  const s=soldierOf(state);
  // Specialists' actions belong to veteran companions, never to the soldier himself.
  return FIELD_ORDER.filter(id=>{const a=ABILITIES[id],u=a?.unlock??{};return a?.kind!=='specialist'&&(u.course?s.courses.includes(u.course):(u.chapter??1)<=state.chapter);});
}

// Kit. Worn places are "slot:layer"; the rules' kit list is the worn ids in paperdoll order.
export const wornIds=soldier=>WORN_PLACES.map(place=>soldier.worn[place]).filter(Boolean);
export function placeFor(itemId,worn={}){
  const item=ITEMS[itemId];if(!item?.slot)return null;
  if(item.slot==='charm')return worn['charm:0']?worn['charm:1']?'charm:0':'charm:1':'charm:0';
  return `${item.slot}:${item.layer}`;
}
export function wearProblem(state,itemId,attributes=soldierAttributes(state.soldier)){
  const item=ITEMS[itemId];if(!item)return 'Unknown item.';if(!item.slot)return `${item.name} cannot be worn.`;
  for(const [k,v]of Object.entries(item.requires)){
    if(k==='chapter'){if(state.chapter<v)return `Needs Chapter ${v}.`;continue;}
    if((attributes[k]??0)<v)return `Needs ${ATTRIBUTE_NAMES[k]} ${v}.`;
  }
  return null;
}
// The pack: a 10 × 6 grid, each item taking its shape.
const cells=(x,y,{w,h})=>{const out=[];for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)out.push((y+dy)*PACK.cols+x+dx);return out;};
function occupied(pack,except=null){const used=new Set();for(const e of pack)if(e.uid!==except)for(const c of cells(e.x,e.y,ITEMS[e.id].shape))used.add(c);return used;}
export function packFits(pack,itemId,x,y,except=null){
  const shape=ITEMS[itemId]?.shape;if(!shape||x<0||y<0||x+shape.w>PACK.cols||y+shape.h>PACK.rows)return false;
  const used=occupied(pack,except);return cells(x,y,shape).every(c=>!used.has(c));
}
export function packSpot(pack,itemId){
  for(let y=0;y<PACK.rows;y++)for(let x=0;x<PACK.cols;x++)if(packFits(pack,itemId,x,y))return {x,y};
  return null;
}
// Add to the first free place (or a given one): the new entry, or null if it does not fit.
export function packAdd(soldier,itemId,at=null){
  const spot=at&&packFits(soldier.pack,itemId,at.x,at.y)?at:packSpot(soldier.pack,itemId);if(!spot||soldier.pack.length>=PACK_LIMIT)return null;
  const entry={uid:`i${soldier.nextUid++}`,id:itemId,x:spot.x,y:spot.y};soldier.pack.push(entry);return entry;
}
const TYPE_ORDER=['weapon','shield','body','head','arms','legs','feet','belt','charm',null];
// Sort: first fit, largest area first, then by type (§3.13).
export function sortPack(soldier){
  const items=[...soldier.pack].sort((a,b)=>{const A=ITEMS[a.id],B=ITEMS[b.id];
    return B.shape.w*B.shape.h-A.shape.w*A.shape.h||TYPE_ORDER.indexOf(A.slot)-TYPE_ORDER.indexOf(B.slot)||(a.id<b.id?-1:a.id>b.id?1:0);});
  const placed=[],left=[];
  for(const e of items){const spot=packSpot(placed,e.id);if(spot)placed.push({...e,...spot});else left.push(e);}
  soldier.pack=placed;return left;
}
export function moveInPack(state,uid,x,y){
  const s=state.soldier,e=s.pack.find(p=>p.uid===uid);if(!e)return result(false,'That item is not in your pack.');
  if(!packFits(s.pack,e.id,x,y,uid))return result(false,'It does not fit there.');e.x=x;e.y=y;return result(true,`${ITEMS[e.id].name} moved.`);
}
// To the pack, or to this area's ground strip if the pack is full.
function stow(soldier,itemId,area){
  if(packAdd(soldier,itemId))return 'pack';
  const strip=soldier.ground[area]??=[];if(strip.length>=GROUND_LIMIT)strip.shift();strip.push({uid:`i${soldier.nextUid++}`,id:itemId});return 'ground';
}
// Wear a piece from the pack; the piece it replaces goes to the pack or the ground.
export function wear(state,uid,{area=areaOf(state)}={}){
  const s=state.soldier,entry=s.pack.find(p=>p.uid===uid);if(!entry)return result(false,'Choose an item from your pack.');
  const problem=wearProblem(state,entry.id);if(problem)return result(false,problem);
  const place=placeFor(entry.id,s.worn),old=s.worn[place];s.pack=s.pack.filter(p=>p.uid!==uid);s.worn[place]=entry.id;
  if(old){const where=stow(s,old,area);return result(true,`You wear the ${ITEMS[entry.id].name}; the ${ITEMS[old].name} goes ${where==='pack'?'to your pack':'on the ground'}.`);}
  return result(true,`You wear the ${ITEMS[entry.id].name}.`);
}
export function takeOff(state,place,{area=areaOf(state)}={}){
  const s=state.soldier,id=s.worn[place];if(!id)return result(false,'Nothing is worn there.');
  delete s.worn[place];const where=stow(s,id,area);return result(true,`The ${ITEMS[id].name} goes ${where==='pack'?'to your pack':'on the ground'}.`);
}
export function drop(state,uid,{area=areaOf(state)}={}){
  const s=state.soldier,entry=s.pack.find(p=>p.uid===uid);if(!entry)return result(false,'Choose an item from your pack.');
  if(ITEMS[entry.id].keep)return result(false,`You keep the ${ITEMS[entry.id].name}.`);
  s.pack=s.pack.filter(p=>p.uid!==uid);const strip=s.ground[area]??=[];if(strip.length>=GROUND_LIMIT)strip.shift();strip.push({uid:entry.uid,id:entry.id});
  return result(true,`You leave the ${ITEMS[entry.id].name} on the ground here.`);
}
export function pickUp(state,uid,{area=areaOf(state)}={}){
  const s=state.soldier,strip=s.ground[area]??[],entry=strip.find(g=>g.uid===uid);if(!entry)return result(false,'That item is not here.');
  if(!packAdd(s,entry.id))return result(false,'Your pack is full. Sort it, or drop something.');
  s.ground[area]=strip.filter(g=>g.uid!==uid);if(!s.ground[area].length)delete s.ground[area];return result(true,`You take the ${ITEMS[entry.id].name}.`);
}
// Take all: everything that fits moves to the pack; the rest stays.
export function takeAll(soldier,items){
  const taken=[],left=[];for(const id of items)(packAdd(soldier,id)?taken:left).push(id);return {taken,left};
}
export const areaOf=state=>state.phase==='encounter'&&state.encounter?`field:${state.encounter.id}`:`camp:${state.chapter}`;

// Companions' own kit: worn pieces only. Give puts a piece on him and returns his old one.
export function companionWorn(state,id){return {...(COMPANIONS[id]?.worn??{}),...(state.soldier.companions[id]?.worn??{})};}
export function give(state,uid,companionId){
  const s=state.soldier,entry=s.pack.find(p=>p.uid===uid),profile=COMPANIONS[companionId];
  if(!entry||!profile)return result(false,'Choose an item and a companion.');
  const attributes=companionAttributes(state,companionId),problem=wearProblem(state,entry.id,attributes);
  if(problem)return result(false,`${profile.name}: ${problem}`);
  const worn=companionWorn(state,companionId),place=placeFor(entry.id,worn),old=worn[place];
  s.pack=s.pack.filter(p=>p.uid!==uid);(s.companions[companionId]??={worn:{}}).worn[place]=entry.id;
  const where=old?stow(s,old,areaOf(state)):null;
  return result(true,`${profile.name} takes the ${ITEMS[entry.id].name}${old?`; his ${ITEMS[old].name} goes ${where==='pack'?'to your pack':'on the ground'}`:''}.`);
}
export function companionRank(veteran){return [...COMPANION_RANKS].reverse().find(r=>(veteran?.commendations??0)>=r.commendations)??COMPANION_RANKS[0];}
export function companionAttributes(state,id){
  const profile=COMPANIONS[id];if(!profile)return {...BASE_ATTRIBUTES};
  let out={...BASE_ATTRIBUTES};for(const [k,v]of Object.entries(TRAINING_PATHS[profile.path].mods))out[k]+=v;out={...out,...profile.attributes};
  const veteran=state.company?.find(v=>v.id===id);out=sum(out,companionRank(veteran).bonus);
  for(const item of Object.values(companionWorn(state,id)))out=sum(out,ITEMS[item]?.bonus);
  return out;
}

// Prices: value × (1 ∓ min(0.2, max(0, Elo − 10)/100)). Traders buy at half value.
export const SELL_FACTOR=.5;
export function priceOf(itemId,eloquence,{selling=false}={}){
  const value=ITEMS[itemId]?.value??0,d=Math.min(.2,Math.max(0,eloquence-10)/100);
  return selling?Math.floor(value*SELL_FACTOR*(1+d)):Math.ceil(value*(1-d));
}
export function buy(state,itemId,{stock=null}={}){
  const s=state.soldier,item=ITEMS[itemId];if(!item)return result(false,'Unknown item.');if(stock&&!stock.includes(itemId))return result(false,'Not for sale here.');
  const price=priceOf(itemId,soldierAttributes(s).elo);if(s.denarii<price)return result(false,`Needs ${price} denarii.`);
  if(!packSpot(s.pack,itemId))return result(false,'Your pack is full. Sort it, or sell something.');
  s.denarii-=price;packAdd(s,itemId);return result(true,`Bought the ${item.name} for ${price} denarii.`);
}
export function sell(state,uid){
  const s=state.soldier,entry=s.pack.find(p=>p.uid===uid);if(!entry)return result(false,'Choose an item from your pack.');
  const item=ITEMS[entry.id];if(item.keep||item.kind==='quest')return result(false,`You keep the ${item.name}.`);
  const price=priceOf(entry.id,soldierAttributes(s).elo,{selling:true});s.pack=s.pack.filter(p=>p.uid!==uid);s.denarii+=price;
  return result(true,`Sold the ${item.name} for ${price} denarii.`);
}
export function collectPay(state){
  const s=state.soldier;if(state.phase!=='camp')return result(false,'Pay is collected from the quartermaster in camp.');
  if(s.paid.includes(state.chapter))return result(false,'You have drawn this chapter’s pay.');
  const pay=PAY[state.chapter]??0;s.paid.push(state.chapter);s.denarii+=pay;return result(true,`You draw ${pay} denarii in pay.`);
}

// Kit issued with each promotion goes to the pack (or the camp ground).
export function issuePromotions(state,upToChapter){
  const s=state.soldier;
  for(let ch=1;ch<=upToChapter;ch++)if(PROMOTION_ISSUE[ch]&&!s.issued.includes(ch)){s.issued.push(ch);for(const id of PROMOTION_ISSUE[ch])stow(s,id,`camp:${ch+1}`);}
}
// Decorations for the deeds the campaign record shows (at a result's commit).
export function awardDecorations(state,encounterId){
  const s=state.soldier,awarded=[];
  for(const a of DECORATION_AWARDS){
    if(a.encounter!==encounterId||s.decorations.includes(a.decoration))continue;
    if(a.decision&&state.decisions[a.decision[0]]!==a.decision[1])continue;
    s.decorations.push(a.decoration);awarded.push(a.decoration);
  }
  return awarded;
}
export function awardTitle(state,id){
  const s=state.soldier;if(!TITLES[id]||s.titles.includes(id))return false;s.titles.push(id);return true;
}
export const donativeFor=encounterId=>DONATIVES[encounterId]??0;
export const objectiveTP=encounterId=>TP.objective[encounterId]??2;

// The soldier's record must be well formed (save validation).
export function validateSoldier(state,fail){
  const s=state.soldier;if(s===undefined)return;
  const int=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max,ids=(list,table,max)=>Array.isArray(list)&&list.length<=max&&new Set(list).size===list.length
    &&list.every(id=>typeof id==='string'&&table[id]);
  if(!s||typeof s!=='object'||s.version!==SOLDIER_VERSION||!PATHS.includes(s.path)||typeof s.chosen!=='boolean')fail('soldier record.');
  if(!s.appearance||Object.keys(APPEARANCE).some(k=>!int(s.appearance[k],0,APPEARANCE[k].length-1)))fail('soldier appearance.');
  if(!s.base||ATTRIBUTES.some(k=>!int(s.base[k],1,MAX_ATTRIBUTE)))fail('soldier attributes.');
  if(!int(s.tp,0,9999)||!int(s.tpEarned,0,9999)||s.tp>s.tpEarned||!int(s.denarii,0,999999)||!int(s.nextUid,1,1e9))fail('soldier points or purse.');
  if(!ids(s.courses,COURSES,40)||!ids(s.decorations,DECORATIONS,40)||!ids(s.titles,TITLES,40))fail('soldier courses or honours.');
  if(!s.worn||typeof s.worn!=='object'||Object.entries(s.worn).some(([place,id])=>!WORN_PLACES.includes(place)||!ITEMS[id]||!placeMatches(place,id)))fail('worn kit.');
  if(!Array.isArray(s.pack)||s.pack.length>PACK_LIMIT||new Set(s.pack.map(e=>e?.uid)).size!==s.pack.length)fail('pack.');
  const used=new Set();
  for(const e of s.pack){if(!e||typeof e.uid!=='string'||!ITEMS[e.id]||!int(e.x,0,PACK.cols-1)||!int(e.y,0,PACK.rows-1))fail('pack item.');
    const shape=ITEMS[e.id].shape;if(e.x+shape.w>PACK.cols||e.y+shape.h>PACK.rows)fail('pack item place.');
    for(const c of cells(e.x,e.y,shape)){if(used.has(c))fail('overlapping pack items.');used.add(c);}}
  if(!s.ground||typeof s.ground!=='object'||Object.keys(s.ground).length>64||Object.entries(s.ground).some(([area,list])=>!/^(camp|field):[a-z0-9-]{1,40}$/.test(area)
    ||!Array.isArray(list)||list.length>GROUND_LIMIT||list.some(g=>!g||typeof g.uid!=='string'||!ITEMS[g.id])))fail('ground strips.');
  if(!Array.isArray(s.paid)||!s.paid.every(c=>int(c,1,12))||!Array.isArray(s.issued)||!s.issued.every(c=>int(c,1,12)))fail('pay record.');
  if(!s.rewarded||['capabilities','encounters','errands','commendations'].some(k=>!Array.isArray(s.rewarded[k])||s.rewarded[k].length>400))fail('reward record.');
  if(!s.companions||typeof s.companions!=='object'||Object.entries(s.companions).some(([id,c])=>!COMPANIONS[id]||!c?.worn
    ||Object.entries(c.worn).some(([place,item])=>!WORN_PLACES.includes(place)||!ITEMS[item]||!placeMatches(place,item))))fail('companion kit.');
  if(!s.flags||typeof s.flags!=='object'||Object.keys(s.flags).length>400||!s.errands||typeof s.errands!=='object'||Object.keys(s.errands).length>80)fail('soldier story record.');
  if(s.orders!==undefined&&(!s.orders||typeof s.orders!=='object'||Object.entries(s.orders).some(([id,slots])=>!COMPANIONS[id]||!Array.isArray(slots)||slots.length>4
    ||slots.some(slot=>!Array.isArray(slot)||slot.length!==2||slotProblem(slot)))))fail('standing orders.');
  if(s.party!==undefined&&(!Array.isArray(s.party)||s.party.length>3||new Set(s.party).size!==s.party.length||s.party.some(id=>!COMPANIONS[id])))fail('chosen party.');
  if(s.squadOrders!==undefined&&(!s.squadOrders||typeof s.squadOrders!=='object'||Object.entries(s.squadOrders).some(([id,slots])=>!COMPANIONS[id]||!Array.isArray(slots)
    ||!slots.length||slots.length>4||slots.some(slot=>squadOrderProblem(slot)||typeof slot[1]==='string'&&slot[1].startsWith('squad:')&&!COMPANIONS[slot[1].slice(6)]))))
    fail('squad standing orders.');
}
// The soldier's own commands, from the kit, character, trainer and company
// panels: one entry point, each refusal leaving the chronicle unchanged. Kit,
// training and orders change in camp; an encounter keeps the soldier it began with.
export function soldierCommand(state,command={}){
  const k=command.kind;
  if(k==='adopt')return adoptSoldier(state,command);
  if(!state.soldier)return result(false,'Choose your soldier’s training first.');
  if(state.phase==='encounter')return result(false,'Change kit, training and standing orders in camp.');
  switch(k){
    case 'raise':return raiseAttribute(state,command.attribute);
    case 'course':return takeCourse(state,command.courseId);
    case 'wear':return wear(state,command.uid);
    case 'takeOff':return typeof command.place==='string'&&state.soldier.worn[command.place]?takeOff(state,command.place):result(false,'Nothing is worn there.');
    case 'drop':return drop(state,command.uid);
    case 'pickUp':return pickUp(state,command.uid);
    case 'move':return Number.isInteger(command.x)&&Number.isInteger(command.y)?moveInPack(state,command.uid,command.x,command.y):result(false,'Choose a place in the pack.');
    case 'sort':{
      const trial=clone(state.soldier),left=sortPack(trial);
      if(left.length)return result(false,'Sorting would not fit everything; move pieces by hand.');
      state.soldier.pack=trial.pack;return result(true,'Pack sorted: the largest pieces first.');
    }
    case 'give':return give(state,command.uid,command.companionId);
    case 'buy':return buy(state,command.itemId,{stock:command.from==='trader'?TRADER_STOCK[state.chapter]??[]:quartermasterStock(state.chapter)});
    case 'sell':return sell(state,command.uid);
    case 'pay':return collectPay(state);
    case 'orders':return setStandingOrders(state,command.companionId,command.preset?STANDING.presets[command.preset]:command.slots);
    case 'squad-orders':return setSquadOrders(state,command.companionId,command.preset==='battle'?null:command.preset?SQUAD_STANDING.presets[command.preset]??[]:command.slots);
    case 'party':return chooseParty(state,command.party);
    default:return result(false,'Unknown command.');
  }
}
// A companion's standing orders for the fights to come: a preset or four slots.
export function setStandingOrders(state,id,slots){
  if(!COMPANIONS[id])return result(false,'Choose a companion.');
  if(!Array.isArray(slots)||slots.length>4)return result(false,'Choose up to four orders.');
  const problem=slots.map(slot=>Array.isArray(slot)&&slot.length===2?slotProblem(slot):'Choose an action.').find(Boolean);if(problem)return result(false,problem);
  (state.soldier.orders??={})[id]=slots.map(([a,t])=>[a,t]);return result(true,`${COMPANIONS[id].name}’s standing orders are set.`);
}
// A veteran's squad's standing orders (from Chapter IV), or null for the battle's own:
// he need not lead it; another officer keeps them while he marches with the soldier.
export function setSquadOrders(state,id,slots){
  const v=(state.company??[]).find(x=>x.id===id);if(!COMPANIONS[id]||!v)return result(false,'Choose a veteran of the company.');
  const name=v.name??COMPANIONS[id].name;
  if(slots===null){if(state.soldier.squadOrders){delete state.soldier.squadOrders[id];if(!Object.keys(state.soldier.squadOrders).length)delete state.soldier.squadOrders;}
    return result(true,`${name}’s squad will keep each battle’s own orders.`);}
  if(!Array.isArray(slots)||!slots.length||slots.length>4)return result(false,'Choose one to four orders.');
  const problem=slots.map(slot=>squadOrderProblem(slot)).find(Boolean);if(problem)return result(false,problem);
  if(slots.some(([,t])=>typeof t==='string'&&t.startsWith('squad:')&&(t.slice(6)===id||!COMPANIONS[t.slice(6)])))return result(false,'Choose another veteran’s squad to guard.');
  (state.soldier.squadOrders??={})[id]=slots.map(([a,t])=>[a,t]);return result(true,`${name}’s squad’s standing orders are set.`);
}
// Who marches with the soldier (from Chapter III): up to three fit veterans of the company roll.
export function chooseParty(state,party){
  if(!Array.isArray(party)||party.length>3||new Set(party).size!==party.length)return result(false,'Choose up to three companions.');
  const roll=state.company??[];
  for(const id of party){const v=roll.find(x=>x.id===id);if(!v||!COMPANIONS[id])return result(false,'Choose companions from the company roll.');
    if((v.recovery??0)>0)return result(false,`${v.name??COMPANIONS[id].name} is still recovering.`);}
  state.soldier.party=[...party];return result(true,party.length?`${party.length} ${party.length===1?'companion marches':'companions march'} with you.`:'You march alone.');
}
function placeMatches(place,id){const [slot,layer]=place.split(':'),item=ITEMS[id];return item.slot===slot&&(slot==='charm'||item.layer===Number(layer));}
export {SLOTS,PACK,ITEMS,COURSES,TRAINERS,DECORATIONS,TITLES,COMPANIONS,APPEARANCE,PATHS};
export const soldierSummary=state=>{const s=state.soldier;return {path:TRAINING_PATHS[s.path].name,attributes:soldierAttributes(s),tp:s.tp,denarii:s.denarii};};
export const cloneSoldier=s=>clone(s);

// Rewards at a result's commit (and nowhere else, so a retry or reload can
// never repeat them): the objective's TP once per encounter, one TP per
// capability newly demonstrated, the staged kill and commendation TP of a
// real-time encounter, decorations for marked deeds, and any donative.
export function rewardCapabilities(state){
  const s=state.soldier,granted=[];
  for(const [chapter,list]of Object.entries(state.chapterCapabilities??{}))for(const id of list){
    const key=`${chapter}:${id}`;if(s.rewarded.capabilities.includes(key))continue;s.rewarded.capabilities.push(key);granted.push(key);
  }
  return grantTP(state,granted.length*TP.perCapability);
}
export function commitSoldierRewards(state,e){
  const s=state.soldier;if(!s)return {tp:0,decorations:[],denarii:0};
  let tp=0;
  if(!s.rewarded.encounters.includes(e.id)){s.rewarded.encounters.push(e.id);tp+=grantTP(state,objectiveTP(e.id));}
  tp+=rewardCapabilities(state);
  tp+=grantTP(state,Math.min(TP.killCap,e.staged?.killTP??0));
  for(const c of e.staged?.commendations??[])if(!s.rewarded.commendations.includes(`${e.id}:${c.id}`)){
    s.rewarded.commendations.push(`${e.id}:${c.id}`);tp+=grantTP(state,Math.max(TP.commendation.min,Math.min(TP.commendation.max,c.tp??1)));
  }
  const decorations=awardDecorations(state,e.id),denarii=donativeFor(e.id);s.denarii+=denarii;
  // What the soldier took from the field goes to his pack, or to the camp ground if it is full.
  const spoils=(e.staged?.spoils??[]).filter(id=>ITEMS[id]);for(const id of spoils)stow(s,id,`camp:${state.chapter}`);
  for(const line of e.staged?.journal??[])if(typeof line==='string')state.log.push(line.slice(0,240));
  return {tp,decorations,denarii,spoils};
}
