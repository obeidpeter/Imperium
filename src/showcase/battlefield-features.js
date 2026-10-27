import * as T from '../../vendor/three/three.module.js';
import {gridToWorld} from './environment-layout.js';
import {createFieldworkKit} from './environment-fieldwork.js';
import {batchStaticEnvironment} from './environment-batching.js';
import {createFlamePlume,sampleFlamePlume} from './stage-particles.js';
import {BOARD_KIT_KINDS,boardKitFamily,boardKitPieces} from './structure-registry.js';
import {createBoardKitPieces} from './board-kit.js';

// Only committed field state drives these presentation meshes. Decorative
// detail merges by material and never becomes a picking or rule obstacle.
// boardKit: the board kit's loaded model (board-kit.js), whose pieces then draw
// the field's structures; without it the code-built fieldwork stands in. Its
// materials are the cached model's, shared between stages, so they take their
// own finish (kitFinish) rather than this stage's (finish).
export function createBattlefieldFeatures(scene,{heightAt=()=>0,quality='balanced',finish=null,kitFinish=null,boardKit=null}={}){
  const group=new T.Group();group.name='interactive-battlefield';scene.add(group);
  let signature='',fires=[],walkSurfaces=[],platformSurfaces=[],bounds=null,disposed=false,retired=[],chapter=1,weather=null,pieces=null;
  const geometries=new Set(),materials=new Set();
  // A state change rebuilds the set with materials like the old ones. The old
  // ones are disposed only after the new set has drawn, so their shader
  // programs pass straight to the new materials instead of compiling again.
  function clear(){
    for(const g of geometries)g.dispose();if(materials.size)retired.push({materials:[...materials],frames:0});
    pieces?.dispose();pieces=null;
    geometries.clear();materials.clear();group.clear();group.userData.fieldObjects=[];fires=[];walkSurfaces=[];platformSurfaces=[];bounds=null;
  }
  function release(force=false){retired=retired.filter(r=>{if(!force&&++r.frames<3)return true;r.materials.forEach(m=>m.dispose());return false;});}
  const ground=(x,z)=>{const y=heightAt(x,z);return Number.isFinite(y)?y:0;};
  function sync(e){
    if(disposed)return false;
    const next=JSON.stringify([e?.id,e?.width,e?.height,e?.featureEdition,e?.kind,e?.type,e?.field,e?.fortifications]);
    if(next===signature)return false;signature=next;clear();
    if(e?.featureEdition!==31||e.kind!=='battle'||e.type==='training'||!Array.isArray(e.field?.objects))return true;
    chapter=Number(/^ch(\d+)/.exec(e.id??'')?.[1]??1);weather=e.weather??null;
    const kit=createFieldworkKit({chapter,quality,geometries,materials,finish}),records=[];
    const useKit=!!boardKit&&!!boardKitFamily(e);
    for(const platform of e.fortifications?.platforms??[]){
      const p=gridToWorld(platform,e,2.5),step=gridToWorld({x:platform.steps[0],y:platform.steps[1]},e,2.5),base=ground(p.x,p.z)-platform.height;
      // Either way the deck and its stair are walked at the rules' heights.
      platformSurfaces.push(useKit?{x:p.x,z:p.z,base,height:platform.height,dx:(p.x-step.x)/2.5,dz:(p.z-step.z)/2.5}:kit.platform(group,platform,{...p,y:base},step));
    }
    if(useKit){
      const placements=boardKitPieces(e,{height:ground});pieces=createBoardKitPieces(group,boardKit,placements,{finish:kitFinish});
      for(const p of placements)if(p.walk)walkSurfaces.push({x:p.x,z:p.z,left:p.deck-.13,right:p.deck-.13,halfLength:p.yaw?.72:1.35,halfWidth:p.yaw?1.35:.72});
    }
    for(const o of e.field.objects){
      if(useKit&&(BOARD_KIT_KINDS.includes(o.kind)||o.gatePanel))continue;
      if(!Number.isInteger(o.x)||!Number.isInteger(o.y)||o.x<0||o.y<0||o.x>=e.width||o.y>=e.height)continue;
      const p=gridToWorld(o,e,2.5),left=ground(p.x-1.35,p.z),right=ground(p.x+1.35,p.z);
      const y=o.kind==='bridge'?(left+right)/2:ground(p.x,p.z),model=kit.build(group,o,{x:p.x,y,z:p.z,left,right});
      model.updateWorldMatrix(true,true);const b=new T.Box3().setFromObject(model);
      if(!b.isEmpty())records.push({id:o.id,kind:o.kind,state:o.state,min:b.min.toArray(),max:b.max.toArray()});
      if(o.kind==='bridge'&&o.state==='repaired')walkSurfaces.push({x:p.x,z:p.z,left,right,halfLength:1.35,halfWidth:.72});
      if(o.kind==='brazier'&&o.state==='burning'){
        const plume=createFlamePlume();plume.position.set(p.x,y+.72,p.z);plume.name='pitch flame and rising smoke';
        geometries.add(plume.geometry);materials.add(plume.material);group.add(plume);fires.push(plume);
      }
    }
    const batching=batchStaticEnvironment(group,{geometries,instanceThreshold:Infinity});
    let triangles=0,drawBatches=0;group.traverse(o=>{if(o.isMesh){drawBatches++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
    group.userData.fieldObjects=records;group.userData.regionalPalette=kit.region.key;
    bounds={objects:records.length,drawBatches,triangles,region:kit.region.key,batching};
    return true;
  }
  return {group,sync,
    surfaceHeight(x,z){
      for(const p of platformSurfaces){
        const along=(x-p.x)*p.dx+(z-p.z)*p.dz,across=-(x-p.x)*p.dz+(z-p.z)*p.dx;
        if(Math.abs(x-p.x)<=1.25&&Math.abs(z-p.z)<=1.25)return p.base+p.height+.05;
        if(along>=-3.75&&along<=-1.25&&Math.abs(across)<=1.25)return p.base+(along+3.75)/2.5*p.height+.05;
      }
      for(const s of walkSurfaces)if(Math.abs(x-s.x)<=s.halfLength&&Math.abs(z-s.z)<=s.halfWidth)return s.left+(s.right-s.left)*(x-s.x+s.halfLength)/(s.halfLength*2)+.13;
      return null;
    },
    update(time,reduced,camera=null){release();pieces?.update(camera);if(!Number.isFinite(time))return;for(const f of fires)sampleFlamePlume(f,time,{reducedMotion:reduced,chapter,weather});},
    stats:()=>bounds&&{...bounds,boardKit:pieces?.stats()??null},
    dispose(){if(disposed)return;disposed=true;clear();release(true);group.removeFromParent();}
  };
}
