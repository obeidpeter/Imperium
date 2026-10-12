// Procedural fresco illustration and isometric battlefield presentation.
import {paintBattle} from './battle-art.js';
import {GRAPHICS_MODES} from './graphics-quality.js';
const P={red:'#782e28',gold:'#c0a260',cream:'#f0dfb6',ink:'#253c34',olive:'#707a57'};
function setup(canvas,r=canvas.getBoundingClientRect(),maxPixelRatio=2){const w=Math.max(1,r.width||640),h=Math.max(1,r.height||400);const d=Math.min(globalThis.devicePixelRatio||1,maxPixelRatio);if(canvas.width!==Math.round(w*d))canvas.width=Math.round(w*d);if(canvas.height!==Math.round(h*d))canvas.height=Math.round(h*d);const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);return {c,w,h,d};}
function noise(x,y,seed=1){const n=Math.sin(x*127.1+y*311.7+seed*23.23)*43758.5453;return n-Math.floor(n);}
function poly(c,points,fill,stroke){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();}
function texture(c,w,h,step=9,alpha=.055){c.save();for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const n=noise(x,y);c.fillStyle=n>.5?`rgba(255,244,208,${alpha*n})`:`rgba(31,35,24,${alpha*(1-n)})`;c.fillRect(x+.6,y+.6,step-1.2,step-1.2);}c.restore();}
function laurel(c,x,y,r,color){c.save();c.strokeStyle=color;c.lineWidth=1.5;for(const sign of [-1,1]){c.beginPath();c.arc(x,y,r,sign===1?-.12:.55,sign===1?2.6:3.25,sign===-1);c.stroke();for(let i=0;i<9;i++){const a=(sign===1?-.1:Math.PI+.1)+sign*i*.15;const xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r;c.save();c.translate(xx,yy);c.rotate(a+sign*.7);ellipse(c,0,0,7,3,color);c.restore();}}c.restore();}
export function drawPortrait(canvas,{chapter=1,name='',role='hero',rank=''}={}){if(!canvas)return;const {c,w,h}=setup(canvas);c.fillStyle=role==='rival'?'#a79873':chapter>=11?'#784038':'#8b9779';c.fillRect(0,0,w,h);const s=Math.min(w/240,h/240);c.save();c.translate(w/2,h*.48);c.scale(s,s);ellipse(c,0,1,91,105,'#c4bc91');c.lineWidth=2;c.strokeStyle='#e0d1a4';c.strokeRect(-100,-109,200,221);
const older=chapter>=6,imperial=rank==='Augustus',senator=rank==='Senator',cloak=imperial?'#673652':chapter>=9?'#89372d':chapter>=5?'#7e4130':'#dbd2b2';poly(c,[[-98,137],[-86,68],[-35,43],[29,43],[89,72],[102,137]],cloak);poly(c,[[-37,45],[-14,38],[24,41],[45,54],[31,136],[-39,136]],chapter>=2&&chapter<10?'#666d63':'#e6ddbf');if(chapter>=2&&chapter<10){for(let y=63;y<135;y+=7)for(let x=-32;x<37;x+=7){c.strokeStyle='#adb2a0';c.lineWidth=.8;c.beginPath();c.arc(x+(y%2)*2,y,3,0,Math.PI);c.stroke();}}if(chapter>=7){c.fillStyle=imperial?'#d8b461':'#6f3c4f';c.fillRect(15,65,senator?18:7,75);}poly(c,[[-22,31],[-25,64],[0,79],[25,58],[21,26]],'#b48c64');poly(c,[[-41,-52],[-28,-83],[19,-85],[44,-53],[39,13],[19,48],[-9,51],[-34,23]],'#c79e72');poly(c,[[12,-81],[38,-58],[33,16],[16,43],[5,27],[14,-7]],'#ab7e56');poly(c,[[-42,-35],[-44,-61],[-28,-86],[8,-94],[35,-75],[45,-54],[39,-30],[24,-61],[1,-68],[-27,-57]],older?'#686753':'#403f33');if(older){poly(c,[[-34,5],[-20,25],[4,35],[25,14],[29,25],[15,49],[-8,53],[-28,29]],'#75715a');c.fillStyle='#ddcba1';c.fillRect(-32,-3,14,2);c.fillRect(16,-3,13,2);}c.fillStyle='#343d32';c.fillRect(-28,-26,17,4);c.fillRect(11,-26,15,4);ellipse(c,-19,-19,2.5,2,'#252a25');ellipse(c,19,-19,2.5,2,'#252a25');poly(c,[[0,-22],[-7,4],[5,6]],'#97714f');c.fillStyle='#6a4e39';c.fillRect(-10,20,21,2);if(chapter>=4){c.strokeStyle='#ead4ac';c.lineWidth=2;c.beginPath();c.moveTo(23,-14);c.lineTo(16,12);c.stroke();}if(imperial){for(let i=-4;i<=4;i++){c.save();c.translate(i*8,-63+Math.abs(i)*-2);c.rotate(i*.1);ellipse(c,0,0,7,3,'#d4b36a');c.restore();}}ellipse(c,-48,70,7,7,P.gold);c.fillStyle='#595b4c';c.fillRect(-4,84,12,16);c.fillStyle='#c9c4ad';c.fillRect(-3,85,10,13);c.strokeStyle='#837d60';c.lineWidth=1;c.beginPath();c.moveTo(-6,63);c.lineTo(2,86);c.lineTo(17,59);c.stroke();c.restore();texture(c,w,h,7,.13);c.strokeStyle='#e5cf97aa';c.lineWidth=1;c.strokeRect(9,9,w-18,h-18);}
function column(c,x,y,w,h){c.fillStyle='#d1c5a1';c.fillRect(x,y,w,h);c.fillStyle='#a89f82';c.fillRect(x+w*.68,y,w*.32,h);c.fillStyle='#e5d6af';c.fillRect(x-3,y-5,w+6,6);c.fillRect(x-3,y+h-2,w+6,6);}
function standard(c,x,y,s=1,color=P.red){c.save();c.translate(x,y);c.scale(s,s);c.strokeStyle='#312f24';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo(0,-95);c.stroke();poly(c,[[-4,-94],[-16,-101],[-17,-109],[-4,-104],[0,-110],[5,-104],[17,-109],[16,-100],[5,-94]],P.gold);c.fillStyle=color;c.fillRect(-13,-86,26,33);c.fillStyle='#d7bd82';c.font='bold 7px Georgia';c.textAlign='center';c.fillText('SPQR',0,-71);c.strokeStyle='#baa061';c.strokeRect(-11,-84,22,27);c.restore();}
function soldier(c,x,y,s=1,color=P.red,hero=false,role='soldier',chapter=1){c.save();c.translate(x,y);c.scale(s,s);ellipse(c,0,1,11,4,'#17291b30');if(hero)standard(c,10,-2,.54,color);c.fillStyle='#45493e';c.fillRect(-5,-16,4,17);c.fillRect(3,-16,4,17);poly(c,[[-8,-34],[7,-34],[11,-14],[-10,-14]],color);c.fillStyle=chapter>1?'#8e9585':'#cfbea0';c.fillRect(-6,-32,12,16);if(chapter>1){c.strokeStyle='#4e5549';c.lineWidth=.8;for(let yy=-30;yy<-16;yy+=3){c.beginPath();c.moveTo(-5,yy);c.lineTo(5,yy);c.stroke();}}ellipse(c,0,-40,6,7,'#c8a67a');poly(c,[[-7,-41],[-5,-48],[3,-49],[7,-44],[7,-40]],'#bbb9a0');c.fillStyle='#676d61';c.fillRect(-7,-41,14,2);c.strokeStyle='#4b4c3b';c.lineWidth=1.5;c.beginPath();c.moveTo(9,-15);c.lineTo(12,-55);c.stroke();ellipse(c,-8,-23,7,12,color);c.strokeStyle='#d7c292';c.lineWidth=1.5;c.beginPath();c.ellipse(-8,-23,6,11,0,0,Math.PI*2);c.stroke();ellipse(c,-8,-23,2,3,'#c7b484');if(role==='cavalry'||role==='heavy'){ellipse(c,8,0,16,9,'#746650');c.fillStyle='#564934';c.fillRect(1,0,3,11);c.fillRect(19,-1,3,12);poly(c,[[14,-4],[22,-21],[29,-21],[30,-12],[22,-8]],'#827257');}c.restore();}
export function drawScene(canvas,{chapter=1,variant='camp'}={}){if(!canvas)return;const {c,w,h}=setup(canvas);const title=variant==='title',sand=chapter===5||chapter===6||chapter===9,rome=chapter>=11;const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,sand?'#bfba8c':'#b6c0a5');sky.addColorStop(.5,'#d7cfaa');sky.addColorStop(1,'#9c9f75');c.fillStyle=sky;c.fillRect(0,0,w,h);ellipse(c,w*.69,h*.23,h*.074,h*.074,'#eddbab');for(let j=0;j<3;j++){let pts=[[0,h]];for(let x=0;x<=w+30;x+=28)pts.push([x,h*(.38+j*.07)-noise(x,37+j)*h*.14]);pts.push([w,h]);poly(c,pts,['#9eaa8a','#869674','#758267'][j]);}poly(c,[[0,h*.61],[w*.31,h*.54],[w*.58,h*.67],[w,h*.57],[w,h],[0,h]],sand?'#b1a477':'#8a9570');if(!sand){poly(c,[[w*.87,h*.42],[w*.73,h*.6],[w*.93,h*.82],[w*.8,h],[w*.27,h],[w*.61,h*.7],[w*.61,h*.61]],'#91b1a0');for(let i=0;i<35;i++){c.fillStyle='#cfdbc044';c.fillRect(w*(.6+noise(i,3)*.28),h*(.62+noise(i,1)*.32),noise(i,4)*50+5,1);}}const fy=h*(title?.46:.4),fx=w*(title?.17:.18),fw=w*(title?.62:.62);c.fillStyle='#bdba94';c.fillRect(fx,fy,fw,h*.18);c.fillStyle='#979f7e';c.fillRect(fx,fy+h*.14,fw,h*.05);for(let i=0;i<10;i++){c.fillStyle=i%2?'#c3b992':'#d0c5a0';c.fillRect(fx+i*fw/10,fy-8,fw/20,10);}for(const xx of [fx,fx+fw*.45,fx+fw]){c.fillStyle='#b8b18a';c.fillRect(xx-10,fy-30,23,h*.27);c.fillStyle='#cec29b';c.fillRect(xx-14,fy-36,31,10);for(let j=0;j<3;j++){c.fillStyle='#ded0a5';c.fillRect(xx-13+j*11,fy-43,7,10);}c.fillStyle='#636e58';c.fillRect(xx-3,fy-19,7,14);}c.fillStyle='#54634e';c.fillRect(fx+fw*.22,fy+10,fw*.17,h*.16);ellipse(c,fx+fw*.305,fy+10,fw*.085,13,'#54634e');if(rome){const tx=w*.56,ty=fy-h*.14;for(let i=0;i<5;i++)column(c,tx+i*18,ty,9,h*.2);poly(c,[[tx-13,ty-6],[tx+39,ty-38],[tx+91,ty-6]],'#dccfab');c.fillStyle='#c0b28c';c.fillRect(tx-15,ty-7,110,8);}poly(c,[[0,h*.9],[w*.38,h*.72],[w*.67,h],[0,h]],'#9b8e64');if(title){for(let row=0;row<4;row++)for(let i=0;i<7-row;i++)soldier(c,w*.08+i*24+row*13,h*.8+row*26,.7+row*.07,row===3?'#774032':'#735949',false,'soldier',4);standard(c,w*.29,h*.8,1.15);soldier(c,w*.64,h*1.02,3.1,P.red,true,'soldier',5);standard(c,w*.75,h*1.1,2.5);}else{for(let i=0;i<7;i++)soldier(c,w*.16+i*28,h*.92,.75,P.red,i===3,'soldier',chapter);standard(c,w*.37,h*.88,.72);}for(let i=0;i<8;i++){const tx=noise(i,44)*w,ty=h*(.69+noise(i,12)*.26);if(tx>w*.65&&!sand){c.fillStyle='#58684c';c.fillRect(tx,ty-20,3,25);poly(c,[[tx-10,ty-12],[tx+2,ty-42],[tx+12,ty-12]],'#617550');}}texture(c,w,h,7,title?.13:.08);const vignette=c.createLinearGradient(0,h*.7,0,h);vignette.addColorStop(0,'#233a2900');vignette.addColorStop(1,'#1e332f66');c.fillStyle=vignette;c.fillRect(0,0,w,h);c.strokeStyle='#d3bc7c';c.lineWidth=1;c.strokeRect(10,10,w-20,h-20);}
const battleLaidOut=r=>Number.isFinite(r.width)&&Number.isFinite(r.height)&&r.width>34&&r.height>80;
function geometryFromRect(r,e){const w=Number.isFinite(r.width)?Math.max(0,r.width):0,h=Number.isFinite(r.height)?Math.max(0,r.height):0;
  // Preserve the board fit at normal sizes; transient collapsed layouts must
  // never create negative radii or divide-by-zero coordinates in consumers.
  const tw=Math.max(.01,Math.min((w-34)/(Math.max(e.width,e.height)||8),(h-80)/((e.width+e.height)*.24))),th=tw*.48;
  return {w,h,tw,th,ox:w/2,oy:h/2-(e.width+e.height)*th/4+15};
}
export function geometry(canvas,e){return geometryFromRect(canvas.getBoundingClientRect(),e);} 
function coord(g,x,y){return {x:g.ox+(x-y)*g.tw/2,y:g.oy+(x+y)*g.th/2};}
export function pickTile(canvas,e,clientX,clientY){const r=canvas.getBoundingClientRect();if(!battleLaidOut(r))return {x:-1,y:-1};const g=geometryFromRect(r,e),sx=clientX-r.left-g.ox,sy=clientY-r.top-g.oy;return {x:Math.round(sy/g.th+sx/g.tw),y:Math.round(sy/g.th-sx/g.tw)};}
const terrains={grass:'#b6bb8b',earth:'#b8a078',marsh:'#839a79',water:'#779e99',river:'#789f99',deepwater:'#496f70',rock:'#727d71',ford:'#a7b69b',sand:'#c5b388',stone:'#b4afa0',wall:'#b1ae98',high:'#b6b497',hill:'#bab68f',chamber:'#c8b995',road:'#d0c19d',gate:'#ad9e7e',rubble:'#ada186',cover:'#a9ad8a'};
function terrainAt(e,x,y){const t=e.terrain?.[y]?.[x];return typeof t==='string'?t:(t?.type||'grass');}
// Optional action is presentation-only; normal board geometry is unchanged.
export function drawBattle(canvas,e,selected='hero',targets=[],focus=null,chapter=1,options={}){
  if(!canvas||!e)return;
  const rect=canvas.getBoundingClientRect();if(!battleLaidOut(rect))return;
  const {c,w,h,d}=setup(canvas,rect,GRAPHICS_MODES[options.quality??'balanced']?.maxPixelRatio??1.5),g=geometryFromRect(rect,e);
  paintBattle(c,w,h,g,e,selected,targets,focus,chapter,{...options,pixelRatio:d});
}
// The optional image elements must already be loaded locally by the UI.
export function drawReignCard(canvas,{name='',route,choices=[],url='',portrait=null,scene=null}){
  canvas.width=1080;canvas.height=1350;const c=canvas.getContext('2d');
  const charcoal='#222823',ivory='#f2e8d2',bronze='#b6a077';
  c.fillStyle=charcoal;c.fillRect(0,0,1080,1350);
  const backdrop=c.createLinearGradient(0,0,1080,1350);backdrop.addColorStop(0,'#394035');backdrop.addColorStop(.58,'#302d2e');backdrop.addColorStop(1,'#302630');c.fillStyle=backdrop;c.fillRect(0,0,1080,1350);
  function cover(img,x,y,w,h,align=.5){if(!img||(img.complete===false))return false;const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;if(!iw||!ih)return false;const scale=Math.max(w/iw,h/ih),sw=w/scale,sh=h/scale;c.drawImage(img,(iw-sw)/2,(ih-sh)*align,sw,sh,x,y,w,h);return true;}
  if(scene){c.save();c.globalAlpha=.18;cover(scene,0,0,1080,820,.45);c.restore();}
  c.save();c.beginPath();c.rect(100,132,880,578);c.clip();
  if(!cover(portrait,180,124,720,670,.12)){
    const halo=c.createRadialGradient(540,355,40,540,380,390);halo.addColorStop(0,'#b5a77a50');halo.addColorStop(1,'#35433600');c.fillStyle=halo;c.fillRect(120,132,840,590);
    c.save();c.translate(540,430);c.scale(2.75,2.75);
    poly(c,[[-99,114],[-85,40],[-36,18],[36,18],[83,45],[103,114]],'#684352');
    poly(c,[[-30,22],[-14,11],[20,16],[40,35],[24,115],[-35,115]],'#d7ccb0');
    poly(c,[[14,23],[25,28],[16,115],[5,115]],'#79505e');
    poly(c,[[-20,4],[-21,30],[0,44],[21,25],[18,0]],'#af8764');
    poly(c,[[-33,-59],[-21,-83],[13,-84],[34,-62],[29,-11],[15,18],[-8,20],[-30,-9]],'#c5a07b');
    poly(c,[[8,-80],[31,-61],[27,-12],[15,12],[6,-2],[12,-29]],'#a87f5d');
    poly(c,[[-35,-45],[-34,-67],[-19,-88],[10,-93],[30,-76],[35,-58],[29,-41],[19,-65],[-4,-69],[-23,-58]],'#888573');
    poly(c,[[-26,-11],[-16,7],[2,14],[21,-4],[21,6],[13,20],[-7,25],[-23,6]],'#777668');
    lineCard(c,[[-24,-38],[-11,-39]],'#594f3f',2);lineCard(c,[[10,-39],[23,-38]],'#594f3f',2);
    ellipse(c,-16,-32,2,1.8,'#313b32');ellipse(c,16,-32,2,1.8,'#313b32');poly(c,[[0,-36],[-5,-16],[6,-15]],'#967252');lineCard(c,[[-8,-1],[10,0]],'#74543e',1.4);
    for(let i=-3;i<=3;i++){c.save();c.translate(i*8,-66-Math.abs(i)*2);c.rotate(i*.12);ellipse(c,0,0,6,2.7,'#bba169');c.restore();}
    ellipse(c,-39,44,6,6,'#c8aa6d');lineCard(c,[[-33,47],[-18,63],[8,73]],'#a87975',1);c.restore();
  }
  const fade=c.createLinearGradient(0,460,0,735);fade.addColorStop(0,'#29292a00');fade.addColorStop(.7,'#2d2c2bd4');fade.addColorStop(1,'#2d2c2b');c.fillStyle=fade;c.fillRect(90,460,900,280);c.restore();
  c.textAlign='center';c.fillStyle=bronze;c.font='26px Georgia';c.fillText('S A C R A M E N T U M',540,85);lineCard(c,[[502,111],[578,111]],'#b6a07788',1);
  // A modest lead seal recalls the recruit without revealing any character fate.
  lineCard(c,[[529,659],[522,678],[540,704],[558,677],[550,659]],'#958c715c',1.5);
  ellipse(c,540,701,25,27,'#a7a798');ellipse(c,539,699,21,23,'#858b81');c.strokeStyle='#c9c5ab';c.lineWidth=1;c.beginPath();c.ellipse(539,699,18,20,-.08,0,Math.PI*2);c.stroke();c.fillStyle='#4b5b52';c.font='23px Georgia';c.fillText('A',539,707);lineCard(c,[[533,683],[529,708]],'#bcc1ab66',1);
  c.fillStyle='#c8bda6';c.font='italic 33px Georgia';c.fillText('The purple is earned.',540,773);
  function lines(text,width,size,font='Georgia'){
    c.font=size+'px '+font;const words=String(text).trim().split(/\s+/),out=[];let current='';
    for(const word of words){const candidate=current?current+' '+word:word;if(c.measureText(candidate).width<=width){current=candidate;continue;}if(current){out.push(current);current='';}if(c.measureText(word).width<=width){current=word;continue;}for(const ch of Array.from(word)){if(c.measureText(current+ch).width>width){out.push(current);current='';}current+=ch;}}
    if(current)out.push(current);return out;
  }
  function fittedLines(text,width,size,maxLines,min=18,font='Georgia'){let list=lines(text,width,size,font);while(list.length>maxLines&&size>min){size--;list=lines(text,width,size,font);}return {list,size,font};}
  const emperor=fittedLines(String(name).slice(0,40),900,58,2,38);c.fillStyle=ivory;c.font=emperor.size+'px Georgia';emperor.list.forEach((text,i)=>c.fillText(text,540,(emperor.list.length===1?863:832)+i*(emperor.size+8)));
  const routeText=route==='battle'||route==='backer'?'An emperor forged in battle':'Acclaimed without a final assault';const manner=fittedLines(routeText,900,28,2,22);c.fillStyle='#d1c5b0';c.font=manner.size+'px Georgia';manner.list.forEach((text,i)=>c.fillText(text,540,948+i*34));
  lineCard(c,[[430,995],[650,995]],'#b6a07766',1);
  choices.slice(0,3).forEach((choice,i)=>{const content=fittedLines(choice,850,26,2,18);c.fillStyle=ivory;c.font=content.size+'px Georgia';content.list.forEach((text,j)=>c.fillText(text,540,1050+i*60+j*(content.size+4)));});
  const destination=fittedLines(url,900,18,2,12,'system-ui');c.fillStyle='#b8aa91';c.font=destination.size+'px system-ui';destination.list.forEach((text,i)=>c.fillText(text,540,1254+i*(destination.size+5)));
  c.fillStyle=bronze;c.font='17px Georgia';c.fillText('FROM RECRUIT TO EMPEROR',540,1320);
  lineCard(c,[[42,50],[42,1300]],'#b6a0773b',1);lineCard(c,[[1038,50],[1038,1300]],'#b6a0773b',1);
}
function lineCard(c,points,color,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
