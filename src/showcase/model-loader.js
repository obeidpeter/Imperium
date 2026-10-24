import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from '../../vendor/three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from '../../vendor/three/addons/libs/meshopt_decoder.module.js';

// The decoder compiles its WebAssembly as it loads, which the page's policy
// allows ('wasm-unsafe-eval'). A browser that refuses fails each compressed
// model instead, and its figures and props keep their code-built fallback.
MeshoptDecoder.ready.catch(()=>{});

// KTX2Loader starts its transcoder worker from a blob: URL, which the page's
// Content Security Policy refuses (worker-src 'self'). basis_worker.js is the
// same script on the page's own origin (scripts/assets/ktx2-worker.mjs).
const BASIS=new URL('../../vendor/three/addons/libs/basis/',import.meta.url);
export class SameOriginKTX2Loader extends KTX2Loader{
  init(){
    return this.transcoderPending??=new T.FileLoader(this.manager).setResponseType('arraybuffer').loadAsync(new URL('basis_transcoder.wasm',BASIS).href).then(binary=>{
      this.transcoderBinary=binary;
      this.workerPool.setWorkerCreator(()=>{
        const worker=new Worker(new URL('basis_worker.js',BASIS)),transcoderBinary=this.transcoderBinary.slice(0);
        worker.postMessage({type:'init',config:this.workerConfig,transcoderBinary},[transcoderBinary]);
        return worker;
      });
    });
  }
}
// The GPU's compressed formats, read from a throwaway WebGL 2 context: models
// load before a stage and its renderer exist. Without one, or where a format is
// missing, the transcoder writes uncompressed pixels, which every GPU takes.
// S3TC counts only with its sRGB variant, which colour maps need.
export function detectTextureSupport(loader,canvas=globalThis.document?.createElement('canvas')){
  const gl=canvas?.getContext?.('webgl2')??null,extension=name=>gl?.getExtension(name)??null;
  const has=name=>Boolean(extension(name))&&(name!=='WEBGL_compressed_texture_s3tc'||Boolean(extension('WEBGL_compressed_texture_s3tc_srgb')));
  loader.detectSupport({extensions:{has,get:extension}});
  extension('WEBGL_lose_context')?.loseContext();
  return loader;
}
// One transcoder for the page: each KTX2 loader would fetch its own and start its own workers.
let sharedKTX2=null;
const pageKTX2=()=>sharedKTX2??=detectTextureSupport(new SameOriginKTX2Loader().setWorkerLimit(2));
/** A KTX2 texture file (a 2D array becomes a CompressedArrayTexture), through the page's transcoder. */
export const loadKTX2Texture=url=>pageKTX2().loadAsync(url);

// The page's Content Security Policy allows blob: images but not blob:
// fetches, and three's ImageBitmapLoader fetches a GLB's embedded images as
// blob: URLs. createImageBitmap reads the GLB's own bytes instead: no request
// at all, and the browser decodes off the main thread, so uploading a texture
// is no longer also decoding it. Where createImageBitmap is missing or refuses
// an image, that image decodes through an image element as before. KTX2
// images (KHR_texture_basisu) are transcoded from the GLB's bytes in the
// worker; one that fails fails the model, which GLTFLoader would otherwise
// draw untextured.
export const BITMAP_OPTIONS=Object.freeze({premultiplyAlpha:'none',colorSpaceConversion:'none'});
export function createModelLoader({decode=globalThis.createImageBitmap,ktx2=pageKTX2}={}){
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(parser=>{
    parser.textureLoader=new T.TextureLoader(parser.options.manager);
    // The transcoder starts only for a model that has KTX2 images.
    if(parser.json.extensionsUsed?.includes('KHR_texture_basisu'))parser.options.ktx2Loader=ktx2();
    const viaElement=parser.loadImageSource.bind(parser);let failure=null;
    parser.loadImageSource=(sourceIndex,elementLoader)=>{
      const source=parser.json.images?.[sourceIndex];
      if(source?.bufferView===undefined||parser.sourceCache[sourceIndex]!==undefined)return viaElement(sourceIndex,elementLoader);
      const bytes=parser.getDependency('bufferView',source.bufferView);let promise;
      if(source.mimeType==='image/ktx2'){
        // The transcoder takes the bytes it is given; the parser keeps its own.
        promise=bytes.then(data=>new Promise((resolve,reject)=>elementLoader.parse(data.slice(0),resolve,reject)))
          .then(texture=>{texture.userData.mimeType=source.mimeType;texture.userData.decodedOffThread=true;return texture;});
        promise.catch(error=>{failure??=error;});
      }else if(typeof decode==='function'){
        promise=bytes.then(data=>decode(new Blob([data],{type:source.mimeType}),BITMAP_OPTIONS))
          .then(bitmap=>{const texture=new T.Texture(bitmap);texture.needsUpdate=true;texture.userData.mimeType=source.mimeType;texture.userData.decodedOffThread=true;return texture;},
            ()=>{delete parser.sourceCache[sourceIndex];return viaElement(sourceIndex,elementLoader);});
      }else return viaElement(sourceIndex,elementLoader);
      parser.sourceCache[sourceIndex]=promise;return promise;
    };
    return {name:'IMPERIUM_IMAGE_DECODING',afterRoot:()=>failure?Promise.reject(failure):null};
  });
  return loader;
}
