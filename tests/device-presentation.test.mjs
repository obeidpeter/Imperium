import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDeviceReport} from '../src/showcase/device-report.js';
import {contextualLabelVisible as visible} from '../src/showcase/contextual-labels.js';
import {createFrameProfile} from '../src/showcase/frame-profile.js';
test('Device reports distinguish software rendering, masked identity and unavailable contexts',()=>{
  const gl={RENDERER:1,VENDOR:2,VERSION:3,MAX_TEXTURE_SIZE:4,MAX_RENDERBUFFER_SIZE:5,getExtension:()=>null,getParameter:p=>({1:'ANGLE (SwiftShader Device)',2:'Google',3:'WebGL 2',4:8192,5:8192})[p]};
  assert.equal(renderDeviceReport(gl).software,true);assert.equal(renderDeviceReport(gl).identity,'privacy-masked');
  assert.equal(renderDeviceReport(null).software,null);assert.equal(renderDeviceReport(null).identity,'unavailable');
});
test('Close-view labels preserve selection, hover, active effects, votes and nearby threats',()=>{
  assert.ok(visible());assert.equal(visible({view:'horizon'}),false);
  for(const key of ['selected','focused','effect','vote'])assert.ok(visible({view:'horizon',[key]:true}));
  assert.ok(visible({view:'horizon',enemy:true,distance:6}));assert.equal(visible({view:'horizon',enemy:true,distance:8}),false);
});
test('Frame reports retain a real multi-second stall instead of silently improving measured cadence',()=>{
  const p=createFrameProfile();p.record({cpuMs:3,intervalMs:16.7});p.record({cpuMs:100,intervalMs:1400});
  assert.equal(p.stats().displayInterval.samples,2);assert.equal(p.stats().displayInterval.worstMs,1400);
});
