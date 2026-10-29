import {finaleCareerSupport,fieldReportText} from '../campaign-consequences.js';
import {openGate,repairBridge} from './field-objects.js';
import {span} from './navigation.js';
import {FINALE_RESERVE} from '../../data/realtime-rules.js';

// Apply earned routes and logistics only at departure. The full world is saved;
// loading, retrying and changing camera never reapplies a benefit.
export function applyCampaignSupport(state,e,world){
  if(state.progressionVersion!==1||world.practice)return;
  const notes=[],hero=world.actors.find(a=>a.id===world.heroId);
  for(const r of state.progression.operationResults.filter(r=>r.outcome==='clean'&&e.appliedOperations?.includes(r.encounterId))){
    if(r.benefit==='intelligence'){
      const gate=world.objects.find(o=>o.kind==='gate'&&o.state==='closed'&&!o.works);
      if(gate){openGate(world,gate);notes.push(`${r.label}: scouts opened ${gate.name}. Both armies can use the route.`);}
      else {const hidden=world.actors.filter(a=>a.hidden&&a.side==='enemy').sort((a,b)=>span(a.x-hero.x,a.z-hero.z)-span(b.x-hero.x,b.z-hero.z))[0];
        if(hidden){hidden.hidden=false;notes.push(`${r.label}: scouts marked one concealed enemy position.`);}}
    }else if(r.benefit==='stores'){
      const bridge=world.objects.find(o=>o.kind==='bridge'&&o.state==='damaged');
      if(bridge){repairBridge(world,bridge);notes.push(`${r.label}: the supply train repaired ${bridge.name} before your arrival.`);}
      else if(world.field){world.field.deadline=Math.min(30,world.field.deadline+2);notes.push(`${r.label}: protected stores keep the field opportunity open through round ${world.field.deadline}.`);}
    }else {
      for(const a of world.actors.filter(a=>world.mission.escorts.includes(a.id))){a.maxHp+=4;a.hp+=4;}
      for(const q of world.squads??[])if(q.side!=='enemy')q.cohesion=Math.min(100,q.cohesion+10);
      notes.push(`${r.label}: rested reserves strengthen the columns and steady the formations.`);
    }
  }
  const engineer=(state.progression.fieldReports??[]).find(r=>r.consumedBy===null&&r.works>0&&r.engineering===r.works&&!r.withdrawals);
  if(engineer){world.engineering=true;notes.push('The previous siege’s engineers support this action: each uninterrupted work action completes the job.');}
  if(state.chapter===12&&e.type==='confrontation'&&FINALE_RESERVE.routes.includes(e.route)){
    const support=finaleCareerSupport(state),reserves=world.mission.waves.filter(w=>w.squad?.name===FINALE_RESERVE.name);
    for(const w of reserves.slice(0,support.reservesRemoved))w.arrived=true;
    notes.push(...support.reasons);
  }
  for(const text of notes)world.log.push({tick:world.tick,text});
}
export function stageFieldReport(state,e,world){
  if(state.progressionVersion!==1||world.practice||world.status!=='won')return;
  const works=world.objects.filter(o=>['countermine','siege-engine'].includes(o.kind));
  const withdrawals=world.actors.filter(a=>world.party.includes(a.id)&&(!a.alive||a.down)).length+
    (world.squads??[]).filter(q=>q.side==='ally'&&(q.broken||q.strength<=0)).length;
  e.staged.fieldReport={version:1,id:e.id,works:works.length,engineering:works.filter(o=>o.done).length,withdrawals,opportunity:world.field?.outcome==='secured'};
  e.log.push(fieldReportText(e.staged.fieldReport));
}
