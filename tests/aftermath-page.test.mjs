// Release 14: the field after a victory on the page. The result offers to walk the field beside Continue; walked, a
// strip stands in for the result and the field keeps its HUD; a chest still locked shows its key and its force; the
// road to camp is a waypost on the 3D stage among the containers; the music keeps the victory and the fight's lessons
// are over. Presentation only: nothing here changes the chronicle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import * as G from '../src/core/game.js';
import {playRealtime} from '../scripts/realtime-autoplay.mjs';
import {realtimeEncounterView,realtimeResult} from '../src/ui/realtime-view.js';
import {inventoryScreen} from '../src/ui/inventory-views.js';
import {stageContainers} from '../src/showcase/live-figures.js';
import {createContainerProps} from '../src/showcase/container-props.js';
import {audioDirection} from '../src/ui/soundscape-data.js';
import {realtimeLesson} from '../src/ui/realtime-lessons.js';
import {DEFAULT_KEYMAP} from '../src/ui/action-map.js';
import {Document} from './mini-dom.mjs';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const doc=html=>{const d=new Document();d.body.innerHTML=html;return d;};
const board=id=>{const s=G.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id===`board-${id}`).state));assert.ok(G.restartInRealtime(s).ok,id);return s;};
const won=id=>{const s=board(id);assert.equal(playRealtime(s).status,'won',id);return s;};
const city=won('ch9-city'),road=won('ch1-road');
const copy=s=>G.deserialize(G.serialize(s));

test('a won field offers a walk beside Continue, first while something is left to take; the drill yard and a defeat do not',()=>{
  const actions=s=>doc(realtimeResult(s,{keymap:DEFAULT_KEYMAP})).querySelector('.rt-result-actions');
  const r=actions(city),walk=r.querySelector('[data-cmd="walk-field"]');
  assert.ok(walk,'Walk the field');assert.ok(walk.classList.contains('primary'),'first, with the captain and the strongbox to search');
  assert.ok(r.querySelector('[data-cmd="commit"]'));assert.equal(r.querySelector('[data-cmd="commit"]').classList.contains('primary'),false);
  // Searched bare, Continue comes first again.
  const searched=copy(city),world=searched.encounter.realtime.world,captain=world.actors.find(a=>a.id==='champion-city');
  assert.ok(G.takeSpoils(searched,{bodyId:captain.id,items:[...captain.loot]}).ok);assert.ok(G.openFieldContainer(searched,{objectId:'city-strongbox'}).ok);
  const box=world.objects.find(o=>o.id==='city-strongbox');assert.ok(G.takeFromContainer(searched,{objectId:box.id,items:[...box.contents]}).ok);
  const after=actions(searched);assert.ok(after.querySelector('[data-cmd="walk-field"]'));assert.ok(after.querySelector('[data-cmd="commit"]').classList.contains('primary'));
  // Practice walks too, and returns to the chronicle; nothing to record.
  const practice=copy(city);practice.archiveReplay={title:'Practice',recordedTurns:6,recordedLosses:0};
  const p=actions(practice);assert.ok(p.querySelector('[data-cmd="walk-field"]'));assert.ok(p.querySelector('[data-cmd="exit-archive"]'));assert.equal(p.querySelector('[data-cmd="commit"]'),null);
  // The drill yard has nothing to search: its result records the drill.
  const drill=board('ch1-training'),w=G.realtimeWorld(drill);w.status='won';
  const resolved=copy(drill);resolved.encounter.status='won';resolved.encounter.realtime.world=JSON.parse(JSON.stringify(w));
  assert.equal(doc(realtimeResult(resolved)).querySelector('[data-cmd="walk-field"]'),null,'not the drill yard');
  const lost=copy(city);lost.encounter.status='lost';assert.equal(doc(realtimeResult(lost)).querySelector('[data-cmd="walk-field"]'),null,'a defeat keeps Retry');
});

test('walked, a strip stands in for the result: what to do, the result again, and Continue; the field keeps its HUD',()=>{
  const page=doc(realtimeEncounterView({state:city,keymap:DEFAULT_KEYMAP,walking:true})),main=page.querySelector('main');
  assert.equal(main.getAttribute('data-outcome'),'walking','the field plays: its HUD and clicks stay (realtime.css)');
  assert.equal(page.querySelector('.rt-result'),null,'no result over the world');
  const strip=page.querySelector('.rt-aftermath');assert.ok(strip);assert.match(strip.textContent,/Search the fallen and the chests, then take the road to camp/);
  assert.ok(strip.querySelector('[data-cmd="walk-field-end"]'));assert.ok(strip.querySelector('[data-cmd="commit"]'));
  assert.match(page.querySelector('.rt-chronicle-bar').textContent,/After the battle/);
  // Not walking, or not won, the result is shown as before.
  assert.ok(doc(realtimeEncounterView({state:city,keymap:DEFAULT_KEYMAP})).querySelector('.rt-result'));
  const lost=copy(city);lost.encounter.status='lost';
  assert.ok(doc(realtimeEncounterView({state:lost,keymap:DEFAULT_KEYMAP,walking:true})).querySelector('.rt-result'),'a stale walk never hides a defeat');
  const practice=copy(city);practice.archiveReplay={title:'Practice',recordedTurns:6,recordedLosses:0};
  const p=doc(realtimeEncounterView({state:practice,keymap:DEFAULT_KEYMAP,walking:true})).querySelector('.rt-aftermath');
  assert.match(p.textContent,/Nothing here is taken or recorded/);assert.ok(p.querySelector('[data-cmd="exit-archive"]'));assert.equal(p.querySelector('[data-cmd="commit"]'),null);
});

test('a chest still locked after the battle shows its key, once taken, and force for a strong enough soldier',()=>{
  const lock=(hasKey,strong)=>doc(inventoryScreen(city,{other:{kind:'loot',title:'A merchant’s strongbox',id:'city-strongbox',left:['squamata_tinned'],pending:[],
    cmd:'rt-take-from',empty:'It is empty.',lock:{key:'key_f9',force:{str:15},hasKey,strong}}})).querySelector('.inv-other');
  const none=lock(false,false),key=none.querySelector('[data-cmd="rt-open-box"][data-method="key"]'),force=none.querySelector('[data-cmd="rt-open-box"][data-method="force"]');
  assert.ok(key.disabled);assert.ok(force.disabled);assert.match(force.textContent,/STR 15|Strength 15/);
  assert.equal(none.querySelector('[data-cmd="rt-take-from"]'),null,'nothing is taken from a locked chest');
  const both=lock(true,true);
  assert.equal(both.querySelector('[data-method="key"]').disabled,false);assert.equal(both.querySelector('[data-method="force"]').disabled,false);
  assert.match(both.textContent,/You have taken the key to the merchant’s strongbox/);
  // Unlocked, it is a field cache's window as in the fight.
  const open=doc(inventoryScreen(city,{other:{kind:'loot',title:'A merchant’s strongbox',id:'city-strongbox',left:['squamata_tinned'],pending:[],cmd:'rt-take-from',empty:'It is empty.',lock:null}}));
  assert.ok(open.querySelector('[data-cmd="rt-take-from"][data-item="*"]'));
});

test('the road out of a won field is a waypost among the containers, in their materials; a camp’s way out is its scenery’s',()=>{
  const walk=G.createAftermathWorld(city),list=stageContainers(walk),post=list.find(c=>c.id==='exit');
  assert.equal(post.box,'waypost');assert.ok(list.some(c=>c.id==='city-strongbox'),'the strongbox as before');
  assert.equal(stageContainers(G.realtimeWorld(city)).some(c=>c.box==='waypost'),false,'not in the fight');
  const camp=G.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id==='camp-3').state));
  assert.ok(G.createCampWorld(camp).objects.some(o=>o.kind==='exit'));assert.equal(stageContainers(G.createCampWorld(camp)).some(c=>c.box==='waypost'),false);
  const scene=new T.Scene(),props=createContainerProps(scene,{heightAt:()=>0});assert.ok(props.sync([post]));
  const materials=new Set();props.group.traverse(o=>{if(o.isMesh)materials.add(o.material);});
  assert.ok([...materials].every(m=>m.isMeshStandardMaterial&&/^fieldwork /.test(m.name)),'the containers’ own materials: no new program');
  const box=new T.Box3().setFromObject(props.group);assert.ok(box.max.y>1.6,'a post a man’s height');props.dispose();
});

test('the walked field keeps the victory’s music and has no fight lessons; neither reads more than the page shows',()=>{
  const walk=G.createAftermathWorld(city),hero=walk.actors.find(a=>a.id==='hero');hero.hp=1;
  assert.equal(audioDirection(city,'game',walk).mood,'victory','a wounded soldier on a won field hears the victory');
  assert.notEqual(audioDirection(board('ch9-city'),'game',G.realtimeWorld(board('ch9-city'))).mood,'victory','a fight is a fight');
  const walkRoad=G.createAftermathWorld(road);
  assert.equal(realtimeLesson({state:road,world:walkRoad,kind:'field',seen:{},keymap:DEFAULT_KEYMAP}),null,'Chapter I’s patrol lessons are over');
  const before=G.serialize(city);realtimeResult(city);realtimeEncounterView({state:city,keymap:DEFAULT_KEYMAP,walking:true});assert.equal(G.serialize(city),before);
});
