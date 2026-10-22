// Compresses a processed GLB for the game: each texture becomes KTX2 (Basis
// Universal ETC1S with mipmaps, KHR_texture_basisu), which the GPU keeps
// compressed, and the geometry is reordered and packed with meshopt
// (EXT_meshopt_compression) without changing a value. The game decodes both
// (src/showcase/model-loader.js). The tool checks that every triangle is
// unchanged and reports the model's bytes and digest before and after, and
// each texture's error (PSNR) from the encoder.
//
// Development tool. It needs the Basis Universal encoder (set BASISU to the
// basisu program, or put it on PATH) and these modules, which are not project
// dependencies:
//   npm install --no-save --no-package-lock @gltf-transform/core@4.5.1 \
//     @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 \
//     meshoptimizer@1.3.0 sharp@0.35.5
// or set ASSET_MODULES to a folder whose node_modules holds them.
//
//   node scripts/assets/compress.mjs input.glb output.glb [--report report.json] [--quality 128]
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {gzipSync} from 'node:zlib';

export const PACKAGES=['@gltf-transform/core@4.5.1','@gltf-transform/extensions@4.5.1','@gltf-transform/functions@4.5.1','meshoptimizer@1.3.0','sharp@0.35.5'];
const run=promisify(execFile);

/** The encoder settings a texture's use calls for: colour maps are sRGB, normal and data maps linear. */
export function textureClass(slots){
  const kinds=new Set(slots.map(slot=>slot==='normalTexture'?'normal':/^(baseColor|emissive|diffuse|specularColor|sheenColor)Texture$/.test(slot)?'srgb':'linear'));
  if(kinds.size!==1)throw new Error(`A texture is used as ${[...kinds].join(' and ')} data (${slots.join(', ')}); give each use its own image.`);
  return [...kinds][0];
}
/** basisu arguments for one texture: ETC1S with mipmaps, in the colour space of its use. */
export function basisArguments(kind,{input,output,quality=128}){
  const space={srgb:[],normal:['-normal_map'],linear:['-linear','-mip_linear']}[kind];
  if(!space)throw new Error(`Unknown texture class ${kind}`);
  return ['-ktx2','-mipmap','-stats','-q',String(quality),...space,'-file',input,'-output_file',output];
}

async function modules(){
  const require=createRequire(process.env.ASSET_MODULES?resolve(process.env.ASSET_MODULES,'_'):import.meta.url);
  const load=async name=>{
    try{return await import(pathToFileURL(require.resolve(name)).href);}
    catch{console.error(`${name} is not installed. Install the compression tools (they are not project dependencies):\n  npm install --no-save --no-package-lock ${PACKAGES.join(' ')}\nor set ASSET_MODULES to a folder whose node_modules holds them.`);process.exit(2);}
  };
  const [core,extensions,functions,meshopt,sharp]=await Promise.all(['@gltf-transform/core','@gltf-transform/extensions','@gltf-transform/functions','meshoptimizer','sharp'].map(load));
  return {core,extensions,functions,meshopt,sharp:sharp.default??sharp};
}

// Every triangle as its three vertices' stored values, starting from the
// smallest vertex so that a rotation keeping the winding compares equal.
function triangles(document){
  const soups=[];
  for(const mesh of document.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
    const names=primitive.listSemantics().sort(),attributes=names.map(name=>primitive.getAttribute(name)),indices=primitive.getIndices()?.getArray();
    const count=indices?indices.length:primitive.getAttribute('POSITION').getCount();
    const vertex=i=>attributes.map(a=>a.getElement(i,[]).join(',')).join('|');
    const list=[];
    for(let t=0;t<count;t+=3){
      const v=[0,1,2].map(k=>vertex(indices?indices[t+k]:t+k)),first=v.indexOf([...v].sort()[0]);
      list.push([v[first],v[(first+1)%3],v[(first+2)%3]].join(' / '));
    }
    soups.push({mesh:mesh.getName(),attributes:names.join(','),triangles:list.sort()});
  }
  return soups;
}

/** Compresses one GLB's bytes; returns the new bytes and a report. */
export async function compressModel(bytes,{quality=128,basisu=process.env.BASISU||'basisu',tools}={}){
  const {core,extensions,functions,meshopt,sharp}=tools??await modules();
  const {MeshoptEncoder,MeshoptDecoder}=meshopt;await MeshoptEncoder.ready;await MeshoptDecoder.ready;
  const io=new core.NodeIO().registerExtensions(extensions.ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
  const document=await io.readBinary(bytes),before=triangles(await io.readBinary(bytes));
  document.setLogger(new core.Logger(core.Logger.Verbosity.WARN));
  const version=(await run(basisu,['-version']).catch(()=>({stdout:''}))).stdout.match(/v\d+\.\d+(?:\.\d+)?/)?.[0];
  if(!version)throw new Error(`The Basis Universal encoder was not found at ${basisu}. Build basisu and set BASISU to its path.`);
  const folder=await mkdtemp(join(tmpdir(),'imperium-ktx2-')),textures=[];
  try{
    for(const [index,texture]of document.getRoot().listTextures().entries()){
      const slots=functions.listTextureSlots(texture),kind=textureClass(slots),image=texture.getImage(),input=join(folder,`${index}.png`),output=join(folder,`${index}.ktx2`);
      if(texture.getMimeType()==='image/ktx2')throw new Error(`Texture ${index} is already KTX2; compress the processed model, not a compressed one.`);
      const {width,height}=await sharp(image).metadata();await sharp(image).png().toFile(input);
      const {stdout}=await run(basisu,basisArguments(kind,{input,output,quality}),{maxBuffer:64*1024*1024});
      const ktx2=await readFile(output),psnr=Number(/\.basis RGB Avg:.*?PSNR:\s*([\d.]+)/.exec(stdout.replaceAll('\n',' '))?.[1]);
      textures.push({slots,kind,width,height,from:{mimeType:texture.getMimeType(),bytes:image.length},bytes:ktx2.length,psnr:Number.isFinite(psnr)?psnr:null});
      texture.setImage(new Uint8Array(ktx2)).setMimeType('image/ktx2');
    }
  }finally{await rm(folder,{recursive:true,force:true});}
  if(textures.length)document.createExtension(extensions.KHRTextureBasisu).setRequired(true);
  for(const extension of document.getRoot().listExtensionsUsed())if(['EXT_texture_webp','EXT_texture_avif'].includes(extension.extensionName))extension.dispose();
  // Vertex order chosen for the codec; values stay as stored (no filters, no requantizing).
  await document.transform(functions.reorder({encoder:MeshoptEncoder,target:'size'}));
  document.createExtension(extensions.EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:extensions.EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const result=Buffer.from(await io.writeBinary(document)),after=triangles(await io.readBinary(result));
  const same=before.length===after.length&&before.every((soup,i)=>soup.mesh===after[i].mesh&&soup.attributes===after[i].attributes&&soup.triangles.length===after[i].triangles.length&&soup.triangles.every((t,k)=>t===after[i].triangles[k]));
  if(!same)throw new Error('The compressed geometry differs from the input; nothing was written.');
  return {bytes:result,report:{
    encoder:{basisu:version,mode:'ETC1S',quality,mipmaps:true,meshopt:'EXT_meshopt_compression, reorder for size, no filters'},
    before:{bytes:bytes.length,gzipBytes:gzipSync(bytes,{level:9}).length,sha256:createHash('sha256').update(bytes).digest('hex')},
    after:{bytes:result.length,gzipBytes:gzipSync(result,{level:9}).length,sha256:createHash('sha256').update(result).digest('hex')},
    geometryUnchanged:same,triangles:after.reduce((n,soup)=>n+soup.triangles.length,0),textures}};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),[input,output]=args,option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
  const quality=Number(option('--quality')??128),reportPath=option('--report');
  if(!input||!output||input.startsWith('--')||output.startsWith('--')||!Number.isInteger(quality)||quality<1||quality>255){
    console.error('Usage: node scripts/assets/compress.mjs input.glb output.glb [--report report.json] [--quality 1-255]');process.exit(2);
  }
  const {bytes,report}=await compressModel(await readFile(input),{quality});
  await writeFile(output,bytes);
  const full={input,output,...report};if(reportPath)await writeFile(reportPath,JSON.stringify(full,null,2)+'\n');
  console.log(JSON.stringify(full,null,2));
}
