// Focused production UI regression. Earn Chapter VIII from New Game with the
// public campaign API, then use visible UI controls to accept, track, collect,
// reload and return Aelia's jar. No browser state/position/quest injection.
// Uses 2D to isolate controls and layout; this is not a 3D performance test.
import assert from 'node:assert/strict';
import http from 'node:http';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveRequest} from './serve.mjs';
import {closePanel,menuCommand,revealControl} from './ui-smoke-navigation.mjs';
import {runRealtimeCampaign} from './realtime-autoplay.mjs';
import * as Game from '../src/core/game.js';

const root=fileURLToPath(new URL('../dist/',import.meta.url)),output=fileURLToPath(new URL('../tests/visual-results/errand-guidance/',import.meta.url));
await access(`${root}index.html`);const build=JSON.parse(await readFile(`${root}build-report.json`,'utf8')).revision;
let playwright;for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){
  try{const m=await import(isAbsolute(specifier)?pathToFileURL(specifier).href:specifier);playwright=m.chromium?m:m.default;break;}catch{}
}
assert.ok(playwright?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright module.');
const earned=runRealtimeCampaign({throughChapter:7,ready:[1,2,3,4,5,6,7],retries:2});
assert.equal(earned.state.chapter,8);assert.equal(earned.state.phase,'camp');
const code=Game.encodeSave(earned.state);await mkdir(output,{recursive:true});
const server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`,errors=[],report={build,method:'Automated Chromium; earned Chapter VIII, visible controls, read-only world diagnostics; 2D functional/layout check',checks:[],priorEncounters:earned.encounters.map(e=>({id:e.id,status:e.status}))};
let browser;
async function waitForSave(page){await page.waitForFunction(()=>!document.querySelector('.save-status')?.textContent.includes('Saving'));}
async function reply(page,pattern){await page.locator('#modal .dialogue-option').filter({hasText:pattern}).click();await waitForSave(page);}
async function mission(page){await page.locator('.topnav [data-cmd="soldier-panel"][data-id="mission"]').click();await page.locator('#modal .mission-orders').waitFor();}
try{
  browser=await playwright.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});report.browser=browser.version();
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(45000);
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`${base}?dev`);await menuCommand(page,'settings');
    await (await revealControl(page,'#controls-model')).selectOption('realtime');await closePanel(page);await menuCommand(page,'settings');
    await (await revealControl(page,'#battle-view')).selectOption('2d');await (await revealControl(page,'#guide-setting')).uncheck();
    if(width===390)await (await revealControl(page,'#text-size')).selectOption('2');
    await (await revealControl(page,'#modal [data-cmd="restore"]')).click();await page.fill('#restore-code',code);await page.click('[data-cmd="import-code"]');await page.click('[data-cmd="confirm-import"]');
    await page.waitForSelector('.rt-scene[data-ready="true"]');assert.equal(await page.locator('#tracked-errand').count(),0,'No default tracker or permanent clutter');
    await (await revealControl(page,'[data-cmd="conversation"][data-id="ch8:aelia"]')).click();
    await reply(page,/households need/);await reply(page,/find it/);await closePanel(page);
    await mission(page);assert.match(await page.locator('[data-errand="seed_jar"] [data-errand-step]').textContent(),/Collect the seed jar/);
    await page.locator('[data-cmd="track-errand"][data-id="seed_jar"]').click();
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.cmd),'untrack-errand','Focus follows the tracking toggle');await closePanel(page);
    await page.locator('#tracked-errand').waitFor({state:'visible'});
    // A player pause must remain a pause when the destination is queued.
    if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
    const before=await page.evaluate(()=>{const w=window.__realtime.world(),h=w.actors.find(a=>a.id===w.heroId);return {x:h.x,z:h.z,tick:w.tick};});
    await page.locator('#tracked-errand-go').click();
    const queued=await page.evaluate(()=>{const w=window.__realtime.world(),h=w.actors.find(a=>a.id===w.heroId);return {x:h.x,z:h.z,tick:w.tick,queue:w.queue,paused:window.__realtime.paused()};});
    assert.equal(queued.paused,true);assert.deepEqual({x:queued.x,z:queued.z,tick:queued.tick},before,'Destination does not teleport or release the player pause');
    assert.ok(queued.queue.some(c=>c.kind==='interact'&&c.payload.objectId==='seed-jar'));assert.ok(queued.queue.every(c=>c.kind!=='travel'));
    await page.locator('[data-role="pauseButton"]').click();await page.locator('#modal[data-conversation="ch8:seed-jar"]').waitFor({state:'visible'});
    await reply(page,/Take the jar/);assert.match(await page.locator('#tracked-errand [data-tracked-step]').textContent(),/Return to Aelia/);await closePanel(page);
    await waitForSave(page);await page.reload();await page.locator('[data-cmd="continue"]').first().click();await page.waitForSelector('.rt-scene[data-ready="true"]');
    assert.match(await page.locator('#tracked-errand [data-tracked-step]').textContent(),/Return to Aelia/,'Reload preserves the chosen task and derives its latest step');
    await page.locator('#tracked-errand').scrollIntoViewIfNeeded();
    const geometry=await page.locator('#tracked-errand').evaluate(el=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,buttons:[...el.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})}));
    assert.ok(geometry.documentWidth<=width+1,'Tracker fits at phone width and 200% text');assert.ok(geometry.buttons.every(b=>b.left>=0&&b.right<=width&&b.height>=44));
    await page.locator('#tracked-errand').screenshot({path:`${output}return-to-aelia-${width}.png`});
    await page.locator('#tracked-errand-go').click();if(await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
    await page.locator('#modal[data-conversation="ch8:aelia"]').waitFor({state:'visible'});await reply(page,/Ulpii’s jar/);assert.equal(await page.locator('#tracked-errand').count(),0,'Completion automatically clears the tracker');await closePanel(page);
    await mission(page);assert.equal(await page.locator('[data-errand="seed_jar"]').count(),0,'Completed errands leave the active list');await closePanel(page);
    // A second optional task proves stopping the tracker has a useful focus destination.
    await (await revealControl(page,'[data-cmd="conversation"][data-id="ch8:felix"]')).click();await reply(page,/sound the landing/);await reply(page,/I will\./);await closePanel(page);
    await mission(page);await page.locator('[data-cmd="track-errand"][data-id="ford_soundings"]').click();await closePanel(page);
    await page.locator('#tracked-errand-stop').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#tracked-errand').count(),0);assert.equal(await page.evaluate(()=>document.activeElement?.id),'rt-board');
    report.checks.push({width,textScale:width===390?2:1,passed:true,geometry});console.log(`ok - ${width}px: legal jar journey, normal walking, paused queue, reload, completion and optional tracking focus`);
    await context.close();
  }
  assert.deepEqual(errors,[]);assert.equal(JSON.parse(await readFile(`${root}build-report.json`,'utf8')).revision,build);report.passed=true;
}catch(error){report.passed=false;report.error=error.stack;throw error;}
finally{report.errors=errors;await writeFile(`${output}report.json`,JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(resolve=>server.close(resolve));}
