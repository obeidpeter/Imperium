const CACHE='sacramentum-__REVISION__';
const FILES=__ALL_FILES__;
const INITIAL=__INITIAL_FILES__;
const CHAPTERS=__CHAPTER_FILES__;
const absolute=path=>new URL(path,self.registration.scope).href;
const KNOWN=new Set(FILES.map(absolute));
const inflight=new Map(),chapterDownloads=new Map();
let campaignDownload=null;

async function send(data,source){
  if(source)source.postMessage(data);
  else for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage(data);
}
async function count(paths){
  const cache=await caches.open(CACHE);
  const present=new Set((await cache.keys()).map(request=>typeof request==='string'?absolute(request):request.url));
  return paths.filter(path=>present.has(absolute(path))).length;
}
async function report(source){
  const completed=await count(FILES);
  await send({type:completed===FILES.length?'offline-ready':'offline-progress',completed,loaded:completed,total:FILES.length,assets:completed,percent:Math.floor(completed*100/FILES.length),revision:'__REVISION__'},source);
  return completed;
}
async function reportChapter(chapter,source){
  const files=CHAPTERS[chapter];if(!files)return;
  const required=[...new Set([...INITIAL,...files])],completed=await count(required);
  await send({type:'chapter-offline',chapter:Number(chapter),ready:completed===required.length,completed,total:required.length,percent:Math.floor(completed*100/required.length),revision:'__REVISION__'},source);
}
async function ensure(path){
  const url=absolute(path),cache=await caches.open(CACHE);
  if(await cache.match(url))return;
  if(!inflight.has(url))inflight.set(url,(async()=>{
    // Reused URLs must not seed a new edition with stale HTTP-cache artwork.
    const response=await fetch(new Request(url,{cache:'reload'}));
    if(!response.ok)throw new Error('Asset unavailable');
    await cache.put(url,response);
  })().finally(()=>inflight.delete(url)));
  return inflight.get(url);
}
async function download(paths,{chapter,source}={}){
  try{
    for(const path of paths){
      await ensure(path);
      if(chapter)await reportChapter(chapter,source);else await report(source);
    }
  }catch{
    await send({type:'offline-error',chapter:chapter||null,message:'Some artwork is not downloaded yet. Reconnect and try again; saved progress stays on this device.'},source);
  }
  if(chapter)await reportChapter(chapter,source);else await report(source);
}

self.addEventListener('install',event=>event.waitUntil(Promise.all(INITIAL.map(ensure))));
// Waiting editions activate after old tabs close, never during an encounter.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sacramentum-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),navigation=event.request.mode==='navigate';
    const page=navigation&&new URL(event.request.url).pathname.endsWith('/')?new URL('index.html',event.request.url).href:event.request.url;
    const hit=await cache.match(page);
    if(hit)return hit;
    // Known optional pages must load their own document before the campaign
    // fallback. Otherwise the cached title intercepts the first 3D-study visit.
    if(KNOWN.has(page)){
      try{await ensure(page);return await cache.match(page);}catch(error){if(!navigation)throw error;}
    }
    if(navigation){
      const shell=await cache.match('./index.html');if(shell)return shell;
    }
    return fetch(event.request);
  })());
});
self.addEventListener('message',event=>{
  const data=event.data;
  if(data==='offline-status'||data?.type==='offline-status')event.waitUntil((async()=>{await report(event.source);if(data.chapter)await reportChapter(data.chapter,event.source);})());
  if(data?.type==='cache-chapter'&&CHAPTERS[data.chapter]){
    if(!chapterDownloads.has(data.chapter))chapterDownloads.set(data.chapter,download([...new Set([...INITIAL,...CHAPTERS[data.chapter]])],{chapter:data.chapter,source:event.source}).finally(()=>chapterDownloads.delete(data.chapter)));
    event.waitUntil(chapterDownloads.get(data.chapter).then(()=>reportChapter(data.chapter,event.source)));
  }
  // Only an explicit user request should send this message. No install/activate full warm.
  if(data==='cache-campaign'){
    if(!campaignDownload)campaignDownload=download(FILES).finally(()=>{campaignDownload=null;});
    event.waitUntil(campaignDownload.then(()=>report(event.source)));
  }
});
