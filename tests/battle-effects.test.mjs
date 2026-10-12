import test from 'node:test';
import assert from 'node:assert/strict';
import {projectilePose,footfallSamples,drawBattleEffects} from '../src/ui/battle-effects.js';
const g={ox:180,oy:45,tw:40,th:19.2};
test('Projectile flight has exact hand-height endpoints and a raised midpoint, with finite tangents',()=>{
  const effect={from:{x:1,y:2},to:{x:5,y:2}};
  const start=projectilePose(effect,g,0),middle=projectilePose(effect,g,.5),end=projectilePose(effect,g,1);
  assert.equal(start.x,160);assert.equal(end.x,240);
  assert.ok(middle.y<(start.y+end.y)/2);
  for(const t of [-100,0,.001,.5,.99,1,100,NaN])for(const n of Object.values(projectilePose(effect,g,t)))assert.ok(Number.isFinite(n));
  const same=projectilePose({from:{x:1,y:1},to:{x:1,y:1}},g,.5);assert.ok(Number.isFinite(same.angle));
});
test('Footfalls follow each orthogonal segment and preserve marsh surface instead of crossing a blocked shortcut',()=>{
  const effect={path:[{x:0,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],surfaces:['earth','marsh','ford','earth'],progress:.6};
  const before=JSON.stringify(effect),samples=footfallSamples(effect,'high');
  assert.equal(samples.length,5);assert.ok(samples.some(p=>p.surface==='marsh'||p.surface==='ford'));
  for(const p of samples){assert.ok(p.x===0&&p.y>=0&&p.y<=1||p.y===1&&p.x>=0&&p.x<=2);assert.ok(p.alpha>=0&&p.alpha<=1);}
  assert.deepEqual(footfallSamples(effect,'performance'),[]);assert.ok(footfallSamples(effect,'balanced').length<=3);
  assert.equal(JSON.stringify(effect),before);assert.deepEqual(footfallSamples(effect,'high'),samples);
  const early=footfallSamples({...effect,progress:.25},'balanced');
  assert.equal(early[0].y,.46875,'newest footfall follows the same eased distance as the unit');
  assert.ok(early.every(p=>p.x===0&&p.y<=early[0].y),'older footfalls cannot lead the moving unit');
});
test('Effects restore Canvas state and do not mutate frames or submit invalid drawing geometry',()=>{
  const stack=[],calls=[];let alpha=1;
  const c=new Proxy({}, {get(_,key){if(key==='globalAlpha')return alpha;if(key==='save')return()=>stack.push(alpha);if(key==='restore')return()=>{assert.ok(stack.length);alpha=stack.pop();};return(...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),key);if(key==='ellipse'||key==='arc')assert.ok(args[2]>=0);calls.push(key);};},set(_,key,value){if(key==='globalAlpha')alpha=value;return true;}});
  const effects=['projectile','dust','slash','impact','shield','speech','stance','defeat'].map(type=>({type,from:{x:1,y:2},to:{x:3,y:2},at:{x:3,y:2},source:{x:1,y:2},path:[{x:1,y:2},{x:2,y:2},{x:3,y:2}],progress:.4,alpha:.7,essential:type!=='dust'&&type!=='slash'}));
  const frame={effects},before=JSON.stringify(frame);
  for(const quality of ['performance','balanced','high']){drawBattleEffects(c,g,frame,quality);assert.equal(stack.length,0);assert.equal(alpha,1);}
  assert.ok(calls.includes('arc'));assert.ok(calls.includes('ellipse'));assert.equal(JSON.stringify(frame),before);
});
