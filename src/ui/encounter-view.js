import * as Game from '../core/game.js';
import {esc, roman, actionNames, actionSymbols} from './view-helpers.js';
import {missionBrief,coalitionPanel,fieldIntel,selectedGround,resultRecord,terrainLabel} from './tactical-intel.js';
import {politicalPosition} from '../core/contest.js';
import {FORMATION_RULES} from '../data/battle-balance.js';

export function selectedActor(state, selected) {
  const units=state.encounter?.units||[];
  const available=units.filter(u=>['player','ally'].includes(u.side)&&(u.resolve??u.hp)>0);
  return available.find(u=>u.id===selected)||available.find(u=>u.id==='hero')||available[0]||units.find(u=>u.id==='hero');
}

export function selectedCommand({selected, action, target, formation, orderAction}) {
  if (!action || !target) return null;
  return {unitId:selected, action, x:target.x, y:target.y, ...(target.unitId ? {targetId:target.unitId} : {}), formation, orderAction};
}

export function targetName(state, target) {
  const unit = state.encounter.units.find(u => u.id === target.unitId);
  return `${unit?.name || target.label || terrainLabel(state.encounter,target)} · ${target.x + 1}${String.fromCharCode(65 + target.y)}${target.cost!==undefined?` · ${target.cost} movement`:''}${unit?.stance !== undefined ? ` · stance ${unit.stance}` : ''}${unit?.interest ? ` · ${unit.interest}` : ''}`;
}

function instruction(state, action, target, actor) {
  const e = state.encounter;
  if (e.status !== 'active') return 'Review the outcome below.';
  if (action && !Game.getTargets(state,actor.id,action).length) return actor.moved ? 'No target in reach. Choose another action, or end the turn to move again.' : 'No target in reach. Choose Move to get closer, or another action.';
  if (action && !target) return `Choose a highlighted target for ${actionNames[action]}.`;
  if (target) return 'Review the effect and cost, then confirm.';
  if (actor.acted) return actor.moved ? 'This unit has finished. End the turn when ready.' : 'Action spent. Move to a better position, or end the turn.';
  if (e.type === 'training') {
    const next = ['move', 'throw', 'strike', 'brace'].find(a => !e.usedAbilities.includes(a));
    return next ? `Varro’s next lesson: ${actionNames[next]}. Choose it below; Move brings you into range.` : 'The drill is complete. End your turn to hear Varro’s assessment.';
  }
  return e.kind === 'contest' ? 'Inspect a delegate’s interests; compare an appeal with a concrete promise.' : 'Select an action. The board and preview show its legal reach and effect.';
}

function outcome(e) {
  if (e.status === 'active') return '';
  const won = e.status === 'won';
  return `<section class="result ${won ? 'result-won' : 'result-lost'}" role="status">
    <div class="eyebrow gold">${won ? 'OBJECTIVE ACHIEVED' : 'A CHANCE TO REGROUP'}</div>
    <h2>${won ? (e.kind === 'contest' ? 'The motion carries.' : 'The day is yours.') : (e.kind === 'contest' ? 'The motion is defeated.' : 'The field is lost.')}</h2>
    <p>${esc(e.log?.at(-1) || '')}</p>
    ${resultRecord(e)}
    ${won ? '<button data-cmd="commit">Record the result →</button>' : '<button data-cmd="retry">Retry the complete checkpoint</button>'}
    ${!won && e.kind === 'contest' && !e.fallback ? '<p>A patron can fund another vote: two supplies now, a five-supply debt at accession. The vote must still be won.</p><button data-cmd="fallback">Accept backing and re-run the vote</button>' : ''}
  </section>`;
}

export function encounterView(context) {
  const {state, selected, action, target, formation, orderAction, feedback = '', header, footer, requirements} = context;
  const e = state.encounter, actor = selectedActor(state, selected);
  const actions = Game.getActions(state, actor.id);
  const targets = action ? Game.getTargets(state, actor.id, action) : [];
  const command = selectedCommand(context), preview = command ? Game.preview(state, command) : null;
  const voters = e.units.filter(u => u.role === 'voter');
  const vote = Game.voteCount(state);
  const units = e.units.filter(u => ['player', 'ally'].includes(u.side) && (u.resolve ?? u.hp) > 0);
  const selectOptions = targets.map((t, i) => `<option value="${i}" ${target && t.x === target.x && t.y === target.y && t.unitId === target.unitId ? 'selected' : ''}>${esc(targetName(state, t))}</option>`).join('');
  const progress = typeof e.objectiveProgress === 'string' ? e.objectiveProgress : '';
  return `${header()}<main id="main" class="frame encounter-frame">
    <div class="encounter-heading"><span>CHAPTER ${roman(state.chapter)} · ${esc(Game.getChapter(state).title)}</span><button class="ghost small" data-cmd="journal">Orders & chronicle</button></div>
    ${missionBrief(e)}
    <div class="tactical-shell">
      <section class="battle-main" aria-label="${e.kind === 'contest' ? 'Political chamber' : 'Battlefield'}">
        <div class="battle-topline"><strong>${esc(e.title)}</strong><span class="turn-counter">TURN ${e.turn}/${e.turnLimit}</span></div>
        <div class="tactical-status" role="status">${vote ? `<strong>${vote.for}/${vote.total} support</strong><span>${vote.majority} needed · vote in ${Math.max(0,e.turnLimit-e.turn+1)} turns</span>` : `<strong>${e.commandCapacity ? `${e.commandsLeft}/${e.commandCapacity} orders` : 'One move · one action'}</strong><span>${esc(progress || (typeof e.pressure === 'string' ? e.pressure : 'Protect your commander'))}</span>`}</div>
        <div class="battle-stage"><canvas id="battle-board" tabindex="0" role="application" aria-label="${e.kind === 'contest' ? 'Political chamber' : 'Battlefield'} grid. Arrow keys move the cursor; Enter selects a unit or target. Named unit and target selectors provide the same controls."></canvas><div id="turn-replay" class="turn-replay" hidden role="status"></div></div>
        <div class="selected-unit-row"><label for="unit-select">${e.kind === 'contest' ? 'Speaker' : 'Unit'}</label><select id="unit-select" aria-label="Choose your unit">${units.map(u => `<option value="${esc(u.id)}" ${actor.id === u.id ? 'selected' : ''}>${u.id === 'hero' ? '★ ' : ''}${esc(u.name)} · ${u.resolve ?? u.hp}/${u.maxResolve ?? u.maxHp}</option>`).join('')}</select><span class="readiness">${actor.moved ? 'Move spent' : 'Move ready'} · ${actor.acted ? 'Action spent' : 'Action ready'}</span></div>
        ${vote?`${coalitionPanel(e,vote)}${e.politicsVersion===2?`<p class="ground-readout">${esc(politicalPosition(state,actor.id).message)}</p>`:''}`:selectedGround(e,actor,target)}
      </section>
      <section class="battle-actions" aria-label="Action and target controls">
        <div class="desktop-actor"><div class="eyebrow">${e.kind === 'contest' ? 'YOUR SPEAKER' : 'YOUR SELECTED UNIT'}</div><h2>${esc(actor.name)}</h2><p>${e.kind === 'contest' ? 'Resolve' : 'Health'} ${actor.resolve ?? actor.hp}/${actor.maxResolve ?? actor.maxHp} · ${actor.x+1}${String.fromCharCode(65+actor.y)} · facing ${esc(actor.facing || 'east')}</p></div>
        <div class="action-controls" ${e.status!=='active'?'hidden':''}><p class="coach-hint" id="action-guide">${esc(instruction(state, action, target, actor))}</p>
        <label class="mobile-action-label" for="action-select">Action</label>
        <select id="action-select" class="mobile-action-select" aria-describedby="action-guide"><option value="">Choose an action…</option>${actions.map(a => `<option value="${a}" ${action === a ? 'selected' : ''}>${esc(actionNames[a])}</option>`).join('')}</select>
        <div class="action-grid" aria-label="Available actions">${actions.map(a => `<button id="action-${a}" class="${action === a ? 'active' : ''}" data-cmd="action" data-id="${a}" aria-pressed="${action === a}"><span aria-hidden="true">${actionSymbols[a]}</span>${esc(actionNames[a])}</button>`).join('')}</div>
        ${!actions.length ? '<p class="briefing">This unit has finished. Select another unit or end the turn.</p>' : ''}
        ${action === 'formation' ? `<label for="formation-kind">Formation</label><select id="formation-kind">${[['shield-wall','Shield wall · protection, move 1'],['line',e.combatVersion===2?'Line · movement, morale and screen':'Line · movement and morale'],['wedge',e.combatVersion===2?'Wedge · attack on firm ground, exposed':'Wedge · +1 attack, +1 damage taken']].map(([value, label]) => `<option value="${value}" ${formation === value ? 'selected' : ''}>${label}</option>`).join('')}</select>${e.combatVersion===2?`<p class="formation-summary">${esc(FORMATION_RULES[formation||'shield-wall']?.summary||'')}</p>`:''}` : ''}
        ${['order','formation'].includes(action) ? `<label for="order-kind">Order</label><select id="order-kind">${[['advance','Advance toward objective'],['attack',e.combatVersion===2?'Attack the strongest opportunity':'Attack nearest enemy'],['hold','Hold and brace'],['rally','Restore morale'],...(e.combatVersion===2?[['withdraw','Withdraw toward the commander']]:[])].map(([value, label]) => `<option value="${value}" ${orderAction === value ? 'selected' : ''}>${label}</option>`).join('')}</select>` : ''}
        <div class="target-panel"><label for="target-select">${action ? 'Target' : 'Choose an action to see targets'}</label><select id="target-select" ${!targets.length ? 'disabled' : ''}><option value="">${targets.length ? 'Choose a target…' : 'No legal targets'}</option>${selectOptions}</select>
        ${preview?.forecast?`<div class="forecast-summary"><strong>Support ${preview.forecast.votesBefore} → ${preview.forecast.votesAfter}</strong><span>1 speech${preview.forecast.publicCost?` · −${preview.forecast.publicCost} Public`:""}${preview.forecast.promise?` · debt: ${preview.forecast.promise.cost} supplies`:""}</span></div>`:""}<div class="preview" id="action-preview" role="status">${esc(preview?.message || (actor.intent ? `Intent: ${actor.intent}` : 'Select a target on the board or in the list.'))}</div>
        <div class="commit-row"><button id="confirm-action" class="primary" data-cmd="confirm" ${!preview?.ok ? 'disabled' : ''}>Confirm ${esc(actionNames[action] || 'action')}</button><button id="end-turn" data-cmd="end-turn" ${e.status !== 'active' ? 'disabled' : ''}>End turn →</button></div></div>
        <p id="action-feedback" class="action-feedback" role="status" ${feedback ? '' : 'hidden'}>${esc(feedback)}</p>
        </div>${outcome(e)}
      </section>
    </div>
    ${fieldIntel(e)}
    <section class="encounter-details"><details ${e.kind==='contest'||e.status !== 'active' ? 'open' : ''}><summary>Mission, delegates & field dispatches</summary>
      <div class="encounter-detail-grid"><section><h3>Your objective</h3><p>${esc(e.objective)}</p>${e.issue ? `<p><strong>Before the chamber:</strong> ${esc(e.issue)}</p>` : ''}${requirements()}${e.mission?.points?.length?`<p>Objectives: ${e.mission.points.map(point=>`${point.x+1}${String.fromCharCode(65+point.y)}${point.secured?' ✓':''}`).join(' · ')}</p>`:''}${e.pressure?`<p>${esc(e.pressure)}</p>`:''}
      <p class="terrain-legend">★ Commander · ◆ Allies · ▼ Rivals · ⚑ Objective<br>Outlined tiles are legal targets. Base arrows show facing; arcs show bracing. Formation bases show a line, wedge or battlement; ! marks low morale. Double vote rims show commitment; wax seals mark promises.</p><button data-cmd="retry">Retry checkpoint</button> <button data-cmd="help">Rules & controls</button></section>
      ${vote ? `<section><h3>The people whose votes matter</h3><p>The deadline vote decides. Withdrawn speakers keep their votes.</p><div class="delegate-list">${voters.map(u => `<article><strong>${esc(u.name)}</strong><span>${esc(u.bloc)} · ${u.stance >= 1 ? 'Supports' : 'Opposes'} (${u.stance})</span><small>${esc(u.interest || 'Listen to the delegate’s position before choosing an appeal.')}</small></article>`).join('')}</div></section>` : ''}
      <section><h3>Field dispatches</h3><div class="combat-log" aria-label="Encounter log">${(e.log || []).slice(-14).reverse().map(t => `<p>${esc(t)}</p>`).join('')}</div></section></div>
    </details></section>
  </main>${footer()}`;
}
