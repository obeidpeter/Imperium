// Automated Chromium coverage of the command card's actual keyboard route.
// Earn a new-mission Chapter IX start through public campaign commands, import
// it through the visible UI, and only read browser state for assertions.
// Build first; PLAYWRIGHT_MODULE can name an external Playwright installation.
// --url http://127.0.0.1:PORT/ diagnoses an existing source/preview server.
import assert from 'node:assert/strict';
import http from 'node:http';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveRequest} from './serve.mjs';
import {closePanel,menuCommand,revealControl} from './ui-smoke-navigation.mjs';
import {playRealtime,runRealtimeCampaign} from './realtime-autoplay.mjs';
import * as Game from '../src/core/game.js';

const started=Date.now(),output=fileURLToPath(new URL('../tests/visual-results/cavalry-controls/',import.meta.url));
const urlAt=process.argv.indexOf('--url'),external=urlAt<0?null:process.argv[urlAt+1];
assert.ok(urlAt<0||/^http:\/\/127\.0\.0\.1:\d+\/$/.test(external??''),'--url must name a local server, including its trailing slash.');
let playwright;
for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){
  try{const module=await import(isAbsolute(specifier)?pathToFileURL(specifier).href:specifier);playwright=module.chromium?module:module.default;break;}catch{}
}
assert.ok(playwright?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright module.');
const root=fileURLToPath(new URL('../dist/',import.meta.url));
if(!external)await access(`${root}index.html`).catch(()=>{throw new Error('Build the production site first: node scripts/build.mjs');});
const build=external?null:JSON.parse(await readFile(`${root}build-report.json`,'utf8')).revision;
let code;const encounters=[],stop=new Error('cavalry checkpoint earned');
try{runRealtimeCampaign({throughChapter:9,ready:Array.from({length:12},(_,i)=>i+1),retries:2,
  play(state,options){
    if(state.encounter.id==='ch9-wing'){
      assert.equal(Game.realtimeWorld(state).tick,0);code=Game.encodeSave(state);throw stop;
    }
    return playRealtime(state,options);
  },onEncounter(state,summary){encounters.push({id:state.encounter.id,status:summary.status,tries:summary.tries});}
});}catch(error){if(error!==stop)throw error;}
assert.ok(code,'The legal campaign reaches the Chapter IX cavalry mission.');
console.log(`ready - cavalry checkpoint earned through ${encounters.length} encounters in ${((Date.now()-started)/1000).toFixed(1)}s`);
await mkdir(output,{recursive:true});
const report={kind:'automated Chromium; legal new-mission checkpoint; no world injection',build,source:external??'production build',
  checkpoint:{id:'ch9-wing',seed:275,method:'New Game and public commands; actual retries; stop before the earned encounter is played',encounters},checks:[]};
const server=external?null:http.createServer((req,res)=>serveRequest(req,res,root));
if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=external??`http://127.0.0.1:${server.address().port}/`,problems=[];
let browser,page;
const record=name=>{report.checks.push({name,pass:true});console.log(`ok - ${name}`);};
try{
  browser=await playwright.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const context=await browser.newContext({viewport:{width:1280,height:900},...(external?{serviceWorkers:'block'}:{})});page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',error=>problems.push(error.message));page.on('console',message=>{if(message.type()==='error')problems.push(message.text());});
  await page.goto(`${base}?dev`);await menuCommand(page,'settings');
  await (await revealControl(page,'#controls-model')).selectOption('realtime');await closePanel(page);
  await menuCommand(page,'settings');await (await revealControl(page,'#battle-view')).selectOption('2d');
  await (await revealControl(page,'#graphics-quality')).selectOption('performance');
  for(const id of ['pause-sighted','pause-hurt','pause-squad','pause-objective','pause-order'])await (await revealControl(page,`#${id}`)).uncheck();
  await (await revealControl(page,'#modal [data-cmd="restore"]')).click();await page.fill('#restore-code',code);
  await page.click('[data-cmd="import-code"]');await page.click('[data-cmd="confirm-import"]');
  await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]');
  assert.equal(await page.evaluate(()=>window.__realtime.world().map.id),'ch9-wing');
  await page.locator('[data-role="advanceButton"]').click();await page.locator('[data-role="advanceButton"]').click();
  await page.waitForFunction(()=>window.__realtime.world().deployment?.done===true);
  if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
  await page.waitForFunction(()=>window.__realtime.paused());
  const squads=await page.evaluate(()=>window.__realtime.world().squads.filter(s=>s.side!=='enemy').map(s=>({id:s.id,role:s.role,name:s.name})));
  const horse=squads.find(s=>['cavalry','heavy'].includes(s.role)),foot=squads.find(s=>!['cavalry','heavy'].includes(s.role));
  assert.ok(horse&&foot,'The earned battlefield has both mounted and foot squads.');
  const card=page.locator('[data-role="commandCard"]'),button=kind=>card.locator(`[data-order="${kind}"]`);
  const state=()=>page.evaluate(()=>JSON.stringify(window.__realtime.world()));
  const select=async squad=>{await page.locator(`.rt-standard[data-squad="${squad.id}"]`).click();await card.waitFor({state:'visible'});};
  const feedback=()=>page.locator('[data-role="eventLine"]').textContent();
  async function unchanged(keys,label){
    const before=await state();await page.locator('#rt-board').focus();
    for(const key of keys)await page.keyboard.press(key);
    assert.equal(await state(),before,`${label}: the whole world, queue and random streams stay unchanged`);
    assert.equal(await page.evaluate(()=>window.__realtime.paused()),true,`${label}: remains paused`);
  }
  async function order(key,kind,words){
    await page.locator('#rt-board').focus();await page.keyboard.press(key);
    await page.waitForFunction(({id,kind})=>window.__realtime.world().queue.some(c=>c.kind==='order'&&c.payload.squads.includes(id)&&c.payload.order.kind===kind),{id:horse.id,kind});
    assert.match(await feedback(),words,`${key} gives visible command feedback`);
    assert.equal(await page.evaluate(()=>window.__realtime.paused()),true,'Ordering while paused does not resume play');
  }
  await select(foot);assert.equal(await card.getAttribute('aria-label'),'Orders for the selected squads (keys: 1 to 7)');
  assert.equal(await card.locator('button').count(),7);assert.equal(await button('charge').count(),0);assert.equal(await button('feigned_retreat').count(),0);
  await unchanged(['Digit8','Digit9'],'Mounted orders with infantry selected');
  assert.match(await feedback(),/horse|cavalry/i);
  record('Infantry names keys 1–7; unavailable mounted orders preserve the paused world');
  await select(horse);assert.equal(await card.getAttribute('aria-label'),'Orders for the selected squads (keys: 1 to 9)');
  assert.equal(await card.locator('button').count(),9);
  for(const [kind,key]of [['charge','8'],['feigned_retreat','9']]){
    assert.equal(await button(kind).locator('kbd').textContent(),key);assert.equal(await button(kind).getAttribute('aria-keyshortcuts'),key);
  }
  assert.match(await page.locator('[data-role="announcer"]').textContent(),/card keys: 1 to 9/);
  await order('Digit8','charge',/charge/i);await order('Digit9','feigned_retreat',/feigned retreat/i);
  record('Selecting the horse reveals Charge 8 and Feigned retreat 9; both keys queue the correct order and feedback');
  await menuCommand(page,'settings');
  for(const [slot,key,label]of [[8,'KeyK','K'],[9,'KeyD','D']]){
    await (await revealControl(page,`.key-row[data-action="ability_${slot}"] [data-cmd="rebind"]`)).click();await page.keyboard.press(key);
    await page.waitForFunction(({slot,label})=>document.querySelector(`.key-row[data-action="ability_${slot}"] kbd`)?.textContent===label,{slot,label});
  }
  await closePanel(page);if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
  await select(horse);
  assert.equal(await card.getAttribute('aria-label'),'Orders for the selected squads (keys: 1, 2, 3, 4, 5, 6, 7, K, D)');
  for(const [kind,key]of [['charge','K'],['feigned_retreat','D']]){
    assert.equal(await button(kind).locator('kbd').textContent(),key);assert.equal(await button(kind).getAttribute('aria-keyshortcuts'),key);
  }
  assert.match(await page.locator('[data-role="announcer"]').textContent(),/card keys: 1, 2, 3, 4, 5, 6, 7, K, D/);
  await unchanged(['Digit8','Digit9'],'Former mounted-order keys after remapping');
  // Let each remapped order reach the squad through the normal clock, then
  // pause again. A correct queued command alone does not prove it was applied.
  for(const [key,kind,words,entry]of [['KeyK','charge',/charge/i,'charge'],['KeyD','feigned_retreat',/feigned retreat/i,'ride away as if routed']]){
    await order(key,kind,words);await page.locator('[data-role="pauseButton"]').click();
    await page.waitForFunction(({id,kind})=>window.__realtime.world().squads.find(s=>s.id===id)?.order?.kind===kind,{id:horse.id,kind});
    await page.locator('[data-role="pauseButton"]').click();
    assert.ok(await page.evaluate(({name,entry})=>window.__realtime.world().log.some(line=>line.kind==='order'&&line.text===`${name}: ${entry}.`),{name:horse.name,entry}),'The applied order appears in the field record');
  }
  record('Settings remaps update the card and announcement; K/D issue the orders while old 8/9 have no effect');
  record('Both remapped orders reach the cavalry through real simulation ticks and appear in the field record');
  await page.locator('.rt-field').screenshot({path:`${output}remapped-cavalry.png`});
  assert.deepEqual(problems,[],'No browser errors');report.pass=true;
}catch(error){report.pass=false;report.error=error.stack;throw error;}
finally{
  report.browserErrors=problems;report.durationSeconds=Number(((Date.now()-started)/1000).toFixed(2));
  await writeFile(`${output}report.json`,JSON.stringify(report,null,2)+'\n');
  await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));
}
