import test from 'node:test';
import assert from 'node:assert/strict';
import {setupSiteMedia} from '../src/ui/site-media.js';

function environment({observer=true}={}){
  const saved=new Map(['window','document','IntersectionObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const requests=[],buttons=[],observers=[];
  const images=['battle','contest','world'].map(id=>({dataset:{src:`./${id}.webp`},classList:{add(){}},after(button){buttons.push(button);},set src(value){requests.push([id,value]);}}));
  class Observer{constructor(callback,options){this.callback=callback;this.options=options;this.observed=[];this.unobserved=[];observers.push(this);}observe(image){this.observed.push(image);}unobserve(image){this.unobserved.push(image);}disconnect(){this.disconnected=true;}}
  const document={createElement(){const handlers=new Map();return {removed:false,addEventListener(name,handler){handlers.set(name,handler);},removeEventListener(name,handler){if(handlers.get(name)===handler)handlers.delete(name);},remove(){this.removed=true;},click(){handlers.get('click')?.();}};}};
  for(const [key,value] of Object.entries({window:observer?{IntersectionObserver:Observer}:{},document,IntersectionObserver:Observer}))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  return {images,requests,buttons,observers,root:{querySelectorAll:()=>images},restore(){for(const [key,value] of saved)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}};
}

test('Optional media defers normal connections until an intersecting entry and loads each image once',()=>{
  const env=environment();try{
    const cancel=setupSiteMedia(env.root,{effectiveType:'4g',downlink:10});assert.deepEqual(env.requests,[]);
    const observer=env.observers[0];assert.equal(observer.options.rootMargin,'80px');assert.deepEqual(observer.observed,env.images);
    observer.callback([{target:env.images[0],isIntersecting:false}]);assert.deepEqual(env.requests,[]);
    observer.callback([{target:env.images[0],isIntersecting:true},{target:env.images[0],isIntersecting:true}]);
    assert.deepEqual(env.requests,[['battle','./battle.webp']]);cancel();assert.equal(observer.disconnected,true);
  }finally{env.restore();}
});

test('Save-Data, 2G and sub-1Mbps connections require a separate image opt-in',()=>{
  for(const connection of [{saveData:true},{effectiveType:'slow-2g'},{effectiveType:'2g'},{downlink:0.8}]){
    const env=environment();try{
      const cancel=setupSiteMedia(env.root,connection);assert.deepEqual(env.requests,[]);assert.equal(env.observers.length,0);assert.equal(env.buttons.length,3);
      env.buttons[1].click();assert.deepEqual(env.requests,[['contest','./contest.webp']]);assert.equal(env.buttons[1].removed,true);cancel();
    }finally{env.restore();}
  }
});

test('Leaving the landing page makes already-queued observer callbacks inert',()=>{
  const env=environment();try{
    const cancel=setupSiteMedia(env.root,{effectiveType:'4g'}),queued=env.observers[0].callback;
    cancel();cancel();queued([{target:env.images[0],isIntersecting:true}]);assert.deepEqual(env.requests,[]);assert.equal(env.observers[0].disconnected,true);
  }finally{env.restore();}
});

test('Leaving the limited-data page cancels its opt-in handlers without fetching images',()=>{
  const env=environment();try{
    const cancel=setupSiteMedia(env.root,{saveData:true}),oldButtons=env.buttons.slice();cancel();oldButtons.forEach(button=>button.click());
    assert.deepEqual(env.requests,[]);assert.ok(oldButtons.every(button=>button.removed));
  }finally{env.restore();}
});

test('Browsers without IntersectionObserver still receive optional artwork on ordinary connections',()=>{
  const env=environment({observer:false});try{setupSiteMedia(env.root,{});assert.equal(env.requests.length,3);assert.equal(env.buttons.length,0);}finally{env.restore();}
});
