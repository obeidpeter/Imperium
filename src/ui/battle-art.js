import {drawFieldFeature} from './field-feature-art.js';
// Painted, deterministic presentation only. Never reads or advances gameplay RNG.
import {movementPinned} from '../core/shared.js';
import {enemyFormationLinks,reinforcementBeacons} from '../core/battle.js';
import {drawUnitSprite,spriteHeight} from './unit-sprites.js';
import {worldGround,scenery,drawScenery,atmosphere} from './world-art.js';
import {idlePose} from './animation-timeline.js';
import {drawBattleEffects} from './battle-effects.js';
import {drawTerrainDetail} from './terrain-detail.js';
import {scenePalette,formationGlyph,moraleState} from './scene-materials.js';
import {stoneOutcrop,masonryWall} from './material-forms.js';
import {peekArt} from './art.js';
import {worldAssetKey} from './world-assets.js';
import {BLOC_STYLE,DELEGATE_BLOCS} from './bloc-style.js';
import {paintMaterial,materialIndex,drawNaturalProp,environmentLight} from './ground-materials.js';
import {threatEnvelope} from '../showcase/stage-readout.js';
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
function tileSurface(c,g,e,p,x,y,river,chapter){
  const q=xy(g,x,y),type=terrain(e,x,y),deep=type==='rock'&&river;
  const corners=diamond(g,q),wet=deep||['water','river','deepwater','ford','marsh'].includes(type);
  const surface=deep?'deepwater':type;
  // An unbroken base material spans the whole world. Only authored changes in
  // terrain receive a different clipped surface; there is no decorative grid.
  if(wet||(['road','stone','gate','sand','chamber'].includes(type)&&!(p.chamber&&['chamber','stone'].includes(type)))){
    c.save();polygon(c,corners);c.clip();
    c.fillStyle=wet?p.water:type==='sand'?p.sand:['road','gate'].includes(type)?p.road:p.stone;c.fillRect(q.x-g.tw/2,q.y-g.th/2,g.tw,g.th);
    paintMaterial(c,g,{x:q.x-g.tw/2,y:q.y-g.th/2,w:g.tw,h:g.th},materialIndex(surface,chapter,p.chamber),p.chamber?.6:.82);
    if(deep){c.fillStyle='#0b303e7a';c.fillRect(q.x-g.tw/2,q.y-g.th/2,g.tw,g.th);}
    c.restore();
  }
  if(type==='ford')for(let i=-1;i<=1;i++){
    const xx=q.x+i*g.tw*.18,yy=q.y+i*g.th*.14;
    oval(c,xx+2,yy+2,g.tw*.11,g.th*.1,'#102b3390');oval(c,xx,yy,g.tw*.1,g.th*.075,'#b7b59a');line(c,[[xx-g.tw*.055,yy-1],[xx+g.tw*.02,yy-2]],'#e5dcb8',.8);
  }
  if(type==='rock'&&river){const yy=q.y+g.th*.20;line(c,[[q.x-2,yy-2],[q.x+2,yy+2]],'#c8e0deb0',1);line(c,[[q.x+2,yy-2],[q.x-2,yy+2]],'#c8e0deb0',1);}
}
function landform(c,g,q,type,p){const sx=g.tw/60;
  c.save();c.translate(q.x,q.y);c.scale(sx,sx);
  if(type==='high'||type==='hill'){
    c.save();c.beginPath();c.moveTo(-29,2);c.bezierCurveTo(-17,-4,-18,-15,-6,-16);c.bezierCurveTo(7,-17,23,-8,28,2);c.bezierCurveTo(14,11,-8,14,-29,2);c.closePath();c.clip();
    c.fillStyle=p.earth;c.fillRect(-30,-17,60,31);paintMaterial(c,{tw:60},{x:-30,y:-17,w:60,h:31},materialIndex('grass',p.chapter),.98);
    const slope=c.createLinearGradient(-15,-16,8,13);slope.addColorStop(0,'#f4e4b22e');slope.addColorStop(.5,'#a2ad7a00');slope.addColorStop(1,'#091f2778');c.fillStyle=slope;c.fillRect(-30,-17,60,31);c.restore();
    c.beginPath();c.moveTo(-14,7);c.quadraticCurveTo(3,12,20,3);c.strokeStyle='#172b2440';c.lineWidth=1.2;c.stroke();
  }else if(type==='cover'){
    if(!drawNaturalProp(c,'shrub',43)){oval(c,2,3,23,5,'#354f3738');for(let i=0;i<5;i++){const xx=(i-2)*7,yy=-3-Math.sin(i*2)*3;line(c,[[xx,3],[xx-1,yy-7]],'#5e6143',1.2);oval(c,xx,yy,8,5,i%2?'#657b4e':'#839363');oval(c,xx-2,yy-3,5,3,'#afba836e');}}
  }else{
    if(!drawNaturalProp(c,'rock',55,q.x*.01+q.y*.03))stoneOutcrop(c,1,q.x*.01+q.y*.03);
  }c.restore();
}
export function drawFieldwork(c,g,q,type){
  const sx=g.tw/60;c.save();c.translate(q.x,q.y);c.scale(sx,sx);
  if(type==='stakes'){
    for(const x of [-11,0,11]){
      oval(c,x+1,3,4.2,1.8,'#1c272042');
      polygon(c,[[x-2.2,3],[x-5.5,-13],[x-3,-17],[x+2,2]],'#7a5a3a','#4a3520',.8);
    }
  }else if(type==='rampart'){
    oval(c,0,6,20,5.5,'#1c272038');
    polygon(c,[[-18,4],[0,12],[18,4],[15,-5],[0,2],[-15,-5]],'#7c694c','#4d3f2c',.9);
    polygon(c,[[-15,-5],[0,2],[15,-5],[0,-10]],'#849464');
  }else if(type==='brazier'){
    oval(c,12,5,8.5,3.6,'#ff9a3c38');
    polygon(c,[[8,4],[10,-8],[14,-8],[16,4]],'#4a453e',INK,.7);
    oval(c,12,-9,5.5,2.5,'#6b3824');
    polygon(c,[[9,-9],[11,-20],[13,-14],[15,-22],[16,-9]],'#ffad48','#ffd984',.6);
  }
  c.restore();
}
function tacticalOverlay(c,g,e,selected,targets,focus,options){const selectedUnit=e.units.find(u=>u.id===selected);
  if(options.grid)for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)polygon(c,diamond(g,xy(g,x,y)),null,'#d5dec42b',.65);
  if(e.kind==='battle'){
    for(const link of enemyFormationLinks(e)){
      const a=xy(g,link.from.x,link.from.y),b=xy(g,link.to.x,link.to.y);
      c.save();c.setLineDash([3,3]);line(c,[[a.x,a.y+2],[b.x,b.y+2]],'#d97a6c90',1.5);c.restore();
    }
    for(const beacon of reinforcementBeacons(e)){
      const bp=xy(g,beacon.x,beacon.y),col=beacon.imminent?'#c44d3f':'#d89b3c',ss=Math.min(1,g.tw/55);
      c.save();c.setLineDash([4,2]);polygon(c,diamond(g,bp,2),'#c44d3f18',col,beacon.imminent?2.1:1.5);c.restore();
      c.save();c.translate(bp.x+g.tw*.24,bp.y-g.th*.14);c.scale(ss,ss);
      polygon(c,[[-6,0],[0,-10],[6,0]],col,IVORY,.75);
      c.fillStyle=IVORY;c.font='bold 8.5px system-ui';c.textAlign='center';c.fillText(`T${beacon.turn}`,0,9);
      c.restore();
    }
  }
  if(e.kind==='battle'&&!options.action&&focus){
    const inspectedEnemy=e.units.find(u=>!u.hidden&&u.side==='enemy'&&(u.hp??1)>0&&(u.id===focus.unitId||(u.x===focus.x&&u.y===focus.y)));
    if(inspectedEnemy){
      const env=threatEnvelope(e,inspectedEnemy.id);
      for(const tile of [...(env?.moveTiles??[]),...(env?.threatenedUnits??[])]){
        const tp=xy(g,tile.x,tile.y),s=Math.max(3,g.tw*.12);
        polygon(c,diamond(g,tp,2),'#9c403616','#c85a4870',1);
        line(c,[[tp.x-s,tp.y-s*.45],[tp.x+s,tp.y+s*.45]],'#c85a4855',1);
      }
    }
  }
  if(options.hover&&Number.isInteger(options.hover.x)&&Number.isInteger(options.hover.y)&&options.hover.x>=0&&options.hover.y>=0&&options.hover.x<e.width&&options.hover.y<e.height)polygon(c,diamond(g,xy(g,options.hover.x,options.hover.y),1),'#e6ddba18','#eee3bf8c',1);
  for(const target of targets){const p=xy(g,target.x,target.y),other=e.units.find(u=>u.id===(target.unitId??target.targetId)),attack=['strike','throw','denounce','threaten'].includes(options.action)||(!options.action&&other?.side==='enemy'),color=attack?FIELD_COLORS.attack:FIELD_COLORS.movement;
    polygon(c,diamond(g,p,1),attack?'#9c40362d':'#277c822b','#f4ecd6b8',3);
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
  if(u.name==='Pledged cohort')oval(c,p.x,p.y+2*s,14*s,5.4*s,null,0,'#e3c16f',1.4*s);
  const mState=u.resolve===undefined?moraleState(u):null;
  if(mState){c.save();c.setLineDash(mState==='broken'?[2.5*s,2*s]:[4*s,2*s]);oval(c,p.x,p.y+2*s,15.5*s,6.2*s,null,0,mState==='broken'?'#b84234':'#c9933b',1.5*s);c.restore();}
  const formation=formationGlyph(u.formation).map(([x,y])=>[p.x+x*s,p.y+(9+y)*s]);
  if(formation.length){line(c,formation,IVORY,3*s);line(c,formation,color,1.5*s);}
  if(u.braced){c.beginPath();c.ellipse(p.x,p.y,17*s,7*s,0,PI,PI*2);c.strokeStyle=IVORY;c.lineWidth=3*s;c.stroke();c.strokeStyle=color;c.lineWidth=1.6*s;c.stroke();}
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
// One colour and letter per bloc, shared with the 3D view (bloc-style.js).
const BLOCS=Object.fromEntries(DELEGATE_BLOCS.map(bloc=>[bloc,{color:BLOC_STYLE[bloc].color,symbol:BLOC_STYLE[bloc].letter}]));
function seat(c,x,y,s,bloc){c.save();c.translate(x,y);c.scale(s,s);const color=BLOCS[bloc]?.color??'#887959';polygon(c,[[-14,-6],[-14,-18],[-8,-21],[12,-13],[12,0]],'#b2a489');polygon(c,[[-14,-18],[-8,-21],[12,-13],[6,-10]],'#e0d5bb');polygon(c,[[-14,-6],[6,3],[13,-1],[13,3],[6,7],[-14,-2]],'#c7b99b');line(c,[[7,4],[7,10]],'#8b8068',2);line(c,[[-12,-2],[-12,5]],'#8b8068',2);polygon(c,[[-10,-12],[-6,-14],[8,-8],[4,-6]],color);c.restore();}
function orator(c,p,s,u,chapter){const voter=u.role==='voter',bloc=BLOCS[u.bloc]??{color:FIELD_COLORS.neutral,symbol:'•'},hero=u.id==='hero',enemy=u.side==='enemy';c.save();c.translate(p.x,p.y);c.scale(s,s);
  if(voter){polygon(c,[[-7,-23],[5,-25],[10,-7],[6,-1],[-10,-6]],'#ddd3b7');polygon(c,[[-7,-21],[-11,-15],[-8,-7],[-3,-9],[3,-22]],'#b8b395');polygon(c,[[-4,-21],[3,-22],[8,-9],[1,-12]],'#f2e7cc');line(c,[[-6,-9],[5,-4]],bloc.color,2.2);oval(c,0,-29,4.6,5.3,'#c5a078');polygon(c,[[-5,-30],[-4,-35],[1,-36],[5,-32],[3,-30]],'#817b65');oval(c,2,-29,.65,.65,'#404635');line(c,[[3,-27],[5,-26]],'#a07a56',.8);}
  else{
    const robe=hero?'#d9d0b7':enemy?'#c8bda6':'#d9d7be';polygon(c,[[-7,-35],[7,-35],[13,-25],[10,-2],[-11,-1],[-13,-21]],robe,INK,.5);polygon(c,[[-8,-35],[-11,-20],[6,-14],[10,-28],[4,-34]],'#f1e7cd');polygon(c,[[-11,-20],[-5,-15],[-5,-2],[-12,-2]],'#a6a38b');line(c,[[-7,-32],[8,-18],[7,-3]],hero&&chapter>=11?'#78485d':enemy?'#8c3930':'#4e6951',chapter>=11&&hero?3.2:2.1);line(c,[[-3,-14],[3,-3]],'#8c8f754f',1.2);line(c,[[4,-31],[10,-29],[15,-38]],'#cfab82',3);oval(c,15,-39,2.2,2.5,'#d0ac84');line(c,[[-6,-1],[-10,1]],'#59503c',3);line(c,[[7,-1],[11,0]],'#59503c',3);polygon(c,[[-3,-40],[-2,-34],[4,-34],[4,-40]],'#ba936c');oval(c,0,-44,5.3,6.4,'#cba67c');polygon(c,[[-5,-43],[-6,-48],[-2,-51],[4,-49],[6,-46],[0,-47],[-3,-43]],chapter>=10?'#898572':'#575947');oval(c,3,-44,.8,.9,'#3c4537');line(c,[[1,-47],[5,-46]],'#685d49',.85);line(c,[[2,-39],[5,-40]],'#97734f',.8);if(hero&&chapter>=10)line(c,[[-1,-40],[2,-38],[4,-40]],'#86806a',1.4);if(!hero){polygon(c,[[-13,-22],[-7,-25],[-4,-17],[-11,-14]],'#d3bb84');line(c,[[-11,-21],[-6,-23]],'#a78f60',.8);}
  }c.restore();
}
function status(c,g,p,s,u,active,contest){if(u.role==='voter'){
    const stance=u.stance??0,col=stance>=1?FIELD_COLORS.ally:stance<=-3?FIELD_COLORS.enemy:FIELD_COLORS.neutral,xx=p.x+11*s,yy=p.y-28*s;
    oval(c,xx,yy,6.9*s,6.9*s,IVORY,0,col,1.2);c.fillStyle=col;c.font=`bold ${9*s}px system-ui`;c.textAlign='center';c.fillText(stance>=1?'✓':'−',xx,yy+3*s);
    if(Math.abs(stance)>=3){c.beginPath();c.ellipse(xx,yy,9*s,9*s,0,0,PI*2);c.strokeStyle=col;c.lineWidth=1.2*s;c.stroke();}
    // Three commitment steps remain readable on small boards; exact stance is in the unit panel.
    const dotY=p.y+9*s;for(let i=0;i<3;i++){c.fillStyle=i<Math.min(3,Math.abs(stance))?col:'#f2ead0a0';c.fillRect(p.x+(i-1)*5*s-1.5*s,dotY,3*s,2.4*s);}
    if(u.promised){polygon(c,[[p.x-3*s,p.y-5*s],[p.x+3*s,p.y-5*s],[p.x+3*s,p.y],[p.x,p.y+3*s],[p.x-3*s,p.y]],'#bd9954',IVORY,.6);}
    const b=BLOCS[u.bloc];if(b){c.fillStyle='#4f5246';c.font=`bold ${7.5*s}px Georgia`;c.fillText(b.symbol,p.x-11*s,p.y+3*s);}return;
  }
  const mounted=['cavalry','heavy'].includes(u.role),yy=p.y-spriteHeight(g,u)*.93-5,bw=Math.min(36,g.tw*.64),max=u.maxResolve??u.maxHp??1,value=u.resolve??u.hp??0,ratio=Math.max(0,Math.min(1,value/max)),col=contest?'#d5b771':u.side==='enemy'?'#b76a52':'#b8c997';
  c.fillStyle='#f4e8cb';c.fillRect(p.x-bw/2-1,yy-1,bw+2,6);c.fillStyle='#394638';c.fillRect(p.x-bw/2,yy,bw,4);c.fillStyle=col;c.fillRect(p.x-bw/2,yy,bw*ratio,4);
  for(let i=1;i<4;i++)line(c,[[p.x-bw/2+bw*i/4,yy],[p.x-bw/2+bw*i/4,yy+4]],'#233d2a33',.5);
  const markerY=yy-6*s,markerColor=active?FIELD_COLORS.selection:u.side==='enemy'?FIELD_COLORS.enemy:FIELD_COLORS.ally;
  if(u.id==='hero'){polygon(c,[[p.x,markerY-4*s],[p.x+4*s,markerY],[p.x,markerY+3*s],[p.x-4*s,markerY]],markerColor,IVORY,.8);}
  else if(u.side==='enemy')polygon(c,[[p.x-3*s,markerY-2*s],[p.x+3*s,markerY-2*s],[p.x,markerY+3*s]],markerColor,IVORY,.65);
  else oval(c,p.x,markerY,2.5*s,2.5*s,markerColor,0,IVORY,.65);
  const morale=!contest&&moraleState(u);if(morale){const x=p.x-bw/2-7*s;polygon(c,[[x,yy-3*s],[x+4*s,yy+5*s],[x-4*s,yy+5*s]],morale==='broken'?'#963f32':'#997432',IVORY,.7);c.fillStyle=IVORY;c.font=`bold ${Math.max(6,7*s)}px system-ui`;c.textAlign='center';c.fillText('!',x,yy+4*s);}
  if(!contest&&['archer','cavalry','heavy','escort'].includes(u.role)){c.fillStyle=markerColor;c.font=`bold ${Math.max(8,9*s)}px system-ui`;c.textAlign='center';c.fillText(({archer:'↗',cavalry:'»',heavy:'◆',escort:'○'})[u.role],p.x+bw/2+7*s,yy+4);}
  if(contest){c.fillStyle='#3f473c';c.font=`bold ${8*s}px system-ui`;c.textAlign='left';c.fillText('R',p.x-bw/2-8*s,yy+4);}
  if(u.moved&&u.acted){oval(c,p.x+bw/2+5*s,yy+1,4.8*s,4.8*s,IVORY);c.fillStyle='#426056';c.font=`bold ${8*s}px system-ui`;c.textAlign='center';c.fillText('✓',p.x+bw/2+5*s,yy+4*s);}
}
function labels(c,w,h,g,e,p,river){c.fillStyle='#dfd3b3';c.font='10px Georgia';c.textAlign='left';c.fillText(p.title,16,22);c.textAlign='right';c.fillText('N',w-20,20);line(c,[[w-23,30],[w-16,24]],'#c8be9d',1);line(c,[[w-21,25],[w-16,24],[w-17,29]],'#c8be9d',1);
  c.fillStyle='#e3dbc1';c.font='9px system-ui';c.textAlign='center';for(let i=0;i<e.width;i++){const q=xy(g,i,e.height);c.fillText(String(i+1),q.x,q.y+10);}for(let i=0;i<e.height;i++){const q=xy(g,e.width,i);c.fillText(String.fromCharCode(65+i),q.x,q.y+10);}
  if(river){c.font='9px system-ui';c.textAlign='left';c.fillText('× Deep water   ·   Pale stones mark the ford',14,h-12);}
}
// A shortest legal preview respects the same impassable and occupied cells as
// movement. This has no rule side effects and never invents a straight shortcut.
export function previewPath(e,unit,target){
  const key=p=>`${p.x},${p.y}`,start={x:unit.x,y:unit.y},queue=[{...start,cost:0}],costs=new Map([[key(start),0]]),parents=new Map();
  while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const cell=queue.shift();if(cell.x===target.x&&cell.y===target.y){const path=[{x:cell.x,y:cell.y}];let k=key(cell);while(parents.has(k)){const previous=parents.get(k);path.unshift(previous);k=key(previous);}return path;}
    if(cell.cost>0&&movementPinned(e,unit,cell))continue;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const next={x:cell.x+dx,y:cell.y+dy},k=key(next);if(next.x<0||next.y<0||next.x>=e.width||next.y>=e.height||['rock','river'].includes(terrain(e,next.x,next.y))||e.units.some(u=>u.id!==unit.id&&(u.resolve??u.hp??1)>0&&u.x===next.x&&u.y===next.y))continue;const cost=cell.cost+(terrain(e,next.x,next.y)==='marsh'&&unit.formation!=='line'?2:1);if(costs.has(k)&&costs.get(k)<=cost)continue;costs.set(k,cost);parents.set(k,{x:cell.x,y:cell.y});queue.push({...next,cost});}
  }return [];
}
let groundCache=null;
export function rendererCacheStats(){return {surfaces:groundCache?1:0,estimatedBytes:groundCache?groundCache.surface.width*groundCache.surface.height*4:0};}
export function clearBattleCache(){if(groundCache){groundCache.surface.width=1;groundCache.surface.height=1;}groundCache=null;}
function ground(c,w,h,g,e,p,chapter,river,quality,ratio){
  const key=[w,h,g.tw,g.oy,e.width,e.height,chapter,e.kind,quality,ratio,JSON.stringify(e.terrain),worldAssetKey(peekArt)].join('|');
  const draw=ctx=>{worldGround(ctx,w,h,g,e,p,chapter,quality);for(let depth=0;depth<e.width+e.height;depth++)for(let x=0;x<e.width;x++){const y=depth-x;if(y>=0&&y<e.height)tileSurface(ctx,g,e,p,x,y,river,chapter);};drawTerrainDetail(ctx,g,e,p,chapter,quality);environmentLight(ctx,w,h,g,e,p);};
  if(!c.canvas?.ownerDocument&&!globalThis.OffscreenCanvas){draw(c);return;}
  if(groundCache?.key!==key){
    clearBattleCache();const surface=typeof OffscreenCanvas==='function'?new OffscreenCanvas(Math.ceil(w*ratio),Math.ceil(h*ratio)):c.canvas.ownerDocument.createElement('canvas');surface.width=Math.ceil(w*ratio);surface.height=Math.ceil(h*ratio);const ctx=surface.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);draw(ctx);groundCache={key,surface};
  }
  c.drawImage(groundCache.surface,0,0,w,h);
}
function terrainObject(c,g,q,type,p){
  if(type!=='wall'){landform(c,g,q,type,p);return;}
  c.save();c.translate(q.x,q.y);if(!drawNaturalProp(c,'wall',g.tw*1.1))masonryWall(c,g.tw/60);c.restore();
}
function contactShadow(c,g,q,u,quality){
  const scale=spriteHeight(g,u)/72,mounted=['cavalry','heavy'].includes(u.role),lift=Math.max(0,-(u.bob??0));
  c.save();c.translate(q.x,q.y);c.globalAlpha*=Math.max(.55,1-lift*.08);
  if(quality!=='performance'){
    // The upper-left light casts a low, soft silhouette toward the foreground.
    c.save();c.rotate(.38);oval(c,15*scale,0,(mounted?29:24)*scale,(mounted?6:4.8)*scale,'#26312d20');
    oval(c,31*scale,0,(mounted?5:4.2)*scale,3*scale,'#26312d16');c.restore();
  }
  oval(c,1*scale,1.4*scale,(mounted?16:8.5)*scale,3.3*scale,'#1e302f45');
  if(quality==='high')oval(c,0,1*scale,(mounted?10:5)*scale,1.8*scale,'#1e302f23');
  c.restore();
}
export function paintBattle(c,w,h,g,e,selected,targets,focus,chapter,options={}){
  const p=scenePalette(chapter,e),river=e.terrain?.some(row=>row.some(t=>(typeof t==='string'?t:t?.type)==='ford')),quality=options.quality??'balanced',frame=options.animation??(Number.isFinite(options.ambientTime)?{time:options.ambientTime,unitOverrides:Object.fromEntries(e.units.filter(u=>!u.hidden&&(u.resolve??u.hp??1)>0).map(u=>[u.id,idlePose(u,options.ambientTime)])),effects:[]}:null);
  ground(c,w,h,g,e,p,chapter,river,quality,options.pixelRatio??1);
  tacticalOverlay(c,g,e,selected,targets,focus,options);
  const items=scenery(e,chapter,quality).map(item=>({...item,kind:'scenery'}));
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++){const type=terrain(e,x,y);if(['wall','high','hill','rubble','cover'].includes(type)||type==='rock'&&!river)items.push({kind:'terrain',type,x,y});}
  if(e.kind==='battle'&&Array.isArray(e.fieldworks))for(const fw of e.fieldworks)if(Number.isInteger(fw?.x)&&Number.isInteger(fw?.y))items.push({kind:'fieldwork',type:fw.type,x:fw.x,y:fw.y});
  const units=e.units.filter(u=>!u.hidden&&u.x>=0&&((u.resolve??u.hp??1)>0||(frame?.unitOverrides?.[u.id]?.alpha??0)>0)).map(u=>({...u,...frame?.unitOverrides?.[u.id],kind:'unit',original:u}));
  const s=Math.min(1.3,g.tw/48),watch=units.filter(u=>u.id===selected||u.id===options.target?.unitId).map(u=>xy(g,u.x,u.y));
  for(const feature of e.field?.objects??[])items.push({kind:'interactive-feature',x:feature.x,y:feature.y,feature});
  items.push(...units);items.sort((a,b)=>a.x+a.y-b.x-b.y||a.x-b.x||(a.kind==='unit'?1:-1));
  for(const item of items){const q=xy(g,item.x,item.y);c.save();
    if(item.kind==='unit'){
      const active=item.id===selected;c.globalAlpha=item.alpha??1;contactShadow(c,g,q,item,quality);baseMarker(c,q,s,item,active);
      if(item.role==='voter')seat(c,q.x,q.y,s*.8,item.bloc);
      if(!drawUnitSprite(c,g,q,item,chapter,e.kind==='contest',frame?.unitOverrides?.[item.id])){if(e.kind==='contest')orator(c,q,s,item,chapter);else warrior(c,q,s,item,chapter);}
    }else if(item.kind==='interactive-feature'){drawFieldFeature(c,g,q,item.feature);
    }else if(item.kind==='fieldwork'){
      drawFieldwork(c,g,q,item.type);
    }else{
      // Fade an occluder only when its upper silhouette covers an important unit.
      const overlap=watch.some(point=>Math.abs(point.x-q.x)<g.tw*.55&&q.y>point.y&&q.y-point.y<g.tw);
      if(overlap)c.globalAlpha=.38;
      if(item.kind==='terrain')terrainObject(c,g,q,item.type,p);else drawScenery(c,g,item,chapter);
    }c.restore();
  }
  atmosphere(c,w,h,g,chapter,e.kind==='contest',frame,quality,e);drawBattleEffects(c,g,frame,quality);
  // Information draws last, so props never hide selection or health/Resolve.
  for(const u of units){const q=xy(g,u.x,u.y);c.save();c.globalAlpha=u.alpha??1;status(c,g,q,s,{...u,promised:e.promises?.includes(u.id)},u.id===selected,e.kind==='contest');c.restore();}
  labels(c,w,h,g,e,p,river);
}
