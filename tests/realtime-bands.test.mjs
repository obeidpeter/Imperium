import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {createWorld,step,worldHash} from '../src/core/realtime/simulation.js';
import {bandMemberFell,bandReinforced,bandRound,formBand} from '../src/core/realtime/bands.js';
import {blowSetup} from '../src/core/realtime/combat.js';
import {alliedPlans} from '../src/core/realtime/intel.js';
import {validateWorld} from '../src/core/realtime/validate.js';
import {applyRealtimeOutcome} from '../src/core/realtime/campaign-encounter.js';
import {spawnActor} from '../src/core/realtime/actors.js';
import {ARENA,BAND_MORALE,TIME} from '../src/data/realtime-rules.js';
import {playRealtime} from '../scripts/realtime-autoplay.mjs';

// War bands (Chapters I–III; worlds and gameplay plan, release 3): the single
// raiders of an early battle share one morale; broken, they run for their
// edge of the field and leave it.

const R=TIME.roundTicks,B=BAND_MORALE;
const grass=(w=24,h=12)=>({id:'open',width:w,height:h,terrain:Array.from({length:h},()=>Array(w).fill('grass'))});
const raider=(id,at,over={})=>({...ARENA.enemies[0],id,at,face:[-1,0],faction:'gothic',unitId:`unit-${id}`,...over});
const field=({chapter=2,raiders=[raider('r1',[48,14]),raider('r2',[50,18],{attributes:{...ARENA.enemies[0].attributes,con:16}}),raider('r3',[52,22])],hero=[8,15]}={})=>{
  const w=createWorld({map:grass(),seed:5,actors:[{...ARENA.hero,at:hero},...raiders]});w.chapter=chapter;formBand(w);return w;};
const man=(w,id)=>w.actors.find(a=>a.id===id);

test('the raiders who fight alone form one war band: its leader the man with the most Health, its edge the side nearest it',()=>{
  const w=field(),b=w.band;
  assert.deepEqual(b.members,['r1','r2','r3']);assert.equal(b.size,3);assert.equal(b.morale,B.start);assert.equal(b.state,'steady');
  assert.equal(b.leaderId,'r2','the hardiest man leads');assert.equal(man(w,'r2').name,'Gothic war leader');assert.ok(man(w,'r2').officer,'companions can single him out');
  assert.equal(b.edge,'east');assert.doesNotThrow(()=>validateWorld(w,m=>{throw new Error(m);}));
  // The drill partner and squads' men are never a band's.
  const drill=createWorld({map:grass(),seed:5,actors:[{...ARENA.hero,at:[8,15]},{...raider('t',[20,15]),practice:true}]});assert.equal(formBand(drill),null);
});

test('each fallen man costs 48 ÷ the band’s size, eight more from ambush and fifteen more for the leader; it wavers at 40 and breaks at 20',()=>{
  const w=field();
  bandMemberFell(w,man(w,'r1'));assert.equal(w.band.morale,B.start-B.loss/3);assert.equal(w.band.state,'steady');
  bandMemberFell(w,man(w,'r2'),{ambush:true});
  assert.equal(w.band.morale,B.start-2*B.loss/3-B.ambush-B.leader);assert.equal(w.band.state,'shaken','the leader struck down from ambush shakes it');
  assert.deepEqual(w.events.map(e=>e.kind),['band-leader-fell','band-shaken']);
  bandMemberFell(w,man(w,'r3'));assert.equal(w.band.state,'broken','the last man down breaks it');assert.equal(w.events.at(-1).kind,'band-broken');
  // Once broken it stays broken: only reinforcements can lift it.
  w.tick=R-1;bandRound(w);assert.equal(w.band.state,'broken');
});

test('a wavering band’s blows take one less after Chapter I, as a shaken squad’s do',()=>{
  for(const [chapter,expect]of [[1,false],[2,true]]){
    const w=field({chapter});w.band.morale=30;w.band.state='shaken';
    const mods=blowSetup(w,man(w,'r1'),man(w,'hero')).mods;
    assert.equal(mods.some(m=>m.label==='Shaken morale'&&m.value===-1),expect,`Chapter ${chapter}`);
  }
  const steady=field();assert.ok(!blowSetup(steady,man(steady,'r1'),man(steady,'hero')).mods.some(m=>m.label==='Shaken morale'));
});

test('broken, the band runs for its edge; a man who reaches it leaves the field, gone for the objective and worth no training points',()=>{
  const w=field({raiders:[raider('r1',[40,14]),raider('r2',[44,18])]});w.band.morale=B.broken+1;
  const first=man(w,'r1');first.alive=false;bandMemberFell(w,first);
  assert.equal(w.band.state,'broken');const runner=man(w,'r2'),name=runner.name;
  step(w);step(w);step(w);step(w);step(w);
  assert.ok(runner.order?.flee,'he runs');assert.equal(alliedPlans(w).threats.find(t=>t.id==='r2').intent,'Fleeing the field.');
  for(let t=0;t<R*3&&man(w,'r2');t++)step(w);
  assert.equal(man(w,'r2'),undefined,'he has left the field');
  assert.deepEqual(w.band.fled.map(f=>f.id),['r2']);assert.ok(w.log.some(l=>l.text===`${name} escapes the field.`));
  // The fight without a mission ends when no enemy stands: the one who fled is not waited for.
  assert.equal(w.status,'won');
  assert.doesNotThrow(()=>validateWorld(w,m=>{throw new Error(m);}));
});

test('at a round’s end the band loses 5 outnumbered two to one and regains 10 after a round out of contact; reinforcements lift it 15',()=>{
  const w=field({raiders:[raider('r1',[48,14])]});
  // One raider against the soldier alone: not outnumbered two to one, and out of contact all round.
  w.band.morale=60;w.tick=R-1;bandRound(w);assert.equal(w.band.morale,70,'a round out of contact');
  w.band.morale=78;bandRound(w);assert.equal(w.band.morale,B.start,'never above its start');
  // Two of ours: outnumbered two to one; in contact this round, so no rest.
  spawnActor(w,{name:'Ally',side:'ally',role:'infantry',attributes:{},kit:['tunic','gladius']},{x:10,z:15},'ally');w.band.contactTick=w.tick;
  w.band.morale=60;bandRound(w);assert.equal(w.band.morale,55);
  // Reinforcements: +15, and a broken band stands again above the broken line.
  w.band.morale=15;w.band.state='broken';const fresh=spawnActor(w,raider('r9',[56,15]),{x:56,z:15},'reinforce0');
  bandReinforced(w,fresh);assert.equal(w.band.morale,30);assert.equal(w.band.state,'shaken');assert.equal(w.band.size,2);assert.ok(w.band.members.includes('reinforce0'));
  assert.equal(w.events.at(-1).kind,'band-rallied');
});

test('in the campaign, Chapter I’s raiders are a war band, and the men who escape are recorded as fled, with no Health and no kill training points',()=>{
  // From New Game by legal commands: the drill (no band), then the road.
  const road=G.newGame('Aurelius Marcellus',275,{featureEdition:35,progression:true});
  G.choose(road,G.getChapter(road).decision.options[0].id);
  assert.ok(G.startEncounter(road,{controls:'realtime'}).ok);assert.equal(G.realtimeWorld(road).band,undefined,'the drill has no war band');
  assert.equal(playRealtime(road).status,'won');assert.ok(G.commitEncounter(road).ok);G.swearOath(road);
  assert.ok(G.startEncounter(road,{controls:'realtime'}).ok);assert.equal(road.encounter.id,'ch1-road');const w=G.realtimeWorld(road);
  assert.ok(w.band,'the road’s raiders form a band');assert.equal(w.band.edge,'east');
  const leader=w.actors.find(a=>a.id===w.band.leaderId);assert.equal(leader.name,'Gothic war leader');
  // Break it at once and let the men run.
  w.band.morale=1;w.band.state='broken';for(let t=0;t<R*4&&w.actors.some(a=>w.band.members.includes(a.id)&&a.alive);t++)step(w);
  assert.ok(w.band.fled.length>=1,'men escape');
  const before=worldHash(w);applyRealtimeOutcome(road,w);assert.equal(worldHash(w),before,'the world is only read');
  for(const f of w.band.fled.filter(f=>f.unitId)){const unit=road.encounter.units.find(u=>u.id===f.unitId);assert.equal(unit.hp,0);assert.equal(unit.fled,true);}
  assert.equal(road.encounter.staged.killTP,0,'no one was struck down');
});
