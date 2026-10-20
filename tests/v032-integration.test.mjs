import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {movementRoute} from '../src/core/movement.js';
import {clone} from '../src/core/shared.js';
import {fieldBlocked,fieldMoveCost} from '../src/core/field-geometry.js';
import {routeSummary} from '../src/ui/direct-controls.js';

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
  assert.equal(shut.stop, null);assert.equal(shut.reason, 'gate');assert.equal(routeSummary(shut), 'Closed gate');
  assert.ok(Game.fieldAction(s, gate.id).ok, 'Opening the gate is a legal field action');
  const open = Game.moveRoute(s, 'hero', gate);
  assert.equal(open.reachable, true);assert.deepEqual(open.path, [{x: gate.x - 1, y: gate.y}, {x: gate.x, y: gate.y}]);
});

test('v0.32.0: this edition is 0.32.0', async () => {
  const {CONFIG} = await import('../src/config.js');
  assert.equal(CONFIG.version, '0.32.0');
});
