import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {characterPanel,companyPanel,kitPanel,soldierCampCard} from '../src/ui/soldier-views.js';
import {ITEMS} from '../src/data/items.js';
import {campFor} from '../src/data/camps.js';
import {Document} from './mini-dom.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const camp=n=>Game.deserialize(JSON.stringify(fixture.scenes.find(s=>s.id===`camp-${n}`).state));
const documentFor=html=>{const doc=new Document();doc.body.innerHTML=html;return doc;};
const collapsedAncestor=node=>{for(let p=node?.parentElement;p;p=p.parentElement)if(p.localName==='details'&&!p.open)return p;return null;};
const visible=node=>{assert.ok(node,'the control exists');assert.equal(collapsedAncestor(node),null,'the control is not hidden behind a closed disclosure');};
const views=state=>createCampaignViews(()=>({state,screen:'game',settings:{},saving:false,lastSaved:'saved'}));

test('all twelve camps keep departure and required choices exposed while optional material starts closed',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const s=camp(chapter),before=Game.serialize(s),v=views(s);
    for(const method of campFor(chapter)?['camp','realtimeCamp']:['camp']){
      const doc=documentFor(v[method]());
      assert.equal(doc.querySelectorAll('[data-cmd="start"]').length,1,`${method}, chapter ${chapter}`);
      visible(doc.querySelector('[data-cmd="start"]'));
      for(const cmd of ['choose','oath','prepare','negotiate','stratagem','allocate','judge','route'])
        for(const button of doc.querySelectorAll(`[data-cmd="${cmd}"]`))visible(button);
      for(const id of ['camp-story','camp-records','camp-people','camp-places','camp-trainers','camp-honours']){
        const detail=doc.getElementById(id);if(detail)assert.equal(detail.open,false,id);
      }
      if(Game.departureCheck(s))visible(doc.getElementById('camp-departure-problem'));
      if(Game.quartermasterForecast(s).dueNowCount)visible(doc.querySelector('.camp-due [data-cmd="ledger"]'));
      if(method==='realtimeCamp')visible(doc.querySelector('[data-cmd="conversation"][data-id="table"]'));
      const ids=doc.querySelectorAll('[id]').map(n=>n.id);assert.equal(new Set(ids).size,ids.length,'disclosures and inputs have unique IDs');
      assert.equal(Game.serialize(s),before,'rendering never changes campaign, rules or RNG');
    }
  }
});

test('game shell keeps mission, save status and Menu together without duplicate settings links',()=>{
  const v=views(camp(5)),doc=documentFor(v.header()+v.footer());
  visible(doc.querySelector('[data-cmd="soldier-panel"][data-id="mission"]'));
  assert.equal(doc.querySelectorAll('[data-cmd="menu"]').length,1);
  assert.equal(doc.querySelectorAll('[data-cmd="settings"]').length,0);
  assert.match(doc.querySelector('.save-status').textContent,/Chronicle saved/);
  const landing=createCampaignViews(()=>({state:null,screen:'title',settings:{}}));
  const title=documentFor(landing.header()+landing.footer());
  assert.ok(title.querySelector('a[href="#rise"]'));assert.ok(title.querySelector('[data-cmd="credits"]'));
});

test('camp soldier tools have four primary tasks and retain every trainer and honours link on demand',()=>{
  const s=camp(7),doc=documentFor(soldierCampCard(s)),links=doc.querySelectorAll('[data-cmd="soldier-panel"]');
  assert.deepEqual(links.filter(n=>!collapsedAncestor(n)).map(n=>n.dataset.id),['kit','character','company','quartermaster']);
  assert.ok(links.some(n=>n.dataset.id==='decorations'));
  assert.equal(links.filter(n=>n.dataset.id==='trainer').length,5);
  assert.match(doc.getElementById('camp-trainers').textContent,/Rhetor Theon/);
});

test('training and equipment keep actionable prices and comparisons visible while reference stays available',()=>{
  const s=camp(5),before=Game.serialize(s),training=documentFor(characterPanel(s));
  assert.equal(training.querySelectorAll('[data-kind="raise"]').length,8);
  for(const button of training.querySelectorAll('[data-kind="raise"]')){visible(button);assert.match(button.textContent,/\d+ TP/);}
  assert.match(training.querySelector('.attribute-impact').textContent,/Next point:/);
  for(const id of ['known-techniques','completed-courses','training-costs'])assert.equal(training.getElementById(id).open,false);
  assert.equal(training.querySelector('[data-soldier-preview]'),null,'the equipped model belongs in Equipment');
  const selected=s.soldier.pack.find(item=>ITEMS[item.id].slot);assert.ok(selected);
  const kit=documentFor(kitPanel(s,{selected:selected.uid}));
  visible(kit.querySelector('.kit-comparison'));visible(kit.querySelector('[data-kind="wear"]'));
  assert.equal(kit.getElementById('kit-item-actions').open,false);
  assert.equal(kit.getElementById('kit-protection-details').open,false);
  assert.ok(kit.querySelector('[data-soldier-preview]'));
  assert.equal(Game.serialize(s),before);
});

test('company readiness and party membership stay exposed; detailed order controls remain reachable',()=>{
  const s=camp(5),before=Game.serialize(s),doc=documentFor(companyPanel(s));
  for(const checkbox of doc.querySelectorAll('[data-cmd="soldier-party"]'))visible(checkbox);
  const presets=doc.querySelectorAll('[data-kind="orders"]');assert.ok(presets.length>0);
  for(const button of presets)assert.match(collapsedAncestor(button)?.id??'',/^companion-orders-/);
  for(const card of doc.querySelectorAll('.companion-card'))visible(card.querySelector('.orders-summary'));
  assert.equal(Game.serialize(s),before);
});
