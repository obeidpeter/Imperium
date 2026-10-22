import * as T from '../../vendor/three/three.module.js';
import {ACTOR_TIMING,locomotionPhase} from './actor-pose.js';
import {sampleImpactParticles} from './stage-particles.js';
import {positionProjectileTip} from './stage.js';
import {ITEMS} from '../data/realtime-rules.js';
import {EXCHANGE,MORALE} from '../data/realtime-squads.js';
import {actorById} from '../core/realtime/abilities.js';
import {span} from '../core/realtime/navigation.js';

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
// A man outside a squad stands alone (no formation crowd).
// In a chamber (chamber-world.js) each figure carries the Contest's own readings: his
// bloc (the toga trim and letter), a member's stance (his posture and marker) and a speaker's Resolve.
export function stageUnit(actor){
  const unit={id:actor.id,name:actor.name,side:actor.side,role:actor.role,...stageTile(actor.x,actor.z),hp:actor.hp,maxHp:actor.maxHp,facing:'east',morale:80,
    intent:'',hidden:false,trained:actor.side==='player',shield:actor.kit.some(id=>ITEMS[id]?.shield),crowd:false};
  const c=actor.civic;if(!c)return unit;
  // A hearing's presiding magistrate wears the toga and presides: no stance and no Resolve.
  if(c.role==='magistrate')return {...unit,role:'speaker',trained:false,shield:false,presides:true};
  return {...unit,trained:false,shield:false,bloc:c.bloc,interest:c.interest,vote:c.vote,...(c.role==='voter'?{stance:c.stance}:{resolve:c.resolve,maxResolve:c.maxResolve,blunted:c.blunted})};
}
// A squad (from Chapter IV) is drawn as one figure, its foremost standing man,
// with his comrades as that figure's crowd (formation.js), each where the world
// puts him. Its readout is the squad's: strength and morale.
const upright=a=>!!a&&a.alive&&!a.down&&!a.carriedBy;
const shownMember=a=>upright(a)&&!(a.hidden&&a.side==='enemy');
// The man the figure shows: the standing man with the lowest slot or, once all
// have fallen, the last to fall (the lowest slot among them).
export function squadLeader(world,squad){
  let lead=null,last=null;
  for(const id of squad.members){
    const m=actorById(world,id);if(!m)continue;
    if(shownMember(m)){if(!lead||m.slot<lead.slot)lead=m;}
    else if(!m.alive&&(!last||m.diedAt>last.diedAt||m.diedAt===last.diedAt&&m.slot<last.slot))last=m;
  }
  return lead??last;
}
export function squadUnit(world,squad){
  const lead=squadLeader(world,squad),at=lead??{x:squad.x,z:squad.z};
  return {id:squad.id,name:squad.name,side:squad.side,role:squad.role,...stageTile(at.x,at.z),hp:Math.ceil(squad.strength-1e-9),maxHp:squad.maxStrength,
    facing:'east',morale:squad.morale,intent:'',hidden:false,trained:squad.side!=='enemy',shield:!!lead?.kit?.some(id=>ITEMS[id]?.shield),
    crowd:Math.max(0,squad.maxMen-1),squad:true};
}
// The field objects as the stage's field features draw them (battlefield-features.js), on the
// fine map's tiles: a shut gate is its gate and timber across the rest of its line; a
// footbridge is a section on each tile of its crossing.
function stageField(world){
  const f=world.field;if(!f)return null;const tile=v=>Math.floor(v/2.5),objects=[];
  for(const o of world.objects??[]){
    if(!o.field)continue;const base={kind:o.kind,label:o.name,state:o.state,...(o.state==='burning'?{rounds:Math.max(1,o.rounds)}:{})};
    if(o.cells?.length){
      const mid=Math.floor(o.cells.length/2);
      o.cells.forEach(([x,y],i)=>{
        if(o.kind==='bridge')objects.push({...base,id:`${o.id}-${i}`,x,y,...(i===mid?{}:{section:true})});
        else if(i===mid)objects.push({...base,id:o.id,x,y});
        else if(o.state==='closed')objects.push({id:`${o.id}-timber-${i}`,kind:'barricade',label:o.name,state:'intact',x,y});
      });
    }else objects.push({...base,id:o.id,x:tile(o.x),y:tile(o.z)});
  }
  return {landmark:f.landmark,objects,choice:f.choice,outcome:f.outcome,deadline:f.deadline};
}
// The ground the stage draws: the world's, with a shut gate's line shown as the ground under
// it (the gate and its timber stand there instead, and open without rebuilding the ground).
function stageTerrain(world){
  const gates=(world.objects??[]).filter(o=>o.field&&o.kind==='gate'&&o.cells?.length);if(!gates.length)return world.map.terrain;
  const terrain=world.map.terrain.map(row=>[...row]);for(const g of gates)for(const [x,y]of g.cells)terrain[y][x]=g.under;return terrain;
}
// The stage's encounter: the campaign map with the world's actors, and no turn-based markers.
// A campaign battle's world walks an upsampled map (2.5 m tiles); the stage builds that one.
export function stageEncounter(encounter,world){
  const fine=world.map.width!==encounter.width||world.map.height!==encounter.height?{width:world.map.width,height:world.map.height,terrain:stageTerrain(world)}:{};
  const squads=(world.squads??[]).filter(q=>q.members.some(id=>{const m=actorById(world,id);return m&&(!m.hidden||m.side!=='enemy');})).map(q=>squadUnit(world,q));
  return {...encounter,...fine,units:[...world.actors.filter(a=>!a.squadId&&(!a.hidden||a.side!=='enemy')).map(stageUnit),...squads],mission:null,goal:null,
    field:stageField(world),operation:null,reinforcements:[],status:'active',turn:1,log:[]};
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
// Neutrals: a dashed ring, so allegiance never rests on colour alone.
function dashedGeometry(){
  const pos=[];for(let i=0;i<12;i++){const a0=i/12*Math.PI*2,a1=a0+Math.PI/12;
    for(let k=0;k<4;k++){const t0=a0+(a1-a0)*k/4,t1=a0+(a1-a0)*(k+1)/4,p=(r,t)=>[Math.cos(t)*r,Math.sin(t)*r,0];
      pos.push(...p(.44,t0),...p(.5,t0),...p(.5,t1),...p(.44,t0),...p(.5,t1),...p(.44,t1));}}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));return geometry;
}
const FLAT=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2),UP=new T.Vector3(0,1,0),DISC=new T.Matrix4(),ONE=new T.Vector3(1,1,1);
// How far an enemy has noticed the party, as a quarter-filled circle over his head (the guide's eye).
const NOTICE_GLYPHS=['◔','◑','◕'];
// Morale at a squad's standard (guide "Morale, cohesion and suppression"): an
// amber ring with a notch at its front when shaken, a crimson ring split in two
// when broken. Drawn flat in XY like the foot rings.
function arcGeometry(arcs,inner=1.02,outer=1.16){
  const pos=[],p=(r,t)=>[Math.cos(t)*r,Math.sin(t)*r,0];
  for(const [a0,a1]of arcs){const n=Math.max(4,Math.ceil((a1-a0)/(Math.PI/24)));
    for(let k=0;k<n;k++){const t0=a0+(a1-a0)*k/n,t1=a0+(a1-a0)*(k+1)/n;pos.push(...p(inner,t0),...p(outer,t0),...p(outer,t1),...p(inner,t0),...p(outer,t1),...p(inner,t1));}}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));return geometry;
}
const SHAKEN_ARCS=[[-Math.PI/2+.24,Math.PI*1.5-.24]],BROKEN_ARCS=[[.18,Math.PI-.18],[Math.PI+.18,Math.PI*2-.18]];
// A fixed fraction per squad (presentation only): its blows and volleys keep their own beat.
const beat=id=>{let h=2166136261;for(const c of String(id))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295;};
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const VOLLEY_MS=750;

export function createLivePresenter(stage,{world:getWorld,alpha:getAlpha,beforeFrame=()=>{},paused=()=>false}={}){
  const odometer=new Map(),last=new Map(),floating=new Map(),sparks=[],reactions=new Map(),marks={route:null,planned:null,goal:null,target:null,ranges:null,work:null};
  const leaders=new Map(),laid=new Set(),volleys=[],orderLines=[];
  let closeUp=null,showRanges=false,route=null,planned=null,labelsKey='',feet=null,marksOver={},selection=[],marker=null,remainsSeen=null,zone=null,
    shownIntentions=null,threat=null,intentionLines=null,threatLines=null,places=null,reachMesh=null;
  const gestures=new Map();
  // Line segments laid on the ground: each pair of points a segment, each segment cut so it follows the slope.
  function segments(color,capacity,opacity=.85){
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(3*capacity),3));
    const mesh=new T.LineSegments(geometry,new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false,forceSinglePass:true}));
    mesh.frustumCulled=false;mesh.renderOrder=4;mesh.visible=false;stage.overlay.add(mesh);return mesh;
  }
  function draw(mesh,pairs,lift=.09){
    const attr=mesh.geometry.attributes.position;let n=0;
    for(const [a,b]of pairs){
      const steps=Math.max(1,Math.min(16,Math.ceil(span(b.x-a.x,b.z-a.z)/1.5)));
      for(let i=0;i<steps&&n+2<=attr.count;i++){
        const p=ground(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps),q=ground(a.x+(b.x-a.x)*(i+1)/steps,a.z+(b.z-a.z)*(i+1)/steps);
        attr.setXYZ(n++,p.x,p.y+lift,p.z);attr.setXYZ(n++,q.x,q.y+lift,q.z);
      }
    }
    mesh.geometry.setDrawRange(0,n);attr.needsUpdate=true;mesh.visible=n>0;
  }
  // One instanced draw each for friends' rings, enemies' rings, guard arcs, the
  // selected squads' rings and the shaken and broken squads' morale rings.
  function footMarks(count){
    const material=(color,opacity=.85)=>new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});
    const make=(geometry,color,opacity)=>{const m=new T.InstancedMesh(geometry,material(color,opacity),count);m.count=0;m.frustumCulled=false;m.renderOrder=3;stage.overlay.add(m);return m;};
    return {count,friend:make(footGeometry(false),'#9fd3d0'),enemy:make(footGeometry(true),'#ef8f74'),neutral:make(dashedGeometry(),'#e6dfc8'),
      guard:make(new T.RingGeometry(.56,.68,24,1,-Math.PI*5/6,Math.PI*2/3),'#f1d38a'),chosen:make(new T.RingGeometry(.6,.7,32),'#f3d48d',.95),
      shaken:make(arcGeometry(SHAKEN_ARCS),'#e0a23a',.9),broken:make(arcGeometry(BROKEN_ARCS),'#c8323f',.92),
      matrix:new T.Matrix4(),q:new T.Quaternion(),one:new T.Vector3(1,1,1)};
  }
  const KINDS=['friend','enemy','neutral','guard','chosen','shaken','broken'];
  function disposeFeet(){if(!feet)return;for(const kind of KINDS){feet[kind].removeFromParent();feet[kind].geometry.dispose();feet[kind].material.dispose();}feet=null;}
  const rendered=()=>{const w=getWorld();return w.tick-1+getAlpha();};
  const actorOf=(w,id)=>actorById(w,id);
  const squadOf=(w,id)=>w.squads?.find(q=>q.id===id)??null;
  // Marks over a man of a squad go over his squad's standard (the squad's figure carries the label).
  const labelOf=(w,id)=>actorOf(w,id)?.squadId??id;
  const ground=(x,z)=>{const p=worldPoint(getWorld(),{x,z});return new T.Vector3(p.x,stage.surfaceHeight(p.x,p.z),p.z);};
  const lerped=(a,alpha)=>({x:lerp(a.px??a.x,a.x,alpha),z:lerp(a.pz??a.z,a.z,alpha)});
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
  function workRing(){
    const mesh=new T.Mesh(new T.RingGeometry(.62,.74,48).toNonIndexed(),new T.MeshBasicMaterial({color:'#f1d38a',transparent:true,opacity:.9,depthWrite:false,
      side:T.DoubleSide,forceSinglePass:true}));
    mesh.rotation.x=-Math.PI/2;mesh.renderOrder=4;mesh.visible=false;stage.overlay.add(mesh);return mesh;
  }
  function lay(mesh,points){
    const attr=mesh.geometry.attributes.position,n=Math.min(points.length,attr.count);
    for(let i=0;i<n;i++){const p=ground(points[i].x,points[i].z);attr.setXYZ(i,p.x,p.y+.07,p.z);}
    mesh.geometry.setDrawRange(0,n);attr.needsUpdate=true;mesh.visible=n>1;
  }
  // One man's place and pose, interpolated between his last two ticks.
  function figurePose(unit,a,{time,dt,reducedMotion}){
    const w=getWorld(),alpha=getAlpha(),r=rendered(),x=lerp(a.px,a.x,alpha),z=lerp(a.pz,a.z,alpha);
    const fx=lerp(a.pfx,a.fx,alpha),fz=lerp(a.pfz,a.fz,alpha),yaw=Math.atan2(fx,fz);
    unit.x=x/TILE-.5;unit.y=z/TILE-.5;
    // A presentation odometer: stride follows the distance the figure is drawn to cover.
    const before=last.get(a.id);let walked=odometer.get(a.id)??0;if(before)walked+=Math.hypot(x-before.x,z-before.z);
    last.set(a.id,{x,z});odometer.set(a.id,walked);
    let motion='idle',phase,locomotionWeight=1,impactDirection=0,visible=true,aimHeight,focusId=a.lock??a.action?.targetId??null,lift=0,direction=yaw;
    const carrier=a.carriedBy?actorOf(w,a.carriedBy):null;
    if(carrier){
      // Carried across the shoulders: he lies at the carrier's side, a metre up, along the carrier's way.
      const cx=lerp(carrier.px,carrier.x,alpha),cz=lerp(carrier.pz,carrier.z,alpha),cy=Math.atan2(lerp(carrier.pfx,carrier.fx,alpha),lerp(carrier.pfz,carrier.fz,alpha));
      unit.x=(cx+Math.cos(cy)*.32)/TILE-.5;unit.y=(cz-Math.sin(cy)*.32)/TILE-.5;motion='dead';phase=1;lift=1.05;direction=cy+Math.PI/2;focusId=null;
    }else if(a.alive&&a.down){motion='dead';phase=1;focusId=null;}
    else if(a.stand){lift=a.stand;}
    else if(!a.alive){
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
    // A chamber's speakers: a speech is spoken with the hands; a speaker at 0 Resolve stands aside.
    else if(a.civic?.withdrawn){motion='withdrawn';phase=1;}
    else if(gestures.get(a.id)?.until>performance.now()){const g=gestures.get(a.id);motion=g.motion;phase=clamp(1-(g.until-performance.now())/g.span,0,1);focusId=g.toward??focusId;}
    const reaction=reactions.get(a.id);
    if(reaction&&r-reaction.start<REACTION_TICKS&&['idle','brace'].includes(motion)&&reaction.kind==='block'){
      motion='block';phase=clamp((r-reaction.start)/REACTION_TICKS,0,1);
    }
    if(!['walk','run'].includes(motion))locomotionWeight=1;
    if(focusId)focusId=labelOf(w,focusId);
    return {at:{x:unit.x,y:unit.y},visible,active:motion!=='idle'||a.id===w.controlled,aimHeight,focusId,lift,
      pose:{time:reducedMotion?0:time,dt,motion,phase,direction,locomotionDistance:walked,locomotionWeight,movementProgress:undefined,
        braced:a.braceUntil>r,health:a.alive?a.hp/a.maxHp:1,impactDirection,turnSign:1,reducedMotion,selected:false}};
  }
  // A squad's figure is its foremost man; his comrades are its crowd, each at his
  // own place and facing (unit-local slots for formation.js). Engaged, the front
  // trades blows (or draws bows) on the squad's own beat.
  function squadPose(unit,squad,options){
    const w=getWorld(),alpha=getAlpha(),r=rendered(),lead=squadLeader(w,squad);
    if(!lead)return {at:{x:unit.x,y:unit.y},visible:false,active:false,lift:0,focusId:null,crowd:{slots:[]},
      pose:{time:0,dt:options.dt,motion:'idle',direction:0,locomotionWeight:1,health:1,impactDirection:0,turnSign:1,reducedMotion:options.reducedMotion,selected:false}};
    if(leaders.get(squad.id)!==lead.id){if(leaders.has(squad.id))stage.poseReset?.add(unit.id);leaders.set(squad.id,lead.id);}
    const out=figurePose(unit,lead,options),p=out.pose,at=lerped(lead,alpha),standingLead=upright(lead);
    const facing=standingLead&&!squad.broken&&squad.facing?Math.atan2(squad.facing.x-at.x,squad.facing.z-at.z):null;
    if(facing!==null&&['idle','brace','walk'].includes(p.motion)){
      const shooting=!squad.contact&&['archer','raider'].includes(squad.role),k=((r/EXCHANGE.everyTicks)+beat(squad.id))%1;
      p.motion=shooting&&squad.role==='raider'?'throw':'attack';p.phase=k;p.direction=facing;p.locomotionWeight=1;out.active=true;
    }
    const yaw0=p.direction,c=Math.cos(yaw0),s=Math.sin(yaw0),slots=[];
    if(standingLead)for(const id of squad.members){
      const m=actorOf(w,id);if(!m||m===lead||!shownMember(m))continue;
      const q=lerped(m,alpha),dx=q.x-at.x,dz=q.z-at.z;
      const yaw=facing!==null?Math.atan2(squad.facing.x-q.x,squad.facing.z-q.z):Math.atan2(lerp(m.pfx,m.fx,alpha),lerp(m.pfz,m.fz,alpha));
      slots.push({x:c*dx-s*dz,z:s*dx+c*dz,yaw:wrapAngle(yaw-yaw0)});
    }
    out.crowd={slots};return out;
  }
  return {
    beforeFrame,
    // The route a click would walk (pointer over ground), or null.
    setRoute(next){route=next;stage.wake();},
    // While paused: what the soldier will do on resume, as a fainter line.
    setPlanned(next){planned=next;stage.wake();},
    setRanges(on){showRanges=!!on;stage.wake();},
    // Marks over people's heads that the page decides (a camp's speech marks): {id: {text, color}}.
    setMarks(next){marksOver={...(next??{})};stage.wake();},
    // The squads selected on the page, and the keyboard's order marker (squad-control.js).
    setSelection(ids){selection=[...(ids??[])];stage.wake();},
    setMarker(point){marker=point?{x:point.x,z:point.z}:null;stage.wake();},
    // The deployment zone (from Chapter VII), outlined on the ground until the advance sounds.
    setDeployment(next){zone=next?{...next}:null;stage.wake();},
    // Each visible enemy's intention (hold U while paused): an arrow to where he goes or whom he strikes (intel.js).
    setIntentions(list){shownIntentions=list?list.map(i=>({...i})):null;stage.wake();},
    // The ground an enemy could strike within the next round, hatched in red (intel.js threatArea).
    setThreat(area){threat=area?{...area}:null;stage.wake();},
    // A chamber: where the speaker may walk this hour, a pale disc on each place ({x, z} in metres).
    setReach(points){places=points?.length?points.map(p=>({x:p.x,z:p.z})):null;stage.wake();},
    // A gesture for a moment (a speaker's speech), facing whom it is for.
    gesture(id,motion,{ms=1600,toward=null}={}){gestures.set(id,{motion,until:performance.now()+ms,span:ms,toward});stage.wake();},
    // A number over a head for a moment (a member's new stance).
    note(id,text,color='#f1dfa2'){floating.set(id,{text,color,until:performance.now()+FLOAT_MS*1.6});stage.wake();},
    // Each tick's events, as the simulation emitted them.
    onEvents(events){
      const now=performance.now(),w=getWorld();
      for(const e of events){
        if(e.kind==='hit')floating.set(labelOf(w,e.defenderId),{text:`−${e.damage}${e.critical?'!':''}`,color:e.critical?'#ffcf6e':'#ffb39a',until:now+FLOAT_MS});
        if(e.kind==='block'){floating.set(labelOf(w,e.defenderId),{text:'Blocked',color:'#d6e3e8',until:now+FLOAT_MS});reactions.set(e.defenderId,{kind:'block',start:e.tick});}
        if(e.kind==='miss')floating.set(labelOf(w,e.defenderId),{text:'Miss',color:'#cfd2cc',until:now+FLOAT_MS});
        if(['hit','block'].includes(e.kind)){
          const d=actorOf(w,e.defenderId);if(d)sparks.push({x:d.x,z:d.z,shield:e.kind==='block',start:now,from:actorOf(w,e.attackerId)});
          if(e.kind==='hit')reactions.set(e.defenderId,{kind:'hit',start:e.tick,from:e.attackerId});
          const mine=[e.attackerId,e.defenderId].includes(w.controlled);
          if(mine&&!stage.reducedMotion)stage.cameraKick=Math.max(stage.cameraKick??0,e.kind==='hit'?(e.critical?1:.55):.3);
          // Close-ups on critical blows, never while paused or with reduced motion.
          if(e.kind==='hit'&&e.critical&&mine&&!stage.reducedMotion&&!paused()&&!stage.drag&&stage.cameraView!=='overview')
            closeUp={start:now,base:closeUp?.base??stage.orbit.distance};
        }
        // Squads trade blows a second at a time: sparks where the fronts meet, a volley from the archers' ranks.
        if(e.kind==='exchange'){
          if(e.ranged)volleys.push({from:e.squadId,to:e.targetSquadId,start:now,seed:`${e.squadId}:${e.tick}`,at:{x:e.x,z:e.z}});
          else sparks.push({x:e.x,z:e.z,shield:beat(`${e.squadId}:${e.tick}`)<.4,start:now,from:{x:e.fromX,z:e.fromZ}});
          if(stage.sound){const pan=clamp(ground(e.x,e.z).project(stage.camera).x,-1,1);
            if(stage.sound.cue(e.ranged?'bow':'clash',{side:squadOf(w,e.squadId)?.side==='enemy'?'enemy':'player',pan,intensity:.8}))stage.cuesPlayed++;}
        }
        // A man of a squad falls: the count over its standard.
        if(e.kind==='fall'&&e.squadId){const f=floating.get(e.squadId),n=f?.until>now&&f.men?f.men+1:1;
          floating.set(e.squadId,{text:`−${n} ${n===1?'man':'men'}`,color:'#ffb39a',until:now+FLOAT_MS,men:n});}
        if(stage.sound&&['swing','hit','block','throw','brace'].includes(e.kind)){
          const kind={swing:'swing',hit:'impact',block:'shield',throw:'javelin',brace:'guard'}[e.kind],who=actorOf(w,e.defenderId??e.actorId);
          const pan=who?clamp(ground(who.x,who.z).project(stage.camera).x,-1,1):0;
          if(stage.sound.cue(kind,{side:actorOf(w,e.attackerId??e.actorId)?.side==='enemy'?'enemy':'player',pan,intensity:e.critical?1.3:1}))stage.cuesPlayed++;
        }
      }
      // Readouts over the figures (name, health; a squad's strength and morale) follow the world.
      const key=w.actors.map(a=>`${a.hp}:${a.alive}`).join('|')+(w.squads??[]).map(q=>`|${Math.ceil(q.strength-1e-9)}:${q.morale>MORALE.shaken?2:q.broken?0:1}`).join('');
      if(key!==labelsKey){labelsKey=key;
        for(const unit of stage.encounter.units){
          const q=unit.squad?squadOf(w,unit.id):null,a=q?null:actorOf(w,unit.id);if(!q&&!a)continue;
          if(q){unit.hp=Math.ceil(q.strength-1e-9);unit.morale=q.morale;}else unit.hp=a.hp;
          if(stage.labels?.has(unit.id))stage.syncLabel(unit,stage.encounter);
        }
        stage.labelContentDirty=true;}
    },
    pose(unit,options){
      const w=getWorld(),squad=unit.squad?squadOf(w,unit.id):null;
      if(squad)return squadPose(unit,squad,options);
      const a=actorOf(w,unit.id);return a?figurePose(unit,a,options):null;
    },
    effects(stage,{now}){
      const w=getWorld(),r=rendered(),alpha=getAlpha();
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
      // A squad's volley: an arrow from each of its standing men, falling on the target squad; spent arrows stay.
      const shots=[];
      for(let i=volleys.length-1;i>=0;i--){
        const v=volleys[i],k=(now-v.start)/VOLLEY_MS,from=squadOf(w,v.from),to=squadOf(w,v.to);
        const men=from?from.members.map(id=>actorOf(w,id)).filter(shownMember):[];
        const target=to?squadLeader(w,to):null,aim=target&&upright(target)?lerped(target,alpha):v.at,end=ground(aim.x,aim.z).add(new T.Vector3(0,.9,0));
        if(k>=1||!men.length){
          if(men.length)stage.remains?.arrows?.({from:ground(men[0].x,men[0].z),to:ground(v.at.x,v.at.z),count:Math.min(3,men.length),seed:v.seed});
          volleys.splice(i,1);continue;
        }
        men.forEach((m,index)=>{const q=lerped(m,alpha);shots.push({from:ground(q.x,q.z).add(new T.Vector3(0,1.35,0)),to:end,progress:clamp(k,0,1),index,seed:v.seed,
          size:from.role==='raider'?2.1:1});});
      }
      // Floating numbers ride the figures' labels.
      const shown={};for(const [id,f]of floating){if(now>f.until)floating.delete(id);else shown[id]={text:f.text,color:f.color};}
      for(const [id,mark]of Object.entries(marksOver))if(!shown[id])shown[id]=mark;
      // An enemy's notice of the party: filling quarters while he wonders, ! once he knows (presentation of ai.notice only).
      const party=[w.heroId,...w.party];
      for(const a of w.actors){
        if(a.side!=='enemy'||!a.alive||a.hidden||a.squadId||shown[a.id]||a.practice)continue;
        const n=Math.max(0,...party.map(id=>a.ai?.notice?.[id]??0));
        if(n>=100&&a.ai?.state!=='engage')shown[a.id]={text:'!',color:'#ef8f74'};
        else if(n>0&&n<100)shown[a.id]={text:NOTICE_GLYPHS[Math.min(2,Math.floor(n/34))],color:n>=50?'#f1c27d':'#e6dfc8'};
      }
      // A squad's low morale: an exclamation mark over its standard.
      for(const q of w.squads??[])if(!shown[q.id]&&q.strength>0&&q.morale<=MORALE.shaken)shown[q.id]={text:'!',color:q.broken?'#ff8f8f':'#f1c27d'};
      stage.previewTargets=Object.keys(shown).length?shown:null;
      // The route a click would walk, the soldier's destination, his locked target and his ranges.
      marks.route??=line('#f1dfa2');marks.goal??=ring(.46,.54,'#f1dfa2',.75);marks.target??=ring(.66,.76,'#ef8f74',.85);
      marks.ranges??=[ring(.98,1,'#f1dfa2',.45),ring(.995,1,'#9fd3d0',.4)];
      const hero=actorOf(w,w.controlled);marks.planned??=line('#cfe7e4',.5);
      if(route?.points?.length&&hero?.alive)lay(marks.route,[{x:hero.x,z:hero.z},...route.points]);else marks.route.visible=false;
      if(planned?.points?.length&&hero?.alive)lay(marks.planned,[{x:hero.x,z:hero.z},...planned.points]);else marks.planned.visible=false;
      // Rings at every man's feet (a squad's men drawn where the world puts them), the
      // selected squads' rings, guard arcs, and the morale rings at shaken and broken standards.
      const needed=w.actors.length+(w.squads?.length??0)+8;if(feet&&feet.count<needed)disposeFeet();
      feet??=footMarks(Math.max(16,needed+24));const counts=Object.fromEntries(KINDS.map(k=>[k,0]));
      const put=(kind,at,yaw,lift=.05)=>{const mesh=feet[kind];if(counts[kind]>=feet.count)return;feet.q.setFromAxisAngle(UP,yaw).multiply(FLAT);
        feet.matrix.compose(new T.Vector3(at.x,at.y+lift,at.z),feet.q,feet.one);mesh.setMatrixAt(counts[kind]++,feet.matrix);};
      const chosen=new Set(selection);
      for(const a of w.actors){
        if(!a.alive||a.carriedBy)continue;let at,yaw,braced=a.braceUntil>r;
        if(a.squadId){
          const q=squadOf(w,a.squadId),figure=stage.actors.get(a.squadId);if(!q||!figure?.group.visible||!shownMember(a))continue;
          const p=lerped(a,alpha);at=ground(p.x,p.z);yaw=Math.atan2(lerp(a.pfx,a.fx,alpha),lerp(a.pfz,a.fz,alpha));braced||=!!q.braced;
          if(chosen.has(q.id))put('chosen',at,yaw,.055);
        }else{const figure=stage.actors.get(a.id);if(!figure?.group.visible)continue;at=figure.group.position;yaw=figure.group.rotation.y;}
        put(a.side==='enemy'?'enemy':a.side==='neutral'?'neutral':'friend',at,yaw);
        if(braced)put('guard',at,yaw,.06);
      }
      for(const q of w.squads??[]){
        if(q.strength<=0||q.morale>MORALE.shaken)continue;const figure=stage.actors.get(q.id);if(!figure?.group.visible)continue;
        put(q.broken?'broken':'shaken',figure.group.position,figure.group.rotation.y,.07);
      }
      for(const kind of KINDS){feet[kind].count=counts[kind];feet[kind].instanceMatrix.needsUpdate=true;}
      // A chamber speaker's reach: a pale disc on each place he may walk to this hour.
      if(places&&(!reachMesh||reachMesh.instanceMatrix.count<places.length)){reachMesh?.removeFromParent();reachMesh?.geometry.dispose();reachMesh?.material.dispose();
        reachMesh=new T.InstancedMesh(new T.CircleGeometry(1.02,28),new T.MeshBasicMaterial({color:'#5fb3ad',transparent:true,opacity:.3,depthWrite:false,
          side:T.DoubleSide,forceSinglePass:true}),Math.max(32,places.length));reachMesh.frustumCulled=false;reachMesh.renderOrder=2;stage.overlay.add(reachMesh);}
      if(reachMesh){
        reachMesh.count=places?.length??0;
        (places??[]).forEach((p,i)=>{const at=ground(p.x,p.z);DISC.compose(at.setY(at.y+.035),FLAT,ONE);reachMesh.setMatrixAt(i,DISC);});
        reachMesh.instanceMatrix.needsUpdate=true;reachMesh.visible=!!places;
      }
      // The deployment zone's edge, following the ground.
      marks.zone??=line('#9fd3d0',.9);
      if(zone){const z={...zone,x1:Math.max(zone.x0+.5,zone.x1-.25),z0:zone.z0+.25,z1:zone.z1-.25},pts=[],side=(a,b,n)=>{for(let i=0;i<n;i++)pts.push({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n});};
        const c=[{x:z.x0+.25,z:z.z0},{x:z.x1,z:z.z0},{x:z.x1,z:z.z1},{x:z.x0+.25,z:z.z1}],per=Math.max(4,Math.floor(63/4));
        for(let i=0;i<4;i++)side(c[i],c[(i+1)%4],per);pts.push(c[0]);lay(marks.zone,pts);}
      else marks.zone.visible=false;
      // Intentions: red to a man or squad he means to strike, amber to where he goes; a head at the end.
      intentionLines??={strike:segments('#ef8f74',2400),move:segments('#f1c27d',2400)};
      if(shownIntentions?.length){
        const pairs={strike:[],move:[]};
        for(const it of shownIntentions){
          const dx=it.to.x-it.from.x,dz=it.to.z-it.from.z,d=span(dx,dz);if(d<1)continue;const ux=dx/d,uz=dz/d,h=Math.min(1.6,d*.3);
          const list=pairs[it.strike?'strike':'move'];list.push([it.from,it.to]);
          for(const s of [1,-1])list.push([it.to,{x:it.to.x-ux*h-uz*h*.55*s,z:it.to.z-uz*h+ux*h*.55*s}]);
        }
        draw(intentionLines.strike,pairs.strike,.14);draw(intentionLines.move,pairs.move,.14);
      }else{intentionLines.strike.visible=false;intentionLines.move.visible=false;}
      // A threat: his reach's edge, and hatching across it.
      threatLines??=segments('#e0503c',4000,.75);
      if(threat){
        const pairs=[],r=threat.radius,c={x:threat.x,z:threat.z},n=48;
        for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;pairs.push([{x:c.x+Math.cos(a)*r,z:c.z+Math.sin(a)*r},{x:c.x+Math.cos(b)*r,z:c.z+Math.sin(b)*r}]);}
        const gap=Math.max(1.5,r/14);
        // Diagonal chords across the circle, k metres apart.
        for(let k=-r+gap/2;k<r;k+=gap){const mx=c.x+k*Math.SQRT1_2,mz=c.z-k*Math.SQRT1_2,L=Math.sqrt(Math.max(0,r*r-k*k));
          if(L>0)pairs.push([{x:mx-L*Math.SQRT1_2,z:mz-L*Math.SQRT1_2},{x:mx+L*Math.SQRT1_2,z:mz+L*Math.SQRT1_2}]);}
        draw(threatLines,pairs,.1);
      }else threatLines.visible=false;
      // The keyboard's order marker, and where each selected squad is going (or whom it attacks).
      marks.marker??=[ring(.55,.72,'#f3d48d',.95),ring(0,.16,'#f3d48d',.95)];
      for(const m of marks.marker){m.visible=!!marker&&(chosen.size>0||!!zone);if(m.visible){m.position.copy(ground(marker.x,marker.z));m.position.y+=.08;}}
      let lines=0;
      for(const id of selection){
        const q=squadOf(w,id);if(!q||q.strength<=0)continue;const order=q.pending?.order??q.order;if(!order)continue;
        const lead=squadLeader(w,q);if(!lead||!upright(lead))continue;const from=lerped(lead,alpha);let to=null;
        if(order.kind==='advance'&&Number.isFinite(order.x))to={x:order.x,z:order.z};
        else if(order.kind==='attack'){const t=squadOf(w,order.targetId),man=t?squadLeader(w,t):actorOf(w,order.targetId);if(man&&upright(man))to=lerped(man,alpha);}
        if(!to)continue;
        if(!orderLines[lines]){orderLines[lines]={advance:line('#f1dfa2',.7),attack:line('#ef8f74',.75)};}
        const pair=orderLines[lines++],kind=order.kind==='attack'?'attack':'advance';lay(pair[kind],[from,to]);pair[kind==='attack'?'advance':'attack'].visible=false;
      }
      for(let i=lines;i<orderLines.length;i++){orderLines[i].advance.visible=false;orderLines[i].attack.visible=false;}
      // Men of a squad who fell lie where they fell (the figure's own man is laid by the stage).
      // Remains rebuilt (a quality change) are laid again.
      if(stage.remains!==remainsSeen){remainsSeen=stage.remains;laid.clear();}
      for(const q of w.squads??[]){
        const figureMan=q.strength<=0?squadLeader(w,q):null,unit=stage.encounter?.units?.find(u=>u.id===q.id),figure=stage.actors.get(q.id);
        if(!unit||!figure||!stage.remains)continue;
        for(const id of q.members){
          const m=actorOf(w,id);if(!m||m.alive||laid.has(id)||m===figureMan)continue;laid.add(id);
          stage.remains.fall({...stage.fallenKind(unit,figure),world:ground(m.x,m.z),yaw:Math.atan2(m.fx,m.fz)+.35*(m.slot%2?1:-1),
            animate:!stage.reducedMotion&&r-m.diedAt<FALL_TICKS});
        }
      }
      // Work that takes time (binding wounds, using an object) fills a ring at the worker's feet.
      marks.work??=workRing();const worker=w.actors.find(a=>a.alive&&a.action?.kind==='work'&&(a.id===w.controlled||w.party.includes(a.id)||a.id===w.heroId));
      if(worker&&stage.actors.get(worker.id)?.group.visible){
        const k=clamp((r-worker.action.start)/Math.max(1,worker.action.end-worker.action.start),0,1),at=stage.actors.get(worker.id).group.position;
        marks.work.position.set(at.x,at.y+.09,at.z);marks.work.geometry.setDrawRange(0,Math.max(6,Math.floor(k*48)*6));marks.work.visible=true;
      }else marks.work.visible=false;
      const goal=hero?.alive&&hero.path?.length?hero.path[hero.path.length-1]:null;
      marks.goal.visible=!!goal;if(goal){marks.goal.position.copy(ground(goal.x,goal.z));marks.goal.position.y+=.06;}
      const target=hero?.lock?actorOf(w,hero.lock):null,shownTarget=target?.alive?target:null;marks.target.visible=!!shownTarget;
      if(shownTarget){const p=lerped(shownTarget,alpha);marks.target.position.copy(ground(p.x,p.z));marks.target.position.y+=.07;}
      const [reach,throwRange]=marks.ranges;
      for(const [mesh,metres]of [[reach,1.85],[throwRange,25]]){
        mesh.visible=showRanges&&!!hero?.alive;if(!mesh.visible)continue;const p=ground(lerp(hero.px,hero.x,alpha),lerp(hero.pz,hero.z,alpha));
        mesh.position.set(p.x,p.y+.08,p.z);mesh.scale.setScalar(metres);
      }
      // A close-up closes in for a moment, then gives the view back.
      if(closeUp){
        const k=(now-closeUp.start)/900;
        if(k>=1||stage.drag){stage.orbit.distance=closeUp.base;closeUp=null;}else stage.orbit.distance=closeUp.base*(1-.28*Math.sin(Math.PI*clamp(k,0,1)));
      }
      return {volleys:shots};
    },
    dispose(){
      for(const m of [marks.route,marks.planned,marks.goal,marks.target,marks.work,marks.zone,intentionLines?.strike,intentionLines?.move,threatLines,...(marks.ranges??[]),...(marks.marker??[]),
        ...orderLines.flatMap(l=>[l.advance,l.attack])])
        if(m){m.removeFromParent();m.geometry.dispose();m.material.dispose();}
      if(reachMesh){reachMesh.removeFromParent();reachMesh.geometry.dispose();reachMesh.material.dispose();reachMesh=null;}
      disposeFeet();
    },
    stats:()=>({floating:floating.size,sparks:sparks.length,volleys:volleys.length})
  };
}
