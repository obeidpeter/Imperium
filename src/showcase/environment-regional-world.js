import * as T from '../../vendor/three/three.module.js';
import {REGIONAL_KIT_COMPONENTS} from './regional-kit-components.js';
import {CH5_KIT_COMPONENTS,isChapterFivePilot} from './environment-ch5-pilot.js';
import {stagingEdge,getEncounterStaging} from './environment-staging.js';
import {batchStaticEnvironment} from './environment-batching.js';
import {curiaPropSpot} from './environment-curia.js';
import {terrainAt,distantRiverCentre} from './environment-layout.js';
import {REGIONAL_PROP_CHAPTERS,REGIONAL_REUSED_PROP_CHAPTERS,worldModelUrl} from '../ui/world-catalog.js';
import {REGIONAL_WORLD_KITS,REGIONAL_PLANS,REGIONAL_FRONTAGE,REGIONAL_COMPOSITIONS,REGIONAL_CHAPTER_EXTRAS,REGIONAL_HEARINGS,ENCOUNTER_LAYOUTS} from '../ui/world-layouts.js';

// The kits, plans and frontage are data (src/ui/world-layouts.js). Placement
// follows full rules-board bounds and real boundary roads; no scenery can add
// a destination, blocker or reward.
export {REGIONAL_WORLD_KITS};
export {REGIONAL_PROP_CHAPTERS};
export const regionalChapter=e=>Number(/^ch(\d+)-/.exec(e?.id??'')?.[1]);
export const hasRegionalWorld=e=>!!REGIONAL_WORLD_KITS[regionalChapter(e)]&&!isChapterFivePilot(e);
export const regionalComponentDimensions=(id,component)=>(id==='ch5-fortress-kit'?CH5_KIT_COMPONENTS:REGIONAL_KIT_COMPONENTS[id])?.[component];
export function regionalPlacementBounds(p){
  const [w,,d]=regionalComponentDimensions(p.id,p.component),s=p.scale??[1,1,1],c=Math.abs(Math.cos(p.yaw??0)),q=Math.abs(Math.sin(p.yaw??0));
  const rx=(w*s[0]*c+d*s[2]*q)/2,rz=(w*s[0]*q+d*s[2]*c)/2;
  return {minX:p.x-rx,maxX:p.x+rx,minZ:p.z-rz,maxZ:p.z+rz};
}

// Different mission approaches rotate the frontage toward their existing
// landmark road, without turning the map.
export function getRegionalKitPlacements(e,{chapter=regionalChapter(e),tileSize=2.5,withoutGate=false}={}){
  if(chapter!==regionalChapter(e)||!hasRegionalWorld(e)||!Number.isInteger(e.width)||!Number.isInteger(e.height))return [];
  const kit=REGIONAL_WORLD_KITS[chapter],plan=REGIONAL_PLANS[chapter],staging=getEncounterStaging(e,{chapter,civic:e.kind==='contest'}),camp=e.id===`ch${chapter}-camp`,civic=e.kind==='contest';
  const front=camp?'north':staging.landmarkEdge,edges={front,opposite:front==='east'?'north':'east',back:front==='east'?'south':'west'},out=[];
  const add=(component,edge,along,gap=1.7,yaw=0,scale=[1,1,1],id=kit)=>{
    const dims=regionalComponentDimensions(id,component);if(!dims)throw new Error(`Missing regional component ${id}/${component}`);
    const depth=Math.abs(Math.cos(yaw))*dims[2]*scale[2]+Math.abs(Math.sin(yaw))*dims[0]*scale[0];
    const a=stagingEdge(e,edge,tileSize,gap+depth/2),c=Math.cos(a.angle),s=Math.sin(a.angle),i=out.length;
    // Blender's authored doors and open service fronts face local +Z. The
    // staging frame points outward, so turn the front back toward the board.
    out.push({id,component,x:a.x+along*c,z:a.z-along*s,yaw:a.angle+Math.PI+yaw,scale,key:`regional:${chapter}:${component}:${i}`,fallbackName:`regional-fallback:${chapter}:${component}:${i}`});
  };
  const width=slot=>regionalComponentDimensions(kit,plan[slot])[0];
  const place=entry=>{
    if(entry.camp&&!camp||entry.gate&&withoutGate)return;
    const {beside}=entry,along=beside?beside.side*((width(beside.slot)+width(entry.slot))/2+beside.spacing):entry.along;
    add(entry.component??plan[entry.slot],edges[entry.edge]??entry.edge,along,entry.gap,entry.yaw??0,[...(entry.scale??[1,1,1])],entry.kit??kit);
  };
  const layout=civic&&chapter>=10?REGIONAL_HEARINGS[chapter]:ENCOUNTER_LAYOUTS[e.id]??[...(REGIONAL_COMPOSITIONS[chapter]?.entries??REGIONAL_FRONTAGE),...(REGIONAL_CHAPTER_EXTRAS[chapter]??[])];
  for(const entry of layout)place(entry);
  return out;
}

/** Interior solids require a complete authored collision pocket. A missing
 * cell, stale ID or malformed extent leaves the floor clear. */
export function regionalServicePads(e,tileSize=2.5){
  if(!hasRegionalWorld(e)||!/-camp$/.test(e.id))return [];
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2;
  return (e.campPresentation?.sceneryPads??[]).filter(pad=>{
    if(!['world-supply','world-water','world-local'].includes(pad.id)||![pad.x,pad.z,pad.width,pad.depth].every(Number.isFinite)||pad.width<=.6||pad.depth<=.6)return false;
    if(pad.x-pad.width/2 < -hx||pad.x+pad.width/2 > hx||pad.z-pad.depth/2 < -hz||pad.z+pad.depth/2 > hz)return false;
    const cells=new Set((pad.cells??[]).map(c=>`${c.x},${c.y}`));
    const x0=Math.floor((pad.x-pad.width/2+hx+1e-6)/tileSize),x1=Math.floor((pad.x+pad.width/2+hx-1e-6)/tileSize),y0=Math.floor((pad.z-pad.depth/2+hz+1e-6)/tileSize),y1=Math.floor((pad.z+pad.depth/2+hz-1e-6)/tileSize);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(!cells.has(`${x},${y}`)||terrainAt(e,x,y)!=='rock')return false;
    return true;
  });
}

const padKindFor=id=>/trough|fountain|cistern|jars/.test(id)?'world-water':/litter|baggage|bundles|relief/.test(id)?'world-local':'world-supply';
// Cardinal inspection of the final compressed assets established local +X
// as the shield-boss / scroll-cubby front. Keep their useful faces visible
// from the service approach, rather than inheriting a decorative random yaw.
const frontServices=Object.freeze({'equipment-rack':'quartermaster','archive-cabinet':'principia'});
const propYaw=(id,x,z,target,fallback=0)=>frontServices[id]&&target&&Number.isFinite(target.x)&&Number.isFinite(target.z)&&Math.hypot(target.x-x,target.z-z)>.01?Math.atan2(z-target.z,target.x-x):fallback;
export function regionalPropPlacements(e,{chapter=regionalChapter(e),tileSize=2.5}={}){
  if(chapter!==regionalChapter(e)||!hasRegionalWorld(e)||!Number.isInteger(e.width)||!Number.isInteger(e.height)||e.width<=0||e.height<=0)return [];
  const ids=[...Object.entries(REGIONAL_PROP_CHAPTERS),...Object.entries(REGIONAL_REUSED_PROP_CHAPTERS)].filter(([,chapters])=>chapters.includes(chapter)).map(([id])=>id);
  const pads=regionalServicePads(e,tileSize),used=new Set(),hx=e.width*tileSize/2,hz=e.height*tileSize/2,occupied=getRegionalKitPlacements(e,{chapter,tileSize}).map(regionalPlacementBounds);
  const intersects=(a,b)=>a.maxX>b.minX&&a.minX<b.maxX&&a.maxZ>b.minZ&&a.minZ<b.maxZ;
  return ids.map((id,i)=>{
    const kind=padKindFor(id),pad=id==='river-ferry'?null:pads.find(p=>p.id===kind&&!used.has(p.id));
    if(pad){
      used.add(pad.id);const x=pad.x+.4,z=pad.z,approach=e.campPresentation?.places?.find(place=>place.id===frontServices[id])??{x:0,z:0};
      return {id,url:worldModelUrl(id),x,z,yaw:propYaw(id,x,z,approach),pad:true,padId:pad.id,fitWithin:{width:pad.width-1.4,depth:pad.depth-.6},fallbackName:`world-service-pad:${chapter}:${pad.id}`};
    }
    // A single orderly baggage line has a four-metre clear aisle from the
    // board edge. A second rank avoids overlapping accessories on small maps.
    if(id==='river-ferry')return {id,url:worldModelUrl(id),x:hx+9,z:distantRiverCentre(e,tileSize),yaw:Math.PI/2,groundY:-1.55,fitWithin:{width:6.2,depth:4.4},fallbackName:`regional-prop:${id}`};
    // In the Curia a prop has its own place: the clerks' tables beside the tribunal, the
    // fountain and the army's eagle outside the doors (CURIA_LAYOUT).
    const spot=curiaPropSpot(e,id,{chapter,tileSize});
    if(spot)return {id,url:worldModelUrl(id),x:spot.x,z:spot.z,yaw:spot.yaw,groundY:0,fitWithin:{width:2.6,depth:2.6},fallbackName:`regional-prop:${id}`};
    let slot=i,x,z,b;
    do{const column=slot%4,row=Math.floor(slot/4);x=[-10,-4,4,10][column];z=hz+5.5+row*6;slot++;b={minX:x-2.35,maxX:x+2.35,minZ:z-2.35,maxZ:z+2.35};}while(occupied.some(other=>intersects(b,other)));
    occupied.push(b);const column=(slot-1)%4;
    return {id,url:worldModelUrl(id),x,z,yaw:propYaw(id,x,z,{x,z:0},column%2?-.12:.12),fitWithin:{width:id==='river-ferry'?4.6:4.4,depth:4.4},fallbackName:`regional-prop:${id}`};
  });
}

function componentFallback(g,id,d,p,m,chapter){
  const [w,h,depth]=d,stone=chapter===6||chapter===9?m.brick:m.stone,mat=/timber|palisade|watch|duckboard|jetty|trestle|rack|reed|baggage|windbreak/.test(id)?m.wood:stone;
  const box=(x,y,z,bw,bh,bd,material=mat)=>p.plank(g,x,y,z,bw,bh,bd,material);
  const roof=(y,material=m.terra)=>{for(const side of [-1,1]){const slab=box(side*w*.25,y,0,w*.51,.12,depth,material);slab.rotation.z=-side*.20;}};
  const posts=(height,material=mat)=>{for(const x of [-w*.42,w*.42])for(const z of [-depth*.40,depth*.40])box(x,height/2,z,.18,height,.18,material);};
  const colonnade=()=>{for(let i=0;i<4;i++){const x=(i-1.5)*w*.25;box(x,.12,0,.65,.24,.65);p.mesh(g,p.cylinder,stone,x,h*.46,0,.20,h*.8,.20);box(x,h*.87,0,.65,.16,.65);}box(0,h*.94,0,w,.18,Math.min(depth,1.1));};
  if(/arch|gate|vaulted/.test(id)){
    const opening=w*.59,pier=(w-opening)/2,cap=Math.min(h*.23,.9);
    for(const side of [-1,1])box(side*(w-pier)/2,(h-cap)/2,0,pier,h-cap,Math.min(depth,1.4));
    box(0,h-cap/2,0,w,cap,Math.min(depth,1.4));
    if(!/timber|marching/.test(id))for(let i=0;i<7;i++){const a=(i+.5)*Math.PI/7,b=box(Math.cos(a)*opening*.46,h*.56+Math.sin(a)*opening*.46,0,.48,.45,Math.min(depth,1.4));b.rotation.z=a-Math.PI/2;}
  }else if(/tent|pavilion|awning|windbreak|shelter|pergola/.test(id)){
    posts(h*.82,m.wood);box(0,h*.84,0,w,.16,depth,m.wood);
    if(/tent|pavilion/.test(id)){for(const side of [-1,1]){const cloth=box(side*w*.25,h*.64,0,w*.66,.055,depth,m.cloth);cloth.rotation.z=-side*.72;}}
    else roof(h*.9,/pergola/.test(id)?m.wood:m.cloth);
  }else if(/colonnade|portico|arcade/.test(id)){colonnade();roof(h*.94);}
  else if(/well|fountain/.test(id)){
    const r=Math.min(w,depth)*.39; p.mesh(g,p.geo(new T.CylinderGeometry(r,r,h*.38,16,1,true)),stone,0,h*.19,0);box(0,h*.55,0,.35,h*.75,.35);
    const water=p.mesh(g,p.geo(new T.CircleGeometry(r*.94,16)),m.water,0,h*.3,0);water.rotation.x=-Math.PI/2;water.castShadow=false;
  }else if(/stair|steps/.test(id)){for(let i=0;i<6;i++)box(0,h*(i+1)/12,-depth*.5+depth*(i+.5)/6,w,h*(i+1)/6,depth/6+.015);}
  else if(/duckboard|jetty|bridge|crossing|trestle/.test(id)){posts(h*.8,m.wood);for(let i=0;i<9;i++)box(0,h*.65,-depth*.5+depth*(i+.5)/9,w,.12,depth/9-.025,m.wood);}
  else if(/wall|screen|palisade|revetment/.test(id)){
    if(/palisade|reed/.test(id))for(let i=0;i<12;i++)box((i-5.5)*w/12,h*.5,0,w/15,h,Math.min(depth,.4));
    else {box(0,h*.45,0,w,h*.9,Math.min(depth,.8));box(0,h*.96,0,w,.08*h,Math.min(depth,1));}
  }else if(/plinth|marker|milestone|cairn|beacon/.test(id)){
    box(0,h*.08,0,w,h*.16,depth);box(0,h*.55,0,w*.48,h*.78,depth*.48);
    if(/beacon/.test(id))box(0,h*.94,0,w*.8,.1,depth*.8,m.iron);
  }else if(/rack|stalls|counter|press|bollards|vent/.test(id)){
    posts(h*.9,m.wood);for(const y of [h*.3,h*.65,h*.95])box(0,y,0,w,.12,depth,m.wood);
  }else if(/threshold|drain|dais|sluice/.test(id)){box(0,h*.25,0,w,h*.5,depth);for(const side of [-1,1])box(side*w*.43,h*.7,0,w*.14,h*.6,depth);}
  else{
    // Open-front working buildings: back and side walls retain usable depth.
    const lift=/raised|stilt/.test(id)?Math.min(.9,h*.2):0;
    if(lift)posts(lift,m.wood);box(0,lift+.08,0,w,.16,depth);
    for(const side of [-1,1])box(side*w*.46,lift+h*.38,0,w*.08,h*.68,depth,m.plaster);
    box(0,lift+h*.38,-depth*.45,w,h*.68,depth*.10,m.plaster);roof(h*.88);
  }
}

const freezeFallback=(g,geometries)=>{batchStaticEnvironment(g,{geometries,instanceThreshold:Infinity});g.traverse(o=>{if(o.isMesh){o.userData.environmentDynamic=true;o.raycast=()=>{};}});};
export function addRegionalWorld(ctx){
  const {root,e,p,m,profile,height,tileSize,geometries}=ctx;if(!hasRegionalWorld(e))return;
  const g=p.group(root,0,0,0);g.name=`Chapter ${profile.chapter} regional world`;
  const placements=getRegionalKitPlacements(e,{chapter:profile.chapter,tileSize,withoutGate:!!root.userData.finaleWalls}),structures=[];
  for(const item of placements){
    const b=regionalPlacementBounds(item),base=Math.min(...[[item.x,item.z],[b.minX,b.minZ],[b.maxX,b.minZ],[b.minX,b.maxZ],[b.maxX,b.maxZ]].map(([x,z])=>height(x,z)));
    const part=p.group(g,item.x,base,item.z,item.yaw);part.name=item.fallbackName;part.scale.fromArray(item.scale);part.userData.regionalFallback=true;
    componentFallback(part,item.component,regionalComponentDimensions(item.id,item.component),p,m,profile.chapter);freezeFallback(part,geometries);
    structures.push({name:part.name,min:[b.minX,base,b.minZ],max:[b.maxX,base+regionalComponentDimensions(item.id,item.component)[1]*item.scale[1],b.maxZ]});
  }
  root.userData.regionalWorld={chapter:profile.chapter,kit:REGIONAL_WORLD_KITS[profile.chapter],components:placements.length,composition:REGIONAL_COMPOSITIONS[profile.chapter]?.title,revision:2};
  root.userData.precinctStructures=structures;root.userData.inhabitedSetpieces=structures;root.userData.encounterStaging=profile.staging;
  root.userData.environmentLandmarks??=[];root.userData.environmentLandmarks.push(profile.staging.title,`${profile.region}: connected working courts`);
  if(profile.chapter===9)root.userData.environmentLandmarks.push('connected Palmyrene urban edge');
  addRegionalHabitat(ctx);
  if(/-camp$/.test(e.id))addRegionalServices(ctx,g);
  return g;
}

function addRegionalHabitat({root,e,p,m,profile,height,tileSize,vegetation,instance,quality}){
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2;
  if(profile.chapter===2||profile.chapter===8){
    // Keep the near landing clear: the third willow used to sit directly in
    // the low camera's foreground, despite its trunk being outside the board.
    for(const [i,[x,z,h]]of [[-hx-12,-hz-12,6],[hx+12,-hz-12,5.4],[hx+20,-hz-3,6.5]].entries())vegetation.tree('willow',x,z,h,i);
    const reed=p.geo(new T.CylinderGeometry(.009,.018,1,5));
    for(let i=0;i<36;i++){const x=(i%2?-1:1)*(hx+1.4+(i%3)*.23),z=(Math.floor(i/2)-8.5)*Math.min(1.6,hz/9);instance('marsh reed stems',reed,m.dryGrass,[x,height(x,z)+.4,z],[1,.8+(i%3)*.1,1]);}
  }else if(profile.chapter===9){for(const [i,z]of [-hz-9,hz+8].entries())vegetation.palm(hx+13,z,5.8,i);}
  else if(profile.chapter===7){for(const [i,x]of [-12,12].entries())vegetation.cypress(x,-hz-16,6.1,i);}
  else if(profile.chapter===10){
    for(const side of [-1,1])for(let i=0;i<24;i++){const x=side*(hx+1.3+(i%3)*.35),z=(Math.floor(i/3)-3.5)*2.1;instance('provincial cereal rows',p.cylinder,m.dryGrass,[x,height(x,z)+.32,z],[.018,.64,.018]);}
    root.userData.environmentLandmarks.push('cultivated grain terraces');
  }
}

function addRegionalServices({root,e,p,m,height,tileSize,geometries},parent){
  const data=e.campPresentation;if(!data)return;const pads=regionalServicePads(e,tileSize),outcomes=[],interactions=[];
  for(const pad of pads){
    const g=p.group(parent,pad.x+.4,height(pad.x+.4,pad.z),pad.z);g.name=`world-service-pad:${regionalChapter(e)}:${pad.id}`;
    if(pad.id==='world-water'){
      const water=p.mesh(g,p.geo(new T.CircleGeometry(.94,16)),m.water,0,.55,0);water.rotation.x=-Math.PI/2;water.castShadow=false;
      p.mesh(g,p.geo(new T.CylinderGeometry(1,1.05,.65,16,1,true)),m.stone,0,.325,0);
      p.amphora(g,1.2,0,.9,.6);
    }else{p.crate(g,-.55,0,0,.9);p.plank(g,.65,.23,.25,.85,.46,1.3,m.cloth);for(const z of [-.1,.6])p.plank(g,.65,.48,z,.9,.035,.045,m.rope);}
    freezeFallback(g,geometries);
  }
  for(const interaction of data.interactions??[]){
    if(interaction.id==='gate')continue;
    // The existing interaction indicator owns this walkable anchor. Physical
    // furniture belongs only to collision pockets, so arrival never walks
    // through a decorative desk or an unregistered post.
    interactions.push(interaction.id);
  }
  const latest=new Map();for(const item of [...(data.decisionDetails??[]),...(data.outcomeDetails??[])])if(item.state!=='pending')latest.set(item.id,item);
  const assigned=[...latest.values()].map(item=>{const motif=item.visual??item.kind??'stores';return {item,motif,pad:pads.find(p=>motif==='water'?p.id==='world-water':/refuge|civilian|aid|justice/.test(motif)?p.id==='world-local':p.id==='world-supply')??pads[0]};}).filter(a=>a.pad);
  const counters=new Map(),outcomeGroup=p.group(parent,0,0,0);outcomeGroup.name='regional committed service details';
  for(const {item,motif,pad}of assigned){
    const count=assigned.filter(a=>a.pad.id===pad.id).length,index=counters.get(pad.id)??0;counters.set(pad.id,index+1);
    const spacing=Math.min(.62,4/count),g=p.group(outcomeGroup,pad.x-1.85,height(pad.x-1.85,pad.z),pad.z+(index-(count-1)/2)*spacing);g.name=`regional committed ${item.id}`;
    if(motif==='water'){p.mesh(g,p.geo(new T.CylinderGeometry(.21,.18,.35,10,1,true)),m.wood,0,.175,0);const w=p.mesh(g,p.geo(new T.CircleGeometry(.18,10)),m.water,0,.29,0);w.rotation.x=-Math.PI/2;}
    else if(/refuge|civilian|aid/.test(motif)){p.plank(g,0,.12,0,.55,.24,.5,m.cloth);for(const x of [-.18,.18])p.plank(g,x,.25,0,.045,.025,.53,m.rope);}
    else if(/engineering/.test(motif)){p.plank(g,0,.10,0,.55,.1,.36,m.wood);p.beam(g,[-.22,.18,0],[.22,.18,0],.025,m.darkWood);p.plank(g,.20,.18,0,.13,.06,.2,m.iron);}
    else if(item.state==='vine-stick'){p.beam(g,[0,0,-.1],[.09,1.1,.1],.035,m.wood);for(const y of [.3,.55,.8])p.plank(g,.04,y,0,.12,.05,.08,m.darkWood);}
    else {
      p.plank(g,0,.42,0,.08,.84,.08,m.darkWood);
      const paired=/paired|shared|lawful/.test(item.state),sealed=/sealed|pledged|patron|unconditional|seizure/.test(item.state);
      for(let n=0;n<(paired?2:1);n++)p.plank(g,paired?(n-.5)*.24:0,.68,.04,paired?.21:.43,.28,.045,m.ivory);
      if(sealed)p.mesh(g,p.cylinder,m.red,0,.73,.085,.055,.04,.055).rotation.x=Math.PI/2;
      if(Number.isInteger(item.count))for(let n=0;n<Math.max(0,Math.min(6,item.count));n++)p.plank(g,(n%3-1)*.13,.46-Math.floor(n/3)*.13,.06,.10,.065,.04,m.wood);
    }
    outcomes.push({id:item.id,state:item.state,motif});
  }
  freezeFallback(outcomeGroup,geometries);
  root.userData.regionalWorld.services={pads:pads.map(p=>p.id),interactions,outcomes};
}

// The tiny fallback props intentionally share existing materials and batches.
// The generated object alone hides its owner; no full facade vanishes because
// one downloaded accessory became ready.
export function addRegionalPropFallbacks(ctx,placements){
  const {root,p,m,height,geometries}=ctx;
  for(const item of placements){if(!item.fallbackName||item.pad)continue;
    const g=p.group(root,item.x,item.groundY??height(item.x,item.z),item.z,item.yaw);g.name=item.fallbackName;
    if(/ferry/.test(item.id)){
      const hull=p.mesh(g,p.geo(new T.SphereGeometry(1,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2)),m.wood,0,.4,0,1.1,.65,3.1);hull.rotation.x=Math.PI;
      for(const z of [-1.5,0,1.5])p.plank(g,0,.55,z,1.8,.12,.3,m.wood);
    }else if(/fountain|trough/.test(item.id)){
      for(const side of [-1,1])p.plank(g,side*.8,.35,0,.18,.7,1.8,m.stone);for(const z of [-.8,.8])p.plank(g,0,.35,z,1.6,.7,.18,m.stone);
    }else if(/cart/.test(item.id)){const cart=p.wagon(g,0,0,0,.1);cart.scale.setScalar(.7);}
    else if(/litter/.test(item.id)){p.plank(g,0,.4,0,.7,.06,2.2,m.cloth);for(const x of [-.45,.45])p.beam(g,[x,.4,-1.5],[x,.4,1.5],.04,m.wood);}
    else if(/table|cookstation/.test(item.id)){p.plank(g,0,.85,0,1.6,.12,1,m.wood);for(const x of [-.65,.65])for(const z of [-.38,.38])p.plank(g,x,.4,z,.1,.8,.1,m.darkWood);p.plank(g,0,.94,0,.8,.045,.6,m.ivory);}
    else if(/rack|cabinet/.test(item.id)){
      const frame=p.group(g,0,0,0,frontServices[item.id]?Math.PI/2:0);
      for(const x of [-.65,.65])p.plank(frame,x,1,0,.13,2,.8,m.wood);for(const y of [.15,1,1.85])p.plank(frame,0,y,0,1.45,.12,.8,m.wood);
      if(/cabinet/.test(item.id))p.plank(frame,0,1,-.37,1.45,1.8,.06,m.darkWood);
    }
    else if(/eagle|brazier/.test(item.id)){p.plank(g,0,1,0,.18,2,.18,m.darkWood);p.plank(g,0,1.8,0,.9,.35,.12,m.brass);p.plank(g,0,.08,0,.8,.16,.8,m.stone);}
    else {p.crate(g,-.45,0,0,.8);p.plank(g,.55,.25,.1,.9,.5,1.2,m.cloth);}
    freezeFallback(g,geometries);
  }
}
