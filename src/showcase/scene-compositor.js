import * as T from '../../vendor/three/three.module.js';

// Linear HDR scene color and camera depth stay together. Tone mapping and the
// display transfer happen exactly once, in the last pass through Three's chunks.
// No temporal history, extra scene render, random state or hidden-unit pass.
export const COMPOSITOR_TIERS=Object.freeze({
  performance:Object.freeze({enabled:false,samples:0,radius:0,strength:0}),
  balanced:Object.freeze({enabled:true,samples:8,radius:1.05,strength:1.55}),
  high:Object.freeze({enabled:true,samples:12,radius:1.15,strength:1.65})
});
export function compositorSize(width,height,{quality='balanced',maxTextureSize=4096}={}){
  const finite=value=>Number.isFinite(value)&&value>0?Math.max(1,Math.floor(value)):1;
  width=finite(width);height=finite(height);
  const edge=Math.min(4096,finite(maxTextureSize)),pixels=quality==='high'?8000000:4000000;
  const scale=Math.min(1,edge/width,edge/height,Math.sqrt(pixels/width/height));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
const vertexShader=`varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
const fragmentShader=`
uniform sampler2D sceneColor;
uniform sampler2D sceneDepth;
uniform mat4 inverseProjection;
uniform vec2 resolution;
uniform float projectionScale;
uniform float worldRadius;
uniform float strength;
varying vec2 vUv;
float imperiumLuma(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}
vec3 viewPosition(vec2 uv,float depth){
  vec4 p=inverseProjection*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);
  return p.xyz/p.w;
}
float localOcclusion(vec3 p,float depth){
  if(depth>=0.99999 || -p.z>120.0)return 1.0;
  vec3 crossed=cross(dFdx(p),dFdy(p));
  float n2=dot(crossed,crossed);
  if(n2<0.00000001)return 1.0;
  vec3 normal=crossed*inversesqrt(n2);
  float pixels=clamp(worldRadius*projectionScale*resolution.y/max(0.1,-p.z),2.0,52.0);
  float blocked=0.0;
  for(int i=0;i<AO_DIRECTIONS;i++){
    float angle=(float(i)+0.375)*6.28318530718/float(AO_DIRECTIONS);
    vec2 direction=vec2(cos(angle),sin(angle))/resolution;
    for(int j=0;j<2;j++){
      vec2 qUv=vUv+direction*pixels*(0.35+float(j)*0.55);
      if(qUv.x<=0.0||qUv.y<=0.0||qUv.x>=1.0||qUv.y>=1.0)continue;
      float qDepth=texture2D(sceneDepth,qUv).r;
      if(qDepth>=0.99999)continue;
      vec3 delta=viewPosition(qUv,qDepth)-p;
      float distanceToSample=length(delta);
      float facing=dot(normal,delta)/max(distanceToSample,0.0001);
      float local=1.0-smoothstep(worldRadius*0.25,worldRadius,distanceToSample);
      blocked+=smoothstep(0.08,0.6,facing)*local*step(0.018,distanceToSample);
    }
  }
  return clamp(1.0-strength*blocked/float(AO_DIRECTIONS*2),0.54,1.0);
}
vec3 antialiasedColor(){
  vec2 pixel=1.0/resolution;
  vec3 center=texture2D(sceneColor,vUv).rgb;
  vec3 north=texture2D(sceneColor,vUv+vec2(0.0,pixel.y)).rgb;
  vec3 south=texture2D(sceneColor,vUv-vec2(0.0,pixel.y)).rgb;
  vec3 east=texture2D(sceneColor,vUv+vec2(pixel.x,0.0)).rgb;
  vec3 west=texture2D(sceneColor,vUv-vec2(pixel.x,0.0)).rgb;
  float c=imperiumLuma(center),n=imperiumLuma(north),s=imperiumLuma(south),e=imperiumLuma(east),w=imperiumLuma(west);
  float lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));
  if(hi-lo<max(0.035,hi*0.12))return center;
  // Filter along the edge rather than across a uniform face. The small blend
  // smooths subpixel leaves/weapon edges without blurring textures or labels.
  vec3 along=abs(n-s)<abs(e-w)?(north+south)*0.5:(east+west)*0.5;
  return mix(center,along,0.32);
}
void main(){
  float depth=texture2D(sceneDepth,vUv).r;
  vec3 p=viewPosition(vUv,depth);
  vec3 color=antialiasedColor()*localOcclusion(p,depth);
  float l=imperiumLuma(color);
  color=mix(vec3(l),color,1.045);
  color*=mix(vec3(1.0),vec3(0.96,1.0,1.045),(1.0-smoothstep(0.08,0.8,l))*0.16);
  gl_FragColor=vec4(max(color,vec3(0.0)),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSceneCompositor(renderer,camera,{quality='balanced'}={}){
  const supported=!!renderer.extensions?.has('EXT_color_buffer_float');
  const size=new T.Vector2(1,1),drawingSize=new T.Vector2(1,1),inverseProjection=new T.Matrix4();
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,2,0,0,2],2));
  const material=new T.ShaderMaterial({name:'Imperium depth and edge finish',defines:{AO_DIRECTIONS:8},uniforms:{sceneColor:{value:null},sceneDepth:{value:null},inverseProjection:{value:inverseProjection},resolution:{value:size},projectionScale:{value:1},worldRadius:{value:1.05},strength:{value:1.55}},vertexShader,fragmentShader,depthTest:false,depthWrite:false,toneMapped:true});
  const quad=new T.Mesh(geometry,material);quad.frustumCulled=false;
  const screenCamera=new T.Camera();let target=null,disposed=false,failure=null,tier=COMPOSITOR_TIERS.balanced;
  // The renderer's target disposal also disposes its allocated depth texture.
  const release=()=>{if(target){target.dispose();target=null;material.uniforms.sceneColor.value=null;material.uniforms.sceneDepth.value=null;}};
  function resize(){
    if(disposed||!supported||!tier.enabled||failure)return;
    renderer.getDrawingBufferSize(drawingSize);
    const {width,height}=compositorSize(drawingSize.x,drawingSize.y,{quality,maxTextureSize:renderer.capabilities?.maxTextureSize??4096});
    size.set(width,height);
    if(!target){
      target=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,stencilBuffer:false,generateMipmaps:false});
      target.texture.name='Imperium linear scene color';target.texture.colorSpace=T.LinearSRGBColorSpace;
      target.depthTexture=new T.DepthTexture(width,height,T.UnsignedIntType);target.depthTexture.name='Imperium visible scene depth';
      material.uniforms.sceneColor.value=target.texture;material.uniforms.sceneDepth.value=target.depthTexture;
    }else if(target.width!==width||target.height!==height)target.setSize(width,height);
  }
  function setQuality(value){
    if(disposed)return;
    quality=value in COMPOSITOR_TIERS?value:'balanced';tier=COMPOSITOR_TIERS[quality];
    if(material.defines.AO_DIRECTIONS!==tier.samples&&tier.enabled){material.defines.AO_DIRECTIONS=tier.samples;material.needsUpdate=true;}
    material.uniforms.worldRadius.value=tier.radius;material.uniforms.strength.value=tier.strength;
    if(!tier.enabled)release();else resize();
  }
  setQuality(quality);
  return {
    resize,setQuality,
    render(scene){
      if(disposed)return;
      if(!supported||!tier.enabled||failure){renderer.render(scene,camera);return;}
      resize();inverseProjection.copy(camera.projectionMatrixInverse);material.uniforms.projectionScale.value=camera.projectionMatrix.elements[5]*0.5;
      const previousTarget=renderer.getRenderTarget(),autoReset=renderer.info.autoReset;
      renderer.info.autoReset=false;renderer.info.reset();
      try{
        renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(previousTarget);
        // Three reports a failed shader link through this hook rather than
        // throwing. Scope it to our pass so a bad finish cannot hide the game.
        const debug=renderer.debug,priorHook=debug?.onShaderError,priorChecks=debug?.checkShaderErrors;
        if(debug){debug.checkShaderErrors=true;debug.onShaderError=(gl,program,vertex,fragment)=>{
          failure=`Scene finish shader failed: ${[gl.getProgramInfoLog?.(program),gl.getShaderInfoLog?.(vertex),gl.getShaderInfoLog?.(fragment)].filter(Boolean).join(' ').slice(0,1200)||'program link failed'}`;
          if(typeof priorHook==='function')priorHook(gl,program,vertex,fragment);
        };}
        try{renderer.render(quad,screenCamera);}finally{if(debug){debug.onShaderError=priorHook;debug.checkShaderErrors=priorChecks;}}
      }
      catch(error){
        // A lost context belongs to the stage's existing recovery path. Other
        // target/pass failures retain the playable direct-render path for the
        // rest of this stage instead of attempting a broken pass each frame.
        if(renderer.getContext?.().isContextLost?.())throw error;
        failure=error instanceof Error?error.message:String(error);
      }
      finally{renderer.setRenderTarget(previousTarget);renderer.info.autoReset=autoReset;}
      if(failure){release();renderer.info.reset();renderer.render(scene,camera);}
    },
    stats:()=>{const enabled=supported&&tier.enabled&&!disposed&&!failure;return {enabled,quality,method:'linear HDR + depth contact shading + edge antialiasing',directions:enabled?tier.samples:0,depthSamples:enabled?tier.samples*2:0,width:target?.width??0,height:target?.height??0,drawingWidth:drawingSize.x,drawingHeight:drawingSize.y,passes:disposed?0:enabled?2:1,temporalHistory:false,fallback:failure??(supported?null:'float render targets unavailable')};},
    dispose(){if(disposed)return;disposed=true;release();geometry.dispose();material.dispose();}
  };
}
