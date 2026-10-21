import {drawBattle} from '../src/ui/renderer.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import * as Art from '../src/ui/art.js';
import * as Motion from '../src/ui/motion.js';
import * as BattleArt from '../src/ui/battle-art.js';
import {measureMotionTrial} from './graphics-metrics.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../src/ui/animation-timeline.js';
import {actionScene,filmstripFrames,assertVisibleMeasurement} from './graphics-review-tools.js';

const $=selector=>document.querySelector(selector),stage=$('#lab-stage'),status=$('#lab-status'),params=new URLSearchParams(location.search);
if(params.get('capture')==='1')document.documentElement.dataset.labCapture='true';
const label=params.get('label')??'current',nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
let fixtures,actionFixtures,fixtureHash,actionFixtureHash,currentScene,currentDraw,currentCanvas,cancelMotion=()=>{},galleryCanvases=[],filmstripCanvases=[],report=null,busy=false,revision=0,tacticalArt,cinematicReady;
const sizes=value=>value.split('x').map(Number),percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]??0;};
const summary=values=>({samples:values.length,medianMs:percentile(values,.5),p95Ms:percentile(values,.95),minMs:Math.min(...values),maxMs:Math.max(...values)});
function environment(){return {label,userAgent:navigator.userAgent,devicePixelRatio:devicePixelRatio||1,viewport:{width:innerWidth,height:innerHeight},platform:'actual desktop browser surface; no physical-device result',quality:$('#lab-quality').value,fixtureSource:fixtures.source,commandCount:fixtures.commandCount,fixturesSHA256:fixtureHash,actionFixturesSHA256:actionFixtureHash,assetsAPI:{loadArt:typeof Art.loadArt==='function',prefetchChapter:typeof Art.prefetchChapter==='function'},measurement:'CPU submission/layout and RAF frame intervals are separate; no GPU flush; warmed artwork'};}
function publish(){if(report)$('#lab-json').value=JSON.stringify(report,null,2);}
function error(message){$('#lab-errors').textContent=message;status.textContent='Graphics lab failed.';}
async function warm(scene){
  if(typeof Art.prefetchChapter==='function'){
    cinematicReady??=fetch(new URL('../index.html',import.meta.url)).then(async response=>{
      if(!response.ok)throw new Error('Cannot inspect the selected edition stylesheet list.');
      const page=new DOMParser().parseFromString(await response.text(),'text/html');
      await Promise.all([...page.querySelectorAll('link[rel=stylesheet]')].map(source=>new Promise((resolve,reject)=>{
        const href=new URL(source.getAttribute('href'),response.url).href;if([...document.styleSheets].some(sheet=>sheet.href===href)){resolve();return;}
        const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.onload=resolve;link.onerror=()=>reject(new Error('Edition stylesheet did not load: '+href));document.head.append(link);
      })));
    });
    await cinematicReady;
    const progress=await Art.prefetchChapter(scene.chapter,{next:false});if(progress?.failed)throw new Error(`${progress.failed} chapter artwork files failed; do not benchmark a fallback-only scene.`);
    // Current renderers may retain a smaller decoded-image LRU than an entire
    // chapter's narrative art. Warm the exact tactical group last, after it.
    if(scene.kind==='board'){
      tacticalArt??=await import('../src/ui/unit-sprites.js');
      const images=await tacticalArt.loadTacticalArt?.(scene.state.encounter);if(images?.some(image=>!image))throw new Error('Tactical artwork did not finish loading.');
    }
  }
  else await Promise.all([Art.heroPortrait(scene.state.rank),Art.chapterScene(scene.chapter)].map(path=>Art.loadArt(path)));
  await document.fonts?.ready;
}
async function waitImages(){await Promise.all([...stage.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});})));}
function viewMarkup(scene){const context={state:scene.state,screen:'game',settings:{textScale:1,reducedMotion:true,quality:$('#lab-quality').value},saving:false,lastSaved:'',saveProblem:'',saveConflict:false,offline:false,offlineProgress:''},views=createCampaignViews(()=>context);return views[scene.kind]();}
function drawOptions(){return {quality:$('#lab-quality').value,reducedMotion:true,action:'move'};}
async function showScene(scene=currentScene,{motion=false}={}){
  const token=++revision;cancelMotion();currentScene=scene;galleryCanvases=[];filmstripCanvases=[];currentCanvas=null;await warm(scene);if(token!==revision)return;
  stage.className='lab-stage';stage.replaceChildren();const [width,height]=sizes($('#lab-size').value);
  document.documentElement.dataset.phase=scene.state.phase;document.documentElement.dataset.kind=scene.state.encounter?.kind??'';document.documentElement.dataset.stage=scene.kind==='ending'||scene.chapter===12&&scene.kind==='promotion'?'imperial':'service';document.documentElement.dataset.reduced='true';
  if(scene.kind==='board'){
    const e=motion&&scene.transition?scene.transition.after:scene.state.encounter,canvas=document.createElement('canvas');canvas.id='lab-board';canvas.style.width=width+'px';canvas.style.height=height+'px';canvas.setAttribute('aria-label',scene.title);stage.style.width=width+'px';stage.append(canvas);currentCanvas=canvas;
    currentDraw=animation=>drawBattle(canvas,e,'hero',[],null,scene.chapter,{...drawOptions(),animation});await nextFrame();if(token!==revision)return;currentDraw();
    if(motion&&scene.transition){const transition=scene.transition;cancelMotion=Motion.playEncounterMotion(canvas,Motion.snapshotEncounter(transition.before),Motion.snapshotEncounter(transition.after),{command:transition.command,quality:$('#lab-quality').value,renderFrame:frame=>{if(token===revision&&canvas.isConnected)currentDraw(frame);}});}
  }else{
    stage.style.width=params.get('capture')==='1'?'100%':Math.max(320,Math.min(1280,innerWidth-32))+'px';stage.classList.add('lab-view');currentDraw=()=>{stage.innerHTML=viewMarkup(scene);void stage.offsetHeight;};currentDraw();await waitImages();
  }
  $('#lab-caption').textContent=`${label} · ${scene.title} · ${scene.kind==='board'?scene.state.encounter.id+' / turn '+scene.state.encounter.turn:scene.state.rank} · legal trace step ${scene.traceStep}/${fixtures.commandCount}${motion&&scene.transition?' · action '+scene.transition.command.action+' from trace step '+scene.transition.traceStep:''}`;
  status.textContent='Ready: '+scene.title;$('#lab-download-image').disabled=scene.kind!=='board';
}
async function showGallery(){
  const token=++revision;cancelMotion();stage.className='lab-stage lab-gallery';stage.style.width='1216px';stage.replaceChildren();galleryCanvases=[];filmstripCanvases=[];currentCanvas=null;currentDraw=null;
  for(const id of fixtures.primaryScenes){const scene=fixtures.scenes.find(s=>s.id===id);await warm(scene);if(token!==revision)return;const figure=document.createElement('figure');figure.className='lab-card';const caption=document.createElement('figcaption');caption.textContent=`${scene.chapter}. ${scene.state.encounter.title}`;const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',scene.title);figure.append(caption,canvas);stage.append(figure);await nextFrame();drawBattle(canvas,scene.state.encounter,'hero',[],null,scene.chapter,drawOptions());galleryCanvases.push({canvas,scene});}
  $('#lab-caption').textContent=`${label} · all12 legally reached representative chapter boards · 600 ×400 CSS pixels each`;status.textContent='Ready: all12 chapter boards.';$('#lab-download-image').disabled=false;
}
function selectedScene(){const action=actionFixtures.cases.find(value=>value.id===$('#lab-action').value);return action?actionScene(action):fixtures.scenes.find(s=>s.id===$('#lab-scene').value);}
async function showFilmstrip(scene){
  const token=++revision;cancelMotion();currentScene=scene;galleryCanvases=[];filmstripCanvases=[];currentCanvas=null;currentDraw=null;
  if(!scene.transition)throw new Error('Choose a recorded action case for a filmstrip.');
  await warm(scene);if(token!==revision)return;assertVisibleMeasurement(document);
  stage.className='lab-stage lab-gallery';stage.style.width='1216px';stage.replaceChildren();
  const transition=scene.transition,beforeHash=await hashState({state:scene.state,transition});
  const timeline=buildEncounterTimeline(Motion.snapshotEncounter(transition.before),Motion.snapshotEncounter(transition.after),{command:transition.command,quality:$('#lab-quality').value});
  const samples=filmstripFrames(timeline,sampleEncounterTimeline),panels=[{label:'Before · exact rule state',encounter:transition.before,frame:null},...samples.map(sample=>({label:`${Math.round(sample.timeMs)} ms · ${Math.round(sample.fraction*100)}% of actual timeline`,encounter:transition.after,frame:sample.frame})),{label:'After · exact rule state',encounter:transition.after,frame:null}];
  for(const panel of panels){
    const figure=document.createElement('figure');figure.className='lab-card';const caption=document.createElement('figcaption');caption.textContent=panel.label;const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',`${scene.title}: ${panel.label}`);figure.append(caption,canvas);stage.append(figure);await nextFrame();if(token!==revision)return;
    drawBattle(canvas,panel.encounter,transition.command.unitId??'hero',[],null,scene.chapter,{...drawOptions(),action:transition.command.action,animation:panel.frame});filmstripCanvases.push({canvas,label:panel.label});
  }
  const afterHash=await hashState({state:scene.state,transition});report={type:'timeline-filmstrip',environment:environment(),scene:scene.id,chapter:scene.chapter,command:transition.command,traceStep:transition.traceStep,durationMs:timeline.duration,sampleTimesMs:samples.map(value=>value.timeMs),canvas:{width:600,height:400},stateBeforeSHA256:beforeHash,stateAfterSHA256:afterHash,stateUnchanged:beforeHash===afterHash,complete:true,limitation:'Deterministic samples of the actual presentation timeline, rendered by the real renderer. A filmstrip does not measure RAF pacing, real-time animation smoothness or overlay badge timing.'};publish();if(!report.stateUnchanged)throw new Error('Filmstrip mutated its rule inputs.');
  $('#lab-caption').textContent=`${label} · ${scene.title} · trace step ${transition.traceStep} · ${timeline.duration} ms timeline · before, six samples, after · all rule inputs unchanged`;status.textContent='Ready: actual timeline filmstrip.';$('#lab-download-image').disabled=false;
}
async function show(){if(busy)return;const scene=selectedScene();if($('#lab-mode').value==='gallery')await showGallery();else if($('#lab-mode').value==='filmstrip')await showFilmstrip(scene);else await showScene(scene,{motion:$('#lab-mode').value==='motion'});}
function download(blob,name){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadImage(){
  if(filmstripCanvases.length){const canvas=document.createElement('canvas');canvas.width=1216;canvas.height=Math.ceil(filmstripCanvases.length/2)*448;const c=canvas.getContext('2d');c.fillStyle='#eee5d4';c.fillRect(0,0,canvas.width,canvas.height);filmstripCanvases.forEach(({canvas:board,label:caption},i)=>{const x=(i%2)*616,y=Math.floor(i/2)*448;c.fillStyle='#29352e';c.font='18px Georgia';c.fillText(caption,x+10,y+25);c.drawImage(board,x,y+32,600,400);});canvas.toBlob(blob=>download(blob,`${label}-${currentScene.id}-filmstrip.png`));}
  else if(galleryCanvases.length){const canvas=document.createElement('canvas');canvas.width=1216;canvas.height=6*448;const c=canvas.getContext('2d');c.fillStyle='#eee5d4';c.fillRect(0,0,canvas.width,canvas.height);galleryCanvases.forEach(({canvas:board,scene},i)=>{const x=(i%2)*616,y=Math.floor(i/2)*448;c.fillStyle='#29352e';c.font='18px Georgia';c.fillText(`Chapter ${scene.chapter} · ${scene.state.encounter.title}`,x+10,y+25);c.drawImage(board,x,y+32,600,400);});canvas.toBlob(blob=>download(blob,`${label}-all12-boards.png`));}
  else if(currentCanvas)currentCanvas.toBlob(blob=>download(blob,`${label}-${currentScene.id}-${$('#lab-size').value}.png`));
}
async function runBenchmark(){
  if(busy)return;busy=true;cancelMotion();$('#lab-benchmark').disabled=true;$('#lab-results').replaceChildren();$('#lab-errors').textContent='';report={environment:environment(),startedAt:new Date().toISOString(),rows:[],complete:false};publish();
  const selected=$('#lab-scene').value,oldSize=$('#lab-size').value,rows=[];
  try{
    const cases=fixtures.primaryScenes.flatMap(id=>['360x196','720x540'].map(size=>({scene:fixtures.scenes.find(s=>s.id===id),size}))).concat(['camp-1','promotion-10','promotion-11','ending'].map(id=>({scene:fixtures.scenes.find(s=>s.id===id),size:'720x540'})));
    for(const item of cases){
      $('#lab-size').value=item.size;await showScene(item.scene);const before=JSON.stringify(item.scene.state),draw=currentDraw;
      for(let i=0;i<5;i++)draw();await nextFrame();const cpu=[],intervals=[];let last;
      status.textContent=`Measuring ${rows.length+1}/${cases.length}: ${item.scene.title}, ${item.size}`;
      for(let i=0;i<45;i++){assertVisibleMeasurement(document);const timestamp=await nextFrame();if(last!==undefined)intervals.push(timestamp-last);last=timestamp;const began=performance.now();draw();cpu.push(performance.now()-began);}
      const row={scene:item.scene.id,chapter:item.scene.chapter,kind:item.scene.kind,width:sizes(item.size)[0],height:sizes(item.size)[1],measurement:item.scene.kind==='board'?'synchronous Canvas draw submission':'campaign template + DOM/layout',draws:45,warmups:5,cpu:summary(cpu),raf:summary(intervals),intervalsOver33ms:intervals.filter(ms=>ms>33.4).length,intervalCount:intervals.length,stateUnchanged:before===JSON.stringify(item.scene.state),rendererCache:BattleArt.rendererCacheStats?.()??null};rows.push(row);report.rows=rows;publish();
      const tr=document.createElement('tr');for(const value of [row.scene,item.size,`${row.cpu.medianMs.toFixed(3)} / ${row.cpu.p95Ms.toFixed(3)}`,`${row.raf.medianMs.toFixed(3)} / ${row.raf.p95Ms.toFixed(3)}`,`${row.intervalsOver33ms}/${row.intervalCount}`,row.stateUnchanged?'PASS':'FAIL']){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('#lab-results').append(tr);if(!row.stateUnchanged)throw new Error('Graphics mutated '+row.scene);
    }
    report.complete=true;report.finishedAt=new Date().toISOString();report.assetCache=Art.artCacheStats?.()??null;report.rendererCache=BattleArt.rendererCacheStats?.()??null;report.heap=performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize,note:'Chromium JS heap only; not GPU/decoded bitmap memory'}:null;publish();status.textContent=`Complete: ${rows.length} scenes/sizes, ${rows.length*45} measured draws; all campaign states unchanged.`;
  }catch(e){report.error=e.message;publish();error(e.message);}finally{busy=false;$('#lab-benchmark').disabled=false;$('#lab-size').value=oldSize;$('#lab-scene').value=selected;}
}
async function hashState(value){const bytes=new TextEncoder().encode(JSON.stringify(value)),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
async function runMotionBenchmark(){
  if(busy)return;busy=true;cancelMotion();$('#lab-motion-benchmark').disabled=true;$('#lab-results').replaceChildren();$('#lab-errors').textContent='';
  report={type:'motion',environment:environment(),measurement:'Actual Motion.playEncounterMotion callbacks. CPU records Canvas submission only; paint intervals and independent RAF intervals are separate. One warmup and six repeated legal transitions per supported scene. Unsupported old overlay players have null metrics, never zero-cost/FPS claims.',startedAt:new Date().toISOString(),rows:[],complete:false};publish();
  try{
    const cases=actionFixtures.cases.map(actionScene).concat(['board-ch1-road','board-ch9-wing','board-ch11-adlection'].map(id=>fixtures.scenes.find(s=>s.id===id)));
    for(const scene of cases){
      const id=scene.id,transition=scene.transition;if(!transition)throw new Error('Missing legal transition for '+id);
      await showScene(scene);const canvas=currentCanvas,draw=frame=>drawBattle(canvas,transition.after,transition.command.unitId,[],null,scene.chapter,{...drawOptions(),animation:frame});
      const beforeHash=await hashState({state:scene.state,transition}),trial=()=>measureMotionTrial({
        play:renderFrame=>{cancelMotion=Motion.playEncounterMotion(canvas,Motion.snapshotEncounter(transition.before),Motion.snapshotEncounter(transition.after),{command:transition.command,quality:$('#lab-quality').value,renderFrame});return cancelMotion;},draw
      });
      status.textContent=`Measuring motion: ${scene.title}, ${transition.command.action}`;draw(null);await nextFrame();const warmup=await trial(),trials=[];
      if(warmup.supported&&warmup.reason==='completed')for(let i=0;i<6;i++){const measured=await trial();if(!measured.supported||measured.reason!=='completed')throw new Error('Motion player stopped before completion for '+id);trials.push(measured);}
      else if(warmup.supported)throw new Error('Motion player exceeded the bounded trial window for '+id);
      const afterHash=await hashState({state:scene.state,transition}),cpu=trials.flatMap(t=>t.cpu),raf=trials.flatMap(t=>t.rafIntervals),paints=trials.flatMap(t=>t.paintIntervals),[width,height]=sizes($('#lab-size').value);
      const row={scene:id,chapter:scene.chapter,command:transition.command,traceStep:transition.traceStep,width,height,supported:warmup.supported,status:warmup.supported?'measured':'unsupported: old player supplies no rendered-unit frames',warmups:1,repetitions:trials.length,cpu:cpu.length?summary(cpu):null,raf:raf.length?summary(raf):null,paintIntervals:paints.length?summary(paints):null,intervalsOver33ms:raf.length?raf.filter(ms=>ms>33.4).length:null,intervalCount:raf.length||null,cleanupCpu:trials.length?summary(trials.map(t=>t.cleanupCpuMs)):null,stateBeforeSHA256:beforeHash,stateAfterSHA256:afterHash,stateUnchanged:beforeHash===afterHash,rendererCache:BattleArt.rendererCacheStats?.()??null};
      report.rows.push(row);publish();const tr=document.createElement('tr');for(const value of [row.scene+' · '+row.command.action,`${width}x${height}`,row.cpu?`${row.cpu.medianMs.toFixed(3)} / ${row.cpu.p95Ms.toFixed(3)}`:'Unsupported rendered-unit frames',row.raf?`${row.raf.medianMs.toFixed(3)} / ${row.raf.p95Ms.toFixed(3)}`:'Not comparable',row.raf?`${row.intervalsOver33ms}/${row.intervalCount}`:'—',row.stateUnchanged?'PASS':'FAIL']){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('#lab-results').append(tr);if(!row.stateUnchanged)throw new Error('Motion mutated '+id);
    }
    report.complete=true;report.finishedAt=new Date().toISOString();report.assetCache=Art.artCacheStats?.()??null;publish();status.textContent=`Motion complete: ${report.rows.filter(r=>r.supported).length}/${cases.length} scenes support rendered-unit frames; all input hashes unchanged.`;
  }catch(e){report.error=e.message;publish();error(e.message);}finally{cancelMotion();busy=false;$('#lab-motion-benchmark').disabled=false;}
}
try{
  const response=await fetch(new URL('./fixtures/graphics-scenes.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw new Error('Run node scripts/graphics-fixtures.mjs first: '+response.status);fixtures=await response.json();
  const actionResponse=await fetch(new URL('./fixtures/graphics-actions.json',import.meta.url),{cache:'no-store'});if(!actionResponse.ok)throw new Error('Run node tests/graphics-action-fixtures.mjs first: '+actionResponse.status);actionFixtures=await actionResponse.json();fixtureHash=await hashState(fixtures);actionFixtureHash=await hashState(actionFixtures);
  for(const value of actionFixtures.cases){const option=document.createElement('option');option.value=value.id;option.textContent=value.title;$('#lab-action').append(option);}
  for(const scene of fixtures.scenes){const option=document.createElement('option');option.value=scene.id;option.textContent=scene.title;$('#lab-scene').append(option);}
  $('#lab-scene').value=params.get('scene')??fixtures.primaryScenes[0];if(params.has('action'))$('#lab-action').value=params.get('action');if(params.has('size'))$('#lab-size').value=params.get('size');if(params.has('mode'))$('#lab-mode').value=params.get('mode');if(params.has('quality'))$('#lab-quality').value=params.get('quality');
  $('#lab-show').addEventListener('click',()=>show().catch(e=>error(e.message)));$('#lab-replay').addEventListener('click',()=>{if(!busy)showScene(selectedScene(),{motion:true}).catch(e=>error(e.message));});$('#lab-benchmark').addEventListener('click',runBenchmark);$('#lab-download-image').addEventListener('click',downloadImage);$('#lab-download-report').addEventListener('click',()=>download(new Blob([JSON.stringify(report??{environment:environment()},null,2)],{type:'application/json'}),`${label}-browser.json`));
  $('#lab-motion-benchmark').addEventListener('click',runMotionBenchmark);
  await show();if(params.get('benchmark')==='1')await runBenchmark();if(params.get('motionBenchmark')==='1')await runMotionBenchmark();
}catch(e){error(e.message);}
