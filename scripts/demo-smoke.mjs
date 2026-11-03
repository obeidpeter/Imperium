// npm run smoke:demo: the free web demo (the Steam plan, docs/steam-plan.md, S2) in headless Chromium, through its
// visible interface. Build first (npm run build:demo). Checkpoints are earned once under Node with legal commands from
// New Game (runRealtimeCampaign, which stops where the demo's rules refuse to advance); the page only restores them.
//  1. The title says it is the free demo of Chapters I–III, and its footer too.
//  2. A save code from Chapter IV, past the demo, is refused before it replaces anything.
//  3. Chapter III's promotion, restored from its code, is the End of the demo: no appointment to accept, the full game
//     named, and Keep a save code, whose code is the same chronicle.
// No request may fail: the demo asks for none of the files its build leaves out.
// PLAYWRIGHT_MODULE as for the other checks; SMOKE_CPU_THROTTLE slows the page as theirs do. --dist=DIR, --headed.
import assert from 'node:assert/strict';
import http from 'node:http';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveRequest} from './serve.mjs';
import {closedBy,throttleCpu} from './ui-smoke-navigation.mjs';
import {runRealtimeCampaign} from './realtime-autoplay.mjs';
import * as Game from '../src/core/game.js';
import {saveCode,restoreCode} from '../src/ui/storage.js';

const arg=(name,fallback)=>{const prefix=`--${name}=`,same=process.argv.find(a=>a.startsWith(prefix)),index=process.argv.indexOf(`--${name}`);return same?same.slice(prefix.length):index>=0?process.argv[index+1]:fallback;};
const dist=resolve(arg('dist',fileURLToPath(new URL('../dist-demo/',import.meta.url))));
const output=fileURLToPath(new URL('../tests/visual-results/demo/',import.meta.url));
await access(join(dist,'index.html')).catch(()=>{throw new Error('Build the demo first: npm run build:demo');});
const build=JSON.parse(await readFile(join(dist,'build-report.json'),'utf8'));
assert.equal(build.edition,'demo','This check is for the demo build');
let playwright;
for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){
  try{const m=await import(isAbsolute(specifier)?pathToFileURL(specifier).href:specifier);playwright=m.chromium?m:m.default;break;}catch{}
}
assert.ok(playwright?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright module.');

// Chapter III's promotion, where the demo's rules stop the campaign, and Chapter IV's camp beyond it (the full game's
// advance, a legal command on a copy).
const earned=runRealtimeCampaign({throughChapter:3,lastChapter:build.lastChapter,seed:275}),promotion=earned.state;
assert.equal(promotion.phase,'promotion');assert.equal(promotion.chapter,build.lastChapter);
const beyond=Game.deserialize(Game.serialize(promotion));assert.ok(Game.advanceChapter(beyond).ok);assert.equal(beyond.chapter,build.lastChapter+1);
const promotionCode=await saveCode(promotion),beyondCode=await saveCode(beyond);

await mkdir(output,{recursive:true});
const server=http.createServer((req,res)=>serveRequest(req,res,dist));
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await playwright.chromium.launch({headless:!process.argv.includes('--headed'),executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const report={method:'Automated Chromium on the demo build through the visible interface; checkpoints earned under Node with legal commands from New Game',
  build:build.revision,edition:build.edition,lastChapter:build.lastChapter,omittedFiles:build.omittedFiles,physicalDeviceTest:false,
  checkpoint:{seed:275,promotion:{chapter:promotion.chapter,phase:promotion.phase},encounters:earned.encounters.map(e=>({id:e.id,status:e.status}))},checks:[],failedRequests:[],errors:[]};
const record=(name,detail={})=>{report.checks.push({name,...detail});console.log(`ok - ${name}`);};
try{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();await throttleCpu(page);
  page.setDefaultTimeout(60000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('requestfailed',request=>report.failedRequests.push(`${request.url()} (${request.failure()?.errorText})`));
  page.on('response',response=>{if(response.status()>=400)report.failedRequests.push(`${response.url()} (${response.status()})`);});
  await page.goto(base);await page.waitForSelector('main');

  // 1. The title and footer.
  assert.match(await page.locator('.hero-kicker').textContent(),/FREE DEMO · CHAPTERS I–III OF XII/);
  assert.match(await page.locator('.landing-facts').textContent(),/Free demo\s*Chapters I–III of 12/);
  assert.match(await page.locator('.footer-version').textContent(),/Free demo/);
  assert.match(await page.title(),/Free demo/);
  record('the title page and footer say it is the free demo of Chapters I–III');

  async function validate(code){
    await page.locator('.hero-restore, [data-cmd="restore"]').first().click();await page.locator('#modal[open] #restore-code').waitFor();
    await page.locator('#restore-code').fill(code);await page.locator('#modal [data-cmd="import-code"]').click();
  }
  // 2. A code past the demo is refused before the confirmation.
  await validate(beyondCode);
  await page.waitForFunction(()=>/past the end of the demo/.test(document.querySelector('#modal .modal-feedback')?.textContent??''));
  assert.match(await page.locator('#modal .modal-feedback').textContent(),/reached Chapter IV, past the end of the demo with Chapter III\. Continue it in the full game\./);
  assert.equal(await page.locator('[data-cmd="confirm-import"]').count(),0,'Nothing to confirm');
  await closedBy(page,()=>page.locator('#modal .modal-close').click());
  assert.equal(await page.locator('[data-cmd="new"]').count()>0,true,'the title still has no chronicle');
  record('a Chapter IV save code is refused before it replaces anything');

  // 3. Chapter III's promotion is the End of the demo.
  await validate(promotionCode);
  await page.locator('[data-cmd="confirm-import"]').waitFor({state:'visible'});
  await closedBy(page,()=>page.locator('[data-cmd="confirm-import"]').click());
  await page.locator('#demo-end-title').waitFor();
  const end=await page.locator('.demo-end').textContent();
  assert.match(end,/END OF THE DEMO/);assert.match(end,/Chapters IV to XII take your soldier/);
  assert.ok(/The full game is coming to Steam\./.test(end)||await page.locator('.demo-store').count()===1,'the full game is named');
  assert.equal(await page.locator('[data-cmd="advance"]').count(),0,'No appointment to accept in the demo');
  await page.locator('.ceremony-advance').scrollIntoViewIfNeeded();await page.locator('.ceremony-advance').screenshot({path:join(output,'end-of-demo.png')});
  await page.locator('.demo-end [data-cmd="export"]').click();await page.locator('#modal[open] #save-code').waitFor();
  const kept=await restoreCode(await page.locator('#save-code').inputValue());
  assert.equal(Game.serialize(kept),Game.serialize(promotion),'The kept code is the same chronicle, ready for the full game');
  const full=Game.deserialize(Game.serialize(kept));assert.ok(Game.advanceChapter(full).ok);assert.equal(full.chapter,4);
  record('Chapter III’s promotion is the End of the demo; Keep a save code gives the same chronicle, which the full game advances');

  assert.deepEqual(report.failedRequests,[],'No request failed: the demo asks for nothing its build left out');
  assert.deepEqual(report.errors,[],'No page errors');
  record('no request failed and no page error');
}finally{
  await browser.close();server.close();
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({checks:report.checks.length,failedRequests:report.failedRequests.length,errors:report.errors.length}));
