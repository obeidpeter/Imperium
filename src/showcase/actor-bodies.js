import * as T from '../../vendor/three/three.module.js';
import {createModelLoader} from './model-loader.js';
import {installCloudShadows} from './atmosphere.js';
import {actorBodyUrl} from '../ui/actor-body-catalog.js';

// The game's joints a generated body is skinned to, named as bind-character.py
// exports them; the rig itself repeats elbow, hand, knee and ankle on each side.
export const BODY_JOINTS=Object.freeze(['hips','torso','head','right-shoulder','right-elbow','right-hand','left-shoulder','left-elbow','left-hand','right-thigh','right-knee','right-ankle','left-thigh','left-knee','left-ankle']);
// Procedural surfaces a body replaces: everything on these joints. Hands,
// weapons, shields, bows, quivers, scabbards, cloaks, crests, decorations and
// standards hang from other joints and stay.
export const BODY_REPLACES=/^(hips|torso|tunic-hem(-fold|-edge)?|head|(right|left)-(brow|eyelid|thigh|shoulder)|facial-jaw|(ridge|conical|segmented)-helmet|knee|ankle|elbow)$/;

// Embedded textures decode off the main thread, within the page's Content
// Security Policy (model-loader.js).
const loadBody=id=>createModelLoader().loadAsync(new URL(`../../${actorBodyUrl(id)}`,import.meta.url).href);

/** One immutable master per body. Its geometry and materials are shared by every
 * figure wearing it and never disposed by them. A body that fails to load is
 * absent, and its figures keep their procedural look. */
export function createActorBodyLibrary(load=loadBody){
  const masters=new Map(),pending=new Map(),failures=new Map();
  function adopt(id,gltf){
    const meshes={};gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes[o.name]=o;});
    const part=mesh=>{
      if(!mesh)return null;
      const bones=mesh.skeleton.bones.map(b=>b.name);
      if(!mesh.geometry.attributes.skinWeight||bones.some(name=>!BODY_JOINTS.includes(name)))throw Error(`Body ${id} is not skinned to the game's joints`);
      // The overview's baked colours serve untextured views (fallen bodies); the texture draws the figure.
      const material=mesh.material.clone();material.vertexColors=false;material.name=`generated body ${id}`;installCloudShadows(material);
      return Object.freeze({geometry:mesh.geometry,material,bones:Object.freeze(bones)});
    };
    // Figures switch to the overview level at a distance, so both levels are required.
    if(!meshes.body||!meshes['body-overview'])throw Error(`Body ${id} needs skinned body and body-overview meshes`);
    const near=part(meshes.body),overview=part(meshes['body-overview']);
    if(overview.bones.join()!==near.bones.join())throw Error(`Body ${id} levels disagree on joints`);
    return Object.freeze({id,near,overview});
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
const library=createActorBodyLibrary();
export const warmActorBody=id=>library.warm(id);
export const actorBody=id=>library.body(id);
export const actorBodyStatus=id=>library.status(id);

function bodyBone(bones,name){
  if(!/^(right|left)-(elbow|hand|knee|ankle)$/.test(name))return bones.find(b=>b.name===name);
  const [side,joint]=name.split('-'),chain=joint==='elbow'?['elbow']:joint==='hand'?['elbow','hand']:joint==='knee'?['knee']:['knee','ankle'];
  let bone=bones.find(b=>b.name===`${side}-${['elbow','hand'].includes(joint)?'shoulder':'thigh'}`);
  for(const step of chain)bone=bone?.children.find(c=>c.isBone&&c.name===step);
  return bone;
}

/** Skin a figure's body to its own bones, in the rig's bind pose. The figure owns
 * the skinned meshes and their skeleton; geometry and materials stay the master's. */
export function mountActorBody(group,body,{skeletons}){
  const all=[];group.traverse(o=>{if(o.isBone)all.push(o);});
  group.updateMatrixWorld(true);
  const bones=body.near.bones.map(name=>bodyBone(all,name));
  if(bones.some(b=>!b))throw Error('Missing body joint');
  const skeleton=new T.Skeleton(bones);skeletons.add(skeleton);
  const skin=(part,name,overview)=>{
    const mesh=new T.SkinnedMesh(part.geometry,part.material);mesh.name=name;mesh.userData.overview=overview;mesh.userData.generatedBody=body.id;
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;mesh.visible=!overview;group.add(mesh);
    // Both levels share one skin; the overview is exported with the same joint order.
    mesh.bind(skeleton);mesh.boundingSphere=new T.Sphere(new T.Vector3(0,1.2,0),2);return mesh;
  };
  return {near:skin(body.near,'generated-body',false),overview:skin(body.overview,'generated-body-overview',true)};
}
