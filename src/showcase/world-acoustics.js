import {terrainAtPoint} from '../core/realtime/navigation.js';

// Read-only spatial sound direction. All timing belongs to presentation; no
// actor, save, random stream or encounter command is changed by these cues.
export function acousticSpace(world,actor){
  let place=null,distance=Infinity;
  if(world?.kind==='camp'&&actor)for(const [id,p]of Object.entries(world.places??{})){
    const d=Math.hypot(actor.x-p.x,actor.z-p.z);if(d<distance){distance=d;place=id;}
  }
  if(distance>6)place=null;
  const enclosed=world?.kind==='chamber'||place==='principia'||place==='valetudinarium';
  const river=[2,8].includes(world?.chapter),work=place==='quartermaster'||place==='drill';
  return {enclosed,place,ambience:enclosed?'room':work?'workshop':river?'river':'wind'};
}

/** At most one step per sample and one local ambience cue per six seconds.
 * Discontinuities (Retry, pause, teleports, control switches) reset the stride
 * rather than accumulating a burst of footsteps when the world resumes. */
export function createWorldAcoustics(){
  let previous=null,walked=0,lastStep=-Infinity,lastAmbience=null;
  return {sample(world,{now=0,paused=false}={}){
    const actor=world?.actors?.find(a=>a.id===world.controlled),space=acousticSpace(world,actor),cues=[];
    if(!actor){previous=null;return {space,cues};}
    const point={id:actor.id,x:actor.x,z:actor.z,tick:world.tick,now},same=previous&&previous.id===actor.id;
    const distance=same?Math.hypot(actor.x-previous.x,actor.z-previous.z):0;
    const advancing=same&&world.tick>previous.tick,valid=!paused&&actor.alive&&!actor.down&&!actor.carriedBy;
    const discontinuity=!valid||!same||world.tick<previous.tick||distance>3||now-previous.now>1200;
    if(discontinuity)walked=0;
    else if(advancing){
      walked+=distance;
      if(actor.moving&&walked>=.72&&now-lastStep>=170){
        const surface=world.map?terrainAtPoint(world.map,actor.x,actor.z)??'grass':'grass';
        cues.push({kind:['marsh','ford'].includes(surface)?'wade':'footstep',surface,intensity:actor.gait==='run'?.48:.32});
        walked%=.72;lastStep=now;
      }
    }
    const bucket=Math.floor(now/6000);
    if(!discontinuity&&advancing&&world.kind==='camp'&&lastAmbience!==null&&bucket!==lastAmbience)cues.push({kind:space.ambience,environment:true,intensity:.22});
    // A render between simulation ticks must not consume a due cue. Pauses
    // and discontinuities intentionally reset it, so resuming never catches up.
    if(discontinuity||advancing)lastAmbience=bucket;
    previous=point;return {space,cues};
  },reset(){previous=null;walked=0;lastStep=-Infinity;lastAmbience=null;}};
}
