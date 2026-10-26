import {fieldReportText} from '../core/campaign-consequences.js';
import {esc,roman} from './view-helpers.js';
import {CHAPTERS} from '../data/campaign.js';
import {ITEMS} from '../data/items.js';
import {TP} from '../data/soldier.js';
import {TIME} from '../data/realtime-rules.js';
import {actionLabel} from './action-map.js';
import {campFor} from '../data/camps.js';
import {DEFEAT_PAGES} from '../data/dialogue.js';
import {missionDefeatCause as defeatCause,missionDefeatHelp as defeatHelp} from './realtime-mission-readout.js';
import {victoryReason} from './field-experience.js';
import {commitSoldierRewards} from '../core/soldier.js';

export {defeatCause,defeatHelp};

// The page around a real-time encounter (build brief §3.14–§3.16). The field
// itself (the scene, its HUD and the battle log) is placed by the page's
// script into #rt-host and kept there between renders (data-live); this view
// renders only what the chronicle decides: the header, save problems and,
// once the fight is resolved, its result. Pure over the campaign state.

const chapterOf=state=>CHAPTERS.find(c=>c.id===state.chapter);

export function realtimeEncounterView({state,saving,lastSaved,saveProblem,saveConflict,keymap}){
  const e=state.encounter,chapter=chapterOf(state);
  return `<main id="main" class="encounter-frame realtime-frame world-first" data-outcome="${esc(e.status)}" data-key="rt-main:${esc(e.id)}">
    <h1 class="visually-hidden">${esc(e.title)} · Chapter ${roman(state.chapter)}${chapter?`, ${esc(chapter.title)}`:''}</h1>
    <div class="rt-chronicle-bar"><span class="eyebrow">Chapter ${roman(state.chapter)} · ${esc(chapter?.year??'')} · Real time</span>
      <span class="save-status" role="status">${saving?'Saving…':lastSaved?'Saved':''}</span></div>
    ${saveProblem?`<div class="command-save-warning" role="alert"><p>${esc(saveProblem)}</p><div><button data-cmd="export">Export a save code</button>`+
      `${saveConflict?'<button data-cmd="takeover">Continue in this tab</button>':''}</div></div>`:''}
    ${e.status==='active'?'':realtimeResult(state,{keymap})}
    <div id="rt-host" class="rt-host" data-key="rt-host:${esc(e.id)}"></div>
  </main>`;
}

// The live field's own DOM: built once per fight by the page, then owned by
// the field runtime (src/showcase/realtime-field.js) through its data-role names.
// The scene's spoken name and its keys, in the player's keys (relabelField repeats them after a remap).
export function fieldHints({state,keymap,kind='field'}){
  const chamber=kind==='chamber',camp=kind==='camp',key=action=>esc(actionLabel(action,keymap));
  const title=camp?campFor(state.chapter)?.title??'The camp':state.encounter.title;
  const label=chamber?`${esc(title)}. Click the floor inside the pale circles to walk, a person to talk to him; right-click gives the chosen speech. ${key('yield_floor')} yields the floor.`
    :camp?`${esc(title)}. Click ground to move, a person to talk, or a service to use it. ${key('pause')} pauses.`
    :`${esc(title)}. Click ground to move, a person or thing to act; right-click uses the current ability. ${key('pause')} pauses.`;
  const keys=chamber?`Arrow keys move. ${key('target_next_enemy')} selects a member; Enter talks. ${key('interact_nearest')} uses what is nearest. ${key('yield_floor')} ends the hour.
      All actions provides a text list. Escape closes the current panel or opens Menu; How to play has help.`
    :`Arrow keys move. ${key('target_next_enemy')} selects a target; Enter acts. ${key('interact_nearest')} uses what is nearest. ${key('pause')} pauses.
      All actions provides a text list. Escape cancels or opens Menu; How to play has help.`;
  return {label,keys};
}
// After the keys are remapped: the hints, the buttons' shortcuts and their titles follow (the bars rebuild in the field).
export function relabelField(root,{state,keymap,kind='field'}){
  if(!root)return;const {label,keys}=fieldHints({state,keymap,kind}),text=html=>{const t=document.createElement('template');t.innerHTML=html;return t.content.textContent;};
  root.querySelector('#rt-board')?.setAttribute('aria-label',text(label));const p=root.querySelector('#rt-keys');if(p)p.textContent=text(keys);
  for(const el of root.querySelectorAll('[data-shortcut]')){const k=actionLabel(el.dataset.shortcut,keymap);el.setAttribute('aria-keyshortcuts',k);if(el.dataset.title)el.title=`${el.dataset.title} (${k})`;}
}

export function fieldMarkup({state,keymap,kind='field'}){
  const camp=kind==='camp',chamber=kind==='chamber',chapter=chapterOf(state),key=action=>esc(actionLabel(action,keymap));
  const e=camp?{id:`camp-${state.chapter}`,title:campFor(state.chapter)?.title??'The camp',objective:campFor(state.chapter)?.purpose??'Prepare, speak to people, and depart through the gate.'}:state.encounter;
  const {label,keys}=fieldHints({state,keymap,kind});
  return `<section class="rt-field" data-live data-kind="${kind}" data-encounter="${esc(e.id)}" aria-label="${esc(e.title)}, ${chamber?'the chamber':'in real time'}">
    <header class="rt-top">
      <div class="rt-mission"><p class="eyebrow">Chapter ${roman(state.chapter)} · ${esc(chapter?.year??'')}</p><h2>${esc(e.title)}</h2></div>
      <label class="rt-view-control">View<select data-role="cameraSelect" aria-label="World view"><option value="follow"${chamber?'':' selected'}>Follow</option><option value="overview"${chamber?' selected':''}>Overview</option><option value="horizon">Horizon</option></select></label>
      <div class="rt-time" role="group" aria-label="Time">
        <span class="rt-paused" data-role="pausedBand" hidden>Paused</span>
        <button data-role="pauseButton" class="rt-pause" type="button" data-shortcut="pause" aria-keyshortcuts="${key('pause')}" aria-pressed="false">Pause</button>
        ${chamber?`<button data-role="yieldButton" class="rt-yield" type="button" data-shortcut="yield_floor" aria-keyshortcuts="${key('yield_floor')}" data-title="End the hour now; a speech not yet given is lost" title="End the hour now; a speech not yet given is lost (${key('yield_floor')})">End hour</button>`:''}
        <span class="rt-speed-state" data-role="speedState" hidden>Half speed</span>
      </div>
      <button data-role="menuButton" class="rt-menu" type="button" aria-haspopup="dialog" aria-keyshortcuts="Escape">Menu</button>
    </header>
    <section class="rt-status-strip" aria-label="Current mission">
      <div class="rt-mission-summary"><p class="rt-objective" data-role="missionHeadline">${esc(chamber?e.issue??e.objective??'':e.objective??'')}</p>
        <span class="rt-progress" data-role="progressBadge"></span><span class="rt-deadline" data-role="deadlineBadge"></span><span class="rt-order-feedback" data-role="orderBadge"></span></div>
      <p class="rt-mission-warning" data-role="missionWarning" hidden></p>
      <p class="rt-opportunity" data-role="opportunity" hidden></p>
      <details class="rt-mission-details" data-role="missionDetails"><summary>Mission details</summary><div class="rt-detail-body">
        <p class="rt-objective" data-role="objective">${esc(chamber?e.issue??e.objective??'':e.objective??'')}</p>
        <p class="rt-progress" data-role="progress"></p><p class="rt-next" data-role="missionNext" hidden></p>
        <div class="rt-status-facts"><p class="rt-deadline" data-role="deadlineLine" hidden></p><p data-role="orderStatus" hidden></p></div>
        <button type="button" data-close-disclosure>Close details</button>
      </div></details>
    </section>
    <aside class="rt-notice" data-role="notice" role="status" hidden><div><strong data-role="noticeTitle"></strong><p data-role="noticeBody"></p></div><button type="button" data-role="dismissNotice" aria-label="Dismiss battlefield update">×</button></aside>
    ${chamber?'<div class="rt-vote-summary"><p data-role="voteSummary"></p><p data-role="voteProjection"></p></div><details class="rt-coalition-details" data-role="coalitionDetails"><summary>Votes &amp; delegates</summary><div class="rt-coalition" data-role="coalition" aria-label="Votes and forecasts"></div><button type="button" data-close-disclosure>Close delegates</button></details>':''}
    <div class="rt-deploy" data-role="deployBar" role="group" aria-label="Deployment" hidden>
      <p><strong>Place your units.</strong> Select a unit, then click the marked ground. Time is paused.</p>
      <button data-role="advanceButton" class="primary rt-advance" type="button">Sound the advance</button>
    </div>
    ${chamber?'<div class="rt-rivals" data-role="rivalsBand" role="status" aria-live="polite" hidden></div>':''}
    <div class="rt-workspace">
      <div class="rt-scene" data-action-region="clear">
        <canvas id="rt-board" class="rt-canvas" tabindex="0" data-cursor="walk" role="application" aria-describedby="rt-keys" aria-label="${label}"></canvas>
        <div class="rt-wayfinders"><button type="button" data-role="locateTarget" hidden>Find target</button><button type="button" data-role="locateObjective" hidden>Find objective</button></div>
        <p id="rt-keys" class="visually-hidden">${keys}</p>
        <div class="rt-veil" role="status" aria-live="polite"><p>${camp?'Preparing the camp…':chamber?'Preparing the chamber…':'Preparing the battlefield…'}</p></div>
      </div>
      ${chamber?'<aside class="rt-talk" data-role="conversation" aria-labelledby="rt-talk-title" hidden></aside>':''}
    </div>
    <footer class="rt-hud" tabindex="-1">
      <div class="rt-unit-dock" aria-label="Choose your unit">
        <p class="rt-selection-label" data-role="selectionLabel"></p>
        <div class="rt-party" data-role="party" role="group" aria-label="${chamber?'Your speakers: choose who speaks':'Your party: choose who you control'}"></div>
        <div class="rt-squad-area">
          <div class="rt-squads" data-role="squadBar" role="group" aria-label="Your squads: a standard selects; Shift adds" hidden></div>
          <button data-role="clearButton" class="rt-clear" type="button" aria-keyshortcuts="Escape" hidden>Soldier controls</button>
        </div>
      </div>
      <div class="rt-message-area">
        <div class="rt-clock" role="timer" aria-label="${chamber?'The clepsydra: hours to the vote':'Battle clock'}">
          <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="rt-clock-track" cx="18" cy="18" r="15"/><circle data-role="clockRing" class="rt-clock-ring" cx="18" cy="18" r="15" pathLength="100" stroke-dasharray="0 100"/></svg>
          <p><strong data-role="roundLabel">Round 1</strong><span data-role="clockTime">0:00</span></p>
        </div>
        <div class="rt-command" data-role="commandPips" role="img" hidden></div>
        <div class="rt-message-lines"><p data-role="targetLine" class="rt-target-line" hidden></p><p data-role="targetCue" class="rt-target-cue" hidden></p><details class="rt-target-details" data-role="targetDetails" hidden><summary>Target details</summary><p data-role="targetForecast"></p></details><p data-role="messageLine" class="rt-message">${chamber?'Click a member to talk to him; click the floor to walk.':'Click open ground to move. A far click runs.'}</p><p data-role="eventLine" class="rt-event"></p></div>
      </div>
      <div class="rt-ability-area">
        <p class="rt-current"><span>${chamber?'Selected speech':'Selected action'}</span><strong data-role="currentAbility">${chamber?'Persuade':'Strike'}</strong></p>
        <div class="rt-ability-bar" data-role="abilityBar" role="${chamber?'toolbar':'group'}" aria-label="${chamber?'Speeches':'Actions'}"></div>
        ${chamber?'':`<div class="rt-ability-bar rt-card" data-role="commandCard" role="toolbar" aria-label="Orders for the selected squads (1 to 6)" hidden></div>`}
        <div class="rt-tools">
          <button data-role="listButton" type="button" aria-pressed="false" aria-controls="rt-command-list" title="Every ${chamber?'speech, walk and conversation':'action'} as a list">All actions</button>
        ${chamber?`<div class="rt-toggles" role="group" aria-label="The motion">
          <button data-role="motionButton" type="button" aria-pressed="false" title="The policy motion, career precedents and the hearing’s documents">Vote agenda</button>
        </div>`:`<details class="rt-toolbox" data-role="controlOptions"><summary>Options</summary><div class="rt-detail-body"><div class="rt-toggles" role="group" aria-label="Weapon and movement">
          <button data-role="swordsButton" class="rt-swords" type="button" data-shortcut="combat_toggle" aria-keyshortcuts="${key('combat_toggle')}" aria-pressed="false" data-title="Draw or sheathe" title="Draw or sheathe (${key('combat_toggle')})">Draw weapon</button>
          <button data-role="walkButton" type="button" data-shortcut="walk_toggle" aria-keyshortcuts="${key('walk_toggle')}" aria-pressed="false">Always walk</button>
          <button data-role="forceButton" type="button" aria-pressed="false" title="The next tap or click forces an attack">Force attack</button>
          <button data-role="rangesButton" type="button" data-shortcut="show_ranges" aria-keyshortcuts="${key('show_ranges')}" aria-pressed="false">Show ranges</button>
        </div><details class="rt-time-options" data-role="timeControls"><summary>Time controls</summary><div class="rt-toggles">
          <button data-role="slowButton" type="button" data-shortcut="slow_time" aria-keyshortcuts="${key('slow_time')}" aria-pressed="false">Half speed</button>
          <button data-role="stepButton" type="button" data-shortcut="step_round" aria-keyshortcuts="${key('step_round')}" disabled>Play one round</button>
          <button type="button" data-close-disclosure>Close time controls</button>
        </div></details><button type="button" data-close-disclosure>Close options</button></div></details>`}
        </div>
      </div>
    </footer>
    <div class="rt-support"><details class="rt-help" data-role="fieldHelp"><summary>How to play</summary><div class="rt-detail-body">
      <p>${camp?'Click a person to talk or an object to use it.':chamber?'Click a person to talk. Click the floor to move.':'Click the ground to move. Click an enemy to attack.'}</p>
      <p>${camp?'Use <strong>All actions</strong> for a list of people and places.':`Select an action, then ${chamber?'right-click a person':'right-click a target'}. Use <strong>All actions</strong> for a text list.`}</p>
      <p class="rt-input-context" data-role="inputContext">${key('pause')} pauses from the scene or command controls.</p>
      <p>Arrow keys move. ${key('target_next_enemy')} selects a target; Enter acts.${!camp&&!chamber?' During deployment, arrows and Enter place the selected unit.':''}</p>
      <button type="button" data-close-disclosure>Close help</button></div></details>
    <details class="rt-lesson" data-role="lesson" hidden><summary><span class="rt-tip-label">Tip</span> <span data-role="lessonTitle"></span><span data-role="lessonStep" class="visually-hidden"></span></summary>
      <div class="rt-detail-body"><p data-role="lessonBody"></p><div class="rt-toggles"><button type="button" data-close-disclosure>Close tip</button><button class="text-link" type="button" data-cmd="dismiss-guide">Hide tips</button></div></div></details>
      <details class="rt-log-panel" data-role="logDetails"><summary id="rt-log-title">${chamber?'Debate log':'Battle log'}</summary>
        <div class="rt-detail-body"><p class="rt-log-note">${chamber?'Latest speech first.':'Select an event to view its location.'}</p>
        <ol data-role="log" class="rt-log"></ol><button type="button" data-close-disclosure>Close log</button></div>
      </details></div>
  <section id="rt-command-list" class="rt-command-list" data-role="commandList" aria-labelledby="rt-list-title" hidden>
    <div class="rt-list-head"><h2 id="rt-list-title">All actions</h2><button type="button" data-role="closeListButton">Close</button></div>
    <p class="rt-log-note">${chamber?'Choose a speaker and an action.':'Choose a unit and an action. Queued actions run when you resume.'}</p>
    <div class="rt-list-actors" data-role="listActors" role="radiogroup" aria-label="Who acts"></div>
    <div data-role="listOptions"></div>
  </section>
  <div class="visually-hidden" role="status" aria-live="polite" data-role="announcer"></div>
</section>`;
}

// The After-Action Chronicle of a resolved fight: what the soldier and his
// party did, what the result will grant when recorded, and, after a defeat,
// what went wrong and what might help (§3.11).
export function realtimeResult(state,{keymap}={}){
  const e=state.encounter,world=e.realtime?.world,won=e.status==='won';
  if(!world)return '';
  const ours=new Set([world.heroId,...world.party]),hero=world.actors.find(a=>a.id===world.heroId);
  const kills=world.actors.filter(a=>a.side==='enemy'&&!a.alive&&ours.has(a.killedBy)),party=world.actors.filter(a=>world.party.includes(a.id));
  const seconds=Math.round(world.tick/TIME.ticksPerSecond),time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  const staged=e.staged??{},spoils=(staged.spoils??[]).map(id=>ITEMS[id]?.name??id);
  const killTP=Math.min(TP.killCap,staged.killTP??0),commendations=staged.commendations??[];
  const draft=won&&state.soldier?structuredClone(state):null,rewards=draft?commitSoldierRewards(draft,draft.encounter):null;
  const rows=[['Battle time',time],['Enemies your party struck down',`${kills.length}`],
    ['Companions',party.length?party.map(a=>`${a.name}: ${!a.alive?'fallen':a.down?'down':`${a.hp} of ${a.maxHp} Health`}`).join(' · '):'none in the field'],
    ['Your soldier',hero?`${hero.alive?`${hero.hp} of ${hero.maxHp} Health`:'fallen'}`:'—']];
  // From Chapter IV the squads' day: each of ours, and the enemy's bands cut down.
  if(world.squads?.length){
    const men=q=>q.members.filter(id=>world.actors.find(a=>a.id===id)?.alive).length,state=q=>!men(q)||q.strength<=0?'cut down':q.broken?'broken':q.morale<=40?'shaken':'steady';
    const mine=world.squads.filter(q=>q.side!=='enemy'),theirs=world.squads.filter(q=>q.side==='enemy');
    rows.push(['Your squads',mine.map(q=>`${q.name}: ${men(q)} of ${q.members.length} men, ${state(q)}`).join(' · ')||'none']);
    rows.push(['Enemy bands cut down',`${theirs.filter(q=>!men(q)||q.strength<=0).length} of ${theirs.length}`]);
  }
  // The field's opportunity (guide "Field objects").
  if(world.field){const f=world.field,taken=f.choice?world.objects.find(o=>o.field&&o.kind===f.choice):null;
    rows.push(['Field opportunity',taken?`${taken.name}: secured`:f.outcome==='missed'?'Both closed at the end of round '+f.deadline:'None taken']);}
  if(won)rows.push(['Training points when recorded',`${killTP} for the fallen${commendations.length?`, ${commendations.reduce((n,c)=>n+c.tp,0)} for distinguished service`:''}, and the objective’s own`]);
  if(staged.fieldReport)rows.push(['Campaign consequences',fieldReportText(staged.fieldReport)]);
  if(spoils.length)rows.push(['Taken from the field',spoils.join(', ')]);
  const lines=world.log.slice(-6).map(l=>`<li>${esc(l.text)}</li>`).join('');
  // What the fallen still carry: searched here, the pack receives it when the result is recorded.
  const bodies=won?world.actors.filter(a=>!a.alive&&a.side==='enemy'&&a.loot?.length):[];
  const search=bodies.length?`<section class="rt-search" aria-labelledby="rt-search-title"><h3 id="rt-search-title">Search the fallen</h3><ul class="rt-loot">${bodies.map(b=>
    `<li><span><strong>${esc(b.name)}</strong>: ${esc(b.loot.map(id=>ITEMS[id]?.name??id).join(', '))}</span>`+
    `<button data-cmd="rt-spoils" data-id="${esc(b.id)}" data-item="*">Take all</button></li>`).join('')}</ul></section>`:'';
  return `<section class="result command-result rt-result ${won?'result-won':'result-lost'}" role="status" aria-labelledby="rt-result-title">
    <span class="eyebrow">BATTLE RESULT</span>
    <h2 id="rt-result-title" tabindex="-1">${won?'Objective complete':'Try this battle again'}</h2>
    ${won?`<p class="rt-victory-reason">${esc(victoryReason(world))}</p>`:''}
    ${rewards?`<p class="rt-reward-summary">Earned: <strong>${rewards.tp} training points</strong>${rewards.denarii?` · ${rewards.denarii} denarii`:''}${rewards.decorations.length?` · ${rewards.decorations.length} decorations`:''}. Collected equipment is kept when you continue.</p>`:''}
    <div class="panel-actions rt-result-actions">${won?'<button class="primary" data-cmd="commit">Continue →</button>':'<button class="primary" data-cmd="retry">Retry battle</button>'}</div>
    ${won?'':`<p class="rt-defeat-cause">${esc(defeatCause(world))}</p><details class="rt-retry-help"><summary>Advice for retrying</summary><p class="rt-defeat-help">${esc(defeatHelp(world,keymap))}</p><button type="button" data-close-disclosure>Close advice</button></details>`}
    ${search?`<details class="rt-result-loot"><summary>Collect spoils · ${bodies.length} ${bodies.length===1?'body':'bodies'}</summary>${search}</details>`:''}
    <details class="rt-result-details"><summary>Battle details &amp; rewards</summary>
      <dl class="result-record">${rows.map(([dt,dd])=>`<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join('')}</dl>
      ${commendations.length?`<ul class="rt-commendations">${commendations.map(c=>`<li>${esc(c.label)} (+${c.tp} TP)</li>`).join('')}</ul>`:''}
      <button type="button" data-close-disclosure>Close details</button>
    </details>
    ${!won&&DEFEAT_PAGES[e.id]?`<details class="rt-history-note"><summary>Historical context</summary><blockquote class="rt-defeat-page"><p>${esc(DEFEAT_PAGES[e.id])}</p></blockquote><button type="button" data-close-disclosure>Close context</button></details>`:''}
    <details class="rt-result-log"><summary>The last moments</summary><ol>${lines}</ol><button type="button" data-close-disclosure>Close log</button></details>
    <p class="result-save-note">${won?'Continue saves this result and its rewards.':'Retry restarts this battle. Your earlier progress is kept.'}</p>
  </section>`;
}
