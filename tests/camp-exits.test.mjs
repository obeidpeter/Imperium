// Release 14: leaving camp on foot. Every camp has one way out, to its next encounter, that the soldier
// walks to and uses: the road beyond the gate to a battle, the drill yard to Chapter I's drill, the river
// gate to Chapter V's second battle and a door to a Contest (the Curia's in the Senate's chapters).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {campExitFor} from '../src/core/realtime/camp-world.js';
import {routePreview,queueCommand,step} from '../src/core/realtime/simulation.js';
import {commandOptions,pointerIntent} from '../src/core/realtime/intents.js';
import {navGrid,walkable} from '../src/core/realtime/navigation.js';
import {CHAPTERS} from '../src/data/campaign.js';

const at=(chapter,index)=>{const s=G.newGame('T',275,{featureEdition:35,progression:true,path:'legionary'});s.chapter=chapter;s.encounterIndex=index;s.phase='camp';return s;};
const every=fn=>{for(const c of CHAPTERS)for(let i=0;i<c.encounters.length;i++)fn(c,c.encounters[i],at(c.id,i));};

test('every camp has one way out, to its next encounter, named for where it leads',()=>{
  every((c,e,s)=>{
    const w=G.createCampWorld(s),exits=w.objects.filter(o=>o.kind==='exit');
    assert.equal(exits.length,1,`${e.id}: one way out`);const [x]=exits;
    assert.deepEqual(x.exit,{to:e.id,area:e.title},`${e.id}: it leads to the next encounter`);
    const name=e.id==='ch1-training'?'The drill yard':e.id==='ch5-wall'?'The river gate':e.kind==='contest'?(c.id>=11?'The Curia door':'The principia door'):'The road out';
    assert.equal(x.name,name,`${e.id}: ${name}`);assert.ok(x.toggle,'it can be used again after a refusal');
    // The scenery draws it where the world has it (centred presentation metres).
    const hx=w.map.width*2.5/2,hz=w.map.height*2.5/2,shown=w.campPresentation.interactions.find(i=>i.kind==='exit');
    assert.ok(shown&&Math.abs(shown.x-(x.x-hx))<1e-9&&Math.abs(shown.z-(x.z-hz))<1e-9&&shown.way===e.id,`${e.id}: the scenery's way out stands where the world's does`);
  });
});

test('each way out is walked to from where the soldier stands, clear of the camp’s objects, people and scenery',()=>{
  every((c,e,s)=>{
    const w=G.createCampWorld(s),x=w.objects.find(o=>o.kind==='exit'),g=navGrid(w.map);
    assert.ok(walkable(g,x.x,x.z),`${e.id}: on open ground`);
    const end=routePreview(w,'hero',{x:x.x,z:x.z}).points.at(-1);assert.ok(end&&Math.hypot(end.x-x.x,end.z-x.z)<=1.8,`${e.id}: reachable`);
    for(const o of w.objects.filter(o=>o!==x))assert.ok(Math.hypot(o.x-x.x,o.z-x.z)>=2.4,`${e.id}: ${Math.hypot(o.x-x.x,o.z-x.z).toFixed(2)} m from ${o.id}`);
    for(const a of w.actors.filter(a=>a.id!=='hero'))assert.ok(Math.hypot(a.x-x.x,a.z-x.z)>=1.6,`${e.id}: clear of ${a.id}`);
    const hero=w.actors.find(a=>a.id==='hero');assert.ok(Math.hypot(hero.x-x.x,hero.z-x.z)>=2.4,`${e.id}: the soldier does not start on it`);
    for(const pad of w.campPresentation.sceneryPads??[])assert.ok(!pad.cells.some(({x:cx,y:cy})=>Math.floor(x.x/2.5)===cx&&Math.floor(x.z/2.5)===cy),`${e.id}: outside ${pad.id}`);
  });
});

test('the way out is used like any object: its verb and destination are said, and using it changes nothing in the chronicle',()=>{
  const s=at(2,0),before=JSON.stringify(s),w=G.createCampWorld(s),x=w.objects.find(o=>o.kind==='exit');
  const intent=pointerIntent(w,{pick:{objectId:x.id}});
  assert.equal(intent.command?.kind,'interact');assert.match(intent.message,/^Take: The road out\. On to the broken causeway\./);
  const listed=commandOptions(w).find(o=>o.subject===x.id);assert.equal(listed?.label,'Take: The road out');assert.ok(listed.command,'All actions offers it');
  assert.equal(queueCommand(w,intent.command).ok,true);
  let used=null;for(let i=0;i<400&&!used;i++){step(w);used=w.events.find(ev=>ev.kind==='used-object'&&ev.objectId===x.id);}
  assert.ok(used,'the soldier walks there and uses it');assert.equal(used.what,'exit');
  assert.equal(JSON.stringify(s),before,'the camp world is the page’s: the chronicle is unchanged until the page departs');
});

test('there is no way out outside camp, and the camp’s own departure rules stand behind it',()=>{
  const s=at(1,1);assert.ok(campExitFor(s));
  for(const phase of ['encounter','promotion','epilogue'])assert.equal(campExitFor({...s,phase}),null,`no way out in ${phase}`);
  // A new chronicle's Chapter I road still wants the chapter's decision: the departure check says what is missing,
  // and the departure the way out leads to refuses without changing anything.
  const before=JSON.stringify(s);assert.match(G.departureCheck(s)??'',/decision/i);
  assert.equal(G.startEncounter(s).ok,false);assert.equal(JSON.stringify(s),before,'a refused departure leaves the chronicle as it was');
});
