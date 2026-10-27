import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {companyActivities} from '../src/core/company-activities.js';
import {COMPANY_ACTIVITIES,activityId} from '../src/data/company-activities.js';
import {routePreview,queueCommand,step} from '../src/core/realtime/simulation.js';
import {campRuntimeKey} from '../src/ui/camp-runtime.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const camp=chapter=>Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state));
const reply=(s,id,nodeId,index)=>Game.campReply(s,{treeId:id,nodeId,index});
const say=(s,id,text)=>{const v=Game.campConversation(s,id),o=v?.options.find(o=>o.text.includes(text));assert.ok(o,`${id}: ${text}`);return reply(s,id,v.nodeId,o.index);};
const refuse=(s,command)=>{const before=JSON.stringify(s);assert.equal(command().ok,false);assert.equal(JSON.stringify(s),before);};
const begin=(s,a)=>assert.ok(say(s,activityId(a.chapter),'check it myself').ok);
const inspect=(s,a,i)=>assert.ok(say(s,a.steps[i].id,'Examine and remember').ok);

test('three optional situations require both pieces of evidence, retain progress and cannot duplicate a completion',()=>{
  assert.deepEqual(companyActivities({chapter:5}),[],'legacy chronicles without a soldier do not offer unusable errands');
  for(const a of COMPANY_ACTIVITIES){
    let s=camp(a.chapter);const end=a.steps[2].id,initial=Game.serialize(s),departure=Game.departureCheck(s),world=Game.createCampWorld(s);
    companyActivities(s);Game.campConversation(s,activityId(a.chapter));assert.equal(Game.serialize(s),initial,'previews are pure');
    refuse(s,()=>reply(s,end,'compare',a.correct));begin(s,a);const key=campRuntimeKey(s);
    inspect(s,a,0);assert.notEqual(campRuntimeKey(s),key,'current view follows evidence');
    refuse(s,()=>reply(s,end,'compare',a.correct));s=Game.deserialize(Game.serialize(s));inspect(s,a,1);
    const beforeWrong=Game.serialize(s);assert.equal(reply(s,end,'compare',(a.correct+1)%3).next,'wrong');assert.equal(Game.serialize(s),beforeWrong,'a wrong match sends no message and changes no flags/RNG');
    const priorEconomy=JSON.stringify([s.rng,s.soldier.tp,s.soldier.denarii,s.meters,s.supplies,s.decisions,s.history,s.company]);
    assert.ok(reply(s,end,'compare',a.correct).ok);assert.equal(companyActivities(s)[0].completed,true);
    assert.equal(JSON.stringify([s.rng,s.soldier.tp,s.soldier.denarii,s.meters,s.supplies,s.decisions,s.history,s.company]),priorEconomy,'no extra economic reward, battle or companion fate');
    refuse(s,()=>reply(s,end,'compare',a.correct));assert.deepEqual(Game.departureCheck(s),departure,'never a departure requirement');
    const saved=Game.serialize(s);assert.equal(Game.serialize(Game.deserialize(saved)),saved);
    const after=Game.createCampWorld(s);assert.equal(after.actors.length,world.actors.length,'no extra crowd budget');
    assert.notDeepEqual(after.actors.find(p=>p.id===a.actor),world.actors.find(p=>p.id===a.actor),'a completed message changes the camp visibly');
    assert.equal(after.objects.find(o=>o.id===end).name,a.completedName);
  }
});

test('stations and changed service actors are reachable by public walking commands',()=>{
  for(const a of COMPANY_ACTIVITIES){
    const s=camp(a.chapter);begin(s,a);let w=Game.createCampWorld(s);
    for(const station of a.steps){
      const object=w.objects.find(o=>o.id===station.id),r=routePreview(w,'hero',object),last=r.points.at(-1);
      assert.ok(last&&Math.hypot(last.x-object.x,last.z-object.z)<=1.8,`${a.chapter}: ${station.id} reachable`);
      assert.ok(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:object.id}}).ok);
      let opened=false;for(let i=0;i<2400&&!opened;i++){step(w);opened=w.events.some(e=>e.kind==='used-object'&&e.objectId===object.id);}
      assert.ok(opened,`${station.id} can be used`);
    }
    inspect(s,a,0);inspect(s,a,1);assert.ok(reply(s,a.steps[2].id,'compare',a.correct).ok);w=Game.createCampWorld(s);
    const target=w.actors.find(p=>p.id===a.actor),path=routePreview(w,'hero',target),end=path.points.at(-1);
    assert.ok(end&&Math.hypot(end.x-target.x,end.z-target.z)<=1.8,'moved service actor remains accessible');
  }
});

test('wrong chapter, encounter, archive replay and missing evidence refuse without mutation',()=>{
  for(const a of COMPANY_ACTIVITIES){
    const s=camp(a.chapter);begin(s,a);inspect(s,a,0);inspect(s,a,1);
    for(const field of [{chapter:a.chapter-1},{chapter:a.chapter+1},{phase:'encounter'},{archiveReplay:true}]){
      const trial=structuredClone(s);Object.assign(trial,field);refuse(trial,()=>reply(trial,a.steps[2].id,'compare',a.correct));
    }
  }
});

test('witness respects authored companion absence, and completed stories remain through a legal campaign',()=>{
  const a=COMPANY_ACTIVITIES[2];for(const fate of ['carry','leave']){
    const s=camp(11);s.decisions.ch2=fate;begin(s,a);inspect(s,a,0);inspect(s,a,1);
    assert.equal(Game.campConversation(s,a.steps[2].id,'compare').speaker,fate==='carry'?'Aurelius Lucan':'Gaius Sabinus');
  }
  const completed=new Set(),result=runCommandCampaign({featureEdition:35,onCheckpoint:s=>{
    const a=COMPANY_ACTIVITIES.find(a=>a.chapter===s.chapter);if(!a||completed.has(a.chapter))return;
    begin(s,a);inspect(s,a,1);inspect(s,a,0);assert.ok(reply(s,a.steps[2].id,'compare',a.correct).ok);completed.add(a.chapter);
  }});
  assert.equal(result.rank,'Augustus');assert.equal(completed.size,3);assert.equal(result.encounters.length,25);
  assert.equal(companyActivities(result.state).filter(a=>a.completed).length,3);
});
