import * as T from '../../vendor/three/three.module.js';
import {FIELD_OBJECT_MODELS,BATTLE_PROP_MODELS,AFTERMATH_DEBRIS_MODELS,SET_PIECE_ANIMALS,ANIMAL_FOOTPRINTS,animalModelUrl,worldModelUrl,worldAssetShown} from '../ui/world-catalog.js';
import {gridToWorld,roadSegments,distantRiverCentre} from './environment-layout.js';
import {createRoadSurfaceSampler} from './environment-road-surface.js';
import {createWaterLevelSampler,DISTANT_RIVER_LEVEL} from './environment-water.js';

// The battle's field objects drawn from generated models (graphics plan, G5): each model draws its kind in the
// states it names (world-catalog.js), on the object's cell, in place of the code-built piece (environment-fieldwork.js),
// which stays for every other state, on Performance and while the model is not loaded. A load rides on the model it
// names (the supply cart's sacks, while the supplies are still to be recovered). On the walked field after a win, the
// beaten side's gear lies beside its fallen (AFTERMATH_DEBRIS_MODELS). Each copy of a model is drawn as the
// scenery's placed models are, plain meshes over the cached model's geometry and materials, so the models share the
// scenery's shader programs: an instanced draw would compile the instanced variant of the generated art's program,
// which no battle's scenery uses, for a model that stands at most twice. The battles' set pieces beyond the board (a carroballista, an onager) are scenery
// placements instead, placed here and drawn with the rest of the scene's scenery (scenery-models.js). Presentation
// only: placements are read from the stage encounter, never from the scene; no piece takes picks or changes a route.

// Battles draw field objects (battlefield-features.js): a campaign battle, not the training ground.
const fieldBattle=e=>e?.featureEdition===31&&e.kind==='battle'&&e.type!=='training'&&Array.isArray(e.field?.objects);
const catalogued=id=>FIELD_OBJECT_MODELS[id]??AFTERMATH_DEBRIS_MODELS[id];
const shown=(id,chapter,desktop)=>catalogued(id)&&worldModelUrl(id)&&worldAssetShown(id,chapter,desktop===undefined?{}:{desktop});

/** The field-object and debris models a battle of this chapter may draw, as [id, url] pairs: those its chapter shows,
 * whatever objects stand now, since a phase can bring its works later (field-missions.js) and a won field is walked. */
export function fieldModelUrls(e,{chapter,desktop}={}){
  if(!fieldBattle(e))return [];
  return [...Object.keys(FIELD_OBJECT_MODELS),...Object.keys(AFTERMATH_DEBRIS_MODELS)]
    .filter(id=>shown(id,chapter,desktop)&&catalogued(id).chapters.includes(chapter)).map(id=>[id,worldModelUrl(id)]);
}

/** The model that draws a field object in its state here, or null: a gate's timber panel (live-figures.js) is the
 * gate's, never a barricade's. */
export function fieldObjectModel(o,{chapter,desktop}={}){
  if(!o||o.gatePanel)return null;
  return Object.keys(FIELD_OBJECT_MODELS).find(id=>{const m=FIELD_OBJECT_MODELS[id];
    return !m.load&&m.kind===o.kind&&m.states.includes(o.state)&&m.chapters.includes(chapter)&&shown(id,chapter,desktop);})??null;
}

// A point at u, w in a frame turned by yaw about the vertical, from x, z: the turn the pieces' matrices make.
const turned=(x,z,yaw,u=0,w=0)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return {x:x+u*c+w*s,z:z-u*s+w*c};};

/** Where each model stands: the objects' cells (once, or at each of its copies), each model's own yaw, and the loads
 * that ride on them. */
export function fieldModelPlacements(e,{chapter,tileSize=2.5,desktop,available=null}={}){
  if(!fieldBattle(e))return [];
  const has=id=>!available||available.has(id),out=[];
  // The loads a carrier bears in a state: drawn with it, or the code-built piece stands instead, so a cart never
  // stands empty while its supplies are still to be recovered.
  const loadsOf=(id,state)=>Object.entries(FIELD_OBJECT_MODELS[id].loads??{}).filter(([load])=>FIELD_OBJECT_MODELS[load]?.states.includes(state));
  for(const o of e.field.objects){
    const id=fieldObjectModel(o,{chapter,desktop});if(!id||!has(id))continue;
    if(loadsOf(id,o.state).some(([load])=>!shown(load,chapter,desktop)||!has(load)))continue;
    if(!Number.isInteger(o.x)||!Number.isInteger(o.y)||o.x<0||o.y<0||o.x>=e.width||o.y>=e.height)continue;
    const p=gridToWorld(o,e,tileSize),m=FIELD_OBJECT_MODELS[id],base=m.yaw??0;
    for(const copy of m.copies??[{}]){
      const at=turned(p.x,p.z,base,copy.x,copy.z),yaw=base+(copy.yaw??0);
      out.push({model:id,object:o.id,x:at.x,z:at.z,yaw});
      for(const [load,l]of loadsOf(id,o.state)){
        // The load's offset is in its carrier's own frame, turned with it.
        const on=turned(at.x,at.z,yaw,l.x,l.z);
        out.push({model:load,object:o.id,x:on.x,z:on.z,yaw:yaw+(l.yaw??0),on:id,lift:l.lift});
      }
    }
  }
  return out;
}

// The set pieces' spots along the west edge, tried in turn: the model's own share of the half-depth first, then
// further north and south of it, each a few metres out and then further.
const ALONG_STEPS=Object.freeze([0,-.1,.1,-.2,.2,-.3,.3,-.45,.45,-.6,.6,-.75,.75]),GAPS=Object.freeze([4,5.5,7]);
// A boat's spots on the distant river beyond the north edge: across its stream from the centre line out, each tried
// along the river as the edges' spots are.
const RIVER_OFFSETS=Object.freeze([0,-1.5,1.5,-3,3]);
// Clear room about a set piece: from the scene's other scenery and buildings, and from a road's centre line.
const PROP_MARGIN=1,ROAD_CLEARANCE=2.4;

/** Whether a battle sets out any set piece beyond the board (BATTLE_PROP_MODELS). */
export const hasBattleProps=e=>Object.values(BATTLE_PROP_MODELS).some(m=>m.encounters.includes(e?.id));

/** The set pieces a battle sets out beyond the board (BATTLE_PROP_MODELS): beyond its west edge, behind the Roman line,
 * or beyond its north edge, which the camera sees behind both armies, each a few metres out, on the first spot whose
 * footprint is clear of the roads that leave the board, of `occupied` (the scene's other scenery and buildings, as
 * {minX, maxX, minZ, maxZ}) and of the set pieces before it; a piece `beside` another stands at its offset from that
 * piece, or the offset mirrored, clear of it and of the rest. A boat (`edge: 'river'`) floats on the distant river
 * beyond the north edge, where the scene has one: on the first spot whose footprint lies wholly where the river's own
 * surface shows, sunk `draft` metres below it (its `groundY`). Scenery placements, with no code-built stand-in:
 * Performance and a failed download leave the ground empty. */
export function battlePropPlacements(e,{tileSize=2.5,occupied=[],chapter}={}){
  if(e?.kind!=='battle'||!Number.isInteger(e.width)||!Number.isInteger(e.height)||e.width<=0||e.height<=0)return [];
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2,road=createRoadSurfaceSampler(roadSegments(e,tileSize),tileSize).distance,taken=[...occupied],out=[];
  // Dry ground only: no point of a piece's room in the scene's water (a marsh, a river leaving the board, the distant river).
  // A boat floats only where the distant river's own surface shows, not under a river that leaves the board and runs on
  // over it at its own, higher level.
  const water=createWaterLevelSampler(e,{chapter,tileSize}),points=b=>{const out=[];for(let i=0;i<=4;i++)for(let j=0;j<=4;j++)out.push([b.minX+(b.maxX-b.minX)*i/4,b.minZ+(b.maxZ-b.minZ)*j/4]);return out;};
  const dry=b=>points(b).every(([x,z])=>water(x,z)===null),afloat=b=>points(b).every(([x,z])=>water(x,z)===DISTANT_RIVER_LEVEL);
  const overlaps=(a,b,margin=PROP_MARGIN)=>a.maxX+margin>b.minX&&a.minX-margin<b.maxX&&a.maxZ+margin>b.minZ&&a.minZ-margin<b.maxZ;
  const box=(x,z,m)=>({minX:x-m.fit.width/2,maxX:x+m.fit.width/2,minZ:z-m.fit.depth/2,maxZ:z+m.fit.depth/2});
  const open=(b,except=null)=>[[b.minX,b.minZ],[b.minX,b.maxZ],[b.maxX,b.minZ],[b.maxX,b.maxZ],[(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2]]
    .every(([cx,cz])=>road(cx,cz)>=ROAD_CLEARANCE)&&taken.every(o=>o===except?!overlaps(b,o,0):!overlaps(b,o));
  const clear=(b,except=null)=>open(b,except)&&dry(b);
  for(const [id,m]of Object.entries(BATTLE_PROP_MODELS)){
    const url=worldModelUrl(id);if(!url||!m.encounters.includes(e.id))continue;
    let spot=null;
    if(m.beside){
      const host=out.find(p=>p.id===m.beside.model);if(!host)continue;
      for(const [u,w]of [[m.beside.x,m.beside.z],[m.beside.x,-m.beside.z],[-m.beside.x,m.beside.z],[-m.beside.x,-m.beside.z]]){
        const at=turned(host.x,host.z,host.yaw??0,u,w),b=box(at.x,at.z,m);
        if(clear(b,host.box)){spot={x:at.x,z:at.z,b,yaw:m.yaw??host.yaw??0};break;}
      }
    }else if(m.edge==='river'){
      const centre=distantRiverCentre(e,tileSize);
      for(const dz of RIVER_OFFSETS){for(const step of ALONG_STEPS){
        const along=Math.max(-.9,Math.min(.9,m.along+step)),x=along*hx,z=centre+dz,b=box(x,z,m);
        if(open(b)&&afloat(b)){spot={x,z,b,yaw:m.yaw??0,groundY:DISTANT_RIVER_LEVEL-m.draft};break;}
      }if(spot)break;}
    }else{
      const north=m.edge==='north';
      for(const gap of GAPS){for(const step of ALONG_STEPS){
        const along=Math.max(-.9,Math.min(.9,m.along+step)),x=north?along*hx:-hx-gap,z=north?-hz-gap:along*hz,b=box(x,z,m);
        if(clear(b)){spot={x,z,b,yaw:m.yaw??0};break;}
      }if(spot)break;}
    }
    if(!spot)continue;
    taken.push(spot.b);out.push({id,url,x:spot.x,z:spot.z,yaw:spot.yaw,fitWithin:{width:m.fit.width,depth:m.fit.depth},box:spot.b,...(Number.isFinite(spot.groundY)?{groundY:spot.groundY}:{})});
  }
  // The pieces' animals (G4, SET_PIECE_ANIMALS), once every piece has its spot, so that no piece moves for them: each
  // pair in its piece's first formation, as given or mirrored across the piece's length, its breadth or both, where every
  // animal stands clear of the piece, of the rest and of the roads, off the board and on dry ground. Each faces as its
  // offset says, mirrored with it. An animal is a placement of its own that names its piece (`host`), with no
  // code-built stand-in.
  const animals=[],offBoard=b=>b.maxX< -hx||b.minX>hx||b.maxZ< -hz||b.minZ>hz;
  for(const host of [...out]){
    const formations=SET_PIECE_ANIMALS[host.id];if(!formations||formations.flat().some(([model])=>!animalModelUrl(model,chapter)))continue;
    placing:for(const herd of formations)for(const [mx,mz]of [[1,1],[1,-1],[-1,1],[-1,-1]]){
      const herdBoxes=[],spots=herd.map(([model,u,w,turn])=>{
        const at=turned(host.x,host.z,host.yaw??0,mx*u,mz*w),yaw=(host.yaw??0)+mz*(mx>0?turn:Math.PI-turn),[length,breadth]=ANIMAL_FOOTPRINTS[model];
        const c=Math.abs(Math.cos(yaw)),n=Math.abs(Math.sin(yaw)),hw=(length*c+breadth*n)/2,hd=(length*n+breadth*c)/2;
        return {model,x:at.x,z:at.z,yaw,b:{minX:at.x-hw,maxX:at.x+hw,minZ:at.z-hd,maxZ:at.z+hd}};
      });
      if(!spots.every(spot=>{const ok=offBoard(spot.b)&&clear(spot.b,host.box)&&herdBoxes.every(o=>!overlaps(spot.b,o,0));herdBoxes.push(spot.b);return ok;}))continue;
      spots.forEach(({model,x,z,yaw,b},k)=>{taken.push(b);animals.push({id:model,key:`${host.id}:${model}:${k}`,url:animalModelUrl(model,chapter),host:host.id,x,z,yaw,fitWithin:{width:4.4,depth:4.4}});});
      break placing;
    }
  }
  return [...out.map(({box:_,...p})=>p),...animals];
}

// The walked field's debris (AFTERMATH_DEBRIS_MODELS): at most this many spots, each beside one of the fallen and at
// least this far from the others, a little off the body; the first spot of each field takes the fallen war banner.
const DEBRIS_SPOTS=6,DEBRIS_SPACING=6,DEBRIS_OFFSET=1.1;
const debrisHash=(...values)=>{let h=2166136261;for(const c of values.join(':'))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295;};

/** On the walked field after a win (the stage encounter's `aftermath`), the beaten side's gear beside its fallen: the
 * chapter's debris model at up to six spots spread over the field, each a little off one of the fallen, on the board
 * and clear of the field objects' cells, the first of them the fallen war banner. The fallen and their order come from
 * the world (no randomness is drawn): each spot is chosen by a hash of the fallen man's id. Presentation only. */
export function aftermathDebrisPlacements(e,{chapter,tileSize=2.5,desktop,available=null}={}){
  const fallen=e?.aftermath?.fallen;if(!fieldBattle(e)||!Array.isArray(fallen)||!fallen.length)return [];
  const has=id=>(!available||available.has(id))&&shown(id,chapter,desktop);
  const pick=standard=>Object.keys(AFTERMATH_DEBRIS_MODELS).find(id=>!!AFTERMATH_DEBRIS_MODELS[id].standard===standard&&AFTERMATH_DEBRIS_MODELS[id].chapters.includes(chapter)&&has(id))??null;
  const gear=pick(false),banner=pick(true);if(!gear&&!banner)return [];
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2;
  const cells=(e.field?.objects??[]).filter(o=>Number.isInteger(o.x)&&Number.isInteger(o.y)).map(o=>gridToWorld(o,e,tileSize));
  const order=fallen.filter(f=>Number.isFinite(f?.x)&&Number.isFinite(f?.z)).map(f=>({...f,h:debrisHash(e.id,f.id)})).sort((a,b)=>a.h-b.h);
  const spots=[],out=[];
  for(const f of order){
    if(spots.length>=DEBRIS_SPOTS)break;
    const a=f.h*Math.PI*2*7,x=f.x-hx+Math.cos(a)*DEBRIS_OFFSET,z=f.z-hz+Math.sin(a)*DEBRIS_OFFSET;
    if(Math.abs(x)>hx-1.5||Math.abs(z)>hz-1.5||spots.some(s=>Math.hypot(s.x-x,s.z-z)<DEBRIS_SPACING)||cells.some(c=>Math.hypot(c.x-x,c.z-z)<2.2))continue;
    const model=spots.length===0&&banner?banner:gear??banner;spots.push({x,z});
    out.push({model,object:`debris-${spots.length}`,x,z,yaw:f.h*Math.PI*2*13});
  }
  return out;
}

/** Each placement's model drawn in the group as plain meshes over the master's geometry and materials, as the
 * scenery's placed models are; a carrier stands on the lowest ground under its footprint, its load at its lift above
 * the carrier. Returns each object's drawn bounds (for the field's records), the meshes (which the field's static
 * batching leaves as they are: their geometry is the cache's), its stats, and dispose, which only takes the meshes out
 * of the group: the masters' geometry and materials are the cache's. */
export function createFieldModelPieces(group,models,placements,{heightAt=()=>0,finish=null}={}){
  const byModel=new Map(),bounds=new Map(),sets=[],meshes=[];
  for(const p of placements)if(models.get(p.model)){if(!byModel.has(p.model))byModel.set(p.model,[]);byModel.get(p.model).push(p);}
  const yawQ=new T.Quaternion(),up=new T.Vector3(0,1,0),one=new T.Vector3(1,1,1),at=new T.Vector3(),place=new T.Matrix4(),each=new T.Matrix4();
  const ground=(x,z)=>{const y=heightAt(x,z);return Number.isFinite(y)?y:0;};
  // Carriers first, so a load finds its carrier's ground.
  const base=new Map();
  const order=[...byModel.keys()].sort((a,b)=>(catalogued(a)?.load?1:0)-(catalogued(b)?.load?1:0));
  for(const id of order){
    const master=models.get(id),list=byModel.get(id);master.updateWorldMatrix(true,true);
    // Each mesh and the footprint in the master's own frame, wherever the cache holds it.
    const inverse=master.matrixWorld.clone().invert(),box=new T.Box3().setFromObject(master,true).applyMatrix4(inverse),parts=[];
    master.traverse(o=>{if(!o.isMesh)return;parts.push({source:o,local:inverse.clone().multiply(o.matrixWorld)});finish?.(o.material);});
    let drawn=0;
    for(const p of list){
      const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
      // The footprint's corners after the yaw, on the ground: the lowest holds the model.
      const corners=[[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([u,w])=>ground(p.x+u*c+w*s,p.z-u*s+w*c));
      const y=p.on?(base.get(p.object)??ground(p.x,p.z))+(p.lift??0):Math.min(ground(p.x,p.z),...corners)-box.min.y;
      if(!p.on)base.set(p.object,y+box.min.y);
      yawQ.setFromAxisAngle(up,p.yaw);place.compose(at.set(p.x,y,p.z),yawQ,one);
      for(const {source,local}of parts){
        const mesh=new T.Mesh(source.geometry,source.material);mesh.name=`field model ${id} ${source.name}`;
        each.multiplyMatrices(place,local).decompose(mesh.position,mesh.quaternion,mesh.scale);
        mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};group.add(mesh);meshes.push(mesh);drawn++;
      }
      const placed=box.clone().applyMatrix4(place),prior=bounds.get(p.object);
      bounds.set(p.object,prior?prior.union(placed):placed);
    }
    sets.push({id,count:list.length,drawn});
  }
  return {
    bounds,meshes,
    stats:()=>({models:sets.length,instances:sets.reduce((n,s)=>n+s.count,0),drawn:sets.reduce((n,s)=>n+s.drawn,0)}),
    dispose(){for(const mesh of meshes)mesh.removeFromParent();meshes.length=0;sets.length=0;}
  };
}
