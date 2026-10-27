import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as G from '../src/core/game.js';
import {playEncounter} from '../scripts/autoplay.mjs';
import {companyPreparation,difficultyChoices,operationBanner,tacticalCoaching,soundscapeSettings,voicedBriefing} from '../src/ui/campaign-upgrade-views.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {createPanels} from '../src/ui/panels.js';
import {CONFIG} from '../src/config.js';

const clone=s=>G.deserialize(G.serialize(s));
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
function road(difficulty='standard'){
  const s=G.newGame('UI recruit',275,{difficulty});assert.ok(G.choose(s,'report').ok);assert.ok(G.startEncounter(s).ok);assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);assert.ok(G.swearOath(s).ok);return s;
}
const openingRoad=road();
function reachFourth(){const s=clone(openingRoad);while(s.chapter<4){if(s.phase==='camp'){const c=G.getChapter(s);if(!s.decisions[c.decision.id])assert.ok(G.choose(s,c.decision.options[0].id).ok);assert.ok(G.startEncounter(s).ok);}if(s.phase==='encounter'){assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);}if(s.phase==='promotion')assert.ok(G.advanceChapter(s).ok);}return s;}
const fourthCamp=reachFourth();
const tags=(html,name)=>[...html.matchAll(new RegExp(`<${name}\\b[^>]*>`,'g'))].map(m=>m[0]);
const packageButton=(html,id)=>new RegExp(`<button\\b[^>]*data-cmd="company-package"[^>]*data-id="${id}"[^>]*>`).exec(html)?.[0];

test('Legacy checkpoints and training camps expose no modern company controls',async()=>{
  const legacy=JSON.parse(await readFile(new URL('./compatibility/campaign-v014-route.json',import.meta.url),'utf8')).initial,s=G.deserialize(JSON.stringify(legacy));
  assert.ok(G.choose(s,'report').ok);assert.ok(G.startEncounter(s).ok);assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);assert.ok(G.swearOath(s).ok);assert.equal(G.companyPlan(s).encounterId,'ch1-road');assert.equal(G.companyPlan(s).legacy,true);
  for(const state of [s,G.newGame()]){const before=G.serialize(state);assert.equal(companyPreparation(freeze(state)),'');const views=createCampaignViews(()=>({state,screen:'game',settings:{},saving:false,offline:false}));const html=views.camp();assert.ok(!html.includes('class="company-slot"'));assert.ok(!html.includes('data-cmd="company-package"'));assert.equal(G.serialize(state),before);}
});

test('Company UI renders exactly the permitted slots, excludes duplicates and gives each input a label',()=>{
  for(const original of [openingRoad,fourthCamp]){const state=clone(original),plan=G.companyPlan(state),before=G.serialize(state),html=companyPreparation(freeze(state)),selects=[...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)];assert.equal(selects.length,plan.slots);assert.equal(plan.slots,state.chapter===1?1:3);
    for(const [i,match]of selects.entries()){assert.match(match[1],new RegExp(`id="company-slot-${i}"`));assert.ok(html.includes(`for="company-slot-${i}"`));const options=tags(match[2],'option');assert.equal(options.filter(tag=>/\sselected(?:\s|>)/.test(tag)).length,1);for(const id of plan.selectedIds.filter(id=>id!==plan.selectedIds[i]))assert.ok(options.some(tag=>tag.includes(`value="${id}"`)&&/\sdisabled/.test(tag)));}
    assert.match(html,/<button[^>]*data-cmd="company-up"[^>]*data-id="0"[^>]*disabled/);assert.match(html,new RegExp(`<button[^>]*data-cmd="company-down"[^>]*data-id="${plan.slots-1}"[^>]*disabled`));assert.equal(G.serialize(state),before);
  }
});

test('Package controls reflect actual affordability and selection never spends the departure cost',()=>{
  const state=clone(openingRoad);state.supplies=1; // Explicit low-balance rendering fixture, not a progression claim.
  let html=companyPreparation(state);assert.ok(!/\sdisabled/.test(packageButton(html,'none')));for(const id of ['support','rearm','recovery'])assert.match(packageButton(html,id),/\sdisabled/);
  const unchanged=G.serialize(state);assert.equal(G.prepareCompany(state,'support').ok,false);assert.equal(G.serialize(state),unchanged);
  state.supplies=4;assert.ok(G.prepareCompany(state,'rearm').ok);html=companyPreparation(state);assert.match(packageButton(html,'rearm'),/aria-pressed="true"/);assert.match(html,/2 supplies will be spent when you enter/);assert.equal(state.supplies,4);
  assert.ok(G.startEncounter(state).ok);assert.equal(state.supplies,2);const started=G.serialize(state);assert.equal(companyPreparation(state),'');assert.equal(G.prepareCompany(state,'support').ok,false);assert.equal(G.serialize(state),started);
});

test('Dynamic veteran names are escaped in text, options and accessible reorder labels',()=>{
  const state=clone(fourthCamp),attack='"<img src=x onerror=alert(1)> & \'name\'';state.company[0].name=attack;const before=JSON.stringify(state),html=companyPreparation(state);
  assert.ok(!html.includes(attack));assert.ok(!html.includes('<img'));assert.ok(html.includes('&quot;&lt;img'));assert.ok(html.includes('&amp;'));assert.ok(html.includes('aria-label="Move &quot;&lt;img'));assert.equal(JSON.stringify(state),before);
});

test('Operation banners report legally reached phases without advancing or committing them',()=>{
  const state=clone(openingRoad);assert.ok(G.startEncounter(state).ok);let before=G.serialize(state),html=operationBanner(freeze(structuredClone(state.encounter)));assert.match(html,/PHASE 1 OF 2/);assert.match(html,/Form the road screen/);assert.match(html,/Then: Break the raiding party/);assert.equal(G.serialize(state),before);
  assert.equal(playEncounter(state).status,'won');before=G.serialize(state);html=operationBanner(freeze(structuredClone(state.encounter)));assert.match(html,/PHASE 2 OF 2/);assert.match(html,/Completed: Form the road screen/);assert.match(html,/This is the final phase/);assert.equal(G.serialize(state),before);assert.equal(state.history.length,1,'Rendering does not commit the second encounter');assert.equal(operationBanner(null),'');
});

test('Difficulty choices, coaching and audio controls expose their actual defaults and remain read-only',()=>{
  const html=difficultyChoices(),radios=tags(html,'input');assert.deepEqual(radios.map(tag=>/value="([^"]+)"/.exec(tag)[1]),['story','standard','veteran']);assert.equal(radios.filter(tag=>/\schecked/.test(tag)).length,1);assert.match(radios.find(tag=>tag.includes('standard')),/\schecked/);
  const state=G.newGame('Reader',275,{difficulty:'story'});assert.ok(G.choose(state,'report').ok);assert.ok(G.startEncounter(state).ok);const before=G.serialize(state),coaching=tacticalCoaching(freeze(structuredClone(state)));assert.match(coaching,/id="command-coaching"[^>]*open/);assert.match(coaching,/Field advice · Story/);assert.match(coaching,/Move and action are separate/);assert.equal(tacticalCoaching(state,false),'');assert.equal(G.serialize(state),before);
  const settings={music:true,ambience:false,voices:true,soundtrackVolume:.35},settingsBefore=JSON.stringify(settings),audio=soundscapeSettings(freeze(settings));for(const id of ['music','ambience','voices']){assert.ok(audio.includes(`for="${id}-setting"`));assert.ok(audio.includes(`id="${id}-setting"`));}assert.match(audio,/id="soundtrack-volume"[^>]*value="35"/);assert.match(audio,/id="music-setting"[^>]*checked/);assert.ok(!tags(audio,'input').find(t=>t.includes('ambience-setting')).includes('checked'));assert.equal(JSON.stringify(settings),settingsBefore);
  const shown=[],panels=createPanels(()=>({state,settings,showModal:(title,body)=>shown.push(body),meters:()=>'',requirements:()=>''}));panels.showNew();assert.ok(shown.at(-1).includes('name="campaign-difficulty"'));assert.ok(shown.at(-1).includes('id="new-soundscape"'));panels.showSettings();assert.ok(shown.at(-1).includes('id="coach-setting"'));assert.ok(shown.at(-1).includes('id="voices-setting"'));assert.equal(G.serialize(state),before);
  const briefing=voicedBriefing(state);assert.match(briefing,/data-cmd="voice-briefing" data-id="arrival"/);assert.match(briefing,/You arrive at the edge of an empire/);
});

test('Actual app event hooks reject invalid company edits before storage, commit valid plans, and save settings separately',async t=>{
  // The actual app module and save code, on the page skeleton (inert-app.mjs): no canvas, layout, audio device or production storage.
  const {bootApp}=await import('./inert-app.mjs');
  const app=await bootApp(t,{name:'campaign-upgrade-ui',save:clone(openingRoad),settings:{battleView:'2d'}});
  const saved=()=>JSON.parse(app.raw()),state=()=>app.saved(),open=async cmd=>{if(!app.doc.querySelector(`[data-cmd="${cmd}"]`))await app.click('menu');await app.click(cmd);};
  await app.click('continue');const original=saved(),count=app.storage.writes;
  // A tampered page offers a veteran the company does not have: the rules refuse it before storage.
  const slot=app.find('.company-slot'),forged=app.doc.createElement('option');forged.setAttribute('value','absent');slot.append(forged);
  await app.change('.company-slot',{value:'absent'});assert.equal(app.storage.writes,count);assert.deepEqual(saved(),original,'Rejected choice does not persist, mutate or charge');
  await app.change('.company-slot',{value:'naso'});assert.equal(state().companyOrders.priority[0],'naso');assert.equal(state().supplies,openingRoad.supplies);
  const chosen=app.doc.querySelectorAll('.company-slot').map(node=>node.value),expected=clone(openingRoad);assert.ok(G.selectCompany(expected,chosen).ok);
  assert.equal(G.serialize(state()),G.serialize(expected),'A later valid save exposes no hidden mutation from the rejected selection');
  await app.click('company-package','rearm');assert.equal(state().companyOrders.package,'rearm');assert.equal(state().supplies,openingRoad.supplies);
  const good=saved(),validWrites=app.storage.writes;await app.command('company-package','invented');assert.equal(app.storage.writes,validWrites);assert.deepEqual(saved(),good);
  await open('settings');
  await app.change('#music-setting',{checked:true});await app.change('#coach-setting',{checked:false});await app.change('#soundtrack-volume',{value:'70'});
  const preferences=app.settings();assert.equal(preferences.music,true);assert.equal(preferences.coach,false);assert.equal(preferences.soundtrackVolume,.7);
  assert.deepEqual(saved(),good,'Presentation preferences never change the campaign checkpoint');
  await app.click('close-modal');await app.click('home');await app.click('new');
  // This inert-DOM suite tests the classic panel controls; the real-time New
  // Game default is exercised in the browser onboarding suite.
  app.find('input[name="new-play-mode"][value="realtime"]').checked=false;
  await app.change('input[name="new-play-mode"][value="turns"]',{checked:true});
  app.find('#name-input').value='Veteran <new>';app.find('input[name="campaign-difficulty"][value="veteran"]').checked=true;app.find('#new-soundscape').checked=false;
  await app.click('begin');assert.equal(state().difficulty,'veteran');assert.equal(state().phase,'camp');assert.equal(state().chapter,1);assert.equal(state().name,'Veteran <new>');
});
