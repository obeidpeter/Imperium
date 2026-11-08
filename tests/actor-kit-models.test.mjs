import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import {ITEMS} from '../src/data/items.js';
import {KIT_MODELS,KIT_WEAPON_MODELS,KIT_HEADWEAR_MODELS,kitModelUrl} from '../src/showcase/actor-kit-catalog.js';
import {chapterOfflineAssets} from '../src/ui/art.js';
import {createActorKitLibrary,wearKitModel} from '../src/showcase/actor-kit-models.js';
import {createActor,actorKitModelIds} from '../src/showcase/actors.js';
import {actorKit} from '../src/showcase/actor-kit.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';

const root=new URL('../',import.meta.url),file=path=>readFile(new URL(path,root));
const manifest=JSON.parse(await file('docs/asset-manifest.json'));
// Node has no image decoder: geometry loads in full with placeholder textures.
async function parse(id){
  const bytes=await file(kitModelUrl(id)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const library=createActorKitLibrary(parse);
// The player's soldier in the kit he chose (the inventory's items, src/data/items.js).
const soldier=(...equipment)=>({id:'hero',name:'Aurelius Marcellus',side:'player',role:'infantry',equipment:['tunic','caligae',...equipment]});
const ids=(unit,options={chapter:3})=>actorKitModelIds(actorKit(unit,options),options);
const nearKit=(group,id)=>{const found=[];group.traverse(o=>{if(o.isMesh&&!o.userData.overview&&o.material.name===`generated kit ${id}`)found.push(o);});return found;};
// A skinned or rigid surface's vertices where the posed figure holds them.
function worldPoints(mesh){
  mesh.updateMatrixWorld(true);const points=[],p=new T.Vector3();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){if(mesh.isSkinnedMesh)mesh.getVertexPosition(i,p);else p.fromBufferAttribute(mesh.geometry.attributes.position,i);points.push(p.clone().applyMatrix4(mesh.matrixWorld));}
  return points;
}

test('every piece of generated kit is a processed inventory model with its Tripo task, manifest entry, report and budget', async () => {
  const shipped=(await readdir(new URL('assets/models/kit/',root))).filter(f=>f.endsWith('.glb')).map(f=>f.slice(0,-4)).sort();
  assert.deepEqual(shipped,Object.keys(KIT_MODELS).sort(),'One file per catalogued piece');
  for(const id of shipped){
    const {source,kind}=KIT_MODELS[id],request=JSON.parse(await file(`art-source/models/requests/${source}.json`)),p=request.provenance;
    assert.ok(p.taskId&&p.rawSha256,`${id} comes from ${source}'s recorded Tripo generation`);
    assert.match(p.licence,/full rights to use, modify, distribute and commercially exploit/);
    const report=JSON.parse(await file(`art-source/models/reports/${id}.json`)),entry=manifest.assets.find(a=>a.path===kitModelUrl(id));
    assert.equal(report.input.sha256,p.rawSha256,`${id} was processed from the item's own raw download`);
    assert.equal(report.settings.kind,kind);
    assert.ok(entry,`${id} has provenance in the asset manifest`);
    assert.equal(entry.source.taskId,p.taskId);assert.equal(entry.source.rawSha256,p.rawSha256);assert.equal(entry.source.credits,0,'Made from a model already paid for');
    const bytes=await file(kitModelUrl(id)),info=await inspectModel(bytes);
    assert.equal(entry.export.bytes,bytes.length);assert.equal(entry.export.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(entry.export.triangles,info.triangles);
    // The near level and the overview level, each within its budget (a collapse stops near it).
    assert.equal(info.triangles,report.output.triangles+report.output.overviewTriangles,`${id} ships the processed triangles`);
    assert.ok(report.output.triangles<=report.settings.triangles*1.05&&report.output.overviewTriangles<=report.settings.overviewTriangles*1.05,`${id} within its triangle budgets`);
    assert.deepEqual(budgetProblems(info,{texture:Math.max(report.settings.texture,report.settings.detailTexture),materials:2}),[],id);
    assert.deepEqual([...info.extensionsRequired].sort(),['EXT_meshopt_compression','KHR_texture_basisu'],id);
    assert.ok(info.textures.length>=1&&info.textures.every(t=>t.mimeType==='image/ktx2'),`${id} has KTX2 textures`);
  }
});

test('each piece loads as a textured near level and an overview coloured in its vertices, laid out about the grip or the helmet\'s foot', async () => {
  for(const [id,{kind}]of Object.entries(KIT_MODELS)){
    assert.equal(await library.warm(id),true,id);
    const master=library.model(id),box=master.near.geometry.boundingBox,centre=box.getCenter(new T.Vector3());
    assert.ok(Object.isFrozen(master)&&Object.isFrozen(master.near),'The master is never changed');
    assert.ok(master.near.material.map,'The near level keeps its colour map');assert.equal(master.near.material.vertexColors,false);
    assert.ok(master.overview.geometry.attributes.color,'The overview level draws its colours without the map');
    if(kind==='helmet'){
      assert.ok(Math.abs(box.min.y)<.005,`${id} stands on its foot`);assert.ok(Math.abs(centre.x)<.01&&Math.abs(centre.z)<.01,`${id} is centred`);
    }else{
      // The hand holds the grip, the model's origin: blade or haft above it, the pommel's end below.
      assert.ok(box.min.y<0&&box.max.y>.25,`${id} rises from the grip`);assert.ok(box.min.y>-.2*box.max.y,`${id}'s grip is near its end`);
      assert.ok(Math.abs(box.min.x+box.max.x)<.6*(box.max.x-box.min.x),`${id} is laid along its length`);
    }
  }
  assert.equal(library.model(null),null);assert.equal(await library.warm(null),false);
  assert.deepEqual(library.status('kit-spatha'),{ready:true,pending:false,error:null});
});

test('the kit a figure wears: the items chosen for it, swords and axes, helmets and the felt cap; never on Performance', () => {
  assert.deepEqual(ids(soldier('hamata','galea','spatha','scutum')),['kit-spatha','kit-galea']);
  assert.deepEqual(ids(soldier('jerkin','niederbieber','gladius')),['kit-gladius','kit-niederbieber']);
  assert.deepEqual(ids(soldier('subarmalis','arming_cap','knife')),['kit-pugio','kit-arming-cap']);
  assert.deepEqual(ids(soldier('hamata','galea_crest','spatha_fine')),['kit-spatha','kit-galea'],'Finer grades wear the same models');
  assert.deepEqual(ids(soldier('jerkin','galea')),['kit-galea'],'A helmet without a weapon');
  // Spears, bows, slings, the conical helmet (the spangenhelm hides the face) and the Gothic cap helmet
  // stay code-built, as do shields, which carry each unit's design.
  assert.deepEqual(ids(soldier('hamata','conical_helmet','axe')),['kit-axe']);
  for(const kit of [['hasta','segmented_helmet'],['bow','quiver'],['sling'],['spear','round_shield']])assert.deepEqual(ids(soldier(...kit)),[],kit.join());
  // The rank and file and the enemy, drawn without a list of items, keep the code-built pieces.
  assert.deepEqual(ids({id:'veteran-naso',veteranId:'naso',name:'Naso',side:'ally',role:'infantry'}),[],'A legionary without a kit list');
  assert.deepEqual(ids({id:'gothic-spearman',name:'Gothic spearman',side:'enemy',role:'infantry'},{chapter:2}),[]);
  assert.deepEqual(ids({id:'persian-guard',name:'Persian guard',side:'enemy',role:'guard'},{chapter:5}),[]);
  assert.deepEqual(ids({id:'varro',name:'Varro',side:'ally',role:'trainer',equipment:['tunic','gladius']}),[],'A trainer\'s practice sword stays code-built');
  assert.deepEqual(actorKitModelIds(actorKit(soldier('galea','spatha'),{chapter:3}),{quality:'performance'}),[],'Performance keeps the code-built pieces');
  // Every inventory weapon and helmet that has a model names one that ships.
  for(const item of Object.values(ITEMS)){const {weapon,helmet}=item.visuals??{};for(const id of [KIT_WEAPON_MODELS[weapon],KIT_HEADWEAR_MODELS[helmet]])if(id)assert.ok(KIT_MODELS[id],`${item.id} → ${id}`);}
  assert.deepEqual(Object.values(KIT_HEADWEAR_MODELS).map(id=>KIT_MODELS[id].kind),['helmet','helmet','helmet']);
  assert.ok(Object.values(KIT_WEAPON_MODELS).every(id=>['sword','axe'].includes(KIT_MODELS[id].kind)));
  assert.deepEqual(Object.keys(KIT_MODELS).sort(),[...new Set([...Object.values(KIT_WEAPON_MODELS),...Object.values(KIT_HEADWEAR_MODELS)])].sort(),'Every model is worn by something');
});

test('a figure wears the loaded kit in place of the code-built pieces: the blade reaches the code-built tip, the helmet sits on the head', async () => {
  const actor=createActor(soldier('jerkin','niederbieber','gladius','scutum'),{chapter:3,kitLibrary:library});await actor.ready;
  const info=actor.group.userData.actor;assert.deepEqual(info.kitModels,['kit-gladius','kit-niederbieber']);assert.deepEqual(info.kitWanted,[]);
  actor.update({motion:'idle',resetPose:true});actor.group.updateMatrixWorld(true);
  // The blade's far end is where combat effects leave it (the weapon's contact joint, at the code-built tip).
  const grip=actor.group.getObjectByName('gladius').getWorldPosition(new T.Vector3()),tip=actor.group.getObjectByName('weapon-contact').getWorldPosition(new T.Vector3()),axis=tip.clone().sub(grip),length=axis.length();axis.normalize();
  const [blade]=nearKit(actor.group,'kit-gladius');assert.ok(blade,'The generated gladius is drawn near');
  const reach=Math.max(...worldPoints(blade).map(p=>p.clone().sub(grip).dot(axis)));
  assert.ok(Math.abs(reach-length)<.012,`The blade reaches ${reach.toFixed(3)} m of the code-built ${length.toFixed(3)} m`);
  const [helmet]=nearKit(actor.group,'kit-niederbieber');assert.ok(helmet,'The generated helmet is drawn near');
  const head=actor.group.getObjectByName('head').getWorldPosition(new T.Vector3()),points=worldPoints(helmet),box=new T.Box3().setFromPoints(points);
  assert.ok(box.containsPoint(head.clone().setY(box.min.y+.01))&&box.max.y>head.y+.15&&box.min.y<head.y+.12,'The helmet covers the head');
  // Far away, the figure's overview takes the pieces' baked colours, which the code-built pieces lack.
  const plain=createActor(soldier('jerkin','niederbieber','gladius','scutum'),{chapter:3,kitLibrary:createActorKitLibrary(async()=>{throw Error('absent');})});await plain.ready;
  const tones=a=>{a.update({detailDistance:40});assert.equal(a.group.userData.actor.detail,'overview');const found=new Set();
    a.group.traverseVisible(o=>{const c=o.isMesh&&o.geometry.attributes.color;if(c)for(let i=0;i<c.count;i++)found.add([c.getX(i),c.getY(i),c.getZ(i)].map(v=>v.toFixed(3)).join());});return found;};
  const own=tones(plain),worn=[...tones(actor)].filter(t=>!own.has(t));
  assert.ok(worn.length>=20,`The overview draws the kit's own colours (${worn.length} new)`);
  actor.dispose();plain.dispose();
});

test('a piece that fails to load leaves the code-built one; a late one rebuilds the figure once; no figure frees the master', async () => {
  const unit=soldier('hamata','galea','spatha'),failing=createActorKitLibrary(async()=>{throw Error('offline');});
  const fallback=createActor(unit,{chapter:3,kitLibrary:failing});await fallback.ready;
  assert.deepEqual(fallback.group.userData.actor.kitModels,[]);assert.equal(fallback.rebuilt,false);
  assert.match(failing.status('kit-spatha').error,/offline/);assert.equal(failing.model('kit-spatha'),null);
  assert.equal(nearKit(fallback.group,'kit-spatha').length,0,'The code-built sword stays');fallback.dispose();
  const releases=[],late=createActorKitLibrary(id=>new Promise(done=>releases.push(()=>done(parse(id)))));
  const waiting=createActor(unit,{chapter:3,kitLibrary:late});
  assert.deepEqual(waiting.group.userData.actor.kitModels,[]);assert.deepEqual(waiting.group.userData.actor.kitWanted,['kit-spatha','kit-galea']);
  for(const release of releases)release();assert.equal(await waiting.ready,true);assert.equal(waiting.rebuilt,true);
  assert.deepEqual(waiting.group.userData.actor.kitModels,['kit-spatha','kit-galea']);waiting.dispose();
  // A figure disposed before its kit arrives is neither rebuilt nor put back.
  const later=[],slow=createActorKitLibrary(id=>new Promise(done=>later.push(()=>done(parse(id))))),gone=createActor(unit,{chapter:3,kitLibrary:slow}),scene=new T.Group();
  scene.add(gone.group);gone.dispose();for(const release of later)release();assert.equal(await gone.ready,false);assert.equal(scene.children.length,0);
  const master=library.model('kit-galea');let freed=0;for(const target of [master.near.geometry,master.near.material,master.overview.geometry])target.addEventListener('dispose',()=>freed++);
  const a=createActor(unit,{chapter:3,kitLibrary:library});await a.ready;assert.deepEqual(a.group.userData.actor.kitModels,['kit-spatha','kit-galea']);a.dispose();a.dispose();
  assert.equal(freed,0,'Other figures still wear the master');
  const plain=createActor(unit,{chapter:3,quality:'performance',kitLibrary:library});await plain.ready;assert.deepEqual(plain.group.userData.actor.kitModels,[],'Performance keeps the code-built pieces');plain.dispose();
});

test('wearKitModel fits a helmet to the code-built bounds on each axis, and a weapon uniformly to the code-built tip', () => {
  const make=()=>({geometries:new Set(),materials:new Set(),mesh:(parent,geometry,material)=>{const m=new T.Mesh(geometry,material);parent.add(m);return m;}});
  const piece=(parent,geometry,x,y,z)=>{const m=new T.Mesh(geometry,new T.MeshStandardMaterial());m.position.set(x,y,z);parent.add(m);return m;};
  const master=geometry=>{geometry.computeBoundingBox();const overview=geometry.clone();overview.setAttribute('color',new T.Float32BufferAttribute(new Array(overview.attributes.position.count*3).fill(.5),3));
    return {id:'test-kit',near:{geometry,material:new T.MeshStandardMaterial({map:new T.Texture()})},overview:{geometry:overview}};};
  // A helmet: bowl and cheek guard, and a crest joint that stays.
  const helmet=new T.Bone(),crest=new T.Bone();crest.name='officer-horsehair-crest';helmet.add(crest);
  piece(helmet,new T.BoxGeometry(.26,.2,.27),0,.15,0);piece(helmet,new T.BoxGeometry(.03,.09,.05),.12,.04,.05);
  const want=new T.Box3();for(const o of helmet.children.filter(o=>o.isMesh)){o.updateMatrix();o.geometry.computeBoundingBox();want.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrix));}
  const kit=master(new T.BoxGeometry(.3,.3,.32).translate(0,.15,.01)),tools=make(),worn=wearKitModel(helmet,kit,{uniform:false,...tools});
  worn.updateMatrix();const got=worn.geometry.boundingBox.clone().applyMatrix4(worn.matrix);
  for(const k of ['x','y','z'])assert.ok(Math.abs(got.min[k]-want.min[k])<1e-6&&Math.abs(got.max[k]-want.max[k])<1e-6,`Fitted on ${k}`);
  assert.deepEqual(helmet.children.filter(o=>o.isMesh),[worn],'The code-built pieces are gone');assert.ok(helmet.children.includes(crest),'A joint it holds stays');
  assert.equal(worn.userData.kitModel,'test-kit');assert.ok(tools.geometries.has(worn.userData.overviewGeometry)&&tools.materials.has(worn.material),'The figure owns its copies');
  assert.notEqual(worn.geometry,kit.near.geometry);assert.notEqual(worn.material,kit.near.material);
  // A sword: scaled as one so its tip meets the code-built tip, its grip left in the hand.
  const sword=new T.Bone();piece(sword,new T.CylinderGeometry(.012,.012,.095,8),0,-.006,0);piece(sword,new T.BoxGeometry(.05,.52,.01).translate(0,.26,0),0,.073,0);
  const blade=master(new T.BoxGeometry(.06,.83,.02).translate(0,.33,0)),swordWorn=wearKitModel(sword,blade,{uniform:true,...make()});
  swordWorn.updateMatrix();const reach=swordWorn.geometry.boundingBox.clone().applyMatrix4(swordWorn.matrix);
  assert.ok(Math.abs(reach.max.y-.593)<1e-6,'The tip meets the code-built tip');assert.equal(swordWorn.scale.x,swordWorn.scale.z);assert.equal(swordWorn.scale.x,swordWorn.scale.y);
  assert.deepEqual(swordWorn.position.toArray(),[0,0,0],'The grip stays in the hand');
  assert.equal(wearKitModel(new T.Bone(),blade,{uniform:true,...make()}),null,'Nothing to replace, nothing worn');
  assert.equal(wearKitModel(sword,null,{uniform:true,...make()}),null);
});

test('the kit downloads with every chapter\'s 3D pack', () => {
  const files=Object.keys(KIT_MODELS).map(id=>'./'+kitModelUrl(id)),available=[...files,'./assets/models/characters/roman-recruit.glb'];
  for(let chapter=1;chapter<=12;chapter++){const pack=chapterOfflineAssets(chapter,available);for(const path of files)assert.ok(pack.includes(path),`${path} in Chapter ${chapter}`);}
});
