import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';

// The page's Content Security Policy allows blob: images but not blob:
// fetches, and three's ImageBitmapLoader fetches a GLB's embedded images as
// blob: URLs. createImageBitmap reads the GLB's own bytes instead: no request
// at all, and the browser decodes off the main thread, so uploading a texture
// is no longer also decoding it. Where createImageBitmap is missing or refuses
// an image, that image decodes through an image element as before.
export const BITMAP_OPTIONS=Object.freeze({premultiplyAlpha:'none',colorSpaceConversion:'none'});
export function createModelLoader({decode=globalThis.createImageBitmap}={}){
  const loader=new GLTFLoader();
  loader.register(parser=>{
    parser.textureLoader=new T.TextureLoader(parser.options.manager);
    const viaElement=parser.loadImageSource.bind(parser);
    if(typeof decode==='function')parser.loadImageSource=(sourceIndex,elementLoader)=>{
      const source=parser.json.images?.[sourceIndex];
      if(source?.bufferView===undefined||parser.sourceCache[sourceIndex]!==undefined)return viaElement(sourceIndex,elementLoader);
      const promise=parser.getDependency('bufferView',source.bufferView)
        .then(bytes=>decode(new Blob([bytes],{type:source.mimeType}),BITMAP_OPTIONS))
        .then(bitmap=>{const texture=new T.Texture(bitmap);texture.needsUpdate=true;texture.userData.mimeType=source.mimeType;texture.userData.decodedOffThread=true;return texture;},
          ()=>{delete parser.sourceCache[sourceIndex];return viaElement(sourceIndex,elementLoader);});
      parser.sourceCache[sourceIndex]=promise;return promise;
    };
    return {name:'IMPERIUM_IMAGE_DECODING'};
  });
  return loader;
}
