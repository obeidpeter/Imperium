import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as G from '../src/core/game.js';
import * as C from '../src/core/chamber.js';
import {playEncounter} from '../scripts/autoplay.mjs';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {CONTEST_RULES,NEUTRAL_PROFILE,argumentForecast,speakerProfile} from '../src/core/contest.js';

// The walk-and-talk Curia's rules (build brief §3.11, tests F30–F32): the
// chamber is a presentation of the 0.38 Contest engine. Recorded 0.38 command
// logs replayed through it under the neutral profile give the same stances,
// Resolve and votes, and the soldier's profile only ever adds to them.

const CONTESTS=['ch7-council','ch8-parley','ch10-tribunal','ch11-accounts','ch11-adlection','ch12-legitimacy'];
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
const outcome=s=>{const e=s.encounter;return {turn:e.turn,status:e.status,votes:G.voteCount(s),
  stances:e.units.filter(u=>u.role==='voter').map(u=>[u.id,u.stance]),resolve:e.units.filter(u=>u.role==='speaker').map(u=>[u.id,u.resolve,u.hp])};};
const route=async file=>JSON.parse(await readFile(new URL(`./compatibility/${file}`,import.meta.url),'utf8'));

// A frozen route replayed with its Contest commands through the chamber: walks,
// speeches, and the hour's end (the chamber's own when every speaker has spoken,
// else the player's yield). Every recorded state hash it reaches must match.
function throughChamber(f,starts){
  const s=G.deserialize(JSON.stringify(f.initial));let matched=0,pending=false;
  for(const [i,item]of f.trace.entries()){
    const e=s.encounter,inContest=s.phase==='encounter'&&e?.kind==='contest'&&e.status==='active';
    if(inContest&&item.kind==='act'&&!pending){
      const c=item.args[0],r=c.action==='move'?C.walk(s,c.unitId,{x:c.x,y:c.y}):C.speak(s,c);assert.ok(r.ok,`${i}: ${c.action}: ${r.message}`);
      if(r.hourEnded){pending=true;continue;}
      assert.equal(digest(s),item.sha256,`${i}: ${c.action}`);matched++;continue;
    }
    assert.ok(!pending||item.kind==='endTurn',`${i}: nothing comes between the hour's last speech and its end (${item.kind})`);
    if(item.kind==='endTurn'&&(pending||inContest)){if(!pending)assert.ok(C.yieldFloor(s).ok);pending=false;assert.equal(digest(s),item.sha256,`${i}: the hour's end`);matched++;continue;}
    assert.ok(G[item.kind](s,...item.args).ok,`${i}: ${item.kind}`);assert.equal(digest(s),item.sha256,`${i}: ${item.kind}`);
    if(item.kind==='startEncounter'&&s.encounter?.kind==='contest'&&!starts.has(`${f.source?.version??''}:${s.encounter.id}`))starts.set(s.encounter.id+':'+starts.size,G.serialize(s));
  }
  return {s,matched};
}
// A Contest log recorded from the 0.38 autoplay (its commands and End Turns), and
// the same log replayed directly and through the chamber, hour by hour.
function recordLog(start,approach){const s=G.deserialize(start),trace=[];playEncounter(s,{approach,trace});return trace;}
function direct(start,trace){
  const s=G.deserialize(start),hours=[];
  for(const t of trace){if(t.kind==='act')assert.ok(G.act(s,t.payload).ok);else{assert.ok(G.endTurn(s).ok);hours.push(outcome(s));}}
  return hours;
}
function chamber(start,trace){
  const s=G.deserialize(start),hours=[];let pending=false;
  for(const t of trace){
    if(t.kind==='act'){assert.equal(pending,false,'nothing comes after the hour’s last speech');const c=t.payload,r=c.action==='move'?C.walk(s,c.unitId,{x:c.x,y:c.y}):C.speak(s,c);
      assert.ok(r.ok,r.message);if(r.hourEnded){pending=true;hours.push(outcome(s));}}
    else if(pending)pending=false;else{assert.ok(C.yieldFloor(s).ok);hours.push(outcome(s));}
  }
  return hours;
}
// The current campaign's Contest camps (the 0.38 command campaign), each with the neutral profile:
// Eloquence and Authority at 10, no decorations and no courses (the condition F30 names; injected).
let campaignStarts=null;
function neutralCampaignStarts(){
  if(campaignStarts)return campaignStarts;campaignStarts=new Map();
  runCommandCampaign({featureEdition:35,onCheckpoint(s){
    const d=G.getChapter(s).encounters[s.encounterIndex];if(d?.kind!=='contest'||campaignStarts.has(d.id))return;
    const copy=G.deserialize(G.serialize(s));Object.assign(copy.soldier,{decorations:[],courses:[]});copy.soldier.base.elo=Math.min(10,copy.soldier.base.elo);copy.soldier.base.auth=Math.min(10,copy.soldier.base.auth);
    copy.soldier.titles=[];assert.ok(G.startEncounter(copy).ok);assert.equal(copy.encounter.profile,undefined,'neutral: the encounter carries no profile');campaignStarts.set(d.id,G.serialize(copy));
  }});
  return campaignStarts;
}

test('F30: the frozen 0.14.1 and 0.16 routes replay with every Contest command through the chamber, matching every recorded state hash',async()=>{
  for(const file of ['campaign-v014-route.json','campaign-v016-route.json']){
    const f=await route(file),{s,matched}=throughChamber(f,new Map());
    // Each Contest command and End Turn of the six chambers is compared once (a speech that ends the hour, at its End Turn).
    assert.ok(matched>=200,`${file}: ${matched} Contest states compared`);assert.equal(s.rank,'Augustus');
  }
});

test('F30: at least five 0.38 logs a Contest, replayed through the chamber, give the same stances, Resolve and votes hour by hour',async()=>{
  const starts=new Map();for(const file of ['campaign-v014-route.json','campaign-v016-route.json'])throughChamber(await route(file),starts);
  const logs=new Map(CONTESTS.map(id=>[id,0]));
  const check=(id,start,trace)=>{const want=direct(start,trace),got=chamber(start,trace);assert.deepEqual(got,want,`${id}`);assert.ok(want.length>=6);logs.set(id,logs.get(id)+1);};
  for(const [key,start]of starts){const id=key.split(':')[0];for(const approach of ['record','coalition'])check(id,start,recordLog(start,approach));}
  for(const [id,start]of neutralCampaignStarts())for(const approach of ['record','coalition'])check(id,start,recordLog(start,approach));
  for(const id of CONTESTS)assert.ok(logs.get(id)>=5,`${id}: ${logs.get(id)} generated logs (plus the two frozen routes)`);
});

// The profile the soldier speaks with: each value only adds.
const BOOSTED={resolve:12,denounce:1,rebut:1,record:1,addressRecovery:2};
function better(neutral,boosted,ours){
  for(const c of boosted.stanceChanges){const n=neutral.stanceChanges.find(x=>x.id===c.id);assert.ok(c.to>=(n?.to??c.from),`${c.name}: ${n?.to} → ${c.to}`);}
  for(const c of boosted.resolveChanges){const n=neutral.resolveChanges.find(x=>x.id===c.id);assert.ok(ours(c.id)?c.to>=n.to:c.to<=n.to,`${c.name}: Resolve ${n.to} → ${c.to}`);}
  assert.ok(boosted.votesAfter>=neutral.votesAfter);
}
test('F30: Eloquence, Authority, decorations and the Rhetor’s courses never leave a speech worse than 0.38’s, on every speech of the logs',()=>{
  let compared=0;
  for(const [,start]of neutralCampaignStarts())for(const approach of ['record','coalition']){
    const trace=recordLog(start,approach),s=G.deserialize(start);
    for(const t of trace){
      if(t.kind==='endTurn'){assert.ok(G.endTurn(s).ok);continue;}
      const c=t.payload,e=s.encounter,unit=e.units.find(u=>u.id===c.unitId),target=e.units.find(u=>u.id===c.targetId)??e.units.find(u=>u.x===c.x&&u.y===c.y);
      if(c.action!=='move'&&unit.id==='hero'){
        const neutral=argumentForecast(s,unit,c.action,target),copy=G.deserialize(G.serialize(s));copy.encounter.profile={...BOOSTED};
        const boosted=argumentForecast(copy,copy.encounter.units.find(u=>u.id==='hero'),c.action,copy.encounter.units.find(u=>u.id===target.id));
        better(neutral,boosted,id=>['player','ally'].includes(e.units.find(u=>u.id===id)?.side));compared++;
      }
      assert.ok(G.act(s,c).ok);
    }
  }
  assert.ok(compared>50,`${compared} of the soldier’s speeches compared`);
});

test('the speaker profile: Resolve +½ Eloquence and +¼ Authority above 10, +5 Practised delivery; Denounce and Rebut +⅒ Eloquence; Record +1 with three decorations; Address back after 2 hours with The long period',()=>{
  const start=G.deserialize(neutralCampaignStarts().get('ch11-accounts'));
  const at=(fn)=>{const s=G.deserialize(G.serialize(start));fn(s.soldier);return speakerProfile(s);};
  assert.deepEqual(at(()=>{}),NEUTRAL_PROFILE,'Eloquence and Authority at 10, nothing else: neutral');
  assert.equal(at(x=>{x.base.elo=15;x.base.auth=14;}).resolve,2+1);
  assert.equal(at(x=>{x.base.elo=15;x.courses=['practised_delivery'];}).resolve,2+5);
  assert.deepEqual([at(x=>{x.base.elo=20;}).denounce,at(x=>{x.base.elo=19;}).rebut],[1,0]);
  assert.equal(at(x=>{x.decorations=['phalerae','torques'];}).record,0);assert.equal(at(x=>{x.decorations=['phalerae','torques','armillae'];}).record,1);
  assert.equal(at(x=>{x.courses=['long_period'];}).addressRecovery,2);
  // In the Contest: the soldier's Resolve, his Record and his Denounce; the ally keeps 0.38's.
  const s=G.deserialize(G.serialize(start));s.phase='camp';s.encounter=null;s.soldier.base.elo=20;s.soldier.base.auth=14;s.soldier.courses=['practised_delivery','long_period'];
  s.soldier.decorations=['phalerae','torques','armillae'];
  assert.ok(G.startEncounter(s).ok);const e=s.encounter,hero=e.units.find(u=>u.id==='hero'),ally=e.units.find(u=>u.id==='speaker-ally');
  assert.deepEqual(e.profile,{resolve:5+1+5,denounce:1,rebut:1,record:1,addressRecovery:2});assert.equal(hero.maxResolve,12+11);assert.equal(ally.maxResolve,10);
  assert.doesNotThrow(()=>G.deserialize(G.serialize(s)),'the profile is kept and checked in saves');
});

test('F31: a walk stays in reach (a second walk takes the first back), and the hour ends when every speaker standing has spoken, or on yield',()=>{
  const s=G.deserialize(neutralCampaignStarts().get('ch10-tribunal')),e=s.encounter,hero=e.units.find(u=>u.id==='hero'),start=G.serialize(s);
  const all=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)all.push({x,y});
  const outside=all.find(p=>!C.inReach(s,'hero',p)&&!e.units.some(u=>u.x===p.x&&u.y===p.y));
  const refused=C.walk(s,'hero',outside);assert.equal(refused.ok,false);assert.equal(refused.reason,'OUTSIDE_REACH');assert.equal(G.serialize(s),start,'refused, nothing changes');
  const places=C.reach(s,'hero').filter(p=>p.cost>0),[a,b]=[places[0],places.find(p=>p.cost===3)??places.at(-1)];
  assert.ok(C.walk(s,'hero',a).ok);assert.ok(C.walk(s,'hero',b).ok,'a second walk in the same hour');assert.deepEqual([hero.x,hero.y],[b.x,b.y]);
  assert.ok(C.walk(s,'hero',{x:1,y:3}).ok);assert.equal(hero.moved,false,'walking back to where he began takes the move back');
  // The hour: the soldier speaks, the ally speaks, and the rivals take theirs.
  const conv=C.conversation(s,'hero',e.units.find(u=>u.role==='voter').id),plan=conv.speeches.find(x=>x.ok||x.walk);
  if(plan.walk)assert.ok(C.walk(s,'hero',plan.walk).ok);
  const first=C.speak(s,plan.command);assert.ok(first.ok);assert.equal(first.hourEnded,false);assert.equal(e.turn,1);
  const ally=e.units.find(u=>u.id==='speaker-ally'),rebut=C.speak(s,{unitId:ally.id,action:'rebut',x:ally.x,y:ally.y,targetId:ally.id});
  assert.ok(rebut.ok);assert.equal(rebut.hourEnded,true);assert.equal(s.encounter.turn,2);assert.ok(rebut.events.length>0,'the rivals’ hour is reported');
  // Yield: the soldier speaks, the floor is yielded, and the ally's speech is lost.
  const turn=s.encounter.turn,h2=C.conversation(s,'hero',s.encounter.units.find(u=>u.role==='voter'&&C.walkBeside(s,'hero','persuade',u)).id).speeches.find(x=>x.action==='persuade');
  if(h2.walk)assert.ok(C.walk(s,'hero',h2.walk).ok);assert.ok(C.speak(s,h2.command).ok);
  assert.ok(C.yieldFloor(s).ok);assert.equal(s.encounter.turn,turn+1);assert.equal(s.encounter.units.find(u=>u.id==='speaker-ally').acted,false,'a new hour');
  // A withdrawn ally does not hold the hour open.
  const w=G.deserialize(start);const wa=w.encounter.units.find(u=>u.id==='speaker-ally');wa.resolve=0;wa.hp=0;
  const v=C.conversation(w,'hero',w.encounter.units.find(u=>u.role==='voter'&&C.walkBeside(w,'hero','persuade',u)).id).speeches.find(x=>x.action==='persuade');
  if(v.walk)assert.ok(C.walk(w,'hero',v.walk).ok);assert.equal(C.speak(w,v.command).hourEnded,true);
});

test('F31: Persuade gains 1 with an allied speaker within 4 m; Address moves every member within 6 m and comes back after 3 hours; a deadline tie rejects',()=>{
  const s=G.deserialize(neutralCampaignStarts().get('ch10-tribunal')),e=s.encounter,hero=e.units.find(u=>u.id==='hero'),ally=e.units.find(u=>u.id==='speaker-ally');
  // Persuade from beside a member, with the ally within 2 tiles (4 m) and then farther.
  const member=e.units.find(u=>u.role==='voter'&&C.walkBeside(s,'hero','persuade',u));const spot=C.walkBeside(s,'hero','persuade',member);
  const strength=(allyAt)=>{const c=G.deserialize(G.serialize(s)),h=c.encounter.units.find(u=>u.id==='hero'),a=c.encounter.units.find(u=>u.id==='speaker-ally');h.x=spot.x;h.y=spot.y;a.x=allyAt.x;a.y=allyAt.y;
    return argumentForecast(c,h,'persuade',c.encounter.units.find(u=>u.id===member.id)).stanceChanges[0].baseDelta;};
  const free=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!e.units.some(u=>u.x===x&&u.y===y&&u.id!=='speaker-ally'))free.push({x,y});
  const near=free.find(p=>Math.abs(p.x-spot.x)+Math.abs(p.y-spot.y)===2&&!(p.x===spot.x&&p.y===spot.y)),far=free.find(p=>Math.abs(p.x-spot.x)+Math.abs(p.y-spot.y)>=4);
  assert.equal(strength(near),strength(far)+1,'an allied speaker within 4 m adds one');
  // Address: exactly the members within 3 tiles (6 m), then not again until 3 hours later.
  const f=G.preview(s,{unitId:'hero',action:'address',x:hero.x,y:hero.y,targetId:'hero'});assert.ok(f.ok);
  const within=e.units.filter(u=>u.role==='voter'&&Math.abs(u.x-hero.x)+Math.abs(u.y-hero.y)<=3).map(u=>u.id).sort();
  assert.deepEqual(f.forecast.stanceChanges.map(c=>c.id).sort(),within.filter(id=>f.forecast.stanceChanges.some(c=>c.id===id)).sort());
  assert.ok(f.forecast.stanceChanges.every(c=>within.includes(c.id)));
  assert.ok(C.speak(s,{unitId:'hero',action:'address',x:hero.x,y:hero.y,targetId:'hero'}).ok);assert.ok(C.yieldFloor(s).ok);
  const can=()=>G.getActions(s,'hero').includes('address');assert.equal(can(),false,'hour 2');assert.ok(C.yieldFloor(s).ok);assert.equal(can(),false,'hour 3');
  assert.ok(C.yieldFloor(s).ok);assert.equal(can(),true,'hour 4: three hours after');assert.equal(CONTEST_RULES.addressCooldown,3);
  // A tie at the deadline (an even electorate; injected, as 0.38's own test does) rejects the motion.
  const t=G.deserialize(neutralCampaignStarts().get('ch10-tribunal')),te=t.encounter;
  te.units=te.units.filter(u=>u.id!=='member8');te.electorate=12;te.majority=7;let n=0;for(const u of te.units.filter(u=>u.role==='voter'))u.stance=n++<4?3:-3;
  te.turn=te.turnLimit;te.usedAbilities.push(...(te.requiredAbilities??[]),te.requiredAbility);assert.equal(G.voteCount(t).for,6);
  assert.ok(C.yieldFloor(t).ok);assert.equal(te.status,'lost','six for, six against: the motion fails');
});

test('F32: inspecting a documented case is free and changes nothing; presenting it spends the soldier’s speech, once per hearing',()=>{
  const s=G.deserialize(neutralCampaignStarts().get('ch7-council')),before=G.serialize(s),cases=G.caseOptions(s).filter(c=>c.earned);
  assert.ok(cases.length>0,'the campaign has earned a case for the council');
  for(const c of G.caseOptions(s))G.previewCase(s,c.id);assert.equal(G.serialize(s),before,'inspection changes nothing');
  const r=C.speak(s,{kind:'case',id:cases[0].id});assert.ok(r.ok);assert.equal(s.encounter.units.find(u=>u.id==='hero').acted,true,'the soldier has spoken');
  assert.equal(G.previewCase(s,cases.at(-1).id).ok,false);assert.ok(C.yieldFloor(s).ok);
  assert.equal(C.speak(s,{kind:'case',id:cases.at(-1).id}).ok,false,'one case a hearing');
});

// The chamber on the page (§3.11): what the bar, T and the Command list offer, and the world that walks it.
import {CHAMBER_READY_CHAPTERS,chamberFor} from '../src/core/controls-model.js';
import {createChamberWorld,discessio,placeChamberWorld,pointTile,syncChamberWorld,tilePoint} from '../src/core/realtime/chamber-world.js';
import {step} from '../src/core/realtime/simulation.js';

test('the chamber’s bar, T and Command list: the speeches each chapter has taught, members and rivals nearest first, and every option a rule the page applies',()=>{
  const taught={'ch7-council':['persuade'],'ch8-parley':['persuade','promise','threaten'],'ch10-tribunal':['persuade','promise','threaten','address','rebut'],
    'ch11-accounts':C.SPEECHES,'ch11-adlection':C.SPEECHES};
  for(const [id,want]of Object.entries(taught)){
    const s=G.deserialize(neutralCampaignStarts().get(id)),e=s.encounter,hero=e.units.find(u=>u.id==='hero');
    assert.deepEqual(C.knownSpeeches(s,'hero'),[...want],`${id}: the bar`);
    const t=C.chamberTargets(s,'hero'),d=x=>Math.abs(x.x-hero.x)+Math.abs(x.y-hero.y),of=i=>e.units.find(u=>u.id===i);
    assert.equal(t.length,e.units.filter(u=>u.role==='voter'||u.side==='enemy'&&u.role==='speaker').length);assert.ok(t.every((x,i)=>!i||d(of(t[i-1]))<=d(of(x))),`${id}: nearest first`);
    assert.deepEqual(C.chamberTargets(s,'hero',{friends:true}),['speaker-ally']);
    const before=G.serialize(s),options=C.chamberOptions(s,'hero');assert.equal(G.serialize(s),before,'listing changes nothing');
    assert.ok(options.some(o=>o.group==='The hour'&&o.command?.kind==='yield'));
    for(const o of options.filter(o=>o.command?.kind==='speak')){const c=G.deserialize(before);assert.ok(C.speak(c,o.command.command).ok,`${id}: ${o.label}`);}
    for(const o of options.filter(o=>o.command?.kind==='walk')){const c=G.deserialize(before);assert.ok(C.walk(c,o.command.unitId,o.command.tile).ok,`${id}: ${o.label}`);}
    // Spent, the speeches say so; withdrawn, the speaker has only the hour to yield.
    const spoken=G.deserialize(before);spoken.encounter.units.find(u=>u.id==='hero').acted=true;
    assert.ok(C.chamberOptions(spoken,'hero').filter(o=>o.group==='Speeches').every(o=>o.reason==='SPENT'));
    const out=G.deserialize(before),h=out.encounter.units.find(u=>u.id==='hero');h.resolve=0;h.hp=0;
    assert.deepEqual(C.chamberOptions(out,'hero').filter(o=>o.command).map(o=>o.command.kind),['yield']);
  }
  assert.match(C.interestNote('grain','Landholders'),/^Moved most by Promise; least by/);assert.equal(C.interestNote('grain','Veterans',['persuade']),'','one speech known: nothing to compare');
});

test('the chamber world: everyone where the Contest puts him; a walk, the rivals’ hour and the division walk there, and a skip places them at once',()=>{
  const s=G.deserialize(neutralCampaignStarts().get('ch10-tribunal')),e=s.encounter,world=createChamberWorld(s);
  assert.equal(world.kind,'chamber');assert.equal(world.actors.length,e.units.length);
  for(const u of e.units){const a=world.actors.find(x=>x.id===u.id);assert.deepEqual(pointTile(a),{x:u.x,y:u.y});assert.equal(a.civic.role,u.role);assert.equal(a.civic.stance,u.stance??null);}
  const settle=()=>{for(let i=0;i<400&&world.actors.some(a=>a.path?.length);i++)step(world);};
  // The soldier walks to a place in his reach: his figure walks there.
  const place=C.reach(s,'hero').find(p=>p.cost===2);assert.ok(C.walk(s,'hero',place).ok);
  assert.deepEqual(syncChamberWorld(world,s),['hero']);settle();assert.deepEqual(pointTile(world.actors.find(a=>a.id==='hero')),{x:place.x,y:place.y});
  // The rivals' hour: whoever the rules moved walks there.
  const moved=new Set(C.rivalWalks(s).filter(r=>r.from.x!==r.to.x||r.from.y!==r.to.y).map(r=>r.id));assert.ok(C.yieldFloor(s).ok);
  assert.deepEqual(new Set(syncChamberWorld(world,s)),moved);settle();
  for(const u of e.units){const a=world.actors.find(x=>x.id===u.id);assert.deepEqual(pointTile(a),{x:u.x,y:u.y},u.id);}
  // A skip puts everyone in place at once; the vote's division walks the members behind the speakers they back.
  const at=tilePoint(e.units.find(u=>u.role==='voter'));placeChamberWorld(world,s);assert.equal(world.actors.find(a=>a.civic.role==='voter').x,at.x);
  while(s.encounter.status==='active')assert.ok(C.yieldFloor(s).ok);syncChamberWorld(world,s);settle();discessio(world,s);
  const hero=tilePoint(e.units.find(u=>u.id==='hero')),rival=tilePoint(e.units.find(u=>u.side==='enemy'&&u.role==='speaker'));
  for(const u of e.units.filter(u=>u.role==='voter')){const goal=world.actors.find(a=>a.id===u.id).goal,lead=u.stance>=1?hero:rival;assert.ok(Math.hypot(goal.x-lead.x,goal.z-lead.z)<4.5,`${u.id} stands behind his side`);}
});

test('the chamber is offered where it exists, and a chapter taken out of real time keeps the 0.38 Contest board',()=>{
  assert.deepEqual([...CHAMBER_READY_CHAPTERS],[7,8,10,11,12]);
  for(const c of [7,8,10,11,12])assert.equal(chamberFor({controlsModel:'realtime'},c),true);
  for(const c of [1,9])assert.equal(chamberFor({controlsModel:'realtime'},c),false);
  assert.equal(chamberFor({controlsModel:'turns'},7),false);assert.equal(chamberFor({controlsModel:'realtime',realtimeChapters:[8]},7),false,'kill criterion K3');
});

// Phase 3's hearings, motions and the Rhetor (guide "Policy debates", "Hearings and evidence", "Trainers").
import {MAGISTRATE} from '../src/core/realtime/chamber-world.js';
import {soldierCampCard} from '../src/ui/soldier-views.js';

test('a hearing’s documents: the earned cases with every member’s exact change; inspecting is free, presenting spends the soldier’s speech once, and the magistrate is only presentation',()=>{
  for(const id of ['ch7-council','ch8-parley','ch10-tribunal','ch11-accounts','ch11-adlection']){
    const s=G.deserialize(neutralCampaignStarts().get(id)),before=G.serialize(s),docs=C.hearingDocuments(s);
    assert.equal(C.isHearing(s),true,`${id} is a hearing`);assert.ok(docs.length>0,`${id}: the campaign has earned a document`);assert.equal(G.serialize(s),before,'reading them changes nothing');
    for(const d of docs){
      const copy=G.deserialize(before),r=C.speak(copy,{kind:'case',id:d.id});assert.ok(r.ok,`${id}: ${d.id}`);
      for(const c of d.changes)assert.equal(copy.encounter.units.find(u=>u.id===c.id).stance,c.to,`${id}: ${c.name} as the document said`);
      assert.equal(copy.encounter.units.find(u=>u.id==='hero').acted,true);assert.equal(C.hearingDocuments(copy).every(x=>!x.ok),true,'once a hearing');
    }
    const world=createChamberWorld(s,{magistrate:true}),m=world.actors.find(a=>a.id===MAGISTRATE);
    assert.ok(m&&m.civic.role==='magistrate');assert.equal(s.encounter.units.some(u=>u.id===MAGISTRATE),false,'he is no part of the Contest');
    assert.deepEqual(syncChamberWorld(world,s),[],'the rules never move him');
  }
});

test('the policy debate through the chamber (8 supplies injected; the campaign bot spends its own): one motion tabled with the soldier’s speech, the rival’s amendment answered in a later hour, as 0.38 rules it',()=>{
  const s=G.deserialize(neutralCampaignStarts().get('ch10-tribunal'));s.supplies=8;
  const v=C.motionView(s);assert.ok(v.policy.options.some(m=>m.preview.ok),'a motion can be tabled');
  const motion=v.policy.options.find(m=>m.preview.ok),listed=C.chamberOptions(s,'hero').find(o=>o.group==='The motion'&&o.command?.command.id===motion.id);
  assert.ok(listed,'the Command list offers it');assert.equal(C.chamberOptions(s,'speaker-ally').some(o=>o.group==='The motion'),false,'only the soldier tables it');
  assert.ok(C.speak(s,listed.command.command).ok);assert.equal(C.motionView(s).policy.tabled.id,motion.id);assert.equal(s.encounter.units.find(u=>u.id==='hero').acted,true);
  // Hours pass until the rival offers his amendment; the soldier answers it with a speech.
  for(let i=0;i<4&&!C.motionView(s).policy.tabled.awaiting&&s.encounter.status==='active';i++)assert.ok(C.yieldFloor(s).ok);
  const t=C.motionView(s).policy.tabled;
  if(t.awaiting){assert.ok(t.amended.ok,t.amended.message);assert.ok(C.speak(s,{kind:'policy',id:t.id,terms:'amended'}).ok);
    assert.equal(s.encounter.policy.terms,'amended');assert.equal(C.motionView(s).policy.tabled.awaiting,false,'answered');}
  else assert.equal(s.encounter.policy.terms,'original','left unanswered, the original terms stand');
});

test('the Rhetor teaches from Chapter VII: the camp card names him, and Practised delivery adds 5 Resolve to the soldier in the next Contest',()=>{
  let camp=null;const stop=new Error('saved');
  try{runCommandCampaign({featureEdition:35,onCheckpoint(s){if(G.getChapter(s).encounters[s.encounterIndex]?.id==='ch7-council'){camp=G.serialize(s);throw stop;}}});}catch(error){if(error!==stop)throw error;}
  const s=G.deserialize(camp);assert.match(soldierCampCard(s),/Rhetor Theon/,'the camp card lists the Rhetor in Chapter VII');
  const early=G.deserialize(camp);early.chapter=6;assert.doesNotMatch(soldierCampCard(early),/Rhetor Theon/,'not before');
  const plain=G.deserialize(camp);assert.ok(G.startEncounter(plain).ok);
  // Injected: the training points and coin the course costs (the campaign's own may be spent).
  s.soldier.tp=Math.max(s.soldier.tp,5);s.soldier.denarii=Math.max(s.soldier.denarii,40);
  assert.ok(G.soldierCommand(s,{kind:'course',courseId:'practised_delivery'}).ok);assert.ok(G.startEncounter(s).ok);
  const hero=x=>x.encounter.units.find(u=>u.id==='hero');assert.equal(hero(s).maxResolve,hero(plain).maxResolve+5);
});
