// Low ground detail only. Adjacency follows authored terrain, never passability guesses.
import {hash,iso} from './world-art.js';
const WET=new Set(['water','river','deepwater','ford','marsh']);
const PAVED=new Set(['road','gate','stone','chamber']);
const BLOCK=new Set(['rock','wall']);
const typeAt=(e,x,y)=>{const t=e.terrain?.[y]?.[x];return typeof t==='string'?t:t?.type||'grass';};
const valid=e=>Number.isInteger(e?.width)&&Number.isInteger(e?.height)&&e.width>0&&e.height>0&&e.width<=16&&e.height<=16;
const poly=(c,points,color)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(color){c.fillStyle=color;c.fill();}};
const stroke=(c,points,color,width=1)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const shift=(p,n,a)=>({x:p.x+n.x*a,y:p.y+n.y*a});
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});

export function terrainDetailPlan(e,chapter=1,quality='balanced'){
  const plan={seams:[],tracks:[],patches:[],chamber:e?.kind==='contest',quality};
  if(!valid(e))return plan;
  const detail=quality==='performance'?0:quality==='high'?3:2;
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++){
    const type=typeAt(e,x,y);
    for(const [dx,dy] of [[1,0],[0,1]]){
      if(x+dx>=e.width||y+dy>=e.height)continue;
      const other=typeAt(e,x+dx,y+dy),wet=WET.has(type),otherWet=WET.has(other);
      if(wet!==otherWet&&!BLOCK.has(type)&&!BLOCK.has(other))plan.seams.push({x,y,dx,dy,kind:type==='marsh'||other==='marsh'?'mud':'shore',wet:wet?1:-1});
      else if(!wet&&!otherWet&&PAVED.has(type)!==PAVED.has(other)&&!BLOCK.has(type)&&!BLOCK.has(other))plan.seams.push({x,y,dx,dy,kind:'verge'});
      if(detail&&['road','gate'].includes(type)&&['road','gate'].includes(other))plan.tracks.push({x,y,dx,dy});
    }
    if(!detail||plan.chamber||BLOCK.has(type)||['water','river','deepwater','ford','stone','chamber','road','gate'].includes(type))continue;
    for(let i=0;i<detail;i++){
      // Paired peripheral quadrants leave the unit base and tile centre quiet.
      const angle=(i+hash(x,y,chapter))*Math.PI*2/detail;
      plan.patches.push({x:x+Math.cos(angle)*.28,y:y+Math.sin(angle)*.28,kind:type==='marsh'?'reeds':[5,6,9].includes(chapter)||type==='sand'?'gravel':'grass',seed:x*31+y*13+i});
    }
  }
  return plan;
}

export function drawTerrainDetail(c,g,e,p={},chapter=1,quality='balanced'){
  if(!valid(e)||![g?.tw,g?.th,g?.ox,g?.oy].every(Number.isFinite)||g.tw<=0||g.th<=0)return;
  const plan=terrainDetailPlan(e,chapter,quality),s=Math.min(1.5,g.tw/60);
  c.save();poly(c,[iso(g,-.5,-.5),iso(g,e.width-.5,-.5),iso(g,e.width-.5,e.height-.5),iso(g,-.5,e.height-.5)]);c.clip();
  for(const edge of plan.seams){
    const {x,y,dx,dy,kind,wet}=edge;
    const a=iso(g,x+.5,y+(dx ? -.5 : .5)),b=iso(g,x+(dx ? .5 : -.5),y+.5);
    const n={x:(dx-dy)*g.tw*.5,y:(dx+dy)*g.th*.5};
    const mid=mix(a,b,.5),jitter=(hash(x,y,chapter)-.5)*.05;
    if(kind==='verge'){
      poly(c,[shift(a,n,-.075),shift(mid,n,-.10+jitter),shift(b,n,-.075),shift(b,n,.075),shift(mid,n,.10+jitter),shift(a,n,.075)],p.chamber?'#81735717':'#a6956540');
      if(quality!=='performance')stroke(c,[shift(a,n,.02),shift(mid,n,jitter),shift(b,n,-.02)],'#e5d3a843',.6*s);
    }else{
      const toward={x:-n.x*wet,y:-n.y*wet};
      // The brighter lip stays on land, the dark bank and thin reflection on water.
      poly(c,[shift(a,toward,-.09),shift(mid,toward,-.11+jitter),shift(b,toward,-.09),shift(b,toward,.10),shift(mid,toward,.13+jitter),shift(a,toward,.10)],kind==='mud'?'#75815c5c':'#81795370');
      stroke(c,[shift(a,toward,-.025),shift(mid,toward,-.05+jitter),shift(b,toward,-.025)],kind==='mud'?'#aeba8845':'#dfce9d87',Math.max(.5,1.4*s));
      if(quality!=='performance')stroke(c,[shift(mix(a,b,.13),toward,.12),shift(mid,toward,.15+jitter),shift(mix(a,b,.89),toward,.12)],'#d9e5cb58',Math.max(.4,.8*s));
    }
  }
  for(const road of plan.tracks){
    const a=iso(g,road.x,road.y),b=iso(g,road.x+road.dx,road.y+road.dy),n={x:road.dy?g.tw*.035:-g.tw*.035,y:g.th*.035};
    for(const sign of [-1,1])stroke(c,[shift(a,n,sign),shift(mix(a,b,.48),n,sign*1.2),shift(b,n,sign)],'#80715520',Math.max(.4,.8*s));
  }
  for(const patch of plan.patches){
    const q=iso(g,patch.x,patch.y),v=hash(patch.seed,chapter),r=(1.5+v*2)*s;
    if(patch.kind==='gravel'){
      poly(c,[{x:q.x-r,y:q.y},{x:q.x-r*.25,y:q.y-r*.6},{x:q.x+r,y:q.y-r*.15},{x:q.x+r*.4,y:q.y+r*.35}],v>.5?'#ddcba96b':'#897a5b43');
      stroke(c,[{x:q.x-r,y:q.y},{x:q.x-r*.25,y:q.y-r*.6},{x:q.x+r,y:q.y-r*.15}],'#ebd9b66b',.55*s);
    }else{
      const reeds=patch.kind==='reeds',height=(reeds?4.5:2.2)*s;
      stroke(c,[{x:q.x-3*s,y:q.y+.8*s},{x:q.x+4*s,y:q.y+1.5*s}],reeds?'#304c4823':'#4c5a3621',1.5*s);
      for(let i=0;i<(quality==='high'?3:2);i++)stroke(c,[{x:q.x+(i-1)*1.6*s,y:q.y},{x:q.x+(i-1)*2*s-.8*s,y:q.y-height*(.7+hash(i,patch.seed)*.5)}],i%2?'#a6af6f75':reeds?'#506c5580':'#65774461',Math.max(.45,.65*s));
    }
  }
  if(plan.chamber){
    const inset=.2,ring=[iso(g,-.5+inset,-.5+inset),iso(g,e.width-.5-inset,-.5+inset),iso(g,e.width-.5-inset,e.height-.5-inset),iso(g,-.5+inset,e.height-.5-inset)];
    stroke(c,[...ring,ring[0]],chapter>=11?'#8759485c':'#8b75524d',Math.max(.7,2.5*s));
    if(quality!=='performance')for(let i=0;i<4;i++)for(let j=0;j<12;j++){
      const a=mix(ring[i],ring[(i+1)%4],j/12+.018),b=mix(ring[i],ring[(i+1)%4],j/12+.045);
      stroke(c,[a,b],j%2?'#ede0bd80':'#554b4533',Math.max(.6,1.6*s));
    }
  }
  c.restore();
}
