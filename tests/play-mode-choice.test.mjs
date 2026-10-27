import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {defaultSettings,loadSettings,newGamePlayMode,choosePlayMode} from '../src/ui/settings.js';
import {createPanels} from '../src/ui/panels.js';
import {Document} from './mini-dom.mjs';
import {bootApp} from './inert-app.mjs';

test('fresh New Game recommends real time, while stored mode preferences and existing saves retain their controls',()=>{
  assert.equal(defaultSettings().controlsModel,'turns','loading an old chronicle is not a mode choice');
  assert.equal(newGamePlayMode(loadSettings(null)),'realtime');
  assert.equal(newGamePlayMode(loadSettings(JSON.stringify(defaultSettings()))),'realtime','saving another preference does not invent a mode choice');
  for(const mode of ['turns','realtime'])assert.equal(newGamePlayMode(loadSettings(JSON.stringify({controlsModel:mode}))),mode);
  const state=Game.newGame('Mode choice'),before=Game.serialize(state),doc=new Document();
  createPanels(()=>({state,settings:loadSettings(null),devMenu:false,showModal:(_,body)=>doc.body.innerHTML=body})).showNew();
  assert.equal(doc.querySelector('input[name="new-play-mode"][checked]').value,'realtime');
  assert.equal(doc.querySelectorAll('input[name="new-play-mode"]').length,2);
  assert.match(doc.body.textContent,/Pause whenever you want/);
  assert.equal(Game.serialize(state),before);
});

test('ordinary Controls exposes one mode chooser with a safe encounter boundary',()=>{
  const state=Game.newGame('Boundary'),settings=loadSettings(null),doc=new Document(),before=Game.serialize(state);
  const panels=createPanels(()=>({state,settings,devMenu:false,showModal:(_,body)=>doc.body.innerHTML=body}));
  panels.showSettings('controls');assert.equal(doc.querySelectorAll('#controls-model').length,1);
  assert.equal(doc.querySelector('#controls-model').disabled,false);assert.equal(doc.querySelector('#settings-development'),null);
  assert.equal(choosePlayMode(settings,'realtime',{state}),true);assert.equal(settings.controlsChosen,true);assert.equal(Game.serialize(state),before);
  Game.choose(state,Game.getChapter(state).decision.options[0].id);Game.startEncounter(state);
  const checkpoint=Game.serialize(state),preferences=JSON.stringify(settings);
  panels.showSettings('controls');assert.equal(doc.querySelector('#controls-model').disabled,true);
  assert.equal(choosePlayMode(settings,'turns',{state}),false);assert.equal(JSON.stringify(settings),preferences);assert.equal(Game.serialize(state),checkpoint);
  assert.equal(choosePlayMode(settings,'turns',{state:{phase:'camp',archiveReplay:true}}),false);
});

test('New Game applies the selected mode and remembered choice only after creating the chronicle',async t=>{
  const app=await bootApp(t,{name:'new-mode-choice',settings:{battleView:'2d'}});await app.click('new');
  const realtime=app.find('input[name="new-play-mode"][value="realtime"]'),turns=app.find('input[name="new-play-mode"][value="turns"]');
  assert.equal(realtime.checked,true);realtime.checked=false;turns.checked=true;
  await app.click('begin');assert.equal(app.settings().controlsModel,'turns');assert.equal(app.settings().controlsChosen,true);
  assert.equal(app.saved().chapter,1);await app.click('home');await app.click('settings');
  const saved=app.raw();await app.change('#controls-model',{value:'realtime'});
  assert.equal(app.settings().controlsModel,'realtime');assert.equal(app.raw(),saved,'switching mode changes no saved progress');
  assert.equal(app.doc.activeElement.id,'controls-model');
});

test('forged mode change during an encounter cannot convert controls or rewrite its checkpoint',async t=>{
  const state=Game.newGame('Boundary');Game.choose(state,Game.getChapter(state).decision.options[0].id);Game.startEncounter(state);
  const app=await bootApp(t,{name:'active-mode-boundary',save:state,settings:{controlsModel:'turns',battleView:'2d'}});await app.click('continue');await app.click('menu');await app.click('settings');
  const before=app.raw();assert.equal(app.find('#controls-model').disabled,true);
  await app.change('#controls-model',{value:'realtime'});
  assert.equal(app.find('#controls-model').value,'turns');assert.equal(app.settings().controlsModel,'turns');assert.equal(app.raw(),before);
});

test('a failed New Game save leaves the mode preference unchanged',async t=>{
  const app=await bootApp(t,{name:'new-mode-storage',settings:{battleView:'2d'}});await app.click('new');
  app.find('input[name="new-play-mode"][value="realtime"]').checked=false;app.find('input[name="new-play-mode"][value="turns"]').checked=true;
  app.storage.reject=true;await app.click('begin');assert.equal(app.settings().controlsChosen,undefined);assert.equal(app.raw(),undefined);
  assert.match(app.modal().textContent,/Storage|save/i,'The failed save remains visible to the player');
});
