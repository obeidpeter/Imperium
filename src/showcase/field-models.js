import * as T from '../../vendor/three/three.module.js';
import {FIELD_OBJECT_MODELS,BATTLE_PROP_MODELS,worldModelUrl,worldAssetShown} from '../ui/world-catalog.js';
import {gridToWorld,roadSegments} from './environment-layout.js';
import {createRoadSurfaceSampler} from './environment-road-surface.js';

// The battle's field objects drawn from generated models (graphics plan, G5): each model draws its kind in the
// states it names (world-catalog.js), on the object's cell, in place of the code-built piece (environment-fieldwork.js),
// which stays for every other state, on Performance and while the model is not loaded. A load rides on the model it
// names (the supply cart's sacks, while the supplies are still to be recovered). Like the board kit's pieces
// (board-kit.js), each mesh of each model is one instanced draw with white instance colours, so the models share the
// scenery's shader programs. The battles' set pieces beyond the board (a carroballista, an onager) are scenery
// placements instead, placed here and drawn with the rest of the scene's scenery (scenery-models.js). Presentation
// only: placements are read from the stage encounter, never from the scene; no piece takes picks or changes a route.

// Battles draw field objects (battlefield-features.js): a campaign battle, not the training ground.
const fieldBattle=e=>e?.featureEdition===31&&e.kind==='battle'&&e.type!=='training'&&Array.isArray(e.field?.objects);
const shown=(id,chapter,desktop)=>FIELD_OBJECT_MODELS[id]&&worldModelUrl(id)&&worldAssetShown(id,chapter,desktop===undefined?{}:{desktop});

/** The field-object models a battle of this chapter may draw, as [id, url] pairs: those its chapter shows,
 * whatever objects stand now, since a phase can bring its works later (field-missions.js). */
export function fieldModelUrls(e,{chapter,desktop}={}){
  if(!fieldBattle(e))return [];
  return Object.keys(FIELD_OBJECT_MODELS).filter(id=>shown(id,chapter,desktop)&&FIELD_OBJECT_MODELS[id].chapters.includes(chapter)).map(id=>[id,worldModelUrl(id)]);
}

/** The model that draws a field object in its state here, or null: a gate's timber panel (live-figures.js) is the
 * gate's, never a barricade's. */
export function fieldObjectModel(o,{chapter,desktop}={}){
  if(!o||o.gatePanel)return null;
  return Object.keys(FIELD_OBJECT_MODELS).find(id=>{const m=FIELD_OBJECT_MODELS[id];
    return !m.on&&m.kind===o.kind&&m.states.includes(o.state)&&m.chapters.includes(chapter)&&shown(id,chapter,desktop);})??null;
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
  const loadsOf=(id,state)=>Object.entries(FIELD_OBJECT_MODELS).filter(([,l])=>l.on?.model===id&&l.states.includes(state)).map(([load])=>load);
  for(const o of e.field.objects){
    const id=fieldObjectModel(o,{chapter,desktop});if(!id||!has(id))continue;
    if(loadsOf(id,o.state).some(load=>!shown(load,chapter,desktop)||!has(load)))continue;
    if(!Number.isInteger(o.x)||!Number.isInteger(o.y)||o.x<0||o.y<0||o.x>=e.width||o.y>=e.height)continue;
    const p=gridToWorld(o,e,tileSize),m=FIELD_OBJECT_MODELS[id],base=m.yaw??0;
    for(const copy of m.copies??[{}]){
      const at=turned(p.x,p.z,base,copy.x,copy.z),yaw=base+(copy.yaw??0);
      out.push({model:id,object:o.id,x:at.x,z:at.z,yaw});
      for(const load of loadsOf(id,o.state)){
        // The load's offset is in its carrier's own frame, turned with it.
        const l=FIELD_OBJECT_MODELS[load].on,on=turned(at.x,at.z,yaw,l.x,l.z);
        out.push({model:load,object:o.id,x:on.x,z:on.z,yaw,on:id,lift:l.lift});
      }
    }
  }
  return out;
}

// The set pieces' spots along the west edge, tried in turn: the model's own share of the half-depth first, then
// further north and south of it, each a few metres out and then further.
const ALONG_STEPS=Object.freeze([0,-.1,.1,-.2,.2,-.3,.3,-.45,.45]),GAPS=Object.freeze([4,5.5,7]);
// Clear room about a set piece: from the scene's other scenery and buildings, and from a road's centre line.
const PROP_MARGIN=1,ROAD_CLEARANCE=2.4;

/** Whether a battle sets out any set piece beyond the board (BATTLE_PROP_MODELS). */
export const hasBattleProps=e=>Object.values(BATTLE_PROP_MODELS).some(m=>m.encounters.includes(e?.id));

/** The set pieces a battle sets out beyond the board's west edge (BATTLE_PROP_MODELS), behind the Roman line: each
 * a few metres out, on the first spot whose footprint is clear of the roads that leave the board, of `occupied` (the
 * scene's other scenery and buildings, as {minX, maxX, minZ, maxZ}) and of the set pieces before it. Scenery
 * placements, with no code-built stand-in: Performance and a failed download leave the ground empty. */
export function battlePropPlacements(e,{tileSize=2.5,occupied=[]}={}){
  if(e?.kind!=='battle'||!Number.isInteger(e.width)||!Number.isInteger(e.height)||e.width<=0||e.height<=0)return [];
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2,road=createRoadSurfaceSampler(roadSegments(e,tileSize),tileSize).distance,taken=[...occupied],out=[];
  const overlaps=(a,b)=>a.maxX+PROP_MARGIN>b.minX&&a.minX-PROP_MARGIN<b.maxX&&a.maxZ+PROP_MARGIN>b.minZ&&a.minZ-PROP_MARGIN<b.maxZ;
  for(const [id,m]of Object.entries(BATTLE_PROP_MODELS)){
    const url=worldModelUrl(id);if(!url||!m.encounters.includes(e.id))continue;
    const w=m.fit.width/2,d=m.fit.depth/2;let spot=null;
    for(const gap of GAPS){for(const step of ALONG_STEPS){
      const along=Math.max(-.9,Math.min(.9,m.along+step)),x=-hx-gap,z=along*hz,b={minX:x-w,maxX:x+w,minZ:z-d,maxZ:z+d};
      const corners=[[x,z],[b.minX,b.minZ],[b.minX,b.maxZ],[b.maxX,b.minZ],[b.maxX,b.maxZ]];
      if(corners.some(([cx,cz])=>road(cx,cz)<ROAD_CLEARANCE)||taken.some(o=>overlaps(b,o)))continue;
      spot={x,z,b};break;
    }if(spot)break;}
    if(!spot)continue;
    taken.push(spot.b);out.push({id,url,x:spot.x,z:spot.z,yaw:m.yaw,fitWithin:{width:m.fit.width,depth:m.fit.depth}});
  }
  return out;
}

/** Each placement's model drawn instanced in the group; a carrier stands on the lowest ground under its footprint, its
 * load at its lift above the carrier. Returns each object's drawn bounds (for the field's records), its stats, and
 * dispose, which frees only the instance buffers: the masters' geometry and materials are the cache's. */
export function createFieldModelPieces(group,models,placements,{heightAt=()=>0,finish=null}={}){
  const byModel=new Map(),bounds=new Map(),sets=[];
  for(const p of placements)if(models.get(p.model)){if(!byModel.has(p.model))byModel.set(p.model,[]);byModel.get(p.model).push(p);}
  const yawQ=new T.Quaternion(),up=new T.Vector3(0,1,0),one=new T.Vector3(1,1,1),at=new T.Vector3(),place=new T.Matrix4(),each=new T.Matrix4();
  const ground=(x,z)=>{const y=heightAt(x,z);return Number.isFinite(y)?y:0;};
  // Carriers first, so a load finds its carrier's ground.
  const base=new Map();
  const order=[...byModel.keys()].sort((a,b)=>(FIELD_OBJECT_MODELS[a].on?1:0)-(FIELD_OBJECT_MODELS[b].on?1:0));
  for(const id of order){
    const master=models.get(id),list=byModel.get(id);master.updateWorldMatrix(true,true);
    // Each mesh and the footprint in the master's own frame, wherever the cache holds it.
    const inverse=master.matrixWorld.clone().invert(),box=new T.Box3().setFromObject(master,true).applyMatrix4(inverse),meshes=[];
    master.traverse(o=>{
      if(!o.isMesh)return;
      const mesh=new T.InstancedMesh(o.geometry,o.material,list.length);mesh.name=`field model ${id} ${o.name}`;
      // White instance colours: the shader programs (and shadow pass) of the scenery's other batches.
      mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(list.length*3).fill(1),3);
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.raycast=()=>{};finish?.(o.material);
      meshes.push({mesh,local:inverse.clone().multiply(o.matrixWorld)});group.add(mesh);
    });
    list.forEach((p,i)=>{
      const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
      // The footprint's corners after the yaw, on the ground: the lowest holds the model.
      const corners=[[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([u,w])=>ground(p.x+u*c+w*s,p.z-u*s+w*c));
      const y=p.on?(base.get(p.object)??ground(p.x,p.z))+(p.lift??0):Math.min(ground(p.x,p.z),...corners)-box.min.y;
      if(!p.on)base.set(p.object,y+box.min.y);
      yawQ.setFromAxisAngle(up,p.yaw);place.compose(at.set(p.x,y,p.z),yawQ,one);
      for(const {mesh,local}of meshes)mesh.setMatrixAt(i,each.multiplyMatrices(place,local));
      const drawn=box.clone().applyMatrix4(place),prior=bounds.get(p.object);
      bounds.set(p.object,prior?prior.union(drawn):drawn);
    });
    for(const {mesh}of meshes)mesh.instanceMatrix.needsUpdate=true;
    sets.push({id,count:list.length,meshes});
  }
  return {
    bounds,
    stats:()=>({models:sets.length,instances:sets.reduce((n,s)=>n+s.count,0),drawn:sets.reduce((n,s)=>n+s.meshes.length,0)}),
    dispose(){for(const set of sets)for(const {mesh}of set.meshes){mesh.removeFromParent();mesh.dispose();}sets.length=0;}
  };
}
