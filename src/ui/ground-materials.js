// Painted materials use screen-continuous texture coordinates. Legal terrain
// supplies only the clip: identical neighbouring cells never restart the texture.
import {peekArt} from './art.js';
import {WORLD_ASSETS} from './world-assets.js';
export function materialIndex(type='grass',chapter=1,chamber=false){
  if(chamber||['stone','chamber'].includes(type))return 2;
  if(['water','river','deepwater','ford'].includes(type))return 3;
  if(type==='marsh')return 4;
  if(['road','gate'].includes(type))return 5;
  if(type==='sand'||[5,6,9].includes(chapter))return 1;
  return 0;
}
export function texturePlacements(rect,size){
  if(![rect?.x,rect?.y,rect?.w,rect?.h,size].every(Number.isFinite)||rect.w<=0||rect.h<=0||size<=0)return [];
  const result=[],left=Math.floor(rect.x/size),top=Math.floor(rect.y/size),right=Math.ceil((rect.x+rect.w)/size),bottom=Math.ceil((rect.y+rect.h)/size);
  // Bound malformed callers as well as real transient collapsed canvases.
  if((right-left)*(bottom-top)>1024)return [];
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)result.push({x:x*size,y:y*size,size,flipX:Math.abs(x)%2===1,flipY:Math.abs(y)%2===1});
  return result;
}
// Edge weight for the seam-free cross-fade: 0 at a cell border, 1 beyond the
// outer 30%. The half-offset copy supplies the borders, which therefore wrap.
export function seamWeight(t,size){const d=Math.min(t,size-1-t)/Math.max(1,size*.3);const k=Math.max(0,Math.min(1,d));return k*k*(3-2*k);}
// Blend RGBA pixels so the cell tiles without mirroring: first across x, then
// across y. Each pass keeps the other axis seamless; the shifted copy's own
// wrap line falls where the original has full weight, so no seam is drawn.
export function crossFadeSeamless(data,size){
  const out=new Uint8ClampedArray(data.length),half=Math.floor(size/2),blend=(source,target,horizontal)=>{
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const w=seamWeight(horizontal?x:y,size),sx=horizontal?(x+half)%size:x,sy=horizontal?y:(y+half)%size,i=(y*size+x)*4,j=(sy*size+sx)*4;
      for(let k=0;k<4;k++)target[i+k]=source[i+k]*w+source[j+k]*(1-w);
    }
  };
  const across=new Uint8ClampedArray(data.length);blend(data,across,true);blend(across,out,false);return out;
}
const seamlessCache=new WeakMap();
function makeCanvas(size){const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(size,size):globalThis.document?.createElement?.('canvas');if(canvas){canvas.width=size;canvas.height=size;}return canvas;}
function seamlessPattern(c,image,index,sw,sh){
  let cells=seamlessCache.get(image);if(!cells){cells=new Map();seamlessCache.set(image,cells);}
  if(cells.has(index))return cells.get(index);
  let tile=null;
  try{
    const size=Math.floor(Math.min(sw,sh))-1,canvas=makeCanvas(size),ctx=canvas?.getContext?.('2d');
    if(ctx?.getImageData&&ctx.putImageData){
      ctx.drawImage(image,(index%3)*sw+.5,Math.floor(index/3)*sh+.5,sw-1,sh-1,0,0,size,size);
      const pixels=ctx.getImageData(0,0,size,size);pixels.data.set(crossFadeSeamless(pixels.data,size));ctx.putImageData(pixels,0,0);tile={canvas,size};
    }
  }catch{tile=null;}
  cells.set(index,tile);return tile;
}
export function paintMaterial(c,g,rect,index=0,opacity=1){
  const image=peekArt(WORLD_ASSETS[0]);if(!image)return false;
  const sw=(image.naturalWidth||image.width)/3,sh=(image.naturalHeight||image.height)/2;
  if(!sw||!sh)return false;
  const size=Math.max(80,Math.min(340,g.tw*3.25));
  c.save();c.beginPath();c.rect(rect.x,rect.y,rect.w,rect.h);c.clip();c.globalAlpha=(Number.isFinite(c.globalAlpha)?c.globalAlpha:1)*Math.max(0,Math.min(1,opacity));
  // Browsers fill from one seamless pattern anchored at the canvas origin, then
  // add a larger, offset pass at low opacity so the repeat period stops reading.
  const tile=seamlessPattern(c,image,index,sw,sh),pattern=tile&&c.createPattern?.(tile.canvas,'repeat');
  if(pattern&&typeof pattern.setTransform==='function'&&typeof DOMMatrix==='function'){
    const base=c.globalAlpha;pattern.setTransform(new DOMMatrix().scale(size/tile.size));c.fillStyle=pattern;c.fillRect(rect.x,rect.y,rect.w,rect.h);
    const macro=c.createPattern(tile.canvas,'repeat');macro.setTransform(new DOMMatrix().translate(size*.37,size*.61).rotate(90).scale(size*2.31/tile.size));c.globalAlpha=base*.24;c.fillStyle=macro;c.fillRect(rect.x,rect.y,rect.w,rect.h);
    c.restore();return true;
  }
  for(const tile of texturePlacements(rect,size)){
    c.save();c.translate(tile.x+(tile.flipX?size:0),tile.y+(tile.flipY?size:0));c.scale(tile.flipX?-1:1,tile.flipY?-1:1);
    c.drawImage(image,(index%3)*sw+.5,Math.floor(index/3)*sh+.5,sw-1,sh-1,0,0,size,size);c.restore();
  }c.restore();return true;
}
export function drawNaturalProp(c,type,size=80,variant=0){
  const camp=['palisade','supplies','amphorae'].includes(type);
  const index=camp?(type==='palisade'?0:1):{rock:0,rubble:0,palm:1,tree:2,oak:2,shrub:2,wall:3,ruin:3}[type],image=peekArt(WORLD_ASSETS[camp?2:1]);
  if(index===undefined||!image||!Number.isFinite(size)||size<=0)return false;
  const sw=(image.naturalWidth||image.width)/2,sh=(image.naturalHeight||image.height)/(camp?1:2);
  if(!sw||!sh)return false;
  const width=size*(type==='shrub'?.85:1),height=size;
  c.drawImage(image,(index%2)*sw,Math.floor(index/2)*sh,sw,sh,-width/2,-height*480/512,width,height);
  return true;
}
export function environmentLight(c,w,h,g,e,p){
  if(![w,h,g?.ox,g?.oy,g?.tw,g?.th].every(Number.isFinite)||w<=0||h<=0)return;
  // One light field spans the scene, rather than an identical gradient per cell.
  const cy=g.oy+(e.width+e.height-2)*g.th*.25;
  const veil=c.createRadialGradient(w*.46,cy,Math.max(1,w*.15),w*.50,cy,Math.max(w,h)*.78);
  veil.addColorStop(0,p.chamber?'#f4d9a011':'#e5d0a708');veil.addColorStop(.6,'#10201d20');veil.addColorStop(1,'#071311d9');
  c.fillStyle=veil;c.fillRect(0,0,w,h);
  const top=c.createLinearGradient(0,0,0,h);top.addColorStop(0,'#081512cd');top.addColorStop(.17,'#111c2014');top.addColorStop(.72,'#0b171600');top.addColorStop(1,'#070e119c');c.fillStyle=top;c.fillRect(0,0,w,h);
}
