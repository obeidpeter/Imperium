import {alive,clamp,distance,lineOfSight,result} from './shared.js';

export const VETERAN_PATHS=[
  {id:'protector',label:'Protector',description:'Guard an adjacent friend: that friend takes 2 less damage through the enemy turn. The protector braces and gives up movement and attack.',tradeoff:'+2 maximum health; −1 melee damage. Guard costs one command and the veteran’s turn.'},
  {id:'leader',label:'Formation leader',description:'Inspire friends within two tiles: restore 15 morale and brace them. One trained leader adds one command per round; multiple leaders do not stack.',tradeoff:'−2 maximum health; −1 melee damage. Inspire costs one command and the veteran’s turn.'},
  {id:'ranged',label:'Ranged specialist',description:'Two aimed volleys per battle: attack a visible enemy within four tiles with an unobstructed line. Ordinary autonomous bow attacks remain available.',tradeoff:'Archer role; −2 maximum health and −1 melee damage. Volley costs one command, one of two volleys, and the veteran’s turn.'},
];
export function veteranTraining(state){
  const enabled=state.progressionVersion===1&&state.phase==='camp';
  return {enabled,requiredService:2,requiredChapter:3,paths:VETERAN_PATHS.map(x=>({...x})),veterans:(state.company??[]).map(v=>({...v,path:state.progression?.specializations[v.id]??null,eligible:enabled&&state.chapter>=3&&v.service>=2&&!state.progression.specializations[v.id],reason:state.progression?.specializations[v.id]?'This permanent specialization is already recorded.':state.chapter<3?'Specialist instruction opens in Chapter III.':v.service<2?`Complete ${2-v.service} more deployed field action${2-v.service===1?'':'s'}.`:enabled?'Choose one permanent specialization.':'Choose in camp.'}))};
}
export function specializeVeteran(state,id,path){const plan=veteranTraining(state),v=plan.veterans.find(x=>x.id===id);if(!v?.eligible||!VETERAN_PATHS.some(x=>x.id===path))return result(false,'Choose one eligible veteran and one permanent specialization after two deployments, from Chapter III.');state.progression.specializations[id]=path;return result(true,`${v.name} becomes a ${VETERAN_PATHS.find(x=>x.id===path).label.toLowerCase()}. This choice cannot be exchanged for another path.`);}
export function applyVeteranSpecializations(state,e){
  if(state.progressionVersion!==1)return;e.progressionVersion=1;if(e.type==='training')return;
  for(const u of e.units.filter(u=>u.side==='ally'&&u.veteranId)){
    const path=state.progression.specializations[u.veteranId];if(!path)continue;
    u.specialization=path;const delta=path==='protector'?2:-2;u.maxHp=Math.max(1,u.maxHp+delta);u.hp=Math.max(1,Math.min(u.maxHp,u.hp+delta));u.damage=Math.max(1,u.damage-1);
    if(path==='ranged'){u.role='archer';u.specialistAmmo=2;}
  }
  if(e.units.some(u=>u.side==='ally'&&u.specialization==='leader')){e.commandCapacity=Math.min(8,e.commandCapacity+1);e.commandsLeft=e.commandCapacity;}
}
export function veteranActions(e,u){
  if(e.progressionVersion!==1||!u||u.side!=='ally'||!alive(u)||u.ordered||u.acted||e.commandsLeft<1)return [];
  return u.specialization==='protector'?['guard']:u.specialization==='leader'?['inspire']:u.specialization==='ranged'&&u.specialistAmmo>0?['volley']:[];
}
export function veteranTargets(e,u,action){
  if(!veteranActions(e,u).includes(action))return [];
  const candidates=action==='guard'?e.units.filter(x=>x.id!==u.id&&alive(x)&&x.side!=='enemy'&&distance(u,x)<=1):action==='volley'?e.units.filter(x=>alive(x)&&x.side==='enemy'&&!x.hidden&&distance(u,x)<=4&&lineOfSight(e,u,x)):[u];
  return candidates.map(x=>({x:x.x,y:x.y,unitId:x.id,label:x.name}));
}
export function veteranPreview(e,u,action,target,damage){
  if(action==='guard')return result(true,`Guard ${target.name}: incoming damage −2 while ${u.name} remains adjacent and active, until your next turn. Protector braces. Spend one command and this veteran’s movement/action.`);
  if(action==='inspire')return result(true,`Inspire ${e.units.filter(x=>alive(x)&&x.side!=='enemy'&&distance(u,x)<=2).length} nearby friends: +15 morale and Brace until your next turn. Spend one command and this veteran’s movement/action.`);
  return result(true,`Aimed volley at ${target.name}: ${damage} damage, range four with clear line of sight. ${u.specialistAmmo-1} volleys remain. Spend one command and this veteran’s movement/action.`);
}
export function applyVeteranAction(e,u,action,target,hit){
  e.commandsLeft--;u.ordered=true;u.moved=true;u.acted=true;
  if(action==='guard'){u.guardTargetId=target.id;u.braced=true;}
  else if(action==='inspire')for(const x of e.units.filter(x=>alive(x)&&x.side!=='enemy'&&distance(u,x)<=2)){x.morale=clamp(x.morale+15);x.braced=true;}
  else {u.specialistAmmo--;hit();}
}
export function guardProtection(e,target){return e.progressionVersion===1&&e.units.some(u=>u.side==='ally'&&alive(u)&&u.specialization==='protector'&&u.guardTargetId===target.id&&distance(u,target)<=1)?2:0;}
