import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {campNextTask,campTaskCommand} from '../src/ui/camp-runtime.js';
import {campMapView} from '../src/ui/camp-navigation.js';
import {queueCommand,step} from '../src/core/realtime/simulation.js';

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

test('at the last step the way is walked to, never used for the player: the soldier stops by its post, in camp',()=>{
  // The owner's choice after #65. Presentation fixtures: a chapter's camp with its decision made.
  let covered=0;
  for(let chapter=1;chapter<=12;chapter++){
    const s=G.newGame('Guide',275,{featureEdition:35,path:'legionary'});s.chapter=chapter;s.phase='camp';s.encounterIndex=0;
    assert.equal(G.choose(s,G.getChapter(s).decision.options[0].id).ok,true);
    if(G.departureCheck(s))continue;covered++;
    const world=G.createCampWorld(s),before=JSON.stringify(s),task=campNextTask(s,world),command=campTaskCommand(task,world);
    const exit=world.objects.find(o=>o.kind==='exit'),hero=world.actors.find(a=>a.id===world.heroId);
    assert.equal(task.depart,true,`Chapter ${chapter}: the next step is the way out`);assert.equal(task.objectId,exit.id);
    assert.equal(command.kind,'move',`Chapter ${chapter}: a walk, not a use`);
    assert.equal(queueCommand(world,command).ok,true);
    const used=[];
    for(let tick=0;tick<20*60;tick++){for(const e of step(world))if(['used-object','blocked','rejected'].includes(e.kind))used.push(e.kind);if(tick>5&&!hero.moving)break;}
    const d=Math.hypot(hero.x-exit.x,hero.z-exit.z);
    assert.ok(d>=.6&&d<=2,`Chapter ${chapter}: he stops by the post, not on it (${d.toFixed(2)} m)`);
    assert.deepEqual(used,[],`Chapter ${chapter}: nothing is used, blocked or refused`);
    assert.equal(world.kind,'camp');assert.equal(JSON.stringify(s),before,'the walk changes nothing in the chronicle');
  }
  assert.ok(covered>=9,`Chapters with the way out next after the decision: ${covered}`);
});
