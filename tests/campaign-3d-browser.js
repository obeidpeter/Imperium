import * as Game from '../src/core/game.js';
import * as T from '../vendor/three/three.module.js';
import {createBattleStageController} from '../src/ui/battle-stage-controller.js';
import {CONFIG} from '../src/config.js';

const $=id=>document.getElementById(id),host=$('stage-host'),status=$('status'),output=$('result');
const report={format:'sacramentum-campaign-3d-browser-v2',version:CONFIG.version,scope:'Actual browser renderer checks using legally reached checkpoints; no saved campaign reads/writes, debug injection, human playtest or physical-device claim.',status:'not-run',checks:[],measurements:[],labelLayouts:[],horizonViews:[],motionSamples:[]};
let fixtures,controller=null,token=0,busy=false,lastError=null,mountedState=null,mountedScene=null;
const catalogs=new Map(),buttons=['inspect','play','check','all','remaining','measure','overview','follow','horizon','sky-check','zoom-in','zoom-out','labels'];
const ensure=(value,message)=>{if(!value)throw Error(message);};
const write=()=>{output.textContent=JSON.stringify(report,null,2);status.dataset.state=report.status;status.setAttribute('aria-busy',String(report.status==='running'));};
const viewport=()=>({width:innerWidth,height:innerHeight,devicePixelRatio});
const stats=values=>{const a=[...values].sort((x,y)=>x-y);return {count:a.length,medianMs:a.length?a[Math.floor(a.length/2)]:null,p95Ms:a.length?a[Math.ceil(a.length*.95)-1]:null,maxMs:a.at(-1)??null};};
const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const active=t=>{if(t!==token||document.hidden){const error=Error('Interrupted: stopped or page hidden.');error.name='AbortError';throw error;}if(lastError)throw Error(lastError);};
function release(){controller?.release();controller=null;mountedState=null;mountedScene=null;}
async function until(fn,t,timeout=10000){const start=performance.now();while(!fn()){active(t);ensure(performance.now()-start<timeout,'Timed out waiting for real render callbacks.');await new Promise(requestAnimationFrame);}active(t);}
function board(){let canvas=host.querySelector('canvas');if(!canvas){canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','Development review scene. Drag to orbit, plus/minus to zoom.');host.append(canvas);}delete host.dataset.ready;return canvas;}
const figureId=state=>state.encounter.units.some(u=>u.id===$('figure-select').value&&!u.hidden)?$('figure-select').value:'hero';
// Read-only previews: legal move cells from the rules API, or an inspected enemy.
const preview=state=>{const mode=$('preview')?.value,enemy=state.encounter.units.find(u=>u.side==='enemy'&&!u.hidden&&(u.hp??1)>0);if(mode==='move')return {targets:Game.getTargets(state,figureId(state),'move')??[],target:null};if(mode==='threat'&&enemy)return {targets:[],target:{x:enemy.x,y:enemy.y,unitId:enemy.id}};return {targets:[],target:null};};
const options=(state,extra={})=>({encounter:state.encounter,chapter:state.chapter,rank:state.rank,selected:figureId(state),...preview(state),grid:false,quality:$('quality').value,figureStyle:$('figure-style').value,reducedMotion:$('reduced-motion').checked,audio:false,audioVolume:0,paused:false,...extra});
async function mount(state,t,extra={}){
  release();lastError=null;controller=createBattleStageController({onError:error=>{lastError=String(error);}});
  controller.mount(board(),options(state,extra));await until(()=>controller?.stage,t);const stage=controller.stage;
  await until(()=>stage.stats().samples>=2,t);mountedState=state;mountedScene=state.encounter.id;return stage;
}
function selected(){return fixtures.scenes.find(s=>s.id===$('scene-select').value);}
const tile=u=>u?`${u.x+1}${String.fromCharCode(65+u.y)}`:'—';
function addOption(select,value,label){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
function advance(state,step){const saved=Game.serialize(state);
  if(step.kind==='act'){ensure(Game.preview(state,step.payload).ok,'Saved action is no longer legal.');ensure(Game.serialize(state)===saved,'Preview mutated the state.');}
  const result=step.kind==='act'?Game.act(state,step.payload):Game.endTurn(state);ensure(result.ok,result.message);
}
function catalog(scene){if(catalogs.has(scene.id))return catalogs.get(scene.id);const state=Game.deserialize(Game.serialize(scene.state)),rows=[];
  for(const step of scene.commands){const before=structuredClone(state.encounter);advance(state,step);const moved=state.encounter.units.filter(u=>!u.hidden&&before.units.some(p=>p.id===u.id&&!p.hidden&&(p.x!==u.x||p.y!==u.y))).map(u=>({id:u.id,name:u.name,from:tile(before.units.find(p=>p.id===u.id)),to:tile(u)}));
    const actor=before.units.find(u=>u.id===step.payload?.unitId);rows.push({traceStep:step.traceStep,turn:step.turn,action:step.kind==='act'?step.payload.action:'endTurn',actorId:actor?.id??null,actorName:actor?.name??null,moved});
  }catalogs.set(scene.id,rows);return rows;
}
function matchingRows(){const id=$('figure-select').value;return catalog(selected()).filter(row=>!$('figure-only').checked||(row.action==='endTurn'?row.moved.some(u=>u.id===id):row.actorId===id));}
function sampleOptions(){const scene=selected(),select=$('sample-step'),old=select.value;select.replaceChildren();
  for(const row of matchingRows().filter(row=>row.action===$('motion-select').value)){const who=row.actorName??(row.moved.length?row.moved.map(u=>`${u.name} ${u.from}→${u.to}`).join('; '):'No visible figure moves');addOption(select,String(row.traceStep),`Turn ${row.turn} · ${who} · trace ${row.traceStep}`);}
  if([...select.options].some(o=>o.value===old))select.value=old;select.disabled=!select.options.length;$('play').disabled=busy||!select.options.length;
  $('sample-description').textContent=`Chapter ${scene.chapter} · ${scene.title} · ${scene.encounterTitle}. ${scene.kind}, ${scene.state.encounter.units.filter(u=>!u.hidden).length} visible initial figures. ${select.options.length?'Sample is a legal command occurrence.':'No matching legal sample for this figure/filter.'}`;
}
function motionOptions(){const select=$('motion-select'),old=select.value;select.replaceChildren();for(const action of [...new Set(matchingRows().map(c=>c.action))])addOption(select,action,action==='endTurn'?'End turn · autonomous actors':action);if([...select.options].some(o=>o.value===old))select.value=old;select.disabled=!select.options.length;sampleOptions();}
function sceneOptions(){const select=$('figure-select');select.replaceChildren();for(const u of selected().state.encounter.units.filter(u=>!u.hidden))addOption(select,u.id,`${u.name} · ${u.side} ${u.role}`);select.value=[...select.options].some(o=>o.value==='hero')?'hero':select.options[0]?.value??'';select.disabled=false;motionOptions();}
// Replay a prefix through the legal API. Inspection never grants control of an enemy.
function sample(scene,action,traceStep=null){const state=Game.deserialize(Game.serialize(scene.state));
  for(const step of scene.commands){const before=structuredClone(state.encounter);advance(state,step);const kind=step.kind==='act'?step.payload.action:'endTurn';
    if(kind===action&&(traceStep===null||step.traceStep===traceStep))return {state,before,after:structuredClone(state.encounter),command:step.kind==='act'?structuredClone(step.payload):{action:'endTurn'},traceStep:step.traceStep};
  }throw Error(`No matching legal ${action} sample for ${scene.id}.`);
}
const cameraRecord=stage=>({mode:stage.stats().cameraView??(stage.focusMode?'follow':'overview/orbit'),selected:stage.selected,inspected:$('figure-select').value,yaw:stage.orbit.yaw,pitch:stage.orbit.pitch,distance:stage.orbit.distance,target:stage.baseTarget.toArray(),quality:stage.quality});
function labelBoxes(stage){const canvas=stage.canvas.getBoundingClientRect(),boxes=[],hidden=[];
  const roots=[...stage.labels,...[...(stage.missionMarkers??new Map())].map(([id,marker])=>[`objective:${id}`,marker.label])];
  for(const [id,label] of roots){const css=getComputedStyle(label),r=label.getBoundingClientRect(),layout=label.dataset.layout;
    if(label.hidden||css.display==='none'||css.visibility!=='visible'||Number(css.opacity)===0||!r.width||!r.height||(layout&&layout!=='visible')){hidden.push({id,layout:layout??'css-hidden'});continue;}
    boxes.push({id,kind:id.startsWith('objective:')?'objective':'unit',name:label.querySelector('.world-name')?.textContent??label.textContent??id,layout:layout??'unclassified',x:r.left-canvas.left,y:r.top-canvas.top,width:r.width,height:r.height});
  }return {width:canvas.width,height:canvas.height,boxes,hidden};
}
async function settledLabels(stage,t){let previous=null,stable=0,frames=0,lastPaint=stage.lastPaint;const started=performance.now();
  // An embedded preview can throttle RAF even while document.hidden is false.
  // Give camera easing actual render frames; this is a layout check, not timing evidence.
  while(stable<2&&frames<240&&performance.now()-started<90000){await until(()=>stage.lastPaint!==lastPaint,t,15000);lastPaint=stage.lastPaint;frames++;const current=labelBoxes(stage);
    const same=previous&&current.boxes.length===previous.boxes.length&&current.boxes.every((b,i)=>{const p=previous.boxes[i];return b.id===p.id&&Math.max(Math.abs(b.x-p.x),Math.abs(b.y-p.y),Math.abs(b.width-p.width),Math.abs(b.height-p.height))<.5;});
    stable=same&&frames>=6?stable+1:0;previous=current;
  }
  const data=previous??labelBoxes(stage),overlaps=[];
  for(let i=0;i<data.boxes.length;i++)for(let j=i+1;j<data.boxes.length;j++){const a=data.boxes[i],b=data.boxes[j],w=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),h=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);if(w>1&&h>1)overlaps.push({a:a.id,b:b.id,width:w,height:h,area:w*h});}
  return {settled:stable>=2,settledRenderedFrames:frames,settledElapsedMs:performance.now()-started,tolerancePx:1,canvas:{width:data.width,height:data.height},visible:data.boxes.length,hidden:data.hidden,outOfBounds:data.boxes.filter(b=>b.x< -1||b.y< -1||b.x+b.width>data.width+1||b.y+b.height>data.height+1).map(b=>b.id),overlaps,boxes:data.boxes,stageLayout:stage.labelStats?structuredClone(stage.labelStats):null};
}
async function currentStage(t){if(controller?.stage&&mountedScene===selected().id)return controller.stage;return mount(Game.deserialize(Game.serialize(selected().state)),t);}
async function horizonDiagnostic(t,preset){const stage=await currentStage(t),saved=Game.serialize(mountedState);ensure(typeof stage.horizon==='function','This stage does not expose the Horizon camera yet.');if(preset)stage.horizon();const labels=await settledLabels(stage,t),info=stage.stats(),camera=stage.camera;
  ensure(info.sky!==undefined&&info.horizon!==undefined&&info.cameraView!==undefined,'Sky/horizon diagnostics are unavailable in this stage.');
  const forward=camera.getWorldDirection(camera.position.clone());forward.y=0;forward.normalize();
  const skyProbes=[0,6,12].map(elevationDegrees=>{const distance=camera.far*.5,point=camera.position.clone().addScaledVector(forward,distance);point.y+=Math.tan(elevationDegrees*Math.PI/180)*distance;point.project(camera);return {elevationDegrees,ndc:point.toArray(),inFrustum:Math.abs(point.x)<=1&&Math.abs(point.y)<=1&&Math.abs(point.z)<=1,pixelY:(1-point.y)*stage.canvas.clientHeight/2};});
  ensure(Game.serialize(mountedState)===saved,'Horizon inspection changed the campaign.');
  report.horizonViews.push({scene:mountedScene,turn:mountedState.encounter.turn,presetApplied:preset,camera:cameraRecord(stage),cameraFar:camera.far,viewport:viewport(),canvas:{width:stage.canvas.clientWidth,height:stage.canvas.clientHeight},reducedMotion:stage.reducedMotion,sky:structuredClone(info.sky),horizon:structuredClone(info.horizon),cameraView:info.cameraView,skyProbes,projectionScope:'Projects horizontal/above-horizontal directions, not a pixel or structural-occlusion test. Inspect the actual rendered scene separately.',labelsSettled:labels.settled,renderer:info,startSaveSHA256:await digest(saved),saveUnchanged:true});
  status.textContent=`Recorded ${info.cameraView}: sky/landscape metadata and skyward projection, far plane ${camera.far}. Save unchanged.`;
}
async function inspectLabels(t){const stage=await currentStage(t),saved=Game.serialize(mountedState),layout=await settledLabels(stage,t);ensure(Game.serialize(mountedState)===saved,'Label inspection changed state.');report.labelLayouts.push({scene:mountedScene,turn:mountedState.encounter.turn,camera:cameraRecord(stage),viewport:viewport(),...layout,saveUnchanged:true});status.textContent=`Labels ${layout.settled?'settled':'not settled'}: ${layout.visible} visible, ${layout.overlaps.length} overlaps, ${layout.outOfBounds.length} outside scene. Observations are not a playability verdict.`;}
async function inspect(t){const scene=selected(),state=Game.deserialize(Game.serialize(scene.state)),saved=Game.serialize(state);await mount(state,t);ensure(Game.serialize(state)===saved,'Rendering altered the campaign.');status.textContent=`Rendered ${scene.id}. Select a figure and Follow for inspection; no commands are granted.`;}
async function play(t){const scene=selected(),motion=sample(scene,$('motion-select').value,Number($('sample-step').value)),saved=Game.serialize(motion.state),wasFollow=controller?.stage?.focusMode,stage=await mount(motion.state,t);
  stage.setSelection(figureId(motion.state),[],null);if(wasFollow)stage.focusSelected();const costs=[],onFrame=stage.onFrame;stage.onFrame=cost=>{costs.push(cost);onFrame?.(cost);};const started=performance.now(),pending=stage.play(motion.before,motion.after,motion.command),duration=stage.animation?.timeline.duration??0;await until(()=>!stage.animation,t,20000);await pending;stage.onFrame=onFrame;ensure(Game.serialize(motion.state)===saved,'Animation changed the committed state.');
  report.lastSample={renderFrames:costs.length,cpuRender:stats(costs),authoredDurationMs:duration,observedDurationMs:performance.now()-started,renderer:stage.stats(),scene:scene.id,action:motion.command.action,actorId:motion.command.unitId??null,inspectedFigure:stage.selected,traceStep:motion.traceStep,movements:catalog(scene).find(c=>c.traceStep===motion.traceStep).moved,completed:true,reducedMotion:stage.reducedMotion,camera:cameraRecord(stage),saveUnchanged:true};report.motionSamples.push(report.lastSample);status.textContent=`Completed legal ${motion.command.action} in ${scene.id}; committed save unchanged.`;
}
async function checkScene(scene,t){
  const row={scene:scene.id,chapter:scene.chapter,kind:scene.kind,status:'running',checks:[]};report.checks.push(row);write();
  const check=(name,value,detail)=>{row.checks.push({name,pass:!!value,...(detail===undefined?{}:{detail})});write();ensure(value,`${scene.id}: ${name}`);};
  try{
    const state=Game.deserialize(Game.serialize(scene.state)),saved=Game.serialize(state),e=state.encounter,stage=await mount(state,t,{selected:'hero'}),visible=e.units.filter(u=>!u.hidden);
    check('WebGL context is live',!stage.renderer.getContext().isContextLost());
    let skinnedMeshes=0;stage.scene.traverse(o=>{if(o.isSkinnedMesh)skinnedMeshes++;});check('Characters use actual weighted skinning',skinnedMeshes>=stage.actors.size);check('Local sky reflection texture is live',!!stage.scene.environment?.isTexture);
    row.footContacts=[...stage.actors].flatMap(([id,actor])=>(actor.contacts.feet??[]).map(foot=>{const mounted=actor.group.userData.actor.mounted,p=foot.localToWorld(new T.Vector3(0,mounted?-.075:-.07,0));return {id,soleHeight:p.y,groundHeight:stage.environment.groundHeight(p.x,p.z),clearance:p.y-stage.environment.groundHeight(p.x,p.z)};}));
    check('Only visible rule figures are modeled',stage.actors.size===visible.length&&e.units.filter(u=>u.hidden).every(u=>!stage.actors.has(u.id)));
    check('Visible figure anchors match authoritative tiles',visible.every(u=>{const a=stage.actors.get(u.id),p=stage.world(u);return a&&Math.abs(a.group.position.x-p.x)<.001&&Math.abs(a.group.position.z-p.z)<.001;}));
    check('Visible labels use actual names',visible.every(u=>stage.labels.get(u.id)?.textContent.includes(u.name)));
    row.labelLayout=await settledLabels(stage,t);
    const assertLayout=(layout,when)=>{check(`${when}: unit and objective labels settle`,layout.settled,{renderedFrames:layout.settledRenderedFrames});check(`${when}: all visible label roots are in bounds`,layout.outOfBounds.length===0,layout.outOfBounds);check(`${when}: visible unit and objective labels do not overlap`,layout.overlaps.length===0,layout.overlaps);check(`${when}: selected hero label remains visible`,layout.boxes.some(box=>box.id==='hero'));};
    assertLayout(row.labelLayout,'Overview');
    if(e.kind==='contest'){
      check('Political electorate and seats remain intact',e.electorate===13&&e.units.filter(u=>u.role==='voter').length===9&&stage.actors.size===13);
      check('Delegate labels identify Stance instead of combat health',e.units.filter(u=>u.role==='voter').every(u=>/stance/i.test(stage.labels.get(u.id)?.textContent??'')));
      check('Speaker labels identify Resolve',e.units.filter(u=>u.role==='speaker').every(u=>/resolve/i.test(stage.labels.get(u.id)?.textContent??'')));
    }
    stage.setGrid(true);check('Optional grid can be enabled',stage.grid?.visible===true);stage.setGrid(false);
    const original=stage.canvas;controller.mount(board(),options(state,{selected:'hero'}));check('Rerender retains one canvas and label layer',controller.stage===stage&&stage.canvas===original&&host.querySelectorAll('canvas').length===1&&host.querySelectorAll('.world-labels').length===1);
    check('Camera, overlays and rendering preserve complete campaign state',Game.serialize(state)===saved);row.startSaveSHA256=await digest(saved);
    const preferred=e.kind==='contest'?['persuade','address','record','promise','denounce']:['strike','throw','assist','formation','move'],action=preferred.find(a=>scene.commands.some(step=>step.payload?.action===a)),motion=sample(scene,action),committed=Game.serialize(motion.state);
    stage.setReducedMotion(true);await stage.play(motion.before,motion.after,motion.command);check('Legal command reduced-motion output keeps the committed save exact',!stage.animation&&Game.serialize(motion.state)===committed,{action,traceStep:motion.traceStep});
    stage.setReducedMotion(false);stage.play(motion.before,motion.after,motion.command);stage.finishMotion();check('Animation cancellation preserves committed state',!stage.animation&&Game.serialize(motion.state)===committed);
    row.afterMotionLabelLayout=await settledLabels(stage,t);assertLayout(row.afterMotionLabelLayout,'After canceled motion');
    row.renderer=stage.stats();row.camera=cameraRecord(stage);row.viewport=viewport();row.canvas={width:stage.canvas.clientWidth,height:stage.canvas.clientHeight};
    const old=stage;release();check('Scene release disposes renderer and labels',old.disposed&&!host.querySelector('.world-labels'));row.status='passed';
  }catch(error){row.status=error.name==='AbortError'?'interrupted':'failed';row.error=error.message;throw error;}finally{write();}
}
async function measure(t){
  const scene=selected(),stage=await currentStage(t),state=mountedState,saved=Game.serialize(state),costs=[],times=[],raf=[],drawCalls=[],triangles=[],previousOnFrame=stage.onFrame;let warm=0,record=false,rafId=0,previous=null,started=0;
  stage.onFrame=cost=>{previousOnFrame?.(cost);if(!record)warm++;else if(costs.length<120){costs.push(cost);times.push(performance.now());drawCalls.push(stage.renderer.info.render.calls);triangles.push(stage.renderer.info.render.triangles);}};
  const sampleRAF=now=>{if(previous!==null)raf.push(now-previous);previous=now;rafId=requestAnimationFrame(sampleRAF);};rafId=requestAnimationFrame(sampleRAF);
  try{await settledLabels(stage,t);await until(()=>warm>=18,t,30000);raf.length=0;previous=null;record=true;started=performance.now();await until(()=>costs.length===120,t,180000);}finally{cancelAnimationFrame(rafId);record=false;stage.onFrame=previousOnFrame;}
  ensure(Game.serialize(state)===saved,'Measurement mutated the campaign state.');
  const workload=values=>({min:Math.min(...values),mean:values.reduce((a,b)=>a+b,0)/values.length,max:Math.max(...values),last:values.at(-1)});
  report.measurements.push({scene:scene.id,kind:scene.kind,turn:state.encounter.turn,quality:stage.quality,camera:cameraRecord(stage),activity:'Idle legally reached encounter; no active animation',warmupFrames:warm,renderFrames:costs.length,elapsedMs:performance.now()-started,viewport:viewport(),canvas:{width:stage.canvas.clientWidth,height:stage.canvas.clientHeight},cpuRender:stats(costs),stageIntervals:stats(times.slice(1).map((v,i)=>v-times[i])),rafIntervals:stats(raf),drawCalls:workload(drawCalls),triangles:workload(triangles),renderer:stage.stats(),startSaveSHA256:await digest(saved),saveUnchanged:true});status.textContent='Measured 120 actual render callbacks at the current camera. CPU, stage intervals, RAF and draw workload are separate.';
}
async function run(label,fn){if(busy||!fixtures)return;busy=true;const t=++token;report.browser=navigator.userAgent;report.startedAt=new Date().toISOString();report.status='running';delete report.error;lastError=null;buttons.forEach(id=>$(id).disabled=true);document.querySelectorAll('.qa-controls select,.qa-controls input').forEach(el=>el.disabled=true);status.textContent=`Running ${label}…`;write();
  try{await fn(t);active(t);report.status='complete';if(label.startsWith('check'))status.textContent=`${label} complete. Inspect per-scene assertions.`;}
  catch(error){report.status=error.name==='AbortError'?'interrupted':'failed';report.error=error.message;status.textContent=error.message;release();}
  finally{busy=false;buttons.forEach(id=>$(id).disabled=false);document.querySelectorAll('.qa-controls select,.qa-controls input').forEach(el=>el.disabled=false);sampleOptions();write();}
}
$('scene-select').addEventListener('change',()=>{release();sceneOptions();});$('scene-size').addEventListener('change',()=>{host.dataset.size=$('scene-size').value;controller?.stage?.resize();});
$('figure-select').addEventListener('change',()=>{motionOptions();if(controller?.stage){controller.stage.setSelection(figureId(mountedState),[],null);if(controller.stage.focusMode)controller.focus();}});$('figure-only').addEventListener('change',motionOptions);$('motion-select').addEventListener('change',sampleOptions);
$('quality').addEventListener('change',()=>controller?.quality($('quality').value));$('figure-style').addEventListener('change',()=>controller?.figures?.($('figure-style').value));$('reduced-motion').addEventListener('change',()=>controller?.reduced($('reduced-motion').checked));
for(const [id,apply] of [['overview',s=>s.home()],['follow',s=>s.focusSelected()],['zoom-in',s=>s.zoom(-2)],['zoom-out',s=>s.zoom(2)]])$(id).addEventListener('click',()=>run('camera',async t=>{const stage=await currentStage(t),saved=Game.serialize(mountedState);stage.setSelection(figureId(mountedState),[],null);apply(stage);await settledLabels(stage,t);ensure(Game.serialize(mountedState)===saved,'Camera changed state.');status.textContent=`${id}: ${stage.selected}. Camera inspection only.`;}));
$('labels').addEventListener('click',()=>run('labels',inspectLabels));
$('horizon').addEventListener('click',()=>run('horizon',t=>horizonDiagnostic(t,true)));$('sky-check').addEventListener('click',()=>run('sky record',t=>horizonDiagnostic(t,false)));
$('inspect').addEventListener('click',()=>run('inspect',inspect));$('play').addEventListener('click',()=>run('sample',play));$('check').addEventListener('click',()=>run('check selected',t=>checkScene(selected(),t)));
$('all').addEventListener('click',()=>run('check all encounters',async t=>{report.checks=[];for(const scene of fixtures.scenes){status.textContent=`Checking ${scene.id}…`;await checkScene(scene,t);}}));
$('remaining').addEventListener('click',()=>run('check selected and later encounters',async t=>{const start=fixtures.scenes.indexOf(selected());report.checks=[];for(const scene of fixtures.scenes.slice(start)){status.textContent=`Checking ${scene.id}…`;await checkScene(scene,t);}}));
$('measure').addEventListener('click',()=>run('measure',measure));$('stop').addEventListener('click',()=>{token++;release();status.textContent='Stopped. Renderer released.';});
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='campaign-3d-browser-results.json';link.click();URL.revokeObjectURL(url);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){token++;release();}});window.addEventListener('pagehide',()=>{token++;release();});
try{const response=await fetch('./tests/fixtures/campaign-3d.json');ensure(response.ok,'Generate fixtures first: node scripts/campaign-3d-fixtures.mjs');fixtures=await response.json();ensure(fixtures.format==='sacramentum-campaign-3d-v1','Unexpected fixture format');
  for(const scene of fixtures.scenes){const option=document.createElement('option');option.value=scene.id;option.textContent=`${scene.chapter} · ${scene.encounterTitle} (${scene.kind})`;$('scene-select').append(option);}
  $('scene-select').value='ch2-marsh';$('scene-select').disabled=false;buttons.forEach(id=>$(id).disabled=false);sceneOptions();report.fixtureSource=fixtures.source;report.fixtureCommands=fixtures.commandCount;status.textContent='Ready. No browser checks have run.';write();
}catch(error){status.textContent=error.message;report.status='unavailable';report.error=error.message;write();}

// Read-only inspection handle for scripted visual checks (stage stats, injected presentation scenarios).
globalThis.__campaign3d={get stage(){return controller?.stage;}};
