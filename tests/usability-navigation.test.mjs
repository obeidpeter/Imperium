import test from 'node:test';
import assert from 'node:assert/strict';
import {createPanels} from '../src/ui/panels.js';
import {defaultSettings} from '../src/ui/settings.js';
import {keymapFrom} from '../src/ui/action-map.js';
import {GUIDE_HELP} from '../src/data/guide-help.js';
import {searchHelp,helpSearchResults,guideHelpView} from '../src/ui/guide-help-view.js';
import * as Game from '../src/core/game.js';

function panels(){
  let body='',title='',options;const state=Game.newGame('Aurelius',275,{featureEdition:35,progression:true});
  const api=createPanels(()=>({state,screen:'game',settings:{...defaultSettings(),controlsModel:'realtime'},keymap:keymapFrom(),devMenu:true,
    showModal:(heading,html,opts)=>{title=heading;body=html;options=opts;},meters:()=>'',requirements:()=>''}));
  return {api,state,get body(){return body;},get title(){return title;},get options(){return options;}};
}

test('settings show one category, preserve every preference and return to the selected category',()=>{
  const p=panels(),before=Game.serialize(p.state);
  for(const category of ['general','controls','graphics','audio','saves']){
    p.api.showSettings(category);
    const pages=[...p.body.matchAll(/<section id="settings-([^"]+)" data-settings-page="[^"]+" aria-labelledby="[^"]+"( hidden)?>/g)];
    assert.equal(pages.length,5);assert.deepEqual(pages.filter(m=>!m[2]).map(m=>m[1]),[category]);
    assert.equal(p.options.menu,true,'Settings always stops battle time');
    const ids=[...p.body.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'No duplicate field or disclosure IDs');
    for(const id of ['text-size','graphics-quality','battle-view','audio-setting','game-speed','pause-hurt','controls-model'])assert.ok(ids.includes(id),id);
  }
  p.api.showSettings();assert.match(p.body,/data-settings-page="saves" aria-labelledby="settings-saves-title">/);
  assert.equal(Game.serialize(p.state),before);
});

test('main navigation is short and uses distinct Soldier, Campaign and More groups',()=>{
  const p=panels(),before=Game.serialize(p.state);p.api.showNavigation();
  assert.equal(p.title,'Menu');assert.equal(p.options.menu,true);assert.equal(p.options.back,null);
  assert.equal([...p.body.matchAll(/<button /g)].length,7);
  p.api.showNavigation('soldier');assert.ok([...p.body.matchAll(/<button /g)].length<=4);assert.equal(p.options.back,'menu');
  p.api.showNavigation('campaign');assert.match(p.body,/Career record/);assert.match(p.body,/Obligations/);
  p.api.showNavigation('about');assert.match(p.body,/Historical notes/);assert.equal(Game.serialize(p.state),before);
});

test('help search finds actionable guide topics, handles empty results and escapes snippets',()=>{
  assert.ok(searchHelp(GUIDE_HELP,'bandage').some(p=>p.id==='battles'));
  assert.ok(searchHelp(GUIDE_HELP,'save').some(p=>p.id==='defeat-retry-and-saving'));
  assert.deepEqual(searchHelp(GUIDE_HELP,'  '),[]);
  assert.deepEqual(searchHelp(GUIDE_HELP,'noSuchTopic190284'),[]);
  assert.match(helpSearchResults(GUIDE_HELP,'noSuchTopic190284'),/Try “save”/);
  assert.ok(!helpSearchResults({pages:[{id:'x',title:'<unsafe>',html:'<p>safe & text</p>'}]},'safe').includes('<unsafe>'));
});

test('help starts with three actions and keeps the full reference optional',()=>{
  const html=guideHelpView(GUIDE_HELP,{keymap:keymapFrom({pause:['KeyK']})});
  assert.match(html,/Start with these three actions/);assert.match(html,/<kbd>K<\/kbd>/);
  assert.match(html,/<details class="guide-index">/);assert.ok(!html.includes('class="guide-page"'));
  const topic=guideHelpView(GUIDE_HELP,{page:'battles'});assert.match(topic,/class="guide-page"/);assert.match(topic,/Help overview/);
});

test('rebound keys are distinguished from defaults in reference prose without cluttering ordinary help',()=>{
  const keymap=keymapFrom({pause:['KeyK']});
  const reference=guideHelpView(GUIDE_HELP,{page:'getting-started',keymap});
  assert.match(reference,/press <strong>P<\/strong>/,'The authored reference still names the default Pause key');
  assert.match(reference,/Shortcuts changed\. Key tables show your keys; other reference text uses defaults/);
  assert.match(reference,/data-cmd="settings-section" data-id="controls">Settings → Controls<\/button>/);
  assert.ok(!guideHelpView(GUIDE_HELP,{page:'getting-started'}).includes('help-key-note'),'Default bindings need no warning');
  const overview=guideHelpView(GUIDE_HELP,{keymap});
  assert.ok(!overview.includes('help-key-note'),'The short overview already uses current bindings');
  assert.match(overview,/<kbd>K<\/kbd>/);
});
