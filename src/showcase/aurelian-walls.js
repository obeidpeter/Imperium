import * as T from '../../vendor/three/three.module.js';
import {mergeGeometries} from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import {worldModelUrl} from '../ui/world-catalog.js';
import {hash} from './environment-layout.js';
import {getEncounterStaging} from './environment-staging.js';
import {AURELIAN_WALL_COMPONENTS,AURELIAN_WALL_MEASURES} from './aurelian-walls-components.js';

// Aurelian's walls before the finale (worlds and gameplay plan, release 9): the Blender
// kit's pieces along the finale's curtain line (finaleLayout, environment-finale.js), in
// the code-built wall's own pattern of finished and rising stretches and its towers every
// thirty metres, with the double gateway at the gate road. Presentation only: every piece
// stands beyond the board's east edge, takes no picks and changes no route.
const RISING=Object.entries(AURELIAN_WALL_MEASURES.rising).sort((a,b)=>a[1]-b[1]);
/** The kit's model for an encounter, or null: only the approach to Rome has the walls. */
export const aurelianWallsUrl=(e,{chapter}={})=>e&&getEncounterStaging(e,{chapter}).key==='rome-approach'?worldModelUrl('aurelian-walls-kit'):null;
/** One placement per piece: the gate, then each 4 m stretch north and south of it, as
 * the code-built curtain lays them (a tower where it has a tower, a stretch still
 * building where it stops short, finished beside every tower). A stretch whose scaffold
 * and bricks would stand among the cohorts drawn up before the wall (the layout's block
 * footprints) is finished instead. */
export function aurelianWallPieces(layout,{height=()=>0}={}){
  const {wallX,gateZ,gateGap,reach,blocks=[]}=layout,{stretch,gateHalf}=AURELIAN_WALL_MEASURES,pieces=[];
  pieces.push({piece:'wall_gate',x:wallX,y:height(wallX,gateZ),z:gateZ,yaw:0});
  const isTower=along=>Math.abs(((along-gateGap)%30)-15)<2.1;
  const clear=(piece,z)=>{const {min,max}=AURELIAN_WALL_COMPONENTS[piece];
    return !blocks.some(({footprint:f})=>f&&wallX+min[0]<f.maxX&&wallX+max[0]>f.minX&&z+min[2]<f.maxZ&&z+max[2]>f.minZ);};
  for(const sign of [-1,1])for(let along=gateGap;along<reach;along+=stretch){
    if(along+stretch<=gateHalf)continue;// within the gate piece
    const z=gateZ+sign*(along+stretch/2),k=Math.round(along*sign),tower=isTower(along);
    const finished=hash(k,5)>.42||along<gateGap+6||isTower(along-stretch)||isTower(along+stretch);
    const top=2.6+hash(k,9)*2.6,rising=(RISING.find(([,h])=>top<h+.7)??RISING.at(-1))[0];
    const piece=tower?'wall_tower':finished||!clear(rising,z)?'wall_curtain':rising;
    pieces.push({piece,x:wallX,y:height(wallX,z),z,yaw:0});
  }
  return pieces;
}
/** A placed piece's ground, in the scene's occupied-box form ({name, min, max}). */
export function aurelianWallBounds(p){
  const {min,max}=AURELIAN_WALL_COMPONENTS[p.piece];
  return {name:`Aurelian walls ${p.piece}`,min:[p.x+min[0],p.y+min[1],p.z+min[2]],max:[p.x+max[0],p.y+max[1],p.z+max[2]]};
}
/** The walls themselves: each placement's meshes copied into place and merged into one
 * mesh per material, as the walls never change and are never picked (five draws, not one
 * per piece and material). The cached kit keeps its geometry and materials, which take
 * `finish`; only the merged copies are ours, and dispose() frees them. */
export function createAurelianWalls(root,kit,pieces,{finish=null}={}){
  const byMaterial=new Map(),place=new T.Matrix4(),turn=new T.Quaternion(),up=new T.Vector3(0,1,0),one=new T.Vector3(1,1,1),at=new T.Vector3();
  let placed=0;
  for(const p of pieces){
    const source=kit.getObjectByName(p.piece);if(!source)continue;
    source.updateWorldMatrix(true,true);const inverse=source.matrixWorld.clone().invert();placed++;
    place.compose(at.set(p.x,p.y,p.z),turn.setFromAxisAngle(up,p.yaw??0),one);
    source.traverse(o=>{
      if(!o.isMesh)return;
      if(!byMaterial.has(o.material))byMaterial.set(o.material,[]);
      byMaterial.get(o.material).push(o.geometry.clone().applyMatrix4(place.clone().multiply(inverse.clone().multiply(o.matrixWorld))));
    });
  }
  const group=new T.Group();group.name='Aurelian walls';
  for(const [material,copies] of byMaterial){
    const geometry=mergeGeometries(copies);for(const copy of copies)copy.dispose();if(!geometry)continue;
    finish?.(material);
    const mesh=new T.Mesh(geometry,material);mesh.name=`Aurelian walls ${material.name||'surface'}`;
    mesh.castShadow=mesh.receiveShadow=true;mesh.raycast=()=>{};group.add(mesh);
  }
  root.add(group);
  return {
    group,
    stats(){let triangles=0;for(const mesh of group.children)triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;return {pieces:placed,meshes:group.children.length,triangles};},
    dispose(){group.removeFromParent();for(const mesh of group.children)mesh.geometry.dispose();}
  };
}
