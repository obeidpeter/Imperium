import * as T from '../../vendor/three/three.module.js';

// Original procedural atmosphere. All colors enter Three's working-linear
// space through Color, then use the renderer's tone/output-color transforms.
export function skyPalette(profile={}){
  const wet=profile.setting==='wetland',arid=['desert','siege','palmyra'].includes(profile.setting);
  const horizon=new T.Color(profile.fog??'#a1b1a7');
  const zenith=new T.Color(profile.sky??'#acbdba').lerp(new T.Color(wet?'#6e8b9e':arid?'#477ba8':'#477ca8'),wet?.54:arid?.79:.73);
  return {horizon,zenith,cloud:new T.Color('#f1eee4').lerp(horizon,wet?.24:.10),sun:new T.Color(profile.sun??'#ffe4b4'),cloudOpacity:wet?.62:arid?.28:.43};
}

// Shared CPU projection is useful for deterministic visual diagnostics. The
// shader uses the same constants: clouds are completely gone before the small
// projection denominator clamp is reached, preventing vertical horizon bands.
export const SKY_GRADIENT=Object.freeze({horizon:.025,blue:.42,cloudFadeStart:.07,cloudFadeEnd:.20,projectionFloor:.015});
export function skyProjection(direction,time=0){
  const length=Math.hypot(direction.x,direction.y,direction.z)||1,altitude=Math.max(0,direction.y/length),smooth=(a,b,n)=>{const t=Math.max(0,Math.min(1,(n-a)/(b-a)));return t*t*(3-2*t);};
  const denominator=Math.max(direction.y/length,SKY_GRADIENT.projectionFloor);
  return {blueWeight:smooth(SKY_GRADIENT.horizon,SKY_GRADIENT.blue,altitude)**.57,cloudWeight:smooth(SKY_GRADIENT.cloudFadeStart,SKY_GRADIENT.cloudFadeEnd,altitude),x:direction.x/length/denominator*1.75+time*.0022,z:direction.z/length/denominator*1.75+time*.0007};
}

const vertexShader=`
varying vec3 skyDirection;
void main(){
  skyDirection=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const fragmentShader=`
uniform vec3 horizonColor;
uniform vec3 zenithColor;
uniform vec3 cloudColor;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform float cloudOpacity;
uniform float cloudTime;
varying vec3 skyDirection;
float hash21(vec2 p){
  vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
float noise21(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
}
void main(){
  vec3 d=normalize(skyDirection);
  float altitude=max(d.y,0.0);
  float clearHorizon=smoothstep(${SKY_GRADIENT.horizon.toFixed(3)},${SKY_GRADIENT.cloudFadeEnd.toFixed(3)},altitude);
  vec3 color=mix(horizonColor,zenithColor,pow(smoothstep(${SKY_GRADIENT.horizon.toFixed(3)},${SKY_GRADIENT.blue.toFixed(3)},altitude),.57));
  // A continuous layer projected above the observer, without texture seams.
  // Cloud drift is a caller-controlled clock; there is no autonomous timer.
  vec2 p=d.xz/max(d.y,${SKY_GRADIENT.projectionFloor.toFixed(3)})*1.75+vec2(cloudTime*.0022,cloudTime*.0007);
  float clouds=noise21(p)*.64+noise21(p*2.07+vec2(7.3,2.6))*.36;
  #if CLOUD_DETAIL == 1
    float detailWeight=.16*smoothstep(.15,.35,altitude);
    clouds=clouds*(1.0-detailWeight)+noise21(p*4.11+vec2(1.1,9.4))*detailWeight;
  #endif
  float cover=smoothstep(.53,.74,clouds)*smoothstep(${SKY_GRADIENT.cloudFadeStart.toFixed(3)},${SKY_GRADIENT.cloudFadeEnd.toFixed(3)},altitude)*cloudOpacity;
  color=mix(color,cloudColor,cover);
  float alignment=max(dot(d,sunDirection),0.0);
  float glow=pow(alignment,32.0)*.11+pow(alignment,160.0)*.23;
  float disc=smoothstep(.99994,.999985,alignment)*2.8;
  color+=sunColor*(glow+disc)*clearHorizon*(1.0-cover*.78);
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** One camera-centered inward dome; camera far must exceed700m. Time is seconds.
 * Reduced motion freezes the cloud clock, while camera centering remains live.
 * No scene background/fog/light or gameplay objects are changed. */
export function createSky(scene,profile={},options={}){
  const quality=['performance','balanced','high'].includes(options.quality)?options.quality:'balanced',palette=skyPalette(profile);
  const values=Array.isArray(profile.sunPosition)&&profile.sunPosition.length===3&&profile.sunPosition.every(Number.isFinite)?profile.sunPosition:[-16,24,-12];
  const direction=new T.Vector3(...values);if(direction.lengthSq()<1e-8)direction.set(-16,24,-12);direction.normalize();
  const geometry=new T.SphereGeometry(700,quality==='performance'?24:32,quality==='performance'?12:16);
  const material=new T.ShaderMaterial({name:'Procedural atmospheric sky',vertexShader,fragmentShader,
    uniforms:{horizonColor:{value:palette.horizon},zenithColor:{value:palette.zenith},cloudColor:{value:palette.cloud},sunColor:{value:palette.sun},sunDirection:{value:direction},cloudOpacity:{value:palette.cloudOpacity},cloudTime:{value:0}},
    defines:{CLOUD_DETAIL:quality==='performance'?0:1},side:T.BackSide,depthWrite:false,depthTest:true,fog:false,toneMapped:true});
  const group=new T.Group();group.name='procedural atmosphere';const dome=new T.Mesh(geometry,material);dome.name='camera-centered sky dome';dome.renderOrder=-1000;dome.frustumCulled=false;dome.castShadow=false;dome.receiveShadow=false;group.add(dome);scene.add(group);
  let disposed=false,paused=!!options.reducedMotion,lastTime=null,cloudTime=0;
  const cameraPosition=new T.Vector3();
  function update(time=0,camera,reducedMotion=paused){
    if(disposed)return;paused=!!reducedMotion;
    if(camera?.getWorldPosition){camera.getWorldPosition(cameraPosition);if(Number.isFinite(cameraPosition.x)&&Number.isFinite(cameraPosition.y)&&Number.isFinite(cameraPosition.z))group.position.copy(cameraPosition);}
    if(Number.isFinite(time)){if(lastTime!==null&&!paused)cloudTime+=Math.max(0,time-lastTime);lastTime=time;material.uniforms.cloudTime.value=cloudTime;}
  }
  function stats(){return {draws:1,triangles:geometry.index.count/3,textures:0,cloudOctaves:quality==='performance'?2:3,cloudTime,reducedMotion:paused,quality};}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometry.dispose();material.dispose();group.clear();}
  return {group,update,dispose,stats};
}
