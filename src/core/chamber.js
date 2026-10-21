import * as G from './game.js';
import {contestIntents,profileOf} from './contest.js';
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

// Talking to someone (left-click): who he is, and each speech the speaker can make
// to him with the 0.38 forecast, from where he stands, or after walking beside him
// when he is in reach. Opens where the speaker stands: nothing here moves anyone.
export function conversation(state,speakerId,personId,{known=false}={}){
  const e=contest(state),sp=unitOf(state,speakerId),p=unitOf(state,personId);if(!e||!sp||!p)return null;
  const who={id:p.id,name:p.name,role:p.role,side:p.side,bloc:p.bloc??null,letter:p.bloc?BLOC_LETTER[p.bloc]??null:null,stance:p.stance??null,
    interest:p.role==='voter'&&known?p.interest:null,resolve:p.role==='speaker'?p.resolve:null,maxResolve:p.role==='speaker'?p.maxResolve:null,
    distance:distance(sp,p),metres:distance(sp,p)*SEAT};
  const kinds=p.role==='voter'?['persuade','promise','threaten','record']:p.side==='enemy'?['denounce','rebut']:['rebut'];
  const actions=G.getActions(state,speakerId),out=[];
  for(const action of kinds){
    if(!actions.includes(action)){out.push({action,name:SPEECH_NAMES[action],ok:false,message:sp.acted?`${sp.name} has spoken this hour.`:`Not yet in this chamber’s speeches.`});continue;}
    const command={unitId:sp.id,action,x:p.x,y:p.y,targetId:p.id},here=G.preview(state,command);
    if(here.ok){out.push({action,name:SPEECH_NAMES[action],ok:true,command,message:here.message,forecast:here.forecast??null});continue;}
    const place=distance(sp,p)>RANGE[action]?walkBeside(state,sp.id,action,p):null,there=place?forecastFrom(state,command,place):null;
    out.push(there?.ok?{action,name:SPEECH_NAMES[action],ok:false,walk:place,command,message:there.message,forecast:there.forecast??null}
      :{action,name:SPEECH_NAMES[action],ok:false,message:here.message});
  }
  return {speaker:{id:sp.id,name:sp.name,spoken:!!sp.acted},person:who,speeches:out,profile:profileOf(e,sp)};
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
// The coalition panel: who is committed, who wavers, who is against, and the promises left; with the Chamber Whip Forecast.
export function coalitionView(state){
  const e=contest(state);if(!e)return null;const members=e.units.filter(u=>u.role==='voter');
  const pick=test=>members.filter(test).map(u=>({id:u.id,name:u.name,bloc:u.bloc,letter:BLOC_LETTER[u.bloc]??null,stance:u.stance}));
  return {committed:pick(u=>u.stance>=3),wavering:pick(u=>u.stance>=1&&u.stance<3),against:pick(u=>u.stance<1),promisesLeft:Math.max(0,2-(e.promises?.length??0)),
    votes:G.voteCount(state),whip:G.coalitionWhipForecast(state)};
}
