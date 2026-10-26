import {ENEMY_AI,PERCEPTION,TIME} from '../../data/realtime-rules.js';
import {actorById,distanceBetween,hostile,staggered,validate} from './abilities.js';
import {derivedValues} from './combat.js';
import {crossesCover,navGrid,span,terrainAtPoint,walkable,clampToMap,nearestWalkable,cellCentre} from './navigation.js';
import {helpless,setRoute} from './motion.js';
import {nextRandom} from './rng-streams.js';
import {smokeBetween,terrainCover} from './sight.js';
import {flee,fleeing} from './bands.js';
import {TEMPERAMENTS} from '../../data/realtime-variety.js';

// Enemy AI (§3.10). Each enemy keeps a notice meter for every hostile actor:
// the eye over his head. It fills with what he sees and hears and drains when
// he cannot perceive; at 50 he is suspicious and goes to look, at 100 alert,
// and after his reaction time he engages. A struck man knows his attacker,
// unless the blow came from ambush and the attacker's Fieldcraft hid him. The
// party spots hidden enemies with the same meter in reverse (the hero's
// Perception against the enemy's Fieldcraft). Decisions run at 4 Hz,
// staggered by actor (§3.1, system 2); perception runs every tick (system 7).

const DT=1/TIME.ticksPerSecond,ticksOf=s=>Math.round(s*TIME.ticksPerSecond);
export const decidesThisTick=(world,index)=>(world.tick+index)%TIME.aiInterval===0;
const standing=o=>o.alive&&!o.down&&!o.carriedBy;
const emit=(world,event)=>world.events.push({tick:world.tick,...event});
const difficulty=world=>PERCEPTION.difficulty[world.difficulty]??PERCEPTION.difficulty.standard;

// How fast `watcher` notices `target` this second (§3.10): base for what the
// target does × visibility × proximity × Per/10 × (1 − Fieldcraft/100).
export function noticeRate(world,watcher,target){
  const grid=navGrid(world.map),d=distanceBetween(watcher,target),per=watcher.attributes.per,sight=PERCEPTION.sightBase+per;
  const proximity=d<=PERCEPTION.near?1:d>=sight?0:1-(d-PERCEPTION.near)/(sight-PERCEPTION.near);if(proximity<=0)return 0;
  const firm=!['marsh','ford'].includes(terrainAtPoint(world.map,target.x,target.z));
  let base=target.moving?target.gait==='run'?PERCEPTION.run:(target.effects?.quietFeet&&firm?PERCEPTION.quietWalk:PERCEPTION.walk):PERCEPTION.stand;
  if(target.drawn)base+=PERCEPTION.drawn;
  let visibility=1;
  if(world.timeOfDay==='night')visibility*=PERCEPTION.darkness;
  if(world.weather==='mist')visibility*=PERCEPTION.mist;
  if(terrainCover(world,watcher,target)||smokeBetween(world,watcher,target))visibility*=PERCEPTION.cover;
  if(target.kit?.some(id=>id==='sagum'))visibility*=PERCEPTION.darkCloak;
  // Difficulty sharpens or dulls the enemy's eyes only, never the soldier's or his squads'.
  return base*visibility*proximity*(per/10)*(1-Math.min(.95,target.attributes.field/100))*(watcher.side==='enemy'?difficulty(world).notice:1);
}

// System 7: perception and notice meters.
export function perceive(world){
  // A war band's temperament makes its men keener or slower to notice (variety.js).
  const keen=TEMPERAMENTS.kinds[world.band?.temperament]?.notice??1;
  for(const enemy of world.actors){
    if(!enemy.ai||!standing(enemy))continue;const ai=enemy.ai,factor=world.band?.members.includes(enemy.id)?keen:1;
    for(const target of world.actors){
      if(!standing(target)||!hostile(enemy,target))continue;
      const rate=noticeRate(world,enemy,target)*factor,before=ai.notice[target.id]??0;
      const after=rate>0?Math.min(100,before+rate*DT):Math.max(0,before-PERCEPTION.decay*DT);
      if(after!==before){ai.notice[target.id]=after;if(after===0)delete ai.notice[target.id];}
      if(before<100&&after>=100&&ai.state!=='engage'){ai.state='alert';ai.alertAt=world.tick+ticksOf(PERCEPTION.reaction+difficulty(world).reaction);ai.focus=target.id;
        emit(world,{kind:'notice',actorId:enemy.id,targetId:target.id});}
      else if(before<50&&after>=50&&ai.state==='idle'){ai.state='suspicious';ai.focus=target.id;ai.look={x:target.x,z:target.z};emit(world,{kind:'suspicious',actorId:enemy.id});}
    }
  }
  // The party's eye on hidden enemies: the hero's Perception against their Fieldcraft.
  const hero=actorById(world,world.heroId);if(!hero||!standing(hero))return;
  for(const enemy of world.actors){
    if(!enemy.hidden||!enemy.alive)continue;
    if(world.reveals.some(r=>r.until>world.tick&&span(enemy.x-r.x,enemy.z-r.z)<=r.radius)){reveal(world,enemy,'scout');continue;}
    const rate=noticeRate(world,hero,enemy),before=world.spotting[enemy.id]??0,after=rate>0?Math.min(100,before+rate*DT):Math.max(0,before-PERCEPTION.decay*DT);
    if(after>0)world.spotting[enemy.id]=after;else delete world.spotting[enemy.id];
    if(after>=100)reveal(world,enemy,'spotted');
  }
}
export function reveal(world,enemy,how){
  if(!enemy.hidden)return;enemy.hidden=false;delete world.spotting[enemy.id];emit(world,{kind:'revealed',actorId:enemy.id,how});
}
// A struck man knows his attacker, unless an ambush hid him: then only with
// probability min(1, 10 / Fieldcraft); otherwise his group hears a noise
// within ±10 m of the attacker (§3.5 step 9).
export function struck(world,defender,attacker,ambush){
  const ai=defender.ai;if(!ai)return;
  if(ambush&&nextRandom(world.rng,'ai')>=Math.min(1,PERCEPTION.traceFieldcraft/Math.max(1,attacker.attributes.field))){
    const x=attacker.x+(nextRandom(world.rng,'ai')*2-1)*PERCEPTION.noiseSpread,z=attacker.z+(nextRandom(world.rng,'ai')*2-1)*PERCEPTION.noiseSpread;
    for(const o of world.actors)if(o.ai&&standing(o)&&o.ai.group===ai.group&&o.ai.state!=='engage'){o.ai.state='suspicious';o.ai.look={x,z};}
    emit(world,{kind:'noise',actorId:defender.id,x,z});return;
  }
  ai.notice[attacker.id]=100;if(ai.state!=='engage'){ai.state='engage';ai.focus=attacker.id;emit(world,{kind:'notice',actorId:defender.id,targetId:attacker.id});}
}
// A man who engages rouses his group within shouting distance.
function rouse(world,actor,target){
  for(const o of world.actors)if(o!==actor&&o.ai&&standing(o)&&o.ai.group===actor.ai.group&&o.ai.state!=='engage'&&distanceBetween(o,actor)<=PERCEPTION.shout){
    o.ai.notice[target.id]=100;o.ai.state='alert';o.ai.alertAt=world.tick+ticksOf(PERCEPTION.reaction+difficulty(world).reaction);o.ai.focus=target.id;
  }
}

function foesOf(world,actor){return world.actors.filter(o=>standing(o)&&hostile(actor,o)&&(actor.ai.notice[o.id]??0)>=100);}
function nearest(list,p){let best=null,bd=Infinity;for(const o of list){const d=distanceBetween(o,p);if(d<bd){bd=d;best=o;}}return best;}
// Whom this enemy goes for, by his role. The field approach changes it (0.38
// approachAssignment): against Engineering the archers shoot the soldier, and
// against a defensive advance the horse and raiders go for him.
function chooseTarget(world,actor){
  const foes=foesOf(world,actor);if(!foes.length)return null;
  const anchor=actor.ai.anchor??actor,hero=actorById(world,world.heroId);
  if(hero&&foes.includes(hero)&&(world.approach==='breach'&&derivedValues(actor).weapon.ranged||world.approach==='advance'&&['cavalry','raider'].includes(actor.ai.role)))return hero;
  if(actor.practice){const hero=actorById(world,world.heroId);return hero&&foes.includes(hero)&&distanceBetween(hero,anchor)<=ENEMY_AI.practiceRange?hero:null;}
  if(actor.ai.role==='guard'){const near=foes.filter(o=>distanceBetween(o,anchor)<=ENEMY_AI.guardRadius);return nearest(near,actor);}
  if(actor.ai.role==='raider'){const columns=foes.filter(o=>o.escort&&distanceBetween(o,actor)<=ENEMY_AI.raidRadius);if(columns.length)return nearest(columns,actor);}
  // The most threatening foe (ENEMY_AI.threat): the nearest, counted nearer when he is striking this man or one of
  // his fellows, is badly wounded, or presses one of their archers. He keeps his man unless another is much more so.
  const t=ENEMY_AI.threat,fellows=world.actors.filter(o=>o!==actor&&o.ai&&standing(o)&&o.side===actor.side),
    archers=fellows.filter(o=>derivedValues(o).weapon.ranged);
  const score=o=>distanceBetween(o,actor)-(o.lock===actor.id||o.order?.targetId===actor.id?t.attacking:0)
    -(fellows.some(f=>o.lock===f.id||o.order?.targetId===f.id)?t.band:0)-(o.side!=='neutral'&&o.hp<o.maxHp/2?t.wounded:0)
    -(archers.some(a=>distanceBetween(a,o)<=t.guardRange)?t.archer:0);
  let best=null,bs=Infinity;for(const o of foes){const s=score(o);if(s<bs||s===bs&&o.id<best.id){bs=s;best=o;}}
  const current=foes.find(o=>o.id===actor.order?.targetId);
  return current&&score(current)<=bs+ENEMY_AI.stickiness?current:best;
}
function goTo(world,actor,point,{run=false}={}){
  const grid=navGrid(world.map);let p=clampToMap(grid,point);if(!walkable(grid,p.x,p.z)){const i=nearestWalkable(grid,p.x,p.z);if(i<0)return;p=cellCentre(grid,i);}
  if(actor.order?.kind==='move'&&actor.goal&&span(actor.goal.x-p.x,actor.goal.z-p.z)<.75)return;
  actor.order={kind:'move'};actor.lock=null;setRoute(world,actor,p,{run});
}

export function decideEnemy(world,actor){
  if(!standing(actor)||staggered(world,actor)||world.status!=='active')return;
  // A man of a broken war band runs for its edge of the field (bands.js).
  if(fleeing(world,actor)){flee(world,actor);return;}
  const ai=actor.ai;
  if(ai.state==='alert'&&world.tick>=(ai.alertAt??0)){ai.state='engage';const t=actorById(world,ai.focus);if(t)rouse(world,actor,t);}
  if(ai.state==='suspicious'){
    // Go and look where he heard or glimpsed something.
    if(ai.look&&span(actor.x-ai.look.x,actor.z-ai.look.z)>1.5)goTo(world,actor,ai.look);else{actor.order=null;actor.path=[];ai.state='idle';ai.look=null;}
    return;
  }
  if(ai.state!=='engage'){
    if(ai.anchor&&span(actor.x-ai.anchor.x,actor.z-ai.anchor.z)>2)goTo(world,actor,ai.anchor);
    return;
  }
  // A diversion draws the first enemy in sight away to the false approach until the end of round two.
  if(world.approach==='diversion'&&world.tick<2*TIME.roundTicks&&!actor.practice){
    const first=world.actors.filter(o=>o.side==='enemy'&&standing(o)&&!o.hidden&&!o.squadId).sort((a,b)=>a.id.localeCompare(b.id))[0],hero=actorById(world,world.heroId);
    if(first===actor&&hero){const depth=world.map.height*2.5;goTo(world,actor,{x:hero.x+5,z:hero.z<depth/2?depth-4:4});return;}
  }
  const target=chooseTarget(world,actor);
  if(!target){
    // No one he knows of: back to his post, or stand.
    if(ai.anchor&&span(actor.x-ai.anchor.x,actor.z-ai.anchor.z)>2)goTo(world,actor,ai.anchor,{run:true});else{actor.order=null;actor.lock=null;actor.path=[];}
    return;
  }
  const near=distanceBetween(actor,target);
  if(ai.slot<0&&!actor.practice){
    // Its own side of the target, fixed from where it stood when it engaged.
    const taken=world.actors.filter(o=>o.side===actor.side&&o.ai&&o.ai.slot>=0).length,slot=taken%ENEMY_AI.spread.length;
    const d=span(actor.x-target.x,actor.z-target.z)||1,bx=(actor.x-target.x)/d,bz=(actor.z-target.z)/d,[c,s]=ENEMY_AI.spread[slot];
    ai.slot=slot;ai.dx=bx*c-bz*s;ai.dz=bx*s+bz*c;
  }
  // Archers keep their distance and shoot; too close, they step back first.
  const weapon=derivedValues(actor).weapon;
  if(weapon.ranged&&(weapon.ranged.ammo===null||(actor.ammo?.[weapon.ranged.ammo]??0)>0)){
    if(world.tick<(ai.retreatUntil??0)&&actor.order?.kind==='move'&&actor.path?.length)return;
    if(near<ENEMY_AI.archerClose&&!actor.action&&world.tick>=(ai.nextRetreatAt??0)){
      const d=near||1,away={x:actor.x+(actor.x-target.x)/d*ENEMY_AI.archerStep,z:actor.z+(actor.z-target.z)/d*ENEMY_AI.archerStep};
      // A bounded disengagement creates an opening to pursue or throw. A new
      // flee route every AI tick let archers kite a melee soldier indefinitely.
      const grid=navGrid(world.map);if(walkable(grid,away.x,away.z)){
        ai.nextRetreatAt=world.tick+ticksOf(ENEMY_AI.archerRetreatInterval);ai.retreatUntil=world.tick+ticksOf(ENEMY_AI.archerRetreat);goTo(world,actor,away,{run:true});
        emit(world,{kind:'intent',actorId:actor.id,what:'disengage',text:'Falling back to shoot — close the gap or use a pilum.'});return;
      }
    }
    actor.drawn=true;if(actor.order?.kind!=='attack'||actor.order.targetId!==target.id)actor.order={kind:'attack',targetId:target.id};return;
  }
  const {close,far}=ENEMY_AI.skirmish,javelins=actor.ammo?.javelin??0,darts=actor.ammo?.dart??0;
  if(actor.skirmisher&&(javelins>0||darts>0)&&near>=close){
    const ability=javelins>0?'throw_javelin':'throw_dart';
    if(near<=far){
      if(actor.order?.kind!=='ability'&&!validate(world,actor.id,ability,{actorId:target.id}))actor.order={kind:'ability',abilityId:ability,targetId:target.id};
      return;
    }
    actor.order={kind:'advance',targetId:target.id,stopAt:far-2};return;
  }
  actor.drawn=true;
  if(actor.order?.kind!=='attack'||actor.order.targetId!==target.id)actor.order={kind:'attack',targetId:target.id,slot:!actor.practice};
}
