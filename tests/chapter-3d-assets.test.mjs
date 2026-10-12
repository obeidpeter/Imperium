import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {chapterAssets,chapterOfflineAssets} from '../src/ui/art.js';

const root=new URL('../',import.meta.url);
async function paths(folder){
  const result=[];for(const entry of await readdir(new URL(folder,root),{withFileTypes:true})){const path=folder+entry.name;result.push(...entry.isDirectory()?await paths(path+'/'):['./'+path]);}return result;
}
const files=(await Promise.all(['src/showcase/','assets/showcase/','vendor/three/','showcase/'].map(paths))).flat();

test('Chapter I offline group contains actual shared renderer, sound, vendor and material files while image decoding stays image-only',async()=>{
  const group=chapterOfflineAssets(1,files);
  for(const required of ['./src/showcase/stage.js','./src/showcase/battle-sound.js','./vendor/three/three.module.js','./vendor/three/three.core.js','./vendor/three/LICENSE','./assets/showcase/earth.webp','./assets/showcase/stone.webp','./assets/showcase/timber.webp'])assert.ok(group.includes(required),required);
  assert.ok(!group.includes('./showcase/index.html'));assert.ok(!group.includes('./src/showcase/showcase.css'));
  for(let chapter=1;chapter<=12;chapter++)assert.ok(chapterAssets(chapter).every(path=>/\.(webp|png|jpe?g)$/.test(path)),'An image decoder must never receive a JS/CSS dependency');
  const stage=await readFile(new URL('src/showcase/stage.js',root),'utf8');
  for(const match of stage.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g))assert.ok(group.includes('./src/showcase/'+match[1].slice(2)),`Stage dependency omitted: ${match[1]}`);
});

test('Other chapters retain their image groups and do not inherit the Chapter I 3D download',()=>{
  for(let chapter=2;chapter<=12;chapter++)assert.deepEqual(chapterOfflineAssets(chapter,files),chapterAssets(chapter));
  const one=chapterOfflineAssets(1,[...files,...files]);assert.equal(new Set(one).size,one.length);
});
