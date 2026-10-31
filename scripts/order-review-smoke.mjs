// Production Chromium regression: legal Chapter V start/result checkpoints,
// actual UI commands, no browser world mutation. Build first; Playwright is an
// external test tool, selected through PLAYWRIGHT_MODULE/EXECUTABLE_PATH.
import assert from 'node:assert/strict';
import http from 'node:http';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveRequest} from './serve.mjs';
import {closePanel,menuCommand,revealControl} from './ui-smoke-navigation.mjs';
import {playRealtime,runRealtimeCampaign} from './realtime-autoplay.mjs';
import * as Game from '../src/core/game.js';
import {step} from '../src/core/realtime/simulation.js';
import {realtimeDebrief} from '../src/ui/realtime-debrief.js';

const root=fileURLToPath(new URL('../dist/',import.meta.url)),output=fileURLToPath(new URL('../tests/visual-results/order-review/',import.meta.url));
await access(`${root}index.html`);const build=JSON.parse(await readFile(`${root}build-report.json`,'utf8')).revision;
let playwright;for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){
  try{const m=await import(isAbsolute(specifier)?pathToFileURL(specifier).href:specifier);playwright=m.chromium?m:m.default;break;}catch{}
}
assert.ok(playwright?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright module.');
const codes={},stop=new Error('Chapter V result earned'),encounters=[];
try{runRealtimeCampaign({throughChapter:5,ready:[1,2,3,4,5],retries:2,
  play(state,options){if(state.encounter.id==='ch5-mine'&&!codes.start)codes.start=Game.encodeSave(state);return playRealtime(state,options);},
  onEncounter(state,summary){encounters.push({id:state.encounter.id,status:summary.status,tries:summary.tries});
    if(state.encounter.id==='ch5-mine'&&summary.status==='won'){codes.won=Game.encodeSave(state);throw stop;}}
});}catch(error){if(error!==stop)throw error;}
assert.ok(codes.start&&codes.won,'New Game legally reaches and wins Chapter V.');
// A real failure, obtained by waiting without issuing commands, never by
// changing an objective, health, status, position or campaign flag.
const failure=Game.decodeSave(codes.start),failedWorld=Game.realtimeWorld(failure);
for(let n=0;n<12000&&failedWorld.status==='active';n++)step(failedWorld);
assert.equal(failedWorld.status,'lost');assert.ok(Game.saveRealtime(failure,failedWorld).ok);codes.lost=Game.encodeSave(failure);
await mkdir(output,{recursive:true});
const server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`,errors=[],report={build,kind:'Automated Chromium; public commands and earned checkpoints; no injected browser state',encounters,checks:[]};
let browser;
const record=name=>{report.checks.push({name,pass:true});console.log(`ok - ${name}`);};
async function restore(code,viewport){
  const context=await browser.newContext({viewport}),page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${base}?dev`);await menuCommand(page,'settings');await (await revealControl(page,'#controls-model')).selectOption('realtime');await closePanel(page);
  await menuCommand(page,'settings');await (await revealControl(page,'#battle-view')).selectOption('2d');await (await revealControl(page,'#graphics-quality')).selectOption('performance');
  for(const id of ['pause-sighted','pause-hurt','pause-squad','pause-objective','pause-order'])await (await revealControl(page,`#${id}`)).uncheck();
  if(viewport.width===390)await (await revealControl(page,'#text-size')).selectOption('2');
  await (await revealControl(page,'#modal [data-cmd="restore"]')).click();await page.fill('#restore-code',code);await page.click('[data-cmd="import-code"]');await page.click('[data-cmd="confirm-import"]');
  return page;
}
try{
  browser=await playwright.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  report.browser=browser.version();
  for(const width of [1280,390]){
    const page=await restore(codes.start,{width,height:900});await page.waitForSelector('.rt-scene[data-ready="true"]');
    if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
    await page.waitForFunction(()=>window.__realtime.paused());
    const friendly=await page.evaluate(()=>window.__realtime.world().squads.filter(s=>s.side!=='enemy').map(s=>s.id));
    assert.ok(friendly.length>=2);const [squad,other]=friendly;
    for(const id of [squad,other]){await page.locator(`.rt-standard[data-squad="${id}"]`).click();await page.keyboard.press('Digit1');}
    const before=await page.evaluate(()=>JSON.stringify(window.__realtime.world())),reserved=JSON.parse(before).command.left;
    await page.locator('[data-role="orderReviewButton"]').click();await page.locator('[data-role="orderReview"]').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__realtime.world())),before,'Reading the review changes no world state');
    const row=page.locator(`[data-review-squad="${squad}"]`);assert.match(await row.textContent(),/Queued.*Hold/s);
    assert.equal(await page.locator('[data-review-squad]').count(),friendly.length,'Every friendly squad is represented');
    assert.match(await page.locator(`[data-review-squad="${other}"]`).textContent(),/Queued.*Hold/s);
    await row.locator('[data-review-action="cancel"]').click();assert.equal(await page.evaluate(()=>window.__realtime.world().command.left),reserved+1);
    assert.deepEqual(await page.evaluate(()=>window.__realtime.world().queue.filter(q=>q.kind==='order').flatMap(q=>q.payload.squads)),[other],'The other squad keeps its queued order');
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.reviewAction),'replace','Cancellation preserves actionable keyboard focus');
    await row.locator('[data-review-action="replace"]').click();await page.locator('[data-role="commandList"]').waitFor({state:'visible'});
    assert.equal(await page.locator('input[name="rt-list-actor"]:checked').inputValue(),squad,'Replace selects the correct squad');
    const advance=page.locator('[data-role="listOptions"] li').filter({hasText:'Advance to the objective marker'}).first();
    await advance.getByRole('button',{name:'Use',exact:true}).click();await page.locator('[data-role="closeListButton"]').click();
    await page.locator('[data-role="orderReviewButton"]').click();assert.match(await row.textContent(),/Advance.*Position/s);
    await row.locator('[data-review-action="hold"]').click();assert.match(await row.textContent(),/Queued.*Hold/s);
    const focus=await page.evaluate(()=>{
      const active=document.activeElement,skip=document.querySelector('a.skip'),rect=skip?.getBoundingClientRect();
      return {tag:active?.tagName,action:active?.dataset.reviewAction,squad:active?.dataset.squad,
        skip:rect?{focused:active===skip,top:rect.top,bottom:rect.bottom}:null};
    });
    assert.deepEqual({tag:focus.tag,action:focus.action,squad:focus.squad},{tag:'BUTTON',action:'hold',squad},'Hold keeps keyboard focus on the same squad’s refreshed Hold button');
    assert.ok(focus.skip&&!focus.skip.focused&&focus.skip.bottom<=0,'The unfocused skip link remains entirely above the visible viewport');
    const geometry=await page.evaluate(()=>{
      const panel=document.querySelector('[data-role="orderReview"]').getBoundingClientRect(),canvas=document.querySelector('#rt-board').getBoundingClientRect();
      const labels=[...document.querySelectorAll('.rt-order-row dt,[data-role="closeOrderReview"]')].map(el=>{
        const words=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;
        while(node=walker.nextNode())for(const match of node.textContent.matchAll(/\S+/g)){
          const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
          words.push({text:match[0],lines:new Set([...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>Math.round(r.top*2)/2)).size});
        }
        return {text:el.textContent.trim(),words,overflow:el.scrollWidth>el.clientWidth+1};
      });
      return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,panelTop:panel.top,canvasBottom:canvas.bottom,labels,buttons:[...document.querySelectorAll('[data-review-action]')].map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})};
    });
    assert.ok(geometry.documentWidth<=width+1,'No horizontal overflow, including 200% text on phone');assert.ok(geometry.panelTop>=geometry.canvasBottom-1,'Order review does not cover the battlefield');
    assert.ok(geometry.buttons.every(b=>b.left>=0&&b.right<=width&&b.height>=44),'Actionable touch-sized review controls');
    assert.deepEqual(geometry.labels.map(l=>l.text).sort(),[...friendly.flatMap(()=>['Formation','Starts','Command']),'Close'].sort(),'Every order field and the short Close label are present');
    assert.ok(geometry.labels.every(l=>!l.overflow&&l.words.length&&l.words.every(w=>w.lines===1)),`Labels remain whole words at ${width}px: ${JSON.stringify(geometry.labels)}`);
    (report.focusAndLayout??=[]).push({width,focus,labels:geometry.labels});
    // Chromium's tall-element capture can paint fixed elements that sit above
    // the viewport into the middle of its extended clip. Keep the real viewport
    // alongside it, and prove the skip link is offscreen rather than masking it.
    await page.screenshot({path:`${output}orders-${width}-viewport.png`});
    await page.locator('[data-role="orderReview"]').screenshot({path:`${output}orders-${width}.png`});
    await page.keyboard.press('KeyP');await page.waitForFunction(()=>!window.__realtime.paused());await page.locator('[data-role="orderReview"]').waitFor({state:'hidden'});
    await page.waitForFunction(id=>window.__realtime.world().squads.find(s=>s.id===id)?.order?.kind==='hold',squad);
    record(`${width}px: multi-squad paused review, cancellation/refund, replacement target, Hold applied, focus and layout`);await page.context().close();
  }
  for(const status of ['won','lost']){
    const state=Game.decodeSave(codes[status]),expected=realtimeDebrief(Game.realtimeWorld(state));
    const page=await restore(codes[status],{width:1280,height:900});await page.locator('.rt-result').waitFor({state:'visible'});
    assert.deepEqual(await page.locator('.rt-debrief li p').allTextContents(),expected.moments.map(m=>m.text),'The result quotes actual retained events');
    assert.ok(expected.moments.length>0&&expected.moments.length<=3);if(status==='lost'){
      await page.locator('.rt-retry-help summary').click();assert.equal(await page.locator('.rt-defeat-help').textContent(),expected.advice);
      const retryState=()=>page.evaluate(()=>{const world=window.__realtime.world();return {
        encounterId:world?.encounterId,status:world?.status,tick:world?.tick,paused:window.__realtime.paused(),
        result:!!document.querySelector('.rt-result'),ready:!!document.querySelector('.rt-scene[data-ready="true"]'),
        saveStatus:[...document.querySelectorAll('.save-status')].map(el=>el.textContent.trim())
      };});
      const endedWorld=await page.evaluateHandle(()=>window.__realtime.world());report.retry={before:await retryState()};
      try{
        assert.equal(report.retry.before.status,'lost');
        await page.getByRole('button',{name:'Retry battle',exact:true}).click();
        // Retry persists before loading the new world into the existing ready
        // scene. Its old ready attribute alone does not mark that transition.
        await page.waitForFunction(previous=>{const world=window.__realtime?.world();return world&&world!==previous&&world.status==='active'
          &&!document.querySelector('.rt-result')&&!!document.querySelector('.rt-scene[data-ready="true"]');},endedWorld);
        if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
        await page.waitForFunction(()=>window.__realtime.paused()&&document.querySelector('[data-role="pauseButton"]')?.getAttribute('aria-pressed')==='true');
        const after=await retryState();assert.equal(after.status,'active');assert.equal(after.encounterId,state.encounter.id);
        assert.ok(after.tick<report.retry.before.tick,'Retry restores the encounter checkpoint instead of retaining the ended world');
        assert.equal(after.paused,true);assert.equal(after.result,false);assert.equal(after.ready,true);
      }finally{report.retry.after=await retryState();await endedWorld.dispose();}
    }else assert.equal(await page.locator('.rt-result [data-cmd="commit"]').count(),1);
    record(`${status}: recorded debrief and ${status==='lost'?'specific retry advice and legal Retry':'unchanged Continue flow'}`);await page.context().close();
  }
  assert.deepEqual(errors,[]);assert.equal(JSON.parse(await readFile(`${root}build-report.json`,'utf8')).revision,build);report.passed=true;
}catch(error){report.passed=false;report.error=error.stack;throw error;}
finally{report.errors=errors;await writeFile(`${output}report.json`,JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(resolve=>server.close(resolve));}
