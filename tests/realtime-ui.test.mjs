import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_KEYMAP,FIXED_ACTIONS,actionFor,bindingProblem,eventBinding,keyLabel,keymapProblems,learnKey,remapAction} from '../src/ui/action-map.js';
import {HOLD_REPEAT_MS,bindRealtimeInput} from '../src/showcase/realtime-input.js';
import {simPoint,stageTile,stageUnit,swingPhase,worldPoint} from '../src/showcase/live-figures.js';
import {ACTOR_TIMING} from '../src/showcase/actor-pose.js';
import {createShowcaseSession} from '../src/showcase/session.js';
import {createArenaWorld} from '../src/core/realtime/arena.js';

const key=(code,{key='',shift=false,ctrl=false,meta=false,alt=false}={})=>({code,key,shiftKey:shift,ctrlKey:ctrl,metaKey:meta,altKey:alt});

test('H41: no forbidden key is bound by default, and the remap rejects them',()=>{
  assert.deepEqual(keymapProblems(DEFAULT_KEYMAP),[]);
  const all=Object.values(DEFAULT_KEYMAP).flat();
  for(const code of ['F1','F3','F5','F6','F7','F10','F11','F12','Tab','AltLeft'])assert.ok(!all.includes(code),code);
  assert.ok(all.every(b=>!/Ctrl|Meta|Alt\+/.test(b)),'nothing with Ctrl, Cmd or Alt');
  for(const bad of ['F5','F12','Tab','AltLeft','Ctrl+KeyS','Alt+Digit1','Meta+KeyW'])assert.ok(remapAction(DEFAULT_KEYMAP,'war_cry',bad).problem,bad);
  assert.ok(bindingProblem('Escape'),'Esc cannot be taken');assert.ok(remapAction(DEFAULT_KEYMAP,'cancel_or_menu','KeyK').problem,'Esc cannot be remapped');
  for(const action of FIXED_ACTIONS)assert.ok(remapAction(DEFAULT_KEYMAP,action,'KeyK').problem,action);
});

test('bindings follow the physical key; Ctrl, Cmd and Alt combinations stay with the browser; ? opens help on any layout',()=>{
  assert.equal(actionFor(key('KeyT')),'target_next_enemy');assert.equal(actionFor(key('KeyT',{shift:true})),'target_next_friend');
  assert.equal(actionFor(key('KeyQ',{key:'a'})),'panel_orders','AZERTY: the key in the Q place keeps its action');
  assert.equal(actionFor(key('KeyS',{ctrl:true})),null);assert.equal(actionFor(key('Digit1',{meta:true})),null);assert.equal(actionFor(key('KeyB',{alt:true})),null);
  assert.equal(eventBinding(key('ShiftLeft',{shift:true})),'ShiftLeft');
  assert.equal(actionFor(key('Comma',{key:'?',shift:true})),'help','a French keyboard types ? elsewhere');
  assert.equal(actionFor(key('Space',{shift:true})),'combat_toggle','Shift with a plain key keeps its action');
  assert.equal(actionFor(key('Digit3',{shift:true})),'select_squad_3');assert.equal(actionFor(key('Pause')),'pause');
});

test('remapping swaps on conflict and labels follow the layout learnt from the keys',()=>{
  const {keymap}=remapAction(DEFAULT_KEYMAP,'war_cry','KeyT');
  assert.deepEqual(keymap.war_cry,['KeyT']);assert.deepEqual(keymap.target_next_enemy,['KeyB'],'the displaced action takes the old key');
  assert.equal(keyLabel('KeyZ'),'Z');learnKey(key('KeyZ',{key:'w'}));assert.equal(keyLabel('KeyZ'),'W','learnt from an AZERTY press');
  assert.equal(keyLabel('Shift+KeyT'),'Shift+T');
});

// A canvas stand-in that records listeners and their options.
function fakeCanvas(){
  const target=new EventTarget(),listeners=[];const add=target.addEventListener.bind(target);
  target.addEventListener=(type,fn,options)=>{listeners.push({type,options});add(type,fn,options);};
  return Object.assign(target,{style:{},listeners,captured:[],focus(){},setPointerCapture(id){this.captured.push(id);}});
}
// Pointer fields on a plain Event (Node has no PointerEvent); timeStamp is the Event's own.
const pointer=(type,props={})=>Object.assign(new Event(type,{cancelable:true}),{button:0,pointerType:'mouse',pointerId:1,clientX:10,clientY:10,...props});
function fakeTimers(){
  const timers={now:0,list:[],next:1,
    setTimeout(fn,ms){const id=timers.next++;timers.list.push({id,fn,at:timers.now+ms});return id;},clearTimeout(id){timers.list=timers.list.filter(t=>t.id!==id);},
    setInterval(fn,ms){const id=timers.next++;timers.list.push({id,fn,at:timers.now+ms,every:ms});return id;},clearInterval(id){timers.clearTimeout(id);},
    advance(ms){const end=timers.now+ms;for(;;){const due=timers.list.filter(t=>t.at<=end).sort((a,b)=>a.at-b.at)[0];if(!due)break;timers.now=due.at;
      if(due.every)due.at+=due.every;else timers.list=timers.list.filter(t=>t!==due);due.fn();}timers.now=end;}};
  return timers;
}

test('H41: the scene keeps its browser defaults: no context menu, page zoom, gestures or autoscroll; no dblclick anywhere',()=>{
  const canvas=fakeCanvas(),timers=fakeTimers(),seen=[];
  bindRealtimeInput(canvas,{press:p=>seen.push(['press',p.button]),zoom:d=>seen.push(['zoom',Math.sign(d)])},{timers,nav:{platform:'Win32'}});
  const wheel=canvas.listeners.find(l=>l.type==='wheel');assert.equal(wheel.options?.passive,false,'the wheel listener can cancel page zoom');
  assert.ok(!canvas.listeners.some(l=>l.type==='dblclick'),'no dblclick handler');
  for(const type of ['contextmenu','wheel','gesturestart','gesturechange']){
    const e=pointer(type,{deltaY:120});canvas.dispatchEvent(e);assert.equal(e.defaultPrevented,true,type);
  }
  const middle=pointer('pointerdown',{button:1});canvas.dispatchEvent(middle);assert.equal(middle.defaultPrevented,true,'no autoscroll');
  canvas.dispatchEvent(pointer('pointerup',{button:1}));
  assert.equal(canvas.style.touchAction,'none');assert.equal(canvas.style.overscrollBehavior,'none');assert.equal(canvas.style.webkitTouchCallout,'none');
  assert.deepEqual(seen.filter(([k])=>k==='press'),[],'the middle button never acts');
});

test('the right button, Ctrl+click on a Mac and swapped buttons; hold-to-move repeats every 200 ms until release',()=>{
  const canvas=fakeCanvas(),timers=fakeTimers(),seen=[];let swap=false;
  bindRealtimeInput(canvas,{press:p=>seen.push(p.button),hold:()=>seen.push('hold'),release:()=>seen.push('release')},{timers,nav:{platform:'MacIntel'},swapButtons:()=>swap});
  canvas.dispatchEvent(pointer('pointerdown',{button:2}));canvas.dispatchEvent(pointer('pointerup',{button:2}));
  canvas.dispatchEvent(pointer('pointerdown',{button:0,ctrlKey:true}));canvas.dispatchEvent(pointer('pointerup',{button:0}));
  assert.deepEqual(seen,['right','right']);seen.length=0;
  canvas.dispatchEvent(pointer('pointerdown',{button:0}));timers.advance(HOLD_REPEAT_MS*3+10);canvas.dispatchEvent(pointer('pointerup',{button:0}));
  timers.advance(1000);assert.deepEqual(seen,['left','hold','hold','hold','release'],'held: re-issued, then nothing after release');
  seen.length=0;swap=true;canvas.dispatchEvent(pointer('pointerdown',{button:0}));canvas.dispatchEvent(pointer('pointerup',{button:0}));assert.deepEqual(seen,['right']);
});

test('touch: a tap is a left click; a still hold inspects and its release does nothing; two fingers pinch and twist',()=>{
  const canvas=fakeCanvas(),timers=fakeTimers(),seen=[];
  bindRealtimeInput(canvas,{press:p=>seen.push(['press',p.button]),inspect:()=>seen.push(['inspect']),zoom:d=>seen.push(['zoom',Math.sign(d)]),
    rotate:()=>seen.push(['rotate'])},{timers,holdDelay:()=>450});
  const touch=(type,id,x,y)=>canvas.dispatchEvent(pointer(type,{pointerType:'touch',pointerId:id,clientX:x,clientY:y}));
  touch('pointerdown',1,50,50);timers.advance(100);touch('pointerup',1,50,50);assert.deepEqual(seen,[['press','left']]);seen.length=0;
  touch('pointerdown',1,50,50);timers.advance(500);touch('pointerup',1,50,50);assert.deepEqual(seen,[['inspect']],'lifting after a hold does nothing');seen.length=0;
  touch('pointerdown',1,40,50);touch('pointerdown',2,60,50);touch('pointermove',2,90,50);
  assert.ok(seen.some(([k,s])=>k==='zoom'&&s<0),'spreading the fingers zooms in');assert.ok(seen.some(([k])=>k==='rotate'));
  touch('pointerup',2,90,50);touch('pointerup',1,40,50);assert.ok(!seen.some(([k])=>k==='press'),'a pinch is not a tap');
});

test('the presenter lands the figure\'s authored contact on the simulation\'s half-swing, and maps places both ways',()=>{
  assert.equal(swingPhase(0),0);assert.equal(swingPhase(.5),ACTOR_TIMING.contact);assert.equal(swingPhase(1),1);assert.ok(swingPhase(.25)<swingPhase(.75));
  const world=createArenaWorld(createShowcaseSession().encounter,{seed:3}),p={x:3.3,z:17.1};
  const back=simPoint(world,worldPoint(world,p));assert.ok(Math.abs(back.x-p.x)<1e-9&&Math.abs(back.z-p.z)<1e-9);
  assert.deepEqual(stageTile(1.25,1.25),{x:0,y:0},'a tile centre is that tile');
  const hero=stageUnit(world.actors[0]),axe=stageUnit(world.actors.find(a=>a.id==='raider-axe')),spear=stageUnit(world.actors.find(a=>a.id==='raider-spear'));
  assert.equal(hero.trained,true);assert.equal(hero.shield,true);assert.equal(axe.shield,false,'no shield drawn where the rules give none');assert.equal(spear.shield,true);
});
