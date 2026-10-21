import * as T from '../../vendor/three/three.module.js';
import {gridToWorld} from './environment-layout.js';
import {createFieldworkKit} from './environment-fieldwork.js';
import {batchStaticEnvironment} from './environment-batching.js';

// Only committed field state drives these presentation meshes. Decorative
// detail merges by material and never becomes a picking or rule obstacle.
export function createBattlefieldFeatures(scene,{heightAt=()=>0,quality='balanced'}={}){
  const group=new T.Group();group.name='interactive-battlefield';scene.add(group);
  let signature='',fires=[],walkSurfaces=[],bounds=null,disposed=false,retired=[];
  const geometries=new Set(),materials=new Set();
  // A state change rebuilds the set with materials like the old ones. The old
  // ones are disposed only after the new set has drawn, so their shader
  // programs pass straight to the new materials instead of compiling again.
  function clear(){
    for(const g of geometries)g.dispose();if(materials.size)retired.push({materials:[...materials],frames:0});
    geometries.clear();materials.clear();group.clear();group.userData.fieldObjects=[];fires=[];walkSurfaces=[];bounds=null;
  }
  function release(force=false){retired=retired.filter(r=>{if(!force&&++r.frames<3)return true;r.materials.forEach(m=>m.dispose());return false;});}
  const ground=(x,z)=>{const y=heightAt(x,z);return Number.isFinite(y)?y:0;};
  function sync(e){
    if(disposed)return false;
    const next=JSON.stringify([e?.id,e?.width,e?.height,e?.featureEdition,e?.kind,e?.type,e?.field]);
    if(next===signature)return false;signature=next;clear();
    if(e?.featureEdition!==31||e.kind!=='battle'||e.type==='training'||!Array.isArray(e.field?.objects))return true;
    const chapter=Number(/^ch(\d+)/.exec(e.id??'')?.[1]??1),kit=createFieldworkKit({chapter,quality,geometries,materials}),records=[];
    for(const o of e.field.objects){
      if(!Number.isInteger(o.x)||!Number.isInteger(o.y)||o.x<0||o.y<0||o.x>=e.width||o.y>=e.height)continue;
      const p=gridToWorld(o,e,2.5),left=ground(p.x-1.35,p.z),right=ground(p.x+1.35,p.z);
      const y=o.kind==='bridge'?(left+right)/2:ground(p.x,p.z),model=kit.build(group,o,{x:p.x,y,z:p.z,left,right});
      model.updateWorldMatrix(true,true);const b=new T.Box3().setFromObject(model);
      if(!b.isEmpty())records.push({id:o.id,kind:o.kind,state:o.state,min:b.min.toArray(),max:b.max.toArray()});
      if(o.kind==='bridge'&&o.state==='repaired')walkSurfaces.push({x:p.x,z:p.z,left,right,halfLength:1.35,halfWidth:.72});
      if(o.kind==='brazier'&&o.state==='burning'){
        // Five translucent objects at most, excluded from opaque merging.
        for(let i=0;i<5;i++){
          const geometry=i<2?new T.SphereGeometry(1,8,6):new T.IcosahedronGeometry(1,1);
          const material=new T.MeshBasicMaterial({color:i<2?(i?'#fff1b2':'#eaa24a'):'#75695a',transparent:true,opacity:i<2?.75:.13,depthWrite:false});
          geometries.add(geometry);materials.add(material);
          const mesh=new T.Mesh(geometry,material),scale=i<2?[.14-i*.06,.33-i*.08,.13-i*.05]:[.27+(i-2)*.09,.29+(i-2)*.08,.27+(i-2)*.09];
          mesh.position.set(p.x+(i<2?0:(i-2)*.09),y+(i<2?.99:1.40+(i-2)*.42),p.z);mesh.scale.set(...scale);
          mesh.name=i<2?'pitch flame':'pitch smoke';group.add(mesh);fires.push({mesh,scale,index:i});
        }
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
      for(const s of walkSurfaces)if(Math.abs(x-s.x)<=s.halfLength&&Math.abs(z-s.z)<=s.halfWidth)return s.left+(s.right-s.left)*(x-s.x+s.halfLength)/(s.halfLength*2)+.13;
      return null;
    },
    update(time,reduced){release();if(!Number.isFinite(time))return;for(const f of fires){const a=reduced?0:Math.sin(time*(f.index<2?7:1.2)+f.index);f.mesh.scale.set(f.scale[0]*(1+a*.05),f.scale[1]*(1+a*(f.index<2?.15:.06)),f.scale[2]*(1+a*.05));}},
    stats:()=>bounds,
    dispose(){if(disposed)return;disposed=true;clear();release(true);group.removeFromParent();}
  };
}
