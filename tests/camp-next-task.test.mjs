import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {campNextTask,campTaskCommand} from '../src/ui/camp-runtime.js';
import {campMapView} from '../src/ui/camp-navigation.js';
import {queueCommand} from '../src/core/realtime/simulation.js';

test('required decisions have a named reachable target in all twelve camps without granting discovery',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    // Presentation fixtures, not campaign progression evidence.
    const s=G.newGame('Guide',275,{featureEdition:35,path:'legionary'});s.chapter=chapter;s.phase='camp';s.encounterIndex=0;
    const world=G.createCampWorld(s),before=JSON.stringify(s),task=campNextTask(s,world),command=campTaskCommand(task,world);
    assert.equal(task.objectId,'table');assert.ok(Number.isFinite(task.x)&&Number.isFinite(task.z));
    assert.equal(command.kind,'interact');assert.equal(command.payload.objectId,'table');
    assert.equal(queueCommand(world,command).ok,true,'the guide issues a legal approach/use order');
    assert.match(campMapView(s,world),/Show me the way/);assert.match(campMapView(s,world),/Camp map/);
    assert.equal(JSON.stringify(s),before,'guidance does not unlock or visit a place');
  }
});

test('the oath names its actual speaker and departure names the right exit',()=>{
  const s=G.newGame('Guide',275,{featureEdition:35,path:'legionary'});
  assert.equal(G.choose(s,G.getChapter(s).decision.options[0].id).ok,true);
  assert.equal(campNextTask(s,G.createCampWorld(s)).label,'The drill yard');
  s.encounterIndex=1;
  const world=G.createCampWorld(s),task=campNextTask(s,world);
  assert.equal(task.actorId,'signifer');assert.equal(task.tree,'ch1:signifer');
  assert.match(task.label,/Quintus/);assert.equal(campTaskCommand(task,world).kind,'talk');
  assert.equal(campNextTask({...s,phase:'encounter'},world),null);
});
