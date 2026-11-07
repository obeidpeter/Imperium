// Real IndexedDB regressions use isolated test namespaces. Layout checkpoints
// are earned by legal commands and restored through the visible interface.
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isAbsolute,join} from 'node:path';
import {serveRequest} from './serve.mjs';
import {earnMoments,SCREENSHOTS} from './steam-screenshots.mjs';
import {settingsCommand,closedBy,fieldPanel} from './ui-smoke-navigation.mjs';

const root=fileURLToPath(new URL('../dist/',import.meta.url)),out=fileURLToPath(new URL('../tests/visual-results/recovery-readability/',import.meta.url));
await access(join(root,'index.html'));await mkdir(out,{recursive:true});
let pw;for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean))try{const m=await import(isAbsolute(p)?pathToFileURL(p).href:p);pw=m.chromium?m:m.default;break;}catch{}
assert.ok(pw?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright.');
const server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await pw.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const base=`http://127.0.0.1:${server.address().port}`,report={method:'Automated Chromium: native browser storage, injected archive-write failure, legally earned UI checkpoints; no physical-device playtest',
  browser:browser.version(),build:JSON.parse(await readFile(join(root,'build-report.json'),'utf8')).revision,started:new Date().toISOString(),passed:false,checks:[]};
let activePage;
try{
  const page=await browser.newPage();page.on('console',m=>{if(m.type()==='log')console.log(`Storage: ${m.text()}`);});await page.goto(base+'/icon.svg');
  console.log('Checking native save recovery.');
  const storage=await page.evaluate(async()=>{
    const {createSaveStore}=await import('/src/ui/storage.js'),{newGame}=await import('/src/core/game.js');
    const broken='{"format":999,"payload":"damaged test save"}',checks=[];
    const namespace='imperium-test.recovery.native';
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(namespace,1);r.onupgradeneeded=()=>r.result.createObjectStore('saves');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(broken,'campaign');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
    const store=createSaveStore({namespace,BroadcastChannel:null});await store.loadLocal();await store.saveLocal(newGame('Native repair'));
    console.log('Native IndexedDB save completed.');
    checks.push({name:'native IndexedDB repair',saved:(await store.loadLocal()).state.name==='Native repair',preserved:await store.readUnreadableSave(0)===broken});
    // The player's discard after downloading (Settings → Saves): the archived copy goes from the native database, the chronicle stays.
    const [kept]=await store.listUnreadableSaves(),removed=await store.discardUnreadableSave(kept.checksum);
    checks.push({name:'native discard after download',saved:(await store.loadLocal()).state.name==='Native repair',discarded:removed>=1&&(await store.listUnreadableSaves()).length===0});await store.close();
    const largeSpace='imperium-test.recovery.large',large=JSON.stringify({format:999,payload:'x'.repeat(1500000)});localStorage.setItem(largeSpace,large);
    const largeStore=createSaveStore({namespace:largeSpace,BroadcastChannel:null});await largeStore.loadLocal();await largeStore.saveLocal(newGame('Large repair'));
    console.log('Oversized local save archived.');
    checks.push({name:'large local record archived in IndexedDB',saved:(await largeStore.loadLocal()).state.name==='Large repair',preserved:await largeStore.readUnreadableSave(0)===large});await largeStore.close();
    const quotaSpace='imperium-test.recovery.quota',values=new Map([[quotaSpace,broken]]);
    const local={getItem:k=>values.get(k)??null,setItem(k,v){if(k.endsWith('.unreadable'))throw new DOMException('Injected quota failure','QuotaExceededError');values.set(k,v);}};
    const quota=createSaveStore({namespace:quotaSpace,indexedDB:null,localStorage:local,navigator,BroadcastChannel:null});let refused=false;
    try{await quota.saveLocal(newGame('Must not replace'));}catch(e){refused=e.code==='SAVE_UNAVAILABLE';}
    checks.push({name:'archive failure refuses replacement',refused,preserved:values.get(quotaSpace)===broken});await quota.close();return checks;
  });
  for(const check of storage){assert.equal(check.preserved??check.discarded,true,check.name);assert.equal(check.saved??check.refused,true,check.name);}report.checks.push(...storage);await page.close();
  console.log('Earning equipment and promotion checkpoints.');
  const moments=earnMoments(SCREENSHOTS.filter(s=>['06-kit','07-promotion'].includes(s.id)));
  for(const moment of moments){
    console.log(`Checking ${moment.shot.id}.`);
    const context=await browser.newContext({viewport:{width:1920,height:1080}}),p=await context.newPage();activePage=p;p.setDefaultTimeout(120000);const errors=[];p.on('pageerror',e=>errors.push(String(e)));
    await p.addInitScript(()=>localStorage.setItem('sacramentum.settings',JSON.stringify({controlsModel:'realtime',controlsChosen:true,quality:'performance',qualityChoice:'performance',coach:false,reducedMotion:true})));
    await p.goto(base);await settingsCommand(p,'restore');await p.fill('#restore-code',moment.code);await p.click('[data-cmd="import-code"]');await closedBy(p,()=>p.click('[data-cmd="confirm-import"]'));
    const promotion=moment.shot.id==='07-promotion';
    if(promotion)await p.waitForSelector('#promotion-title');
    else{
      await p.waitForSelector('.rt-field[data-kind="camp"] .rt-scene[data-ready="true"]');
      await fieldPanel(p,'kit');await p.waitForSelector('#modal[open] .inventory');
    }
    for(const viewport of [{width:1920,height:1080},{width:1280,height:720},{width:390,height:844}]){
      await p.setViewportSize(viewport);
      if(promotion){
        const turn=p.locator('.ceremony-portrait [data-preview-turn="1"]');await turn.scrollIntoViewIfNeeded();
        const clear=await turn.evaluate(button=>{const r=button.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return button===top||button.contains(top);});
        assert.equal(clear,true,`turn right is unobstructed at ${viewport.width}`);await turn.click();
      }else{
        const geometry=await p.locator('.inventory').evaluate(el=>{const canvas=el.querySelector('canvas'),r=canvas?.getBoundingClientRect();return {width:document.documentElement.scrollWidth,canvas:r?{width:r.width,height:r.height}:null};});
        assert.ok(geometry.width<=viewport.width+1,'inventory fits the viewport');
        if(viewport.width===1920){assert.ok(geometry.canvas.width>=300,'wide preview');assert.ok(geometry.canvas.height>=450,'tall preview');}
      }
      report.checks.push({name:promotion?'promotion turn button':'equipment layout',viewport,passed:true});
      if(viewport.width===1920){
        await p.waitForFunction(()=>[...document.querySelectorAll('[data-preview-status]')].every(e=>!e.offsetParent||!/^Preparing/.test(e.textContent)));
        await p.screenshot({path:join(out,promotion?'promotion.png':'equipment.png')});
      }
    }
    assert.deepEqual(errors,[],'no page errors');await context.close();
  }
  report.passed=true;console.log(`Recovery/readability: ${report.checks.length} checks passed.`);
}catch(error){
  report.error=error.stack||String(error);
  if(activePage)await activePage.screenshot({path:join(out,'failure.png'),timeout:30000}).catch(()=>{});
  throw error;
}finally{report.completed=new Date().toISOString();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();server.close();}
