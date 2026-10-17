import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as G from '../src/core/game.js';
import {createBattle,combatBreakdown,damagePreview,planBattleUnit,applyBattle,endBattleTurn,previewBattle} from '../src/core/battle.js';
import {makeUnit,clone,reachable,movementPinned,distance} from '../src/core/shared.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {combatDiagnostics} from '../scripts/combat-diagnostic.mjs';
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
// Deliberately injected small geometry isolates decisions; it is not campaign progress.
function board(units,{chapter=5,mode='clear',goal={x:6,y:3}}={}){const s=G.newGame('Injected tactical fixture',17);s.chapter=chapter;s.phase='encounter';s.encounter={id:'combat-unit-fixture',kind:'battle',combatVersion:2,type:'battle',width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill('grass')),units,turn:1,turnLimit:14,status:'active',log:[],usedAbilities:[],commandsLeft:3,commandCapacity:3,goal,defence:100,mission:{mode,points:[],waves:[],escortIds:[],holdRequired:4,holdProgress:0,rallyProgress:0,envoyProgress:0}};return s;}
const u=(id,side,x,y,extra={})=>makeUnit(id,id,side,x,y,{hp:20,damage:5,ammo:0,move:2,facing:side==='enemy'?'west':'east',lastMoveDistance:0,...extra});

test('Scored plans and exact modifier previews are pure, legal and deterministic',()=>{
 const s=board([u('hero','player',1,3),u('ally','ally',1,2),u('bow','enemy',4,3,{role:'archer'})]),e=s.encounter,before=clone(e);freeze(e);const random=Math.random;Math.random=()=>{throw Error('AI consumed random state');};
 try{const first=planBattleUnit(e,e.units[2]),again=planBattleUnit(e,e.units[2]);assert.deepEqual(first,again);assert.ok(reachable(e,e.units[2]).concat(e.units[2]).some(p=>p.x===first.x&&p.y===first.y));const hit=combatBreakdown(e,e.units[0],e.units[2]);assert.equal(hit.damage,Math.max(1,hit.base+hit.modifiers.reduce((n,m)=>n+m.value,0)));assert.ok(first.intent.length>10);}finally{Math.random=random;}assert.deepEqual(e,before);
});
test('Engagement stops movement through a visible melee screen but allows retreat and ignores hidden/ranged units',()=>{
 const s=board([u('hero','player',0,3,{move:4}),u('foe','enemy',2,3)]),e=s.encounter,h=e.units[0];assert.equal(movementPinned(e,h,{x:1,y:3}),true);assert.equal(reachable(e,h).some(p=>p.x===3&&p.y===3),false);h.x=1;assert.ok(reachable(e,h).some(p=>p.x===0&&p.y===3));e.units[1].hidden=true;assert.equal(movementPinned(e,h,{x:1,y:3}),false);e.units[1].hidden=false;e.units[1].role='archer';assert.equal(movementPinned(e,h,{x:1,y:3}),false);delete e.combatVersion;e.units[1].role='infantry';assert.equal(movementPinned(e,h,{x:1,y:3}),false);
});
test('Archers use height/range, cavalry seek flanks, and guards defend their anchor',()=>{
 const s=board([u('hero','player',3,3),u('bow','enemy',4,3,{role:'archer'})]),e=s.encounter;e.terrain[3][6]='high';const archer=planBattleUnit(e,e.units[1]);assert.ok(distance(archer,e.units[0])>=2);assert.equal(archer.action,'throw');assert.equal(e.terrain[archer.y][archer.x],'high');
 const horse=u('horse','enemy',5,3,{role:'cavalry',move:3}),flank=planBattleUnit({...e,terrain:Array.from({length:8},()=>Array(8).fill('grass')),units:[e.units[0],horse]},horse);assert.equal(combatBreakdown(e,{...horse,...flank},e.units[0]).aspect,'flank');
 const guard=u('guard','enemy',7,6,{role:'guard',anchor:{x:7,y:6}}),hold=planBattleUnit({...e,units:[{...e.units[0],x:0,y:0},guard]},guard);assert.ok(distance(hold,guard.anchor)<=1);assert.equal(hold.action,'brace');
});
test('Enemy decisions do not inspect hidden targets and extraction allies value their convoy',()=>{
 const hero=u('hero','player',0,0,{hidden:true}),raider=u('raid','enemy',6,5,{role:'raider'}),escort=u('escort','neutral',3,5,{role:'escort',escorted:true}),ally=u('ally','ally',2,5),s=board([hero,raider,escort,ally],{mode:'extract'}),e=s.encounter;e.mission.escortIds=['escort'];const p=planBattleUnit(e,raider);assert.notEqual(p.targetId,'hero');const a=planBattleUnit(e,ally);assert.ok(distance(a,escort)<=2,'Escort screening remains a useful goal');
});
test('Cohesive formations protect the front and ranged lane without making isolated units invulnerable',()=>{
 const a=u('hero','player',2,3,{damage:7}),b=u('target','enemy',3,3,{facing:'west',formation:'shield-wall',braced:true}),c=u('friend','enemy',3,4,{formation:'shield-wall'}),e=board([a,b,c]).encounter;
 const together=damagePreview(e,a,b);c.x=6;assert.equal(damagePreview(e,a,b),together+1);c.x=3;const side=combatBreakdown(e,{...a,x:3,y:2},b);assert.equal(side.aspect,'flank');assert.ok(!side.modifiers.some(m=>m.label==='Cohesive shield wall'));
 b.formation=c.formation='line';assert.ok(combatBreakdown(e,a,b,true).modifiers.some(m=>m.label==='Line ranged screen'));c.hp=0;assert.ok(!combatBreakdown(e,a,b,true).modifiers.some(m=>m.label==='Line ranged screen'));
 a.formation='wedge';const firm=damagePreview(e,a,b);e.terrain[a.y][a.x]='marsh';assert.equal(damagePreview(e,a,b),firm-1);
});
test('Mounted charge needs displacement and clear terrain; low morale has a visible bounded penalty',()=>{
 const a=u('horse','player',2,3,{role:'cavalry',lastMoveDistance:2}),b=u('foe','enemy',3,3,{facing:'east'}),e=board([a,b]).encounter,charge=damagePreview(e,a,b);a.lastMoveDistance=0;assert.equal(damagePreview(e,a,b),charge-1);a.lastMoveDistance=2;e.terrain[3][2]='ford';assert.equal(damagePreview(e,a,b),charge-1);a.morale=20;assert.ok(combatBreakdown(e,a,b).modifiers.some(m=>m.label==='Shaken morale'&&m.value===-1));
});
test('Legal strikes lower enemy morale by the exact preview and broken troops regroup on either side',()=>{
 const s=board([u('hero','player',2,3),u('foe','enemy',3,3,{facing:'east'}),u('ally','ally',0,1,{morale:5})]),e=s.encounter,h=e.units[0],target=e.units[1],payload={unitId:'hero',action:'strike',x:3,y:3,targetId:'foe'};const preview=previewBattle(s,payload);assert.match(preview.message,/morale −12/);assert.ok(applyBattle(s,payload).ok);assert.equal(target.morale,68);target.morale=5;endBattleTurn(s);assert.ok(target.morale>=20);assert.ok(e.units[2].morale>=20);assert.equal(h.acted,false);
});
test('Withdrawal and cohesive group orders consume one command and cannot act again during the NPC phase',()=>{
 const s=board([u('hero','player',0,3),u('ally','ally',3,3),u('foe','enemy',5,3)]),e=s.encounter,a=e.units[1],payload={unitId:'hero',action:'order',x:a.x,y:a.y,targetId:a.id,orderAction:'withdraw'};
 const enemyHP=e.units[2].hp;assert.ok(applyBattle(s,payload).ok);assert.equal(e.commandsLeft,2);assert.equal(a.acted,true);assert.equal(a.moved,true);assert.equal(a.braced,true);assert.ok(a.x<3);assert.equal(e.units[2].hp,enemyHP);const position={x:a.x,y:a.y};endBattleTurn(s);assert.equal(a.x,position.x);assert.equal(a.y,position.y);
});
test('Objective occupation damages integrity once per round; a friendly screen prevents automatic damage',()=>{
 for(const defended of [false,true]){const h=u('hero','player',defended?2:0,defended?3:0,{hp:40}),enemies=[u('e1','enemy',3,3,{damage:1}),u('e2','enemy',2,4,{damage:1})],s=board([h,...enemies],{mode:'hold',goal:{x:2,y:3}});endBattleTurn(s);assert.equal(s.encounter.defence,defended?100:90);assert.equal(s.encounter.mission.holdProgress,0);}
});
test('Frozen v0.6 active mission reproduces its exact next turn and exact retry layout after migration',async()=>{
 const f=JSON.parse(await readFile(new URL('./compatibility/combat-v1-checkpoint.json',import.meta.url),'utf8')),state=G.deserialize(JSON.stringify(f.before));assert.equal(state.encounter.combatVersion,undefined);assert.equal(state.encounterOptions.combatVersion,1);
 for(const cmd of f.commands)assert.ok(G[cmd.kind](state,...cmd.args).ok);assert.deepEqual(state.encounter,f.after.encounter);assert.equal(state.rng,f.after.rng);
 assert.ok(G.retry(state).ok);assert.deepEqual(state.encounter,f.start.encounter);assert.equal(state.rng,f.start.rng);assert.equal(state.encounterOptions.combatVersion,1);
});
test('Seeded tactical policy has a measurable objective advantage; direct opening policy remains viable',async()=>{
 const report=await combatDiagnostics({seeds:[17,275,913]}),{simple,tactical}=report.summaries;assert.ok(tactical.wins>=simple.wins);assert.ok(tactical.meanRemainingStrength>simple.meanRemainingStrength||tactical.wins>simple.wins);assert.equal(report.runs.filter(r=>r.encounter==='ch1-road'&&r.policy==='simple'&&r.status==='won').length,3);assert.ok(report.runs.every(r=>r.objectiveFraction>=0&&r.objectiveFraction<=1));
});
