import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {CC0,ambientCgSelection,fetchCc0,manifestEntry,polyHavenSelection,readZip,upsertManifestText} from '../scripts/assets/cc0.mjs';

// Responses shaped like the live APIs (checked 2026-10-22), served without a network.
const root=new URL('../',import.meta.url),file=path=>readFile(new URL(path,root));
const md5=bytes=>createHash('md5').update(bytes).digest('hex'),sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const now=()=>new Date('2026-10-22T12:00:00Z');
const ph=(name,bytes)=>({size:bytes.length,md5:md5(bytes),url:`https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/ground_01/${name}`});
const images={'ground_01_diff_1k.png':Buffer.from('colour pixels'),'ground_01_nor_gl_1k.png':Buffer.from('normal pixels'),'ground_01_arm_1k.png':Buffer.from('arm pixels')};
const polyHaven={info:{name:'Ground 01',type:1,authors:{'A. Scanner':'All'}},files:{Diffuse:{'1k':{png:ph('ground_01_diff_1k.png',images['ground_01_diff_1k.png'])}},nor_gl:{'1k':{png:ph('ground_01_nor_gl_1k.png',images['ground_01_nor_gl_1k.png'])}},arm:{'1k':{png:ph('ground_01_arm_1k.png',images['ground_01_arm_1k.png'])}},Rough:{'2k':{}}}};
// A ZIP written by Python's zipfile: a folder, a deflated and a stored image, and a MaterialX file.
const archive=await file('tests/models/cc0-sample.zip');
const ambient={foundAssets:[{assetId:'Sample001',displayName:'Sample 001',creationMethod:'PBRPhotogrammetry',creationMethodName:'PBR Photogrammetry',downloadFolders:{default:{downloadFiletypeCategories:{zip:{downloads:[
  {attribute:'1K-JPG',downloadLink:'https://ambientcg.com/get?file=Sample001_1K-JPG.zip',fileName:'Sample001_1K-JPG.zip',size:999},
  {attribute:'1K-PNG',downloadLink:'https://ambientcg.com/get?file=Sample001_1K-PNG.zip',fileName:'Sample001_1K-PNG.zip',size:archive.length}]}}}}}]};
function fetcher(routes){
  const requested=[];
  const fetch=async url=>{requested.push(url);const body=routes[url];if(body===undefined)return new Response('missing',{status:404});return new Response(Buffer.isBuffer(body)?body:JSON.stringify(body));};
  return {fetch,requested};
}
const polyHavenRoutes=(overrides={})=>({'https://api.polyhaven.com/info/ground_01':polyHaven.info,'https://api.polyhaven.com/files/ground_01':polyHaven.files,
  ...Object.fromEntries(Object.entries(images).map(([name,bytes])=>[`https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/ground_01/${name}`,bytes])),...overrides});

test('Poly Haven: each requested map at one resolution, from Poly Haven’s own file host', ()=>{
  const picked=polyHavenSelection(polyHaven.info,polyHaven.files);
  assert.deepEqual(picked.map(f=>[f.map,f.name]),[['Diffuse','ground_01_diff_1k.png'],['nor_gl','ground_01_nor_gl_1k.png'],['arm','ground_01_arm_1k.png']]);
  assert.throws(()=>polyHavenSelection({...polyHaven.info,type:2},polyHaven.files),/Only texture sets/);
  assert.throws(()=>polyHavenSelection(polyHaven.info,polyHaven.files,{maps:['Rough']}),/no Rough map at 1k as png/);
  const elsewhere={Diffuse:{'1k':{png:{...polyHaven.files.Diffuse['1k'].png,url:'https://example.com/diff.png'}}}};
  assert.throws(()=>polyHavenSelection(polyHaven.info,elsewhere,{maps:['Diffuse']}),/Unexpected download host/);
});

test('Poly Haven: files are checked against Poly Haven’s digests and recorded with their SHA-256 and the CC0 licence', async()=>{
  const {fetch,requested}=fetcher(polyHavenRoutes()),{record,files,recordPath}=await fetchCc0('polyhaven:ground_01',{},{fetcher:fetch,now});
  assert.equal(recordPath,'art-source/cc0/polyhaven-ground_01.json');assert.equal(requested.length,5);
  assert.deepEqual({source:record.source,page:record.page,licence:record.licence,licenceUrl:record.licenceUrl,authors:record.authors,retrievedAt:record.retrievedAt},
    {source:'Poly Haven',page:'https://polyhaven.com/a/ground_01',licence:CC0,licenceUrl:'https://polyhaven.com/license',authors:['A. Scanner'],retrievedAt:'2026-10-22T12:00:00.000Z'});
  assert.deepEqual(record.files.map(f=>[f.map,f.sha256,f.path]),Object.entries(images).map(([name,bytes],i)=>[['Diffuse','nor_gl','arm'][i],sha256(bytes),`art-source/cc0/raw/polyhaven-ground_01/${name}`]));
  assert.deepEqual(files.map(f=>f.data),Object.values(images));
  // A file that differs from Poly Haven's digest stops the intake.
  const tampered=fetcher(polyHavenRoutes({'https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/ground_01/ground_01_arm_1k.png':Buffer.from('arm pixelz')}));
  await assert.rejects(fetchCc0('polyhaven:ground_01',{},{fetcher:tampered.fetch,now}),/does not match Poly Haven's digest/);
  await assert.rejects(fetchCc0('sketchfab:ground_01',{},{fetcher:fetch}),/polyhaven:<id> or ambientcg:<id>/);
  await assert.rejects(fetchCc0('polyhaven:../x',{},{fetcher:fetch}),/polyhaven:<id> or ambientcg:<id>/);
});

test('ambientCG: one archive at the chosen resolution, size-checked, with its images extracted', async()=>{
  assert.deepEqual(ambientCgSelection(ambient.foundAssets[0]),{url:'https://ambientcg.com/get?file=Sample001_1K-PNG.zip',bytes:archive.length,name:'Sample001_1K-PNG.zip',attribute:'1K-PNG'});
  assert.throws(()=>ambientCgSelection(ambient.foundAssets[0],{resolution:'8K-PNG'}),/1K-JPG, 1K-PNG, not 8K-PNG/);
  assert.deepEqual(readZip(archive).map(e=>e.name),['Sample001_1K-PNG/Sample001_1K-PNG_Color.png','Sample001_1K-PNG/Sample001_1K-PNG_NormalGL.png','Sample001_1K-PNG/Sample001.mtlx']);
  const api='https://ambientcg.com/api/v2/full_json?id=Sample001&include=downloadData,tagData,displayData';
  const {fetch}=fetcher({[api]:ambient,'https://ambientcg.com/get?file=Sample001_1K-PNG.zip':archive}),{record,files}=await fetchCc0('ambientcg:Sample001',{},{fetcher:fetch,now});
  assert.deepEqual([record.source,record.page,record.licence,record.licenceUrl,record.method],['ambientCG','https://ambientcg.com/a/Sample001',CC0,'https://docs.ambientcg.com/license/','PBR Photogrammetry']);
  assert.deepEqual(record.archive,{url:'https://ambientcg.com/get?file=Sample001_1K-PNG.zip',bytes:archive.length,sha256:sha256(archive)});
  assert.deepEqual(files.map(f=>f.name),['Sample001_1K-PNG_Color.png','Sample001_1K-PNG_NormalGL.png'],'images only');
  assert.ok(record.files.every(f=>/^[0-9a-f]{64}$/.test(f.sha256)&&f.path.startsWith('art-source/cc0/raw/ambientcg-Sample001/')));
  const short=fetcher({[api]:ambient,'https://ambientcg.com/get?file=Sample001_1K-PNG.zip':archive.subarray(0,100)});
  await assert.rejects(fetchCc0('ambientcg:Sample001',{},{fetcher:short.fetch,now}),/is 100 bytes, not the \d+ ambientCG lists/);
});

test('record: a shipped file joins the manifest with its CC0 source, and only its own lines change', async()=>{
  const text=(await file('docs/asset-manifest.json')).toString('utf8'),before=JSON.parse(text);
  const {fetch}=fetcher(polyHavenRoutes()),{record,recordPath}=await fetchCc0('polyhaven:ground_01',{},{fetcher:fetch,now});
  const fields={id:'terrain-ground-01',subject:'Photographed ground for the Danube meadows',usage:'Terrain layer',loading:'Chapter I group',processing:'encoded as KTX2 by scripts/assets/compress.mjs'};
  assert.throws(()=>manifestEntry(record,recordPath,{path:'assets/textures/terrain/ground-01.ktx2',bytes:10,sha256:'0'.repeat(64)},{...fields,usage:''}),/--usage/);
  const entry=manifestEntry(record,recordPath,{path:'assets/textures/terrain/ground-01.ktx2',bytes:1234,sha256:'a'.repeat(64)},fields);
  assert.match(entry.license,/^CC0 1\.0 Universal .*polyhaven\.com\/license.*A\. Scanner on Poly Haven/);
  assert.equal(entry.source.record,'art-source/cc0/polyhaven-ground_01.json');assert.equal(entry.export.format,'KTX2 texture (Basis Universal)');
  const added=upsertManifestText(text,entry,{now}),after=JSON.parse(added);
  assert.equal(after.assets.filter(a=>a.id===entry.id).length,1);assert.deepEqual(after.assets.at(-1),entry);
  assert.equal(after.totalBundledAssetBytes,before.totalBundledAssetBytes+1234);assert.equal(after.totalModelBytes,before.totalModelBytes);
  assert.equal(after.assetCounts.textures,before.assetCounts.textures+1);assert.equal(after.updatedAt,'2026-10-22T12:00:00.000Z');
  // Python wrote the file; its other entries keep their exact text (floats such as 35.0 included).
  const removed=new Set(text.split('\n')),kept=added.split('\n').filter(line=>removed.has(line));
  assert.ok(text.split('\n').filter(line=>!added.split('\n').includes(line)).every(line=>/"(totalBundledAssetBytes|updatedAt|textures)"|^    }$/.test(line)),'only totals, counts, the date and the list end change');
  assert.ok(kept.some(line=>/"sharpAngle": 35\.0,/.test(line)));
  // Recording the same id again replaces it.
  const again=JSON.parse(upsertManifestText(added,{...entry,export:{...entry.export,bytes:2000}},{now}));
  assert.equal(again.assets.filter(a=>a.id===entry.id).length,1);assert.equal(again.totalBundledAssetBytes,before.totalBundledAssetBytes+2000);
});
