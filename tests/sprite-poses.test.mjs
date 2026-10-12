import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {sampleSpritePose,spriteMesh} from '../src/ui/sprite-poses.js';
import {drawUnitSprite,loadTacticalArt,spriteHeight} from '../src/ui/unit-sprites.js';
import {spriteSpec} from '../src/ui/unit-sprites.js';
import {authoredFrame} from '../src/ui/sprite-frames.js';
import {clearArtCache} from '../src/ui/art.js';

const actions=['attack','cavalry-attack','throw','brace','hit','hurt','speak','rally','order','formation'];
const area=(a,b,c,posed=false)=>{const point=v=>[v.x+(posed?v.dx:0),v.y+(posed?v.dy:0)];const [ax,ay]=point(a),[bx,by]=point(b),[cx,cy]=point(c);return (bx-ax)*(cy-ay)-(cx-ax)*(by-ay);};
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}

test('Action keyposes show anticipation, impact and recovery, then return to the original silhouette',()=>{
  for(const name of actions){
    const end=sampleSpritePose({pose:name,progress:1}),start=sampleSpritePose({pose:name,progress:0}),middle=sampleSpritePose({pose:name,progress:.45});
    assert.deepEqual(end,start,name+' must settle without a discontinuous final sprite');
    assert.notDeepEqual(middle,start,name+' must visibly articulate');
  }
  for(const pose of ['attack','throw','cavalry-attack']){
    const windup=sampleSpritePose({pose,progress:.2}),impact=sampleSpritePose({pose,progress:.48});
    assert.ok(windup.lean<0&&impact.lean>0,pose+' transfers weight from wind-up to follow-through');
    assert.ok(windup.reach<0&&impact.reach>0);
  }
});

test('Distance-driven gait alternates swing feet and keeps the other foot planted',()=>{
  const a=sampleSpritePose({pose:'walk',progress:.3,stridePhase:Math.PI/2}),b=sampleSpritePose({pose:'walk',progress:.3,stridePhase:Math.PI*1.5});
  assert.ok(a.leftLift>0);assert.equal(a.rightLift,0);assert.ok(b.rightLift>0);assert.equal(b.leftLift,0);
  const mesh=spriteMesh(a),ankle=mesh.vertices.filter(v=>v.y===256);
  assert.equal(ankle.find(v=>v.x===144).dy,0,'stance-side pixels stay at the painted ground line');
  assert.ok(ankle.find(v=>v.x===48).dy<0,'swing-side pixels lift clear of ground');
  const matched=sampleSpritePose({pose:'walk',progress:.6,stridePhase:Math.PI/2});
  assert.equal(matched.left,a.left,'equal path-distance phase gives equal cadence away from easing edges');
  assert.ok(sampleSpritePose({pose:'run',progress:.3,stridePhase:Math.PI/2}).left>a.left);
});

test('Robes and riders use restrained separate movement while a held brace keeps a stable guard',()=>{
  const input={pose:'walk',progress:.3,stridePhase:Math.PI/2},foot=sampleSpritePose(input),robe=sampleSpritePose(input,{civic:true}),horse=sampleSpritePose({...input,pose:'cavalry-move'},{mounted:true});
  assert.ok(robe.left<foot.left&&robe.leftLift<foot.leftLift,'robe hem cannot split like trousered legs');
  assert.ok(horse.leftLift>foot.leftLift);assert.ok(horse.hip<=0,'rider settles differently from an infantry weight drop');
  const held=sampleSpritePose({pose:'idle'},{braced:true});assert.ok(held.guard>0&&held.hip>0);assert.equal(held.active,false,'settled guards stay on the one-stamp path');
});

test('Shared mesh covers each source point once and never folds or mirrors a limb across all keyposes',()=>{
  for(const mounted of [false,true])for(const civic of [false,true])for(const spear of [false,true])for(const direction of [-1,1])for(const hand of [-1,1]){
    const profile=freeze({mounted,civic,spear,direction,hand});
    for(const pose of [...actions,'walk','run','cavalry-move','retreat'])for(let step=0;step<=20;step++){
      const sample=sampleSpritePose(freeze({pose,progress:step/20}),profile),mesh=spriteMesh(sample,profile);
      assert.equal(mesh.vertices.length,30);assert.equal(mesh.triangles.length,40);
      let sourceArea=0;for(const ids of mesh.triangles){const points=ids.map(i=>mesh.vertices[i]),base=area(...points);sourceArea+=base/2;assert.ok(area(...points,true)/base>.3,`${pose} cannot invert or collapse a textured triangle`);}
      assert.equal(sourceArea,192*256);
      assert.ok(mesh.vertices.every(v=>Number.isFinite(v.dx)&&Number.isFinite(v.dy)&&Math.abs(v.dx)<=28&&Math.abs(v.dy)<=18),'articulation stays inside a bounded marker footprint');
    }
  }
});

test('Malformed optional motion fields remain finite and sampling never mutates frozen inputs',()=>{
  for(const pose of ['idle',...actions,'walk','run','retreat'])for(const value of [undefined,NaN,Infinity,-Infinity,-10,10]){
    const input=freeze({pose,progress:value,stridePhase:value,bob:value,lean:value}),profile=freeze({mounted:true,direction:-1,hand:1});
    const sample=sampleSpritePose(input,profile);assert.ok(Object.values(sample).every(v=>typeof v!=='number'||Number.isFinite(v)));
    assert.ok(spriteMesh(sample,profile).vertices.every(v=>Object.values(v).every(Number.isFinite)));
  }
});

const OriginalImage=globalThis.Image;
before(async()=>{globalThis.Image=class{naturalWidth=768;naturalHeight=1024;set src(value){this.url=value;if(value)queueMicrotask(()=>this.onload?.());}get src(){return this.url;}async decode(){}};clearArtCache();await loadTacticalArt({kind:'battle'});await loadTacticalArt({id:'ch11-adlection',kind:'contest'});});
after(()=>{clearArtCache();if(OriginalImage===undefined)delete globalThis.Image;else globalThis.Image=OriginalImage;});
function recorder(){const calls=[],stack=[];let alpha=1;const context=new Proxy({}, {get(_,key){if(key==='globalAlpha')return alpha;if(key==='save')return()=>stack.push(alpha);if(key==='restore')return()=>{alpha=stack.pop();};return(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),String(key));calls.push({method:key,args});};},set(_,key,value){if(key==='globalAlpha')alpha=value;return true;}});return {context,calls};}

test('Authored actions use one frame stamp and uncovered roles retain their original facing and equipment',()=>{
  for(const [u,chapter,contest] of [[{id:'hero',role:'infantry'},1,false],[{id:'enemy1',role:'archer',side:'enemy',name:'Persian archer'},5,false],[{id:'ally1',role:'cavalry'},9,false],[{id:'hero',role:'speaker'},11,true]])for(const facing of ['east','south','north','west']){
    const unit=freeze({...u,facing,hp:20,maxHp:20}),override=freeze({pose:contest?'speak':u.role==='archer'?'throw':u.role==='cavalry'?'cavalry-attack':'attack',progress:.46,facing}),g=freeze({tw:48}),board=recorder();
    const input=JSON.stringify({unit,override,g});assert.equal(drawUnitSprite(board.context,g,{x:90,y:100},unit,chapter,contest,override),true);
    const stamps=board.calls.filter(c=>c.method==='drawImage');const frame=authoredFrame(spriteSpec(unit,chapter,contest),facing,override,unit);assert.equal(stamps.length,frame?1:40);assert.equal(new Set(stamps.map(c=>JSON.stringify(c.args.slice(1,5)))).size,1,'one authored frame or one unchanged fallback facing/row');if(frame){assert.deepEqual(stamps[0].args.slice(1,5),frame.source);assert.equal(stamps[0].args[0].url,frame.asset);}
    assert.ok(!board.calls.some(c=>['stroke','fill','fillRect'].includes(c.method)),'no extra painted arm, sword or bow is overlaid');
    assert.equal(spriteHeight(g,unit),Math.min(140,48*(u.role==='cavalry'?1.62:1.36)));assert.equal(JSON.stringify({unit,override,g}),input);
  }
});

test('Settled sprites use one image call; a missing atlas preserves the existing fallback signal',async()=>{
  const board=recorder(),unit=freeze({id:'hero',facing:'east',hp:20,maxHp:20});
  drawUnitSprite(board.context,{tw:48},{x:0,y:0},unit,1,false,{pose:'attack',progress:1});assert.equal(board.calls.filter(c=>c.method==='drawImage').length,1);
  for(const braced of [false,true]){const idle=recorder();drawUnitSprite(idle.context,{tw:48},{x:0,y:0},{...unit,braced},1,false,{pose:'idle',bob:.2,lean:.009});assert.equal(idle.calls.filter(c=>c.method==='drawImage').length,1,'ambient breathing and settled guards cannot add mesh cost');}
  clearArtCache();assert.equal(drawUnitSprite(recorder().context,{tw:48},{x:0,y:0},unit,1,false),false);
  await loadTacticalArt({kind:'battle'});await loadTacticalArt({id:'ch11-adlection',kind:'contest'});
});
