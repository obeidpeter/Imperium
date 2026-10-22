import {relationshipLedger} from './progression-views.js';
import {controlPreferences,controlHelp,applyControlLabels} from './control-preferences.js';
import * as Game from '../core/game.js';
import {difficultyChoices,soundscapeSettings} from './campaign-upgrade-views.js';
import {recruitChoices} from './soldier-views.js';
// The generated guide is part of the shell, so Controls & rules works offline.
import {GUIDE_HELP} from '../data/guide-help.js';
import {guideHelpView} from './guide-help-view.js';
import {CHAPTERS,CAST,HISTORICAL_NOTES,choiceEchoes} from '../data/campaign.js';
import {heroPortrait,speakerPortrait,journeyMap} from './art.js';
import {esc,roman,companyPanel} from './view-helpers.js';
import {ALL_CHAPTERS,REALTIME_READY_CHAPTERS} from '../core/controls-model.js';

const phaseLabel = phase => ({camp:'In camp',encounter:'Encounter in progress',promotion:'Promotion awaiting',epilogue:'Chronicle complete'}[phase] || phase);
const statusLabel = status => ({open:'Open',honoured:'Honoured',broken:'Broken'}[status] || status);
const actions = body => body ? `<div class="panel-actions settings-controls">${body}</div>` : '';
const section = (title,body,extra='') => `<section class="panel-section ${extra}"><h3 class="panel-section-heading">${title}</h3>${body}</section>`;
const empty = text => `<p class="panel-empty">${text}</p>`;
const facts = rows => `<dl class="panel-facts">${rows.map(([name,value])=>`<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
const chronicleIdentity = state => `<div class="panel-lead"><p class="eyebrow">CHAPTER ${roman(state.chapter)} · ${esc(state.rank)}</p>`+
  `<h3>${esc(state.name)}</h3><p>${esc(CHAPTERS[state.chapter-1]?.title||'')} · ${esc(phaseLabel(state.phase))}</p></div>`;

export function createPanels(context){
  function showNew(){
    const {state,showModal}=context();
    showModal('Your chronicle begins',`<div class="panel-lead"><p class="eyebrow">THE DANUBE FRONTIER · AD 250</p>`+
      `<p>You are twenty, newly arrived from a village near the Danube. Your first rank is <strong>Tiro</strong>: a recruit in training. Begin with Varro’s `+
      `short drill, then swear the oath that will follow you to Rome.</p></div><div class="panel-form"><label for="name-input">Your Roman name</label>`+
      `<input id="name-input" type="text" maxlength="40" value="Aurelius Marcellus" autocomplete="off" aria-describedby="name-hint">`+
      `<p id="name-hint" class="settings-description">Up to 40 characters. This name appears in your chronicle and optional reign card.</p>`+
      `</div>${recruitChoices()}${difficultyChoices()}<label class="setting" for="iron-discipline"><span>Iron discipline<small class="muted">No saving inside `+
      `encounters, by quick save or by name; a save code copied mid-encounter carries only its checkpoint. It can be lifted later, never taken up again.</small>`+
      `</span><input id="iron-discipline" type="checkbox"></label><p class="panel-note">New chronicles include operational preparations, chapter-specific field opportunities, coordinated `+
      `enemy doctrines, documented political cases, mechanical weather, policy debates, branching operations, veteran specializations and recurring political `+
      `agreements. Restored chronicles keep the rules they began with.</p><label class="setting" for="new-soundscape">`+
      `<span>Enable the soundscape<small class="muted">Music, environmental sound and optional voiced briefings. You can adjust each in Settings.</small>`+
      `</span><input id="new-soundscape" type="checkbox"></label>${state?`<aside class="panel-note notice">`+
      `<strong>A new beginning replaces this device’s campaign.</strong>`+
      `<p>Keep a portable save code if you want to return to ${esc(state.name)}’s chronicle. The replaced campaign also enters local recovery records.</p>`+
      `<button data-cmd="export">Export existing chronicle</button>`+
      `</aside>`:''}${actions('<button class="primary" data-cmd="begin">Begin as a recruit</button>'+
      '<button data-cmd="close-modal">Not yet</button>')}<p class="settings-description">No account. No installation required. Progress saves on this device `+
      `when browser storage is available. Offline play becomes available after the required content has downloaded.</p>`);
  }

  function showMap(id,selectedTheatre=null){
    const {state,showModal}=context();
    const chapters=id?CHAPTERS.filter(c=>c.id===id):CHAPTERS;
    const completed=state?.completed||[],current=state?.chapter||0,history=state?.history||[];
    const theatres=[
      ['danube','Danube Frontier',[1,3,4,7],'Frontier forts, road stations, and the northern legions at Milan.'],
      ['abritus','Marshes of Abritus',[2],'Wetland rearguard actions after the Gothic breakthrough.'],
      ['euphrates','Euphrates & Edessa',[5,6],'Eastern siege lines, countermines, and desert rearguard columns.'],
      ['crossing','Danube Crossings',[8],'Negotiated river parleys and settler convoy escorts.'],
      ['palmyra','Palmyra & the East',[9],'Aurelian’s eastern coalition and cataphract engagements.'],
      ['province','Dacia Aureliana',[10],'Provincial grain convoys, land tenure judgments, and tribunal votes.'],
      ['rome','Rome & the Curia',[11,12],'Senatorial accounts, adlection, and the final succession confrontation.'],
    ];
    const dossiers=`<div class="tabula-dossiers" aria-label="Imperial theatre dossiers">${theatres.map(([slug,title,chIds,summary])=>{
      const isHere=chIds.includes(current),isDone=chIds.every(n=>completed.includes(n)),someDone=chIds.some(n=>completed.includes(n));
      const status=isHere?'Active theatre':isDone?'Pacified':someDone?'Visited':'Unreached';
      const records=history.filter(h=>chIds.includes(h.chapter));
      const ops=(state?.progression?.operationResults||[]).filter(r=>records.some(h=>h.id===r.encounterId));
      const open=(selectedTheatre?selectedTheatre===slug:isHere)?' open':'';
      return `<details class="tabula-theatre" data-theatre="${slug}"${open}><summary><strong>${esc(title)}</strong>`+
        `<span>Chapters ${chIds.map(roman).join(', ')} · ${status}</span></summary><p>${esc(summary)}</p>`+
        `<p class="settings-description">${records.length?`${records.length} encounter${records.length===1?'':'s'} recorded `+
        `(${records.reduce((n,r)=>n+r.turns,0)} turns, ${records.reduce((n,r)=>n+(r.losses||0),0)} `+
        `withdrawn)`:'No encounters committed in this theatre yet.'}${ops.length?` · `+
        `Operations: ${ops.map(o=>`${o.branchId} (${o.outcome})`).join(', ')}`:''}</p></details>`;
    }).join('')}</div>`;
    showModal(id?`Chapter ${roman(id)}`:'The road to the purple',`<div class="panel-lead"><p class="eyebrow">TWELVE CHAPTERS · ONE EARNED CAREER</p>`+
      `<p>Each appointment follows the service you earn.</p></div><div class="campaign-progress">`+
      `<span>${completed.length} of `+
      `XII chapters complete</span>${state?`<strong>Current: chapter ${roman(current)} `+
      `· ${esc(state.rank)}</strong>`:'<strong>Your service begins in chapter I</strong>'}</div><details class="route-map" open>`+
      `<summary>View the campaign’s route</summary>${journeyMap(current,completed,selectedTheatre)}${dossiers}</details>`+
      `<ol class="campaign-list map-list" aria-label="Chapter progression">${chapters.map(c=>{
      const open=state?Game.canAccess(state,c.id):c.id===1;
      const status=completed.includes(c.id)?'complete':c.id===current?'current':open?'available':'locked';
      const labels={complete:'Completed',current:'Current chapter',available:'Available',locked:'Locked'};
      const locked=c.id===11?'Complete chapters I–IX, earn Dux, then complete the governorship in X.':c.id===12?'Complete XI, win its decisive political '+
        'challenge, and receive Senator status.':`Complete chapter ${roman(c.id-1)} and its promotion requirements.`;
      return `<li class="chapter-entry map-card ${status}" data-status="${status}" ${status==='current'?'aria-current="step"':''}>`+
        `<div class="chapter-number" aria-hidden="true">${roman(c.id)}</div><div class="chapter-copy"><div class="chapter-state">`+
        `<span class="status-pill">${labels[status]}</span><span>${esc(c.year)}</span></div><h3>${esc(c.title)}</h3>`+
        `<p class="chapter-location">${esc(c.location)}</p><p><strong>${esc(c.rank)}</strong> to ${esc(c.promotion)}</p>`+
        `<p>${esc(c.objective)}</p>${!open?`<p class="unlock-note"><strong>Required service</strong>`+
        `<br>${esc(locked)}</p>`:status==='current'?'<p class="unlock-note">Continue your current orders. '+
        'Chapters cannot be skipped.</p>':status==='complete'?'<p class="unlock-note">This chapter is part of your earned record.</p>':''}</div></li>`;
    }).join('')}</ol>${actions(state?'<button class="primary" data-cmd="continue">Continue the '+
      'chronicle</button>':'<button class="primary" data-cmd="new">Begin in chapter I</button>')}`);
  }

  function showLedger(){
    const {state,showModal,meters}=context();
    if(!state){showNew();return;}
    const open=state.obligations.filter(o=>o.status==='open'),due=open.filter(o=>state.chapter>=Number(o.due)),agreements=Game.coalition(state).agreements||[],
      openAgreements=agreements.filter(a=>a.status==='open');
    const obligations=[...state.obligations].sort((a,b)=>Number(b.status==='open')-Number(a.status==='open')),qm=Game.quartermasterForecast(state);
    const qmSection=`<section id="quartermaster-forecast" class="panel-section quartermaster-ledger-section">`+
      `<h3 class="panel-section-heading">Quartermaster solvency & succession forecast</h3>`+
      `<p class="settings-description">${qm.solvent?`Solvency check: ${qm.supplies} supplies on hand cover all ${qm.totalCommittedCost} committed `+
      `obligation and agreement costs (+${qm.netBalance} net reserve).`:`Shortfall warning: ${qm.totalCommittedCost} `+
      `supplies committed against ${qm.supplies} on hand (−${qm.shortfall} deficit; each unpaid supply at accession costs 1 Public Confidence).`}</p>`+
      `<ul class="finale-route-tracker">${qm.finaleRoutes.map(r=>`<li class="${r.unlocked?'is-unlocked':'is-locked'}">`+
      `<strong>${esc(r.label)}</strong> · ${esc(r.requirement)} — <span>${r.unlocked?'✓ Unlocked':esc(r.progress)}</span></li>`).join('')}</ul></section>`;
    showModal('Obligations & alliances',`<div class="panel-lead"><p class="eyebrow">YOUR WORD, ENTERED IN THE RECORD</p>`+
      `<p>Every bargain names a person, a promise, and a price. Promises made inside an encounter become permanent only when you commit its result.</p></div>`+
      `<div class="ledger-summary panel-statline"><span><strong>${open.length+openAgreements.length}</strong> open</span><span>`+
      `<strong>${due.length+openAgreements.filter(a=>a.dueNow).length}</strong> due now</span><span><strong>${state.supplies}</strong> supplies</span>`+
      `</div>${qmSection}<div class="ledger-list">${obligations.length?obligations.map(o=>{
      const isDue=state.chapter>=Number(o.due),canSettle=isDue&&state.phase==='camp'&&o.status==='open';
      return `<article class="obligation" data-status="${esc(o.status)}"><div class="obligation-meta">`+
        `<span class="status-pill">${esc(statusLabel(o.status))}</span>`+
        `<span>${o.status==='open'&&isDue?'Due now':`Due chapter ${roman(Number(o.due))}`}</span></div><p class="eyebrow">OWED TO</p><h3>${esc(o.to)}</h3>`+
        `<p class="obligation-promise">${esc(o.promise)}</p><p><strong>${Number(o.cost)||2} supplies</strong> to honour</p>`+
        `<p class="settings-description">${esc(o.consequence||'Honour the debt at accession or lose '+
        'public and political trust.')}</p>${canSettle?actions(`<button class="primary" data-cmd="settle-honour" data-id="${esc(o.id)}">Honour `+
        `· ${Number(o.cost)||2} supplies</button><button data-cmd="settle-break" data-id="${esc(o.id)}">Break · −8 `+
        `Public, −4 Backing</button>`):o.status==='open'&&isDue?'<p class="panel-note">Resolve this obligation when you return to camp.</p>':''}</article>`;
    }).join(''):empty('No oath or patron obligations are outstanding. Negotiated '+
      'agreements are recorded below.')}</div>${relationshipLedger(state)}${section('Your standing',`${meters()}<p class="settings-description">Retry `+
      `restores the complete encounter checkpoint, `+
      `including staged promises.</p>`)}${section('The people beside you',
        `<div class="alliance-list">${Object.entries(CAST).map(([id,c])=>`<article class="alliance-entry">`+
      `<img class="avatar-mini" src="${speakerPortrait(id)}" width="360" height="360" loading="lazy" alt="${esc(c.name)}"><div>`+
      `<p class="eyebrow">${esc(c.role)}</p><h3>${esc(c.name)}</h3>`+
      `<p>${esc(c.description)}</p>${state.relationships[id]!==undefined?`<span class="status-pill">Relationship ${state.relationships[id]}</span>`:''}</div>`+
      `</article>`).join('')}</div>`)}`);
  }

  function showSettings(){
    const {state,settings,offline,currentChapterOffline,offlineProgress,showModal,preservedUnreadable,devMenu,keymap}=context();
    const options=(list,current)=>list.map(([value,label])=>`<option value="${value}" ${current===value?'selected':''}>${label}</option>`).join('');
    const offlineStatus=offline?'All twelve chapters are available offline.':offlineProgress?esc(offlineProgress):currentChapterOffline?`Chapter ${roman(state?.chapter||1)} `+
      `is available offline. Later chapters download as you reach them.`:'The current chapter is not fully cached yet.';
    showModal('Pause & settings',`<p class="panel-lead">Nothing advances while this menu is open.</p>`+
      `${controlPreferences(settings,{keymap:settings.controlsModel==='realtime'?keymap:null})}${pacePreferences(settings,state?.difficulty)}`+
      `<fieldset class="settings-group"><legend>Display & accessibility</legend>`+
      `<label class="setting" for="text-size"><span>Text size<small class="muted">Enlarge text across the game.</small></span>`+
      `<select id="text-size">${[1,1.25,1.5,2].map(n=>`<option value="${n}" ${(settings.textScale||1)===n?'selected':''}>${n*100}%</option>`).join('')}</select>`+
      `</label><label class="setting" for="guide-setting"><span>Guided opening<small class="muted">Step-by-step lessons in the drill, first patrol and `+
      `opening chamber turns.</small></span><input id="guide-setting" type="checkbox" ${settings.guide!==false?'checked':''}></label>`+
      `<label class="setting" for="coach-setting"><span>Contextual tactical advice<small class="muted">Show advice for the current field or chamber `+
      `position.</small></span><input id="coach-setting" type="checkbox" ${settings.coach!==false?'checked':''}></label>`+
      `<label class="setting" for="objective-markers"><span>Objective markers<small class="muted">The mission's next step is marked on the scene. Turn it `+
      `off to find your own way.</small></span><input id="objective-markers" type="checkbox" data-rt-setting="objectiveMarkers" `+
      `${settings.objectiveMarkers!==false?'checked':''}></label><label class="setting" for="floating-numbers"><span>Floating numbers<small class="muted">Damage `+
      `and healing shown over the people concerned.</small></span><input id="floating-numbers" type="checkbox" data-rt-setting="floatingNumbers" `+
      `${settings.floatingNumbers!==false?'checked':''}></label>`+
      `<label class="setting" for="motion-setting"><span>Reduced motion<small class="muted">Remove nonessential motion; action feedback remains `+
      `readable.</small></span><input id="motion-setting" type="checkbox" ${settings.reducedMotion?'checked':''}></label>`+
      `<label class="setting" for="confirm-moves"><span>Confirm moves<small class="muted">Off: selecting open ground walks there at once, or as far toward it `+
      `as this turn allows; Undo Move takes it back until you act. On: the first selection previews the move, and selecting it again or Confirm walks.</small>`+
      `</span><input id="confirm-moves" type="checkbox" ${settings.confirmMoves?'checked':''}></label><label class="setting" for="battle-view">`+
      `<span>Campaign view<small class="muted">Choose 3D scenes or the 2D tactical view for every chapter. Commands and progress are shared.</small></span>`+
      `<select id="battle-view"><option value="3d" ${settings.battleView!=='2d'?'selected':''}>3D scene</option>`+
      `<option value="2d" ${settings.battleView==='2d'?'selected':''}>2D tactical view</option></select></label><label class="setting" for="figure-style">`+
      `<span>3D figure style<small class="muted">Sculpted 3D figures, the campaign's painted figures standing in the 3D scene, or sculpted figures finished `+
      `in ink and wash. Presentation only; tilt-shift and ink need Balanced or High quality.</small></span>`+
      `<select id="figure-style">${options([['sculpted','Sculpted'],['painted','Painted (HD-2D)'],['inked','Ink and wash']],settings.figureStyle??'sculpted')}</select>`+
      `</label><label class="setting" for="action-camera"><span>Action camera<small class="muted">The 3D overview briefly closes in on each committed attack, `+
      `then returns. Never moves with reduced motion or while following a figure.</small></span>`+
      `<input id="action-camera" type="checkbox" ${settings.actionCamera!==false?'checked':''}></label><label class="setting" for="battle-remains">`+
      `<span>Battle remains<small class="muted">The fallen, spent arrows and trodden ground stay on the 3D field until the encounter ends. Presentation only; `+
      `the rules never see them.</small></span><input id="battle-remains" type="checkbox" ${settings.battleRemains!==false?'checked':''}></label>`+
      `<label class="setting" for="adaptive-resolution"><span>Adaptive 3D resolution<small class="muted">Adjust scene resolution using GPU timing or `+
      `sustained missed frames. Text and controls stay sharp.</small></span>`+
      `<input id="adaptive-resolution" type="checkbox" ${settings.adaptiveResolution!==false?'checked':''}></label>`+
      `<label class="setting" for="graphics-quality"><span>Graphics quality<small class="muted">Essential units and tactical information stay visible. `+
      `Repeated slow rendering lowers quality for the next battle, never in the middle of one; Run performance check (below) measures this device.</small>`+
      `</span><select id="graphics-quality">${options([['performance','Performance'],['balanced','Balanced'],['high','High quality']],settings.quality)}</select>`+
      `</label></fieldset><fieldset class="settings-group"><legend>Audio</legend><label class="setting" for="audio-setting">`+
      `<span>Sound effects<small class="muted">Optional. Every action is understandable without sound.</small></span>`+
      `<input id="audio-setting" type="checkbox" ${settings.audio?'checked':''}></label><label class="setting" for="audio-volume">`+
      `<span>Effects volume<small id="audio-volume-value">${Math.round((settings.audioVolume??.5)*100)}%</small></span>`+
      `<input id="audio-volume" type="range" min="0" max="100" step="10" value="${Math.round((settings.audioVolume??.5)*100)}">`+
      `</label>${soundscapeSettings(settings)}</fieldset><section class="settings-group"><h3>Rendering measurements</h3>`+
      `<p id="render-measurements">Measured figures describe this browser session, not a device certification.</p>`+
      `<button data-cmd="render-report">Show current frame report</button>`+
      `<p class="settings-description">The performance check takes about a minute in the current 3D battle: it rebuilds the battle at each quality and turns `+
      `the camera, then shows the results and saves them as a file you can share. Nothing is sent anywhere, and the board takes no commands while it runs.</p>`+
      `<button data-cmd="performance-check">Run performance check</button></section><section class="settings-group"><h3>Downloads & offline play</h3>`+
      `<p id="settings-offline-status" class="panel-note" role="status">${offlineStatus}</p>`+
      `<p>Artwork downloads as you reach each chapter. On suitable connections, the next chapter is prefetched. A complete offline download starts only when `+
      `you choose it below; it uses your current connection.</p>${actions(`${state&&!currentChapterOffline?'<button data-cmd="retry-chapter">Retry this '+
      'chapter’s artwork</button>':''}${!offline&&globalThis.navigator&&'serviceWorker' in globalThis.navigator?'<button data-cmd="retry-offline">Download '+
      'all chapters for offline play</button>':''}`)}<p class="settings-description">No installation is required. On iPhone, Safari’s Share menu offers Add `+
      `to Home Screen. Offline readiness depends on downloaded content remaining in browser storage.</p></section><section class="settings-group">`+
      `<h3>Your chronicle & saved data</h3><p>Actions save on this device when browser storage is available. Check the save status for confirmation. Keep a `+
      `portable code: browsers `+
      `can clear local data.</p>${actions(`${state?'<button data-cmd="export">Copy a save code</button>':''}<button data-cmd="restore">Restore a save `+
      `code</button>`+
      `<button data-cmd="recovery">Recover an `+
      `earlier checkpoint</button>`)}${preservedUnreadable?`<p class="panel-note">${preservedUnreadable===1?'One stored chronicle':`${preservedUnreadable} stored chronicles`} `+
      `could not be read by this edition. ${preservedUnreadable===1?'It is':'They are'} kept on `+
      `this device, not deleted.</p>${actions('<button data-cmd="export-unreadable">Download preserved '+
      'unreadable save data</button>')}`:''}<p class="settings-description">The last three distinct checkpoints or replaced chronicles are kept locally. `+
      `Retry restores the encounter-start checkpoint; earlier campaign choices remain.</p>${actions('<button data-cmd="new">Start a new chronicle</button>'+
      '<button data-cmd="privacy">Privacy & local data</button>')}</section><section class="settings-group">`+
      `<h3>Reference & support</h3>${actions(`<button data-cmd="help">Controls & rules</button><button data-cmd="history">Historical notes</button>`+
      `<button data-cmd="credits">Art & credits</button>${state?'<button data-cmd="character">Character & equipment</button>'+
      '<button data-cmd="journal">Mission journal</button>'+
      '<button data-cmd="map">Campaign</button>':''}`)}</section>${devMenu?developmentSettings(settings,options):''}`+
      `${actions('<button class="primary full" data-cmd="close-modal">Close settings</button>')}`,{menu:true});
  }
  // Time and pace (guide "Settings reference"): the real-time encounters' game speed, auto-pause
  // events, pause each round and pause in panels. Until one is changed they follow the difficulty.
  function pacePreferences(settings,difficulty){
    const check=(id,key,label,hint)=>`<label class="setting" for="${id}"><span>${label}<small class="muted">${hint}</small></span>`+
      `<input id="${id}" type="checkbox" data-pace="${key}" ${settings[key]?'checked':''}></label>`;
    const level=difficulty==='story'?'Story':difficulty==='veteran'?'Veteran':'Standard';
    return `<fieldset class="settings-group pace-settings"><legend>Time and pace</legend><p class="settings-description">For real-time encounters. `+
      `${settings.paceChosen?'These are your choices; the difficulty no longer changes them.':`${level} starts here: ${difficulty==='story'?'75% speed, pausing '+
      'when an enemy comes into view':'full speed, with no auto-pause'}. Changing any of them makes the pace yours.`}</p>`+
      `<label class="setting" for="game-speed"><span>Game speed<small class="muted">The normal pace of battle time. V halves it; N steps a round while `+
      `paused.</small></span><select id="game-speed" data-pace="gameSpeed">${[[.5,'50%'],[.75,'75%'],[1,'100%']].map(([v,l])=>`<option value="${v}" `+
      `${settings.gameSpeed===v?'selected':''}>${l}</option>`).join('')}</select></label>`+
      check('pause-sighted','pauseSighted','Auto-pause: an enemy comes into view','Also when an ambush is revealed or reinforcements arrive.')+
      check('pause-hurt','pauseHurt','Auto-pause: badly hurt','Your soldier or a companion below a quarter of his Health, or down.')+
      check('pause-squad','pauseSquad','Auto-pause: a squad breaks','One of your squads breaks and falls back.')+
      check('pause-objective','pauseObjective','Auto-pause: the objective changes','A new objective or phase.')+
      check('pause-order','pauseOrder','Auto-pause: an order cannot be carried out','A command refused, with its reason.')+
      check('round-pause','roundPause','Pause each round','Stop at the start of every round, for a game played almost turn by turn.')+
      check('panel-pause','panelPause','Pause in panels','Opening a panel (kit, character, journal…) pauses the world.')+`</fieldset>`;
  }
  // The development menu (npm run dev, or ?dev in the address): the 0.40
  // conversion's controls model and its per-chapter fallback.
  function developmentSettings(settings,options){
    const chosen=new Set(settings.realtimeChapters??ALL_CHAPTERS);
    return `<section class="settings-group development-settings" aria-labelledby="development-title"><h3 id="development-title">Development: real-time `+
      `conversion</h3><p class="settings-description">Turns keep every 0.38 battle and Contest. Real time opens the standalone skirmish as the real-time `+
      `arena; a chapter switches only when it is listed below and its real-time encounters exist (so far Chapters `+
      `${REALTIME_READY_CHAPTERS.map(roman).join(', ')}; Chapters I–III also have walkable camps).</p>`+
      `<label class="setting" for="controls-model"><span>Controls model</span><select id="controls-model">`+
      `${options([['turns','Turns (0.38)'],['realtime','Real time (0.40, in development)']],settings.controlsModel)}</select></label>`+
      `<fieldset class="setting realtime-chapters"><legend>Chapters in real time when ready</legend>${ALL_CHAPTERS.map(c=>`<label><input type="checkbox" `+
      `class="realtime-chapter" value="${c}" ${chosen.has(c)?'checked':''}> ${roman(c)}${REALTIME_READY_CHAPTERS.includes(c)?'':' <small class="muted">not '+
      'converted</small>'}</label>`).join('')}</fieldset>${actions('<a class="secondary" href="./showcase/arena.html">Open the real-time arena</a>')}</section>`;
  }

  // The performance check's results, the tier it recommends and its file to save.
  function showPerformanceCheck(report){
    const {showModal,settings}=context();
    const label={performance:'Performance',balanced:'Balanced',high:'High quality'},ms=v=>Number.isFinite(v)?`${Math.round(v)} ms`:'—';
    const rows=report.tiers.map(r=>`<tr><th scope="row">${label[r.tier]}</th><td>${r.buildMs===null?'—':ms(r.buildMs)}</td><td>${r.tour.fps??'—'} fps</td>`+
      `<td>${ms(r.tour.intervalMs.p95)}</td><td>${ms(r.tour.gpuMs.p95)}</td><td>${r.tour.longTasks?ms(r.tour.longTasks.maxMs):'—'}</td>`+
      `<td>${r.meetsTarget?`Meets ${r.targetFps} fps`:`Below ${r.targetFps} fps`}</td></tr>`).join('');
    const recommended=report.recommendation,current=settings.quality;
    showModal('Performance check',`<p class="panel-lead">${report.complete?'Measured':'Partly measured (cancelled)'} on this device. Each quality was `+
      `rebuilt, then the camera turned through the overview, follow and horizon views.</p><div class="check-results"><table><thead><tr>`+
      `<th scope="col">Quality</th><th scope="col">Build</th><th scope="col">Typical rate</th><th scope="col">Slowest 5% of frames</th>`+
      `<th scope="col">GPU, slowest 5%</th><th scope="col">Longest freeze</th><th scope="col">Target</th></tr></thead><tbody>${rows}</tbody></table></div>`+
      `<p>Recommended for this device: <strong>${label[recommended]}</strong>${recommended===current?' (your current setting)':''}.</p>`+
      `${report.simulation?`<p class="settings-description">Real-time simulation (0.40, in development): one tick takes ${report.simulation.actors15.p95} ms `+
        `with 15 men, ${report.simulation.actors82.p95} ms with 82${report.simulation.squads6?` and ${report.simulation.squads6.p95} ms with six squads and the party`:''} `+
        `(slowest 5%; budget ${report.simulation.budgetMs} ms).</p>`:''}`+
      `<p class="settings-description">Graphics: ${esc(report.device.renderer??'unknown')}${report.device.software?' (software rendering)':''}. The file `+
      `lists this browser, graphics chip and screen size beside the measurements, and stays on this `+
      `device unless you share it.</p>${actions(`<button class="primary" data-cmd="performance-check-save">Save results `+
      `(JSON)</button>${recommended!==current?`<button data-cmd="performance-check-use">Use ${label[recommended]}</button>`:''}<button data-cmd="close-modal">Close</button>`)}`);
  }

  // Controls & rules: in real time, the player guide's chapters (generated from docs/player-guide-0.40.md);
  // the 0.38 board keeps its own help below.
  function showHelp(page){
    const {showModal,settings={},keymap}=context();
    if(settings.controlsModel==='realtime'){
      showModal('Controls & rules',`<p class="panel-lead">The player guide (${esc(GUIDE_HELP.version)}), chapter by chapter. Its key tables show your own `+
        `keys; elsewhere the text names the default keys.</p>${guideHelpView(GUIDE_HELP,{page:typeof page==='string'?page:undefined,keymap})}`);
      if(typeof page==='string')document.getElementById('guide-page-title')?.focus({preventScroll:true});return;
    }
    showModal('Controls & rules',`${controlHelp(settings)}<div class="panel-lead"><p class="eyebrow">READ THE PREVIEW. THEN COMMIT.</p>`+
      `<p>There is no timer between turns. Choose each action, read its exact effect and cost, then confirm when ready.</p>`+
      `</div>${section('Your first turn',applyControlLabels('<ol class="guide-steps"><li>'+
      '<strong>Select a unit.</strong> Start with your commander; direct control of allies comes later.</li><li>'+
      '<strong>Walk.</strong> Select open ground to walk there; pointing at it first shows the route. Undo Move (U) takes a walk back until the unit '+
      'acts.</li><li><strong>Choose an action.</strong> Legal targets light up on the board.</li><li>'+
      '<strong>Choose a target.</strong> Use the board or the target list.</li><li>'+
      '<strong>Read and confirm.</strong> Check the preview, then press Confirm.</li><li>'+
      '<strong>End your turn.</strong> Uncommanded allies and enemies now act.</li>'+
      '</ol>',settings),'guide-section')}${section('Keyboard & touch',applyControlLabels('<p>'+
      '<strong>Keyboard:</strong> Tab reaches every control; Enter activates it. On the board, arrow keys move the cursor and say where a walk would stop; '+
      'Enter selects a unit, walks to open ground, or previews a target and then confirms that same target. Keys 1–9 choose available actions, N selects the '+
      'next ready unit, U takes back a move until the unit acts, E ends the turn, G toggles the grid, and Escape cancels the preview. In 3D scenes, H '+
      'switches to Horizon view, F focuses on the active unit, Home resets the camera, and + / − zoom. The target selector provides a non-spatial route for '+
      'every action. Native selects use arrow keys.</p><p><strong>Pointer or touch:</strong> select a figure. Select open ground to walk there, or as far '+
      'toward it as this turn allows; pointing first shows the route. On a touch screen, hold a finger on the board to see the route first; lifting it after '+
      'a hold does nothing. Select an opponent to preview a legal command, then activate that same target again or press Confirm. Pause → Confirm moves makes '+
      'walks preview first too. There is no timing-sensitive double tap. Right-click cancels a preview. Named action and target '+
      'selectors remain available.</p>',settings),'guide-section')}${section('Expanded campaign','<p>New chronicles add field objects, cohesion and policy '+
      'debates; a chronicle begun before 0.32 can opt in at camp. To use a field object, bring your commander onto or beside it and press its button in the '+
      'battlefield panel below the board; this spends the commander’s action. Choose one of the two named field opportunities before its deadline; inspect '+
      'the effect before spending your action. A closed gate blocks movement and sight until opened, and a repaired footbridge becomes a ford. From Chapter '+
      'II, cohesion below 40 and suppression of 2 or more each take 1 off a unit’s attacks; Brace or a neighbour restores them. In rain each step onto high '+
      'ground costs one more movement. In Contests, table one policy motion and answer the rival’s amendment; its effects '+
      'apply only if you win.</p>','guide-section')}${section('Planning and evidence','<p>From Chapter III, choose a deployment plan at camp: reconnaissance, '+
      'engineers or a command reserve when available. Every plan has a supply cost and a tactical tradeoff. Costs are paid at departure; Retry restores the '+
      'full checkpoint. The enemy-plan panel shows its current posture and focus.</p>'+
      '<p>Earlier military service, rescues and provincial judgments can support documented political cases. Inspect a case to see every delegate stance '+
      'change before committing one speech. Each hearing permits one case; other speeches and policy proposals remain available. Completed encounters can be '+
      'practiced from camp or the journal without changing the saved chronicle.</p>','guide-section')}${section('On the battlefield','<p>Each unit gets one '+
      'move and one action. Marsh costs extra movement; water is crossed at fords. Walls and high ground protect units. Flanking reduces defence. Cavalry '+
      'gains charge damage after a longer move on firm ground; rough terrain weakens its strike. In revised battles, entering an enemy melee unit’s adjacent '+
      'tile ends that move: use your line to screen vulnerable units. Attacks damage morale on both sides; exposed cavalry charges and high-ground shots have '+
      'explicit previews. The commander’s fall loses the battle. Named companions are wounded in tactical defeat; their permanent fate follows signalled '+
      'narrative choices.</p><p>In chapters I–II you control your commander while companions act on their own. New progression campaigns allow veterans with '+
      'two completed deployments to specialize from Chapter III. Specialist actions require available command capacity; a deployed formation leader adds one '+
      'command per round. Ordinary Order unlocks in IV. Use its intent selector to advance, attack, hold, rally or withdraw toward the commander. Visible '+
      'plans update as the position changes. Formation directs up to three adjacent units for one command, using their existing action limits.</p>'+
      '<dl class="panel-facts"><div><dt>Shield wall</dt><dd>Two protection; movement reduced to one. In revised battles, adjacent shield-wall allies add one '+
      'frontal protection.</dd></div><div><dt>Line</dt><dd>Cross marsh at normal cost and soften morale loss. Adjacent line allies screen ranged attacks by '+
      'one in revised battles.</dd></div><div><dt>Wedge</dt><dd>One extra melee damage on firm open ground; take one extra damage. Revised battles give no '+
      'wedge attack bonus in marsh, fords or fortifications.</dd></div></dl>'+
      '<p>Formations last for the round. In VII, Deploy is available only at the opening of '+
      'battle and spends movement.</p>','guide-section')}${section('In the chamber','<p>Each speaker gets one move and one speech. Stance runs from −6 to +6; '+
      'at +1 a vote supports you. At ±3 commitment hardens and reversing it takes more effort. Resolve is speaking stamina: at 0 Resolve a speaker withdraws '+
      'from speaking for the rest of the debate, while their vote remains.</p>'+
      '<p>Persuade changes one adjacent member. Address changes members within three tiles, with a three-turn cooldown. Each delegate has an interest: Invoke '+
      'Record is strongest for service and may reach each delegate only once. Grain and office interests respond more to a concrete Promise; law responds '+
      'well to Persuade and Address. In revised Contests, Veterans favour Record, Civic delegates favour Persuade and Address, and Landholders favour '+
      'Promise. Two friendly speakers within two tiles cooperate for +1 Persuade. Compare the exact preview.</p>'+
      '<p>Promises shift stance strongly but create a debt: once per recipient, at most two per Contest. Grain and office promises cost three supplies in '+
      'revised Contests; other promises cost two. The preview names the debt and the deadline. Threats cost Public Confidence and harden the bloc. Denounce '+
      'reduces a rival’s Resolve. Rebut heals a friendly speaker or weakens a rival’s next move.</p><p class="panel-note">'+
      '<strong>The deadline vote decides.</strong> Votes are counted at the end of the final turn; an early majority does not end the debate. A tie fails. A '+
      'withdrawn speaker cannot act but keeps their vote. Check your required new capabilities '+
      'before the final turn.</p>','guide-section')}${section('Reading the battlefield','<p>Base arrows show facing; a guard arc marks bracing. Formation '+
      'bases show a line, wedge or battlement. An exclamation marks low morale. Double vote rims show commitment at ±3; wax seals mark promises. Textual '+
      'previews and named selectors provide the same essential information.</p>','guide-section')}${section('If an encounter goes wrong','<p>Retry restores '+
      'the complete encounter-start state and random seed. A lost political Contest also offers costly backing for a new vote; it never grants a rank by '+
      'itself. The final chapter always retains a costly '+
      'backer and minimum force.</p>','guide-section')}${actions('<button class="primary" data-cmd="close-modal">Understood</button>'+
      '<button data-cmd="settings">Accessibility settings</button>')}`);
  }

  function showHistory(){
    const {showModal}=context();
    showModal('History & deliberate adaptations',`<div class="panel-lead"><p class="eyebrow">A HISTORICAL BACKBONE. A FICTIONAL CAREER.</p>`+
      `<p>Public events remain fixed through Aurelian’s murder in 275. The succession then diverges. This condensed career is a dramatic journey, not a `+
      `universal Roman promotion ladder.</p></div><div class="history-list">${HISTORICAL_NOTES.map(n=>`<article class="history-entry panel-section">`+
      `<h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>${n.url?`<a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">Read the historical source `+
      `<span class="settings-description">(opens a new tab)</span></a>`:''}</article>`).join('')}</div>`+
      `<p class="panel-note">Further sources and uncertainties are documented in the source project’s `+
      `historical research notes.</p>${actions('<button data-cmd="credits">Art & credits</button>'+
      '<button data-cmd="close-modal">Close historical notes</button>')}`);
  }

  function showJournal(){
    const {state,showModal,requirements}=context();
    if(!state){showNew();return;}
    const ch=Game.getChapter(state),echoes=choiceEchoes(state),archive=Game.archiveEncounters(state);
    const orders=`<section class="journal-entry panel-lead"><p class="eyebrow">CURRENT ORDERS · CHAPTER ${roman(ch.id)} · ${esc(ch.year)}</p>`+
      `<h3>${esc(ch.title)}</h3><p>${esc(ch.objective)}</p><div class="journal-requirements">${requirements()}</div></section>`;
    const followers=echoes.length?echoes.map(line=>`<p>${esc(typeof line==='string'?line:line.text)}</p>`).join('')
      :empty('Your decisions will be recorded as your service unfolds.');
    const company=`<p>${esc(Game.leadershipSummary(state))}</p>${companyPanel(Game.companyRoster(state),state.progression?.specializations)}`;
    const record=`<ol class="chronicle-list">${state.log.slice().reverse().map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`;
    const replays=archive.length?'<p class="settings-description">Replay any completed field battle or political Contest in an isolated sandbox '+
      'without altering your primary campaign save.</p>'+
      `<ol class="encounter-records">${archive.map(h=>`<li><span class="status-pill">Chapter ${roman(h.chapter)} · Complete</span><h4>${esc(h.title)}</h4>`+
      `<p>${h.recordedTurns} turns · ${h.recordedLosses} allied units withdrawn</p>`+
      `<button class="ghost small" data-cmd="archive-replay" data-id="${esc(h.id)}">Replay in Archive →</button></li>`).join('')}</ol>`
      :empty('Your first encounter is still ahead.');
    showModal('The mission journal',orders+section('What follows you',followers,'journal-entry')+
      section('The people you brought home',company,'journal-entry')+section('Campaign record',record,'journal-entry')+
      section('Completed encounters · Archive of the Reign',replays,'journal-entry')+
      actions('<button data-cmd="ledger">Review obligations</button><button data-cmd="map">View the campaign</button>'));
  }


  function showCharacter(){
    const {state,showModal,meters,requirements}=context();
    if(!state){showNew();return;}
    const ch=Game.getChapter(state),cursus=Game.cursusHonorum(state);
    const portrait=`<figure class="character-portrait"><img src="${heroPortrait(state.rank)}" width="360" height="360" alt="${esc(state.name)} as ${esc(state.rank)}">`+
      `<figcaption>${esc(state.rank)} · A life in service</figcaption></figure>`;
    const identity=`<div class="panel-lead"><p class="eyebrow">YOUR CHRONICLE · CHAPTER ${roman(state.chapter)}</p><h3>${esc(state.name)}</h3>`+
      `<p><strong>${esc(state.rank)}</strong> · ${esc(ch.rankMeaning)}</p></div>`;
    const age=`Approximately ${20+Math.round((state.chapter-1)*25/11)}`;
    const equipment=`<p class="settings-description">The possessions and honours entered in your record.</p><ul class="equipment-list">`+
      `${state.inventory.map((item,i)=>`<li><span class="equipment-number" aria-hidden="true">${roman(i+1)}</span><strong>${esc(item)}</strong></li>`).join('')}</ul>`;
    const ladder=`<ol class="cursus-monument">${cursus.map(step=>`<li class="cursus-step is-${esc(step.status)}">`+
      `<div><span class="status-pill">${roman(step.chapter)} · ${esc(step.year)}</span> <strong>${esc(step.rank)}</strong></div>`+
      `<small>${esc(step.title)} · ${esc(step.location)}${step.turns?` · ${step.turns} turns`:''}${step.decision?` · ${esc(step.decision)}`:''}</small>`+
      '</li>').join('')}</ol>`;
    const appointment=state.phase==='epilogue'?'Your earned appointment':`Next appointment: ${esc(ch.promotion)}`;
    showModal('Your character & equipment',`<div class="character-layout">${portrait}<div class="character-details">${identity}`+
      `${facts([['Age',age],['Origin','Danube frontier'],['Supplies',String(state.supplies)]])}${section('Equipment & insignia',equipment,'equipment-section')}</div></div>`+
      section('Your standing',meters())+section('Cursus Honorum · The Roman ladder',ladder,'cursus-section')+
      section('The company in your care',companyPanel(Game.companyRoster(state),state.progression?.specializations))+
      section(appointment,`${requirements()}<p>${esc(ch.reward)}</p>`)+
      actions('<button data-cmd="ledger">Obligations & alliances</button><button data-cmd="journal">Mission journal</button>'));
  }


  function showRestore(){
    const {state,showModal}=context();
    showModal('Restore your chronicle',`<div class="panel-lead"><p class="eyebrow">BRING YOUR RECORD WITH YOU</p>`+
      `<p>Paste an Imperium save code or choose its text file. The code is validated before you review and confirm the replacement.</p></div>`+
      `<div class="panel-form"><label for="restore-file">Choose a saved text file</label>`+
      `<input id="restore-file" type="file" accept=".txt,.json,text/plain,application/json"><label for="restore-code">Or paste your save code</label>`+
      `<textarea id="restore-code" spellcheck="false" placeholder="SAC1.…" aria-describedby="restore-hint"></textarea>`+
      `<p id="restore-hint" class="settings-description">Codes include your chosen name, game decisions, and current encounter checkpoint. They are checked `+
      `locally.</p></div><p class="panel-note">A confirmed import replaces the local campaign. Export the current save first if you `+
      `want a portable copy.</p>${actions('<button class="primary" data-cmd="import-code">Validate and '+
      'review</button>'+(state?'<button data-cmd="export">Export current chronicle</button>':'')+'<button data-cmd="close-modal">Cancel</button>')}`);
  }

  function showNavigation(){
    const {state,screen,showModal}=context();
    const item=(cmd,label,description,active=false)=>`<button class="menu-link" data-cmd="${cmd}" ${active?'aria-current="page"':''}><strong>${label}</strong>`+
      `<span>${description}</span></button>`;
    const intro=state?`<p class="eyebrow">CHAPTER ${roman(state.chapter)} · ${esc(state.rank)}</p><h3>${esc(state.name)}</h3>`+
      `<p>${esc(phaseLabel(state.phase))}. Opening a panel does not advance a turn.</p>`
      :'<p class="eyebrow">IMPERIUM</p><p>A Roman career, from the first oath to the imperial purple.</p>';
    const fight=state?.phase==='encounter'&&state.encounter?.controls==='realtime'&&state.encounter.status==='active'
      ?`<div class="menu-group">${item('command-list','Command list','Every action as lists, with Use; it works while paused.')}</div>`:'';
    const begin=state?item('continue','Continue the chronicle','Return to your current orders.',screen==='game')
      :item('new','Begin your chronicle','Start as a recruit in AD 250.');
    const chronicle=state?`<div class="menu-group">${item('map','Campaign','Your current chapter and earned progress.')}`+
      `${item('character','Character & equipment','Your rank, possessions, and company.')}`+
      `${item('journal','Mission journal','Orders, decisions, and the service record.')}`+
      `${item('ledger','Obligations & alliances','Who is owed what, and when.')}</div>`+
      `<div class="menu-group">${[['kit','Kit and pack (I)','What you wear and carry, and your coin.'],['character','Your soldier (C)','Attributes, training points and techniques.'],
        ['decorations','Decorations & titles (A)','Honours and what each gives.'],['company','Company & standing orders (R)','Who marches with you, and how they fight.'],
        ['chronicle','The chronicle (L)','The story so far, page by page.']].map(([id,label,text])=>
        `<button class="menu-link" data-cmd="soldier-panel" data-id="${id}"><strong>${label}</strong><span>${text}</span></button>`).join('')}</div>`:'';
    showModal('Your way through the chronicle',`<div class="menu-intro panel-lead">${intro}</div><nav class="menu-links" aria-label="Main navigation">`+
      `${fight}<div class="menu-group">${begin}${item('home','Title & introduction','The game, its world, and how to begin.',screen==='title')}</div>${chronicle}`+
      `<div class="menu-group">${state?item('saves','Saves (F2 quick save)','Quick save, five named saves, and loading them.'):''}${item('settings','Settings & saves','Display, sound, offline content, and backups.')}`+
      `${item('help','Controls & rules','A guide to battles and political Contests.')}`+
      `${item('history','Historical notes','The sources and deliberate adaptations.')}`+
      `${item('credits','Art & credits','How this chronicle was made.')}`+
      `${item('privacy','Privacy & local data','What stays on your device.')}</div></nav>`);
  }


  function showCredits(){
    const {showModal}=context();
    showModal('Art & credits',`<div class="panel-lead"><p class="eyebrow">AN ORIGINAL ROMAN CHRONICLE</p>`+
      `<p>Imperium brings together an original fictional career, deterministic turn-based play, and locally bundled painted artwork.</p>`+
      `</div>${section('Illustration & visual design','<p>Character portraits, settings, and unit atlases were generated for this project with OpenAI’s '+
      'image-generation tool, then prepared and compressed as local assets. No third-party source imagery was supplied. Historical references informed the '+
      'direction; their images were not copied.</p><p>No exclusive copyright or third-party licence ownership is asserted for the generated images. Detailed '+
      'prompts, provenance, transformations, and file hashes are recorded in the asset manifest and art documentation supplied '+
      'with the source project.</p>')}${section('The game on your device','<p>The campaign offers 3D battlefields and political chambers, with articulated '+
      'characters, local materials, shadows and animated action feedback. A Canvas 2D tactical view is also available. All artwork and models are bundled or '+
      'constructed locally; no artwork service runs during play. Near-view male anatomy adapts the MakeHuman Community CC0 base mesh; equipment, costumes and '+
      'horses use original geometry. <a href="./vendor/makehuman/LICENSE.CC0.md" target="_blank" rel="noopener noreferrer">Read the MakeHuman asset license '+
      '(opens a new tab)</a>.</p><p>The campaign 3D view and optional frontier skirmish use Three.js 0.186.1, copyright 2010-2026 three.js authors, under the '+
      'MIT License. Its renderer is bundled locally, without a CDN. <a href="./vendor/three/LICENSE" target="_blank" rel="noopener noreferrer">Read the '+
      'Three.js license (opens a new tab)</a>. The standalone skirmish keeps a separate in-memory session and does not change your campaign save.</p>'+
      '<p>Interface typography uses system fonts with local fallbacks. No external font service or icon package is required. Images, game code, and offline '+
      'content are served with the game; there are no compulsory accounts.</p>')}${section('Music, ambience & voices','<p>Fourteen original recordings '+
      'provide optional music, environmental ambience, combat foley and four fictional voiced moments. They were generated for Imperium using Lyria and '+
      'ElevenLabs through Runway and bundled locally. No real person’s voice was requested or imitated. Exact spoken text remains available on screen.</p>'+
      '<p>Characters use original code-authored sculpted meshes and joint animation clips, with a locally bundled generated material atlas. These are not '+
      'motion-captured performances. Source documentation records the generation prompts and file hashes; no exclusive copyright ownership is '+
      'asserted for generated media.</p>')}${section('History & fiction','<p>The military and political journey condenses a turbulent third-century setting '+
      'into twelve chapters. Names, dialogue, and the protagonist’s career are fictionalised. Historical notes identify the public events and the campaign’s '+
      'deliberate divergence.</p>')}${actions('<button data-cmd="history">Read historical notes</button>'+
      '<button data-cmd="privacy">Privacy & local data</button><button data-cmd="close-modal">Close credits</button>')}`);
  }

  function showPrivacy(){
    const {showModal}=context();
    showModal('Your game stays with you',`<div class="panel-lead"><p class="eyebrow">NO ACCOUNT. YOUR LOCAL CHRONICLE.</p>`+
      `<p>Imperium has no account, advertising, analytics, or game server. The hosting provider may keep ordinary access logs when serving the `+
      `website and its files.</p></div>${section('What this browser keeps','<p>Saves, settings, recovery checkpoints, and downloaded offline content stay in '+
      'this browser. Opening the game in a different browser or on another device does not '+
      'automatically transfer them.</p>')}${section('What you choose to carry or share','<p>A save code contains your chosen name and game decisions. A reign '+
      'card contains your name, broad choices, and the game address. The game does not upload these automatically. Copying uses your clipboard, downloading '+
      'saves a file, and sharing uses the destination you choose in '+
      'your device’s share menu.</p>')}${section('Keeping or clearing your progress','<p>Starting a new chronicle replaces the current campaign and keeps the '+
      'displaced record in local recovery storage when available. Clearing site data removes local saves. Browsers can also evict stored data, so keep a '+
      'portable save code if your progress matters to you.</p>')}${actions('<button data-cmd="settings">Settings & saved data</button>'+
      '<button data-cmd="close-modal">Close privacy notes</button>')}`);
  }

  // These presentation adapters retain app.js ownership of async storage and confirmation.
  function showExportCode(code){context().showModal('Keep a portable save',`<div class="panel-lead"><p class="eyebrow">A COPY OF YOUR COMPLETE RECORD</p>`+
    `<p>This code contains the campaign and current encounter checkpoint. Keep it somewhere safe to restore on another device. It includes your chosen name `+
    `and decisions and is never uploaded by the game.</p></div><div class="panel-form"><label for="save-code">Your save code</label>`+
    `<textarea id="save-code" spellcheck="false" readonly>${esc(code)}</textarea>`+
    `</div>${actions('<button class="primary" data-cmd="copy-code">Copy save code</button><button data-cmd="download-code">Download save text</button>')}`);}
  function showRecoveryRecords(entries){context().showModal('Recover an earlier chronicle',`<div class="panel-lead"><p class="eyebrow">THE LOCAL ARCHIVE</p>`+
    `<p>The three most recent distinct checkpoints and replaced campaigns are kept on this device. Inspect a record before restoring it. Your current `+
    `chronicle will become a recovery record.</p></div>${entries.length?`<div class="recovery-list">${entries.map(entry=>`<article class="recovery-entry">`+
    `<p class="eyebrow">CHAPTER ${roman(entry.chapter)} · ${esc(entry.rank)}</p><h3>${esc(entry.name)}</h3>`+
    `<p>${esc(phaseLabel(entry.phase))}${entry.encounter?` · ${esc(entry.encounter)}`:''}</p>`+
    `<p class="settings-description">Saved ${esc(new Date(entry.savedAt).toLocaleString())}</p>`+
    `<button data-cmd="preview-recovery" data-id="${esc(entry.id)}" data-sequence="${esc(entry.currentSequence)}">Inspect this checkpoint</button>`+
    `</article>`).join('')}</div>`:empty('No earlier checkpoints yet. Records are created as your campaign advances and '+
    'when you replace a chronicle.')}${actions('<button data-cmd="restore">Restore a portable save code</button>'+
    '<button data-cmd="close-modal">Close recovery records</button>')}`);}
  function showRecoveryVerified(restored){
    context().showModal('Recovery checkpoint verified',
      `${chronicleIdentity(restored)}${facts([['Completed encounters',String(restored.history.length)],['Validation','Checkpoint verified']])}<p class="panel-note">The `+
    `current chronicle will be archived before this record takes its place. If another tab changes the save while this panel is open, restoration `+
    `stops for a fresh review.</p>${actions('<button class="primary" data-cmd="confirm-recovery">Restore this checkpoint</button>'+
    '<button data-cmd="recovery">Back to recovery records</button>')}`);
  }
  function showImportVerified(imported){
    context().showModal('Save code verified',
      `${chronicleIdentity(imported)}${facts([['Completed encounters',String(imported.history.length)],['Validation','Save code verified']])}<p class="panel-note">Restore `+
    `this verified chronicle and replace the current local campaign?</p>${actions('<button class="primary" data-cmd="confirm-import">Restore this '+
    'chronicle</button><button data-cmd="close-modal">Cancel</button>')}`);
  }
  function showStorageUnavailable(){context().showModal('Play without autosave?',`<div class="panel-lead"><p class="eyebrow">BROWSER STORAGE UNAVAILABLE</p>`+
    `<p>You can play in this tab, but progress cannot be saved automatically. Export a save code before closing it. Your previous saved chronicle will remain `+
    `on this device.</p></div>${actions('<button class="primary" data-cmd="begin-unsaved">Play in memory</button>'+
    '<button data-cmd="close-modal">Cancel</button>')}`);}
  function showRetry(){context().showModal('Retry this encounter?',`<div class="panel-lead"><p class="eyebrow">RETURN TO THE ENCOUNTER’S BEGINNING</p>`+
    `<p>Restore health, positions, the random seed, meters, inventory, and staged promises from the complete start checkpoint. Your earlier campaign `+
    `decisions stay as they were.</p></div>${actions('<button class="primary" data-cmd="retry-confirm">Restore checkpoint</button>'+
    '<button data-cmd="close-modal">Keep playing</button>')}`);}
  function showTakeover(){context().showModal('Continue in this tab',`<div class="panel-lead"><p class="eyebrow">A MORE RECENT CHRONICLE EXISTS</p>`+
    `<p>Load the latest saved chronicle and make this tab the current writer. Unsaved changes in this tab will be replaced. Export them first if you `+
    `want to keep them.</p></div>${actions('<button class="primary" data-cmd="confirm-takeover">Load latest and continue here</button>'+
    '<button data-cmd="export">Export this tab’s chronicle</button><button data-cmd="close-modal">Cancel</button>')}`);}
  function showSharePreview(selectedTheme='imperial'){context().showModal('Your reign, remembered',`<div class="panel-lead">`+
    `<p class="eyebrow">A KEEPSAKE OF YOUR REIGN</p><p>Your name and broad choices, without character fates or plot twists. Nothing is shared until you `+
    `choose a destination in the device’s share menu.</p></div><label class="setting reign-theme-picker" for="reign-card-theme">`+
    `<span>Monument finish<small class="muted">Choose Imperial Purple, Senatorial Marble, or Legionary Bronze.</small></span><select id="reign-card-theme">`+
    `<option value="imperial" ${selectedTheme==='imperial'?'selected':''}>Imperial Purple</option>`+
    `<option value="marble" ${selectedTheme==='marble'?'selected':''}>Senatorial Marble</option>`+
    `<option value="bronze" ${selectedTheme==='bronze'?'selected':''}>Legionary Bronze</option></select></label>`+
    `<canvas id="reign-card" class="share-preview" role="img" aria-label="Your reign card">`+
    `</canvas>${actions('<button class="primary" data-cmd="download-card" disabled>Preparing card…</button>'+
    '<button data-cmd="share-card" disabled>Preparing card…</button>')}`);}

  return {showNew,showMap,showLedger,showSettings,showPerformanceCheck,showHelp,showHistory,showJournal,showCharacter,showRestore,showNavigation,showCredits,
    showPrivacy,showExportCode,showRecoveryRecords,showRecoveryVerified,showImportVerified,showStorageUnavailable,showRetry,showTakeover,showSharePreview};
}
