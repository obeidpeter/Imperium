import {actorKit} from './actor-kit.js';
import {actorIdentity} from './actor-identity.js';
import {actorBodyId} from '../ui/actor-body-catalog.js';
import {warmActorBody} from './actor-bodies.js';
import {warmActorAssets} from './actor-assets.js';
import {acquireActorComplexion,warmActorComplexion} from './actor-complexion.js';
import {warmActorHair} from './actor-hair-asset.js';
import {acquireActorSurface,warmActorMaterials} from './actor-materials.js';
import {ACTOR_SURFACE_SPEC} from './actor-surface.js';
import {loadTacticalArt} from '../ui/unit-sprites.js';
import {environmentImageUrls} from './environment-materials.js';
import {decodeImage} from './decoded-images.js';
import {preloadSceneryModels} from './scenery-models.js';

// The figures' shared textures (skin complexions and the procedural surface
// tiles) are held for the whole session: the next battle neither downloads nor
// recomputes them, and a battle's own figures add and drop references only.
const held=new Set();
function hold(key,acquire){if(!held.has(key)){held.add(key);acquire();}}

/** What a figure in this battle will wear, as the stage builds it (createActor). */
export function figureNeeds(unit,{chapter,rank,commendations={}}={}){
  const vComm=commendations?.[unit.veteranId]??(unit.moraleResistance?6:unit.specialization?3:0);
  const kit=actorKit(unit,{chapter,rank,commendations:vComm}),identity=actorIdentity(unit,kit);
  return {identity,bodyId:actorBodyId(kit),complexion:identity.female?'female':'male',hair:!identity.female&&!['bound','long'].includes(identity.hair)};
}

/** The downloads a battle's figures need, keyed so each is fetched once:
 * bodies, anatomy, complexions and hair for sculpted figures (reinforcements
 * still hidden included), or the 2D paintings for painted ones. */
export function battleFigureNeeds(encounter,{chapter,rank,commendations={},figureStyle='sculpted'}={}){
  const needs=new Map();
  if(figureStyle==='painted'){needs.set('painted',{kind:'painted'});return needs;}
  needs.set('materials',{kind:'materials'});
  for(const unit of encounter?.units??[]){
    const need=figureNeeds(unit,{chapter,rank,commendations});
    if(need.bodyId)needs.set(`body:${need.bodyId}`,{kind:'body',id:need.bodyId});
    needs.set(`anatomy:${need.complexion}`,{kind:'anatomy',identity:need.identity});
    needs.set(`complexion:${need.complexion}`,{kind:'complexion',id:need.complexion});
    if(need.hair)needs.set('hair',{kind:'hair'});
  }
  return needs;
}

/** Fetch and decode everything a battle's figures will wear, the images its
 * ground, stone, timber and foliage sample, and its generated scenery, before
 * its stage is built: each figure is built once, already complete, every
 * material compiles with its maps, the scenery stands from the start, and
 * nothing is rebuilt in play. Resolves when all has arrived or failed
 * (a failure leaves that figure's or surface's fallback); never rejects. */
export function preloadBattleFigures(encounter,options={}){
  if(typeof window==='undefined'||!encounter)return Promise.resolve({tasks:0,failed:0});
  const run={
    painted:()=>loadTacticalArt(encounter).then(()=>true),
    materials:()=>{for(const kind of Object.keys(ACTOR_SURFACE_SPEC))hold(`surface:${kind}`,()=>acquireActorSurface(kind));return warmActorMaterials();},
    body:need=>warmActorBody(need.id),
    anatomy:need=>warmActorAssets(need.identity),
    complexion:need=>{hold(`complexion:${need.id}`,()=>acquireActorComplexion(need.id));return warmActorComplexion(need.id);},
    hair:()=>warmActorHair()
  };
  const surfaces=environmentImageUrls({civic:encounter.kind==='contest'}).map(url=>decodeImage(url).then(()=>true));
  const models=preloadSceneryModels(encounter,{chapter:options.chapter,quality:options.quality}).then(loaded=>loaded.every(Boolean));
  const tasks=[...[...battleFigureNeeds(encounter,options).values()].map(need=>Promise.resolve().then(()=>run[need.kind](need))),...surfaces,models].map(task=>task.catch(()=>false));
  return Promise.all(tasks).then(results=>({tasks:results.length,failed:results.filter(r=>r===false).length}));
}
