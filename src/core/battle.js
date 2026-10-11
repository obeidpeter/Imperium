import * as Legacy from './legacy-battle.js';
export const createLegacyBattle=Legacy.createBattle;
import {alive, blocked, clamp, distance, faceToward, lineOfSight, makeUnit, note, reachable, result, rng, stepToward, unitAt} from './shared.js';
import {BATTLE_SCENARIOS} from '../data/encounters.js';

export const commandCapacity = chapter => chapter<4?0:chapter===4?1:chapter===5?3:chapter===6?4:chapter<9?5:6;
const point=([x,y])=>({x,y});
const terrainKey={X:'rock','~':'river',f:'ford','#':'wall','^':'high','=':'road',s:'stone',m:'marsh'};
function companyUnit(state,index,unit){const v=state.company?.[index];if(!v)return unit;unit.veteranId=v.id;unit.name=v.name;unit.maxHp+=v.commendations>=3?1:0;unit.hp=Math.max(8,unit.maxHp-Math.min(2,v.recovery??0));unit.moraleResistance=v.commendations>=6?1:0;return unit;}
function addEscort(e,id,name,x,y,{escorted=true,hp=20}={}){e.units.push(makeUnit(id,name,'neutral',x,y,{hp,role:'escort',move:2,escorted,intent:escorted?'Follow the commander to extraction.':'Needs adjacent Assist before evacuation.'}));e.mission.escortIds.push(id);}
function enemyUnit(state,id,x,y,role='infantry',extra={}){const c=state.chapter,faction=c===5||c===6?'Persian':c===9?'Palmyrene':c>=11?'Rival Roman':'Gothic';return makeUnit(id,`${faction} ${role}`,'enemy',x,y,{hp:(c<4?8:10)+Math.floor(rng(state)*2),damage:c<4?3:4,role,move:role==='cavalry'?3:2,facing:'west',anchor:{x,y},intent:role==='archer'?'Keep range and fire along an open line.':role==='guard'?'Guard this approach; counterattack intruders.':role==='raider'?'Seek the convoy or an unguarded objective.':role==='cavalry'?'Flank exposed troops; avoid a braced front.':'Press the nearest opponent.',...extra});}
export function createBattle(state,data,options={}){
 const c=state.chapter,t=BATTLE_SCENARIOS[data.id]??BATTLE_SCENARIOS['ch1-road'],ground=data.terrain==='marsh'?'marsh':data.terrain==='sand'?'sand':data.terrain==='stone'?'stone':'grass',terrain=t.map.map(row=>[...row].map(k=>terrainKey[k]??ground));
 const e={id:data.id,kind:'battle',title:data.title,objective:data.objective,type:data.type,width:8,height:8,terrain,units:[],turn:1,turnLimit:data.turnLimit??14,status:'active',commandCapacity:commandCapacity(c),commandsLeft:commandCapacity(c),log:[],usedAbilities:[],goal:point(t.goal),requiredAbility:data.requiredAbility,staged:{meters:{army:0,political:0,public:0},supplies:0,obligations:[]},defence:100,route:options.route??state.route??'battle',minimumTurns:0,reinforcements:0,scenario:data.id,mission:{mode:t.mode,holdRequired:t.hold??0,holdProgress:0,points:(t.points??[]).map(p=>({...point(p),secured:false})),waves:(t.waves??[]).map(w=>({...w,arrived:false})),escortIds:[],rallyProgress:0,envoyProgress:0}};
 const hero=makeUnit('hero',state.name,'player',0,3,{hp:c<4?22:26,role:c<7?'soldier':'commander',move:c<7?2:3,ammo:3,damage:c<4?4:3});e.units.push(hero);
 if(data.type==='training')e.units.push(makeUnit('dummy','Training partner','enemy',2,3,{hp:10,damage:1,role:'trainer',facing:'west'}));
 else{const count=c<4?1:c===4?3:c<7?4:5,positions=[[0,1],[1,1],[0,5],[1,5],[1,6]];
  for(let i=0;i<count;i++){const[x,y]=positions[i];e.units.push(companyUnit(state,e.id==='ch2-marsh'&&state.decisions.ch2!=='leave'?1:i,makeUnit(`ally${i}`,i===0?(state.decisions.ch2==='leave'?'Sabinus':'Lucan'):`Formation ${i+1}`,'ally',x,y,{hp:c<4?13:16,damage:3,role:i===count-1&&c>=7?'archer':'infantry',intent:'Advance on the objective; strike threats in reach.'})));}
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
 if(c===12&&data.type==='confrontation')configureFinale(state,e,options.forecast);
 for(const unit of e.units)if(blocked(e.terrain[unit.y][unit.x])||e.units.some(other=>other!==unit&&other.x===unit.x&&other.y===unit.y&&e.units.indexOf(other)<e.units.indexOf(unit))){const safe=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!blocked(e.terrain[y][x])&&!unitAt(e,x,y))safe.push({x,y});safe.sort((a,b)=>distance(a,unit)-distance(b,unit));if(safe[0])Object.assign(unit,safe[0]);}
 updateBattleProgress(e);e.objective+=` ${e.mission.variant??''} ${missionDescription(e)} Finish by turn ${e.turnLimit}.`;note(e,e.objective);return e;
}
function configureFinale(state,e,forecast){
 const enemyCount=forecast?.enemies??6,allyCount=forecast?.allies??3;e.units=e.units.filter(u=>u.id==='hero');e.turnLimit=16;e.defections=0;e.mission.waves=[];
 const positions=[[0,1],[1,1],[0,5],[1,5],[1,6],[2,0],[2,7]];
 for(let i=0;i<allyCount;i++){const[x,y]=positions[i];e.units.push(companyUnit(state,e.id==='ch2-marsh'&&state.decisions.ch2!=='leave'?1:i,makeUnit(`ally${i}`,i===0?(state.decisions.ch2==='leave'?'Sabinus’s relief legion':'Lucan’s relief legion'):`Relief cohort ${i+1}`,'ally',x,y,{hp:20,damage:4,move:2,role:i===allyCount-1?'archer':'infantry'})));}
 for(let i=0;i<enemyCount;i++)e.units.push(enemyUnit(state,`enemy${i}`,6+i%2,1+i,i===2?'archer':'infantry',{name:i===0?'Rival claimant':`Civil-war cohort ${i+1}`,hp:Math.max(8,12-Math.floor(state.meters.public/30)),damage:Math.max(2,4-Math.floor(state.meters.political/50)),morale:Math.max(20,80-Math.floor(state.meters.political/2))}));
 if(e.route==='backer'){e.units.filter(u=>u.side==='ally').forEach(u=>{u.hp=u.maxHp=24;u.damage=5;});e.units.filter(u=>u.side==='enemy').forEach(u=>u.damage=2);e.staged.obligations.push({id:'finale-backer',to:'The quartermaster council',promise:'Reserve two years of imperial revenue for the army’s creditors.',due:12,cost:6,consequence:'Army creditors limit the first years of reform.',status:'open'});}
 if(e.route==='defection'){e.type='standoff';e.mission.mode='defection';e.goal={x:4,y:3};e.mission.variant='Rally within three tiles of rival infantry to break allegiance. Three pledges win; the commander must survive.';}
 if(e.route==='settlement'){e.type='standoff';e.mission.mode='settlement';e.goal={x:6,y:3};addEscort(e,'envoy','Senate’s negotiating envoy',1,4,{hp:26});e.mission.variant='Escort the envoy to the claimant; hold the meeting for two turns. Rally reassures the parley but does not make enemies defect.';}
 if(e.route==='surrender'){e.type='standoff';e.mission.mode='surrender';e.goal={x:6,y:3};e.mission.points=[{x:4,y:1,secured:false},{x:4,y:6,secured:false}];e.mission.variant='Secure both gate approaches, then bring the commander to the claimant’s standard.';}
}
function missionDescription(e){const m=e.mission;return m.mode==='hold'?`Control the marker without adjacent enemies for ${m.holdRequired} turns.`:m.mode==='supply'?'Secure both grain routes while keeping stores intact.':m.mode==='capture'?`Stand beside ${m.points.length} marked positions and clear enemies from those approaches.`:m.mode==='extract'?'Escort every column to the marker, keeping the commander within four tiles; do not lose a column.':m.mode==='recover'?'Scout and reach the chest at the marker.':m.mode==='clear'?'Defeat the field force and its arriving reinforcements.':'';}
export function updateBattleProgress(e){const m=e.mission;if(!m)return;e.objectiveProgress=m.mode==='training'?`Drill actions demonstrated ${['move','strike','brace','throw'].filter(a=>e.usedAbilities.includes(a)).length}/4`:m.mode==='hold'?`Ground held ${m.holdProgress}/${m.holdRequired} · line ${e.defence}`:['capture','supply','surrender'].includes(m.mode)?`Positions secured ${m.points.filter(p=>p.secured).length}/${m.points.length} · line ${e.defence}`:m.mode==='defection'?`Pledges secured ${e.defections??0}/3`:m.mode==='settlement'?`Envoy meeting ${m.envoyProgress}/2`:m.escortIds.length?`Columns at extraction ${m.escortIds.filter(id=>{const u=e.units.find(v=>v.id===id);return u&&distance(u,e.goal)<=1;}).length}/${m.escortIds.length}`:`Enemy units remaining ${e.units.filter(u=>u.side==='enemy'&&alive(u)).length}`;const wave=m.waves.find(w=>!w.arrived);e.pressure=wave?`Reinforcements due turn ${wave.turn} at ${wave.x+1}${String.fromCharCode(65+wave.y)}`:`Deadline turn ${e.turnLimit}`;}
function opposing(unit) {return unit.side==='enemy'?['player','ally']:['enemy'];}
function facingDefence(target,attacker) {
  const front=target.facing==='east'?attacker.x>=target.x:target.facing==='west'?attacker.x<=target.x:target.facing==='south'?attacker.y>=target.y:attacker.y<=target.y;
  return front?1:0;
}
export function damagePreview(e,unit,target,ranged=false) {if(!e.mission)return Legacy.damagePreview(e,unit,target,ranged);
  const terrain=e.terrain[target.y][target.x];const cover=terrain==='wall'?2:terrain==='high'?1:0;
  const flank=facingDefence(target,unit),brace=target.braced?2:0,screen=target.role==='escort'&&e.units.some(u=>['ally','player'].includes(u.side)&&alive(u)&&distance(u,target)<=1)?1:0;
  return Math.max(1,(ranged?3:unit.damage??3)-cover-flank-brace-screen+(unit.formation==='wedge'?1:0)+(target.formation==='wedge'?1:0));
}
export function battleActions(state,unit) {if(!state.encounter.mission)return Legacy.battleActions(state,unit);
  const e=state.encounter,c=state.chapter;if(!unit||!alive(unit)||e.status!=='active'||!['player','ally'].includes(unit.side)) return [];
  if(unit.side==='ally') {if(c<4)return [];return !unit.ordered&&e.commandsLeft>0?['order',...(c>=5?['formation']:[])]:[];}
  const actions=[];if(!unit.moved)actions.push('move');if(!unit.acted) {actions.push('strike','brace');if(unit.ammo>0)actions.push('throw');if(c>=2)actions.push('assist');if(c>=3)actions.push('scout');if(c>=6)actions.push('rally');}
  if(c>=4&&e.commandsLeft>0)actions.push('order');if(c>=5&&e.commandsLeft>0)actions.push('formation');
  if(c===7&&e.turn===1&&!unit.moved&&!e.usedAbilities.includes('deploy'))actions.push('deploy');return actions;
}
export function battleTargets(state,unit,action) {if(!state.encounter.mission)return Legacy.battleTargets(state,unit,action);
  const e=state.encounter;
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
  if(action==='formation'&&!['line','shield-wall','wedge'].includes(command.formation??'shield-wall'))return result(false,'Choose line, shield-wall, or wedge.');
  if(['order','formation'].includes(action)&&!['advance','attack','hold','rally'].includes(command.orderAction??'advance'))return result(false,'Choose advance, attack, hold, or rally for the order.');
  if(command.destination&&(!Number.isInteger(command.destination.x)||!Number.isInteger(command.destination.y)||!reachable(e,other).some(p=>p.x===command.destination.x&&p.y===command.destination.y)))return result(false,'The ordered destination must be within the ally’s normal movement allowance.');
  const orderEffect={advance:command.destination?`advance toward tile ${command.destination.x+1}, ${command.destination.y+1}, then strike an enemy in reach`:'advance toward the objective, then strike an enemy in reach',attack:'advance toward the nearest enemy, then strike if in reach',hold:'stay in position and brace; this ends the ally’s movement and action',rally:'restore 20 of the ally’s own morale; this ends their movement and action'}[command.orderAction??'advance'];
  const messages={move:`Move to ${command.x+1}${String.fromCharCode(65+command.y)}. Costs this unit’s movement.`,deploy:'Deploy the command unit before the first clash. Uses this turn’s movement.',strike:`Strike ${other?.name} for ${other?damagePreview(e,unit,other):0} damage. ${other?`${facingDefence(other,unit)?"Frontal approach: shield defence applies":"Flanking approach: frontal defence bypassed"}; target faces ${other.facing}.`:""} High ground and walls reduce damage.`,throw:`Throw one javelin at ${other?.name} for ${other?damagePreview(e,unit,other,true):0} damage; ${Math.max(0,unit.ammo-1)} remain.`,brace:'Brace the shield: reduce incoming damage by 2 until your next turn. Costs one action.',assist:`Shield ${other?.name}, restore 3 health, and escort wounded survivors toward the standard. Costs one action.`,scout:'Reveal every hidden enemy and a safe path to the standard. Costs one action.',rally:'Restore 25 morale and 2 health to friends within 3 tiles. On the defection route, also lower one nearby opponent morale by 40; at 25 they pledge allegiance. Costs one action.',order:`Spend 1 command to override ${other?.name}’s announced intent: ${orderEffect}. Their normal move and action limits still apply.`,formation:`Spend 1 command: ${command.formation??'shield-wall'} affects an adjacent group of up to 3 allies. Each will ${orderEffect}. Lasts this round. Shield wall: protection 2, march 1; Line: normal marsh cost and morale loss −5; Wedge: attack +1 and incoming damage +1. Each moves and acts at most once.`};
  return result(true,(messages[action]??action)+(['order','formation'].includes(action)?` Tactic: ${command.orderAction??'advance'}.`:''));
}
export function applyBattle(state,command) {if(!state.encounter.mission)return Legacy.applyBattle(state,command);
  const checked=previewBattle(state,command);if(!checked.ok)return checked;
  const e=state.encounter,unit=e.units.find(u=>u.id===command.unitId),action=command.action,target=e.units.find(u=>u.id===command.targetId)||unitAt(e,command.x,command.y);
  if(action==='move'||action==='deploy'){faceToward(unit,command);unit.x=command.x;unit.y=command.y;unit.moved=true;}
  else if(action==='strike'||action==='throw'){if(action==='throw')unit.ammo--;faceToward(unit,target);const damage=damagePreview(e,unit,target,action==='throw');target.hp=Math.max(0,target.hp-damage);unit.acted=true;note(e,`${unit.name} hits ${target.name} for ${damage}${target.hp===0?' — withdrawn from the field':''}.`);}
  else if(action==='brace'){unit.braced=true;unit.acted=true;}
  else if(action==='assist'){target.hp=Math.min(target.maxHp,target.hp+3);target.braced=true;target.escorted=true;unit.acted=true;}
  else if(action==='scout'){e.units.forEach(u=>u.hidden=false);e.scouted=true;unit.acted=true;}
  else if(action==='rally'){e.units.filter(u=>['ally','player','neutral'].includes(u.side)&&alive(u)&&distance(unit,u)<=3).forEach(u=>{u.morale=clamp(u.morale+25);u.hp=Math.min(u.maxHp,u.hp+2);});if(e.mission?.mode==='defection'){const rival=e.units.filter(u=>u.side==='enemy'&&alive(u)&&distance(unit,u)<=3).sort((a,b)=>a.morale-b.morale)[0];if(rival){rival.morale=clamp(rival.morale-40);note(e,`${rival.name} hears the oath: morale ${rival.morale}.`);if(rival.morale<=25)defect(e,rival);}}if(e.mission)e.mission.rallyProgress++;unit.acted=true;}
  else if(action==='order'){e.commandsLeft--;target.ordered=true;actAlly(e,target,command.orderAction??'advance',command.destination);}
  else if(action==='formation') {e.commandsLeft--;const group=[target,...e.units.filter(u=>u.side==='ally'&&u.id!==target.id&&alive(u)&&distance(u,target)<=1&&!u.ordered)].slice(0,3);group.forEach(u=>{u.formation=command.formation??'shield-wall';if(u.formation==='shield-wall')u.braced=true;u.ordered=true;actAlly(e,u,command.orderAction??'advance');});note(e,`${group.length} units form ${command.formation??'shield-wall'}; one command spent.`);}
  if(!e.usedAbilities.includes(action))e.usedAbilities.push(action);state.capabilityUse[action]=true;note(e,checked.message);checkBattle(state);return checked;
}
function friendly(e){return e.units.filter(u=>['player','ally'].includes(u.side)&&alive(u));}
function foes(e){return e.units.filter(u=>u.side==='enemy'&&alive(u));}
function missionGoal(e,unit){return (e.mission?.points?.filter(p=>!p.secured)??[]).sort((a,b)=>distance(unit,a)-distance(unit,b))[0]??e.goal;}
function actAlly(e,unit,orderAction=null,destination=null){
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
function progressMission(e){const m=e.mission;if(!m)return;const allies=friendly(e),enemies=foes(e);
 for(const p of m.points)if(!p.secured&&allies.some(u=>distance(u,p)<=1)&&!enemies.some(u=>distance(u,p)<=1)){p.secured=true;note(e,`Position ${p.x+1}${String.fromCharCode(65+p.y)} secured.`);}
 if((m.mode==='hold'||m.holdRequired)&&allies.some(u=>distance(u,e.goal)<=1)&&!enemies.some(u=>distance(u,e.goal)<=1))m.holdProgress++;
 if(m.mode==='settlement'){const envoy=e.units.find(u=>u.id==='envoy'),hero=e.units.find(u=>u.id==='hero');if(envoy&&alive(envoy)&&distance(envoy,e.goal)<=1&&distance(hero,e.goal)<=2&&m.rallyProgress>0)m.envoyProgress++;}
 updateBattleProgress(e);
}
export function endBattleTurn(state){if(!state.encounter.mission)return Legacy.endBattleTurn(state);const e=state.encounter,hero=e.units.find(u=>u.id==='hero');e.turnEvents=[];e.collectTurnEvents=true;
 for(const u of e.units.filter(u=>u.side==='ally'))actAlly(e,u);
 for(const enemy of foes(e)){if(enemy.hidden&&!e.scouted&&distance(enemy,hero)>2)continue;enemy.hidden=false;enemyTurn(state,e,enemy);}
 for(const escort of e.units.filter(u=>u.role==='escort'&&u.side==='neutral'))if(escort.escorted&&alive(escort)&&distance(escort,hero)<=4&&distance(escort,e.goal)>1)stepToward(e,escort,e.goal,2);
 for(const wave of e.mission?.waves??[])if(!wave.arrived&&e.turn>=wave.turn){let location=point([wave.x,wave.y]);if(unitAt(e,location.x,location.y)){location=[{x:wave.x,y:wave.y-1},{x:wave.x,y:wave.y+1},{x:wave.x-1,y:wave.y}].find(p=>p.y>=0&&p.y<8&&p.x>=0&&!blocked(e.terrain[p.y][p.x])&&!unitAt(e,p.x,p.y));}if(location){wave.arrived=true;e.units.push(enemyUnit(state,`reinforce${e.reinforcements++}`,location.x,location.y,wave.role,{hp:7,damage:3}));note(e,`Reinforcements enter at ${location.x+1}${String.fromCharCode(65+location.y)}.`);}}
 progressMission(e);checkBattle(state,true);delete e.collectTurnEvents;
 if(e.status==='active'){e.turn++;e.commandsLeft=e.commandCapacity;for(const u of e.units){u.moved=false;u.acted=false;u.ordered=false;u.braced=false;u.formation=null;}note(e,`Turn ${e.turn}. ${e.commandsLeft} commands available. ${e.objectiveProgress??''}`);}
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
 else if(m.mode==='hold')objective=m.holdProgress>=m.holdRequired&&!foes(e).some(u=>distance(u,e.goal)<=1);
 else if(m.mode==='capture'||m.mode==='supply')objective=m.points.every(p=>p.secured)&&e.defence>0;
 else if(m.mode==='defection')objective=(e.defections??0)>=Math.min(3,e.units.filter(u=>u.id.startsWith('enemy')).length)||foes(e).length===0;
 else if(m.mode==='settlement')objective=m.envoyProgress>=2;
 else if(m.mode==='surrender')objective=m.points.every(p=>p.secured)&&nearGoal;
 updateBattleProgress(e);
 if(objective&&capable){e.status='won';note(e,'The chapter objective is secured.');}
 else if(atTurnEnd&&e.turn>=e.turnLimit){e.status='lost';note(e,!capable?`Deadline: demonstrate ${(e.requiredAbilities??[]).concat(required??[]).join(', ')}.`:`Deadline: ${e.objectiveProgress}.`);}
}

