// Offline surface repair. Keeps positions, skinning, topology and original generation records.
// Paint is a reviewed Blender atlas; broken overview UV topology is rebuilt from the near head.
// node ... input.glb output.glb [--paint image.png] [--size 1024] [--rebuild-overview] [--report report.json]
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const hash=b=>createHash('sha256').update(b).digest('hex');
// Meshopt can cyclically rotate a triangle; its winding and connectivity stay exact.
const topology=a=>{const out=new Uint32Array(a.length);for(let i=0;i<a.length;i+=3){const t=Array.from(a.slice(i,i+3)),k=t.indexOf(Math.min(...t));out.set([t[k],t[(k+1)%3],t[(k+2)%3]],i);}return hash(out);};
const rows=a=>Array.from({length:a.getCount()},(_,i)=>a.getElement(i,[]));
export async function repairSurfaces(input,{paint=null,size=1024,rebuildOverview=false,rdo=1}={}){
  const require=createRequire(process.env.ASSET_MODULES?resolve(process.env.ASSET_MODULES,'_'):import.meta.url);
  const [core,extensions,meshopt,sharpModule,transforms]=await Promise.all(['@gltf-transform/core','@gltf-transform/extensions','meshoptimizer','sharp','@gltf-transform/functions'].map(n=>import(pathToFileURL(require.resolve(n)).href)));
  const sharp=sharpModule.default;await meshopt.MeshoptDecoder.ready;await meshopt.MeshoptEncoder.ready;
  const io=new core.NodeIO().registerExtensions(extensions.ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':meshopt.MeshoptDecoder,'meshopt.encoder':meshopt.MeshoptEncoder});
  const bytes=await readFile(input),doc=await io.readBinary(bytes),root=doc.getRoot();
  const geometry=(r=root)=>r.listMeshes().map(m=>({name:m.getName(),primitives:m.listPrimitives().map(p=>({indices:topology(p.getIndices().getArray()),attributes:Object.fromEntries(p.listSemantics().filter(s=>s!=='TEXCOORD_0').map(s=>[s,hash(p.getAttribute(s).getArray())]))}))}));
  const textures=(r=root)=>r.listTextures().map(t=>({mimeType:t.getMimeType(),bytes:t.getImage().length,sha256:hash(t.getImage())}));
  const before=geometry(),report={version:1,inputSha256:hash(bytes),bytesBefore:bytes.length,paint:null,uv:null,protectedGeometry:before,texturesBefore:textures()};
  if(rebuildOverview){
    await meshopt.MeshoptSimplifier.ready;
    const near=root.listMeshes().find(m=>m.getName()==='cast-head').listPrimitives()[0],low=root.listMeshes().find(m=>m.getName()==='cast-head-overview'),old=low.listPrimitives()[0],replacement=near.clone();
    // Rebuild from the intact near UV topology. Nearest-vertex UV transfer alone
    // cannot repair the original overview's triangles spanning unrelated islands.
    transforms.simplifyPrimitive(replacement,{simplifier:meshopt.MeshoptSimplifier,ratio:.4,error:.01,lockBorder:true});
    // Retain the old untextured overview colours, used only for fallen figures.
    const pos=rows(replacement.getAttribute('POSITION')),oldPos=rows(old.getAttribute('POSITION'));
    const nearest=pos.map(v=>{let best=Infinity,index=0;oldPos.forEach((p,i)=>{const d=p.reduce((n,x,k)=>n+(x-v[k])**2,0);if(d<best){best=d;index=i;}});return index;});
    for(const semantic of old.listSemantics().filter(s=>s.startsWith('COLOR_'))){const source=old.getAttribute(semantic),data=nearest.flatMap(i=>source.getElement(i,[]));replacement.setAttribute(semantic,doc.createAccessor().setType(source.getType()).setArray(new Float32Array(data)).setBuffer(source.getBuffer()));}
    low.removePrimitive(old).addPrimitive(replacement);old.dispose();
    report.overview={method:'Meshopt reduction of the intact near head, locking UV island borders',sourceMesh:'cast-head',mesh:'cast-head-overview',triangles:replacement.getIndices().getCount()/3,vertices:replacement.getAttribute('POSITION').getCount(),sourceTriangles:near.getIndices().getCount()/3};
  }
  if(paint){
    assert.ok([512,1024,2048].includes(size));const temp=await mkdtemp(join(tmpdir(),'imperium-surface-'));
    try{const png=join(temp,'atlas.png'),ktx=join(temp,'atlas.ktx2'),source=await readFile(paint);
      await sharp(source).resize(size,size,{fit:'fill'}).removeAlpha().png().toFile(png);
      assert.ok(Number.isFinite(rdo)&&rdo>=0&&rdo<=4);
      execFileSync(process.env.BASISU||'basisu',['-ktx2','-uastc','-uastc_level','2','-uastc_rdo_l',String(rdo),'-ktx2_zstandard_level','18','-mipmap','-file',png,'-output_file',ktx],{stdio:'pipe',windowsHide:true});
      const texture=root.listMaterials().at(-1).getBaseColorTexture(),packed=await readFile(ktx);
      report.paint={source:paint,sourceSha256:hash(source),previousSha256:hash(texture.getImage()),sha256:hash(packed),size,bytes:packed.length,codec:'KTX2 UASTC / Zstandard',rdo};
      texture.setImage(packed).setMimeType('image/ktx2');
    }finally{await rm(temp,{recursive:true,force:true});}
  }
  const protectedMeshes=list=>list.filter(m=>!rebuildOverview||m.name!=='cast-head-overview');
  assert.deepEqual(protectedMeshes(geometry()),protectedMeshes(before),'Surface work must not change protected geometry or skinning');
  root.listExtensionsUsed().find(e=>e.extensionName==='EXT_meshopt_compression')?.dispose();
  doc.createExtension(extensions.EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:extensions.EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const output=Buffer.from(await io.writeBinary(doc)),roundtrip=await io.readBinary(output);
  assert.deepEqual(geometry(roundtrip.getRoot()),geometry(),'Encoded geometry and skinning must remain exact');
  report.outputGeometry=geometry(roundtrip.getRoot());
  report.textures=textures(roundtrip.getRoot());report.sha256=hash(output);report.bytes=output.length;
  return {bytes:output,report};
}
export async function exportCorrespondence(input,output){
  const require=createRequire(resolve(process.env.ASSET_MODULES,'_'));
  const [core,extensions,meshopt]=await Promise.all(['@gltf-transform/core','@gltf-transform/extensions','meshoptimizer'].map(n=>import(pathToFileURL(require.resolve(n)).href)));
  await meshopt.MeshoptDecoder.ready;const io=new core.NodeIO().registerExtensions(extensions.ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':meshopt.MeshoptDecoder});
  const bytes=await readFile(input),doc=await io.readBinary(bytes);
  const meshes=doc.getRoot().listMeshes().map(m=>{const p=m.listPrimitives()[0];return {name:m.getName(),positions:rows(p.getAttribute('POSITION')),normals:rows(p.getAttribute('NORMAL')),uv:rows(p.getAttribute('TEXCOORD_0')),indices:Array.from(p.getIndices().getArray())};});
  await writeFile(output,JSON.stringify({inputSha256:hash(bytes),meshes}));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);if(args[0]==='export'){await exportCorrespondence(args[1],args[2]);}
  else{const [input,output]=args,option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};const result=await repairSurfaces(input,{paint:option('--paint'),size:Number(option('--size')||1024),rebuildOverview:args.includes('--rebuild-overview'),rdo:Number(option('--rdo')??1)});await writeFile(output,result.bytes);if(option('--report'))await writeFile(option('--report'),JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify({input,output,bytesBefore:result.report.bytesBefore,bytes:result.report.bytes}));}
}
