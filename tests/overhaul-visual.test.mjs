import test from 'node:test';
import assert from 'node:assert/strict';
import {scenePalette,formationGlyph,moraleState} from '../src/ui/scene-materials.js';
import {stoneOutcrop,masonryWall,palmTree} from '../src/ui/material-forms.js';
import {previewPath} from '../src/ui/battle-art.js';
import {reachable,movementPinned} from '../src/core/shared.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../src/ui/animation-timeline.js';
import {snapshotEncounter} from '../src/ui/motion.js';
import {sampleSpritePose} from '../src/ui/sprite-poses.js';
import {drawBattleEffects} from '../src/ui/battle-effects.js';

const unit=(id,x,y,extra={})=>({id,name:id,side:id==='hero'?'player':'enemy',role:'infantry',x,y,hp:12,maxHp:12,morale:80,facing:'east',move:5,...extra});
const board=units=>({id:'visual-contract',combatVersion:2,kind:'battle',width:8,height:8,status:'active',units,terrain:Array.from({length:8},()=>Array(8).fill('grass')),log:[]});
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
function context(){
  const calls=[],stack=[];let state={globalAlpha:1};
  const c=new Proxy({}, {get(_,key){if(key in state)return state[key];if(key==='save')return()=>stack.push({...state});if(key==='restore')return()=>{assert.ok(stack.length);state=stack.pop();};return(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));if(key==='ellipse')assert.ok(args[2]>=0&&args[3]>=0);calls.push({key,args,...state});};},set(_,key,value){state[key]=value;return true;}});
  return {c,calls,balanced:()=>assert.equal(stack.length,0)};
}

test('Twelve chapter profiles and earned civic milestones have distinct authored material identities',()=>{
  const profiles=Array.from({length:12},(_,i)=>scenePalette(i+1,freeze({kind:'battle'})));
  assert.equal(new Set(profiles.map(p=>p.title)).size,12);assert.equal(new Set(profiles.map(p=>p.ground)).size,12);
  const civic=[8,10,11,12].map(chapter=>scenePalette(chapter,{kind:'contest'}));
  assert.equal(new Set(civic.map(p=>p.title)).size,4);assert.equal(new Set(civic.map(p=>p.stone)).size,3);
  assert.notEqual(civic[1].inlay,civic[2].inlay);assert.notEqual(civic[2].inlay,civic[3].inlay);
  const changed=scenePalette(1);changed.grass='mutated';assert.notEqual(scenePalette(1).grass,changed.grass,'profile callers do not mutate the shared art direction');
  assert.equal(scenePalette(NaN).title,profiles[0].title);assert.equal(scenePalette(99).title,profiles[11].title);
});

test('Formation and morale visual classes express authoritative thresholds without changing optional legacy state',()=>{
  const forms=['line','shield-wall','wedge'].map(formationGlyph);assert.equal(new Set(forms.map(JSON.stringify)).size,3);assert.ok(forms.every(points=>points.length>=2&&points.length<=8));
  assert.deepEqual(formationGlyph('unknown'),[]);assert.deepEqual(formationGlyph(null),[]);
  for(const [value,expected] of [[0,'broken'],[15,'broken'],[16,'shaken'],[34,'shaken'],[35,null],[100,null],[undefined,null]])assert.equal(moraleState(freeze({morale:value})),expected);
});

test('Version 2 movement preview follows actual engagement stops and weighted legal routes',()=>{
  const e=board([unit('hero',0,3),unit('enemy',3,3)]);e.terrain[4][2]='marsh';e.terrain[2][2]='rock';freeze(e);
  const hero=e.units[0];let inspected=0;
  for(const target of reachable(e,hero)){
    const path=previewPath(e,hero,target);assert.deepEqual(path.at(-1),{x:target.x,y:target.y});
    assert.ok(path.slice(1,-1).every(p=>!movementPinned(e,hero,p)),'No preview continues after entering a hostile melee frontage');
    const cost=path.slice(1).reduce((n,p)=>n+(e.terrain[p.y][p.x]==='marsh'?2:1),0);assert.equal(cost,target.cost);inspected++;
  }
  assert.ok(inspected>10);assert.equal(previewPath(e,hero,{x:2,y:3}).length,3);
  const legacy=structuredClone(e);delete legacy.combatVersion;
  assert.ok(previewPath(legacy,legacy.units[0],{x:4,y:3}).length>0,'Legacy fixture routing remains available');
});

test('Natural forms use finite bounded geometry and retain balanced drawing state',()=>{
  for(const draw of [stoneOutcrop,masonryWall,palmTree])for(const scale of [.01,.5,1.5]){
    const r=context();draw(r.c,scale);r.balanced();assert.ok(r.calls.length>20&&r.calls.length<350,'Each form has fixed bounded complexity');
    assert.ok(r.calls.some(c=>c.key==='ellipse'),'All forms have ground contact shading');
  }
  const rock=context(),palm=context();stoneOutcrop(rock.c);palmTree(palm.c);
  assert.ok(!rock.calls.some(c=>c.key==='fillRect'),'Natural rock is not a cuboid stamp');
  assert.ok(palm.calls.some(c=>c.key==='bezierCurveTo'));assert.ok(palm.calls.some(c=>c.key==='quadraticCurveTo'),'Palm fronds have curved organic silhouettes');
});

test('An actual attack shifts weight toward its recipient and recoil away, then settles at exact rule coordinates',()=>{
  const before=board([unit('hero',1,3),unit('enemy',2,3)]),after=structuredClone(before);after.units[1].hp-=3;
  const saved=JSON.stringify({before,after});freeze(before);freeze(after);
  const timeline=buildEncounterTimeline(before,after,{command:{action:'strike',unitId:'hero',targetId:'enemy'}});
  const attack=timeline.tracks.find(t=>t.pose==='attack'),hit=timeline.tracks.find(t=>t.pose==='hit');
  const actor=sampleEncounterTimeline(timeline,attack.start+attack.duration*.5).unitOverrides.hero;
  const victim=sampleEncounterTimeline(timeline,hit.start+hit.duration*.5).unitOverrides.enemy;
  assert.ok(actor.x>1&&actor.x<=1.1);assert.ok(victim.x>2&&victim.x<=2.1);assert.equal(actor.y,3);assert.equal(victim.y,3);
  const end=sampleEncounterTimeline(timeline,timeline.duration);assert.equal(end.unitOverrides.hero.x,1);assert.equal(end.unitOverrides.enemy.x,2);assert.equal(JSON.stringify({before,after}),saved);
});

test('Political Resolve loss uses interrupted argument cues while weapon damage keeps contact effects',()=>{
  const before=board([unit('hero',1,3,{resolve:12}),unit('enemy',2,3,{resolve:12})]);before.kind='contest';const after=structuredClone(before);after.units[1].resolve=after.units[1].hp=8;
  const timeline=buildEncounterTimeline(before,after,{command:{action:'denounce',unitId:'hero',targetId:'enemy'}}),hit=timeline.effects.find(e=>e.type==='impact');assert.equal(hit.political,true);
  const political=context(),military=context(),g={tw:60,th:30,ox:200,oy:100};
  drawBattleEffects(political.c,g,{effects:[{...hit,progress:.5,alpha:1}]});drawBattleEffects(military.c,g,{effects:[{...hit,political:false,progress:.5,alpha:1}]});
  assert.ok(!political.calls.some(c=>c.key==='ellipse'),'Resolve feedback has no physical contact flash');assert.ok(military.calls.some(c=>c.key==='ellipse'));political.balanced();military.balanced();
});

test('Command gestures and settled guards differ from ordinary speech without changing atlas coordinates',()=>{
  const command=sampleSpritePose({pose:'order',progress:.44}),speech=sampleSpritePose({pose:'speak',progress:.44}),guard=sampleSpritePose({pose:'idle'},{braced:true}),rest=sampleSpritePose({pose:'idle'});
  assert.ok(command.lift<speech.lift);assert.ok(guard.lean<rest.lean&&guard.hip>rest.hip);assert.equal(guard.active,false,'A held guard keeps the fast one-stamp path');
  assert.deepEqual(sampleSpritePose({pose:'order',progress:0}),sampleSpritePose({pose:'order',progress:1}));
  const e=board([unit('hero',1,3,{lastMoveDistance:3})]),snapshot=snapshotEncounter(e);assert.equal(snapshot.combatVersion,2);assert.equal(snapshot.units[0].lastMoveDistance,3);e.units[0].lastMoveDistance=0;assert.equal(snapshot.units[0].lastMoveDistance,3);
});
