import * as T from '../../vendor/three/three.module.js';
import {createModelLoader} from './model-loader.js';
import {kitModelUrl} from './actor-kit-catalog.js';

// Embedded textures decode off the main thread, within the page's Content Security Policy (model-loader.js).
const loadKit=id=>createModelLoader().loadAsync(new URL(`../../${kitModelUrl(id)}`,import.meta.url).href);

/** One immutable master per piece of generated kit (process-kit.py): a textured near level and an
 * overview level whose colours are in its vertices, both laid out about the grip or the helmet's
 * foot. A figure wears copies, so it owns and frees what it draws; the masters are never drawn. A
 * piece that fails to load is absent, and its figures keep the code-built piece. */
export function createActorKitLibrary(load=loadKit){
  const masters=new Map(),pending=new Map(),failures=new Map();
  function adopt(id,gltf){
    const meshes={};gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)meshes[o.name]=o;});
    const near=meshes.near,overview=meshes.overview;
    if(!near||!overview)throw Error(`Kit ${id} needs near and overview meshes`);
    if(!overview.geometry.attributes.color)throw Error(`Kit ${id}'s overview level has no colours`);
    if(!near.material?.isMeshStandardMaterial||!near.material.map)throw Error(`Kit ${id}'s near level has no colour map`);
    // Any node transform is folded into the copies' geometry, so a piece sits as it was exported.
    const level=mesh=>{const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);geometry.computeBoundingBox();return geometry;};
    const nearGeometry=level(near),overviewGeometry=level(overview);
    const material=near.material.clone();material.vertexColors=false;material.side=T.FrontSide;material.name=`generated kit ${id}`;
    return Object.freeze({id,near:Object.freeze({geometry:nearGeometry,material}),overview:Object.freeze({geometry:overviewGeometry})});
  }
  return {
    warm(id){
      if(!id)return Promise.resolve(false);
      if(!pending.has(id))pending.set(id,(async()=>{try{masters.set(id,adopt(id,await load(id)));return true;}catch(error){failures.set(id,String(error?.message??error));return false;}})());
      return pending.get(id);
    },
    status(id){return {ready:masters.has(id),pending:pending.has(id)&&!masters.has(id)&&!failures.has(id),error:failures.get(id)??null};},
    model(id){return id?masters.get(id)??null:null;}
  };
}
const library=createActorKitLibrary();
export const warmActorKitModel=id=>library.warm(id);
export const actorKitModel=id=>library.model(id);
export const actorKitModelStatus=id=>library.status(id);
export const defaultActorKitLibrary=library;

/** Puts a generated piece in place of the code-built one on its joint, fitted in the joint's frame
 * to the extent of the code-built pieces it replaces: a weapon scaled as one, so its tip reaches the
 * code-built tip with its grip (the model's origin) in the hand; a helmet scaled on each axis to the
 * code-built bowl and guards, so it sits as they did on every head they were fitted to. Joints that
 * hold other joints (a crest, a contact point) keep them. Returns the worn mesh, or null when the
 * joint has no code-built piece left to replace (a body that brings its own helmet removed it). */
export function wearKitModel(part,master,{uniform,mesh,geometries,materials}){
  const pieces=part?.children.filter(o=>o.isMesh)??[];
  if(!master||!pieces.length)return null;
  const box=new T.Box3();
  for(const piece of pieces){piece.updateMatrix();piece.geometry.computeBoundingBox();box.union(piece.geometry.boundingBox.clone().applyMatrix4(piece.matrix));}
  for(const piece of pieces){piece.removeFromParent();for(const g of [piece.geometry,piece.userData.overviewGeometry])if(g){geometries.delete(g);g.dispose();}}
  const own=master.near.geometry.boundingBox,size=box.getSize(new T.Vector3()),ownSize=own.getSize(new T.Vector3());
  const material=master.near.material.clone();materials.add(material);
  const worn=mesh(part,master.near.geometry.clone(),material);
  if(uniform)worn.scale.setScalar(box.max.y/Math.max(own.max.y,1e-6));
  else{
    worn.scale.set(size.x/ownSize.x,size.y/ownSize.y,size.z/ownSize.z);
    worn.position.copy(box.getCenter(new T.Vector3())).sub(own.getCenter(new T.Vector3()).multiply(worn.scale));
  }
  const overview=master.overview.geometry.clone();geometries.add(overview);worn.userData.overviewGeometry=overview;worn.userData.kitModel=master.id;
  return worn;
}
