// Browser smoke test of the production build through the real interface: New
// Game and the Chapter I drill in 2D (walk by keyboard and pointer, Undo, the
// board surviving page updates with its focus, Confirm moves, an opponent's
// preview, Help), a keyboard walk in the 3D view,
// a legal Chapter V expanded checkpoint restored through the Restore dialog
// (field-object readouts), a field approach chosen at a restored Chapter V camp
// (with Chapter V's generated scenery and character bodies loaded in 3D),
// touch at phone width (hold to preview, tap to walk), the Settings
// performance check, the 0.40 real-time arena (click to move, pause, step), the
// walkable camp and the campaign's drill in real time (conversations, the table,
// the gate, the field, pause, keys, result, record), and the same in 2D; then
// squads and deployment, the chamber Contests (Chapter VII's council played
// through, every Contest won, the hearing), the finale's defection route, the
// settings and help (pace by difficulty, a remapped key), Practice in real time
// (a battle's field and a Contest's chamber, nothing saved) and a chronicle saved
// before 0.40. It fails on any page or console error. Development and CI only:
// it needs Playwright, which is not a project dependency, and a production build.
//
//   npm run build && npm run smoke
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.js npm run smoke
//   SMOKE_ONLY=chamberCouncil,legacyChronicle npm run smoke   # just those scenarios
//   SMOKE_GROUP=a npm run smoke   # one half (a or b), as CI's two parallel smoke jobs run it
import http from 'node:http';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {serveRequest} from './serve.mjs';
import {closePanel,closedBy,menuCommand,revealControl,settingsCommand,settingsPage,verifyCampPanelTransitions} from './ui-smoke-navigation.mjs';
import * as Game from '../src/core/game.js';
import {runProgressionCampaign} from './progression-autoplay.mjs';
import {runCommandCampaign,protectCoalition} from './command-autoplay.mjs';
import {runRealtimeCampaign} from './realtime-autoplay.mjs';
import {playEncounter,command} from './autoplay.mjs';
import {tpAuditTotal} from '../src/core/tp-audit.js';
import {sceneryPlacements} from '../src/showcase/scenery-models.js';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
if(!await access(`${root}index.html`).then(()=>true,()=>false)){console.error('No production build in dist/. Run npm run build first.');process.exit(2);}
// SMOKE_GROUP=a or b runs one half of the scenarios (the halves are listed at the end of this file).
const group=process.env.SMOKE_GROUP?.trim().toLowerCase()||null;
if(group&&group!=='a'&&group!=='b'){console.error(`SMOKE_GROUP is a or b, not ${process.env.SMOKE_GROUP}.`);process.exit(2);}
async function playwright(){
  for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){try{const module=await import(specifier);return module.chromium?module:module.default;}catch{}}
  console.error('Playwright is not installed. Install it separately (it is not a project dependency) or set PLAYWRIGHT_MODULE to its index.js path.');process.exit(2);
}

// A legal expanded chronicle (New Game, public commands only) saved before the
// first wide Chapter V field, which has a closed gate.
function chapterFiveCode(){
  let code=null;
  runProgressionCampaign({featureEdition:31,onCheckpoint:s=>{
    if(code||s.chapter!==5)return;
    const probe=Game.deserialize(Game.serialize(s));
    if(Game.startEncounter(probe).ok&&probe.encounter.field?.objects?.some(o=>o.kind==='gate'))code=Game.encodeSave(s);
  }});
  assert.ok(code,'A Chapter V checkpoint with a gate');return code;
}
// A legal edition-35 command chronicle saved at the Chapter V mine camp, where
// the engineering approach is affordable. The campaign stops there.
function approachCampCode(){
  let code=null;const stop=new Error('saved');
  try{runCommandCampaign({featureEdition:35,onCheckpoint:s=>{
    if(Game.getChapter(s).encounters[s.encounterIndex]?.id!=='ch5-mine')return;
    if(Game.fieldApproachView(s).options.find(p=>p.id==='breach')?.available)code=Game.encodeSave(s);throw stop;
  }});}catch(error){if(error!==stop)throw error;}
  assert.ok(code,'A Chapter V camp that can afford the engineering approach');return code;
}

// A legal edition-35 command chronicle saved at a battle's camp (the campaign stops there).
function battleCampCode(id){
  let code=null;const stop=new Error('saved');
  try{runCommandCampaign({featureEdition:35,onCheckpoint:s=>{if(Game.getChapter(s).encounters[s.encounterIndex]?.id!==id)return;code=Game.encodeSave(s);throw stop;}});}
  catch(error){if(error!==stop)throw error;}
  assert.ok(code,`A legal camp before ${id}`);return code;
}

const server=http.createServer((req,res)=>serveRequest(req,res,root));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const {chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const problems=[],contexts=new Set();
async function open(options={}){
  const context=await browser.newContext({viewport:{width:1280,height:900},...options}),page=await context.newPage();contexts.add(context);
  page.setDefaultTimeout(240000);
  page.on('pageerror',error=>problems.push(`page error: ${error.message}`));
  page.on('console',message=>{if(message.type()==='error')problems.push(`console error: ${message.text()}`);});
  return page;
}
const text=(page,selector)=>page.evaluate(s=>document.querySelector(s)?.textContent??'',selector);
// A re-render replaces the board and binds its new canvas on the next frame;
// act only once it is live again, as a player waits for it to be redrawn.
const settled=page=>page.waitForFunction(()=>{const board=document.querySelector('#battle-board');return !board||board.dataset.bound==='true';});
// Run a step and wait until the live announcement says what it should.
async function expectAnnouncement(page,pattern,step){
  await settled(page);
  await page.evaluate(()=>{const n=document.querySelector('#announcement');if(n)n.textContent='';});
  await step();
  try{await page.waitForFunction(source=>new RegExp(source).test(document.querySelector('#announcement')?.textContent??''),pattern.source,{timeout:60000});}
  catch{assert.fail(`Expected the announcement to match ${pattern}; it reads "${await text(page,'#announcement')}"`);}
  await settled(page);
  return text(page,'#announcement');
}
const keys=async(page,list)=>{for(const key of list)await page.keyboard.press(key);};
const menuButton=menuCommand;
async function settings(page,fn){await menuButton(page,'settings');await page.waitForSelector('#modal[open] .settings-nav');await fn();await page.click('#modal [data-cmd="close-modal"] >> nth=0');}
async function view(page,mode){
  await settings(page,async()=>(await revealControl(page,'#battle-view')).selectOption(mode));
  if(mode==='3d')await page.waitForFunction(()=>document.querySelector('#battle-board')?.parentElement?.dataset.ready==='true',null,{timeout:300000,polling:500});
  await page.locator('#battle-board').scrollIntoViewIfNeeded();
}
async function newGameDrill(page){
  await page.goto(base);await page.click('[data-cmd="new"]');await page.locator('input[name="new-play-mode"][value="turns"]').check();
  await page.click('[data-cmd="begin"]');await page.waitForSelector('.camp-page');
  const choose=page.locator('[data-cmd="choose"]');if(await choose.count())await (await revealControl(page,'[data-cmd="choose"]')).click();
  await page.click('[data-cmd="start"]');await page.waitForSelector('#battle-board');
}
// Sweep the pointer over the board until the readout passes `test`.
async function findTile(page,test,[dx,dy]=[24,16]){
  await settled(page);await page.locator('#battle-board').scrollIntoViewIfNeeded();
  const box=await page.locator('#battle-board').boundingBox();
  for(let y=box.y+6;y<box.y+box.height-6;y+=dy)for(let x=box.x+6;x<box.x+box.width-6;x+=dx){
    await page.mouse.move(x,y);if(!test(await text(page,'#board-hover')))continue;
    // The readout follows the pointer a frame later; confirm it once settled.
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const label=await text(page,'#board-hover');if(test(label))return {x,y,label};
  }
  assert.fail('No tile on the board matched the readout test');
}

async function drillDesktop(){
  const page=await open();await newGameDrill(page);await view(page,'2d');
  assert.match(await text(page,'#command-hint'),/Select open ground to walk there/);
  assert.match(await page.getAttribute('#battle-board','aria-label'),/Select open ground to walk there; Undo Move takes it back until you act\./);
  await page.focus('#battle-board');const board=await page.$('#battle-board');
  await expectAnnouncement(page,/^Grid 1A\. Open ground\. Beyond reach · stops at 1B this turn$/,()=>keys(page,['ArrowUp','ArrowUp','ArrowUp']));
  await expectAnnouncement(page,/^Walked to 1B \(2 movement\)\. 1A is beyond this turn’s reach\. Undo Move \(U\) takes it back until you act\.$/,()=>page.keyboard.press('Enter'));
  await expectAnnouncement(page,/returned to 1D; movement restored/,()=>page.keyboard.press('u'));
  assert.ok(await board.evaluate(node=>node===document.querySelector('#battle-board')&&node===document.activeElement),
    'The page updates around the same board, which keeps the focus');
  const near=await findTile(page,label=>label.includes('Walk here'));
  await expectAnnouncement(page,/^Walked to \d+[A-H] \(\d movement\)\. Undo Move/,()=>page.mouse.click(near.x,near.y));
  await expectAnnouncement(page,/movement restored/,()=>page.keyboard.press('u'));
  await settings(page,async()=>(await revealControl(page,'#confirm-moves')).check());
  assert.match(await text(page,'#command-hint'),/Select open ground to preview a walk there, then select it again to go\./);
  const again=await findTile(page,label=>label.includes('Walk here'));
  await expectAnnouncement(page,/^Move to \d+[A-H]\. .*Activate the target again, or use Confirm\.$/,()=>page.mouse.click(again.x,again.y));
  await expectAnnouncement(page,/^Move to \d+[A-H]\. Costs this unit’s movement\.(?!.*Activate)/,()=>page.mouse.click(again.x,again.y));
  await expectAnnouncement(page,/movement restored/,()=>page.keyboard.press('u'));
  await settings(page,async()=>(await revealControl(page,'#confirm-moves')).uncheck());
  const partner=await findTile(page,label=>label.startsWith('Training partner'));
  await expectAnnouncement(page,/^Throw at Training partner.*Activate the target again, or use Confirm\.$/,()=>page.mouse.click(partner.x,partner.y));
  await expectAnnouncement(page,/^Command cancelled\. No action was spent\.$/,()=>page.keyboard.press('Escape'));
  await menuButton(page,'help');await page.waitForSelector('#modal[open]');await page.click('#modal [data-cmd="help-section"][data-id="full-rules"]');
  const help=await page.evaluate(()=>document.querySelector('#modal').innerText);
  for(const words of ['Select open ground to walk there','U takes back a move until the unit acts','Expanded campaign'])assert.ok(help.includes(words),`Help mentions "${words}"`);
  await page.click('#modal [data-cmd="close-modal"] >> nth=0');
  // The 3D view walks by the same keyboard path.
  await view(page,'3d');await page.focus('#battle-board');
  await expectAnnouncement(page,/^Grid \d+[A-H]\. .*(Walk here · \d movement|Beyond reach · stops at \d+[A-H] this turn)$/,()=>page.keyboard.press('ArrowUp'));
  await expectAnnouncement(page,/^Walked to \d+[A-H]/,()=>page.keyboard.press('Enter'));
  await expectAnnouncement(page,/movement restored/,()=>page.keyboard.press('u'));
  await page.context().close();console.log('ok - desktop drill: keyboard, pointer, Undo, Confirm moves, opponent preview, Help and the 3D keyboard walk');
}

async function expandedFieldReadouts(){
  const page=await open();await page.goto(base);
  await settingsCommand(page,'restore');
  await page.fill('#restore-code',chapterFiveCode());await page.click('[data-cmd="import-code"]');await page.click('[data-cmd="confirm-import"]');
  await page.waitForSelector('.camp-page');await page.click('[data-cmd="start"]');await page.waitForSelector('#battle-board');
  await view(page,'2d');await page.focus('#battle-board');
  await expectAnnouncement(page,/^Grid 2C\. Abandoned supply cart \(available\)\. Open sand\. Walk here · 2 movement$/,()=>keys(page,['ArrowUp','ArrowRight']));
  await expectAnnouncement(page,/^Grid 9C\. Side gate \(closed\)\. Open ground\. No passage until opened$/,()=>keys(page,Array(7).fill('ArrowRight')));
  assert.equal(await text(page,'#board-hover'),'Side gate (closed) · Open ground · 9C · No passage until opened');
  await expectAnnouncement(page,/^Grid 10C\. High ground\. No route from here$/,()=>page.keyboard.press('ArrowRight'));
  await expectAnnouncement(page,/^Side gate \(closed\)\. Open ground\. No passage until opened\.$/,()=>keys(page,['ArrowLeft','Enter']));
  assert.match((await text(page,'.ground-readout')).replace(/\s+/g,' '),/Target: Open ground · 9C · Side gate \(closed\)/);
  await page.context().close();console.log('ok - expanded Chapter V field: restored legally, field objects named in the cursor, readout, announcement and ground note');
}

async function fieldApproach(){
  const code=approachCampCode(),expected=Game.decodeSave(code);
  assert.ok(Game.chooseFieldApproach(expected,'breach').ok);assert.ok(Game.startEncounter(expected).ok);
  const expectedScenery=sceneryPlacements(expected.encounter,{chapter:expected.chapter}).length;
  assert.ok(expectedScenery>0,'The legal Chapter V field has authored scenery');
  const page=await open();await page.goto(base);
  await settingsCommand(page,'restore');
  await page.fill('#restore-code',code);await page.click('[data-cmd="import-code"]');await page.click('[data-cmd="confirm-import"]');
  await page.waitForSelector('.camp-page');
  const card=id=>`[data-cmd="field-approach"][data-id="${id}"]`;
  assert.equal(await page.getAttribute(card('balanced'),'aria-pressed'),'true','Each camp starts from direct deployment');
  await (await revealControl(page,card('breach'))).click();await page.waitForSelector(`${card('breach')}[aria-pressed="true"]`);
  assert.equal(await page.getAttribute(card('balanced'),'aria-pressed'),'false');
  await page.click('[data-cmd="start"]');await page.waitForSelector('#battle-board');
  assert.match((await text(page,'#command-doctrine')).replace(/\s+/g,' '),/Engineering approach · Open gates, repair bridges/,'The field intelligence names the approach');
  // The generated supply camp loads in the 3D view through the page's own policy and worker.
  await page.waitForFunction(count=>document.querySelector('#battle-board')?.dataset.sceneryModels===String(count),expectedScenery,{timeout:300000,polling:500});
  // Generated character bodies replace the procedural figures in the same view.
  await page.waitForFunction(()=>Number(document.querySelector('#battle-board')?.dataset.generatedBodies)>0,null,{timeout:300000,polling:500});
  await view(page,'2d');await page.focus('#battle-board');
  await expectAnnouncement(page,/^Grid 9C\. Side gate \(open\)\./,()=>keys(page,['ArrowUp',...Array(8).fill('ArrowRight')]));
  await page.context().close();console.log('ok - field approach: chosen on a restored Chapter V camp table, the generated supply camp and character bodies load in 3D, and the engineers have opened the gate');
}

// Touch has no hover: holding a finger still previews, lifting it commits nothing, a tap walks.
async function touchHold(page,{x,y}){
  await settled(page);const session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await page.waitForTimeout(800);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(400);await session.detach();
}
async function phoneTouch(){
  const page=await open({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await newGameDrill(page);await view(page,'2d');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No sideways scrolling at phone width');
  const tile=await findTile(page,label=>label.includes('Walk here'),[12,10]);
  await page.mouse.move(1,1);assert.equal(await text(page,'#board-hover'),'','The mouse left the board');
  await page.evaluate(()=>{document.querySelector('#announcement').textContent='';});
  await touchHold(page,tile);
  assert.equal(await text(page,'#board-hover'),tile.label,'A held finger shows the same readout the pointer did');
  assert.doesNotMatch(await text(page,'#announcement'),/Walked/,'Lifting the finger after a hold walks nowhere');
  await expectAnnouncement(page,/^Walked to \d+[A-H]/,()=>page.touchscreen.tap(tile.x,tile.y));
  await expectAnnouncement(page,/movement restored/,()=>page.keyboard.press('u'));
  await view(page,'3d');
  const box=await page.locator('#battle-board').boundingBox();
  await page.evaluate(()=>{document.querySelector('#announcement').textContent='';document.querySelector('#board-hover').textContent='';});
  await touchHold(page,{x:box.x+box.width*.45,y:box.y+box.height*.6});
  assert.match(await text(page,'#board-hover'),/· \d+[A-H]/,'A held finger shows the tile readout in 3D too');
  assert.doesNotMatch(await text(page,'#announcement'),/Walked/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.context().close();console.log('ok - phone touch: hold previews in 2D and 3D without walking, a tap walks');
}

// Settings → Run performance check in the 3D drill: the band blocks the board
// (End turn and Enter do nothing), every quality is rebuilt and measured with
// nothing compiled by its first frame, the player's quality comes back, and
// the results save as JSON through the page's own download.
async function performanceCheck(){
  // This checks the three-tier UI lifecycle under SwiftShader, not hardware
  // frame rates. Keep its pixel workload bounded; desktop/phone layouts and
  // full-size scene budgets have their own scenarios and benchmarks.
  const viewport={width:640,height:480};
  const page=await open({acceptDownloads:true,viewport,deviceScaleFactor:1});await newGameDrill(page);await view(page,'3d');
  const canvasSize=()=>page.locator('#battle-board').evaluate(canvas=>{const r=canvas.getBoundingClientRect();return {
    css:{width:r.width,height:r.height},buffer:{width:canvas.width,height:canvas.height}
  };});
  const canvasBefore=await canvasSize();
  const hint=await text(page,'#command-hint'),quality=await page.evaluate(()=>document.documentElement.dataset.quality??'');
  await settingsCommand(page,'performance-check');await page.waitForSelector('.performance-check');
  const focused=()=>page.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,
    text:document.activeElement?.textContent?.trim().slice(0,100),visibility:document.visibilityState}));
  const inputFocus={beforeGameKey:await focused()};await page.keyboard.press('e');inputFocus.beforeEnter=await focused();await page.keyboard.press('Enter');
  await page.waitForSelector('#modal[open][data-panel="performance-check"]',{timeout:900000});
  assert.equal(await page.locator('.performance-check').count(),0,'The status band is gone');
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('[data-cmd="performance-check-save"]')]);
  const fs=await import('node:fs/promises'),report=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  const evidence=new URL('../tests/visual-results/performance-check/',import.meta.url);await fs.mkdir(evidence,{recursive:true});
  await fs.writeFile(new URL('report.json',evidence),JSON.stringify(report,null,2)+'\n');
  const summary={method:'Software-rendered functional check at 640×480, DPR 1; not hardware-performance evidence',
    complete:report.complete,interrupted:report.interrupted,interruptionReason:report.interruptionReason??null,cancelled:report.cancelled??null,status:report.recommendationStatus,inputFocus,
    viewport:report.device.viewport,devicePixelRatio:report.device.devicePixelRatio,canvasBefore,canvasAfter:await canvasSize(),
    tiers:report.tiers?.map(t=>({tier:t.tier,buildMs:t.buildMs,frames:t.tour?.frames,p95:t.tour?.intervalMs?.p95,
      steady:t.steady?.map(w=>({frames:w.frames,complete:w.complete})),meetsTarget:t.meetsTarget}))};
  await fs.writeFile(new URL('diagnostics.json',evidence),JSON.stringify(summary,null,2)+'\n');
  assert.equal(report.tool,'imperium-performance-check');assert.equal(report.complete,true,`Performance check must complete all tiers: ${JSON.stringify(summary)}`);
  assert.deepEqual(report.device.viewport,viewport);assert.equal(report.device.devicePixelRatio,1);
  assert.deepEqual(report.tiers.map(t=>t.tier).sort(),['balanced','high','performance']);
  for(const tier of report.tiers){assert.ok(tier.rebuilt&&tier.tour.frames>0,`${tier.tier} was built and measured`);assert.equal(tier.firstFramePrograms,0,`${tier.tier}: nothing compiled by the first frame`);}
  assert.ok(['performance','balanced','high'].includes(report.recommendation));
  await page.click('#modal [data-cmd="close-modal"] >> nth=0');
  assert.equal(await text(page,'#command-hint'),hint,'No command reached the board during the check');
  if(quality)assert.equal(await page.evaluate(()=>document.documentElement.dataset.quality??''),quality,'The player\'s quality is back');
  await page.context().close();console.log(`ok - performance check: three qualities rebuilt and measured with no first-frame compiles, the board untouched, results saved (status: ${report.recommendationStatus}; recorded tier: ${report.recommendation})`);
}

// The 0.40 real-time arena (Phase 0): the development menu sends the
// standalone skirmish there; a click moves the soldier on the frames that
// follow; pausing stops the clock while commands still queue; clicking a
// raider starts the auto-fight; N plays exactly one round while paused.
async function realtimeArena(){
  const page=await open();
  await page.goto(`${base}?dev`);await menuButton(page,'settings');await revealControl(page,'#controls-model');
  await page.selectOption('#controls-model','realtime');await page.click('#modal [data-cmd="close-modal"] >> nth=0');
  const skirmishLink=()=>[...document.querySelectorAll('a')].find(a=>/standalone skirmish/i.test(a.textContent))?.getAttribute('href')??'';
  await page.waitForFunction(`/showcase\\/arena\\.html$/.test((${skirmishLink})())`,null,{timeout:10000})
    .catch(async()=>assert.fail(`The skirmish opens the arena under real time (its link reads ${await page.evaluate(skirmishLink)})`));
  await page.addInitScript(()=>{try{localStorage.setItem('imperium.arena',JSON.stringify({quality:'performance'}));}catch{}});
  await page.goto(`${base}showcase/arena.html`);await page.waitForSelector('#scene[data-ready="true"]');await page.click('#begin-button');
  const arena=fn=>page.evaluate(fn);
  const hero=()=>arena(()=>{const w=window.__arena.world(),h=w.actors.find(a=>a.id===w.controlled);return {x:h.x,z:h.z,drawn:h.drawn,lock:h.lock,tick:w.tick};});
  const box=await page.locator('#scene').boundingBox(),start=await hero();
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.45);await page.mouse.down();await page.mouse.up();
  const step=(label,promise)=>promise.catch(async error=>assert.fail(`${label}: ${error.message.split('\n')[0]} (${await page.evaluate(()=>{
    const w=window.__arena.world(),h=w.actors.find(a=>a.id===w.controlled);
    return JSON.stringify({tick:w.tick,status:w.status,paused:window.__arena.clock.paused,lock:h.lock,order:h.order,drawn:h.drawn,queue:w.queue,
      message:document.querySelector('#message-line')?.textContent,event:document.querySelector('#event-line')?.textContent});})})`));
  await step('The click moves the soldier',page.waitForFunction(([x,z])=>{const w=window.__arena.world(),h=w.actors.find(a=>a.id===w.controlled);return h.x!==x||h.z!==z;},[start.x,start.z],{timeout:60000}));
  // The click's frame count is recorded when the frame showing the move is drawn (Performance draws every other frame).
  const frames=await page.waitForFunction(()=>{const n=window.__arena.metrics.clickFrames.at(-1);return Number.isFinite(n)?{n}:null;},null,{timeout:30000})
    .then(handle=>handle.jsonValue()).then(v=>v.n).catch(()=>assert.fail('The click to first movement is measured'));
  await page.click('#pause-button');const paused=(await hero()).tick;await page.waitForTimeout(800);
  assert.equal((await hero()).tick,paused,'No tick runs while paused');
  await page.focus('#scene');await page.keyboard.press('Space');
  assert.equal((await hero()).drawn,false,'Space while paused only queues');
  await page.click('#pause-button');await step('The queued Space draws on resume',page.waitForFunction(()=>{const w=window.__arena.world();return w.actors.find(a=>a.id===w.controlled).drawn;},null,{timeout:60000}));
  // Paused, the raiders hold still to be clicked; the overview shows every man, and a raider is
  // chosen whose body is clear of the bars over the scene. The order waits for the resume.
  await page.click('#pause-button');await page.focus('#scene');await page.keyboard.press('z');
  await step('The overview camera settles',page.waitForFunction(()=>{const s=window.__arena.stage();return s.cameraView==='overview'&&s.cameraSettled;},null,{timeout:120000}));
  const enemy=await arena(()=>{
    const s=window.__arena.stage(),w=window.__arena.world(),r=s.canvas.getBoundingClientRect();
    for(const e of w.actors.filter(a=>a.side==='enemy'&&a.alive)){
      const p=s.actors.get(e.id).group.position.clone();p.y+=1.1;p.project(s.camera);const x=r.left+(p.x+1)/2*r.width,y=r.top+(1-p.y)/2*r.height;
      if(document.elementFromPoint(x,y)===s.canvas)return {id:e.id,x,y};
    }
    return null;});
  assert.ok(enemy,'A raider is in view');
  await page.mouse.move(enemy.x,enemy.y);await page.mouse.down();await page.mouse.up();
  assert.equal(await arena(()=>window.__arena.world().queue.at(-1)?.kind),'attack','The click on a raider is an attack, queued while paused');
  await page.click('#pause-button');
  await step('Clicking a raider locks him',page.waitForFunction(id=>window.__arena.world().actors.find(a=>a.id==='hero').lock===id,enemy.id,{timeout:60000}));
  await page.click('#pause-button');const before=(await hero()).tick;await page.click('#step-button');
  await page.waitForFunction(t=>window.__arena.world().tick>=t+200&&window.__arena.clock.paused&&!window.__arena.clock.stepTicks,before,{timeout:600000});
  assert.equal((await hero()).tick,before+200,'N plays exactly one round');
  await page.context().close();
  console.log(`ok - real-time arena: the dev menu routes the skirmish there; a click moved the soldier (${frames} frame${frames===1?'':'s'} after it); pause stops the clock while Space queues; clicking a raider locks him; N plays 200 ticks`);
}

// The campaign's drill in real time (0.40 Phase 1): the field mounts in the page, a
// click walks, P pauses, T and Enter attack the partner, the ability keys finish
// the drill, the After-Action Chronicle appears and Record returns to the camp.
// The walkable camp: through its list path, Varro's conversation (a reply by number) and the decision at the
// commander's table, then the gate. Returns once the drill's field is ready.
async function campToDrill(page,view='3d'){
  await page.addInitScript(v=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:v}));}catch{}},view);
  await page.goto(base);await page.click('[data-cmd="new"]');await page.click('[data-cmd="begin"]');await page.waitForSelector('.realtime-camp');
  await page.waitForSelector('.rt-field[data-kind="camp"] .rt-scene[data-ready="true"]');
  if(await page.evaluate(()=>document.querySelector('#modal')?.open))await page.click('#modal [data-cmd="close-modal"] >> nth=0');
  await (await revealControl(page,'[data-cmd="conversation"][data-id="ch1:varro"]')).click();await page.waitForSelector('#modal[open] [data-cmd="reply"]');
  assert.match(await text(page,'#modal'),/Varro/);
  await verifyCampPanelTransitions(page);
  await (await revealControl(page,'[data-cmd="conversation"][data-id="table"]')).click();await page.waitForSelector('#modal[open] [data-cmd="reply"]');await page.keyboard.press('1');
  await page.waitForFunction(()=>!document.querySelector('#modal')?.open,null,{timeout:30000});
  await (await revealControl(page,'[data-cmd="start"]')).click();await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]');
}
async function realtimeCampaign(){
  const page=await open();await campToDrill(page);
  const field=fn=>page.evaluate(fn);
  const state=()=>field(()=>{const w=window.__realtime.world(),h=w.actors.find(a=>a.id==='hero');return {x:h.x,z:h.z,tick:w.tick,used:w.used,status:w.status,paused:window.__realtime.paused()};});
  const running=async()=>{if((await state()).paused)await page.keyboard.press('KeyP');};
  const box=await page.locator('#rt-board').boundingBox(),start=await state();
  // The guided opening teaches the drill: first the footing, then a pause, then slow time.
  await page.waitForFunction(()=>/Find your footing/.test(document.querySelector('[data-role="lesson"]:not([hidden])')?.textContent??''),null,{timeout:30000})
    .catch(()=>assert.fail('The guided opening starts the drill'));
  assert.equal(start.paused,true,'The opening drill waits for the player');assert.equal(start.tick,0);
  await page.mouse.click(box.x+box.width*.62,box.y+box.height*.45);
  await running();
  await page.waitForFunction(([x,z])=>{const h=window.__realtime.world().actors.find(a=>a.id==='hero');return h.x!==x||h.z!==z;},[start.x,start.z],{timeout:60000})
    .catch(()=>assert.fail('The click in the campaign field moves the soldier'));
  await page.keyboard.press('KeyP');assert.equal((await state()).paused,true,'P pauses the campaign field');
  await page.waitForFunction(()=>/Slow time/.test(document.querySelector('[data-role="lesson"]')?.textContent??''),null,{timeout:30000})
    .catch(()=>assert.fail('After a walk and a pause, the guide teaches slow time'));
  await page.waitForSelector('[data-role="pausedBand"]:not([hidden])',{timeout:30000}).catch(()=>assert.fail('The paused band shows'));
  // Saves: F2 keeps the moment with a picture the 3D stage draws for it; Menu → Saves lists it, paused under the panel.
  await page.keyboard.press('F2');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('imperium.slots')??'{}').quick?.thumbnail?.startsWith('data:image/jpeg'),null,{timeout:30000})
    .catch(()=>assert.fail('F2 quick-saves the fight with a picture'));
  await page.click('[data-role="menuButton"]');await page.click('#modal [data-cmd="saves"]');await page.waitForSelector('#modal .save-slots');
  await page.click('#modal [data-cmd="slot-save"][data-id="1"]');
  await page.waitForSelector('#modal .save-slot:nth-child(2) img',{timeout:30000}).catch(()=>assert.fail('A named save from the panel shows its picture'));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#modal')?.open);
  // The dialog's close event hands focus back to the scene a moment after it closes: give the keys to the scene.
  await page.locator('#rt-board').focus();await page.keyboard.press('KeyP');await running();
  await page.keyboard.press('KeyT');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__realtime.world().used.includes('strike'),null,{timeout:120000}).catch(async()=>assert.fail(`T and Enter attack the drill partner: ${
    await page.evaluate(()=>{const w=window.__realtime.world(),h=w.actors.find(a=>a.id==='hero');return JSON.stringify({tick:w.tick,status:w.status,paused:window.__realtime.paused(),
      focus:document.activeElement?.id||document.activeElement?.dataset?.role||document.activeElement?.tagName,modal:document.querySelector('#modal')?.open,lock:h.lock,order:h.order?.kind,
      used:w.used,line:document.querySelector('[data-role="eventLine"]')?.textContent});})}`));
  await running();await page.keyboard.press('Digit2');
  await page.waitForFunction(()=>window.__realtime.world().used.includes('brace'),null,{timeout:60000}).catch(()=>assert.fail('One press braces'));
  await running();await page.keyboard.press('KeyT');await page.keyboard.press('Digit3');await page.keyboard.press('Enter');
  await page.waitForSelector('.rt-result',{timeout:120000}).catch(()=>assert.fail('The drill ends in the After-Action Chronicle'));
  assert.match(await text(page,'.rt-result h2'),/Objective complete/);assert.equal((await state()).status,'won','The compact result reports the won drill');
  await page.waitForFunction(()=>document.activeElement?.id==='rt-result-title');
  const finished=(await state()).tick;await page.keyboard.press('KeyP');await page.waitForTimeout(350);
  assert.equal((await state()).tick,finished,'Completion cannot restart battle time');
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    const action=await page.locator('.rt-result [data-cmd="commit"]').boundingBox();
    assert.ok(action.y>=0&&action.y+action.height<=viewport.height,'Continue is visible without scrolling');
  }
  await page.click('[data-cmd="commit"]');await page.waitForSelector('.camp-page');
  // Back in the walkable camp: its own field, never the battle's.
  assert.equal(await page.evaluate(()=>!!document.querySelector('.rt-field[data-kind="field"]')),false,'The battle field is gone after the result is recorded');
  await page.context().close();
  console.log('ok - real-time campaign: the drill plays in the campaign page (click, pause, F2 and a named save with pictures, T and Enter, abilities), ends in the After-Action Chronicle and is recorded');
}

// The same drill in the 2D view: the camp and the field drawn flat, the same keys and commands.
async function realtimeFlat(){
  const page=await open();await campToDrill(page,'2d');
  assert.equal(await page.evaluate(()=>!!document.querySelector('.rt-field[data-kind="field"] canvas')),true);
  assert.equal(await page.evaluate(()=>window.__realtime.paused()),true);await page.locator('#rt-board').focus();await page.keyboard.press('KeyP');
  await page.locator('#rt-board').focus();await page.keyboard.press('KeyT');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__realtime.world().used.includes('strike'),null,{timeout:120000}).catch(()=>assert.fail('T and Enter attack in the 2D view'));
  await page.context().close();
  console.log('ok - real-time 2D view: the walkable camp and the drill are drawn flat; the list path, the table decision, T and Enter all work');
}

// The battle view changed in Settings during a session, 3D to 2D and back, in the camp and on the drill
// field (release 12; the owner's report of a blank field). A canvas keeps the kind of drawing it was first
// given, so the field is built again around the same world: the soldier stands where he stood, a pause the
// player chose holds, a click still walks him, and nothing errs.
async function viewSwitch(){
  const page=await open(),first=problems.length;
  await page.addInitScript(()=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:'3d'}));}catch{}});
  await page.goto(base);await page.click('[data-cmd="new"]');await page.click('[data-cmd="begin"]');
  await page.waitForSelector('.rt-field[data-kind="camp"] .rt-scene[data-ready="true"]');
  if(await page.evaluate(()=>document.querySelector('#modal')?.open))await page.click('#modal [data-cmd="close-modal"] >> nth=0');
  const hero=()=>page.evaluate(()=>{const w=window.__realtime.world(),h=w.actors.find(a=>a.id==='hero');return {x:h.x,z:h.z,tick:w.tick,paused:window.__realtime.paused()};});
  async function switchTo(kind,view){
    // The Menu holds the world while the view changes: the soldier is where he stood, and the world is the same one.
    await menuCommand(page,'settings');const before=await page.evaluate(()=>{window.__heldWorld=window.__realtime.world();return null;}).then(hero);
    await (await revealControl(page,'#battle-view')).selectOption(view);
    await page.waitForFunction(v=>document.querySelector('.rt-field canvas')?.dataset.drawn===v&&window.__realtime.world()===window.__heldWorld,view,{timeout:60000})
      .catch(async()=>assert.fail(`${kind}: the ${view} view takes over the same world: ${JSON.stringify(await page.evaluate(()=>({drawn:document.querySelector('.rt-field canvas')?.dataset.drawn,same:window.__realtime.world()===window.__heldWorld})))}`));
    const held=await hero();assert.deepEqual([held.x,held.z,held.tick],[before.x,before.z,before.tick],`${kind}: the switch moves nothing in the world`);
    await closePanel(page);
    await page.waitForSelector(`.rt-field[data-kind="${kind}"] .rt-scene[data-ready="true"]`,{timeout:180000}).catch(()=>assert.fail(`${kind}: the ${view} view is drawn`));
    return before;
  }
  // A click on open ground (the cursor says walk or run) moves the soldier.
  async function clickToWalk(kind,view){
    const box=await page.locator('#rt-board').boundingBox();let spot=null;
    for(const [fx,fy]of [[.62,.45],[.38,.45],[.62,.62],[.38,.62],[.5,.3],[.5,.72],[.7,.5],[.3,.5]]){
      const x=box.x+box.width*fx,y=box.y+box.height*fy;await page.mouse.move(x,y);
      if(await page.waitForFunction(()=>['walk','run'].includes(document.querySelector('#rt-board')?.dataset.cursor),null,{timeout:2000}).then(()=>true,()=>false)){spot={x,y};break;}
    }
    assert.ok(spot,`${kind} in ${view}: open ground under the pointer`);
    const start=await hero();await page.mouse.click(spot.x,spot.y);
    if((await hero()).paused){await page.locator('#rt-board').focus();await page.keyboard.press('KeyP');}
    await page.waitForFunction(([x,z])=>{const h=window.__realtime.world().actors.find(a=>a.id==='hero');return h.x!==x||h.z!==z;},[start.x,start.z],{timeout:60000})
      .catch(()=>assert.fail(`${kind} in ${view}: a click walks the soldier`));
  }
  await switchTo('camp','2d');await clickToWalk('camp','2d');
  await switchTo('camp','3d');await clickToWalk('camp','3d');
  // Shift+M from the scene opens the camp's map, as M does (release 12: the field's key was ignored).
  await page.locator('#rt-board').focus();await page.keyboard.press('Shift+KeyM');
  await page.waitForFunction(()=>document.querySelector('#modal')?.open&&/The camp/.test(document.querySelector('#panel-title')?.textContent??''),null,{timeout:30000})
    .catch(async()=>assert.fail(`Shift+M opens the camp map: ${await page.evaluate(()=>document.querySelector('#panel-title')?.textContent??'no panel')}`));
  await closePanel(page);
  // On the drill field, which waits for the player: the pause holds through both switches.
  await (await revealControl(page,'[data-cmd="conversation"][data-id="table"]')).click();await page.waitForSelector('#modal[open] [data-cmd="reply"]');await page.keyboard.press('1');
  await page.waitForFunction(()=>!document.querySelector('#modal')?.open,null,{timeout:30000});
  await (await revealControl(page,'[data-cmd="start"]')).click();await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]');
  assert.equal((await hero()).paused,true,'The drill waits for the player');
  await switchTo('field','2d');assert.equal((await hero()).paused,true,'2D: the pause the player had holds');
  await switchTo('field','3d');assert.equal((await hero()).paused,true,'3D: the pause the player had holds');
  await clickToWalk('field','3d');
  assert.deepEqual(problems.slice(first),[],'No page or console errors while switching');
  await page.context().close();
  console.log('ok - view switch: 3D to 2D and back in the camp and on the drill field keeps the same world, its pause and click-to-walk, with no errors; Shift+M opens the camp map');
}

// Phase 2 in the page: a restored camp's battle in real time (the development setting), from Chapter IV with squads.
async function restoreRealtime(page,code,{view='3d',beforeStart=null}={}){
  await page.addInitScript(v=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:v}));}catch{}},view);
  await page.goto(base);await settingsCommand(page,'restore');
  await restoreCamp(page,code);
  if(beforeStart)await beforeStart();
  await (await revealControl(page,'[data-cmd="start"]')).click();
  try{await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]');}
  catch(error){
    const observed=await page.evaluate(()=>({phase:document.documentElement.dataset.phase,kind:document.querySelector('.rt-field')?.dataset.kind,
      scene:document.querySelector('.rt-scene')?.dataset,board:document.querySelector('#rt-board')?.dataset,
      world:window.__realtime.world()?.encounterId,feedback:document.querySelector('#announcement')?.textContent,
      save:document.querySelector('.save-status')?.textContent,startDisabled:document.querySelector('[data-cmd="start"]')?.disabled,
      title:document.querySelector('#panel-title')?.textContent,modalOpen:document.querySelector('#modal')?.open,
      preparing:document.querySelector('.rt-scene')?.textContent?.slice(0,500)}));
    throw new Error(`${error.message}\nField departure state: ${JSON.stringify(observed)}`);
  }
}
async function realtimeSquads(){
  const page=await open();await restoreRealtime(page,battleCampCode('ch5-mine'));
  const standards=await page.locator('[data-role="squadBar"] .rt-standard').count();assert.ok(standards>=3,`The squad bar has a standard for each squad (${standards})`);
  await page.waitForSelector('[data-role="commandPips"]:not([hidden])',{timeout:30000}).catch(()=>assert.fail('The Command pips show beside the clock'));
  await page.locator('#rt-board').focus();await page.keyboard.press('Shift+Digit1');
  await page.waitForSelector('[data-role="squadBar"] .rt-standard[aria-pressed="true"]',{timeout:30000}).catch(()=>assert.fail('Shift+1 selects the first squad'));
  await page.waitForSelector('[data-role="commandCard"]:not([hidden]) .rt-card-order[data-order="line"]',{timeout:30000}).catch(()=>assert.fail('The command card replaces the ability bar'));
  await page.keyboard.press('Digit4');
  if(await page.evaluate(()=>window.__realtime.paused()))await page.keyboard.press('KeyP');
  await page.waitForFunction(()=>window.__realtime.world().used.includes('formation'),null,{timeout:120000}).catch(()=>assert.fail('4 orders the selected squad into line'));
  await page.keyboard.press('KeyQ');await revealControl(page,'#modal .field-intel');await page.waitForSelector('#modal[open] .field-intel',{timeout:30000}).catch(()=>assert.fail('Q shows the field intelligence'));
  assert.match(await text(page,'#modal .field-intel'),/Field intelligence/);assert.match(await text(page,'#modal'),/Allied plans/);
  await page.context().close();
  console.log('ok - real-time squads: a restored Chapter V battle plays in real time with its squad bar, Command pips and command card; Shift+1 and 4 form a line; Q shows the field intelligence and Allied plans');
}
async function realtimeDeployment(){
  const page=await open();await restoreRealtime(page,battleCampCode('ch7-legion'));
  await page.waitForSelector('[data-role="deployBar"]:not([hidden])',{timeout:30000}).catch(()=>assert.fail('Chapter VII opens in deployment'));
  assert.equal(await page.evaluate(()=>window.__realtime.world().tick),0,'The clock stands still while deploying');
  await page.click('[data-role="advanceButton"]');await page.waitForSelector('[data-role="advanceButton"][data-confirm="true"]');
  assert.equal(await page.evaluate(()=>window.__realtime.world().tick),0,'One press only asks to confirm');
  // The confirmation within its five seconds: the button's own click, without Playwright's waits for a steady frame.
  await page.evaluate(()=>document.querySelector('[data-role="advanceButton"]').click());
  await page.waitForFunction(()=>window.__realtime.world().tick>5,null,{timeout:60000}).catch(()=>assert.fail('The second press sounds the advance and the battle runs'));
  assert.equal(await page.isVisible('[data-role="deployBar"]'),false,'The deployment bar is gone');
  await page.context().close();
  console.log('ok - real-time deployment: a restored Chapter VII battle opens with the clock stopped, and Sound the advance (pressed twice) starts it');
}

// Phase 3 in the page: a restored camp's Contest walked as the Curia.
async function restoreChamber(page,code,view='3d',{beforeStart=null}={}){
  await page.addInitScript(v=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:v}));}catch{}},view);
  await page.goto(base);await settingsCommand(page,'restore');
  await restoreCamp(page,code);
  if(beforeStart)await beforeStart();
  await (await revealControl(page,'[data-cmd="start"]')).click();
  await page.waitForSelector('.rt-field[data-kind="chamber"] .rt-scene[data-ready="true"]');
}
// The chronicle as the page saved it (storage.js: IndexedDB 'sacramentum', store 'saves', record 'campaign'), as JSON.
const savedRecord=page=>page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('sacramentum',1);r.onerror=()=>resolve(null);
  r.onsuccess=()=>{try{const get=r.result.transaction('saves').objectStore('saves').get('campaign');get.onsuccess=()=>{r.result.close();resolve(get.result?JSON.stringify(get.result):null);};
    get.onerror=()=>resolve(null);}catch{resolve(null);}};}));
const savedChronicle=async page=>{const record=await savedRecord(page);return record?JSON.parse(JSON.parse(record).payload):null;};
const saveIdle=page=>page.waitForFunction(()=>!/Saving/.test(document.querySelector('.save-status')?.textContent??''),null,{timeout:30000});
async function restoreCamp(page,code){
  await page.fill('#restore-code',code);await page.click('[data-cmd="import-code"]');
  await closedBy(page,()=>page.click('[data-cmd="confirm-import"]'));
  await page.waitForSelector('.camp-page');
}
// Hold the real browser save lock, rather than changing campaign state, to
// reproduce a slow first-visit autosave before either kind of departure.
async function campSaveDeparture(){
  for(const [id,kind]of [['ch5-mine','field'],['ch8-parley','chamber']]){
    const page=await open();
    await page.addInitScript(()=>{
      const request=navigator.locks.request.bind(navigator.locks),delay=window.__campSaveDelay={held:false,release:null};
      navigator.locks.request=(name,...args)=>{
        const callback=args.pop();
        return request(name,...args,async lock=>{
          if(name==='sacramentum-save'&&!delay.held&&document.querySelector('.camp-page')){
            delay.held=true;await new Promise(resolve=>{delay.release=resolve;});
          }
          return callback(lock);
        });
      };
    });
    const beforeStart=async()=>{
      await page.waitForFunction(()=>window.__campSaveDelay.held,null,{timeout:30000});
      assert.equal(await (await revealControl(page,'[data-cmd="start"]')).isDisabled(),true,`${id}: departure waits for the camp autosave`);
      assert.match(await text(page,'.save-status'),/Saving/);
      assert.equal(await page.locator('.rt-field[data-kind="camp"]').count(),1,'The camp stays open during the save');
      await page.evaluate(()=>window.__campSaveDelay.release());
    };
    if(kind==='field')await restoreRealtime(page,battleCampCode(id),{view:'2d',beforeStart});
    else await restoreChamber(page,battleCampCode(id),'2d',{beforeStart});
    assert.equal(await page.locator(`.rt-field[data-kind="${kind}"]`).count(),1,`${id}: one click departs after saving`);
    await page.context().close();
  }
  console.log('ok - slow camp autosave: departure stays disabled until saving finishes, then one click enters both a field and a chamber');
}
async function campStartupDeparture(){
  for(const [id,kind]of [['ch5-mine','field'],['ch8-parley','chamber']]){
    const page=await open({serviceWorkers:'block'});let releaseModule;
    const held=new Promise(resolve=>{releaseModule=resolve;});
    await page.route('**/src/showcase/realtime-field.js',async route=>{await held;await route.continue();});
    const loading=page.waitForRequest('**/src/showcase/realtime-field.js',{timeout:30000});
    void loading.catch(()=>{}); // A preceding restore failure still closes the page safely.
    const beforeStart=async()=>{
      await loading;
      assert.equal(await (await revealControl(page,'[data-cmd="start"]')).isDisabled(),true,`${id}: departure waits for initial camp setup`);
      releaseModule();
    };
    try{
      if(kind==='field')await restoreRealtime(page,battleCampCode(id),{view:'2d',beforeStart});
      else await restoreChamber(page,battleCampCode(id),'2d',{beforeStart});
      assert.equal(await page.locator(`.rt-field[data-kind="${kind}"]`).count(),1,`${id}: departure works after camp setup`);
    }finally{releaseModule();await page.context().close();}
  }
  console.log('ok - slow camp setup: departure remains disabled through module loading and the initial visit save, then enters field and chamber');
}
// A route choice is a saved campaign command just like departure. Hold both
// initialization boundaries so an enabled choice can never silently lose a click.
async function campRouteChoice(){
  const page=await open({serviceWorkers:'block'});let releaseModule;
  const held=new Promise(resolve=>{releaseModule=resolve;});
  await page.route('**/src/showcase/realtime-field.js',async route=>{await held;await route.continue();});
  const loading=page.waitForRequest('**/src/showcase/realtime-field.js',{timeout:30000});void loading.catch(()=>{});
  await page.addInitScript(()=>{
    localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:'2d'}));
    const request=navigator.locks.request.bind(navigator.locks),delay=window.__campRouteSaveDelay={held:false,release:null};
    navigator.locks.request=(name,...args)=>{
      const callback=args.pop();
      return request(name,...args,async lock=>{
        if(name==='sacramentum-save'&&!delay.held&&document.querySelector('.camp-page')){
          delay.held=true;await new Promise(resolve=>{delay.release=resolve;});
        }
        return callback(lock);
      });
    };
  });
  try{
    await page.goto(base);await settingsCommand(page,'restore');await restoreCamp(page,battleCampCode('ch12-confrontation'));await loading;
    const route='[data-cmd="route"][data-id="defection"]',firstPosition=page.locator('[data-cmd="company-up"][data-id="0"]');
    assert.equal(await (await revealControl(page,route)).isDisabled(),true,'A route waits for the initial camp runtime');
    assert.equal(await firstPosition.count(),1,'The first deployment position has its move-up control');
    assert.equal(await firstPosition.isDisabled(),true,'The first deployment position cannot move up');
    await menuButton(page,'settings');await page.waitForSelector('#modal[open] .settings-nav');
    await closedBy(page,()=>page.click('#modal [data-cmd="close-modal"] >> nth=0'));
    releaseModule();await page.waitForFunction(()=>window.__campRouteSaveDelay.held,null,{timeout:30000});
    assert.equal(await (await revealControl(page,route)).isDisabled(),true,'A route remains disabled throughout the initial camp save');
    assert.match(await text(page,'.save-status'),/Saving/);
    assert.equal(await page.locator('[data-cmd="ledger"]').first().isEnabled(),true,'Reading the ledger remains available during a camp save');
    await page.evaluate(()=>window.__campRouteSaveDelay.release());
    await (await revealControl(page,route)).click();await page.waitForSelector(`${route}.chosen`,{timeout:30000});
    assert.equal(await firstPosition.isDisabled(),true,'Ending the save never enables an inherently unavailable deployment order');
  }finally{
    releaseModule();await page.evaluate(()=>window.__campRouteSaveDelay?.release?.()).catch(()=>{});await page.context().close();
  }
  console.log('ok - camp route choice: initialization and saving disable mutations, Settings and ledger remain available, and one click selects defection after saving without enabling unavailable deployment orders');
}
// The gate reply first saves the conversation, then starts the encounter as a
// second command. Both steps must complete through the ordinary visible reply.
async function campGateDeparture(){
  for(const [id,kind]of [['ch5-mine','field'],['ch8-parley','chamber']]){
    const page=await open();
    await page.addInitScript(()=>{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:'2d'}));});
    await page.goto(base);await settingsCommand(page,'restore');await restoreCamp(page,battleCampCode(id));
    await (await revealControl(page,'[data-cmd="conversation"][data-id="gate"]')).click();
    await page.waitForSelector('#modal[open] [data-cmd="reply"][data-id="0"]');
    assert.match(await text(page,'#modal [data-cmd="reply"][data-id="0"]'),/March out/);
    await page.click('#modal [data-cmd="reply"][data-id="0"]');
    await page.waitForSelector(`.rt-field[data-kind="${kind}"] .rt-scene[data-ready="true"]`,{timeout:30000}).catch(async error=>{
      const observed=await page.evaluate(()=>({kind:document.querySelector('.rt-field')?.dataset.kind,modal:document.querySelector('#modal')?.open,
        save:document.querySelector('.save-status')?.textContent,feedback:document.querySelector('#announcement')?.textContent}));
      throw new Error(`${id}: the gate reply must enter its ${kind} after saving the conversation: ${error.message.split('\n')[0]}; ${JSON.stringify(observed)}`);
    });
    assert.equal(await page.evaluate(()=>{const world=window.__realtime.world();return world.encounterId??world.contestId;}),id,'The gate enters the selected next encounter');
    await page.context().close();
  }
  console.log('ok - camp gate reply: one March out reply saves the conversation and enters both a field and a chamber');
}
// Release 14: leaving camp on foot. The soldier is sent to the camp's way out with the world's own interact
// command, as All actions sends him. In a new chronicle's first camp, the drill yard refuses in the gate sentry's
// words and the save stays as it was; in Chapter II's camp, the road out marches the column to the broken
// causeway, with a card naming it, in 2D and 3D.
async function campExitDeparture(){
  const camp=async(code,view)=>{
    const page=await open();
    await page.addInitScript(v=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:v}));}catch{}},view);
    await page.goto(base);await settingsCommand(page,'restore');await restoreCamp(page,code);
    await page.waitForSelector('.rt-field[data-kind="camp"] .rt-scene[data-ready="true"]');return page;
  };
  const useExit=page=>page.evaluate(()=>window.__realtime.issue({actorId:'hero',kind:'interact',payload:{objectId:'exit'}}));
  // What the camp shows when a walk to the way out takes too long: its message, the clock and how far the soldier is
  // from the way out. Software rendering slows a 3D camp's clock to a tenth of real time or so (the first camp's 17 m
  // to the drill yard took 45 s on a local run, and more than 60 s on a slower CI runner), so each walk gets five minutes.
  const where=page=>page.evaluate(()=>{const w=window.__realtime.world(),h=w?.actors.find(a=>a.id==='hero'),o=w?.objects.find(x=>x.kind==='exit');
    return `announcement "${document.querySelector('#announcement')?.textContent??''}", paused ${window.__realtime.paused()}, `+
      `${h&&o?`${Math.hypot(h.x-o.x,h.z-o.z).toFixed(1)} m from the way out`:'no way out in view'}, tick ${w?.tick}`;});
  const saved=savedRecord;
  {
    const page=await camp(Game.encodeSave(Game.newGame('Exit',275,{featureEdition:35,progression:true,path:'legionary'})),'3d');
    const exit=await page.evaluate(()=>window.__realtime.world().objects.find(o=>o.kind==='exit'));
    assert.equal(exit?.name,'The drill yard','The first camp’s way out leads to the drill');
    const used=()=>page.evaluate(()=>window.__realtime.world().objects.find(o=>o.kind==='exit').at??null);
    assert.equal((await useExit(page)).ok,true,'The soldier walks to the way out');
    await page.waitForFunction(()=>/^The gate sentry: “/.test(document.querySelector('#announcement')?.textContent??''),null,{timeout:300000})
      .catch(async()=>assert.fail(`The sentry says what is missing: ${await where(page)}`));
    assert.match(await text(page,'#announcement'),/decision/,'The departure check is the sentry’s line');
    // Polish after Gate 4: shown, not only announced. The full-screen camp has no site header to put a page message
    // under, so the bar's event line says it; at this width it is whole on its line.
    assert.match(await text(page,'[data-role="eventLine"]'),/^The gate sentry: “.*decision/,'The sentry’s words show on the bar');
    assert.equal(await page.locator('[data-role="eventMore"]').isHidden(),true,'Whole on its line, the message needs no More');
    // Walking there recorded his first visit to the drill field (a save of its own). From where he stands now, the way
    // out is used again: the refusal itself saves and changes nothing.
    await page.waitForFunction(()=>!/Saving/.test(document.querySelector('.save-status')?.textContent??''),null,{timeout:30000});
    const before=await saved(page),first=await used();assert.ok(before,'The chronicle is saved');
    // On a phone the sentry's words are too long for the line: More opens the whole of them over the world.
    await page.setViewportSize({width:390,height:844});
    assert.equal((await useExit(page)).ok,true,'He uses the way out again');
    await page.waitForFunction(at=>(window.__realtime.world().objects.find(o=>o.kind==='exit').at??null)!==at,first,{timeout:120000})
      .catch(async()=>assert.fail(`The way out is used again: ${await where(page)}`));
    await page.waitForFunction(()=>!document.querySelector('[data-role="eventMore"]')?.hidden,null,{timeout:30000})
      .catch(async()=>assert.fail(`A cut message offers More: ${await text(page,'[data-role="eventLine"]')}`));
    await page.click('[data-role="eventMore"]');
    assert.match(await text(page,'[data-role="eventFull"]'),/^The gate sentry: “.*”$/,'More opens the whole message');
    assert.equal(await page.locator('[data-role="eventMore"]').getAttribute('aria-expanded'),'true');
    await page.click('[data-role="eventMore"]');assert.equal(await page.locator('[data-role="eventFull"]').isHidden(),true,'A second press closes it');
    // A click on the strip's text puts the focus on the page around the world: the keys are still the world's.
    const strip=await page.evaluate(()=>{const bar=document.querySelector('.world-camp-bar'),r=bar.getBoundingClientRect();
      for(let x=r.left+8;x<r.right-8;x+=12){const el=document.elementFromPoint(x,r.top+r.height/2);if(el&&!el.closest('button,a,input,select,summary,canvas')&&el.textContent.trim())return {x,y:r.top+r.height/2};}return null;});
    assert.ok(strip,'The strip has text to click');await page.mouse.click(strip.x,strip.y);
    assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'rt-board','The click takes the focus from the world');
    const wasPaused=await page.evaluate(()=>window.__realtime.paused());await page.keyboard.press('KeyP');
    await page.waitForFunction(was=>window.__realtime.paused()!==was,wasPaused,{timeout:30000}).catch(()=>assert.fail('P pauses the camp with the focus on the page'));
    await page.keyboard.press('KeyP');await page.waitForFunction(was=>window.__realtime.paused()===was,wasPaused,{timeout:30000});
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.phase),'camp','Nothing happens');assert.equal(await saved(page),before,'The refusal leaves the save as it was');
    await page.context().close();
  }
  const code=battleCampCode('ch2-marsh');
  for(const view of ['2d','3d']){
    const page=await camp(code,view);
    if(view==='2d'){
      // Polish after Gate 4: the 2D view places its names as the 3D view places its labels, so none overlap.
      await page.waitForFunction(()=>window.__chamber.stage()?.labelBoxes?.length>0,null,{timeout:60000});
      const boxes=await page.evaluate(()=>window.__chamber.stage().labelBoxes),overlaps=[];
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];
        if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)overlaps.push(`${a.id} / ${b.id}`);}
      assert.ok(boxes.length>=5,`2d: the camp's names are placed (${boxes.length})`);assert.deepEqual(overlaps,[],'2d: no two names overlap');
    }
    assert.equal((await useExit(page)).ok,true,`${view}: the soldier walks to the road out`);
    await page.waitForSelector('.area-card',{timeout:300000}).catch(async()=>assert.fail(`${view}: a card names where the column goes: ${await where(page)}`));
    assert.match(await text(page,'.area-card'),/The road out.*The broken causeway/,`${view}: the card names the way and the place`);
    await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]',{timeout:120000}).catch(()=>assert.fail(`${view}: the field opens`));
    assert.equal(await page.evaluate(()=>window.__realtime.world().encounterId),'ch2-marsh',`${view}: the next encounter`);
    await page.waitForSelector('.area-card',{state:'detached',timeout:30000}).catch(()=>assert.fail(`${view}: the card goes`));
    await page.context().close();
  }
  console.log('ok - camp way out: the first camp’s drill yard refuses in the sentry’s words, shown on the bar (whole with More on a phone), and changes nothing; the keys still work after a click on the strip; Chapter II’s road out marches to the causeway with a card, in 2D (no names overlapping) and 3D');
}
// Release 14: the field after a victory. Chapter III's station, won from New Game by the legal-command bot and not yet
// recorded (realtime-autoplay.mjs), restored through Import. The result offers to walk the field; walked, the fallen
// archer is searched and the strongbox (its key left with the raiders' leader, who lived) forced, each through the
// chronicle; the road to camp first names what is left behind and changes nothing, then records the result once.
function wonStationCode(){
  let code=null;const stop=new Error('stop');
  try{runRealtimeCampaign({throughChapter:3,ready:[1,2,3],seed:275,onEncounter:s=>{if(s.encounter?.id==='ch3-station'&&s.encounter.status==='won'){code=Game.encodeSave(s);throw stop;}}});}
  catch(error){if(error!==stop)throw error;}
  assert.ok(code,'The bot wins the station');return code;
}
async function fieldAftermath(){
  const code=wonStationCode(),expected=Game.decodeSave(code);
  assert.deepEqual(Game.fieldUnsearched(expected).map(u=>u.id),['enemy0','station-strongbox'],'The archer and the strongbox are left to search');
  const page=await open();
  await page.addInitScript(()=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:'3d'}));}catch{}});
  await page.goto(base);await settingsCommand(page,'restore');
  await page.fill('#restore-code',code);await page.click('[data-cmd="import-code"]');await closedBy(page,()=>page.click('[data-cmd="confirm-import"]'));
  await page.waitForSelector('.rt-result [data-cmd="walk-field"].primary',{timeout:120000}).catch(()=>assert.fail('The won station offers to walk the field, first'));
  const issue=command=>page.evaluate(c=>window.__realtime.issue(c),command);
  // What the page shows when a step takes too long: its message, any open window, the clock and how far the soldier
  // is from where he goes.
  const stateOf=target=>page.evaluate(id=>{const w=window.__realtime.world(),h=w?.actors.find(a=>a.id==='hero'),o=w?.objects.find(x=>x.id===id),m=document.querySelector('#modal');
    return `announcement "${document.querySelector('#announcement')?.textContent??''}", phase ${document.documentElement.dataset.phase}, `+
      `window ${m?.open?m.dataset.soldier??'open':'closed'}, paused ${window.__realtime.paused()}, `+
      `${h&&o?`${Math.hypot(h.x-o.x,h.z-o.z).toFixed(1)} m from ${id}`:'no field'}, tick ${w?.tick}`;},target);
  // A closed window gives the world back on its own; P resumes it only if it stays paused, once that is clear, so the
  // two never cross (a P pressed just as the window's pause lifts would pause it again). After the third press the
  // field gets one more look before the check gives up.
  const running=async()=>{
    for(let tries=0;;tries++){
      if(await page.waitForFunction(()=>!window.__realtime.paused(),null,{timeout:4000}).then(()=>true,()=>false))return;
      if(tries===3)assert.fail(`The walked field runs again: ${await stateOf('exit')}`);
      await page.locator('#rt-board').focus();await page.keyboard.press('KeyP');
    }
  };
  const closeWindow=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#modal')?.open);};
  await page.click('.rt-result [data-cmd="walk-field"]');
  await page.waitForFunction(()=>window.__realtime.world()?.aftermath===true&&!!document.querySelector('.rt-aftermath'),null,{timeout:60000})
    .catch(()=>assert.fail('The field is walked, with its strip'));
  assert.equal(await page.locator('.rt-result').count(),0,'The strip stands in for the result');
  assert.equal(await page.evaluate(()=>document.querySelector('main.realtime-frame').dataset.outcome),'walking');
  await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]',{timeout:120000});
  assert.equal(await page.evaluate(()=>window.__realtime.world().actors.some(a=>a.side==='enemy'&&a.alive)),false,'The living raiders have gone');
  const drawn=await issue({actorId:'hero',kind:'setDrawn',payload:{drawn:true}});
  assert.equal(drawn.ok,false);assert.equal(drawn.reason,'PEACEFUL_FIELD','Weapons stay sheathed');
  // The road at once: it names what is still on the field, and nothing is recorded or saved.
  await saveIdle(page);const before=await savedRecord(page);await running();
  assert.equal((await issue({actorId:'hero',kind:'interact',payload:{objectId:'exit'}})).ok,true,'The soldier walks to the road');
  await page.waitForFunction(()=>/^Still on the field: /.test(document.querySelector('#announcement')?.textContent??''),null,{timeout:300000})
    .catch(async()=>assert.fail(`The road names what is left: ${await stateOf('exit')}`));
  assert.match(await text(page,'#announcement'),/Gothic archer \(fallen\), The station strongbox/);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.phase),'encounter','Nothing is recorded yet');
  assert.equal(await savedRecord(page),before,'The warning changes nothing');
  // The fallen archer: walked to and searched; what he carried is staged with the result in the saved chronicle.
  await running();await issue({actorId:'hero',kind:'loot',payload:{targetId:'enemy0'}});
  await page.waitForSelector('#modal[open] [data-cmd="rt-take"][data-item="*"]',{timeout:300000}).catch(async()=>assert.fail(`The archer’s belongings open: ${await stateOf('exit')}`));
  await page.click('#modal [data-cmd="rt-take"][data-item="*"]');
  await page.waitForFunction(()=>window.__realtime.world().actors.find(a=>a.id==='enemy0')?.loot?.length===0,null,{timeout:60000})
    .catch(()=>assert.fail('The walked field follows the take'));
  await saveIdle(page);assert.deepEqual((await savedChronicle(page)).encounter.staged.spoils,['coin_purse','quiver'],'Staged in the saved chronicle');
  await closeWindow();
  // The strongbox: no key was taken here, so the strong soldier forces it, then takes all it holds.
  await running();await issue({actorId:'hero',kind:'interact',payload:{objectId:'station-strongbox'}});
  await page.waitForSelector('#modal[open] [data-cmd="rt-open-box"][data-method="force"]:not([disabled])',{timeout:300000})
    .catch(async()=>assert.fail(`The locked strongbox offers force: ${await stateOf('station-strongbox')}`));
  assert.equal(await page.locator('#modal [data-cmd="rt-open-box"][data-method="key"]').isDisabled(),true,'Its key is not on the field');
  await page.click('#modal [data-cmd="rt-open-box"][data-method="force"]');
  await page.waitForSelector('#modal[open] [data-cmd="rt-take-from"][data-item="*"]',{timeout:60000}).catch(()=>assert.fail('Forced open, it shows what it holds'));
  await page.click('#modal [data-cmd="rt-take-from"][data-item="*"]');
  await page.waitForFunction(()=>window.__realtime.world().objects.find(o=>o.id==='station-strongbox')?.contents?.length===0,null,{timeout:60000})
    .catch(()=>assert.fail('The strongbox is emptied'));
  // Closed at once, while the take may still be saving: once it is saved the window stays closed (on a slower machine
  // it used to open again, pausing the field).
  await closeWindow();await saveIdle(page);
  assert.equal(await page.evaluate(()=>!!document.querySelector('#modal')?.open),false,'A window closed while its take saves stays closed');
  // The road again: nothing is left, so it records the result once and the column comes back to camp. Software rendering
  // slows the walk (about 20 m, 8 s of game time) to a minute or more.
  await saveIdle(page);await running();
  assert.equal((await issue({actorId:'hero',kind:'interact',payload:{objectId:'exit'}})).ok,true);
  await page.waitForSelector('.area-card',{timeout:300000}).catch(async()=>assert.fail(`A card names the camp: ${await stateOf('exit')}`));
  assert.match(await text(page,'.area-card'),/The road to camp/);
  await page.waitForFunction(()=>document.documentElement.dataset.phase==='camp',null,{timeout:60000});await saveIdle(page);
  const recorded=await savedChronicle(page);
  assert.equal(recorded.history.filter(h=>h.id==='ch3-station').length,1,'The station is recorded once');
  assert.ok([...recorded.soldier.pack,...Object.values(recorded.soldier.ground??{}).flat()].some(e=>e.id==='gladius_fine'),'The strongbox’s sword reached the soldier');
  await page.context().close();
  console.log('ok - field after a victory: a restored won station is walked; the road names the archer and the strongbox and changes nothing; both are searched through the chronicle; the road then records the result once and returns to camp');
}
// Every chamber command is recorded through the page's save transaction: wait for it before the next.
const chamberIdle=page=>page.waitForFunction(()=>window.__chamber.pending()===0,null,{timeout:60000});
const chamberHour=page=>page.evaluate(()=>window.__chamber.hour());
// What the chamber page showed when a step did not happen: the Menu, the view, the conversation and what was last said.
const chamberSeen=page=>page.evaluate(()=>JSON.stringify({menu:!!document.querySelector('#modal')?.open,view:document.querySelector('#rt-board')?.dataset.drawn??null,
  talking:window.__chamber.talking(),hour:window.__chamber.hour()?.hour??null,said:document.querySelector('#announcement')?.textContent??''}));
// Chapter VII's council in 3D, by pointer and keys: a seat in the coalition strip opens the
// conversation, asking his interest is free, Walk beside him and Persuade change his stance,
// Y yields and the rivals' hour plays until Space skips it, U names the rivals' next walks, a
// click on a member's figure talks to him, and yielding to the deadline ends in the division and the result.
async function chamberCouncil(){
  const page=await open();await restoreChamber(page,battleCampCode('ch7-council'));
  assert.match(await text(page,'[data-role="roundLabel"]'),/^Hour 1 of \d+$/,'The clepsydra counts hours');
  assert.equal(await page.locator('[data-role="abilityBar"] [data-speech]').count(),1,'Chapter VII has taught Persuade alone');
  await revealControl(page,'[data-role="coalition"] [data-person]');
  assert.match(await text(page,'[data-role="coalition"]'),/of 13 for · 7 needed/,'The coalition strip counts the vote');
  let member=null;
  for(let i=0;i<await page.locator('[data-role="coalition"] [data-person]').count()&&!member;i++){
    await page.locator('[data-role="coalition"] [data-person]').nth(i).click();await page.waitForSelector('[data-role="conversation"]:not([hidden])');
    if(await page.locator('[data-role="conversation"] [data-walk]').count())member=await page.evaluate(()=>window.__chamber.talking());
  }
  assert.ok(member,'A member the soldier can walk beside this hour');
  const hour=JSON.stringify(await chamberHour(page));await page.click('[data-role="conversation"] [data-ask]');
  await page.waitForSelector('[data-role="conversation"] .rt-talk-interest');assert.equal(JSON.stringify(await chamberHour(page)),hour,'Asking takes no time and changes nothing');
  const stance=await page.evaluate(id=>window.__chamber.unit(id).stance,member);
  await page.click('[data-role="conversation"] [data-walk]');await chamberIdle(page);assert.equal(await page.evaluate(()=>window.__chamber.unit('hero').moved),true,'He walks beside him');
  await page.waitForSelector('[data-role="conversation"] [data-speak="persuade"]');await page.click('[data-role="conversation"] [data-speak="persuade"]');await chamberIdle(page);
  assert.equal(await page.evaluate(()=>window.__chamber.unit('hero').acted),true,'Persuade spends his speech');
  assert.ok(await page.evaluate(id=>window.__chamber.unit(id).stance,member)>stance,'Persuade moves the member');
  await page.locator('#rt-board').focus();await page.keyboard.press('Escape');assert.equal(await page.isHidden('[data-role="conversation"]'),true,'Escape closes the conversation');
  assert.equal(await page.evaluate(()=>document.querySelector('#modal').open),false,`Escape closes the conversation, not the Menu: ${await chamberSeen(page)}`);
  await page.keyboard.press('KeyY');await page.waitForSelector('[data-role="rivalsBand"]:not([hidden])',{timeout:30000})
    .catch(async()=>assert.fail(`Y yields and the rivals take their hour: ${await chamberSeen(page)}`));
  await page.keyboard.press('Space');await page.waitForSelector('[data-role="rivalsBand"]',{state:'hidden',timeout:30000}).catch(()=>assert.fail('Space skips the rivals’ hour'));
  // The HUD redraws on the next frame.
  assert.equal((await chamberHour(page)).hour,2);await page.waitForFunction(()=>/^Hour 2 of/.test(document.querySelector('[data-role="roundLabel"]')?.textContent??''),null,{timeout:30000})
    .catch(async()=>assert.fail(`The hour reads ${await text(page,'[data-role="roundLabel"]')}`));
  await page.keyboard.down('KeyU');await page.waitForFunction(()=>/challenges|attacks|no plan/.test(document.querySelector('[data-role="messageLine"]').textContent),null,{timeout:10000})
    .catch(async()=>assert.fail(`U names where each rival means to walk next: ${await page.evaluate(()=>{const a=document.activeElement;
      return JSON.stringify({line:document.querySelector('[data-role="messageLine"]')?.textContent??null,focus:a===document.body?'body':`${a?.tagName}#${a?.id}`,
        dialog:!!document.querySelector('dialog[open],[aria-modal="true"]'),labels:document.body.classList.contains('labels-full')});})} ${await chamberSeen(page)}`));
  await page.keyboard.up('KeyU');
  // The pointer: a click on a member's figure opens his conversation.
  const figure=await page.evaluate(()=>{const s=window.__chamber.stage(),w=window.__realtime.world(),r=s.canvas.getBoundingClientRect();
    for(const a of w.actors.filter(x=>x.civic?.role==='voter')){const g=s.actors.get(a.id).group.position.clone();g.y+=1.1;g.project(s.camera);
      const x=r.left+(g.x+1)/2*r.width,y=r.top+(1-g.y)/2*r.height;if(document.elementFromPoint(x,y)===s.canvas)return {id:a.id,x,y};}return null;});
  assert.ok(figure,'A member is in view');await page.mouse.move(figure.x,figure.y);await page.mouse.down();await page.mouse.up();
  await page.waitForFunction(id=>window.__chamber.talking()===id,figure.id,{timeout:30000}).catch(()=>assert.fail('A click on a member talks to him'));
  for(let guard=0;(await chamberHour(page)).status==='active'&&guard<20;guard++){
    await page.locator('#rt-board').focus();await page.keyboard.press('KeyY');await chamberIdle(page);
    await page.waitForSelector('[data-role="rivalsBand"]:not([hidden])',{timeout:30000});
    // The final vote deliberately focuses the result. Use the visible Skip
    // control so the test does not send a battlefield shortcut to that heading.
    await page.locator('[data-role="rivalsBand"] [data-skip]').click();
  }
  await page.waitForSelector('[data-role="rivalsBand"]:not([hidden])',{timeout:30000}).catch(()=>assert.fail('The members divide at the vote'));
  assert.match(await text(page,'[data-role="rivalsBand"]'),/The division/);
  await page.waitForSelector('.chamber-result',{timeout:30000}).catch(()=>assert.fail('The vote’s result is shown'));
  assert.match(await text(page,'.chamber-result'),/The motion (carries|is defeated)\./);
  await page.context().close();
  console.log('ok - chamber: Chapter VII’s council in 3D: a seat opens the conversation, asking is free, Walk beside him and Persuade move a member, Y and Space play and skip the rivals’ hour, U names their next walks, a click on a figure talks to him, and the vote ends in the division and its result');
}
// A chamber whose 3D view fails (its WebGL context lost for longer than the stage waits) is built again in 2D, as
// the page does for any failed 3D view: the conversation that was open stays open, so Escape closes it rather than
// opening the Menu, the failure's notice is the last thing said, and Y still yields the floor.
async function chamberViewFallback(){
  const page=await open();await restoreChamber(page,battleCampCode('ch7-council'));
  await revealControl(page,'[data-role="coalition"] [data-person]');
  await page.locator('[data-role="coalition"] [data-person]').first().click();await page.waitForSelector('[data-role="conversation"]:not([hidden])');
  const member=await page.evaluate(()=>window.__chamber.talking());assert.ok(member,'A seat opens his conversation');
  await page.evaluate(()=>{const c=document.querySelector('#rt-board');(c.getContext('webgl2')??c.getContext('webgl'))?.getExtension('WEBGL_lose_context')?.loseContext();});
  await page.waitForSelector('#rt-board[data-drawn="2d"]',{timeout:30000}).catch(()=>assert.fail('A lost 3D view is built again in 2D'));
  await page.waitForSelector('.rt-field[data-kind="chamber"] .rt-scene[data-ready="true"]');
  assert.equal(await page.evaluate(()=>window.__chamber.talking()),member,`The conversation stays open in the 2D view: ${await chamberSeen(page)}`);
  assert.equal(await page.isHidden('[data-role="conversation"]'),false,'The conversation is shown in the 2D view');
  assert.match(await text(page,'#announcement'),/3D view unavailable/,'The failure’s notice is the last thing said');
  await page.locator('#rt-board').focus();await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.querySelector('#modal').open),false,`Escape closes the conversation, not the Menu: ${await chamberSeen(page)}`);
  assert.equal(await page.isHidden('[data-role="conversation"]'),true,'Escape closes the conversation');
  await page.keyboard.press('KeyY');await page.waitForSelector('[data-role="rivalsBand"]:not([hidden])',{timeout:30000})
    .catch(async()=>assert.fail(`Y yields in the 2D view: ${await chamberSeen(page)}`));
  await page.context().close();
  console.log('ok - chamber 3D fallback: a lost 3D view is built again in 2D with the open conversation kept; Escape closes it and Y yields');
}
// Gates 3 and 4: every chamber Contest (VII, VIII, X, both of XI and XII) played through in full in the page, in
// the 2D view: a winning legal rules log recorded from the same camp, replayed through the Command list's
// own path (walks, speeches and yields as a player gives them), to the vote and Record the result.
async function chamberContests(){
  const played=[];
  for(const id of ['ch7-council','ch8-parley','ch10-tribunal','ch11-accounts','ch11-adlection','ch12-legitimacy']){
    const code=battleCampCode(id),probe=Game.decodeSave(code);assert.ok(Game.startEncounter(probe).ok);
    // The existing coalition policy accounts for the rival's reply instead of
    // protecting only this turn's vote. Every move/speech is still previewed,
    // issued publicly and recorded for the browser's exact replay below.
    const trace=[],summary=playEncounter(probe,{approach:'record',trace,beforeTurn:s=>protectCoalition(s,(target,name,payload)=>{
      assert.equal(name,'act');return command(target,target.encounter.units.find(u=>u.id===payload.unitId),payload.action,
        {x:payload.x,y:payload.y,unitId:payload.targetId});
    })});assert.equal(summary.status,'won',`${id}: the recorded log wins`);
    const page=await open();await restoreChamber(page,code,'2d');
    const start=await page.evaluate(()=>['hero','member0','member8','rival-speaker'].map(id=>window.__chamber.unit(id)).map(u=>[u.x,u.y,u.stance??u.resolve]));
    const fresh=Game.decodeSave(code);Game.startEncounter(fresh);
    assert.deepEqual(start,['hero','member0','member8','rival-speaker'].map(i=>fresh.encounter.units.find(u=>u.id===i)).map(u=>[u.x,u.y,u.stance??u.resolve]),`${id}: the page starts the same chamber`);
    let ended=false,commands=0;
    for(const t of trace){
      if(t.kind==='endTurn'){if(ended){ended=false;continue;}await page.evaluate(()=>window.__chamber.use({kind:'yield'}));await chamberIdle(page);continue;}
      const c=t.payload,before=await chamberHour(page);
      await page.evaluate(op=>window.__chamber.use(op),c.action==='move'?{kind:'walk',unitId:c.unitId,tile:{x:c.x,y:c.y}}:{kind:'speak',command:c});await chamberIdle(page);
      const after=await chamberHour(page);commands++;ended=after.hour!==before.hour||after.status!==before.status;
    }
    const result=await chamberHour(page);assert.equal(result.status,'won',`${id}: won in the page`);assert.deepEqual(result.votes,Game.voteCount(probe),`${id}: the same vote`);
    const members=probe.encounter.units.filter(u=>u.role==='voter');
    assert.deepEqual(await page.evaluate(ids=>ids.map(i=>window.__chamber.unit(i).stance),members.map(u=>u.id)),members.map(u=>u.stance),`${id}: every member’s stance as the rules played it`);
    await page.waitForSelector('.chamber-result [data-cmd="commit"]',{timeout:30000});await page.click('.chamber-result [data-cmd="commit"]');
    await page.waitForFunction(()=>!document.querySelector('.chamber-frame'),null,{timeout:60000}).catch(()=>assert.fail(`${id}: Record the result leaves the chamber`));
    played.push(`${id} (${commands} commands, ${result.votes.for} of ${result.votes.total})`);await page.context().close();
  }
  console.log(`ok - chamber Contests: every walk-and-talk Contest played through in full in the 2D page, won and recorded: ${played.join(', ')}`);
}

// A hearing (Chapter X's tribunal, 2D): the Motion panel invokes a career precedent with the
// soldier's speech; in the next hour the pack's documents are inspected (each member's exact
// change), and one is dragged from the presiding magistrate's panel onto the tribunal.
async function chamberHearing(){
  const page=await open();await restoreChamber(page,battleCampCode('ch10-tribunal'),'2d');
  await page.click('[data-role="motionButton"]');await page.waitForSelector('[data-role="conversation"]:not([hidden]) [data-precedent]');
  assert.match(await text(page,'[data-role="conversation"]'),/The motion/,'The Motion panel holds the policy debate');
  await page.click('[data-role="conversation"] [data-precedent]:not(:disabled) >> nth=0');await chamberIdle(page);
  assert.equal(await page.evaluate(()=>window.__chamber.unit('hero').acted),true,'A precedent spends the soldier’s speech');
  await page.locator('#rt-board').focus();await page.keyboard.press('KeyY');await chamberIdle(page);await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.__chamber.hour().hour===2&&!window.__chamber.busy(),null,{timeout:30000});
  await page.keyboard.press('KeyI');await page.waitForSelector('#modal[open] .kit-documents',{timeout:30000}).catch(()=>assert.fail('The pack holds the hearing’s documents'));
  await page.click('#modal .kit-documents [data-cmd="inspect-case"] >> nth=0');await page.waitForSelector('#modal[open] .case-preview-table');
  assert.ok(await page.locator('#modal .case-preview-table tbody tr').count()>0,'Inspecting shows each member’s exact change');await page.click('#modal [data-cmd="close-modal"] >> nth=0');
  const tribunalPoint=()=>page.evaluate(()=>{const s=window.__chamber.stage(),a=window.__realtime.world().actors.find(x=>x.id==='magistrate'),r=s.canvas.getBoundingClientRect(),p=s.screen(s.lastView,a.x,a.z);
    return {x:r.left+p.x,y:r.top+p.y-s.lastView.th*1.2};});
  const tribunal=await tribunalPoint();
  await page.mouse.move(tribunal.x,tribunal.y);await page.mouse.down();await page.mouse.up();
  await page.waitForFunction(()=>window.__chamber.talking()==='magistrate',null,{timeout:30000}).catch(()=>assert.fail('A click on the magistrate opens the tribunal'));
  const document=page.locator('[data-role="conversation"] [data-document][draggable="true"] >> nth=0');
  await document.scrollIntoViewIfNeeded();
  // The conversation reserves a column and resizes the scene. Use the tribunal's
  // rendered position after that layout (and any document scroll), just as a player does.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const doc=await document.boundingBox(),drop=await tribunalPoint();
  await page.mouse.move(doc.x+doc.width/2,doc.y+12);await page.mouse.down();await page.mouse.move(doc.x+doc.width/2-30,doc.y+30,{steps:4});
  await page.mouse.move(drop.x,drop.y+10,{steps:12});await page.mouse.up();await chamberIdle(page);
  await page.waitForFunction(()=>window.__chamber.unit('hero').acted,null,{timeout:30000}).catch(()=>assert.fail('A document dropped on the tribunal is presented'));
  assert.match(await text(page,'[data-role="eventLine"]'),/One speech;/,'The rules record the documented case');
  await page.context().close();
  console.log('ok - chamber hearing: the Motion panel invokes a precedent, the pack’s documents show each member’s exact change, and a document dragged onto the tribunal is presented');
}

// Phase 4: the finale in the page (2D). The Chapter XII camp's defection route is chosen, the company
// deploys and the advance is sounded; the soldier walks to the nearest rival band (legal commands through
// the field's own path) and swears the oath with Rally: the band hears it, and the progress line counts pledges.
async function realtimeFinale(){
  const page=await open();
  await page.addInitScript(()=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:'2d'}));}catch{}});
  await page.goto(base);await settingsCommand(page,'restore');
  await restoreCamp(page,battleCampCode('ch12-confrontation'));
  await (await revealControl(page,'[data-cmd="route"][data-id="defection"]')).click();
  await page.waitForSelector('[data-cmd="route"][data-id="defection"].chosen').catch(()=>assert.fail('The defection route is chosen'));
  await (await revealControl(page,'[data-cmd="start"]')).click();
  await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]').catch(()=>assert.fail('The finale’s field is ready'));
  const rally=page.locator('[data-role="abilityBar"] [data-ability="rally"]');
  assert.equal(await rally.isVisible(),true,'Rally is visible without opening More actions');
  assert.match(await rally.getAttribute('title'),/Win allegiance.*morale/,'Rally explains its effect on rival formations');
  await page.waitForSelector('[data-role="advanceButton"]:not([hidden])',{timeout:30000}).catch(()=>assert.fail('Chapter XII opens in deployment'));
  await page.click('[data-role="advanceButton"]');
  await page.waitForSelector('[data-role="advanceButton"][data-confirm="true"]',{timeout:60000}).catch(async()=>{
    assert.fail(`One press asks to confirm the advance: ${await page.evaluate(()=>{const b=document.querySelector('[data-role="advanceButton"]');
      return JSON.stringify({hidden:b?.closest('[hidden]')?.dataset.role??null,text:b?.textContent,confirm:b?.dataset.confirm??null,tick:window.__realtime.world()?.tick,modal:document.querySelector('#modal')?.open,
        line:document.querySelector('[data-role="eventLine"]')?.textContent});})}`);});
  // The confirmation within its five seconds: the button's own click, without Playwright's waits for a steady frame.
  await page.evaluate(()=>document.querySelector('[data-role="advanceButton"]').click());
  await page.waitForFunction(()=>window.__realtime.world().tick>5,null,{timeout:60000}).catch(()=>assert.fail('The advance is sounded'));
  assert.match(await text(page,'[data-role="progress"]'),/Pledges 0 of 3/,'The progress line counts pledges');
  assert.deepEqual(await page.evaluate(()=>window.__realtime.world().squads.filter(q=>q.side==='enemy').map(q=>q.name).slice(0,2)),['Rival claimant','Civil-war cohort 2'],'The bands keep their names');
  // The Rally button forecasts the oath (release 12): from the deployment line, how far the nearest band is.
  const rallyNote=()=>text(page,'[data-role="abilityBar"] [data-ability="rally"] small');
  assert.match(await rallyNote(),/^\d+ m away$/,'Before the walk, the Rally button says how far the nearest band is');
  // Walk to the nearest rival band, then swear the oath once it is within three places (23 m). Only a band's
  // men count: the claimant's guard captain (a release 11 champion) seeks the soldier out, but he is no band.
  const heard=await page.evaluate(async()=>{
    const w=()=>window.__realtime.world(),hero=()=>w().actors.find(a=>a.id==='hero'),wait=ms=>new Promise(r=>setTimeout(r,ms));
    const near=()=>{const h=hero(),bands=new Set(w().squads.filter(q=>q.side==='enemy').map(q=>q.id));
      return w().actors.filter(a=>a.side==='enemy'&&a.alive&&bands.has(a.squadId)).map(a=>({a,d:Math.hypot(a.x-h.x,a.z-h.z)})).sort((x,y)=>x.d-y.d)[0];};
    let sworn=null;
    for(let i=0;i<600;i++){
      if(window.__realtime.paused())document.querySelector('[data-role="pauseButton"]')?.click();
      const n=near();if(!n)return 'no rival';
      if(n.d<=20){
        // In reach, the button says so before the oath is sworn.
        for(let k=0;k<20&&document.querySelector('[data-role="abilityBar"] [data-ability="rally"] small')?.textContent!=='in reach';k++)await wait(100);
        window.__rallyNote=document.querySelector('[data-role="abilityBar"] [data-ability="rally"] small')?.textContent;
        const r=window.__realtime.issue({actorId:'hero',kind:'ability',payload:{abilityId:'rally'}});if(r.ok){sworn={id:n.a.id,d:Math.round(n.d),tick:w().tick};break;}}
      else if(!hero().goal||Math.hypot(hero().goal.x-n.a.x,hero().goal.z-n.a.z)>4)window.__realtime.issue({actorId:'hero',kind:'move',payload:{x:n.a.x,z:n.a.z}});
      await wait(100);
    }
    for(let i=0;i<300;i++){if(w().log.some(l=>/hears the soldier’s oath/.test(l.text)))return 'heard';await wait(100);}
    const n=near(),h=hero(),champion=w().actors.find(a=>a.ai?.role==='champion');
    return `not heard: ${JSON.stringify({sworn,tick:w().tick,nearest:n&&{id:n.a.id,d:Math.round(n.d)},hero:{hp:Math.round(h.hp),alive:h.alive},
      champion:champion&&{alive:champion.alive,d:Math.round(Math.hypot(champion.x-h.x,champion.z-h.z))}})}`;
  });
  assert.equal(heard,'heard','A rival band hears the oath');
  assert.equal(await page.evaluate(()=>window.__rallyNote),'in reach','Within reach, the Rally button says so before the oath');
  await page.waitForFunction(()=>/Pledges \d of 3/.test(document.querySelector('[data-role="progress"]')?.textContent??''));
  await page.context().close();
  console.log('ok - finale: Chapter XII’s defection route opens in real time from its camp, deploys and advances; the rival bands keep their names; the Rally button forecasts the oath’s reach, and the soldier’s oath (Rally within 23 m) is heard');
}

// Phase 4's settings in the page (2D): a Story chronicle's Time and pace start at 75% with a pause on enemies in
// view; Pause is remapped to K from the Menu (a browser key is refused, Esc cancels), K pauses the camp, the
// pause button and the generated Controls & rules name K, and Restore default keys gives P back.
async function settingsAndHelp(){
  const page=await open();
  await page.addInitScript(()=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:'2d'}));}catch{}});
  await page.goto(base);await page.click('[data-cmd="new"]');await (await revealControl(page,'input[name="campaign-difficulty"][value="story"]')).check();await page.click('[data-cmd="begin"]');
  await page.waitForSelector('.rt-field[data-kind="camp"] .rt-scene[data-ready="true"]');
  if(await page.evaluate(()=>document.querySelector('#modal')?.open))await page.click('#modal [data-cmd="close-modal"] >> nth=0');
  await menuButton(page,'settings');await settingsPage(page,'controls');await revealControl(page,'#pause-sighted');
  assert.equal(await page.inputValue('#game-speed'),'0.75','Story starts at 75%');assert.equal(await page.isChecked('#pause-sighted'),true,'and pauses when an enemy comes into view');
  assert.equal(await page.isChecked('#pause-hurt'),false);
  const status=()=>text(page,'#rebind-status');await page.click('#modal details.key-map > summary');
  await (await revealControl(page,'.key-row[data-action="war_cry"] [data-cmd="rebind"]')).click();await page.keyboard.press('Tab');
  await page.waitForFunction(()=>/belongs to the browser/.test(document.querySelector('#rebind-status')?.textContent??''),null,{timeout:10000})
    .catch(async()=>assert.fail(`Tab is refused: ${await status()}`));
  await (await revealControl(page,'.key-row[data-action="war_cry"] [data-cmd="rebind"]')).click();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>/unchanged/.test(document.querySelector('#rebind-status')?.textContent??''),null,{timeout:10000});
  assert.equal(await page.evaluate(()=>document.querySelector('#modal')?.open),true,'Esc cancels the change, not the Menu');
  await (await revealControl(page,'.key-row[data-action="pause"] [data-cmd="rebind"]')).click();await page.keyboard.press('KeyK');
  await page.waitForFunction(()=>/Pause and resume is now K\./.test(document.querySelector('#rebind-status')?.textContent??''),null,{timeout:10000})
    .catch(async()=>assert.fail(`K is taken for Pause: ${await status()}`));
  assert.equal(await text(page,'.key-row[data-action="pause"] kbd'),'K or Pause');
  await page.click('#modal [data-cmd="close-modal"] >> nth=0');
  assert.equal(await page.getAttribute('[data-role="pauseButton"]','aria-keyshortcuts'),'K or Pause','The pause button names K');
  await page.locator('#rt-board').focus();if(await page.evaluate(()=>window.__realtime.paused()))await page.keyboard.press('KeyK');
  await page.waitForFunction(()=>window.__realtime.paused()===false,null,{timeout:10000});await page.keyboard.press('KeyK');
  await page.waitForFunction(()=>window.__realtime.paused()===true,null,{timeout:10000}).catch(()=>assert.fail('K pauses'));
  await page.keyboard.press('KeyP');assert.equal(await page.evaluate(()=>window.__realtime.paused()),true,'P no longer pauses');
  // The Menu pauses while it is open. Its close event can come hundreds of milliseconds after it closes, and keys
  // pressed before then are the player's: resumed and paused again, the world stays paused when the event comes.
  await page.keyboard.press('KeyK');await page.waitForFunction(()=>window.__realtime.paused()===false,null,{timeout:10000});
  await menuButton(page,'settings');await settingsPage(page,'controls');await revealControl(page,'#pause-sighted');
  await page.evaluate(()=>new Promise(done=>{
    const modal=document.querySelector('#modal'),c=document.querySelector('#rt-board'),k=()=>c.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyK',key:'k',bubbles:true,cancelable:true}));
    // The page's own close handler runs first; then this one.
    modal.addEventListener('close',()=>setTimeout(done),{once:true});modal.close();k();k();}));
  assert.equal(await page.evaluate(()=>window.__realtime.paused()),true,'A pause chosen as the Menu closes stands');await page.locator('#rt-board').focus();
  await page.keyboard.press('Shift+Slash');await page.waitForSelector('#modal[open] .guide-help',{timeout:30000}).catch(()=>assert.fail('? opens the guide'));
  await (await revealControl(page,'#modal .guide-index [data-cmd="help-section"][data-id="controls"]')).click();await page.waitForSelector('#modal .help-keys.changed[data-actions="pause"]');
  assert.match(await text(page,'#modal .help-keys.changed[data-actions="pause"]'),/K or Pause \(by default P or Pause\)/);
  await page.click('#modal [data-cmd="close-modal"] >> nth=0');await menuButton(page,'settings');await settingsPage(page,'controls');await page.click('#modal details.key-map > summary');
  await page.click('#modal [data-cmd="reset-keys"]');
  assert.equal(await text(page,'.key-row[data-action="pause"] kbd'),'P or Pause','Restore default keys');
  await page.context().close();
  console.log('ok - settings: a Story chronicle starts at 75% with a pause on enemies in view; Pause remapped to K in the Menu (Tab refused, Esc cancels) pauses the camp and is named on its button and in the generated Controls & rules; a pause chosen as the Menu closes stands; Restore default keys');
}

// Migration from 0.38 in the page (2D): a Chapter V camp saved before 0.40 (no soldier record) asks once for the
// soldier's training and grants the training points of Chapters I–IV; a battle in progress on the 0.38 board offers
// Restart in real time, which opens the same battle in real time from its checkpoint.
// Release 10: Practice plays a completed encounter as the chronicle plays. In real time a battle opens the
// live field and a Contest the chamber, each under the Archive's banner with its mutators; F2 saves nothing,
// and Return to chronicle brings back the camp exactly as it was, as does a reload.
// The chronicle a save code holds, as the page exported it (storage.js: gzip where the browser has CompressionStream).
function codePayload(code){
  const [prefix,body]=code.trim().split('.'),bytes=Buffer.from(body,'base64'),raw=(prefix==='SAC1'?gunzipSync(bytes):bytes).toString('utf8'),parsed=JSON.parse(raw);
  return parsed.format===1?parsed.payload:raw;
}
async function realtimePractice(){
  const page=await open();
  await page.addInitScript(()=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:'2d'}));}catch{}});
  await page.goto(base);await settingsCommand(page,'restore');await restoreCamp(page,battleCampCode('ch8-parley'));
  // The camp markup precedes its runtime and first-visit autosave. Capture the
  // chronicle only after that legitimate discovery, with the player paused:
  // closing Export must not give the camp time to change the baseline.
  await page.waitForSelector('.rt-field[data-kind="camp"] .rt-scene[data-ready="true"]');
  if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
  await page.waitForFunction(()=>window.__realtime.paused()&&document.querySelector('[data-role="pauseButton"]')?.getAttribute('aria-pressed')==='true');
  await revealControl(page,'[data-cmd="archive-replay"][data-id="ch4-gate"]');
  await page.waitForFunction(()=>{
    const practice=document.querySelector('[data-cmd="archive-replay"][data-id="ch4-gate"]');
    return practice&&!practice.disabled&&[...document.querySelectorAll('.save-status')].every(el=>!/Saving/.test(el.textContent));
  });
  const chronicle=async()=>{await settingsCommand(page,'export');const code=await page.locator('#save-code').inputValue();
    await page.click('#modal [data-cmd="close-modal"] >> nth=0');return codePayload(code);};
  const primary=await chronicle();
  assert.equal(JSON.parse(primary).soldier.flags['visited:8:gate'],true,'The initial camp visit is saved before the Practice baseline');
  assert.equal(await page.evaluate(()=>window.__realtime.paused()),true,'Export preserves the player’s camp pause');
  await (await revealControl(page,'[data-cmd="archive-replay"][data-id="ch4-gate"]')).click();
  await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]');
  assert.match(await text(page,'.archive-banner'),/Chronicle record: \d+ rounds/,'The battle is practised in real time, under the Archive’s banner');
  assert.equal(await page.evaluate(()=>window.__realtime.world()?.encounterId),'ch4-gate');
  await page.locator('#rt-board').focus();
  await expectAnnouncement(page,/Practice is not saved/,()=>page.keyboard.press('F2'));
  assert.equal(await chronicle(),primary,'The export during practice is the chronicle');
  await page.locator('.archive-mutators > summary').click();await page.selectOption('#archive-weather','rain');
  await page.locator('[data-cmd="apply-archive-mutators"]').click();
  await page.waitForFunction(()=>window.__realtime.world()?.weather==='rain',null,{timeout:60000}).catch(()=>assert.fail('The mutators play the battle again in the rain'));
  await page.locator('.archive-banner [data-cmd="exit-archive"]').click();
  await page.waitForSelector('.rt-field[data-kind="camp"]');assert.equal(await chronicle(),primary,'Return to chronicle restores the camp exactly');
  await (await revealControl(page,'[data-cmd="archive-replay"][data-id="ch7-council"]')).click();
  await page.waitForSelector('.rt-field[data-kind="chamber"] .rt-scene[data-ready="true"]');
  assert.match(await text(page,'.archive-banner'),/Chronicle record: \d+ hours/,'The Contest is practised in the chamber');
  assert.equal(await page.locator('#archive-weather').count(),0,'A chamber has no weather to change');
  await page.locator('.archive-banner [data-cmd="exit-archive"]').click();await page.waitForSelector('.rt-field[data-kind="camp"]');
  await page.reload();await page.locator('[data-cmd="continue"]').first().click();await page.waitForSelector('.rt-field[data-kind="camp"]');
  assert.equal(await chronicle(),primary,'A reload continues the chronicle, not practice');
  await page.context().close();
  console.log('ok - practice in real time: a completed battle opens the live field and a Contest the chamber, under the Archive’s banner; the mutators replay it in the rain, F2 saves nothing, and Return to chronicle and a reload keep the chronicle exactly');
}
async function legacyChronicle(){
  const page=await open(),old=Game.decodeSave(battleCampCode('ch5-mine'));delete old.soldier;
  await page.addInitScript(()=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:'2d'}));}catch{}});
  await page.goto(base);await settingsCommand(page,'restore');
  await page.fill('#restore-code',Game.encodeSave(old));await page.click('[data-cmd="import-code"]');await page.click('[data-cmd="confirm-import"]');
  await page.waitForSelector('#modal[open] [data-cmd="adopt-soldier"]',{timeout:30000}).catch(()=>assert.fail('An old chronicle is asked for its soldier'));
  await page.waitForFunction(()=>window.__realtime?.world()?.campId==='ch5-camp',null,{timeout:30000})
    .catch(()=>assert.fail('The legacy camp mounts behind its adoption panel without changing the saved soldier choice'));
  const entry=await page.evaluate(()=>{const hero=window.__realtime.world().actors.find(actor=>actor.id==='hero');return {x:hero.x,z:hero.z};});
  const grant=tpAuditTotal(4,'explorator');assert.match(await text(page,'#modal'),new RegExp(`${grant} training points for the service already done`));
  await page.check('#modal input[name="recruit-path"][value="explorator"]');await (await revealControl(page,'#recruit-cloak')).selectOption('2');await page.click('#modal [data-cmd="adopt-soldier"]');
  await page.waitForFunction(()=>/Explorator/.test(document.querySelector('#modal[open]')?.textContent??''),null,{timeout:30000})
    .catch(()=>assert.fail('The soldier is adopted and shown'));
  assert.ok(Game.soldierCommand(old,{kind:'adopt',path:'explorator',appearance:{cloak:2}}).ok);
  const expectedHero=Game.createCampWorld(old).actors.find(actor=>actor.id==='hero');
  await page.waitForFunction(expected=>{
    const hero=window.__realtime.world().actors.find(actor=>actor.id==='hero');
    return JSON.stringify(hero.attributes)===JSON.stringify(expected.attributes)&&JSON.stringify(hero.kit)===JSON.stringify(expected.kit);
  },{attributes:expectedHero.attributes,kit:expectedHero.kit},{timeout:30000})
    .catch(()=>assert.fail('The mounted camp immediately reflects the adopted Explorator attributes and issued kit'));
  assert.deepEqual(await page.evaluate(()=>{const hero=window.__realtime.world().actors.find(actor=>actor.id==='hero');return {x:hero.x,z:hero.z};}),entry,
    'Adopting training keeps the soldier at the same camp position');
  await page.context().close();
  // A battle begun on the 0.38 board.
  const turns=Game.decodeSave(battleCampCode('ch5-mine'));assert.ok(Game.startEncounter(turns,{}).ok);
  const second=await open();
  await second.addInitScript(()=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:'2d'}));}catch{}});
  await second.goto(base);await settingsCommand(second,'restore');
  await second.fill('#restore-code',Game.encodeSave(turns));await second.click('[data-cmd="import-code"]');await second.click('[data-cmd="confirm-import"]');
  await second.waitForSelector('.legacy-battle [data-cmd="restart-realtime"]',{timeout:60000}).catch(()=>assert.fail('The 0.38 battle offers a real-time restart'));
  await second.click('.legacy-battle [data-cmd="restart-realtime"]');
  await second.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]',{timeout:120000}).catch(()=>assert.fail('The battle restarts in real time'));
  assert.equal(await second.evaluate(()=>window.__realtime.world().encounterId),'ch5-mine');
  await second.context().close();
  console.log('ok - legacy chronicle: a Chapter V camp mounts before adoption, grants Chapters I–IV’s training points and immediately refreshes the chosen training without moving the soldier; a turn-based battle restarts in real time from its checkpoint');
}

let failed=false;
// SMOKE_ONLY=realtimeArena,phoneTouch runs just those scenarios (a development convenience).
const only=process.env.SMOKE_ONLY?.split(',').map(name=>name.trim()).filter(Boolean);
// Check departure races first, before the longer whole-campaign scenarios.
const scenarios=[campStartupDeparture,campSaveDeparture,campRouteChoice,campGateDeparture,campExitDeparture,realtimeSquads,drillDesktop,expandedFieldReadouts,fieldApproach,phoneTouch,performanceCheck,realtimeArena,realtimeCampaign,realtimeFlat,viewSwitch,realtimeDeployment,
  chamberCouncil,chamberViewFallback,chamberContests,chamberHearing,realtimeFinale,settingsAndHelp,realtimePractice,legacyChronicle,fieldAftermath];
// CI's two smoke jobs: group a is the scenarios named here (about half the time in CI), group b every other one,
// so a new scenario always runs in one of them.
const groupA=['campStartupDeparture','campSaveDeparture','campRouteChoice','campGateDeparture','campExitDeparture','realtimeSquads','drillDesktop',
  'expandedFieldReadouts','fieldApproach','phoneTouch','performanceCheck','realtimeArena'];
const unknown=groupA.filter(name=>!scenarios.some(s=>s.name===name));
if(unknown.length){console.error(`not ok - SMOKE_GROUP a names no such scenario: ${unknown.join(', ')}`);await browser.close();server.close();process.exit(2);}
if(group)console.log(`# SMOKE_GROUP ${group}`);
for(const scenario of scenarios.filter(s=>(!group||groupA.includes(s.name)===(group==='a'))&&(!only?.length||only.includes(s.name)))){
  // Each scenario's time is printed, so a slow one shows in CI's log.
  const started=Date.now();
  try{await scenario();}catch(error){failed=true;console.error(`not ok - ${scenario.name}: ${error.message}`);}
  // A failed scenario leaves its pages open: close them, so their scenes stop drawing before the next scenario.
  finally{for(const context of contexts)await context.close().catch(()=>{});contexts.clear();console.log(`# ${scenario.name}: ${Math.round((Date.now()-started)/1000)} s`);}
}
if(problems.length){failed=true;console.error(`not ok - browser errors:\n${problems.map(p=>`  ${p}`).join('\n')}`);}
else console.log('ok - no page or console errors');
await browser.close();server.close();
process.exit(failed?1:0);
