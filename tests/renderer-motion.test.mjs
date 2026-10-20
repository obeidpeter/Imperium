import test from 'node:test';
import assert from 'node:assert/strict';
import {drawBattle,drawReignCard,geometry,pickTile} from '../src/ui/renderer.js';
import {snapshotEncounter,diffEncounterMotion,playEncounterMotion} from '../src/ui/motion.js';
import {newGame,choose,startEncounter} from '../src/core/game.js';
import {createBattlefieldFeatures} from '../src/showcase/battlefield-features.js';
import * as T from '../vendor/three/three.module.js';

test('A committed motion snapshot retains field geometry, walk surfaces and veteran identity',()=>{
  const e={id:'ch5-wall',kind:'battle',type:'defend',featureEdition:31,width:10,height:8,operation:{index:1},
    field:{objects:[{id:'bridge',kind:'bridge',state:'repaired',x:3,y:3},{id:'gate',kind:'gate',state:'open',x:4,y:2}]},
    units:[{id:'hero',veteranId:'marcellus',specialization:'guardian',x:1,y:3,hp:26,side:'player'}]};
  const scene=new T.Scene(),features=createBattlefieldFeatures(scene);
  features.sync(e);const initial=features.stats(),after=snapshotEncounter(e);
  after.turn=2;features.sync(after);
  assert.equal(features.stats().objects,2);assert.equal(features.stats().triangles,initial.triangles);
  assert.equal(after.units[0].veteranId,'marcellus');assert.equal(after.units[0].specialization,'guardian');
  assert.equal(after.operation.index,1);
  e.field.objects[0].state='broken';e.operation.index=2;e.units[0].specialization='scout';
  assert.equal(after.field.objects[0].state,'repaired');assert.equal(after.operation.index,1);assert.equal(after.units[0].specialization,'guardian');
  const bridge=features.group.userData.fieldObjects.find(o=>o.id==='bridge'),x=(bridge.min[0]+bridge.max[0])/2,z=(bridge.min[2]+bridge.max[2])/2;
  assert.ok(Number.isFinite(features.surfaceHeight(x,z)));features.dispose();
});

function mockCanvas(width,height){let operations=0;const values={font:'12px Georgia'},gradient={addColorStop(){}};const context=new Proxy(values,{get(object,key){if(key==='measureText')return text=>({width:String(text).length*(parseFloat(object.font)||12)*.56});if(key==='createLinearGradient'||key==='createRadialGradient')return(...args)=>{args.forEach(value=>assert.ok(Number.isFinite(value)));return gradient;};if(key in object)return object[key];return(...args)=>{operations++;if(key==='ellipse'){assert.ok(args[2]>=0,'ellipse radiusX must be nonnegative');assert.ok(args[3]>=0,'ellipse radiusY must be nonnegative');}if(key==='arc')assert.ok(args[2]>=0,'arc radius must be nonnegative');for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),String(key));};},set(object,key,value){object[key]=value;return true;}});return {width,height,getBoundingClientRect:()=>({left:0,top:0,width,height}),getContext:()=>context,operations:()=>operations};}
test('Painting keeps seeded campaign state unchanged and grid picking matches rendered centers',()=>{const state=newGame();choose(state,'report');startEncounter(state);const before=JSON.stringify(state);for(const[width,height]of[[360,196],[360,320],[720,480],[1280,900]]){const canvas=mockCanvas(width,height),g=geometry(canvas,state.encounter);drawBattle(canvas,state.encounter,'hero',[{x:1,y:3}],{x:2,y:3},1,{action:'move'});assert.ok(canvas.operations()>500);for(let x=0;x<8;x++)for(let y=0;y<8;y++){const picked=pickTile(canvas,state.encounter,g.ox+(x-y)*g.tw/2,g.oy+(x+y)*g.th/2);assert.ok(picked?.x===x&&picked?.y===y);}assert.equal(JSON.stringify(state),before);}});
test('Reign card renders maximum name and long URL with loaded art and fallback',()=>{const values={name:'W'.repeat(40),route:'settlement',choices:['Shelter for the displaced','Mercy after victory','Promises carried into power'],url:'https://example.test/'+('long-path-'.repeat(18))};const before=JSON.stringify(values);for(const portrait of[null,{complete:true,naturalWidth:1024,naturalHeight:1536}]){const canvas=mockCanvas(1080,1350);drawReignCard(canvas,{...values,portrait});assert.equal(canvas.width,1080);assert.equal(canvas.height,1350);assert.ok(canvas.operations()>30);}assert.equal(JSON.stringify(values),before);});
test('Motion snapshot is detached and Resolve is not reported twice as health damage',()=>{const e={id:'vote',kind:'contest',width:8,height:8,turn:1,status:'active',units:[{id:'hero',x:1,y:3,hp:12,resolve:12,morale:80,side:'player'},{id:'member',x:2,y:3,hp:1,stance:0,side:'neutral'}]},before=snapshotEncounter(e);e.units[0].x=2;e.units[0].hp=8;e.units[0].resolve=8;e.units[0].morale=70;e.units[1].stance=3;assert.equal(before.units[0].x,1);const after=snapshotEncounter(e),frozen=JSON.stringify({before,after}),changes=diffEncounterMotion(before,after);assert.deepEqual(changes.map(item=>item.type),['move','resolve','morale','stance']);assert.equal(changes.find(item=>item.type==='resolve').delta,-4);assert.equal(JSON.stringify({before,after}),frozen);assert.deepEqual(diffEncounterMotion(before,{...after,id:'different'}),[]);});
test('Motion reports defections but avoids leaking hidden positions; reduced motion needs no DOM',()=>{const e={id:'battle',kind:'battle',width:8,height:8,units:[{id:'enemy',x:6,y:2,hp:8,side:'enemy'},{id:'ambush',x:7,y:5,hp:8,side:'enemy',hidden:true}]},before=snapshotEncounter(e);e.units[0].side='ally';e.units[1].x=5;const after=snapshotEncounter(e),changes=diffEncounterMotion(before,after);assert.equal(changes.length,1);assert.equal(changes[0].type,'allegiance');assert.equal(typeof playEncounterMotion({},before,after,{reducedMotion:true}),'function');assert.equal(typeof playEncounterMotion(null,before,after,{}),'function');});
test('Motion layers cancel when hidden or superseded and cannot intercept commands',()=>{
  const listeners=new Map(),animations=[],layers=[];
  function node(){return {style:{},attributes:{},children:[],setAttribute(key,value){this.attributes[key]=value;},append(child){this.children.push(child);},remove(){this.removed=true;},animate(frames,options){const animation={frames,options,cancel(){this.cancelled=true;}};animations.push(animation);return animation;}};}
  const doc={hidden:false,createElement:node,createElementNS:node,body:{append(layer){layers.push(layer);}},addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);},defaultView:{addEventListener(){},removeEventListener(){}}};
  const canvas={...mockCanvas(720,480),ownerDocument:doc,isConnected:true};
  const before={id:'battle',kind:'battle',width:8,height:8,units:[{id:'hero',x:1,y:3,hp:22,side:'player'}]},after={...before,units:[{...before.units[0],x:2,hp:19}]},frozen=JSON.stringify({before,after});
  const first=playEncounterMotion(canvas,before,after);
  assert.equal(layers.length,1);assert.equal(layers[0].style.pointerEvents,'none');assert.equal(layers[0].attributes['aria-hidden'],'true');assert.ok(animations.every(animation=>animation.options.duration>=200&&animation.options.duration<=400));
  const second=playEncounterMotion(canvas,before,after);assert.equal(layers[0].removed,true);assert.equal(layers[1].removed,undefined);
  doc.hidden=true;listeners.get('visibilitychange')();assert.equal(layers[1].removed,true);assert.ok(animations.every(animation=>animation.cancelled));assert.equal(listeners.size,0);first();second();assert.equal(JSON.stringify({before,after}),frozen);
});


test('Collapsed boards do not paint or pick and retain finite positive fallback geometry',()=>{
  const state=newGame();choose(state,'report');startEncounter(state);const before=JSON.stringify(state);
  for(const [width,height] of [[0,0],[0,196],[360,0],[33,196],[360,79],[34,80]]){
    const canvas=mockCanvas(width,height),g=geometry(canvas,state.encounter);
    assert.ok(Object.values(g).every(Number.isFinite));assert.ok(g.tw>0&&g.th>0);
    assert.doesNotThrow(()=>drawBattle(canvas,state.encounter));assert.equal(canvas.operations(),0,`${width}×${height} must defer painting`);
    assert.deepEqual(pickTile(canvas,state.encounter,0,0),{x:-1,y:-1});
    assert.equal(canvas.width,width);assert.equal(canvas.height,height);
  }
  assert.equal(JSON.stringify(state),before);
});

test('Small laid-out boards use valid Canvas radii and keep the original fit formula',()=>{
  const state=newGame();choose(state,'report');startEncounter(state);
  for(const [width,height] of [[35,81],[360,81],[360,196],[320,196]]){
    const canvas=mockCanvas(width,height),g=geometry(canvas,state.encounter);
    assert.equal(g.tw,Math.min((width-34)/8,(height-80)/(16*.24)));
    assert.doesNotThrow(()=>drawBattle(canvas,state.encounter,'hero',[{x:1,y:3}],{x:2,y:3},1,{action:'move'}));
    assert.ok(canvas.operations()>500);
  }
});

test('A battle render uses one layout snapshot throughout canvas setup and drawing',()=>{
  const state=newGame();choose(state,'report');startEncounter(state);const canvas=mockCanvas(360,196);let reads=0;
  canvas.getBoundingClientRect=()=>++reads===1?{left:0,top:0,width:360,height:196}:{left:0,top:0,width:0,height:0};
  assert.doesNotThrow(()=>drawBattle(canvas,state.encounter));assert.equal(reads,1);assert.ok(canvas.operations()>500);
});
