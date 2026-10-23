import {campFor,CAMP_PLACES,campPlaceName,campPersonPresent} from '../../data/camps.js';
import {CAMP_CONTEXT,CAMP_FIELD_DETAILS} from '../../data/camp-regions.js';
import {CHAPTERS} from '../../data/campaign.js';
import {createWorld} from './simulation.js';
import {FINE,layoutFor,upsampleTerrain,soldierSpec} from './campaign-encounter.js';
import {actorById,distanceBetween} from './abilities.js';

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
  if(state.chapter!==5)return regionalCampPresentation(state);
  const camp=campFor(5),layout=layoutFor(camp.terrain[0].length,camp.terrain.length,camp.scale);
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
    interactions:camp.objects.map(o=>({id:o.id,kind:o.kind,name:o.name,...point(o.place,o.at)})),
    sceneryPads:(camp.sceneryPads??[]).map(p=>{
      const xs=p.cells.map(c=>c[0]),ys=p.cells.map(c=>c[1]),minX=Math.min(...xs),maxX=Math.max(...xs)+1,minZ=Math.min(...ys),maxZ=Math.max(...ys)+1;
      return {id:p.id,kind:p.kind,cells:p.cells.map(([x,y])=>({x,y})),x:(minX+maxX)*FINE/2-hx,z:(minZ+maxZ)*FINE/2-hz,
        width:(maxX-minX)*FINE,depth:(maxZ-minZ)*FINE,yaw:0,ground:'stone',fallbackName:`ch5-service-pad:${p.id}`};}),
    // Existing service actors perform these in place. Coordinates are centred
    // presentation metres for nearby scenery; they never drive navigation.
    ambient:camp.people.filter(p=>p.routine&&campPersonPresent(state,p)).map(p=>({id:p.id,routine:p.routine,...point(p.place,p.at)}))
  };
}

function regionalCampPresentation(state){
  const camp=campFor(state.chapter);if(!camp)return null;
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
    interactions:camp.objects.map(o=>({id:o.id,kind:o.kind,name:o.name,...point(o.place,o.at)})),
    sceneryPads:(camp.sceneryPads??[]).map(p=>{
      const xs=p.cells.map(c=>c[0]),ys=p.cells.map(c=>c[1]),minX=Math.min(...xs),maxX=Math.max(...xs)+1,minZ=Math.min(...ys),maxZ=Math.max(...ys)+1;
      return {id:p.id,kind:p.kind,cells:p.cells.map(([x,y])=>({x,y})),x:(minX+maxX)*FINE/2-hx,z:(minZ+maxZ)*FINE/2-hz,
        width:(maxX-minX)*FINE,depth:(maxZ-minZ)*FINE,yaw:0,ground:camp.ground,fallbackName:`world-service-pad:${state.chapter}:${p.id}`};}),
    ambient:camp.people.filter(p=>p.routine&&campPersonPresent(state,p)).map(p=>({id:p.id,routine:p.routine,...point(p.place,p.at)}))};
}
export function createCampWorld(state){
  const camp=campFor(state.chapter);if(!camp)return null;
  const layout=layoutFor(camp.terrain[0].length,camp.terrain.length,camp.scale),fine=upsampleTerrain(camp.terrain,layout,camp.ground);
  for(const pad of camp.sceneryPads??[])for(const [x,y]of pad.cells)fine.terrain[y][x]='rock';
  const place=(id,offset)=>campPoint(layout,camp.places[id],offset);
  const entry=place(camp.entry,[0,-3]);
  const actors=[{...soldierSpec(state,{at:[entry.x,entry.z],face:[0,-1]}),standingPreset:null}];
  for(const p of camp.people.filter(p=>campPersonPresent(state,p))){
    const at=place(p.place,p.at);
    actors.push({id:p.id,name:p.name,side:'neutral',role:p.role,attributes:{str:10,agi:10,con:10,per:10,combat:5,field:5},kit:['tunic','caligae'],
      at:[at.x,at.z],face:[0,1],talk:{tree:p.talk},drawn:false,camp:true});
  }
  const objects=camp.objects.map(o=>{const at=place(o.place,o.at);return {id:o.id,kind:o.kind,name:o.name,x:at.x,z:at.z,work_s:.3,toggle:true,talk:o.talk};});
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
