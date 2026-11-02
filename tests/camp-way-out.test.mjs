// The camp's way out, once nothing keeps the column in camp, is marked like an objective: a ring at the waypost,
// and its name at the view's edge, pointing to it, while it is out of sight (the soldier often arrives with it
// behind him). Presentation only: deciding and drawing the mark changes nothing in the chronicle or the world.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {campWayOut} from '../src/ui/camp-runtime.js';
import {stageEncounter,stageTile} from '../src/showcase/live-figures.js';
import {missionReadouts} from '../src/showcase/stage-readout.js';
import {layoutStageLabels,edgeToward} from '../src/showcase/stage-label-layout.js';
import {EDGE_ARROWS} from '../src/showcase/flat-stage.js';
import {CHAPTERS} from '../src/data/campaign.js';

const fresh=()=>G.newGame('T',275,{featureEdition:35,progression:true,path:'legionary'});
const at=(chapter,index)=>{const s=fresh();s.chapter=chapter;s.encounterIndex=index;s.phase='camp';return s;};
const campBase=world=>({kind:'battle',type:'camp',width:world.map.width,height:world.map.height,terrain:world.map.terrain,units:[]});

test('the way out is marked once nothing keeps the column in camp, and deciding it changes nothing',()=>{
  const s=fresh(),world=G.createCampWorld(s),before=JSON.stringify(s),worldBefore=JSON.stringify(world);
  assert.match(G.departureCheck(s),/decision/,'a new chronicle’s first camp still wants its decision');
  assert.equal(campWayOut(s,world),null,'so its way out is not marked yet');
  assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(world),worldBefore);
  assert.equal(G.choose(s,G.getChapter(s).decision.options[0].id).ok,true);
  assert.deepEqual(campWayOut(s,G.createCampWorld(s)),{label:'The drill yard'},'decided, the drill yard is marked');
  assert.equal(campWayOut({...s,phase:'encounter'},world),null,'only in camp');
  assert.equal(campWayOut(s,{...world,kind:'field'}),null,'only a camp’s way out');
});

test('every camp ready to march marks its one way out by name, on the stage’s tiles, pinned to the view’s edge',()=>{
  let ready=0;
  for(const c of CHAPTERS)for(let i=0;i<c.encounters.length;i++){
    // The chapter's decision made, as a player makes it, wherever the departure still asks for it.
    const s=at(c.id,i),decision=G.getChapter(s).decision;
    if(decision&&/decision/i.test(G.departureCheck(s)??''))G.choose(s,decision.options[0].id);
    const world=G.createCampWorld(s),exit=world.objects.find(o=>o.kind==='exit'),wayOut=campWayOut(s,world);
    assert.equal(wayOut===null,!!G.departureCheck(s),`${c.encounters[i].id}: marked exactly when the departure check passes`);
    if(!wayOut)continue;ready++;
    assert.equal(wayOut.label,exit.name);
    const marks=missionReadouts(stageEncounter(campBase(world),world,{wayOut})).filter(m=>m.id==='way-out');
    assert.equal(marks.length,1);const [mark]=marks,tile=stageTile(exit.x,exit.z);
    assert.deepEqual({x:mark.x,y:mark.y,label:mark.label,tone:mark.tone,pin:mark.pin},{x:tile.x,y:tile.y,label:exit.name,tone:'goal',pin:true});
  }
  assert.ok(ready>0,'some camps are ready to march as they open');
  const world=G.createCampWorld(fresh());
  assert.equal(missionReadouts(stageEncounter(campBase(world),world)).some(m=>m.id==='way-out'),false,'unmarked without the page’s word');
  assert.equal(missionReadouts(stageEncounter(campBase(world),{...world,kind:'field'},{wayOut:{label:'X'}})).some(m=>m.id==='way-out'),false,'never on a field');
});

test('a pinned label out of sight waits at the nearest edge with the way it lies; others go out of sight as before',()=>{
  const size={width:400,height:300},label={width:90,height:20,priority:60,visible:true};
  const below=layoutStageLabels([{id:'way',x:200,y:520,pin:true,...label}],size).get('way');
  assert.equal(below.visible,true);assert.equal(below.reason,'edge');assert.equal(below.edge,'down');
  assert.ok(below.x>=8&&below.x+below.width<=392&&below.y+below.height<=292,'inside the view');
  assert.equal(layoutStageLabels([{id:'way',x:-60,y:-40,pin:true,...label}],size).get('way').edge,'up-left');
  assert.equal(layoutStageLabels([{id:'way',x:200,y:520,...label}],size).get('way').reason,'offscreen','unpinned labels still give up their place');
  assert.equal(layoutStageLabels([{id:'way',x:200,y:150,pin:true,...label}],size).get('way').reason,'visible','in sight, a pinned label is placed as any other');
  assert.equal(layoutStageLabels([{id:'way',x:200,y:520,pin:true,...label,visible:false}],size).get('way').visible,false,'behind the camera it stays hidden');
  for(const [x,y]of [[500,150],[500,400],[200,400],[-100,400],[-100,150],[-100,-100],[200,-100],[500,-100]])
    assert.ok(EDGE_ARROWS[edgeToward(x,y,400,300)],'the 2D view has an arrow for every direction');
});
