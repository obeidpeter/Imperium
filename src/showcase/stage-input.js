import {createTouchHold} from '../ui/touch-hold.js';
import {campaignSoundscape} from '../ui/soundscape.js';
import {HIGH_GROUND_HEIGHT,RIVER_BED} from './environment-layout.js';
import * as T from '../../vendor/three/three.module.js';
import {isAlive} from './session.js';

// Picking on the 3D board: which unit or tile lies under a pointer.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Picking follows the visible relief: march the ray through the band between
// the river bed and the plateau tops, then bisect the crossing. Refining a flat
// plane alone would slide past a 1.6m rise to the ground behind it.
export function intersectGround(ray,height,target=new T.Vector3(),{top=HIGH_GROUND_HEIGHT+.5,bottom=RIVER_BED-.5,maxDistance=900,step=.2}={}){
  const o=ray.origin,d=ray.direction,above=t=>o.y+d.y*t-height(o.x+d.x*t,o.z+d.z*t);
  if(d.y>=0&&o.y>top)return null;
  const start=d.y<0?Math.max(0,(top-o.y)/d.y):0,end=d.y<0?Math.min(maxDistance,(bottom-o.y)/d.y):maxDistance;
  if(!(end>=start))return null;
  if(above(start)<=0)return ray.at(start,target);
  for(let previous=start,t=start+step;previous<end;previous=t,t+=step){
    const next=Math.min(t,end);if(above(next)>0)continue;
    let lo=previous,hi=next;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(above(mid)>0)lo=mid;else hi=mid;}
    return ray.at(hi,target);
  }
  return null;
}
// Closest distance between a ray and a figure's upright axis (x, y..y+height, z):
// a cheap test that decides whether a figure's deformed surfaces are worth the
// exact, CPU-skinned raycast at all.
export function rayToUpright(ray,x,y,z,height){
  const o=ray.origin,d=ray.direction,wx=o.x-x,wy=o.y-y,wz=o.z-z,b=d.y,e=d.x*wx+d.y*wy+d.z*wz,cross=1-b*b;
  let s=clamp(cross>1e-9?(wy-e*b)/cross:wy,0,height);const t=Math.max(0,s*b-e);s=clamp(wy+t*b,0,height);
  return Math.hypot(wx+t*d.x,wy+t*d.y-s,wz+t*d.z);
}
export const stageInput={
  // The pointer and keyboard on the canvas, through `on`, which records each
  // listener for dispose. A press that stays put picks (or hurries a motion); a
  // drag orbits the camera; the wheel zooms; keys turn, tilt and zoom.
  bindInput(on,{timers}={}){
    // Touch has no hover: a finger held still (not orbiting) shows what a tap
    // there would do, and the release that ends the hold picks nothing.
    this.touchHold=createTouchHold(point=>{
      if(this.disposed||!this.drag||this.drag.moved)return;const hover=this.pick(point);this.hovered=hover?.unitId??null;this.onHover(hover);
      if(this.hovered!==this.inkHover){this.inkHover=this.hovered;this.updateInk();}
    },
      {timers});
    on(this.canvas,'pointerdown',
      e=>{
        this.wake();this.sound.unlock();campaignSoundscape().unlock();this.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
        this.canvas.setPointerCapture(e.pointerId);this.touchHold.down(e);
      });
    on(this.canvas,'pointermove',
      e=>{
        this.wake();this.touchHold.move(e);
        if(this.drag){
          const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>7)this.drag.moved=true;
          if(this.drag.moved){this.orbit.yaw-=dx*.006;this.orbit.pitch=clamp(this.orbit.pitch+dy*.004,.04,1.15);}this.drag.lastX=e.clientX;
          this.drag.lastY=e.clientY;
        }else this.pendingHover={clientX:e.clientX,clientY:e.clientY};
      });
    on(this.canvas,'pointerleave',e=>{if(e.pointerType==='touch')return;this.pendingHover=null;this.hovered=null;this.onHover(null);});
    on(this.canvas,'pointerup',
      e=>{
        const held=this.touchHold.consume();this.touchHold.up();
        if(this.drag&&!this.drag.moved&&!held){
          if(this.animation)this.animation.scale=Math.min(this.animation.scale,.42);
          else if(this.discessio&&!this.discessio.done)this.discessio.start=-Infinity;
          else this.onPick(this.pick(e));
        }
        this.drag=null;
      });
    on(this.canvas,'pointercancel',()=>{this.touchHold.up();this.drag=null;});
    on(this.canvas,'wheel',e=>{this.wake();e.preventDefault();this.zoom(e.deltaY*.022);},{passive:false});
    on(this.canvas,'keydown',
      e=>{
        this.wake();this.sound.unlock();campaignSoundscape().unlock();if(this.keyboardMode==='grid'&&(e.key.startsWith('Arrow')||/^[a-z]$/i.test(e.key)))return;
        let handled=true;
        switch(e.key){
          case'ArrowLeft':this.orbit.yaw-=this.figureStyle==='painted'?Math.PI/2:.12;break;
          case'ArrowRight':this.orbit.yaw+=this.figureStyle==='painted'?Math.PI/2:.12;break;
          case'ArrowUp':this.orbit.pitch=clamp(this.orbit.pitch+.08,.04,1.15);break;case'ArrowDown':this.orbit.pitch=clamp(this.orbit.pitch-.08,.04,1.15);break;
          case'+':case'=':this.zoom(-2);break;case'-':this.zoom(2);break;case'Home':this.home();break;case'h':case'H':this.horizon();break;case'f':
          case'F':this.focusSelected();break;case' ':if(this.animation)this.animation.scale=Math.min(this.animation.scale,.42);else handled=false;break;
          default:handled=false;
        }
        if(handled)e.preventDefault();
      });
  },
  pick(event){
    const r=this.canvas.getBoundingClientRect();this.ndc.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
    this.ray.setFromCamera(this.ndc,this.camera);
    const pickable=new Set(this.encounter.units.filter(isAlive).map(u=>u.id));
    // Raycaster does not skip invisible objects. Collect only rendered bodies
    // before intersection so the hidden LOD never CPU-skins every triangle.
    const surfaces=[],ray=this.ray.ray,
      near=a=>{
        if(!ray?.origin)return true;const p=a.group.position,kit=a.group.userData.actor??{};
        return rayToUpright(ray,p.x,p.y,p.z,(kit.height??2.03)+.25)<=(kit.mounted?1.7:.9);
      };
    for(const [id,a]of this.actors)if(a.group.visible&&pickable.has(id)&&near(a))a.group.traverseVisible(o=>{if(o.isMesh)surfaces.push(o);});
    const hits=this.ray.intersectObjects(surfaces,false);
    const hit=hits.find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});
    if(hit){
      let obj=hit.object;while(obj&&!obj.userData.unitId)obj=obj.parent;const u=this.encounter.units.find(u=>u.id===obj?.userData.unitId);
      if(u&&isAlive(u))return {x:u.x,y:u.y,unitId:u.id};
    }
    if(!intersectGround(this.ray.ray,this.surfaceHeight??this.environment.groundHeight,this.hit))return null;
    const x=Math.round(this.hit.x/2.5+(this.encounter.width-1)/2),y=Math.round(this.hit.z/2.5+(this.encounter.height-1)/2);
    return x>=0&&y>=0&&x<this.encounter.width&&y<this.encounter.height?{x,y}:null;
  }
};
