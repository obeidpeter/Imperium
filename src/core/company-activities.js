import {COMPANY_ACTIVITIES,companyActivityFor,activityId,activityFlag} from '../data/company-activities.js';

export function companyActivities(state){
  if(!state?.soldier)return [];
  const flags=state?.soldier?.flags??{};
  return COMPANY_ACTIVITIES.filter(a=>a.chapter===state?.chapter||flags[activityFlag(a.chapter,'done')]).map(a=>({
    id:activityId(a.chapter),chapter:a.chapter,title:a.title,started:!!flags[activityFlag(a.chapter,'started')],completed:!!flags[activityFlag(a.chapter,'done')],
    summary:flags[activityFlag(a.chapter,'done')]?a.result:a.intro,
    steps:a.steps.map(s=>({id:s.id,label:s.label,place:s.place,done:!!flags[activityFlag(a.chapter,s.key)]||!!flags[activityFlag(a.chapter,'done')]}))
  }));
}
// Only a completed public reply changes the visible camp. Reads, guessed
// answers and an uncompleted activity leave people and objects untouched.
export function activityCampView(state,camp){
  const a=companyActivityFor(state.chapter),flags=state.soldier?.flags??{},done=a&&flags[activityFlag(state.chapter,'done')];
  if(!done)return {people:camp.people,objects:camp.objects};
  return {people:camp.people.map(p=>p.id===a.actor?{...p,place:a.reunion,at:a.reunionAt,routine:'work'}:p),
    objects:camp.objects.map(o=>o.id===a.steps[2].id?{...o,name:a.completedName}:o)};
}
