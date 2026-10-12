import test from 'node:test';
import assert from 'node:assert/strict';
import {AMBIENT_BUDGET,playAmbientScene} from '../src/ui/ambient.js';

function browser(){
  const raf=new Map(),timers=new Map(),listeners=new Map(),documentListeners=new Map();let sequence=0,time=0;
  const win={performance:{now:()=>time},requestAnimationFrame(fn){raf.set(++sequence,fn);return sequence;},cancelAnimationFrame(id){raf.delete(id);},setTimeout(fn,ms){timers.set(++sequence,{fn,at:time+ms});return sequence;},clearTimeout(id){timers.delete(id);},addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);}};
  const doc={hidden:false,defaultView:win,addEventListener(type,fn){documentListeners.set(type,fn);},removeEventListener(type,fn){if(documentListeners.get(type)===fn)documentListeners.delete(type);}};
  const canvas={ownerDocument:doc,isConnected:true,getBoundingClientRect:()=>({width:360,height:196})};
  return {canvas,doc,raf,timers,listeners,documentListeners,
    frame(ms){time=ms;const batch=[...raf.values()];raf.clear();batch.forEach(fn=>fn(ms));},
    clock(ms){time=ms;for(const[id,timer]of timers)if(timer.at<=ms){timers.delete(id);timer.fn();}},
    event(type){(type==='visibilitychange'?documentListeners:listeners).get(type)?.();}
  };
}

test('Ambient arrival frames respect 12/20fps caps and finish within six seconds with no remaining work',()=>{
  const counts={};for(const quality of ['balanced','high']){
    const b=browser(),frames=[],cancel=playAmbientScene(b.canvas,{quality,onFrame:t=>frames.push(t)});
    assert.equal(frames[0],0);assert.equal(b.raf.size,1);assert.equal(b.timers.size,1);
    for(let t=10;t<=6200;t+=10)b.frame(t);
    const times=frames.filter(t=>t!==null),fps=quality==='high'?20:12;counts[quality]=times.length;
    assert.ok(times.length<=fps*6+1);assert.ok(times.length>=fps*5);assert.ok(times.every(t=>t>=0&&t<6000));
    for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=1000/fps);
    assert.equal(frames.at(-1),null);assert.equal(frames.filter(t=>t===null).length,1);assert.equal(b.raf.size,0);assert.equal(b.timers.size,0);assert.equal(b.listeners.size,0);assert.equal(b.documentListeners.size,0);
    cancel();cancel();assert.equal(frames.filter(t=>t===null).length,1);
  }
  assert.ok(counts.high>counts.balanced);assert.equal(AMBIENT_BUDGET.durationMs,6000);
});

test('Performance mode, reduced motion, hidden/detached boards and collapsed layouts do not schedule ambient work',()=>{
  for(const condition of ['performance','reduced','hidden','detached','collapsed']){
    const b=browser(),frames=[];if(condition==='hidden')b.doc.hidden=true;if(condition==='detached')b.canvas.isConnected=false;if(condition==='collapsed')b.canvas.getBoundingClientRect=()=>({width:0,height:0});
    const cancel=playAmbientScene(b.canvas,{quality:condition==='performance'?'performance':'high',reducedMotion:condition==='reduced',onFrame:t=>frames.push(t)});cancel();
    assert.deepEqual(frames,[null]);assert.equal(b.raf.size,0);assert.equal(b.timers.size,0);assert.equal(b.listeners.size,0);
  }
  assert.doesNotThrow(()=>playAmbientScene(null));
});

test('Scroll, resize, hiding, detachment and explicit cancellation restore the static board exactly once',()=>{
  for(const trigger of ['scroll','resize','visibilitychange','detach','cancel']){
    const b=browser(),frames=[],cancel=playAmbientScene(b.canvas,{onFrame:t=>frames.push(t)});b.frame(100);
    if(trigger==='visibilitychange')b.doc.hidden=true;
    if(trigger==='detach'){b.canvas.isConnected=false;b.frame(120);}else if(trigger==='cancel')cancel();else b.event(trigger);
    assert.equal(frames.at(-1),null);assert.equal(b.raf.size,0);assert.equal(b.timers.size,0);assert.equal(b.listeners.size,0);assert.equal(b.documentListeners.size,0);
    cancel();b.frame(1000);assert.equal(frames.filter(t=>t===null).length,1);
  }
});

test('Superseding an arrival beat cancels the prior player and a timer bounds work even if RAF stalls',()=>{
  const b=browser(),first=[],second=[];
  const stopFirst=playAmbientScene(b.canvas,{onFrame:t=>first.push(t)}),stopSecond=playAmbientScene(b.canvas,{onFrame:t=>second.push(t)});
  assert.deepEqual(first,[0,null]);assert.deepEqual(second,[0]);assert.equal(b.raf.size,1);assert.equal(b.timers.size,1);
  stopFirst();assert.equal(b.raf.size,1);b.clock(6000);assert.deepEqual(second,[0,null]);assert.equal(b.raf.size,0);assert.equal(b.timers.size,0);stopSecond();
});

test('A renderer failure cannot leave a background ambient loop or listeners running',()=>{
  const b=browser(),frames=[];playAmbientScene(b.canvas,{onFrame:t=>{frames.push(t);if(t>0)throw Error('paint failed');}});
  assert.throws(()=>b.frame(100),/paint failed/);assert.equal(frames.at(-1),null);assert.equal(b.raf.size,0);assert.equal(b.timers.size,0);assert.equal(b.listeners.size,0);assert.equal(b.documentListeners.size,0);
});

test('Initial drawing time counts toward the same six-second deadline',()=>{
  const b=browser(),frames=[];playAmbientScene(b.canvas,{onFrame:t=>{frames.push(t);if(t===0)b.clock(3000);}});
  assert.equal([...b.timers.values()][0].at,6000);b.clock(6000);assert.deepEqual(frames,[0,null]);assert.equal(b.raf.size,0);
});

test('An active command stage can sustain atmosphere, but visibility cancellation releases every scheduled frame',()=>{
  const b=browser(),frames=[];playAmbientScene(b.canvas,{continuous:true,onFrame:t=>frames.push(t)});
  b.frame(7000);assert.equal(frames.at(-1),7000);assert.equal(b.timers.size,0);assert.equal(b.raf.size,1);
  b.doc.hidden=true;b.event('visibilitychange');assert.equal(frames.at(-1),null);assert.equal(b.raf.size,0);assert.equal(b.documentListeners.size,0);
});
