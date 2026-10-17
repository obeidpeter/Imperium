import test from 'node:test';
import assert from 'node:assert/strict';
import {createGpuTimer,createResolutionBudget} from '../src/showcase/frame-budget.js';

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
