import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG} from '../src/config.js';
import {bootApp} from './inert-app.mjs';

// The dead end the archive rule of #82 can leave: a damaged save too large for the local archive, on a device with no
// IndexedDB (this DOM has none), cannot be set aside, so the game never saves over it. Through the game's own interface:
// the refusal says what is in the way, the player plays in memory, downloads the damaged save in Settings → Saves,
// discards it there after a confirmation, and the chronicle in play saves.
const damaged=JSON.stringify({format:99,payload:'x'.repeat(1500000)});
// One boot per file: the game's save store is made once per process, with the first boot's storage.
async function blockedNewGame(t,name){
  const files=[],had=Object.getOwnPropertyDescriptor(URL,'createObjectURL');
  URL.createObjectURL=blob=>{files.push(blob);return 'blob:test';};
  t.after(()=>had?Object.defineProperty(URL,'createObjectURL',had):delete URL.createObjectURL);
  const app=await bootApp(t,{name,raw:{[CONFIG.saveKey]:damaged},settings:{battleView:'2d',controlsModel:'turns'}});
  await app.click('new');
  app.find('input[name="new-play-mode"][value="realtime"]').checked=false;app.find('input[name="new-play-mode"][value="turns"]').checked=true;
  await app.click('begin');
  return {app,files};
}
const openSaves=async app=>{if(!app.doc.querySelector('[data-cmd="settings"]'))await app.click('menu');await app.click('settings');await app.click('settings-section','saves');};

test('a damaged save that blocks saving is downloaded, discarded after a confirmation, and the chronicle in play then saves',async t=>{
  const {app,files}=await blockedNewGame(t,'discard-unreadable');
  assert.match(app.modal().textContent,/damaged save is in the way/i,'the refusal says what blocks saving, not that storage is missing');
  assert.equal(app.raw(),damaged,'the damaged save is not replaced');
  await app.click('begin-unsaved');
  await openSaves(app);
  assert.match(app.modal().textContent,/cannot be read/);
  assert.equal(app.doc.querySelector('[data-cmd="discard-unreadable"]'),null,'nothing is offered for discard before it is downloaded');
  await app.click('export-unreadable');
  assert.equal(files.length,1);assert.equal(await files[0].text(),damaged,'the download is the damaged save as it was');
  assert.equal(app.doc.activeElement?.dataset?.cmd,'discard-unreadable','the discard is offered next, with the focus on it');
  await app.click('discard-unreadable');
  assert.match(app.modal().textContent,/only copy/,'the confirmation says the download will be the only copy');
  // Keep it: back to Saves, nothing removed, the discard still on offer.
  await app.click('settings-section','saves');
  assert.equal(app.raw(),damaged,'Keep it removes nothing');assert.ok(app.doc.querySelector('[data-cmd="discard-unreadable"]'),'the discard stays on offer');
  await app.click('discard-unreadable');await app.click('confirm-discard-unreadable');
  assert.notEqual(app.raw(),damaged,'the damaged save is gone from the device');
  assert.equal(app.saved().chapter,1,'and the chronicle in play is saved in its place');
  assert.match(app.doc.querySelector('#announcement').textContent,/removed from this device\. Your chronicle is saved\./);
  assert.equal(app.doc.querySelector('[data-cmd="export-unreadable"]'),null,'no unreadable data is left to offer');
});
