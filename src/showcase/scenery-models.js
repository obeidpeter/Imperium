import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';

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
export const sceneryModelUrl=(chapter,id)=>`assets/models/chapters/${String(chapter).padStart(2,'0')}/${id}.glb`;

/** World placements for an encounter, or none where the chapter has no scenery. */
export function sceneryPlacements(e,{chapter}={}){
  const set=SCENERY_MODELS[chapter];
  if(!set||!set.encounters.includes(e?.id))return [];
  return set.models.map(m=>({id:m.id,url:sceneryModelUrl(chapter,m.id),x:m.x,z:m.z,yaw:m.yaw}));
}

const loadScene=url=>{
  const loader=new GLTFLoader();
  loader.register(parser=>{parser.textureLoader=new T.TextureLoader(parser.options.manager);return {name:'IMPERIUM_IMAGE_ELEMENTS'};});
  return loader.loadAsync(url).then(gltf=>gltf.scene);
};
const TEXTURES=['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'];

export function createSceneryModels(scene,e,{chapter,quality='balanced',heightAt=()=>0,load=loadScene,prepare=null}={}){
  const group=new T.Group(),owned=new Set();group.name='generated scenery';scene.add(group);
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
  const ready=Promise.all(placements.map(async p=>{
    let model;
    try{model=await load(p.url);}catch{return null;}
    track(model);
    if(disposed)return null;
    model.name=p.id;model.position.set(p.x,0,p.z);model.rotation.y=p.yaw;model.updateMatrixWorld(true);
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.raycast=()=>{};}});
    ground(model);
    // The stage readies a model (its cutaway and shaders) before it is ever drawn.
    if(prepare){try{await prepare(model);}catch{}if(disposed)return null;}
    group.add(model);return p.id;
  })).then(ids=>ids.filter(Boolean));
  return {group,placements,ready,
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const r of owned)r.dispose?.();owned.clear();}};
}
