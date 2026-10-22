import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {abilityGroups,bindHudDisclosures,chamberReadoutKey,compactChamberReadout,compactMissionReadout,revealAbility} from '../src/ui/realtime-hud.js';
import {FIELD_ORDER,TIME} from '../src/data/realtime-rules.js';
import {fieldMarkup} from '../src/ui/realtime-view.js';
import {DEFAULT_KEYMAP} from '../src/ui/action-map.js';
import * as G from '../src/core/game.js';
import {yieldFloor} from '../src/core/chamber.js';
import {missionReadout} from '../src/ui/realtime-mission-readout.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';

test('the common action group is bounded while every learned action remains available in its original order',()=>{
  const ids=[...FIELD_ORDER],before=JSON.stringify(ids),groups=abilityGroups(ids);
  assert.deepEqual(groups.primary,['strike','brace','throw_pilum']);
  assert.deepEqual(groups.more,ids.slice(3));assert.deepEqual([...groups.primary,...groups.more],ids);
  assert.deepEqual(abilityGroups(['strike','scout','carry']),{primary:['strike'],more:['scout','carry']});
  assert.equal(JSON.stringify(ids),before);
});

test('keyboard selection reveals an advanced action and preserves separate reachable toolbar entry points',()=>{
  const details={open:false},primary=[],more=[];
  const group=buttons=>({querySelectorAll:()=>buttons}),main=group(primary),extra=group(more);
  const button=(id,parent,disclosure=null)=>({dataset:{ability:id},tabIndex:-1,focus(options){this.focused=options;},closest:s=>s==='details'?disclosure:parent});
  primary.push(button('strike',main),button('brace',main));more.push(button('carry',extra,details),button('scout',extra,details));
  primary[0].tabIndex=0;more[0].tabIndex=0;
  const bar={querySelectorAll:()=>[...primary,...more]};
  assert.equal(revealAbility(bar,'scout',{focus:true}),more[1]);assert.equal(details.open,true);
  assert.deepEqual(more.map(b=>b.tabIndex),[-1,0]);assert.deepEqual(primary.map(b=>b.tabIndex),[0,-1]);
  assert.deepEqual(more[1].focused,{preventScroll:true});assert.equal(revealAbility(bar,'unknown'),null);
});

test('disclosure Close and Escape return focus without invoking a game action',()=>{
  const listeners=new Map(),root={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const summary={focus(options){this.focused=options;}},details={open:true,querySelector:()=>summary};
  const target={closest:()=>details};let prevented=false,stopped=false;
  const dispose=bindHudDisclosures(root);
  listeners.get('keydown')({key:'Escape',target,preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});
  assert.equal(details.open,false);assert.equal(prevented,true);assert.equal(stopped,true);assert.deepEqual(summary.focused,{preventScroll:true});
  details.open=true;listeners.get('click')({target});assert.equal(details.open,false);
  dispose();assert.equal(listeners.size,0);
});

test('compact mission status retains exact deadlines, essential rescue conditions and pending order acknowledgement',()=>{
  const world={status:'active',tick:TIME.roundTicks,used:[],queue:[],actors:[{id:'a',alive:true,x:10,z:10}],
    mission:{mode:'extract',goal:{x:10,z:10},radius:3,escorts:['a'],deadline:4}};
  const full={objective:'Complete original orders.',next:'Bring your soldier inside too.',orderStatus:'First squad: Hold on its way (2s).'},before=JSON.stringify(world);
  const summary=compactMissionReadout(world,full);
  assert.match(summary.headline,/including your soldier/);assert.equal(summary.progress,'1/1 survivors at marker');assert.equal(summary.deadline,'0:30 left');
  assert.equal(summary.order,'');assert.equal(JSON.stringify(world),before);
  world.queue.push({kind:'order'});assert.equal(compactMissionReadout(world,full).order,full.orderStatus);
  world.mission.toldMissing=true;assert.equal(compactMissionReadout(world,full).headline,full.next);
  world.status='lost';world.tick=99999;assert.equal(compactMissionReadout(world,full).deadline,'0:00 left');
});

test('compact status never counts concealed enemies and keeps commander, gathering and finale requirements recognizable',()=>{
  const world={status:'active',tick:0,used:[],actors:[{side:'enemy',alive:true},{side:'enemy',alive:true,hidden:true}],mission:{mode:'clear',deadline:8}};
  assert.equal(compactMissionReadout(world).progress,'1 enemy in sight');
  world.mission={mode:'capture',commander:true,points:[{secured:true}]};assert.match(compactMissionReadout(world).headline,/soldier.*main marker/);
  world.mission.gather=12;assert.match(compactMissionReadout(world).headline,/soldier and companion/);
  world.mission={mode:'settlement',meeting:1};assert.match(compactMissionReadout(world).headline,/envoy.*claimant.*soldier.*Rally/);
});

test('the legal Chapter II withdrawal keeps its required holding time in compact status',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
  const s=G.deserialize(JSON.stringify(fixture.scenes.find(x=>x.id==='camp-2').state));
  assert.ok(G.choose(s,'leave').ok);assert.ok(G.startEncounter(s,{controls:'realtime'}).ok);
  const w=G.realtimeWorld(s),before=JSON.stringify(w),small=compactMissionReadout(w,missionReadout(w));
  assert.equal(w.mission.mode,'extract');assert.equal(w.mission.holdRequired,2);
  assert.match(small.headline,/Keep the marker clear for 2 rounds/);assert.match(small.progress,/0\/2 rounds held/);
  assert.equal(JSON.stringify(w),before,'reading the holding requirement does not advance time');
  const midway=structuredClone(w);midway.mission.heldTicks=TIME.roundTicks;
  assert.match(compactMissionReadout(midway).progress,/1\/2 rounds held/);
});

test('every campaign mission family keeps its required conditions in compact status and its full explanation available',()=>{
  const samples=new Map();let council=null;
  runCommandCampaign({featureEdition:35,onCheckpoint(s){
    const id=G.getChapter(s).encounters[s.encounterIndex]?.id;
    const p=G.deserialize(G.serialize(s));
    if(G.startEncounter(p,{controls:'realtime'}).ok){const w=G.realtimeWorld(p);if(w?.mission&&!samples.has(w.mission.mode))samples.set(w.mission.mode,w);if(id==='ch7-council')council=p;}
    if(id==='ch12-confrontation')for(const r of G.finaleForecast(s).routes){const route=G.deserialize(G.serialize(s));assert.ok(G.chooseRoute(route,r.id).ok);assert.ok(G.startEncounter(route,{controls:'realtime'}).ok);const w=G.realtimeWorld(route);samples.set(w.mission.mode,w);}
  }});
  // Explicit presentation fixtures for the two finale routes unavailable to
  // this legal campaign's standing; they do not claim to complete those routes.
  for(const mode of ['settlement','surrender'])samples.set(mode,{status:'active',tick:0,used:[],actors:[],objects:[],queue:[],log:[],
    mission:{mode,deadline:16,radius:7,meeting:0,points:[{secured:false},{secured:false}],required:[]}});
  const patterns={training:/drill/i,clear:/enemy force/i,extract:/everyone.*soldier.*marker/i,hold:/marked ground.*enemies/i,recover:/Scout.*chest/i,
    capture:/marker|positions/i,supply:/stores/i,defection:/pledges.*opposition/i,settlement:/envoy.*claimant.*soldier.*Rally/i,surrender:/gate approaches/i};
  assert.deepEqual([...samples.keys()].sort(),Object.keys(patterns).sort());
  for(const [mode,w]of samples){const before=JSON.stringify(w),full=missionReadout(w),small=compactMissionReadout(w,full);
    assert.match(small.headline,patterns[mode],mode);assert.ok(small.deadline,`${mode}: deadline remains visible`);
    if(w.mission.required?.some(id=>!w.used.includes(id)))assert.match(small.headline,/Required:/,mode);
    assert.equal(JSON.stringify(w),before,`${mode}: presentation does not mutate the mission`);
  }
  assert.ok(council);const before=G.serialize(council),votes=compactChamberReadout(council);
  assert.match(votes.votes,/\d+\/13 support · 7 needed/);assert.match(votes.projection,/projected if you change nothing/);assert.match(votes.deadline,/hours to vote/);
  assert.equal(G.serialize(council),before);
  // The compact clock must refresh even if the delegate DOM happens to be
  // identical across two hours; changed forecasts must still refresh it too.
  const markup='<p>Unchanged delegate forecast</p>',key=chamberReadoutKey(council,markup);
  assert.notEqual(chamberReadoutKey(council,markup+'new forecast'),key);
  assert.ok(yieldFloor(council).ok);
  assert.notEqual(chamberReadoutKey(council,markup),key);
  assert.notEqual(compactChamberReadout(council).deadline,votes.deadline);
  const activeKey=chamberReadoutKey(council,markup);
  for(let count=0;council.encounter.status==='active'&&count<30;count++)assert.ok(yieldFloor(council).ok);
  assert.notEqual(chamberReadoutKey(council,markup),activeKey);
  assert.equal(compactChamberReadout(council).deadline,'Vote complete');
});

test('help, mission details and logs start collapsed; required warnings and primary pause remain outside them',()=>{
  const state=G.newGame('Marcellus',275,{featureEdition:35,progression:true});
  const html=fieldMarkup({state,keymap:DEFAULT_KEYMAP,kind:'camp'});
  assert.match(html,/<button data-role="pauseButton"/);assert.match(html,/data-role="listButton"[^>]*>All actions<\/button>/);
  for(const role of ['missionDetails','controlOptions','timeControls','fieldHelp','logDetails']){
    const tag=html.match(new RegExp(`<details[^>]*data-role="${role}"[^>]*>`))?.[0];assert.ok(tag,role);assert.doesNotMatch(tag,/\sopen(?:\s|>)/);
  }
  assert.ok(html.indexOf('data-role="missionWarning"')<html.indexOf('data-role="missionDetails"'));
  assert.ok(html.indexOf('data-role="timeControls"')>html.indexOf('data-role="controlOptions"'));
  assert.match(html,/data-role="closeListButton">Close/);assert.match(html,/data-close-disclosure>Close help/);
});
