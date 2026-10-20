import {chapterOpportunity,applyChapterOpportunity,commandAssignment} from './command-campaign.js';
import {FIELD_THEMES,POLICY_MOTIONS} from '../data/expanded-campaign.js';
import {alive,clamp,distance,note,result,reachable,pathDistance,faceToward} from './shared.js';
export {POLICY_MOTIONS};
export const initialEdition=enabled=>enabled?{featureEdition:31,reforms:[],fieldRecords:[]}:{};
export function enableExpandedCampaign(state){
  if(state.phase!=='camp'||state.encounter||state.featureEdition===31)return result(false,'The expanded campaign can be enabled once, at a camp checkpoint.');
  Object.assign(state,initialEdition(true));return result(true,'Expanded battlefields and policy debates will begin with your next encounter.');
}
const friends=e=>e.units.filter(u=>alive(u)&&['player','ally'].includes(u.side));
const living=e=>e.units.filter(alive);
const valid=(e,p)=>p.x>=0&&p.y>=0&&p.x<e.width&&p.y<e.height&&!['rock','river','wall'].includes(e.terrain[p.y][p.x]);
const coord=p=>`${p.x+1}${String.fromCharCode(65+p.y)}`;
export function initializeExpanded(state){
  if(state.featureEdition!==31)return;
  const e=state.encounter;e.featureEdition=31;
  if(e.kind==='contest'){e.policy={motion:null,terms:null,counter:false,answered:false,changes:[],cost:0};return;}
  const theme=FIELD_THEMES[state.chapter-1];
  e.weather=state.encounterOptions.weather??theme.weather;
  for(const u of e.units){u.cohesion=80;u.suppression=0;}
  for(const reform of state.reforms){
    if(reform.id==='service')for(const u of friends(e))u.cohesion+=reform.terms==='amended'?5:10;
    if(reform.id==='provision')for(const u of e.units.filter(u=>u.role==='escort')){const n=reform.terms==='amended'?1:3;u.hp+=n;u.maxHp+=n;}
  }
  e.field={landmark:theme.landmark,objects:[],choice:null,outcome:'pending',deadline:Math.min(7,e.turnLimit-1)};
  if(e.type==='training')return;
  if(theme.wide){
    e.width=10;for(let y=0;y<e.height;y++)e.terrain[y].push(y===2?'grass':y===5?'river':'rock',y<3?'high':'road');
    e.field.objects.push({id:'gate',kind:'gate',label:'Side gate',x:8,y:2,state:'closed'},
      {id:'bridge',kind:'bridge',label:'Damaged footbridge',x:8,y:5,state:'damaged'});
    e.terrain[5][8]='river';
  }
  const used=new Set(e.field.objects.map(p=>`${p.x},${p.y}`));
  const reserve=(id,kind,label,preferred,status)=>{
    const points=[];for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++){const p={x,y};if(valid(e,p)&&!living(e).some(u=>u.x===x&&u.y===y)&&!used.has(`${x},${y}`)&&distance(p,e.goal)>1)points.push(p);}
    points.sort((a,b)=>distance(a,preferred)-distance(b,preferred)||a.y-b.y||a.x-b.x);
    const p=points[0];if(p){used.add(`${p.x},${p.y}`);e.field.objects.push({id,kind,label,...p,state:status});}
  };
  reserve('stores','stores','Abandoned supply cart',{x:2,y:2},'available');
  reserve('signal','signal','Signal station',{x:3,y:5},'available');
  if(state.chapter>=3){reserve('barricade','barricade','Timber barricade',{x:4,y:2},'intact');
    reserve('brazier','brazier','Pitch brazier',{x:5,y:5},'unlit');}
  note(e,`${theme.landmark}. Recover stores or secure the signal before turn ${e.field.deadline}; only one detachment can be spared.`);
}

export function weatherSummary(e){
  if(e.featureEdition!==31)return '';
  if(e.id.startsWith('ch1-'))return 'Opening drills: normal movement and visibility. Weather and cohesion attack penalties begin after Chapter I.';
  return ({rain:'Rain: climbing high ground costs +1 movement; ranged attacks beyond two tiles deal −1; fire lasts one round.',mist:'Mist: ranged attacks beyond two tiles deal −1.',dust:'Dust: ranged attacks beyond two tiles deal −1.',embers:'Dry heat: pitch fires burn for three rounds; smoke blocks sight through its tiles.',clear:'Clear: normal movement and ranged visibility.'})[e.weather]??'Normal visibility.';
}
export function fieldOptions(state){
  const e=state.encounter;if(e?.featureEdition!==31||e.kind!=='battle')return [];
  return e.field.objects.map(o=>({ ...o,preview:previewFieldAction(state,o.id)}));
}
export function previewFieldAction(state,id){
  const e=state.encounter,o=e?.field?.objects.find(o=>o.id===id),hero=e?.units.find(u=>u.id==='hero');
  if(state.phase!=='encounter'||e?.featureEdition!==31||e.kind!=='battle'||e.status!=='active'||!o||!hero||!alive(hero)||hero.acted)return result(false,'Your commander needs an unspent action in an active battle.');
  if(distance(hero,o)>1)return result(false,`Move beside ${o.label} at ${coord(o)}. Interaction costs one action.`);
  if(['stores','signal'].includes(o.kind)){
    if(e.field.outcome!=='pending'||e.field.choice||e.turn>e.field.deadline)return result(false,'The competing opportunity has closed.');
    const authored=chapterOpportunity(e,id);if(authored)return result(true,`${authored.description} One commander action. The other opportunity closes; the main mission still applies.`);
    return result(true,`${o.kind==='stores'?'Recover 2 supplies on victory':'Raise friendly cohesion by 15 now and earn 2 Army Loyalty on victory'}. One action. The other opportunity closes; the main mission still applies.`);
  }
  const action=o.kind==='gate'&&o.state==='closed'?'Open the gate and its side route':o.kind==='bridge'&&o.state==='damaged'?'Repair the footbridge; the tile becomes a ford':o.kind==='barricade'&&o.state==='intact'?'Dismantle the barricade; adjacent units lose its 1-point protection':o.kind==='brazier'&&o.state==='unlit'?'Ignite pitch: smoke blocks sight, and units within one tile take 2 damage at each round end':o.state==='burning'?'Extinguish the pitch fire and clear its smoke':null;
  return action?result(true,`${action}. Costs one commander action.`):result(false,'This feature has already been resolved.');
}
export function fieldAction(state,id){
  const preview=previewFieldAction(state,id);if(!preview.ok)return preview;
  const e=state.encounter,o=e.field.objects.find(o=>o.id===id),hero=e.units.find(u=>u.id==='hero');
  for(const u of e.units)delete u.moveOrigin;hero.acted=true;
  if(o.kind==='stores'||o.kind==='signal'){
    e.field.choice=o.kind;e.field.outcome='secured';o.state='secured';
    for(const other of e.field.objects.filter(x=>['stores','signal'].includes(x.kind)&&x!==o))other.state='forgone';
    if(applyChapterOpportunity(e,id)){}
    else if(o.kind==='stores')e.staged.supplies=(e.staged.supplies??0)+2;
    else{e.staged.meters.army=(e.staged.meters.army??0)+2;for(const u of friends(e))u.cohesion=clamp((u.cohesion??80)+15);}
  }else if(o.kind==='gate')o.state='open';
  else if(o.kind==='bridge'){o.state='repaired';e.terrain[o.y][o.x]='ford';}
  else if(o.kind==='barricade')o.state='dismantled';
  else if(o.state==='burning'){o.state='spent';delete o.rounds;}
  else{o.state='burning';o.rounds=e.weather==='rain'?1:3;}
  note(e,`${o.label}: ${preview.message}`);return preview;
}
export function expandedHit(e,target,ranged){
  if(e.featureEdition!==31)return;
  target.cohesion=clamp((target.cohesion??80)-(ranged?6:10));
  target.suppression=Math.min(3,(target.suppression??0)+(ranged?1:0));
}
export function expandedCombat(e,unit,target,ranged){
  if(e.featureEdition!==31||e.id.startsWith('ch1-'))return [];
  const modifiers=[];
  if((unit.cohesion??80)<40)modifiers.push({label:'Disrupted cohesion',value:-1});
  if((unit.suppression??0)>=2)modifiers.push({label:'Suppressed',value:-1});
  if(ranged&&distance(unit,target)>2&&['rain','mist','dust'].includes(e.weather))modifiers.push({label:'Poor visibility',value:-1});
  if(e.field?.objects.some(o=>o.kind==='barricade'&&o.state==='intact'&&distance(o,target)<=1))modifiers.push({label:'Timber cover',value:-1});
  return modifiers;
}
export function coordinatedAssignment(e,unit){
  if(e.campaignEdition===34)return commandAssignment(e,unit);
  if(e.featureEdition!==31||unit.side!=='enemy'||e.type==='training'||e.id==='ch1-road')return null;
  const enemy=e.units.filter(u=>u.side==='enemy'&&alive(u)&&!u.hidden).sort((a,b)=>a.id.localeCompare(b.id)),targets=friends(e).filter(u=>!u.hidden);
  const focus=[...targets].sort((a,b)=>a.hp-b.hp||a.id.localeCompare(b.id))[0];if(!focus)return null;
  const index=enemy.findIndex(u=>u.id===unit.id),flank=unit.role==='cavalry'||unit.role==='raider'||index%3===2;
  return {role:unit.role==='archer'?'Suppress':flank?'Flank':'Fix',targetId:focus.id,
    goal:flank?{x:clamp(focus.x+1,0,e.width-1),y:clamp(focus.y+(index%2?2:-2),0,e.height-1)}:focus};
}
export function advanceExpandedBattle(e){
  if(e.featureEdition!==31)return;
  for(const o of e.field.objects.filter(o=>o.state==='burning')){
    for(const u of living(e).filter(u=>distance(u,o)<=1)){u.hp=Math.max(0,u.hp-2);expandedHit(e,u,true);note(e,`${u.name} takes 2 damage from the pitch fire.`);}
    if(--o.rounds<=0){o.state='spent';delete o.rounds;}
  }
  for(const u of living(e)){
    const supported=living(e).some(v=>v.id!==u.id&&(v.side===u.side||['player','ally'].includes(v.side)&&['player','ally'].includes(u.side))&&distance(u,v)<=1);
    u.cohesion=clamp((u.cohesion??80)+(u.braced?12:supported?6:0));
    if(u.braced||supported)u.suppression=Math.max(0,(u.suppression??0)-1);
  }
  if(e.field.outcome==='pending'&&e.turn>=e.field.deadline){e.field.outcome='missed';for(const o of e.field.objects.filter(o=>['stores','signal'].includes(o.kind)))o.state='missed';note(e,'The spare detachment is recalled. The supply and signal opportunities have closed.');}
}

export function moveProtectedColumn(e,escort,hero){
  // A column does not outrun its commander or walk into an adjacent enemy.
  // This is a public escort rule, shared by every enhanced escort mission.
  const enemies=e.units.filter(u=>u.side==='enemy'&&alive(u)&&!u.hidden);
  const points=reachable(e,escort,e.campaignEdition===34?e.commandCampaign.escortPace:2).filter(p=>distance(p,hero)<=3&&!enemies.some(u=>distance(u,p)<=1));
  points.sort((a,b)=>pathDistance(e,a,e.goal,escort.id)-pathDistance(e,b,e.goal,escort.id)||a.cost-b.cost);
  const p=points[0];if(p&&pathDistance(e,p,e.goal,escort.id)<pathDistance(e,escort,e.goal,escort.id)){faceToward(escort,p);escort.x=p.x;escort.y=p.y;escort.moved=true;}
}

const policyById=id=>POLICY_MOTIONS.find(m=>m.id===id);
export function policyOptions(state){
  if(state.encounter?.featureEdition!==31||state.encounter.kind!=='contest')return [];
  return POLICY_MOTIONS.map(m=>({...m,preview:previewPolicy(state,m.id,'original')}));
}
function policyChanges(e,m,terms){
  const secondary=m.id==='provision'?'law':m.id==='service'?'security':'office';
  return e.units.filter(u=>u.role==='voter').map(u=>({id:u.id,name:u.name,from:u.stance,to:clamp(u.stance+(terms==='amended'?(u.interest===m.interest||u.interest===secondary?1:0):u.interest===m.interest?2:u.interest===m.opposition?-1:0),-6,6)})).filter(c=>c.from!==c.to);
}
export function previewPolicy(state,id,terms='original'){
  const e=state.encounter,p=e?.policy,m=policyById(id),hero=e?.units.find(u=>u.id==='hero');
  if(state.phase!=='encounter'||e?.featureEdition!==31||e.kind!=='contest'||e.status!=='active'||!m||!hero||!alive(hero)||hero.acted||!['original','amended'].includes(terms))return result(false,'Your commander needs an unspent speech in an active Contest.');
  if(state.reforms.some(r=>r.id===id))return result(false,'This policy has already been enacted.');
  if(p.motion&&(p.motion!==id||!p.counter||p.answered))return result(false,'Only the pending rival amendment can be answered.');
  if(!p.motion&&terms==='amended')return result(false,'Table the original motion before negotiating an amendment.');
  const cost=terms==='amended'?Math.max(0,m.cost-1):m.cost;
  if(state.supplies+(e.staged.supplies??0)+p.cost<cost)return result(false,`This policy requires ${cost} supplies on victory.`);
  // An amendment reverses only the recorded motion's actual stance deltas;
  // later speeches remain intact, then the revised proposal is applied.
  const units=e.units.map(u=>({...u}));
  if(p.motion&&terms==='amended')for(const c of p.changes){const u=units.find(u=>u.id===c.id);u.stance=clamp(u.stance-(c.to-c.from),-6,6);}
  const adjustments=p.motion&&terms==='original'?[]:policyChanges({...e,units},m,terms);
  const changes=p.motion&&terms==='original'?[]:e.units.filter(u=>u.role==='voter').map(u=>({id:u.id,name:u.name,from:u.stance,to:adjustments.find(c=>c.id===u.id)?.to??units.find(v=>v.id===u.id).stance})).filter(c=>c.from!==c.to);
  return {...result(true,`${p.motion&&terms==='original'?'Defend the original motion':terms==='amended'?m.amendment:m.description} One speech. ${cost} ${cost===1?'supply':'supplies'} and the permanent effect apply only after a won Contest is committed. ${changes.map(c=>`${c.name} ${c.from} → ${c.to}`).join('; ')} ${terms==='original'?m.effect:''}`),cost,changes,adjustments};
}
export function tablePolicy(state,id,terms='original'){
  const checked=previewPolicy(state,id,terms);if(!checked.ok)return checked;
  const e=state.encounter,p=e.policy,answer=!!p.motion;
  for(const u of e.units)delete u.moveOrigin;e.units.find(u=>u.id==='hero').acted=true;
  if(answer&&terms==='amended')for(const c of p.changes){const u=e.units.find(u=>u.id===c.id);u.stance=clamp(u.stance-(c.to-c.from),-6,6);}
  for(const c of checked.adjustments)e.units.find(u=>u.id===c.id).stance=c.to;
  e.staged.supplies=(e.staged.supplies??0)+p.cost-checked.cost;
  Object.assign(p,{motion:id,terms,cost:checked.cost,changes:answer&&terms==='original'?p.changes:checked.adjustments,answered:answer});
  note(e,checked.message);return checked;
}
export function advancePolicy(e){
  const p=e.policy;if(e.featureEdition!==31||!p?.motion||p.counter)return;
  p.counter=true;note(e,`Rival counterproposal — ${policyById(p.motion).amendment} Accept it or defend your original motion with a later speech. If unanswered, the original stands.`);
}
export function commitExpanded(state,e){
  if(e.featureEdition!==31)return;
  if(e.kind==='battle'){
    if(e.type!=='training')state.fieldRecords.push({id:e.id,chapter:state.chapter,choice:e.field.choice,outcome:e.field.outcome==='pending'?'forgone':e.field.outcome});
    if(state.reforms.some(r=>r.id==='audit'&&r.terms==='original'))state.supplies=clamp(state.supplies+1,0,99);
  }else if(e.policy.motion&&!state.reforms.some(r=>r.id===e.policy.motion)){
    const p=e.policy;state.reforms.push({id:p.motion,terms:p.terms,encounter:e.id,chapter:state.chapter});
    const meter={provision:'public',service:'army',audit:'political'}[p.motion];state.meters[meter]=clamp(state.meters[meter]+(p.terms==='amended'?1:3));
    state.log.push(`Enacted ${policyById(p.motion).label} (${p.terms}). ${p.terms==='amended'?policyById(p.motion).amendment:policyById(p.motion).effect}`);
  }
}
export function validateExpanded(state,fail){
  if(state.featureEdition===undefined){if(state.reforms!==undefined||state.fieldRecords!==undefined||state.encounter?.featureEdition!==undefined)fail('unversioned expanded campaign.');return;}
  if(state.featureEdition!==31||!Array.isArray(state.reforms)||state.reforms.length>3||new Set(state.reforms.map(r=>r.id)).size!==state.reforms.length||state.reforms.some(r=>!policyById(r.id)||!['original','amended'].includes(r.terms)||!state.history.some(h=>h.id===r.encounter&&h.kind==='contest'&&h.chapter===r.chapter)))fail('policy record.');
  if(!Array.isArray(state.fieldRecords)||state.fieldRecords.length>25||new Set(state.fieldRecords.map(r=>r.id)).size!==state.fieldRecords.length||state.fieldRecords.some(r=>!state.history.some(h=>h.id===r.id&&h.kind==='battle'&&h.chapter===r.chapter)||![null,'stores','signal'].includes(r.choice)||!['secured','missed','forgone'].includes(r.outcome)))fail('field record.');
  const e=state.encounter;if(!e)return;
  if(e.featureEdition!==31||state.snapshot?.featureEdition!==31)fail('expanded checkpoint.');
  if(e.kind==='battle'){
    const f=e.field;if(!f||typeof f.landmark!=='string'||f.landmark.length>80||!Array.isArray(f.objects)||f.objects.length>6||new Set(f.objects.map(o=>o.id)).size!==f.objects.length||![null,'stores','signal'].includes(f.choice)||!['pending','secured','missed'].includes(f.outcome)||!Number.isInteger(f.deadline)||f.deadline<1||f.deadline>30)fail('battlefield features.');
    const states={gate:['closed','open'],bridge:['damaged','repaired'],barricade:['intact','dismantled'],brazier:['unlit','burning','spent'],stores:['available','secured','forgone','missed'],signal:['available','secured','forgone','missed']};
    for(const o of f.objects)if(!states[o.kind]?.includes(o.state)||o.id!==o.kind||typeof o.label!=='string'||o.label.length>80||!Number.isInteger(o.x)||!Number.isInteger(o.y)||o.x<0||o.y<0||o.x>=e.width||o.y>=e.height||o.state==='burning'&&(!Number.isInteger(o.rounds)||o.rounds<1||o.rounds>3))fail('battlefield object.');
    for(const u of e.units)if(u.cohesion!==undefined&&(!Number.isInteger(u.cohesion)||u.cohesion<0||u.cohesion>100)||u.suppression!==undefined&&(!Number.isInteger(u.suppression)||u.suppression<0||u.suppression>3))fail('cohesion.');
  }else{
    const p=e.policy;
    if(!p||p.motion!==null&&!policyById(p.motion)||![null,'original','amended'].includes(p.terms)||typeof p.counter!=='boolean'||typeof p.answered!=='boolean'||!Number.isInteger(p.cost)||p.cost<0||p.cost>2||!Array.isArray(p.changes)||p.changes.length>13||new Set(p.changes.map(c=>c.id)).size!==p.changes.length||p.changes.some(c=>!e.units.some(u=>u.id===c.id&&u.role==='voter')||![c.from,c.to].every(n=>Number.isInteger(n)&&n>=-6&&n<=6)))fail('policy debate.');
    if(p.motion===null){if(p.terms!==null||p.cost!==0||p.counter||p.answered||p.changes.length)fail('unopened policy debate.');}
    else{
      const m=policyById(p.motion),cost=p.terms==='amended'?Math.max(0,m.cost-1):m.cost;
      if(p.terms===null||p.cost!==cost||p.answered&&!p.counter||p.terms==='amended'&&!p.answered)fail('policy terms.');
    }
  }
}
