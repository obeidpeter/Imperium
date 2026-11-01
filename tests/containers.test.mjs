import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {CAMP_CONTAINERS,FIELD_CONTAINERS,CONTAINER_KINDS,containerById,containerChapter} from '../src/data/containers.js';
import {ITEMS} from '../src/data/items.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {queueCommand,step} from '../src/core/realtime/simulation.js';
import {pointerIntent} from '../src/core/realtime/intents.js';

// Release 11's chests and other containers: authored, the same on every level,
// opened once, and every refusal leaving the chronicle exactly as it was.
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const campState=chapter=>{const s=Game.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id===`camp-${chapter}`).state));s.decisions.ch2??='carry';return s;};
const act=(state,command)=>Game.soldierCommand(state,command);
const unchanged=(state,command,why)=>{const before=Game.serialize(state),r=act(state,command);assert.equal(r.ok,false,why);assert.equal(Game.serialize(state),before,why);return r;};

test('every container holds known items, names a known kind, and every lock has a key and a way without the attribute',()=>{
  const all=[...Object.values(CAMP_CONTAINERS).flat(),...Object.values(FIELD_CONTAINERS).flat()];
  assert.equal(new Set(all.map(c=>c.id)).size,all.length,'ids are unique');
  const encounters=new Set(CHAPTERS.flatMap(c=>c.encounters.map(e=>e.id)));
  for(const id of Object.keys(FIELD_CONTAINERS))assert.ok(encounters.has(id),`${id} is a campaign encounter`);
  for(let chapter=1;chapter<=12;chapter++)assert.ok(CAMP_CONTAINERS[chapter]?.length>=3,`chapter ${chapter} has at least three camp containers`);
  for(const c of all){
    assert.ok(CONTAINER_KINDS[c.kind],`${c.id} kind`);assert.ok(c.contents.length>=1&&c.contents.length<=12,`${c.id} contents`);
    for(const item of c.contents)assert.ok(ITEMS[item],`${c.id}: ${item}`);
    assert.ok(c.text&&c.name,`${c.id} says what it is and why it may be opened`);
    if(c.lock){assert.equal(ITEMS[c.lock.key]?.kind,'key',`${c.id} key`);assert.ok(Object.keys(c.lock.force??{}).length,`${c.id} can be forced`);}
  }
  // A camp lock's key lies in another container of the same camp.
  for(const [chapter,list]of Object.entries(CAMP_CONTAINERS))for(const c of list.filter(x=>x.lock))
    assert.ok(list.some(o=>o.id!==c.id&&o.contents.includes(c.lock.key)),`chapter ${chapter}: ${c.id}'s key is in its camp`);
  // Named pieces are only found: never on the armourer's rack.
  const named=Object.values(ITEMS).filter(i=>i.grade==='named').map(i=>i.id);
  assert.ok(named.length>=6);
});

test('a camp chest opens once: taking moves its contents to the pack and records each piece',()=>{
  const state=campState(1),view=Game.campContainerView(state,'c1-spare-kit');
  assert.ok(view.unlocked);assert.equal(view.remaining.length,3);
  const pack=state.soldier.pack.length,r=act(state,{kind:'takeFrom',containerId:'c1-spare-kit'});
  assert.ok(r.ok,r.message);
  assert.deepEqual(state.soldier.pack.slice(pack).map(e=>e.id),['sagum','calcei','key_c1']);
  assert.deepEqual(state.soldier.opened,['c1-spare-kit:0','c1-spare-kit:1','c1-spare-kit:2']);
  assert.ok(Game.campContainerView(state,'c1-spare-kit').empty);
  unchanged(state,{kind:'takeFrom',containerId:'c1-spare-kit'},'an empty chest gives nothing more');
  unchanged(state,{kind:'takeFrom',containerId:'c1-spare-kit',indices:[0]},'a piece is taken once');
  // The record survives a save round trip, and a forged one is refused.
  const loaded=Game.deserialize(Game.serialize(state));assert.deepEqual(loaded.soldier.opened,state.soldier.opened);
  const forged=JSON.parse(Game.serialize(state));forged.soldier.opened.push('c1-spare-kit:9');
  assert.throws(()=>Game.deserialize(JSON.stringify(forged)));
});

test('a locked camp chest opens with its key (used up) or by force, and refusals change nothing',()=>{
  const state=campState(1);
  unchanged(state,{kind:'takeFrom',containerId:'c1-armoury'},'locked');
  unchanged(state,{kind:'unlock',containerId:'c1-armoury',method:'key'},'no key yet');
  state.soldier.base.str=10;
  unchanged(state,{kind:'unlock',containerId:'c1-armoury',method:'force'},'too weak to force it');
  unchanged(state,{kind:'unlock',containerId:'c1-armoury',method:'pick'},'an unknown method');
  unchanged(state,{kind:'unlock',containerId:'c2-wagon',method:'key'},'another chapter’s chest is not here');
  assert.ok(act(state,{kind:'takeFrom',containerId:'c1-spare-kit'}).ok);
  assert.ok(state.soldier.pack.some(e=>e.id==='key_c1'));
  const r=act(state,{kind:'unlock',containerId:'c1-armoury',method:'key'});assert.ok(r.ok,r.message);
  assert.ok(!state.soldier.pack.some(e=>e.id==='key_c1'),'the key stays in the lock');
  assert.ok(act(state,{kind:'takeFrom',containerId:'c1-armoury'}).ok);
  assert.ok(state.soldier.pack.some(e=>e.id==='gladius')&&state.soldier.pack.some(e=>e.id==='amulet_mars'));
  // A strong soldier forces the lock instead.
  const strong=campState(1);strong.soldier.base.str=13;
  assert.ok(act(strong,{kind:'unlock',containerId:'c1-armoury',method:'force'}).ok);
  unchanged(strong,{kind:'unlock',containerId:'c1-armoury',method:'force'},'not locked any more');
});

test('a full pack takes what fits and leaves the rest; with no room nothing changes',()=>{
  const state=campState(1);
  for(let i=0;i<60;i++)if(!Game.soldierCommand(state,{kind:'buy',itemId:'wine_skin'}).ok)break;
  state.soldier.denarii=999;while(act(state,{kind:'buy',itemId:'wax_tablet',from:'trader'}).ok);
  unchanged(state,{kind:'takeFrom',containerId:'c1-locker'},'no room at all');
  assert.ok(Game.campContainerView(state,'c1-locker').remaining.length===2);
});

test('camp containers are opened only in camp and never in practice',()=>{
  const state=campState(1),before=Game.serialize(state);
  const enc=Game.deserialize(before);enc.phase='encounter';
  assert.equal(act(enc,{kind:'takeFrom',containerId:'c1-spare-kit'}).ok,false);
  assert.equal(Game.serialize(state),before);
});

test('the camp world shows each container with its state, keeps hidden caches out of reach until found, and a take changes the camp',()=>{
  const state=campState(3),world=Game.createCampWorld(state);
  const cache=world.objects.find(o=>o.id==='c3-milestone'),chest=world.objects.find(o=>o.id==='c3-iron-chest');
  assert.equal(cache.kind,'container');assert.equal(cache.hidden,true);assert.equal(chest.locked,true);
  assert.equal(queueCommand(world,{actorId:'hero',kind:'interact',payload:{objectId:cache.id}}).ok,false,'a hidden cache cannot be targeted');
  assert.equal(pointerIntent(world,{pick:{objectId:cache.id}}).command,null);
  // Walking close enough finds it.
  const hero=world.actors.find(a=>a.id==='hero');hero.x=cache.x+1;hero.z=cache.z;step(world);
  assert.equal(cache.hidden,false);assert.ok(world.events.some(e=>e.kind==='found'&&e.objectId===cache.id));
  assert.ok(queueCommand(world,{actorId:'hero',kind:'interact',payload:{objectId:cache.id}}).ok);
  const key=Game.campContainerView,before=JSON.stringify(Game.createCampWorld(state).objects.find(o=>o.id==='c3-lockers'));
  assert.ok(act(state,{kind:'takeFrom',containerId:'c3-lockers'}).ok);
  assert.notEqual(JSON.stringify(Game.createCampWorld(state).objects.find(o=>o.id==='c3-lockers')),before,'the emptied lockers show as empty');
  assert.ok(key(state,'c3-lockers').empty);
});

test('containers are the same on every level',()=>{
  for(const difficulty of ['story','standard','veteran']){
    const state=campState(4);state.difficulty=difficulty;
    assert.deepEqual(Game.campContainerView(state,'c4-tower').container.contents,['manica_scale']);
  }
  for(const c of Object.values(CAMP_CONTAINERS).flat())assert.equal(containerChapter(c.id)!==null,true);
  assert.equal(containerById('road-sack').contents[0],'coin_purse');
});

// ——— Battlefield containers: staged like the spoils of the fallen ———
import {runRealtimeCampaign,playRealtime,heroDecision} from '../scripts/realtime-autoplay.mjs';
import {actorById} from '../src/core/realtime/abilities.js';
import {routePreview} from '../src/core/realtime/simulation.js';
function reach(id,{seed=275}={}){
  let found=null;
  const state=Game.newGame('Aurelius Marcellus',seed,{featureEdition:35,progression:true});
  for(let guard=0;guard<80&&!found;guard++){
    const chapter=Game.getChapter(state),data=chapter.encounters[state.encounterIndex];
    if(state.phase==='camp'){
      if(!state.decisions[chapter.decision.id])Game.choose(state,chapter.decision.options[0].id);
      if(state.chapter===1&&state.encounterIndex>0&&!state.oath)Game.swearOath(state);
      assert.ok(Game.startEncounter(state,{controls:'realtime'}).ok);if(data.id===id)found=state;
    }else if(state.phase==='encounter'){assert.equal(playRealtime(state).status,'won');assert.ok(Game.commitEncounter(state).ok);}
    else assert.ok(Game.advanceChapter(state).ok);
  }
  return found;
}
const walkTo=(w,objectId,ticks=900)=>{assert.ok(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId}}).ok);
  let opened=false;for(let i=0;i<ticks&&!opened;i++){step(w);opened=w.events.some(e=>e.kind==='used-object'&&e.objectId===objectId);}return opened;};

test('a battlefield chest stands on reachable open ground, opens with the weapon sheathed, and what is taken is staged until the result is recorded',()=>{
  const s=reach('ch1-road'),w=Game.realtimeWorld(s),sack=w.objects.find(o=>o.id==='road-sack');
  assert.ok(sack,'the raider’s sack is on the field');assert.deepEqual(sack.contents,['coin_purse','wine_skin']);
  const end=routePreview(w,'hero',sack).points.at(-1);assert.ok(end&&Math.hypot(end.x-sack.x,end.z-sack.z)<=1.8,'reachable');
  const hero=actorById(w,'hero');
  if(hero.drawn){assert.equal(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:sack.id}}).reason,'NEEDS_SHEATHED');
    queueCommand(w,{actorId:'hero',kind:'setDrawn',payload:{drawn:false}});step(w);}
  assert.equal(queueCommand(w,{actorId:'hero',kind:'takeFrom',payload:{objectId:sack.id,items:['coin_purse']}}).reason,'NO_TARGET','not open yet');
  hero.x=sack.x+1;hero.z=sack.z;hero.px=hero.x;hero.pz=hero.z;
  assert.ok(walkTo(w,sack.id),'the soldier opens it');
  assert.equal(queueCommand(w,{actorId:'hero',kind:'takeFrom',payload:{objectId:sack.id,items:['galea_crest']}}).reason,'NO_TARGET','only what is inside');
  assert.ok(queueCommand(w,{actorId:'hero',kind:'takeFrom',payload:{objectId:sack.id,items:['coin_purse','wine_skin']}}).ok);step(w);
  assert.deepEqual(w.spoils.map(x=>x.itemId),['coin_purse','wine_skin']);assert.equal(sack.contents.length,0);
  const pack=s.soldier.pack.length;assert.ok(Game.saveRealtime(s,w).ok);assert.equal(s.soldier.pack.length,pack,'not yet in the pack');
  const loaded=Game.deserialize(Game.serialize(s));assert.equal(Game.realtimeWorld(loaded).objects.find(o=>o.id==='road-sack').contents.length,0,'a reload cannot refill it');
  const retried=Game.deserialize(Game.serialize(s));assert.ok(Game.retry(retried).ok);
  assert.deepEqual(Game.realtimeWorld(retried).objects.find(o=>o.id==='road-sack').contents,['coin_purse','wine_skin'],'Retry restores it');
  const forged=JSON.parse(Game.serialize(s));forged.encounter.realtime.world.objects.find(o=>o.id==='road-sack').contents=['no_such_item'];
  assert.throws(()=>Game.deserialize(JSON.stringify(forged)));
});

test('the station strongbox opens with the key the raider carried, or by a strong enough soldier; the cache waits for Scout',()=>{
  const s=reach('ch3-station'),w=Game.realtimeWorld(s),box=w.objects.find(o=>o.id==='station-strongbox'),cache=w.objects.find(o=>o.id==='station-cache');
  assert.ok(box&&cache);assert.equal(cache.hidden,true);
  assert.ok(w.actors.some(a=>a.side==='enemy'&&a.loot?.includes('key_f3')),'the raiders’ leader carries the key');
  const hero=actorById(w,'hero');if(hero.drawn){queueCommand(w,{actorId:'hero',kind:'setDrawn',payload:{drawn:false}});step(w);}
  assert.equal(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:box.id}}).reason,'LOCKED');
  const weak=JSON.parse(JSON.stringify(w));actorById(weak,'hero').attributes.str=10;
  assert.equal(queueCommand(weak,{actorId:'hero',kind:'interact',payload:{objectId:box.id,force:true}}).reason,'TOO_WEAK');
  assert.equal(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:cache.id}}).reason,'NO_TARGET','a hidden cache cannot be targeted');
  // With the key among the spoils (injected here), the box opens and the key is used up.
  w.spoils.push({itemId:'key_f3',from:'enemy1'});hero.x=box.x+1;hero.z=box.z;hero.px=hero.x;hero.pz=hero.z;
  assert.ok(walkTo(w,box.id));assert.equal(box.unlocked,true);assert.ok(!w.spoils.some(x=>x.itemId==='key_f3'));
  // A strong soldier forces it instead: five seconds of work.
  const strong=Game.realtimeWorld(s),sb=strong.objects.find(o=>o.id==='station-strongbox'),sh=actorById(strong,'hero');
  if(sh.drawn){queueCommand(strong,{actorId:'hero',kind:'setDrawn',payload:{drawn:false}});step(strong);}
  sh.attributes={...sh.attributes,str:14};sh.x=sb.x+1;sh.z=sb.z;sh.px=sh.x;sh.pz=sh.z;
  assert.ok(queueCommand(strong,{actorId:'hero',kind:'interact',payload:{objectId:sb.id,force:true}}).ok);
  let opened=false;for(let i=0;i<300&&!opened;i++){step(strong);opened=strong.events.some(e=>e.kind==='unlocked'&&e.objectId===sb.id);}
  assert.ok(opened,'forced');
  // Scout reveals the cache within its radius.
  const scouted=Game.realtimeWorld(s),sc=scouted.objects.find(o=>o.id==='station-cache');
  scouted.reveals.push({x:sc.x,z:sc.z,radius:30,until:scouted.tick+100});step(scouted);assert.equal(sc.hidden,false);
});

test('after a won fight the found chests open and are taken from the result once; Practice cannot take',()=>{
  const s=reach('ch1-road');assert.equal(playRealtime(s).status,'won');
  const before=Game.serialize(s);
  assert.equal(Game.takeFromContainer(s,{objectId:'road-sack',items:['galea_crest']}).ok,false);assert.equal(Game.serialize(s),before);
  const sack=s.encounter.realtime.world.objects.find(o=>o.id==='road-sack'),items=[...sack.contents];
  assert.ok(Game.takeFromContainer(s,{objectId:'road-sack',items}).ok);
  assert.equal(Game.takeFromContainer(s,{objectId:'road-sack',items}).ok,false,'nothing left inside');
  const count=id=>[...s.soldier.pack,...Object.values(s.soldier.ground).flat()].filter(e=>e.id===id).length,had=items.map(count);
  assert.ok(Game.commitEncounter(s).ok);items.forEach((id,i)=>assert.ok(count(id)>had[i],`${id} reached the pack`));
});

test('every battlefield container is placed on open ground the soldier can reach, clear of the field’s other objects',()=>{
  for(const id of Object.keys(FIELD_CONTAINERS)){
    const scene=fixtures.scenes.find(x=>x.id===`board-${id}`);assert.ok(scene,`${id} fixture`);
    const s=Game.deserialize(JSON.stringify(scene.state));assert.ok(Game.restartInRealtime(s).ok,id);
    const w=Game.realtimeWorld(s);
    for(const c of FIELD_CONTAINERS[id]){
      const o=w.objects.find(x=>x.id===c.id);assert.ok(o,`${id}: ${c.id} placed`);
      const end=routePreview(w,'hero',o).points.at(-1);assert.ok(end&&Math.hypot(end.x-o.x,end.z-o.z)<=1.8,`${id}: ${c.id} reachable`);
      for(const other of w.objects.filter(x=>x!==o))assert.ok(Math.hypot(other.x-o.x,other.z-o.z)>=2.4,`${id}: ${c.id} clear of ${other.id}`);
    }
  }
});
