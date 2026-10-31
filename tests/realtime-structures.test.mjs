import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {createWorld,commandProblem,queueCommand,restoreWorld,snapshotWorld,step,worldHash} from '../src/core/realtime/simulation.js';
import {closeFortifiedGate,heldAgainst,installFortifications} from '../src/core/realtime/fortifications.js';
import {fieldVerb,openGate,useFieldObject} from '../src/core/realtime/field-objects.js';
import {clearLine,findRoute,groundHeight,navGrid,speedFactor} from '../src/core/realtime/navigation.js';
import {blowSetup} from '../src/core/realtime/combat.js';
import {missileRange} from '../src/core/realtime/abilities.js';
import {noticeRate} from '../src/core/realtime/ai.js';
import {coverBetween} from '../src/core/realtime/sight.js';
import {squadModifiers} from '../src/core/realtime/squads.js';
import {validateWorld} from '../src/core/realtime/validate.js';
import {BATTLE_STRUCTURES} from '../src/data/battle-structures.js';
import {STRUCTURES} from '../src/data/structures.js';
import {ROMAN_SQUADS} from '../src/data/realtime-squads.js';

// Release 4's structures in real time (worlds and gameplay plan): towers, gates
// that are barred and battered, ramparts with ditches, bridges that can be
// demolished, and where each battle's works stand. Authored placements are
// checked on battles reached by legal commands; the rules on labelled small
// fields, which prove the rules and claim no campaign result.
const fail=message=>{throw new Error(message);};
const camps=new Map();let campaign;
function battle(id){
  campaign??=runCommandCampaign({featureEdition:35,onCheckpoint:s=>{const e=G.getChapter(s).encounters[s.encounterIndex];if(!camps.has(e.id))camps.set(e.id,G.serialize(s));}});
  const s=G.deserialize(camps.get(id));assert.equal(G.startEncounter(s,{controls:'realtime'}).ok,true,id);return {state:s,world:G.realtimeWorld(s)};
}
const centre=([x,y])=>({x:(x+.5)*2.5,z:(y+.5)*2.5});
const key=([x,y])=>`${x},${y}`;

test('each battle’s works stand where battle-structures.js puts them, from legal checkpoints',()=>{
  for(const [id,spec]of Object.entries(BATTLE_STRUCTURES)){
    const {state,world:w}=battle(id),f=w.fortifications,g=navGrid(w.map);validateWorld(w,fail);
    assert.ok(f,`${id}: fortified`);
    assert.equal(f.platforms.length,(spec.towers??[]).length,`${id}: every authored tower is built`);
    assert.equal(w.objects.some(o=>o.id==='fort-wall'),!!spec.breach,`${id}: a breach only where authored`);
    assert.equal(f.ramparts.length,(spec.ramparts??[]).length,`${id}: every authored rampart is built`);
    if(spec.ramparts||spec.ditches)assert.ok(f.ditches.length>0,`${id}: its ditch is dug`);
    const taken=new Set(w.actors.map(a=>key([Math.floor(a.x/2.5),Math.floor(a.z/2.5)])));
    for(const p of f.platforms){
      assert.equal(groundHeight(g,centre([p.x,p.y]).x,centre([p.x,p.y]).z),STRUCTURES.tower.deck);
      assert.equal(groundHeight(g,centre(p.steps).x,centre(p.steps).z),STRUCTURES.tower.stair);
      assert.equal(findRoute(g,centre(p.steps),centre([p.x,p.y])).reasonCode,undefined,`${id}: the deck is reached by its stair`);
      assert.ok(!taken.has(key([p.x,p.y]))&&!taken.has(key(p.steps)),`${id}: no tower on a man`);
    }
    for(const r of f.ramparts)for(const c of r.cells){assert.equal(w.map.terrain[c[1]][c[0]],'high');assert.ok(!taken.has(key(c)));}
    for(const c of f.ditches){assert.equal(w.map.terrain[c[1]][c[0]],'ditch');assert.equal(speedFactor(g,centre(c).x,centre(c).z),.5);assert.ok(!taken.has(key(c)));}
    for(const gate of w.objects.filter(o=>o.kind==='gate'&&o.fortified))
      if(spec.gates?.holder==='enemy'&&gate.state==='closed'){assert.equal(gate.holder,'enemy');assert.equal(gate.integrity,120);assert.match(fieldVerb(gate),/^Batter gate/);}
      else assert.equal(gate.holder,null,`${id}: no other gate is held`);
    assert.equal(worldHash(G.realtimeWorld(G.deserialize(G.serialize(state)))),worldHash(w),`${id}: the works save and restore`);
  }
});

test('a rampart leaves the road through it open as a causeway, with no ditch across it',()=>{
  const {world:w}=battle('ch8-crossing'),f=w.fortifications,road=[];
  for(let y=0;y<w.map.height;y++)if(w.map.terrain[y][f.ramparts[0].cells[0][0]]==='road')road.push(y);
  assert.ok(road.length>0,'the road crosses the rampart’s line');
  const ditch=new Set(f.ditches.map(key));
  for(const y of road)assert.ok(!ditch.has(key([f.ramparts[0].cells[0][0]+1,y])),'no ditch in front of the causeway');
});

// --- Labelled small fields ---------------------------------------------------------------------
const man=(id,side,x,z,extra={})=>({id,name:id,side,at:[x,z],attributes:{str:12,agi:12,con:12,per:10,combat:6,field:6},kit:['tunic','gladius'],ai:false,...extra});
const mission={mode:'hold',goal:{x:30,z:25},radius:2,holdRequired:30,heldTicks:0,occupiedTicks:0,deadline:40,waves:[],escorts:[],points:[],required:[],defence:100,pressure:0};
const fieldRecord={landmark:'Wall',deadline:7,choice:null,outcome:'pending',escortPace:2,cavalryDenied:false,opportunities:{stores:{effect:'stores'},signal:{effect:'cohesion'}}};
// A wall down column 7 with one fortified gate in it at row 2, held against the soldier.
function gatedField({holder='enemy',squads=[]}={}){
  const terrain=Array.from({length:12},()=>Array.from({length:14},(_,x)=>x===7?'wall':'grass'));
  const w=createWorld({seed:51,map:{id:'gated',width:14,height:12,terrain},actors:[man('hero','player',16,6.25),man('guard','enemy',30,15)],mission,squads,
    objects:[{id:'gate',kind:'gate',name:'City gate',x:18.75,z:6.25,state:'closed',done:false,field:true,rounds:0,work_s:3,cells:[[7,2]],under:'grass'}]});
  w.chapter=9;w.encounterId='labelled-gate';w.field={...fieldRecord};installFortifications(w);
  const gate=w.objects[0];if(holder){gate.holder=holder;gate.integrity=STRUCTURES.gate.integrity+STRUCTURES.gate.bar;}
  return w;
}

test('a gate held against you is battered, never opened: by hand, faster with engineers near, and at 0 it is a breach',()=>{
  const w=gatedField(),hero=w.actors[0],gate=w.objects[0],through={x:25,z:6.25};validateWorld(w,fail);
  assert.ok(heldAgainst(gate));assert.equal(fieldVerb(gate),'Batter gate (120)');
  assert.ok(findRoute(navGrid(w.map),hero,through).reasonCode,'the shut gate stops the route');
  useFieldObject(w,hero,gate);assert.equal(gate.integrity,105);assert.equal(gate.state,'closed');
  hero.effects={engineering:true};useFieldObject(w,hero,gate);assert.equal(gate.integrity,75,'the engineers’ ram strikes twice as hard');
  validateWorld(restoreWorld(snapshotWorld(w)),fail);
  for(let i=0;i<3;i++)useFieldObject(w,hero,gate);
  assert.equal(gate.state,'breached');assert.equal(gate.integrity,0);assert.equal(w.map.terrain[2][7],'rubble');
  assert.equal(findRoute(navGrid(w.map),hero,through).reasonCode,undefined,'the breach is a passage for both armies');
  assert.equal(speedFactor(navGrid(w.map),18.75,6.25),.6);validateWorld(w,fail);
  const after=snapshotWorld(w);assert.equal(commandProblem(w,{actorId:'hero',kind:'interact',payload:{objectId:'gate'}}),'ALREADY_DONE');
  assert.equal(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:'gate'}}).ok,false);assert.equal(snapshotWorld(w),after,'a refused command changes nothing');
});

test('an engineer detail within 8 m is the ram; one further away is not',()=>{
  const near=gatedField({squads:[{id:'eng',name:'Engineers',side:'ally',role:'engineer',strength:12,maxStrength:12,at:[12,6.25],face:[1,0],member:ROMAN_SQUADS.engineer}]});
  useFieldObject(near,near.actors[0],near.objects[0]);assert.equal(near.objects[0].integrity,90);
  const far=gatedField({squads:[{id:'eng',name:'Engineers',side:'ally',role:'engineer',strength:12,maxStrength:12,at:[3,27],face:[1,0],member:ROMAN_SQUADS.engineer}]});
  useFieldObject(far,far.actors[0],far.objects[0]);assert.equal(far.objects[0].integrity,105);
});

test('closing a gate bars it for the side that closes it; opening it again unbars it',()=>{
  const w=gatedField({holder:null}),hero=w.actors[0],gate=w.objects[0];
  assert.equal(fieldVerb(gate),'Open gate');assert.equal(gate.integrity,100);
  openGate(w,gate,'hero');hero.x=12;
  assert.equal(closeFortifiedGate(w,gate,'hero'),true);assert.equal(gate.holder,'ally');assert.equal(gate.integrity,120);
  assert.equal(fieldVerb(gate),'Open gate','your own barred gate opens for you');
  assert.ok(heldAgainst(gate,w.actors.find(a=>a.id==='guard')),'and is held against the enemy');
  validateWorld(w,fail);useFieldObject(w,hero,gate);assert.equal(gate.state,'open');assert.equal(gate.holder,null);assert.equal(gate.integrity,100);
});

// A fortified footbridge over a river down column 7, already repaired.
function bridged(){
  const terrain=Array.from({length:12},()=>Array.from({length:14},(_,x)=>x===7?'river':'grass'));terrain[5][7]='ford';
  const w=createWorld({seed:52,map:{id:'bridged',width:14,height:12,terrain},actors:[man('hero','player',16,13.75)],mission,
    objects:[{id:'bridge',kind:'bridge',name:'Footbridge',x:18.75,z:13.75,state:'repaired',done:true,field:true,rounds:0,work_s:3,cells:[[7,5]]}]});
  w.chapter=8;w.encounterId='labelled-bridge';w.field={...fieldRecord};installFortifications(w);return w;
}

test('a repaired fortified bridge is demolished only by forced work, and then the crossing is deep water',()=>{
  const w=bridged(),hero=w.actors[0],bridge=w.objects[0],across={x:25,z:13.75};validateWorld(w,fail);
  assert.equal(bridge.toggle,true);assert.equal(fieldVerb(bridge),null);assert.equal(fieldVerb(bridge,{force:true}),'Demolish bridge (0/2)');
  const before=snapshotWorld(w),plain={actorId:'hero',kind:'interact',payload:{objectId:'bridge'}};
  assert.equal(commandProblem(w,plain),'ALREADY_DONE');assert.equal(queueCommand(w,plain).ok,false);assert.equal(snapshotWorld(w),before,'unforced use changes nothing');
  assert.equal(findRoute(navGrid(w.map),hero,across).reasonCode,undefined);
  assert.equal(queueCommand(w,{...plain,payload:{objectId:'bridge',force:true}}).ok,true);
  for(let i=0;i<200&&bridge.progress!==1;i++)step(w);
  assert.equal(bridge.progress,1);assert.equal(bridge.state,'repaired');validateWorld(restoreWorld(snapshotWorld(w)),fail);
  useFieldObject(w,hero,bridge,{force:true});assert.equal(bridge.state,'demolished');assert.equal(w.map.terrain[5][7],'river');
  assert.ok(findRoute(navGrid(w.map),hero,across).reasonCode,'the crossing is gone, for both armies');validateWorld(w,fail);
  const engineers=bridged();engineers.actors[0].effects={engineering:true};useFieldObject(engineers,engineers.actors[0],engineers.objects[0],{force:true});
  assert.equal(engineers.objects[0].state,'demolished','engineers demolish it in one work action');
});

test('bridge demolition reports its work total and resumes exactly without adding a saved work limit',()=>{
  const w=bridged(),command={actorId:'hero',kind:'interact',payload:{objectId:'bridge',force:true}};
  assert.equal(queueCommand(w,command).ok,true);
  for(let i=0;i<200&&w.objects[0].progress!==1;i++)step(w);
  assert.equal(w.objects[0].progress,1);
  assert.ok(w.log.some(e=>e.text==='hero works on Footbridge: 1 of 2 stages complete.'));
  assert.equal(Object.hasOwn(w.objects[0],'required'),false,'existing saves need no new field');
  const resumed=restoreWorld(snapshotWorld(w));validateWorld(resumed,fail);
  assert.equal(queueCommand(w,command).ok,true);assert.equal(queueCommand(resumed,command).ok,true);
  for(let i=0;i<200&&w.objects[0].state!=='demolished';i++){step(w);step(resumed);}
  assert.equal(w.objects[0].state,'demolished');assert.equal(worldHash(resumed),worldHash(w));
  assert.ok(w.log.some(e=>e.text==='hero demolishes Footbridge. The crossing is deep water again for both armies.'));
  assert.ok(w.log.every(e=>!e.text.includes('undefined')));

  const engineers=bridged();engineers.actors[0].effects={engineering:true};
  assert.equal(queueCommand(engineers,command).ok,true);
  for(let i=0;i<200&&engineers.objects[0].state!=='demolished';i++)step(engineers);
  assert.equal(engineers.objects[0].state,'demolished');
  assert.ok(engineers.log.some(e=>e.text==='hero demolishes Footbridge. The crossing is deep water again for both armies.'));
  assert.ok(engineers.log.every(e=>!e.text.includes('undefined')&&!e.text.includes('1 of 2')),'engineers finish in one action');
});

// The generic engineering position on a walled field: one platform (a tower) beside the wall.
function towered(){
  const terrain=Array.from({length:12},()=>Array.from({length:32},(_,x)=>x===7?'wall':'grass'));
  const w=createWorld({seed:53,map:{id:'towered',width:32,height:12,terrain},actors:[man('hero','player',5,15),man('guard','enemy',45,15)],mission,objects:[]});
  w.chapter=6;w.encounterId='labelled-tower';w.field={...fieldRecord};installFortifications(w);return w;
}

test('a tower’s deck sees 15 m further, throws 30% further, and hides what stands behind it',()=>{
  const w=towered(),p=w.fortifications.platforms[0],deck=centre([p.x,p.y]),[hero,guard]=w.actors;
  const ground={...deck,x:deck.x+5};assert.equal(groundHeight(navGrid(w.map),ground.x,ground.z),0);
  const target={...guard,x:deck.x+42,z:deck.z,moving:true,gait:'run'};
  Object.assign(hero,{x:ground.x,z:ground.z});const low=noticeRate(w,hero,target);
  Object.assign(hero,{x:deck.x,z:deck.z});const high=noticeRate(w,hero,target);
  assert.equal(low,0,'37 m from the ground is beyond sight (25 + Perception 10)');assert.ok(high>0,'from the deck, 42 m is within sight');
  assert.equal(missileRange(w,hero,'pilum',{x:deck.x+20,z:deck.z}),25*STRUCTURES.tower.range);
  const setup=blowSetup(w,hero,guard,{missile:'pilum',from:deck});assert.ok(setup.mods.some(m=>m.label==='From the tower'));
  const up=blowSetup(w,guard,hero,{missile:'pilum',from:{x:deck.x+10,z:deck.z}});assert.ok(up.mods.some(m=>m.label==='He holds the tower'));
  // A man at the tower's foot is hidden behind it from the far side at eye height.
  const foot={x:deck.x,z:deck.z-2.5},far={x:deck.x,z:deck.z+10};
  if(w.map.terrain[Math.floor(foot.z/2.5)][Math.floor(foot.x/2.5)]==='grass')assert.equal(coverBetween(w,far,foot),'tower');
});

test('missiles through a curtain are named for it, and a squad behind it is named too',()=>{
  const w=towered(),[hero,guard]=w.actors;Object.assign(hero,{x:15,z:20});Object.assign(guard,{x:22,z:20});
  const setup=blowSetup(w,guard,hero,{missile:'pilum',from:{x:22,z:20}});
  assert.ok(setup.mods.some(m=>m.label==='Behind the wall'&&m.value===-10));
});

// A rampart (column 7) facing east with its ditch (column 8), built as release 4's works are recorded.
function ramparted(){
  const terrain=Array.from({length:12},()=>Array.from({length:16},(_,x)=>x===7?'high':x===8?'ditch':'grass'));
  const cells=Array.from({length:12},(_,y)=>[7,y]),ditch=Array.from({length:12},(_,y)=>[8,y]);
  const elevations=[...cells.map(([x,y])=>[x,y,STRUCTURES.rampart.height]),...ditch.map(([x,y])=>[x,y,STRUCTURES.ditch.depth])];
  const w=createWorld({seed:54,map:{id:'ramparted',width:16,height:12,terrain,elevations},actors:[man('hero','player',18.75,15),man('guard','enemy',21.25,15)],mission,objects:[],
    squads:[{id:'line',name:'Line',side:'ally',role:'infantry',strength:16,maxStrength:16,at:[18.75,15],face:[1,0],member:ROMAN_SQUADS.infantry},
      {id:'foe',name:'Foe',side:'enemy',role:'infantry',strength:10,maxStrength:10,at:[30,15],face:[-1,0],member:ROMAN_SQUADS.infantry}]});
  w.fortifications={version:2,material:'timber',walls:[],platforms:[],ramparts:[{cells,face:'east'}],ditches:ditch,secured:[],revision:0};
  return w;
}

test('a rampart and its ditch: slow, climbable, higher, and its breastwork covers men on it from beyond its face',()=>{
  const w=ramparted(),g=navGrid(w.map),[hero,guard]=w.actors;validateWorld(w,fail);
  assert.equal(groundHeight(g,18.75,15),1.2);assert.equal(groundHeight(g,21.25,15),-.4);assert.equal(speedFactor(g,21.25,15),.5);
  assert.equal(clearLine(g,{x:21.25,z:15},{x:18.75,z:15}),true,'1.6 m from the ditch: a man can climb it');
  const melee=blowSetup(w,guard,hero);assert.ok(melee.mods.some(m=>m.label==='He holds the rampart'&&m.value===5),'the ditch puts the attacker 1.6 m below');
  const shot=blowSetup(w,guard,hero,{missile:'pilum',from:{x:30,z:15}});assert.ok(shot.mods.some(m=>m.label==='Behind the rampart'&&m.value===-10));
  const behind=blowSetup(w,guard,hero,{missile:'pilum',from:{x:10,z:15}});assert.ok(!behind.mods.some(m=>m.label==='Behind the rampart'),'no breastwork on its rear');
  const [line,foe]=w.squads,exchange=squadModifiers(w,foe,line,{ranged:true});
  assert.ok(exchange.modifiers.some(m=>m.label==='Behind the rampart'&&m.value===-STRUCTURES.rampart.squad),'0.38’s wall-tile protection');
});

test('validation refuses forged structure records',()=>{
  const good=gatedField();validateWorld(good,fail);
  for(const mutate of [w=>{w.objects[0].integrity=500;},w=>{w.objects[0].holder='rome';},w=>{w.objects[0].state='breached';},
    w=>{w.fortifications.ditches.push([0,0]);},w=>{w.map.elevations=[[0,0,9]];},w=>{w.objects[0].fortified='yes';}]){
    const w=restoreWorld(snapshotWorld(good));mutate(w);assert.throws(()=>validateWorld(w,fail));
  }
  const r=ramparted();validateWorld(r,fail);r.map.terrain[0][7]='grass';assert.throws(()=>validateWorld(r,fail),/rampart/);
});
