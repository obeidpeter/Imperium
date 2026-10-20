import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {CONFIG} from '../src/config.js';
import {IMPERIUM_TRIPO_CATALOG, getTripoCatalogEntry, generateTripoAsset} from '../scripts/pipeline/tripo-client.mjs';
import {detectLocalTools} from '../scripts/pipeline/orchestrate.mjs';
import {AQUILA_MODEL_URL, createAquilaAssetLibrary} from '../src/showcase/aquila-asset.js';
import {createActor} from '../src/showcase/actors.js';

function parseGlb(bytes) {
  return new Promise((resolve, reject) => {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    new GLTFLoader().parse(buffer, '', resolve, reject);
  });
}

test('v0.29.0: Tripo 3D API client submits text_to_model tasks, supports animate_rig, and downloads GLB assets', async () => {
  assert.equal(CONFIG.version, '0.29.0');
  const entry = getTripoCatalogEntry('roman-aquila-v029');
  assert.ok(entry);
  assert.equal(entry.outputPath, 'assets/models/roman-aquila-v029.glb');
  assert.ok(Object.keys(IMPERIUM_TRIPO_CATALOG).length >= 4);

  const calls = [];
  const fakeGlb = Buffer.from('glTF-mock-binary');
  const mockFetch = async (url, init = {}) => {
    calls.push({url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null});
    if (url.endsWith('/task') && init.method === 'POST') {
      const payload = JSON.parse(init.body);
      const id = payload.type === 'animate_rig' ? 'task-rig-456' : 'task-draft-123';
      return {ok: true, json: async () => ({code: 0, data: {task_id: id}})};
    }
    if (url.includes('/task/task-draft-123')) {
      return {ok: true, json: async () => ({code: 0, data: {status: 'success', progress: 100, output: {pbr_model: 'https://tripo.example/draft.glb'}}})};
    }
    if (url.includes('/task/task-rig-456')) {
      return {ok: true, json: async () => ({code: 0, data: {status: 'success', progress: 100, output: {model: 'https://tripo.example/rigged.glb'}}})};
    }
    if (url === 'https://tripo.example/rigged.glb') {
      return {ok: true, arrayBuffer: async () => fakeGlb};
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await generateTripoAsset({
    preset: 'roman-aquila-v029',
    autoRig: true,
    apiKey: 'tsk_test_key',
    fetchImpl: mockFetch,
    intervalMs: 5,
  });

  assert.equal(result.draftTaskId, 'task-draft-123');
  assert.equal(result.taskId, 'task-rig-456');
  assert.equal(result.bytes, fakeGlb.length);
  assert.equal(calls.filter(c => c.method === 'POST').length, 2);
});

test('v0.29.0: Blender 5.2 rigged Roman Aquila GLB asset (roman-aquila-v029.glb) is valid, provenance-tracked, and mounts on 3D actors', async () => {
  const tools = detectLocalTools();
  assert.equal(typeof tools.tripoConfigured, 'boolean');

  const glbPath = path.resolve(AQUILA_MODEL_URL);
  const bytes = await fs.readFile(glbPath);
  assert.ok(bytes.length > 1000, 'Expected non-empty Blender GLB binary');

  // Verify asset-manifest.json provenance matches the exact file bytes and SHA-256
  const manifest = JSON.parse(await fs.readFile(path.resolve('docs/asset-manifest.json'), 'utf8'));
  const record = manifest.assets.find(a => a.id === 'roman-aquila-v029');
  assert.ok(record, 'roman-aquila-v029 is registered in docs/asset-manifest.json');
  assert.equal(record.export.bytes, bytes.length);
  assert.equal(record.export.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(record.export.joints, 3);

  // Parse the GLB using Three.js GLTFLoader and verify mesh + 3-bone skeleton
  const library = createAquilaAssetLibrary(() => parseGlb(bytes));
  const warmed = await library.warm();
  assert.equal(warmed, true);
  assert.equal(library.status().ready, true);
  assert.deepEqual(library.bones(), ['base', 'shaft', 'eagle']);
  const geom = library.geometry();
  assert.ok(geom);
  assert.ok(geom.attributes.position.count >= 100);

  // Verify 3D actor mounts the imported Blender Aquila geometry when signum === 'aquila'
  const eagleBearer = {id: 'escort-aquila', name: 'Eagle-bearer cohort', side: 'neutral', role: 'escort'};
  const actor = createActor(eagleBearer, {chapter: 4, aquilaLibrary: library});
  const signum = actor.group.getObjectByName('actor-signum');
  assert.ok(signum, 'Eagle-bearer mounts actor-signum');
  assert.equal(signum.userData.importedAquila, true);
  assert.equal(actor.group.userData.actor.aquilaImported, true, 'Mounts imported Blender Aquila mesh');
  actor.dispose();
});
