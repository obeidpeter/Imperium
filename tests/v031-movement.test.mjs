import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Game from '../src/core/game.js';
import {movementRoute,distanceToGoal} from '../src/core/movement.js';
import {movementPinned} from '../src/core/shared.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json', import.meta.url), 'utf8'));
const scene = id => Game.deserialize(JSON.stringify(fixture.scenes.find(s => s.id === id).state));
function drill() {
  const s = Game.newGame('Click to walk');
  Game.choose(s, Game.getChapter(s).decision.options[0].id);Game.startEncounter(s);
  return s;
}
const ground = (e, p) => {const t = e.terrain[p.y][p.x];return typeof t === 'string' ? t : t?.type;};
const stepCost = (e, unit, p) => ground(e, p) === 'marsh' && unit.formation !== 'line' ? 2 : 1;
// A route is a chain of orthogonal steps over open, unoccupied ground whose cost is the rules' cost.
function checkRoute(e, unit, path, end) {
  assert.deepEqual(path[0], {x: unit.x, y: unit.y});assert.deepEqual(path.at(-1), {x: end.x, y: end.y});
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const p = path[i], last = path[i - 1];
    assert.equal(Math.abs(p.x - last.x) + Math.abs(p.y - last.y), 1, 'orthogonal steps');
    assert.ok(!['rock', 'river'].includes(ground(e, p)), 'never through rock or river');
    assert.ok(!e.units.some(u => u.id !== unit.id && (u.resolve ?? u.hp) > 0 && u.x === p.x && u.y === p.y), 'never through another unit');
    if (i < path.length - 1) assert.ok(!movementPinned(e, unit, p), 'never walks on past a hostile melee frontage');
    cost += stepCost(e, unit, p);
  }
  return cost;
}

test('v0.31.0: one route for every legal move, at the rules’ own cost, in battles and the chamber', () => {
  for (const s of [drill(), scene('ch2-marsh'), scene('ch8-crossing'), scene('ch11-accounts')]) {
    const unit = s.encounter.units.find(u => u.id === 'hero'), legal = Game.getTargets(s, 'hero', 'move'), before = Game.serialize(s);
    assert.ok(legal.length > 2, `${s.encounter.id} has room to move`);
    for (const t of legal) {
      const route = movementRoute(s.encounter, unit, t);
      assert.equal(checkRoute(s.encounter, unit, route.path, t), t.cost, `${s.encounter.id}: route to ${t.x},${t.y} costs what the rules charge`);
      assert.equal(route.cost, t.cost);
      const plan = Game.moveRoute(s, 'hero', t);
      assert.equal(plan.reachable, true);assert.deepEqual(plan.stop, {x: t.x, y: t.y, cost: t.cost});assert.deepEqual(plan.path, route.path);assert.deepEqual(plan.beyond, []);
    }
    assert.equal(Game.serialize(s), before, 'Planning a route never changes the save or the random generator');
  }
});

test('v0.31.0: beyond reach, the walk stops on the legal tile that leaves the least way on', () => {
  for (const s of [drill(), scene('ch2-marsh'), scene('ch8-crossing'), scene('ch11-accounts')]) {
    const e = s.encounter, unit = e.units.find(u => u.id === 'hero'), legal = Game.getTargets(s, 'hero', 'move');
    const inReach = new Set(legal.map(t => `${t.x},${t.y}`));let planned = 0;
    for (let y = 0; y < e.height; y++) for (let x = 0; x < e.width; x++) {
      const goal = {x, y};
      if (inReach.has(`${x},${y}`) || x === unit.x && y === unit.y || e.units.some(u => !u.hidden && (u.resolve ?? u.hp) > 0 && u.x === x && u.y === y)) continue;
      const plan = Game.moveRoute(s, 'hero', goal), rest = distanceToGoal(e, unit, goal);
      assert.equal(plan.reachable, false);
      if (!plan.stop) {assert.ok(['blocked', 'no-closer', 'unreachable'].includes(plan.reason), plan.reason);continue;}
      planned++;
      assert.ok(inReach.has(`${plan.stop.x},${plan.stop.y}`), 'The stop is a tile the rules allow this turn');
      assert.ok(rest(plan.stop) < rest(unit), 'Every partial walk gets closer');
      assert.equal(rest(plan.stop), Math.min(...legal.map(t => rest(t))), 'No legal tile would leave less of the way');
      checkRoute(e, unit, plan.path, plan.stop);
      assert.deepEqual(plan.beyond.at(-1), goal, 'The rest of the way leads to the clicked ground');
      assert.ok(plan.beyond.every((p, i) => Math.abs(p.x - (plan.beyond[i - 1] ?? plan.stop).x) + Math.abs(p.y - (plan.beyond[i - 1] ?? plan.stop).y) === 1));
    }
    assert.ok(planned > 10, `${e.id}: far clicks plan partial walks (${planned})`);
  }
  // A clear, deterministic choice on the drill yard: toward the goal, not merely north.
  const s = drill();
  assert.deepEqual(Game.moveRoute(s, 'hero', {x: 7, y: 0}).stop, {x: 1, y: 2, cost: 2});
  assert.deepEqual(Game.moveRoute(s, 'hero', {x: 7, y: 0}), Game.moveRoute(s, 'hero', {x: 7, y: 0}));
});

test('v0.31.0: rock and river cannot be walked to, sealed ground says so, and spent movement is reported', () => {
  const s = drill(), e = s.encounter, hero = e.units.find(u => u.id === 'hero');
  e.terrain[0][7] = 'rock';
  assert.equal(Game.moveRoute(s, 'hero', {x: 7, y: 0}).reason, 'blocked');
  for (let y = 0; y < e.height; y++) e.terrain[y][5] = 'river';
  const sealed = Game.moveRoute(s, 'hero', {x: 7, y: 4});
  assert.equal(sealed.stop, null);assert.equal(sealed.reason, 'unreachable');
  assert.equal(Game.moveRoute(s, 'hero', {x: hero.x, y: hero.y}), null, 'The unit’s own tile is not a destination');
  assert.equal(Game.moveRoute(s, 'hero', {x: -1, y: 0}), null);assert.equal(Game.moveRoute(s, 'hero', {x: 1.5, y: 0}), null);
  const t = Game.getTargets(s, 'hero', 'move')[0];assert.ok(Game.act(s, {unitId: 'hero', action: 'move', x: t.x, y: t.y}).ok);
  const spent = Game.moveRoute(s, 'hero', {x: 0, y: 0});
  assert.equal(spent.stop, null);assert.equal(spent.reason, 'moved');
  s.phase = 'camp';assert.equal(Game.moveRoute(s, 'hero', {x: 0, y: 0}), null, 'No route outside an encounter');
});

test('v0.31.0: the rest of the way never bends around a hidden unit', () => {
  const s = drill(), e = s.encounter;
  const plain = Game.moveRoute(s, 'hero', {x: 7, y: 3});
  assert.ok(plain.beyond.length > 2);
  // A hidden enemy placed on that onward route must not change the plan the player sees.
  const onward = plain.beyond[Math.floor(plain.beyond.length / 2)];
  e.units.push({id: 'lurker', name: 'Hidden scout', side: 'enemy', role: 'infantry', x: onward.x, y: onward.y, hp: 8, maxHp: 8, hidden: true, moved: false, acted: false, move: 2, facing: 'west', morale: 80});
  assert.deepEqual(Game.moveRoute(s, 'hero', {x: 7, y: 3}), plain);
});

test('v0.31.0: the walk the animation plays is the route the preview drew', async () => {
  const {buildEncounterTimeline} = await import('../src/ui/animation-timeline.js');
  const {snapshotEncounter} = await import('../src/ui/motion.js');
  const {previewPath} = await import('../src/ui/battle-art.js');
  for (const id of ['ch2-marsh', 'ch8-crossing', 'ch11-accounts']) {
    const legal = Game.getTargets(scene(id), 'hero', 'move').sort((a, b) => b.cost - a.cost);
    for (const t of legal.slice(0, 6)) {
      const s = scene(id), hero = s.encounter.units.find(u => u.id === 'hero'), shown = Game.moveRoute(s, 'hero', t).path;
      assert.deepEqual(previewPath(s.encounter, hero, t), shown, 'The 2D dashed line is the same route');
      const before = snapshotEncounter(s.encounter), command = {unitId: 'hero', action: 'move', x: t.x, y: t.y};
      assert.ok(Game.act(s, command).ok);
      const timeline = buildEncounterTimeline(before, snapshotEncounter(s.encounter), {command});
      const walk = timeline.tracks.find(track => track.unitId === 'hero' && track.path);
      assert.deepEqual(walk.path, shown, `${id}: the hero walks the previewed route to ${t.x},${t.y}`);
    }
  }
});

// A 2D context that records fills, strokes and arcs.
function recordingContext() {
  const fills = [], strokes = [], arcs = [];
  const ctx = {strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: '', globalAlpha: 1, lineCap: '', lineJoin: '', shadowColor: '', shadowBlur: 0, globalCompositeOperation: 'source-over', filter: 'none',
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, arc() {arcs.push(1);}, ellipse() {}, rect() {}, clip() {}, translate() {}, scale() {}, rotate() {}, setTransform() {}, resetTransform() {},
    fill() {fills.push(String(this.fillStyle).toLowerCase());}, stroke() {strokes.push(String(this.strokeStyle).toLowerCase());}, fillRect() {}, strokeRect() {}, clearRect() {}, setLineDash() {}, quadraticCurveTo() {}, bezierCurveTo() {}, drawImage() {},
    fillText() {}, strokeText() {}, measureText(text) {return {width: String(text).length * 7};},
    createLinearGradient() {return {addColorStop() {}};}, createRadialGradient() {return {addColorStop() {}};}, createPattern() {return null;}, getImageData() {return {data: new Uint8ClampedArray(4)};}, putImageData() {}};
  return {ctx, fills, strokes, arcs};
}

test('v0.31.0: the board readout says what a click would do, in the field and in the chamber', async () => {
  const {directIntent, routeSummary} = await import('../src/ui/direct-controls.js');
  const s = drill();
  assert.equal(routeSummary(Game.moveRoute(s, 'hero', {x: 1, y: 3})), 'Walk here · 1 movement');
  assert.equal(routeSummary(Game.moveRoute(s, 'hero', {x: 7, y: 0})), 'Beyond reach · stops at 2C this turn');
  s.encounter.terrain[0][7] = 'rock';assert.equal(routeSummary(Game.moveRoute(s, 'hero', {x: 7, y: 0})), 'Impassable ground');
  assert.equal(routeSummary(null), '');
  // The chamber: a speaker walks the same way.
  const senate = scene('ch11-accounts'), before = Game.serialize(senate), e = senate.encounter;
  const legal = Game.getTargets(senate, 'hero', 'move');
  assert.equal(directIntent(senate, {point: legal[0]}).kind, 'move');
  const open = p => !e.units.some(u => !u.hidden && (u.resolve ?? u.hp) > 0 && u.x === p.x && u.y === p.y) && !legal.some(t => t.x === p.x && t.y === p.y);
  const far = Array.from({length: e.width * e.height}, (_, i) => ({x: i % e.width, y: Math.floor(i / e.width)})).find(p => open(p) && Game.moveRoute(senate, 'hero', p)?.stop);
  assert.ok(far, 'The chamber has ground beyond a speaker’s reach');
  const intent = directIntent(senate, {point: far});
  assert.equal(intent.kind, 'move');assert.deepEqual({x: intent.target.x, y: intent.target.y}, {x: Game.moveRoute(senate, 'hero', far).stop.x, y: Game.moveRoute(senate, 'hero', far).stop.y});
  assert.equal(Game.serialize(senate), before);
  // A companion is commanded with orders, never walked by a click.
  const legion = scene('ch7-legion'), ally = legion.encounter.units.find(u => u.side === 'ally' && (u.hp ?? 0) > 0);
  assert.ok(ally);assert.notEqual(directIntent(legion, {selected: ally.id, point: {x: ally.x + (ally.x < legion.encounter.width - 1 ? 1 : -1), y: ally.y}}).kind, 'move');
});

test('v0.31.0: the 2D board draws the route to the stop, the rest of the way, and the walkable ground', async () => {
  const {paintBattle, FIELD_COLORS} = await import('../src/ui/battle-art.js');
  const s = drill(), g = {ox: 480, oy: 120, tw: 64, th: 32}, route = Game.moveRoute(s, 'hero', {x: 7, y: 0}), reach = Game.getTargets(s, 'hero', 'move');
  const plain = recordingContext(), drawn = recordingContext();
  paintBattle(plain.ctx, 960, 600, g, s.encounter, 'hero', [], null, 1, {quality: 'performance'});
  paintBattle(drawn.ctx, 960, 600, g, s.encounter, 'hero', [], null, 1, {quality: 'performance', route, reach});
  const count = (list, value) => list.filter(v => v === value).length;
  assert.ok(count(drawn.strokes, FIELD_COLORS.selection) >= count(plain.strokes, FIELD_COLORS.selection) + 2, 'The walked line and the stop ring');
  assert.ok(count(drawn.strokes, '#f4ecd6a6') >= 1, 'The rest of the way is drawn faintly');
  assert.equal(count(drawn.fills, '#277c8217') - count(plain.fills, '#277c8217'), reach.length, 'Each walkable tile is washed once');
  const chosen = recordingContext();
  paintBattle(chosen.ctx, 960, 600, g, s.encounter, 'hero', [], null, 1, {quality: 'performance', action: 'strike', reach});
  assert.equal(count(chosen.fills, '#277c8217'), count(plain.fills, '#277c8217'), 'No walkable wash while another command is chosen');
  const blocked = recordingContext();
  paintBattle(blocked.ctx, 960, 600, g, s.encounter, 'hero', [], null, 1, {quality: 'performance', route: {...route, stop: null}});
  assert.equal(count(blocked.strokes, FIELD_COLORS.selection), count(plain.strokes, FIELD_COLORS.selection), 'Nothing is drawn when the click would not walk');
});

test('v0.31.0: in 3D the route and the walkable ground are inked on the ground, and only redrawn when they change', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createInkOverlay} = await import('../src/showcase/ink-overlay.js');
  const {BattleStage} = await import('../src/showcase/stage.js');
  const log = {arcs: 0, strokes: 0, dashes: 0};
  class FakeCanvas {
    constructor(width, height) {this.width = width;this.height = height;}
    getContext() {return new Proxy({arc() {log.arcs++;}, stroke() {log.strokes++;}, setLineDash(d) {if (d.length) log.dashes++;}}, {get: (target, key) => key in target ? target[key] : () => undefined, set: () => true});}
  }
  const previous = globalThis.OffscreenCanvas;globalThis.OffscreenCanvas = FakeCanvas;
  try {
    const s = drill(), ink = createInkOverlay(new T.Scene(), s.encounter, () => 0), route = Game.moveRoute(s, 'hero', {x: 7, y: 0}), reach = Game.getTargets(s, 'hero', 'move');
    assert.equal(ink.paint({reach}), true);assert.equal(ink.mesh.visible, true, 'Walkable ground alone shows the ink');
    const before = {...log};assert.equal(ink.paint({reach, route}), true);
    assert.ok(log.arcs - before.arcs >= route.path.length, 'Footfalls, the stop ring and the goal ring');assert.ok(log.dashes > before.dashes, 'The rest of the way is broken');
    assert.equal(ink.paint({reach, route: structuredClone(route)}), false, 'The same route is not repainted');
    assert.equal(ink.paint({reach, route: {...route, stop: null}}), true);assert.equal(ink.paint({targets: reach.slice(0, 1), reach}), true);
    assert.equal(ink.paint({}), true);assert.equal(ink.mesh.visible, false);
    ink.dispose();
  } finally {if (previous === undefined) delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas = previous;}
  const painted = [], stage = Object.create(BattleStage.prototype);
  Object.assign(stage, {ink: {paint(p) {painted.push(p);}}, targets: [], targetMaterial: new T.MeshBasicMaterial({color: '#89cfcb'}), inspected: null, hovered: null, encounter: drill().encounter});
  const route = {stop: {x: 1, y: 3, cost: 1}, path: [{x: 0, y: 3}, {x: 1, y: 3}], beyond: [], goal: {x: 1, y: 3}, reachable: true};
  stage.setRoute(route, [{x: 1, y: 3}]);
  assert.equal(painted.at(-1).route, route);assert.deepEqual(painted.at(-1).reach, [{x: 1, y: 3}]);
  stage.setRoute();assert.equal(painted.at(-1).route, null);assert.deepEqual(painted.at(-1).reach, []);
});

test('v0.31.0: the app walks through the rules API, previews routes on hover and keeps a Confirm moves setting', async () => {
  const app = await readFile(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  assert.match(app, /const intent=directIntent\(state,\{selected,action,target,point,moveOnClick:!settings\.confirmMoves\}\);/);
  assert.match(app, /if\(intent\.kind==='move'\)\{walk\(intent\);return;\}/);
  assert.match(app, /async function walk\(intent\)\{\n  action='move';target=intent\.target;/);
  assert.match(app, /await change\(\(\)=>\{const res=Game\.act\(state,c\);/, 'A walk is committed by the rules, like any command');
  assert.match(app, /Undo Move \(U\) takes it back until you act\./);
  assert.match(app, /battleRemains:true,confirmMoves:false,/, 'One click walks by default');
  assert.match(app, /if\(control\.id==='confirm-moves'\)\{settings\.confirmMoves=control\.checked;saveSettings\(\);render\(\);\}/, 'The board hint follows the setting at once');
  assert.match(app, /confirmMoves:Boolean\(settings\.confirmMoves\),/);
  // Ground no walk can reach says why (impassable, no nearer ground, movement spent) before the selection clears.
  assert.match(app, /const u=visibleUnitAt\(state\.encounter,point\),why=u\?'':routeSummary\(routeAt\(point\)\);\n  action=null;target=null;/);
  // A click reports whole pixels; the 2D pick uses the pressed pointer's exact position, as the hover did.
  assert.match(app, /board\.addEventListener\('pointerdown',event=>\{pressed=\{x:event\.clientX,y:event\.clientY\};\}\);/);
  assert.match(app, /const at=pressed&&Math\.abs\(pressed\.x-event\.clientX\)<1&&Math\.abs\(pressed\.y-event\.clientY\)<1\?pressed:\{x:event\.clientX,y:event\.clientY\};pressed=null;selectPoint\(pickBattlePoint\(board,state\.encounter,at\.x,at\.y\)\);/);
  assert.match(app, /route:animation\?null:routeAt\(hoverTile\),reach:animation\?\[\]:walkableReach\(\)/, '2D draws the route under the pointer, never during a motion');
  assert.match(app, /grid:showGrid,route:routeAt\(hoverTile\),reach:walkableReach\(\),/);
  assert.match(app, /if\(uses3D\(\)\)battleStage\.stage\?\.setRoute\?\.\(routeAt\(point\),walkableReach\(\)\);/, '3D re-inks the route as the pointer moves');
  assert.match(app, /if\(!point\|\|screen==='title'\|\|state\?\.encounter\?\.status!=='active'\|\|action&&action!=='move'\|\|visibleUnitAt\(state\.encounter,point\)\)return null;/);
  const controller = await readFile(new URL('../src/ui/battle-stage-controller.js', import.meta.url), 'utf8');
  assert.match(controller, /stage\.setSelection\(selected,targets,target\);stage\.setRoute\?\.\(latest\.route\?\?null,latest\.reach\?\?\[\]\);/);
  const panels = await readFile(new URL('../src/ui/panels.js', import.meta.url), 'utf8');
  assert.match(panels, /<input id="confirm-moves" type="checkbox" \$\{settings\.confirmMoves\?'checked':''\}>/);
});

test('v0.31.0: the board hint and its accessible name describe the move the click will make', async () => {
  const {encounterView} = await import('../src/ui/encounter-view.js');
  const s = drill(), view = confirmMoves => encounterView({state: s, selected: 'hero', confirmMoves, header: () => '', footer: () => '', requirements: () => ''});
  const walk = view(false), confirm = view(true), label = html => /<canvas id="battle-board"[^>]*aria-label="([^"]*)"/.exec(html)[1];
  assert.match(walk, /class="command-hint">[^<]*Select open ground to walk there\./);
  assert.match(label(walk), /Select open ground to walk there; Undo Move takes it back until you act\./);
  assert.doesNotMatch(label(walk), /Select the same target again/);
  assert.match(confirm, /class="command-hint">[^<]*Select open ground to preview a walk there, then select it again to go\./);
  assert.match(label(confirm), /Select a friendly unit, opponent or ground to preview\. Select the same target again to confirm\./);
});

test('v0.31.0: the configured edition matches the package', async () => {
  const {CONFIG} = await import('../src/config.js');
  assert.equal(CONFIG.version, JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
});
