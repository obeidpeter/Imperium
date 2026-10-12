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
