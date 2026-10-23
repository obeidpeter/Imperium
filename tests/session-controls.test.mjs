import test from 'node:test';
import assert from 'node:assert/strict';
import {Document} from './mini-dom.mjs';
import {updatePage} from '../src/ui/page-update.js';
import {createSessionControls} from '../src/ui/session-controls.js';

function page(html) {
  const doc = new Document(), root = doc.createElement('div');
  doc.body.append(root);updatePage(root, html);
  return {root, controls:createSessionControls(root), find:id => root.querySelector(`#${id}`)};
}

test('pending camp saves disable route, preparation and roster commits while navigation and drafts remain usable', () => {
  const {controls, find} = page(`
    <button id="route" data-cmd="route" data-id="defection">Choose defection</button>
    <button id="start" data-cmd="start">March out</button>
    <button id="decision" data-cmd="choose">Choose</button>
    <button id="plan" data-cmd="operational-plan">Prepare</button>
    <button id="approach" data-cmd="field-approach">Choose approach</button>
    <button id="allocation" data-cmd="allocate">Dispatch convoys</button>
    <select id="company" class="company-slot"><option>Lucan</option></select>
    <input id="party" type="checkbox" data-cmd="soldier-party">
    <button id="menu" data-cmd="menu">Menu</button>
    <button id="settings" data-cmd="settings">Settings</button>
    <button id="help" data-cmd="help">Help</button>
    <button id="close" data-cmd="close-modal">Close</button>
    <button id="conversation" data-cmd="conversation">Talk</button>
    <button id="preset" data-cmd="allocation-preset">Balanced</button>
    <input id="river" type="number" value="2">
    <select id="draft-path"><option>Training path</option></select>`);
  controls.sync(true);
  for (const id of ['route', 'start', 'decision', 'plan', 'approach', 'allocation', 'company', 'party']) {
    assert.equal(find(id).disabled, true, `${id} cannot silently lose a commit`);
    assert.equal(find(id).getAttribute('aria-busy'), 'true');
  }
  for (const id of ['menu', 'settings', 'help', 'close', 'conversation', 'preset', 'river', 'draft-path']) {
    assert.equal(find(id).disabled, false, `${id} remains usable`);
    assert.equal(find(id).getAttribute('aria-busy'), null);
  }
  controls.sync(false);
  assert.equal(find('route').disabled, false);assert.equal(find('company').disabled, false);
});

test('soldier and conversation commits wait while inspecting equipment and opening order editors stays available', () => {
  const {controls, find} = page(`
    <button id="buy" data-cmd="soldier" data-kind="buy">Buy</button>
    <button id="train" data-cmd="soldier" data-kind="raise">Train</button>
    <button id="adopt" data-cmd="adopt-soldier">Choose training</button>
    <button id="reply" data-cmd="reply">Commit reply</button>
    <button id="honour" data-cmd="settle-honour">Honour obligation</button>
    <button id="orders" data-cmd="orders-save">Save orders</button>
    <button id="squad-orders" data-cmd="squad-orders-save">Save squad orders</button>
    <button id="practice" data-cmd="archive-replay">Practice</button>
    <button id="iron" data-cmd="end-iron">End Iron discipline</button>
    <button id="kit" data-cmd="kit-select">Inspect item</button>
    <button id="training" data-cmd="soldier-panel">Training panel</button>
    <button id="edit" data-cmd="soldier" data-kind="orders-edit">Edit orders</button>
    <button id="squad-edit" data-cmd="soldier" data-kind="squad-orders-edit">Edit squad orders</button>`);
  controls.sync(true);
  for (const id of ['buy', 'train', 'adopt', 'reply', 'honour', 'orders', 'squad-orders', 'practice', 'iron']) {
    assert.equal(find(id).disabled, true, id);
  }
  for (const id of ['kit', 'training', 'edit', 'squad-edit']) assert.equal(find(id).disabled, false, id);
});

test('repeated save notifications preserve rule-disabled controls and their existing accessibility state', () => {
  const {controls, find} = page(`
    <button id="poor" data-cmd="soldier" data-kind="buy" disabled aria-busy="false">Needs more denarii</button>
    <button id="working" data-cmd="soldier" data-kind="course" aria-busy="true">Course</button>
    <button id="route" data-cmd="route">Route</button>`);
  controls.sync(true);controls.sync(true);controls.sync(false);controls.release();
  assert.equal(find('poor').disabled, true, 'An unaffordable purchase never becomes enabled');
  assert.equal(find('poor').getAttribute('aria-busy'), 'false');
  assert.equal(find('working').disabled, false);assert.equal(find('working').getAttribute('aria-busy'), 'true');
  assert.equal(find('route').disabled, false);assert.equal(find('route').getAttribute('aria-busy'), null);
});

test('rendering changed game restrictions during a save does not restore stale affordability or ordering', () => {
  const markup = (purchaseDisabled, orderDisabled) => `
    <button id="purchase" data-cmd="soldier" data-kind="buy" ${purchaseDisabled ? 'disabled' : ''}>Buy</button>
    <button id="move" data-cmd="company-up" data-id="1" ${orderDisabled ? 'disabled' : ''}>Move earlier</button>`;
  const {root, controls, find} = page(markup(true, false)), purchase = find('purchase'), move = find('move');
  controls.sync(true);
  controls.release();updatePage(root, markup(false, true));controls.sync(true);
  assert.equal(find('purchase'), purchase);assert.equal(find('move'), move, 'The real page patch reuses controls');
  assert.equal(purchase.disabled, true);assert.equal(move.disabled, true, 'Both still wait for the save');
  controls.sync(false);
  assert.equal(purchase.disabled, false, 'A newly affordable purchase becomes available');
  assert.equal(move.disabled, true, 'The new first-position restriction survives');
  assert.equal(purchase.hasAttribute('aria-busy'), false);assert.equal(move.hasAttribute('aria-busy'), false);
});

test('replacing a dialog during a save guards its new controls and releases the discarded controls', () => {
  const {root, controls, find} = page('<section id="modal"><button id="old" data-cmd="reply">Reply</button></section>');
  const old = find('old');controls.sync(true);
  find('modal').innerHTML = '<button id="new" data-cmd="soldier" data-kind="buy" disabled>Cannot afford</button><button id="back" data-cmd="menu">Back</button>';
  controls.sync(true);
  assert.equal(old.isConnected, false);assert.equal(old.disabled, false);assert.equal(old.hasAttribute('aria-busy'), false);
  assert.equal(find('new').disabled, true);assert.equal(find('new').getAttribute('aria-busy'), 'true');
  assert.equal(find('back').disabled, false);
  controls.release();assert.equal(find('new').disabled, true);assert.equal(find('new').hasAttribute('aria-busy'), false);
  assert.equal(root.querySelectorAll('[aria-busy]').length, 0);
});
