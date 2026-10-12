// Regional architecture and vegetation. Hashes are presentation-only constants.
import {peekArt} from './art.js';
export const hash=(x,y,n=0)=>{const v=Math.sin(x*127.13+y*318.71+n*17.53)*41371.23;return v-Math.floor(v);};
export const iso=(g,x,y)=>({x:g.ox+(x-y)*g.tw/2,y:g.oy+(x+y)*g.th/2});
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
export function scenery(e,chapter){
  const items=[],chamber=e.kind==='contest',marsh=chapter===2,eastern=[5,6,9].includes(chapter);
  const add=(x,y,type,extra={})=>items.push({x,y,type,...extra});
  // Only outside the playable grid: set dressing cannot imply a new rule obstacle.
  if(chamber){
    for(let i=0;i<e.width;i+=2){add(i,-1.15,'column',{grand:chapter>=11});add(-1.15,i,'column',{grand:chapter>=11});}
    add(3,-1.65,'tribune',{grand:chapter>=11});add(-1.5,4,'brazier');add(5,-1.4,'brazier');
    if(chapter>=11){add(7,-1.3,'standard',{color:'#774b61'});add(-1.3,7,'standard',{color:'#774b61'});}
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
  }
  return items;
}
export function drawScenery(c,g,item,chapter){
  const p=iso(g,item.x,item.y),s=Math.max(.001,Math.min(1.5,g.tw/66));c.save();c.translate(p.x,p.y);
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
    case 'rock':block(c,0,0,21*s,9*s,12*s,['#b0a68c','#847f6c','#d5c8a6']);break;
  }c.restore();
}
export function worldGround(c,w,h,g,e,p,chapter,quality){
  const light=c.createLinearGradient(0,0,w,h);light.addColorStop(0,p.light);light.addColorStop(.48,p.ground);light.addColorStop(1,p.earth);c.fillStyle=light;c.fillRect(0,0,w,h);
  // An unbroken landscape surrounds the marked play area.
  for(let y=-5;y<e.height+6;y++)for(let x=-5;x<e.width+6;x++){
    const q=iso(g,x,y),inside=x>=0&&y>=0&&x<e.width&&y<e.height;
    if(q.x<-g.tw||q.y<-g.th||q.x>w+g.tw||q.y>h+g.th||inside)continue;
    const pts=[[q.x,q.y-g.th/2],[q.x+g.tw/2,q.y],[q.x,q.y+g.th/2],[q.x-g.tw/2,q.y]];
    if(p.chamber){poly(c,pts,(x+y)%2?'#b2a68a':'#c5b997','#81745c33');}
    else{poly(c,pts,hash(x,y)>.5?'#dace9d07':'#3e523607');if(quality!=='performance')for(let i=0;i<9;i++){const xx=q.x+(hash(x+i,y)-.5)*g.tw*.8,yy=q.y+(hash(x,y+i)-.5)*g.th*.8;line(c,[[xx,yy],[xx+2,yy-2]],'#6b734624',.7);}}
  }
  const vignette=c.createRadialGradient(w*.43,h*.38,Math.max(1,w*.12),w*.5,h*.5,Math.max(w,h)*.73);vignette.addColorStop(0,'#f6e7c100');vignette.addColorStop(.7,'#293c2a06');vignette.addColorStop(1,'#24372869');c.fillStyle=vignette;c.fillRect(0,0,w,h);
}

export function atmosphere(c,w,h,g,chapter,contest,frame,quality){
  if(quality==='performance')return;
  c.save();
  const veil=c.createLinearGradient(0,0,w,h);veil.addColorStop(0,contest?'#fff3c429':'#ffe6a913');veil.addColorStop(.55,'#f3e6ba00');veil.addColorStop(1,'#344c471b');c.fillStyle=veil;c.fillRect(0,0,w,h);
  if(contest){poly(c,[[w*.1,0],[w*.25,0],[w*.76,h],[w*.56,h]],'#fff5d410');poly(c,[[w*.35,0],[w*.4,0],[w*.94,h],[w*.8,h]],'#fff5d40b');}
  const time=frame?.time??0,count=quality==='high'?12:6;
  for(let i=0;i<count;i++){const x=(hash(i,chapter)*w+time*.003*(i%3+1))%w,y=(hash(i,14)*h+Math.sin(time/650+i)*2);oval(c,x,y,i%3===0?1.2:.65,i%3===0?1.2:.65,contest?'#ffe9b348':chapter===2?'#d4e0c332':'#eee1b137');}
  c.restore();
}
