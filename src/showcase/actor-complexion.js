import * as T from '../../vendor/three/three.module.js';
import {skinMicroNormal,skinRoughness} from './skin-response.js';
import {nextSlice} from './build-steps.js';

export const ACTOR_COMPLEXION_ASSETS=Object.freeze({male:'assets/textures/complexion-male-v018.webp',female:'assets/textures/complexion-female-v018.webp'});
const reference=Object.freeze({male:Object.freeze([234.176,187.514,156.912]),female:Object.freeze([216.698,178.544,150.852])});
const kindOf=kind=>kind==='female'||kind?.female===true?'female':'male';
// Remove the source's average pink/tan undertone, not its spatial detail. The
// actor's own skin tint still supplies identity; freckles, lips and stubble stay.
// Files retain their original colours and complete, unmodified UV layout.
export function normalizeActorComplexion(source,kind='male'){
  if(!source||source.length%4)throw new RangeError('Expected RGBA complexion pixels');
  const data=new Uint8Array(source.length),base=reference[kindOf(kind)];
  for(let i=0;i<source.length;i+=4){for(let c=0;c<3;c++)data[i+c]=Math.max(18,Math.min(255,Math.round(228*(1+1.1*(source[i+c]/base[c]-1)))));data[i+3]=255;}
  return data;
}
async function decodeBrowserTexture(url){
  if(typeof document==='undefined'||typeof Image==='undefined')return null;
  return new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>{try{
      const width=image.naturalWidth,height=image.naturalHeight;
      if(width<1||height<1||width>1024||height>1024)throw Error('Invalid complexion dimensions');
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('No complexion decoder');
      context.drawImage(image,0,0);resolve({width,height,data:context.getImageData(0,0,width,height).data});
    }catch(error){reject(error);}};
    image.onerror=()=>reject(Error('Complexion texture unavailable'));image.src=url;
  });
}
/** At most two shared UV textures. Materials retain their map identity during
 * decode. A warm-only texture is retained for the next owner; the last acquired
 * owner releases it. Failed requests retry only after all owners release. */
export function createActorComplexionLibrary(load=decodeBrowserTexture){
  const records=new Map(),requests=new Map();let disposed=false;
  function record(kind){
    if(disposed)throw Error('Complexion library disposed');
    let entry=records.get(kind);if(entry)return entry;
    const map=new T.DataTexture(new Uint8Array([228,228,228,255]),1,1,T.RGBAFormat);
    // The project GLBs preserve the source OBJ's UV coordinates verbatim.
    // Their V axis therefore needs the image flip despite the GLB container.
    map.colorSpace=T.SRGBColorSpace;map.flipY=true;map.wrapS=map.wrapT=T.ClampToEdgeWrapping;
    map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;
    map.userData={actorComplexion:kind,source:ACTOR_COMPLEXION_ASSETS[kind],state:'placeholder'};map.needsUpdate=true;
    const pore=skinMicroNormal(),normalMap=new T.DataTexture(pore.data,pore.width,pore.height,T.RGBAFormat),roughnessMap=new T.DataTexture(new Uint8Array([184,184,184,255]),1,1,T.RGBAFormat);
    normalMap.wrapS=normalMap.wrapT=T.RepeatWrapping;normalMap.repeat.set(9,9);normalMap.flipY=true;
    normalMap.magFilter=T.LinearFilter;normalMap.minFilter=T.LinearMipmapLinearFilter;normalMap.generateMipmaps=true;normalMap.anisotropy=4;
    normalMap.userData={actorSurface:'skin',source:'original-periodic-pores-v035'};normalMap.needsUpdate=true;
    roughnessMap.image={width:1,height:1,data:new Uint8Array([184,184,184,255])};roughnessMap.colorSpace=T.NoColorSpace;roughnessMap.userData={actorSurface:'skin'};roughnessMap.needsUpdate=true;
    roughnessMap.flipY=true;roughnessMap.wrapS=roughnessMap.wrapT=T.ClampToEdgeWrapping;roughnessMap.magFilter=T.LinearFilter;roughnessMap.minFilter=T.LinearMipmapLinearFilter;roughnessMap.generateMipmaps=true;roughnessMap.anisotropy=4;
    entry={refs:0,ready:false,error:null,surface:{map,normalMap,normalScale:new T.Vector2(.23,.23),bumpMap:null,roughnessMap,bumpScale:0,roughness:1,metalness:0}};
    records.set(kind,entry);return entry;
  }
  function warm(value='male'){
    if(disposed)return Promise.resolve(false);
    const kind=kindOf(value),entry=record(kind);if(entry.ready)return Promise.resolve(true);if(entry.error)return Promise.resolve(false);
    if(requests.has(kind))return requests.get(kind);
    const request=Promise.resolve().then(()=>load(new URL(`../../${ACTOR_COMPLEXION_ASSETS[kind]}`,import.meta.url).href,kind)).then(async image=>{
      if(!image)return false; // Node construction never attempts browser work.
      const {width,height,data}=image;
      if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1024||height>1024||data?.length!==width*height*4)throw Error('Invalid complexion pixels');
      // The colour and the roughness are each a pass over every pixel: one task each.
      const colour=normalizeActorComplexion(data,kind);await nextSlice();
      const current=records.get(kind);if(disposed||!current)return false;
      current.surface.map.image={width,height,data:colour};
      current.surface.roughnessMap.image={width,height,data:skinRoughness(data)};current.surface.roughnessMap.needsUpdate=true;
      current.surface.map.userData.state='ready';current.surface.map.needsUpdate=true;current.ready=true;return true;
    }).catch(error=>{const current=records.get(kind);if(current&&!disposed){current.error=String(error?.message??error);current.surface.map.userData.state='fallback';}return false;}).finally(()=>{if(requests.get(kind)===request)requests.delete(kind);});
    requests.set(kind,request);return request;
  }
  return {
    acquire(value='male'){const kind=kindOf(value),entry=record(kind);entry.refs++;void warm(kind);return entry.surface;},
    release(value='male'){const kind=kindOf(value),entry=records.get(kind);if(!entry)return;if(entry.refs>0)entry.refs--;if(entry.refs===0){for(const key of ['map','normalMap','roughnessMap'])entry.surface[key].dispose();records.delete(kind);}},
    warm,
    status(value='male'){const kind=kindOf(value),entry=records.get(kind);return {ready:entry?.ready??false,pending:requests.has(kind),error:entry?.error??null,refs:entry?.refs??0};},
    dispose(){if(disposed)return;disposed=true;for(const entry of records.values())for(const key of ['map','normalMap','roughnessMap'])entry.surface[key].dispose();records.clear();requests.clear();}
  };
}
const library=createActorComplexionLibrary();
export const acquireActorComplexion=kind=>library.acquire(kind);
export const releaseActorComplexion=kind=>library.release(kind);
export const warmActorComplexion=kind=>library.warm(kind);
export const actorComplexionStatus=kind=>library.status(kind);
