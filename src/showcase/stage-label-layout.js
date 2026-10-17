// Screen-space presentation only. Stable priority placement keeps names and
// stance badges readable without moving figures or changing legal targets.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const labelsOverlap=(a,b,gap=3)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;

export function layoutStageLabels(items,{width,height,margin=8,top=margin,bottom=margin,obstacles=[]}={}){
  const placed=[],result=new Map();
  // Optional projected figure bounds belong to the caller's current camera.
  // They are screen-space exclusions, never unit positions or legal targets.
  const bodies=obstacles.filter(r=>r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0&&r.x+r.width>margin&&r.x<width-margin&&r.y+r.height>top&&r.y<height-bottom).slice(0,8);
  const ordered=[...items].sort((a,b)=>(b.priority??0)-(a.priority??0)||String(a.id).localeCompare(String(b.id)));
  for(const item of ordered){
    if(!item.visible||!Number.isFinite(item.x+item.y+item.width+item.height)||item.x<0||item.x>width||item.y<0||item.y>height){result.set(item.id,{visible:false,reason:'offscreen'});continue;}
    const w=item.width,h=item.height,maxX=width-margin-w,maxY=height-bottom-h;
    if(maxX<margin||maxY<top){result.set(item.id,{visible:false,reason:'occluded'});continue;}
    const ownBody=bodies.find(r=>r.id===item.id);
    const base={x:item.x-w/2,y:(ownBody?Math.min(item.y,ownBody.y):item.y)-h-9};
    const offsets=[[0,0],[0,-h-7],[-w*.65-8,0],[w*.65+8,0],[-w*.7-8,-h-7],[w*.7+8,-h-7],[0,-2*h-14],[-w-12,-h*.5],[w+12,-h*.5],[0,h+23]];
    // Tiny coordinate quantization avoids subpixel text shimmer while orbiting.
    const candidates=offsets.map(([dx,dy],i)=>({id:item.id,x:Math.round(clamp(base.x+dx,margin,maxX)),y:Math.round(clamp(base.y+dy,top,maxY)),width:w,height:h,cost:Math.hypot(dx,dy)+i*.1}));
    if(ownBody){
      // At the top of the viewport an above-body badge may not fit. A proper
      // side placement is preferable to clamping the badge over the face.
      for(const [x,y]of [[ownBody.x-w-8,ownBody.y+(ownBody.height-h)/2],[ownBody.x+ownBody.width+8,ownBody.y+(ownBody.height-h)/2],[ownBody.x+(ownBody.width-w)/2,ownBody.y+ownBody.height+8]])candidates.push({id:item.id,x:Math.round(clamp(x,margin,maxX)),y:Math.round(clamp(y,top,maxY)),width:w,height:h,cost:Math.hypot(x-base.x,y-base.y)});
      for(const candidate of candidates)if(candidate.y+h>ownBody.y-3)candidate.cost+=1000;
    }
    const fit=candidates.filter(r=>!placed.some(p=>labelsOverlap(r,p))&&!bodies.some(body=>labelsOverlap(r,body,4))).sort((a,b)=>a.cost-b.cost)[0];
    if(!fit){result.set(item.id,{visible:false,reason:'occluded'});continue;}
    placed.push(fit);result.set(item.id,{...fit,visible:true,reason:'visible',anchorX:item.x,anchorY:item.y});
  }
  return result;
}
