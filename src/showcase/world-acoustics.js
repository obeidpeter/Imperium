import {terrainAtPoint} from '../core/realtime/navigation.js';
import {regionalSoundPalette} from '../ui/environment-sound.js';

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

/** At most one controlled step, one nearby company step per 480 ms and one
 * local ambience cue per six seconds.
 * Discontinuities (Retry, pause, teleports, control switches) reset the stride
 * rather than accumulating a burst of footsteps when the world resumes. */
export function createWorldAcoustics(){
  let previous=null,walked=0,lastStep=-Infinity,lastAmbience=null,lastCompany=-Infinity;
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
        cues.push({kind:['marsh','ford'].includes(surface)?'wade':['cavalry','heavy'].includes(actor.role)?'hoof':'footstep',surface,intensity:actor.gait==='run'?.48:.32});
        walked%=.72;lastStep=now;
      }
    }
    const bucket=Math.floor(now/6000);
    if(!discontinuity&&advancing&&world.kind==='camp'&&lastAmbience!==null&&bucket!==lastAmbience){
      const palette=regionalSoundPalette(world.chapter),local=space.enclosed||['quartermaster','drill'].includes(space.place);
      const kind=local||bucket%3!==0?space.ambience:palette[Math.floor(bucket/3)%palette.length];
      cues.push({kind,environment:true,intensity:.22,pan:space.enclosed?0:Math.sin(bucket*2.399)*.44});
    }
    // Nearby friendly movement gives a company weight without leaking a hidden
    // enemy. A single representative step is enough, even for a large army.
    if(!discontinuity&&advancing&&now-lastCompany>=480){
      const nearby=(world.actors??[]).filter(a=>a!==actor&&a.alive&&!a.down&&!a.hidden&&a.side!=='enemy'&&a.moving&&Math.hypot(a.x-actor.x,a.z-actor.z)<10)
        .sort((a,b)=>Math.hypot(a.x-actor.x,a.z-actor.z)-Math.hypot(b.x-actor.x,b.z-actor.z)||String(a.id).localeCompare(String(b.id)))[0];
      if(nearby){const surface=world.map?terrainAtPoint(world.map,nearby.x,nearby.z)??'grass':'grass';cues.push({kind:['cavalry','heavy'].includes(nearby.role)?'hoof':'footstep',surface,intensity:.12,pan:Math.max(-.6,Math.min(.6,(nearby.x-actor.x)/10))});lastCompany=now;}
    }
    // A render between simulation ticks must not consume a due cue. Pauses
    // and discontinuities intentionally reset it, so resuming never catches up.
    if(discontinuity||advancing)lastAmbience=bucket;
    previous=point;return {space,cues};
  },reset(){previous=null;walked=0;lastStep=-Infinity;lastAmbience=null;lastCompany=-Infinity;}};
}
