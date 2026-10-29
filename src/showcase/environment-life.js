import * as THREE from '../../vendor/three/three.module.js';
import {LIFE_LAYOUT,presentationRandom,presentationSeed} from '../ui/world-layouts.js';
import {getRegionalKitPlacements,regionalComponentDimensions} from './environment-regional-world.js';
import {sampleWorldWind} from './world-weather.js';

// Life about the field (worlds and gameplay plan, release 9): birds wheeling over the land by
// day and smoke rising from the hearths of barracks, forges and field kitchens, drawn in one
// instanced mesh with one material, so a scene gains one draw and one shader program; and the
// banners' cloth stirring in the wind. Presentation only: the flocks come from the encounter's
// presentation seed, the hearths from the layout data, and all motion from the environment's
// clock, which reduced motion holds at 0. Nothing takes picks or touches the rules.

const NO_BIRDS=new Set(['rain','dust']);
/** Where a scene's birds fly and its hearths smoke; empty on Performance and indoors. */
export function lifeSources(e,profile,{tileSize=2.5,quality='balanced',height=()=>0,withoutGate=false}={}){
  const tier=quality==='high'?'high':quality==='balanced'?'balanced':null;
  if(!tier||!e||profile?.civic)return {birds:[],hearths:[]};
  const random=presentationRandom(presentationSeed(`life:${e.id??'world'}`)),halfX=e.width*tileSize/2,halfZ=e.height*tileSize/2,birds=[];
  if(profile.timeOfDay!=='night'&&!NO_BIRDS.has(profile.weather)){
    const total=LIFE_LAYOUT.birds[tier],flocks=tier==='high'?2:1;
    for(let f=0;f<flocks;f++){
      // Each flock wheels round a point beyond the board, high over the land: no circle
      // (14 m at most) comes within 4 m of the board's corners.
      const angle=random()*Math.PI*2,reach=Math.hypot(halfX,halfZ)+18+random()*12,turn=random()<.5?-1:1;
      const centre={x:Math.cos(angle)*reach,y:height(Math.cos(angle)*reach,Math.sin(angle)*reach)+17+random()*10,z:Math.sin(angle)*reach};
      for(let i=f;i<total;i+=flocks)birds.push({...centre,radius:5+random()*9,speed:turn*(.22+random()*.16),phase:random()*Math.PI*2,size:.6+random()*.3,lift:(random()-.5)*5,bob:random()*Math.PI*2});
    }
  }
  // Hearths: the layout's pieces in this scene, nearest the board first.
  const hearths=getRegionalKitPlacements(e,{chapter:profile.chapter,tileSize,withoutGate}).filter(p=>LIFE_LAYOUT.hearths[p.component]).map(p=>{
    const at=LIFE_LAYOUT.hearths[p.component],[,h,d]=regionalComponentDimensions(p.id,p.component),s=p.scale??[1,1,1],yaw=p.yaw??0;
    const x=p.x+Math.sin(yaw)*d*s[2]*at.depth,z=p.z+Math.cos(yaw)*d*s[2]*at.depth;
    return {component:p.component,x,y:height(p.x,p.z)+h*s[1]*at.height,z};
  }).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,LIFE_LAYOUT.maxHearths);
  return {birds,hearths:hearths.map(h=>({...h,puffs:LIFE_LAYOUT.puffs[tier]}))};
}

const VERTEX_HEAD=`attribute float lifeKind;
attribute vec3 lifeCentre;
attribute vec4 lifeShape;
attribute vec2 lifeExtra;
uniform float lifeTime;
uniform vec2 lifeWind;
varying vec2 vLifeUv;
varying float vLifeKind;
varying float vLifeAlpha;
varying float vLifeFlap;
`;
// A quad turned to face the camera: a bird on its circle, or a puff of smoke that rises,
// spreads and drifts with the wind over its life, then begins again.
const VERTEX_BODY=`
vec3 lifeRight=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]),lifeUp=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
vec3 lifeAt;float lifeSize;
if(lifeKind<.5){
  float a=lifeShape.z+lifeTime*lifeShape.y;
  lifeAt=lifeCentre+vec3(cos(a)*lifeShape.x,lifeExtra.x+sin(lifeTime*.6+lifeExtra.y)*.9,sin(a)*lifeShape.x);
  lifeSize=lifeShape.w;vLifeFlap=sin(lifeTime*7.5+lifeShape.z*5.);vLifeAlpha=1.;
}else{
  float age=fract(lifeTime/lifeShape.y+lifeShape.x);
  lifeAt=lifeCentre+vec3(lifeWind.x*age*lifeExtra.x,age*lifeShape.z,lifeWind.y*age*lifeExtra.x);
  lifeSize=lifeShape.w*(.4+age*1.5);vLifeFlap=age;vLifeAlpha=smoothstep(0.,.18,age)*(1.-smoothstep(.5,1.,age));
}
vec4 mvPosition=viewMatrix*vec4(lifeAt+(lifeRight*position.x+lifeUp*position.y)*lifeSize,1.);
gl_Position=projectionMatrix*mvPosition;
vLifeUv=position.xy*2.;vLifeKind=lifeKind;
`;
const FRAGMENT_HEAD=`uniform vec3 lifeBird;
uniform vec3 lifeSmoke;
varying vec2 vLifeUv;
varying float vLifeKind;
varying float vLifeAlpha;
varying float vLifeFlap;
`;
// A bird: two wings in a shallow V that beat, and a small body. Smoke: a soft round puff.
const FRAGMENT_BODY=`
if(vLifeKind<.5){
  float x=abs(vLifeUv.x),wing=vLifeUv.y-(.1+.42*vLifeFlap)*x+.18*x*x;
  if((abs(wing)>.13*(1.-x*.8)||x>1.)&&length(vLifeUv*vec2(1.,1.5))>.15)discard;
  diffuseColor=vec4(lifeBird,1.);
}else{
  float a=(1.-smoothstep(.2,1.,length(vLifeUv)))*vLifeAlpha*.36;if(a<.01)discard;
  diffuseColor=vec4(lifeSmoke,a);
}
`;
export function lifeMaterial({bird='#2b2724',smoke='#cbc5ba'}={}){
  const time={value:0},wind={value:new THREE.Vector2()},material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false});
  material.name='field life';
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{lifeTime:time,lifeWind:wind,lifeBird:{value:new THREE.Color(bird)},lifeSmoke:{value:new THREE.Color(smoke)}});
    shader.vertexShader=VERTEX_HEAD+shader.vertexShader.replace('#include <project_vertex>',VERTEX_BODY);
    shader.fragmentShader=FRAGMENT_HEAD+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>'+FRAGMENT_BODY);
  };
  material.customProgramCacheKey=()=>'field-life-v1';
  return {material,time,wind};
}
/** The scene's birds and smoke in one mesh under `root`, moving with `animated` (the
 * environment's clock); null when there are none. */
export function createEnvironmentLife(root,{sources,profile,animated=[]}){
  const count=sources.birds.length+sources.hearths.reduce((n,h)=>n+h.puffs,0);if(!count)return null;
  const night=profile.timeOfDay==='night',smoke=new THREE.Color('#cbc5ba').lerp(new THREE.Color(profile.fog??'#cbc5ba'),.25).multiplyScalar(night?.45:1);
  const {material,time,wind}=lifeMaterial({smoke:`#${smoke.getHexString()}`}),geometry=new THREE.PlaneGeometry(1,1);
  const kind=new Float32Array(count),centre=new Float32Array(count*3),shape=new Float32Array(count*4),extra=new Float32Array(count*2);let i=0;
  for(const b of sources.birds){kind[i]=0;centre.set([b.x,b.y,b.z],i*3);shape.set([b.radius,b.speed,b.phase,b.size],i*4);extra.set([b.lift,b.bob],i*2);i++;}
  for(const [h,hearth] of sources.hearths.entries())for(let k=0;k<hearth.puffs;k++){
    // A plume's puffs share its rise and drift, each at its own point of its life.
    kind[i]=1;centre.set([hearth.x,hearth.y,hearth.z],i*3);shape.set([k/hearth.puffs,7.5+h*.6,6.5,.9],i*4);extra.set([3.2,h],i*2);i++;
  }
  for(const [name,array,size] of [['lifeKind',kind,1],['lifeCentre',centre,3],['lifeShape',shape,4],['lifeExtra',extra,2]])geometry.setAttribute(name,new THREE.InstancedBufferAttribute(array,size));
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name='field life: birds and hearth smoke';
  // Its quads are placed in the shader, so the mesh has no bounds of its own to cull by.
  mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=false;mesh.raycast=()=>{};mesh.userData.environmentDynamic=true;
  root.add(mesh);
  animated.push(t=>{time.value=t;const w=sampleWorldWind(t,profile);wind.value.set(w.x,w.z);});
  return {mesh,stats:()=>({birds:sources.birds.length,hearths:sources.hearths.length,quads:count}),
    dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();}};
}

// Banners' cloth (userData.windCloth, environment-props.js) stirs in the world's wind, each
// banner at its own phase; a banner hidden with its stand-in group is left still.
export function animateClothBanners(root,{profile,animated=[]}){
  const at=new THREE.Vector3(),banners=[];
  root.traverse(o=>{
    if(!o.isMesh||!o.userData.windCloth||o.userData.clothAnimated)return;o.userData.clothAnimated=true;
    o.getWorldPosition(at);banners.push({mesh:o,base:Float32Array.from(o.geometry.attributes.position.array),phase:at.x*.37+at.z*.23});
  });
  const shown=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
  if(banners.length)animated.push(t=>{
    const breeze=sampleWorldWind(t,profile);
    for(const {mesh,base,phase} of banners){
      if(!shown(mesh))continue;const a=mesh.geometry.attributes.position;
      for(let i=0;i<a.count;i++){const weight=(.9-base[i*3+1])/1.8,flutter=Math.sin(t*1.7+phase+base[i*3]*3.5+weight*2)*.10*weight;
        a.setXYZ(i,base[i*3]+flutter*breeze.x,base[i*3+1],base[i*3+2]+flutter*breeze.z);}
      a.needsUpdate=true;mesh.geometry.computeVertexNormals();
    }
  });
  return banners.length;
}
