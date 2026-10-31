import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,queueCommand,worldHash} from '../src/core/realtime/simulation.js';
import {createSquadControl} from '../src/showcase/squad-control.js';
import {DEFAULT_KEYMAP,remapAction,ariaKeyShortcuts,keyLabel} from '../src/ui/action-map.js';
import {ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {ARENA} from '../src/data/realtime-rules.js';
import {Document} from './mini-dom.mjs';

// Labelled field: exercise the actual command-card controller in a small DOM,
// including selection, remapped labels and the button's legal command dispatch.
function setup(t,keymap=DEFAULT_KEYMAP){
  const doc=new Document(),previous=globalThis.document;globalThis.document=doc;
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  const w=createWorld({seed:5,chapter:9,command:6,
    map:{id:'card-accessibility',width:40,height:24,terrain:Array.from({length:24},()=>Array(40).fill('grass'))},
    actors:[{id:'hero',name:'Hero',side:'player',kit:ARENA.hero.kit,at:[6,30],face:[1,0]}],
    squads:[
      {id:'foot',name:'Infantry',side:'ally',role:'infantry',strength:16,maxStrength:16,at:[14,30],face:[1,0],member:ROMAN_SQUADS.infantry},
      {id:'horse',name:'Cavalry',side:'ally',role:'cavalry',strength:16,maxStrength:16,at:[14,40],face:[1,0],member:ROMAN_SQUADS.cavalry},
      {id:'enemy',name:'Enemy horse',side:'enemy',role:'cavalry',strength:16,maxStrength:16,at:[55,40],face:[-1,0],member:ROMAN_SQUADS.cavalry}
    ]});
  const dom={commandCard:doc.createElement('div'),abilityBar:doc.createElement('div'),clearButton:doc.createElement('button')},canvas=doc.createElement('canvas');
  dom.commandCard.setAttribute('role','toolbar');doc.body.append(dom.commandCard,dom.abilityBar,dom.clearButton,canvas);
  const messages=[],commands=[];
  const control=createSquadControl({world:()=>w,dom,keymap,canvas,presenter:()=>null,say:text=>messages.push(text),
    issue:command=>{commands.push(command);return queueCommand(w,command);}});
  return {w,dom,canvas,control,messages,commands};
}

test('the squad toolbar announces the orders shown for infantry, cavalry and a cleared selection',t=>{
  const {w,dom,control,messages}=setup(t),before=worldHash(w);
  control.select({squadId:'foot'});
  assert.equal(dom.commandCard.hidden,false);
  assert.equal(dom.commandCard.getAttribute('aria-label'),'Orders for the selected squads (keys: 1 to 7)');
  assert.equal(dom.commandCard.children.length,7);
  assert.match(messages.at(-1),/card keys: 1 to 7\./);
  assert.equal(dom.commandCard.querySelector('[data-order="charge"]'),null);
  control.select({squadId:'horse'});
  assert.equal(dom.commandCard.children.length,9);
  assert.equal(dom.commandCard.getAttribute('aria-label'),'Orders for the selected squads (keys: 1 to 9)');
  assert.match(messages.at(-1),/card keys: 1 to 9\./);
  assert.equal(dom.commandCard.querySelector('[data-order="charge"]').getAttribute('aria-keyshortcuts'),'8');
  assert.equal(dom.commandCard.querySelector('[data-order="feigned_retreat"]').getAttribute('aria-keyshortcuts'),'9');
  control.select({squadId:'foot'});
  assert.equal(dom.commandCard.children.length,7,'cavalry keys disappear from the next infantry selection');
  control.clear();assert.equal(dom.commandCard.hidden,true);assert.equal(messages.at(-1),'Selection cleared.');
  assert.equal(worldHash(w),before,'reading and selecting the card never changes simulation state');
});

test('the command card uses remapped keys in visible labels, accessibility and selection feedback',t=>{
  let keymap=remapAction(DEFAULT_KEYMAP,'ability_8','KeyK').keymap;
  keymap=remapAction(keymap,'ability_9','KeyD').keymap;
  keymap.ability_8.push('Shift+KeyK');
  const {dom,control,messages,commands,canvas}=setup(t,keymap);
  control.select({squadId:'horse'});
  const charge=dom.commandCard.querySelector('[data-order="charge"]'),retreat=dom.commandCard.querySelector('[data-order="feigned_retreat"]');
  assert.equal(charge.querySelector('kbd').textContent,'K or Shift+K');
  assert.equal(charge.getAttribute('aria-keyshortcuts'),'K Shift+K','ARIA separates alternate shortcuts with spaces');
  assert.equal(retreat.querySelector('kbd').textContent,'D');assert.equal(retreat.getAttribute('aria-keyshortcuts'),'D');
  assert.match(dom.commandCard.getAttribute('aria-label'),/7, K or Shift\+K, D\)/);
  assert.match(messages.at(-1),/7, K or Shift\+K, D\./);
  charge.dispatchEvent(new Event('click'));
  assert.equal(commands.at(-1).payload.order.kind,'charge','display labels never change the button’s order slot');
  assert.deepEqual(commands.at(-1).payload.squads,['horse']);
  assert.equal(globalThis.document.activeElement,canvas);
});

test('ARIA shortcut tokens keep numpad and punctuation remaps separate from human labels',t=>{
  assert.equal(ariaKeyShortcuts('ability_8'),'8');assert.equal(ariaKeyShortcuts('select_squad_3'),'Shift+3');
  for(const [binding,expected]of [['KeyK','K'],['Shift+KeyK','Shift+K'],['NumpadAdd','Plus'],['Shift+NumpadAdd','Shift+Plus'],
    ['NumpadSubtract','-'],['Numpad1','1'],['Equal','='],['Shift+Equal','Shift+='],['Minus','-'],['Semicolon',';'],['Space','Space']]){
    assert.equal(ariaKeyShortcuts('ability_8',{ability_8:[binding]}),expected,binding);
  }
  assert.equal(ariaKeyShortcuts('cancel_or_menu'),'Escape');assert.equal(ariaKeyShortcuts('move_up'),'ArrowUp');
  assert.equal(ariaKeyShortcuts('ability_8',{ability_8:['ShiftLeft']}),'','ARIA cannot encode a modifier-only shortcut');
  assert.equal(keyLabel('NumpadAdd'),'Num +','Visible labels retain their useful numpad distinction');assert.equal(keyLabel('Equal'),'+');
  const keymap=remapAction(DEFAULT_KEYMAP,'ability_8','NumpadAdd').keymap;keymap.ability_8.push('Shift+NumpadAdd');
  const {dom,control}=setup(t,keymap);control.select({squadId:'horse'});
  const charge=dom.commandCard.querySelector('[data-order="charge"]');
  assert.equal(charge.querySelector('kbd').textContent,'Num + or Shift+Num +');assert.equal(charge.getAttribute('aria-keyshortcuts'),'Plus Shift+Plus');
});
