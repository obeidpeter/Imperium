import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as G from '../src/core/game.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {DECORATIONS,DECORATION_AWARDS,TITLES} from '../src/data/soldier.js';
import {ERRANDS} from '../src/data/dialogue.js';
import {LIVING_ERRANDS} from '../src/data/living-camps.js';
import {ACHIEVEMENTS} from '../src/data/achievements.js';
import {earnedAchievements} from '../src/core/achievements.js';
import {reportAchievements} from '../src/ui/platform.js';
import {steamAchievementsSheet} from '../scripts/steam-achievements.mjs';
import {iconSpec} from '../scripts/steam-achievement-icons.mjs';

// Steam achievements (the Steam plan, S3): the owner's 35, with English names and those tied to Chapters IV–XII hidden.
// They are read from what a chronicle records, never granted, and the desktop app reports them to Steam.

const ids=list=>list.map(a=>a.id);
const of=group=>ACHIEVEMENTS.filter(a=>a.group===group);
async function finishedCampaign(){
  const route=JSON.parse(await readFile(new URL('./compatibility/campaign-v016-route.json',import.meta.url),'utf8'));
  const state=G.deserialize(JSON.stringify(route.initial));
  for(const item of route.trace)assert.ok(G[item.kind](state,...item.args).ok,item.kind);
  return state;
}

test('the approved list: 35 achievements, one for each chapter, decoration, title, finale route and way of finishing',()=>{
  assert.equal(ACHIEVEMENTS.length,35);assert.equal(new Set(ids(ACHIEVEMENTS)).size,35,'API names are unique');
  for(const a of ACHIEVEMENTS){
    assert.match(a.id,/^ACH_[A-Z0-9_]{1,60}$/,`${a.id}: an API name the desktop app accepts`);
    assert.ok(a.name.trim()&&a.description.trim(),`${a.id} has a name and a description`);assert.ok(Object.isFrozen(a));
  }
  assert.deepEqual(of('chapter').map(a=>a.name),CHAPTERS.map(c=>c.title),'chapters are named after their titles');
  assert.deepEqual(of('decoration').map(a=>a.earned.decoration).sort(),Object.keys(DECORATIONS).sort());
  assert.deepEqual(of('title').map(a=>a.earned.title).sort(),Object.keys(TITLES).sort());
  assert.deepEqual(of('route').map(a=>a.earned.route),G.quartermasterForecast(G.newGame('Routes')).finaleRoutes.map(r=>r.id));
  assert.deepEqual(of('finish').map(a=>a.earned.finish),['veteran','iron']);
  assert.ok(!ACHIEVEMENTS.some(a=>/corona|armillae|torques|phalerae|hasta/i.test(a.name)),'English names for the decorations');
});

test('the owner’s cut-off: what ties to Chapters IV–XII is hidden, and only that',()=>{
  const chapterOf=encounter=>CHAPTERS.find(c=>c.encounters.some(e=>e.id===encounter))?.id;
  const errands=[...Object.values(ERRANDS),...Object.values(LIVING_ERRANDS)].filter(e=>e.reward?.title);
  for(const a of ACHIEVEMENTS){
    const e=a.earned,chapter=e.chapter??(e.decoration?chapterOf(DECORATION_AWARDS.find(d=>d.decoration===e.decoration).encounter)
      :e.title?errands.find(x=>x.reward.title===e.title).chapter:e.route?12:null);
    assert.equal(a.hidden,chapter!=null&&chapter>=4,`${a.id} (Chapter ${chapter??'any'})`);
  }
  assert.equal(ACHIEVEMENTS.filter(a=>a.hidden).length,24);
});

test('a finished campaign earns its chapters and its route, read without changing anything',async()=>{
  const state=await finishedCampaign(),before=G.serialize(state);
  assert.deepEqual(ids(earnedAchievements(state)),[...of('chapter').map(a=>a.id),'ACH_ROUTE_BACKER']);
  assert.deepEqual(earnedAchievements(state),earnedAchievements(state),'the same chronicle, the same answer');
  assert.equal(G.serialize(state),before,'nothing changed, the random generator included');
  assert.deepEqual(earnedAchievements(null),[]);assert.deepEqual(earnedAchievements({...state,archiveReplay:{}}),[],'a Practice replay earns nothing');
  const fresh=G.newGame('Fresh');assert.deepEqual(earnedAchievements(fresh),[],'New Game has earned nothing');
});

test('an injected record: decorations, titles and the two finishes are read from it',async()=>{
  // Injected scenario: a record set by the test, to show what each kind of achievement reads. Play never sets these.
  const state=G.newGame('Record',275,{featureEdition:35,progression:true});
  state.soldier.decorations=Object.keys(DECORATIONS);state.soldier.titles=Object.keys(TITLES);
  const earned=new Set(ids(earnedAchievements(state)));
  for(const a of [...of('decoration'),...of('title')])assert.ok(earned.has(a.id),a.id);
  assert.ok(!earned.has('ACH_FINISH_VETERAN')&&!earned.has('ACH_FINISH_IRON'),'no finish before the accession');
  const finished=await finishedCampaign();
  assert.deepEqual(ids(earnedAchievements({...finished,difficulty:'veteran',ironDiscipline:true})).slice(-2),['ACH_FINISH_VETERAN','ACH_FINISH_IRON']);
  assert.ok(!ids(earnedAchievements({...finished,difficulty:'veteran',phase:'promotion'})).includes('ACH_FINISH_VETERAN'),'the accession is the finish');
});

test('docs/steam-achievements.md is in step with the list: run node scripts/steam-achievements.mjs',async()=>{
  assert.equal(await readFile(new URL('../docs/steam-achievements.md',import.meta.url),'utf8'),steamAchievementsSheet());
  const sheet=steamAchievementsSheet();for(const a of ACHIEVEMENTS)assert.ok(sheet.includes(`| \`${a.id}\` | ${a.name} |`),a.id);
});

test('the desktop app reports what the chronicle has earned, and nothing elsewhere',async()=>{
  const state=await finishedCampaign(),calls=[];
  const bridge={steam:{unlock:async list=>{calls.push(list);return {available:true,unlocked:list.slice(0,2)};}}};
  assert.deepEqual(await reportAchievements(state,{bridge}),['ACH_CHAPTER_01','ACH_CHAPTER_02']);
  assert.deepEqual(calls,[ids(earnedAchievements(state))]);
  assert.deepEqual(await reportAchievements(state),[],'the web has no bridge');
  assert.deepEqual(await reportAchievements(G.newGame('None'),{bridge}),[],'nothing earned, nothing reported');assert.equal(calls.length,1);
  assert.deepEqual(await reportAchievements(state,{bridge:{steam:{unlock:async()=>{throw new Error('Steam is closed');}}}}),[],'a failure is never the game’s');
  // The app's Steam module (desktop/steam.cjs) does nothing without a Steam App ID.
  const steam=createRequire(import.meta.url)('../desktop/steam.cjs');
  assert.equal(process.env.IMPERIUM_STEAM_APP_ID,undefined);
  assert.deepEqual(steam.start(),{available:false,reason:'No Steam App ID is set.'});assert.deepEqual(steam.unlock(['ACH_CHAPTER_01']),{available:false,unlocked:[]});
});

// A JPEG's size, from its frame header.
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

test('every achievement has its icon and locked copy for Steamworks, from the game’s own art: run node scripts/steam-achievement-icons.mjs',async()=>{
  const dir=new URL('../desktop/steam/achievement-icons/',import.meta.url),files=(await readdir(dir)).sort();
  assert.deepEqual(files,ACHIEVEMENTS.flatMap(a=>[`${a.id}.jpg`,`${a.id}_locked.jpg`]).sort(),'one icon and one locked copy each, and nothing else');
  for(const file of files)assert.deepEqual(jpegSize(await readFile(new URL(file,dir))),{width:64,height:64},file);
  const specs=ACHIEVEMENTS.map(iconSpec);
  for(const [i,spec] of specs.entries()){
    if(spec.src)assert.ok(existsSync(new URL(`../${spec.src.slice(2)}`,import.meta.url)),`${ACHIEVEMENTS[i].id}: ${spec.src} ships with the game`);
    if(spec.kind==='item')assert.ok(Array.isArray(spec.cell),`${ACHIEVEMENTS[i].id}: ${spec.item} is in the item atlas`);
  }
  const pictures=specs.filter(s=>s.kind==='item').map(s=>s.cell.join(','));
  assert.equal(new Set(pictures).size,pictures.length,'no two icons share an item picture');
  assert.equal(new Set(specs.filter(s=>s.kind==='scene').map(s=>`${s.src}@${s.x}`)).size,12,'each chapter its own view');
});
