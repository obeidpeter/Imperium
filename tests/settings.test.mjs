import test from 'node:test';
import assert from 'node:assert/strict';
import {SETTINGS_KEY,SETTING_TOGGLES,defaultSettings,loadSettings} from '../src/ui/settings.js';
import {CONTROL_DEFAULTS} from '../src/ui/control-preferences.js';
import {createPanels} from '../src/ui/panels.js';
import * as G from '../src/core/game.js';
import {bootApp} from './inert-app.mjs';

test('first launch: the 3D view, no sound, coaching on, one click walks, and a quality the device can carry', () => {
  const first = defaultSettings();
  assert.equal(first.battleView, '3d');assert.equal(first.audio, false);assert.equal(first.music, false);
  assert.equal(first.coach, true);assert.equal(first.guide, true);assert.equal(first.confirmMoves, false);assert.equal(first.battleRemains, true);
  assert.equal(first.reducedMotion, false);assert.equal(first.quality, 'balanced');
  assert.equal(defaultSettings({reducedMotion: true}).reducedMotion, true, 'The system setting for reduced motion is respected');
  for (const device of [{phone: true}, {saveData: true}, {deviceMemory: 2}]) assert.equal(defaultSettings(device).quality, 'performance', JSON.stringify(device));
  assert.equal(SETTINGS_KEY, 'sacramentum.settings', 'Existing players keep their preferences under the legacy key');
});

test('stored preferences stand over the defaults, and anything unknown or out of range is repaired', () => {
  const stored = loadSettings(JSON.stringify({audio: true, confirmMoves: true, figureStyle: 'painted', quality: 'high', audioVolume: .2}), {phone: true});
  assert.equal(stored.audio, true);assert.equal(stored.confirmMoves, true);assert.equal(stored.figureStyle, 'painted');assert.equal(stored.quality, 'high');assert.equal(stored.audioVolume, .2);
  const broken = loadSettings(JSON.stringify({figureStyle: 'cubist', quality: 'ultra', audioVolume: 7, soundtrackVolume: 'loud', holdDelay: 5, keyBindings: {undo: '??'}}), {deviceMemory: 2});
  assert.equal(broken.figureStyle, 'sculpted');assert.equal(broken.quality, 'performance', 'An unknown quality falls back to the device default');
  assert.equal(broken.audioVolume, 1);assert.equal(broken.soundtrackVolume, .5);assert.equal(broken.holdDelay, 250);
  assert.deepEqual(broken.keyBindings, {...CONTROL_DEFAULTS});
  for (const unreadable of [null, '', 'not json', 'null', '7']) assert.deepEqual(loadSettings(unreadable), loadSettings(null), String(unreadable));
});

test('every Settings checkbox in the toggle table is on the panel and shows its setting', () => {
  const panel = settings => {let html = '';createPanels(() => ({settings: {...loadSettings(null), ...settings}, showModal: (_, body) => {html = body;}})).showSettings();return html;};
  for (const [id, toggle] of Object.entries(SETTING_TOGGLES)) {
    const checkbox = html => new RegExp(`<input id="${id}" type="checkbox"[^>]*>`).exec(html)?.[0];
    assert.match(checkbox(panel({[toggle.key]: true})) ?? '', /\bchecked\b/, id);
    assert.doesNotMatch(checkbox(panel({[toggle.key]: false})) ?? 'missing checked', /\bchecked\b/, id);
    assert.ok(toggle.render || toggle.stage, `${id} redraws the page or tells the stage`);
  }
});

test('the app stores each toggle as the player sets it, and a redrawing toggle changes the page at once', async t => {
  const drill = G.newGame('Settings');G.choose(drill, G.getChapter(drill).decision.options[0].id);G.startEncounter(drill);
  const app = await bootApp(t, {name: 'settings-toggles', save: drill});
  await app.click('continue');
  if (!app.doc.querySelector('[data-cmd="settings"]')) await app.click('menu');
  await app.click('settings');assert.equal(app.modal().open, true);
  await app.change('#battle-view', {value: '2d'});
  assert.match(app.page(), /Select open ground to walk there\./);
  await app.change('#confirm-moves', {checked: true});
  assert.equal(app.settings().confirmMoves, true);assert.match(app.page(), /Select open ground to preview a walk there, then select it again to go\./);
  for (const [id, {key}] of Object.entries(SETTING_TOGGLES)) {
    await app.change(`#${id}`, {checked: false});assert.equal(app.settings()[key], false, id);
    await app.change(`#${id}`, {checked: true});assert.equal(app.settings()[key], true, id);
  }
  assert.equal(G.serialize(app.saved()), G.serialize(drill), 'Settings never touch the chronicle');
});
