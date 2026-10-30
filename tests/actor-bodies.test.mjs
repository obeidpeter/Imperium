import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import * as G from '../src/core/game.js';
import {clone} from '../src/core/shared.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {actorKit} from '../src/showcase/actor-kit.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {ceremonyScene} from '../src/showcase/ceremony.js';
import {ACTOR_BODIES,actorBodyId,actorBodyUrl,chapterBodies,HORSE_BODIES,horseBodyId,SENATOR_BODIES} from '../src/ui/actor-body-catalog.js';
import {trimBands} from '../src/ui/bloc-style.js';
import {createActorBodyLibrary,BODY_JOINTS,BODY_REPLACES,blocTrimGeometry} from '../src/showcase/actor-bodies.js';
import {createActor,BLOC_TRIM} from '../src/showcase/actors.js';
import {helmetBowlGeometry} from '../src/showcase/actor-helmet.js';
import {stageUnit,squadUnit} from '../src/showcase/live-figures.js';
import {soldierPreviewUnit} from '../src/showcase/soldier-preview.js';
import {createCampWorld} from '../src/core/realtime/camp-world.js';
import {createEncounterWorld} from '../src/core/realtime/campaign-encounter.js';
import {createSkinnedCrowd} from '../src/showcase/formation.js';
import {followerHeadOf} from '../src/showcase/generated-identity.js';
import {chapterOfflineAssets} from '../src/ui/art.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';

const root=new URL('../',import.meta.url),file=path=>readFile(new URL(path,root));
const manifest=JSON.parse(await file('docs/asset-manifest.json'));
// The game's bind pose (actors.js): arms straight down, every joint unrotated.
const BIND={hips:[0,.91,0],torso:[0,.91,0],head:[0,1.485,0],'right-shoulder':[-.24,1.329,0],'right-elbow':[-.24,1.029,0],'right-hand':[-.24,.771,0],'left-shoulder':[.24,1.329,0],'left-elbow':[.24,1.029,0],'left-hand':[.24,.771,0],
  'right-thigh':[-.104,.91,0],'right-knee':[-.104,.48,0],'right-ankle':[-.104,.05,0],'left-thigh':[.104,.91,0],'left-knee':[.104,.48,0],'left-ankle':[.104,.05,0]};
// Node has no image decoder: geometry loads in full with placeholder textures.
async function parse(id){
  const bytes=await file(actorBodyUrl(id)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const library=createActorBodyLibrary(parse);
// A named legionary in the legionary's mail and the shared head. Since release 8 every man the cast
// names has a body of his own, so it is the soldier himself, in a Chapter III legionary's kit.
const legionary={id:'hero',name:'Aurelius Marcellus',side:'player',role:'infantry'};
const sided=bone=>/^(elbow|hand|knee|ankle)$/.test(bone.name)?`${/^left-/.test(bone.parent.name)||/^left-/.test(bone.parent.parent?.name)?'left':'right'}-${bone.name}`:bone.name;

test('every generated body and horse is worn or ridden in exactly the chapters that list it, from New Game through both ceremonies and both sides of Chapter II\'s decision, in turns and in real time', () => {
  const used=new Map(),seen=new Set(),add=(id,chapter)=>{if(id){if(!used.has(id))used.set(id,new Set());used.get(id).add(chapter);}};
  const collect=s=>{
    const e=G.getChapter(s).encounters[s.encounterIndex],key=`${s.chapter}:${e?.id??'end'}`;if(seen.has(key))return;seen.add(key);
    const look=(unit,state=s)=>{const kit=actorKit(unit,{chapter:state.chapter,rank:state.rank});add(actorBodyId(kit,actorIdentity(unit,kit).key),state.chapter);add(horseBodyId(kit),state.chapter);};
    // The real-time camp and field draw the soldier and his company in their own kit.
    const world=w=>{if(!w)return;for(const a of w.actors)look(stageUnit(a,{appearance:s.soldier.appearance}));for(const q of w.squads??[])look(squadUnit(w,q));};
    world(createCampWorld(clone(s)));
    // The kit panel shows him in what he wears, and in the mail he may put on in any chapter.
    const preview=soldierPreviewUnit(s.soldier);look(preview);look({...preview,equipment:[...preview.equipment,'hamata']});
    const t=clone(s);if(!e||!G.startEncounter(t).ok)return;
    for(const u of t.encounter.units)look(u,t);
    if(e.kind!=='contest')world(createEncounterWorld(t));
  };
  runCommandCampaign({onCheckpoint:collect});runProgressionCampaign({featureEdition:31,onCheckpoint:collect});
  // The other side of Chapter II's decision: Lucan leaves, and Sabinus stands in his place from then on.
  seen.clear();
  runProgressionCampaign({featureEdition:31,onCheckpoint:collect,beforeCamp:s=>{if(s.chapter===2&&!s.decisions[G.getChapter(s).decision.id])assert.ok(G.choose(s,'leave').ok);}});
  for(const kind of ['oath','accession']){const scene=ceremonyScene(kind,{rank:kind==='oath'?'Tiro':'Augustus'});for(const u of scene.encounter.units){const kit=actorKit(u,{chapter:scene.chapter,rank:scene.rank});add(actorBodyId(kit,actorIdentity(u,kit).key),scene.chapter);add(horseBodyId(kit),scene.chapter);}}
  for(const [id,body]of Object.entries({...ACTOR_BODIES,...HORSE_BODIES}))assert.deepEqual([...(used.get(id)??[])].sort((a,b)=>a-b),[...body.chapters],id);
  // The chamber's members wear the senators' togas; the protagonist and the named keep the procedural toga.
  assert.ok(SENATOR_BODIES.includes(actorBodyId({civic:true,faction:'Roman',role:'speaker',identity:7},'figure-7')));
  assert.equal(actorBodyId({civic:true,hero:true,faction:'Roman',role:'speaker'},'marcellus'),null);
  assert.equal(actorBodyId({civic:true,faction:'Roman',role:'speaker'},'crispus'),null);
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
    // Shipped compressed (scripts/assets/compress.mjs): KTX2 textures and meshopt geometry over quantized vertices.
    assert.deepEqual([...info.extensionsRequired].sort(),['EXT_meshopt_compression','KHR_mesh_quantization','KHR_texture_basisu'],id);
    // A named man's own body brings his head, with its own three maps; Aelia's head is her body's own.
    assert.ok(info.textures.length===(ACTOR_BODIES[id].cast&&!ACTOR_BODIES[id].woman?6:3)&&info.textures.every(t=>t.mimeType==='image/ktx2'),`${id} has KTX2 textures`);
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

test('a soldier in his own kit wears the body closest to it: the recruit\'s tunic, then mail by rank, the bowman\'s for an archer', () => {
  const hero=(equipment,chapter,rank)=>actorBodyId(actorKit({id:'hero',name:'Aurelius',side:'player',role:'infantry',trained:true,equipment,appearance:{hair:1,beard:2,tunic:2,cloak:3}},{chapter,rank}));
  const tunic=['tunic','subarmalis','galea','bracae','caligae','spatha','training_shield'],mail=['tunic','hamata','galea','bracae','caligae','spatha','scutum'];
  for(const chapter of [1,5,12])assert.equal(hero(tunic,chapter),'roman-recruit',`Unarmoured in chapter ${chapter}`);
  assert.equal(hero(mail,2,'Miles'),'roman-legionary');assert.equal(hero(mail,3,'Optio'),'roman-officer','An optio wears the officer\'s mail');
  assert.equal(hero(mail,5),'roman-officer');assert.equal(hero([...mail.filter(id=>id!=='hamata'),'squamata'],8),'roman-commander');
  assert.equal(actorBodyId(actorKit({id:'felix',veteranId:'felix',name:'Marcus Felix',side:'player',role:'infantry',equipment:['tunic','jerkin','arming_cap','bracae','caligae','quiver','bow']},{chapter:4})),'roman-archer');
  assert.equal(hero(['tunic','bracae','caligae','bow','quiver'],4),'roman-recruit','The protagonist with a bow is still himself');
});

test('the camp\'s people wear their role\'s body, and only escorts on the march carry a traveller\'s bundle', async () => {
  const person=(role,name,chapter=2)=>({id:role,name,side:'neutral',role,chapter});
  const body=unit=>actorBodyId(actorKit(unit,{chapter:unit.chapter??2}));
  assert.equal(body(person('clerk','The duty clerk')),'camp-clerk');assert.equal(body(person('quartermaster','Quartermaster Aper')),'camp-clerk');
  assert.equal(body(person('capsarius','Capsarius Didius')),'camp-capsarius');assert.equal(body(person('orderly','Orderly Mamertus',1)),'camp-capsarius');
  assert.equal(body(person('trader','Syra the sutler',1)),'camp-sutler');
  assert.equal(body(person('sentry','The gate sentry')),'civilian-escort','A role without a body of its own keeps the civilian dress');
  assert.equal(body({id:'escort-1',name:'Refugee family',side:'neutral',role:'escort'}),'civilian-escort');
  assert.equal(body({id:'rider',name:'Roman horse',side:'ally',role:'cavalry',chapter:7}),'roman-cavalry');
  const bundle=unit=>{const a=createActor(unit,{chapter:unit.chapter??2}),found=!!a.group.getObjectByName('travel-bundle');a.dispose();return found;};
  assert.equal(bundle(person('clerk','The duty clerk')),false,'The camp\'s staff are at work, not on the road');
  assert.equal(bundle({id:'escort-1',name:'Refugee family',side:'ally',role:'escort'}),true);
});

test('the chamber\'s members wear the senators\' togas, each bloc\'s trims drawn in its own shape on the band fitted across the toga', async () => {
  // Every member nobody names wears a senator's toga, and a full chamber shows all three men.
  const members=[];
  for(let i=0;i<12;i++)members.push({id:`member${i}`,name:`${['Veterans','Landholders','Civic'][i%3]} delegate ${Math.floor(i/3)+1}`,side:'neutral',role:'voter',bloc:['Veterans','Landholders','Civic'][i%3]});
  const worn=members.map(u=>{const kit=actorKit(u,{chapter:11});return actorBodyId(kit,actorIdentity(u,kit).key);});
  assert.ok(worn.every(id=>SENATOR_BODIES.includes(id)));assert.equal(new Set(worn).size,3,'All three senators sit in a full chamber');
  for(const id of SENATOR_BODIES){assert.equal(await library.warm(id),true);const band=library.body(id).band;assert.ok(band,`${id} carries its bloc band`);assert.equal(band.rows,7);assert.equal(band.columns,17);}
  for(const bloc of ['Veterans','Landholders','Civic','Chamber','Army']){
    const unit={id:'member1',name:'Landholders delegate 1',side:'neutral',role:'voter',bloc},a=createActor(unit,{chapter:11,bodyLibrary:library});
    assert.equal(await a.ready,true);const g=a.group;assert.ok(SENATOR_BODIES.includes(g.userData.actor.body));
    assert.equal(g.getObjectByName('draped-civic-robe'),undefined,'The senator wears his own toga, not the procedural one');
    const trims=[];g.traverse(o=>{if(/^bloc-trim-/.test(o.name))trims.push(o);});
    // One mesh for each of the trim's materials (its colour, and gilt) at each level.
    const bands=trimBands(bloc),materials=bands.some(band=>band.gilt)?2:1,near=trims.filter(t=>!t.userData.overview),far=trims.filter(t=>t.userData.overview);
    assert.equal(near.length,materials,`${bloc}: one near mesh for each material`);assert.equal(far.length,materials,`${bloc}: one overview mesh for each material`);
    const strips=bands.reduce((sum,band)=>sum+(band.rows?band.rows[1]-band.rows[0]+1:7)*17,0);
    assert.equal(near.reduce((sum,t)=>sum+t.geometry.attributes.position.count,0),strips,`${bloc}: every band of its trim`);
    assert.deepEqual(near.map(t=>t.material.color.getHex()).sort(),[...new Set(bands.map(band=>new T.Color(band.gilt?0xc9a64a:BLOC_TRIM[bloc]).getHex()))].sort(),`${bloc} trim colours`);
    const body=g.getObjectByName('generated-body');
    for(const trim of trims){
      assert.ok(trim.isSkinnedMesh&&trim.skeleton===body.skeleton,'The trims follow the senator\'s own skin');
      if(trim.userData.overview)continue;
      // On the toga's front, a few millimetres outside it.
      const p=trim.geometry.attributes.position,b=body.geometry.attributes.position,at=new T.Vector3(),onBody=new T.Vector3();
      for(let k=0;k<p.count;k+=5){at.fromBufferAttribute(p,k);let best=Infinity;for(let m=0;m<b.count;m++)best=Math.min(best,onBody.fromBufferAttribute(b,m).distanceToSquared(at));assert.ok(Math.sqrt(best)<.03,`${bloc} trim lies on the toga (${Math.sqrt(best).toFixed(3)} m)`);assert.ok(at.z>0,'On the front');}
    }
    // At a distance the overview's trims show the bloc, as the stance marker's letter does.
    a.update({detailDistance:40});assert.ok(near.every(t=>!t.visible)&&far.every(t=>t.visible));a.update({detailDistance:8});assert.ok(near.every(t=>t.visible)&&far.every(t=>!t.visible));
    a.dispose();
  }
  // A broken trim's lengths span only their rows of the band.
  const band=library.body(SENATOR_BODIES[0]).band,short=blocTrimGeometry(band,{from:.1,to:.2,rows:[2,3]});
  assert.equal(short.attributes.position.count,2*17);assert.equal(short.index.count,16*6);
  const w=short.attributes.skinWeight;for(let k=0;k<w.count;k++)assert.ok(Math.abs(w.getX(k)+w.getY(k)+w.getZ(k)+w.getW(k)-1)<1e-5);
});

test('persistent identities keep a fitted helmet over the shared head; anonymous bodies retain their baked headwear', async () => {
  const hero=equipment=>({id:'hero',name:'Aurelius',side:'player',role:'infantry',trained:true,equipment});
  const pieces=g=>{const found={};g.traverse(o=>{if(o.isBone&&/-helmet$|arming-cap$/.test(o.name))found[o.name]=o;});return found;};
  // Vertices the figure draws on a joint: its own procedural surfaces, not the body's.
  const drawn=(g,bone)=>{let n=0;g.traverse(o=>{if(!o.isSkinnedMesh||o.userData.overview||o.userData.generatedBody)return;const i=o.skeleton.bones.indexOf(bone),j=o.geometry.attributes.skinIndex;if(i>=0)for(let k=0;k<j.count;k++)if(j.getX(k)===i)n++;});return n;};
  const {headwear}=ACTOR_BODIES['roman-recruit'];
  for(const [item,joint]of [['galea','ridge-helmet'],['conical_helmet','conical-helmet'],['segmented_helmet','segmented-helmet'],['arming_cap','equipped-arming-cap']]){
    const a=createActor(hero(['tunic','bracae','caligae','spatha',item]),{chapter:2,bodyLibrary:library});
    assert.equal(await a.ready,true);assert.equal(a.group.userData.actor.body,'roman-recruit',item);
    const piece=pieces(a.group)[joint];assert.deepEqual(piece.position.toArray(),[...headwear.position],`${item} is moved to the body's head`);assert.deepEqual(piece.scale.toArray(),[...headwear.scale]);
    assert.ok(drawn(a.group,piece)>50,`${item} is drawn`);a.dispose();
  }
  // Every head vertex above the rim lies inside the fitted bowl (actor-helmet.js), at both levels of detail.
  const bowl=helmetBowlGeometry({detail:false}),bp=bowl.attributes.position,rings=new Map();
  for(let i=0;i<bp.count;i++){const key=bp.getY(i).toFixed(6),ring=rings.get(key)??{y:bp.getY(i),x:0,z0:Infinity,z1:-Infinity};ring.x=Math.max(ring.x,Math.abs(bp.getX(i)));ring.z0=Math.min(ring.z0,bp.getZ(i));ring.z1=Math.max(ring.z1,bp.getZ(i));rings.set(key,ring);}
  const levels=[...rings.values()].sort((a,b)=>a.y-b.y),inverse=new T.Matrix4().compose(new T.Vector3(...headwear.position),new T.Quaternion(),new T.Vector3(...headwear.scale)).invert();
  const inside=p=>{const k=levels.findIndex(r=>r.y>=p.y);if(k<1)return false;const a=levels[k-1],b=levels[k],t=(p.y-a.y)/(b.y-a.y),mix=key=>a[key]+(b[key]-a[key])*t,x=mix('x'),z0=mix('z0'),z1=mix('z1');return (p.x/x)**2+((p.z-(z0+z1)/2)/((z1-z0)/2))**2<=1;};
  await library.warm('roman-recruit');const master=library.body('roman-recruit');
  for(const level of ['near','overview']){
    const {geometry,bones}=master[level],head=bones.indexOf('head'),p=geometry.attributes.position,j=geometry.attributes.skinIndex,w=geometry.attributes.skinWeight,v=new T.Vector3();let above=0;
    for(let i=0;i<p.count;i++){let weight=0;for(let k=0;k<4;k++)if(j.getComponent(i,k)===head)weight+=w.getComponent(i,k);if(weight<.5)continue;
      v.fromBufferAttribute(p,i).sub(new T.Vector3(...BIND.head)).applyMatrix4(inverse);if(v.y<=levels[0].y)continue;above++;
      assert.ok(inside(v),`${level}: head vertex ${i} shows through the helmet`);}
    assert.ok(above>90,`${level}: the bowl covers the crown (${above} vertices)`);
  }
  bowl.dispose();
  // The protagonist and named cast retain their fitted, equipped headwear at
  // every rank; anonymous bodies still bring their baked head and helmet.
  for(const [unit,id,joint]of [[hero(['tunic','hamata','galea','bracae','caligae','spatha','scutum']),'roman-legionary','ridge-helmet'],
    // Felix wears his own body in every kit, the game's cap fitted over the shared head as on the recruit's.
    [{id:'felix',veteranId:'felix',name:'Marcus Felix',side:'player',role:'infantry',equipment:['tunic','jerkin','arming_cap','bracae','caligae','quiver','bow']},'cast-felix','equipped-arming-cap']]){
    const a=createActor(unit,{chapter:2,bodyLibrary:library});assert.equal(await a.ready,true);assert.equal(a.group.userData.actor.body,id);
    const piece=pieces(a.group)[joint];assert.ok(piece&&drawn(a.group,piece)>50,`${id} keeps the equipped ${joint} over the persistent head`);
    // A named man's own body brings the shared head wrapped onto his own (wrap-cast-head.py).
    assert.equal(a.group.userData.actor.headSource,id.startsWith('cast-')?id:'roman-recruit');a.dispose();
  }
});

test('the actual generated hero head and texture survive rank changes, and expressions move those visible vertices',async()=>{
  const snapshots=[];
  for(const [chapter,rank,role='infantry']of [[1,'Tiro'],[3,'Miles'],[5,'Centurio'],[8,'Praepositus'],[11,'Senator','speaker']]){
    const unit=Object.freeze({id:'hero',name:'Marcellus',side:'player',role}),a=createActor(unit,{chapter,rank,bodyLibrary:library});await a.ready;
    const near=a.group.getObjectByName('identity-head-near'),far=a.group.getObjectByName('identity-head-overview');assert.ok(near?.isSkinnedMesh&&far?.isSkinnedMesh);
    if(role==='speaker'){
      const neck=a.group.getObjectByName('identity-neck-near');assert.ok(neck?.isSkinnedMesh,'The civic neck uses the same donor skin and joint weights');
      const p=neck.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(p.getX(i)>=-.12501&&p.getX(i)<=.09501,'Donor shirt shoulders never cover the toga');
      const key=(p,i)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(5)).join(','),seam=new Map();
      for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-1.4)<1e-5)seam.set(key(p,i),i);
      const h=near.geometry.attributes.position,pairs=[];for(let i=0;i<h.count;i++)if(Math.abs(h.getY(i)-1.4)<1e-5&&seam.has(key(h,i)))pairs.push([i,seam.get(key(h,i))]);
      assert.ok(pairs.length>12,'The neck and face share a continuous seam');
      for(const phase of [.2,.7]){a.update({motion:'speak',phase,time:2,resetPose:true});for(const [hi,ni]of pairs){const hp=new T.Vector3().fromBufferAttribute(h,hi),np=new T.Vector3().fromBufferAttribute(p,ni);near.applyBoneTransform(hi,hp);neck.applyBoneTransform(ni,np);assert.ok(hp.distanceTo(np)<.0001,'Speech keeps the joined neck closed');}}
    }
    assert.equal(near.material.map,library.body('roman-recruit').near.material.map,'The generated head keeps its original PBR albedo');
    snapshots.push(Array.from(near.geometry.attributes.position.array,(n,i)=>n-(i%3===1?near.geometry.userData.identityOffsetY:0)));
    const jaw=near.geometry.morphAttributes.position[0];assert.ok(Array.from(jaw.array).some(n=>Math.abs(n)>.001));
    a.update({motion:'speak',phase:.4,time:2,resetPose:true});assert.ok(near.morphTargetInfluences[0]>0);assert.equal(near.morphTargetInfluences[0],far.morphTargetInfluences[0]);
    a.update({motion:'idle',time:0,reducedMotion:true,resetPose:true});assert.deepEqual(near.morphTargetInfluences,[0,0,0,0]);
    a.update({detailDistance:40});assert.ok(!near.visible&&far.visible);a.dispose();
  }
  for(const shape of snapshots.slice(1)){assert.equal(shape.length,snapshots[0].length);for(let i=0;i<shape.length;i++)assert.ok(Math.abs(shape[i]-snapshots[0][i])<1e-6,'Promotions preserve the same skull to Float32 translation precision');}
});

test('named generated heads have bounded distinct sculpting, normalized seam weights and owned resources',async()=>{
  const signatures=[];
  for(const name of ['Varro','Lucan','Sabinus']){
    const a=createActor({id:name.toLowerCase(),name,role:name==='Varro'?'trainer':'infantry',side:'ally'},{chapter:3,bodyLibrary:library});await a.ready;
    const head=a.group.getObjectByName('identity-head-near'),p=head.geometry.attributes.position,w=head.geometry.attributes.skinWeight;signatures.push(Array.from(p.array));
    for(let i=0;i<p.count;i++){assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));assert.ok(p.getY(i)>=1.499,'Identity sculpt preserves the neck cut');assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<.002);}
    let disposed=0;head.geometry.addEventListener('dispose',()=>disposed++);head.material.addEventListener('dispose',()=>disposed++);a.dispose();assert.equal(disposed,2,'Identity resources are owned and released exactly once');
  }
  assert.notDeepEqual(signatures[0],signatures[1]);assert.notDeepEqual(signatures[1],signatures[2]);
});

test('a named man\'s own head compiles as the hero\'s, and every generated body part is drawn from its front',async()=>{
  // The head wrap exports a named man's head two-sided: drawn so, it compiled a program and a shadow program of its own.
  for(const id of Object.keys(ACTOR_BODIES)){assert.ok(await library.warm(id),id);const b=library.body(id);
    for(const part of [b.near,b.overview,b.head?.near,b.head?.overview].filter(Boolean))assert.equal(part.material.side,T.FrontSide,`${id} is drawn from its front`);}
  const hero=createActor({id:'hero',name:'Marcellus',side:'player',role:'infantry'},{chapter:3,bodyLibrary:library}),lucan=createActor({id:'lucan',name:'Lucan',side:'ally',role:'infantry'},{chapter:3,bodyLibrary:library});
  await Promise.all([hero.ready,lucan.ready]);
  const flags=m=>({side:m.side,shadowSide:m.shadowSide,key:m.customProgramCacheKey(),maps:['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap'].filter(k=>m[k]),vertexColors:m.vertexColors,transparent:m.transparent,alphaTest:m.alphaTest});
  for(const level of ['near','overview']){
    const own=lucan.group.getObjectByName(`identity-head-${level}`),shared=hero.group.getObjectByName(`identity-head-${level}`);
    assert.equal(own.userData.ownHead,true,'Lucan wears his own head');assert.equal(shared.userData.ownHead,false,'The hero wears the shared head');
    assert.deepEqual(flags(own.material),flags(shared.material),`Lucan's ${level} head compiles as the hero's`);
    assert.equal(!!own.geometry.morphAttributes.position,!!shared.geometry.morphAttributes.position);assert.equal(own.geometry.morphAttributes.position.length,shared.geometry.morphAttributes.position.length);
  }
  hero.dispose();lucan.dispose();
});

test('generated trainer and officer necklines stay beneath the neckcloth through head turns',async()=>{
  for(const [unit,options]of [[{id:'varro',name:'Varro',role:'trainer',side:'ally'},{chapter:1}],[{id:'hero',name:'Marcellus',role:'infantry',side:'player'},{chapter:5,rank:'Centurio'}]]){
    const actor=createActor(unit,{...options,bodyLibrary:library});await actor.ready;
    const body=actor.group.getObjectByName('generated-body'),torso=actor.group.getObjectByName('torso'),p=body.geometry.attributes.position;
    const band=[];for(let i=0;i<p.count;i++)if(p.getY(i)>=1.461&&p.getY(i)<=1.495&&Math.abs(p.getX(i))<.18&&Math.abs(p.getZ(i))<.18)band.push(i);
    assert.ok(band.length>100,'The regression samples the actual generated neckline');
    for(const gazeYaw of [0,-.4,.4]){
      actor.update({motion:'idle',time:0,phase:0,gazeYaw,resetPose:true});actor.group.updateMatrixWorld(true);const inverse=torso.matrixWorld.clone().invert();
      for(const i of band){const point=new T.Vector3().fromBufferAttribute(p,i);body.applyBoneTransform(i,point);point.applyMatrix4(body.matrixWorld).applyMatrix4(inverse);
        // Conservative interior of the fitted cloth, including its folds.
        assert.ok(Math.hypot((point.x+.018)/.100,(point.z-.008)/.080)<=1.001,`${unit.id}: the generated neckline must not pierce the visible cloth at gaze ${gazeYaw}`);
      }
    }actor.dispose();
  }
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
  let finish;const late=createActorBodyLibrary(id=>id==='roman-recruit'?parse(id):new Promise(done=>{finish=done;})),gone=createActor(legionary,{chapter:3,bodyLibrary:late}),scene=new T.Group();
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
  assert.ok(rigid,'Rigid kit marches with the followers');assert.ok(rigid.material.userData.crowdBones>BODY_JOINTS.length);
  const fallen=a.bakeFallen(),colours=fallen.attributes.color,tones=new Set();for(let i=0;i<colours.count;i+=53)tones.add(colours.getX(i).toFixed(2));
  assert.ok(tones.size>5,'The baked fallen body keeps the overview\'s colours');
  crowd.dispose();fallen.dispose();a.dispose();
});

test('followers never wear their leader\'s face: body and head followers share one shader with neutral uniforms', async()=>{
  const actor=createActor(legionary,{chapter:5,bodyLibrary:library});await actor.ready;
  const bodySource=actor.group.getObjectByName('generated-body-overview'),headSource=actor.group.getObjectByName('identity-head-overview'),crowd=createSkinnedCrowd(actor.group,{max:3});
  assert.equal(headSource.material.userData.generatedIdentity,'marcellus','The leader is the soldier');
  assert.ok(crowd.meshes.every(m=>m.material.userData.generatedIdentity!=='marcellus'),'No follower wears the soldier\'s face');
  const body=crowd.meshes.find(m=>m.geometry.attributes.position===bodySource.geometry.attributes.position),neutralHead=followerHeadOf(headSource);
  const head=crowd.meshes.find(m=>m.geometry.attributes.position===neutralHead?.attributes.position);
  assert.ok(body&&head,'Followers wear the body and the donor\'s neutral head');assert.equal(neutralHead.userData.identity,'crowd-neutral');
  const named=headSource.geometry.attributes.position,plain=neutralHead.attributes.position;let moved=0;for(let i=0;i<plain.count;i++)if(Math.abs(plain.getZ(i)-named.getZ(i))>1e-4)moved++;
  assert.ok(moved>0,'The soldier\'s sculpted features stay on the leader');
  for(const m of [body,head])assert.equal(m.material.userData.generatedIdentity,'crowd-neutral');
  assert.equal(body.material.map,bodySource.material.map);assert.equal(head.material.map,headSource.material.map,'The head keeps the donor\'s painted maps');
  assert.equal(body.castShadow,true);assert.equal(head.castShadow,true);
  assert.equal(body.material.customProgramCacheKey(),head.material.customProgramCacheKey(),'Equal PBR variants share one follower program');
  const compile=material=>{const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);return shader;};
  const bodyShader=compile(body.material),headShader=compile(head.material);
  assert.equal(bodyShader.vertexShader,headShader.vertexShader);assert.equal(bodyShader.fragmentShader,headShader.fragmentShader);
  for(const shader of [bodyShader,headShader]){assert.equal(shader.uniforms.identityGrey.value,0);assert.equal(shader.uniforms.identityBeard.value,0);assert.equal(shader.uniforms.identityGroom.value.w,0,'No groom of anyone\'s');}
  assert.equal(headShader.uniforms.identityVerticalOffset.value,neutralHead.userData.identityOffsetY);
  assert.deepEqual(bodyShader.uniforms.actorFinishTint.value.toArray(),[1,1,1]);assert.deepEqual(bodyShader.uniforms.actorFinishRoughness.value.toArray(),[1,0,1]);assert.equal(bodyShader.uniforms.actorFinishGrazing.value,0);
  assert.notEqual(bodyShader.uniforms.identityBeard,headShader.uniforms.identityBeard,'Each follower material has its own uniforms');
  crowd.dispose();actor.dispose();
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

test('the camp\'s named civilians wear no soldier\'s neckcloth, and Aelia wears her own head', async () => {
  const camp=(id,name,role,chapter)=>createActor({id,name,role,side:'neutral'},{chapter,bodyLibrary:library});
  for(const [id,name,role,chapter,civilian]of [['quintus','Signifer Quintus','standard-bearer',4,false],['severianus','Marcus Aurelius Severianus','tribune',6,true],['paullus','Lucius Cassius Paullus','senator',11,true],['theon','Rhetor Theon','rhetor',10,true]]){
    const a=camp(id,name,role,chapter);assert.equal(await a.ready,true);
    assert.equal(a.group.userData.actor.body,`cast-${id}`);assert.equal(a.group.userData.actor.headSource,`cast-${id}`,`${name} wears his own wrapped head`);
    assert.equal(!!a.group.getObjectByName('identity-neck-wrap'),!civilian,civilian?`${name} wears civilian dress, without the neckcloth`:`${name}, a soldier, wears the neckcloth`);
    a.dispose();
  }
  const aelia=camp('aelia','Aelia Dacia','settler',8);assert.equal(await aelia.ready,true);
  assert.equal(aelia.group.userData.actor.body,'cast-aelia');assert.equal(aelia.group.userData.actor.persistentIdentity,false,'no shared head');
  assert.equal(aelia.group.getObjectByName('identity-head-near'),undefined);assert.equal(aelia.group.getObjectByName('identity-neck-wrap'),undefined);
  // Her own head is her body's: the body reaches the crown, which a body cut at the neck does not.
  const body=aelia.group.getObjectByName('generated-body');body.geometry.computeBoundingBox();
  assert.ok(body.geometry.boundingBox.max.y>1.65,`Aelia's body brings her head (${body.geometry.boundingBox.max.y.toFixed(3)} m)`);
  aelia.dispose();
});
