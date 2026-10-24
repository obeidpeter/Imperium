import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,worldHash} from '../src/core/realtime/simulation.js';
import {decideSquad,planDoctrine} from '../src/core/realtime/squad-ai.js';
import {squadById,squadCentre} from '../src/core/realtime/squads.js';
import {splitStreams} from '../src/core/realtime/rng-streams.js';
import {fieldIntelligence} from '../src/core/realtime/intel.js';
import {ENEMY_PLANS,ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {ARCHETYPES} from '../src/data/realtime-forces.js';
import {ARENA,TIME} from '../src/data/realtime-rules.js';

// The enemy's plans (worlds and gameplay plan, release 3): drawn from the ai
// stream within the chapter's doctrine, kept at least two rounds, and carried
// out by the bands: a forced flank, a feint, a reserve's timing.

const R=TIME.roundTicks;
const grass=(w=48,h=28)=>({id:'open',width:w,height:h,terrain:Array.from({length:h},()=>Array(w).fill('grass'))});
const hero=(over={})=>({id:'hero',name:'Hero',side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2},at:[6,35],face:[1,0],...over});
const roman=(id,at,over={})=>({id,name:`${id} squad`,side:'ally',role:'infantry',strength:16,maxStrength:16,damage:3,at,face:[1,0],member:{name:'Legionary',...ROMAN_SQUADS.infantry},
  standing:[['hold_line',null]],...over});
const member=role=>{const a=ARCHETYPES.gothic[role][0];return {name:`Gothic ${a.name}`,attributes:a.attributes,kit:a.kit,ammo:a.ammo,mounted:!!a.mounted};};
const band=(id,at,role='infantry',over={})=>({id,name:`${id} band`,side:'enemy',role,strength:10,maxStrength:10,damage:4,at,face:[-1,0],anchor:at,member:member(role),...over});
// Chapter V's siege doctrine (a reserve), or Chapter VII's pincer.
const field=({seed=9,chapter=5,squads=null}={})=>createWorld({map:grass(),seed,actors:[hero()],chapter,command:3,squads:squads??[
  roman('a',[20,30]),roman('b',[20,40]),
  band('e1',[95,25]),band('e2',[95,35]),band('e3',[95,45]),band('horse',[100,20],'cavalry'),band('bows',[105,35],'archer')]});
const force=(w,id)=>{w.doctrine.plan={id,since:1};planDoctrine(w);return w.doctrine;};

test('the enemy draws its opening plan and each band’s preference from the ai stream alone',()=>{
  const w=field(),fresh=splitStreams(9);
  assert.ok(ENEMY_PLANS.kinds[w.doctrine.plan.id],'a plan of the data');assert.equal(w.doctrine.plan.since,1);
  assert.deepEqual([w.rng.combat,w.rng.world],[fresh.combat,fresh.world],'no combat or world draw');assert.notEqual(w.rng.ai,fresh.ai);
  assert.ok(w.squads.filter(q=>q.side==='enemy').every(q=>ENEMY_PLANS.preferences.some(([p])=>p===q.pref)),'every band has a preference');
  // Same seed, same plan; across seeds the plan differs.
  assert.equal(field().doctrine.plan.id,w.doctrine.plan.id);
  const opening=new Set(Array.from({length:30},(_,i)=>field({seed:i+1}).doctrine.plan.id));
  assert.ok(opening.size>=4,`${[...opening]} across thirty seeds`);
  // Only plans the chapter's doctrine weighs (siege) are drawn.
  for(const id of opening)assert.ok(ENEMY_PLANS.weights.siege.some(([p])=>p===id),id);
});

test('a plan is kept at least its rounds; a change is logged and named in the field intelligence',()=>{
  let changed=null;
  for(let seed=1;seed<=20&&!changed;seed++){
    const w=field({seed}),seen=[{round:1,...w.doctrine.plan}],logged=[];
    for(let t=0;t<R*8&&w.status==='active';t++){
      for(const e of step(w))if(e.kind==='enemy-plan')logged.push(w.log.find(l=>l.tick===e.tick&&l.kind==='enemy-plan')?.text);
      const p=w.doctrine?.plan;if(p&&p.since!==seen.at(-1).since)seen.push({round:Math.floor(w.tick/R)+1,...p});
    }
    for(let i=1;i<seen.length;i++){const held=seen[i].since-seen[i-1].since,need=ENEMY_PLANS.kinds[seen[i-1].id].hold??ENEMY_PLANS.hold;
      assert.ok(held>=need,`seed ${seed}: ${seen[i-1].id} kept ${held} rounds`);assert.ok(!ENEMY_PLANS.kinds[seen[i].id].opening,'a reserve plan only opens a battle');}
    const switched=seen.find((p,i)=>i&&p.id!==seen[i-1].id);
    if(switched)changed={w,label:ENEMY_PLANS.kinds[switched.id].label,logged};
  }
  assert.ok(changed,'some seed changes its plan within eight rounds');
  assert.ok(changed.logged.includes(`The enemy changes its plan: ${changed.label.toLowerCase()}.`),`the battle log says so: ${changed.logged}`);
  const intel=fieldIntelligence(changed.w);assert.equal(intel.doctrine.plan,ENEMY_PLANS.kinds[changed.w.doctrine.plan.id].label);assert.ok(intel.doctrine.planSummary);
});

test('a forced flank sends the horse and a band of foot round the focus’s named side',()=>{
  for(const [id,side]of [['flank-left',-1],['flank-right',1]]){
    const w=field(),d=force(w,id),focus=squadById(w,d.focusId),fc=squadCentre(w,focus);
    assert.equal(d.roles.horse,'Flank');assert.equal(d.sides.horse,side);
    assert.equal(Object.entries(d.roles).filter(([q,r])=>r==='Flank'&&squadById(w,q).role==='infantry').length,1,'one band of foot joins the flank');
    const horse=squadById(w,'horse');decideSquad(w,horse);
    // Our squads face east: their left is north (−z), their right south.
    assert.ok(Math.sign(horse.plan.z-fc.z)===side,`${id}: ${horse.plan.intent} at z ${horse.plan.z.toFixed(1)} beside ${fc.z.toFixed(1)}`);
    assert.match(horse.plan.intent,side<0?/left flank/:/right flank/);
  }
  const w=field({chapter:7}),d=force(w,'pincer'),sides=Object.values(d.sides);
  assert.ok(sides.includes(1)&&sides.includes(-1),'a pincer goes round both flanks');
});

test('the reserve’s timing: an early plan commits it after round 1, a late one holds it through round 4 unless threatened',()=>{
  const early=field();force(early,'early-reserve');assert.ok(early.doctrine.reserveId,'held in round 1');
  early.tick=R-1;planDoctrine(early);assert.equal(early.doctrine.reserveId,null,'committed from round 2');
  const late=field();force(late,'late-reserve');const held=late.doctrine.reserveId;assert.ok(held);
  for(const r of [1,2,3]){late.tick=r*R-1;planDoctrine(late);assert.equal(late.doctrine.plan.id,'late-reserve',`kept into round ${r+1}`);assert.equal(late.doctrine.reserveId,held);}
  late.tick=4*R-1;planDoctrine(late);assert.equal(late.doctrine.reserveId,null,'committed in round 5');
  // Held means held: the reserve keeps its ground while nothing of ours is near.
  const w=field();force(w,'late-reserve');const q=squadById(w,w.doctrine.reserveId),start=squadCentre(w,q);
  for(let t=0;t<R;t++)step(w);const now=squadCentre(w,q);assert.ok(Math.hypot(now.x-start.x,now.z-start.z)<3,'the reserve stands');
});

test('a feint closes on its mark in the plan’s first round, then falls back while the others wait',()=>{
  // Chapter VII (no reserve): the band nearest the squad feints.
  const w=field({chapter:7,squads:[roman('a',[40,35]),band('e1',[58,35]),band('e2',[66,25]),band('e3',[66,45])]}),d=force(w,'feint');
  const feinter=Object.keys(d.roles).find(id=>d.roles[id]==='Feint');assert.equal(feinter,'e1','the nearest band feints');
  const q=squadById(w,feinter),mark=()=>squadCentre(w,squadById(w,'a')),gap=()=>{const c=squadCentre(w,q),m=mark();return Math.hypot(c.x-m.x,c.z-m.z);};
  const waiting=Object.keys(d.roles).filter(id=>d.roles[id]==='Fix');
  for(let t=0;t<R-5;t++)step(w);
  assert.ok(gap()<=ENEMY_PLANS.feint.close+3,`closed to ${gap().toFixed(1)} m`);
  for(const id of waiting)assert.equal(squadById(w,id).plan.intent,'Wait for the feint to draw you out.');
  const closest=gap();for(let t=0;t<R;t++)step(w);
  assert.ok(gap()>closest+4,`fell back to ${gap().toFixed(1)} m`);
  assert.match(q.plan.intent,/^Fall back to draw/);
});

test('planning is pure apart from its ai draws: a world planned twice from the same state is the same world',()=>{
  const a=field(),b=field();planDoctrine(a);planDoctrine(b);assert.equal(worldHash(a),worldHash(b));
  for(let t=0;t<R*3;t++){step(a);step(b);}assert.equal(worldHash(a),worldHash(b));
});
