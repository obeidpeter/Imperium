import {getByteLength} from '../../vendor/three/three.core.js';

// A scene resource estimate, not the browser's measured VRAM allocation. Keep
// this version with benchmark reports: v1 omitted injected terrain textures.
export const SCENE_MEMORY_METHOD=Object.freeze({version:2,
  description:'Scene-referenced textures (including injected shader uniforms) and geometry/instance buffers, deduplicated by GPU texture handle when available and buffer attribute identity; texture formats, layers and mip levels included.',
  excludes:['render targets (including shadow maps, reflections and compositor buffers)','driver overhead, shader programs and renderer-generated buffers','resources retained outside the scene']});

/** Texture references in materials, including uniforms patched into standard shaders. */
export function sceneTextureResources(root,properties=null){
  const textures=new Set(),materials=new Set(),seen=new Set();
  // Only descend data records and arrays. Never recurse through the scene,
  // renderer, DOM objects or texture pixel buffers; cycles in userData are legal.
  const collect=value=>{
    const pending=[value];
    while(pending.length){
      const item=pending.pop();
      if(!item||typeof item!=='object'||seen.has(item))continue;
      seen.add(item);
      if(item.isTexture){if(!item.isRenderTargetTexture)textures.add(item);continue;}
      const prototype=Object.getPrototypeOf(item);
      if(Array.isArray(item)||prototype===Object.prototype||prototype===null)for(const value of Object.values(item))pending.push(value);
    }
  };
  const uniforms=values=>{for(const uniform of Object.values(values??{}))collect(uniform?.value);};
  root?.traverse?.(object=>{
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(!material||materials.has(material))continue;
      materials.add(material);
      for(const value of Object.values(material))if(value?.isTexture)collect(value);
      uniforms(material.uniforms);
      uniforms(properties?.get?.(material)?.uniforms);
      collect(material.userData);
    }
    // Skinning, morph targets and batched meshes can sample object-owned maps.
    for(const value of Object.values(object))if(value?.isTexture)collect(value);
    collect(object.skeleton?.boneTexture);
  });
  collect(root?.background);collect(root?.environment);
  return [...textures];
}

/** Storage for one texture, including explicit or generated mip levels. */
export function textureGpuBytes(texture){
  if(!texture?.isTexture||texture.isRenderTargetTexture)return 0;
  const imageOf=image=>image?.isTexture?image.image:image;
  const levelBytes=(image,depth=1)=>{
    image=imageOf(image);
    if(!image?.width||!image?.height)return 0;
    // Compressed array payloads already contain every layer. Multiplying their
    // byteLength by depth would count the layers a second time.
    if(texture.isCompressedTexture&&image.data)return image.data.byteLength;
    return getByteLength(image.width,image.height,texture.format,texture.type)*(image.depth??depth);
  };
  const generatedBytes=image=>{
    image=imageOf(image);
    if(!image?.width||!image?.height)return 0;
    let width=image.width,height=image.height,depth=image.depth??1,total=0;
    // The vendored renderer allocates/generates mips from this flag even when
    // the current minification filter does not sample them.
    const mipmapped=texture.generateMipmaps;
    do{
      total+=levelBytes({width,height,depth});
      if(!mipmapped||width===1&&height===1&&(!texture.isData3DTexture||depth===1))break;
      width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2));
      if(texture.isData3DTexture)depth=Math.max(1,Math.floor(depth/2));
    }while(true);
    return total;
  };
  const mips=texture.mipmaps??[],image=texture.image;
  if(texture.isCubeTexture){
    const faces=Array.isArray(image)?image:[];
    if(texture.isCompressedTexture)return faces.reduce((total,face)=>total+(face.mipmaps??[]).reduce((n,mip)=>n+levelBytes(mip),0),0);
    // Three's uncompressed cube mip list excludes the base faces; its normal
    // and compressed texture mip lists include their base level.
    if(mips.length)return faces.reduce((n,face)=>n+levelBytes(face),0)+mips.reduce((n,mip)=>n+(mip.image??[]).reduce((sum,face)=>sum+levelBytes(face),0),0);
    return faces.reduce((n,face)=>n+generatedBytes(face),0);
  }
  if(mips.length)return mips.reduce((n,mip)=>n+levelBytes(mip,image?.depth??1),0);
  return generatedBytes(image);
}

export function estimateSceneGpuMemory(root,properties=null){
  const textures=sceneTextureResources(root,properties),textureHandles=new Set(),geometries=new Set(),buffers=new Set();
  let textureBytes=0,geometryBytes=0;
  for(const texture of textures){
    const handle=properties?.get?.(texture)?.__webglTexture??texture;
    if(textureHandles.has(handle))continue;
    textureHandles.add(handle);textureBytes+=textureGpuBytes(texture);
  }
  const attribute=value=>{
    const buffer=value?.isInterleavedBufferAttribute?value.data:value;
    // Three keys WebGL buffers by the attribute (or interleaved buffer), not
    // its typed array: two attributes sharing CPU data still allocate twice.
    if(!buffer||buffers.has(buffer)||!buffer.array)return;
    buffers.add(buffer);geometryBytes+=buffer.array.byteLength;
  };
  root?.traverse?.(object=>{
    const geometry=object.geometry;
    if(geometry&&!geometries.has(geometry)){
      geometries.add(geometry);
      for(const value of Object.values(geometry.attributes??{}))attribute(value);
      attribute(geometry.index);
      for(const values of Object.values(geometry.morphAttributes??{}))for(const value of values)attribute(value);
    }
    attribute(object.instanceMatrix);attribute(object.instanceColor);
  });
  return {textures:textureBytes,geometry:geometryBytes,total:textureBytes+geometryBytes};
}
