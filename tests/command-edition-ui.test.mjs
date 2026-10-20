import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {clone} from '../src/core/shared.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {deploymentPlanning,commandIntelligence,casePreview,commandRecord,practicePanel} from '../src/ui/command-edition-views.js';
import {esc} from '../src/ui/view-helpers.js';

// Use actual New Game checkpoints. No funds, evidence, votes or completed
// records are injected into these integration fixtures.
const camps=new Map();let campaign;
function baseline(){
  return campaign??=runCommandCampaign({onCheckpoint:s=>camps.set(G.getChapter(s).encounters[s.encounterIndex].id,clone(s))});
}
function camp(id){baseline();return clone(camps.get(id));}
function hearing(){
  const s=camp('ch7-council');assert.ok(G.startEncounter(s).ok);return s;
}
function button(html,command,id){
  const tag=html.matchAll(/<button\b[^>]*>/g);
  return [...tag].map(m=>m[0]).find(tag=>tag.includes(`data-cmd="${command}"`)&&tag.includes(`data-id="${id}"`));
}

test('deployment cards render the selected legal preparation and actual supply affordability',()=>{
  const s=camp('ch5-mine'),before=G.serialize(s),view=G.operationalPlan(s),html=deploymentPlanning(s);
  assert.equal(view.selected,'engineers');
  assert.match(button(html,'operational-plan','engineers'),/aria-pressed="true"/);
  for(const option of view.options){
    const control=button(html,'operational-plan',option.id);
    assert.ok(control);assert.equal(/\bdisabled\b/.test(control),!option.available);
    assert.ok(html.includes(esc(option.label)));
    assert.ok(html.includes(option.cost?`${option.cost} supplies`:'No supply cost'));
  }
  assert.equal(G.serialize(s),before);
  const poor=[...camps.values()].find(c=>G.operationalPlan(c).enabled&&G.operationalPlan(c).options.some(p=>p.id!=='balanced'&&!p.available&&/affordable/.test(p.reason)));
  assert.ok(poor,'The legal route includes an unaffordable deployment');
  const poorBefore=G.serialize(poor),poorView=G.operationalPlan(poor),poorHtml=deploymentPlanning(poor);
  for(const option of poorView.options)assert.equal(/\bdisabled\b/.test(button(poorHtml,'operational-plan',option.id)),!option.available);
  const blocked=poorView.options.find(p=>!p.available);
  assert.equal(G.chooseOperationalPlan(poor,blocked.id).ok,false);
  assert.equal(G.serialize(poor),poorBefore);
});

test('case inspection renders the exact delegate forecast without changing state or RNG',()=>{
  const s=hearing(),option=G.caseOptions(s).find(c=>c.preview.ok),before=G.serialize(s);
  assert.ok(option);const preview=G.previewCase(s,option.id),html=casePreview(s,option.id);
  assert.ok(preview.changes.length);
  for(const change of preview.changes)assert.ok(html.includes(`<th scope="row">${esc(change.name)}</th><td>${change.from}</td><td>${change.to}</td>`));
  assert.equal(/\bdisabled\b/.test(button(html,'present-case',option.id)),false);
  assert.equal(G.serialize(s),before);
  assert.ok(G.presentCase(s,option.id).ok);
  for(const change of preview.changes)assert.equal(s.encounter.units.find(u=>u.id===change.id).stance,change.to);
});

test('spent or unknown cases cannot be committed through the displayed controls or core API',()=>{
  const s=hearing(),option=G.caseOptions(s).find(c=>c.preview.ok);
  assert.ok(G.presentCase(s,option.id).ok);
  const before=G.serialize(s),html=casePreview(s,option.id),intelligence=commandIntelligence(s);
  assert.match(button(html,'present-case',option.id),/\bdisabled\b/);
  for(const c of G.caseOptions(s))assert.match(button(intelligence,'inspect-case',c.id),/\bdisabled\b/);
  assert.equal(G.presentCase(s,option.id).ok,false);
  assert.equal(G.presentCase(s,'unrecorded-case').ok,false);
  assert.equal(casePreview(s,'unrecorded-case'),'<p>This case is unavailable.</p>');
  assert.equal(G.serialize(s),before);
});

test('command records resolve authored encounter titles and preserve their source chronicle',()=>{
  const s=camp('ch11-adlection'),before=G.serialize(s),html=commandRecord(s),archive=G.archiveEncounters(s);
  const recent=s.commandCampaign.records.slice(-4);assert.equal(recent.length,4);
  for(const record of recent){
    const encounter=archive.find(e=>e.id===record.id);assert.ok(encounter);
    assert.ok(html.includes(`<strong>${esc(encounter.title)}</strong>`));
    assert.equal(html.includes(`<strong>${record.id}</strong>`),false);
  }
  assert.equal(G.serialize(s),before);
});

test('practice offers completed encounters only and opening one leaves the live chronicle unchanged',()=>{
  const s=camp('ch5-mine'),before=G.serialize(s),html=practicePanel(s),archive=G.archiveEncounters(s);
  const ids=[...html.matchAll(/data-cmd="archive-replay" data-id="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids,archive.map(e=>e.id));
  assert.ok(ids.length>0);assert.equal(ids.includes('ch5-mine'),false);
  assert.ok(archive.every(e=>s.history.some(h=>h.id===e.id)));
  const replay=G.createArchiveReplay(s,archive[0].id);assert.ok(replay.ok,replay.message);
  assert.equal(replay.state.encounter.id,archive[0].id);
  assert.equal(G.serialize(s),before);
  const fresh=G.newGame('New commander',275,{featureEdition:34,progression:true});
  assert.equal(practicePanel(fresh),'');
});
