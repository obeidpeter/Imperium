import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {BattleStage,STAGE_QUALITY} from '../src/showcase/stage.js';

globalThis.devicePixelRatio??=1;

// A stage built at one tier, with only what applyQuality touches.
function builtStage(quality){
  const stage=Object.create(BattleStage.prototype),calls=[];
  Object.assign(stage,{quality,builtQuality:quality,calls,
    renderer:{setPixelRatio:ratio=>calls.push(['ratio',ratio])},
    sun:{shadow:{mapSize:new T.Vector2(STAGE_QUALITY[quality].shadow,STAGE_QUALITY[quality].shadow),map:null}},
    resolutionBudget:{scale:1,reset:fps=>calls.push(['budget',fps])},cadence:{reset:fps=>calls.push(['cadence',fps])},gpuTimer:{reset(){}},
    environment:{dispose:()=>calls.push(['environment disposed'])},compositor:{setQuality:tier=>calls.push(['compositor',tier])},resize(){}});
  return stage;
}

test('An automatic quality change follows at once in frame rate, resolution and shadows, without rebuilding the world',()=>{
  const stage=builtStage('balanced');
  stage.applyQuality('performance',{world:false});
  assert.equal(stage.quality,'performance');assert.equal(stage.worldQuality,'balanced');
  assert.equal(stage.sun.shadow.mapSize.x,STAGE_QUALITY.performance.shadow);
  assert.deepEqual(stage.calls.filter(([what])=>what==='cadence'),[['cadence',30]]);
  assert.ok(!stage.calls.some(([what])=>what==='environment disposed'),'The ground, scenery and figures stay as built');
  // The finishing pass stays with the world: turning it off recompiles every shader.
  assert.deepEqual(stage.calls.filter(([what])=>what==='compositor'),[['compositor','balanced']]);
  stage.applyQuality('balanced',{world:false});
  assert.equal(stage.quality,'balanced');assert.equal(stage.worldQuality,'balanced');assert.equal(stage.sun.shadow.mapSize.x,STAGE_QUALITY.balanced.shadow);
});

test('A requested rebuild is skipped when the world is already at that tier',()=>{
  const stage=builtStage('high');
  stage.applyQuality('high');
  assert.ok(!stage.calls.some(([what])=>what==='environment disposed'));
  assert.equal(stage.worldQuality,'high');
});
