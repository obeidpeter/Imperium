import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import {HORSE_BODIES,horseBodyId,horseBodyUrl,chapterHorses} from '../src/ui/actor-body-catalog.js';
import {createHorseBodyLibrary,HORSE_JOINTS,HORSE_REPLACES} from '../src/showcase/horse-bodies.js';
import {CODE_HORSE_FRAME,HORSE_LEGS} from '../src/showcase/horse-frame.js';
import {horsePose,groundHorsePose,horseGaitForSpeed} from '../src/showcase/actor-pose.js';
import {sampleHorseGait,HORSE_GAITS} from '../src/showcase/actor-gait.js';
import {createActor} from '../src/showcase/actors.js';
import {createSkinnedCrowd} from '../src/showcase/formation.js';
import {chapterOfflineAssets} from '../src/ui/art.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';

const root=new URL('../',import.meta.url),file=path=>readFile(new URL(path,root));
const manifest=JSON.parse(await file('docs/asset-manifest.json'));
// Node has no image decoder: geometry loads in full with placeholder textures.
async function parse(id){
  const bytes=await file(horseBodyUrl(id)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const library=createHorseBodyLibrary(parse);
const romanRider={id:'rider',name:'Roman horse',side:'ally',role:'cavalry'};
const round=v=>+v.toFixed(6);

test('the code-built horse poses exactly as it always has', () => {
  const legs=p=>p.legs.map(l=>[round(l.upper),round(l.knee),round(l.splay)]);
  // Recorded from the pose before horses had frames of their own (0.40 release 5).
  const expected=[
    ['walk',.9,1,.977831,[[-0.031023,0.820895,0],[-0.661971,0.245873,0],[0.444055,-1.086826,0],[0.932454,-1.375805,0]]],
    ['run',.6,1,1.052038,[[0.180896,0.35505,0],[-0.165029,0.706299,0],[0.117401,-0.949691,0],[-0.25685,-0.245873,0]]],
    ['run',1.3,.5,1.029663,[[-0.529822,1.184324,0],[-0.483873,0.896547,0],[0.412674,-0.896547,0],[0.654502,-1.184324,0]]],
    ['idle',0,1,1.04,[[-0.426601,0.853202,0],[-0.426601,0.853202,0],[0.426601,-0.853202,0],[0.426601,-0.853202,0]]]];
  for(const [motion,distance,weight,bodyY,want]of expected){
    const p=horsePose({motion,locomotionDistance:distance,locomotionWeight:weight,time:.4});
    assert.equal(round(p.bodyY),bodyY,motion);assert.deepEqual(legs(p),want,`${motion} ${distance}`);assert.ok(p.legs.every(l=>l.y===p.bodyY),'Its legs hang from the body');
  }
  const ground=groundHorsePose(horsePose({motion:'run',locomotionDistance:.6}),Array.from({length:4},(_,j)=>({height:j<2?.12:-.06,pitch:.08,bank:.05})));
  assert.equal(round(ground.bodyY),.992038);assert.equal(round(ground.bodyPitch),-.048945);
  assert.deepEqual(legs(ground),[[-0.165837,1.19263,0],[-0.459355,1.377233,0],[0.117401,-0.949691,0],[-0.25685,-0.245873,0]]);
  assert.equal(groundHorsePose(horsePose(),[],CODE_HORSE_FRAME).legs.length,4);
});

test('a horse\'s gait follows its speed, and holds near a change', () => {
  assert.equal(horseGaitForSpeed(undefined),null,'No speed: the pose keeps its own choice');
  assert.deepEqual([0,2,2.7,3.9,4.1,5.5,5.7,9].map(v=>horseGaitForSpeed(v)),['trot','trot','trot','trot','canter','canter','gallop','gallop'],'A running horse trots at least');
  assert.equal(horseGaitForSpeed(3.8,{current:'canter'}),'canter');assert.equal(horseGaitForSpeed(3.6,{current:'canter'}),'trot');
  assert.equal(horseGaitForSpeed(5.4,{current:'gallop'}),'gallop');assert.equal(horseGaitForSpeed(5.8,{current:'canter'}),'canter');assert.equal(horseGaitForSpeed(6,{current:'canter'}),'gallop');
  for(const [speed,gait]of [[3,'trot'],[4.6,'canter'],[6.2,'gallop']])assert.equal(horsePose({motion:'run',locomotionDistance:1,speed}).gait,gait);
  assert.equal(horsePose({motion:'walk',locomotionDistance:1,speed:6}).gait,'walk','A walking horse walks');
  assert.equal(horsePose({motion:'run',locomotionDistance:1,locomotionWeight:.5}).gait,'trot','Without a speed, a run blends from a trot');
});

test('a gallop lands hind feet first, then fore, and leaves the ground once a stride', () => {
  const lands=HORSE_GAITS.gallop.offsets.map(offset=>((1-offset)%1+1)%1);
  assert.deepEqual([3,2,1,0].map(i=>lands[i]).map(v=>+v.toFixed(2)),[0,.1,.3,.4],'Left hind, right hind, left fore, right fore');
  let airborne=0;for(let i=0;i<100;i++)if(sampleHorseGait({gait:'gallop',cycle:i/100}).feet.every(f=>f.y>.075))airborne++;
  assert.ok(airborne>=20&&airborne<=40,`In the air ${airborne}% of the stride`);
});

test('every generated horse has its Tripo task, licence, manifest entry and budget, and its rest pose on the game skeleton', async () => {
  const shipped=(await readdir(new URL('assets/models/horses/',root))).filter(f=>f.endsWith('.glb')).map(f=>f.slice(0,-4)).sort();
  assert.deepEqual(shipped,Object.keys(HORSE_BODIES).sort(),'One file per catalogued horse');
  for(const id of shipped){
    const request=JSON.parse(await file(`art-source/models/requests/${id}.json`)),entry=manifest.assets.find(a=>a.path===horseBodyUrl(id)),p=request.provenance;
    assert.ok(p.taskId&&p.rawSha256,`${id} records its Tripo generation`);assert.match(p.licence,/full rights to use, modify, distribute and commercially exploit/);
    assert.ok(entry,`${id} has provenance in the asset manifest`);assert.equal(entry.source.taskId,p.taskId);assert.deepEqual(request.chapters,[...HORSE_BODIES[id].chapters]);
    const bytes=await file(horseBodyUrl(id)),info=await inspectModel(bytes),b=request.budget;
    assert.equal(info.bytes,entry.export.bytes);assert.equal(info.triangles,entry.export.triangles);
    assert.deepEqual(budgetProblems(info,{bytes:b.bytes,triangles:b.triangles+b.overviewTriangles,texture:b.texture,minHeight:b.minHeight,maxHeight:b.maxHeight}),[],id);
    assert.deepEqual([...info.extensionsRequired].sort(),['EXT_meshopt_compression','KHR_mesh_quantization','KHR_texture_basisu'],id);
    assert.ok(info.textures.length===3&&info.textures.every(t=>t.mimeType==='image/ktx2'),`${id} has KTX2 textures`);
    const gltf=await parse(id),near=gltf.scene.getObjectByName('horse-coat'),overview=gltf.scene.getObjectByName('horse-coat-overview');
    assert.ok(near?.isSkinnedMesh&&overview?.isSkinnedMesh);assert.deepEqual(overview.skeleton.bones.map(b=>b.name),near.skeleton.bones.map(b=>b.name));
    assert.deepEqual([...near.skeleton.bones.map(b=>b.name)].sort(),[...HORSE_JOINTS].sort());
    near.skeleton.boneInverses.forEach(inverse=>{const at=new T.Vector3(),turn=new T.Quaternion(),size=new T.Vector3();inverse.clone().invert().decompose(at,turn,size);assert.ok(Math.abs(turn.w)>1-1e-6,'Joints are unrotated at rest');});
    for(const leg of HORSE_LEGS){const sole=gltf.scene.getObjectByName(`${leg}-sole`);assert.ok(sole,`${id} marks where its ${leg} hoof stands`);assert.ok(Math.abs(sole.position.y)<1e-4);}
    const w=near.geometry.attributes.skinWeight;for(let i=0;i<w.count;i+=97)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<.01);
  }
});

test('a generated horse stands as it was made, its legs turning from their own rest pose', async () => {
  assert.equal(await library.warm('horse-roman'),true);
  const {frame}=library.body('horse-roman');
  assert.ok(frame.generated&&frame.motion,'Its own gaits');assert.ok(frame.spacing>1.2&&frame.spacing<1.5,`Legs ${frame.spacing} m apart`);
  for(const leg of frame.legs){
    assert.ok(leg.a>.4&&leg.b>.25,`${leg.name}: two real bones`);assert.ok(leg.reach<leg.a+leg.b&&leg.support<leg.reach);
    if(leg.fore)assert.ok(leg.knee0>=0,'A carpus rests on the side it folds to');else assert.ok(leg.knee0<-.3,'A hock rests bent back');
  }
  // At a stand every leg is as modelled; the knee of a near-straight fore leg may give a hair.
  const idle=horsePose({motion:'idle',frame});
  for(const [i,leg]of idle.legs.entries()){assert.ok(Math.abs(leg.upper)<.03&&Math.abs(leg.knee)<.06&&Math.abs(leg.splay)<.01,`${HORSE_LEGS[i]} stands as made: ${leg.upper.toFixed(3)} ${leg.knee.toFixed(3)}`);assert.ok(Math.abs(idle.feet[i].z-frame.legs[i].rest[1])<1e-9,'On its own hoof');}
  // In a stride it stands its stance back toward where a horse's leg pushes.
  const stride=sampleHorseGait({gait:'walk',cycle:.3,stride:1.5,frame});assert.ok(stride.feet.some((f,i)=>f.z!==frame.legs[i].rest[1]));
});

test('a figure rides its side\'s generated horse: the code-built horse goes but its saddle, and one skin follows the horse\'s joints', async () => {
  assert.equal(horseBodyId({mounted:true,faction:'Roman'}),'horse-roman');assert.equal(horseBodyId({mounted:false,faction:'Roman'}),null);
  assert.equal(horseBodyId({mounted:true,faction:'Gothic'}),'horse-northern');
  for(const faction of ['Persian','Palmyrene'])assert.equal(horseBodyId({mounted:true,faction}),'horse-eastern',`${faction} riders ride the armoured horse`);
  assert.equal(horseBodyId({mounted:true,faction:'Civilian'}),null);
  const a=createActor(romanRider,{chapter:7,horseLibrary:library});
  assert.equal(await a.ready,true);const g=a.group;assert.equal(g.userData.actor.horse,'horse-roman');
  const near=g.getObjectByName('generated-horse'),far=g.getObjectByName('generated-horse-overview');
  assert.ok(near.isSkinnedMesh&&far.isSkinnedMesh);assert.equal(near.skeleton,far.skeleton);
  const horse=g.getObjectByName('horse');for(const bone of near.skeleton.bones){let p=bone;while(p&&p!==horse)p=p.parent;assert.equal(p,horse,`${bone.name} is the figure's own horse bone`);}
  let replaced=0;horse.traverse(o=>{if(o.isMesh&&o.parent?.isBone&&HORSE_REPLACES.test(o.parent.name))replaced++;});assert.equal(replaced,0,'No code-built horse surface left');
  assert.ok(g.getObjectByName('saddle'),'The saddle stays');
  a.update({detailDistance:8});assert.ok(near.visible&&!far.visible);a.update({detailDistance:40});assert.ok(!near.visible&&far.visible);
  // Planted hooves stand on the ground as it walks, trots, canters and gallops.
  const frame=library.body('horse-roman').frame;assert.ok(Math.abs(a.contacts.footClearance-frame.clearance*g.scale.y)<1e-9);
  for(const [motion,speed]of [['walk',2.16],['run',3.3],['run',4.6],['run',6.2]]){
    let d=0;const ground=()=>0;a.update({motion:'idle',resetPose:true,groundHeight:ground,detailDistance:8});
    for(let f=0;f<90;f++){d+=speed/30;a.update({motion,locomotionDistance:d,locomotionWeight:1,time:f/30,dt:1/30,groundHeight:ground,detailDistance:8});
      g.updateMatrixWorld(true);
      for(const foot of a.contacts.feet){const y=foot.getWorldPosition(new T.Vector3()).y;assert.ok(y>a.contacts.footClearance-.02,`${motion} ${speed}: no hoof sinks (${y.toFixed(3)})`);}}
  }
  a.dispose();
});

test('a generated horse\'s followers ride it too, and a fallen one lies on the field', async () => {
  const a=createActor(romanRider,{chapter:7,horseLibrary:library});await a.ready;a.update({motion:'idle',resetPose:true});
  const crowd=createSkinnedCrowd(a.group,{max:4}),coat=library.body('horse-roman').overview.geometry.attributes.position.count;
  assert.ok(crowd.meshes.some(m=>m.geometry.attributes.position.count===coat),'The ranks wear the horse\'s overview coat');
  const fallen=a.bakeFallen();assert.ok(fallen?.attributes.position.count>coat,'The fallen horse and rider are baked from their overview surfaces');
  a.dispose();
});

test('each chapter\'s download carries the horses its riders ride, and no other', async () => {
  const models=(await readdir(new URL('assets/models/',root),{recursive:true})).filter(f=>f.endsWith('.glb')).map(f=>'./assets/models/'+f.replaceAll('\\','/'));
  for(let chapter=1;chapter<=12;chapter++){const paths=chapterOfflineAssets(chapter,models);for(const id of Object.keys(HORSE_BODIES))assert.equal(paths.includes('./'+horseBodyUrl(id)),chapterHorses(chapter).includes(id),`Chapter ${chapter}: ${id}`);}
});
