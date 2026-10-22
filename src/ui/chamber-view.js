import * as Game from '../core/game.js';
import {CHAPTERS} from '../data/campaign.js';
import {esc,hourly,roman} from './view-helpers.js';
import {coalitionPanel,encounterDebrief,missionBrief} from './tactical-intel.js';
import {commandIntelligence} from './command-edition-views.js';
import {expandedPanel} from './expanded-views.js';
import {precedentPanel} from './encounter-view.js';
import {delegateAppealSummary} from './direct-controls.js';
import {hearingDocuments} from '../core/chamber.js';
import {delegatePortrait} from './delegate-portrait.js';

// The page around a walk-and-talk chamber (build brief §3.11). The chamber itself
// (the scene, the speakers, the speeches, the conversation and the coalition
// strip) is the real-time field's, placed by the page's script into #rt-host
// and kept there between renders. This view renders what the chronicle holds:
// the header, save problems, the motion's reference panels (evidence, the policy
// debate, precedents, the members and the promises made) and, once the vote is
// taken, its result. A member's interest is shown once asked (`known`). Pure
// over the campaign state.

const chapterOf=state=>CHAPTERS.find(c=>c.id===state.chapter);
const signed=n=>`${n>0?'+':''}${n}`;

export function chamberEncounterView({state,saving,lastSaved,saveProblem,saveConflict,known=new Set()}){
  const e=state.encounter,chapter=chapterOf(state),vote=Game.voteCount(state),members=e.units.filter(u=>u.role==='voter');
  return `<main id="main" class="encounter-frame realtime-frame chamber-frame" data-outcome="${esc(e.status)}" data-key="rt-main:${esc(e.id)}">
    <h1 class="visually-hidden">${esc(e.title)} · Chapter ${roman(state.chapter)}${chapter?`, ${esc(chapter.title)}`:''}</h1>
    <div class="rt-chronicle-bar"><span class="eyebrow">Chapter ${roman(state.chapter)} · ${esc(chapter?.year??'')} · The chamber</span>
      <span class="save-status" role="status">${saving?'Saving…':lastSaved?'Saved':''}</span></div>
    ${saveProblem?`<div class="command-save-warning" role="alert"><p>${esc(saveProblem)}</p><div><button data-cmd="export">Export a save code</button>`+
      `${saveConflict?'<button data-cmd="takeover">Continue in this tab</button>':''}</div></div>`:''}
    <div id="rt-host" class="rt-host" data-key="rt-host:${esc(e.id)}"></div>
    ${e.status==='active'?'':chamberResult(state)}
    <section class="chamber-records" aria-label="The motion, the members and the record" data-key="chamber-records:${esc(e.id)}">
      ${e.status==='active'?`${commandIntelligence(state)}${expandedPanel(state)}${e.politicsVersion===2?precedentPanel(state):''}`:''}
      <details id="chamber-members" class="command-mission-record"><summary>Motion, members & obligations</summary>
        ${missionBrief(e)}<p>${esc(e.objective)}</p>${coalitionPanel(e,vote,state)}
        <h2>The members</h2><div class="delegate-list">${members.map(u=>`<article>${delegatePortrait(u,{decorative:true})}<div><strong>${esc(u.name)}</strong>`+
          `<span>${esc(u.bloc)} · ${u.stance>=1?'For':'Against'} (${signed(u.stance)})${e.promises?.includes(u.id)?' · promised':''}</span>`+
          `<small>${known.has(u.id)?`Interest: ${esc(u.interest)} · ${esc(delegateAppealSummary(u,e.politicsVersion))}`:'Interest: talk to him and ask'}</small></div>`+
          `<button class="ghost small" data-cmd="inspect-delegate" data-id="${esc(u.id)}" aria-label="Talk to ${esc(u.name)}" ${e.status==='active'?'':'disabled'}>Talk</button></article>`).join('')}</div>
        ${e.staged?.obligations?.length?`<h3>Promises made in this chamber</h3><ul>${e.staged.obligations.map(o=>`<li>${esc(o.to)} · ${Number(o.cost)||2} supplies, due chapter ${o.due}. ${esc(o.consequence)}</li>`).join('')}</ul>`:''}
      </details>
    </section>
  </main>`;
}

// The vote and what follows it: Record the result, or Retry and, once, a patron's backing (guide "Defeat and recovery").
export function chamberResult(state){
  const e=state.encounter,won=e.status==='won',v=Game.voteCount(state),debrief=encounterDebrief(e);
  const speakers=e.units.filter(u=>['player','ally'].includes(u.side)&&u.role==='speaker'),obligations=e.staged?.obligations??[],agreements=e.staged?.agreements??[];
  const rows=[['The vote',`${v.for} for, ${v.against} against; ${v.majority} needed`],['Hours',`${e.turn} of ${e.turnLimit}`],
    ['Your speakers',speakers.map(u=>`${u.name}: ${u.resolve>0?`${u.resolve} of ${u.maxResolve} Resolve`:'withdrawn'}`).join(' · ')],
    ['Promises made',obligations.length?obligations.map(o=>`${o.to}: ${Number(o.cost)||2} supplies, due Chapter ${roman(o.due)}`).join(' · '):'none']];
  if(agreements.length)rows.push(['Agreements',agreements.map(a=>`${a.personName}: ${a.cost} supplies, due Chapter ${roman(a.due)}`).join(' · ')]);
  return `<section class="result command-result rt-result chamber-result ${won?'result-won':'result-lost'}" role="status" aria-labelledby="chamber-result-title">
    <span class="eyebrow">${won?'THE DIVISION · THE MOTION CARRIES':'THE DIVISION · A CHANCE TO REGROUP'}</span>
    <h2 id="chamber-result-title">${won?'The motion carries.':'The motion is defeated.'}</h2>
    <p>${esc(hourly(e.log?.at(-1)??''))}</p>
    <dl class="result-record">${rows.map(([dt,dd])=>`<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join('')}</dl>
    ${debrief.distinguished?`<p class="debrief-citation"><strong>Distinguished service:</strong> ${esc(debrief.distinguished.citation)}</p>`:''}
    ${!won&&debrief.diagnostic?`<p class="defeat-diagnostic"><strong>What went wrong:</strong> ${esc(debrief.diagnostic)}</p>`:''}
    <p class="result-save-note">${won?'Record the result to keep the rewards, promises and consequences.':'Retry restores the chamber exactly as it began, supplies and promises included.'}</p>
    <div class="panel-actions">${won?'<button class="primary" data-cmd="commit">Record the result →</button>':'<button class="primary" data-cmd="retry">Retry the checkpoint</button>'}</div>
    ${!won&&!e.fallback?'<p>A patron can fund another vote: two supplies now, a five-supply debt at accession. The vote must still be won.</p><div class="panel-actions"><button data-cmd="fallback">Accept backing and re-run the vote</button></div>':''}
  </section>`;
}

// A document inspected from the pack or the tribunal (free): every member's exact change, and
// Present evidence when the soldier's speech is unspent (guide "Hearings and evidence").
export function documentPreview(state,id){
  const d=hearingDocuments(state).find(x=>x.id===id);if(!d)return '<p>This document is not in your keeping for this hearing.</p>';
  return `<p class="panel-lead">${esc(d.description)}</p><p>${esc(d.interest)} interests gain 2 stance; ${esc(d.opposition)} interests lose 1, before commitment resists.</p>`+
    `${d.changes.length?`<table class="case-preview-table"><caption>Each member’s exact change</caption><thead><tr><th>Member</th><th>Now</th><th>After</th></tr></thead><tbody>`+
      d.changes.map(c=>`<tr><th scope="row">${esc(c.name)}</th><td>${signed(c.from)}</td><td>${signed(c.to)}</td></tr>`).join('')+'</tbody></table>':'<p>It moves no member now.</p>'}`+
    `<p>${d.ok?'Presenting it spends your soldier’s speech, once a hearing.':esc(d.reason??d.message)}</p>`+
    `<div class="panel-actions"><button class="primary" data-cmd="present-case" data-id="${esc(id)}" ${d.ok?'':'disabled'}>Present evidence · one speech</button>`+
    `<button data-cmd="close-modal">Keep deliberating</button></div>`;
}
