import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {companyStories} from '../src/core/camp-stories.js';
import {CAMP_STORIES,campStoryId,campStoryFlag} from '../src/data/camp-stories.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {Document} from './mini-dom.mjs';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const camp=chapter=>Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state));
const choose=(state,story,index)=>Game.campReply(state,{treeId:campStoryId(story.chapter),nodeId:'letter',index});
const unchanged=(state,action)=>{const before=Game.serialize(state);assert.equal(action().ok,false);assert.equal(Game.serialize(state),before);};

test('every later chapter has two distinct previewed company choices with bounded, once-only consequences',()=>{
  assert.deepEqual(CAMP_STORIES.map(s=>s.chapter),[4,5,6,7,8,9,10,11,12]);assert.equal(new Set(CAMP_STORIES.map(s=>s.title)).size,9);
  for(const story of CAMP_STORIES)for(const [index,choice]of story.choices.entries()){
    const state=camp(story.chapter),before=Game.serialize(state),view=Game.campConversation(state,campStoryId(story.chapter),'letter');
    assert.equal(Game.campHasNews(state,campStoryId(story.chapter)),true);
    assert.equal(Game.serialize(state),before,'reading a letter and preview is pure');
    assert.equal(view.options[index].text,choice.label);assert.equal(view.options[index].preview.filter(s=>/Loyalty|Backing|Confidence/.test(s)).length,2);
    assert.ok(Object.values(choice.meters).every(n=>Number.isInteger(n)&&Math.abs(n)<=2));
    const meters={...state.meters},progress=JSON.stringify([state.rng,state.decisions,state.milestones,state.history,state.company,state.supplies,state.relationships]),tp=state.soldier.tp;
    assert.ok(choose(state,story,index).ok);
    for(const key of Object.keys(meters))assert.equal(state.meters[key],Math.max(0,Math.min(100,meters[key]+(choice.meters[key]??0))));
    assert.equal(JSON.stringify([state.rng,state.decisions,state.milestones,state.history,state.company,state.supplies,state.relationships]),progress,'no invented history, death, reward or departure requirement');
    assert.equal(state.soldier.tp,tp);assert.equal(state.soldier.flags[campStoryFlag(story.chapter,choice.id)],true);
    assert.equal(state.soldier.errands[campStoryId(story.chapter)],'accepted');
    assert.equal(Game.campHasNews(state,campStoryId(story.chapter)),[5,8,11].includes(story.chapter),'only the additional unstarted camp activity remains news while the reply is pending');
    unchanged(state,()=>choose(state,story,index));unchanged(state,()=>choose(state,story,1-index));
    const saved=Game.serialize(state),restored=Game.deserialize(saved);assert.equal(Game.serialize(restored),saved);
    unchanged(restored,()=>choose(restored,story,index));
  }
});

test('a legal whole campaign takes and completes all nine stories without granting a milestone or skipping a field',()=>{
  const chosen=new Set(),completed=new Set();
  const result=runCommandCampaign({featureEdition:35,onCheckpoint:state=>{
    const story=CAMP_STORIES.find(s=>s.chapter===state.chapter);if(!story)return;
    const id=campStoryId(story.chapter);
    if(!chosen.has(id)){assert.ok(choose(state,story,state.chapter%2).ok);chosen.add(id);}
    const row=companyStories(state).find(r=>r.id===id);
    if(row.ready&&!completed.has(id)){
      assert.equal(Game.campHasNews(state,id),true);
      const before=Game.serialize(state),report=Game.campConversation(state,id,'report');assert.ok(report);assert.equal(Game.serialize(state),before);
      const selected=story.choices.find(c=>state.soldier.flags[campStoryFlag(story.chapter,c.id)]);assert.ok(report.text.includes(selected.report));
      const reply=report.options.find(o=>o.text.startsWith('Enter the reply'));assert.ok(reply);
      assert.ok(Game.campReply(state,{treeId:id,nodeId:'report',index:reply.index}).ok);completed.add(id);
      assert.equal(state.soldier.errands[id],'done');const recorded=Game.serialize(state);
      assert.equal(Game.campHasNews(state,id),[5,8,11].includes(story.chapter),'the unstarted optional activity may remain news, while the filed reply offers no repeated reward');
      unchanged(state,()=>Game.campReply(state,{treeId:id,nodeId:'report',index:reply.index}));
      assert.equal(Game.serialize(Game.deserialize(recorded)),recorded);
    }
  }});
  assert.equal(result.rank,'Augustus');assert.equal(result.encounters.length,25);assert.equal(chosen.size,9);assert.equal(completed.size,9);
  const rows=companyStories(result.state);assert.equal(rows.length,9);assert.ok(rows.every(r=>r.completed&&r.ready&&r.acknowledgement));
  const html=createCampaignViews(()=>({state:result.state,screen:'game',settings:{}})).ending();
  for(const row of rows)assert.ok(html.includes(row.acknowledgement),'each choice has a persistent epilogue acknowledgement');
});

test('future stories and premature reports are refused unchanged; a later camp can receive an unfinished earlier reply',()=>{
  const early=camp(4);assert.equal(Game.campConversation(early,campStoryId(12)),null);
  unchanged(early,()=>choose(early,CAMP_STORIES.at(-1),0));
  const story=CAMP_STORIES[0],state=camp(4);assert.ok(choose(state,story,0).ok);
  assert.equal(Game.campConversation(state,campStoryId(4),'report'),null);
  unchanged(state,()=>Game.campReply(state,{treeId:campStoryId(4),nodeId:'report',index:0}));
  // Explicit progress-boundary fixture: carry only the legally chosen story
  // flags into a separately earned later camp, rather than invent a victory.
  const later=camp(5);Object.assign(later.soldier.flags,state.soldier.flags);Object.assign(later.soldier.errands,state.soldier.errands);
  const row=companyStories(later).find(r=>r.chapter===4);assert.equal(row.ready,true);assert.equal(row.acknowledgement,story.choices[0].later);
  assert.ok(Game.campReply(later,{treeId:campStoryId(4),nodeId:'report',index:0}).ok);
  unchanged(later,()=>choose(later,story,1));
});

test('letters honour both authored companion fates, and mentor memories never impersonate a living writer',()=>{
  for(const story of CAMP_STORIES)for(const fate of ['carry','leave']){
    const state=camp(story.chapter);state.decisions.ch2=fate; // Explicit authored-fate fixture.
    const before=JSON.stringify(state),letter=Game.campConversation(state,campStoryId(story.chapter),'letter');
    assert.match(letter.speaker,fate==='carry'?/Aurelius Lucan/:/Gaius Sabinus/);assert.equal(JSON.stringify(state),before);
  }
  for(const fate of ['save','obey']){
    const state=camp(6);state.decisions.ch6=fate;assert.ok(choose(state,CAMP_STORIES[2],0).ok);
    state.encounterIndex=1; // Report timing and authored-fate unit fixture.
    const before=JSON.stringify(state),report=Game.campConversation(state,campStoryId(6),'report');
    assert.match(report.text,fate==='save'?/alive to disagree/:/Varro died.*memory, never as a new letter/);
    assert.equal(JSON.stringify(state),before);
  }
});

test('both camp modes expose optional company stories without concealing required preparation or mutating a save',()=>{
  for(const story of CAMP_STORIES){
    const state=camp(story.chapter),before=Game.serialize(state),view=createCampaignViews(()=>({state,screen:'game',settings:{}}));
    for(const mode of ['camp','realtimeCamp']){
      const document=new Document();document.body.innerHTML=view[mode]();const panel=document.getElementById('camp-company-stories');
      assert.ok(panel);assert.equal(panel.open,false);assert.ok(panel.querySelector(`[data-cmd="conversation"][data-id="${campStoryId(story.chapter)}"]`));
      assert.ok(document.querySelector('[data-cmd="start"]'));assert.equal(Game.serialize(state),before);
    }
  }
});
