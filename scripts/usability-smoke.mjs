// Visible player-flow regressions for the simplified interface. A legal public
// campaign supplies the checkpoint, imported through the player's dialog.
// Browser evaluation only observes state/DOM; it never injects play or saves.
// Build first. PLAYWRIGHT_MODULE / PLAYWRIGHT_EXECUTABLE_PATH are optional.
// USABILITY_ONLY=phone-settings diagnoses the settings/reload flow alone.
// USABILITY_ONLY=desktop runs all desktop flows after a focused repair.
import assert from 'node:assert/strict';
import http from 'node:http';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {serveRequest} from './serve.mjs';
import {menuCommand,revealControl,settingsCommand,settingsPage,verifyCampPanelTransitions,closePanel,verifyEnlargedSettingsGeometry} from './ui-smoke-navigation.mjs';
import {runCommandCampaign} from './command-autoplay.mjs';
import * as Game from '../src/core/game.js';

const root=fileURLToPath(new URL('../dist/',import.meta.url)),output=fileURLToPath(new URL('../tests/visual-results/usability/',import.meta.url));
const only=process.env.USABILITY_ONLY;
assert.ok(!only||['phone-settings','desktop'].includes(only),'Unknown USABILITY_ONLY scenario');
await access(`${root}index.html`).catch(()=>{throw new Error('Build first: node scripts/build.mjs');});
const build=JSON.parse(await readFile(`${root}build-report.json`,'utf8'));
let playwright;
for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){
  try{const m=await import(isAbsolute(specifier)?pathToFileURL(specifier).href:specifier);playwright=m.chromium?m:m.default;break;}catch{}
}
assert.ok(playwright?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright module.');
let code;const stop=new Error('checkpoint earned');
try{runCommandCampaign({featureEdition:35,onCheckpoint:s=>{
  if(Game.getChapter(s).encounters[s.encounterIndex]?.id!=='ch5-mine')return;
  code=Game.encodeSave(s);throw stop;
}});}catch(error){if(error!==stop)throw error;}
assert.ok(code,'Chapter V checkpoint is earned through the legal campaign.');
await mkdir(output,{recursive:true});
const server=http.createServer((req,res)=>serveRequest(req,res,root));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await playwright.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const report={method:'Automated Chromium; visible categories, summaries, buttons and keyboard; legal checkpoint import; no simulation injection',scope:only||'full',
  build:build.revision,browser:browser.version(),physicalDeviceTest:false,
  capture:{cssAnimations:'disabled during capture',timeoutMs:60000,maxAttempts:2,retries:[]},checks:[],errors:[]};
const record=(name,details={})=>{report.checks.push({name,pass:true,...details});console.log(`ok - ${name}`);};
async function screenshot(page,options){
  for(let attempt=1;attempt<=2;attempt++){
    try{return await page.screenshot({...options,animations:'disabled',timeout:60000});}
    catch(error){
      if(error.name!=='TimeoutError'||attempt===2)throw error;
      const name=options.path.slice(output.length);report.capture.retries.push({name,attempt});
      console.log(`# ${name}: screenshot timed out; retrying the unchanged page once`);
    }
  }
}
const close=closePanel;
const tick=page=>page.evaluate(()=>window.__realtime.world().tick);
const paused=page=>page.evaluate(()=>window.__realtime.paused());
async function pause(page,value=true){if(await paused(page)!==value)await page.locator('[data-role="pauseButton"]').click();await page.waitForFunction(v=>window.__realtime.paused()===v,value);}
async function metrics(page,selector){
  return page.locator(selector).evaluate(root=>{
    const visible=el=>el.checkVisibility({checkVisibilityCSS:true})&&!!el.getClientRects().length;
    const rect=root.getBoundingClientRect();
    return {buttons:[...root.querySelectorAll('button')].filter(visible).length,
      words:root.innerText.trim().split(/\s+/).filter(Boolean).length,
      width:rect.width,viewport:innerWidth,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,
      documentWidth:document.documentElement.scrollWidth};
  });
}
function fits(measure,label){
  assert.ok(measure.width<=measure.viewport+1,`${label}: panel fits the viewport ${JSON.stringify(measure)}`);
  assert.ok(measure.scrollWidth<=measure.clientWidth+1,`${label}: panel has no horizontal overflow ${JSON.stringify(measure)}`);
  assert.ok(measure.documentWidth<=measure.viewport+1,`${label}: page has no horizontal overflow ${JSON.stringify(measure)}`);
}
async function fieldGeometry(page,label){
  const measured=await page.evaluate(()=>{
    const r=document.querySelector('#rt-board').getBoundingClientRect();
    const panels=[...document.querySelectorAll('.rt-top,.rt-hud,.rt-status-strip,.rt-support,.rt-command-list,.rt-log-panel,.rt-talk,.rt-deploy')]
      .filter(el=>el.checkVisibility({checkVisibilityCSS:true}));
    return {canvas:{width:r.width,height:r.height},overlap:panels.filter(el=>{const p=el.getBoundingClientRect();return Math.min(p.right,r.right)-Math.max(p.left,r.left)>1&&Math.min(p.bottom,r.bottom)-Math.max(p.top,r.top)>1;}).map(el=>el.className)};
  });
  assert.deepEqual(measured.overlap,[],`${label}: every control panel stays outside the action region`);
  assert.ok(measured.canvas.width>=300&&measured.canvas.height>=318,`${label}: the game retains a usable canvas ${JSON.stringify(measured)}`);
  return measured;
}
async function textContrast(page,selector){
  const measured=await page.locator(selector).first().evaluate(el=>{
    const rgba=value=>{const n=value.match(/[\d.]+/g)?.map(Number)??[];if(n.length<3)throw new Error(`Unsupported computed color: ${value}`);return [...n.slice(0,3),n[3]??1];};
    const over=(fg,bg)=>fg.slice(0,3).map((c,i)=>c*fg[3]+bg[i]*(1-fg[3]));
    const ancestors=[];for(let n=el;n;n=n.parentElement)ancestors.unshift(n);
    let background=[255,255,255];const images=[];
    for(const n of ancestors){const s=getComputedStyle(n);background=over(rgba(s.backgroundColor),background);if(s.backgroundImage!=='none')images.push({element:n.id||n.className||n.tagName,image:s.backgroundImage});}
    const foreground=over(rgba(getComputedStyle(el).color),background);
    const luminance=rgb=>rgb.map(c=>{const v=c/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const f=luminance(foreground),b=luminance(background);
    return {foreground,background,ratio:(Math.max(f,b)+.05)/(Math.min(f,b)+.05),backgroundImages:images};
  });
  assert.ok(measured.ratio>=4.5,`${selector}: high-contrast text must exceed 4.5:1 against its computed background ${JSON.stringify(measured)}`);
  return {selector,...measured};
}
async function exported(page){
  await settingsCommand(page,'export');const raw=await page.locator('#save-code').inputValue();await close(page);
  const [prefix,body]=raw.trim().split('.'),bytes=Buffer.from(body,'base64'),data=JSON.parse((prefix==='SAC1'?gunzipSync(bytes):bytes).toString('utf8'));
  return Game.serialize(Game.deserialize(data.format===1?data.payload:JSON.stringify(data)));
}
async function setup(viewport){
  const context=await browser.newContext({viewport}),page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(`${base}?dev`);await menuCommand(page,'settings');
  await (await revealControl(page,'#controls-model')).selectOption('realtime');await close(page);
  await menuCommand(page,'settings');
  await (await revealControl(page,'#battle-view')).selectOption('2d');
  await (await revealControl(page,'#graphics-quality')).selectOption('performance');
  for(const id of ['pause-sighted','pause-hurt','pause-squad','pause-objective','pause-order'])await (await revealControl(page,`#${id}`)).uncheck();
  await (await revealControl(page,'#modal [data-cmd="restore"]')).click();
  await page.locator('#restore-code').fill(code);await page.locator('[data-cmd="import-code"]').click();await page.locator('[data-cmd="confirm-import"]').click();
  await page.waitForSelector('.camp-page');
  // Legacy checkpoints may offer the existing, explicit soldier adoption flow.
  if(await page.locator('[data-cmd="adopt-soldier"]:visible').count()){
    await page.locator('[data-cmd="adopt-soldier"]').click();await page.waitForSelector('#modal .character-panel');await close(page);
  }
  // Import replaces the campaign before the asynchronous camp renderer arrives.
  // Let normal arrival complete before measuring whether later UI browsing
  // changes the save; the first live HUD records visiting the entrance.
  await page.waitForSelector('.rt-field[data-kind="camp"] .rt-scene[data-ready="true"]');
  await page.waitForFunction(()=>!document.querySelector('#modal[open]')&&window.__realtime?.world()?.tick>0);
  return page;
}
async function menuAndSettings(page,label){
  const original=await exported(page);
  assert.equal(JSON.parse(original).soldier.flags['visited:5:gate'],true,'The normal camp arrival is recorded before the settings baseline');
  await menuCommand(page,'menu');
  const menu=await metrics(page,'#modal .menu-links');fits(menu,`${label} menu`);
  assert.ok(menu.buttons<=7,`The main menu offers at most seven choices, including Resume: ${menu.buttons}`);
  assert.ok(menu.words<=90,`The main menu is a short scan: ${menu.words} words`);
  await screenshot(page,{path:`${output}${label}-menu.png`,fullPage:false});
  await page.locator('#modal [data-cmd="menu-section"][data-id="campaign"]').click();
  assert.ok(await page.locator('#modal [data-cmd="map"]:visible').count(),'Campaign map remains reachable');
  await page.locator('#modal .modal-back').click();await page.locator('#modal [data-cmd="settings"]').click();
  const categories=[];
  for(const id of ['general','controls','graphics','audio','saves']){
    await settingsPage(page,id);
    assert.equal(await page.locator('#modal [data-settings-page]:visible').count(),1,'Only the selected settings category is visible');
    assert.equal(await page.locator('#modal [data-cmd="settings-section"][aria-current="page"]').getAttribute('data-id'),id);
    assert.equal(await page.evaluate(()=>document.activeElement?.id),`settings-${id}-title`,'Category selection announces its heading');
    const measured=await metrics(page,'#modal');fits(measured,`${label} ${id}`);categories.push({id,...measured});
    if(id==='general')await screenshot(page,{path:`${output}${label}-settings.png`,fullPage:false});
    const unnamed=await page.locator(`#settings-${id}`).evaluate(section=>[...section.querySelectorAll('input,select')]
      .filter(el=>el.checkVisibility({checkVisibilityCSS:true})&&!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')).map(el=>el.id));
    assert.deepEqual(unnamed,[],`${id}: visible inputs have accessible names`);
    // Tab traverses actual rendered controls. Hidden category fields must never
    // capture focus, nor may the modal release focus to the running game.
    for(let n=0;n<12;n++){
      await page.keyboard.press('Tab');
      const focus=await page.evaluate(()=>{const e=document.activeElement;return {inModal:!!e?.closest('#modal'),tag:e?.tagName,id:e?.id,modalOpen:document.querySelector('#modal')?.open,hiddenPage:!!e?.closest('[data-settings-page][hidden]')};});
      // Native dialogs may hand Tab to browser chrome (activeElement=BODY).
      // Background game controls must remain inert throughout that cycle.
      assert.equal(focus.modalOpen,true,`${id}: Tab never closes the dialog`);
      assert.ok(focus.inModal||focus.tag==='BODY',`${id}: no focus reaches background game controls ${JSON.stringify(focus)}`);
      assert.equal(focus.hiddenPage,false,`${id}: hidden fields are skipped`);
    }
  }
  await (await revealControl(page,'#high-contrast')).check();
  await (await revealControl(page,'#text-size')).selectOption('1.25');
  await (await revealControl(page,'#motion-setting')).check();
  await settingsPage(page,'controls');await (await revealControl(page,'#pause-sighted')).check();
  await settingsPage(page,'audio');await (await revealControl(page,'#audio-setting')).uncheck();
  await close(page);
  const reloadStarted=Date.now(),reloadState=()=>page.evaluate(()=>({
    url:location.href,readyState:document.readyState,bodyClass:document.body.className,fonts:document.fonts.status,
    serviceWorker:navigator.serviceWorker?.controller?.state??null,
    app:{className:document.querySelector('#app')?.className??null,children:document.querySelector('#app')?.childElementCount??null,
      titlePage:!!document.querySelector('.title-hero'),campPage:!!document.querySelector('.camp-page'),openModal:!!document.querySelector('#modal[open]')},
    buttons:[...document.querySelectorAll('[data-cmd="continue"]')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {
      text:e.textContent,connected:e.isConnected,disabled:e.disabled,hidden:e.hidden,inert:e.inert,display:s.display,visibility:s.visibility,opacity:s.opacity,
      rect:{x:r.x,y:r.y,width:r.width,height:r.height}};}),
    resources:performance.getEntriesByType('resource').slice(-8).map(r=>({name:r.name,duration:r.duration,responseEnd:r.responseEnd})),
    text:document.body.innerText.slice(0,500)
  }));
  await page.reload();const afterReload=await reloadState();
  try{await page.locator('[data-cmd="continue"]:visible').first().click();}
  catch(error){await writeFile(`${output}${label}-reload-diagnostic.json`,JSON.stringify({elapsedMs:Date.now()-reloadStarted,afterReload,atFailure:await reloadState()},null,2)+'\n');throw error;}
  await page.waitForSelector('.camp-page');
  await menuCommand(page,'settings');
  assert.equal(await (await revealControl(page,'#high-contrast')).isChecked(),true);
  assert.equal(await (await revealControl(page,'#text-size')).inputValue(),'1.25');
  assert.equal(await (await revealControl(page,'#motion-setting')).isChecked(),true);
  assert.equal(await (await revealControl(page,'#pause-sighted')).isChecked(),true);
  assert.equal(await (await revealControl(page,'#audio-setting')).isChecked(),false);
  await settingsPage(page,'general');
  const contrast=await Promise.all(['#modal label[for="text-size"] > span','#modal label[for="high-contrast"] small'].map(selector=>textContrast(page,selector)));
  const enlarged=[];
  if(label==='phone'){
    await (await revealControl(page,'#text-size')).selectOption('2');
    const viewport=page.viewportSize();
    for(const width of [390,320]){
      await page.setViewportSize({...viewport,width});
      for(const id of ['general','controls','graphics','audio','saves']){
        await settingsPage(page,id);const measured=await verifyEnlargedSettingsGeometry(page);enlarged.push({id,...measured});
        if(id==='general')await screenshot(page,{path:`${output}${width===390?label:width+'px'}-settings-200percent.png`,fullPage:false});
      }
    }
    await page.setViewportSize(viewport);
  }
  await (await revealControl(page,'#text-size')).selectOption('1');await (await revealControl(page,'#pause-sighted')).uncheck();await close(page);
  const afterPreferences=await exported(page);
  if(afterPreferences!==original)await writeFile(`${output}${label}-preferences-save-diff.json`,JSON.stringify({before:JSON.parse(original),after:JSON.parse(afterPreferences)},null,2)+'\n');
  assert.equal(afterPreferences,original,'Browsing and changing preferences preserve the exact campaign save');
  record(`${label}: compact menu, five accessible settings categories, focus and persisted preferences`,{menu,categories,enlargedText:enlarged,contrast,saveUnchanged:true,saveSha256:createHash('sha256').update(original).digest('hex')});
}
async function helpAndSoldier(page,label){
  const original=await exported(page);
  if(label==='phone'){await menuCommand(page,'settings');await (await revealControl(page,'#text-size')).selectOption('2');await close(page);}
  await menuCommand(page,'help');
  const overview=await metrics(page,'#modal .guide-help');fits(await metrics(page,'#modal'),`${label} help`);
  assert.equal(await page.locator('.help-basics > li:visible').count(),3,'The overview teaches three basic actions');
  assert.ok(overview.words<=170,`Help starts with a short overview (${overview.words} words)`);
  assert.equal(await page.locator('.guide-index').getAttribute('open'),null,'The full guide is initially closed');
  await page.locator('#help-search').fill('saving');await page.locator('#help-search-results .help-search-result').first().waitFor({state:'visible'});
  assert.equal(await page.locator('#help-browse').isVisible(),false,'Search focuses the result list');
  const result=page.locator('#help-search-results .help-search-result').first(),resultTitle=await result.locator('strong').innerText();
  await result.click();assert.equal(await page.locator('#guide-page-title').innerText(),resultTitle);
  fits(await metrics(page,'#modal'),`${label} help article${label==='phone'?' at 200% text':''}`);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'guide-page-title','A result focuses the requested guide article');
  await page.locator('.help-home').click();await page.locator('#help-search').fill('unfindablexyz');
  assert.match(await page.locator('#help-search-results').innerText(),/No matching topics/);
  await page.locator('#help-search').fill('');await page.locator('.guide-index > summary').click();
  assert.equal(await page.locator('.guide-toc [data-cmd="help-section"]:visible').count(),14,'Every guide chapter remains reachable');
  await page.locator('.guide-toc [data-id="controls"]').click();assert.ok((await page.locator('.guide-page').innerText()).length>200);await close(page);
  if(label==='phone'){await menuCommand(page,'settings');await (await revealControl(page,'#text-size')).selectOption('1');await close(page);}
  await menuCommand(page,'menu');await page.locator('#modal [data-cmd="menu-section"][data-id="soldier"]').click();
  await page.locator('#modal [data-cmd="soldier-panel"][data-id="character"]').click();
  assert.equal(await page.locator('.attribute-table tbody tr').count(),8,'All attributes remain in Training');
  assert.equal(await page.locator('#known-techniques').getAttribute('open'),null);
  await page.locator('#known-techniques > summary').focus();await page.keyboard.press('Enter');
  assert.ok(await page.locator('#known-techniques li:visible').count()>3,'Full technique descriptions are available by keyboard');
  await page.locator('#training-costs > summary').click();assert.match(await page.locator('#training-costs').innerText(),/TP/);
  fits(await metrics(page,'#modal'),`${label} training details`);
  await page.locator('.soldier-sections [data-id="company"]').click();
  const details=page.locator('.company-panel details').first();assert.ok(await details.count(),'Companion details remain available');
  await details.locator(':scope > summary').click();assert.ok((await details.innerText()).includes('Combat'));
  fits(await metrics(page,'#modal'),`${label} company details`);await close(page);
  assert.equal(await exported(page),original,'Help and soldier inspection spend no resources or progress');
  record(`${label}: searchable concise help, all fourteen guide chapters and soldier details`,{overview,resultTitle,helpTextScale:label==='phone'?2:1,saveUnchanged:true});
}
async function saveConfirmation(page,label){
  const original=await exported(page);
  await menuCommand(page,'saves');await page.locator('#slot-name-1').fill('Usability checkpoint');
  await page.locator('[data-cmd="slot-save"][data-id="1"]').click();
  await page.waitForSelector('[data-cmd="slot-load"][data-id="1"]:not(:disabled)');await close(page);
  await (await revealControl(page,'[data-cmd="field-approach"][data-id="breach"]')).click();
  await page.waitForSelector('[data-cmd="field-approach"][data-id="breach"][aria-pressed="true"]');
  const changed=await exported(page);assert.notEqual(changed,original,'A legal preparation change distinguishes current progress from the saved slot');
  await menuCommand(page,'saves');await page.locator('[data-cmd="slot-load"][data-id="1"]').click();
  await page.locator('[data-cmd="confirm-slot"]').waitFor({state:'visible'});
  await page.locator('#modal [data-cmd="saves"]').click();await close(page);
  assert.equal(await exported(page),changed,'Cancelling Load preserves current progress exactly');
  await menuCommand(page,'saves');await page.locator('[data-cmd="slot-load"][data-id="1"]').click();
  await page.locator('[data-cmd="confirm-slot"]').click();await page.waitForSelector('#modal[open]',{state:'hidden'});await page.waitForSelector('.camp-page');
  assert.equal(await exported(page),original,'Confirming Load restores the exact selected campaign');
  record(`${label}: save slot requires confirmation; cancel preserves progress and confirm restores it`,{cancelUnchanged:true,restoredExactly:true});
}
async function fieldControls(page,label){
  await page.locator('[data-cmd="start"]:visible').first().click();await page.waitForSelector('.rt-field[data-kind="field"] .rt-scene[data-ready="true"]');await pause(page);
  const initial=await metrics(page,'.rt-field');fits(initial,`${label} compact field`);
  const geometry=await fieldGeometry(page,`${label} compact field`);
  const contrast=await Promise.all(['.rt-chronicle-bar .eyebrow','.rt-chronicle-bar .save-status'].map(selector=>textContrast(page,selector)));
  const primary=await page.locator('[data-role="abilityBar"] [data-ability]:visible').count();
  assert.ok(primary<=3,`At most three common ability buttons are initially visible (${primary})`);
  assert.equal(await page.locator('[data-role="missionDetails"]').getAttribute('open'),null);
  assert.equal(await page.locator('[data-role="controlOptions"]').getAttribute('open'),null);
  assert.equal(await page.locator('[data-role="logDetails"]').getAttribute('open'),null);
  assert.ok(initial.words<=260,`The initial field HUD stays concise (${initial.words} words)`);
  const clock=await tick(page);
  await (await revealControl(page,'[data-role="objective"]')).waitFor({state:'visible'});
  assert.ok((await page.locator('[data-role="objective"]').innerText()).length>10);
  await page.locator('[data-role="missionDetails"] [data-close-disclosure]').click();
  await (await revealControl(page,'[data-role="slowButton"]')).click();
  await page.waitForSelector('[data-role="slowButton"][aria-pressed="true"]');
  assert.equal(await page.locator('[data-role="slowButton"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-role="slowButton"]').click();
  await page.waitForSelector('[data-role="slowButton"][aria-pressed="false"]');
  assert.equal(await page.locator('[data-role="stepButton"]').isEnabled(),true,'Play one round is reachable while paused');
  fits(await metrics(page,'.rt-field'),`${label} expanded options`);
  await fieldGeometry(page,`${label} expanded options`);
  await page.locator('[data-role="timeControls"] [data-close-disclosure]').click();
  await page.locator('[data-role="controlOptions"] > .rt-detail-body > [data-close-disclosure]').click();
  const more=page.locator('[data-more-actions]'),advanced=more.locator('[data-ability]').first();
  assert.ok(await advanced.count(),'The legal Chapter V checkpoint offers advanced actions');
  const ability=await advanced.getAttribute('data-ability'),shortcut=await advanced.getAttribute('aria-keyshortcuts');
  assert.match(shortcut,/^[1-9]$/,'Advanced actions retain their numbered key');
  await page.locator('#rt-board').focus();await page.keyboard.press(`Digit${shortcut}`);
  await advanced.waitFor({state:'visible'});await page.waitForSelector(`[data-ability="${ability}"][aria-pressed="true"]`);assert.equal(await advanced.getAttribute('aria-pressed'),'true','The number shortcut opens and selects its advanced action');
  fits(await metrics(page,'.rt-field'),`${label} more actions`);
  await fieldGeometry(page,`${label} more actions`);
  await page.keyboard.press('KeyS');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.ability),ability,'S focuses the selected advanced action');
  await page.keyboard.press('Escape');assert.equal(await more.getAttribute('open'),null,'Escape closes the active disclosure');
  assert.equal(await more.locator('summary').evaluate(el=>el===document.activeElement),true,'Escape restores focus to the More actions summary');
  await more.locator('summary').focus();await page.keyboard.press('Enter');await advanced.click();
  await page.waitForSelector(`[data-ability="${ability}"][aria-pressed="true"]`);
  assert.equal(await advanced.getAttribute('aria-pressed'),'true','The same advanced ability is reachable by button');
  await more.locator('[data-close-disclosure]').click();
  await page.locator('[data-role="listButton"]').click();await page.locator('[data-role="commandList"]').waitFor({state:'visible'});
  assert.ok(await page.locator('[data-role="listOptions"] button:visible').count()>3,'All actions offers the full text alternative');
  await page.locator('[data-role="closeListButton"]').click();assert.equal(await page.locator('[data-role="commandList"]').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.role),'listButton','Closing All actions restores its opening control');
  assert.equal(await tick(page),clock,'Inspection and selection while paused spend no simulation time');
  await page.locator('[data-role="menuButton"]').click();await page.locator('#modal [data-cmd="menu-section"][data-id="campaign"]').click();
  await page.locator('#modal [data-cmd="retry"]').click();
  assert.equal(await page.locator('#modal [data-cmd="retry-confirm"]').isVisible(),true,'An active encounter offers a confirmed restart');
  const cancelled=page.locator('#modal').evaluate(modal=>new Promise(resolve=>modal.addEventListener('close',()=>resolve(),{once:true})));
  await page.getByRole('button',{name:'Keep playing',exact:true}).click();await cancelled;
  assert.equal(await tick(page),clock,'Cancelling a restart preserves the paused encounter');
  assert.equal(await paused(page),true);
  await page.locator('[data-role="menuButton"]').click();await page.locator('#modal [data-cmd="menu-section"][data-id="campaign"]').click();
  await page.locator('#modal .modal-back').click();assert.equal(await paused(page),true);
  await page.locator('#modal .menu-links [data-cmd="continue"]').click();await page.waitForSelector('#modal[open]',{state:'hidden'});
  assert.equal(await paused(page),true,'Resume closes the menu without cancelling a pre-existing pause');assert.equal(await tick(page),clock);
  await pause(page,false);await page.waitForFunction(t=>window.__realtime.world().tick>t,clock);
  await page.locator('[data-role="menuButton"]').click();await page.waitForFunction(()=>window.__realtime.paused());const stopped=await tick(page);
  await page.locator('#modal [data-cmd="settings"]').click();await settingsPage(page,'audio');await page.locator('#modal .modal-back').click();
  assert.equal(await tick(page),stopped,'Moving among menu pages preserves the menu pause');
  await page.locator('#modal .menu-links [data-cmd="continue"]').click();await page.waitForFunction(t=>window.__realtime.world().tick>t,stopped);await pause(page);
  record(`${label}: compact HUD, advanced actions by key and button, All actions, pause and resume`,{initial,geometry,contrast,primaryAbilities:primary,advancedAbility:ability,shortcut});
  await writeFile(`${output}report.json`,JSON.stringify(report,null,2)+'\n');
  console.log(`# ${label}: all field assertions passed; capturing the page`);
  await page.mouse.move(0,0);
  // Chromium's compositor can time out once after the repeated modal/canvas
  // transitions. The bounded capture helper retries the same unaltered page.
  await screenshot(page,{path:`${output}${label}-field.png`,fullPage:true});
}
async function campTransitions(){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  try{
    await page.goto(`${base}?dev`);await menuCommand(page,'settings');
    await (await revealControl(page,'#controls-model')).selectOption('realtime');await close(page);
    await menuCommand(page,'settings');await (await revealControl(page,'#battle-view')).selectOption('2d');
    await (await revealControl(page,'#graphics-quality')).selectOption('performance');await close(page);
    await page.locator('[data-cmd="new"]:visible').first().click();await page.locator('[data-cmd="begin"]').click();
    await page.waitForSelector('.rt-field[data-kind="camp"] .rt-scene[data-ready="true"]');
    if(await page.locator('#modal[open]').count())await close(page);
    await (await revealControl(page,'[data-cmd="conversation"][data-id="ch1:varro"]')).click();
    await page.waitForSelector('#modal [data-cmd="reply"]');await verifyCampPanelTransitions(page);
    record('Walkable camp: conversation to Menu permits saving; mission refresh preserves focus and Back remains Menu');
  }finally{await context.close();}
}
try{
  if(!only)await campTransitions();
  for(const viewport of [{width:390,height:844},{width:1280,height:900}].filter(v=>!only||v.width===(only==='phone-settings'?390:1280))){
    const label=viewport.width<600?'phone':'desktop',page=await setup(viewport);
    await menuAndSettings(page,label);
    if(only!=='phone-settings'){await helpAndSoldier(page,label);await saveConfirmation(page,label);await fieldControls(page,label);}
    await page.context().close();
  }
  assert.deepEqual(report.errors,[],'No browser page or console errors');
  assert.equal(JSON.parse(await readFile(`${root}build-report.json`,'utf8')).revision,build.revision,'The tested build remains unchanged');report.passed=true;
  console.log(`PASS: ${report.checks.length} usability flows; evidence: ${output}report.json`);
}catch(error){
  report.passed=false;report.failure=error.stack;
  for(const [i,context]of browser.contexts().entries())for(const [j,page]of context.pages().entries()){
    // Keep read-only evidence even when a compositor failure prevents capture.
    let diagnosticTimer;
    const diagnostic=await Promise.race([page.evaluate(()=>({url:location.href,readyState:document.readyState,visibility:document.visibilityState,fonts:document.fonts.status,
      focus:document.activeElement?.outerHTML?.slice(0,500),modal:document.querySelector('#modal')?.outerHTML?.slice(0,1200),
      phase:document.documentElement.dataset.phase,bodyText:document.body.innerText.slice(0,1400),
      menus:[...document.querySelectorAll('[data-cmd="menu"],[data-role="menuButton"]')].map(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);return {html:el.outerHTML,disabled:el.disabled,
        inert:!!el.closest('[inert]'),rect:{x:r.x,y:r.y,w:r.width,h:r.height},display:style.display,visibility:style.visibility,pointerEvents:style.pointerEvents,transform:style.transform};}),
      animations:document.getAnimations().map(a=>({state:a.playState,time:a.currentTime,target:a.effect?.target?.className})),
      field:document.querySelector('.rt-scene')?.outerHTML?.slice(0,500)})).catch(e=>({captureError:e.message})),
      new Promise(done=>{diagnosticTimer=setTimeout(()=>done({captureError:'The browser did not answer diagnostics within five seconds.'}),5000);})]);
    clearTimeout(diagnosticTimer);
    await writeFile(`${output}failure-${i}-${j}.json`,JSON.stringify(diagnostic,null,2)+'\n');
    await page.screenshot({path:`${output}failure-${i}-${j}.png`,fullPage:true,timeout:10000}).catch(()=>{});
  }
  throw error;
}finally{
  await writeFile(`${output}report.json`,JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(resolve=>server.close(resolve));
}
