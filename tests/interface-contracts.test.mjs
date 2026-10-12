import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Game from '../src/core/game.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {createPanels} from '../src/ui/panels.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const checkpoint=id=>Game.deserialize(Game.serialize(fixture.scenes.find(scene=>scene.id===id).state));
function presenter(state=Game.newGame('<Aurelius & Lucius>'),extra={}){
  const shown=[],context={state,screen:'game',settings:{quality:'balanced',textScale:1,reducedMotion:true},saving:false,lastSaved:'',saveProblem:'',saveConflict:false,offline:false,currentChapterOffline:false,offlineProgress:'',...extra};
  const views=createCampaignViews(()=>context);Object.assign(context,{showModal:(title,html)=>shown.push({title,html}),meters:views.meters,requirements:views.requirements});
  return {context,views,panels:createPanels(()=>context),shown,html:()=>shown.at(-1).html};
}
const commands=html=>[...html.matchAll(/data-cmd="([^"]+)"/g)].map(match=>match[1]);

test('Landing offers the correct first action, valid section targets and three genuinely deferred optional images',()=>{
  const p=presenter(null,{screen:'title'}),fresh=p.views.titleView();
  assert.match(fresh,/<button class="primary" data-cmd="new">/);assert.ok(!commands(fresh).includes('continue'));
  const ids=[...fresh.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);
  for(const [,target]of fresh.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(target),`Missing destination ${target}`);
  const optional=[...fresh.matchAll(/<img\b[^>]*\bdata-src="[^"]+"[^>]*>/g)].map(match=>match[0]);assert.equal(optional.length,3);
  for(const image of optional){assert.ok(!/\ssrc=/.test(image));assert.match(image,/\bwidth="\d+"/);assert.match(image,/\bheight="\d+"/);assert.match(image,/\balt="[^"]+"/);}
  assert.match(fresh,/Actual gameplay/);assert.match(fresh,/Illustrative key art/);assert.ok(!fresh.includes('No downloads required'));
  p.context.state=Game.newGame('<Aurelius>');const before=Game.serialize(p.context.state),returning=p.views.titleView();assert.match(returning,/<button class="primary" data-cmd="continue">/);assert.ok(!returning.includes('<Aurelius>'));assert.equal(Game.serialize(p.context.state),before);
});

test('Campaign navigation exposes earned progression without chapter-jump commands',()=>{
  for(const state of [null,Game.newGame(),checkpoint('camp-11')]){
    const p=presenter(state);p.panels.showMap();const html=p.html(),entries=[...html.matchAll(/<li class="chapter-entry[^>]*data-status="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(entries.length,12);assert.equal(entries.filter(status=>status==='complete').length,state?.completed.length||0);assert.equal(entries.filter(status=>status==='current').length,state?1:0);
    assert.equal(entries.filter(status=>status==='locked').length,state?12-state.chapter:11);assert.ok(commands(html).every(cmd=>['continue','new'].includes(cmd)));
    p.panels.showMap(12);assert.match(p.html(),/Required service/);assert.match(p.html(),/Senator status/);
  }
});

test('All informational and navigation panels leave legal campaign checkpoints unchanged',()=>{
  for(const state of [Game.newGame(),checkpoint('camp-10'),checkpoint('ending')]){
    const p=presenter(state),before=Game.serialize(state);
    for(const method of ['showNew','showMap','showLedger','showSettings','showHelp','showHistory','showJournal','showCharacter','showRestore','showNavigation','showCredits','showPrivacy']){
      p.panels[method]();assert.ok(p.html().length>40,method);assert.equal(Game.serialize(state),before,`${method} mutated chapter ${state.chapter}`);
    }
  }
});

test('New and restore forms retain explicit labels, bounded names and validation before replacement',()=>{
  const p=presenter();p.panels.showNew();let html=p.html();assert.match(html,/<label for="name-input">/);assert.match(html,/<input[^>]*id="name-input"[^>]*maxlength="40"/);assert.ok(commands(html).includes('export'));assert.ok(!html.includes('<Aurelius & Lucius>'));
  p.panels.showRestore();html=p.html();for(const id of ['restore-file','restore-code']){assert.ok(html.includes(`for="${id}"`));assert.ok(html.includes(`id="${id}"`));}
  assert.ok(commands(html).includes('import-code'));assert.ok(!commands(html).includes('confirm-import'));
  p.panels.showImportVerified(checkpoint('camp-11'));assert.ok(commands(p.html()).includes('confirm-import'));assert.match(p.html(),/replace the current local campaign/);
});

test('Save status never reports an older successful save while a new save is pending',()=>{
  const p=presenter(undefined,{saving:true,lastSaved:'12:05',saveProblem:'Save blocked <elsewhere>',saveConflict:true,currentChapterOffline:true});let html=p.views.header();
  assert.match(html,/Saving…/);assert.ok(!html.includes('Chronicle saved'));assert.match(html,/Save blocked &lt;elsewhere&gt;/);assert.ok(commands(html).includes('export'));assert.ok(commands(html).includes('takeover'));assert.match(html,/This chapter is ready offline/);assert.ok(!html.includes('All chapters available offline'));
  p.context.saving=false;p.context.offline=true;html=p.views.header();assert.match(html,/Chronicle saved/);assert.match(html,/All chapters available offline/);
});

test('Recovery is inspect-first and carries the expected revision into its explicit confirmation flow',()=>{
  const p=presenter(),entry={id:'record-1',name:'<Older & saved>',rank:'Tiro',chapter:1,phase:'camp',savedAt:0,currentSequence:42};
  p.panels.showRecoveryRecords([entry]);assert.deepEqual(commands(p.html()).filter(cmd=>cmd.includes('recovery')),['preview-recovery']);assert.match(p.html(),/data-id="record-1" data-sequence="42"/);assert.match(p.html(),/&lt;Older &amp; saved&gt;/);
  p.panels.showRecoveryVerified(checkpoint('camp-10'));assert.ok(commands(p.html()).includes('confirm-recovery'));assert.match(p.html(),/another tab changes the save/);
  p.panels.showTakeover();assert.ok(commands(p.html()).includes('confirm-takeover'));assert.ok(commands(p.html()).includes('export'));
});

test('Authored choices stay actionable in camp and remain inert in the landing example',()=>{
  const state=Game.newGame(),p=presenter(state),before=Game.serialize(state),camp=p.views.camp(),landing=p.views.titleView();
  for(const option of CHAPTERS[0].decision.options)assert.ok(camp.includes(`data-cmd="choose" data-id="${option.id}"`));
  assert.ok(!commands(landing).includes('choose'));assert.equal(Game.serialize(state),before);
  assert.equal(Game.choose(state,CHAPTERS[0].decision.options[0].id).ok,true);const chosen=Game.serialize(state),recorded=p.views.camp();assert.ok(!commands(recorded).includes('choose'));assert.equal(Game.serialize(state),chosen);
});
