import * as T from '../../vendor/three/three.module.js';
import {actorVisible} from './stage-readout.js';
import {findFocusCamera} from './stage-focus-camera.js';
import {isAlive} from './session.js';

// The 3D board's camera views: the tactical overview, the follow view on the
// selected unit, the horizon, and zoom.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Action camera: during a committed attack the overview closes in on the
// exchange and turns a little side-on, then eases back. Reduced motion, focus
// mode or the setting being off leave the camera where the player put it.
export function sideOnYaw(from,to,currentYaw=0){
  const dir=Math.atan2(to.x-from.x,to.z-from.z),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),a=dir+Math.PI/2,b=dir-Math.PI/2;
  return Math.abs(wrap(a-currentYaw))<=Math.abs(wrap(b-currentYaw))?a:b;
}
export function actionFraming(orbit,{weight=0,sideYaw=null,painted=false}={}){
  const w=Math.max(0,Math.min(1,Number.isFinite(weight)?weight:0));if(w<=0)return {yaw:orbit.yaw,pitch:orbit.pitch,distance:orbit.distance};
  let yaw=orbit.yaw;if(!painted&&Number.isFinite(sideYaw))yaw+=Math.atan2(Math.sin(sideYaw-yaw),Math.cos(sideYaw-yaw))*.35*w;
  return {yaw,pitch:Math.max(.3,orbit.pitch-.1*w),distance:Math.max(9,orbit.distance*(1-.42*w))};
}
// Painted figures were authored for diagonal views; the overview settles there.
export const diagonalYaw=yaw=>Math.round((yaw-Math.PI/4)/(Math.PI/2))*(Math.PI/2)+Math.PI/4;
export const stageCamera={
  overviewDistance(){
    const drill=this.encounter.id==='ch1-training',yaw=this.orbit.yaw??-.55,pitch=this.orbit.pitch??.64;
    const right=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),up=new T.Vector3(-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)),out=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    const tangent=Math.tan(this.camera.fov*Math.PI/360)*.86,points=this.encounter.units.filter(actorVisible).flatMap(unit=>[this.world(unit),this.world(unit).add(new T.Vector3(0,['cavalry','heavy'].includes(unit.role)?3.1:2.55,0))]);
    if(!drill)for(const x of [-.18,this.encounter.width-.82])for(const y of [-.18,this.encounter.height-.82])points.push(this.world({x,y}));
    return Math.max(drill?13:20,...points.map(point=>{const p=point.clone().sub(this.baseTarget);return p.dot(out)+Math.max(Math.abs(p.dot(right))/(tangent*this.camera.aspect),Math.abs(p.dot(up))/tangent);}));
  },
  home(){if(this.ceremony){const focus=this.world(this.ceremony.focus??{x:3.5,y:3.5});this.focusMode=false;this.cameraView='ceremony';this.orbit.yaw=this.ceremony.yaw??-.62;this.orbit.pitch=this.ceremony.pitch??.3;this.orbit.distance=this.ceremony.distance??17;this.baseTarget.set(focus.x,focus.y+1.1,focus.z);return;}
    this.focusMode=false;this.cameraView='overview';this.orbit.yaw=this.profile?.staging?.camera.yaw??(this.encounter.kind==='contest'?-.28:-.55);this.orbit.pitch=this.profile?.staging?.camera.pitch??(this.encounter.kind==='contest'?.76:.67);this.baseTarget.set(0,.7,0);if(this.encounter.id==='ch1-training'){const alive=this.encounter.units.filter(isAlive);if(alive.length){const center=alive.reduce((v,u)=>v.add(this.world(u)),new T.Vector3()).divideScalar(alive.length);this.baseTarget.copy(center);this.baseTarget.y+=.5;this.orbit.pitch=.58;}}this.orbit.distance=this.overviewDistance();},
  horizon(){
    // Lift the point of interest, rather than merely flattening an orbit aimed
    // at the ground. The sky occupies the upper third while units remain framed.
    this.focusMode=false;this.cameraView='horizon';this.orbit.yaw=-.55;this.orbit.pitch=.105;
    this.baseTarget.set(0,2.7,0);this.orbit.distance=Math.max(28,this.overviewDistance());
  },
  focusSelected(){const u=this.encounter.units.find(u=>u.id===this.selected);if(u){const position=this.world(u),mounted=['cavalry','heavy'].includes(u.role),view=findFocusCamera(this.environment,{position,mounted});if(!view){this.home();return;}this.focusMode=true;this.cameraView='follow';this.baseTarget.copy(position);this.baseTarget.y+=mounted?1.2:.85;Object.assign(this.orbit,view);}},
  focusPoint(tile){if(!tile||!Number.isFinite(tile.x)||!Number.isFinite(tile.y)){this.home();return;}const pos=this.world(tile);this.focusMode=false;this.baseTarget.set(pos.x,pos.y+.85,pos.z);this.hoverRing.visible=true;this.hoverRing.position.copy(pos);this.hoverRing.position.y+=.08;},
  zoom(delta){this.orbit.distance=clamp(this.orbit.distance+delta,5.5,Math.max(85,this.orbit.distance,this.overviewDistance()));}
};
