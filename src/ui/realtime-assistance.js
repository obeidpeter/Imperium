import {MORALE,ORDERS} from '../data/realtime-squads.js';

// Read-only presentation shared by every chapter. Keep decisions in the rules;
// bring the tasks those rules already expose to the front of the interface.
export function fieldTaskOptions(world,options){
  const order=['Objective','Field work','Optional opportunities','Yourself','Enemies','Friends','Objects','The fallen','Places'];
  return options.map(o=>{
    const object=(world.objects??[]).find(x=>x.id===o.subject);
    const group=o.group==='Places'&&/^Move to (?:the objective marker|a position to secure)$/.test(o.label)?'Objective':
      object&&['countermine','siege-engine','gate','bridge','barricade','ladder','ram'].includes(object.kind)?'Field work':
      object?.field&&['stores','signal'].includes(object.kind)?'Optional opportunities':o.group;
    return {...o,group};
  }).sort((a,b)=>(order.indexOf(a.group)<0?99:order.indexOf(a.group))-(order.indexOf(b.group)<0?99:order.indexOf(b.group))||a.label.localeCompare(b.label)||String(a.subject??'').localeCompare(String(b.subject??'')));
}

export function squadCardStatus(world,squad){
  const men=squad.members.filter(id=>world.actors.some(a=>a.id===id&&a.alive)).length;
  if(!men)return 'Lost';
  if(squad.broken)return `${men}/${squad.maxMen} · Regrouping`;
  if(squad.morale<=MORALE.shaken)return `${men}/${squad.maxMen} · Shaken`;
  const queued=[...(world.queue??[])].reverse().find(c=>c.kind==='order'&&c.payload?.squads?.includes(squad.id));
  const kind=queued?.payload.order.kind??squad.pending?.order.kind??squad.order?.kind??squad.formation;
  const name=ORDERS[kind]?.name??(squad.contact?'Engaged':'Standing orders');
  return `${men}/${squad.maxMen} · ${name}${queued?' queued':squad.pending?' coming':''}`;
}

export function noticeRemaining(remaining,elapsed,{paused=false,reading=false}={}){
  return paused||reading?remaining:Math.max(0,remaining-Math.max(0,elapsed));
}

// Reading combat news must never make the next deliberate input appear ignored.
// The old message is retained by the caller in Earlier messages.
export function feedbackCanReplace(current,{source='input',priority=2}={},now){
  return source==='input'||!current||now>=current.until||priority>=current.priority;
}

export function noticePriority(event,world){
  if(['down','squad-destroyed','squad-broken'].includes(event.kind)){
    const person=world.actors?.find(a=>a.id===event.defenderId),squad=world.squads?.find(s=>s.id===event.squadId);
    if((person??squad)&&(person??squad).side!=='enemy')return 3;
  }
  return ['phase','reinforcements'].includes(event.kind)?2:1;
}

export function voteConsequence(preview){
  const f=preview?.forecast;if(!f)return '';
  const delta=f.votesAfter-f.votesBefore;
  return delta>0?`Gains ${delta} ${delta===1?'vote':'votes'}.`:delta<0?`Loses ${-delta} ${delta===-1?'vote':'votes'}.`:'No immediate change in votes.';
}
