import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {routePreview,queueCommand,step,createWorld} from '../src/core/realtime/simulation.js';
import {DIALOGUE,ERRANDS,DEFEAT_PAGES} from '../src/data/dialogue.js';
import {CAMPS,CAMP_PLACES} from '../src/data/camps.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {soldierCommand} from '../src/core/soldier.js';

const fresh=(path='legionary')=>{const s=G.newGame('T',275,{featureEdition:35,progression:true,path});return s;};
// A reply by its words, as a player picks it.
function say(state,treeId,nodeId,pattern){
  const view=G.campConversation(state,treeId,nodeId),o=view.options.find(x=>pattern.test(x.text));
  assert.ok(o,`${treeId}/${view.nodeId}: a reply like ${pattern}`);return G.campReply(state,{treeId,nodeId:view.nodeId,index:o.index});
}

test('every camp of Chapters I–III has the guide’s seven places, and everyone in it can be walked up to from the gate',()=>{
  for(const ch of [1,2,3])for(const decision of ['carry','leave']){
    const s=fresh();s.chapter=ch;s.decisions.ch2=decision;const w=G.createCampWorld(s);
    assert.equal(w.kind,'camp');assert.deepEqual(Object.keys(w.places).sort(),[...CAMP_PLACES].sort());
    for(const t of [...w.actors.filter(a=>a.id!=='hero'),...w.objects]){
      const r=routePreview(w,'hero',{x:t.x,z:t.z}),end=r.points.at(-1);
      assert.ok(end&&Math.hypot(end.x-t.x,end.z-t.z)<=1.8,`chapter ${ch}: ${t.id} is reachable`);
      if(t.talk)assert.ok(DIALOGUE[t.talk.tree??t.talk]||['table','gate'].includes(t.talk.tree??t.talk),`${t.id} has something to say`);
    }
    // A camp never ends and has no enemies.
    for(let i=0;i<40;i++)step(w);assert.equal(w.status,'active');assert.ok(!w.actors.some(a=>a.side==='enemy'));
  }
  // Lucan is in the marsh camp before the decision, and absent once he was left.
  const s=fresh();s.chapter=2;assert.ok(G.createCampWorld(s).actors.some(a=>a.id==='lucan'));
  s.decisions.ch2='leave';assert.ok(!G.createCampWorld(s).actors.some(a=>a.id==='lucan'));
});

test('walking up to a person opens his conversation; map travel works only in a camp',()=>{
  const s=fresh(),w=G.createCampWorld(s);
  assert.ok(queueCommand(w,{actorId:'hero',kind:'talk',payload:{targetId:'varro'}}).ok);
  let talked=false;for(let i=0;i<1200&&!talked;i++){step(w);talked=w.events.some(e=>e.kind==='talk'&&e.targetId==='varro');}
  assert.ok(talked,'the soldier walks to Varro and the conversation opens');
  assert.equal(G.campPlaceAt(w),'drill');
  const p=w.places.principia;assert.ok(queueCommand(w,{actorId:'hero',kind:'travel',payload:{x:p.x,z:p.z}}).ok);step(w);
  assert.equal(G.campPlaceAt(w),'principia');
  const battle=createWorld({map:{width:4,height:4,terrain:Array.from({length:4},()=>Array(4).fill('grass'))},seed:1,actors:[{id:'hero',name:'H',side:'player',at:[2,2]}]});
  assert.equal(queueCommand(battle,{actorId:'hero',kind:'travel',payload:{x:5,z:5}}).reason,'NO_TARGET','no travel in a fight');
});

test('a conversation shows what the story allows, dims what the soldier lacks, and gives its rewards once',()=>{
  const s=fresh();
  // Varro's errand: offered, accepted, done at the post, rewarded once.
  assert.equal(G.campHasNews(s,'ch1:varro'),true);
  assert.equal(say(s,'ch1:varro','greet',/work for a recruit/).next,'errand');
  assert.ok(say(s,'ch1:varro','errand',/I will be first/).ok);assert.equal(s.soldier.errands.drill_first,'accepted');
  assert.ok(!G.campConversation(s,'ch1:varro').options.some(o=>/first at the post this morning/.test(o.text)),'not until the post is struck');
  assert.ok(say(s,'ch1:post','post',/Strike it/).ok);
  const tp=s.soldier.tp;assert.ok(say(s,'ch1:varro','greet',/first at the post this morning/).ok);
  const r=say(s,'ch1:varro','errand-done',/Thank you/);assert.ok(r.ok);assert.equal(s.soldier.tp,tp+ERRANDS.drill_first.reward.tp);
  assert.ok(s.soldier.titles.includes('drill_first'));assert.equal(s.soldier.errands.drill_first,'done');
  const before=JSON.stringify(s);assert.equal(G.campReply(s,{treeId:'ch1:varro',nodeId:'errand-done',index:0}).ok,false,'never twice');
  assert.equal(JSON.stringify(s),before,'a refused reply changes nothing');
  assert.equal(G.campHasNews(s,'ch1:varro'),false,'nothing new to say');
});

test('a path errand is dimmed with the training it needs, and awards its title to a soldier of that path',()=>{
  const legionary=fresh('legionary');legionary.chapter=3;legionary.phase='camp';
  const clerk=G.campConversation(legionary,'ch3:clerk'),copy=clerk.options.find(o=>/help with the rolls/.test(o.text));
  assert.deepEqual(copy.needs,['Librarius training']);assert.equal(G.campReply(legionary,{treeId:'ch3:clerk',nodeId:'greet',index:copy.index}).ok,false);
  const scribe=fresh('librarius');scribe.chapter=3;
  assert.ok(say(scribe,'ch3:clerk','greet',/help with the rolls/).ok);assert.ok(say(scribe,'ch3:clerk','copy',/Begin/).ok);
  assert.ok(say(scribe,'ch3:clerk','greet',/second copy is finished/).ok);assert.ok(say(scribe,'ch3:clerk','copy-done',/worth doing/).ok);
  assert.ok(scribe.soldier.titles.includes('clerk_of_rolls'));
});

test('items from errands come and go through the pack: the medicine box for Didius, the tribune’s letter for the clerk',()=>{
  const s=fresh();s.chapter=2;
  assert.ok(say(s,'ch2:capsarius','greet',/anything you need/).ok);assert.ok(say(s,'ch2:capsarius','errand',/find it/).ok);
  assert.ok(!G.campConversation(s,'ch2:capsarius').options.some(o=>/medicine box, from the sutler/.test(o.text))||
    G.campConversation(s,'ch2:capsarius').options.find(o=>/medicine box/.test(o.text)).needs.length,'not without the box');
  s.soldier.denarii=40;assert.ok(soldierCommand(s,{kind:'buy',itemId:'medicine_box',from:'trader'}).ok,'the sutler sells it');
  const denarii=s.soldier.denarii;assert.ok(say(s,'ch2:capsarius','greet',/medicine box/).ok);assert.ok(say(s,'ch2:capsarius','errand-done',/Use it well/).ok);
  assert.ok(!s.soldier.pack.some(e=>e.id==='medicine_box'),'the box is given up');assert.equal(s.soldier.denarii,denarii+ERRANDS.medicine.reward.denarii);
});

test('the commander’s table carries the chapter’s decision with its effects shown; the gate opens only when the 0.38 rules allow',()=>{
  const a=fresh(),b=fresh();
  const gate=G.campConversation(a,'gate');assert.match(gate.options[0].needs[0],/decision/,'the decision first');
  const table=G.campConversation(a,'table');assert.equal(table.options.filter(o=>o.decision).length,2);assert.ok(table.options[0].preview.length);
  assert.ok(G.campReply(a,{treeId:'table',index:1}).ok);assert.ok(G.choose(b,CHAPTERS[0].decision.options[1].id).ok);
  assert.deepEqual(a.decisions,b.decisions);assert.deepEqual(a.meters,b.meters,'the same effects as the 0.38 decision');
  assert.equal(G.campConversation(a,'gate').options[0].needs.length,0,'the gate opens');
  assert.equal(G.campConversation(a,'table').nodeId,'decided');
  // The oath: at the standards, after the drill only.
  assert.ok(!G.campConversation(a,'ch1:signifer').options.some(o=>/Swear/.test(o.text)));
  a.encounterIndex=1;assert.ok(say(a,'ch1:signifer','greet',/Swear the military oath/).ok);assert.equal(a.oath,true);
});

test('every Chapter I–III encounter has a defeat page, and every conversation’s replies lead somewhere that exists',()=>{
  for(const ch of CHAPTERS.slice(0,3))for(const e of ch.encounters)assert.ok(DEFEAT_PAGES[e.id],`${e.id} has its page`);
  for(const [id,tree]of Object.entries(DIALOGUE)){
    assert.ok(tree.nodes[tree.start],`${id} starts somewhere`);
    for(const [nid,node]of Object.entries(tree.nodes))for(const o of node.options)if(o.next)assert.ok(tree.nodes[o.next],`${id}/${nid} → ${o.next}`);
  }
  for(const camp of Object.values(CAMPS))for(const p of camp.people)assert.ok(DIALOGUE[p.talk]||p.talk==='gate',`${camp.id}: ${p.id}`);
});
