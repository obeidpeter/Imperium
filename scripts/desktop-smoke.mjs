// npm run smoke:desktop: the desktop app for Steam (desktop/; docs/desktop.md) in Electron, driven through its visible
// interface by Playwright. Build first (npm run build:desktop) and install the app's packages (cd desktop && npm ci).
// On Linux without a display, run it under xvfb-run, as CI does.
//  1. The app opens on its own origin, app://imperium, with the bridge and without a service worker; the title page and
//     Settings speak of the installed game (no "Free browser play", no offline section, a Fullscreen setting).
//  2. New Game through the visible panel reaches the first camp, and the save is written as a file.
//  3. The Menu's Quit closes the app after the save.
//  4. Relaunched with only the save file (the profile's own storage deleted, as after a reinstall or on a second PC
//     through Steam Cloud), it offers to continue the same chronicle.
// No request may leave app://imperium (data: and blob: URLs are the page's own).
// PLAYWRIGHT_MODULE as for the other checks; SMOKE_CPU_THROTTLE slows the page as theirs do.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {existsSync,readFileSync,readdirSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isAbsolute,join} from 'node:path';
import {throttleCpu} from './ui-smoke-navigation.mjs';

let pw;
for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean))try{const m=await import(isAbsolute(p)?pathToFileURL(p).href:p);pw=m._electron?m:m.default;break;}catch{}
assert.ok(pw?._electron,'Set PLAYWRIGHT_MODULE to an installed Playwright.');
const desktopDir=fileURLToPath(new URL('../desktop/',import.meta.url)),gameDir=fileURLToPath(new URL('../dist-desktop/',import.meta.url));
const out=fileURLToPath(new URL('../tests/visual-results/desktop/',import.meta.url)),userData=join(out,'user-data');
// DESKTOP_APP=packaged drives the packaged app (npm run package:linux or package:win in desktop/), which serves the
// game from its own resources folder; otherwise the repository's Electron runs desktop/ on dist-desktop/.
// Chromium refuses to run as root with its sandbox (a container); everywhere else the sandbox stays on.
const packaged=process.env.DESKTOP_APP==='packaged',sandbox=process.getuid?.()===0?['--no-sandbox']:[];
assert.ok(packaged||existsSync(join(gameDir,'index.html')),'Build first: npm run build:desktop');
// Only the repository's Electron is needed (requiring it downloads its binary when it is missing).
let electronPath;if(!packaged)try{electronPath=createRequire(join(desktopDir,'package.json'))('electron');}catch{}
assert.ok(packaged||electronPath&&existsSync(electronPath),'Install the desktop app’s packages first: cd desktop && npm ci');
rmSync(out,{recursive:true,force:true});mkdirSync(userData,{recursive:true});

const packagedApp=join(desktopDir,'out',process.platform==='win32'?'win-unpacked/Imperium.exe':'linux-unpacked/imperium');
if(packaged)assert.ok(existsSync(packagedApp),`Package the app first: cd desktop && npm run package:${process.platform==='win32'?'win':'linux'}`);
const executable=packaged?packagedApp:electronPath,args=packaged?sandbox:[desktopDir,...sandbox];
const report={method:`Automated Electron (Playwright) on the ${packaged?'packaged app':'desktop build in the repository’s Electron'}, through the visible interface`,checks:[],requests:[],errors:[]};
const outside=url=>!/^(app:\/\/imperium\/|data:|blob:|about:blank|devtools:)/.test(url);
const env={...process.env,IMPERIUM_USER_DATA:userData,...(packaged?{}:{IMPERIUM_GAME_DIR:gameDir})};
async function launch(label){
  let app;
  try{app=await pw._electron.launch({executablePath:executable,args,env});}
  catch(error){
    // Playwright says only that the process failed to launch: run the app once by itself to show why (on Linux, often
    // Chromium's sandbox, when its setuid helper is not root-owned with mode 4755 and user namespaces are restricted).
    const run=spawnSync(executable,args,{env,encoding:'utf8',timeout:15000});
    const said=[run.error?.message,run.stdout,run.stderr].filter(Boolean).join('\n').split('\n').filter(line=>line.trim()).slice(-15).join('\n');
    throw new Error(`${label}: ${error.message}\nThe app, run by itself, said:\n${said||'(nothing)'}`);
  }
  const page=await app.firstWindow();page.setDefaultTimeout(60000);await throttleCpu(page);
  page.on('request',request=>{const url=request.url();if(outside(url))report.requests.push(`${label}: ${url}`);});
  page.on('pageerror',error=>report.errors.push(`${label}: ${error.message}`));
  await page.waitForSelector('main');
  return {app,page};
}
const closed=app=>new Promise(resolve=>app.process().once('exit',resolve));

try{
  // 1. The app's own origin, bridge and wording.
  {
    const {app,page}=await launch('first launch');
    const facts=await page.evaluate(async()=>({origin:location.origin,bridge:typeof window.imperiumDesktop?.saves?.write,
      workers:await Promise.resolve(navigator.serviceWorker?.getRegistrations?.()).then(list=>list?.length??0,()=>'unavailable'),footer:document.querySelector('.footer-version')?.textContent??'',
      manifest:!!document.querySelector('link[rel="manifest"]')}));
    assert.equal(facts.origin,'app://imperium');assert.equal(facts.bridge,'function');
    // The app's origin has no service workers at all (Chromium refuses them on it), which is stronger than none registered.
    assert.ok([0,'unavailable'].includes(facts.workers),'No service worker');
    assert.doesNotMatch(facts.footer,/browser/i);assert.equal(facts.manifest,false,'No install manifest');
    report.checks.push(`the app opens on app://imperium with its bridge, no service worker (${facts.workers===0?'none registered':'none possible on its origin'}) and no install manifest`);

    // Settings: a Window group with Fullscreen, and no offline section on the saves page.
    await page.locator('[data-cmd="settings"]').first().click();await page.locator('#modal[open]').waitFor();
    await page.locator('[data-cmd="settings-section"][data-id="graphics"]').click();
    const box=page.locator('#desktop-fullscreen');await box.waitFor();
    const before=await page.evaluate(()=>window.imperiumDesktop.window.isFullscreen());
    assert.equal(await box.isChecked(),before,'The setting shows the window’s state');
    await box.click();await page.waitForFunction(was=>window.imperiumDesktop.window.isFullscreen().then(now=>now!==was),before);
    await box.click();await page.waitForFunction(was=>window.imperiumDesktop.window.isFullscreen().then(now=>now===was),before);
    await page.locator('[data-cmd="settings-section"][data-id="saves"]').click();
    assert.equal(await page.locator('#settings-offline-status').count(),0,'No offline section');
    assert.match(await page.locator('#settings-saves').textContent(),/Progress saves on this computer/);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#modal[open]'));
    report.checks.push('Settings: Fullscreen follows and sets the window; the saves page has no offline section');

    // 2. New Game through the visible panel, to the first camp; the save is a file.
    await page.locator('[data-cmd="new"]').first().click();
    await page.locator('#modal [data-cmd="begin"]').click();
    await page.waitForFunction(()=>window.__realtime?.world()?.kind==='camp'||!!document.querySelector('.camp-page'),null,{timeout:180000});
    await page.waitForFunction(()=>/Chronicle saved/.test(document.querySelector('.save-status')?.textContent??''),null,{timeout:60000});
    const file=join(userData,'saves','campaign.json');assert.ok(existsSync(file),'The chronicle is a file');
    const envelope=JSON.parse(readFileSync(file,'utf8')),name=JSON.parse(envelope.payload).name;
    assert.equal(envelope.format,1);assert.ok(name,'The file holds the chronicle');
    report.checks.push(`New Game reaches the first camp, and the save is written to saves/campaign.json (${name})`);

    // 3. Quit from the Menu.
    await page.locator('[data-cmd="menu"]').first().click();await page.locator('#modal[open] [data-cmd="quit"]').click();
    await Promise.race([closed(app),new Promise((_,reject)=>setTimeout(()=>reject(new Error('The app did not close after Quit')),30000))]);
    report.checks.push('Quit to desktop closes the app');
    report.name=name;
  }
  // 4. Only the file left: the profile's own storage removed.
  for(const entry of readdirSync(userData))if(entry!=='saves')rmSync(join(userData,entry),{recursive:true,force:true});
  {
    const {app,page}=await launch('relaunch from the file');
    await page.locator('[data-cmd="continue"]').first().waitFor();
    assert.match(await page.locator('main').textContent(),new RegExp(report.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'The chronicle continues from its file');
    await page.screenshot({path:join(out,'relaunch.png')});
    report.checks.push('relaunched with only the save file, the title offers to continue the same chronicle');
    await app.close();
  }
  assert.deepEqual(report.requests,[],'No request leaves app://imperium');
  assert.deepEqual(report.errors,[],'No page errors');
}finally{writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
