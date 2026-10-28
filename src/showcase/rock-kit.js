import * as T from '../../vendor/three/three.module.js';
import {worldModelUrl} from '../ui/world-catalog.js';
import {ROCK_KIT_COMPONENTS} from './rock-kit-components.js';
import {hash} from './environment-layout.js';
import {getSceneProfile} from './campaign-scene-profile.js';
import {TREE_KIT_CHAPTERS} from './tree-kit.js';

// The regional rock kits (worlds and gameplay plan, release 5): four Tripo rocks for each
// group of chapters, assembled by scripts/assets/build-rock-kits.py, each near and far.
// They take the place of the code-built noise stones: each rock is fitted to the footprint
// and height that stone would have had, so it covers no more ground. One instanced draw for
// each rock and level. Presentation only: no rock takes picks or changes a route.

// The rocks share the tree kits' groups of chapters.
export const rockKitFor=chapter=>Object.keys(TREE_KIT_CHAPTERS).find(kit=>TREE_KIT_CHAPTERS[kit].includes(Number(chapter)))??null;
export const rockKitUrl=chapter=>{const kit=rockKitFor(chapter);return kit?worldModelUrl(`rocks-${kit}`):null;};
// None indoors: the Curia's chamber has no field stones.
export const sceneRockKitUrl=(encounter,chapter)=>{const profile=getSceneProfile(encounter,{chapter});return profile.civic?null:rockKitUrl(profile.chapter);};
// A rock shows its near level within this distance (metres): a field holds hundreds of
// rocks (four to a rock cell, more along the plateaus' rims), so most show the far level.
export const ROCK_KIT_NEAR=18;
const MOVE=3;

// A placed rock's transform: one of the kit's rocks by the stone's seed, turned by it, and
// scaled evenly until it fits both the stone's footprint radius and its height.
export function rockKitTransform(kit,{x,y,z,radius,height,seed=0}){
  const rocks=Object.entries(ROCK_KIT_COMPONENTS[kit]??{});if(!rocks.length||!(radius>0)||!(height>0))return null;
  const [id,b]=rocks[Math.floor(hash(seed,x*7.1,z*3.3)*rocks.length)%rocks.length];
  const reach=Math.max(-b.min[0],b.max[0],-b.min[2],b.max[2]),tall=b.max[1]-b.min[1],s=Math.min(radius/reach,height/tall);
  return {id,position:[x,y-tall*s*.06,z],yaw:hash(seed*3+1,z*5.3,x*2.9)*Math.PI*2,scale:s,radius:reach*s,height:tall*s};
}

// The rocks one world places from a loaded kit. place() records a rock as the world is
// built; build() makes the instanced draws. `materials` maps each kit material to the one
// the world draws it with (environment-materials.js kitMaterial, as its stone).
export function createRockKitPlacer(master,kit,materials){
  const rocks=new Map();
  for(const id of Object.keys(ROCK_KIT_COMPONENTS[kit]??{})){
    const levels=[id,`${id}_far`].map(name=>{const root=master?.getObjectByName(name),parts=[];root?.traverse(o=>{if(o.isMesh)parts.push(o);});return {root,parts};});
    if(levels.every(level=>level.parts.length))rocks.set(id,{levels,placed:[]});
  }
  let sets=[],last=null;
  const dummy=new T.Object3D(),turn=new T.Euler();
  function layout(camera){
    for(const set of sets){
      for(const level of set.meshes)for(const {mesh}of level)mesh.count=0;
      for(const rock of set.placed){
        // Without a camera (the world's bake) every rock stands at its far level.
        const far=camera?Math.hypot(camera.x-rock.position[0],camera.z-rock.position[2])>ROCK_KIT_NEAR:true;
        for(const {mesh,local}of set.meshes[far?1:0]){mesh.setMatrixAt(mesh.count,dummy.matrix.multiplyMatrices(rock.matrix,local));mesh.setColorAt(mesh.count,rock.color);mesh.count++;}
      }
      for(const level of set.meshes)for(const {mesh}of level){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.visible=mesh.count>0;}
    }
  }
  return {
    kit,
    place(placement){
      const t=rockKitTransform(kit,placement),set=t&&rocks.get(t.id);if(!set)return false;
      dummy.position.set(...t.position);turn.set(0,t.yaw,0);dummy.quaternion.setFromEuler(turn);dummy.scale.setScalar(t.scale);dummy.updateMatrix();
      const seed=placement.seed??0,k=.9+hash(seed,23)*.14,color=new T.Color().setRGB(k,k*(.98+hash(seed,29)*.04),k*(.96+hash(seed,31)*.06));
      set.placed.push({id:t.id,position:t.position,radius:t.radius,height:t.height,matrix:dummy.matrix.clone(),color});return true;
    },
    // The instanced draws, added to `group` (the world's root, so they share its light, its
    // baked occlusion and the camera's cutaway), far until update() sees the camera.
    build(group,{castShadow=true}={}){
      sets=[...rocks].filter(([,set])=>set.placed.length).map(([id,set])=>({placed:set.placed,meshes:set.levels.map(({root,parts},level)=>parts.map(part=>{
        root.updateWorldMatrix(true,true);
        const mesh=new T.InstancedMesh(part.geometry,materials.get(part.material)??part.material,set.placed.length);mesh.name=`${id} rock${level?' (far)':''}`;
        // A white instance colour as for the code-built stones: the same program.
        mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(set.placed.length*3).fill(1),3);
        mesh.castShadow=castShadow;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.userData.rockKit={id,level:level?'far':'near'};
        group.add(mesh);return {mesh,local:root.matrixWorld.clone().invert().multiply(part.matrixWorld)};
      }))}));
      layout(null);last=null;return sets.length;
    },
    update(camera){if(!camera||!sets.length||last&&Math.hypot(camera.x-last.x,camera.z-last.z)<MOVE)return false;last={x:camera.x,z:camera.z};layout(camera);return true;},
    rocks:()=>sets.flatMap(set=>set.placed.map(({id,position,radius,height})=>({id,position,radius,height}))),
    stats(){let drawn=0,instances=0,placed=0;for(const set of sets){placed+=set.placed.length;for(const level of set.meshes)for(const {mesh}of level)if(mesh.count){drawn++;instances+=mesh.count;}}return {kit,rocks:sets.length,placed,drawn,instances};},
    // The kit's geometry is not ours, nor the materials: only the instance buffers are.
    dispose(){for(const set of sets)for(const level of set.meshes)for(const {mesh}of level){mesh.removeFromParent();mesh.dispose();}sets=[];for(const set of rocks.values())set.placed.length=0;}
  };
}
