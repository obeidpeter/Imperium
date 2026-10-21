// Frozen pre-upgrade battle rules for already-suspended v1 encounters only.
// Private copies of old helpers preserve checkpoint RNG, movement and turn semantics.
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const alive = unit => (unit.resolve ?? unit.hp) > 0;
const result = (ok, message) => ({ok, message});
function rng(state) { state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0; return state.rng / 4294967296; }
function note(encounter, message) { encounter.log.push(message); if(encounter.log.length > 70) encounter.log.shift(); }
function unitAt(encounter, x, y, except) { return encounter.units.find(u => u.id !== except && alive(u) && u.x === x && u.y === y); }
function reachable(encounter, unit, range = unit.move ?? 2) {
  const found = new Map([[`${unit.x},${unit.y}`, {x:unit.x,y:unit.y,cost:0}]]), queue = [{x:unit.x,y:unit.y,cost:0}];
  while(queue.length) { const node=queue.shift(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const x=node.x+dx,y=node.y+dy; if(x<0||y<0||x>=encounter.width||y>=encounter.height) continue;
    const terrain=encounter.terrain[y][x]; if(terrain==='rock'||unitAt(encounter,x,y,unit.id)) continue;
    const cost=node.cost+(terrain==='marsh'?2:1), key=`${x},${y}`;
    if(cost>range || (found.has(key)&&found.get(key).cost<=cost)) continue;
    const item={x,y,cost}; found.set(key,item); queue.push(item);
  }}
  return [...found.values()].filter(p=>p.x!==unit.x||p.y!==unit.y);
}
function stepToward(encounter, unit, target, range = unit.move ?? 2) {
  const places=reachable(encounter,unit,range).map(p=>({...p,path:pathDistance(encounter,p,target,unit.id)})).sort((a,b)=>a.path-b.path||a.cost-b.cost);
  if(places[0]&&places[0].path<pathDistance(encounter,unit,target,unit.id)) {unit.x=places[0].x;unit.y=places[0].y;unit.moved=true;return true;} return false;
}
function pathDistance(e,from,target,ignoreId){const costs=new Map([[`${from.x},${from.y}`,0]]),queue=[{x:from.x,y:from.y,cost:0}];while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift();if(p.x===target.x&&p.y===target.y)return p.cost;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=e.width||y>=e.height||e.terrain[y][x]==='rock')continue;if(unitAt(e,x,y,ignoreId)&&(x!==target.x||y!==target.y))continue;const cost=p.cost+(e.terrain[y][x]==='marsh'?2:1),key=`${x},${y}`;if(!costs.has(key)||cost<costs.get(key)){costs.set(key,cost);queue.push({x,y,cost});}}}return 999;}
function makeUnit(id,name,side,x,y,extra={}) { const hp=extra.hp??12; return {id,name,side,x,y,hp,maxHp:hp,role:'infantry',moved:false,acted:false,move:2,facing:'east',morale:80,intent:'Hold position',...extra}; }


export const commandCapacity = chapter => chapter<4?0:chapter===4?1:chapter===5?3:chapter===6?4:chapter<9?5:6;
export function createBattle(state, data, options={}) {
  const c=state.chapter, type=data.type, terrain=Array.from({length:8},()=>Array(8).fill(data.terrain==='marsh'?'marsh':data.terrain==='sand'?'sand':'grass'));
  for(let y=0;y<8;y++) terrain[y][3]=data.terrain==='river'?(y===3||y===4?'ford':'rock'):'road';
  if(data.terrain==='marsh') for(let x=0;x<8;x++) terrain[3][x]='road';
  for(const [x,y] of [[1,2],[2,2],[5,2],[5,5]]) terrain[y][x]=type==='siege'||type==='defend'?'wall':'high';
  const e={id:data.id,kind:'battle',title:data.title,objective:data.objective,type,width:8,height:8,terrain,units:[],turn:1,turnLimit:data.turnLimit??14,status:'active',commandCapacity:commandCapacity(c),commandsLeft:commandCapacity(c),log:[],usedAbilities:[],goal:{x:7,y:3},requiredAbility:data.requiredAbility,staged:{meters:{army:0,political:0,public:0},supplies:0,obligations:[]},defence:100,route:options.route??state.route??'battle',minimumTurns:type==='training'?4:8,reinforcements:0};
  const hero=makeUnit('hero',state.name,'player',0,3,{hp:c<4?22:26,role:c<7?'soldier':'commander',move:c<7?2:3,ammo:3,damage:c<4?4:3});
  if(state.preparation==='rest') hero.hp=hero.maxHp+=4;
  e.units.push(hero);
  if(type==='training') {
    e.units.push(makeUnit('dummy','Training partner','enemy',2,3,{hp:10,damage:1,role:'trainer'}));e.turnLimit=10;e.goal={x:4,y:3};
  } else {
    const number=c<4?1:c===4?3:c<7?4:c<10?5:5;
    for(let i=0;i<number;i++) e.units.push(makeUnit(`ally${i}`,i===0?(state.decisions.ch2==='leave'?(c<4?'Sabinus':c<7?'Sabinus’s squad':'Sabinus’s cohort'):(c<4?'Lucan — tent-mate':c<7?'Lucan’s squad':'Lucan’s cohort')):`${c<4?'Legionary':c<7?'Squad':'Cohort'} ${i+1}`,'ally',i%2,1+Math.floor(i/2)*2,{hp:c<4?13:16,damage:3,role:i===number-1&&c>=7?'archer':'infantry',move:2,intent:'Advance toward the standard; strike adjacent threats.'}));
    const faction=c===5||c===6?'Persian':c===9?'Palmyrene':c>=11?'Rival Roman':'Gothic';
    const enemies=c<4?2:c<7?3:4;
    for(let i=0;i<enemies;i++) e.units.push(makeUnit(`enemy${i}`,`${faction} ${i===1?'archers':i===2?'cavalry':'warband'}`,'enemy',6-i%2,1+i*2,{hp:(c<4?9:11)+Math.floor(rng(state)*2),damage:c<4?3:4,role:i===1?'archer':i===2?'cavalry':'infantry',move:i===2?3:2,hidden:c===3&&i===1,intent:i===1?'Loose arrows at exposed troops.':'Charge toward the commander.'}));
    if(['rescue','escort','retreat'].includes(type)) e.units.push(makeUnit('escort',type==='retreat'||c===6?'Eagle-bearer':type==='rescue'?'Wounded survivor':c===3?'Records party':c===4?'Withdrawal squad':'Settler column','neutral',2,4,{hp:14,role:'escort',move:1,escorted:type!=='rescue',intent:'Needs an escort to the rally standard.'}));
  }
  if(['defend','siege','standoff'].includes(type)) e.goal={x:2,y:3};
  if(state.preparation==='fortify') {terrain[3][1]='wall';hero.braced=true;e.defence+=20;}
  if(state.preparation==='drill') e.units.filter(u=>u.side==='ally').forEach(u=>u.damage++);
  if(state.preparation==='march') e.units.filter(u=>u.side==='ally').forEach(u=>u.x++);
  if(state.stratagem==='night') e.units.filter(u=>u.side==='enemy').forEach(u=>u.damage=Math.max(1,u.damage-1));
  if(state.stratagem==='feint') e.units.filter(u=>u.side==='enemy'&&u.role==='cavalry').forEach(u=>{u.hp-=4;u.morale-=20;});
  if(state.stratagem==='flank') e.units.filter(u=>u.side==='ally').forEach(u=>u.damage++);
  if(c>=6){e.condition=state.supplies>=4?'supplied':state.supplies>0?'strained':'exhausted';e.staged.supplies=-1;if(state.supplies===0)e.units.filter(u=>u.side==='ally').forEach(u=>{u.hp=u.maxHp=Math.max(8,u.maxHp-2);u.morale=60;});note(e,`Troop condition: ${e.condition}. This mission consumes one supply convoy when its result is committed.`);}
  if(c===12 && type==='confrontation') configureFinale(state,e,options.forecast);
  note(e,`Turn 1. ${e.objective} ${type==='training'?'Practice Move, Strike, Brace and Throw.':'Hold through at least turn 8 while completing the objective.'}`);
  e.objective+=` Hold through the end of turn ${e.minimumTurns}; finish by turn ${e.turnLimit}.`;return e;
}
function configureFinale(state,e,forecast) {
  const enemyCount=forecast?.enemies??6,allyCount=forecast?.allies??3;
  e.units=e.units.filter(u=>u.id==='hero');e.minimumTurns=8;e.turnLimit=14;e.goal={x:6,y:3};e.defections=0;
  for(let i=0;i<allyCount;i++) e.units.push(makeUnit(`ally${i}`,i===0?(state.decisions.ch2==='leave'?'Sabinus’s relief legion':'Lucan’s relief legion'):`Loyal cohort ${i+1}`,'ally',i%2,Math.min(7,i+1),{hp:20,damage:4,move:2,role:i===allyCount-1?'archer':'infantry'}));
  for(let i=0;i<enemyCount;i++) e.units.push(makeUnit(`enemy${i}`,i===0?'Rival claimant':`Civil-war cohort ${i+1}`,'enemy',6+i%2,Math.min(7,i+1),{hp:Math.max(8,12-Math.floor(state.meters.public/30)),damage:Math.max(2,4-Math.floor(state.meters.political/50)),move:2,morale:Math.max(20,80-Math.floor(state.meters.political/2)),role:i===2?'archer':'infantry'}));
  if(e.route==='backer') {e.units.filter(u=>u.side==='ally').forEach(u=>{u.hp=u.maxHp=24;u.damage=5;});e.units.filter(u=>u.side==='enemy').forEach(u=>u.damage=2);e.staged.obligations.push({id:'finale-backer',to:'The quartermaster council',promise:'Reserve two years of imperial revenue for the army’s creditors.',due:12,cost:6,consequence:'The army is paid, but the first years of the reign have little room for reform.',status:'open'});}
  if(['settlement','surrender','defection'].includes(e.route)) {e.type='standoff';e.goal={x:2,y:3};e.minimumTurns=8;note(e,'Hold the standard and Rally wavering troops. Enemy defections unfold over eight turns.');}
}
function opposing(unit) {return unit.side==='enemy'?['player','ally']:['enemy'];}
function facingDefence(target,attacker) {
  const front=target.facing==='east'?attacker.x>=target.x:target.facing==='west'?attacker.x<=target.x:target.facing==='south'?attacker.y>=target.y:attacker.y<=target.y;
  return front?1:0;
}
export function damagePreview(e,unit,target,ranged=false) {
  const terrain=e.terrain[target.y][target.x];const cover=terrain==='wall'?2:terrain==='high'?1:0;
  const flank=facingDefence(target,unit),brace=target.braced?2:0;
  return Math.max(1,(ranged?3:unit.damage??3)-cover-flank-brace+(unit.formation==='wedge'?1:0));
}
export function battleActions(state,unit) {
  const e=state.encounter,c=state.chapter;if(!unit||!alive(unit)||e.status!=='active'||!['player','ally'].includes(unit.side)) return [];
  if(unit.side==='ally') {if(c<4)return [];return !unit.ordered&&e.commandsLeft>0?['order',...(c>=5?['formation']:[])]:[];}
  const actions=[];if(!unit.moved)actions.push('move');if(!unit.acted) {actions.push('strike','brace');if(unit.ammo>0)actions.push('throw');if(c>=2)actions.push('assist');if(c>=3)actions.push('scout');if(c>=6)actions.push('rally');}
  if(c>=4&&e.commandsLeft>0)actions.push('order');if(c>=5&&e.commandsLeft>0)actions.push('formation');
  if(c===7&&e.turn===1&&!unit.moved&&!e.usedAbilities.includes('deploy'))actions.push('deploy');return actions;
}
export function battleTargets(state,unit,action) {
  const e=state.encounter;
  if(action==='move')return reachable(e,unit);
  if(action==='deploy')return reachable(e,unit,5).filter(p=>p.x<=3);
  if(action==='strike'||action==='throw')return e.units.filter(u=>alive(u)&&!u.hidden&&opposing(unit).includes(u.side)&&distance(u,unit)<=(action==='strike'?1:3)).map(u=>({x:u.x,y:u.y,unitId:u.id,label:u.name}));
  if(action==='assist')return e.units.filter(u=>alive(u)&&['ally','neutral'].includes(u.side)&&distance(u,unit)<=1).map(u=>({x:u.x,y:u.y,unitId:u.id,label:u.name}));
  if(action==='order'||action==='formation')return e.units.filter(u=>alive(u)&&u.side==='ally'&&!u.ordered).map(u=>({x:u.x,y:u.y,unitId:u.id,label:u.name}));
  return [{x:unit.x,y:unit.y,unitId:unit.id}];
}
export function previewBattle(state,command) {
  const e=state.encounter,unit=e.units.find(u=>u.id===command.unitId),action=command.action;
  if(!battleActions(state,unit).includes(action))return result(false,'That action is unavailable or has already been spent this turn.');
  const target=battleTargets(state,unit,action).find(p=>p.x===command.x&&p.y===command.y&&(!command.targetId||p.unitId===command.targetId));if(!target)return result(false,'Choose a highlighted legal target.');
  const other=e.units.find(u=>u.id===(command.targetId??target.unitId));
  if(action==='formation'&&!['line','shield-wall','wedge'].includes(command.formation??'shield-wall'))return result(false,'Choose line, shield-wall, or wedge.');
  if(['order','formation'].includes(action)&&!['advance','attack','hold','rally'].includes(command.orderAction??'advance'))return result(false,'Choose advance, attack, hold, or rally for the order.');
  if(command.destination&&(!Number.isInteger(command.destination.x)||!Number.isInteger(command.destination.y)||!reachable(e,other).some(p=>p.x===command.destination.x&&p.y===command.destination.y)))return result(false,'The ordered destination must be within the ally’s normal movement allowance.');
  const orderEffect={advance:command.destination?`advance toward tile ${command.destination.x+1}, ${command.destination.y+1}, then strike an enemy in reach`:'advance toward the objective, then strike an enemy in reach',attack:'advance toward the nearest enemy, then strike if in reach',hold:'stay in position and brace; this ends the ally’s movement and action',rally:'restore 20 of the ally’s own morale; this ends their movement and action'}[command.orderAction??'advance'];
  const messages={move:`Move to ${command.x+1}, ${command.y+1}. Costs this unit’s movement.`,deploy:'Deploy the command unit before the first clash. Uses this turn’s movement.',strike:`Strike ${other?.name} for ${other?damagePreview(e,unit,other):0} damage. Flanking ignores frontal defence; high ground and walls reduce damage.`,throw:`Throw one javelin at ${other?.name} for ${other?damagePreview(e,unit,other,true):0} damage; ${Math.max(0,unit.ammo-1)} remain.`,brace:'Brace the shield: reduce incoming damage by 2 until your next turn. Costs one action.',assist:`Shield ${other?.name}, restore 3 health, and escort wounded survivors toward the standard. Costs one action.`,scout:'Reveal every hidden enemy and a safe path to the standard. Costs one action.',rally:'Restore 25 morale and 2 health to your unit and allies within 3 tiles. Costs one action.',order:`Spend 1 command to override ${other?.name}’s announced intent: ${orderEffect}. Their normal move and action limits still apply.`,formation:`Spend 1 command: ${command.formation??'shield-wall'} affects an adjacent group of up to 3 allies. Each will ${orderEffect}. Each moves at most once and acts at most once; overlapping orders cannot repeat actions.`};
  return result(true,(messages[action]??action)+(['order','formation'].includes(action)?` Tactic: ${command.orderAction??'advance'}.`:''));
}
export function applyBattle(state,command) {
  const checked=previewBattle(state,command);if(!checked.ok)return checked;
  const e=state.encounter,unit=e.units.find(u=>u.id===command.unitId),action=command.action,target=e.units.find(u=>u.id===command.targetId)||unitAt(e,command.x,command.y);
  if(action==='move'||action==='deploy'){unit.facing=command.x>unit.x?'east':command.x<unit.x?'west':command.y>unit.y?'south':'north';unit.x=command.x;unit.y=command.y;unit.moved=true;}
  else if(action==='strike'||action==='throw'){if(action==='throw')unit.ammo--;const damage=damagePreview(e,unit,target,action==='throw');target.hp=Math.max(0,target.hp-damage);unit.acted=true;note(e,`${unit.name} hits ${target.name} for ${damage}${target.hp===0?' — withdrawn from the field':''}.`);}
  else if(action==='brace'){unit.braced=true;unit.acted=true;}
  else if(action==='assist'){target.hp=Math.min(target.maxHp,target.hp+3);target.braced=true;target.escorted=true;unit.acted=true;}
  else if(action==='scout'){e.units.forEach(u=>u.hidden=false);e.scouted=true;unit.acted=true;}
  else if(action==='rally'){e.units.filter(u=>['ally','player','neutral'].includes(u.side)&&alive(u)&&distance(unit,u)<=3).forEach(u=>{u.morale=clamp(u.morale+25);u.hp=Math.min(u.maxHp,u.hp+2);});unit.acted=true;}
  else if(action==='order'){e.commandsLeft--;target.ordered=true;actAlly(e,target,command.orderAction??'advance',command.destination);}
  else if(action==='formation') {e.commandsLeft--;const group=[target,...e.units.filter(u=>u.side==='ally'&&u.id!==target.id&&alive(u)&&distance(u,target)<=1&&!u.ordered)].slice(0,3);group.forEach(u=>{u.formation=command.formation??'shield-wall';if(u.formation==='shield-wall')u.braced=true;u.ordered=true;actAlly(e,u,command.orderAction??'advance');});note(e,`${group.length} units form ${command.formation??'shield-wall'}; one command spent.`);}
  if(!e.usedAbilities.includes(action))e.usedAbilities.push(action);state.capabilityUse[action]=true;note(e,checked.message);checkBattle(state);return checked;
}
function actAlly(e,unit,orderAction=null,destination=null) {
  if(!alive(unit))return;const enemies=e.units.filter(u=>u.side==='enemy'&&alive(u)&&!u.hidden).sort((a,b)=>distance(unit,a)-distance(unit,b));const target=enemies[0];
  if(unit.morale<=15){unit.intent='Morale broken: await Rally or withdraw toward the commander.';unit.braced=true;unit.acted=true;return;}
  if(orderAction==='hold'){unit.braced=true;unit.moved=true;unit.acted=true;return;}
  if(orderAction==='rally'){unit.morale=clamp(unit.morale+20);unit.acted=true;unit.moved=true;return;}
  if(!target&&orderAction!=='advance'){unit.braced=true;unit.acted=true;unit.intent='The nearby threats are gone. Hold this ground and leave the rally path clear.';return;}
  const defending=['defend','siege','standoff'].includes(e.type),goal=defending?e.goal:target??e.goal;
  if(!unit.moved)stepToward(e,unit,destination??(orderAction==='advance'?e.goal:orderAction==='attack'?target??e.goal:goal));
  const range=unit.role==='archer'?3:1;const inRange=e.units.filter(u=>u.side==='enemy'&&alive(u)&&!u.hidden&&distance(unit,u)<=range).sort((a,b)=>a.hp-b.hp)[0];
  if(!unit.acted&&inRange){const damage=damagePreview(e,unit,inRange,range>1);inRange.hp=Math.max(0,inRange.hp-damage);unit.acted=true;note(e,`${unit.name} strikes ${inRange.name} for ${damage}.`);}
  if(!unit.acted&&defending){unit.braced=true;unit.acted=true;}unit.intent=defending?'Hold near the standard; brace if no target is in reach.':'Move toward the nearest threat; attack if in reach.';
}
export function endBattleTurn(state) {
  const e=state.encounter;
  e.units.filter(u=>u.side==='ally').forEach(u=>actAlly(e,u));
  const hero=e.units.find(u=>u.id==='hero');
  for(const enemy of e.units.filter(u=>u.side==='enemy'&&alive(u))) {
    if(enemy.hidden&&!e.scouted&&distance(enemy,hero)>2)continue;
    enemy.hidden=false;
    if(e.type==='standoff'&&e.turn%2===0&&e.defections<Math.floor(e.turn/2)&&e.defections<3){if(e.units.filter(u=>['ally','player'].includes(u.side)&&alive(u)).length<8){enemy.side='ally';enemy.name='Defecting cohort';enemy.hp=Math.max(enemy.hp,8);}else{enemy.hp=0;enemy.defected=true;}e.defections++;note(e,'A rival cohort lowers its shield and abandons the claimant.');continue;}
    const targets=e.units.filter(u=>alive(u)&&['player','ally'].includes(u.side)).sort((a,b)=>distance(enemy,a)-distance(enemy,b)||(a.hp-b.hp));const target=targets[0];if(!target)continue;
    const range=enemy.role==='archer'?3:1;
    if(distance(enemy,target)>range)stepToward(e,enemy,target);
    if(distance(enemy,target)<=range){const damage=damagePreview(e,enemy,target,range>1);target.hp=Math.max(0,target.hp-damage);target.morale=clamp(target.morale-(state.chapter>=6?15:8));note(e,`${enemy.name} hits ${target.name} for ${damage}.`);}
    if(enemy.role==='cavalry'&&e.terrain[enemy.y][enemy.x]==='sand'){enemy.hp=Math.max(1,enemy.hp-1);enemy.morale-=6;}
    if(['defend','siege','standoff'].includes(e.type)&&distance(enemy,e.goal)<=1){e.defence-=8;note(e,'Enemy pressure damages the defended line (−8).');}
  }
  const escort=e.units.find(u=>u.id==='escort');if(escort&&escort.escorted&&alive(escort)&&distance(escort,hero)<=4)stepToward(e,escort,e.goal,2);
  if(e.turn>=4&&e.turn%3===1&&e.type!=='training'&&e.type!=='standoff'&&e.turn<=7){const occupied=unitAt(e,7,0);if(!occupied){e.units.push(makeUnit(`reinforce${e.turn}`,'Flanking raiders','enemy',7,0,{hp:7,damage:3,move:2,role:'infantry'}));note(e,'A raiding party enters from the north road.');e.reinforcements++;}}
  checkBattle(state,true);if(e.status==='active'){e.turn++;e.commandsLeft=e.commandCapacity;for(const u of e.units){u.moved=false;u.acted=false;u.ordered=false;u.braced=false;}note(e,`Turn ${e.turn}. ${e.commandsLeft} commands available.`);}
  return result(true,e.status==='active'?'The enemy turn ends.':e.status==='won'?'Objective secured. Commit the encounter to preserve its rewards.':'The mission failed. Retry restores the complete encounter-start checkpoint.');
}
export function checkBattle(state,atTurnEnd=false) {
  const e=state.encounter,hero=e.units.find(u=>u.id==='hero');if(e.status!=='active')return;
  if(!alive(hero)||e.defence<=0){e.status='lost';note(e,!alive(hero)?'The commander falls. The force cannot continue.':'The defended line breaks.');return;}
  const required=e.requiredAbility,used=ability=>e.usedAbilities.includes(ability)||(['prepare','stratagem','allocate','negotiate','judge'].includes(ability)&&state.chapterCapabilities[state.chapter]?.includes(ability));
  const capable=(!required||used(required))&&(e.requiredAbilities??[]).every(used);const escorts=e.units.filter(u=>u.role==='escort'),nearGoal=distance(hero,e.goal)<=1;
  let objective=false;
  if(e.type==='training')objective=['move','strike','brace','throw'].every(used);
  else if(e.type==='rescue')objective=used('assist')&&escorts.every(u=>u.escorted&&distance(u,e.goal)<=1)&&nearGoal;
  else if(e.type==='recover')objective=used('scout')&&nearGoal;
  else if(['escort','retreat'].includes(e.type))objective=escorts.every(u=>distance(u,e.goal)<=1)&&nearGoal;
  else if(['defend','siege'].includes(e.type))objective=e.defence>0;
  else if(e.type==='standoff')objective=e.defence>0&&used('rally')&&(e.defections>=2||e.units.every(u=>u.side!=='enemy'||!alive(u)));
  else objective=e.units.every(u=>u.side!=='enemy'||!alive(u));
  if(atTurnEnd&&e.turn>=e.minimumTurns&&objective&&capable){e.status='won';note(e,'The chapter objective is secured.');}
  else if(atTurnEnd&&e.turn>=e.turnLimit){e.status='lost';note(e,`Time ran out. ${!capable?`Required capability: ${required}.`:!objective?'The objective was not completed.':''}`);}
}


