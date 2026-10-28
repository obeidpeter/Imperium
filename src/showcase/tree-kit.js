import * as T from '../../vendor/three/three.module.js';
import {worldModelUrl} from '../ui/world-catalog.js';
import {TREE_KIT_COMPONENTS} from './tree-kit-components.js';
import {canopyRadius} from './environment-composition.js';
import {hash} from './environment-layout.js';
import {getSceneProfile} from './campaign-scene-profile.js';

// The regional tree kits (worlds and gameplay plan, release 5), built in Blender by
// scripts/assets/build-trees.py: each species three times, near, mid and an impostor
// of two crossed cards, every tree 0.5 units tall with its foot at the origin. One
// instanced draw for each species and level; each tree is drawn at the level its
// distance from the camera asks for. Presentation only: placements come from the
// world's own tree plans (world-weather.js and the scenery that plants trees), and no
// tree takes picks or changes a route.

export const TREE_KIT_CHAPTERS=Object.freeze({temperate:Object.freeze([1,2,3,4,8,10]),italy:Object.freeze([7,11,12]),arid:Object.freeze([5,6,9])});
export const treeKitFor=chapter=>Object.keys(TREE_KIT_CHAPTERS).find(kit=>TREE_KIT_CHAPTERS[kit].includes(Number(chapter)))??null;
// The kit model a chapter's world plants, or null.
export const treeKitUrl=chapter=>{const kit=treeKitFor(chapter);return kit?worldModelUrl(`trees-${kit}`):null;};
// The kit a scene's world plants from: none indoors, where no tree stands.
export const sceneTreeKitUrl=(encounter,chapter)=>{const profile=getSceneProfile(encounter,{chapter});return profile.civic?null:treeKitUrl(profile.chapter);};
// A tree shows its near level within this distance (metres), its mid level within the second.
// A field plants only a dozen or so trees, so the mid level reaches far: the two crossed
// cards read as an X from the high cameras, and are left to the skyline.
export const TREE_KIT_LEVELS=Object.freeze({near:30,mid:150});
export const TREE_KIT_HEIGHT=.5;
const LEVELS=['','_mid','_far'],MOVE=3;

// A planted tree's transform: its height from the plan, a turn from its seed and, where
// the kit's crown would spread past the clearance its plan kept (canopyRadius), a crown
// drawn in to fit it.
export function treeKitTransform(kit,kind,{x,y,z,height,seed=0}){
  const component=TREE_KIT_COMPONENTS[kit]?.[kind];if(!component)return null;
  const scale=height/TREE_KIT_HEIGHT,spread=component.crownRadius*scale,fit=Math.min(1,canopyRadius(kind,height)/Math.max(spread,1e-6));
  return {position:[x,y,z],yaw:hash(seed,61)*Math.PI*2,scale:[scale*fit,scale,scale*fit],crown:spread*fit};
}

// The trees one world plants from a loaded kit. plant() records a tree as the world is
// built; build() makes the instanced draws once every tree is known. The meshes share
// the kit's geometry and `material`, which the caller owns.
export function createTreeKitPlanter(master,kit,material){
  const species=new Map();
  for(const kind of Object.keys(TREE_KIT_COMPONENTS[kit]??{})){
    const levels=LEVELS.map(suffix=>{let geometry=null;master?.getObjectByName(kind+suffix)?.traverse(o=>{if(o.isMesh&&!geometry)geometry=o.geometry;});return geometry;});
    if(levels.every(Boolean))species.set(kind,{levels,trees:[]});
  }
  let sets=[],last=null;
  const dummy=new T.Object3D(),turn=new T.Euler();
  function layout(camera){
    for(const set of sets){
      for(const mesh of set.meshes)mesh.count=0;
      for(const tree of set.trees){
        // Without a camera (the world's bake) every tree stands at its mid level.
        const d=camera?Math.hypot(camera.x-tree.position[0],camera.z-tree.position[2]):TREE_KIT_LEVELS.near+1;
        const mesh=set.meshes[d<TREE_KIT_LEVELS.near?0:d<TREE_KIT_LEVELS.mid?1:2];
        mesh.setMatrixAt(mesh.count,tree.matrix);mesh.setColorAt(mesh.count,tree.color);mesh.count++;
      }
      for(const mesh of set.meshes){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.visible=mesh.count>0;}
    }
  }
  return {
    kit,
    has:kind=>species.has(kind),
    plant(kind,placement){
      const set=species.get(kind),t=set&&treeKitTransform(kit,kind,placement);if(!t)return false;
      dummy.position.set(...t.position);turn.set(0,t.yaw,0);dummy.quaternion.setFromEuler(turn);dummy.scale.set(...t.scale);dummy.updateMatrix();
      const seed=placement.seed??0,color=new T.Color().setRGB(.9+hash(seed,3)*.12,.92+hash(seed,4)*.1,.86+hash(seed,5)*.14);
      set.trees.push({kind,position:t.position,crown:t.crown,matrix:dummy.matrix.clone(),color});return true;
    },
    // The instanced draws, added to `group` (the world's root, so they share its light,
    // its baked occlusion and the camera's cutaway), at their mid level until update().
    build(group,{castShadow=true}={}){
      sets=[...species].filter(([,set])=>set.trees.length).map(([kind,set])=>({trees:set.trees,meshes:set.levels.map((geometry,level)=>{
        const mesh=new T.InstancedMesh(geometry,material,set.trees.length);mesh.name=`${kind} tree${LEVELS[level]?` (${LEVELS[level].slice(1)})`:''}`;
        // Instance colours tint each tree; every foliage batch carries them, so all share one program.
        mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(set.trees.length*3).fill(1),3);
        mesh.castShadow=castShadow;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.userData.treeKit={kind,level:level?LEVELS[level].slice(1):'near'};
        group.add(mesh);return mesh;
      })}));
      layout(null);last=null;return sets.length;
    },
    // Re-level when the camera has moved a few metres (the world's update).
    update(camera){if(!camera||!sets.length||last&&Math.hypot(camera.x-last.x,camera.z-last.z)<MOVE)return false;last={x:camera.x,z:camera.z};layout(camera);return true;},
    trees:()=>sets.flatMap(set=>set.trees.map(({kind,position,crown})=>({kind,position,crown}))),
    stats(){let drawn=0,instances=0,trees=0;for(const set of sets){trees+=set.trees.length;for(const mesh of set.meshes)if(mesh.count){drawn++;instances+=mesh.count;}}return {kit,species:sets.length,trees,drawn,instances};},
    // The kit's geometry and the material are not ours: only the instance buffers are.
    dispose(){for(const set of sets)for(const mesh of set.meshes){mesh.removeFromParent();mesh.dispose();}sets=[];for(const set of species.values())set.trees.length=0;}
  };
}
