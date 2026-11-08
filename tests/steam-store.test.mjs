import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {imageDigest} from '../scripts/steam-capture-records.mjs';
import {CHAPTERS} from '../src/data/campaign.js';
import {DECORATIONS,TITLES} from '../src/data/soldier.js';
import {ITEMS} from '../src/data/items.js';
import {ACHIEVEMENTS} from '../src/data/achievements.js';
import {KINDS,sourceKind,aiInventory,storeText,steamAiDisclosureSheet} from '../scripts/steam-ai-disclosure.mjs';
import {STORE_ART,ICONS,HERO,TALL,RENDER_SCENE,fileName,renderFile,enlargement} from '../scripts/steam-store-art.mjs';
import {SCREENSHOTS,SIZE,SCREENSHOTS_DIR,RECORD,fileName as screenshotFile} from '../scripts/steam-screenshots.mjs';
import {CLIPS,FPS,TRAILER,RECORD as TRAILER_RECORD,MUSIC,MIN_KBPS,frames,trailerSeconds,mp4Info} from '../scripts/steam-trailer.mjs';

// The Steam store drafts (the Steam plan, S4): the AI-content disclosure, generated from the asset manifest, and the
// store page's text, written from the guide. Both stay true to the game: these checks fail when it changes under them.

const manifest=JSON.parse(await readFile(new URL('../docs/asset-manifest.json',import.meta.url),'utf8'));
const storePage=await readFile(new URL('../docs/steam-store-text.md',import.meta.url),'utf8');
const block=heading=>{
  const after=storePage.slice(storePage.indexOf(`## ${heading}\n`));
  const match=after.match(/```text\n([\s\S]*?)\n```/);assert.ok(match,`a text block under ${heading}`);return match[1];
};

test('every file the game ships is sorted by how it was made, and the disclosure is in step: run node scripts/steam-ai-disclosure.mjs',async()=>{
  const inv=aiInventory(manifest);
  assert.deepEqual(inv.unsorted,[],'a shipped file whose source fits no kind must be sorted before the disclosure is true');
  assert.equal(inv.made.reduce((n,r)=>n+r.files,0)+inv.without.reduce((n,r)=>n+r.files,0),manifest.assets.length,'every file counted once');
  assert.equal(await readFile(new URL('../docs/steam-ai-disclosure.md',import.meta.url),'utf8'),steamAiDisclosureSheet(manifest));
});

test('the kinds the disclosure names follow each record, derived files included',()=>{
  const byPath=new Map(manifest.assets.map(a=>[a.path,a])),kind=path=>sourceKind(byPath.get(path),byPath);
  assert.equal(kind('assets/scenes/marsh.webp'),'illustration');
  assert.equal(kind('assets/showcase/earth-v017.webp'),'illustration','a recompression keeps the kind of what it was made from');
  assert.equal(kind('assets/models/characters/roman-recruit.glb'),'model');
  assert.equal(kind('src/showcase/finale-crowd-data.js'),'model','the crowd is reduced from a generated figure');
  assert.equal(kind('assets/items/item-atlas.webp'),'model','the item pictures are renders of generated models');
  assert.equal(kind('assets/models/scenery/trees-temperate.glb'),'partly','leaf cards from the generated foliage atlas');
  assert.equal(kind('assets/models/scenery/trees-italy.glb'),'trees');
  assert.equal(kind('assets/models/scenery/ch5-fortress-kit.glb'),'blender');
  assert.equal(kind('assets/textures/ground/ground-albedo-v1.ktx2'),'polyhaven');
  assert.equal(kind('assets/models/roman-human-v017.glb'),'makehuman');
  const audio=manifest.assets.filter(a=>a.path.startsWith('assets/audio/')).map(a=>kind(a.path));
  assert.deepEqual([...new Set(audio)].sort(),['music','sound','voice']);
  assert.equal(sourceKind({path:'x',source:{method:'Something new'}}),null,'an unknown source is never guessed');
  assert.equal(sourceKind({path:'x',source:{method:'Original AI generation through the connected Runway tool',model:'a-new-model'}}),null);
});

test('the store page’s disclosure names every kind of AI-made content the game ships, and no other',()=>{
  const inv=aiInventory(manifest),text=storeText(inv),kinds=new Set(inv.made.map(r=>r.kind));
  assert.ok(Object.keys(KINDS).filter(k=>KINDS[k].ai).every(k=>kinds.has(k)),'every AI kind is in the game today');
  for(const [kind,words] of [['illustration','OpenAI'],['model','Tripo'],['music','Lyria'],['sound','Runway'],['voice','ElevenLabs'],['depth','depth']])
    assert.ok(text.includes(words),`${kind}: ${words}`);
  assert.match(text,/nothing is generated while you play/);
  const without={...inv,made:inv.made.filter(r=>r.kind!=='voice')};
  assert.ok(!storeText(without).includes('ElevenLabs'),'a kind that is gone takes its sentence with it');
});

test('the faces restored with OpenAI image generation are counted from the manifest, never written in',()=>{
  const restored=manifest.assets.filter(a=>/^Project-generated/.test(a.source?.surfaceRepair?.paint??'')),inv=aiInventory(manifest);
  assert.ok(restored.length>0&&restored.every(a=>a.path.startsWith('assets/models/characters/')),'the manifest records restored character faces');
  assert.equal(inv.faceRestorations,restored.length);
  const word=['no','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'][restored.length]??String(restored.length);
  assert.ok(storeText(inv).includes(`${word[0].toUpperCase()+word.slice(1)} character face texture`),'the store text names their number');
  const sheet=steamAiDisclosureSheet(manifest);
  assert.ok(sheet.includes(`restored ${word} face texture`),'the inventory names it too');
  assert.ok(sheet.includes(`each of the ${word} face restoration`),'and that each was shown a render of the game’s own model');
  assert.ok(!storeText({...inv,faceRestorations:0}).includes('character face texture'),'no restored faces, no sentence');
});

test('the store page’s short description fits Steam’s limit, as plain text',()=>{
  const short=block('Short description');
  assert.ok(short.length<=300,`${short.length} characters`);
  assert.doesNotMatch(short,/\n|\[|https?:/,'one plain paragraph, without markup or links');
});

test('the store page’s About text has no links, and its numbers are the game’s',()=>{
  const about=block('About This Game'),encounters=CHAPTERS.flatMap(c=>c.encounters);
  assert.doesNotMatch(about,/\[url|https?:|www\./i,'Steam allows no links in this section');
  const count=kind=>encounters.filter(e=>e.kind===kind).length,words=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
  assert.ok(about.includes(`${CHAPTERS.length} chapters and ${encounters.length} playable encounters`));
  assert.ok(about.includes(`Over ${words[CHAPTERS.length]} chapters`));
  assert.ok(about.includes(`${count('battle')} battles and ${count('contest')} political Contests`));
  assert.ok(about.includes(`${words[Object.keys(DECORATIONS).length]} decorations, ${words[Object.keys(TITLES).length]} titles`));
  assert.ok(about.includes('over a hundred pieces of kit')&&Object.keys(ITEMS).length>100);
  assert.ok(about.includes(`${ACHIEVEMENTS.length} Steam achievements`));
  assert.match(CHAPTERS[0].year,/250/);assert.match(CHAPTERS.at(-1).year,/276/);assert.ok(about.includes('from AD 250 to 276'));
});

// A JPEG's size, from its frame header; a PNG's size and colour type, from its header chunk.
function jpegSize(bytes){
  assert.ok(bytes[0]===0xff&&bytes[1]===0xd8,'a JPEG');
  for(let i=2;i<bytes.length;){
    if(bytes[i]!==0xff){i++;continue;}
    const marker=bytes[i+1];
    if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))return {width:bytes.readUInt16BE(i+7),height:bytes.readUInt16BE(i+5)};
    i+=2+bytes.readUInt16BE(i+2);
  }
  return null;
}
const pngHeader=bytes=>{assert.equal(bytes.toString('latin1',1,4),'PNG','a PNG');return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),colourType:bytes[25]};};

test('the store’s and the library’s images for Steamworks are each at Steam’s size: run node scripts/steam-store-art.mjs',async()=>{
  const dir=new URL('../desktop/steam/store-art/',import.meta.url);
  assert.deepEqual((await readdir(dir)).sort(),STORE_ART.map(fileName).sort(),'one file for each image, and no other');
  for(const a of STORE_ART){
    const bytes=await readFile(new URL(fileName(a),dir));
    if(a.png){
      const {width,height,colourType}=pngHeader(bytes);
      assert.equal(width,1280,a.id);assert.ok(height<=720,`${a.id}: 1280 wide and at most 720 tall`);assert.equal(colourType,6,`${a.id} keeps its transparency`);
    }else assert.deepEqual(jpegSize(bytes),{width:a.width,height:a.height},a.id);
  }
});

test('every capsule and header carries the name, the library hero none, and no painted image enlarges the painting twice over',()=>{
  assert.ok(STORE_ART.filter(a=>/capsule|header/.test(a.id)).every(a=>a.name),'the name on every capsule and header');
  const hero=STORE_ART.find(a=>a.id==='library_hero'),tall=STORE_ART.filter(a=>['vertical_capsule','library_capsule'].includes(a.id));
  assert.ok(hero.render===HERO&&!hero.name,'the library hero is a render of the game, without text');
  assert.ok(tall.length===2&&tall.every(a=>a.render===TALL&&a.name),'the two tall capsules are renders of the game, with the name');
  assert.ok(CHAPTERS.flatMap(c=>c.encounters).some(e=>e.id===RENDER_SCENE),'the renders show an encounter the campaign plays');
  for(const a of STORE_ART.filter(a=>a.crop))assert.ok(enlargement(a)<2,`${a.id}: ${enlargement(a).toFixed(2)}×`);
});

test('Steam’s two icons are the game’s emblem at Steam’s sizes: run node scripts/steam-store-art.mjs',async()=>{
  const dir=new URL('../desktop/steam/icons/',import.meta.url);
  assert.deepEqual((await readdir(dir)).sort(),ICONS.map(fileName).sort(),'one file for each icon, and no other');
  const shortcut=pngHeader(await readFile(new URL('shortcut_icon.png',dir)));
  assert.deepEqual([shortcut.width,shortcut.height],[256,256],'the shortcut icon, 256 × 256');
  assert.equal(shortcut.colourType,6,'the shortcut icon keeps its transparent corners');
  assert.deepEqual(jpegSize(await readFile(new URL('app_icon.jpg',dir))),{width:184,height:184},'the app icon, a 184 × 184 JPEG');
});

test('the draft screenshots are at least five, each 1920 × 1080 and taken from the game: run node scripts/steam-screenshots.mjs',async()=>{
  assert.ok(SCREENSHOTS.length>=5,'Steam asks for at least five');
  assert.deepEqual(SIZE,{width:1920,height:1080});
  const dir=new URL(`../${SCREENSHOTS_DIR}/`,import.meta.url);
  assert.deepEqual((await readdir(dir)).sort(),SCREENSHOTS.map(screenshotFile).sort(),'one file for each screenshot, and no other');
  for(const s of SCREENSHOTS)assert.deepEqual(jpegSize(await readFile(new URL(screenshotFile(s),dir))),SIZE,s.id);
  const encounters=new Set(CHAPTERS.flatMap(c=>c.encounters.map(e=>e.id)));
  assert.ok(SCREENSHOTS.every(s=>s.moment.promotion?CHAPTERS.some(c=>c.id===s.moment.promotion):encounters.has(s.moment.fight??s.moment.contest??s.moment.camp)),
    'every moment is one the campaign reaches');
  const record=JSON.parse(await readFile(new URL(`../${RECORD}`,import.meta.url),'utf8'));
  assert.deepEqual(record.screenshots.map(r=>r.id),SCREENSHOTS.map(s=>s.id),'the record names every screenshot, in order');
  assert.ok(record.screenshots.every(r=>r.captured.quality==='high'&&/^[0-9a-f]{64}$/.test(r.saveSha256)),'each was taken at High quality, from a recorded save');
  for(const r of record.screenshots){const bytes=await readFile(new URL(`../${r.file}`,import.meta.url));assert.equal(r.imageSha256,imageDigest(bytes),`${r.id}: image and evidence match`);assert.equal(r.imageBytes,bytes.length);}
});

test('the draft trailer is 1920 × 1080 at 30 frames a second, H.264 and AAC, recorded from the game: run node scripts/steam-trailer.mjs',async()=>{
  const encounters=new Set(CHAPTERS.flatMap(c=>c.encounters.map(e=>e.id)));
  assert.ok(CLIPS.every(c=>c.moment.promotion?CHAPTERS.some(ch=>ch.id===c.moment.promotion):encounters.has(c.moment.fight??c.moment.contest??c.moment.camp)),
    'every clip starts from a moment the campaign reaches');
  const record=JSON.parse(await readFile(new URL(`../${TRAILER_RECORD}`,import.meta.url),'utf8'));
  assert.deepEqual(record.trailers.map(t=>t.file),[TRAILER.file],'the record names the draft');
  const [entry]=record.trailers,bytes=await readFile(new URL(`../${entry.file}`,import.meta.url));
  assert.equal(entry.videoSha256,imageDigest(bytes),'video and evidence match');assert.equal(entry.videoBytes,bytes.length);
  const info=mp4Info(bytes),video=info.tracks.find(t=>t.handler==='vide'),audio=info.tracks.find(t=>t.handler==='soun');
  assert.deepEqual({width:video.width,height:video.height},SIZE,'1920 × 1080');
  assert.equal(video.codec,'avc1','H.264 video');assert.equal(Math.round(video.fps),FPS,'30 frames a second');
  assert.equal(audio?.codec,'mp4a','AAC sound');assert.equal(audio.channels,2,'in stereo');
  assert.ok(Math.abs(info.seconds-trailerSeconds())<0.1,`as long as its clips and end card make it (${info.seconds} s)`);
  assert.ok(bytes.length*8/info.seconds/1000>=MIN_KBPS,'at Steam’s 5,000 kbps or more');
  assert.deepEqual(entry.clips.map(c=>c.id),CLIPS.map(c=>c.id),'every clip, in order');
  for(const [i,c] of entry.clips.entries()){
    assert.equal(c.frames,frames(CLIPS[i]),`${c.id}: recorded in full`);
    assert.ok(/^[0-9a-f]{64}$/.test(c.saveSha256)&&c.quality==='high',`${c.id}: from a recorded save, at High quality`);
    assert.deepEqual(c.play,CLIPS[i].play,`${c.id}: with the keys the script presses`);
  }
  assert.equal(entry.music.sha256,imageDigest(await readFile(new URL(`../${MUSIC}`,import.meta.url))),'its music is the game’s own');
});

test('the renders the capsules are drawn from are kept, at their images’ sizes, so the name can be drawn again without rendering',async()=>{
  for(const a of STORE_ART.filter(a=>a.render&&a.name))
    assert.deepEqual(jpegSize(await readFile(new URL(`../${renderFile(a)}`,import.meta.url))),{width:a.width,height:a.height},renderFile(a));
});
