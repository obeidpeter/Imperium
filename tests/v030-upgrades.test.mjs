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
// A canvas context that records what was stroked and printed.
function recordingContext() {
  const strokes = [], texts = [];
  const ctx = {strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: '', globalAlpha: 1, lineCap: '', lineJoin: '', shadowColor: '', shadowBlur: 0, globalCompositeOperation: 'source-over', filter: 'none',
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, arc() {}, ellipse() {}, rect() {}, clip() {}, translate() {}, scale() {}, rotate() {}, setTransform() {}, resetTransform() {},
    fill() {}, stroke() {strokes.push(String(this.strokeStyle).toLowerCase());}, fillRect() {}, strokeRect() {}, clearRect() {}, setLineDash() {}, quadraticCurveTo() {}, bezierCurveTo() {}, drawImage() {},
    fillText(text) {texts.push(String(text));}, strokeText() {}, measureText(text) {return {width: String(text).length * 7};},
    createLinearGradient() {return {addColorStop() {}};}, createRadialGradient() {return {addColorStop() {}};}, createPattern() {return null;}, getImageData() {return {data: new Uint8ClampedArray(4)};}, putImageData() {}};
  return {ctx, strokes, texts};
}

// Machado, Oliveira and Fernandes (2009) full-severity dichromacy, on linear sRGB.
const DICHROMACY = {
  protanopia: [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]],
  deuteranopia: [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.011820, .042940, .968881]],
  tritanopia: [[1.255528, -.076749, -.178779], [-.078411, .930809, .147602], [.004733, .691367, .303900]]
};
function labOf(hex, matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
  const linear = [1, 3, 5].map(i => {const c = parseInt(hex.slice(i, i + 2), 16) / 255;return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;});
  const [r, g, b] = matrix.map(row => Math.min(1, Math.max(0, row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2])));
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const x = (.4124 * r + .3576 * g + .1805 * b) / .95047, y = .2126 * r + .7152 * g + .0722 * b, z = (.0193 * r + .1192 * g + .9505 * b) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('v0.30.0: Senate blocs share one palette in both views and never rest on colour alone', async () => {
  const {BLOC_STYLE, DELEGATE_BLOCS, trimBands} = await import('../src/ui/bloc-style.js');
  const {BLOC_TRIM} = await import('../src/showcase/actors.js');
  const {readFile} = await import('node:fs/promises');
  const {paintBattle} = await import('../src/ui/battle-art.js');
  assert.deepEqual(DELEGATE_BLOCS, ['Veterans', 'Landholders', 'Civic']);
  // Distinct letters and trim shapes, so colour is never the only cue.
  assert.equal(new Set(DELEGATE_BLOCS.map(b => BLOC_STYLE[b].letter)).size, 3);
  const shape = bloc => trimBands(bloc).map(b => `${(b.to - b.from).toFixed(3)}${b.gilt ? 'g' : ''}${b.rows ? `r${b.rows}` : ''}`).join('|');
  assert.equal(new Set([...DELEGATE_BLOCS, 'Chamber'].map(shape)).size, 4, 'Every bloc trims its toga in its own shape');
  for (const bloc of Object.keys(BLOC_STYLE)) for (const band of trimBands(bloc)) assert.ok(band.from >= 0 && band.to <= 1 && band.to > band.from, `${bloc} trim stays on the drape`);
  // Every pair of delegate blocs stays apart for common colour-vision deficiencies.
  for (const [mode, matrix] of Object.entries({typical: undefined, ...DICHROMACY}))
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const a = DELEGATE_BLOCS[i], b = DELEGATE_BLOCS[j], d = deltaE(labOf(BLOC_STYLE[a].color, matrix), labOf(BLOC_STYLE[b].color, matrix));
      assert.ok(d > 25, `${a} and ${b} are ${d.toFixed(1)} apart under ${mode}`);
    }
  // The 3D trim and the 2D board draw the same colour; the 3D marker leads with the 2D letter.
  for (const bloc of Object.keys(BLOC_STYLE)) assert.equal(BLOC_TRIM[bloc], parseInt(BLOC_STYLE[bloc].color.slice(1), 16));
  const css = await readFile(new URL('../src/ui/battle-3d.css', import.meta.url), 'utf8');
  for (const bloc of DELEGATE_BLOCS) assert.match(css, new RegExp(`\\[data-bloc=${bloc}\\] \\.world-short::before\\{content:"${BLOC_STYLE[bloc].letter}"\\}`), `${bloc} letter on the 3D stance marker`);
  const s = started('ch11-adlection'), voters = s.encounter.units.filter(u => DELEGATE_BLOCS.includes(u.bloc));
  assert.ok(new Set(voters.map(u => u.bloc)).size === 3, 'The Senate fixture seats all three blocs');
  const {ctx, strokes, texts} = recordingContext();
  paintBattle(ctx, 960, 600, {ox: 480, oy: 120, tw: 64, th: 32}, s.encounter, 'hero', [], null, s.chapter, {quality: 'performance'});
  for (const bloc of DELEGATE_BLOCS) {
    assert.ok(strokes.includes(BLOC_STYLE[bloc].color), `2D delegates of the ${bloc} bloc wear its colour`);
    assert.ok(texts.includes(BLOC_STYLE[bloc].letter), `2D prints the ${bloc} letter`);
  }
});

const fixture = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('./fixtures/campaign-3d.json', import.meta.url), 'utf8'));
const fixtureScene = id => fixture.scenes.find(s => s.id === id);
function fakeRenderer({floatTargets = false} = {}) {
  const calls = [];
  return {calls, toneMapping: 4, extensions: {has: () => floatTargets}, capabilities: {maxTextureSize: 4096}, info: {autoReset: true, reset() {}},
    getDrawingBufferSize(v) {return v.set(800, 600);}, getRenderTarget() {return null;}, setRenderTarget() {}, render(scene) {calls.push(scene);}};
}

test('v0.30.0: without the finishing pass the chapter grade rides in tone mapping', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createSceneCompositor, gradeToneMappingChunk, normalizeGrade} = await import('../src/showcase/scene-compositor.js');
  const base = T.ShaderChunk.tonemapping_pars_fragment;
  assert.match(base, /vec3 CustomToneMapping\( vec3 color \) \{ return color; \}/, 'Three still offers the custom tone-mapping hook');
  const grade = {saturation: 1.2, contrast: 1.1, shadow: [.95, 1, 1.05], highlight: [1.04, 1, .96]};
  const chunk = gradeToneMappingChunk(grade);
  assert.match(chunk, /mix\( vec3\( gradeLuma \), color, 1\.2 \)/);
  assert.match(chunk, /vec3\( 1\.1 \)/);
  assert.match(chunk, /mix\( vec3\( 0\.95, 1\.0, 1\.05 \), vec3\( 1\.04, 1\.0, 0\.96 \), smoothstep\( 0\.04, 0\.9, gradeLuma \) \)/);
  assert.match(chunk, /return ACESFilmicToneMapping\( max\( color, vec3\( 0\.0 \) \) \);/);
  assert.deepEqual(normalizeGrade({saturation: 9, contrast: .1}), {...normalizeGrade(), saturation: 2, contrast: .5}, 'The tone-mapped grade obeys the pass’s clamps');
  // Performance: no float target and no pass; materials tone-map with the grade.
  const camera = new T.PerspectiveCamera(), scene = new T.Scene(), direct = fakeRenderer();
  const performance = createSceneCompositor(direct, camera, {quality: 'performance'});
  performance.setGrade(grade);performance.render(scene);
  assert.equal(direct.toneMapping, T.CustomToneMapping);
  assert.equal(T.ShaderChunk.tonemapping_pars_fragment, chunk);
  assert.equal(performance.stats().gradeInToneMapping, true);
  assert.deepEqual(direct.calls, [scene], 'One direct render, no extra pass');
  // Balanced and High grade in the pass itself and keep ACES for its final step.
  const passRenderer = fakeRenderer({floatTargets: true}), pass = createSceneCompositor(passRenderer, camera, {quality: 'high'});
  pass.setGrade(grade);pass.render(scene);
  assert.equal(passRenderer.toneMapping, T.ACESFilmicToneMapping);
  assert.equal(passRenderer.calls.length, 2, 'Scene into the target, then the finishing quad');
  pass.setQuality('performance');pass.render(scene);
  assert.equal(passRenderer.toneMapping, T.CustomToneMapping, 'Dropping to Performance moves the grade into tone mapping');
  pass.setQuality('balanced');pass.render(scene);
  assert.equal(passRenderer.toneMapping, T.ACESFilmicToneMapping, 'Returning to the pass restores ACES');
  pass.dispose();performance.dispose();
  assert.equal(T.ShaderChunk.tonemapping_pars_fragment, base, 'Disposal restores Three’s own chunk');
});

test('v0.30.0: occlusion is baked from relief and standing scenery, deterministically', async () => {
  const {createOcclusionField} = await import('../src/showcase/environment-baked-occlusion.js');
  const bake = (groundAt, build) => {const field = createOcclusionField({minX: -6, minZ: -6, maxX: 6, maxZ: 6, resolution: 4, groundAt});build?.(field);return {field, ao: field.finish()};};
  const sample = ({field, ao}, x, z) => ao[Math.floor((z - field.minZ) * 4) * field.nx + Math.floor((x - field.minX) * 4)];
  // A 3 m wall along z = 0: its foot darkens, open ground stays open.
  const wall = field => {field.triangle(-.25, 3, -3, .25, 3, -3, .25, 3, 3);field.triangle(-.25, 3, -3, .25, 3, 3, -.25, 3, 3);};
  const walled = bake(() => 0, wall), flat = bake(() => 0);
  assert.ok(sample(walled, .6, 0) < .8, `Ground at a wall’s foot sees less sky (${sample(walled, .6, 0).toFixed(2)})`);
  assert.ok(sample(walled, 5, 0) > .97 && sample(flat, 0, 0) > .97, 'Open, flat ground sees the whole sky');
  assert.ok(sample(walled, .6, 0) < sample(walled, 2, 0) && sample(walled, 2, 0) < sample(walled, 4.5, 0), 'Occlusion fades with distance from the wall');
  assert.deepEqual([...bake(() => 0, wall).ao], [...walled.ao], 'The bake is deterministic');
  // Vertical faces mark their plan line up to their top, so posts and walls built
  // only from upright faces (no top) still occlude.
  const upright = bake(() => 0, field => {field.triangle(0, 0, -2, 0, 2.5, -2, 0, 2.5, 2);field.triangle(0, 0, -2, 0, 2.5, 2, 0, 0, 2);});
  assert.ok(Math.abs(upright.field.top[Math.floor(6 * 4) * upright.field.nx + Math.floor(6 * 4)] - 2.5) < .2, 'An upright face marks its top');
  assert.ok(sample(upright, .5, 0) < .85);
  // Relief alone: the foot of a 1.6 m plateau is darker than open ground or its top.
  const plateau = bake((x) => x > 0 ? 1.6 : 0);
  assert.ok(sample(plateau, -.4, 0) < sample(plateau, -4, 0) - .05 && sample(plateau, 3, 0) > .95, 'A plateau shades its foot, not its top');
  // Ground under a canopy is covered.
  const canopy = bake(() => 0, field => field.box(-1, 1, -1, 1, 4));
  assert.ok(sample(canopy, 0, 0) < .7, 'Covered ground sees little sky');
});

test('v0.30.0: every environment surface samples the baked occlusion, on every tier', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createEnvironment} = await import('../src/showcase/environment.js');
  const {BAKED_AO_STRENGTH} = await import('../src/showcase/environment-baked-occlusion.js');
  const scene = fixtureScene('ch1-road');
  for (const quality of ['performance', 'high']) {
    const env = createEnvironment(new T.Scene(), scene.state.encounter, {tileSize: 2.5, quality, loadTextures: false, chapter: scene.chapter});
    const stats = env.stats().occlusion;
    assert.ok(stats.width >= 100 && stats.height >= 100 && stats.instances > 50, 'The board and its margin are baked from real scenery');
    assert.ok(stats.mean > .6 && stats.mean < 1 && stats.darkest < stats.mean - .2, `Plausible occlusion (mean ${stats.mean.toFixed(2)})`);
    assert.equal(stats.strength, BAKED_AO_STRENGTH[quality]);
    assert.ok(BAKED_AO_STRENGTH.performance > BAKED_AO_STRENGTH.high, 'Strongest where no screen-space occlusion runs');
    const materials = new Set();
    env.group.traverse(o => {if (o.isMesh && !o.isSkinnedMesh) for (const material of [o.material].flat()) if (material) materials.add(material);});
    const standard = [...materials].filter(m => m.isMeshStandardMaterial && m.userData.environmentFinish !== 'water');
    const shaded = standard.filter(m => m.userData.bakedOcclusion);
    assert.ok(shaded.length >= standard.length * .9, `${shaded.length} of ${standard.length} lit surfaces sample the bake`);
    assert.equal(env.ground.material.userData.bakedOcclusion, 'ground', 'The ground reads only the sky term');
    // The injection lands in Three's real standard shader.
    const material = shaded.find(m => m.userData.bakedOcclusion === 'standing');
    const shader = {uniforms: {}, vertexShader: T.ShaderLib.physical.vertexShader, fragmentShader: T.ShaderLib.physical.fragmentShader};
    material.onBeforeCompile(shader, null);
    assert.match(shader.vertexShader, /vImperiumAoWorld=\(modelMatrix\*imperiumAoPosition\)\.xyz;\s*#include <project_vertex>/);
    assert.match(shader.fragmentShader, /#include <aomap_fragment>\s*\{\s*vec2 aoUv/);
    assert.ok(shader.uniforms.imperiumAoMap.value.isDataTexture && shader.uniforms.imperiumAoStrength.value === BAKED_AO_STRENGTH[quality]);
    assert.match(material.customProgramCacheKey(), /baked-occlusion-v1:standing/);
    env.dispose();
  }
});

function installFakeCanvas() {
  const log = {arcs: 0, draws: 0};
  class FakeCanvas {
    constructor(width, height) {this.width = width;this.height = height;}
    getContext() {
      const gradient = {addColorStop() {}};
      return new Proxy({createRadialGradient: () => gradient, createLinearGradient: () => gradient, arc: () => {log.arcs++;}, drawImage: () => {log.draws++;}, getImageData: () => ({data: [0, 0, 0, 255]})}, {get: (target, key) => key in target ? target[key] : () => undefined, set: () => true});
    }
  }
  const previous = globalThis.OffscreenCanvas;globalThis.OffscreenCanvas = FakeCanvas;
  return {log, restore() {if (previous === undefined) delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas = previous;}};
}

test('v0.30.0: followers play the leader’s own pose a moment late, never in unison', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createPoseHistory, POSE_BANK_DELAYS, poseBank, createSkinnedCrowd, formationSlots} = await import('../src/showcase/formation.js');
  // A two-bone source whose first bone rises with time.
  const bones = [new T.Bone(), new T.Bone()];bones[0].add(bones[1]);
  const source = new T.Skeleton(bones), history = createPoseHistory(source);
  const pose = t => {bones[0].position.y = t;bones[0].updateMatrixWorld(true);source.update();};
  for (const t of [0, .05, .1, .15, .2, .25, .3, .35, .4]) {pose(t);history.setTime(t);history.skeleton.update();}
  const heightIn = b => history.skeleton.boneMatrices[b * history.bones * 16 + 13];
  assert.ok(Math.abs(heightIn(0) - .4) < 1e-6, 'Bank 0 is the leader now');
  for (let b = 1; b < POSE_BANK_DELAYS.length; b++) assert.ok(heightIn(b) < heightIn(b - 1) && heightIn(b) >= .4 - POSE_BANK_DELAYS[b] - .05 - 1e-6, `Bank ${b} is ${POSE_BANK_DELAYS[b]} s behind`);
  history.reset();pose(.5);history.setTime(.45);history.skeleton.update();
  assert.ok([0, 1, 2, 3].every(b => Math.abs(heightIn(b) - .5) < 1e-6), 'A reset (jump, pose reset) starts every bank from the present');
  assert.ok(history.skeleton.boneTexture.image.width * history.skeleton.boneTexture.image.height * 4 >= 2 * 16 * POSE_BANK_DELAYS.length, 'The bone texture holds every bank');
  // Banks are fixed per unit and slot, and a rank uses more than one.
  assert.equal(poseBank('ally3', 2), poseBank('ally3', 2));
  assert.ok(new Set([0, 1, 2, 3, 4, 5, 6, 7].map(i => poseBank('ally3', i))).size > 1);
  // A real formation: shaders read the bank, and men leaving the rank are reported where they stood.
  const {createActor} = await import('../src/showcase/actors.js');
  const unit = {id: 'ally3', name: 'Legion cohort', role: 'infantry', side: 'ally', x: 2, y: 3, facing: 'north', hp: 24, maxHp: 24};
  const actor = createActor(unit, {chapter: 7, quality: 'high'}), crowd = createSkinnedCrowd(actor.group, {max: 5});
  const slots = formationSlots(unit), fallen = [];
  crowd.update({slots, visible: 5, time: 0, unitId: unit.id});
  crowd.update({slots, visible: 3, time: .1, unitId: unit.id, onFall: f => fallen.push(f)});
  assert.deepEqual(fallen.map(f => f.index), [3, 4], 'The rear men fall first');
  assert.ok(fallen.every(f => f.world.isVector3 && Number.isFinite(f.yaw)));
  const banks = crowd.meshes[0].geometry.attributes.crowdBank;
  assert.deepEqual([0, 1, 2].map(i => banks.getX(i)), [0, 1, 2].map(i => poseBank(unit.id, i)));
  const material = crowd.meshes[0].material, shader = {uniforms: {}, vertexShader: T.ShaderLib.physical.vertexShader, fragmentShader: T.ShaderLib.physical.fragmentShader};
  material.onBeforeCompile(shader, null);
  assert.ok(Number.isInteger(material.defines.CROWD_BONES) && material.defines.CROWD_BONES > 10);
  assert.match(shader.vertexShader, /attribute float crowdBank;/);
  assert.match(shader.vertexShader, /getBoneMatrix\(skinIndex\.x\+crowdBoneBase\)/);
  assert.ok(crowd.meshes.every(m => m.skeleton.boneTexture && m.skeleton.boneMatrices.length >= m.material.defines.CROWD_BONES * 16 * POSE_BANK_DELAYS.length), 'Each surface’s bone texture holds every bank of its own skeleton');
  crowd.dispose();actor.dispose();
});

test('v0.30.0: the fallen lie low and stay; spent arrows stand clear of their mark', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createActor} = await import('../src/showcase/actors.js');
  const {createBattleRemains, sculptedFallenKind, arrowLanding, REMAINS_LIMIT, ARROW_LIMIT} = await import('../src/showcase/battle-remains.js');
  for (const unit of [{id: 'enemy2', name: 'Gothic raider', role: 'raider', side: 'enemy', hp: 0, maxHp: 10}, {id: 'ally5', name: 'Horse', role: 'cavalry', side: 'ally', hp: 0, maxHp: 18}]) {
    const actor = createActor(unit, {chapter: 7}), standing = new T.Box3().setFromObject(actor.group);
    actor.update({motion: 'idle', unit, reducedMotion: true, direction: 1.2});
    const fallen = actor.bakeFallen();
    assert.ok(fallen?.attributes.position.count > 100, `${unit.role} bakes a body`);
    const box = fallen.boundingBox, height = box.max.y - box.min.y;
    assert.ok(Math.abs(box.min.y - .02) < 1e-3 && height < (unit.role === 'cavalry' ? 1.7 : 1.05), `${unit.role} lies low (${height.toFixed(2)} m)`);
    const colors = fallen.attributes.color.array;let brightest = 0;for (const c of colors) brightest = Math.max(brightest, c);
    assert.ok(brightest < .75, 'The fallen are darkened');
    assert.equal(actor.group.rotation.y, 1.2, 'Baking leaves the living figure as it was');
    actor.dispose();
  }
  const scene = new T.Scene(), remains = createBattleRemains(scene, {quality: 'balanced', heightAt: () => 0});
  const actor = createActor({id: 'enemy1', role: 'infantry', side: 'enemy', hp: 5, maxHp: 10}, {chapter: 7});
  const kind = {key: 'sculpted:infantry:enemy', make: sculptedFallenKind(actor)};
  for (let i = 0; i < REMAINS_LIMIT.balanced + 3; i++) remains.fall({...kind, world: new T.Vector3(i * .5, 0, 0), yaw: i, animate: false});
  assert.equal(remains.stats().bodies, REMAINS_LIMIT.balanced, 'Bodies are capped, oldest first');
  assert.equal(remains.stats().kinds, 1, 'One baked body serves every man of that kind');
  const defeated = {id: 'enemy7', x: 3, y: 3, hp: 0};
  assert.ok(remains.layUnit(defeated, {...kind, world: new T.Vector3(1, 0, 1)}));
  assert.equal(remains.layUnit(defeated, {...kind, world: new T.Vector3(1, 0, 1)}), null, 'A defeated unit is laid once');
  const laid = remains.group.children.find(c => c.isInstancedMesh && c.name.startsWith('fallen'));
  assert.ok(laid && laid.raycast() === undefined && !laid.castShadow, 'The fallen never take a pick or throw a shadow');
  // Arrows: deterministic, clear of the man at the mark, leaning back toward the archer.
  const from = {x: -8, z: 0}, to = {x: 0, z: 0};
  for (let i = 0; i < 20; i++) {
    const a = arrowLanding(from, to, i, 'volley'), b = arrowLanding(from, to, i, 'volley');
    assert.deepEqual(a, b);assert.ok(Math.hypot(a.x, a.z) >= .42 - 1e-9 && Math.hypot(a.x, a.z) <= 1.2 + 1e-9);
    assert.ok(a.axis.x < 0 && a.axis.y > .5, 'Shafts lean back toward the shooter');
  }
  for (let i = 0; i < 9; i++) remains.arrows({from: new T.Vector3(-8, 1, 0), to: new T.Vector3(0, 0, 0), count: 9, seed: `v${i}`});
  assert.equal(remains.stats().arrows, ARROW_LIMIT, 'Spent arrows are capped');
  remains.setVisible(false);assert.equal(remains.group.visible, false);assert.equal(remains.wear.battleWearStrength.value, 0, 'The setting hides bodies, arrows and wear');
  remains.dispose();actor.dispose();assert.equal(scene.children.length, 0);
});

test('v0.30.0: marching and fighting wear the ground through its own shader', async () => {
  const T = await import('../vendor/three/three.module.js');
  const fake = installFakeCanvas();
  try {
    const {createBattleRemains, WEAR_PIXELS_PER_METRE} = await import('../src/showcase/battle-remains.js');
    const ground = new T.Mesh(new T.PlaneGeometry(10, 10), new T.MeshStandardMaterial()), key = ground.material.customProgramCacheKey();
    const remains = createBattleRemains(new T.Scene(), {ground, bounds: {minX: -12, maxX: 12, minZ: -10, maxZ: 10}});
    assert.deepEqual(remains.stats().wear, {width: 24 * WEAR_PIXELS_PER_METRE, height: 20 * WEAR_PIXELS_PER_METRE});
    const shader = {uniforms: {}, vertexShader: T.ShaderLib.physical.vertexShader, fragmentShader: T.ShaderLib.physical.fragmentShader};
    ground.material.onBeforeCompile(shader, null);
    assert.match(shader.fragmentShader, /#include <color_fragment>\s*vec2 wearUv/);
    assert.ok(shader.uniforms.battleWearMap.value.isCanvasTexture);
    assert.match(ground.material.customProgramCacheKey(), /battle-wear-v1/);
    const version = shader.uniforms.battleWearMap.value.version;
    assert.ok(remains.tread(1, 1, {dt: 1 / 60}) && remains.churn(0, 0));
    assert.equal(remains.tread(40, 40), false, 'Off the board leaves no mark');
    remains.update(1);assert.ok(shader.uniforms.battleWearMap.value.version > version, 'Wear uploads once it changes');
    const uploaded = shader.uniforms.battleWearMap.value.version;remains.tread(2, 2);remains.update(1.1);
    assert.equal(shader.uniforms.battleWearMap.value.version, uploaded, 'Uploads are throttled');
    remains.dispose();assert.equal(ground.material.customProgramCacheKey(), key, 'Disposal restores the ground’s own shader');
  } finally {fake.restore();}
});

test('v0.30.0: the stage marks the ground on the timeline’s clock and lays out the defeated once', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {BattleStage} = await import('../src/showcase/stage.js');
  const calls = [];
  const remains = {laid: new Set(), arrows: o => calls.push(['arrow', o.size, o.seed]), churn: (x, z) => calls.push(['churn', +x.toFixed(2), +z.toFixed(2)]),
    hasLaid(id) {return this.laid.has(id);}, layUnit(unit, o) {this.laid.add(unit.id);calls.push(['lay', unit.id, o.key, o.animate]);}};
  const encounter = {width: 4, height: 4, units: []};
  const stage = Object.assign(Object.create(BattleStage.prototype), {remains, encounter, environment: {groundHeight: () => 0}, reducedMotion: false});
  const shot = {type: 'projectile', projectile: 'arrow', from: {x: 0, y: 0}, to: {x: 3, y: 0}, start: 310, duration: 230};
  const blow = {type: 'impact', at: {x: 3, y: 0}, start: 540, duration: 230};
  stage.animation = {marks: [shot, blow].map(fx => ({fx, at: fx.type === 'projectile' ? fx.start + fx.duration : fx.start, done: false}))};
  stage.markGround(500);assert.deepEqual(calls, [], 'Nothing lands mid-flight');
  stage.markGround(545);assert.deepEqual(calls.map(c => c[0]), ['arrow', 'churn'], 'The arrow lands as its flight ends and the blow churns the ground');
  stage.markGround(Infinity);assert.equal(calls.length, 2, 'Each mark happens once');
  // A defeated military unit is laid out once its fall has played; civic figures and the living are not.
  calls.length = 0;
  const actor = {group: new T.Group(), painted: false};actor.group.userData.actor = {faction: 'Gothic', mounted: false};
  stage.animation = null;
  stage.layFallen({id: 'enemy4', role: 'raider', side: 'enemy', hp: 0}, actor);
  stage.layFallen({id: 'enemy4', role: 'raider', side: 'enemy', hp: 0}, actor);
  stage.layFallen({id: 'enemy5', role: 'raider', side: 'enemy', hp: 3}, actor);
  stage.layFallen({id: 'member1', role: 'voter', side: 'neutral', hp: 0}, actor);
  assert.deepEqual(calls, [['lay', 'enemy4', 'sculpted:raider:enemy:Gothic:foot', false]], 'Laid once, without a fall animation when no motion is playing');
  assert.equal(stage.fallenKind({id: 'ally2', role: 'archer', side: 'ally'}, {painted: true}).key, 'painted:ally2', 'Painted units lie in their own painting');
});

test('v0.30.0: painted figures are lit by the scene, shaded from one sunward point and gently puppeted', async () => {
  const T = await import('../vendor/three/three.module.js');
  const fake = installFakeCanvas();
  try {
    const {createPaintedActor, createPaintedLighting, PAINTED_SHADING} = await import('../src/showcase/painted-actor.js');
    const lighting = createPaintedLighting(), unit = {id: 'ally2', name: 'Legion cohort', role: 'infantry', side: 'ally', hp: 10, maxHp: 10, facing: 'east'};
    const actor = createPaintedActor(unit, {chapter: 7, light: [1, .9, .8], lighting});
    const card = actor.group.children.find(c => c.name === 'painted figure card');
    assert.ok(actor.material.isMeshLambertMaterial && actor.material.emissiveMap === actor.material.map, 'Lit paint keeps a share of its own light');
    assert.ok(Math.abs(actor.material.emissive.r - PAINTED_SHADING.self) < 1e-6 && card.receiveShadow, 'Cards take shade from walls and buildings');
    actor.setLight([.5, .5, .5]);assert.ok(Math.abs(actor.material.emissive.g - .5 * PAINTED_SHADING.self) < 1e-6, 'Night dims the self-lit share');
    assert.ok(card.geometry.parameters.widthSegments >= 4 && card.geometry.parameters.heightSegments >= 8, 'The card has joints to bend');
    const shader = {uniforms: {}, vertexShader: T.ShaderLib.lambert.vertexShader, fragmentShader: T.ShaderLib.lambert.fragmentShader};
    actor.material.onBeforeCompile(shader, null);
    assert.ok(shader.uniforms.paintedSunShift === lighting.paintedSunShift, 'One sun offset is shared by every painted figure');
    assert.match(shader.vertexShader, /worldPosition\.xyz\+=vec3\(0\.0,1\.0,0\.0\)\+paintedSunShift;\s*#endif\s*#include <shadowmap_vertex>/, 'The shadow is read from a point just sunward of the figure');
    assert.match(shader.vertexShader, /puppetBreath/);
    assert.match(shader.fragmentShader, /normal=normalize\(vec3\(-paintSlope,1\.0\)\);/, 'Paint edges bevel the normal');
    assert.match(shader.fragmentShader, /dot\( geometryNormal, directLight\.direction \) \+ PAINTED_WRAP/, 'Light wraps past the terminator');
    assert.equal(actor.material.defines.PAINTED_WRAP, PAINTED_SHADING.wrap.toFixed(2));
    // Puppetry follows the timeline's motion and freezes with reduced motion.
    actor.update({motion: 'attack', phase: .5, time: 3, unit});assert.ok(Math.abs(actor.puppet.puppetLean.value - 1) < 1e-9 && actor.puppet.puppetTime.value === 3);
    actor.update({motion: 'hit', phase: .5, time: 3, unit});assert.ok(actor.puppet.puppetHit.value > .99 && actor.puppet.puppetLean.value === 0);
    actor.update({motion: 'idle', time: 3, reducedMotion: true, unit});assert.equal(actor.puppet.puppetTime.value, 0);
    const camera = new T.PerspectiveCamera();camera.position.set(10, 8, 10);camera.lookAt(0, 0, 0);
    actor.update({direction: Math.PI / 2, unit});actor.faceCamera(camera);const facing = actor.puppet.puppetFacing.value;
    actor.update({direction: -Math.PI / 2, unit});actor.faceCamera(camera);
    assert.equal(actor.puppet.puppetFacing.value, -facing, 'A figure leans toward the side it faces on screen');
    const crowd = actor.createCrowd(4);assert.ok(actor.group.children.find(c => c.name === 'painted formation followers').receiveShadow);
    crowd.dispose();actor.dispose();
  } finally {fake.restore();}
});

test('v0.30.0: blows carry weight: blade trails, whole-rank volleys, thrown dust, a held beat and a camera jolt', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createCombatEffects, volleyPose, TRAIL_SECONDS, VOLLEY_LIMIT} = await import('../src/showcase/combat-effects.js');
  // A follower's shot: from the shooter, over an arc, to a scattered point by the mark.
  const from = new T.Vector3(0, 1.35, 0), to = new T.Vector3(10, 0, 0);
  const start = volleyPose(from, to, 0, {index: 2, seed: 'v'}), apex = volleyPose(from, to, .5, {index: 2, seed: 'v'}), end = volleyPose(from, to, 1, {index: 2, seed: 'v'});
  assert.ok(start.position.distanceTo(from) < 1e-6 && end.position.distanceTo(end.target) < 1e-6);
  assert.ok(end.target.distanceTo(to) >= .25 - 1e-9 && end.target.distanceTo(to) <= 1.05 + 1e-9, 'Shots scatter about the mark');
  assert.ok(apex.position.y > start.position.y && apex.direction.x > .9, 'Shots arc and fly nose first');
  assert.deepEqual(volleyPose(from, to, .3, {index: 1, seed: 'k'}), volleyPose(from, to, .3, {index: 1, seed: 'k'}));
  const scene = new T.Scene(), fx = createCombatEffects(scene, {quality: 'high'});
  fx.update(0);fx.trail('ally1', new T.Vector3(0, 1.5, 0), new T.Vector3(0, 1.2, 0));fx.update(.04);fx.trail('ally1', new T.Vector3(.3, 1.3, .1), new T.Vector3(.1, 1.1, 0));fx.update(.05);
  assert.equal(fx.stats().trails, 1, 'A swing leaves a ribbon');
  fx.update(.05 + TRAIL_SECONDS + .01);assert.equal(fx.stats().trails, 0, 'The ribbon fades within a sixth of a second');
  assert.equal(fx.volley(Array.from({length: 40}, (_, i) => ({from, to, progress: .4, index: i, seed: 's'}))), VOLLEY_LIMIT, 'Volleys are capped');
  assert.equal(fx.volley([]), 0);
  fx.dust(1, 0, 1, {amount: 3, seed: 'h'});fx.update(.5);assert.equal(fx.stats().dust, 3);fx.update(1.4);assert.equal(fx.stats().dust, 0, 'Dust settles');
  assert.ok(fx.group.children.every(c => c.raycast() === undefined), 'Effects never take a pick');
  fx.dispose();assert.equal(scene.children.length, 0);
  // The stage: a landed blow holds the motion (capped) and jolts the camera unless the action camera is off.
  const {BattleStage} = await import('../src/showcase/stage.js');
  const arrows = [], stage = Object.assign(Object.create(BattleStage.prototype), {remains: {arrows: o => arrows.push(o.count), churn() {}}, encounter: {width: 4, height: 4, units: []}, environment: {groundHeight: () => 0}, reducedMotion: false, actionCamera: true, cameraKick: 0});
  const blow = at => ({fx: {type: 'impact', at: {x: 1, y: 1}, start: at, duration: 200}, at, done: false});
  stage.animation = {start: 1000, marks: [blow(100), blow(200), blow(300), blow(400), {fx: {type: 'projectile', projectile: 'arrow', from: {x: 0, y: 0}, to: {x: 2, y: 0}, start: 0, duration: 300}, at: 300, done: false, volley: 4}]};
  stage.markGround(150);assert.equal(stage.animation.start, 1070, 'A blow holds the motion for 70 ms');assert.ok(stage.cameraKick > .7);
  stage.markGround(1000);assert.equal(stage.animation.hitStop, 220, 'Held beats are capped per motion');assert.deepEqual(arrows, [5], 'The whole rank’s spent shots land together');
  stage.actionCamera = false;stage.cameraKick = 0;stage.animation = {start: 0, marks: [blow(10)]};stage.markGround(20);assert.equal(stage.cameraKick, 0, 'No jolt without the action camera');
  stage.reducedMotion = true;stage.animation = {start: 0, marks: [blow(10)]};stage.markGround(20);assert.equal(stage.animation.start, 0, 'Reduced motion never holds or jolts');
});

test('v0.30.0: faint cloud shadows drift over ground, scenery and figures alike', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {CLOUD_UNIFORMS, cloudStrength, cloudWind, installCloudShadows, sampleCloudShade} = await import('../src/showcase/atmosphere.js');
  assert.ok(cloudStrength({weather: 'clear', timeOfDay: 'day'}) > .15 && cloudStrength({weather: 'clear', timeOfDay: 'day'}) <= .25, 'Faint on a clear day');
  for (const profile of [{weather: 'rain'}, {timeOfDay: 'night'}, {timeOfDay: 'interior'}, {civic: true}, {weather: 'embers'}]) assert.equal(cloudStrength(profile), 0, `No cloud shadows for ${JSON.stringify(profile)}`);
  assert.deepEqual(cloudWind(7), cloudWind(7));
  const shades = [];for (let x = -40; x <= 40; x += 4) for (let z = -40; z <= 40; z += 4) shades.push(sampleCloudShade(x, z, 0));
  assert.ok(Math.min(...shades) < .9 && Math.max(...shades) === 1 && shades.every(v => v >= 1 - .22 - 1e-9), 'Patches of shade, never deeper than the strength');
  const later = [];for (let x = -40; x <= 40; x += 4) for (let z = -40; z <= 40; z += 4) later.push(sampleCloudShade(x, z, 400));
  assert.notDeepEqual(later, shades, 'The field drifts with time');
  const material = new T.MeshStandardMaterial();assert.ok(installCloudShadows(material));assert.equal(installCloudShadows(material), false, 'Installed once');
  const shader = {uniforms: {}, vertexShader: T.ShaderLib.physical.vertexShader, fragmentShader: T.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader, null);
  assert.equal(shader.uniforms.cloudTime, CLOUD_UNIFORMS.cloudTime, 'One clock for every lit surface');
  assert.match(shader.fragmentShader, /#include <lights_fragment_end>\s*if\(cloudStrength>0\.0\)/);
  assert.match(shader.fragmentShader, /reflectedLight\.directDiffuse\*=cloudShade;/, 'Only direct light is dimmed');
  // Ground, scenery, sculpted and painted figures all take the same shadows.
  const {createEnvironment} = await import('../src/showcase/environment.js');
  const {createActor} = await import('../src/showcase/actors.js');
  const scene = fixtureScene('ch9-city'), env = createEnvironment(new T.Scene(), scene.state.encounter, {tileSize: 2.5, quality: 'balanced', loadTextures: false, chapter: scene.chapter});
  assert.equal(env.ground.material.userData.cloudShadows, true);
  const actor = createActor({id: 'ally1', role: 'infantry', side: 'ally', hp: 10, maxHp: 10}, {chapter: 9});
  let lit = 0, clouded = 0;actor.group.traverse(o => {if (o.isMesh && o.material?.isMeshStandardMaterial) {lit++;if (o.material.userData.cloudShadows) clouded++;}});
  assert.ok(clouded >= lit * .9, `${clouded} of ${lit} figure surfaces take cloud shade`);
  actor.dispose();env.dispose();
});

test('v0.30.0: sun shafts slant through dawn, mist and halls; board water mirrors the scene on High', async () => {
  const T = await import('../vendor/three/three.module.js');
  const {createLightShafts, shaftsWanted, SHAFT_COUNT} = await import('../src/showcase/atmosphere.js');
  assert.equal(shaftsWanted({timeOfDay: 'day', weather: 'clear'}), false);
  assert.ok(shaftsWanted({timeOfDay: 'dawn'}) && shaftsWanted({weather: 'mist'}) && shaftsWanted({timeOfDay: 'interior'}));
  assert.equal(createLightShafts(new T.Scene(), {timeOfDay: 'day', weather: 'clear'}), null);
  const scene = new T.Scene(), bounds = {minX: -10, maxX: 10, minZ: -10, maxZ: 10};
  for (const quality of ['performance', 'balanced', 'high']) {
    const shafts = createLightShafts(scene, {timeOfDay: 'dawn', weather: 'mist'}, {quality, bounds, sunDirection: new T.Vector3(-.4, .8, -.3), seed: 8});
    assert.equal(shafts.count, SHAFT_COUNT[quality]);
    for (const mesh of shafts.group.children.filter(c => c.name === 'sun shaft')) assert.ok(Math.hypot(mesh.position.x, mesh.position.z) >= 10 * .85 - 1e-9, 'Outdoors, shafts fall on the margins, not on the board’s centre');
    if (shafts.motes) {const motes = shafts.group.children.find(c => c.name === 'shaft motes'), before = [...motes.geometry.attributes.position.array];shafts.update(5, {reducedMotion: true});assert.deepEqual([...motes.geometry.attributes.position.array], before, 'Reduced motion holds the motes still');shafts.update(5);assert.notDeepEqual([...motes.geometry.attributes.position.array], before);}
    assert.ok(shafts.group.children.every(c => c.raycast() === undefined));
    shafts.dispose();
  }
  assert.equal(scene.children.length, 0);
  // The mirror: a camera reflected in the water's plane with an oblique near plane.
  const {mirrorCamera, createWaterReflection, reflectionAvailable, REFLECTION_SCALE} = await import('../src/showcase/water-reflection.js');
  const camera = new T.PerspectiveCamera(40, 1.5, .1, 800);camera.position.set(6, 14, 12);camera.lookAt(0, 0, 0);camera.updateMatrixWorld();
  const level = -.42, mirror = mirrorCamera(camera, level);
  assert.ok(Math.abs(mirror.position.y - (2 * level - 14)) < 1e-6 && Math.abs(mirror.position.x - 6) < 1e-6, 'The eye is reflected in the water plane');
  assert.notEqual(mirror.projectionMatrix.elements[10], camera.projectionMatrix.elements[10], 'Nothing below the surface leaks in');
  const below = new T.PerspectiveCamera();below.position.set(0, -2, 0);below.updateMatrixWorld();assert.equal(mirrorCamera(below, level), null);
  assert.equal(reflectionAvailable({extensions: {has: () => true}}, 'balanced'), false, 'High quality only');
  const uniforms = {waterReflectionMap: {value: null}, waterReflectionMatrix: {value: new T.Matrix4()}, waterReflectionStrength: {value: 0}};
  const hiddenDuring = [], water = new T.Mesh(), overlay = new T.Group();
  const clears = [], scene3 = new T.Scene();scene3.background = new T.Color('#88aacc');
  const renderer = {info: {autoReset: true}, getDrawingBufferSize: v => v.set(1200, 800), getRenderTarget: () => null, setRenderTarget() {}, clear() {}, getClearAlpha: () => 1, getClearColor: c => c.set('#123456'), setClearColor: (c, a) => clears.push(a), render(scene) {hiddenDuring.push(water.visible, overlay.visible, scene.background);}};
  const reflection = createWaterReflection(renderer, uniforms, {level, hide: () => [water, overlay]});
  assert.ok(reflection.render(scene3, camera));
  assert.deepEqual(hiddenDuring, [false, false, null], 'Water, overlays and the sky are left out of the mirror');
  assert.deepEqual(clears, [0, 1], 'The mirror clears transparent, then the renderer’s clear is restored');assert.equal(scene3.background.getHexString(), '88aacc');
  assert.ok(water.visible && overlay.visible, '...and restored');
  assert.equal(reflection.target.width, 1200 * REFLECTION_SCALE);assert.equal(uniforms.waterReflectionStrength.value, 1);
  reflection.dispose();assert.equal(uniforms.waterReflectionStrength.value, 0);
  // Board water reads the mirror, capped like the sky reflection it replaces.
  const {finishEnvironmentMaterial} = await import('../src/showcase/environment-surface-shaders.js');
  const river = new T.MeshStandardMaterial({vertexColors: true, transparent: true});finishEnvironmentMaterial(river, 'water', {shore: true, reflection: uniforms});
  const shader = {uniforms: {}, vertexShader: T.ShaderLib.physical.vertexShader, fragmentShader: T.ShaderLib.physical.fragmentShader};river.onBeforeCompile(shader, null);
  assert.match(shader.fragmentShader, /vec4 mirrored=texture2D\(waterReflectionMap,/);
  assert.match(shader.fragmentShader, /waterReflectionStrength\*mirrorFresnel\*clamp\(mirrored\.a,0\.0,1\.0\)/, 'Only covered texels are mirrored; open water keeps the sky');
  assert.ok(shader.uniforms.waterReflectionMatrix === uniforms.waterReflectionMatrix);
  const danube = new T.MeshStandardMaterial({transparent: true});finishEnvironmentMaterial(danube, 'water', {});
  const plain = {uniforms: {}, vertexShader: T.ShaderLib.physical.vertexShader, fragmentShader: T.ShaderLib.physical.fragmentShader};danube.onBeforeCompile(plain, null);
  assert.doesNotMatch(plain.fragmentShader, /waterReflectionMap/, 'Distant water keeps the sky alone');
  const {createEnvironment} = await import('../src/showcase/environment.js');
  const env = createEnvironment(new T.Scene(), fixtureScene('ch8-crossing').state.encounter, {tileSize: 2.5, quality: 'high', loadTextures: false, chapter: 8});
  assert.equal(env.reflectionLevel, -.42);assert.equal(env.waterMeshes.length, 1);env.dispose();
});
