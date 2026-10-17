import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chapterAssets,chapterAudioAssets,chapterOfflineAssets} from '../src/ui/art.js';
import {serveRequest} from '../scripts/serve.mjs';
import {soundscapeFor,briefingFor} from '../src/ui/soundscape-data.js';

test('Chapter audio groups cover local files without passing MP3s to the image decoder',async()=>{
  const audio=await readdir(new URL('../assets/audio/',import.meta.url)),used=new Set();
  for(let n=1;n<=12;n++){
    const expected=chapterAudioAssets(n);assert.equal(expected.length,new Set(expected).size);for(const path of expected){assert.ok(audio.includes(path.split('/').at(-1)),path);used.add(path);}
    assert.ok(chapterAssets(n).every(path=>!path.endsWith('.mp3')));
    const group=chapterOfflineAssets(n,['./src/showcase/stage.js','./assets/showcase/character-materials-v015.webp','./assets/showcase/character-materials-v016.webp']);for(const path of expected)assert.ok(group.includes(path));
    assert.ok(group.includes('./assets/showcase/character-materials-v016.webp'));assert.ok(!group.includes('./assets/showcase/character-materials-v015.webp'));
  }assert.equal(used.size,14);
  const opening=chapterAudioAssets(1);for(const key of ['music-frontier','music-battle','ambience-frontier','voice-arrival','voice-varro'])assert.ok(opening.includes(`./assets/audio/${key}.mp3`));assert.ok(!opening.some(p=>/council|rain|dry|rally/.test(p)));
  assert.ok(chapterAudioAssets(2).includes('./assets/audio/ambience-rain.mp3'));for(const n of [5,6,9])assert.ok(chapterAudioAssets(n).includes('./assets/audio/ambience-dry.mp3'));
  for(const n of [7,8,10,11,12])assert.ok(chapterAudioAssets(n).includes('./assets/audio/voice-council.mp3'));
  assert.ok(!chapterAudioAssets(11).includes('./assets/audio/music-battle.mp3'));assert.ok(!chapterAudioAssets(3).includes('./assets/audio/voice-rally.mp3'));assert.ok(chapterAudioAssets(4).includes('./assets/audio/voice-rally.mp3'));
});

test('Chapter downloads cover actual camp and encounter music, ambience and briefing selections',()=>{
  for(let chapter=1;chapter<=12;chapter++)for(const phase of ['camp','encounter'])for(const kind of chapter===11?['contest']:['battle',...([7,8,10,12].includes(chapter)?['contest']:[])])for(const encounterIndex of [0,1]){
    const state={chapter,phase,encounterIndex,encounter:phase==='encounter'?{kind}:null},assets=chapterAudioAssets(chapter),soundscape=soundscapeFor(state),line=briefingFor(state);
    for(const id of [soundscape.music,soundscape.ambience,line?'voice-'+line.id:null].filter(Boolean))assert.ok(assets.includes('./assets/audio/'+id+'.mp3'),`Chapter ${chapter} ${phase} ${kind} omitted ${id}`);
  }
});

test('Static handler returns actual bundled MP3 bytes with the browser audio MIME type',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),result={};
  await serveRequest({url:'/assets/audio/foley-step.mp3'},{writeHead(status,headers){Object.assign(result,{status,headers});},end(body){result.body=body;}},root);
  assert.equal(result.status,200);assert.equal(result.headers['Content-Type'],'audio/mpeg');assert.equal(result.headers['X-Content-Type-Options'],'nosniff');
  assert.deepEqual(result.body,await readFile(new URL('../assets/audio/foley-step.mp3',import.meta.url)));
});
