import * as T from '../../vendor/three/three.module.js';

const finite=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

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
  if(cutawayAmount>0.0){
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
  }
`;

// One set of uniforms for every patched material; the stage writes them before
// it draws. Only one stage draws at a time (a battle or a ceremony).
export const CUTAWAY_UNIFORMS=Object.freeze({cutawayCamera:{value:new T.Vector3()},cutawayTargets:{value:[new T.Vector4(),new T.Vector4()]},cutawayAmount:{value:0}});

// The cutaway is part of an eligible material's own program from its first
// compile and switched by uniforms, so turning it on never compiles a shader
// or swaps a material in the middle of play.
function patch(material){
  if(material.userData.sceneryCutaway)return;
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,...args)=>{
    previous.call(material,shader,...args);Object.assign(shader.uniforms,CUTAWAY_UNIFORMS);
    shader.vertexShader='varying vec3 vSceneryCutaway;\n'+shader.vertexShader.replace('#include <project_vertex>',vertex+'\n#include <project_vertex>');
    shader.fragmentShader='varying vec3 vSceneryCutaway; uniform vec3 cutawayCamera; uniform vec4 cutawayTargets[2]; uniform float cutawayAmount;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n'+fragment);
  };
  material.customProgramCacheKey=()=>`${previousKey}:scenery-cutaway-v2`;
  material.userData.sceneryCutaway=true;material.needsUpdate=true;
}

// Covers every mesh in the given groups (the environment and any generated
// scenery); add() covers models that arrive later, before they are drawn. A
// material that an excluded mesh also uses (the ground) is left as it is.
export function createSceneryOcclusion(...groups){
  const materials=new Set();let meshes=0,active=false,disposed=false,targetCount=0;
  const eligible=(object,material)=>material&&!material.transparent&&!object.userData.environmentGround&&material.userData.environmentFinish!=='floor'&&material.userData.environmentFinish!=='ground';
  function add(group){
    if(disposed||!group)return 0;
    const candidates=[],excluded=new Set();
    group.traverse(object=>{
      if(!object.isMesh)return;
      let skip=object.isSkinnedMesh||object.userData.cameraOcclusion===false;
      for(let p=object.parent;p&&!skip;p=p.parent)if(p.userData.cameraOcclusion===false)skip=true;
      const list=[object.material].flat().filter(Boolean);
      for(const material of list)if(skip||!eligible(object,material))excluded.add(material);
      if(!skip)candidates.push({object,list:list.filter(material=>eligible(object,material))});
    });
    let added=0;
    for(const {list}of candidates){
      const own=list.filter(material=>!excluded.has(material));
      own.forEach(material=>{patch(material);materials.add(material);});
      if(own.length)added++;
    }
    meshes+=added;return added;
  }
  groups.forEach(add);
  function reset(){if(disposed)return;active=false;targetCount=0;CUTAWAY_UNIFORMS.cutawayAmount.value=0;for(const t of CUTAWAY_UNIFORMS.cutawayTargets.value)t.set(0,0,0,0);}
  return {
    add,
    update(camera,{targets=[],enabled=true,delta=1/60,reducedMotion=false}={}){
      if(disposed)return;
      const valid=targets.filter(t=>finite(t?.position)&&Number.isFinite(t.radius??1.35)&&(t.radius??1.35)>0).slice(0,2);
      if(!enabled||!camera||!valid.length){reset();return;}
      camera.getWorldPosition(CUTAWAY_UNIFORMS.cutawayCamera.value);
      if(!finite(CUTAWAY_UNIFORMS.cutawayCamera.value)){reset();return;}
      active=true;targetCount=valid.length;
      CUTAWAY_UNIFORMS.cutawayTargets.value.forEach((target,i)=>{const t=valid[i];t?target.set(t.position.x,t.position.y,t.position.z,clamp(t.radius??1.35,.25,3.5)):target.set(0,0,0,0);});
      const dt=Number.isFinite(delta)?clamp(delta,0,.1):1/60;
      CUTAWAY_UNIFORMS.cutawayAmount.value=reducedMotion?1:Math.min(1,CUTAWAY_UNIFORMS.cutawayAmount.value+dt*8);
    },
    reset,
    // The patched materials belong to their scenery and are freed with it.
    dispose(){if(disposed)return;reset();disposed=true;materials.clear();},
    stats(){return {active,targets:targetCount,materials:materials.size,meshes,amount:active?CUTAWAY_UNIFORMS.cutawayAmount.value:0,disposed};}
  };
}
