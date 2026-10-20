import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectModel,budgetProblems,imageSize} from '../scripts/assets/check-model.mjs';

// The checker runs on files already in the repository; the Blender step it
// guards (scripts/assets/process-model.py) needs Blender and is a manual tool.
const file=path=>readFile(new URL(`../${path}`,import.meta.url));
const manifest=JSON.parse(await file('docs/asset-manifest.json'));
const entry=id=>manifest.assets.find(a=>a.id===id);

test('asset pipeline: a shipped model reads as the manifest records it', async () => {
  const info=await inspectModel(await file('assets/models/roman-human-v017.glb'));
  assert.equal(info.bytes,entry('roman-human-v017').export.bytes);
  assert.equal(info.triangles,entry('roman-human-v017').export.triangles);
  assert.equal(info.skins,1);assert.deepEqual(info.extensionsRequired,['KHR_mesh_quantization'],'Quantized meshes load without a decoder');
  assert.ok(Object.values(info.sizeMetres).every(v=>Number.isFinite(v)&&v>0));
  assert.deepEqual(budgetProblems(info,{triangles:12000,bytes:300000}),[]);
  assert.deepEqual(budgetProblems(info,{triangles:8000}),['9904 triangles exceeds 8000.']);
});

test('asset pipeline: embedded maps, skins and clips of a handoff GLB are counted', async () => {
  const info=await inspectModel(await file('art-source/characters/persian-guard-v035.glb'));
  assert.deepEqual([...info.animations].sort(),['attack','block','idle','walk']);
  assert.ok(info.textures.length>0&&info.textures.every(t=>t.mimeType==='image/png'&&t.width>0&&t.height>0));
  assert.match(budgetProblems(info,{texture:16}).join(' '),/texture exceeds 16 pixels/);
  assert.match(budgetProblems(info,{maxHeight:1.5}).join(' '),/m tall is above 1\.5 m/);
});

test('asset pipeline: image sizes come from PNG, WebP and JPEG headers', async () => {
  assert.deepEqual(imageSize(await file('icons/icon-180.png')),{width:180,height:180});
  for(const id of ['complexion-male-v018','frontier-oath']){const e=entry(id);assert.deepEqual(imageSize(await file(e.path)),{width:e.export.width,height:e.export.height},id);}
  const jpeg=imageSize(await file('docs/images/production-battle.jpg'));assert.ok(jpeg.width>0&&jpeg.height>0);
  assert.deepEqual(imageSize(Buffer.from('not an image')),{width:0,height:0});
});

test('asset pipeline: what the game cannot load is refused', async () => {
  await assert.rejects(inspectModel(Buffer.from('not a model at all, just text')),/Not a binary glTF/);
  const info=await inspectModel(await file('assets/models/roman-human-v017.glb'));
  // Constructed variants of a real report: compression the bare loader cannot decode.
  for(const name of ['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'])
    assert.deepEqual(budgetProblems({...info,extensionsRequired:[name]}),[`${name} needs a decoder the game does not ship.`]);
  assert.deepEqual(budgetProblems({...info,extensionsRequired:['EXT_texture_webp','KHR_texture_transform']}),[]);
});
