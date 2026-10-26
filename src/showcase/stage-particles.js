import * as T from '../../vendor/three/three.module.js';
import {sampleWorldWind} from './world-weather.js';

export function createParticleMask(){
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const d=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),alpha=Math.max(0,1-d*d)**2;
    data.set([255,255,255,Math.round(alpha*255)],(y*size+x)*4);
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}

// Weather, fire, impacts and thrown dust use one program. Their different
// motion and silhouettes are uniforms, while RGBA + alpha/scale attributes
// keep Three's vertex-layout flags identical. Existing dust RGBA stays intact.
export function installParticleAttributes(geometry){
  const count=geometry.attributes.position.count;
  if(!geometry.attributes.color)geometry.setAttribute('color',new T.BufferAttribute(new Float32Array(count*4).fill(1),4));
  geometry.setAttribute('plumeAlpha',new T.BufferAttribute(new Float32Array(count).fill(1),1));
  geometry.setAttribute('plumeScale',new T.BufferAttribute(new Float32Array(count).fill(1),1));
  return geometry;
}
export function createParticleMaterial(mask,{mode=0,...options}={}){
  // A previously unmapped flame/dust still samples opaque white, preserving
  // its appearance without creating a second map/no-map program. Only this
  // fallback belongs to the material; caller-supplied masks remain borrowed.
  let ownedMask=null;
  if(!mask){ownedMask=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1,T.RGBAFormat);ownedMask.needsUpdate=true;mask=ownedMask;}
  const m=new T.PointsMaterial({map:mask,alphaTest:.015,size:.25,vertexColors:true,transparent:true,depthWrite:false,...options});
  if(ownedMask)m.addEventListener('dispose',()=>{ownedMask?.dispose();ownedMask=null;});
  const uniforms={particleMode:{value:mode},weatherTime:{value:0},weatherAnchor:{value:new T.Vector3()},weatherSpan:{value:new T.Vector3(30,11,30)},weatherWind:{value:new T.Vector2()},weatherFall:{value:-8.2},weatherMode:{value:0}};
  m.userData.particleUniforms=uniforms;
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='uniform float particleMode; uniform float weatherTime; uniform float weatherFall; uniform vec3 weatherAnchor; uniform vec3 weatherSpan; uniform vec2 weatherWind; attribute float plumeAlpha; attribute float plumeScale; varying float vPlumeAlpha;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      if(particleMode>.5&&particleMode<1.5){
        vec3 seed=vec3(position.x*weatherSpan.x,position.y*weatherSpan.y,position.z*weatherSpan.z);
        vec2 drift=weatherWind*weatherTime*2.4;
        transformed.xz=mod(seed.xz+drift-weatherAnchor.xz+weatherSpan.xz*.5,weatherSpan.xz)-weatherSpan.xz*.5+weatherAnchor.xz;
        transformed.y=mod(seed.y+weatherTime*weatherFall,weatherSpan.y)+max(0.0,weatherAnchor.y-.5)+.18;
      }`);
    shader.vertexShader=shader.vertexShader.replace('gl_PointSize = size;','gl_PointSize = size * plumeScale; vPlumeAlpha = plumeAlpha;');
    shader.fragmentShader='uniform float particleMode; uniform float weatherMode; varying float vPlumeAlpha;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_particle_fragment>',`#include <map_particle_fragment>
      if(particleMode>.5&&particleMode<1.5){
        vec2 weatherUv=gl_PointCoord-vec2(.5);
        if(weatherMode<.5){
          float streak=(1.0-smoothstep(.025,.095,abs(weatherUv.x+weatherUv.y*.12)))*(1.0-smoothstep(.24,.5,abs(weatherUv.y)));
          diffuseColor.a*=streak;
        }else if(weatherMode>1.5){
          float softness=1.0-smoothstep(.08,.5,length(weatherUv));
          diffuseColor.a*=softness*softness;
        }
      }else if(particleMode>1.5){
        float plumeEdge=1.0-smoothstep(.12,.5,length(gl_PointCoord-vec2(.5)));
        diffuseColor.a*=vPlumeAlpha*plumeEdge;
      }`);
  };
  m.customProgramCacheKey=()=> 'shared-particle-effects-v1';
  return m;
}
// Allocate later impacts through the same factory: Material.clone() does not
// copy shader hooks and would compile an extra program during a busy exchange.
export function createImpactCloud(mask){
  const geometry=installParticleAttributes(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(24*3),3)));
  const material=createParticleMaterial(mask,{color:'#ffe4a1',size:.065,opacity:0,blending:T.AdditiveBlending});
  const cloud=new T.Points(geometry,material);cloud.frustumCulled=false;return cloud;
}

// Screen feedback is anchored to the deformed defender, with a short contact
// burst and gravity. Deterministic indices replace random particles entirely.
export function sampleImpactParticles(cloud,point,progress,{shield=false,source}={}){
  const t=Math.max(0,Math.min(1,progress)),v=cloud.geometry.attributes.position,dx=point.x-(source?.x??point.x),dz=point.z-(source?.z??point.z),length=Math.hypot(dx,dz)||1;
  for(let i=0;i<v.count;i++){
    const angle=i*2.399963,speed=.12+(i%7)/7*.46,radius=t*speed;
    v.setXYZ(i,point.x+Math.cos(angle)*radius+dx/length*t*.14,point.y+Math.sin(i*1.83)*radius*.6+.13*t-.44*t*t,point.z+Math.sin(angle)*radius+dz/length*t*.14);
  }
  v.needsUpdate=true;cloud.material.opacity=(1-t)**2*(shield?.82:.42);cloud.material.size=shield?.055:.10;cloud.material.color.set(shield?'#ffdc96':'#b3a58c');
}

const WEATHER_SPECS={
  rain:{mode:0,color:'#b8cddb',size:.72,opacity:.38,alphaTest:.04,vy:-8.2,spanY:11},
  embers:{mode:1,color:'#ffb15e',size:.09,opacity:.62,alphaTest:.04,vy:1.05,spanY:7},
  dust:{mode:2,color:'#d4be96',size:1.45,opacity:.12,alphaTest:.001,vy:.06,spanY:4.5},
  mist:{mode:3,color:'#cfdcd8',size:2.9,opacity:.085,alphaTest:.001,vy:.025,spanY:2.5},
};
export function createWeatherField(mask,{quality='balanced'}={}){
  const count=quality==='performance'?128:quality==='high'?640:384,positions=new Float32Array(count*3);
  // Static, evenly distributed seeds. Movement is sampled on the GPU: a camera
  // tour does not upload hundreds of particle vertices every frame.
  for(let i=0;i<count;i++)positions.set([((i*.754877666)%1)-.5,(i*.569840296)%1,((i*.438579)%1)-.5],i*3);
  const g=installParticleAttributes(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(positions,3)));
  const m=createParticleMaterial(mask,{mode:1,color:0xb8cddb,alphaTest:.04,size:.08,opacity:0});
  m.userData.weatherUniforms=m.userData.particleUniforms;
  const cloud=new T.Points(g,m);cloud.name='weather-particles';cloud.visible=false;cloud.renderOrder=4;cloud.frustumCulled=false;cloud.userData.quality=quality;return cloud;
}
export function sampleWeatherParticles(cloud,weather='clear',time=0,{reducedMotion=false,anchor,chapter=1,indoors=false}={}){
  const spec=WEATHER_SPECS[weather];
  if(!spec||indoors){cloud.visible=false;cloud.material.opacity=0;return;}
  cloud.visible=true;cloud.userData.weather=weather;
  cloud.material.color.set(spec.color);cloud.material.size=spec.size;cloud.material.opacity=reducedMotion?spec.opacity*.55:spec.opacity;
  // Mist/dust have faint feathered edges: the rain cutoff would discard the
  // whole falloff and leave hard circular cores, especially in reduced motion.
  // Both cutoffs remain positive, preserving the shared alpha-test program.
  cloud.material.alphaTest=spec.alphaTest;
  const t=reducedMotion?0:(Number.isFinite(time)?time%3600:0),u=cloud.material.userData.weatherUniforms,wind=sampleWorldWind(t,{chapter,weather,reducedMotion});
  u.weatherTime.value=t;u.weatherSpan.value.y=spec.spanY;u.weatherFall.value=spec.vy;u.weatherMode.value=spec.mode;u.weatherWind.value.set(wind.x,wind.z);
  u.weatherAnchor.value.set(Number.isFinite(anchor?.x)?anchor.x:0,Number.isFinite(anchor?.y)?anchor.y:0,Number.isFinite(anchor?.z)?anchor.z:0);
}

export function createFlamePlume(mask=null){
  const g=installParticleAttributes(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(40*3),3)));
  const m=createParticleMaterial(mask,{mode:2,color:0xffffff,opacity:.82});
  const cloud=new T.Points(g,m);cloud.name='brazier-flame-plume';cloud.visible=true;cloud.renderOrder=5;
  cloud.frustumCulled=false;cloud.userData.environmentDynamic=true;
  sampleFlamePlume(cloud,0,{reducedMotion:false});
  return cloud;
}

export function sampleFlamePlume(cloud,time=0,{reducedMotion=false,chapter=1,weather='clear'}={}){
  if(!cloud?.geometry?.attributes?.position)return;
  const t=reducedMotion?0:(Number.isFinite(time)?time%3600:0),v=cloud.geometry.attributes.position,c=cloud.geometry.attributes.color,alpha=cloud.geometry.attributes.plumeAlpha,scale=cloud.geometry.attributes.plumeScale,wind=sampleWorldWind(t,{chapter,weather,reducedMotion});
  for(let i=0;i<v.count;i++){
    const smoke=i>=24,phase=((i/v.count+t*(smoke?.19:1.05+(i%5)*.11))%1+1)%1;
    const radius=smoke?.1+phase*.34:(1-phase*.7)*(.04+(i%4)*.038),angle=i*2.399963+t*(smoke?.3:2.2)+phase*2.4;
    const rise=smoke?.65+phase*1.9:phase*.86,drift=smoke?phase*phase*1.2:phase*.17;
    v.setXYZ(i,Math.cos(angle)*radius+wind.x*drift,rise,Math.sin(angle)*radius+wind.z*drift);
    if(c){const shade=.19+phase*.11;c.setXYZ(i,smoke?shade:1,smoke?shade:.22+(1-phase)*.59,smoke?shade*.95:.035+(1-phase)*.16);}
    alpha?.setX(i,smoke?Math.sin(phase*Math.PI)*.25:(1-phase)*.9);scale?.setX(i,smoke?2.1+phase*3.8:1.05-phase*.40);
  }
  v.needsUpdate=true;if(c)c.needsUpdate=true;if(alpha)alpha.needsUpdate=true;if(scale)scale.needsUpdate=true;
  if(cloud.material)cloud.material.opacity=reducedMotion?.72:.79+.07*Math.sin(t*7.1);
}
