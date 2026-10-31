import test from 'node:test';
import assert from 'node:assert/strict';
import {runPerformanceCheck} from '../src/ui/performance-check.js';

function harness(){
  let clock=0,listener=null,visible=true,removed=false,disposed=false,simulations=0;
  const adaptive=[],encounter={id:'test-battle',units:[{id:'hero',x:1,y:2}]};
  const stage={quality:'balanced',encounter,orbit:{yaw:0},cameraSettled:true,ready:Promise.resolve(),log:null,
    deviceReport:{renderer:'Test GPU',identity:'unmasked',software:false},
    startFrameLog(){this.log={frames:[],gpu:[]};return this.log;},stopFrameLog(){this.log=null;},
    home(){},focusSelected(){},horizon(){},stats(){return {calls:1,triangles:10,textures:1,geometries:1,firstFramePrograms:0};}};
  const controller={stage,quality(q){stage.quality=q;stage.ready=Promise.resolve();},adaptive(value){adaptive.push(value);}};
  const frame=(ms=16)=>{clock+=ms;stage.log?.frames.push([clock,1,ms]);};
  const options={now:()=>clock,nextFrame:async()=>frame(),isVisible:()=>visible,
    watchVisibility:fn=>{listener=fn;return ()=>{removed=true;listener=null;};},
    longTasks:{entries:[],supported:false,dispose(){disposed=true;}},facts:()=>({}),
    simulation:async()=>{simulations++;return {measured:true};}};
  return {stage,controller,options,frame,adaptive,encounter,
    hideThenShow(){visible=false;listener?.();visible=true;listener?.();},
    get cleaned(){return removed&&disposed;},get simulations(){return simulations;}};
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
// Only the one-shot watchdogs need a clock. MockTracker.method works on every
// supported Node 20 release, unlike the newer experimental MockTimers API.
function timerClock(t){
  let now=0,nextId=0;const pending=new Map();
  t.mock.method(globalThis,'setTimeout',(callback,delay=0,...args)=>{
    const id=++nextId;pending.set(id,{at:now+Math.max(0,Number(delay)||0),callback,args});return id;
  });
  t.mock.method(globalThis,'clearTimeout',id=>{pending.delete(id);});
  return {tick(ms){
    const until=now+ms;
    while(true){
      const due=[...pending].filter(([,timer])=>timer.at<=until).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
      if(!due)break;const [id,timer]=due;pending.delete(id);now=timer.at;timer.callback(...timer.args);
    }
    now=until;
  },get pending(){return pending.size;}};
}

test('ordinary rendering keeps all 36 warm-up frames and both 240-frame settled windows',async()=>{
  const h=harness(),before=JSON.stringify(h.encounter),report=await runPerformanceCheck(h.controller,h.options);
  assert.equal(report.complete,true);assert.equal(report.cancelled,false);assert.equal(report.interrupted,false);assert.equal(report.interruptionReason,null);
  for(const tier of report.tiers)for(const warmup of Object.values(tier.warmup)){
    assert.equal(warmup.frames,36);assert.equal(warmup.complete,true);assert.ok(warmup.elapsedMs<=20000);
  }
  assert.deepEqual(report.tiers.find(t=>t.tier==='balanced').steady.map(w=>[w.frames,w.complete]),[[240,true],[240,true]]);
  assert.ok(report.tiers.every(t=>t.meetsTarget));assert.equal(h.stage.quality,'balanced');assert.deepEqual(h.adaptive,[false,true]);
  assert.equal(JSON.stringify(h.encounter),before);assert.ok(h.cleaned);
});

test('slow warm-up stops requesting frames after its deadline and cannot qualify even a fast subsequent tour',async()=>{
  const h=harness();h.options.nextFrame=async()=>h.frame(h.stage.log?16:8000);
  const report=await runPerformanceCheck(h.controller,h.options);
  assert.equal(report.complete,true);assert.equal(report.interrupted,false);assert.equal(report.recommendationStatus,'below-target');
  for(const tier of report.tiers){
    assert.equal(tier.warmup.tour.frames,3,'Three eight-second frames cross the deadline; no remaining 33 frames are requested');
    assert.equal(tier.warmup.tour.elapsedMs,24000,'Elapsed time includes the final in-flight frame');
    assert.equal(tier.warmup.tour.complete,false);assert.equal(tier.tour.intervalMs.p95,16);
    assert.equal(tier.meetsTarget,false,'Incomplete warm-up cannot turn a fast later sample into a target pass');
  }
  assert.ok(h.cleaned);assert.equal(h.stage.quality,'balanced');
});

test('settled windows respect intentional quiet 30 fps without lowering the turning or live targets',async()=>{
  for(const [current,mode,interval,passes]of [
    ['balanced','quiet',1000/30,true],['high','quiet',1000/30,true],
    ['balanced','live',1000/30,false],['high','live',16,true],['balanced','animation',1000/30,false]
  ]){
    const h=harness();let steady=false;h.options.current=current;
    if(mode==='live')h.stage.live={};if(mode==='animation')h.stage.animation={};
    h.options.onProgress=p=>{steady=p.step==='steady';};h.options.nextFrame=async()=>h.frame(steady?interval:16);
    const report=await runPerformanceCheck(h.controller,h.options),tier=report.tiers.find(t=>t.tier===current);
    assert.equal(report.complete,true);assert.equal(tier.targetFps,60,'The turning tour retains its full quality target');
    assert.equal(tier.tour.intervalMs.p95,16);assert.equal(tier.meetsTarget,passes,`${current}/${mode}`);
    for(const window of tier.steady){
      assert.equal(window.targetFps,mode==='quiet'?30:60);assert.equal(window.cadence,mode==='quiet'?'quiet':'active');
      assert.equal(window.frames,240);assert.equal(window.complete,true);assert.equal(window.cameraSettled,true);assert.equal(window.cadenceStable,true);
    }
    assert.ok(h.cleaned);
  }
});

test('slow quiet rendering still fails its 30 fps target and incomplete rendered windows never pass',async()=>{
  for(const interval of [50,100]){
    const h=harness();let steady=false;h.options.onProgress=p=>{steady=p.step==='steady';};h.options.nextFrame=async()=>h.frame(steady?interval:16);
    const report=await runPerformanceCheck(h.controller,h.options),tier=report.tiers.find(t=>t.tier==='balanced');
    assert.equal(tier.meetsTarget,false);
    for(const window of tier.steady){assert.equal(window.targetFps,30);assert.equal(window.intervalMs.p95,interval);assert.equal(window.complete,interval===50);}
    assert.ok(h.cleaned);
  }
});

test('a final steady frame arriving after the deadline cannot qualify an otherwise fast sample',async()=>{
  const h=harness();let steady=false,frames=0;h.options.onProgress=p=>{steady=p.step==='steady';};
  h.options.nextFrame=async()=>h.frame(steady&&++frames===240?17000:16);
  const report=await runPerformanceCheck(h.controller,h.options),tier=report.tiers.find(t=>t.tier==='balanced'),first=tier.steady[0];
  assert.equal(first.frames,240);assert.equal(first.intervalMs.p95,16);assert.ok(first.to-first.from>20000);
  assert.equal(first.complete,false,'A full frame count does not override the elapsed-time limit');assert.equal(tier.meetsTarget,false);assert.ok(h.cleaned);
});

function settleAfterHome(h,afterFrames){
  let homes=0,waiting=false,frames=0;
  h.stage.home=()=>{if(h.stage.quality==='balanced'&&++homes===2){waiting=true;h.stage.cameraSettled=false;}};
  h.options.nextFrame=async()=>{h.frame();if(waiting&&++frames>=afterFrames){h.stage.cameraSettled=true;waiting=false;}};
}

test('steady warm-up waits beyond 36 display frames for the actual camera to settle',async()=>{
  const h=harness();settleAfterHome(h,90);
  const report=await runPerformanceCheck(h.controller,h.options),tier=report.tiers.find(t=>t.tier==='balanced');
  assert.equal(tier.warmup.steady.frames,90);assert.equal(tier.warmup.steady.cameraSettled,true);assert.equal(tier.warmup.steady.complete,true);
  assert.ok(tier.steady.every(w=>w.frames===240&&w.cameraSettled&&w.cadenceStable));assert.equal(tier.meetsTarget,true);assert.ok(h.cleaned);
});

test('a camera that never settles stops warm-up at 20 seconds and cannot qualify a tier',async()=>{
  const h=harness();settleAfterHome(h,Infinity);
  const report=await runPerformanceCheck(h.controller,h.options),tier=report.tiers.find(t=>t.tier==='balanced');
  assert.equal(report.complete,true);assert.equal(report.interrupted,false);
  assert.equal(tier.warmup.steady.elapsedMs,20000);assert.equal(tier.warmup.steady.cameraSettled,false);assert.equal(tier.warmup.steady.complete,false);
  assert.equal(tier.meetsTarget,false);assert.ok(tier.steady.every(w=>!w.cameraSettled));assert.ok(h.cleaned);
});

test('camera movement during a settled window invalidates it instead of accepting a changing cadence',async()=>{
  const h=harness();let steady=false,frames=0;h.options.onProgress=p=>{steady=p.step==='steady';};
  h.options.nextFrame=async()=>{h.frame();if(steady&&++frames===100)h.stage.cameraSettled=false;};
  const report=await runPerformanceCheck(h.controller,h.options),tier=report.tiers.find(t=>t.tier==='balanced');
  assert.equal(tier.steady[0].cameraSettled,false);assert.equal(tier.steady[0].cadenceStable,false);
  assert.equal(tier.meetsTarget,false);assert.ok(h.cleaned);
});

test('a visible eight-second frame is accepted instead of triggering the former five-second watchdog',async t=>{
  const clock=timerClock(t),h=harness();let release,first=true;
  h.options.nextFrame=()=>{if(first){first=false;return new Promise(resolve=>{release=()=>{h.frame(8000);resolve();};});}h.frame();return Promise.resolve();};
  let finished=false;const pending=runPerformanceCheck(h.controller,h.options).then(report=>{finished=true;return report;});
  await settle();assert.equal(typeof release,'function');clock.tick(8000);await settle();assert.equal(finished,false);
  release();const report=await pending;assert.equal(report.complete,true);assert.equal(report.interruptionReason,null);assert.ok(h.cleaned);
  assert.equal(clock.pending,0,'Successful measurements clear their watchdog timers');
});

test('stalled frame and build waits report their own reasons and restore settings',async t=>{
  for(const [kind,limit]of [['frame',30000],['build',120000]])await t.test(kind,async t=>{
    const clock=timerClock(t),h=harness();
    if(kind==='frame')h.options.nextFrame=()=>new Promise(()=>{});
    else h.controller.quality=q=>{h.stage.quality=q;h.stage.ready=new Promise(()=>{});};
    let finished=false;const pending=runPerformanceCheck(h.controller,h.options).then(report=>{finished=true;return report;});
    await settle();clock.tick(limit-1);await settle();assert.equal(finished,false,'The documented watchdog allows the full interval');
    clock.tick(1);const report=await pending;
    assert.equal(report.complete,false);assert.equal(report.interrupted,true);assert.equal(report.interruptionReason,`${kind}-timeout`);
    assert.equal(report.cancelled,false);assert.equal(report.recommendationStatus,'incomplete');assert.equal(report.simulation,null);
    assert.equal(h.stage.quality,'balanced');assert.deepEqual(h.adaptive,[false,true]);assert.ok(h.cleaned);assert.equal(h.simulations,0);
    assert.equal(clock.pending,0,'Interrupted measurements leave no watchdog timers');
  });
});

test('a hidden event wakes a stalled frame and remains distinct from explicit cancellation',async()=>{
  const h=harness();h.options.nextFrame=()=>new Promise(()=>{});
  const pending=runPerformanceCheck(h.controller,h.options);await settle();h.hideThenShow();const report=await pending;
  assert.equal(report.complete,false);assert.equal(report.interruptionReason,'hidden');assert.equal(report.cancelled,false);
  assert.equal(report.interrupted,true);assert.equal(report.simulation,null);assert.ok(h.cleaned);assert.equal(h.stage.quality,'balanced');
  const cancelled=harness();let frames=0;cancelled.options.nextFrame=async()=>{frames++;cancelled.frame();};cancelled.options.isCancelled=()=>frames>=3;
  const stopped=await runPerformanceCheck(cancelled.controller,cancelled.options);
  assert.equal(stopped.cancelled,true);assert.equal(stopped.interrupted,false);assert.equal(stopped.interruptionReason,null);
  assert.equal(stopped.complete,false);assert.equal(stopped.simulation,null);assert.ok(cancelled.cleaned);assert.deepEqual(cancelled.adaptive,[false,true]);
});

test('cancellation during optional simulation timing is retained in the final report',async()=>{
  const h=harness();let cancelled=false;h.options.isCancelled=()=>cancelled;
  h.options.simulation=async()=>{await Promise.resolve();cancelled=true;return {measured:true};};
  const report=await runPerformanceCheck(h.controller,h.options);
  assert.equal(report.tiers.length,3,'Completed rendering evidence remains available');assert.equal(report.cancelled,true);assert.equal(report.complete,false);
  assert.equal(report.recommendationStatus,'incomplete');assert.equal(report.interrupted,false);assert.equal(report.interruptionReason,null);
  assert.equal(h.stage.quality,'balanced');assert.deepEqual(h.adaptive,[false,true]);assert.ok(h.cleaned);
});
