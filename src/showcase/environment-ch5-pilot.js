import * as T from '../../vendor/three/three.module.js';
import {stagingEdge} from './environment-staging.js';
import {batchStaticEnvironment} from './environment-batching.js';
import {smooth} from './environment-layout.js';
import {CH5_FORTRESS_LAYOUT} from '../ui/world-layouts.js';

/** Original Blender modular architecture, and a complete offline/Performance
 * fallback. Every solid footprint stays outside the full rules rectangle;
 * visual detail never creates navigation, cover, doors or picking targets. */
export const CH5_PILOT_IDS=CH5_FORTRESS_LAYOUT.encounters;
export const CH5_KIT_COMPONENTS=Object.freeze({
  wall_bay:[4.3,5.6,2.2],wall_breached:[4.4,4.8,2.8],wall_return:[4.2,3.8,6.4],
  tower_intact:[5,8,5.7],tower_broken:[5,6.6,5.7],gate_arch:[6.2,5.7,1.9],
  buttress:[1.3,3.4,1.8],mine_frame:[2.8,2.6,3],
  roof_gallery:[6.2,3.5,4.2],stair_flight:[2.5,3,4.2],landing_deck:[4,1.3,6.2],
  quay_revetment:[4.3,2,1.8],bluff_section:[7.7,3.8,5],drain_channel:[2, .5,4.1],
  paved_threshold:[4.1,.2,3.1],plaster_repair:[4.3,3,1.1]
});
export const isChapterFivePilot=e=>CH5_PILOT_IDS.includes(e?.id);
export function chapterFiveServicePads(e,tileSize=2.5){
  if(e.id!=='ch5-camp')return [];
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2;
  return (e.campPresentation?.sceneryPads??[]).filter(pad=>{
    if(!['ch5-cistern','ch5-household-bundles','ch5-storage-jars'].includes(pad.id)||![pad.x,pad.z,pad.width,pad.depth].every(Number.isFinite)||pad.width<=.6||pad.depth<=.6)return false;
    const cells=new Set((pad.cells??[]).map(c=>`${c.x},${c.y}`));
    const x0=Math.floor((pad.x-pad.width/2+hx+1e-6)/tileSize),x1=Math.floor((pad.x+pad.width/2+hx-1e-6)/tileSize);
    const y0=Math.floor((pad.z-pad.depth/2+hz+1e-6)/tileSize),y1=Math.floor((pad.z+pad.depth/2+hz-1e-6)/tileSize);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const t=e.terrain?.[y]?.[x];if(!cells.has(`${x},${y}`)||(typeof t==='string'?t:t?.type)!=='rock')return false;
    }
    return true;
  });
}

function riverProfile(x,e,tileSize){
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2,length=Math.max(100,hx*2+60),i=(x/length+.5)*36;
  return {near:-hz-10.5-1.2*Math.sin(i*.24),width:16+2*Math.sin(i*.31),length};
}
/** Carve only the unplayable northern margin so the new river has a bed,
 * banks and a consistent waterline instead of lying underneath solid ground. */
export function chapterFivePilotHeight(base,e,tileSize=2.5){
  if(!isChapterFivePilot(e))return base;
  return (x,z)=>{
    const h=base(x,z),r=riverProfile(x,e,tileSize),d=r.near-z;
    const bank=smooth(d/2.5)*smooth((r.width-d)/2.5)*smooth((r.length*.5-Math.abs(x))/8);
    return h*(1-bank)-2.65*bank;
  };
}

// Compact two-tower frontage close to the far edge, with receding wings and
// work spaces beyond it (CH5_FORTRESS_LAYOUT in src/ui/world-layouts.js). It
// scales to both the turn board and the expanded real-time field; no
// hard-coded position can fall inside the larger map.
export function getChapterFiveKitPlacements(e,{chapter=5,tileSize=2.5}={}){
  if(chapter!==5||!isChapterFivePilot(e))return [];
  const layout=CH5_FORTRESS_LAYOUT,camp=e.id==='ch5-camp',edge=layout.edges[e.id]??layout.defaultEdge;
  // A value that differs between the courtyard and the battles.
  const pick=v=>v&&typeof v==='object'&&!Array.isArray(v)?(camp?v.camp:v.field):v;
  const anchor=stagingEdge(e,edge,tileSize,layout.inset),placements=[];
  const add=(component,x,z,yaw=0,scale=[1,1,1])=>{
    const a=anchor.angle,c=Math.cos(a),s=Math.sin(a),i=placements.length;
    const item={id:'ch5-fortress-kit',component,x:anchor.x+x*c+z*s,z:anchor.z-x*s+z*c,yaw:a+yaw,scale,
      key:`ch5-kit:${component}:${i}`,fallbackName:`ch5-kit-fallback:${component}:${i}`};
    placements.push(item);return item;
  };
  const along=(edge==='east'?e.height:e.width)*tileSize;
  for(const entry of layout.frontage){
    const wall=entry.wall;
    if(!wall){add(pick(entry.component),entry.x,entry.z,entry.yaw??0,[...(pick(entry.scale)??[1,1,1])]);continue;}
    const bays=Math.min(wall.max,Math.max(wall.min,Math.ceil((along*.5-wall.clear)/wall.step)));
    for(const side of [-1,1])for(let i=0;i<bays;i++){
      const x=side*(wall.first+i*wall.step);
      add((side<0&&i===0?pick(wall.breach):undefined)??wall.bay,x,wall.z+i*wall.rise);
      if(i%wall.buttress.every===1)add(wall.buttress.component,x,wall.buttress.z+i*wall.rise);
    }
  }
  // River-facing quay on a lower terrace outside the east/north corner. Water
  // structures use the authored water datum: sampling the lowest bank corner
  // would sink the deck into the carved channel on smaller boards.
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2;
  for(const {component,x,z,yaw,groundY}of layout.quay){
    const i=placements.length;placements.push({id:'ch5-fortress-kit',component,x:hx+x,z:-hz+z,yaw,...(Number.isFinite(groundY)?{groundY}:{}),scale:[1,1,1],key:`ch5-kit:${component}:${i}`,fallbackName:`ch5-kit-fallback:${component}:${i}`});
  }
  return placements;
}

/** Conservative horizontal footprint, including rotation and authored bevels.
 * Consumers and tests use this for full-rectangle clearance, not tile centres. */
export function chapterFivePlacementBounds(placement){
  const [w,,d]=CH5_KIT_COMPONENTS[placement.component],s=placement.scale??[1,1,1],c=Math.abs(Math.cos(placement.yaw)),q=Math.abs(Math.sin(placement.yaw));
  const rx=(w*s[0]*c+d*s[2]*q)/2,rz=(w*s[0]*q+d*s[2]*c)/2;
  return {minX:placement.x-rx,maxX:placement.x+rx,minZ:placement.z-rz,maxZ:placement.z+rz};
}

function fallbackComponent(g,id,p,m){
  const stone=m.stone,brick=m.brick,wood=m.darkWood;
  const box=(x,y,z,w,h,d,mat=stone)=>p.plank(g,x,y,z,w,h,d,mat);
  const wall=(w=4,h=4.5)=>{box(0,.18,0,w+.2,.36,1.5);box(0,h/2+.25,0,w,h,.9,brick);box(0,h+.35,0,w+.2,.22,1.2);for(const x of [-1.5,-.5,.5,1.5])box(x*w/4,h+.78,0,.55,.7,.85,brick);};
  if(id==='wall_bay')wall();
  else if(id==='plaster_repair'){wall(4,2.5);box(.4,1.8,-.49,2.6,1.5,.08,m.plaster);}
  else if(id==='wall_breached'){
    box(0,.18,0,4.2,.36,1.55);for(let i=0;i<5;i++){const h=.8+Math.abs(i-1.5)*1.05;box((i-2)*.78,h/2+.35,0,.76,h,.92,brick);}
  }else if(id==='wall_return'){wall(3.8,3.3);box(-1.5,1.8,1.3,.8,3.6,3.5,brick);}
  else if(id.startsWith('tower_')){
    const broken=id==='tower_broken',h=broken?5.6:7;
    box(0,.22,0,4.9,.44,4.9);box(0,h/2+.35,0,4.15,h,4.15,brick);
    if(broken){box(-1.3,h+.50,0,1.1,1,4.15,brick);box(.1,h+.15,1.5,2.6,.5,1.1,brick);}
    else for(const side of [-1,1])for(const x of [-1.5,-.5,.5,1.5])box(x,h+.8,side*2,.55,.8,.8,brick);
    box(0,h-.05,0,4.5,.2,4.5);for(const side of [-1,1])box(side*1.9,1.5,-2.2,.65,3,.8);
  }else if(id==='gate_arch'){
    const shape=new T.Shape();shape.absarc(0,2.58,2.75,0,Math.PI,false);shape.lineTo(-1.98,2.58);shape.absarc(0,2.58,1.98,Math.PI,0,true);shape.closePath();
    p.mesh(g,p.geo(new T.ExtrudeGeometry(shape,{depth:1.45,bevelEnabled:false,curveSegments:12})),stone,0,0,-.725);
    for(const side of [-1,1])box(side*2.35,1.29,0,.72,2.58,1.45);box(0,5.43,0,6.1,.35,1.62,brick);
  }else if(id==='buttress')for(let i=0;i<6;i++)box(0,.26+i*.5,i*.055,1.15-i*.07,.52,1.65-i*.14);
  else if(id==='mine_frame'){
    for(const z of [-1.2,0,1.2]){for(const x of [-1.12,1.12])box(x,1.1,z,.2,2.2,.2,wood);box(0,2.25,z,2.65,.23,.23,m.wood);}for(let i=0;i<8;i++)box((i-3.5)*.34,2.43,0,.32,.12,2.85,wood);
  }else if(id==='roof_gallery'){
    for(const x of [-2.6,0,2.6])for(const z of [-1.65,1.65])box(x,1.53,z,.19,3.06,.19,wood);
    for(const z of [-1.65,1.65])box(0,3.08,z,5.6,.22,.22,wood);
    const geo=p.geo(new T.PlaneGeometry(6,4,6,4));geo.rotateX(-Math.PI/2);const a=geo.attributes.position;
    for(let i=0;i<a.count;i++)a.setY(i,-.20*Math.cos(a.getX(i)*Math.PI/6)*Math.cos(a.getZ(i)*Math.PI/4));geo.computeVertexNormals();p.mesh(g,geo,m.cloth,0,3.45,0);
  }else if(id==='stair_flight')for(let i=0;i<9;i++)box(0,(i+1)*.11,-1.8+i*.43,2.1,(i+1)*.22,.46);
  else if(id==='landing_deck'){box(0,.48,0,3.8,.15,5.9,wood);for(const x of [-1.65,1.65])for(const z of [-2.6,0,2.6])box(x,.55,z,.2,1.1,.2,wood);}
  else if(id==='quay_revetment'){box(0,.8,0,4,1.6,1.4);box(0,1.8,0,4.2,.26,1.65);}
  else if(id==='bluff_section')for(let i=0;i<5;i++)box(0,.36+i*.72,.25*i,7.2,.78,.9+i*.25);
  else if(id==='drain_channel'){for(const x of [-.8,.8])box(x,.21,0,.28,.42,4);box(0,.055,0,1.35,.11,4);}
  else if(id==='paved_threshold')box(0,.075,0,3.95,.15,2.95);
}

export function addChapterFivePilot(ctx){
  const {root,e,p,m,profile,height,tileSize,geometries}=ctx;
  if(!isChapterFivePilot(e)||profile.chapter!==5)return null;
  const placements=getChapterFiveKitPlacements(e,{chapter:5,tileSize}),structures=[];
  const pilot=p.group(root,0,0,0);pilot.name='Chapter V Euphrates fortress pilot';
  for(const item of placements){
    const b=chapterFivePlacementBounds(item),base=Number.isFinite(item.groundY)?item.groundY:Math.min(...[[item.x,item.z],[b.minX,b.minZ],[b.maxX,b.minZ],[b.minX,b.maxZ],[b.maxX,b.maxZ]].map(([x,z])=>height(x,z)));
    const g=p.group(pilot,item.x,base,item.z,item.yaw);g.name=item.fallbackName;g.scale.fromArray(item.scale);g.userData.component=item.component;g.userData.pilotFallback=true;
    fallbackComponent(g,item.component,p,m);
    // Keep replaceable components as small independent batches. The outer
    // environment batch must not detach them from their visibility owner.
    batchStaticEnvironment(g,{geometries});g.traverse(o=>{if(o.isMesh){o.userData.environmentDynamic=true;o.raycast=()=>{};}});
    structures.push({name:g.name,min:[b.minX,base,b.minZ],max:[b.maxX,base+CH5_KIT_COMPONENTS[item.component][1]*item.scale[1],b.maxZ]});
  }
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2;
  // An irregular distant river ribbon sits beyond the entire north edge.
  // No decorative water or landing masks a walkable cell or creates a ford.
  const positions=[],uv=[],index=[];const length=Math.max(100,hx*2+60);
  for(let i=0;i<=36;i++)for(let side=0;side<2;side++){
    const x=(i/36-.5)*length,r=riverProfile(x,e,tileSize),z=r.near-side*r.width;
    positions.push(x,-1.2,z);uv.push(x*.025,side);
    if(i<36){const j=i*2;index.push(j,j+2,j+1,j+1,j+2,j+3);}
  }
  const geo=p.geo(new T.BufferGeometry());geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(index);geo.computeVertexNormals();
  const river=p.mesh(pilot,geo,m.water);river.name='Euphrates river beyond siege bluff';river.castShadow=false;river.userData.environmentDynamic=true;river.raycast=()=>{};
  root.userData.chapterFivePilot={kit:'ch5-fortress-kit',components:placements.length,materialFamilies:4,landmarkEdge:e.id==='ch5-mine'?'east':'north',revision:1};
  root.userData.precinctStructures=structures;
  root.userData.encounterStaging=profile.staging;
  root.userData.inhabitedSetpieces=structures.filter(s=>s.name.includes('roof_gallery'));
  root.userData.environmentLandmarks.push('fractured Euphrates curtain and mine works','connected river bluff and landing','covered engineering and household courts',profile.staging.title);
  if(e.id==='ch5-camp')addCourtyardServices(ctx,pilot);
  return pilot;
}

/** The service spaces belong to existing interaction anchors. Cantilevered
 * shelters have rear posts inside authored wall cells and no posts on the
 * walking floor. Essential objects are small, visible and remain reachable. */
function addCourtyardServices({root,e,p,m,height,tileSize,geometries},parent){
  const data=e.campPresentation;if(!data)return;
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2,shelters=[],interactions=[];
  const service=id=>data.places?.find(s=>s.id===id);
  function shelter(id,place,edge,width=6.4,depth=6.8){
    if(!place)return;
    const x=edge==='north'?place.x:hx-tileSize*.5,z=edge==='north'?-hz+tileSize*.5:place.z;
    const g=p.group(parent,x,height(x,z),z,edge==='north'?0:-Math.PI/2);g.name=`courtyard ${id} shelter`;
    const ceiling=3.8;
    for(const side of [-1,1]){
      const u=side*width*.46;
      p.plank(g,u,ceiling/2,0,.19,ceiling,.19,m.darkWood);
      // The low end stays inside the blocked perimeter. Braces enter the
      // open floor only above an upright figure's head.
      p.beam(g,[u,2.3,.9],[u,ceiling,depth*.55],.075,m.wood);
      p.beam(g,[u,ceiling,-.18],[u,ceiling,depth],.10,m.wood);
    }
    p.beam(g,[-width*.5,ceiling,depth],[width*.5,ceiling,depth],.09,m.darkWood);
    const geo=p.geo(new T.PlaneGeometry(width,depth,8,8));geo.rotateX(-Math.PI/2);const a=geo.attributes.position;
    for(let i=0;i<a.count;i++){
      const zz=a.getZ(i)+depth/2,xx=a.getX(i);a.setXYZ(i,xx,ceiling+.10-.18*Math.sin(zz/depth*Math.PI)*Math.cos(xx/width*Math.PI),zz);
    }
    geo.computeVertexNormals();p.mesh(g,geo,m.cloth);
    // A restrained dyed edge distinguishes command and aid without text.
    for(const side of [-1,1])p.plank(g,side*width*.4,ceiling-.15,depth,.36,.35,.035,id==='aid'?m.cloth:m.red);
    shelters.push({name:g.name,x,z,width,depth,edge,minimumOverhead:2.3});
  }
  shelter('command',service('principia'),'north',8,6.8);
  shelter('supply',service('quartermaster'),'east',6.2,7.3);
  shelter('aid',service('valetudinarium'),'east',6.6,7.3);
  for(const target of data.interactions??[]){
    if(target.id==='gate')continue;
    const g=p.group(parent,target.x,height(target.x,target.z),target.z);g.name=`courtyard interaction ${target.id}`;g.userData.campInteraction=target.id;
    if(target.kind==='post'){
      p.plank(g,0,.66,0,.18,1.32,.18,m.darkWood);p.plank(g,0,1.12,0,.75,.12,.14,m.wood);
      p.plank(g,0,1.22,.02,.46,.44,.045,m.red);
    }else{
      const report=target.id==='water-board',w=report?.80:1.35,d=report?.55:.85;
      p.plank(g,0,.88,0,w,.09,d,m.wood);
      for(const x of [-w*.4,w*.4])for(const z of [-d*.36,d*.36])p.plank(g,x,.42,z,.065,.84,.065,m.darkWood);
      p.plank(g,0,.943,0,w*.62,.025,d*.70,m.ivory);
      if(!report){p.plank(g,.30,.976,.12,.18,.045,.16,m.terra);p.beam(g,[-.26,.98,-.18],[.16,.98,-.11],.014,m.darkWood);}
    }
    interactions.push({id:target.id,x:target.x,z:target.z});
  }
  const pads=[];
  for(const pad of chapterFiveServicePads(e,tileSize)){
    const g=p.group(parent,pad.x,height(pad.x,pad.z),pad.z,pad.yaw??0);g.name=`ch5-service-pad:${pad.id}`;g.userData.pilotFallback=true;
    if(pad.id==='ch5-cistern'){
      const outer=p.geo(new T.CylinderGeometry(1.3,1.34,.88,20,1,true));p.mesh(g,outer,m.stone,0,.44,0);
      const rim=p.mesh(g,p.geo(new T.TorusGeometry(1.27,.13,6,24)),m.stone,0,.92,0);rim.rotation.x=Math.PI/2;
      const water=p.mesh(g,p.geo(new T.CircleGeometry(1.14,24)),m.water,0,.70,0);water.rotation.x=-Math.PI/2;water.castShadow=false;
      for(const x of [-.65,.65])p.amphora(g,x,0,1.65,.7);
    }else if(pad.id==='ch5-storage-jars'){
      for(const [x,z,s]of [[-.65,-.55,1.05],[.65,-.45,.85],[0,.7,.75]])p.amphora(g,x,0,z,s);
      p.plank(g,0,.055,0,2.6,.11,2.8,m.wood);
    }else{
      p.crate(g,-.55,0,0,.8);p.plank(g,.65,.22,.3,.8,.44,1.2,m.cloth);
      for(const z of [-.1,.7])p.plank(g,.65,.45,z,.84,.035,.055,m.rope);
      p.plank(g,-.55,.85,0,.65,.1,.75,m.cloth);
    }
    // Preserve the ownership group until the matching generated prop loads.
    // Small fallback geometry is static but remains independently hideable.
    batchStaticEnvironment(g,{geometries});g.traverse(o=>{if(o.isMesh){o.userData.environmentDynamic=true;o.raycast=()=>{};}});
    pads.push({id:pad.id,fallbackName:g.name,x:pad.x,z:pad.z});
  }
  const outcomes=[];
  // Committed campaign outcomes remain visible when a downloaded prop hides
  // its fallback. These small work details stay wholly inside blocked pads.
  for(const pad of chapterFiveServicePads(e,tileSize)){
    const g=p.group(parent,pad.x,height(pad.x,pad.z),pad.z);g.name=`courtyard outcomes ${pad.id}`;
    if(pad.id==='ch5-household-bundles'&&data.civilianOutcome==='departing'){
      // A prepared carrying litter beside the family bundles.
      for(const x of [-1.95,-1.42])p.beam(g,[x,.48,-1.8],[x,.48,1.8],.04,m.wood);
      p.plank(g,-1.685,.48,0,.55,.055,2.25,m.cloth);
      for(const z of [-1.25,1.25])p.plank(g,-1.685,.50,z,.59,.045,.055,m.rope);
      outcomes.push('civilian-transport');
    }
    if(pad.id==='ch5-storage-jars'&&data.stores==='secured'){
      // A tied allocation tally beside the secured supply jars.
      p.plank(g,-1.85,.62,0,.12,1.24,.12,m.darkWood);
      p.plank(g,-1.85,1.02,.035,.43,.30,.055,m.wood);
      for(const z of [-.09,.09])p.plank(g,-1.85,.75,z,.16,.035,.035,m.rope);
      outcomes.push('secured-stores');
    }
    if(pad.id==='ch5-cistern'&&data.waterDetail){
      for(const z of [-.7,.7]){
        p.mesh(g,p.geo(new T.CylinderGeometry(.24,.20,.40,12,1,true)),m.wood,-1.75,.20,z);
        const water=p.mesh(g,p.geo(new T.CircleGeometry(.21,12)),m.water,-1.75,.34,z);water.rotation.x=-Math.PI/2;water.castShadow=false;
        p.beam(g,[-1.97,.62,z],[-1.53,.62,z],.025,m.darkWood);
      }
      outcomes.push('filled-water-pails');
    }
    if(pad.id==='ch5-storage-jars'&&data.engineeringRecovered){
      p.plank(g,0,.08,1.8,2.4,.16,.42,m.wood);
      for(const x of [-.8,0,.8]){
        p.beam(g,[x,.18,1.65],[x+.12,.18,2.15],.028,m.darkWood);
        p.plank(g,x+.13,.18,2.13,.30,.075,.12,m.iron);
      }
      outcomes.push('recovered-engineering-tools');
    }
    if(!g.children.length){parent.remove(g);continue;}
    batchStaticEnvironment(g,{geometries});g.traverse(o=>{if(o.isMesh){o.userData.environmentDynamic=true;o.raycast=()=>{};}});
  }
  root.userData.chapterFivePilot.services={shelters,interactions,pads,outcomes};
}
