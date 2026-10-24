import * as T from '../../vendor/three/three.module.js';
import {GROUND_FILES,GROUND_LAYERS} from '../ui/ground-layers.js';
import {loadKTX2Texture} from './model-loader.js';

// The ground's two texture arrays (ground-layers.js), downloaded once and held
// for the session like the figures' surfaces: every stage samples the same
// GPU copy, and no stage disposes them. Until they arrive, or if they cannot,
// each layer is its mean colour, flat and level: the code-built stand-in,
// drawn by the same shader program, so nothing recompiles when they arrive.
let standIn=null,loaded=null,pending=null;
const configure=(texture,colour)=>{
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;
  // Four samples at grazing angles: eight doubled the ground's cost for little a player sees.
  texture.colorSpace=colour?T.SRGBColorSpace:T.NoColorSpace;texture.anisotropy=4;texture.needsUpdate=true;return texture;
};
function standInTextures(){
  const size=4,layers=GROUND_LAYERS.length,albedo=new Uint8Array(size*size*4*layers),normal=new Uint8Array(size*size*4*layers).fill(128);
  // The fallback colours are sRGB bytes, like the photographs.
  GROUND_LAYERS.forEach((layer,k)=>{const rgb=layer.fallback.match(/[0-9a-f]{2}/gi).map(h=>parseInt(h,16));
    for(let i=0;i<size*size;i++)albedo.set([...rgb,128],(k*size*size+i)*4);});
  const make=(data,colour)=>{const t=new T.DataArrayTexture(data,size,size,layers);t.minFilter=T.LinearFilter;t.generateMipmaps=false;t.name=`Imperium ground stand-in (${colour?'colour':'normal'})`;return configure(t,colour);};
  return {albedo:make(albedo,true),normal:make(normal,false),source:'stand-in'};
}

/** The arrays to sample now: the photographed layers once loaded, else the stand-in. */
export function groundTextures(){return loaded??(standIn??=standInTextures());}
/** Whether the photographed layers are loaded. */
export const groundTexturesLoaded=()=>Boolean(loaded);
/**
 * Fetches and transcodes both arrays once; resolves true when they are ready,
 * false if either failed (the stand-in stays, and the next call tries again).
 * Never rejects. `load` is for tests.
 */
export function warmGroundTextures({load=loadKTX2Texture}={}){
  if(loaded)return Promise.resolve(true);
  return pending??=Promise.all([load(GROUND_FILES.albedo),load(GROUND_FILES.normal)]).then(([albedo,normal])=>{
    if(!albedo?.isTexture||!normal?.isTexture||albedo.image?.depth!==GROUND_LAYERS.length||normal.image?.depth!==GROUND_LAYERS.length){albedo?.dispose?.();normal?.dispose?.();throw new Error('The ground arrays do not hold every layer.');}
    albedo.name='Imperium ground layers (colour, height)';normal.name='Imperium ground layers (normal)';
    loaded={albedo:configure(albedo,true),normal:configure(normal,false),source:'ktx2'};return true;
  }).catch(()=>{pending=null;return false;});
}
