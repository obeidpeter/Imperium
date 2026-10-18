import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameCadence,createGpuTimer,createResolutionBudget} from '../src/showcase/frame-budget.js';

test('GPU timer is bounded, asynchronous, excludes warmup and discards disjoint results',()=>{
  const deleted=[],ended=[],extension={TIME_ELAPSED_EXT:3,GPU_DISJOINT_EXT:4};let id=0,ready=false,disjoint=false;
  const gl={QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,getExtension:()=>extension,isContextLost:()=>false,getParameter:()=>disjoint,createQuery:()=>++id,beginQuery:()=>{},endQuery:q=>ended.push(q),deleteQuery:q=>deleted.push(q),getQueryParameter:(q,key)=>key===1?ready:12e6};
  const timer=createGpuTimer(gl,{warmup:2,every:1,maxPending:2});assert.equal(timer.begin(),false);assert.equal(timer.begin(),false);
  assert.equal(timer.begin(),true);timer.end();assert.equal(timer.begin(),true);timer.end();assert.equal(timer.begin(),false);assert.deepEqual(timer.poll(),[]);
  ready=true;assert.deepEqual(timer.poll(),[12,12]);assert.equal(deleted.length,2);assert.equal(timer.stats().measured,2);
  timer.begin();timer.end();disjoint=true;assert.deepEqual(timer.poll(),[]);assert.equal(deleted.length,3);assert.equal(timer.stats().measured,2);
  timer.dispose();assert.equal(timer.begin(),false);assert.equal(ended.length,3);
});
test('Unsupported GPU timing has an explicit unavailable state and no measurement',()=>{
  const timer=createGpuTimer({getExtension:()=>null});assert.deepEqual(timer.poll(),[]);assert.equal(timer.begin(),false);assert.equal(timer.stats().lastMs,null);assert.equal(timer.stats().supported,false);timer.dispose();
});
test('Resolution responds to sustained GPU load, cools down, recovers cautiously and restores when disabled',()=>{
  const changes=[],budget=createResolutionBudget({fps:60,onChange:s=>changes.push(s)});
  for(let i=0;i<23;i++)budget.record(25);assert.equal(budget.scale,1);budget.record(25);assert.equal(budget.scale,.9);
  for(let i=0;i<36;i++)budget.record(25);assert.equal(budget.scale,.9);
  for(let i=0;i<400;i++)budget.record(25);assert.equal(budget.scale,.65);
  for(let i=0;i<100;i++)budget.record(2);assert.ok(budget.scale>.65&&budget.scale<1);
  budget.setEnabled(false);assert.equal(budget.scale,1);for(let i=0;i<100;i++)budget.record(50);assert.equal(budget.scale,1);assert.equal(changes.at(-1),1);
});
test('Frame cadence paints on whole display refreshes for 30 and 60 fps targets at 60, 120 and 144 Hz',()=>{
  const run=(hz,fps,frames=240)=>{const cadence=createFrameCadence({fps}),times=[];for(let i=0;i<frames;i++){const now=i*1000/hz;if(cadence.shouldRender(now))times.push(now);}const gaps=times.slice(20).map((t,i,list)=>i?t-list[i-1]:null).filter(Boolean);return {cadence,gaps};};
  for(const [hz,fps,refreshes]of [[60,60,1],[60,30,2],[120,60,2],[120,30,4],[144,60,2]]){
    const {cadence,gaps}=run(hz,fps);assert.equal(cadence.stats().refreshesPerFrame,refreshes,`${hz} Hz / ${fps} fps`);
    // Every interval after calibration is the same whole number of refreshes: no 1-2-1 judder.
    for(const gap of gaps)assert.ok(Math.abs(gap-refreshes*1000/hz)<.01,`${hz} Hz / ${fps} fps gap ${gap}`);
    assert.ok(Math.abs(cadence.expectedMs-refreshes*1000/hz)<.01);
  }
  const cadence=createFrameCadence({fps:60});assert.equal(cadence.shouldRender(NaN),false);cadence.reset(30);for(let i=0;i<40;i++)cadence.shouldRender(i*1000/60);assert.equal(cadence.stats().refreshesPerFrame,2);
});
test('Without GPU timing, sustained late frames lower resolution and a long on-time run restores it slowly',()=>{
  const changes=[],budget=createResolutionBudget({fps:60,onChange:s=>changes.push(s)}),expected=1000/60;
  for(let i=0;i<29;i++)budget.recordInterval(expected*2,expected);assert.equal(budget.scale,1,'Fewer than 30 frames is not sustained evidence');
  budget.recordInterval(expected*2,expected);assert.equal(budget.scale,.9);
  for(let i=0;i<36;i++)budget.recordInterval(expected*2,expected);assert.equal(budget.scale,.9,'A change is followed by a cooling period');
  for(let i=0;i<239;i++)budget.recordInterval(expected,expected);assert.equal(budget.scale,.9);
  budget.recordInterval(expected,expected);assert.equal(budget.scale,.95);
  assert.equal(budget.recordInterval(expected*20,expected),false,'A paused or backgrounded gap is ignored');
  assert.equal(budget.recordInterval(NaN,expected),false);assert.equal(budget.stats().acceptedFrameIntervals>0,true);
  budget.setEnabled(false);assert.equal(budget.scale,1);for(let i=0;i<100;i++)budget.recordInterval(expected*2,expected);assert.equal(budget.scale,1);assert.equal(changes.at(-1),1);
});
