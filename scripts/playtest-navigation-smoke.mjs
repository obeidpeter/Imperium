// Automated Chromium regression: ordinary New Game, controls and walking only.
// Runtime inspection is read-only; no saves, progress or positions are injected.
import assert from 'node:assert/strict';
import http from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isAbsolute} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {serveRequest} from './serve.mjs';
import {menuCommand,revealControl,closePanel,openCampList,throttleCpu} from './ui-smoke-navigation.mjs';
let pw;
for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean))try{const m=await import(isAbsolute(p)?pathToFileURL(p).href:p);pw=m.chromium?m:m.default;break;}catch{}
assert.ok(pw?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright.');
const root=fileURLToPath(new URL('../dist/',import.meta.url)),out=fileURLToPath(new URL('../tests/visual-results/playtest-navigation/',import.meta.url));
await mkdir(out,{recursive:true});
const server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await pw.chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined});
const report={method:'Automated Chromium, UI New Game and legal walking, no state injection',checks:[],errors:[]};
try{
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:850}}),page=await context.newPage();await throttleCpu(page);page.setDefaultTimeout(45000);
    page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?dev`);
    await menuCommand(page,'settings');await (await revealControl(page,'#battle-view')).selectOption('2d');await closePanel(page);
    await page.locator('[data-cmd="new"]').first().click();
    assert.equal(await page.locator('.recruit-customize').getAttribute('open'),null,'Optional customization starts folded');
    assert.equal(await page.locator('input[name="recruit-path"][value="legionary"]').isChecked(),true);
    await page.locator('[data-cmd="begin"]').click();
    await page.waitForFunction(()=>window.__realtime?.world()?.kind==='camp');
    assert.match(await page.locator('[data-cmd="camp-next"]').first().textContent(),/commander/);
    await openCampList(page);
    // The Services sheet covers the scene's panel buttons. Its ordinary map
    // shortcut remains available, without clicking through that sheet.
    await page.locator('#camp-services').focus();await page.keyboard.press('KeyM');
    await page.locator('.camp-navigation-map').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-cmd="camp-walk"]').count(),7);
    assert.equal(await page.locator('[data-cmd="camp-walk"][disabled]').count(),0,'Unvisited destinations are walkable');
    assert.ok(await page.locator('[data-cmd="camp-travel"][disabled]').count()>0,'Fast travel still requires discovery');
    if(width<600){
      const routes=await page.locator('.camp-route-actions button').evaluateAll(buttons=>buttons.map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})));
      assert.ok(routes.every(b=>b.width>=120&&b.height>=44),'Phone route buttons have readable labels and comfortable targets');
    }
    await page.screenshot({path:out+`map-${width}.png`});
    const start=await page.evaluate(()=>{const w=window.__realtime.world(),a=w.actors.find(a=>a.id===w.heroId);return {x:a.x,z:a.z};});
    await page.locator('#modal [data-cmd="camp-next"]').click();
    await page.waitForFunction(()=>!document.querySelector('main[data-overlay="services"]'));
    await page.waitForFunction(p=>{const w=window.__realtime.world(),a=w.actors.find(a=>a.id===w.heroId);return Math.hypot(a.x-p.x,a.z-p.z)>1;},start);
    await page.waitForFunction(()=>document.querySelector('#modal[open][data-conversation="table"]'));
    // The last step (the owner's choice after #65): Show me the way walks to the way out and stops short of its post;
    // the player uses it. The decision is made at the table, as a player makes it.
    await page.locator('#modal [data-cmd="reply"][data-id="0"]').click();
    await page.waitForFunction(()=>!document.querySelector('#modal[open]'));
    await page.waitForFunction(()=>!/Saving/.test(document.querySelector('.save-status')?.textContent??''),null,{timeout:30000});
    await page.locator('#rt-board').focus();await page.keyboard.press('KeyM');
    await page.locator('.camp-navigation-map').waitFor({state:'visible'});
    assert.match(await page.locator('#modal .camp-next-task strong').textContent(),/drill yard/i,'After the decision, the next step is the way out');
    const exit=await page.evaluate(()=>{const w=window.__realtime.world(),e=w.objects.find(o=>o.kind==='exit');return {at:e.at??null,x:e.x,z:e.z};});
    await page.locator('#modal [data-cmd="camp-next"]').click();
    await page.waitForFunction(()=>!document.querySelector('#modal[open]'));
    await page.waitForFunction(e=>{const w=window.__realtime.world(),a=w.actors.find(a=>a.id===w.heroId);return Math.hypot(a.x-e.x,a.z-e.z)<=2&&!a.moving;},exit,{timeout:90000});
    // A use would follow his arrival within its 0.3 s: wait two seconds of the camp's own time, or for the camp to go.
    const arrived=await page.evaluate(()=>window.__realtime.world().tick);
    await page.waitForFunction(t=>{const w=window.__realtime?.world?.();return !w||w.kind!=='camp'||w.tick>=t+40;},arrived,{timeout:60000});
    const after=await page.evaluate(()=>{const w=window.__realtime?.world?.(),e=w?.objects?.find(o=>o.kind==='exit');return {kind:w?.kind??null,at:e?.at??null,phase:document.querySelector('.rt-field')?.dataset.kind??null};});
    assert.equal(after.kind,'camp','Show me the way at the last step stays in camp');assert.equal(after.phase,'camp');
    assert.deepEqual(after.at,exit.at,'The way out is walked to, not used for the player');
    report.checks.push(`${width}px: compact setup, spatial map, undiscovered routes, Services overlay clears, legal walk to required decision, walk to the way out without using it`);
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
}finally{await writeFile(out+'report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify(report,null,2));
