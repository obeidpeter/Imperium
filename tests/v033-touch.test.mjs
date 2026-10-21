import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTouchHold,HOLD_MS,HOLD_SLOP} from '../src/ui/touch-hold.js';

// Timers the test fires by hand.
function manualTimers() {
  const pending = new Map();let next = 0;
  return {
    setTimeout(fn, ms) {pending.set(++next, {fn, ms});return next;},
    clearTimeout(id) {pending.delete(id);},
    fire() {const all = [...pending.values()];pending.clear();for (const t of all) t.fn();return all.map(t => t.ms);},
    get count() {return pending.size;},
  };
}
const touch = (x, y) => ({pointerType: 'touch', clientX: x, clientY: y});
const mouse = (x, y) => ({pointerType: 'mouse', clientX: x, clientY: y});

test('v0.33.0: a finger held still shows what a tap would do, and the release then commits nothing', () => {
  const timers = manualTimers(), seen = [], hold = createTouchHold(point => seen.push(point), {timers});
  hold.down(touch(120, 80));assert.equal(timers.count, 1);
  hold.move(touch(120 + HOLD_SLOP - 1, 80));assert.equal(timers.count, 1, 'A tremor within the slop keeps the hold');
  assert.deepEqual(timers.fire(), [HOLD_MS]);
  assert.deepEqual(seen, [{clientX: 120, clientY: 80}], 'The hold reports where the finger went down');
  hold.up();
  assert.equal(hold.consume(), true, 'The tap that ends a hold is swallowed');
  assert.equal(hold.consume(), false, 'only once');
});

test('v0.33.0: a quick tap, a drag, a mouse and a disposed board never hold', () => {
  const timers = manualTimers(), seen = [], hold = createTouchHold(point => seen.push(point), {timers});
  hold.down(touch(10, 10));hold.up();assert.equal(timers.count, 0);assert.equal(hold.consume(), false, 'A quick tap still walks');
  hold.down(touch(10, 10));hold.move(touch(10, 10 + HOLD_SLOP + 1));assert.equal(timers.count, 0, 'Dragging (orbit or scroll) cancels the hold');
  hold.down(mouse(10, 10));assert.equal(timers.count, 0, 'A mouse has hover; it never holds');
  hold.down(touch(10, 10));hold.dispose();assert.equal(timers.count, 0);
  timers.fire();assert.deepEqual(seen, []);assert.equal(hold.consume(), false);
  // A new press clears a hold whose release never produced a tap.
  hold.down(touch(5, 5));timers.fire();hold.down(touch(6, 6));hold.up();assert.equal(hold.consume(), false);
});

test('v0.33.0: the 3D stage previews on a held touch and keeps it after the finger lifts (the 2D board: board-input.test.mjs)', async () => {
  const {BattleStage} = await import('../src/showcase/stage.js');
  const canvas = Object.assign(new EventTarget(), {setPointerCapture() {}}), timers = manualTimers(), hovers = [], picks = [];
  const stage = Object.assign(Object.create(BattleStage.prototype), {canvas, disposed: false, drag: null, orbit: {yaw: 0, pitch: .6, distance: 20}, figureStyle: 'sculpted', keyboardMode: 'orbit',
    sound: {unlock() {}}, wake() {}, updateInk() {}, pick: e => ({x: Math.floor(e.clientX / 10), y: Math.floor(e.clientY / 10)}), onHover: p => hovers.push(p), onPick: p => picks.push(p)});
  stage.bindInput((target, type, fn, options) => target.addEventListener(type, fn, options), {timers});
  const fire = (type, props) => canvas.dispatchEvent(Object.assign(new Event(type, {cancelable: true}), props));
  fire('pointerdown', touch(34, 21));assert.deepEqual(timers.fire(), [HOLD_MS]);
  assert.deepEqual(hovers, [{x: 3, y: 2}], 'A held finger previews its tile');
  fire('pointerup', touch(34, 21));assert.deepEqual(picks, [], 'The release after a hold picks nothing');
  fire('pointerleave', touch(34, 21));assert.deepEqual(hovers, [{x: 3, y: 2}], 'A lifted finger keeps the preview');
  fire('pointerleave', mouse(34, 21));assert.equal(hovers.at(-1), null, 'A mouse leaving clears it');
  fire('pointerdown', touch(34, 21));fire('pointerup', touch(34, 21));assert.deepEqual(picks, [{x: 3, y: 2}], 'A tap picks');
  fire('pointerdown', touch(34, 21));fire('pointermove', touch(34, 21 + HOLD_SLOP + 1));fire('pointerup', touch(34, 33));
  assert.equal(timers.count, 0);assert.equal(picks.length, 1, 'A drag orbits, holds nothing and picks nothing');assert.notEqual(stage.orbit.pitch, .6);
  fire('pointerdown', touch(34, 21));stage.touchHold.dispose();assert.equal(timers.count, 0, 'Disposing the stage disposes its hold');
});

test('v0.33.0: Help and the drill lesson mention holding a finger to see the route', async () => {
  const {createPanels} = await import('../src/ui/panels.js');
  let html = '';
  createPanels(() => ({showModal: (title, body) => {html = body;}})).showHelp();
  assert.match(html, /On a touch screen, hold a finger on the board to see the route first; lifting it after a hold does nothing\./);
  const Game = await import('../src/core/game.js'), {fieldLesson} = await import('../src/ui/field-guide.js');
  const drill = Game.newGame('Touch');Game.choose(drill, Game.getChapter(drill).decision.options[0].id);Game.startEncounter(drill);
  assert.match(fieldLesson(drill).body, /Pointing at it, holding a finger on it, or moving the cursor onto it shows the route first\./);
});

test('v0.33.0: CI drives the production build in a browser with a pinned Playwright that is not a project dependency', async () => {
  const workflow = await readFile(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const steps = [...workflow.matchAll(/^\s*(?:-\s+)?run:\s*(.+?)\s*$/gm)].map(m => m[1]), at = command => steps.findIndex(step => step.startsWith(command));
  assert.ok(steps.includes('npm install --no-save --no-package-lock playwright@1.56.1'), 'Playwright is installed, pinned, for CI only');
  assert.ok(at('npm run build') >= 0 && at('npm run build') < at('npm run smoke'), 'The smoke test drives the production build');
  assert.equal(pkg.scripts.smoke, 'node scripts/browser-smoke.mjs');
  assert.equal(pkg.dependencies, undefined);assert.equal(pkg.devDependencies, undefined, 'Playwright stays outside the project');
});

test('the source edition matches the package version', async () => {
  const {CONFIG} = await import('../src/config.js');
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(CONFIG.version,pkg.version);
});
