// CPU-only, injected presentation specimens. This samples the production rig,
// not a campaign or a player playthrough. Strain is |log(posed/rest edge length)|;
// seams shorter than 2 mm are excluded from this surface-distortion statistic.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../../vendor/three/addons/libs/meshopt_decoder.module.js';
import {createActorBodyLibrary} from '../../src/showcase/actor-bodies.js';
import {createActor} from '../../src/showcase/actors.js';
import {ACTOR_TIMING} from '../../src/showcase/actor-pose.js';
import {digest} from './refine-character.mjs';

export const REFINEMENT_POSES=Object.freeze([['idle',0],['speak',.33],['rally',.38],['block',.09],['walk',.25],['walk',.75]]);
export function refinementSpecimen(id){
  const cast=id.startsWith('cast-'),name=id.slice(5),chapter=id==='cast-aelia'?8:id==='roman-commander'?7:id==='roman-officer'?5:id==='roman-recruit'?1:3;
  return {unit:cast?{id:name,name:name[0].toUpperCase()+name.slice(1),side:'ally',role:['aelia','severianus','paullus','theon'].includes(name)?'escort':'infantry'}:{id:'hero',name:'Marcellus',side:'player',role:'infantry'},options:{chapter}};
}
export async function parseCharacter(bytes){
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const inRegion=(v,region)=>region==='shoulder'?v.y>1.115&&v.y<1.435&&Math.abs(v.x)>.125&&Math.abs(v.x)<.325:v.y>.125&&v.y<.88&&Math.abs(v.x)<.16;
export function surfaceStrain(mesh,region){
  const p=mesh.geometry.attributes.position,index=mesh.geometry.index,rest=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i)),posed=rest.map((v,i)=>mesh.applyBoneTransform(i,v.clone())),edges=new Set(),errors=[];
  for(let i=0;i<index.count;i+=3)for(let k=0;k<3;k++){
    const a=index.getX(i+k),b=index.getX(i+(k+1)%3),key=a<b?`${a}:${b}`:`${b}:${a}`;
    if(edges.has(key)||!inRegion(rest[a],region)||!inRegion(rest[b],region))continue;edges.add(key);
    const length=rest[a].distanceTo(rest[b]);if(length<.002)continue;
    errors.push(Math.abs(Math.log(Math.max(.00001,posed[a].distanceTo(posed[b]))/length)));
  }
  errors.sort((a,b)=>a-b);assert.ok(errors.length>100,'A meaningful surface sample is required');
  return {edges:errors.length,mean:errors.reduce((a,b)=>a+b,0)/errors.length,p95:errors[Math.floor(errors.length*.95)],p99:errors[Math.floor(errors.length*.99)],max:errors.at(-1)};
}
export async function characterPoseMetrics(bytes,id){
  const parsed=[],library=createActorBodyLibrary(async key=>{const gltf=await parseCharacter(key===id?bytes:await readFile(new URL(`../../assets/models/characters/${key}.glb`,import.meta.url)));parsed.push(gltf);return gltf;}),{unit,options}=refinementSpecimen(id),actor=createActor(unit,{...options,bodyLibrary:library});
  assert.equal(await actor.ready,true);assert.equal(actor.group.userData.actor.body,id);
  const mesh=actor.group.getObjectByName('generated-body'),poses={},contacts=[];
  for(const [motion,phase]of [...REFINEMENT_POSES,['attack',ACTOR_TIMING.contact],['throw',ACTOR_TIMING.release]]){
    actor.update({motion,phase,time:0,reducedMotion:true,resetPose:true});actor.group.updateMatrixWorld(true);
    const contact=actor.contacts;contacts.push({motion,phase,weapon:contact.weapon?.getWorldPosition(new T.Vector3()).toArray()??null,shield:contact.shield?.getWorldPosition(new T.Vector3()).toArray()??null,feet:contact.feet.map(f=>f.getWorldPosition(new T.Vector3()).toArray()),release:actor.getReleasePoint().toArray()});
    if(REFINEMENT_POSES.some(([m,p])=>m===motion&&p===phase))poses[`${motion}:${phase}`]={shoulder:surfaceStrain(mesh,'shoulder'),...(id==='cast-aelia'?{robe:surfaceStrain(mesh,'robe')}:{})};
  }
  actor.dispose();
  // The library is local to this offline specimen. Release all its masters,
  // then the imported materials/textures, once the actor has released its own.
  const disposed=new Set(),free=x=>{if(x&&!disposed.has(x)){disposed.add(x);x.dispose?.();}};
  for(const gltf of parsed)gltf.scene.traverse(o=>{if(o.isMesh){free(o.geometry);for(const m of [o.material].flat()){for(const value of Object.values(m))if(value?.isTexture)free(value);free(m);}}});
  for(const key of [id,'roman-recruit']){const body=library.body(key);for(const p of [body?.near,body?.overview,body?.head?.near,body?.head?.overview])if(p){free(p.geometry);free(p.material);}}
  return {poses,contactSha256:digest(contacts)};
}
export async function compareCharacterPoses(before,after,id){
  const baseline=await characterPoseMetrics(before,id),refined=await characterPoseMetrics(after,id);
  assert.equal(baseline.contactSha256,refined.contactSha256,'Authored weapon, shield, release and sole anchors must not move');
  const summary={};for(const region of id==='cast-aelia'?['shoulder','robe']:['shoulder']){
    summary[region]={};for(const stat of ['mean','p95']){
      const average=value=>Object.values(value.poses).reduce((sum,p)=>sum+p[region][stat],0)/REFINEMENT_POSES.length;
      summary[region][stat]={before:average(baseline),after:average(refined),improvement:1-average(refined)/average(baseline)};
    }
  }
  return {id,method:'Production-rig injected poses; edge strain is absolute log length ratio, excluding edges shorter than 2 mm. No gameplay mutations.',baseline,refined,summary};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [before,after,id,report]=process.argv.slice(2),result=await compareCharacterPoses(await readFile(before),await readFile(after),id);
  if(report)await writeFile(report,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({id,summary:result.summary}));
}
