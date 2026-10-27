import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {activityFlag} from '../src/data/company-activities.js';
import {bootApp} from './inert-app.mjs';

const clickNow=(app,cmd,id)=>app.find(`[data-cmd="${cmd}"]${id===undefined?'':`[data-id="${id}"]`}`).dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));
async function whileReplySaves(app,index,navigate){
  let release,entered;
  const waiting=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  const locks=navigator.locks,request=locks.request;
  // Delay the real storage boundary, not the campaign command or UI handler.
  // Restore it before waiting so a later deliberate March out can save too.
  locks.request=async(...args)=>{locks.request=request;entered();await waiting;return request(...args);};
  const reply=app.click('reply',String(index));
  let timer;
  try{
    await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The reply did not reach persistence')),2000);})]);
    await navigate();
  }finally{clearTimeout(timer);release();await reply;locks.request=request;}
}

test('dialogue navigation retains the current panel through queued close events and pending saves',async t=>{
  const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
  const state=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id==='camp-5').state));
  const app=await bootApp(t,{name:'queued-dialog-close',save:state,settings:{battleView:'2d',controlsModel:'turns'}});
  await app.click('continue');await app.click('conversation','company-activity:5');await app.click('reply','0');await app.click('reply','0');
  assert.equal(app.modal().open,false);
  await app.click('conversation','company-activity:5:0');assert.equal(app.modal().open,true);
  const heading=app.find('#panel-title');
  // HTMLDialogElement.close() queues its native event. A new conversation can
  // open before that old event is delivered. mini-dom closes synchronously,
  // so deliver this delayed native event explicitly after the second open.
  app.modal().dispatchEvent(new Event('close'));
  assert.equal(app.doc.activeElement,heading,'The reopened dialog retains keyboard focus');
  assert.equal(app.modal().dataset.panel,'household-list');assert.equal(app.modal().dataset.conversation,'company-activity:5:0');
  assert.equal(app.modal().dataset.stagePause,'true','The new dialog retains its panel pause context');
  await app.click('reply','1');
  assert.equal(app.saved().soldier.flags[activityFlag(5,'household')],true,'The enabled reply still commits through the public campaign command');
  assert.match(app.find('#modal .dialogue-text').textContent,/fig-tree stamp/);
  assert.equal(app.modal().dataset.conversation,'company-activity:5:0');assert.equal(app.modal().open,true);
  // A legitimate close must still end the conversation and restore external
  // focus; it must not be mistaken for a delayed event from the old dialog.
  await app.click('reply','0');assert.equal(app.modal().open,false);assert.equal(app.modal().dataset.conversation,undefined);
  assert.equal(app.doc.activeElement?.closest('#modal'),null);
  await app.click('conversation','company-activity:5:0');const reopened=app.find('#panel-title');
  app.modal().dispatchEvent(new Event('close'));assert.equal(app.doc.activeElement,reopened,'A stale close does not send focus into the inert background');
  assert.ok(heading!==reopened,'The conversation has actually been replaced');

  await app.click('close-modal');await app.click('conversation','company-activity:5:1');
  const expected=app.saved();assert.equal(Game.campReply(expected,{treeId:'company-activity:5:1',nodeId:'greet',index:1}).ok,true);
  let settingsHeading;
  await whileReplySaves(app,1,()=>{
    assert.equal(app.find('[data-cmd="reply"][data-id="1"]').disabled,true,'The pending save still blocks duplicate replies');
    clickNow(app,'menu');clickNow(app,'settings');settingsHeading=app.find('#panel-title');
    assert.equal(app.modal().dataset.conversation,undefined,'Navigation ends the originating conversation');
  });
  assert.equal(Game.serialize(app.saved()),Game.serialize(expected),'Leaving a pending reply does not discard or duplicate its committed command');
  assert.ok(app.find('#panel-title')===settingsHeading,'A saved reply must not reopen its old node over Settings');
  assert.ok(app.doc.activeElement===settingsHeading,'The newer panel keeps focus after the older reply saves');
  assert.equal(app.modal().open,true);assert.equal(app.modal().dataset.stagePause,'true');

  // A pending closing reply must not close whichever panel replaces it.
  await app.click('close-modal');await app.click('conversation','company-activity:5:0');await app.click('reply','1');
  let menuHeading;
  await whileReplySaves(app,0,()=>{clickNow(app,'menu');menuHeading=app.find('#panel-title');});
  assert.equal(app.modal().open,true,'The old Return to camp reply cannot close the new Menu');
  assert.ok(app.find('#panel-title')===menuHeading);assert.ok(app.doc.activeElement===menuHeading);

  // Tree/node equality is insufficient: reopening the same desk creates a new
  // interaction that must stay at its own greeting when the old reply saves.
  await app.click('close-modal');await app.click('conversation','company-activity:5:1');
  let newGreeting;
  await whileReplySaves(app,1,()=>{
    clickNow(app,'close-modal');clickNow(app,'conversation','company-activity:5:1');newGreeting=app.find('#panel-title');
  });
  assert.ok(app.find('#panel-title')===newGreeting,'A newly opened instance of the same conversation is preserved');
  assert.match(app.find('#modal .dialogue-text').textContent,/Examine this record/);
  assert.ok(app.doc.activeElement===newGreeting);
  await app.click('reply','1');assert.match(app.find('#modal .dialogue-text').textContent,/boat VI/,'The new conversation still accepts replies');

  // World service entry and gate entry use these same public conversation
  // commands; the inert harness has no walking world, so opens them directly.
  await app.click('close-modal');await app.command('conversation','ch5:quartermaster');
  await whileReplySaves(app,0,()=>{clickNow(app,'menu');menuHeading=app.find('#panel-title');});
  assert.ok(app.find('#panel-title')===menuHeading,'The old service handoff cannot replace the newer Menu');
  assert.equal(app.modal().dataset.conversation,undefined);

  await app.click('close-modal');
  if(!app.saved().decisions.ch5)await app.click('choose','countermine');
  await app.command('conversation','gate');
  const march=app.saved(),gate=Game.campConversation(march,'gate');
  const depart=gate.options.find(o=>o.text.includes('March out'));
  assert.ok(depart);assert.equal(depart.needs.length,0);
  assert.equal(Game.campReply(march,{treeId:'gate',nodeId:gate.nodeId,index:depart.index}).open,'march');
  assert.equal(Game.startEncounter(march).ok,true);
  await whileReplySaves(app,depart.index,()=>{clickNow(app,'menu');});
  assert.equal(app.saved().phase,'encounter','An explicitly chosen March out still runs after its reply saves');
  assert.equal(Game.serialize(app.saved()),Game.serialize(march),'Departure commits exactly once after the prior transaction completes');
});
