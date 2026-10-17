import {clamp,smooth,noise} from './environment-layout.js';

// Shared surface description keeps the transparent tread and opaque soil
// verge continuous. It never changes terrain elevation or legal movement.
export function createRoadSurfaceSampler(segments,tileSize=2.5){
  const distance=(x,z)=>segments.reduce((nearest,[a,b])=>{const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?clamp(((x-a.x)*dx+(z-a.z)*dz)/length):0;return Math.min(nearest,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));},Infinity);
  const sample=(x,z)=>{
    const d=distance(x,z),variation=(noise(x*.76,z*.76,17)-.5)*tileSize*.12;
    const verge=1-smooth((d+variation-tileSize*.17)/(tileSize*.81));
    const opacity=(1-smooth((d+variation-tileSize*.16)/(tileSize*.48)))*.78;
    const rut=Math.exp(-Math.pow((d-tileSize*.18)/.14,2));
    return {distance:d,verge,opacity,tone:1-rut*.07};
  };
  return {distance,sample};
}
