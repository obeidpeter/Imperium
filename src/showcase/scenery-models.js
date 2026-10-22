import * as T from '../../vendor/three/three.module.js';
import {createModelLoader} from './model-loader.js';
import {worldModelUrl} from '../ui/world-catalog.js';

/** Generated scenery (docs/asset-pipeline.md): Tripo models processed in
 * Blender, set outside the playable board in chosen encounters. Positions
 * are metres from the board centre (x across its width, z across its depth).
 * Presentation only: no rules state and no gameplay randomness. A model that
 * fails to load is simply absent; Performance quality loads none. */
export const SCENERY_MODELS=Object.freeze({
  5:Object.freeze({encounters:Object.freeze(['ch5-mine','ch5-wall']),models:Object.freeze([
    // Supplies along the southern approach and a tent at its south-west
    // corner. A search of the built scenes chose this ground: clear of every
    // structure, wall and boulder, in frame and unobstructed for the overview
    // camera in both encounters, and never drawn over the board, so no unit
    // is hidden. From the horizon camera, buildings hide most of it.
    {id:'ch5-leather-tent',x:-24,z:14,yaw:.4},
    {id:'ch5-spoil-baskets',x:-20,z:16,yaw:.5},
    {id:'ch5-storage-jars',x:-14,z:19,yaw:.2},
    {id:'ch5-gallery-timbers',x:-11,z:18,yaw:.9},
    {id:'ch5-mudbrick-stack',x:-7,z:20,yaw:1.1}
  ].map(Object.freeze))})
});
// Each model's file, and the chapters that download it, are in the world catalog.
export const sceneryModelUrl=id=>worldModelUrl(id);

/** World placements for an encounter, or none where the chapter has no scenery. */
export function sceneryPlacements(e,{chapter}={}){
  const set=SCENERY_MODELS[chapter];
  if(!set||!set.encounters.includes(e?.id))return [];
  return set.models.map(m=>({id:m.id,url:sceneryModelUrl(m.id),x:m.x,z:m.z,yaw:m.yaw}));
}

const loadScene=url=>createModelLoader().loadAsync(url).then(gltf=>gltf.scene);
const TEXTURES=['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'];

// One immutable master per model and session, as for the generated bodies. The
// battle preloader loads a battle's masters before its stage is built; a stage
// then places its own copies at once, sharing the masters' geometry, materials
// and textures, so they compile and upload behind the veil with everything else.
const masters=new Map();
export function warmSceneryModel(url,load=loadScene){
  let entry=masters.get(url);
  if(!entry){
    entry={scene:null};
    entry.promise=Promise.resolve().then(()=>load(url)).then(scene=>(entry.scene=scene),error=>{masters.delete(url);throw error;});
    masters.set(url,entry);
  }
  return entry.promise;
}
export const sceneryMaster=url=>masters.get(url)?.scene??null;
export function preloadSceneryModels(e,{chapter,quality='balanced'}={}){
  const placements=quality==='performance'?[]:sceneryPlacements(e,{chapter});
  return Promise.all(placements.map(p=>warmSceneryModel(p.url).then(()=>true,()=>false)));
}

// Without a load function a stage uses the session's masters and never frees
// them; a given load function's models belong to the stage and are freed with it.
export function createSceneryModels(scene,e,{chapter,quality='balanced',heightAt=()=>0,load=null,prepare=null}={}){
  const group=new T.Group(),owned=new Set(),shared=!load;group.name='generated scenery';scene.add(group);
  let disposed=false;
  // Resources are owned until dispose; a model that arrives after dispose is freed at once.
  const track=model=>{
    const found=new Set();model.traverse(o=>{if(!o.isMesh)return;found.add(o.geometry);for(const m of [o.material].flat()){found.add(m);for(const k of TEXTURES)if(m[k])found.add(m[k]);}});
    for(const r of found)disposed?r.dispose?.():owned.add(r);
  };
  // The model stands on its lowest ground sample, so no corner floats on a slope.
  const ground=model=>{
    const box=new T.Box3().setFromObject(model,true),{x,z}=model.position;
    const samples=[[x,z],[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([sx,sz])=>heightAt(sx,sz)).filter(Number.isFinite);
    model.position.y=samples.length?Math.min(...samples):0;
  };
  const placements=quality==='performance'?[]:sceneryPlacements(e,{chapter});
  const place=(p,source)=>{
    const model=shared?source.clone():source;
    model.name=p.id;model.position.set(p.x,0,p.z);model.rotation.y=p.yaw;model.updateMatrixWorld(true);
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.raycast=()=>{};}});
    ground(model);return model;
  };
  // Masters already loaded stand at once (the stage readies them with the rest).
  const placed=[],pending=[];
  for(const p of placements){const master=shared?sceneryMaster(p.url):null;if(master){group.add(place(p,master));placed.push(p.id);}else pending.push(p);}
  const ready=Promise.all(pending.map(async p=>{
    let source;
    try{source=shared?await warmSceneryModel(p.url):await load(p.url);}catch{return null;}
    if(!shared)track(source);
    if(disposed)return null;
    const model=place(p,source);
    // The stage readies a late model (its cutaway and shaders) before it is ever drawn.
    if(prepare){try{await prepare(model);}catch{}if(disposed)return null;}
    group.add(model);return p.id;
  })).then(ids=>[...placed,...ids.filter(Boolean)]);
  return {group,placements,ready,
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const r of owned)r.dispose?.();owned.clear();}};
}
