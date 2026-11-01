// The reference players' camp policies (release 11, docs/worlds-and-gameplay-plan.md):
// how a soldier who uses what the army issues, or one who also searches and buys,
// equips himself and spends his training points. Every change is a legal command
// (Game.soldierCommand and the won-field searches); a refused one changes nothing.
// The kit audit (src/core/kit-audit.js) scores pieces the same way.
//   bare    — today's calibration bot: nothing worn but the recruit's kit.
//   issued  — draws pay, wears the best of what he carries, spends half his training points.
//   engaged — also opens the camp's containers, sells spoils, buys the best upgrades he can
//             afford from the armourer and the quartermaster, searches the won field, and
//             spends all his training points.
import * as G from '../src/core/game.js';
import {ITEMS,WORN_PLACES} from '../src/data/items.js';
import {itemScore} from '../src/core/kit-audit.js';
import {quartermasterStock,smithStock} from '../src/data/soldier.js';
import {containersInCamp} from '../src/data/containers.js';
import {attributeCost,placeFor,wearProblem,priceOf,soldierAttributes,campContainerView} from '../src/core/soldier.js';

export const KIT_POLICIES=Object.freeze(['bare','issued','engaged']);
const act=(state,command)=>G.soldierCommand(state,command);
// The order a soldier of each training raises his attributes in.
const RAISE=Object.freeze({legionary:['combat','str','con','agi'],explorator:['agi','combat','field','str'],librarius:['combat','elo','auth','con']});

// Wear, place by place, the best piece he carries that he may wear.
export function wearBest(state){
  const s=state.soldier;let changed=true,guard=0;
  while(changed&&guard++<40){
    changed=false;
    for(const entry of [...s.pack]){
      const item=ITEMS[entry.id];if(!item?.slot||item.weapon==='bow'||item.weapon==='sling')continue;
      if(wearProblem(state,entry.id))continue;
      const place=placeFor(entry.id,s.worn),current=s.worn[place];
      if(itemScore(entry.id)>(current?itemScore(current):0)+1e-9&&act(state,{kind:'wear',uid:entry.uid}).ok){changed=true;break;}
    }
  }
}
// Spend training points down to `keep` by the training's order, one point at a time.
export function spendTP(state,keep=0){
  const s=state.soldier,order=RAISE[s.path]??RAISE.legionary;let guard=0,i=0;
  while(guard++<200){
    const attribute=order[i%order.length];i++;
    if(s.tp-attributeCost(s.base[attribute])<keep)break;
    if(!act(state,{kind:'raise',attribute}).ok)break;
  }
}
// Open every container of this camp he can: a lock by its key, or by force; then take all that fits.
export function searchCamp(state){
  for(const c of containersInCamp(state.chapter)){
    let view=campContainerView(state,c.id);if(!view||view.empty)continue;
    if(!view.unlocked){if(!act(state,{kind:'unlock',containerId:c.id,method:'key'}).ok)act(state,{kind:'unlock',containerId:c.id,method:'force'});view=campContainerView(state,c.id);}
    if(view.unlocked&&!view.empty)act(state,{kind:'takeFrom',containerId:c.id});
  }
}
// Sell what he will not use: trophies and goods, and pieces his worn kit outclasses.
export function sellSpare(state){
  const s=state.soldier;
  for(const entry of [...s.pack]){
    const item=ITEMS[entry.id];if(!item||item.keep||item.kind==='quest'||item.kind==='key')continue;
    const spare=!item.slot||item.slot&&(()=>{const place=placeFor(entry.id,s.worn),worn=s.worn[place];return worn&&itemScore(worn)>=itemScore(entry.id);})();
    if(spare)act(state,{kind:'sell',uid:entry.uid});
  }
}
// Buy the upgrades he can afford, the largest gain for its price first, from the armourer and the quartermaster.
export function buyUpgrades(state){
  const s=state.soldier;let guard=0;
  while(guard++<20){
    const elo=soldierAttributes(s).elo,offers=[...smithStock(state.chapter).map(id=>({id,from:'smith'})),...quartermasterStock(state.chapter).map(id=>({id,from:'quartermaster'}))]
      .filter(o=>ITEMS[o.id]?.slot&&!['bow','sling'].includes(ITEMS[o.id].weapon)&&!wearProblem(state,o.id))
      .map(o=>{const place=placeFor(o.id,s.worn),worn=s.worn[place],gain=itemScore(o.id)-(worn?itemScore(worn):0),price=priceOf(o.id,elo);return {...o,gain,price};})
      .filter(o=>o.gain>1e-9&&o.price<=s.denarii).sort((a,b)=>b.gain/Math.max(1,b.price)-a.gain/Math.max(1,a.price)||(a.id<b.id?-1:1));
    if(!offers.length)break;
    const o=offers[0];if(!act(state,{kind:'buy',itemId:o.id,from:o.from}).ok)break;wearBest(state);
  }
}
// Before each march: the policy's camp work.
export function campPolicy(state,policy){
  if(policy==='bare'||!state.soldier)return;
  act(state,{kind:'pay'});
  if(policy==='engaged'){searchCamp(state);sellSpare(state);}
  wearBest(state);
  if(policy==='engaged')buyUpgrades(state);
  // The issued player keeps half of all he has earned unspent; the engaged one spends everything.
  spendTP(state,policy==='engaged'?0:Math.ceil(state.soldier.tpEarned/2));
}
// After a won battle: the engaged player searches the fallen and the found containers before recording it.
export function searchWonField(state,policy){
  if(policy!=='engaged'||!G.isRealtime(state)||state.encounter?.status!=='won')return;
  const world=state.encounter.realtime.world;
  for(const o of world.objects.filter(x=>x.kind==='container'&&!x.hidden)){
    if(o.lock&&!o.unlocked&&!G.openFieldContainer(state,{objectId:o.id,method:'key'}).ok)G.openFieldContainer(state,{objectId:o.id,method:'force'});
    const now=state.encounter.realtime.world.objects.find(x=>x.id===o.id);if(now&&(!now.lock||now.unlocked)&&now.contents.length)G.takeFromContainer(state,{objectId:o.id,items:[...now.contents]});
  }
  for(const body of world.actors.filter(a=>!a.alive&&a.side==='enemy'&&a.loot?.length))G.takeSpoils(state,{bodyId:body.id,items:[...body.loot]});
}
