import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as G from '../src/core/game.js';
import {chamberFor,controlsFor} from '../src/core/controls-model.js';
import {playRealtime} from '../scripts/realtime-autoplay.mjs';
import {realtimeEncounterView} from '../src/ui/realtime-view.js';
import {chamberEncounterView} from '../src/ui/chamber-view.js';
import {DEFAULT_KEYMAP} from '../src/ui/action-map.js';
import {Document} from './mini-dom.mjs';

// Practice (the Archive's sandbox replay) plays a completed encounter as the chronicle
// plays: in real time where its chapter does, a Contest walked in the chamber. The
// chronicle is New Game's legal autoplay at Chapter XII's camp (graphics fixtures).
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const chronicle=()=>G.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id==='camp-12').state));
const documentFor=html=>{const doc=new Document();doc.body.innerHTML=html;return doc;};
const REALTIME={controlsModel:'realtime'};
const practise=(s,id,options={})=>{const r=G.createArchiveReplay(s,id,{...options,controls:'realtime'});assert.ok(r.ok,r.message);return r.state;};

test('Practice plays a completed battle in real time and leaves the chronicle as it was',()=>{
  const s=chronicle(),before=G.serialize(s);
  assert.equal(controlsFor(REALTIME,4),'realtime');
  const p=practise(s,'ch4-gate');
  assert.equal(G.isRealtime(p),true);assert.ok(G.realtimeWorld(p));
  assert.equal(p.archiveReplay.encounterId,'ch4-gate');assert.equal(p.chapter,4);
  assert.equal(G.serialize(s),before,'opening practice changes nothing in the chronicle, its random generator included');
  assert.deepEqual(practise(s,'ch4-gate').encounter.realtime.world,p.encounter.realtime.world,'the same practice is the same fight');
  assert.equal(G.isRealtime(G.createArchiveReplay(s,'ch4-gate').state),false,'without real time it opens on the turn-based board');
});

test('the mutators set a real-time practice field: difficulty, weather and the hour',()=>{
  const s=chronicle(),p=practise(s,'ch10-road',{difficulty:'veteran',weather:'rain',timeOfDay:'dusk'}),world=G.realtimeWorld(p);
  assert.equal(p.difficulty,'veteran');assert.equal(p.encounter.weather,'rain');assert.equal(p.encounter.timeOfDay,'dusk');
  assert.equal(world.difficulty,'veteran');assert.equal(world.weather,'rain');assert.equal(world.timeOfDay,'dusk');
});

test('practice records nothing: no save, no result, no spoils, and Retry stays in practice',()=>{
  const s=chronicle(),before=G.serialize(s),p=practise(s,'ch4-gate');
  assert.match(G.manualSaveProblem(p),/Practice is not saved/);assert.equal(G.manualSaveProblem(s),null);
  const played=playRealtime(p);assert.notEqual(played.status,'active');
  const commit=G.commitEncounter(p);assert.equal(commit.ok,false);
  if(p.encounter.status==='won'){
    assert.match(commit.message,/Archive replay complete/);
    // The field is won, so only practice refuses the search.
    const body=played.world.actors.find(a=>a.side==='enemy'&&!a.alive);assert.ok(body);
    assert.equal(G.takeSpoils(p,{bodyId:body.id,items:body.loot?.length?body.loot.slice(0,1):['gladius']}).ok,false,'the fallen are not searched in practice');
  }
  const retried=G.retry(p);assert.ok(retried.ok,retried.message);
  assert.equal(G.isRealtime(p),true);assert.equal(p.encounter.status,'active');assert.equal(p.archiveReplay.encounterId,'ch4-gate');
  assert.equal(G.serialize(s),before);
});

test('the real-time practice page names the practice, its mutators and the way back, and its result keeps no record',()=>{
  const s=chronicle(),p=practise(s,'ch4-gate'),doc=documentFor(realtimeEncounterView({state:p,keymap:DEFAULT_KEYMAP}));
  const banner=doc.querySelector('.archive-banner');assert.ok(banner,'the practice banner');
  assert.equal(doc.querySelector('.save-status').textContent.trim(),'Not saved','the chronicle bar does not call practice saved');
  assert.match(banner.textContent,/Chronicle record: \d+ rounds/);
  for(const id of ['archive-difficulty','archive-weather','archive-time'])assert.ok(doc.getElementById(id),id);
  assert.ok(banner.querySelector('[data-cmd="exit-archive"]'));assert.ok(banner.querySelector('[data-cmd="apply-archive-mutators"]'));
  playRealtime(p);
  const result=documentFor(realtimeEncounterView({state:p,keymap:DEFAULT_KEYMAP})).querySelector('.rt-result');
  assert.ok(result.querySelector('[data-cmd="retry"]'));assert.ok(result.querySelector('[data-cmd="exit-archive"]'));
  assert.equal(result.querySelector('[data-cmd="commit"]'),null,'no result to record');
  assert.equal(result.querySelector('[data-cmd="rt-spoils"]'),null,'no spoils to search');
  assert.match(result.textContent,/Practice is not recorded/);assert.doesNotMatch(result.textContent,/Training points when recorded|Earned:/);
});

test('a practice Contest is walked in the chamber, with the difficulty alone to change and no patron to call',()=>{
  const s=chronicle(),before=G.serialize(s),p=practise(s,'ch7-council');
  assert.equal(p.encounter.kind,'contest');assert.equal(chamberFor(REALTIME,p.chapter),true);
  const doc=documentFor(chamberEncounterView({state:p,lastSaved:'saved'})),banner=doc.querySelector('.archive-banner');
  assert.ok(banner);assert.equal(doc.querySelector('.save-status').textContent.trim(),'Not saved');assert.match(banner.textContent,/Chronicle record: \d+ hours/);
  assert.ok(doc.getElementById('archive-difficulty'));
  for(const id of ['archive-weather','archive-time','archive-route'])assert.equal(doc.getElementById(id),null,`${id} has no meaning in the chamber`);
  for(const status of ['won','lost']){
    const shown=structuredClone(p);shown.encounter.status=status;
    const result=documentFor(chamberEncounterView({state:shown})).querySelector('.chamber-result');
    assert.ok(result.querySelector('[data-cmd="retry"]'));assert.ok(result.querySelector('[data-cmd="exit-archive"]'));
    assert.equal(result.querySelector('[data-cmd="commit"]'),null);assert.equal(result.querySelector('[data-cmd="fallback"]'),null);
    assert.match(result.textContent,/Practice is not recorded/);
  }
  assert.equal(G.serialize(s),before);
});
