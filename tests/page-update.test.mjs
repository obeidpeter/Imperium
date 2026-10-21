import test from 'node:test';
import assert from 'node:assert/strict';
import {Document} from './mini-dom.mjs';
import {updatePage} from '../src/ui/page-update.js';
import * as G from '../src/core/game.js';
import {bootApp} from './inert-app.mjs';

function page(html) {const doc = new Document(), root = doc.createElement('div');root.id = 'app';doc.body.append(root);updatePage(root, html);return {doc, root};}
const board = (label, extra = '') => `<div class="battle-stage"><span class="battle-loading">Preparing…</span><canvas id="battle-board" tabindex="0" aria-label="${label}"${extra}></canvas></div>`;

test('an update keeps every element that is still on the page, so the board keeps its focus and listeners', () => {
  const {doc, root} = page(`<header><h1>Chapter I</h1></header><main id="main">${board('Select open ground')}<p id="hint">Walk</p></main>`);
  const canvas = doc.querySelector('#battle-board'), heading = doc.querySelector('h1'), main = doc.querySelector('#main');
  canvas.focus();let heard = 0;canvas.addEventListener('keydown', () => heard++);
  updatePage(root, `<header><h1>Chapter I</h1></header><main id="main"><p class="feedback">Walked to 2C.</p>${board('Select the same target again')}<p id="hint">Confirm</p></main>`);
  assert.equal(doc.querySelector('#battle-board'), canvas, 'The same board element');
  assert.equal(doc.activeElement, canvas, 'It keeps the focus: keys typed now reach it');
  canvas.dispatchEvent(new Event('keydown'));assert.equal(heard, 1, 'and its listeners');
  assert.equal(doc.querySelector('h1'), heading);assert.equal(doc.querySelector('#main'), main);
  assert.equal(canvas.getAttribute('aria-label'), 'Select the same target again', 'What the render wrote is up to date');
  assert.equal(doc.querySelector('.feedback').textContent, 'Walked to 2C.');assert.equal(doc.querySelector('#hint').textContent, 'Confirm');
  assert.equal(root.innerHTML, `<header><h1>Chapter I</h1></header><main id="main"><p class="feedback">Walked to 2C.</p>${board('Select the same target again')}<p id="hint">Confirm</p></main>`);
});

test('attributes a script added and elements it placed stay; those the render dropped go', () => {
  const {doc, root} = page(`<main id="main" data-outcome="active">${board('Battlefield', ' data-hint="old"')}</main>`);
  const canvas = doc.querySelector('#battle-board'), stage = doc.querySelector('.battle-stage');
  canvas.dataset.bound = 'true';canvas.dataset.generatedBodies = '8';stage.dataset.ready = 'true';
  const labels = doc.createElement('div');labels.className = 'world-labels';labels.setAttribute('data-live', '');stage.append(labels);
  updatePage(root, `<main id="main" data-outcome="won">${board('Battlefield')}</main>`);
  assert.equal(canvas.dataset.bound, 'true', 'A bound board is not bound twice');assert.equal(canvas.dataset.generatedBodies, '8');assert.equal(stage.dataset.ready, 'true', 'The 3D veil stays lifted');
  assert.equal(canvas.hasAttribute('data-hint'), false, 'An attribute the render no longer writes is removed');
  assert.equal(doc.querySelector('#main').dataset.outcome, 'won');
  assert.equal(labels.parentNode, stage, 'The 3D labels stay where the stage put them');assert.equal(stage.lastChild, labels);
});

test('a changed key replaces the element: another view or another encounter gets a fresh board', () => {
  const {doc, root} = page('<canvas id="battle-board" data-key="board:3d:ch1-road"></canvas>');
  const first = doc.querySelector('#battle-board');first.dataset.bound = 'true';
  updatePage(root, '<canvas id="battle-board" data-key="board:3d:ch1-road"></canvas>');assert.equal(doc.querySelector('#battle-board'), first);
  updatePage(root, '<canvas id="battle-board" data-key="board:2d:ch1-road"></canvas>');
  const second = doc.querySelector('#battle-board');assert.notEqual(second, first, 'A 2D board is not the 3D one');
  assert.equal(second.dataset.bound, undefined, 'and is bound afresh');assert.equal(first.isConnected, false);
});

test('a field keeps what was typed or chosen unless the render changes it', () => {
  const html = (value, checked, quality, name = '') => `<input id="name-input" value="${name}"><input id="confirm-moves" type="checkbox" ${checked ? 'checked' : ''}>`+
    `<select id="graphics-quality">${['performance', 'balanced', 'high'].map(q => `<option value="${q}" ${q === quality ? 'selected' : ''}>${q}</option>`).join('')}</select>`+
    `<input id="volume" type="range" value="${value}"><details id="intel"><summary>Intel</summary></details>`;
  const {doc, root} = page(html(50, false, 'balanced'));
  const name = doc.querySelector('#name-input'), box = doc.querySelector('#confirm-moves'), select = doc.querySelector('#graphics-quality'), details = doc.querySelector('#intel');
  name.value = 'Gaius Aure';details.open = true;
  updatePage(root, html(50, false, 'balanced'));
  assert.equal(name.value, 'Gaius Aure', 'Typing survives an unrelated update');assert.equal(details.open, true, 'An opened panel stays open');
  updatePage(root, html(70, true, 'high'));
  assert.equal(doc.querySelector('#volume').value, '70', 'A value the render changed is shown');
  assert.equal(box.checked, true);assert.equal(select.value, 'high');
  box.checked = false;updatePage(root, html(70, true, 'high'));assert.equal(box.checked, false, 'An unchanged render leaves the player\'s click alone');
  updatePage(root, html(70, false, 'performance', 'Marcus'));
  assert.equal(box.checked, false);assert.equal(select.value, 'performance');assert.equal(name.value, 'Marcus', 'A new name from the render replaces the typed one');
});

test('elements come and go in order, text changes in place, and another tag is a new element', () => {
  const {doc, root} = page('<ul><li>One</li><li>Two</li></ul><p id="note">Old</p><section><h2>A</h2></section>');
  const list = doc.querySelector('ul'), note = doc.querySelector('#note'), text = note.firstChild;
  updatePage(root, '<ul><li>One</li><li>Two</li><li>Three</li></ul><p id="note">New</p><div><h2>A</h2></div>');
  assert.equal(doc.querySelector('ul'), list);assert.deepEqual(list.children.map(li => li.textContent), ['One', 'Two', 'Three']);
  assert.equal(note.firstChild, text, 'The text node is updated in place');assert.equal(note.textContent, 'New');
  assert.equal(doc.querySelector('section'), null);assert.equal(doc.querySelector('div h2').textContent, 'A');
  updatePage(root, '<p id="note">New</p>');
  assert.equal(root.innerHTML, '<p id="note">New</p>');assert.equal(doc.querySelector('#note'), note, 'Removing what came before a keyed element does not move it');
  updatePage(root, '');assert.equal(root.childNodes.length, 0);
});

test('a command button is only reused for the same command, so Enter on a focused button never gives another order', () => {
  const bar = buttons => `<div class="actions">${buttons.map(([cmd, id, label]) => `<button data-cmd="${cmd}" data-id="${id}">${label}</button>`).join('')}</div>`;
  const {doc, root} = page(bar([['action', 'move', 'Move'], ['action', 'attack', 'Attack']]));
  const [move, attack] = doc.querySelectorAll('button');attack.focus();
  updatePage(root, bar([['action', 'move', 'Move · 2 left'], ['action', 'attack', 'Attack']]));
  assert.equal(doc.querySelectorAll('button')[1], attack, 'The same order keeps its button and focus');assert.equal(doc.activeElement, attack);
  assert.equal(doc.querySelectorAll('button')[0], move);assert.equal(move.textContent, 'Move · 2 left');
  updatePage(root, bar([['confirm', '', 'Confirm'], ['cancel', '', 'Cancel']]));
  assert.equal(attack.isConnected, false, 'Another order is a new button');assert.notEqual(doc.activeElement, doc.querySelectorAll('button')[1]);
});

test('in the app, the board survives updates with its focus and bindings, and takes a changed touch delay', async t => {
  const drill = G.newGame('Board');G.choose(drill, G.getChapter(drill).decision.options[0].id);G.startEncounter(drill);
  const app = await bootApp(t, {name: 'board-survives', save: drill, settings: {battleView: '2d'}});
  await app.click('continue');app.frame();
  const board = app.find('#battle-board');assert.equal(board.dataset.bound, 'true');
  board.focus();await app.click('toggle-grid');app.frame();
  assert.equal(app.find('#battle-board'), board, 'Turning the grid on updates the page around the same board');
  assert.equal(app.doc.activeElement, board, 'which keeps the focus');
  assert.equal(app.key('#battle-board', 'ArrowUp').defaultPrevented, true, 'and its bindings: an arrow key moves the cursor');
  assert.match(app.doc.querySelector('#announcement').textContent, /^Grid \d+[A-H]\. /);
  if (!app.doc.querySelector('[data-cmd="settings"]')) await app.click('menu');
  await app.click('settings');await app.change('#hold-delay', {value: '900'});await app.click('close-modal');app.frame();
  assert.equal(app.find('#battle-board'), board, 'Settings update the page around the same board');
  const touch = type => board.dispatchEvent(Object.assign(new Event(type, {bubbles: true}), {pointerType: 'touch', clientX: 5, clientY: 5}));
  app.timeouts.length = 0;touch('pointerdown');touch('pointerup');
  assert.ok(app.timeouts.includes(900), 'A held finger waits for the new touch delay');
});
