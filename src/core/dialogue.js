import {DIALOGUE,ERRANDS} from '../data/dialogue.js';
import {ITEMS} from '../data/items.js';
import {DECORATIONS,TITLES} from '../data/soldier.js';
import {ATTRIBUTE_NAMES,TRAINING_PATHS} from '../data/realtime-rules.js';
import {soldierAttributes,grantTP,awardTitle,packAdd,areaOf} from './soldier.js';
import {clone,result} from './shared.js';

// Conversations (build brief §3.12, guide "Talking and using things"): pure
// over the chronicle. A node shows the replies the story allows now; a reply
// whose requirement is unmet (an attribute, decoration, title, item, meter or
// training path) is listed dimmed with what it needs. Choosing a reply
// applies its effects all together or not at all, and a reply that grants
// anything (or an errand's completion) does so once only.

const METER_NAMES={army:'Army Loyalty',political:'Political Backing',public:'Public Confidence'};
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
export const errandStage=(state,id)=>state.soldier?.errands?.[id]??'none';
const saidKey=(treeId,nodeId,index)=>`said:${treeId}:${nodeId}:${index}`;

// Whether the story allows a reply now (hidden when not): flags, errands, decisions, the oath, progress, recovery.
function storyAllows(state,c){
  if(c.all&&!c.all.every(branch=>storyAllows(state,branch)))return false;
  if(c.any&&!c.any.some(branch=>storyAllows(state,branch)))return false;
  const s=state.soldier,flags=s?.flags??{};
  if(c.flag&&!flags[c.flag])return false;if(c.notFlag&&flags[c.notFlag])return false;
  for(const [id,stage]of Object.entries(c.errand??{}))if(errandStage(state,id)!==stage)return false;
  for(const [id,option]of Object.entries(c.decision??{}))if((state.decisions?.[id]??null)!==option)return false;
  if(c.oath!==undefined&&!!state.oath!==c.oath)return false;
  if(c.encounterIndex&&!((state.encounterIndex??0)>=(c.encounterIndex.min??0)&&(state.encounterIndex??0)<=(c.encounterIndex.max??99)))return false;
  if(c.history&&(state.history?.length??0)<(c.history.min??0))return false;
  if(c.chapter&&!(state.chapter>=(c.chapter.min??1)&&state.chapter<=(c.chapter.max??12)))return false;
  // A companion still recovering on the company roll (career.js), or fit again.
  const recovering=id=>(state.company??[]).some(v=>v.id===id&&v.recovery>0);
  if(c.recovering&&!recovering(c.recovering))return false;if(c.fit&&recovering(c.fit))return false;
  return true;
}
// What a reply needs that the soldier lacks, in the guide's bracket words: [] when he has it all.
export function needs(state,c={}){
  const s=state.soldier;if(!s)return ['Your soldier’s training'];
  const out=[],attrs=soldierAttributes(s);
  for(const [k,v]of Object.entries(c.attribute??{}))if((attrs[k]??0)<v)out.push(`${ATTRIBUTE_NAMES[k]} ${v}`);
  if(c.decoration&&!s.decorations.includes(c.decoration))out.push(DECORATIONS[c.decoration]?.name??c.decoration);
  if(c.title&&!s.titles.includes(c.title))out.push(TITLES[c.title]?.name??c.title);
  if(c.item&&!s.pack.some(e=>e.id===c.item))out.push(ITEMS[c.item]?.name??c.item);
  for(const [k,{min}]of Object.entries(c.meter??{}))if((state.meters?.[k]??0)<min)out.push(`${METER_NAMES[k]} ${min}`);
  if(c.path&&s.path!==c.path)out.push(`${TRAINING_PATHS[c.path]?.name??c.path} training`);
  return out;
}
// Each effect in a few words, shown beside the reply before it is chosen.
export function effectsPreview(e={}){
  const out=[];
  for(const [k,v]of Object.entries(e.meters??{}))out.push(`${v>0?'+':''}${v} ${METER_NAMES[k]}`);
  if(e.tp)out.push(`+${e.tp} TP`);if(e.denarii)out.push(`${e.denarii>0?'+':''}${e.denarii} denarii`);
  for(const id of e.give??[])out.push(`receive ${ITEMS[id]?.name??id}`);for(const id of e.take??[])out.push(`give up ${ITEMS[id]?.name??id}`);
  if(e.title)out.push(`title: ${TITLES[e.title]?.name??e.title}`);
  for(const [id,stage]of Object.entries(e.errand??{})){const errand=ERRANDS[id];if(!errand)continue;
    if(stage==='accepted')out.push(`errand: ${errand.title}`);if(stage==='done')out.push(...effectsPreview(errand.reward).map(t=>`${t}`));}
  return out;
}

// A node as the conversation window shows it. Replies granting anything are listed until chosen once.
export function dialogueNode(state,treeId,nodeId=null){
  const tree=DIALOGUE[treeId],id=nodeId??tree?.start,node=tree?.nodes[id];if(!node)return null;
  if(!storyAllows(state,tree.conditions??{})||!storyAllows(state,node.conditions??{}))return null;
  const flags=state.soldier?.flags??{};
  const options=node.options.map((o,index)=>({index,text:o.text,next:o.next,needs:needs(state,o.conditions),preview:effectsPreview(o.effects),
    allowed:storyAllows(state,o.conditions)&&!(grants(o)&&flags[saidKey(treeId,id,index)])})).filter(o=>o.allowed);
  const variant=node.variants?.find(v=>storyAllows(state,v.conditions??{}));
  const text=[variant?.text??node.text,...(node.paragraphs??[]).filter(p=>storyAllows(state,p.conditions??{})).map(p=>p.text)].join(' ');
  return {treeId,nodeId:id,speaker:variant?.speaker??node.speaker,text,options};
}
const grants=o=>!!(o.once||o.effects.tp||o.effects.denarii||o.effects.give?.length||o.effects.title||o.effects.meters||
  Object.values(o.effects.errand??{}).includes('done'));

// Choose a reply: { ok, message, next, open }. `story` carries the chronicle's own
// commands the conversation may call (the chapter's decision, the oath), so
// they keep their rules. Nothing changes unless every effect applies.
export function reply(state,{treeId,nodeId,index}={},story={}){
  if(!state.soldier)return result(false,'Choose your soldier’s training first.');
  if(state.phase==='encounter')return result(false,'Conversations in camp wait until the encounter is over.');
  const view=dialogueNode(state,treeId,nodeId),shown=view?.options.find(o=>o.index===index);
  if(!shown)return result(false,'That reply is not open now.');
  if(shown.needs.length)return result(false,`Needs ${shown.needs.join(', ')}.`);
  const option=DIALOGUE[treeId].nodes[view.nodeId].options[index],e=option.effects,trial=clone(state),s=trial.soldier,said=[];
  if(e.decision){const r=story.choose?.(trial,e.decision)??result(false,'No decision here.');if(!r.ok)return r;said.push(r.message);}
  if(e.oath){const r=story.swearOath?.(trial)??result(false,'The oath is sworn at the standards.');if(!r.ok)return r;said.push(r.message);}
  for(const id of e.take??[]){const at=s.pack.findIndex(x=>x.id===id);if(at<0)return result(false,`You do not carry the ${ITEMS[id]?.name??id}.`);s.pack.splice(at,1);}
  for(const id of e.give??[])if(!packAdd(s,id)){const strip=s.ground[areaOf(trial)]??=[];strip.push({uid:`i${s.nextUid++}`,id});}
  for(const f of e.flags??[])s.flags[f]=true;for(const f of e.clear??[])delete s.flags[f];
  const rewards=[e];
  for(const [id,stage]of Object.entries(e.errand??{})){
    const errand=ERRANDS[id];if(!errand)return result(false,'Unknown errand.');
    if(stage==='accepted'&&errandStage(trial,id)!=='none')return result(false,'That errand is already yours.');
    if(stage==='done'){if(errandStage(trial,id)!=='accepted')return result(false,'That errand is not in hand.');rewards.push(errand.reward);
      if(!s.rewarded.errands.includes(id))s.rewarded.errands.push(id);else return result(false,'That errand is already rewarded.');}
    s.errands[id]=stage;
  }
  for(const r of rewards){
    for(const [k,v]of Object.entries(r.meters??{}))trial.meters[k]=clamp((trial.meters[k]??0)+v);
    if(r.tp)grantTP(trial,r.tp);if(r.denarii)s.denarii=Math.max(0,s.denarii+r.denarii);if(r.title)awardTitle(trial,r.title);
  }
  if(grants(option))s.flags[saidKey(treeId,view.nodeId,index)]=true;
  for(const key of Object.keys(state))delete state[key];Object.assign(state,trial);
  const gained=rewards.flatMap(r=>effectsPreview({tp:r.tp,denarii:r.denarii,title:r.title,meters:r.meters}));
  return {ok:true,message:[...said,gained.length?`Gained: ${gained.join(', ')}.`:''].filter(Boolean).join(' ')||'',next:option.next,open:e.open??null};
}

// Errands in hand and done, for the mission orders (Q).
export function errandList(state){
  return Object.values(ERRANDS).filter(e=>errandStage(state,e.id)!=='none').map(e=>({...e,stage:errandStage(state,e.id)}));
}

// Whether a conversation has something new to say (the speech mark): a reply at its
// start that the story has just opened — an errand, a decision, the oath — and not yet said.
export function hasNews(state,treeId){
  const tree=DIALOGUE[treeId],node=tree?.nodes[tree.start];if(!node)return false;
  if(!storyAllows(state,tree.conditions??{})||!storyAllows(state,node.conditions??{}))return false;
  return node.options.some(o=>o.news!==false&&['errand','flag','notFlag','decision','oath'].some(k=>o.conditions[k]!==undefined)&&storyAllows(state,o.conditions)&&!needs(state,o.conditions).length);
}
