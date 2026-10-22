// Measures the 0.40 Phase 0 real-time arena in headless Chromium: start-up,
// click-to-first-movement (in milliseconds and in frames), the arena's own
// performance check (15 fighting men drawn for 12 s, and the tick timed
// headless at 15 and 82 men) and whole fights won by one click per raider,
// given through the page's own command queue. Development only; it needs
// Playwright like npm run smoke. Software rendering inflates every frame
// time; the frame and tick counts are real.
//
//   node scripts/arena-benchmark.mjs [--dist] [--quality=performance] [--fights=3] [--write]
//   (--write saves docs/evidence/arena-phase0.json)
import http from 'node:http';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {serveRequest} from './serve.mjs';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const dist=process.argv.includes('--dist'),quality=arg('quality','performance'),fights=Number(arg('fights',3)),write=process.argv.includes('--write');
const root=fileURLToPath(new URL(dist?'../dist/':'../',import.meta.url));
async function playwright(){
  for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){try{const m=await import(specifier);return m.chromium?m:m.default;}catch{}}
  console.error('Playwright is not installed. Install it separately or set PLAYWRIGHT_MODULE.');process.exit(2);
}
const server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}/`,{chromium}=await playwright();
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.setDefaultTimeout(600000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(q=>{try{localStorage.setItem('imperium.arena',JSON.stringify({quality:q}));}catch{}},quality);
const t0=Date.now();await page.goto(`${base}showcase/arena.html`);await page.waitForSelector('#scene[data-ready="true"]');const readyMs=Date.now()-t0;
await page.click('#begin-button');
// Clicks on open ground, each waited for until the soldier moves.
const box=await page.locator('#scene').boundingBox();
for(const [fx,fy]of [[.58,.42],[.4,.5],[.62,.5],[.45,.38],[.55,.55]]){
  const measured=await page.evaluate(()=>window.__arena.metrics.clicks.length);
  await page.mouse.move(box.x+box.width*fx,box.y+box.height*fy);await page.mouse.down();await page.mouse.up();
  // Each click is measured once its first movement has been drawn; a ground click that is blocked or too short is skipped.
  await page.waitForFunction(n=>window.__arena.metrics.clicks.length>n,measured,{timeout:30000}).catch(()=>{});
}
const input=await page.evaluate(()=>({clickToMovementMs:window.__arena.metrics.clicks,clickToMovementFrames:window.__arena.metrics.clickFrames}));
// Whole fights: one click per raider, as a player who only auto-fights.
const results=[];
for(let n=0;n<fights;n++){
  const result=await page.evaluate(()=>new Promise(done=>{
    const loop=()=>{const w=window.__arena.world(),h=w.actors.find(a=>a.id===w.controlled);
      if(w.status!=='active')return done({status:w.status,battleSeconds:w.tick/20,hp:h.hp,maxHp:h.maxHp,clicks:window.__clicks??0});
      const foes=w.actors.filter(a=>a.side==='enemy'&&a.alive);
      if(!h.lock&&foes.length&&!w.queue.length){const t=foes.sort((a,b)=>Math.hypot(a.x-h.x,a.z-h.z)-Math.hypot(b.x-h.x,b.z-h.z))[0];
        if(window.__arena.issue({actorId:h.id,kind:'attack',payload:{targetId:t.id}}).ok)window.__clicks=(window.__clicks??0)+1;}
      requestAnimationFrame(loop);};
    window.__clicks=0;loop();}));
  results.push(result);console.log(`fight ${n+1}: ${result.status} in ${result.battleSeconds} s of battle time, ${result.hp}/${result.maxHp} Health, ${result.clicks} clicks`);
  await page.waitForSelector('#result[open]');await page.click('#again-button');await page.waitForTimeout(500);
}
// The arena's own performance check.
await page.evaluate(()=>{window.__arenaReport=null;window.__arena.runCheck();});
await page.waitForFunction(()=>window.__arenaReport);const check=await page.evaluate(()=>window.__arenaReport);
const stats=list=>{const s=[...list].sort((a,b)=>a-b);return s.length?{p50:s[Math.floor(s.length/2)],max:s.at(-1),n:s.length}:null;};
const report={tool:'imperium-arena-benchmark',measuredAt:new Date().toISOString(),build:dist?'dist':'source',quality,renderer:'headless Chromium, SwiftShader (software)',
  readyMs,input:{...input,ms:stats(input.clickToMovementMs),frames:stats(input.clickToMovementFrames)},fights:results,check,errors};
console.log(JSON.stringify({readyMs,input:report.input.ms,frames:report.input.frames,fps:check.render.fps,
  tick15:check.simulation.skirmish15,tick82:check.simulation.crowd82,errors:errors.length}));
if(write)await writeFile(new URL('../docs/evidence/arena-phase0.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
await browser.close();server.close();process.exit(errors.length?1:0);
