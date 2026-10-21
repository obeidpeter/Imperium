import {chapterHas3D,createBattleStageController} from './battle-stage-controller.js';
import {createCeremonyController} from './ceremony-controller.js';
import {esc,roman} from './view-helpers.js';
import {createCampaignViews,allocationDraftPreview} from './campaign-views.js';
import {createPanels} from './panels.js';
import {createRenderScheduler,createRenderHold,prepareShareCard} from './render-controller.js';
import {updatePage} from './page-update.js';
import {encounterView,selectedActor,selectedCommand} from './encounter-view.js';
import {directIntent,nextReadyUnit,keyboardAction,samePoint,clickRoute,walkableReach} from './direct-controls.js';
import {bindBoardInput} from './board-input.js';
import {hoverText,cursorAnnouncement,pointAnnouncement,walkMessage} from './board-readout.js';
import {casePreview} from './command-edition-views.js';
import {CONTROL_DEFAULTS,controlAction,remapControl,holdDelay,controlKeys} from './control-preferences.js';
import {createTurnReplay,turnReplaySteps} from './turn-replay.js';
import {createSessionGate,commitReplacement} from './session-gate.js';
import {watchEditionUpdates} from './offline-updates.js';
import {FIGURE_STYLES,createGraphicsQuality,phoneLike} from './graphics-quality.js';
import {SETTINGS_KEY,SETTING_TOGGLES,loadSettings} from './settings.js';
import * as Game from '../core/game.js';
import {CHAPTERS} from '../data/campaign.js';
import {CONFIG} from '../config.js';
import {drawBattle,pickBattlePoint,drawReignCard,reignLaurels} from './renderer.js';
import {clearBattleCache} from './battle-art.js';
import {loadTacticalArt} from './unit-sprites.js';
import {loadLocal,saveLocal,saveCode,restoreCode,listRecoverySaves,readRecoverySave,restoreRecovery,takeOverSaveSession,subscribeSaveChanges,listUnreadableSaves,
  readUnreadableSave} from './storage.js';
import {sound,stopAudio,audioLevel} from './audio.js';
import {heroPortrait,chapterScene,loadArt,prefetchChapter,TACTICAL_2D_ONLY} from './art.js';
import {snapshotEncounter,playEncounterMotion} from './motion.js';
import {playAmbientScene} from './ambient.js';
import {setupSiteMedia} from './site-media.js';
import {createScenePainting,paintingHost} from './scene-parallax.js';
import {campaignSoundscape} from './soundscape.js';
import {previewBadge,previewBadges} from '../showcase/stage-readout.js';
import {runPerformanceCheck,createCheckBand} from './performance-check.js';

const app=document.querySelector('#app'),modal=document.querySelector('#modal');
let state=null,screen='title',selected='hero',action=null,target=null,focusTile=null,formation='shield-wall',orderAction='advance',orderDestination=null,
  offline=false,saving=false,lastSaved='',toastTimer,saveProblem='',saveConflict=false,pendingImport=null,shareFile=null,feedback='',offlineProgress='',
  pendingMotion=null,pendingReplay=null,pendingRecovery=null,pendingNew=null;
const sessionGate=createSessionGate();
let memoryOnly=false,archivePrimaryState=null;
let cancelMotion=null,currentAnimation=null,currentChapterOffline=false,artProgress='',offlineWorker=null,fullDownloadRequested=false,loadedArtChapter=0,
  artRequest=0,cachedChapterRequest=0;
let cancelAmbient=null,ambientTime=null;
let renderedLocation='',pendingScroll=false;
let cleanupSiteMedia=()=>{};
let hoverTile=null,showGrid=false,failed3D=false,preservedUnreadable=0,lastPersisted='';
// A battle that stayed slow at its lowest resolution builds the next one a tier
// lower, if it was measured at the current tier and adaptive resolution is on.
const battleStage=createBattleStageController({onError:message=>{failed3D=true;render();toast('3D view unavailable. The tactical view is ready; '+
  'your progress is preserved. '+message);},
  onStrain:quality=>graphics.strained(quality,{adaptive:settings.adaptiveResolution})});
// The oath and accession may be staged in 3D over their paintings; a failure keeps the painting.
const ceremony=createCeremonyController({onError:()=>{}});
// Story paintings drift in 2.5D over their still image; any failure keeps the still image.
const scenePainting=createScenePainting({load:src=>loadArt(src)});
function uses3D(){return screen!=='title'&&chapterHas3D(state)&&settings.battleView!=='2d'&&!failed3D;}
function boardHover(point){
  hoverTile=point;const label=document.querySelector('#board-hover');if(label)label.textContent=hoverText(state?.encounter,point,routeAt(point));
  if(uses3D())battleStage.stage?.setRoute?.(routeAt(point),reach());
}
// What a click on open ground would walk, and the ground the selected unit can reach (direct-controls.js).
function routeAt(point){return screen==='title'?null:clickRoute(state,{selected,action},point);}
function reach(){return walkableReach(state,{selected,action});}
let settings=loadSettings(storedSettings(),
  {reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,saveData:navigator.connection?.saveData,deviceMemory:navigator.deviceMemory,
    phone:phoneLike()});
const soundscape=campaignSoundscape();soundscape.configure(settings);
function storedSettings(){try{return localStorage.getItem(SETTINGS_KEY);}catch{return null;}}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}}
const graphics=createGraphicsQuality({mode:settings.quality,
  onChange:({mode,reason})=>{
    battleStage.quality(mode);mountPainting();settings.quality=mode;saveSettings();document.documentElement.dataset.quality=mode;
    const control=document.querySelector('#graphics-quality');if(control)control.value=mode;
    if(reason==='measured-cost')announce(`Graphics `+
  `changed to ${mode} after repeated slow rendering. You can choose a different quality in Settings.`);
  }});
const {header,footer,titleView,meters,requirements,camp,promotion,ending}=createCampaignViews(()=>({state,screen,settings,saving,lastSaved,saveProblem,
  saveConflict,offline,offlineProgress,currentChapterOffline,artProgress}));
const {showNew,showMap,showLedger,showSettings,showPerformanceCheck,showHelp,showHistory,showJournal,showCharacter,showRestore,showNavigation,showCredits,
  showPrivacy,showExportCode,showRecoveryRecords,showRecoveryVerified,showImportVerified,showStorageUnavailable,showRetry,showTakeover,showSharePreview}=createPanels(()=>({state,
    screen,settings,offline,currentChapterOffline,offlineProgress,showModal,meters,requirements,preservedUnreadable}));
function announce(text){document.querySelector('#announcement').textContent=text;}
function toast(text){
  announce(text);
  if(modal.open){
    let note=modal.querySelector('.modal-feedback');
    if(!note){
      note=document.createElement('p');note.className='notice modal-feedback';note.setAttribute('role','alert');
      modal.querySelector('.modal-body').prepend(note);
    }
    note.textContent=text;note.scrollIntoView({block:'nearest'});return;
  }
  feedback=text;const inline=document.querySelector('#action-feedback');if(inline){inline.textContent=text;inline.hidden=false;return;}
  let note=document.querySelector('.system-feedback');
  if(!note){
    note=document.createElement('p');note.className='system-feedback';note.setAttribute('role','status');document.querySelector('.topbar')?.after(note);
  }
  note.textContent=text;note.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>note.hidden=true,6500);
}
function selectedUnit(){return selectedActor(state,selected);}
function targets(){return action?Game.getTargets(state,selected,action):[];}
function command(){return selectedCommand({selected,action,target,formation,orderAction,orderDestination});}

function battle(){
  selected=selectedUnit().id;if(action&&!Game.getActions(state,selected).includes(action)){action=null;target=null;orderDestination=null;}
  return encounterView({view3D:uses3D(),can3D:chapterHas3D(state),fastMotion:Boolean(settings.fastMotion),confirmMoves:Boolean(settings.confirmMoves),
    keyBindings:settings.keyBindings,coach:settings.coach,guide:settings.guide,state,selected,action,target,focusTile,showGrid,formation,orderAction,
    orderDestination,feedback,header,footer,requirements,saving,lastSaved,saveProblem,saveConflict,artProgress,offlineProgress});
}
const replay=createTurnReplay({
  show(text,index,total){const panel=document.querySelector('#turn-replay');if(!panel)return;panel.hidden=false;panel.innerHTML=`<span>`+
    `<small>TURN RESOLVED · ${index}/${total}</small>${esc(text)}</span><button class="ghost small" data-cmd="skip-replay">Skip</button>`;announce(text);},
  finish(){const panel=document.querySelector('#turn-replay');if(panel)panel.hidden=true;}
});
const renderHold=createRenderHold(()=>render());
const renderScheduler=createRenderScheduler(requestAnimationFrame,({activeId})=>{
  if(pendingScroll){window.scrollTo({top:0,behavior:'instant'});pendingScroll=false;}paint();bindBoard();
  const canvas=document.querySelector('#battle-board'),encounter=state?.encounter;
  const motionQueued=Boolean(pendingMotion);
  if(canvas&&encounter&&!uses3D())loadTacticalArt(encounter).then(()=>{
    if(!canvas.isConnected||document.querySelector('#battle-board')!==canvas||state?.encounter!==encounter)return;
    paint(currentAnimation);
    if(!motionQueued&&!currentAnimation&&!pendingMotion)startAtmosphere(canvas,encounter);
  });
  if(pendingMotion&&!uses3D()){
    const motion=pendingMotion;pendingMotion=null;
    cancelMotion=playEncounterMotion(canvas,motion.before,motion.after,
      {command:motion.command,reducedMotion:settings.reducedMotion||modal.open,quality:graphics.mode,
        renderFrame:frame=>{
          if(canvas?.isConnected&&document.querySelector('#battle-board')===canvas){
            currentAnimation=frame;paint(frame);if(frame===null&&cancelMotion)startAtmosphere(canvas,encounter);
          }
        }});
  }
  if(pendingReplay){replay.start(pendingReplay,settings.reducedMotion||document.hidden);pendingReplay=null;}
  if(activeId&&document.getElementById(activeId))document.getElementById(activeId).focus({preventScroll:true});
});
function render(){
  // A running performance check owns the 3D stage; the page catches up after it.
  if(renderHold.defer())return;
  cleanupSiteMedia();
  stopMotion();
  replay.stop();
  const viewKey=`${screen}:${state?.chapter}:${state?.phase}:${state?.encounter?.id||state?.encounterIndex}`;
  const newView=viewKey!==renderedLocation,openPanels=newView?[]:[...app.querySelectorAll('.command-stage details[id][open]')].map(node=>node.id);
  if(newView){pendingScroll=true;renderedLocation=viewKey;}
  document.documentElement.dataset.phase=screen==='title'?'title':state?.phase||'camp';
  document.documentElement.dataset.kind=state?.encounter?.kind||'';
  document.documentElement.dataset.stage=state?.phase==='epilogue'||(state?.chapter===12&&state?.phase==='promotion')?'imperial':'service';
  document.documentElement.dataset.reduced=settings.reducedMotion;
  document.documentElement.dataset.quality=graphics.mode;
  document.documentElement.dataset.contrast=settings.highContrast?'high':'standard';
  document.documentElement.dataset.hud=settings.compactHud===false?'full':'compact';
  document.documentElement.style.setProperty('--text-scale',settings.textScale||1);
  const activeId=document.activeElement?.id;
  // A new screen starts afresh; within one, the page is updated in place, so the
  // board keeps its focus and listeners, the 3D view its canvas, and a field what was typed.
  if(newView)app.replaceChildren();
  updatePage(app,screen==='title'?titleView():state?.phase==='encounter'?battle():state?.phase==='promotion'?promotion():state?.phase==='epilogue'?ending():camp());
  soundscape.update(state,screen);
  if(uses3D()){
    const motion=pendingMotion,cmd=command(),checked=cmd?Game.preview(state,cmd):null,
      commendations=Object.fromEntries((state.company||[]).map(v=>[v.id,v.commendations||0]));
    pendingMotion=null;
    battleStage.mount(document.querySelector('#battle-board'),
      {encounter:state.encounter,chapter:state.chapter,rank:state.rank,stratagem:state.stratagem,commendations,selected,targets:targets(),
        target:target?{...target,action,previewBadge:previewBadge(checked,action),previewBadges:previewBadges(state,cmd,checked)}:focusTile?{...focusTile,action}:null,
        grid:showGrid,route:routeAt(hoverTile),reach:reach(),quality:graphics.mode,figureStyle:settings.figureStyle,actionCamera:settings.actionCamera!==false,
        battleRemains:settings.battleRemains!==false,adaptiveResolution:settings.adaptiveResolution,motionSpeed:settings.fastMotion?2:1,
        holdDelay:settings.holdDelay,reducedMotion:settings.reducedMotion,audio:settings.audio,audioVolume:settings.audioVolume,paused:modal.open,
        onPick:p=>{if(p)selectPoint(p);},onHover:boardHover,onFrame:cost=>graphics.recordFrame(cost,{hidden:document.hidden,active:!modal.open}),motion});
  }else battleStage.release();
  const ceremonyHost=document.querySelector('[data-ceremony]'),ceremony3D=Boolean(ceremonyHost&&settings.battleView!=='2d'&&!failed3D);
  if(ceremony3D)ceremony.mount(ceremonyHost,
    {kind:ceremonyHost.dataset.ceremony,name:state?.name,quality:graphics.mode,reducedMotion:settings.reducedMotion,figureStyle:settings.figureStyle});else ceremony.release();
  mountPainting();
  for(const id of openPanels){const panel=document.getElementById(id);if(panel)panel.open=true;}
  if(screen==='title')cleanupSiteMedia=setupSiteMedia(app);
  prepareChapterArt();
  renderScheduler.schedule({activeId});
}
function mountPainting(){
  const host=paintingHost(app,{title:screen==='title',ceremony3D:settings.battleView!=='2d'&&!failed3D});
  if(host)scenePainting.mount(host,{chapter:state?.chapter,quality:graphics.mode,reducedMotion:settings.reducedMotion});else scenePainting.release();
}
function stopMotion(){
  battleStage.stop();const stop=cancelMotion,stopAmbient=cancelAmbient;cancelMotion=null;cancelAmbient=null;if(stop)stop();currentAnimation=null;
  if(stopAmbient)stopAmbient();ambientTime=null;
}
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
  drawBattle(canvas,state.encounter,selected,targets(),focusTile,state.chapter,
    {action,target,hover:hoverTile,route:animation?null:routeAt(hoverTile),reach:animation?[]:reach(),grid:showGrid,animation,ambientTime,quality:graphics.mode,
      maxPixelRatio:graphics.profile.maxPixelRatio});
  graphics.recordFrame(performance.now()-started,{hidden:document.hidden,active:true});
}
function updateLoadingStatus(){
  const regions=[['art-loading-status',artProgress],
    ['offline-status',
      offline?'✓ ALL CHAPTERS AVAILABLE OFFLINE':offlineProgress||(currentChapterOffline&&state?`✓ CHAPTER ${roman(state.chapter)} AVAILABLE OFFLINE`:'')]];
  for(const [id,text]of regions){
    let node=document.getElementById(id);
    if(!node&&text){
      node=document.createElement('div');node.id=id;node.className='offline-banner';node.setAttribute('role','status');
      document.querySelector('.topbar')?.after(node);
    }
    if(node){node.textContent=text;node.hidden=!text;}
  }
  const progress=document.querySelector('#settings-offline-status');
  if(progress)progress.textContent=offline?'All twelve chapters are available offline.':offlineProgress||(currentChapterOffline&&state?`Chapter ${roman(state.chapter)} `+
    `is available offline. Later chapters download as you reach them.`:'The current chapter is not fully cached yet.');
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
    prefetchChapter(chapter,
      {retry,skip:path=>settings.battleView!=='2d'&&!failed3D&&TACTICAL_2D_ONLY.includes(path),
        shouldPrefetchNext:()=>request===artRequest&&screen!=='title'&&!document.hidden,
        onProgress:progress=>{if(request!==artRequest)return;artProgress=progress.completed<progress.total?`Preparing `+
      `chapter artwork · ${progress.completed}/${progress.total}`:progress.failed?'Some artwork is unavailable. Readable tactical '+
      'symbols remain available.':'';updateLoadingStatus();}}).then(()=>{if(request===artRequest)offlineWorker?.postMessage({type:'offline-status',chapter});});
  }
  requestCurrentChapter({allowTitle});updateLoadingStatus();
}
let boardInput=null; // {board,binding}: the board keeps its bindings through page updates
function bindBoard(){
  const board=document.querySelector('#battle-board');if(!board||!state.encounter)return;
  if(boardInput?.board===board){boardInput.binding.configure({holdDelay:settings.holdDelay});return;}
  boardInput?.binding.dispose();
  boardInput={board,binding:bindBoardInput(board,{threeD:uses3D(),holdDelay:settings.holdDelay,current:()=>hoverTile,
    pick:(x,y)=>pickBattlePoint(board,state.encounter,x,y),
    inside:p=>{const e=state.encounter;return p.x>=0&&p.y>=0&&p.x<e.width&&p.y<e.height;},
    hover:point=>{boardHover(point);board.style.cursor=point?'pointer':'default';paint(currentAnimation);},
    select:selectPoint,cancel:cancelCommand,activate:()=>selectPoint(focusTile||selectedUnit()),
    step:([dx,dy])=>{
      const e=state.encounter,from=focusTile??selectedUnit();
      focusTile={x:Math.max(0,Math.min(e.width-1,from.x+dx)),y:Math.max(0,Math.min(e.height-1,from.y+dy))};
      boardHover(focusTile);if(uses3D())battleStage.stage?.setSelection(selected,targets(),focusTile);paint();
      announce(cursorAnnouncement(state.encounter,focusTile,routeAt(focusTile)));
    }})};
  board.dataset.bound='true';
}
async function confirmCommand(){
  const c=command();
  if(c&&Game.preview(state,c).ok){
    const callout=Game.companionCallout(state.encounter,c)||Game.delegateCallout(state.encounter,c);
    await change(()=>{const res=Game.act(state,c);if(res?.ok&&callout)res.message=`${res.message} `+
  `· ${callout.speaker} (${callout.rankTitle||callout.bloc}): “${callout.text}”`;return res;},{tone:action,command:c,clearSelection:true});
  }
}
function chooseAction(next){
  action=next;target=null;orderDestination=null;
  const legal=targets(),atFocus=legal.find(t=>samePoint(t,focusTile));
  if(atFocus)target=atFocus;else if(legal.length===1)target=legal[0];
  render();if(target)announce(Game.preview(state,command()).message);
}
// One click walks: the ordinary legal move command, so the rules check it, the
// save records it and Undo Move can take it back until the unit acts.
async function walk(intent){
  action='move';target=intent.target;orderDestination=null;feedback='';
  const c=command();if(!c||!Game.preview(state,c).ok){action=null;target=null;render();return;}
  await change(()=>{const res=Game.act(state,c);if(res?.ok)res.message=walkMessage(c,intent,controlKeys(settings.keyBindings).undo);return res;},
    {tone:'move',command:c,clearSelection:true});
}
function cancelCommand(){action=null;target=null;orderDestination=null;feedback='';render();announce('Command cancelled. No action was spent.');}
function selectPoint(point){
  if(sessionGate.busy)return;
  const intent=directIntent(state,{selected,action,target,point,moveOnClick:!settings.confirmMoves});if(intent.kind==='none')return;
  focusTile={x:point.x,y:point.y};hoverTile=null;
  if(intent.kind==='move'){walk(intent);return;}
  if(intent.kind==='confirm'){confirmCommand();return;}
  if(intent.kind==='select'){selected=intent.unitId;action=null;target=null;orderDestination=null;feedback='';render();return;}
  if(intent.kind==='preview'){
    action=intent.action;target=intent.target;orderDestination=null;feedback='';render();
    announce(Game.preview(state,command()).message+' Activate the target again, or use Confirm.');return;
  }
  const said=pointAnnouncement(state.encounter,point,routeAt(point));
  action=null;target=null;orderDestination=null;render();announce(said);
}
async function persist(){
  if(memoryOnly||state?.archiveReplay)return {ok:true};
  saving=true;
  const label=document.querySelector('.save-status');if(label)label.textContent='Saving…';
  try{lastSaved=await saveLocal(state);lastPersisted=JSON.stringify(state);saveProblem='';saveConflict=false;return {ok:true};}
  catch(error){lastSaved='';saveProblem=error.message;saveConflict=error.code==='SAVE_CONFLICT';return {ok:false,error};}
  finally{saving=false;}
}
async function change(fn,{reset=false,tone='click',turn=false,silent=false,command:issuedCommand=null,clearSelection=false,afterRender=null}={}){
  if(sessionGate.busy)return;
  if(saveConflict){toast(saveProblem);return;}
  return sessionGate.run(async()=>{
    stopMotion();
    replay.stop();
    try{
      const before=snapshotEncounter(state.encounter),commandSnapshot=issuedCommand?structuredClone(issuedCommand):null,result=fn();
      if(result?.ok===false){render();afterRender?.();toast(result.message);return;}
      if(reset){pendingMotion=null;feedback='';selected='hero';action=null;target=null;orderDestination=null;focusTile=null;}
      else{
        const after=snapshotEncounter(state.encounter);pendingMotion={before,after,command:commandSnapshot};
        if(turn)pendingReplay=turnReplaySteps(before,after,state.encounter?.turnEvents||[]);
      }
      if(clearSelection){action=null;target=null;orderDestination=null;}
      const saved=await persist();
      if(tone&&!(uses3D()&&issuedCommand)){
        const status=state.encounter?.status;const cue=before?.status==='active'&&status&&status!=='active'?(status==='won'?'victory':'defeat'):tone;
        sound(cue,settings.audio,settings.audioVolume);
      }
      render();
      afterRender?.();
      if(!saved.ok)toast(saveProblem);
      else if(result?.message&&!silent)toast(result.message);
    }catch(error){toast(`The action could not be completed: ${error.message}`);console.error(error);}
  });
}
function refreshOpenLedger(){if(modal.open&&modal.dataset.panel==='obligations-alliances')showLedger();}
async function replaceCampaign({load,save,message}){
  if(sessionGate.busy){toast('Please wait for the current save to finish.');return {ok:false};}
  return sessionGate.run(async()=>{
    let restored;
    saving=true;
    try{
      await commitReplacement({load,save,publish:candidate=>{restored=candidate;}});
      saving=false;
      useRestoredState(restored);lastPersisted=JSON.stringify(restored);
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
  modal.innerHTML=`<div class="modal-head"><div><span class="eyebrow">IMPERIUM · YOUR CHRONICLE</span><h2 id="panel-title" tabindex="-1">${esc(title)}</h2>`+
    `</div><button class="ghost" data-cmd="close-modal" aria-label="Close panel">×</button></div><div class="modal-body">${body}</div>`;
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
async function showExport(){showExportCode(await saveCode(archivePrimaryState??state));}
// Settings → Run performance check. The battle is measured where it stands:
// the panel closes, and until the check ends a status band covers the page so
// neither pointer nor keys can reach the board (Escape or Cancel stop it).
let performanceCheck=null,performanceReport=null;
async function startPerformanceCheck(){
  if(performanceCheck)return;
  if(!uses3D()||!battleStage.stage?.isReady){showModal('Performance check','<p>Open a battle in the 3D view, then run the check from Settings.</p>'+
    '<div class="panel-actions settings-controls"><button data-cmd="close-modal">Close</button></div>');return;}
  modal.close();stopMotion();pendingMotion=null;replay.stop();
  const check=performanceCheck=createCheckBand();renderHold.hold();
  const names={performance:'Performance',balanced:'Balanced',high:'High quality'};
  try{
    performanceReport=await runPerformanceCheck(battleStage,
      {current:graphics.mode,adaptive:settings.adaptiveResolution!==false,app:{version:CONFIG.version},isCancelled:()=>check.cancelled,
      onProgress:({tier,index,total,step})=>{check.show(`Performance check ${index+1} of ${total}: ${step==='build'?'building':'measuring'} ${names[tier]}. `+
        `Escape cancels.`);}});
  }catch(error){performanceReport=null;toast(`The performance check stopped: ${error.message||error}`);}
  finally{check.close();performanceCheck=null;renderHold.release();}
  if(performanceReport?.tiers.length)showPerformanceCheck(performanceReport);
  else if(performanceReport)toast('The performance check was cancelled before it measured a quality.');
}
async function showShare(selectedTheme='imperial'){
  shareFile=null;
  showSharePreview(selectedTheme);
  const canvas=document.querySelector('#reign-card');
  const summary={name:state.name,route:state.route,theme:selectedTheme,laurels:reignLaurels(state),url:CONFIG.siteUrl||new URL('./',location.href).href,
    choices:[state.decisions.ch9==='mercy'?'Mercy after victory':'Order after victory',
      state.decisions.ch4==='withdraw'?'A commander who preserved the ranks':'A commander who held the line',
      state.decisions.ch11==='independent'?'A voice earned by service':'Power built on alliances'],
    stats:{encounters:(state.history||[]).length,turns:(state.history||[]).reduce((n,h)=>n+(h.turns||0),0),
      commendations:(state.company||[]).reduce((n,v)=>n+(v.commendations||0),0)}};
  const file=await prepareShareCard({canvas,summary,loadPortrait:()=>loadArt(heroPortrait('Augustus')),loadScene:()=>loadArt(chapterScene(12)),
    draw:drawReignCard,downloadButton:modal.querySelector('[data-cmd="download-card"]'),shareButton:modal.querySelector('[data-cmd="share-card"]'),
    makeFile:blob=>new File([blob],'imperium-reign.png',{type:'image/png'})});
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
  memoryOnly=false;archivePrimaryState=null;
  renderedLocation='';state=restored;screen='game';selected='hero';action=null;target=null;orderDestination=null;focusTile=null;pendingMotion=null;
  pendingReplay=null;saveProblem='';saveConflict=false;lastSaved=new Date().toISOString();modal.close();render();
}
function download(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
document.addEventListener('pointerdown',()=>{soundscape.unlock();if(settings.audio)battleStage.unlock();},{passive:true});
document.addEventListener('keydown',()=>{soundscape.unlock();if(settings.audio)battleStage.unlock();});
document.addEventListener('click',
  async event=>{
    const node=event.target.closest?.('.tabula-node[data-theatre]');
    if(node?.dataset?.theatre&&modal.open){
      const key=globalThis.CSS?.escape?CSS.escape(node.dataset.theatre):node.dataset.theatre,
        detail=modal.querySelector(`details.tabula-theatre[data-theatre="${key}"]`);
      if(detail){detail.open=true;detail.scrollIntoView({behavior:'smooth',block:'nearest'});}return;
    }
    const b=event.target.closest('[data-cmd]');if(!b||b.disabled)return;const id=b.dataset.id,cmd=b.dataset.cmd;
    switch(cmd){
      case 'retry-offline':{
        const registration=await navigator.serviceWorker.getRegistration();
        if(registration?.active){
          fullDownloadRequested=true;offlineProgress='Downloading all twelve chapters…';updateLoadingStatus();registration.active.postMessage('cache-campaign');
          toast('Downloading '+
  'all chapter artwork for offline play. Progress appears '+
  'here and in the game header.');
        }else toast('Offline content is available from the production build.');break;
      }
case 'close-modal':modal.close();break;
case 'retry-chapter':if(state){loadedArtChapter=0;cachedChapterRequest=0;offlineProgress='';prepareChapterArt({retry:true,allowTitle:true});toast('Retrying '+
  'this chapter’s artwork. Other chapters are optional.');}break;
case 'home':modal.close();screen='title';loadedArtChapter=0;artRequest++;artProgress='';clearBattleCache();render();break;
case 'new':showNew();break;
case 'begin':{
  const candidate=Game.newGame(document.querySelector('#name-input').value,undefined,
    {featureEdition:35,progression:true,difficulty:document.querySelector('input[name="campaign-difficulty"]:checked')?.value||'standard'});
  if(document.querySelector('#new-soundscape')?.checked){
    settings.audio=true;settings.music=true;settings.ambience=true;settings.voices=true;saveSettings();soundscape.configure(settings);soundscape.unlock();
  }
  const result=await replaceCampaign({load:async()=>candidate,save:value=>saveLocal(value,{replace:true}),
    message:'Chapter I. You are a Tiro: a recruit in training.'});
  if(result.error?.code==='SAVE_UNAVAILABLE'){
    pendingNew=candidate;
    showStorageUnavailable();
  }
  break;
}
case 'begin-unsaved':if(pendingNew&&!sessionGate.busy){
  const candidate=pendingNew;pendingNew=null;useRestoredState(candidate);memoryOnly=true;lastSaved='';
  saveProblem='Playing '+
  'in memory. Export a save code before closing this tab.';render();toast(saveProblem);
}break;
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
case 'next-story':await change(()=>Game.setStoryProgress(state,Math.min(Game.storyProgress(state)+1,Game.storyLines(state).length-1)),{tone:null,silent:true});
  break;
case 'previous-story':await change(()=>Game.setStoryProgress(state,Math.max(0,Game.storyProgress(state)-1)),{tone:null,silent:true});break;
case 'choose':await change(()=>Game.choose(state,id));break;
case 'oath':await change(()=>Game.swearOath(state));break;
case 'prepare':await change(()=>Game.prepare(state,id));break;
case 'dismiss-guide':settings.guide=false;saveSettings();render();announce('Field guide hidden. Reopen it in Settings.');break;
case 'operation-choice':await change(()=>Game.chooseOperation(state,id),{tone:null});break;
case 'specialize-veteran':{
  const path=document.getElementById('veteran-path-'+id)?.value;if(path)await change(()=>Game.specializeVeteran(state,id,path),{tone:null});break;
}
case 'agreement-demand':
      case 'agreement-counter':await change(()=>Game.negotiateAgreement(state,id,cmd==='agreement-demand'?'demand':'counteroffer'),
        {tone:'agreement',afterRender:()=>{if(uses3D())battleStage.stage?.sound?.cue('agreement',{intensity:.7});}});
        break;
case 'agreement-honour':
      case 'agreement-break':await change(()=>Game.settleAgreement(state,id,cmd==='agreement-honour'),
        {tone:cmd==='agreement-honour'?'agreement':'threaten',afterRender:refreshOpenLedger});
        break;
case 'company-package':await change(()=>Game.prepareCompany(state,id),{tone:null});break;
case 'company-up':
      case 'company-down':{
        const ids=[...Game.companyPlan(state).selectedIds],from=Number(id),to=from+(cmd==='company-up'?-1:1);
        if(to>=0&&to<ids.length){[ids[from],ids[to]]=[ids[to],ids[from]];await change(()=>Game.selectCompany(state,ids),{tone:null});}break;
      }
case 'voice-briefing':settings.voices=true;saveSettings();soundscape.configure(settings);if(!await soundscape.speak(id))toast('The recording is unavailable. '+
  'The complete briefing is shown beside this button.');break;
case 'negotiate':await change(()=>Game.negotiate(state,id));break;
case 'stratagem':await change(()=>Game.selectStratagem(state,id));break;
case 'judge':await change(()=>Game.judge(state,id));break;
case 'allocation-preset':{
  const [r,f,t]=(id||'2,2,2').split(',').map(Number),rEl=document.querySelector('#river'),fEl=document.querySelector('#farms'),
    tEl=document.querySelector('#town');
  if(rEl&&fEl&&tEl){
    rEl.value=r;fEl.value=f;tEl.value=t;const prev=document.querySelector('#allocation-preview');
    if(prev)prev.outerHTML=allocationDraftPreview({river:r,farms:f,town:t});
    announce(`Preset ${r}-${f}-${t} `+
  `selected. Review the preview and dispatch when ready.`);
  }break;
}
case 'allocate':await change(()=>Game.allocate(state,
  {river:Number(document.querySelector('#river').value),farms:Number(document.querySelector('#farms').value),town:Number(document.querySelector('#town').value)}));
  break;
case 'route':await change(()=>Game.chooseRoute(state,id));break;
case 'start':await change(()=>Game.startEncounter(state,state.chapter===12?{route:state.route||'backer'}:{}),{reset:true});break;
case 'unit':case 'select-unit':selected=id;action=null;target=null;orderDestination=null;focusTile=null;render();break;
case 'inspect-delegate':{
  const unit=state?.encounter?.units?.find(u=>u.id===id&&!u.hidden&&u.role==='voter');
  if(unit){
    focusTile={x:unit.x,y:unit.y,unitId:unit.id};action=null;target=null;orderDestination=null;render();if(uses3D())battleStage.focusPoint(focusTile);
    announce(`Inspecting ${unit.name} `+
  `(${unit.bloc}). No speech has been spent.`);
  }break;
}
case 'action':chooseAction(id);break;
case 'cancel-action':cancelCommand();break;
case 'undo-move':await change(()=>Game.undoMove(state,selected),{tone:'move',clearSelection:true});break;
case 'view-3d':settings.battleView=uses3D()?'2d':'3d';failed3D=false;saveSettings();render();break;
case 'camera-home':battleStage.home();break;
case 'camera-focus':battleStage.focus();break;
case 'camera-horizon':if(battleStage.stage){battleStage.horizon();announce('Horizon view. Camera only; your orders are unchanged.');}break;
case 'camera-speed':settings.fastMotion=!settings.fastMotion;saveSettings();battleStage.speed(settings.fastMotion?2:1);render();
  announce(`3D playback speed ${settings.fastMotion?'2×':'1×'}.`);break;
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
case 'replay':if(Game.replayLastEncounter)await change(()=>Game.replayLastEncounter(state),{reset:true});else toast('Use the encounter checkpoint save to '+
  'return and demonstrate the missing capability.');break;
case 'settle-honour':case 'settle-break':await change(()=>Game.settleObligation(state,id,cmd==='settle-honour'),{afterRender:refreshOpenLedger});break;
case 'export':await showExport();break;
      case 'export-unreadable':{
        try{
          const list=await listUnreadableSaves();if(!list.length){toast('No unreadable save data is stored on this device.');break;}
          const text=await readUnreadableSave(list[0].index);
          download(new Blob([text],{type:'application/json'}),`imperium-unreadable-save-${new Date().toISOString().slice(0,10)}.json`);
          announce('The '+
        'preserved unreadable save data was downloaded. Your current chronicle is unchanged.');
        }catch(error){toast(error.message);}break;
      }
case 'restore':showRestore();break;
case 'recovery':await showRecovery();break;
case 'preview-recovery':await previewRecovery(id,Number(b.dataset.sequence));break;
case 'confirm-recovery':if(pendingRecovery){
  const recovery=pendingRecovery;
  const result=await replaceCampaign({load:()=>restoreRecovery(recovery.id,{confirmed:true,expectedSequence:recovery.sequence}),message:'Earlier '+
  'checkpoint restored. The displaced chronicle is in recovery records.'});if(result.ok)pendingRecovery=null;
}break;
case 'takeover':showTakeover();break;
case 'confirm-takeover':await replaceCampaign({load:()=>takeOverSaveSession({confirmed:true}),message:'Latest chronicle loaded. This tab can now save safely.'});
  break;
case 'copy-code':try{
  await navigator.clipboard.writeText(document.querySelector('#save-code').value);toast('Save code copied.');
}catch{document.querySelector('#save-code').select();toast('Select and copy the highlighted save code.');}
  break;
case 'download-code':download(new Blob([document.querySelector('#save-code').value],{type:'text/plain'}),'imperium-save.txt');break;
case 'import-code':try{
  const imported=await restoreCode(document.querySelector('#restore-code').value);pendingImport=imported;showImportVerified(imported);
}catch(error){toast(error.message);}
  break;
case 'confirm-import':if(pendingImport){
  const candidate=pendingImport;
  const result=await replaceCampaign({load:async()=>candidate,save:value=>saveLocal(value,{replace:true}),message:'Chronicle '+
  'restored. Chapter access was checked from earned milestones.'});if(result.ok)pendingImport=null;
}break;
case 'share':await showShare();break;
case 'download-card':document.querySelector('#reign-card').toBlob(blob=>download(blob,'imperium-reign.png'));break;
case 'archive-replay':{
  const source=archivePrimaryState||state,res=Game.createArchiveReplay(source,id);
  if(res.ok){
    archivePrimaryState??=state;state=res.state;screen='game';selected='hero';action=null;target=null;orderDestination=null;focusTile=null;modal.close();
    render();toast(res.message);
  }else toast(res.message);
  break;
}
case 'exit-archive':if(archivePrimaryState){
  state=archivePrimaryState;archivePrimaryState=null;selected='hero';action=null;target=null;orderDestination=null;focusTile=null;render();
  toast('Returned from the Archive to your active chronicle.');
}
  break;
case 'invoke-precedent':await change(()=>Game.invokePrecedent(state,id),{tone:'agreement'});break;
case 'performance-check':await startPerformanceCheck();break;
case 'performance-check-save':if(performanceReport)download(new Blob([JSON.stringify(performanceReport,null,2)+'\n'],{type:'application/json'}),
  `imperium-performance-${performanceReport.measuredAt.slice(0,10)}.json`);
  break;
case 'performance-check-use':if(performanceReport){
  modal.close();stopMotion();pendingMotion=null;graphics.setMode(performanceReport.recommendation);settings.quality=graphics.mode;saveSettings();
  clearBattleCache();render();
  announce(`Graphics `+
  `quality set to ${performanceReport.recommendation}.`);
}break;
case 'render-report':{const report=battleStage.stage?.stats?.();showModal('Current frame report',report?`<p>Current quality: ${esc(report.quality)}. Measured `+
  `in this browser; no claim of physical-device testing.</p>`+
  `<p>Graphics backend: ${esc(report.device?.renderer??'Unavailable')} `+
  `· ${report.device?.software?'software rendering':'hardware status requires device verification'}</p>`+
  `<pre class="frame-report">${esc(JSON.stringify(report.frameProfile,null,2))}</pre>`+
  `<p>GPU query: ${report.gpu?.supported?'available':'unavailable'} · resolution scale ${report.resolution?.scale??1} · `+
  `draws ${report.calls}</p>`:'<p>Open a 3D encounter to collect a frame report.</p>');break;}
case 'expanded-upgrade':await change(()=>Game.enableExpandedCampaign(state));break;
case 'approach-upgrade':await change(()=>Game.enableFieldApproaches(state));break;
case 'field-approach':await change(()=>Game.chooseFieldApproach(state,id));break;
case 'command-upgrade':await change(()=>Game.enableCommandCampaign(state));break;
case 'operational-plan':await change(()=>Game.chooseOperationalPlan(state,id));break;
case 'inspect-case':showModal('Present a documented case',casePreview(state,id));break;
case 'present-case':await change(()=>Game.presentCase(state,id),
  {tone:'agreement',afterRender:()=>{if(state.encounter?.commandCampaign?.case===id)modal.close();}});
  break;
case 'reset-controls':settings.keyBindings={...CONTROL_DEFAULTS};saveSettings();render();showSettings();break;
case 'field-action':await change(()=>Game.fieldAction(state,id),{tone:'brace'});break;
case 'policy-motion':await change(()=>Game.tablePolicy(state,id,'original'),{tone:'agreement'});break;
case 'policy-amend':await change(()=>Game.tablePolicy(state,id,'amended'),{tone:'agreement'});break;
case 'invoke-fieldwork':await change(()=>Game.invokeFieldwork(state,id),
  {tone:'brace',afterRender:()=>{if(uses3D())battleStage.stage?.sound?.cue('fieldwork',{intensity:.75});}});
  break;
case 'apply-archive-mutators':{
  if(!state.archiveReplay)break;
  const opts={difficulty:document.querySelector('#archive-difficulty')?.value,weather:document.querySelector('#archive-weather')?.value,
    timeOfDay:document.querySelector('#archive-time')?.value,route:document.querySelector('#archive-route')?.value},
    source=archivePrimaryState||state,res=Game.createArchiveReplay(source,state.archiveReplay.encounterId,opts);
  if(res.ok){state=res.state;selected='hero';action=null;target=null;orderDestination=null;focusTile=null;render();toast(res.message);}else toast(res.message);
  break;
}
case 'scrub-step':{
  const x=b.dataset.x!==''?Number(b.dataset.x):null,y=b.dataset.y!==''?Number(b.dataset.y):null;
  if(Number.isFinite(x)&&Number.isFinite(y)){
    focusTile={x,y};if(b.dataset.unit&&state.encounter?.units?.some(u=>u.id===b.dataset.unit))selected=b.dataset.unit;
    if(uses3D())battleStage.focusPoint(focusTile);else paint();
  }
  if(b.title)toast(b.title);break;
}
case 'share-card':{
  const file=shareFile;if(!file){toast('The card is still being prepared.');break;}
  try{
    if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'My Imperium reign'});else{
      download(file,'imperium-reign.png');toast('Card downloaded. Share it using your preferred app.');
    }
  }catch(error){if(error.name!=='AbortError')toast('Sharing was unavailable. Use Download card.');}
  break;
}
    }
  });
document.addEventListener('input',event=>{
  const control=event.target;
  if(['river','farms','town'].includes(control?.id)){
    const prev=document.querySelector('#allocation-preview');
    if(prev)prev.outerHTML=allocationDraftPreview({river:Number(document.querySelector('#river')?.value),farms:Number(document.querySelector('#farms')?.value),
      town:Number(document.querySelector('#town')?.value)});
  }
});
document.addEventListener('change',async event=>{
  const control=event.target;
  if(control.dataset?.binding){
    const next=remapControl(settings.keyBindings,control.dataset.binding,control.value);
    if(next){settings.keyBindings=next;saveSettings();render();showSettings();document.getElementById(control.id)?.focus();}return;
  }
  const toggle=SETTING_TOGGLES[control.id];
  if(toggle){settings[toggle.key]=control.checked;saveSettings();if(toggle.stage)battleStage[toggle.stage](control.checked);if(toggle.render)render();return;}
  if(control.id==='hold-delay'){settings.holdDelay=holdDelay(control.value);saveSettings();render();return;}
  if(['river','farms','town'].includes(control.id)){
    const prev=document.querySelector('#allocation-preview');
    if(prev)prev.outerHTML=allocationDraftPreview({river:Number(document.querySelector('#river')?.value),farms:Number(document.querySelector('#farms')?.value),
      town:Number(document.querySelector('#town')?.value)});
  }
  if(control.matches('.company-slot')){
    const ids=[...document.querySelectorAll('.company-slot')].map(node=>node.value);await change(()=>Game.selectCompany(state,ids),{tone:null});
  }
  if(['music-setting','ambience-setting','voices-setting'].includes(control.id)){
    settings[control.id.replace('-setting','')]=control.checked;saveSettings();soundscape.configure(settings);soundscape.unlock();
  }
  if(control.id==='soundtrack-volume'){
    settings.soundtrackVolume=audioLevel(Number(control.value)/100);saveSettings();soundscape.configure(settings);soundscape.unlock();
    const label=document.querySelector('#soundtrack-volume-value');if(label)label.textContent=Math.round(settings.soundtrackVolume*100)+'%';
  }
  if(control.id==='figure-style'){
    settings.figureStyle=FIGURE_STYLES.includes(control.value)?control.value:'sculpted';saveSettings();battleStage.figures(settings.figureStyle);
  }
  if(control.id==='delegate-inspect'){
    const unit=state.encounter.units.find(u=>u.id===control.value&&!u.hidden&&u.role==='voter');
    if(unit){
      focusTile={x:unit.x,y:unit.y,unitId:unit.id};action=null;target=null;orderDestination=null;render();
      announce('Considering an agreement with '+unit.name+'. No speech has been spent.');
    }
  }
  if(control.id==='unit-select'){selected=control.value;action=null;target=null;orderDestination=null;render();}
  if(control.id==='action-select')chooseAction(control.value||null);
  if(control.id==='restore-file'&&control.files?.[0]){
    const file=control.files[0],field=document.querySelector('#restore-code');if(file.size>3000000){toast('Save file is too large.');return;}
    const text=await file.text();if(field?.isConnected)field.value=text;
  }
  if(control.id==='audio-volume'){
    settings.audioVolume=audioLevel(Number(control.value)/100);saveSettings();soundscape.configure(settings);soundscape.unlock();
    battleStage.audio(settings.audio,settings.audioVolume);battleStage.unlock();const label=document.querySelector('#audio-volume-value');
    if(label)label.textContent=Math.round(settings.audioVolume*100)+'%';sound('click',settings.audio,settings.audioVolume);
  }
  if(control.id==='text-size'){settings.textScale=Number(control.value);saveSettings();render();}
  if(control.id==='battle-view'){settings.battleView=control.value;failed3D=false;saveSettings();render();}
  if(control.id==='graphics-quality'){
    stopMotion();pendingMotion=null;graphics.setMode(control.value);settings.quality=graphics.mode;saveSettings();clearBattleCache();render();
  }
  if(control.id==='target-select'){
    const i=control.value;target=i===''?null:targets()[Number(i)];orderDestination=null;render();if(target)announce(Game.preview(state,command()).message);
  }
  if(control.id==='formation-kind'){formation=control.value;render();}
  if(control.id==='order-kind'){orderAction=control.value;orderDestination=null;render();}
  if(control.id==='order-destination'){
    const [x,y]=(control.value||'').split(',').map(Number);orderDestination=control.value&&Number.isInteger(x)&&Number.isInteger(y)?{x,y}:null;render();
    if(target)announce(Game.preview(state,command()).message);
  }
  if(control.id==='reign-card-theme'){await showShare(control.value);return;}
  if(['audio-setting','motion-setting'].includes(control.id)){
    stopMotion();pendingMotion=null;replay.stop();settings[control.id==='audio-setting'?'audio':'reducedMotion']=control.checked;saveSettings();
    soundscape.configure(settings);soundscape.unlock();document.documentElement.dataset.reduced=settings.reducedMotion;
    battleStage.audio(settings.audio,settings.audioVolume);battleStage.reduced(settings.reducedMotion);mountPainting();
    if(settings.audio){battleStage.unlock();if(!uses3D())sound('click',true,settings.audioVolume);}else stopAudio();paint();
  }
});
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.repeat||event.altKey||event.ctrlKey||event.metaKey||modal.open||screen==='title'||state?.phase!=='encounter'||sessionGate.busy)return;
  if(event.target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
  const shortcut=controlAction(event.key,settings.keyBindings);
  if(uses3D()){
    if(shortcut==='horizon'){
      event.preventDefault();if(battleStage.stage){battleStage.horizon();announce('Horizon view. Camera only; your orders are unchanged.');}return;
    }
    if(shortcut==='focus'){event.preventDefault();battleStage.focus();announce('Camera focused on active unit.');return;}
    if(event.key==='Home'){event.preventDefault();battleStage.home();announce('Camera reset to default overview.');return;}
    if(event.key==='+'||event.key==='='){event.preventDefault();battleStage.zoom(-3);return;}
    if(event.key==='-'){event.preventDefault();battleStage.zoom(3);return;}
  }
  if(state.encounter.status!=='active')return;
  const next=keyboardAction(event.key,Game.getActions(state,selected));
  if(next){event.preventDefault();chooseAction(next);return;}
  if(event.key==='Escape'){event.preventDefault();cancelCommand();}
  else if(shortcut==='undo'&&Game.canUndoMove(state,selected).available){
    event.preventDefault();change(()=>Game.undoMove(state,selected),{tone:'move',clearSelection:true});
  }
  else if(shortcut==='next'){
    event.preventDefault();selected=nextReadyUnit(state,selected);action=null;target=null;focusTile=null;render();announce(`Selected ${selectedUnit().name}.`);
  }
  else if(shortcut==='endTurn'){event.preventDefault();change(()=>Game.endTurn(state),{tone:'turn',turn:true,command:{action:'endTurn'},clearSelection:true});}
  else if(shortcut==='grid'){event.preventDefault();showGrid=!showGrid;render();}
});
window.addEventListener('resize',()=>{stopMotion();requestAnimationFrame(()=>{paint();startAtmosphere();});});
document.addEventListener('visibilitychange',()=>{
  document.documentElement.dataset.hidden=document.hidden;
  if(document.hidden){
    stopAudio();stopMotion();pendingMotion=null;replay.stop();
    if(state&&!state.archiveReplay&&!memoryOnly&&!saving&&!saveConflict&&!sessionGate.busy&&JSON.stringify(state)!==lastPersisted)sessionGate.run(async()=>{
      await persist();render();
    }).catch(error=>{if(error.code!=='SESSION_BUSY')console.error(error);});
  }else render();
});
subscribeSaveChanges(()=>{if(state&&!memoryOnly){saveConflict=true;saveProblem='The chronicle changed in another tab. Load the latest save to continue here, '+
  'or export this tab’s progress.';lastSaved='';render();announce(saveProblem);}});
const loaded=await loadLocal();state=loaded.state;lastPersisted=state?JSON.stringify(state):'';render();if(loaded.error)toast(loaded.error+' The unreadable '+
  'data stays on this device; Settings can download it.');try{preservedUnreadable=(await listUnreadableSaves()).length;}catch{preservedUnreadable=0;}
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
