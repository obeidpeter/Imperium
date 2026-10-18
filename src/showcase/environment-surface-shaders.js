// Small original material fields evaluated in world space. Batching and
// instancing therefore cannot stretch a stain or repeat a whole wall texture.
const fields=`
varying vec3 vEnvironmentSurface;
float envHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float envNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(envHash(i),envHash(i+vec2(1.0,0.0)),f.x),mix(envHash(i+vec2(0.0,1.0)),envHash(i+vec2(1.0)),f.x),f.y);}
`;

function cpuHash(x,z){
  const s=Math.sin(x*127.1+z*311.7)*43758.5453;
  return s-Math.floor(s);
}
function cpuNoise(x,z){
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const ux=fx*fx*(3-2*fx),uz=fz*fz*(3-2*fz);
  const a=cpuHash(ix,iz),b=cpuHash(ix+1,iz),c=cpuHash(ix,iz+1),d=cpuHash(ix+1,iz+1);
  return (a+(b-a)*ux)+((c+(d-c)*ux)-(a+(b-a)*ux))*uz;
}
function smoothstep(a,b,x){
  const t=Math.max(0,Math.min(1,(x-a)/Math.max(0.0001,b-a)));
  return t*t*(3-2*t);
}

export function sampleWaterSurface(x,z,time=0,{rain=false,marsh=false}={}){
  const t=Number.isFinite(time)?time:0;
  const speed=marsh?0.45:1;
  const waveA=Math.sin(x*1.45-t*1.65*speed+z*0.55);
  const waveB=Math.cos(z*2.15+t*1.25*speed-x*0.48);
  const coarse=cpuNoise(x*0.62-t*0.35*speed,z*0.62+t*0.22*speed);
  const wave=(waveA*0.52+waveB*0.48)*(marsh?0.42:1);
  const bankBand=Math.abs(((x*0.4)%1+1)%1-0.5)*2;
  const foamRaw=smoothstep(0.56,0.92,coarse+wave*0.28+(1-bankBand)*0.22);
  const foam=foamRaw*(marsh?0.32:1);
  let ripple=0;
  if(rain){
    const cellX=Math.floor(x*1.8),cellZ=Math.floor(z*1.8);
    const localX=(x*1.8-cellX)-0.5,localZ=(z*1.8-cellZ)-0.5;
    const phase=(t*2.4+cpuHash(cellX,cellZ)*6.283185)%1;
    const dist=Math.hypot(localX,localZ);
    const ring=Math.max(0,1-Math.abs(dist-phase*0.48)/0.075)*(1-phase);
    ripple=Math.min(1,ring);
  }
  const roughness=Math.max(0.08,Math.min(0.95,(marsh?0.34:0.2)*Math.max(0.35,0.88-wave*0.24-ripple*0.28+foam*0.18)));
  const tint=[
    Math.max(0,Math.min(1.6,0.92+wave*0.08+foam*0.28+ripple*0.14)),
    Math.max(0,Math.min(1.6,0.96+wave*0.09+foam*0.29+ripple*0.15)),
    Math.max(0,Math.min(1.6,1.02+wave*0.11+foam*0.3+ripple*0.18))
  ];
  return {wave,foam,ripple,roughness,tint};
}

export function finishEnvironmentMaterial(material,kind,{wet=false,arid=false,rain=false,marsh=false,waterTime=null}={}){
  const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
  const timeUniform=waterTime??{value:0};
  material.onBeforeCompile=(shader,...args)=>{
    previous.call(material,shader,...args);
    shader.uniforms=shader.uniforms||{};
    if(kind==='water')shader.uniforms.environmentWaterTime=timeUniform;
    shader.vertexShader='varying vec3 vEnvironmentSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 environmentPosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        environmentPosition=instanceMatrix*environmentPosition;
      #endif
      vEnvironmentSurface=(modelMatrix*environmentPosition).xyz;`);
    shader.fragmentShader=(kind==='water'?'uniform float environmentWaterTime;\n':'')+fields+shader.fragmentShader;
    let color='',roughness='';
    if(kind==='water'){
      const speed=marsh?'.45':'1.0',amp=marsh?'.42':'1.0',foamScale=marsh?'.32':'1.0';
      color=`float envTime=environmentWaterTime*${speed};
        float envWaveA=sin(vEnvironmentSurface.x*1.45-envTime*1.65+vEnvironmentSurface.z*.55);
        float envWaveB=cos(vEnvironmentSurface.z*2.15+envTime*1.25-vEnvironmentSurface.x*.48);
        float envCoarse=envNoise(vEnvironmentSurface.xz*.62+vec2(-envTime*.35,envTime*.22));
        float envWave=(envWaveA*.52+envWaveB*.48)*${amp};
        float envBank=1.0-smoothstep(.12,.46,abs(fract(vEnvironmentSurface.z*.4)-.5));
        float envFoam=smoothstep(.60,.91,envCoarse+envWave*.26+envBank*.24)*${foamScale};
        float envRipple=0.0;
        ${rain?`vec2 envRainCell=floor(vEnvironmentSurface.xz*1.8);
        vec2 envRainUv=fract(vEnvironmentSurface.xz*1.8)-.5;
        float envRainPhase=fract(environmentWaterTime*2.1+envHash(envRainCell));
        envRipple=clamp((1.0-abs(length(envRainUv)-envRainPhase*.46)/.075)*(1.0-envRainPhase),0.0,1.0);`:''}
        vec3 envDeep=diffuseColor.rgb*vec3(.86,.93,.98);
        vec3 envCrest=diffuseColor.rgb*vec3(1.14,1.18,1.22);
        diffuseColor.rgb=mix(envDeep,envCrest,clamp(.5+envWave*.38,0.0,1.0));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.90,.94,.96),clamp(envFoam*.62+envRipple*.38,0.0,1.0));
        diffuseColor.a=clamp(diffuseColor.a+envFoam*.11+envRipple*.06,0.0,1.0);`;
      roughness='roughnessFactor*=clamp(.88-envWave*.24-envRipple*.28+envFoam*.18,.32,1.05);';
    }else if(kind==='ground'){
      color=`float envBroad=envNoise(vEnvironmentSurface.xz*.13),envFine=envNoise(vEnvironmentSurface.xz*.77+vec2(9.0,17.0));
        diffuseColor.rgb*=mix(vec3(${arid?'.86,.82,.73':'.72,.85,.65'}),vec3(1.13,1.10,.97),smoothstep(.15,.85,envBroad))*(.94+envFine*.10);
        ${wet||rain?`float envPuddle=smoothstep(.64,.86,envNoise(vEnvironmentSurface.xz*.42+vec2(3.7,11.3)))*(1.0-smoothstep(.08,.65,abs(vEnvironmentSurface.y)));
        diffuseColor.rgb*=mix(1.0,.89,envPuddle);`:''}`;
      roughness=wet||rain?'roughnessFactor*=mix(mix(.64,.96,envFine),.20,envPuddle);':'roughnessFactor*=mix(.84,1.0,envFine);';
    }else if(kind==='foliage'){
      color=`float envPatch=envNoise(vEnvironmentSurface.xz*2.6+vEnvironmentSurface.y*.31);
        float envSubsurface=smoothstep(.28,.88,envPatch)*(.35+clamp(vEnvironmentSurface.y*.12,0.0,.65));
        diffuseColor.rgb*=mix(vec3(.82,.93,.65),vec3(1.06,1.10,.92),envPatch)+vec3(.05,.045,.01)*envSubsurface;
        if(!gl_FrontFacing)diffuseColor.rgb*=vec3(1.05,1.06,.95);`;
      roughness=wet||rain?'roughnessFactor*=mix(.68,.88,envPatch);':'roughnessFactor*=.91;';
    }else if(kind==='floor'){
      color=`vec2 envTile=floor(vEnvironmentSurface.xz/1.85);float envStone=envHash(envTile);vec2 envJoint=abs(fract(vEnvironmentSurface.xz/1.85)-.5);
        float envMortar=smoothstep(.481,.497,max(envJoint.x,envJoint.y));
        float envBronze=smoothstep(.472,.481,max(envJoint.x,envJoint.y))*(1.0-envMortar);
        float envVein=pow(.5+.5*cos(vEnvironmentSurface.x*1.85+vEnvironmentSurface.z*.62+envNoise(vEnvironmentSurface.xz*.82)*3.8),8.0);
        diffuseColor.rgb*=mix(.91+envStone*.13-envVein*.06,.77,envMortar);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.66,.44),envBronze*.32);`;
      roughness='roughnessFactor*=mix(.54,.94,envStone*(1.0-envVein*.25));';
    }else{
      color=`float envLarge=envNoise(vEnvironmentSurface.xz*.71+vec2(vEnvironmentSurface.y*.18)),envGrain=envNoise(vec2(vEnvironmentSurface.x+vEnvironmentSurface.z,vEnvironmentSurface.y)*${kind==='wood'?'vec2(7.0,.8)':'vec2(2.7,3.4)'});float envDamp=(1.0-smoothstep(.03,1.6,vEnvironmentSurface.y))*(.04+envLarge*.13);diffuseColor.rgb*=((.88+envLarge*.15)*(.96+envGrain*.07)-envDamp);`;
      roughness=kind==='stone'&&(wet||rain)?'roughnessFactor*=mix(.58,.92,envGrain);':'roughnessFactor*=mix(.91,1.0,envGrain);';
    }
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${color}`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\n${roughness}`);
  };
  material.customProgramCacheKey=()=>`${oldKey}:environment-finish-v2:${kind}:${wet}:${arid}:${rain}:${marsh}`;
  material.userData.environmentFinish=kind;
  material.userData.environmentFinishOptions={wet:Boolean(wet),arid:Boolean(arid),rain:Boolean(rain),marsh:Boolean(marsh)};
  if(kind==='water')material.userData.waterTime=timeUniform;
}
