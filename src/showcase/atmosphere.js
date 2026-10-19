import * as T from '../../vendor/three/three.module.js';

// Weather on the light. Faint cloud shadows drift over the board on clear and
// misty days, the same for ground, scenery and figures (one set of uniforms
// every lit surface reads); and at dawn, in mist and in the Senate's halls,
// a few shafts of sunlight slant through the air with dust turning in them.
// Presentation only and deterministic; reduced motion holds both still.
export const CLOUD_UNIFORMS=Object.freeze({cloudTime:{value:0},cloudStrength:{value:0},cloudShape:{value:new T.Vector3(1/22,.03,.02)}});
// How strongly clouds dim the sun here (0 indoors, at night and under rain).
export function cloudStrength(profile={}){
  if(profile.civic||['night','interior'].includes(profile.timeOfDay)||['rain','embers'].includes(profile.weather))return 0;
  const base=profile.weather==='mist'?.12:profile.weather==='dust'?.16:.22;
  return profile.timeOfDay==='dawn'||profile.timeOfDay==='dusk'?base*.7:base;
}
// Wind drift for this chapter, in noise units per second (about 1.1 m/s).
export function cloudWind(chapter=1){const a=((chapter*2654435761)>>>0)%360*Math.PI/180;return [Math.cos(a)*1.1/22,Math.sin(a)*1.1/22];}
const CLOUD_HEAD=`uniform float cloudTime;uniform float cloudStrength;uniform vec3 cloudShape;
float cloudHash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*45758.5453);}
float cloudNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(cloudHash(i),cloudHash(i+vec2(1.0,0.0)),f.x),mix(cloudHash(i+vec2(0.0,1.0)),cloudHash(i+vec2(1.0,1.0)),f.x),f.y);}
`;
// Clouds dim only the direct light; the world point comes from the view
// position, so any lit material can take it without a new varying.
const CLOUD_BODY=`
  if(cloudStrength>0.0){
    vec3 cloudWorld=transpose(mat3(viewMatrix))*(-vViewPosition)+cameraPosition;
    vec2 cloudPoint=cloudWorld.xz*cloudShape.x+cloudShape.yz*cloudTime;
    float cloudField=cloudNoise(cloudPoint)*.62+cloudNoise(cloudPoint*2.07+vec2(7.1,3.3))*.28+cloudNoise(cloudPoint*4.3+vec2(1.7,9.2))*.10;
    float cloudShade=1.0-smoothstep(.5,.72,cloudField)*cloudStrength;
    reflectedLight.directDiffuse*=cloudShade;reflectedLight.directSpecular*=cloudShade;
  }
`;
export function installCloudShadows(material,uniforms=CLOUD_UNIFORMS){
  if(!material||material.userData.cloudShadows||!(material.isMeshStandardMaterial||material.isMeshLambertMaterial||material.isMeshPhongMaterial))return false;
  const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,...args)=>{
    previous.call(material,shader,...args);Object.assign(shader.uniforms,uniforms);
    shader.fragmentShader=CLOUD_HEAD+shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>'+CLOUD_BODY);
  };
  material.customProgramCacheKey=()=>`${oldKey}:cloud-shadow-v1`;material.userData.cloudShadows=true;return true;
}
// The CPU twin of the shader's field, for tests and placement checks.
export function sampleCloudShade(x,z,time,{strength=.22,shape=[1/22,.03,.02]}={}){
  const hash=(px,py)=>{const s=Math.sin(px*41.3+py*289.1)*45758.5453;return s-Math.floor(s);};
  const noise=(px,py)=>{const ix=Math.floor(px),iy=Math.floor(py);let fx=px-ix,fy=py-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;};
  const px=x*shape[0]+shape[1]*time,py=z*shape[0]+shape[2]*time,field=noise(px,py)*.62+noise(px*2.07+7.1,py*2.07+3.3)*.28+noise(px*4.3+1.7,py*4.3+9.2)*.1;
  const t=Math.max(0,Math.min(1,(field-.5)/.22));return 1-t*t*(3-2*t)*strength;
}

// Light shafts: open cylinders along the sun, bright where they face the
// camera and fading at their ends and near the eye, with motes drifting in.
export const SHAFT_COUNT=Object.freeze({performance:2,balanced:4,high:5});
export function shaftsWanted(profile={}){return profile.timeOfDay==='dawn'||profile.weather==='mist'||profile.timeOfDay==='interior'||!!profile.civic;}
const shaftVertex=`varying float vAlong;varying vec3 vShaftNormal;varying vec3 vShaftView;varying float vEyeDistance;
void main(){vAlong=uv.y;vec4 world=modelMatrix*vec4(position,1.0);vShaftNormal=normalize(mat3(modelMatrix)*normal);vShaftView=normalize(cameraPosition-world.xyz);vEyeDistance=distance(cameraPosition,world.xyz);gl_Position=projectionMatrix*viewMatrix*world;}`;
const shaftFragment=`uniform vec3 shaftColor;uniform float shaftStrength;uniform float shaftTime;varying float vAlong;varying vec3 vShaftNormal;varying vec3 vShaftView;varying float vEyeDistance;
void main(){float facing=abs(dot(vShaftNormal,vShaftView));float body=facing*facing;float ends=smoothstep(0.0,.28,vAlong)*(1.0-smoothstep(.62,1.0,vAlong));
float shimmer=.82+.18*sin(vAlong*13.0+shaftTime*.7);float near=smoothstep(4.0,14.0,vEyeDistance);
gl_FragColor=vec4(shaftColor*body*ends*shimmer*near*shaftStrength,1.0);}`;
export function createLightShafts(scene,profile={},{quality='balanced',bounds={minX:-10,maxX:10,minZ:-10,maxZ:10},sunDirection=new T.Vector3(-.5,.75,-.4),seed=1}={}){
  if(!shaftsWanted(profile))return null;
  const group=new T.Group();group.name='light shafts';group.userData.cameraOcclusion=false;group.userData.bakedOcclusion=false;scene.add(group);
  const interior=profile.timeOfDay==='interior'||!!profile.civic,count=SHAFT_COUNT[quality]??SHAFT_COUNT.balanced,owned=[];
  const uniforms={shaftColor:{value:new T.Color(profile.sun??'#ffe2b0').lerp(new T.Color('#ffffff'),.2)},shaftStrength:{value:interior?.1:profile.weather==='mist'?.075:.06},shaftTime:{value:0}};
  const material=new T.ShaderMaterial({name:'sun shafts',uniforms,vertexShader:shaftVertex,fragmentShader:shaftFragment,transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false});owned.push(material);
  const sun=sunDirection.clone().normalize(),hash=(...v)=>{let h=2166136261;for(const c of v.join(':'))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295;};
  const cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2,rx=(bounds.maxX-bounds.minX)/2,rz=(bounds.maxZ-bounds.minZ)/2,shafts=[];
  for(let i=0;i<count;i++){
    // Outdoors the shafts fall on the board's margins; indoors along the hall's sunward side.
    const a=(i+hash(seed,i,'a')*.6)/count*Math.PI*2,edge=interior?.55+hash(seed,i,'e')*.25:.85+hash(seed,i,'e')*.35;
    const footX=interior?cx-sun.x/Math.hypot(sun.x,sun.z)*rx*.35+Math.cos(a)*rx*.4:cx+Math.cos(a)*rx*edge,footZ=interior?cz-sun.z/Math.hypot(sun.x,sun.z)*rz*.35+Math.sin(a)*rz*.4:cz+Math.sin(a)*rz*edge;
    const length=interior?14+hash(seed,i,'l')*5:20+hash(seed,i,'l')*8,radius=(interior?.55:.9)+hash(seed,i,'w')*(interior?.35:.8);
    const geometry=new T.CylinderGeometry(radius*1.25,radius,length,14,1,true);geometry.translate(0,length/2,0);owned.push(geometry);
    const mesh=new T.Mesh(geometry,material);mesh.name='sun shaft';mesh.raycast=()=>{};mesh.renderOrder=4;mesh.frustumCulled=false;
    mesh.position.set(footX,0,footZ);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),sun);group.add(mesh);shafts.push({mesh,radius,length});
  }
  // Motes: dust turning slowly inside the shafts.
  const motes=quality==='performance'?0:quality==='high'?120:70,positions=new Float32Array(motes*3),base=[];
  for(let i=0;i<motes;i++){const s=shafts[i%shafts.length],t=.15+hash(seed,i,'t')*.55,r=s.radius*hash(seed,i,'r')*.8,a=hash(seed,i,'o')*Math.PI*2;base.push({s,t,r,a,speed:.15+hash(seed,i,'v')*.25});}
  let points=null;
  if(motes){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));owned.push(geometry);
    const pm=new T.PointsMaterial({name:'shaft motes',color:new T.Color(profile.sun??'#ffe2b0'),size:.06,sizeAttenuation:true,transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending,fog:false});owned.push(pm);
    points=new T.Points(geometry,pm);points.name='shaft motes';points.frustumCulled=false;points.raycast=()=>{};group.add(points);}
  const v=new T.Vector3();let disposed=false;
  function place(time){
    base.forEach((m,i)=>{const a=m.a+time*m.speed,lift=(m.t+Math.sin(time*.13+i)*.03)*m.s.length;v.set(Math.cos(a)*m.r,lift,Math.sin(a)*m.r).applyQuaternion(m.s.mesh.quaternion).add(m.s.mesh.position);positions.set([v.x,v.y,v.z],i*3);});
    if(points)points.geometry.attributes.position.needsUpdate=true;
  }
  place(0);
  return {group,uniforms,count:shafts.length,motes,
    update(time=0,{reducedMotion=false}={}){if(disposed)return;const t=reducedMotion?0:time;uniforms.shaftTime.value=t;if(!reducedMotion)place(t);},
    stats(){return {shafts:shafts.length,motes,interior,strength:uniforms.shaftStrength.value,disposed};},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const o of owned)o.dispose();}
  };
}
