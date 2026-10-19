import * as T from '../../vendor/three/three.module.js';

// Linear HDR scene color and camera depth stay together. Tone mapping and the
// display transfer happen exactly once, in the last pass through Three's chunks.
// No temporal history, extra scene render, random state or hidden-unit pass.
// msaa is the multisampled scene target; with it, the post edge filter only
// softens what multisampling misses, and sharpening still runs on flat areas.
export const COMPOSITOR_TIERS=Object.freeze({
  performance:Object.freeze({enabled:false,samples:0,msaa:0,radius:0,strength:0,bloomStrength:0,casStrength:0,aerialStrength:0,vignetteStrength:0}),
  balanced:Object.freeze({enabled:true,samples:8,msaa:4,radius:1.05,strength:1.55,bloomStrength:0.24,casStrength:0.18,aerialStrength:0.16,vignetteStrength:0.14}),
  high:Object.freeze({enabled:true,samples:12,msaa:4,radius:1.15,strength:1.65,bloomStrength:0.32,casStrength:0.26,aerialStrength:0.22,vignetteStrength:0.18})
});
// Default haze begins 14m from the camera. The stage moves it beyond the playable
// board each frame, so figures and terrain keep their contrast at any zoom.
export const DEFAULT_HAZE=Object.freeze({near:14,far:88,color:Object.freeze([0.76,0.81,0.88])});
// The neutral grade reproduces the earlier fixed finish; chapters supply their own.
export const DEFAULT_GRADE=Object.freeze({saturation:1.055,contrast:1,shadow:Object.freeze([0.9936,1,1.0072]),highlight:Object.freeze([1,1,1])});
const finiteTriple=list=>Array.isArray(list)&&list.length===3&&list.every(Number.isFinite);
// Valid fields of a grade, clamped as the pass clamps them, over a base grade
// (malformed or missing fields keep the base's values).
export function normalizeGrade({saturation,contrast,shadow,highlight}={},base=DEFAULT_GRADE){
  return {saturation:Number.isFinite(saturation)?Math.max(0,Math.min(2,saturation)):base.saturation,contrast:Number.isFinite(contrast)?Math.max(.5,Math.min(1.6,contrast)):base.contrast,shadow:finiteTriple(shadow)?[...shadow]:[...base.shadow],highlight:finiteTriple(highlight)?[...highlight]:[...base.highlight]};
}
// Without the finishing pass (Performance quality, or a pass that failed) the
// chapter grade rides in the tone-mapping step every lit material already runs:
// the same saturation, mid-grey contrast and split tone as the pass, then ACES.
// Its constants are written into Three's custom tone-mapping chunk just before
// this renderer draws, so it costs no extra pass and no extra target.
const BASE_TONEMAPPING_CHUNK=T.ShaderChunk.tonemapping_pars_fragment;
const CUSTOM_TONEMAPPING='vec3 CustomToneMapping( vec3 color ) { return color; }';
const glslFloat=value=>{const text=String(Math.round(value*1e5)/1e5);return /[.e]/.test(text)?text:`${text}.0`;};
export function gradeToneMappingChunk(grade=DEFAULT_GRADE){
  const g=normalizeGrade(grade),vec=list=>`vec3( ${list.map(glslFloat).join(', ')} )`;
  return BASE_TONEMAPPING_CHUNK.replace(CUSTOM_TONEMAPPING,`vec3 CustomToneMapping( vec3 color ) {
	float gradeLuma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	color = mix( vec3( gradeLuma ), color, ${glslFloat(g.saturation)} );
	color = 0.18 * pow( max( color, vec3( 0.0 ) ) / 0.18, vec3( ${glslFloat(g.contrast)} ) );
	gradeLuma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	color *= mix( ${vec(g.shadow)}, ${vec(g.highlight)}, smoothstep( 0.04, 0.9, gradeLuma ) );
	return ACESFilmicToneMapping( max( color, vec3( 0.0 ) ) );
}`);
}
export function multisampleCount(renderer,tier){
  if(!tier?.enabled||!tier.msaa||renderer?.capabilities?.isWebGL2===false)return 0;
  const limit=Number(renderer?.capabilities?.maxSamples);
  return Number.isFinite(limit)&&limit>0?Math.min(tier.msaa,limit):tier.msaa;
}
export function evaluateCompositorGrade({color=[0.5,0.5,0.5],depthZ=-18,uv=[0.5,0.5],bloomLuma=0,quality='balanced',haze=DEFAULT_HAZE}={}){
  const tier=COMPOSITOR_TIERS[quality]??COMPOSITOR_TIERS.balanced;
  if(!tier.enabled)return {color:[...color],bloom:0,aerialMix:0,vignette:1};
  const z=Number.isFinite(depthZ)?Math.max(0,-depthZ):18;
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/Math.max(0.0001,b-a)));return t*t*(3-2*t);};
  const bloomWeight=smooth(0.78,1.85,Math.max(0,bloomLuma))*tier.bloomStrength*(0.85+0.4*Math.max(0,Math.min(1,uv[1]??0.5)));
  const aerialMix=smooth(haze.near,haze.far,z)*tier.aerialStrength;
  const dx=((uv[0]??0.5)-0.5)*1.12,dy=((uv[1]??0.5)-0.5)*0.96;
  const vignette=1-smooth(0.18,0.72,dx*dx+dy*dy)*tier.vignetteStrength;
  const graded=color.map((channel,index)=>{
    const hazeTarget=haze.color[index]??0.8;
    const withBloom=channel+bloomWeight*([1.06,0.96,0.82][index]??1);
    const withAerial=withBloom*(1-aerialMix)+hazeTarget*aerialMix;
    return Math.max(0,withAerial*vignette);
  });
  return {color:graded,bloom:bloomWeight,aerialMix,vignette};
}
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
uniform float bloomStrength;
uniform float casStrength;
uniform float aerialStrength;
uniform float vignetteStrength;
uniform float edgeBlend;
uniform vec2 hazeRange;
uniform vec3 hazeColor;
uniform float gradeSaturation;
uniform float gradeContrast;
uniform vec3 gradeShadow;
uniform vec3 gradeHighlight;
uniform float tiltShift;
uniform float focusDepth;
uniform float ink;
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
  if(hi-lo<max(0.035,hi*0.12)){
    vec3 ring=(north+south+east+west)*0.25;
    float detail=casStrength*(1.0-smoothstep(0.0,0.22,hi-lo));
    return max(vec3(0.0),center+(center-ring)*detail);
  }
  // Filter along the edge rather than across a uniform face. The small blend
  // smooths subpixel leaves/weapon edges without blurring textures or labels.
  vec3 along=abs(n-s)<abs(e-w)?(north+south)*0.5:(east+west)*0.5;
  return mix(center,along,edgeBlend);
}
vec3 specularBloom(vec3 center){
  if(bloomStrength<=0.001)return vec3(0.0);
  vec2 pixel=1.0/resolution;
  vec3 accum=vec3(0.0);
  float cLuma=imperiumLuma(center);
  accum+=center*smoothstep(0.78,1.85,cLuma)*0.28;
  for(int i=0;i<8;i++){
    float angle=float(i)*0.78539816339;
    float radius=(i<4)?2.2:5.2;
    vec2 offset=vec2(cos(angle),sin(angle))*pixel*radius;
    vec3 tap=texture2D(sceneColor,clamp(vUv+offset,vec2(0.001),vec2(0.999))).rgb;
    float tLuma=imperiumLuma(tap);
    accum+=tap*smoothstep(0.78,1.85,tLuma)*0.09;
  }
  float shaft=mix(0.85,1.25,clamp(vUv.y,0.0,1.0));
  return accum*vec3(1.06,0.97,0.84)*bloomStrength*shaft;
}
vec3 aerialGrade(vec3 color,vec3 p,float depth){
  if(depth>=0.99999||aerialStrength<=0.001)return color;
  float haze=smoothstep(hazeRange.x,hazeRange.y,-p.z)*aerialStrength;
  vec3 horizonTint=hazeColor*max(0.45,min(1.15,imperiumLuma(color)+0.32));
  return mix(color,horizonTint,haze);
}
float viewDepth(vec2 uv){float d=texture2D(sceneDepth,uv).r;return d>=0.99999?1000.0:-viewPosition(uv,d).z;}
// Diorama tilt-shift: the board around the focus stays sharp, ground beyond
// it and the near foreground soften. Taps nearer than the pixel contribute
// little, so a sharp figure never smears over the blurred land behind it.
vec3 tiltShiftColor(vec3 center,float z){
  float blur=clamp(smoothstep(focusDepth+9.0,focusDepth+70.0,z)+(1.0-smoothstep(focusDepth-20.0,focusDepth-9.0,z))*0.7,0.0,1.0)*tiltShift;
  if(blur<0.02)return center;
  vec2 pixel=1.0/resolution;vec3 sum=center;float weight=1.0;
  for(int i=0;i<12;i++){
    float a=float(i)*2.39996323,r=sqrt((float(i)+0.5)/12.0)*blur*7.0;
    vec2 q=clamp(vUv+vec2(cos(a),sin(a))*r*pixel,vec2(0.001),vec2(0.999));
    float w=viewDepth(q)>=z-2.0?1.0:0.2;sum+=texture2D(sceneColor,q).rgb*w;weight+=w;
  }
  return sum/weight;
}
// Ink and wash: outlines on the near side of every depth step (figures,
// walls, ridges), and soft value banding like washes laid on paper.
vec3 inkFinish(vec3 color,float z){
  if(z>=999.0)return color;
  vec2 pixel=vec2(max(1.25,resolution.y/640.0))/resolution;float edge=0.0;
  edge=max(edge,viewDepth(vUv+vec2(pixel.x,0.0))-z);edge=max(edge,viewDepth(vUv-vec2(pixel.x,0.0))-z);
  edge=max(edge,viewDepth(vUv+vec2(0.0,pixel.y))-z);edge=max(edge,viewDepth(vUv-vec2(0.0,pixel.y))-z);
  float line=smoothstep(0.035,0.09,edge/max(z,0.5))*(1.0-smoothstep(60.0,140.0,z));
  float l=imperiumLuma(color),banded=floor(l*5.0+0.5)/5.0;
  color*=mix(1.0,clamp(banded/max(l,0.0001),0.8,1.2),0.35*ink);
  return mix(color,vec3(0.035,0.028,0.022),line*ink*0.85);
}
float frescoVignette(vec2 uv){
  vec2 d=(uv-0.5)*vec2(1.12,0.96);
  return 1.0-smoothstep(0.18,0.72,dot(d,d))*vignetteStrength;
}
void main(){
  float depth=texture2D(sceneDepth,vUv).r;
  vec3 p=viewPosition(vUv,depth);
  vec3 base=antialiasedColor();
  float z=depth>=0.99999?1000.0:-p.z;
  if(tiltShift>0.001)base=tiltShiftColor(base,z);
  vec3 color=base*localOcclusion(p,depth)+specularBloom(base);
  color=aerialGrade(color,p,depth);
  float l=imperiumLuma(color);
  color=mix(vec3(l),color,gradeSaturation);
  // Contrast pivots on linear mid-grey, so overall exposure is kept.
  color=0.18*pow(max(color,vec3(0.0))/0.18,vec3(gradeContrast));
  l=imperiumLuma(color);
  color*=mix(gradeShadow,gradeHighlight,smoothstep(0.04,0.9,l));
  color*=frescoVignette(vUv);
  if(ink>0.001)color=inkFinish(color,z);
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
  const material=new T.ShaderMaterial({name:'Imperium depth and edge finish',defines:{AO_DIRECTIONS:8},uniforms:{sceneColor:{value:null},sceneDepth:{value:null},inverseProjection:{value:inverseProjection},resolution:{value:size},projectionScale:{value:1},worldRadius:{value:1.05},strength:{value:1.55},bloomStrength:{value:0.24},casStrength:{value:0.18},aerialStrength:{value:0.16},vignetteStrength:{value:0.14},edgeBlend:{value:0.32},hazeRange:{value:new T.Vector2(DEFAULT_HAZE.near,DEFAULT_HAZE.far)},hazeColor:{value:new T.Color(...DEFAULT_HAZE.color)},gradeSaturation:{value:DEFAULT_GRADE.saturation},gradeContrast:{value:DEFAULT_GRADE.contrast},gradeShadow:{value:new T.Vector3(...DEFAULT_GRADE.shadow)},gradeHighlight:{value:new T.Vector3(...DEFAULT_GRADE.highlight)},tiltShift:{value:0},focusDepth:{value:27},ink:{value:0}},vertexShader,fragmentShader,depthTest:false,depthWrite:false,toneMapped:true});
  const quad=new T.Mesh(geometry,material);quad.frustumCulled=false;
  const screenCamera=new T.Camera();let target=null,disposed=false,failure=null,tier=COMPOSITOR_TIERS.balanced;
  const baseToneMapping=renderer.toneMapping===T.CustomToneMapping?T.ACESFilmicToneMapping:renderer.toneMapping;let grade=normalizeGrade(),gradeChunk=gradeToneMappingChunk(grade);
  // Direct rendering grades in tone mapping; the pass grades itself and keeps ACES.
  const directGrade=on=>{
    if(on){if(T.ShaderChunk.tonemapping_pars_fragment!==gradeChunk)T.ShaderChunk.tonemapping_pars_fragment=gradeChunk;if(renderer.toneMapping!==T.CustomToneMapping)renderer.toneMapping=T.CustomToneMapping;}
    else if(renderer.toneMapping===T.CustomToneMapping)renderer.toneMapping=baseToneMapping;
  };
  // The renderer's target disposal also disposes its allocated depth texture.
  const release=()=>{if(target){target.dispose();target=null;material.uniforms.sceneColor.value=null;material.uniforms.sceneDepth.value=null;}};
  function resize(){
    if(disposed||!supported||!tier.enabled||failure)return;
    renderer.getDrawingBufferSize(drawingSize);
    const {width,height}=compositorSize(drawingSize.x,drawingSize.y,{quality,maxTextureSize:renderer.capabilities?.maxTextureSize??4096});
    size.set(width,height);
    const samples=multisampleCount(renderer,tier);
    if(target&&target.samples!==samples)release();
    material.uniforms.edgeBlend.value=samples?0.12:0.32;
    if(!target){
      target=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,stencilBuffer:false,generateMipmaps:false,samples});
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
    material.uniforms.bloomStrength.value=tier.bloomStrength;material.uniforms.casStrength.value=tier.casStrength;
    material.uniforms.aerialStrength.value=tier.aerialStrength;material.uniforms.vignetteStrength.value=tier.vignetteStrength;
    if(!tier.enabled)release();else resize();
  }
  setQuality(quality);
  return {
    resize,setQuality,
    setGrade(next={}){
      if(disposed)return;const g=grade=normalizeGrade(next,grade);
      material.uniforms.gradeSaturation.value=g.saturation;material.uniforms.gradeContrast.value=g.contrast;
      material.uniforms.gradeShadow.value.fromArray(g.shadow);material.uniforms.gradeHighlight.value.fromArray(g.highlight);
      gradeChunk=gradeToneMappingChunk(g);
    },
    // Presentation styles: tilt-shift (painted figures) and ink (inked), each 0 to 1.
    setStyle({tiltShift=0,ink=0}={}){
      if(disposed)return;const unit=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
      material.uniforms.tiltShift.value=unit(tiltShift);material.uniforms.ink.value=unit(ink);
    },
    setFocus(distance){if(!disposed&&Number.isFinite(distance)&&distance>0)material.uniforms.focusDepth.value=distance;},
    setHaze({near=DEFAULT_HAZE.near,far=DEFAULT_HAZE.far,color}={}){
      if(disposed||!Number.isFinite(near)||!Number.isFinite(far))return;
      material.uniforms.hazeRange.value.set(Math.max(0,near),Math.max(near+1,far));
      if(color)material.uniforms.hazeColor.value.set(color);
    },
    render(scene){
      if(disposed)return;
      if(!supported||!tier.enabled||failure){directGrade(true);renderer.render(scene,camera);return;}
      directGrade(false);
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
      if(failure){release();renderer.info.reset();directGrade(true);renderer.render(scene,camera);}
    },
    stats:()=>{const enabled=supported&&tier.enabled&&!disposed&&!failure;return {enabled,quality,method:'linear HDR + depth contact shading + edge antialiasing + bloom & aerial grading',multisamples:enabled?target?.samples??0:0,hazeNear:material.uniforms.hazeRange.value.x,directions:enabled?tier.samples:0,depthSamples:enabled?tier.samples*2:0,bloomStrength:enabled?tier.bloomStrength:0,casStrength:enabled?tier.casStrength:0,aerialStrength:enabled?tier.aerialStrength:0,vignetteStrength:enabled?tier.vignetteStrength:0,width:target?.width??0,height:target?.height??0,drawingWidth:drawingSize.x,drawingHeight:drawingSize.y,passes:disposed?0:enabled?2:1,tiltShift:enabled?material.uniforms.tiltShift.value:0,ink:enabled?material.uniforms.ink.value:0,temporalHistory:false,gradeInToneMapping:!disposed&&renderer.toneMapping===T.CustomToneMapping,fallback:failure??(supported?null:'float render targets unavailable')};},
    toneMapping:()=>({direct:renderer.toneMapping===T.CustomToneMapping,chunk:gradeChunk}),
    dispose(){if(disposed)return;disposed=true;release();geometry.dispose();material.dispose();if(T.ShaderChunk.tonemapping_pars_fragment===gradeChunk)T.ShaderChunk.tonemapping_pars_fragment=BASE_TONEMAPPING_CHUNK;}
  };
}
