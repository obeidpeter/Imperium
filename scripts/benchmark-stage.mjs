// Battle start-up and frame benchmark. Legal New Game -> command-campaign
// checkpoints -> each chosen encounter started, and its turns ended through the
// rules API until the enemy strikes; the page receives nothing but that legal
// encounter. A probe page mounts it with the game's own battle-stage controller
// and records long tasks, the time until the battle is ready and painted, shader
// programs, draw calls and triangles; plays the legal exchange; then tours the
// cameras (follow, horizon, overview), where the scenery cutaway switches on.
// Software rendering (SwiftShader) measures main-thread work and counts, not a
// device's frame rate: the times are inflated, the stalls and counts are real.
//   node scripts/benchmark-stage.mjs [--scenes ch1-road,ch5-mine] [--quality performance,balanced] [--report docs/evidence/stage-benchmark.json] [--dist] [--check]
// --check fails the run on what does not depend on rendering speed: a page
// error, a shader program first compiled in play (a stall on every device) or
// by the first frame (a variant the warm-up missed), figures without their
// generated bodies, or more programs than --max-programs.
//   PLAYWRIGHT_MODULE=/absolute/playwright/index.js node scripts/benchmark-stage.mjs
import http from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveRequest} from './serve.mjs';
import {runCommandCampaign} from './command-autoplay.mjs';
import * as G from '../src/core/game.js';
import {alive,clone,distance} from '../src/core/shared.js';

const repo=fileURLToPath(new URL('../',import.meta.url));
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const sceneIds=arg('--scenes','ch1-road,ch5-mine,ch7-legion,ch9-wing,ch12-confrontation').split(',');
const qualities=arg('--quality','performance,balanced').split(',');
const reportPath=arg('--report',null),dist=process.argv.includes('--dist'),root=dist?resolve(repo,'dist'):repo,check=process.argv.includes('--check'),maxPrograms=Number(arg('--max-programs',60));
const VIEWPORT={width:1280,height:720};

// The first exchange of blows, reached by legal commands only: each turn the
// player's units strike if any legal blow exists, otherwise close on the
// nearest enemy, then the turn ends; the first blow (theirs or the enemy's
// turn that follows) is the exchange played on the stage.
const BLOWS=new Set(['strike','shot','volley','charge','focus']);
const snapshot=s=>structuredClone(s.encounter);
function exchange(id,camp){
  const s=clone(camp);G.startEncounter(s);let first=null;
  for(let turn=1;turn<=10&&s.encounter.status==='active';turn++){
    const enemies=()=>s.encounter.units.filter(u=>u.side==='enemy'&&alive(u)),own=s.encounter.units.filter(u=>['player','ally'].includes(u.side)&&alive(u));
    for(const unit of own){
      const foes=new Set(enemies().map(u=>u.id)),strike=G.legalCommands(s).find(c=>c.unitId===unit.id&&c.action!=='move'&&foes.has(c.targetId));
      if(strike){const before=snapshot(s);if(G.act(s,strike).ok)return {chapter:s.chapter,rank:s.rank,before,after:snapshot(s),command:strike,turn,blows:'player'};}
      const near=t=>Math.min(...enemies().map(e=>distance(t,e))),moves=G.getTargets(s,unit.id,'move');
      const best=moves.reduce((a,b)=>!a||near(b)<near(a)?b:a,null);
      if(best&&near(best)<near(unit))G.act(s,{unitId:unit.id,action:'move',x:best.x,y:best.y});
    }
    const before=snapshot(s);if(!G.endTurn(s).ok)break;
    const step={chapter:s.chapter,rank:s.rank,before,after:snapshot(s),command:null,turn};first??=step;
    if((s.encounter.turnEvents??[]).some(e=>BLOWS.has(e.kind)))return {...step,blows:'enemy'};
  }
  if(!first)throw new Error(`${id}: no legal turn to play`);
  return {...first,blows:false};
}
const camps=new Map(),stop=new Error('done');
try{runCommandCampaign({featureEdition:35,onCheckpoint:s=>{const id=G.getChapter(s).encounters[s.encounterIndex]?.id;if(id&&!camps.has(id))camps.set(id,clone(s));if(sceneIds.every(i=>camps.has(i)))throw stop;}});}catch(error){if(error!==stop)throw error;}
const missing=sceneIds.filter(id=>!camps.has(id));if(missing.length)throw new Error(`No legal checkpoint for ${missing.join(', ')}`);
const exchanges=new Map(sceneIds.map(id=>[id,exchange(id,camps.get(id))]));

const page=(id,quality)=>{const x=exchanges.get(id);return `<!doctype html><meta charset="utf-8">
<style>body{margin:0;background:#000}.world-stage{position:relative;width:${VIEWPORT.width}px;height:${VIEWPORT.height}px;overflow:hidden}canvas{display:block;width:100%;height:100%}.world-labels{position:absolute;inset:0;pointer-events:none}.world-labels>*{position:absolute;left:0;top:0;font:12px sans-serif}</style>
<div class="world-stage"><canvas id="battle-board" tabindex="0"></canvas></div>
<script>
// Installed before any module, so the battle's own long tasks are all seen.
window.bench={long:[],frames:[],marks:{}};
new PerformanceObserver(list=>{for(const e of list.getEntries())bench.long.push([e.startTime,e.duration]);}).observe({type:'longtask',buffered:true});
</script>
<script type="application/json" id="scene">${JSON.stringify({id,quality,chapter:x.chapter,rank:x.rank,before:x.before,after:x.after,command:x.command}).replace(/</g,'\\u003c')}</script>
<script type="module">
import {createBattleStageController} from '/src/ui/battle-stage-controller.js';
const d=JSON.parse(document.getElementById('scene').textContent),canvas=document.getElementById('battle-board'),marks=bench.marks;
const controller=createBattleStageController({onError:error=>{bench.error=String(error);}});
marks.mount=performance.now();
controller.mount(canvas,{encounter:d.before,selected:'hero',targets:[],target:null,grid:false,quality:d.quality,reducedMotion:false,audio:false,audioVolume:0,paused:false,chapter:d.chapter,rank:d.rank,figureStyle:'sculpted',actionCamera:true,battleRemains:true,adaptiveResolution:false,motionSpeed:1,
  onFrame:cost=>{const now=performance.now();bench.frames.push([now,cost]);marks.firstFrame??=now;}});
(function watch(){const stage=controller.stage;if(!stage){if(!bench.error)requestAnimationFrame(watch);return;}
  marks.constructed??=performance.now();Promise.resolve(stage.ready).then(()=>{marks.ready=performance.now();});})();
window.controller=controller;window.scene=d;
</script>`;};

async function loadPlaywright(){
  for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){
    try{const m=await import(isAbsolute(specifier)?pathToFileURL(specifier).href:specifier);return m.chromium?m:m.default;}catch{}
  }
  throw new Error('Install Playwright separately, or set PLAYWRIGHT_MODULE to its index.js/index.mjs path.');
}
const percentiles=values=>{const s=[...values].sort((a,b)=>a-b),at=p=>s.length?Math.round(s[Math.min(s.length-1,Math.floor(p*(s.length-1)))]*10)/10:null;return {samples:s.length,p50:at(.5),p95:at(.95),max:at(1)};};

async function run(browser,base,id,quality){
  const context=await browser.newContext({viewport:VIEWPORT,deviceScaleFactor:1}),tab=await context.newPage(),errors=[];
  tab.setDefaultTimeout(300000);tab.on('pageerror',e=>errors.push(e.message));tab.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const phases=[],now=()=>tab.evaluate(()=>performance.now()),programs=()=>tab.evaluate(()=>(controller.stage?.renderer.info.programs??[]).map(p=>({key:p.cacheKey,name:p.name}))),stats=()=>tab.evaluate(()=>{const s=controller.stage,r=s?.renderer,c=document.getElementById('battle-board')??s?.canvas,v=s?.stats?.()??{};
    return {programs:r?.info.programs?.length??null,calls:v.calls??null,triangles:v.triangles??null,textures:v.textures??null,geometries:v.geometries??null,actorAssets:c?.dataset.actorAssets??null,generatedBodies:Number(c?.dataset.generatedBodies??0),sceneryModels:c?.dataset.sceneryModels??null,cameraView:v.cameraView??null};});
  const phase=async(name,fn)=>{const start=await now();await fn();const end=await now();phases.push({name,start,end,...await stats()});};
  try{
    await tab.goto(`${base}probe--${id}--${quality}.html`);
    await phase('build',()=>tab.waitForFunction(()=>bench.marks.firstFrame||bench.error,null,{polling:100}));
    // Everything compiled from here on was compiled in play: assets that arrive
    // after the battle is shown (settle) count as much as combat and the tour.
    const shown=new Set((await programs()).map(p=>p.key));
    // Late assets (bodies, anatomy, models) and whatever they rebuild belong to the start-up.
    await phase('settle',async()=>{await tab.waitForFunction(()=>{const c=document.getElementById('battle-board')??controller.stage?.canvas;return bench.error||c?.dataset.actorAssets&&c?.dataset.sceneryModels!=='loading';},null,{polling:250,timeout:120000}).catch(()=>{});await tab.waitForTimeout(4000);});
    await phase('idle',()=>tab.waitForTimeout(3000));
    // Counts from a still overview: with reduced motion the camera snaps home
    // instead of easing there over slow software frames.
    const counted=await tab.evaluate(async()=>{const s=controller.stage,frames=()=>bench.frames.length,start=frames();s.setReducedMotion(true);s.home();
      while(frames()<start+3)await new Promise(done=>setTimeout(done,50));const v=s.stats();s.setReducedMotion(false);
      return {calls:v.calls,triangles:v.triangles,textures:v.textures,geometries:v.geometries,programs:s.renderer.info.programs.length};});
    await phase('combat',()=>tab.evaluate(()=>Promise.race([controller.stage.play(scene.before,scene.after,scene.command),new Promise(done=>setTimeout(done,30000))])));
    await phase('tour',async()=>{for(const view of ['focusSelected','horizon','home']){await tab.evaluate(v=>controller.stage[v](),view);await tab.waitForTimeout(2500);}});
    // Programs first compiled after the battle was shown, by name: each is a stall in play.
    const late=(await programs()).filter(p=>!shown.has(p.key)).map(p=>p.name);
    const raw=await tab.evaluate(()=>({long:bench.long,frames:bench.frames,marks:bench.marks,error:bench.error??null,device:controller.stage?.deviceReport??null,firstFramePrograms:controller.stage?.firstFramePrograms??null,parallelShaderCompile:!!controller.stage?.renderer.extensions.get('KHR_parallel_shader_compile')}));
    const within=(list,p)=>list.filter(([t])=>t>=p.start&&t<p.end);
    const frameWindow=p=>{const frames=within(raw.frames,p),intervals=frames.slice(1).map(([t],i)=>t-frames[i][0]);return {cpu:percentiles(frames.map(([,c])=>c)),interval:percentiles(intervals)};};
    const longWindow=p=>{const l=within(raw.long,p).map(([,d])=>d);return {count:l.length,totalMs:Math.round(l.reduce((a,b)=>a+b,0)),maxMs:Math.round(Math.max(0,...l))};};
    const m=raw.marks,since=t=>Number.isFinite(t)?Math.round(t-m.mount):null;
    return {id,quality,chapter:exchanges.get(id).chapter,turnPlayed:exchanges.get(id).turn,enemyBlows:exchanges.get(id).blows,
      startup:{constructedMs:since(m.constructed),readyMs:since(m.ready),firstFrameMs:since(m.firstFrame),settledMs:Math.round(phases[1].end-m.mount),
        // Where the start-up's long tasks fall: preload and construction, preparing (figures, compiles), the first draw.
        longTasks:{construct:longWindow({start:m.mount,end:m.constructed??m.mount}),prepare:longWindow({start:m.constructed??m.mount,end:m.ready??m.firstFrame??m.mount}),firstFrame:longWindow({start:m.ready??m.mount,end:(m.firstFrame??m.mount)+1})}},
      phases:phases.map(p=>({name:p.name,durationMs:Math.round(p.end-p.start),longTasks:longWindow(p),frames:frameWindow(p),programs:p.programs,calls:p.calls,triangles:p.triangles,cameraView:p.cameraView})),
      overview:{...counted,generatedBodies:phases[2].generatedBodies,actorAssets:phases[2].actorAssets},
      programsCompiledAfterShown:late.length,lateProgramNames:late,
      // Programs the first frame had to compile itself: variants the warm-up missed.
      firstFramePrograms:raw.firstFramePrograms,parallelShaderCompile:raw.parallelShaderCompile,device:raw.device,errors:[...errors,...(raw.error?[raw.error]:[])]};
  }finally{await context.close();}
}

// The probe sits at the site root, as the game's page does: scenery models load from page-relative URLs.
const server=http.createServer((req,res)=>{const m=/^\/probe--(ch\d+-[\w-]+)--(\w+)\.html$/.exec(req.url);if(m&&exchanges.has(m[1])){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(page(m[1],m[2]));return;}serveRequest(req,res,root);});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}/`;
const {chromium}=await loadPlaywright(),executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser=await chromium.launch({...(executablePath?{executablePath}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const pkg=JSON.parse(await readFile(resolve(repo,'package.json'),'utf8'));
const report={tool:'scripts/benchmark-stage.mjs',version:pkg.version,source:dist?'production dist':'source tree',browser:`Chromium ${browser.version()}`,
  conditions:{rendering:'SwiftShader software WebGL (not a device measurement)',viewport:VIEWPORT,deviceScaleFactor:1,adaptiveResolution:false,reducedMotion:false},
  method:'Legal command-campaign checkpoints (feature edition 35); the encounter started and its turns ended through the rules API until the enemy strikes; mounted with the game\'s battle-stage controller; that exchange played, then the follow, horizon and overview cameras.',
  started:new Date().toISOString(),runs:[]};
try{
  for(const id of sceneIds)for(const quality of qualities){
    const result=await run(browser,base,id,quality);report.runs.push(result);
    const build=result.phases[0].longTasks,settle=result.phases[1].longTasks,combat=result.phases[3].longTasks,tour=result.phases[4].longTasks;
    console.log(`${id.padEnd(20)} ${quality.padEnd(12)} first frame ${String(result.startup.firstFrameMs).padStart(6)} ms | longest task: build ${build.maxMs}, settle ${settle.maxMs}, combat ${combat.maxMs}, tour ${tour.maxMs} ms | programs ${result.overview.programs} (+${result.firstFramePrograms??'?'} in first frame, +${result.programsCompiledAfterShown} after shown) | ${result.overview.calls} calls, ${result.overview.triangles} triangles | bodies ${result.overview.generatedBodies}${result.errors.length?` | ${result.errors.length} errors`:''}`);
  }
}finally{await browser.close();server.close();}
report.completed=new Date().toISOString();
if(reportPath){const out=resolve(repo,reportPath);await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(`Report: ${relative(repo,out)}`);}
const problems=report.runs.flatMap(r=>[
  ...r.errors.map(e=>`page error: ${e}`),
  ...(check&&r.lateProgramNames.length?[`${r.lateProgramNames.length} shader program(s) compiled in play: ${r.lateProgramNames.join(', ')}`]:[]),
  ...(check&&r.firstFramePrograms>0?[`${r.firstFramePrograms} shader program(s) compiled by the first frame, missed by the warm-up`]:[]),
  ...(check&&!(r.overview.generatedBodies>0)?['no figure wears its generated body']:[]),
  ...(check&&r.overview.programs>maxPrograms?[`${r.overview.programs} shader programs (limit ${maxPrograms})`]:[])
].map(problem=>`${r.id} ${r.quality}: ${problem}`));
for(const problem of problems)console.error(problem);
if(problems.length)process.exitCode=1;
