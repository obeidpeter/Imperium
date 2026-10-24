import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step} from '../src/core/realtime/simulation.js';
import {decideEnemy} from '../src/core/realtime/ai.js';
import {decideSquad,planDoctrine} from '../src/core/realtime/squad-ai.js';
import {squadById,squadCentre,squadModifiers,squadsRound,membersOf} from '../src/core/realtime/squads.js';
import {ENEMY_FACTIONS,ENEMY_PLANS,ENEMY_TECHNIQUES,EXCHANGE,MORALE,ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {ARCHETYPES} from '../src/data/realtime-forces.js';
import {ARENA,ENEMY_AI,TIME} from '../src/data/realtime-rules.js';

// The enemy's tactics (worlds and gameplay plan, release 3): whom a raider
// strikes, and the bands' techniques by faction.

const R=TIME.roundTicks;
const grass=(w=48,h=28)=>({id:'open',width:w,height:h,terrain:Array.from({length:h},()=>Array(w).fill('grass'))});
const hero=(over={})=>({...ARENA.hero,at:[6,60],...over});
const roman=(id,at,over={})=>({id,name:`${id} squad`,side:'ally',role:'infantry',strength:16,maxStrength:16,damage:3,at,face:[1,0],member:{name:'Legionary',...ROMAN_SQUADS.infantry},
  standing:[['hold_line',null]],...over});
const member=(faction,role)=>{const a=ARCHETYPES[faction][role][0];return {name:a.name,attributes:a.attributes,kit:a.kit,ammo:a.ammo,mounted:!!a.mounted};};
const band=(id,at,{faction='persian',role='infantry',...over}={})=>({id,name:`${id} band`,side:'enemy',role,faction,strength:10,maxStrength:10,damage:4,at,face:[-1,0],anchor:at,
  member:member(faction,role),...over});
const field=(squads,{actors=[hero()],chapter=5}={})=>createWorld({map:grass(),seed:4,actors,squads,chapter,command:3});

test('a raider strikes the most threatening foe: one striking him or a fellow, a wounded man, one pressing their archer',()=>{
  const raider={...ARENA.enemies[0],id:'r',at:[30,30],face:[-1,0],alert:true,aware:['hero','near','far']};
  const bow={...ARENA.enemies[2],id:'bow',at:[44,30],face:[-1,0],kit:['tunic','bow','quiver'],ammo:{arrow:8},alert:true,aware:['hero','near','far']};
  const ally=(id,at)=>({id,name:id,side:'ally',role:'infantry',attributes:{},kit:['tunic','scutum','gladius'],at,face:[1,0]});
  const make=()=>createWorld({map:grass(),seed:4,actors:[hero({at:[6,6]}),ally('near',[27,30]),ally('far',[32.5,34]),raider,bow]});
  const target=w=>{const r=w.actors.find(a=>a.id==='r');r.order=null;decideEnemy(w,r);return r.order?.targetId;};
  let w=make();assert.equal(target(w),'near','the nearest, all else equal');
  w=make();const far=w.actors.find(a=>a.id==='far');far.order={kind:'attack',targetId:'r'};far.lock='r';
  assert.equal(target(w),'far',`one striking him is counted ${ENEMY_AI.threat.attacking} m nearer`);
  w=make();w.actors.find(a=>a.id==='far').hp=3;assert.equal(target(w),'far','a badly wounded man is finished');
  // One pressing their archer (within 6 m of him) is met before a nearer man who is not.
  w=make();w.actors.find(a=>a.id==='near').x=24;const presser=w.actors.find(a=>a.id==='far');presser.x=38.5;presser.z=30;
  assert.ok(Math.hypot(presser.x-44,presser.z-30)<=ENEMY_AI.threat.guardRange);assert.equal(target(w),'far','he protects the archer');
  presser.x=36;presser.z=36;assert.ok(Math.hypot(presser.x-44,presser.z-30)>ENEMY_AI.threat.guardRange);assert.equal(target(w),'near','not pressing him: the nearer man');
});

test('Persian, Palmyrene and rival archers loose one aimed volley a round: three tenths of an exchange and a point of suppression; Gothic archers do not',()=>{
  for(const faction of ['persian','gothic']){
    const w=field([roman('ours',[30,30]),band('bows',[52,30],{faction,role:'archer'})]),ours=squadById(w,'ours'),bows=squadById(w,'bows');
    bows.plan={intent:'',targetId:'ours'};const events=[],start=ours.suppression;
    for(let t=0;t<R&&events.filter(e=>e.kind==='exchange'&&e.squadId==='bows').length<3;t++){bows.plan={intent:'',targetId:'ours'};events.push(...step(w));}
    const shots=events.filter(e=>e.kind==='exchange'&&e.squadId==='bows'),volleys=events.filter(e=>e.kind==='squad-volley');
    if(!ENEMY_FACTIONS[faction].volley){assert.equal(volleys.length,0,faction);continue;}
    assert.equal(volleys.length,1,'one a round');
    const setup=squadModifiers(w,bows,ours,{ranged:true});assert.ok(Math.abs(shots[0].damage-setup.damage*ENEMY_TECHNIQUES.volley.scale)<1e-9,'the volley');
    assert.ok(shots.slice(1).every(e=>e.damage<=setup.damage*EXCHANGE.scale*1.25+1e-9),'then ordinary shots');assert.ok(ours.suppression>start,'it suppresses');
  }
});

test('a band of a faction that braces does so after holding its ground; a Gothic band does not',()=>{
  for(const [faction,expect]of [['persian',true],['gothic',false]]){
    const w=field([roman('ours',[10,10]),band('guard',[90,50],{faction,role:'guard'})]),guard=squadById(w,'guard');
    for(let t=0;t<ENEMY_TECHNIQUES.braceTicks+40;t++)step(w);
    assert.equal(guard.braced,expect,`${faction}: ${ENEMY_FACTIONS[faction].brace?'braces':'never braces'}`);
  }
});

test('a wavering band pulls back behind a steady one and is steadied out of contact; a band of foot meets the squad pressing its archers',()=>{
  const w=field([roman('ours',[30,30]),band('tired',[50,30]),band('fresh',[56,36]),band('bows',[70,20],{role:'archer'})],{chapter:5});
  const tired=squadById(w,'tired');tired.morale=MORALE.shaken-5;planDoctrine(w);decideSquad(w,tired);
  assert.equal(tired.pulledBack,true);assert.match(tired.plan.intent,/^Pull back behind fresh band/);
  const fresh=squadCentre(w,squadById(w,'fresh')),ours=squadCentre(w,squadById(w,'ours'));
  assert.ok(Math.hypot(tired.plan.x-ours.x,tired.plan.z-ours.z)>Math.hypot(fresh.x-ours.x,fresh.z-ours.z),'behind the steady band, away from us');
  const morale=tired.morale;w.tick=R-1;squadsRound(w);assert.equal(tired.morale,morale+MORALE.restore,'steadied at the round’s end');
  // Our squad reaches the archers: the nearby band of foot turns on it.
  const v=field([roman('ours',[60,30]),band('bows',[62.4,30],{role:'archer'}),band('foot',[66,40])],{chapter:5});
  squadById(v,'bows').contact='ours';const foot=squadById(v,'foot');planDoctrine(v);decideSquad(v,foot);
  assert.equal(foot.plan.intent,'Protect the archers from ours squad.');assert.equal(foot.plan.targetId,'ours');
});

test('each faction favours its own plans: the doctrine’s weights times the faction’s factors',()=>{
  const count=(faction,plans)=>{let n=0;for(let seed=1;seed<=300;seed++){
    const w=createWorld({map:grass(),seed,actors:[hero()],chapter:5,command:3,squads:[roman('a',[20,30]),band('e1',[90,25],{faction}),band('e2',[90,40],{faction}),band('e3',[95,35],{faction})]});
    if(plans.includes(w.doctrine.plan.id))n++;}return n;};
  const flanks=['flank-left','flank-right','feint'];
  assert.ok(count('persian',flanks)>count('gothic',flanks),'the Persians turn flanks and feint more often than the Goths');
  const total=ENEMY_PLANS.weights.siege.reduce((n,[id,w])=>n+w*(ENEMY_FACTIONS.persian.plans[id]??1),0);
  const expected=ENEMY_PLANS.weights.siege.filter(([id])=>flanks.includes(id)).reduce((n,[id,w])=>n+w*(ENEMY_FACTIONS.persian.plans[id]??1),0)/total;
  assert.ok(Math.abs(count('persian',flanks)/300-expected)<.08,`about ${(expected*100).toFixed(0)}% of openings`);
});
