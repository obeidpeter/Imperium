import * as T from '../../vendor/three/three.module.js';

export function createParticleMask(){
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const d=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),alpha=Math.max(0,1-d*d)**2;
    data.set([255,255,255,Math.round(alpha*255)],(y*size+x)*4);
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
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
  rain:{color:'#b8cddb',size:.075,opacity:.42,vx:-.65,vy:-3.8,vz:.35,spanY:7.5},
  embers:{color:'#ffb15e',size:.095,opacity:.68,vx:.45,vy:1.15,vz:-.3,spanY:6.2},
  dust:{color:'#d4be96',size:.13,opacity:.34,vx:1.25,vy:.12,vz:.48,spanY:4.8},
  mist:{color:'#cfdcd8',size:.18,opacity:.26,vx:.32,vy:.05,vz:.18,spanY:3.6},
};
export function createWeatherField(mask){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(64*3),3));
  const m=new T.PointsMaterial({color:0xb8cddb,map:mask,alphaTest:.04,size:.08,transparent:true,opacity:0,depthWrite:false});
  const cloud=new T.Points(g,m);cloud.name='weather-particles';cloud.visible=false;cloud.renderOrder=4;return cloud;
}
export function sampleWeatherParticles(cloud,weather='clear',time=0,{reducedMotion=false}={}){
  const spec=WEATHER_SPECS[weather];
  if(!spec){cloud.visible=false;cloud.material.opacity=0;return;}
  cloud.visible=true;cloud.userData.weather=weather;
  cloud.material.color.set(spec.color);cloud.material.size=spec.size;cloud.material.opacity=reducedMotion?spec.opacity*.55:spec.opacity;
  const t=reducedMotion?0:(Number.isFinite(time)?time:0),v=cloud.geometry.attributes.position,wrap=(n,span)=>((n%span)+span)%span;
  for(let i=0;i<v.count;i++){
    const sx=((i*37)%64)/64*18-9,sz=((i*53)%64)/64*18-9,sy=((i*19)%64)/64*spec.spanY+.35;
    const x=wrap(sx+t*spec.vx+Math.sin(i+t*.7)*.28+9,18)-9;
    const y=wrap(sy+t*spec.vy,spec.spanY)+.25;
    const z=wrap(sz+t*spec.vz+Math.cos(i*1.3+t*.6)*.28+9,18)-9;
    v.setXYZ(i,x,y,z);
  }
  v.needsUpdate=true;
}

export function createFlamePlume(mask=null){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(24*3),3));
  const m=new T.PointsMaterial({color:0xffa648,map:mask,alphaTest:.03,size:.14,transparent:true,opacity:.72,depthWrite:false,blending:T.AdditiveBlending});
  const cloud=new T.Points(g,m);cloud.name='brazier-flame-plume';cloud.visible=true;cloud.renderOrder=5;
  sampleFlamePlume(cloud,0,{reducedMotion:false});
  return cloud;
}

export function sampleFlamePlume(cloud,time=0,{reducedMotion=false}={}){
  if(!cloud?.geometry?.attributes?.position)return;
  const t=reducedMotion?0:(Number.isFinite(time)?time:0),v=cloud.geometry.attributes.position;
  for(let i=0;i<v.count;i++){
    const phase=((i/v.count+t*(1.25+(i%5)*.18))%1+1)%1;
    const radius=(1-phase*.55)*(.04+(i%4)*.032);
    const angle=i*2.399963+t*3.1+phase*2.4;
    v.setXYZ(i,Math.cos(angle)*radius,phase*.78,Math.sin(angle)*radius);
  }
  v.needsUpdate=true;
  if(cloud.material)cloud.material.opacity=reducedMotion?.58:.68+.12*Math.sin(t*9.5);
}
