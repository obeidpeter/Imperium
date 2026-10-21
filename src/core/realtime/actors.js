import {derivedValues,startingAttributes} from './combat.js';
import {STANDING} from '../../data/realtime-rules.js';

// The people of a real-time world. A spec names who he is and where he
// stands (metres); the actor record adds the state the systems change. An
// actor's attributes, kit and course effects are replaced, never edited in
// place, so derived values can be cached on them (combat.js).

const freezeKit=list=>[...list];
export function makeActor(spec){
  const side=spec.side??'enemy',attributes=startingAttributes({path:spec.path,attributes:spec.attributes});
  const actor={id:spec.id,name:spec.name,side,role:spec.role??'infantry',skirmisher:!!spec.skirmisher,attributes,kit:freezeKit(spec.kit??[]),
    effects:spec.effects??null,abilities:spec.abilities?[...spec.abilities]:null,
    ammo:{...(spec.ammo??{})},bandages:spec.bandages??0,x:spec.at[0],z:spec.at[1],px:spec.at[0],pz:spec.at[1],fx:spec.face?.[0]??1,fz:spec.face?.[1]??0,pfx:0,pfz:0,
    hp:0,maxHp:0,stamina:0,maxStamina:0,hpGain:0,staminaGain:0,alive:true,diedAt:-1,down:false,downAt:-1,downs:!!spec.downs,
    // Raiders come with their weapons out; the player's soldier draws his with Space.
    drawn:spec.drawn??side==='enemy',walkMode:false,order:null,lock:null,path:[],
    gait:null,moving:false,walked:0,repathAt:0,action:null,readyAt:0,staggerUntil:0,staggerStart:-1,braceUntil:0,shieldStuck:false,
    lastHitTick:-1,lastHitBy:null,calmSince:0,cooldowns:{},kills:0,killedBy:null,goal:null,carrying:null,carriedBy:null,
    hidden:!!spec.hidden,practice:!!spec.practice,officer:!!spec.officer,mounted:!!spec.mounted,faction:spec.faction??null,
    veteranId:spec.veteranId??null,unitId:spec.unitId??null,loot:spec.loot?[...spec.loot]:[],pace:spec.pace??null,
    escort:spec.escort?{escorted:!!spec.escort.escorted,wounded:!!spec.escort.wounded}:null,
    // Someone to talk to: the conversation the page opens when the soldier reaches him.
    talk:spec.talk?{tree:String(spec.talk.tree)}:null,
    standing:side!=='enemy'&&spec.standing?spec.standing.map(s=>[...s]):null,standingSlot:-1,
    // Enemies think for themselves (§3.10); a friend does only when his spec asks (a test or a benchmark).
    ai:(spec.ai??side==='enemy')?{state:spec.alert?'engage':'idle',slot:-1,dx:0,dz:0,notice:{},group:spec.group??'band',role:spec.role??'infantry',
      anchor:spec.anchor?{x:spec.anchor[0],z:spec.anchor[1]}:spec.guard||spec.practice?{x:spec.at[0],z:spec.at[1]}:null,focus:null,look:null,alertAt:0}:null};
  // A man of a squad (squads.js): his squad drives him, and his place in its formation.
  if(spec.squadId){actor.squadId=spec.squadId;actor.slot=spec.slot??0;}
  // A veteran specialist (from Chapter IV): his specialism and, for a ranged specialist, his volleys this battle.
  if(spec.specialist){actor.specialist=spec.specialist;if(spec.volleys)actor.volleys=spec.volleys;}
  if(actor.ai&&spec.alert)actor.ai.notice=Object.fromEntries((spec.aware??[]).map(id=>[id,100]));
  const d=derivedValues(actor);actor.hp=actor.maxHp=d.health+(spec.extraHp??0);actor.stamina=actor.maxStamina=d.stamina;actor.pfx=actor.fx;actor.pfz=actor.fz;
  if(Number.isFinite(spec.hp))actor.hp=Math.max(1,Math.min(actor.maxHp,spec.hp));
  if(spec.standingPreset&&!actor.standing&&side!=='enemy')actor.standing=STANDING.presets[spec.standingPreset].map(s=>[...s]);
  return actor;
}
// A reinforcement or a summoned man joins the world mid-fight.
export function spawnActor(world,spec,at,id){
  if(world.actors.some(a=>a.id===id))return null;
  const actor=makeActor({...spec,id,at:[at.x,at.z]});actor.px=actor.x;actor.pz=actor.z;world.actors.push(actor);return actor;
}
