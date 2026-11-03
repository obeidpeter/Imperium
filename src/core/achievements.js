import {ACHIEVEMENTS} from '../data/achievements.js';

// Which achievements a chronicle has earned (the Steam plan, S3): read from what the rules already record, and never
// changing anything. Chapters from the completed list, decorations and titles from the soldier's record, the finale's
// route from the confrontation's committed result, and a finish from the accession with its difficulty (chosen at New
// Game) or Iron discipline (which can be turned off but never on again). A Practice replay earns nothing.
export function earnedAchievements(state){
  if(!state||typeof state!=='object'||state.archiveReplay)return [];
  const completed=Array.isArray(state.completed)?state.completed:[],soldier=state.soldier??{},history=Array.isArray(state.history)?state.history:[];
  const crowned=state.phase==='epilogue'&&Array.isArray(state.milestones)&&state.milestones.includes('augustus');
  const has=(list,id)=>Array.isArray(list)&&list.includes(id);
  return ACHIEVEMENTS.filter(({earned:e})=>
    e.chapter?completed.includes(e.chapter)
    :e.decoration?has(soldier.decorations,e.decoration)
    :e.title?has(soldier.titles,e.title)
    :e.route?history.some(h=>h?.chapter===12&&h.route===e.route)
    :e.finish==='veteran'?crowned&&state.difficulty==='veteran'
    :e.finish==='iron'?crowned&&state.ironDiscipline===true
    :false);
}
