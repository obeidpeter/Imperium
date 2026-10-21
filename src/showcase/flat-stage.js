// The real-time field in the 2D view (build brief "2D view parity"): the same
// world drawn on a canvas in the 0.38 view's isometric projection, on the
// encounter's fine map. It offers the field what the 3D stage does — picking,
// a camera that follows, zoom, the overview, live drawing every frame — so
// every command, key, list and readout works the same in both views.
// Presentation only: the world is read, never written.

const TILE=2.5,FALL_TICKS=16,FLOAT_MS=1300;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const GROUND={grass:'#6d7b48',road:'#a08a68',marsh:'#56685b',sand:'#c3ab79',rock:'#77736a',ford:'#6a8b8b',river:'#466a79',high:'#8b8a5c',wall:'#5f5446',
  stone:'#b8b09d',camp:'#8d7f5f',floor:'#a99b81',bench:'#8a6e4d',chamber:'#a99b81'};
const RAISED={wall:1.1,rock:.8,high:.45};
const SIDE={player:'#9fd3d0',ally:'#9fd3d0',neutral:'#e6dfc8',enemy:'#ef8f74'};
const BODY={player:'#c9b27c',ally:'#b7a57a',neutral:'#cdbf9f',enemy:'#9a5a45'};

export class FlatStage{
  constructor(canvas,{onFrame=()=>{}}={}){
    this.canvas=canvas;this.flat=true;this.ctx=canvas.getContext('2d');this.onFrame=onFrame;this.live=null;this.cameraView='follow';this.selected='hero';
    this.focusMode=true;this.zoomLevel=1;this.point=null;this.paused=false;this.disposed=false;this.ready=Promise.resolve();this.revealed=true;this.quality='balanced';
    this.reducedMotion=false;this.sound=null;this.terrain=null;
    // The 2D view does not turn: the arrow keys keep their screen directions (up is north-west on the board).
    this.orbit={pitch:.87,distance:12,target:{x:0,y:0,z:0},get yaw(){return Math.PI/4;},set yaw(_){}};
    this.resize=new ResizeObserver(()=>{this.terrain=null;});this.resize.observe(canvas);
    this.frame=requestAnimationFrame(t=>this.tick(t));
  }
  setLive(source){this.live=source??null;}
  sync(encounter){this.encounter=encounter;}
  wake(){}rebuildRemains(){}applyQuality(q){this.quality=q;}setAudio(){}setReducedMotion(v){this.reducedMotion=!!v;}setPaused(v){this.paused=!!v;}
  zoom(delta){this.zoomLevel=clamp(this.zoomLevel*(delta<0?1.18:1/1.18),.45,3);this.terrain=null;}
  home(){this.cameraView='overview';this.terrain=null;}
  horizon(){}
  focusPoint(tile){this.cameraView='point';this.point={x:(tile.x+.5)*TILE,z:(tile.y+.5)*TILE};}
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resize.disconnect();}
  tick(now){
    this.frame=requestAnimationFrame(t=>this.tick(t));
    if(this.disposed||document.hidden||this.paused)return;
    this.live?.beforeFrame?.(now);const start=performance.now();this.draw(now);this.onFrame(performance.now()-start);
  }
  // The view: tile size and centre for this frame.
  view(world){
    const r=this.canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height),overview=this.cameraView==='overview';
    const span=world.map.width+world.map.height,fit=Math.min(w/(span/2),h/(span/4))*.95;
    const tw=overview?fit:Math.max(fit,Math.min(w,h)/9)*this.zoomLevel,th=tw/2;
    const hero=world.actors.find(a=>a.id===world.controlled),alpha=this.live?.alpha?.()??1;
    const c=overview?{x:world.map.width*TILE/2,z:world.map.height*TILE/2}:this.cameraView==='point'&&this.point?this.point
      :hero?{x:lerp(hero.px,hero.x,alpha),z:lerp(hero.pz,hero.z,alpha)}:{x:0,z:0};
    return {w,h,tw,th,cu:c.x/TILE,cv:c.z/TILE,cx:w/2,cy:h/2};
  }
  // Metres on the map to the canvas, and back.
  screen(v,x,z){const u=x/TILE,t=z/TILE;return {x:v.cx+((u-t)-(v.cu-v.cv))*v.tw/2,y:v.cy+((u+t)-(v.cu+v.cv))*v.th/2};}
  ground(v,sx,sy){const a=(sx-v.cx)/(v.tw/2),b=(sy-v.cy)/(v.th/2);return {x:((a+b)/2+v.cu)*TILE,z:((b-a)/2+v.cv)*TILE};}
  pickPoint(event){
    const world=this.live?.world?.();if(!world)return {unitId:null,ground:null};
    const r=this.canvas.getBoundingClientRect(),v=this.lastView??this.view(world),sx=event.clientX-r.left,sy=event.clientY-r.top;
    const g=this.ground(v,sx,sy);let unitId=null,best=-Infinity;
    for(const a of world.actors){
      if(!a.alive||a.hidden&&a.side==='enemy')continue;const p=this.screen(v,a.x,a.z),hgt=v.th*3.1;
      if(Math.abs(sx-p.x)<=v.tw*.32&&sy<=p.y+v.th*.35&&sy>=p.y-hgt&&a.x+a.z>best){best=a.x+a.z;unitId=a.id;}
    }
    return {unitId,ground:{x:g.x-world.map.width*TILE/2,z:g.z-world.map.height*TILE/2}};
  }
  // The board's ground, drawn once for this tile size and kept.
  terrainImage(world,v){
    const key=`${world.map.width}x${world.map.height}:${v.tw.toFixed(2)}:${world.map.id}`;if(this.terrain?.key===key)return this.terrain;
    const W=world.map.width,H=world.map.height,pad=v.tw*2,width=(W+H)*v.tw/2+pad*2,height=(W+H)*v.th/2+pad*2+v.th*2;
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);const c=canvas.getContext('2d');
    const at=(u,t)=>({x:pad+(u-t+H)*v.tw/2,y:pad+v.th*2+(u+t)*v.th/2});
    for(let t=0;t<H;t++)for(let u=0;u<W;u++){
      const type=world.map.terrain[t][u],p=at(u,t),q=at(u+1,t),r=at(u+1,t+1),s=at(u,t+1),lift=(RAISED[type]??0)*v.th;
      c.beginPath();c.moveTo(p.x,p.y-lift);c.lineTo(q.x,q.y-lift);c.lineTo(r.x,r.y-lift);c.lineTo(s.x,s.y-lift);c.closePath();
      c.fillStyle=GROUND[type]??GROUND.grass;c.fill();c.strokeStyle='#00000018';c.stroke();
      if(lift){c.fillStyle='#00000040';c.beginPath();c.moveTo(s.x,s.y-lift);c.lineTo(r.x,r.y-lift);c.lineTo(r.x,r.y);c.lineTo(s.x,s.y);c.closePath();c.fill();
        c.fillStyle='#00000026';c.beginPath();c.moveTo(r.x,r.y-lift);c.lineTo(q.x,q.y-lift);c.lineTo(q.x,q.y);c.lineTo(r.x,r.y);c.closePath();c.fill();}
    }
    // Where map tile (0,0)'s top corner lands on the image.
    this.terrain={key,canvas,origin:at(0,0)};return this.terrain;
  }
  draw(now){
    const world=this.live?.world?.();if(!world)return;
    const r=this.canvas.getBoundingClientRect(),d=Math.min(globalThis.devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
    if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;
    const c=this.ctx;c.setTransform(d,0,0,d,0,0);c.fillStyle='#1b211d';c.fillRect(0,0,r.width,r.height);
    const v=this.view(world);this.lastView=v;const img=this.terrainImage(world,v),o=this.screen(v,0,0);
    c.drawImage(img.canvas,o.x-img.origin.x,o.y-img.origin.y);
    this.live?.draw?.(c,v,this,now);
  }
}

// What the 2D view draws of the world each frame: the figures (allegiance by
// ring shape: a full ring for friends, a spiked one for enemies, a dashed one
// for neutrals), the route, the target, ranges, work, missiles and the marks
// and numbers over people's heads. The field's presenter interface.
export function createFlatPresenter(stage,{world:getWorld,alpha:getAlpha,beforeFrame=()=>{}}={}){
  let route=null,planned=null,ranges=false,marks={},selection=[],marker=null;const floating=new Map(),volleys=[];
  const presenter={
    beforeFrame,world:getWorld,alpha:getAlpha,
    setRoute(next){route=next;},setPlanned(next){planned=next;},setRanges(on){ranges=!!on;},setMarks(next){marks={...(next??{})};},
    // The squads selected on the page, and the keyboard's order marker (squad-control.js).
    setSelection(ids){selection=[...(ids??[])];},setMarker(point){marker=point?{x:point.x,z:point.z}:null;},
    onEvents(events){
      const now=performance.now();
      for(const e of events){
        if(e.kind==='hit')floating.set(e.defenderId,{text:`−${e.damage}${e.critical?'!':''}`,color:e.critical?'#ffcf6e':'#ffb39a',until:now+FLOAT_MS});
        if(e.kind==='block')floating.set(e.defenderId,{text:'Blocked',color:'#d6e3e8',until:now+FLOAT_MS});
        if(e.kind==='miss')floating.set(e.defenderId,{text:'Miss',color:'#cfd2cc',until:now+FLOAT_MS});
        if(e.kind==='heal')floating.set(e.targetId,{text:`+${e.amount}`,color:'#b8e0a8',until:now+FLOAT_MS});
        // A squad's volley: a flight of arrows from its ranks to the target squad.
        if(e.kind==='exchange'&&e.ranged)volleys.push({from:{x:e.fromX,z:e.fromZ},to:{x:e.x,z:e.z},start:now});
        if(e.kind==='fall'&&e.squadId){const f=floating.get(e.squadId),n=f?.until>now&&f.men?f.men+1:1;
          floating.set(e.squadId,{text:`−${n} ${n===1?'man':'men'}`,color:'#ffb39a',until:now+FLOAT_MS,men:n});}
      }
    },
    dispose(){},
    draw(c,v,flat,now){
      const w=getWorld(),alpha=getAlpha(),r=w.tick-1+alpha,hero=w.actors.find(a=>a.id===w.controlled);
      const chosen=new Set(selection),squadsById=new Map((w.squads??[]).map(q=>[q.id,q]));
      const at=a=>flat.screen(v,lerp(a.px??a.x,a.x,alpha),lerp(a.pz??a.z,a.z,alpha));
      const ellipse=(p,rx,stroke,{dash=null,width=2,fill=null}={})=>{c.beginPath();c.ellipse(p.x,p.y,rx,rx/2,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}
        if(stroke){c.setLineDash(dash??[]);c.lineWidth=width;c.strokeStyle=stroke;c.stroke();c.setLineDash([]);}};
      const line=(points,color,{dash=null,width=2}={})=>{if(points.length<2)return;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));
        c.setLineDash(dash??[]);c.lineWidth=width;c.strokeStyle=color;c.stroke();c.setLineDash([]);};
      const unit=v.tw/TILE;// pixels per metre along the board
      // Objectives and objects.
      if(w.mission?.goal)ellipse(flat.screen(v,w.mission.goal.x,w.mission.goal.z),(w.mission.radius??2.5)*unit*.7,'#f1d38a',{dash:[6,4]});
      for(const o of w.objects??[]){const p=flat.screen(v,o.x,o.z);c.fillStyle=o.done&&!o.toggle?'#6b6050':'#c49a4f';c.fillRect(p.x-v.tw*.12,p.y-v.th*1.1,v.tw*.24,v.th*1.1);
        c.font=`600 ${Math.max(10,v.th*.42)}px system-ui`;c.textAlign='center';c.fillStyle='#f6efdb';c.fillText(o.name,p.x,p.y-v.th*1.3);}
      // The route a click would walk, and what the soldier will do on resume.
      if(route?.points?.length&&hero?.alive)line([at(hero),...route.points.map(p=>flat.screen(v,p.x,p.z))],'#f1dfa2',{dash:[8,5]});
      if(planned?.points?.length&&hero?.alive)line([at(hero),...planned.points.map(p=>flat.screen(v,p.x,p.z))],'#cfe7e488',{dash:[4,6]});
      // Figures, back to front.
      const shown=[...w.actors].filter(a=>!(a.hidden&&a.side==='enemy')&&(a.alive||r-a.diedAt<FALL_TICKS*6||a.loot?.length)).sort((a,b)=>(a.x+a.z)-(b.x+b.z));
      for(const a of shown){
        let p=at(a);const carrier=a.carriedBy?w.actors.find(x=>x.id===a.carriedBy):null;if(carrier){const q=at(carrier);p={x:q.x+v.tw*.18,y:q.y-v.th*1.2};}
        const lying=!a.alive||a.down||carrier,side=a.side;
        if(a.alive&&!carrier){
          if(side==='enemy'){ellipse(p,v.tw*.28,SIDE.enemy,{width:2});for(let i=0;i<8;i++){const t=i/8*Math.PI*2;c.beginPath();c.moveTo(p.x+Math.cos(t)*v.tw*.28,p.y+Math.sin(t)*v.tw*.14);
            c.lineTo(p.x+Math.cos(t)*v.tw*.36,p.y+Math.sin(t)*v.tw*.18);c.strokeStyle=SIDE.enemy;c.stroke();}}
          else ellipse(p,v.tw*.28,SIDE[side]??SIDE.player,{dash:side==='neutral'?[4,4]:null,width:2});
          if(a.id===w.controlled)ellipse(p,v.tw*.36,'#f1d38a',{width:2.5});
          if(a.squadId&&chosen.has(a.squadId))ellipse(p,v.tw*.36,'#f3d48d',{width:2.5});
          if(a.braceUntil>r||squadsById.get(a.squadId)?.braced)ellipse(p,v.tw*.42,'#f1d38a',{dash:[2,3],width:2});
        }
        const color=!a.alive?'#4a4038':a.down?'#857868':BODY[side]??BODY.neutral;
        if(lying){c.beginPath();c.ellipse(p.x,p.y-v.th*.15,v.tw*.3,v.th*.22,0,0,Math.PI*2);c.fillStyle=color;c.fill();}
        else{
          const hgt=v.th*2.6,body=v.tw*.14;c.fillStyle='#00000040';c.beginPath();c.ellipse(p.x,p.y,body*1.6,body*.7,0,0,Math.PI*2);c.fill();
          c.fillStyle=color;c.beginPath();c.roundRect?.(p.x-body,p.y-hgt*.82,body*2,hgt*.72,body);if(!c.roundRect)c.rect(p.x-body,p.y-hgt*.82,body*2,hgt*.72);c.fill();
          c.beginPath();c.arc(p.x,p.y-hgt*.9,body*.85,0,Math.PI*2);c.fillStyle='#e0c4a4';c.fill();
          // His facing, and a drawn weapon on that side.
          const f=flat.screen(v,a.x+(a.fx??1)*.9,a.z+(a.fz??0)*.9),fp=flat.screen(v,a.x,a.z),dx=f.x-fp.x,dy=f.y-fp.y;
          c.beginPath();c.moveTo(p.x,p.y-hgt*.45);c.lineTo(p.x+dx,p.y-hgt*.45+dy);c.lineWidth=a.drawn?3:1.5;c.strokeStyle=a.drawn?'#e8e4da':'#00000066';c.stroke();
          // Health over his head (a squad's strength is at its standard).
          if(!a.squadId){const bw=v.tw*.5;c.fillStyle='#0d1715cc';c.fillRect(p.x-bw/2,p.y-hgt*1.18,bw,4);c.fillStyle=side==='enemy'?'#db9e81':'#abc89a';
            c.fillRect(p.x-bw/2,p.y-hgt*1.18,bw*clamp(a.hp/a.maxHp,0,1),4);}
          // Work in hand fills a ring.
          if(a.action?.kind==='work'){const k=clamp((r-a.action.start)/Math.max(1,a.action.end-a.action.start),0,1);c.beginPath();
            c.ellipse(p.x,p.y,v.tw*.46,v.tw*.23,0,-Math.PI/2,-Math.PI/2+k*Math.PI*2);c.strokeStyle='#f1d38a';c.lineWidth=3;c.stroke();}
        }
        // Names: his own, the target's, and everyone's in camp.
        const named=a.id===w.controlled||a.id===hero?.lock||w.kind==='camp'||w.party?.includes(a.id);
        const tag=(floating.get(a.id)?.until>now&&floating.get(a.id))||marks[a.id]||noticeMark(w,a);
        c.textAlign='center';
        if(named&&a.alive){c.font=`650 ${Math.max(10,v.th*.4)}px system-ui`;c.fillStyle='#f6efdb';c.fillText(`${a.id===w.controlled?'★ ':''}${a.name}`,p.x,p.y-v.th*3.3);}
        if(tag){c.font=`800 ${Math.max(12,v.th*.6)}px system-ui`;c.fillStyle=tag.color;c.fillText(tag.text,p.x,p.y-v.th*3.9);}
      }
      // Each squad's standard over its foremost man: its name, strength and morale (an amber
      // ring with a notch when shaken, a crimson ring split in two when broken).
      for(const q of w.squads??[]){
        const lead=squadLead(w,q);if(!lead)continue;const p=at(lead),hgt=v.th*2.6,top=p.y-hgt*1.55,mine=q.side!=='enemy';
        if(q.morale<=40){const rx=v.tw*.62,ry=rx/2;c.lineWidth=3;c.strokeStyle=q.broken?'#c8323f':'#e0a23a';
          for(const [a0,a1]of q.broken?[[.18,Math.PI-.18],[Math.PI+.18,Math.PI*2-.18]]:[[-Math.PI/2+.3,Math.PI*1.5-.3]]){c.beginPath();c.ellipse(p.x,p.y,rx,ry,0,a0,a1);c.stroke();}}
        c.beginPath();c.moveTo(p.x+v.tw*.18,p.y-hgt*.2);c.lineTo(p.x+v.tw*.18,top);c.lineWidth=2;c.strokeStyle='#3b2f22';c.stroke();
        c.fillStyle=mine?'#7a2a1f':'#5b3a2c';c.fillRect(p.x+v.tw*.18,top,v.tw*.34,v.th*.55);if(chosen.has(q.id)){c.lineWidth=2;c.strokeStyle='#f3d48d';c.strokeRect(p.x+v.tw*.18,top,v.tw*.34,v.th*.55);}
        const bw=v.tw*.6;c.fillStyle='#0d1715cc';c.fillRect(p.x-bw/2,top-7,bw,4);c.fillStyle=mine?'#abc89a':'#db9e81';c.fillRect(p.x-bw/2,top-7,bw*clamp(q.strength/q.maxStrength,0,1),4);
        c.textAlign='center';if(mine||chosen.has(q.id)){c.font=`650 ${Math.max(10,v.th*.38)}px system-ui`;c.fillStyle='#f6efdb';c.fillText(q.name,p.x,top-10);}
        const tag=(floating.get(q.id)?.until>now&&floating.get(q.id))||(q.morale<=40&&{text:'!',color:q.broken?'#ff8f8f':'#f1c27d'});
        if(tag){c.font=`800 ${Math.max(12,v.th*.6)}px system-ui`;c.fillStyle=tag.color;c.fillText(tag.text,p.x,top-10-Math.max(12,v.th*.5));}
      }
      // The keyboard's order marker, and where each selected squad is going (or whom it attacks).
      if(marker&&chosen.size){const p=flat.screen(v,marker.x,marker.z);ellipse(p,v.tw*.34,'#f3d48d',{width:3});ellipse(p,v.tw*.07,null,{fill:'#f3d48d'});}
      for(const id of selection){
        const q=squadsById.get(id),lead=q&&squadLead(w,q);if(!lead)continue;const order=q.pending?.order??q.order;if(!order)continue;
        let to=null;if(order.kind==='advance'&&Number.isFinite(order.x))to={x:order.x,z:order.z};
        else if(order.kind==='attack'){const t=squadsById.get(order.targetId),man=t?squadLead(w,t):w.actors.find(a=>a.id===order.targetId&&a.alive);if(man)to={x:man.x,z:man.z};}
        if(to)line([at(lead),flat.screen(v,to.x,to.z)],order.kind==='attack'?'#ef8f74':'#f1dfa2',{dash:[6,5]});
      }
      for(let i=volleys.length-1;i>=0;i--){const k=(now-volleys[i].start)/700;if(k>=1){volleys.splice(i,1);continue;}
        const a=volleys[i].from,b=volleys[i].to,h=Math.sin(Math.PI*k)*v.th*2.2,q=flat.screen(v,lerp(a.x,b.x,k),lerp(a.z,b.z,k)),q0=flat.screen(v,lerp(a.x,b.x,Math.max(0,k-.1)),lerp(a.z,b.z,Math.max(0,k-.1)));
        for(let j=-1;j<=1;j++)line([{x:q0.x+j*v.tw*.12,y:q0.y-v.th*1.2-Math.sin(Math.PI*Math.max(0,k-.1))*v.th*2.2},{x:q.x+j*v.tw*.12,y:q.y-v.th*1.2-h}],'#f5e4bc',{width:1.5});}
      // His locked target, his ranges, and missiles in flight.
      const target=hero?.lock?w.actors.find(a=>a.id===hero.lock&&a.alive):null;if(target)ellipse(at(target),v.tw*.4,'#ef8f74',{width:3});
      if(ranges&&hero?.alive){ellipse(at(hero),1.85*unit,'#f1d38a88');ellipse(at(hero),25*unit,'#9fd3d088',{dash:[6,6]});}
      for(const m of w.projectiles){const k=clamp((r-m.start)/Math.max(1,m.arrive-m.start),0,1),x=lerp(m.fromX,m.toX,k),z=lerp(m.fromZ,m.toZ,k),q=flat.screen(v,x,z),
        b=flat.screen(v,lerp(m.fromX,m.toX,Math.max(0,k-.08)),lerp(m.fromZ,m.toZ,Math.max(0,k-.08)));line([{x:b.x,y:b.y-v.th*1.2},{x:q.x,y:q.y-v.th*1.2}],'#f5e4bc',{width:2});}
      for(const [id,f]of floating)if(now>f.until)floating.delete(id);
    }
  };
  return presenter;
}
// A squad's foremost standing man (the lowest slot), where its standard stands.
function squadLead(w,q){
  let lead=null;for(const id of q.members){const m=w.actors.find(a=>a.id===id);if(m&&m.alive&&!m.down&&!(m.hidden&&m.side==='enemy')&&(!lead||m.slot<lead.slot))lead=m;}
  return lead;
}
// How far an enemy has noticed the party (the 3D view's quarter-filled circle).
function noticeMark(w,a){
  if(a.side!=='enemy'||!a.alive||a.practice||a.squadId)return null;const n=Math.max(0,...[w.heroId,...w.party].map(id=>a.ai?.notice?.[id]??0));
  if(n>=100&&a.ai?.state!=='engage')return {text:'!',color:'#ef8f74'};if(n>0&&n<100)return {text:['◔','◑','◕'][Math.min(2,Math.floor(n/34))],color:n>=50?'#f1c27d':'#e6dfc8'};
  return null;
}
