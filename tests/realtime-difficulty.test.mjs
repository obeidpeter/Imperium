import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {REALTIME_DIFFICULTY,PERCEPTION} from '../src/data/realtime-rules.js';
import {choosePace,defaultSettings,followDifficulty,loadSettings,paceDefaults} from '../src/ui/settings.js';
import {runRealtimeCampaign} from '../scripts/realtime-autoplay.mjs';
import {playBattle} from '../scripts/realtime-sweep.mjs';

// Difficulty in real time (build brief §3.18, guide "Difficulty"). Story: three
// more rounds on battle deadlines (not Contest hours), reinforcements two rounds
// later, gentler pressure, slower notice and reaction, 75% speed and a pause when
// an enemy comes into view. Veteran: reinforcements a round earlier, stronger
// pressure, quicker notice and reaction. No level adds health or damage.

const LEVELS=['story','standard','veteran'];
const camps=new Map();
// Each level's camps from New Game, by the 0.38 command campaign's legal commands, through Chapter VII's council.
function campsFor(difficulty){
  if(!camps.has(difficulty)){
    const seen=new Map(),stop=new Error('reached');
    try{runCommandCampaign({featureEdition:35,difficulty,onCheckpoint(s){const id=G.getChapter(s).encounters[s.encounterIndex]?.id;if(!seen.has(id))seen.set(id,G.serialize(s));if(id==='ch7-council')throw stop;}});}
    catch(error){if(error!==stop)throw error;}
    camps.set(difficulty,seen);
  }
  return camps.get(difficulty);
}
function started(difficulty,id,options={controls:'realtime'}){
  const state=G.deserialize(campsFor(difficulty).get(id));assert.equal(G.startEncounter(state,options).ok,true,`${difficulty} ${id}`);return state;
}

test('§3.18 in real time: deadlines, reinforcements, pressure and perception by level, and no level adds health or damage',()=>{
  const worlds=Object.fromEntries(LEVELS.map(level=>[level,['ch1-road','ch2-rearguard','ch2-marsh'].map(id=>G.realtimeWorld(started(level,id)))]));
  for(const i of [0,1,2]){
    const [story,standard,veteran]=LEVELS.map(level=>worlds[level][i]);
    assert.equal(story.mission.deadline,standard.mission.deadline+3,'Story: three more rounds');
    // Release 3 (worlds and gameplay plan): Veteran's deadlines are two rounds shorter (REALTIME_DIFFICULTY).
    assert.equal(veteran.mission.deadline,standard.mission.deadline+REALTIME_DIFFICULTY.veteran.deadline);assert.equal(REALTIME_DIFFICULTY.veteran.deadline,-2);
    standard.mission.waves.forEach((w,k)=>{
      assert.equal(story.mission.waves[k].round,w.round+2,'Story: reinforcements two rounds later');
      assert.equal(veteran.mission.waves[k].round,Math.max(2,w.round-1),'Veteran: one round earlier');
    });
    assert.deepEqual([story,standard,veteran].map(w=>w.mission.pressure),[6,10,14]);
    assert.deepEqual([story,standard,veteran].map(w=>w.difficulty),LEVELS);
    const foes=w=>w.actors.filter(a=>a.side==='enemy').map(a=>[a.id,a.maxHp,JSON.stringify(a.kit),JSON.stringify(a.attributes)]);
    assert.deepEqual(foes(story),foes(standard),'the same enemies on Story');assert.deepEqual(foes(veteran),foes(standard),'the same enemies on Veteran');
  }
  assert.ok(worlds.standard.some(w=>w.mission.waves.length),'a battle with reinforcements is compared');
  // Notice and reaction (ai.js reads these by the world's level).
  assert.deepEqual(LEVELS.map(l=>[PERCEPTION.difficulty[l].notice,PERCEPTION.difficulty[l].reaction]),[[.7,.5],[1,0],[1.3,-.25]]);
  // The drill keeps its own clock.
  assert.deepEqual(LEVELS.map(l=>G.realtimeWorld(started(l,'ch1-training')).mission.deadline),[12,12,12]);
});

test('Contest hours are the same on every level, and each Contest carries its level (contest.js applies the 0.38 speech strength)',()=>{
  const councils=LEVELS.map(level=>started(level,'ch7-council',{}).encounter);
  assert.equal(new Set(councils.map(e=>e.turnLimit)).size,1,'no extra hours on Story');
  assert.deepEqual(councils.map(e=>e.difficulty),LEVELS);
});

test('Time and pace follow the difficulty until the player changes them, and then stay the player’s',()=>{
  assert.deepEqual(paceDefaults('story'),{gameSpeed:.75,pauseSighted:true,pauseHurt:false,pauseObjective:false,pauseSquad:false,pauseOrder:false});
  for(const level of ['standard','veteran'])assert.deepEqual(paceDefaults(level),{gameSpeed:1,pauseSighted:false,pauseHurt:false,pauseObjective:false,pauseSquad:false,pauseOrder:false});
  const s=defaultSettings();assert.equal(s.paceChosen,false);assert.equal(s.panelPause,true);assert.equal(s.roundPause,false);
  followDifficulty(s,'story');assert.equal(s.gameSpeed,.75);assert.equal(s.pauseSighted,true);
  followDifficulty(s,'veteran');assert.equal(s.gameSpeed,1);assert.equal(s.pauseSighted,false);
  choosePace(s,'pauseHurt',true);assert.equal(s.paceChosen,true);followDifficulty(s,'story');
  assert.equal(s.gameSpeed,1,'a chosen pace is kept on Story');assert.equal(s.pauseHurt,true);
  choosePace(s,'gameSpeed','0.5');assert.equal(s.gameSpeed,.5);choosePace(s,'gameSpeed',2);assert.equal(s.gameSpeed,.5,'an unknown speed is refused');
  // Pause each round and pause in panels never make the pace the player's.
  const t=defaultSettings();choosePace(t,'roundPause',true);assert.equal(t.paceChosen,false);assert.equal(t.roundPause,true);
  // Settings stored before the pace followed the difficulty (every auto-pause on) now follow it.
  const old=loadSettings(JSON.stringify({gameSpeed:1,pauseSighted:true,pauseHurt:true,pauseObjective:true,pauseSquad:true}));
  assert.equal(old.paceChosen,false);followDifficulty(old,'standard');assert.deepEqual([old.pauseSighted,old.pauseHurt,old.pauseObjective,old.pauseSquad],[false,false,false,false]);
});

test('on Veteran the calibration bot gets past Chapter VII’s council: with a Contest policy that wins, or else the patron-backed re-run',()=>{
  // Seed 1: a policy wins the vote outright. Seed 10: every policy loses it by a vote, so the
  // bot takes the game's own recovery after a lost Contest, with its supplies and debt. Which
  // seed needs the backing follows the earlier battles' outcomes (seed 8 until release 4).
  for(const [seed,backed]of [[1,false],[10,true]]){
    const council=[];
    const {state}=runRealtimeCampaign({seed,difficulty:'veteran',throughChapter:7,retries:2,play:playBattle,
      onEncounter:(s,summary)=>{if(s.encounter.id==='ch7-council')council.push(summary);}});
    assert.equal(state.chapter,8,`seed ${seed}: Chapter VIII reached`);
    assert.equal(council.length,1);assert.equal(council[0].status,'won');assert.equal(!!council[0].fallback,backed,`seed ${seed}: the patron’s backing`);
    assert.equal(state.obligations.some(o=>o.id==='fallback:ch7-council'),backed,`seed ${seed}: the backing’s debt is recorded`);
  }
});

test('on Story the bot completes the whole campaign in real time from New Game by legal commands, to the accession (Gate 4, automated)',()=>{
  const {state,encounters}=runRealtimeCampaign({difficulty:'story',throughChapter:12});
  assert.equal(state.difficulty,'story');assert.equal(state.phase,'epilogue');assert.ok(state.milestones.includes('augustus'));
  assert.ok(encounters.filter(e=>e.rounds!==undefined).every(e=>e.status==='won'));
});
