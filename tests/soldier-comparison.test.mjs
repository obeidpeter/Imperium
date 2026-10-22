import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoldier,packAdd,wear,raiseAttribute} from '../src/core/soldier.js';
import {equipmentComparison,attributeImprovement} from '../src/ui/soldier-comparison.js';
import {soldierValues,kitPanel,characterPanel} from '../src/ui/soldier-views.js';

const state=()=>({phase:'camp',chapter:5,name:'Test soldier',soldier:createSoldier(),company:[],log:[],completed:[]});
test('equipment comparison agrees with equipping through the actual rules and does not change the save',()=>{
  const s=state();s.soldier.base.str=16;const item=packAdd(s.soldier,'squamata'),before=JSON.stringify(s);
  const preview=equipmentComparison(s.soldier,item.id);assert.equal(JSON.stringify(s),before);assert.equal(preview.item,'Lorica squamata');
  assert.ok(preview.rows.some(r=>r.label==='Restriction'&&r.after>r.before));
  assert.ok(preview.rows.some(r=>r.label==='pierce absorption'&&r.after>r.before));
  assert.equal(wear(s,item.uid).ok,true);assert.equal(soldierValues(s).restriction,preview.rows.find(r=>r.label==='Restriction').after);
  assert.equal(equipmentComparison(s.soldier,'bandage'),null,'consumables have no worn preview');
});
test('training shows the next real threshold and keeps the state unchanged until Raise is confirmed',()=>{
  const s=state();s.soldier.tp=100;const before=JSON.stringify(s),rows=attributeImprovement(s,'combat');
  assert.equal(JSON.stringify(s),before);assert.ok(rows.some(r=>r.label==='Attack'&&r.after===r.before+1));
  assert.ok(rows.some(r=>r.label==='Defence'&&r.after===r.before+1));assert.equal(raiseAttribute(s,'combat').ok,true);
  assert.equal(soldierValues(s).attack,rows.find(r=>r.label==='Attack').after);
  assert.match(characterPanel(s),/Next point:/);assert.match(kitPanel(s),/data-soldier-preview/);
});
