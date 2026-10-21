// A simple heuristic player for real-time campaign encounters: it plays the
// soldier through the same legal Commands a person gives (queueCommand), from
// New Game, and never touches the world otherwise. Companions follow their
// standing orders. Used by the tests, the Gate 2 deadline sweep and
// `node scripts/realtime-autoplay.mjs` (development only).
import {pathToFileURL} from 'node:url';
import * as G from '../src/core/game.js';
import {queueCommand,step,roundOf} from '../src/core/realtime/simulation.js';
import {actorById,distanceBetween,liftable} from '../src/core/realtime/abilities.js';
import {derivedValues} from '../src/core/realtime/combat.js';
import {span} from '../src/core/realtime/navigation.js';
import {playEncounter} from './autoplay.mjs';
import {controlsFor} from '../src/core/controls-model.js';
import {deploy,deploying,soundTheAdvance} from '../src/core/realtime/deployment.js';

const standing=o=>o.alive&&!o.down&&!o.carriedBy;
const nearest=(list,p)=>list.reduce((b,o)=>!b||distanceBetween(o,p)<distanceBetween(b,p)?o:b,null);
const issue=(world,kind,payload={})=>queueCommand(world,{actorId:world.controlled,kind,payload}).ok;

// One decision for the soldier the bot plays.
export function heroDecision(world,memo={}){
  const hero=actorById(world,world.controlled),m=world.mission;if(!hero||!standing(hero)||hero.action)return;
  const enemies=world.actors.filter(o=>o.side==='enemy'&&standing(o)&&!o.hidden);
  const attacker=enemies.filter(o=>o.order?.targetId===hero.id||o.lock===hero.id||distanceBetween(o,hero)<=3);
  const fight=t=>{if(!t)return false;if(hero.lock===t.id&&hero.order?.kind==='attack')return true;
    if((hero.ammo?.pilum??0)>0&&!hero.lock&&distanceBetween(hero,t)>8&&distanceBetween(hero,t)<22&&issue(world,'ability',{abilityId:'throw_pilum',targetId:t.id}))return true;
    return issue(world,'attack',{targetId:t.id});};
  const go=p=>{const g=hero.goal;if(hero.order?.kind==='move'&&g&&span(g.x-p.x,g.z-p.z)<1.5)return;issue(world,'move',{x:p.x,z:p.z});};
  // The drill: walk, draw, strike the partner, brace, then throw a pilum.
  if(m?.mode==='training'){
    const partner=world.actors.find(o=>o.practice);
    if(!world.used.includes('move')){go({x:hero.x+3,z:hero.z});return;}
    if(!hero.drawn){issue(world,'setDrawn',{drawn:true});return;}
    if(!world.used.includes('strike')){issue(world,'attack',{targetId:partner.id});return;}
    if(!world.used.includes('brace')){issue(world,'ability',{abilityId:'brace'});return;}
    if(!world.used.includes('throw')){issue(world,'ability',{abilityId:'throw_pilum',targetId:partner.id});return;}
    return;
  }
  if(hero.hp<hero.maxHp*.45&&(hero.bandages??0)>0&&!attacker.length&&!hero.carrying){issue(world,'ability',{abilityId:'bind_wounds'});return;}
  if(attacker.length&&!hero.carrying){if(!hero.drawn)issue(world,'setDrawn',{drawn:true});fight(nearest(attacker,hero));return;}
  if(!m){fight(nearest(enemies,hero));return;}
  switch(m.mode){
    case 'extract':{
      const columns=m.escorts.map(id=>actorById(world,id)).filter(Boolean),wounded=columns.find(c=>liftable(c)&&!c.escort?.escorted);
      if(wounded){
        if((hero.bandages??0)>0&&!hero.carrying){issue(world,'ability',{abilityId:'bind_wounds',targetId:wounded.id});return;}
        if(!hero.carrying){if(hero.drawn)issue(world,'setDrawn',{drawn:false});issue(world,'ability',{abilityId:'carry',targetId:wounded.id});return;}
      }
      if(hero.carrying){go(m.goal);return;}
      const close=nearest(enemies.filter(o=>columns.some(c=>distanceBetween(c,o)<8)||distanceBetween(o,hero)<8),hero);
      if(close&&!memo.passive){if(!hero.drawn)issue(world,'setDrawn',{drawn:true});fight(close);return;}
      const lag=columns.filter(c=>standing(c)&&span(c.x-m.goal.x,c.z-m.goal.z)>m.radius*.6).reduce((b,c)=>!b||span(c.x-m.goal.x,c.z-m.goal.z)>span(b.x-m.goal.x,b.z-m.goal.z)?c:b,null);
      // Lead the columns: stay within half the follow range of the farthest one.
      if(lag&&distanceBetween(hero,lag)>m.followRange*.5){go({x:lag.x,z:lag.z});return;}
      go(m.goal);return;
    }
    case 'recover':{
      const chest=world.objects.find(o=>o.id===m.objectId);
      const close=nearest(enemies.filter(o=>distanceBetween(o,hero)<10),hero);if(close){if(!hero.drawn)issue(world,'setDrawn',{drawn:true});fight(close);return;}
      if(!world.used.includes('scout')){if(distanceBetween(hero,chest)<=24){issue(world,'ability',{abilityId:'scout'});return;}go(chest);return;}
      if(!chest.done){if(distanceBetween(hero,chest)>1.6){go(chest);return;}issue(world,'interact',{objectId:chest.id});return;}
      fight(nearest(enemies,hero));return;
    }
    case 'hold':case 'capture':{
      const target=m.points.find(p=>!p.secured)??m.goal;
      const threat=nearest(enemies.filter(o=>span(o.x-target.x,o.z-target.z)<=m.radius*1.6||distanceBetween(o,hero)<6),hero);
      if(threat){if(!hero.drawn)issue(world,'setDrawn',{drawn:true});fight(threat);return;}
      if(span(hero.x-target.x,hero.z-target.z)>m.radius*.5)go(target);
      return;
    }
    default:{
      const t=nearest(enemies,hero);if(t){if(!hero.drawn)issue(world,'setDrawn',{drawn:true});fight(t);return;}
      go(m.goal);
    }
  }
}

// Play the encounter's live world to its end; the chronicle learns the outcome.
export function playRealtime(state,{every=10,maxRounds=40,memo={},onTick=null}={}){
  const world=G.realtimeWorld(state),watch=companionWatch();
  // From Chapter VII the company deploys first: the soldier takes his place (a legal placement, which
  // demonstrates Deploy), then the advance is sounded.
  if(deploying(world)){const hero=world.actors.find(a=>a.id===world.heroId);deploy(world,{id:hero.id,x:hero.x,z:hero.z});soundTheAdvance(world);}
  const limit=maxRounds*200;
  for(let t=0;t<limit&&world.status==='active';t++){
    if(world.tick%every===0)heroDecision(world,memo);
    step(world);watch(world);onTick?.(world);
  }
  const resolved=G.resolveRealtime(state,world);if(!resolved.ok&&world.status!=='active')throw new Error(resolved.message);
  return {id:state.encounter.id,chapter:state.chapter,status:world.status,rounds:roundOf(world),world,reason:world.mission?.reason??null,incidents:watch.incidents};
}
// Gate 1's companion measure, automated (a proxy for the playtest's count, not a substitute):
// incidents a player would have to rescue a companion from. Stuck: ordered to move but no
// nearer in ten seconds. Lost: more than 40 m from the soldier for ten seconds. Suicidal:
// down while more than 25 m from the soldier. Each counts once per companion and kind.
export function companionWatch(){
  const seen=new Map(),incidents=[];
  const watch=world=>{
    if(world.tick%20)return;const hero=world.actors.find(a=>a.id===world.heroId);if(!hero)return;
    for(const id of world.party){
      const a=world.actors.find(x=>x.id===id);if(!a)continue;const m=seen.get(id)??{far:0,still:0,last:null,flags:new Set()};seen.set(id,m);
      const d=Math.hypot(a.x-hero.x,a.z-hero.z),flag=kind=>{if(!m.flags.has(kind)){m.flags.add(kind);incidents.push({id,kind,tick:world.tick});}};
      if(a.alive&&!a.down){
        m.far=d>40?m.far+1:0;if(m.far>=10)flag('lost');
        const ordered=a.order?.kind==='move'&&a.goal,progress=m.last&&a.goal?Math.hypot(m.last.x-a.goal.x,m.last.z-a.goal.z)-Math.hypot(a.x-a.goal.x,a.z-a.goal.z):1;
        m.still=ordered&&progress<.2?m.still+1:0;if(m.still>=10)flag('stuck');m.last={x:a.x,z:a.z};
      }else if(a.down&&d>25)flag('suicidal');
    }
  };
  watch.incidents=incidents;return watch;
}

// From New Game: real-time battles where the chapter has them, the 0.38 turns elsewhere.
export function runRealtimeCampaign({seed=275,difficulty='standard',throughChapter=3,choices={},settings={controlsModel:'realtime'},
  ready=undefined,onEncounter=null}={}){
  const state=G.newGame('Aurelius Marcellus',seed,{featureEdition:35,progression:true,difficulty}),encounters=[];let guard=0;
  while(state.phase!=='epilogue'&&state.chapter<=throughChapter&&guard++<200){
    const chapter=G.getChapter(state);
    if(state.phase==='camp'){
      if(!state.decisions[chapter.decision.id]){const r=G.choose(state,choices[chapter.decision.id]??chapter.decision.options[0].id);if(!r.ok)throw new Error(r.message);}
      if(state.chapter===1&&state.encounterIndex>0&&!state.oath)G.swearOath(state);
      const data=chapter.encounters[state.encounterIndex],controls=data.kind==='battle'?controlsFor(settings,state.chapter,ready):'turns';
      const r=G.startEncounter(state,controls==='realtime'?{controls}:{});if(!r.ok)throw new Error(`Chapter ${state.chapter}: ${r.message}`);
    }else if(state.phase==='encounter'){
      const summary=G.isRealtime(state)?playRealtime(state):playEncounter(state);encounters.push({...summary,world:undefined});onEncounter?.(state,summary);
      if(state.encounter.status!=='won')throw new Error(`Real-time autoplay lost ${state.encounter.id}: ${summary.reason??''}\n${state.encounter.log.slice(-8).join('\n')}`);
      const r=G.commitEncounter(state);if(!r.ok)throw new Error(r.message);
    }else if(state.phase==='promotion'){const r=G.advanceChapter(state);if(!r.ok)throw new Error(`Chapter ${state.chapter}: ${r.message}`);}
  }
  return {state,encounters};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const through=Number(process.argv.find(a=>a.startsWith('--through='))?.split('=')[1]??3);
  const {state,encounters}=runRealtimeCampaign({throughChapter:through,ready:Array.from({length:through},(_,i)=>i+1)});
  console.log(JSON.stringify({chapter:state.chapter,phase:state.phase,tp:state.soldier.tp,denarii:state.soldier.denarii,encounters},null,2));
}
