// Small original material fields evaluated in world space. Batching and
// instancing therefore cannot stretch a stain or repeat a whole wall texture.
const fields=`
varying vec3 vEnvironmentSurface;
float envHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float envNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(envHash(i),envHash(i+vec2(1.0,0.0)),f.x),mix(envHash(i+vec2(0.0,1.0)),envHash(i+vec2(1.0)),f.x),f.y);}
`;
export function finishEnvironmentMaterial(material,kind,{wet=false,arid=false}={}){
  const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,...args)=>{
    previous.call(material,shader,...args);
    shader.vertexShader='varying vec3 vEnvironmentSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 environmentPosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        environmentPosition=instanceMatrix*environmentPosition;
      #endif
      vEnvironmentSurface=(modelMatrix*environmentPosition).xyz;`);
    shader.fragmentShader=fields+shader.fragmentShader;
    let color='',roughness='';
    if(kind==='ground'){
      color=`float envBroad=envNoise(vEnvironmentSurface.xz*.13),envFine=envNoise(vEnvironmentSurface.xz*.77+vec2(9.0,17.0));
        diffuseColor.rgb*=mix(vec3(${arid?'.86,.82,.73':'.72,.85,.65'}),vec3(1.13,1.10,.97),smoothstep(.15,.85,envBroad))*(.94+envFine*.10);`;
      roughness=`roughnessFactor*=mix(${wet?'.66':'.84'},1.0,envFine);`;
    }else if(kind==='foliage'){
      color=`float envPatch=envNoise(vEnvironmentSurface.xz*2.6+vEnvironmentSurface.y*.31);diffuseColor.rgb*=mix(vec3(.83,.94,.66),vec3(1.03,1.08,.93),envPatch);if(!gl_FrontFacing)diffuseColor.rgb*=vec3(1.03,1.04,.94);`;
      roughness='roughnessFactor*=.91;';
    }else if(kind==='floor'){
      color=`vec2 envTile=floor(vEnvironmentSurface.xz/1.85);float envStone=envHash(envTile);vec2 envJoint=abs(fract(vEnvironmentSurface.xz/1.85)-.5);float envMortar=smoothstep(.481,.497,max(envJoint.x,envJoint.y));diffuseColor.rgb*=mix(.91+envStone*.13,.77,envMortar);`;
      roughness='roughnessFactor*=mix(.82,1.04,envStone);';
    }else{
      color=`float envLarge=envNoise(vEnvironmentSurface.xz*.71+vec2(vEnvironmentSurface.y*.18)),envGrain=envNoise(vec2(vEnvironmentSurface.x+vEnvironmentSurface.z,vEnvironmentSurface.y)*${kind==='wood'?'vec2(7.0,.8)':'vec2(2.7,3.4)'});float envDamp=(1.0-smoothstep(.03,1.6,vEnvironmentSurface.y))*(.04+envLarge*.13);diffuseColor.rgb*=((.88+envLarge*.15)*(.96+envGrain*.07)-envDamp);`;
      roughness='roughnessFactor*=mix(.91,1.0,envGrain);';
    }
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${color}`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\n${roughness}`);
  };
  material.customProgramCacheKey=()=>`${oldKey}:environment-finish-v1:${kind}:${wet}:${arid}`;
  material.userData.environmentFinish=kind;
}
