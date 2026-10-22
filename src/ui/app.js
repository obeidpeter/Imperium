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
import {SETTINGS_KEY,SETTING_TOGGLES,choosePace,followDifficulty,loadSettings} from './settings.js';
import {normalizeControls,controlsFor,chamberFor} from '../core/controls-model.js';
import {realtimeEncounterView,fieldMarkup,relabelField} from './realtime-view.js';
import {realtimeLesson} from './realtime-lessons.js';
import {tpAuditTotal} from '../core/tp-audit.js';
import {chamberEncounterView,documentPreview} from './chamber-view.js';
import * as Chamber from '../core/chamber.js';
import {KEY_GROUPS,eventBinding,keyLabel,keymapChanges,keymapFrom,remapAction} from './action-map.js';
import {ITEMS} from '../data/items.js';
import {TRAINERS} from '../data/soldier.js';
import {campFor,CAMP_PLACES,PLACE_NAMES,PLACE_HINTS} from '../data/camps.js';
import {practicePanel} from './command-edition-views.js';
import {SLOT_IDS,listSlots,writeSlot,readSlot,clearSlots} from './save-slots.js';
import {warCouncilAdvisories} from './campaign-upgrade-views.js';
import {actionFor} from './action-map.js';
import {kitPanel,characterPanel as soldierCharacterPanel,decorationsPanel,companyPanel as soldierCompanyPanel,ordersEditor,squadOrdersEditor,quartermasterPanel,trainerPanel,
  adoptPanel,missionOrdersPanel,chroniclePanel,traderPanel} from './soldier-views.js';
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
// The player's real-time keys: one map, changed in place, shared by the field, its hints and the page's own keys.
const keymap=keymapFrom(settings.realtimeKeys);
const soundscape=campaignSoundscape();soundscape.configure(settings);
function storedSettings(){try{return localStorage.getItem(SETTINGS_KEY);}catch{return null;}}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}}
// The development menu: always in the source tree (npm run dev), and in a build with ?dev in the address.
const devMenu=CONFIG.development!==false||/[?&]dev(?:[=&]|$)/.test(globalThis.location?.search??'');
const graphics=createGraphicsQuality({mode:settings.quality,
  onChange:({mode,reason})=>{
    battleStage.quality(mode);mountPainting();settings.quality=mode;saveSettings();document.documentElement.dataset.quality=mode;
    const control=document.querySelector('#graphics-quality');if(control)control.value=mode;
    if(reason==='measured-cost')announce(`Graphics `+
  `changed to ${mode} after repeated slow rendering. You can choose a different quality in Settings.`);
  }});
const {header,footer,titleView,meters,requirements,camp,realtimeCamp,promotion,ending}=createCampaignViews(()=>({state,screen,settings,saving,lastSaved,saveProblem,
  saveConflict,offline,offlineProgress,currentChapterOffline,artProgress}));
const {showNew,showMap,showLedger,showSettings,showPerformanceCheck,showHelp,showHistory,showJournal,showCharacter,showRestore,showNavigation,showCredits,
  showPrivacy,showExportCode,showRecoveryRecords,showRecoveryVerified,showImportVerified,showStorageUnavailable,showRetry,showTakeover,showSharePreview}=createPanels(()=>({state,
    screen,settings,offline,currentChapterOffline,offlineProgress,showModal,meters,requirements,preservedUnreadable,devMenu,keymap}));
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
  if(Game.isRealtime(state))return realtimeEncounterView({state,saving,lastSaved,saveProblem,saveConflict,keymap});
  if(chamberMode())return chamberEncounterView({state,saving,lastSaved,saveProblem,saveConflict,known:chamberKnown()});
  selected=selectedUnit().id;if(action&&!Game.getActions(state,selected).includes(action)){action=null;target=null;orderDestination=null;}
  const view=encounterView({view3D:uses3D(),can3D:chapterHas3D(state),fastMotion:Boolean(settings.fastMotion),confirmMoves:Boolean(settings.confirmMoves),
    keyBindings:settings.keyBindings,coach:settings.coach,guide:settings.guide,state,selected,action,target,focusTile,showGrid,formation,orderAction,
    orderDestination,feedback,header,footer,requirements,saving,lastSaved,saveProblem,saveConflict,artProgress,offlineProgress});
  // A battle begun on the 0.38 board, in a chapter that now plays in real time (a chronicle from before 0.40): it can restart from its checkpoint.
  const legacy=state.encounter.kind==='battle'&&state.encounter.status==='active'&&!state.archiveReplay&&controlsFor(settings,state.chapter)==='realtime';
  return legacy?view.replace(/(<main\b[^>]*>)/,`$1<aside class="command-save-warning legacy-battle" role="note"><p>This battle began on the turn-based board. Its chapter `+
    `now plays in real time: restart it from its checkpoint, the battle's start with everything as it was, or finish it here.</p><div>`+
    `<button data-cmd="restart-realtime">Restart in real time</button></div></aside>`):view;
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
  // Time and pace follow this chronicle's difficulty until the player chooses their own.
  followDifficulty(settings,state?.difficulty);
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
  updatePage(app,screen==='title'?titleView():state?.phase==='encounter'?battle():state?.phase==='promotion'?promotion():state?.phase==='epilogue'?ending()
    :campMode()?realtimeCamp():camp());
  soundscape.update(state,screen);
  const target=fieldTarget();
  if(target)mountField(target);
  else if(uses3D()){
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
  if(field&&!target)disposeField();
  const ceremonyHost=document.querySelector('[data-ceremony]'),ceremony3D=Boolean(ceremonyHost&&settings.battleView!=='2d'&&!failed3D);
  if(ceremony3D)ceremony.mount(ceremonyHost,
    {kind:ceremonyHost.dataset.ceremony,name:state?.name,quality:graphics.mode,reducedMotion:settings.reducedMotion,figureStyle:settings.figureStyle});else ceremony.release();
  mountPainting();
  for(const id of openPanels){const panel=document.getElementById(id);if(panel)panel.open=true;}
  if(screen==='title')cleanupSiteMedia=setupSiteMedia(app);
  prepareChapterArt();
  renderScheduler.schedule({activeId});
  askSoldier();
}
// The recruit's training and appearance as chosen in the open panel (New Game, or a chronicle's one-time choice).
function recruitChoice(){
  const path=modal.querySelector('input[name="recruit-path"]:checked')?.value??'legionary';
  return {path,appearance:Object.fromEntries([...modal.querySelectorAll('[data-appearance]')].map(el=>[el.dataset.appearance,Number(el.value)]))};
}
// A chronicle begun before 0.40 is asked once, in camp, to choose its soldier's training (build brief §3.17).
// Choosing grants the training points of the chapters it has completed; until then the rules read a Legionary.
let soldierAsked=false;
function askSoldier(){
  if(soldierAsked||!state||state.soldier||screen==='title'||state.phase!=='camp'||state.archiveReplay||settings.controlsModel!=='realtime'||modal.open)return;
  soldierAsked=true;queueMicrotask(()=>{if(!modal.open&&!state.soldier)showSoldierPanel('adopt');});
}
function mountPainting(){
  const host=paintingHost(app,{title:screen==='title',ceremony3D:settings.battleView!=='2d'&&!failed3D});
  if(host)scenePainting.mount(host,{chapter:state?.chapter,quality:graphics.mode,reducedMotion:settings.reducedMotion});else scenePainting.release();
}
// ——— The real-time field (0.40): one per fight, kept between renders. The
// world steps on the page; the chronicle receives it only when it is saved
// (pause, a hidden page, F2) or resolved. ———
let field=null;
// What the field plays: a fight's saved world, or (a chamber) the Contest itself, which a retry or a load replaces.
const fieldSource=()=>chamberMode()?state.encounter:state?.encounter?.realtime?.resume??state?.encounter?.realtime?.world??null;
// A camp walks in real time when its chapter does (and the 3D view is on: 2D parity comes with its own view).
function campMode(){return !!state&&screen!=='title'&&state.phase==='camp'&&!state.archiveReplay&&controlsFor(settings,state.chapter)==='realtime'&&!!campFor(state.chapter);}
// A Contest is walked as a chamber once its chapter's chamber exists (chamberFor); the
// archive's sandbox replays keep the 0.38 board with its mutators.
function chamberMode(){return !!state&&screen!=='title'&&state.phase==='encounter'&&state.encounter?.kind==='contest'&&!state.archiveReplay&&chamberFor(settings,state.chapter);}
// What the page's field shows now: a real-time fight, a walkable camp, a chamber, or nothing.
function fieldTarget(){
  if(screen==='title'||!state)return null;
  if(Game.isRealtime(state))return {kind:'field',key:`fight:${state.encounter.id}`};
  if(chamberMode())return {kind:'chamber',key:`chamber:${state.encounter.id}`};
  if(campMode())return {kind:'camp',key:`camp:${state.chapter}:${state.encounterIndex}:${state.decisions[Game.getChapter(state).decision.id]??''}`};
  return null;
}
// The stage's encounter for a camp: its fine map, nothing to fight.
function campBase(world){
  const c=campFor(state.chapter);
  return {id:c.id,kind:'battle',type:'camp',chapter:state.chapter,title:c.title,objective:'Walk the camp: talk to people, then march out through the gate.',
    width:world.map.width,height:world.map.height,terrain:world.map.terrain,units:[],weather:null,timeOfDay:'day'};
}
function mountField(target){
  const host=document.querySelector('#rt-host');if(!host)return;
  if(field&&(field.kind!==target.kind||!field.element.isConnected||(target.kind==='field'&&field.key!==target.key)))disposeField();
  if(field){
    if(field.runtime&&target.kind==='field'&&field.source!==fieldSource()){
      // A retry or a load brings another fight here: the same field plays it.
      field.source=fieldSource();field.runtime.load(Game.realtimeWorld(state),state.encounter);
    }else if(field.runtime&&target.kind==='chamber'){
      // A retry, a patron's re-run or a load brings another session of the chamber; otherwise the chamber follows the Contest.
      if(field.source!==fieldSource()){field.source=fieldSource();field.runtime.load(field.makeWorld(state),state.encounter);}else field.runtime.chamberSync();
    }else if(field.runtime&&target.kind==='camp'&&field.key!==target.key){
      // The camp changed (a decision, another encounter ahead): the same field walks the new one, from where the soldier stands.
      const was=field.runtime.world.actors.find(a=>a.id==='hero'),next=Game.createCampWorld(state),hero=next.actors.find(a=>a.id==='hero');
      if(was&&field.chapter===state.chapter)Object.assign(hero,{x:was.x,z:was.z,px:was.x,pz:was.z,fx:was.fx,fz:was.fz});
      field.key=target.key;field.chapter=state.chapter;field.runtime.load(next,campBase(next));refreshCampMarks();
    }
    mountFieldStage();return;
  }
  host.insertAdjacentHTML('beforeend',fieldMarkup({state,keymap,kind:target.kind}));
  const element=host.querySelector('.rt-field'),ticket={};
  field={ticket,kind:target.kind,key:target.key,chapter:state.chapter,encounterId:state.encounter?.id??null,source:fieldSource(),element,runtime:null};
  Promise.all([import('../showcase/realtime-field.js'),import('../core/realtime/chamber-world.js')]).then(([{createRealtimeField,fieldDom},{createChamberWorld}])=>{
    if(field?.ticket!==ticket||!element.isConnected)return;
    // A hearing's chamber has its presiding magistrate at the tribunal.
    const camp=target.kind==='camp',chamber=target.kind==='chamber';field.makeWorld=s=>createChamberWorld(s,{magistrate:Chamber.isHearing(s)});
    const world=camp?Game.createCampWorld(state):chamber?field.makeWorld(state):Game.realtimeWorld(state);
    field.runtime=createRealtimeField({dom:fieldDom(element),world,base:camp?campBase(world):state.encounter,options:settings,keymap,appearance:()=>state.soldier?.appearance,
      holdDelay:()=>settings.holdDelay??450,callbacks:camp?campCallbacks():chamber?chamberCallbacks():fieldCallbacks(),kind:target.kind});
    mountFieldStage();if(camp)refreshCampMarks();element.querySelector('canvas')?.focus({preventScroll:true});
  }).catch(error=>{console.error(error);toast(`The real-time field could not start: ${error.message}`);});
}
// ——— The chamber (from Chapter VII): its walks, speeches and yields are recorded in the
// chronicle like any Contest command (chamber.js checks them); the field animates what they did. ———
// The guided opening in real time (realtime-lessons.js), while Settings → Guided opening is on.
const lessonFor=kind=>(world,seen)=>settings.guide===false?null:realtimeLesson({state,world,kind,seen,keymap});
function chamberCallbacks(){
  return {
    lesson:lessonFor('chamber'),onMenu:()=>showNavigation(),onPanel:name=>openPanel(name),onQuickSave:()=>quickSave(),
    chamber:{state:()=>state,apply:op=>chamberApply(op),known:id=>chamberKnown().has(id),ask:id=>{if(!chamberKnown().has(id)){chamberKnown().add(id);render();}},
      inspect:id=>showModal('Inspect a document',documentPreview(state,id))}
  };
}
function chamberApply(op){
  return new Promise(resolve=>{
    let outcome=null;
    const run=()=>{outcome=op.kind==='walk'?Chamber.walk(state,op.unitId,op.tile):op.kind==='speak'?Chamber.speak(state,op.command):op.kind==='yield'?Chamber.yieldFloor(state)
      :{ok:false,message:'That is not a chamber command.'};return outcome;};
    const action=op.command?.action??op.command?.kind,tone=op.kind==='walk'?null:op.kind==='yield'?'turn':['threaten','denounce'].includes(action)?'threaten':['promise','agreement'].includes(action)?'agreement':'click';
    Promise.resolve(change(run,{tone,silent:true,afterRender:()=>resolve(outcome)})).then(()=>resolve(outcome));
  });
}
// A speech from the page's own panels (a case, the policy motion, a precedent, an agreement): through the chamber, so its hour can end.
async function chamberSpeech(command,{afterRender=null,tone='agreement'}={}){
  let outcome=null;
  await change(()=>{outcome=Chamber.speak(state,command);return outcome;},{tone,afterRender:()=>{if(outcome?.ok)field?.runtime?.chamberSync(outcome);afterRender?.();}});
}
// The interests asked about in this chamber: free knowledge, kept for the session and not in the save.
let chamberAsked={key:null,ids:new Set()};
function chamberKnown(){const key=state?.encounter?.id??null;if(chamberAsked.key!==key)chamberAsked={key,ids:new Set()};return chamberAsked.ids;}
function startCampaignEncounter(){
  return change(()=>Game.startEncounter(state,{...(state.chapter===12?{route:state.route||'backer'}:{}),
    ...(controlsFor(settings,state.chapter)==='realtime'?{controls:'realtime'}:{})}),{reset:true});
}
// ——— Camp: conversations, places and the people with something new to say. ———
function campCallbacks(){
  return {
    lesson:lessonFor('camp'),onTalk:id=>{const a=field?.runtime?.world.actors.find(x=>x.id===id);if(a?.talk)showConversation(a.talk.tree);},
    onObject:id=>{const o=field?.runtime?.world.objects.find(x=>x.id===id);if(o?.talk)showConversation(o.talk);},
    onMenu:()=>showNavigation(),onPanel:name=>openPanel(name),onHud:world=>{noteVisit(world);refreshMissionPanel();},onQuickSave:()=>quickSave()
  };
}
function noteVisit(world){
  const place=Game.campPlaceAt(world);if(!place||!state.soldier||Game.campVisited(state).includes(place)||sessionGate.busy)return;
  change(()=>Game.campVisit(state,place),{tone:null,silent:true});
}
// A speech mark over everyone whose conversation offers something new: an errand, a decision, the oath or a reward.
function refreshCampMarks(){
  const world=field?.runtime?.world;if(!world||field.kind!=='camp')return;const marks={};
  for(const a of world.actors.filter(x=>x.talk))if(Game.campHasNews(state,a.talk.tree))marks[a.id]={text:'“',color:'#f1d38a'};
  field.runtime.setMarks(marks);
}
let conversation=null;
function showConversation(treeId,nodeId=null){
  const view=Game.campConversation(state,treeId,nodeId);if(!view){toast('No one answers.');return;}
  conversation={treeId,nodeId:view.nodeId};
  showModal(view.speaker,`<p class="dialogue-text">${esc(view.text)}</p><ol class="dialogue-options" aria-label="Replies: press a number">`+
    view.options.map((o,i)=>`<li><button class="dialogue-option ${o.needs.length?'is-dimmed':''}" data-cmd="reply" data-id="${o.index}" ${o.needs.length?'aria-disabled="true"':''}>`+
      `<kbd>${i+1}</kbd> ${o.needs.length?`<span class="dialogue-needs">[${esc(o.needs.join(', '))}]</span> `:''}<span>${esc(o.text)}</span>`+
      `${o.preview.length?` <small>${esc(o.preview.join(' · '))}</small>`:''}</button></li>`).join('')+'</ol>');
  modal.dataset.conversation=treeId;
}
async function replyConversation(index){
  if(!conversation)return;const {treeId,nodeId}=conversation;
  const view=Game.campConversation(state,treeId,nodeId),option=view?.options.find(o=>o.index===index);
  if(option?.needs.length){toast(`Needs ${option.needs.join(', ')}.`);return;}
  let outcome=null;
  await change(()=>{outcome=Game.campReply(state,{treeId,nodeId,index});return outcome;},{tone:'click',silent:true,afterRender:()=>{
    if(!outcome?.ok)return;refreshCampMarks();
    if(outcome.open){modal.close();followUp(outcome.open);}else if(outcome.next){showConversation(treeId,outcome.next);}else modal.close();
    if(outcome.message)toast(outcome.message);
  }});
}
// What a reply opens next: a panel, the War Council, the practice post, or the march.
function followUp(open){
  if(open==='march'){startCampaignEncounter();return;}
  if(open==='council'){showCouncil();return;}
  if(open==='practice'){showModal('Practice completed encounters',practicePanel(state)||'<p>No completed encounter to practise yet.</p>');return;}
  if(open.startsWith('trainer:')){showSoldierPanel('trainer',open.slice(8));return;}
  showSoldierPanel(open);
}
function showCouncil(){
  const voices=warCouncilAdvisories(state);
  showModal('The War Council',(voices.length?voices.map(a=>`<article class="war-council-card"><div><span class="eyebrow">${esc(a.role)} · ${esc(a.focus)}</span>`+
    `<h4>${esc(a.name)}</h4><blockquote>“${esc(a.quote)}”</blockquote></div></article>`).join(''):'<p>No officers are present to advise you.</p>')+
    '<div class="panel-actions"><button data-cmd="conversation" data-id="table">Back to the table</button></div>');
}
// The camp's map (M): its places, and travel to those already walked to.
function showCampMap(){
  const visited=new Set(Game.campVisited(state));
  showModal('The camp',`<ul class="rt-camp-places">${CAMP_PLACES.map(id=>`<li><span><strong>${esc(PLACE_NAMES[id])}</strong> <small>${esc(PLACE_HINTS[id])}</small></span>`+
    `<button data-cmd="camp-travel" data-id="${id}" ${visited.has(id)||id==='gate'?'':'disabled title="Walk there once first."'}>${visited.has(id)||id==='gate'?'Go there':'Not yet visited'}</button></li>`).join('')}</ul>`);
}
function campTravel(place){
  const runtime=field?.runtime,p=runtime?.world.places?.[place];if(!p){toast('The camp is not open.');return;}
  if(modal.open)modal.close();const outcome=runtime.issue({actorId:runtime.world.heroId,kind:'travel',payload:{x:p.x,z:p.z+2}});
  if(outcome.ok){runtime.follow();announce(`${PLACE_NAMES[place]}.`);}
}
function mountFieldStage(){
  const runtime=field?.runtime;if(!runtime)return;
  const canvas=field.element.querySelector('canvas');
  // The 2D view (or no WebGL): the same field drawn flat, with the same commands and lists.
  if(settings.battleView==='2d'||failed3D){
    battleStage.release();
    if(!field.flat&&!field.flatLoading){
      const mine=field;mine.flatLoading=true;
      import('../showcase/flat-stage.js').then(({FlatStage})=>{
        if(field!==mine||!canvas.isConnected)return;mine.flatLoading=false;
        mine.flat=new FlatStage(canvas,{onFrame:cost=>{graphics.recordFrame(cost,{hidden:document.hidden,active:!modal.open});field?.runtime?.frameDone();}});
        mine.runtime?.attach(mine.flat);canvas.parentElement.dataset.ready='true';
      }).catch(error=>{console.error(error);toast(`The 2D view could not start: ${error.message}`);});
    }
    return;
  }
  if(field.flat){field.flat.dispose();field.flat=null;}
  const own=battleStage.mount(canvas,{encounter:runtime.stageView(),chapter:state.chapter,rank:state.rank,commendations:{},live:true,input:false,
    quality:graphics.mode,figureStyle:settings.figureStyle,actionCamera:settings.actionCamera!==false,battleRemains:settings.battleRemains!==false,
    adaptiveResolution:settings.adaptiveResolution,motionSpeed:1,holdDelay:settings.holdDelay,reducedMotion:settings.reducedMotion,audio:settings.audio,
    audioVolume:settings.audioVolume,paused:modal.open,
    onFrame:cost=>{graphics.recordFrame(cost,{hidden:document.hidden,active:!modal.open});field?.runtime?.frameDone();},
    onReady:stage=>{if(field?.runtime)field.runtime.attach(stage);}});
  if(own&&runtime.stage!==own)runtime.attach(own);
}
function disposeField(){const old=field;field=null;old?.runtime?.dispose();old?.flat?.dispose();old?.element?.remove();}
// For the automated checks (browser smoke): a read-only view of the fight and the same commands a player gives.
window.__realtime={world:()=>field?.runtime?.world??null,issue:command=>field?.runtime?.issue(command)??{ok:false},paused:()=>field?.runtime?.paused??null};
// The same for a chamber: what the rules hold (read-only) and whether the field is playing the rivals' hour or the division.
window.__chamber={active:()=>chamberMode()&&!!field?.runtime?.chamber,hour:()=>chamberMode()?Chamber.hourView(state):null,
  coalition:()=>chamberMode()?Chamber.coalitionView(state):null,reach:id=>chamberMode()?Chamber.reach(state,id):[],
  unit:id=>chamberMode()?structuredClone(state.encounter.units.find(u=>u.id===id)??null):null,busy:()=>field?.runtime?.chamber?.busy??null,
  talking:()=>field?.runtime?.chamber?.talking??null,pending:()=>field?.runtime?.chamber?.pending??null,stage:()=>field?.runtime?.stage??null,
  // The Command list's own path (chamber-control.js use): a walk, a speech, a conversation or a yield, as a player gives them.
  use:command=>field?.runtime?.chamber?.use(command)??false};
// Keep the chronicle's copy of the fight: the resume point after a pause, a hidden page or a quick save.
// ——— Quick save and the named saves (§3.17). ———
// A picture of the moment for a save: the 2D canvas as it stands, or a frame the 3D stage draws for it.
// Without one the slot shows its number.
function savePicture(){
  try{
    const c=field?.flat?field.element.querySelector('canvas'):null;
    if(c){const t=document.createElement('canvas');t.width=160;t.height=90;t.getContext('2d').drawImage(c,0,0,160,90);return t.toDataURL('image/jpeg',.6);}
    return field?.runtime?.stage?.picture?.(160,90)??null;
  }catch{return null;}
}
function slotSummary(){
  const ch=Game.getChapter(state),e=state.encounter;
  return `Chapter ${roman(state.chapter)} · ${e&&state.phase==='encounter'?e.title:state.phase==='camp'?'In camp':ch.title}`;
}
// Bring the fight in progress into the chronicle first, so the save holds it exactly.
function syncFieldIntoChronicle(){const w=field?.runtime?.world;if(w&&field.kind==='field'&&Game.isRealtime(state)&&state.encounter.status==='active')Game.saveRealtime(state,w);}
function quickSave(){saveToSlot('quick','Quick save');}
function saveToSlot(id,name){
  const problem=Game.manualSaveProblem(state)??(modal.open&&modal.dataset.conversation?'Saving waits until the conversation ends.':null);
  if(problem){toast(problem);return false;}
  syncFieldIntoChronicle();
  try{writeSlot(id,state,{name,summary:slotSummary(),thumbnail:savePicture()});}catch(error){toast(error.message);return false;}
  toast(id==='quick'?'Quick saved. Menu → Saves loads it.':`Saved: ${name}.`);if(modal.open&&modal.dataset.panel==='saves')showSaves();return true;
}
function showSaves(){
  const problem=Game.manualSaveProblem(state),slots=listSlots();
  showModal('Saves',`<p class="panel-note">${problem?esc(problem):'Each save keeps everything, battle time and the random seed included, so a loaded fight continues exactly.'}`+
    `${state?.ironDiscipline?' <button class="text-link" data-cmd="end-iron">Turn off Iron discipline (it cannot be turned on again)</button>':''}</p>`+
    `<ul class="save-slots">${slots.map(s=>`<li class="save-slot">${s.thumbnail?`<img src="${esc(s.thumbnail)}" width="160" height="90" alt="">`:
      `<span class="save-slot-blank" aria-hidden="true">${s.id==='quick'?'F2':s.id}</span>`}<div><strong>${esc(s.id==='quick'?'Quick save':s.empty?`Slot ${s.id}`:s.name)}</strong>`+
      `<small>${s.empty?'Empty':`${esc(s.summary)} · ${esc(new Date(s.savedAt).toLocaleString())}`}</small>`+
      `${s.id!=='quick'?`<label class="visually-hidden" for="slot-name-${s.id}">Name for slot ${s.id}</label><input id="slot-name-${s.id}" maxlength="60" value="${esc(s.empty?slotSummary():s.name)}">`:''}</div>`+
      `<div class="save-slot-actions"><button data-cmd="slot-save" data-id="${s.id}" ${problem?'disabled':''}>Save here</button>`+
      `<button data-cmd="slot-load" data-id="${s.id}" ${s.empty?'disabled':''}>Load</button></div></li>`).join('')}</ul>`);
}
async function loadSlot(id){
  let candidate;try{candidate=readSlot(id);}catch(error){toast(error.message);return;}
  disposeField();await replaceCampaign({load:async()=>candidate,save:value=>saveLocal(value,{replace:true}),message:'Save loaded.'});
}
function saveField(world,{announced=false}={}){
  if(!Game.isRealtime(state)||state.encounter.status!=='active'||state.archiveReplay)return;
  const saved=Game.saveRealtime(state,world);if(!saved.ok)return;if(field)field.source=fieldSource();
  if(sessionGate.busy||saveConflict){if(announced)toast(saveConflict?saveProblem:'Saving… try again in a moment.');return;}
  sessionGate.run(()=>persist()).then(result=>{
    const label=document.querySelector('.save-status');if(label)label.textContent=result?.ok?'Saved':'';
    if(announced)toast(result?.ok?'Saved. The fight continues from here after a reload.':saveProblem);
  }).catch(error=>{if(error.code!=='SESSION_BUSY')console.error(error);});
}
function fieldCallbacks(){
  return {
    lesson:lessonFor('field'),onSave:world=>saveField(world),
    // Play resumed: the resume point is discarded on this first tick, so it is never used twice.
    onResume:()=>{if(Game.clearResume(state).ok){if(field)field.source=fieldSource();if(!sessionGate.busy&&!saveConflict)sessionGate.run(()=>persist()).catch(()=>{});}},
    onQuickSave:()=>quickSave(),
    onEnd:world=>change(()=>{const r=Game.resolveRealtime(state,world);if(field)field.source=fieldSource();return r;}),
    onMenu:()=>showNavigation(),
    onPanel:name=>fieldPanel(name),
    onTalk:id=>fieldTalk(id),
    onLoot:id=>fieldLoot(id)
  };
}
// The panel keys (guide "Panels"), in the field and in camp.
function openPanel(name){
  if(['kit','character','decorations','company','orders'].includes(name))showSoldierPanel(name==='orders'?'mission':name);
  else if(name==='journal')showJournal();
  else if(name==='chronicle')showSoldierPanel('chronicle');
  else if(name==='map'||name==='overlay')campMode()?showCampMap():showMap();
  else if(name==='options')showSettings();
  // Help opens the guide where the player is: the chamber at its Contests, a fight at its battles, a camp at the campaign.
  else if(name==='help')showHelp(chamberMode()?'political-contests':Game.isRealtime(state)?'battles':campMode()?'the-campaign':undefined);
}
const fieldPanel=name=>openPanel(name);
// The soldier's panels (soldier-views.js): each command goes to Game.soldierCommand,
// and the panel is drawn again with the focus where it was.
let kitSelected=null,soldierPanel=null;
// The mission orders panel's field intelligence follows the field while it is open (at most once a second).
let missionPanelAt=0;
function refreshMissionPanel(){
  const now=performance.now();if(!modal.open||soldierPanel?.name!=='mission'||modal.dataset.soldier!=='mission'||now-missionPanelAt<1000)return;
  missionPanelAt=now;showSoldierPanel('mission');
}
let soldierPreview=null,soldierPreviewGeneration=0;
function disposeSoldierPreview(){soldierPreviewGeneration++;soldierPreview?.dispose();soldierPreview=null;}
async function showSoldierPreview(){
  const canvas=modal.querySelector('[data-soldier-preview]'),status=modal.querySelector('[data-preview-status]');
  if(!canvas)return;const generation=soldierPreviewGeneration;
  if(typeof canvas.getContext!=='function'||typeof globalThis.WebGLRenderingContext==='undefined'){
    if(status)status.textContent='Your equipped items are listed below.';return;
  }
  try{
    const {mountSoldierPreview}=await import('../showcase/soldier-preview.js');
    if(generation!==soldierPreviewGeneration||!modal.open||!canvas.isConnected)return;
    const preview=soldierPreview=mountSoldierPreview(canvas,{soldier:state.soldier,name:state.name,chapter:state.chapter,rank:state.rank,
      reducedMotion:settings.reducedMotion,onError:text=>{if(status)status.textContent=text;}});
    for(const button of modal.querySelectorAll('[data-preview-turn]'))button.onclick=()=>preview.rotate(Number(button.dataset.previewTurn)*Math.PI/6);
    const reset=modal.querySelector('[data-preview-reset]');if(reset)reset.onclick=()=>preview.reset();
    await preview.ready;
    if(generation===soldierPreviewGeneration&&canvas.dataset.preview!=='unavailable'&&status)status.textContent='Drag or use the arrows to inspect your equipped outfit.';
  }catch{if(generation===soldierPreviewGeneration&&status)status.textContent='Model unavailable. Your equipped items are listed below.';}
}
function showSoldierPanel(name,arg=null){
  if(!state)return;
  // A chamber's world is its people, not a fight: the panels read the chronicle there.
  soldierPanel={name,arg};const world=field&&field.kind!=='chamber'?field.runtime?.world??null:null,spoils=world?world.spoils.map(x=>x.itemId):state.encounter?.staged?.spoils??[];
  const panels={kit:()=>['Kit',kitPanel(state,{selected:kitSelected,spoils,documents:chamberMode()?Chamber.hearingDocuments(state):[]})],character:()=>['Your soldier',soldierCharacterPanel(state)],
    decorations:()=>['Decorations & titles',decorationsPanel(state)],company:()=>['Company & standing orders',soldierCompanyPanel(state,{world})],
    orders:()=>['Standing orders',ordersEditor(state,arg)],'squad-orders':()=>[`${(state.company?.find(v=>v.id===arg)?.name??'The').split(' ').at(-1)}’s squad: standing orders`,squadOrdersEditor(state,arg)],quartermaster:()=>['The quartermaster',quartermasterPanel(state)],trader:()=>['The sutler',traderPanel(state)],
    trainer:()=>[TRAINERS[arg]?.name??'Trainer',trainerPanel(state,arg)],
    adopt:()=>['Your soldier’s training',adoptPanel(state,{grants:Object.fromEntries(['legionary','explorator','librarius'].map(p=>[p,tpAuditTotal(Math.max(0,...(state.completed??[])),p)]))})],
    mission:()=>['Mission orders',missionOrdersPanel(state,{world,requirements:requirements()})],chronicle:()=>['The chronicle',chroniclePanel(state)]};
  const [title,body]=(panels[name]??panels.character)();
  const active=document.activeElement,keep=modal.open&&modal.contains(active)?['cmd','kind','uid','place','attribute','course','item','companion','preset','id']
    .map(k=>active.dataset?.[k]!==undefined?`[data-${k}="${CSS.escape(active.dataset[k])}"]`:'').join(''):'';
  showModal(title,body);modal.dataset.soldier=name;void showSoldierPreview();
  if(keep){const again=modal.querySelector(keep);if(again&&!again.disabled)again.focus({preventScroll:true});}
}
function soldierAct(command){
  return change(()=>Game.soldierCommand(state,command),{tone:'click',afterRender:()=>{if(soldierPanel)showSoldierPanel(soldierPanel.name,soldierPanel.arg);}});
}
function fieldTalk(id){
  const world=field?.runtime?.world,person=world?.actors.find(a=>a.id===id);if(!person)return;
  showModal(person.name,`<p>${esc(person.talk?.line??`${person.name} nods. “Keep your shield up.”`)}</p>`);
}
function fieldLoot(id){
  const world=field?.runtime?.world,body=world?.actors.find(a=>a.id===id);if(!body)return;
  showLoot(body);
}
const itemName=id=>ITEMS[id]?.name??id;
// The items already chosen from this body in the take waiting for the next tick (while paused, the window's choices wait there).
function pendingTake(world,bodyId){return [...world.queue].reverse().find(c=>c.kind==='take'&&c.actorId===world.controlled&&c.payload.targetId===bodyId)?.payload.items??[];}
function showLoot(body){
  const world=field?.runtime?.world;if(!world)return;
  const left=[...(body.loot??[])],pending=[...pendingTake(world,body.id)];
  const rows=left.map((item,i)=>{const at=pending.indexOf(item),taken=at>=0;if(taken)pending.splice(at,1);
    return `<li><span>${esc(itemName(item))}</span>${taken?'<span class="status-pill">Taken</span>':`<button data-cmd="rt-take" data-id="${esc(body.id)}" data-item="${esc(item)}" data-key="take:${i}">Take</button>`}</li>`;});
  showModal(`Search ${body.name}`,left.length?`<ul class="rt-loot">${rows.join('')}</ul>`+
    `<div class="panel-actions"><button class="primary" data-cmd="rt-take" data-id="${esc(body.id)}" data-item="*">Take all</button></div>`+
    `<p class="panel-note">What you take goes to your pack when the result is recorded.</p>`:'<p>Nothing left worth taking.</p>');
}
function takeLoot(bodyId,itemId){
  const runtime=field?.runtime,world=runtime?.world,body=world?.actors.find(a=>a.id===bodyId);if(!body)return;
  const pending=pendingTake(world,bodyId),left=[...body.loot];for(const id of pending)left.splice(left.indexOf(id),1);
  const items=itemId==='*'?[...pending,...left]:[...pending,itemId];
  if(!runtime.issue({actorId:world.controlled,kind:'take',payload:{targetId:bodyId,items}}).ok)return;
  showLoot(body);
  // Running, the take happens on the next tick: show what is left once it has.
  if(!runtime.paused)requestAnimationFrame(()=>requestAnimationFrame(()=>{if(modal.open&&modal.dataset.panel?.startsWith('search'))showLoot(body);}));
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
function showModal(title,body,{menu=false}={}){
  disposeSoldierPreview();
  // The Menu always pauses the world; other panels as Pause in panels says.
  stopMotion();pendingMotion=null;replay.stop();battleStage.pause(true);if(menu||settings.panelPause!==false)field?.runtime?.pauseFor('panel');
  if(!modal.open){const el=document.activeElement;modalReturn={element:el,cmd:el?.dataset?.cmd,id:el?.id};}
  modal.dataset.panel=title.toLowerCase().replace(/[^a-z]+/g,'-');
  modal.setAttribute('aria-labelledby','panel-title');modal.removeAttribute('aria-label');
  modal.innerHTML=`<div class="modal-head"><div><span class="eyebrow">IMPERIUM · YOUR CHRONICLE</span><h2 id="panel-title" tabindex="-1">${esc(title)}</h2>`+
    `</div><button class="ghost" data-cmd="close-modal" aria-label="Close panel">×</button></div><div class="modal-body">${body}</div>`;
  modal.scrollTop=0;if(!modal.open)modal.showModal();
  modal.querySelector('#panel-title').focus({preventScroll:true});
}
// ——— Remapping a key (Menu → Controls & readability): Change listens for the next key pressed. ———
let rebinding=null;
const actionName=action=>KEY_GROUPS.flatMap(([,rows])=>rows).find(([a])=>a===action)?.[1]??action;
function startRebind(action){
  if(!keymap[action])return;rebinding=action;const row=modal.querySelector(`.key-row[data-action="${CSS.escape(action)}"]`);row?.classList.add('listening');
  const b=row?.querySelector('[data-cmd="rebind"]');if(b)b.textContent='Press a key…';
  const status=modal.querySelector('#rebind-status');if(status)status.textContent=`Press the new key for ${actionName(action)}, or Esc to cancel.`;
}
function finishRebind(message,{problem=false}={}){
  const action=rebinding;rebinding=null;const top=modal.scrollTop;showSettings();keysOpen();modal.scrollTop=top;
  const status=modal.querySelector('#rebind-status');if(status){status.textContent=message;status.classList.toggle('warning',problem);}
  announce(message);modal.querySelector(`.key-row[data-action="${CSS.escape(action)}"] [data-cmd="rebind"]`)?.focus({preventScroll:true});
}
// The key list stays open while the player is remapping.
const keysOpen=()=>{const list=modal.querySelector('details.key-map');if(list)list.open=true;};
// The shared map changes in place: the field's keys, bars and hints follow at once.
function useKeymap(next){
  for(const action of Object.keys(keymap))keymap[action]=[...next[action]];settings.realtimeKeys=keymapChanges(keymap);saveSettings();
  if(field)relabelField(field.element,{state,keymap,kind:field.kind});field?.runtime?.relabel?.();
}
document.addEventListener('keydown',event=>{
  if(!rebinding)return;
  // A modifier alone waits for the key it modifies.
  if(['Shift','Control','Alt','Meta','AltGraph'].includes(event.key))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(event.key==='Escape'){finishRebind(`${actionName(rebinding)} is unchanged.`);return;}
  const binding=eventBinding(event);if(!binding){finishRebind(`Ctrl, Cmd and Alt belong to the browser. ${actionName(rebinding)} is unchanged.`,{problem:true});return;}
  const action=rebinding,r=remapAction(keymap,action,binding);
  if(r.problem){finishRebind(`${r.problem} ${actionName(action)} is unchanged.`,{problem:true});return;}
  const holder=Object.keys(keymap).find(a=>a!==action&&keymap[a].includes(binding));useKeymap(r.keymap);
  finishRebind(`${actionName(action)} is now ${keyLabel(binding)}.${holder?` ${actionName(holder)} takes ${keymap[holder].map(keyLabel).join(' or ')}.`:''}`);
},true);
modal.addEventListener('cancel',event=>{if(rebinding)event.preventDefault();});
modal.addEventListener('keydown',event=>{
  if(!modal.dataset.conversation||event.altKey||event.ctrlKey||event.metaKey)return;const n=Number(event.key);
  if(n>=1&&n<=9){const b=modal.querySelectorAll('[data-cmd="reply"]')[n-1];if(b){event.preventDefault();b.click();}}
});
modal.addEventListener('close',()=>{
  disposeSoldierPreview();
  rebinding=null;const prior=modalReturn;modalReturn=null;
  const el=prior?.element?.isConnected?prior.element:prior?.id?document.getElementById(prior.id):prior?.cmd?document.querySelector(`[data-cmd="${CSS.escape(prior.cmd)}"]`):null;
  if(el?.isConnected)el.focus({preventScroll:true});
  else {const main=document.getElementById('main');if(main){main.tabIndex=-1;main.focus({preventScroll:true});}}
  battleStage.pause(false);startAtmosphere();field?.runtime?.release('panel');soldierPanel=null;delete modal.dataset.soldier;delete modal.dataset.conversation;
});
async function showExport(){showExportCode(await saveCode(Game.codeState(archivePrimaryState??state)));}
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
case 'rt-take':takeLoot(id,b.dataset.item);break;
case 'conversation':showConversation(id);break;
case 'reply':await replyConversation(Number(id));break;
case 'camp-travel':campTravel(id);break;
case 'command-list':modal.close();field?.runtime?.toggleList(true);break;
case 'saves':showSaves();break;
case 'slot-save':saveToSlot(id,id==='quick'?'Quick save':modal.querySelector(`#slot-name-${id}`)?.value||slotSummary());break;
case 'slot-load':await loadSlot(id);break;
case 'end-iron':await change(()=>Game.endIronDiscipline(state));if(modal.open)showSaves();break;
case 'soldier':{const d=b.dataset;
  // The editors open; they change nothing until saved.
  if(d.kind==='orders-edit'||d.kind==='squad-orders-edit'){showSoldierPanel(d.kind==='orders-edit'?'orders':'squad-orders',d.companion);break;}
  if(['wear','drop','give','sell'].includes(d.kind))kitSelected=null;
  await soldierAct({kind:d.kind,uid:d.uid,place:d.place,attribute:d.attribute,courseId:d.course,itemId:d.item,companionId:d.companion,preset:d.preset,path:d.path,from:d.from});
  break;}
case 'soldier-panel':showSoldierPanel(id,b.dataset.arg??null);break;
case 'adopt-soldier':{const choice=recruitChoice();soldierPanel={name:'character'};await soldierAct({kind:'adopt',...choice});break;}
case 'kit-select':kitSelected=kitSelected===id?null:id;showSoldierPanel('kit');break;
case 'orders-save':{
  const slots=[0,1,2,3].map(i=>[modal.querySelector(`#orders-action-${i}`)?.value,modal.querySelector(`#orders-target-${i}`)?.value]).filter(([a])=>a)
    .map(([a,t])=>[a,['follow_close','follow_far','stay_hidden','withdraw'].includes(a)?'hero':t]);
  await soldierAct({kind:'orders',companionId:id,slots});soldierPanel={name:'company'};showSoldierPanel('company');break;}
case 'squad-orders-save':{
  // Hold the line takes no target; the rest keep the one chosen (or the soldier).
  const slots=[0,1,2,3].map(i=>[modal.querySelector(`#squad-orders-action-${i}`)?.value,modal.querySelector(`#squad-orders-target-${i}`)?.value||null]).filter(([a])=>a)
    .map(([a,t])=>[a,a==='hold_line'?null:t??'hero']);
  await soldierAct({kind:'squad-orders',companionId:id,slots});soldierPanel={name:'company'};showSoldierPanel('company');break;}
case 'soldier-party':{
  const party=[...modal.querySelectorAll('[data-cmd="soldier-party"]')].filter(x=>x.checked).map(x=>x.dataset.id);
  if(party.length>3){b.checked=false;toast('Up to three companions march with you.');break;}
  await soldierAct({kind:'party',party});break;}
case 'rt-spoils':await change(()=>{const body=state.encounter?.realtime?.world.actors.find(a=>a.id===id);
  return Game.takeSpoils(state,{bodyId:id,items:b.dataset.item==='*'?[...(body?.loot??[])]:[b.dataset.item]});});break;
case 'retry-chapter':if(state){loadedArtChapter=0;cachedChapterRequest=0;offlineProgress='';prepareChapterArt({retry:true,allowTitle:true});toast('Retrying '+
  'this chapter’s artwork. Other chapters are optional.');}break;
case 'home':modal.close();screen='title';loadedArtChapter=0;artRequest++;artProgress='';clearBattleCache();render();break;
case 'new':showNew();break;
case 'begin':{
  const candidate=Game.newGame(document.querySelector('#name-input').value,undefined,
    {featureEdition:35,progression:true,...recruitChoice(),difficulty:document.querySelector('input[name="campaign-difficulty"]:checked')?.value||'standard',
      ironDiscipline:!!document.querySelector('#iron-discipline')?.checked});
  if(document.querySelector('#new-soundscape')?.checked){
    settings.audio=true;settings.music=true;settings.ambience=true;settings.voices=true;saveSettings();soundscape.configure(settings);soundscape.unlock();
  }
  const result=await replaceCampaign({load:async()=>candidate,save:value=>saveLocal(value,{replace:true}),
    message:'Chapter I. You are a Tiro: a recruit in training.'});
  // One chronicle per device: the new one replaces the old one's saves too.
  if(result.ok)clearSlots();
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
      case 'agreement-counter':if(chamberMode()){await chamberSpeech({kind:'agreement',targetId:id,terms:cmd==='agreement-demand'?'demand':'counteroffer'});break;}
        await change(()=>Game.negotiateAgreement(state,id,cmd==='agreement-demand'?'demand':'counteroffer'),
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
case 'start':await startCampaignEncounter();break;
case 'unit':case 'select-unit':selected=id;action=null;target=null;orderDestination=null;focusTile=null;render();break;
case 'inspect-delegate':if(chamberMode()){if(modal.open)modal.close();field?.runtime?.chamber?.talk(id);break;}{
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
case 'invoke-precedent':if(chamberMode()){await chamberSpeech({kind:'precedent',id});break;}await change(()=>Game.invokePrecedent(state,id),{tone:'agreement'});break;
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
case 'inspect-case':if(chamberMode())showModal('Inspect a document',documentPreview(state,id));else showModal('Present a documented case',casePreview(state,id));break;
case 'present-case':if(chamberMode()){await chamberSpeech({kind:'case',id},{afterRender:()=>{if(state.encounter?.commandCampaign?.case===id)modal.close();}});break;}
  await change(()=>Game.presentCase(state,id),
  {tone:'agreement',afterRender:()=>{if(state.encounter?.commandCampaign?.case===id)modal.close();}});
  break;
case 'reset-controls':settings.keyBindings={...CONTROL_DEFAULTS};saveSettings();render();showSettings();break;
case 'rebind':startRebind(id);break;
case 'restart-realtime':await change(()=>Game.restartInRealtime(state));break;
case 'help-section':showHelp(id);modal.scrollTop=0;break;
case 'reset-keys':useKeymap(keymapFrom());showSettings();keysOpen();announce('Every key is back to its default.');modal.querySelector('[data-cmd="reset-keys"]')?.focus();break;
case 'field-action':await change(()=>Game.fieldAction(state,id),{tone:'brace'});break;
case 'policy-motion':case 'policy-amend':{const terms=cmd==='policy-motion'?'original':'amended';
  if(chamberMode()){await chamberSpeech({kind:'policy',id,terms});break;}await change(()=>Game.tablePolicy(state,id,terms),{tone:'agreement'});break;}
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
  // The pointer's habits, labels, objective markers and floating numbers: stored, and the live field reads them at once.
  if(control.dataset.rtSetting){const key=control.dataset.rtSetting;settings[key]=control.type==='checkbox'?control.checked:!!control.value;saveSettings();
    field?.runtime?.setOption?.(key,settings[key]);return;}
  const toggle=SETTING_TOGGLES[control.id];
  if(toggle){settings[toggle.key]=control.checked;saveSettings();if(toggle.stage)battleStage[toggle.stage](control.checked);if(toggle.render)render();return;}
  if(control.id==='hold-delay'){settings.holdDelay=holdDelay(control.value);saveSettings();render();return;}
  if(control.dataset.pace){const key=control.dataset.pace;choosePace(settings,key,control.type==='checkbox'?control.checked:control.value);saveSettings();
    field?.runtime?.setOption?.(key,settings[key]);return;}
  if(control.id==='controls-model'){Object.assign(settings,normalizeControls({...settings,controlsModel:control.value}));saveSettings();render();return;}
  if(control.matches?.('.realtime-chapter')){
    const chapters=[...document.querySelectorAll('.realtime-chapter')].filter(box=>box.checked).map(box=>Number(box.value));
    Object.assign(settings,normalizeControls({...settings,realtimeChapters:chapters}));saveSettings();return;
  }
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
// Panel keys away from the field (camp, promotion, the record): I, C, J, Q, L, M, R, A, O and ?.
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.repeat||modal.open||screen==='title'||!state||Game.isRealtime(state)||sessionGate.busy)return;
  if(event.target?.closest?.('input,select,textarea,[contenteditable="true"],canvas'))return;
  const action=actionFor(event,keymap);if(!action)return;
  if(action==='quick_save'){event.preventDefault();quickSave();return;}
  const name=action==='help'?'help':action==='map_overlay'?'map':action.startsWith('panel_')?action.slice(6):null;
  if(!name||(state.phase==='encounter'&&!['kit','character','decorations','company','journal','chronicle','options','help'].includes(name)))return;
  event.preventDefault();openPanel(name);
});
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.repeat||event.altKey||event.ctrlKey||event.metaKey||modal.open||screen==='title'||state?.phase!=='encounter'||sessionGate.busy)return;
  // A real-time field or a chamber takes its keys on its own scene (realtime-field.js).
  if(Game.isRealtime(state)||chamberMode())return;
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
