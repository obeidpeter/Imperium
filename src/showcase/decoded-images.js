import * as T from '../../vendor/three/three.module.js';

// Images decoded once per session and shared by every stage that samples them.
// createImageBitmap over a same-origin fetch (which the page's security policy
// allows) decodes off the main thread, so a texture's upload is not also its
// decode; where it is missing or fails, an image element decodes instead.
// The battle preloader asks for a stage's images before the stage is built,
// so its materials are complete from the start and never change program in play.
const images=new Map();
const viaBitmap=async url=>{
  const response=await fetch(url);if(!response.ok)throw Error(`${response.status} ${url}`);
  // Flipped while decoding: WebGL ignores the upload flip flag for bitmaps.
  return createImageBitmap(await response.blob(),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'default'});
};
const viaElement=url=>new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>resolve(image);image.onerror=()=>reject(Error(`Image ${url} failed`));image.src=url;})
  .then(image=>Promise.resolve(image.decode?.()).catch(()=>{}).then(()=>image));
export function decodeImage(url){
  let entry=images.get(url);
  if(!entry){
    entry={image:null};const bitmap=typeof createImageBitmap==='function'&&typeof fetch==='function';
    entry.promise=(bitmap?viaBitmap(url).catch(()=>viaElement(url)):viaElement(url)).then(image=>(entry.image=image),error=>{images.delete(url);throw error;});
    images.set(url,entry);
  }
  return entry.promise;
}
// The image now, if it has finished decoding.
export const decodedImage=url=>images.get(url)?.image??null;
// A texture with TextureLoader's orientation; a stage owns (and disposes) it,
// while the decoded image stays for the next stage.
export function imageTexture(image){
  const texture=new T.Texture(image);texture.flipY=!(typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap);texture.needsUpdate=true;return texture;
}
export const IMAGE_DECODER=Object.freeze({decode:decodeImage,decoded:decodedImage,texture:imageTexture});
