import {esc,roman} from './view-helpers.js';
import {createCampaignViews} from './campaign-views.js';
import {createPanels} from './panels.js';
import {createRenderScheduler,prepareShareCard} from './render-controller.js';
import {encounterView,selectedActor,selectedCommand} from './encounter-view.js';
import {createTurnReplay,turnReplaySteps} from './turn-replay.js';
import {createSessionGate,commitReplacement} from './session-gate.js';
import {watchEditionUpdates} from './offline-updates.js';
import * as Game from '../core/game.js';
import {CHAPTERS} from '../data/campaign.js';
import {CONFIG} from '../config.js';
import {drawBattle,pickTile,drawReignCard} from './renderer.js';
import {loadLocal,saveLocal,saveCode,restoreCode,listRecoverySaves,readRecoverySave,restoreRecovery,takeOverSaveSession,subscribeSaveChanges} from './storage.js';
import {sound,stopAudio} from './audio.js';
import {heroPortrait,chapterScene,loadArt} from './art.js';
import {snapshotEncounter,playEncounterMotion} from './motion.js';

const app=document.querySelector('#app'),modal=document.querySelector('#modal');
let state=null,screen='title',selected='hero',action=null,target=null,focusTile=null,formation='shield-wall',orderAction='advance',offline=false,saving=false,lastSaved='',toastTimer,saveProblem='',saveConflict=false,pendingImport=null,shareFile=null,feedback='',offlineProgress='',pendingMotion=null,pendingReplay=null,pendingRecovery=null,pendingNew=null;
const sessionGate=createSessionGate();
let memoryOnly=false;
let renderedLocation='',pendingScroll=false;
let settings={textScale:1,audio:false,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
try{settings={...settings,...JSON.parse(localStorage.getItem('sacramentum.settings')||'{}')};}catch{}
const {header,footer,titleView,meters,requirements,camp,promotion,ending}=createCampaignViews(()=>({state,screen,settings,saving,lastSaved,saveProblem,saveConflict,offline,offlineProgress}));
const {showNew,showMap,showLedger,showSettings,showHelp,showHistory,showJournal,showCharacter,showRestore}=createPanels(()=>({state,settings,offline,showModal,meters,requirements}));
function announce(text){document.querySelector('#announcement').textContent=text;}
function toast(text){
  announce(text);
  if(modal.open){let note=modal.querySelector('.modal-feedback');if(!note){note=document.createElement('p');note.className='notice modal-feedback';note.setAttribute('role','alert');modal.querySelector('.modal-body').prepend(note);}note.textContent=text;note.scrollIntoView({block:'nearest'});return;}
  feedback=text;const inline=document.querySelector('#action-feedback');if(inline){inline.textContent=text;inline.hidden=false;return;}
  let note=document.querySelector('.system-feedback');if(!note){note=document.createElement('p');note.className='system-feedback';note.setAttribute('role','status');document.querySelector('.topbar')?.after(note);}note.textContent=text;note.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>note.hidden=true,6500);
}
function selectedUnit(){return selectedActor(state,selected);}
function targets(){return action?Game.getTargets(state,selected,action):[];}
function command(){return selectedCommand({selected,action,target,formation,orderAction});}

function battle(){selected=selectedUnit().id;if(action&&!Game.getActions(state,selected).includes(action)){action=null;target=null;}return encounterView({state,selected,action,target,formation,orderAction,feedback,header,footer,requirements});}
const replay=createTurnReplay({
  show(text,index,total){const panel=document.querySelector('#turn-replay');if(!panel)return;panel.hidden=false;panel.innerHTML=`<span><small>TURN RESOLVED · ${index}/${total}</small>${esc(text)}</span><button class="ghost small" data-cmd="skip-replay">Skip</button>`;announce(text);},
  finish(){const panel=document.querySelector('#turn-replay');if(panel)panel.hidden=true;}
});
const renderScheduler=createRenderScheduler(requestAnimationFrame,({activeId})=>{
  if(pendingScroll){window.scrollTo({top:0,behavior:'instant'});pendingScroll=false;}paint();bindBoard();
  if(pendingMotion){playEncounterMotion(document.querySelector('#battle-board'),pendingMotion.before,pendingMotion.after,{reducedMotion:settings.reducedMotion});pendingMotion=null;}
  if(pendingReplay){replay.start(pendingReplay,settings.reducedMotion||document.hidden);pendingReplay=null;}
  if(activeId&&document.getElementById(activeId))document.getElementById(activeId).focus({preventScroll:true});
});
function render(){
  replay.stop();
  const viewKey=`${screen}:${state?.chapter}:${state?.phase}:${state?.encounter?.id||state?.encounterIndex}`;
  if(viewKey!==renderedLocation){pendingScroll=true;renderedLocation=viewKey;}
  document.documentElement.dataset.phase=screen==='title'?'title':state?.phase||'camp';
  document.documentElement.dataset.kind=state?.encounter?.kind||'';
  document.documentElement.dataset.stage=state?.phase==='epilogue'||(state?.chapter===12&&state?.phase==='promotion')?'imperial':'service';
  document.documentElement.dataset.reduced=settings.reducedMotion;
  document.documentElement.style.setProperty('--text-scale',settings.textScale||1);
  const activeId=document.activeElement?.id;
  app.innerHTML=screen==='title'?titleView():state?.phase==='encounter'?battle():state?.phase==='promotion'?promotion():state?.phase==='epilogue'?ending():camp();
  renderScheduler.schedule({activeId});
}
function paint(){if(screen!=='title'&&state?.encounter)drawBattle(document.querySelector('#battle-board'),state.encounter,selected,targets(),focusTile,state.chapter,{action,target});}
function bindBoard(){const board=document.querySelector('#battle-board');if(!board||!state.encounter)return;board.addEventListener('click',event=>{const p=pickTile(board,state.encounter,event.clientX,event.clientY);selectPoint(p);});board.addEventListener('keydown',event=>{const delta={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[event.key];if(delta){event.preventDefault();focusTile??={x:selectedUnit().x,y:selectedUnit().y};focusTile={x:Math.max(0,Math.min(state.encounter.width-1,focusTile.x+delta[0])),y:Math.max(0,Math.min(state.encounter.height-1,focusTile.y+delta[1]))};paint();announce(`Grid ${focusTile.x+1}${String.fromCharCode(65+focusTile.y)}. ${state.encounter.units.filter(u=>u.x===focusTile.x&&u.y===focusTile.y&&(u.resolve??u.hp)>0).map(u=>u.name).join(', ')}`);}if(event.key==='Enter'||event.key===' '){event.preventDefault();selectPoint(focusTile||selectedUnit());}if(event.key==='Escape'){action=null;target=null;render();}});}
function selectPoint(p){const e=state.encounter;if(p.x<0||p.y<0||p.x>=e.width||p.y>=e.height)return;focusTile={x:p.x,y:p.y};const t=targets().find(t=>t.x===p.x&&t.y===p.y);if(action&&t){target=t;render();announce(Game.preview(state,command()).message);return;}const u=e.units.find(u=>['player','ally'].includes(u.side)&&u.x===p.x&&u.y===p.y&&(u.resolve??u.hp)>0);if(u){selected=u.id;action=null;target=null;render();}else toast(action?'That tile is not a legal target. Choose a highlighted tile or use the target list.':`Tile ${p.x+1}${String.fromCharCode(65+p.y)}. Select a unit first.`);}
async function persist(){
  if(memoryOnly)return {ok:true};
  saving=true;
  const label=document.querySelector('.save-status');if(label)label.textContent='Saving…';
  try{lastSaved=await saveLocal(state);saveProblem='';saveConflict=false;return {ok:true};}
  catch(error){lastSaved='';saveProblem=error.message;saveConflict=error.code==='SAVE_CONFLICT';return {ok:false,error};}
  finally{saving=false;}
}
async function change(fn,{reset=false,tone='click',turn=false,silent=false}={}){
  if(sessionGate.busy)return;
  if(saveConflict){toast(saveProblem);return;}
  return sessionGate.run(async()=>{
    replay.stop();
    try{
      const before=snapshotEncounter(state.encounter),result=fn();
      if(result?.ok===false){toast(result.message);return;}
      if(reset){pendingMotion=null;feedback='';selected='hero';action=null;target=null;focusTile=null;}
      else{const after=snapshotEncounter(state.encounter);pendingMotion={before,after};if(turn)pendingReplay=turnReplaySteps(before,after,state.encounter?.turnEvents||[]);}
      const saved=await persist();
      if(tone)sound(tone,settings.audio);
      render();
      if(!saved.ok)toast(saveProblem);
      else if(result?.message&&!silent)toast(result.message);
    }catch(error){toast(`The action could not be completed: ${error.message}`);console.error(error);}
  });
}
async function replaceCampaign({load,save,message}){
  if(sessionGate.busy){toast('Please wait for the current save to finish.');return {ok:false};}
  return sessionGate.run(async()=>{
    let restored;
    saving=true;
    try{
      await commitReplacement({load,save,publish:candidate=>{restored=candidate;}});
      saving=false;
      useRestoredState(restored);
      toast(message);
      return {ok:true};
    }catch(error){
      saving=false;lastSaved='';saveProblem=error.message;saveConflict=saveConflict||error.code==='SAVE_CONFLICT';
      render();toast(error.message);
      return {ok:false,error};
    }finally{saving=false;}
  });
}
function showModal(title,body){modal.dataset.panel=title.toLowerCase().replace(/[^a-z]+/g,'-');modal.innerHTML=`<div class="modal-head"><h2>${esc(title)}</h2><button class="ghost" data-cmd="close-modal" aria-label="Close panel">✕</button></div><div class="modal-body">${body}</div>`;modal.scrollTop=0;if(!modal.open)modal.showModal();else modal.querySelector('[data-cmd="close-modal"]').focus({preventScroll:true});}
async function showExport(){const code=await saveCode(state);showModal('Keep a portable save',`<p>This code contains the entire campaign and current encounter checkpoint. Copy it somewhere safe, then restore it on any device. It contains your chosen name and game decisions; it is never uploaded by the game.</p><label for="save-code">Save code</label><textarea id="save-code" spellcheck="false" readonly>${esc(code)}</textarea><div class="settings-controls"><button class="primary" data-cmd="copy-code">Copy save code</button><button data-cmd="download-code">Download save text</button></div>`);}
async function showShare(){
  shareFile=null;
  showModal('Your reign, remembered',`<p>A keepsake of your reign, without character fates or plot twists. The game only shares when you choose the device’s share menu.</p><canvas id="reign-card" class="share-preview" role="img" aria-label="Your reign card"></canvas><div class="settings-controls"><button class="primary" data-cmd="download-card" disabled>Preparing card…</button><button data-cmd="share-card" disabled>Preparing card…</button></div>`);
  const canvas=document.querySelector('#reign-card');
  const summary={name:state.name,route:state.route,url:CONFIG.siteUrl||new URL('./',location.href).href,choices:[state.decisions.ch9==='mercy'?'Mercy after victory':'Order after victory',state.decisions.ch4==='withdraw'?'A commander who preserved the ranks':'A commander who held the line',state.decisions.ch11==='independent'?'A voice earned by service':'Power built on alliances']};
  const file=await prepareShareCard({canvas,summary,loadPortrait:()=>loadArt(heroPortrait('Augustus')),loadScene:()=>loadArt(chapterScene(12)),draw:drawReignCard,downloadButton:modal.querySelector('[data-cmd="download-card"]'),shareButton:modal.querySelector('[data-cmd="share-card"]'),makeFile:blob=>new File([blob],'sacramentum-reign.png',{type:'image/png'})});
  if(canvas.isConnected)shareFile=file;
}
async function showRecovery(){
  try{
    const entries=await listRecoverySaves();
    showModal('Recover an earlier chronicle',`<p>The three most recent distinct checkpoints and replaced campaigns are kept on this device. Inspect a record before restoring it. Your current chronicle will become a recovery record.</p>${entries.length?entries.map(entry=>`<article class="recovery-entry"><h3>${esc(entry.name)}</h3><p>Chapter ${roman(entry.chapter)} · ${esc(entry.rank)} · ${esc(entry.phase)}${entry.encounter?` · ${esc(entry.encounter)}`:''}<br>${esc(new Date(entry.savedAt).toLocaleString())}</p><button data-cmd="preview-recovery" data-id="${esc(entry.id)}" data-sequence="${entry.currentSequence}">Inspect this checkpoint</button></article>`).join(''):'<p class="notice">No earlier checkpoints yet. Recovery records are created as your campaign advances and when you replace a chronicle.</p>'}`);
  }catch(error){toast(error.message);}
}
async function previewRecovery(id,sequence){
  try{
    const restored=await readRecoverySave(id);pendingRecovery={id,sequence};
    showModal('Recovery checkpoint verified',`<h3>${esc(restored.name)}</h3><p>Chapter ${roman(restored.chapter)} · ${esc(restored.rank)}<br>${restored.history.length} completed encounters · ${esc(restored.phase)}</p><p>The current chronicle will be archived before this record takes its place. If another tab changes the save while this panel is open, restoration will stop for a fresh review.</p><button class="primary" data-cmd="confirm-recovery">Restore this checkpoint</button> <button data-cmd="recovery">Back to recovery records</button>`);
  }catch(error){toast(error.message);}
}
function useRestoredState(restored){
  memoryOnly=false;
  renderedLocation='';state=restored;screen='game';selected='hero';action=null;target=null;focusTile=null;pendingMotion=null;pendingReplay=null;saveProblem='';saveConflict=false;lastSaved=new Date().toISOString();modal.close();render();
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
document.addEventListener('click',async event=>{const b=event.target.closest('[data-cmd]');if(!b||b.disabled)return;const id=b.dataset.id,cmd=b.dataset.cmd;switch(cmd){case 'retry-offline':{const registration=await navigator.serviceWorker.getRegistration();if(registration?.active){registration.active.postMessage('cache-campaign');toast('Downloading the remaining chronicle. Progress appears in the game header.');}else toast('Offline content is available from the production build.');break;}
case 'close-modal':modal.close();break;
case 'home':screen='title';render();break;
case 'new':showNew();break;
case 'begin':{
  const candidate=Game.newGame(document.querySelector('#name-input').value);
  const result=await replaceCampaign({load:async()=>candidate,save:value=>saveLocal(value,{replace:true}),message:'Chapter I. You are a Tiro: a recruit in training.'});
  if(result.error?.code==='SAVE_UNAVAILABLE'){
    pendingNew=candidate;
    showModal('Play without autosave?',`<p>Safe browser storage is unavailable. You can play in this tab and export a save code before closing it. Your previous saved chronicle will remain on this device.</p><button class="primary" data-cmd="begin-unsaved">Play in memory</button> <button data-cmd="close-modal">Cancel</button>`);
  }
  break;
}
case 'begin-unsaved':if(pendingNew&&!sessionGate.busy){const candidate=pendingNew;pendingNew=null;useRestoredState(candidate);memoryOnly=true;lastSaved='';saveProblem='Playing in memory. Export a save code before closing this tab.';render();toast(saveProblem);}break;
case 'continue':screen='game';render();break;
case 'map':showMap();break;
case 'chapter-info':showMap(Number(id));break;
case 'history':showHistory();break;
case 'settings':showSettings();break;
case 'help':showHelp();break;
case 'ledger':showLedger();break;
case 'journal':showJournal();break;
case 'character':showCharacter();break;
case 'privacy':showModal('Your game stays with you','<p>Sacramentum has no account, advertising, analytics, or game server. Saves, settings and offline content stay in this browser. The hosting provider may keep ordinary access logs.</p><p>A save code contains your chosen name and game decisions. A reign card contains your name, broad choices and the game address. Nothing is sent until you copy, download or choose a destination in your device’s share menu.</p><p>Starting a new chronicle replaces the campaign in this browser. Clearing site data removes all local saves. Keep a portable save code if your progress matters to you.</p>');break;
case 'next-story':await change(()=>Game.setStoryProgress(state,Math.min(Game.storyProgress(state)+1,Game.storyLines(state).length-1)),{tone:null,silent:true});break;
case 'previous-story':await change(()=>Game.setStoryProgress(state,Math.max(0,Game.storyProgress(state)-1)),{tone:null,silent:true});break;
case 'choose':await change(()=>Game.choose(state,id));break;
case 'oath':await change(()=>Game.swearOath(state));break;
case 'prepare':await change(()=>Game.prepare(state,id));break;
case 'negotiate':await change(()=>Game.negotiate(state,id));break;
case 'stratagem':await change(()=>Game.selectStratagem(state,id));break;
case 'judge':await change(()=>Game.judge(state,id));break;
case 'allocate':await change(()=>Game.allocate(state,{river:Number(document.querySelector('#river').value),farms:Number(document.querySelector('#farms').value),town:Number(document.querySelector('#town').value)}));break;
case 'route':await change(()=>{state.route=id;return {ok:true,message:'Confrontation approach selected. Enter the field when ready.'};});break;
case 'start':await change(()=>Game.startEncounter(state,state.chapter===12?{route:state.route||'backer'}:{}),{reset:true});break;
case 'unit':selected=id;action=null;target=null;render();break;
case 'action':{action=id;target=null;const ts=targets();if(ts.length===1)target=ts[0];render();break;}
case 'confirm':{const c=command();if(c)await change(()=>Game.act(state,c),{tone:action});target=null;action=null;render();break;}
case 'skip-replay':replay.stop();break;
case 'end-turn':await change(()=>Game.endTurn(state),{tone:'turn',turn:true});action=null;target=null;render();break;
case 'retry':showModal('Retry this encounter?',`<p>Restore the complete encounter-start checkpoint: health, positions, random seed, meters, inventory and staged promises. Your earlier campaign decisions stay as they were.</p><button class="primary" data-cmd="retry-confirm">Restore checkpoint</button> <button data-cmd="close-modal">Keep playing</button>`);break;
case 'retry-confirm':modal.close();await change(()=>Game.retry(state),{reset:true});break;
case 'commit':await change(()=>Game.commitEncounter(state),{reset:true,tone:'promotion'});break;
case 'advance':await change(()=>Game.advanceChapter(state),{reset:true,tone:'promotion'});break;
case 'fallback':await change(()=>Game.acceptFallback(state),{reset:true});break;
case 'replay':if(Game.replayLastEncounter)await change(()=>Game.replayLastEncounter(state),{reset:true});else toast('Use the encounter checkpoint save to return and demonstrate the missing capability.');break;
case 'settle-honour':case 'settle-break':await change(()=>Game.settleObligation(state,id,cmd==='settle-honour'));showLedger();break;
case 'export':await showExport();break;
case 'restore':showRestore();break;
case 'recovery':await showRecovery();break;
case 'preview-recovery':await previewRecovery(id,Number(b.dataset.sequence));break;
case 'confirm-recovery':if(pendingRecovery){const recovery=pendingRecovery;const result=await replaceCampaign({load:()=>restoreRecovery(recovery.id,{confirmed:true,expectedSequence:recovery.sequence}),message:'Earlier checkpoint restored. The displaced chronicle is in recovery records.'});if(result.ok)pendingRecovery=null;}break;
case 'takeover':showModal('Continue in this tab',`<p>This will load the latest saved chronicle and make this tab the current writer. Unsaved changes in this tab will be replaced. Export them first if you need to keep them.</p><button data-cmd="export">Export this tab’s chronicle</button> <button class="primary" data-cmd="confirm-takeover">Load latest and continue here</button>`);break;
case 'confirm-takeover':await replaceCampaign({load:()=>takeOverSaveSession({confirmed:true}),message:'Latest chronicle loaded. This tab can now save safely.'});break;
case 'copy-code':try{await navigator.clipboard.writeText(document.querySelector('#save-code').value);toast('Save code copied.');}catch{document.querySelector('#save-code').select();toast('Select and copy the highlighted save code.');}break;
case 'download-code':download(new Blob([document.querySelector('#save-code').value],{type:'text/plain'}),'sacramentum-save.txt');break;
case 'import-code':try{const imported=await restoreCode(document.querySelector('#restore-code').value);pendingImport=imported;showModal('Save code verified',`<p><strong>${esc(imported.name)}</strong><br>Chapter ${roman(imported.chapter)}: ${esc(CHAPTERS[imported.chapter-1].title)}<br>${esc(imported.rank)} · ${imported.history.length} completed encounters</p><p>Restore this verified chronicle and replace the current local campaign?</p><button class="primary" data-cmd="confirm-import">Restore this chronicle</button> <button data-cmd="close-modal">Cancel</button>`);}catch(error){toast(error.message);}break;
case 'confirm-import':if(pendingImport){const candidate=pendingImport;const result=await replaceCampaign({load:async()=>candidate,save:value=>saveLocal(value,{replace:true}),message:'Chronicle restored. Chapter access was checked from earned milestones.'});if(result.ok)pendingImport=null;}break;
case 'share':await showShare();break;
case 'download-card':document.querySelector('#reign-card').toBlob(blob=>download(blob,'sacramentum-reign.png'));break;
case 'share-card':{const file=shareFile;if(!file){toast('The card is still being prepared.');break;}try{if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'My Sacramentum reign'});else{download(file,'sacramentum-reign.png');toast('Card downloaded. Share it using your preferred app.');}}catch(error){if(error.name!=='AbortError')toast('Sharing was unavailable. Use Download card.');}break;}}});
document.addEventListener('change',async event=>{if(event.target.id==='unit-select'){selected=event.target.value;action=null;target=null;render();}if(event.target.id==='action-select'){action=event.target.value||null;target=null;const ts=targets();if(ts.length===1)target=ts[0];render();}if(event.target.id==='restore-file'&&event.target.files?.[0]){const file=event.target.files[0];if(file.size>3000000){toast('Save file is too large.');return;}document.querySelector('#restore-code').value=await file.text();}if(event.target.id==='text-size'){settings.textScale=Number(event.target.value);try{localStorage.setItem('sacramentum.settings',JSON.stringify(settings));}catch{}render();}if(event.target.id==='target-select'){const i=event.target.value;target=i===''?null:targets()[Number(i)];render();if(target)announce(Game.preview(state,command()).message);}if(event.target.id==='formation-kind'){formation=event.target.value;render();}if(event.target.id==='order-kind'){orderAction=event.target.value;render();}if(['audio-setting','motion-setting'].includes(event.target.id)){settings[event.target.id==='audio-setting'?'audio':'reducedMotion']=event.target.checked;try{localStorage.setItem('sacramentum.settings',JSON.stringify(settings));}catch{}document.documentElement.dataset.reduced=settings.reducedMotion;if(settings.audio)sound('click',true);else stopAudio();}});
window.addEventListener('resize',()=>requestAnimationFrame(paint));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    stopAudio();replay.stop();
    if(state&&!memoryOnly&&!saving&&!saveConflict&&!sessionGate.busy)sessionGate.run(async()=>{await persist();render();}).catch(error=>{if(error.code!=='SESSION_BUSY')console.error(error);});
  }else render();
});
subscribeSaveChanges(()=>{if(state&&!memoryOnly){saveConflict=true;saveProblem='The chronicle changed in another tab. Load the latest save to continue here, or export this tab’s progress.';lastSaved='';render();announce(saveProblem);}});
const loaded=await loadLocal();state=loaded.state;render();if(loaded.error)toast(loaded.error);
if('serviceWorker'in navigator){navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='offline-ready'){offline=true;offlineProgress='';render();}else if(event.data?.type==='offline-progress'){offlineProgress=`Preparing offline chronicle · ${event.data.percent}%`;let status=document.querySelector('.offline-banner');if(!status){status=document.createElement('div');status.className='offline-banner';status.setAttribute('role','status');document.querySelector('.topbar')?.after(status);}status.textContent=offlineProgress;}else if(event.data?.type==='offline-error'){offlineProgress=event.data.message;render();}});try{const hadController=Boolean(navigator.serviceWorker.controller);const registration=await navigator.serviceWorker.register('./sw.js');watchEditionUpdates(registration,{hadController,onReady:()=>toast('A new edition is downloaded. Close and reopen the game after saving to use it.')});const ready=await navigator.serviceWorker.ready;ready.active?.postMessage('offline-status');const warm=()=>ready.active?.postMessage('cache-campaign');if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:3000});else setTimeout(warm,1200);}catch{/* Source preview has no generated worker; production build includes it. */}}
