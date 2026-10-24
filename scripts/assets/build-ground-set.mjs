// Builds the ground's two texture arrays from the CC0 sets that
// `npm run asset:cc0 -- fetch` recorded in art-source/cc0/, one layer for each
// entry of GROUND_LAYERS (src/ui/ground-layers.js), in that order:
// - the colour, with the height (the set's displacement, stretched to the full
//   range) in alpha, for height-blended transitions;
// - the normal (OpenGL convention), X in colour and Y in alpha.
// Each layer is resized to GROUND_TEXTURE_SIZE and both arrays are written as
// KTX2 (Basis Universal ETC1S, with mipmaps). Every source file is checked
// against its record's SHA-256 first. It reports each layer's mean colour, the
// code-built stand-in's, and with --record writes both files' manifest
// entries, which list every layer's source, authors and digests.
//
// Development tool: it needs sharp (ASSET_MODULES, as for compress.mjs) and the
// Basis Universal encoder (BASISU); `npm run asset:setup` installs both.
//   node scripts/assets/build-ground-set.mjs [--record] [--quality 128]
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {GROUND_FILES,GROUND_LAYERS,GROUND_TEXTURE_SIZE} from '../../src/ui/ground-layers.js';
import {layeredManifestEntry,upsertManifestText} from './cc0.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const run=promisify(execFile),sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const MAPS={colour:'Diffuse',normal:'nor_gl',height:'Displacement'};

async function loadSharp(){
  const require=createRequire(process.env.ASSET_MODULES?resolve(process.env.ASSET_MODULES,'_'):import.meta.url);
  try{const module=await import(pathToFileURL(require.resolve('sharp')).href);return module.default??module;}
  catch{console.error('sharp is not installed: run npm run asset:setup, or set ASSET_MODULES to a folder whose node_modules holds it.');process.exit(2);}
}

/** A layer's source files, each checked against its record. */
export async function layerSources(layer,{base=root}={}){
  const [source,id]=layer.source.split(':'),recordPath=`art-source/cc0/${source}-${id}.json`;
  const record=JSON.parse(await readFile(join(base,recordPath),'utf8')),files={};
  for(const [role,map]of Object.entries(MAPS)){
    const file=record.files.find(f=>f.map===map);
    if(!file)throw new Error(`${recordPath} has no ${map} map: fetch it with --maps Diffuse,nor_gl,Displacement.`);
    const data=await readFile(join(base,file.path));
    if(sha256(data)!==file.sha256)throw new Error(`${file.path} does not match its record's digest.`);
    files[role]=data;
  }
  return {record,recordPath,files};
}

/** The layer's two images at `size`: colour with height in alpha, and normal; and the mean colour. */
export async function composeLayer(sharp,files,size=GROUND_TEXTURE_SIZE){
  const fit=input=>sharp(input).resize(size,size,{kernel:'lanczos3',fit:'fill'});
  const colour=await fit(files.colour).removeAlpha().toColourspace('srgb').raw({depth:'uchar'}).toBuffer();
  const height=await fit(files.height).toColourspace('b-w').normalise().raw({depth:'uchar'}).toBuffer();
  const normal=await fit(files.normal).removeAlpha().toColourspace('srgb').raw({depth:'uchar'}).toBuffer();
  const pixels=size*size,rgba=Buffer.alloc(pixels*4),sum=[0,0,0];
  for(let i=0;i<pixels;i++){for(let c=0;c<3;c++){rgba[i*4+c]=colour[i*3+c];sum[c]+=colour[i*3+c];}rgba[i*4+3]=height[i];}
  const mean='#'+sum.map(v=>Math.round(v/pixels).toString(16).padStart(2,'0')).join('');
  return {
    albedo:await sharp(rgba,{raw:{width:size,height:size,channels:4}}).png().toBuffer(),
    normal:await sharp(normal,{raw:{width:size,height:size,channels:3}}).png().toBuffer(),
    mean
  };
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const basisu=process.env.BASISU||'basisu',quality=String(arg('--quality',128)),sharp=await loadSharp();
  const version=(await run(basisu,['-version']).catch(()=>({stdout:''}))).stdout.match(/v\d+\.\d+(?:\.\d+)?/)?.[0];
  if(!version){console.error(`The Basis Universal encoder was not found at ${basisu}: run npm run asset:setup, or set BASISU.`);process.exit(2);}
  const work=await mkdtemp(join(tmpdir(),'imperium-ground-')),layers=[],inputs={albedo:[],normal:[]};
  try{
    for(const [i,layer]of GROUND_LAYERS.entries()){
      const {record,recordPath,files}=await layerSources(layer),images=await composeLayer(sharp,files);
      for(const kind of ['albedo','normal']){const path=join(work,`${String(i).padStart(2,'0')}-${layer.key}-${kind}.png`);await writeFile(path,images[kind]);inputs[kind].push(path);}
      layers.push({layer:layer.key,record,recordPath,mean:images.mean});
      console.log(`${layer.key.padEnd(9)} ${layer.source.padEnd(32)} mean ${images.mean}${images.mean!==layer.fallback?` (the stand-in uses ${layer.fallback})`:''}`);
    }
    const encode={albedo:['-q',quality],normal:['-q',quality,'-normal_map','-separate_rg_to_color_alpha']},shipped={};
    for(const kind of ['albedo','normal']){
      const output=join(root,GROUND_FILES[kind]);await mkdir(dirname(output),{recursive:true});
      await run(basisu,['-ktx2','-tex_array','-tex_type','2darray','-mipmap',...encode[kind],...inputs[kind],'-output_file',output],{maxBuffer:64*1024*1024});
      const data=await readFile(output);shipped[kind]={path:GROUND_FILES[kind],bytes:data.length,sha256:sha256(data)};
      console.log(`${GROUND_FILES[kind]}: ${GROUND_LAYERS.length} layers, ${(data.length/1024).toFixed(0)} KB`);
    }
    if(process.argv.includes('--record')){
      const manifestPath=join(root,'docs/asset-manifest.json');let text=await readFile(manifestPath,'utf8');
      const common={builder:'scripts/assets/build-ground-set.mjs',usage:'The ground of every 3D battle, field and camp: the terrain material blends the layers the board\'s cells, roads, water and slopes call for.',
        loading:'Every chapter\'s offline pack (one shared download), preloaded before a 3D scene is built. Without it the ground draws each layer\'s mean colour.',
        processing:`resized to ${GROUND_TEXTURE_SIZE} px with Lanczos filtering and encoded as a KTX2 2D array with basisu ${version} (ETC1S, quality ${quality}, mipmaps)`};
      text=upsertManifestText(text,layeredManifestEntry(layers,shipped.albedo,{...common,id:'ground-albedo',subject:`The ground's ${GROUND_LAYERS.length} layers: colour, with the height in alpha`,
        processing:`${common.processing}; the displacement map, stretched to the full range, in alpha`}));
      text=upsertManifestText(text,layeredManifestEntry(layers,shipped.normal,{...common,id:'ground-normal',subject:`The ground's ${GROUND_LAYERS.length} layers: normals (OpenGL), X in colour and Y in alpha`,
        processing:`${common.processing}, tuned for normal maps with X and Y in separate slices`}));
      await writeFile(manifestPath,text);console.log('Recorded both arrays in docs/asset-manifest.json.');
    }
  }finally{await rm(work,{recursive:true,force:true});}
}
