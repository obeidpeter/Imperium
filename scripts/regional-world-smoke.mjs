// All twelve walkable hubs on one isolated production origin. Checkpoints are
// earned by public commands under Node, then imported through the player UI.
// One browser context deliberately crosses every region and returns to its
// starting chapter: scenery residency must retire each previous working set.
// Build first. --output DIR --dist DIR --headed; --checkpoints-only earns and
// exports review saves without starting Chromium. --chapters 1,2,8,11 is a
// partial camera/asset diagnostic only, never full release acceptance.
// No wall-clock FPS assertion.
import assert from 'node:assert/strict';
import http from 'node:http';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {serveRequest} from './serve.mjs';
import {menuCommand,revealControl,settingsCommand,closePanel} from './ui-smoke-navigation.mjs';
import {runRealtimeCampaign} from './realtime-autoplay.mjs';
import * as Game from '../src/core/game.js';
import {saveCode,restoreCode} from '../src/ui/storage.js';
import {sceneryPlacements} from '../src/showcase/scenery-models.js';
import {CONFIG} from '../src/config.js';

const arg=(name,fallback)=>{const prefix=`--${name}=`,same=process.argv.find(a=>a.startsWith(prefix)),index=process.argv.indexOf(`--${name}`);return same?same.slice(prefix.length):index>=0?process.argv[index+1]:fallback;};
const dist=resolve(arg('dist',fileURLToPath(new URL('../dist/',import.meta.url))));
const output=resolve(arg('output',fileURLToPath(new URL('../tests/visual-results/regional-world/',import.meta.url))));
const chapterFilter=arg('chapters',null),partial=chapterFilter!==null;
const requestedChapters=partial?chapterFilter.split(',').map(value=>Number(value.trim())):null;
if(partial)assert.ok(requestedChapters.length>0&&requestedChapters.every(chapter=>Number.isInteger(chapter)&&chapter>=1&&chapter<=12)&&new Set(requestedChapters).size===requestedChapters.length,
  '--chapters must be a comma-separated list of distinct chapter numbers from 1 to 12');
await access(join(dist,'index.html')).catch(()=>{throw new Error('Build first: node scripts/build.mjs');});
const build=JSON.parse(await readFile(join(dist,'build-report.json'),'utf8'));
let playwright;
for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){
  try{const m=await import(isAbsolute(specifier)?pathToFileURL(specifier).href:specifier);playwright=m.chromium?m:m.default;break;}catch{}
}
if(!process.argv.includes('--checkpoints-only'))assert.ok(playwright?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright module.');

// Clone a legitimately won encounter, commit through the public transaction,
// and advance through the public promotion command. The campaign continues
// separately; no flags, progress, rewards, locations or worlds are injected.
const checkpoints=new Map([[1,Game.newGame('Aurelius Marcellus',275,{featureEdition:35,progression:true,difficulty:'standard'})]]);
const earned=runRealtimeCampaign({throughChapter:11,ready:Array.from({length:12},(_,i)=>i+1),seed:275,
  onEncounter(state){
    const next=Game.deserialize(Game.serialize(state));
    assert.ok(Game.commitEncounter(next).ok);
    if(next.phase==='promotion')assert.ok(Game.advanceChapter(next).ok);
    if(next.phase==='camp'&&!checkpoints.has(next.chapter))checkpoints.set(next.chapter,next);
  }});
assert.deepEqual([...checkpoints.keys()],[1,2,3,4,5,6,7,8,9,10,11,12]);
const chapters=[];
for(const [chapter,state]of checkpoints){
  const code=await saveCode(state);assert.equal(Game.serialize(await restoreCode(code)),Game.serialize(state));
  const world=Game.createCampWorld(state);assert.ok(world,`Chapter ${chapter} has a real camp world`);
  const scene={id:world.campId,width:world.map.width,height:world.map.height,terrain:world.map.terrain,campPresentation:world.campPresentation};
  const placements=sceneryPlacements(scene,{chapter}),urls=[...new Set(placements.map(p=>p.url))];
  assert.ok(placements.length>0&&urls.length>0,`Chapter ${chapter} has authored regional scenery`);
  chapters.push({chapter,code,expectedModels:placements.length,urls,sha256:createHash('sha256').update(code).digest('hex')});
}
const tour=partial?requestedChapters.map(chapter=>chapters.find(checkpoint=>checkpoint.chapter===chapter)):chapters;
await mkdir(output,{recursive:true});
const checkpointReceipt={seed:275,method:'New Game and public legal commands only; won encounters cloned, committed and advanced through the public campaign API',
  priorEncounters:earned.encounters.map(e=>({id:e.id,status:e.status})),chapters:chapters.map(c=>({chapter:c.chapter,sha256:c.sha256}))};
await mkdir(join(output,'checkpoints'),{recursive:true});
for(const checkpoint of chapters)await writeFile(join(output,'checkpoints',`chapter-${String(checkpoint.chapter).padStart(2,'0')}.save`),checkpoint.code+'\n');
await writeFile(join(output,'checkpoints','provenance.json'),JSON.stringify(checkpointReceipt,null,2)+'\n');
if(process.argv.includes('--checkpoints-only')){
  console.log(`Earned ${chapters.length} regional camp saves through ${earned.encounters.length} legal encounters: ${join(output,'checkpoints')}`);
  process.exit(0);
}
const server=http.createServer((req,res)=>serveRequest(req,res,dist));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await playwright.chromium.launch({headless:!process.argv.includes('--headed'),executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:1270,height:720},serviceWorkers:'block'}),page=await context.newPage();
page.setDefaultTimeout(30000);
const report={method:'Production Chromium, one context, UI Restore of legal-command campaign saves, visible cameras/settings/services, read-only world and render diagnostics',
  build:build.revision,browser:browser.version(),physicalDeviceTest:false,softwareRendering:true,
  scope:partial?'partial camera and asset diagnostic; not full release acceptance':'full twelve-chapter acceptance',
  fullAcceptance:!partial,selectedChapters:tour.map(checkpoint=>checkpoint.chapter),
  checkpoint:checkpointReceipt,
  checks:[],captures:[],residency:[],errors:[],expectedUnavailableResponses:[],expectedUnavailableConsole:[]};
page.on('pageerror',error=>report.errors.push(error.message));
let simulatingUnavailable=false;
page.on('console',message=>{
  if(message.type()!=='error')return;
  const text=message.text(),location=message.location().url;
  // Only the exact deliberately failed GLB request errors are expected. Any
  // JavaScript error, unrelated request or different status still fails.
  if(simulatingUnavailable&&location?.split('?')[0].endsWith('.glb')&&/Failed to load resource.*503/.test(text))report.expectedUnavailableConsole.push({location,text});
  else report.errors.push(text);
});
const assetResponses=new Map();page.on('response',response=>{
  const path=new URL(response.url()).pathname;
  if(path.endsWith('.glb')){assetResponses.set(path,response.status());if(simulatingUnavailable&&response.status()===503)report.expectedUnavailableResponses.push(path);}
});
const record=(name,detail={})=>{report.checks.push({name,pass:true,...detail});console.log(`ok - ${name}`);};
const stats=()=>page.evaluate(()=>JSON.parse(document.querySelector('#rt-board').dataset.renderStats));
async function pause(on=true){
  if(await page.evaluate(()=>window.__realtime.paused())!==on){await page.locator('#rt-board').focus();await page.keyboard.press('KeyP');}
  await page.waitForFunction(value=>window.__realtime.paused()===value,on);
}
async function ready(checkpoint,quality='balanced',{unavailable=false}={}){
  await page.waitForFunction(ch=>window.__realtime?.world()?.campId===`ch${ch}-camp`,checkpoint.chapter,{timeout:120000});
  await page.waitForSelector('.world-courtyard .rt-scene[data-ready="true"]',{timeout:120000});
  const count=quality==='performance'||unavailable?0:checkpoint.expectedModels,n=quality==='performance'||unavailable?0:checkpoint.urls.length;
  await page.waitForFunction(({count,n,quality})=>{
    const board=document.querySelector('#rt-board');if(Number(board?.dataset.sceneryModels)!==count)return false;
    try{const stats=JSON.parse(board.dataset.renderStats),cache=stats.sceneryResidency;
      return stats.quality===quality&&cache.loaded===n&&cache.entries===n&&cache.leases===n&&cache.loading===0;
    }catch{return false;}
  },{count,n,quality},{timeout:120000});
  const observed=await stats();
  report.residency.push({chapter:checkpoint.chapter,quality,unavailable,expectedUniqueAssets:n,cache:observed.sceneryResidency,textures:observed.textures,geometries:observed.geometries});
}
async function restore(checkpoint){
  await settingsCommand(page,'restore');await page.locator('#restore-code').fill(checkpoint.code);
  await page.locator('[data-cmd="import-code"]').click();
  await page.locator('[data-cmd="confirm-import"]').waitFor({state:'visible'});
  const closed=page.locator('#modal').evaluate(modal=>new Promise(resolve=>modal.addEventListener('close',()=>resolve(),{once:true})));
  await page.locator('[data-cmd="confirm-import"]').click();await closed;await ready(checkpoint);
  await pause(false);
  await page.waitForFunction(({chapter,key})=>{
    try{return window.__realtime.world().tick>0&&JSON.parse(JSON.parse(localStorage.getItem(key)).payload).soldier.flags[`visited:${chapter}:gate`]===true;}catch{return false;}
  },{chapter:checkpoint.chapter,key:CONFIG.saveKey},{timeout:30000});
}
async function exported(){
  await settingsCommand(page,'export');const code=await page.locator('#save-code').inputValue();await closePanel(page);
  return Game.serialize(await restoreCode(code));
}
async function camera(mode,key){
  await page.locator('#rt-board').focus();await page.keyboard.press(key);
  await page.waitForFunction(expected=>{try{return JSON.parse(document.querySelector('#rt-board').dataset.renderStats).cameraView===expected;}catch{return false;}},mode);
}
async function screenshot(name){
  await pause();await page.locator('#rt-board').scrollIntoViewIfNeeded();
  // Software rendering takes seconds a frame over the photographed ground; the
  // capture waits behind them (as the campaign benchmark's stage captures do).
  await page.screenshot({path:join(output,name),fullPage:false,timeout:120000});report.captures.push(name);
}
async function services(checkpoint){
  const before=await exported();
  for(const id of ['kit','company']){
    await (await revealControl(page,`[data-cmd="soldier-panel"][data-id="${id}"]`)).click();
    await page.locator('#modal[open]').waitFor({state:'visible'});await closePanel(page);
  }
  await (await revealControl(page,'[data-cmd="conversation"][data-id="table"]')).click();
  await page.locator('#modal .modal-back').click();assert.equal(await page.locator('#panel-title').textContent(),'Menu');await closePanel(page);
  const preparation=page.locator('#camp-preparation');
  if(!await preparation.evaluate(element=>element.open))await preparation.locator(':scope > summary').click();
  assert.equal(await preparation.evaluate(element=>element.open),true);
  assert.equal(await exported(),before,'Browsing direct services and preparation preserves the complete campaign save');
  await pause();const peacefulBefore=await page.evaluate(()=>JSON.stringify(window.__realtime.world()));
  await page.locator('#rt-board').focus();await page.keyboard.press('Space');
  await page.waitForFunction(()=>/Weapons stay sheathed/.test(document.querySelector('[data-role="eventLine"]')?.textContent??''));
  await page.keyboard.press('Shift+KeyT');await page.keyboard.press('Shift+Enter');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__realtime.world())),peacefulBefore);
  record(`Chapter ${checkpoint.chapter}: direct services, panel Back and peaceful controls protect the save`);
}
async function narrow(chapter){
  await page.setViewportSize({width:390,height:844});
  const geometry=await page.evaluate(()=>{
    const canvas=document.querySelector('#rt-board').getBoundingClientRect();
    const panels=[...document.querySelectorAll('.rt-top,.rt-hud,.rt-status-strip,.rt-support,.rt-deploy')].filter(el=>el.checkVisibility({checkVisibilityCSS:true}));
    return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,canvasHeight:canvas.height,
      overlap:panels.filter(el=>{const r=el.getBoundingClientRect();return Math.min(r.right,canvas.right)-Math.max(r.left,canvas.left)>1&&Math.min(r.bottom,canvas.bottom)-Math.max(r.top,canvas.top)>1;}).map(el=>el.className)};
  });
  assert.ok(geometry.documentWidth<=geometry.width+1);assert.ok(geometry.canvasHeight>=318);assert.deepEqual(geometry.overlap,[]);
  await screenshot(`chapter-${String(chapter).padStart(2,'0')}-narrow.png`);await page.setViewportSize({width:1270,height:720});
  record(`Chapter ${chapter}: narrow viewport retains a useful unobstructed scene`,geometry);
}
try{
  await page.goto(`${base}?dev`);await menuCommand(page,'settings');
  await (await revealControl(page,'#controls-model')).selectOption('realtime');await closePanel(page);
  await menuCommand(page,'settings');await (await revealControl(page,'#battle-view')).selectOption('3d');
  await (await revealControl(page,'#graphics-quality')).selectOption('balanced');await closePanel(page);
  for(const checkpoint of tour){
    await restore(checkpoint);await pause();
    assert.equal(await page.evaluate(()=>window.__realtime.world().peaceful),true);
    for(const url of checkpoint.urls)assert.equal(assetResponses.get(new URL(url,base).pathname),200,`Chapter ${checkpoint.chapter}: ${url} loads locally`);
    for(const [mode,key]of [['follow','KeyF'],['horizon','KeyH'],['overview','KeyZ']]){
      await camera(mode,key);
      if(mode==='horizon')await screenshot(`chapter-${String(checkpoint.chapter).padStart(2,'0')}-horizon.png`);
    }
    record(`Chapter ${checkpoint.chapter}: every regional asset loads, all three cameras work and previous scenery retires`,{placements:checkpoint.expectedModels,uniqueAssets:checkpoint.urls.length,assets:checkpoint.urls});
    if(!partial&&[1,8,12].includes(checkpoint.chapter)){await services(checkpoint);await narrow(checkpoint.chapter);}
  }
  if(!partial){
  // Performance removes generated masters, preserving the procedural camp;
  // returning to Balanced reacquires only the present chapter's working set.
  const last=chapters.at(-1);
  await menuCommand(page,'settings');await (await revealControl(page,'#graphics-quality')).selectOption('performance');await closePanel(page);
  await ready(last,'performance');await screenshot('chapter-12-performance.png');
  record('Performance quality releases every generated scenery master while retaining the playable camp');
  await menuCommand(page,'settings');await (await revealControl(page,'#graphics-quality')).selectOption('balanced');await closePanel(page);
  await ready(last);await restore(chapters[0]);await pause();await camera('horizon','KeyH');
  await screenshot('chapter-01-return.png');
  assert.deepEqual(report.residency.at(-1).cache,report.residency[0].cache,'Returning to Chapter I retains only its original working set');
  record('Returning across all regions restores Chapter I without accumulating scenery masters');
  // A real HTTP failure with an empty module cache tests the shipped fallback
  // path, including generated bodies. No scene/state/debug hook is replaced.
  simulatingUnavailable=true;
  await page.route('**/*.glb',route=>route.fulfill({status:503,contentType:'text/plain',body:'Unavailable model, deliberately simulated by regional-world acceptance'}));
  await page.reload();await page.locator('[data-cmd="continue"]:visible').first().click();
  await ready(chapters[0],'balanced',{unavailable:true});await pause(false);
  assert.ok(report.expectedUnavailableResponses.length>0,'The fallback check exercised actual failed model requests');
  for(const url of chapters[0].urls)assert.ok(report.expectedUnavailableResponses.includes(new URL(url,base).pathname),`${url} was unavailable in the fallback check`);
  const fallbackStats=await stats();assert.ok(fallbackStats.calls>0&&fallbackStats.geometries>0,'The procedural scene still paints');
  const beforeMove=await page.evaluate(()=>{const world=window.__realtime.world(),hero=world.actors.find(a=>a.id===world.controlled);return {tick:world.tick,x:hero.x,z:hero.z};});
  await page.locator('#rt-board').focus();await page.keyboard.down('ArrowRight');
  try{await page.waitForFunction(before=>{const world=window.__realtime.world(),hero=world.actors.find(a=>a.id===world.controlled);return world.tick>=before.tick+10&&Math.hypot(hero.x-before.x,hero.z-before.z)>.1;},beforeMove,{timeout:30000});}
  finally{await page.keyboard.up('ArrowRight');}
  await pause();await camera('horizon','KeyH');await screenshot('chapter-01-all-models-unavailable.png');
  await (await revealControl(page,'[data-cmd="conversation"][data-id="table"]')).click();
  await page.locator('#modal[open]').waitFor({state:'visible'});await closePanel(page);
  record('With every model request unavailable, the procedural camp still renders, moves and opens its direct services',
    {failedRequests:report.expectedUnavailableResponses.length,cache:fallbackStats.sceneryResidency});
  }
  assert.deepEqual(report.errors,[],'No browser console or runtime errors');report.pass=true;
}catch(error){
  report.pass=false;report.failure=error.stack??String(error);process.exitCode=1;console.error(report.failure);
  try{await page.screenshot({path:join(output,'failure.png'),fullPage:false});report.captures.push('failure.png');}catch{}
}finally{
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
console.log(`${partial?'PARTIAL DIAGNOSTIC (not full release acceptance)':'Regional world acceptance'} report: ${join(output,'report.json')}`);
