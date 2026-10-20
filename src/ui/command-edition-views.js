import * as Game from '../core/game.js';
import {esc} from './view-helpers.js';

export function approachPlanning(state){
  const v=Game.fieldApproachView(state);
  if(!v.edition)return `<div class="approach-planning"><h4>How will you take the field?</h4><p>Add engineering, diversion and defensive approaches from this checkpoint.</p><button data-cmd="approach-upgrade">Enable field approaches</button></div>`;
  if(!v.enabled)return '';
  return `<div class="approach-planning"><h4>How will you take the field?</h4><p>Choose your approach as well as your preparations. All supply costs are paid together at departure. Retry restores them. Both apply to the next field battle only.</p><div class="deployment-options">${v.options.map(p=>`<article class="deployment-card ${v.selected===p.id?'is-selected':''}"><h4>${esc(p.label)} · ${p.cost} supplies</h4><p>${esc(p.description)}</p><button data-cmd="field-approach" data-id="${p.id}" aria-pressed="${v.selected===p.id}" ${p.available?'':'disabled'}>${v.selected===p.id?'Selected':`Choose ${esc(p.label)}`}</button>${p.reason?`<small>${esc(p.reason)}</small>`:''}</article>`).join('')}</div></div>`;
}
export function deploymentPlanning(state){
  if(state.campaignEdition!==34)return `<section class="progression-panel command-upgrade"><h3>A deeper command</h3><p>Add operational preparations, coordinated enemy doctrines and documented political cases from this camp. Your earlier service remains part of the chronicle.</p><button data-cmd="command-upgrade">Enable command campaign</button></section>`;
  const view=Game.operationalPlan(state),brief=Game.commandBriefing(state);
  return `<section class="progression-panel deployment-planning" aria-labelledby="deployment-title"><p class="eyebrow">THE COMMANDER’S TABLE</p><h3 id="deployment-title">${esc(brief.title)}</h3><p>${esc(brief.purpose)}</p>${brief.witness?`<p class="command-witness"><strong>${esc(brief.witness.name)}</strong> · ${esc(brief.witness.description)}</p>`:''}${view.enabled?`<p>${esc(view.description)}</p><div class="deployment-options">${view.options.map(o=>`<article class="deployment-card ${view.selected===o.id?'is-selected':''}"><h4>${esc(o.label)} <span>${o.cost?`${o.cost} supplies`:'No supply cost'}</span></h4><p>${esc(o.description)}</p><button data-cmd="operational-plan" data-id="${esc(o.id)}" aria-pressed="${view.selected===o.id}" ${o.available?'':'disabled'}>${view.selected===o.id?'Selected':`Choose ${esc(o.label)}`}</button>${o.reason?`<small>${esc(o.reason)}</small>`:''}</article>`).join('')}</div>`:'<p class="muted">Operational preparations open before field encounters from Chapter III. In the chamber, earlier service may provide a documented case.</p>'}${approachPlanning(state)}</section>`;
}

export function commandIntelligence(state){
  const brief=Game.commandBriefing(state);if(!brief.enabled||state.encounter?.type==='training')return '';
  const political=state.encounter?.kind==='contest',cases=Game.caseOptions(state);
  return `<details id="command-doctrine" class="command-intelligence"><summary>${political?'Evidence & interests':'Enemy plan & field opportunities'} <span>${esc(brief.title)}</span></summary><div class="command-intelligence-body"><p>${esc(brief.purpose)}</p>${brief.approach&&brief.approach.id!=='balanced'?`<p><strong>${esc(brief.approach.label)}</strong> · ${esc(brief.approach.description)}</p>`:''}${political?`<p>Present one documented case per hearing. Inspect the exact changes first: the same argument can gain one interest group and alienate another.</p><div class="case-options">${cases.map(c=>`<article><h4>${esc(c.label)}</h4><p>${esc(c.description)}</p><p class="muted">${c.earned?'Earlier service supports this case.':'The required earlier record has not been earned.'}</p><button data-cmd="inspect-case" data-id="${esc(c.id)}" ${c.preview.ok?'':'disabled'}>Inspect case & vote changes</button>${!c.preview.ok?`<small>${esc(c.preview.message)}</small>`:''}</article>`).join('')}</div>`:`<dl class="doctrine-facts"><div><dt>Enemy posture</dt><dd>${esc(brief.doctrine?.phase||brief.title)}</dd></div><div><dt>Current focus</dt><dd>${esc(brief.doctrine?.focusName||'No visible target')}</dd></div></dl><p class="muted">${esc(brief.doctrine?.trigger||'')}</p><div class="opportunity-notes">${brief.opportunities.map(o=>`<p><strong>${esc(o.label)}</strong><br>${esc(o.description)}</p>`).join('')}</div><p class="command-rule-note">${esc(brief.reaction)}</p>`}${brief.witness?`<p class="command-witness"><strong>${esc(brief.witness.name)}</strong> · ${esc(brief.witness.description)}</p>`:''}</div></details>`;
}

export function casePreview(state,id){
  const option=Game.caseOptions(state).find(c=>c.id===id),preview=Game.previewCase(state,id);
  if(!option)return '<p>This case is unavailable.</p>';
  return `<p class="panel-lead">${esc(option.description)}</p><p>${esc(preview.message)}</p>${preview.changes?.length?`<table class="case-preview-table"><caption>Exact delegate stance changes</caption><thead><tr><th>Delegate</th><th>Before</th><th>After</th></tr></thead><tbody>${preview.changes.map(c=>`<tr><th scope="row">${esc(c.name)}</th><td>${c.from}</td><td>${c.to}</td></tr>`).join('')}</tbody></table>`:''}<p>Costs the commander’s speech. Only one documented case may be presented in this hearing.</p><div class="panel-actions"><button class="primary" data-cmd="present-case" data-id="${esc(id)}" ${preview.ok?'':'disabled'}>Present this case · one speech</button><button data-cmd="close-modal">Keep deliberating</button></div>`;
}

export function commandRecord(state){
  const brief=Game.commandBriefing(state);if(!brief.enabled||!brief.records.length)return '';
  const recent=brief.records.slice(-4),archive=Game.archiveEncounters(state);
  return `<section class="sidebar-card command-service-record"><p class="eyebrow">SERVICE BECOMES EVIDENCE</p><h3>Your command record</h3><p>${brief.records.length} recorded encounters. Earned service, rescues and provincial judgments can support later political cases.</p><ol>${recent.map(r=>{const h=archive.find(h=>h.id===r.id);return `<li><strong>${esc(h?.title||r.id)}</strong><span>${r.case?'Documented case presented':r.opportunity?'Field opportunity secured':'Main objective completed'}${r.witness?' · companion account preserved':''}</span></li>`;}).join('')}</ol></section>`;
}

export function practicePanel(state){
  const archive=Game.archiveEncounters(state);if(!archive.length)return '';
  return `<details class="progression-panel practice-library"><summary>Practice your completed encounters · ${archive.length} available</summary><p>Try another approach in an isolated practice session. Your active chronicle, supplies and appointments remain saved. Weather, difficulty and later succession routes can be changed inside practice.</p><div class="practice-grid">${archive.map(e=>`<article><span class="eyebrow">CHAPTER ${e.chapter} · ${e.kind==='contest'?'DEBATE':'FIELD'}</span><h4>${esc(e.title)}</h4><p>${e.recordedTurns} turns · ${e.recordedLosses} withdrawn in your chronicle</p><button data-cmd="archive-replay" data-id="${esc(e.id)}">Practice this encounter</button></article>`).join('')}</div></details>`;
}
