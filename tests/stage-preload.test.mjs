import test from 'node:test';
import assert from 'node:assert/strict';
import {clone} from '../src/core/shared.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {battleFigureNeeds,figureNeeds,preloadBattleFigures} from '../src/showcase/stage-preload.js';
import {chapterBodies} from '../src/ui/actor-body-catalog.js';

const battles=[];
runCommandCampaign({featureEdition:35,onEncounter:s=>battles.push({chapter:s.chapter,rank:s.rank,encounter:clone(s.encounter)})});

test('the battle preloader asks once for every body a battle can show, hidden reinforcements included',()=>{
  assert.ok(battles.length>=20);let hidden=0;
  for(const {chapter,rank,encounter}of battles){
    const needs=battleFigureNeeds(encounter,{chapter,rank}),bodies=[...needs.values()].filter(n=>n.kind==='body').map(n=>n.id);
    // A named man's face is made from the donor's head, which is fetched with the bodies.
    assert.deepEqual(new Set(bodies),new Set(encounter.units.flatMap(u=>{const need=figureNeeds(u,{chapter,rank});return [need.bodyId,need.headId];}).filter(Boolean)),encounter.id);
    assert.equal(bodies.length,new Set(bodies).size,'each body once');
    // What the preloader fetches is already in the chapter's offline download.
    for(const id of bodies)assert.ok(chapterBodies(chapter).includes(id),`${encounter.id}: ${id} is in Chapter ${chapter}'s download`);
    assert.ok(needs.has('materials')&&[...needs.keys()].some(key=>key.startsWith('complexion:')),`${encounter.id}: shared surfaces and skin`);
    hidden+=encounter.units.filter(u=>u.hidden&&figureNeeds(u,{chapter,rank}).bodyId).length;
    assert.deepEqual([...battleFigureNeeds(encounter,{chapter,rank,figureStyle:'painted'}).keys()],['painted'],'painted figures need the 2D paintings only');
  }
  assert.ok(hidden>0,'a battle holds reinforcements back, and their bodies are fetched with the rest');
});

test('preloading is browser-only and never rejects',async()=>{
  assert.deepEqual(await preloadBattleFigures(battles[0].encounter,{chapter:1}),{tasks:0,failed:0});
  assert.deepEqual(await preloadBattleFigures(null),{tasks:0,failed:0});
});
