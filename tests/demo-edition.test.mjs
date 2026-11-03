import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as G from '../src/core/game.js';
import {chapterFlatAssets,chapterOfflineAssets} from '../src/ui/art.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {heroFacts} from '../src/ui/landing-view.js';
import {settingsView} from '../src/ui/settings-view.js';
import {defaultSettings} from '../src/ui/settings.js';
import {allChaptersLabel,buildEdition,demoEdition,demoLastChapter,pastDemo,pastDemoMessage,storeUrl} from '../src/ui/platform.js';
import {DEMO_KEPT,DEMO_LAST_CHAPTER,laterChapterOnly,sourceAssetUrls} from '../scripts/edition.mjs';
import {initialAssets,staticImportClosure} from '../scripts/module-closure.mjs';

// The web demo (the Steam plan, docs/steam-plan.md, S2): Chapters I–III, ending at Chapter III's promotion. Its limit
// comes from the build, never the save, so every demo save is a full-game save; the full game is unchanged.

const root=fileURLToPath(new URL('..',import.meta.url));
let route;
// The frozen v0.16 route: New Game and legal commands only. Replayed to just before an advance, it holds a promotion.
async function promotionOf(chapter){
  route??=JSON.parse(await readFile(new URL('./compatibility/campaign-v016-route.json',import.meta.url),'utf8'));
  const state=G.deserialize(JSON.stringify(route.initial));
  for(const item of route.trace){
    if(item.kind==='advanceChapter'&&state.chapter===chapter)break;
    assert.ok(G[item.kind](state,...item.args).ok,item.kind);
  }
  assert.equal(state.phase,'promotion');assert.equal(state.chapter,chapter);
  return state;
}

test('the source and the full game have no demo: every helper says so',()=>{
  assert.equal(buildEdition(),'full');assert.equal(demoLastChapter(),null);assert.equal(demoEdition(),null);assert.equal(storeUrl(),'');
  assert.equal(pastDemo({chapter:9}),false,'the full game plays every chapter');
  assert.equal(allChaptersLabel(),'all twelve chapters');assert.equal(allChaptersLabel({lastChapter:3}),'all three chapters of the demo');
  assert.equal(pastDemo({chapter:4},{lastChapter:3}),true);assert.equal(pastDemo({chapter:3},{lastChapter:3}),false);assert.equal(pastDemo(null,{lastChapter:3}),false);
  assert.match(pastDemoMessage({chapter:5},{lastChapter:3}),/reached Chapter V, past the end of the demo with Chapter III\. Continue it in the full game\./);
});

test('the demo refuses to advance past its last chapter, changing nothing, and advances before it',async()=>{
  const third=await promotionOf(3),before=G.serialize(third);
  const refused=G.advanceChapter(third,{lastChapter:3});
  assert.equal(refused.ok,false);assert.match(refused.message,/The demo ends with Chapter III\. Keep a save code to continue this chronicle in the full game\./);
  assert.equal(G.serialize(third),before,'the whole state, its random generator included, is unchanged');
  const second=await promotionOf(2);
  assert.ok(G.advanceChapter(second,{lastChapter:3}).ok,'the demo plays Chapter III');assert.equal(second.chapter,3);
  const unlimited=await promotionOf(3);
  assert.ok(G.advanceChapter(unlimited).ok,'the full game has no limit');assert.ok(G.advanceChapter(await promotionOf(3),{lastChapter:null}).ok);
  assert.equal(unlimited.chapter,4);
});

test('a demo save is the full game’s: it validates, and the full game advances it',async()=>{
  const demo=await promotionOf(3);assert.equal(G.advanceChapter(demo,{lastChapter:DEMO_LAST_CHAPTER}).ok,false);
  const carried=G.deserialize(G.serialize(demo));
  assert.deepEqual(carried.completed,[1,2]);assert.equal(carried.phase,'promotion');
  assert.ok(G.advanceChapter(carried).ok);assert.equal(carried.chapter,4);assert.deepEqual(carried.completed,[1,2,3]);
});

test('Chapter XII’s accession is refused before any change when its milestones are missing',async()=>{
  const last=await promotionOf(12);last.milestones=last.milestones.filter(m=>m!=='confrontation');
  const before=G.serialize(last),r=G.advanceChapter(last);
  assert.equal(r.ok,false);assert.match(r.message,/Accession requires both Senate admission and the final confrontation/);
  assert.equal(G.serialize(last),before,'no chapter milestone, promotion or capability was granted first');
});

test('the demo build leaves out exactly the files only later chapters use, and keeps everything the demo shows',async()=>{
  const assets=await sourceAssetUrls(root),initial=initialAssets(assets,{shellModules:await staticImportClosure(root,'src/ui/app.js'),openingArt:[]});
  const omitted=new Set(laterChapterOnly(assets,{initial,lastChapter:3}));
  const demoFiles=new Set([...initial,...[1,2,3].flatMap(n=>[...chapterOfflineAssets(n,assets),...chapterFlatAssets(n)])]);
  assert.ok(omitted.size>50,`${omitted.size} files left out`);
  for(const url of omitted){
    assert.ok(!demoFiles.has(url),`${url} is used by the demo's chapters`);assert.ok(!url.endsWith('.js'),`${url}: no module is left out`);
    assert.ok([4,5,6,7,8,9,10,11,12].some(n=>chapterOfflineAssets(n,assets).includes(url)||chapterFlatAssets(n).includes(url)),`${url} belongs to a later chapter`);
  }
  for(const url of DEMO_KEPT)assert.ok(assets.includes(url)&&!omitted.has(url),`${url} stays`);
  for(const url of assets.filter(u=>u.startsWith('./assets/site/')||u.startsWith('./showcase/')))assert.ok(!omitted.has(url),`${url}: in no pack, it stays`);
  // The demo's title page shows nothing it leaves out.
  const page=createCampaignViews(()=>({state:null,screen:'title',settings:defaultSettings(),saving:false,lastSaved:'',saveProblem:'',saveConflict:false,offline:false,
    currentChapterOffline:false,offlineProgress:'',demo:{lastChapter:3,storeUrl:''}})).titleView();
  const shown=[...page.matchAll(/(?:src|data-src)="(\.\/[^"]+)"/g)].map(m=>m[1]);
  assert.ok(shown.length>=5);for(const url of shown)assert.ok(!omitted.has(url),`the title shows ${url}`);
});

const promotionPage=(state,demo)=>createCampaignViews(()=>({state,screen:'game',settings:defaultSettings(),saving:false,offline:false,demo})).promotion();

test('Chapter III’s promotion in the demo is the End of the demo: the full game, Steam and a save code',async()=>{
  const third=await promotionOf(3),before=G.serialize(third);
  const coming=promotionPage(third,{lastChapter:3,storeUrl:''});
  assert.match(coming,/END OF THE DEMO/);assert.match(coming,/Chapters IV to XII take your soldier/);assert.match(coming,/data-cmd="export">Keep a save code</);
  assert.match(coming,/The full game is coming to Steam\./);assert.doesNotMatch(coming,/data-cmd="advance"/,'no appointment to accept in the demo');
  const linked=promotionPage(third,{lastChapter:3,storeUrl:'https://store.example/app/1/Imperium/'});
  assert.match(linked,/<a class="demo-store" href="https:\/\/store\.example\/app\/1\/Imperium\/" target="_blank" rel="noopener noreferrer">Continue on Steam/);
  assert.match(promotionPage(third,null),/data-cmd="advance">Accept the appointment →/,'the full game offers the appointment');
  assert.match(promotionPage(await promotionOf(2),{lastChapter:3,storeUrl:''}),/data-cmd="advance"/,'Chapter II’s promotion in the demo advances');
  assert.equal(G.serialize(third),before,'presentation only');
});

test('the demo’s title, facts and offline wording say what it plays; a later chronicle is held with its save code',async()=>{
  const view=(context)=>createCampaignViews(()=>({state:null,screen:'title',settings:defaultSettings(),saving:false,lastSaved:'',saveProblem:'',saveConflict:false,offline:false,
    currentChapterOffline:false,offlineProgress:'',...context}));
  const demo={lastChapter:3,storeUrl:''},page=view({demo}).titleView(),full=view({demo:null}).titleView();
  assert.match(page,/FREE DEMO · CHAPTERS I–III OF XII/);assert.match(page,/<strong>Free demo<\/strong><span>Chapters I–III of 12<\/span>/);
  assert.match(page,/<strong>6 encounters<\/strong><span>Then the full game on Steam<\/span>/);assert.match(view({demo}).footer(),/· Free demo</);
  assert.doesNotMatch(full,/FREE DEMO|Free demo/);assert.match(full,/A ROMAN TACTICAL CHRONICLE/);assert.match(view({demo:null}).footer(),/Free browser play/);
  assert.match(heroFacts({demo}),/In your browser/);assert.match(heroFacts(),/Free to play/);
  const later=(await promotionOf(5));
  const held=view({demo,heldChronicle:later}).titleView();
  assert.match(held,/class="held-chronicle"/);assert.match(held,/reached Chapter V, past the end of the demo with Chapter III/);assert.match(held,/data-cmd="export-held">Keep its save code</);
  assert.doesNotMatch(view({demo:null,heldChronicle:null}).titleView(),/held-chronicle/);
  const settings=page=>settingsView({settings:defaultSettings(),state:null,offline:true,currentChapterOffline:false,offlineProgress:'',preservedUnreadable:0,keymap:null,devMenu:false,desktopApp:null,demo:page},{page:'saves'});
  assert.match(settings(demo),/All three chapters of the demo are available offline\./);assert.match(settings(null),/All twelve chapters are available offline\./);
});
