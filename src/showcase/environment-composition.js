// Pure presentation geometry. These clearances never become movement blockers,
// change terrain heights or read the campaign's random stream.
export function canopyRadius(kind,height){
  if(kind==='palm')return 5.6;
  if(kind==='cypress')return 1.7;
  if(kind==='pine'||kind==='fir')return height*.44;
  const width={beech:1.1,alder:.72,poplar:.48,umbrella:1.4,olive:1.12,tamarisk:1.05}[kind]??1;
  return height*(.32*width+.18+.15*width)+.8;
}

// Reserve the whole legal rectangle swept toward both the live and classic
// low cameras. Checking a trunk alone lets a seven-metre crown fill the view.
// The ray/rectangle interval is exact; the radius includes the curved sprays.
export function treeClearsApproaches(tree,{halfX,halfZ,yaws=[-.55,-.2,0,.32,.42,.55,.62,.70,.82],distance=34}){
  const radius=canopyRadius(tree.kind,tree.height)+1;
  for(const yaw of yaws){
    let low=0,high=distance;
    for(const [point,direction,half]of [[tree.x,Math.sin(yaw),halfX],[tree.z,Math.cos(yaw),halfZ]]){
      if(Math.abs(direction)<1e-8){if(Math.abs(point)>half+radius){high=-1;break;}continue;}
      const a=(point-half-radius)/direction,b=(point+half+radius)/direction;
      low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));
    }
    if(low<=high)return false;
  }
  return true;
}

const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
/** Reuse the existing ground layers around authored buildings. The footprint
 * and front orientation belong to the same placement used by both model and
 * fallback, so downloaded scenery cannot leave a different patch underneath. */
export function createArchitecturalGroundSampler(placements,{wet=false}={}){
  const buildings=placements.map(p=>({...p,c:Math.cos(p.yaw??0),s:Math.sin(p.yaw??0),
    halfW:p.width/2,halfD:p.depth/2,reach:Math.hypot(p.width,p.depth)/2+4,
    entrance:/gate|arch|portico|store|shelter|tent|pavilion|hall|gallery|granary|awning/.test(p.component),
    drain:/wall|tower|hall|portico|store|granary|gallery|drain|revetment/.test(p.component)}));
  return (x,z)=>{
    let footing=0,wear=0,damp=0;
    for(const b of buildings){
      const dx=x-b.x,dz=z-b.z;if(Math.abs(dx)>b.reach||Math.abs(dz)>b.reach)continue;
      const u=dx*b.c-dz*b.s,v=dx*b.s+dz*b.c;
      const outside=Math.hypot(Math.max(0,Math.abs(u)-b.halfW),Math.max(0,Math.abs(v)-b.halfD));
      // A shallow broken aggregate apron meets the masonry. An irregular outer
      // edge avoids replacing the old hard rectangle with another hard border.
      const edge=.88+.14*Math.sin(u*1.7+v*.6)+.08*Math.sin(v*3.1-u);
      footing=Math.max(footing,(1-smooth(outside/edge))*.85);
      wear=Math.max(wear,(1-smooth(outside/2.5))*.38);
      if(b.entrance&&v>b.halfD-.2){
        const threshold=(1-smooth(Math.abs(u)/Math.min(2.2,b.halfW+.3)))*(1-smooth((v-b.halfD)/3.6));
        wear=Math.max(wear,threshold*.95);
      }
      // Roof runoff leaves a narrow side strip. Wet regions retain damp soil;
      // dry settings show worn aggregate without inventing flowing water.
      if(b.drain){
        const channel=(1-smooth(Math.abs(u-b.halfW-.65)/.48))*(1-smooth(Math.max(0,Math.abs(v)-b.halfD)/1.8));
        wear=Math.max(wear,channel*.65);if(wet)damp=Math.max(damp,channel*.55);
      }
    }
    return {footing,wear,damp};
  };
}
