import * as T from '../../vendor/three/three.module.js';
const cached=new Map();
const paintedTiles=new Map();
let atlasPromise=null,atlasState='procedural';
export const ACTOR_MATERIAL_ATLAS=new URL('../../assets/showcase/character-materials-v015.webp',import.meta.url).href;
// Source quadrants have no padding: use the decoded image dimensions, including
// the shipped 1254px image, rather than assuming a power-of-two master.
export function actorAtlasRects(width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2)throw new RangeError('Invalid character atlas dimensions');
  const w=Math.floor(width/2),h=Math.floor(height/2);
  return {cloth:[0,0,w,h],leather:[w,0,width-w,h],mail:[0,h,w,height-h],skin:[w,h,width-w,height-h]};
}
export function normalizeActorAlbedo(source,kind){
  const data=new Uint8Array(source.length),mean=[0,0,0],count=source.length/4;
  for(let i=0;i<source.length;i+=4)for(let c=0;c<3;c++)mean[c]+=source[i+c]/count;
  const contrast=kind==='skin'?.52:kind==='mail'?1:.8;
  for(let i=0;i<source.length;i+=4){for(let c=0;c<3;c++)data[i+c]=Math.max(35,Math.min(255,220+(source[i+c]/Math.max(1,mean[c])-1)*220*contrast));data[i+3]=255;}
  return data;
}
function installTile(kind,entry){const tile=paintedTiles.get(kind);if(!tile)return;entry.surface.map.image={data:tile.data,width:tile.size,height:tile.size};entry.surface.map.needsUpdate=true;entry.surface.map.userData.source='character-materials-v015';}
/** Optional browser preload; synchronous actor construction always has a native
 * fallback. Live maps update in place, so rig/skin batches need no rebuilding. */
export function warmActorMaterials(){
  if(atlasPromise)return atlasPromise;
  if(typeof document==='undefined'||typeof Image==='undefined')return Promise.resolve(false);
  atlasState='loading';
  atlasPromise=new Promise(resolve=>{
    const image=new Image();image.onload=()=>{
      try{const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('No material decoder');
        for(const [kind,rect]of Object.entries(actorAtlasRects(image.naturalWidth,image.naturalHeight))){context.clearRect(0,0,size,size);context.drawImage(image,...rect,0,0,size,size);paintedTiles.set(kind,{size,data:normalizeActorAlbedo(context.getImageData(0,0,size,size).data,kind)});}
        for(const [kind,entry]of cached)installTile(kind,entry);atlasState='painted';resolve(true);
      }catch{atlasState='procedural';resolve(false);}
    };image.onerror=()=>{atlasState='procedural';resolve(false);};image.src=ACTOR_MATERIAL_ATLAS;
  });return atlasPromise;
}
export const actorMaterialStatus=()=>atlasState;
// Only immutable native texture tiles are shared. Each actor owns its meshes
// and tint materials; the last owner releases the GPU texture objects.
export function acquireActorSurface(kind){
  let entry=cached.get(kind);if(entry){entry.refs++;return entry.surface;}
  const size=96,colour=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const hash=((Math.imul(x+1,374761393)^Math.imul(y+9,668265263))>>>0)%997/997;
    let h=.5,c=.94,r=.88;
    const broad=Math.sin(x*Math.PI/48)*Math.sin(y*Math.PI/48),worn=Math.max(0,Math.sin(x*Math.PI/16+y*Math.PI/24)*Math.cos(y*Math.PI/48));
    if(kind==='cloth'){const warp=Math.cos(x*Math.PI/2),weft=Math.cos(y*Math.PI/2);h=.5+.12*warp+.11*weft+.065*broad+.035*(hash-.5);c=.85+.055*warp+.03*weft+.065*broad+.045*worn;r=.88+.08*hash;}
    else if(kind==='leather'){const grain=Math.sin(x*Math.PI/12+Math.cos(y*Math.PI/16))*Math.cos(y*Math.PI/12);h=.5+.12*grain+.12*(hash-.5);c=.77+.07*grain+.07*hash+.13*worn;r=.76+.16*hash-.14*worn;}
    else if(kind==='mail'){const row=Math.floor(y/12),xx=(x+(row%2)*6)%12-6,yy=y%12-6,d=Math.hypot(xx,yy*.83),ring=Math.max(0,1-Math.abs(d-3.65)/1.35);h=.16+.75*ring;c=.32+.58*ring;r=.38+.36*(1-ring);}
    else if(kind==='scale'){const row=Math.floor(y/16),xx=(x+(row%2)*6)%12-6,yy=y%16,edge=Math.max(0,1-Math.abs(yy-(13-Math.abs(xx)*.65))/1.5);h=.28+yy/30-edge*.2;c=.52+yy/50-edge*.25;r=.43+edge*.35;}
    else if(kind==='horse'){const hair=Math.cos(x*Math.PI/2+y*Math.PI/8);h=.5+.065*hair+.025*(hash-.5);c=.84+.045*hair+.03*hash+.09*broad;r=.57+.12*hash+.08*broad;}
    else if(kind==='skin'){h=.5+.035*(hash-.5);c=.93+.035*(hash-.5)+.017*broad;r=.77+.06*hash;}
    else {h=.48+.10*Math.sin(x*Math.PI/12+Math.sin(y*Math.PI/48))+.03*(hash-.5);c=.86+.055*Math.sin(x*Math.PI/12+Math.sin(y*Math.PI/48))+.065*worn;r=.76+.10*hash;}
    const i=(y*size+x)*4;colour.set([c*255,c*255,c*255,255],i);height.set([h*255,h*255,h*255,255],i);rough.set([r*255,r*255,r*255,255],i);
  }
  const texture=(data,color=false)=>{const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.repeat.set(kind==='mail'||kind==='scale'?3:kind==='cloth'?5:2,kind==='mail'||kind==='scale'?3:kind==='cloth'?4:2);if(color)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;};
  const surface={map:texture(colour,true),bumpMap:texture(height),roughnessMap:texture(rough),bumpScale:kind==='mail'?.014:kind==='scale'?.011:kind==='cloth'?.004:kind==='skin'?.0007:.005};
  const next={refs:1,surface};cached.set(kind,next);installTile(kind,next);if(!atlasPromise)void warmActorMaterials();return surface;
}
export function releaseActorSurface(kind){const entry=cached.get(kind);if(!entry||--entry.refs)return;for(const key of ['map','bumpMap','roughnessMap'])entry.surface[key].dispose();cached.delete(kind);}
