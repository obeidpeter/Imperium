// Regression checks for the Windows real-time playtest findings. Uses a built
// production site, fresh browser contexts, visible settings/import/start controls
// and ordinary keyboard/button actions. Checkpoints are earned by the legal
// campaign harness; browser evaluation only reads state/DOM for assertions.
// This is automated Chromium evidence, not a human or physical-device playtest.
// Run: node scripts/build.mjs && node scripts/realtime-polish-smoke.mjs
// Set PLAYWRIGHT_MODULE if Playwright is installed outside this repository.
import assert from 'node:assert/strict';
import http from 'node:http';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {serveRequest} from './serve.mjs';
import {menuCommand,revealControl} from './ui-smoke-navigation.mjs';
import * as Game from '../src/core/game.js';
import {runCommandCampaign} from './command-autoplay.mjs';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
await access(`${root}index.html`).catch(()=>{throw new Error('Build the production site first: node scripts/build.mjs');});
const build=JSON.parse(await readFile(`${root}build-report.json`,'utf8'));
let playwright;
for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){
  try{const module=await import(specifier);playwright=module.chromium?module:module.default;break;}catch{}
}
assert.ok(playwright?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright module.');
const wanted=new Set(['ch1-road','ch2-marsh','ch5-mine','ch7-council']),codes=new Map(),stop=new Error('checkpoints earned');
try{runCommandCampaign({featureEdition:35,onCheckpoint:s=>{
  const id=Game.getChapter(s).encounters[s.encounterIndex]?.id;
  if(wanted.has(id)&&!codes.has(id))codes.set(id,Game.encodeSave(s));
  if(codes.size===wanted.size)throw stop;
}});}catch(error){if(error!==stop)throw error;}
assert.equal(codes.size,wanted.size,'Every checkpoint is reached through the legal campaign.');
const output=fileURLToPath(new URL('../tests/visual-results/realtime-polish/',import.meta.url));await mkdir(output,{recursive:true});
const server=http.createServer((req,res)=>serveRequest(req,res,root));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await playwright.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const problems=[],evidence={kind:'automated Chromium; legal checkpoints; no simulation injection',build:build.revision,
  view:'2D battlefields; WebGL equipped-kit preview',checks:[],
  limitations:['Kit rotation is exercised through visible controls and stable geometry. Rendered rotation needs manual Windows verification: Chromium headless-shell capture stalls after a WebGL turn.']};
const text=(page,selector)=>page.locator(selector).textContent();
const paused=page=>page.evaluate(()=>window.__realtime.paused());
const tick=page=>page.evaluate(()=>window.__realtime.world().tick);
async function pause(page,value=true){if(await paused(page)!==value)await page.click('[data-role="pauseButton"]');await page.waitForFunction(v=>window.__realtime.paused()===v,value);}
async function restore(viewport,id){
  const context=await browser.newContext({viewport}),page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>problems.push(e.message));page.on('console',m=>{if(m.type()==='error')problems.push(m.text());});
  await page.goto(`${base}?dev`);
  await menuCommand(page,'settings');
  await (await revealControl(page,'#controls-model')).selectOption('realtime');
  await page.locator('#modal [data-cmd="close-modal"]').first().click();
  await menuCommand(page,'settings');
  await revealControl(page,'#pause-sighted');
  await (await revealControl(page,'#battle-view')).selectOption('2d');
  await (await revealControl(page,'#graphics-quality')).selectOption('performance');
  for(const id of ['pause-sighted','pause-hurt','pause-squad','pause-objective','pause-order'])await (await revealControl(page,`#${id}`)).uncheck();
  await (await revealControl(page,'#modal [data-cmd="restore"]')).click();
  await page.fill('#restore-code',codes.get(id));await page.click('[data-cmd="import-code"]');await page.click('[data-cmd="confirm-import"]');
  await page.waitForSelector('.camp-page');await page.locator('[data-cmd="start"]:visible').first().click();
  await page.waitForSelector(`.rt-field[data-kind="${id==='ch7-council'?'chamber':'field'}"] .rt-scene[data-ready="true"]`);
  if(id==='ch2-marsh'){
    assert.equal(await paused(page),true,'The first rescue opens paused for a safe look at the casualty, threat and marker');
    assert.equal(await tick(page),0,'Planning the first rescue spends no simulation time');
    evidence.checks.push({name:'First rescue opens paused before its first simulation tick',pass:true});
  }
  await pause(page);console.log(`ready - ${id} at ${viewport.width} × ${viewport.height}`);return page;
}
async function layout(page,label){
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.rt-veil')).opacity)===0);
  // Geometric checks use document coordinates: scrolling must not turn an
  // overlapping overlay into a false pass. No screenshot-dependent thresholds.
  const result=await page.evaluate(()=>{
    const board=document.querySelector('#rt-board'),r=board.getBoundingClientRect();
    const rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};};
    const visible=el=>!el.hidden&&getComputedStyle(el).display!=='none'&&el.getClientRects().length;
    const panels=[...document.querySelectorAll('.rt-top,.rt-hud,.rt-lesson,.rt-talk,.rt-deploy,.rt-rivals,.rt-status-strip,.rt-coalition')].filter(visible);
    const overlap=panels.filter(el=>{const b=el.getBoundingClientRect();return Math.min(b.right,r.right)-Math.max(b.left,r.left)>1&&Math.min(b.bottom,r.bottom)-Math.max(b.top,r.top)>1;}).map(el=>el.className);
    return {viewport:{w:innerWidth,h:innerHeight},canvas:rect(board),overlap,documentWidth:document.documentElement.scrollWidth,
      feedback:rect(document.querySelector('.rt-message-area')),units:rect(document.querySelector('.rt-unit-dock')),actions:rect(document.querySelector('.rt-ability-area')),
      panels:panels.map(el=>({name:el.className,...rect(el)})),targetLive:document.querySelector('[data-role="targetLine"]')?.getAttribute('aria-live')};
  });
  assert.deepEqual(result.overlap,[],`${label}: controls, lessons and conversations never cover the action region`);
  assert.ok(result.canvas.h>=318&&result.canvas.w>=300,`${label}: usable canvas dimensions ${JSON.stringify(result.canvas)}`);
  assert.ok(result.documentWidth<=result.viewport.w+1,`${label}: no document-wide horizontal overflow`);
  assert.ok(result.feedback.y+result.feedback.h<=Math.min(result.units.y,result.actions.y)+1,`${label}: live target/feedback is above the unit and ability rows`);
  assert.notEqual(result.targetLive,'assertive','Continuous target updates must not repeatedly interrupt speech');
  evidence.checks.push({name:label,...result});
  await page.locator('.rt-field').screenshot({path:`${output}${label}.png`});
}
try{
  const road=await restore({width:580,height:700},'ch1-road');
  await layout(road,'road-narrow');
  await road.locator('#rt-board').focus();await road.keyboard.press('KeyT');
  await road.waitForFunction(()=>/\d+ metres.*Health/.test(document.querySelector('[data-role="targetLine"]')?.textContent??''));
  const before=await text(road,'[data-role="targetLine"]'),initial=Number(before.match(/(\d+) metres/)?.[1]);
  assert.ok(initial>5,`The selected enemy starts at a measurable distance: ${before}`);
  await road.keyboard.press('Enter');await pause(road,false);
  await road.waitForFunction(start=>{
    const s=document.querySelector('[data-role="targetLine"]')?.textContent??'',distance=Number(s.match(/(\d+) metres/)?.[1]);
    return Number.isFinite(distance)&&distance<=start-5;
  },initial,{timeout:60000});
  const approaching=await text(road,'[data-role="targetLine"]');
  assert.notEqual(approaching,before,'The chosen target forecast updates while movement closes the range');
  await road.waitForFunction(()=>{
    const w=window.__realtime.world(),h=w.actors.find(a=>a.id===w.controlled),t=w.actors.find(a=>a.id===h?.lock);
    const line=document.querySelector('[data-role="targetLine"]')?.textContent??'';
    return t?.alive&&Math.hypot(h.x-t.x,h.z-t.z)<=3&&/\b[0-3] metres/.test(line)&&!line.includes('Ambush: he has not seen you');
  },null,{timeout:60000});
  evidence.checks.push({name:'target forecast follows approach and detection',before,approaching,melee:await text(road,'[data-role="targetLine"]')});
  // Reproduce the reported focus failure: List puts focus on Use; P must work
  // without manually returning focus to the canvas first.
  await pause(road,false);await road.click('[data-role="listButton"]');
  await road.locator('[data-role="listOptions"] button:not(:disabled)').first().focus();
  assert.equal(await road.evaluate(()=>document.activeElement?.textContent),'Use');
  await road.keyboard.press('KeyP');await road.waitForFunction(()=>window.__realtime.paused());
  const stopped=await tick(road);await road.waitForTimeout(400);assert.equal(await tick(road),stopped,'P from a Use button stops every simulation tick');
  await road.keyboard.press('KeyP');await road.waitForFunction(t=>window.__realtime.world().tick>t,stopped);
  await pause(road);await road.click('[data-role="listButton"]');
  evidence.checks.push({name:'Pause and resume from a focused command-list Use button',pass:true});
  await road.locator('#rt-board').focus();await road.keyboard.press('Home');
  await road.waitForFunction(()=>{const line=document.querySelector('[data-role="targetLine"]');return line?.hidden&&line.textContent==='';});
  evidence.checks.push({name:'Home clears the previous target readout',pass:true});
  await layout(road,'road-target-narrow');await road.context().close();

  const rescue=await restore({width:580,height:700},'ch2-marsh');
  await revealControl(rescue,'[data-role="objective"]');
  assert.match(await text(rescue,'[data-role="objective"]'),/every survivor/i);
  assert.match(await text(rescue,'[data-role="missionNext"]'),/Bind wounds/);
  assert.ok(!/\bAssist\b/.test(await text(rescue,'.rt-status-strip')),'Mission instructions use the available action vocabulary');
  await layout(rescue,'rescue-narrow');await rescue.context().close();

  for(const viewport of [{width:580,height:700},{width:1280,height:900}]){
    const suffix=viewport.width<900?'narrow':'desktop',field=await restore(viewport,'ch5-mine');
    await field.locator('[data-role="squadBar"] button').first().click();
    await field.waitForSelector('[data-role="commandCard"]:not([hidden])');
    await layout(field,`chapter-v-command-${suffix}`);
    await revealControl(field,'[data-role="deadlineLine"]');
    assert.match(await text(field,'[data-role="deadlineLine"]'),/Optional|opportunit/i,'Optional field opportunities remain visible');
    await field.locator('.rt-toolbox > summary').click();await layout(field,`chapter-v-controls-${suffix}`);
    await field.locator('.rt-toolbox > summary').click();
    await field.locator('#rt-board').focus();await field.keyboard.press('KeyH');await layout(field,`chapter-v-horizon-${suffix}`);
    if(suffix==='desktop'){
      const stopped=await tick(field);await field.locator('#rt-board').focus();await field.keyboard.press('KeyI');
      await field.waitForSelector('#modal[open] [data-soldier-preview][data-preview="ready"]',{timeout:120000});
      await field.waitForFunction(()=>/Drag or use the arrows/.test(document.querySelector('[data-preview-status]')?.textContent??''),null,{timeout:120000});
      const model=field.locator('[data-soldier-preview]');
      await model.screenshot({path:`${output}equipped-soldier.png`});
      const bounds=await model.boundingBox();
      await field.locator('[data-preview-turn="1"]').click();await field.waitForTimeout(250);
      assert.deepEqual(await model.boundingBox(),bounds,'Turning the model preserves the inspection canvas geometry');
      await model.focus();await field.keyboard.press('ArrowLeft');await field.locator('[data-preview-reset]').click();
      await field.keyboard.press('Escape');await field.waitForSelector('#modal[open]',{state:'hidden'});
      assert.equal(await tick(field),stopped,'Inspecting/rotating kit changes no battle time');assert.equal(await paused(field),true,'Kit inspection preserves an existing pause');
      evidence.checks.push({name:'equipped model loads; turn/reset controls preserve layout; closing preserves the battle pause',pass:true});
    }
    await field.context().close();
    const council=await restore(viewport,'ch7-council');
    await (await revealControl(council,'[data-role="coalition"] [data-person]')).click();
    await council.waitForSelector('[data-role="conversation"]:not([hidden])');
    await layout(council,`council-conversation-${suffix}`);
    assert.match(await text(council,'[data-role="coalition"]'),/needed/);
    await council.context().close();
  }
  assert.deepEqual(problems,[],'No browser page or console errors');
  assert.equal(JSON.parse(await readFile(`${root}build-report.json`,'utf8')).revision,build.revision,'The production build did not change during the checks');evidence.passed=true;
  await writeFile(`${output}report.json`,JSON.stringify(evidence,null,2)+'\n');
  console.log(`PASS: ${evidence.checks.length} real-time control, target, rescue and layout checks. Evidence: ${output}report.json`);
}catch(error){
  evidence.passed=false;evidence.error=error.stack;evidence.browserErrors=problems;
  for(const [i,context]of browser.contexts().entries())for(const [j,page]of context.pages().entries())
    await page.screenshot({path:`${output}failure-${i}-${j}.png`,fullPage:true}).catch(()=>{});
  await writeFile(`${output}report.json`,JSON.stringify(evidence,null,2)+'\n');throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
