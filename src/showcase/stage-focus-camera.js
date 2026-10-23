import * as T from '../../vendor/three/three.module.js';

const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
const validPoint=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
const solidMaterial=m=>!!m&&m.visible!==false&&!m.userData.environmentVegetation&&!m.transparent;

// Scenery deliberately disables its ordinary raycast so it cannot intercept
// a movement click. Follow has a separate structural query: call the matching
// Three.js geometry implementation without changing the object's picking hook.
const structuralRaycast=o=>o.isBatchedMesh?T.BatchedMesh.prototype.raycast:
  o.isInstancedMesh?T.InstancedMesh.prototype.raycast:o.isSkinnedMesh?T.SkinnedMesh.prototype.raycast:T.Mesh.prototype.raycast;

// Select once on Follow or after a followed unit moves, never in the idle hot
// loop. Test real batched/instanced structural geometry, not coarse whole-hall
// bounds: an enclosing chamber's bounds legitimately contain the entire board.
export function findFocusCamera(environment,{position,mounted=false,distance=mounted?10:7.5,preferredYaw,preferredPitch=.36,sceneryGroups=[]}={}){
  if(!environment?.group||!validPoint(position)||!Number.isFinite(distance)||distance<=0)return null;
  const origin=new T.Vector3(position.x,position.y,position.z),target=origin.clone().add(new T.Vector3(0,mounted?1.2:.85,0));
  const probes=(mounted?[.95,2.05,3.05]:[.65,1.35,2.13]).map(y=>origin.clone().add(new T.Vector3(0,y,0)));
  const inward=Math.hypot(position.x,position.z)>.2?Math.atan2(-position.x,-position.z):1.1,yaw=Number.isFinite(preferredYaw)?preferredYaw:inward;
  const pitch=Number.isFinite(preferredPitch)?Math.max(.28,Math.min(1.05,preferredPitch)):.36;
  const blockers=[],included=new Set();
  for(const group of new Set([environment.group,...sceneryGroups].filter(Boolean))){
    group.updateWorldMatrix(true,true);
    group.traverse(o=>{
      if(!o.isMesh||included.has(o)||o===environment.ground||o.userData.environmentGround||!o.visible)return;
      for(let parent=o.parent;parent;parent=parent.parent)if(!parent.visible)return;
      const materials=Array.isArray(o.material)?o.material:[o.material];
      // Foliage is explicitly identified by its material. Double-sided opaque
      // cloth, walls and untextured architecture still block a camera.
      if(!materials.some(solidMaterial))return;
      included.add(o);blockers.push(o);
    });
  }
  const ray=new T.Raycaster(),direction=new T.Vector3(),camera=new T.Vector3(),candidates=[],seen=new Set();
  for(const offset of [0,.45,-.45,.90,-.90,Math.PI/2,-Math.PI/2,Math.PI])for(const elevation of [pitch,.52,.70,.88]){
    const y=angle(yaw+offset),p=Math.max(.28,Math.min(1.05,elevation)),key=`${y.toFixed(5)}:${p.toFixed(5)}`;if(seen.has(key))continue;seen.add(key);
    candidates.push({yaw:y,pitch:p,distance,cost:Math.abs(offset)+Math.abs(p-pitch)*1.6});
  }
  candidates.sort((a,b)=>a.cost-b.cost);
  function blocked(from,to){
    direction.subVectors(to,from);const length=direction.length();if(length<.25)return false;
    ray.set(from,direction.multiplyScalar(1/length));ray.near=.015;ray.far=length-.18;
    const hits=[];
    for(const object of blockers){
      if(!object.layers.test(ray.layers))continue;
      hits.length=0;structuralRaycast(object).call(object,ray,hits);
      // A mesh can combine opaque architecture and transparent/foliage faces.
      // Only the intersected material determines whether that face obstructs.
      if(hits.some(hit=>solidMaterial(Array.isArray(object.material)?object.material[hit.face?.materialIndex??0]:object.material)))return true;
    }
    return false;
  }
  for(const candidate of candidates){
    const {yaw,pitch}=candidate;camera.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);
    // Camera→subject respects visible material faces; the reverse ray catches
    // cameras starting inside an opaque beam, whose back face would be culled.
    if(probes.some(probe=>blocked(camera,probe)||blocked(probe,camera)))continue;
    return {yaw,pitch,distance};
  }
  return null;
}
