const CACHE='sacramentum-__REVISION__';
const FILES=__ALL_FILES__;
const INITIAL=__INITIAL_FILES__;
const KNOWN=new Set(FILES.map(path=>new URL(path,self.registration.scope).href));
let campaignDownload=null;

async function report(source){
  const cache=await caches.open(CACHE);
  const completed=(await Promise.all(FILES.map(path=>cache.match(path)))).filter(Boolean).length;
  const data={type:completed===FILES.length?'offline-ready':'offline-progress',completed,loaded:completed,total:FILES.length,assets:completed,percent:Math.floor(completed*100/FILES.length),revision:'__REVISION__'};
  if(source)source.postMessage(data);
  else for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage(data);
  return completed;
}

async function downloadCampaign(){
  const cache=await caches.open(CACHE);
  await report();
  for(const path of FILES){
    if(!await cache.match(path)){
      try{await cache.add(path);}catch{
        for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage({type:'offline-error',message:'Some artwork is not downloaded yet. Reconnect and try again; saved progress stays on this device.'});
        await report();return;
      }
      await report();
    }
  }
  await report();
}

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(INITIAL))));
// Waiting versions activate after the old tabs close; never interrupt an encounter.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sacramentum-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    // This worker only reads its own revision: an older cache cannot satisfy a new asset.
    const cache=await caches.open(CACHE);
    const hit=await cache.match(event.request);
    if(hit)return hit;
    if(event.request.mode==='navigate'){
      const shell=await cache.match('./index.html');if(shell)return shell;
    }
    const response=await fetch(event.request);
    if(response.ok&&KNOWN.has(event.request.url))await cache.put(event.request,response.clone());
    return response;
  })());
});
self.addEventListener('message',event=>{
  if(event.data==='offline-status')event.waitUntil(report(event.source));
  if(event.data==='cache-campaign'){
    if(!campaignDownload)campaignDownload=downloadCampaign().finally(()=>{campaignDownload=null;});
    event.waitUntil(campaignDownload.then(()=>report(event.source)));
  }
});
