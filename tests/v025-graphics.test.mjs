import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {CONFIG} from '../src/config.js';
import {COMPOSITOR_TIERS, evaluateCompositorGrade, createSceneCompositor} from '../src/showcase/scene-compositor.js';
import {sampleWaterSurface, finishEnvironmentMaterial} from '../src/showcase/environment-surface-shaders.js';
import {createEnvironmentMaterials} from '../src/showcase/environment-materials.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {evaluateActorShading, finishActorMaterial} from '../src/showcase/actor-surface.js';
import {createActor} from '../src/showcase/actors.js';
import {createFlamePlume, sampleFlamePlume} from '../src/showcase/stage-particles.js';
import {BattleStage} from '../src/showcase/stage.js';
import {paintBattle, drawFieldwork} from '../src/ui/battle-art.js';
import {atmosphere} from '../src/ui/world-art.js';

function recordCanvas(width = 640, height = 400) {
  const calls = [];
  const stack = [];
  let state = {globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1};
  const ctx = new Proxy({}, {
    get(_, key) {
      if (key === 'canvas') return {width, height};
      if (key === 'save') return () => stack.push({...state});
      if (key === 'restore') return () => { state = stack.pop() ?? state; };
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return (...args) => {
          calls.push({method: key, args});
          return {addColorStop: (...stops) => calls.push({method: 'addColorStop', args: stops})};
        };
      }
      if (key === 'measureText') return text => ({width: String(text).length * 7});
      if (key in state) return state[key];
      return (...args) => calls.push({method: key, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle});
    },
    set(_, key, value) {
      state[key] = value;
      return true;
    },
  });
  return {width, height, calls, ctx};
}

test('v0.25.0 Lux Imperii: single-pass HDR specular bloom, CAS micro-sharpening, depth aerial perspective, and fresco vignette', () => {
  assert.ok(CONFIG.version >= '0.25.0');
  assert.equal(COMPOSITOR_TIERS.performance.enabled, false);
  assert.equal(COMPOSITOR_TIERS.performance.bloomStrength, 0);
  assert.ok(COMPOSITOR_TIERS.balanced.bloomStrength > 0);
  assert.ok(COMPOSITOR_TIERS.high.bloomStrength > COMPOSITOR_TIERS.balanced.bloomStrength);
  assert.ok(COMPOSITOR_TIERS.high.casStrength > COMPOSITOR_TIERS.balanced.casStrength);
  assert.ok(COMPOSITOR_TIERS.high.aerialStrength > COMPOSITOR_TIERS.balanced.aerialStrength);
  assert.ok(COMPOSITOR_TIERS.high.vignetteStrength > COMPOSITOR_TIERS.balanced.vignetteStrength);

  const perfGrade = evaluateCompositorGrade({color: [0.5, 0.5, 0.5], depthZ: -50, uv: [0.9, 0.9], bloomLuma: 1.5, quality: 'performance'});
  assert.deepEqual(perfGrade.color, [0.5, 0.5, 0.5]);
  assert.equal(perfGrade.bloom, 0);
  assert.equal(perfGrade.aerialMix, 0);
  assert.equal(perfGrade.vignette, 1);

  const nearGrade = evaluateCompositorGrade({color: [0.4, 0.4, 0.4], depthZ: -8, uv: [0.5, 0.5], bloomLuma: 0.4, quality: 'high'});
  const farGrade = evaluateCompositorGrade({color: [0.4, 0.4, 0.4], depthZ: -75, uv: [0.92, 0.92], bloomLuma: 1.6, quality: 'high'});
  assert.ok(farGrade.bloom > nearGrade.bloom, 'Bright HDR highlights produce positive bloom energy');
  assert.ok(farGrade.aerialMix > nearGrade.aerialMix, 'Distant geometry receives atmospheric perspective scatter');
  assert.ok(farGrade.vignette < nearGrade.vignette, 'Screen corners receive subtle Roman fresco vignette');

  const renderer = {
    extensions: {has: name => name === 'EXT_color_buffer_float'},
    capabilities: {maxTextureSize: 4096},
    info: {autoReset: true, reset() {}},
    getDrawingBufferSize: v => v.set(1280, 720),
    getRenderTarget: () => null,
    setRenderTarget() {},
    render() {},
  };
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
  const comp = createSceneCompositor(renderer, camera, {quality: 'high'});
  const stats = comp.stats();
  assert.equal(stats.enabled, true);
  assert.equal(stats.passes, 2);
  assert.equal(stats.temporalHistory, false);
  assert.equal(stats.bloomStrength, COMPOSITOR_TIERS.high.bloomStrength);
  assert.equal(stats.casStrength, COMPOSITOR_TIERS.high.casStrength);
  comp.dispose();
});

test('v0.25.0 Flumen & Vadum: dynamic flow-mapped 3D water, shoreline foam, and concentric rain ripples', () => {
  const calmT0 = sampleWaterSurface(2.4, -1.8, 0, {rain: false, marsh: false});
  const calmT1 = sampleWaterSurface(2.4, -1.8, 1.3, {rain: false, marsh: false});
  assert.notEqual(calmT0.wave, calmT1.wave, 'Scrolling dual-octave current animates over time');
  assert.equal(calmT0.ripple, 0, 'Dry weather has zero rain-ripple disturbance');

  const marshSample = sampleWaterSurface(2.4, -1.8, 0, {rain: false, marsh: true});
  assert.ok(Math.abs(marshSample.wave) <= Math.abs(calmT0.wave) + 1e-9, 'Marsh water damps wave amplitude');
  assert.ok(marshSample.foam <= calmT0.foam + 1e-9, 'Marsh water reduces whitewater foam');

  let maxRipple = 0;
  for (let i = 0; i < 12; i++) {
    const rainy = sampleWaterSurface(0.28, 0.28, i * 0.11, {rain: true, marsh: false});
    maxRipple = Math.max(maxRipple, rainy.ripple);
  }
  assert.ok(maxRipple > 0.1, 'Rain weather generates concentric ripple rings on water surfaces');

  const lib = createEnvironmentMaterials({loadTextures: false, profile: {setting: 'wetland', weather: 'rain', vegetation: 'reeds', waterColor: '#4a6b65', stoneColor: '#8d8778', chapter: 2}});
  assert.equal(lib.materials.water.userData.environmentFinish, 'water');
  assert.equal(lib.materials.marshWater.userData.environmentFinish, 'water');
  assert.equal(lib.materials.water.transparent, true);
  assert.equal(lib.materials.water.depthWrite, false);
  const waterShader = {uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader};
  lib.materials.water.onBeforeCompile(waterShader);
  assert.equal(waterShader.uniforms.environmentWaterTime, lib.waterTime);
  assert.match(waterShader.fragmentShader, /envRainPhase/, 'Rainy water shader includes concentric rain-ripple rings');
  lib.dispose();
});

test('v0.25.0 Ventus & Marmor: subsurface foliage, wet micro-puddle reflections, and veined Senate marble', () => {
  const foliageMat = new THREE.MeshStandardMaterial();
  finishEnvironmentMaterial(foliageMat, 'foliage', {wet: true, rain: true});
  const foliageShader = {uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader};
  foliageMat.onBeforeCompile(foliageShader);
  assert.match(foliageShader.fragmentShader, /envSubsurface/, 'Foliage shader computes warm golden subsurface scattering');

  const groundMat = new THREE.MeshStandardMaterial();
  finishEnvironmentMaterial(groundMat, 'ground', {wet: true, rain: true});
  const groundShader = {uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader};
  groundMat.onBeforeCompile(groundShader);
  assert.match(groundShader.fragmentShader, /envPuddle/, 'Wet ground shader computes low-lying micro-puddle specularity');

  const floorMat = new THREE.MeshStandardMaterial();
  finishEnvironmentMaterial(floorMat, 'floor', {});
  const floorShader = {uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader};
  floorMat.onBeforeCompile(floorShader);
  assert.match(floorShader.fragmentShader, /envVein/, 'Civic floor shader computes swirling marble veining');
  assert.match(floorShader.fragmentShader, /envBronze/, 'Civic floor shader highlights bronze inlay joints');

  const encounter = {id: 'ch2-marsh', kind: 'battle', width: 8, height: 8, terrain: Array.from({length: 8}, () => Array(8).fill('marsh'))};
  const env = createEnvironment(new THREE.Scene(), encounter, {chapter: 2, quality: 'balanced', loadTextures: false});
  env.update(1.75);
  assert.equal(env.ground.material.userData.environmentFinish, 'ground');
  env.dispose();
  foliageMat.dispose();
  groundMat.dispose();
  floorMat.dispose();
});

test('v0.25.0 Lorica & Paludamentum: physically enriched character/armor shaders and banner flutter', () => {
  const skinShade = evaluateActorShading('skin', 0.3, 0.4);
  const clothShade = evaluateActorShading('cloth', 0.5, 0.2);
  const metalShade = evaluateActorShading('metal', 0.8, 0.85);
  assert.ok(skinShade.subsurface > 0.15, 'Skin shading exhibits warm subsurface wrap');
  assert.ok(clothShade.sheen > 0.15, 'Cloth shading exhibits grazing Fresnel velvet sheen');
  assert.ok(metalShade.anisotropy > 0.15, 'Metal shading exhibits directional anisotropic highlight');

  const testMat = new THREE.MeshStandardMaterial();
  finishActorMaterial(testMat, 'mail');
  assert.equal(testMat.userData.actorFinish, 'mail');
  const shader = {uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader};
  testMat.onBeforeCompile(shader);
  // v0.38: one program for every kind; the kind's finish rides in uniforms.
  assert.match(testMat.customProgramCacheKey(), /actor-finish-v038:cloud-shadow-v1$/);
  assert.deepEqual(shader.uniforms.actorFinishRoughness.value.toArray(), [.9, 0, 1]);assert.equal(shader.uniforms.actorFinishGrazing.value, 0);
  assert.match(shader.fragmentShader, /diffuseColor\.rgb\*=actorFinishTint;/);assert.match(shader.fragmentShader, /skinGrazing\*actorFinishGrazing/);
  const skin = new THREE.MeshStandardMaterial(), skinShader = {uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader};
  finishActorMaterial(skin, 'skin');skin.onBeforeCompile(skinShader);
  assert.equal(skin.customProgramCacheKey(), testMat.customProgramCacheKey(), 'Skin and mail share one program');
  assert.deepEqual(skinShader.uniforms.actorFinishRoughness.value.toArray(), [1, .46, .86]);assert.equal(skinShader.uniforms.actorFinishGrazing.value, 1);
  testMat.dispose();skin.dispose();

  const leader = createActor({id: 'ally0', name: 'Lucan', side: 'ally', role: 'legionary', specialization: 'leader', hp: 14, maxHp: 14}, {chapter: 6, kind: 'battle'});
  const signum = leader.group.getObjectByName('actor-signum');
  assert.ok(signum, 'Leader mounts 3D signum');
  leader.update({motion: 'idle', time: 1.4, reducedMotion: false});
  assert.ok(Math.abs(signum.rotation.z) > 0, 'Signum sways in the breeze when reducedMotion is false');
  leader.update({motion: 'idle', time: 1.4, reducedMotion: true});
  assert.equal(signum.rotation.z, 0, 'Signum sway freezes cleanly when reducedMotion is true');
  leader.dispose();
});

test('v0.25.0 Ignis & Ferrum: volumetric brazier flame plumes, projectile trails, and battlefield ground decals', () => {
  const plume = createFlamePlume();
  assert.equal(plume.name, 'brazier-flame-plume');
  assert.equal(plume.geometry.attributes.position.count, 24);
  const pos0 = [...plume.geometry.attributes.position.array];
  sampleFlamePlume(plume, 0.85, {reducedMotion: false});
  const pos1 = [...plume.geometry.attributes.position.array];
  assert.notDeepEqual(pos0, pos1, 'Flame plume particles rise and swirl over time');
  assert.ok(pos1.every(Number.isFinite));

  const stage = Object.create(BattleStage.prototype);
  Object.assign(stage, {
    overlay: new THREE.Group(),
    fieldworkMeshes: new Map(),
    battleDecals: new Map(),
    world: tile => new THREE.Vector3(tile.x * 2.5, 0, tile.y * 2.5),
  });
  const encounter = {
    kind: 'battle',
    fieldworks: [{type: 'brazier', x: 2, y: 3}],
    units: [{id: 'dead0', side: 'enemy', x: 4, y: 4, hp: 0, maxHp: 10}],
    turnEvents: [{kind: 'strike', x: 3, y: 2}],
  };
  stage.updateFieldworks(encounter);
  const brazier = stage.fieldworkMeshes.get('brazier:2,3');
  // v0.38: the brazier borrows the stage's one point light (its warm flicker is set in tick);
  // a light of its own would recompile every lit shader in the middle of a battle.
  assert.ok(brazier?.userData.brazierLightAt?.isVector3 && !brazier.getObjectByProperty('isPointLight', true), 'Brazier fieldwork borrows the pooled warm PointLight');
  assert.ok(brazier?.userData.flamePlume?.isPoints, 'Brazier fieldwork mounts a volumetric flame plume');

  stage.updateBattleDecals(encounter, [{x: 5, y: 1, kind: 'clash'}]);
  assert.equal(stage.battleDecals.size, 3, 'Battle decals mark fallen units, turnEvents clashes, and active impact tiles');
  for (const decal of stage.battleDecals.values()) {
    assert.equal(decal.visible, true);
    assert.equal(decal.name, 'battle-decal');
  }
});

test('v0.25.0 Tabula Picta: 2D isometric fieldworks, enemy threat-envelope hatching, time-of-day grading, and weather particles', () => {
  const g = {ox: 320, oy: 80, tw: 56, th: 28};
  for (const type of ['stakes', 'rampart', 'brazier']) {
    const rec = recordCanvas();
    drawFieldwork(rec.ctx, g, {x: 320, y: 180}, type);
    assert.ok(rec.calls.length >= 3, `2D fieldwork ${type} submits isometric geometry`);
  }

  for (const weather of ['rain', 'embers', 'dust', 'mist']) {
    const rec = recordCanvas();
    atmosphere(rec.ctx, 640, 400, g, 4, false, {time: 300}, 'high', {weather, timeOfDay: 'night'});
    assert.ok(rec.calls.some(c => c.fillStyle === '#0d182834'), 'Night timeOfDay applies moonlight wash');
    assert.ok(rec.calls.length > 20, `Weather ${weather} renders deterministic 2D atmospheric particles`);
  }

  const battle = {
    id: 'ch4-gate',
    kind: 'battle',
    width: 6,
    height: 6,
    weather: 'rain',
    timeOfDay: 'dusk',
    fieldworks: [{type: 'stakes', x: 2, y: 2}, {type: 'rampart', x: 3, y: 2}, {type: 'brazier', x: 1, y: 2}],
    terrain: Array.from({length: 6}, () => Array(6).fill('grass')),
    units: [
      {id: 'hero', name: 'Aurelius', side: 'player', role: 'legionary', x: 2, y: 3, hp: 14, maxHp: 14, move: 3, facing: 'north'},
      {id: 'enemy0', name: 'Raider', side: 'enemy', role: 'raider', x: 2, y: 1, hp: 10, maxHp: 10, move: 3, facing: 'south'},
    ],
  };
  const board = recordCanvas();
  paintBattle(board.ctx, 640, 400, g, battle, 'hero', [], {x: 2, y: 1, unitId: 'enemy0'}, 4, {quality: 'balanced'});
  assert.ok(board.calls.some(c => c.strokeStyle === '#c85a4870'), 'Inspecting an enemy in 2D paints threat-envelope tile hatching');
  assert.ok(board.calls.some(c => c.fillStyle === '#7a5a3a'), '2D board paints stakes fieldwork');
  assert.ok(board.calls.some(c => c.fillStyle === '#7c694c'), '2D board paints rampart fieldwork');
  assert.ok(board.calls.some(c => c.fillStyle === '#ffad48'), '2D board paints brazier fieldwork');
});
