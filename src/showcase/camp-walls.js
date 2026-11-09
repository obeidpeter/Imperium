import {gridToWorld,terrainAt} from './environment-layout.js';
import {wallFace,wallStyle} from './environment-campaign-terrain.js';
import {getSceneProfile} from './campaign-scene-profile.js';

// The timber camps' palisade and towers (graphics plan, G3's pilot). A camp's wall cells, solid for
// the rules already, are read as straight runs: each run's palisade is a row of sections of one model,
// stretched a little to fill the run exactly, and a tower stands at each corner and at each end of a
// run that opens onto a gateway. Presentation only: no cell changes, and nothing here draws randomness.

/** The code-built breastwork's batches (environment-campaign-terrain.js), the palisade's fallback: the
 * palisade hides them once drawn, and nothing else joins them (environment.js), so hiding them hides no
 * other part of the camp. */
export const BREASTWORK_BATCHES=Object.freeze(['timber breastwork posts','timber breastwork planks']);

/** The palisade model's own length in metres (art-source/models/reports/g3-palisade-timber.json): it
 * sets how many sections fill a run; each is then stretched to its share of the run. */
export const PALISADE_SECTION_LENGTH=7.325;

const isWall=(e,x,y)=>x>=0&&y>=0&&x<e.width&&y<e.height&&terrainAt(e,x,y)==='wall';

/** Whether a camp's walls are timber, the walls the palisade and towers stand for. */
export function timberCamp(e){
  return /-camp$/.test(e?.id??'')&&Number.isInteger(e.width)&&Number.isInteger(e.height)&&e.width>0&&e.height>0&&wallStyle(getSceneProfile(e))==='timber';
}

/** A camp's wall cells as straight runs. A cell that meets walls both ways (a corner) belongs to the
 * run along x, as the code-built breastwork's faces have it (wallFace). Every wall cell is in one run. */
export function campWallRuns(e){
  if(!timberCamp(e))return [];
  const runs=[],along=(x,y,axis)=>isWall(e,x,y)&&(wallFace(e,x,y)==='east'?'z':'x')===axis;
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++){
    if(along(x,y,'x')&&!along(x-1,y,'x')){let end=x;while(along(end+1,y,'x'))end++;runs.push({axis:'x',cells:Array.from({length:end-x+1},(_,i)=>({x:x+i,y}))});}
    if(along(x,y,'z')&&!along(x,y-1,'z')){let end=y;while(along(x,end+1,'z'))end++;runs.push({axis:'z',cells:Array.from({length:end-y+1},(_,i)=>({x,y:y+i}))});}
  }
  return runs;
}

/** The palisade's sections: a run's length divided into whole sections near the model's own length,
 * each centred on its share, its outer face (the model's +z) turned away from the camp. A run along
 * z reaches half a cell into a corner beyond either end, to meet the run along x on its centre line. */
export function campPalisadeSections(e,tileSize=2.5){
  const runs=campWallRuns(e);if(!runs.length)return [];
  const walls=runs.flatMap(r=>r.cells),centre={x:0,z:0};
  for(const c of walls){const p=gridToWorld(c,e,tileSize);centre.x+=p.x/walls.length;centre.z+=p.z/walls.length;}
  const sections=[];
  for(const run of runs){
    const first=gridToWorld(run.cells[0],e,tileSize),last=gridToWorld(run.cells.at(-1),e,tileSize),x=run.axis==='x';
    let start=(x?first.x:first.z)-tileSize/2,end=(x?last.x:last.z)+tileSize/2;
    if(!x){const a=run.cells[0],b=run.cells.at(-1);if(isWall(e,a.x,a.y-1))start-=tileSize/2;if(isWall(e,b.x,b.y+1))end+=tileSize/2;}
    const length=end-start,count=Math.max(1,Math.round(length/PALISADE_SECTION_LENGTH)),share=length/count;
    const line=x?first.z:first.x,outward=Math.sign(line-(x?centre.z:centre.x))||1;
    const yaw=x?(outward>0?0:Math.PI):(outward>0?Math.PI/2:-Math.PI/2);
    for(let i=0;i<count;i++){const u=start+(i+.5)*share;sections.push({x:x?u:line,z:x?line:u,yaw,length:share});}
  }
  return sections;
}

/** The towers: on each corner cell, and on each run's end cell that opens onto a gateway (the next
 * cell along the run is on the board and not a wall). */
export function campTowerSpots(e,tileSize=2.5){
  const runs=campWallRuns(e),spots=new Map();
  const corner=(x,y)=>(isWall(e,x-1,y)||isWall(e,x+1,y))&&(isWall(e,x,y-1)||isWall(e,x,y+1));
  const open=(x,y)=>x>=0&&y>=0&&x<e.width&&y<e.height&&!isWall(e,x,y);
  const add=c=>{const key=`${c.x},${c.y}`;if(!spots.has(key)){const p=gridToWorld(c,e,tileSize);spots.set(key,{x:p.x,z:p.z,yaw:0,cell:{x:c.x,y:c.y}});}};
  for(const run of runs){
    const a=run.cells[0],b=run.cells.at(-1),dx=run.axis==='x'?1:0,dy=run.axis==='z'?1:0;
    for(const c of run.cells)if(corner(c.x,c.y))add(c);
    if(!corner(a.x,a.y)&&open(a.x-dx,a.y-dy))add(a);
    if(!corner(b.x,b.y)&&open(b.x+dx,b.y+dy))add(b);
  }
  return [...spots.values()].sort((p,q)=>p.cell.y-q.cell.y||p.cell.x-q.cell.x);
}
