// Chapter V pilot acceptance on an isolated production origin. Checkpoints are
// earned once under Node; every browser action uses the visible player UI.
// Browser evaluation only reads DOM, diagnostics and the current world.
// Build first. Optional: --output=DIR --dist=DIR --river-gate --headed.
import assert from 'node:assert/strict';
import http from 'node:http';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {serveRequest} from './serve.mjs';
import {menuCommand,revealControl,settingsCommand,closePanel} from './ui-smoke-navigation.mjs';
import {runRealtimeCampaign,playRealtime} from './realtime-autoplay.mjs';
import * as Game from '../src/core/game.js';
import {saveCode,restoreCode} from '../src/ui/storage.js';
import {worldHash,step} from '../src/core/realtime/simulation.js';
import {sceneryPlacements} from '../src/showcase/scenery-models.js';
import {CONFIG} from '../src/config.js';

const arg=(name,fallback)=>{const prefix=`--${name}=`,same=process.argv.find(a=>a.startsWith(prefix)),index=process.argv.indexOf(`--${name}`);return same?same.slice(prefix.length):index>=0?process.argv[index+1]:fallback;};
const dist=resolve(arg('dist',fileURLToPath(new URL('../dist/',import.meta.url))));
const output=resolve(arg('output',fileURLToPath(new URL('../tests/visual-results/ch5-pilot/',import.meta.url))));
await access(join(dist,'index.html')).catch(()=>{throw new Error('Build first: node scripts/build.mjs');});
const build=JSON.parse(await readFile(join(dist,'build-report.json'),'utf8'));
let playwright;
for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){
  try{const m=await import(isAbsolute(specifier)?pathToFileURL(specifier).href:specifier);playwright=m.chromium?m:m.default;break;}catch{}
}
assert.ok(playwright?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright module.');
const earned=runRealtimeCampaign({throughChapter:4,ready:[1,2,3,4],seed:275}),camp=earned.state;
assert.equal(camp.chapter,5);assert.equal(camp.phase,'camp');assert.equal(camp.decisions.ch5,undefined);
const code=await saveCode(camp);
assert.equal(Game.serialize(await restoreCode(code)),Game.serialize(camp));
let riverCode;
if(process.argv.includes('--river-gate')){
  const river=Game.deserialize(Game.serialize(camp));assert.ok(Game.choose(river,'civilians').ok);
  assert.ok(Game.startEncounter(river,{controls:'realtime'}).ok);assert.equal(playRealtime(river).status,'won');
  assert.ok(Game.commitEncounter(river).ok);assert.equal(river.encounterIndex,1);riverCode=await saveCode(river);
}
const campWorld=Game.createCampWorld(camp),campBase={id:campWorld.campId,width:campWorld.map.width,height:campWorld.map.height,
  terrain:campWorld.map.terrain,campPresentation:campWorld.campPresentation};
const expectedScenery=sceneryPlacements(campBase,{chapter:5}).length;
await mkdir(output,{recursive:true});
const server=http.createServer((req,res)=>serveRequest(req,res,dist));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await playwright.chromium.launch({headless:!process.argv.includes('--headed'),executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const report={method:'Automated Chromium on production dist with the existing ?dev real-time selector; visible settings, restore, conversations, keyboard and Menu; read-only diagnostics; no browser state injection',
  build:build.revision,browser:browser.version(),physicalDeviceTest:false,softwareRendering:true,
  checkpoint:{seed:275,source:'New Game through Chapter IV using runRealtimeCampaign and public commands',priorEncounters:earned.encounters.map(e=>({id:e.id,status:e.status})),
    saveSha256:createHash('sha256').update(code).digest('hex')},checks:[],errors:[],screenshots:[]};
const record=(name,detail={})=>{report.checks.push({name,pass:true,...detail});console.log(`ok - ${name}`);};
// This acceptance controls one module download; offline cache behaviour is
// covered separately by the release smoke, so it must not bypass that route.
const context=await browser.newContext({viewport:{width:1270,height:720},serviceWorkers:'block'}),page=await context.newPage();
page.setDefaultTimeout(30000);
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
const assetResponses=new Map();page.on('response',response=>{const path=new URL(response.url()).pathname;if(path.endsWith('.glb'))assetResponses.set(path,response.status());});
const world=()=>page.evaluate(()=>window.__realtime.world());
async function pause(on=true){
  if(await page.evaluate(()=>window.__realtime.paused())!==on){await page.locator('#rt-board').focus();await page.keyboard.press('KeyP');}
  await page.waitForFunction(v=>window.__realtime.paused()===v,on);
}
async function courtyardReady(){
  await page.waitForSelector('.chapter-v-courtyard .rt-scene[data-ready="true"]',{timeout:90000});
  await page.waitForFunction(n=>Number(document.querySelector('#rt-board')?.dataset.sceneryModels)===n,expectedScenery,{timeout:90000});
}
async function restore(value,{ready=true}={}){
  await settingsCommand(page,'restore');await page.locator('#restore-code').fill(value);
  await page.locator('[data-cmd="import-code"]').click();
  await page.locator('[data-cmd="confirm-import"]').waitFor({state:'visible'});
  // Re-importing the same camp leaves its existing selector visible while
  // the replacement save is pending. Observe the confirmation closing after
  // publish, including its focus handler, before accepting scene readiness.
  const restored=page.locator('#modal').evaluate(modal=>new Promise(resolve=>modal.addEventListener('close',()=>resolve(),{once:true})));
  await page.locator('[data-cmd="confirm-import"]').click();await restored;
  await page.waitForSelector('.chapter-v-courtyard');if(ready)await courtyardReady();
}
async function exported(){
  await settingsCommand(page,'export');const value=await page.locator('#save-code').inputValue();await closePanel(page);
  return {code:value,state:await restoreCode(value)};
}
async function screenshot(name){
  // Pause through the player control, then capture the viewport. A locator
  // screenshot's element-stability wait can starve on a live WebGL HUD, and so can
  // scrollIntoViewIfNeeded's (it timed out right after the narrow resize in CI), so the
  // board is scrolled into view by the DOM. Software rendering takes seconds a frame
  // over the photographed ground: a long timeout.
  await pause();await page.locator('#rt-board').evaluate(board=>board.scrollIntoView({block:'nearest'}));await page.locator('#rt-board').focus();
  await page.screenshot({path:join(output,name),fullPage:false,timeout:120000});report.screenshots.push(name);
}
async function geometry(label){
  const measured=await page.evaluate(()=>{
    const board=document.querySelector('#rt-board'),b=board.getBoundingClientRect();
    const panels=[...document.querySelectorAll('.rt-top,.rt-hud,.rt-status-strip,.rt-support,.rt-deploy')].filter(el=>el.checkVisibility({checkVisibilityCSS:true}));
    return {viewport:{width:innerWidth,height:innerHeight},canvas:{width:b.width,height:b.height},documentWidth:document.documentElement.scrollWidth,
      overlap:panels.filter(el=>{const r=el.getBoundingClientRect();return Math.min(r.right,b.right)-Math.max(r.left,b.left)>1&&Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)>1;}).map(el=>el.className)};
  });
  assert.deepEqual(measured.overlap,[],`${label}: controls do not obscure the scene`);
  assert.ok(measured.documentWidth<=measured.viewport.width+1,`${label}: no horizontal overflow`);
  assert.ok(measured.canvas.height>=(measured.viewport.width>600?358:318),`${label}: the court retains useful vertical space`);
  record(label,measured);
}
try{
  await page.goto(`${base}?dev`);await menuCommand(page,'settings');
  await (await revealControl(page,'#controls-model')).selectOption('realtime');await closePanel(page);
  await menuCommand(page,'settings');await (await revealControl(page,'#battle-view')).selectOption('3d');
  await (await revealControl(page,'#graphics-quality')).selectOption('balanced');
  await closePanel(page);
  // Control network timing only: reproduce a real slow module download while
  // the player opens Settings. The campaign still arrives through Restore.
  let releaseRuntime;
  const delayedRuntime=new Promise(resolve=>{releaseRuntime=resolve;}),runtimeRequested=page.waitForRequest('**/src/showcase/realtime-field.js');
  await page.route('**/src/showcase/realtime-field.js',async route=>{await delayedRuntime;await route.continue();});
  await restore(code,{ready:false});await runtimeRequested;await menuCommand(page,'settings');
  releaseRuntime();
  // A paused stage deliberately waits to paint its first frame, so readiness
  // follows Close. The runtime itself must already inherit the panel pause.
  await page.waitForFunction(()=>window.__realtime?.world()?.campId==='ch5-camp');
  assert.equal(await page.evaluate(()=>window.__realtime.paused()),true,'A late runtime inherits the open panel pause');
  assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('#modal')),true,'Loading the runtime does not steal panel focus');
  const waitingWorld=JSON.stringify(await world());await page.keyboard.press('ArrowRight');await page.keyboard.press('KeyP');
  assert.equal(JSON.stringify(await world()),waitingWorld,'Panel keys cannot move or resume the loading courtyard');
  await closePanel(page);await courtyardReady();await page.waitForFunction(()=>window.__realtime.world().tick>0);
  await page.unroute('**/src/showcase/realtime-field.js');
  record('Opening Settings before the runtime loads preserves pause and focus, then closing resumes normally');
  assert.equal((await world()).peaceful,true);
  const loaded=['/assets/models/scenery/ch5-fortress-kit.glb',...['ch5-cistern','ch5-siege-hoist','ch5-damaged-masonry','ch5-household-bundles'].map(id=>`/assets/models/chapters/05/${id}.glb`)];
  for(const path of loaded)assert.equal(assetResponses.get(path),200,`${path} loads from the production bundle`);
  record('Earned Chapter V camp restores in balanced 3D with every pilot scenery placement',{expectedScenery,assets:loaded});
  await geometry('Desktop courtyard geometry');await screenshot('courtyard-desktop.png');
  await page.locator('#rt-board').focus();await page.keyboard.press('KeyH');
  await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('#rt-board').dataset.renderStats).cameraView==='horizon';}catch{return false;}});
  await screenshot('courtyard-horizon.png');
  await page.keyboard.press('KeyZ');
  await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('#rt-board').dataset.renderStats).cameraView==='overview';}catch{return false;}});
  await page.setViewportSize({width:390,height:844});await geometry('Narrow courtyard geometry');await screenshot('courtyard-narrow.png');
  await page.setViewportSize({width:1270,height:720});
  for(const selector of ['[data-cmd="start"]','[data-cmd="conversation"][data-id="table"]','[data-cmd="soldier-panel"][data-id="kit"]','[data-cmd="soldier-panel"][data-id="company"]']){
    assert.ok(await page.locator(selector).first().isVisible(),`${selector} is directly available`);
  }
  await pause();const peacefulBefore=JSON.stringify(await world());await page.locator('#rt-board').focus();
  await page.keyboard.press('Space');await page.waitForFunction(()=>/Weapons stay sheathed/.test(document.querySelector('[data-role="eventLine"]')?.textContent??''));
  assert.equal(JSON.stringify(await world()),peacefulBefore);
  await page.keyboard.press('Shift+KeyT');await page.keyboard.press('Shift+Enter');
  assert.equal(JSON.stringify(await world()),peacefulBefore,'a forced neutral attack is rejected without changing the paused world');
  record('Visible keyboard controls cannot draw weapons or force an attack in the peaceful courtyard');
  const beforeConversation=await exported();
  await (await revealControl(page,'[data-cmd="conversation"][data-id="ch5:engineer"]')).click();
  const preparationOpened=page.locator('#modal').evaluate(modal=>new Promise(resolve=>modal.addEventListener('close',()=>resolve(),{once:true})));
  await page.locator('#modal [data-cmd="reply"]').filter({hasText:'Review battle preparation.'}).click();
  await preparationOpened;await page.waitForSelector('#camp-preparation[open]');await page.waitForSelector('#modal',{state:'hidden'});
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#camp-preparation > summary')),true);
  assert.equal(Game.serialize((await exported()).state),Game.serialize(beforeConversation.state),'reviewing preparation grants no reward and selects no plan');
  record('Engineer conversation opens existing preparation with keyboard focus and no free progress');
  await page.locator('[data-cmd="conversation"][data-id="table"]').click();
  const decisionIndex=Game.campConversation(beforeConversation.state,'table').options.find(o=>o.decision==='civilians').index;
  await page.locator(`#modal [data-cmd="reply"][data-id="${decisionIndex}"]`).click();
  await page.waitForFunction(()=>window.__realtime.world()?.campPresentation?.civilianOutcome==='departing');
  await page.waitForSelector('.rt-scene[data-ready="true"]',{timeout:90000});
  const chosen=await exported();assert.equal(chosen.state.decisions.ch5,'civilians');
  await restore(chosen.code);assert.equal(Game.serialize((await exported()).state),Game.serialize(chosen.state));
  record('Direct civilian decision updates the courtyard and survives visible export/restore exactly');
  await screenshot('courtyard-civilians.png');
  await page.locator('[data-cmd="start"]:visible').click();
  await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]',{timeout:90000});
  assert.equal((await world()).encounterId,'ch5-mine');
  const original=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).payload).encounter.realtime.world,CONFIG.saveKey);
  await pause(false);await page.locator('#rt-board').focus();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>window.__realtime.world().tick>=20,null,{timeout:30000});await pause();
  const advanced=await world();assert.notEqual(worldHash(advanced),worldHash(original));
  await menuCommand(page,'menu');await page.locator('#modal [data-cmd="menu-section"][data-id="campaign"]').click();
  await page.locator('#modal [data-cmd="retry"]').click();await page.locator('#modal [data-cmd="retry-confirm"]').click();
  await page.waitForFunction(t=>window.__realtime.world()?.encounterId==='ch5-mine'&&window.__realtime.world().tick<t,advanced.tick);
  await pause();const retried=await world(),expected=structuredClone(original);
  for(let n=0;n<retried.tick;n++)step(expected);
  assert.equal(worldHash(retried),worldHash(expected),'Retry restores the initial world exactly, followed only by the observed idle ticks');
  record('March out starts the cracked tower; visible Retry restores its exact deterministic checkpoint',{beforeTick:advanced.tick,afterTick:retried.tick,hash:worldHash(retried)});
  await screenshot('cracked-tower.png','.rt-field');
  if(riverCode){
    await restore(riverCode);assert.equal((await world()).campPresentation.stage,'river-gate');
    await page.locator('[data-cmd="start"]:visible').click();
    await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]',{timeout:90000});
    await pause();assert.equal((await world()).encounterId,'ch5-wall');
    record('Legally earned second checkpoint departs for the red river gate');await screenshot('river-gate.png','.rt-field');
  }
  assert.deepEqual(report.errors,[],'No browser console or runtime errors');report.pass=true;
}catch(error){report.pass=false;report.failure=error.stack??String(error);process.exitCode=1;console.error(report.failure);
  try{await page.screenshot({path:join(output,'failure.png'),fullPage:false});report.screenshots.push('failure.png');}catch{}
}finally{
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(resolve=>server.close(resolve));
}
console.log(`Chapter V pilot report: ${join(output,'report.json')}`);
