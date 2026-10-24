// Encodes the regions' panoramas for the game (src/ui/panoramas.js). Each
// Blender render, art-source/panoramas/<key>.png from
// scripts/assets/render-panorama.py, is checked against its report's digest
// and band; the colour of its clear sky and of the strip below its nearest
// ground is filled from the skyline above and below them, so that filtering
// never darkens a silhouette; the band is folded into two rows (PANORAMA_BAND)
// and written as KTX2 (Basis Universal ETC1S, sRGB, mipmaps with clamped
// edges). With --record it writes each file's manifest entry.
//
// Development tool: it needs sharp (ASSET_MODULES, as for compress.mjs) and the
// Basis Universal encoder (BASISU); `npm run asset:setup` installs both. The
// renders themselves stay out of the repository; their reports keep the seed,
// settings and digest that reproduce them.
//   node scripts/assets/build-panoramas.mjs [--only forest,rome] [--quality 255] [--record]
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {PANORAMA_BAND,PANORAMA_REGIONS,panoramaChapters,panoramaFile} from '../../src/ui/panoramas.js';
import {upsertManifestText} from './cc0.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const run=promisify(execFile),sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const roman=n=>['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][n-1];

async function loadSharp(){
  const require=createRequire(process.env.ASSET_MODULES?resolve(process.env.ASSET_MODULES,'_'):import.meta.url);
  try{const module=await import(pathToFileURL(require.resolve('sharp')).href);return module.default??module;}
  catch{console.error('sharp is not installed: run npm run asset:setup, or set ASSET_MODULES to a folder whose node_modules holds it.');process.exit(2);}
}

/** Gives every fully clear pixel the colour of the nearest covered pixel in its column (RGBA bytes, in place). */
export function bleedColumns(rgba,width,height){
  for(let x=0;x<width;x++){
    let last=-1;
    for(let y=0;y<height;y++){const i=(y*width+x)*4;if(rgba[i+3]>0){
      // Fill the clear run above this covered pixel (the sky, or a gap) from it.
      for(let k=last+1;k<y;k++){const j=(k*width+x)*4;rgba[j]=rgba[i];rgba[j+1]=rgba[i+1];rgba[j+2]=rgba[i+2];}
      last=y;}}
    if(last>=0){const i=(last*width+x)*4;for(let k=last+1;k<height;k++){const j=(k*width+x)*4;rgba[j]=rgba[i];rgba[j+1]=rgba[i+1];rgba[j+2]=rgba[i+2];}}
  }
  return rgba;
}

/** Folds a band `width` across into PANORAMA_BAND.rows rows of width / rows, the first (westward) half on top. */
export function foldRows(rgba,width,height,rows=PANORAMA_BAND.rows){
  if(width%rows)throw new Error(`A band ${width} wide does not fold into ${rows} rows.`);
  const part=width/rows,out=Buffer.alloc(rgba.length);
  for(let r=0;r<rows;r++)for(let y=0;y<height;y++){
    const from=(y*width+r*part)*4;out.set(rgba.subarray(from,from+part*4),((r*height+y)*part)*4);
  }
  return {data:out,width:part,height:height*rows};
}

/** Checks a render against its report and the game's band; returns the report. */
export function checkRender(report,png,key){
  if(report.key!==key)throw new Error(`art-source/panoramas/${key}.json reports ${report.key}.`);
  if(report.png?.sha256!==sha256(png))throw new Error(`art-source/panoramas/${key}.png does not match its report's digest: render it again.`);
  const [min,max]=report.latitude??[];
  if(Math.abs(min-PANORAMA_BAND.minLatitude)>1e-6||Math.abs(max-PANORAMA_BAND.maxLatitude)>1e-6||report.eye!==PANORAMA_BAND.eye)throw new Error(`${key}: the render's band is not the game's.`);
  if(report.width*(PANORAMA_BAND.height)!==report.height*PANORAMA_BAND.width)throw new Error(`${key}: ${report.width} by ${report.height} is not the game's proportion.`);
  return report;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const basisu=process.env.BASISU||'basisu',quality=String(arg('--quality',255)),sharp=await loadSharp();
  const only=arg('--only','')?.split(',').filter(Boolean)??[],keys=only.length?only:PANORAMA_REGIONS;
  for(const key of keys)if(!PANORAMA_REGIONS.includes(key)){console.error(`Unknown region ${key}; the regions are ${PANORAMA_REGIONS.join(', ')}.`);process.exit(2);}
  const version=(await run(basisu,['-version']).catch(()=>({stdout:''}))).stdout.match(/v\d+\.\d+(?:\.\d+)?/)?.[0];
  if(!version){console.error(`The Basis Universal encoder was not found at ${basisu}: run npm run asset:setup, or set BASISU.`);process.exit(2);}
  const work=await mkdtemp(join(tmpdir(),'imperium-panoramas-')),entries=[];
  try{
    for(const key of keys){
      const png=await readFile(join(root,`art-source/panoramas/${key}.png`)),report=checkRender(JSON.parse(await readFile(join(root,`art-source/panoramas/${key}.json`),'utf8')),png,key);
      const {data,info}=await sharp(png).ensureAlpha().raw({depth:'uchar'}).toBuffer({resolveWithObject:true});
      if(info.width!==report.width||info.height!==report.height||info.channels!==4)throw new Error(`${key}: unexpected image ${info.width}x${info.height}x${info.channels}.`);
      const folded=foldRows(bleedColumns(data,info.width,info.height),info.width,info.height);
      const input=join(work,`${key}.png`),output=join(root,panoramaFile(key));
      await writeFile(input,await sharp(folded.data,{raw:{width:folded.width,height:folded.height,channels:4}}).png().toBuffer());
      await mkdir(dirname(output),{recursive:true});
      await run(basisu,['-ktx2','-mipmap','-mip_clamp','-q',quality,'-file',input,'-output_file',output],{maxBuffer:64*1024*1024});
      const shipped=await readFile(output);
      entries.push({key,report,shipped:{path:panoramaFile(key),bytes:shipped.length,sha256:sha256(shipped),width:folded.width,height:folded.height}});
      console.log(`${panoramaFile(key)}: ${folded.width} by ${folded.height}, ${(shipped.length/1024).toFixed(0)} KB (from ${report.width} by ${report.height}, seed ${report.seed})`);
    }
    if(process.argv.includes('--record')){
      const manifestPath=join(root,'docs/asset-manifest.json');let text=await readFile(manifestPath,'utf8');
      for(const {key,report,shipped}of entries){
        const chapters=panoramaChapters(key);
        text=upsertManifestText(text,{id:`panorama-${key}`,path:shipped.path,
          subject:`The far skyline of the ${key} region: an original landscape all round the scene, from 4 degrees below the horizon to 10 above`,
          source:{method:`Original procedural landscape (seeded noise, rivers, forests, fields and landmarks built from simple shapes), rendered in Blender ${report.blender}: ${report.renderer}, ${report.samples} samples. No external images or models`,
            builder:'scripts/assets/render-panorama.py',encoder:'scripts/assets/build-panoramas.mjs',seed:report.seed,report:`art-source/panoramas/${key}.json`,
            render:{width:report.width,height:report.height,bytes:report.png.bytes,sha256:report.png.sha256}},
          usage:`The horizon of every 3D battle, field and camp in Chapter${chapters.length>1?'s':''} ${chapters.map(roman).join(', ')}, beyond the modelled ridges; the game hazes and tints it with each chapter's fog and light (src/showcase/environment-panorama.js).`,
          loading:'Deferred in its chapters\' offline packs and preloaded before a 3D scene is built. Without it, or in a council chamber, the scene keeps the code-painted backdrop.',
          export:{format:`KTX2 (Basis Universal ${version} ETC1S, quality ${quality}, sRGB, mipmaps with clamped edges), the band folded into two rows`,bytes:shipped.bytes,sha256:shipped.sha256,width:shipped.width,height:shipped.height},
          license:'Created for the Imperium project; no third-party source assets'});
      }
      await writeFile(manifestPath,text);console.log(`Recorded ${entries.length} panorama${entries.length===1?'':'s'} in docs/asset-manifest.json.`);
    }
  }finally{await rm(work,{recursive:true,force:true});}
}
