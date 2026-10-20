import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {movementRoute} from '../src/core/movement.js';
import {clone} from '../src/core/shared.js';
import {fieldBlocked,fieldMoveCost} from '../src/core/field-geometry.js';
import {routeSummary} from '../src/ui/direct-controls.js';
import {readFile} from 'node:fs/promises';

// Positions from an expanded campaign played from New Game with public
// commands only: every encounter start and the start of every expanded turn.
let samples = null;
function expandedPlay() {
  if (samples) return samples;
  samples = [];
  runProgressionCampaign({featureEdition: 31, onEncounter: s => samples.push(clone(s)), beforeExpandedTurn: s => samples.push(clone(s))});
  return samples.filter(s => s.phase === 'encounter' && s.encounter?.status === 'active');
}
const movers = s => s.encounter.units.filter(u => ['player', 'ally'].includes(u.side) && (u.resolve ?? u.hp) > 0 && Game.getActions(s, u.id).includes('move'));
const closedGate = (e, p) => fieldBlocked(e, p.x, p.y);
const rainOnHigh = (e, path) => e.weather === 'rain' && path.slice(1).some(p => e.terrain[p.y][p.x] === 'high');

test('v0.32.0: on expanded fields every legal move walks a route at the rules’ own cost, around closed gates and through the rain', () => {
  const coverage = {routes: 0, besideClosedGate: 0, highInRain: 0, encounters: new Set()};
  for (const s of expandedPlay()) {
    const e = s.encounter, before = Game.serialize(s), gates = (e.field?.objects ?? []).filter(o => o.kind === 'gate' && o.state === 'closed');
    coverage.encounters.add(e.id);
    for (const unit of movers(s)) for (const t of Game.getTargets(s, unit.id, 'move')) {
      const route = movementRoute(e, unit, t), plan = Game.moveRoute(s, unit.id, t);
      assert.ok(route, `${e.id}: ${unit.id} has a route to ${t.x},${t.y}`);
      assert.equal(route.cost, t.cost, `${e.id}: the route to ${t.x},${t.y} costs what the rules charge`);
      assert.equal(route.path.slice(1).reduce((sum, p) => sum + fieldMoveCost(e, unit, p.x, p.y), 0), t.cost);
      assert.ok(!route.path.some(p => closedGate(e, p)), 'never through a closed gate');
      assert.deepEqual(plan.path, route.path);assert.equal(plan.reachable, true);
      coverage.routes++;
      if (gates.length && route.path.some(p => gates.some(g => Math.abs(g.x - p.x) + Math.abs(g.y - p.y) === 1))) coverage.besideClosedGate++;
      if (rainOnHigh(e, route.path)) coverage.highInRain++;
    }
    assert.equal(Game.serialize(s), before, 'Planning never changes the save or the random generator');
  }
  assert.equal(coverage.encounters.size, 25, 'Every encounter of the expanded campaign is sampled');
  assert.ok(coverage.besideClosedGate > 0, 'Some routes pass a closed gate');
  assert.ok(coverage.highInRain > 0, 'Some routes climb high ground in the rain');
});

test('v0.32.0: the animation and the 2D line walk the same route over high ground in the rain', async () => {
  const {buildEncounterTimeline} = await import('../src/ui/animation-timeline.js');
  const {snapshotEncounter} = await import('../src/ui/motion.js');
  const {previewPath} = await import('../src/ui/battle-art.js');
  let walks = 0;
  for (const sample of expandedPlay()) for (const unit of movers(sample)) for (const t of Game.getTargets(sample, unit.id, 'move')) {
    const shown = Game.moveRoute(sample, unit.id, t).path;
    if (!rainOnHigh(sample.encounter, shown) || walks >= 6) continue;
    const s = clone(sample), mover = s.encounter.units.find(u => u.id === unit.id);
    assert.deepEqual(previewPath(s.encounter, mover, t), shown);
    const before = snapshotEncounter(s.encounter), command = {unitId: unit.id, action: 'move', x: t.x, y: t.y};
    assert.ok(Game.act(s, command).ok);
    const walk = buildEncounterTimeline(before, snapshotEncounter(s.encounter), {command}).tracks.find(track => track.unitId === unit.id && track.path);
    assert.deepEqual(walk.path, shown, `${s.encounter.id}: ${unit.id} walks the route the preview drew`);
    walks++;
  }
  assert.ok(walks > 0, 'At least one legal walk climbs high ground in the rain');
});

test('v0.32.0: a closed gate is not a destination until the gate is opened', () => {
  // Legal start of an expanded wide-field encounter; the hero is then placed
  // beside its gate (an injected position, as in the expanded-campaign tests).
  const start = expandedPlay().find(s => s.encounter.units.some(u => u.id === 'hero') && (s.encounter.field?.objects ?? []).some(o => o.kind === 'gate' && o.state === 'closed') && s.encounter.turn === 1);
  assert.ok(start, 'An expanded encounter with a closed gate');
  const s = clone(start), e = s.encounter, gate = e.field.objects.find(o => o.kind === 'gate'), hero = e.units.find(u => u.id === 'hero');
  e.units = e.units.filter(u => u === hero || !(Math.abs(u.x - gate.x) + Math.abs(u.y - gate.y) <= 1));
  Object.assign(hero, {x: gate.x - 1, y: gate.y, moved: false, acted: false});
  const shut = Game.moveRoute(s, 'hero', gate);
  assert.equal(shut.stop, null);assert.equal(shut.reason, 'gate');assert.equal(routeSummary(shut), 'No passage until opened');
  assert.ok(Game.fieldAction(s, gate.id).ok, 'Opening the gate is a legal field action');
  const open = Game.moveRoute(s, 'hero', gate);
  assert.equal(open.reachable, true);assert.deepEqual(open.path, [{x: gate.x - 1, y: gate.y}, {x: gate.x, y: gate.y}]);
});

test('v0.32.0: the configured edition matches the package', async () => {
  const {CONFIG} = await import('../src/config.js'), {readFile} = await import('node:fs/promises');
  assert.equal(CONFIG.version, JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
});

test('v0.32.1: the readout, announcements, target list and ground note name field objects and their state', async () => {
  const {fieldLabel, selectedGround} = await import('../src/ui/tactical-intel.js');
  const {targetName} = await import('../src/ui/encounter-view.js');
  const start = expandedPlay().find(s => (s.encounter.field?.objects ?? []).some(o => o.kind === 'gate' && o.state === 'closed') && s.encounter.turn === 1);
  const s = clone(start), e = s.encounter, hero = e.units.find(u => u.id === 'hero'), find = kind => e.field.objects.find(o => o.kind === kind);
  const gate = find('gate'), bridge = find('bridge'), cart = find('stores');
  assert.equal(fieldLabel(e, gate), 'Side gate (closed)');
  assert.equal(fieldLabel(e, bridge), 'Damaged footbridge', 'A state already in the name is not repeated');
  assert.equal(fieldLabel(e, cart), 'Abandoned supply cart (available)');
  assert.equal(fieldLabel(e, hero), '', 'Nothing to name on open ground');
  assert.equal(fieldLabel({...e, featureEdition: undefined}, gate), '', 'Older chronicles have no field objects');
  assert.match(selectedGround(e, hero, gate), /Target: Open ground<\/strong> · 9C · Side gate \(closed\)/);
  assert.match(targetName(s, {x: cart.x, y: cart.y, cost: 2}), /^Abandoned supply cart \(available\) · \S[^·]* · \d+[A-H] · 2 movement$/);
  // Rain makes each step onto high ground cost one more; the ground note says so (an injected weather change).
  const high = {x: 9, y: 0};assert.equal(e.terrain[high.y][high.x], 'high');
  assert.doesNotMatch(selectedGround(e, hero, high), /In rain/);
  assert.match(selectedGround({...e, weather: 'rain'}, hero, high), /Offers defensive cover\. In rain, each step onto it costs 1 more movement\./);
  const app = await readFile(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  assert.match(app, /const u=visibleUnitAt\(state\.encounter,point\),field=fieldLabel\(state\.encounter,point\),walk=routeSummary\(routeAt\(point\)\);/, 'The hover readout names field objects');
  assert.match(app, /function placeName\(point\)\{const e=state\.encounter,u=visibleUnitAt\(e,point\);return \[u\?\.name,fieldLabel\(e,point\),u\?'':terrainLabel\(e,point\)\]\.filter\(Boolean\)\.join\('\. '\);\}/);
  assert.match(app, /announce\(`Grid \$\{focusTile\.x\+1\}\$\{String\.fromCharCode\(65\+focusTile\.y\)\}\. \$\{placeName\(focusTile\)\}/, 'The arrow-key cursor names them');
  assert.match(app, /:`\$\{placeName\(point\)\}\. \$\{why\?/, 'So does a click that cannot walk');
});

test('v0.32.1: in-game Help explains walking, the U key and the expanded campaign', async () => {
  const {createPanels} = await import('../src/ui/panels.js');
  let html = '';
  createPanels(() => ({showModal: (title, body) => {html = body;}})).showHelp();
  assert.match(html, /<strong>Walk\.<\/strong> Select open ground to walk there/);
  assert.match(html, /Enter selects a unit, walks to open ground, or previews a target and then confirms that same target/);
  assert.match(html, /U takes back a move until the unit acts/);
  assert.match(html, /Pause → Confirm moves makes walks preview first too/);
  assert.doesNotMatch(html, /choose reachable ground or an opponent to preview/, 'The pre-0.31 two-step move is gone');
  assert.match(html, /Expanded campaign.*bring your commander onto or beside it and press its button/s);
});

test('v0.32.1: this edition is 0.32.1', async () => {
  const {CONFIG} = await import('../src/config.js');
  assert.equal(CONFIG.version, '0.32.1');
});
