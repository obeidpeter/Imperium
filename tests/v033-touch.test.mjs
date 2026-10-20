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

test('v0.33.0: the 2D board and the 3D stage both preview on a held touch and keep it after the finger lifts', async () => {
  const app = await readFile(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  assert.match(app, /const hold=createTouchHold\(at=>\{if\(!board\.isConnected\)return;const p=pickBattlePoint\(board,state\.encounter,at\.clientX,at\.clientY\),e=state\.encounter;if\(p\.x>=0&&p\.y>=0&&p\.x<e\.width&&p\.y<e\.height\)\{boardHover\(p\);paint\(currentAnimation\);\}\}\);/);
  assert.match(app, /board\.addEventListener\('click',event=>\{if\(hold\.consume\(\)\)return;/, 'The release after a hold does not walk');
  assert.match(app, /if\(event\.pointerType==='touch'\)\{hold\.move\(event\);return;\}/);
  assert.match(app, /board\.addEventListener\('pointerleave',event=>\{if\(event\.pointerType==='touch'\)return;/, 'A lifted finger keeps the preview');
  assert.match(app, /board\.addEventListener\('contextmenu',event=>\{event\.preventDefault\(\);if\(pointer!=='touch'\)cancelCommand\(\);\}\);/, 'A long-press menu is not a cancel');
  const stage = await readFile(new URL('../src/showcase/stage.js', import.meta.url), 'utf8');
  assert.match(stage, /this\.touchHold=createTouchHold\(point=>\{if\(this\.disposed\|\|!this\.drag\|\|this\.drag\.moved\)return;const hover=this\.pick\(point\);/);
  assert.match(stage, /on\(this\.canvas,'pointerup',e=>\{const held=this\.touchHold\.consume\(\);this\.touchHold\.up\(\);if\(this\.drag&&!this\.drag\.moved&&!held\)/);
  assert.match(stage, /on\(this\.canvas,'pointerleave',e=>\{if\(e\.pointerType==='touch'\)return;/);
  assert.match(stage, /dispose\(\)\{if\(this\.disposed\)return;this\.disposed=true;this\.touchHold\?\.dispose\(\);/);
});

test('v0.33.0: Help and the drill lesson mention holding a finger to see the route', async () => {
  const {createPanels} = await import('../src/ui/panels.js');
  let html = '';
  createPanels(() => ({showModal: (title, body) => {html = body;}})).showHelp();
  assert.match(html, /On a touch screen, hold a finger on the board to see the route first; lifting it after a hold does nothing\./);
  const guide = await readFile(new URL('../src/ui/field-guide.js', import.meta.url), 'utf8');
  assert.match(guide, /Pointing at it, holding a finger on it, or moving the cursor onto it shows the route first\./);
});

test('v0.33.0: CI drives the production build in a browser with a pinned Playwright that is not a project dependency', async () => {
  const workflow = await readFile(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(workflow, /npm install --no-save --no-package-lock playwright@1\.56\.1/);
  assert.match(workflow, /- run: npm run build\r?\n\s+- run: npm run smoke/);
  assert.equal(pkg.scripts.smoke, 'node scripts/browser-smoke.mjs');
  assert.equal(pkg.dependencies, undefined);assert.equal(pkg.devDependencies, undefined, 'Playwright stays outside the project');
});

test('v0.33.0: this edition is 0.33.0', async () => {
  const {CONFIG} = await import('../src/config.js');
  assert.equal(CONFIG.version, '0.33.0');
});
