import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_KEYMAP,FIXED_ACTIONS,KEY_GROUPS,eventBinding,firstKeyLabel,keymapChanges,keymapFrom,keymapProblems,remapAction} from '../src/ui/action-map.js';
import {POINTER_SETTINGS,controlPreferences,keyPreferences} from '../src/ui/control-preferences.js';
import {SETTING_TOGGLES,defaultSettings,loadSettings} from '../src/ui/settings.js';
import {createPanels} from '../src/ui/panels.js';
import {defeatHelp,fieldMarkup} from '../src/ui/realtime-view.js';
import {GUIDE_HELP} from '../src/data/guide-help.js';
import {guideHelpModule,readGuide} from '../scripts/guide-help.mjs';
import {guideHelpView} from '../src/ui/guide-help-view.js';
import * as G from '../src/core/game.js';

// Phase 4's settings (build brief §4, §7; guide "Settings reference" and "Changing the
// controls"): every remappable key, the pointer's habits and readability, and the
// in-game Controls & rules generated from the guide.

test('the player’s key map keeps legal changes, and falls back to the defaults whole when the stored changes are damaged',()=>{
  assert.deepEqual(keymapFrom(),Object.fromEntries(Object.entries(DEFAULT_KEYMAP).map(([a,k])=>[a,[...k]])));
  const mine=keymapFrom({pause:['KeyK'],war_cry:['Shift+KeyB']});assert.deepEqual(mine.pause,['KeyK']);assert.deepEqual(mine.war_cry,['Shift+KeyB']);
  assert.deepEqual(keymapChanges(mine),{pause:['KeyK'],war_cry:['Shift+KeyB']});assert.deepEqual(keymapFrom(keymapChanges(mine)),mine,'the changes round-trip');
  for(const damaged of [{pause:['F5']},{pause:['Control+KeyK']},{act_on_target:['KeyK']},{pause:['KeyT']},{pause:'KeyK'},{pause:[]},{nonsense:['KeyK']},[1,2]])
    assert.deepEqual(keymapFrom(damaged),keymapFrom(),JSON.stringify(damaged));
  assert.deepEqual(keymapProblems(keymapFrom()),[]);
  // Settings keep only the changes, and repair damaged ones.
  assert.deepEqual(defaultSettings().realtimeKeys,{});
  assert.deepEqual(loadSettings(JSON.stringify({realtimeKeys:{pause:['KeyK']}})).realtimeKeys,{pause:['KeyK']});
  assert.deepEqual(loadSettings(JSON.stringify({realtimeKeys:{pause:['F12']}})).realtimeKeys,{});
});

test('41: remapping swaps a key already in use, refuses the browser’s keys and the fixed ones, and Ctrl, Cmd or Alt never bind',()=>{
  const map=keymapFrom(),r=remapAction(map,'pause','KeyT');
  assert.deepEqual(r.keymap.pause,['KeyT','Pause']);assert.deepEqual(r.keymap.target_next_enemy,['KeyP'],'the two commands swap');
  for(const key of ['F1','F5','F11','F12','Tab','Escape','Enter','ArrowUp'])assert.ok(remapAction(map,'pause',key).problem,key);
  assert.ok(remapAction(map,'act_on_target','KeyK').problem,'Enter keeps its meaning');assert.ok(remapAction(map,'pause','Escape').problem);
  assert.equal(eventBinding({code:'KeyK',ctrlKey:true}),null);assert.equal(eventBinding({code:'KeyK',altKey:true}),null);assert.equal(eventBinding({code:'KeyK',metaKey:true}),null);
  assert.equal(eventBinding({code:'KeyK',shiftKey:true}),'Shift+KeyK');
});

test('Settings → Controls lists every remappable action once with Change, the pointer settings and labels',()=>{
  const listed=KEY_GROUPS.flatMap(([,rows])=>rows.map(([a])=>a));
  assert.equal(new Set(listed).size,listed.length,'each action once');
  assert.deepEqual([...listed].sort(),Object.keys(DEFAULT_KEYMAP).filter(a=>!FIXED_ACTIONS.includes(a)).sort(),'every remappable action, none fixed');
  const map=keymapFrom({pause:['KeyK','Pause']}),html=keyPreferences(map);
  assert.equal((html.match(/data-cmd="rebind"/g)??[]).length,listed.length);assert.match(html,/data-action="pause"><span>Pause and resume<\/span><kbd>K or Pause<\/kbd>/);
  assert.match(html,/data-cmd="reset-keys"/);for(const fixed of FIXED_ACTIONS)assert.ok(!html.includes(`data-id="${fixed}"`),fixed);
  const panel=controlPreferences(defaultSettings(),{keymap:map});
  for(const [,key]of POINTER_SETTINGS)assert.match(panel,new RegExp(`data-rt-setting="${key}"`));assert.match(panel,/data-rt-setting="labelsAlways"/);
  assert.ok(!controlPreferences(defaultSettings()).includes('data-cmd="rebind"'),'the 0.38 board keeps its own shortcuts');
  const s=defaultSettings();assert.deepEqual([s.drawToAttack,s.keepFighting,s.quickCast,s.holdToMove,s.edgeScroll,s.swapButtons,s.labelsAlways,s.objectiveMarkers,s.floatingNumbers],
    [true,false,false,true,false,false,false,true,true],'the guide’s defaults');
});

test('the settings follow the controls: real time has the guide’s names and its own settings, the 0.38 board keeps its own',()=>{
  const panel=changes=>{let html='';createPanels(()=>({settings:{...loadSettings(null),...changes},keymap:keymapFrom(),showModal:(_,body)=>{html=body;}})).showSettings();return html;};
  const turns=panel({}),realtime=panel({controlsModel:'realtime'});
  for(const id of Object.keys(SETTING_TOGGLES))for(const html of [turns,realtime])assert.match(html,new RegExp(`<input id="${id}" type="checkbox"`),id);
  for(const id of ['game-speed','pause-sighted','objective-markers','floating-numbers'])assert.ok(realtime.includes(`id="${id}"`)&&!turns.includes(`id="${id}"`),id);
  for(const html of [turns,realtime]){assert.match(html,/<span>Combat close-ups<small/);assert.match(html,/<span>Learning tips<small/);}
  for(const html of [turns,realtime])assert.match(html,/<span>Touch hold delay<small/);
  // Real time has no moves to confirm: Confirm moves sits with the turn-based board's shortcuts.
  assert.match(realtime,/<details class="board-shortcuts"[^>]*>(?:(?!<\/details>)[^])*id="confirm-moves"/);assert.ok(!turns.includes('board-shortcuts'));
});

test('the field’s hints and buttons name the player’s keys',()=>{
  // Chapter I's walkable camp, as New Game opens it.
  const state=G.newGame('Aurelius Marcellus',275,{featureEdition:35,progression:true});
  const map=keymapFrom({pause:['KeyK','Pause'],interact_nearest:['KeyR'],panel_company:['KeyE']}),html=fieldMarkup({state,keymap:map,kind:'camp'});
  assert.match(html,/data-role="pauseButton"[^>]*aria-keyshortcuts="K or Pause"/);assert.match(html,/K or Pause pauses/);assert.match(html,/R uses what is nearest/);
  assert.ok(!/\bE uses what is nearest/.test(html));
  // A message names one key: the first the player has set for it.
  for(const [action,key] of [['pause','P'],['walk_toggle','W'],['yield_floor','Y'],['party_prev','['],['party_next',']'],['combat_toggle','Space']])assert.equal(firstKeyLabel(action),key,action);
  assert.equal(firstKeyLabel('pause',map),'K');assert.equal(firstKeyLabel('target_next_enemy',keymapFrom({target_next_enemy:['KeyK']})),'K');
  const lost={actors:[],log:[],heroId:'hero'};assert.match(defeatHelp(lost),/^Pause \(P\) when/);assert.match(defeatHelp(lost,map),/^Pause \(K\) when/);
});

test('Controls & rules is the player guide, generated from docs/player-guide-0.40.md, with the player’s keys in its key tables',async()=>{
  assert.equal(guideHelpModule(await readGuide()),(await import('node:fs')).readFileSync(new URL('../src/data/guide-help.js',import.meta.url),'utf8'),
    'src/data/guide-help.js is in step with the guide: run node scripts/guide-help.mjs');
  assert.equal(GUIDE_HELP.version,'0.40.0');
  assert.deepEqual(GUIDE_HELP.pages.map(p=>p.title),['Getting started','Quick reference','The campaign','Controls','Your soldier','Battles','Companions and command',
    'Political Contests','Preparing for battle','Meters, obligations and the finale','Defeat, retry and saving','Settings reference','Accessibility','What changed in 0.40']);
  for(const p of GUIDE_HELP.pages){assert.ok(p.html.length>200,p.id);assert.ok(!/\*\*|<u>|\\\[/.test(p.html),`${p.id}: no Markdown left`);}
  const actions=[...GUIDE_HELP.pages.find(p=>p.id==='controls').html.matchAll(/data-actions="([^"]+)"/g)].flatMap(m=>m[1].split(','));
  assert.ok(actions.length>=30);for(const a of actions)assert.ok(DEFAULT_KEYMAP[a],a);
  const plain=guideHelpView(GUIDE_HELP,{page:'controls'}),mine=guideHelpView(GUIDE_HELP,{page:'controls',keymap:keymapFrom({pause:['KeyK','Pause']})});
  assert.ok(!plain.includes('help-keys changed'));assert.match(mine,/<span class="help-keys changed" data-actions="pause"><strong>K or Pause<\/strong> <small>\(by default <strong>P<\/strong> or Pause\)<\/small>/);
  assert.match(guideHelpView(GUIDE_HELP,{page:'keyboard'}),/<h3 id="guide-page-title" tabindex="-1">Controls<\/h3>/,'a section opens its chapter');
});
