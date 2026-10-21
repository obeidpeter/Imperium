import * as T from '../../vendor/three/three.module.js';
import {locomotionPhase} from './actor-pose.js';
import {actorMaterialKey} from './actor-material-key.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};

// Two additional cloth joints bend a continuous weighted surface. The existing
// named kinematic joints and their contact anchors remain the source of truth.
export function createClothRig(parent,top,middle,bottom){
  const mid=new T.Bone(),hem=new T.Bone();mid.name=`${parent.name}-fold`;hem.name=`${parent.name}-edge`;
  mid.position.y=middle;hem.position.y=bottom-middle;parent.add(mid);mid.add(hem);
  return {parent,mid,hem,top,middle,bottom,update(pose,input={}){
    const moving=['walk','run','retreat'].includes(input.motion),time=Number.isFinite(input.time)?input.time:0,phase=Number.isFinite(input.phase)?input.phase:time*(input.motion==='run'?2.1:1.4);
    const cycle=(Number.isFinite(input.locomotionDistance)?locomotionPhase(input.locomotionDistance,input.motion,input.mounted):phase)*Math.PI*2,weight=clamp(Number.isFinite(input.locomotionWeight)?input.locomotionWeight:1);
    // No spring accumulator: reset, seeking and reduced motion are exact.
    const sway=input.reducedMotion?0:moving?Math.sin(cycle-.55)*.07*weight:Math.sin(time*1.3)*.007;
    const turn=clamp(pose.bodyY??0,-.5,.5),lean=clamp(pose.bodyX??0,-.5,.5),fold=clamp(pose.skirt??0,-.2,.2);
    mid.rotation.set(fold*.4-lean*.12,turn*-.16,sway*.55);
    hem.rotation.set(fold*.7+Math.max(0,-lean)*.18,turn*-.12,sway*.85);
  }};
}

const materialKey=actorMaterialKey;

/** Consolidate articulated surfaces into real weighted SkinnedMeshes. Equipment
 * with its own visibility and the named sole geometry stay on their old joints.
 * This is local authored linear-blend skinning, not an imported character asset. */
export function bindActorSurfaces(group,sources,{geometries,materials,skeletons,clothRigs=[],overview=false}={}){
  group.updateMatrixWorld(true);
  const bones=[];group.traverse(o=>{if(o.isBone)bones.push(o);});
  const boneIndex=new Map(bones.map((bone,i)=>[bone,i])),horseBody=bones.find(b=>b.name==='horse-body'),inverse=group.matrixWorld.clone().invert(),buckets=new Map(),retained=[];
  const dynamic=/(?:^sword$|^spear$|^practice-sword$|^held-javelin$|^nocked-arrow$|^ankle$|^horse-fetlock$)/;
  const point=new T.Vector3(),normalMatrix=new T.Matrix3();
  for(const item of sources){
    let parent=item.parent,excluded=false;for(let p=parent;p&&p!==group;p=p.parent)if(dynamic.test(p.name))excluded=true;
    if(excluded||!parent?.isBone){retained.push(item);continue;}
    const material=item.material,key=materialKey(material),bucket=buckets.get(key)??{items:[],material};bucket.items.push(item);buckets.set(key,bucket);
  }
  if(!buckets.size)return retained;
  const skeleton=new T.Skeleton(bones);skeletons.add(skeleton);
  for(const {items,material} of buckets.values()){
    const positions=[],normals=[],uvs=[],colors=[],indices=[],weights=[];
    for(const item of items){
      const bone=item.parent,bind=new T.Matrix4().multiplyMatrices(inverse,item.matrixWorld),source=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone(),p=source.attributes.position,n=source.attributes.normal,color=source.attributes.color,uv=source.attributes.uv;
      normalMatrix.getNormalMatrix(bind);
      const cloth=clothRigs.find(r=>r.parent===bone),base=boneIndex.get(bone),up=boneIndex.get(bone.parent),tint=item.material.color;
      // How this joint's vertices blend toward its parent, decided once per part.
      const name=bone.name,lid=source.attributes.lidWeight,brow=source.attributes.browWeight;
      const bend=up===undefined?'':/eyelid$/.test(name)&&lid?'lid':/brow$/.test(name)&&brow?'brow':/shoulder$/.test(name)?'shoulder':name==='elbow'||name==='knee'||name==='horse-knee'?'joint':/thigh$/.test(name)?'thigh':name==='torso'?'torso':name==='horse-neck'?'neck':'';
      const hoof=/^(fore|hind)-.*-leg$/.test(name)&&horseBody?boneIndex.get(horseBody):undefined;
      for(let i=0;i<p.count;i++){
        const localY=p.getY(i),localX=p.getX(i);point.fromBufferAttribute(p,i).applyMatrix4(bind);positions.push(point.x,point.y,point.z);
        const worldY=point.y;point.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);normals.push(point.x,point.y,point.z);uvs.push(uv?.getX(i)??0,uv?.getY(i)??0);
        let a=base,b=base,w=0;
        if(cloth){if(localY>=cloth.middle){a=base;b=boneIndex.get(cloth.mid);w=smooth((cloth.top-localY)/(cloth.top-cloth.middle));}else{a=boneIndex.get(cloth.mid);b=boneIndex.get(cloth.hem);w=smooth((cloth.middle-localY)/(cloth.middle-cloth.bottom));}}
        else if(up!==undefined){
          if(bend==='lid')w=1-lid.getX(i);
          else if(bend==='brow')w=1-brow.getX(i);
          else if(bend==='shoulder')w=1-smooth((.065-localY)/.18);
          else if(bend==='joint')w=1-smooth((.045-localY)/.10);
          else if(bend==='thigh')w=1-smooth((.055-localY)/.15);
          else if(bend==='torso')w=1-smooth((localY+.025)/.20);
          else if(bend==='neck')w=1-smooth((localY+.06)/.28);
          b=up;
          if(hoof!==undefined){b=hoof;w=1-smooth((.075-localY)/.24);}
        }
        indices.push(a,b,0,0);weights.push(1-w,w,0,0);
        let r=tint.r*(color?.getX(i)??1),g=tint.g*(color?.getY(i)??1),blue=tint.b*(color?.getZ(i)??1);
        // Broad seam/hem wear survives the overview; microtexture alone did not.
        if(material.map&&!overview){const shade=.93+.06*Math.sin(localX*17+localY*8),dust=clamp((.78-worldY)*.19,0,.09);r=r*shade*(1-dust)+.29*dust;g=g*shade*(1-dust)+.22*dust;blue=blue*shade*(1-dust)+.13*dust;}
        colors.push(r,g,blue);
      }
      source.dispose();item.removeFromParent();geometries.delete(item.geometry);item.geometry.dispose();
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometries.add(geometry);
    const mat=material.clone();mat.color.set(0xffffff);mat.vertexColors=true;materials.add(mat);
    const skin=new T.SkinnedMesh(geometry,mat);skin.name=overview?'overview-weighted-surface':'weighted-character-surface';skin.userData.overview=overview;skin.castShadow=true;skin.receiveShadow=true;skin.visible=!overview;group.add(skin);skin.bind(skeleton);skin.normalizeSkinWeights();
    // Conservative local bounds cover all authored poses. Picking still tests
    // actual deformed triangles; no per-frame full-vertex bounds scan is needed.
    skin.boundingSphere=new T.Sphere(new T.Vector3(0,1.25,0),3);skin.frustumCulled=false;retained.push(skin);
  }
  return retained;
}
