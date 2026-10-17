import * as T from '../../vendor/three/three.module.js';

const finite=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const textureSlots=['map','normalMap','roughnessMap','metalnessMap','alphaMap','aoMap','emissiveMap','lightMap','bumpMap','displacementMap'];

// Presentation-only screen corridor. Fragment cutaways also work after static
// scenery has been merged/instanced: a pillar fades locally, not its whole hall.
export function sceneryCutawayWeight(point,camera,target,radius=1.35){
  if(!finite(point)||!finite(camera)||!finite(target)||!Number.isFinite(radius)||radius<=0)return 0;
  const x=target.x-camera.x,y=target.y-camera.y,z=target.z-camera.z,l2=x*x+y*y+z*z;
  if(l2<.25)return 0;
  const px=point.x-camera.x,py=point.y-camera.y,pz=point.z-camera.z,t=(px*x+py*y+pz*z)/l2;
  if(t<=0||t>=1-.18/Math.sqrt(l2))return 0;
  const distance=Math.hypot(px-t*x,py-t*y,pz-t*z),q=clamp((distance/(.12+radius*t)-.64)/.36,0,1);
  return 1-q*q*(3-2*q);
}

const vertex=`
  vec4 cutawayPosition=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
    cutawayPosition=instanceMatrix*cutawayPosition;
  #endif
  vSceneryCutaway=(modelMatrix*cutawayPosition).xyz;
`;
const fragment=`
  float sceneryCut=0.0;
  for(int cutIndex=0;cutIndex<2;cutIndex++){
    vec3 axis=cutawayTargets[cutIndex].xyz-cutawayCamera;
    float axisLength=length(axis),radius=cutawayTargets[cutIndex].w;
    if(radius>0.0&&axisLength>0.5){
      vec3 offset=vSceneryCutaway-cutawayCamera;
      float along=dot(offset,axis)/(axisLength*axisLength);
      if(along>0.0&&along<1.0-0.18/axisLength){
        float radial=length(offset-axis*along);
        sceneryCut=max(sceneryCut,1.0-smoothstep(0.64,1.0,radial/(0.12+radius*along)));
      }
    }
  }
  // Stable spatial dithering retains depth ordering and avoids transparent
  // sorting failures through intersecting walls and alpha-tested leaf cards.
  float cutPattern=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(0.06711056,0.00583715))));
  if(cutPattern<sceneryCut*cutawayAmount*0.94)discard;
`;

export function createSceneryOcclusion(group){
  const entries=[],copies=new Map(),uniforms={cutawayCamera:{value:new T.Vector3()},cutawayTargets:{value:[new T.Vector4(),new T.Vector4()]},cutawayAmount:{value:0}};
  let active=false,disposed=false,targetCount=0;
  const eligible=(object,material)=>material&&!material.transparent&&!object.userData.environmentGround&&material.userData.environmentFinish!=='floor'&&material.userData.environmentFinish!=='ground';
  group?.traverse(object=>{
    if(!object.isMesh||object.isSkinnedMesh||object.userData.cameraOcclusion===false)return;
    for(let p=object.parent;p;p=p.parent)if(p.userData.cameraOcclusion===false)return;
    const original=object.material,list=Array.isArray(original)?original:[original];
    if(!list.some(material=>eligible(object,material)))return;
    const replacements=list.map(material=>{
      if(!eligible(object,material))return material;
      if(!copies.has(material)){
        const copy=material.clone(),previous=material.onBeforeCompile,key=material.customProgramCacheKey();
        copy.name=`${material.name||material.type} · camera cutaway`;
        copy.onBeforeCompile=(shader,...args)=>{
          previous.call(material,shader,...args);Object.assign(shader.uniforms,uniforms);
          shader.vertexShader='varying vec3 vSceneryCutaway;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',vertex+'\n#include <project_vertex>');
          shader.fragmentShader='varying vec3 vSceneryCutaway; uniform vec3 cutawayCamera; uniform vec4 cutawayTargets[2]; uniform float cutawayAmount;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n'+fragment);
        };
        copy.customProgramCacheKey=()=>`${key}:scenery-cutaway-v1`;copies.set(material,copy);
      }return copies.get(material);
    });
    entries.push({object,original,replacement:Array.isArray(original)?replacements:replacements[0]});
  });
  function reset(){if(disposed)return;for(const e of entries)if(e.object.material===e.replacement)e.object.material=e.original;active=false;targetCount=0;uniforms.cutawayAmount.value=0;for(const t of uniforms.cutawayTargets.value)t.set(0,0,0,0);}
  return {
    update(camera,{targets=[],enabled=true,delta=1/60,reducedMotion=false}={}){
      if(disposed)return;
      const valid=targets.filter(t=>finite(t?.position)&&Number.isFinite(t.radius??1.35)&&(t.radius??1.35)>0).slice(0,2);
      if(!enabled||!camera||!valid.length){reset();return;}
      camera.getWorldPosition(uniforms.cutawayCamera.value);
      if(!finite(uniforms.cutawayCamera.value)){reset();return;}
      // Environment textures arrive asynchronously after the first frame.
      // Keep private shaders bound to the owner's latest texture references;
      // in particular, never retain the disposed procedural foliage fallback.
      for(const [original,copy]of copies)for(const slot of textureSlots)if(copy[slot]!==original[slot]){copy[slot]=original[slot];copy.needsUpdate=true;}
      if(!active){for(const e of entries)if(e.object.material===e.original)e.object.material=e.replacement;active=true;}
      targetCount=valid.length;
      uniforms.cutawayTargets.value.forEach((target,i)=>{const t=valid[i];t?target.set(t.position.x,t.position.y,t.position.z,clamp(t.radius??1.35,.25,3.5)):target.set(0,0,0,0);});
      const dt=Number.isFinite(delta)?clamp(delta,0,.1):1/60;
      uniforms.cutawayAmount.value=reducedMotion?1:Math.min(1,uniforms.cutawayAmount.value+dt*8);
    },
    reset,
    dispose(){if(disposed)return;reset();disposed=true;for(const material of copies.values())material.dispose();copies.clear();entries.length=0;},
    stats(){return {active,targets:targetCount,materials:copies.size,meshes:entries.length,amount:uniforms.cutawayAmount.value,disposed};}
  };
}
