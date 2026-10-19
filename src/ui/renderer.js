// Procedural fresco illustration and isometric battlefield presentation.
import {paintBattle} from './battle-art.js';
import {GRAPHICS_MODES} from './graphics-quality.js';
import {spriteHeight} from './unit-sprites.js';
function setup(canvas,r=canvas.getBoundingClientRect(),maxPixelRatio=2){const w=Math.max(1,r.width||640),h=Math.max(1,r.height||400);const d=Math.min(globalThis.devicePixelRatio||1,maxPixelRatio);if(canvas.width!==Math.round(w*d))canvas.width=Math.round(w*d);if(canvas.height!==Math.round(h*d))canvas.height=Math.round(h*d);const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);return {c,w,h,d};}
function poly(c,points,fill,stroke){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();}
const battleLaidOut=r=>Number.isFinite(r.width)&&Number.isFinite(r.height)&&r.width>34&&r.height>80;
function geometryFromRect(r,e){const w=Number.isFinite(r.width)?Math.max(0,r.width):0,h=Number.isFinite(r.height)?Math.max(0,r.height):0;
  if(e.featureEdition===31){
    // Reserve a full mounted figure above the far corner and centre rectangular
    // boards by their actual diamond bounds. Tile picking shares this geometry.
    const span=e.width+e.height,tw=Math.max(.01,Math.min((w-48)/(span/2),(h-48)/((span-1)*.24+1.62))),th=tw*.48;
    const headroom=1.62*tw,total=headroom+(span-1)*th/2;
    return {w,h,tw,th,ox:w/2-(e.width-e.height)*tw/4,oy:(h-total)/2+headroom};
  }
  // Preserve the board fit at normal sizes; transient collapsed layouts must
  // never create negative radii or divide-by-zero coordinates in consumers.
  const tw=Math.max(.01,Math.min((w-34)/(Math.max(e.width,e.height)||8),(h-80)/((e.width+e.height)*.24))),th=tw*.48;
  return {w,h,tw,th,ox:w/2,oy:h/2-(e.width+e.height)*th/4+15};
}
export function geometry(canvas,e){return geometryFromRect(canvas.getBoundingClientRect(),e);} 
export function pickTile(canvas,e,clientX,clientY){const r=canvas.getBoundingClientRect();if(!battleLaidOut(r))return {x:-1,y:-1};const g=geometryFromRect(r,e),sx=clientX-r.left-g.ox,sy=clientY-r.top-g.oy;return {x:Math.round(sy/g.th+sx/g.tw),y:Math.round(sy/g.th-sx/g.tw)};}
// The player may point at a soldier's body, not only the small tile at its feet.
// Front-most living visible figures win overlaps, matching the painter order.
export function pickBattlePoint(canvas,e,clientX,clientY){
  const r=canvas.getBoundingClientRect();if(!battleLaidOut(r))return {x:-1,y:-1};
  const g=geometryFromRect(r,e),px=clientX-r.left,py=clientY-r.top;
  const units=e.units.filter(u=>!u.hidden&&(u.resolve??u.hp??0)>0).sort((a,b)=>(b.x+b.y)-(a.x+a.y));
  for(const u of units){const h=spriteHeight(g,u),x=g.ox+(u.x-u.y)*g.tw/2,y=g.oy+(u.x+u.y)*g.th/2;
    if(px>=x-h*.27&&px<=x+h*.27&&py>=y-h*.87&&py<=y+h*.025)return {x:u.x,y:u.y,unitId:u.id};
  }
  return pickTile(canvas,e,clientX,clientY);
}
// Optional action is presentation-only; normal board geometry is unchanged.
export function drawBattle(canvas,e,selected='hero',targets=[],focus=null,chapter=1,options={}){
  if(!canvas||!e)return;
  const rect=canvas.getBoundingClientRect();if(!battleLaidOut(rect))return;
  const {c,w,h,d}=setup(canvas,rect,GRAPHICS_MODES[options.quality??'balanced']?.maxPixelRatio??1.5),g=geometryFromRect(rect,e);
  paintBattle(c,w,h,g,e,selected,targets,focus,chapter,{...options,pixelRatio:d});
}
export const REIGN_CARD_THEMES=Object.freeze({
  imperial:{id:'imperial',label:'Imperial Purple',charcoal:'#222823',ivory:'#f2e8d2',bronze:'#b6a077',stops:['#394035','#302d2e','#302630'],fadeEnd:'#2d2c2b',subtitle:'#c8bda6',muted:'#b8aa91'},
  marble:{id:'marble',label:'Senatorial Marble',charcoal:'#2a2926',ivory:'#f7f1e3',bronze:'#c7a86c',stops:['#48453d','#393630','#2d2a25'],fadeEnd:'#2f2c27',subtitle:'#ddd2bc',muted:'#c7bba2'},
  bronze:{id:'bronze',label:'Legionary Bronze',charcoal:'#231f1b',ivory:'#f4e7ce',bronze:'#d1a559',stops:['#3e3226','#2f251d','#241c16'],fadeEnd:'#282019',subtitle:'#d8c3a0',muted:'#bfa986'},
});
export function reignLaurels(state){
  if(!state)return ['SACRAMENTUM ENDURED'];
  const laurels=[],history=state.history||[],pledges=[...(state.obligations||[]),...(state.progression?.agreements||[])];
  if(history.length>0&&history.every(h=>(h.losses||0)===0))laurels.push('FIRST COHORT UNBROKEN');
  if(pledges.some(o=>o.status==='honoured')&&!pledges.some(o=>o.status==='broken'))laurels.push('KEEPER OF THE WORD');
  if((state.meters?.political??0)>=50||['settlement','surrender'].includes(state.route))laurels.push('VOICE OF THE CURIA');
  if((state.company||[]).reduce((n,v)=>n+(v.commendations||0),0)>=8||(state.meters?.army??0)>=55)laurels.push('EAGLE OF THE FRONTIER');
  if(!laurels.length)laurels.push('SACRAMENTUM ENDURED');
  return laurels.slice(0,3);
}
// The optional image elements must already be loaded locally by the UI.
export function drawReignCard(canvas,{name='',route,choices=[],url='',portrait=null,scene=null,stats=null,theme='imperial',laurels=[]}){
  canvas.width=1080;canvas.height=1350;const c=canvas.getContext('2d');
  const palette=REIGN_CARD_THEMES[theme]??REIGN_CARD_THEMES.imperial;
  const {charcoal,ivory,bronze}=palette;
  c.fillStyle=charcoal;c.fillRect(0,0,1080,1350);
  const backdrop=c.createLinearGradient(0,0,1080,1350);backdrop.addColorStop(0,palette.stops[0]);backdrop.addColorStop(.58,palette.stops[1]);backdrop.addColorStop(1,palette.stops[2]);c.fillStyle=backdrop;c.fillRect(0,0,1080,1350);
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
  const fade=c.createLinearGradient(0,460,0,735);fade.addColorStop(0,'#29292a00');fade.addColorStop(.7,palette.fadeEnd+'d4');fade.addColorStop(1,palette.fadeEnd);c.fillStyle=fade;c.fillRect(90,460,900,280);c.restore();
  c.textAlign='center';c.fillStyle=bronze;c.font='26px Georgia';c.fillText('I M P E R I U M',540,85);lineCard(c,[[502,111],[578,111]],'#b6a07788',1);
  // A modest lead seal recalls the recruit without revealing any character fate.
  lineCard(c,[[529,659],[522,678],[540,704],[558,677],[550,659]],'#958c715c',1.5);
  ellipse(c,540,701,25,27,'#a7a798');ellipse(c,539,699,21,23,'#858b81');c.strokeStyle='#c9c5ab';c.lineWidth=1;c.beginPath();c.ellipse(539,699,18,20,-.08,0,Math.PI*2);c.stroke();c.fillStyle='#4b5b52';c.font='23px Georgia';c.fillText('A',539,707);lineCard(c,[[533,683],[529,708]],'#bcc1ab66',1);
  c.fillStyle=palette.subtitle;c.font='italic 33px Georgia';c.fillText('The purple is earned.',540,773);
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
  if(laurels?.length){c.fillStyle=bronze;c.font='15px Georgia';c.fillText(`✦ ${laurels.slice(0,3).join(' · ')} ✦`,540,1226);}
  const destination=fittedLines(url,900,18,2,12,'system-ui');c.fillStyle=palette.muted;c.font=destination.size+'px system-ui';destination.list.forEach((text,i)=>c.fillText(text,540,1254+i*(destination.size+5)));
  if(stats){c.fillStyle='#c9ba9b';c.font='16px Georgia';c.fillText(`RES GESTAE · XII CHAPTERS · ${stats.encounters||12} ENCOUNTERS · ${stats.turns||0} TURNS · ${stats.commendations||0} COMMENDATIONS`,540,1292);}
  c.fillStyle=bronze;c.font='17px Georgia';c.fillText('FROM RECRUIT TO EMPEROR',540,1320);
  lineCard(c,[[42,50],[42,1300]],'#b6a0773b',1);lineCard(c,[[1038,50],[1038,1300]],'#b6a0773b',1);
}
function lineCard(c,points,color,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
