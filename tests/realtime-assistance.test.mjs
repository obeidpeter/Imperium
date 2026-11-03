import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {commandOptions} from '../src/core/realtime/intents.js';
import {queueCommand,step,worldHash} from '../src/core/realtime/simulation.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {feedbackCanReplace,fieldTaskOptions,noticeRemaining,noticePriority,squadCardStatus,voteConsequence} from '../src/ui/realtime-assistance.js';
import {rememberMessage} from '../src/ui/realtime-hud.js';

test('task-first field and camp actions retain every legal and refused command across all twelve chapters without changing the simulation',()=>{
  const chapters=new Set();let squadWorld=null,count=0;
  runCommandCampaign({featureEdition:35,onCheckpoint(s){
    const copy=G.deserialize(G.serialize(s));
    if(!G.startEncounter(copy,{controls:'realtime'}).ok)return;
    // Chapter XI is political throughout; verify its camp's live actions too.
    const world=G.realtimeWorld(copy)??G.createCampWorld(s);if(!world)return;
    chapters.add(world.chapter);const before=worldHash(world);
    for(const actor of world.actors.filter(a=>a.side==='player'||a.side==='ally')){
      const original=commandOptions(world,{actorId:actor.id}),unchanged=JSON.stringify(original),presented=fieldTaskOptions(world,original);
      assert.equal(presented.length,original.length);
      assert.equal(JSON.stringify(original),unchanged,'sorting must not alter core option records');
      const records=list=>list.map(({group,...option})=>JSON.stringify(option)).sort();
      assert.deepEqual(records(presented),records(original),'only the presentation group and position may change');
      const order=list=>list.map(o=>`${o.group}|${o.label}|${o.subject??''}`);
      assert.deepEqual(order(fieldTaskOptions(world,[...original].reverse())),order(presented),'distance changes cannot reorder different action labels under the pointer');
      count+=presented.length;
    }
    assert.equal(worldHash(world),before,'readouts cannot change the seed, queue, mission, health or time');
    if(!squadWorld&&world.squads?.some(q=>q.side==='ally'))squadWorld=world;
  }});
  assert.equal(chapters.size,12,`Chapters covered: ${[...chapters].join(', ')}`);assert.ok(count>100);assert.ok(squadWorld);

  // Observe a real legal order before and after the simulation accepts it.
  const squad=squadWorld.squads.find(q=>q.side==='ally'),before=worldHash(squadWorld);
  assert.match(squadCardStatus(squadWorld,squad),/^\d+\/\d+ · /);assert.equal(worldHash(squadWorld),before);
  assert.ok(queueCommand(squadWorld,{actorId:squadWorld.heroId,kind:'order',payload:{squads:[squad.id],order:{kind:'hold'}}}).ok);
  assert.match(squadCardStatus(squadWorld,squad),/Hold queued$/);
  step(squadWorld);assert.match(squadCardStatus(squadWorld,squad),/Hold coming$/);
});

test('objective navigation and optional supplies are distinguishable from walking beside a companion',()=>{
  const world={mission:{goal:{x:10,z:20}},objects:[{id:'mine',kind:'countermine',field:true},{id:'cache',kind:'stores',field:true}]};
  const options=[
    {group:'Objects',label:'Repair the mine',subject:'mine',command:{kind:'interact'}},
    {group:'Places',label:'Move to beside Marcus',command:{kind:'move'}},
    {group:'Objects',label:'Secure the cache',subject:'cache',command:null,reason:'BUSY'},
    {group:'Places',label:'Move to the objective marker',command:{kind:'move'}}
  ];
  const actual=fieldTaskOptions(world,options);
  assert.deepEqual(actual.map(o=>o.group),['Objective','Field work','Optional opportunities','Places']);
  assert.equal(actual[2].command,null);assert.equal(actual[2].reason,'BUSY');
});

test('formation condition takes precedence over its order when troops are lost or regrouping',()=>{
  const squad={id:'first',members:['a','b'],maxMen:2,morale:80,order:{kind:'attack'}};
  const world={actors:[{id:'a',alive:true},{id:'b',alive:false}],queue:[]};
  assert.equal(squadCardStatus(world,squad),'1/2 · Attack');
  squad.morale=30;assert.equal(squadCardStatus(world,squad),'1/2 · Shaken');
  squad.broken=true;assert.equal(squadCardStatus(world,squad),'1/2 · Regrouping');
  world.actors[0].alive=false;assert.equal(squadCardStatus(world,squad),'Lost');
});

test('notices retain reading time during pauses and pointer or keyboard reading; allied casualties outrank routine activity',()=>{
  let left=noticeRemaining(14000,4000);assert.equal(left,10000);
  left=noticeRemaining(left,30000,{paused:true});assert.equal(left,10000);
  left=noticeRemaining(left,30000,{reading:true});assert.equal(left,10000);
  left=noticeRemaining(left,-50);assert.equal(left,10000);
  assert.equal(noticeRemaining(left,12000),0);
  const world={actors:[{id:'friend',side:'ally'},{id:'enemy',side:'enemy'}],squads:[{id:'first',side:'ally'}]};
  const casualty=noticePriority({kind:'squad-destroyed',squadId:'first'},world);
  assert.ok(casualty>noticePriority({kind:'phase'},world));
  assert.ok(casualty>noticePriority({kind:'down',defenderId:'enemy'},world));
  assert.equal(noticePriority({kind:'down',defenderId:'friend'},world),casualty);
});

test('council advice distinguishes changing a stance from gaining an actual vote',()=>{
  const unchanged={forecast:{votesBefore:3,votesAfter:3,stanceChanges:[{before:1,after:3}]}};
  const before=JSON.stringify(unchanged);assert.equal(voteConsequence(unchanged),'No immediate change in votes.');assert.equal(JSON.stringify(unchanged),before);
  assert.equal(voteConsequence({forecast:{votesBefore:3,votesAfter:4}}),'Gains 1 vote.');
  assert.equal(voteConsequence({forecast:{votesBefore:5,votesAfter:3}}),'Loses 2 votes.');
});

test('a rejected player command remains readable after a casualty while routine blows cannot erase either report',()=>{
  const casualty={text:'First squad is cut down.',priority:3,until:6500};
  let history=rememberMessage([],casualty.text,{warning:true});
  assert.equal(feedbackCanReplace(casualty,{source:'simulation',priority:1},1000),false);
  const refusal={text:'Not enough Command.',priority:2,until:4000};
  assert.equal(feedbackCanReplace(casualty,{source:'input',priority:refusal.priority},1200),true);
  history=rememberMessage(history,refusal.text,{warning:true});
  assert.equal(feedbackCanReplace(refusal,{source:'simulation',priority:1},1300),false);
  assert.equal(feedbackCanReplace(refusal,{source:'simulation',priority:3},1400),true,'another casualty is still urgent');
  assert.equal(feedbackCanReplace(refusal,{source:'simulation',priority:1},4100),true);
  assert.deepEqual(history.map(m=>m.text),[casualty.text,refusal.text]);
});
