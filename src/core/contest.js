import {alive, clamp, distance, makeUnit, note, reachable, result, stepToward, unitAt} from './shared.js';

export const CONTEST_RULES={stanceMin:-6,stanceMax:6,commitment:3,persuade:2,address:3,addressCooldown:3,denounce:4,rebut:4,promise:5,promiseLimit:2,threaten:4};
export function createContest(state,data,options={}) {
  const c=state.chapter,e={id:data.id,kind:'contest',title:data.title,objective:data.objective,type:data.type,width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill('chamber')),units:[],turn:1,turnLimit:data.turnLimit??(c===7?8:10),status:'active',commandsLeft:0,commandCapacity:0,log:[],usedAbilities:[],goal:{x:4,y:3},requiredAbility:data.requiredAbility,promises:[],hardened:[],cooldowns:{},staged:{meters:{army:0,political:0,public:0},supplies:0,obligations:[]},fallback:options.fallback??false};
  e.units.push(makeUnit('hero',state.name,'player',1,3,{hp:12,resolve:12,maxResolve:12,move:3,role:'speaker',vote:'for'}));
  e.units.push(makeUnit('speaker-ally',c===7?'Veteran quartermaster':state.decisions.ch8==='families'?'Dacian delegate':'Provincial advocate','ally',1,5,{hp:10,resolve:10,maxResolve:10,move:3,role:'speaker',vote:'for'}));
  e.units.push(makeUnit('rival-speaker',c>=11?'Crispus’s advocate':'Court opposition speaker','enemy',7,3,{hp:10,resolve:10,maxResolve:10,move:3,role:'speaker',vote:'against',intent:'Lobby wavering members; attack nearby speakers on alternating turns.'}));
  e.units.push(makeUnit('elder-speaker','Old-order spokesman','enemy',5,7,{hp:10,resolve:10,maxResolve:10,move:3,role:'speaker',vote:'against',intent:'Defend the old order and its wavering votes.'}));
  const blocs=['Veterans','Landholders','Civic'];
  for(let i=0;i<9;i++){const bloc=blocs[i%3];const value=bloc==='Veterans'?state.meters.army:bloc==='Landholders'?state.meters.political:state.meters.public;
    e.units.push(makeUnit(`member${i}`,`${bloc} delegate ${Math.floor(i/3)+1}`,'neutral',2+(i%3)*2,1+Math.floor(i/3)*2,{hp:1,role:'voter',bloc,stance:Math.min(1,Math.floor(value/35))-(i===4?1:0),vote:null}));
  }
  if(options.fallback) e.units.filter(u=>u.bloc==='Landholders').forEach(u=>u.stance=3);
  e.electorate=e.units.length;e.majority=Math.floor(e.electorate/2)+1;
  note(e,`${e.majority} of ${e.electorate} votes required at the end of turn ${e.turnLimit}. An early majority does not end the debate; a tie fails.`);
  return e;
}
export function votes(e){return {for:e.units.filter(u=>u.vote==='for'||(u.role==='voter'&&u.stance>=1)).length,against:e.units.filter(u=>u.vote==='against'||(u.role==='voter'&&u.stance<1)).length,total:e.electorate,majority:e.majority};}
export function shiftedStance(member,delta){const opposed=member.stance<=-3&&delta>0,support=member.stance>=3&&delta<0;return clamp(member.stance+(opposed||support?Math.sign(delta)*Math.max(1,Math.ceil(Math.abs(delta)/2)):delta),-6,6);}
export function contestActions(state,unit){const e=state.encounter,c=state.chapter;if(!unit||!alive(unit)||!['player','ally'].includes(unit.side)||e.status!=='active')return [];
  const actions=[];if(!unit.moved)actions.push('move');if(!unit.acted){actions.push('persuade');if(c>=8)actions.push('promise','threaten');if(c>=10){if(!e.cooldowns[`${unit.id}:address`]||e.cooldowns[`${unit.id}:address`]<=e.turn)actions.push('address');actions.push('rebut');}if(c>=11)actions.push('record','denounce');}return actions;}
export function contestTargets(state,unit,action){const e=state.encounter;if(action==='move')return reachable(e,unit,3);if(action==='address')return [{x:unit.x,y:unit.y,unitId:unit.id}];
  let targets=[];
  if(['persuade','promise','threaten','record'].includes(action)){const range=action==='persuade'?1:action==='record'?3:2;targets=e.units.filter(u=>u.role==='voter'&&distance(u,unit)<=range);if(action==='promise')targets=targets.filter(u=>!e.promises.includes(u.id)&&e.promises.length<2);}
  if(action==='denounce')targets=e.units.filter(u=>u.role==='speaker'&&u.side==='enemy'&&alive(u)&&distance(u,unit)<=3);
  if(action==='rebut')targets=e.units.filter(u=>u.role==='speaker'&&alive(u)&&distance(u,unit)<=3);
  return targets.map(u=>({x:u.x,y:u.y,unitId:u.id,label:u.name}));}
export function speechStrength(state,action,target){const e=state.encounter;return action==='persuade'?2:action==='promise'?5:action==='threaten'?4-(e.hardened.includes(target?.bloc)?1:0):action==='record'?Math.min(5,2+Math.floor(state.completed.filter(c=>c<=9).length/3)):3;}
export function previewContest(state,command){const e=state.encounter,unit=e.units.find(u=>u.id===command.unitId),action=command.action;if(!contestActions(state,unit).includes(action))return result(false,'That speaker has spent this action, withdrawn, or has not learned that ability.');
  const point=contestTargets(state,unit,action).find(p=>p.x===command.x&&p.y===command.y&&(!command.targetId||command.targetId===p.unitId));if(!point)return result(false,'Choose a highlighted legal target. Promises are limited to two, once per recipient.');
  const target=e.units.find(u=>u.id===point.unitId),strength=speechStrength(state,action,target);
  if(action==='move')return result(true,`Move speaker to ${command.x+1}, ${command.y+1}; one movement, up to three tiles.`);
  if(action==='address'){const members=e.units.filter(u=>u.role==='voter'&&distance(u,unit)<=3);return result(true,`Address ${members.length} nearby members: +3 stance each (commitment resists reversal). Speech spent; available again on turn ${e.turn+3}.`);}
  if(action==='denounce')return result(true,`Denounce ${target.name}: −4 Resolve (${target.resolve} → ${Math.max(0,target.resolve-4)}). A withdrawn speaker keeps their vote.`);
  if(action==='rebut')return result(true,target.side==='enemy'?`Blunt ${target.name}’s next speech by half.`:`Restore 4 Resolve to ${target.name} (${target.resolve} → ${Math.min(target.maxResolve,target.resolve+4)}).`);
  const next=shiftedStance(target,strength),extra=action==='promise'?` Obligation: give ${target.bloc} two grain convoys at accession; honour costs 2 supplies, break costs 8 Public Confidence and 4 Political Backing. ${e.promises.length+1}/2 Promises used.`:action==='threaten'?` Costs 3 Public Confidence; other ${target.bloc} members lose 1 stance and the bloc resists later threats.`:'';
  return result(true,`${action==='record'?'Invoke your military record':action[0].toUpperCase()+action.slice(1)}: ${target.name} stance ${target.stance} → ${next}.${extra} Costs one speech.`);
}
export function applyContest(state,command){const checked=previewContest(state,command);if(!checked.ok)return checked;const e=state.encounter,unit=e.units.find(u=>u.id===command.unitId),target=e.units.find(u=>u.id===command.targetId)||unitAt(e,command.x,command.y),action=command.action;
  if(action==='move'){unit.x=command.x;unit.y=command.y;unit.moved=true;}
  else {unit.acted=true;if(action==='address'){e.units.filter(u=>u.role==='voter'&&distance(u,unit)<=3).forEach(u=>u.stance=shiftedStance(u,3));e.cooldowns[`${unit.id}:address`]=e.turn+3;}
    else if(action==='denounce'){target.resolve=Math.max(0,target.resolve-4);target.hp=target.resolve;}
    else if(action==='rebut'){if(target.side==='enemy')target.blunted=true;else{target.resolve=Math.min(target.maxResolve,target.resolve+4);target.hp=target.resolve;}}
    else {target.stance=shiftedStance(target,speechStrength(state,action,target));if(action==='promise'){e.promises.push(target.id);e.staged.obligations.push({id:`${e.id}:${target.id}`,to:target.bloc,promise:'Provide two grain convoys for this bloc at accession.',due:12,cost:2,consequence:'Honour: −2 supplies. Break: −8 Public Confidence, −4 Political Backing.',status:'open'});}if(action==='threaten'){e.staged.meters.public-=3;e.units.filter(u=>u.role==='voter'&&u.bloc===target.bloc&&u.id!==target.id).forEach(u=>u.stance=shiftedStance(u,-1));if(!e.hardened.includes(target.bloc))e.hardened.push(target.bloc);}}}
  if(!e.usedAbilities.includes(action))e.usedAbilities.push(action);state.capabilityUse[action]=true;note(e,checked.message);return checked;
}
export function endContestTurn(state){const e=state.encounter;
  for(const enemy of e.units.filter(u=>u.side==='enemy'&&u.role==='speaker'&&alive(u))){const speakers=e.units.filter(u=>['player','ally'].includes(u.side)&&u.role==='speaker'&&alive(u)).sort((a,b)=>distance(enemy,a)-distance(enemy,b)||a.resolve-b.resolve),members=e.units.filter(u=>u.role==='voter').sort((a,b)=>Math.abs(a.stance-1)-Math.abs(b.stance-1)||distance(enemy,a)-distance(enemy,b));
    const attacking=e.turn%2===0&&speakers[0]&&distance(enemy,speakers[0])<=5,target=attacking?speakers[0]:members.find(u=>u.stance>=0)??members[0];if(!target)continue;const range=attacking?3:1;if(distance(enemy,target)>range)stepToward(e,enemy,target,3);
    if(distance(enemy,target)<=range){const strength=enemy.blunted?1:attacking?3:2;if(attacking){target.resolve=Math.max(0,target.resolve-strength);target.hp=target.resolve;note(e,`${enemy.name} attacks ${target.name}’s Resolve (−${strength}).`);}else{target.stance=shiftedStance(target,-strength);note(e,`${enemy.name} shifts ${target.name} against the motion (−${strength}).`);}enemy.blunted=false;}
  }
  if(e.turn>=e.turnLimit){const tally=votes(e),required=e.requiredAbility,qualified=(!required||e.usedAbilities.includes(required)||(['negotiate','judge','allocate'].includes(required)&&state.chapterCapabilities[state.chapter]?.includes(required)))&&(e.requiredAbilities??[]).every(a=>e.usedAbilities.includes(a)||state.chapterCapabilities[state.chapter]?.includes(a));e.status=tally.for>=e.majority&&qualified?'won':'lost';note(e,`Deadline vote: ${tally.for} for, ${tally.against} against; ${e.majority} needed. ${!qualified?`A required chapter capability was not demonstrated: ${(e.requiredAbilities??[required]).join(', ')}.`:e.status==='won'?'The motion passes.':'The status quo prevails.'}`);}
  else{e.turn++;e.units.forEach(u=>{u.moved=false;u.acted=false;});note(e,`Turn ${e.turn}. Vote in ${e.turnLimit-e.turn+1} turns. Current support: ${votes(e).for}/${e.electorate}.`);}
  return result(true,e.status==='active'?'Rival speakers have replied.':e.status==='won'?'The vote is won. Commit the result.':'The motion failed. Retry, or accept a patron-backed re-run with a major Obligation.');
}
