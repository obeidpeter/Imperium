import {TILE_SIZE,terrainAt,gridToWorld,createGroundHeight,distantRiverCentre,marshSheetAlpha,MARSH_SHEET_MARGIN,RIVER_WATER_LEVEL,MARSH_WATER_LEVEL} from './environment-layout.js';
import {chapterFivePilotHeight,chapterFiveRiverProfile,isChapterFivePilot} from './environment-ch5-pilot.js';
import {getSceneProfile} from './campaign-scene-profile.js';

// Where a battle scene's open water lies, as the environment draws it (presentation only; the rules never read it):
// - the wetland's marsh sheet, which reaches MARSH_SHEET_MARGIN metres past the board's marsh (environment-campaign-terrain.js);
// - a river's or ford's water where the ground lies below it, with the channel where a river leaves the board (the same);
// - the distant river beyond the north edge (environment.js);
// - Chapter V's Euphrates beyond the fortress (environment-ch5-pilot.js).
// Placements beyond the board, the battles' set pieces (field-models.js), keep their footprints out of it. A point within
// SHORE metres above a surface's level counts as wet, so nothing stands with its feet at the waterline. Where two
// surfaces meet, the higher is the one seen: a river leaving the board runs on, at its own level, over the near half
// of the distant river, so a battle's boats keep to where the distant river's own surface shows.
// The distant river's surface (environment.js draws it at this height), on which a battle's boats float (field-models.js).
export const DISTANT_RIVER_LEVEL=-1.24;
const SHORE=.05,DISTANT_RIVER_HALF_WIDTH=8,DISTANT_RIVER_HALF_LENGTH=62.5,EUPHRATES_LEVEL=-1.2;

/** A predicate (x, z) → whether open water lies at that point of the encounter's scene. */
export function createWaterSampler(e,options={}){
  const level=createWaterLevelSampler(e,options);return (x,z)=>level(x,z)!==null;
}

/** (x, z) → the level of the water surface seen at that point of the encounter's scene, the highest where two meet, or
 * null on dry ground. */
export function createWaterLevelSampler(e,{chapter,tileSize=TILE_SIZE}={}){
  if(!e||!Number.isInteger(e.width)||!Number.isInteger(e.height))return ()=>null;
  const profile=getSceneProfile(e,{chapter}),height=chapterFivePilotHeight(createGroundHeight(e,tileSize,{profile}),e,tileSize);
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2,below=(x,z,level)=>height(x,z)<level+SHORE;
  const wetland=profile.setting==='wetland',euphrates=isChapterFivePilot(e),riverZ=profile.distantWater?distantRiverCentre(e,tileSize):null;
  // The river and ford water's extent, as the terrain draws it: their cells' span and a cell more, along the whole
  // length of the scene's ground where a river leaves the board.
  const cells=[];for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(['river','ford'].includes(terrainAt(e,x,y)))cells.push({x,y,type:terrainAt(e,x,y)});
  const span=cells.length?(()=>{const at=cells.map(c=>gridToWorld(c,e,tileSize)),exits=cells.some(c=>c.type==='river'&&(c.y===0||c.y===e.height-1));
    return {minX:Math.min(...at.map(p=>p.x))-tileSize,maxX:Math.max(...at.map(p=>p.x))+tileSize,
      minZ:exits?-hz-16:Math.min(...at.map(p=>p.z))-tileSize,maxZ:exits?hz+16:Math.max(...at.map(p=>p.z))+tileSize};})():null;
  // Highest first, so the first surface found is the one seen.
  return (x,z)=>{
    if(!Number.isFinite(x)||!Number.isFinite(z))return null;
    if(wetland&&Math.abs(x)<=hx+MARSH_SHEET_MARGIN&&Math.abs(z)<=hz+MARSH_SHEET_MARGIN&&marshSheetAlpha(e,x,z,tileSize)>.05&&below(x,z,MARSH_WATER_LEVEL))return MARSH_WATER_LEVEL;
    if(span&&x>=span.minX&&x<=span.maxX&&z>=span.minZ&&z<=span.maxZ&&below(x,z,RIVER_WATER_LEVEL))return RIVER_WATER_LEVEL;
    if(euphrates){const r=chapterFiveRiverProfile(x,e,tileSize);if(Math.abs(x)<=r.length/2&&z<=r.near&&z>=r.near-r.width&&below(x,z,EUPHRATES_LEVEL))return EUPHRATES_LEVEL;}
    if(riverZ!==null&&Math.abs(x)<=DISTANT_RIVER_HALF_LENGTH&&Math.abs(z-riverZ)<=DISTANT_RIVER_HALF_WIDTH&&below(x,z,DISTANT_RIVER_LEVEL))return DISTANT_RIVER_LEVEL;
    return null;
  };
}
