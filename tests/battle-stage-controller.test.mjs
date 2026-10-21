import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleStageController,chapterHas3D} from '../src/ui/battle-stage-controller.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function parent(){return {dataset:{},children:[],append(node){if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(n=>n!==node);this.children.push(node);node.parentElement=this;node.isConnected=true;}};}
function canvas(){const p=parent(),c={parentElement:null,isConnected:true,replaceWith(node){if(node===this)return;const host=this.parentElement;host.children=host.children.filter(n=>n!==this);this.parentElement=null;this.isConnected=false;host.append(node);}};p.append(c);return c;}
function fakeClass({fail=false}={}){const instances=[];class FakeStage{
  constructor(board,encounter,options){if(fail)throw new Error('WebGL unavailable');this.canvas=board;this.labelLayer={parentElement:null,isConnected:false};board.parentElement.append(this.labelLayer);this.quality=options.quality;this.orbit={distance:20};this.calls=[];this.disposals=0;this.sound={stop:()=>this.calls.push(['sound.stop']),unlock:()=>{this.calls.push(['sound.unlock']);return true;}};this.initial={encounter,options};instances.push(this);}
  sync(...a){this.calls.push(['sync',...a]);} setSelection(...a){this.calls.push(['selection',...a]);} setGrid(...a){this.calls.push(['grid',...a]);}
  applyQuality(q){this.quality=q;this.calls.push(['quality',q]);} setReducedMotion(...a){this.calls.push(['reduced',...a]);} setPaused(...a){this.calls.push(['paused',...a]);} setAudio(...a){this.calls.push(['audio',...a]);}
  play(...a){this.calls.push(['play',...a]);return Promise.resolve();} finishMotion(){this.calls.push(['finish']);} resize(){this.calls.push(['resize']);} home(){this.calls.push(['home']);} focusSelected(){this.calls.push(['focus']);} horizon(){this.calls.push(['horizon']);}
  dispose(){this.disposals++;this.calls.push(['dispose']);}
}return {FakeStage,instances};}
const options=(id='ch1-road',extra={})=>({encounter:{id,kind:'battle',units:[],turn:1},selected:'hero',targets:[],target:null,grid:false,quality:'balanced',reducedMotion:false,audio:false,audioVolume:.4,paused:false,...extra});
const plays=stage=>stage.calls.filter(c=>c[0]==='play');

test('Horizon remains an explicit camera command and does not replace tactical startup or mutate the encounter',async()=>{
  const {FakeStage}=fakeClass(),job=deferred(),c=createBattleStageController({load:()=>job.promise}),data=options(),before=structuredClone(data);
  c.horizon();c.mount(canvas(),data);c.horizon();job.resolve({BattleStage:FakeStage});await settle();const stage=c.stage;
  assert.equal(stage.calls.filter(call=>call[0]==='home').length,1,'Initial view stays the tactical overview.');
  assert.equal(stage.calls.filter(call=>call[0]==='horizon').length,0,'An unavailable camera cannot queue a stale view.');
  c.horizon();assert.equal(stage.calls.filter(call=>call[0]==='horizon').length,1);assert.deepEqual(data,before);assert.equal(plays(stage).length,0);
  c.release();assert.doesNotThrow(()=>c.horizon());assert.equal(stage.calls.filter(call=>call[0]==='horizon').length,1);
});

test('Every authored chapter supports battle and Contest 3D; camp and invalid chapters do not',()=>{
  for(let chapter=1;chapter<=12;chapter++)for(const kind of ['battle','contest'])assert.equal(chapterHas3D({chapter,phase:'encounter',encounter:{kind}}),true);
  for(const state of [null,{chapter:13,phase:'encounter',encounter:{kind:'battle'}},{chapter:1,phase:'camp',encounter:{kind:'battle'}},{chapter:1,phase:'encounter',encounter:{kind:'unknown'}}])assert.equal(chapterHas3D(state),false);
});

test('Rerendering one encounter reuses its canvas and labels, updates options and marks the new host ready',async()=>{
  const {FakeStage,instances}=fakeClass();let loads=0;const c=createBattleStageController({load:async()=>{loads++;return {BattleStage:FakeStage};}}),first=canvas();
  assert.equal(c.mount(first,options()),null);await settle();const stage=c.stage;assert.equal(instances.length,1);assert.equal(first.parentElement.dataset.ready,'true');assert.equal(stage.initial.options.keyboardMode,'grid');
  const placeholder=canvas(),host=placeholder.parentElement,next=options('ch1-road',{encounter:{id:'ch1-road',kind:'battle',units:[],turn:2},selected:'lucan',targets:[{x:2,y:3}],target:{x:2,y:3},grid:true,quality:'high',reducedMotion:true,audio:true,audioVolume:.2,paused:true});
  assert.equal(c.mount(placeholder,next),stage);assert.equal(loads,1);assert.equal(c.stage.canvas,first);assert.equal(first.parentElement,host);assert.equal(stage.labelLayer.parentElement,host);assert.equal(placeholder.isConnected,false);assert.equal(host.dataset.ready,'true');
  assert.deepEqual(stage.calls.filter(v=>v[0]==='sync').at(-1),['sync',next.encounter]);assert.deepEqual(stage.calls.filter(v=>v[0]==='selection').at(-1),['selection','lucan',next.targets,next.target]);assert.equal(stage.quality,'high');assert.deepEqual(stage.calls.filter(v=>v[0]==='audio').at(-1),['audio',true,.2]);assert.equal(stage.disposals,0);c.release();assert.equal(stage.disposals,1);
});

test('Release and disconnected canvases cannot resurrect an asynchronously loaded stage',async()=>{
  const {FakeStage,instances}=fakeClass(),job=deferred(),errors=[],c=createBattleStageController({load:()=>job.promise,onError:e=>errors.push(e)});
  c.mount(canvas(),options());c.release();job.resolve({BattleStage:FakeStage});await settle();assert.equal(c.stage,null);assert.equal(instances.length,0);assert.deepEqual(errors,[]);
  const job2=deferred(),c2=createBattleStageController({load:()=>job2.promise}),board=canvas();c2.mount(board,options());board.isConnected=false;job2.resolve({BattleStage:FakeStage});await settle();assert.equal(c2.stage,null);assert.equal(instances.length,0);c2.release();
});

test('Switching while modules load ignores stale success and stale failure',async()=>{
  const {FakeStage,instances}=fakeClass(),jobs=[deferred(),deferred(),deferred()],errors=[];let count=0;const c=createBattleStageController({load:()=>jobs[count++].promise,onError:e=>errors.push(e)});
  c.mount(canvas(),options('ch1-training'));c.mount(canvas(),options('ch1-road'));jobs[1].resolve({BattleStage:FakeStage});await settle();const road=c.stage;jobs[0].resolve({BattleStage:FakeStage});await settle();assert.equal(c.stage,road);assert.equal(instances.length,1);
  c.release();c.mount(canvas(),options('ch1-training'));c.release();jobs[2].reject(new Error('Stale import failure'));await settle();assert.deepEqual(errors,[]);assert.equal(road.disposals,1);assert.equal(c.stage,null);
});

test('Import and constructor failures request fallback and allow a later successful initialization',async()=>{
  const rejected=deferred(),{FakeStage}=fakeClass(),broken=fakeClass({fail:true}),errors=[];let calls=0;const c=createBattleStageController({load:()=>{calls++;return calls===1?rejected.promise:Promise.resolve({BattleStage:calls===2?broken.FakeStage:FakeStage});},onError:e=>errors.push(e)});
  c.mount(canvas(),options());rejected.reject(new Error('Module unavailable'));await settle();assert.equal(c.stage,null);assert.deepEqual(errors,['Module unavailable']);
  c.mount(canvas(),options());await settle();assert.equal(c.stage,null);assert.deepEqual(errors,['Module unavailable','WebGL unavailable']);
  c.mount(canvas(),options());await settle();assert.ok(c.stage);c.release();
});

test('A pending committed motion plays once after loading and is not replayed by a repeated render',async()=>{
  const {FakeStage}=fakeClass(),job=deferred(),c=createBattleStageController({load:()=>job.promise}),motion={before:{turn:1},after:{turn:1},command:{action:'strike'}};
  c.mount(canvas(),options('ch1-road',{motion}));c.mount(canvas(),options());job.resolve({BattleStage:FakeStage});await settle();const stage=c.stage;assert.equal(plays(stage).length,1);assert.deepEqual(plays(stage)[0],['play',motion.before,motion.after,motion.command]);
  c.mount(canvas(),options('ch1-road',{motion}));assert.equal(plays(stage).length,1,'The same committed motion object is consumed only once');
  const second={before:{turn:1},after:{turn:2},command:{action:'endTurn'}};c.mount(canvas(),options('ch1-road',{motion:second}));assert.equal(plays(stage).length,2);c.release();
});

test('Stop drops pending motion; stage errors dispose once and do not retain a failed renderer',async()=>{
  const {FakeStage}=fakeClass(),job=deferred(),errors=[],c=createBattleStageController({load:()=>job.promise,onError:e=>errors.push(e)});
  c.mount(canvas(),options('ch1-road',{motion:{before:{},after:{},command:{action:'move'}}}));c.stop();job.resolve({BattleStage:FakeStage});await settle();const stage=c.stage;assert.equal(plays(stage).length,0);
  c.stop();assert.ok(stage.calls.some(v=>v[0]==='finish'));assert.equal(stage.calls.some(v=>v[0]==='sound.stop'),false,'A normal render must not suspend the already-consented audio context');stage.onError('Context lost');assert.equal(c.stage,null);assert.equal(stage.disposals,1);assert.deepEqual(errors,['Context lost']);c.release();assert.equal(stage.disposals,1);
});

test('Settings and modal changes during the first module import reach the eventual stage',async()=>{
  const {FakeStage}=fakeClass(),job=deferred(),c=createBattleStageController({load:()=>job.promise});
  c.mount(canvas(),options());
  // These are the actual controller operations from Settings and showModal,
  // which do not replace the campaign DOM while the import is pending.
  c.pause(true);c.audio(true,.25);c.reduced(true);
  job.resolve({BattleStage:FakeStage});await settle();
  const stage=c.stage;assert.ok(stage);
  assert.equal(stage.initial.options.paused,true);
  assert.equal(stage.initial.options.audio,true);assert.equal(stage.initial.options.audioVolume,.25);
  assert.equal(stage.initial.options.reducedMotion,true);
  assert.deepEqual(stage.calls.filter(call=>call[0]==='paused').at(-1),['paused',true]);
  assert.deepEqual(stage.calls.filter(call=>call[0]==='audio').at(-1),['audio',true,.25]);
  assert.deepEqual(stage.calls.filter(call=>call[0]==='reduced').at(-1),['reduced',true]);
  c.pause(false);c.audio(false,0);c.reduced(false);
  assert.deepEqual(stage.calls.filter(call=>call[0]==='paused').at(-1),['paused',false]);
  assert.deepEqual(stage.calls.filter(call=>call[0]==='audio').at(-1),['audio',false,0]);
  assert.deepEqual(stage.calls.filter(call=>call[0]==='reduced').at(-1),['reduced',false]);
  c.release();
});

test('a battle that stayed slow at its lowest resolution builds the next battle a tier lower, never itself',async()=>{
  const {FakeStage,instances}=fakeClass(),asked=[];
  const c=createBattleStageController({load:async()=>({BattleStage:FakeStage}),onStrain:quality=>{asked.push(quality);return 'performance';}});
  c.mount(canvas(),options('ch1-road',{quality:'balanced'}));await settle();const first=c.stage;
  first.strained=true;c.mount(canvas(),options('ch1-road',{quality:'balanced',selected:'lucan'}));
  assert.equal(c.stage,first,'the same battle carries on at its quality');assert.deepEqual(asked,[]);
  c.mount(canvas(),options('ch1-patrol',{quality:'balanced'}));await settle();
  assert.deepEqual(asked,['balanced'],'the strain is reported once the battle is left');assert.equal(instances.at(-1).quality,'performance','the next battle is built a tier lower');
  c.mount(canvas(),options('ch1-ridge',{quality:'performance'}));await settle();assert.equal(asked.length,1,'reported once');
  const quiet=createBattleStageController({load:async()=>({BattleStage:FakeStage}),onStrain:()=>null});
  quiet.mount(canvas(),options('ch1-road',{quality:'high'}));await settle();quiet.stage.strained=true;quiet.mount(canvas(),options('ch1-patrol',{quality:'high'}));await settle();
  assert.equal(quiet.stage.quality,'high','declining the step keeps the chosen quality');
});

test('Each mount hands the stage the route under the pointer and the walkable ground, and clears them when the page has none',async()=>{
  const {FakeStage}=fakeClass();class RouteStage extends FakeStage{setRoute(...a){this.calls.push(['route',...a]);}}
  const c=createBattleStageController({load:async()=>({BattleStage:RouteStage})}),route={stop:{x:1,y:3},reachable:true},reach=[{x:1,y:3}];
  const routes=()=>c.stage.calls.filter(v=>v[0]==='route');
  c.mount(canvas(),options('ch1-road',{route,reach}));await settle();
  assert.deepEqual(routes().at(-1),['route',route,reach],'The stage inks what the page computed');
  c.mount(canvas(),options('ch1-road',{selected:'lucan'}));
  assert.deepEqual(routes().at(-1),['route',null,[]],'A render without a route clears it');
  c.release();
});
