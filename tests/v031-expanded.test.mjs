import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {playEncounter} from '../scripts/autoplay.mjs';
import {alive,clone,reachable,lineOfSight} from '../src/core/shared.js';
import {expandedCombat,expandedHit,advanceExpandedBattle,coordinatedAssignment,moveProtectedColumn} from '../src/core/expanded-campaign.js';
import {fieldBlocked,fieldMoveCost} from '../src/core/field-geometry.js';
import {createFrameProfile} from '../src/showcase/frame-profile.js';
import {createBattlefieldFeatures} from '../src/showcase/battlefield-features.js';
import {contactWeight,solveWeaponContact} from '../src/showcase/paired-contact.js';
import {combatReaction} from '../src/showcase/combat-presentation.js';
import {geometry,pickTile} from '../src/ui/renderer.js';
import {spriteHeight} from '../src/ui/unit-sprites.js';
import * as T from '../vendor/three/three.module.js';
const camps=new Map();let campaign;
function baseline(){return campaign??=runProgressionCampaign({onCheckpoint:s=>camps.set(G.getChapter(s).encounters[s.encounterIndex].id,clone(s))});}
function started(id='ch5-siege'){
  baseline();if(!camps.has(id))id=[...camps.keys()].find(k=>k.startsWith('ch5-'));
  const s=clone(camps.get(id));assert.ok(G.enableExpandedCampaign(s).ok);assert.ok(G.startEncounter(s,s.chapter===12?{route:'backer'}:{}).ok);return s;
}
// Focused injected positions below test an individual mechanic, not campaign completion.
function beside(s,o){const h=s.encounter.units.find(u=>u.id==='hero');h.x=Math.max(0,o.x-1);h.y=o.y;h.acted=false;return h;}
test('V031 old campaigns keep their rules; camp opt-in and full checkpoint retry are exact',()=>{
  const old=G.newGame();assert.equal(old.featureEdition,undefined);const s=started();const saved=G.serialize(s);assert.equal(G.enableExpandedCampaign(s).ok,false);G.endTurn(s);assert.ok(G.retry(s).ok);assert.equal(G.serialize(s),saved);assert.deepEqual(G.deserialize(saved),JSON.parse(saved));
});
test('V031 invalid interactions and forecasts leave all state and RNG intact',()=>{
  const s=started(),before=JSON.stringify(s);assert.equal(G.fieldAction(s,'missing').ok,false);for(const o of G.fieldOptions(s))G.previewFieldAction(s,o.id);assert.equal(JSON.stringify(s),before);
});
test('V031 gate and repaired bridge affect legal movement and survive serialization',()=>{
  const s=started(),e=s.encounter,gate=e.field.objects.find(o=>o.kind==='gate'),bridge=e.field.objects.find(o=>o.kind==='bridge');assert.equal(e.width,10);assert.equal(fieldBlocked(e,gate.x,gate.y),true);
  const h=beside(s,gate);e.units=e.units.filter(u=>u.id===h.id||u.x!==h.x||u.y!==h.y);
  assert.ok(!reachable(e,h).some(p=>p.x===gate.x&&p.y===gate.y));assert.ok(G.fieldAction(s,gate.id).ok);assert.equal(fieldBlocked(e,gate.x,gate.y),false);
  beside(s,bridge);assert.ok(G.fieldAction(s,bridge.id).ok);assert.equal(e.terrain[bridge.y][bridge.x],'ford');assert.equal(G.deserialize(G.serialize(s)).encounter.field.objects.find(o=>o.kind==='bridge').state,'repaired');
});
test('V031 competing opportunities are exclusive, staged and reset by retry',()=>{
  const s=started(),e=s.encounter,o=e.field.objects.find(o=>o.kind==='stores'),supplies=s.supplies,staged=e.staged.supplies??0;beside(s,o);assert.ok(G.fieldAction(s,o.id).ok);assert.equal(s.supplies,supplies);assert.equal(e.staged.supplies,staged+2);assert.equal(e.field.choice,'stores');beside(s,e.field.objects.find(o=>o.kind==='signal'));assert.equal(G.fieldAction(s,'signal').ok,false);G.retry(s);assert.equal(s.encounter.field.choice,null);assert.equal(s.supplies,supplies);
});
test('V031 smoke obstructs sight, fire affects both sides, rain extinguishes after one round',()=>{
  const s=started(),e=s.encounter,o=e.field.objects.find(o=>o.kind==='brazier'),h=beside(s,o);e.weather='rain';const hp=h.hp;assert.ok(G.fieldAction(s,o.id).ok);assert.equal(o.rounds,1);assert.equal(lineOfSight(e,{x:o.x-2,y:o.y},{x:o.x+1,y:o.y}),false);advanceExpandedBattle(e);assert.equal(h.hp,hp-2);assert.equal(o.state,'spent');assert.equal(o.rounds,undefined);
});
test('V031 cohesion and suppression recover with brace; weather and cover are in the exact damage modifiers',()=>{
  const s=started(),e=s.encounter,h=e.units.find(u=>u.id==='hero'),t=e.units.find(u=>u.side==='enemy');h.cohesion=39;h.suppression=2;e.weather='rain';h.x=0;h.y=0;t.x=3;t.y=0;
  const mods=expandedCombat(e,h,t,true);assert.ok(['Disrupted cohesion','Suppressed','Poor visibility'].every(label=>mods.some(m=>m.label===label&&m.value===-1)));assert.equal(fieldMoveCost({...e,terrain:[['high']]},h,0,0),2);h.braced=true;advanceExpandedBattle(e);assert.equal(h.cohesion,51);assert.equal(h.suppression,1);expandedHit(e,h,true);assert.equal(h.cohesion,45);assert.equal(h.suppression,2);
});
test('V031 enemy assignments are deterministic and escort columns stay with their protection',()=>{
  const s=started(),e=s.encounter,before=JSON.stringify(e),enemies=e.units.filter(u=>u.side==='enemy');assert.deepEqual(enemies.map(u=>coordinatedAssignment(e,u)),enemies.map(u=>coordinatedAssignment(e,u)));assert.equal(JSON.stringify(e),before);
  const grid=Array.from({length:8},()=>Array(8).fill('grass')),h={id:'hero',x:0,y:3,hp:10,side:'player'},escort={id:'escort',x:2,y:3,hp:10,side:'neutral',move:2};const field={width:8,height:8,terrain:grid,units:[h,escort],goal:{x:7,y:3},featureEdition:31};moveProtectedColumn(field,escort,h);assert.equal(escort.x,3);
});
test('V031 motions, amendments, committed effects and exactly-once rewards use the transaction',()=>{
  for(const id of ['provision','service','audit'])for(const terms of ['original','amended']){
    const s=started('ch10-tribunal');s.supplies=20;s.snapshot.supplies=20;const e=s.encounter,h=e.units.find(u=>u.id==='hero'),before=JSON.stringify(s),f=G.previewPolicy(s,id);assert.ok(f.ok);assert.equal(JSON.stringify(s),before);assert.ok(G.tablePolicy(s,id).ok);assert.equal(s.reforms.length,0);assert.equal(s.supplies,20);G.endTurn(s);assert.equal(e.policy.counter,true);h.acted=false;assert.ok(G.previewPolicy(s,id,terms).ok);assert.ok(G.tablePolicy(s,id,terms).ok);assert.equal(G.tablePolicy(s,id,terms).ok,false);
    G.deserialize(G.serialize(s));assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);assert.equal(s.reforms[0].id,id);assert.equal(s.reforms[0].terms,terms);const committed=JSON.stringify(s);assert.equal(G.commitEncounter(s).ok,false);assert.equal(JSON.stringify(s),committed);G.deserialize(G.serialize(s));
  }
});
test('V031 malformed expanded saves are rejected, including mixed edition checkpoints',()=>{
  for(const mutate of [s=>s.encounter.field.objects[0].x=100,s=>s.encounter.units[0].suppression=4,s=>s.snapshot.featureEdition=32,s=>s.featureEdition=32,s=>s.reforms.push({id:'unknown'})]){const s=started();mutate(s);assert.throws(()=>G.deserialize(JSON.stringify(s)),/Invalid save/);}
});
test('V031 legal enhanced campaign reaches all twelve chapters and exact retries',()=>{
  const r=runProgressionCampaign({featureEdition:31});assert.equal(r.rank,'Augustus');assert.equal(r.encounters.length,25);assert.ok(r.checks.every(c=>c.exactRetry));assert.equal(r.state.completed.length,12);G.deserialize(G.serialize(r.state));
});
test('V031 field visuals batch objects and dispose owned resources',()=>{
  const s=started(),scene=new T.Scene(),v=createBattlefieldFeatures(scene);v.sync(s.encounter);assert.ok(v.stats().objects>=6);assert.ok(v.stats().drawBatches<20);const count=scene.children[0].children.length;v.sync(s.encounter);assert.equal(scene.children[0].children.length,count);v.dispose();assert.equal(scene.children.length,0);
});
test('V031 paired contact reduces weapon endpoint error without moving the actor root',()=>{
  const group=new T.Group(),shoulder=new T.Bone(),elbow=new T.Bone(),tip=new T.Object3D();shoulder.name='right-shoulder';elbow.name='elbow';group.add(shoulder);shoulder.add(elbow);elbow.position.y=.5;elbow.add(tip);tip.position.y=.5;group.updateMatrixWorld(true);const target=new T.Vector3(.5,.7,0),before=tip.getWorldPosition(new T.Vector3()).distanceTo(target);solveWeaponContact({group,contacts:{weapon:tip}},target,1);assert.ok(tip.getWorldPosition(new T.Vector3()).distanceTo(target)<before);assert.equal(group.position.length(),0);assert.equal(contactWeight(0),0);assert.ok(contactWeight(230/620)>.99);
});
test('V031 measured profiles use bounded windows and separate CPU, display and reflection time',()=>{
  const p=createFrameProfile(40);for(let i=0;i<90;i++)p.record({cpuMs:6,intervalMs:16.7,reflectionMs:5});assert.equal(p.stats().cpuSubmission.samples,40);assert.equal(p.stats().displayInterval.p95Ms,16.7);assert.equal(p.reflectionStride(),2);assert.equal(p.stats().cpuSubmission.p95Ms,6);
});
test('V031 shield anticipation requires a committed defended impact and preserves active attacks',()=>{
  const unit={id:'defender',x:2,y:3},timeline={tracks:[{unitId:'defender',pose:'hit',start:500,duration:300}],effects:[{type:'shield',at:{x:2,y:3},start:500,defended:true}]};
  assert.deepEqual(combatReaction(unit,null,timeline),{});
  assert.deepEqual(combatReaction(unit,{time:200,unitOverrides:{}},timeline),{});
  assert.equal(combatReaction(unit,{time:400,unitOverrides:{}},timeline).motion,'block');
  assert.deepEqual(combatReaction(unit,{time:400,unitOverrides:{defender:{pose:'attack'}}},timeline),{});
  timeline.effects[0].defended=false;assert.deepEqual(combatReaction(unit,{time:400,unitOverrides:{}},timeline),{});
});
test('V031 policy save validation rejects impossible amendment and cost records',()=>{
  for(const mutate of [p=>p.cost=1,p=>p.terms='amended',p=>p.answered=true]){const s=started('ch10-tribunal');mutate(s.encounter.policy);assert.throws(()=>G.deserialize(G.serialize(s)),/Invalid save/);}
  const s=started('ch10-tribunal');assert.ok(G.tablePolicy(s,'audit').ok);s.encounter.policy.cost=2;assert.throws(()=>G.deserialize(G.serialize(s)),/Invalid save/);
});
test('V031 expanded 2D boards fit tall figures and retain exact tile picking on narrow layouts',()=>{
  for(const [width,height]of [[320,340],[800,350],[1440,520]])for(const cols of [8,10]){
    const canvas={getBoundingClientRect:()=>({left:0,top:0,width,height})},e={width:cols,height:8,featureEdition:31},g=geometry(canvas,e);
    assert.ok(g.oy-spriteHeight(g,{role:'cavalry'})>0,'Mounted head remains inside canvas');
    for(let y=0;y<8;y++)for(let x=0;x<cols;x++){const px=g.ox+(x-y)*g.tw/2,py=g.oy+(x+y)*g.th/2;assert.ok(px>0&&px<width&&py>0&&py<height);const picked=pickTile(canvas,e,px,py);assert.ok(picked.x===x&&picked.y===y);}
  }
});
test('V031 amendment forecasts start from visible stances and include reversals, even at the stance cap',()=>{
  const s=started('ch10-tribunal'),e=s.encounter,voters=e.units.filter(u=>u.role==='voter');
  // Injected stance-boundary scenario, not a campaign completion claim.
  for(const u of voters)u.stance=u.interest==='law'?5:0;
  assert.ok(G.tablePolicy(s,'audit').ok);e.policy.counter=true;e.units.find(u=>u.id==='hero').acted=false;
  const before=JSON.stringify(s),stances=new Map(voters.map(u=>[u.id,u.stance])),forecast=G.previewPolicy(s,'audit','amended');assert.equal(JSON.stringify(s),before);
  for(const c of forecast.changes)assert.equal(c.from,stances.get(c.id));
  assert.ok(G.tablePolicy(s,'audit','amended').ok);
  for(const u of voters)assert.equal(u.stance,forecast.changes.find(c=>c.id===u.id)?.to??stances.get(u.id));
  assert.ok(voters.filter(u=>u.interest==='law').every(u=>u.stance===6));
});
