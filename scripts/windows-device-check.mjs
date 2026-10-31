// Local Windows render observation, without forcing SwiftShader. A real
// accelerated renderer must identify itself in the saved report. This is an
// automated device check, never a first-time-player or physical-phone result.
// Build first. PLAYWRIGHT_MODULE and PLAYWRIGHT_EXECUTABLE_PATH select the
// matching locally installed test browser. No data leaves this computer.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {isAbsolute,resolve,join,dirname,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveRequest} from './serve.mjs';
import {runRealtimeCampaign} from './realtime-autoplay.mjs';
import {menuCommand,revealControl,closePanel,settingsCommand} from './ui-smoke-navigation.mjs';
import * as Game from '../src/core/game.js';
import {restoreCode} from '../src/ui/storage.js';
import {CONFIG} from '../src/config.js';
import {sceneryPlacements,sceneryWorkingSet} from '../src/showcase/scenery-models.js';
import {stageUnit} from '../src/showcase/live-figures.js';
import {actorKit} from '../src/showcase/actor-kit.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {actorBodyId} from '../src/ui/actor-body-catalog.js';

assert.equal(process.platform,'win32','This local check records Windows only.');
const headed=process.argv.includes('--headed');
const root=fileURLToPath(new URL('../dist/',import.meta.url)),out=fileURLToPath(new URL(headed?'../tests/visual-results/windows-device-headed/':'../tests/visual-results/windows-device/',import.meta.url));
const build=JSON.parse(await readFile(`${root}build-report.json`,'utf8')).revision;
let playwright;for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean))try{const m=await import(isAbsolute(specifier)?pathToFileURL(specifier).href:specifier);playwright=m.chromium?m:m.default;break;}catch{}
assert.ok(playwright?.chromium,'Set PLAYWRIGHT_MODULE.');
let code;const stop=new Error('Chapter V earned');
try{runRealtimeCampaign({throughChapter:4,ready:[1,2,3,4],onEncounter(state){
  const next=Game.deserialize(Game.serialize(state));assert.ok(Game.commitEncounter(next).ok);if(next.phase==='promotion')assert.ok(Game.advanceChapter(next).ok);
  if(next.chapter===5&&next.phase==='camp'){code=Game.encodeSave(next);throw stop;}
}});}catch(e){if(e!==stop)throw e;}
assert.ok(code,'Chapter V camp earned through legal campaign commands.');
const checkpoint=Game.decodeSave(code),camp=Game.createCampWorld(checkpoint),scene={id:camp.campId,width:camp.map.width,height:camp.map.height,terrain:camp.map.terrain,campPresentation:camp.campPresentation};
const expected={chapter:checkpoint.chapter,campId:camp.campId,sceneryModels:sceneryPlacements(scene,{chapter:checkpoint.chapter}).length,
  sceneryUrls:sceneryWorkingSet(scene,{chapter:checkpoint.chapter,quality:'balanced'}),bodies:camp.actors.flatMap(actor=>{
    const unit=stageUnit(actor,{appearance:checkpoint.soldier?.appearance}),kit=actorKit(unit,{chapter:checkpoint.chapter,rank:checkpoint.rank}),body=actorBodyId(kit,actorIdentity(unit,kit).key);
    return body?[{id:actor.id,body}]:[];
  })};
assert.ok(expected.sceneryModels>0&&expected.sceneryUrls.length>0&&expected.bodies.some(actor=>actor.id==='hero'),'The earned scene expects actual scenery and generated character bodies.');
await mkdir(out,{recursive:true});
const server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}/`,errors=[],requestFailures=[],httpFailures=[],report={build,method:'Automated Windows Chromium on the default graphics backend; earned Chapter V restored through UI; read-only rendered-frame windows with automatic resolution disabled through Settings; no software renderer forced.',physicalPhone:false,firstTimePlayer:false,adaptiveResolution:false,expectedAssets:expected,readiness:[],windows:[],checks:[]};
const delay=ms=>new Promise(done=>setTimeout(done,ms));
let browser,nativeProcess,nativeProfile,nativeLaunchError,nativeExited=false;
const nativeRunning=()=>!!nativeProcess&&!nativeExited&&nativeProcess.exitCode===null&&nativeProcess.signalCode===null;
async function launchNativeWindow(){
  // A second CDP session cannot clear the capture handle owned by Playwright's
  // original focus-emulation session. Its documented noDefaults connection
  // skips that override for the default context of this fresh, owned browser.
  nativeProfile=await mkdtemp(join(out,'.chromium-profile-'));
  const args=['--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${nativeProfile}`,
    '--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-default-apps',
    '--disable-sync','--metrics-recording-only','--no-service-autorun','--password-store=basic','--enable-automation','--no-sandbox',
    '--force-device-scale-factor=1','--window-size=1296,988','about:blank'];
  report.launch={method:'Dedicated Chromium process; loopback CDP connection; fresh default context with noDefaults:true',
    noDefaults:true,freshProfile:true,loopbackOnly:true,backgroundOverrides:false,deviceScaleFactor:1};
  nativeProcess=spawn(process.env.PLAYWRIGHT_EXECUTABLE_PATH||playwright.chromium.executablePath(),args,{windowsHide:true,stdio:['ignore','ignore','pipe']});
  nativeProcess.once('exit',()=>{nativeExited=true;});
  nativeProcess.on('error',error=>{nativeLaunchError=error;});
  nativeProcess.stderr.on('data',chunk=>{report.launch.stderr=((report.launch.stderr??'')+chunk.toString()).slice(-8000);});
  let endpoint;
  for(let attempt=0;attempt<150&&!endpoint;attempt++){
    if(nativeLaunchError)throw nativeLaunchError;
    assert.ok(nativeRunning(),'Dedicated Chromium remains running while its local endpoint starts.');
    try{
      const [port,path]=(await readFile(join(nativeProfile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);
      if(/^\d+$/.test(port)&&path?.startsWith('/devtools/browser/'))endpoint=`ws://127.0.0.1:${port}${path}`;
    }catch(error){if(error.code!=='ENOENT')throw error;}
    if(!endpoint)await delay(100);
  }
  assert.ok(endpoint,'Dedicated Chromium exposes its loopback-only debugging endpoint.');
  browser=await playwright.chromium.connectOverCDP(endpoint,{noDefaults:true});
  const context=browser.contexts()[0];assert.ok(context,'Use the existing default context; new contexts enable focus emulation.');
  const page=context.pages()[0]??await context.newPage();await page.setViewportSize({width:1280,height:900});await page.bringToFront();
  return {context,page};
}
async function closeOwnedBrowser(){
  if(headed&&browser){try{const session=await browser.newBrowserCDPSession();await session.send('Browser.close');}catch{}}
  let disconnectError;try{await browser?.close();}catch(error){disconnectError=error;}
  if(nativeProcess?.pid){
    for(let attempt=0;attempt<50&&nativeRunning();attempt++)await delay(100);
    if(nativeRunning()){
      // Only the process started above, and its children, belong to this test.
      // Signal termination also means it has exited, even with no exit code.
      await new Promise((done,reject)=>{const killer=spawn('taskkill',['/PID',String(nativeProcess.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.once('error',reject);killer.once('exit',done);});
      for(let attempt=0;attempt<20&&nativeRunning();attempt++)await delay(100);
      assert.ok(!nativeRunning(),'The test-owned Chromium process closes.');
    }
  }
  if(nativeProfile){
    const target=resolve(nativeProfile);
    assert.equal(dirname(target),resolve(out),'Profile cleanup stays directly inside this test output directory.');
    assert.ok(basename(target).startsWith('.chromium-profile-'),'Only this freshly created browser profile is removed.');
    await rm(target,{recursive:true,force:true,maxRetries:4,retryDelay:250});
  }
  if(disconnectError)throw disconnectError;
}
try{
  let context,page;
  if(headed)({context,page}=await launchNativeWindow());
  else{
    browser=await playwright.chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined});
    context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});page=await context.newPage();
    report.launch={method:'Playwright headless launch with default browser context overrides'};
  }
  report.browser=browser.version();report.headed=headed;page.setDefaultTimeout(120000);
  report.viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio}));
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('requestfailed',request=>requestFailures.push({url:request.url(),type:request.resourceType(),error:request.failure()?.errorText??'Unknown request failure'}));
  page.on('response',response=>{if(response.status()>=400)httpFailures.push({url:response.url(),status:response.status()});});
  await page.goto(`${base}?dev`);await menuCommand(page,'settings');
  await (await revealControl(page,'#controls-model')).selectOption('realtime');await closePanel(page);await menuCommand(page,'settings');
  await (await revealControl(page,'#battle-view')).selectOption('3d');await (await revealControl(page,'#graphics-quality')).selectOption('balanced');
  await (await revealControl(page,'#adaptive-resolution')).uncheck();
  await (await revealControl(page,'#modal [data-cmd="restore"]')).click();await page.fill('#restore-code',code);await page.click('[data-cmd="import-code"]');await page.click('[data-cmd="confirm-import"]');
  const stats=()=>page.locator('#rt-board').evaluate(el=>JSON.parse(el.dataset.renderStats));
  async function ready(){
    await page.waitForSelector('.world-courtyard .rt-scene[data-ready="true"]');
    try{await page.waitForFunction(expected=>{
      const stage=window.__chamber?.stage(),board=document.querySelector('#rt-board');
      if(stage?.prepareError)throw new Error(`Scene preparation failed: ${stage.prepareError}`);
      let s;try{s=JSON.parse(board?.dataset.renderStats);}catch{return false;}
      const cache=s.sceneryResidency;
      return window.__realtime?.world()?.campId===expected.campId&&stage?.isReady&&s.quality==='balanced'&&s.worldQuality==='balanced'&&s.resolution?.enabled===false&&
        s.actorAssets?.ready===true&&!s.actorAssets.error&&cache?.loading===0&&cache.loaded===expected.sceneryUrls.length&&cache.entries===expected.sceneryUrls.length&&
        Number(board.dataset.sceneryModels)===expected.sceneryModels&&expected.bodies.every(({id,body})=>stage.actors.get(id)?.group.userData.actor?.body===body)&&s.frameProfile?.frames>60;
    },expected);}finally{
      report.readiness.push(await page.evaluate(()=>{
        const stage=window.__chamber?.stage(),board=document.querySelector('#rt-board');let stats=null;try{stats=JSON.parse(board?.dataset.renderStats);}catch{}
        return {campId:window.__realtime?.world()?.campId,prepareError:stage?.prepareError??null,sceneryModels:Number(board?.dataset.sceneryModels),
          bodies:stage?[...stage.actors.entries()].map(([id,actor])=>({id,body:actor.group.userData.actor?.body??null})):[],stats};
      }));
    }
    assert.deepEqual(errors,[],'No browser/console errors during scene preparation.');assert.deepEqual(requestFailures,[],'No failed asset requests.');assert.deepEqual(httpFailures,[],'No failing asset responses.');
  }
  async function visitedAndSaved(){
    // The arrival visit is a real campaign command fired by the live camp.
    // Wait for its persisted record, not only for the first painted frame.
    await page.waitForFunction(({chapter,key})=>{try{
      const saved=JSON.parse(JSON.parse(localStorage.getItem(key)).payload);
      return window.__realtime.world().tick>0&&saved.phase==='camp'&&saved.chapter===chapter&&saved.soldier.flags[`visited:${chapter}:gate`]===true&&
        !document.querySelector('.save-status')?.textContent.includes('Saving')&&!document.querySelector('.system-notice');
    }catch{return false;}},{chapter:expected.chapter,key:CONFIG.saveKey});
  }
  async function pause(){if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();await page.waitForFunction(()=>window.__realtime.paused());}
  async function exported(){await settingsCommand(page,'export');const text=await page.locator('#save-code').inputValue();await closePanel(page);return Game.serialize(await restoreCode(text));}
  async function minimizeAndRestore(){
    const session=await context.newCDPSession(page),observation=report.visibility={method:'Native test-window minimize and restore through Browser.setWindowBounds; default context connected with noDefaults:true',playwrightFocusOverrideApplied:false,performed:false};
    let windowId,originalBounds;
    const visibility=()=>page.evaluate(()=>({state:document.visibilityState,hidden:document.hidden,paused:window.__realtime.paused()}));
    try{
      await page.bringToFront();await page.waitForFunction(()=>document.visibilityState==='visible',null,{polling:100,timeout:15000});
      ({windowId,bounds:originalBounds}=await session.send('Browser.getWindowForTarget'));
      observation.before={window:originalBounds,...await visibility()};
      // This minimizes the actual browser window. No visibility property,
      // lifecycle state or visibilitychange event is injected into the page.
      await session.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});
      observation.minimizeRequested={window:(await session.send('Browser.getWindowBounds',{windowId})).bounds,...await visibility()};
      // rAF is normally suspended while hidden, so use timer polling.
      await page.waitForFunction(()=>document.hidden&&document.visibilityState==='hidden',null,{polling:100,timeout:15000});
      observation.minimized={window:(await session.send('Browser.getWindowBounds',{windowId})).bounds,...await visibility()};
      assert.equal(observation.minimized.window.windowState,'minimized','The actual test window is minimized.');
      assert.equal(observation.minimized.state,'hidden');assert.equal(observation.minimized.hidden,true);
      assert.equal(observation.minimized.paused,true,'The player pause is retained while the window is hidden.');
    }finally{
      // Restore even when the OS/browser did not deliver the required hidden
      // transition. Such a run fails rather than claiming visibility coverage.
      try{if(windowId!==undefined){
        await session.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
        const bounds=Object.fromEntries(['left','top','width','height'].filter(key=>Number.isFinite(originalBounds?.[key])).map(key=>[key,originalBounds[key]]));
        if(Object.keys(bounds).length)await session.send('Browser.setWindowBounds',{windowId,bounds});
        await page.bringToFront();await page.waitForFunction(()=>!document.hidden&&document.visibilityState==='visible',null,{polling:100,timeout:15000});
        observation.restored={window:(await session.send('Browser.getWindowBounds',{windowId})).bounds,...await visibility()};
      }}finally{await session.detach();}
    }
    assert.equal(observation.restored.window.windowState,'normal');assert.equal(observation.restored.state,'visible');assert.equal(observation.restored.hidden,false);
    assert.equal(observation.restored.paused,true,'Restoring the native window does not release the player pause.');observation.performed=true;
  }
  async function windowSample(label){
    // The DOM snapshot is published once a second. Start from the live,
    // read-only counter so the new window cannot retain pre-panel frames.
    const before=await page.evaluate(()=>{const stage=window.__chamber.stage();return {...stage.stats(),
      observation:{reducedMotion:stage.reducedMotion,motionSpeed:stage.motionSpeed,paused:window.__realtime.paused(),scene:'camp'}};});
    // Resuming clears lastPaint: its first frame has interval zero. Observe
    // one extra rendered frame so every interval in the ring is from this
    // window. A visibility/modal interruption invalidates the entire sample.
    const after=await page.evaluate(n=>new Promise((resolve,reject)=>{
      const board=document.querySelector('#rt-board'),modal=document.querySelector('#modal');let timer;
      const done=(error,result)=>{observer.disconnect();document.removeEventListener('visibilitychange',changed);clearTimeout(timer);error?reject(error):resolve(result);};
      const changed=()=>{if(document.visibilityState!=='visible'||modal?.open){done(new Error('Frame window interrupted by visibility or a panel.'));return;}
        const value=JSON.parse(board.dataset.renderStats);if(value.frameProfile.frames>=n+241)done(null,value);};
      const observer=new MutationObserver(changed);observer.observe(board,{attributes:true,attributeFilter:['data-render-stats']});if(modal)observer.observe(modal,{attributes:true,attributeFilter:['open']});
      document.addEventListener('visibilitychange',changed);timer=setTimeout(()=>done(new Error('Rendered-frame window exceeded three minutes.')),180000);changed();
    }),before.frameProfile.frames);assert.equal(after.frameProfile.displayInterval.samples,240);assert.equal(after.resolution.enabled,false,'Automatic resolution remains off.');
    report.windows.push({label,observation:before.observation,startFrame:before.frameProfile.frames,firstFrame:after.frameProfile.frames-239,lastFrame:after.frameProfile.frames,device:after.device,quality:after.quality,camera:after.cameraView,
      frameProfile:after.frameProfile,gpu:after.gpu,resolution:after.resolution,calls:after.calls,triangles:after.triangles,firstFramePrograms:after.firstFramePrograms});
    console.log(`ok - ${label}: 240 rendered frames; display p95 ${after.frameProfile.displayInterval.p95Ms.toFixed(1)} ms`);
  }
  await ready();await visitedAndSaved();await pause();const initial=await exported();
  await windowSample('Chapter V Balanced, first settled window');await windowSample('Chapter V Balanced, independent repeat');
  const measured=await stats();report.device=measured.device;
  report.accelerated=measured.device?.identity==='unmasked'&&measured.device?.software===false&&!!measured.device?.renderer&&!/unknown|unavailable|webkit/i.test(measured.device.renderer);
  report.graphicsEvidence=report.accelerated?'unmasked accelerated renderer':measured.device?.software?'software renderer':'unknown or masked renderer; no hardware-performance claim';
  await page.locator('#rt-board').screenshot({path:`${out}chapter-v-balanced.png`});
  assert.equal(await exported(),initial,'Render observation preserves the exported campaign.');report.checks.push('Paused frame sampling preserves exact exported state.');
  if(headed)await minimizeAndRestore();
  else{
    // Headless Chromium may keep both targets visible. Report the actual
    // observation, with no claim of a native window or hidden-page check.
    const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
    const hidden=await page.evaluate(()=>document.visibilityState);await page.bringToFront();await other.close();
    report.visibility={method:'Headless target switch; no native window',backgroundState:hidden,performed:hidden==='hidden'};
  }
  await windowSample(headed?'After native window restore':'After tab switch');assert.equal(await exported(),initial,'Visibility observation preserves the exact exported campaign.');
  report.checks.push(headed?'Native minimize/restore observed hidden then visible and preserves the exact exported campaign.':'Headless target switch preserves the exported campaign; visibility coverage is reported separately.');
  await page.reload();await page.locator('[data-cmd="continue"]').first().click();await ready();await visitedAndSaved();await pause();assert.equal(await exported(),initial,'Save/resume preserves exact state.');
  await windowSample('After save/resume');report.checks.push('Reload resumes the exact saved campaign.');
  assert.equal(errors.length,0,errors.join('\n'));assert.deepEqual(requestFailures,[]);assert.deepEqual(httpFailures,[]);
  assert.equal(JSON.parse(await readFile(`${root}build-report.json`,'utf8')).revision,build,'The production build stays unchanged throughout the device check.');report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;throw e;}finally{
  try{await closeOwnedBrowser();}catch(error){report.passed=false;report.cleanupFailure=error.stack;throw error;}finally{
    report.errors=errors;report.requestFailures=requestFailures;report.httpFailures=httpFailures;report.finished=new Date().toISOString();
    try{await writeFile(`${out}report.json`,JSON.stringify(report,null,2)+'\n');}
    finally{await new Promise(done=>server.close(done));}
  }
}
