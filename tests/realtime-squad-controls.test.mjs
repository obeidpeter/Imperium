import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,queueCommand,commandProblem,step,worldHash} from '../src/core/realtime/simulation.js';
import {cardButtons,cardOrder,commandPips,commandSquads,formationPreview,friendlyStandard,liveSelection,markerOrder,orderIntent,selectSquads,squadOrderOptions,squadState}
  from '../src/core/realtime/order-intents.js';
import {commandOptions} from '../src/core/realtime/intents.js';
import {squadById} from '../src/core/realtime/squads.js';
import {squadLeader,stageEncounter} from '../src/showcase/live-figures.js';
import {formationEligible} from '../src/showcase/formation.js';
import {ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {ARCHETYPES} from '../src/data/realtime-forces.js';
import {ARENA,REASONS} from '../src/data/realtime-rules.js';

// The squad controls (build brief §3.8 "Selection model", guide "Squads"):
// test 41c — selection, the right button's orders, the command card, the order
// marker — and the Command list's squads (H39), on a small open field.

const grass=(w=40,h=24)=>({id:'open',width:w,height:h,terrain:Array.from({length:h},()=>Array(w).fill('grass'))});
const hero=(over={})=>({id:'hero',name:'Hero',side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2},at:[6,30],face:[1,0],...over});
const roman=(id,at,over={})=>({id,name:`${id} squad`,side:'ally',role:'infantry',strength:16,maxStrength:16,damage:3,at,face:[1,0],member:{name:'Legionary',...ROMAN_SQUADS.infantry},
  standing:[['hold_line',null]],...over});
const goth=ARCHETYPES.gothic.infantry[0];
const gothic=(id,at,over={})=>({id,name:`${id} band`,side:'enemy',role:'infantry',strength:10,maxStrength:10,damage:4,at,face:[-1,0],anchor:at,
  member:{name:'Gothic warrior',attributes:goth.attributes,kit:goth.kit},...over});
const field=({command=3,squads}={})=>createWorld({map:grass(),seed:4,actors:[hero()],command,chapter:5,
  squads:squads??[roman('first',[14,30]),roman('second',[14,40]),roman('third',[14,52]),gothic('goths',[70,34])],
  objects:[{id:'well',name:'The well',kind:'well',x:30,z:20,work_s:3}]});

test('41c: a standard selects that squad, Shift and a tap add, Shift+1–6 toggles, Esc clears; fallen squads drop out; deployment chooses one',()=>{
  const w=field();
  assert.deepEqual(commandSquads(w).map(s=>s.id),['first','second','third'],'the squad bar: ours, in order');
  let sel=selectSquads(w,[],{squadId:'first'});assert.deepEqual(sel,['first']);
  sel=selectSquads(w,sel,{squadId:'second'});assert.deepEqual(sel,['second'],'a plain click selects that squad only');
  sel=selectSquads(w,sel,{squadId:'first',shift:true});assert.deepEqual(sel,['second','first'],'Shift+click adds');
  sel=selectSquads(w,sel,{squadId:'third',touch:true});assert.deepEqual(sel,['second','first','third'],'a tap adds');
  sel=selectSquads(w,sel,{index:1});assert.deepEqual(sel,['first','third'],'Shift+2 removes the second squad');
  sel=selectSquads(w,sel,{index:1});assert.deepEqual(sel,['first','third','second'],'and adds it again');
  assert.deepEqual(selectSquads(w,sel,{squadId:'goths',shift:true}),sel,'an enemy band is never selected');
  assert.deepEqual(selectSquads(w,sel,{clear:true}),[]);
  assert.deepEqual(selectSquads(w,sel,{squadId:'third'},{deployment:true}),['third'],'deployment places one thing at a time');
  // A click on one of our men selects his squad; on an enemy, nothing.
  assert.equal(friendlyStandard(w,{actorId:'second-3'}),'second');assert.equal(friendlyStandard(w,{actorId:'goths-1'}),null);
  for(const id of squadById(w,'third').members)w.actors.find(a=>a.id===id).alive=false;
  assert.deepEqual(liveSelection(w,['first','third']),['first'],'a squad cut down leaves the selection');
});

test('41c: the right button orders the selection — ground advances, an enemy is attacked as his band, the soldier means withdraw and brace, an object is held',()=>{
  const w=field(),sel=['first'];
  const ground=orderIntent(w,sel,{x:30,z:26});assert.equal(ground.command.payload.order.kind,'advance');assert.equal(ground.cursor,'order_advance');
  assert.match(ground.message,/first squad: advance here \(1 Command\)/);
  const enemy=orderIntent(w,sel,{actorId:'goths-2',x:70,z:34});assert.deepEqual(enemy.command.payload.order,{kind:'attack',targetId:'goths'},'a man of a band: the band');
  assert.equal(enemy.cursor,'order_attack');
  assert.equal(orderIntent(w,sel,{actorId:'hero'}).command.payload.order.kind,'withdraw');
  const well=orderIntent(w,sel,{objectId:'well'});assert.deepEqual(well.command.payload.order,{kind:'advance',x:30,z:20,objectId:'well'});assert.match(well.message,/to The well and hold/);
  assert.equal(orderIntent(w,[],{x:30,z:26}),null,'nothing selected: no order');
  // Each is a legal command, queued through the rules' own checks.
  for(const it of [ground,enemy,well])assert.equal(commandProblem(w,it.command),null);
  // Out of Command: the order says why, and refusing it changes nothing.
  const poor=field({command:1}),before=worldHash(poor);
  assert.equal(queueCommand(poor,orderIntent(poor,['first'],{x:30,z:26}).command).ok,true);
  const refused=orderIntent(poor,['second'],{x:30,z:26});assert.equal(refused.command,null);assert.equal(refused.reason,'NO_COMMAND');assert.equal(refused.cursor,'blocked');
  assert.match(refused.message,new RegExp(REASONS.NO_COMMAND.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  const after=worldHash(poor);assert.notEqual(after,before,'the first order set its Command aside');
  assert.equal(queueCommand(poor,{actorId:'hero',kind:'order',payload:{squads:['second'],order:{kind:'hold'}}}).ok,false);assert.equal(worldHash(poor),after,'a refused order leaves the world as it was');
});

test('41c: the command card gives 1–6 and nothing for 7–0; a formation names who joins and who is left out; the pips show Command set aside',()=>{
  const w=field({command:4});
  const names=cardButtons(w,['first']).map(b=>[b.key,b.kind]);
  assert.deepEqual(names,[[1,'hold'],[2,'restore'],[3,'withdraw'],[4,'line'],[5,'shield-wall'],[6,'wedge']]);
  for(const [i,kind]of ['hold','restore','withdraw','line','shield-wall','wedge'].entries())assert.equal(cardOrder(w,['first'],i).command.payload.order.kind,kind);
  for(const i of [6,7,8,9])assert.equal(cardOrder(w,['first'],i).command,null,`key ${i+1} gives nothing while the card shows`);
  assert.equal(cardOrder(w,[],0).reason,'NO_SQUAD_SELECTED');
  // first and second stand 10 m apart, third 12 m beyond second: all three join; a squad far away is left out.
  assert.deepEqual(formationPreview(w,['first','second','third']).joins,['first squad','second squad','third squad']);
  const far=field({squads:[roman('first',[14,30]),roman('second',[14,40]),roman('lone',[14,80]),gothic('goths',[70,34])]});
  const preview=formationPreview(far,['first','second','lone']);assert.deepEqual(preview.joins,['first squad','second squad']);assert.deepEqual(preview.left,['lone squad']);
  const line=cardButtons(far,['first','second','lone']).find(b=>b.kind==='line');assert.equal(line.ok,false,'a formation with a squad out of reach is refused');
  assert.match(line.note,/lone squad left out/);assert.equal(line.reason,'SQUADS_TOO_FAR_APART');
  // The pips: capacity, what is left, what is on its way.
  assert.equal(queueCommand(w,cardOrder(w,['first','second','third'],4).command).ok,true,'one Command for three squads in shield wall');
  step(w);const pips=commandPips(w);assert.equal(pips.capacity,4);assert.equal(pips.left,3);assert.equal(pips.reserved,1);assert.match(pips.text,/Command 3 of 4, 1 on its way/);
  assert.match(squadState(w,squadById(w,'first')),/first squad: 8 of 8 men, morale 80 \(steady\), cohesion 80; shield wall on its way\./);
});

test('41c: the order marker — Enter advances to it, or attacks the enemy chosen with T',()=>{
  const w=field();
  assert.equal(markerOrder(w,['first'],{marker:null}).command,null,'no marker yet');
  assert.deepEqual(markerOrder(w,['first'],{marker:{x:24,z:28}}).command.payload.order,{kind:'advance',x:24,z:28});
  assert.deepEqual(markerOrder(w,['first'],{marker:{x:24,z:28},targetId:'goths-1'}).command.payload.order,{kind:'attack',targetId:'goths'});
  assert.equal(markerOrder(w,[],{marker:{x:24,z:28}}),null);
});

test('H39 with squads: each squad is a "who acts" with every order the card and the pointer give it, each legal or saying why',()=>{
  const w=field({command:3});
  for(const s of commandSquads(w)){
    const options=squadOrderOptions(w,{squadId:s.id});
    for(const o of options){
      if(o.command){assert.equal(commandProblem(w,o.command),null,`${s.id}: ${o.label}`);assert.equal(o.command.actorId,'hero','the soldier gives every order');}
      else assert.ok(o.reason&&o.message,`${s.id}: ${o.label} says why not`);
    }
    const has=order=>options.some(o=>o.command&&o.command.payload.squads.includes(s.id)&&Object.entries(order).every(([k,v])=>o.command.payload.order[k]===v));
    for(const kind of ['hold','restore','withdraw','line','shield-wall','wedge'])assert.ok(has({kind}),`${s.id}: ${kind}`);
    assert.ok(has({kind:'attack',targetId:'goths'}),`${s.id}: attack the band`);
    assert.ok(has({kind:'advance',objectId:'well'}),`${s.id}: advance to the well`);
    // Everything the pointer gives a squad (but a walk to a chosen spot of ground) is in its list.
    for(const pick of [{actorId:'goths-3'},{actorId:'hero'},{objectId:'well'}]){
      const it=orderIntent(w,[s.id],pick);assert.ok(has(it.command.payload.order),`${s.id}: the list gives ${JSON.stringify(it.command.payload.order)}`);
    }
  }
  // A formation with the squads near it, for one point.
  const together=squadOrderOptions(w,{squadId:'first'}).find(o=>/^Line with/.test(o.label));
  assert.deepEqual(together.command.payload.squads,['first','second','third']);assert.match(together.detail,/^1 Command\./);
  // With no Command left, the orders say why; only one that replaces the first squad's order (and so gets its point back) can be given.
  const poor=field({command:1});queueCommand(poor,cardOrder(poor,['first'],0).command);
  assert.ok(squadOrderOptions(poor,{squadId:'second'}).every(o=>o.command?o.command.payload.squads.includes('first'):o.reason==='NO_COMMAND'));
  assert.ok(squadOrderOptions(poor,{squadId:'second'}).some(o=>o.reason==='NO_COMMAND'));
});

test('H39 with squads: the soldier\'s own list offers each enemy band once, and leaves our squads\' men to their squads',()=>{
  const w=field(),options=commandOptions(w);
  const attacks=options.filter(o=>o.group==='Enemies'&&o.command?.kind==='attack');
  assert.equal(attacks.length,1,'one Gothic band, offered once');assert.match(attacks[0].label,/Gothic warrior \(goths band\)/);
  assert.ok(!options.some(o=>o.subject&&w.actors.find(a=>a.id===o.subject)?.squadId&&w.actors.find(a=>a.id===o.subject).side!=='enemy'),'no legionary one by one');
});

test('a squad is drawn as one figure, its foremost man, with the rest of its men as that figure\'s crowd',()=>{
  const w=field(),base={id:'test',width:16,height:10,terrain:grass(16,10).terrain,units:[]},stage=stageEncounter(base,w);
  const first=stage.units.find(u=>u.id==='first'),soldier=stage.units.find(u=>u.id==='hero');
  assert.equal(stage.units.filter(u=>u.squad).length,4,'four squads, four figures');assert.ok(!stage.units.some(u=>w.actors.find(a=>a.id===u.id)?.squadId),'no man of a squad stands alone');
  assert.equal(first.crowd,7);assert.equal(first.maxHp,16);assert.equal(first.hp,16);assert.equal(soldier.crowd,false);
  assert.equal(formationEligible(first,{chapter:5}),true);assert.equal(formationEligible(soldier,{chapter:5}),false,'the soldier has no crowd');
  const q=squadById(w,'first');assert.equal(squadLeader(w,q).id,'first-1');
  w.actors.find(a=>a.id==='first-1').alive=false;w.actors.find(a=>a.id==='first-1').diedAt=3;assert.equal(squadLeader(w,q).id,'first-2','the next man takes the standard');
  for(const [i,id]of q.members.entries()){const m=w.actors.find(a=>a.id===id);if(m.alive){m.alive=false;m.diedAt=i<4?5:9;}}
  assert.equal(squadLeader(w,q).id,'first-5','cut down: the figure shows the last to fall');
  // Hidden men of an ambush are not drawn until they are revealed.
  const ambush=field({squads:[roman('first',[14,30]),gothic('hidden',[60,34])]});for(const a of ambush.actors)if(a.squadId==='hidden')a.hidden=true;
  assert.ok(!stageEncounter(base,ambush).units.some(u=>u.id==='hidden'));
});
