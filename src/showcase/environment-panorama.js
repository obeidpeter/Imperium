import * as T from '../../vendor/three/three.module.js';
import {PANORAMA_BAND,panoramaFile,panoramaKey} from '../ui/panoramas.js';
import {loadKTX2Texture} from './model-loader.js';
import {BACKDROP_RADIUS,createPaintedBackdrop} from './environment-backdrop.js';

// The far skyline: the region's Blender-rendered panorama (src/ui/panoramas.js)
// on a cylinder beyond the modelled ridges, where the painted backdrop stood.
// Each pixel keeps the elevation it was rendered at, as seen from the render's
// eye above the board's centre. Its foot sinks into the scene's fog like the
// ridges in front of it; above the horizon it rises to a lighter haze, so the
// far ranges stand over the mist. It takes the chapter's fog colour and light.
// Held once loaded for the current region and the one before, so a return is
// immediate; until then, if it cannot load, and in council chambers, the
// code-painted backdrop stands in. Presentation only: never pickable, no rule
// and no random draw.
export const PANORAMA_RADIUS=BACKDROP_RADIUS;
// Every scene warms its region's panorama before it is built, so the one a
// third region releases is never on screen.
export const PANORAMAS_KEPT=2;
const DEG=Math.PI/180;
const textures=new Map(),pending=new Map();
// The most recently warmed last; older ones beyond PANORAMAS_KEPT are released.
const keep=(key,texture)=>{
  textures.delete(key);textures.set(key,texture);
  for(const [old,held] of textures){if(textures.size<=PANORAMAS_KEPT)break;textures.delete(old);held.dispose();}
};

/** Whether a region's panorama is loaded. */
export const panoramaLoaded=key=>textures.has(key);
/** The region's loaded panorama texture, or null. */
export const panoramaTexture=key=>textures.get(key)??null;
/**
 * Fetches and transcodes a region's panorama once while it is kept; resolves
 * true when it is ready, false if it failed (the painted backdrop stays; the
 * next call tries again). Never rejects. `load` is for tests.
 */
export function warmPanorama(key,{load=loadKTX2Texture}={}){
  if(!key)return Promise.resolve(false);
  if(textures.has(key)){keep(key,textures.get(key));return Promise.resolve(true);}
  if(!pending.has(key))pending.set(key,load(panoramaFile(key)).then(texture=>{
    const {width,height,rows}=PANORAMA_BAND,w=texture?.image?.width,h=texture?.image?.height;
    // Any resolution of the band's proportion: previews are smaller.
    if(!texture?.isTexture||!(w>0&&h>0)||Math.abs(w/h-width/rows/(height*rows))>1e-3){texture?.dispose?.();throw new Error(`The ${key} panorama is not the band's shape.`);}
    texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;texture.anisotropy=4;texture.name=`Imperium ${key} panorama`;texture.needsUpdate=true;
    keep(key,texture);pending.delete(key);return true;
  }).catch(()=>{pending.delete(key);return false;}));
  return pending.get(key);
}

const luminance=c=>.2126*c.r+.7152*c.g+.0722*c.b;
/** How hazy the band stands above the horizon: by weather, and at night. */
export function panoramaHaze(profile={}){
  const weather={rain:.7,mist:.62,dust:.55,embers:.48}[profile.weather]??.34;
  return profile.timeOfDay==='night'?Math.max(weather,.55):weather;
}
/** The band's light: its colour leans to the chapter's fog and a little to its sun; dimmer at dawn and dusk, dark at night. */
export function panoramaTint(profile={}){
  const fog=new T.Color(profile.fog??'#a1b1a7'),sun=new T.Color(profile.sun??'#ffe4b4');
  const hue=fog.multiplyScalar(1/Math.max(luminance(fog),1e-3)).lerp(sun.multiplyScalar(1/Math.max(luminance(sun),1e-3)),.25);
  const level={night:.22,dawn:.9,dusk:.9}[profile.timeOfDay]??1;
  return hue.multiplyScalar(level/Math.max(luminance(hue),1e-3));
}

const declarations=`
uniform vec4 panoramaBand;
uniform vec3 panoramaTint;
uniform float panoramaHaze;
uniform vec2 panoramaLift;
varying vec3 vPanorama;
`;
// Bearing clockwise from north (-Z) toward east (+X): north is the band's
// middle. Two rows: the half west of north above the half east of it, each
// with the band's top first. Derivatives come from whichever of the two seam
// placements is smooth here, so no line of coarse mips marks the joins.
const sample=`
  float panoramaElevation=atan(vPanorama.y-panoramaBand.z,length(vPanorama.xz));
  {
    float u=.5+atan(vPanorama.x,-vPanorama.z)/6.2831853;
    float v=clamp((panoramaElevation-panoramaBand.x)/(panoramaBand.y-panoramaBand.x),${(.5/PANORAMA_BAND.height).toFixed(6)},${(1-.5/PANORAMA_BAND.height).toFixed(6)});
    vec2 du=vec2(dFdx(u),dFdy(u)),dw=vec2(dFdx(fract(u+.5)),dFdy(fract(u+.5))),dv=vec2(dFdx(v),dFdy(v));
    du=dot(du,du)<=dot(dw,dw)?du:dw;
    float row=step(.5,u);
    vec2 st=vec2(fract(u*2.),(row+1.-v)*.5);
    diffuseColor*=textureGrad(map,st,vec2(du.x*2.,-dv.x*.5),vec2(du.y*2.,-dv.y*.5));
    diffuseColor.rgb*=panoramaTint;
  }
`;
const fog=`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float panoramaFog=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
  #else
    float panoramaFog=smoothstep(fogNear,fogFar,vFogDepth);
  #endif
  panoramaFog=mix(panoramaFog,panoramaHaze,smoothstep(panoramaLift.x,panoramaLift.y,panoramaElevation));
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,panoramaFog);
#endif
`;

/** The material that draws a panorama texture on the band's cylinder. */
export function createPanoramaMaterial(texture,profile={}){
  const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,fog:true,side:T.BackSide});
  const uniforms={panoramaBand:{value:new T.Vector4(PANORAMA_BAND.minLatitude*DEG,PANORAMA_BAND.maxLatitude*DEG,PANORAMA_BAND.eye,PANORAMA_RADIUS)},
    panoramaTint:{value:panoramaTint(profile)},panoramaHaze:{value:panoramaHaze(profile)},panoramaLift:{value:new T.Vector2(-1*DEG,1.5*DEG)}};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 vPanorama;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPanorama=position;');
    shader.fragmentShader=declarations+shader.fragmentShader.replace('#include <map_fragment>',sample).replace('#include <fog_fragment>',fog);
  };
  material.customProgramCacheKey=()=>'imperium-panorama-v1';
  material.userData.panorama=uniforms;
  return material;
}

/**
 * The scene's far skyline: the chapter's panorama if it is loaded (or given),
 * else the code-painted backdrop. Council chambers have neither.
 */
export function createPanorama(profile,{quality='balanced',texture=null}={}){
  const key=profile?.civic?null:panoramaKey(profile?.chapter),map=key?texture??panoramaTexture(key):null;
  if(!map){const painted=createPaintedBackdrop(profile,{quality});return {...painted,stats:{...painted.stats,panorama:null}};}
  const group=new T.Group();group.name='regional panorama';group.userData.environmentBackdrop=true;
  // The band's foot and head on the cylinder, a metre beyond each.
  const y=deg=>PANORAMA_BAND.eye+PANORAMA_RADIUS*Math.tan(deg*DEG),bottom=y(PANORAMA_BAND.minLatitude)-1,top=y(PANORAMA_BAND.maxLatitude)+1;
  const geometry=new T.CylinderGeometry(PANORAMA_RADIUS,PANORAMA_RADIUS,top-bottom,quality==='performance'?64:128,1,true).translate(0,(top+bottom)/2,0);
  const material=createPanoramaMaterial(map,profile),mesh=new T.Mesh(geometry,material);
  mesh.name='regional panorama';mesh.castShadow=mesh.receiveShadow=false;mesh.frustumCulled=false;group.add(mesh);
  return {group,stats:{painted:false,panorama:key,width:map.image?.width,height:map.image?.height},
    // The texture stays with the cache for the next scene in the region.
    dispose(){geometry.dispose();material.dispose();}};
}
