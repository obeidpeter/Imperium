import {canopyRadius,treeClearsApproaches} from './environment-composition.js';

// Shared presentation-only weather. Time and the chapter identify a wind field;
// no game random stream, actor state or saved encounter is touched.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function sampleWorldWind(time=0,{chapter=1,weather='clear',reducedMotion=false}={}){
  const t=reducedMotion?0:(Number.isFinite(time)?time%3600:0),c=clamp(Number(chapter)||1,1,12);
  const angle=.36+c*.47,force=weather==='dust'?1.2:weather==='rain'?.92:weather==='embers'?.66:.48;
  const gust=reducedMotion?.65:.74+.18*Math.sin(t*.39+c)+.08*Math.sin(t*1.13+c*.61);
  return {x:Math.cos(angle)*force*gust,z:Math.sin(angle)*force*gust,gust};
}

const REGIONS=[
  ['oak','beech','willow'],['willow','alder'],['oak','beech','pine'],['oak','beech'],
  ['palm','tamarisk'],['tamarisk','palm'],['poplar','cypress','umbrella'],['willow','alder'],
  ['palm','tamarisk'],['fir','pine','beech'],['cypress','umbrella','olive'],['cypress','olive','umbrella']
].map(species=>Object.freeze(species));
export const regionalTreeSpecies=chapter=>REGIONS[clamp(Math.floor(Number(chapter)||1),1,12)-1];
// Principal channel direction, in board/world x-z axes. This is a visual flow
// cue, not hydrology; it cannot change ford movement costs or water depth.
export function waterCurrentDirection(encounter){
  const cells=[];
  for(let z=0;z<(encounter?.height??0);z++)for(let x=0;x<(encounter?.width??0);x++){
    const cell=encounter.terrain?.[z]?.[x],type=typeof cell==='string'?cell:cell?.type;
    if(type==='river'||type==='ford')cells.push([x,z]);
  }
  if(cells.length<2)return {x:1,z:0};
  const mean=cells.reduce((s,p)=>[s[0]+p[0]/cells.length,s[1]+p[1]/cells.length],[0,0]);let xx=0,zz=0,xz=0;
  for(const [x,z]of cells){xx+=(x-mean[0])**2;zz+=(z-mean[1])**2;xz+=(x-mean[0])*(z-mean[1]);}
  const angle=.5*Math.atan2(2*xz,xx-zz);return {x:Math.cos(angle),z:Math.sin(angle)};
}
export function presentationSeed(text=''){
  let seed=2166136261;for(const c of String(text)){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619);}return seed>>>0;
}
const sample=(seed,index)=>{let n=(seed^Math.imul(index+1,0x45d9f3b))>>>0;n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;};

/** Regional framing trees stay beyond the playable rectangle, away from roads,
 * water and authored buildings. A bounded candidate budget is independent of
 * map size; enlarging a battle never fills it with decorative blockers. */
export function regionalTreePlacements({encounter,chapter=1,tileSize=2.5,quality='balanced',civic=false,route=()=>0,height=()=>0,occupied=[]}={}){
  if(civic||!encounter)return [];
  const halfX=encounter.width*tileSize/2,halfZ=encounter.height*tileSize/2;
  const arid=[5,6,9].includes(chapter),max=quality==='performance'?(arid?4:6):quality==='high'?(arid?8:11):(arid?6:9);
  const seed=presentationSeed(`${chapter}:${encounter.id??'world'}`),species=regionalTreeSpecies(chapter),out=[];
  for(let i=0;i<240&&out.length<max;i++){
    const side=i%4,spread=sample(seed,i*5),gap=8+sample(seed,i*5+1)*18;
    const x=side<2?(side===0?-1:1)*(halfX+gap):(spread*2-1)*(halfX+18);
    const z=side>=2?(side===2?-1:1)*(halfZ+gap):(spread*2-1)*(halfZ+18);
    const kind=species[Math.floor(sample(seed,i*5+2)*species.length)],h=(kind==='tamarisk'||kind==='olive'?3.8:5.5)+sample(seed,i*5+3)*(arid?2:3.2);
    const tree={kind,x,z,height:h,seed:(seed+i*13)%10007},radius=canopyRadius(kind,h);
    if(!treeClearsApproaches(tree,{halfX,halfZ})||route(x,z)>.08||height(x,z)<-.45||
      occupied.some(b=>x>b.min[0]-radius&&x<b.max[0]+radius&&z>b.min[2]-radius&&z<b.max[2]+radius)||
      out.some(p=>Math.hypot(x-p.x,z-p.z)<Math.max(5.5,(radius+canopyRadius(p.kind,p.height))*.7)))continue;
    out.push(tree);
  }
  return out;
}
