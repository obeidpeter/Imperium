// Original technical maps, not a scan or a normal map inferred from painted
// shadows. Pores are a small periodic tangent-space field; pigment controls
// only surface roughness. The original face colour and UV islands stay intact.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function skinMicroNormal(size=128){
  if(!Number.isInteger(size)||size<8||size>256)throw new RangeError('Invalid pore-map size');
  const height=new Float32Array(size*size),data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
    height[y*size+x]=Math.sin(u*19+Math.sin(v*7))*.46+Math.cos(v*23+Math.sin(u*5))*.35+Math.sin(u*37+v*31)*.19;
  }
  const h=(x,y)=>height[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(h(x-1,y)-h(x+1,y))*.17,dy=(h(x,y-1)-h(x,y+1))*.17,d=Math.hypot(dx,dy,1),i=(y*size+x)*4;
    data.set([Math.round((dx/d*.5+.5)*255),Math.round((dy/d*.5+.5)*255),Math.round((1/d*.5+.5)*255),255],i);
  }
  return {data,width:size,height:size};
}
export function skinRoughness(pixels){
  if(!pixels?.length||pixels.length%4)throw new RangeError('Expected RGBA skin pixels');
  const data=new Uint8Array(pixels.length);
  for(let i=0;i<pixels.length;i+=4){
    const red=pixels[i],green=pixels[i+1],blue=pixels[i+2];
    // Redder lip/nose detail catches a narrower highlight; stubble stays matte.
    const redness=clamp((red-green*1.30)/55,0,1),dark=clamp((150-(red+green+blue)/3)/150,0,1);
    const value=Math.round(255*clamp(.72-redness*.18+dark*.12,.48,.87));
    data.set([value,value,value,255],i);
  }
  return data;
}
