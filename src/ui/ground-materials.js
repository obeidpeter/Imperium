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
export function paintMaterial(c,g,rect,index=0,opacity=1){
  const image=peekArt(WORLD_ASSETS[0]);if(!image)return false;
  const sw=(image.naturalWidth||image.width)/3,sh=(image.naturalHeight||image.height)/2;
  if(!sw||!sh)return false;
  const size=Math.max(80,Math.min(340,g.tw*3.25));
  c.save();c.beginPath();c.rect(rect.x,rect.y,rect.w,rect.h);c.clip();c.globalAlpha=(Number.isFinite(c.globalAlpha)?c.globalAlpha:1)*Math.max(0,Math.min(1,opacity));
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
