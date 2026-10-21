import {esc,roman} from './view-helpers.js';
import {CHAPTERS} from '../data/campaign.js';
import {ITEMS} from '../data/items.js';
import {TP} from '../data/soldier.js';
import {TIME} from '../data/realtime-rules.js';
import {actionLabel} from './action-map.js';
import {campFor} from '../data/camps.js';
import {DEFEAT_PAGES} from '../data/dialogue.js';

// The page around a real-time encounter (build brief §3.14–§3.16). The field
// itself (the scene, its HUD and the battle log) is placed by the page's
// script into #rt-host and kept there between renders (data-live); this view
// renders only what the chronicle decides: the header, save problems and,
// once the fight is resolved, its result. Pure over the campaign state.

const chapterOf=state=>CHAPTERS.find(c=>c.id===state.chapter);

export function realtimeEncounterView({state,saving,lastSaved,saveProblem,saveConflict}){
  const e=state.encounter,chapter=chapterOf(state);
  return `<main id="main" class="encounter-frame realtime-frame" data-outcome="${esc(e.status)}" data-key="rt-main:${esc(e.id)}">
    <h1 class="visually-hidden">${esc(e.title)} · Chapter ${roman(state.chapter)}${chapter?`, ${esc(chapter.title)}`:''}</h1>
    <div class="rt-chronicle-bar"><span class="eyebrow">Chapter ${roman(state.chapter)} · ${esc(chapter?.year??'')} · Real time</span>
      <span class="save-status" role="status">${saving?'Saving…':lastSaved?'Saved':''}</span></div>
    ${saveProblem?`<div class="command-save-warning" role="alert"><p>${esc(saveProblem)}</p><div><button data-cmd="export">Export a save code</button>`+
      `${saveConflict?'<button data-cmd="takeover">Continue in this tab</button>':''}</div></div>`:''}
    <div id="rt-host" class="rt-host" data-key="rt-host:${esc(e.id)}"></div>
    ${e.status==='active'?'':realtimeResult(state)}
  </main>`;
}

// The live field's own DOM: built once per fight by the page, then owned by
// the field runtime (src/showcase/realtime-field.js) through its data-role names.
export function fieldMarkup({state,keymap,kind='field'}){
  const camp=kind==='camp',chapter=chapterOf(state),key=action=>esc(actionLabel(action,keymap));
  const e=camp?{id:`camp-${state.chapter}`,title:campFor(state.chapter)?.title??'The camp',objective:'Talk to people, use what you find, and march out through the gate.'}:state.encounter;
  return `<section class="rt-field" data-live data-kind="${kind}" data-encounter="${esc(e.id)}" aria-label="${esc(e.title)}, in real time">
  <div class="rt-scene">
    <canvas id="rt-board" class="rt-canvas" tabindex="0" data-cursor="walk" role="application" aria-describedby="rt-keys"
      aria-label="${esc(e.title)}. Click ground to move, a person or thing to act; right-click uses the current ability. ${key('pause')} pauses."></canvas>
    <p id="rt-keys" class="visually-hidden">Arrow keys move your soldier. ${key('target_next_enemy')} chooses the next enemy or thing to use, Enter acts on it, E uses what is nearest.
      ${key('combat_toggle')} draws or sheathes. 1 to 7 choose an ability; the same number again uses it. ${key('pause')} pauses, ${key('slow_time')} slows time,
      ${key('step_round')} plays one round while paused. [ and ] change the companion you control; Home returns to your soldier. Escape opens the Menu.</p>
    <div class="rt-veil" role="status" aria-live="polite"><p>${camp?'Preparing the camp…':'Preparing the battlefield…'}</p></div>
    <header class="rt-top">
      <div class="rt-mission"><p class="eyebrow">Chapter ${roman(state.chapter)} · ${esc(chapter?.year??'')}</p><h2>${esc(e.title)}</h2>
        <p data-role="objective">${esc(e.objective??'')}</p><p class="rt-progress" data-role="progress"></p></div>
      <div class="rt-time" role="group" aria-label="Time">
        <button data-role="pauseButton" class="rt-pause" type="button" aria-keyshortcuts="${key('pause')}" aria-pressed="false">Pause</button>
        <button data-role="slowButton" type="button" aria-keyshortcuts="${key('slow_time')}" aria-pressed="false">Slow</button>
        <button data-role="stepButton" type="button" aria-keyshortcuts="${key('step_round')}" disabled>Next round</button>
      </div>
      <button data-role="menuButton" class="rt-menu" type="button" aria-haspopup="dialog" aria-keyshortcuts="Escape">Menu</button>
    </header>
    <p class="rt-paused" data-role="pausedBand" hidden>Paused · point at anything for its forecast; every command still works</p>
    <footer class="rt-hud" tabindex="-1">
      <div class="rt-party" data-role="party" role="group" aria-label="Your party: choose who you control"></div>
      <div class="rt-message-area">
        <div class="rt-clock" role="timer" aria-label="Battle clock">
          <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="rt-clock-track" cx="18" cy="18" r="15"/><circle data-role="clockRing" class="rt-clock-ring" cx="18" cy="18" r="15" pathLength="100" stroke-dasharray="0 100"/></svg>
          <p><strong data-role="roundLabel">Round 1</strong><span data-role="clockTime">0:00</span></p>
        </div>
        <div class="rt-message-lines"><p data-role="messageLine" class="rt-message">Click open ground to move. A far click runs.</p><p data-role="eventLine" class="rt-event"></p></div>
      </div>
      <div class="rt-ability-area">
        <p class="rt-current"><span class="eyebrow">Right button</span><strong data-role="currentAbility">Strike</strong></p>
        <div class="rt-ability-bar" data-role="abilityBar" role="toolbar" aria-label="Abilities"></div>
        <div class="rt-toggles" role="group" aria-label="Weapon, movement and touch">
          <button data-role="swordsButton" class="rt-swords" type="button" aria-keyshortcuts="${key('combat_toggle')}" aria-pressed="false" title="Draw or sheathe (${key('combat_toggle')})"><span aria-hidden="true">⚔</span><span class="visually-hidden">Weapons drawn</span></button>
          <button data-role="walkButton" type="button" aria-keyshortcuts="${key('walk_toggle')}" aria-pressed="false">Walk</button>
          <button data-role="forceButton" type="button" aria-pressed="false" title="The next tap or click forces an attack">Force</button>
          <button data-role="rangesButton" type="button" aria-keyshortcuts="${key('show_ranges')}" aria-pressed="false">Ranges</button>
          <button data-role="listButton" type="button" aria-pressed="false" aria-controls="rt-command-list" title="Every action as a list">List</button>
        </div>
      </div>
    </footer>
  </div>
  <section id="rt-command-list" class="rt-command-list" data-role="commandList" aria-labelledby="rt-list-title" hidden>
    <h2 id="rt-list-title">Command list</h2>
    <p class="rt-log-note">Choose who acts, then Use an order. It works while paused; a paused world carries it out on resume.</p>
    <div class="rt-list-actors" data-role="listActors" role="radiogroup" aria-label="Who acts"></div>
    <div data-role="listOptions"></div>
  </section>
  <section class="rt-log-panel" aria-labelledby="rt-log-title">
    <h2 id="rt-log-title">Battle log</h2><p class="rt-log-note">Select an entry to look at that place; F follows your soldier again.</p>
    <ol data-role="log" class="rt-log"></ol>
  </section>
  <div class="visually-hidden" role="status" aria-live="polite" data-role="announcer"></div>
</section>`;
}

// The After-Action Chronicle of a resolved fight: what the soldier and his
// party did, what the result will grant when recorded, and, after a defeat,
// what went wrong and what might help (§3.11).
export function realtimeResult(state){
  const e=state.encounter,world=e.realtime?.world,won=e.status==='won';
  if(!world)return '';
  const ours=new Set([world.heroId,...world.party]),hero=world.actors.find(a=>a.id===world.heroId);
  const kills=world.actors.filter(a=>a.side==='enemy'&&!a.alive&&ours.has(a.killedBy)),party=world.actors.filter(a=>world.party.includes(a.id));
  const seconds=Math.round(world.tick/TIME.ticksPerSecond),time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  const staged=e.staged??{},spoils=(staged.spoils??[]).map(id=>ITEMS[id]?.name??id);
  const killTP=Math.min(TP.killCap,staged.killTP??0),commendations=staged.commendations??[];
  const rows=[['Battle time',time],['Enemies your party struck down',`${kills.length}`],
    ['Companions',party.length?party.map(a=>`${a.name}: ${!a.alive?'fallen':a.down?'down':`${a.hp} of ${a.maxHp} Health`}`).join(' · '):'none in the field'],
    ['Your soldier',hero?`${hero.alive?`${hero.hp} of ${hero.maxHp} Health`:'fallen'}`:'—']];
  if(won)rows.push(['Training points when recorded',`${killTP} for the fallen${commendations.length?`, ${commendations.reduce((n,c)=>n+c.tp,0)} for distinguished service`:''}, and the objective’s own`]);
  if(spoils.length)rows.push(['Taken from the field',spoils.join(', ')]);
  const lines=world.log.slice(-6).map(l=>`<li>${esc(l.text)}</li>`).join('');
  // What the fallen still carry: searched here, the pack receives it when the result is recorded.
  const bodies=won?world.actors.filter(a=>!a.alive&&a.side==='enemy'&&a.loot?.length):[];
  const search=bodies.length?`<section class="rt-search" aria-labelledby="rt-search-title"><h3 id="rt-search-title">Search the fallen</h3><ul class="rt-loot">${bodies.map(b=>
    `<li><span><strong>${esc(b.name)}</strong>: ${esc(b.loot.map(id=>ITEMS[id]?.name??id).join(', '))}</span>`+
    `<button data-cmd="rt-spoils" data-id="${esc(b.id)}" data-item="*">Take all</button></li>`).join('')}</ul></section>`:'';
  return `<section class="result command-result rt-result ${won?'result-won':'result-lost'}" role="status" aria-labelledby="rt-result-title">
    <span class="eyebrow">${won?'OBJECTIVE ACHIEVED · AFTER-ACTION CHRONICLE':'A CHANCE TO REGROUP'}</span>
    <h2 id="rt-result-title">${won?'The day is yours.':'The field is lost.'}</h2>
    ${won?'':`<p class="rt-defeat-cause">${esc(defeatCause(world))}</p>${DEFEAT_PAGES[e.id]?`<blockquote class="rt-defeat-page"><span class="eyebrow">How history remembers the day</span>`+
      `<p>${esc(DEFEAT_PAGES[e.id])}</p></blockquote>`:''}<p class="rt-defeat-help">${esc(defeatHelp(world))}</p>`}
    <dl class="result-record">${rows.map(([dt,dd])=>`<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join('')}</dl>
    ${commendations.length?`<ul class="rt-commendations">${commendations.map(c=>`<li>${esc(c.label)} (+${c.tp} TP)</li>`).join('')}</ul>`:''}
    ${search}
    <details class="rt-result-log"><summary>The last moments</summary><ol>${lines}</ol></details>
    <p class="result-save-note">${won?'Record the result to keep the rewards and consequences.':'Retry restores the encounter exactly as it began, including the random seed.'}</p>
    <div class="panel-actions">${won?'<button class="primary" data-cmd="commit">Record the result →</button>':'<button class="primary" data-cmd="retry">Retry the checkpoint</button>'}</div>
  </section>`;
}

// What ended a lost fight, in the words the guide uses.
export function defeatCause(world){
  const hero=world.actors.find(a=>a.id===world.heroId);
  if(world.mission?.reason)return world.mission.reason;
  if(hero&&!hero.alive){const by=world.actors.find(a=>a.id===hero.killedBy);return by?`You fell to ${by.name}.`:'You fell.';}
  return 'The objective was not held.';
}
export function defeatHelp(world){
  const hero=world.actors.find(a=>a.id===world.heroId),log=world.log.map(l=>l.text).join('\n');
  if(/from the (rear|flank)/.test(log))return 'Blows from the flank and rear struck most often: keep a rock, a wall or a companion at your back, and turn to face the man you fight.';
  if(hero&&hero.ammo?.pilum>0)return 'Your pila were never thrown: a pilum that sticks in a shield halves how often it blocks.';
  if(world.mission?.escorts?.length)return 'Keep the column close: wounded men wait for Bind wounds or Carry, and raiders go for the weakest first.';
  return 'Pause (P) when the fight turns, brace against heavy blows and let your companions’ standing orders cover you.';
}
