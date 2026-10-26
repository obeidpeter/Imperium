import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,commandProblem,queueCommand,restoreWorld,snapshotWorld,step,worldHash} from '../src/core/realtime/simulation.js';
import {installFortifications,workFortification,fortificationRound,closeFortifiedGate} from '../src/core/realtime/fortifications.js';
import {fieldVerb,openGate} from '../src/core/realtime/field-objects.js';
import {clearLine,findRoute,navGrid,groundHeight,speedFactor,terrainAtPoint} from '../src/core/realtime/navigation.js';
import {validateWorld} from '../src/core/realtime/validate.js';
import {TIME} from '../src/data/realtime-rules.js';
import {terrainCover} from '../src/core/realtime/sight.js';
import {ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {carryOut} from '../src/core/realtime/squad-ai.js';
import {membersOf,moveSquads,routeSquad} from '../src/core/realtime/squads.js';

// Labelled small scenario: a full wall divides the field. These tests prove
// changes to routes and actions, not a simulated campaign completion.
function field(heroAt=[5,15]){
  const terrain=Array.from({length:12},()=>Array.from({length:14},(_,x)=>x===7?'wall':'grass'));
  const spec=(id,side,x,z)=>({id,name:id,side,at:[x,z],attributes:{str:12,agi:12,con:12,per:10,combat:6,field:6},kit:['tunic','gladius'],ai:false});
  const w=createWorld({seed:51,map:{id:'ch5-mine',width:14,height:12,terrain},actors:[spec('hero','player',...heroAt),spec('guard','enemy',30,15)],
    mission:{mode:'hold',goal:{x:30,z:25},radius:2,holdRequired:30,heldTicks:0,occupiedTicks:0,deadline:40,waves:[],escorts:[],points:[],required:[],defence:100,pressure:0},
    objects:[{id:'gate',kind:'gate',name:'Side gate',x:18.75,z:6.25,state:'closed',done:false,field:true,rounds:0,work_s:3,cells:[[7,2]],under:'grass'}]});
  w.chapter=5;w.encounterId='ch5-mine';w.field={landmark:'Fortress',deadline:7,choice:null,outcome:'pending',escortPace:2,cavalryDenied:false,
    opportunities:{stores:{effect:'stores'},signal:{effect:'cohesion'}}};
  installFortifications(w);return w;
}
const fail=message=>{throw new Error(message);};

test('a permanent wall breach changes navigation only when the engineering work is complete',()=>{
  const w=field(),hero=w.actors[0],wall=w.objects.find(o=>o.kind==='breach'),goal={x:30,z:15};
  assert.ok(findRoute(navGrid(w.map),hero,goal).reasonCode,'the full wall stops the route');
  const terrain=JSON.stringify(w.map.terrain);
  assert.equal(workFortification(w,hero,wall),true);assert.equal(wall.progress,1);
  assert.equal(JSON.stringify(w.map.terrain),terrain,'unfinished work does not create a passage');
  assert.equal(workFortification(w,hero,wall),true);assert.equal(wall.state,'breached');
  assert.equal(findRoute(navGrid(w.map),hero,goal).reasonCode,undefined);
  for(const [x,y]of wall.cells){assert.equal(w.map.terrain[y][x],'rubble');assert.equal(speedFactor(navGrid(w.map),(x+.5)*2.5,(y+.5)*2.5),.6);}
  const after=snapshotWorld(w);assert.equal(workFortification(w,hero,wall),false);assert.equal(snapshotWorld(w),after);
});

test('a gate can close after reopening but refuses an occupied passage without changing state',()=>{
  const w=field(),gate=w.objects[0];openGate(w,gate,'hero');assert.equal(fieldVerb(gate),'Close gate');
  w.actors[0].x=gate.x;w.actors[0].z=gate.z;
  const before=snapshotWorld(w),command={actorId:'hero',kind:'interact',payload:{objectId:gate.id}};
  assert.equal(commandProblem(w,command),'GATE_OCCUPIED');assert.equal(queueCommand(w,command).ok,false);
  assert.equal(snapshotWorld(w),before);assert.equal(closeFortifiedGate(w,gate),false);
  w.actors[0].x=5;assert.equal(closeFortifiedGate(w,gate,'hero'),true);assert.equal(w.map.terrain[2][7],'wall');
  assert.equal(fieldVerb(gate),'Open gate');
});

test('siege work stops ongoing pressure and a successful sortie delays an upcoming reserve once',()=>{
  const w=field(),mine=w.objects.find(o=>o.kind==='countermine'),ramp=w.objects.find(o=>o.kind==='siege-engine');
  w.mission.waves.push({round:6,arrived:false});
  for(let round=1;round<=4;round++){w.tick=round*TIME.roundTicks-1;fortificationRound(w);}
  assert.equal(w.mission.defence,92);
  for(const o of [mine,ramp]){workFortification(w,w.actors[0],o);workFortification(w,w.actors[0],o);}
  assert.equal(w.mission.waves[0].round,7);const integrity=w.mission.defence;
  w.tick=5*TIME.roundTicks-1;fortificationRound(w);assert.equal(w.mission.defence,integrity);
  assert.equal(w.fortifications.secured.length,2);
});

test('fortified platform height is used by the navigation grid, including after restoration',()=>{
  const w=field();assert.equal(w.fortifications.platforms.length,1);
  const p=w.fortifications.platforms[0];assert.equal(groundHeight(navGrid(w.map),(p.x+.5)*2.5,(p.y+.5)*2.5),3.2);
  const restored=restoreWorld(snapshotWorld(w));assert.equal(groundHeight(navGrid(restored.map),(p.x+.5)*2.5,(p.y+.5)*2.5),3.2);
  validateWorld(restored,fail);
});

test('mid-work save continuation reproduces the same engineering result and world hash',()=>{
  const w=field(),o=w.objects.find(o=>o.kind==='countermine'),hero=w.actors[0];
  hero.x=o.x-1;hero.z=o.z;hero.px=hero.x;hero.pz=hero.z;
  assert.equal(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:o.id}}).ok,true);
  for(let i=0;i<20;i++)step(w);assert.equal(hero.action?.kind,'work');
  const restored=restoreWorld(snapshotWorld(w));
  for(let i=0;i<100;i++){step(w);step(restored);}
  assert.equal(o.progress,1);assert.equal(worldHash(w),worldHash(restored));
});

test('import validation refuses malformed engineering and elevation records',()=>{
  const good=field();validateWorld(good,fail);
  for(const mutate of [w=>w.map.elevations[0][2]=Infinity,w=>w.fortifications.walls[0][0]=-1,
    w=>w.objects.find(o=>o.kind==='countermine').required=999,w=>w.fortifications.secured.push('missing')]){
    const w=restoreWorld(snapshotWorld(good));mutate(w);assert.throws(()=>validateWorld(w,fail));
  }
});

test('standing on the fortified platform gives a real line over the curtain; ground level is screened',()=>{
  const w=field(),p=w.fortifications.platforms[0],a={x:(p.x+.5)*2.5,z:(p.y+.5)*2.5},b={x:27.5,z:a.z};
  assert.equal(terrainCover(w,a,b),false);
  const low={x:a.x,z:a.z+5},target={x:b.x,z:low.z};assert.equal(terrainCover(w,low,target),true);
});

test('late reserves are never brought forward by a successful sortie',()=>{
  const w=field(),ramp=w.objects.find(o=>o.kind==='siege-engine');w.mission.waves=[{round:45,arrived:false}];
  workFortification(w,w.actors[0],ramp);workFortification(w,w.actors[0],ramp);assert.equal(w.mission.waves[0].round,45);
});

test('a fighting platform is reached by its stairs, never by walking through its sheer side',()=>{
  const w=field(),p=w.fortifications.platforms[0],g=navGrid(w.map),deck={x:(p.x+.5)*2.5,z:(p.y+.5)*2.5};
  const side={x:deck.x,z:deck.z+2.5};assert.equal(clearLine(g,side,deck),false,'the vertical face blocks a direct crossing');
  const route=findRoute(g,w.actors[0],deck);assert.equal(route.reasonCode,undefined,'stairs preserve a route to the deck');
  let prior=w.actors[0];for(const point of route.points){assert.equal(clearLine(g,prior,point),true);prior=point;}
});

test('engineering work avoids actor spawn tiles and remains reachable after the platform is installed',()=>{
  const w=field([6.25,16.25]),hero=w.actors[0],works=w.objects.filter(o=>['countermine','siege-engine'].includes(o.kind));
  assert.equal(works.length,2);assert.equal(w.fortifications.platforms.length,1);
  for(const work of works){
    assert.ok(w.actors.every(a=>Math.floor(a.x/2.5)!==Math.floor(work.x/2.5)||Math.floor(a.z/2.5)!==Math.floor(work.z/2.5)),`${work.kind} must not envelop an actor`);
    assert.equal(findRoute(navGrid(w.map),hero,work).reasonCode,undefined,`${work.kind} is usable in the final geometry`);
  }
});

function gatedCompany({company=true}={}){
  const terrain=Array.from({length:12},(_,y)=>Array.from({length:14},(_,x)=>x===7&&y!==6?'wall':'grass'));
  return createWorld({seed:51,map:{id:'gate-orders',width:14,height:12,terrain},
    actors:[{id:'hero',name:'Hero',side:'player',at:[5,5],kit:['tunic'],ai:false},
      {id:'guard',name:'Guard',side:'enemy',at:[32,27],kit:['tunic'],ai:false}],
    mission:{mode:'hold',goal:{x:30,z:25},radius:2,holdRequired:30,heldTicks:0,occupiedTicks:0,deadline:40,waves:[],escorts:[],points:[],required:[],defence:100,pressure:0},
    objects:[{id:'gate',kind:'gate',name:'Gate',x:18.75,z:16.25,state:'open',done:true,field:true,fortified:true,toggle:true,rounds:0,cells:[[7,6]],under:'grass'}],
    squads:company?[{id:'cohort',name:'Cohort',side:'ally',role:'infantry',strength:16,maxStrength:16,at:[12,16.25],face:[1,0],member:ROMAN_SQUADS.infantry}]:[]});
}

test('closing a gate discards formation routes; the retained advance resumes after reopening',()=>{
  const w=gatedCompany(),q=w.squads[0],gate=w.objects[0];
  carryOut(w,q,{kind:'advance',x:28,z:16.25});for(let i=0;i<6;i++)step(w);assert.ok(q.path.length);
  const goal={...q.goal},order={...q.order};membersOf(w,q)[0].slotPath=[{x:28,z:16.25}];
  assert.equal(closeFortifiedGate(w,gate),true);
  assert.deepEqual(q.path,[]);assert.deepEqual(q.goal,goal);assert.deepEqual(q.order,order);
  assert.ok(membersOf(w,q).every(a=>a.slotPath===null));
  for(let i=0;i<200;i++){
    step(w);assert.ok(q.x<17.5,'the standard stays on this side of the closed wall');
    assert.ok(membersOf(w,q).every(a=>a.x<17.5),'no man crosses the wall');
  }
  assert.equal(q.order.kind,'advance');assert.equal(openGate(w,gate),true);
  for(let i=0;i<500;i++)step(w);
  assert.ok(q.x>25,'the same order carries the standard through the reopened gate');
  assert.ok(membersOf(w,q).every(a=>a.x>20),'the formation also crosses');
});

test('a stale saved standard route cannot cross a newly closed gate',()=>{
  const w=gatedCompany(),q=w.squads[0],gate=w.objects[0];routeSquad(w,q,{x:28,z:16.25});
  const path=structuredClone(q.path);assert.equal(closeFortifiedGate(w,gate),true);
  q.path=path;q.gait='walk';
  for(let i=0;i<200;i++){moveSquads(w);assert.notEqual(terrainAtPoint(w.map,q.x,q.z),'wall');}
  assert.ok(q.x<17.5);assert.equal(q.path.length,0);
});

test('a player Move survives closure, saves while waiting, and resumes when the route opens',()=>{
  const w=gatedCompany({company:false}),hero=w.actors[0],gate=w.objects[0];
  assert.equal(queueCommand(w,{actorId:'hero',kind:'move',payload:{x:28,z:16.25}}).ok,true);step(w);
  const goal={...hero.goal};assert.equal(closeFortifiedGate(w,gate),true);
  for(let i=0;i<100;i++)step(w);
  assert.equal(hero.order.kind,'move');assert.deepEqual(hero.goal,goal);assert.ok(hero.x<17.5);
  const saved=restoreWorld(snapshotWorld(w));openGate(w,gate);openGate(saved,saved.objects[0]);
  for(let i=0;i<250;i++){step(w);step(saved);}
  assert.ok(hero.x>25);assert.equal(hero.order,null);assert.equal(worldHash(w),worldHash(saved));
});
