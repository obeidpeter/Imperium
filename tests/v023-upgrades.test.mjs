import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {playEncounter} from '../scripts/autoplay.mjs';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {createWeatherField,sampleWeatherParticles} from '../src/showcase/stage-particles.js';
import {actorKit} from '../src/showcase/actor-kit.js';
import {createActor} from '../src/showcase/actors.js';
import {turnScrubberItems} from '../src/ui/turn-replay.js';
import {journeyMap} from '../src/ui/art.js';
import {createPanels} from '../src/ui/panels.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {encounterView} from '../src/ui/encounter-view.js';
import {veteranAcademy} from '../src/ui/progression-views.js';

const clone=x=>JSON.parse(JSON.stringify(x)),checkpoints=new Map();
let campaignResult=null;
function ensureCampaign(){
  if(!campaignResult){
    campaignResult=runProgressionCampaign({onCheckpoint:s=>checkpoints.set(G.getChapter(s).encounters[s.encounterIndex].id,clone(s))});
  }
  return campaignResult;
}
function camp(id){ensureCampaign();return clone(checkpoints.get(id));}
function start(id){const s=camp(id);assert.ok(G.startEncounter(s).ok);return s;}

test('v0.23.0 Archive of the Reign: archiveEncounters and createArchiveReplay run isolated sandbox encounters without mutating campaign state',()=>{
  const completed=clone(ensureCampaign().state);
  const before=G.serialize(completed);
  const list=G.archiveEncounters(completed);
  assert.equal(list.length,25);
  assert.equal(list[0].id,'ch1-training');
  assert.equal(list[24].id,'ch12-confrontation');
  assert.equal(G.serialize(completed),before,'Listing archive encounters must be pure');

  const bad=G.createArchiveReplay(completed,'nonexistent');
  assert.equal(bad.ok,false);
  assert.equal(G.serialize(completed),before);

  const res=G.createArchiveReplay(completed,'ch5-mine');
  assert.equal(res.ok,true);
  assert.equal(G.serialize(completed),before,'Creating an archive replay must not mutate the source save');
  const sandbox=res.state;
  assert.equal(sandbox.archiveReplay.encounterId,'ch5-mine');
  assert.equal(sandbox.encounter.id,'ch5-mine');
  assert.equal(sandbox.phase,'encounter');

  const initialSandbox=G.serialize(sandbox);
  assert.ok(G.endTurn(sandbox).ok);
  assert.ok(G.retry(sandbox).ok);
  assert.equal(G.serialize(sandbox),initialSandbox,'Retry inside an archive replay restores the exact opening sandbox state');
  assert.equal(playEncounter(sandbox).status,'won');
  const commitAttempt=G.commitEncounter(sandbox);
  assert.equal(commitAttempt.ok,false,'Archive replays must never commit rewards to the chronicle');
  assert.match(commitAttempt.message,/Archive replay complete/);

  // UI rendering for Archive in Journal, Epilogue, and active sandbox encounter
  let modalHtml='';
  const panels=createPanels(()=>({state:completed,screen:'game',settings:{},offline:false,currentChapterOffline:false,offlineProgress:'',showModal:(_t,b)=>{modalHtml=b;},meters:()=>'',requirements:()=>''}));
  panels.showJournal();
  assert.match(modalHtml,/data-cmd="archive-replay" data-id="ch1-training"/);
  const views=createCampaignViews(()=>({state:completed,screen:'game',settings:{}}));
  const epilogue=views.ending();
  assert.match(epilogue,/Archive of the Reign/i);
  assert.match(epilogue,/data-cmd="archive-replay" data-id="ch12-confrontation"/);
  const sandboxHtml=encounterView({view3D:false,can3D:true,state:sandbox,selected:'hero',header:()=>'',footer:()=>'',requirements:()=>''});
  assert.match(sandboxHtml,/ARCHIVE OF THE REIGN · SANDBOX/);
  assert.match(sandboxHtml,/data-cmd="exit-archive"/);
});

test('v0.23.0 Dynamic 3D Weather & Night-March Torchlight: scene profiles and deterministic weather particle fields',()=>{
  const marsh=getSceneProfile({id:'ch2-marsh',kind:'battle',map:'marsh'},{chapter:2});
  assert.equal(marsh.weather,'rain');
  assert.equal(marsh.timeOfDay,'dawn');
  assert.equal(marsh.torchlight,false);

  const siege=getSceneProfile({id:'ch5-mine',kind:'battle',map:'sand'},{chapter:5});
  assert.equal(siege.timeOfDay,'dusk');
  assert.equal(siege.weather,'embers');

  const dayField=getSceneProfile({id:'ch9-wing',kind:'battle',map:'sand'},{chapter:9,stratagem:'flank'});
  const nightField=getSceneProfile({id:'ch9-wing',kind:'battle',map:'sand'},{chapter:9,stratagem:'night'});
  assert.equal(dayField.timeOfDay,'day');
  assert.equal(nightField.timeOfDay,'night');
  assert.equal(nightField.torchlight,true);
  assert.notEqual(dayField.sky,nightField.sky,'Night march stratagem must shift the 3D sky palette to moonlight');

  const cloud=createWeatherField(null);
  assert.ok(cloud.geometry.attributes.position.count>=128&&cloud.geometry.attributes.position.count<=640,'Weather stays inside the supported GPU particle budget');
  for(const weather of ['rain','embers','dust','mist']){
    sampleWeatherParticles(cloud,weather,1.25,{reducedMotion:false});
    assert.equal(cloud.visible,true,`${weather} field should be visible`);
    const sampleA=[...cloud.geometry.attributes.position.array];
    sampleWeatherParticles(cloud,weather,1.25,{reducedMotion:false});
    const sampleB=[...cloud.geometry.attributes.position.array];
    assert.deepEqual(sampleA,sampleB,`${weather} particle sampling must be deterministic`);
    assert.ok(sampleA.every(Number.isFinite),`${weather} particle coordinates must be finite`);
  }
  sampleWeatherParticles(cloud,'clear',1.25,{reducedMotion:false});
  assert.equal(cloud.visible,false,'Clear weather hides weather particles cleanly');
});

test('v0.23.0 Veteran Commendation Ranks, Evocatus Mastery, 3D Insignia & Companion Callouts',()=>{
  assert.equal(G.veteranRank(0).id,'miles');
  assert.equal(G.veteranRank(1).id,'immunis');
  assert.equal(G.veteranRank(3).id,'optio');
  const evo=G.veteranRank(6,'protector');
  assert.equal(evo.id,'evocatus');
  assert.equal(evo.masteryUnlocked,true);
  assert.match(evo.mastery,/Evocatus mastery/);

  // 3D Insignia: Tier 2 gets phalerae, Tier 3 gets phalerae + transverse crest
  const unit={id:'ally0',name:'Lucan',side:'ally',role:'legionary',veteranId:'lucan',hp:14,maxHp:14};
  const kitTier0=actorKit(unit,{chapter:5,commendations:{lucan:0}});
  const kitTier2=actorKit(unit,{chapter:5,commendations:{lucan:3}});
  const kitTier3=actorKit(unit,{chapter:5,commendations:{lucan:6}});
  assert.equal(kitTier0.veteranTier,0);
  assert.equal(kitTier2.veteranTier,2);
  assert.equal(kitTier3.veteranTier,3);

  const rig2=createActor(unit,{chapter:5,commendations:{lucan:3}});
  const rig3=createActor(unit,{chapter:5,commendations:{lucan:6}});
  assert.ok(rig2.group.getObjectByName('veteran-phalerae'),'Optio cohortis (Tier 2) rig must mount 3D phalerae');
  assert.equal(rig2.group.getObjectByName('veteran-crest'),undefined);
  assert.ok(rig3.group.getObjectByName('veteran-phalerae'),'Evocatus (Tier 3) rig must mount 3D phalerae');
  assert.ok(rig3.group.getObjectByName('veteran-crest'),'Evocatus (Tier 3) rig must mount transverse veteran crest');
  rig2.dispose();
  rig3.dispose();

  // Evocatus mastery in combat & companion callouts
  const s=start('ch5-mine'),e=s.encounter;
  const protector=e.units.find(u=>u.specialization==='protector');
  const hero=e.units.find(u=>u.id==='hero');
  protector.x=1;protector.y=3;hero.x=0;hero.y=3;hero.morale=60;
  protector.moraleResistance=1; // Earned 6+ commendations (Evocatus)
  const guardCmd={unitId:protector.id,action:'guard',x:hero.x,y:hero.y,targetId:hero.id};
  assert.match(G.preview(s,guardCmd).message,/Evocatus mastery: \+5 target morale/);
  const callout=G.companionCallout(e,guardCmd);
  assert.ok(callout?.text);
  assert.equal(callout.rankTitle,'Evocatus Augusti');
  assert.ok(G.act(s,guardCmd).ok);
  assert.equal(hero.morale,65,'Evocatus Protector Guard restores +5 morale to the ward');

  const campState=camp('ch5-mine');
  assert.match(veteranAcademy(campState),/veteran-rank-badge/);
});

test('v0.23.0 Interactive Imperial Command Tabula & Turn-Step Scrubber',()=>{
  const s=camp('ch7-council');
  const svg=journeyMap(s.chapter);
  assert.match(svg,/class="tabula-node[^"]*" data-theatre="danube"/);
  assert.match(svg,/data-theatre="rome"/);

  let modalBody='';
  const panels=createPanels(()=>({state:s,screen:'game',settings:{},offline:false,currentChapterOffline:false,offlineProgress:'',showModal:(_t,b)=>{modalBody=b;},meters:()=>'',requirements:()=>''}));
  panels.showMap();
  assert.match(modalBody,/class="tabula-dossiers"/);
  assert.match(modalBody,/details class="tabula-theatre" data-theatre="danube"/);
  assert.doesNotMatch(modalBody,/data-cmd="(?!continue|new)/,'showMap must preserve the strict navigation command contract');

  const battleState=start('ch4-gate');
  assert.ok(G.endTurn(battleState).ok);
  const items=turnScrubberItems(battleState.encounter,battleState.encounter.turnEvents);
  assert.ok(items.length>0);
  assert.ok(items.every(item=>typeof item.label==='string'&&typeof item.text==='string'));
  const html=encounterView({view3D:true,can3D:true,state:battleState,selected:'hero',header:()=>'',footer:()=>'',requirements:()=>''});
  assert.match(html,/id="turn-scrubber"/);
  assert.match(html,/data-cmd="scrub-step"/);
});

test('v0.23.0 Senate Career Precedent Motions & Broker Shielding',async()=>{
  const s=start('ch7-council');
  s.supplies=6;
  const before=G.serialize(s);
  const opts=G.precedentOptions(s);
  assert.equal(opts.enabled,true);
  const frontierOpt=opts.motions.find(o=>o.id==='frontier-roll');
  const auditOpt=opts.motions.find(o=>o.id==='fiscal-audit');
  assert.equal(frontierOpt.unlocked,true,'Earned frontier commendations/army meter unlock the Frontier Roll precedent');
  assert.equal(auditOpt.unlocked,true,'Treasury/political standing unlocks the Fiscal Audit precedent');

  const prev=G.previewPrecedent(s,'fiscal-audit');
  assert.equal(prev.ok,true);
  assert.equal(G.serialize(s),before,'previewPrecedent must be pure');

  const landholdersBefore=s.encounter.units.filter(u=>u.role==='voter'&&u.bloc==='Landholders').map(u=>u.stance);
  const res=G.invokePrecedent(s,'fiscal-audit');
  assert.equal(res.ok,true);
  assert.equal(s.encounter.precedentUsed,'fiscal-audit');
  assert.equal(s.encounter.precedentShield,true);
  const landholdersAfter=s.encounter.units.filter(u=>u.role==='voter'&&u.bloc==='Landholders').map(u=>u.stance);
  assert.ok(landholdersAfter.some((v,i)=>v>landholdersBefore[i]),'Fiscal Audit precedent raises Landholders bloc stance');

  const repeat=G.invokePrecedent(s,'frontier-roll');
  assert.equal(repeat.ok,false,'Only one Career Precedent Motion may be entered per Contest');

  // Verify Contest view renders the Career Precedent Motions panel
  const contestHtml=encounterView({view3D:true,can3D:true,state:s,selected:'hero',header:()=>'',footer:()=>'',requirements:()=>''});
  assert.match(contestHtml,/id="chamber-precedents"/);
  assert.match(contestHtml,/Invoked \(fiscal-audit\)/);

  // Verify 3D Senate Bloc Standards & focusPoint on BattleStage
  const {BattleStage}=await import('../src/showcase/stage.js');
  const T=await import('../vendor/three/three.module.js');
  const stage=Object.create(BattleStage.prototype);
  Object.assign(stage,{
    overlay:new T.Group(),
    chamberStandards:new Map(),
    baseTarget:new T.Vector3(),
    hoverRing:new T.Object3D(),
    world:tile=>new T.Vector3(tile.x*2.5,0,tile.y*2.5),
  });
  stage.updateChamberStandards(s.encounter);
  assert.equal(stage.chamberStandards.size,3);
  for(const bloc of ['Veterans','Landholders','Civic']){
    const std=stage.chamberStandards.get(bloc);
    assert.ok(std?.group.visible);
    assert.equal(std.banner.userData.bloc,bloc);
  }
  stage.focusPoint({x:3,y:4});
  assert.equal(stage.hoverRing.visible,true);
  assert.deepEqual(stage.baseTarget.toArray(),[7.5,0.85,10]);
});
