import * as Game from '../core/game.js';

// A separate, repeatable skirmish. Reach the field by replaying the real drill;
// no rank, battle outcome, saved campaign or random state is injected.
export const ARRIVAL = Object.freeze([
  ['choose','report'],['startEncounter',{}],
  ['act',{unitId:'hero',action:'move',x:1,y:3}],
  ['act',{unitId:'hero',action:'throw',x:2,y:3,targetId:'dummy'}],
  ['endTurn'],['act',{unitId:'hero',action:'strike',x:2,y:3,targetId:'dummy'}],
  ['endTurn'],['act',{unitId:'hero',action:'brace',x:1,y:3,targetId:'hero'}],
  ['commitEncounter'],['swearOath'],['startEncounter',{}]
]);
export function createShowcaseSession(){
  const state=Game.newGame('Aurelius Marcellus',275);
  for(const [method,arg] of ARRIVAL){const outcome=Game[method](state,...(arg===undefined?[]:[arg]));if(!outcome.ok)throw new Error(`Frontier introduction: ${method}: ${outcome.message}`);}
  if(state.encounter?.id!=='ch1-road'||state.encounter.status!=='active')throw new Error('The frontier battle did not initialize.');
  return state;
}
export const isAlive=u=>!u.hidden&&(u.resolve??u.hp)>0;
export const facingYaw=facing=>({south:0,east:Math.PI/2,north:Math.PI,west:-Math.PI/2}[facing]??0);
export function commandFor(selected,action,target){return target&&action?{unitId:selected,action,x:target.x,y:target.y,...(target.unitId?{targetId:target.unitId}:{})}:null;}
export const tileName=p=>`${p.x+1}${String.fromCharCode(65+p.y)}`;
