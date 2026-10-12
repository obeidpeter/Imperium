import test from 'node:test';
import assert from 'node:assert/strict';
import {measureMotionTrial} from './graphics-metrics.js';

function clock(){
  const frames=new Map(),timers=new Map();let time=0,id=0,hidden=false;
  return {frames,timers,hide(){hidden=true;},advance(ms){time+=ms;},frame(at){time=at;const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(at);},expire(at){time=at;for(const[key,timer]of timers)if(timer.at<=at){timers.delete(key);timer.fn();}},
    options:{now:()=>time,requestFrame:fn=>{frames.set(++id,fn);return id;},cancelFrame:key=>frames.delete(key),setTimer:(fn,ms)=>{timers.set(++id,{fn,at:time+ms});return id;},clearTimer:key=>timers.delete(key),isHidden:()=>hidden}
  };
}

test('Motion measurements separate actual draw costs, rendered-frame cadence and independent RAF intervals',async()=>{
  const c=clock();let callback,stopped=0;
  const result=measureMotionTrial({...c.options,play:fn=>{callback=fn;fn({time:0});return()=>stopped++;},draw:()=>c.advance(2)});
  c.frame(16);callback({time:16});c.frame(32);callback({time:32});c.frame(48);callback(null);
  const row=await result;assert.equal(row.supported,true);assert.equal(row.reason,'completed');assert.deepEqual(row.cpu,[2,2,2]);assert.deepEqual(row.rafIntervals,[16,16]);assert.deepEqual(row.paintIntervals,[16,16]);assert.equal(row.cleanupCpuMs,2);assert.equal(stopped,1);assert.equal(c.frames.size,0);assert.equal(c.timers.size,0);
});

test('An old overlay player with no rendered-unit callbacks is unsupported, never a measured zero-cost renderer',async()=>{
  const c=clock();let stopped=0;const result=measureMotionTrial({...c.options,play:()=>()=>stopped++,draw:()=>assert.fail('Old player supplies no draw callback')});
  c.frame(16);c.frame(32);c.expire(1500);const row=await result;
  assert.equal(row.supported,false);assert.equal(row.reason,'unsupported');assert.deepEqual(row.cpu,[]);assert.deepEqual(row.paintIntervals,[]);assert.equal(row.cleanupCpuMs,null);assert.equal(stopped,1);assert.equal(c.frames.size,0);assert.equal(c.timers.size,0);
});

test('An interrupted supported player is a timeout, not a successful benchmark',async()=>{
  const c=clock();let stopped=0;const result=measureMotionTrial({...c.options,play:fn=>{fn({time:0});return()=>stopped++;},draw:()=>{}});c.expire(1500);const row=await result;
  assert.equal(row.supported,true);assert.equal(row.reason,'timeout');assert.equal(stopped,1);assert.equal(c.frames.size,0);
});

test('Hidden tabs and draw failures reject measurements and cancel their observer/player',async()=>{
  for(const cause of ['hidden','draw-error']){
    const c=clock();let callback,stopped=0,fail=false;const result=measureMotionTrial({...c.options,play:fn=>{callback=fn;fn({time:0});return()=>stopped++;},draw:()=>{if(fail)throw Error('draw failed');}});
    const rejected=assert.rejects(result,cause==='hidden'?/hidden/:/draw failed/);
    if(cause==='hidden'){c.hide();c.frame(16);}else{fail=true;callback({time:16});}
    await rejected;assert.equal(stopped,1);assert.equal(c.frames.size,0);assert.equal(c.timers.size,0);
  }
});

test('A synchronous disabled player cleans up once without leaving a trial timeout',async()=>{
  const c=clock();let stopped=0;const row=await measureMotionTrial({...c.options,play:fn=>{fn(null);return()=>stopped++;},draw:()=>{}});
  assert.equal(row.supported,false);assert.equal(row.reason,'completed');assert.equal(stopped,1);assert.equal(c.frames.size,0);assert.equal(c.timers.size,0);
});
