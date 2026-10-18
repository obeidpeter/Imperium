import * as T from '../../vendor/three/three.module.js';
import {RIVER_WATER_LEVEL} from './environment-layout.js';

// Tactical reach painted onto the ground like ink: a wash over the cells the
// chosen action can reach, a brushed rim where that reach ends, and hatching
// over the cells an inspected enemy threatens. The board's own tiles carry
// the painting, draped over plateaus and water. Presentation only: it is drawn
// from the targets the rules already returned and never decides legality.
export const INK_PIXELS_PER_TILE=96;
function makeCanvas(width,height){
  if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(width,height);
  const canvas=globalThis.document?.createElement?.('canvas');if(!canvas)return null;canvas.width=width;canvas.height=height;return canvas;
}
const hash=(x,y,s=0)=>{const a=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return a-Math.floor(a);};
const key=tiles=>tiles.map(t=>`${t.x},${t.y}`).sort().join(';');
// Cells an enemy could strike next turn: anywhere it can move, plus its reach
// from there (line of sight is already applied by threatEnvelope for archers).
export function threatCells(envelope,{width=8,height=8}={}){
  if(!envelope?.moveTiles?.length)return [];
  const cells=new Map(),range=Math.max(1,envelope.range??1);
  for(const p of envelope.moveTiles)for(let dy=-range;dy<=range;dy++)for(let dx=-range;dx<=range;dx++){
    if(Math.abs(dx)+Math.abs(dy)>range)continue;const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=width||y>=height)continue;cells.set(`${x},${y}`,{x,y});
  }
  return [...cells.values()];
}
export function createInkOverlay(scene,encounter,heightAt,{tileSize=2.5}={}){
  const width=encounter.width*INK_PIXELS_PER_TILE,height=encounter.height*INK_PIXELS_PER_TILE,canvas=makeCanvas(width,height),c=canvas?.getContext?.('2d');if(!c)return null;
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  // A grid draped a few centimetres above the ground (or the river surface).
  const w=encounter.width*tileSize,d=encounter.height*tileSize,segX=encounter.width*8,segZ=encounter.height*8,geometry=new T.PlaneGeometry(w,d,segX,segZ);geometry.rotateX(-Math.PI/2);
  const pos=geometry.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),ground=heightAt(x,z);pos.setY(i,Math.max(Number.isFinite(ground)?ground:0,RIVER_WATER_LEVEL)+.035);}
  geometry.computeVertexNormals();
  const material=new T.MeshBasicMaterial({name:'Ink ground overlay',map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,fog:false});
  const mesh=new T.Mesh(geometry,material);mesh.name='ink tactical overlay';mesh.renderOrder=1;mesh.visible=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.raycast=()=>{};scene.add(mesh);
  const cell=INK_PIXELS_PER_TILE;
  let painted='',disposed=false;
  const inside=(set,x,y)=>set.has(`${x},${y}`);
  function wash(tiles,color,alpha){
    const set=new Set(tiles.map(t=>`${t.x},${t.y}`));
    c.save();c.globalAlpha=alpha;c.fillStyle=color;
    // Overlapping dabs per cell give the wash a hand-laid, slightly uneven edge.
    for(const t of tiles){const cx=(t.x+.5)*cell,cy=(t.y+.5)*cell;c.beginPath();
      for(let k=0;k<5;k++){const a=k*1.2566+hash(t.x,t.y,k)*.6,r=cell*(.36+hash(t.y,t.x,k+3)*.08),ox=Math.cos(a)*cell*.14,oy=Math.sin(a)*cell*.14;c.moveTo(cx+ox+r,cy+oy);c.arc(cx+ox,cy+oy,r,0,Math.PI*2);}
      c.fill();}
    c.restore();
    // The rim: brushed strokes only where the reach ends.
    c.save();c.strokeStyle=color;c.globalAlpha=Math.min(1,alpha*2.2);c.lineCap='round';
    for(const t of tiles)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
      if(inside(set,t.x+dx,t.y+dy))continue;
      const x0=(t.x+.5+dx*.46-dy*.46)*cell,y0=(t.y+.5+dy*.46-dx*.46)*cell,x1=(t.x+.5+dx*.46+dy*.46)*cell,y1=(t.y+.5+dy*.46+dx*.46)*cell;
      c.lineWidth=cell*(.035+hash(t.x,t.y,dx+dy*3)*.03);c.beginPath();c.moveTo(x0,y0);
      const mx=(x0+x1)/2+(hash(t.x,dy,t.y)-.5)*cell*.08,my=(y0+y1)/2+(hash(dx,t.y,t.x)-.5)*cell*.08;c.quadraticCurveTo(mx,my,x1,y1);c.stroke();
    }
    c.restore();
  }
  function hatch(tiles,color){
    c.save();c.beginPath();for(const t of tiles)c.rect(t.x*cell+cell*.06,t.y*cell+cell*.06,cell*.88,cell*.88);c.clip();
    c.strokeStyle=color;c.globalAlpha=.5;c.lineWidth=cell*.03;c.lineCap='round';
    for(let s=-height;s<width;s+=cell*.16){c.beginPath();c.moveTo(s,0);c.lineTo(s+height,height);c.stroke();}
    c.restore();
  }
  return {mesh,
    // targets: legal cells for the chosen action; threat: an enemy's threat
    // envelope (stage-readout threatEnvelope) or null.
    paint({targets=[],color='#89cfcb',threat=null}={}){
      if(disposed)return false;const threatened=threatCells(threat,encounter),next=`${key(targets)}|${color}|${key(threatened)}`;
      if(next===painted)return false;painted=next;c.clearRect(0,0,width,height);
      if(threatened.length)hatch(threatened,'#8a2f22');
      if(targets.length)wash(targets,color,.3);
      mesh.visible=targets.length>0||threatened.length>0;texture.needsUpdate=true;return true;
    },
    stats:()=>({visible:mesh.visible,width,height}),
    dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();material.dispose();texture.dispose();}
  };
}
