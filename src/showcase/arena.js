import {createShowcaseSession} from './session.js';
import {createArenaWorld} from '../core/realtime/arena.js';
import {createCrowdWorld,createSkirmishWorld} from '../core/realtime/benchmark-worlds.js';
import {clockText,queueCommand,restoreWorld,roundOf,routePreview,snapshotWorld,step} from '../core/realtime/simulation.js';
import {advanceClock,clockAlpha,createClock,hurryClock,interruptClock,setPaused,setSlow,setSpeed,stepRound,stepping} from '../core/realtime/clock.js';
import {blowSummary,nextTarget,pointerIntent} from '../core/realtime/intents.js';
import {actorById,forecast,validate} from '../core/realtime/abilities.js';
import {mix32} from '../core/realtime/rng-streams.js';
import {ABILITIES,FIELD_BAR,REASONS,TIME} from '../data/realtime-rules.js';
import {createLivePresenter,simPoint,stageEncounter,stageTile} from './live-figures.js';
import {bindRealtimeInput} from './realtime-input.js';
import {DEFAULT_KEYMAP,actionFor,actionLabel,learnKey,loadKeyLabels} from '../ui/action-map.js';
import {SETTINGS_KEY,loadSettings} from '../ui/settings.js';
import {createLongTaskLog,percentile} from '../ui/performance-check.js';

// The Phase 0 real-time arena (build brief §6): the standalone skirmish in
// real time with pause. The page owns the clock and turns pointer and keys
// into Commands; the simulation (src/core/realtime) decides everything; the
// stage draws it (live-figures.js). Nothing here changes the chronicle, and
// nothing is sent anywhere.

const $=id=>document.getElementById(id),canvas=$('scene');
const ARENA_KEY='imperium.arena';
const readJSON=(storage,key)=>{try{return JSON.parse(storage.getItem(key)??'null');}catch{return null;}};
const campaign=loadSettings((()=>{try{return localStorage.getItem(SETTINGS_KEY);}catch{return null;}})(),
  {reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
const options={speed:1,roundPause:false,sightedPause:false,drawToAttack:true,keepFighting:false,holdToMove:true,swapButtons:false,sound:false,quickCast:false,
  quality:campaign.quality,reducedMotion:campaign.reducedMotion,...(readJSON(localStorage,ARENA_KEY)??{})};
const saveOptions=()=>{try{localStorage.setItem(ARENA_KEY,JSON.stringify(options));}catch{}};
const keymap=DEFAULT_KEYMAP;loadKeyLabels();

// The map and the seed come from the campaign's own frontier road: the drill is
// replayed legally (session.js), and each fight takes the next seed from it.
const session=createShowcaseSession(),base=session.encounter,seedParam=Number(new URLSearchParams(location.search).get('seed'));
const seedFor=n=>Number.isInteger(seedParam)&&seedParam>0?mix32(seedParam+n-1):mix32(session.rng+Math.imul(n,0x9e3779b9));
let fight=0,world=null,stage=null,presenter=null,input=null,mode='arena';
const clock=createClock({speed:options.speed});
let ability='strike',keyTarget=null,hoverPoint=null,hoverDirty=false,pressMove=false,force=false,armed=null,ranges=false,arrows=new Set();
let logShown=0,resultTimer=0,eventMessage=null,lastNow=0,hudKey='',wins=0,losses=0,pausedForMenu=false,interrupted=false;
const metrics={ticks:[],clicks:[],clickFrames:[],frames:0,pending:null,moved:null};

function newWorld(){
  fight++;world=createArenaWorld(base,{seed:seedFor(fight),options:{keepFighting:options.keepFighting,drawToAttack:options.drawToAttack}});
  keyTarget=null;armed=null;force=false;logShown=0;$('battle-log').replaceChildren();clearTimeout(resultTimer);
}
const hero=()=>actorById(world,world.controlled);
function issue(command){
  const outcome=queueCommand(world,command);
  if(!outcome.ok)say(REASONS[outcome.reason]??'That cannot be done now.',{warning:true});else{hurryClock(clock);showPlanned();}
  return outcome;
}
// While paused, a faint line shows what the soldier will do on resume (the guide's Time section).
function showPlanned(){
  if(!presenter)return;
  const order=clock.paused&&!stepping(clock)
    ?[...world.queue].reverse().find(c=>c.actorId===world.controlled&&['move','attack','ability'].includes(c.kind)):null;
  if(!order){presenter.setPlanned(null);return;}
  if(order.kind==='move'){presenter.setPlanned(routePreview(world,world.controlled,order.payload));return;}
  const target=actorById(world,order.payload.targetId)??(Number.isFinite(order.payload.x)?order.payload:null);
  presenter.setPlanned(target?{points:[{x:target.x,z:target.z}]}:null);
}

// Messages: the message line (what the pointer would do), the event line
// (what just happened) and polite announcements for screen readers.
function say(text,{warning=false,announce=false}={}){
  eventMessage={text,until:performance.now()+2600,warning};$('event-line').textContent=text;$('event-line').classList.toggle('warning',warning);
  if(announce)$('announcer').textContent=text;
}
function message(text,warning=false){const line=$('message-line');if(line.textContent!==text)line.textContent=text;line.classList.toggle('warning',warning);}

// ——— The loop: the world steps just before each frame that draws it. ———
function beforeFrame(now){
  const dt=lastNow?now-lastNow:0;lastNow=now;metrics.frames++;if(!world)return;
  const ticks=advanceClock(clock,dt);interrupted=false;
  for(let i=0;i<ticks;i++){
    const start=performance.now();step(world);metrics.ticks.push(performance.now()-start);if(metrics.ticks.length>2400)metrics.ticks.shift();
    presenter.onEvents(world.events);handleEvents(world.events);
    // An auto-pause stops the world at once: this frame's other ticks are dropped.
    if(interrupted)break;
  }
  if(metrics.pending){const h=hero();if(h&&(h.x!==metrics.pending.x||h.z!==metrics.pending.z)){metrics.moved=metrics.pending;metrics.pending=null;}}
  if(ticks)showPlanned();
  // What the pointer would do: once a frame at most, and again as men move under it.
  if(hoverPoint&&(hoverDirty||metrics.frames%6===0))readPointer();
  updateHud(now);
}
// A click's first visible movement: measured after the frame that draws it,
// in milliseconds and in frames (the frame after the click is the first one possible).
function frameDone(){
  if(!metrics.moved)return;metrics.clicks.push(performance.now()-metrics.moved.time);metrics.clickFrames.push(metrics.frames-metrics.moved.frame);
  if(metrics.clicks.length>50){metrics.clicks.shift();metrics.clickFrames.shift();}metrics.moved=null;
}
function handleEvents(events){
  const me=world.controlled;
  for(const e of events){
    if(e.kind==='round'&&options.roundPause)autoPause(`Round ${e.round} begins.`);
    if(e.kind==='notice'&&e.targetId===me&&options.sightedPause)autoPause(`${actorById(world,e.actorId)?.name??'An enemy'} has seen you.`);
    if(e.kind==='hit'&&e.defenderId===me)say(`${actorById(world,e.attackerId).name} hits you: ${e.damage}${e.critical?', a critical':''}.`,{warning:true,announce:true});
    if(e.kind==='hit'&&e.attackerId===me)say(`You hit ${actorById(world,e.defenderId).name}: ${e.damage}${e.critical?', a critical':''}.`);
    if(e.kind==='block'&&e.attackerId===me)say(`${actorById(world,e.defenderId).name} blocks your ${e.missile?'pilum':'blow'}.`);
    if(e.kind==='stuck')say('The pilum sticks in his shield: it blocks half as often now.');
    if(e.kind==='fall')say(`${actorById(world,e.defenderId).name} falls.`,{announce:true});
    if(e.kind==='rejected'&&e.actorId===me)say(REASONS[e.reason]??'That cannot be done now.',{warning:true});
    if(e.kind==='blocked'&&e.actorId===me)say(REASONS[e.reason],{warning:true});
    if(['victory','defeat'].includes(e.kind)){
      if(e.kind==='victory')wins++;else losses++;say(e.kind==='victory'?'The road is clear.':'You have fallen.',{announce:true});
      clearTimeout(resultTimer);resultTimer=setTimeout(showResult,1600);
    }
  }
  if(world.log.length!==logShown||world.log.length&&world.log[world.log.length-1].tick!==Number($('battle-log').firstElementChild?.dataset.tick))renderLog();
}
function autoPause(reason){interruptClock(clock);interrupted=true;say(`Paused: ${reason}`,{announce:true});}
function renderLog(){
  const list=$('battle-log');list.replaceChildren(...[...world.log].reverse().slice(0,30).map(entry=>{
    const li=document.createElement('li'),b=document.createElement('button'),t=document.createElement('time');li.dataset.tick=entry.tick;
    b.type='button';t.textContent=clockText(entry.tick);b.append(t,document.createTextNode(entry.text));
    if(Number.isFinite(entry.x))b.onclick=()=>{stage?.focusPoint(stageTile(entry.x,entry.z));say('The view moves there. F follows your soldier again.');};
    li.append(b);return li;}));
  logShown=world.log.length;
}

// ——— The HUD: written only when what it shows changes. ———
function updateHud(now){
  const h=hero(),paused=clock.paused&&!stepping(clock),round=roundOf(world),progress=world.tick%TIME.roundTicks/TIME.roundTicks;
  const abilityState=FIELD_BAR.map(id=>{const target=ABILITIES[id].target==='self'?{}:keyTarget?{actorId:keyTarget}:null;
    return `${id}:${target?validate(world,world.controlled,id,target)??'ok':id==='throw_pilum'&&!(h?.ammo.pilum>0)?'NO_AMMO':'ok'}`;}).join(',');
  const key=[h?.hp,h?.stamina,h?.drawn,h?.walkMode,h?.ammo.pilum,h?.alive,paused,clock.slow,clock.speed,round,Math.floor(progress*50),world.status,ability,
    armed,force,ranges,keyTarget,abilityState].join('|');
  if(eventMessage&&now>eventMessage.until){eventMessage=null;$('event-line').textContent='';}
  if(key===hudKey)return;hudKey=key;
  if(h){
    $('health-bar').querySelector('i').style.inlineSize=`${h.hp/h.maxHp*100}%`;$('health-text').textContent=`${h.hp} / ${h.maxHp} Health`;
    $('health-bar').setAttribute('aria-valuenow',h.hp);$('health-bar').setAttribute('aria-valuemax',h.maxHp);
    $('stamina-bar').querySelector('i').style.inlineSize=`${h.stamina/h.maxStamina*100}%`;$('stamina-text').textContent=`${h.stamina} / ${h.maxStamina} Stamina`;
    $('stamina-bar').setAttribute('aria-valuenow',h.stamina);$('stamina-bar').setAttribute('aria-valuemax',h.maxStamina);
    $('hero-card').classList.toggle('hurt',h.alive&&h.hp<h.maxHp*.25);$('hero-card').classList.toggle('down',!h.alive);
    $('swords-button').setAttribute('aria-pressed',String(h.drawn));$('walk-button').setAttribute('aria-pressed',String(h.walkMode));
  }
  $('pause-button').textContent=paused?'Resume':'Pause';$('pause-button').setAttribute('aria-pressed',String(paused));
  $('slow-button').setAttribute('aria-pressed',String(clock.slow));$('step-button').disabled=!paused||world.status!=='active';
  $('paused-band').hidden=!paused;$('round-label').textContent=`Round ${round}`;$('clock-time').textContent=clockText(world.tick);
  $('clock-ring').setAttribute('stroke-dasharray',`${Math.round(progress*100)} 100`);
  $('current-ability').textContent=ABILITIES[ability].name;$('force-button').setAttribute('aria-pressed',String(force));
  $('ranges-button').setAttribute('aria-pressed',String(ranges));
  const states=Object.fromEntries(abilityState.split(',').map(s=>s.split(':')));
  for(const b of $('ability-bar').children){
    const id=b.dataset.ability,state=states[id];b.setAttribute('aria-pressed',String(id===ability));b.classList.toggle('armed',id===armed);
    b.classList.toggle('unavailable',state!=='ok'&&state!=='NO_TARGET');b.title=state!=='ok'&&state!=='NO_TARGET'?REASONS[state]:ABILITIES[id].summary;
    const note=b.querySelector('small');note.textContent=id==='throw_pilum'?`${h?.ammo.pilum??0} pila`:id==='brace'?'15 Stamina':'free';
  }
}
function buildAbilityBar(){
  $('ability-bar').replaceChildren(...FIELD_BAR.map((id,i)=>{
    const b=document.createElement('button');b.type='button';b.className='ability';b.dataset.ability=id;b.tabIndex=i===0?0:-1;
    b.setAttribute('aria-keyshortcuts',actionLabel(`ability_${i+1}`,keymap));
    b.innerHTML=`<kbd>${actionLabel(`ability_${i+1}`,keymap)}</kbd><span>${ABILITIES[id].name}</span><small></small>`;
    b.addEventListener('click',event=>{chooseAbility(id,{touch:event.pointerType==='touch'||armed!==null});canvas.focus({preventScroll:true});});
    return b;
  }));
  // Roving focus: the arrow keys move along the bar.
  $('ability-bar').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const list=[...$('ability-bar').children],i=list.indexOf(document.activeElement);if(i<0)return;
    e.preventDefault();const next=list[(i+(e.key==='ArrowRight'?1:list.length-1))%list.length];list.forEach(b=>b.tabIndex=b===next?0:-1);next.focus();
  });
}

// ——— Pointer: what is under it, and what a click there does. ———
function pickAt(p){
  if(!p||!stage)return null;const r=stage.pickPoint(p),pick={};
  if(r.unitId)pick.actorId=r.unitId;if(r.ground)Object.assign(pick,simPoint(world,r.ground));return pick;
}
function intentAt(p,button,abilityId=ability){
  const pick=pickAt(p);if(!pick)return null;
  return pointerIntent(world,{pick,button,shift:!!p.shift||force,abilityId:button==='right'?abilityId:'strike'});
}
function hover(p){
  hoverPoint=p;hoverDirty=true;if(!p){canvas.dataset.cursor='walk';presenter?.setRoute(null);}
}
function readPointer(){
  hoverDirty=false;const p=hoverPoint;if(!p||!world||!stage)return;
  const it=intentAt(p,armed?'right':'left',armed??ability);if(!it)return;
  // With an ability chosen, the right button's forecast follows the left button's.
  let text=it.message||' ';if(!armed&&ability!=='strike'){const right=intentAt(p,'right',ability);if(right?.message)text+=` · Right-click: ${right.message}`;}
  canvas.dataset.cursor=it.cursor;message(text,!!it.reason&&it.cursor!=='walk');presenter.setRoute(it.command?.kind==='move'?it.route:null);
}
function press(p){
  stage?.sound?.unlock();if(!world)return;
  const button=p.touch&&armed?'right':p.button,it=intentAt(p,button,armed??ability);if(!it)return;
  if(it.command){
    const h=hero(),outcome=issue(it.command);
    if(outcome.ok&&it.command.kind==='move'){pressMove=true;metrics.pending={time:p.time||performance.now(),frame:metrics.frames,x:h.x,z:h.z};}
    if(outcome.ok&&button==='right'&&ABILITIES[armed??ability])say(`${ABILITIES[armed??ability].name}.`);
  }else if(it.message)say(it.message,{warning:!!it.reason});
  armed=null;force=false;hover(p);readPointer();
}
function hold(p){
  if(!pressMove||!options.holdToMove||!world)return;const pick=pickAt(p);
  if(pick&&Number.isFinite(pick.x)&&!pick.actorId)queueCommand(world,{actorId:world.controlled,kind:'move',payload:{x:pick.x,z:pick.z}});
}
function chooseAbility(id,{touch=false}={}){
  if(touch){
    // Touch: a tap arms the ability for the next tap; tapping it again uses it on yourself.
    if(armed===id){armed=null;useAbility(id,{});return;}armed=id;ability=id;say(`${ABILITIES[id].name}: tap the target.`);return;
  }
  if(ability===id){useAbility(id,keyTarget?{actorId:keyTarget}:{});return;}
  ability=id;say(`${ABILITIES[id].name} is ready: right-click the target, or press its number again.`);
}
function useAbility(id,target){
  if(id==='strike'){if(target.actorId)issue({actorId:world.controlled,kind:'attack',payload:{targetId:target.actorId}});else say(REASONS.NO_TARGET,{warning:true});return;}
  const reason=validate(world,world.controlled,id,ABILITIES[id].target==='self'?{}:target);
  if(reason){say(`${ABILITIES[id].name}: ${REASONS[reason]}`,{warning:true});return;}
  issue({actorId:world.controlled,kind:'ability',payload:{abilityId:id,...(target.actorId?{targetId:target.actorId}:{})}});
}

// ——— Keys (bound by physical key; only while the scene has focus). ———
const ARROWS={move_up:[0,-1],move_down:[0,1],move_left:[-1,0],move_right:[1,0]};
function arrowMove(){
  const h=hero();if(!h?.alive||!arrows.size)return;
  const yaw=stage?.orbit.yaw??0,fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);let dx=0,dz=0;
  for(const a of arrows){const [sx,sy]=ARROWS[a];dx+=rx*sx-fx*sy;dz+=rz*sx-fz*sy;}
  const d=Math.hypot(dx,dz);if(d<1e-6)return;
  queueCommand(world,{actorId:world.controlled,kind:'move',payload:{x:h.x+dx/d*1.6,z:h.z+dz/d*1.6}});
}
function announceStop(){
  const h=hero();if(!h)return;const near=world.actors.filter(a=>a.alive&&a!==h).map(a=>({a,d:Math.hypot(a.x-h.x,a.z-h.z)})).sort((p,q)=>p.d-q.d)[0];
  $('announcer').textContent=`Stopped${near?`, ${Math.round(near.d)} metres from ${near.a.name}`:''}.`;
}
function act(action,event){
  const h=hero();
  if(ARROWS[action]){arrows.add(action);arrowMove();return true;}
  if(action.startsWith('ability_')){
    const id=FIELD_BAR[Number(action.slice(8))-1];if(!id){say('No ability in that place.');return true;}
    // Quick-cast: the number uses the ability at the pointer at once.
    if(options.quickCast&&hoverPoint&&id!=='strike'){
      ability=id;const it=intentAt(hoverPoint,'right',id);if(it?.command)issue(it.command);else say(it?.message||REASONS.NO_TARGET,{warning:true});return true;
    }
    chooseAbility(id);return true;
  }
  switch(action){
    case 'pause':togglePause();return true;
    case 'slow_time':setSlow(clock,!clock.slow);say(clock.slow?'Slow time: half speed.':'Normal time.');return true;
    case 'step_round':if(clock.paused){stepRound(clock);say('Playing one round…');}else say('Pause first (P) to play one round.');return true;
    case 'combat_toggle':if(h)issue({actorId:h.id,kind:'setDrawn',payload:{drawn:!pendingDrawn()}});return true;
    case 'walk_toggle':
      if(h){issue({actorId:h.id,kind:'setWalk',payload:{walk:!h.walkMode}});say(!h.walkMode?'Walking everywhere (W).':'Running again on far clicks.');}return true;
    case 'target_next_enemy':case 'target_next_friend':{
      keyTarget=nextTarget(world,{current:keyTarget,friends:action==='target_next_friend'});const t=actorById(world,keyTarget);
      if(!t){say('No one to choose.');return true;}
      const f=forecast(world,world.controlled,action==='target_next_friend'?'brace':'strike',{actorId:t.id});
      $('announcer').textContent=`${t.name}, ${Math.round(Math.hypot(t.x-h.x,t.z-h.z))} metres. ${f.blow?blowSummary(f):''}`;
      message(`${t.name}: ${f.blow?blowSummary(f):'a friend.'}`);return true;
    }
    case 'act_on_target':case 'force_attack_target':
      if(keyTarget)issue({actorId:world.controlled,kind:'attack',payload:{targetId:keyTarget,...(action==='force_attack_target'?{forced:true}:{})}});
      else say('Choose a target first (T).');return true;
    case 'interact_nearest':say('Nothing to use within 3 metres.');return true;
    case 'cancel_or_menu':if(armed||force){armed=null;force=false;say('Cancelled.');}else if(keyTarget){keyTarget=null;say('Target cleared.');}else openMenu();return true;
    case 'camera_follow':follow();say('Following your soldier.');return true;
    case 'camera_overview':if(stage.cameraView==='overview'){follow();}else{stage.home();}return true;
    case 'camera_horizon':stage.horizon();return true;
    case 'camera_rotate_left':case 'camera_rotate_right':stage.orbit.yaw+=(action==='camera_rotate_left'?-1:1)*Math.PI/4;stage.wake();return true;
    case 'zoom_in':stage.zoom(-2);return true;case 'zoom_out':stage.zoom(2);return true;
    case 'show_ranges':ranges=!ranges;presenter.setRanges(ranges);return true;
    case 'show_usable':document.body.classList.add('labels-full');return true;
    case 'war_cry':say(`${h?.name??'Your soldier'} raises the war cry. It changes nothing in the rules.`);return true;
    case 'quick_save':say('Saving arrives with Phase 1; the arena keeps no saves.');return true;
    case 'help':openDialog('intro');return true;
    case 'ability_bar':$('ability-bar').querySelector('[tabindex="0"]')?.focus();return true;
    default:
      if(action.startsWith('panel_')||action==='map_overlay'){say('Panels arrive with Phase 1.');return true;}
      return false;
  }
}
// Space after Space while paused: the queued choice counts, not the drawn state alone.
function pendingDrawn(){const queued=[...world.queue].reverse().find(c=>c.kind==='setDrawn');return queued?queued.payload.drawn:!!hero()?.drawn;}
function togglePause(){
  const pause=!clock.paused||stepping(clock);setPaused(clock,pause);say(pause?'Paused.':'Resumed.',{announce:true});showPlanned();
}
function follow(){
  if(!stage)return;stage.selected=world.controlled;stage.focusMode=true;stage.cameraView='follow';
  Object.assign(stage.orbit,{pitch:.87,distance:Math.min(Math.max(stage.orbit.distance,9),16)});stage.wake();
}

// ——— Menus and dialogs: opening one pauses the world. ———
function openDialog(id){
  const dialog=$(id);if(dialog.open)return;
  if(!clock.paused){setPaused(clock,true);pausedForMenu=true;}
  dialog.showModal();
}
function closeDialog(id){
  const dialog=$(id);if(dialog.open)dialog.close();
  if(pausedForMenu&&![...document.querySelectorAll('dialog')].some(d=>d.open)){pausedForMenu=false;setPaused(clock,false);}
  canvas.focus({preventScroll:true});
}
function openMenu(){
  $('session-note').textContent=`This visit: ${fight} fight${fight===1?'':'s'}, ${wins} won, ${losses} lost. Nothing is recorded or sent.`;openDialog('menu');
}
function showResult(){
  const h=hero(),won=world.status==='won',seconds=Math.round(world.tick/TIME.ticksPerSecond);
  $('result-title').textContent=won?'The road is clear.':'You have fallen.';
  $('result-summary').textContent=won?`Three raiders defeated in ${seconds} seconds of battle time, with ${h.hp} of ${h.maxHp} Health left.`
    :`The raiders hold the road after ${seconds} seconds. Try a pilum before they close, brace against a heavy blow, or put a rock at your back.`;
  openDialog('result');
}
function restart(){
  closeDialog('result');closeDialog('menu');newWorld();
  stage.sync(stageEncounter(base,world));stage.rebuildRemains();resetPresenter();follow();setPaused(clock,false);
  say('A fresh fight. The raiders wait by the cart.',{announce:true});
}
function resetPresenter(){
  presenter?.dispose();
  presenter=createLivePresenter(stage,{world:()=>world,alpha:()=>clockAlpha(clock),beforeFrame,paused:()=>clock.paused&&!stepping(clock)});
  stage.setLive(presenter);presenter.setRanges(ranges);
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
  const saved=snapshotWorld(world),savedMode=mode,longTasks=createLongTaskLog();
  try{
    status.textContent='Building a 15-man skirmish…';mode='check';
    world=createSkirmishWorld(base,{seed:seedFor(fight)});stage.sync(stageEncounter(base,world));resetPresenter();
    // The new men are built, their programs compiled and their geometry sent before anything is measured.
    status.textContent='Preparing 15 men…';stage.ready=stage.prepare();await stage.ready;
    $('check').close();setPaused(clock,false);stage.home();metrics.ticks.length=0;
    const log=stage.startFrameLog(),start=performance.now();
    await new Promise(done=>{const turn=()=>{const t=performance.now();if(t-start>=12000)return done();stage.orbit.yaw+=.004;requestAnimationFrame(turn);};turn();});
    stage.stopFrameLog();setPaused(clock,true);
    const intervals=log.frames.map(f=>f[2]).filter(ms=>ms>0),p50=percentile(intervals,.5),fps=p50?Math.round(1000/p50):null;
    status.textContent='Timing the simulation…';$('check').showModal();await new Promise(done=>setTimeout(done,30));
    const report={tool:'imperium-arena-check',version:1,measuredAt:new Date().toISOString(),quality:stage.quality,
      render:{actors:world.actors.length,seconds:12,frames:log.frames.length,fps,intervalMs:stats(intervals),cpuMs:stats(log.frames.map(f=>f[1])),
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
    longTasks.dispose?.();mode=savedMode;world=restoreWorld(saved);stage.sync(stageEncounter(base,world));stage.rebuildRemains();resetPresenter();follow();
    setPaused(clock,true);renderLog();stage.ready=stage.prepare();
  }
}

// ——— Wiring. ———
function bindControls(){
  $('pause-button').onclick=()=>{togglePause();canvas.focus({preventScroll:true});};
  $('slow-button').onclick=()=>{act('slow_time');canvas.focus({preventScroll:true});};
  $('step-button').onclick=()=>{act('step_round');canvas.focus({preventScroll:true});};
  $('swords-button').onclick=()=>{act('combat_toggle');canvas.focus({preventScroll:true});};
  $('walk-button').onclick=()=>{act('walk_toggle');canvas.focus({preventScroll:true});};
  $('force-button').onclick=()=>{force=!force;say(force?'Force: the next tap or click attacks whatever is there.':'Force cancelled.');canvas.focus({preventScroll:true});};
  $('ranges-button').onclick=()=>{act('show_ranges');canvas.focus({preventScroll:true});};
  $('portrait').onclick=()=>{keyTarget=null;follow();say('Your soldier. The view follows him.');canvas.focus({preventScroll:true});};
  $('menu-button').onclick=openMenu;$('resume-button').onclick=()=>closeDialog('menu');$('restart-button').onclick=restart;
  $('again-button').onclick=restart;$('inspect-button').onclick=()=>closeDialog('result');$('help-button').onclick=()=>{closeDialog('menu');openDialog('intro');};
  $('begin-button').onclick=()=>closeDialog('intro');$('check-button').onclick=runCheck;$('check-close').onclick=()=>closeDialog('check');
  for(const id of ['intro','menu','result','check'])$(id).addEventListener('close',()=>closeDialog(id));
  const settings={'speed-setting':['speed',v=>{setSpeed(clock,Number(v));return clock.speed;}],'quality-setting':['quality',v=>{stage?.applyQuality(v);return v;}]};
  for(const [id,[key,apply]]of Object.entries(settings)){$(id).value=String(options[key]);$(id).onchange=e=>{options[key]=apply(e.target.value);saveOptions();};}
  const checks={'round-pause':'roundPause','sighted-pause':'sightedPause','draw-to-attack':'drawToAttack','keep-fighting':'keepFighting','hold-to-move':'holdToMove',
    'swap-buttons':'swapButtons','sound-setting':'sound','motion-setting':'reducedMotion','quick-cast':'quickCast'};
  for(const [id,key]of Object.entries(checks)){$(id).checked=!!options[key];$(id).onchange=e=>{
    options[key]=e.target.checked;saveOptions();
    if(['drawToAttack','keepFighting'].includes(key))queueCommand(world,{actorId:world.controlled,kind:'setOptions',payload:{[key]:options[key]}});
    if(key==='sound')stage?.setAudio(options.sound,.6);if(key==='reducedMotion')stage?.setReducedMotion(options.reducedMotion);
  };}
  canvas.addEventListener('keydown',e=>{
    learnKey(e);if(e.repeat&&!e.key.startsWith('Arrow'))return;const action=actionFor(e,keymap);if(!action||!world||!stage)return;
    if(act(action,e))e.preventDefault();
  });
  canvas.addEventListener('keyup',e=>{
    const action=actionFor(e,keymap);
    if(ARROWS[action]){arrows.delete(action);if(!arrows.size){queueCommand(world,{actorId:world.controlled,kind:'stop'});announceStop();}}
    if(action==='show_usable')document.body.classList.remove('labels-full');
  });
  canvas.addEventListener('blur',()=>{if(arrows.size){arrows.clear();queueCommand(world,{actorId:world.controlled,kind:'stop'});}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!clock.paused){setPaused(clock,true);say('Paused while the page was hidden.');}});
  input=bindRealtimeInput(canvas,{press,hold,release:()=>{pressMove=false;},hover,inspect:p=>{hover(p);readPointer();},
    rotate:(dy,dp)=>{if(!stage)return;stage.orbit.yaw+=dy;stage.orbit.pitch=Math.min(1.25,Math.max(.25,stage.orbit.pitch+dp));stage.wake();},
    zoom:d=>stage?.zoom(d)},{holdDelay:()=>campaign.holdDelay??450,swapButtons:()=>options.swapButtons});
}

async function start(){
  newWorld();buildAbilityBar();bindControls();updateHud(0);openDialog('intro');
  try{
    const {BattleStage}=await import('./stage.js');
    stage=await BattleStage.create(canvas,stageEncounter(base,world),{quality:options.quality,reducedMotion:options.reducedMotion,input:false,
      keyboardMode:'grid',chapter:1,figureStyle:'sculpted',battleRemains:true,onFrame:frameDone});
    if(!stage)throw new Error('The 3D stage was not built.');
    stage.setAudio(options.sound,.6);resetPresenter();follow();
    await stage.ready;$('veil').classList.add('done');canvas.dataset.ready='true';
  }catch(error){
    console.error('Arena 3D:',error);
    $('veil').querySelector('p').textContent='The arena needs WebGL 2, which this browser could not start. Return to the campaign to play on turns.';
  }
}
// For the automated checks (scripts/arena-benchmark.mjs): read-only views and the same commands a player gives.
window.__arena={world:()=>world,clock,metrics,stage:()=>stage,issue:command=>queueCommand(world,command),pause:()=>togglePause(),runCheck};
start();
