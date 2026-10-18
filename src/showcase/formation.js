import * as T from '../../vendor/three/three.module.js';

// Units as formations. From Chapter IV the commander orders bodies of men,
// so each military unit shows its leader plus followers standing in the
// unit's formation, and losses take men out of the rear and flanks first. The
// rules still hold one unit per tile; this reads the unit and never edits it.
export const FORMATION_LIMIT=Object.freeze({performance:3,balanced:5,high:8});
const MILITARY=new Set(['infantry','guard','archer','raider','cavalry','heavy','soldier']);
export function formationEligible(unit,{chapter=1,contest=false}={}){
  return !contest&&chapter>=4&&!!unit&&unit.id!=='hero'&&MILITARY.has(unit.role);
}
// Slots in the unit's own frame (x to its right, z forward, metres from the
// leader), kept inside its 2.5 m tile and ordered by who stays longest.
const SHAPES={
  line:[[-.75,.75],[.75,.75],[0,.75],[-.75,0],[.75,0],[0,-.75],[-.75,-.75],[.75,-.75]],
  'shield-wall':[[-.36,.55],[.36,.55],[-1.02,.55],[1.02,.55],[-.86,-.2],[.86,-.2],[-.36,-.86],[.36,-.86]],
  wedge:[[-.55,-.55],[.55,-.55],[0,-1.05],[-1.05,-1.05],[1.05,-1.05]],
  archer:[[-.85,.25],[.85,.25],[-.45,-.65],[.45,-.65],[0,-1.05]],
  raider:[[-.82,.38],[.74,.52],[-.48,-.72],[.62,-.6],[.05,-1.06]],
  mounted:[[-.92,-.55],[.92,-.55]]
};
// A fixed, unit-specific turn of a few degrees per man: no gameplay randomness.
function jitter(id,index){let h=2166136261;for(const c of `${id}:${index}`)h=Math.imul(h^c.charCodeAt(0),16777619);return ((h>>>0)/4294967295-.5)*.22;}
export function formationShape(unit){
  if(['cavalry','heavy'].includes(unit?.role))return 'mounted';
  if(['wedge','shield-wall','line'].includes(unit?.formation))return unit.formation;
  if(unit?.braced)return 'shield-wall';
  return unit?.role==='archer'?'archer':unit?.role==='raider'?'raider':'line';
}
export function formationSlots(unit){return SHAPES[formationShape(unit)].map(([x,z],i)=>({x,z,yaw:jitter(unit?.id??'',i)}));}
export function followerCount(unit,available){
  const max=Number.isFinite(unit?.maxHp)?unit.maxHp:Number.isFinite(unit?.maxResolve)?unit.maxResolve:null,now=Number.isFinite(unit?.hp)?unit.hp:unit?.resolve;
  const ratio=max>0&&Number.isFinite(now)?Math.max(0,Math.min(1,now/max)):1;
  return Math.max(0,Math.min(available,Math.round(available*ratio)));
}

// Where each visible follower stands: unit-local offset plus the ground lift
// under it, and its world footprint for contact shading.
export function placeFollowers(group,{slots=[],visible=0,heightAt=null,max=8}={}){
  const count=Math.max(0,Math.min(max,visible,slots.length)),yaw=group.rotation.y,c=Math.cos(yaw),s=Math.sin(yaw),base=group.position,placed=[];
  for(let i=0;i<count;i++){
    const slot=slots[i],x=base.x+c*slot.x+s*slot.z,z=base.z-s*slot.x+c*slot.z,ground=heightAt?heightAt(x,z):base.y,lift=Number.isFinite(ground)?ground-base.y:0;
    placed.push({x:slot.x,y:lift,z:slot.z,yaw:slot.yaw??0,world:new T.Vector3(x,base.y+lift,z)});
  }
  return placed;
}

// Crowd rendering for sculpted figures: each follower is an instance of the
// leader's own overview surfaces, skinned by the leader's skeleton and then
// turned and offset per instance, so a whole formation costs one draw per
// surface and moves with the leader's pose.
const CROWD_VERTEX_HEAD='attribute vec4 crowdOffset;\nvec3 crowdTurn(vec3 v){float c=cos(crowdOffset.w),s=sin(crowdOffset.w);return vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);}\n';
function crowdShader(shader){
  shader.vertexShader=CROWD_VERTEX_HEAD+shader.vertexShader
    .replace('#include <skinnormal_vertex>','#include <skinnormal_vertex>\n  objectNormal=crowdTurn(objectNormal);')
    .replace('#include <skinning_vertex>','#include <skinning_vertex>\n  transformed=crowdTurn(transformed)+crowdOffset.xyz;');
}
function crowdMaterial(source){
  const material=source.clone(),previous=source.onBeforeCompile,key=source.customProgramCacheKey?.bind(source);
  material.onBeforeCompile=(shader,renderer)=>{if(previous&&previous!==T.Material.prototype.onBeforeCompile)previous.call(material,shader,renderer);crowdShader(shader);};
  material.customProgramCacheKey=()=>`${key?.()??''}:formation-crowd-v1`;
  return material;
}
function crowdDepthMaterial(){
  const material=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
  material.onBeforeCompile=crowdShader;material.customProgramCacheKey=()=>'formation-crowd-depth-v1';return material;
}
function instanced(source,max,offsets){
  const geometry=new T.InstancedBufferGeometry();
  for(const [name,attribute]of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
  if(source.index)geometry.setIndex(source.index);
  geometry.setAttribute('crowdOffset',offsets);geometry.instanceCount=0;geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1.2,0),4);return geometry;
}
// Rigid overview parts (boots, hooves, weapons) ride their nearest bone as
// weight-one skinned vertices so followers keep their feet and arms.
function rigidAsSkinned(group,rigid,skeleton,bindMatrix){
  const bones=skeleton.bones,index=new Map(bones.map((bone,i)=>[bone,i])),inverseGroup=group.matrixWorld.clone().invert(),positions=[],normals=[],colors=[],skinIndex=[],skinWeight=[];
  const matrix=new T.Matrix4(),normalMatrix=new T.Matrix3(),v=new T.Vector3();
  for(const mesh of rigid){
    let bone=mesh.parent;while(bone&&bone!==group&&!bone.isBone)bone=bone.parent;
    if(!bone?.isBone||!index.has(bone))continue;const i=index.get(bone);
    // bind space = bind^-1 x (bone at bind) x (bone now)^-1 x (mesh now), group-local
    const boneNow=new T.Matrix4().multiplyMatrices(inverseGroup,bone.matrixWorld),meshNow=new T.Matrix4().multiplyMatrices(inverseGroup,mesh.matrixWorld);
    matrix.copy(bindMatrix).invert().multiply(skeleton.boneInverses[i].clone().invert()).multiply(boneNow.invert()).multiply(meshNow);normalMatrix.getNormalMatrix(matrix);
    const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,tint=mesh.material.color??new T.Color(1,1,1);
    for(let k=0;k<p.count;k++){
      v.fromBufferAttribute(p,k).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);
      if(n){v.fromBufferAttribute(n,k).applyNormalMatrix(normalMatrix);normals.push(v.x,v.y,v.z);}else normals.push(0,1,0);
      colors.push(tint.r*(c?.getX(k)??1),tint.g*(c?.getY(k)??1),tint.b*(c?.getZ(k)??1));skinIndex.push(i,0,0,0);skinWeight.push(1,0,0,0);
    }
    if(g!==mesh.geometry)g.dispose();
  }
  if(!positions.length)return null;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));return geometry;
}
export function createSkinnedCrowd(group,{max=8}={}){
  const sources=[];group.updateMatrixWorld(true);group.traverse(o=>{if(o.isMesh&&o.userData.overview&&!o.userData.formationCrowd)sources.push(o);});
  const skinned=sources.filter(o=>o.isSkinnedMesh),rigid=sources.filter(o=>!o.isSkinnedMesh);
  if(!skinned.length||max<1)return null;
  const offsets=new T.InstancedBufferAttribute(new Float32Array(max*4),4).setUsage(T.DynamicDrawUsage),meshes=[],owned=[],materials=[],depth=crowdDepthMaterial();materials.push(depth);
  const add=(geometry,source,skeleton,bindMatrix)=>{
    const material=crowdMaterial(source.material);materials.push(material);
    const mesh=new T.SkinnedMesh(instanced(geometry,max,offsets),material);mesh.name='formation followers';mesh.userData.formationCrowd=true;mesh.userData.overview=false;
    mesh.bind(skeleton,bindMatrix);mesh.boundingSphere=new T.Sphere(new T.Vector3(0,1.2,0),4);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=depth;mesh.raycast=()=>{};
    owned.push(mesh.geometry);group.add(mesh);meshes.push(mesh);
  };
  for(const source of skinned)add(source.geometry,source,source.skeleton,source.bindMatrix);
  const rigidGeometry=rigidAsSkinned(group,rigid,skinned[0].skeleton,skinned[0].bindMatrix);
  if(rigidGeometry){owned.push(rigidGeometry);add(rigidGeometry,rigid[0],skinned[0].skeleton,skinned[0].bindMatrix);}
  const footprints=[];let count=0,disposed=false;
  return {meshes,max,footprints,
    get count(){return count;},
    // slots: formationSlots(unit); visible: followerCount(); heightAt(x,z) keeps every man's feet on the ground.
    update({slots=[],visible=0,heightAt=null}={}){
      if(disposed)return;const placed=placeFollowers(group,{slots,visible,heightAt,max});count=placed.length;footprints.length=0;
      placed.forEach((p,i)=>{offsets.setXYZW(i,p.x,p.y,p.z,p.yaw);footprints.push(p.world);});
      offsets.needsUpdate=true;for(const mesh of meshes)mesh.geometry.instanceCount=count;
    },
    dispose(){if(disposed)return;disposed=true;for(const mesh of meshes)mesh.removeFromParent();for(const g of owned)g.dispose();for(const m of materials)m.dispose();}
  };
}
