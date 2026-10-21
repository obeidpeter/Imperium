import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,queueCommand,step,snapshotWorld,restoreWorld,worldHash} from '../src/core/realtime/simulation.js';
import {formationGroup,orderDelayTicks,reservedCommand} from '../src/core/realtime/command.js';
import {memberFell,membersOf,squadModifiers,squadById} from '../src/core/realtime/squads.js';
import {combatBreakdown} from '../src/core/battle.js';
import {makeUnit} from '../src/core/shared.js';
import {ROMAN_SQUADS,COHESION,MORALE} from '../src/data/realtime-squads.js';
import {ARCHETYPES} from '../src/data/realtime-forces.js';
import {ARENA,TIME} from '../src/data/realtime-rules.js';

// Squads, Command and morale (build brief §3.4, §3.8, §3.9): tests E25–E27,
// and a port test of the squad exchange against 0.38's own combat formula.

const R=TIME.roundTicks;
const grass=(w=40,h=24)=>({id:'open',width:w,height:h,terrain:Array.from({length:h},()=>Array(w).fill('grass'))});
const hero=(over={})=>({id:'hero',name:'Hero',side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2},at:[6,30],face:[1,0],...over});
const roman=(id,at,over={})=>({id,name:`${id} squad`,side:'ally',role:'infantry',strength:16,maxStrength:16,damage:3,at,face:[1,0],member:{name:'Legionary',...ROMAN_SQUADS.infantry},
  standing:[['hold_line',null]],...over});
const goth=ARCHETYPES.gothic.infantry[0];
const gothic=(id,at,over={})=>({id,name:`${id} band`,side:'enemy',role:'infantry',strength:10,maxStrength:10,damage:4,at,face:[-1,0],anchor:at,
  member:{name:'Gothic warrior',attributes:goth.attributes,kit:goth.kit},...over});
const world=(squads,{command=3,chapter=5,actors=[hero()],seed=9,map=grass()}={})=>createWorld({map,seed,actors,squads,command,chapter});
const order=(w,squads,o)=>queueCommand(w,{actorId:'hero',kind:'order',payload:{squads,order:o}});
const run=(w,n)=>{for(let i=0;i<n;i++)step(w);};

test('E25: Command capacity, refill at each round boundary, one point a squad and one for a formation of up to three',()=>{
  const w=world([roman('a',[20,30]),roman('b',[20,36]),roman('c',[20,42]),gothic('far',[95,50])],{command:3});
  assert.deepEqual([w.command.capacity,w.command.left],[3,3]);
  assert.ok(order(w,['a','b'],{kind:'hold'}).ok);assert.equal(w.command.left,1,'Hold costs one for each squad, set aside at once');
  assert.equal(order(w,['c'],{kind:'advance',x:30,z:42}).ok,true);assert.equal(w.command.left,0);
  assert.equal(order(w,['c'],{kind:'restore'}).ok,true,'a new order to the same squad replaces the queued one and reuses its point');
  assert.equal(w.command.left,0);assert.equal(w.queue.filter(q=>q.kind==='order').length,2);
  const w2=world([roman('a',[20,30]),roman('b',[20,36]),roman('c',[20,42]),gothic('far',[95,50])],{command:1});
  assert.ok(order(w2,['a','b','c'],{kind:'line'}).ok,'a formation costs one for up to three squads');assert.equal(w2.command.left,0);
  assert.equal(order(w2,['a'],{kind:'hold'}).reason,'NO_COMMAND');
  // Refill to capacity at the boundary, never accumulating.
  run(w2,R);assert.equal(w2.command.left,1);run(w2,R);assert.equal(w2.command.left,1);
});

test('E25: the order delay is 1 s less 0.05 s per Authority above 10, at least 0.25 s, and none with Clear orders',()=>{
  const delay=(auth,effects=null)=>orderDelayTicks(world([roman('a',[20,30])],{actors:[hero({attributes:{auth},...(effects?{effects}:{})})]}));
  assert.equal(delay(10),20);assert.equal(delay(20),10);assert.equal(delay(30),5);assert.equal(delay(14),16);
  assert.equal(delay(25,{orderDelay:0}),0);
  // The squad starts the order only after the delay.
  const w=world([roman('a',[20,30]),gothic('far',[95,50])]);order(w,['a'],{kind:'advance',x:40,z:30});step(w);
  const s=squadById(w,'a');assert.equal(s.order,null,'not yet');assert.ok(s.pending);
  run(w,19);assert.equal(s.order?.kind,undefined);step(w);assert.equal(s.order?.kind,'advance','carried out once the delay has passed');
});

test('E25: Command is set aside on issue, charged on effect, and given back when replaced in the same round only',()=>{
  const w=world([roman('a',[20,30]),roman('b',[20,36]),gothic('far',[95,50])],{command:2});
  order(w,['a'],{kind:'advance',x:30,z:30});step(w);assert.equal(w.command.left,1);assert.equal(reservedCommand(w),1,'on its way');
  order(w,['a'],{kind:'hold'});step(w);assert.equal(w.command.left,1,'replacing the order on its way gives its point back');
  run(w,20);assert.equal(reservedCommand(w),0,'charged when it takes effect');assert.equal(w.command.left,1);
  // An order on its way across the boundary is charged to the old round, never to the refilled pool.
  run(w,R-1-(w.tick%R));order(w,['b'],{kind:'advance',x:30,z:36});assert.equal(w.command.left,0);
  step(w);step(w);assert.equal(w.command.left,2,'the pool refills in full');
  order(w,['b'],{kind:'hold'});step(w);assert.equal(w.command.left,1,'the replaced order came from the old round: nothing is given back');
});

test('E26: a formation joins up to three squads in a connected group, each within 15 m of another; who joins and who is left out',()=>{
  const w=world([roman('a',[20,20]),roman('b',[32,20]),roman('c',[44,20]),roman('d',[56,20]),roman('far',[20,52]),gothic('g',[95,50])],{command:6});
  assert.deepEqual(formationGroup(w,['a','b','c']),{joins:['a','b','c'],left:[]},'a chain of 12 m gaps');
  assert.deepEqual(formationGroup(w,['a','far']),{joins:['a'],left:['far']});
  assert.deepEqual(formationGroup(w,['a','b','c','d']).left,['d'],'three at most');
  assert.equal(order(w,['a','far'],{kind:'shield-wall'}).reason,'SQUADS_TOO_FAR_APART');assert.equal(w.command.left,6,'a refused order costs nothing');
  assert.ok(order(w,['a','b'],{kind:'shield-wall'}).ok);run(w,21);
  assert.equal(squadById(w,'a').formation,'shield-wall');assert.equal(squadById(w,'b').formation,'shield-wall');
  run(w,R*2);assert.equal(squadById(w,'a').formation,'shield-wall','the formation persists until changed');
});

test('E27: morale, cohesion and suppression follow the 0.38 hits, thresholds and round recovery',()=>{
  const w=world([roman('a',[20,30]),gothic('g',[60,30])]),a=squadById(w,'a'),g=squadById(w,'g');
  // A man lost to a single blow costs his squad the 0.38 hit: 8 morale (4 more from the flank, 5 less in line) and 10 cohesion (6 to a missile).
  const kill=(squad,{arc='front',missile=null}={})=>{const m=membersOf(w,squad)[0],before=[squad.morale,squad.cohesion,squad.strength,squad.suppression];
    m.alive=false;memberFell(w,m,w.actors[0],{arc,missile});return [before[0]-squad.morale,before[1]-squad.cohesion,before[2]-squad.strength,squad.suppression-before[3]];};
  const [moraleLoss,cohesionLoss,strengthLoss]=kill(g);
  assert.equal(moraleLoss,MORALE.hit);assert.equal(cohesionLoss,COHESION.melee);assert.ok(Math.abs(strengthLoss-g.perMan)<1e-9,'one man is one share of strength');
  assert.equal(kill(g,{arc:'flank'})[0],MORALE.hit+MORALE.flank,'from the flank');
  const [,missileCohesion,,suppressed]=kill(g,{missile:'arrow'});assert.equal(missileCohesion,COHESION.ranged);assert.equal(suppressed,1);
  g.formation='line';assert.equal(kill(g)[0],MORALE.hit-MORALE.line,'line softens the loss');g.formation=null;
  // Thresholds: shaken at 40 takes 1 off its blows; broken at 20 falls back.
  g.morale=40;assert.ok(squadModifiers(w,g,a).modifiers.some(m=>m.label==='Shaken morale'));
  g.morale=41;assert.ok(!squadModifiers(w,g,a).modifiers.some(m=>m.label==='Shaken morale'));
  g.cohesion=39;g.suppression=2;const labels=squadModifiers(w,g,a).modifiers.map(m=>m.label);
  assert.ok(labels.includes('Disrupted cohesion')&&labels.includes('Suppressed'));
  // Round recovery: held still all round restores 12 and lifts a point of suppression; a friend within 10 m restores 6.
  const w2=world([roman('a',[20,30]),roman('b',[20,38]),roman('lone',[60,8]),gothic('far',[95,50])]);run(w2,R-1);
  for(const id of ['a','b','lone'])Object.assign(squadById(w2,id),{cohesion:50,suppression:2});
  squadById(w2,'b').stillSince=w2.tick;// b moved this round
  step(w2);
  assert.equal(squadById(w2,'a').cohesion,50+COHESION.braced,'held all round');assert.equal(squadById(w2,'a').suppression,1);
  assert.equal(squadById(w2,'b').cohesion,50+COHESION.supported,'moved, but a friendly squad stands within 10 m');
  assert.equal(squadById(w2,'lone').cohesion,50+COHESION.braced);
  // Broken: falls back; out of contact it regroups 15 a round and stands again above 20.
  const w3=world([roman('a',[20,30]),gothic('far',[95,50])]),s=squadById(w3,'a');
  s.morale=19;s.broken=true;run(w3,R);assert.equal(s.broken,false,'regrouped');assert.equal(s.morale,19+MORALE.regroup);
});

test('E27: Restore morale gives 10 and lifts a point of suppression; holding a whole round braces the squad',()=>{
  const w=world([roman('a',[20,30]),gothic('far',[95,50])]),a=squadById(w,'a');Object.assign(a,{morale:50,suppression:2});
  order(w,['a'],{kind:'restore'});run(w,21);assert.equal(a.morale,60);assert.equal(a.suppression,1);
  order(w,['a'],{kind:'hold'});run(w,R*2);assert.equal(a.braced,true,'a whole round held');
  order(w,['a'],{kind:'advance',x:60,z:30});run(w,40);assert.equal(a.braced,false,'moving unbraces it');
});

// The port: for the same situation, the real-time exchange's per-round damage
// is the 0.38 combatBreakdown damage (version 2 with the expanded field rules).
test('the squad exchange is 0.38 combatBreakdown: frontal shield, flank, brace, wedge, shield wall, line screen, cohesion, suppression, morale, weather',()=>{
  const cases=[
    ['frontal',{}],['flank',{flank:true}],['braced target',{braced:true}],['wedge attacker',{attackerFormation:'wedge'}],['wedge target',{targetFormation:'wedge'}],
    ['cohesive shield wall',{targetFormation:'shield-wall',neighbour:'shield-wall'}],['line screen (ranged)',{ranged:true,targetFormation:'line',neighbour:'line'}],
    ['low cohesion',{cohesion:30}],['suppressed',{suppression:2}],['shaken',{morale:12}],['mist beyond range',{ranged:true,weather:'mist',far:true}]];
  for(const [label,c] of cases){
    // 0.38: attacker at (3,3) facing east; target at (4,3) facing west (front), or (4,2) facing west for a flank.
    const e={id:'ch5-test',kind:'battle',combatVersion:2,featureEdition:31,weather:c.weather??'clear',width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill('grass')),
      units:[],field:{objects:[]}};
    const attacker=makeUnit('a','A','ally',c.far?1:3,3,{damage:3,role:c.ranged?'archer':'infantry',facing:'east',formation:c.attackerFormation??null,
      cohesion:c.cohesion??80,suppression:c.suppression??0,morale:c.morale??80});
    const target=makeUnit('t','T','enemy',c.far?5:4,c.flank?2:3,{damage:4,facing:c.flank?'north':'west',braced:!!c.braced,formation:c.targetFormation??null,cohesion:80,suppression:0,morale:80});
    e.units.push(attacker,target);if(c.neighbour)e.units.push(makeUnit('n','N','enemy',target.x,target.y+1,{formation:c.neighbour,facing:target.facing}));
    const old=combatBreakdown(e,attacker,target,!!c.ranged).damage;
    // Real time: the same geometry in metres.
    const gap=c.far?24:2,tz=c.flank?-6:0;
    const w=world([roman('a',[20,30],{damage:3,role:c.ranged?'archer':'infantry',formation:c.attackerFormation??null,member:{name:'Legionary',...ROMAN_SQUADS[c.ranged?'archer':'infantry']}}),
      gothic('t',[20+gap,30+tz],{face:c.flank?[0,-1]:[-1,0],braced:!!c.braced,formation:c.targetFormation??null}),
      ...(c.neighbour?[gothic('n',[20+gap,37],{formation:c.neighbour})]:[])],{chapter:5});
    w.weather=c.weather??null;const a=squadById(w,'a'),t=squadById(w,'t');Object.assign(a,{cohesion:c.cohesion??80,suppression:c.suppression??0,morale:c.morale??80});
    // Put the target's men exactly where its front faces.
    const now=squadModifiers(w,a,t,{ranged:!!c.ranged}).damage;
    assert.equal(now,old,`${label}: 0.38 ${old}, real time ${now}`);
  }
});

test('a squad fight is deterministic and its snapshot restores it exactly',()=>{
  const make=()=>world([roman('a',[20,30]),roman('b',[20,40]),gothic('g',[50,32]),gothic('h',[50,42],{role:'archer',member:{name:'Gothic archer',...ARCHETYPES.gothic.archer[0]}})]);
  const w=make();order(w,['a','b'],{kind:'attack',targetId:'g'});run(w,R*2);const mid=snapshotWorld(w);run(w,R*2);const end=worldHash(w);
  const again=restoreWorld(mid);run(again,R*2);assert.equal(worldHash(again),end,'save and load mid-fight');
  const w2=make();order(w2,['a','b'],{kind:'attack',targetId:'g'});run(w2,R*4);assert.equal(worldHash(w2),end,'same seed and orders, same fight');
});

test('a squad fights a single man as one body: a tenth of the 0.38 exchange a second, his brace counted, and its men strike no blows of their own',()=>{
  // The soldier walks into a Gothic shield guard's ground; nothing else is near.
  const w=world([gothic('g',[22,30],{role:'guard'}),roman('far',[90,10])],{actors:[hero({at:[20,30],face:[1,0]})]});
  const band=squadById(w,'g'),soldier=w.actors.find(a=>a.id==='hero'),start=soldier.hp;
  const expected=squadModifiers(w,band,{id:'hero',side:'player',x:soldier.x,z:soldier.z,fx:1,fz:0,formation:null,braced:false,guard:null,members:['hero']}).damage*.1;
  run(w,R*3);
  const hits=w.log.filter(l=>/hits Hero/.test(l.text)).length,lost=start-soldier.hp;
  assert.ok(lost>0,'the band wounds him');
  // 30 exchanges of a tenth of a 0.38 hit each (the frontal shield counted): whole points only, never more than they add up to.
  assert.ok(lost<=Math.floor(expected*30+1e-9)&&lost>=Math.floor(expected*30)-1,`${lost} Health for ${expected.toFixed(2)} a second`);
  assert.ok(!w.actors.some(a=>a.squadId==='g'&&(a.order||a.lock)),'its men give no orders of their own');assert.ok(hits>0);
});

test('archers loose at the single man their plan names (a protected column) through the exchange, not man by man',()=>{
  const escort={id:'carts',name:'Carts',side:'ally',role:'escort',kit:[],at:[30,30],face:[-1,0],downs:false};
  const archers=gothic('bows',[60,30],{role:'archer',member:{name:'Gothic archer',...ARCHETYPES.gothic.archer[0]}});
  const w=world([archers,roman('far',[8,8])],{actors:[hero({at:[6,44]}),escort]});
  const band=squadById(w,'bows');band.plan={kind:'engage',targetId:'carts'};
  for(let i=0;i<R*2;i++){band.plan={kind:'engage',targetId:'carts'};step(w);}
  assert.equal(w.projectiles.filter(p=>p.ownerId?.startsWith('bows')).length,0,'no single arrows in the air');
  const carts=w.actors.find(a=>a.id==='carts');assert.ok(carts.hp<carts.maxHp,'the column is wounded by the volley exchange');
  assert.ok(w.log.some(l=>/hits Carts with an arrow/.test(l.text)),'the log names the volley that wounds it');
});
