import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {createSoldier,packAdd,validateSoldier} from '../src/core/soldier.js';
import {smithStock} from '../src/data/soldier.js';

// Release 13: the inventory screen places a dragged or carried piece where the player put it. The
// soldier's commands that bring a piece into the pack take an optional chosen place; a charm may name
// its place; a piece is worn straight from the ground; a worn piece is left straight on the ground.
// A refusal leaves the whole chronicle, its random generator included, unchanged.

const camp=(extra={})=>({chapter:1,phase:'camp',decisions:{},company:[{id:'lucan',commendations:0}],chapterCapabilities:{},
  rng:{seed:7,state:123456789},soldier:createSoldier({path:'legionary'}),...extra});
const fail=m=>{throw new Error(m);};
const refused=(state,command,pattern)=>{
  const before=JSON.stringify(state),r=G.soldierCommand(state,command);
  assert.equal(r.ok,false,`${command.kind} is refused`);if(pattern)assert.match(r.message,pattern);
  assert.equal(JSON.stringify(state),before,`a refused ${command.kind} changes nothing`);return r;
};
const at=(state,id)=>state.soldier.pack.find(e=>e.id===id);

test('a piece picked up from the ground goes to the place chosen in the pack, or nowhere',()=>{
  const s=camp(),cap=packAdd(s.soldier,'arming_cap');
  assert.ok(G.soldierCommand(s,{kind:'drop',uid:cap.uid}).ok);
  const ground=s.soldier.ground['camp:1'][0];
  refused(s,{kind:'pickUp',uid:ground.uid,x:10,y:0},/does not fit/);
  const wine=at(s,'wine_skin');refused(s,{kind:'pickUp',uid:ground.uid,x:wine.x,y:wine.y},/does not fit/);
  refused(s,{kind:'pickUp',uid:ground.uid,x:2},/place in the pack/);
  refused(s,{kind:'pickUp',uid:ground.uid,x:'3',y:'2'},/place in the pack/);
  assert.ok(G.soldierCommand(s,{kind:'pickUp',uid:ground.uid,x:9,y:5}).ok);
  assert.deepEqual([at(s,'arming_cap').x,at(s,'arming_cap').y],[9,5]);assert.equal(s.soldier.ground['camp:1'],undefined);
  assert.doesNotThrow(()=>validateSoldier(s,fail));
});

test('a worn piece taken off goes to a chosen place, the first free place, or straight to the ground',()=>{
  const s=camp();
  refused(s,{kind:'takeOff',place:'shield:0',x:9,y:4},/does not fit/);
  assert.ok(G.soldierCommand(s,{kind:'takeOff',place:'shield:0',x:8,y:2}).ok);
  assert.deepEqual([at(s,'training_shield').x,at(s,'training_shield').y],[8,2]);
  assert.ok(G.soldierCommand(s,{kind:'takeOff',place:'head:1',ground:true}).ok);
  assert.equal(s.soldier.worn['head:1'],undefined);assert.deepEqual(s.soldier.ground['camp:1'].map(g=>g.id),['galea']);
  // The oath's seal is kept: it is never left on the ground, worn or not.
  s.soldier.worn['charm:0']='signaculum';refused(s,{kind:'takeOff',place:'charm:0',ground:true},/keep/);
  assert.ok(G.soldierCommand(s,{kind:'takeOff',place:'charm:0'}).ok);assert.ok(at(s,'signaculum'));
  assert.doesNotThrow(()=>validateSoldier(s,fail));
});

test('a piece on the ground is worn straight from it, and a charm takes the charm place it is dropped on',()=>{
  const s=camp(),cloak=packAdd(s.soldier,'sagum');
  assert.ok(G.soldierCommand(s,{kind:'drop',uid:cloak.uid}).ok);
  const strip=s.soldier.ground['camp:1'][0];
  refused(s,{kind:'wear',uid:strip.uid,place:'head:1'},/not worn there/);
  assert.ok(G.soldierCommand(s,{kind:'wear',uid:strip.uid}).ok);
  assert.equal(s.soldier.worn['body:3'],'sagum');assert.equal(s.soldier.ground['camp:1'],undefined);
  // A piece too heavy for him stays where it lies.
  const axe=packAdd(s.soldier,'axe');s.soldier.base.str=10;assert.ok(G.soldierCommand(s,{kind:'drop',uid:axe.uid}).ok);
  refused(s,{kind:'wear',uid:s.soldier.ground['camp:1'][0].uid},/Strength 12/);
  // Two charm places: the second is chosen while the first is taken, and a charm can replace either.
  const mars=packAdd(s.soldier,'amulet_mars'),eye=packAdd(s.soldier,'eye_amulet'),seal=packAdd(s.soldier,'phylactery');
  assert.ok(G.soldierCommand(s,{kind:'wear',uid:mars.uid}).ok);assert.equal(s.soldier.worn['charm:0'],'amulet_mars');
  assert.ok(G.soldierCommand(s,{kind:'wear',uid:eye.uid,place:'charm:1'}).ok);assert.equal(s.soldier.worn['charm:1'],'eye_amulet');
  assert.ok(G.soldierCommand(s,{kind:'wear',uid:seal.uid,place:'charm:1'}).ok);
  assert.deepEqual([s.soldier.worn['charm:0'],s.soldier.worn['charm:1']],['amulet_mars','phylactery']);assert.ok(at(s,'eye_amulet'),'the replaced charm goes to the pack');
  refused(s,{kind:'wear',uid:at(s,'eye_amulet').uid,place:'charm:2'},/not worn there/);
  refused(s,{kind:'wear',uid:at(s,'eye_amulet').uid,place:7},/not worn there/);
  assert.doesNotThrow(()=>validateSoldier(s,fail));
});

test('a bought piece goes to the place chosen in the pack; a refused place keeps the purse',()=>{
  const s=camp({chapter:3});s.soldier.denarii=500;const id='tunic_winter';assert.ok(smithStock(3).includes(id),'the smith sells the winter tunic in Chapter III');
  refused(s,{kind:'buy',itemId:id,from:'smith',x:9,y:5},/does not fit/);
  refused(s,{kind:'buy',itemId:id,from:'smith',y:1},/place in the pack/);
  assert.ok(G.soldierCommand(s,{kind:'buy',itemId:id,from:'smith',x:5,y:0}).ok);
  assert.deepEqual([at(s,id).x,at(s,id).y],[5,0]);assert.ok(s.soldier.denarii<500);
  assert.doesNotThrow(()=>validateSoldier(s,fail));
});

test('one piece taken from a camp chest goes to a chosen place; a chosen place takes one piece only',()=>{
  const s=camp();
  refused(s,{kind:'takeFrom',containerId:'c1-spare-kit',indices:[0,1],x:6,y:0},/one item/);
  refused(s,{kind:'takeFrom',containerId:'c1-spare-kit',indices:[0],x:9,y:5},/does not fit/);
  assert.ok(G.soldierCommand(s,{kind:'takeFrom',containerId:'c1-spare-kit',indices:[0],x:6,y:0}).ok);
  assert.deepEqual([at(s,'sagum').x,at(s,'sagum').y],[6,0]);assert.deepEqual(s.soldier.opened,['c1-spare-kit:0']);
  // Without a place: the first free places, as before.
  assert.ok(G.soldierCommand(s,{kind:'takeFrom',containerId:'c1-spare-kit'}).ok);assert.equal(s.soldier.opened.length,3);
  assert.doesNotThrow(()=>validateSoldier(s,fail));
});

test('in a fight the pack, the worn kit and the ground do not change',()=>{
  const s=camp();const cap=packAdd(s.soldier,'arming_cap');G.soldierCommand(s,{kind:'drop',uid:cap.uid});
  const field={...s,phase:'encounter',encounter:{id:'ch1-road'}};
  for(const command of [{kind:'pickUp',uid:s.soldier.ground['camp:1'][0].uid,x:0,y:3},{kind:'takeOff',place:'head:1',ground:true},
    {kind:'wear',uid:s.soldier.ground['camp:1'][0].uid},{kind:'move',uid:at(s,'wine_skin').uid,x:4,y:4}])
    refused(field,command,/in camp/);
});
