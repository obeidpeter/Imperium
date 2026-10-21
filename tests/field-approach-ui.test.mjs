import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {clone} from '../src/core/shared.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {approachPlanning,deploymentPlanning,commandIntelligence} from '../src/ui/command-edition-views.js';
import {esc} from '../src/ui/view-helpers.js';

// Actual New Game checkpoints of an edition-35 campaign and of an older
// command campaign. No supplies, positions or results are injected.
const camps={34:new Map(),35:new Map()},runs={};
function camp(edition,id){
  runs[edition]??=runCommandCampaign({featureEdition:edition,onCheckpoint:s=>camps[edition].set(G.getChapter(s).encounters[s.encounterIndex].id,clone(s))});
  const s=camps[edition].get(id);assert.ok(s,`${id} checkpoint`);return clone(s);
}
const buttons=html=>[...html.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]);
const control=(html,command,id)=>buttons(html).find(tag=>tag.includes(`data-cmd="${command}"`)&&(id===undefined||tag.includes(`data-id="${id}"`)));

test('v0.35.1: an older command campaign offers field approaches once, at camp', () => {
  const s=camp(34,'ch5-mine'),before=G.serialize(s),html=deploymentPlanning(s);
  assert.ok(control(html,'approach-upgrade'),'The camp table offers the upgrade');assert.equal(G.serialize(s),before,'Rendering changes nothing');
  assert.ok(G.enableFieldApproaches(s).ok);
  assert.equal(control(deploymentPlanning(s),'approach-upgrade'),undefined,'The upgrade is spent');
  assert.ok(control(approachPlanning(s),'field-approach','breach'));
});

test('v0.35.1: approach cards show the selection, costs and real affordability, and choosing one is a legal command', () => {
  const s=camp(35,'ch5-mine'),before=G.serialize(s),view=G.fieldApproachView(s),html=approachPlanning(s);
  assert.equal(view.selected,'balanced');assert.match(control(html,'field-approach','balanced'),/aria-pressed="true"/);
  assert.match(html,/Both apply to the next field battle only\./);
  for(const option of view.options){
    const tag=control(html,'field-approach',option.id);assert.ok(tag,option.id);
    assert.equal(/\bdisabled\b/.test(tag),!option.available);assert.ok(html.includes(`${esc(option.label)} · ${option.cost} supplies`));
  }
  assert.equal(G.serialize(s),before);
  const affordable=view.options.find(p=>p.id!=='balanced'&&p.available);assert.ok(affordable,'The legal route can afford an approach here');
  assert.ok(G.chooseFieldApproach(s,affordable.id).ok);assert.match(control(approachPlanning(s),'field-approach',affordable.id),/aria-pressed="true"/);
  assert.ok(G.startEncounter(s).ok);
  const brief=commandIntelligence(s);assert.ok(brief.includes(esc(affordable.label)),'The field intelligence names the approach in play');
});

test('v0.35.1: unaffordable approaches are disabled with the reason, and no approach is offered before a hearing', () => {
  camp(35,'ch5-mine'); // Plays the edition-35 campaign once, if no test has yet.
  const poor=[...camps[35].values()].find(s=>G.fieldApproachView(s).options.some(p=>!p.available&&p.reason));
  assert.ok(poor,'The legal route includes an unaffordable approach');
  const html=approachPlanning(poor),blocked=G.fieldApproachView(poor).options.find(p=>!p.available);
  assert.match(control(html,'field-approach',blocked.id),/\bdisabled\b/);assert.ok(html.includes(esc(blocked.reason)));
  const before=G.serialize(poor);assert.equal(G.chooseFieldApproach(poor,blocked.id).ok,false);assert.equal(G.serialize(poor),before);
  assert.equal(approachPlanning(camp(35,'ch7-council')),'','A hearing has no field approach');
});

test('v0.35.1: the camp buttons issue the public approach commands', async t => {
  // The real app module, from a saved older camp: its buttons take the same public commands, which save.
  const {bootApp}=await import('./inert-app.mjs');
  const s=camp(34,'ch5-mine'),app=await bootApp(t,{name:'field-approach-ui',save:s});
  await app.click('continue');assert.match(app.page(),/data-cmd="approach-upgrade"/);
  await app.click('approach-upgrade');
  const upgraded=clone(s);assert.ok(G.enableFieldApproaches(upgraded).ok);assert.equal(G.serialize(app.saved()),G.serialize(upgraded));
  assert.match(app.page(),/data-cmd="field-approach" data-id="breach"/);assert.doesNotMatch(app.page(),/data-cmd="approach-upgrade"/,'The upgrade is spent');
  const choice=G.fieldApproachView(upgraded).options.find(p=>p.id!=='balanced'&&p.available);assert.ok(choice);
  await app.click('field-approach',choice.id);
  assert.ok(G.chooseFieldApproach(upgraded,choice.id).ok);assert.equal(G.serialize(app.saved()),G.serialize(upgraded));
  assert.equal(G.fieldApproachView(app.saved()).selected,choice.id);
  // An approach the rules refuse (sent by a tampered page) saves nothing.
  const kept=G.serialize(app.saved());await app.command('field-approach','invented');assert.equal(G.serialize(app.saved()),kept);
});
