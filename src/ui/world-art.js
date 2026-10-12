// Regional architecture and vegetation. Hashes are presentation-only constants.
import {peekArt} from './art.js';
import {stoneOutcrop,palmTree} from './material-forms.js';
import {paintMaterial,materialIndex,drawNaturalProp} from './ground-materials.js';
export const hash=(x,y,n=0)=>{const v=Math.sin(x*127.13+y*318.71+n*17.53)*41371.23;return v-Math.floor(v);};
export const iso=(g,x,y)=>({x:g.ox+(x-y)*g.tw/2,y:g.oy+(x+y)*g.th/2});
const validGrid=e=>Number.isInteger(e?.width)&&Number.isInteger(e?.height)&&e.width>0&&e.height>0&&e.width<=16&&e.height<=16;
const validGeometry=g=>[g?.ox,g?.oy,g?.tw,g?.th].every(Number.isFinite)&&g.tw>0&&g.th>0;
const terrainAt=(e,x,y)=>{const t=e.terrain?.[y]?.[x];return typeof t==='string'?t:t?.type||'grass';};
const poly=(c,pts,fill,stroke)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=.7;c.stroke();}};
const line=(c,pts,color,width=1)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const oval=(c,x,y,rx,ry,color)=>{c.beginPath();c.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,Math.PI*2);c.fillStyle=color;c.fill();};

function block(c,x,y,w,d,h,colors=['#c9b993','#948971','#e6d5ac']){
  poly(c,[[x-w,y],[x,y+d],[x,y+d-h],[x-w,y-h]],colors[0]);
  poly(c,[[x,y+d],[x+w,y],[x+w,y-h],[x,y+d-h]],colors[1]);
  poly(c,[[x-w,y-h],[x,y-d-h],[x+w,y-h],[x,y+d-h]],colors[2]);
}
function tree(c,s,variant=0){
  oval(c,s*5,s*3,s*21,s*7,'#172a2435');
  line(c,[[0,2*s],[1*s,-42*s]],'#65523d',4*s);
  line(c,[[0,-15*s],[-12*s,-30*s],[0,-23*s],[14*s,-39*s]],'#766248',2*s);
  for(let i=0;i<11;i++){const x=(hash(i,variant)-.5)*34*s,y=(-30-hash(i,4+variant)*19)*s;oval(c,x,y,(9+hash(i,3)*7)*s,(7+hash(i,8)*5)*s,i%3===0?'#a2aa69':i%3===1?'#697b4c':'#4e6545');}
}
function tent(c,s,red=false){
  oval(c,7*s,5*s,35*s,11*s,'#29322729');
  poly(c,[[-33*s,1*s],[-7*s,-36*s],[29*s,-20*s],[11*s,20*s]],red?'#a45940':'#d2be8e','#6b6248');
  poly(c,[[-33*s,1*s],[-7*s,-36*s],[11*s,20*s]],red?'#b7764e':'#e9d5a5');
  poly(c,[[-21*s,7*s],[-8*s,-23*s],[1*s,14*s]],'#514b38');
  line(c,[[-35*s,5*s],[-8*s,-37*s],[33*s,-21*s],[37*s,5*s]],'#f0d9ae',s);
  line(c,[[-8*s,-40*s],[-8*s,-31*s]],'#625038',2*s);
}
function standard(c,s,color='#8a3e32'){
  line(c,[[0,0],[0,-72*s]],'#594831',2*s);oval(c,0,-75*s,4*s,3*s,'#cda95f');
  poly(c,[[-13*s,-66*s],[13*s,-64*s],[13*s,-34*s],[0,-29*s],[-13*s,-35*s]],color,'#cfb274');
  line(c,[[-9*s,-61*s],[9*s,-60*s]],'#ddbd7b',s);oval(c,0,-48*s,5*s,6*s,'#caaa6e');
}
function column(c,s,grand){
  block(c,0,0,10*s,5*s,4*s);const h=(grand?76:49)*s;
  const gradient=c.createLinearGradient(-6*s,0,7*s,0);gradient.addColorStop(0,'#c4b597');gradient.addColorStop(.35,'#f3e3bb');gradient.addColorStop(1,'#938b78');
  c.fillStyle=gradient;c.fillRect(-6*s,-h,12*s,h-3*s);
  for(let i=-3;i<=3;i+=3)line(c,[[i*s,-h+4*s],[i*s,-8*s]],'#9d917f44',.65*s);
  block(c,0,-h,11*s,5*s,4*s);block(c,0,-h-4*s,13*s,5*s,4*s);
}
export function scenery(e,chapter,quality='balanced'){
  if(!validGrid(e))return [];
  const items=[],chamber=e.kind==='contest',marsh=chapter===2,eastern=[5,6,9].includes(chapter);
  const add=(x,y,type,extra={})=>items.push({x,y,type,...extra});
  // Only outside the playable grid: set dressing cannot imply a new rule obstacle.
  if(chamber){
    for(let i=0;i<e.width;i+=2){add(i,-1.15,'column',{grand:chapter>=11});add(-1.15,i,'column',{grand:chapter>=11});}
    add(3,-1.65,'tribune',{grand:chapter>=11});add(-1.5,4,'brazier');add(5,-1.4,'brazier');
    if(chapter>=11){add(7,-1.3,'standard',{color:'#774b61'});add(-1.3,7,'standard',{color:'#774b61'});}
    if(quality!=='performance'){
      add(-1.22,1.6,'bench',{grand:chapter>=11});add(5.6,-1.2,'bench',{grand:chapter>=11});
      add(-1.15,5.9,chapter===8?'amphorae':'table');
    }
  }else{
    for(let i=0;i<e.width;i+=1.8){
      add(i,-1.25,eastern?'ruin':marsh?'reeds':chapter===1?'palisade':'tree',{variant:i});
      add(-1.35,i,marsh?'reeds':eastern?'rock':'tree',{variant:i+8});
    }
    if([1,3,4,7].includes(chapter)){add(1,-1.6,'tent');add(4,-1.45,'tent',{red:true});add(5.2,-1.4,'standard');}
    if([4,5,10,12].includes(chapter)){add(6,-1.4,'tower');add(-1.3,6,'ruin');}
    if(chapter===6){add(1,-1.4,'wagon');add(5,-1.2,'ruin');}
    if(chapter===8){add(-1.2,4,'wagon');add(5,-1.45,'tent');}
    if(chapter===9){add(2,-1.6,'column');add(6,-1.3,'column');}
    add(e.width-.5,e.height+.9,eastern?'rock':marsh?'reeds':'shrub');
    add(e.width+.7,e.height-2,eastern?'ruin':marsh?'reeds':'shrub');
    if(quality!=='performance'){
      if([1,3,7].includes(chapter)){add(-1.15,2.7,'supplies');add(2.4,-1.3,'amphorae');}
      if(chapter===2){add(-1.2,2.8,'driftwood');add(4.4,-1.2,'reeds',{variant:18});}
      if([4,5,12].includes(chapter)){add(-1.15,3.1,'foundation');add(3.5,-1.3,'supplies');}
      if(chapter===6){add(-1.25,3,'amphorae');add(3.5,-1.3,'foundation');}
      if(chapter===8){add(-1.2,2.5,'mooring');add(2.8,-1.25,'amphorae');}
      if(chapter===9){add(-1.4,2.6,'palm');add(4.3,-1.3,'foundation');}
      if(chapter===10){add(-1.15,2.3,'amphorae');add(3.6,-1.2,'garden');add(-1.25,4.3,'foundation');}
      if(chapter===11){add(-1.15,2.8,'foundation');add(3.5,-1.25,'supplies');}
    }
  }
  return items;
}
export function drawScenery(c,g,item,chapter){
  if(!validGeometry(g)||![item?.x,item?.y].every(Number.isFinite))return;
  const p=iso(g,item.x,item.y),s=Math.max(.001,Math.min(1.5,g.tw/66));c.save();c.translate(p.x,p.y);
  const naturalType=item.type==='foundation'?'rubble':item.type;
  const naturalSize={rock:80,rubble:68,palm:154,tree:146,shrub:58,ruin:112,palisade:108,supplies:68,amphorae:55}[naturalType];
  if(naturalSize&&drawNaturalProp(c,naturalType,naturalSize*s,item.variant)){c.restore();return;}
  const sheet=peekArt('./assets/tactical/environment-props.webp');
  const artwork={tree:[Math.floor(item.variant)%3===0?1:0,128],shrub:[0,45],tent:[2,110],tower:[3,178],ruin:[4,72],column:[5,item.grand?162:120],reeds:[6,35],wagon:[7,82]}[item.type];
  if(sheet&&artwork){const [index,size]=artwork,h=size*s,w=h*.75;oval(c,5*s,3*s,w*.3,h*.055,'#26362930');c.drawImage(sheet,(index%4)*192,Math.floor(index/4)*256,192,256,-w/2,-h*240/256,w,h);c.restore();return;}
  switch(item.type){
    case 'tree':tree(c,s,item.variant);break;
    case 'shrub':c.scale(.65,.65);tree(c,s,item.variant);break;
    case 'tent':tent(c,s,item.red);break;
    case 'standard':standard(c,s,item.color);break;
    case 'column':column(c,s,item.grand);break;
    case 'tribune':block(c,0,0,40*s,18*s,11*s);block(c,0,-8*s,33*s,14*s,6*s);block(c,0,-14*s,24*s,10*s,6*s);poly(c,[[-5*s,-23*s],[-5*s,-52*s],[16*s,-43*s],[16*s,-15*s]],'#824b41');break;
    case 'brazier':block(c,0,0,5*s,3*s,22*s,['#66533a','#483d2d','#aa8150']);oval(c,0,-23*s,9*s,4*s,'#6c5638');poly(c,[[-5*s,-24*s],[-3*s,-36*s],[1*s,-31*s],[4*s,-39*s],[6*s,-25*s]],'#e6b86f');break;
    case 'palisade':for(let i=-2;i<=2;i++){const x=i*6*s,y=i*2*s;poly(c,[[x-2*s,y],[x-2*s,y-27*s],[x,y-34*s],[x+3*s,y-27*s],[x+3*s,y]],i%2?'#a28b62':'#897651','#675c43');}break;
    case 'reeds':for(let i=0;i<15;i++){const x=(hash(i,item.variant??2)-.5)*38*s,y=hash(i,8)*10*s;line(c,[[x,y],[x-3*s,y-(9+hash(i,3)*18)*s]],i%2?'#536d54':'#a5ac77',1.2*s);}break;
    case 'tower':block(c,0,0,26*s,13*s,64*s);for(let i=-1;i<=1;i++)block(c,i*17*s,-65*s+Math.abs(i)*7*s,7*s,4*s,8*s);poly(c,[[-5*s,-30*s],[-5*s,-45*s],[3*s,-42*s],[3*s,-27*s]],'#555e50');for(let i=0;i<4;i++)line(c,[[-24*s,(-10-i*13)*s],[0,(2-i*13)*s],[25*s,(-10-i*13)*s]],'#806e5655',s);break;
    case 'ruin':for(let i=0;i<3;i++)block(c,(i-1)*14*s,(i%2)*5*s,13*s,7*s,(13+i*8)*s);break;
    case 'wagon':block(c,0,-3*s,26*s,12*s,12*s,['#a58858','#735d3e','#c4a474']);for(const x of[-18,18]){oval(c,x*s,8*s,8*s,9*s,'#4e4738');oval(c,x*s,8*s,5*s,6*s,'#ad8e58');line(c,[[x*s,2*s],[x*s,14*s]],'#604c33',s);}for(let i=-1;i<=1;i++)oval(c,i*12*s,-15*s,10*s,7*s,'#dac69c');break;
    case 'rock':stoneOutcrop(c,s,item.x+item.y);break;
    case 'amphorae':
      oval(c,7*s,3*s,23*s,6*s,'#34402c26');
      for(let i=0;i<3;i++){const x=(i-1)*14*s,y=(i%2)*4*s;
        oval(c,x,y-8*s,7*s,10*s,i===1?'#a8724a':'#bc9161');
        oval(c,x-2*s,y-10*s,3*s,6*s,'#d3aa754c');
        line(c,[[x-4*s,y-14*s],[x-9*s,y-13*s],[x-8*s,y-7*s],[x-5*s,y-5*s]],'#927049',1.4*s);
        c.fillStyle='#bd9566';c.fillRect(x-3*s,y-22*s,6*s,7*s);oval(c,x,y-22*s,4*s,1.5*s,'#645a40');
      }break;
    case 'supplies':
      block(c,-7*s,0,16*s,8*s,12*s,['#a48a5e','#786344','#c8ab77']);
      line(c,[[-19*s,-8*s],[-7*s,-2*s],[8*s,-8*s]],'#dcc295',1.2*s);
      for(let i=0;i<3;i++){const x=(i*6+7)*s;oval(c,x,3*s,5*s,5*s,'#8c7651');line(c,[[x,0],[x-21*s,-13*s]],'#c3a875',3*s);}
      line(c,[[-2*s,-4*s],[8*s,2*s]],'#66583e',1.4*s);break;
    case 'bench':
      for(const x of [-22,16])block(c,x*s,0,5*s,3*s,9*s);
      block(c,-3*s,-9*s,31*s,7*s,4*s,item.grand?['#c4b898','#93866c','#e2d6b4']:['#b59b6e','#7c694b','#d2b887']);
      if(item.grand)poly(c,[[-21*s,-16*s],[-8*s,-22*s],[7*s,-14*s],[-6*s,-8*s]],'#7b4c5069');break;
    case 'table':
      block(c,0,0,16*s,7*s,15*s,['#a8906b','#706049','#d8c49b']);
      poly(c,[[-12*s,-16*s],[0,-21*s],[11*s,-16*s],[-1*s,-11*s]],'#efe0b8');
      for(let i=0;i<3;i++)line(c,[[(-7+i*3)*s,-16*s],[i*3*s,-13*s]],'#998665',.65*s);break;
    case 'foundation':
      oval(c,6*s,3*s,32*s,7*s,'#40483120');
      for(let i=0;i<4;i++){const x=(i-1.5)*15*s,y=i%2*3*s;block(c,x,y,10*s,5*s,(i===1?12:6)*s,['#b6ab8e','#887e65','#ddd0ad']);}
      line(c,[[-22*s,-3*s],[-11*s,-7*s],[-3*s,-3*s]],'#6e74524a',s);break;
    case 'driftwood':
      oval(c,4*s,2*s,25*s,6*s,'#3b584833');
      line(c,[[-22*s,-9*s],[16*s,5*s]],'#71684b',6*s);line(c,[[-22*s,-10*s],[16*s,4*s]],'#b1a47c',2*s);
      line(c,[[-5*s,-3*s],[3*s,-11*s],[10*s,-14*s]],'#8e8260',3*s);break;
    case 'mooring':
      for(const x of [-15,15]){block(c,x*s,0,4*s,3*s,17*s,['#948260','#695e44','#c5b088']);oval(c,x*s,-13*s,5*s,2*s,'#a3946e');}
      line(c,[[-15*s,-13*s],[0,-5*s],[15*s,-13*s]],'#c5b894',1.5*s);
      oval(c,3*s,4*s,9*s,3*s,'#7e7754');oval(c,3*s,3*s,7*s,2*s,'#c1b18a');break;
    case 'garden':
      for(let i=0;i<3;i++){const y=i*5*s;line(c,[[-22*s,y-10*s],[20*s,y+5*s]],'#826f4b66',3*s);
        for(let j=0;j<4;j++){const x=(-17+j*11)*s,yy=y+(j*4-7)*s;line(c,[[x,yy],[x-3*s,yy-4*s],[x,yy-2*s],[x+3*s,yy-5*s]],'#778253',1.3*s);}}
      break;
    case 'palm':palmTree(c,s);break;
  }c.restore();
}
export function worldGround(c,w,h,g,e,p,chapter,quality){
  if(!validGrid(e)||!validGeometry(g)||![w,h].every(Number.isFinite)||w<=0||h<=0)return;
  c.fillStyle=p.chamber?(p.stone??p.ground):p.ground;c.fillRect(0,0,w,h);
  const textured=paintMaterial(c,g,{x:0,y:0,w,h},materialIndex(chapter===2?'marsh':'grass',chapter,p.chamber),p.chamber?.74:.86);
  if(!textured){
    // Deterministic broad mottling is an honest low-cost missing-art fallback.
    const light=c.createLinearGradient(0,0,w,h);light.addColorStop(0,p.light);light.addColorStop(.4,p.ground);light.addColorStop(1,p.earth);c.fillStyle=light;c.fillRect(0,0,w,h);
    for(let i=0;i<55;i++){const x=hash(i,chapter)*w,y=hash(i,chapter+1)*h;oval(c,x,y,4+hash(i,2)*26,2+hash(i,4)*12,i%2?'#283b3020':'#b9af7720');}
  }
  // Water already present at the legal edge continues into the surrounding land.
  for(let y=-3;y<e.height+3;y++)for(let x=-3;x<e.width+3;x++){
    if(x>=0&&y>=0&&x<e.width&&y<e.height)continue;
    const q=iso(g,x,y);if(q.x<-g.tw||q.y<-g.th||q.x>w+g.tw||q.y>h+g.th)continue;
    const edge=terrainAt(e,Math.max(0,Math.min(e.width-1,x)),Math.max(0,Math.min(e.height-1,y)));
    if(!['water','river','deepwater','ford','marsh'].includes(edge)||p.chamber)continue;
    c.save();poly(c,[[q.x,q.y-g.th/2],[q.x+g.tw/2,q.y],[q.x,q.y+g.th/2],[q.x-g.tw/2,q.y]],p.water);c.clip();
    paintMaterial(c,g,{x:q.x-g.tw/2,y:q.y-g.th/2,w:g.tw,h:g.th},materialIndex(edge,chapter),.78);c.restore();
  }
  if(p.chamber){
    // A single opus-sectile composition spans the chamber, independent of cells.
    const corners=[iso(g,-.8,-.8),iso(g,e.width-.2,-.8),iso(g,e.width-.2,e.height-.2),iso(g,-.8,e.height-.2)].map(q=>[q.x,q.y]);
    line(c,[...corners,corners[0]],'#26362fa0',Math.max(3,g.tw*.13));line(c,[...corners,corners[0]],p.inlay??'#657264',Math.max(1,g.tw*.06));
    const q=iso(g,(e.width-1)/2,(e.height-1)/2),r=g.tw*Math.min(e.width,e.height)*.2;
    c.save();c.translate(q.x,q.y);c.scale(1,.48);
    c.beginPath();c.ellipse(0,0,r,r,0,0,Math.PI*2);c.strokeStyle=p.inlay+'88';c.lineWidth=Math.max(1,g.tw*.025);c.stroke();
    c.beginPath();c.ellipse(0,0,r*.94,r*.94,0,0,Math.PI*2);c.strokeStyle='#e1d5ad4d';c.lineWidth=Math.max(1,g.tw*.03);c.stroke();
    for(let i=0;i<8;i++){const a=i*Math.PI/4;poly(c,[[0,0],[Math.cos(a-.08)*r*.75,Math.sin(a-.08)*r*.75],[Math.cos(a)*r*.86,Math.sin(a)*r*.86],[Math.cos(a+.08)*r*.75,Math.sin(a+.08)*r*.75]],i%2?p.inlay+'38':'#536b6330');}c.restore();
  }
}

export function atmosphere(c,w,h,g,chapter,contest,frame,quality){
  if(quality==='performance'||![w,h].every(Number.isFinite)||w<=0||h<=0)return;
  c.save();
  const veil=c.createLinearGradient(0,0,w,h);veil.addColorStop(0,contest?'#fff3c429':'#ffe6a913');veil.addColorStop(.55,'#f3e6ba00');veil.addColorStop(1,'#344c471b');c.fillStyle=veil;c.fillRect(0,0,w,h);
  if(contest){poly(c,[[w*.1,0],[w*.25,0],[w*.76,h],[w*.56,h]],'#fff5d410');poly(c,[[w*.35,0],[w*.4,0],[w*.94,h],[w*.8,h]],'#fff5d40b');}
  const time=frame?.time??0,count=quality==='high'?12:6;
  for(let i=0;i<count;i++){const x=(hash(i,chapter)*w+time*.003*(i%3+1))%w,y=(hash(i,14)*h+Math.sin(time/650+i)*2);oval(c,x,y,i%3===0?1.2:.65,i%3===0?1.2:.65,contest?'#ffe9b348':chapter===2?'#d4e0c332':'#eee1b137');}
  c.restore();
}
