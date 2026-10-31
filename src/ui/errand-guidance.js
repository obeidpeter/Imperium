import {ERRANDS} from '../data/dialogue.js';
import {ERRAND_STEPS} from '../data/errand-guidance.js';
import {campFor,campPersonPresent,campPersonSpot,campPlaceName} from '../data/camps.js';
import {campStoryFlag} from '../data/camp-stories.js';
import {errandStage,needs,dialogueNode} from '../core/dialogue.js';
import {areaOf} from '../core/soldier.js';

function matches(state,c={}){
  const flags=state.soldier?.flags??{};
  if(c.flag&&!flags[c.flag]||c.notFlag&&flags[c.notFlag])return false;
  if(c.oath!==undefined&&!!state.oath!==c.oath)return false;
  if(c.groundItem&&!state.soldier?.ground?.[areaOf(state)]?.some(item=>item.id===c.groundItem))return false;
  if(c.any&&!c.any.some(part=>matches(state,part)))return false;
  return needs(state,c).length===0;
}
// Resolve through the current camp, including substitutes and recovering people.
// Never send a player to an absent actor or a place from an earlier chapter.
function destination(state,target){
  if(target?.panel)return {kind:'panel',panel:target.panel,label:'Open equipment'};
  const camp=campFor(state.chapter);if(!camp)return null;
  for(const tree of Array.isArray(target)?target:[target]){
    const person=camp.people.find(p=>p.talk===tree&&campPersonPresent(state,p));
    const object=camp.objects.find(o=>o.talk===tree);
    if(person||object){
      const thing=person??object,place=person?campPersonSpot(state,person).place:object.place;
      return {kind:person?'person':'object',id:thing.id,tree,name:thing.name,place,placeName:campPlaceName(state.chapter,place),label:person?'Go to '+thing.name:'Go to '+thing.name.replace(/^The /,'the ')};
    }
  }
  return null;
}
/** Pure guidance for an accepted errand. Old, done and unsupported records never
 * acquire a live destination merely because their old summary names someone. */
export function errandGuidance(state,id){
  const errand=ERRANDS[id],stage=errandStage(state,id);if(!errand||stage==='none')return null;
  const base={id,title:errand.title,chapter:errand.chapter,giver:errand.giver,stage,destination:null,trackable:false};
  if(stage==='done')return {...base,status:'done',text:'Completed.'};
  if(stage!=='accepted')return {...base,status:'unavailable',text:'This errand is not active.'};
  const story=id.startsWith('company-story:');
  if(errand.chapter>state.chapter)return {...base,status:'unavailable',text:'This errand belongs to a later chapter.'};
  if(!story&&errand.chapter!==state.chapter)return {...base,status:'past',text:`Left in Chapter ${errand.chapter}. No destination in this camp.`};
  if(story){
    const chosen=!!state.soldier?.flags?.[campStoryFlag(errand.chapter)],ready=chosen&&(state.chapter>errand.chapter||(state.encounterIndex??0)>=1);
    if(!chosen)return {...base,status:'unavailable',text:'No company instruction is recorded.'};
    return {...base,status:ready?'active':'waiting',text:ready?'Read and file the company’s returning report.':'Complete an encounter, then read the company’s reply.',trackable:true,
      destination:ready?{kind:'record',tree:id,label:'Read the report'}:null};
  }
  const next=ERRAND_STEPS[id]?.find(s=>matches(state,s.when));
  if(!next)return {...base,status:'unavailable',text:'Review this errand in the chronicle.'};
  const to=destination(state,next.target),unavailable=next.target&&!to;
  let text=unavailable?'The next contact is not present in this camp.':next.text;
  if(to&&Array.isArray(next.target))text=text.replace('your companion',to.name);
  return {...base,text,status:unavailable?'unavailable':!to||to.kind==='panel'?'blocked':'active',destination:to,trackable:!unavailable&&!!to};
}
export const errandGuidanceList=state=>Object.keys(state.soldier?.errands??{}).map(id=>errandGuidance(state,id)).filter(Boolean);

/** A UI-only preference; no soldier, campaign, RNG or world state is written. */
export function createErrandTracker({load=()=>null,save=()=>{}}={}){
  let selected=null;try{selected=load();}catch{}
  const persist=value=>{selected=value;try{save(value);}catch{}};
  const campaign=state=>JSON.stringify([state?.name,state?.seed]);
  const read=state=>{
    if(!selected)return null;
    const guide=state&&errandGuidance(state,selected.id);
    if(!guide?.trackable||selected.chapter!==state.chapter||selected.campaign!==campaign(state)||['promotion','epilogue'].includes(state.phase)){
      persist(null);return null;
    }
    return guide;
  };
  return {read,clear:()=>persist(null),select(state,id){
    const guide=errandGuidance(state,id);if(!guide?.trackable||state.phase!=='camp'||state.archiveReplay)return false;
    persist({id,chapter:state.chapter,campaign:campaign(state)});return true;
  }};
}

/** The same queued Talk/Use commands as the command list: approach normally,
 * then open the existing conversation. No travel/teleport or state mutation. */
export function errandDestinationAction(state,id,world=null){
  if(state?.phase!=='camp'||state.archiveReplay)return null;
  const guide=errandGuidance(state,id),to=guide?.destination;if(!to)return null;
  if(to.kind==='panel')return {panel:to.panel};
  if(to.kind==='record')return dialogueNode(state,to.tree)?{tree:to.tree}:null;
  if(!world)return {tree:to.tree}; // Existing accessible camp conversation list.
  if(world.kind!=='camp'||world.chapter!==state.chapter)return null;
  const target=to.kind==='person'?world.actors.find(a=>a.id===to.id&&a.alive&&a.talk?.tree===to.tree):world.objects.find(o=>o.id===to.id&&o.talk===to.tree);
  if(!target)return null;
  return {command:{actorId:world.heroId,kind:to.kind==='person'?'talk':'interact',payload:to.kind==='person'?{targetId:to.id}:{objectId:to.id}}};
}
