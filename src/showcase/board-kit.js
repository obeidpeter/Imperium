import * as T from '../../vendor/three/three.module.js';
import {worldModelUrl} from '../ui/world-catalog.js';
import {boardKitFamily} from './structure-registry.js';

// The board kit's pieces on the field (worlds and gameplay plan, release 4):
// each mesh of each piece drawn once for all its cells (an InstancedMesh), near
// and far, each cell drawn at the level its distance from the camera asks for.
// Presentation only: the placements come from structure-registry.js, and no
// piece takes picks or changes a route.

// The model for an encounter's structures, or null (it has no fortification record).
export const boardKitUrl=e=>{const family=boardKitFamily(e);return family?worldModelUrl(`board-kit-${family}`):null;};
// Within this distance (metres) a cell shows the near piece.
export const BOARD_KIT_NEAR=36;
const MOVE=3;

export function createBoardKitPieces(group,master,placements,{finish=null}={}){
  const sets=[],pieces=new Map();
  for(const p of placements){if(!pieces.has(p.piece))pieces.set(p.piece,[]);pieces.get(p.piece).push(p);}
  const yaw=new T.Quaternion(),up=new T.Vector3(0,1,0),scale=new T.Vector3(1,1,1),at=new T.Vector3(),place=new T.Matrix4(),each=new T.Matrix4();
  for(const [piece,list]of pieces){
    const levels=[piece,`${piece}_far`].map(name=>master.getObjectByName(name)).map((root,level)=>{
      if(!root)return null;root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),meshes=[];
      root.traverse(o=>{
        if(!o.isMesh)return;
        const mesh=new T.InstancedMesh(o.geometry,o.material,list.length);mesh.name=`board kit ${o.name}${level?' (far)':''}`;mesh.count=0;
        // White instance colours: the shader programs (and shadow pass) of the scenery's other batches.
        mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(list.length*3).fill(1),3);
        mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.raycast=()=>{};finish?.(o.material);
        meshes.push({mesh,local:inverse.clone().multiply(o.matrixWorld)});group.add(mesh);
      });
      return meshes;
    });
    if(levels[0])sets.push({piece,list,levels:levels[1]?levels:[levels[0],levels[0]]});
  }
  let last=null;
  // Write each cell's matrix into the level its distance asks for.
  function layout(camera){
    for(const set of sets){
      for(const level of new Set(set.levels))for(const {mesh}of level)mesh.count=0;
      for(const p of set.list){
        const far=camera?Math.hypot(camera.x-p.x,camera.z-p.z)>BOARD_KIT_NEAR:false,level=set.levels[far?1:0];
        yaw.setFromAxisAngle(up,p.yaw);place.compose(at.set(p.x,p.y,p.z),yaw,scale);
        for(const {mesh,local}of level)mesh.setMatrixAt(mesh.count++,each.multiplyMatrices(place,local));
      }
      for(const level of new Set(set.levels))for(const {mesh}of level){mesh.instanceMatrix.needsUpdate=true;mesh.visible=mesh.count>0;}
    }
  }
  layout(null);
  return {
    pieces:[...pieces.keys()],
    // Re-level when the camera has moved a few metres (stage update).
    update(camera){if(!camera||last&&Math.hypot(camera.x-last.x,camera.z-last.z)<MOVE)return false;last={x:camera.x,z:camera.z};layout(camera);return true;},
    stats(){let drawn=0,instances=0;for(const set of sets)for(const level of new Set(set.levels))for(const {mesh}of level)if(mesh.count){drawn++;instances+=mesh.count;}return {pieces:sets.length,drawn,instances};},
    // The master's geometry and materials are shared: only the instance buffers are ours.
    dispose(){for(const set of sets)for(const level of new Set(set.levels))for(const {mesh}of level){mesh.removeFromParent();mesh.dispose();}sets.length=0;}
  };
}
