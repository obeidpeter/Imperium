import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {bootApp} from './inert-app.mjs';

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

test('v0.29.0: the configured edition matches the package', async () => {
  const {CONFIG} = await import('../src/config.js'), {readFile} = await import('node:fs/promises');
  assert.equal(CONFIG.version, JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
});

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
  const {CONFIG} = await import('../src/config.js'), start = camp('ch12-confrontation');
  const app = await bootApp(t, {name: 'v029-app', save: start});
  const campaignWrites = () => app.storage.keys.filter(k => k === CONFIG.saveKey).length;
  await app.click('continue');
  let count = campaignWrites();
  await app.hide();
  assert.equal(campaignWrites(), count, 'Hiding an unchanged chronicle does not write or broadcast a new revision');
  await app.command('route', 'invented');
  assert.equal(campaignWrites(), count, 'An invalid approach is rejected by the rules API before storage');
  assert.equal(app.saved().route, start.route);
  await app.click('route', 'battle');
  assert.equal(app.saved().route, 'battle');
  count = campaignWrites();
  await app.hide();
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
    assert.ok(world.group.getObjectByName('squared stone masonry')?.count > 60, 'Roads are edged with kerb stones (batched with other squared stone)');
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

// A recording 2D canvas: enough for the painted-figure card in Node.
function installFakeCanvas({alpha = 255} = {}) {
  const log = {draws: 0, clears: 0};
  class FakeCanvas {
    constructor(width, height) {this.width = width;this.height = height;}
    getContext() {
      const gradient = {addColorStop() {}};
      return new Proxy({createLinearGradient: () => gradient, getImageData: () => ({data: [0, 0, 0, alpha]}), clearRect: () => {log.clears++;}}, {get: (target, key) => key in target ? target[key] : (...args) => {log.draws++;return undefined;}, set: () => true});
    }
  }
  const previous = globalThis.OffscreenCanvas;globalThis.OffscreenCanvas = FakeCanvas;
  return {log, restore() {if (previous === undefined) delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas = previous;}};
}

test('v0.29.0: painted figures pick the authored facing seen from the camera, as the 2D board does', async () => {
  const {paintedColumn, paintedLight, facingDirection} = await import('../src/showcase/painted-actor.js');
  const iso = {x: 1, z: 1}; // the 2D board's own view: grid east runs right and toward the viewer
  assert.deepEqual(['east', 'south', 'west', 'north'].map(f => paintedColumn(facingDirection(f), iso)), ['east', 'south', 'west', 'north']);
  const turned = {x: -1, z: 1}; // a quarter turn of the camera rotates every column
  assert.deepEqual(['east', 'south', 'west', 'north'].map(f => paintedColumn(facingDirection(f), turned)), ['north', 'east', 'south', 'west']);
  const day = paintedLight({sun: '#ffe4b4', ambient: '#a1b1a7', timeOfDay: 'day'}), night = paintedLight({sun: '#9eb8dc', ambient: '#4d6282', timeOfDay: 'night'});
  assert.ok(day.every(v => v > .9 && v <= 1.2), 'Daylight barely tints the painting');
  assert.ok(night.every((v, i) => v < day[i]) && night[2] > night[0], 'Night darkens and cools it');
});

test('v0.29.0: a painted figure card faces the camera, casts its silhouette toward the sun and is picked only on paint', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createPaintedActor} = await import('../src/showcase/painted-actor.js');
  const solid = installFakeCanvas({alpha: 255});
  try {
    const unit = {id: 'hero', side: 'player', role: 'soldier', x: 3, y: 3, hp: 10, maxHp: 10, facing: 'east'}, before = JSON.stringify(unit);
    const actor = createPaintedActor(unit, {chapter: 1});
    assert.ok(actor?.painted, 'A painted card is built when a 2D canvas exists');
    const [card, shadow] = actor.group.children;
    assert.equal(card.castShadow, false);assert.equal(shadow.castShadow, true);
    assert.equal(shadow.material.colorWrite, false);assert.equal(shadow.material.depthWrite, false);
    assert.equal(shadow.material.map, card.material.map, 'The shadow pass cuts the same painted silhouette');
    assert.equal(shadow.material.shadowSide, T.DoubleSide);assert.ok(shadow.material.alphaTest > 0);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(40, 1.5, .1, 100);scene.add(actor.group);
    actor.group.position.set(2, 0, -1);camera.position.set(12, 10, 14);camera.lookAt(2, 1, -1);camera.updateMatrixWorld();
    actor.update({direction: Math.PI / 2, unit, override: null});actor.faceCamera(camera, {sunYaw: .7});
    card.updateWorldMatrix(true, false);
    const worldCard = card.getWorldQuaternion(new T.Quaternion()), worldCamera = camera.getWorldQuaternion(new T.Quaternion());
    assert.ok(Math.abs(Math.abs(worldCard.dot(worldCamera)) - 1) < 1e-6, 'The card is parallel to the view');
    const shadowYaw = new T.Euler().setFromQuaternion(shadow.getWorldQuaternion(new T.Quaternion()), 'YXZ').y;
    assert.ok(Math.abs(Math.atan2(Math.sin(shadowYaw - .7), Math.cos(shadowYaw - .7))) < 1e-6, 'The shadow card turns to the sun');
    const repaints = solid.log.clears;actor.faceCamera(camera, {sunYaw: .7});
    assert.equal(solid.log.clears, repaints, 'An unchanged view does not repaint the card');
    actor.update({direction: -Math.PI / 2, unit, override: null});actor.faceCamera(camera, {sunYaw: .7});
    assert.ok(solid.log.clears > repaints, 'Turning to another painted facing repaints it');
    const ray = new T.Raycaster(), hits = [];ray.setFromCamera(new T.Vector2(0, 0), camera);
    const aimed = new T.Raycaster(camera.position.clone(), actor.group.position.clone().add(new T.Vector3(0, 1, 0)).sub(camera.position).normalize());
    actor.group.updateMatrixWorld(true);aimed.intersectObject(actor.group, true, hits);
    assert.ok(hits.length > 0 && hits.every(hit => hit.object === card), 'Only the painted card is pickable');
    assert.ok(Number.isFinite(actor.getReleasePoint(new T.Vector3()).length()));
    assert.equal(JSON.stringify(unit), before, 'Painting never edits the unit');
    let disposed = 0;card.geometry.addEventListener('dispose', () => disposed++);actor.dispose();actor.dispose();assert.equal(disposed, 1);
  } finally {solid.restore();}
  const clear = installFakeCanvas({alpha: 0});
  try {
    const actor = createPaintedActor({id: 'e', side: 'enemy', role: 'soldier', facing: 'west'}, {chapter: 2}), camera = new T.PerspectiveCamera(40, 1, .1, 100);
    camera.position.set(0, 4, 10);camera.lookAt(0, 1, 0);camera.updateMatrixWorld();actor.faceCamera(camera);actor.group.updateMatrixWorld(true);
    const hits = new T.Raycaster(camera.position.clone(), new T.Vector3(0, 1, 0).sub(camera.position).normalize()).intersectObject(actor.group, true);
    assert.equal(hits.length, 0, 'A transparent part of the card is not the figure');actor.dispose();
  } finally {clear.restore();}
  const {createPaintedActor: again} = await import('../src/showcase/painted-actor.js');
  assert.equal(again({id: 'x'}), null, 'Without a canvas no painted card is created (the stage keeps sculpted figures)');
});

test('v0.29.0: switching figure style swaps only the presentation and sets the matching scene finish', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {BattleStage, FIGURE_STYLES, figureStyleFinish, diagonalYaw} = await import('../src/showcase/stage.js');
  const {FIGURE_STYLES: shared} = await import('../src/ui/graphics-quality.js');
  assert.equal(FIGURE_STYLES, shared, 'The UI and the stage share one list');
  assert.deepEqual(figureStyleFinish('painted'), {tiltShift: 1, ink: 0});assert.deepEqual(figureStyleFinish('inked'), {tiltShift: 0, ink: 1});assert.deepEqual(figureStyleFinish('sculpted'), {tiltShift: 0, ink: 0});
  for (const [yaw, expected] of [[-.55, -Math.PI / 4], [.2, Math.PI / 4], [2, 3 * Math.PI / 4], [-2.6, -3 * Math.PI / 4]]) assert.ok(Math.abs(diagonalYaw(yaw) - expected) < 1e-12);
  const encounter = {id: 'ch1-road', kind: 'battle', units: [{id: 'hero', x: 1, y: 1}]}, frozen = JSON.stringify(encounter), styles = [], synced = [];let disposed = 0;
  const stage = Object.create(BattleStage.prototype);
  Object.assign(stage, {figureStyle: 'sculpted', disposed: false, encounter, scene: new T.Scene(), actors: new Map([['hero', {group: new T.Group(), dispose() {disposed++;}}]]), compositor: {setStyle(s) {styles.push(s);}}, sync(e) {synced.push(e);}});
  stage.setFigureStyle('painted');
  // Since 0.35.1 the figures stay until sync replaces each one, whose style key includes the style.
  assert.equal(stage.figureStyle, 'painted');assert.equal(disposed, 0);assert.equal(stage.actors.size, 1);assert.deepEqual(styles, [{tiltShift: 1, ink: 0}]);assert.equal(synced[0], encounter);
  // Sync replaces a figure exactly when its key (allegiance, role, name, standing, quality, style) changes.
  const {figureStyleKey} = await import('../src/showcase/stage-figures.js');
  const unit = {id: 'hero', side: 'player', role: 'soldier', name: 'Gaius'}, placed = [], figures = Object.create(BattleStage.prototype);
  Object.assign(figures, {quality: 'balanced', figureStyle: 'sculpted', commendations: {}, actors: new Map(), figureQueue: null,
    placeFigure(u, options) {placed.push(options.styleKey);const actor = {group: {userData: {styleKey: options.styleKey}}};this.actors.set(u.id, actor);return actor;}});
  const first = figures.syncFigure(unit, encounter);
  assert.equal(figures.syncFigure(unit, encounter), first, 'An unchanged key keeps the figure');assert.equal(placed.length, 1);
  figures.figureStyle = 'painted';figures.syncFigure(unit, encounter);
  assert.deepEqual(placed, ['sculpted', 'painted'].map(figureStyle => figureStyleKey(unit, {commendations: 0, quality: 'balanced', figureStyle})));
  figures.syncFigure({...unit, side: 'enemy'}, encounter);assert.equal(placed.length, 3, 'A committed defection rebuilds the figure');
  figures.figureQueue = new Set();assert.equal(figures.syncFigure({...unit, id: 'lucan'}, encounter), null, 'While the stage is first built, a new figure waits for prepare()');
  assert.deepEqual([...figures.figureQueue], ['lucan']);assert.equal(placed.length, 3);
  // The replacement is safe: a figure that fails to build leaves the old one standing; one that builds takes its place.
  const old = {group: new T.Group(), disposed: 0, dispose() {this.disposed++;}}, scene = new T.Scene();scene.add(old.group);
  const swap = Object.create(BattleStage.prototype);
  Object.assign(swap, {quality: 'performance', figureStyle: 'sculpted', chapter: 1, scene, actors: new Map([['hero', old]]), poseReset: new Set(), canvas: {dataset: {}}, disposed: false, attachFormation() {throw new Error('formation failed');}});
  assert.throws(() => swap.placeFigure(unit, {styleKey: 'new', vComm: 0}), /formation failed/);
  assert.equal(swap.actors.get('hero'), old);assert.equal(old.disposed, 0);assert.equal(old.group.parent, scene);
  swap.attachFormation = () => {};const built = swap.placeFigure(unit, {styleKey: 'new', vComm: 0});
  assert.equal(swap.actors.get('hero'), built);assert.equal(built.group.userData.styleKey, 'new');assert.equal(built.group.userData.unitId, 'hero');
  assert.equal(old.disposed, 1);assert.equal(old.group.parent, null);built.dispose();
  stage.setFigureStyle('painted');assert.equal(synced.length, 1, 'Re-selecting the same style does nothing');
  stage.setFigureStyle('invented');assert.equal(stage.figureStyle, 'sculpted', 'Unknown styles fall back to sculpted');
  assert.equal(JSON.stringify(encounter), frozen, 'The encounter is untouched');
});

test('v0.29.0: the compositor offers tilt-shift and ink finishes, clamped, and the controller forwards the setting', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createSceneCompositor} = await import('../src/showcase/scene-compositor.js');
  let quad = null;
  const renderer = {extensions: {has: () => true}, capabilities: {maxTextureSize: 4096}, info: {autoReset: true, reset() {}}, getDrawingBufferSize: v => v.set(640, 360), getRenderTarget: () => null, setRenderTarget() {}, render(object) {if (!object.isScene) quad = object;}};
  const compositor = createSceneCompositor(renderer, new T.PerspectiveCamera(), {quality: 'high'});
  compositor.render(new T.Scene());
  const u = quad.material.uniforms;
  assert.equal(u.tiltShift.value, 0);assert.equal(u.ink.value, 0);
  compositor.setStyle({tiltShift: 4, ink: -1});assert.equal(u.tiltShift.value, 1);assert.equal(u.ink.value, 0);
  compositor.setStyle({ink: .5});assert.equal(u.tiltShift.value, 0);assert.equal(u.ink.value, .5);
  compositor.setFocus(31);assert.equal(u.focusDepth.value, 31);compositor.setFocus(-4);assert.equal(u.focusDepth.value, 31, 'Invalid focus distances are ignored');
  assert.match(quad.material.fragmentShader, /tiltShiftColor/);assert.match(quad.material.fragmentShader, /inkFinish/);
  assert.equal(compositor.stats().ink, .5);compositor.dispose();
  const {createBattleStageController} = await import('../src/ui/battle-stage-controller.js');
  const calls = [];
  class FakeStage {
    constructor(board) {this.canvas = board;this.labelLayer = {};this.quality = 'balanced';this.figureStyle = 'sculpted';}
    sync() {} setSelection() {} setGrid() {} applyQuality() {} setReducedMotion() {} setPaused() {} setAudio() {} home() {} resize() {} dispose() {}
    setFigureStyle(style) {calls.push(style);this.figureStyle = style;}
  }
  const host = {dataset: {}, append() {}}, canvas = {parentElement: host, isConnected: true, replaceWith() {}};
  const controller = createBattleStageController({load: async () => ({BattleStage: FakeStage})});
  controller.mount(canvas, {encounter: {id: 'ch1-road', kind: 'battle', units: []}, quality: 'balanced', figureStyle: 'painted'});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['painted'], 'The saved style reaches a new stage');
  controller.figures('inked');assert.deepEqual(calls, ['painted', 'inked']);
  controller.release();
});

test('v0.29.0: from Chapter IV military units stand as formations whose men fall with their strength', async () => {
  const {formationEligible, formationSlots, formationShape, followerCount, FORMATION_LIMIT} = await import('../src/showcase/formation.js');
  const legion = {id: 'ally0', role: 'infantry', side: 'ally', hp: 17, maxHp: 17};
  assert.equal(formationEligible(legion, {chapter: 7}), true);
  assert.equal(formationEligible(legion, {chapter: 3}), false, 'Early chapters are skirmishes between individuals');
  assert.equal(formationEligible({...legion, id: 'hero'}, {chapter: 9}), false, 'The commander is always one figure');
  assert.equal(formationEligible(legion, {chapter: 9, contest: true}), false);
  assert.equal(formationEligible({id: 'v1', role: 'voter'}, {chapter: 11}), false);
  assert.equal(formationShape({...legion, formation: 'wedge'}), 'wedge');assert.equal(formationShape({...legion, braced: true}), 'shield-wall');
  assert.equal(formationShape({...legion, role: 'cavalry'}), 'mounted');assert.equal(formationShape({...legion, role: 'archer'}), 'archer');
  for (const unit of [legion, {...legion, formation: 'shield-wall'}, {...legion, formation: 'wedge'}, {...legion, role: 'archer'}, {...legion, role: 'raider'}, {...legion, role: 'cavalry'}]) {
    const slots = formationSlots(unit);
    assert.ok(slots.length >= 2 && slots.length <= 8);
    assert.ok(slots.every(s => Math.abs(s.x) <= 1.1 && Math.abs(s.z) <= 1.1 && Math.abs(s.yaw) <= .11), `${formationShape(unit)} stays inside its own tile`);
    assert.ok(slots.every(s => Math.hypot(s.x, s.z) > .5), 'No follower stands on the leader');
    assert.deepEqual(formationSlots(unit), slots, 'Formations are deterministic');
  }
  assert.equal(followerCount(legion, 8), 8);assert.equal(followerCount({...legion, hp: 9}, 8), 4);assert.equal(followerCount({...legion, hp: 0}, 8), 0);
  assert.equal(followerCount({id: 'x', role: 'infantry'}, 5), 5, 'Units without a strength record keep their full formation');
  assert.ok(FORMATION_LIMIT.performance < FORMATION_LIMIT.balanced && FORMATION_LIMIT.balanced < FORMATION_LIMIT.high);
});

test('v0.29.0: a sculpted formation is one instanced draw per overview surface, skinned by the leader and placed on the ground', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createActor} = await import('../src/showcase/actors.js');
  const {createSkinnedCrowd, formationSlots, followerCount} = await import('../src/showcase/formation.js');
  const unit = {id: 'ally1', name: 'Aulus Naso', role: 'infantry', side: 'ally', x: 3, y: 3, hp: 12, maxHp: 17, facing: 'east'}, before = JSON.stringify(unit);
  const actor = createActor(unit, {chapter: 7, quality: 'balanced'}), group = actor.group;
  group.position.set(1.25, .4, -3.75);group.rotation.y = .6;group.updateMatrixWorld(true);
  const leaderMeshes = [];group.traverse(o => {if (o.isMesh) leaderMeshes.push(o);});
  const crowd = createSkinnedCrowd(group, {max: 5});
  assert.ok(crowd && crowd.meshes.length >= 1);
  const overview = leaderMeshes.filter(o => o.isSkinnedMesh && o.userData.overview);
  for (const mesh of crowd.meshes) {
    assert.ok(mesh.isSkinnedMesh && mesh.geometry.isInstancedBufferGeometry);
    assert.ok(overview.some(o => o.skeleton.bones === mesh.skeleton.bones) || mesh.skeleton.bones.every(b => b.isBone), 'Followers are posed by the leader’s bones');
    let picks = [];mesh.raycast(new T.Raycaster(), picks);assert.equal(picks.length, 0, 'Followers never take a pick');
  }
  const shared = crowd.meshes.find(m => overview.some(o => o.geometry.attributes.position === m.geometry.attributes.position));
  assert.ok(shared, 'Follower surfaces reuse the leader’s vertex buffers instead of copying them');
  const slots = formationSlots(unit), visible = followerCount(unit, Math.min(slots.length, crowd.max)), heightAt = (x, z) => .4 + x * .01;
  crowd.update({slots, visible, heightAt});
  assert.equal(crowd.count, visible);assert.ok(crowd.meshes.every(m => m.geometry.instanceCount === visible));
  assert.equal(crowd.footprints.length, visible);
  for (const [i, p] of crowd.footprints.entries()) {
    assert.ok(Math.abs(p.y - heightAt(p.x, p.z)) < 1e-9, 'Each man stands on the ground under him');
    const offset = crowd.meshes[0].geometry.attributes.crowdOffset;
    assert.ok(Math.abs(offset.getX(i) - slots[i].x) < 1e-6 && Math.abs(offset.getZ(i) - slots[i].z) < 1e-6);
  }
  crowd.update({slots, visible: 0, heightAt});assert.ok(crowd.meshes.every(m => m.geometry.instanceCount === 0));
  const leaderGeometry = overview[0].geometry;let leaderDisposed = 0;leaderGeometry.addEventListener('dispose', () => leaderDisposed++);
  crowd.dispose();crowd.dispose();
  assert.ok(crowd.meshes.every(m => !m.parent), 'Disposal removes every follower');
  assert.equal(leaderDisposed, 0, 'The leader keeps its own geometry');
  assert.equal(JSON.stringify(unit), before, 'Formations never edit the unit');
  actor.dispose();
});

test('v0.29.0: the stage attaches formations by chapter and quality, disposes them with the figure, and shades their feet', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {BattleStage} = await import('../src/showcase/stage.js');
  const {createActor} = await import('../src/showcase/actors.js');
  const {createContactShadows} = await import('../src/showcase/contact-shadows.js');
  const stage = Object.create(BattleStage.prototype);
  Object.assign(stage, {chapter: 7, quality: 'balanced', encounter: {kind: 'battle'}});
  const unit = {id: 'enemy2', name: 'Gothic infantry', role: 'infantry', side: 'enemy', hp: 10, maxHp: 10, x: 4, y: 4};
  const actor = createActor(unit, {chapter: 7, quality: 'balanced'});
  stage.attachFormation(unit, actor);
  assert.ok(actor.crowd, 'A Chapter VII unit gets a formation');assert.equal(actor.crowd.max, 5, 'Balanced quality shows up to five followers');
  assert.equal(stage.followerSlots(unit), stage.followerSlots(unit), 'Slots are cached per unit and shape');
  actor.crowd.update({slots: stage.followerSlots(unit), visible: 5, heightAt: () => 0});
  const scene = new T.Scene(), shadows = createContactShadows(scene);
  shadows.update(new Map([[unit.id, actor]]), () => 0);
  const withFollowers = shadows.stats().stamps;actor.crowd.update({slots: stage.followerSlots(unit), visible: 0, heightAt: () => 0});shadows.update(new Map([[unit.id, actor]]), () => 0);
  assert.equal(withFollowers - shadows.stats().stamps, 5, 'Each follower adds its own contact shading');
  const crowd = actor.crowd;actor.dispose();assert.ok(crowd.meshes.every(m => !m.parent), 'Disposing the figure disposes its formation');
  stage.chapter = 2;const early = createActor({...unit, id: 'enemy0'}, {chapter: 2});stage.attachFormation({...unit, id: 'enemy0'}, early);
  assert.equal(early.crowd, null, 'Chapter II units stay single figures');early.dispose();shadows.dispose();
});

test('v0.29.0: painted followers are instanced cards of the same painting with their own shadows', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createPaintedActor} = await import('../src/showcase/painted-actor.js');
  const {formationSlots} = await import('../src/showcase/formation.js');
  const canvas = installFakeCanvas({alpha: 255});
  try {
    const unit = {id: 'ally3', role: 'infantry', side: 'ally', hp: 17, maxHp: 17, facing: 'north'}, actor = createPaintedActor(unit, {chapter: 9});
    const crowd = actor.createCrowd(4), camera = new T.PerspectiveCamera(40, 1, .1, 100);
    camera.position.set(8, 9, 10);camera.lookAt(0, 0, 0);camera.updateMatrixWorld();
    actor.update({direction: 0, unit});crowd.update({slots: formationSlots(unit), visible: 3, heightAt: () => 0});actor.faceCamera(camera, {sunYaw: 1});
    const cards = actor.group.getObjectByName('painted formation followers'), shadows = actor.group.getObjectByName('painted formation shadows');
    assert.equal(cards.count, 3);assert.equal(shadows.count, 3);assert.equal(cards.material, actor.group.children[0].material, 'Followers share the leader’s painting');
    assert.equal(cards.castShadow, false);assert.equal(shadows.castShadow, true);
    const m = new T.Matrix4();for (let i = 0; i < 3; i++) {cards.getMatrixAt(i, m);assert.ok(m.elements.every(Number.isFinite));}
    const hits = [];cards.raycast(new T.Raycaster(), hits);assert.equal(hits.length, 0);
    actor.dispose();assert.equal(cards.parent, null);assert.equal(shadows.parent, null);
  } finally {canvas.restore();}
});

test('v0.29.0: labels are compact by default; named figures, the selection and the pointer keep their names', async () => {
  const {labelRole, namedFigure, voterPosture} = await import('../src/showcase/stage.js');
  const {readFile} = await import('node:fs/promises');
  assert.equal(labelRole({role: 'infantry'}), 'infantry');assert.equal(labelRole({role: 'heavy'}), 'cavalry');assert.equal(labelRole({role: 'soldier'}), 'infantry');assert.equal(labelRole({role: 'archer'}), 'archer');
  for (const unit of [{id: 'hero'}, {id: 'ally0', veteranId: 'v-lucan'}, {id: 'e0', role: 'escort'}, {id: 'enemy0', name: 'Rival claimant', role: 'infantry'}]) assert.equal(namedFigure(unit), true);
  for (const unit of [{id: 'enemy1', name: 'Gothic raider', role: 'raider'}, {id: 'ally6', name: 'Relief cohort 7', role: 'archer'}]) assert.equal(namedFigure(unit), false);
  assert.deepEqual(voterPosture({stance: 3}), {motion: 'assent', phase: 1});assert.deepEqual(voterPosture({stance: -1}), {motion: 'dissent', phase: 1 / 3});assert.equal(voterPosture({stance: 0}), null);
  const css = await readFile(new URL('../src/ui/battle-3d.css', import.meta.url), 'utf8');
  const {declared, cssRules} = await import('./css-rules.mjs');
  for (const role of ['infantry', 'archer', 'cavalry', 'guard', 'raider', 'commander']) assert.match(declared(css, selector => selector.endsWith(`[data-role=${role}] .world-role`))['background-image'] ?? '', /^url\("data:image\/svg\+xml/, `${role} has a glyph`);
  assert.equal(declared(css, selector => selector.includes(':not(.named)') && selector.endsWith(' .world-name')).display, 'none', 'Rank-and-file names hide by default');
  for (const bloc of ['Veterans', 'Landholders', 'Civic', 'Chamber']) assert.ok(cssRules(css).some(rule => rule.selectors.some(selector => selector.includes(`[data-bloc=${bloc}]`))), `${bloc} is styled`);
});

test('v0.29.0: Senate delegates wear their bloc on the toga trim and show their stance in posture', async () => {
  const {BLOC_TRIM, createActor} = await import('../src/showcase/actors.js');
  const {actorPose} = await import('../src/showcase/actor-pose.js');
  const trims = ['Veterans', 'Landholders', 'Civic', 'Chamber'].map(b => BLOC_TRIM[b]);
  assert.equal(new Set(trims).size, 4, 'Every data bloc has its own trim');
  const actor = createActor({id: 'member2', name: 'Civic delegate 1', role: 'voter', side: 'neutral', bloc: 'Civic', stance: 2}, {chapter: 11});
  // Colours are baked (linear, lightly shaded) into merged vertex colours, so compare hue, not exact values.
  const THREE = await import('../vendor/three/three.module.js'), hue = c => {const m = Math.max(c.r, c.g, c.b, 1e-6);return [c.r / m, c.g / m, c.b / m];};
  const target = hue(new THREE.Color(BLOC_TRIM.Civic)), samples = [];
  actor.group.traverse(o => {if (!o.isMesh) return;const c = o.geometry.attributes.color, base = o.material?.color ?? new THREE.Color(1, 1, 1);
    if (c) for (let i = 0; i < c.count; i++) samples.push(new THREE.Color(c.getX(i) * base.r, c.getY(i) * base.g, c.getZ(i) * base.b));else samples.push(base.clone());});
  assert.ok(samples.some(s => hue(s).every((v, i) => Math.abs(v - target[i]) < .06)), 'The Civic delegate’s trim is the Civic colour');
  actor.dispose();
  const idle = actorPose({motion: 'idle', reducedMotion: true}), assent = actorPose({motion: 'assent', phase: 1, reducedMotion: true}), dissent = actorPose({motion: 'dissent', phase: 1, reducedMotion: true}), slight = actorPose({motion: 'dissent', phase: .33, reducedMotion: true});
  assert.ok(assent.rightArm[0] < idle.rightArm[0] - .3, 'Assent reaches toward the speaker');
  assert.ok(dissent.leftElbow < idle.leftElbow - 1 && dissent.rightElbow < idle.rightElbow - 1, 'Dissent folds both arms');
  assert.ok(Math.abs(slight.leftElbow - idle.leftElbow) < Math.abs(dissent.leftElbow - idle.leftElbow), 'Wavering delegates fold less');
  for (const pose of [assent, dissent]) assert.ok([...pose.leftArm, ...pose.rightArm, pose.headX, pose.bodyX].every(Number.isFinite));
});

test('v0.29.0: move reach and enemy threat are inked on the ground from what the rules returned', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createInkOverlay, threatCells} = await import('../src/showcase/ink-overlay.js');
  const {BattleStage} = await import('../src/showcase/stage.js');
  const {RIVER_WATER_LEVEL} = await import('../src/showcase/environment-layout.js');
  assert.deepEqual(threatCells({moveTiles: [{x: 0, y: 0}], range: 1}, {width: 8, height: 8}).map(c => `${c.x},${c.y}`).sort(), ['0,0', '0,1', '1,0']);
  assert.equal(threatCells({moveTiles: [{x: 4, y: 4}], range: 3}).length, 25, 'An archer threatens a diamond three cells out');
  assert.deepEqual(threatCells(null), []);
  const canvas = installFakeCanvas({alpha: 255});
  try {
    const encounter = {width: 8, height: 8}, heightAt = (x, z) => x > 5 ? -1.3 : .2, scene = new T.Scene(), ink = createInkOverlay(scene, encounter, heightAt);
    assert.ok(ink && ink.mesh.parent === scene && !ink.mesh.visible);
    const pos = ink.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 13) assert.ok(pos.getY(i) >= Math.max(heightAt(pos.getX(i), pos.getZ(i)), RIVER_WATER_LEVEL) + .03, 'The ink lies on the ground or the water surface');
    assert.equal(ink.paint({targets: [{x: 1, y: 1}, {x: 2, y: 1}], color: '#89cfcb'}), true);assert.equal(ink.mesh.visible, true);
    assert.equal(ink.paint({targets: [{x: 2, y: 1}, {x: 1, y: 1}], color: '#89cfcb'}), false, 'The same reach is not repainted');
    assert.equal(ink.paint({targets: [], threat: {moveTiles: [{x: 5, y: 5}], range: 1}}), true);assert.equal(ink.mesh.visible, true);
    assert.equal(ink.paint({}), true);assert.equal(ink.mesh.visible, false);
    const hits = [];ink.mesh.raycast(new T.Raycaster(), hits);assert.equal(hits.length, 0, 'Ink never takes a pick');
    ink.dispose();assert.equal(ink.mesh.parent, null);
  } finally {canvas.restore();}
  const painted = [], stage = Object.create(BattleStage.prototype);
  Object.assign(stage, {ink: {paint(p) {painted.push(p);}}, targets: [{x: 1, y: 1}], targetMaterial: new T.MeshBasicMaterial({color: '#89cfcb'}), inspected: 'enemy0', hovered: null,
    encounter: {kind: 'battle', width: 8, height: 8, terrain: Array.from({length: 8}, () => Array(8).fill('grass')), units: [{id: 'enemy0', side: 'enemy', role: 'infantry', x: 4, y: 4, hp: 5, move: 2}, {id: 'hero', side: 'player', x: 4, y: 6, hp: 5}]}});
  const before = JSON.stringify(stage.encounter);stage.updateInk();
  assert.equal(painted[0].threat?.unitId, 'enemy0', 'An inspected enemy shows its threat');assert.equal(painted[0].color, '#89cfcb');
  stage.inspected = 'hero';stage.updateInk();assert.equal(painted[1].threat, null, 'Friendly figures show no threat');
  assert.equal(JSON.stringify(stage.encounter), before, 'Inking reads the encounter without changing it');
});

test('v0.29.0: the painted Tabula inks the career route by chapter and keeps the theatre-node contract', async () => {
  const {careerLegs, legStatus, paintedJourneyMap, THEATRES} = await import('../src/ui/campaign-map.js');
  const {journeyMap} = await import('../src/ui/art.js');
  const legs = careerLegs();
  assert.deepEqual(legs.map(l => l.chapter), [2, 3, 5, 7, 8, 9, 10, 11], 'One leg per change of theatre');
  assert.ok(legs.every(l => l.from !== l.to));
  assert.equal(legStatus(legs[3], 7, [1, 2, 3, 4, 5, 6]), 'current');assert.equal(legStatus(legs[0], 7, []), 'done');assert.equal(legStatus(legs[6], 7, []), 'ahead');
  const svg = paintedJourneyMap(9, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(journeyMap(9, [1, 2, 3, 4, 5, 6, 7, 8]), svg, 'journeyMap is the painted Tabula');
  for (const [slug] of THEATRES) assert.match(svg, new RegExp(`class="tabula-node[^"]*" data-theatre="${slug}"`));
  assert.equal((svg.match(/career-leg current/g) ?? []).length, 1, 'Only the leg into this chapter draws itself');
  assert.equal((svg.match(/career-leg done/g) ?? []).length, 5);assert.equal((svg.match(/career-leg ahead/g) ?? []).length, 2);
  assert.match(svg, /style="--len:\d+px"/);assert.match(svg, /<filter id="tabula-ink"/);
  const css = await (await import('node:fs/promises')).readFile(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
  const leg = (await import('./css-rules.mjs')).declared(css, selector => selector.endsWith(' .career-leg.current'));
  assert.equal(leg['stroke-dashoffset'], '0', 'Reduced motion (no animation) leaves the leg fully drawn');assert.match(leg.animation, /^tabula-draw\b/);
});

test('v0.29.0: the finale stands before the rising Aurelian Walls with massed legions, all outside the board', async () => {
  const THREE = await import('../vendor/three/three.module.js');
  const {readFile} = await import('node:fs/promises');
  const {createEnvironment} = await import('../src/showcase/environment.js');
  const {finaleLayout, createMassedSoldierGeometry} = await import('../src/showcase/environment-finale.js');
  const fixture = JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json', import.meta.url), 'utf8'));
  const s = fixture.scenes.find(s => s.id === 'ch12-confrontation'), e = s.state.encounter, before = JSON.stringify(s.state);
  const layout = finaleLayout(e), hx = e.width * 2.5 / 2, hz = e.height * 2.5 / 2;
  assert.ok(layout.wallX > hx + 6, 'The curtain stands beyond the gate, east of the board');
  for (const b of layout.blocks) assert.ok(Math.abs(b.x) > hx + 1, `${b.side} legions stand off the board`);
  assert.deepEqual([...new Set(layout.blocks.map(b => b.side))].sort(), ['claimant', 'commander']);
  const g = createMassedSoldierGeometry();g.computeBoundingBox();assert.ok(g.boundingBox.max.y > 1.7 && g.boundingBox.max.y < 1.9, 'A man at distance is about 1.8 m');g.dispose();
  const world = createEnvironment(new THREE.Scene(), e, {chapter: 12, quality: 'balanced', loadTextures: false});
  assert.ok(world.group.userData.environmentLandmarks.includes('the rising Aurelian Walls'));
  const figures = world.group.getObjectByName('massed legion figures');assert.ok(figures?.isInstancedMesh && figures.count >= 200);
  assert.ok(world.stats().meshes < 60, 'The finale stays inside the draw-object budget');
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < figures.count; i++) {figures.getMatrixAt(i, m);p.setFromMatrixPosition(m);assert.ok(Math.abs(p.x) > hx || Math.abs(p.z) > hz, 'No soldier stands on the legal board');}
  assert.equal(JSON.stringify(s.state), before);world.dispose();
  const other = fixture.scenes.find(s => s.id === 'ch7-legion'), plain = createEnvironment(new THREE.Scene(), other.state.encounter, {chapter: 7, quality: 'balanced', loadTextures: false});
  assert.equal(plain.group.getObjectByName('massed legion figures'), undefined, 'Only the finale is staged this way');plain.dispose();
});

test('v0.29.0: the action camera frames a committed attack side-on and closer, then gives the view back', async () => {
  const {sideOnYaw, actionFraming} = await import('../src/showcase/stage.js');
  const orbit = {yaw: -.55, pitch: .67, distance: 30};
  assert.deepEqual(actionFraming(orbit, {weight: 0, sideYaw: 1}), {yaw: -.55, pitch: .67, distance: 30}, 'At rest nothing changes');
  const full = actionFraming(orbit, {weight: 1, sideYaw: .2});
  assert.ok(full.distance < 18 && full.distance >= 9 && full.pitch < orbit.pitch && full.pitch >= .3);
  assert.ok(Math.abs(full.yaw - (-.55 + (.2 + .55) * .35)) < 1e-9, 'It turns a third of the way toward side-on');
  assert.equal(actionFraming(orbit, {weight: 1, sideYaw: .2, painted: true}).yaw, -.55, 'Painted figures keep their diagonal view');
  assert.equal(actionFraming({yaw: 0, pitch: .4, distance: 12}, {weight: 1}).distance, 9, 'Never closer than nine metres');
  const side = sideOnYaw({x: 0, z: 0}, {x: 0, z: 5}, 0);assert.ok(Math.abs(Math.abs(side) - Math.PI / 2) < 1e-9, 'Side-on is perpendicular to the attack');
  assert.ok(Math.abs(sideOnYaw({x: 0, z: 0}, {x: 0, z: 5}, 1.4) - Math.PI / 2) < 1e-9, 'and on the side nearest the current view');
});

test('v0.29.0: after the rules decide a Senate vote, the division walks each delegate to the side he was counted on', async () => {
  const {discessioPlan, BattleStage} = await import('../src/showcase/stage.js');
  const {votes} = await import('../src/core/contest.js');
  const {readFile} = await import('node:fs/promises');
  const fixture = JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json', import.meta.url), 'utf8'));
  const e = structuredClone(fixture.scenes.find(s => s.id === 'ch11-accounts').state.encounter);
  assert.equal(discessioPlan({...e, status: 'active'}), null, 'Nothing is staged before the vote');
  assert.equal(discessioPlan({...e, kind: 'battle', status: 'won'}), null);
  const decided = {...e, status: 'won'}, plan = discessioPlan(decided), frozen = JSON.stringify(decided);
  const voters = decided.units.filter(u => u.role === 'voter' && !u.hidden);
  assert.equal(plan.moves.length, voters.length, 'Every delegate divides');
  assert.equal(plan.moves.filter(m => m.side === 'for').length, voters.filter(u => u.vote === 'for' || u.vote !== 'against' && u.stance >= 1).length);
  const tally = votes(decided);assert.ok(plan.moves.filter(m => m.side === 'for').length <= tally.for, 'The ayes never exceed the rules’ count');
  for (const m of plan.moves) assert.ok(m.to.x >= 0 && m.to.y >= 0 && m.to.x <= e.width - 1 && m.to.y <= e.height - 1, 'Everyone stays in the chamber');
  assert.deepEqual(discessioPlan(decided), plan, 'The division is deterministic');assert.equal(JSON.stringify(decided), frozen);
  const stage = Object.create(BattleStage.prototype);
  Object.assign(stage, {reducedMotion: true, discessio: {...plan, start: 0, end: 5000, byUnit: new Map(plan.moves.map(m => [m.unitId, m]))}, encounter: decided, environment: {groundHeight: () => 0}});
  const move = plan.moves[0], step = stage.divisionStep(voters.find(v => v.id === move.unitId), 10);
  assert.deepEqual(step.at, move.to, 'Reduced motion places each delegate at once');assert.equal(step.moving, false);
  stage.reducedMotion = false;const mid = stage.divisionStep(voters.find(v => v.id === move.unitId), 300 + move.order * 220);
  assert.ok(mid.moving || mid.at.x === move.to.x, 'Otherwise they walk there');
});

test('v0.29.0: the oath and accession tableaux are presentation-only scenes mounted over their paintings', async () => {
  const {ceremonyScene, CEREMONY_KINDS} = await import('../src/showcase/ceremony.js');
  const {terrainAt} = await import('../src/showcase/environment-layout.js');
  const {createCeremonyController} = await import('../src/ui/ceremony-controller.js');
  const {readFile} = await import('node:fs/promises');
  assert.deepEqual([...CEREMONY_KINDS], ['oath', 'accession']);assert.equal(ceremonyScene('coronation'), null);
  const oath = ceremonyScene('oath', {name: 'Gaius'}), accession = ceremonyScene('accession', {name: 'Gaius'});
  assert.equal(oath.encounter.units.find(u => u.id === 'hero').name, 'Gaius');assert.equal(oath.chapter, 1);
  assert.ok(oath.encounter.units.filter(u => oath.poses[u.id] === 'speak').length >= 5, 'The recruits swear together');
  const emperor = accession.encounter.units.find(u => u.id === 'hero');
  assert.equal(terrainAt(accession.encounter, emperor.x, emperor.y), 'high', 'Augustus stands on a raised tribunal');
  assert.ok(accession.palettes.hero.cloth, 'He wears imperial purple');assert.equal(accession.chapter, 12);
  assert.ok(accession.encounter.units.filter(u => accession.poses[u.id] === 'rally').length >= 5, 'The legions acclaim him');
  // The controller mounts a stage over the painting and keeps the painting on failure.
  const calls = [];class FakeStage {constructor(canvas, encounter, options) {calls.push({encounter, options});this.quality = options.quality;} home() {calls.push('home');} setReducedMotion() {} applyQuality() {} dispose() {calls.push('dispose');}}
  const appended = [];const host = {dataset: {}, append(node) {appended.push(node);node.isConnected = true;node.remove = () => {node.isConnected = false;};}};
  const previousDocument = globalThis.document;globalThis.document = {createElement: () => ({setAttribute() {}, className: ''})};
  try {
    const c = createCeremonyController({load: async () => [{BattleStage: FakeStage}, {ceremonyScene}]});
    c.mount(host, {kind: 'accession', name: 'Gaius', quality: 'high'});await new Promise(r => setImmediate(r));
    assert.equal(calls[0].options.ceremony.chapter, 12);assert.equal(calls[0].options.chapter, 12);assert.ok(calls.includes('home'));assert.equal(host.dataset.ceremonyReady, 'true');
    c.release();assert.ok(calls.includes('dispose'));assert.equal(host.dataset.ceremonyReady, undefined, 'Releasing shows the painting again');
    const failing = createCeremonyController({load: async () => [{BattleStage: class {constructor() {throw new Error('no WebGL');}}}, {ceremonyScene}]});
    failing.mount(host, {kind: 'oath', name: 'Gaius'});await new Promise(r => setImmediate(r));
    assert.equal(host.dataset.ceremonyReady, undefined, 'A failed stage leaves the painting');
  } finally {globalThis.document = previousDocument;}
  // The views stage both ends of the campaign: the oath where its one shared entry is read, and the accession.
  const G = await import('../src/core/game.js'), {OATH} = await import('../src/data/campaign.js'), {createCampaignViews} = await import('../src/ui/campaign-views.js');
  const {playEncounter, runCampaign} = await import('../scripts/autoplay.mjs');
  const s = G.newGame('Ceremony'), views = state => createCampaignViews(() => ({state, screen: 'game', settings: {}, saving: false, offline: false}));
  G.choose(s, G.getChapter(s).decision.options[0].id);G.startEncounter(s);playEncounter(s);assert.ok(G.commitEncounter(s).ok);assert.ok(G.swearOath(s).ok);
  const oathLine = G.storyLines(s).findIndex(line => line.text === OATH);assert.ok(oathLine >= 0);
  assert.ok(G.setStoryProgress(s, oathLine).ok);assert.match(views(s).camp(), /<figure class="ceremony-scene oath-scene" data-ceremony="oath"/);
  assert.ok(G.setStoryProgress(s, oathLine + 1).ok);assert.doesNotMatch(views(s).camp(), /data-ceremony/, 'Only the oath line stages the oath');
  const {state: reign} = await runCampaign();assert.equal(reign.phase, 'epilogue');
  assert.match(views(reign).ending(), /<div class="ceremony-scene accession-scene" data-ceremony="accession"/);
});
