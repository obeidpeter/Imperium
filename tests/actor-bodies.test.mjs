import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import * as G from '../src/core/game.js';
import {clone} from '../src/core/shared.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {actorKit} from '../src/showcase/actor-kit.js';
import {ceremonyScene} from '../src/showcase/ceremony.js';
import {ACTOR_BODIES,actorBodyId,actorBodyUrl,chapterBodies} from '../src/ui/actor-body-catalog.js';
import {createActorBodyLibrary,BODY_JOINTS,BODY_REPLACES} from '../src/showcase/actor-bodies.js';
import {createActor} from '../src/showcase/actors.js';
import {createSkinnedCrowd} from '../src/showcase/formation.js';
import {chapterOfflineAssets} from '../src/ui/art.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';

const root=new URL('../',import.meta.url),file=path=>readFile(new URL(path,root));
const manifest=JSON.parse(await file('docs/asset-manifest.json'));
// The game's bind pose (actors.js): arms straight down, every joint unrotated.
const BIND={hips:[0,.91,0],torso:[0,.91,0],head:[0,1.485,0],'right-shoulder':[-.24,1.329,0],'right-elbow':[-.24,1.029,0],'right-hand':[-.24,.771,0],'left-shoulder':[.24,1.329,0],'left-elbow':[.24,1.029,0],'left-hand':[.24,.771,0],
  'right-thigh':[-.104,.91,0],'right-knee':[-.104,.48,0],'right-ankle':[-.104,.05,0],'left-thigh':[.104,.91,0],'left-knee':[.104,.48,0],'left-ankle':[.104,.05,0]};
// Node has no image decoder: geometry loads in full with placeholder textures.
async function parse(id){
  const bytes=await file(actorBodyUrl(id)),loader=new GLTFLoader();
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const library=createActorBodyLibrary(parse);
const legionary={id:'veteran-naso',veteranId:'naso',name:'Naso',side:'ally',role:'infantry'};
const sided=bone=>/^(elbow|hand|knee|ankle)$/.test(bone.name)?`${/^left-/.test(bone.parent.name)||/^left-/.test(bone.parent.parent?.name)?'left':'right'}-${bone.name}`:bone.name;

test('every generated body is worn in exactly the chapters that list it, from New Game through both ceremonies', () => {
  const used=new Map(),seen=new Set(),add=(id,chapter)=>{if(id){if(!used.has(id))used.set(id,new Set());used.get(id).add(chapter);}};
  const collect=s=>{const e=G.getChapter(s).encounters[s.encounterIndex];if(!e||seen.has(`${s.chapter}:${e.id}`))return;const t=clone(s);if(!G.startEncounter(t).ok)return;seen.add(`${s.chapter}:${e.id}`);for(const u of t.encounter.units)add(actorBodyId(actorKit(u,{chapter:t.chapter,rank:t.rank})),t.chapter);};
  runCommandCampaign({onCheckpoint:collect});runProgressionCampaign({featureEdition:31,onCheckpoint:collect});
  for(const kind of ['oath','accession']){const scene=ceremonyScene(kind,{rank:kind==='oath'?'Tiro':'Augustus'});for(const u of scene.encounter.units)add(actorBodyId(actorKit(u,{chapter:scene.chapter,rank:scene.rank})),scene.chapter);}
  for(const [id,body]of Object.entries(ACTOR_BODIES))assert.deepEqual([...(used.get(id)??[])].sort((a,b)=>a-b),[...body.chapters],id);
  assert.equal(actorBodyId({civic:true,faction:'Roman',role:'speaker'}),null,'Civic figures keep the togas whose trims name their bloc');
});

test('every body has its Tripo task, rig, licence, manifest entry and budget, and is bound in the game bind pose', async () => {
  const shipped=(await readdir(new URL('assets/models/characters/',root))).filter(f=>f.endsWith('.glb')).map(f=>f.slice(0,-4)).sort();
  assert.deepEqual(shipped,Object.keys(ACTOR_BODIES).sort(),'One file per catalogued body');
  for(const id of shipped){
    const request=JSON.parse(await file(`art-source/models/requests/char-${id}.json`)),entry=manifest.assets.find(a=>a.path===actorBodyUrl(id)),p=request.provenance;
    assert.ok(p.taskId&&p.rawSha256&&p.rig?.taskId&&p.rig?.rawSha256,`${id} records its Tripo generation and rig`);
    assert.match(p.licence,/full rights to use, modify, distribute and commercially exploit/);
    assert.ok(entry,`${id} has provenance in the asset manifest`);assert.equal(entry.source.taskId,p.taskId);assert.equal(entry.source.rigTaskId,p.rig.taskId);
    const bytes=await file(actorBodyUrl(id)),info=await inspectModel(bytes),b=request.budget;
    assert.equal(info.bytes,entry.export.bytes);assert.equal(info.triangles,entry.export.triangles);
    assert.deepEqual(budgetProblems(info,{bytes:b.bytes,triangles:b.triangles+b.overviewTriangles,texture:b.texture,minHeight:b.minHeight,maxHeight:b.maxHeight}),[],id);
    assert.deepEqual(info.extensionsRequired.filter(n=>!['EXT_texture_webp','KHR_mesh_quantization'].includes(n)),[]);
    // Soles on the game's sole plane, seven centimetres under the ankle joints.
    assert.ok(Math.abs(info.base-(-.02))<.006,`${id} stands on the game's sole plane (${info.base})`);
    const gltf=await parse(id),near=gltf.scene.getObjectByName('body'),overview=gltf.scene.getObjectByName('body-overview');
    assert.ok(near?.isSkinnedMesh&&overview?.isSkinnedMesh);assert.deepEqual(overview.skeleton.bones.map(b=>b.name),near.skeleton.bones.map(b=>b.name));
    assert.deepEqual([...near.skeleton.bones.map(b=>b.name)].sort(),[...BODY_JOINTS].sort());
    near.skeleton.boneInverses.forEach((inverse,i)=>{const at=new T.Vector3(),turn=new T.Quaternion(),size=new T.Vector3();inverse.clone().invert().decompose(at,turn,size);
      assert.ok(at.distanceTo(new T.Vector3(...BIND[near.skeleton.bones[i].name]))<1e-4,`${id}: ${near.skeleton.bones[i].name} sits at the game's joint`);assert.ok(Math.abs(turn.w)>1-1e-6,'Joints are unrotated in the bind pose');});
    const w=near.geometry.attributes.skinWeight;for(let i=0;i<w.count;i+=97)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<.01);
  }
});

test('a figure wears its body once it loads: procedural body surfaces go, the kit stays, and one skin follows its own joints', async () => {
  const a=createActor(legionary,{chapter:3,bodyLibrary:library});
  assert.equal(await a.ready,true);const g=a.group;assert.equal(g.userData.actor.body,'roman-legionary');
  const near=g.getObjectByName('generated-body'),far=g.getObjectByName('generated-body-overview');
  assert.ok(near.isSkinnedMesh&&far.isSkinnedMesh);assert.equal(near.skeleton,far.skeleton);
  assert.deepEqual(near.skeleton.bones.map(sided),library.body('roman-legionary').near.bones,'Each body joint is the figure\'s own bone');
  for(const bone of near.skeleton.bones){let p=bone;while(p&&p!==g)p=p.parent;assert.equal(p,g);}
  let costume=0,replaced=0;g.traverse(o=>{if(/connected-(mail|scale|tunic)/.test(o.name)||o.name==='imported-anatomy')costume++;if(o.isMesh&&o.parent?.isBone&&BODY_REPLACES.test(o.parent.name))replaced++;});
  assert.equal(costume,0,'No procedural costume or anatomy');assert.equal(replaced,0,'No procedural surface on the body joints');
  for(const kit of ['sword','oval-shield','scabbard','command-cloak'])assert.ok(g.getObjectByName(kit),`${kit} stays`);
  a.update({detailDistance:8});assert.ok(near.visible&&!far.visible);a.update({detailDistance:40});assert.ok(!near.visible&&far.visible);
  a.dispose();
});

test('the body follows the game clips: forearm vertices stay on the forearm through a strike', async () => {
  const a=createActor(legionary,{chapter:3,bodyLibrary:library});await a.ready;
  const g=a.group,body=g.getObjectByName('generated-body'),bones=body.skeleton.bones,index=bones.findIndex(b=>sided(b)==='right-elbow');
  const elbow=bones[index],hand=bones.find(b=>sided(b)==='right-hand'),w=body.geometry.attributes.skinWeight,j=body.geometry.attributes.skinIndex,pick=[];
  for(let i=0;i<w.count&&pick.length<40;i++)if(j.getX(i)===index&&w.getX(i)>.97)pick.push(i);
  assert.ok(pick.length>=20,'The body has vertices held by the right forearm');
  for(const phase of [0,.37,.7]){
    a.update({motion:'attack',phase,direction:.6,aimHeight:1.2,resetPose:true});
    const from=elbow.getWorldPosition(new T.Vector3()),to=hand.getWorldPosition(new T.Vector3()),segment=new T.Line3(from,to),point=new T.Vector3(),near=new T.Vector3();
    for(const i of pick){point.fromBufferAttribute(body.geometry.attributes.position,i);body.applyBoneTransform(i,point);point.applyMatrix4(body.matrixWorld);segment.closestPointToPoint(point,true,near);
      assert.ok(point.distanceTo(near)<.12,`Forearm vertex ${i} stays on the forearm at phase ${phase}`);}
  }
  a.dispose();
});

test('a body that fails to load, or arrives after disposal, leaves no trace; disposal never frees the shared body', async () => {
  const failing=createActorBodyLibrary(async()=>{throw Error('offline');}),fallback=createActor(legionary,{chapter:3,bodyLibrary:failing});
  assert.equal(await fallback.ready,false);assert.equal(fallback.group.userData.actor.body,null);assert.ok(fallback.group.getObjectByName('near-connected-mail'),'The procedural figure stays');
  assert.match(failing.status('roman-legionary').error,/offline/);fallback.dispose();
  let finish;const late=createActorBodyLibrary(()=>new Promise(done=>{finish=done;})),gone=createActor(legionary,{chapter:3,bodyLibrary:late}),scene=new T.Group();
  scene.add(gone.group);gone.dispose();finish(await parse('roman-legionary'));assert.equal(await gone.ready,false);
  assert.equal(scene.children.length,0,'A disposed figure is not put back');assert.equal(gone.group.userData.actor.body,null,'nor rebuilt in the late body');
  await library.warm('roman-legionary');const master=library.body('roman-legionary');let freed=0;master.near.geometry.addEventListener('dispose',()=>freed++);master.near.material.addEventListener('dispose',()=>freed++);
  const a=createActor(legionary,{chapter:3,bodyLibrary:library});await a.ready;a.dispose();a.dispose();assert.equal(freed,0,'Other figures still wear the master');
});

test('followers march in the generated overview and fallen bodies keep its colours', async () => {
  const a=createActor({...legionary,id:'line',name:'Roman line'},{chapter:5,bodyLibrary:library});await a.ready;a.update({detailDistance:40});
  const crowd=createSkinnedCrowd(a.group,{max:4}),overview=a.group.getObjectByName('generated-body-overview');
  assert.ok(crowd.meshes.some(m=>m.geometry.attributes.position===overview.geometry.attributes.position),'Followers share the body\'s overview buffers');
  // Rigid kit (weapons, boots) rides the skeleton holding every joint, not the body's own fifteen.
  const rigid=crowd.meshes.find(m=>m.material.vertexColors&&!m.material.map&&m.geometry.attributes.skinIndex.getY(0)===0&&m.geometry.attributes.skinWeight.getX(0)===1);
  assert.ok(rigid,'Rigid kit marches with the followers');assert.ok(rigid.material.defines.CROWD_BONES>BODY_JOINTS.length);
  const fallen=a.bakeFallen(),colours=fallen.attributes.color,tones=new Set();for(let i=0;i<colours.count;i+=53)tones.add(colours.getX(i).toFixed(2));
  assert.ok(tones.size>5,'The baked fallen body keeps the overview\'s colours');
  crowd.dispose();fallen.dispose();a.dispose();
});

test('followers carry only the kit their leader shows: an archer\'s hidden sword stays hidden', async () => {
  const archer=createActor({id:'sagittarii',name:'Roman archers',side:'ally',role:'archer'},{chapter:5,bodyLibrary:library});await archer.ready;archer.update({detailDistance:40});
  let all=0,shown=0,skinned=0;
  archer.group.traverse(o=>{if(!o.isMesh||!o.userData.overview)return;if(o.isSkinnedMesh){skinned++;return;}const n=o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count;all+=n;let hidden=false;for(let p=o.parent;p&&p!==archer.group;p=p.parent)if(!p.visible)hidden=true;if(!hidden)shown+=n;});
  assert.ok(shown<all,'The archer leader hides kit (the sword)');
  // One follower mesh per skinned overview surface, plus one for the visible rigid kit, if any.
  const crowd=createSkinnedCrowd(archer.group,{max:2});
  assert.equal(crowd.meshes.length,skinned+(shown?1:0));
  if(shown)assert.equal(crowd.meshes.at(-1).geometry.attributes.position.count,shown,'Followers bake exactly the visible rigid kit');
  crowd.dispose();archer.dispose();
});

test('each chapter downloads the bodies its figures wear, and no others', () => {
  const files=['./assets/models/roman-human-v017.glb',...Object.keys(ACTOR_BODIES).map(id=>'./'+actorBodyUrl(id))];
  for(let chapter=1;chapter<=12;chapter++){
    const group=chapterOfflineAssets(chapter,files);
    for(const id of Object.keys(ACTOR_BODIES))assert.equal(group.includes('./'+actorBodyUrl(id)),chapterBodies(chapter).includes(id),`${id} in chapter ${chapter}`);
  }
});
