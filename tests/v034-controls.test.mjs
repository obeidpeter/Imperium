import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROL_DEFAULTS,controlBindings,remapControl,controlAction,holdDelay,applyControlLabels,controlPreferences} from '../src/ui/control-preferences.js';
import {createTouchHold} from '../src/ui/touch-hold.js';
import {encounterView} from '../src/ui/encounter-view.js';
import * as Game from '../src/core/game.js';

test('Control rebinding swaps occupied letters without removing or duplicating commands',()=>{
  const before={...CONTROL_DEFAULTS},next=remapControl(before,'undo','N');
  assert.equal(next.undo,'n');assert.equal(next.next,'u');
  assert.equal(controlAction('N',next),'undo');assert.equal(controlAction('U',next),'next');
  assert.equal(new Set(Object.values(next)).size,6);assert.deepEqual(before,CONTROL_DEFAULTS);
  assert.equal(remapControl(next,'unknown','a'),null);assert.equal(remapControl(next,'undo','Escape'),null);
  assert.deepEqual(controlBindings({undo:'n'}),CONTROL_DEFAULTS);
});
test('Control instructions and accessibility shortcuts follow a swap without cascading',()=>{
  const settings={keyBindings:remapControl(CONTROL_DEFAULTS,'undo','N')};
  assert.equal(applyControlLabels('Undo Move (U), key N, N selects, U takes, aria-keyshortcuts="U"',settings),'Undo Move (N), key U, U selects, N takes, aria-keyshortcuts="N"');
  assert.equal(applyControlLabels('Undo Move (U), H for horizon',{}),'Undo Move (U), H for horizon');
  assert.match(controlPreferences(settings),/value="n" selected>N/);
});
test('Touch delay is bounded and malformed stored preferences retain usable controls',()=>{
  assert.equal(holdDelay(undefined),450);assert.equal(holdDelay(0),250);assert.equal(holdDelay(99999),1200);
  assert.deepEqual(controlBindings(null),CONTROL_DEFAULTS);
  assert.equal(controlAction('Escape',{}),null);
});
test('A changed hold delay cancels an old gesture and applies to the next one',()=>{
  const pending=new Map();let id=0,seen=0;
  const hold=createTouchHold(()=>seen++,{timers:{setTimeout(fn,ms){pending.set(++id,{fn,ms});return id;},clearTimeout(key){pending.delete(key);}}});
  hold.down({pointerType:'touch',clientX:1,clientY:1});hold.configure({delay:900});
  assert.equal(pending.size,0);assert.equal(hold.consume(),false);
  hold.down({pointerType:'touch',clientX:1,clientY:1});assert.equal([...pending.values()][0].ms,900);
  [...pending.values()][0].fn();assert.equal(seen,1);hold.up();assert.equal(hold.consume(),true);hold.dispose();
});
test('Real encounter hints follow remapped keys while a player name remains literal',()=>{
  const state=Game.newGame('Lucius (H)',91,{featureEdition:34,progression:true});
  assert.ok(Game.choose(state,Game.getChapter(state).decision.options[0].id).ok);assert.ok(Game.startEncounter(state).ok);
  let keyBindings=remapControl(CONTROL_DEFAULTS,'horizon','r');keyBindings=remapControl(keyBindings,'undo','z');
  const before=Game.serialize(state),html=encounterView({state,selected:'hero',view3D:true,can3D:true,keyBindings});
  assert.match(html,/Lucius \(H\)/);assert.doesNotMatch(html,/Lucius \(R\)/);
  assert.match(html,/R for horizon/);assert.match(html,/R for the horizon/);
  assert.match(html,/Z undoes an uncommitted move/);assert.match(html,/aria-keyshortcuts="R"/);
  assert.equal(Game.serialize(state),before,'Rendering cannot change the campaign or RNG');
});
