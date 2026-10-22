import * as Chamber from '../core/chamber.js';
import {getActions,agreementOptions} from '../core/game.js';
import {MAGISTRATE,discessio,placeChamberWorld,pointTile,syncChamberWorld,tilePoint,walkRoute} from '../core/realtime/chamber-world.js';
import {actionLabel,firstKeyLabel} from '../ui/action-map.js';
import {hourly} from '../ui/view-helpers.js';
import {delegatePortrait} from '../ui/delegate-portrait.js';

// The walk-and-talk Curia on the page (build brief §3.11; guide "Political
// Contests"): the chamber's part of the real-time field, which hands it the
// pointer, the keys and the HUD as it does the squads. Here are the hour's reach
// and walks, talking and the conversation panel, the speech bar and right-click
// speeches, yielding, the rivals' hour played out (skippable), the coalition
// strip with the Whip Forecast, U for the rivals' next walks and the division
// at the vote. The rules are the 0.38 Contest's (chamber.js): every change goes
// to the page through rules.apply, which records it in the chronicle and gives
// back what happened. The world (chamber-world.js) only walks people to the
// places the rules have put them.
//
// rules: {state(), apply(op) → Promise of the outcome (null when the page was busy),
// known(id), ask(id), inspect(caseId)}; ops: {kind:'walk', unitId, tile},
// {kind:'speak', command}, {kind:'yield'}. In a hearing a presiding magistrate
// stands at the tribunal: he receives the documents, from his conversation or
// dragged onto the tribunal. The Motion panel holds the policy debate, the career
// precedents and the hearing's documents.

const MOTION='#motion',DOCUMENT='application/x-imperium-document',TRIBUNAL_REACH=4;

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const signed=n=>`${n>0?'+':''}${n}`;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const SHOW={min:3000,max:6000,line:1500,division:5200};
const ARROWS={move_up:[0,-1],move_down:[0,1],move_left:[-1,0],move_right:[1,0]};
// What a speech's bar button says it reaches (0.38 tiles as the chamber's metres).
const reachNote=action=>action==='address'?`${Chamber.SPEECH_REACH.address*Chamber.SEAT} m around`:action==='persuade'?'beside him':`${Chamber.SPEECH_REACH[action]*Chamber.SEAT} m`;

export function createChamberControl({world:getWorld,dom,say:speak,message:line,presenter:getPresenter,canvas,keymap,rules,takeControl,pick=null,paused=()=>false,announce=()=>{}}){
  const say=(text,options)=>speak(hourly(text),options),message=(text,warning)=>line(hourly(text),warning);
  let speech='persuade',armed=null,target=null,talking=null,show=null,hover=null,keyboardTarget=false,targetKey='';
  let partyKey='',barKey='',hudKey='',coalitionKey='',reachKey='',logKey='',badgesKey='',lastNow=0;
  const state=()=>rules.state();
  const contest=()=>{const s=state();return s?.phase==='encounter'&&s.encounter?.kind==='contest'?s.encounter:null;};
  const unit=id=>contest()?.units.find(u=>u.id===id)??null;
  const world=()=>getWorld();
  const me=()=>world().controlled;
  const live=()=>contest()?.status==='active';
  const presenter=()=>getPresenter();

  // ——— The rules, through the page. ———
  let inflight=0;
  async function apply(op,{quiet=false}={}){
    inflight++;const outcome=await rules.apply(op).finally(()=>{inflight--;});if(!outcome)return null;
    if(!outcome.ok){say(outcome.message,{warning:true});return outcome;}
    after(op,outcome,{quiet});return outcome;
  }
  // After a change is recorded: the world walks to it, the speaker speaks, and an hour's end plays the rivals' hour.
  function after(op,outcome,{quiet=false}={}){
    const walkers=syncChamberWorld(world(),state());hudKey='';coalitionKey='';reachKey='';logKey='';
    if(op.kind==='speak'){
      const c=op.command,speaker=c.unitId??'hero',toward=c.targetId??null;presenter()?.gesture?.(speaker,'speak',{toward});
      for(const change of (outcome.forecast??lastForecast)?.stanceChanges??[])presenter()?.note?.(change.id,`${signed(change.to-change.from)} → ${signed(change.to)}`,change.to>change.from?'#c7d9a1':'#ecb394');
      if(!quiet)say(outcome.message,{announce:true});
    }else if(op.kind==='walk'&&!quiet)say(outcome.message);
    lastForecast=null;
    if(outcome.hourEnded||op.kind==='yield')startRivals(outcome,walkers);
    if(talking)renderTalk();
  }
  let lastForecast=null;

  // ——— The rivals' hour, and the division at the vote: played out, skippable. ———
  function startRivals(outcome){
    const lines=(outcome.events??[]).filter(Boolean),span=clamp(1200+lines.length*SHOW.line,SHOW.min,SHOW.max);
    show={kind:'rivals',elapsed:0,span,lines,shown:0,status:outcome.status??contest()?.status,hour:contest()?.turn};
    closeTalk();setBand(`The rivals’ hour`,lines[0]??'The rival speakers have nothing to answer.');if(lines[0])announce(lines[0]);presenter()?.setReach?.(null);reachKey='';
  }
  function startDivision(){
    discessio(world(),state());show={kind:'division',elapsed:0,span:SHOW.division,lines:[],shown:-1,status:contest()?.status};
    const v=Chamber.coalitionView(state())?.votes;setBand('The division',v?`${v.for} for, ${v.against} against; ${v.majority} needed. The members walk behind the speaker whose side they took.`:'');
  }
  function setBand(title,text){
    if(!dom.rivalsBand)return;dom.rivalsBand.hidden=false;
    dom.rivalsBand.innerHTML=`<p><strong>${esc(title)}</strong> <span data-line>${esc(text)}</span></p><button type="button" data-skip>Skip <kbd>Space</kbd></button>`;
    dom.rivalsBand.querySelector('[data-skip]').onclick=()=>{skip();canvas.focus({preventScroll:true});};
  }
  function playShow(dt){
    if(!show)return;if(!paused())show.elapsed+=dt;
    if(show.kind==='rivals'&&show.lines.length){
      const i=Math.min(show.lines.length-1,Math.floor(show.elapsed/Math.max(1,show.span-600)*show.lines.length));
      if(i!==show.shown){show.shown=i;const line=dom.rivalsBand?.querySelector('[data-line]');if(line)line.textContent=show.lines[i];announce(show.lines[i]);}
    }
    if(show.elapsed>=show.span&&!walking())finish();else if(show.elapsed>=show.span+4000)finish();
  }
  const walking=()=>world().actors.some(a=>a.path?.length);
  function skip(){
    if(!show)return;
    if(show.kind==='division'){for(const a of world().actors)if(a.goal){Object.assign(a,{x:a.goal.x,z:a.goal.z,px:a.goal.x,pz:a.goal.z,path:[],order:null,goal:null,moving:false});}}
    else placeChamberWorld(world(),state());
    if(show.kind==='rivals'&&show.lines.length)say(show.lines.at(-1));
    finish();
  }
  function finish(){
    const was=show;show=null;if(dom.rivalsBand)dom.rivalsBand.hidden=true;hudKey='';reachKey='';
    if(was?.kind==='rivals'){
      if(contest()?.status==='active'){const h=Chamber.hourView(state());say(`Hour ${h.hour} of ${h.of} begins. ${h.of-h.hour+1===1?'The vote follows this hour.':`${h.of-h.hour+1} hours to the vote.`}`,{announce:true});}
      else startDivision();
    }else if(was?.kind==='division'){const won=contest()?.status==='won';say(won?'The motion carries.':'The motion is defeated.',{announce:true});}
  }

  // ——— Who speaks: the speakers' portraits (Resolve, and whether each has spoken). ———
  function choose(id){
    const sp=Chamber.speakers(state()).find(s=>s.id===id);if(!sp)return;
    if(!sp.standing){say(`${sp.name} has withdrawn: at 0 Resolve he cannot speak, but his vote still counts.`,{warning:true});return;}
    takeControl(id);target=null;armed=null;keyboardTarget=false;targetKey='';
  }
  const canControl=id=>Chamber.speakers(state()).some(s=>s.id===id&&s.standing);
  function buildParty(){
    if(!dom.party)return;const list=Chamber.speakers(state());partyKey=list.map(s=>s.id).join(',');
    dom.party.replaceChildren(...list.map(sp=>{
      const b=document.createElement('button');b.type='button';b.className='rt-portrait rt-speaker';b.dataset.actor=sp.id;
      b.innerHTML=`<span class="rt-portrait-name">${esc(sp.name)}</span><span class="bar resolve"><i></i></span><span class="rt-speaker-state"></span>`+
        `<span class="visually-hidden rt-portrait-state"></span>`;
      b.addEventListener('click',()=>{choose(sp.id);canvas.focus({preventScroll:true});});return b;
    }));
  }
  function updateParty(){
    const list=Chamber.speakers(state());if(list.map(s=>s.id).join(',')!==partyKey)buildParty();
    for(const b of dom.party?.children??[]){
      const sp=list.find(s=>s.id===b.dataset.actor);if(!sp)continue;
      b.querySelector('.resolve i').style.inlineSize=`${clamp(sp.resolve/sp.maxResolve,0,1)*100}%`;
      b.querySelector('.rt-speaker-state').textContent=!sp.standing?'Withdrawn':sp.spoken?'Has spoken':'One speech';
      b.classList.toggle('withdrawn',!sp.standing);b.classList.toggle('spoken',sp.spoken);b.classList.toggle('controlled',sp.id===me());b.setAttribute('aria-pressed',String(sp.id===me()));
      b.title=`${sp.name}: ${sp.resolve} of ${sp.maxResolve} Resolve; ${!sp.standing?'withdrawn (his vote still counts)':sp.spoken?'has spoken this hour':'one speech this hour'}.`;
      b.querySelector('.rt-portrait-state').textContent=b.title;
    }
  }

  // ——— The speech bar (1–0, S): the speeches this chamber has taught him. ———
  const known=()=>Chamber.knownSpeeches(state(),me());
  function buildBar(){
    if(!dom.abilityBar)return;const list=known();barKey=`${me()}|${list.join(',')}`;if(!list.includes(speech))speech=list[0]??'persuade';
    dom.abilityBar.replaceChildren(...list.map((id,i)=>{
      const b=document.createElement('button');b.type='button';b.className='ability rt-speech';b.dataset.speech=id;b.tabIndex=i===0?0:-1;
      const key=actionLabel(`ability_${i+1}`,keymap);b.setAttribute('aria-keyshortcuts',key);
      b.innerHTML=`<kbd>${esc(key)}</kbd><span>${esc(Chamber.SPEECH_NAMES[id])}</span><small>${esc(reachNote(id))}</small>`;
      b.addEventListener('click',event=>{chooseSpeech(id,{touch:event.pointerType==='touch'});canvas.focus({preventScroll:true});});
      return b;
    }));
  }
  function updateBar(){
    if(`${me()}|${known().join(',')}`!==barKey)buildBar();
    const s=state(),u=unit(me()),actions=live()?getActions(s,me()):[],e=contest();
    for(const b of dom.abilityBar?.children??[]){
      const id=b.dataset.speech,ready=actions.includes(id);b.setAttribute('aria-pressed',String(id===speech));b.classList.toggle('armed',id===armed);b.classList.toggle('unavailable',!ready);
      const cooldown=e?.cooldowns?.[`${me()}:address`];
      b.title=ready?`${Chamber.SPEECH_NAMES[id]}: ${reachNote(id)}.`:!u||!live()?'The session is over.':u.acted?`${u.name} has spoken this hour.`:id==='address'&&cooldown>e.turn?`Address recovers on hour ${cooldown}.`:'Not now.';
    }
    if(dom.currentAbility)dom.currentAbility.textContent=Chamber.SPEECH_NAMES[speech]??'Persuade';
  }
  // A number key or a bar button: choose that speech; again, give it to the chosen person (Address: to the chamber).
  function chooseSpeech(id,{touch=false}={}){
    if(show){skip();return;}
    if(touch){if(armed===id){armed=null;if(id==='address')speakTo(null);else say('Cancelled.');return;}armed=id;speech=id;
      say(id==='address'?`${Chamber.SPEECH_NAMES[id]}: tap the floor, or the button again, to speak to the chamber from where he stands.`:`${Chamber.SPEECH_NAMES[id]}: tap the person.`);hudKey='';return;}
    if(id===speech&&(id==='address'||target)){speakTo(id==='address'?null:target);return;}
    speech=id;hudKey='';if(keyboardTarget)refreshTarget();else if(hover)hoverAt(hover,{refresh:true});
    say(id==='address'?`${Chamber.SPEECH_NAMES.address}: right-click the floor (or press ${keyOf(id)} again) to speak to every member within ${reachNote(id)}.`
      :`${Chamber.SPEECH_NAMES[id]}: right-click ${id==='denounce'?'a rival speaker':id==='rebut'?'your ally or a rival':'a member'}${target?`, or press ${keyOf(id)} again for ${unit(target)?.name}`:''}.`);
  }
  const keyOf=id=>actionLabel(`ability_${known().indexOf(id)+1}`,keymap);

  // A speech to a person (or, for Address, the chamber): the 0.38 command from where the speaker stands.
  function commandFor(action,person){
    const sp=unit(me());if(!sp)return null;
    if(action==='address')return {unitId:sp.id,action,x:sp.x,y:sp.y};
    return person?{unitId:sp.id,action,x:person.x,y:person.y,targetId:person.id}:null;
  }
  function speakTo(personId,action=speech){
    if(!live())return;const person=personId?unit(personId):null,command=commandFor(action,person);
    if(!command){say(`Right-click ${action==='denounce'?'a rival speaker':'a member'} for ${Chamber.SPEECH_NAMES[action]}.`,{warning:true});return;}
    const p=Chamber.forecastFrom(state(),command);if(!p.ok){say(whyNot(action,person,p),{warning:true});return;}
    lastForecast=p.forecast??null;armed=null;apply({kind:'speak',command});
  }
  // Why a speech cannot be given: spent, out of reach (and where to walk), or the rules' own reason.
  function whyNot(action,person,p){
    const sp=unit(me());
    if(sp?.acted)return `${sp.name} has spoken this hour.${otherReady()?` ${otherReady().name} has not: switch to him (${firstKeyLabel('party_prev',keymap)} or `+
      `${firstKeyLabel('party_next',keymap)}).`:` Yield the floor (${firstKeyLabel('yield_floor',keymap)}) to end the hour.`}`;
    return Chamber.speechProblem(state(),me(),action,person,p);
  }
  const otherReady=()=>Chamber.speakers(state()).find(s=>s.id!==me()&&s.standing&&!s.spoken)??null;

  // ——— Pointer. ———
  function hoverAt(pick,{refresh=false}={}){
    if(refresh&&keyboardTarget)return;
    if(!refresh)keyboardTarget=false;
    hover=pick;
    if(show){canvas.dataset.cursor='use';message(show.kind==='division'?'Click: skip the division.':'Click: skip the rivals’ hour.');setBadges(null);presenter()?.setRoute(null);return;}
    if(!live()){canvas.dataset.cursor='walk';message(contest()?.status==='won'?'The motion carries. Record the result below.':'The motion is defeated. Below: retry, or a patron’s backing.');setBadges(null);return;}
    const sp=unit(me());if(!sp||!pick){message(' ');setBadges(null);return;}
    const action=armed??speech;
    if(pick.actorId===MAGISTRATE){
      canvas.dataset.cursor='talk';presenter()?.setRoute(null);setBadges(null);
      message(`Click: talk to the presiding magistrate${Chamber.hearingDocuments(state()).length?', who receives the evidence':''}.`);return;
    }
    if(pick.actorId){
      const person=unit(pick.actorId);if(!person){message(' ');return;}presenter()?.setRoute(null);
      if(person.id===sp.id){
        const p=action==='address'?Chamber.forecastFrom(state(),commandFor('address')):null;canvas.dataset.cursor='use';
        message(`${sp.name}: ${sp.resolve} of ${sp.maxResolve} Resolve, ${sp.acted?'has spoken this hour':'one speech this hour'}.${p?.ok?` Right-click: Address the Chamber: ${Chamber.forecastLine(p)}`:''}`);
        setBadges(p?.ok?p.forecast:null);return;
      }
      const command=commandFor(action,person),p=command?Chamber.forecastFrom(state(),command):null;
      canvas.dataset.cursor='talk';
      message(`Click: talk to ${person.name}${person.bloc?` (${person.bloc}, ${signed(person.stance)})`:person.role==='speaker'?` (${person.resolve} Resolve)`:''}`+
        (p?` · Right-click: ${p.ok?`${Chamber.SPEECH_NAMES[action]}: ${Chamber.forecastLine(p)}`:whyNot(action,person,p)}`:''),!!p&&!p.ok);
      setBadges(p?.ok?p.forecast:null);return;
    }
    if(!Number.isFinite(pick.x)){message(' ');return;}
    const tile=pointTile(pick),e=contest(),inside=tile.x>=0&&tile.y>=0&&tile.x<e.width&&tile.y<e.height;
    const place=inside?Chamber.reach(state(),sp.id).find(p=>p.x===tile.x&&p.y===tile.y):null,taken=place&&e.units.some(u=>u.id!==sp.id&&u.x===tile.x&&u.y===tile.y);
    const address=action==='address'?Chamber.forecastFrom(state(),commandFor('address')):null,right=address?` · Right-click: Address the Chamber from where he stands: ${address.ok?Chamber.forecastLine(address):address.message}`:'';
    if(place&&!taken){
      const here=tile.x===sp.x&&tile.y===sp.y;canvas.dataset.cursor='walk';
      message(`${here?`${sp.name} stands here`:`Click: walk here`}${right}`);
      presenter()?.setRoute(here?null:{points:walkRoute(e,{x:sp.x,y:sp.y},tile,sp.id)});setBadges(address?.ok?address.forecast:null);return;
    }
    canvas.dataset.cursor=address?'use':'blocked';presenter()?.setRoute(null);setBadges(address?.ok?address.forecast:null);
    message(`${sp.moved&&!Chamber.speakers(state()).find(s=>s.id===sp.id)?.canWalk?`${sp.name} has walked and spoken this hour.`:'Outside his reach this hour: he may walk inside the pale circles.'}${right}`,!address);
  }
  // Click: talk, or walk. Right-click: the chosen speech. Touch: a tap walks or talks; with a speech armed, it gives it.
  function press(pick,{button='left',touch=false}={}){
    if(show){skip();return;}
    if(!live()||!pick)return;
    const sp=unit(me());if(!sp)return;
    const right=button==='right'||touch&&armed,action=armed??speech;
    if(pick.actorId===MAGISTRATE){openTalk(MAGISTRATE);return;}
    if(pick.actorId){
      const person=unit(pick.actorId);if(!person)return;
      if(right){if(person.id===sp.id&&action==='address')speakTo(null,action);else if(person.id===sp.id)say(`Right-click a member, a rival or your ally for ${Chamber.SPEECH_NAMES[action]}.`);else speakTo(person.id,action);return;}
      if(person.id===sp.id){say(`${sp.name}: ${sp.resolve} of ${sp.maxResolve} Resolve; ${sp.acted?'he has spoken this hour':'one speech this hour'}.`);return;}
      target=person.id;openTalk(person.id);return;
    }
    if(!Number.isFinite(pick.x))return;
    if(right){if(action==='address')speakTo(null,action);else say(`Right-click a ${action==='denounce'?'rival speaker':'person'} for ${Chamber.SPEECH_NAMES[action]}; Address the Chamber is the one given to the floor.`);return;}
    walkTo(pointTile(pick));
  }
  function walkTo(tile){
    const sp=unit(me());if(!sp)return;
    if(!Chamber.inReach(state(),sp.id,tile)){say('Outside his reach this hour: he may walk inside the pale circles.',{warning:true});return;}
    if(contest().units.some(u=>u.id!==sp.id&&u.x===tile.x&&u.y===tile.y)){say('Someone stands there.',{warning:true});return;}
    if(tile.x===sp.x&&tile.y===sp.y)return;
    apply({kind:'walk',unitId:sp.id,tile});
  }
  // The forecast of the speech pointed at, over each head it would move.
  function setBadges(forecast){
    const marks={};
    for(const c of forecast?.stanceChanges??[])marks[c.id]={text:`${signed(c.to-c.from)} → ${signed(c.to)}`,color:c.to>=c.from?'#c7d9a1':'#ecb394'};
    for(const c of forecast?.resolveChanges??[])marks[c.id]={text:`${c.to-c.from>=0?'+':''}${c.to-c.from} Resolve`,color:c.to>=c.from?'#a7d7a9':'#ecb394'};
    const key=JSON.stringify(marks);if(key===badgesKey)return;badgesKey=key;presenter()?.setMarks(marks);
  }

  // ——— The conversation: opens where the speaker stands; nothing in it moves anyone. ———
  function openTalk(personId){
    talking=personId;if(unit(personId))target=personId;renderTalk(true);
    announce(personId===MOTION?'The motion, the precedents and the evidence.':personId===MAGISTRATE?'The presiding magistrate.':`Talking to ${unit(personId)?.name}.`);
  }
  function closeTalk(){const open=!!talking||!!dom.conversation&&!dom.conversation.hidden;talking=null;talkKey='';if(dom.conversation){dom.conversation.hidden=true;dom.conversation.classList?.remove('carrying');dom.conversation.replaceChildren();}return open;}
  const controlKey=el=>el?['speak','walk','deal','ask','close','present','inspect','policy','precedent'].map(k=>el.dataset?.[k]!==undefined?`${k}:${el.dataset[k]}:${el.dataset.terms??''}`:null).find(Boolean)??null:null;
  let talkKey='';
  function renderTalk(focus=false){
    if(talking===MOTION||talking===MAGISTRATE){renderOffice(focus);return;}
    const panel=dom.conversation;if(!panel)return;const s=state(),c=talking&&live()?Chamber.conversation(s,me(),talking,{known:rules.known(talking)}):null;if(!c){closeTalk();return;}
    const key=JSON.stringify([c,s.progressionVersion===1?agreementOptions(s,talking):null]);if(key===talkKey&&!panel.hidden&&!focus)return;talkKey=key;
    // A speech given from here re-renders the panel: the same button keeps the focus.
    const was=panel.contains(document.activeElement)?controlKey(document.activeElement):null;
    const p=c.person,e=contest(),promised=e.promises?.includes(p.id),letter=p.letter?`<span class="rt-bloc-letter" aria-hidden="true">${esc(p.letter)} · </span>`:'';
    const standing=p.role==='voter'?`${p.stance>=1?'For your motion':'Against your motion'} <strong>${signed(p.stance)}</strong> · ${Math.abs(p.stance)>=3?'committed':'wavering'}${promised?' · promised':''}`
      :`${p.side==='enemy'?'Rival speaker':'Your allied speaker'} · ${p.resolve} of ${p.maxResolve} Resolve${p.resolve<=0?' · withdrawn':''}`;
    const interest=p.role!=='voter'?'':p.interest?`<p class="rt-talk-interest"><strong>His interest: ${esc(p.interest)}.</strong> ${esc(Chamber.interestNote(p.interest,p.bloc,known()))}</p>`
      :`<button type="button" class="rt-talk-ask" data-ask>Ask about his interests <small>Free; takes no time</small></button>`;
    const row=x=>x.ok?`<li><button type="button" data-speak="${x.action}"><strong>${esc(x.name)}</strong><small>${esc(Chamber.forecastLine(x))}</small></button></li>`
      :x.walk?`<li><button type="button" data-walk="${x.walk.x},${x.walk.y}"><strong>Walk beside him</strong><small>Walk ${x.walk.cost*Chamber.SEAT} m; no speech spent. Then ${esc(x.name)}: ${esc(Chamber.forecastLine(x))}</small></button></li>`
      :`<li class="rt-talk-off"><span><strong>${esc(x.name)}</strong><small>${esc(x.message)}</small></span></li>`;
    const deals=p.role==='voter'&&s.progressionVersion===1?agreementOptions(s,p.id):null;
    const agreements=deals?.options?.length?`<section class="rt-talk-deals"><h4>An agreement · trust ${deals.trust}</h4>${deals.reason?`<p>${esc(deals.reason)}</p>`:''}<ul>${deals.options.map(o=>
      `<li><button type="button" data-deal="${o.id==='demand'?'demand':'counteroffer'}" ${o.available?'':'disabled'}><strong>${esc(o.label)}</strong><small>${esc(o.pledge)} · ${o.cost} supplies, due Chapter ${o.due} · stance ${signed(o.stanceFrom)} → ${signed(o.stanceTo)}. Uses your soldier’s speech.</small></button></li>`).join('')}</ul></section>`:'';
    panel.innerHTML=`<header class="rt-talk-head">${delegatePortrait(p,{decorative:true})}<div><p class="eyebrow">${letter}${esc(p.bloc??(p.side==='enemy'?'Opposition':'Your side'))}</p><h3 id="rt-talk-title">${esc(p.name)}</h3><p>${standing}</p></div>`+
      `<button type="button" class="rt-talk-close" data-close aria-label="Close the conversation (Esc)">×</button></header>${interest}`+
      `<p class="rt-talk-where">${p.metres} m from ${esc(c.speaker.name)}${c.speaker.spoken?`, who has spoken this hour`:''}.</p>`+
      `<ul class="rt-talk-speeches" aria-label="Speeches">${c.speeches.map(row).join('')}</ul>${agreements}`;
    panel.hidden=false;
    panel.querySelector('[data-close]').onclick=()=>{closeTalk();canvas.focus({preventScroll:true});};
    panel.querySelector('[data-ask]')?.addEventListener('click',()=>{rules.ask(p.id);const a=Chamber.askInterests(s,p.id);say(a.message,{announce:true});renderTalk();panel.querySelector('.rt-talk-interest')?.focus?.();});
    for(const b of panel.querySelectorAll('[data-speak]'))b.onclick=()=>{const x=c.speeches.find(v=>v.action===b.dataset.speak);if(x?.command){lastForecast=x.forecast;apply({kind:'speak',command:x.command});}};
    for(const b of panel.querySelectorAll('[data-walk]'))b.onclick=()=>{const [x,y]=b.dataset.walk.split(',').map(Number);apply({kind:'walk',unitId:me(),tile:{x,y}});};
    for(const b of panel.querySelectorAll('[data-deal]'))b.onclick=()=>apply({kind:'speak',command:{kind:'agreement',targetId:p.id,terms:b.dataset.deal}});
    if(focus)panel.querySelector('button:not([data-close]):not(:disabled)')?.focus({preventScroll:true});
    else if(was)([...panel.querySelectorAll('button')].find(b=>controlKey(b)===was)??panel.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
  }

  // ——— The presiding magistrate and the Motion panel: the documents, the policy debate and the precedents. ———
  function documentsHtml(docs,{present=true}={}){
    if(!docs.length)return '';
    return `<section class="rt-talk-docs"><h4>Documents for this hearing</h4><p class="rt-talk-note">Inspecting is free. Presenting spends your soldier’s speech, once a hearing; `+
      `drag a document onto the tribunal to present it.</p><ul>${docs.map(d=>`<li draggable="${d.ok}" data-document="${esc(d.id)}" title="${esc(d.description)}">`+
      `<strong>${esc(d.label)}</strong><small>${esc(Chamber.documentLine(d))}</small><span class="rt-talk-doc-actions">`+
      `<button type="button" data-inspect="${esc(d.id)}">Inspect</button>${present?`<button type="button" data-present="${esc(d.id)}" ${d.ok?'':'disabled'}>Present evidence</button>`:''}</span></li>`).join('')}</ul></section>`;
  }
  function renderOffice(focus=false){
    const panel=dom.conversation;if(!panel)return;const s=state();if(!live()){closeTalk();return;}
    const docs=Chamber.hearingDocuments(s),motion=talking===MOTION?Chamber.motionView(s):null;
    const key=JSON.stringify([talking,docs,motion,unit('hero')?.acted]);if(key===talkKey&&!panel.hidden&&!focus)return;talkKey=key;
    const was=panel.contains(document.activeElement)?controlKey(document.activeElement):null;
    let body='';
    if(talking===MAGISTRATE)body=docs.length?documentsHtml(docs):'<p>No documented case in your keeping fits this hearing.</p>';
    else{
      const p=motion?.policy,t=p?.tabled,row=(attrs,label,detail,ok)=>`<li><button type="button" ${attrs} ${ok?'':'disabled'}><strong>${esc(label)}</strong><small>${esc(detail)}</small></button></li>`;
      if(p)body+=`<section><h4>The motion</h4>${t?`<p><strong>${esc(t.label)}</strong>, ${t.terms==='amended'?'amended terms':'original terms'}: ${esc(t.effect)}</p>`+
        (t.awaiting?`<p class="rt-talk-note">The rival offers an amendment: ${esc(t.amendment)}</p><ul class="rt-talk-speeches">`+
          row(`data-policy="${esc(t.id)}" data-terms="original"`,'Defend the original motion',t.original.message,t.original.ok)+
          row(`data-policy="${esc(t.id)}" data-terms="amended"`,'Accept the amendment',t.amended.message,t.amended.ok)+'</ul>'
          :`<p class="rt-talk-note">${t.answered?'The amendment is answered.':'The rival may offer an amendment after his next hour; left unanswered, your terms stand.'} Win the vote to enact it.</p>`)
        :`<p class="rt-talk-note">One motion a Contest, tabled with your soldier’s speech. Its costs and lasting effects apply only if you win and record the vote.</p>`+
          `<ul class="rt-talk-speeches">${p.options.map(m=>row(`data-policy="${esc(m.id)}" data-terms="original"`,`Table the motion: ${m.label}`,m.preview.message,m.preview.ok)).join('')}</ul>`}</section>`;
      const pr=motion?.precedents;
      if(pr)body+=`<section><h4>Career precedents</h4><p class="rt-talk-note">${pr.used?`Invoked this Contest: ${esc(pr.used)}.`:'One a Contest, with your soldier’s speech.'}</p><ul class="rt-talk-speeches">`+
        pr.motions.map(m=>row(`data-precedent="${esc(m.id)}"`,m.label,m.summary,m.available)).join('')+'</ul></section>';
      body+=documentsHtml(docs,{present:false});
      if(docs.length)body+='<p class="rt-talk-note">The presiding magistrate at the tribunal receives the evidence: talk to him, or drag a document onto the tribunal.</p>';
      if(!body)body='<p>No motion, precedent or document is open to this Contest.</p>';
    }
    panel.innerHTML=`<header class="rt-talk-head"><span class="rt-talk-seal" aria-hidden="true">${talking===MAGISTRATE?'⚖':'§'}</span><div><p class="eyebrow">${talking===MAGISTRATE?'The tribunal':'Your soldier’s speech'}</p>`+
      `<h3 id="rt-talk-title">${talking===MAGISTRATE?'The presiding magistrate':'The motion and the evidence'}</h3><p>${unit('hero')?.acted?'Your soldier has spoken this hour.':'Your soldier may still speak this hour.'}</p></div>`+
      `<button type="button" class="rt-talk-close" data-close aria-label="Close (Esc)">×</button></header>${body}`;
    panel.hidden=false;bindOffice(panel);
    if(focus)panel.querySelector('button:not([data-close]):not(:disabled)')?.focus({preventScroll:true});
    else if(was)([...panel.querySelectorAll('button')].find(b=>controlKey(b)===was)??panel.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
  }
  function bindOffice(panel){
    panel.querySelector('[data-close]').onclick=()=>{closeTalk();canvas.focus({preventScroll:true});};
    for(const b of panel.querySelectorAll('[data-present]'))b.onclick=()=>present(b.dataset.present);
    for(const b of panel.querySelectorAll('[data-inspect]'))b.onclick=()=>rules.inspect?.(b.dataset.inspect);
    for(const b of panel.querySelectorAll('[data-policy]'))b.onclick=()=>apply({kind:'speak',command:{kind:'policy',id:b.dataset.policy,terms:b.dataset.terms}});
    for(const b of panel.querySelectorAll('[data-precedent]'))b.onclick=()=>apply({kind:'speak',command:{kind:'precedent',id:b.dataset.precedent}});
    // While a document is carried the panel fades and lets the pointer through to the tribunal under it.
    for(const li of panel.querySelectorAll('[data-document][draggable="true"]')){
      li.addEventListener('dragstart',e=>{e.dataTransfer.setData(DOCUMENT,li.dataset.document);e.dataTransfer.effectAllowed='copy';requestAnimationFrame(()=>panel.classList.add('carrying'));});
      li.addEventListener('dragend',()=>panel.classList.remove('carrying'));
    }
  }
  // Present a document: the soldier's speech, through the rules (once a hearing).
  function present(id){
    const d=Chamber.hearingDocuments(state()).find(x=>x.id===id);if(!d)return;
    if(!d.ok){say(d.message,{warning:true});return;}
    lastForecast={stanceChanges:d.changes,resolveChanges:[]};apply({kind:'speak',command:{kind:'case',id}});
  }
  // A document dropped on the scene: on the tribunal (the magistrate, or the floor before him) it is presented.
  const magistrate=()=>world().actors.find(a=>a.id===MAGISTRATE)??null;
  function onDragOver(e){if(!e.dataTransfer?.types?.includes(DOCUMENT)||!magistrate())return;e.preventDefault();e.dataTransfer.dropEffect='copy';}
  function onDrop(e){
    const id=e.dataTransfer?.getData(DOCUMENT),m=magistrate();if(!id||!m)return;e.preventDefault();
    const at=pick?.({clientX:e.clientX,clientY:e.clientY});
    const onTribunal=at&&(at.actorId===MAGISTRATE||Number.isFinite(at.x)&&Math.hypot(at.x-m.x,at.z-m.z)<=TRIBUNAL_REACH);
    if(onTribunal)present(id);else say('Drop the document on the tribunal, before the presiding magistrate.',{warning:true});
  }
  canvas.addEventListener('dragover',onDragOver);canvas.addEventListener('drop',onDrop);
  function toggleMotion(){if(talking===MOTION)closeTalk();else openTalk(MOTION);}
  if(dom.motionButton)dom.motionButton.onclick=()=>{toggleMotion();};

  // ——— The coalition strip and the Chamber Whip Forecast. ———
  function renderCoalition(){
    const el=dom.coalition,c=Chamber.coalitionView(state());if(!el||!c)return;
    const whip=c.whip,risk=new Set((whip?.atRisk??[]).filter(r=>r.losesVote||r.stanceAfter<r.stanceBefore).map(r=>r.id));
    const key=JSON.stringify([c.votes,c.committed,c.wavering,c.against,c.promisesLeft,whip?.projectedVotesAfterRivals,whip?.atRisk,whip?.oneSpeechFlips,contest()?.status]);if(key===coalitionKey)return;coalitionKey=key;
    const v=c.votes,seat=(m,kind)=>`<button type="button" class="rt-seat ${kind}${risk.has(m.id)?' at-risk':''}" data-person="${esc(m.id)}" data-bloc="${esc(m.bloc)}" `+
      `title="${esc(`${m.name} (${m.bloc}), ${signed(m.stance)}: ${kind==='against'?'against':kind}${risk.has(m.id)?'; at risk from the rivals’ next lobbying':''}. Click to talk.`)}">`+
      `<span aria-hidden="true">${esc(m.letter??'')}</span><b>${kind==='against'?'−':'✓'}</b><span class="visually-hidden">${esc(`${m.name}, ${kind}${risk.has(m.id)?', at risk':''}`)}</span></button>`;
    const group=(label,list,kind)=>`<div class="rt-seat-group" role="group" aria-label="${label}: ${list.length}"><small>${label} ${list.length}</small>${list.map(m=>seat(m,kind)).join('')}</div>`;
    const atRisk=(whip?.atRisk??[]).filter(r=>r.stanceAfter<r.stanceBefore),flips=whip?.oneSpeechFlips??[];
    const projection=live()&&Number.isFinite(whip?.projectedVotesAfterRivals)?`<span class="rt-vote-projection${whip.projectedVotesAfterRivals<v.majority?' is-warning':''}">After the rivals’ reply: <strong>${whip.projectedVotesAfterRivals} of ${v.total}</strong> for, if you change nothing.</span>`:'';
    el.innerHTML=`<p class="rt-vote"><strong>${v.for} of ${v.total}</strong> for · ${v.majority} needed · ${v.for>=v.majority?'majority held for now':`${v.majority-v.for} more`} · ${c.promisesLeft} ${c.promisesLeft===1?'promise':'promises'} left ${projection}</p>`+
      `<div class="rt-seats">${group('Committed',c.committed,'committed')}${group('Wavering',c.wavering,'wavering')}${group('Against',c.against,'against')}</div>`+
      `<p class="rt-whip"><span class="${atRisk.length?'is-warning':''}">${atRisk.length?`At risk next hour: ${atRisk.map(r=>`${esc(r.name)} ${signed(r.stanceBefore)} → ${signed(r.stanceAfter)}${r.losesVote?' (loses the vote)':''}`).join(', ')}`:'No supporter at risk next hour'}</span>`+
      `<span>${flips.length?`1-speech flips: ${flips.slice(0,3).map(f=>`${esc(f.name)} by ${esc(Chamber.SPEECH_NAMES[f.action]??f.action)}${f.requiresMove?' (walk)':''}`).join(' · ')}`:'No 1-speech flip in reach'}</span></p>`;
    for(const b of el.querySelectorAll('[data-person]'))b.onclick=()=>{if(show)skip();if(live())openTalk(b.dataset.person);};
  }

  // ——— The chamber record (the Contest's own log). ———
  function renderLog(){
    const log=contest()?.log??[];if(!dom.log)return;const key=`${log.length}:${log.at(-1)}`;if(key===logKey)return;logKey=key;
    dom.log.replaceChildren(...[...log].reverse().slice(0,30).map(text=>{const li=document.createElement('li');li.textContent=hourly(text);return li;}));
  }

  // ——— The HUD: the hour and the clepsydra, the reach, and everything above. ———
  function showReach(){
    const tiles=!show&&live()?Chamber.reach(state(),me()):[],key=`${me()}|${tiles.map(t=>`${t.x},${t.y}`).join(';')}`;if(key===reachKey)return;reachKey=key;
    presenter()?.setReach?.(tiles.length?tiles.map(tilePoint):null);
  }
  function update(now=performance.now()){
    const dt=lastNow?Math.min(250,now-lastNow):0;lastNow=now;playShow(dt);
    const e=contest();if(!e)return;
    const h=Chamber.hourView(state()),key=JSON.stringify([e.turn,e.status,me(),speech,armed,!!show,talking,e.units.map(u=>[u.x,u.y,u.stance,u.resolve,u.acted,u.moved]),e.promises?.length]);
    showReach();if(key===hudKey)return;hudKey=key;
    updateParty();updateBar();renderCoalition();renderLog();
    if(dom.roundLabel)dom.roundLabel.textContent=`Hour ${h.hour} of ${h.of}`;
    if(dom.clockTime)dom.clockTime.textContent=e.status!=='active'?'The vote is taken':h.of-h.hour===0?'The vote follows this hour':`${h.of-h.hour+1} hours to the vote`;
    dom.clockRing?.setAttribute('stroke-dasharray',`${Math.round((e.status==='active'?h.hour-1:h.of)/h.of*100)} 100`);
    if(dom.yieldButton)dom.yieldButton.disabled=e.status!=='active';if(dom.motionButton){dom.motionButton.disabled=e.status!=='active';dom.motionButton.setAttribute('aria-pressed',String(talking===MOTION));}
    if(talking)renderTalk();if(keyboardTarget)refreshTarget();else if(hover)hoverAt(hover,{refresh:true});
  }

  // Keyboard targeting is a live view of the selected person, not the sentence
  // from the moment T was pressed. Refresh silently after walks, speeches,
  // speaker changes and rival responses; only an explicit target change speaks.
  function refreshTarget({spoken=false}={}){
    const t=target&&unit(target),sp=unit(me());
    if(!t||!sp){target=null;targetKey='';keyboardTarget=false;setBadges(null);return;}
    const p=commandFor(speech,t),f=p?Chamber.forecastFrom(state(),p):null;
    const text=`${t.name}${t.bloc?`, ${t.bloc}, ${signed(t.stance)}`:t.role==='speaker'?`, ${t.resolve} Resolve`:''}, ${(Math.abs(t.x-sp.x)+Math.abs(t.y-sp.y))*Chamber.SEAT} m. `+
      `${f?(f.ok?`${Chamber.SPEECH_NAMES[speech]} (${keyOf(speech)}): ${Chamber.forecastLine(f)}.`:whyNot(speech,t,f)):''} Enter talks to him.`;
    const key=`${text}|${!!f&&!f.ok}`;
    if(key!==targetKey||spoken){targetKey=key;message(text,!!f&&!f.ok);setBadges(f?.ok?f.forecast:null);}
    if(spoken)announce(text);
  }

  // ——— Keys. ———
  function act(action){
    if(show){
      if(['cancel_or_menu','act_on_target','combat_toggle','yield_floor'].includes(action)||action.startsWith('ability_')){skip();return true;}
      if(action.startsWith('camera_')||action.startsWith('zoom_')||action.startsWith('panel_')||['pause','help','map_overlay','quick_save'].includes(action))return false;
      say(`${show.kind==='division'?'The members are dividing':'The rivals have the floor'}: click or press ${firstKeyLabel('combat_toggle',keymap)} to skip.`);return true;
    }
    if(action.startsWith('ability_')){const id=known()[Number(action.slice(8))-1];if(!id)say('No speech in that place.');else chooseSpeech(id);return true;}
    if(ARROWS[action]){
      const sp=unit(me());if(!sp||!live())return true;const [dx,dy]=ARROWS[action];
      // The arrows step to the next place in that direction (the chamber's own grid, north up).
      walkTo({x:sp.x+dx,y:sp.y+dy});return true;
    }
    switch(action){
      case 'yield_floor':yieldFloor();return true;
      case 'target_next_enemy':case 'target_next_friend':{
        const list=Chamber.chamberTargets(state(),me(),{friends:action==='target_next_friend'});if(!list.length){say('No one to choose.');return true;}
        target=list[(list.indexOf(target)+1)%list.length];keyboardTarget=true;targetKey='';refreshTarget({spoken:true});return true;
      }
      case 'act_on_target':case 'interact_nearest':{
        const id=action==='act_on_target'?target:Chamber.chamberTargets(state(),me())[0];if(!id){say(`Choose someone first (${firstKeyLabel('target_next_enemy',keymap)}).`);return true;}openTalk(id);return true;
      }
      case 'show_usable':return false;
      case 'cancel_or_menu':if(closeTalk()){say('The conversation is closed.');canvas.focus({preventScroll:true});return true;}if(armed){armed=null;say('Cancelled.');return true;}
        if(target){target=null;keyboardTarget=false;targetKey='';setBadges(null);say('Choice cleared.');return true;}return false;
      case 'slow_time':case 'step_round':case 'combat_toggle':case 'walk_toggle':case 'force_attack_target':case 'war_cry':say('Nothing in a Contest needs speed: the chamber moves by the hour.');return true;
      case 'show_ranges':say('The pale circles show where he may walk this hour; each speech says how far it reaches.');return true;
      default:return false;
    }
  }
  function yieldFloor(){
    if(!live())return;const sp=Chamber.speakers(state()),silent=sp.filter(s=>s.standing&&!s.spoken);
    apply({kind:'yield'}).then(r=>{if(r?.ok&&silent.length)say(`The floor is yielded: ${silent.map(s=>s.name).join(' and ')} did not speak this hour.`);});
  }
  // U: where each rival means to walk, and whom he means to speak to, as the 0.38 plans have it.
  function rivalArrows(){
    const plans=Chamber.rivalWalks(state());
    message(plans.map(r=>r.message).join(' ')||'The rivals have no plan this hour.');
    return plans.flatMap(r=>{const t=unit(r.targetId),from=tilePoint(r.from),to=tilePoint(r.to),out=[];
      if(r.from.x!==r.to.x||r.from.y!==r.to.y)out.push({id:r.id,from,to,strike:false,label:r.name});if(t)out.push({id:r.id,from:to,to:tilePoint(t),strike:true,label:r.name});return out;});
  }

  // ——— The Command list: every chamber action without pointing (guide "Accessibility"). ———
  function options(actorId){return Chamber.chamberOptions(state(),actorId);}
  function use(command){
    if(command.kind==='talk'){openTalk(command.personId);return true;}
    if(command.kind==='speak'&&command.command?.kind==='case'){present(command.command.id);return true;}
    if(command.kind==='yield'){yieldFloor();return true;}
    if(command.kind==='speak'){lastForecast=Chamber.forecastFrom(state(),command.command).forecast??null;apply(command);return true;}
    if(command.kind==='walk'){apply(command);return true;}
    return false;
  }

  function reset(){closeTalk();partyKey='';barKey='';hudKey='';coalitionKey='';reachKey='';logKey='';badgesKey='';show=null;target=null;armed=null;hover=null;keyboardTarget=false;targetKey='';lastForecast=null;
    if(dom.rivalsBand)dom.rivalsBand.hidden=true;setBadges(null);presenter()?.setRoute?.(null);message('');buildParty();buildBar();update();}
  // The page changed the Contest (a panel's speech, a retry, a load): the world, the HUD and an hour's end follow.
  function sync(outcome=null){
    syncChamberWorld(world(),state());hudKey='';coalitionKey='';reachKey='';logKey='';
    if(outcome?.hourEnded)startRivals(outcome);else if(contest()&&contest().status!=='active'&&!show&&outcome)startDivision();
  }
  if(dom.yieldButton)dom.yieldButton.onclick=()=>{yieldFloor();canvas.focus({preventScroll:true});};
  reset();
  return {
    get busy(){return !!show;},get talking(){return talking;},get target(){return target;},get pending(){return inflight;},
    // Talk to a member from the page (the members list, the coalition panel's seats).
    talk(personId){if(show)skip();if(live()&&(unit(personId)||personId===MAGISTRATE&&magistrate()||personId===MOTION))openTalk(personId);},toggleMotion,
    hover:hoverAt,press,act,update,sync,reset,options,use,rivalArrows,canControl,skip,
    // A new presenter (the stage rebuilt): the reach and the forecast marks are drawn again.
    invalidate(){reachKey='';badgesKey='';hudKey='';barKey='';},
    speakers:()=>Chamber.speakers(state()).filter(s=>s.standing),
    dispose(){closeTalk();presenter()?.setReach?.(null);presenter()?.setMarks({});canvas.removeEventListener('dragover',onDragOver);canvas.removeEventListener('drop',onDrop);}
  };
}
