import {createShowcaseSession} from './session.js';
import {createArenaWorld} from '../core/realtime/arena.js';
import {createCrowdWorld,createSkirmishWorld} from '../core/realtime/benchmark-worlds.js';
import {restoreWorld,snapshotWorld,step} from '../core/realtime/simulation.js';
import {setPaused,setSpeed} from '../core/realtime/clock.js';
import {actorById} from '../core/realtime/abilities.js';
import {mix32} from '../core/realtime/rng-streams.js';
import {TIME} from '../data/realtime-rules.js';
import {stageEncounter} from './live-figures.js';
import {createRealtimeField} from './realtime-field.js';
import {DEFAULT_KEYMAP,loadKeyLabels} from '../ui/action-map.js';
import {SETTINGS_KEY,loadSettings} from '../ui/settings.js';
import {createLongTaskLog,percentile} from '../ui/performance-check.js';

// The Phase 0 real-time arena (build brief §6): the standalone skirmish in
// real time with pause. The shared field runtime (realtime-field.js, as the
// campaign's battles use it) owns the clock and turns pointer and keys into
// Commands; the simulation (src/core/realtime) decides everything; the stage
// draws it (live-figures.js). This page keeps the arena's own soldier card,
// menu, result and performance check. Nothing here changes the chronicle,
// and nothing is sent anywhere.

const $=id=>document.getElementById(id),canvas=$('scene');
const ARENA_KEY='imperium.arena';
const readJSON=(storage,key)=>{try{return JSON.parse(storage.getItem(key)??'null');}catch{return null;}};
const campaign=loadSettings((()=>{try{return localStorage.getItem(SETTINGS_KEY);}catch{return null;}})(),
  {reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
const stored=readJSON(localStorage,ARENA_KEY)??{};
// Earlier visits stored speed and sightedPause; the shared field reads gameSpeed and pauseSighted.
const options={gameSpeed:1,roundPause:false,pauseSighted:false,pauseHurt:false,pauseObjective:false,drawToAttack:true,keepFighting:false,holdToMove:true,
  swapButtons:false,sound:false,quickCast:false,quality:campaign.quality,reducedMotion:campaign.reducedMotion,...stored,
  ...(stored.speed!==undefined&&stored.gameSpeed===undefined?{gameSpeed:stored.speed}:{}),
  ...(stored.sightedPause!==undefined&&stored.pauseSighted===undefined?{pauseSighted:stored.sightedPause}:{})};
delete options.speed;delete options.sightedPause;
const saveOptions=()=>{try{localStorage.setItem(ARENA_KEY,JSON.stringify(options));}catch{}};
const keymap=DEFAULT_KEYMAP;loadKeyLabels();

// The map and the seed come from the campaign's own frontier road: the drill is
// replayed legally (session.js), and each fight takes the next seed from it.
const session=createShowcaseSession(),base=session.encounter,seedParam=Number(new URLSearchParams(location.search).get('seed'));
const seedFor=n=>Number.isInteger(seedParam)&&seedParam>0?mix32(seedParam+n-1):mix32(session.rng+Math.imul(n,0x9e3779b9));
let fight=0,stage=null,wins=0,losses=0,pausedForMenu=false;
const newWorld=()=>{fight++;return createArenaWorld(base,{seed:seedFor(fight),options:{keepFighting:options.keepFighting,drawToAttack:options.drawToAttack}});};

const field=createRealtimeField({
  dom:{canvas,eventLine:$('event-line'),announcer:$('announcer'),messageLine:$('message-line'),log:$('battle-log'),abilityBar:$('ability-bar'),
    swordsButton:$('swords-button'),walkButton:$('walk-button'),pauseButton:$('pause-button'),slowButton:$('slow-button'),stepButton:$('step-button'),
    pausedBand:$('paused-band'),roundLabel:$('round-label'),clockTime:$('clock-time'),clockRing:$('clock-ring'),currentAbility:$('current-ability'),
    forceButton:$('force-button'),rangesButton:$('ranges-button'),menuButton:$('menu-button')},
  world:newWorld(),base,options,keymap,holdDelay:()=>campaign.holdDelay??450,
  callbacks:{
    onEnd:world=>{if(world.status==='won')wins++;else losses++;showResult();},
    onMenu:()=>openMenu(),onPanel:name=>{if(name==='help')openDialog('intro');else field.say('Panels belong to the campaign; the arena has none.');},
    onQuickSave:()=>field.say('The arena keeps no saves.'),onHud:world=>soldierCard(world)
  }
});
const hero=()=>actorById(field.world,field.world.controlled);
// The arena's soldier card: his bars with their numbers.
function soldierCard(world){
  const h=actorById(world,world.heroId);if(!h)return;
  $('health-bar').querySelector('i').style.inlineSize=`${h.hp/h.maxHp*100}%`;$('health-text').textContent=`${h.hp} / ${h.maxHp} Health`;
  $('health-bar').setAttribute('aria-valuenow',h.hp);$('health-bar').setAttribute('aria-valuemax',h.maxHp);
  $('stamina-bar').querySelector('i').style.inlineSize=`${h.stamina/h.maxStamina*100}%`;$('stamina-text').textContent=`${h.stamina} / ${h.maxStamina} Stamina`;
  $('stamina-bar').setAttribute('aria-valuenow',h.stamina);$('stamina-bar').setAttribute('aria-valuemax',h.maxStamina);
  $('hero-card').classList.toggle('hurt',h.alive&&h.hp<h.maxHp*.25);$('hero-card').classList.toggle('down',!h.alive);
}

// ——— Menus and dialogs: opening one pauses the world. ———
function openDialog(id){
  const dialog=$(id);if(dialog.open)return;
  if(!field.clock.paused){setPaused(field.clock,true);pausedForMenu=true;}
  dialog.showModal();
}
function closeDialog(id){
  const dialog=$(id);if(dialog.open)dialog.close();
  if(pausedForMenu&&![...document.querySelectorAll('dialog')].some(d=>d.open)){pausedForMenu=false;setPaused(field.clock,false);}
  canvas.focus({preventScroll:true});
}
function openMenu(){
  $('session-note').textContent=`This visit: ${fight} fight${fight===1?'':'s'}, ${wins} won, ${losses} lost. Nothing is recorded or sent.`;openDialog('menu');
}
function showResult(){
  const world=field.world,h=hero(),won=world.status==='won',seconds=Math.round(world.tick/TIME.ticksPerSecond);
  $('result-title').textContent=won?'The road is clear.':'You have fallen.';
  $('result-summary').textContent=won?`Three raiders defeated in ${seconds} seconds of battle time, with ${h.hp} of ${h.maxHp} Health left.`
    :`The raiders hold the road after ${seconds} seconds. Try a pilum before they close, brace against a heavy blow, or put a rock at your back.`;
  openDialog('result');
}
function restart(){
  closeDialog('result');closeDialog('menu');field.load(newWorld(),base);setPaused(field.clock,false);
  field.say('A fresh fight. The raiders wait by the cart.',{announce:true});
}

// ——— Performance check: 15 fighting men drawn for 12 s, and the simulation's tick timed headless. ———
function stats(list){
  const ok=list.filter(Number.isFinite);return {p50:round1(percentile(ok,.5)),p95:round1(percentile(ok,.95)),max:round1(ok.length?Math.max(...ok):null),n:ok.length};
}
const round1=n=>Number.isFinite(n)?Math.round(n*100)/100:null;
function timeTicks(make,ticks){const w=make(),times=[];for(let i=0;i<ticks&&w.status==='active';i++){const t=performance.now();step(w);times.push(performance.now()-t);}
  return {actors:w.actors.length,...stats(times)};}
async function runCheck(){
  closeDialog('menu');const status=$('check-status');$('check-results').replaceChildren();$('check-save').hidden=true;openDialog('check');
  const saved=snapshotWorld(field.world),longTasks=createLongTaskLog(),metrics=field.metrics;
  try{
    status.textContent='Building a 15-man skirmish…';
    field.load(createSkirmishWorld(base,{seed:seedFor(fight)}),base);setPaused(field.clock,true);
    // The new men are built, their programs compiled and their geometry sent before anything is measured.
    status.textContent='Preparing 15 men…';stage.ready=stage.prepare();await stage.ready;
    $('check').close();pausedForMenu=false;setPaused(field.clock,false);stage.home();metrics.ticks.length=0;
    const log=stage.startFrameLog(),start=performance.now();
    await new Promise(done=>{const turn=()=>{const t=performance.now();if(t-start>=12000)return done();stage.orbit.yaw+=.004;requestAnimationFrame(turn);};turn();});
    stage.stopFrameLog();setPaused(field.clock,true);
    const intervals=log.frames.map(f=>f[2]).filter(ms=>ms>0),p50=percentile(intervals,.5),fps=p50?Math.round(1000/p50):null;
    status.textContent='Timing the simulation…';$('check').showModal();await new Promise(done=>setTimeout(done,30));
    const report={tool:'imperium-arena-check',version:1,measuredAt:new Date().toISOString(),quality:stage.quality,
      render:{actors:field.world.actors.length,seconds:12,frames:log.frames.length,fps,intervalMs:stats(intervals),cpuMs:stats(log.frames.map(f=>f[1])),
        longTasks:longTasks.supported?(entries=>({count:entries.length,maxMs:round1(Math.max(0,...entries.map(e=>e[1])))}))(longTasks.entries.filter(e=>e[0]>=start)):null,
        tickMs:stats(metrics.ticks)},
      simulation:{skirmish15:timeTicks(()=>createSkirmishWorld(base,{seed:7}),1200),crowd82:timeTicks(()=>createCrowdWorld({seed:7}),1200)},
      // Gate 0: a click's first movement on screen (≤ 100 ms on a desktop), from this visit's own clicks.
      input:{clickToMovementMs:stats(metrics.clicks),clickToMovementFrames:stats(metrics.clickFrames)},
      gate0:{fpsTarget:45,clickMs:100,tickBudgetMs:4},device:{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency??null,
        deviceMemoryGb:navigator.deviceMemory??null,devicePixelRatio:devicePixelRatio,viewport:{width:innerWidth,height:innerHeight}}};
    window.__arenaReport=report;
    const row=(label,value)=>`<tr><th scope="row">${label}</th><td>${value}</td></tr>`;
    $('check-results').innerHTML=`<table class="check-table"><tbody>${row('Frame rate, 15 men fighting',`${fps??'—'} fps (target 45 on a phone)`)}`+
      `${row('Frame interval p95',`${report.render.intervalMs.p95??'—'} ms`)}`+
      `${row('Tick, live (p50 / p95 / max)',`${report.render.tickMs.p50} / ${report.render.tickMs.p95} / ${report.render.tickMs.max} ms`)}`+
      `${row('Tick, 15 men headless (p95)',`${report.simulation.skirmish15.p95} ms`)}${row('Tick, 82 men headless (p95)',`${report.simulation.crowd82.p95} ms (budget 4)`)}`+
      `${row('Click to first movement',report.input.clickToMovementMs.n?`${report.input.clickToMovementMs.p50} ms typical, ${report.input.clickToMovementMs.max} ms slowest `+
        `(${report.input.clickToMovementFrames.max} frame${report.input.clickToMovementFrames.max===1?'':'s'}); target 100 ms`:'click open ground a few times first')}`+
      `${row('Longest task',report.render.longTasks?`${report.render.longTasks.maxMs} ms`:'not reported by this browser')}</tbody></table>`;
    status.textContent=`Measured at ${stage.quality} quality. Save the results to share them; nothing is sent anywhere.`;
    const link=$('check-save');URL.revokeObjectURL(link.href);
    link.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));link.hidden=false;
  }catch(error){console.error(error);status.textContent='The check could not finish. Your fight is restored.';}
  finally{
    longTasks.dispose?.();field.load(restoreWorld(saved),base);setPaused(field.clock,true);pausedForMenu=false;stage.ready=stage.prepare();
  }
}

// ——— Wiring: the arena's own dialogs and settings (the field binds the scene and the HUD). ———
function bindControls(){
  $('portrait').onclick=()=>{field.follow();field.say('Your soldier. The view follows him.');canvas.focus({preventScroll:true});};
  $('resume-button').onclick=()=>closeDialog('menu');$('restart-button').onclick=restart;
  $('again-button').onclick=restart;$('inspect-button').onclick=()=>closeDialog('result');$('help-button').onclick=()=>{closeDialog('menu');openDialog('intro');};
  $('begin-button').onclick=()=>closeDialog('intro');$('check-button').onclick=runCheck;$('check-close').onclick=()=>closeDialog('check');
  for(const id of ['intro','menu','result','check'])$(id).addEventListener('close',()=>closeDialog(id));
  const settings={'speed-setting':['gameSpeed',v=>{field.setOption('gameSpeed',Number(v));return field.clock.speed;}],
    'quality-setting':['quality',v=>{stage?.applyQuality(v);return v;}]};
  for(const [id,[key,apply]]of Object.entries(settings)){$(id).value=String(options[key]);$(id).onchange=e=>{options[key]=apply(e.target.value);saveOptions();};}
  const checks={'round-pause':'roundPause','sighted-pause':'pauseSighted','draw-to-attack':'drawToAttack','keep-fighting':'keepFighting','hold-to-move':'holdToMove',
    'swap-buttons':'swapButtons','sound-setting':'sound','motion-setting':'reducedMotion','quick-cast':'quickCast'};
  for(const [id,key]of Object.entries(checks)){$(id).checked=!!options[key];$(id).onchange=e=>{
    field.setOption(key,e.target.checked);saveOptions();
    if(key==='sound')stage?.setAudio(options.sound,.6);if(key==='reducedMotion')stage?.setReducedMotion(options.reducedMotion);
  };}
}

async function start(){
  bindControls();openDialog('intro');
  try{
    const {BattleStage}=await import('./stage.js');
    stage=await BattleStage.create(canvas,stageEncounter(base,field.world),{quality:options.quality,reducedMotion:options.reducedMotion,input:false,
      keyboardMode:'grid',chapter:1,figureStyle:'sculpted',battleRemains:true,onFrame:()=>field.frameDone()});
    if(!stage)throw new Error('The 3D stage was not built.');
    stage.setAudio(options.sound,.6);field.attach(stage);
    await stage.ready;$('veil').classList.add('done');canvas.dataset.ready='true';
  }catch(error){
    console.error('Arena 3D:',error);
    $('veil').querySelector('p').textContent='The arena needs WebGL 2, which this browser could not start. Return to the campaign to play on turns.';
  }
}
// For the automated checks (scripts/arena-benchmark.mjs): read-only views and the same commands a player gives.
window.__arena={world:()=>field.world,clock:field.clock,metrics:field.metrics,stage:()=>stage,issue:command=>field.issue(command),
  pause:()=>field.act('pause'),runCheck};
start();
