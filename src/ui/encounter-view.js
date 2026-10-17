import {fieldGuide} from './field-guide.js';
import {agreementConversation} from './progression-views.js';
import * as Game from '../core/game.js';
import {operationBanner,tacticalCoaching,voicedBriefing} from './campaign-upgrade-views.js';
import {esc, roman, actionNames, actionSymbols} from './view-helpers.js';
import {missionBrief, coalitionPanel, fieldIntel, selectedGround, resultRecord, terrainLabel} from './tactical-intel.js';
import {politicalPosition} from '../core/contest.js';
import {FORMATION_RULES} from '../data/battle-balance.js';

const location = point => `${point.x + 1}${String.fromCharCode(65 + point.y)}`;
const signed = value => value > 0 ? `+${value}` : String(value);
function readiness(state, unit) {
  const actions = Game.getActions(state, unit.id);
  if (state.encounter.status !== 'active') return {available:false, label:'Resolved', description:'Encounter resolved'};
  if (state.encounter.kind === 'battle' && unit.side === 'ally') {
    if (actions.length) return {available:true, label:'Order ready', description:'Can receive an order'};
    if (unit.ordered) return {available:false, label:'Order spent', description:'This unit has received its order'};
    return {available:false, label:'Autonomous', description:state.chapter < 4 ? 'Acting on own orders · direct orders unlock in Chapter IV' : 'No commands left · acting on own orders'};
  }
  return {available:actions.length > 0, label:actions.length ? 'Ready' : 'Finished', description:actions.length ? 'Commands available' : 'Movement and action spent'};
}
const interestNotes = {
  service: 'Military service carries weight here.', security: 'Protection is this delegation’s priority.',
  law: 'A lawful guarantee matters to this delegation.', grain: 'This delegation wants provision secured.',
  office: 'This delegation seeks an office with resources behind it.'
};

export function selectedActor(state, selected) {
  const units = state.encounter?.units || [];
  const available = units.filter(u => ['player', 'ally'].includes(u.side) && (u.resolve ?? u.hp) > 0);
  return available.find(u => u.id === selected) || available.find(u => u.id === 'hero') || available[0] || units.find(u => u.id === 'hero');
}

export function selectedCommand({selected, action, target, formation, orderAction}) {
  if (!action || !target) return null;
  return {unitId: selected, action, x: target.x, y: target.y, ...(target.unitId ? {targetId: target.unitId} : {}), formation, orderAction};
}

export function targetName(state, target) {
  const unit = state.encounter.units.find(u => u.id === target.unitId);
  return `${unit?.name || target.label || terrainLabel(state.encounter, target)} · ${location(target)}${target.cost !== undefined ? ` · ${target.cost} movement` : ''}${unit?.stance !== undefined ? ` · stance ${unit.stance}` : ''}${unit?.interest ? ` · ${unit.interest}` : ''}`;
}

function instruction(state, action, target, actor) {
  const e = state.encounter;
  if (e.status !== 'active') return 'Review the outcome and record it, or regroup at the checkpoint.';
  if (e.kind === 'battle' && actor.side === 'ally' && !Game.getActions(state, actor.id).length) return `${readiness(state, actor).description}. Select your commander to act, or end the turn.`;
  if (action && !Game.getTargets(state, actor.id, action).length) return 'No target in reach. Move closer, choose another command, or end the turn.';
  if (target) return 'Review the cost. Select this target again, or Confirm, to act.';
  if (action) return `Select a highlighted target for ${actionNames[action]}.`;
  if (actor.acted && Game.getActions(state, actor.id).some(a => ['order', 'formation'].includes(a))) return 'Personal action spent. Your remaining commands can still direct the company.';
  if (actor.acted) return actor.moved ? (e.units.some(u => u.id !== actor.id && Game.getActions(state, u.id).length) ? 'This unit has finished. Select a ready comrade or end the turn.' : 'This unit has finished. End the turn when ready.') : 'Action spent. Select ground to move, or end the turn.';
  if (e.type === 'training') {
    const next = ['move', 'throw', 'strike', 'brace'].find(a => !e.usedAbilities.includes(a));
    return next ? `Varro’s next lesson: ${actionNames[next]}. Select a command, then its target.` : 'The drill is complete. End your turn for Varro’s assessment.';
  }
  return e.kind === 'contest' ? 'Select a delegate to consider an appeal, or ground to move your speaker.' : 'Select a comrade, an opponent or the ground. Review the order before you commit.';
}

function outcome(e) {
  if (e.status === 'active') return '';
  const won = e.status === 'won';
  return `<section class="result command-result ${won ? 'result-won' : 'result-lost'}" role="status">
    <span class="eyebrow">${won ? 'OBJECTIVE ACHIEVED' : 'A CHANCE TO REGROUP'}</span>
    <h2>${won ? (e.kind === 'contest' ? 'The motion carries.' : 'The day is yours.') : (e.kind === 'contest' ? 'The motion is defeated.' : 'The field is lost.')}</h2>
    <p>${esc(e.log?.at(-1) || '')}</p>${resultRecord(e)}
    ${won ? '<button class="primary" data-cmd="commit">Record the result →</button>' : '<button class="primary" data-cmd="retry">Retry the complete checkpoint</button>'}
    ${!won && e.kind === 'contest' && !e.fallback ? '<p>A patron can fund another vote: two supplies now, a five-supply debt at accession. The vote must still be won.</p><button data-cmd="fallback">Accept backing and re-run the vote</button>' : ''}
  </section>`;
}

// Out-of-range inspection reads visible state; it is never a legal target.
function inspectedUnit(e, point) {
  return point && e.units.find(u => !u.hidden && (u.role === 'voter' || (u.resolve ?? u.hp) > 0) && (point.unitId ? u.id === point.unitId : u.x === point.x && u.y === point.y));
}

function inspector(e, actor, point, hasTarget) {
  const subject = inspectedUnit(e, point);
  if (subject?.role === 'voter') {
    const committed = Math.abs(subject.stance) >= 3;
    return `<div class="command-person delegate-conversation">
      <div class="delegate-seal" aria-hidden="true">${esc((subject.bloc || 'Delegate').slice(0, 1))}</div>
      <div><span class="command-kicker">${esc(subject.bloc)} · ${esc(subject.interest || 'delegate')}</span><h2>${esc(subject.name)}</h2>
      <p class="delegate-position ${subject.stance >= 1 ? 'is-supporting' : ''}">${subject.stance >= 1 ? 'Supports you' : 'Opposes you'} <strong>${signed(subject.stance)}</strong>${committed ? ' · committed' : ' · wavering'}${e.promises?.includes(subject.id) ? ' · promised' : ''}</p></div>
      <p class="delegate-interest">${esc(interestNotes[subject.interest] || 'Consider this delegate’s position before choosing an appeal.')}${!hasTarget ? ' Choose a command or move into reach.' : ''}</p>
    </div>`;
  }
  if (subject && subject.id !== actor.id) return `<div class="command-person ${subject.side === 'enemy' ? 'is-rival' : 'is-friendly'}">
    <span class="command-kicker">${subject.side === 'enemy' ? 'OPPOSITION' : 'COMPANY'} · ${location(subject)}</span><h2>${esc(subject.name)}</h2>
    <p>${subject.resolve !== undefined ? `${subject.resolve}/${subject.maxResolve} Resolve` : `${subject.hp}/${subject.maxHp} health · ${subject.morale ?? 80} morale`}${subject.facing ? ` · facing ${esc(subject.facing)}` : ''}</p>
    ${subject.intent ? `<p class="command-intent"><span>Next plan if the position holds</span>${esc(subject.intent)}</p>` : ''}</div>`;
  return `<div class="command-ground">${selectedGround(e, actor, point)}${actor.intent ? `<p class="command-intent"><span>Current plan</span>${esc(actor.intent)}</p>` : ''}</div>`;
}

function previewCard(preview, action, e) {
  if (!preview) return '';
  const f = preview.forecast;
  if (!f) return `<div id="action-preview" class="command-preview ${preview.ok ? '' : 'is-invalid'}" role="status">${esc(preview.message)}</div>`;
  const changes = [...f.stanceChanges.map(c => `${c.name}: ${signed(c.from)} → ${signed(c.to)}`), ...f.resolveChanges.map(c => `${c.name}: ${c.from} → ${c.to} Resolve`)];
  return `<div id="action-preview" class="command-preview" role="status">
    <div class="command-forecast"><strong>Support ${f.votesBefore} → ${f.votesAfter}</strong><span>${f.speechCost} speech${f.publicCost ? ` · −${f.publicCost} Public` : ''}</span></div>
    ${changes.length ? `<p class="command-change">${esc(changes.join(' · '))}</p>` : '<p>Blunts this rival’s next speech to at most 1 stance or Resolve loss.</p>'}
    ${f.promise ? `<p class="command-debt"><strong>Promise ${e.promises.length + 1}/2 · ${f.promise.cost} supplies owed at accession.</strong> Each missing supply costs 1 Public. Break it: −8 Public, −4 Backing.</p>` : ''}
    ${action === 'threaten' ? '<p class="command-debt">Bloc backlash is included above. Later threats against this bloc lose 1 strength.</p>' : ''}
    ${action === 'record' ? '<p class="command-limit">This delegate can hear your Record once per Contest.</p>' : ''}
    ${action === 'denounce' ? '<p class="command-limit">A withdrawn speaker keeps their vote.</p>' : ''}
    <details id="command-full-forecast" class="command-forecast-detail"><summary>Full forecast & terms</summary><p>${esc(preview.message)}</p></details>
  </div>`;
}

function formationControls(e, action, formation, orderAction) {
  if (!['order', 'formation'].includes(action)) return '';
  return `<div class="command-formation">
    ${action === 'formation' ? `<label for="formation-kind">Formation<select id="formation-kind">${[['shield-wall', 'Shield wall · protection, move 1'], ['line', e.combatVersion === 2 ? 'Line · movement, morale and screen' : 'Line · movement and morale'], ['wedge', e.combatVersion === 2 ? 'Wedge · attack on firm ground, exposed' : 'Wedge · +1 attack, +1 damage taken']].map(([value, label]) => `<option value="${value}" ${formation === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}
    <label for="order-kind">Order<select id="order-kind">${[['advance', 'Advance toward objective'], ['attack', e.combatVersion === 2 ? 'Attack the strongest opportunity' : 'Attack nearest enemy'], ['hold', 'Hold and brace'], ['rally', 'Restore morale'], ...(e.combatVersion === 2 ? [['withdraw', 'Withdraw toward commander']] : [])].map(([value, label]) => `<option value="${value}" ${orderAction === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    ${action === 'formation' && e.combatVersion === 2 ? `<p>${esc(FORMATION_RULES[formation || 'shield-wall']?.summary || '')}</p>` : ''}
  </div>`;
}

export function encounterView(context) {
  const {view3D=false,can3D=false,state, selected, action, target, focusTile, showGrid = false, formation, orderAction, feedback = '', directHint, requirements = () => '', artProgress = '', offlineProgress = '', saving = false, lastSaved = '', saveProblem = '', saveConflict = false} = context;
  const e = state.encounter, actor = selectedActor(state, selected), active = e.status === 'active', political = e.kind === 'contest';
  const actions = Game.getActions(state, actor.id), targets = action ? Game.getTargets(state, actor.id, action) : [];
  const command = selectedCommand({...context, selected: actor.id}), preview = command ? Game.preview(state, command) : null;
  const voters = e.units.filter(u => u.role === 'voter'), vote = Game.voteCount(state);
  const units = e.units.filter(u => ['player', 'ally'].includes(u.side) && (u.resolve ?? u.hp) > 0);
  const selectOptions = targets.map((t, i) => `<option value="${i}" ${target && t.x === target.x && t.y === target.y && t.unitId === target.unitId ? 'selected' : ''}>${esc(targetName(state, t))}</option>`).join('');
  const progress = typeof e.objectiveProgress === 'string' ? e.objectiveProgress : '';
  const point = target || focusTile;
  const actorReadiness = readiness(state, actor), independentAlly = !political && actor.side === 'ally';
  return `<main id="main" class="encounter-frame command-stage ${political ? 'command-chamber' : 'command-battle'}" data-outcome="${esc(e.status)}">
    <header class="command-mission" aria-label="Current tactical objective">
      <div class="command-title"><span class="command-kicker">CHAPTER ${roman(state.chapter)} · ${political ? 'THE CHAMBER' : e.type === 'training' ? 'THE DRILL GROUND' : 'IN THE FIELD'}</span><h1>${esc(e.title)}</h1></div>
      <div class="command-clock"><strong>TURN ${e.turn}<span> / ${e.turnLimit}</span></strong><span>${vote ? `${vote.for}/${vote.total} support · ${vote.majority} needed` : e.commandCapacity ? `${e.commandsLeft}/${e.commandCapacity} orders` : 'One move · one action'}</span><span class="save-status" role="status">${saving ? 'Saving…' : lastSaved ? 'Saved' : ''}</span></div>
      <nav class="command-navigation" aria-label="Encounter menu"><button data-cmd="journal" aria-label="Open orders and chronicle">Orders</button><button data-cmd="menu">Menu</button></nav>
    </header>
    ${operationBanner(e)}
    ${saveProblem ? `<div class="command-save-warning" role="alert"><p>${esc(saveProblem)}</p><div><button data-cmd="export">Export a save code</button>${saveConflict ? '<button data-cmd="takeover">Continue in this tab</button>' : ''}</div></div>` : ''}
    <div class="command-runtime"><span id="art-loading-status" role="status" ${artProgress ? '' : 'hidden'}>${esc(artProgress)}</span><span id="offline-status" role="status" ${offlineProgress ? '' : 'hidden'}>${esc(offlineProgress)}</span></div>
    <section class="command-field" aria-label="${political ? 'Political chamber' : 'Battlefield'}">
      <div class="command-field-status"><p>${vote ? `<strong>${vote.for >= vote.majority ? 'Majority held for now' : `${Math.max(0, vote.majority - vote.for)} more votes needed`}</strong> · ${Math.max(0, e.turnLimit - e.turn + 1)} turns to vote · ${Math.max(0, 2 - (e.promises?.length || 0))} promises left` : esc(progress || e.objective)}</p><button class="command-grid-toggle" data-cmd="toggle-grid" aria-pressed="${showGrid}">Grid ${showGrid ? 'on' : 'off'}</button></div>
      ${can3D ? `<div class="battle-camera" aria-label="Scene view"><button data-cmd="view-3d">${view3D?'Switch to 2D':'Switch to 3D'}</button>${view3D?'<button data-cmd="camera-home">Overview</button><button data-cmd="camera-focus">Follow unit</button><button data-cmd="camera-horizon" aria-keyshortcuts="H" title="See the sky and distant landscape (H)">Horizon</button><div class="camera-zoom"><button data-cmd="camera-in" aria-label="Zoom in">+</button><button data-cmd="camera-out" aria-label="Zoom out">−</button></div><span>Drag to orbit · scroll to zoom · H for horizon</span>':''}</div>`:''}
      <div class="battle-stage command-canvas ${view3D?'battle-3d':''}">${view3D?`<span class="battle-loading" role="status">${political?'Preparing the chamber…':'Preparing the battlefield…'}</span>`:''}<canvas id="battle-board" tabindex="0" role="application" aria-label="${political ? 'Political chamber' : 'Battlefield'} grid. Select a friendly unit, opponent or ground to preview. Select the same target again to confirm. Arrow keys move the cursor; Enter selects or confirms; Escape cancels.${view3D?' H shows the horizon.':''} Named controls are below." aria-describedby="command-hint"></canvas><div id="turn-replay" class="turn-replay" hidden role="status"></div></div>
      <div class="command-board-caption"><span id="board-hover" role="status"></span><span class="command-board-key">${political ? 'Select a delegate to consider their position' : 'Select a figure or a position to give an order'}</span></div>
    </section>
    ${fieldGuide(state,{selected:actor.id,action,target,enabled:context.guide!==false})}
    <section class="command-dock" aria-label="Command dock">
      <section class="command-company" aria-label="${political ? 'Your speakers' : 'Your company'}">
        <div class="command-actor"><span class="command-kicker">${political ? 'YOUR SPEAKER' : 'YOUR UNIT'}</span><h2>${esc(actor.name)}</h2><p>${actor.resolve ?? actor.hp}/${actor.maxResolve ?? actor.maxHp} ${political ? 'Resolve' : 'health'} · ${location(actor)}${actor.facing && !political ? ` · ${esc(actor.facing)}` : ''}</p><span class="command-readiness">${independentAlly ? `<span class="${actorReadiness.available ? '' : 'is-spent'}">${esc(actorReadiness.description)}</span>` : `<span class="${actions.includes('move') || actions.includes('deploy') ? '' : 'is-spent'}">${actions.includes('move') || actions.includes('deploy') ? 'Move ready' : 'Move spent'}</span><span class="${actions.some(a => !['move','deploy'].includes(a)) ? '' : 'is-spent'}">${actor.acted ? (actions.includes('order') ? 'Orders ready' : 'Action spent') : active ? 'Action ready' : 'Encounter resolved'}</span>`}</span></div>
        ${units.length > 1 ? `<div class="command-roster" role="group" aria-label="Select a ${political ? 'speaker' : 'unit'}">${units.map(u => {const status = readiness(state, u);return `<button id="select-unit-${esc(u.id)}" data-cmd="select-unit" data-id="${esc(u.id)}" aria-pressed="${actor.id === u.id}" aria-label="${esc(u.name)}, ${u.resolve ?? u.hp} ${political ? 'Resolve' : 'health'}, ${esc(status.description)}"><span class="roster-mark ${status.available ? '' : 'is-spent'}" aria-hidden="true">${u.id === 'hero' ? '★' : '◆'}</span><span>${esc(u.name)}<small>${u.resolve ?? u.hp} · ${status.label}</small></span></button>`;}).join('')}</div>` : ''}
        ${political && e.politicsVersion === 2 ? `<p class="command-cooperation">${esc(politicalPosition(state, actor.id).message)}</p>` : ''}
      </section>
      <section class="command-options" aria-label="Available commands" ${!active ? 'hidden' : ''}>
        <p id="command-hint" class="command-hint">${esc(directHint || instruction(state, action, target, actor))}</p>
        <div class="command-actions" role="group" aria-label="Available actions">${actions.map((a, i) => `<button id="action-${a}" data-cmd="action" data-id="${a}" aria-pressed="${action === a}" title="${esc(actionNames[a])}${i < 9 ? ` · key ${i + 1}` : ''}"><span class="command-action-symbol" aria-hidden="true">${actionSymbols[a] || '·'}</span><span>${esc(actionNames[a])}</span>${i < 9 ? `<kbd aria-hidden="true">${i + 1}</kbd>` : ''}</button>`).join('')}</div>
        ${formationControls(e, action, formation, orderAction)}
        ${political&&state.progressionVersion===1?`<label class="delegate-selector" for="delegate-inspect">Consider an agreement<select id="delegate-inspect"><option value="">Inspect a representative…</option>${voters.filter(v=>!v.hidden).map(v=>`<option value="${esc(v.id)}" ${point?.unitId===v.id?'selected':''}>${esc(v.name)} · ${esc(v.interest)}</option>`).join('')}</select></label>`:''}
      </section>
      <section class="command-inspector" aria-label="Target and action preview">
        <div class="command-inspection" ${!active ? 'hidden' : ''}>
          ${inspector(e, actor, point, Boolean(target))}
          ${political?agreementConversation(state,inspectedUnit(e,point)?.id):''}
          ${previewCard(preview, action, e)}
          <div class="command-commit"><button id="confirm-action" class="primary" data-cmd="confirm" ${!preview?.ok || !active ? 'disabled' : ''}>Confirm ${esc(actionNames[action] || 'order')} <span aria-hidden="true">↵</span></button><button id="end-turn" data-cmd="end-turn" ${!active ? 'disabled' : ''}>End turn <span aria-hidden="true">→</span></button>${action ? '<button class="command-cancel" data-cmd="cancel-action" aria-label="Cancel selected action">Cancel</button>' : ''}</div>
          <p id="action-feedback" class="action-feedback" role="status" ${feedback ? '' : 'hidden'}>${esc(feedback)}</p>
        </div>${outcome(e)}
      </section>
    </section>
    <section class="command-records" aria-label="Encounter reference and accessible controls">
      ${tacticalCoaching(state,context.coach!==false)}
      <details id="command-named-controls" class="command-named-controls"><summary>Named controls & keyboard</summary><div class="command-selectors">
        <label for="unit-select">${political ? 'Speaker' : 'Unit'}<select id="unit-select">${units.map(u => `<option value="${esc(u.id)}" ${actor.id === u.id ? 'selected' : ''}>${esc(u.name)} · ${u.resolve ?? u.hp}/${u.maxResolve ?? u.maxHp}</option>`).join('')}</select></label>
        <label for="action-select">Action<select id="action-select" aria-describedby="command-hint"><option value="">Choose an action…</option>${actions.map(a => `<option value="${a}" ${action === a ? 'selected' : ''}>${esc(actionNames[a])}</option>`).join('')}</select></label>
        <label for="target-select">Target<select id="target-select" ${!targets.length ? 'disabled' : ''}><option value="">${targets.length ? 'Choose a target…' : 'No legal targets'}</option>${selectOptions}</select></label>
      </div><p>${view3D?'In 3D: drag to orbit, scroll or +/− to zoom, F to follow, Home for overview, H for the horizon. ':''}On the board: arrows move the cursor; Enter selects or confirms. Keys 1–9 choose commands, N cycles units, E ends the turn. Escape or right-click cancels the selected command. Tab reaches every control.</p></details>
      <details id="command-mission-record" class="command-mission-record"><summary>${political ? 'Motion, delegates & obligations' : 'Mission & company orders'}</summary>
        ${voicedBriefing(state)}
        ${missionBrief(e)}<div class="command-reference-grid"><section><h2>Your objective</h2><p>${esc(e.objective)}</p>${e.issue ? `<p><strong>Before the chamber:</strong> ${esc(e.issue)}</p>` : ''}${requirements()}${e.mission?.points?.length ? `<p>Objectives: ${e.mission.points.map(p => `${location(p)}${p.secured ? ' ✓' : ''}`).join(' · ')}</p>` : ''}${e.pressure ? `<p>${esc(e.pressure)}</p>` : ''}
        <p class="command-legend">★ Commander · ◆ Allies · ▼ Rivals · ⚑ Objective. Outlined positions are legal targets. Base arrows show facing; arcs show bracing. Formation bases show a line, wedge or battlement; ! marks low morale. Double vote rims show commitment; wax seals mark promises.</p><div class="command-reference-buttons"><button data-cmd="retry">Retry checkpoint</button><button data-cmd="help">Rules & controls</button></div></section>
        ${vote ? `<section>${coalitionPanel(e, vote)}<h2>The delegates</h2><div class="delegate-list">${voters.map(u => `<article><strong>${esc(u.name)}</strong><span>${esc(u.bloc)} · ${u.stance >= 1 ? 'Supports' : 'Opposes'} (${signed(u.stance)})</span><small>Interest: ${esc(u.interest || 'Listen to the delegate’s position.')}</small></article>`).join('')}</div>${e.staged?.obligations?.length ? `<h3>Promises made in this chamber</h3><ul>${e.staged.obligations.map(o => `<li>${esc(o.to)} · ${Number(o.cost) || 2} supplies, due chapter ${o.due}. ${esc(o.consequence)}</li>`).join('')}</ul>` : ''}</section>` : ''}</div>
      </details>
      <details id="command-intelligence" class="command-intelligence"><summary>${political ? 'Rival intentions & chamber record' : 'Visible threats & field dispatches'}</summary>${fieldIntel(e)}<h2>${political ? 'Chamber record' : 'Field dispatches'}</h2><div class="combat-log" aria-label="Encounter log">${(e.log || []).slice(-14).reverse().map(t => `<p>${esc(t)}</p>`).join('')}</div></details>
    </section>
  </main>`;
}
