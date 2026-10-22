import * as G from './game.js';
import {INTEREST_EFFECTS,contestActions,contestIntents,profileOf} from './contest.js';
import {BLOC_AFFINITIES} from '../data/contest-balance.js';
import {alive,distance,reachable,result,unitAt} from './shared.js';

// The walk-and-talk Curia (build brief §3.11; guide "Political Contests"): the
// 0.38 Contest engine stays the rules, and this is how a chamber presents it.
// Seats are 2 m apart, so a 0.38 tile is 2 m and its distances are 0.38's:
// adjacent is within 2 m, two tiles 4 m, three tiles 6 m. An hour is a 0.38
// turn. In it each of the player's speakers may walk anywhere in his reach
// (the places his 0.38 move reaches, measured along the aisles) and make one
// speech; the hour ends when every speaker still standing has spoken, or when
// the player yields the floor, and the rivals then take theirs. A walk is a
// 0.38 move from where he stood when the hour began (a second walk takes the
// first back, as 0.38's Undo does), so the rules see one move and one speech.
// Pure: every change goes through the 0.38 commands, which check it.

export const SEAT=2;
export const seatPoint=({x,y})=>({x:(x+.5)*SEAT,z:(y+.5)*SEAT});
export const seatAt=p=>({x:Math.floor(p.x/SEAT),y:Math.floor(p.z/SEAT)});
// A bloc by its letter as well as its toga trim (guide "Blocs and interests").
export const BLOC_LETTER=Object.freeze({Veterans:'V',Landholders:'L',Civic:'C',Chamber:'Ch'});
// Speeches, as the chamber names them and in the bar's order (1–0 and S).
export const SPEECHES=Object.freeze(['persuade','promise','threaten','address','rebut','record','denounce']);
export const SPEECH_NAMES=Object.freeze({persuade:'Persuade',promise:'Promise',threaten:'Threaten',address:'Address the Chamber',rebut:'Rebut',record:'Invoke Record',denounce:'Denounce'});
// How far each speech reaches (0.38 tiles; Address takes every member within 3 of the speaker).
const RANGE=Object.freeze({persuade:1,promise:2,threaten:2,record:3,denounce:3,rebut:3,address:3});
export const SPEECH_REACH=RANGE;

const contest=state=>state?.phase==='encounter'&&state.encounter?.kind==='contest'?state.encounter:null;
const ours=u=>u?.role==='speaker'&&['player','ally'].includes(u.side);
const unitOf=(state,id)=>contest(state)?.units.find(u=>u.id===id)??null;
const active=state=>contest(state)?.status==='active';

// The player's speakers this hour: who still stands, who has spoken, and who may still walk.
export function speakers(state){
  const e=contest(state);if(!e)return [];
  return e.units.filter(ours).map(u=>({id:u.id,name:u.name,standing:alive(u),spoken:!!u.acted,moved:!!u.moved,
    canWalk:alive(u)&&active(state)&&(!u.moved||G.canUndoMove(state,u.id).available),resolve:u.resolve,maxResolve:u.maxResolve,x:u.x,y:u.y}));
}
export function hourView(state){
  const e=contest(state);if(!e)return null;const v=G.voteCount(state);
  return {hour:e.turn,of:e.turnLimit,status:e.status,speakers:speakers(state),votes:v,ended:hourDone(state)};
}
// Every speaker still standing has spoken: the hour is over.
export const hourDone=state=>{const e=contest(state);return !!e&&e.units.filter(u=>ours(u)&&alive(u)).every(u=>u.acted);};

// Where a speaker may stand this hour: the place he stood when it began and the
// places his 0.38 move reaches from there; only where he stands once his move is
// spent and can no longer be taken back.
export function reach(state,unitId){
  const e=contest(state),u=unitOf(state,unitId);if(!e||!ours(u)||!alive(u)||!active(state))return [];
  if(u.moved&&!G.canUndoMove(state,u.id).available)return [{x:u.x,y:u.y,cost:0}];
  const origin=u.moved?u.moveOrigin:{x:u.x,y:u.y},from={...u,x:origin.x,y:origin.y};
  const enc={...e,units:e.units.map(v=>v.id===u.id?from:v)};
  // Three tiles, as 0.38's contestTargets allows every speaker; and where he began.
  return [{x:origin.x,y:origin.y,cost:0},...reachable(enc,from,3).filter(p=>p.cost>0).map(p=>({x:p.x,y:p.y,cost:p.cost}))];
}
export const inReach=(state,unitId,tile)=>reach(state,unitId).some(p=>p.x===tile.x&&p.y===tile.y);

// Walk a speaker to a place in his reach: the 0.38 move from where he began the
// hour (taking back a move already made). Refused, it changes nothing.
export function walk(state,unitId,tile){
  const u=unitOf(state,unitId);if(!u||!ours(u))return result(false,'Choose one of your speakers.');
  if(!active(state))return result(false,'The session is over.');
  if(!Number.isInteger(tile?.x)||!Number.isInteger(tile?.y)||!inReach(state,unitId,tile))return {...result(false,'Outside his reach this hour.'),reason:'OUTSIDE_REACH'};
  if(u.x===tile.x&&u.y===tile.y)return result(true,`${u.name} stays where he stands.`);
  if(u.moved){const back=G.undoMove(state,unitId);if(!back.ok)return back;if(u.x===tile.x&&u.y===tile.y)return result(true,`${u.name} walks back to where he began the hour.`);}
  return G.act(state,{unitId,action:'move',x:tile.x,y:tile.y});
}

// A speech: a 0.38 Contest command ({unitId, action, x, y, targetId}) or one of
// the hero's other speeches ({kind:'case'|'policy'|'agreement'|'precedent', …}).
// When every speaker still standing has spoken, the hour ends and the rivals
// take theirs: the result says so and carries what they did.
export function speak(state,command){
  if(!active(state))return result(false,'The session is over.');
  if(command?.action==='move')return result(false,'Walk to a place instead: a speech is not a move.');
  const done=special(state,command)??G.act(state,command);if(!done.ok)return done;
  if(!hourDone(state)||!active(state))return {...done,hourEnded:false};
  const ended=endHour(state);return {...done,hourEnded:true,events:ended.events,status:ended.status};
}
function special(state,c){
  if(c?.kind==='case')return G.presentCase(state,c.id);
  if(c?.kind==='policy')return G.tablePolicy(state,c.id,c.terms??'original');
  if(c?.kind==='agreement')return G.negotiateAgreement(state,c.targetId,c.terms);
  if(c?.kind==='precedent')return G.invokePrecedent(state,c.id);
  return null;
}
// Yield the floor (Y): the hour ends now; a speech not yet given is lost.
export function yieldFloor(state){if(!active(state))return result(false,'The session is over.');return endHour(state);}
function endHour(state){
  const before=contest(state).turn,r=G.endTurn(state);if(!r.ok)return r;const e=state.encounter;
  return {...r,events:[...(e.turnEvents??[])],status:e.status,hour:e.status==='active'?e.turn:before};
}

// The 0.38 forecast of a speech if the speaker first walks to `tile` (or stays): pure.
export function forecastFrom(state,command,tile=null){
  const u=unitOf(state,command?.unitId);if(!u)return result(false,'Choose one of your speakers.');
  if(!tile||tile.x===u.x&&tile.y===u.y)return G.preview(state,command);
  if(!inReach(state,u.id,tile))return {...result(false,'Outside his reach this hour.'),reason:'OUTSIDE_REACH'};
  const copy=G.deserialize(G.serialize(state)),w=copy.encounter.units.find(v=>v.id===u.id);w.x=tile.x;w.y=tile.y;w.moved=true;
  return G.preview(copy,{...command,...(command.targetId===u.id||command.action==='address'?{x:tile.x,y:tile.y}:{})});
}

// The nearest place in his reach from which the speech reaches its target (or null).
export function walkBeside(state,unitId,action,target){
  const u=unitOf(state,unitId),t=typeof target==='string'?unitOf(state,target):target;if(!u||!t||!RANGE[action])return null;
  const places=reach(state,unitId).filter(p=>distance(p,t)<=RANGE[action]&&!(unitAt(contest(state),p.x,p.y,u.id)));
  return places.sort((a,b)=>a.cost-b.cost||distance(a,u)-distance(b,u)||a.y-b.y||a.x-b.x)[0]??null;
}

// A refusal that says what the player can change. The same read-only wording
// serves conversations, pointer forecasts and keyboard targets; none of them
// spends a speech or silently walks the speaker.
export function speechProblem(state,speakerId,action,personId,preview=null){
  const e=contest(state),sp=unitOf(state,speakerId),p=typeof personId==='string'?unitOf(state,personId):personId;
  if(!e||!sp)return 'Choose one of your speakers.';
  if(!active(state))return 'The session is over.';
  if(!alive(sp))return `${sp.name} has withdrawn. His vote still counts; choose another standing speaker.`;
  if(sp.acted)return `${sp.name} has spoken this hour. Switch to a speaker who has not spoken, or yield the floor. No extra speech is spent.`;
  if(p&&['persuade','promise','threaten','record'].includes(action)&&p.role!=='voter')return `${SPEECH_NAMES[action]} needs a voting member. ${p.name} is a speaker. No speech is spent.`;
  if(p&&action==='denounce'&&(p.role!=='speaker'||p.side!=='enemy'))return 'Denounce needs an opposition speaker. Choose a rival; no speech is spent.';
  if(p&&action==='rebut'&&p.role!=='speaker')return 'Rebut needs a speaker: restore a friend’s Resolve or blunt a rival’s reply. No speech is spent.';
  if(p?.role==='speaker'&&!alive(p))return `${p.name} has withdrawn. Choose a standing speaker; no speech is spent.`;
  if(action==='promise'&&e.promises?.includes(p?.id))return `${p.name} already has your promise. Choose another argument; no speech is spent.`;
  if(action==='promise'&&e.promises?.length>=2)return 'Both promises have been used in this Contest. Choose another argument; no speech is spent.';
  if(action==='record'&&e.recordUses?.includes(p?.id))return `${p.name} has already heard your Record in this Contest. Choose another argument; no speech is spent.`;
  if(action==='address'&&e.cooldowns?.[`${sp.id}:address`]>e.turn)return `Address the Chamber recovers on hour ${e.cooldowns[`${sp.id}:address`]}. Choose another speech.`;
  if(p&&RANGE[action]&&distance(sp,p)>RANGE[action]){
    const metres=distance(sp,p)*SEAT,range=RANGE[action]*SEAT,place=walkBeside(state,sp.id,action,p);
    return `${p.name} is ${metres} m away; ${SPEECH_NAMES[action]} reaches ${range} m. `+
      (place?`Walk ${place.cost*SEAT} m along the aisle first using Walk beside him. `
        :`${sp.name} cannot reach speaking distance this hour. Move closer within the highlighted area and speak next hour, or choose a nearer delegate. `)+
      'No speech is spent.';
  }
  return preview?.message??'Choose a legal recipient for this speech. No speech is spent.';
}

// Talking to someone (left-click): who he is, and each speech the speaker can make
// to him with the 0.38 forecast, from where he stands, or after walking beside him
// when he is in reach. Opens where the speaker stands: nothing here moves anyone.
export function conversation(state,speakerId,personId,{known=false}={}){
  const e=contest(state),sp=unitOf(state,speakerId),p=unitOf(state,personId);if(!e||!sp||!p)return null;
  const who={id:p.id,name:p.name,role:p.role,side:p.side,bloc:p.bloc??null,letter:p.bloc?BLOC_LETTER[p.bloc]??null:null,stance:p.stance??null,
    interest:p.role==='voter'&&known?p.interest:null,resolve:p.role==='speaker'?p.resolve:null,maxResolve:p.role==='speaker'?p.maxResolve:null,
    distance:distance(sp,p),metres:distance(sp,p)*SEAT};
  const taught=knownSpeeches(state,speakerId),kinds=(p.role==='voter'?['persuade','promise','threaten','record']:p.side==='enemy'?['denounce','rebut']:['rebut']).filter(a=>taught.includes(a));
  const actions=G.getActions(state,speakerId),out=[];
  for(const action of kinds){
    if(!actions.includes(action)){out.push({action,name:SPEECH_NAMES[action],ok:false,message:speechProblem(state,sp.id,action,p)});continue;}
    const command={unitId:sp.id,action,x:p.x,y:p.y,targetId:p.id},here=G.preview(state,command);
    if(here.ok){out.push({action,name:SPEECH_NAMES[action],ok:true,command,message:here.message,forecast:here.forecast??null});continue;}
    const place=distance(sp,p)>RANGE[action]?walkBeside(state,sp.id,action,p):null,there=place?forecastFrom(state,command,place):null;
    out.push(there?.ok?{action,name:SPEECH_NAMES[action],ok:false,walk:place,command,message:there.message,forecast:there.forecast??null}
      :{action,name:SPEECH_NAMES[action],ok:false,message:speechProblem(state,sp.id,action,p,here)});
  }
  return {speaker:{id:sp.id,name:sp.name,spoken:!!sp.acted},person:who,speeches:out,profile:profileOf(e,sp)};
}
// What moves a member, once his interest is known: of the speeches the speaker
// knows, those his interest and bloc favour most and least.
export function interestNote(interest,bloc,known=SPEECHES){
  const effects=INTEREST_EFFECTS[interest];if(!effects)return '';
  const score=a=>(effects[a]??2)+(BLOC_AFFINITIES[bloc]?.[a]??0),list=Object.keys(effects).filter(a=>known.includes(a)).sort((a,b)=>score(b)-score(a)||SPEECHES.indexOf(a)-SPEECHES.indexOf(b));
  if(list.length<2||score(list[0])===score(list.at(-1)))return '';
  const names=xs=>xs.length<2?SPEECH_NAMES[xs[0]]:`${xs.slice(0,-1).map(a=>SPEECH_NAMES[a]).join(', ')} and ${SPEECH_NAMES[xs.at(-1)]}`;
  return `Moved most by ${names(list.filter(a=>score(a)===score(list[0])))}; least by ${names(list.filter(a=>score(a)===score(list.at(-1))))}.`;
}
// Ask about his interests: free, takes no time and changes nothing (0.38 Inspect).
export function askInterests(state,personId){
  const p=unitOf(state,personId);if(!p||p.role!=='voter')return result(false,'Only members have interests to ask about.');
  return {...result(true,`${p.name} (${p.bloc}): his interest is ${p.interest}.`),interest:p.interest};
}

// Where each rival means to walk and whom he means to speak to next (U), as 0.38 plans it.
export function rivalWalks(state){
  const e=contest(state);if(!e)return [];
  return contestIntents(state).map(plan=>{const r=e.units.find(u=>u.id===plan.unitId);
    return {id:plan.unitId,name:r?.name??plan.unitId,action:plan.action,targetId:plan.targetId,from:r?{x:r.x,y:r.y}:plan.destination,to:plan.destination,message:plan.message};});
}
// The speeches the chamber has taught a speaker, spoken this hour or not (0.38
// contestActions for a fresh hour): Persuade; Promise and Threaten from Chapter
// VIII; Address and Rebut from X; Invoke Record and Denounce from XI. The bar's order.
export function knownSpeeches(state,unitId){
  const e=contest(state),u=unitOf(state,unitId);if(!e||!ours(u))return [];
  const fresh={...state,encounter:{...e,status:'active',cooldowns:{}}},probe={...u,acted:false,moved:true,resolve:Math.max(1,u.resolve??1),hp:Math.max(1,u.hp??1)};
  return SPEECHES.filter(a=>contestActions(fresh,probe).includes(a));
}
// T in a chamber: the members and the rival speakers, nearest first; Shift+T the speakers on your side.
export function chamberTargets(state,fromId,{friends=false}={}){
  const e=contest(state),from=unitOf(state,fromId);if(!e||!from)return [];
  return e.units.filter(u=>u.id!==fromId&&(friends?ours(u):u.role==='voter'||u.side==='enemy'&&u.role==='speaker'))
    .sort((a,b)=>distance(a,from)-distance(b,from)||a.y-b.y||a.x-b.x).map(u=>u.id);
}
const signed=n=>`${n>0?'+':''}${n}`;
// A forecast in one line: the votes, then each stance and Resolve it changes.
export function forecastLine(preview){
  const f=preview?.forecast;if(!f)return preview?.message??'';
  const changes=[...f.stanceChanges.map(c=>`${c.name} ${signed(c.from)} → ${signed(c.to)}`),...f.resolveChanges.map(c=>`${c.name} ${c.from} → ${c.to} Resolve`)];
  return `Support ${f.votesBefore} → ${f.votesAfter}${changes.length?` · ${changes.join(', ')}`:' · blunts his next speech'}${f.publicCost?` · −${f.publicCost} Public Confidence`:''}`;
}
// Every chamber action as lists, for the Command list (guide "Accessibility"):
// each speech the speaker can give now, with its forecast; the walks that bring
// a member into reach; talking to each person; and yielding the hour. Each
// option's command is one the page applies through the chamber's rules.
export function chamberOptions(state,speakerId){
  const e=contest(state),sp=unitOf(state,speakerId);if(!e||!ours(sp)||!active(state))return [];
  const out=[],actions=G.getActions(state,speakerId),name=id=>unitOf(state,id)?.name??id;
  if(!alive(sp))return [{group:'The hour',label:`${sp.name} has withdrawn`,detail:'',reason:'WITHDRAWN',message:'At 0 Resolve a speaker cannot speak; his vote still counts.'},yieldOption()];
  for(const action of knownSpeeches(state,speakerId)){
    if(!actions.includes(action)){out.push({group:'Speeches',label:SPEECH_NAMES[action],detail:'',reason:'SPENT',
      message:sp.acted?`${sp.name} has spoken this hour.`:action==='address'?`Address recovers on hour ${e.cooldowns[`${sp.id}:address`]}.`:'Not now.'});continue;}
    const targets=G.getTargets(state,speakerId,action);
    if(!targets.length){out.push({group:'Speeches',label:SPEECH_NAMES[action],detail:'',reason:'NO_TARGET',message:'No one in reach: walk closer first.'});continue;}
    for(const t of targets){
      const command={unitId:speakerId,action,x:t.x,y:t.y,...(action==='address'?{}:{targetId:t.unitId})},p=G.preview(state,command);
      out.push({group:'Speeches',label:action==='address'?SPEECH_NAMES.address:`${SPEECH_NAMES[action]} ${name(t.unitId)}`,detail:forecastLine(p),
        ...(p.ok?{command:{kind:'speak',command}}:{reason:'REFUSED',message:p.message})});
    }
  }
  // Walks that bring a member within Persuade's reach (or a rival within Denounce's).
  if(!sp.acted)for(const u of e.units.filter(u=>u.role==='voter'||u.side==='enemy'&&u.role==='speaker'&&alive(u))){
    const action=u.role==='voter'?'persuade':'denounce';if(!knownSpeeches(state,speakerId).includes(action)||distance(sp,u)<=RANGE[action])continue;
    const place=walkBeside(state,speakerId,action,u);if(!place)continue;
    out.push({group:'Walk',label:`Walk beside ${u.name}`,detail:`For ${SPEECH_NAMES[action]}: ${place.cost} ${place.cost===1?'place':'places'} along the aisle`,command:{kind:'walk',unitId:speakerId,tile:{x:place.x,y:place.y}}});
  }
  for(const id of chamberTargets(state,speakerId))out.push({group:'Talk',label:`Talk to ${name(id)}`,detail:`${distance(sp,unitOf(state,id))*SEAT} m`,command:{kind:'talk',personId:id}});
  out.push(...motionOptions(state,speakerId),yieldOption());
  return out;
}
const yieldOption=()=>({group:'The hour',label:'Yield the floor',detail:'The hour ends now; a speech not yet given is lost',command:{kind:'yield'}});

// A hearing's documents (guide "Hearings and evidence"): the documented cases that the
// soldier's earlier service, choices and surviving witnesses have earned for this
// Contest, each with every member's exact change. Inspecting one costs nothing;
// presenting it spends the soldier's own speech, once a hearing.
export function hearingDocuments(state){
  const e=contest(state);if(!e)return [];
  const options=G.caseOptions(state).filter(c=>c.earned),hero=e.units.find(u=>u.id==='hero'),used=e.commandCampaign?.case??null;let fresh=null;
  return options.map(c=>{
    // Inspecting shows each member's exact change whatever the hour holds: as if the soldier's speech were unspent.
    let p=c.preview;if(!p.ok&&!used){fresh??=unspent(state);p=G.previewCase(fresh,c.id);}
    const reason=c.preview.ok?null:used===c.id?'Presented in this hearing.':used?'One document a hearing has been presented.':hero&&!alive(hero)?'Your soldier has withdrawn.'
      :hero?.acted?'Your soldier has spoken this hour.':c.preview.message;
    return {id:c.id,label:c.label,description:c.description,interest:c.interest,opposition:c.opposition,presented:used===c.id,ok:c.preview.ok,message:reason??c.preview.message,
      reason,changes:p.changes??[],netVotes:p.netVotes??0};
  });
}
function unspent(state){const copy=G.deserialize(G.serialize(state)),h=copy.encounter.units.find(u=>u.id==='hero');if(h){h.acted=false;if(!alive(h)){h.resolve=1;h.hp=1;}}return copy;}
// A Contest with documented cases is a hearing: a presiding magistrate receives the evidence.
export const isHearing=state=>!!contest(state)&&G.caseOptions(state).length>0;
const caseLine=d=>`${d.reason?`${d.reason} `:''}${d.changes.length||d.ok?`${d.netVotes>=0?'+':''}${d.netVotes} ${Math.abs(d.netVotes)===1?'vote':'votes'} · ${d.changes.map(c=>`${c.name} ${signed(c.from)} → ${signed(c.to)}`).join(', ')||'no stance moves'}`:''}`.trim();
export const documentLine=caseLine;
// The motion (guide "Policy debates"): one policy motion a Contest, tabled by the soldier's
// speech; after the rivals' next hour their amendment may be accepted or the original
// defended (each a speech), or left unanswered. With the career precedents.
export function motionView(state){
  const e=contest(state);if(!e)return null;
  const p=e.policy,m=p?.motion?G.POLICY_MOTIONS.find(x=>x.id===p.motion):null;
  const policy=e.featureEdition!==31||!p?null:m?{tabled:{id:m.id,label:m.label,terms:p.terms,effect:p.terms==='amended'?m.amendment:m.effect,amendment:m.amendment,
      awaiting:!!p.counter&&!p.answered,answered:!!p.answered,original:G.previewPolicy(state,m.id,'original'),amended:G.previewPolicy(state,m.id,'amended')},options:[]}
    :{tabled:null,options:G.policyOptions(state).map(x=>({id:x.id,label:x.label,description:x.description,effect:x.effect,preview:x.preview}))};
  const precedents=e.politicsVersion===2?G.precedentOptions(state):null;
  return {policy,precedents:precedents?.motions?.length?precedents:null};
}
// The motion, the precedents and the evidence as Command list options (the soldier's speech each).
function motionOptions(state,speakerId){
  if(speakerId!=='hero')return [];
  const v=motionView(state),out=[],speak=(group,label,detail,ok,message,command)=>out.push({group,label,detail,...(ok?{command:{kind:'speak',command}}:{reason:'REFUSED',message})});
  if(v?.policy?.tabled?.awaiting){const t=v.policy.tabled;
    speak('The motion',`Defend the original motion: ${t.label}`,t.original.message,t.original.ok,t.original.message,{kind:'policy',id:t.id,terms:'original'});
    speak('The motion',`Accept the amendment: ${t.label}`,t.amended.message,t.amended.ok,t.amended.message,{kind:'policy',id:t.id,terms:'amended'});}
  for(const m of v?.policy?.options??[])speak('The motion',`Table the motion: ${m.label}`,m.preview.message,m.preview.ok,m.preview.message,{kind:'policy',id:m.id,terms:'original'});
  for(const m of v?.precedents?.motions??[])if(m.unlocked)speak('Precedents',m.label,m.summary,m.available,m.available?'':v.precedents.used?`Invoked this Contest: ${v.precedents.used}.`:'Not now.',{kind:'precedent',id:m.id});
  for(const d of hearingDocuments(state))speak('Evidence',`Present evidence: ${d.label}`,caseLine(d),d.ok,d.message,{kind:'case',id:d.id});
  return out;
}

// The coalition panel: who is committed, who wavers, who is against, and the promises left; with the Chamber Whip Forecast.
export function coalitionView(state){
  const e=contest(state);if(!e)return null;const members=e.units.filter(u=>u.role==='voter');
  const pick=test=>members.filter(test).map(u=>({id:u.id,name:u.name,bloc:u.bloc,letter:BLOC_LETTER[u.bloc]??null,stance:u.stance}));
  return {committed:pick(u=>u.stance>=3),wavering:pick(u=>u.stance>=1&&u.stance<3),against:pick(u=>u.stance<1),promisesLeft:Math.max(0,2-(e.promises?.length??0)),
    votes:G.voteCount(state),whip:G.coalitionWhipForecast(state)};
}
