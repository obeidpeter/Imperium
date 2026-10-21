import * as T from '../../vendor/three/three.module.js';
import {ACTOR_TIMING,locomotionPhase} from './actor-pose.js';
import {sampleImpactParticles} from './stage-particles.js';
import {positionProjectileTip} from './stage.js';
import {ITEMS} from '../data/realtime-rules.js';

// The real-time world on the 3D stage (BattleStage.setLive): every frame each
// figure's place and pose come from the simulation, interpolated between its
// last two ticks, and the frame's missiles, sparks, floating numbers and
// markers follow its events. Presentation only: the world is read, never
// written, and no gameplay random number is drawn.

const TILE=2.5,FALL_TICKS=16,LIE_TICKS=10,REACTION_TICKS=6,FLOAT_MS=1300,SPARK_MS=320;
const lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Simulation metres (from the map's north-west corner) as the stage's fractional tiles, and back.
export const stageTile=(x,z)=>({x:x/TILE-.5,y:z/TILE-.5});
export const simPoint=(world,ground)=>ground&&{x:ground.x+world.map.width*TILE/2,z:ground.z+world.map.height*TILE/2};
export const worldPoint=(world,p)=>({x:p.x-world.map.width*TILE/2,z:p.z-world.map.height*TILE/2});
// The figure shows what the rules use: a trained soldier's kit, and a shield only for a man who carries one.
export function stageUnit(actor){
  return {id:actor.id,name:actor.name,side:actor.side,role:actor.role,...stageTile(actor.x,actor.z),hp:actor.hp,maxHp:actor.maxHp,facing:'east',morale:80,
    intent:'',hidden:false,trained:actor.side==='player',shield:actor.kit.some(id=>ITEMS[id]?.shield)};
}
// The stage's encounter: the campaign map with the world's actors, and no turn-based markers.
export function stageEncounter(encounter,world){
  return {...encounter,units:world.actors.map(stageUnit),mission:null,goal:null,field:null,operation:null,reinforcements:[],status:'active',turn:1,log:[]};
}
// The simulation lands a blow at half the swing; the figure's authored clip
// lands it at ACTOR_TIMING.contact. Map one onto the other.
export function swingPhase(t){const c=ACTOR_TIMING.contact,k=clamp(t,0,1);return k<.5?k/.5*c:c+(k-.5)/.5*(1-c);}

// Allegiance at every man's feet by shape as well as colour (§3.16): a full
// ring for friends, a spiked one for enemies, each with a chevron for his
// facing (it decides blocks and flanks). Drawn flat in XY, facing −y, then laid
// on the ground facing +z.
function footGeometry(spiked){
  const pos=[...new T.RingGeometry(.44,.5,40).toNonIndexed().attributes.position.array],tri=(...p)=>pos.push(p[0],p[1],0,p[2],p[3],0,p[4],p[5],0);
  tri(-.13,-.53,.13,-.53,0,-.71);
  if(spiked)for(let i=0;i<8;i++){const a=(i+.5)/8*Math.PI*2,c=Math.cos(a),s=Math.sin(a),w=.055;tri(c*.5-s*w,s*.5+c*w,c*.5+s*w,s*.5-c*w,c*.63,s*.63);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));return geometry;
}
const FLAT=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2),UP=new T.Vector3(0,1,0);

export function createLivePresenter(stage,{world:getWorld,alpha:getAlpha,beforeFrame=()=>{},paused=()=>false}={}){
  const odometer=new Map(),last=new Map(),floating=new Map(),sparks=[],reactions=new Map(),marks={route:null,planned:null,goal:null,target:null,ranges:null};
  let closeUp=null,showRanges=false,route=null,planned=null,labelsKey='',feet=null;
  // One instanced draw each for friends' rings, enemies' rings and guard arcs.
  function footMarks(count){
    const material=color=>new T.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});
    const make=(geometry,color)=>{const m=new T.InstancedMesh(geometry,material(color),count);m.count=0;m.frustumCulled=false;m.renderOrder=3;stage.overlay.add(m);return m;};
    return {friend:make(footGeometry(false),'#9fd3d0'),enemy:make(footGeometry(true),'#ef8f74'),
      guard:make(new T.RingGeometry(.56,.68,24,1,-Math.PI*5/6,Math.PI*2/3),'#f1d38a'),matrix:new T.Matrix4(),q:new T.Quaternion(),one:new T.Vector3(1,1,1)};
  }
  const rendered=()=>{const w=getWorld();return w.tick-1+getAlpha();};
  const actorOf=(w,id)=>w.actors.find(a=>a.id===id);
  const ground=(x,z)=>{const p=worldPoint(getWorld(),{x,z});return new T.Vector3(p.x,stage.surfaceHeight(p.x,p.z),p.z);};
  function line(color,opacity=.85){
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(3*64),3));
    const mesh=new T.Line(geometry,new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false,forceSinglePass:true}));
    mesh.frustumCulled=false;mesh.renderOrder=3;stage.overlay.add(mesh);return mesh;
  }
  function ring(inner,outer,color,opacity=.8){
    const mesh=new T.Mesh(new T.RingGeometry(inner,outer,64),new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:T.DoubleSide,
      forceSinglePass:true}));
    mesh.rotation.x=-Math.PI/2;mesh.renderOrder=3;mesh.visible=false;stage.overlay.add(mesh);return mesh;
  }
  // A polyline laid on the ground, a few centimetres up.
  function lay(mesh,points){
    const attr=mesh.geometry.attributes.position,n=Math.min(points.length,attr.count);
    for(let i=0;i<n;i++){const p=ground(points[i].x,points[i].z);attr.setXYZ(i,p.x,p.y+.07,p.z);}
    mesh.geometry.setDrawRange(0,n);attr.needsUpdate=true;mesh.visible=n>1;
  }
  return {
    beforeFrame,
    // The route a click would walk (pointer over ground), or null.
    setRoute(next){route=next;stage.wake();},
    // While paused: what the soldier will do on resume, as a fainter line.
    setPlanned(next){planned=next;stage.wake();},
    setRanges(on){showRanges=!!on;stage.wake();},
    // Each tick's events, as the simulation emitted them.
    onEvents(events){
      const now=performance.now(),w=getWorld();
      for(const e of events){
        if(e.kind==='hit')floating.set(e.defenderId,{text:`−${e.damage}${e.critical?'!':''}`,color:e.critical?'#ffcf6e':'#ffb39a',until:now+FLOAT_MS});
        if(e.kind==='block'){floating.set(e.defenderId,{text:'Blocked',color:'#d6e3e8',until:now+FLOAT_MS});reactions.set(e.defenderId,{kind:'block',start:e.tick});}
        if(e.kind==='miss')floating.set(e.defenderId,{text:'Miss',color:'#cfd2cc',until:now+FLOAT_MS});
        if(['hit','block'].includes(e.kind)){
          const d=actorOf(w,e.defenderId);if(d)sparks.push({x:d.x,z:d.z,shield:e.kind==='block',start:now,from:actorOf(w,e.attackerId)});
          if(e.kind==='hit')reactions.set(e.defenderId,{kind:'hit',start:e.tick,from:e.attackerId});
          const mine=[e.attackerId,e.defenderId].includes(w.controlled);
          if(mine&&!stage.reducedMotion)stage.cameraKick=Math.max(stage.cameraKick??0,e.kind==='hit'?(e.critical?1:.55):.3);
          // Close-ups on critical blows, never while paused or with reduced motion.
          if(e.kind==='hit'&&e.critical&&mine&&!stage.reducedMotion&&!paused()&&!stage.drag&&stage.cameraView!=='overview')
            closeUp={start:now,base:closeUp?.base??stage.orbit.distance};
        }
        if(stage.sound&&['swing','hit','block','throw','brace'].includes(e.kind)){
          const kind={swing:'swing',hit:'impact',block:'shield',throw:'javelin',brace:'guard'}[e.kind],who=actorOf(w,e.defenderId??e.actorId);
          const pan=who?clamp(ground(who.x,who.z).project(stage.camera).x,-1,1):0;
          if(stage.sound.cue(kind,{side:actorOf(w,e.attackerId??e.actorId)?.side==='enemy'?'enemy':'player',pan,intensity:e.critical?1.3:1}))stage.cuesPlayed++;
        }
      }
      // Readouts over the figures (name, health) follow the world when health changes.
      const key=w.actors.map(a=>`${a.hp}:${a.alive}`).join('|');
      if(key!==labelsKey){labelsKey=key;for(const a of w.actors){const unit=stage.encounter.units.find(u=>u.id===a.id);if(!unit)continue;
        unit.hp=a.hp;if(stage.labels?.has(a.id))stage.syncLabel(unit,stage.encounter);}stage.labelContentDirty=true;}
    },
    pose(unit,{time,dt,reducedMotion}){
      const w=getWorld(),a=actorOf(w,unit.id);if(!a)return null;
      const alpha=getAlpha(),r=rendered(),x=lerp(a.px,a.x,alpha),z=lerp(a.pz,a.z,alpha);
      const fx=lerp(a.pfx,a.fx,alpha),fz=lerp(a.pfz,a.fz,alpha),yaw=Math.atan2(fx,fz);
      unit.x=x/TILE-.5;unit.y=z/TILE-.5;
      // A presentation odometer: stride follows the distance the figure is drawn to cover.
      const before=last.get(a.id);let walked=odometer.get(a.id)??0;if(before)walked+=Math.hypot(x-before.x,z-before.z);
      last.set(a.id,{x,z});odometer.set(a.id,walked);
      let motion='idle',phase,locomotionWeight=1,impactDirection=0,visible=true,aimHeight,focusId=a.lock??a.action?.targetId??null;
      if(!a.alive){
        const p=(r-a.diedAt)/FALL_TICKS;motion='dead';phase=clamp(p,0,1);visible=r-a.diedAt<FALL_TICKS+LIE_TICKS;focusId=null;
      }else if(a.staggerUntil>r){
        motion='hit';phase=clamp((r-a.staggerStart)/Math.max(1,a.staggerUntil-a.staggerStart),0,1);
        const from=actorOf(w,a.lastHitBy);if(from)impactDirection=Math.atan2(Math.sin(Math.atan2(from.x-x,from.z-z)-yaw),Math.cos(Math.atan2(from.x-x,from.z-z)-yaw));
      }else if(a.action?.kind==='swing'){
        motion='attack';phase=swingPhase((r-a.action.start)/Math.max(1,a.action.end-a.action.start));
        const t=actorOf(w,a.action.targetId);if(t)aimHeight=ground(t.x,t.z).y+1.2;
      }else if(a.action?.kind==='throw'){
        motion='throw';phase=clamp((r-a.action.start)/Math.max(1,a.action.end-a.action.start),0,1);
      }else if(a.braceUntil>r){motion='brace';phase=undefined;}
      else if(a.moving){motion=a.gait==='run'?'run':'walk';phase=locomotionPhase(walked,motion);}
      const reaction=reactions.get(a.id);
      if(reaction&&r-reaction.start<REACTION_TICKS&&['idle','brace'].includes(motion)&&reaction.kind==='block'){
        motion='block';phase=clamp((r-reaction.start)/REACTION_TICKS,0,1);
      }
      if(!['walk','run'].includes(motion))locomotionWeight=1;
      return {at:{x:unit.x,y:unit.y},visible,active:motion!=='idle'||a.id===w.controlled,aimHeight,focusId,
        pose:{time:reducedMotion?0:time,dt,motion,phase,direction:yaw,locomotionDistance:walked,locomotionWeight,movementProgress:undefined,
          braced:a.braceUntil>r,health:a.alive?a.hp/a.maxHp:1,impactDirection,turnSign:1,reducedMotion,selected:false}};
    },
    effects(stage,{now}){
      const w=getWorld(),r=rendered();
      // Missiles in flight, from the hand to where they will land.
      stage.projectiles.forEach(p=>p.visible=false);
      w.projectiles.forEach((p,i)=>{
        if(!stage.projectiles[i]){const copy=stage.projectile.clone();stage.effectGroup.add(copy);stage.projectiles.push(copy);}
        const mesh=stage.projectiles[i],from=ground(p.fromX,p.fromZ).add(new T.Vector3(0,1.5,0)),to=ground(p.toX,p.toZ).add(new T.Vector3(0,1.1,0));
        mesh.scale.setScalar(p.missile==='pilum'?1:.85);positionProjectileTip(mesh,from,to,clamp((r-p.start)/Math.max(1,p.arrive-p.start),0,1));mesh.visible=true;
      });
      // Sparks where a blow lands or a shield turns it.
      for(let i=sparks.length-1;i>=0;i--)if(now-sparks[i].start>SPARK_MS)sparks.splice(i,1);
      stage.sparkClouds.forEach(c=>c.material.opacity=0);
      sparks.slice(-8).forEach((s,i)=>{
        if(!stage.sparkClouds[i]){const cloud=new T.Points(stage.sparkGeometry.clone(),stage.sparkMaterial.clone());cloud.frustumCulled=false;
          stage.effectGroup.add(cloud);stage.sparkClouds.push(cloud);}
        const at=ground(s.x,s.z).add(new T.Vector3(0,1.15,0)),source=s.from?ground(s.from.x,s.from.z).add(new T.Vector3(0,1.2,0)):undefined;
        sampleImpactParticles(stage.sparkClouds[i],at,(now-s.start)/SPARK_MS,{shield:s.shield,source});
      });
      // Floating numbers ride the figures' labels.
      const shown={};for(const [id,f]of floating){if(now>f.until)floating.delete(id);else shown[id]={text:f.text,color:f.color};}
      stage.previewTargets=Object.keys(shown).length?shown:null;
      // The route a click would walk, the soldier's destination, his locked target and his ranges.
      marks.route??=line('#f1dfa2');marks.goal??=ring(.46,.54,'#f1dfa2',.75);marks.target??=ring(.66,.76,'#ef8f74',.85);
      marks.ranges??=[ring(.98,1,'#f1dfa2',.45),ring(.995,1,'#9fd3d0',.4)];
      const hero=actorOf(w,w.controlled);marks.planned??=line('#cfe7e4',.5);
      if(route?.points?.length&&hero?.alive)lay(marks.route,[{x:hero.x,z:hero.z},...route.points]);else marks.route.visible=false;
      if(planned?.points?.length&&hero?.alive)lay(marks.planned,[{x:hero.x,z:hero.z},...planned.points]);else marks.planned.visible=false;
      feet??=footMarks(Math.max(16,w.actors.length));const counts={friend:0,enemy:0,guard:0};
      for(const a of w.actors){
        const figure=stage.actors.get(a.id);if(!a.alive||!figure?.group.visible)continue;
        const kind=a.side==='enemy'?'enemy':'friend',mesh=feet[kind];if(counts[kind]>=mesh.instanceMatrix.count)continue;
        const at=figure.group.position;feet.q.setFromAxisAngle(UP,figure.group.rotation.y).multiply(FLAT);
        feet.matrix.compose(new T.Vector3(at.x,at.y+.05,at.z),feet.q,feet.one);mesh.setMatrixAt(counts[kind]++,feet.matrix);
        if(a.braceUntil>r&&counts.guard<feet.guard.instanceMatrix.count){
          feet.matrix.compose(new T.Vector3(at.x,at.y+.06,at.z),feet.q,feet.one);feet.guard.setMatrixAt(counts.guard++,feet.matrix);
        }
      }
      for(const kind of ['friend','enemy','guard']){feet[kind].count=counts[kind];feet[kind].instanceMatrix.needsUpdate=true;}
      const goal=hero?.alive&&hero.path?.length?hero.path[hero.path.length-1]:null;
      marks.goal.visible=!!goal;if(goal){marks.goal.position.copy(ground(goal.x,goal.z));marks.goal.position.y+=.06;}
      const target=hero?.lock?actorOf(w,hero.lock):null,shownTarget=target?.alive?target:null;marks.target.visible=!!shownTarget;
      if(shownTarget){const u=stage.encounter.units.find(u=>u.id===shownTarget.id);if(u){marks.target.position.copy(stage.world(u));marks.target.position.y+=.07;}}
      const [reach,throwRange]=marks.ranges;
      for(const [mesh,metres]of [[reach,1.85],[throwRange,25]]){
        mesh.visible=showRanges&&!!hero?.alive;if(!mesh.visible)continue;const p=ground(lerp(hero.px,hero.x,getAlpha()),lerp(hero.pz,hero.z,getAlpha()));
        mesh.position.set(p.x,p.y+.08,p.z);mesh.scale.setScalar(metres);
      }
      // A close-up closes in for a moment, then gives the view back.
      if(closeUp){
        const k=(now-closeUp.start)/900;
        if(k>=1||stage.drag){stage.orbit.distance=closeUp.base;closeUp=null;}else stage.orbit.distance=closeUp.base*(1-.28*Math.sin(Math.PI*clamp(k,0,1)));
      }
    },
    dispose(){
      for(const m of [marks.route,marks.planned,marks.goal,marks.target,...(marks.ranges??[]),feet?.friend,feet?.enemy,feet?.guard])
        if(m){m.removeFromParent();m.geometry.dispose();m.material.dispose();}
    },
    stats:()=>({floating:floating.size,sparks:sparks.length})
  };
}
