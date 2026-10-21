import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {votes} from '../src/core/contest.js';
import {CONFIG} from '../src/config.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {coalitionPanel} from '../src/ui/tactical-intel.js';
import {encounterView} from '../src/ui/encounter-view.js';
import {quartermasterPanel, createCampaignViews} from '../src/ui/campaign-views.js';
import {createPanels} from '../src/ui/panels.js';
import {paintBattle} from '../src/ui/battle-art.js';

const clone = value => JSON.parse(JSON.stringify(value));
const checkpoints = new Map();
let campaignResult = null;
function ensureCampaign() {
  if (!campaignResult) {
    campaignResult = runProgressionCampaign({
      onCheckpoint: s => checkpoints.set(Game.getChapter(s).encounters[s.encounterIndex].id, clone(s)),
    });
  }
  return campaignResult;
}
function campState(id) {
  ensureCampaign();
  return clone(checkpoints.get(id));
}
function start(id) {
  const s = campState(id);
  assert.ok(Game.startEncounter(s).ok);
  return s;
}

test('v0.28.0: Tactical Undo Move Before Acting (Regressus) in battles and Contests', () => {
  // The configured edition always matches the package (0.28.0 introduced this feature).
  assert.equal(CONFIG.version, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);

  // 1. Field battle undo move flow
  const battleState = start('ch2-marsh');
  const enc = battleState.encounter;
  const hero = enc.units.find(u => u.id === 'hero');
  const startPos = {x: hero.x, y: hero.y, facing: hero.facing, lastMoveDistance: hero.lastMoveDistance ?? 0};

  assert.equal(Game.canUndoMove(battleState).available, false);
  const moves = Game.getTargets(battleState, 'hero', 'move');
  assert.ok(moves.length > 0);
  const movedRes = Game.act(battleState, {unitId: 'hero', action: 'move', x: moves[0].x, y: moves[0].y});
  assert.equal(movedRes.ok, true);

  assert.equal(hero.moved, true);
  assert.deepEqual(hero.moveOrigin, startPos);
  assert.equal(Game.canUndoMove(battleState).available, true);

  // Verify UI renders #undo-move button while undo is available
  const htmlWithUndo = encounterView({
    state: battleState,
    selected: 'hero',
    action: null,
    target: null,
    focusTile: null,
  });
  assert.match(htmlWithUndo, /id="undo-move"/);
  assert.match(htmlWithUndo, /data-cmd="undo-move"/);

  // Verify serialization remains clean (moveOrigin is non-enumerable so save hashes stay byte-identical)
  const restored = Game.deserialize(Game.serialize(battleState));
  assert.equal(restored.encounter.units.find(u => u.id === 'hero').moved, true);

  // Execute undoMove and verify position and moved flag are restored
  const undoRes = Game.undoMove(battleState);
  assert.equal(undoRes.ok, true);
  assert.equal(hero.x, startPos.x);
  assert.equal(hero.y, startPos.y);
  assert.equal(hero.moved, false);
  assert.equal(hero.moveOrigin, undefined);
  assert.equal(Game.canUndoMove(battleState).available, false);

  // Move again, then commit an action — undoMove must lock out
  Game.act(battleState, {unitId: 'hero', action: 'move', x: moves[0].x, y: moves[0].y});
  assert.equal(Game.canUndoMove(battleState).available, true);
  Game.act(battleState, {unitId: 'hero', action: 'brace', x: hero.x, y: hero.y});
  assert.equal(Game.canUndoMove(battleState).available, false);
  assert.equal(Game.undoMove(battleState).ok, false);

  // 2. Political Contest undo move flow
  const contestState = start('ch7-council');
  const cEnc = contestState.encounter;
  const speaker = cEnc.units.find(u => u.id === 'hero');
  const speakerStart = {x: speaker.x, y: speaker.y};

  const cMoves = Game.getTargets(contestState, 'hero', 'move');
  assert.ok(cMoves.length > 0);
  assert.equal(Game.act(contestState, {unitId: 'hero', action: 'move', x: cMoves[0].x, y: cMoves[0].y}).ok, true);
  assert.equal(Game.canUndoMove(contestState).available, true);
  assert.equal(Game.undoMove(contestState).ok, true);
  assert.equal(speaker.x, speakerStart.x);
  assert.equal(speaker.y, speakerStart.y);
  assert.equal(speaker.moved, false);

  // Moving and then speaking locks out undoMove
  assert.equal(Game.act(contestState, {unitId: 'hero', action: 'move', x: cMoves[0].x, y: cMoves[0].y}).ok, true);
  assert.equal(Game.canUndoMove(contestState).available, true);
  const speechTargets = Game.getTargets(contestState, 'hero', 'reason');
  if (speechTargets.length) {
    assert.equal(Game.act(contestState, {unitId: 'hero', action: 'reason', x: speechTargets[0].x, y: speechTargets[0].y, targetId: speechTargets[0].unitId}).ok, true);
    assert.equal(Game.canUndoMove(contestState).available, false);
  }
});

test('v0.28.0: 3D & 2D Reinforcement Arrival Beacons (Exploratores)', async () => {
  const state = start('ch2-marsh');
  const enc = state.encounter;
  // Ensure there is a pending reinforcement wave
  enc.mission.waves = [{x: 6, y: 2, turn: enc.turn + 1, role: 'raider', arrived: false}];

  const beacons = Game.reinforcementBeacons(enc);
  assert.equal(beacons.length, 1);
  assert.equal(beacons[0].turn, enc.turn + 1);
  assert.equal(beacons[0].imminent, true);
  assert.equal(beacons[0].coord, '7C');
  assert.match(beacons[0].label, /T2 · Raider/);

  // Mission record surfaces reinforcement schedule
  const viewHtml = encounterView({
    state,
    selected: 'hero',
    action: null,
    target: null,
    focusTile: null,
  });
  assert.match(viewHtml, /reinforcement-schedule/);
  assert.match(viewHtml, /Incoming waves:/);
  assert.match(viewHtml, /T2 · Raider at 7C/);

  // 2D canvas renders T# reinforcement beacon badge
  const texts = [];
  const fakeCtx = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc() {},
    ellipse() {},
    rect() {},
    clip() {},
    translate() {},
    scale() {},
    rotate() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    clearRect() {},
    setLineDash() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    drawImage() {},
    fillText(text) { texts.push(String(text)); },
    strokeText() {},
    measureText(text) { return {width: String(text).length * 7}; },
    createLinearGradient() { return {addColorStop() {}}; },
    createRadialGradient() { return {addColorStop() {}}; },
  };
  paintBattle(fakeCtx, 960, 600, {ox: 480, oy: 120, tw: 64, th: 32}, enc, 'hero', [], null, state.chapter, {quality: 'performance'});
  assert.ok(texts.some(t => t.includes(`T${beacons[0].turn}`)), 'Expected 2D canvas to render reinforcement turn badge');

  // 3D stage populates reinforcementBeacons map
  const {BattleStage} = await import('../src/showcase/stage.js');
  const T = await import('../vendor/three/three.module.js');
  const stage = Object.create(BattleStage.prototype);
  Object.assign(stage, {
    overlay: new T.Group(),
    targetGeometry: new T.RingGeometry(0.4, 0.55, 24),
    reinforcementBeacons: new Map(),
    world: tile => new T.Vector3(tile.x * 2.5, 0, tile.y * 2.5),
  });
  stage.updateReinforcementBeacons(enc);
  assert.equal(stage.reinforcementBeacons.size, 1);
  const beaconGroup = stage.reinforcementBeacons.get('wave-0');
  assert.ok(beaconGroup);
  assert.equal(beaconGroup.visible, true);
  assert.equal(beaconGroup.userData.wave.turn, beacons[0].turn);
});

test('v0.28.0: Clickable Coalition Vote Seats & Chamber Floor Inspector (Tabula Curiae)', () => {
  const s = start('ch7-council');
  const e = s.encounter;
  const hero = e.units.find(u => u.id === 'hero');
  const voters = e.units.filter(u => u.role === 'voter');
  voters[0].stance = 1;
  voters[1].stance = 0;
  voters[1].x = hero.x + 1;
  voters[1].y = hero.y;
  const rival = e.units.find(u => u.side === 'enemy' && u.role === 'speaker');
  if (rival) {
    rival.x = voters[0].x + 1;
    rival.y = voters[0].y;
  }

  const html = coalitionPanel(e, votes(e), s);
  assert.match(html, /<button type="button" class="vote-seat[^"]*" data-cmd="inspect-delegate" data-id="/);
  assert.match(html, /class="whip-link" data-cmd="inspect-delegate"/);
});

test('v0.28.0: Quartermaster Solvency & Finale Route Tracker (Ratio Imperii)', () => {
  const state = campState('ch7-council');

  // Add an open obligation due in this chapter that exceeds current supplies
  state.supplies = 2;
  state.obligations.push({
    id: 'ob-test-due',
    to: 'Marcus Cato',
    promise: 'Grain subsidy covenant',
    cost: 5,
    due: state.chapter,
    consequence: 'Trust falls if unpaid.',
    status: 'open',
  });

  const forecast = Game.quartermasterForecast(state);
  assert.equal(forecast.supplies, 2);
  assert.ok(forecast.dueNowCost >= 5);
  assert.equal(forecast.solvent, false);
  assert.ok(forecast.shortfall >= 3);
  assert.equal(forecast.finaleRoutes.length, 5);
  assert.deepEqual(forecast.finaleRoutes.map(r => r.id), ['backer', 'battle', 'defection', 'settlement', 'surrender']);

  const qHtml = quartermasterPanel(state);
  assert.match(qHtml, /id="camp-quartermaster"/);
  assert.match(qHtml, /shortfall/);
  assert.match(qHtml, /due in this camp/);

  const views = createCampaignViews(() => ({
    state,
    settings: {guide: false},
    chapterArtMarkup: () => '',
    helpTip: () => '',
    consequenceCards: () => '',
    meters: () => '',
    requirements: () => '',
  }));
  const campHtml = views.camp();
  assert.match(campHtml, /id="camp-quartermaster"/);

  let ledgerHtml = '';
  const panels = createPanels(() => ({
    state,
    settings: {},
    meters: () => '',
    requirements: () => '',
    showModal: (_title, body) => { ledgerHtml = body; },
  }));
  panels.showLedger();
  assert.match(ledgerHtml, /id="quartermaster-forecast"/);
  assert.match(ledgerHtml, /Quartermaster solvency & succession forecast/);
});
