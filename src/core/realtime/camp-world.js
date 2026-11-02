import {campFor,CAMP_PLACES,campPlaceName,campPersonPresent,campPersonSpot} from '../../data/camps.js';
import {CAMP_CONTEXT,CAMP_FIELD_DETAILS} from '../../data/camp-regions.js';
import {CHAPTERS} from '../../data/campaign.js';
import {createWorld} from './simulation.js';
import {FINE,layoutFor,upsampleTerrain,soldierSpec} from './campaign-encounter.js';
import {actorById,distanceBetween} from './abilities.js';
import {activityCampView,companyActivities} from '../company-activities.js';
import {campContainerView} from '../soldier.js';
import {containerById} from '../../data/containers.js';

const campView=state=>{const camp=campFor(state.chapter);return camp?{...camp,...activityCampView(state,camp)}:null;};
// A camp container's state, read from the chronicle (release 11): locked, empty,
// and hidden until something has been taken from it or its lock opened.
function containerState(state,o){
  const view=campContainerView(state,o.container);if(!view)return {container:o.container,locked:false,empty:true,hidden:false};
  return {container:o.container,locked:!view.unlocked,empty:view.empty,hidden:!!view.container.hidden&&!view.touched,opened:view.touched};
}
// Release 14: the way out of camp to the next encounter, used like any other object (the soldier walks to it
// and uses it; nothing happens by passing it): the road beyond the gate for a battle, the drill yard for
// Chapter I's drill, the river gate for Chapter V's second battle and a door for a Contest, the Curia's in the
// Senate's chapters. Derived from the chronicle, never saved; the page leaves by it with the same departure
// as the gate's March out, so its rules and refusals are the 0.38 departure's.
const lead=title=>title.replace(/^The /,'the ');
export function campExitFor(state){
  const camp=state?.phase==='camp'?campFor(state.chapter):null,data=camp?CHAPTERS.find(c=>c.id===state.chapter)?.encounters[state.encounterIndex]:null;
  if(!data)return null;
  const way=(name,verb,hint,place,at)=>({id:'exit',kind:'exit',name,verb,hint,place,at:camp.exits?.[data.id]??at,to:data.id,area:data.title});
  if(data.id==='ch1-training')return way('The drill yard','Go to','Varro’s drill begins there.','drill',[0,3]);
  if(data.id==='ch5-wall')return way('The river gate','Go out by',`On to ${lead(data.title)}.`,'principia',[0,-3.5]);
  if(data.kind==='contest')return way(state.chapter>=11?'The Curia door':'The principia door','Enter by',`The session: ${data.title}.`,'principia',[0,-3]);
  // The road: 2.8 m beyond the gate, the way the gate stands from its place (a camp's `exits` may say otherwise).
  const [gx,gz]=camp.objects.find(o=>o.id==='gate')?.at??[0,1.6],d=Math.hypot(gx,gz)||1,far=d+2.8;
  return way('The road out','Take',`On to ${lead(data.title)}.`,'gate',[+(gx/d*far).toFixed(2),+(gz/d*far).toFixed(2)]);
}
// The scenery's view of an interaction is fixed for the camp: a chest's place and
// kind, never whether it is open (the live stage draws that), so opening one
// never rebuilds the camp's scenery.
const interactionOf=(state,o,point)=>({id:o.id,kind:o.kind,name:o.name,...point(o.place,o.at),...(o.container?{container:o.container,box:containerById(o.container)?.kind??'chest'}:{})});
// The camp's objects and, at its place, the way out to the next encounter (the scenery draws it: release 14).
const interactionsOf=(state,camp,point)=>{const exit=campExitFor(state);
  return [...camp.objects.map(o=>interactionOf(state,o,point)),...(exit?[{id:exit.id,kind:'exit',name:exit.name,way:exit.to,...point(exit.place,exit.at)}]:[])];};
// The armourer's forge stands behind him, away from the place's centre the soldier comes from,
// turned a little to one side if the place's objects or people stand there.
function smithyOf(camp,point){
  const smith=camp.people.find(p=>p.id==='smith');if(!smith)return null;
  const at=point(smith.place,smith.at),centre=point(smith.place),dx=at.x-centre.x,dz=at.z-centre.z,d=Math.hypot(dx,dz)||1;
  const others=[...camp.objects.map(o=>point(o.place,o.at)),...camp.people.filter(p=>p!==smith&&p.place).map(p=>point(p.place,p.at))];
  for(const [turn,reach]of [[0,1.1],[.5,1.1],[-.5,1.1],[1,1.2],[-1,1.2],[0,1.6],[.5,1.6],[-.5,1.6]]){
    const c=Math.cos(turn),s=Math.sin(turn),ux=(dx*c-dz*s)/d,uz=(dx*s+dz*c)/d,spot={x:at.x+ux*reach,z:at.z+uz*reach};
    if(others.every(o=>Math.hypot(o.x-spot.x,o.z-spot.z)>1.4))return {...spot,face:[-ux,-uz]};
  }
  return null;
}

// A walkable camp (build brief §3.12): the chapter's camp map upsampled like a
// battle's, the soldier at the gate, the camp's people as neutral men to talk
// to and its objects to use. Nothing here fights and nothing is staged: the
// camp world is the page's, never the chronicle's; what the soldier does in
// it reaches the chronicle only through camp conversations and commands.

// Coarse camp coordinates (fractions of a 0.38 tile) to metres on the fine map.
export function campPoint(layout,[x,y],[dx,dz]=[0,0]){
  const along=(sizes,v)=>{const i=Math.max(0,Math.min(sizes.length-1,Math.floor(v)));let m=0;for(let j=0;j<i;j++)m+=sizes[j];return (m+sizes[i]*(v-i))*FINE;};
  return {x:along(layout.kx,x+.5)+dx,z:along(layout.ky,y+.5)+dz};
}
// A derived view, never a saved flag or a new reward. Only committed, successful
// Chapter V records can change the courtyard after a battle. A preparation for
// the next battle and a failed/retried field do not imply a completed detail.
export function campPresentationFor(state){
  const presentation=campPresentationBase(state);if(!presentation)return null;
  const activities=companyActivities(state).filter(a=>a.chapter===state.chapter);
  return activities.length?{...presentation,activities}:presentation;
}
function campPresentationBase(state){
  if(state.chapter!==5)return regionalCampPresentation(state);
  const camp=campView(state),layout=layoutFor(camp.terrain[0].length,camp.terrain.length,camp.scale);
  const hx=layout.kx.reduce((a,b)=>a+b,0)*FINE/2,hz=layout.ky.reduce((a,b)=>a+b,0)*FINE/2;
  const point=(place,offset)=>{const at=campPoint(layout,camp.places[place],offset);return {x:at.x-hx,z:at.z-hz};};
  const decision=['civilians','countermine'].includes(state.decisions?.ch5)?state.decisions.ch5:'pending';
  const records=(state.commandCampaign?.records??[]).filter(r=>['ch5-mine','ch5-wall'].includes(r.id)&&
    (state.history??[]).some(h=>h.id===r.id&&h.kind==='battle'&&h.result==='won'));
  const waterDetail=records.some(r=>r.opportunity==='signal'),engineeringRecovered=records.some(r=>r.opportunity==='stores');
  const civilianOutcome=decision==='civilians'?'departing':decision==='countermine'?'delayed':'waiting';
  const stores=decision==='civilians'?'transport':decision==='countermine'?'secured':'unassigned';
  const summary=decision==='civilians'?'Households are gathering for the river route; transport has been committed.':
    decision==='countermine'?'Stores are secured for the countermine; households wait under shelter.':'Households and the engineer await your decision.';
  return {decision,civilianOutcome,stores,waterDetail,engineeringRecovered,stage:state.encounterIndex>0?'river-gate':'tower',summary,
    places:CAMP_PLACES.map(id=>({id,name:campPlaceName(5,id),...point(id)})),
    interactions:interactionsOf(state,camp,point),smithy:smithyOf(camp,point),
    sceneryPads:(camp.sceneryPads??[]).map(p=>{
      const xs=p.cells.map(c=>c[0]),ys=p.cells.map(c=>c[1]),minX=Math.min(...xs),maxX=Math.max(...xs)+1,minZ=Math.min(...ys),maxZ=Math.max(...ys)+1;
      return {id:p.id,kind:p.kind,cells:p.cells.map(([x,y])=>({x,y})),x:(minX+maxX)*FINE/2-hx,z:(minZ+maxZ)*FINE/2-hz,
        width:(maxX-minX)*FINE,depth:(maxZ-minZ)*FINE,yaw:0,ground:'stone',fallbackName:`ch5-service-pad:${p.id}`};}),
    // Existing service actors perform these in place. Coordinates are centred
    // presentation metres for nearby scenery; they never drive navigation.
    ambient:ambientOf(state,camp,point)
  };
}

// The routines the camp's present people perform where they stand.
const ambientOf=(state,camp,point)=>camp.people.filter(p=>p.routine&&campPersonPresent(state,p)).map(p=>{const spot=campPersonSpot(state,p);return {id:p.id,routine:p.routine,...point(spot.place,spot.at)};});
function regionalCampPresentation(state){
  const camp=campView(state);if(!camp)return null;
  const context=CAMP_CONTEXT[state.chapter],chapter=CHAPTERS.find(c=>c.id===state.chapter);
  const layout=layoutFor(camp.terrain[0].length,camp.terrain.length,camp.scale);
  const hx=layout.kx.reduce((a,b)=>a+b,0)*FINE/2,hz=layout.ky.reduce((a,b)=>a+b,0)*FINE/2;
  const point=(place,offset)=>{const at=campPoint(layout,camp.places[place],offset);return {x:at.x-hx,z:at.z-hz};};
  const selected=state.decisions?.[`ch${state.chapter}`],detail=context.choices[selected],decision=detail?selected:'pending';
  const decisionDetails=detail?[{id:`ch${state.chapter}:${selected}`,...detail}]:[];
  if(state.chapter===7&&state.preparation)decisionDetails.push({id:'preparation',kind:'engineering',place:'drill',state:state.preparation,text:`The legion’s recorded preparation is ${state.preparation}.`});
  if(state.chapter===8&&state.negotiation)decisionDetails.push({id:'crossing-terms',kind:'justice',place:'principia',state:state.negotiation,text:`The crossing table carries the agreed ${state.negotiation.replaceAll('-',' ')} terms.`});
  if(state.chapter===9&&state.stratagem)decisionDetails.push({id:'stratagem',kind:'engineering',place:'drill',state:state.stratagem,text:`The command board carries the selected ${state.stratagem.replaceAll('-',' ')} stratagem.`});
  if(state.chapter===10){
    if(state.allocation)for(const [id,count]of Object.entries(state.allocation))decisionDetails.push({id:`relief:${id}`,kind:'stores',place:'quartermaster',state:`${id}:${count}`,count,text:`${count} relief convoys are assigned to the ${id}.`});
    if(state.judgment)decisionDetails.push({id:'land-judgment',kind:'justice',place:'principia',state:state.judgment,text:`The entered judgment orders ${state.judgment==='shared'?'shared tenure':'settler priority'}.`});
  }
  if(state.chapter>=7)decisionDetails.push({id:'mentor-memory',kind:'ceremony',place:'barracks',state:state.decisions?.ch6==='obey'?'vine-stick':'mentor-letter',
    text:state.decisions?.ch6==='obey'?'Varro’s vine stick rests beside the company roll; his place is not filled by another Varro.':'A letter from Varro rests beside the company roll.'});
  const ids=new Set(chapter.encounters.map(e=>e.id));
  const won=new Map((state.history??[]).filter(h=>ids.has(h.id)&&h.result==='won').map(h=>[h.id,h]));
  const committedRecords=(state.commandCampaign?.records??[]).filter(r=>ids.has(r.id)&&won.has(r.id)).map(r=>({id:r.id,kind:won.get(r.id).kind,opportunity:r.opportunity??null,case:r.case??null}));
  const outcomeDetails=committedRecords.flatMap(record=>{
    const field=CAMP_FIELD_DETAILS[state.chapter]?.[record.opportunity];
    if(field&&record.kind==='battle')return [{id:record.id,...field}];
    if(record.kind==='contest')return [{id:record.id,kind:'justice',place:'principia',state:'hearing-recorded',text:`The won hearing “${chapter.encounters.find(e=>e.id===record.id).title}” is entered in the court’s record.`}];
    return [];
  });
  let summary=detail?.text??context.purpose;
  if(state.chapter===10&&state.judgment)summary=summary.replace('The formal judgment still needs entering.','The formal judgment is entered.');
  return {chapter:state.chapter,decision,summary,purpose:context.purpose,inspection:context.inspection,
    stage:chapter.encounters[state.encounterIndex]?.id??'complete',decisionDetails,outcomeDetails,committedRecords,
    places:CAMP_PLACES.map(id=>({id,name:campPlaceName(state.chapter,id),...point(id)})),
    interactions:interactionsOf(state,camp,point),smithy:smithyOf(camp,point),
    sceneryPads:(camp.sceneryPads??[]).map(p=>{
      const xs=p.cells.map(c=>c[0]),ys=p.cells.map(c=>c[1]),minX=Math.min(...xs),maxX=Math.max(...xs)+1,minZ=Math.min(...ys),maxZ=Math.max(...ys)+1;
      return {id:p.id,kind:p.kind,cells:p.cells.map(([x,y])=>({x,y})),x:(minX+maxX)*FINE/2-hx,z:(minZ+maxZ)*FINE/2-hz,
        width:(maxX-minX)*FINE,depth:(maxZ-minZ)*FINE,yaw:0,ground:camp.ground,fallbackName:`world-service-pad:${state.chapter}:${p.id}`};}),
    ambient:ambientOf(state,camp,point)};
}
export function createCampWorld(state){
  const camp=campView(state);if(!camp)return null;
  const layout=layoutFor(camp.terrain[0].length,camp.terrain.length,camp.scale),fine=upsampleTerrain(camp.terrain,layout,camp.ground);
  for(const pad of camp.sceneryPads??[])for(const [x,y]of pad.cells)fine.terrain[y][x]='rock';
  const place=(id,offset)=>campPoint(layout,camp.places[id],offset);
  const entry=place(camp.entry,[0,-3]);
  const actors=[{...soldierSpec(state,{at:[entry.x,entry.z],face:[0,-1]}),standingPreset:null}];
  for(const p of camp.people.filter(p=>campPersonPresent(state,p))){
    const spot=campPersonSpot(state,p),at=place(spot.place,spot.at);
    actors.push({id:p.id,name:p.name,side:'neutral',role:p.role,attributes:{str:10,agi:10,con:10,per:10,combat:5,field:5},kit:['tunic','caligae'],
      at:[at.x,at.z],face:[0,1],talk:{tree:p.talk},drawn:false,camp:true});
  }
  const objects=camp.objects.map(o=>{const at=place(o.place,o.at);
    return o.container?{id:o.id,kind:'container',name:o.name,x:at.x,z:at.z,work_s:.3,toggle:true,...containerState(state,o)}
      :{id:o.id,kind:o.kind,name:o.name,x:at.x,z:at.z,work_s:.3,toggle:true,talk:o.talk};});
  // The way out (release 14): used, the page leaves camp by it as by the gate's March out.
  const exit=campExitFor(state);
  if(exit){const at=place(exit.place,exit.at);objects.push({id:exit.id,kind:'exit',name:exit.name,x:at.x,z:at.z,work_s:.3,toggle:true,
    verb:exit.verb,hint:exit.hint,exit:{to:exit.to,area:exit.area}});}
  const world=createWorld({map:{id:camp.id,...fine},seed:1000+state.chapter,actors,controlled:'hero',objects,kind:'camp',mission:null});
  world.layout={kx:[...layout.kx],ky:[...layout.ky],k:layout.k};world.title=camp.title;world.campId=camp.id;world.chapter=state.chapter;
  if(camp.peaceful===true)world.peaceful=true;
  world.places=Object.fromEntries(CAMP_PLACES.map(id=>[id,{name:campPlaceName(state.chapter,id),...place(id)}]));
  const presentation=campPresentationFor(state);if(presentation)world.campPresentation=presentation;
  return world;
}
// The place the soldier stands in, if any (within 8 m of its centre).
export function placeAt(world,actorId=world.heroId){
  const a=actorById(world,actorId);if(!a||!world.places)return null;
  let best=null,bd=8;for(const [id,p]of Object.entries(world.places)){const d=distanceBetween(a,p);if(d<=bd){bd=d;best=id;}}return best;
}
