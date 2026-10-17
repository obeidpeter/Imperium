import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {snapshotEncounter} from '../src/ui/motion.js';
import {buildEncounterTimeline} from '../src/ui/animation-timeline.js';
import {retimeStageTimeline,combatCues} from '../src/showcase/combat-presentation.js';

test('Legally earned Guard, Inspire and Volley produce specific gestures; a volley has one shot whose arrival matches its hit and sound',()=>{
  const checked=new Set();
  const route=runProgressionCampaign({onEncounter(original){
    if(original.encounter.kind!=='battle')return;
    for(const unit of original.encounter.units)for(const action of Game.getActions(original,unit.id).filter(a=>['guard','inspire','volley'].includes(a)&&!checked.has(a))){
      const state=Game.deserialize(Game.serialize(original));let target=Game.getTargets(state,unit.id,action)[0];
      // The ranged veteran can begin beyond bow range. Advance only through
      // legal end-turn commands on the detached checkpoint until foes close.
      for(let round=0;!target&&round<3&&state.encounter.status==='active';round++){assert.ok(Game.endTurn(state).ok);target=Game.getTargets(state,unit.id,action)[0];}
      if(!target||state.encounter.status!=='active')continue;
      const before=snapshotEncounter(state.encounter),command={unitId:unit.id,action,x:target.x,y:target.y,targetId:target.unitId};assert.ok(Game.act(state,command).ok);
      const after=snapshotEncounter(state.encounter),unchanged=Game.serialize(state),timeline=retimeStageTimeline(buildEncounterTimeline(before,after,{command}));assert.equal(Game.serialize(state),unchanged);
      const track=timeline.tracks.find(t=>t.unitId===unit.id&&t.action===action);assert.equal(track.pose,{guard:'brace',inspire:'rally',volley:'throw'}[action]);
      if(action==='volley'){assert.equal(timeline.tracks.filter(t=>t.unitId===unit.id&&t.pose==='throw').length,1,'The explicit volley and its committed hit log cannot create duplicate attacks.');const shot=timeline.effects.find(e=>e.type==='projectile'),hit=timeline.tracks.find(t=>t.unitId===target.unitId&&['hit','retreat'].includes(t.pose));assert.equal(shot.projectile,'arrow');assert.equal(shot.start+shot.duration,hit.start);assert.ok(combatCues(timeline).some(c=>c.kind==='bow'&&c.time===shot.start));}
      checked.add(action);
    }
  }});
  assert.equal(route.rank,'Augustus');assert.deepEqual([...checked].sort(),['guard','inspire','volley']);
});
