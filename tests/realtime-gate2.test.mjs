import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {commandDecision,heroDecision,playRealtime,runRealtimeCampaign} from '../scripts/realtime-autoplay.mjs';
import {createWorld,queueCommand,step,worldHash} from '../src/core/realtime/simulation.js';
import {deploy,deploying,soundTheAdvance} from '../src/core/realtime/deployment.js';
import {layoutFor,upsampleTerrain} from '../src/core/realtime/campaign-encounter.js';
import {findRoute,navGrid} from '../src/core/realtime/navigation.js';
import {membersOf,squadCentre} from '../src/core/realtime/squads.js';
import {ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {createSquadWorld,measureTicks} from '../src/core/realtime/benchmark-worlds.js';
import {ARENA,TIME} from '../src/data/realtime-rules.js';

// Gate 2 (build brief Phase 2): the battles of Chapters IV–IX play in real time
// from New Game, tests A1 and A2 hold in the largest of them, and the faults the
// deadline sweep (scripts/realtime-sweep.mjs) found stay fixed.

const R=TIME.roundTicks,camps=new Map();
// A battle's camp, reached from New Game by the 0.38 command campaign's legal commands.
function camp(id){
  if(!camps.has(id)){
    const stop=new Error('reached');
    try{runCommandCampaign({featureEdition:35,onCheckpoint(s){if(G.getChapter(s).encounters[s.encounterIndex]?.id===id&&!camps.has(id)){camps.set(id,G.serialize(s));throw stop;}}});}
    catch(error){if(error!==stop)throw error;}
  }
  return G.deserialize(camps.get(id));
}
const started=id=>{const s=camp(id);assert.equal(G.startEncounter(s,{controls:'realtime'}).ok,true);return s;};

test('the bot plays Chapters I–IX in real time from New Game by legal commands: every battle won and every chapter’s capability shown',()=>{
  const {state,encounters}=runRealtimeCampaign({throughChapter:9,ready:[1,2,3,4,5,6,7,8,9]});
  const battles=encounters.filter(e=>e.world===undefined&&e.rounds!==undefined);
  assert.deepEqual(battles.filter(e=>e.chapter>=4).map(e=>e.id),['ch4-gate','ch4-wall','ch5-mine','ch5-wall','ch6-wells','ch6-eagle','ch7-legion','ch8-ferry','ch8-crossing','ch9-wing','ch9-city']);
  assert.ok(battles.every(e=>e.status==='won'));assert.equal(state.chapter,10);assert.deepEqual(state.completed,[1,2,3,4,5,6,7,8,9]);
  for(const [chapter,capability]of [[4,'order'],[5,'formation'],[6,'rally'],[7,'deploy'],[9,'stratagem']])
    assert.ok(state.chapterCapabilities[chapter].includes(capability),`Chapter ${chapter}: ${capability}`);
  assert.doesNotThrow(()=>G.serialize(state));
});

test('A1 in the largest battle (Chapter VII, nine squads): the same camp and commands give the same world from deployment to victory',()=>{
  const a=started('ch7-legion'),b=started('ch7-legion'),wa=G.realtimeWorld(a);
  assert.ok(wa.actors.length>=60&&wa.squads.length>=9,`${wa.actors.length} actors, ${wa.squads.length} squads`);
  assert.equal(worldHash(wa),worldHash(G.realtimeWorld(b)),'identical starts');
  const ra=playRealtime(a),rb=playRealtime(b);assert.equal(ra.status,'won');assert.equal(worldHash(ra.world),worldHash(rb.world),'identical fights');
});

test('A2 in the largest battle: saved into the chronicle mid-fight, reloaded and played on, it ends exactly as the uninterrupted fight',()=>{
  const end=worldHash(playRealtime(started('ch7-legion')).world);
  for(const cut of [143,977,2311]){
    const state=started('ch7-legion'),w=G.realtimeWorld(state);
    // As playRealtime opens: the soldier deployed where he stands, the advance sounded.
    if(deploying(w)){const hero=w.actors.find(a=>a.id===w.heroId);deploy(w,{id:hero.id,x:hero.x,z:hero.z});soundTheAdvance(w);}
    for(let i=0;i<cut&&w.status==='active';i++){if(w.tick%10===0){commandDecision(w);heroDecision(w);}step(w);}
    assert.ok(G.saveRealtime(state,w).ok);const reloaded=G.deserialize(G.serialize(state));
    assert.equal(worldHash(G.realtimeWorld(reloaded)),worldHash(w),`the save at tick ${cut} is the world`);
    assert.equal(worldHash(playRealtime(reloaded).world),end,`saved at tick ${cut}`);
  }
});

test('a lone 0.38 wall is a breastwork round its block, open at the rear, never solid ground: Chapter VI’s Varro can be reached',()=>{
  const coarse=Array.from({length:3},(_,y)=>Array.from({length:3},(_,x)=>x===1&&y===1?'wall':'grass')),fine=upsampleTerrain(coarse,layoutFor(3,3,4),'grass');
  const cell=(x,z)=>fine.terrain[z][x];
  for(let z=4;z<8;z++)for(let x=4;x<8;x++){
    const edge=x===4||x===7||z===4||z===7,gap=x===4&&z>=5&&z<7;
    assert.equal(cell(x,z),edge&&!gap?'wall':'grass',`${x},${z}`);
  }
  const g=navGrid({id:'lone-wall',...fine});assert.equal(findRoute(g,{x:2,z:15},{x:15,z:15}).reasonCode,undefined,'inside, through the rear opening');
  const w=G.realtimeWorld(started('ch6-wells')),varro=w.actors.find(a=>a.escort&&!a.escort.escorted),hero=w.actors.find(a=>a.id==='hero');
  assert.ok(varro,'Varro waits to be assisted');assert.equal(findRoute(navGrid(w.map),hero,varro).reasonCode,undefined,'the soldier can reach him');
});

// Small fields for the movement rules.
const grass=(w=40,h=24)=>({id:`open-${w}-${h}`,width:w,height:h,terrain:Array.from({length:h},()=>Array(w).fill('grass'))});
const hero=(over={})=>({id:'hero',name:'Hero',side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2},at:[6,30],face:[1,0],...over});
const roman=(id,at,over={})=>({id,name:`${id} squad`,side:'ally',role:'infantry',strength:8,maxStrength:8,damage:3,at,face:[1,0],member:{name:'Legionary',...ROMAN_SQUADS.infantry},
  standing:[['hold_line',null]],...over});
// A distant band keeps the field's fight open (with no enemy left, the arena is won at once).
const distant={id:'far',name:'Distant band',side:'enemy',role:'infantry',strength:6,maxStrength:6,damage:3,at:[95,8],face:[-1,0],anchor:[95,8],
  member:{name:'Warrior',...ROMAN_SQUADS.infantry},standing:[['hold_line',null]]};

test('a squad’s men go round a wall to their places, and the standard waits for them rather than leaving them behind',()=>{
  const map=grass();for(let z=0;z<19;z++)map.terrain[z][12]='wall';
  const w=createWorld({map,seed:4,actors:[hero({at:[6,58]})],squads:[roman('a',[20,20]),distant],command:3,chapter:5});
  assert.ok(queueCommand(w,{actorId:'hero',kind:'order',payload:{squads:['a'],order:{kind:'advance',x:45,z:20}}}).ok);
  for(let i=0;i<R*6;i++)step(w);
  const q=w.squads[0],c=squadCentre(w,q),men=membersOf(w,q);
  assert.ok(Math.hypot(c.x-45,c.z-20)<5,`the squad stands at its place (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
  assert.ok(men.every(m=>m.x>32.5),'every man came round the wall');
});

test('a walker passes a waypoint another body stands on instead of waiting on it',()=>{
  const w=createWorld({map:grass(),seed:4,actors:[hero({at:[10,30]})],squads:[roman('a',[20,30]),distant],command:3,chapter:5});
  for(let i=0;i<R/2;i++)step(w);
  // The front man on the formation's north side holds the waypoint; the way on leads north-east, clear of the squad.
  const h=w.actors.find(a=>a.id==='hero'),man=[...membersOf(w,w.squads[0])].sort((a,b)=>a.z-b.z||b.x-a.x)[0],at={x:man.x,z:man.z};
  h.x=at.x-.4;h.z=at.z-.4;h.order={kind:'move'};h.path=[{...at},{x:at.x+15,z:at.z-10}];h.gait='walk';
  for(let i=0;i<R/2;i++)step(w);assert.ok(h.x>at.x+5,`he went on past the man holding the waypoint (${h.x.toFixed(1)}, ${h.z.toFixed(1)})`);
});

test('a threatened column walks on while one of ours stands beside it: the soldier, a companion, or a man of a squad screening it',()=>{
  const escort={id:'escort',name:'Settlers',side:'neutral',role:'escort',attributes:{str:10,agi:9,con:12,per:9,combat:2,field:4},kit:['tunic','paenula'],at:[30,30],face:[1,0],
    escort:{escorted:true,wounded:false},pace:1.6,drawn:false};
  const raider={id:'r',name:'Raider',side:'enemy',role:'raider',attributes:{str:12,agi:12,con:10,per:10,combat:6,field:6},kit:['tunic','jerkin','axe'],at:[37,30],face:[-1,0]};
  const mission={mode:'extract',goal:{x:90,z:30},radius:10,followRange:40,escorts:['escort'],points:[],holdRequired:0,heldTicks:0,occupiedTicks:0,deadline:20,waves:[],required:[],
    pauseEscorts:false,rescue:false,gather:0,commander:false,phase:0,completed:[]};
  const field=squads=>createWorld({map:grass(),seed:4,actors:[hero({at:[10,30]}),escort,raider],squads,command:3,chapter:6,mission:structuredClone(mission)});
  const alone=field([]),screened=field([roman('screen',[30,33],{standing:[['guard_standard','convoy']]})]);
  for(let i=0;i<12;i++){step(alone);step(screened);}
  assert.equal(alone.actors.find(a=>a.id==='escort').order?.kind,'fallback','uncovered, it draws back to its protector');
  assert.equal(screened.actors.find(a=>a.id==='escort').order?.kind,'move','screened, it keeps walking');
});

test('the performance check times Gate 2’s battle: six squads, the soldier, two companions and nine raiders, who close and fight',()=>{
  const w=createSquadWorld({seed:11});
  assert.equal(w.squads.length,6);assert.ok(w.actors.length>=55,`${w.actors.length} figures`);assert.deepEqual(w.party,['c1','c2']);
  const before=w.actors.filter(a=>a.alive&&!a.down).length;for(let i=0;i<R*6;i++)step(w);
  assert.ok(w.actors.filter(a=>a.alive&&!a.down).length<before,'the fight is joined');
  const t=measureTicks({ticks:40});assert.equal(t.squads6.ticks,40);assert.ok(Number.isFinite(t.squads6.p95));assert.equal(t.budgetMs,4);
});

test('a chapter’s last battle is won only once its capability is shown, and the field says in words what is still to do',()=>{
  const mission={mode:'hold',goal:{x:10,z:30},radius:10,holdRequired:0,heldTicks:0,occupiedTicks:0,deadline:1,required:['order'],points:[],waves:[],escorts:[],
    pauseEscorts:false,rescue:false,gather:0,commander:false,phase:0,completed:[],followRange:40,defence:100,pressure:0};
  const w=createWorld({map:grass(),seed:4,actors:[hero({at:[10,30]})],squads:[roman('a',[20,30]),distant],command:3,chapter:4,mission});
  const said=[];for(let i=0;i<R&&w.status==='active';i++){step(w);said.push(...w.log.filter(l=>l.tick===w.tick-1).map(l=>l.text));}
  assert.ok(said.some(t=>t==='The objective is held, but you must still give a squad an order.'),'told once the ground is held');
  assert.equal(w.status,'lost');assert.equal(w.mission.reason,'The deadline passed before you could give a squad an order.');
});
