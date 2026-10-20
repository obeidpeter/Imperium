// Browser smoke test of the production build through the real interface: New
// Game and the Chapter I drill in 2D (walk by keyboard and pointer, Undo,
// Confirm moves, an opponent's preview, Help), a keyboard walk in the 3D view,
// a legal Chapter V expanded checkpoint restored through the Restore dialog
// (field-object readouts), and touch at phone width (hold to preview, tap to
// walk). It fails on any page or console error. Development and CI only: it
// needs Playwright, which is not a project dependency, and a production build.
//
//   npm run build && npm run smoke
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.js npm run smoke
import http from 'node:http';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {serveRequest} from './serve.mjs';
import * as Game from '../src/core/game.js';
import {runProgressionCampaign} from './progression-autoplay.mjs';

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

const server=http.createServer((req,res)=>serveRequest(req,res,root));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const {chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const problems=[];
async function open(options={}){
  const context=await browser.newContext({viewport:{width:1280,height:900},...options}),page=await context.newPage();
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
async function menuButton(page,cmd){if(!await page.locator(`[data-cmd="${cmd}"]:visible`).count())await page.click('[data-cmd="menu"]:visible >> nth=0');await page.click(`[data-cmd="${cmd}"]:visible >> nth=0`);}
async function settings(page,fn){await menuButton(page,'settings');await page.waitForSelector('#confirm-moves');await fn();await page.click('#modal [data-cmd="close-modal"] >> nth=0');}
async function view(page,mode){
  await settings(page,()=>page.selectOption('#battle-view',mode));
  if(mode==='3d')await page.waitForFunction(()=>document.querySelector('#battle-board')?.parentElement?.dataset.ready==='true',null,{timeout:300000,polling:500});
  await page.locator('#battle-board').scrollIntoViewIfNeeded();
}
async function newGameDrill(page){
  await page.goto(base);await page.click('[data-cmd="new"]');await page.click('[data-cmd="begin"]');await page.waitForSelector('.camp-page');
  const choose=page.locator('[data-cmd="choose"]');if(await choose.count())await choose.first().click();
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
  await page.focus('#battle-board');
  await expectAnnouncement(page,/^Grid 1A\. Open ground\. Beyond reach · stops at 1B this turn$/,()=>keys(page,['ArrowUp','ArrowUp','ArrowUp']));
  await expectAnnouncement(page,/^Walked to 1B \(2 movement\)\. 1A is beyond this turn’s reach\. Undo Move \(U\) takes it back until you act\.$/,()=>page.keyboard.press('Enter'));
  await expectAnnouncement(page,/returned to 1D; movement restored/,()=>page.keyboard.press('u'));
  const near=await findTile(page,label=>label.includes('Walk here'));
  await expectAnnouncement(page,/^Walked to \d+[A-H] \(\d movement\)\. Undo Move/,()=>page.mouse.click(near.x,near.y));
  await expectAnnouncement(page,/movement restored/,()=>page.keyboard.press('u'));
  await settings(page,()=>page.check('#confirm-moves'));
  assert.match(await text(page,'#command-hint'),/Select open ground to preview a walk there, then select it again to go\./);
  const again=await findTile(page,label=>label.includes('Walk here'));
  await expectAnnouncement(page,/^Move to \d+[A-H]\. .*Activate the target again, or use Confirm\.$/,()=>page.mouse.click(again.x,again.y));
  await expectAnnouncement(page,/^Move to \d+[A-H]\. Costs this unit’s movement\.(?!.*Activate)/,()=>page.mouse.click(again.x,again.y));
  await expectAnnouncement(page,/movement restored/,()=>page.keyboard.press('u'));
  await settings(page,()=>page.uncheck('#confirm-moves'));
  const partner=await findTile(page,label=>label.startsWith('Training partner'));
  await expectAnnouncement(page,/^Throw at Training partner.*Activate the target again, or use Confirm\.$/,()=>page.mouse.click(partner.x,partner.y));
  await expectAnnouncement(page,/^Command cancelled\. No action was spent\.$/,()=>page.keyboard.press('Escape'));
  await menuButton(page,'help');await page.waitForSelector('#modal[open]');
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
  await menuButton(page,'settings');await page.click('#modal [data-cmd="restore"]');
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

let failed=false;
for(const scenario of [drillDesktop,expandedFieldReadouts,phoneTouch]){
  try{await scenario();}catch(error){failed=true;console.error(`not ok - ${scenario.name}: ${error.message}`);}
}
if(problems.length){failed=true;console.error(`not ok - browser errors:\n${problems.map(p=>`  ${p}`).join('\n')}`);}
else console.log('ok - no page or console errors');
await browser.close();server.close();
process.exit(failed?1:0);
