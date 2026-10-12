// Short, deterministic cues from committed actions. Never a gameplay simulation.
const TAU=Math.PI*2;
const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const point=(g,p)=>({x:g.ox+(p.x-p.y)*g.tw/2,y:g.oy+(p.x+p.y)*g.th/2});
const line=(c,a,b,color,width)=>{c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,TAU);c.fillStyle=color;c.fill();}
function pathPoint(path,t){
  const position=clamp(t)*Math.max(0,path.length-1),index=Math.min(path.length-1,Math.floor(position)),a=path[index],b=path[Math.min(index+1,path.length-1)],fraction=position-index;
  return {x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction};
}
export function projectilePose(effect,g,progress=effect.progress){
  const t=clamp(progress),a=point(g,effect.from),b=point(g,effect.to),s=Math.max(.001,g.tw/60),arc=35*s;
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t-Math.sin(t*Math.PI)*arc-24*s,angle:Math.atan2(b.y-a.y-Math.cos(t*Math.PI)*arc*Math.PI,b.x-a.x),scale:s};
}
// Trailing footfalls sit on the reconstructed passable path, never a direct
// shortcut across a river or an occupied tile. A small fixed count bounds work.
export function footfallSamples(effect,quality='balanced'){
  const path=effect.path?.length?effect.path:[effect.at],t=clamp(effect.progress),count=quality==='performance'?0:quality==='high'?5:3,samples=[];
  for(let i=0;i<count;i++){
    const offset=i*.13,age=offset+.05,sample=t-offset;if(sample<0)continue;
    const travel=sample*sample*(3-2*sample);
    samples.push({...pathPoint(path,travel),age,alpha:(1-age)*Math.sin(Math.PI*t)*.42,side:i%2?1:-1,surface:effect.surfaces?.[Math.round(travel*Math.max(0,path.length-1))]??'earth'});
  }return samples;
}
export function drawBattleEffects(c,g,frame,quality='balanced'){
  const limit=quality==='performance'?6:quality==='high'?22:14,s=Math.max(.001,g.tw/60);
  for(const effect of (frame?.effects??[]).slice(0,limit)){
    if(effect.essential===false&&quality==='performance')continue;
    const q=point(g,effect.at??effect.to??{x:0,y:0}),t=clamp(effect.progress);
    c.save();c.globalAlpha*=clamp(effect.alpha??1);
    if(effect.type==='projectile'&&effect.from&&effect.to){
      const p=projectilePose(effect,g);
      if(quality!=='performance')for(let i=3;i>0;i--){const a=projectilePose(effect,g,t-i*.025),b=projectilePose(effect,g,t-(i-1)*.025);line(c,a,b,`rgba(249,230,186,${.18/i})`,Math.max(.65,1.2*s));}
      c.translate(p.x,p.y);c.rotate(p.angle);
      line(c,{x:-11*s,y:0},{x:8*s,y:0},'#473e30',Math.max(.9,1.8*s));
      line(c,{x:-10*s,y:-.45*s},{x:6*s,y:-.45*s},'#d2b784',Math.max(.55,.7*s));
      c.beginPath();c.moveTo(10*s,0);c.lineTo(5*s,-2.1*s);c.lineTo(6*s,0);c.lineTo(5*s,2.1*s);c.closePath();c.fillStyle='#ede9d4';c.fill();
      if(effect.projectile==='arrow')for(const sign of [-1,1])line(c,{x:-11*s,y:sign*2*s},{x:-6*s,y:0},'#e8d5b2',s);
    }else if(effect.type==='dust'){
      for(const foot of footfallSamples(effect,quality)){
        const p=point(g,foot);c.save();c.globalAlpha*=foot.alpha;
        const ripple=foot.surface==='marsh'||foot.surface==='ford';
        if(ripple){c.beginPath();c.ellipse(p.x,p.y,(4+foot.age*10)*s,(1.6+foot.age*3)*s,0,0,TAU);c.strokeStyle='#dce6cc';c.lineWidth=Math.max(.6,s);c.stroke();}
        else{ellipse(c,p.x+foot.side*3*s,p.y-foot.age*5*s,(2+foot.age*7)*s,(1+foot.age*3)*s,'#cbb58d');ellipse(c,p.x+foot.side*6*s,p.y-foot.age*10*s,(1+foot.age*4)*s,(1+foot.age*2)*s,'#e0cc9f');}
        c.restore();
      }
    }else if(effect.type==='slash'){
      const from=point(g,effect.from),to=point(g,effect.to),angle=Math.atan2(to.y-from.y,to.x-from.x),radius=13*s;
      c.translate(from.x,from.y-25*s);c.rotate(angle);c.beginPath();c.arc(8*s,0,radius,-.9+t*.65,.15+t*.8);c.strokeStyle='#f5e6c17a';c.lineWidth=Math.max(1,2.4*s);c.stroke();
    }else if(effect.type==='impact'||effect.type==='shield'){
      const defended=effect.type==='shield',base=effect.source?point(g,effect.source):{x:q.x-1,y:q.y},direction=Math.atan2(q.y-base.y,q.x-base.x),radius=(4+t*15)*s;
      // A flash at the point of contact, followed by a few directional sparks.
      ellipse(c,q.x,q.y-26*s,(1-t)*5*s,(1-t)*3*s,defended?'#ecf1d9':'#f8e4b4');
      const count=quality==='performance'?3:6;
      for(let i=0;i<count;i++){const a=direction+(i/(count-1)-.5)*2.7;
        line(c,{x:q.x+Math.cos(a)*radius*.48,y:q.y-26*s+Math.sin(a)*radius*.48},{x:q.x+Math.cos(a)*radius,y:q.y-26*s+Math.sin(a)*radius+t*t*6*s},defended?'#d9e6d1':'#f1ca83',Math.max(.65,(1-t)*1.5*s));
      }
      if(defended){c.beginPath();c.ellipse(q.x-5*s,q.y-24*s,(8+t*3)*s,13*s,-.18,-1.9,1.3);c.strokeStyle='#f4f0d0';c.lineWidth=Math.max(.8,(1-t)*2*s);c.stroke();}
    }else if(effect.type==='speech'){
      // Two quiet projected arcs suggest an addressed room, without covering faces.
      const dest=effect.to?point(g,effect.to):{x:q.x+30*s,y:q.y},angle=Math.atan2(dest.y-q.y,dest.x-q.x);
      c.translate(q.x,q.y-28*s);c.rotate(angle);
      for(let i=0;i<2;i++){c.beginPath();c.arc(0,0,(11+t*12+i*6)*s,-.4,.4);c.strokeStyle=i?'#e4d3a67a':'#f6e7c5';c.lineWidth=Math.max(.8,1.4*s);c.stroke();}
    }else{
      c.beginPath();c.ellipse(q.x,q.y,(14+t*13)*s,(6+t*7)*s,0,0,TAU);c.strokeStyle=effect.type==='defeat'?'#a35643':effect.healing?'#9cc0a4':'#c1a466';c.lineWidth=Math.max(.8,2*s);c.stroke();
    }
    c.restore();
  }
}
