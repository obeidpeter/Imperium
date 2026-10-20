// Legal camp -> real Restore UI -> choose approach -> normal-motion turns.
// Software Chromium correctness/video evidence; never a physical GPU result.
import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {serveRequest} from './serve.mjs';
import {runCommandCampaign} from './command-autoplay.mjs';
import * as Game from '../src/core/game.js';
const root=fileURLToPath(new URL('../',import.meta.url)),output=resolve(process.argv[2]||'tests/fixtures/production-recording');
await mkdir(output,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const report={method:'Public Restore and command UI, normal motion at 1×, software Chromium; video is correctness evidence, not hardware performance.',errors:[],checks:[]};let context;
const menu=async(page,cmd)=>{if(!await page.locator(`[data-cmd="${cmd}"]:visible`).count())await page.locator('[data-cmd="menu"]:visible').first().click();const modal=page.locator(`#modal[open] [data-cmd="${cmd}"]`);await (await modal.count()?modal.first():page.locator(`[data-cmd="${cmd}"]:visible`).first()).click();};
const close=page=>page.locator('#modal [data-cmd="close-modal"]').first().click();
const decode=code=>{const [prefix,body]=code.trim().split('.'),bytes=Buffer.from(body,'base64'),raw=prefix==='SAC1'?gunzipSync(bytes):bytes,parsed=JSON.parse(raw.toString());return Game.deserialize(parsed.format===1?parsed.payload:raw.toString());};
async function exported(page){await menu(page,'settings');await page.locator('[data-cmd="export"]:visible').click();const state=decode(await page.locator('#save-code').inputValue());await close(page);return state;}
try{
  let camp;runCommandCampaign({featureEdition:35,onCheckpoint:s=>{if(Game.getChapter(s).encounters[s.encounterIndex].id==='ch5-wall')camp=structuredClone(s);}});assert.ok(camp);
  assert.ok(Game.chooseOperationalPlan(camp,'balanced').ok);
  context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,recordVideo:{dir:output,size:{width:1280,height:900}}});
  const page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(origin+'/dist/');await page.waitForSelector('[data-cmd="new"]');
  await menu(page,'settings');await page.locator('#modal [data-cmd="restore"]').click();await page.locator('#restore-code').fill(Game.encodeSave(camp));await page.locator('[data-cmd="import-code"]').click();await page.locator('[data-cmd="confirm-import"]').click();
  await page.waitForSelector('.camp-page');await page.locator('[data-cmd="field-approach"][data-id="diversion"]').click();
  assert.equal((await exported(page)).fieldApproach,'diversion');
  report.checks.push('Camp approach selected and persisted through the real UI');console.log('ok - approach selected through the camp UI');
  await menu(page,'settings');await page.selectOption('#battle-view','3d');await page.selectOption('#graphics-quality','balanced');await page.uncheck('#motion-setting');await page.uncheck('#adaptive-resolution');await page.check('#audio-setting');await close(page);
  await page.locator('[data-cmd="start"]').click();
  await page.waitForFunction(()=>{const c=document.querySelector('#battle-board');try{return c.parentElement.dataset.ready==='true'&&c.dataset.actorAssets==='imported'&&JSON.parse(c.dataset.renderStats).samples>=8;}catch{return false;}},null,{timeout:300000});
  await page.locator('[data-cmd="camera-horizon"]').click();
  await page.screenshot({path:resolve(output,'chapter-v-horizon.png')});
  const start=await exported(page);assert.equal(start.encounter.fieldApproach,'diversion');
  for(let turn=1;turn<=3;turn++){
    await page.locator('[data-cmd="end-turn"]').click();
    await page.waitForFunction(()=>document.querySelector('#battle-board')?.dataset.motion==='playing');
    await page.waitForFunction(()=>document.querySelector('#battle-board')?.dataset.motion==='complete',null,{timeout:180000});
    // The export gives the authoritative result; transient UI readiness cannot
    // stand in for a completed command or invent a turn.
    const state=await exported(page);assert.equal(state.encounter.turn,turn+1);
    const features=await page.locator('#battle-board').evaluate(el=>JSON.parse(el.dataset.renderStats).fieldFeatures);
    assert.equal(features?.objects,state.encounter.field.objects.length,'Field objects must survive the committed animation snapshot');
    report.checks.push(`Normal-motion enemy turn ${turn} completed through public UI`);console.log(`ok - normal-motion turn ${turn}`);
  }
  report.stats=await page.locator('#battle-board').evaluate(el=>JSON.parse(el.dataset.renderStats));
  await page.screenshot({path:resolve(output,'chapter-v-after-combat.png')});
  // Rebuild already-visible actors twice: changing a saved preference before
  // entering the battle cannot exercise the replacement ownership path.
  report.qualitySwitches=[];
  for(const quality of ['performance','balanced']){
    await menu(page,'settings');await page.selectOption('#graphics-quality',quality);await close(page);
    await page.waitForFunction(q=>{try{const c=document.querySelector('#battle-board'),s=JSON.parse(c.dataset.renderStats);return c.parentElement.dataset.ready==='true'&&s.quality===q&&s.samples>=8;}catch{return false;}},quality,{timeout:300000});
    const state=await exported(page);assert.equal(state.encounter.turn,4);
    report.qualitySwitches.push(await page.locator('#battle-board').evaluate(el=>JSON.parse(el.dataset.renderStats)));
    console.log(`ok - live ${quality} quality replacement`);
  }
  report.checks.push('Live Performance and Balanced actor rebuilds preserve the turn and continue rendering');
  report.video=await page.video().path();await context.close();context=null;
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.errors.push(error.stack||String(error));process.exitCode=1;}
finally{await context?.close();await browser.close();await new Promise(done=>server.close(done));await writeFile(resolve(output,'recording-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
