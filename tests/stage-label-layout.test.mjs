import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutStageLabels,labelsOverlap} from '../src/showcase/stage-label-layout.js';

test('Crowded political labels remain within the viewport and never overlap',()=>{
  for(const width of [320,345,640,1368]){
    const input=Array.from({length:13},(_,i)=>Object.freeze({id:`member-${i}`,x:width/2+(i%4-1.5)*28,y:210+Math.floor(i/4)*24,width:i===0?132:34,height:i===0?48:19,priority:i===0?100:30,visible:true}));
    Object.freeze(input);const encoded=JSON.stringify(input),layout=layoutStageLabels(input,{width,height:420}),visible=[...layout.values()].filter(r=>r.visible);
    assert.ok(layout.get('member-0').visible,'The selected speaker has priority.');assert.ok(visible.length>=10,'Compact labels preserve a useful view of the electorate.');
    for(const [i,r]of visible.entries()){
      assert.ok(r.x>=8&&r.y>=8&&r.x+r.width<=width-8&&r.y+r.height<=412);
      assert.ok(visible.slice(i+1).every(other=>!labelsOverlap(r,other)));
    }
    assert.equal(JSON.stringify(input),encoded);assert.deepEqual([...layout],[...layoutStageLabels(input,{width,height:420})]);
  }
});

test('Offscreen and hidden figures cannot claim label space, and priorities survive an overcrowded viewport',()=>{
  const items=[{id:'selected',x:65,y:65,width:80,height:35,priority:100,visible:true},...Array.from({length:30},(_,i)=>({id:`crowd-${i}`,x:65,y:65,width:60,height:24,priority:1,visible:true})),{id:'hidden',x:65,y:65,width:80,height:35,priority:999,visible:false},{id:'outside',x:-2,y:40,width:20,height:12,visible:true}];
  const result=layoutStageLabels(items,{width:130,height:130});assert.ok(result.get('selected').visible);assert.equal(result.get('hidden').reason,'offscreen');assert.equal(result.get('outside').reason,'offscreen');assert.ok([...result.values()].some(r=>r.reason==='occluded'));
  const rows=[...result.values()].filter(r=>r.visible);assert.ok(rows.every((a,i)=>rows.slice(i+1).every(b=>!labelsOverlap(a,b))));
});
