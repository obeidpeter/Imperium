import * as T from '../../vendor/three/three.module.js';
import {ACTOR_SURFACE_SPEC,actorSurfaceKind,createActorSurfaceData,composeActorAlbedo} from './actor-surface.js';
const cached=new Map();
const paintedTiles=new Map();
let atlasPromise=null,atlasState='procedural';
export const ACTOR_MATERIAL_ATLAS=new URL('../../assets/showcase/character-materials-v016.webp',import.meta.url).href;
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
function installTile(kind,entry){const tile=paintedTiles.get(kind);if(!tile)return;entry.surface.map.image={data:tile.data,width:tile.size,height:tile.size};entry.surface.map.needsUpdate=true;entry.surface.map.userData.source='character-materials-v016';entry.surface.map.userData.detail='original periodic relief with restrained painted wear';}
/** Optional browser preload; synchronous actor construction always has a native
 * fallback. Live maps update in place, so rig/skin batches need no rebuilding. */
export function warmActorMaterials(){
  if(atlasPromise)return atlasPromise;
  if(typeof document==='undefined'||typeof Image==='undefined')return Promise.resolve(false);
  atlasState='loading';
  atlasPromise=new Promise(resolve=>{
    const image=new Image();image.onload=()=>{
      try{const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('No material decoder');
        for(const [kind,rect]of Object.entries(actorAtlasRects(image.naturalWidth,image.naturalHeight))){context.clearRect(0,0,size,size);context.drawImage(image,...rect,0,0,size,size);paintedTiles.set(kind,{size,data:composeActorAlbedo(normalizeActorAlbedo(context.getImageData(0,0,size,size).data,kind),kind,size)});}
        for(const [kind,entry]of cached)installTile(kind,entry);atlasState='painted';resolve(true);
      }catch{atlasState='procedural';resolve(false);}
    };image.onerror=()=>{atlasState='procedural';resolve(false);};image.src=ACTOR_MATERIAL_ATLAS;
  });return atlasPromise;
}
export const actorMaterialStatus=()=>atlasState;
// Only immutable native texture tiles are shared. Each actor owns its meshes
// and tint materials; the last owner releases the GPU texture objects.
export function acquireActorSurface(kind){
  kind=actorSurfaceKind(kind);
  let entry=cached.get(kind);if(entry){entry.refs++;return entry.surface;}
  const data=createActorSurfaceData(kind),spec=ACTOR_SURFACE_SPEC[kind];
  const texture=(pixels,size,color=false)=>{const t=new T.DataTexture(pixels,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.repeat.set(...spec.repeat);t.anisotropy=4;t.userData.actorSurface=kind;if(color)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;};
  // Three uses a tangent normal map in preference to bump. Retain the small
  // height map for older callers and cache keys; do not double-apply relief.
  const surface={map:texture(data.color,data.size,true),bumpMap:texture(data.height,data.size),roughnessMap:texture(data.roughness,data.size),normalMap:texture(data.normal,data.normalSize),normalScale:new T.Vector2(spec.normalScale,spec.normalScale),roughness:spec.roughness,metalness:spec.metalness,bumpScale:kind==='skin'?.0007:.005};
  const next={refs:1,surface};cached.set(kind,next);installTile(kind,next);if(!atlasPromise)void warmActorMaterials();return surface;
}
export function releaseActorSurface(kind){kind=actorSurfaceKind(kind);const entry=cached.get(kind);if(!entry||--entry.refs)return;for(const key of ['map','bumpMap','roughnessMap','normalMap'])entry.surface[key].dispose();cached.delete(kind);}
