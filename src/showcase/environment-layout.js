// Pure presentation planning. Never consumes the campaign RNG or edits terrain.
export const TILE_SIZE=2.5;
export const isTrainingGround=e=>e?.id==='ch1-training'||e?.id==='ch1-drill'||e?.type==='training'||e?.mode==='training'||e?.mission?.mode==='training';
export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
export function hash(x,z=0,s=0){const a=Math.sin(x*127.1+z*311.7+s*74.7)*43758.5453;return a-Math.floor(a);}
export function noise(x,z,s=0){const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz),a=hash(ix,iz,s)*(1-u)+hash(ix+1,iz,s)*u,b=hash(ix,iz+1,s)*(1-u)+hash(ix+1,iz+1,s)*u;return a*(1-v)+b*v;}
export function gridToWorld(tile,encounter,tileSize=TILE_SIZE){return {x:(tile.x-(encounter.width-1)/2)*tileSize,y:0,z:(tile.y-(encounter.height-1)/2)*tileSize};}
export function terrainAt(e,x,y){const t=e.terrain?.[y]?.[x];return typeof t==='string'?t:t?.type||'grass';}
export function worldToGrid(x,z,e,tileSize=TILE_SIZE){return {x:Math.round(x/tileSize+(e.width-1)/2),y:Math.round(z/tileSize+(e.height-1)/2)};}
export function createGroundHeight(e,tileSize=TILE_SIZE){
  const hills=[];for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(['high','hill'].includes(terrainAt(e,x,y)))hills.push(gridToWorld({x,y},e,tileSize));
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2;
  return (x,z)=>{
    if(!Number.isFinite(x)||!Number.isFinite(z))return 0;
    const distance=Math.max(Math.abs(x)-hx,Math.abs(z)-hz,0),outside=smooth(distance/7);
    let h=outside*((noise(x*.052,z*.052,3)-.43)*3.2+(noise(x*.16,z*.16,7)-.5)*.55);
    const river=smooth((-z-18)/5)*(1-smooth((-z-38)/7));h-=river*2.7;
    for(const p of hills){const d=Math.hypot(x-p.x,z-p.z)/(tileSize*.63);if(d<1)h+=.45*Math.pow(1-d*d,2);}
    return h;
  };
}
export function roadSegments(e,tileSize=TILE_SIZE){
  const result=[];for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++){
    if(terrainAt(e,x,y)!=='road')continue;
    const p=gridToWorld({x,y},e,tileSize);
    for(const [dx,dy]of [[1,0],[0,1]])if(terrainAt(e,x+dx,y+dy)==='road'&&x+dx<e.width&&y+dy<e.height)result.push([p,gridToWorld({x:x+dx,y:y+dy},e,tileSize)]);
    if(x===0)result.push([{x:p.x-18,y:0,z:p.z},p]);
    if(x===e.width-1)result.push([p,{x:p.x+18,y:0,z:p.z}]);
  }return result;
}
export function isPlayable(x,z,e,tileSize=TILE_SIZE,margin=0){return Math.abs(x)<=e.width*tileSize/2+margin&&Math.abs(z)<=e.height*tileSize/2+margin;}
