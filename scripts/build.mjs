import {mkdir,cp,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,relative,join,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {chapterAssets} from '../src/ui/art.js';
import {PRESENTATION_BUDGET as budget} from '../src/ui/presentation-budget.js';

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
// Install only the title/recruit shell. Current chapters are requested separately;
// downloading the complete campaign always requires the user's explicit request.
const openingArt=new Set(['./assets/scenes/frontier-oath.webp','./assets/portraits/hero-recruit.webp','./assets/portraits/varro.webp']);
const initial=assets.filter(url=>!url.startsWith('./assets/')||openingArt.has(url));
const chapterGroups=Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,chapterAssets(i+1)]));
for(const [chapter,paths]of Object.entries(chapterGroups))for(const path of paths)if(!assets.includes(path))throw new Error(`Chapter ${chapter} requires missing asset ${path}`);
const sw=workerTemplate.replaceAll('__REVISION__',revision).replace('__ALL_FILES__',JSON.stringify(assets)).replace('__INITIAL_FILES__',JSON.stringify(initial)).replace('__CHAPTER_FILES__',JSON.stringify(chapterGroups));
await writeFile(join(dist,'sw.js'),sw);
const sum=(items,key)=>items.reduce((total,item)=>total+item[key],0);
const bytes=sum(records,'bytes'),gzipBytes=sum(records,'gzipBytes');
const workerBytes=Buffer.byteLength(sw),workerGzipBytes=gzipSync(sw).length;
const initialRecords=records.filter(r=>initial.includes(r.url));
const initialBytes=sum(initialRecords,'bytes')+workerBytes,initialGzipBytes=sum(initialRecords,'gzipBytes')+workerGzipBytes;
const chapterOneFiles=[...new Set([...initial,...chapterGroups[1]])];
const chapterOneRecords=records.filter(r=>chapterOneFiles.includes(r.url));
const chapterOneBytes=sum(chapterOneRecords,'bytes')+workerBytes,chapterOneGzipBytes=sum(chapterOneRecords,'gzipBytes')+workerGzipBytes;
const completeBytes=bytes+workerBytes,completeGzipBytes=gzipBytes+workerGzipBytes;
// Keep the initial shell small; authored animation and environments arrive by chapter.
if(initialGzipBytes>budget.initialGzipBytes||chapterOneGzipBytes>budget.chapterOneGzipBytes||completeGzipBytes>budget.completeGzipBytes)throw new Error('Compressed initial '+initialGzipBytes+' / chapter 1 '+chapterOneGzipBytes+' / complete '+completeGzipBytes+' exceed the declared presentation budgets.');
const report={version:packageInfo.version,revision,files:assets.length,bytes,gzipBytes,initialFiles:initial.length,initialBytes,initialGzipBytes,chapterOneFiles:chapterOneFiles.length,chapterOneBytes,chapterOneGzipBytes,completeBytes,completeGzipBytes,deferredFiles:assets.length-initial.length,firstLoadBudget:budget.initialGzipBytes,chapterOneBudget:budget.chapterOneGzipBytes,completeBudget:budget.completeGzipBytes,measurement:'sum of gzip files, including service worker in initial/chapter1/complete figures; not a browser network trace',initialAssets:initial,chapterAssets:chapterGroups,chapterGzipBytes:Object.fromEntries(Object.entries(chapterGroups).map(([chapter,paths])=>[chapter,sum(records.filter(r=>paths.includes(r.url)),'gzipBytes')])),deferredAssets:assets.filter(url=>!initial.includes(url)),siteUrl:siteUrl||'relative to host',builtAt:new Date().toISOString()};
await writeFile(join(dist,'build-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

