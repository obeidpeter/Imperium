import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {createSoldier,attributeCost,raiseAttribute,takeCourse,courseOptions,courseEffects,soldierAttributes,wornIds,wear,takeOff,drop,pickUp,
  sortPack,packAdd,packFits,takeAll,give,companionWorn,companionAttributes,priceOf,buy,sell,collectPay,knownAbilities,commitSoldierRewards,
  adoptSoldier,soldierOf,validateSoldier,awardDecorations} from '../src/core/soldier.js';
import {ITEMS,PACK} from '../src/data/items.js';
import {TRAINING_PATHS,ABILITIES} from '../src/data/realtime-rules.js';
import {TP} from '../src/data/soldier.js';
import {derivedValues,protectionOf} from '../src/core/realtime/combat.js';

const camp=(path='legionary',extra={})=>({chapter:1,phase:'camp',decisions:{},company:[{id:'lucan',commendations:0}],chapterCapabilities:{},
  soldier:createSoldier({path}),...extra});
const fail=m=>{throw new Error(m);};

test('G33: an attribute point costs 4 TP below 20, 5 from 20, 6 from 30, on the base value; TP are spent only when affordable',()=>{
  assert.deepEqual([10,19,20,29,30,39,40,45].map(attributeCost),[4,4,5,5,6,6,7,7]);
  const s=camp();s.soldier.tp=9;s.soldier.tpEarned=9;
  assert.ok(raiseAttribute(s,'per').ok);assert.equal(s.soldier.base.per,8);assert.equal(s.soldier.tp,5);
  s.soldier.decorations.push('corona_civica');const elo=s.soldier.base.elo;assert.equal(soldierAttributes(s.soldier).elo,elo+2,'decorations add on top');
  assert.ok(raiseAttribute(s,'elo').ok);assert.equal(s.soldier.tp,1,'the cost is computed on the base value, not the decorated one');
  const before=JSON.stringify(s);assert.equal(raiseAttribute(s,'str').ok,false);assert.equal(JSON.stringify(s),before,'a refused raise changes nothing');
  assert.equal(raiseAttribute({...s,phase:'encounter'},'str').ok,false);
});

test('training paths start from 10/5 with their stated modifiers, and only courses unlock Shield bash',()=>{
  for(const path of Object.keys(TRAINING_PATHS)){
    const base=createSoldier({path}).base;for(const [k,v]of Object.entries(TRAINING_PATHS[path].mods))assert.equal(base[k],(k==='combat'||k==='field'?5:10)+v,path+k);
  }
  const s=camp();assert.deepEqual(knownAbilities(s),['strike','brace','throw_pilum']);
  s.chapter=3;assert.deepEqual(knownAbilities(s),['strike','brace','throw_pilum','bind_wounds','carry','scout']);
  s.soldier.tp=s.soldier.tpEarned=10;assert.ok(takeCourse(s,'shield_bash').ok);assert.ok(knownAbilities(s).includes('shield_bash'));
  assert.equal(takeCourse(s,'shield_bash').ok,false,'each course once');
  assert.equal(courseOptions(s,'signifer').every(c=>!c.available&&/Chapter 4/.test(c.reason)),true,'the Signifer teaches from Chapter IV');
});

test('D19b: at every training path’s starting stats, Rally (30), Scout (20) and Brace (15) fit the starting Stamina',()=>{
  for(const path of Object.keys(TRAINING_PATHS)){
    const s=createSoldier({path}),stamina=30+Math.floor(s.base.con/2);
    for(const cost of [30,ABILITIES.scout.cost.stamina,ABILITIES.brace.cost.stamina])assert.ok(stamina>=cost,`${path}: ${stamina} < ${cost}`);
  }
  assert.equal(ABILITIES.scout.cost.stamina,20);assert.equal(ABILITIES.brace.cost.stamina,15);
});

test('courses change the derived numbers: Long march, Work at the post and Hardening',()=>{
  const actor=extra=>({attributes:{str:15,agi:12,con:13,per:7,elo:7,auth:7,combat:15,field:5},kit:['tunic','subarmalis','hamata','galea','scutum','spatha'],...extra});
  const plain=derivedValues(actor()),trained=derivedValues(actor({effects:courseEffects(['long_march','work_at_post','hardening'])}));
  assert.equal(plain.restriction,19);assert.equal(trained.restriction,14);
  assert.equal(trained.attack,plain.attack+2,'+2 from the course (19 and 14 Restriction both cost 1)');
  assert.equal(trained.health,Math.floor(plain.health*1.1));
  const heavy=extra=>actor({kit:['tunic','subarmalis','squamata','galea','scutum','spatha','manica'],...extra});
  assert.equal(derivedValues(heavy()).restriction,23);assert.equal(derivedValues(heavy({effects:courseEffects(['long_march'])})).attack,derivedValues(heavy()).attack+1,
    '5 less Restriction from 23 lifts Attack by one');
});

test('G34: layering sums absorb and combines resist; swap-on-equip, Sort, the per-area ground strip and Take all',()=>{
  const p=protectionOf({kit:['tunic','subarmalis','hamata']});
  assert.equal(p.cut.absorb,0+1+3);assert.ok(Math.abs(p.cut.resist-(1-(.95*.9*.7)))<1e-12);
  const s=camp('legionary');s.chapter=2;
  const mail=packAdd(s.soldier,'hamata');assert.ok(wear(s,mail.uid).ok);assert.equal(s.soldier.worn['body:2'],'hamata');
  const scale=packAdd(s.soldier,'squamata');assert.ok(wear(s,scale.uid).ok,'Strength 15 wears scale');
  assert.equal(s.soldier.worn['body:2'],'squamata');assert.ok(s.soldier.pack.some(e=>e.id==='hamata'),'the old piece goes to the pack');
  // A full pack: the larger piece taken off goes to this area's ground strip.
  s.soldier.pack=[];const parma=packAdd(s.soldier,'parma');while(packAdd(s.soldier,'wax_tablet'));s.soldier.worn['shield:0']='scutum';
  assert.ok(wear(s,parma.uid).ok);assert.deepEqual(s.soldier.ground['camp:2'].map(g=>g.id),['scutum'],'pack full: to the ground strip');
  const strip=s.soldier.ground['camp:2'][0];s.soldier.pack=[];assert.ok(pickUp(s,strip.uid).ok);assert.equal(s.soldier.ground['camp:2'],undefined);
  // Sort: largest area first, first fit; everything placed without overlap.
  s.soldier.pack=[];for(const id of ['wax_tablet','scutum','spear','tunic','knife','hamata'])packAdd(s.soldier,id);
  for(const e of s.soldier.pack)e.x=e.y=0;const left=sortPack(s.soldier);assert.deepEqual(left,[]);
  assert.deepEqual(s.soldier.pack.map(e=>e.id).slice(0,3),['scutum','hamata','spear'],'largest area first: 8, 6, 4 cells');
  assert.doesNotThrow(()=>validateSoldier(s,fail));
  const {taken,left:rest}=takeAll(s.soldier,['gothic_torc','silver_brooch']);assert.deepEqual(taken,['gothic_torc','silver_brooch']);assert.deepEqual(rest,[]);
});

test('kit requirements dim pieces; wearing, dropping and giving keep the pack valid; drops stay in their area',()=>{
  const s=camp('librarius');const axe=packAdd(s.soldier,'axe');
  assert.match(wear(s,axe.uid).message,/Strength 12/);assert.equal(s.soldier.worn['weapon:0'],'spatha');
  const cap=packAdd(s.soldier,'arming_cap');assert.ok(drop(s,cap.uid).ok);assert.deepEqual(s.soldier.ground['camp:1'].map(g=>g.id),['arming_cap']);
  assert.ok(takeOff(s,'shield:0').ok);assert.equal(s.soldier.worn['shield:0'],undefined);assert.ok(s.soldier.pack.some(e=>e.id==='training_shield'));
  const shield=s.soldier.pack.find(e=>e.id==='training_shield');assert.ok(give(s,shield.uid,'lucan').ok);
  assert.equal(companionWorn(s,'lucan')['shield:0'],'training_shield');assert.ok(s.soldier.pack.some(e=>e.id==='scutum'),'his old scutum comes back');
  assert.ok(companionAttributes(s,'lucan').combat>=15);assert.doesNotThrow(()=>validateSoldier(s,fail));
});

test('prices follow Eloquence; traders buy at half; pay is drawn once a chapter',()=>{
  assert.equal(priceOf('hamata',10),60);assert.equal(priceOf('hamata',15),57);assert.equal(priceOf('hamata',40),48,'the discount stops at a fifth');
  assert.equal(priceOf('hamata',10,{selling:true}),30);
  const s=camp();s.soldier.denarii=100;assert.ok(buy(s,'manica').ok);assert.equal(s.soldier.denarii,78);
  const piece=s.soldier.pack.find(e=>e.id==='manica');assert.ok(sell(s,piece.uid).ok);assert.equal(s.soldier.denarii,89);
  assert.ok(collectPay(s).ok);assert.equal(collectPay(s).ok,false);assert.equal(s.soldier.denarii,109);
});

test('rewards are granted once, at the commit: objective, capabilities, kills (at most ten) and commendations',()=>{
  const s=camp();s.chapterCapabilities={1:['move','strike']};
  const e={id:'ch1-road',staged:{killTP:14,commendations:[{id:'all-home',tp:2}]}};
  const first=commitSoldierRewards(s,e);assert.equal(first.tp,TP.objective['ch1-road']+2+TP.killCap+2);
  const again=commitSoldierRewards(s,e);assert.equal(again.tp,TP.killCap,'only freshly staged kill TP can repeat, and a commit happens once');
  assert.deepEqual(awardDecorations({...s,decisions:{ch2:'carry'}},'ch2-marsh'),['corona_civica']);
});

test('a chronicle from before 0.40 loads untouched; the soldier is adopted by choice, with the kit his chapter issued',()=>{
  const fresh=G.newGame('Test',275,{path:'explorator'});assert.equal(fresh.soldier.path,'explorator');assert.doesNotThrow(()=>G.serialize(fresh));
  const legacy=JSON.parse(G.serialize(fresh));delete legacy.soldier;legacy.chapter=1;
  const loaded=G.deserialize(JSON.stringify(legacy));assert.equal(loaded.soldier,undefined,'loading never adds a record');
  assert.equal(soldierOf(loaded).path,'legionary');assert.equal(loaded.soldier,undefined,'reading the default changes nothing');
  assert.ok(adoptSoldier(loaded,{path:'librarius'}).ok);assert.equal(loaded.soldier.path,'librarius');assert.doesNotThrow(()=>G.serialize(loaded));
  assert.equal(adoptSoldier(loaded,{path:'legionary'}).ok,false,'the choice is made once');
});

test('the pack is a 10 × 6 grid of shapes with no overlap',()=>{
  const s=createSoldier();s.pack=[];assert.ok(packFits(s.pack,'scutum',8,2));assert.equal(packFits(s.pack,'scutum',9,0),false);
  assert.equal(PACK.cols*PACK.rows,60);assert.ok(Object.values(ITEMS).every(i=>i.shape.w<=PACK.cols&&i.shape.h<=PACK.rows));
  assert.deepEqual(wornIds(createSoldier()),['galea','tunic','subarmalis','bracae','caligae','cingulum','spatha','training_shield']);
});
