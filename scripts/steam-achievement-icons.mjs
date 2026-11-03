// node scripts/steam-achievement-icons.mjs: the achievement icons for Steamworks (the Steam plan, S3), made from the
// game's own art with nothing generated: each chapter's painting, the item pictures (assets/items/item-atlas.webp),
// the emperor's portrait and the oath seal, with insignia drawn in code where the game has no picture of a decoration.
// Each achievement gets its icon and a greyed locked copy, as JPEG, in desktop/steam/achievement-icons/, plus a review
// sheet in tests/visual-results/steam-icons/ (not committed). --size=64 (the default) is the size to upload; Steamworks
// says which it wants.
// Needs Playwright like the other review scripts (PLAYWRIGHT_MODULE); renders in headless Chromium's 2D canvas.
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveRequest} from './serve.mjs';
import {ACHIEVEMENTS} from '../src/data/achievements.js';
import {ITEM_ATLAS,ITEM_PICTURES} from '../src/data/item-pictures.js';

const size=Number(process.argv.find(a=>a.startsWith('--size='))?.slice(7)??64);
assert.ok(Number.isInteger(size)&&size>=32&&size<=256,'--size between 32 and 256');
const root=fileURLToPath(new URL('..',import.meta.url)),out=join(root,'desktop/steam/achievement-icons'),review=join(root,'tests/visual-results/steam-icons');

// What each icon shows. Chapters: their painting (an offset across the shared ones) and numeral. Items: a picture
// from the atlas. Drawn: insignia drawn in code. Portrait: the emperor; seal: the oath's lead seal.
const ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const SCENES=[['frontier-oath',0.5],['marsh',0.5],['danube',0.1],['danube',0.5],['eastern-fort',0.1],['eastern-fort',0.55],['danube',0.9],
  ['river-crossing',0.5],['eastern-fort',0.95],['province',0.5],['rome',0.5],['accession',0.5]];
const ITEMS={drill_first:'gladius',hammer_of_line:'parma',trail_reader:'quiver',clerk_of_rolls:'signaculum',shield_of_cohort:'scutum',
  pathfinder:'sagum',advocate_of_ranks:'caligae',river_scout:'olive_oil',scribe_of_council:'report_copy',
  backer:'coin_purse',battle:'spatha',defection:'galea',settlement:'silver_brooch',surrender:'key_c1',torques:'gothic_torc',hasta_pura:'hasta'};
const DRAWN={corona_civica:'oak',armillae:'armlets',corona_vallaris:'palisade',corona_muralis:'walls',phalerae:'discs'};
export function iconSpec(a){
  const e=a.earned;
  if(e.chapter){const [scene,x]=SCENES[e.chapter-1];return {kind:'scene',src:`./assets/scenes/${scene}.webp`,x,numeral:ROMAN[e.chapter-1]};}
  if(e.decoration&&DRAWN[e.decoration])return {kind:'drawn',shape:DRAWN[e.decoration],tone:'#5a1f24'};
  const item=ITEMS[e.decoration??e.title??e.route];
  if(item)return {kind:'item',cell:ITEM_PICTURES[item],tone:e.decoration?'#5a1f24':e.title?'#24382c':'#3a2048',item};
  return e.finish==='veteran'?{kind:'image',src:'./assets/portraits/hero-emperor.webp',tone:'#3a2048'}:{kind:'image',src:'./assets/portraits/oath-seal.webp',tone:'#2a2420'};
}

// In the page: draws one icon at 256 pixels, then the export size, as JPEG data for the icon and its locked copy.
function drawIcons(specs,{size,atlasSrc}){
  const load=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`Could not load ${src}`));img.src=src;});
  const M=256,gold='#c9a24e',bronze='#8a6428';
  function frame(ctx){ctx.lineWidth=10;ctx.strokeStyle=bronze;ctx.strokeRect(5,5,M-10,M-10);ctx.lineWidth=3;ctx.strokeStyle=gold;ctx.strokeRect(12,12,M-24,M-24);}
  function backdrop(ctx,tone){const g=ctx.createRadialGradient(M/2,M*0.45,10,M/2,M/2,M*0.75);g.addColorStop(0,tone);g.addColorStop(1,'#120c0a');ctx.fillStyle=g;ctx.fillRect(0,0,M,M);}
  function goldFill(ctx){const g=ctx.createLinearGradient(0,60,0,200);g.addColorStop(0,'#f2d58a');g.addColorStop(0.5,gold);g.addColorStop(1,'#7a5520');return g;}
  function drawn(ctx,shape){
    ctx.save();ctx.translate(M/2,M/2);ctx.fillStyle=goldFill(ctx);ctx.strokeStyle='#3a2410';ctx.lineWidth=3;
    if(shape==='oak'){
      // A wreath of oak leaves, two branches meeting under a gold knot and open at the top.
      for(let deg=-62;deg<=242;deg+=16){const a=deg*Math.PI/180,r=70;ctx.save();ctx.translate(Math.cos(a)*r,Math.sin(a)*r);ctx.rotate(a+(deg<90?-0.5:0.5));
        ctx.fillStyle=deg%32===0?'#6f8a3a':'#85a046';ctx.beginPath();ctx.ellipse(0,0,11,24,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
      ctx.fillStyle=goldFill(ctx);ctx.beginPath();ctx.arc(0,72,11,0,Math.PI*2);ctx.fill();ctx.stroke();
    }else if(shape==='armlets'){
      for(const [x,y] of [[-28,-14],[28,14]]){ctx.beginPath();ctx.ellipse(x,y,46,30,-0.35,0,Math.PI*2);ctx.ellipse(x,y,32,18,-0.35,0,Math.PI*2,true);ctx.fill('evenodd');ctx.stroke();}
    }else if(shape==='palisade'||shape==='walls'){
      ctx.beginPath();ctx.rect(-84,10,168,40);ctx.fill();ctx.stroke();
      if(shape==='palisade')for(let i=0;i<8;i++){const x=-80+i*22;ctx.beginPath();ctx.moveTo(x,12);ctx.lineTo(x+9,-46);ctx.lineTo(x+18,12);ctx.closePath();ctx.fill();ctx.stroke();}
      else for(let i=0;i<5;i++){const x=-84+i*36;ctx.beginPath();ctx.rect(x,-34,24,46);ctx.fill();ctx.stroke();ctx.beginPath();ctx.rect(x+2,-46,8,12);ctx.rect(x+14,-46,8,12);ctx.fill();ctx.stroke();}
    }else if(shape==='discs'){
      ctx.fillStyle='#4a2c1a';ctx.fillRect(-70,-70,140,140);ctx.strokeRect(-70,-70,140,140);
      for(let r=0;r<3;r++)for(let c=0;c<3;c++){const x=-46+c*46,y=-46+r*46;ctx.fillStyle=goldFill(ctx);ctx.beginPath();ctx.arc(x,y,19,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.fillStyle='#fff3c4';ctx.beginPath();ctx.arc(x-6,y-6,5,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }
  return (async()=>{
    const atlas=await load(atlasSrc),results=[];
    for(const spec of specs){
      const big=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');big.width=big.height=M;const ctx=big.getContext('2d');ctx.imageSmoothingQuality='high';
      if(spec.kind==='scene'){
        const img=await load(spec.src),scale=M/img.height,w=img.width*scale,x=-(w-M)*spec.x;ctx.drawImage(img,x,0,w,M);
        const g=ctx.createLinearGradient(0,M*0.55,0,M);g.addColorStop(0,'rgba(10,6,4,0)');g.addColorStop(1,'rgba(10,6,4,0.85)');ctx.fillStyle=g;ctx.fillRect(0,0,M,M);
        ctx.font='bold 96px Georgia, "DejaVu Serif", serif';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.lineWidth=8;ctx.strokeStyle='#120c0a';
        ctx.strokeText(spec.numeral,M/2,M-30);ctx.fillStyle='#f2d58a';ctx.fillText(spec.numeral,M/2,M-30);
      }else{
        backdrop(ctx,spec.tone);
        if(spec.kind==='drawn')drawn(ctx,spec.shape);
        else if(spec.kind==='item'){
          // A long item (a sword, a spear) lies across the diagonal, so it fills the square at the icon's size.
          const [sx,sy,sw,sh]=spec.cell,long=sh/sw>=2.5,room=long?250:176,fit=Math.min(room/sw,room/sh),w=sw*fit,h=sh*fit;
          ctx.save();ctx.translate(M/2,M/2);if(long)ctx.rotate(Math.PI/4);ctx.drawImage(atlas,sx,sy,sw,sh,-w/2,-h/2,w,h);ctx.restore();
        }
        else{const img=await load(spec.src);ctx.save();ctx.beginPath();ctx.arc(M/2,M/2,100,0,Math.PI*2);ctx.clip();ctx.drawImage(img,M/2-100,M/2-100,200,200);ctx.restore();
          ctx.lineWidth=6;ctx.strokeStyle='#c9a24e';ctx.beginPath();ctx.arc(M/2,M/2,100,0,Math.PI*2);ctx.stroke();}
      }
      frame(ctx);
      const exp=(locked)=>{const c=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=c.height=size;const x=c.getContext('2d');x.imageSmoothingQuality='high';
        if(locked)x.filter='grayscale(1) brightness(0.55) contrast(1.1)';x.drawImage(big,0,0,size,size);return c.toDataURL('image/jpeg',0.92);};
      const sheet=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');sheet.width=sheet.height=128;sheet.getContext('2d').drawImage(big,0,0,128,128);
      results.push({icon:exp(false),locked:exp(true),preview:sheet.toDataURL('image/png')});
    }
    return results;
  })();
}

// A sheet for the owner's review: every icon at 128 pixels, then at its true size and locked, with its name.
function drawSheet(items){
  const load=src=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.src=src;});
  return (async()=>{
    const cols=5,cell=290,rows=Math.ceil(items.length/cols),c=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=cols*cell;c.height=rows*190+20;
    const ctx=c.getContext('2d');ctx.fillStyle='#f0e7d5';ctx.fillRect(0,0,c.width,c.height);ctx.font='13px "DejaVu Sans", sans-serif';ctx.fillStyle='#2a1a14';
    for(const [i,it] of items.entries()){
      const x=(i%cols)*cell+10,y=Math.floor(i/cols)*190+10,[a,b]=await Promise.all([load(it.preview),load(it.locked)]);
      const c64=await load(it.icon);ctx.drawImage(a,x,y,128,128);ctx.drawImage(c64,x+136,y,64,64);ctx.drawImage(b,x+136,y+66,64,64);ctx.fillText(it.name,x,y+146);ctx.fillStyle='#6a5a4a';ctx.fillText(it.id+(it.hidden?' · hidden':''),x,y+164);ctx.fillStyle='#2a1a14';
    }
    return c.toDataURL('image/png');
  })();
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let pw;for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean))try{const m=await import(isAbsolute(p)?pathToFileURL(p).href:p);pw=m.chromium?m:m.default;break;}catch{}
  assert.ok(pw?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright.');
  const server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const browser=await pw.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined});
  try{
    const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/icon.svg`);
    const specs=ACHIEVEMENTS.map(iconSpec);
    const drawn=await page.evaluate(`(${drawIcons})(${JSON.stringify(specs)},${JSON.stringify({size,atlasSrc:ITEM_ATLAS.src.replace(/^\.\//,'/')})})`);
    await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
    const bytes=data=>Buffer.from(data.split(',')[1],'base64');
    for(const [i,a] of ACHIEVEMENTS.entries()){await writeFile(join(out,`${a.id}.jpg`),bytes(drawn[i].icon));await writeFile(join(out,`${a.id}_locked.jpg`),bytes(drawn[i].locked));}
    const sheet=await page.evaluate(`(${drawSheet})(${JSON.stringify(ACHIEVEMENTS.map((a,i)=>({id:a.id,name:a.name,hidden:a.hidden,preview:drawn[i].preview,icon:drawn[i].icon,locked:drawn[i].locked})))})`);
    await mkdir(review,{recursive:true});await writeFile(join(review,'review-sheet.png'),bytes(sheet));
    console.log(`Wrote ${ACHIEVEMENTS.length*2} icons (${size} pixels) to desktop/steam/achievement-icons/ and the review sheet to tests/visual-results/steam-icons/.`);
  }finally{await browser.close();server.close();}
}
