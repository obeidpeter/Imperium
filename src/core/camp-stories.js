import {CAMP_STORIES,campStoryId,campStoryFlag} from '../data/camp-stories.js';

// Read-only summaries for both the walkable camp and its accessible services.
// The existing soldier flags/errands are the entire save format for this arc.
export function companyStories(state){
  if(!state?.soldier)return [];
  const flags=state.soldier.flags??{};
  return CAMP_STORIES.filter(s=>s.chapter<=state.chapter&&(s.chapter===state.chapter||flags[campStoryFlag(s.chapter)])).map(story=>{
    const choice=story.choices.find(c=>flags[campStoryFlag(story.chapter,c.id)]),ready=!!choice&&(state.chapter>story.chapter||state.encounterIndex>=1);
    return {id:campStoryId(story.chapter),chapter:story.chapter,title:story.title,choice:choice?.label??null,ready,
      completed:state.soldier.errands?.[campStoryId(story.chapter)]==='done',
      acknowledgement:choice?(ready?(state.chapter>story.chapter?choice.later:choice.report):'Your instruction is recorded. A reply follows after an encounter.'):'An optional company matter awaits your attention.'};
  });
}
