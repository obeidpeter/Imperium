import {mkdir,cp,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,relative,join,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {chapterFlatAssets,chapterOfflineAssets} from '../src/ui/art.js';
import {PRESENTATION_BUDGET as budget} from '../src/ui/presentation-budget.js';
import {CONFIG} from '../src/config.js';
import {moduleClosure,staticImportClosure,studyAssets,initialAssets} from './module-closure.mjs';
import {CAMPAIGN_CHAPTERS,DEMO_LAST_CHAPTER,laterChapterOnly} from './edition.mjs';
import {desktopOnlyWorldFiles} from '../src/ui/world-catalog.js';
import {desktopOnlyBodyFiles,webOnlyBodyFiles} from '../src/ui/actor-body-catalog.js';

// The target (the Steam plan, docs/steam-plan.md): `web` (the default) is the static site with its service worker and
// install manifest; `desktop` is the same game for the Electron app in desktop/, which serves it from its own files:
// no service worker, offline packs or install manifest, and the platform recorded in the configuration.
const targetArg=process.argv.find(a=>a.startsWith('--target='))?.slice(9)??(process.argv.includes('--target')?process.argv[process.argv.indexOf('--target')+1]:'web');
if(!['web','desktop'].includes(targetArg))throw new Error(`Unknown build target ${targetArg}: use web or desktop.`);
const target=targetArg,desktop=target==='desktop';
// The edition (S2): `full` (the default), or `demo`, the free web demo of the opening chapters, into dist-demo/, without
// the files only later chapters use (scripts/edition.mjs). The desktop app is the full game.
const editionArg=process.argv.find(a=>a.startsWith('--edition='))?.slice(10)??(process.argv.includes('--edition')?process.argv[process.argv.indexOf('--edition')+1]:'full');
if(!['full','demo'].includes(editionArg))throw new Error(`Unknown edition ${editionArg}: use full or demo.`);
const edition=editionArg,demo=edition==='demo',lastChapter=demo?DEMO_LAST_CHAPTER:CAMPAIGN_CHAPTERS;
if(demo&&desktop)throw new Error('The desktop app is the full game: build the demo for the web.');
const outName=desktop?'dist-desktop':demo?'dist-demo':'dist';
const root=resolve('.'),dist=resolve(root,outName);
const packageInfo=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
// Delete only the reproducible output after checking its absolute boundary.
if(dirname(dist)!==root||basename(dist)!==outName||packageInfo.name!=='imperium')throw new Error('Run the build from the Imperium project root.');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const file of ['index.html','icon.svg',...(desktop?[]:['manifest.webmanifest']),'src','icons','assets','showcase','vendor'])await cp(join(root,file),join(dist,file),{recursive:true,filter:path=>!path.endsWith('debug.js')});
const raw=process.env.SITE_URL||'';let siteUrl='';
if(raw){const u=new URL(raw);if(!['https:','http:'].includes(u.protocol))throw new Error('SITE_URL must be an HTTP(S) address.');if(u.username||u.password||u.search||u.hash)throw new Error('SITE_URL must contain no credentials, query or fragment.');siteUrl=u.href.endsWith('/')?u.href:u.href+'/';}
// The full game's store page, for the demo's last screen: an HTTPS address, once the store page exists.
const rawStore=demo?process.env.STORE_URL||'':'';let storeUrl='';
if(rawStore){const u=new URL(rawStore);if(u.protocol!=='https:'||u.username||u.password)throw new Error('STORE_URL must be an HTTPS address without credentials.');storeUrl=u.href;}
await writeFile(join(dist,'src/config.js'),'export const CONFIG=Object.freeze('+JSON.stringify({siteUrl:desktop?'':siteUrl,version:packageInfo.version,saveKey:CONFIG.saveKey,development:false,platform:target,
  ...(demo?{edition,lastChapter,storeUrl}:{})})+');\n');
if(desktop){
  // The app is its own window: no install manifest to link.
  const page=await readFile(join(dist,'index.html'),'utf8'),linked=/\n?[ \t]*<link rel="manifest"[^>]*>/;
  if(!linked.test(page))throw new Error('index.html no longer links the install manifest the desktop build removes.');
  await writeFile(join(dist,'index.html'),page.replace(linked,''));
}else{
  const manifest=JSON.parse(await readFile(join(dist,'manifest.webmanifest'),'utf8'));
  if(siteUrl){manifest.id=siteUrl;manifest.start_url=siteUrl;manifest.scope=siteUrl;}
  if(demo){manifest.name+=' (free demo)';manifest.short_name='Imperium demo';manifest.description='The free demo: the opening chapters of a Roman tactical chronicle.';}
  await writeFile(join(dist,'manifest.webmanifest'),JSON.stringify(manifest,null,2));
}
async function files(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())result.push(...await files(path));else if(!['sw.js','build-report.json'].includes(entry.name))result.push(path);}return result.sort();}
const urlOf=path=>'./'+relative(dist,path).replaceAll('\\','/');
// Install only the title/recruit shell. Current chapters are requested separately;
// downloading the complete campaign always requires the user's explicit request.
const openingArt=new Set(['./assets/scenes/frontier-oath.webp','./assets/portraits/hero-recruit.webp','./assets/portraits/varro.webp']);
// The demo: its page says so, and it leaves out what only later chapters use, before anything is counted or hashed.
const omitted=[];
if(demo){
  const page=await readFile(join(dist,'index.html'),'utf8');
  const titled=page.replace(/<title>([^<]*)<\/title>/,'<title>$1 · Free demo</title>')
    .replace(/(<meta name="description" content=")[^"]*(")/,'$1The free demo of Imperium: the opening chapters of a Roman tactical chronicle, from the Danube frontier to the imperial purple.$2');
  if(!titled.includes(' · Free demo</title>')||!titled.includes('content="The free demo'))throw new Error('index.html no longer has the title and description the demo build rewrites.');
  await writeFile(join(dist,'index.html'),titled);
  const urls=(await files(dist)).map(urlOf),shell=await staticImportClosure(dist,'src/ui/app.js');
  for(const url of laterChapterOnly(urls,{initial:initialAssets(urls,{shellModules:shell,openingArt}),lastChapter})){
    const data=await readFile(join(dist,url));omitted.push({url,bytes:data.length,gzipBytes:gzipSync(data).length});await rm(join(dist,url));
  }
}
// The web leaves out the world files and bodies no chapter's web download carries (world-catalog.js,
// actor-body-catalog.js): the desktop app has them.
const desktopOnly=[];
if(!desktop)for(const file of [...desktopOnlyWorldFiles(),...desktopOnlyBodyFiles()]){
  const path=join(dist,file);let data;try{data=await readFile(path);}catch(error){if(error.code==='ENOENT')continue;throw error;}
  desktopOnly.push({url:'./'+file,bytes:data.length,gzipBytes:gzipSync(data).length});await rm(path);
}
// The desktop app leaves out the bodies it shows in no chapter: a named man's first body, which his face from his
// portrait replaces there, rides the web alone (actor-body-catalog.js).
const webOnly=[];
if(desktop)for(const file of webOnlyBodyFiles()){
  const path=join(dist,file);let data;try{data=await readFile(path);}catch(error){if(error.code==='ENOENT')continue;throw error;}
  webOnly.push({url:'./'+file,bytes:data.length,gzipBytes:gzipSync(data).length});await rm(path);
}
const list=await files(dist),hash=createHash('sha256'),records=[];
const workerTemplate=(await readFile(join(root,'scripts/service-worker.template.js'),'utf8')).replaceAll('\r\n','\n');
hash.update(workerTemplate);
const textExt=/\.(?:js|mjs|html|css|json|svg|webmanifest|txt)$/i;
for(const path of list){
  const url=urlOf(path);
  let data=await readFile(path);
  if(textExt.test(url)){
    let text=data.toString('utf8').replaceAll('\r\n','\n');
    if(url.startsWith('./vendor/three/')&&url.endsWith('.js'))text=text.replace(/\/\*\*(?!\s*\*\s*@license)[\s\S]*?\*\//g,'').replace(/^[ \t]+/gm,'').replace(/\n{2,}/g,'\n');
    const normalized=Buffer.from(text,'utf8');
    if(!normalized.equals(data)){data=normalized;await writeFile(path,data);}
  }
  hash.update(url);hash.update(data);records.push({url,bytes:data.length,gzipBytes:gzipSync(data).length});
}
const revision=hash.digest('hex').slice(0,12),assets=records.map(r=>r.url);
// The shell carries whatever the page's entry module loads statically, or it
// would not start offline: that includes the board readout, which lives beside
// the 3D code but is shared with the 2D view, so it belongs to the shell.
const shellModules=new Set(await staticImportClosure(dist,'src/ui/app.js'));
for(const url of shellModules)if(!assets.includes(url))throw new Error(`The shell imports missing module ${url}`);
const showcaseAssets=studyAssets(assets,{shellModules}),showcaseSet=new Set(showcaseAssets);
const initial=initialAssets(assets,{shellModules,openingArt});
// The chapters this edition plays: all twelve, or the demo's.
const chapterGroups=Object.fromEntries(Array.from({length:lastChapter},(_,i)=>[i+1,chapterOfflineAssets(i+1,assets,{desktop})]));
// The 2D art each chapter adds for the 2D view and painted figures.
const chapterFlatGroups=Object.fromEntries(Array.from({length:lastChapter},(_,i)=>[i+1,chapterFlatAssets(i+1)]));
for(const groups of [chapterGroups,chapterFlatGroups])for(const [chapter,paths]of Object.entries(groups))for(const path of paths)if(!assets.includes(path))throw new Error(`Chapter ${chapter} requires missing asset ${path}`);
// Offline play: every module the page can load, on demand included, is in the shell or in every chapter's pack.
for(const url of await moduleClosure(dist,'src/ui/app.js'))if(!initial.includes(url))for(const [chapter,paths]of Object.entries(chapterGroups))
  if(!paths.includes(url))throw new Error(`Chapter ${chapter}'s offline pack lacks ${url}, which the page can load`);
const sw=workerTemplate.replaceAll('__REVISION__',revision).replace('__ALL_FILES__',JSON.stringify(assets)).replace('__INITIAL_FILES__',JSON.stringify(initial)).replace('__CHAPTER_FILES__',JSON.stringify(chapterGroups)).replace('__CHAPTER_FLAT_FILES__',JSON.stringify(chapterFlatGroups));
// The offline packs are still worked out on the desktop (they check every chapter's assets are present), but only the
// web build has a worker to carry them.
if(!desktop)await writeFile(join(dist,'sw.js'),sw);
const sum=(items,key)=>items.reduce((total,item)=>total+item[key],0);
const bytes=sum(records,'bytes'),gzipBytes=sum(records,'gzipBytes');
const workerBytes=desktop?0:Buffer.byteLength(sw),workerGzipBytes=desktop?0:gzipSync(sw).length;
const initialRecords=records.filter(r=>initial.includes(r.url));
const initialBytes=sum(initialRecords,'bytes')+workerBytes,initialGzipBytes=sum(initialRecords,'gzipBytes')+workerGzipBytes;
const chapterOneFiles=[...new Set([...initial,...chapterGroups[1]])];
const chapterOneRecords=records.filter(r=>chapterOneFiles.includes(r.url));
const chapterOneBytes=sum(chapterOneRecords,'bytes')+workerBytes,chapterOneGzipBytes=sum(chapterOneRecords,'gzipBytes')+workerGzipBytes;
// Chapter I as the 2D view and painted figures download it.
const chapterOneFlatGzipBytes=chapterOneGzipBytes+sum(records.filter(r=>chapterFlatGroups[1].includes(r.url)&&!chapterOneFiles.includes(r.url)),'gzipBytes');
const completeBytes=bytes+workerBytes,completeGzipBytes=gzipBytes+workerGzipBytes;
// A device's first visit to each chapter: the shell, the chapter's pack and the
// worker, for the 3D view and with the 2D art that view and painted figures add.
const gzipOf=Object.fromEntries(records.map(r=>[r.url,r.gzipBytes]));
const download=paths=>[...new Set(paths)].reduce((total,url)=>total+gzipOf[url],0)+workerGzipBytes;
const chapterDownloadGzipBytes=Object.fromEntries(Object.entries(chapterGroups).map(([chapter,paths])=>[chapter,{view3D:download([...initial,...paths]),view2D:download([...initial,...paths,...chapterFlatGroups[chapter]])}]));
const largestChapterGzipBytes=Math.max(...Object.values(chapterDownloadGzipBytes).map(sizes=>sizes.view2D));
// Keep the initial shell small; authored animation and environments arrive by chapter.
// The download limits are the web's: the desktop app installs every file at once.
if(!desktop&&(initialGzipBytes>budget.initialGzipBytes||chapterOneGzipBytes>budget.chapterOneGzipBytes||largestChapterGzipBytes>budget.chapterGroupGzipBytes||completeGzipBytes>budget.completeGzipBytes))throw new Error('Compressed initial '+initialGzipBytes+' / chapter 1 '+chapterOneGzipBytes+' / largest chapter '+largestChapterGzipBytes+' / complete '+completeGzipBytes+' exceed the declared presentation budgets.');
const report={version:packageInfo.version,target,edition,lastChapter,desktopOnlyFiles:desktopOnly.length,desktopOnlyGzipBytes:sum(desktopOnly,'gzipBytes'),webOnlyFiles:webOnly.length,webOnlyGzipBytes:sum(webOnly,'gzipBytes'),...(demo?{omittedFiles:omitted.length,omittedBytes:sum(omitted,'bytes'),omittedGzipBytes:sum(omitted,'gzipBytes'),storeUrl:storeUrl||'none yet'}:{}),revision,files:assets.length,bytes,gzipBytes,initialFiles:initial.length,initialBytes,initialGzipBytes,chapterOneFiles:chapterOneFiles.length,chapterOneBytes,chapterOneGzipBytes,chapterOneFlatGzipBytes,completeBytes,completeGzipBytes,chapterDownloadGzipBytes,largestChapterGzipBytes,deferredFiles:assets.length-initial.length,firstLoadBudget:budget.initialGzipBytes,chapterOneBudget:budget.chapterOneGzipBytes,chapterGroupBudget:budget.chapterGroupGzipBytes,completeBudget:budget.completeGzipBytes,measurement:'sum of gzip files, including service worker in initial/chapter1/chapter download/complete figures; not a browser network trace',initialAssets:initial,chapterAssets:chapterGroups,chapterGzipBytes:Object.fromEntries(Object.entries(chapterGroups).map(([chapter,paths])=>[chapter,sum(records.filter(r=>paths.includes(r.url)),'gzipBytes')])),showcaseAssets,showcaseGzipBytes:sum(records.filter(r=>showcaseSet.has(r.url)),'gzipBytes'),deferredAssets:assets.filter(url=>!initial.includes(url)),siteUrl:siteUrl||'relative to host',builtAt:new Date().toISOString()};
await writeFile(join(dist,'build-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

