import {summarizeResources,summarizeServerRequests,journeyDurations,inspectInterface} from './interface-metrics.js';
const $=selector=>document.querySelector(selector),frame=$('#game'),milestones=[],seen=new Set();
let active=false,report=null,observer,timer,attachedDocument,originCheck,epoch=0,artQuietSince=0,lastArt=false;
const server=()=>fetch('/__interface/metrics',{cache:'no-store'}).then(r=>r.json());
const at=()=>frame.contentWindow?.performance?.now()??performance.now()-epoch;
async function note(name){
  if(seen.has(name))return;seen.add(name);
  const item={name,atMs:at(),server:null};milestones.push(item);
  item.server=summarizeServerRequests((await server()).requests);
  const row=document.createElement('tr');for(const value of[name,item.atMs.toFixed(1)+' ms',item.server.encodedBodyBytes.toLocaleString()]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}$('#milestones').append(row);
  await capture();
}
function visible(selector){const e=frame.contentDocument?.querySelector(selector);return Boolean(e?.getClientRects().length)&&!e.hidden;}
function inspect(){
  const doc=frame.contentDocument;if(!doc||doc===document)return;
  if(doc!==attachedDocument){
    attachedDocument=doc;observer?.disconnect();observer=new MutationObserver(inspect);observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
    doc.addEventListener('click',event=>{const cmd=event.target.closest('[data-cmd]')?.dataset.cmd;if(cmd==='begin')note('begin-click');if(cmd==='continue')note('continue-click');if(cmd==='start')note('enter-click');},true);
  }
  if(visible('[data-cmd="new"]')||visible('[data-cmd="continue"]'))note('landing-ready');
  if(doc.querySelector('html')?.dataset.phase==='camp'&&doc.querySelector('.chapter-heading,[data-cmd="choose"],[data-cmd="start"]'))note('chapter-visible');
  if(visible('#battle-board')){
    note('board-visible');
    const status=doc.querySelector('#art-loading-status'),pending=status&&!status.hidden&&status.textContent.trim();
    if(pending){lastArt=true;artQuietSince=0;}
    else if(!artQuietSince)artQuietSince=performance.now();
    else if(performance.now()-artQuietSince>=500){note('board-artwork-settled');$('#status').textContent='Board ready and chapter artwork indicator settled. Capture when optional network activity is quiet.';}
  }
}
async function capture(){
  if(!active||!frame.contentDocument)return;
  const win=frame.contentWindow,network=await server(),entries=[...win.performance.getEntriesByType('navigation'),...win.performance.getEntriesByType('resource')];
  report={format:'sacramentum-interface-entry-v1',label:network.label,run:network.run,capturedAt:new Date().toISOString(),
    environment:{userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},frame:{width:frame.clientWidth,height:frame.clientHeight},devicePixelRatio,origin:location.origin,storageBefore:originCheck,controlledAtCapture:Boolean(win.navigator.serviceWorker?.controller)},
    milestones,durations:journeyDurations(milestones),browserResources:summarizeResources(entries,location.origin),serverResponses:summarizeServerRequests(network.requests),
    interface:inspectInterface(win.document),artwork:{indicatorObserved:lastArt,failedImages:[...win.document.images].filter(img=>img.getAttribute('src')&&img.complete&&!img.naturalWidth).map(img=>new URL(img.src).pathname)},
    limitations:['Desktop browser unless separately tested on a physical device.','Server counts encoded response bodies, including worker/background requests; excludes HTTP/TLS headers and harness endpoints.','Resource Timing may omit worker-initiated fetches; zero transfer is not assumed to mean zero download.','Gzip/no-store local server, no network throttling; not production CDN latency.','Total journey elapsed includes human reading and click delay.','Artwork settled means the actual chapter progress region became quiet, not proof of GPU completion or all chapters offline.']};
  $('#report').value=JSON.stringify(report,null,2);$('#download').disabled=false;
}
$('#start').addEventListener('click',async()=>{
  if(active)return;
  try{
    const registrations=await navigator.serviceWorker?.getRegistrations?.()??[];
    const databases=await indexedDB.databases?.()??[];
    const localCampaign=Boolean(localStorage.getItem('sacramentum.campaign.v1'));
    const cacheNames=await caches.keys();
    originCheck={localCampaign,databases:databases.map(x=>x.name),serviceWorkers:registrations.length,caches:cacheNames};
    if(localCampaign||databases.length||registrations.length||cacheNames.length)throw new Error('This origin already has browser data. Nothing was deleted. Start a test server on a fresh unused port.');
    const response=await fetch('/__interface/start',{method:'POST'});if(!response.ok)throw new Error('Use the development interface-server.mjs, not the normal preview server.');
    await response.json();active=true;epoch=performance.now();$('#start').disabled=true;$('#size').disabled=true;$('#capture').disabled=false;
    const [width,height]=$('#size').value.split('x').map(Number);frame.style.width=width+'px';frame.style.height=height+'px';frame.hidden=false;frame.src='../index.html?interface-observation=1';
    frame.addEventListener('load',inspect);timer=setInterval(inspect,100);$('#status').textContent='Use the actual game in the frame. All network responses are recorded until you capture.';
  }catch(error){$('#status').textContent=error.message;}
});
$('#capture').addEventListener('click',capture);
$('#download').addEventListener('click',()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`interface-entry-${report.label}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
window.addEventListener('pagehide',()=>{clearInterval(timer);observer?.disconnect();});
