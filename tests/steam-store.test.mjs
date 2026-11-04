import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CHAPTERS} from '../src/data/campaign.js';
import {DECORATIONS,TITLES} from '../src/data/soldier.js';
import {ITEMS} from '../src/data/items.js';
import {ACHIEVEMENTS} from '../src/data/achievements.js';
import {KINDS,sourceKind,aiInventory,storeText,steamAiDisclosureSheet} from '../scripts/steam-ai-disclosure.mjs';

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
