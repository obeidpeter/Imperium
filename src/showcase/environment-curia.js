import * as T from '../../vendor/three/three.module.js';
import {CURIA_LAYOUT} from '../ui/world-layouts.js';
import {worldModelUrl} from '../ui/world-catalog.js';
import {batchStaticEnvironment} from './environment-batching.js';

// The Senate's Curia in Chapters XI and XII (worlds and gameplay plan, release 9):
// Blender-built in marble around the chamber board, its pieces authored in place
// (curia-kit-components.js), laid out as data (CURIA_LAYOUT). Presentation only:
// no piece takes picks, changes a route or stands on the board.
const chapterOf=e=>Number(/^ch(\d+)-/.exec(e?.id??'')?.[1]);
/** Whether a scene is one of the Curia's: a Contest of its chapters on the 8 x 8 board. */
export function hasCuria(e,{chapter=chapterOf(e),tileSize=2.5}={}){
  return e?.kind==='contest'&&chapter===chapterOf(e)&&CURIA_LAYOUT.chapters.includes(chapter)&&e.width===CURIA_LAYOUT.board&&e.height===CURIA_LAYOUT.board&&tileSize===2.5;
}
/** The Curia's pieces, each at the board's centre. The first, once loaded, hides the
 * code-built stand-ins; walls carry their cutaway and cast no shadow. */
export function curiaPlacements(e,{chapter=chapterOf(e),tileSize=2.5}={}){
  if(!hasCuria(e,{chapter,tileSize}))return [];
  const url=worldModelUrl(CURIA_LAYOUT.kit);
  return CURIA_LAYOUT.pieces.map((piece,i)=>({id:CURIA_LAYOUT.kit,url,component:piece.component,x:0,z:0,yaw:0,groundY:0,key:`curia:${chapter}:${piece.component}`,
    ...(i===0?{fallbackNames:[...CURIA_LAYOUT.replaces]}:{}),...(piece.floor?{floor:true}:{}),...(piece.shadow===false?{shadow:false}:{}),...(piece.cutaway?{cutaway:piece.cutaway}:{})}));
}
/** Where a chapter's generated prop stands in a Curia scene, or null. */
export const curiaPropSpot=(e,id,options)=>hasCuria(e,options)?CURIA_LAYOUT.props[id]??null:null;
/** A code-built piece the Curia replaces is batched within its own group, out of the
 * scene's shared batches, so the loaded Curia can hide it whole. Elsewhere it joins
 * the shared batches as before. */
export function keepAsCuriaStandIn(group,{e,profile,geometries}){
  if(!group||!hasCuria(e,{chapter:profile?.chapter}))return group;
  batchStaticEnvironment(group,{geometries,instanceThreshold:Infinity});
  group.traverse(o=>{if(o.isMesh)o.userData.environmentDynamic=true;});
  return group;
}
/** Each frame: a wall stands down while the camera is beyond its inner face. Returns
 * how many walls are down. */
const eye=new T.Vector3();
export function updateInteriorCutaway(group,camera){
  if(!group||!camera)return 0;
  camera.getWorldPosition(eye);let down=0;
  for(const model of group.children){
    const c=model.userData.interiorCutaway;if(!c)continue;
    const beyond=c.normal[0]*eye.x+c.normal[1]*eye.z>c.face;
    if(model.visible===beyond)model.visible=!beyond;
    if(beyond)down++;
  }
  return down;
}
