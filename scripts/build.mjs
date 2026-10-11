import {mkdir,cp,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,relative,join,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

const root=resolve('.'),dist=resolve(root,'dist');
const packageInfo=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
// Delete only the reproducible output after checking its absolute boundary.
if(dirname(dist)!==root||basename(dist)!=='dist'||packageInfo.name!=='sacramentum')throw new Error('Run the build from the Sacramentum project root.');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const file of ['index.html','icon.svg','manifest.webmanifest','src','icons','assets'])await cp(join(root,file),join(dist,file),{recursive:true,filter:path=>!path.endsWith('debug.js')});
const raw=process.env.SITE_URL||'';let siteUrl='';
if(raw){const u=new URL(raw);if(!['https:','http:'].includes(u.protocol))throw new Error('SITE_URL must be an HTTP(S) address.');if(u.username||u.password||u.search||u.hash)throw new Error('SITE_URL must contain no credentials, query or fragment.');siteUrl=u.href.endsWith('/')?u.href:u.href+'/';}
await writeFile(join(dist,'src/config.js'),'export const CONFIG=Object.freeze('+JSON.stringify({siteUrl,version:packageInfo.version,saveKey:'sacramentum.campaign.v1',development:false})+');\n');
const manifest=JSON.parse(await readFile(join(dist,'manifest.webmanifest'),'utf8'));
if(siteUrl){manifest.id=siteUrl;manifest.start_url=siteUrl;manifest.scope=siteUrl;}
await writeFile(join(dist,'manifest.webmanifest'),JSON.stringify(manifest,null,2));
async function files(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())result.push(...await files(path));else if(!['sw.js','build-report.json'].includes(entry.name))result.push(path);}return result.sort();}
const list=await files(dist),hash=createHash('sha256'),records=[];
const workerTemplate=await readFile(join(root,'scripts/service-worker.template.js'),'utf8');
hash.update(workerTemplate);
for(const path of list){const data=await readFile(path),url='./'+relative(dist,path).replaceAll('\\','/');hash.update(url);hash.update(data);records.push({url,bytes:data.length,gzipBytes:gzipSync(data).length});}
const revision=hash.digest('hex').slice(0,12),assets=records.map(r=>r.url);
// Later portraits and scenes are warmed only after the app's cache-campaign message.
const openingArt=new Set(['./assets/scenes/frontier-oath.webp','./assets/portraits/hero-recruit.webp','./assets/portraits/varro.webp']);
const initial=assets.filter(url=>!url.startsWith('./assets/')||openingArt.has(url));
const sw=workerTemplate.replaceAll('__REVISION__',revision).replace('__ALL_FILES__',JSON.stringify(assets)).replace('__INITIAL_FILES__',JSON.stringify(initial));
await writeFile(join(dist,'sw.js'),sw);
const sum=(items,key)=>items.reduce((total,item)=>total+item[key],0);
const bytes=sum(records,'bytes'),gzipBytes=sum(records,'gzipBytes');
const workerBytes=Buffer.byteLength(sw),workerGzipBytes=gzipSync(sw).length;
const initialRecords=records.filter(r=>initial.includes(r.url));
const initialBytes=sum(initialRecords,'bytes')+workerBytes,initialGzipBytes=sum(initialRecords,'gzipBytes')+workerGzipBytes;
const completeBytes=bytes+workerBytes,completeGzipBytes=gzipBytes+workerGzipBytes;
// Preserve the previous stricter complete-package gate as well as the first-load cap.
if(initialGzipBytes>2000000||completeGzipBytes>2000000)throw new Error('Compressed initial '+initialGzipBytes+' / complete '+completeGzipBytes+' exceed the unchanged 2 MB gate.');
const report={version:packageInfo.version,revision,files:assets.length,bytes,gzipBytes,initialFiles:initial.length,initialBytes,initialGzipBytes,completeBytes,completeGzipBytes,deferredFiles:assets.length-initial.length,firstLoadBudget:2000000,completeBudget:2000000,measurement:'sum of gzip files, including service worker in initial/complete figures; not a browser network trace',initialAssets:initial,deferredAssets:assets.filter(url=>!initial.includes(url)),siteUrl:siteUrl||'relative to host',builtAt:new Date().toISOString()};
await writeFile(join(dist,'build-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

