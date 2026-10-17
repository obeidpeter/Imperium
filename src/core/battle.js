import * as Legacy from './legacy-battle.js';
export const createLegacyBattle=Legacy.createBattle;
import {alive, blocked, clamp, distance, faceToward, lineOfSight, makeUnit, note, reachable, result, rng, stepToward, unitAt} from './shared.js';
import {BATTLE_SCENARIOS} from '../data/encounters.js';
import {BATTLE_BALANCE as B,FORMATION_RULES,ROUGH_TERRAIN} from '../data/battle-balance.js';
export {FORMATION_RULES};
import {deploymentVeteran,applyCompanyKit,difficultyRule} from './campaign-options.js';
import {initializeOperation,operationEscortsMove,operationQualified,advanceOperation,operationGather} from './operations.js';
import {applyVeteranSpecializations,veteranActions,veteranTargets,veteranPreview,applyVeteranAction,guardProtection} from './progression-veterans.js';
import {applyOperationConsequences} from './progression-operations.js';

export const commandCapacity = chapter => chapter<4?0:chapter===4?1:chapter===5?3:chapter===6?4:chapter<9?5:6;
const point=([x,y])=>({x,y});
const terrainKey={X:'rock','~':'river',f:'ford','#':'wall','^':'high','=':'road',s:'stone',m:'marsh'};
function companyUnit(state,index,unit){const v=state.campaignRules===2?deploymentVeteran(state,index):state.company?.[index];if(!v)return unit;unit.veteranId=v.id;unit.name=v.name;unit.maxHp+=v.commendations>=3?1:0;unit.hp=Math.max(8,unit.maxHp-Math.min(2,v.recovery??0));unit.moraleResistance=v.commendations>=6?1:0;return unit;}
function addEscort(e,id,name,x,y,{escorted=true,hp=20}={}){e.units.push(makeUnit(id,name,'neutral',x,y,{hp,role:'escort',move:2,escorted,intent:escorted?'Follow the commander to extraction.':'Needs adjacent Assist before evacuation.'}));e.mission.escortIds.push(id);}
function enemyUnit(state,id,x,y,role='infantry',extra={}){const c=state.chapter,faction=c===5||c===6?'Persian':c===9?'Palmyrene':c>=11?'Rival Roman':'Gothic';return makeUnit(id,`${faction} ${role}`,'enemy',x,y,{hp:(c<4?8:10)+Math.floor(rng(state)*2),damage:c<4?3:4,role,move:role==='cavalry'?3:2,facing:'west',anchor:{x,y},intent:role==='archer'?'Keep range and fire along an open line.':role==='guard'?'Guard this approach; counterattack intruders.':role==='raider'?'Seek the convoy or an unguarded objective.':role==='cavalry'?'Flank exposed troops; avoid a braced front.':'Press the nearest opponent.',...extra});}
export function createBattle(state,data,options={}){
 const c=state.chapter,t=BATTLE_SCENARIOS[data.id]??BATTLE_SCENARIOS['ch1-road'],ground=data.terrain==='marsh'?'marsh':data.terrain==='sand'?'sand':data.terrain==='stone'?'stone':'grass',terrain=t.map.map(row=>[...row].map(k=>terrainKey[k]??ground));
 const e={id:data.id,kind:'battle',title:data.title,objective:data.objective,type:data.type,width:8,height:8,terrain,units:[],turn:1,turnLimit:data.turnLimit??14,status:'active',commandCapacity:commandCapacity(c),commandsLeft:commandCapacity(c),log:[],usedAbilities:[],goal:point(t.goal),requiredAbility:data.requiredAbility,staged:{meters:{army:0,political:0,public:0},supplies:0,obligations:[]},defence:100,route:options.route??state.route??'battle',minimumTurns:0,reinforcements:0,scenario:data.id,mission:{mode:t.mode,holdRequired:t.hold??0,holdProgress:0,points:(t.points??[]).map(p=>({...point(p),secured:false})),waves:(t.waves??[]).map(w=>({...w,arrived:false})),escortIds:[],rallyProgress:0,envoyProgress:0}};
 const hero=makeUnit('hero',state.name,'player',0,3,{hp:c<4?22:26,role:c<7?'soldier':'commander',move:c<7?2:3,ammo:3,damage:c<4?4:3});e.units.push(hero);
 if(data.type==='training')e.units.push(makeUnit('dummy','Training partner','enemy',2,3,{hp:10,damage:1,role:'trainer',facing:'west'}));
 else{const count=c<4?1:c===4?3:c<7?4:5,positions=[[0,1],[1,1],[0,5],[1,5],[1,6]];
  for(let i=0;i<count;i++){const[x,y]=positions[i];e.units.push(companyUnit(state,state.campaignRules!==2&&e.id==='ch2-marsh'&&state.decisions.ch2!=='leave'?1:i,makeUnit(`ally${i}`,i===0?(state.decisions.ch2==='leave'?'Sabinus':'Lucan'):`Formation ${i+1}`,'ally',x,y,{hp:c<4?13:16,damage:3,role:i===count-1&&c>=7?'archer':'infantry',intent:'Advance on the objective; strike threats in reach.'})));}
  for(const[i,[x,y,role]]of(t.enemies??[]).entries())e.units.push(enemyUnit(state,`enemy${i}`,x,y,role,{hidden:c===3&&i===1}));}
 if(t.mode==='extract'){
  if(data.id==='ch2-marsh'){const carry=state.decisions.ch2!=='leave';addEscort(e,'escort',carry?'Wounded Lucan':'Retreating survivor',carry?4:1,carry?2:4,{escorted:!carry,hp:carry?18:20});if(carry)e.units.find(u=>u.id==='escort').veteranId='lucan';e.mission.variant=carry?'Carry Lucan from the flooded road':'Cover the surviving column';if(!carry)e.mission.holdRequired=2;}
  else if(data.id==='ch6-wells'){const save=state.decisions.ch6==='save';addEscort(e,'escort',save?'Varro and his wounded guard':'The eagle-bearer',save?4:2,save?5:3,{escorted:!save,hp:22});if(save)e.terrain[5][4]='wall';e.mission.variant=save?'Reach Varro, Assist, then withdraw':'Extract the eagle by the short road';if(save)e.turnLimit+=2;}
  else if(data.id==='ch8-ferry'){addEscort(e,'escort','Settler families',1,4,{hp:24});if(state.decisions.ch8==='families'){addEscort(e,'escort2','Children and household carts',0,6,{hp:24});e.turnLimit+=3;e.mission.variant='Two civilian columns need the commander within four tiles';}else{e.mission.variant='Soldiers screen one compact column';e.units.filter(u=>u.side==='ally').forEach(u=>u.hp=u.maxHp+=2);}}
  else addEscort(e,'escort',c===3?'Records party':c===4?'Withdrawal squad':'Eagle-bearer',2,4,{hp:22});}
 if(data.id==='ch10-road'){e.defence+=Math.max(0,(state.allocation?.farms??1)-1)*5;const morale=Math.max(0,(state.allocation?.river??1)-1)*5;e.units.filter(u=>u.side==='ally').forEach(u=>u.morale=clamp(u.morale+morale));e.mission.variant=`Grain stores: ${e.defence} integrity; river allotment grants +${morale} morale.`;}
 if(state.preparation==='rest')hero.hp=hero.maxHp+=4;
 if(state.preparation==='fortify'){terrain[3][1]='wall';hero.braced=true;e.defence+=20;}
 if(state.preparation==='drill')e.units.filter(u=>u.side==='ally').forEach(u=>u.damage++);
 if(state.preparation==='march')e.units.filter(u=>u.side==='ally').forEach(u=>{if(!unitAt(e,u.x+1,u.y)&&!blocked(terrain[u.y][u.x+1]))u.x++;});
 if(state.stratagem==='night')e.units.filter(u=>u.side==='enemy').forEach(u=>u.damage=Math.max(1,u.damage-1));
 if(state.stratagem==='feint')e.units.filter(u=>u.side==='enemy'&&u.role==='cavalry').forEach(u=>{u.hp=Math.max(1,u.hp-4);u.morale-=20;u.move=2;});
 if(state.stratagem==='flank')e.units.filter(u=>u.side==='ally').forEach(u=>u.damage++);
 if(c>=6){e.condition=state.supplies>=4?'supplied':state.supplies>0?'strained':'exhausted';e.staged.supplies=-1;if(!state.supplies)e.units.filter(u=>u.side==='ally').forEach(u=>{u.hp=Math.max(8,u.hp-2);u.morale=Math.min(u.morale,60);});note(e,`Troop condition: ${e.condition}. One supply convoy is spent on commit.`);}
 if(c===12&&data.type==='confrontation')configureFinale(state,e,options.forecast,options.combatVersion!==1);
 for(const unit of e.units)if(blocked(e.terrain[unit.y][unit.x])||e.units.some(other=>other!==unit&&other.x===unit.x&&other.y===unit.y&&e.units.indexOf(other)<e.units.indexOf(unit))){const safe=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!blocked(e.terrain[y][x])&&!unitAt(e,x,y))safe.push({x,y});safe.sort((a,b)=>distance(a,unit)-distance(b,unit));if(safe[0])Object.assign(unit,safe[0]);}
 applyCompanyKit(state,e);applyVeteranSpecializations(state,e);initializeOperation(state,e);if(e.campaignRules===2&&e.type!=='training'){const difficulty=difficultyRule(e);e.turnLimit=Math.min(30,Math.max(8,e.turnLimit+difficulty.turns));for(const wave of e.mission.waves)wave.turn=Math.max(2,wave.turn+difficulty.wave);note(e,`${state.difficulty} field rules: deadline ${e.turnLimit}; objective pressure ${difficulty.pressure} per unopposed round.`);}applyOperationConsequences(state,e);
 if(options.combatVersion!==1){e.combatVersion=2;for(const u of e.units)u.lastMoveDistance=0;refreshBattleIntents(e);}
 updateBattleProgress(e);e.objective+=` ${e.mission.variant??''} ${missionDescription(e)} Finish by turn ${e.turnLimit}.`;note(e,e.objective);return e;
}
function configureFinale(state,e,forecast,modern){
 const enemyCount=forecast?.enemies??6,allyCount=forecast?.allies??3;e.units=e.units.filter(u=>u.id==='hero');e.turnLimit=16;e.defections=0;e.mission.waves=[];
 const positions=[[0,1],[1,1],[0,5],[1,5],[1,6],[2,0],[2,7]];
 for(let i=0;i<allyCount;i++){const[x,y]=positions[i];e.units.push(companyUnit(state,state.campaignRules!==2&&e.id==='ch2-marsh'&&state.decisions.ch2!=='leave'?1:i,makeUnit(`ally${i}`,i===0?(state.decisions.ch2==='leave'?'Sabinus’s relief legion':'Lucan’s relief legion'):`Relief cohort ${i+1}`,'ally',x,y,{hp:20,damage:4,move:2,role:i===allyCount-1?'archer':'infantry'})));}
 for(let i=0;i<enemyCount;i++)e.units.push(enemyUnit(state,`enemy${i}`,6+i%2,1+i,i===2?'archer':'infantry',{name:i===0?'Rival claimant':`Civil-war cohort ${i+1}`,hp:Math.max(8,12-Math.floor(state.meters.public/30)),damage:Math.max(2,4-Math.floor(state.meters.political/50)),morale:Math.max(20,80-Math.floor(state.meters.political/2))}));
 if(e.route==='backer'){e.units.filter(u=>u.side==='ally').forEach(u=>{u.hp=u.maxHp=24;u.damage=5;});e.units.filter(u=>u.side==='enemy').forEach(u=>u.damage=2);e.staged.obligations.push({id:'finale-backer',to:'The quartermaster council',promise:'Reserve two years of imperial revenue for the army’s creditors.',due:12,cost:6,consequence:'Army creditors limit the first years of reform.',status:'open'});}
 if(e.route==='defection'){e.type='standoff';e.mission.mode='defection';e.goal={x:4,y:3};e.mission.variant='Rally within three tiles of rival infantry to break allegiance. Three pledges win; the commander must survive.';}
 if(e.route==='settlement'){e.type='standoff';e.mission.mode='settlement';e.goal={x:6,y:3};addEscort(e,'envoy','Senate’s negotiating envoy',1,4,{hp:26});e.mission.variant='Escort the envoy to the claimant; hold the meeting for two turns. Rally reassures the parley but does not make enemies defect.';if(modern){e.units.filter(u=>u.side==='enemy'&&u.role==='infantry').forEach(u=>u.role='guard');e.mission.variant+=' Rival infantry guard the meeting perimeter.';}}
 if(e.route==='surrender'){e.type='standoff';e.mission.mode='surrender';e.goal={x:6,y:3};e.mission.points=[{x:4,y:1,secured:false},{x:4,y:6,secured:false}];e.mission.variant='Secure both gate approaches, then bring the commander to the claimant’s standard.';}
}
function missionDescription(e){if(operationGather(e))return '';const m=e.mission;return m.mode==='hold'?`Control the marker without adjacent enemies for ${m.holdRequired} turns.`:m.mode==='supply'?'Secure both grain routes while keeping stores intact.':m.mode==='capture'?`Stand beside ${m.points.length} marked positions and clear enemies from those approaches.`:m.mode==='extract'?'Escort every column to the marker, keeping the commander within four tiles; do not lose a column.':m.mode==='recover'?'Scout and reach the chest at the marker.':m.mode==='clear'?'Defeat the field force and its arriving reinforcements.':'';}
export function updateBattleProgress(e){const m=e.mission;if(!m)return;e.objectiveProgress=m.mode==='training'?`Drill actions demonstrated ${['move','strike','brace','throw'].filter(a=>e.usedAbilities.includes(a)).length}/4`:m.mode==='hold'?`Ground held ${m.holdProgress}/${m.holdRequired} · line ${e.defence}`:['capture','supply','surrender'].includes(m.mode)?`Positions secured ${m.points.filter(p=>p.secured).length}/${m.points.length} · line ${e.defence}`:m.mode==='defection'?`Pledges secured ${e.defections??0}/3`:m.mode==='settlement'?`Envoy meeting ${m.envoyProgress}/2`:m.escortIds.length?`Columns at extraction ${m.escortIds.filter(id=>{const u=e.units.find(v=>v.id===id);return u&&distance(u,e.goal)<=1;}).length}/${m.escortIds.length}`:`Enemy units remaining ${e.units.filter(u=>u.side==='enemy'&&alive(u)).length}`;const gathering=operationGather(e);if(gathering)e.objectiveProgress=gathering.progress;const wave=m.waves.find(w=>!w.arrived);e.pressure=wave?`Reinforcements due turn ${wave.turn} at ${wave.x+1}${String.fromCharCode(65+wave.y)}`:`Deadline turn ${e.turnLimit}`;}
function opposing(unit) {return unit.side==='enemy'?['player','ally']:['enemy'];}
function facingDefence(target,attacker) {
  const front=target.facing==='east'?attacker.x>=target.x:target.facing==='west'?attacker.x<=target.x:target.facing==='south'?attacker.y>=target.y:attacker.y<=target.y;
  return front?1:0;
}
export function damagePreview(e,unit,target,ranged=false) {if(!e.mission)return Legacy.damagePreview(e,unit,target,ranged);
  if(e.combatVersion===2)return combatBreakdown(e,unit,target,ranged).damage;
  const terrain=e.terrain[target.y][target.x];const cover=terrain==='wall'?2:terrain==='high'?1:0;
  const flank=facingDefence(target,unit),brace=target.braced?2:0,screen=target.role==='escort'&&e.units.some(u=>['ally','player'].includes(u.side)&&alive(u)&&distance(u,target)<=1)?1:0;
  return Math.max(1,(ranged?3:unit.damage??3)-cover-flank-brace-screen+(unit.formation==='wedge'?1:0)+(target.formation==='wedge'?1:0));
}
export function combatBreakdown(e,unit,target,ranged=false){
 if(e.combatVersion!==2)return {damage:damagePreview(e,unit,target,ranged),base:ranged?3:unit.damage??3,modifiers:[],aspect:facingDefence(target,unit)?'front':'flank'};
 const terrain=e.terrain[target.y][target.x],source=e.terrain[unit.y][unit.x],dx=unit.x-target.x,dy=unit.y-target.y;
 const forward=target.facing==='east'?dx:target.facing==='west'?-dx:target.facing==='south'?dy:-dy,side=['east','west'].includes(target.facing)?Math.abs(dy):Math.abs(dx),front=forward>0&&forward>=side;
 const modifiers=[],add=(label,value)=>{if(value)modifiers.push({label,value});},base=ranged?3:unit.damage??3;
 add('Frontal shield',front?-1:0);add('Brace',target.braced?-2:0);add('Terrain protection',terrain==='wall'?-2:terrain==='high'?-1:ranged&&terrain==='cover'?-B.coverRanged:0);
 add('Height advantage',ranged&&source==='high'&&terrain!=='high'?B.heightRanged:0);
 const sameSide=u=>u.side===target.side||['player','ally'].includes(u.side)&&['player','ally'].includes(target.side),cohesive=e.units.some(u=>u.id!==target.id&&alive(u)&&sameSide(u)&&u.formation===target.formation&&distance(u,target)===1);
 add('Cohesive shield wall',target.formation==='shield-wall'&&front&&cohesive?-1:0);add('Line ranged screen',target.formation==='line'&&ranged&&cohesive?-1:0);
 add('Escort screen',target.role==='escort'&&e.units.some(u=>['ally','player'].includes(u.side)&&alive(u)&&distance(u,target)<=1)?-1:0);
 add('Veteran protector',-guardProtection(e,target));
 add('Wedge on firm ground',!ranged&&unit.formation==='wedge'&&!ROUGH_TERRAIN.includes(source)?1:0);add('Wedge exposure',target.formation==='wedge'?1:0);
 add('Mounted charge',!ranged&&['cavalry','heavy'].includes(unit.role)&&(unit.lastMoveDistance??0)>=B.chargeDistance&&!ROUGH_TERRAIN.includes(source)&&!ROUGH_TERRAIN.includes(terrain)&&!target.braced?B.chargeBonus:0);
 add('Shaken morale',(unit.morale??80)<=B.shakenThreshold?-1:0);
 return {damage:Math.max(1,base+modifiers.reduce((n,m)=>n+m.value,0)),base,modifiers,aspect:front?'front':'flank'};
}
export function battleActions(state,unit) {if(!state.encounter.mission)return Legacy.battleActions(state,unit);
  const e=state.encounter,c=state.chapter;if(!unit||!alive(unit)||e.status!=='active'||!['player','ally'].includes(unit.side)) return [];
  if(unit.side==='ally') {if(c<4)return veteranActions(e,unit);return !unit.ordered&&e.commandsLeft>0?['order',...(c>=5?['formation']:[]),...veteranActions(e,unit)]:[];}
  const actions=[];if(!unit.moved)actions.push('move');if(!unit.acted) {actions.push('strike','brace');if(unit.ammo>0)actions.push('throw');if(c>=2)actions.push('assist');if(c>=3)actions.push('scout');if(c>=6)actions.push('rally');}
  if(c>=4&&e.commandsLeft>0)actions.push('order');if(c>=5&&e.commandsLeft>0)actions.push('formation');
  if(c===7&&e.turn===1&&!unit.moved&&!e.usedAbilities.includes('deploy'))actions.push('deploy');return actions;
}
export function battleTargets(state,unit,action) {if(!state.encounter.mission)return Legacy.battleTargets(state,unit,action);
  const e=state.encounter;
  if(['guard','inspire','volley'].includes(action))return veteranTargets(e,unit,action);
  if(action==='move')return reachable(e,unit);
  if(action==='deploy')return reachable(e,unit,5).filter(p=>p.x<=3);
  if(action==='strike'||action==='throw')return e.units.filter(u=>alive(u)&&!u.hidden&&opposing(unit).includes(u.side)&&distance(u,unit)<=(action==='strike'?1:3)&&(action==='strike'||lineOfSight(e,unit,u))).map(u=>({x:u.x,y:u.y,unitId:u.id,label:u.name}));
  if(action==='assist')return e.units.filter(u=>alive(u)&&['ally','neutral'].includes(u.side)&&distance(u,unit)<=1).map(u=>({x:u.x,y:u.y,unitId:u.id,label:u.name}));
  if(action==='order'||action==='formation')return e.units.filter(u=>alive(u)&&u.side==='ally'&&!u.ordered).map(u=>({x:u.x,y:u.y,unitId:u.id,label:u.name}));
  return [{x:unit.x,y:unit.y,unitId:unit.id}];
}
export function previewBattle(state,command) {if(!state.encounter.mission)return Legacy.previewBattle(state,command);
  const e=state.encounter,unit=e.units.find(u=>u.id===command.unitId),action=command.action;
  if(!battleActions(state,unit).includes(action))return result(false,'That action is unavailable or has already been spent this turn.');
  const target=battleTargets(state,unit,action).find(p=>p.x===command.x&&p.y===command.y&&(!command.targetId||p.unitId===command.targetId));if(!target)return result(false,'Choose a highlighted legal target.');
  const other=e.units.find(u=>u.id===(command.targetId??target.unitId));
  if(['guard','inspire','volley'].includes(action))return veteranPreview(e,unit,action,other,action==='volley'?damagePreview(e,unit,other,true):0);
  if(action==='formation'&&!['line','shield-wall','wedge'].includes(command.formation??'shield-wall'))return result(false,'Choose line, shield-wall, or wedge.');
  if(['order','formation'].includes(action)&&!['advance','attack','hold','rally',...(e.combatVersion===2?['withdraw']:[])].includes(command.orderAction??'advance'))return result(false,e.combatVersion===2?'Choose advance, attack, hold, rally, or withdrawal for the order.':'Choose advance, attack, hold, or rally for the order.');
  if(e.combatVersion===2&&action==='formation'&&command.destination)return result(false,'Choose an individual order to specify a destination.');
  if(command.destination&&(!Number.isInteger(command.destination.x)||!Number.isInteger(command.destination.y)||!reachable(e,other).some(p=>p.x===command.destination.x&&p.y===command.destination.y)))return result(false,'The ordered destination must be within the ally’s normal movement allowance.');
  const orderEffect={advance:command.destination?`advance toward tile ${command.destination.x+1}, ${command.destination.y+1}, then strike an enemy in reach`:'advance toward the objective, then strike an enemy in reach',attack:'advance toward the nearest enemy, then strike if in reach',hold:'stay in position and brace; this ends the ally’s movement and action',rally:'restore 20 of the ally’s own morale; this ends their movement and action',withdraw:'fall back toward the commander and brace; no attack this round'}[command.orderAction??'advance'];
  const messages={move:`Move to ${command.x+1}${String.fromCharCode(65+command.y)}. Costs this unit’s movement.`,deploy:'Deploy the command unit before the first clash. Uses this turn’s movement.',strike:`Strike ${other?.name} for ${other?damagePreview(e,unit,other):0} damage. ${other?`${facingDefence(other,unit)?"Frontal approach: shield defence applies":"Flanking approach: frontal defence bypassed"}; target faces ${other.facing}.`:""} High ground and walls reduce damage.`,throw:`Throw one javelin at ${other?.name} for ${other?damagePreview(e,unit,other,true):0} damage; ${Math.max(0,unit.ammo-1)} remain.`,brace:'Brace the shield: reduce incoming damage by 2 until your next turn. Costs one action.',assist:`Shield ${other?.name}, restore 3 health, and escort wounded survivors toward the standard. Costs one action.`,scout:'Reveal every hidden enemy and a safe path to the standard. Costs one action.',rally:'Restore 25 morale and 2 health to friends within 3 tiles. On the defection route, also lower one nearby opponent morale by 40; at 25 they pledge allegiance. Costs one action.',order:`Spend 1 command to override ${other?.name}’s announced intent: ${orderEffect}. Their normal move and action limits still apply.`,formation:`Spend 1 command: ${command.formation??'shield-wall'} affects an adjacent group of up to 3 allies. Each will ${orderEffect}. Lasts this round. Shield wall: protection 2, march 1; Line: normal marsh cost and morale loss −5; Wedge: attack +1 and incoming damage +1. Each moves and acts at most once.`};
  if(e.combatVersion===2){
   if(action==='order'&&(command.orderAction??'advance')==='attack')messages[action]=`Spend 1 command: ${other.name} will take the strongest legal attack opportunity, considering protection and facing. Normal move/action limits apply.`;
   if(action==='strike'||action==='throw'){const hit=combatBreakdown(e,unit,other,action==='throw');messages[action]=`${action==='throw'?'Throw at':'Strike'} ${other.name}: ${hit.damage} damage (${hit.base} base${hit.modifiers.map(m=>`, ${m.value>0?'+':''}${m.value} ${m.label.toLowerCase()}`).join('')}). ${hit.aspect==='flank'?'Flank':'Front'}; morale −${Math.max(1,B.hitMorale+(hit.aspect==='flank'?B.flankMorale:0)-(other.formation==='line'?5:0)-(other.moraleResistance??0))}.${action==='throw'?` One javelin; ${unit.ammo-1} remain.`:''}`;}
   if(action==='formation')messages[action]=`Spend 1 command on up to 3 adjacent allies. ${FORMATION_RULES[command.formation??'shield-wall'].summary} Each will ${command.orderAction==='attack'?'take a strong legal attack opportunity':orderEffect}. Normal move/action limits apply.`;
   if(action==='move')messages[action]+=` Terrain: ${e.terrain[command.y][command.x]}. Facing changes with movement; a later attack faces its target.`;
  }
  return result(true,(messages[action]??action)+(['order','formation'].includes(action)?` Tactic: ${command.orderAction??'advance'}.`:''));
}
export function applyBattle(state,command) {if(!state.encounter.mission)return Legacy.applyBattle(state,command);
  const checked=previewBattle(state,command);if(!checked.ok)return checked;
  const e=state.encounter,unit=e.units.find(u=>u.id===command.unitId),action=command.action,target=e.units.find(u=>u.id===command.targetId)||unitAt(e,command.x,command.y);
  if(['guard','inspire','volley'].includes(action)){applyVeteranAction(e,unit,action,target,()=>{faceToward(unit,target);const damage=resolveHit(e,unit,target,true);note(e,`${unit.name} hits ${target.name} for ${damage}${target.hp===0?' — withdrawn from the field':''}.`);});}
  else if(action==='move'||action==='deploy'){if(e.combatVersion===2)unit.lastMoveDistance=distance(unit,command);faceToward(unit,command);unit.x=command.x;unit.y=command.y;unit.moved=true;}
  else if(action==='strike'||action==='throw'){if(action==='throw')unit.ammo--;faceToward(unit,target);const damage=e.combatVersion===2?resolveHit(e,unit,target,action==='throw'):damagePreview(e,unit,target,action==='throw');if(e.combatVersion!==2)target.hp=Math.max(0,target.hp-damage);unit.acted=true;note(e,`${unit.name} hits ${target.name} for ${damage}${target.hp===0?' — withdrawn from the field':''}.`);}
  else if(action==='brace'){unit.braced=true;unit.acted=true;}
  else if(action==='assist'){target.hp=Math.min(target.maxHp,target.hp+3);target.braced=true;target.escorted=true;unit.acted=true;}
  else if(action==='scout'){e.units.forEach(u=>u.hidden=false);e.scouted=true;unit.acted=true;}
  else if(action==='rally'){e.units.filter(u=>['ally','player','neutral'].includes(u.side)&&alive(u)&&distance(unit,u)<=3).forEach(u=>{u.morale=clamp(u.morale+25);u.hp=Math.min(u.maxHp,u.hp+2);});if(e.mission?.mode==='defection'){const rival=e.units.filter(u=>u.side==='enemy'&&alive(u)&&distance(unit,u)<=3).sort((a,b)=>a.morale-b.morale)[0];if(rival){rival.morale=clamp(rival.morale-40);note(e,`${rival.name} hears the oath: morale ${rival.morale}.`);if(rival.morale<=25)defect(e,rival);}}if(e.mission)e.mission.rallyProgress++;unit.acted=true;}
  else if(action==='order'){e.commandsLeft--;target.ordered=true;actAlly(e,target,command.orderAction??'advance',command.destination);}
  else if(action==='formation') {e.commandsLeft--;const group=[target,...e.units.filter(u=>u.side==='ally'&&u.id!==target.id&&alive(u)&&distance(u,target)<=1&&!u.ordered)].slice(0,3);group.forEach(u=>{u.formation=command.formation??'shield-wall';if(u.formation==='shield-wall')u.braced=true;u.ordered=true;if(e.combatVersion!==2)actAlly(e,u,command.orderAction??'advance');});if(e.combatVersion===2)group.forEach(u=>actAlly(e,u,command.orderAction??'advance'));note(e,`${group.length} units form ${command.formation??'shield-wall'}; one command spent.`);}
  if(!e.usedAbilities.includes(action))e.usedAbilities.push(action);state.capabilityUse[action]=true;note(e,checked.message);checkBattle(state);refreshBattleIntents(e);return checked;
}
function friendly(e){return e.units.filter(u=>['player','ally'].includes(u.side)&&alive(u));}
function foes(e){return e.units.filter(u=>u.side==='enemy'&&alive(u));}
function missionGoal(e,unit){return (e.mission?.points?.filter(p=>!p.secured)??[]).sort((a,b)=>distance(unit,a)-distance(unit,b))[0]??e.goal;}
function actAlly(e,unit,orderAction=null,destination=null){
 if(e.combatVersion===2){executeBattlePlan(e,unit,planBattleUnit(e,unit,{orderAction,destination}));return;}
 if(!alive(unit))return;const enemies=foes(e).filter(u=>!u.hidden).sort((a,b)=>distance(unit,a)-distance(unit,b)),target=enemies[0];
 if(orderAction==='rally'){unit.morale=clamp(unit.morale+20);unit.acted=true;unit.moved=true;return;}
 if(unit.morale<=15){unit.intent='Morale broken: await Rally.';unit.braced=true;unit.acted=true;return;}
 if(orderAction==='hold'){unit.braced=true;unit.moved=true;unit.acted=true;return;}

 if(!target&&!orderAction&&!['hold','capture','supply','surrender'].includes(e.mission?.mode)){unit.braced=true;unit.acted=true;return;}
 const objective=missionGoal(e,unit),defending=['hold','supply'].includes(e.mission?.mode),goal=destination??(orderAction==='advance'||defending?objective:target??objective);
 if(!unit.moved&&distance(unit,goal)>1)stepToward(e,unit,goal,unit.formation==='shield-wall'?1:unit.move);
 const range=unit.role==='archer'?3:1,inRange=foes(e).filter(u=>!u.hidden&&distance(unit,u)<=range&&(range===1||lineOfSight(e,unit,u))).sort((a,b)=>a.hp-b.hp)[0];
 if(!unit.acted&&inRange){faceToward(unit,inRange);const damage=damagePreview(e,unit,inRange,range>1);inRange.hp=Math.max(0,inRange.hp-damage);unit.acted=true;note(e,`${unit.name} strikes ${inRange.name} for ${damage}.`);}
 if(!unit.acted&&defending){unit.braced=true;unit.acted=true;}unit.intent=defending?'Control marked ground; brace between attacks.':'Advance on the nearest threat; attack if in reach.';
}
function defect(e,unit){if(friendly(e).length<8){unit.side='ally';unit.name='Pledged cohort';unit.morale=65;unit.acted=true;unit.moved=true;}else{unit.hp=0;unit.defected=true;}e.defections=(e.defections??0)+1;note(e,'A cohort accepts the oath and abandons the claimant.');}
function enemyTurn(state,e,enemy){
 if(e.combatVersion===2){enemy.braced=false;enemy.formation=enemy.role==='guard'?'shield-wall':enemy.name.startsWith('Civil-war')&&companions(e,enemy).some(u=>distance(enemy,u)===1)?'line':null;executeBattlePlan(e,enemy,planBattleUnit(e,enemy));return;}
 const candidates=e.units.filter(u=>alive(u)&&(['player','ally'].includes(u.side)||(u.side==='neutral'&&u.role==='escort'&&e.mission?.mode!=='settlement')));if(!candidates.length)return;
 candidates.sort((a,b)=>{const priority=u=>distance(enemy,u)+(enemy.role==='raider'?(u.side==='neutral'?-3:0):enemy.role==='cavalry'?(u.braced?4:0)+u.hp*.04:0);return priority(a)-priority(b);});
 const target=candidates[0],range=enemy.role==='archer'?3:1;
 if(enemy.morale<=15){enemy.braced=true;enemy.morale+=10;note(e,`${enemy.name} regroups after losing nerve.`);return;}
 if(enemy.role==='guard'&&distance(enemy,target)>3){enemy.braced=true;return;}
 if(enemy.role==='archer'&&distance(enemy,target)<2){const positions=reachable(e,enemy).filter(p=>distance(p,target)>=2&&distance(p,target)<=3&&lineOfSight(e,p,target));positions.sort((a,b)=>(e.terrain[b.y][b.x]==='high')-(e.terrain[a.y][a.x]==='high')||a.cost-b.cost);if(positions[0]){faceToward(enemy,positions[0]);Object.assign(enemy,{x:positions[0].x,y:positions[0].y,moved:true});}}
 if(distance(enemy,target)>range||!lineOfSight(e,enemy,target))stepToward(e,enemy,target);
 if(enemy.role==='cavalry'&&distance(enemy,target)<=3&&!enemy.moved){const flank=reachable(e,enemy).filter(p=>distance(p,target)===1).sort((a,b)=>facingDefence(target,a)-facingDefence(target,b));if(flank[0]&&facingDefence(target,flank[0])<facingDefence(target,enemy)){faceToward(enemy,flank[0]);enemy.x=flank[0].x;enemy.y=flank[0].y;}}
 if(distance(enemy,target)<=range&&(range===1||lineOfSight(e,enemy,target))){faceToward(enemy,target);const damage=damagePreview(e,enemy,target,range>1);target.hp=Math.max(0,target.hp-damage);const moraleLoss=Math.max(1,(state.chapter>=6?15:8)-(target.formation==='line'?5:0)-(target.moraleResistance??0));target.morale=clamp(target.morale-moraleLoss);note(e,`${enemy.name} hits ${target.name} for ${damage}.`);}
 if(enemy.role==='cavalry'&&e.terrain[enemy.y][enemy.x]==='sand'){enemy.hp=Math.max(1,enemy.hp-1);enemy.morale=clamp(enemy.morale-6);}
 if(['hold','supply'].includes(e.mission?.mode)&&distance(enemy,e.goal)<=1){e.defence-=10;note(e,'Enemy pressure damages the guarded stores or line (−10).');}
}
function visibleOpponents(e,unit){return e.units.filter(u=>alive(u)&&!u.hidden&&(unit.side==='enemy'?['player','ally'].includes(u.side)||u.side==='neutral'&&u.role==='escort'&&e.mission?.mode!=='settlement':u.side==='enemy'));}
function companions(e,unit){return e.units.filter(u=>u.id!==unit.id&&alive(u)&&(unit.side==='enemy'?u.side==='enemy':['player','ally'].includes(u.side)));}
function objectiveFor(e,unit,orderAction){
 const enemies=visibleOpponents(e,unit),nearest=list=>[...list].sort((a,b)=>distance(unit,a)-distance(unit,b))[0];
 if(e.id==='ch1-road'&&unit.side==='ally'&&!orderAction)return e.units.find(u=>u.id==='hero')??e.goal;
 if(orderAction==='attack')return nearest(enemies)??e.goal;
 if(orderAction==='withdraw')return unit.side==='enemy'?unit.anchor??{x:7,y:unit.y}:e.units.find(u=>u.id==='hero')??{x:0,y:unit.y};
 if(unit.side==='enemy'){
  if(unit.role==='guard')return unit.anchor??nearest(e.mission?.points??[])??e.goal;
  if(['hold','supply'].includes(e.mission?.mode))return e.goal;
  if(unit.role==='raider'){const convoy=nearest(enemies.filter(u=>u.role==='escort'));if(convoy)return convoy;}
  if(['capture','surrender'].includes(e.mission?.mode))return nearest(e.mission.points.filter(p=>!p.secured))??e.goal;
 }else{
  if(['hold','capture','supply','surrender'].includes(e.mission?.mode)||orderAction==='advance')return missionGoal(e,unit);
  const convoy=nearest(e.units.filter(u=>u.side==='neutral'&&u.role==='escort'&&alive(u)&&distance(u,e.goal)>1));if(convoy)return convoy;
 }
 return nearest(enemies)??e.goal;
}
function routeField(e,unit,goal){
 const costs=new Map(),queue=[{x:goal.x,y:goal.y,cost:0}];costs.set(`${goal.x},${goal.y}`,0);
 while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift();if(costs.get(`${p.x},${p.y}`)!==p.cost)continue;
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=e.width||y>=e.height||blocked(e.terrain[y][x])||unitAt(e,x,y,unit.id)&&!(x===unit.x&&y===unit.y))continue;
   const cost=p.cost+(e.terrain[p.y][p.x]==='marsh'&&unit.formation!=='line'?2:1),key=`${x},${y}`;if(!costs.has(key)||cost<costs.get(key)){costs.set(key,cost);queue.push({x,y,cost});}
  }
 }return p=>costs.get(`${p.x},${p.y}`)??distance(p,goal)+12;
}
export function planBattleUnit(e,unit,{orderAction=null,destination=null,style='tactical'}={}){
 if(unit.side==='enemy'&&(e.type==='training'||e.id==='ch1-road'))style='simple';
 const idle={x:unit.x,y:unit.y,targetId:null,action:'brace',score:0,intent:'Hold position and brace.',reasons:[]};if(!alive(unit)||unit.acted&&unit.moved)return idle;
 if(orderAction==='hold')return idle;
 if(orderAction==='rally')return {...idle,action:'rally',intent:'Restore morale before rejoining the line.'};
 const foes=visibleOpponents(e,unit),friends=companions(e,unit),broken=(unit.morale??80)<=B.brokenThreshold,withdrawing=orderAction==='withdraw'||broken;
 const goal=destination??objectiveFor(e,unit,withdrawing?'withdraw':orderAction),path=routeField(e,unit,goal),range=unit.role==='archer'?3:1;
 let positions=[{x:unit.x,y:unit.y,cost:0},...(!unit.moved?reachable(e,unit):[])];if(e.id==='ch1-road'&&unit.side==='ally'){const recruit=e.units.find(u=>u.id==='hero');if(recruit)positions=positions.filter(p=>distance(p,recruit)<=Math.max(2,distance(unit,recruit)-1));}if(destination&&!unit.moved)positions=positions.filter(p=>p.x===destination.x&&p.y===destination.y);if(!positions.length)positions=[unit];
 let best=null;
 for(const p of positions){
  const projected={...unit,x:p.x,y:p.y,lastMoveDistance:p.cost?distance(unit,p):unit.lastMoveDistance??0},terrain=e.terrain[p.y][p.x];
  const targets=foes.filter(u=>distance(p,u)<=(unit.ammo>0?3:range)&&(distance(p,u)<=1||lineOfSight(e,p,u))),target=targets.map(u=>({unit:u,ranged:range>1||distance(p,u)>1,damage:damagePreview(e,projected,u,range>1||distance(p,u)>1)})).sort((a,b)=>b.damage*B.weights.damage+(b.damage>=b.unit.hp?B.weights.finish:0)-a.damage*B.weights.damage-(a.damage>=a.unit.hp?B.weights.finish:0))[0];
  const threat=foes.reduce((n,u)=>{const gap=distance(p,u),reach=(u.move??2)+(u.role==='archer'?3:1);if(gap>reach||u.role==='archer'&&!lineOfSight(e,u,p))return n;return n+damagePreview(e,u,projected,u.role==='archer')*(gap<=(u.role==='archer'?3:1)?1:.4);},0);
  const cover=terrain==='wall'?2:terrain==='high'?1:terrain==='cover'?1:0,support=friends.filter(u=>distance(p,u)===1).length;
  let score=-path(p)*B.weights.progress-(p.cost??0)*.04;
  const reasons=[];
  if(style!=='simple'){
   score+=cover*B.weights.cover+Math.min(2,support)*B.weights.cohesion-threat*B.weights.threat*(unit.side==='player'?1.6:unit.role==='archer'?1.5:unit.hp<=unit.maxHp/3?1.3:.65);
   if(unit.role==='archer'){const nearest=Math.min(8,...foes.map(u=>distance(p,u)));score+=nearest>=2&&nearest<=3?3:nearest<=1?-5:0;if(terrain==='high')score+=1;}
   if(unit.role==='guard')score-=Math.max(0,distance(p,unit.anchor??goal)-2)*2;
   if(unit.role==='cavalry'&&ROUGH_TERRAIN.includes(terrain))score-=2;
   if(unit.side==='enemy'&&['hold','supply'].includes(e.mission?.mode)&&distance(p,e.goal)<=1){score+=8;reasons.push('pressure the objective');}
   if(unit.side!=='enemy'&&goal.role==='escort'&&distance(p,goal)<=1){score+=2;reasons.push('screen the convoy');}
  }
  let action='brace',targetId=null;
  if(withdrawing){score-=threat*2;score+=Math.min(5,...foes.map(u=>distance(p,u)))*2;action=broken?'regroup':'brace';reasons.push(broken?'recover broken morale':'withdraw under shields');}
  else if(target&&!unit.acted){action=target.ranged?'throw':'strike';targetId=target.unit.id;score+=target.damage*B.weights.damage+(target.damage>=target.unit.hp?B.weights.finish:0);if(unit.role==='raider'&&target.unit.role==='escort')score+=B.weights.convoy;if(style!=='simple'&&combatBreakdown(e,projected,target.unit,target.ranged).aspect==='flank'){score+=B.weights.flank;reasons.push('open flank');}}
  if(cover)reasons.push('defensible ground');if(support)reasons.push('near friendly support');
  const name=targetId?e.units.find(u=>u.id===targetId).name:null,travel=p.x!==unit.x||p.y!==unit.y;
  const intent=`${travel?`Move to ${p.x+1}${String.fromCharCode(65+p.y)}; `:''}${name?`${action==='throw'?'fire at':'strike'} ${name}`:action==='regroup'?'regroup under cover':withdrawing?'brace during withdrawal':'guard the approach'}${reasons.length?` (${reasons.join(', ')})`:''}.`;
  if(!best||score>best.score+.00001)best={x:p.x,y:p.y,targetId,action,score,intent,reasons};
 }return best??idle;
}
export function refreshBattleIntents(e){if(e.combatVersion!==2)return;for(const u of e.units)if(alive(u)&&!u.hidden&&['ally','enemy'].includes(u.side))u.intent=planBattleUnit(e,{...u,moved:false,acted:false}).intent;}
function resolveHit(e,attacker,target,ranged=false){const hit=combatBreakdown(e,attacker,target,ranged),wasAlive=alive(target);target.hp=Math.max(0,target.hp-hit.damage);
 const loss=Math.max(1,B.hitMorale+(hit.aspect==='flank'?B.flankMorale:0)-(target.formation==='line'?FORMATION_RULES.line.morale:0)-(target.moraleResistance??0));target.morale=clamp(target.morale-loss);
 if(wasAlive&&!alive(target))for(const u of companions(e,target).filter(u=>distance(u,target)<=2))u.morale=clamp(u.morale-B.withdrawalShock);
 return hit.damage;
}
function executeBattlePlan(e,unit,plan){if(!alive(unit)||unit.moved&&unit.acted)return;
 if(!unit.moved&&(plan.x!==unit.x||plan.y!==unit.y)){unit.lastMoveDistance=distance(unit,plan);faceToward(unit,plan);unit.x=plan.x;unit.y=plan.y;unit.moved=true;note(e,`${unit.name} moves to ${unit.x+1}${String.fromCharCode(65+unit.y)}.`);}
 if(!unit.acted){const target=e.units.find(u=>u.id===plan.targetId);if(target&&alive(target)){faceToward(unit,target);const damage=resolveHit(e,unit,target,plan.action==='throw');note(e,`${unit.name} strikes ${target.name} for ${damage}.`);}
  else if(plan.action==='rally'||plan.action==='regroup'){unit.morale=clamp(unit.morale+(plan.action==='rally'?20:B.regroupMorale));unit.braced=true;note(e,`${unit.name} regroups; morale ${unit.morale}.`);}else unit.braced=true;unit.acted=true;
 }unit.moved=true;unit.intent=plan.intent;
}
function progressMission(e){const m=e.mission;if(!m)return;const allies=friendly(e),enemies=foes(e);
 for(const p of m.points)if(!p.secured&&allies.some(u=>distance(u,p)<=1)&&!enemies.some(u=>distance(u,p)<=1)){p.secured=true;note(e,`Position ${p.x+1}${String.fromCharCode(65+p.y)} secured.`);}
 if((m.mode==='hold'||m.holdRequired)&&allies.some(u=>distance(u,e.goal)<=1)&&!enemies.some(u=>distance(u,e.goal)<=1))m.holdProgress++;
 if(m.mode==='settlement'){const envoy=e.units.find(u=>u.id==='envoy'),hero=e.units.find(u=>u.id==='hero');if(envoy&&alive(envoy)&&distance(envoy,e.goal)<=1&&distance(hero,e.goal)<=2&&m.rallyProgress>0)m.envoyProgress++;}
 updateBattleProgress(e);
}
export function endBattleTurn(state){if(!state.encounter.mission)return Legacy.endBattleTurn(state);const e=state.encounter,hero=e.units.find(u=>u.id==='hero');e.turnEvents=[];e.collectTurnEvents=true;
 for(const u of e.units.filter(u=>u.side==='ally'))actAlly(e,u);
 for(const enemy of foes(e)){if(enemy.hidden&&!e.scouted&&distance(enemy,hero)>2)continue;enemy.hidden=false;enemyTurn(state,e,enemy);}
 for(const escort of e.units.filter(u=>u.role==='escort'&&u.side==='neutral'))if(operationEscortsMove(e)&&escort.escorted&&alive(escort)&&distance(escort,hero)<=4&&distance(escort,e.goal)>1)stepToward(e,escort,e.goal,2);
 for(const wave of e.mission?.waves??[])if(!wave.arrived&&e.turn>=wave.turn){let location=point([wave.x,wave.y]);if(unitAt(e,location.x,location.y)){location=[{x:wave.x,y:wave.y-1},{x:wave.x,y:wave.y+1},{x:wave.x-1,y:wave.y}].find(p=>p.y>=0&&p.y<8&&p.x>=0&&!blocked(e.terrain[p.y][p.x])&&!unitAt(e,p.x,p.y));}if(location){wave.arrived=true;e.units.push(enemyUnit(state,`reinforce${e.reinforcements++}`,location.x,location.y,wave.role,{hp:7,damage:3}));note(e,`Reinforcements enter at ${location.x+1}${String.fromCharCode(65+location.y)}.`);}}
 if(e.combatVersion===2&&['hold','supply'].includes(e.mission?.mode)&&foes(e).some(u=>distance(u,e.goal)<=1)&&!friendly(e).some(u=>distance(u,e.goal)<=1)){const pressure=difficultyRule(e).pressure;e.defence-=pressure;note(e,`Unopposed enemy occupation damages the objective (−${pressure} integrity this round).`);}
 progressMission(e);checkBattle(state,true);delete e.collectTurnEvents;
 if(e.status==='active'){e.turn++;e.commandsLeft=e.commandCapacity;for(const u of e.units){u.moved=false;u.acted=false;u.ordered=false;if(e.progressionVersion===1)delete u.guardTargetId;if(e.combatVersion!==2||u.side!=='enemy'){u.braced=false;u.formation=null;}if(e.combatVersion===2)u.lastMoveDistance=0;}note(e,`Turn ${e.turn}. ${e.commandsLeft} commands available. ${e.objectiveProgress??''}`);refreshBattleIntents(e);}
 return result(true,e.status==='active'?'The enemy turn ends.':e.status==='won'?'Objective secured. Commit the encounter to preserve its rewards.':'The mission failed. Retry restores the complete encounter-start checkpoint.');
}
export function checkBattle(state,atTurnEnd=false){if(!state.encounter.mission)return Legacy.checkBattle(state,atTurnEnd);const e=state.encounter,hero=e.units.find(u=>u.id==='hero');if(e.status!=='active')return;
 if(!alive(hero)||e.defence<=0){e.status='lost';note(e,!alive(hero)?'The commander falls.':'The defended line breaks.');return;}
 const required=e.requiredAbility,used=a=>e.usedAbilities.includes(a)||(['prepare','stratagem','allocate','negotiate','judge'].includes(a)&&state.chapterCapabilities[state.chapter]?.includes(a)),capable=(!required||used(required))&&(e.requiredAbilities??[]).every(used),m=e.mission,nearGoal=distance(hero,e.goal)<=1;
 if(m?.escortIds.some(id=>!alive(e.units.find(u=>u.id===id)))){e.status='lost';note(e,'A protected column was lost. Retry the evacuation checkpoint.');return;}
 let objective=false;
 if(!m)objective=e.type==='training'?['move','strike','brace','throw'].every(used):['defend','siege'].includes(e.type)?e.defence>0:foes(e).length===0;
 else if(m.mode==='training')objective=['move','strike','brace','throw'].every(used);
 else if(m.mode==='clear')objective=foes(e).length===0&&m.waves.every(w=>w.arrived);
 else if(m.mode==='recover')objective=used('scout')&&nearGoal;
 else if(m.mode==='extract')objective=m.escortIds.every(id=>{const u=e.units.find(v=>v.id===id);return u.escorted&&distance(u,e.goal)<=1;})&&nearGoal&&m.holdProgress>=m.holdRequired;
 else if(m.mode==='hold')objective=(m.holdProgress>=m.holdRequired||e.operation&&nearGoal&&foes(e).length===0&&m.waves.every(w=>w.arrived))&&!foes(e).some(u=>distance(u,e.goal)<=1);
 else if(m.mode==='capture'||m.mode==='supply')objective=m.points.every(p=>p.secured)&&e.defence>0;
 else if(m.mode==='defection')objective=(e.defections??0)>=Math.min(3,e.units.filter(u=>u.id.startsWith('enemy')).length)||foes(e).length===0;
 else if(m.mode==='settlement')objective=m.envoyProgress>=2;
 else if(m.mode==='surrender')objective=m.points.every(p=>p.secured)&&nearGoal;
 const gathering=operationGather(e);if(gathering)objective=gathering.complete;
 updateBattleProgress(e);
 if(objective&&operationQualified(e)&&advanceOperation(e)){updateBattleProgress(e);if(atTurnEnd&&e.turn>=e.turnLimit){e.status='lost';note(e,'Deadline: the next operation phase is still unfinished. Retry the complete checkpoint.');}return;}
 if(objective&&operationQualified(e)&&capable){e.status='won';note(e,'The chapter objective is secured.');}
 else if(atTurnEnd&&e.turn>=e.turnLimit){e.status='lost';note(e,!capable?`Deadline: demonstrate ${(e.requiredAbilities??[]).concat(required??[]).join(', ')}.`:`Deadline: ${e.objectiveProgress}.`);}
}

