import {controlKeys} from './control-preferences.js';
import {commandIntelligence} from './command-edition-views.js';
import {expandedPanel} from './expanded-views.js';
import {fieldGuide} from './field-guide.js';
import {agreementConversation} from './progression-views.js';
import * as Game from '../core/game.js';
import {operationBanner,tacticalCoaching,voicedBriefing} from './campaign-upgrade-views.js';
import {esc, roman, actionNames, actionSymbols} from './view-helpers.js';
import {missionBrief, coalitionPanel, defeatPage, fieldIntel, selectedGround, resultRecord, terrainLabel, fieldLabel} from './tactical-intel.js';
import {politicalPosition} from '../core/contest.js';
import {FORMATION_RULES} from '../data/battle-balance.js';
import {turnScrubberItems} from './turn-replay.js';
import {combatModifiers, threatEnvelope} from '../showcase/stage-readout.js';
import {actionCostLabel, explainActionTargetGap, explainUnavailableActions, formationRosterPreview, delegateAppealSummary, unusedTurnSummary} from './direct-controls.js';

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

export function selectedCommand({selected, action, target, formation, orderAction, orderDestination}) {
  if (!action || !target) return null;
  const destination = action === 'order' && (orderAction || 'advance') === 'advance' && orderDestination ? orderDestination : undefined;
  return {unitId: selected, action, x: target.x, y: target.y, ...(target.unitId ? {targetId: target.unitId} : {}), formation, orderAction, ...(destination ? {destination} : {})};
}

export function targetName(state, target) {
  const unit = state.encounter.units.find(u => u.id === target.unitId);
  return `${unit?.name || target.label || [fieldLabel(state.encounter, target), terrainLabel(state.encounter, target)].filter(Boolean).join(' · ')} · ${location(target)}${target.cost !== undefined ? ` · ${target.cost} movement` : ''}${unit?.stance !== undefined ? ` · stance ${unit.stance}` : ''}${unit?.interest ? ` · ${unit.interest}` : ''}`;
}

function instruction(state, action, target, actor, confirmMoves = false, keyBindings = {}) {
  const e = state.encounter, ground = confirmMoves ? 'select open ground to preview a walk there, then select it again to go' : 'select open ground to walk there', Ground = ground[0].toUpperCase() + ground.slice(1);
  if (e.status !== 'active') return 'Review the outcome and record it, or regroup at the checkpoint.';
  if (e.kind === 'battle' && actor.side === 'ally' && !Game.getActions(state, actor.id).length) return `${readiness(state, actor).description}. Select your commander to act, or end the turn.`;
  if (action && !Game.getTargets(state, actor.id, action).length) return explainActionTargetGap(state, actor.id, action);
  if (target) return 'Review the cost. Select this target again, or Confirm, to act.';
  if (action) return `Select a highlighted target for ${actionNames[action]}.`;
  if (actor.acted && Game.getActions(state, actor.id).some(a => ['order', 'formation'].includes(a))) return 'Personal action spent. Your remaining commands can still direct the company.';
  const nextReady = e.units.find(u => u.id !== actor.id && ['player', 'ally'].includes(u.side) && (u.resolve ?? u.hp) > 0 && Game.getActions(state, u.id).length);
  if (actor.acted) return actor.moved ? (nextReady ? `This unit has finished. Select a ready comrade (${nextReady.name}, key ${controlKeys(keyBindings).next}) or end the turn.` : 'This unit has finished. End the turn when ready.') : `Action spent. ${Ground}, or end the turn.`;
  if (e.type === 'training') {
    const next = ['move', 'throw', 'strike', 'brace'].find(a => !e.usedAbilities.includes(a));
    return next ? `Varro’s next lesson: ${actionNames[next]}. ${next === 'move' ? `${Ground}.` : 'Select a command, then its target.'}` : 'The drill is complete. End your turn for Varro’s assessment.';
  }
  return e.kind === 'contest' ? `Select a delegate to consider an appeal, or ${confirmMoves ? 'select open ground to preview your speaker’s walk' : 'select open ground to walk your speaker there'}.` : `${Ground}, or select a comrade or an opponent. Review any other order before you commit.`;
}

function outcome(e, archiveReplay = null) {
  if (e.status === 'active') return '';
  const won = e.status === 'won';
  if (archiveReplay) {
    return `<section class="result command-result ${won ? 'result-won' : 'result-lost'}" role="status">
      <span class="eyebrow">ARCHIVE OF THE REIGN · SANDBOX COMPLETE</span>
      <h2>${won ? 'Archive replay victorious.' : 'Archive replay concluded.'}</h2>
      <p>${esc(e.log?.at(-1) || '')}</p>${resultRecord(e)}
      <p class="panel-note">Chronicle record: ${archiveReplay.recordedTurns} turns · This sandbox run: ${e.turn} turns. Your primary campaign save remains untouched.</p>
      <div class="panel-actions"><button class="primary" data-cmd="exit-archive">Return to chronicle →</button><button data-cmd="retry">Replay again</button></div>
    </section>`;
  }
  return `<section class="result command-result ${won ? 'result-won' : 'result-lost'}" role="status">
    <span class="eyebrow">${won ? 'OBJECTIVE ACHIEVED' : 'A CHANCE TO REGROUP'}</span>
    <h2>${won ? (e.kind === 'contest' ? 'The motion carries.' : 'The day is yours.') : (e.kind === 'contest' ? 'The motion is defeated.' : 'The field is lost.')}</h2>
    <p>${esc(e.log?.at(-1) || '')}</p>${resultRecord(e)}${won ? '' : defeatPage(e)}
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
    const appeals = delegateAppealSummary(subject, e.politicsVersion);
    return `<div class="command-person delegate-conversation">
      <div class="delegate-seal" aria-hidden="true">${esc((subject.bloc || 'Delegate').slice(0, 1))}</div>
      <div><span class="command-kicker">${esc(subject.bloc)} · ${esc(subject.interest || 'delegate')}</span><h2>${esc(subject.name)}</h2>
      <p class="delegate-position ${subject.stance >= 1 ? 'is-supporting' : ''}">${subject.stance >= 1 ? 'Supports you' : 'Opposes you'} <strong>${signed(subject.stance)}</strong>${committed ? ' · committed' : ' · wavering'}${e.promises?.includes(subject.id) ? ' · promised' : ''}</p></div>
      <p class="delegate-interest">${esc(interestNotes[subject.interest] || 'Consider this delegate’s position before choosing an appeal.')}${appeals ? ` ${esc(appeals)}.` : ''}${!hasTarget ? ' Choose a command or move into reach.' : ''}</p>
    </div>`;
  }
  if (subject && subject.id !== actor.id) return `<div class="command-person ${subject.side === 'enemy' ? 'is-rival' : 'is-friendly'}">
    <span class="command-kicker">${subject.side === 'enemy' ? 'OPPOSITION' : 'COMPANY'} · ${location(subject)}</span><h2>${esc(subject.name)}</h2>
    <p>${subject.resolve !== undefined ? `${subject.resolve}/${subject.maxResolve} Resolve (speaking stamina; 0 withdraws from speaking, vote remains)` : `${subject.hp}/${subject.maxHp} health · ${subject.morale ?? 80} morale`}${subject.facing ? ` · facing ${esc(subject.facing)}` : ''}</p>
    ${subject.intent ? `<p class="command-intent"><span>Next plan if the position holds</span>${esc(subject.intent)}</p>` : ''}${subject.side === 'enemy' && e.kind === 'battle' ? (() => {const env = threatEnvelope(e, subject.id); return env ? `<p class="threat-envelope-readout">Reach: ${env.moveTiles.length} tiles · range ${env.range}${env.threatenedUnits.length ? ` · threatens ${esc(env.threatenedUnits.map(u => u.name).join(', '))}` : ''}</p>` : '';})() : ''}</div>`;
  return `<div class="command-ground">${selectedGround(e, actor, point)}${actor.intent ? `<p class="command-intent"><span>Current plan</span>${esc(actor.intent)}</p>` : ''}</div>`;
}

function renderModifierChips(modifiers = []) {
  if (!modifiers.length) return '';
  return `<div class="modifier-chips" aria-label="Action modifiers">${modifiers.map(m => `<span class="modifier-chip is-${esc(m.tone || 'neutral')}">${esc(m.label)}${m.value !== null && m.value !== undefined ? ` <strong>${signed(m.value)}</strong>` : ''}</span>`).join('')}</div>`;
}

function previewCard(preview, action, e, modifiers = []) {
  if (!preview) return '';
  const chips = renderModifierChips(modifiers);
  const f = preview.forecast;
  if (!f) return `<div id="action-preview" class="command-preview ${preview.ok ? '' : 'is-invalid'}" role="status">${chips}${esc(preview.message)}</div>`;
  const changes = [...f.stanceChanges.map(c => `${c.name}: ${signed(c.from)} → ${signed(c.to)}`), ...f.resolveChanges.map(c => `${c.name}: ${c.from} → ${c.to} Resolve`)];
  return `<div id="action-preview" class="command-preview" role="status">${chips}
    <div class="command-forecast"><strong>Support ${f.votesBefore} → ${f.votesAfter}</strong><span>${f.speechCost} speech${f.publicCost ? ` · −${f.publicCost} Public` : ''}</span></div>
    ${changes.length ? `<p class="command-change">${esc(changes.join(' · '))}</p>` : '<p>Blunts this rival’s next speech to at most 1 stance or Resolve loss.</p>'}
    ${f.promise ? `<p class="command-debt"><strong>Promise ${e.promises.length + 1}/2 · ${f.promise.cost} supplies owed at accession.</strong> Each missing supply costs 1 Public. Break it: −8 Public, −4 Backing.</p>` : ''}
    ${action === 'threaten' ? '<p class="command-debt">Bloc backlash is included above. Later threats against this bloc lose 1 strength.</p>' : ''}
    ${action === 'record' ? '<p class="command-limit">This delegate can hear your Record once per Contest.</p>' : ''}
    ${action === 'denounce' ? '<p class="command-limit">A withdrawn speaker keeps their vote.</p>' : ''}
    <details id="command-full-forecast" class="command-forecast-detail"><summary>Full forecast & terms</summary><p>${esc(preview.message)}</p></details>
  </div>`;
}

function formationControls(state, action, formation, orderAction, target, orderDestination) {
  if (!['order', 'formation'].includes(action)) return '';
  const e = state.encounter;
  const destinations = action === 'order' && (orderAction || 'advance') === 'advance' && e.combatVersion === 2 && target?.unitId ? Game.allyDestinations(state, target.unitId) : [];
  const roster = action === 'formation' && target?.unitId ? formationRosterPreview(state, target.unitId, formation || 'shield-wall') : null;
  return `<div class="command-formation">
    ${action === 'formation' ? `<label for="formation-kind">Formation<select id="formation-kind">${[['shield-wall', 'Shield wall · protection, move 1'], ['line', e.combatVersion === 2 ? 'Line · movement, morale and screen' : 'Line · movement and morale'], ['wedge', e.combatVersion === 2 ? 'Wedge · attack on firm ground, exposed' : 'Wedge · +1 attack, +1 damage taken']].map(([value, label]) => `<option value="${value}" ${formation === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}
    <label for="order-kind">Order<select id="order-kind">${[['advance', 'Advance toward objective'], ['attack', e.combatVersion === 2 ? 'Attack the strongest opportunity' : 'Attack nearest enemy'], ['hold', 'Hold and brace'], ['rally', 'Restore morale'], ...(e.combatVersion === 2 ? [['withdraw', 'Withdraw toward commander']] : [])].map(([value, label]) => `<option value="${value}" ${orderAction === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    ${destinations.length ? `<label for="order-destination">Advance position<select id="order-destination"><option value="">Nearest path toward objective</option>${destinations.map(d => `<option value="${d.x},${d.y}" ${orderDestination && orderDestination.x === d.x && orderDestination.y === d.y ? 'selected' : ''}>${location(d)} · ${esc(terrainLabel(e, d))} (${d.cost} move)</option>`).join('')}</select></label>` : ''}
    ${action === 'formation' && e.combatVersion === 2 ? `<p>${esc(FORMATION_RULES[formation || 'shield-wall']?.summary || '')}</p>` : ''}
    ${roster ? `<p class="formation-roster-preview">${esc(roster.summary)}</p>` : ''}
  </div>`;
}

export function precedentPanel(state) {
  const plan = Game.precedentOptions(state);
  if (!plan.motions.length) return '';
  return `<details id="chamber-precedents" class="progression-panel chamber-precedents"><summary>Career precedent motions · ${plan.used ? `Invoked (${esc(plan.used)})` : '1 per Contest'}</summary><p>Invoke your earned military, provincial, or fiscal record once per Contest using your commander’s speech.</p><div class="precedent-list">${plan.motions.map(m => `<article class="precedent-card ${m.unlocked ? 'unlocked' : 'locked'}"><div><strong>${esc(m.label)}</strong> <span class="status-pill">${esc(m.bloc)}</span><p>${esc(m.summary)}</p></div><button data-cmd="invoke-precedent" data-id="${esc(m.id)}" ${m.available ? '' : 'disabled'}>${plan.used === m.id ? 'Invoked' : m.unlocked ? 'Invoke precedent' : 'Locked'}</button></article>`).join('')}</div></details>`;
}

function fieldworkPanel(state) {
  const plan = Game.fieldworkOptions(state);
  if (!plan.options?.length) return '';
  return `<details id="battle-fieldworks" class="progression-panel battle-fieldworks"><summary>Legionary munitiones · ${plan.used ? `Erected (${esc(plan.used)})` : '1 per battle'}</summary><p>Order your engineering detachment to erect field fortifications on your commander’s tile once per battle.</p><div class="precedent-list">${plan.options.map(t => `<article class="precedent-card ${t.unlocked ? 'unlocked' : 'locked'}"><div><strong>${esc(t.label)}</strong> <span class="status-pill">${esc(t.latin)}</span><p>${esc(t.summary)}</p></div><button data-cmd="invoke-fieldwork" data-id="${esc(t.id)}" ${t.available ? '' : 'disabled'}>${plan.used === t.id ? 'Erected' : t.unlocked ? 'Erect fieldwork' : 'Locked'}</button></article>`).join('')}</div></details>`;
}

function archiveMutators(state) {
  const m = state.archiveReplay || {}, e = state.encounter;
  return `<details class="archive-mutators"><summary>War-Room Mutators</summary><div class="archive-mutator-controls"><label>Difficulty<select id="archive-difficulty">${['story','standard','veteran'].map(d => `<option value="${d}" ${(m.difficulty || state.difficulty || 'standard') === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label><label>Weather<select id="archive-weather">${['clear','mist','rain','dust','embers'].map(w => `<option value="${w}" ${(m.weather || e.weather || 'clear') === w ? 'selected' : ''}>${w}</option>`).join('')}</select></label><label>Hour<select id="archive-time">${['day','dawn','dusk','night'].map(t => `<option value="${t}" ${(m.timeOfDay || e.timeOfDay || 'day') === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${state.chapter === 12 ? `<label>Approach<select id="archive-route">${['backer','battle','defection','settlement','surrender'].map(r => `<option value="${r}" ${(m.route || state.route || 'backer') === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>` : ''}<button class="ghost small" data-cmd="apply-archive-mutators">Apply mutators</button></div></details>`;
}

function actionButtons(state,actor,actions,selected,political){
  const primary=political?['move','persuade','rebut']:['move','strike','throw','brace'];
  const button=a=>{const i=actions.indexOf(a);return `<button id="action-${a}" data-cmd="action" data-id="${a}" aria-pressed="${selected===a}" title="${esc(actionNames[a])} (${esc(actionCostLabel(state,actor,a))})${i<9?` · key ${i+1}`:''}"><span class="command-action-symbol" aria-hidden="true">${actionSymbols[a]||'·'}</span><span>${esc(actionNames[a])}</span>${i<9?`<kbd aria-hidden="true">${i+1}</kbd>`:''}</button>`;};
  const common=actions.filter(a=>primary.includes(a)),other=actions.filter(a=>!primary.includes(a));
  return `<div class="command-actions" role="group" aria-label="Available actions">${common.map(button).join('')}</div>${other.length?`<details id="command-more-actions" class="command-more-actions"${other.includes(selected)?' open':''}><summary>More actions (${other.length})</summary><div class="command-actions" role="group" aria-label="More actions">${other.map(button).join('')}</div></details>`:''}`;
}

export function encounterView(context) {
  const {view3D=false,can3D=false,fastMotion=false,confirmMoves=false,state, selected, action, target, focusTile, showGrid = false, formation, orderAction, orderDestination, feedback = '', directHint, requirements = () => '', artProgress = '', offlineProgress = '', saving = false, lastSaved = '', saveProblem = '', saveConflict = false} = context;
  const key=controlKeys(context.keyBindings);
  const e = state.encounter, actor = selectedActor(state, selected), active = e.status === 'active', political = e.kind === 'contest';
  const actions = Game.getActions(state, actor.id), targets = action ? Game.getTargets(state, actor.id, action) : [];
  const command = selectedCommand({...context, selected: actor.id}), preview = command ? Game.preview(state, command) : null;
  const voters = e.units.filter(u => u.role === 'voter'), vote = Game.voteCount(state);
  const units = e.units.filter(u => ['player', 'ally'].includes(u.side) && (u.resolve ?? u.hp) > 0);
  const selectOptions = targets.map((t, i) => `<option value="${i}" ${target && t.x === target.x && t.y === target.y && t.unitId === target.unitId ? 'selected' : ''}>${esc(targetName(state, t))}</option>`).join('');
  const progress = typeof e.objectiveProgress === 'string' ? e.objectiveProgress : '';
  const point = target || focusTile;
  const actorReadiness = readiness(state, actor), independentAlly = !political && actor.side === 'ally';
  const scrubber = turnScrubberItems(e, e.turnEvents);
  const turnSummary = unusedTurnSummary(state), unavailable = explainUnavailableActions(state, actor.id);
  const undo = Game.canUndoMove(state, actor.id), beacons = Game.reinforcementBeacons(e);
  return `<main id="main" class="encounter-frame command-stage ${political ? 'command-chamber' : 'command-battle'}" data-outcome="${esc(e.status)}">
    <header class="command-mission" aria-label="Current tactical objective">
      <div class="command-title"><span class="command-kicker">CHAPTER ${roman(state.chapter)} · ${political ? 'THE CHAMBER' : e.type === 'training' ? 'THE DRILL GROUND' : 'IN THE FIELD'}</span><h1>${esc(e.title)}</h1></div>
      <div class="command-clock"><strong>TURN ${e.turn}<span> / ${e.turnLimit}</span></strong><span>${vote ? `${vote.for}/${vote.total} support · ${vote.majority} needed` : e.commandCapacity ? `${e.commandsLeft}/${e.commandCapacity} orders` : 'One move · one action'}</span><span class="save-status" role="status">${saving ? 'Saving…' : lastSaved ? 'Saved' : ''}</span></div>
      <nav class="command-navigation" aria-label="Encounter menu"><button data-cmd="journal" aria-label="Open orders and chronicle">Orders</button><button data-cmd="menu">Menu</button></nav>
    </header>
    ${commandIntelligence(state)}
    ${state.archiveReplay ? `<div class="archive-banner" role="status"><div><span class="eyebrow">ARCHIVE OF THE REIGN · SANDBOX REPLAY</span><strong>${esc(state.archiveReplay.title)}</strong><span>Chronicle record: ${state.archiveReplay.recordedTurns} turns · ${state.archiveReplay.recordedLosses} withdrawn. Primary save is untouched.</span></div>${archiveMutators(state)}<button class="ghost small" data-cmd="exit-archive">Return to chronicle →</button></div>` : ''}
    ${operationBanner(e)}
    ${saveProblem ? `<div class="command-save-warning" role="alert"><p>${esc(saveProblem)}</p><div><button data-cmd="export">Export a save code</button>${saveConflict ? '<button data-cmd="takeover">Continue in this tab</button>' : ''}</div></div>` : ''}
    <div class="command-runtime"><span id="art-loading-status" role="status" ${artProgress ? '' : 'hidden'}>${esc(artProgress)}</span><span id="offline-status" role="status" ${offlineProgress ? '' : 'hidden'}>${esc(offlineProgress)}</span></div>
    <section class="command-field" aria-label="${political ? 'Political chamber' : 'Battlefield'}">
      <div class="command-field-status"><p>${vote ? `<strong>${vote.for >= vote.majority ? 'Majority held for now' : `${Math.max(0, vote.majority - vote.for)} more votes needed`}</strong> · ${Math.max(0, e.turnLimit - e.turn + 1)} turns to vote · ${Math.max(0, 2 - (e.promises?.length || 0))} promises left` : esc(progress || e.objective)}</p><button class="command-grid-toggle" data-cmd="toggle-grid" aria-pressed="${showGrid}">Grid ${showGrid ? 'on' : 'off'}</button></div>
      ${can3D ? `<details id="command-camera-options" class="command-camera-options"><summary>Camera & view</summary><div class="battle-camera" aria-label="Scene view"><button data-cmd="view-3d">${view3D?'Switch to 2D':'Switch to 3D'}</button>${view3D?`<button data-cmd="camera-home">Overview</button><button data-cmd="camera-focus">Follow unit</button><button data-cmd="camera-horizon" aria-keyshortcuts="${key.horizon}" title="See the sky and distant landscape (${key.horizon})">Horizon</button><button data-cmd="camera-speed" aria-pressed="${Boolean(fastMotion)}" title="Toggle 2× turn playback speed (or click/Space during motion)">Speed ${fastMotion?'2×':'1×'}</button><div class="camera-zoom"><button data-cmd="camera-in" aria-label="Zoom in">+</button><button data-cmd="camera-out" aria-label="Zoom out">−</button></div><span>Drag to orbit · scroll to zoom · ${key.horizon} for horizon</span>`:''}</div></details>`:''}
      <div class="battle-stage command-canvas ${view3D?'battle-3d':''}">${view3D?`<span class="battle-loading" role="status">${political?'Preparing the chamber…':'Preparing the battlefield…'}</span>`:''}<canvas id="battle-board" data-key="board:${view3D?'3d':'2d'}:${esc(e.id)}" tabindex="0" role="application" aria-label="${political ? 'Political chamber' : 'Battlefield'} grid. ${confirmMoves ? 'Select a friendly unit, opponent or ground to preview. Select the same target again to confirm.' : 'Select open ground to walk there; Undo Move takes it back until you act. Select a unit or other target to preview an order, then select it again to confirm.'} Arrow keys move the cursor; Enter selects or confirms; Escape cancels.${view3D?` ${key.horizon} shows the horizon.`:''} Named controls are below." aria-describedby="command-hint"></canvas><div id="turn-replay" class="turn-replay" hidden role="status"></div></div>
      <div class="command-board-caption"><span id="board-hover" role="status"></span><span class="command-board-key">${political ? 'Select a delegate to consider their position' : 'Select a figure or a position to give an order'}</span></div>
      ${scrubber.length ? `<div id="turn-scrubber" class="turn-scrubber" role="toolbar" aria-label="Turn event scrubber"><span class="scrubber-label">Recent steps</span>${scrubber.map(item => `<button class="scrubber-pill" data-cmd="scrub-step" data-index="${item.index}" data-unit="${esc(item.unitId || '')}" data-x="${item.x ?? ''}" data-y="${item.y ?? ''}" title="${esc(item.text)}">${item.index + 1}. ${esc(item.label)}</button>`).join('')}</div>` : ''}
    </section>
    ${fieldGuide(state,{selected:actor.id,action,target,enabled:context.guide!==false})}
    <section class="command-dock" aria-label="Command dock">
      <section class="command-company" aria-label="${political ? 'Your speakers' : 'Your company'}">
        <div class="command-actor"><span class="command-kicker">${political ? 'YOUR SPEAKER' : 'YOUR UNIT'}</span><h2>${esc(actor.name)}</h2><p ${political ? 'title="Resolve: speaking stamina; 0 withdraws from speaking, vote remains"' : ''}>${actor.resolve ?? actor.hp}/${actor.maxResolve ?? actor.maxHp} ${political ? 'Resolve' : 'health'} · ${location(actor)}${actor.facing && !political ? ` · ${esc(actor.facing)}` : ''}</p><span class="command-readiness">${independentAlly ? `<span class="${actorReadiness.available ? '' : 'is-spent'}">${esc(actorReadiness.description)}</span>` : `<span class="${actions.includes('move') || actions.includes('deploy') ? '' : 'is-spent'}">${actions.includes('move') || actions.includes('deploy') ? 'Move ready' : 'Move spent'}</span><span class="${actions.some(a => !['move','deploy'].includes(a)) ? '' : 'is-spent'}">${actor.acted ? (actions.includes('order') ? 'Orders ready' : 'Action spent') : active ? 'Action ready' : 'Encounter resolved'}</span>`}</span></div>
        ${units.length > 1 ? `<div class="command-roster" role="group" aria-label="Select a ${political ? 'speaker' : 'unit'}">${units.map(u => {const status = readiness(state, u);return `<button id="select-unit-${esc(u.id)}" data-cmd="select-unit" data-id="${esc(u.id)}" aria-pressed="${actor.id === u.id}" aria-label="${esc(u.name)}, ${u.resolve ?? u.hp} ${political ? 'Resolve' : 'health'}, ${esc(status.description)}"><span class="roster-mark ${status.available ? '' : 'is-spent'}" aria-hidden="true">${u.id === 'hero' ? '★' : '◆'}</span><span>${esc(u.name)}<small>${u.resolve ?? u.hp} · ${status.label}</small></span></button>`;}).join('')}</div>` : ''}
        ${e.featureEdition===31&&!political&&e.type!=='training'?`<p class="command-cohesion">Cohesion ${actor.cohesion??80}/100 · suppression ${actor.suppression??0}/3</p>`:''}
      ${political && e.politicsVersion === 2 ? `<p class="command-cooperation">${esc(politicalPosition(state, actor.id).message)}</p>` : ''}
      </section>
      <section class="command-options" aria-label="Available commands" ${!active ? 'hidden' : ''}>
        <p id="command-hint" class="command-hint">${esc(directHint || instruction(state, action, target, actor, confirmMoves, context.keyBindings))}</p>
        ${actionButtons(state,actor,actions,action,political)}
        ${formationControls(state, action, formation, orderAction, target, orderDestination)}
        ${political&&state.progressionVersion===1?`<label class="delegate-selector" for="delegate-inspect">Consider an agreement<select id="delegate-inspect"><option value="">Inspect a representative…</option>${voters.filter(v=>!v.hidden).map(v=>`<option value="${esc(v.id)}" ${point?.unitId===v.id?'selected':''}>${esc(v.name)} · ${esc(v.interest)}</option>`).join('')}</select></label>`:''}
      </section>
      <section class="command-inspector" aria-label="Target and action preview">
        <div class="command-inspection" ${!active ? 'hidden' : ''}>
          ${inspector(e, actor, point, Boolean(target))}
          ${political?agreementConversation(state,inspectedUnit(e,point)?.id):''}
          ${previewCard(preview, action, e, combatModifiers(state, command))}
          <div class="command-commit"><button id="confirm-action" class="primary" data-cmd="confirm" ${!preview?.ok || !active ? 'disabled' : ''}>Confirm ${esc(actionNames[action] || 'order')} <span aria-hidden="true">↵</span></button>${undo.available ? `<button id="undo-move" class="command-undo" data-cmd="undo-move" aria-keyshortcuts="${key.undo}" title="${esc(undo.reason)} (key ${key.undo})">↶ Undo move (${location(undo.origin)})</button>` : ''}<button id="end-turn" data-cmd="end-turn" title="${esc(turnSummary.message)}" ${!active ? 'disabled' : ''}>End turn <span aria-hidden="true">→</span></button>${action ? '<button class="command-cancel" data-cmd="cancel-action" aria-label="Cancel selected action">Cancel</button>' : ''}</div>
          <p id="action-feedback" class="action-feedback" role="status" ${feedback ? '' : 'hidden'}>${esc(feedback)}</p>
        </div>${outcome(e, state.archiveReplay)}
      </section>
    </section>
    <section class="command-records" aria-label="Encounter reference and accessible controls">
      ${expandedPanel(state)}
      ${political && e.politicsVersion === 2 ? precedentPanel(state) : (!political && e.combatVersion === 2 && e.type !== 'training' ? fieldworkPanel(state) : '')}
      ${tacticalCoaching(state,context.coach!==false,actor.id)}
      <details id="command-named-controls" class="command-named-controls"><summary>Named controls & keyboard</summary><div class="command-selectors">
        <label for="unit-select">${political ? 'Speaker' : 'Unit'}<select id="unit-select">${units.map(u => `<option value="${esc(u.id)}" ${actor.id === u.id ? 'selected' : ''}>${esc(u.name)} · ${u.resolve ?? u.hp}/${u.maxResolve ?? u.maxHp}</option>`).join('')}</select></label>
        <label for="action-select">Action<select id="action-select" aria-describedby="command-hint"><option value="">Choose an action…</option>${actions.map(a => `<option value="${a}" ${action === a ? 'selected' : ''}>${esc(actionNames[a])} (${esc(actionCostLabel(state, actor, a))})</option>`).join('')}</select></label>
        <label for="target-select">Target<select id="target-select" ${!targets.length ? 'disabled' : ''}><option value="">${targets.length ? 'Choose a target…' : 'No legal targets'}</option>${selectOptions}</select></label>
      </div>${unavailable.length ? `<p class="command-unavailable-note"><strong>Unavailable right now:</strong> ${esc(unavailable.map(item => `${item.label} (${item.reason})`).join(' · '))}</p>` : ''}<p>${view3D?`In 3D: drag to orbit, scroll or +/− to zoom, ${key.focus} to follow, Home for overview, ${key.horizon} for the horizon. `:''}On the board: arrows move the cursor; Enter selects or confirms. Keys 1–9 choose commands, ${key.undo} undoes an uncommitted move, ${key.next} cycles units, ${key.endTurn} ends the turn. Escape or right-click cancels the selected command. Tab reaches every control.</p></details>
      <details id="command-mission-record" class="command-mission-record"><summary>${political ? 'Motion, delegates & obligations' : 'Mission & company orders'}</summary>
        ${voicedBriefing(state)}
        ${missionBrief(e)}<div class="command-reference-grid"><section><h2>Your objective</h2><p>${esc(e.objective)}</p>${e.issue ? `<p><strong>Before the chamber:</strong> ${esc(e.issue)}</p>` : ''}${requirements()}${e.mission?.points?.length ? `<p>Objectives: ${e.mission.points.map(p => `${location(p)}${p.secured ? ' ✓' : ''}`).join(' · ')}</p>` : ''}${e.pressure ? `<p>${esc(e.pressure)}</p>` : ''}${beacons.length ? `<p class="reinforcement-schedule"><strong>Incoming waves:</strong> ${beacons.map(b => `${esc(b.label)} at ${esc(b.coord)}${b.imminent ? ' (imminent)' : ` (${b.turnsLeft}t)`}`).join(' · ')}</p>` : ''}
        <p class="command-legend">★ Commander · ◆ Allies · ▼ Rivals · ⚑ Objective. Outlined positions are legal targets. Base arrows show facing; arcs show bracing. Formation bases show a line, wedge or battlement; ! marks low morale. Double vote rims show commitment; wax seals mark promises.</p><div class="command-reference-buttons"><button data-cmd="retry">Retry checkpoint</button><button data-cmd="help">Rules & controls</button></div></section>
        ${vote ? `<section>${coalitionPanel(e, vote, state)}<h2>The delegates</h2><div class="delegate-list">${voters.map(u => `<article><div><strong>${esc(u.name)}</strong><span>${esc(u.bloc)} · ${u.stance >= 1 ? 'Supports' : 'Opposes'} (${signed(u.stance)})</span><small>Interest: ${esc(u.interest || 'Listen to the delegate’s position.')} · ${esc(delegateAppealSummary(u, e.politicsVersion))}</small></div><button class="ghost small" data-cmd="inspect-delegate" data-id="${esc(u.id)}" aria-label="Inspect ${esc(u.name)}">Inspect</button></article>`).join('')}</div>${e.staged?.obligations?.length ? `<h3>Promises made in this chamber</h3><ul>${e.staged.obligations.map(o => `<li>${esc(o.to)} · ${Number(o.cost) || 2} supplies, due chapter ${o.due}. ${esc(o.consequence)}</li>`).join('')}</ul>` : ''}</section>` : ''}</div>
      </details>
      <details id="command-intelligence" class="command-intelligence"><summary>${political ? 'Rival intentions & chamber record' : 'Visible threats & field dispatches'}</summary>${fieldIntel(e)}<h2>${political ? 'Chamber record' : 'Field dispatches'}</h2><div class="combat-log" aria-label="Encounter log">${(e.log || []).slice(-14).reverse().map(t => `<p>${esc(t)}</p>`).join('')}</div></details>
    </section>
  </main>`;
}

