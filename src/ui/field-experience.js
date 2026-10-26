import {ABILITIES, TIME} from '../data/realtime-rules.js';

// Shared, read-only guidance for every mission. Nothing here changes the rules.
export function missionAbilities(world){
  const m=world?.mission??{};
  const ids=new Set(m.required??[]);
  if(['defection','settlement'].includes(m.mode))ids.add('rally');
  if(m.mode==='recover')ids.add('scout');
  if(m.rescue||m.mode==='extract'){ids.add('bind_wounds');ids.add('carry');}
  return [...ids];
}

export function missionAbilityHint(world,id){
  if(id==='rally'&&world.mission?.mode==='defection')return `Win allegiance: Rally within ${(world.mission.radius??7.5)*3} m of a rival formation to weaken its morale. Three pledges, or defeating the remaining rivals, wins.`;
  if(id==='rally'&&world.mission?.mode==='settlement')return 'Rally beside the claimant with your envoy present, then protect the meeting for two rounds.';
  return ABILITIES[id]?.summary??'';
}

export function victoryReason(world){
  const m=world.mission??{},points=m.points??[];
  switch(m.mode){
    case 'training':return 'You demonstrated movement, attack, defence and the pilum.';
    case 'defection':return (m.defections??0)>=Math.min(3,m.rivals??3)?'The rival formations pledged their allegiance.':'The remaining opposition was defeated; your pledges are recorded.';
    case 'settlement':return 'The envoy reached the claimant and the protected meeting held.';
    case 'surrender':return 'Both approaches were secured and the claimant accepted your arrival.';
    case 'extract':return 'Your soldier and the protected survivors reached safety.';
    case 'recover':return 'The records were recovered after scouting the ground.';
    case 'hold':return 'Your company held the position for the required time.';
    case 'capture':case 'supply':return `${points.length} required positions secured${m.mode==='supply'?' and the stores protected':''}.`;
    default:return 'The enemy force was defeated. Your company holds the field.';
  }
}

export function fieldNotice(world,event){
  if(event.kind==='oath-heard')return {title:'The oath was heard',body:`${event.name}: morale ${event.morale}. Keep pressure on the formation; another Rally can turn its allegiance.`};
  if(event.kind==='field'&&event.what==='opportunity')return {title:'Opportunity secured',body:`${event.label}. This choice is recorded; the other opportunity is now closed.`};
  if(event.kind==='phase')return {title:'New objective',body:event.label};
  if(event.kind==='pledge')return {title:'Allegiance won',body:`${event.name} ${event.joined?'joins your side':'leaves the field'}.`};
  if(event.kind==='reinforcements')return {title:'Reinforcements',body:'A new enemy force has arrived. Check the approach before advancing.'};
  if(event.kind==='squad-destroyed'){
    const s=world.squads?.find(s=>s.id===event.squadId);
    if(s?.side!=='enemy')return {title:'Formation lost',body:`${s?.name??'An allied formation'} has been cut down.`};
  }
  if(event.kind==='field'&&event.what!=='brazier-burns'){
    const line=world.log.findLast(l=>l.tick===event.tick&&/gate|bridge|barricade|pitch|opportunit|secures|wall|works|siege|mine/i.test(l.text));
    if(line)return {title:event.what==='opportunities-closed'?'Opportunity closed':'The battlefield changed',body:line.text};
  }
  return null;
}

export function opportunityReadout(world){
  const works=(world.objects??[]).filter(o=>['countermine','siege-engine'].includes(o.kind));
  if(world.status==='active'&&works.some(o=>!o.done))return `Siege works · ${works.filter(o=>o.done).length}/${works.length} secured · protect the line`;
  const f=world.field;if(!f||f.choice||f.outcome==='missed'||world.status!=='active')return '';
  const seconds=Math.max(0,Math.ceil((f.deadline*TIME.roundTicks-world.tick)/TIME.ticksPerSecond));
  return seconds>0?`Optional opportunity · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} left`:'';
}

export function enemyCue(world,target){
  if(!target||target.side!=='enemy'||!target.alive||target.hidden)return '';
  const action=target.action,contact=action?.contact??action?.release;
  if(action&&['swing','throw','shot','bash'].includes(action.kind))return world.tick<(contact??(action.start+action.end)/2)?'Winding up · brace or step aside':'Recovering · an opening to strike';
  if((target.ai?.retreatUntil??0)>world.tick)return 'Falling back · pursue or throw a pilum';
  const q=world.squads?.find(q=>q.id===target.squadId);
  if(q?.broken)return 'Formation broken · press the advantage';
  if(['cavalry','heavy'].includes(target.role))return 'Mounted threat · brace your line and protect its flank';
  if(target.role==='archer')return 'Missile threat · use cover or close the gap';
  if(target.braceUntil>world.tick)return 'Braced · flank the shield or wait for an opening';
  return q?.plan?.intent??'Watch his facing · a flank bypasses his shield';
}

export function delegateVoice(person){
  if(person.role!=='voter')return person.resolve<=0?'I have said all I can. The chamber must decide.':person.side==='enemy'?'A fine speech. Now show the chamber what stands behind it.':'You have my voice. Tell me where it will count.';
  if(person.stance>=3)return 'You have made your case. I will stand with you when the chamber divides.';
  if(person.stance<=-3)return 'Promises alone will not move me. Give me a reason to trust this course.';
  const interests={Veterans:'My men remember who stood beside them. What will this mean for their service?',Landholders:'Land must be worked and families fed. How will your proposal protect them?',Civic:'The people will live with this decision long after we leave this room.'};
  return interests[person.bloc]??'I am listening. Show me how your proposal serves Rome.';
}
