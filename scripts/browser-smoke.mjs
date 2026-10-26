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
// settings and help (pace by difficulty, a remapped key) and a chronicle saved
// before 0.40. It fails on any page or console error. Development and CI only:
// it needs Playwright, which is not a project dependency, and a production build.
//
//   npm run build && npm run smoke
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.js npm run smoke
//   SMOKE_ONLY=chamberCouncil,legacyChronicle npm run smoke   # just those scenarios
import http from 'node:http';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {serveRequest} from './serve.mjs';
import {menuCommand,revealControl,settingsCommand,settingsPage,verifyCampPanelTransitions} from './ui-smoke-navigation.mjs';
import * as Game from '../src/core/game.js';
import {runProgressionCampaign} from './progression-autoplay.mjs';
import {runCommandCampaign,protectCoalition} from './command-autoplay.mjs';
import {playEncounter,command} from './autoplay.mjs';
import {tpAuditTotal} from '../src/core/tp-audit.js';
import {sceneryPlacements} from '../src/showcase/scenery-models.js';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
if(!await access(`${root}index.html`).then(()=>true,()=>false)){console.error('No production build in dist/. Run npm run build first.');process.exit(2);}
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
  await page.goto(base);await page.click('[data-cmd="new"]');await page.click('[data-cmd="begin"]');await page.waitForSelector('.camp-page');
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
  const page=await open({acceptDownloads:true});await newGameDrill(page);await view(page,'3d');
  const hint=await text(page,'#command-hint'),quality=await page.evaluate(()=>document.documentElement.dataset.quality??'');
  await settingsCommand(page,'performance-check');await page.waitForSelector('.performance-check');
  await page.keyboard.press('e');await page.keyboard.press('Enter');
  await page.waitForSelector('#modal[open][data-panel="performance-check"]',{timeout:900000});
  assert.equal(await page.locator('.performance-check').count(),0,'The status band is gone');
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('[data-cmd="performance-check-save"]')]);
  const report=JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(),'utf8'));
  assert.equal(report.tool,'imperium-performance-check');assert.equal(report.complete,true);
  assert.deepEqual(report.tiers.map(t=>t.tier).sort(),['balanced','high','performance']);
  for(const tier of report.tiers){assert.ok(tier.rebuilt&&tier.tour.frames>0,`${tier.tier} was built and measured`);assert.equal(tier.firstFramePrograms,0,`${tier.tier}: nothing compiled by the first frame`);}
  assert.ok(['performance','balanced','high'].includes(report.recommendation));
  await page.click('#modal [data-cmd="close-modal"] >> nth=0');
  assert.equal(await text(page,'#command-hint'),hint,'No command reached the board during the check');
  if(quality)assert.equal(await page.evaluate(()=>document.documentElement.dataset.quality??''),quality,'The player\'s quality is back');
  await page.context().close();console.log(`ok - performance check: three qualities rebuilt and measured with no first-frame compiles, the board untouched, results saved (recommends ${report.recommendation})`);
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
  await page.click('[data-cmd="conversation"][data-id="table"]');await page.waitForSelector('#modal[open] [data-cmd="reply"]');await page.keyboard.press('1');
  await page.waitForFunction(()=>!document.querySelector('#modal')?.open,null,{timeout:30000});
  await page.click('[data-cmd="start"]');await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]');
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

// Phase 2 in the page: a restored camp's battle in real time (the development setting), from Chapter IV with squads.
async function restoreRealtime(page,code,{view='3d',beforeStart=null}={}){
  await page.addInitScript(v=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',quality:'performance',battleView:v}));}catch{}},view);
  await page.goto(base);await settingsCommand(page,'restore');
  await restoreCamp(page,code);
  if(beforeStart)await beforeStart();
  await page.click('[data-cmd="start"]:visible');
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
  await page.click('[data-cmd="start"]:visible');
  await page.waitForSelector('.rt-field[data-kind="chamber"] .rt-scene[data-ready="true"]');
}
async function restoreCamp(page,code){
  await page.fill('#restore-code',code);await page.click('[data-cmd="import-code"]');
  const closed=page.locator('#modal').evaluate(modal=>new Promise(resolve=>modal.addEventListener('close',()=>resolve(),{once:true})));
  await page.click('[data-cmd="confirm-import"]');await closed;
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
      assert.equal(await page.locator('[data-cmd="start"]:visible').isDisabled(),true,`${id}: departure waits for the camp autosave`);
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
      assert.equal(await page.locator('[data-cmd="start"]:visible').isDisabled(),true,`${id}: departure waits for initial camp setup`);
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
    const closed=page.locator('#modal').evaluate(modal=>new Promise(resolve=>modal.addEventListener('close',()=>resolve(),{once:true})));
    await page.click('#modal [data-cmd="close-modal"] >> nth=0');await closed;
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
// Every chamber command is recorded through the page's save transaction: wait for it before the next.
const chamberIdle=page=>page.waitForFunction(()=>window.__chamber.pending()===0,null,{timeout:60000});
const chamberHour=page=>page.evaluate(()=>window.__chamber.hour());
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
  await page.keyboard.press('KeyY');await page.waitForSelector('[data-role="rivalsBand"]:not([hidden])',{timeout:30000}).catch(()=>assert.fail('Y yields and the rivals take their hour'));
  await page.keyboard.press('Space');await page.waitForSelector('[data-role="rivalsBand"]',{state:'hidden',timeout:30000}).catch(()=>assert.fail('Space skips the rivals’ hour'));
  // The HUD redraws on the next frame.
  assert.equal((await chamberHour(page)).hour,2);await page.waitForFunction(()=>/^Hour 2 of/.test(document.querySelector('[data-role="roundLabel"]')?.textContent??''),null,{timeout:30000})
    .catch(async()=>assert.fail(`The hour reads ${await text(page,'[data-role="roundLabel"]')}`));
  await page.keyboard.down('KeyU');await page.waitForFunction(()=>/challenges|attacks|no plan/.test(document.querySelector('[data-role="messageLine"]').textContent),null,{timeout:10000})
    .catch(()=>assert.fail('U names where each rival means to walk next'));await page.keyboard.up('KeyU');
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
  await page.click('[data-cmd="start"]:visible');
  await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]').catch(()=>assert.fail('The finale’s field is ready'));
  const rally=page.locator('[data-role="abilityBar"] [data-ability="rally"]');
  assert.equal(await rally.isVisible(),true,'Rally is visible without opening More actions');
  assert.match(await rally.getAttribute('title'),/Win allegiance.*morale/,'Rally explains its effect on rival formations');
  await page.waitForSelector('[data-role="advanceButton"]:not([hidden])',{timeout:30000}).catch(()=>assert.fail('Chapter XII opens in deployment'));
  await page.click('[data-role="advanceButton"]');
  await page.waitForSelector('[data-role="advanceButton"][data-confirm="true"]',{timeout:60000}).catch(async()=>{
    await page.screenshot({path:'/tmp/claude-0/-home-user-Imperium/e09ac0a8-2386-5e16-9f83-c9d748d8d29c/scratchpad/finale/advance-fail.png'}).catch(()=>{});
    assert.fail(`One press asks to confirm the advance: ${await page.evaluate(()=>{const b=document.querySelector('[data-role="advanceButton"]');
      return JSON.stringify({hidden:b?.closest('[hidden]')?.dataset.role??null,text:b?.textContent,confirm:b?.dataset.confirm??null,tick:window.__realtime.world()?.tick,modal:document.querySelector('#modal')?.open,
        line:document.querySelector('[data-role="eventLine"]')?.textContent});})}`);});
  // The confirmation within its five seconds: the button's own click, without Playwright's waits for a steady frame.
  await page.evaluate(()=>document.querySelector('[data-role="advanceButton"]').click());
  await page.waitForFunction(()=>window.__realtime.world().tick>5,null,{timeout:60000}).catch(()=>assert.fail('The advance is sounded'));
  assert.match(await text(page,'[data-role="progress"]'),/Pledges 0 of 3/,'The progress line counts pledges');
  assert.deepEqual(await page.evaluate(()=>window.__realtime.world().squads.filter(q=>q.side==='enemy').map(q=>q.name).slice(0,2)),['Rival claimant','Civil-war cohort 2'],'The bands keep their names');
  // Walk to the nearest rival band, then swear the oath once it is within three places (23 m).
  const heard=await page.evaluate(async()=>{
    const w=()=>window.__realtime.world(),hero=()=>w().actors.find(a=>a.id==='hero'),wait=ms=>new Promise(r=>setTimeout(r,ms));
    const near=()=>{const h=hero();return w().actors.filter(a=>a.side==='enemy'&&a.alive).map(a=>({a,d:Math.hypot(a.x-h.x,a.z-h.z)})).sort((x,y)=>x.d-y.d)[0];};
    for(let i=0;i<600;i++){
      if(window.__realtime.paused())document.querySelector('[data-role="pauseButton"]')?.click();
      const n=near();if(!n)return 'no rival';
      if(n.d<=20){const r=window.__realtime.issue({actorId:'hero',kind:'ability',payload:{abilityId:'rally'}});if(r.ok)break;}
      else if(!hero().goal||Math.hypot(hero().goal.x-n.a.x,hero().goal.z-n.a.z)>4)window.__realtime.issue({actorId:'hero',kind:'move',payload:{x:n.a.x,z:n.a.z}});
      await wait(100);
    }
    for(let i=0;i<300;i++){if(w().log.some(l=>/hears the soldier’s oath/.test(l.text)))return 'heard';await wait(100);}
    return 'not heard';
  });
  assert.equal(heard,'heard','A rival band hears the oath');
  await page.waitForFunction(()=>/Pledges \d of 3/.test(document.querySelector('[data-role="progress"]')?.textContent??''));
  await page.context().close();
  console.log('ok - finale: Chapter XII’s defection route opens in real time from its camp, deploys and advances; the rival bands keep their names, and the soldier’s oath (Rally within 23 m) is heard');
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
for(const scenario of [campStartupDeparture,campSaveDeparture,campRouteChoice,campGateDeparture,realtimeSquads,drillDesktop,expandedFieldReadouts,fieldApproach,phoneTouch,performanceCheck,realtimeArena,realtimeCampaign,realtimeFlat,realtimeDeployment,
  chamberCouncil,chamberContests,chamberHearing,realtimeFinale,settingsAndHelp,legacyChronicle].filter(s=>!only?.length||only.includes(s.name))){
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
