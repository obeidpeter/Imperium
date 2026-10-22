import {CHAPTERS} from '../data/campaign.js';
import {esc,roman} from './view-helpers.js';
import {heroPortrait} from './art.js';
import {THEATRES,careerLegs,paintedJourneyMap} from './campaign-map.js';

// The landing page's sections that read the campaign data. Presentation only:
// nothing here changes a chronicle, and every figure comes from the data.
const ENCOUNTERS=CHAPTERS.flatMap(c=>c.encounters);
export const LANDING_FACTS=Object.freeze({chapters:CHAPTERS.length,encounters:ENCOUNTERS.length,
  battles:ENCOUNTERS.filter(e=>e.kind==='battle').length,contests:ENCOUNTERS.filter(e=>e.kind==='contest').length});

export function heroFacts(){
  const f=LANDING_FACTS;
  return `<ul class="hero-facts" aria-label="At a glance">${[[`${f.chapters} chapters`,'AD 250–276'],[`${f.encounters} encounters`,'Battles and political Contests'],
    ['Free to play','No account or installation'],['Plays offline','Once its chapters download']]
    .map(([fact,detail])=>`<li><strong>${fact}</strong><span>${detail}</span></li>`).join('')}</ul>`;
}

// A returning player's chronicle: who, where, and how far along the twelve chapters.
export function chronicleCard(state){
  const chapter=CHAPTERS.find(c=>c.id===state.chapter)??CHAPTERS[0],done=new Set(state.completed??[]),finished=state.phase==='epilogue';
  const count=CHAPTERS.filter(c=>done.has(c.id)).length;
  const steps=CHAPTERS.map(c=>`<li class="${done.has(c.id)?'done':c.id===chapter.id&&!finished?'current':''}"></li>`).join('');
  return `<section class="chronicle-card" aria-labelledby="chronicle-title"><img class="chronicle-portrait" src="${heroPortrait(state.rank)}" width="96" height="96" decoding="async" alt="">`+
    `<div class="chronicle-copy"><p class="eyebrow">${finished?'YOUR CHRONICLE IS COMPLETE':'YOUR CHRONICLE'}</p><h2 id="chronicle-title">${esc(state.name)}</h2>`+
    `<p class="chronicle-chapter">Chapter ${roman(chapter.id)} of ${roman(CHAPTERS.length)} · ${esc(chapter.title)}</p>`+
    `<p class="chronicle-meta">${esc(state.rank)} · ${esc(chapter.location)} · ${esc(chapter.year)}</p>`+
    `<ol class="chronicle-progress" aria-hidden="true">${steps}</ol><p class="chronicle-count">${count} of ${CHAPTERS.length} chapters complete</p></div>`+
    `<div class="chronicle-actions"><button class="primary" data-cmd="continue">Continue your chronicle <span aria-hidden="true">→</span></button>`+
    `<button class="ghost hero-restore" data-cmd="new">Begin a new chronicle</button></div></section>`;
}

// The career in five stages, each with its chapters' ranks, beside the painted route.
const STAGES=[['Recruit','Learn to survive beside your comrades.',1,3],['Commander','Direct the soldiers who trust you.',4,9],
  ['Governor','Distribute relief and judge competing claims.',10,10],['Senator','Build support in a divided chamber.',11,12],
  ['Emperor','Answer for the promises that brought you here.',null,null]];
export function journeySection(){
  const stages=STAGES.map(([title,text,from,to])=>{
    const chapters=from?CHAPTERS.filter(c=>c.id>=from&&c.id<=to):[];
    const span=!from?'The accession':from===to?`Chapter ${roman(from)}`:`Chapters ${roman(from)}–${roman(to)}`;
    return `<li><span class="career-number">${span}</span><h3>${title}</h3><p>${text}</p>${chapters.length?`<p class="career-ranks">${chapters.map(c=>esc(c.rank)).join(' · ')}</p>`:''}</li>`;
  }).join('');
  // The text alternative names every journey, as the inked numerals do.
  const place=slug=>THEATRES.find(t=>t[0]===slug)[1],route=careerLegs().map(leg=>`chapter ${leg.chapter}, ${place(leg.from)} to ${place(leg.to)}`).join('; ');
  const map=paintedJourneyMap(CHAPTERS.length+1,[],null,{ids:'landing-tabula',interactive:false,
    label:`Painted map of the career route. Each journey begins a chapter: ${route}.`,
    caption:'The route of the career · Roman numerals mark the chapter that begins each journey'});
  return `<section id="rise" class="site-section rise-section" aria-labelledby="rise-title"><div class="section-heading"><p class="eyebrow">A LIFE IN SERVICE</p>`+
    `<h2 id="rise-title">The man changes.<br>The oath endures.</h2><p>Twelve chapters take one fictional career through a fractured empire, from a legionary base `+
    `on the Danube to the Senate in Rome. Each appointment brings a different responsibility.</p></div>`+
    `<div class="journey"><div class="journey-map">${map}</div><ol class="career-path">${stages}</ol></div>`+
    `<p class="section-note">A historical setting and a fictional, composite career—not a universal Roman promotion ladder.</p></section>`;
}
