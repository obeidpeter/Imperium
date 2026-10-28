import * as T from '../../vendor/three/three.module.js';
import {createModelLoader} from './model-loader.js';
import {installCloudShadows} from './atmosphere.js';
import {actorBodyUrl} from '../ui/actor-body-catalog.js';
import {clipBodyAtNeck,sculptGeneratedHead,generatedIdentityMaterial,fitGeneratedNeck,FOLLOWER_IDENTITY,setFollowerHead,IDENTITY_HEAD_BODY} from './generated-identity.js';
import {castAgeing} from './actor-identity.js';

// The game's joints a generated body is skinned to, named as bind-character.py
// exports them; the rig itself repeats elbow, hand, knee and ankle on each side.
export const BODY_JOINTS=Object.freeze(['hips','torso','head','right-shoulder','right-elbow','right-hand','left-shoulder','left-elbow','left-hand','right-thigh','right-knee','right-ankle','left-thigh','left-knee','left-ankle']);
// Procedural surfaces a body replaces: everything on these joints, and the
// helmet and the felt cap worn under it, since the body wears its own. Hands,
// weapons, shields, bows, quivers, scabbards, cloaks, crests, decorations and
// standards hang from other joints and stay.
const BODY_SURFACES='hips|torso|tunic-hem(-fold|-edge)?|head|(right|left)-(brow|eyelid|thigh|shoulder)|facial-jaw|knee|ankle|elbow';
export const BODY_REPLACES=new RegExp(`^(${BODY_SURFACES}|(ridge|conical|segmented)-helmet|equipped-arming-cap)$`);
// A bare-headed body (the recruit's) keeps the figure's own helmet or cap, fitted to its head.
export const BARE_HEAD_REPLACES=new RegExp(`^(${BODY_SURFACES})$`);

// Embedded textures decode off the main thread, within the page's Content
// Security Policy (model-loader.js).
const loadBody=id=>createModelLoader().loadAsync(new URL(`../../${actorBodyUrl(id)}`,import.meta.url).href);

/** One immutable master per body. Its geometry and materials are shared by every
 * figure wearing it and never disposed by them. A body that fails to load is
 * absent, and its figures keep their procedural look. */
export function createActorBodyLibrary(load=loadBody){
  const masters=new Map(),pending=new Map(),failures=new Map();
  function adopt(id,gltf){
    const meshes={};gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes[o.name]=o;});
    const part=mesh=>{
      if(!mesh)return null;
      const bones=mesh.skeleton.bones.map(b=>b.name);
      if(!mesh.geometry.attributes.skinWeight||bones.some(name=>!BODY_JOINTS.includes(name)))throw Error(`Body ${id} is not skinned to the game's joints`);
      // The overview's baked colours serve untextured views (fallen bodies); the texture draws the figure.
      const material=mesh.material.clone();material.vertexColors=false;material.name=`generated body ${id}`;installCloudShadows(material);
      material.userData.generatedActorBody=true;
      return Object.freeze({geometry:mesh.geometry,material,bones:Object.freeze(bones)});
    };
    // Figures switch to the overview level at a distance, so both levels are required.
    if(!meshes.body||!meshes['body-overview'])throw Error(`Body ${id} needs skinned body and body-overview meshes`);
    const near=part(meshes.body),overview=part(meshes['body-overview']);
    if(overview.bones.join()!==near.bones.join())throw Error(`Body ${id} levels disagree on joints`);
    // A named man's own body brings his head: the shared head wrapped onto his (wrap-cast-head.py).
    const own=meshes['cast-head'],ownOverview=meshes['cast-head-overview'];
    if(!!own!==!!ownOverview)throw Error(`Body ${id} needs both head levels or neither`);
    const head=own?Object.freeze({near:part(own),overview:part(ownOverview)}):null;
    if(head&&[head.near,head.overview].some(level=>level.bones.join()!==near.bones.join()))throw Error(`Body ${id} head disagrees on joints`);
    // A senator's toga carries the band its bloc's trims are drawn on (bind-character.py --bloc-band).
    const band=meshes['bloc-band']?blocBand(meshes['bloc-band'],near.bones):null;
    return Object.freeze({id,near,overview,head,band});
  }
  return {
    warm(id){
      if(!id)return Promise.resolve(false);
      if(!pending.has(id))pending.set(id,(async()=>{try{masters.set(id,adopt(id,await load(id)));return true;}catch(error){failures.set(id,String(error?.message??error));return false;}})());
      return pending.get(id);
    },
    status(id){return {ready:masters.has(id),pending:pending.has(id)&&!masters.has(id)&&!failures.has(id),error:failures.get(id)??null};},
    body(id){return id?masters.get(id)??null:null;}
  };
}
const library=createActorBodyLibrary();
export const warmActorBody=id=>library.warm(id);
export const actorBody=id=>library.body(id);
export const actorBodyStatus=id=>library.status(id);

/** A body's bloc band as a grid of its vertices, rows along it and columns across, read back
 * from its texture coordinates (u across, v along), which bind-character.py sets. */
function blocBand(mesh,bones){
  const names=mesh.skeleton.bones.map(b=>b.name);
  if(names.join()!==bones.join()||!mesh.geometry.attributes.skinWeight)throw Error('The bloc band disagrees with its body on joints');
  const {uv}=mesh.geometry.attributes,steps=get=>[...new Set(Array.from({length:uv.count},(_,k)=>Math.round(get(k)*1000)))].length;
  const columns=steps(k=>uv.getX(k)),rows=steps(k=>uv.getY(k)),grid=new Int32Array(rows*columns).fill(-1);
  for(let k=0;k<uv.count;k++){const i=Math.round(uv.getX(k)*(columns-1)),j=Math.round(uv.getY(k)*(rows-1));if(grid[j*columns+i]<0)grid[j*columns+i]=k;}
  if(rows<2||columns<2||grid.includes(-1))throw Error('The bloc band is not a whole grid');
  return Object.freeze({geometry:mesh.geometry,rows,columns,grid});
}
// The code-built toga's trims lie this far outside its drape (actors.js); on a senator's band,
// which bind-character.py lifts off the toga itself, a trim lies on the band and a gilt line
// the difference above it.
const DRAPE_TRIM_OFFSET=.009;
/** One of a bloc's trims (bloc-style.js trimBands) as a skinned strip on a body's band:
 * across it from `from` to `to`, along the rows given (all of them by default). */
export function blocTrimGeometry(band,{from=0,to=1,rows=null,offset=DRAPE_TRIM_OFFSET}={}){
  const {position,normal,skinIndex,skinWeight}=band.geometry.attributes,{columns,grid}=band,n=16,lift=offset-DRAPE_TRIM_OFFSET;
  const [first,last]=rows??[0,band.rows-1],p=[],uv=[],joints=[],weights=[],indices=[],a=new T.Vector3(),b=new T.Vector3(),na=new T.Vector3(),nb=new T.Vector3();
  for(let j=first;j<=last;j++)for(let s=0;s<=n;s++){
    const u=from+(to-from)*s/n,q=Math.min(columns-1,Math.max(0,u*(columns-1))),i=Math.min(columns-2,Math.floor(q)),t=q-i,ka=grid[j*columns+i],kb=grid[j*columns+i+1];
    a.fromBufferAttribute(position,ka).lerp(b.fromBufferAttribute(position,kb),t);
    na.fromBufferAttribute(normal,ka).lerp(nb.fromBufferAttribute(normal,kb),t).normalize();
    p.push(a.x+na.x*lift,a.y+na.y*lift,a.z+na.z*lift);uv.push(s/n,(j-first)/Math.max(1,last-first));
    // The skin of the band's two vertices either side, blended, its four strongest joints kept.
    const mix=new Map();for(const [k,share]of [[ka,1-t],[kb,t]])for(let c=0;c<4;c++){const w=skinWeight.getComponent(k,c)*share;if(w>0)mix.set(skinIndex.getComponent(k,c),(mix.get(skinIndex.getComponent(k,c))??0)+w);}
    const top=[...mix].sort((x,y)=>y[1]-x[1]).slice(0,4),total=top.reduce((sum,[,w])=>sum+w,0)||1;
    for(let c=0;c<4;c++){joints.push(top[c]?.[0]??0);weights.push(top[c]?top[c][1]/total:0);}
    if(j>first&&s){const k=(j-first)*(n+1)+s;indices.push(k-n-2,k-1,k,k-n-2,k,k-n-1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setIndex(indices);g.computeVertexNormals();
  return g;
}

function bodyBone(bones,name){
  if(!/^(right|left)-(elbow|hand|knee|ankle)$/.test(name))return bones.find(b=>b.name===name);
  const [side,joint]=name.split('-'),chain=joint==='elbow'?['elbow']:joint==='hand'?['elbow','hand']:joint==='knee'?['knee']:['knee','ankle'];
  let bone=bones.find(b=>b.name===`${side}-${['elbow','hand'].includes(joint)?'shoulder':'thigh'}`);
  for(const step of chain)bone=bone?.children.find(c=>c.isBone&&c.name===step);
  return bone;
}

/** Skin a figure's body to its own bones, in the rig's bind pose. The figure owns
 * the skinned meshes and their skeleton; geometry and materials stay the master's. */
const headlessBodies=new WeakMap(),neutralHeads=new WeakMap();
// The donor's overview head with no one's features, shared by every named leader's followers.
function neutralHead(part,offsetY){
  if(!neutralHeads.has(part))neutralHeads.set(part,new Map());const cache=neutralHeads.get(part);
  if(!cache.has(offsetY)){const geometry=sculptGeneratedHead(clipBodyAtNeck(part.geometry,{above:true}),FOLLOWER_IDENTITY);geometry.translate(0,offsetY,0);geometry.userData.identityOffsetY=offsetY;cache.set(offsetY,geometry);}
  return cache.get(offsetY);
}
/** headBody: what the head comes from, a named man's own body (its head) or the donor; donor:
 * the donor body, whose plain head a named leader's followers wear. */
export function mountActorBody(group,body,{skeletons,identity=null,headBody=null,donor=headBody,geometries=null,materials=null,trims=[]}){
  const identityOffsetY=body?0:-.10;
  const all=[];group.traverse(o=>{if(o.isBone)all.push(o);});
  group.updateMatrixWorld(true);
  const bones=(body??headBody).near.bones.map(name=>bodyBone(all,name));
  if(bones.some(b=>!b))throw Error('Missing body joint');
  const skeleton=new T.Skeleton(bones);skeletons.add(skeleton);
  const skin=(part,name,overview)=>{
    const mesh=new T.SkinnedMesh(part.geometry,part.material);mesh.name=name;mesh.userData.overview=overview;mesh.userData.generatedBody=(body??headBody).id;
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;mesh.visible=!overview;group.add(mesh);
    // Both levels share one skin; the overview is exported with the same joint order.
    mesh.bind(skeleton);mesh.boundingSphere=new T.Sphere(new T.Vector3(0,1.2,0),2);return mesh;
  };
  let worn=body;
  if(body&&headBody&&identity){
    // Every generated neck but the donor's own is seated under the shared head's.
    if(!headlessBodies.has(body))headlessBodies.set(body,Object.fromEntries(['near','overview'].map(level=>{const geometry=clipBodyAtNeck(body[level].geometry);if(body.id!==IDENTITY_HEAD_BODY)fitGeneratedNeck(geometry);return [level,{...body[level],geometry}];})));
    worn=headlessBodies.get(body);
  }
  const result={near:worn?skin(worn.near,'generated-body',false):null,overview:worn?skin(worn.overview,'generated-body-overview',true):null,heads:[]};
  // A senator's bloc trims, on his body's band (blocTrimGeometry): the near level only, as the
  // stance marker's letter names his bloc at a distance.
  result.trims=trims.map(({geometry,material},i)=>skin({geometry,material},`bloc-trim-${i}`,false));
  // A named man's own head (cast) is already his shape and paint: it takes the morphs and his ageing only.
  const cast=!!headBody?.head,heads=cast?headBody.head:headBody;
  const headMaterial=headBody&&identity?generatedIdentityMaterial(heads.near.material,identity,{offsetY:identityOffsetY,follower:(donor??headBody).near.material,ageing:cast?castAgeing(identity):null}):null;if(headMaterial)materials?.add(headMaterial);
  // Civic garments retain their own torso but need the donor's full neck: its
  // seam and head/torso weights must match the head while the speaker turns.
  if(!body&&headBody&&identity)for(const level of ['near','overview']){
    let geometry=clipBodyAtNeck(headBody[level].geometry,{above:true,height:1.475});
    // Cut away the donor's shirt shoulders so the existing toga stays visible.
    for(const cut of [{height:1.50},{axis:0,height:-.125,above:true},{axis:0,height:.095},{axis:2,height:-.08,above:true},{axis:2,height:.10}]){const next=clipBodyAtNeck(geometry,cut);geometry.dispose();geometry=next;}
    geometry.translate(0,identityOffsetY,0);geometries?.add(geometry);const neck=skin({...headBody[level],geometry,material:headMaterial},`identity-neck-${level}`,level==='overview');
    result[level==='near'?'near':'overview']=neck;
  }
  if(headBody&&identity)for(const level of ['near','overview']){
    const geometry=sculptGeneratedHead(clipBodyAtNeck(heads[level].geometry,{above:true}),identity,{shape:!cast});geometry.translate(0,identityOffsetY,0);geometry.userData.identityOffsetY=identityOffsetY;geometries?.add(geometry);
    const head=skin({...heads[level],geometry,material:headMaterial},`identity-head-${level}`,level==='overview');head.userData.identityHead=identity.key;head.userData.ownHead=cast;result.heads.push(head);
    if(level==='overview'&&(donor??headBody))setFollowerHead(head,neutralHead((donor??headBody).overview,identityOffsetY));
  }
  return result;
}
