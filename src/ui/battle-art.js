// Painted, deterministic presentation only. Never reads or advances gameplay RNG.
import {drawUnitSprite,spriteHeight} from './unit-sprites.js';
import {worldGround,scenery,drawScenery,atmosphere} from './world-art.js';
import {idlePose} from './animation-timeline.js';
const INK='#292c27',IVORY='#f4ecd6';
export const FIELD_COLORS={selection:'#175d67',movement:'#277c82',attack:'#9c4036',ally:'#285e62',enemy:'#97382e',neutral:'#886736',objective:'#bd9954'};
const PI=Math.PI;
function polygon(c,points,fill,stroke,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function oval(c,x,y,rx,ry,fill,rotation=0,stroke=null,width=1){c.beginPath();c.ellipse(x,y,rx,ry,rotation,0,PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function line(c,points,color,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function grain(x,y,n=0){const v=Math.sin(x*127.13+y*318.71+n*17.53)*41371.23;return v-Math.floor(v);}
function xy(g,x,y){return {x:g.ox+(x-y)*g.tw/2,y:g.oy+(x+y)*g.th/2};}
function diamond(g,p,inset=0){return [[p.x,p.y-g.th/2+inset*.48],[p.x+g.tw/2-inset,p.y],[p.x,p.y+g.th/2-inset*.48],[p.x-g.tw/2+inset,p.y]];}
function terrain(e,x,y){const t=e.terrain?.[y]?.[x];return typeof t==='string'?t:(t?.type||'grass');}
function palette(chapter,e){
  if(e.kind==='contest')return {sky:'#b5aa96',light:'#ebe2cb',ground:'#cec2a7',earth:'#aa9a7b',edge:'#655f51',grass:'#b8b796',road:'#d7c6a4',stone:'#d7cfb8',water:'#6e9492',darkWater:'#456d73',high:'#b6ac91',sand:'#d3bd8e',title:chapter>=11?'CURIA · ROME':'THE PROVINCIAL CHAMBER',chamber:true};
  if(chapter===5||chapter===6||chapter===9)return {sky:'#bda98b',light:'#e8d4ad',ground:'#c4ae83',earth:'#b09670',edge:'#746a52',grass:'#b5ab7a',road:'#d0bd98',stone:'#c6b08b',water:'#7d9991',darkWater:'#52777a',high:'#b19c77',sand:'#d5bf91',title:chapter===9?'THE EASTERN CAMPAIGN':'THE EUPHRATES FRONTIER'};
  if(chapter===2)return {sky:'#a8b2a7',light:'#d9ddc1',ground:'#a5ae91',earth:'#8e987a',edge:'#555f52',grass:'#a7ad80',road:'#bfc19c',stone:'#b5b7a0',water:'#78958a',darkWater:'#466d70',high:'#9da584',sand:'#c0b392',title:'DANUBE MARSHLAND'};
  if(chapter>=10)return {sky:'#b3b6a2',light:'#e2dec1',ground:'#a9ad87',earth:'#9a9e79',edge:'#636c58',grass:'#a8ad7e',road:'#c9bd9a',stone:'#c6c1aa',water:'#71958d',darkWater:'#476f76',high:'#a7ad90',sand:'#c9ba90',title:chapter>=11?'THE APPROACH TO ROME':'DACIA AURELIANA'};
  return {sky:'#aeb6a2',light:'#e1dcc0',ground:'#a7ad83',earth:'#969e75',edge:'#60694f',grass:'#aab080',road:'#c7bb93',stone:'#bab9a0',water:'#7b9b91',darkWater:'#476f76',high:'#a5aa83',sand:'#c9ba90',title:chapter===8?'THE DANUBE CROSSINGS':chapter===7?'NORTHERN ITALY':'THE DANUBE FRONTIER'};
}
function backdrop(c,w,h,g,e,p,chapter){
  const light=c.createLinearGradient(0,0,w*.75,h);light.addColorStop(0,p.light);light.addColorStop(.55,p.ground);light.addColorStop(1,p.earth);c.fillStyle=light;c.fillRect(0,0,w,h);
  const top=Math.max(34,g.oy-g.th/2-28);
  if(p.chamber){
    c.fillStyle='#897c6660';c.fillRect(0,0,w,top-9);c.fillStyle='#d9cbb1';c.fillRect(0,top-13,w,8);line(c,[[0,top-5],[w,top-5]],'#faf0d188',2);
    // Architecture stays behind the upper edge: no columns cross playable tiles.
    const count=Math.max(4,Math.floor(w/105));for(let i=0;i<=count;i++){const x=18+i*(w-36)/count,base=top-14;const shaft=c.createLinearGradient(x-9,0,x+9,0);shaft.addColorStop(0,'#e4d9bc');shaft.addColorStop(.55,'#c6baa0');shaft.addColorStop(1,'#928b77');c.fillStyle=shaft;c.fillRect(x-6,6,12,Math.max(8,base-6));c.fillStyle='#eadfc3';c.fillRect(x-10,5,20,4);c.fillRect(x-11,base-2,22,5);line(c,[[x-2,12],[x-2,base-5]],'#f2e8d050',1);}
    const bands=[['#617764','V'],['#8a7351','L'],['#897584','C']];for(let i=0;i<3;i++){const x=w*(.28+i*.22),hh=Math.min(28,top-24);if(hh>10){polygon(c,[[x-9,3],[x+9,3],[x+9,hh],[x,hh+5],[x-9,hh]],bands[i][0]);line(c,[[x-7,6],[x+7,6]],'#e6d3a4',1);c.fillStyle=IVORY;c.font='bold 9px Georgia';c.textAlign='center';c.fillText(bands[i][1],x,Math.min(20,hh-2));}}
  }else{
    c.save();c.beginPath();c.rect(0,0,w,top);c.clip();
    for(let layer=0;layer<3;layer++){const points=[[0,top+10]];for(let x=0;x<=w+40;x+=40)points.push([x,top*(.27+layer*.24)-grain(x,layer)*12]);points.push([w,top+10]);polygon(c,points,layer===0?'#87927a38':layer===1?'#74856a34':'#63735928');}
    if(e.type==='training'||[4,5,10].includes(chapter)){c.fillStyle='#786e5533';c.fillRect(w*.13,top-20,w*.64,15);for(let i=0;i<9;i++)c.fillRect(w*.13+i*w*.075,top-25,w*.035,9);}
    c.restore();
  }
  // Sparse plaster flecks at the edge, rather than an all-over mosaic filter.
  for(let i=0;i<28;i++){const x=grain(i,3)*w,y=grain(i,5)*h;if(x<w*.1||x>w*.9||y<22||y>h-24){c.fillStyle=i%2?'#fcf0ce17':'#514e3812';c.fillRect(x,y,2+grain(i,9)*6,.7);}}
  const shade=c.createLinearGradient(0,0,w,h);shade.addColorStop(0,'#faf0ce00');shade.addColorStop(.65,'#323f3100');shade.addColorStop(1,'#28362d24');c.fillStyle=shade;c.fillRect(0,0,w,h);
}
function boardBase(c,g,e,p){const a=xy(g,0,0),b=xy(g,e.width-1,0),d=xy(g,0,e.height-1),z=xy(g,e.width-1,e.height-1),points=[[a.x,a.y-g.th/2],[b.x+g.tw/2,b.y],[z.x,z.y+g.th/2],[d.x-g.tw/2,d.y]],depth=Math.min(12,g.tw*.19);
  c.save();c.shadowColor='#25322655';c.shadowBlur=18;c.shadowOffsetY=10;polygon(c,points,p.edge);c.restore();
  polygon(c,[points[1],points[2],[points[2][0],points[2][1]+depth],[points[1][0],points[1][1]+depth]],p.chamber?'#897b63':'#686c50');
  polygon(c,[points[2],points[3],[points[3][0],points[3][1]+depth],[points[2][0],points[2][1]+depth]],p.chamber?'#a09376':'#7b7e5a');
  line(c,[[points[3][0],points[3][1]+depth],[points[2][0],points[2][1]+depth],[points[1][0],points[1][1]+depth]],'#393f333a',1);
}
function tileSurface(c,g,e,p,x,y,river){const q=xy(g,x,y),type=terrain(e,x,y),deep=type==='rock'&&river;
  const colors={grass:p.grass,earth:p.earth,marsh:p.water,water:p.water,river:p.water,deepwater:p.darkWater,rock:p.high,ford:p.water,sand:p.sand,stone:p.stone,wall:p.high,high:p.high,hill:p.high,chamber:p.stone,road:p.road,gate:p.road,rubble:p.high,cover:p.grass};
  const corners=diamond(g,q);polygon(c,corners,colors[deep?'deepwater':type]??p.grass,p.chamber?'#746c581f':'#5c67472b',.7);
  c.save();polygon(c,corners);c.clip();
  const lighting=c.createLinearGradient(q.x-g.tw/2,q.y-g.th/2,q.x+g.tw/2,q.y+g.th/2);lighting.addColorStop(0,'#fff5d419');lighting.addColorStop(1,'#31422c0e');c.fillStyle=lighting;c.fillRect(q.x-g.tw/2,q.y-g.th/2,g.tw,g.th);
  if(p.chamber){
    if((x+y)%2===0)polygon(c,diamond(g,q,g.tw*.08),'#f7f0d322');
    if(x===0||y===0||x===e.width-1||y===e.height-1){line(c,[[q.x-g.tw*.31,q.y],[q.x,q.y+g.th*.31],[q.x+g.tw*.31,q.y]],'#8e6d4745',1);}
    line(c,[[q.x-g.tw*.2,q.y-g.th*.13],[q.x+g.tw*.02,q.y-g.th*.06],[q.x+g.tw*.19,q.y+g.th*.02]],'#8e87710f',.7);
  }else if(type==='road'||type==='stone'||type==='gate'){
    for(let i=0;i<3;i++){const xx=q.x+(i-1)*g.tw*.22,yy=q.y+(i%2?1:-1)*g.th*.13;polygon(c,[[xx-g.tw*.13,yy],[xx-g.tw*.015,yy-g.th*.14],[xx+g.tw*.13,yy],[xx+g.tw*.015,yy+g.th*.14]],'#ece1be18','#807b5d1c',.7);}
  }else if(type==='sand'){
    c.beginPath();c.moveTo(q.x-g.tw*.3,q.y+g.th*.09);c.quadraticCurveTo(q.x-g.tw*.1,q.y-g.th*.16,q.x+g.tw*.3,q.y+g.th*.05);c.strokeStyle='#f7deb442';c.lineWidth=1.3;c.stroke();line(c,[[q.x-g.tw*.09,q.y+g.th*.26],[q.x+g.tw*.19,q.y+g.th*.18]],'#aa916620',1);
  }else if(type==='grass'||type==='earth'||type==='cover'){
    const tx=q.x+(grain(x,y)-.5)*g.tw*.58,ty=q.y+g.th*.16;oval(c,tx,ty,g.tw*.14,g.th*.1,'#5a6f3b0c');for(let i=0;i<3;i++)line(c,[[tx+i*3,ty],[tx+i*3-1,ty-2-grain(x,i+y)*3]],'#65764238',.8);
    if(grain(x,y,2)>.62)oval(c,q.x-g.tw*.21,q.y+g.th*.06,1.5,.65,'#e7d9aa55');
  }
  if(!p.chamber&&!['water','river','deepwater','ford','marsh'].includes(type))for(let i=0;i<13;i++){
    const xx=q.x+(grain(x*19+i,y,4)-.5)*g.tw,yy=q.y+(grain(x,y*13+i,3)-.5)*g.th;
    c.fillStyle=i%3?'#45513812':'#e6d7a322';c.fillRect(xx,yy,1+grain(i,x+y)*3,.6);
  }
  if(['river','water','marsh','deepwater'].includes(type)||deep||type==='ford'){
    for(let i=0;i<3;i++){const yy=q.y+(i-1)*g.th*.18,xx=q.x+(grain(x,y,i)-.5)*g.tw*.23;line(c,[[xx-g.tw*.16,yy],[xx+g.tw*.11,yy]],deep?'#c7ddd743':'#d6e2c65a',.9);}
    if(type==='marsh'){polygon(c,[[q.x-g.tw*.5,q.y],[q.x-g.tw*.13,q.y-g.th*.4],[q.x-g.tw*.06,q.y-g.th*.22],[q.x-g.tw*.26,q.y+g.th*.03]],'#879777');for(let i=0;i<3;i++){const xx=q.x-g.tw*.24+i*2;line(c,[[xx,q.y],[xx-1,q.y-5-i*1.5]],'#4f675b',.9);}oval(c,q.x+g.tw*.22,q.y+g.th*.12,g.tw*.07,g.th*.055,'#9eaf8470');}
    if(type==='ford')for(let i=-1;i<=1;i++){const xx=q.x+i*g.tw*.18,yy=q.y+i*g.th*.14;oval(c,xx+1,yy+1,g.tw*.105,g.th*.105,'#3f646251');oval(c,xx,yy,g.tw*.1,g.th*.085,'#d0c49d');line(c,[[xx-g.tw*.055,yy-1],[xx+g.tw*.02,yy-2]],'#f2e3bf',.8);}
  }
  c.restore();
  // Put the readable grid edge above the ground wash, while leaving the interior quiet.
  polygon(c,corners,null,p.chamber?'#746c5837':'#4d5b4142',.8);
  line(c,[corners[3],corners[0],corners[1]],p.chamber?'#fff3d738':'#e6e4bb32',.65);
  // Raised scenery is merged with units later, in ground-depth order.
  if(type==='rock'){const yy=q.y+g.th*.24;line(c,[[q.x-2.4,yy-2.4],[q.x+2.4,yy+2.4]],'#eef1d6b0',1.2);line(c,[[q.x+2.4,yy-2.4],[q.x-2.4,yy+2.4]],'#eef1d6b0',1.2);}
}
function landform(c,g,q,type,p){const sx=g.tw/60;
  c.save();c.translate(q.x,q.y);c.scale(sx,sx);
  if(type==='wall'){
    oval(c,3,4,20,5,'#2e39272b');polygon(c,[[-20,-4],[-5,-11],[19,1],[4,8]],'#aa9f81');polygon(c,[[-20,-4],[4,8],[4,-1],[-20,-13]],'#9d9579');polygon(c,[[4,8],[19,1],[19,-8],[4,-1]],'#777f69');polygon(c,[[-20,-13],[-5,-20],[19,-8],[4,-1]],'#d4c8a6');line(c,[[-8,-14],[-8,-7]],'#998b6b',.75);line(c,[[4,-7],[4,-1]],'#998b6b',.75);line(c,[[-19,-8],[3,3]],'#c7baa077',.7);
  }else if(type==='high'||type==='hill'){
    polygon(c,[[-25,0],[-10,-10],[11,-8],[25,4],[6,12]],'#8f9871');polygon(c,[[-25,0],[-10,-10],[11,-8],[20,-1],[0,7]],p.chamber?'#c2baa0':'#bec197');line(c,[[-19,1],[-9,-5],[9,-4]],'#e4ddb34d',1);line(c,[[8,8],[16,4],[21,4]],'#74856155',1);
  }else if(type==='cover'){
    for(let i=0;i<3;i++){const xx=(i-1)*8;oval(c,xx,1,9,4,'#4f623d45');polygon(c,[[xx-8,1],[xx-5,-6],[xx+2,-9],[xx+8,-2],[xx+5,3]],i%2?'#7b8961':'#89966b');line(c,[[xx-3,-4],[xx+2,-6]],'#b6bf8f55',1);}
  }else{
    oval(c,3,4,20,5,'#34413725');polygon(c,[[-22,1],[-16,-10],[-3,-15],[10,-7],[7,5],[-7,9]],'#9a9e8b');polygon(c,[[-16,-10],[-3,-15],[10,-7],[-4,-3]],'#c4c4aa');polygon(c,[[-4,-3],[10,-7],[7,5],[-7,9]],'#798875');polygon(c,[[8,5],[12,-2],[20,-1],[23,5],[16,8]],'#b2b69c');
  }c.restore();
}
function tacticalOverlay(c,g,e,selected,targets,focus,options){const selectedUnit=e.units.find(u=>u.id===selected);
  for(const target of targets){const p=xy(g,target.x,target.y),other=e.units.find(u=>u.id===(target.unitId??target.targetId)),attack=['strike','throw','denounce','threaten'].includes(options.action)||(!options.action&&other?.side==='enemy'),color=attack?FIELD_COLORS.attack:FIELD_COLORS.movement;
    polygon(c,diamond(g,p,1),attack?'#9c403628':'#277c8223','#f4ecd6b8',3);
    polygon(c,diamond(g,p,1),null,color,1.6);
    if(attack){const s=Math.max(3,g.tw*.065);line(c,[[p.x-s,p.y-s*.5],[p.x+s,p.y+s*.5]],color,1.5);line(c,[[p.x+s,p.y-s*.5],[p.x-s,p.y+s*.5]],color,1.5);}else oval(c,p.x,p.y+g.th*.22,2.4,1.3,color);
  }
  for(const objective of (e.mission?.points?.length?e.mission.points:e.goal?[e.goal]:[])){const p=xy(g,objective.x,objective.y);polygon(c,diamond(g,p,2),'#bd995413','#725d3899',3.2);polygon(c,diamond(g,p,2),null,FIELD_COLORS.objective,1.8);const xx=p.x-g.tw*.26,yy=p.y+g.th*.13,ss=Math.min(1,g.tw/55);c.save();c.translate(xx,yy);c.scale(ss,ss);line(c,[[0,0],[0,-26]],'#6b573a',1.5);polygon(c,[[1,-25],[13,-22],[12,-12],[1,-15]],FIELD_COLORS.objective,IVORY,.7);line(c,[[4,-20],[10,-18]],'#f8ebcb',1);oval(c,0,-27,1.4,1.4,'#d9b975');if(objective.secured){c.fillStyle='#174e44';c.font='bold 14px system-ui';c.fillText('✓',12,-27);}c.restore();}
  if(options.target){
    const p=xy(g,options.target.x,options.target.y);
    polygon(c,diamond(g,p,3),'#f7e5aa44','#fff7d9',4);
    polygon(c,diamond(g,p,3),null,'#7b3e13',2);
    if(selectedUnit&&options.action==='move'){
      const path=previewPath(e,selectedUnit,options.target);c.save();c.setLineDash([4,3]);
      line(c,path.map(cell=>{const q=xy(g,cell.x,cell.y);return[q.x,q.y];}),FIELD_COLORS.selection,2);c.restore();
    }
  }
  if(selectedUnit&&((selectedUnit.resolve??selectedUnit.hp??1)>0)){const p=xy(g,selectedUnit.x,selectedUnit.y);polygon(c,diamond(g,p,1),'#175d6716',IVORY,3.5);polygon(c,diamond(g,p,1),null,FIELD_COLORS.selection,2);}
  if(focus){const p=xy(g,focus.x,focus.y);c.save();c.setLineDash([Math.max(3,g.tw*.075),2]);polygon(c,diamond(g,p,3),null,IVORY,3);polygon(c,diamond(g,p,3),null,FIELD_COLORS.selection,1.5);c.restore();}
}
function baseMarker(c,p,s,u,active){const color=u.side==='enemy'?FIELD_COLORS.enemy:u.side==='neutral'?FIELD_COLORS.neutral:FIELD_COLORS.ally;
  oval(c,p.x+3*s,p.y+2*s,13*s,5*s,'#24342d38');
  if(active){oval(c,p.x,p.y+1*s,15*s,6*s,IVORY);oval(c,p.x,p.y+1*s,13*s,4.7*s,FIELD_COLORS.selection);}
  else if(u.side==='enemy')polygon(c,[[p.x-11*s,p.y+3*s],[p.x+11*s,p.y+3*s],[p.x,p.y+8*s]],color,IVORY,.8);
  else if(u.side==='neutral')oval(c,p.x,p.y+3*s,10*s,3.8*s,color,0,'#f5e7c4',.65);
  else polygon(c,[[p.x-12*s,p.y+2*s],[p.x,p.y-3*s],[p.x+12*s,p.y+2*s],[p.x,p.y+7*s]],color,IVORY,.8);
  if(u.formation){line(c,[[p.x-10*s,p.y+10*s],[p.x+10*s,p.y+10*s]],'#fff3c4',3);line(c,[[p.x-10*s,p.y+10*s],[p.x+10*s,p.y+10*s]],color,1.4);}
  const vectors={east:[1,.5],west:[-1,-.5],north:[1,-.5],south:[-1,.5]},[dx,dy]=vectors[u.facing]??vectors.east,xx=p.x+dx*15*s,yy=p.y+dy*10*s;
  polygon(c,[[xx+dx*3*s,yy+dy*3*s],[xx-dy*2.2*s,yy+dx*1.6*s],[xx+dy*2.2*s,yy-dx*1.6*s]],active?FIELD_COLORS.selection:color,IVORY,.6);
}
function shield(c,x,y,color,persian=false,braced=false){c.save();c.translate(x,y);c.rotate(braced?-.16:.12);
  oval(c,1,1,7.4,12.8,'#272e275e',-.06);oval(c,0,0,7.3,12.6,'#c4b385',-.06);oval(c,-.4,-.4,6.2,11.5,color,-.06);c.save();c.beginPath();c.ellipse(-.4,-.4,6.2,11.5,-.06,0,2*PI);c.clip();polygon(c,[[-8,-10],[-3,-9],[7,7],[6,12]],'#f2d9a341');line(c,[[-5,-7],[4,5]],'#ead8a1',.9);line(c,[[4,-7],[-5,6]],'#d8c58b',.8);if(persian){line(c,[[-5,0],[5,0]],'#edd5a4',1.2);line(c,[[0,-9],[0,9]],'#edd5a4',1.2);}c.restore();oval(c,-.5,0,2.2,2.8,'#b4b29a',0,'#353f3b',.8);oval(c,-1.2,-.8,.8,1.1,'#f0e2bf');c.restore();}
function horse(c,color){
  oval(c,2,1,23,6,'#28382a26');
  for(const [x,y]of [[-11,-8],[6,-8],[-4,-8],[15,-9]]){line(c,[[x,y],[x+(x%2?2:-3),4],[x+2,8]],'#4b4639',2.7);line(c,[[x,8],[x+4,8]],'#30372f',2);}
  polygon(c,[[-22,-19],[-10,-28],[11,-27],[19,-19],[13,-6],[-8,-6],[-20,-11]],color,INK,.65);oval(c,-9,-18,11,8,'#aa8c5f39');polygon(c,[[9,-22],[14,-36],[21,-43],[27,-39],[28,-29],[21,-25],[19,-13]],color,INK,.6);polygon(c,[[20,-40],[22,-48],[25,-42],[27,-44],[27,-37]],'#4a4639');line(c,[[14,-32],[18,-42],[21,-45]],'#423e35',2);oval(c,25,-36,1.1,1.1,'#1e2d28');line(c,[[25,-32],[15,-28],[1,-25]],'#cec1a0',.85);line(c,[[-19,-17],[-25,-10],[-26,-2]],'#413d32',3);polygon(c,[[-9,-27],[6,-28],[9,-14],[-10,-12]],'#754b3b');line(c,[[-7,-23],[5,-24]],'#c49c67',1);}
function warrior(c,p,s,u,chapter){const enemy=u.side==='enemy',hero=u.id==='hero',persian=/Persian|Palmyrene/.test(u.name),goth=/Gothic|raider/i.test(u.name),cavalry=['cavalry','heavy'].includes(u.role),archer=u.role==='archer',escort=u.role==='escort',color=enemy?FIELD_COLORS.enemy:u.side==='neutral'?FIELD_COLORS.neutral:FIELD_COLORS.ally;
  c.save();c.translate(p.x,p.y);c.scale(s,s);if(u.facing==='west'||u.facing==='north')c.scale(-1,1);
  if(cavalry){horse(c,persian?'#847562':'#8d795e');c.translate(-2,-20);}
  if(hero&&chapter>=7){polygon(c,[[-10,-34],[-18,-23],[-17,-4],[-5,-12],[8,-10],[9,-28]],chapter>=11?'#673f51':'#8c4335');line(c,[[-14,-23],[-13,-9]],'#b165484c',1.5);}
  // Long-sleeved tunics, trousers and spathae: no segmented plate or rectangular shields.
  polygon(c,[[-6,-19],[-1,-18],[-2,-3],[-6,-2]],'#554f40');polygon(c,[[2,-18],[7,-18],[8,-4],[4,-3]],'#635b45');polygon(c,[[-7,-4],[-2,-4],[-1,0],[-9,0]],'#493e30');polygon(c,[[3,-4],[8,-4],[11,-1],[10,1],[3,0]],'#493e30');
  const tunic=escort?'#c1a276':goth?'#b28c60':persian?'#baaa89':chapter===1&&hero?'#cfbd91':'#b9b89d';polygon(c,[[-8,-34],[5,-35],[10,-28],[8,-14],[-9,-13],[-11,-27]],tunic,INK,.55);
  polygon(c,[[4,-34],[10,-28],[9,-17],[6,-19],[5,-27]],'#776c53');polygon(c,[[-8,-33],[-12,-25],[-9,-20],[-5,-30]],'#dbca9f');
  if(!escort&&!(hero&&chapter===1)&&!goth){const armor=c.createLinearGradient(-7,-33,9,-17);armor.addColorStop(0,'#a8b4a9');armor.addColorStop(.55,'#7d8c84');armor.addColorStop(1,'#586960');polygon(c,[[-7,-34],[5,-34],[8,-29],[6,-18],[-7,-17],[-9,-29]],armor,'#435448',.55);for(let row=0;row<4;row++){line(c,[[-6,-30+row*3],[5,-31+row*3]],'#d3d3b943',.8);for(let i=0;i<3;i++)oval(c,-5+i*4+(row%2),-29+row*3,.6,.6,'#344c4140');}}
  line(c,[[-8,-18],[7,-19]],'#6b5039',2);oval(c,0,-18,1.4,1.4,'#c2a166');
  polygon(c,[[-2,-39],[-2,-33],[4,-32],[5,-39]],'#ac8058');
  const skin=c.createLinearGradient(-5,-45,6,-37);skin.addColorStop(0,'#e0b989');skin.addColorStop(.6,'#c39a6c');skin.addColorStop(1,'#926b4c');polygon(c,[[-5,-46],[-1,-49],[5,-47],[7,-42],[6,-35],[2,-33],[-3,-36]],skin,'#6b6249',.5);polygon(c,[[5,-42],[8,-40],[5,-39]],'#d3ac7a');oval(c,4,-42,.75,.85,'#363d33');line(c,[[1,-44],[5,-44]],'#66573e',.8);line(c,[[3,-37],[6,-37]],'#77583f',.7);
  const grey=hero&&chapter>=6;polygon(c,[[-5,-43],[-6,-47],[-2,-51],[4,-49],[6,-46],[0,-46],[-2,-42]],grey?'#85816b':'#4a4a3b');
  if(!escort&&!goth){if(persian){polygon(c,[[-6,-45],[-1,-55],[5,-48],[7,-44]],'#aaa990','#e0d3b5',.65);}else{polygon(c,[[-7,-44],[-6,-49],[-2,-52],[3,-51],[7,-46],[6,-44]],'#b6b8a4','#575f50',.7);line(c,[[-3,-51],[-1,-45]],'#e3dac0',1.1);}line(c,[[-6,-44],[6,-45]],'#716f58',1.5);polygon(c,[[-5,-43],[-2,-42],[-3,-36],[-5,-37]],'#a5aa96');}
  if(grey){line(c,[[0,-35],[4,-34],[6,-36]],'#77745e',1.2);line(c,[[3,-41],[2,-38]],'#e6c6a0',.7);}
  if(escort){polygon(c,[[-7,-33],[-14,-28],[-14,-17],[-8,-15]],'#897459');line(c,[[-9,-29],[-9,-18]],'#cfb386',1);line(c,[[9,-20],[12,-2]],'#68523a',1.4);oval(c,9,-22,2,2,'#cba476');}
  else if(archer){c.save();c.translate(12,-28);c.beginPath();c.moveTo(1,-15);c.quadraticCurveTo(13,0,1,15);c.strokeStyle='#514835';c.lineWidth=1.8;c.stroke();line(c,[[1,-15],[1,15]],'#dbd2b7',.75);line(c,[[-1,-1],[16,-2]],'#b5b89e',1);polygon(c,[[16,-2],[12,-4],[12,0]],'#d6d7c3');c.restore();line(c,[[6,-29],[13,-28]],tunic,3);oval(c,12,-28,1.8,2,'#c59b70');polygon(c,[[-9,-34],[-14,-33],[-13,-19],[-8,-20]],'#736149');line(c,[[-12,-32],[-14,-42]],'#c5b18b',1);}
  else if(hero&&chapter<7){line(c,[[9,-25],[14,-36],[17,-47]],'#c6c9b7',2.2);polygon(c,[[17,-47],[18,-53],[15,-48]],'#f3ead0');line(c,[[11,-36],[16,-34]],'#9d8050',1.3);oval(c,10,-28,2.1,2.1,'#c69b6c');shield(c,-8,u.braced?-29:-25,color,persian,!!u.braced);}
  else{line(c,[[12,-4],[10,-55]],'#5a4e38',1.7);polygon(c,[[10,-55],[8,-60],[11,-65],[13,-60]],'#c8ceba',INK,.5);line(c,[[6,-28],[10,-28]],tunic,3.3);oval(c,10,-28,2,2,'#c69b6c');shield(c,-8,u.braced?-29:-25,color,persian,!!u.braced);}
  if(hero&&chapter>=7){oval(c,-7,-34,2,2,'#d9b86e');polygon(c,[[-9,-44],[-11,-38],[-14,-23],[-8,-18]],'#913f37');}
  if(u.braced){line(c,[[-15,-14],[-11,-11],[-6,-15]],'#e8d9ac',1.2);}
  c.restore();
}
const BLOCS={Veterans:{color:'#60775e',symbol:'V'},Landholders:{color:'#92734b',symbol:'L'},Civic:{color:'#827188',symbol:'C'}};
function seat(c,x,y,s,bloc){c.save();c.translate(x,y);c.scale(s,s);const color=BLOCS[bloc]?.color??'#887959';polygon(c,[[-14,-6],[-14,-18],[-8,-21],[12,-13],[12,0]],'#b2a489');polygon(c,[[-14,-18],[-8,-21],[12,-13],[6,-10]],'#e0d5bb');polygon(c,[[-14,-6],[6,3],[13,-1],[13,3],[6,7],[-14,-2]],'#c7b99b');line(c,[[7,4],[7,10]],'#8b8068',2);line(c,[[-12,-2],[-12,5]],'#8b8068',2);polygon(c,[[-10,-12],[-6,-14],[8,-8],[4,-6]],color);c.restore();}
function orator(c,p,s,u,chapter){const voter=u.role==='voter',bloc=BLOCS[u.bloc]??{color:FIELD_COLORS.neutral,symbol:'•'},hero=u.id==='hero',enemy=u.side==='enemy';c.save();c.translate(p.x,p.y);c.scale(s,s);
  if(voter){polygon(c,[[-7,-23],[5,-25],[10,-7],[6,-1],[-10,-6]],'#ddd3b7');polygon(c,[[-7,-21],[-11,-15],[-8,-7],[-3,-9],[3,-22]],'#b8b395');polygon(c,[[-4,-21],[3,-22],[8,-9],[1,-12]],'#f2e7cc');line(c,[[-6,-9],[5,-4]],bloc.color,2.2);oval(c,0,-29,4.6,5.3,'#c5a078');polygon(c,[[-5,-30],[-4,-35],[1,-36],[5,-32],[3,-30]],'#817b65');oval(c,2,-29,.65,.65,'#404635');line(c,[[3,-27],[5,-26]],'#a07a56',.8);}
  else{
    const robe=hero?'#d9d0b7':enemy?'#c8bda6':'#d9d7be';polygon(c,[[-7,-35],[7,-35],[13,-25],[10,-2],[-11,-1],[-13,-21]],robe,INK,.5);polygon(c,[[-8,-35],[-11,-20],[6,-14],[10,-28],[4,-34]],'#f1e7cd');polygon(c,[[-11,-20],[-5,-15],[-5,-2],[-12,-2]],'#a6a38b');line(c,[[-7,-32],[8,-18],[7,-3]],hero&&chapter>=11?'#78485d':enemy?'#8c3930':'#4e6951',chapter>=11&&hero?3.2:2.1);line(c,[[-3,-14],[3,-3]],'#8c8f754f',1.2);line(c,[[4,-31],[10,-29],[15,-38]],'#cfab82',3);oval(c,15,-39,2.2,2.5,'#d0ac84');line(c,[[-6,-1],[-10,1]],'#59503c',3);line(c,[[7,-1],[11,0]],'#59503c',3);polygon(c,[[-3,-40],[-2,-34],[4,-34],[4,-40]],'#ba936c');oval(c,0,-44,5.3,6.4,'#cba67c');polygon(c,[[-5,-43],[-6,-48],[-2,-51],[4,-49],[6,-46],[0,-47],[-3,-43]],chapter>=10?'#898572':'#575947');oval(c,3,-44,.8,.9,'#3c4537');line(c,[[1,-47],[5,-46]],'#685d49',.85);line(c,[[2,-39],[5,-40]],'#97734f',.8);if(hero&&chapter>=10)line(c,[[-1,-40],[2,-38],[4,-40]],'#86806a',1.4);if(!hero){polygon(c,[[-13,-22],[-7,-25],[-4,-17],[-11,-14]],'#d3bb84');line(c,[[-11,-21],[-6,-23]],'#a78f60',.8);}
  }c.restore();
}
function status(c,g,p,s,u,active,contest){if(u.role==='voter'){
    const stance=u.stance??0,col=stance>=1?FIELD_COLORS.ally:stance<=-3?FIELD_COLORS.enemy:FIELD_COLORS.neutral,xx=p.x+11*s,yy=p.y-28*s;
    oval(c,xx,yy,6.9*s,6.9*s,IVORY,0,col,1.2);c.fillStyle=col;c.font=`bold ${9*s}px system-ui`;c.textAlign='center';c.fillText(stance>=1?'✓':stance<=-3?'−':'·',xx,yy+3*s);
    // Seven stepped positions make wavering and hardened commitment distinguishable.
    const dotY=p.y+9*s;for(let i=-3;i<=3;i++){const lit=stance>=0?i>=0&&i<=Math.ceil(stance/2):i<=0&&i>=Math.floor(stance/2);c.fillStyle=lit?col:'#f2ead0a0';c.fillRect(p.x+i*3*s-1*s,dotY,2*s,2.4*s);}
    const b=BLOCS[u.bloc];if(b){c.fillStyle='#4f5246';c.font=`bold ${7.5*s}px Georgia`;c.fillText(b.symbol,p.x-11*s,p.y+3*s);}return;
  }
  const mounted=['cavalry','heavy'].includes(u.role),yy=p.y-spriteHeight(g,u)*.93-5,bw=Math.min(36,g.tw*.64),max=u.maxResolve??u.maxHp??1,value=u.resolve??u.hp??0,ratio=Math.max(0,Math.min(1,value/max)),col=contest?'#d5b771':u.side==='enemy'?'#b76a52':'#b8c997';
  c.fillStyle='#f4e8cb';c.fillRect(p.x-bw/2-1,yy-1,bw+2,6);c.fillStyle='#394638';c.fillRect(p.x-bw/2,yy,bw,4);c.fillStyle=col;c.fillRect(p.x-bw/2,yy,bw*ratio,4);
  for(let i=1;i<4;i++)line(c,[[p.x-bw/2+bw*i/4,yy],[p.x-bw/2+bw*i/4,yy+4]],'#233d2a33',.5);
  const markerY=yy-6*s,markerColor=active?FIELD_COLORS.selection:u.side==='enemy'?FIELD_COLORS.enemy:FIELD_COLORS.ally;
  if(u.id==='hero'){polygon(c,[[p.x,markerY-4*s],[p.x+4*s,markerY],[p.x,markerY+3*s],[p.x-4*s,markerY]],markerColor,IVORY,.8);}
  else if(u.side==='enemy')polygon(c,[[p.x-3*s,markerY-2*s],[p.x+3*s,markerY-2*s],[p.x,markerY+3*s]],markerColor,IVORY,.65);
  else oval(c,p.x,markerY,2.5*s,2.5*s,markerColor,0,IVORY,.65);
  if(!contest&&['archer','cavalry','heavy','escort'].includes(u.role)){c.fillStyle=markerColor;c.font=`bold ${Math.max(8,9*s)}px system-ui`;c.textAlign='center';c.fillText(({archer:'↗',cavalry:'»',heavy:'◆',escort:'○'})[u.role],p.x+bw/2+7*s,yy+4);}
  if(contest){c.fillStyle='#3f473c';c.font=`bold ${8*s}px system-ui`;c.textAlign='left';c.fillText('R',p.x-bw/2-8*s,yy+4);}
  if(u.moved&&u.acted){oval(c,p.x+bw/2+5*s,yy+1,4.8*s,4.8*s,IVORY);c.fillStyle='#426056';c.font=`bold ${8*s}px system-ui`;c.textAlign='center';c.fillText('✓',p.x+bw/2+5*s,yy+4*s);}
}
function labels(c,w,h,g,e,p,river){c.fillStyle='#424d40';c.font='10px Georgia';c.textAlign='left';c.fillText(p.title,16,22);c.textAlign='right';c.fillText('N',w-20,20);line(c,[[w-23,30],[w-16,24]],'#59634d',1);line(c,[[w-21,25],[w-16,24],[w-17,29]],'#59634d',1);
  c.fillStyle='#4d5747';c.font='9px system-ui';c.textAlign='center';for(let i=0;i<e.width;i++){const q=xy(g,i,e.height);c.fillText(String(i+1),q.x,q.y+10);}for(let i=0;i<e.height;i++){const q=xy(g,e.width,i);c.fillText(String.fromCharCode(65+i),q.x,q.y+10);}
  if(river){c.font='9px system-ui';c.textAlign='left';c.fillText('× Deep water   ·   Pale stones mark the ford',14,h-12);}
}
// A shortest legal preview respects the same impassable and occupied cells as
// movement. This has no rule side effects and never invents a straight shortcut.
export function previewPath(e,unit,target){
  const key=p=>`${p.x},${p.y}`,start={x:unit.x,y:unit.y},queue=[{...start,cost:0}],costs=new Map([[key(start),0]]),parents=new Map();
  while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const cell=queue.shift();if(cell.x===target.x&&cell.y===target.y){const path=[{x:cell.x,y:cell.y}];let k=key(cell);while(parents.has(k)){const previous=parents.get(k);path.unshift(previous);k=key(previous);}return path;}
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const next={x:cell.x+dx,y:cell.y+dy},k=key(next);if(next.x<0||next.y<0||next.x>=e.width||next.y>=e.height||['rock','river'].includes(terrain(e,next.x,next.y))||e.units.some(u=>u.id!==unit.id&&(u.resolve??u.hp??1)>0&&u.x===next.x&&u.y===next.y))continue;const cost=cell.cost+(terrain(e,next.x,next.y)==='marsh'&&unit.formation!=='line'?2:1);if(costs.has(k)&&costs.get(k)<=cost)continue;costs.set(k,cost);parents.set(k,{x:cell.x,y:cell.y});queue.push({...next,cost});}
  }return [];
}
let groundCache=null;
export function rendererCacheStats(){return {surfaces:groundCache?1:0,estimatedBytes:groundCache?groundCache.surface.width*groundCache.surface.height*4:0};}
export function clearBattleCache(){if(groundCache){groundCache.surface.width=1;groundCache.surface.height=1;}groundCache=null;}
function ground(c,w,h,g,e,p,chapter,river,quality,ratio){
  const key=[w,h,g.tw,g.oy,chapter,e.kind,quality,ratio,JSON.stringify(e.terrain)].join('|');
  const draw=ctx=>{worldGround(ctx,w,h,g,e,p,chapter,quality);for(let depth=0;depth<e.width+e.height;depth++)for(let x=0;x<e.width;x++){const y=depth-x;if(y>=0&&y<e.height)tileSurface(ctx,g,e,p,x,y,river);}};
  if(!c.canvas?.ownerDocument&&!globalThis.OffscreenCanvas){draw(c);return;}
  if(groundCache?.key!==key){
    clearBattleCache();const surface=typeof OffscreenCanvas==='function'?new OffscreenCanvas(Math.ceil(w*ratio),Math.ceil(h*ratio)):c.canvas.ownerDocument.createElement('canvas');surface.width=Math.ceil(w*ratio);surface.height=Math.ceil(h*ratio);const ctx=surface.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);draw(ctx);groundCache={key,surface};
  }
  c.drawImage(groundCache.surface,0,0,w,h);
}
function terrainObject(c,g,q,type,p){
  if(type!=='wall'){landform(c,g,q,type,p);return;}
  const s=g.tw/60;c.save();c.translate(q.x,q.y);c.scale(s,s);
  oval(c,10,4,28,7,'#25372938');
  polygon(c,[[-23,-6],[2,7],[2,-21],[-23,-34]],'#aeaa8c');polygon(c,[[2,7],[23,-4],[23,-32],[2,-21]],'#757e69');polygon(c,[[-23,-34],[-2,-45],[23,-32],[2,-21]],'#d6ccb0');
  for(let i=0;i<3;i++){line(c,[[-23,-12-i*9],[2,1-i*9],[23,-10-i*9]],'#535f5040',.7);line(c,[[-12+(i%2)*8,-27+i*8],[-12+(i%2)*8,-20+i*8]],'#6f72594d',.8);}
  c.restore();
}
function contactShadow(c,g,q,u,quality){const scale=spriteHeight(g,u)/72,cavalry=['cavalry','heavy'].includes(u.role);c.save();c.translate(q.x,q.y);c.rotate(.32);oval(c,7*scale,2*scale,(cavalry?24:18)*scale,5*scale,'#24352d25');if(quality!=='performance'){oval(c,2*scale,1*scale,(cavalry?17:10)*scale,3.8*scale,'#1c2e293d');}c.restore();}
function actionEffects(c,g,frame){for(const effect of frame?.effects??[]){const q=xy(g,effect.at?.x??effect.to?.x??0,effect.at?.y??effect.to?.y??0),s=g.tw/60,t=effect.progress??0;c.save();c.globalAlpha=effect.alpha??1;
    if(effect.type==='projectile'&&effect.from&&effect.to){const a=xy(g,effect.from.x,effect.from.y),b=xy(g,effect.to.x,effect.to.y),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t-Math.sin(t*Math.PI)*35*s-24*s;c.translate(x,y);c.rotate(Math.atan2(b.y-a.y-Math.cos(t*Math.PI)*35*s*Math.PI,b.x-a.x));line(c,[[-10*s,0],[8*s,0]],'#65533c',1.7*s);polygon(c,[[8*s,0],[4*s,-2*s],[4*s,2*s]],'#f6e6c3');}
    else if(effect.type==='dust'){for(let i=0;i<4;i++)oval(c,q.x+(i-1.5)*8*s*t,q.y-i*3*s*t,(2+t*5)*s,(1+t*2)*s,'#d5c39665');}
    else if(effect.type==='impact'){for(let i=0;i<6;i++){const a=i*Math.PI/3;line(c,[[q.x+Math.cos(a)*4*s,q.y-25*s+Math.sin(a)*4*s],[q.x+Math.cos(a)*(6+t*13)*s,q.y-25*s+Math.sin(a)*(6+t*13)*s]],'#fce0a6',1.5*s);}}
    else if(effect.type==='speech'){oval(c,q.x,q.y-32*s,(10+t*6)*s,(7+t*3)*s,'#f4ecd6dd');c.fillStyle='#6f5a3e';c.font=`bold ${12*s}px Georgia`;c.textAlign='center';c.fillText('…',q.x,q.y-29*s);}
    else{c.beginPath();c.ellipse(q.x,q.y,(14+t*13)*s,(6+t*7)*s,0,0,Math.PI*2);c.strokeStyle=['defeat','impact'].includes(effect.type)?'#a35643':effect.type==='shield'?'#e1e8cf':'#c1a466';c.lineWidth=2*s;c.stroke();}
    c.restore();}}

export function paintBattle(c,w,h,g,e,selected,targets,focus,chapter,options={}){
  const p=palette(chapter,e),river=e.terrain?.some(row=>row.some(t=>(typeof t==='string'?t:t?.type)==='ford')),quality=options.quality??'balanced',frame=options.animation??(Number.isFinite(options.ambientTime)?{time:options.ambientTime,unitOverrides:Object.fromEntries(e.units.filter(u=>!u.hidden&&(u.resolve??u.hp??1)>0).map(u=>[u.id,idlePose(u,options.ambientTime)])),effects:[]}:null);
  ground(c,w,h,g,e,p,chapter,river,quality,options.pixelRatio??1);
  tacticalOverlay(c,g,e,selected,targets,focus,options);
  const items=scenery(e,chapter).map(item=>({...item,kind:'scenery'}));
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++){const type=terrain(e,x,y);if(['wall','high','hill','rubble','cover'].includes(type)||type==='rock'&&!river)items.push({kind:'terrain',type,x,y});}
  const units=e.units.filter(u=>!u.hidden&&u.x>=0&&((u.resolve??u.hp??1)>0||(frame?.unitOverrides?.[u.id]?.alpha??0)>0)).map(u=>({...u,...frame?.unitOverrides?.[u.id],kind:'unit',original:u}));
  const s=Math.min(1.3,g.tw/48),watch=units.filter(u=>u.id===selected||u.id===options.target?.unitId).map(u=>xy(g,u.x,u.y));
  items.push(...units);items.sort((a,b)=>a.x+a.y-b.x-b.y||a.x-b.x||(a.kind==='unit'?1:-1));
  for(const item of items){const q=xy(g,item.x,item.y);c.save();
    if(item.kind==='unit'){
      const active=item.id===selected;c.globalAlpha=item.alpha??1;contactShadow(c,g,q,item,quality);baseMarker(c,q,s,item,active);
      if(item.role==='voter')seat(c,q.x,q.y,s*.8,item.bloc);
      if(!drawUnitSprite(c,g,q,item,chapter,e.kind==='contest',frame?.unitOverrides?.[item.id])){if(e.kind==='contest')orator(c,q,s,item,chapter);else warrior(c,q,s,item,chapter);}
    }else{
      // Fade an occluder only when its upper silhouette covers an important unit.
      const overlap=watch.some(point=>Math.abs(point.x-q.x)<g.tw*.55&&q.y>point.y&&q.y-point.y<g.tw);
      if(overlap)c.globalAlpha=.38;
      if(item.kind==='terrain')terrainObject(c,g,q,item.type,p);else drawScenery(c,g,item,chapter);
    }c.restore();
  }
  atmosphere(c,w,h,g,chapter,e.kind==='contest',frame,quality);actionEffects(c,g,frame);
  // Information draws last, so props never hide selection or health/Resolve.
  for(const u of units){const q=xy(g,u.x,u.y);c.save();c.globalAlpha=u.alpha??1;status(c,g,q,s,u,u.id===selected,e.kind==='contest');c.restore();}
  labels(c,w,h,g,e,p,river);
}
