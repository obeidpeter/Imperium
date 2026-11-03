// Real interface checks for the world-first layout. Checkpoints are earned by
// legal campaign commands and imported through the visible save dialog. This
// measures layout in Chromium, not physical-device frame rates or art quality.
import assert from 'node:assert/strict';
import http from 'node:http';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isAbsolute} from 'node:path';
import {serveRequest} from './serve.mjs';
import {runCommandCampaign} from './command-autoplay.mjs';
import {closePanel,menuCommand,openCampList,revealControl,throttleCpu,watchEventLine} from './ui-smoke-navigation.mjs';
import * as Game from '../src/core/game.js';
import {COMPANY_ACTIVITIES} from '../src/data/company-activities.js';

const source=process.argv.includes('--source'),root=fileURLToPath(new URL(source?'../':'../dist/',import.meta.url));
const output=fileURLToPath(new URL('../tests/visual-results/immersive-interface/',import.meta.url));
await access(`${root}index.html`).catch(()=>{throw new Error('Build first: node scripts/build.mjs');});
const build=source?null:JSON.parse(await readFile(`${root}build-report.json`,'utf8')).revision;
let playwright;
for(const name of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean))try{
  const module=await import(isAbsolute(name)?pathToFileURL(name).href:name);playwright=module.chromium?module:module.default;break;
}catch{}
assert.ok(playwright?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright module.');
const needed=new Set(['ch5-mine','ch7-council','ch8-parley','ch12-legitimacy']),codes=new Map(),stop=new Error('checkpoints earned');
try{runCommandCampaign({featureEdition:35,onCheckpoint:state=>{
  const id=Game.getChapter(state).encounters[state.encounterIndex]?.id;
  if(needed.has(id)&&!codes.has(id))codes.set(id,Game.encodeSave(state));
  if(codes.size===needed.size)throw stop;
}});}catch(error){if(error!==stop)throw error;}
assert.equal(codes.size,needed.size);
await mkdir(output,{recursive:true});
const server=http.createServer((req,res)=>serveRequest(req,res,root));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await playwright.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const report={method:'Automated Chromium, legal checkpoint imports, visible UI controls; 2D geometry and camera control paths',source,build,
  browser:browser.version(),physicalDeviceTest:false,checks:[],errors:[]};
// The least share of the window's height the world takes (release 12: the page no longer scrolls, so the strip
// and the bar take the rest), a little below what Chapters V, VII, VIII and XII measure: the chamber, with its
// vote row, is the tightest. See docs/fullscreen-release12-report.md.
const WORLD_SHARE=Object.freeze({desktop:.6,phone:.5,smallPhone:.38,largeText:.3});
async function prepare(viewport,id,{scale=1,encounter=false}={}){
  const context=await browser.newContext({viewport}),page=await context.newPage();await throttleCpu(page);page.setDefaultTimeout(30000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  await page.goto(base);await menuCommand(page,'settings');
  await (await revealControl(page,'#controls-model')).selectOption('realtime');await closePanel(page);
  await menuCommand(page,'settings');
  await (await revealControl(page,'#battle-view')).selectOption('2d');
  await (await revealControl(page,'#graphics-quality')).selectOption('performance');
  if(scale!==1)await (await revealControl(page,'#text-size')).selectOption(String(scale));
  await (await revealControl(page,'#modal [data-cmd="restore"]')).click();
  await page.locator('#restore-code').fill(codes.get(id));await page.locator('[data-cmd="import-code"]').click();await page.locator('[data-cmd="confirm-import"]').click();
  await page.waitForSelector('.world-courtyard .rt-scene[data-ready="true"]');
  if(encounter){await (await revealControl(page,'[data-cmd="start"]')).click();await page.waitForSelector('.realtime-frame .rt-scene[data-ready="true"]');}
  if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
  return page;
}
async function measure(page,label,{camp=false,desktop=false,scale=1}={}){
  const result=await page.evaluate(()=>{
    const canvas=document.querySelector('#rt-board').getBoundingClientRect(),rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};};
    // Release 12: the strip, the bar and the deployment controls never cover the world. Help, tips, the log,
    // All actions, a conversation and the camp list open over it by design, inside the world's own area.
    const panels=[...document.querySelectorAll('.rt-top,.rt-hud,.rt-deploy,.rt-chronicle-bar,.rt-field>.rt-status-strip,.rt-chamber-strip')].filter(el=>el.checkVisibility({checkVisibilityCSS:true}));
    return {viewport:{width:innerWidth,height:innerHeight},world:document.documentElement.dataset.world,
      documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,canvas:rect(document.querySelector('#rt-board')),
      overlap:panels.filter(el=>{const b=el.getBoundingClientRect();return Math.min(b.right,canvas.right)-Math.max(b.left,canvas.left)>1&&Math.min(b.bottom,canvas.bottom)-Math.max(b.top,canvas.top)>1;}).map(el=>el.className)};
  });
  assert.equal(result.world,'full',`${label}: the world fills the window`);
  assert.ok(result.documentWidth<=result.viewport.width+1,`${label}: no horizontal document overflow`);
  assert.ok(result.documentHeight<=result.viewport.height+1,`${label}: nothing on the page scrolls (${result.documentHeight}px in ${result.viewport.height}px)`);
  assert.deepEqual(result.overlap,[],`${label}: the strip and the bar do not cover the world`);
  // The world's share of the window: most of it on a desktop, and a usable scene everywhere, even at 200% text.
  const least=desktop?WORLD_SHARE.desktop:scale===2?WORLD_SHARE.largeText:result.viewport.height<700?WORLD_SHARE.smallPhone:WORLD_SHARE.phone;
  assert.ok(result.canvas.w>=300&&result.canvas.h>=result.viewport.height*least,`${label}: the world takes at least ${Math.round(least*100)}% of the height (${Math.round(result.canvas.h)}px)`);
  if(camp){
    // The camp list (Menu → Camp) opens over the world with focus, and Esc gives the world its focus back.
    await openCampList(page);await page.waitForFunction(()=>document.activeElement?.id==='camp-services');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('main[data-overlay="services"]')&&document.activeElement?.id==='rt-board');
  }
  // Release 12: one fixed camera. No View choice in the strip; Z, F and a held H move it from the keyboard, the scene keeps the keys,
  // and the 2D view says that the horizon is a 3D view.
  const tick=await page.evaluate(()=>window.__realtime.world().tick);
  assert.equal(await page.locator('[data-role="cameraSelect"]').count(),0,'No View choice: the camera keeps one bearing');
  // A chamber opens on its whole floor, a camp or a battle on the soldier: Z toggles from either.
  await page.locator('#rt-board').focus();const first=await page.evaluate(()=>window.__chamber.stage()?.cameraView),other=first==='overview'?'follow':'overview';
  for(const [key,view] of [['z',other],['z',first],['z',other],['f','follow']]){
    await page.keyboard.press(key);await page.waitForFunction(value=>window.__chamber.stage()?.cameraView===value,view);
    assert.equal(await page.evaluate(()=>window.__realtime.world().tick),tick,'A camera key never advances a paused simulation');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'rt-board','The scene keeps the keys');
  }
  const said=await watchEventLine(page);await page.keyboard.down('h');await said(/horizon is a 3D view/);
  await page.keyboard.up('h');assert.equal(await page.evaluate(()=>window.__chamber.stage().cameraView),'follow','the 2D view stays on the soldier');
  if(camp){
    await (await revealControl(page,'#camp-company-stories [data-cmd="conversation"][data-id^="company-story:"]')).click();
    await page.locator('#modal [data-cmd="reply"]').filter({hasText:'Read the company’s letter.'}).click();
    const reply=page.locator('#modal [data-cmd="reply"]').first();
    const consequences=await reply.locator('small').innerText();assert.match(consequences,/\+2/);assert.match(consequences,/-1/,'Both the benefit and cost appear before choosing');
    const geometry=await page.locator('#modal').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
    assert.ok(geometry.scroll<=geometry.client+1,'Company letters fit at the selected text size');
    await reply.click();await page.locator('#modal [data-cmd="reply"]').filter({hasText:'Return to camp.'}).click();
    await (await revealControl(page,'#camp-company-stories [data-cmd="conversation"][data-id^="company-story:"]')).click();
    assert.equal(await page.locator('#modal [data-cmd="reply"]').filter({hasText:'Read the company’s letter.'}).count(),0,'A saved choice cannot be taken twice');
    await closePanel(page);
  }
  let activity=null;
  if(camp&&(desktop||scale===2)){
    const chapter=Number(/^ch(\d+)/.exec(label)?.[1]);
    if([5,8].includes(chapter))activity=await verifyActivity(page,chapter);
  }
  await page.screenshot({path:`${output}${label}.png`,animations:'disabled'});
  report.checks.push({name:label,pass:true,companyStory:camp,activity,...result});console.log(`ok - ${label}`);
}
async function verifyActivity(page,chapter){
  const a=COMPANY_ACTIVITIES.find(a=>a.chapter===chapter),selector=`[data-company-activity="company-activity:${chapter}"]`;
  const position=()=>page.evaluate(()=>{const w=window.__realtime.world(),h=w.actors.find(a=>a.id===w.heroId);return {x:h.x,z:h.z};});
  const entry=await position();
  if(await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
  await page.locator('#rt-board').focus();await page.keyboard.down('ArrowUp');
  try{await page.waitForFunction(from=>{const w=window.__realtime.world(),h=w.actors.find(a=>a.id===w.heroId);return Math.hypot(h.x-from.x,h.z-from.z)>1;},entry);}
  finally{await page.keyboard.up('ArrowUp');}
  if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
  const moved=await position();assert.ok(Math.hypot(moved.x-entry.x,moved.z-entry.z)>1,'Activity refresh is tested away from the camp entrance');
  const reply=text=>page.locator('#modal [data-cmd="reply"]').filter({hasText:text}).click();
  const dialogue=async expected=>{
    const paragraph=page.locator('#modal .dialogue-text');
    // Replies commit their save asynchronously before the next node appears.
    await paragraph.filter({hasText:expected}).waitFor({state:'visible'});
    assert.equal(await paragraph.innerText(),expected,'The authored dialogue is readable after the reply commits');
  };
  await (await revealControl(page,`${selector} [data-cmd="conversation"]`)).click();await reply('I will check it myself.');await reply('Return to camp.');
  const clues=[];
  for(const step of [a.steps[0],a.steps[1],a.steps[0]]){
    await (await revealControl(page,`${selector} [data-id="${step.id}"]`)).click();await reply('Examine and remember the mark.');
    await dialogue(step.text);clues.push(step.id);
    const geometry=await page.locator('#modal').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(geometry.scroll<=geometry.client+1,'Activity records fit at the chosen text size');
    await reply('Keep looking around camp.');
  }
  await (await revealControl(page,`${selector} [data-id="${a.steps[2].id}"]`)).click();await reply('Compare the records.');
  await reply(a.answers[(a.correct+1)%a.answers.length]);await dialogue(a.wrong);
  assert.equal(await page.locator(`${selector} .consequence`).count(),0,'An incorrect match does not complete the activity');
  await reply('Compare again.');await reply(a.answers[a.correct]);await dialogue(a.result);await reply('Return to camp.');
  await page.waitForFunction(ch=>window.__realtime.world().campPresentation?.activities?.some(a=>a.chapter===ch&&a.completed),chapter);
  assert.deepEqual(await position(),moved,'Conversation progress refreshes the camp without returning the soldier to the gate');
  assert.match(await page.locator(selector).innerText(),/Completed/);
  await page.reload();await page.locator('[data-cmd="continue"]:visible').first().click();await page.waitForSelector('.realtime-camp .rt-scene[data-ready="true"]');
  await revealControl(page,selector);
  assert.ok((await page.locator(selector).innerText()).includes(a.result),'The completed acknowledgement survives save and reload');
  assert.equal(await page.locator(`${selector} [data-cmd="conversation"]`).count(),0,'Completion does not offer another payout or start');
  if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
  return {chapter,clues,incorrectRefused:true,completed:true,reloaded:true,positionPreserved:true};
}
// A page that stops answering fails here, with its name and the diagnostics below, instead of holding the job until
// CI stops it (release 13: one page held a CI job for half an hour). A page takes well under a minute.
const PAGE_LIMIT_MS=5*60*1000;
async function within(label,run){
  let timer;
  try{return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label}: no answer within ${PAGE_LIMIT_MS/60000} minutes`)),PAGE_LIMIT_MS);})]);}
  finally{clearTimeout(timer);}
}
try{
  // Release 12's sizes: a 1,280 × 720 desktop, a 390-pixel phone (also at 200% text) and a small 360 × 640 phone.
  for(const [label,viewport,scale]of [['desktop',{width:1280,height:720},1],['phone',{width:390,height:844},1],['large-text',{width:390,height:844},2],['small-phone',{width:360,height:640},1]]){
    for(const id of ['ch5-mine','ch8-parley','ch12-legitimacy'])await within(`${id}-camp-${label}`,async()=>{
      const page=await prepare(viewport,id,{scale});await measure(page,`${id}-camp-${label}`,{camp:true,desktop:label==='desktop',scale});await page.context().close();
    });
    for(const id of ['ch5-mine','ch7-council'])await within(`${id}-${label}`,async()=>{
      const page=await prepare(viewport,id,{scale,encounter:true});await measure(page,`${id}-${label}`,{desktop:label==='desktop',scale});await page.context().close();
    });
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
  console.log(`PASS: ${report.checks.length} immersive interface checks.`);
}catch(error){report.passed=false;report.failure=error.stack;
  for(const [i,context]of browser.contexts().entries())for(const [j,page]of context.pages().entries()){
    let timer;
    const details=await Promise.race([page.evaluate(()=>({url:location.href,focus:document.activeElement?.outerHTML?.slice(0,500),
      modal:document.querySelector('#modal')?.innerText,activity:document.querySelector('.company-activity')?.innerText,
      scene:document.querySelector('.rt-scene')?.dataset.ready})).catch(e=>({error:e.message})),
      new Promise(resolve=>{timer=setTimeout(()=>resolve({error:'Read-only diagnostics did not answer within 5 seconds.'}),5000);})]);
    clearTimeout(timer);
    await writeFile(`${output}failure-${i}-${j}.json`,JSON.stringify(details,null,2)+'\n');
    await page.screenshot({path:`${output}failure-${i}-${j}.png`,fullPage:false,timeout:10000}).catch(()=>{});
  }
  throw error;}
finally{await writeFile(`${output}report.json`,JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(resolve=>server.close(resolve));}
