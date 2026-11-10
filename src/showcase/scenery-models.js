import * as T from '../../vendor/three/three.module.js';
import {createModelLoader} from './model-loader.js';
import {worldModelUrl,worldAssetShown,CAMP_WALL_CHAPTERS,CAMP_WALL_MODELS} from '../ui/world-catalog.js';
import {campWallStyle,campWallSections,campTowerSpots,campGateways,campGateSpan,BREASTWORK_BATCHES,CAMP_PARAPET_BATCHES} from './camp-walls.js';
import {getChapterFiveKitPlacements} from './environment-ch5-pilot.js';
import {createSceneryModelCache} from './scenery-cache.js';
import {hasRegionalWorld,getRegionalKitPlacements,regionalPropPlacements,regionalPlacementBounds,regionalComponentDimensions,regionalTentPitches,regionalChapter,TENT_MODEL,TENT_VARIANTS,tentFallbackName} from './environment-regional-world.js';
import {boardKitUrl} from './board-kit.js';
import {fieldModelUrls,battlePropPlacements,hasBattleProps} from './field-models.js';
import {sceneTreeKitUrl} from './tree-kit.js';
import {sceneRockKitUrl} from './rock-kit.js';
import {normaliseModelMaterials} from './model-materials.js';
import {curiaPlacements,hasCuria,updateInteriorCutaway} from './environment-curia.js';
import {aurelianWallsUrl} from './aurelian-walls.js';
import {LANDMARK_LAYOUT} from '../ui/world-layouts.js';

/** Presentation-only generated scenery. Exterior positions follow the actual
 * board bounds, including real-time maps. Interior camp props use authored
 * blocked service pads; models never take picks or change navigation. Failed
 * architecture and interior props retain their procedural fallbacks. */
export const SCENERY_MODELS=Object.freeze({
  5:Object.freeze({encounters:Object.freeze(['ch5-mine','ch5-wall','ch5-camp']),models:Object.freeze([
    {id:'ch5-leather-tent',side:'south',along:-.85,gap:7,yaw:.4},
    {id:'ch5-spoil-baskets',side:'south',along:-.55,gap:4,yaw:.5},
    {id:'ch5-storage-jars',side:'south',along:-.25,gap:8,yaw:.2},
    {id:'ch5-gallery-timbers',side:'south',along:.1,gap:9,yaw:.9},
    {id:'ch5-mudbrick-stack',side:'south',along:.55,gap:10,yaw:1.1},
    {id:'ch5-cistern',side:'west',along:.2,gap:4,yaw:.25},
    {id:'ch5-siege-hoist',side:'south',along:.1,gap:3.5,yaw:-.3},
    {id:'ch5-damaged-masonry',side:'south',along:.55,gap:4,yaw:.6},
    {id:'ch5-household-bundles',side:'west',along:-.6,gap:4,yaw:.5}
  ].map(Object.freeze))})
});
export const sceneryModelUrl=id=>worldModelUrl(id);

// Interior camp props may only occupy an explicitly authored rock pocket.
// Checking the whole footprint prevents stale/partial presentation metadata
// from placing a solid-looking object on otherwise walkable ground.
function campPad(e,id,tileSize){
  if(e.id!=='ch5-camp')return null;
  const pad=e.campPresentation?.sceneryPads?.find(p=>p.id===id);
  if(!pad||![pad.x,pad.z,pad.width,pad.depth].every(Number.isFinite)||pad.width<=.6||pad.depth<=.6||!Array.isArray(pad.cells))return null;
  const cells=new Set((pad.cells??[]).map(c=>`${c.x},${c.y}`)),hx=e.width*tileSize/2,hz=e.height*tileSize/2;
  if(pad.x-pad.width/2 < -hx||pad.x+pad.width/2 > hx||pad.z-pad.depth/2 < -hz||pad.z+pad.depth/2 > hz)return null;
  const left=Math.floor((pad.x-pad.width/2+hx+1e-6)/tileSize),right=Math.floor((pad.x+pad.width/2+hx-1e-6)/tileSize);
  const top=Math.floor((pad.z-pad.depth/2+hz+1e-6)/tileSize),bottom=Math.floor((pad.z+pad.depth/2+hz-1e-6)/tileSize);
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
    const tile=e.terrain?.[y]?.[x],type=typeof tile==='string'?tile:tile?.type;
    if(x<0||y<0||x>=e.width||y>=e.height||!cells.has(`${x},${y}`)||type!=='rock')return null;
  }
  return pad;
}

// The tent lines (graphics plan, G3): one placement for each tent model draws its pitches, an instanced
// draw for each of its meshes, and hides those pitches' code-built tents (environment-regional-world.js).
function tentLinePlacements(e,tileSize,desktop){
  const pitches=regionalTentPitches(e,tileSize,{desktop});
  return [TENT_MODEL,...TENT_VARIANTS].flatMap(model=>{
    const own=pitches.filter(p=>p.model===model),url=worldModelUrl(model);
    return own.length&&url?[{id:model,key:model===TENT_MODEL?'tent-lines':`tent-lines:${model}`,url,instances:own.map(p=>({x:p.x,z:p.z,yaw:p.yaw,scale:p.scale})),fallbackName:tentFallbackName(model)}]:[];
  });
}

// The camps' walls (G3, camp-walls.js): for a camp's wall style, its wall along the runs, its towers and its
// gates, an instanced draw for each mesh of each model. The wall stands for the code-built breastwork or
// parapet, hidden once it is drawn, which stays as its fallback on Performance and until the model is ready;
// the towers and gates have no stand-in.
export const CAMP_PALISADE=CAMP_WALL_MODELS.timber.wall,CAMP_TOWER=CAMP_WALL_MODELS.timber.tower;
function campWallPlacements(e,chapter,tileSize){
  const style=campWallStyle(e),set=CAMP_WALL_MODELS[style];
  if(chapter!==regionalChapter(e)||!set)return [];
  const used=id=>!!id&&!!CAMP_WALL_CHAPTERS[id]?.includes(chapter);
  const sections=used(set.wall)?campWallSections(e,tileSize):[],towers=used(set.tower)?campTowerSpots(e,tileSize):[],gates=used(set.gate)?campGateways(e,tileSize):[];
  const timber=style==='timber';
  return [
    ...(sections.length?[{id:set.wall,key:timber?'camp-palisade':'camp-wall',url:worldModelUrl(set.wall),instances:sections.map(({x,z,yaw,length})=>({x,z,yaw,length})),fallbackNames:timber?[...BREASTWORK_BATCHES]:[CAMP_PARAPET_BATCHES[style]]}]:[]),
    ...(towers.length?[{id:set.tower,key:'camp-towers',url:worldModelUrl(set.tower),instances:towers.map(({x,z,yaw})=>({x,z,yaw}))}]:[]),
    ...(gates.length?[{id:set.gate,key:'camp-gates',url:worldModelUrl(set.gate),instances:gates.map(g=>({x:g.x,z:g.z,yaw:g.yaw,length:campGateSpan(style,g)}))}]:[])
  ];
}

/** Only confirmed campaign presentation metadata changes a camp placement.
 * Bundles face the departure side after the civilian-priority decision while
 * retaining the same fixed collision pocket. */
export function sceneryPlacements(e,{chapter,tileSize=2.5,withoutGate=false,desktop}={}){
  // On the web, a chapter leaves out the generated scenery its download has no room for (world-catalog.js): the
  // code-built stand-ins stay where those models would stand. `desktop` overrides the build's own platform (tests).
  const shown=chapterScenery(e,{chapter,tileSize,withoutGate,desktop}).filter(p=>worldAssetShown(p.id,chapter,desktop===undefined?{}:{desktop}));
  // An animal stands only with the piece it belongs to (G4): where the piece is left out, so is the animal.
  const hosts=new Set(shown.map(p=>p.id));
  return shown.filter(p=>!p.host||hosts.has(p.host));
}
// Where the scene's other scenery stands, as {minX, maxX, minZ, maxZ}, for a battle's set pieces to keep clear of: a
// building by its component's footprint, a placed prop by the room it is fitted within.
const sceneryBounds=placements=>placements.flatMap(p=>p.component&&regionalComponentDimensions(p.id,p.component)?[regionalPlacementBounds(p)]:(p.instances??[p]).map(({x,z})=>{
  const w=(p.fitWithin?.width??4.4)/2,d=(p.fitWithin?.depth??4.4)/2;return {minX:x-w,maxX:x+w,minZ:z-d,maxZ:z+d};}));
// A battle's set pieces beyond the board (G5, field-models.js) find their spots last, clear of everything else.
const withBattleProps=(e,placements,tileSize,chapter)=>e?.kind!=='battle'||!hasBattleProps(e)?placements:
  [...placements,...battlePropPlacements(e,{tileSize,chapter,occupied:sceneryBounds(placements)})];
function chapterScenery(e,{chapter,tileSize=2.5,withoutGate=false,desktop}={}){
  if(hasRegionalWorld(e))return withBattleProps(e,[...regionalPropPlacements(e,{chapter,tileSize}),...getRegionalKitPlacements(e,{chapter,tileSize,withoutGate}).map(p=>({...p,url:sceneryModelUrl(p.id)})),
    ...curiaPlacements(e,{chapter,tileSize}),...tentLinePlacements(e,tileSize,desktop),...campWallPlacements(e,chapter,tileSize)],tileSize,chapter);
  const set=SCENERY_MODELS[chapter];
  if(!set||!set.encounters.includes(e?.id))return [];
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2;
  if(!Number.isFinite(hx)||!Number.isFinite(hz)||hx<=0||hz<=0)return [];
  const props=set.models.map(m=>{
    let x=m.side==='west'?-hx-m.gap:hx*m.along,z=m.side==='west'?hz*m.along:hz+m.gap,yaw=m.yaw;
    if(e.id==='ch5-camp'&&m.id==='ch5-household-bundles'&&e.campPresentation?.civilianOutcome==='departing')yaw=-.4;
    const pad=campPad(e,m.id,tileSize);
    if(pad)return {id:m.id,url:sceneryModelUrl(m.id),x:pad.x,z:pad.z,yaw,pad:true,
      fitWithin:{width:pad.width-.6,depth:pad.depth-.6},fallbackName:`ch5-service-pad:${pad.id}`};
    return {id:m.id,url:sceneryModelUrl(m.id),x,z,yaw};
  });
  // Chapter V's staging courtyard keeps its own props; its mudbrick walls are the camps' (G3).
  return withBattleProps(e,[...props,...getChapterFiveKitPlacements(e,{chapter,tileSize}).map((p,i)=>({...p,key:`${p.id}:${p.component}:${i}`,url:sceneryModelUrl(p.id)})),...campWallPlacements(e,chapter,tileSize)],tileSize,chapter);
}

/** A skinned model stood as scenery (a horse's coat at the horse lines, G4): each of its skinned surfaces becomes a
 * plain mesh in its rest pose, which is where the skeleton stands as it loads, so the vertices need no change; the
 * far-off overview surface is left out, as scenery has no level of detail; the bones stay as empty nodes. Plain
 * meshes share the scenery's shader programs (model-materials.js). A model with no skin is returned as it is. */
export function standSkinnedModel(root){
  const skinned=[];root?.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o);});
  for(const mesh of skinned){
    const parent=mesh.parent;if(!parent)continue;
    if(/overview$/.test(mesh.name)){parent.remove(mesh);continue;}
    const geometry=mesh.geometry.clone();geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
    const plain=new T.Mesh(geometry,mesh.material);plain.name=mesh.name;
    plain.position.copy(mesh.position);plain.quaternion.copy(mesh.quaternion);plain.scale.copy(mesh.scale);
    parent.add(plain);parent.remove(mesh);
  }
  return root;
}
// Each master's materials share the imported art's programs (model-materials.js).
const loadScene=url=>createModelLoader().loadAsync(url).then(gltf=>normaliseModelMaterials(standSkinnedModel(gltf.scene)));
/** Idle masters kept between stages: enough for any one scene's working set (at most 34: Chapter IX's camp in the desktop
 * app, with G3's furniture and walls and G4's animals), so a chapter's next stage finds its models still warm. */
export const SCENERY_IDLE_MASTERS=36;
const masters=createSceneryModelCache({maxIdle:SCENERY_IDLE_MASTERS,load:loadScene});
export const warmSceneryModel=(url,load)=>masters.warm(url,load);
export const sceneryMaster=url=>masters.master(url);
export const sceneryResidency=()=>masters.stats();
// A lease on a model a stage uses while it stands (the board kit, battlefield-features.js).
export const acquireSceneryModel=(url,load)=>masters.acquire(url,load);
// A lease on a model already loaded, or null, without a request (scenery-cache.js).
export const holdSceneryModel=url=>masters.hold(url);
/** The chapter's generated landmarks (LANDMARK_LAYOUT; environment-horizon.js), as [world catalog
 * id, model url] pairs: those whose models exist, and none in the Curia, whose walls hide them. */
export const landmarkModelUrls=(e,{chapter}={})=>e&&!hasCuria(e,{chapter})?(LANDMARK_LAYOUT[chapter]??[]).map(slot=>[slot.model,worldModelUrl(slot.model)]).filter(([,url])=>url):[];
// The board kit, the region's tree and rock kits, before Rome Aurelian's walls, the chapter's generated landmarks
// and a battle's field-object models (field-models.js) belong to the working set wherever the scenery is drawn.
const worldKitUrls=(e,quality,chapter)=>quality==='performance'?[]:[boardKitUrl(e),sceneTreeKitUrl(e,chapter),sceneRockKitUrl(e,chapter),aurelianWallsUrl(e,{chapter}),
  ...landmarkModelUrls(e,{chapter}).map(([,url])=>url),...fieldModelUrls(e,{chapter}).map(([,url])=>url)].filter(Boolean);
/** Every model a scene's stage keeps while it stands, when the loading veil has preloaded
 * them: its placed scenery and the world kits. None on Performance. */
export const sceneryWorkingSet=(e,{chapter,quality='balanced'}={})=>quality==='performance'?[]:[...new Set([...sceneryPlacements(e,{chapter}).map(p=>p.url),...worldKitUrls(e,quality,chapter)])];
let preload=null;
const preloadKey=urls=>[...urls].sort().join('\n');
const releasePreload=()=>{const previous=preload;preload=null;for(const lease of previous?.leases??[])lease.release();};
/** The newest preload stays pinned until a stage acquires its own leases or a
 * subsequent preload replaces it. Thus LRU pressure cannot evict a model in
 * the gap between the loading veil's preload and stage construction. */
export function preloadSceneryModels(e,{chapter,quality='balanced',load}={}){
  const urls=sceneryWorkingSet(e,{chapter,quality}),leases=urls.map(url=>masters.acquire(url,load));releasePreload();
  preload={key:preloadKey(urls),leases};masters.setWorkingSet(urls);
  return Promise.all(leases.map(lease=>lease.ready.then(scene=>!!scene,()=>false)));
}

// withoutGate: Aurelian's walls stand at the finale's gate road, so its arch steps aside. desktop overrides the
// build's own platform, as sceneryPlacements' does (tests).
export function createSceneryModels(scene,e,{chapter,quality='balanced',heightAt=()=>0,load=null,prepare=null,cache=masters,withoutGate=false,desktop}={}){
  const group=new T.Group();group.name='generated scenery';scene.add(group);
  const library=load?createSceneryModelCache({maxIdle:0,load}):cache;
  const placements=quality==='performance'?[]:sceneryPlacements(e,{chapter,withoutGate,desktop}),urls=[...new Set(placements.map(p=>p.url))];
  const leases=new Map(urls.map(url=>[url,{lease:library.acquire(url),preparing:0,used:false,released:false}]));
  const kept=[...urls,...worldKitUrls(e,quality,chapter)];library.setWorkingSet(kept);
  if(library===masters&&preload?.key===preloadKey(kept))releasePreload();
  let disposed=false;
  const fallbacks=new Map(),release=state=>{if(state.released||state.preparing)return;state.released=true;state.lease.release({discard:!state.used});};
  // Lowest footprint sample puts every foundation into the sloped earth.
  const ground=(model,groundY)=>{
    const box=new T.Box3().setFromObject(model,true),{x,z}=model.position;
    if(box.isEmpty()){model.position.y=Number.isFinite(groundY)?groundY:heightAt(x,z)||0;return;}
    const samples=[[x,z],[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([sx,sz])=>heightAt(sx,sz)).filter(Number.isFinite);
    model.position.y=(Number.isFinite(groundY)?groundY:samples.length?Math.min(...samples):0)-box.min.y;
  };
  // Many copies of one model (the tent lines, the camps' palisade and towers): an instanced mesh for
  // each of its meshes. Each copy's footprint is centred on its spot and grounded on the lowest of its
  // corners, like a placed model. A copy takes a uniform scale, or a length along the model's own x,
  // to which it is stretched (a palisade section to its share of a run).
  const placeInstances=(p,source)=>{
    source.updateMatrixWorld(true);
    const box=new T.Box3().setFromObject(source,true),meshes=[];source.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)meshes.push(o);});
    if(box.isEmpty()||!meshes.length||!p.instances?.length)return null;
    const inverse=source.matrixWorld.clone().invert(),cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2;
    const matrices=p.instances.map(item=>{
      const k=item.scale??1,kx=Number.isFinite(item.length)?item.length/Math.max(.001,box.max.x-box.min.x):k,yaw=item.yaw??0,c=Math.cos(yaw),sn=Math.sin(yaw);
      const corners=[[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([lx,lz])=>{
        const ux=(lx-cx)*kx,uz=(lz-cz)*k;return heightAt(item.x+ux*c+uz*sn,item.z-ux*sn+uz*c);});
      const ground=Math.min(heightAt(item.x,item.z),...corners.filter(Number.isFinite));
      return new T.Matrix4().makeTranslation(item.x,(Number.isFinite(ground)?ground:0)-box.min.y*k,item.z)
        .multiply(new T.Matrix4().makeRotationY(yaw)).multiply(new T.Matrix4().makeScale(kx,k,k)).multiply(new T.Matrix4().makeTranslation(-cx,0,-cz));
    });
    const group=new T.Group();group.name=p.key??p.id;
    for(const mesh of meshes){
      const local=inverse.clone().multiply(mesh.matrixWorld),batch=new T.InstancedMesh(mesh.geometry,mesh.material,matrices.length);
      matrices.forEach((m,i)=>batch.setMatrixAt(i,m.clone().multiply(local)));batch.instanceMatrix.needsUpdate=true;
      // White instance colours: the shader programs (and shadow pass) of the scenery's other instanced batches.
      batch.instanceColor=new T.InstancedBufferAttribute(new Float32Array(matrices.length*3).fill(1),3);
      batch.name=`${group.name}:${mesh.name||'mesh'}`;batch.castShadow=p.shadow!==false;batch.receiveShadow=true;batch.raycast=()=>{};
      batch.computeBoundingBox();batch.computeBoundingSphere();group.add(batch);
    }
    group.updateMatrixWorld(true);return group;
  };
  const place=(p,source)=>{
    // A master that arrives skinned stands as plain meshes before it is cloned (a loader of its own may not do it).
    standSkinnedModel(source);
    if(p.instances)return placeInstances(p,source);
    const component=p.component?source.getObjectByName(p.component):source;if(!component)return null;
    const model=component.clone(true);model.name=p.key??p.id;model.position.set(p.x,0,p.z);model.rotation.y=p.yaw??0;
    if(p.scale)model.scale.set(...p.scale);model.updateMatrixWorld(true);
    if(p.fitWithin){
      const box=new T.Box3().setFromObject(model,true);
      if(!box.isEmpty()){
        const size=box.getSize(new T.Vector3()),factor=Math.min(1,p.fitWithin.width/Math.max(.001,size.x),p.fitWithin.depth/Math.max(.001,size.z));
        model.scale.multiplyScalar(factor);model.updateMatrixWorld(true);box.setFromObject(model,true);
        const centre=box.getCenter(new T.Vector3());model.position.x+=p.x-centre.x;model.position.z+=p.z-centre.z;model.updateMatrixWorld(true);
      }
    }
    // A piece that must not shade the board (the Curia's walls) casts no shadow.
    model.traverse(o=>{if(o.isMesh){o.castShadow=p.shadow!==false;o.receiveShadow=true;o.raycast=()=>{};}});
    if(p.cutaway)model.userData.interiorCutaway=p.cutaway;
    ground(model,p.groundY);return model;
  };
  const add=(p,model)=>{
    group.add(model);leases.get(p.url).used=true;
    // A placement stands for one code-built piece, or several (the Curia for its hall).
    for(const name of [p.fallbackName,...(p.fallbackNames??[])].filter(Boolean)){const fallback=scene.getObjectByName(name);if(fallback&&!fallbacks.has(fallback)){fallbacks.set(fallback,fallback.visible);fallback.visible=false;}}
    return p.key??p.id;
  };
  const placed=[],pending=[];
  // Warm models exist synchronously, before the stage's normal compilation.
  // Only genuinely late models need an individual preparation pass.
  for(const p of placements){const source=leases.get(p.url).lease.scene;if(source){const model=place(p,source);if(model)placed.push(add(p,model));}else pending.push(p);}
  const ready=Promise.all(pending.map(async p=>{
    const state=leases.get(p.url);let source;try{source=await state.lease.ready;}catch{return null;}
    if(disposed||!source)return null;
    const model=place(p,source);if(!model)return null;
    if(prepare){
      // Do not free geometry while an asynchronous GPU preparation still uses
      // it. Pending network loads, however, need no such protection on close.
      state.preparing++;
      try{await prepare(model);}catch{return null;}
      finally{state.preparing--;if(disposed)release(state);}
    }
    if(disposed)return null;
    return add(p,model);
  })).then(ids=>[...placed,...ids.filter(Boolean)]);
  return {group,placements,ready,
    // The Curia's walls stand down while the camera is beyond them (environment-curia.js).
    updateCutaway:camera=>updateInteriorCutaway(group,camera),
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const [fallback,visible]of fallbacks)fallback.visible=visible;fallbacks.clear();for(const state of leases.values())release(state);}
  };
}
