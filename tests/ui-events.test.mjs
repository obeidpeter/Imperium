import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderScheduler,prepareShareCard} from '../src/ui/render-controller.js';
import {createTurnReplay,turnReplaySteps} from '../src/ui/turn-replay.js';
import {encounterView,selectedCommand,selectedActor} from '../src/ui/encounter-view.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {createPanels} from '../src/ui/panels.js';
import * as Game from '../src/core/game.js';

test('Only the latest DOM render binds controls; cancellation makes queued frames inert',()=>{
  const frames=[],commits=[];
  const scheduler=createRenderScheduler(fn=>frames.push(fn),payload=>commits.push(payload));
  scheduler.schedule({board:1});scheduler.schedule({board:2});frames.splice(0).forEach(fn=>fn());
  assert.deepEqual(commits,[{board:2}]);
  scheduler.schedule({board:3});scheduler.cancel();frames.splice(0).forEach(fn=>fn());
  assert.deepEqual(commits,[{board:2}]);
});

test('A withdrawn selected speaker falls back to a living controllable speaker',()=>{
  const hero={id:'hero',side:'player',resolve:8,hp:8},ally={id:'ally',side:'ally',resolve:0,hp:10},enemy={id:'rival',side:'enemy',resolve:9,hp:9};
  const state={encounter:{units:[hero,ally,enemy]}};
  assert.equal(selectedActor(state,'ally'),hero);
  hero.resolve=0;ally.resolve=5;
  assert.equal(selectedActor(state,'hero'),ally);
  ally.resolve=0;
  assert.equal(selectedActor(state,'hero'),hero,'A withdrawn chamber may still advance to its deadline vote.');
});

test('Delayed card assets and encoding cannot enable a stale or blank card',async()=>{
  const pending=[],draws=[];
  const card=()=>({canvas:{isConnected:true,toBlob(fn){fn({size:1234});}},downloadButton:{disabled:false},shareButton:{disabled:false}});
  const first=card(),second=card(),summary={name:'Aurelius',choices:['Mercy']};
  const prepare=target=>prepareShareCard({...target,summary,loadPortrait:()=>new Promise(resolve=>pending.push(resolve)),loadScene:()=>new Promise(resolve=>pending.push(resolve)),draw:(canvas,data)=>draws.push({canvas,data}),makeFile:blob=>({blob,name:'reign.png'})});
  const stale=prepare(first);assert.ok(first.downloadButton.disabled);assert.ok(first.shareButton.disabled);
  first.canvas.isConnected=false;const current=prepare(second);
  pending[0]({id:'stale'});pending[1](null);assert.equal(await stale,null);assert.equal(draws.length,0);
  pending[2]({id:'portrait'});pending[3](null);const file=await current;
  assert.equal(file.name,'reign.png');assert.equal(draws.length,1);assert.equal(draws[0].canvas,second.canvas);assert.equal(draws[0].data.portrait.id,'portrait');assert.equal(second.downloadButton.disabled,false);assert.equal(second.shareButton.disabled,false);
  const disconnected=card();disconnected.canvas.toBlob=fn=>{disconnected.canvas.isConnected=false;fn({size:1});};
  assert.equal(await prepareShareCard({...disconnected,summary,loadPortrait:async()=>null,loadScene:async()=>null,draw(){},makeFile(){throw Error('must not encode disconnected card');}}),null);
  assert.ok(disconnected.downloadButton.disabled);
});

test('Turn replay is cancellable, bounded, inert under reduced motion, and cannot consume rules state',()=>{
  const timers=[],seen=[];let finishes=0;
  const player=createTurnReplay({show:(text,i,n)=>seen.push([text,i,n]),finish:()=>finishes++,delay:fn=>(timers.push(fn),timers.length),cancelDelay(){}});
  const before={id:'a',turn:1,status:'active',units:[{id:'hero',name:'Aurelius',hp:10,x:1,y:1}]};
  const after={id:'a',turn:2,status:'active',units:[{id:'hero',name:'Aurelius',hp:8,x:2,y:1}]};
  const state=JSON.stringify({before,after});
  const steps=turnReplaySteps(before,after,Array.from({length:20},(_,i)=>`Event ${i}`));
  assert.equal(steps.length,6);player.start(steps);assert.ok(player.active);assert.equal(seen.length,1);
  player.stop();timers.splice(0).forEach(fn=>fn());assert.equal(seen.length,1);assert.equal(finishes,1);
  player.start(steps,true);assert.equal(seen.length,1);assert.equal(player.active,false);
  player.start(['One']);timers.shift()();assert.equal(player.active,false);assert.equal(finishes,2);
  assert.match(turnReplaySteps(before,after)[0],/Aurelius moves to 3B and loses 2 health/);
  assert.equal(JSON.stringify({before,after}),state);
});

test('Encounter and story views render actual legal actions without changing campaign state',()=>{
  const state=Game.newGame('<Aurelius>');Game.choose(state,'friendship');
  // Choose the authored option by ID when the data changes wording.
  if(!state.decisions.ch1)Game.choose(state,Game.getChapter(state).decision.options[0].id);
  assert.equal(Game.startEncounter(state).ok,true);
  const original=Game.serialize(state),legal=Game.getTargets(state,'hero','move'),target=legal[0];
  const html=encounterView({state,selected:'hero',action:'move',target,formation:'shield-wall',orderAction:'advance',header:()=>'',footer:()=>'',requirements:()=>''});
  assert.match(html,/id="unit-select"/);assert.match(html,/id="action-select"/);assert.match(html,/id="target-select"/);assert.match(html,/id="confirm-action"/);assert.match(html,/id="end-turn"/);
  assert.ok(!html.includes('<Aurelius>'));assert.ok(html.includes('&lt;Aurelius&gt;'));
  assert.equal(Game.preview(state,selectedCommand({selected:'hero',action:'move',target})).ok,true);
  assert.equal(Game.serialize(state),original);
  const views=createCampaignViews(()=>({state,screen:'game',settings:{},saving:false,offline:false}));
  views.story();assert.equal(Game.serialize(state),original);
});

test('Settings expose the effective graphics tier and distinguish current-chapter from full offline readiness',()=>{
  const state=Game.newGame(),before=Game.serialize(state),shown=[];
  let offline=false;
  const panels=createPanels(()=>({state,settings:{quality:'high'},offline,currentChapterOffline:true,showModal:(title,html)=>shown.push(html),meters:()=>'',requirements:()=>''}));
  panels.showSettings();
  assert.match(shown.at(-1),/id="graphics-quality"/);
  assert.match(shown.at(-1),/value="high" selected/);
  assert.match(shown.at(-1),/Chapter I is available offline/);
  assert.match(shown.at(-1),/Download everything before playing without internet/);
  offline=true;panels.showSettings();
  assert.match(shown.at(-1),/All twelve chapters are available offline/);
  assert.equal(Game.serialize(state),before);
});
