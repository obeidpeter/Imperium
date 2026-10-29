import * as T from '../../vendor/three/three.module.js';
import {createModelLoader} from './model-loader.js';
import {worldModelUrl} from '../ui/world-catalog.js';
import {getChapterFiveKitPlacements} from './environment-ch5-pilot.js';
import {createSceneryModelCache} from './scenery-cache.js';
import {hasRegionalWorld,getRegionalKitPlacements,regionalPropPlacements} from './environment-regional-world.js';
import {boardKitUrl} from './board-kit.js';
import {sceneTreeKitUrl} from './tree-kit.js';
import {sceneRockKitUrl} from './rock-kit.js';
import {normaliseModelMaterials} from './model-materials.js';
import {curiaPlacements,updateInteriorCutaway} from './environment-curia.js';

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

/** Only confirmed campaign presentation metadata changes a camp placement.
 * Bundles face the departure side after the civilian-priority decision while
 * retaining the same fixed collision pocket. */
export function sceneryPlacements(e,{chapter,tileSize=2.5}={}){
  if(hasRegionalWorld(e))return [...regionalPropPlacements(e,{chapter,tileSize}),...getRegionalKitPlacements(e,{chapter,tileSize}).map(p=>({...p,url:sceneryModelUrl(p.id)})),
    ...curiaPlacements(e,{chapter,tileSize})];
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
  return [...props,...getChapterFiveKitPlacements(e,{chapter,tileSize}).map((p,i)=>({...p,key:`${p.id}:${p.component}:${i}`,url:sceneryModelUrl(p.id)}))];
}

// Each master's materials share the imported art's programs (model-materials.js).
const loadScene=url=>createModelLoader().loadAsync(url).then(gltf=>normaliseModelMaterials(gltf.scene));
const masters=createSceneryModelCache({load:loadScene});
export const warmSceneryModel=(url,load)=>masters.warm(url,load);
export const sceneryMaster=url=>masters.master(url);
export const sceneryResidency=()=>masters.stats();
// A lease on a model a stage uses while it stands (the board kit, battlefield-features.js).
export const acquireSceneryModel=(url,load)=>masters.acquire(url,load);
// A lease on a model already loaded, or null, without a request (scenery-cache.js).
export const holdSceneryModel=url=>masters.hold(url);
// The board kit and the region's tree and rock kits belong to the working set wherever the scenery is drawn.
const worldKitUrls=(e,quality,chapter)=>quality==='performance'?[]:[boardKitUrl(e),sceneTreeKitUrl(e,chapter),sceneRockKitUrl(e,chapter)].filter(Boolean);
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

export function createSceneryModels(scene,e,{chapter,quality='balanced',heightAt=()=>0,load=null,prepare=null,cache=masters}={}){
  const group=new T.Group();group.name='generated scenery';scene.add(group);
  const library=load?createSceneryModelCache({maxIdle:0,load}):cache;
  const placements=quality==='performance'?[]:sceneryPlacements(e,{chapter}),urls=[...new Set(placements.map(p=>p.url))];
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
  const place=(p,source)=>{
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
