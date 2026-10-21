import {clockText,commandable,missionProgress,queueCommand,roundOf,routePreview,snapshotWorld,step} from '../core/realtime/simulation.js';
import {advanceClock,clockAlpha,createClock,hurryClock,interruptClock,setPaused,setSlow,setSpeed,stepRound,stepping} from '../core/realtime/clock.js';
import {blowSummary,commandOptions,nearestUse,nextTarget,pointerIntent} from '../core/realtime/intents.js';
import {actorById,distanceBetween,forecast,liftable,validate} from '../core/realtime/abilities.js';
import {objectById} from '../core/realtime/motion.js';
import {ABILITIES,FIELD_BAR,FIELD_ORDER,REASONS,TIME} from '../data/realtime-rules.js';
import {createLivePresenter,simPoint,stageEncounter,stageTile} from './live-figures.js';
import {bindRealtimeInput} from './realtime-input.js';
import {DEFAULT_KEYMAP,actionFor,actionLabel,learnKey} from '../ui/action-map.js';

// The real-time field on the page (build brief §3.14–§3.16), shared by the
// campaign's battles (and later its camps) and by the standalone arena. It owns the
// clock, turns pointer and keys into Commands for the controlled man, keeps
// the HUD (party portraits, message line, battle clock, ability bar) and the
// battle log, and raises auto-pauses. The simulation decides everything; the
// stage draws it. Nothing here changes the chronicle: saving, results,
// panels and conversations go back to the page through the callbacks.
//
// dom: elements by role (missing ones are skipped; fieldDom reads them from
// data-role names). options: the player's settings, read as they change
// (gameSpeed, the auto-pause events, roundPause, drawToAttack, keepFighting,
// quickCast, holdToMove, swapButtons).

const SPEEDS=[.5,.75,1];
const ARROWS={move_up:[0,-1],move_down:[0,1],move_left:[-1,0],move_right:[1,0]};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

export const fieldDom=root=>({canvas:root.querySelector('canvas'),...Object.fromEntries([...root.querySelectorAll('[data-role]')].map(el=>[el.dataset.role,el]))});
// Who the stage draws: hidden enemies stay off it until they are seen.
const shownKey=world=>world.actors.filter(a=>!a.hidden||a.side!=='enemy').map(a=>a.id).join(',');

export function createRealtimeField({dom,world:initial,base:initialBase,options={},keymap=DEFAULT_KEYMAP,holdDelay=()=>450,callbacks={},kind='field'}){
  let world=initial,base=initialBase,stage=null,presenter=null,input=null,disposed=false;
  const clock=createClock({speed:SPEEDS.includes(Number(options.gameSpeed))?Number(options.gameSpeed):1});
  let ability='strike',keyTarget=null,hoverPoint=null,hoverDirty=false,pressMove=false,force=false,armed=null,ranges=false,arrows=new Set();
  let logShown=0,eventMessage=null,lastNow=0,hudKey='',partyKey='',barKey='',pausedFor=null,interrupted=false,ended=world.status!=='active',shown=shownKey(world);
  let resumePending=false,listOpen=false,listActor=null,listKey='';
  const metrics={ticks:[],clicks:[],clickFrames:[],frames:0,pending:null,moved:null};
  const canvas=dom.canvas;
  const me=()=>actorById(world,world.controlled);
  const say=(text,{warning=false,announce=false}={})=>{
    eventMessage={text,until:performance.now()+2600,warning};if(dom.eventLine){dom.eventLine.textContent=text;dom.eventLine.classList.toggle('warning',warning);}
    if(announce&&dom.announcer)dom.announcer.textContent=text;
  };
  const message=(text,warning=false)=>{const line=dom.messageLine;if(!line)return;if(line.textContent!==text)line.textContent=text;line.classList.toggle('warning',warning);};

  function issue(command){
    const outcome=queueCommand(world,command);
    if(!outcome.ok)say(REASONS[outcome.reason]??'That cannot be done now.',{warning:true});else{hurryClock(clock);showPlanned();}
    return outcome;
  }
  // While paused, a faint line shows what the controlled man will do on resume.
  function showPlanned(){
    if(!presenter)return;
    const order=clock.paused&&!stepping(clock)?[...world.queue].reverse().find(c=>c.actorId===world.controlled&&['move','attack','ability','interact','talk','loot'].includes(c.kind)):null;
    if(!order){presenter.setPlanned(null);return;}
    if(order.kind==='move'){presenter.setPlanned(routePreview(world,world.controlled,order.payload));return;}
    const id=order.payload.targetId??order.payload.objectId,target=actorById(world,id)??objectById(world,id)??(Number.isFinite(order.payload.x)?order.payload:null);
    presenter.setPlanned(target?{points:[{x:target.x,z:target.z}]}:null);
  }

  // ——— The loop: the world steps just before each frame that draws it. ———
  function beforeFrame(now){
    const dt=lastNow?now-lastNow:0;lastNow=now;metrics.frames++;if(!world||disposed)return;
    const ticks=advanceClock(clock,dt);interrupted=false;
    for(let i=0;i<ticks;i++){
      const start=performance.now();step(world);metrics.ticks.push(performance.now()-start);if(metrics.ticks.length>2400)metrics.ticks.shift();
      if(resumePending){resumePending=false;callbacks.onResume?.();}
      presenter?.onEvents(world.events);handleEvents(world.events);
      // An auto-pause stops the world at once: this frame's other ticks are dropped.
      if(interrupted)break;
    }
    const nowShown=shownKey(world);if(nowShown!==shown){shown=nowShown;stage?.sync(stageEncounter(base,world));}
    if(metrics.pending){const h=me();if(h&&(h.x!==metrics.pending.x||h.z!==metrics.pending.z)){metrics.moved=metrics.pending;metrics.pending=null;}}
    if(ticks)showPlanned();
    if(hoverPoint&&(hoverDirty||metrics.frames%6===0))readPointer();
    updateHud(now);
  }
  function frameDone(){
    if(!metrics.moved)return;metrics.clicks.push(performance.now()-metrics.moved.time);metrics.clickFrames.push(metrics.frames-metrics.moved.frame);
    if(metrics.clicks.length>50){metrics.clicks.shift();metrics.clickFrames.shift();}metrics.moved=null;
  }
  const nameOf=id=>actorById(world,id)?.name??'Someone';
  function handleEvents(events){
    const mine=world.controlled,party=new Set([world.heroId,...world.party]);
    for(const e of events){
      if(e.kind==='round'&&options.roundPause&&kind==='field')autoPause(`Round ${e.round} begins.`);
      if(e.kind==='notice'&&party.has(e.targetId)&&options.pauseSighted&&kind==='field'&&!actorById(world,e.actorId)?.practice)autoPause(`${nameOf(e.actorId)} has seen ${e.targetId===mine?'you':nameOf(e.targetId)}.`);
      if(e.kind==='hit'&&party.has(e.defenderId)){
        if(e.defenderId===mine)say(`${nameOf(e.attackerId)} hits you: ${e.damage}${e.critical?', a critical':''}.`,{warning:true,announce:true});
        const d=actorById(world,e.defenderId);if(options.pauseHurt&&d&&d.hp<d.maxHp*.25&&d.hp+e.damage>=d.maxHp*.25)autoPause(`${d.id===mine?'You are':`${d.name} is`} badly hurt.`);
      }
      if(e.kind==='hit'&&e.attackerId===mine)say(`You hit ${nameOf(e.defenderId)}: ${e.damage}${e.critical?e.ambush?', from ambush':', a critical':''}.`);
      if(e.kind==='block'&&e.attackerId===mine)say(`${nameOf(e.defenderId)} blocks your ${e.missile?'missile':'blow'}.`);
      if(e.kind==='stuck')say('The pilum sticks in his shield: it blocks half as often now.');
      if(e.kind==='fall')say(`${nameOf(e.defenderId)} falls.`,{announce:true});
      if(e.kind==='down')say(`${nameOf(e.defenderId)} is down: bind his wounds or carry him.`,{warning:true,announce:true});
      if(e.kind==='heal'&&party.has(e.actorId))say(`${nameOf(e.actorId)} binds ${e.targetId===e.actorId?'his own wounds':`${nameOf(e.targetId)}’s wounds`}: +${e.amount}.`,{announce:true});
      if(e.kind==='revealed')say(`${nameOf(e.actorId)} is revealed.`,{warning:true,announce:true});
      if(e.kind==='reinforcements')say('Enemy reinforcements arrive.',{warning:true,announce:true});
      if(e.kind==='phase'){say(`New objective: ${e.label}.`,{announce:true});if(options.pauseObjective)autoPause(`New objective: ${e.label}.`);}
      if(e.kind==='capability-needed')say(`Demonstrate: ${e.missing.join(', ')}.`,{warning:true,announce:true});
      if(e.kind==='work-stopped'&&e.actorId===mine)say('Your work is interrupted.',{warning:true});
      if(e.kind==='rejected'&&e.actorId===mine)say(REASONS[e.reason]??'That cannot be done now.',{warning:true});
      if(e.kind==='blocked'&&e.actorId===mine)say(REASONS[e.reason],{warning:true});
      if(e.kind==='war-cry')say(`${nameOf(e.actorId)} raises the war cry.${world.party.length?' The companions answer: “Roma!”':''}`);
      if(e.kind==='talk'&&e.actorId===mine)openSoon(()=>callbacks.onTalk?.(e.targetId));
      if(e.kind==='loot'&&e.actorId===mine)openSoon(()=>callbacks.onLoot?.(e.targetId));
      if(e.kind==='used-object')callbacks.onObject?.(e.objectId,e.actorId);
      if(['victory','defeat'].includes(e.kind)&&!ended){
        ended=true;say(e.kind==='victory'?'The objective is secured.':world.mission?.reason??'You have fallen.',{announce:true});
        const ending=world;setTimeout(()=>{if(!disposed&&world===ending)callbacks.onEnd?.(ending);},1600);
      }
    }
    if(world.log.length!==logShown||world.log.length&&world.log[world.log.length-1].tick!==Number(dom.log?.firstElementChild?.dataset.tick))renderLog();
  }
  // Conversations and loot windows open after this frame; they pause the world.
  function openSoon(open){setTimeout(()=>{if(!disposed)open();},0);}
  function autoPause(reason){interruptClock(clock);interrupted=true;say(`Paused: ${reason}`,{announce:true});saveResume('pause');}
  function renderLog(){
    if(!dom.log)return;
    dom.log.replaceChildren(...[...world.log].reverse().slice(0,30).map(entry=>{
      const li=document.createElement('li'),b=document.createElement('button'),t=document.createElement('time');li.dataset.tick=entry.tick;
      b.type='button';t.textContent=clockText(entry.tick);b.append(t,document.createTextNode(entry.text));
      if(Number.isFinite(entry.x))b.onclick=()=>{stage?.focusPoint(stageTile(entry.x,entry.z));say('The view moves there. F follows your soldier again.');};
      li.append(b);return li;}));
    logShown=world.log.length;
  }

  // ——— The HUD: written only when what it shows changes. ———
  const partyIds=()=>[world.heroId,...world.party];
  function abilitiesOf(actor){
    const known=actor?.abilities??FIELD_BAR;return FIELD_ORDER.filter(id=>known.includes(id)&&!ABILITIES[id].enemyOnly);
  }
  function buildParty(){
    if(!dom.party)return;
    dom.party.replaceChildren(...partyIds().map(id=>{
      const a=actorById(world,id),b=document.createElement('button');b.type='button';b.className='rt-portrait';b.dataset.actor=id;
      b.innerHTML=`<span class="rt-portrait-name">${esc(a?.name??id)}</span><span class="bar health"><i></i></span><span class="bar stamina"><i></i></span>`+
        `<span class="rt-portrait-mark" aria-hidden="true"></span><span class="visually-hidden rt-portrait-state"></span>`;
      b.addEventListener('click',()=>{takeControl(id);canvas.focus({preventScroll:true});});
      return b;
    }));
  }
  function buildAbilityBar(){
    if(!dom.abilityBar)return;const list=abilitiesOf(me());barKey=list.join(',');
    dom.abilityBar.replaceChildren(...list.map((id,i)=>{
      const b=document.createElement('button');b.type='button';b.className='ability';b.dataset.ability=id;b.tabIndex=i===0?0:-1;
      const key=actionLabel(`ability_${i+1}`,keymap);b.setAttribute('aria-keyshortcuts',key);
      b.innerHTML=`<kbd>${esc(key)}</kbd><span>${esc(ABILITIES[id].name)}</span><small></small>`;
      b.addEventListener('click',event=>{chooseAbility(id,{touch:event.pointerType==='touch'||armed!==null});canvas.focus({preventScroll:true});});
      return b;
    }));
    if(!list.includes(ability))ability='strike';
  }
  function abilityNote(id,a){
    const c=ABILITIES[id].cost??{};
    if(c.ammo)return `${a?.ammo?.[c.ammo]??0} ${c.ammo==='pilum'?'pila':c.ammo+'s'}`;if(c.bandage)return `${a?.bandages??0} bandages`;
    if(c.stamina)return `${c.stamina} Stamina`;return id==='carry'&&a?.carrying?'set down':'free';
  }
  // The mission's words; a 0.38 objective's turn limit reads as the fight's rounds.
  function objectiveText(){
    const text=world.mission?.objective??world.mission?.label??base?.objective??'';
    return world.mission?.deadline?text.replace(/\b(finish|hold|survive|secure)( [^.]*?)? by turn \d+/i,(m,verb,rest)=>`${verb}${rest??''} by round ${world.mission.deadline}`):text;
  }
  function updateHud(now){
    if(disposed)return;
    const h=me(),paused=clock.paused&&!stepping(clock),round=roundOf(world),progress=world.tick%TIME.roundTicks/TIME.roundTicks;
    if(abilitiesOf(h).join(',')!==barKey)buildAbilityBar();
    const bar=abilitiesOf(h),abilityState=bar.map(id=>{const target=ABILITIES[id].target==='self'?{}:keyTarget?{actorId:keyTarget}:null;
      return `${id}:${target?validate(world,world.controlled,id,target)??'ok':ABILITIES[id].cost?.ammo&&!(h?.ammo?.[ABILITIES[id].cost.ammo]>0)?'NO_AMMO':'ok'}`;}).join(',');
    const team=partyIds().map(id=>{const a=actorById(world,id);return a?`${a.hp}/${a.stamina}/${a.drawn}/${a.down}/${a.alive}/${a.carrying}`:'';}).join(';');
    const key=[team,world.controlled,h?.walkMode,h?.ammo?.pilum,h?.bandages,paused,clock.slow,clock.speed,round,Math.floor(progress*50),world.status,ability,
      armed,force,ranges,keyTarget,abilityState,world.mission?.phase,world.mission?.heldTicks>>4].join('|');
    if(eventMessage&&now>eventMessage.until){eventMessage=null;if(dom.eventLine)dom.eventLine.textContent='';}
    if(listOpen&&metrics.frames%10===0)renderList();
    if(key===hudKey)return;hudKey=key;callbacks.onHud?.(world);if(listOpen)renderList();
    if(partyIds().join(',')!==partyKey){partyKey=partyIds().join(',');buildParty();}
    for(const b of dom.party?.children??[]){
      const a=actorById(world,b.dataset.actor);if(!a)continue;
      b.querySelector('.health i').style.inlineSize=`${a.hp/a.maxHp*100}%`;b.querySelector('.stamina i').style.inlineSize=`${a.stamina/a.maxStamina*100}%`;
      b.classList.toggle('hurt',a.alive&&!a.down&&a.hp<a.maxHp*.25);b.classList.toggle('down',!a.alive||a.down);b.classList.toggle('drawn',!!a.drawn);
      b.classList.toggle('controlled',a.id===world.controlled);b.setAttribute('aria-pressed',String(a.id===world.controlled));
      b.title=`${a.name}: ${a.hp} of ${a.maxHp} Health, ${a.stamina} of ${a.maxStamina} Stamina${a.down?'; down':''}${a.drawn?'; weapon drawn':''}.`;
      b.querySelector('.rt-portrait-state').textContent=b.title;
    }
    if(h){
      dom.swordsButton?.setAttribute('aria-pressed',String(h.drawn));dom.walkButton?.setAttribute('aria-pressed',String(h.walkMode));
      if(dom.healthText)dom.healthText.textContent=`${h.hp} / ${h.maxHp}`;
    }
    if(dom.pauseButton){dom.pauseButton.textContent=paused?'Resume':'Pause';dom.pauseButton.setAttribute('aria-pressed',String(paused));}
    dom.slowButton?.setAttribute('aria-pressed',String(clock.slow));if(dom.stepButton)dom.stepButton.disabled=!paused||world.status!=='active';
    if(dom.pausedBand)dom.pausedBand.hidden=!paused;if(dom.roundLabel)dom.roundLabel.textContent=kind==='camp'?'Camp':`Round ${round}`;
    if(dom.clockTime)dom.clockTime.textContent=clockText(world.tick);dom.clockRing?.setAttribute('stroke-dasharray',`${Math.round(progress*100)} 100`);
    if(dom.currentAbility)dom.currentAbility.textContent=ABILITIES[ability]?.name??'Strike';dom.forceButton?.setAttribute('aria-pressed',String(force));
    dom.rangesButton?.setAttribute('aria-pressed',String(ranges));
    if(dom.objective)dom.objective.textContent=objectiveText();
    if(dom.progress&&world.mission)dom.progress.textContent=missionProgress(world);
    const states=Object.fromEntries(abilityState.split(',').filter(Boolean).map(s=>s.split(':')));
    for(const b of dom.abilityBar?.children??[]){
      const id=b.dataset.ability,state=states[id];b.setAttribute('aria-pressed',String(id===ability));b.classList.toggle('armed',id===armed);
      const off=state&&state!=='ok'&&state!=='NO_TARGET';b.classList.toggle('unavailable',off);b.title=off?REASONS[state]:ABILITIES[id].summary;
      b.querySelector('small').textContent=abilityNote(id,h);
    }
  }

  // ——— The Command list: every action as lists, with Use (guide "Command list"). ———
  function renderList(){
    if(!listOpen||!dom.listOptions||disposed)return;
    const party=partyIds().map(id=>actorById(world,id)).filter(a=>a?.alive&&!a.down);
    if(!party.some(a=>a.id===listActor))listActor=world.controlled;
    const options=commandOptions(world,{actorId:listActor}),key=`${listActor}|${options.map(o=>`${o.group}:${o.label}:${o.reason??''}`).join('|')}`;
    if(key===listKey){
      // Same choices: only the distances and forecasts change, in place.
      dom.listOptions.querySelectorAll('[data-option]').forEach(row=>{const o=options[Number(row.dataset.option)],d=row.querySelector('small');if(o&&d&&d.textContent!==o.detail)d.textContent=o.detail;});
      return;
    }
    listKey=key;const focused=document.activeElement?.closest?.('[data-option]')?.querySelector('span')?.textContent??null;
    if(dom.listActors)dom.listActors.replaceChildren(...party.map(a=>{
      const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='rt-list-actor';input.value=a.id;
      input.checked=a.id===listActor;input.addEventListener('change',()=>{listActor=a.id;listKey='';renderList();});label.append(input,document.createTextNode(` ${a.name}${a.id===world.controlled?' (controlled)':''}`));return label;}));
    const groups=[...new Set(options.map(o=>o.group))];
    dom.listOptions.replaceChildren(...groups.map(group=>{
      const section=document.createElement('section'),h=document.createElement('h3'),ul=document.createElement('ul');h.textContent=group;ul.className='rt-list';
      for(const [i,o]of options.entries()){
        if(o.group!==group)continue;
        const li=document.createElement('li'),text=document.createElement('span'),detail=document.createElement('small'),use=document.createElement('button');
        li.dataset.option=i;text.textContent=o.label;detail.textContent=o.reason?o.message:o.detail;use.type='button';use.textContent='Use';use.disabled=!o.command;
        if(o.command)use.addEventListener('click',()=>useOption(o));else use.title=o.message;
        li.append(text,detail,use);ul.append(li);
      }
      section.append(h,ul);return section;
    }));
    if(focused){const row=[...dom.listOptions.querySelectorAll('[data-option]')].find(r=>r.querySelector('span')?.textContent===focused);row?.querySelector('button:not(:disabled)')?.focus({preventScroll:true});}
  }
  function useOption(o){
    if(o.command.kind==='control'){takeControl(o.command.actorId);return;}
    const outcome=issue(o.command);if(outcome.ok){say(`${o.label}.`,{announce:true});listKey='';renderList();}
  }
  function toggleList(open=!listOpen){
    listOpen=open;if(dom.commandList)dom.commandList.hidden=!open;dom.listButton?.setAttribute('aria-pressed',String(open));listKey='';
    if(open){listActor=world.controlled;renderList();dom.listOptions?.querySelector('button:not(:disabled)')?.focus({preventScroll:true});}
  }

  // ——— Pointer: what is under it, and what a click there does. ———
  function pickAt(p){
    if(!p||!stage)return null;const r=stage.pickPoint(p),pick={};
    if(r.unitId)pick.actorId=r.unitId;if(r.ground)Object.assign(pick,simPoint(world,r.ground));
    if(!pick.actorId&&Number.isFinite(pick.x)){
      const object=(world.objects??[]).find(o=>Math.hypot(o.x-pick.x,o.z-pick.z)<=1.4);if(object)pick.objectId=object.id;
      const body=world.actors.filter(a=>!a.alive&&a.loot?.length&&Math.hypot(a.x-pick.x,a.z-pick.z)<=1.2)[0];if(body&&!object)pick.actorId=body.id;
    }
    return pick;
  }
  function intentAt(p,button,abilityId=ability){
    const pick=pickAt(p);if(!pick)return null;
    return pointerIntent(world,{pick,button,shift:!!p.shift||force,abilityId:button==='right'?abilityId:'strike'});
  }
  function hover(p){hoverPoint=p;hoverDirty=true;if(!p){canvas.dataset.cursor='walk';presenter?.setRoute(null);}}
  function readPointer(){
    hoverDirty=false;const p=hoverPoint;if(!p||!world||!stage)return;
    const it=intentAt(p,armed?'right':'left',armed??ability);if(!it)return;
    let text=it.message||' ';if(!armed&&ability!=='strike'){const right=intentAt(p,'right',ability);if(right?.message)text+=` · Right-click: ${right.message}`;}
    canvas.dataset.cursor=it.cursor;message(text,!!it.reason&&it.cursor!=='walk');presenter?.setRoute(it.command?.kind==='move'?it.route:null);
  }
  function press(p){
    stage?.sound?.unlock();if(document.activeElement!==canvas)canvas.focus({preventScroll:true});if(!world||world.status!=='active')return;
    const button=p.touch&&armed?'right':p.button,it=intentAt(p,button,armed??ability);if(!it)return;
    if(it.command){
      const h=me(),outcome=issue(it.command);
      if(outcome.ok&&it.command.kind==='move'){pressMove=true;metrics.pending={time:p.time||performance.now(),frame:metrics.frames,x:h.x,z:h.z};}
      if(outcome.ok&&button==='right'&&ABILITIES[armed??ability])say(`${ABILITIES[armed??ability].name}.`);
    }else if(it.message)say(it.message,{warning:!!it.reason});
    armed=null;force=false;hover(p);readPointer();
  }
  function hold(p){
    if(!pressMove||options.holdToMove===false||!world)return;const pick=pickAt(p);
    if(pick&&Number.isFinite(pick.x)&&!pick.actorId&&!pick.objectId)queueCommand(world,{actorId:world.controlled,kind:'move',payload:{x:pick.x,z:pick.z}});
  }
  function chooseAbility(id,{touch=false}={}){
    if(touch){if(armed===id){armed=null;useAbility(id,{});return;}armed=id;ability=id;say(`${ABILITIES[id].name}: tap the target.`);return;}
    if(ability===id){useAbility(id,keyTarget?{actorId:keyTarget}:{});return;}
    ability=id;say(`${ABILITIES[id].name} is ready: right-click the target, or press its number again.`);
  }
  function useAbility(id,target){
    if(id==='strike'){if(target.actorId)issue({actorId:world.controlled,kind:'attack',payload:{targetId:target.actorId}});else say(REASONS.NO_TARGET,{warning:true});return;}
    const self=ABILITIES[id].target==='self'||ABILITIES[id].selfIfNoTarget&&!target.actorId;
    const reason=validate(world,world.controlled,id,self?{}:target);
    if(reason){say(`${ABILITIES[id].name}: ${REASONS[reason]}`,{warning:true});return;}
    issue({actorId:world.controlled,kind:'ability',payload:{abilityId:id,...(target.actorId&&!self?{targetId:target.actorId}:{})}});
  }

  // ——— The party: a portrait, [ ] or Home takes direct control; the man left
  // behind resumes his standing orders. ———
  function takeControl(id){
    const a=actorById(world,id);if(!a||!commandable(world,a))return;
    if(a.down||!a.alive){say(`${a.name} is down.`,{warning:true});return;}
    if(id===world.controlled){keyTarget=null;follow();say(`${a.name}. The view follows him.`);return;}
    const outcome=queueCommand(world,{actorId:id,kind:'control'});
    if(outcome.ok){hurryClock(clock);step0(()=>{follow();buildAbilityBar();});say(`You control ${a.name}.`,{announce:true});}
  }
  // Run a callback once the queued command has been applied.
  function step0(fn){const at=world.tick;const check=()=>{if(disposed)return;if(world.tick>at||clock.paused){fn();return;}requestAnimationFrame(check);};check();}
  function cycleParty(dir){
    const list=partyIds().filter(id=>{const a=actorById(world,id);return a?.alive&&!a.down;});if(!list.length)return;
    const i=list.indexOf(world.controlled);takeControl(list[(i+dir+list.length)%list.length]);
  }

  // ——— Keys (bound by physical key; only while the scene has focus). ———
  function arrowMove(){
    const h=me();if(!h?.alive||!arrows.size)return;
    const yaw=stage?.orbit.yaw??0,fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);let dx=0,dz=0;
    for(const a of arrows){const [sx,sy]=ARROWS[a];dx+=rx*sx-fx*sy;dz+=rz*sx-fz*sy;}
    const d=Math.hypot(dx,dz);if(d<1e-6)return;
    queueCommand(world,{actorId:world.controlled,kind:'move',payload:{x:h.x+dx/d*1.6,z:h.z+dz/d*1.6}});
  }
  function announceStop(){
    const h=me();if(!h)return;
    const near=[...world.actors.filter(a=>a.alive&&a!==h&&!a.hidden),...(world.objects??[])].map(a=>({a,d:Math.hypot(a.x-h.x,a.z-h.z)})).sort((p,q)=>p.d-q.d)[0];
    if(dom.announcer)dom.announcer.textContent=`Stopped${near?`, ${Math.round(near.d)} metres from ${near.a.name}`:''}.`;
  }
  function describeTarget(id){
    const h=me(),t=actorById(world,id)??objectById(world,id);if(!t||!h)return '';
    const d=Math.round(Math.hypot(t.x-h.x,t.z-h.z));
    if(objectById(world,id))return `${t.name}, ${d} metres. E or Enter uses it.`;
    if(!t.alive)return `The body of ${t.name}, ${d} metres. Enter searches it.`;
    if(liftable(t))return `${t.name} is down, ${d} metres. Enter lifts him (weapon sheathed); the ability Bind wounds tends him.`;
    if(t.side==='enemy'){const f=forecast(world,world.controlled,'strike',{actorId:t.id});return `${t.name}, ${d} metres. ${f.blow?blowSummary(f):''}`;}
    return `${t.name}, ${d} metres.${t.talk?' Enter talks to him.':''}`;
  }
  function actOnTarget(forced){
    if(!keyTarget){say('Choose a target first (T).');return;}
    const object=objectById(world,keyTarget),t=actorById(world,keyTarget),h=me();
    if(object){issue({actorId:world.controlled,kind:'interact',payload:{objectId:object.id}});return;}
    if(!t){keyTarget=null;return;}
    if(!t.alive){issue({actorId:world.controlled,kind:'loot',payload:{targetId:t.id}});return;}
    if(!forced&&liftable(t)&&t.side!=='enemy'){issue({actorId:world.controlled,kind:'ability',payload:{abilityId:'carry',targetId:t.id}});return;}
    if(!forced&&t.side!=='enemy'&&t.talk&&!h?.drawn){issue({actorId:world.controlled,kind:'talk',payload:{targetId:t.id}});return;}
    issue({actorId:world.controlled,kind:'attack',payload:{targetId:t.id,...(forced?{forced:true}:{})}});
  }
  function act(action){
    const h=me();
    if(ARROWS[action]){arrows.add(action);arrowMove();return true;}
    if(action.startsWith('ability_')){
      const id=abilitiesOf(h)[Number(action.slice(8))-1];if(!id){say('No ability in that place.');return true;}
      if(options.quickCast&&hoverPoint&&id!=='strike'){
        ability=id;const it=intentAt(hoverPoint,'right',id);if(it?.command)issue(it.command);else say(it?.message||REASONS.NO_TARGET,{warning:true});return true;
      }
      chooseAbility(id);return true;
    }
    switch(action){
      case 'pause':togglePause();return true;
      case 'slow_time':if(kind==='camp')return true;setSlow(clock,!clock.slow);say(clock.slow?'Slow time: half speed.':'Normal time.');return true;
      case 'step_round':if(kind==='camp')return true;if(clock.paused){stepRound(clock);say('Playing one round…');}else say('Pause first (P) to play one round.');return true;
      case 'combat_toggle':if(h)issue({actorId:h.id,kind:'setDrawn',payload:{drawn:!pendingDrawn()}});return true;
      case 'walk_toggle':if(h){issue({actorId:h.id,kind:'setWalk',payload:{walk:!h.walkMode}});say(!h.walkMode?'Walking everywhere (W).':'Running again on far clicks.');}return true;
      case 'target_next_enemy':case 'target_next_friend':{
        keyTarget=nextTarget(world,{current:keyTarget,friends:action==='target_next_friend'});
        if(!keyTarget){say('No one to choose.');return true;}const text=describeTarget(keyTarget);
        if(dom.announcer)dom.announcer.textContent=text;message(text);return true;
      }
      case 'act_on_target':case 'force_attack_target':actOnTarget(action==='force_attack_target');return true;
      case 'interact_nearest':{const it=nearestUse(world);if(it?.command)issue(it.command);else say(it?.message||'Nothing to use within 3 metres.');return true;}
      case 'cancel_or_menu':
        if(armed||force){armed=null;force=false;say('Cancelled.');}else if(keyTarget){keyTarget=null;say('Target cleared.');}else callbacks.onMenu?.();return true;
      case 'camera_follow':follow();say('Following your soldier.');return true;
      case 'camera_overview':if(stage?.cameraView==='overview')follow();else stage?.home();return true;
      case 'camera_horizon':stage?.horizon();return true;
      case 'camera_rotate_left':case 'camera_rotate_right':if(stage){stage.orbit.yaw+=(action==='camera_rotate_left'?-1:1)*Math.PI/4;stage.wake();}return true;
      case 'zoom_in':stage?.zoom(-2);return true;case 'zoom_out':stage?.zoom(2);return true;
      case 'show_ranges':ranges=!ranges;presenter?.setRanges(ranges);return true;
      case 'show_usable':document.body.classList.add('labels-full');return true;
      case 'war_cry':if(h)issue({actorId:h.id,kind:'warCry'});return true;
      case 'quick_save':callbacks.onQuickSave?.(world);return true;
      case 'party_prev':cycleParty(-1);return true;case 'party_next':cycleParty(1);return true;
      case 'control_hero':takeControl(world.heroId);return true;
      case 'help':callbacks.onPanel?.('help');return true;
      case 'ability_bar':dom.abilityBar?.querySelector('[tabindex="0"]')?.focus();return true;
      default:
        if(action.startsWith('panel_')||action==='map_overlay'){callbacks.onPanel?.(action.replace('panel_',''));return true;}
        return false;
    }
  }
  function pendingDrawn(){const queued=[...world.queue].reverse().find(c=>c.kind==='setDrawn');return queued?queued.payload.drawn:!!me()?.drawn;}
  function togglePause(){
    const pause=!clock.paused||stepping(clock);setPaused(clock,pause);say(pause?'Paused.':'Resumed.',{announce:true});showPlanned();
    if(pause)saveResume('pause');else resumePending=true;
  }
  function saveResume(reason){if(world.status==='active')callbacks.onSave?.(world,reason);}
  function follow(){
    if(!stage)return;stage.selected=world.controlled;stage.focusMode=true;stage.cameraView='follow';
    Object.assign(stage.orbit,{pitch:.87,distance:Math.min(Math.max(stage.orbit.distance,9),16)});stage.wake();
  }
  function onKey(e){
    learnKey(e);if(e.repeat&&!e.key.startsWith('Arrow'))return;const action=actionFor(e,keymap);if(!action||!world||!stage)return;
    if(act(action))e.preventDefault();
  }
  function onKeyUp(e){
    const action=actionFor(e,keymap);
    if(ARROWS[action]){arrows.delete(action);if(!arrows.size){queueCommand(world,{actorId:world.controlled,kind:'stop'});announceStop();}}
    if(action==='show_usable')document.body.classList.remove('labels-full');
  }
  function onBlur(){if(arrows.size){arrows.clear();queueCommand(world,{actorId:world.controlled,kind:'stop'});}}
  function onHidden(){if(document.hidden){if(!clock.paused){setPaused(clock,true);say('Paused while the page was hidden.');}saveResume('hide');}}

  function bind(){
    const click=(el,fn)=>{if(el)el.onclick=()=>{fn();canvas.focus({preventScroll:true});};};
    click(dom.pauseButton,togglePause);click(dom.slowButton,()=>act('slow_time'));click(dom.stepButton,()=>act('step_round'));
    click(dom.swordsButton,()=>act('combat_toggle'));click(dom.walkButton,()=>act('walk_toggle'));
    click(dom.forceButton,()=>{force=!force;say(force?'Force: the next tap or click attacks whatever is there.':'Force cancelled.');});
    click(dom.rangesButton,()=>act('show_ranges'));
    if(dom.listButton)dom.listButton.onclick=()=>toggleList();
    if(dom.menuButton)dom.menuButton.onclick=()=>callbacks.onMenu?.();
    dom.abilityBar?.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const list=[...dom.abilityBar.children],i=list.indexOf(document.activeElement);if(i<0)return;
      e.preventDefault();const next=list[(i+(e.key==='ArrowRight'?1:list.length-1))%list.length];list.forEach(b=>b.tabIndex=b===next?0:-1);next.focus();
    });
    canvas.addEventListener('keydown',onKey);canvas.addEventListener('keyup',onKeyUp);canvas.addEventListener('blur',onBlur);
    document.addEventListener('visibilitychange',onHidden);addEventListener('pagehide',onHidden);
    input=bindRealtimeInput(canvas,{press,hold,release:()=>{pressMove=false;},hover,inspect:p=>{hover(p);readPointer();},
      rotate:(dy,dp)=>{if(!stage)return;stage.orbit.yaw+=dy;stage.orbit.pitch=Math.min(1.25,Math.max(.25,stage.orbit.pitch+dp));stage.wake();},
      zoom:d=>stage?.zoom(d)},{holdDelay,swapButtons:()=>!!options.swapButtons});
  }

  // The player's draw-to-attack and keep-fighting choices reach the world as a command.
  function applyOptions(){
    const wanted={drawToAttack:options.drawToAttack!==false,keepFighting:!!options.keepFighting};
    if(world.status==='active'&&Object.entries(wanted).some(([k,v])=>world.options[k]!==v))queueCommand(world,{actorId:world.heroId,kind:'setOptions',payload:wanted});
  }
  function resetPresenter(){
    presenter?.dispose();if(!stage)return;
    presenter=createLivePresenter(stage,{world:()=>world,alpha:()=>clockAlpha(clock),beforeFrame,paused:()=>clock.paused&&!stepping(clock)});
    stage.setLive(presenter);presenter.setRanges(ranges);
  }
  buildParty();buildAbilityBar();renderLog();bind();applyOptions();updateHud(0);
  return {
    get world(){return world;},get clock(){return clock;},get stage(){return stage;},metrics,frameDone,
    // The stage is built (or rebuilt) for this world: draw it live and follow the soldier.
    attach(next){const again=stage===next;stage=next;stage.sync(stageEncounter(base,world));if(again)stage.rebuildRemains?.();resetPresenter();follow();},
    // The stage's encounter for this world (the page builds the stage from it).
    stageView:()=>stageEncounter(base,world),
    // A different fight in the same place (a retry or a load): the HUD, log and figures start again from it.
    load(next,nextBase=base){
      world=next;base=nextBase;ended=world.status!=='active';shown=shownKey(world);logShown=0;hudKey='';partyKey='';barKey='';keyTarget=null;armed=null;force=false;
      eventMessage=null;setPaused(clock,false);applyOptions();buildParty();buildAbilityBar();renderLog();
      if(stage){stage.sync(stageEncounter(base,world));stage.rebuildRemains?.();resetPresenter();follow();}updateHud(performance.now());
    },
    // A panel, conversation or dialog pauses the world (Pause in panels), and gives it back.
    pauseFor(reason){if(!clock.paused){setPaused(clock,true);pausedFor=reason;saveResume('pause');}},
    release(reason){if(pausedFor&&(!reason||pausedFor===reason)){pausedFor=null;setPaused(clock,false);resumePending=true;}canvas.focus({preventScroll:true});},
    get paused(){return clock.paused&&!stepping(clock);},
    setSpeed(speed){setSpeed(clock,Number(speed));},
    setOption(key,value){options[key]=value;if(key==='gameSpeed')setSpeed(clock,Number(value));if(['drawToAttack','keepFighting'].includes(key))applyOptions();},
    issue,act,say,follow,takeControl,toggleList,
    snapshot:()=>snapshotWorld(world),
    dispose(){
      disposed=true;input?.dispose();presenter?.dispose();stage?.setLive(null);
      canvas.removeEventListener('keydown',onKey);canvas.removeEventListener('keyup',onKeyUp);canvas.removeEventListener('blur',onBlur);
      document.removeEventListener('visibilitychange',onHidden);removeEventListener('pagehide',onHidden);
    }
  };
}
