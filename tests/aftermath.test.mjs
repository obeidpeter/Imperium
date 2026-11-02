// Release 14: the field after a victory (src/core/realtime/aftermath.js). A won real-time battle stays open and
// peaceful: the fallen and the found chests are searched through the chronicle (game.js takeSpoils,
// openFieldContainer, takeFromContainer), nothing fights and the world never ends, and taking the road to camp records
// the result once (game.js commitEncounter). The walking world is built from the chronicle and never saved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {REASONS} from '../src/data/realtime-rules.js';
import {queueCommand,step,snapshotWorld,commandProblem} from '../src/core/realtime/simulation.js';
import {abilityKey,autoPauseReason,commandOptions,pointerIntent} from '../src/core/realtime/intents.js';
import {tileCentre} from '../src/core/realtime/campaign-encounter.js';
import {playRealtime} from '../scripts/realtime-autoplay.mjs';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const copy=state=>Game.deserialize(Game.serialize(state));
// A battle from its board fixture, restarted in real time and played to its end by the legal-command bot.
function won(id){
  const s=Game.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id===`board-${id}`).state));
  assert.ok(Game.restartInRealtime(s).ok,id);assert.equal(playRealtime(s).status,'won',`${id} is won`);assert.equal(s.encounter.status,'won');
  return s;
}
const road=won('ch1-road'),station=won('ch3-station'),eagle=won('ch6-eagle'),city=won('ch9-city');
const hero=w=>w.actors.find(a=>a.id==='hero');
const at=(w,x,z)=>{const h=hero(w);h.x=x;h.z=z;h.px=x;h.pz=z;};
const run=(w,ticks)=>{const seen=[];for(let i=0;i<ticks;i++){step(w);seen.push(...w.events);}return seen;};

test('only a won, unrecorded real-time battle has a field to walk; building it changes nothing',()=>{
  for(const s of [road,station,eagle]){
    const before=Game.serialize(s),a=Game.createAftermathWorld(s),b=Game.createAftermathWorld(s);
    assert.equal(Game.serialize(s),before,'the chronicle, its random generator included, is unchanged');
    assert.equal(snapshotWorld(a),snapshotWorld(b),'the same field every time');
    assert.notEqual(a.actors,s.encounter.realtime.world.actors,'a copy, not the record');
  }
  const camp=Game.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id==='camp-1').state));
  assert.equal(Game.createAftermathWorld(camp),null,'not in camp');
  const active=Game.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id==='board-ch1-road').state));assert.ok(Game.restartInRealtime(active).ok);
  assert.equal(Game.createAftermathWorld(active),null,'not while the fight goes on');
  const lost=Game.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id==='board-ch1-road').state));assert.ok(Game.restartInRealtime(lost).ok);
  const w=Game.realtimeWorld(lost);w.actors.find(a=>a.id==='hero').alive=false;step(w);assert.equal(w.status,'lost');assert.ok(Game.resolveRealtime(lost,w).ok);
  assert.equal(Game.createAftermathWorld(lost),null,'a defeat keeps Retry');
  const recorded=copy(road);assert.ok(Game.commitEncounter(recorded).ok);assert.equal(Game.createAftermathWorld(recorded),null,'not once recorded');
  const turn=Game.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id==='board-ch1-road').state));assert.equal(Game.createAftermathWorld(turn),null,'not on the 0.38 board');
});

test('the living enemy have gone, the fallen keep what they carried, and the road to camp stands where the soldier entered',()=>{
  for(const s of [road,station,eagle]){
    const w=Game.createAftermathWorld(s),record=s.encounter.realtime.world;
    assert.equal(w.status,'active');assert.equal(w.aftermath,true);assert.equal(w.peaceful,true);assert.equal(w.mission,null);
    assert.ok(!w.actors.some(a=>a.side==='enemy'&&a.alive),'no enemy stands');
    for(const a of record.actors.filter(x=>!x.alive))assert.deepEqual(w.actors.find(x=>x.id===a.id).loot??[],a.loot??[],`${a.id} keeps his belongings`);
    assert.ok(w.actors.filter(a=>a.alive).every(a=>!a.drawn&&!a.order&&!a.action),'everyone stands at ease');
    const exit=w.objects.find(o=>o.id==='exit'),start=tileCentre(s.encounter.units.find(u=>u.id==='hero'),w.layout);
    assert.equal(exit.kind,'exit');assert.equal(exit.name,'The road to camp');assert.deepEqual(exit.exit,{to:'camp'});
    assert.ok(Math.hypot(exit.x-start.x,exit.z-start.z)<.01,'at the soldier’s start');
    assert.deepEqual(Game.aftermathExitFor(s).x,exit.x);
  }
  // In Practice the road leads back to the chronicle.
  const practice=copy(road);practice.archiveReplay=true;
  const exit=Game.createAftermathWorld(practice).objects.find(o=>o.id==='exit');
  assert.equal(exit.name,'The road back');assert.deepEqual(exit.exit,{to:'archive'});
});

test('nothing fights after a victory: weapons stay sheathed, no system runs, and the field never ends',()=>{
  const w=Game.createAftermathWorld(eagle),record=JSON.stringify(eagle.encounter.realtime.world);
  for(const command of [{kind:'setDrawn',payload:{drawn:true}},{kind:'warCry',payload:{}},{kind:'ability',payload:{abilityId:'shield_bash'}},
    {kind:'order',payload:{squadId:w.squads.find(q=>q.side==='player')?.id,order:{kind:'advance'}}}]){
    const before=snapshotWorld(w),r=queueCommand(w,{actorId:'hero',...command});
    assert.equal(r.ok,false,command.kind);assert.equal(r.reason,'PEACEFUL_FIELD',command.kind);assert.equal(snapshotWorld(w),before,`${command.kind} changes nothing`);
  }
  assert.equal(abilityKey(w,{abilityId:'shield_bash'}).message,REASONS.PEACEFUL_FIELD);
  assert.ok(!commandOptions(w).some(o=>/Draw weapons|war cry|^Attack/.test(o.label)),'the Command list offers no fighting');
  const events=run(w,4000);
  assert.equal(w.status,'active','two hundred seconds on, the field is still open');
  assert.deepEqual([...new Set(events.map(e=>e.kind))],['round'],'only the rounds pass');
  assert.equal(autoPauseReason(w,{kind:'round',round:9},{roundPause:true}),null,'and they never pause the world');
  assert.equal(JSON.stringify(eagle.encounter.realtime.world),record,'the record is untouched');
});

test('the field’s works stay as they were left; the world takes nothing itself, keeps hidden caches hidden, and changes no kit',()=>{
  const w=Game.createAftermathWorld(station),chest=w.objects.find(o=>o.id==='chest'),cache=w.objects.find(o=>o.id==='station-cache');
  assert.equal(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:chest.id}}).reason,'BATTLE_OVER');
  assert.equal(pointerIntent(w,{pick:{objectId:chest.id}}).reason,'BATTLE_OVER');
  assert.ok(!commandOptions(w).some(o=>o.subject===chest.id),'the objective chest is not offered');
  const body=w.actors.find(a=>!a.alive&&a.loot?.length);at(w,body.x+.5,body.z);
  assert.equal(commandProblem(w,{actorId:'hero',kind:'take',payload:{targetId:body.id,items:[body.loot[0]]}}),'NO_TARGET','a take is the chronicle’s');
  assert.equal(commandProblem(w,{actorId:'hero',kind:'setKit',payload:{kit:['tunic']}}),'NO_TARGET');
  assert.ok(queueCommand(w,{actorId:'hero',kind:'loot',payload:{targetId:body.id}}).ok,'searching him walks there');
  assert.ok(run(w,60).some(e=>e.kind==='loot'&&e.targetId===body.id),'and opens his belongings');
  // The cache nobody found in the fight stays hidden, even underfoot.
  assert.equal(cache.hidden,true);at(w,cache.x+.4,cache.z);run(w,40);assert.equal(cache.hidden,true);
  assert.equal(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:cache.id}}).reason,'NO_TARGET');
});

test('the fallen and the chests are searched through the chronicle, once, and the walking field follows',()=>{
  // Chapter IX's city: the defending captain fell with the key to the merchant's strongbox.
  const s=copy(city),w=Game.createAftermathWorld(s),box=w.objects.find(o=>o.id==='city-strongbox');
  assert.deepEqual(Game.fieldUnsearched(s).map(u=>u.id),['champion-city','city-strongbox']);
  // Locked: walking up and opening it only opens its window; the lock is the chronicle's.
  at(w,box.x+1,box.z);const before=JSON.stringify(box);
  assert.ok(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:box.id}}).ok,'no key is asked of the world');
  assert.ok(run(w,40).some(e=>e.kind==='used-object'&&e.objectId===box.id),'the soldier reaches it');
  assert.equal(JSON.stringify(box),before,'still locked and shut');
  assert.match(pointerIntent(w,{pick:{objectId:box.id}}).message,/\(locked\)/);
  const refused=(r,why)=>assert.equal(r.ok,false,why);
  const unchanged=Game.serialize(s);refused(Game.openFieldContainer(s,{objectId:box.id}),'no key yet');assert.equal(Game.serialize(s),unchanged);
  // The key from the fallen captain, then the strongbox it opens, then all it holds.
  const captain=s.encounter.realtime.world.actors.find(a=>a.id==='champion-city');assert.ok(captain.loot.includes('key_f9'));
  assert.ok(Game.takeSpoils(s,{bodyId:captain.id,items:[...captain.loot]}).ok);
  refused(Game.takeSpoils(s,{bodyId:captain.id,items:['key_f9']}),'a body is searched once');
  Game.syncAftermath(w,s);assert.deepEqual(w.actors.find(a=>a.id===captain.id).loot,[]);assert.ok(w.spoils.some(x=>x.itemId==='key_f9'));
  assert.ok(Game.openFieldContainer(s,{objectId:box.id}).ok);Game.syncAftermath(w,s);
  assert.equal(box.unlocked,true);assert.equal(box.opened,true);assert.ok(!w.spoils.some(x=>x.itemId==='key_f9'),'the key is used up');
  assert.ok(Game.takeFromContainer(s,{objectId:box.id,items:[...box.contents]}).ok);Game.syncAftermath(w,s);
  assert.deepEqual(box.contents,[]);assert.deepEqual(Game.fieldUnsearched(s),[],'nothing worth taking is left');
  assert.deepEqual(w.spoils.map(x=>x.itemId),s.encounter.realtime.world.spoils.map(x=>x.itemId));
  // A reload builds the same searched field again: the searching is in the chronicle.
  assert.equal(snapshotWorld(Game.createAftermathWorld(copy(s))),snapshotWorld(Game.createAftermathWorld(s)));
  // Practice can look but not take, so nothing is ever left behind there.
  const practice=copy(city);practice.archiveReplay=true;const p=Game.serialize(practice);
  refused(Game.takeSpoils(practice,{bodyId:'champion-city',items:['key_f9']}),'Practice takes nothing');assert.equal(Game.serialize(practice),p);
  assert.deepEqual(Game.fieldUnsearched(practice),[]);
});

test('a strongbox whose key left the field with a living enemy counts only for a soldier strong enough to force it',()=>{
  // Chapter III's station: the raiders' leader lived and left with the key; this soldier has the strength (STR 15 of 14).
  const s=copy(station),world=s.encounter.realtime.world;
  assert.ok(world.actors.some(a=>a.alive&&a.side==='enemy'&&a.loot?.includes('key_f3')),'the key left with him');
  assert.ok(!Game.createAftermathWorld(s).actors.some(a=>a.loot?.includes('key_f3')));
  assert.deepEqual(Game.fieldUnsearched(s).map(u=>u.id),['enemy0','station-strongbox']);
  // Injected: the same field for a weaker soldier, who cannot open it, so it is not named as left behind.
  const weak=copy(station);weak.encounter.realtime.world.actors.find(a=>a.id==='hero').attributes.str=10;
  assert.deepEqual(Game.fieldUnsearched(weak).map(u=>u.id),['enemy0']);
  const before=Game.serialize(weak);assert.equal(Game.openFieldContainer(weak,{objectId:'station-strongbox',method:'force'}).ok,false);assert.equal(Game.serialize(weak),before);
  // The strong soldier forces it and takes what it holds.
  assert.ok(Game.openFieldContainer(s,{objectId:'station-strongbox',method:'force'}).ok);
  const box=world.objects.find(o=>o.id==='station-strongbox');assert.ok(Game.takeFromContainer(s,{objectId:box.id,items:[...box.contents]}).ok);
  assert.deepEqual(Game.fieldUnsearched(s).map(u=>u.id),['enemy0']);
});

test('the road to camp records the result once; the field is never saved',()=>{
  const s=copy(road),w=Game.createAftermathWorld(s),exit=w.objects.find(o=>o.id==='exit');
  const state=Game.serialize(s);assert.equal(Game.saveRealtime(s,w).ok,false,'a walk on the won field is not a save');assert.equal(Game.serialize(s),state);
  // The soldier walks to the road and takes it: the world says so, and the page records the result.
  at(w,exit.x+3,exit.z);assert.ok(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:'exit'}}).ok);
  assert.ok(run(w,200).some(e=>e.kind==='used-object'&&e.objectId==='exit'),'the road is taken');
  assert.ok(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:'exit'}}).ok,'and can be taken again');
  const history=s.history.length;assert.ok(Game.commitEncounter(s).ok);assert.equal(s.history.length,history+1);
  const after=Game.serialize(s);assert.equal(Game.commitEncounter(s).ok,false,'a second use records nothing');assert.equal(Game.serialize(s),after);
  // The road is Chapter I's last battle: it leads to the promotion. The station's leads to the next camp.
  assert.equal(s.phase,'promotion');
  const next=copy(station);assert.ok(Game.commitEncounter(next).ok);assert.equal(next.phase,'camp');assert.equal(Game.createAftermathWorld(next),null);
});
