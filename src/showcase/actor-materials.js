import * as T from '../../vendor/three/three.module.js';
const cached=new Map();
// Only immutable native texture tiles are shared. Each actor owns its meshes
// and tint materials; the last owner releases the GPU texture objects.
export function acquireActorSurface(kind){
  let entry=cached.get(kind);if(entry){entry.refs++;return entry.surface;}
  const size=96,colour=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const hash=((Math.imul(x+1,374761393)^Math.imul(y+9,668265263))>>>0)%997/997;
    let h=.5,c=.94,r=.88;
    if(kind==='cloth'){const warp=Math.cos(x*Math.PI/2),weft=Math.cos(y*Math.PI/2);h=.5+.15*warp+.13*weft+.035*(hash-.5);c=.89+.055*warp+.03*weft;r=.86+.10*hash;}
    else if(kind==='leather'){const grain=Math.sin(x*Math.PI/12+Math.cos(y*Math.PI/16))*Math.cos(y*Math.PI/12);h=.5+.12*grain+.12*(hash-.5);c=.84+.07*grain+.05*hash;r=.72+.16*hash;}
    else if(kind==='mail'){const row=Math.floor(y/12),xx=(x+(row%2)*6)%12-6,yy=y%12-6,d=Math.hypot(xx,yy*.83),ring=Math.max(0,1-Math.abs(d-3.65)/1.35);h=.16+.75*ring;c=.32+.58*ring;r=.38+.36*(1-ring);}
    else if(kind==='scale'){const row=Math.floor(y/16),xx=(x+(row%2)*6)%12-6,yy=y%16,edge=Math.max(0,1-Math.abs(yy-(13-Math.abs(xx)*.65))/1.5);h=.28+yy/30-edge*.2;c=.52+yy/50-edge*.25;r=.43+edge*.35;}
    else if(kind==='horse'){const hair=Math.cos(x*Math.PI/2+y*Math.PI/8);h=.5+.09*hair+.03*(hash-.5);c=.9+.05*hair+.035*hash;r=.72+.12*hash;}
    else {h=.48+.10*Math.sin(x*Math.PI/12+Math.sin(y*Math.PI/48))+.03*(hash-.5);c=.90+.045*Math.sin(x*Math.PI/12+Math.sin(y*Math.PI/48));r=.76+.10*hash;}
    const i=(y*size+x)*4;colour.set([c*255,c*255,c*255,255],i);height.set([h*255,h*255,h*255,255],i);rough.set([r*255,r*255,r*255,255],i);
  }
  const texture=(data,color=false)=>{const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.repeat.set(kind==='mail'||kind==='scale'?3:kind==='cloth'?5:2,kind==='mail'||kind==='scale'?3:kind==='cloth'?4:2);if(color)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;};
  const surface={map:texture(colour,true),bumpMap:texture(height),roughnessMap:texture(rough),bumpScale:kind==='mail'?.014:kind==='scale'?.011:kind==='cloth'?.004:.005};
  cached.set(kind,{refs:1,surface});return surface;
}
export function releaseActorSurface(kind){const entry=cached.get(kind);if(!entry||--entry.refs)return;for(const key of ['map','bumpMap','roughnessMap'])entry.surface[key].dispose();cached.delete(kind);}
