import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {encounterView} from '../src/ui/encounter-view.js';
import {actionNames, esc} from '../src/ui/view-helpers.js';

const scenes = JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json', import.meta.url), 'utf8')).scenes;
const checkpoint = id => Game.deserialize(JSON.stringify(scenes.find(scene => scene.id === id).state));
function freshBattle() {
  const state = Game.newGame('<Aurelius> & Marcellus');
  assert.ok(Game.choose(state, Game.getChapter(state).decision.options[0].id).ok);
  assert.ok(Game.startEncounter(state).ok);
  return state;
}
function render(state, extra = {}) {
  const before = Game.serialize(state);
  const html = encounterView({state, selected:'hero', requirements:() => '',
    header:() => { throw new Error('The website header must not enter the command stage.'); },
    footer:() => { throw new Error('The website footer must not enter the command stage.'); }, ...extra});
  assert.equal(Game.serialize(state), before, 'Rendering and previewing must not spend actions, alter state, or advance the seed.');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Control IDs must remain unique.');
  return html;
}
const inspector = html => html.split('<div class="command-inspection"')[1].split('<div class="command-commit"')[0];

test('Horizon is an explicit accessible 3D camera control and is absent from the 2D alternative',()=>{
  const state=freshBattle(),threeD=render(state,{can3D:true,view3D:true});
  assert.match(threeD,/<button data-cmd="camera-horizon"[^>]*aria-keyshortcuts="H"[^>]*>Horizon<\/button>/);
  assert.ok(threeD.indexOf('data-cmd="camera-home"')<threeD.indexOf('data-cmd="camera-horizon"'));
  assert.match(threeD,/H shows the horizon/);assert.match(threeD,/H for the horizon/);
  assert.ok(!render(state,{can3D:true,view3D:false}).includes('data-cmd="camera-horizon"'));
  state.encounter.status='won'; // Presentation case: camera remains available after a result.
  assert.ok(render(state,{can3D:true,view3D:true}).includes('data-cmd="camera-horizon"'));
});

test('Command stage keeps a complete named-control alternative and the same legal action/keyboard order', () => {
  const state = freshBattle(), html = render(state), actions = Game.getActions(state, 'hero');
  assert.equal(state.encounter.combatVersion, 2);
  assert.ok(html.includes(esc(state.name)));
  assert.ok(!html.includes(state.name));
  for (const id of ['battle-board','unit-select','action-select','target-select','confirm-action','end-turn','board-hover','action-feedback','art-loading-status','offline-status']) {
    assert.ok(html.includes(`id="${id}"`), `Missing app control or status region: ${id}`);
  }
  assert.match(html, /<details id="command-named-controls" class="command-named-controls">/);
  assert.match(html, /<details id="command-mission-record" class="command-mission-record">/);
  assert.match(html, /<details id="command-intelligence" class="command-intelligence">/);
  const buttons = [...html.matchAll(/<button id="action-([^"]+)"[^>]*>(.*?)<\/button>/gs)];
  assert.deepEqual(buttons.map(button => button[1]), actions);
  buttons.forEach((button, index) => {
    assert.ok(button[2].includes(esc(actionNames[button[1]])));
    if (index < 9) assert.ok(button[2].includes(`>${index + 1}</kbd>`));
  });
});

test('Visible battle target names and authoritative damage/ammunition previews are escaped and remain reviewable', () => {
  const state = freshBattle();
  const target = Game.getTargets(state, 'hero', 'throw')[0];
  assert.ok(target, 'The opening drill has a legal javelin target.');
  const enemy = state.encounter.units.find(unit => unit.id === target.unitId);
  enemy.name = '<Training partner> & witness'; // Explicit presentation stress, not a gameplay fixture.
  const command = {unitId:'hero', action:'throw', x:target.x, y:target.y, targetId:target.unitId};
  const preview = Game.preview(state, command);
  assert.ok(preview.ok);
  const html = render(state, {action:'throw', target});
  assert.ok(inspector(html).includes(esc(enemy.name)));
  assert.ok(!html.includes(enemy.name));
  assert.ok(inspector(html).includes(esc(preview.message)), 'The rule-calculated damage, ammunition and costs must reach the review surface.');
  assert.match(html, /id="confirm-action"[^>]*data-cmd="confirm"[^>]*>Confirm Throw javelin/);
});

test('An out-of-range focus gives visible intelligence without inventing a target or enabling confirmation', () => {
  const state = checkpoint('board-ch2-rearguard');
  const attackIds = new Set(['strike','throw'].flatMap(action => Game.getTargets(state, 'hero', action).map(target => target.unitId)));
  const enemy = state.encounter.units.find(unit => unit.side === 'enemy' && !unit.hidden && unit.hp > 0 && !attackIds.has(unit.id));
  assert.ok(enemy, 'This legally reached field has an opponent outside current attack reach.');
  const html = render(state, {focusTile:{x:enemy.x, y:enemy.y}});
  assert.ok(inspector(html).includes(esc(enemy.name)));
  assert.ok(inspector(html).includes(esc(enemy.intent)));
  assert.match(html, /id="confirm-action"[^>]* disabled/);
  assert.ok(!html.includes('id="action-preview"'));
});

test('Early autonomous allies never advertise unavailable player commands or ready movement', () => {
  const state = checkpoint('board-ch1-road');
  const ally = state.encounter.units.find(unit => unit.side === 'ally' && unit.hp > 0);
  assert.ok(ally);
  assert.deepEqual(Game.getActions(state, ally.id), []);
  const html = render(state, {selected:ally.id});
  const actor = html.split('<div class="command-actor">')[1].split('<div class="command-roster"')[0];
  assert.ok(actor.includes('Acting on own orders'));
  assert.ok(!actor.includes('Move ready') && !actor.includes('Action ready'));
  const button = html.match(new RegExp(`<button id="select-unit-${ally.id}"[^>]*>(.*?)</button>`, 's'));
  assert.ok(button[0].includes('Autonomous'));
  assert.ok(!button[0].includes('Commands available'));
  assert.ok(html.includes('Select your commander to act'));
});

test('Inspection and collapsed intelligence never reveal a hidden figure through its coordinates or ID', () => {
  const state = freshBattle(), enemy = state.encounter.units.find(unit => unit.side === 'enemy');
  enemy.name = 'Hidden-only sentinel'; enemy.intent = 'Hidden-only intention'; enemy.hidden = true;
  // Synthetic visibility stress tests both kinds of pointer payload.
  for (const focusTile of [{x:enemy.x,y:enemy.y}, {x:enemy.x,y:enemy.y,unitId:enemy.id}]) {
    const html = render(state, {focusTile});
    assert.ok(!html.includes(enemy.name));
    assert.ok(!html.includes(enemy.intent));
    assert.match(html, /id="confirm-action"[^>]* disabled/);
  }
});

test('Political conversation retains exact support changes and Promise costs outside the collapsed full forecast', () => {
  const state = checkpoint('board-ch11-adlection');
  assert.equal(state.encounter.politicsVersion, 2);
  const speaker = state.encounter.units.find(unit => ['player','ally'].includes(unit.side) && Game.getTargets(state, unit.id, 'promise').length);
  assert.ok(speaker, 'The legally reached Senate checkpoint has a legal Promise.');
  const target = Game.getTargets(state, speaker.id, 'promise')[0];
  const delegate = state.encounter.units.find(unit => unit.id === target.unitId);
  delegate.name = '<Senator> & delegation'; // Explicit name-escaping stress only.
  const checked = Game.preview(state, {unitId:speaker.id,action:'promise',x:target.x,y:target.y,targetId:target.unitId});
  assert.ok(checked.ok);
  const html = render(state, {selected:speaker.id,action:'promise',target});
  const visiblePreview = inspector(html).split('<details id="command-full-forecast"')[0];
  const f = checked.forecast;
  assert.ok(visiblePreview.includes(esc(delegate.name)));
  assert.ok(visiblePreview.includes(esc(delegate.bloc)) && visiblePreview.includes(esc(delegate.interest)));
  assert.ok(visiblePreview.includes(`Support ${f.votesBefore} → ${f.votesAfter}`));
  assert.ok(visiblePreview.includes(`${f.promise.cost} supplies owed at accession`));
  assert.ok(visiblePreview.includes('Each missing supply costs 1 Public'));
  assert.ok(visiblePreview.includes('−8 Public, −4 Backing'));
  assert.ok(!html.includes(delegate.name));
  assert.ok(html.includes(esc(checked.message)), 'The complete rule forecast remains available.');
});

test('Finished encounters expose the correct record or retry path without leaving active commands available', () => {
  for (const status of ['won','lost']) {
    const state = freshBattle();
    state.encounter.status = status; // Synthetic result presentation; this test does not award a victory.
    const html = render(state);
    assert.match(html, /class="command-options"[^>]* hidden/);
    assert.match(html, /id="end-turn"[^>]* disabled/);
    assert.match(html, /id="confirm-action"[^>]* disabled/);
    assert.equal(html.includes('data-cmd="commit"'), status === 'won');
    assert.ok(html.includes(status === 'won' ? 'Record the result' : 'Retry the complete checkpoint'));
  }
});

test('Removing the website header does not remove persistent save warnings or their recovery controls', () => {
  const state = freshBattle(), problem = '<Other tab> has newer progress.';
  const html = render(state, {saveProblem:problem,saveConflict:true});
  assert.match(html, /class="command-save-warning" role="alert"/);
  assert.ok(html.includes(esc(problem)) && !html.includes(problem));
  assert.ok(html.includes('data-cmd="export"'));
  assert.ok(html.includes('data-cmd="takeover"'));
  assert.ok(!render(state, {saveProblem:problem,saveConflict:false}).includes('data-cmd="takeover"'));
});
