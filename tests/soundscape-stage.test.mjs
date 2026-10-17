import test from 'node:test';
import assert from 'node:assert/strict';
import {BattleStage} from '../src/showcase/stage.js';

test('Interrupting a stage stops combat tails, while idle renders and natural completion retain the soundtrack',()=>{
  const stage=Object.create(BattleStage.prototype);let stops=0,settled=0,resolved=0;
  Object.assign(stage,{sound:{stop(){stops++;}},encounter:Object.freeze({id:'committed-state'}),projectiles:[],sparkClouds:[],effectRings:[],actors:new Map(),sync(value){assert.equal(value,stage.encounter);settled++;},animation:{resolve(){resolved++;}}});
  stage.finishMotion();assert.equal(stops,1);assert.equal(settled,1);assert.equal(resolved,1);
  stage.finishMotion();assert.equal(stops,1,'An ordinary idle render must not repeatedly interrupt audio.');
  stage.animation={resolve(){resolved++;}};stage.finishMotion(false);assert.equal(stops,1,'Natural action completion lets short combat tails finish.');assert.equal(resolved,2);
  stage.setPaused(true);assert.equal(stops,2,'A modal pauses any remaining combat tail even after the animation ended.');
});
