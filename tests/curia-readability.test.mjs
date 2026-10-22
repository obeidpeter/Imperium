import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import * as C from '../src/core/chamber.js';
import {createChamberWorld} from '../src/core/realtime/chamber-world.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {createChamberControl} from '../src/showcase/chamber-control.js';
import {delegatePortrait} from '../src/ui/delegate-portrait.js';
import {DEFAULT_KEYMAP} from '../src/ui/action-map.js';

let checkpoint;
function council(){
  if(!checkpoint){const done=new Error('reached council');
    try{runCommandCampaign({featureEdition:35,onCheckpoint(s){if(G.getChapter(s).encounters[s.encounterIndex]?.id==='ch7-council'){checkpoint=G.serialize(s);throw done;}}});}
    catch(error){if(error!==done)throw error;}}
  const s=G.deserialize(checkpoint);assert.ok(G.startEncounter(s).ok);return s;
}
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

test('a distant delegate says current distance, speech reach and a next-hour plan without spending a speech',()=>{
  const s=council(),e=s.encounter,hero=e.units.find(u=>u.id==='hero');
  const far=e.units.find(u=>u.role==='voter'&&distance(hero,u)>1&&!C.walkBeside(s,hero.id,'persuade',u));
  assert.ok(far);const before=G.serialize(s),row=C.conversation(s,hero.id,far.id).speeches.find(r=>r.action==='persuade');
  assert.equal(row.ok,false);assert.equal(row.walk,undefined);
  assert.match(row.message,new RegExp(`${distance(hero,far)*C.SEAT} m away; Persuade reaches 2 m`));
  assert.match(row.message,/cannot reach speaking distance this hour/);assert.match(row.message,/No speech is spent/);
  assert.doesNotMatch(row.message,/Promises are limited/);assert.equal(G.serialize(s),before);
});

test('the same speech restriction reports a walk, spent speech, exhausted promises and a used Record precisely',()=>{
  const s=council(),e=s.encounter,hero=e.units.find(u=>u.id==='hero');
  const nearby=e.units.find(u=>u.role==='voter'&&distance(hero,u)>1&&C.walkBeside(s,hero.id,'persuade',u));
  assert.match(C.speechProblem(s,hero.id,'persuade',nearby.id),/Walk \d+ m along the aisle first/);
  assert.match(C.speechProblem(s,hero.id,'persuade','speaker-ally'),/needs a voting member/);
  const row=C.conversation(s,hero.id,nearby.id).speeches.find(r=>r.action==='persuade');assert.ok(row.walk&&row.command);
  hero.acted=true;assert.match(C.speechProblem(s,hero.id,'persuade',nearby.id),/has spoken this hour/);
  hero.acted=false;e.promises=['first','second'];assert.match(C.speechProblem(s,hero.id,'promise',nearby.id),/Both promises have been used/);
  e.recordUses=[nearby.id];assert.match(C.speechProblem(s,hero.id,'record',nearby.id),/already heard your Record/);
});

function controller(s){
  const world=createChamberWorld(s),messages=[],spoken=[],canvas=Object.assign(new EventTarget(),{dataset:{},focus(){}});
  const conversation={hidden:false,children:['stale'],classList:{remove(){}},replaceChildren(){this.children=[];}};
  const coalition={innerHTML:'',querySelectorAll(){return [];}};
  const control=createChamberControl({world:()=>world,canvas,dom:{conversation,coalition},keymap:DEFAULT_KEYMAP,
    rules:{state:()=>s,known:()=>false,ask(){},apply:async()=>null},takeControl:id=>{world.controlled=id;},
    presenter:()=>({setReach(){},setMarks(){},setRoute(){}}),say(){},message:text=>messages.push(text),announce:text=>spoken.push(text)});
  return {control,world,messages,spoken,conversation,coalition};
}

test('keyboard target range and forecast refresh after a legal walk and speech without repeating announcements',()=>{
  const s=council(),e=s.encounter,hero=e.units.find(u=>u.id==='hero'),c=controller(s);
  const person=e.units.find(u=>u.role==='voter'&&distance(hero,u)>1&&C.walkBeside(s,hero.id,'persuade',u));
  for(let i=0;i<20&&c.control.target!==person.id;i++)c.control.act('target_next_enemy');
  assert.equal(c.control.target,person.id);const old=c.messages.at(-1),announcements=c.spoken.length;
  c.control.hover({actorId:hero.id},{refresh:true});assert.equal(c.messages.at(-1),old,'a stationary pointer refresh cannot replace the keyboard target');
  const place=C.walkBeside(s,hero.id,'persuade',person);assert.ok(C.walk(s,hero.id,place).ok);
  c.control.sync();c.control.update();const changed=c.messages.at(-1);
  assert.notEqual(changed,old);assert.match(changed,/2 m/);assert.match(changed,/Support \d+ → \d+/);
  assert.equal(c.spoken.length,announcements,'state refresh is silent');
  const result=C.speak(s,{unitId:hero.id,action:'persuade',x:person.x,y:person.y,targetId:person.id});assert.ok(result.ok);
  c.control.sync(result);c.control.update();assert.match(c.messages.at(-1),/has spoken this hour/);
  assert.equal(c.spoken.length,announcements);c.control.dispose();
});

test('retry reset closes stale conversation DOM even when its selected person is already cleared',()=>{
  const c=controller(council());assert.equal(c.conversation.hidden,true,'mount clears old DOM');
  c.conversation.hidden=false;c.conversation.children=['old defeat or dialogue'];c.control.reset();
  assert.equal(c.conversation.hidden,true);assert.deepEqual(c.conversation.children,[]);assert.equal(c.control.target,null);
  assert.equal(c.messages.at(-1),'');c.control.dispose();
});

test('the coalition strip shows both the current and conditional next-rival vote count',()=>{
  const s=council(),before=G.serialize(s),c=controller(s),v=C.coalitionView(s);
  assert.match(c.coalition.innerHTML,new RegExp(`<strong>${v.votes.for} of ${v.votes.total}</strong> for`));
  assert.match(c.coalition.innerHTML,new RegExp(`After the rivals’ reply: <strong>${v.whip.projectedVotesAfterRivals} of ${v.votes.total}</strong> for, if you change nothing`));
  assert.equal(G.serialize(s),before);c.control.dispose();
});

test('delegate medallions keep identity stable, react to stance, and escape untrusted labels',()=>{
  const person={id:'member2',name:'Civic delegate 1',role:'voter',bloc:'Civic',stance:1},before=JSON.stringify(person);
  assert.equal(delegatePortrait(person),delegatePortrait(person));assert.equal(JSON.stringify(person),before);
  assert.notEqual(delegatePortrait(person),delegatePortrait({...person,id:'member3'}));
  assert.notEqual(delegatePortrait(person),delegatePortrait({...person,stance:-1}));
  const unsafe=delegatePortrait({...person,name:'<img src=x onerror="alert(1)">'});
  assert.doesNotMatch(unsafe,/<img|onerror="/);assert.match(unsafe,/&lt;img/);
  assert.match(delegatePortrait(person,{decorative:true}),/aria-hidden="true"/);
  assert.doesNotMatch(delegatePortrait(person),/href=|Math\.random|<image/);
});
