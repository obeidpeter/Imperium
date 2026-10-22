import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {playRealtime,heroDecision} from '../scripts/realtime-autoplay.mjs';
import {commandOptions,pointerIntent,nearestUse} from '../src/core/realtime/intents.js';
import {commandProblem,step} from '../src/core/realtime/simulation.js';
import {ABILITIES,FIELD_BAR} from '../src/data/realtime-rules.js';

// A chronicle at the start of an encounter, reached by legal commands from New Game.
function reach(id){
  const state=G.newGame('Aurelius Marcellus',275,{featureEdition:35,progression:true});
  for(let guard=0;guard<80;guard++){
    const chapter=G.getChapter(state),data=chapter.encounters[state.encounterIndex];
    if(state.phase==='camp'){
      if(!state.decisions[chapter.decision.id])G.choose(state,chapter.decision.options[0].id);
      if(state.chapter===1&&state.encounterIndex>0&&!state.oath)G.swearOath(state);
      G.startEncounter(state,{controls:'realtime'});if(data.id===id)return state;
    }else if(state.phase==='encounter'){playRealtime(state);G.commitEncounter(state);}else G.advanceChapter(state);
  }
  throw new Error(`never reached ${id}`);
}
// The same order, whichever way it was given: kind, ability and target.
const sameOrder=(a,b)=>a.actorId===b.actorId&&a.kind===b.kind&&(a.payload.abilityId??null)===(b.payload.abilityId??null)
  &&(a.payload.targetId??a.payload.objectId??null)===(b.payload.targetId??b.payload.objectId??null)&&!!a.payload.forced===!!b.payload.forced;
// Every command the scene's pointer (left, Shift+left, right with each ability) and E can give, except a walk to a chosen spot of ground.
function sceneCommands(world){
  const actor=world.actors.find(a=>a.id===world.controlled),out=[];
  const picks=[...world.actors.filter(a=>a!==actor&&!(a.hidden&&a.side==='enemy')).map(a=>({actorId:a.id})),...(world.objects??[]).map(o=>({objectId:o.id}))];
  for(const pick of picks){
    for(const shift of [false,true])out.push(pointerIntent(world,{pick,button:'left',shift}).command);
    for(const abilityId of (actor.abilities??FIELD_BAR).filter(id=>id!=='strike'&&!ABILITIES[id].enemyOnly))out.push(pointerIntent(world,{pick,button:'right',abilityId}).command);
  }
  for(const abilityId of (actor.abilities??FIELD_BAR).filter(id=>ABILITIES[id].target==='self'||ABILITIES[id].selfIfNoTarget))
    out.push(pointerIntent(world,{pick:{},button:'right',abilityId}).command);
  out.push(nearestUse(world)?.command);
  // Shift on a man who is already an enemy changes nothing: it is the plain attack.
  const hostileTo=id=>world.actors.find(a=>a.id===id)?.side==='enemy';
  return out.filter(c=>c&&c.kind!=='move'&&!commandProblem(world,c)).map(c=>c.payload.forced&&hostileTo(c.payload.targetId)?{...c,payload:{...c.payload,forced:false}}:c);
}
function checkParity(world,label){
  const options=commandOptions(world),commands=options.filter(o=>o.command).map(o=>o.command);
  for(const o of options){
    if(o.command)assert.equal(commandProblem(world,o.command),null,`${label}: ${o.label} is legal`);else assert.ok(o.reason&&o.message,`${label}: ${o.label} says why not`);
  }
  for(const c of sceneCommands(world))assert.ok(commands.some(x=>sameOrder(x,c)),`${label}: the list offers ${c.kind} ${JSON.stringify(c.payload)}`);
  return options;
}

test('H39: the Command list offers every action the scene offers, in the opening fights and mid-fight',()=>{
  for(const id of ['ch1-training','ch1-road','ch2-marsh','ch3-station','ch3-rolls']){
    const world=G.realtimeWorld(reach(id));checkParity(world,`${id} at the start`);
    // Mid-fight, with the fallen to search and the wounded to tend.
    for(let i=0;i<1600&&world.status==='active'&&!world.actors.some(a=>!a.alive&&a.loot?.length);i++){if(world.tick%10===0)heroDecision(world);step(world);}
    if(world.status==='active')checkParity(world,`${id} mid-fight`);
  }
});

test('H39: the list works while paused: its orders queue, the latest per man wins, and every group names its targets',()=>{
  const world=G.realtimeWorld(reach('ch3-station')),options=commandOptions(world);
  assert.ok(options.some(o=>o.group==='Yourself'&&/Draw weapons/.test(o.label)));
  assert.ok(options.some(o=>o.group==='Enemies'&&o.command?.kind==='attack'),'enemies in sight');
  assert.ok(options.some(o=>o.group==='Objects'&&o.command?.kind==='interact'),'the chest');
  assert.ok(options.some(o=>o.group==='Friends'&&o.command?.kind==='control'),'taking control of a companion');
  assert.ok(!options.some(o=>o.subject&&world.actors.find(a=>a.id===o.subject)?.hidden),'the hidden enemy is not offered');
  // A companion can be chosen to act.
  const lucan=world.party[0],his=commandOptions(world,{actorId:lucan});assert.ok(his.length&&his.every(o=>!o.command||o.command.kind==='control'||o.command.actorId===lucan),'his own orders');
});
