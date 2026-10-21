import test from 'node:test';
import assert from 'node:assert/strict';
import {bindBoardInput} from '../src/ui/board-input.js';
import {HOLD_MS} from '../src/ui/touch-hold.js';

// A board of 10 px tiles, 8 by 8, driven by real events through Node's EventTarget.
function harness({threeD=false}={}) {
  const board = new EventTarget();board.isConnected = true;
  const log = {hover: [], select: [], cancel: 0, step: [], activate: 0}, frames = [], timers = new Map();let next = 0, shown = null;
  const input = bindBoardInput(board, {
    threeD, holdDelay: HOLD_MS, current: () => shown,
    pick: (x, y) => ({x: Math.floor(x / 10), y: Math.floor(y / 10)}), inside: p => p.x >= 0 && p.y >= 0 && p.x < 8 && p.y < 8,
    hover: point => {shown = point;log.hover.push(point);}, select: point => log.select.push(point), cancel: () => log.cancel++,
    step: delta => log.step.push(delta), activate: () => log.activate++,
    frame: fn => frames.push(fn), timers: {setTimeout(fn) {timers.set(++next, fn);return next;}, clearTimeout(id) {timers.delete(id);}},
  });
  const fire = (type, props = {}) => {const event = Object.assign(new Event(type, {cancelable: true}), props);board.dispatchEvent(event);return event;};
  return {board, input, log, fire, frames: () => {const all = frames.splice(0);for (const fn of all) fn();return all.length;},
    hold: () => {const all = [...timers.values()];timers.clear();for (const fn of all) fn();return all.length;}, setShown: p => {shown = p;}};
}
const mouse = (x, y) => ({pointerType: 'mouse', clientX: x, clientY: y}), touch = (x, y) => ({pointerType: 'touch', clientX: x, clientY: y});

test('a click selects the tile under the pressed pointer, not the whole pixel the click reports', () => {
  const {fire, log} = harness();
  // The pointer that drew the preview sat at 29.6 px (tile 2); the click reports 30 px (tile 3).
  fire('pointerdown', mouse(29.6, 13.2));fire('pointerup', mouse(29.6, 13.2));fire('click', mouse(30, 13));
  assert.deepEqual(log.select, [{x: 2, y: 1}]);
  // A click that is not where the pointer went down picks where it landed.
  fire('pointerdown', mouse(5, 5));fire('click', mouse(41, 52));
  assert.deepEqual(log.select.at(-1), {x: 4, y: 5});
  // Off the grid the page still hears the click (it decides that nothing happens).
  fire('click', mouse(95, 5));assert.deepEqual(log.select.at(-1), {x: 9, y: 0});
});

test('touch has no hover: a held finger previews its tile, and the tap that ends the hold selects nothing', () => {
  const {fire, log, hold} = harness();
  fire('pointerdown', touch(34, 21));
  assert.equal(hold(), 1, 'Holding still arms one timer');
  assert.deepEqual(log.hover, [{x: 3, y: 2}], 'The held tile is previewed');
  fire('pointerup', touch(34, 21));fire('click', touch(34, 21));
  assert.deepEqual(log.select, [], 'Lifting the finger after a hold walks nowhere');
  fire('pointerleave', touch(34, 21));assert.deepEqual(log.hover, [{x: 3, y: 2}], 'A lifted finger keeps the preview');
  // A quick tap still selects, and a drag (orbit or scroll) cancels the hold.
  fire('pointerdown', touch(34, 21));fire('pointerup', touch(34, 21));fire('click', touch(34, 21));
  assert.deepEqual(log.select, [{x: 3, y: 2}]);
  fire('pointerdown', touch(34, 21));fire('pointermove', touch(34, 60));assert.equal(hold(), 0);
  // A held finger off the grid previews nothing.
  fire('pointerdown', touch(95, 21));hold();assert.equal(log.hover.length, 1);
});

test('a long press is not a cancel, a right click is; the board keeps its menu either way', () => {
  const {fire, log} = harness();
  fire('pointerdown', touch(5, 5));const held = fire('contextmenu');
  assert.equal(held.defaultPrevented, true);assert.equal(log.cancel, 0);
  fire('pointerdown', mouse(5, 5));const right = fire('contextmenu');
  assert.equal(right.defaultPrevented, true);assert.equal(log.cancel, 1);
});

test('the readout follows the mouse once a frame, clears when it leaves and skips the tile it already shows', () => {
  const {fire, log, frames, setShown} = harness();
  fire('pointermove', mouse(12, 12));fire('pointermove', mouse(15, 18));fire('pointermove', mouse(25, 18));
  assert.deepEqual(log.hover, [], 'Nothing is drawn before the frame');
  assert.equal(frames(), 1, 'One frame is asked for, however many moves');
  assert.deepEqual(log.hover, [{x: 2, y: 1}], 'The frame shows where the pointer is now');
  fire('pointermove', mouse(28, 11));assert.equal(frames(), 0, 'Moving within the shown tile asks for nothing');
  setShown({x: 6, y: 6});fire('pointermove', mouse(28, 11));assert.equal(frames(), 1, 'After the keyboard moved the readout, the pointer\'s tile shows again');
  assert.deepEqual(log.hover.at(-1), {x: 2, y: 1});
  fire('pointermove', mouse(95, 11));frames();assert.equal(log.hover.at(-1), null, 'Off the grid there is no readout');
  fire('pointermove', mouse(12, 12));frames();fire('pointerleave', mouse(-1, 12));
  assert.equal(log.hover.at(-1), null, 'Leaving clears it at once');
  fire('pointermove', touch(40, 40));assert.equal(frames(), 0, 'A finger moving is not a hover');
});

test('arrow keys step the cursor and Enter or Space activates it; other keys pass through', () => {
  const {fire, log} = harness();
  const up = fire('keydown', {key: 'ArrowUp'}), right = fire('keydown', {key: 'ArrowRight'});
  assert.deepEqual(log.step, [[0, -1], [1, 0]]);assert.equal(up.defaultPrevented && right.defaultPrevented, true);
  assert.equal(fire('keydown', {key: 'Enter'}).defaultPrevented, true);fire('keydown', {key: ' '});assert.equal(log.activate, 2);
  assert.equal(fire('keydown', {key: 'u'}).defaultPrevented, false, 'Shortcuts reach the page');assert.equal(log.step.length, 2);
});

test('in 3D the stage owns the pointer; the board keeps the cursor keys and the context menu', () => {
  const {fire, log, frames, hold} = harness({threeD: true});
  fire('pointerdown', touch(34, 21));assert.equal(hold(), 0);
  fire('click', mouse(34, 21));fire('pointermove', mouse(34, 21));assert.equal(frames(), 0);
  assert.deepEqual(log.select, []);assert.deepEqual(log.hover, []);
  fire('keydown', {key: 'ArrowDown'});assert.deepEqual(log.step, [[0, 1]]);
  fire('pointerdown', mouse(1, 1));fire('contextmenu');assert.equal(log.cancel, 1);
});

test('a disposed or detached board hears nothing more', () => {
  const {board, input, fire, log, frames, hold} = harness();
  fire('pointermove', mouse(12, 12));board.isConnected = false;frames();assert.deepEqual(log.hover, [], 'A board replaced before its frame stays quiet');
  fire('pointerdown', touch(34, 21));hold();assert.deepEqual(log.hover, []);
  board.isConnected = true;fire('pointerdown', touch(34, 21));input.dispose();
  assert.equal(hold(), 0, 'Disposing clears a pending hold');
  fire('click', mouse(34, 21));fire('keydown', {key: 'Enter'});assert.deepEqual(log.select, []);assert.equal(log.activate, 0);
});
