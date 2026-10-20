// Unified 3D Asset & Engine Pipeline Coordinator ("Argon 4" orchestrator) for Imperium.
// Coordinates:
//   1. Tripo 3D API (text/image -> raw .glb + optional auto-rig)
//   2. Headless Blender 5.2 (bpy mesh refinement, decimation, skeleton binding, and procedural Roman sculpting)
//   3. Imperium Browser Game (.glb deployment into assets/models/ + docs/asset-manifest.json provenance sync)
//   4. Unreal Engine 5.8 (automated .glb import & level staging via UnrealEditor-Cmd.exe)
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {IMPERIUM_TRIPO_CATALOG, getTripoCatalogEntry, generateTripoAsset} from './tripo-client.mjs';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function detectLocalTools() {
  const blenderCandidates = [
    process.env.BLENDER_PATH,
    'C:\\Users\\obeid\\AppData\\Local\\Programs\\Blender\\blender-5.2.2-windows-x64\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
  ].filter(Boolean);

  const unrealCandidates = [
    process.env.UNREAL_EDITOR_CMD,
    'C:\\Program Files\\Epic Games\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe',
    'C:\\Program Files\\Epic Games\\UE_5.5\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe',
  ].filter(Boolean);

  const blenderExe = blenderCandidates.find(p => existsSync(p)) || null;
  const unrealEditorCmd = unrealCandidates.find(p => existsSync(p)) || null;
  const tripoConfigured = Boolean(process.env.TRIPO_API_KEY && process.env.TRIPO_API_KEY.trim());

  return {
    blenderExe,
    unrealEditorCmd,
    tripoConfigured,
  };
}

export async function runBlenderProcess({
  blenderExe = detectLocalTools().blenderExe,
  inputPath = null,
  preset = 'roman-aquila-v029',
  outputPath = path.join(ROOT, 'assets/models/roman-aquila-v029.glb'),
  rig = 'standard3',
  targetHeight = 1.45,
  maxTriangles = 1800,
} = {}) {
  if (!blenderExe) {
    throw new Error('Blender executable not found. Set BLENDER_PATH or install Blender.');
  }
  const scriptPath = path.join(ROOT, 'scripts/pipeline/blender-process.py');
  const args = [
    '--background',
    '--python',
    scriptPath,
    '--',
    '--preset',
    preset,
    '--output',
    outputPath,
    '--rig',
    rig,
    '--target-height',
    String(targetHeight),
    '--max-tris',
    String(maxTriangles),
  ];
  if (inputPath) {
    args.push('--input', inputPath);
  }
  const {stdout, stderr} = await execFileAsync(blenderExe, args, {maxBuffer: 20 * 1024 * 1024});
  const match = stdout.match(/BLENDER_PIPELINE_REPORT:(\{.*\})/);
  if (!match) {
    throw new Error(`Blender pipeline did not emit report.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
  }
  return JSON.parse(match[1]);
}

export async function syncAssetManifest(report, entry) {
  const manifestPath = path.join(ROOT, 'docs/asset-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const relPath = entry.outputPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const rawBytes = await fs.readFile(path.join(ROOT, relPath));
  const gzipBytes = gzipSync(rawBytes, {level: 9}).length;
  const sha256 = createHash('sha256').update(rawBytes).digest('hex');

  const manifestEntry = {
    id: entry.id,
    path: relPath,
    subject: entry.title,
    source: {
      method: report.sourceMethod || 'Blender 5.2 headless procedural bmesh & armature pipeline (scripts/pipeline/blender-process.py)',
      license: 'CC0-1.0',
      licenseText: 'vendor/makehuman/LICENSE.CC0.md',
      instructions: 'node scripts/pipeline/orchestrate.mjs --preset ' + entry.id,
    },
    usage: 'Rigged 3D Roman Legionary Aquila standard with 3-bone armature (base, shaft, eagle) for commanders and standard-bearers.',
    loading: 'Lazy local GLB asset shared across campaign chapters.',
    export: {
      format: 'GLB 2.0',
      bytes: rawBytes.length,
      gzipLevel9Bytes: gzipBytes,
      sha256,
      vertices: report.vertices,
      triangles: report.triangles,
      joints: report.bones?.length || 0,
    },
  };

  const existingIdx = manifest.assets.findIndex(a => a.id === entry.id || a.path === relPath);
  if (existingIdx >= 0) {
    manifest.assets[existingIdx] = manifestEntry;
  } else {
    manifest.assets.push(manifestEntry);
  }

  manifest.assetCounts.models = manifest.assets.filter(a => a.path.startsWith('assets/models/')).length;
  manifest.totalModelBytes = manifest.assets
    .filter(a => a.path.startsWith('assets/models/'))
    .reduce((sum, a) => sum + (a.export?.bytes || 0), 0);

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifestEntry;
}

export async function runAssetPipeline({
  preset = 'roman-aquila-v029',
  prompt = null,
  useTripo = Boolean(process.env.TRIPO_API_KEY),
  syncManifest = true,
  uprojectPath = null,
} = {}) {
  const tools = detectLocalTools();
  const entry = getTripoCatalogEntry(preset) || {
    id: preset,
    title: preset,
    prompt: prompt || preset,
    rig: 'standard3',
    targetHeight: 1.45,
    maxTriangles: 1800,
    outputPath: `assets/models/${preset}.glb`,
  };

  let rawInputPath = null;
  let sourceMethod = 'Blender 5.2 headless procedural bmesh & armature pipeline (scripts/pipeline/blender-process.py)';

  if (useTripo && tools.tripoConfigured) {
    rawInputPath = path.join(ROOT, 'assets/raw-tripo', `${entry.id}-raw.glb`);
    await generateTripoAsset({
      preset: entry.id,
      prompt: prompt || entry.prompt,
      outputPath: rawInputPath,
    });
    sourceMethod = 'Tripo 3D API v2 text_to_model refined and rigged via Blender 5.2 (scripts/pipeline/orchestrate.mjs)';
  }

  const outputAbs = path.join(ROOT, entry.outputPath);
  const blenderReport = await runBlenderProcess({
    blenderExe: tools.blenderExe,
    inputPath: rawInputPath,
    preset: entry.id,
    outputPath: outputAbs,
    rig: entry.rig,
    targetHeight: entry.targetHeight,
    maxTriangles: entry.maxTriangles,
  });
  blenderReport.sourceMethod = sourceMethod;

  let manifestRecord = null;
  if (syncManifest && entry.outputPath.startsWith('assets/models/')) {
    manifestRecord = await syncAssetManifest(blenderReport, entry);
  }

  let unrealReport = null;
  if (uprojectPath && tools.unrealEditorCmd) {
    const ueScript = path.join(ROOT, 'scripts/pipeline/unreal-import.py');
    const {stdout} = await execFileAsync(tools.unrealEditorCmd, [
      uprojectPath,
      '-run=pythonscript',
      `-script=${ueScript}`,
    ]);
    const match = stdout.match(/UNREAL_PIPELINE_REPORT:(\{.*\})/);
    unrealReport = match ? JSON.parse(match[1]) : {rawOutput: stdout};
  }

  return {
    tools,
    preset: entry.id,
    usedTripo: Boolean(useTripo && tools.tripoConfigured),
    blenderReport,
    manifestRecord,
    unrealReport,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const getArg = (flag, fallback = null) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
  };
  const preset = getArg('--preset', 'roman-aquila-v029');
  const prompt = getArg('--prompt', null);
  const uprojectPath = getArg('--uproject', null);
  const syncManifest = !args.includes('--no-manifest');

  const summary = await runAssetPipeline({preset, prompt, syncManifest, uprojectPath});
  console.log(JSON.stringify(summary, null, 2));
}
