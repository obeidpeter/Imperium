import {TIME} from '../../data/realtime-rules.js';
import {actorById} from './abilities.js';
import {cellCentre,clampToMap,navGrid,nearestWalkable,walkable} from './navigation.js';
import {fielded,formationSlots,membersOf,shapeOf,slotPoint,squadById} from './squads.js';
import {commandable} from './command.js';

// Deployment (guide "Deployment"; build brief §3.10): from Chapter VII a battle
// opens with the clock stopped, and the company is placed one thing at a time,
// a squad by its standard, the soldier or a companion, anywhere walkable in
// the deployment zone. Sound the advance starts the battle; until then no
// command is given, nothing moves and no Command is spent. Placing is a rules
// call like any command: checked, and refused without changing anything.

const emit=(world,event)=>world.events.push({tick:world.tick,...event});
export const deploying=world=>!!world.deployment&&!world.deployment.done;
const inZone=(world,p)=>{const z=world.deployment.zone;return p.x>=z.x0&&p.x<=z.x1&&p.z>=z.z0&&p.z<=z.z1;};
const placeable=(world,id)=>{
  const squad=squadById(world,id);if(squad)return commandable(world,squad)?{squad}:null;
  const actor=actorById(world,id);return actor&&actor.alive&&!actor.down&&(actor.id===world.heroId||world.party.includes(actor.id))?{actor}:null;
};
// Why this cannot be placed there now, or null.
export function deploymentProblem(world,{id,x,z}={}){
  if(!deploying(world))return 'NOT_DEPLOYING';
  if(!placeable(world,id))return 'NO_TARGET';
  if(!Number.isFinite(x)||!Number.isFinite(z))return 'NO_TARGET';
  if(!inZone(world,{x,z}))return 'NOT_IN_DEPLOYMENT_ZONE';
  if(!walkable(navGrid(world.map),x,z))return 'PATH_BLOCKED';
  return null;
}
// A squad stands with its front centre there, facing the enemy, each man at his
// place (or the walkable ground nearest it); a man stands there himself.
export function deploy(world,{id,x,z}){
  const reason=deploymentProblem(world,{id,x,z});if(reason)return {ok:false,reason};
  const grid=navGrid(world.map),{squad,actor}=placeable(world,id),settle=(a,p)=>{
    let q=clampToMap(grid,p);if(!walkable(grid,q.x,q.z)){const c=nearestWalkable(grid,q.x,q.z);if(c>=0)q=cellCentre(grid,c);}
    a.x=a.px=q.x;a.z=a.pz=q.z;a.fx=a.pfx=1;a.fz=a.pfz=0;a.path=[];a.order=null;a.gait=null;a.moving=false;
  };
  if(squad){
    Object.assign(squad,{x,z,fx:1,fz:0,path:[],goal:null,order:null,pending:null,moving:false,runUp:0});
    const men=membersOf(world,squad).sort((a,b)=>a.slot-b.slot),slots=formationSlots(shapeOf(squad),men.length);
    men.forEach((m,i)=>settle(m,slotPoint(squad,slots[i])));
  }else settle(actor,{x,z});
  if(!world.used.includes('deploy'))world.used.push('deploy');
  world.deployment.placed=(world.deployment.placed??0)+1;
  emit(world,{kind:'deployed',id});return {ok:true,reason:null};
}
// Sound the advance: the clock may start.
export function soundTheAdvance(world){
  if(!deploying(world))return {ok:false,reason:'NOT_DEPLOYING'};
  world.deployment.done=true;emit(world,{kind:'advance-sounded'});return {ok:true,reason:null};
}
// The zone for a battle: the first `tiles` 0.38 columns of the map, all its depth.
export function deploymentZone(layout,tiles){
  const cols=layout.kx.slice(0,tiles).reduce((a,b)=>a+b,0),rows=layout.ky.reduce((a,b)=>a+b,0);
  return {x0:0,x1:cols*2.5,z0:0,z1:rows*2.5};
}
export {fielded,TIME};
