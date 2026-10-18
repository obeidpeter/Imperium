import {alive,clamp,distance,lineOfSight,result} from './shared.js';

export const VETERAN_PATHS=[
  {id:'protector',label:'Protector',description:'Guard an adjacent friend: that friend takes 2 less damage through the enemy turn. The protector braces and gives up movement and attack.',tradeoff:'+2 maximum health; −1 melee damage. Guard costs one command and the veteran’s turn.',mastery:'Evocatus mastery (6+ commendations): Guard also restores +5 morale to the guarded comrade.'},
  {id:'leader',label:'Formation leader',description:'Inspire friends within two tiles: restore 15 morale and brace them. One trained leader adds one command per round; multiple leaders do not stack.',tradeoff:'−2 maximum health; −1 melee damage. Inspire costs one command and the veteran’s turn.',mastery:'Evocatus mastery (6+ commendations): Inspire also restores +1 health to inspired formations.'},
  {id:'ranged',label:'Ranged specialist',description:'Two aimed volleys per battle: attack a visible enemy within four tiles with an unobstructed line. Ordinary autonomous bow attacks remain available.',tradeoff:'Archer role; −2 maximum health and −1 melee damage. Volley costs one command, one of two volleys, and the veteran’s turn.',mastery:'Evocatus mastery (6+ commendations): Aimed Volley also shakes the target (−5 morale).'},
];
export const VETERAN_RANKS=[
  {tier:0,id:'miles',title:'Miles gregarius',badge:'Legionary issue',minCommendations:0,summary:'Standard cohort service.'},
  {tier:1,id:'immunis',title:'Immunis',badge:'Bronze torque',minCommendations:1,summary:'Seasoned campaigner (+1 starting morale per commendation, up to +6).'},
  {tier:2,id:'optio',title:'Optio cohortis',badge:'Silver phalerae',minCommendations:3,summary:'Veteran under-officer (+1 maximum health; silver phalerae harness).'},
  {tier:3,id:'evocatus',title:'Evocatus Augusti',badge:'Evocatus crest & gold phalerae',minCommendations:6,summary:'Decorated Evocatus (+1 maximum health, −1 morale loss, and specialist mastery).'},
];
export function veteranRank(veteran,path=veteran?.specialization??veteran?.path??null){
  const c=typeof veteran==='number'?veteran:(veteran?.commendations??(veteran?.moraleResistance?6:0));
  const rank=[...VETERAN_RANKS].reverse().find(r=>c>=r.minCommendations)??VETERAN_RANKS[0];
  const spec=VETERAN_PATHS.find(p=>p.id===path);
  return {...rank,commendations:c,masteryUnlocked:c>=6&&Boolean(spec),mastery:spec?.mastery??null};
}
const CALLOUT_LINES={
  lucan:{guard:'Shields locked on my mark—nothing crosses this flank.',inspire:'Remember the Danube camp! Hold the line!',volley:'Loose on the standard!',strike:'Press them with the boss!',brace:'Ground your butts—stand fast!'},
  sabinus:{guard:'I have your flank covered, Commander.',inspire:'Steady the files! No one yields a pace!',volley:'Sight the gap and draw!',strike:'Drive the point home!',brace:'Lock the wall!'},
  naso:{guard:'Close the interval—I’ll take the weight.',inspire:'Count the cadence! Dress the front!',volley:'Mark the range and loose!',strike:'Step in and strike!',brace:'Shields to the knee!'},
  felix:{guard:'Stay behind my scutum!',inspire:'Eyes on the eagle—forward!',volley:'Clear sky and a clean draw—watch them scatter!',strike:'Blade in the seam!',brace:'Hold your ground!'},
  firmus:{guard:'Planted like stone. Let them come.',inspire:'Stand like veterans of the frontier!',volley:'Shafts on the wind!',strike:'Break their guard!',brace:'No step backward!'},
  rufus:{guard:'My shield is yours through the rush.',inspire:'For the company roll—brace and endure!',volley:'Volley by the numbers!',strike:'Cut through the press!',brace:'Feet set, shields high!'},
};
export function companionCallout(e,command){
  if(!e||e.kind!=='battle'||!command)return null;
  const u=e.units?.find(x=>x.id===command.unitId);if(!u)return null;
  const vUnit=u.veteranId?u:e.units.find(x=>x.side==='ally'&&x.veteranId&&alive(x)&&distance(x,u)<=1);
  if(!vUnit?.veteranId)return null;
  const lines=CALLOUT_LINES[vUnit.veteranId]??CALLOUT_LINES.lucan;
  const text=lines[command.action]??lines.brace;
  const rank=veteranRank({commendations:vUnit.moraleResistance?6:vUnit.specialization?3:1},vUnit.specialization);
  return {veteranId:vUnit.veteranId,speaker:vUnit.name,rankTitle:rank.title,action:command.action,text};
}
export function veteranTraining(state){
  const enabled=state.progressionVersion===1&&state.phase==='camp';
  return {enabled,requiredService:2,requiredChapter:3,paths:VETERAN_PATHS.map(x=>({...x})),veterans:(state.company??[]).map(v=>{const path=state.progression?.specializations[v.id]??null,rank=veteranRank(v,path);return {...v,path,rank,eligible:enabled&&state.chapter>=3&&v.service>=2&&!state.progression.specializations[v.id],reason:state.progression?.specializations[v.id]?'This permanent specialization is already recorded.':state.chapter<3?'Specialist instruction opens in Chapter III.':v.service<2?`Complete ${2-v.service} more deployed field action${2-v.service===1?'':'s'}.`:enabled?'Choose one permanent specialization.':'Choose in camp.'};})};
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
  const evo=u.moraleResistance>=1;
  if(action==='guard')return result(true,`Guard ${target.name}: incoming damage −2 while ${u.name} remains adjacent and active, until your next turn. Protector braces.${evo?' Evocatus mastery: +5 target morale.':''} Spend one command and this veteran’s movement/action.`);
  if(action==='inspire')return result(true,`Inspire ${e.units.filter(x=>alive(x)&&x.side!=='enemy'&&distance(u,x)<=2).length} nearby friends: +15 morale and Brace until your next turn.${evo?' Evocatus mastery: +1 health to inspired troops.':''} Spend one command and this veteran’s movement/action.`);
  return result(true,`Aimed volley at ${target.name}: ${damage} damage, range four with clear line of sight.${evo?' Evocatus mastery: −5 target morale.':''} ${u.specialistAmmo-1} volleys remain. Spend one command and this veteran’s movement/action.`);
}
export function applyVeteranAction(e,u,action,target,hit){
  e.commandsLeft--;u.ordered=true;u.moved=true;u.acted=true;
  const evo=u.moraleResistance>=1;
  if(action==='guard'){u.guardTargetId=target.id;u.braced=true;if(evo)target.morale=clamp((target.morale??70)+5);}
  else if(action==='inspire')for(const x of e.units.filter(x=>alive(x)&&x.side!=='enemy'&&distance(u,x)<=2)){x.morale=clamp(x.morale+15);x.braced=true;if(evo)x.hp=Math.min(x.maxHp,x.hp+1);}
  else {u.specialistAmmo--;hit();if(evo&&alive(target))target.morale=clamp((target.morale??70)-5);}
}
export function guardProtection(e,target){return e.progressionVersion===1&&e.units.some(u=>u.side==='ally'&&alive(u)&&u.specialization==='protector'&&u.guardTargetId===target.id&&distance(u,target)<=1)?2:0;}
