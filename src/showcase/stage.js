import * as T from '../../vendor/three/three.module.js';
import {createActor} from './actors.js';
import {createEnvironment,gridToWorld} from './environment.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../ui/animation-timeline.js';
import {facingYaw,isAlive} from './session.js';
import {createBattleSound} from './battle-sound.js';
import {meleeOffset,combatCues,retimeStageTimeline,locomotionPhase,combatReaction} from './combat-presentation.js';
import {getSceneProfile} from './campaign-scene-profile.js';
import {actorVisible,civicActor,actorReadout,effectReadout,missionReadouts} from './stage-readout.js';
import {layoutStageLabels} from './stage-label-layout.js';
import {findFocusCamera} from './stage-focus-camera.js';
import {createSky} from './sky.js';
import {createSceneLighting} from './scene-lighting.js';
import {createContactShadows} from './contact-shadows.js';
import {createParticleMask,sampleImpactParticles} from './stage-particles.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>t*t*(3-2*t);
const QUALITY={performance:{ratio:1,shadow:1024,fps:30},balanced:{ratio:1.5,shadow:2048,fps:45},high:{ratio:2,shadow:4096,fps:60}};
const blendYaw=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*ease(clamp(t,0,1));
const pathYaw=(a,b)=>Math.atan2(b.x-a.x,b.y-a.y);

// The authored release anchor and impact point describe the missile tip, not
// its mesh origin. Preserve those endpoints through either projectile scale.
export function positionProjectileTip(projectile,from,to,progress){
  const t=clamp(progress,0,1),tip=from.clone().lerp(to,t),direction=to.clone().sub(from);tip.y+=Math.sin(t*Math.PI)*1.8;direction.y+=Math.cos(t*Math.PI)*Math.PI*1.8;direction.normalize();
  projectile.position.copy(tip);projectile.lookAt(tip.clone().add(direction));projectile.position.addScaledVector(direction,-1.01*projectile.scale.z);
}

// Picking follows the visible elevation, including the two raised board cells.
export function intersectGround(ray,height,target=new T.Vector3()){
  const plane=new T.Plane(new T.Vector3(0,1,0),0);
  if(!ray.intersectPlane(plane,target))return null;
  for(let i=0;i<8;i++){const y=height(target.x,target.z);if(Math.abs(target.y-y)<.0001)break;plane.constant=-y;if(!ray.intersectPlane(plane,target))return null;}
  return target;
}

// Interpret the shared 2D presentation timeline without modifying it or the
// committed unit. Walking progress is distance, action progress is time.
export function stageActorPose(unit,frame,timeline,{time=0,dt=0,reducedMotion=false}={}){
  const o=frame?.unitOverrides[unit.id],pair=timeline?.units[unit.id];
  let motion=o?.pose??'idle',phase=o?.progress,locomotionDistance=0;if(motion==='idle'&&unit.braced)motion='brace';
  let direction=blendYaw(facingYaw(o?.previousFacing??unit.facing),facingYaw(o?.facing??unit.facing),o?.turnProgress??1);
  if(['walk','run','cavalry-move'].includes(motion)){
    const track=timeline?.tracks.find(t=>t.unitId===unit.id&&t.path);
    if(track?.path.length>1){
      const distance=ease(clamp(o.progress,0,1))*(track.path.length-1),segment=Math.min(track.path.length-2,Math.floor(distance));
      locomotionDistance=distance*2.5;phase=locomotionPhase(locomotionDistance,motion,['cavalry','heavy'].includes(unit.role));
      const previous=segment?pathYaw(track.path[segment-1],track.path[segment]):facingYaw(pair?.before.facing??unit.facing);
      direction=blendYaw(previous,pathYaw(track.path[segment],track.path[segment+1]),(distance-segment)/.18);
    }else{motion='idle';phase=0;}
    if(motion==='cavalry-move')motion='run';
  }
  if(motion==='turn')motion=unit.braced?'brace':'idle';
  if(['attack','cavalry-attack','throw','speak','order','rally'].includes(motion)){
    const track=timeline?.tracks.find(t=>t.unitId===unit.id&&t.pose===o?.pose&&t.target),from=o??unit;
    if(track&&Math.hypot(track.target.x-from.x,track.target.y-from.y)>.01)direction=Math.atan2(track.target.x-from.x,track.target.y-from.y);
  }
  if(motion==='cavalry-attack')motion='attack';
  // A timeline retreat marks withdrawal, not backwards walking. Before its
  // impact the committed zero-HP unit must still stand at its prior health.
  if(motion==='retreat')motion='withdrawn';
  if(civicActor(unit)&&!isAlive(unit)){
    if(motion==='withdrawn')motion='yield';
    else if(!o||o.alpha<=0){motion='yield';phase=1;}
  }
  const prior=pair?.before??unit;
  const health=motion==='withdrawn'?1:!isAlive(unit)&&o&&o.alpha>0?(prior.resolve??prior.hp??1)/(prior.maxResolve??prior.maxHp??1):(unit.resolve??unit.hp??1)/(unit.maxResolve??unit.maxHp??1);
  return {time:reducedMotion?0:time,dt,motion,reducedMotion,locomotionDistance,...combatReaction(unit,frame,timeline,direction),braced:unit.braced||pair?.before.braced,locomotionWeight:['walk','run'].includes(motion)?Math.min(1,(o?.progress??1)/.12,(1-(o?.progress??0))/.12):1,phase:motion==='brace'&&o?.pose!=='brace'?.45:phase,direction,health,selected:false};
}
export class BattleStage{
  constructor(canvas,encounter,{onPick=()=>{},onHover=()=>{},quality='balanced',reducedMotion=false,keyboardMode='orbit',onFrame=()=>{},chapter,rank}={}){
    this.chapter=chapter??Number(/^ch(\d+)/.exec(encounter.id)?.[1]??1);this.rank=rank;this.profile=getSceneProfile(encounter,{chapter:this.chapter});this.keyboardMode=keyboardMode;this.onFrame=onFrame;this.samples=[];this.paused=false;this.canvas=canvas;this.encounter=encounter;this.onPick=onPick;this.onHover=onHover;this.quality=quality;this.reducedMotion=reducedMotion;this.actors=new Map();this.labels=new Map();this.selected='hero';this.targets=[];this.lastPaint=0;this.elapsed=0;this.disposed=false;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.sound=createBattleSound();this.cuesPlayed=0;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=this.profile.exposure??1.05;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.shadowMap.autoUpdate=false;this.shadowDirty=true;this.shadowUpdates=0;this.lastShadow=-Infinity;this.renderCounts=[];
    this.labelRefs=new Map();this.labelStats={visible:0,occluded:0,offscreen:0,overlaps:0};this.poseReset=new Set();this.visibleUnits=[];this.labelSizeDirty=true;this.screenPoint=new T.Vector3();this.matrix=new T.Matrix4();
    this.scene=new T.Scene();this.scene.background=new T.Color(this.profile.sky);this.scene.fog=new T.FogExp2(this.profile.fog,this.profile.fogDensity);
    this.camera=new T.PerspectiveCamera(40,1,.1,800);this.orbit={yaw:-.55,pitch:.64,distance:27,target:new T.Vector3(0,0,0)};this.lookTarget=new T.Vector3(0,.25,0);this.baseTarget=new T.Vector3(0,.25,0);this.cameraKick=0;this.cameraView='overview';
    this.sky=createSky(this.scene,this.profile,{quality,reducedMotion});
    this.lighting=createSceneLighting(this.renderer,this.scene,this.profile,{quality});
    this.contactShadows=createContactShadows(this.scene);
    const sky=new T.HemisphereLight(this.profile.ambient,this.profile.ambientGround??'#61533b',this.profile.ambientIntensity);this.scene.add(sky);
    this.sun=new T.DirectionalLight(this.profile.sun,this.profile.sunIntensity);this.sun.position.fromArray(this.profile.sunPosition??[-16,24,-12]);this.sun.castShadow=true;Object.assign(this.sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:80});this.sun.shadow.normalBias=.012;this.sun.shadow.bias=-.00008;this.sun.shadow.radius=3;this.scene.add(this.sun);
    const rim=new T.DirectionalLight('#b9d8e9',.65);rim.position.set(15,6,9);this.scene.add(rim);
    this.environment=createEnvironment(this.scene,encounter,{tileSize:2.5,quality,chapter:this.chapter});
    this.overlay=new T.Group();this.scene.add(this.overlay);this.effectGroup=new T.Group();this.scene.add(this.effectGroup);
    this.ringGeometry=new T.RingGeometry(.78,.83,48);this.targetGeometry=new T.RingGeometry(.63,.7,40);
    this.targetMaterial=new T.MeshBasicMaterial({color:'#89cfcb',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide});
    this.legalTargets=new T.InstancedMesh(this.targetGeometry,this.targetMaterial,Math.max(64,encounter.width*encounter.height));this.legalTargets.count=0;this.legalTargets.frustumCulled=false;this.overlay.add(this.legalTargets);
    this.selectionMaterial=new T.MeshBasicMaterial({color:'#edcf7c',transparent:true,opacity:.95,depthWrite:false,side:T.DoubleSide});
    this.hoverMaterial=new T.MeshBasicMaterial({color:'#fff2c1',transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide});
    this.selectedRing=new T.Mesh(this.ringGeometry,this.selectionMaterial);this.selectedRing.rotation.x=-Math.PI/2;this.overlay.add(this.selectedRing);
    this.hoverRing=new T.Mesh(this.targetGeometry,this.hoverMaterial);this.hoverRing.rotation.x=-Math.PI/2;this.hoverRing.visible=false;this.overlay.add(this.hoverRing);
    this.goalMarker=new T.Mesh(new T.RingGeometry(.96,1.02,48),new T.MeshBasicMaterial({color:'#edcf7c',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}));this.goalMarker.rotation.x=-Math.PI/2;this.overlay.add(this.goalMarker);
    this.effectRings=[];this.missionMarkers=new Map();this.hovered=null;this.canvas.dataset.scene=this.profile.key;this.canvas.dataset.chapter=String(this.chapter);this.canvas.dataset.kind=encounter.kind;
    this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.hit=new T.Vector3();
    this.labelLayer=document.createElement('div');this.labelLayer.className='world-labels';this.labelLayer.setAttribute('aria-hidden','true');canvas.parentElement.append(this.labelLayer);
    this.projectile=new T.Group();const shaft=new T.Mesh(new T.CylinderGeometry(.025,.025,1.45,8),new T.MeshStandardMaterial({color:'#7d4e24',roughness:.85}));shaft.rotation.x=Math.PI/2;const tip=new T.Mesh(new T.ConeGeometry(.075,.32,6),new T.MeshStandardMaterial({color:'#afb3b1',metalness:.8,roughness:.35}));tip.rotation.x=Math.PI/2;tip.position.z=.85;this.projectile.add(shaft,tip);this.effectGroup.add(this.projectile);this.projectile.visible=false;
    this.particleMask=createParticleMask();const count=24,positions=new Float32Array(count*3);this.sparkGeometry=new T.BufferGeometry();this.sparkGeometry.setAttribute('position',new T.BufferAttribute(positions,3));this.sparkMaterial=new T.PointsMaterial({map:this.particleMask,alphaTest:.015,color:'#ffe4a1',size:.065,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});this.sparks=new T.Points(this.sparkGeometry,this.sparkMaterial);this.sparks.frustumCulled=false;this.effectGroup.add(this.sparks);this.projectiles=[this.projectile];this.sparkClouds=[this.sparks];
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.applyQuality(quality);this.sync(encounter);this.bind();this.resize();this.frame=requestAnimationFrame(t=>this.tick(t));
  }
  world(tile){const p=gridToWorld(tile,this.encounter,2.5);return new T.Vector3(p.x,this.environment.groundHeight(p.x,p.z),p.z);}
  unitAt(tile){
    if(!tile)return undefined;
    const matches=u=>u.x===tile.x&&u.y===tile.y,prior=this.animation?.timeline.units;
    // Defeated tokens stay in the encounter. A reinforcement can reuse their
    // cell; only the current occupant or this animation's dying victim owns it.
    return this.visibleUnits.find(u=>matches(u)&&isAlive(u))??this.visibleUnits.find(u=>matches(u)&&prior?.[u.id]?.before&&isAlive(prior[u.id].before));
  }
  bodyPoint(tile){const unit=this.unitAt(tile);return this.world(tile).add(new T.Vector3(0,['cavalry','heavy'].includes(unit?.role)?2.05:1.2,0));}
  sync(encounter){
    this.encounter=encounter;this.visibleUnits=encounter.units.filter(u=>!u.hidden);const visible=new Set(this.visibleUnits.map(u=>u.id));this.shadowDirty=true;this.labelSizeDirty=true;
    for(const [id,a] of this.actors)if(!visible.has(id)){this.scene.remove(a.group);a.dispose();this.actors.delete(id);this.labels.get(id)?.remove();this.labels.delete(id);this.labelRefs.delete(id);this.poseReset.delete(id);}
    this.labelLayer.dataset.dense=String(visible.size>9);
    for(const u of this.visibleUnits){
      const styleKey=`${u.side}:${u.role}:${u.name}:${this.quality}`;let actor=this.actors.get(u.id);
      // A committed defection changes the uniform and allegiance together.
      if(actor&&actor.group.userData.styleKey!==styleKey){this.scene.remove(actor.group);actor.dispose();this.actors.delete(u.id);actor=null;}
      if(!actor){actor=createActor(u,{quality:this.quality,chapter:this.chapter,rank:this.rank});actor.group.userData.unitId=u.id;actor.group.userData.styleKey=styleKey;this.scene.add(actor.group);this.actors.set(u.id,actor);this.poseReset.add(u.id);}
      if(!this.labels.has(u.id)){const label=document.createElement('div');label.dataset.unitId=u.id;label.innerHTML='<span class="world-name"></span><span class="world-signal"></span><span class="world-short"></span><span class="world-health"><i></i></span><span class="world-detail"></span><strong></strong><span class="world-leader"></span>';this.labelLayer.append(label);this.labels.set(u.id,label);this.labelRefs.set(u.id,{name:label.querySelector('.world-name'),signal:label.querySelector('.world-signal'),short:label.querySelector('.world-short'),health:label.querySelector('i'),detail:label.querySelector('.world-detail'),effect:label.querySelector('strong'),leader:label.querySelector('.world-leader')});}
      const label=this.labels.get(u.id),readout=actorReadout(u,encounter);
      label.className=`world-unit ${u.side==='enemy'?'enemy':u.side==='neutral'?'neutral':'friendly'} ${readout.tone}${civicActor(u)&&!isAlive(u)?' withdrawn':''}`;label.dataset.type=readout.type;
      const refs=this.labelRefs.get(u.id);refs.name.textContent=u.name||u.id;refs.signal.textContent=readout.signal;refs.detail.textContent=readout.detail;refs.short.textContent=readout.type==='vote'?`${readout.value>0?'+':''}${readout.value}`:readout.type==='resolve'?`${readout.value} R`:'';refs.short.title=readout.signal;
      refs.health.style.width=`${readout.ratio*100}%`;label.hidden=!actorVisible(u);refs.stateKey=null;
      const point=this.world(u);if(actor.group.position.distanceTo(point)>.25)this.poseReset.add(u.id);actor.group.position.copy(point);actor.group.visible=actorVisible(u);
    }
    this.goalMarker.visible=false;
    const marks=missionReadouts(encounter),wanted=new Set(marks.map(mark=>mark.id));
    for(const [id,marker] of this.missionMarkers)if(!wanted.has(id)){this.overlay.remove(marker.mesh);marker.mesh.material.dispose();marker.label.remove();this.missionMarkers.delete(id);}
    for(const mark of marks){
      if(!this.missionMarkers.has(mark.id)){const mesh=new T.Mesh(this.goalMarker.geometry,this.goalMarker.material.clone());mesh.rotation.x=-Math.PI/2;this.overlay.add(mesh);const label=document.createElement('span');label.className='world-objective';this.labelLayer.append(label);this.missionMarkers.set(mark.id,{mesh,label});}
      const marker=this.missionMarkers.get(mark.id);marker.mesh.position.copy(this.world(mark));marker.mesh.position.y+=.07;marker.mesh.material.color.set(mark.tone==='warning'?'#df9d85':mark.tone==='secured'?'#b0d0a1':'#edcf7c');marker.label.textContent=mark.label;marker.label.dataset.tone=mark.tone;
    }
  }
  setSelection(selected,targets=[],target=null){this.selected=selected;this.targets=targets;this.labelSizeDirty=true;
    const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2),scale=new T.Vector3(1,1,1);this.legalTargets.count=Math.min(targets.length,this.legalTargets.instanceMatrix.count);
    for(let i=0;i<this.legalTargets.count;i++){const point=this.world(targets[i]);point.y+=.055;this.matrix.compose(point,rotation,scale);this.legalTargets.setMatrixAt(i,this.matrix);}this.legalTargets.instanceMatrix.needsUpdate=true;
    this.inspected=target&&(target.unitId??this.unitAt(target)?.id);
    this.hoverRing.visible=!!target;if(target){this.hoverRing.position.copy(this.world(target));this.hoverRing.position.y+=.08;}
  }
  setAudio(enabled,volume){this.sound.setEnabled(enabled,volume);}
  setPaused(value){this.paused=!!value;if(value){this.finishMotion();this.sound.stop();}}
  setGrid(show){
    if(!this.grid){const lines=[];for(let x=0;x<this.encounter.width;x++)for(let y=0;y<this.encounter.height;y++){const p=this.world({x,y});for(const [a,b,c,d]of [[-1.25,-1.25,1.25,-1.25],[-1.25,-1.25,-1.25,1.25]])lines.push(p.x+a,p.y+.04,p.z+b,p.x+c,p.y+.04,p.z+d);}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(lines,3));this.grid=new T.LineSegments(geometry,new T.LineBasicMaterial({color:'#dfd6b3',transparent:true,opacity:.32,depthWrite:false}));this.scene.add(this.grid);}
    this.grid.visible=!!show;
  }
  applyQuality(quality){const previous=this.quality;this.quality=quality in QUALITY?quality:'balanced';const q=QUALITY[this.quality];this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.ratio));if(this.sun.shadow.mapSize.x!==q.shadow){this.sun.shadow.mapSize.set(q.shadow,q.shadow);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}if(previous!==this.quality&&this.environment){this.environment.dispose();this.environment=createEnvironment(this.scene,this.encounter,{tileSize:2.5,quality:this.quality,chapter:this.chapter});this.sky.dispose();this.sky=createSky(this.scene,this.profile,{quality:this.quality,reducedMotion:this.reducedMotion});this.lighting.dispose();this.lighting=createSceneLighting(this.renderer,this.scene,this.profile,{quality:this.quality});this.sync(this.encounter);}this.resize();}
  setReducedMotion(value){if(this.reducedMotion!==value){this.shadowDirty=true;this.poseReset=new Set(this.actors.keys());}this.reducedMotion=value;if(value)this.finishMotion();}
  overviewDistance(){
    const drill=this.encounter.id==='ch1-training',yaw=this.orbit.yaw??-.55,pitch=this.orbit.pitch??.64;
    const right=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),up=new T.Vector3(-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)),out=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    const tangent=Math.tan(this.camera.fov*Math.PI/360)*.86,points=this.encounter.units.filter(actorVisible).flatMap(unit=>[this.world(unit),this.world(unit).add(new T.Vector3(0,['cavalry','heavy'].includes(unit.role)?3.1:2.55,0))]);
    if(!drill)for(const x of [-.18,this.encounter.width-.82])for(const y of [-.18,this.encounter.height-.82])points.push(this.world({x,y}));
    return Math.max(drill?13:20,...points.map(point=>{const p=point.clone().sub(this.baseTarget);return p.dot(out)+Math.max(Math.abs(p.dot(right))/(tangent*this.camera.aspect),Math.abs(p.dot(up))/tangent);}));
  }
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.viewportWidth=r.width;this.viewportHeight=r.height;this.labelSizeDirty=true;const previous=this.camera.aspect;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();if(Math.abs(previous-this.camera.aspect)>.01&&!this.focusMode)this.orbit.distance=Math.max(this.cameraView==='horizon'?28:0,this.overviewDistance());}
  home(){this.focusMode=false;this.cameraView='overview';this.orbit.yaw=this.encounter.kind==='contest'?-.28:-.55;this.orbit.pitch=this.encounter.kind==='contest'?.76:.67;this.baseTarget.set(0,.7,0);if(this.encounter.id==='ch1-training'){const alive=this.encounter.units.filter(isAlive);if(alive.length){const center=alive.reduce((v,u)=>v.add(this.world(u)),new T.Vector3()).divideScalar(alive.length);this.baseTarget.copy(center);this.baseTarget.y+=.5;this.orbit.pitch=.58;}}this.orbit.distance=this.overviewDistance();}
  horizon(){
    // Lift the point of interest, rather than merely flattening an orbit aimed
    // at the ground. The sky occupies the upper third while units remain framed.
    this.focusMode=false;this.cameraView='horizon';this.orbit.yaw=-.55;this.orbit.pitch=.105;
    this.baseTarget.set(0,2.7,0);this.orbit.distance=Math.max(28,this.overviewDistance());
  }
  focusSelected(){const u=this.encounter.units.find(u=>u.id===this.selected);if(u){const position=this.world(u),mounted=['cavalry','heavy'].includes(u.role),view=findFocusCamera(this.environment,{position,mounted});if(!view){this.home();return;}this.focusMode=true;this.cameraView='follow';this.baseTarget.copy(position);this.baseTarget.y+=mounted?1.2:.85;Object.assign(this.orbit,view);}}
  zoom(delta){this.orbit.distance=clamp(this.orbit.distance+delta,5.5,Math.max(85,this.orbit.distance,this.overviewDistance()));}
  pick(event){const r=this.canvas.getBoundingClientRect();this.ndc.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.ndc,this.camera);
    const pickable=new Set(this.encounter.units.filter(isAlive).map(u=>u.id));
    // Raycaster does not skip invisible objects. Collect only rendered bodies
    // before intersection so the hidden LOD never CPU-skins every triangle.
    const surfaces=[];for(const [id,a]of this.actors)if(a.group.visible&&pickable.has(id))a.group.traverseVisible(o=>{if(o.isMesh)surfaces.push(o);});
    const hits=this.ray.intersectObjects(surfaces,false);
    const hit=hits.find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});if(hit){let obj=hit.object;while(obj&&!obj.userData.unitId)obj=obj.parent;const u=this.encounter.units.find(u=>u.id===obj?.userData.unitId);if(u&&isAlive(u))return {x:u.x,y:u.y,unitId:u.id};}
    if(!intersectGround(this.ray.ray,this.environment.groundHeight,this.hit))return null;const x=Math.round(this.hit.x/2.5+(this.encounter.width-1)/2),y=Math.round(this.hit.z/2.5+(this.encounter.height-1)/2);return x>=0&&y>=0&&x<this.encounter.width&&y<this.encounter.height?{x,y}:null;
  }
  bind(){this.events=[];const on=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);this.events.push(()=>target.removeEventListener(type,fn,opts));};
    on(this.canvas,'pointerdown',e=>{this.sound.unlock();this.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};this.canvas.setPointerCapture(e.pointerId);});
    on(this.canvas,'pointermove',e=>{if(this.drag){const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>7)this.drag.moved=true;if(this.drag.moved){this.orbit.yaw-=dx*.006;this.orbit.pitch=clamp(this.orbit.pitch+dy*.004,.04,1.15);}this.drag.lastX=e.clientX;this.drag.lastY=e.clientY;}else{const point=this.pick(e);this.hovered=point?.unitId??null;this.onHover(point);}});
    on(this.canvas,'pointerleave',()=>{this.hovered=null;this.onHover(null);});
    on(this.canvas,'pointerup',e=>{if(this.drag&&!this.drag.moved&&!this.animation)this.onPick(this.pick(e));this.drag=null;});on(this.canvas,'pointercancel',()=>this.drag=null);
    on(this.canvas,'wheel',e=>{e.preventDefault();this.zoom(e.deltaY*.022);},{passive:false});
    on(this.canvas,'keydown',e=>{this.sound.unlock();if(this.keyboardMode==='grid'&&e.key.startsWith('Arrow'))return;let handled=true;switch(e.key){case'ArrowLeft':this.orbit.yaw-=.12;break;case'ArrowRight':this.orbit.yaw+=.12;break;case'ArrowUp':this.orbit.pitch=clamp(this.orbit.pitch+.08,.04,1.15);break;case'ArrowDown':this.orbit.pitch=clamp(this.orbit.pitch-.08,.04,1.15);break;case'+':case'=':this.zoom(-2);break;case'-':this.zoom(2);break;case'Home':this.home();break;case'h':case'H':this.horizon();break;case'f':case'F':this.focusSelected();break;default:handled=false;}if(handled)e.preventDefault();});
    on(document,'visibilitychange',()=>{if(document.hidden)this.finishMotion();});
    on(this.canvas,'webglcontextlost',e=>{e.preventDefault();this.finishMotion();this.contextLost=true;this.onError?.('The 3D graphics context was interrupted.');});
  }
  play(before,after,command){this.finishMotion();this.sync(after);if(this.reducedMotion||this.paused)return Promise.resolve();this.sound.unlock();const timeline=retimeStageTimeline(buildEncounterTimeline(before,after,{command,quality:this.quality}));if(!timeline.duration)return Promise.resolve();
    this.poseReset=new Set(this.actors.keys());this.shadowDirty=true;this.animation={timeline,start:performance.now(),scale:1,cues:combatCues(timeline,{encounter:after}),nextCue:0,releasePoints:new Map()};return new Promise(resolve=>this.animation.resolve=resolve);
  }
  finishMotion(){if(!this.animation)return;const resolve=this.animation.resolve;this.animation=null;this.projectiles.forEach(p=>p.visible=false);this.sparkClouds.forEach(p=>p.material.opacity=0);this.effectRings.forEach(p=>p.visible=false);this.sync(this.encounter);this.poseReset=new Set(this.actors.keys());resolve?.();}
  tick(now){if(this.disposed)return;this.frame=requestAnimationFrame(t=>this.tick(t));if(document.hidden||this.contextLost||this.paused)return;const interval=1000/QUALITY[this.quality].fps;if(now-this.lastPaint<interval)return;const dt=Math.min(.08,(now-this.lastPaint)/1000||.016);this.lastPaint=now-(now-this.lastPaint)%interval;this.elapsed+=dt;const renderStart=performance.now();let frame=null;
    if(this.animation){const a=this.animation;const elapsed=(now-a.start)/a.scale;frame=sampleEncounterTimeline(a.timeline,elapsed);while(a.nextCue<a.cues.length&&a.cues[a.nextCue].time<=elapsed){const cue=a.cues[a.nextCue++];if(elapsed-cue.time<150&&this.sound.cue(cue.kind,cue))this.cuesPlayed++;}if(frame.complete){this.finishMotion();frame=null;}}
    this.environment.update(this.reducedMotion?0:this.elapsed);
    for(const unit of this.visibleUnits){
      const a=this.actors.get(unit.id),o=frame?.unitOverrides[unit.id],position=o??unit;
      a.group.position.copy(this.world(position));const contact=meleeOffset(unit,o,this.animation?.timeline);a.group.position.x+=contact.x;a.group.position.z+=contact.z;a.group.position.y=this.environment.groundHeight(a.group.position.x,a.group.position.z);a.group.visible=actorVisible(unit)||!!o&&o.alpha>0;if(!a.group.visible){this.labels.get(unit.id).hidden=true;continue;}
      const active=unit.id===this.selected||unit.id===this.inspected||unit.id===this.hovered||!!o&&o.pose!=='idle';
      const attack=this.animation?.timeline.tracks.find(t=>t.unitId===unit.id&&t.pose===o?.pose&&t.target),victim=attack&&this.unitAt(attack.target);
      const aimHeight=victim?this.world(victim).y+(['cavalry','heavy'].includes(victim.role)?2.05:1.2):undefined;
      a.update({...stageActorPose(unit,frame,this.animation?.timeline,{time:this.elapsed,dt,reducedMotion:this.reducedMotion}),groundHeight:this.environment.groundHeight,aimHeight,detailDistance:this.camera.position.distanceTo(a.group.position),active,resetPose:this.poseReset.has(unit.id)});this.poseReset.delete(unit.id);
      const label=this.labels.get(unit.id),refs=this.labelRefs.get(unit.id),key=`${unit.id===this.selected}:${unit.id===this.inspected||unit.id===this.hovered}`;label.hidden=false;
      if(refs.stateKey!==key){refs.stateKey=key;label.classList.toggle('selected',unit.id===this.selected);label.classList.toggle('inspected',unit.id===this.inspected||unit.id===this.hovered);refs.width=0;this.labelSizeDirty=true;}
      if(refs.effect.textContent)refs.effect.textContent='';
    }
    this.contactShadows.update(this.actors,this.environment.groundHeight);
    const selected=this.actors.get(this.selected);this.selectedRing.visible=!!selected?.group.visible;if(selected){this.selectedRing.position.copy(selected.group.position);this.selectedRing.position.y+=.065;this.selectedRing.scale.setScalar(selected.group.userData.actor?.mounted?1.45:1);}
    this.projectiles.forEach(p=>p.visible=false);this.sparkClouds.forEach(p=>p.material.opacity=0);this.effectRings.forEach(p=>p.visible=false);let projectileCount=0,sparkCount=0,ringCount=0;
    for(const fx of frame?.effects??[]){const readout=effectReadout(fx);
      if(fx.at&&readout.text){const unit=this.unitAt(fx.at),label=this.labelRefs.get(unit?.id)?.effect;if(label){label.textContent=readout.text;label.style.color=readout.color;}}
      if(readout.ring&&fx.at&&ringCount<6){
        if(!this.effectRings[ringCount]){const ring=new T.Mesh(this.targetGeometry,new T.MeshBasicMaterial({color:readout.color,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;this.effectGroup.add(ring);this.effectRings.push(ring);}
        const ring=this.effectRings[ringCount++];ring.position.copy(this.world(fx.at));ring.position.y+=.09;ring.scale.setScalar(.65+fx.progress*1.2);ring.material.color.set(readout.color);ring.material.opacity=(1-fx.progress)*.75;ring.visible=true;
      }
      if(fx.type==='projectile'&&projectileCount<4){
      if(!this.projectiles[projectileCount]){const p=this.projectile.clone();this.effectGroup.add(p);this.projectiles.push(p);}const projectile=this.projectiles[projectileCount++];projectile.scale.setScalar(fx.projectile==='arrow'?.52:1);
      const key=`${fx.start}:${fx.from.x}:${fx.from.y}`,origins=this.animation.releasePoints;
      if(!origins.has(key)){const source=this.unitAt(fx.from),actor=this.actors.get(source?.id);origins.set(key,actor?.getReleasePoint(new T.Vector3())??this.world(fx.from).add(new T.Vector3(0,1.4,0)));}
      positionProjectileTip(projectile,origins.get(key),this.bodyPoint(fx.to),fx.progress);projectile.visible=true;
    }else if(['impact','shield'].includes(fx.type)&&!fx.political){
      if(sparkCount>=8)continue;if(!this.sparkClouds[sparkCount]){const cloud=new T.Points(this.sparkGeometry.clone(),this.sparkMaterial.clone());cloud.frustumCulled=false;this.effectGroup.add(cloud);this.sparkClouds.push(cloud);}const cloud=this.sparkClouds[sparkCount++];
      const defender=this.unitAt(fx.at),actor=this.actors.get(defender?.id),anchor=fx.type==='shield'?actor?.contacts.shield:null;
      const p=anchor?.getWorldPosition(new T.Vector3())??actor?.contacts.body?.localToWorld(new T.Vector3(0,.27,.10))??this.bodyPoint(fx.at);sampleImpactParticles(cloud,p,fx.progress,{shield:fx.type==='shield',source:fx.source?this.world(fx.source):undefined});
      if(defender&&fx.delta)this.labelRefs.get(defender.id).effect.textContent=String(fx.delta);
    }}
    const target=this.focusMode&&selected?selected.group.position.clone().add(new T.Vector3(0,selected.group.userData.actor?.mounted?1.2:.85,0)):this.baseTarget.clone();
    this.lookTarget.lerp(target,this.reducedMotion?1:Math.min(1,dt*3));const {yaw,pitch,distance}=this.orbit;this.scene.fog.density=(this.profile?.fogDensity??.017)*Math.min(1,27/distance);this.camera.position.set(this.lookTarget.x+Math.sin(yaw)*Math.cos(pitch)*distance,this.lookTarget.y+Math.sin(pitch)*distance,this.lookTarget.z+Math.cos(yaw)*Math.cos(pitch)*distance);this.camera.position.y=Math.max(this.camera.position.y,this.environment.cameraGroundHeight(this.camera.position.x,this.camera.position.z)+.9);this.camera.lookAt(this.lookTarget);this.camera.updateMatrixWorld();this.sky.update(this.elapsed,this.camera,this.reducedMotion);
    this.positionLabels();
    const shadowInterval=this.quality==='high'?70:100;
    if(this.shadowDirty||this.animation||!this.reducedMotion&&now-this.lastShadow>=shadowInterval){this.renderer.shadowMap.needsUpdate=true;this.shadowDirty=false;this.lastShadow=now;this.shadowUpdates++;}
    this.renderer.render(this.scene,this.camera);const cost=performance.now()-renderStart;this.samples.push(cost);this.renderCounts.push(this.renderer.info.render.calls);if(this.samples.length>120)this.samples.shift();if(this.renderCounts.length>120)this.renderCounts.shift();this.onFrame(cost);if(now-(this.lastStats||0)>1000){this.lastStats=now;this.canvas.dataset.renderStats=JSON.stringify(this.stats());}
  }
  positionLabels(){
    const width=this.viewportWidth,height=this.viewportHeight,items=[],elements=new Map();if(!width||!height)return;
    for(const [id,actor]of this.actors){
      const label=this.labels.get(id),refs=this.labelRefs.get(id);if(!actor.group.visible){label.dataset.layout='offscreen';continue;}
      const screen=this.screenPoint.copy(actor.group.position);screen.y+=(actor.group.userData.actor?.height??2.03)+.12;screen.project(this.camera);
      if(this.labelSizeDirty||!refs.width||refs.effectText!==refs.effect.textContent){refs.width=label.offsetWidth;refs.height=label.offsetHeight;refs.effectText=refs.effect.textContent;}
      const effect=!!refs.effect.textContent,priority=id===this.inspected||id===this.hovered?110:id===this.selected?100:effect?80:label.dataset.type==='vote'?40:30;
      items.push({id,x:(screen.x*.5+.5)*width,y:(-screen.y*.5+.5)*height,width:refs.width,height:refs.height,priority,visible:Math.abs(screen.z)<=1});elements.set(id,{label,leader:refs.leader});
    }
    for(const [id,marker]of this.missionMarkers){const key=`objective:${id}`,point=this.screenPoint.copy(marker.mesh.position);point.y+=.2;point.project(this.camera);if(this.labelSizeDirty||!marker.width){marker.width=marker.label.offsetWidth;marker.height=marker.label.offsetHeight;}
      items.push({id:key,x:(point.x*.5+.5)*width,y:(-point.y*.5+.5)*height,width:marker.width,height:marker.height,priority:60,visible:Math.abs(point.z)<=1});elements.set(key,{label:marker.label});
    }
    const layout=layoutStageLabels(items,{width,height,top:this.canvas.parentElement.classList.contains('world-stage')?92:8}),counts={visible:0,occluded:0,offscreen:0,overlaps:0};
    for(const [id,r]of layout){const {label,leader}=elements.get(id);label.dataset.layout=r.reason;counts[r.reason]++;label.style.visibility=r.visible?'visible':'hidden';
      if(!r.visible)continue;label.style.transform=`translate(${r.x}px,${r.y}px)`;
      if(leader){const dx=r.anchorX-(r.x+r.width/2),dy=r.anchorY-(r.y+r.height),length=Math.hypot(dx,dy);leader.style.width=`${length}px`;leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;leader.style.display=length>15?'block':'none';}
    }
    this.labelStats=counts;this.labelSizeDirty=false;
  }
  stats(){return {cuesPlayed:this.cuesPlayed,renderMs:this.samples.reduce((a,b)=>a+b,0)/Math.max(1,this.samples.length),samples:this.samples.length,calls:this.renderer.info.render.calls,callsMean:this.renderCounts.reduce((a,b)=>a+b,0)/Math.max(1,this.renderCounts.length),callsMax:Math.max(0,...this.renderCounts),shadowUpdates:this.shadowUpdates,labels:{...this.labelStats},triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,geometries:this.renderer.info.memory.geometries,quality:this.quality,cameraView:this.cameraView,lighting:this.lighting.stats(),contactShadows:this.contactShadows.stats(),sky:this.sky.stats(),horizon:this.environment.horizon.stats};}
  dispose(){if(this.disposed)return;this.disposed=true;this.sound.dispose();this.finishMotion();cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.events.forEach(fn=>fn());this.actors.forEach(a=>a.dispose());this.environment.dispose();this.sky.dispose();this.lighting.dispose();this.contactShadows.dispose();this.particleMask.dispose();this.labelLayer.remove();const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();}
}
