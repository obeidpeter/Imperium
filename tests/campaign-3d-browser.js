import * as Game from '../src/core/game.js';
import {createBattleStageController} from '../src/ui/battle-stage-controller.js';

const $=id=>document.getElementById(id),host=$('stage-host'),status=$('status'),output=$('result');
const report={format:'sacramentum-campaign-3d-browser-v1',scope:'Actual browser renderer checks using legally reached checkpoints; no saved campaign reads/writes, debug injection, human playtest or physical-device claim.',status:'not-run',checks:[],measurements:[]};
let fixtures,controller=null,token=0,busy=false,lastError=null;
const buttons=['inspect','play','check','all','measure'];
const ensure=(value,message)=>{if(!value)throw Error(message);};
const write=()=>{output.textContent=JSON.stringify(report,null,2);};
const viewport=()=>({width:innerWidth,height:innerHeight,devicePixelRatio});
const stats=values=>{const a=[...values].sort((x,y)=>x-y);return {count:a.length,medianMs:a.length?a[Math.floor(a.length/2)]:null,p95Ms:a.length?a[Math.ceil(a.length*.95)-1]:null,maxMs:a.at(-1)??null};};
const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const active=t=>{if(t!==token||document.hidden){const error=Error('Interrupted: stopped or page hidden.');error.name='AbortError';throw error;}if(lastError)throw Error(lastError);};
function release(){controller?.release();controller=null;}
async function until(fn,t,timeout=10000){const start=performance.now();while(!fn()){active(t);ensure(performance.now()-start<timeout,'Timed out waiting for real render callbacks.');await new Promise(requestAnimationFrame);}active(t);}
function board(){let canvas=host.querySelector('canvas');if(!canvas){canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','Development review scene. Drag to orbit, plus/minus to zoom.');host.append(canvas);}delete host.dataset.ready;return canvas;}
const options=(state,extra={})=>({encounter:state.encounter,chapter:state.chapter,rank:state.rank,selected:'hero',targets:[],target:null,grid:false,quality:$('quality').value,reducedMotion:$('reduced-motion').checked,audio:false,audioVolume:0,paused:false,...extra});
async function mount(state,t,extra={}){
  release();lastError=null;controller=createBattleStageController({onError:error=>{lastError=String(error);}});
  controller.mount(board(),options(state,extra));await until(()=>controller?.stage,t);const stage=controller.stage;
  await until(()=>stage.stats().samples>=2,t);return stage;
}
function selected(){return fixtures.scenes.find(s=>s.id===$('scene-select').value);}
function motionOptions(){const scene=selected(),select=$('motion-select');select.replaceChildren();const actions=[...new Set(scene.commands.filter(c=>c.kind==='act').map(c=>c.payload.action))];
  for(const action of actions){const option=document.createElement('option');option.value=action;option.textContent=action;select.append(option);}select.disabled=!actions.length;
  $('sample-description').textContent=`Chapter ${scene.chapter} · ${scene.title} · ${scene.encounterTitle}. ${scene.kind}, ${scene.state.encounter.units.length} initial figures. Trace step ${scene.traceStep}.`;
}
// Replay a prefix through the same legal API, never rewrite coordinates or ranks.
function sample(scene,action){const state=Game.deserialize(Game.serialize(scene.state));
  for(const step of scene.commands){const before=structuredClone(state.encounter),preState=Game.serialize(state);
    if(step.kind==='act'){ensure(Game.preview(state,step.payload).ok,'Saved action is no longer legal.');ensure(Game.serialize(state)===preState,'Preview mutated the state.');}
    const result=step.kind==='act'?Game.act(state,step.payload):Game.endTurn(state);ensure(result.ok,result.message);
    if(step.kind==='act'&&step.payload.action===action)return {state,before,after:structuredClone(state.encounter),command:structuredClone(step.payload),traceStep:step.traceStep};
  }throw Error(`No legal ${action} sample for ${scene.id}.`);
}
async function inspect(t){const scene=selected(),state=Game.deserialize(Game.serialize(scene.state)),saved=Game.serialize(state);await mount(state,t);ensure(Game.serialize(state)===saved,'Rendering altered the campaign.');status.textContent=`Rendered ${scene.id}. Manual inspection remains unrecorded until a check runs.`;}
async function play(t){const scene=selected(),motion=sample(scene,$('motion-select').value),saved=Game.serialize(motion.state),stage=await mount(motion.state,t);
  stage.setSelection(motion.command.unitId,[],null);const pending=stage.play(motion.before,motion.after,motion.command);await until(()=>!stage.animation,t,20000);await pending;ensure(Game.serialize(motion.state)===saved,'Animation changed the committed state.');
  report.lastSample={scene:scene.id,action:motion.command.action,traceStep:motion.traceStep,completed:true,reducedMotion:stage.reducedMotion,saveUnchanged:true};status.textContent=`Completed legal ${motion.command.action} in ${scene.id}; committed save unchanged.`;
}
async function checkScene(scene,t){
  const row={scene:scene.id,chapter:scene.chapter,kind:scene.kind,status:'running',checks:[]};report.checks.push(row);write();
  const check=(name,value,detail)=>{row.checks.push({name,pass:!!value,...(detail===undefined?{}:{detail})});write();ensure(value,`${scene.id}: ${name}`);};
  try{
    const state=Game.deserialize(Game.serialize(scene.state)),saved=Game.serialize(state),e=state.encounter,stage=await mount(state,t),visible=e.units.filter(u=>!u.hidden);
    check('WebGL context is live',!stage.renderer.getContext().isContextLost());
    check('Only visible rule figures are modeled',stage.actors.size===visible.length&&e.units.filter(u=>u.hidden).every(u=>!stage.actors.has(u.id)));
    check('Visible figure anchors match authoritative tiles',visible.every(u=>{const a=stage.actors.get(u.id),p=stage.world(u);return a&&Math.abs(a.group.position.x-p.x)<.001&&Math.abs(a.group.position.z-p.z)<.001;}));
    check('Visible labels use actual names',visible.every(u=>stage.labels.get(u.id)?.textContent.includes(u.name)));
    if(e.kind==='contest'){
      check('Political electorate and seats remain intact',e.electorate===13&&e.units.filter(u=>u.role==='voter').length===9&&stage.actors.size===13);
      check('Delegate labels identify Stance instead of combat health',e.units.filter(u=>u.role==='voter').every(u=>/stance/i.test(stage.labels.get(u.id)?.textContent??'')));
      check('Speaker labels identify Resolve',e.units.filter(u=>u.role==='speaker').every(u=>/resolve/i.test(stage.labels.get(u.id)?.textContent??'')));
    }
    stage.setGrid(true);check('Optional grid can be enabled',stage.grid?.visible===true);stage.setGrid(false);
    const original=stage.canvas;controller.mount(board(),options(state));check('Rerender retains one canvas and label layer',controller.stage===stage&&stage.canvas===original&&host.querySelectorAll('canvas').length===1&&host.querySelectorAll('.world-labels').length===1);
    check('Camera, overlays and rendering preserve complete campaign state',Game.serialize(state)===saved);row.startSaveSHA256=await digest(saved);
    const preferred=e.kind==='contest'?['persuade','address','record','promise','denounce']:['strike','throw','assist','formation','move'],action=preferred.find(a=>scene.commands.some(step=>step.payload?.action===a)),motion=sample(scene,action),committed=Game.serialize(motion.state);
    stage.setReducedMotion(true);await stage.play(motion.before,motion.after,motion.command);check('Legal command reduced-motion output keeps the committed save exact',!stage.animation&&Game.serialize(motion.state)===committed,{action,traceStep:motion.traceStep});
    stage.setReducedMotion(false);stage.play(motion.before,motion.after,motion.command);stage.finishMotion();check('Animation cancellation preserves committed state',!stage.animation&&Game.serialize(motion.state)===committed);
    row.renderer=stage.stats();row.viewport=viewport();row.canvas={width:stage.canvas.clientWidth,height:stage.canvas.clientHeight};
    const old=stage;release();check('Scene release disposes renderer and labels',old.disposed&&!host.querySelector('.world-labels'));row.status='passed';
  }catch(error){row.status=error.name==='AbortError'?'interrupted':'failed';row.error=error.message;throw error;}finally{write();}
}
async function measure(t){
  const scene=selected(),state=Game.deserialize(Game.serialize(scene.state)),saved=Game.serialize(state),costs=[],times=[],raf=[];let warm=0,record=false,rafId=0,previous=null;
  const stage=await mount(state,t,{onFrame:cost=>{if(!record)warm++;else if(costs.length<120){costs.push(cost);times.push(performance.now());}}});
  await until(()=>warm>=18,t,15000);record=true;const started=performance.now();
  const sampleRAF=now=>{if(previous!==null)raf.push(now-previous);previous=now;rafId=requestAnimationFrame(sampleRAF);};rafId=requestAnimationFrame(sampleRAF);
  try{await until(()=>costs.length===120,t,20000);}finally{cancelAnimationFrame(rafId);record=false;}
  ensure(Game.serialize(state)===saved,'Measurement mutated the campaign state.');
  report.measurements.push({scene:scene.id,kind:scene.kind,quality:stage.quality,activity:'Idle legally reached encounter; no active animation',warmupFrames:warm,renderFrames:costs.length,elapsedMs:performance.now()-started,viewport:viewport(),canvas:{width:stage.canvas.clientWidth,height:stage.canvas.clientHeight},cpuRender:stats(costs),stageIntervals:stats(times.slice(1).map((v,i)=>v-times[i])),rafIntervals:stats(raf),renderer:stage.stats(),saveUnchanged:true});status.textContent='Measured 120 actual render callbacks. CPU and RAF timings are reported separately.';
}
async function run(label,fn){if(busy||!fixtures)return;busy=true;const t=++token;report.browser=navigator.userAgent;report.startedAt=new Date().toISOString();report.status='running';lastError=null;buttons.forEach(id=>$(id).disabled=true);status.textContent=`Running ${label}…`;write();
  try{await fn(t);active(t);report.status='complete';if(label.startsWith('check'))status.textContent=`${label} complete. Inspect per-scene assertions.`;}
  catch(error){report.status=error.name==='AbortError'?'interrupted':'failed';report.error=error.message;status.textContent=error.message;release();}
  finally{busy=false;buttons.forEach(id=>$(id).disabled=false);write();}
}
$('scene-select').addEventListener('change',motionOptions);$('scene-size').addEventListener('change',()=>{host.dataset.size=$('scene-size').value;controller?.stage?.resize();});
$('inspect').addEventListener('click',()=>run('inspect',inspect));$('play').addEventListener('click',()=>run('sample',play));$('check').addEventListener('click',()=>run('check selected',t=>checkScene(selected(),t)));
$('all').addEventListener('click',()=>run('check all encounters',async t=>{report.checks=[];for(const scene of fixtures.scenes){status.textContent=`Checking ${scene.id}…`;await checkScene(scene,t);}}));
$('measure').addEventListener('click',()=>run('measure',measure));$('stop').addEventListener('click',()=>{token++;release();status.textContent='Stopped. Renderer released.';});
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='campaign-3d-browser-results.json';link.click();URL.revokeObjectURL(url);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){token++;release();}});window.addEventListener('pagehide',()=>{token++;release();});
try{const response=await fetch('./fixtures/campaign-3d.json');ensure(response.ok,'Generate fixtures first: node scripts/campaign-3d-fixtures.mjs');fixtures=await response.json();ensure(fixtures.format==='sacramentum-campaign-3d-v1','Unexpected fixture format');
  for(const scene of fixtures.scenes){const option=document.createElement('option');option.value=scene.id;option.textContent=`${scene.chapter} · ${scene.encounterTitle} (${scene.kind})`;$('scene-select').append(option);}
  $('scene-select').value='ch2-marsh';$('scene-select').disabled=false;buttons.forEach(id=>$(id).disabled=false);motionOptions();report.fixtureSource=fixtures.source;report.fixtureCommands=fixtures.commandCount;status.textContent='Ready. No browser checks have run.';write();
}catch(error){status.textContent=error.message;report.status='unavailable';report.error=error.message;write();}
