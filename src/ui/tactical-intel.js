import {alive} from '../core/shared.js';
import {MISSION_GUIDANCE} from '../data/campaign-guidance.js';
import {esc} from './view-helpers.js';

const tile=u=>`${u.x+1}${String.fromCharCode(65+u.y)}`;
const terrainNames={grass:'Open ground',sand:'Open sand',marsh:'Marsh',ford:'River ford',high:'High ground',wall:'Defensive wall',road:'Road',stone:'Stone ground',chamber:'Chamber floor',river:'Deep water',rock:'Rock'};
export function terrainLabel(e,point){return terrainNames[e.terrain?.[point.y]?.[point.x]]||'Ground';}

export function missionBrief(e){
  const guide=e.kind==='contest'?['Build a majority that will last',e.issue||'Persuade the chamber before the deadline.']:MISSION_GUIDANCE[e.mission?.mode]||['Follow your orders',e.objective];
  return `<section class="mission-brief" aria-label="Current tactical objective"><div><span class="eyebrow">${e.kind==='contest'?'BEFORE THE CHAMBER':'YOUR ORDERS'}</span><strong>${esc(guide[0])}</strong></div><p>${esc(guide[1])}</p>${e.kind==='battle'&&e.pressure?`<span class="pressure-note">${esc(e.pressure)}</span>`:''}</section>`;
}

export function coalitionPanel(e,vote){
  if(!vote)return '';
  const voters=e.units.filter(u=>u.role==='voter'),blocs=[...new Set(voters.map(u=>u.bloc))];
  const pledged=voters.filter(u=>u.stance>=3).length,wavering=voters.filter(u=>u.stance>=1&&u.stance<3).length;
  return `<section class="coalition-panel" aria-label="Coalition and voting deadline"><div class="coalition-heading"><strong>${vote.for>=vote.majority?'Majority secured for now':'Build your coalition'}</strong><span>${Math.max(0,vote.majority-vote.for)} more ${vote.majority-vote.for===1?'vote':'votes'} needed</span></div><div class="vote-track" role="img" aria-label="${vote.for} supporting votes of ${vote.total}; ${vote.majority} needed">${e.units.filter(u=>u.role==='voter'||u.vote).map(u=>{const support=u.vote==='for'||u.role==='voter'&&u.stance>=1;return `<span class="vote-seat ${u.stance>=3||u.vote==='for'?'committed':support?'support':'opposed'}" title="${esc(u.name)}: ${support?'supports':'opposes'}${u.role==='voter'?`, stance ${u.stance}`:', speaker vote'}">${support?'✓':'−'}</span>`;}).join('')}</div><p>${pledged} delegates committed · ${wavering} wavering · ${Math.max(0,2-(e.promises?.length||0))} promises left</p><div class="bloc-summary">${blocs.map(bloc=>{const members=voters.filter(u=>u.bloc===bloc);return `<span><strong>${esc(bloc)}</strong> ${members.filter(u=>u.stance>=1).length}/${members.length}</span>`;}).join('')}</div><small>Counted at the deadline (end of turn ${e.turnLimit}); an early majority does not end the debate. A withdrawn speaker keeps their vote (at 0 Resolve they stop speaking). Commitments at ±3 resist reversal.</small></section>`;
}

export function fieldIntel(e){
  const visible=e.units.filter(u=>!u.hidden&&alive(u)&&u.id!=='hero'&&u.role!=='voter'),friends=visible.filter(u=>u.side!=='enemy'),enemies=visible.filter(u=>u.side==='enemy');
  const row=u=>`<li><span class="intel-unit"><strong>${esc(u.name)}</strong><span>${tile(u)} · ${u.resolve!==undefined?`${u.resolve} Resolve`:`${u.hp} health · ${u.morale??80} morale`}</span></span><p>${esc(u.intent||'Hold position and respond to the field.')}</p>${u.ordered?'<small>Order spent this turn</small>':''}</li>`;
  const hero=e.units.find(u=>u.id==='hero'),nearest=[...enemies].sort((a,b)=>(Math.abs(a.x-hero.x)+Math.abs(a.y-hero.y))-(Math.abs(b.x-hero.x)+Math.abs(b.y-hero.y)))[0];
  return `${nearest&&e.status==='active'?`<aside class="next-threat" aria-label="Nearest visible opponent’s intention"><strong>${esc(nearest.name)} · ${tile(nearest)}<small>Next reply if the position holds</small></strong><span>${esc(nearest.intent||'Responding to your position.')}</span></aside>`:''}<details class="field-intel"><summary>${e.kind==='contest'?'Speakers & rival intentions':'Allied plans & visible threats'} <span>${friends.length} friendly · ${enemies.length} rival</span></summary><p class="intel-note">Plans respond to the visible position and may change as units act. Hidden enemies are not listed.</p><div class="intel-columns">${[[e.kind==='contest'?'Your speakers':'Your company',friends],[e.kind==='contest'?'Opposition':'Visible opposition',enemies]].map(([title,units])=>`<section><h3>${title}</h3><ul>${units.map(row).join('')||'<li>No active units.</li>'}</ul></section>`).join('')}</div></details>`;
}

export function selectedGround(e,actor,target){
  const location=target||actor,terrain=e.terrain?.[location.y]?.[location.x];
  const facts={marsh:'Costs 2 movement per tile; line formation crosses at normal cost.',river:'Impassable. Use a ford.',rock:'Impassable; blocks shots.',wall:'Provides cover and blocks shots through the tile.',high:'Offers defensive cover.',ford:'Passable crossing; watch the narrow approach.'};
  return `<p class="ground-readout"><strong>${target?'Target':'Standing on'}: ${esc(terrainLabel(e,location))}</strong> · ${tile(location)}${facts[terrain]?`<span>${facts[terrain]}</span>`:''}</p>`;
}

export function resultRecord(e){
  const friends=e.units.filter(u=>['player','ally'].includes(u.side)),withdrawn=friends.filter(u=>!alive(u)).length;
  return `<dl class="result-record"><div><dt>Resolved on turn</dt><dd>${e.turn} / ${e.turnLimit}</dd></div><div><dt>${e.kind==='contest'?'Speakers withdrawn':'Allied units withdrawn'}</dt><dd>${withdrawn}</dd></div><div><dt>Promises made</dt><dd>${e.staged?.obligations?.length||0}</dd></div></dl>${e.staged?.obligations?.length?`<p class="result-debts">${e.staged.obligations.map(o=>`${esc(o.to)}: ${Number(o.cost)||2} supplies, due chapter ${o.due}`).join(' · ')}</p>`:''}<p class="result-save-note">${e.status==='won'?'Record the result to keep the rewards and consequences.':'Retry restores the encounter checkpoint, including supplies, promises and the random seed.'}</p>`;
}
