import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createSceneCompositor,compositorSize} from '../src/showcase/scene-compositor.js';

// This spy exercises real Three targets/materials and public lifecycle behavior.
// It cannot establish shader compilation, GPU time, or visual quality.
function rendererSpy({supported=true,width=1280,height=720,contextLost=false}={}){
  let current=null,buffer={width,height};const calls=[],targets=new Set(),releaseCounts=new Map();
  const renderer={
    extensions:{has:()=>supported},capabilities:{maxTextureSize:8192},
    debug:{checkShaderErrors:false,onShaderError:null},
    info:{autoReset:true,render:{calls:0,triangles:0},reset(){this.render.calls=0;this.render.triangles=0;}},
    getDrawingBufferSize(out){return out.set(buffer.width,buffer.height);},
    getRenderTarget:()=>current,
    getContext:()=>({isContextLost:()=>contextLost}),
    setRenderTarget(target){
      current=target;
      if(target?.depthTexture&&!targets.has(target)){
        targets.add(target);releaseCounts.set(target,{target:0,depth:0});
        // WebGLTextures.deallocateRenderTarget owns depth disposal in Three.
        target.addEventListener('dispose',()=>{releaseCounts.get(target).target++;target.depthTexture.dispose();});
        target.depthTexture.addEventListener('dispose',()=>releaseCounts.get(target).depth++);
      }
    },
    render(object,camera){
      if(renderer.info.autoReset)renderer.info.reset();
      calls.push({object,camera,target:current});
      if(renderer.fail?.(object,current))throw new Error('Deliberate render failure');
      renderer.info.render.calls+=object.isScene?7:1;
      renderer.info.render.triangles+=object.isScene?300:1;
    },
    setBuffer(w,h){buffer={width:w,height:h};}
  };
  return {renderer,calls,targets,releaseCounts};
}

test('Compositor uses one visible scene render, a linear HDR/depth target, and accurate combined pass counts',()=>{
  const {renderer,calls,targets}=rendererSpy(),camera=new T.PerspectiveCamera(40,16/9,.1,800),scene=new T.Scene();
  const existing=new T.WebGLRenderTarget(12,12);renderer.setRenderTarget(existing);
  const compositor=createSceneCompositor(renderer,camera);compositor.render(scene);
  assert.equal(calls.length,2);assert.equal(calls[0].object,scene);assert.equal(calls[0].camera,camera);
  const target=calls[0].target,screen=calls[1].object;
  assert.equal(target.texture.type,T.HalfFloatType);assert.equal(target.texture.colorSpace,T.LinearSRGBColorSpace);
  assert.equal(screen.material.uniforms.sceneColor.value,target.texture);assert.equal(screen.material.uniforms.sceneDepth.value,target.depthTexture);
  assert.equal(screen.material.toneMapped,true);assert.equal(screen.material.depthWrite,false);
  assert.equal(calls[1].target,existing);assert.equal(renderer.getRenderTarget(),existing);assert.equal(renderer.info.autoReset,true);
  assert.deepEqual(renderer.info.render,{calls:8,triangles:301});
  for(let i=0;i<12;i++)compositor.render(scene);
  assert.equal(targets.size,1,'Stable frames reuse the same target.');assert.deepEqual(renderer.info.render,{calls:8,triangles:301});
  compositor.dispose();existing.dispose();
});

test('Actual camera projections round trip through the copied shader matrix across near, board, and far depths',()=>{
  const {renderer,calls}=rendererSpy(),camera=new T.PerspectiveCamera(40,16/9,.1,800),scene=new T.Scene(),compositor=createSceneCompositor(renderer,camera);
  for(const [fov,aspect] of [[40,16/9],[65,.5],[28,2.6]]){
    camera.fov=fov;camera.aspect=aspect;camera.updateProjectionMatrix();compositor.render(scene);
    const uniforms=calls.at(-1).object.material.uniforms,inverse=uniforms.inverseProjection.value;
    assert.notEqual(inverse,camera.projectionMatrixInverse,'The render pass owns a detached matrix.');
    for(const depth of [.1,.2,3,25,120,799.5]){
      const point=new T.Vector4(depth*.04,-depth*.06,-depth,1),clip=point.clone().applyMatrix4(camera.projectionMatrix);
      clip.multiplyScalar(1/clip.w);
      const reconstructed=clip.applyMatrix4(inverse);reconstructed.multiplyScalar(1/reconstructed.w);
      assert.ok(reconstructed.toArray().every(Number.isFinite));
      assert.ok(reconstructed.sub(point).length()<1e-6,`View-space reconstruction at ${depth}m is accurate.`);
    }
    assert.equal(uniforms.projectionScale.value,camera.projectionMatrix.elements[5]/2);
  }
  compositor.dispose();
});

test('Zero and giant layouts use finite aspect-preserving target bounds and matching shader resolution',()=>{
  for(const quality of ['balanced','high'])for(const [w,h]of [[0,0],[360,640],[8192,4096],[16000,1000],[1000,16000],[NaN,Infinity]]){
    const s=compositorSize(w,h,{quality,maxTextureSize:2048});
    assert.ok(Number.isInteger(s.width)&&Number.isInteger(s.height));assert.ok(s.width>=1&&s.height>=1&&s.width<=2048&&s.height<=2048);
    assert.ok(s.width*s.height<=(quality==='high'?8000000:4000000));
    if(w>0&&h>0&&Number.isFinite(w)&&Number.isFinite(h))assert.ok(Math.abs(s.width/s.height-w/h)<.025);
  }
  const {renderer,calls}=rendererSpy({width:8192,height:4320}),compositor=createSceneCompositor(renderer,new T.PerspectiveCamera());
  compositor.render(new T.Scene());let target=calls[0].target,resolution=calls[1].object.material.uniforms.resolution.value;
  assert.deepEqual(resolution.toArray(),[target.width,target.height]);assert.ok(target.width*target.height<=4000000);
  renderer.setBuffer(0,0);compositor.resize();compositor.render(new T.Scene());
  assert.deepEqual(resolution.toArray(),[1,1]);assert.equal(target.width,1);assert.equal(target.height,1);
  renderer.setBuffer(8192,4320);compositor.setQuality('high');compositor.render(new T.Scene());
  assert.ok(target.width*target.height<=8000000);assert.ok(target.width*target.height>4000000);
  assert.equal(compositor.stats().drawingWidth,8192);assert.equal(compositor.stats().drawingHeight,4320);
  compositor.dispose();
});

test('Resize and quality cleanup leave no duplicated depth disposal, and disposal is idempotent',()=>{
  const {renderer,calls,targets,releaseCounts}=rendererSpy(),compositor=createSceneCompositor(renderer,new T.PerspectiveCamera()),scene=new T.Scene();
  compositor.render(scene);const first=[...targets][0],material=calls[1].object.material,geometry=calls[1].object.geometry;
  let materials=0,geometries=0;material.addEventListener('dispose',()=>materials++);geometry.addEventListener('dispose',()=>geometries++);
  renderer.setBuffer(640,360);compositor.resize();compositor.render(scene);
  assert.equal([...targets][0],first);assert.deepEqual(releaseCounts.get(first),{target:1,depth:1});
  compositor.setQuality('performance');assert.deepEqual(releaseCounts.get(first),{target:2,depth:2});assert.equal(compositor.stats().width,0);
  const before=calls.length;compositor.render(scene);assert.equal(calls.length,before+1);assert.equal(calls.at(-1).target,null);
  compositor.setQuality('high');compositor.render(scene);assert.equal(targets.size,2);
  compositor.dispose();compositor.dispose();compositor.setQuality('balanced');compositor.resize();compositor.render(scene);
  assert.equal(materials,1);assert.equal(geometries,1);assert.deepEqual(releaseCounts.get([...targets][1]),{target:1,depth:1});assert.equal(compositor.stats().passes,0);
});

test('A failed offscreen or final pass restores renderer state and falls back once for the entire stage',()=>{
  for(const failingPass of ['scene','screen']){
    const {renderer,calls,releaseCounts}=rendererSpy(),camera=new T.PerspectiveCamera(),scene=new T.Scene(),previous=new T.WebGLRenderTarget(3,3);
    renderer.setRenderTarget(previous);renderer.info.autoReset=false;
    renderer.fail=(object,target)=>failingPass==='scene'?object===scene&&target!==previous:object.isMesh;
    const compositor=createSceneCompositor(renderer,camera);compositor.render(scene);
    assert.equal(renderer.getRenderTarget(),previous);assert.equal(renderer.info.autoReset,false);
    assert.equal(calls.at(-1).object,scene);assert.equal(calls.at(-1).target,previous);
    assert.equal(compositor.stats().enabled,false);assert.match(compositor.stats().fallback,/Deliberate render failure/);
    assert.deepEqual([...releaseCounts.values()],[{target:1,depth:1}]);
    const before=calls.length;compositor.setQuality('high');compositor.render(scene);assert.equal(calls.length,before+1,'Quality changes do not retry a broken target in this stage.');
    compositor.dispose();previous.dispose();
  }
});

test('Context loss is restored and rethrown to existing stage recovery, not disguised as unsupported graphics',()=>{
  const {renderer,calls}=rendererSpy({contextLost:true}),compositor=createSceneCompositor(renderer,new T.PerspectiveCamera());
  renderer.fail=()=>true;
  assert.throws(()=>compositor.render(new T.Scene()),/Deliberate render failure/);
  assert.equal(renderer.getRenderTarget(),null);assert.equal(renderer.info.autoReset,true);assert.equal(calls.length,1);
  assert.equal(compositor.stats().fallback,null);compositor.dispose();
});

test('Unsupported devices and performance quality keep a single direct scene render without depth targets',()=>{
  for(const options of [{supported:false},{quality:'performance'}]){
    const {renderer,calls,targets}=rendererSpy(options),compositor=createSceneCompositor(renderer,new T.PerspectiveCamera(),options),scene=new T.Scene();
    compositor.render(scene);assert.equal(calls.length,1);assert.equal(calls[0].object,scene);assert.equal(calls[0].target,null);assert.equal(targets.size,0);
    assert.equal(compositor.stats().enabled,false);assert.equal(compositor.stats().depthSamples,0);compositor.dispose();
  }
});

test('A reported fullscreen shader link failure falls back and restores the existing diagnostics hook',()=>{
  const {renderer,calls}=rendererSpy(),scene=new T.Scene();let priorCalls=0;
  const priorHook=()=>priorCalls++;renderer.debug.onShaderError=priorHook;
  renderer.fail=object=>{
    if(object.isMesh){
      assert.equal(renderer.debug.checkShaderErrors,true);
      renderer.debug.onShaderError({getProgramInfoLog:()=>'',getShaderInfoLog:()=>"luminance: function already has a body"},{},{},{});
    }else assert.equal(renderer.debug.onShaderError,priorHook,'The ordinary scene keeps its existing diagnostics.');
    return false;
  };
  const compositor=createSceneCompositor(renderer,new T.PerspectiveCamera());compositor.render(scene);
  assert.equal(priorCalls,1);assert.equal(renderer.debug.onShaderError,priorHook);assert.equal(renderer.debug.checkShaderErrors,false);
  assert.match(compositor.stats().fallback,/shader failed:.*luminance/);assert.equal(compositor.stats().enabled,false);
  assert.equal(calls.at(-1).object,scene);const count=calls.length;compositor.render(scene);assert.equal(calls.length,count+1);compositor.dispose();
});
