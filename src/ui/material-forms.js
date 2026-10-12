// Compact natural/masonry silhouettes. Coordinates are local world pixels.
const poly=(c,p,color)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();};
const line=(c,p,color,width=1)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const oval=(c,x,y,rx,ry,color)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();};

export function stoneOutcrop(c,scale=1,variant=0){
  c.save();c.scale(scale,scale);oval(c,5,4,24,6,'#25352d38');
  for(const [x,y,w,h] of [[-10,1,15,18],[9,5,12,12],[-21,5,7,7]]){
    const v=Math.sin(variant*3+x)*1.5;
    poly(c,[[x-w,y],[x-w*.8,y-h*.64],[x-w*.24,y-h],[x+w*.43,y-h+v],[x+w,y-h*.48],[x+w*.82,y+2],[x+w*.16,y+5]],'#828879');
    poly(c,[[x-w,y],[x-w*.8,y-h*.64],[x-w*.24,y-h],[x+w*.43,y-h+v],[x+w*.25,y-h*.42],[x-w*.16,y-2]],'#c1bea6');
    poly(c,[[x+w*.25,y-h*.42],[x+w*.43,y-h+v],[x+w,y-h*.48],[x+w*.82,y+2],[x+w*.16,y+5]],'#69766b');
    line(c,[[x-w*.69,y-h*.6],[x-w*.2,y-h*.84],[x+w*.34,y-h*.84+v]],'#e0d6ba9c',.85);
    line(c,[[x-w*.1,y-h*.6],[x+w*.05,y-h*.3],[x+w*.42,y-h*.2]],'#72796780',.7);
  }c.restore();
}

export function masonryWall(c,scale=1){
  c.save();c.scale(scale,scale);oval(c,10,5,28,7,'#25372938');
  // Worn capped rampart: the ground footprint is the same wall rule cell.
  poly(c,[[-23,-6],[2,7],[2,-21],[-23,-34]],'#aeaa8c');
  poly(c,[[2,7],[23,-4],[23,-32],[2,-21]],'#757e69');
  poly(c,[[-23,-34],[-18,-39],[-3,-44],[3,-43],[23,-32],[19,-28],[2,-21]],'#d9cfb4');
  for(let row=0;row<3;row++){
    const y=-1-row*9;
    line(c,[[-23,y-13],[2,y],[23,y-11]],'#525f5059',.8);
    for(const side of [-1,1]){
      const x=side*(row%2?14:9),yy=y-Math.abs(x)*.52;
      line(c,[[2+x,yy],[2+x,yy-8]],side<0?'#6c725b77':'#53655380',.8);
      line(c,[[2+x+1,yy-1],[2+x+1,yy-7]],'#ded3b53b',.6);
    }
  }
  line(c,[[-21,-34],[-3,-42],[19,-31]],'#f4e5c59c',1.1);
  line(c,[[3,-20],[3,5]],'#d4cfb17a',1);
  poly(c,[[-18,-36],[-15,-33],[-9,-36],[-12,-39]],'#b4ae93');
  poly(c,[[13,-7],[17,-10],[18,-17],[15,-14]],'#5369524d');c.restore();
}

export function palmTree(c,s=1){
  c.save();c.scale(s,s);oval(c,8,4,24,6,'#34443129');
  c.beginPath();c.moveTo(-2,2);c.bezierCurveTo(1,-13,0,-28,5,-45);c.strokeStyle='#9f8157';c.lineWidth=5;c.stroke();
  c.beginPath();c.moveTo(-3,2);c.bezierCurveTo(0,-15,0,-30,4,-44);c.strokeStyle='#c1a374';c.lineWidth=1.7;c.stroke();
  for(let i=0;i<5;i++)line(c,[[i*.65-2,-6-i*7],[i*.65+2,-8-i*7]],'#715c425e',.9);
  for(let i=0;i<6;i++){
    const angle=i*Math.PI/3,x=Math.cos(angle)*30,y=Math.sin(angle)*11-36,cx=x*.45+4,cy=-55+Math.sin(angle)*7;
    c.beginPath();c.moveTo(4,-44);c.quadraticCurveTo(cx,cy,x+4,y);c.quadraticCurveTo(x*.55+4,y*.5-20,4,-44);c.fillStyle=i%2?'#81905d':'#536f4c';c.fill();
    c.beginPath();c.moveTo(4,-44);c.quadraticCurveTo(cx,cy,x+4,y);c.strokeStyle='#b4b580a3';c.lineWidth=.8;c.stroke();
    for(let j=1;j<4;j++){const t=j/4,xx=4+x*t,yy=-44+(y+44)*t-11*Math.sin(t*Math.PI);line(c,[[xx,yy],[xx-x*.09,yy+4]],'#415f4680',.8);}
  }c.restore();
}
