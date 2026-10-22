import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_CHAPTERS,controlsFor,normalizeControls,skirmishControls} from '../src/core/controls-model.js';
import {defaultSettings,loadSettings} from '../src/ui/settings.js';
import {bootApp} from './inert-app.mjs';

test('the controls model defaults to the 0.38 turns, with every chapter listed for real time',()=>{
  assert.deepEqual(normalizeControls(),{controlsModel:'turns',realtimeChapters:ALL_CHAPTERS});
  assert.deepEqual(normalizeControls({controlsModel:'chaos',realtimeChapters:[3,3,'2',0,13,'x']}),{controlsModel:'turns',realtimeChapters:[2,3]});
  const d=defaultSettings();assert.equal(d.controlsModel,'turns');assert.deepEqual(d.realtimeChapters,ALL_CHAPTERS);
});

test('a chapter plays in real time only when the model is real time, it is listed, and its real-time content exists',()=>{
  const ready=[1,2,3];
  assert.equal(controlsFor({controlsModel:'turns',realtimeChapters:ALL_CHAPTERS},1,ready),'turns');
  assert.equal(controlsFor({controlsModel:'realtime',realtimeChapters:ALL_CHAPTERS},1,ready),'realtime');
  assert.equal(controlsFor({controlsModel:'realtime',realtimeChapters:ALL_CHAPTERS},4,ready),'turns','not converted yet');
  // The kill criteria's fallback: "0.40 Prologue", chapters I–III in real time and the rest on turns.
  assert.equal(controlsFor({controlsModel:'realtime',realtimeChapters:[1,2,3]},2,ALL_CHAPTERS),'realtime');
  assert.equal(controlsFor({controlsModel:'realtime',realtimeChapters:[1,2,3]},7,ALL_CHAPTERS),'turns');
  // Phases 1, 2 and 4 convert every chapter; one taken out of the list keeps its turns.
  for(const chapter of ALL_CHAPTERS)assert.equal(controlsFor({controlsModel:'realtime',realtimeChapters:ALL_CHAPTERS},chapter),'realtime');
  assert.equal(controlsFor({controlsModel:'realtime',realtimeChapters:ALL_CHAPTERS.filter(c=>c!==12)},12),'turns');
  assert.equal(skirmishControls({controlsModel:'realtime'}),'realtime');assert.equal(skirmishControls({}),'turns');
});

test('the setting is persisted and repaired on load',()=>{
  const s=loadSettings(JSON.stringify({controlsModel:'realtime',realtimeChapters:[1,2,3]}));
  assert.equal(s.controlsModel,'realtime');assert.deepEqual(s.realtimeChapters,[1,2,3]);
  const bad=loadSettings(JSON.stringify({controlsModel:7,realtimeChapters:'all'}));
  assert.equal(bad.controlsModel,'turns');assert.deepEqual(bad.realtimeChapters,ALL_CHAPTERS);
});

test('the development menu switches the model, saves it, and the standalone skirmish follows it',async t=>{
  const app=await bootApp(t,{name:'controls-model'});
  assert.match(app.page(),/href="\.\/showcase\/index\.html">Try a standalone skirmish/);
  await app.click('settings');assert.equal(app.modal().open,true);
  assert.ok(app.find('#controls-model'),'the development menu is in the source tree');
  await app.change('#controls-model',{value:'realtime'});
  assert.equal(app.settings().controlsModel,'realtime');
  assert.match(app.page(),/href="\.\/showcase\/arena\.html">Try a standalone skirmish/);
  const boxes=[...app.doc.querySelectorAll('.realtime-chapter')];assert.equal(boxes.length,12);
  boxes.forEach(box=>{box.checked=Number(box.value)<=3;});await app.change('.realtime-chapter',{checked:true});
  assert.deepEqual(app.settings().realtimeChapters,[1,2,3]);
  await app.change('#controls-model',{value:'turns'});assert.equal(app.settings().controlsModel,'turns');
  assert.match(app.page(),/href="\.\/showcase\/index\.html">Try a standalone skirmish/);
});
