import * as T from '../../vendor/three/three.module.js';

// Coordinates measured on Aelia's own shipped face in its bind pose. Her head,
// skin texture, hair and earrings are never replaced by the shared male head.
export const AELIA_FACE=Object.freeze({centre:-.0054,eyes:1.6197,eyeHalfWidth:.0323,brows:1.6378,mouth:1.559});
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
const bell=(v,c,w)=>Math.exp(-(((v-c)/w)**2));

// Find skin already present above her brow, in the same paint/UV atlas. Sampling
// her own skin lets a blink cover the painted iris without stretching the eye
// socket into a flat panel. No image generation or new texture is involved.
function skinSampler(source){
  const p=source.attributes.position,uv=source.attributes.uv,triangles=[];
  for(let i=0;i<(source.index?.count??0);i+=3){const ids=[0,1,2].map(c=>source.index.getX(i+c)),vertices=ids.map(k=>new T.Vector3().fromBufferAttribute(p,k));if(vertices.every(v=>v.y>1.62&&v.y<1.71&&v.z>.03))triangles.push({ids,vertices});}
  return (x,y,fallback)=>{let front=-Infinity,result=fallback;for(const {ids,vertices:[a,b,c]}of triangles){const d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(d)<1e-10)continue;const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/d,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/d,w=1-u-v,z=u*a.z+v*b.z+w*c.z;if(Math.min(u,v,w)>=-1e-5&&z>front){front=z;result=[u*uv.getX(ids[0])+v*uv.getX(ids[1])+w*uv.getX(ids[2]),u*uv.getY(ids[0])+v*uv.getY(ids[1])+w*uv.getY(ids[2])];}}return result;};
}

/** Actor-owned morphs on the exact original surface. Zero influence preserves
 * every original position, normal, UV, index and joint weight. */
export function aeliaFaceGeometry(source){
  const geometry=source.clone(),p=geometry.attributes.position,uv=geometry.attributes.uv,F=AELIA_FACE,sample=skinSampler(source);
  const jaw=new Float32Array(p.count*3),focus=new Float32Array(p.count*3),concern=new Float32Array(p.count*3),blink=new Float32Array(p.count*3),lidUv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),dx=x-F.centre;
    // Stay within one small forehead UV island. Sampling across atlas seams
    // would interpolate through unrelated clothing paint between vertices.
    const localX=dx+(dx<0?F.eyeHalfWidth:-F.eyeHalfWidth),skin=sample(-.025+Math.max(-.002,Math.min(.002,localX*.12)),1.658+Math.max(-.002,Math.min(.002,(y-F.eyes)*.12)),[uv.getX(i),uv.getY(i)]);lidUv.set(skin,i*2);
    if(y<1.525||y>1.662||Math.abs(dx)>.071||z<.05)continue;
    const face=smooth((z-.05)/.025)*smooth((.071-Math.abs(dx))/.014)*smooth((y-1.525)/.012)*smooth((1.662-y)/.012);
    const lower=bell(y,F.mouth-.013,.024)*bell(x,F.centre,.038)*face,brow=bell(y,F.brows,.012)*bell(Math.abs(dx),F.eyeHalfWidth,.024)*face;
    jaw[i*3+1]=-.0045*lower;jaw[i*3+2]=.0007*lower;
    focus[i*3]=-Math.sign(dx)*.001*brow;focus[i*3+1]=-.0018*brow;concern[i*3+1]=.0018*brow-.0006*lower;
    // A small physical lid settling supports the texture closure. Large offsets
    // are deliberately avoided on this generated, painted-eye topology.
    const ex=Math.abs(Math.abs(dx)-F.eyeHalfWidth),ey=Math.abs(y-F.eyes),lid=smooth((.022-ex)/.009)*smooth((.013-ey)/.006)*face;
    blink[i*3+1]=-.0008*lid;
  }
  geometry.setAttribute('aeliaLidUv',new T.Float32BufferAttribute(lidUv,2));geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=[['jaw',jaw],['focus',focus],['concern',concern],['blink',blink]].map(([name,data])=>{const attribute=new T.Float32BufferAttribute(data,3);attribute.name=name;return attribute;});
  geometry.userData={...source.userData,expressionMorphs:'aelia-own-face-v1',headSource:'cast-aelia',headMethod:'Bounded expressions and feathered eyelid closure using her unchanged generated face and its own skin texture.'};
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

/** Only Aelia's owned material receives this eye-sized paint treatment. At zero
 * closure the original material samples are used without any colour change. */
export function aeliaFaceMaterial(source){
  const material=source.clone(),before=source.onBeforeCompile,key=source.customProgramCacheKey(),blink={value:0};
  material.userData={...source.userData,aeliaBlink:blink};
  material.onBeforeCompile=function(shader,renderer){
    before?.call(this,shader,renderer);shader.uniforms.aeliaBlink=blink;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 aeliaLidUv; varying vec2 vAeliaLidUv; varying vec3 vAeliaFace;').replace('#include <uv_vertex>','#include <uv_vertex>\nvAeliaFace = position;\n#ifdef USE_MAP\nvAeliaLidUv = (mapTransform * vec3(aeliaLidUv, 1.0)).xy;\n#endif');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>',`#include <map_pars_fragment>
      uniform float aeliaBlink; varying vec2 vAeliaLidUv; varying vec3 vAeliaFace;
      float aeliaCoverage() {
        if (aeliaBlink <= 0.0) return 0.0;
        float x = abs(abs(vAeliaFace.x + .0054) - .0323);
        float y = vAeliaFace.y - 1.6197;
        float ellipse = length(vec2(x / .021, y / .0115));
        float eyeMask = (1.0 - smoothstep(.78, 1.08, ellipse)) * smoothstep(.05, .075, vAeliaFace.z);
        float cover = smoothstep(.0115 * (1.0 - 2.0 * aeliaBlink) - .002, .0115 * (1.0 - 2.0 * aeliaBlink) + .002, y);
        return eyeMask * cover * smoothstep(0.0, .12, aeliaBlink);
      }
      vec4 aeliaPaint(vec4 originalPaint) {
        #ifdef USE_MAP
        float x = abs(abs(vAeliaFace.x + .0054) - .0323);
        float y = vAeliaFace.y - 1.6197;
        vec4 skin = texture2D(map, vAeliaLidUv);
        float seam = -.002 + .003 * (x / .021) * (x / .021);
        float foldOffset = (y - seam) / .0008;
        float crease = exp(-foldOffset * foldOffset) * .22 * smoothstep(.72, 1.0, aeliaBlink);
        skin.rgb *= 1.0 - crease;
        return mix(originalPaint, skin, aeliaCoverage());
        #else
        return originalPaint;
        #endif
      }`).replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','aeliaPaint( texture2D( map, vMapUv ) )'));
    // Match the closed lid's normal/roughness to that same skin sample; the
    // open iris's baked highlight must not remain visible through the lid.
    for(const [chunk,map,uv]of [['normal_fragment_maps','normalMap','vNormalMapUv'],['roughnessmap_fragment','roughnessMap','vRoughnessMapUv'],['metalnessmap_fragment','metalnessMap','vMetalnessMapUv']]){
      shader.fragmentShader=shader.fragmentShader.replace(`#include <${chunk}>`,T.ShaderChunk[chunk].replaceAll(`texture2D( ${map}, ${uv} )`,`mix(texture2D(${map}, ${uv}), texture2D(${map}, vAeliaLidUv), aeliaCoverage())`));
    }
  };
  material.customProgramCacheKey=()=>`${key}|aelia-own-face-v1`;return material;
}


