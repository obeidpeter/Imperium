import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';

const clone = x => JSON.parse(JSON.stringify(x));
const checkpoints = new Map();
let campaign = null;
function camp(id) {
  campaign ??= runProgressionCampaign({onCheckpoint: s => checkpoints.set(Game.getChapter(s).encounters[s.encounterIndex].id, clone(s))});
  return clone(checkpoints.get(id));
}
function started(id) {
  const s = camp(id);
  assert.ok(Game.startEncounter(s).ok);
  return s;
}
// Undo is complete when only the action log remembers the step back.
const withoutLog = s => JSON.stringify({...s, encounter: {...s.encounter, log: []}, log: []});

test('v0.29.0: the Chapter XII approach is chosen through the rules API and validated against the forecast', () => {
  const s = camp('ch12-confrontation'), saved = Game.serialize(s);
  assert.equal(Game.chooseRoute(s, 'invented').ok, false);
  assert.equal(Game.serialize(s), saved, 'A rejected route leaves the campaign unchanged');
  const locked = Game.finaleForecast(s).routes.map(r => r.id), unavailable = ['defection', 'settlement', 'surrender'].find(id => !locked.includes(id));
  if (unavailable) assert.equal(Game.chooseRoute(s, unavailable).ok, false, 'A route the standing has not opened cannot be selected');
  assert.ok(Game.chooseRoute(s, 'battle').ok);
  assert.equal(s.route, 'battle');
  assert.ok(Game.startEncounter(s).ok);
  assert.equal(s.encounter.route, 'battle', 'The chosen route reaches the confrontation');
  const early = camp('ch12-legitimacy');
  assert.equal(Game.chooseRoute(early, 'battle').ok, false, 'The route is chosen only before the final field encounter');
  const field = started('ch1-road');
  assert.equal(Game.chooseRoute(field, 'battle').ok, false);
});

test('v0.29.0: Undo Move restores the whole encounter state, including the ability credit the move added', () => {
  const s = started('ch1-training'), before = withoutLog(s), rng = s.rng;
  const move = Game.legalCommands(s).find(c => c.unitId === 'hero' && c.action === 'move');
  assert.ok(Game.act(s, move).ok);
  assert.ok(s.encounter.usedAbilities.includes('move'));
  assert.ok(Game.undoMove(s).ok);
  assert.equal(withoutLog(s), before, 'Position, facing, intents, objective text and capability records match the pre-move state');
  assert.equal(s.rng, rng);
  // Moving again and acting keeps the credit: the demonstrated move is now real.
  assert.ok(Game.act(s, move).ok);
  const strike = Game.legalCommands(s).find(c => c.unitId === 'hero' && c.action === 'brace');
  assert.ok(Game.act(s, strike).ok);
  assert.ok(s.encounter.usedAbilities.includes('move'));
  assert.equal(Game.canUndoMove(s).available, false);
});

test('v0.29.0: undoing two outstanding speaker moves in either order restores the original credit', () => {
  for (const order of [['hero', 'speaker-ally'], ['speaker-ally', 'hero']]) {
    const s = started('ch7-council'), before = withoutLog(s);
    for (const unitId of ['hero', 'speaker-ally']) {
      const move = Game.legalCommands(s).find(c => c.unitId === unitId && c.action === 'move');
      assert.ok(Game.act(s, move).ok, `${unitId} moves`);
    }
    assert.ok(Game.undoMove(s, order[0]).ok);
    assert.ok(s.encounter.usedAbilities.includes('move'), 'The remaining move still carries the credit');
    assert.ok(Game.undoMove(s, order[1]).ok);
    assert.equal(withoutLog(s), before, `Undo order ${order.join(' then ')} leaves no move credit behind`);
  }
});

test('v0.29.0: an Archive replay cannot be restored as if it were the chronicle', async () => {
  // The legal default route (no progression) is the case whose sandbox validates as a save.
  const {readFile} = await import('node:fs/promises'), fixture = JSON.parse(await readFile(new URL('./fixtures/chapter-12-legal-checkpoint.json', import.meta.url), 'utf8'));
  const s = Game.deserialize(JSON.stringify(fixture.state ?? fixture)), entry = Game.archiveEncounters(s)[0], replay = Game.createArchiveReplay(s, entry.id);
  assert.ok(replay.ok);
  assert.throws(() => Game.deserialize(Game.serialize(replay.state)), /Archive replay, not a chronicle/);
  assert.doesNotThrow(() => Game.deserialize(Game.serialize(s)), 'The chronicle itself still round-trips');
});

test('v0.29.0: the real app saves routes through the rules API and a hidden tab writes only unsaved changes', async t => {
  // Inert DOM integration harness (as in campaign-upgrade-ui): the actual app
  // module and storage run; there is no browser layout, canvas or audio device.
  const {CONFIG} = await import('../src/config.js');
  const originals = new Map(), set = (key, value) => { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, {value, writable: true, configurable: true}); };
  const callbacks = new Map(), values = new Map(), writes = [], nodes = new Map();
  const node = (id = '') => ({id, innerHTML: '', textContent: '', hidden: false, open: false, dataset: {}, style: {setProperty() {}}, isConnected: true, querySelectorAll: () => [], querySelector: selector => nodes.get(selector) ?? null, setAttribute() {}, removeAttribute() {}, focus() {}, scrollIntoView() {}, addEventListener() {}, prepend() {}, after() {}, close() { this.open = false; }, showModal() { this.open = true; }});
  for (const id of ['#app', '#modal', '#announcement', '.system-feedback', '.save-status', '.modal-feedback', '#panel-title', '#action-feedback']) nodes.set(id, node(id));
  const doc = {hidden: false, activeElement: null, documentElement: node(), addEventListener(name, fn) { if (!callbacks.has(name)) callbacks.set(name, []); callbacks.get(name).push(fn); }, removeEventListener() {}, querySelector: selector => nodes.get(selector) ?? null, querySelectorAll: () => [], getElementById: () => null, createElement: () => node()};
  set('document', doc); set('window', {addEventListener() {}, scrollTo() {}}); set('navigator', {connection: {saveData: true}, locks: {request: async (name, fn) => fn()}}); set('matchMedia', () => ({matches: true}));
  set('requestAnimationFrame', () => 1); set('cancelAnimationFrame', () => {});
  set('localStorage', {getItem: k => values.get(k) ?? null, setItem(k, v) { values.set(k, v); writes.push(k); }, removeItem: k => values.delete(k)}); set('BroadcastChannel', class { postMessage() {} close() {} });
  const nativeTimeout = globalThis.setTimeout; set('setTimeout', (fn, delay, ...args) => delay === 6500 ? 0 : nativeTimeout(fn, delay, ...args));
  t.after(() => { for (const [key, descriptor] of originals) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]; });
  const storage = await import('../src/ui/storage.js?v029-app'), start = camp('ch12-confrontation');
  await storage.saveLocal(start, {replace: true});
  await import('../src/ui/app.js?v029-app');
  const saved = () => Game.deserialize(JSON.parse(values.get(CONFIG.saveKey)).payload), campaignWrites = () => writes.filter(k => k === CONFIG.saveKey).length;
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => nativeTimeout(resolve, 0)); };
  const click = async (cmd, id) => { const button = {dataset: {cmd, id}, disabled: false}; for (const fn of callbacks.get('click') ?? []) await fn({target: {closest: () => button}}); await settle(); };
  const hide = async () => { doc.hidden = true; for (const fn of callbacks.get('visibilitychange') ?? []) fn(); await settle(); doc.hidden = false; };
  await click('continue');
  let count = campaignWrites();
  await hide();
  assert.equal(campaignWrites(), count, 'Hiding an unchanged chronicle does not write or broadcast a new revision');
  await click('route', 'invented');
  assert.equal(campaignWrites(), count, 'An invalid approach is rejected by the rules API before storage');
  assert.equal(saved().route, start.route);
  await click('route', 'battle');
  assert.equal(saved().route, 'battle');
  count = campaignWrites();
  await hide();
  assert.equal(campaignWrites(), count, 'The route was already saved; hiding writes nothing new');
});
