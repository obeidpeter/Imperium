import test from 'node:test';
import assert from 'node:assert/strict';
import {GRAPHICS_MODES,defaultGraphicsMode,createGraphicsQuality} from '../src/ui/graphics-quality.js';

test('QUALITY-01 default is balanced; reduced-data or valid low-memory hints start conservatively',()=>{
  assert.equal(defaultGraphicsMode(),'balanced');
  assert.equal(defaultGraphicsMode({deviceMemory:8}),'balanced');
  assert.equal(defaultGraphicsMode({deviceMemory:2}),'performance');
  assert.equal(defaultGraphicsMode({saveData:true}),'performance');
  assert.equal(defaultGraphicsMode({deviceMemory:0}),'balanced');
  assert.equal(createGraphicsQuality({mode:'high',saveData:true}).mode,'high');
});
test('QUALITY-02 occasional expensive draws cannot trigger a downgrade',()=>{
  const quality=createGraphicsQuality({mode:'high'});
  for(let i=0;i<200;i++)quality.recordFrame(i%10===0?80:8);
  assert.equal(quality.mode,'high');assert.equal(quality.stats().downgrades,0);
});
test('QUALITY-03 repeated measured cost downgrades one step and requires a fresh sample window',()=>{
  const notices=[],quality=createGraphicsQuality({mode:'high',onChange:change=>notices.push(change)});
  for(let i=0;i<29;i++)quality.recordFrame(28);
  assert.equal(quality.mode,'high');
  assert.equal(quality.recordFrame(28).changed,true);assert.equal(quality.mode,'balanced');
  for(let i=0;i<29;i++)quality.recordFrame(28);
  assert.equal(quality.mode,'balanced');quality.recordFrame(28);
  assert.equal(quality.mode,'performance');assert.equal(quality.stats().downgrades,2);
  assert.deepEqual(notices.map(notice=>notice.reason),['measured-cost','measured-cost']);
});
test('QUALITY-04 fast samples never automatically upgrade and player selection resets evidence',()=>{
  const quality=createGraphicsQuality({mode:'performance'});
  for(let i=0;i<100;i++)quality.recordFrame(2);
  assert.equal(quality.mode,'performance');
  quality.setMode('high');assert.equal(quality.mode,'high');assert.equal(quality.stats().samples,0);
  assert.throws(()=>quality.setMode('ultra'),/Unknown graphics mode/);
  assert.equal(quality.mode,'high');
});
test('QUALITY-05 hidden, idle and invalid timing samples never influence quality',()=>{
  const quality=createGraphicsQuality();
  for(let i=0;i<60;i++){
    quality.recordFrame(1000,{hidden:true});quality.recordFrame(1000,{active:false});
    quality.recordFrame(NaN);quality.recordFrame(Infinity);quality.recordFrame(-1);
  }
  assert.equal(quality.stats().totalSamples,0);assert.equal(quality.mode,'balanced');
});
test('QUALITY-06 retained statistics stay bounded over a long session and profiles are immutable',()=>{
  const quality=createGraphicsQuality();
  for(let i=0;i<10000;i++)quality.recordFrame(8);
  const stats=quality.stats();
  assert.equal(stats.totalSamples,10000);assert.equal(stats.samples,30);assert.equal(stats.meanMs,8);assert.equal(stats.p95Ms,8);
  assert.equal(Object.isFrozen(GRAPHICS_MODES),true);
  for(const mode of Object.values(GRAPHICS_MODES))assert.equal(Object.isFrozen(mode),true);
  assert.equal(quality.profile,GRAPHICS_MODES.balanced);
});
test('QUALITY-07 after an automatic step down, a long fast run steps back up, never above the player\'s choice',()=>{
  const notices=[],quality=createGraphicsQuality({mode:'high',onChange:change=>notices.push(change)});
  for(let i=0;i<30;i++)quality.recordFrame(28);
  for(let i=0;i<30;i++)quality.recordFrame(28);
  assert.equal(quality.mode,'performance');
  // One slow frame breaks the run: no step up yet.
  for(let i=0;i<599;i++)quality.recordFrame(5);
  quality.recordFrame(15);
  for(let i=0;i<299;i++)quality.recordFrame(5);
  assert.equal(quality.mode,'performance');
  quality.recordFrame(5);
  assert.equal(quality.mode,'balanced');
  // Each step needs its own quiet period and run.
  for(let i=0;i<599;i++)quality.recordFrame(5);
  assert.equal(quality.mode,'balanced');
  quality.recordFrame(5);
  assert.equal(quality.mode,'high');
  for(let i=0;i<5000;i++)quality.recordFrame(2);
  assert.equal(quality.mode,'high','Never above the chosen tier');
  assert.deepEqual(notices.map(n=>n.reason),['measured-cost','measured-cost','measured-headroom','measured-headroom']);
  assert.equal(quality.stats().upgrades,2);assert.equal(quality.stats().chosen,'high');
});
test('QUALITY-08 a player choice becomes the ceiling for recovery',()=>{
  const quality=createGraphicsQuality({mode:'high'});
  for(let i=0;i<30;i++)quality.recordFrame(28);
  assert.equal(quality.mode,'balanced');
  quality.setMode('balanced');
  for(let i=0;i<5000;i++)quality.recordFrame(2);
  assert.equal(quality.mode,'balanced');assert.equal(quality.stats().chosen,'balanced');
});
