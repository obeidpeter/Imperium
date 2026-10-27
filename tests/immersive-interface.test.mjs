import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {fieldMarkup,realtimeEncounterView} from '../src/ui/realtime-view.js';
import {chamberEncounterView} from '../src/ui/chamber-view.js';
import {selectRealtimeView} from '../src/showcase/realtime-field.js';
import {Document} from './mini-dom.mjs';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const camp=chapter=>Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state));
const documentFor=html=>{const doc=new Document();doc.body.innerHTML=html;return doc;};

test('all twelve immersive camps place the world before services, with a short departure bar and optional dossier',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const state=camp(chapter),before=Game.serialize(state),view=createCampaignViews(()=>({state,screen:'game',settings:{},lastSaved:'saved'}));
    const html=view.realtimeCamp(),doc=documentFor(html),host=doc.getElementById('rt-host'),services=doc.getElementById('camp-services');
    assert.ok(doc.querySelector('main.world-first'));
    assert.ok(html.indexOf('id="rt-host"')<html.indexOf('id="camp-services"'),'world precedes the service reference');
    assert.equal(host.closest('.camp-sidebar'),null,'world never shares a sidebar');
    assert.equal(services.getAttribute('tabindex'),'-1','the jump destination can receive keyboard focus');
    assert.ok(doc.querySelector('a[href="#camp-services"]'));assert.ok(doc.querySelector('a[href="#rt-board"]'));
    assert.equal(doc.querySelectorAll('[data-cmd="start"]').length,1);
    assert.equal(doc.querySelectorAll('h1').length,1);
    assert.equal(doc.querySelector('.world-departure .chapter-meta'),null,'rank explanations no longer occupy the first screen');
    const records=doc.getElementById('camp-records');assert.equal(records.open,false);
    assert.ok(records.contains(doc.getElementById('campaign-chapters')));
    assert.ok(records.contains(doc.getElementById('camp-promotion')));
    assert.ok(services.querySelector('[data-cmd="conversation"][data-id="table"]'));
    assert.equal(Game.serialize(state),before,'layout does not change a save or consume randomness');
  }
});

test('camp, battle and chamber expose the same named camera choices outside the canvas',()=>{
  const state=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id==='board-ch5-mine').state));
  for(const kind of ['camp','field','chamber']){
    const doc=documentFor(fieldMarkup({state,kind})),select=doc.querySelector('[data-role="cameraSelect"]');
    assert.equal(select.getAttribute('aria-label'),'World view');
    assert.deepEqual(select.querySelectorAll('option').map(o=>o.getAttribute('value')),['follow','overview','horizon']);
    assert.ok(select.closest('.rt-top'));assert.equal(select.closest('.rt-scene'),null,'camera controls do not cover action');
    assert.equal(select.querySelector('option[selected]').getAttribute('value'),kind==='chamber'?'overview':'follow');
  }
  assert.ok(documentFor(realtimeEncounterView({state})).querySelector('main.world-first'));
  const chamber=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id==='board-ch7-council').state));
  assert.ok(documentFor(chamberEncounterView({state:chamber})).querySelector('main.world-first'));
});

test('camp keeps one objective above the world and moves the duplicate local briefing below it without hiding departure requirements',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const state=camp(chapter),shell=createCampaignViews(()=>({state,screen:'game',settings:{}})).realtimeCamp();
    // Compare the live field independently of the host's stable identity.
    const field=fieldMarkup({state,kind:'camp'}),doc=documentFor(field),head=doc.querySelector('.rt-top'),page=documentFor(shell);
    assert.equal(head.querySelector('h2'),null,'there is no second title above the world');
    assert.equal(doc.querySelector('[data-role="missionHeadline"]'),null,'the departure objective is not repeated');
    assert.ok(field.indexOf('data-role="missionDetails"')>field.indexOf('id="rt-board"'));
    assert.equal(doc.querySelector('[data-role="missionDetails"]').open,false);
    assert.ok(head.querySelector('[data-role="pauseButton"]'));assert.ok(head.querySelector('[data-role="cameraSelect"]'));
    assert.equal(page.querySelectorAll('[data-cmd="start"]').length,1);assert.ok(page.querySelector('a[href="#camp-services"]'));
    const problem=Game.departureCheck(state);
    if(problem){const warning=page.getElementById('camp-departure-problem');assert.equal(warning.textContent,problem);assert.equal(warning.closest('details'),null);assert.equal(warning.hidden,false);}
  }
});

test('explicit camera choices do not toggle unexpectedly or modify the soldier',()=>{
  const actor={id:'hero',x:12,z:7},before=JSON.stringify(actor),calls=[];
  const stage={orbit:{yaw:.3,pitch:.5,distance:14},cameraView:'overview',
    home(){this.cameraView='overview';calls.push('home');},horizon(){this.cameraView='horizon';calls.push('horizon');},wake(){calls.push('wake');}};
  assert.equal(selectRealtimeView(stage,actor,'overview'),true);
  assert.equal(selectRealtimeView(stage,actor,'overview'),true);assert.equal(stage.cameraView,'overview','selecting Overview twice still means Overview');
  assert.equal(selectRealtimeView(stage,actor,'horizon'),true);assert.equal(stage.cameraView,'horizon');
  assert.equal(selectRealtimeView(stage,actor,'follow'),true);assert.equal(stage.cameraView,'follow');assert.equal(stage.selected,'hero');
  assert.equal(JSON.stringify(actor),before);
  const viewBefore=JSON.stringify(stage);assert.equal(selectRealtimeView(stage,actor,'unknown'),false);assert.equal(JSON.stringify(stage),viewBefore);
  assert.equal(selectRealtimeView(null,actor,'follow'),false);assert.equal(selectRealtimeView(stage,null,'follow'),false);
  assert.equal(selectRealtimeView({...stage,flat:true},actor,'horizon'),false,'2D never offers a horizon that it cannot display');
  assert.deepEqual(calls.filter(c=>c!=='wake'),['home','home','horizon']);
});

test('the compact camp shell retains save recovery and conflict takeover outside optional content',()=>{
  const state=camp(5),html=createCampaignViews(()=>({state,screen:'game',settings:{},saveProblem:'Storage is full.',saveConflict:true})).realtimeCamp(),doc=documentFor(html);
  const warning=doc.querySelector('[role="alert"]');assert.match(warning.textContent,/Storage is full/);
  assert.ok(warning.querySelector('[data-cmd="export"]'));assert.ok(warning.querySelector('[data-cmd="takeover"]'));
  assert.equal(warning.closest('details'),null);assert.ok(html.indexOf('role="alert"')<html.indexOf('id="rt-host"'));
});
