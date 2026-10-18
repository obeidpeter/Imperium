import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';

const clone = x => JSON.parse(JSON.stringify(x));
const checkpoints = new Map();
let campaign = null;
function camp(id) {
  campaign ??= runProgressionCampaign({onCheckpoint: s => checkpoints.set(Game.getChapter(s).encounters[s.encounterIndex].id, clone(s))});
  return clone(checkpoints.get(id));
}
function started(id) {
  const s = camp(id);
  assert.ok(Game.startEncounter(s).ok);
  return s;
}
// Undo is complete when only the action log remembers the step back.
const withoutLog = s => JSON.stringify({...s, encounter: {...s.encounter, log: []}, log: []});

test('v0.29.0: the Chapter XII approach is chosen through the rules API and validated against the forecast', () => {
  const s = camp('ch12-confrontation'), saved = Game.serialize(s);
  assert.equal(Game.chooseRoute(s, 'invented').ok, false);
  assert.equal(Game.serialize(s), saved, 'A rejected route leaves the campaign unchanged');
  const locked = Game.finaleForecast(s).routes.map(r => r.id), unavailable = ['defection', 'settlement', 'surrender'].find(id => !locked.includes(id));
  if (unavailable) assert.equal(Game.chooseRoute(s, unavailable).ok, false, 'A route the standing has not opened cannot be selected');
  assert.ok(Game.chooseRoute(s, 'battle').ok);
  assert.equal(s.route, 'battle');
  assert.ok(Game.startEncounter(s).ok);
  assert.equal(s.encounter.route, 'battle', 'The chosen route reaches the confrontation');
  const early = camp('ch12-legitimacy');
  assert.equal(Game.chooseRoute(early, 'battle').ok, false, 'The route is chosen only before the final field encounter');
  const field = started('ch1-road');
  assert.equal(Game.chooseRoute(field, 'battle').ok, false);
});

test('v0.29.0: Undo Move restores the whole encounter state, including the ability credit the move added', () => {
  const s = started('ch1-training'), before = withoutLog(s), rng = s.rng;
  const move = Game.legalCommands(s).find(c => c.unitId === 'hero' && c.action === 'move');
  assert.ok(Game.act(s, move).ok);
  assert.ok(s.encounter.usedAbilities.includes('move'));
  assert.ok(Game.undoMove(s).ok);
  assert.equal(withoutLog(s), before, 'Position, facing, intents, objective text and capability records match the pre-move state');
  assert.equal(s.rng, rng);
  // Moving again and acting keeps the credit: the demonstrated move is now real.
  assert.ok(Game.act(s, move).ok);
  const strike = Game.legalCommands(s).find(c => c.unitId === 'hero' && c.action === 'brace');
  assert.ok(Game.act(s, strike).ok);
  assert.ok(s.encounter.usedAbilities.includes('move'));
  assert.equal(Game.canUndoMove(s).available, false);
});

test('v0.29.0: undoing two outstanding speaker moves in either order restores the original credit', () => {
  for (const order of [['hero', 'speaker-ally'], ['speaker-ally', 'hero']]) {
    const s = started('ch7-council'), before = withoutLog(s);
    for (const unitId of ['hero', 'speaker-ally']) {
      const move = Game.legalCommands(s).find(c => c.unitId === unitId && c.action === 'move');
      assert.ok(Game.act(s, move).ok, `${unitId} moves`);
    }
    assert.ok(Game.undoMove(s, order[0]).ok);
    assert.ok(s.encounter.usedAbilities.includes('move'), 'The remaining move still carries the credit');
    assert.ok(Game.undoMove(s, order[1]).ok);
    assert.equal(withoutLog(s), before, `Undo order ${order.join(' then ')} leaves no move credit behind`);
  }
});

test('v0.29.0: an Archive replay cannot be restored as if it were the chronicle', async () => {
  // The legal default route (no progression) is the case whose sandbox validates as a save.
  const {readFile} = await import('node:fs/promises'), fixture = JSON.parse(await readFile(new URL('./fixtures/chapter-12-legal-checkpoint.json', import.meta.url), 'utf8'));
  const s = Game.deserialize(JSON.stringify(fixture.state ?? fixture)), entry = Game.archiveEncounters(s)[0], replay = Game.createArchiveReplay(s, entry.id);
  assert.ok(replay.ok);
  assert.throws(() => Game.deserialize(Game.serialize(replay.state)), /Archive replay, not a chronicle/);
  assert.doesNotThrow(() => Game.deserialize(Game.serialize(s)), 'The chronicle itself still round-trips');
});

test('v0.29.0: the real app saves routes through the rules API and a hidden tab writes only unsaved changes', async t => {
  // Inert DOM integration harness (as in campaign-upgrade-ui): the actual app
  // module and storage run; there is no browser layout, canvas or audio device.
  const {CONFIG} = await import('../src/config.js');
  const originals = new Map(), set = (key, value) => { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, {value, writable: true, configurable: true}); };
  const callbacks = new Map(), values = new Map(), writes = [], nodes = new Map();
  const node = (id = '') => ({id, innerHTML: '', textContent: '', hidden: false, open: false, dataset: {}, style: {setProperty() {}}, isConnected: true, querySelectorAll: () => [], querySelector: selector => nodes.get(selector) ?? null, setAttribute() {}, removeAttribute() {}, focus() {}, scrollIntoView() {}, addEventListener() {}, prepend() {}, after() {}, close() { this.open = false; }, showModal() { this.open = true; }});
  for (const id of ['#app', '#modal', '#announcement', '.system-feedback', '.save-status', '.modal-feedback', '#panel-title', '#action-feedback']) nodes.set(id, node(id));
  const doc = {hidden: false, activeElement: null, documentElement: node(), addEventListener(name, fn) { if (!callbacks.has(name)) callbacks.set(name, []); callbacks.get(name).push(fn); }, removeEventListener() {}, querySelector: selector => nodes.get(selector) ?? null, querySelectorAll: () => [], getElementById: () => null, createElement: () => node()};
  set('document', doc); set('window', {addEventListener() {}, scrollTo() {}}); set('navigator', {connection: {saveData: true}, locks: {request: async (name, fn) => fn()}}); set('matchMedia', () => ({matches: true}));
  set('requestAnimationFrame', () => 1); set('cancelAnimationFrame', () => {});
  set('localStorage', {getItem: k => values.get(k) ?? null, setItem(k, v) { values.set(k, v); writes.push(k); }, removeItem: k => values.delete(k)}); set('BroadcastChannel', class { postMessage() {} close() {} });
  const nativeTimeout = globalThis.setTimeout; set('setTimeout', (fn, delay, ...args) => delay === 6500 ? 0 : nativeTimeout(fn, delay, ...args));
  t.after(() => { for (const [key, descriptor] of originals) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]; });
  const storage = await import('../src/ui/storage.js?v029-app'), start = camp('ch12-confrontation');
  await storage.saveLocal(start, {replace: true});
  await import('../src/ui/app.js?v029-app');
  const saved = () => Game.deserialize(JSON.parse(values.get(CONFIG.saveKey)).payload), campaignWrites = () => writes.filter(k => k === CONFIG.saveKey).length;
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => nativeTimeout(resolve, 0)); };
  const click = async (cmd, id) => { const button = {dataset: {cmd, id}, disabled: false}; for (const fn of callbacks.get('click') ?? []) await fn({target: {closest: () => button}}); await settle(); };
  const hide = async () => { doc.hidden = true; for (const fn of callbacks.get('visibilitychange') ?? []) fn(); await settle(); doc.hidden = false; };
  await click('continue');
  let count = campaignWrites();
  await hide();
  assert.equal(campaignWrites(), count, 'Hiding an unchanged chronicle does not write or broadcast a new revision');
  await click('route', 'invented');
  assert.equal(campaignWrites(), count, 'An invalid approach is rejected by the rules API before storage');
  assert.equal(saved().route, start.route);
  await click('route', 'battle');
  assert.equal(saved().route, 'battle');
  count = campaignWrites();
  await hide();
  assert.equal(campaignWrites(), count, 'The route was already saved; hiding writes nothing new');
});

test('v0.29.0: every chapter carries a bounded colour-script grade and light balance; night and court override them', async () => {
  const {getSceneProfile, sceneGrade} = await import('../src/showcase/campaign-scene-profile.js');
  const seen = new Set();
  for (let chapter = 1; chapter <= 12; chapter++) {
    const profile = getSceneProfile({id: `ch${chapter}-x`, kind: 'battle', units: []}, {chapter}), g = profile.grade;
    assert.ok(Object.isFrozen(g));
    assert.ok(g.saturation >= .8 && g.saturation <= 1.2 && g.contrast >= 1 && g.contrast <= 1.2, `chapter ${chapter} grade stays restrained`);
    for (const tint of [g.shadow, g.highlight]) assert.ok(tint.length === 3 && tint.every(v => v >= .8 && v <= 1.2));
    assert.ok(g.ambient > .6 && g.ambient <= 1 && g.sun >= .9 && g.sun <= 1.2 && /^#[0-9a-f]{6}$/i.test(g.haze) && /^#[0-9a-f]{6}$/i.test(g.rim));
    seen.add(JSON.stringify(g));
  }
  assert.equal(seen.size, 12, 'Each chapter has its own grade');
  assert.notDeepEqual(getSceneProfile({id: 'ch4-gate', kind: 'battle', units: []}, {chapter: 4, stratagem: 'night'}).grade, sceneGrade(4));
  assert.deepEqual(getSceneProfile({id: 'ch11-accounts', kind: 'contest', units: []}, {chapter: 11}).grade, sceneGrade(11, {court: true}));
});

test('v0.29.0: the compositor applies a chapter grade with clamped values and keeps the neutral default', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createSceneCompositor, DEFAULT_GRADE} = await import('../src/showcase/scene-compositor.js');
  let quad = null;
  const renderer = {extensions: {has: () => true}, capabilities: {maxTextureSize: 4096}, info: {autoReset: true, reset() {}}, getDrawingBufferSize: v => v.set(640, 360), getRenderTarget: () => null, setRenderTarget() {}, render(object) { if (!object.isScene) quad = object; }};
  const compositor = createSceneCompositor(renderer, new T.PerspectiveCamera(), {quality: 'balanced'});
  compositor.render(new T.Scene());
  const u = quad.material.uniforms;
  assert.equal(u.gradeSaturation.value, DEFAULT_GRADE.saturation);
  compositor.setGrade({saturation: 9, contrast: .1, shadow: [0.9, 1, 1.1], highlight: [1.1, 1, 0.9]});
  assert.equal(u.gradeSaturation.value, 2);
  assert.equal(u.gradeContrast.value, .5);
  assert.deepEqual(u.gradeShadow.value.toArray(), [0.9, 1, 1.1]);
  compositor.setGrade({shadow: [NaN, 1, 1]});
  assert.deepEqual(u.gradeShadow.value.toArray(), [0.9, 1, 1.1], 'Malformed tints are ignored');
  compositor.setHaze({near: 30, far: 20, color: '#ffffff'});
  assert.deepEqual(u.hazeRange.value.toArray(), [30, 31], 'The haze range never inverts');
  assert.equal(compositor.stats().multisamples, 4, 'Balanced renders into a multisampled target');
  compositor.dispose();
});

test('v0.29.0: high ground is a readable plateau whose bank stays inside its cell, rivers sit in a channel and roads never climb a bank', async () => {
  const {createGroundHeight, gridToWorld, terrainAt, HIGH_GROUND_HEIGHT, RIVER_WATER_LEVEL, RIVER_BED, FORD_BED} = await import('../src/showcase/environment-layout.js');
  const grid = rows => ({width: rows[0].length, height: rows.length, terrain: rows.map(row => [...row].map(t => ({'.': 'grass', '^': 'high', '~': 'river', 'f': 'ford', '=': 'road'}[t])))});
  const e = grid(['........', '.^^.....', '........', '====....', '...^....', '.~~f~~..', '........', '........']), height = createGroundHeight(e), level = createGroundHeight(e, 2.5, {relief: false});
  const at = (x, y) => gridToWorld({x, y}, e);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const p = at(x, y), type = terrainAt(e, x, y), h = height(p.x, p.z);
    assert.ok(Math.abs(h - ({high: HIGH_GROUND_HEIGHT, river: RIVER_BED, ford: FORD_BED}[type] ?? 0)) < 1e-9, `${x},${y} ${type}`);
  }
  const a = at(1, 1), b = at(2, 1);
  for (let t = 0; t <= 1; t += .05) assert.ok(Math.abs(height(a.x + (b.x - a.x) * t, a.z) - HIGH_GROUND_HEIGHT) < 1e-9, 'Adjoining high cells form one plateau without a dip');
  const lone = at(3, 4);
  assert.ok(height(lone.x, lone.z - 1.25) > .3 && height(lone.x, lone.z - 1.25) < HIGH_GROUND_HEIGHT, 'The bank is still falling at the cell edge');
  assert.ok(Math.abs(height(lone.x, lone.z - 1.56)) < 1e-9, 'The bank ends 0.3 m into the neighbouring cell');
  assert.ok(RIVER_BED < FORD_BED && FORD_BED < RIVER_WATER_LEVEL && RIVER_WATER_LEVEL < 0, 'Fords are shallower than the channel and both lie under the water level');
  for (let x = -10; x <= 10; x += .25) for (let z = -10; z <= 10; z += .25) assert.ok(level(x, z) <= height(x, z) + 1e-9, 'The relief-free surface never rises above the real ground');
});

test('v0.29.0: the diorama board has one river channel surface, cell-edge walls, kerbed roads and a denser ground over the board', async () => {
  const THREE = await import('../vendor/three/three.module.js');
  const {readFile} = await import('node:fs/promises');
  const {createEnvironment, gridToWorld} = await import('../src/showcase/environment.js');
  const {createGroundHeight, terrainAt, RIVER_WATER_LEVEL} = await import('../src/showcase/environment-layout.js');
  const {wallFace, wallStyle} = await import('../src/showcase/environment-campaign-terrain.js');
  const fixture = JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json', import.meta.url), 'utf8'));
  const build = (id, quality = 'balanced') => {const s = fixture.scenes.find(s => s.id === id); return {s, world: createEnvironment(new THREE.Scene(), s.state.encounter, {chapter: s.chapter, quality, loadTextures: false})};};
  {
    const {s, world} = build('ch8-ferry'), water = world.group.getObjectByName('authored river channel water'), e = s.state.encounter;
    assert.ok(water && !water.isInstancedMesh, 'Every river and ford cell shares one water surface');
    const pos = water.geometry.attributes.position, color = water.geometry.attributes.color;
    for (let i = 0; i < pos.count; i += 7) {
      assert.ok(Math.abs(pos.getY(i) - RIVER_WATER_LEVEL) < 1e-6, 'One flat water level');
      const ground = world.groundHeight(pos.getX(i), pos.getZ(i));
      if (Math.abs(ground - RIVER_WATER_LEVEL) > 1e-3) assert.equal(color.getW(i) === 0, ground > RIVER_WATER_LEVEL, 'Water is clear exactly where the ground rises above it');
    }
    let deep = 0;for (let i = 0; i < color.count; i++) if (color.getW(i) > .95) deep++;
    assert.ok(deep > 50, 'The channel has deep, opaque water');
    water.geometry.computeBoundingBox();
    if ([0, e.height - 1].some(y => [...Array(e.width).keys()].some(x => terrainAt(e, x, y) === 'river'))) assert.ok(water.geometry.boundingBox.max.z - water.geometry.boundingBox.min.z > e.height * 2.5 + 20, 'A river leaving the board keeps flowing beyond it');
    world.dispose();
  }
  {
    const e = {width: 3, height: 4, terrain: [['wall', 'grass', 'grass'], ['wall', 'grass', 'grass'], ['grass', 'wall', 'wall'], ['grass', 'grass', 'grass']]};
    assert.equal(wallFace(e, 0, 0), 'east');assert.equal(wallFace(e, 0, 1), 'east');assert.equal(wallFace(e, 1, 2), 'north');assert.equal(wallFace(e, 2, 2), 'north');
    assert.equal(wallStyle({setting: 'fortress'}), 'stone');assert.equal(wallStyle({setting: 'siege'}), 'mudbrick');assert.equal(wallStyle({setting: 'frontier'}), 'timber');
  }
  {
    const {s, world} = build('ch1-road'), e = s.state.encounter, level = createGroundHeight(e, 2.5, {profile: world.profile, relief: false});
    assert.ok(world.group.getObjectByName('road kerb stones')?.isInstancedMesh, 'Roads are edged with kerb stones');
    const road = world.group.getObjectByName('authored boundary road').geometry.attributes.position;
    for (let i = 0; i < road.count; i++) assert.ok(road.getY(i) <= level(road.getX(i), road.getZ(i)) + .021 + 1e-6, 'The road surface passes under a plateau bank instead of climbing it');
    const ground = world.ground.geometry.attributes.position;let inner = 0;
    for (let i = 0; i < ground.count; i++) if (Math.max(Math.abs(ground.getX(i)), Math.abs(ground.getZ(i))) <= 10) inner++;
    assert.ok(inner > ground.count * (20 / 80) ** 2 * 2.4, 'The board holds well over twice its even share of ground vertices');
    for (let y = 0; y < e.height; y++) for (let x = 0; x < e.width; x++) {const p = gridToWorld({x, y}, e);assert.ok(Number.isFinite(world.groundHeight(p.x, p.z)));}
    world.dispose();
  }
});

test('v0.29.0: repeated static parts fold into a matching named instance batch without moving a vertex', async () => {
  const THREE = await import('../vendor/three/three.module.js');
  const {batchStaticEnvironment} = await import('../src/showcase/environment-batching.js');
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), other = new THREE.MeshStandardMaterial();
  root.position.set(3, 0, -2);
  const named = new THREE.InstancedMesh(geometry, material, 2);named.name = 'road kerb stones';named.castShadow = named.receiveShadow = true;
  const matrix = new THREE.Matrix4();named.setMatrixAt(0, matrix.makeTranslation(1, 0, 0));named.setMatrixAt(1, matrix.makeTranslation(-1, 0, 0));
  named.setColorAt(0, new THREE.Color(.5, .6, .7));named.setColorAt(1, new THREE.Color(.2, .3, .4));root.add(named);
  const parts = [];for (let i = 0; i < 3; i++) {const mesh = new THREE.Mesh(geometry, material);mesh.position.set(i * 2, 1, 4);mesh.rotation.y = i * .3;mesh.castShadow = mesh.receiveShadow = true;root.add(mesh);parts.push(mesh);}
  const unrelated = [];for (let i = 0; i < 3; i++) {const mesh = new THREE.Mesh(geometry, other);mesh.position.x = -5 - i;mesh.castShadow = mesh.receiveShadow = true;root.add(mesh);unrelated.push(mesh);}
  root.updateMatrixWorld(true);
  const world = parts.map(p => p.matrixWorld.clone()), stats = batchStaticEnvironment(root, {geometries: new Set()});
  const folded = root.getObjectByName('road kerb stones');
  assert.equal(stats.foldedSources, 3);assert.equal(folded.count, 5);assert.notEqual(folded, named);
  assert.deepEqual(folded.userData.foldedNames ?? [], []);
  folded.updateMatrixWorld(true);
  for (let i = 0; i < 3; i++) {folded.getMatrixAt(2 + i, matrix);matrix.premultiply(folded.matrixWorld);assert.ok(matrix.elements.every((v, k) => Math.abs(v - world[i].elements[k]) < 1e-5), 'Folded parts keep their world transform (float32 instance matrices)');}
  const color = new THREE.Color();folded.getColorAt(0, color);assert.deepEqual(color.toArray().map(v => Math.round(v * 10) / 10), [.5, .6, .7]);folded.getColorAt(3, color);assert.deepEqual(color.toArray(), [1, 1, 1], 'Folded parts are untinted');
  assert.equal(root.children.filter(o => o.isInstancedMesh).length, 2, 'Only parts with another material form their own batch');
  for (const p of [...parts, ...unrelated]) assert.equal(p.parent, null);
});

test('v0.29.0: the painted regional backdrop wraps seamlessly, picks a regional landmark and is never terrain', async () => {
  const THREE = await import('../vendor/three/three.module.js');
  const {ridgeProfile, backdropLandmark, createPaintedBackdrop, paintBackdrop, BACKDROP_RADIUS} = await import('../src/showcase/environment-backdrop.js');
  for (const options of [{seed: 3}, {seed: 11, sharp: true, amplitude: .26, base: .3}]) {
    assert.ok(Math.abs(ridgeProfile(0, options) - ridgeProfile(1, options)) < 1e-9, 'The panorama has no seam where it wraps');
    for (let u = 0; u <= 1; u += .01) {const y = ridgeProfile(u, options), base = options.base ?? .5, amplitude = options.amplitude ?? .18;assert.ok(y >= base - amplitude - 1e-9 && y <= base + amplitude + 1e-9);}
  }
  assert.equal(backdropLandmark({setting: 'rome'}), 'city');assert.equal(backdropLandmark({setting: 'palmyra'}), 'palmyra');assert.equal(backdropLandmark({setting: 'italy'}), 'alps');assert.equal(backdropLandmark({setting: 'unknown'}), 'hills');
  const none = createPaintedBackdrop({setting: 'frontier', chapter: 1});
  assert.equal(none.stats.painted, false, 'Without a canvas no panorama is built');assert.equal(none.group.children.length, 0);none.dispose();
  // A recording 2D context stands in for a browser canvas.
  const calls = [], gradient = {addColorStop() {}};
  class FakeCanvas {constructor(width, height) {this.width = width;this.height = height;}getContext() {return new Proxy({createLinearGradient: () => gradient}, {get: (target, key) => key in target ? target[key] : (...args) => {calls.push(args);}, set: () => true});}}
  const previous = globalThis.OffscreenCanvas;globalThis.OffscreenCanvas = FakeCanvas;
  try {
    for (const setting of ['frontier', 'rome', 'palmyra', 'siege', 'italy', 'wetland']) {
      calls.length = 0;
      const canvas = paintBackdrop({setting, chapter: 4, fog: '#b8c6c2', groundTint: '#859271', stoneColor: '#bab9ad'}, {quality: 'performance'});
      assert.deepEqual([canvas.width, canvas.height], [1024, 192]);
      assert.ok(calls.length > 100 && calls.every(args => args.every(v => typeof v !== 'number' || Number.isFinite(v))), `${setting} paints finite strokes`);
    }
    const civic = createPaintedBackdrop({setting: 'rome', civic: true, chapter: 11});assert.equal(civic.stats.painted, false, 'Enclosed chambers have no panorama');
    const backdrop = createPaintedBackdrop({setting: 'italy', chapter: 10}, {quality: 'balanced'}), mesh = backdrop.group.children[0];
    assert.equal(backdrop.stats.landmark, 'alps');assert.equal(mesh.geometry.parameters.radiusTop, BACKDROP_RADIUS);
    assert.equal(mesh.material.side, THREE.BackSide);assert.equal(mesh.material.fog, false);assert.equal(mesh.material.depthWrite, false);assert.equal(mesh.castShadow, false);
    assert.ok(BACKDROP_RADIUS > 550 && BACKDROP_RADIUS < 700, 'It stands beyond the outer ridges and inside the sky');
    let disposed = 0;mesh.geometry.addEventListener('dispose', () => disposed++);backdrop.dispose();assert.equal(disposed, 1);
  } finally {if (previous === undefined) delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas = previous;}
});

test('v0.29.0: water keeps a dim sun sheen with glitter and caps its reflected highlight; open water foams faintly', async () => {
  const THREE = await import('../vendor/three/three.module.js');
  const {createEnvironmentMaterials} = await import('../src/showcase/environment-materials.js');
  const lib = createEnvironmentMaterials({loadTextures: false, profile: {setting: 'crossing', chapter: 8, waterColor: '#608f94', stoneColor: '#bab9ad'}});
  for (const [name, foam] of [['water', '.14'], ['riverWater', '.0']]) {
    const material = lib.materials[name], shader = {uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader};
    material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader, /envGlitter/);assert.match(shader.fragmentShader, /reflectedLight\.indirectSpecular=min\(/);
    assert.ok(shader.fragmentShader.includes(`*${foam};`), `${name} foam scale`);
    assert.ok(material.metalness < .1, 'Water is a dielectric');
  }
  assert.equal(lib.materials.riverWater.vertexColors, true, 'Channel depth travels in vertex alpha');
  lib.dispose();
});
