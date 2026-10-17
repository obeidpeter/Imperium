import {chapterHas3D,createBattleStageController} from './battle-stage-controller.js';
import {esc,roman} from './view-helpers.js';
import {createCampaignViews} from './campaign-views.js';
import {createPanels} from './panels.js';
import {createRenderScheduler,prepareShareCard} from './render-controller.js';
import {encounterView,selectedActor,selectedCommand} from './encounter-view.js';
import {directIntent,nextReadyUnit,keyboardAction,visibleUnitAt,samePoint} from './direct-controls.js';
import {terrainLabel} from './tactical-intel.js';
import {createTurnReplay,turnReplaySteps} from './turn-replay.js';
import {createSessionGate,commitReplacement} from './session-gate.js';
import {watchEditionUpdates} from './offline-updates.js';
import {GRAPHICS_MODES,createGraphicsQuality,defaultGraphicsMode} from './graphics-quality.js';
import * as Game from '../core/game.js';
import {CHAPTERS} from '../data/campaign.js';
import {CONFIG} from '../config.js';
import {drawBattle,pickBattlePoint,drawReignCard} from './renderer.js';
import {clearBattleCache} from './battle-art.js';
import {loadTacticalArt} from './unit-sprites.js';
import {loadLocal,saveLocal,saveCode,restoreCode,listRecoverySaves,readRecoverySave,restoreRecovery,takeOverSaveSession,subscribeSaveChanges} from './storage.js';
import {sound,stopAudio,audioLevel} from './audio.js';
import {heroPortrait,chapterScene,loadArt,prefetchChapter} from './art.js';
import {snapshotEncounter,playEncounterMotion} from './motion.js';
import {playAmbientScene} from './ambient.js';
import {setupSiteMedia} from './site-media.js';

const app=document.querySelector('#app'),modal=document.querySelector('#modal');
let state=null,screen='title',selected='hero',action=null,target=null,focusTile=null,formation='shield-wall',orderAction='advance',offline=false,saving=false,lastSaved='',toastTimer,saveProblem='',saveConflict=false,pendingImport=null,shareFile=null,feedback='',offlineProgress='',pendingMotion=null,pendingReplay=null,pendingRecovery=null,pendingNew=null;
const sessionGate=createSessionGate();
let memoryOnly=false;
let cancelMotion=null,currentAnimation=null,currentChapterOffline=false,artProgress='',offlineWorker=null,fullDownloadRequested=false,loadedArtChapter=0,artRequest=0,cachedChapterRequest=0;
let cancelAmbient=null,ambientTime=null;
let renderedLocation='',pendingScroll=false;
let cleanupSiteMedia=()=>{};
let hoverTile=null,showGrid=false,failed3D=false;
const battleStage=createBattleStageController({onError:message=>{failed3D=true;render();toast('3D view unavailable. The tactical view is ready; your progress is preserved. '+message);}});
function uses3D(){return screen!=='title'&&chapterHas3D(state)&&settings.battleView!=='2d'&&!failed3D;}
function boardHover(point){hoverTile=point;const label=document.querySelector('#board-hover'),u=visibleUnitAt(state.encounter,point);if(label)label.textContent=point?`${u?u.name+' · ':''}${terrainLabel(state.encounter,point)} · ${point.x+1}${String.fromCharCode(65+point.y)}`:'';}
let settings={battleView:'3d',textScale:1,audio:false,audioVolume:.5,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,quality:defaultGraphicsMode({saveData:navigator.connection?.saveData,deviceMemory:navigator.deviceMemory})};
// Preserve the legacy settings key so existing players keep their preferences.
try{settings={...settings,...JSON.parse(localStorage.getItem('sacramentum.settings')||'{}')};}catch{}
if(!Object.hasOwn(GRAPHICS_MODES,settings.quality))settings.quality=defaultGraphicsMode({saveData:navigator.connection?.saveData,deviceMemory:navigator.deviceMemory});
settings.audioVolume=audioLevel(settings.audioVolume);
function saveSettings(){try{localStorage.setItem('sacramentum.settings',JSON.stringify(settings));}catch{}}
const graphics=createGraphicsQuality({mode:settings.quality,onChange:({mode,reason})=>{battleStage.quality(mode);settings.quality=mode;saveSettings();document.documentElement.dataset.quality=mode;const control=document.querySelector('#graphics-quality');if(control)control.value=mode;if(reason==='measured-cost')announce(`Graphics changed to ${mode} after repeated slow rendering. You can choose a different quality in Settings.`);}});
const {header,footer,titleView,meters,requirements,camp,promotion,ending}=createCampaignViews(()=>({state,screen,settings,saving,lastSaved,saveProblem,saveConflict,offline,offlineProgress,currentChapterOffline,artProgress}));
const {showNew,showMap,showLedger,showSettings,showHelp,showHistory,showJournal,showCharacter,showRestore,showNavigation,showCredits,showPrivacy,showExportCode,showRecoveryRecords,showRecoveryVerified,showImportVerified,showStorageUnavailable,showRetry,showTakeover,showSharePreview}=createPanels(()=>({state,screen,settings,offline,currentChapterOffline,offlineProgress,showModal,meters,requirements}));
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

function battle(){selected=selectedUnit().id;if(action&&!Game.getActions(state,selected).includes(action)){action=null;target=null;}return encounterView({view3D:uses3D(),can3D:chapterHas3D(state),state,selected,action,target,focusTile,showGrid,formation,orderAction,feedback,header,footer,requirements,saving,lastSaved,saveProblem,saveConflict,artProgress,offlineProgress});}
const replay=createTurnReplay({
  show(text,index,total){const panel=document.querySelector('#turn-replay');if(!panel)return;panel.hidden=false;panel.innerHTML=`<span><small>TURN RESOLVED · ${index}/${total}</small>${esc(text)}</span><button class="ghost small" data-cmd="skip-replay">Skip</button>`;announce(text);},
  finish(){const panel=document.querySelector('#turn-replay');if(panel)panel.hidden=true;}
});
const renderScheduler=createRenderScheduler(requestAnimationFrame,({activeId})=>{
  if(pendingScroll){window.scrollTo({top:0,behavior:'instant'});pendingScroll=false;}paint();bindBoard();
  const canvas=document.querySelector('#battle-board'),encounter=state?.encounter;
  const motionQueued=Boolean(pendingMotion);
  if(canvas&&encounter&&!uses3D())loadTacticalArt(encounter).then(()=>{
    if(!canvas.isConnected||document.querySelector('#battle-board')!==canvas||state?.encounter!==encounter)return;
    paint(currentAnimation);
    if(!motionQueued&&!currentAnimation&&!pendingMotion)startAtmosphere(canvas,encounter);
  });
  if(pendingMotion&&!uses3D()){const motion=pendingMotion;pendingMotion=null;cancelMotion=playEncounterMotion(canvas,motion.before,motion.after,{command:motion.command,reducedMotion:settings.reducedMotion||modal.open,quality:graphics.mode,renderFrame:frame=>{if(canvas?.isConnected&&document.querySelector('#battle-board')===canvas){currentAnimation=frame;paint(frame);if(frame===null&&cancelMotion)startAtmosphere(canvas,encounter);}}});}
  if(pendingReplay){replay.start(pendingReplay,settings.reducedMotion||document.hidden);pendingReplay=null;}
  if(activeId&&document.getElementById(activeId))document.getElementById(activeId).focus({preventScroll:true});
});
function render(){
  cleanupSiteMedia();
  stopMotion();
  replay.stop();
  const viewKey=`${screen}:${state?.chapter}:${state?.phase}:${state?.encounter?.id||state?.encounterIndex}`;
  const openPanels=viewKey===renderedLocation?[...app.querySelectorAll('.command-stage details[id][open]')].map(node=>node.id):[];
  if(viewKey!==renderedLocation){pendingScroll=true;renderedLocation=viewKey;}
  document.documentElement.dataset.phase=screen==='title'?'title':state?.phase||'camp';
  document.documentElement.dataset.kind=state?.encounter?.kind||'';
  document.documentElement.dataset.stage=state?.phase==='epilogue'||(state?.chapter===12&&state?.phase==='promotion')?'imperial':'service';
  document.documentElement.dataset.reduced=settings.reducedMotion;
  document.documentElement.dataset.quality=graphics.mode;
  document.documentElement.style.setProperty('--text-scale',settings.textScale||1);
  const activeId=document.activeElement?.id;
  app.innerHTML=screen==='title'?titleView():state?.phase==='encounter'?battle():state?.phase==='promotion'?promotion():state?.phase==='epilogue'?ending():camp();
  if(uses3D()){const motion=pendingMotion;pendingMotion=null;battleStage.mount(document.querySelector('#battle-board'),{encounter:state.encounter,chapter:state.chapter,rank:state.rank,selected,targets:targets(),target:target||focusTile,grid:showGrid,quality:graphics.mode,reducedMotion:settings.reducedMotion,audio:settings.audio,audioVolume:settings.audioVolume,paused:modal.open,onPick:p=>{if(p)selectPoint(p);},onHover:boardHover,onFrame:cost=>graphics.recordFrame(cost,{hidden:document.hidden,active:!modal.open}),motion});}else battleStage.release();
  for(const id of openPanels){const panel=document.getElementById(id);if(panel)panel.open=true;}
  if(screen==='title')cleanupSiteMedia=setupSiteMedia(app);
  prepareChapterArt();
  renderScheduler.schedule({activeId});
}
function stopMotion(){battleStage.stop();const stop=cancelMotion,stopAmbient=cancelAmbient;cancelMotion=null;cancelAmbient=null;if(stop)stop();currentAnimation=null;if(stopAmbient)stopAmbient();ambientTime=null;}
function startAtmosphere(canvas=document.querySelector('#battle-board'),encounter=state?.encounter){
  if(uses3D()||!canvas?.isConnected||modal.open||document.hidden||state?.encounter!==encounter)return;
  cancelAmbient?.();
  cancelAmbient=playAmbientScene(canvas,{continuous:true,reducedMotion:settings.reducedMotion,quality:graphics.mode,onFrame:time=>{
    ambientTime=time;if(canvas.isConnected&&document.querySelector('#battle-board')===canvas&&state?.encounter===encounter&&!currentAnimation)paint();
  }});
}
function paint(animation=null){
  if(document.hidden||screen==='title'||!state?.encounter)return;
  const canvas=document.querySelector('#battle-board');if(!canvas?.isConnected)return;
  if(uses3D())return;
  const started=performance.now();
  drawBattle(canvas,state.encounter,selected,targets(),focusTile,state.chapter,{action,target,hover:hoverTile,grid:showGrid,animation,ambientTime,quality:graphics.mode,maxPixelRatio:graphics.profile.maxPixelRatio});
  graphics.recordFrame(performance.now()-started,{hidden:document.hidden,active:true});
}
function updateLoadingStatus(){
  const regions=[['art-loading-status',artProgress],['offline-status',offline?'✓ ALL CHAPTERS AVAILABLE OFFLINE':offlineProgress||(currentChapterOffline&&state?`✓ CHAPTER ${roman(state.chapter)} AVAILABLE OFFLINE`:'')]];
  for(const [id,text]of regions){let node=document.getElementById(id);if(!node&&text){node=document.createElement('div');node.id=id;node.className='offline-banner';node.setAttribute('role','status');document.querySelector('.topbar')?.after(node);}if(node){node.textContent=text;node.hidden=!text;}}
  const progress=document.querySelector('#settings-offline-status');if(progress)progress.textContent=offline?'All twelve chapters are available offline.':offlineProgress||(currentChapterOffline&&state?`Chapter ${roman(state.chapter)} is available offline. Later chapters download as you reach them.`:'The current chapter is not fully cached yet.');
}
function requestCurrentChapter({allowTitle=false}={}){
  if(!offlineWorker||(screen==='title'&&!allowTitle)||!state||cachedChapterRequest===state.chapter)return;
  cachedChapterRequest=state.chapter;
  offlineWorker.postMessage({type:'cache-chapter',chapter:state.chapter});
  offlineWorker.postMessage({type:'offline-status',chapter:state.chapter});
}
function prepareChapterArt({retry=false,allowTitle=false}={}){
  if((screen==='title'&&!allowTitle)||!state)return;
  const chapter=state.chapter;
  if(loadedArtChapter!==chapter){
    loadedArtChapter=chapter;currentChapterOffline=offline;const request=++artRequest;
    prefetchChapter(chapter,{retry,shouldPrefetchNext:()=>request===artRequest&&screen!=='title'&&!document.hidden,onProgress:progress=>{if(request!==artRequest)return;artProgress=progress.completed<progress.total?`Preparing chapter artwork · ${progress.completed}/${progress.total}`:progress.failed?'Some artwork is unavailable. Readable tactical symbols remain available.':'';updateLoadingStatus();}}).then(()=>{if(request===artRequest)offlineWorker?.postMessage({type:'offline-status',chapter});});
  }
  requestCurrentChapter({allowTitle});updateLoadingStatus();
}
function bindBoard(){
  const board=document.querySelector('#battle-board');if(!board||!state.encounter)return;
  if(board.dataset.bound)return;board.dataset.bound='true';
  if(!uses3D())board.addEventListener('click',event=>selectPoint(pickBattlePoint(board,state.encounter,event.clientX,event.clientY)));
  board.addEventListener('contextmenu',event=>{event.preventDefault();cancelCommand();});
  let queued=false;
  if(!uses3D())board.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')return;
    const p=pickBattlePoint(board,state.encounter,event.clientX,event.clientY),e=state.encounter;
    const next=p.x>=0&&p.y>=0&&p.x<e.width&&p.y<e.height?p:null;
    if(samePoint(hoverTile,next)||(!hoverTile&&!next))return;hoverTile=next;
    if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;if(!board.isConnected)return;
      const label=document.querySelector('#board-hover'),u=visibleUnitAt(e,hoverTile);
      if(label)label.textContent=hoverTile?`${u?u.name+' · ':''}${terrainLabel(e,hoverTile)} · ${hoverTile.x+1}${String.fromCharCode(65+hoverTile.y)}`:'';
      board.style.cursor=hoverTile?'pointer':'default';paint(currentAnimation);
    });}
  });
  board.addEventListener('pointerleave',()=>{hoverTile=null;const label=document.querySelector('#board-hover');if(label)label.textContent='';paint(currentAnimation);});
  board.addEventListener('keydown',event=>{
    const delta={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[event.key];
    if(delta){event.preventDefault();focusTile??={x:selectedUnit().x,y:selectedUnit().y};focusTile={x:Math.max(0,Math.min(state.encounter.width-1,focusTile.x+delta[0])),y:Math.max(0,Math.min(state.encounter.height-1,focusTile.y+delta[1]))};if(uses3D())battleStage.stage?.setSelection(selected,targets(),focusTile);paint();announce(`Grid ${focusTile.x+1}${String.fromCharCode(65+focusTile.y)}. ${visibleUnitAt(state.encounter,focusTile)?.name||terrainLabel(state.encounter,focusTile)}`);}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();selectPoint(focusTile||selectedUnit());}
  });
}
async function confirmCommand(){const c=command();if(c&&Game.preview(state,c).ok)await change(()=>Game.act(state,c),{tone:action,command:c,clearSelection:true});}
function chooseAction(next){
  action=next;target=null;
  const legal=targets(),atFocus=legal.find(t=>samePoint(t,focusTile));
  if(atFocus)target=atFocus;else if(legal.length===1)target=legal[0];
  render();if(target)announce(Game.preview(state,command()).message);
}
function cancelCommand(){action=null;target=null;feedback='';render();announce('Command cancelled. No action was spent.');}
function selectPoint(point){
  if(sessionGate.busy)return;
  const intent=directIntent(state,{selected,action,target,point});if(intent.kind==='none')return;
  focusTile={x:point.x,y:point.y};hoverTile=null;
  if(intent.kind==='confirm'){confirmCommand();return;}
  if(intent.kind==='select'){selected=intent.unitId;action=null;target=null;feedback='';render();return;}
  if(intent.kind==='preview'){action=intent.action;target=intent.target;feedback='';render();announce(Game.preview(state,command()).message+' Activate the target again, or use Confirm.');return;}
  action=null;target=null;render();
  const u=visibleUnitAt(state.encounter,point);announce(u?`${u.name}. ${u.intent||'Choose an action or move closer.'}`:`${terrainLabel(state.encounter,point)}. Outside this unit’s movement range.`);
}
async function persist(){
  if(memoryOnly)return {ok:true};
  saving=true;
  const label=document.querySelector('.save-status');if(label)label.textContent='Saving…';
  try{lastSaved=await saveLocal(state);saveProblem='';saveConflict=false;return {ok:true};}
  catch(error){lastSaved='';saveProblem=error.message;saveConflict=error.code==='SAVE_CONFLICT';return {ok:false,error};}
  finally{saving=false;}
}
async function change(fn,{reset=false,tone='click',turn=false,silent=false,command:issuedCommand=null,clearSelection=false}={}){
  if(sessionGate.busy)return;
  if(saveConflict){toast(saveProblem);return;}
  return sessionGate.run(async()=>{
    stopMotion();
    replay.stop();
    try{
      const before=snapshotEncounter(state.encounter),commandSnapshot=issuedCommand?structuredClone(issuedCommand):null,result=fn();
      if(result?.ok===false){toast(result.message);return;}
      if(reset){pendingMotion=null;feedback='';selected='hero';action=null;target=null;focusTile=null;}
      else{const after=snapshotEncounter(state.encounter);pendingMotion={before,after,command:commandSnapshot};if(turn)pendingReplay=turnReplaySteps(before,after,state.encounter?.turnEvents||[]);}
      if(clearSelection){action=null;target=null;}
      const saved=await persist();
      if(tone&&!(uses3D()&&issuedCommand)){const status=state.encounter?.status;const cue=before?.status==='active'&&status&&status!=='active'?(status==='won'?'victory':'defeat'):tone;sound(cue,settings.audio,settings.audioVolume);}
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
let modalReturn=null;
function showModal(title,body){
  stopMotion();pendingMotion=null;replay.stop();battleStage.pause(true);
  if(!modal.open){const el=document.activeElement;modalReturn={element:el,cmd:el?.dataset?.cmd,id:el?.id};}
  modal.dataset.panel=title.toLowerCase().replace(/[^a-z]+/g,'-');
  modal.setAttribute('aria-labelledby','panel-title');modal.removeAttribute('aria-label');
  modal.innerHTML=`<div class="modal-head"><div><span class="eyebrow">IMPERIUM · YOUR CHRONICLE</span><h2 id="panel-title" tabindex="-1">${esc(title)}</h2></div><button class="ghost" data-cmd="close-modal" aria-label="Close panel">×</button></div><div class="modal-body">${body}</div>`;
  modal.scrollTop=0;if(!modal.open)modal.showModal();
  modal.querySelector('#panel-title').focus({preventScroll:true});
}
modal.addEventListener('close',()=>{
  const prior=modalReturn;modalReturn=null;
  const el=prior?.element?.isConnected?prior.element:prior?.id?document.getElementById(prior.id):prior?.cmd?document.querySelector(`[data-cmd="${CSS.escape(prior.cmd)}"]`):null;
  if(el?.isConnected)el.focus({preventScroll:true});
  else {const main=document.getElementById('main');if(main){main.tabIndex=-1;main.focus({preventScroll:true});}}
  battleStage.pause(false);startAtmosphere();
});
async function showExport(){showExportCode(await saveCode(state));}
async function showShare(){
  shareFile=null;
  showSharePreview();
  const canvas=document.querySelector('#reign-card');
  const summary={name:state.name,route:state.route,url:CONFIG.siteUrl||new URL('./',location.href).href,choices:[state.decisions.ch9==='mercy'?'Mercy after victory':'Order after victory',state.decisions.ch4==='withdraw'?'A commander who preserved the ranks':'A commander who held the line',state.decisions.ch11==='independent'?'A voice earned by service':'Power built on alliances']};
  const file=await prepareShareCard({canvas,summary,loadPortrait:()=>loadArt(heroPortrait('Augustus')),loadScene:()=>loadArt(chapterScene(12)),draw:drawReignCard,downloadButton:modal.querySelector('[data-cmd="download-card"]'),shareButton:modal.querySelector('[data-cmd="share-card"]'),makeFile:blob=>new File([blob],'imperium-reign.png',{type:'image/png'})});
  if(canvas.isConnected)shareFile=file;
}
async function showRecovery(){
  try{
    const entries=await listRecoverySaves();
    showRecoveryRecords(entries);
  }catch(error){toast(error.message);}
}
async function previewRecovery(id,sequence){
  try{
    const restored=await readRecoverySave(id);pendingRecovery={id,sequence};
    showRecoveryVerified(restored);
  }catch(error){toast(error.message);}
}
function useRestoredState(restored){
  battleStage.release();
  memoryOnly=false;
  renderedLocation='';state=restored;screen='game';selected='hero';action=null;target=null;focusTile=null;pendingMotion=null;pendingReplay=null;saveProblem='';saveConflict=false;lastSaved=new Date().toISOString();modal.close();render();
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
document.addEventListener('pointerdown',()=>{if(settings.audio)battleStage.unlock();},{passive:true});
document.addEventListener('keydown',()=>{if(settings.audio)battleStage.unlock();});
document.addEventListener('click',async event=>{const b=event.target.closest('[data-cmd]');if(!b||b.disabled)return;const id=b.dataset.id,cmd=b.dataset.cmd;switch(cmd){case 'retry-offline':{const registration=await navigator.serviceWorker.getRegistration();if(registration?.active){fullDownloadRequested=true;offlineProgress='Downloading all twelve chapters…';updateLoadingStatus();registration.active.postMessage('cache-campaign');toast('Downloading all chapter artwork for offline play. Progress appears here and in the game header.');}else toast('Offline content is available from the production build.');break;}
case 'close-modal':modal.close();break;
case 'retry-chapter':if(state){loadedArtChapter=0;cachedChapterRequest=0;offlineProgress='';prepareChapterArt({retry:true,allowTitle:true});toast('Retrying this chapter’s artwork. Other chapters are optional.');}break;
case 'home':modal.close();screen='title';loadedArtChapter=0;artRequest++;artProgress='';clearBattleCache();render();break;
case 'new':showNew();break;
case 'begin':{
  const candidate=Game.newGame(document.querySelector('#name-input').value);
  const result=await replaceCampaign({load:async()=>candidate,save:value=>saveLocal(value,{replace:true}),message:'Chapter I. You are a Tiro: a recruit in training.'});
  if(result.error?.code==='SAVE_UNAVAILABLE'){
    pendingNew=candidate;
    showStorageUnavailable();
  }
  break;
}
case 'begin-unsaved':if(pendingNew&&!sessionGate.busy){const candidate=pendingNew;pendingNew=null;useRestoredState(candidate);memoryOnly=true;lastSaved='';saveProblem='Playing in memory. Export a save code before closing this tab.';render();toast(saveProblem);}break;
case 'continue':modal.close();screen='game';render();break;
case 'map':showMap();break;
case 'chapter-info':showMap(Number(id));break;
case 'history':showHistory();break;
case 'settings':showSettings();break;
case 'help':showHelp();break;
case 'ledger':showLedger();break;
case 'journal':showJournal();break;
case 'character':showCharacter();break;
case 'privacy':showPrivacy();break;
case 'credits':showCredits();break;
case 'menu':showNavigation();break;
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
case 'unit':case 'select-unit':selected=id;action=null;target=null;focusTile=null;render();break;
case 'action':chooseAction(id);break;
case 'cancel-action':cancelCommand();break;
case 'view-3d':settings.battleView=uses3D()?'2d':'3d';failed3D=false;saveSettings();render();break;
case 'camera-home':battleStage.home();break;
case 'camera-focus':battleStage.focus();break;
case 'camera-horizon':if(battleStage.stage){battleStage.horizon();announce('Horizon view. Camera only; your orders are unchanged.');}break;
case 'camera-in':battleStage.zoom(-3);break;
case 'camera-out':battleStage.zoom(3);break;
case 'toggle-grid':showGrid=!showGrid;render();break;
case 'confirm':await confirmCommand();break;
case 'skip-replay':replay.stop();break;
case 'end-turn':await change(()=>Game.endTurn(state),{tone:'turn',turn:true,command:{action:'endTurn'},clearSelection:true});break;
case 'retry':showRetry();break;
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
case 'takeover':showTakeover();break;
case 'confirm-takeover':await replaceCampaign({load:()=>takeOverSaveSession({confirmed:true}),message:'Latest chronicle loaded. This tab can now save safely.'});break;
case 'copy-code':try{await navigator.clipboard.writeText(document.querySelector('#save-code').value);toast('Save code copied.');}catch{document.querySelector('#save-code').select();toast('Select and copy the highlighted save code.');}break;
case 'download-code':download(new Blob([document.querySelector('#save-code').value],{type:'text/plain'}),'imperium-save.txt');break;
case 'import-code':try{const imported=await restoreCode(document.querySelector('#restore-code').value);pendingImport=imported;showImportVerified(imported);}catch(error){toast(error.message);}break;
case 'confirm-import':if(pendingImport){const candidate=pendingImport;const result=await replaceCampaign({load:async()=>candidate,save:value=>saveLocal(value,{replace:true}),message:'Chronicle restored. Chapter access was checked from earned milestones.'});if(result.ok)pendingImport=null;}break;
case 'share':await showShare();break;
case 'download-card':document.querySelector('#reign-card').toBlob(blob=>download(blob,'imperium-reign.png'));break;
case 'share-card':{const file=shareFile;if(!file){toast('The card is still being prepared.');break;}try{if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'My Imperium reign'});else{download(file,'imperium-reign.png');toast('Card downloaded. Share it using your preferred app.');}}catch(error){if(error.name!=='AbortError')toast('Sharing was unavailable. Use Download card.');}break;}}});
document.addEventListener('change',async event=>{
  const control=event.target;
  if(control.id==='unit-select'){selected=control.value;action=null;target=null;render();}
  if(control.id==='action-select')chooseAction(control.value||null);
  if(control.id==='restore-file'&&control.files?.[0]){const file=control.files[0],field=document.querySelector('#restore-code');if(file.size>3000000){toast('Save file is too large.');return;}const text=await file.text();if(field?.isConnected)field.value=text;}
  if(control.id==='audio-volume'){settings.audioVolume=audioLevel(Number(control.value)/100);saveSettings();battleStage.audio(settings.audio,settings.audioVolume);battleStage.unlock();const label=document.querySelector('#audio-volume-value');if(label)label.textContent=Math.round(settings.audioVolume*100)+'%';sound('click',settings.audio,settings.audioVolume);}
  if(control.id==='text-size'){settings.textScale=Number(control.value);saveSettings();render();}
  if(control.id==='battle-view'){settings.battleView=control.value;failed3D=false;saveSettings();render();}
  if(control.id==='graphics-quality'){stopMotion();pendingMotion=null;graphics.setMode(control.value);settings.quality=graphics.mode;saveSettings();clearBattleCache();render();}
  if(control.id==='target-select'){const i=control.value;target=i===''?null:targets()[Number(i)];render();if(target)announce(Game.preview(state,command()).message);}
  if(control.id==='formation-kind'){formation=control.value;render();}
  if(control.id==='order-kind'){orderAction=control.value;render();}
  if(['audio-setting','motion-setting'].includes(control.id)){stopMotion();pendingMotion=null;replay.stop();settings[control.id==='audio-setting'?'audio':'reducedMotion']=control.checked;saveSettings();document.documentElement.dataset.reduced=settings.reducedMotion;battleStage.audio(settings.audio,settings.audioVolume);battleStage.reduced(settings.reducedMotion);if(settings.audio){battleStage.unlock();if(!uses3D())sound('click',true,settings.audioVolume);}else stopAudio();paint();}
});
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.repeat||event.altKey||event.ctrlKey||event.metaKey||modal.open||screen==='title'||state?.phase!=='encounter'||sessionGate.busy)return;
  if(event.target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
  if(event.key.toLowerCase()==='h'&&uses3D()){event.preventDefault();if(battleStage.stage){battleStage.horizon();announce('Horizon view. Camera only; your orders are unchanged.');}return;}
  if(state.encounter.status!=='active')return;
  const next=keyboardAction(event.key,Game.getActions(state,selected));
  if(next){event.preventDefault();chooseAction(next);return;}
  if(event.key==='Escape'){event.preventDefault();cancelCommand();}
  else if(event.key.toLowerCase()==='n'){event.preventDefault();selected=nextReadyUnit(state,selected);action=null;target=null;focusTile=null;render();announce(`Selected ${selectedUnit().name}.`);}
  else if(event.key.toLowerCase()==='e'){event.preventDefault();change(()=>Game.endTurn(state),{tone:'turn',turn:true,command:{action:'endTurn'},clearSelection:true});}
  else if(event.key.toLowerCase()==='g'){event.preventDefault();showGrid=!showGrid;render();}
});
window.addEventListener('resize',()=>{stopMotion();requestAnimationFrame(()=>{paint();startAtmosphere();});});
document.addEventListener('visibilitychange',()=>{
  document.documentElement.dataset.hidden=document.hidden;
  if(document.hidden){
    stopAudio();stopMotion();pendingMotion=null;replay.stop();
    if(state&&!memoryOnly&&!saving&&!saveConflict&&!sessionGate.busy)sessionGate.run(async()=>{await persist();render();}).catch(error=>{if(error.code!=='SESSION_BUSY')console.error(error);});
  }else render();
});
subscribeSaveChanges(()=>{if(state&&!memoryOnly){saveConflict=true;saveProblem='The chronicle changed in another tab. Load the latest save to continue here, or export this tab’s progress.';lastSaved='';render();announce(saveProblem);}});
const loaded=await loadLocal();state=loaded.state;render();if(loaded.error)toast(loaded.error);
if('serviceWorker'in navigator){
  navigator.serviceWorker.addEventListener('message',event=>{
    const data=event.data;
    if(data?.type==='offline-ready'){offline=true;currentChapterOffline=true;fullDownloadRequested=false;offlineProgress='';}
    else if(data?.type==='offline-progress'){offline=false;if(fullDownloadRequested)offlineProgress=`Downloading all twelve chapters · ${data.percent}%`;}
    else if(data?.type==='chapter-offline'&&state?.chapter===data.chapter){currentChapterOffline=data.ready;}
    else if(data?.type==='offline-error'){if(data.chapter&&state?.chapter!==data.chapter)return;offlineProgress=data.message;fullDownloadRequested=false;}
    updateLoadingStatus();
  });
  try{
    const hadController=Boolean(navigator.serviceWorker.controller);
    const registration=await navigator.serviceWorker.register('./sw.js');
    watchEditionUpdates(registration,{hadController,onReady:()=>toast('A new edition is downloaded. Close and reopen the game after saving to use it.')});
    const ready=await navigator.serviceWorker.ready;offlineWorker=ready.active;
    offlineWorker?.postMessage({type:'offline-status',chapter:state?.chapter});
    requestCurrentChapter();
  }catch{/* Source preview has no generated worker; production build includes it. */}
}
