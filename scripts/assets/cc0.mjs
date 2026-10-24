// Fetches a CC0 texture set from Poly Haven or ambientCG by its id, checks
// every file against the source's own record (Poly Haven's MD5 digests,
// ambientCG's sizes), and writes a provenance record: the asset page, licence,
// authors, retrieval time and each file's URL, bytes and SHA-256. Downloads go
// to art-source/cc0/raw/ (not committed); the record to art-source/cc0/. When a
// file processed from them ships, `record` adds it to docs/asset-manifest.json
// with that provenance, its processing and the CC0 licence.
//
// Development tool. It needs network access to api.polyhaven.com and
// dl.polyhaven.org, or to ambientcg.com and the host its downloads come from
// (acg-download.struffelproductions.com). Node's fetch ignores HTTPS_PROXY:
// behind a proxy, run it with NODE_USE_ENV_PROXY=1 (Node 22.21 or later).
//
//   node scripts/assets/cc0.mjs fetch polyhaven:<id> [--resolution 1k] [--format png] [--maps Diffuse,nor_gl,arm]
//   node scripts/assets/cc0.mjs fetch ambientcg:<id> [--resolution 1K-PNG]
//   node scripts/assets/cc0.mjs record <record.json> <shipped file> --id <id> --subject <text> --usage <text>
//     --loading <text> --processing <text> [--format <text>]
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {basename,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';

const root=fileURLToPath(new URL('../../',import.meta.url));
export const SOURCES=Object.freeze({
  polyhaven:{name:'Poly Haven',page:id=>`https://polyhaven.com/a/${id}`,licenceUrl:'https://polyhaven.com/license'},
  ambientcg:{name:'ambientCG',page:id=>`https://ambientcg.com/a/${id}`,licenceUrl:'https://docs.ambientcg.com/license/'}
});
export const CC0='CC0 1.0 Universal (public domain dedication)';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const md5=bytes=>createHash('md5').update(bytes).digest('hex');

/** The Poly Haven files to fetch: each requested map at one resolution and format. */
export function polyHavenSelection(info,files,{resolution='1k',format='png',maps=['Diffuse','nor_gl','arm']}={}){
  if(info?.type!==1)throw new Error(`Only texture sets are supported; this Poly Haven asset is type ${info?.type}.`);
  return maps.map(map=>{
    const file=files?.[map]?.[resolution]?.[format];
    if(!file?.url)throw new Error(`Poly Haven offers no ${map} map at ${resolution} as ${format}; it has ${Object.keys(files??{}).join(', ')}.`);
    if(!/^https:\/\/dl\.polyhaven\.org\//.test(file.url))throw new Error(`Unexpected download host for ${map}: ${file.url}`);
    return {map,url:file.url,bytes:file.size,md5:file.md5,name:basename(new URL(file.url).pathname)};
  });
}
/** The ambientCG archive to fetch: one resolution and format, such as 1K-PNG. */
export function ambientCgSelection(asset,{resolution='1K-PNG'}={}){
  const downloads=asset?.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads??[];
  const pick=downloads.find(d=>d.attribute===resolution);
  if(!pick)throw new Error(`ambientCG offers ${asset?.assetId} as ${downloads.map(d=>d.attribute).join(', ')||'nothing'}, not ${resolution}.`);
  if(!/^https:\/\/ambientcg\.com\//.test(pick.downloadLink))throw new Error(`Unexpected download link ${pick.downloadLink}`);
  return {url:pick.downloadLink,bytes:pick.size,name:pick.fileName,attribute:pick.attribute};
}

/** The files in a ZIP archive (stored or deflated), from its central directory. */
export function readZip(buffer){
  const end=buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if(end<0)throw new Error('Not a ZIP archive.');
  const count=buffer.readUInt16LE(end+10),entries=[];let at=buffer.readUInt32LE(end+16);
  for(let i=0;i<count;i++){
    if(buffer.readUInt32LE(at)!==0x02014b50)throw new Error('Damaged ZIP directory.');
    const method=buffer.readUInt16LE(at+10),packed=buffer.readUInt32LE(at+20),size=buffer.readUInt32LE(at+24),offset=buffer.readUInt32LE(at+42);
    const nameLength=buffer.readUInt16LE(at+28),name=buffer.toString('utf8',at+46,at+46+nameLength);
    at+=46+nameLength+buffer.readUInt16LE(at+30)+buffer.readUInt16LE(at+32);
    if(name.endsWith('/'))continue;
    if(buffer.readUInt32LE(offset)!==0x04034b50)throw new Error(`Damaged ZIP entry ${name}.`);
    const local=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28),stored=buffer.subarray(local,local+packed);
    const data=method===0?Buffer.from(stored):method===8?inflateRawSync(stored):null;
    if(!data)throw new Error(`${name} uses ZIP method ${method}, which is not supported.`);
    if(data.length!==size)throw new Error(`${name} is damaged.`);
    entries.push({name,data});
  }
  return entries;
}

async function fetchBytes(fetcher,url){
  const response=await fetcher(url);
  if(!response.ok)throw new Error(`${url} answered ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}
async function fetchJson(fetcher,url){return JSON.parse((await fetchBytes(fetcher,url)).toString('utf8'));}

/** Fetches one asset and returns its provenance record and files; writes nothing. */
export async function fetchCc0(spec,options={},{fetcher=globalThis.fetch,now=()=>new Date()}={}){
  const [source,id]=String(spec).split(':');
  if(!SOURCES[source]||!/^[A-Za-z0-9_-]+$/.test(id??''))throw new Error(`Name an asset as polyhaven:<id> or ambientcg:<id>, not ${spec}.`);
  const files=[],record={source:SOURCES[source].name,id,page:SOURCES[source].page(id),licence:CC0,licenceUrl:SOURCES[source].licenceUrl,retrievedAt:now().toISOString()};
  if(source==='polyhaven'){
    const info=await fetchJson(fetcher,`https://api.polyhaven.com/info/${id}`),list=await fetchJson(fetcher,`https://api.polyhaven.com/files/${id}`);
    const selection=polyHavenSelection(info,list,options);
    Object.assign(record,{name:info.name,authors:Object.keys(info.authors??{}),selection:{resolution:options.resolution??'1k',format:options.format??'png',maps:selection.map(f=>f.map)}});
    for(const file of selection){
      const data=await fetchBytes(fetcher,file.url);
      if(md5(data)!==file.md5||data.length!==file.bytes)throw new Error(`${file.name} does not match Poly Haven's digest; nothing was written.`);
      files.push({name:file.name,data,entry:{map:file.map,url:file.url,bytes:data.length,md5:file.md5,sha256:sha256(data)}});
    }
  }else{
    const found=await fetchJson(fetcher,`https://ambientcg.com/api/v2/full_json?id=${id}&include=downloadData,tagData,displayData`),asset=found.foundAssets?.find(a=>a.assetId===id);
    if(!asset)throw new Error(`ambientCG has no asset ${id}.`);
    const archive=ambientCgSelection(asset,options),data=await fetchBytes(fetcher,archive.url);
    if(data.length!==archive.bytes)throw new Error(`${archive.name} is ${data.length} bytes, not the ${archive.bytes} ambientCG lists; nothing was written.`);
    Object.assign(record,{name:asset.displayName,authors:['ambientCG (Lennart Demes)'],method:asset.creationMethodName??asset.creationMethod,selection:{resolution:archive.attribute},archive:{url:archive.url,bytes:data.length,sha256:sha256(data)}});
    for(const entry of readZip(data).filter(e=>/\.(png|jpe?g|exr|tif)$/i.test(e.name)))
      files.push({name:basename(entry.name),data:entry.data,entry:{file:entry.name,bytes:entry.data.length,sha256:sha256(entry.data)}});
    if(!files.length)throw new Error(`${archive.name} holds no images.`);
  }
  record.files=files.map(f=>({...f.entry,path:`art-source/cc0/raw/${source}-${id}/${f.name}`}));
  return {record,files,recordPath:`art-source/cc0/${source}-${id}.json`};
}

const FORMATS={'.ktx2':'KTX2 texture (Basis Universal)','.webp':'WebP image','.png':'PNG image','.jpg':'JPEG image','.glb':'GLB 2.0 model'};
/** A manifest entry for a file processed from a CC0 record. */
export function manifestEntry(record,recordPath,shipped,{id,subject,usage,loading,processing,format}){
  for(const [name,value]of Object.entries({id,subject,usage,loading,processing}))if(!value)throw new Error(`record needs --${name}.`);
  const extension=/\.[a-z0-9]+$/.exec(shipped.path)?.[0];
  return {id,path:shipped.path,subject,
    source:{method:`CC0 ${record.method?String(record.method).toLowerCase()+' ':''}texture set from ${record.source} (${record.name}), ${processing}`,generator:record.source,page:record.page,record:recordPath,authors:record.authors,retrievedAt:record.retrievedAt,
      files:record.files.map(f=>({path:f.path,sha256:f.sha256}))},
    usage,loading,
    export:{format:format??FORMATS[extension]??extension,bytes:shipped.bytes,sha256:shipped.sha256},
    license:`${CC0}: ${record.licenceUrl}. No attribution is required; the files are credited to ${record.authors.join(', ')} on ${record.source}.`};
}

/** A manifest entry for one file built from several CC0 records, such as the
 * layers of a texture array: `layers` lists each layer's name, record and path. */
export function layeredManifestEntry(layers,shipped,{id,subject,usage,loading,processing,builder,format}){
  for(const [name,value]of Object.entries({id,subject,usage,loading,processing}))if(!value)throw new Error(`The entry needs ${name}.`);
  if(!layers?.length)throw new Error('The entry needs its layers.');
  const extension=/\.[a-z0-9]+$/.exec(shipped.path)?.[0],sources=[...new Set(layers.map(l=>l.record.source))],credits=[...new Set(layers.flatMap(l=>l.record.authors))];
  return {id,path:shipped.path,subject,
    source:{method:`CC0 texture sets from ${sources.join(' and ')}, ${processing}`,builder,
      layers:layers.map(({layer,record,recordPath})=>({layer,generator:record.source,name:record.name,page:record.page,record:recordPath,authors:record.authors,retrievedAt:record.retrievedAt,
        files:record.files.map(f=>({path:f.path,sha256:f.sha256}))}))},
    usage,loading,
    export:{format:format??FORMATS[extension]??extension,bytes:shipped.bytes,sha256:shipped.sha256},
    license:`${CC0}: ${[...new Set(layers.map(l=>l.record.licenceUrl))].join(', ')}. No attribution is required; the layers are credited to ${credits.join(', ')} on ${sources.join(' and ')}.`};
}

// The manifest is written by Python's json module (indent 2, floats keep their
// ".0"), so entries are edited as text and the rest of the file is untouched.
const serialize=(value,indent)=>JSON.stringify(value,null,2).split('\n').map((line,i)=>i?' '.repeat(indent)+line:line).join('\n');
/** Adds or replaces one entry in the manifest's text, then its totals, counts and date. */
export function upsertManifestText(text,entry,{now=()=>new Date()}={}){
  const lines=text.split('\n'),open=lines.indexOf('  "assets": [');
  if(open<0)throw new Error('The manifest has no assets list.');
  let close=open+1,start=-1,stop=-1;
  for(;lines[close]!=='  ],'&&lines[close]!=='  ]';close++){
    if(close>=lines.length)throw new Error('The assets list is not closed.');
    if(lines[close]==='    {'&&lines[close+1]===`      "id": ${JSON.stringify(entry.id)},`){start=close;stop=close;while(!/^    },?$/.test(lines[stop]))stop++;}
  }
  const block=('    '+serialize(entry,4)).split('\n');
  if(start>=0){if(lines[stop].endsWith(','))block[block.length-1]+=',';lines.splice(start,stop-start+1,...block);}
  else{lines[close-1]+=',';lines.splice(close,0,...block);}
  let result=lines.join('\n');
  const manifest=JSON.parse(result),bytes=filter=>manifest.assets.filter(filter).reduce((sum,asset)=>sum+asset.export.bytes,0),counts={};
  for(const asset of manifest.assets){const [top,group]=asset.path.split('/'),key=top==='assets'?group:top==='icons'?basename(asset.path):top;counts[key]=(counts[key]??0)+1;}
  const set=(key,value)=>{const pattern=new RegExp(`^  ${JSON.stringify(key)}: .*?(,?)$`,'m');if(!pattern.test(result))throw new Error(`The manifest has no ${key}.`);result=result.replace(pattern,(line,comma)=>`  ${JSON.stringify(key)}: ${serialize(value,2)}${comma}`);};
  set('totalBundledAssetBytes',bytes(()=>true));set('totalModelBytes',bytes(a=>a.path.startsWith('assets/models/')));
  set('updatedAt',now().toISOString());
  // assetCounts spans several lines.
  result=result.replace(/^  "assetCounts": \{[\s\S]*?^  \}(,?)$/m,(block,comma)=>`  "assetCounts": ${serialize(counts,2)}${comma}`);
  JSON.parse(result);return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [command,...rest]=process.argv.slice(2),flags={},positional=[];
  for(let i=0;i<rest.length;i++)if(rest[i].startsWith('--'))flags[rest[i].slice(2)]=rest[++i];else positional.push(rest[i]);
  if(command==='fetch'&&positional.length===1){
    const {record,files,recordPath}=await fetchCc0(positional[0],{resolution:flags.resolution,format:flags.format,maps:flags.maps?.split(',')});
    for(const file of files){const path=join(root,record.files.find(f=>f.path.endsWith('/'+file.name)).path);await mkdir(dirname(path),{recursive:true});await writeFile(path,file.data);}
    await mkdir(join(root,'art-source/cc0'),{recursive:true});await writeFile(join(root,recordPath),JSON.stringify(record,null,2)+'\n');
    console.log(JSON.stringify({record:recordPath,files:record.files.map(f=>f.path)},null,2));
  }else if(command==='record'&&positional.length===2){
    const [recordPath,shippedPath]=positional,record=JSON.parse(await readFile(join(root,recordPath),'utf8')),data=await readFile(join(root,shippedPath));
    const entry=manifestEntry(record,recordPath,{path:shippedPath,bytes:data.length,sha256:sha256(data)},flags),manifestPath=join(root,'docs/asset-manifest.json');
    await writeFile(manifestPath,upsertManifestText(await readFile(manifestPath,'utf8'),entry));
    console.log(JSON.stringify(entry,null,2));
  }else{
    console.error('Usage:\n  node scripts/assets/cc0.mjs fetch polyhaven:<id>|ambientcg:<id> [--resolution R] [--format png|jpg] [--maps A,B]\n  node scripts/assets/cc0.mjs record <record.json> <shipped file> --id <id> --subject <text> --usage <text> --loading <text> --processing <text> [--format <text>]');
    process.exit(2);
  }
}
