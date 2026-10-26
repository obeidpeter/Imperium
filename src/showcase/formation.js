import * as T from '../../vendor/three/three.module.js';
import {generatedIdentityMaterial} from './generated-identity.js';
import {finishActorMaterial} from './actor-surface.js';

// Units as formations. From Chapter IV the commander orders bodies of men,
// so each military unit shows its leader plus followers standing in the
// unit's formation, and losses take men out of the rear and flanks first. The
// rules still hold one unit per tile; this reads the unit and never edits it.
export const FORMATION_LIMIT=Object.freeze({performance:3,balanced:5,high:8});
const MILITARY=new Set(['infantry','guard','archer','raider','cavalry','heavy','soldier']);
// A real-time unit says so itself: crowd:false for a man who stands alone, or
// the number of his squad's other men.
export function formationEligible(unit,{chapter=1,contest=false}={}){
  if(unit?.crowd===false)return false;if(Number.isFinite(unit?.crowd))return !contest&&unit.crowd>0;
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
export function formationSlots(unit){const field=Number.isFinite(unit?.crowd),mounted=formationShape(unit)==='mounted';return SHAPES[formationShape(unit)].map(([x,z],i)=>({x:x*(field?(mounted?1.8:1.45):1),z:z*(field?1.65:1),yaw:jitter(unit?.id??'',i)}));}
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
// surface and moves with the leader's pose. Followers do not move in unison:
// each plays one of a few banks of the leader's recent pose, the same motion a
// fixed fraction of a second later, so a swing or a step ripples through the
// rank. Banks are chosen per man from his unit and slot, never at random.
export const POSE_BANK_DELAYS=Object.freeze([0,.11,.23,.36]);
export function poseBank(id,index){let h=2166136261;for(const c of `${id}:bank:${index}`)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)%POSE_BANK_DELAYS.length;}
const CROWD_VERTEX_HEAD='attribute vec4 crowdOffset;\nattribute float crowdBank;\nattribute vec2 crowdVariation;\nvarying float vCrowdTint;\nuniform float crowdBones;\nvec3 crowdTurn(vec3 v){float c=cos(crowdOffset.w),s=sin(crowdOffset.w);return vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);}\n';
const CROWD_SKIN_BASE=`#ifdef USE_SKINNING
  float crowdBoneBase=crowdBank*crowdBones;
  mat4 boneMatX=getBoneMatrix(skinIndex.x+crowdBoneBase);
  mat4 boneMatY=getBoneMatrix(skinIndex.y+crowdBoneBase);
  mat4 boneMatZ=getBoneMatrix(skinIndex.z+crowdBoneBase);
  mat4 boneMatW=getBoneMatrix(skinIndex.w+crowdBoneBase);
#endif`;
// The skeleton's bone count is a uniform, not a define, so followers of every
// kit share one program (and one shadow program) instead of one per skeleton.
function crowdShader(shader,bones){
  shader.uniforms.crowdBones={value:bones};
  shader.vertexShader=CROWD_VERTEX_HEAD+shader.vertexShader
    .replace('#include <skinbase_vertex>',CROWD_SKIN_BASE)
    .replace('#include <skinnormal_vertex>','#include <skinnormal_vertex>\n  objectNormal=crowdTurn(objectNormal);')
    .replace('#include <skinning_vertex>','#include <skinning_vertex>\n  transformed=crowdTurn(transformed*crowdVariation.x)+crowdOffset.xyz; vCrowdTint=crowdVariation.y;');
  shader.fragmentShader='varying float vCrowdTint;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb *= vCrowdTint;');
}
function crowdMaterial(source,bones){
  // Body and named-head followers use identical PBR inputs. Neutral identity
  // and finish uniforms let them share the same shader without changing the
  // original body's colour, roughness, textures, geometry or shadow treatment.
  const neutral=source.userData.generatedActorBody&&!source.userData.generatedIdentity;
  const material=neutral?generatedIdentityMaterial(source,{key:'crowd-neutral',grey:0,beard:0}):source.clone();
  if(neutral){finishActorMaterial(material,'neutral');material.name=source.name;}
  const base=neutral?material:source,previous=base.onBeforeCompile,key=base.customProgramCacheKey?.bind(base);
  material.userData.crowdBones=bones;
  material.onBeforeCompile=(shader,renderer)=>{if(previous&&previous!==T.Material.prototype.onBeforeCompile)previous.call(material,shader,renderer);crowdShader(shader,bones);};
  material.customProgramCacheKey=()=>`${key?.()??''}:formation-crowd-v4`;
  return material;
}
function crowdDepthMaterial(bones){
  const material=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});material.userData.crowdBones=bones;
  material.onBeforeCompile=shader=>crowdShader(shader,bones);material.customProgramCacheKey=()=>'formation-crowd-depth-v4';return material;
}
function instanced(source,max,offsets,banks,variation){
  const geometry=new T.InstancedBufferGeometry();
  for(const [name,attribute]of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
  if(source.index)geometry.setIndex(source.index);
  geometry.setAttribute('crowdOffset',offsets);geometry.setAttribute('crowdBank',banks);geometry.setAttribute('crowdVariation',variation);geometry.instanceCount=0;geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1.2,0),6);return geometry;
}
// A skeleton whose bone texture holds the leader's pose now and as it was a
// moment ago, one block of bones per bank. Three updates it once per frame.
const HISTORY_FRAMES=48;
export function createPoseHistory(source,delays=POSE_BANK_DELAYS){
  const bones=source.bones.length,floats=bones*16,frames=[],skeleton=new T.Skeleton([],[]);
  const size=Math.max(4,Math.ceil(Math.sqrt(bones*4*delays.length)/4)*4);
  skeleton.boneMatrices=new Float32Array(size*size*4);
  skeleton.boneTexture=new T.DataTexture(skeleton.boneMatrices,size,size,T.RGBAFormat,T.FloatType);skeleton.boneTexture.needsUpdate=true;
  skeleton.computeBoneTexture=function(){return this;};
  let now=0,last=-Infinity,flush=true;
  skeleton.update=function(){
    const current=source.boneMatrices;if(!current||current.length<floats)return;
    if(flush||now<last){frames.length=0;flush=false;last=-Infinity;}
    if(now>last){const entry=frames.length>=HISTORY_FRAMES?frames.shift():{time:0,data:new Float32Array(floats)};entry.time=now;entry.data.set(current.subarray(0,floats));frames.push(entry);last=now;}
    for(let b=0;b<delays.length;b++){
      const wanted=now-delays[b];let pick=frames[0];
      for(const frame of frames){if(frame.time<=wanted+1e-6)pick=frame;else break;}
      this.boneMatrices.set(pick.data,b*floats);
    }
    this.boneTexture.needsUpdate=true;
  };
  const dispose=skeleton.dispose.bind(skeleton);skeleton.dispose=()=>{frames.length=0;dispose();};
  return {skeleton,bones,banks:delays.length,setTime(t){if(Number.isFinite(t))now=t;},reset(){flush=true;},get frames(){return frames.length;}};
}
// Rigid overview parts (boots, hooves, weapons) ride their nearest bone as
// weight-one skinned vertices so followers keep their feet and arms.
function rigidAsSkinned(group,rigid,skeleton,bindMatrix){
  const bones=skeleton.bones,index=new Map(bones.map((bone,i)=>[bone,i])),inverseGroup=group.matrixWorld.clone().invert(),positions=[],normals=[],colors=[],skinIndex=[],skinWeight=[];
  const matrix=new T.Matrix4(),normalMatrix=new T.Matrix3(),v=new T.Vector3();
  for(const mesh of rigid){
    // Kit the leader hides (an archer's sword, an unthrown javelin) stays hidden: its joints are
    // invisible. The part's own flag is only the distance switch, so it is not consulted.
    let hidden=false;for(let p=mesh.parent;p&&p!==group;p=p.parent)if(!p.visible)hidden=true;
    if(hidden)continue;
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
  const offsets=new T.InstancedBufferAttribute(new Float32Array(max*4),4).setUsage(T.DynamicDrawUsage),banks=new T.InstancedBufferAttribute(new Float32Array(max),1).setUsage(T.DynamicDrawUsage),meshes=[],owned=[],materials=[],histories=new Map();
  const variation=new T.InstancedBufferAttribute(new Float32Array(max*2),2);
  for(let i=0;i<max;i++)variation.setXY(i,.965+(i*7%11)*.007,.88+(i*3%7)*.025);
  const historyFor=skeleton=>{if(!histories.has(skeleton))histories.set(skeleton,createPoseHistory(skeleton));return histories.get(skeleton);};
  const add=(geometry,source,skeleton,bindMatrix)=>{
    const history=historyFor(skeleton),material=crowdMaterial(source.material,history.bones),depth=crowdDepthMaterial(history.bones);materials.push(material,depth);
    const mesh=new T.SkinnedMesh(instanced(geometry,max,offsets,banks,variation),material);mesh.name='formation followers';mesh.userData.formationCrowd=true;mesh.userData.overview=false;
    mesh.bind(history.skeleton,bindMatrix);mesh.boundingSphere=new T.Sphere(new T.Vector3(0,1.2,0),6);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=depth;mesh.raycast=()=>{};
    owned.push(mesh.geometry);group.add(mesh);meshes.push(mesh);
  };
  for(const source of skinned)add(source.geometry,source,source.skeleton,source.bindMatrix);
  // Rigid parts ride the skeleton holding every joint; a generated body's own skin holds only the body's.
  const primary=skinned.reduce((a,b)=>b.skeleton.bones.length>a.skeleton.bones.length?b:a);
  const rigidGeometry=rigidAsSkinned(group,rigid,primary.skeleton,primary.bindMatrix);
  if(rigidGeometry){owned.push(rigidGeometry);add(rigidGeometry,rigid[0],primary.skeleton,primary.bindMatrix);}
  const footprints=[],lastAt=new T.Vector3();let count=0,disposed=false,placedBefore=[],anchored=false;
  return {meshes,max,footprints,
    get count(){return count;},
    get histories(){return [...histories.values()];},
    // A crowd rebuilt mid-battle (imported anatomy arriving late) keeps the
    // ranks it replaces, so men lost since still fall where they stood.
    get ranks(){return placedBefore;},
    inherit(ranks=[]){if(!count&&!placedBefore.length)placedBefore=ranks.map(p=>({...p,world:p.world.clone()}));},
    // slots: formationSlots(unit); visible: followerCount(); heightAt(x,z) keeps every man's feet on the ground.
    // time: the stage's presentation clock; reset after a jump or a pose reset.
    // onFall({world,yaw,index}) receives each man who leaves the rank.
    update({slots=[],visible=0,heightAt=null,time=null,reset=false,unitId='',onFall=null}={}){
      if(disposed)return;const placed=placeFollowers(group,{slots,visible,heightAt,max});
      if(reset||!anchored||group.position.distanceTo(lastAt)>1.2)for(const h of histories.values())h.reset();
      lastAt.copy(group.position);anchored=true;
      for(const h of histories.values())h.setTime(time);
      if(typeof onFall==='function')for(let i=placed.length;i<placedBefore.length;i++)onFall({world:placedBefore[i].world.clone(),yaw:group.rotation.y+(placedBefore[i].yaw??0),index:i});
      placedBefore=placed;count=placed.length;footprints.length=0;
      let moved=false,changedBank=false;
      placed.forEach((p,i)=>{
        const values=[p.x,p.y,p.z,p.yaw];
        if(values.some((v,j)=>Math.abs(offsets.array[i*4+j]-v)>1e-5)){offsets.setXYZW(i,...values);moved=true;}
        const bank=poseBank(unitId,i);if(banks.getX(i)!==bank){banks.setX(i,bank);changedBank=true;}
        footprints.push(p.world);
      });
      // Idle formations still animate, but unchanged placement/bank buffers
      // need no driver upload. Skeleton history remains independent.
      if(moved)offsets.needsUpdate=true;if(changedBank)banks.needsUpdate=true;
      for(const mesh of meshes)mesh.geometry.instanceCount=count;
    },
    dispose(){if(disposed)return;disposed=true;for(const mesh of meshes)mesh.removeFromParent();for(const g of owned)g.dispose();for(const m of materials)m.dispose();for(const h of histories.values())h.skeleton.dispose();histories.clear();}
  };
}
