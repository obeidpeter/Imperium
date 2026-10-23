import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import {WORLD_CATALOG,WORLD_KINDS,chapterWorldFiles,worldFiles,worldModelUrl} from '../src/ui/world-catalog.js';
import {SCENERY_MODELS,sceneryPlacements} from '../src/showcase/scenery-models.js';
import {chapterOfflineAssets,isFlatArt} from '../src/ui/art.js';

const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('docs/asset-manifest.json',root),'utf8'));
async function paths(folder){
  const result=[];for(const entry of await readdir(new URL(folder,root),{withFileTypes:true})){const path=folder+entry.name;result.push(...entry.isDirectory()?await paths(path+'/'):[path]);}return result;
}

test('every world asset names its kind, its chapters and files with provenance',async()=>{
  for(const [id,entry]of Object.entries(WORLD_CATALOG)){
    assert.ok(WORLD_KINDS.includes(entry.kind),`${id}: kind ${entry.kind}`);
    assert.ok(entry.chapters.length&&entry.chapters.every(n=>Number.isInteger(n)&&n>=1&&n<=12),`${id}: chapters`);
    assert.ok(entry.files.length,`${id}: files`);
    for(const file of entry.files){
      assert.ok((await stat(new URL(file,root))).isFile(),`${id}: ${file} exists`);
      // assets/world/ holds the 2D board's atlases, which 3D players never download.
      assert.ok(['assets/models/','assets/textures/'].some(prefix=>file.startsWith(prefix))&&!isFlatArt('./'+file),`${id}: ${file} is 3D world data`);
      assert.ok(manifest.assets.some(asset=>asset.path===file),`${id}: ${file} has provenance in docs/asset-manifest.json`);
    }
  }
  assert.equal(new Set(worldFiles()).size,worldFiles().length,'No file belongs to two world assets');
});

test('no world model sits outside the catalog, and every placed model is catalogued for its chapter',async()=>{
  const models=(await Promise.all(['assets/models/chapters/','assets/models/scenery/','assets/models/world/'].map(paths))).flat();
  assert.deepEqual(models.filter(path=>!worldFiles().includes(path)),[],'A model in assets/models/chapters/ must be in the world catalog');
  for(const [chapter,set]of Object.entries(SCENERY_MODELS))for(const {id}of set.models){
    assert.ok(worldModelUrl(id),`${id} is in the world catalog`);
    assert.ok(WORLD_CATALOG[id].chapters.includes(Number(chapter)),`${id} downloads with Chapter ${chapter}, where it stands`);
  }
  for(let chapter=1;chapter<=12;chapter++)for(const {id}of sceneryPlacements({id:`ch${chapter}-camp`,width:20,height:16},{chapter})){
    assert.ok(worldModelUrl(id),`${id} is in the world catalog`);
    assert.ok(WORLD_CATALOG[id].chapters.includes(chapter),`${id} downloads with Chapter ${chapter}, where it stands`);
  }
});

test('a chapter’s offline pack holds its own world files and no other chapter’s',()=>{
  const files=['./assets/models/roman-human-v017.glb',...worldFiles().map(file=>'./'+file)];
  for(let chapter=1;chapter<=12;chapter++){
    const pack=chapterOfflineAssets(chapter,files),own=chapterWorldFiles(chapter).map(file=>'./'+file);
    assert.deepEqual(pack.filter(path=>worldFiles().includes(path.slice(2))).sort(),[...own].sort(),`Chapter ${chapter}`);
    assert.ok(pack.includes('./assets/models/roman-human-v017.glb'),'Shared anatomy stays in every chapter');
  }
});
