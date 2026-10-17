import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';

export const ACTOR_MODEL_URL='assets/models/roman-human-v017.glb';
const url=new URL(`../../${ACTOR_MODEL_URL}`,import.meta.url).href;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
// One immutable loaded master. Each actor owns its adapted geometry/skeleton;
// disposing an actor never disposes geometry still used by another actor.
export function createActorAssetLibrary(load=async()=>new GLTFLoader().loadAsync(url)){
  let pending=null,master=null,failure=null;
  return {
    warm(){return pending??=(async()=>{try{const gltf=await load(),mesh=gltf.scene.getObjectByName('imported-human-anatomy');if(!mesh?.isSkinnedMesh||!mesh.geometry.attributes.skinWeight||mesh.skeleton.bones.length!==6)throw Error('Invalid anatomy asset');master={geometry:mesh.geometry,bones:mesh.skeleton.bones.map(b=>b.name)};return true;}catch(error){failure=String(error?.message??error);return false;}})();},
    status(){return {ready:!!master,pending:!!pending&&!master&&!failure,error:failure};},
    anatomy(identity){return master?adaptAnatomy(master,identity):null;}
  };
}
const library=createActorAssetLibrary();
export const warmActorAssets=()=>library.warm();
export const actorAssetStatus=()=>library.status();
export const actorAnatomy=identity=>library.anatomy(identity);

function adaptAnatomy(master,id){
  const geometry=master.geometry.clone(),p=geometry.attributes.position,c=[];
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const head=geometry.attributes.skinIndex.getX(i)===1,ly=y-1.485;
    if(head){const jaw=Math.exp(-(((ly+.012)/.055)**2)),cheek=Math.exp(-(((ly-.061)/.045)**2)),front=clamp((z+.01)/.09),nose=Math.exp(-((x/.024)**2+((ly-.05)/.055)**2));
      x*=1+(id.jaw-1)*jaw*.6+(id.cheek-1)*cheek*.6;z+=(id.nose-1)*.055*nose*front;
      // The source crop includes the base of the neck. Tuck that boundary
      // inside the continuous rig neck instead of exposing shoulder-like tabs.
      const tuck=1-T.MathUtils.smoothstep(y,1.420,1.462),radius=Math.max(1,Math.hypot(x/.056,z/.052));x*=1-tuck*(1-1/radius);z*=1-tuck*(1-1/radius);
      const lip=Math.exp(-((x/.031)**4+((ly-.008)/.010)**2))*front,stubble=(id.beard??0)*.13*Math.exp(-(((ly+.015)/.045)**2))*front;
      c.push(1-stubble-lip*.09,.98-stubble-lip*.27,.95-stubble-lip*.23);
    }else {x+=(x<0?-1:1)*.006*((id.build??1)-1);c.push(.98,.96,.93);}
    p.setXYZ(i,x,y,z);
  }
  // Packed glTF normals must be replaced before recomputation: accumulating
  // tiny facial triangle areas into normalized Int16 rounds them to zero.
  geometry.setAttribute('color',new T.Float32BufferAttribute(c,3));geometry.deleteAttribute('normal');geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={asset:'MakeHuman CC0',identity:id.key};
  const hair=surfaceSubset(geometry,(x,y,z)=>Math.min(y-(1.485+.085+clamp((z+.03)/.09)*((id.hair==='receding'?.17:.14)-.085)),.097-Math.abs(x)),.0055,id);
  const beard=(id.beard??0)>.3?surfaceSubset(geometry,(x,y,z)=>Math.min(z-.015,y-1.418,1.507-y,Math.max(Math.abs(x)-.030,1.474-y)),.0028+id.beard*.003,id):null;
  function facePoint(x,y,offset=0){let front=-Infinity;const a=geometry.attributes.position,indices=geometry.index.array,py=y+1.485;
    for(let i=0;i<indices.length;i+=3){const ia=indices[i],ib=indices[i+1],ic=indices[i+2];if(geometry.attributes.skinIndex.getX(ia)!==1)continue;const ax=a.getX(ia),ay=a.getY(ia),bx=a.getX(ib),by=a.getY(ib),cx=a.getX(ic),cy=a.getY(ic),den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)continue;const u=((by-cy)*(x-cx)+(cx-bx)*(py-cy))/den,v=((cy-ay)*(x-cx)+(ax-cx)*(py-cy))/den,w=1-u-v;if(u>=0&&v>=0&&w>=0)front=Math.max(front,u*a.getZ(ia)+v*a.getZ(ib)+w*a.getZ(ic));}
    return [x,y,Number.isFinite(front)?front+offset:.065+offset];
  }
  return {geometry,hair,beard,bones:master.bones,facePoint};
}
function surfaceSubset(source,distance,offset,id){
  const p=source.attributes.position,n=source.attributes.normal,uv=source.attributes.uv,lookup=source.index.array,positions=[],normals=[],uvs=[],joints=[],weights=[];
  const vertex=i=>({p:[p.getX(i),p.getY(i),p.getZ(i)],n:[n.getX(i),n.getY(i),n.getZ(i)],uv:[uv.getX(i),uv.getY(i)]});
  const interpolate=(a,b,t)=>Object.fromEntries(['p','n','uv'].map(key=>[key,a[key].map((v,i)=>v+(b[key][i]-v)*t)]));
  for(let i=0;i<lookup.length;i+=3){const tri=[lookup[i],lookup[i+1],lookup[i+2]];if(!tri.every(k=>source.attributes.skinIndex.getX(k)===1))continue;
    const polygon=tri.map(vertex),clipped=[];
    for(let j=0;j<3;j++){const a=polygon[j],b=polygon[(j+1)%3],da=distance(...a.p),db=distance(...b.p);if(da>=0)clipped.push(a);if((da>=0)!==(db>=0))clipped.push(interpolate(a,b,da/(da-db)));}
    for(let j=1;j<clipped.length-1;j++)for(const v of [clipped[0],clipped[j],clipped[j+1]]){const length=Math.hypot(...v.n)||1,normal=v.n.map(x=>x/length),wave=id.hair==='curly'?Math.sin(v.p[0]*170+v.p[1]*140)*.0015:0;positions.push(...v.p.map((x,k)=>x+normal[k]*(offset+wave)));normals.push(...normal);uvs.push(...v.uv);joints.push(1,0,0,0);weights.push(1,0,0,0);}
  }
  const g=new T.BufferGeometry();for(const [key,array,size]of [['position',positions,3],['normal',normals,3],['uv',uvs,2],['skinWeight',weights,4]])g.setAttribute(key,new T.Float32BufferAttribute(array,size));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));return g;
}

export function mountActorAnatomy(group,anatomy,{skin,hair,geometries,materials,skeletons}){
  const all=[];group.traverse(o=>{if(o.isBone)all.push(o);});
  const bones=anatomy.bones.map(name=>name==='right-elbow'?all.find(b=>b.name==='elbow'&&b.parent.name==='right-shoulder'):name==='left-elbow'?all.find(b=>b.name==='elbow'&&b.parent.name==='left-shoulder'):all.find(b=>b.name===name));
  if(bones.some(b=>!b))throw Error('Missing anatomy bind joint');
  group.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);skeletons.add(skeleton);const meshes=[];
  for(const [geometry,material,name]of [[anatomy.geometry,skin,'imported-anatomy'],[anatomy.hair,hair,'fitted-hair'],[anatomy.beard,hair,'fitted-beard']]){if(!geometry)continue;geometries.add(geometry);const mat=material.clone();mat.vertexColors=!!geometry.attributes.color;materials.add(mat);const mesh=new T.SkinnedMesh(geometry,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);mesh.bind(skeleton);mesh.boundingSphere=new T.Sphere(new T.Vector3(0,1.2,0),2);meshes.push(mesh);}
  return meshes;
}

