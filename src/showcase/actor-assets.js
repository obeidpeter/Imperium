import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
import {groomActorHair} from './actor-groom.js';
import {fitActorNeck} from './actor-neck.js';
import {actorHairGeometry} from './actor-hair-asset.js';
import {addActorExpressionMorphs} from './actor-expression-mesh.js';

export const ACTOR_MODEL_URL='assets/models/roman-human-v017.glb';
export const FEMALE_ACTOR_MODEL_URL='assets/models/roman-woman-v018.glb';
const url=new URL(`../../${ACTOR_MODEL_URL}`,import.meta.url).href;
const femaleUrl=new URL(`../../${FEMALE_ACTOR_MODEL_URL}`,import.meta.url).href;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
// One immutable loaded master. Each actor owns its adapted geometry/skeleton;
// disposing an actor never disposes geometry still used by another actor.
export function createActorAssetLibrary(load=async()=>new GLTFLoader().loadAsync(url)){
  let pending=null,master=null,failure=null;
  return {
    warm(){return pending??=(async()=>{try{const gltf=await load(),mesh=gltf.scene.getObjectByName('imported-human-anatomy');if(!mesh?.isSkinnedMesh||!mesh.geometry.attributes.skinWeight||mesh.skeleton.bones.length!==6)throw Error('Invalid anatomy asset');master={geometry:mesh.geometry,bones:mesh.skeleton.bones.map(b=>b.name)};return true;}catch(error){failure=String(error?.message??error);return false;}})();},
    status(){return {ready:!!master,pending:!!pending&&!master&&!failure,error:failure};},
    anatomy(identity,options){return master?adaptAnatomy(master,identity,options):null;}
  };
}
// Separate lazy masters avoid both an early female download and accidental male
// substitution when female loading fails. The single-loader factory above keeps
// its original injectable contract for tests and other authored anatomy sources.
export function createActorAssetCatalog({maleLoad=async()=>new GLTFLoader().loadAsync(url),femaleLoad=async()=>new GLTFLoader().loadAsync(femaleUrl)}={}){
  const male=createActorAssetLibrary(maleLoad),female=createActorAssetLibrary(femaleLoad),select=identity=>identity?.female===true?female:male;
  return {warm:identity=>select(identity).warm(),status:identity=>select(identity).status(),anatomy:(identity,options)=>select(identity).anatomy(identity,options)};
}
const library=createActorAssetCatalog();
export const warmActorAssets=identity=>library.warm(identity);
export const actorAssetStatus=identity=>library.status(identity);
export const actorAnatomy=(identity,options)=>library.anatomy(identity,options);

function adaptAnatomy(master,id,{quality='balanced'}={}){
  const geometry=master.geometry.clone(),p=geometry.attributes.position,c=[];
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const head=geometry.attributes.skinIndex.getX(i)===1,ly=y-1.485;
    if(head){const jaw=Math.exp(-(((ly+.012)/.055)**2)),cheek=Math.exp(-(((ly-.061)/.045)**2)),front=clamp((z+.01)/.09),nose=Math.exp(-((x/.024)**2+((ly-.05)/.055)**2));
      x*=1+(id.jaw-1)*jaw*.6+(id.cheek-1)*cheek*.6;z+=(id.nose-1)*.055*nose*front;
      const maturity=clamp(((id.age??20)-28)/35),fold=Math.exp(-(((Math.abs(x)-(.023+(.045-ly)*.21))/.004)**2+((ly-.025)/.034)**2)),hollow=Math.exp(-(((Math.abs(x)-.061)/.023)**2+((ly-.047)/.032)**2));
      const forehead=(Math.exp(-(((ly-.132)/.0018)**2))+Math.exp(-(((ly-.147)/.0018)**2)))*Math.exp(-((x/.058)**6));
      z-=maturity*front*(fold*.0011+hollow*.0018+forehead*.00035);
      const lip=Math.exp(-((x/.031)**4+((ly-.008)/.010)**2))*front,stubble=(id.beard??0)*.13*Math.exp(-(((ly+.015)/.045)**2))*front;
      c.push(1-stubble*.4-lip*.02,.99-stubble*.4-lip*.06,.98-stubble*.4-lip*.04);
    }else {x+=(x<0?-1:1)*.006*((id.build??1)-1);c.push(1,.99,.98);}
    p.setXYZ(i,x,y,z);
  }
  fitActorNeck(master.geometry,geometry);
  // Packed glTF normals must be replaced before recomputation: accumulating
  // tiny facial triangle areas into normalized Int16 rounds them to zero.
  geometry.setAttribute('color',new T.Float32BufferAttribute(c,3));geometry.deleteAttribute('normal');geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={asset:'MakeHuman CC0',identity:id.key};
  // The bound female groom reaches the nape; the male short/receding cut keeps
  // its existing back and temple heights. The bound frontal hairline stays .148.
  const backHairline=id.female?.038:.073,templeRise=id.female?.016:.028;
  const hairline=(x,y,z)=>Math.min(y-(1.485+backHairline+clamp((z+.03)/.09)*((id.hair==='receding'?.165:id.hair==='bound'?.148:.133)-backHairline)+templeRise*clamp(Math.abs(x)/.085)**2+Math.sin(x*102)*(id.female?0:.0013)),.096-Math.abs(x));
  const importedHair=actorHairGeometry(id),hair=importedHair??groomActorHair(surfaceSubset(geometry,hairline,.0035,id),id,{quality,edgeDistance:hairline});
  const beardLine=(x,y,z)=>{const side=clamp(Math.abs(x)/.10),mouth=(Math.hypot(x/.041,(y-1.494)/.022)-1)*.022,cheeks=Math.min(z-.015,y-(1.445+.012*side),1.493+.036*side**.7-y,mouth),moustache=.009*(1-Math.hypot((Math.abs(x)-.016)/.026,(y-1.505)/.009));return Math.max(cheeks,Math.min(z-.04,moustache));};
  const beard=(id.beard??0)>.3?groomActorHair(surfaceSubset(geometry,beardLine,.0015+id.beard*.0014,id),id,{beard:true,quality,edgeDistance:beardLine}):null;
  // Hundreds of fitted lid/brow samples share a local XY triangle index. Keep
  // source order and the exact barycentric test; only skip impossible bounds.
  const a=geometry.attributes.position,tex=geometry.attributes.uv,indices=geometry.index.array,cells=new Map(),cell=.012;
  for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]];if(geometry.attributes.skinIndex.getX(ids[0])!==1)continue;const xs=ids.map(k=>a.getX(k)),ys=ids.map(k=>a.getY(k));
    for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++)for(let y=Math.floor(Math.min(...ys)/cell);y<=Math.floor(Math.max(...ys)/cell);y++){const key=x+','+y,bucket=cells.get(key)??[];bucket.push(i);cells.set(key,bucket);}
  }
  function facePoint(x,y,offset=0){let front=-Infinity,uv=null;const py=y+1.485;
    for(const i of cells.get(Math.floor(x/cell)+','+Math.floor(py/cell))??[]){const ia=indices[i],ib=indices[i+1],ic=indices[i+2];const ax=a.getX(ia),ay=a.getY(ia),bx=a.getX(ib),by=a.getY(ib),cx=a.getX(ic),cy=a.getY(ic),den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)continue;const u=((by-cy)*(x-cx)+(cx-bx)*(py-cy))/den,v=((cy-ay)*(x-cx)+(ax-cx)*(py-cy))/den,w=1-u-v;if(u>=0&&v>=0&&w>=0){const depth=u*a.getZ(ia)+v*a.getZ(ib)+w*a.getZ(ic);if(depth>front){front=depth;uv=[u*tex.getX(ia)+v*tex.getX(ib)+w*tex.getX(ic),u*tex.getY(ia)+v*tex.getY(ib)+w*tex.getY(ic)];}}}
    const point=[x,y,Number.isFinite(front)?front+offset:.065+offset];point.uv=uv;return point;
  }
  addActorExpressionMorphs(geometry);
  return {geometry,hair,beard,importedHair:!!importedHair,bones:master.bones,facePoint};
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

export function mountActorAnatomy(group,anatomy,{skin,hair,beardHair=hair,geometries,materials,skeletons}){
  const all=[];group.traverse(o=>{if(o.isBone)all.push(o);});
  const bones=anatomy.bones.map(name=>name==='right-elbow'?all.find(b=>b.name==='elbow'&&b.parent.name==='right-shoulder'):name==='left-elbow'?all.find(b=>b.name==='elbow'&&b.parent.name==='left-shoulder'):all.find(b=>b.name===name));
  if(bones.some(b=>!b))throw Error('Missing anatomy bind joint');
  group.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);skeletons.add(skeleton);const meshes=[];
  for(const [geometry,material,name]of [[anatomy.geometry,skin,'imported-anatomy'],[anatomy.hair,hair,'fitted-hair'],[anatomy.beard,beardHair,'fitted-beard']]){if(!geometry)continue;geometries.add(geometry);const mat=material.clone();mat.vertexColors=!!geometry.attributes.color;materials.add(mat);const mesh=new T.SkinnedMesh(geometry,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;group.add(mesh);mesh.bind(skeleton);mesh.boundingSphere=new T.Sphere(new T.Vector3(0,1.2,0),2);meshes.push(mesh);}
  return meshes;
}

