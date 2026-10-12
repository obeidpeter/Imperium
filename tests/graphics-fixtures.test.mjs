import test from 'node:test';
import assert from 'node:assert/strict';
import {generateGraphicsScenes} from '../scripts/graphics-fixtures.mjs';
import {deserialize,serialize,canAccess} from '../src/core/game.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';

test('Graphics QA scenes replay the complete legal campaign and remain valid independent checkpoints',async()=>{
  const data=await generateGraphicsScenes();assert.equal(data.finalRank,'Augustus');assert.deepEqual(data.completed,[1,2,3,4,5,6,7,8,9,10,11,12]);assert.equal(data.primaryScenes.length,12);assert.equal(new Set(data.scenes.map(s=>s.id)).size,50);assert.equal(data.scenes.filter(s=>s.kind==='board').length,25);
  for(const scene of data.scenes){assert.deepEqual(deserialize(serialize(scene.state)),scene.state,scene.id);assert.ok(canAccess(scene.state,scene.chapter));assert.ok(scene.traceStep<=data.commandCount);if(scene.kind==='board'){assert.equal(scene.state.phase,'encounter');assert.equal(scene.transition.before.id,scene.state.encounter.id);assert.equal(scene.transition.after.id,scene.state.encounter.id);assert.ok(scene.transition.traceStep>0);}else{const context={state:scene.state,screen:'game',settings:{reducedMotion:true},saving:false,lastSaved:'',saveProblem:'',saveConflict:false,offline:false,offlineProgress:''},before=JSON.stringify(scene.state),views=createCampaignViews(()=>context),html=views[scene.kind]();assert.ok(html.includes('<main'),scene.id);assert.equal(JSON.stringify(scene.state),before);}}
  assert.deepEqual(data.primaryScenes.map(id=>data.scenes.find(s=>s.id===id).chapter),[1,2,3,4,5,6,7,8,9,10,11,12]);
});
