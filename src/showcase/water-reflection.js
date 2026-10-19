import * as T from '../../vendor/three/three.module.js';

// Calm board water mirrors the figures, standards and banks above it on High
// quality: the scene is drawn once more from the camera reflected in the
// water's plane, at half resolution into a linear HDR target, with an oblique
// near plane so nothing below the surface leaks in. Sky and background are
// left out (cleared transparent), so the texel's alpha says how much of the
// mirror is covered: open water keeps its own sky reflection and only what
// stands over it is mirrored. The water shader adds a little wave distortion
// and a Fresnel weight (see the surface shaders).
// Other tiers, scenes without board water and renderers without float targets
// keep the sky-only reflection. Presentation only.
export const REFLECTION_SCALE=.5;
export function reflectionAvailable(renderer,quality){return quality==='high'&&!!renderer?.extensions?.has?.('EXT_color_buffer_float');}
// The mirrored camera for a water plane at height `level` (null when the eye is below it).
export function mirrorCamera(camera,level,out=new T.PerspectiveCamera(),{clipBias=.003}={}){
  camera.updateMatrixWorld();
  const normal=new T.Vector3(0,1,0),plane=new T.Vector3(0,level,0),eye=new T.Vector3().setFromMatrixPosition(camera.matrixWorld);
  if(eye.y<=level+.01)return null;
  const rotation=new T.Matrix4().extractRotation(camera.matrixWorld),look=new T.Vector3(0,0,-1).applyMatrix4(rotation).add(eye);
  const view=plane.clone().sub(eye).reflect(normal).negate().add(plane),target=plane.clone().sub(look).reflect(normal).negate().add(plane);
  out.position.copy(view);out.up.set(0,1,0).applyMatrix4(rotation).reflect(normal);out.lookAt(target);
  out.near=camera.near;out.far=Math.min(camera.far,140);out.aspect=camera.aspect;out.fov=camera.fov;out.updateMatrixWorld();out.matrixWorldInverse.copy(out.matrixWorld).invert();
  out.projectionMatrix.copy(camera.projectionMatrix);
  // Oblique near plane on the water (Lengyel), as Three's Reflector does.
  const clip=new T.Plane().setFromNormalAndCoplanarPoint(normal,plane).applyMatrix4(out.matrixWorldInverse),v=new T.Vector4(clip.normal.x,clip.normal.y,clip.normal.z,clip.constant),p=out.projectionMatrix.elements;
  const q=new T.Vector4((Math.sign(v.x)+p[8])/p[0],(Math.sign(v.y)+p[9])/p[5],-1,(1+p[10])/p[14]);v.multiplyScalar(2/v.dot(q));
  p[2]=v.x;p[6]=v.y;p[10]=v.z+1-clipBias;p[14]=v.w;out.projectionMatrixInverse.copy(out.projectionMatrix).invert();
  return out;
}
export function createWaterReflection(renderer,uniforms,{level=0,hide=[]}={}){
  const camera=new T.PerspectiveCamera(),size=new T.Vector2(),clear=new T.Color(),bias=new T.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  const target=new T.WebGLRenderTarget(4,4,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,generateMipmaps:false});
  target.texture.name='Imperium water reflection';target.texture.colorSpace=T.LinearSRGBColorSpace;
  let disposed=false,renders=0;
  return {target,camera,level,
    render(scene,view){
      if(disposed)return false;
      if(!mirrorCamera(view,level,camera)){uniforms.waterReflectionStrength.value=0;return false;}
      renderer.getDrawingBufferSize(size);const w=Math.max(4,Math.floor(size.x*REFLECTION_SCALE)),h=Math.max(4,Math.floor(size.y*REFLECTION_SCALE));if(target.width!==w||target.height!==h)target.setSize(w,h);
      const hidden=(typeof hide==='function'?hide():hide).filter(o=>o?.visible);for(const o of hidden)o.visible=false;
      const previous=renderer.getRenderTarget(),autoReset=renderer.info.autoReset,background=scene.background,alpha=renderer.getClearAlpha?.()??1;renderer.getClearColor?.(clear);renderer.info.autoReset=false;
      try{scene.background=null;renderer.setClearColor?.(0x000000,0);renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);}
      finally{renderer.setRenderTarget(previous);renderer.setClearColor?.(clear,alpha);scene.background=background;renderer.info.autoReset=autoReset;for(const o of hidden)o.visible=true;}
      uniforms.waterReflectionMap.value=target.texture;uniforms.waterReflectionMatrix.value.copy(bias).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);uniforms.waterReflectionStrength.value=1;renders++;return true;
    },
    stats(){return {level,width:target.width,height:target.height,renders,disposed};},
    dispose(){if(disposed)return;disposed=true;uniforms.waterReflectionStrength.value=0;uniforms.waterReflectionMap.value=uniforms.waterReflectionFallback;target.dispose();}
  };
}
