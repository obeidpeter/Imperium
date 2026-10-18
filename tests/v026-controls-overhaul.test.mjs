import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {
  actionCostLabel,
  explainActionTargetGap,
  explainUnavailableActions,
  formationRosterPreview,
  delegateAppealSummary,
  unusedTurnSummary,
} from '../src/ui/direct-controls.js';
import {coalitionPanel} from '../src/ui/tactical-intel.js';
import {tacticalCoaching} from '../src/ui/campaign-upgrade-views.js';
import {allocationDraftPreview, createCampaignViews} from '../src/ui/campaign-views.js';
import {encounterView} from '../src/ui/encounter-view.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function advanceToChapter(targetChapter) {
  const state = Game.newGame('Aurelius Marcellus', 275, {progression: true, difficulty: 'standard'});
  state.chapter = targetChapter;
  state.completed = Array.from({length: targetChapter - 1}, (_, i) => i + 1);
  state.milestones = [];
  for (let i = 1; i < targetChapter; i++) state.milestones.push(`chapter:${i}`);
  if (targetChapter >= 10) state.milestones.push('dux');
  if (targetChapter >= 11) state.milestones.push('governorship');
  if (targetChapter >= 12) state.milestones.push('senator', 'senate-challenge');
  const ch = Game.getChapter(state);
  Game.choose(state, ch.decision.options[0].id);
  if (targetChapter === 1) state.oath = true;
  if (targetChapter === 7) Game.prepare(state, 'drill');
  if (targetChapter === 8) Game.negotiate(state, 'safe-passage');
  if (targetChapter === 9) Game.selectStratagem(state, 'flank');
  if (targetChapter === 10) {
    Game.allocate(state, {river: 2, farms: 2, town: 2});
    Game.judge(state, state.decisions.ch10);
  }
  return state;
}

test('Player-Control Overhaul: actionCostLabel and unusedTurnSummary report explicit action costs and remaining turn capacity', () => {
  const state = advanceToChapter(5);
  Game.startEncounter(state);
  const hero = state.encounter.units.find(u => u.id === 'hero');

  assert.equal(actionCostLabel(state, hero, 'move'), '1 move');
  assert.equal(actionCostLabel(state, hero, 'strike'), '1 action');
  assert.match(actionCostLabel(state, hero, 'throw'), /1 action · 1 javelin/);
  assert.equal(actionCostLabel(state, hero, 'order'), '1 order');
  assert.equal(actionCostLabel(state, hero, 'formation'), '1 order');

  const beforeSummary = unusedTurnSummary(state);
  assert.equal(beforeSummary.hasUnusedAction, true);
  assert.equal(beforeSummary.hasUnusedOrder, true);
  assert.match(beforeSummary.message, /Still available this turn:/);
  assert.match(beforeSummary.message, /orders/);

  for (const unit of state.encounter.units.filter(u => ['player', 'ally'].includes(u.side))) {
    unit.moved = true;
    unit.acted = true;
  }
  state.encounter.commandsLeft = 0;
  const afterSummary = unusedTurnSummary(state);
  assert.equal(afterSummary.hasUnusedAction, false);
  assert.equal(afterSummary.hasUnusedOrder, false);
  assert.equal(afterSummary.message, 'All personal moves and actions spent this turn.');
});

test('Player-Control Overhaul: explainActionTargetGap and explainUnavailableActions diagnose disabled and empty-target states', () => {
  const state = advanceToChapter(4);
  Game.startEncounter(state);
  const hero = state.encounter.units.find(u => u.id === 'hero');

  // Move enemies far away so strike and throw have 0 targets in reach
  for (const enemy of state.encounter.units.filter(u => u.side === 'enemy')) {
    enemy.x = 7;
    enemy.y = 0;
  }
  hero.x = 0;
  hero.y = 7;

  assert.match(explainActionTargetGap(state, 'hero', 'strike'), /no visible enemy on an adjacent tile/i);
  assert.match(explainActionTargetGap(state, 'hero', 'throw'), /no visible enemy within 3 tiles/i);

  // Spend hero move and javelins, and exhaust commandsLeft to verify explainUnavailableActions
  hero.moved = true;
  hero.ammo = 0;
  state.encounter.commandsLeft = 0;

  const reasons = explainUnavailableActions(state, 'hero');
  const byAction = Object.fromEntries(reasons.map(r => [r.id, r.reason]));
  assert.match(byAction.move, /Already moved this turn/i);
  assert.match(byAction.throw, /No javelins remaining/i);
  assert.match(byAction.order, /Requires 1 order/i);

  // Check an unspecialized allied unit in Chapter 2: explains when direct orders unlock
  const ch2State = advanceToChapter(2);
  Game.startEncounter(ch2State);
  const ally = ch2State.encounter.units.find(u => u.side === 'ally');
  const allyReasons = explainUnavailableActions(ch2State, ally.id);
  assert.ok(allyReasons.some(r => /Unlocks in Chapter IV/i.test(r.reason)));
});

test('Player-Control Overhaul: formationRosterPreview names joining allies and explains excluded nearby allies', () => {
  const state = advanceToChapter(5);
  Game.startEncounter(state);
  const allies = state.encounter.units.filter(u => u.side === 'ally');
  assert.ok(allies.length >= 2);

  const anchor = allies[0];
  anchor.x = 2;
  anchor.y = 4;
  anchor.ordered = false;

  const adjacentAlly = allies[1];
  adjacentAlly.x = 3;
  adjacentAlly.y = 4;
  adjacentAlly.ordered = false;

  if (allies[2]) {
    allies[2].x = 2;
    allies[2].y = 5;
    allies[2].ordered = true; // Excluded because already ordered this turn
  }

  const preview = formationRosterPreview(deepFreeze(structuredClone(state)), anchor.id, 'shield-wall');
  assert.ok(preview);
  assert.match(preview.summary, /Joining shield-wall/);
  assert.ok(preview.participants.some(p => p.id === anchor.id));
  assert.ok(preview.participants.some(p => p.id === adjacentAlly.id));
  if (allies[2]) {
    assert.ok(preview.excluded.some(e => e.id === allies[2].id && /already ordered/i.test(e.reason)));
  }
});

test('Player-Control Overhaul: Political Contest clarity explains Resolve, deadline vote counting, and delegate appeal summaries', () => {
  const state = advanceToChapter(7);
  // Chapter 7 encounter 0 is the political Contest (Council at Milan)
  Game.startEncounter(state);
  assert.equal(state.encounter.kind, 'contest');

  const voter = state.encounter.units.find(u => u.role === 'voter');
  assert.ok(voter);

  const appeal = delegateAppealSummary(voter, state.encounter.politicsVersion);
  assert.match(appeal, /Strongest appeals:/);

  const panelHtml = coalitionPanel(state.encounter, Game.voteCount(state));
  assert.match(panelHtml, /Counted at the deadline/i);
  assert.match(panelHtml, /early majority does not end the debate/i);
  assert.match(panelHtml, /withdrawn speaker keeps their vote/i);

  const viewHtml = encounterView({
    view3D: false,
    can3D: true,
    fastMotion: false,
    coach: true,
    guide: false,
    state: deepFreeze(structuredClone(state)),
    selected: 'hero',
    action: null,
    target: null,
    focusTile: {x: voter.x, y: voter.y, unitId: voter.id},
    showGrid: false,
    formation: 'shield-wall',
    orderAction: 'advance',
    orderDestination: null,
    feedback: '',
    header: () => '<header></header>',
    footer: () => '<footer></footer>',
    requirements: () => '',
  });

  assert.match(viewHtml, /data-cmd="inspect-delegate"/);
  assert.match(viewHtml, /Strongest appeals:/);
  assert.match(viewHtml, /speaking stamina; 0 withdraws from speaking, vote remains/i);
});

test('Player-Control Overhaul: Chapter X allocationDraftPreview and presets explain exact convoy totals and provincial effects', () => {
  const validBalanced = allocationDraftPreview({river: 2, farms: 2, town: 2});
  assert.match(validBalanced, /Ready to dispatch \(6 \/ 6 convoys\)/);
  assert.match(validBalanced, /\+2 Supplies/);
  assert.match(validBalanced, /\+2 Army Loyalty \(\+5 road morale\)/);
  assert.match(validBalanced, /\+2 Public Confidence \(\+5 store integrity\)/);
  assert.match(validBalanced, /\+2 Political Backing/);

  const validTownFocus = allocationDraftPreview({river: 1, farms: 1, town: 4});
  assert.match(validTownFocus, /\+1 Landholder stance in tribunal/);

  const invalidUnder = allocationDraftPreview({river: 1, farms: 2, town: 1});
  assert.match(invalidUnder, /Draft total: 4 \/ 6 convoys/);
  assert.match(invalidUnder, /add 2 more/);

  const invalidOver = allocationDraftPreview({river: 3, farms: 3, town: 2});
  assert.match(invalidOver, /Draft total: 8 \/ 6 convoys/);
  assert.match(invalidOver, /remove 2/);

  // Verify Chapter 10 camp renders preset buttons and #allocation-preview before allocation
  const state = Game.newGame('Aurelius Marcellus', 275, {progression: true});
  state.chapter = 10;
  state.completed = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  state.milestones = ['chapter:1', 'chapter:2', 'chapter:3', 'chapter:4', 'chapter:5', 'chapter:6', 'chapter:7', 'chapter:8', 'chapter:9', 'dux'];
  const views = createCampaignViews(() => ({
    state,
    screen: 'game',
    settings: {textScale: 1},
    saving: false,
    lastSaved: '',
    saveProblem: '',
    saveConflict: false,
    offline: false,
    offlineProgress: '',
    currentChapterOffline: false,
    artProgress: '',
  }));
  const campHtml = views.camp();
  assert.match(campHtml, /data-cmd="allocation-preset" data-id="2,2,2"/);
  assert.match(campHtml, /data-cmd="allocation-preset" data-id="4,1,1"/);
  assert.match(campHtml, /id="allocation-preview"/);
});

test('Player-Control Overhaul: tacticalCoaching renders What can I do? summary without mutating frozen state', () => {
  const state = advanceToChapter(5);
  Game.startEncounter(state);
  const frozen = deepFreeze(structuredClone(state));
  const html = tacticalCoaching(frozen, true, 'hero');
  assert.match(html, /What can I do\?/);
  assert.match(html, /Required before promotion:/);
});
