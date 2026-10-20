import {alive} from '../core/shared.js';
import {coalitionWhipForecast} from '../core/contest.js';
import {MISSION_GUIDANCE} from '../data/campaign-guidance.js';
import {esc,actionNames} from './view-helpers.js';

const tile=u=>`${u.x+1}${String.fromCharCode(65+u.y)}`;
const terrainNames={grass:'Open ground',sand:'Open sand',marsh:'Marsh',ford:'River ford',high:'High ground',wall:'Defensive wall',road:'Road',stone:'Stone ground',chamber:'Chamber floor',river:'Deep water',rock:'Rock'};
export function terrainLabel(e,point){return terrainNames[e.terrain?.[point.y]?.[point.x]]||'Ground';}

export function missionBrief(e){
  const guide=e.kind==='contest'?['Build a majority that will last',e.issue||'Persuade the chamber before the deadline.']:MISSION_GUIDANCE[e.mission?.mode]||['Follow your orders',e.objective];
  return `<section class="mission-brief" aria-label="Current tactical objective"><div><span class="eyebrow">${e.kind==='contest'?'BEFORE THE CHAMBER':'YOUR ORDERS'}</span><strong>${esc(guide[0])}</strong></div><p>${esc(guide[1])}</p>${e.kind==='battle'&&e.pressure?`<span class="pressure-note">${esc(e.pressure)}</span>`:''}</section>`;
}

export function coalitionPanel(e,vote,state=null){
  if(!vote)return '';
  const voters=e.units.filter(u=>u.role==='voter'),blocs=[...new Set(voters.map(u=>u.bloc))];
  const pledged=voters.filter(u=>u.stance>=3).length,wavering=voters.filter(u=>u.stance>=1&&u.stance<3).length;
  const whip=coalitionWhipForecast(state??e),atRiskIds=new Set((whip?.atRisk??[]).map(r=>r.id));
  const whipHtml=whip?`<div class="whip-forecast" aria-label="Chamber whip forecast"><span class="whip-chip ${whip.atRisk.length?'is-warning':'is-safe'}">${whip.atRisk.length?`At risk next reply: ${whip.atRisk.map(r=>`<button type="button" class="whip-link" data-cmd="inspect-delegate" data-id="${esc(r.id)}">${esc(r.name)} (${r.stanceBefore}→${r.stanceAfter})</button>`).join(', ')}`:'Current support secure this round'}</span><span class="whip-chip">${whip.oneSpeechFlips.length?`1-speech flips: ${whip.oneSpeechFlips.slice(0,3).map(f=>`<button type="button" class="whip-link" data-cmd="inspect-delegate" data-id="${esc(f.id)}">${esc(f.name)} via ${esc(actionNames[f.action]||f.action)}${f.requiresMove?' (move)':''}</button>`).join(' · ')}`:'No single-speech flips in reach'}</span></div>`:'';
  return `<section class="coalition-panel" aria-label="Coalition and voting deadline"><div class="coalition-heading"><strong>${vote.for>=vote.majority?'Majority secured for now':'Build your coalition'}</strong><span>${Math.max(0,vote.majority-vote.for)} more ${vote.majority-vote.for===1?'vote':'votes'} needed</span></div><div class="vote-track" role="group" aria-label="${vote.for} supporting votes of ${vote.total}; ${vote.majority} needed">${e.units.filter(u=>u.role==='voter'||u.vote).map(u=>{const support=u.vote==='for'||u.role==='voter'&&u.stance>=1,cls=`vote-seat ${u.stance>=3||u.vote==='for'?'committed':support?'support':'opposed'}${atRiskIds.has(u.id)?' at-risk':''}`,tip=`${esc(u.name)} (${tile(u)}): ${support?'supports':'opposes'}${u.role==='voter'?`, stance ${u.stance} · ${esc(u.bloc)}, ${esc(u.interest)}`:', speaker vote'}${atRiskIds.has(u.id)?' · At risk from rival lobby':''}`;return u.role==='voter'?`<button type="button" class="${cls}" data-cmd="inspect-delegate" data-id="${esc(u.id)}" aria-label="Inspect ${tip}" title="${tip}">${support?'✓':'−'}</button>`:`<span class="${cls}" title="${tip}">${support?'✓':'−'}</span>`;}).join('')}</div><p>${pledged} delegates committed · ${wavering} wavering · ${Math.max(0,2-(e.promises?.length||0))} promises left</p>${whipHtml}<div class="bloc-summary">${blocs.map(bloc=>{const members=voters.filter(u=>u.bloc===bloc);return `<span><strong>${esc(bloc)}</strong> ${members.filter(u=>u.stance>=1).length}/${members.length}</span>`;}).join('')}</div><small>Counted at the deadline (end of turn ${e.turnLimit}); an early majority does not end the debate. A withdrawn speaker keeps their vote (at 0 Resolve they stop speaking). Commitments at ±3 resist reversal.</small></section>`;
}

export function fieldIntel(e){
  const visible=e.units.filter(u=>!u.hidden&&alive(u)&&u.id!=='hero'&&u.role!=='voter'),friends=visible.filter(u=>u.side!=='enemy'),enemies=visible.filter(u=>u.side==='enemy');
  const row=u=>`<li><span class="intel-unit"><strong>${esc(u.name)}</strong><span>${tile(u)} · ${u.resolve!==undefined?`${u.resolve} Resolve`:`${u.hp} health · ${u.morale??80} morale`}</span></span><p>${esc(u.intent||'Hold position and respond to the field.')}</p>${e.featureEdition===31&&e.kind==='battle'?`<small>Cohesion ${u.cohesion??80}/100 · suppression ${u.suppression??0}/3</small>`:''}${u.ordered?'<small>Order spent this turn</small>':''}</li>`;
  const hero=e.units.find(u=>u.id==='hero'),nearest=[...enemies].sort((a,b)=>(Math.abs(a.x-hero.x)+Math.abs(a.y-hero.y))-(Math.abs(b.x-hero.x)+Math.abs(b.y-hero.y)))[0];
  return `${nearest&&e.status==='active'?`<aside class="next-threat" aria-label="Nearest visible opponent’s intention"><strong>${esc(nearest.name)} · ${tile(nearest)}<small>Next reply if the position holds</small></strong><span>${esc(nearest.intent||'Responding to your position.')}</span></aside>`:''}<details class="field-intel"><summary>${e.kind==='contest'?'Speakers & rival intentions':'Allied plans & visible threats'} <span>${friends.length} friendly · ${enemies.length} rival</span></summary><p class="intel-note">Plans respond to the visible position and may change as units act. Hidden enemies are not listed.</p><div class="intel-columns">${[[e.kind==='contest'?'Your speakers':'Your company',friends],[e.kind==='contest'?'Opposition':'Visible opposition',enemies]].map(([title,units])=>`<section><h3>${title}</h3><ul>${units.map(row).join('')||'<li>No active units.</li>'}</ul></section>`).join('')}</div></details>`;
}

export function selectedGround(e,actor,target){
  const location=target||actor,terrain=e.terrain?.[location.y]?.[location.x];
  const facts={marsh:'Costs 2 movement per tile; line formation crosses at normal cost.',river:'Impassable. Use a ford.',rock:'Impassable; blocks shots.',wall:'Provides cover and blocks shots through the tile.',high:'Offers defensive cover.',ford:'Passable crossing; watch the narrow approach.'};
  return `<p class="ground-readout"><strong>${target?'Target':'Standing on'}: ${esc(terrainLabel(e,location))}</strong> · ${tile(location)}${facts[terrain]?`<span>${facts[terrain]}</span>`:''}</p>`;
}

export function encounterDebrief(e){
  if(!e)return {distinguished:null,turningPoints:[],diagnostic:null};
  const log=e.log||[],friends=(e.units||[]).filter(u=>['player','ally'].includes(u.side));
  let bestUnit=null,bestScore=-1;
  for(const u of friends){
    const mentions=log.filter(line=>u.name&&(line.startsWith(u.name+' ')||line.includes(u.name))).length;
    const score=mentions*3+(alive(u)?4:0)+(u.id==='hero'?1:2);
    if(score>bestScore){bestScore=score;bestUnit=u;}
  }
  const distinguished=bestUnit?{
    id:bestUnit.id,
    name:bestUnit.name,
    role:bestUnit.role,
    survived:alive(bestUnit),
    citation:e.kind==='contest'
      ?`${bestUnit.name} anchored the floor debate (${bestUnit.resolve??0}/${bestUnit.maxResolve??10} Resolve remaining).`
      :`${bestUnit.name} ${alive(bestUnit)?`stood through the engagement (${bestUnit.hp}/${bestUnit.maxHp} HP, ${bestUnit.morale??80} morale)`:'held the line before withdrawing under pressure'}.`,
  }:null;
  const notable=log.filter(line=>!/^Turn \d+\b/.test(line)&&!/^Troop condition:/.test(line)&&line!==e.objective&&/withdrawn|secured|oath|Support \d+|strikes|hits|challenges|attacks|regroups|Reinforcements|falls|breaks|Deadline|Invoke|Cite|Table|Assert|Palings|Rampart|Brazier/i.test(line));
  const turningPoints=(notable.length?notable:log.filter(l=>l!==e.objective)).slice(-3);
  let diagnostic=null;
  if(e.status==='lost'){
    const lastLog=log.at(-1)||'',hero=e.units?.find(u=>u.id==='hero');
    if(e.kind==='battle'){
      if(hero&&!alive(hero))diagnostic='The commander was overwhelmed. Keep your commander screened behind a braced comrade or Shield Wall, and use Assist or Rally before health drops critical.';
      else if(e.mission?.escortIds?.some(id=>!alive(e.units.find(u=>u.id===id))))diagnostic='A protected escort column was lost. Keep a friendly unit adjacent to the convoy for −1 escort screen protection and intercept raiders first.';
      else if((e.defence??100)<=0)diagnostic='The defended line or stores collapsed under pressure. Keep at least one friendly unit within 1 tile of the objective marker to prevent unopposed occupation.';
      else if(/demonstrate/i.test(lastLog))diagnostic='A required chapter capability was not demonstrated before the deadline. Trigger the chapter’s required command early in the engagement.';
      else diagnostic='The turn deadline expired before the objective was secured. Use Line formation to cross marsh at normal cost, or issue Advance orders to press the objective earlier.';
    }else{
      if(/capability was not demonstrated/i.test(lastLog))diagnostic='The motion lacked a required chapter capability. Demonstrate the chapter’s new political action before the final turn.';
      else diagnostic='Opposition lobbying eroded wavering delegates before the final tally. Push key supporters to +3 committed stance so they resist reversal, or use Rebut/Denounce to blunt rival speakers.';
    }
  }
  return {distinguished,turningPoints,diagnostic};
}

export function resultRecord(e){
  const friends=e.units.filter(u=>['player','ally'].includes(u.side)),withdrawn=friends.filter(u=>!alive(u)).length;
  const debrief=encounterDebrief(e);
  const debriefHtml=`<div class="encounter-debrief" aria-label="After-action chronicle">${debrief.distinguished?`<p class="debrief-citation"><strong>Distinguished service:</strong> ${esc(debrief.distinguished.citation)}</p>`:''}${debrief.turningPoints.length?`<ul class="debrief-turning-points">${debrief.turningPoints.map(tp=>`<li>${esc(tp)}</li>`).join('')}</ul>`:''}${debrief.diagnostic?`<p class="defeat-diagnostic"><strong>Tactical diagnostic:</strong> ${esc(debrief.diagnostic)}</p>`:''}</div>`;
  return `<dl class="result-record"><div><dt>Resolved on turn</dt><dd>${e.turn} / ${e.turnLimit}</dd></div><div><dt>${e.kind==='contest'?'Speakers withdrawn':'Allied units withdrawn'}</dt><dd>${withdrawn}</dd></div><div><dt>Promises made</dt><dd>${e.staged?.obligations?.length||0}</dd></div></dl>${debriefHtml}${e.staged?.obligations?.length?`<p class="result-debts">${e.staged.obligations.map(o=>`${esc(o.to)}: ${Number(o.cost)||2} supplies, due chapter ${o.due}`).join(' · ')}</p>`:''}<p class="result-save-note">${e.status==='won'?'Record the result to keep the rewards and consequences.':'Retry restores the encounter checkpoint, including supplies, promises and the random seed.'}</p>`;
}

