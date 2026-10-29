// Reproducibly reduce the existing, licensed generated legionary overview for
// background crowds, keep the joints its vertices follow, add the spear each
// man holds, and bake two of the game's own clips on its rig: a watchful stand
// and an arm raised in a cheer. No generation service, new artwork or download.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import {simplifyActorOverview} from '../src/showcase/actor-overview.js';
import {BODY_JOINTS} from '../src/showcase/actor-bodies.js';
import {createActor} from '../src/showcase/actors.js';
const path='assets/models/characters/roman-legionary.glb',bytes=await readFile(new URL('../'+path,import.meta.url));
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),mesh=gltf.scene.getObjectByName('body-overview'),original=mesh.geometry,source=original.index?original.toNonIndexed():original.clone();
for(const name of ['position','normal','color']){const a=source.attributes[name];source.setAttribute(name,new T.Float32BufferAttribute(Array.from({length:a.count*a.itemSize},(_,i)=>a.getComponent(Math.floor(i/a.itemSize),i%a.itemSize)),a.itemSize));}
// The body's own joint order, so a vertex's skin indices name BODY_JOINTS; the spear has a
// joint of its own after them.
const jointOf=mesh.skeleton.bones.map(b=>BODY_JOINTS.indexOf(b.name));if(jointOf.some(j=>j<0))throw Error('The legionary is not skinned to the game\'s joints');
const JOINTS=[...BODY_JOINTS,'spear'],SPEAR=JOINTS.indexOf('spear');
const skinIndex=source.attributes.skinIndex,skinWeight=source.attributes.skinWeight;

// The game's own rig, unscaled (the group's height scale would shear the transforms), and
// its bind: every joint unrotated, as the generated body was bound to it.
const actor=createActor({id:'line',name:'Roman line',side:'ally',role:'infantry'},{chapter:12});actor.group.scale.set(1,1,1);
const bones=[];actor.group.traverse(o=>{if(o.isBone)bones.push(o);});
function bone(name){
  if(!/^(right|left)-(elbow|hand|knee|ankle)$/.test(name))return bones.find(b=>b.name===name);
  const [side,joint]=name.split('-'),chain=joint==='elbow'?['elbow']:joint==='hand'?['elbow','hand']:joint==='knee'?['knee']:['knee','ankle'];
  let b=bones.find(x=>x.name===`${side}-${['elbow','hand'].includes(joint)?'shoulder':'thigh'}`);for(const step of chain)b=b?.children.find(c=>c.isBone&&c.name===step);return b;
}
const joints=BODY_JOINTS.map(bone);if(joints.some(b=>!b))throw Error('Missing a rig joint');
// Where the right hand closes on a shaft: the game's own held javelin sits there (actors.js).
const hand=joints[BODY_JOINTS.indexOf('right-hand')],GRIP=new T.Vector3(0,-.052,.018);
const saved=bones.map(b=>b.quaternion.clone());for(const b of bones)b.quaternion.identity();actor.group.updateMatrixWorld(true);
const bindInverse=joints.map(b=>b.matrixWorld.clone().invert()),gripBind=GRIP.clone().applyMatrix4(hand.matrixWorld);bones.forEach((b,i)=>b.quaternion.copy(saved[i]));

// A reduced vertex follows the two strongest joints of the source vertex nearest it.
function skinOf(reduced){
  const p=reduced.attributes.position,q=source.attributes.position,joints=[],weights=[];
  for(let i=0;i<p.count;i++){
    let best=0,bestD=Infinity;for(let k=0;k<q.count;k++){const d=(q.getX(k)-p.getX(i))**2+(q.getY(k)-p.getY(i))**2+(q.getZ(k)-p.getZ(i))**2;if(d<bestD){bestD=d;best=k;}}
    const pairs=[0,1,2,3].map(c=>[jointOf[skinIndex.getComponent(best,c)],skinWeight.getComponent(best,c)]).sort((a,b)=>b[1]-a[1]).slice(0,2),sum=pairs[0][1]+pairs[1][1]||1;
    joints.push(pairs[0][0],pairs[1][0]);weights.push(+(pairs[0][1]/sum).toFixed(3),+(1-pairs[0][1]/sum).toFixed(3));
  }
  return {joints,weights};
}
// The spear each man holds upright through his right hand, its butt on the ground: a wooden
// shaft and an iron point, in vertex colours, on the spear's own joint.
const WOOD=[.33,.24,.15],IRON=[.36,.37,.38];
function spear(part,sides){
  const base=part.position.length/3,shaft=.016;
  const push=(x,y,z,nx,nz,c)=>{part.position.push(+(gripBind.x+x).toFixed(5),+y.toFixed(5),+(gripBind.z+z).toFixed(5));part.normal.push(+nx.toFixed(4),0,+nz.toFixed(4));part.color.push(...c);part.skinIndex.push(SPEAR,SPEAR);part.skinWeight.push(1,0);};
  for(const [y,r,c]of [[.04,shaft,WOOD],[2.2,shaft,WOOD],[2.2,shaft*2.2,IRON],[2.46,0,IRON]])for(let k=0;k<sides;k++){const a=k/sides*Math.PI*2;push(Math.cos(a)*r,y,Math.sin(a)*r,Math.cos(a),Math.sin(a),c);}
  for(const ring of [0,2])for(let k=0;k<sides;k++){const a=base+ring*sides+k,b=base+ring*sides+(k+1)%sides,c=a+sides,d=b+sides;part.index.push(a,c,b,b,c,d);}
  return 2*2*sides;
}
const data={},triangles={};
for(const [detail,cell,sides]of [['near',.075,6],['distant',.21,3]]){
  const scale=.05/cell,copy=source.clone().scale(scale,scale,scale),reduced=simplifyActorOverview(copy,{cell:.05});reduced.scale(1/scale,1/scale,1/scale);const part={};
  for(const name of ['position','normal','color']){const a=reduced.attributes[name];part[name]=Array.from({length:a.count*a.itemSize},(_,i)=>+a.getComponent(Math.floor(i/a.itemSize),i%a.itemSize).toFixed(5));}
  part.index=reduced.index?Array.from(reduced.index.array):Array.from({length:reduced.attributes.position.count},(_,i)=>i);
  const skin=skinOf(reduced);part.skinIndex=skin.joints;part.skinWeight=skin.weights;
  triangles[detail]=part.index.length/3+spear(part,sides);data[detail]=part;copy.dispose();reduced.dispose();
}

// Clips: each frame holds every joint's skinning transform (its posed world matrix times the
// inverse of its bind) as a quaternion and a translation. Baked on the game's own rig with its
// own motions, so the crowd moves as its men do. The spear's joint never turns: it carries the
// shaft through the hand's grip, its butt on the ground until the hand lifts it higher than
// at the watch.
const FRAMES=24,DURATION=4.8,q=new T.Quaternion(),t=new T.Vector3(),s=new T.Vector3(),m=new T.Matrix4(),grip=new T.Vector3();
function pose(input){actor.update({...input,resetPose:true});actor.group.updateMatrixWorld(true);return grip.copy(GRIP).applyMatrix4(hand.matrixWorld);}
const watchGrip=pose({motion:'camp-watch',phase:.5,time:0}).y;
function frame(input){
  const at=pose(input),out=[];
  joints.forEach((b,j)=>{m.multiplyMatrices(b.matrixWorld,bindInverse[j]).decompose(t,q,s);if(Math.abs(s.x-1)+Math.abs(s.y-1)+Math.abs(s.z-1)>1e-3)throw Error(`Joint ${BODY_JOINTS[j]} scales`);
    out.push(...q.toArray().map(v=>+v.toFixed(4)),...t.toArray().map(v=>+v.toFixed(4)));});
  out.push(0,0,0,1,+(at.x-gripBind.x).toFixed(4),+Math.max(0,at.y-watchGrip).toFixed(4),+(at.z-gripBind.z).toFixed(4));
  return out;
}
const clips={
  // Standing watch: the head turns slowly from one side to the other as he breathes.
  stand:Array.from({length:FRAMES},(_,f)=>frame({motion:'camp-watch',phase:.5+.45*Math.sin(f/FRAMES*Math.PI*2),time:f/FRAMES*DURATION})),
  // The same watch, then the spear raised and lowered in a cheer over the clip's last third,
  // its ends kept off the rally's still first and last poses so the loop joins the watch.
  cheer:Array.from({length:FRAMES},(_,f)=>f<16?frame({motion:'camp-watch',phase:.5+.3*Math.sin(f/16*Math.PI*2),time:f/FRAMES*DURATION}):frame({motion:'rally',phase:(f-15)/(FRAMES-15),time:f/FRAMES*DURATION}))
};
actor.dispose();
const hash=createHash('sha256').update(bytes).digest('hex');
const text=`// Generated by scripts/build-finale-crowd.mjs from ${path}.\n// Source SHA-256 ${hash}. Source rights: docs/asset-manifest.json.\nexport const FINALE_CROWD_SOURCE=${JSON.stringify({path,sha256:hash,triangles,method:'deterministic vertex clustering at 0.075 / 0.21 m, each vertex following the two strongest joints of its nearest source vertex; a code-built spear held upright at the right hand; the game\'s camp-watch and rally motions baked on its rig'})};\nexport const FINALE_CROWD_DATA=${JSON.stringify(data)};\nexport const FINALE_CROWD_CLIPS=${JSON.stringify({frames:FRAMES,duration:DURATION,joints:JOINTS.length,jointNames:JOINTS,grip:gripBind.toArray().map(v=>+v.toFixed(4)),clips:Object.keys(clips),data:Object.values(clips).flat(2)})};\n`;
const target=new URL('../src/showcase/finale-crowd-data.js',import.meta.url);
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==text)throw Error('Finale crowd geometry is stale');}else await writeFile(target,text);
console.log(JSON.stringify({triangles,bytes:Buffer.byteLength(text),source:path}));
