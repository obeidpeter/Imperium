import * as T from '../../vendor/three/three.module.js';
import {GROUND_LAYERS,GROUND_LAYER_INDEX} from '../ui/ground-layers.js';
import {SPLAT_CHANNELS} from './terrain-splat.js';
import {groundTextures} from './ground-textures.js';

// The ground's surface: the photographed layers (ground-layers.js) blended by
// the splat map (terrain-splat.js) and by their own heights, so pebbles stand
// out of sand and grass fills the joints of paving rather than fading evenly.
// Each layer repeats at its real size in world space; a sloped bank keeps the
// same projection. One program per quality: Performance skips the normal maps.
// From about 60 m on, each layer takes one sample of its larger copy and no
// normal: the rest would be lost in the mips anyway. Nearer, a layer samples
// both copies only where the broad noise blends them, and a layer under 3%
// of the blend is skipped: few samples per pixel, as phones need.
// Beyond the splat map, on the outer ground and the horizon, the region's turf
// wears toward its worn ground with the vertex soil weight.
export const GROUND_HEIGHT_BLEND=7;
const COUNT=GROUND_LAYERS.length;
const weights=(pairs=[])=>{const w=new Array(SPLAT_CHANNELS).fill(0);for(const [key,share]of pairs)w[GROUND_LAYER_INDEX[key]]+=share;return w;};

/** A splat map as a three-layer texture array (linear filtering, no mipmaps). */
export function splatTexture(splat){
  const texture=new T.DataArrayTexture(splat.data,splat.nx,splat.nz,SPLAT_CHANNELS/4);
  texture.magFilter=texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;
  texture.colorSpace=T.NoColorSpace;texture.name='Imperium ground splat map';texture.needsUpdate=true;return texture;
}

/** The uniforms one stage's ground shares: its region's mixes, the arrays and, once built, its splat map. */
export function createTerrainUniforms(biome){
  const textures=groundTextures(),empty={data:new Uint8Array(SPLAT_CHANNELS),nx:1,nz:1,minX:0,minZ:0,maxX:1,maxZ:1};
  return {
    groundAlbedoMap:{value:textures.albedo},groundNormalMap:{value:textures.normal},
    groundSplatMap:{value:splatTexture(empty)},groundSplatBounds:{value:new T.Vector4(0,0,0,0)},
    groundRepeat:{value:GROUND_LAYERS.map(layer=>layer.repeat)},groundRoughness:{value:GROUND_LAYERS.map(layer=>layer.roughness)},
    groundOutside:{value:weights(biome?.turf)},groundOutsideWorn:{value:weights(biome?.worn)},
    groundTint:{value:GROUND_LAYERS.map(layer=>new T.Vector3(...(biome?.tint?.[layer.key]??[1,1,1])).multiplyScalar(biome?.brightness??1))},
    groundHeightBlend:{value:GROUND_HEIGHT_BLEND},groundNormalStrength:{value:1}
  };
}
/** Sets the stage's splat map; returns the texture to dispose with the stage. */
export function setTerrainSplat(uniforms,splat){
  const previous=uniforms.groundSplatMap.value;uniforms.groundSplatMap.value=splatTexture(splat);previous.dispose();
  uniforms.groundSplatBounds.value.set(splat.minX,splat.minZ,1/(splat.maxX-splat.minX),1/(splat.maxZ-splat.minZ));
  return uniforms.groundSplatMap.value;
}
/** Points the uniforms at the arrays loaded since the stage was built (no recompile). */
export function refreshTerrainTextures(uniforms){const t=groundTextures();uniforms.groundAlbedoMap.value=t.albedo;uniforms.groundNormalMap.value=t.normal;return t.source;}

const declarations=`
#define GROUND_LAYERS ${COUNT}
uniform highp sampler2DArray groundAlbedoMap;
uniform highp sampler2DArray groundNormalMap;
uniform highp sampler2DArray groundSplatMap;
uniform vec4 groundSplatBounds;
uniform float groundRepeat[GROUND_LAYERS];
uniform float groundRoughness[GROUND_LAYERS];
uniform vec3 groundTint[GROUND_LAYERS];
uniform float groundOutside[${SPLAT_CHANNELS}];
uniform float groundOutsideWorn[${SPLAT_CHANNELS}];
uniform float groundHeightBlend;
uniform float groundNormalStrength;
varying vec3 vGroundWorld;
varying float vGroundSoil;
float groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(groundHash(i),groundHash(i+vec2(1.0,0.0)),f.x),mix(groundHash(i+vec2(0.0,1.0)),groundHash(i+vec2(1.0)),f.x),f.y);}
// The second copy of a layer: turned 37 degrees and 2.4 times larger.
const mat2 GROUND_TURN=mat2(0.7986,0.6018,-0.6018,0.7986)*0.4167;
`;
const sample=`
  vec3 groundAlbedo=vec3(0.0);float groundRough=0.0;vec2 groundSlope=vec2(0.0);
  {
    vec2 splatUv=(vGroundWorld.xz-groundSplatBounds.xy)*groundSplatBounds.zw;
    vec2 splatEdge=min(splatUv,1.0-splatUv);
    float inside=groundSplatBounds.z>0.0?smoothstep(0.0,0.05,min(splatEdge.x,splatEdge.y)):0.0;
    vec4 s0=texture(groundSplatMap,vec3(splatUv,0.0)),s1=texture(groundSplatMap,vec3(splatUv,1.0)),s2=texture(groundSplatMap,vec3(splatUv,2.0));
    float splat[${SPLAT_CHANNELS}]=float[${SPLAT_CHANNELS}](s0.x,s0.y,s0.z,s0.w,s1.x,s1.y,s1.z,s1.w,s2.x,s2.y,s2.z,s2.w);
    float soil=clamp(vGroundSoil,0.0,1.0);
    // Derivatives outside the loop: a layer sampled under a branch keeps its mip level.
    vec2 ddx=dFdx(vGroundWorld.xz),ddy=dFdy(vGroundWorld.xz);
    // A broad noise shifts each layer between its two copies, so no tile repeats in view.
    float macro=groundNoise(vGroundWorld.xz*0.045);
    // The distance level: from about 60 m on, where the small copy and the
    // normals are lost in the mips, one sample of the large copy per layer.
    float groundDistant=smoothstep(60.0,110.0,distance(vGroundWorld,cameraPosition));
    float total=0.0;
    for(int i=0;i<GROUND_LAYERS;i++){
      float weight=mix(mix(groundOutside[i],groundOutsideWorn[i],soil),splat[i],inside);
      // A layer this faint is lost in the blend (mostly the splat map's filtering at cell edges).
      if(weight<0.03)continue;
      float scale=1.0/groundRepeat[i];
      vec3 st=vec3(vGroundWorld.xz*scale,float(i));
      // How much of the turned copy shows: the macro noise's share, all of it in the distance.
      // Where that is none or all, only one copy is sampled.
      float turned=1.0-(1.0-clamp(macro*1.8-0.4+0.15*sin(float(i)*2.3),0.0,1.0))*(1.0-groundDistant);
      vec4 layer=vec4(0.0);
      if(turned>0.001)layer=textureGrad(groundAlbedoMap,vec3(GROUND_TURN*st.xy+vec2(0.37,0.19)*float(i),st.z),GROUND_TURN*ddx*scale,GROUND_TURN*ddy*scale);
      if(turned<0.999)layer=mix(textureGrad(groundAlbedoMap,st,ddx*scale,ddy*scale),layer,turned);
      // Height-weighted: where two layers meet, the higher surface shows.
      float h=weight*exp2(groundHeightBlend*layer.a);
      groundAlbedo+=layer.rgb*groundTint[i]*h;groundRough+=groundRoughness[i]*h;total+=h;
      #ifdef GROUND_NORMALS
        // Relief from the layers that carry the blend: a faint one barely tilts it.
        if(groundDistant<0.999&&weight>=0.25){
          vec4 n=textureGrad(groundNormalMap,st,ddx*scale,ddy*scale);
          groundSlope+=(vec2(n.r,n.a)*2.0-1.0)*h*(1.0-groundDistant);
        }
      #endif
    }
    total=max(total,1e-5);groundAlbedo/=total;groundRough/=total;groundSlope/=total;
  }
  diffuseColor.rgb*=groundAlbedo;
`;
// The layers' normals (the near copy's): X along world +X, Y along world -Z (the image's up).
const perturb=`
  #ifdef GROUND_NORMALS
  {
    vec3 groundTangent=normalize((viewMatrix*vec4(1.0,0.0,0.0,0.0)).xyz);
    groundTangent=normalize(groundTangent-normal*dot(normal,groundTangent));
    vec3 groundBitangent=cross(normal,groundTangent);
    vec3 groundDetail=normalize(vec3(groundSlope*groundNormalStrength,1.0));
    normal=normalize(groundTangent*groundDetail.x+groundBitangent*groundDetail.y+normal*groundDetail.z);
  }
  #endif
`;

/** Makes `material` (the ground's MeshStandardMaterial) draw the layered ground. */
export function installTerrainMaterial(material,uniforms,{normals=true}={}){
  material.map=null;material.normalMap=null;
  material.defines={...(material.defines??{}),...(normals?{GROUND_NORMALS:''}:{})};
  const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,...args)=>{
    previous.call(material,shader,...args);
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='attribute float soilMix;\nvarying vec3 vGroundWorld;\nvarying float vGroundSoil;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvGroundWorld=(modelMatrix*vec4(transformed,1.0)).xyz;\nvGroundSoil=soilMix;');
    shader.fragmentShader=declarations+shader.fragmentShader
      .replace('#include <map_fragment>','#include <map_fragment>\n'+sample)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=groundRough;')
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+perturb);
  };
  material.customProgramCacheKey=()=>`${oldKey}:imperium-terrain-v3:${normals?'normals':'flat'}`;
  material.userData.terrain={uniforms,normals};
  return material;
}
