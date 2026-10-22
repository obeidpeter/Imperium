import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {THEATRES,careerLegs} from '../src/ui/campaign-map.js';
import {LANDING_FACTS,chronicleCard,heroFacts,journeySection} from '../src/ui/landing-view.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {roman} from '../src/ui/view-helpers.js';

const title=state=>{const context={state,screen:'title',settings:{quality:'balanced',textScale:1,reducedMotion:true},saving:false,lastSaved:'',saveProblem:'',saveConflict:false,offline:false,
  currentChapterOffline:false,offlineProgress:''};return createCampaignViews(()=>context).titleView();};

test('the landing page’s figures come from the campaign data',()=>{
  const encounters=CHAPTERS.flatMap(c=>c.encounters);
  assert.deepEqual(LANDING_FACTS,{chapters:CHAPTERS.length,encounters:encounters.length,battles:encounters.filter(e=>e.kind==='battle').length,
    contests:encounters.filter(e=>e.kind==='contest').length});
  assert.equal(LANDING_FACTS.battles+LANDING_FACTS.contests,LANDING_FACTS.encounters,'every encounter is a battle or a Contest');
  assert.match(heroFacts(),new RegExp(`<strong>${CHAPTERS.length} chapters</strong>`));assert.match(heroFacts(),new RegExp(`<strong>${encounters.length} encounters</strong>`));
  const fresh=title(null);
  assert.match(fresh,new RegExp(`${encounters.length} playable encounters: ${LANDING_FACTS.battles} battles and ${LANDING_FACTS.contests} political Contests`));
  assert.ok(fresh.includes('class="hero-facts"')&&!fresh.includes('chronicle-card'),'a newcomer sees what the game is');
});

test('a returning chronicle shows its chapter, rank, place and progress, escaped, without changing the state',()=>{
  const card=chronicleCard({name:'<Gaius & Co>',rank:'Centurio',chapter:5,completed:[1,2,3,4],phase:'camp'});
  assert.ok(!card.includes('<Gaius'));assert.match(card,/&lt;Gaius &amp; Co&gt;/);
  assert.match(card,/Chapter V of XII · The Centurion/);assert.match(card,/Centurio · A fictional Euphrates fortress/);assert.match(card,/4 of 12 chapters complete/);
  assert.match(card,/assets\/portraits\/hero-centurion\.webp/);
  assert.deepEqual([...card.matchAll(/<li class="([^"]*)"><\/li>/g)].map(m=>m[1]),['done','done','done','done','current',...Array(7).fill('')]);
  assert.match(card,/<button class="primary" data-cmd="continue">/);assert.match(card,/data-cmd="new"/);
  const finished=chronicleCard({name:'Aurelius',rank:'Augustus',chapter:12,completed:CHAPTERS.map(c=>c.id),phase:'epilogue'});
  assert.match(finished,/YOUR CHRONICLE IS COMPLETE/);assert.match(finished,/12 of 12 chapters complete/);assert.ok(!finished.includes('class="current"'));
  const state=Game.newGame('Aurelius'),before=Game.serialize(state),returning=title(state);
  assert.match(returning,/class="chronicle-card"/);assert.match(returning,/class="title-hero returning"/);assert.ok(!returning.includes('class="hero-facts"'));
  assert.match(returning,/0 of 12 chapters complete/);assert.equal(Game.serialize(state),before);
});

test('the landing journey is an illustration: the whole route, its own ids, no theatre buttons',()=>{
  const html=journeySection();
  assert.equal((html.match(/class="career-leg done"/g)??[]).length,careerLegs().length,'every leg of the route is inked');
  assert.ok(!/role="button"|tabindex=/.test(html),'nothing in the illustration claims to be a control');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]).filter(id=>id.includes('tabula'));
  assert.ok(ids.length&&ids.every(id=>id.startsWith('landing-tabula-')),'the Menu’s map can open beside it without duplicate ids');
  assert.ok([...html.matchAll(/url\(#([^)]+)\)/g)].every(m=>m[1].startsWith('landing-tabula-')));
  for(const chapter of CHAPTERS)assert.ok(html.includes(chapter.rank),`${chapter.rank} is listed with its stage`);
  assert.equal((html.match(/<li><span class="career-number">/g)??[]).length,5);
  const label=html.match(/<svg[^>]* aria-label="([^"]+)"/)[1],place=slug=>THEATRES.find(t=>t[0]===slug)[1];
  for(const leg of careerLegs())assert.ok(label.includes(`chapter ${leg.chapter}, ${place(leg.from)} to ${place(leg.to)}`),`the text alternative names chapter ${leg.chapter}’s journey`);
});

test('the whole route stays legible: a journey back is drawn apart, and each numeral stands by its own leg',()=>{
  // Geometry read from the drawn SVG: the inked quadratic legs and the numerals' centres.
  const html=journeySection(),legs=careerLegs();
  const curves=[...html.matchAll(/class="career-leg done" d="M(\S+) (\S+)Q(\S+) (\S+) (\S+) (\S+)"/g)].map(m=>m.slice(1,7).map(Number));
  assert.equal(curves.length,legs.length);
  const point=([x1,y1,cx,cy,x2,y2],t)=>[(1-t)**2*x1+2*(1-t)*t*cx+t*t*x2,(1-t)**2*y1+2*(1-t)*t*cy+t*t*y2];
  const lines=curves.map(c=>Array.from({length:121},(_,i)=>point(c,i/120)));
  const near=(line,[x,y])=>Math.min(...line.map(p=>Math.hypot(p[0]-x,p[1]-y)));
  for(const [i,leg] of legs.entries())for(const [j,back] of legs.entries())if(back.from===leg.to&&back.to===leg.from){
    const [a,b]=[point(curves[i],.5),point(curves[j],.5)];
    assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])>12,`chapter ${back.chapter}’s journey back does not retrace chapter ${leg.chapter}’s`);
  }
  const numerals=[...html.matchAll(/class="career-numeral" x="(\S+)" y="(\S+)">([IVX]+)</g)].map(m=>({text:m[3],at:[+m[1],+m[2]-3.8]}));
  assert.deepEqual(numerals.map(n=>n.text),legs.map(l=>roman(l.chapter)));
  for(const [i,n] of numerals.entries()){
    const own=near(lines[i],n.at),other=Math.min(...lines.filter((_,j)=>j!==i).map(l=>near(l,n.at)));
    assert.ok(own<16&&other>own*1.5&&other>12,`${n.text} reads as its own leg’s (${own.toFixed(1)} from it, ${other.toFixed(1)} from the next)`);
    for(const [,,x,y] of THEATRES)assert.ok(Math.hypot(n.at[0]-x,n.at[1]-y)>18,`${n.text} is not mistaken for a place`);
    for(const m of numerals.slice(i+1))assert.ok(Math.hypot(n.at[0]-m.at[0],n.at[1]-m.at[1])>20,`${n.text} and ${m.text} stay apart`);
  }
});
