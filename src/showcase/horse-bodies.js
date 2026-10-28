import * as T from '../../vendor/three/three.module.js';
import {createModelLoader} from './model-loader.js';
import {installCloudShadows} from './atmosphere.js';
import {horseBodyUrl} from '../ui/actor-body-catalog.js';
import {GENERATED_HORSE_MOTION} from './actor-gait.js';
import {HORSE_LEGS,horseFrameFromModel} from './horse-frame.js';

// The horse's joints a generated coat is skinned to, named as bind-horse.py exports them;
// the rig itself repeats horse-knee and horse-fetlock on every leg.
export const HORSE_JOINTS=Object.freeze(['horse',...HORSE_LEGS.flatMap(leg=>[`${leg}-leg`,`${leg}-knee`,`${leg}-fetlock`]),'horse-body','horse-neck','horse-head','horse-left-ear','horse-right-ear','horse-tail']);
// The code-built horse's surfaces a coat replaces: all on the horse's own joints, its tack
// with them, for the coat brings its own bridle. The saddle, on a joint of its own, stays:
// the generated back is fitted under it.
export const HORSE_REPLACES=/^(horse|horse-(body|neck|head|left-ear|right-ear|tail|knee|fetlock)|(fore|hind)-(left|right)-leg)$/;

// Embedded textures decode off the main thread, within the page's Content Security Policy.
const loadHorse=id=>createModelLoader().loadAsync(new URL(`../../${horseBodyUrl(id)}`,import.meta.url).href);

/** One immutable master per horse: its coat at two levels of detail and its legs' rest pose
 * (horse-frame.js), shared by every horse wearing it and never disposed by them. A horse
 * that fails to load is absent, and its riders keep the code-built horse. */
export function createHorseBodyLibrary(load=loadHorse){
  const masters=new Map(),pending=new Map(),failures=new Map();
  function adopt(id,gltf){
    const meshes={};gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes[o.name]=o;});
    const part=mesh=>{
      const bones=mesh.skeleton.bones.map(b=>b.name);
      if(!mesh.geometry.attributes.skinWeight||bones.some(name=>!HORSE_JOINTS.includes(name)))throw Error(`Horse ${id} is not skinned to the game's horse joints`);
      // The overview's baked colours serve untextured views; the texture draws the horse.
      const material=mesh.material.clone();material.vertexColors=false;material.name=`generated horse ${id}`;installCloudShadows(material);
      material.userData.generatedActorBody=true;
      return Object.freeze({geometry:mesh.geometry,material,bones:Object.freeze(bones)});
    };
    // Horses switch to the overview level at a distance, so both levels are required.
    if(!meshes['horse-coat']||!meshes['horse-coat-overview'])throw Error(`Horse ${id} needs skinned horse-coat and horse-coat-overview meshes`);
    const near=part(meshes['horse-coat']),overview=part(meshes['horse-coat-overview']);
    if(overview.bones.join()!==near.bones.join())throw Error(`Horse ${id} levels disagree on joints`);
    return Object.freeze({id,near,overview,frame:horseFrameFromModel(gltf.scene,GENERATED_HORSE_MOTION)});
  }
  return {
    warm(id){
      if(!id)return Promise.resolve(false);
      if(!pending.has(id))pending.set(id,(async()=>{try{masters.set(id,adopt(id,await load(id)));return true;}catch(error){failures.set(id,String(error?.message??error));return false;}})());
      return pending.get(id);
    },
    status(id){return {ready:masters.has(id),pending:pending.has(id)&&!masters.has(id)&&!failures.has(id),error:failures.get(id)??null};},
    body(id){return id?masters.get(id)??null:null;}
  };
}
const library=createHorseBodyLibrary();
export const warmHorseBody=id=>library.warm(id);
export const horseBody=id=>library.body(id);
export const horseBodyStatus=id=>library.status(id);

function horseBone(bones,name){
  const joint=/^((?:fore|hind)-(?:left|right))-(knee|fetlock)$/.exec(name);
  if(!joint)return bones.find(b=>b.name===name);
  const knee=bones.find(b=>b.name===`${joint[1]}-leg`)?.children.find(c=>c.isBone&&c.name==='horse-knee');
  return joint[2]==='knee'?knee:knee?.children.find(c=>c.isBone&&c.name==='horse-fetlock');
}

/** Skin a horse's coat to its own bones (createHorse, on the coat's frame), at rest: the
 * figure owns the skinned meshes and their skeleton; geometry and materials stay the
 * master's. */
export function mountHorseBody(group,horse,body,{skeletons}){
  horse.rest();group.updateMatrixWorld(true);
  const all=[];horse.group.traverse(o=>{if(o.isBone)all.push(o);});
  const bones=body.near.bones.map(name=>horseBone(all,name));
  if(bones.some(b=>!b))throw Error('Missing horse joint');
  const skeleton=new T.Skeleton(bones);skeletons.add(skeleton);
  const skin=(part,name,overview)=>{
    const mesh=new T.SkinnedMesh(part.geometry,part.material);mesh.name=name;mesh.userData.overview=overview;mesh.userData.generatedHorse=body.id;
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;mesh.visible=!overview;group.add(mesh);
    // Both levels share one skin; the overview is exported with the same joint order.
    mesh.bind(skeleton);mesh.boundingSphere=new T.Sphere(new T.Vector3(0,1.1,0),2.2);return mesh;
  };
  return {near:skin(body.near,'generated-horse',false),overview:skin(body.overview,'generated-horse-overview',true)};
}
