// Development-only measurement helpers. No production imports or state access.
export function summarizeResources(entries,origin){
  const resources=entries.filter(entry=>entry.entryType==='resource'||entry.entryType==='navigation').map(entry=>({
    path:new URL(entry.name,origin).pathname,type:entry.initiatorType||'navigation',startMs:entry.startTime,
    endMs:entry.responseEnd,durationMs:entry.duration,transferBytes:entry.transferSize||0,
    encodedBodyBytes:entry.encodedBodySize||0,decodedBodyBytes:entry.decodedBodySize||0,
    workerStartMs:entry.workerStart||0,responseStatus:entry.responseStatus??null
  }));
  return {count:resources.length,transferBytes:resources.reduce((n,r)=>n+r.transferBytes,0),
    encodedBodyBytes:resources.reduce((n,r)=>n+r.encodedBodyBytes,0),
    decodedBodyBytes:resources.reduce((n,r)=>n+r.decodedBodyBytes,0),
    zeroTransferEntries:resources.filter(r=>r.transferBytes===0).length,resources};
}
export function summarizeServerRequests(requests){
  const game=requests.filter(r=>!r.path.startsWith('/__interface/')&&!r.path.startsWith('/tests/'));
  return {requests:game.length,encodedBodyBytes:game.reduce((n,r)=>n+r.encodedBodyBytes,0),
    uncompressedBodyBytes:game.reduce((n,r)=>n+r.uncompressedBodyBytes,0),
    failed:game.filter(r=>r.status>=400).map(r=>({path:r.path,status:r.status})),
    lastResponseMs:Math.max(0,...game.map(r=>r.finishedMs)),items:game};
}
export function journeyDurations(milestones){
  const at=key=>milestones.find(item=>item.name===key)?.atMs;
  const difference=(end,start)=>at(end)===undefined||at(start)===undefined?null:Math.max(0,at(end)-at(start));
  return {landingReadyMs:at('landing-ready')??null,beginToChapterMs:difference('chapter-visible','begin-click'),
    enterToBoardMs:difference('board-visible','enter-click'),
    enterToArtworkSettledMs:difference('board-artwork-settled','enter-click'),
    observedLandingToBoardMs:at('board-artwork-settled')??at('board-visible')??null,
    humanDwellIncluded:true};
}
export function inspectInterface(doc){
  const visible=element=>Boolean(element.getClientRects().length)&&!element.closest('[hidden]');
  const controls=[...doc.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href]')].filter(visible);
  const name=element=>element.getAttribute('aria-label')||element.getAttribute('aria-labelledby')?.split(/\s+/).map(id=>doc.getElementById(id)?.textContent||'').join(' ')||[...(element.labels||[])].map(l=>l.textContent).join(' ')||element.textContent||element.getAttribute('title')||'';
  const ids=[...doc.querySelectorAll('[id]')].map(element=>element.id);
  return {width:doc.documentElement.clientWidth,scrollWidth:doc.documentElement.scrollWidth,
    duplicateIds:[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))],
    unnamedControls:controls.filter(element=>!name(element).trim()).map(element=>({tag:element.tagName,id:element.id,command:element.dataset.cmd||null})),
    brokenFragments:[...doc.querySelectorAll('a[href^="#"]')].filter(a=>a.getAttribute('href')!=='#'&&!doc.getElementById(a.hash.slice(1))).map(a=>a.getAttribute('href')),
    primaryTargets:controls.filter(element=>element.matches('button.primary,#confirm-action,#end-turn')).map(element=>{const r=element.getBoundingClientRect();return {name:name(element).trim(),width:r.width,height:r.height,withinViewport:r.left>=0&&r.right<=doc.documentElement.clientWidth&&r.top>=0&&r.bottom<=doc.documentElement.clientHeight};}),
    smallControls:controls.filter(element=>{const r=element.getBoundingClientRect();return r.height<44||r.width<44;}).map(element=>({name:name(element).trim(),tag:element.tagName,id:element.id})),
    scope:'Visible DOM contracts and geometry only; not a full accessibility or contrast audit.'};
}
