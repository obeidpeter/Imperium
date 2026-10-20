// Tripo 3D API v2 client and Roman asset prompt catalog for Imperium.
// Supports text-to-3D, image-to-3D, and skeleton auto-rigging via api.tripo3d.ai,
// with automatic fallback to headless Blender procedural generation when no API key is set.
import fs from 'node:fs/promises';
import path from 'node:path';

export const TRIPO_API_BASE = 'https://api.tripo3d.ai/v2/openapi';

export const IMPERIUM_TRIPO_CATALOG = Object.freeze({
  'roman-aquila-v029': {
    id: 'roman-aquila-v029',
    title: 'Roman Legionary Aquila Standard & Vexillum',
    prompt: 'Ornate third-century Roman gilded bronze Aquila legionary eagle standard with outstretched wings, laurel wreath, phalerae medallions and crimson vexillum banner on a bronze-shod pole, clean game-ready 3D asset, PBR metallic materials',
    category: 'standard',
    rig: 'standard3',
    targetHeight: 1.45,
    maxTriangles: 1800,
    outputPath: 'assets/models/roman-aquila-v029.glb',
  },
  'senate-curule-chair': {
    id: 'senate-curule-chair',
    title: 'Senatorial Sella Curulis Magistrate Chair',
    prompt: 'Ancient Roman Senatorial Sella Curulis folding curule chair with curved ivory-inlaid legs, bronze lion finials, and imperial purple cushioned seat, clean game-ready 3D prop',
    category: 'prop',
    rig: 'none',
    targetHeight: 0.95,
    maxTriangles: 1400,
    outputPath: 'assets/models/senate-curule-chair.glb',
  },
  'danube-brazier-tripod': {
    id: 'danube-brazier-tripod',
    title: 'Roman Frontier Iron Signal Brazier',
    prompt: 'Roman military forged iron tripod signal brazier with bronze ring handles, slatted fire basket and glowing coal bed, third-century Danube frontier camp prop',
    category: 'fieldwork',
    rig: 'none',
    targetHeight: 1.05,
    maxTriangles: 1200,
    outputPath: 'assets/models/danube-brazier-tripod.glb',
  },
  'legionary-intercisa-helmet': {
    id: 'legionary-intercisa-helmet',
    title: 'Third-Century Roman Intercisa Ridge Helmet',
    prompt: 'Late Roman third-century Intercisa iron ridge helmet with riveted central crest band, gilded bronze brow guard and hinged cheekpieces, game-ready wearable 3D equipment',
    category: 'equipment',
    rig: 'human6',
    targetHeight: 0.32,
    maxTriangles: 1600,
    outputPath: 'assets/models/legionary-intercisa-helmet.glb',
  },
});

export function getTripoCatalogEntry(presetId) {
  return IMPERIUM_TRIPO_CATALOG[presetId] || null;
}

export async function createTripoTask(payload, {apiKey = process.env.TRIPO_API_KEY, fetchImpl = globalThis.fetch} = {}) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error('TRIPO_API_KEY is required to call the live Tripo 3D API.');
  }
  const response = await fetchImpl(`${TRIPO_API_BASE}/task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Tripo task creation failed (${response.status}): ${text}`);
  }
  const json = await response.json();
  if (json.code !== 0 || !json.data?.task_id) {
    throw new Error(`Tripo API error: ${JSON.stringify(json)}`);
  }
  return json.data.task_id;
}

export async function pollTripoTask(taskId, {
  apiKey = process.env.TRIPO_API_KEY,
  fetchImpl = globalThis.fetch,
  intervalMs = 3000,
  timeoutMs = 180000,
  onProgress = null,
} = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetchImpl(`${TRIPO_API_BASE}/task/${encodeURIComponent(taskId)}`, {
      headers: {Authorization: `Bearer ${apiKey.trim()}`},
    });
    if (!response.ok) {
      throw new Error(`Tripo task poll failed (${response.status})`);
    }
    const json = await response.json();
    const data = json.data || {};
    if (onProgress) onProgress({taskId, status: data.status, progress: data.progress ?? 0});
    if (data.status === 'success') {
      const modelUrl = data.output?.pbr_model || data.output?.model || data.output?.base_model || data.result?.pbr_model?.url || data.result?.model?.url;
      if (!modelUrl) throw new Error(`Tripo task succeeded but returned no GLB URL: ${JSON.stringify(data)}`);
      return {taskId, status: 'success', modelUrl, output: data.output || data.result};
    }
    if (['failed', 'cancelled', 'expired'].includes(data.status)) {
      throw new Error(`Tripo task ${taskId} ended with status: ${data.status}`);
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for Tripo task ${taskId}`);
}

export async function generateTripoAsset({
  prompt,
  preset = null,
  outputPath,
  autoRig = false,
  modelVersion = 'v2.5-20250123',
  apiKey = process.env.TRIPO_API_KEY,
  fetchImpl = globalThis.fetch,
  onProgress = null,
} = {}) {
  const entry = preset ? getTripoCatalogEntry(preset) : null;
  const resolvedPrompt = prompt || entry?.prompt;
  if (!resolvedPrompt) throw new Error('Provide either a preset id or a text prompt.');

  const draftTaskId = await createTripoTask({
    type: 'text_to_model',
    model_version: modelVersion,
    prompt: resolvedPrompt,
    pbr: true,
  }, {apiKey, fetchImpl});

  let finalResult = await pollTripoTask(draftTaskId, {apiKey, fetchImpl, onProgress});

  if (autoRig) {
    const rigTaskId = await createTripoTask({
      type: 'animate_rig',
      original_model_task_id: draftTaskId,
      out_format: 'glb',
    }, {apiKey, fetchImpl});
    finalResult = await pollTripoTask(rigTaskId, {apiKey, fetchImpl, onProgress});
  }

  const downloadRes = await fetchImpl(finalResult.modelUrl);
  if (!downloadRes.ok) {
    throw new Error(`Failed to download Tripo GLB (${downloadRes.status})`);
  }
  const bytes = Buffer.from(await downloadRes.arrayBuffer());
  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), {recursive: true});
    await fs.writeFile(outputPath, bytes);
  }
  return {
    taskId: finalResult.taskId,
    draftTaskId,
    prompt: resolvedPrompt,
    bytes: bytes.length,
    outputPath: outputPath || null,
  };
}
