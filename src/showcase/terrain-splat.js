import {GROUND_LAYERS,GROUND_LAYER_INDEX} from '../ui/ground-layers.js';
import {terrainAt,worldToGrid,noise,smooth,clamp,isPlayable} from './environment-layout.js';

// Which ground layers lie where, from the board's own cells: each texel holds
// the weights of the twelve channels of three RGBA layers (GROUND_LAYERS uses
// the first eleven), summing to 255. Presentation only: computed from a
// snapshot of the encounter, it never changes the terrain, a rule or the
// campaign's random generator, and the same encounter always gives the same map.
export const SPLAT_TEXELS_PER_METRE=2,SPLAT_CHANNELS=12,SPLAT_MAX_SIDE=512;
// A cell's role in its region's mixes (GROUND_BIOMES). Roads are drawn from the
// road's own distance field, so a road cell's ground beside the tread is turf.
export const SPLAT_ROLES=Object.freeze({grass:'turf',road:'turf',sand:'sand',marsh:'wet',rock:'rock',rubble:'rock',ford:'bed',river:'bed',
  high:'turf',hill:'turf',wall:'rubble',camp:'camp',stone:'joints',floor:'slabs',bench:'slabs',chamber:'slabs'});
const LAYERS=GROUND_LAYERS.length;

/** The weights of a mix (role) scaled by `amount`, added into `w`. */
function add(w,pairs,amount){if(amount<=0||!pairs)return;for(const [key,share]of pairs)w[GROUND_LAYER_INDEX[key]]+=share*amount;}
// Turf varies in patches: each component's share swells or shrinks with its own broad noise.
function turf(w,pairs,x,z,amount){
  let total=0;const shares=pairs.map(([key,share],k)=>{const s=share*(.25+1.5*noise(x*.045+k*7.3,z*.045-k*3.1,53+k));total+=s;return [key,s];});
  for(const [key,s]of shares)w[GROUND_LAYER_INDEX[key]]+=s/total*amount;
}

/** The map's extent: the ground's square, capped at SPLAT_MAX_SIDE texels a side. */
export function splatGrid({minX,minZ,maxX,maxZ},resolution=SPLAT_TEXELS_PER_METRE){
  const step=Math.max(1/resolution,(maxX-minX)/SPLAT_MAX_SIDE,(maxZ-minZ)/SPLAT_MAX_SIDE),nx=Math.ceil((maxX-minX)/step),nz=Math.ceil((maxZ-minZ)/step);
  return {minX,minZ,maxX:minX+nx*step,maxZ:minZ+nz*step,nx,nz,step};
}

/**
 * The splat map, in steps (each yield is one row: a time-sliced build may give
 * the page a turn). Returns {nx,nz,minX,minZ,maxX,maxZ,step,data}: data holds
 * three RGBA layers of nx × nz texels, layer after layer.
 * - e: the encounter's snapshot (width, height, terrain); biome: GROUND_BIOMES entry;
 * - height(x,z): the ground's height; road: createRoadSurfaceSampler's result;
 * - route(x,z): a staged precinct route's weight; damp(x,z): the distant river's bank;
 * - training: the fort's yard, worn all over; bounds: the ground's square.
 */
export function* buildTerrainSplat({e,tileSize=2.5,biome,height,road=null,route=()=>0,damp=()=>0,architecture=null,training=false,bounds}){
  const grid=splatGrid(bounds),{nx,nz,step,minX,minZ}=grid,data=new Uint8Array(nx*nz*SPLAT_CHANNELS);
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2,w=new Float32Array(SPLAT_CHANNELS);
  // Heights at the texel corners: slopes come from neighbours, not four more samples.
  const heights=new Float32Array((nx+1)*(nz+1));
  for(let iz=0;iz<=nz;iz++){for(let ix=0;ix<=nx;ix++)heights[iz*(nx+1)+ix]=height(minX+ix*step,minZ+iz*step);if(iz%32===31)yield;}
  const corner=(ix,iz)=>heights[Math.min(nz,Math.max(0,iz))*(nx+1)+Math.min(nx,Math.max(0,ix))];
  for(let iz=0;iz<nz;iz++){
    for(let ix=0;ix<nx;ix++){
      const x=minX+(ix+.5)*step,z=minZ+(iz+.5)*step;w.fill(0);
      // Cell edges wander by up to half a metre, so no straight seam follows the grid.
      const wx=x+(noise(x*.55,z*.55,61)-.5)*1.1,wz=z+(noise(x*.55+9.1,z*.55-4.7,67)-.5)*1.1,inside=isPlayable(wx,wz,e,tileSize);
      const cell=inside?worldToGrid(wx,wz,e,tileSize):null,type=inside?terrainAt(e,Math.min(e.width-1,Math.max(0,cell.x)),Math.min(e.height-1,Math.max(0,cell.y))):'grass';
      const role=SPLAT_ROLES[type]??'turf';
      if(role==='turf')turf(w,biome.turf,x,z,1);else add(w,biome[role],1);
      // Wear: scattered trodden patches, the fort's yard, staged routes and the river's bank.
      const yard=training?1-smooth(Math.max(Math.abs(x)-hx+.8,Math.abs(z)-hz+.8)/2.7):0;
      const wear=role==='turf'?(training?yard*(.72+noise(x*.23,z*.23,8)*.18):Math.pow(noise(x*.19,z*.19,31),2)*.48):0;
      add(w,biome.worn,wear+route(x,z)*.78);add(w,biome.wet,damp(x,z)*.42);
      if(architecture){
        const contact=architecture(x,z);
        add(w,biome.rubble,contact.footing*1.8);add(w,biome.worn,contact.wear*1.6);add(w,biome.wet,contact.damp);
      }
      // Steep relief near the board shows bare earth and stone.
      const i0=ix,i1=ix+1,j0=iz,j1=iz+1,slope=Math.hypot((corner(i1,j0)+corner(i1,j1)-corner(i0,j0)-corner(i0,j1))/2,(corner(i0,j1)+corner(i1,j1)-corner(i0,j0)-corner(i1,j0))/2)/step;
      const near=1-smooth((Math.max(Math.abs(x)-hx,Math.abs(z)-hz)-16)/6),bank=smooth(slope*.9)*.75*near;
      add(w,biome.bank,bank*2);
      // The road's tread replaces what lies under it; its verge is worn. Never up a bank.
      if(road&&!training){
        const surface=road.sample(x,z),tread=clamp(surface.opacity/.78)*(1-smooth((slope-.35)*3));
        if(tread>0){let total=0;for(let k=0;k<LAYERS;k++)total+=w[k];for(let k=0;k<LAYERS;k++)w[k]*=1-tread;add(w,biome.road,total*tread);}
        add(w,biome.worn,surface.verge*.5*(1-tread));
      }
      let total=0;for(let k=0;k<LAYERS;k++)total+=w[k];
      // Quantise so the bytes sum to 255 exactly: the largest remainders take the spare units.
      const at=iz*nx+ix,bytes=new Array(LAYERS);let used=0;
      for(let k=0;k<LAYERS;k++){const v=w[k]/total*255;bytes[k]=Math.floor(v);used+=bytes[k];w[k]=v-bytes[k];}
      for(let spare=255-used;spare>0;spare--){let best=0;for(let k=1;k<LAYERS;k++)if(w[k]>w[best])best=k;bytes[best]++;w[best]=-1;}
      for(let k=0;k<LAYERS;k++)data[(Math.floor(k/4)*nx*nz+at)*4+k%4]=bytes[k];
    }
    yield;
  }
  return {...grid,data};
}

/** The weights at a world point, 0–1 by layer key (tests and diagnostics; nearest texel). */
export function splatWeights(splat,x,z){
  const ix=Math.min(splat.nx-1,Math.max(0,Math.floor((x-splat.minX)/splat.step))),iz=Math.min(splat.nz-1,Math.max(0,Math.floor((z-splat.minZ)/splat.step))),at=iz*splat.nx+ix;
  return Object.fromEntries(GROUND_LAYERS.map((layer,k)=>[layer.key,splat.data[(Math.floor(k/4)*splat.nx*splat.nz+at)*4+k%4]/255]));
}
