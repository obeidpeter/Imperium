import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {playRealtime} from '../scripts/realtime-autoplay.mjs';
import {squadOrderProblem,summarizeSquadOrders} from '../src/core/realtime/squad-orders.js';
import {SQUAD_STANDING} from '../src/data/realtime-squads.js';

// Squad standing orders (guide "Squad standing orders"): set for each deployed
// veteran's squad in the company panel in camp, kept in the chronicle, and
// used by the squad in the next battle; the battle's own orders otherwise.

// The Chapter IV camp, reached by legal commands from New Game (Chapters I–III in real time).
function campFour(){
  const state=G.newGame('Aurelius Marcellus',275,{featureEdition:35,progression:true});
  for(let guard=0;guard<80;guard++){
    const chapter=G.getChapter(state);
    if(state.chapter===4&&state.phase==='camp'){if(!state.decisions[chapter.decision.id])G.choose(state,chapter.decision.options[0].id);return state;}
    if(state.phase==='camp'){
      if(!state.decisions[chapter.decision.id])G.choose(state,chapter.decision.options[0].id);
      if(state.chapter===1&&state.encounterIndex>0&&!state.oath)G.swearOath(state);
      G.startEncounter(state,{controls:'realtime'});
    }else if(state.phase==='encounter'){playRealtime(state);G.commitEncounter(state);}else G.advanceChapter(state);
  }
  throw new Error('never reached Chapter IV');
}

test('a squad order is an action of the squad vocabulary with a target it takes',()=>{
  assert.equal(squadOrderProblem(['hold_line',null]),null);assert.equal(squadOrderProblem(['hold_line','objective']),null);
  assert.ok(squadOrderProblem(['hold_line','hero']),'holding the line takes no target');
  assert.equal(squadOrderProblem(['screen_flank','enemy_archers']),null);assert.equal(squadOrderProblem(['guard_standard','squad:naso']),null);
  assert.ok(squadOrderProblem(['attack_hero_target','squad:naso']),'only Guard the standard names a squad');
  assert.ok(squadOrderProblem(['charge','hero']));assert.ok(squadOrderProblem(['hold_line']));
  for(const preset of Object.values(SQUAD_STANDING.presets))assert.ok(preset.every(slot=>!squadOrderProblem(slot)));
  assert.equal(summarizeSquadOrders([['withdraw_when_broken','hero'],['guard_standard','squad:naso'],['hold_line',null]],{names:{naso:'Naso'}}),
    'Fall back to you when broken; else guard Naso’s squad; else hold the line.');
});

test('a veteran\'s squad keeps the orders set in camp: the battle uses them, a named squad is found, and the chronicle validates them',()=>{
  const state=campFour();
  assert.equal(G.soldierCommand(state,{kind:'squad-orders',companionId:'lucan',preset:'reserve'}).ok,true);
  assert.equal(G.soldierCommand(state,{kind:'squad-orders',companionId:'naso',slots:[['guard_standard','squad:lucan'],['hold_line',null]]}).ok,true);
  // Refusals change nothing.
  const before=JSON.stringify(state.soldier);
  assert.equal(G.soldierCommand(state,{kind:'squad-orders',companionId:'naso',slots:[['guard_standard','squad:naso']]}).ok,false,'not his own squad');
  assert.equal(G.soldierCommand(state,{kind:'squad-orders',companionId:'naso',slots:[]}).ok,false);
  assert.equal(G.soldierCommand(state,{kind:'squad-orders',companionId:'nobody',preset:'reserve'}).ok,false);
  assert.equal(G.soldierCommand(state,{kind:'squad-orders',companionId:'felix',slots:[['hold_line','hero']]}).ok,false);
  assert.equal(JSON.stringify(state.soldier),before);
  // Kept in the chronicle and checked on load.
  const copy=G.deserialize(G.serialize(state));assert.deepEqual(copy.soldier.squadOrders,state.soldier.squadOrders);
  const broken=JSON.parse(G.serialize(state));broken.soldier.squadOrders.naso=[['guard_standard','squad:nobody']];
  assert.throws(()=>G.deserialize(JSON.stringify(broken)),'an unknown squad is refused');
  // The battle: the squads of Lucan's and Naso's tokens carry them (Naso guards the squad Lucan's men form here).
  G.startEncounter(state,{controls:'realtime'});
  const world=G.realtimeWorld(state),units=state.encounter.units.filter(u=>u.side==='ally');
  const squadOf=id=>world.squads.find(q=>q.unitId===units.find(u=>u.veteranId===id)?.id);
  assert.deepEqual(squadOf('lucan').standing,SQUAD_STANDING.presets.reserve.map(s=>[...s]));
  assert.deepEqual(squadOf('naso').standing,[['guard_standard',`squad:${squadOf('lucan').id}`],['hold_line',null]]);
  assert.equal(squadOf('felix').standing[0][0],'withdraw_when_broken','the battle’s own orders for the rest');
  // In the field the orders are not changed.
  assert.equal(G.soldierCommand(state,{kind:'squad-orders',companionId:'lucan',preset:'battle'}).ok,false);
});

test('the battle\'s own orders come back when chosen, and a chronicle that never set any is unchanged',()=>{
  const state=campFour();const before=G.serialize(state);
  assert.equal(state.soldier.squadOrders,undefined);
  G.soldierCommand(state,{kind:'squad-orders',companionId:'felix',preset:'flank_guard'});assert.ok(state.soldier.squadOrders.felix);
  assert.equal(G.soldierCommand(state,{kind:'squad-orders',companionId:'felix',preset:'battle'}).ok,true);
  assert.equal(state.soldier.squadOrders,undefined,'nothing left behind');assert.equal(G.serialize(state),before);
});
