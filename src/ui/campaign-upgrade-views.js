import * as Game from '../core/game.js';
import {CAST} from '../data/campaign.js';
import {speakerPortrait} from './art.js';
import {esc,actionNames} from './view-helpers.js';
import {briefingFor} from './soundscape-data.js';
import {explainUnavailableActions,unusedTurnSummary} from './direct-controls.js';

export function difficultyChoices(){return `<fieldset class="difficulty-choices"><legend>The pace of your campaign</legend>${Game.difficultyOptions().map(d=>`<label class="difficulty-choice"><input type="radio" name="campaign-difficulty" value="${d.id}" ${d.id==='standard'?'checked':''}><span><strong>${esc(d.label)}</strong><small>${esc(d.description)}</small></span></label>`).join('')}<p class="settings-description">Applies to this new chronicle. Your choice stays with its checkpoints.</p></fieldset>`;}

export function companyPreparation(state){
  const plan=Game.companyPlan(state);if(!plan.enabled)return '';
  return `<section class="company-preparation" aria-labelledby="company-plan-title"><p class="eyebrow">BEFORE YOU MARCH</p><h3 id="company-plan-title">Choose the company</h3><p>${esc(plan.description)}</p><p class="company-cost">${plan.slots} veteran${plan.slots===1?'':'s'} to deploy · ${state.supplies} supplies in store</p><div class="company-slots">${plan.selectedIds.map((id,i)=>{
    const member=plan.available.find(u=>u.id===id);return `<div class="company-slot-row"><label for="company-slot-${i}"><span>Position ${i+1}</span><select id="company-slot-${i}" class="company-slot" data-position="${i}">${plan.available.map(u=>`<option value="${esc(u.id)}" ${u.id===id?'selected':''} ${!u.available||(u.id!==id&&plan.selectedIds.includes(u.id))?'disabled':''}>${esc(u.name)} · ${esc(u.role)}${u.available?'':' · '+esc(u.reason)}</option>`).join('')}</select></label><button data-cmd="company-up" data-id="${i}" aria-label="Move ${esc(member?.name||'veteran')} earlier in the deployment" ${i===0?'disabled':''}>↑</button><button data-cmd="company-down" data-id="${i}" aria-label="Move ${esc(member?.name||'veteran')} later in the deployment" ${i===plan.slots-1?'disabled':''}>↓</button><p>${esc(member?.specialty||'')} · ${member?.service??0} engagements · recovery ${member?.recovery??0}</p></div>`;}).join('')}</div><details class="company-reserve"><summary>Review the whole company</summary><ul>${plan.available.map(u=>`<li><strong>${esc(u.name)}</strong> — ${esc(u.specialty)}${u.available?'':` · ${esc(u.reason)}`}</li>`).join('')}</ul></details><fieldset class="company-packages"><legend>Prepare for this battle</legend>${plan.packages.map(p=>`<button data-cmd="company-package" data-id="${p.id}" aria-pressed="${plan.selectedPackage===p.id}" ${!p.available?'disabled':''}><strong>${esc(p.label)} <span>${p.cost?`${p.cost} supplies`:'No cost'}</span></strong><small>${esc(p.description)}</small></button>`).join('')}</fieldset><p class="settings-description">${plan.cost?`${plan.cost} supplies will be spent when you enter the field.`:'No preparation cost selected.'} You can revise this plan before departure.</p></section>`;
}

export function operationBanner(encounter){
  const phase=Game.operationPhase(encounter);if(!phase)return '';
  return `<section class="operation-banner" aria-label="Operation progress"><div><span class="eyebrow">PHASE ${phase.index} OF ${phase.total}</span><strong>${esc(phase.label)}</strong><p>${esc(phase.objective)}</p></div><details><summary>${phase.completed.length?`${phase.completed.length} phase completed`:'The operation ahead'}</summary>${phase.completed.length?`<p>Completed: ${phase.completed.map(esc).join(' · ')}</p>`:''}<p>${phase.next?`Then: ${esc(phase.next)}`:'This is the final phase.'}</p></details></section>`;
}

export function tacticalCoaching(state,enabled=true,selected='hero'){
  if(!enabled||state.encounter?.status!=='active')return '';
  const tips=Game.tacticalAdvice(state);if(!tips.length)return '';
  const summary=unusedTurnSummary(state),unavailable=explainUnavailableActions(state,selected),missing=Game.chapterRequirements(state).filter(r=>!r.done);
  return `<details id="command-coaching" class="tactical-coaching" ${state.encounter?.type==='training'?'open':''}><summary>${state.encounter?.kind==='contest'?'Advice for the chamber':'Field advice'} · ${state.difficulty?esc(Game.difficultyOptions().find(d=>d.id===state.difficulty)?.label||'Standard'):'Original campaign'} · What can I do?</summary><div class="coaching-status"><p><strong>Turn status:</strong> ${esc(summary.message)}</p>${missing.length?`<p><strong>Required before promotion:</strong> Demonstrate ${esc(missing.map(r=>actionNames[r.id]||r.id).join(', '))}.</p>`:''}${unavailable.length?`<p><strong>Unavailable on selected unit:</strong> ${esc(unavailable.map(u=>`${u.label}: ${u.reason}`).join(' · '))}</p>`:''}</div><ul>${tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p class="settings-description">Advice responds to the current position. You decide the next order.</p></details>`;
}

export function voicedBriefing(state){const line=briefingFor(state);return line?`<aside class="voiced-briefing"><p class="eyebrow">${esc(line.speaker)}</p><blockquote>“${esc(line.text)}”</blockquote><button data-cmd="voice-briefing" data-id="${line.id}">Hear this briefing</button><small>Optional voiced reading · text remains available</small></aside>`:'';}

export function warCouncilAdvisories(state){
  if(!state||state.phase!=='camp')return [];
  const ch=Game.getChapter(state),next=ch?.encounters?.[state.encounterIndex]??ch?.encounters?.[0],c=state.chapter;
  const picked=state.decisions?.[ch.decision.id],advisories=[];
  const castMap={
    varro:CAST.mentor,
    lucan:CAST.comrade,
    sabinus:{name:'Gaius Sabinus',role:'Veteran file-leader · the company'},
    crispus:CAST.rival,
    aelia:CAST.settler,
    paullus:CAST.senator,
  };
  const add=(id,focus,quote)=>{
    const person=castMap[id]||CAST[id];if(!person)return;
    advisories.push({id,name:person.name,role:person.role,portrait:speakerPortrait(person.name),focus,quote});
  };
  if(c<=6||state.decisions?.ch6!=='leave'){
    const varroNotes={
      1:'Learn the shield brace before you test your blade. A recruit who keeps formation comes home.',
      2:'The marsh road slows every step. If we carry the wounded, keep a shield beside the litter and never let raiders reach the flank.',
      3:'Scout the trees before committing the file. Hidden ambushes break soldiers who march blind.',
      4:'An orderly withdrawal saves veterans for tomorrow’s campaign; holding the bridge costs blood for pride.',
      5:'Use Shield Wall in the narrow breach and Line across broken ground. Spend your commands where the line thins.',
      6:'Water and nerve decide the desert road. Rally the column before exhaustion turns into rout.',
    };
    add('varro',next?.kind==='contest'?'Discipline before the benches':'Field discipline & survival',varroNotes[c]||`Keep ${ state.supplies } supplies in mind and steady the front before pressing ${next?.title||'the next objective'}.`);
  }
  if(state.decisions?.ch2!=='leave'){
    add('lucan',picked?'Comrades in the ranks':'The soldiers’ trust',c<=3?'The contubernium watches how you treat a faltering comrade. Stand by the file and they will follow you anywhere.':`The cohorts are ready for ${next?.title||'the march'}. Give us a clear order and we will hold the flank.`);
  }else if(c>=3){
    add('sabinus','Veteran file-leader',`The senior ranks respect a commander who counts the cost. In ${next?.title||'the field'}, keep the shields locked.`);
  }
  if([3,5,7,11,12].includes(c)){
    add('crispus','Quartermaster & political leverage',next?.kind==='contest'?'Every delegate has a price or a priority. Save your two Promises for Landholders or wavering swing votes—and watch who the opposition lobbies next.':'Supplies and patronage win campaigns before a sword is drawn. An obligation accepted today buys breathing room now, but chapter XII will call the ledger due.');
  }
  if([8,10,12].includes(c)){
    add('aelia','Provincial & settler counsel',c===8?'Fair crossing terms and protecting the families will bind the frontier villages to your word when you govern the province.':c===10?'Balance the six grain convoys carefully—farms and shared tenure keep the villages whole, while town granaries quiet the curial estates.':'The provinces remember whether your rule was built on shared law or forced requisitions.');
  }
  if(c>=11){
    add('paullus','Senatorial precedent',c===11?'The Curia respects a commander who cites earned service and answers calumny with measured Rebuttal rather than open threats.':'A succession that preserves the Senate’s dignity opens routes that brute force alone cannot secure.');
  }
  return advisories;
}

export function warCouncilPanel(state){
  const advisories=warCouncilAdvisories(state);
  if(!advisories.length)return '';
  return `<details id="war-council" class="progression-panel war-council-panel"><summary>Consult the War Council · ${advisories.length} ${advisories.length===1?'voice':'voices'} in camp</summary><p>Hear how your officers and counterparts weigh this chapter’s decision and the challenge ahead.</p><div class="war-council-list">${advisories.map(a=>`<article class="war-council-card"><img class="avatar-mini" src="${a.portrait}" width="72" height="72" loading="lazy" alt="${esc(a.name)}"><div><span class="eyebrow">${esc(a.role)} · ${esc(a.focus)}</span><h4>${esc(a.name)}</h4><blockquote>“${esc(a.quote)}”</blockquote></div></article>`).join('')}</div></details>`;
}

export function soundscapeSettings(settings){return `${[['music','Music','Original strings, reeds and percussion.'],['ambience','Environmental ambience','River, rain, courtyards and chambers.'],['voices','Voiced briefings','Selected moments with the complete text shown.']].map(([id,label,detail])=>`<label class="setting" for="${id}-setting"><span>${label}<small class="muted">${detail}</small></span><input id="${id}-setting" type="checkbox" ${settings[id]?'checked':''}></label>`).join('')}<label class="setting" for="soundtrack-volume"><span>Music, ambience & voice volume<small id="soundtrack-volume-value">${Math.round((settings.soundtrackVolume??.45)*100)}%</small></span><input id="soundtrack-volume" type="range" min="0" max="100" step="5" value="${Math.round((settings.soundtrackVolume??.45)*100)}"></label><p class="settings-description">Recordings download only when used or when you download a chapter. Every command and briefing is readable without sound.</p>`;}

