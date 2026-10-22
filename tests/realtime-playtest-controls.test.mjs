import test from 'node:test';
import assert from 'node:assert/strict';
import {createArenaWorld} from '../src/core/realtime/arena.js';
import {createShowcaseSession} from '../src/showcase/session.js';
import {targetReadout} from '../src/ui/realtime-target-readout.js';
import {fieldShortcutAllowed} from '../src/ui/realtime-shortcuts.js';
import {DEFAULT_KEYMAP,learnKey,keyLabel} from '../src/ui/action-map.js';

test('a selected enemy is read from current position, health, awareness and ability without changing the world',()=>{
  const w=createArenaWorld(createShowcaseSession().encounter,{seed:275}),h=w.actors.find(a=>a.id===w.controlled),e=w.actors.find(a=>a.side==='enemy'&&!a.hidden);
  const before=JSON.stringify(w),far=targetReadout(w,e.id);
  assert.equal(JSON.stringify(w),before,'a forecast does not spend or change anything');assert.match(far.text,/Health/);
  e.x=h.x+1;e.z=h.z;e.hp=Math.max(1,e.maxHp-5);e.ai??={};e.ai.state='engage';e.ai.notice={[h.id]:100};
  const near=targetReadout(w,e.id);assert.match(near.text,/1 metres/);assert.match(near.text,new RegExp(`${e.hp}/${e.maxHp} Health`));assert.doesNotMatch(near.text,/has not seen you/);
  assert.notEqual(near.text,far.text);
  h.abilities=[...new Set([...(h.abilities??[]),'throw_pilum'])];h.ammo.pilum=0;
  const pilum=targetReadout(w,e.id,{abilityId:'throw_pilum'});assert.match(pilum.text,/pilum/i);assert.doesNotMatch(pilum.text,/Strike:/);
});

test('a target falling, being healed or disappearing produces current facts; no silent retarget',()=>{
  const w=createArenaWorld(createShowcaseSession().encounter,{seed:4}),e=w.actors.find(a=>a.side==='enemy');
  e.alive=false;e.loot=[];assert.equal(targetReadout(w,e.id).valid,false);assert.match(targetReadout(w,e.id).text,/fallen.*Target cleared/);
  e.loot=['pilum'];assert.equal(targetReadout(w,e.id).valid,true);assert.match(targetReadout(w,e.id).text,/Enter to search/);
  assert.match(targetReadout(w,e.id,{keymap:{...DEFAULT_KEYMAP,act_on_target:['KeyZ']}}).text,/Z to search/);
  e.hidden=true;assert.equal(targetReadout(w,e.id).valid,false);
  const h=w.actors.find(a=>a.id===w.controlled);h.hp=h.maxHp-2;assert.match(targetReadout(w,h.id,{abilityId:'bind_wounds'}).text,new RegExp(`${h.hp}/${h.maxHp}`));
  h.hp=h.maxHp;assert.match(targetReadout(w,h.id,{abilityId:'bind_wounds'}).text,new RegExp(`${h.maxHp}/${h.maxHp}`));
});

test('Pause works with a command-list button focused, while native controls and dialogs keep their keys',()=>{
  const canvas={},button={closest:()=>null},input={closest:()=>({})},outside={closest:()=>null},root={contains:t=>t===button||t===input};
  const allowed=(code,target,extra={})=>fieldShortcutAllowed({code,target,...extra},{canvas,root,modalOpen:extra.modalOpen});
  assert.equal(allowed('KeyP',canvas),true);assert.equal(allowed('KeyP',button),true);assert.equal(allowed('KeyT',button),true);
  for(const code of ['Enter','Space','ArrowDown','Home','Tab'])assert.equal(allowed(code,button),false,code);
  assert.equal(allowed('ArrowDown',canvas),true);assert.equal(allowed('KeyP',input),false);
  assert.equal(allowed('KeyP',button,{modalOpen:true}),false);assert.equal(allowed('KeyP',outside),false);
  assert.equal(allowed('KeyP',button,{ctrlKey:true}),false);assert.equal(allowed('KeyP',button,{defaultPrevented:true}),false);
});

test('pressing Space never erases its readable shortcut label',()=>{
  learnKey({code:'Space',key:' '});assert.equal(keyLabel('Space'),'Space');
});
