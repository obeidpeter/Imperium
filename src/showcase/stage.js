import * as T from '../../vendor/three/three.module.js';
import {createActor} from './actors.js';
import {createEnvironment,gridToWorld} from './environment.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../ui/animation-timeline.js';
import {facingYaw,isAlive} from './session.js';
import {createBattleSound} from './battle-sound.js';
import {meleeOffset,combatCues} from './combat-presentation.js';
import {getSceneProfile} from './campaign-scene-profile.js';
import {actorVisible,civicActor,actorReadout,effectReadout,missionReadouts} from './stage-readout.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>t*t*(3-2*t);
const QUALITY={performance:{ratio:1,shadow:1024,fps:30},balanced:{ratio:1.5,shadow:2048,fps:45},high:{ratio:2,shadow:4096,fps:60}};
const blendYaw=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*ease(clamp(t,0,1));
const pathYaw=(a,b)=>Math.atan2(b.x-a.x,b.y-a.y);

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
  let motion=o?.pose??'idle',phase=o?.progress;if(motion==='idle'&&unit.braced)motion='brace';
  let direction=blendYaw(facingYaw(o?.previousFacing??unit.facing),facingYaw(o?.facing??unit.facing),o?.turnProgress??1);
  if(['walk','run','cavalry-move'].includes(motion)){
    const track=timeline?.tracks.find(t=>t.unitId===unit.id&&t.path);
    if(track?.path.length>1){
      const distance=ease(clamp(o.progress,0,1))*(track.path.length-1),segment=Math.min(track.path.length-2,Math.floor(distance));
      phase=distance*2.5/.72;
      const previous=segment?pathYaw(track.path[segment-1],track.path[segment]):facingYaw(pair?.before.facing??unit.facing);
      direction=blendYaw(previous,pathYaw(track.path[segment],track.path[segment+1]),(distance-segment)/.18);
    }else{motion='idle';phase=0;}
    if(motion==='cavalry-move')motion='run';
  }
  if(motion==='turn')motion=unit.braced?'brace':'idle';
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
  return {time:reducedMotion?0:time,dt,motion,braced:unit.braced||pair?.before.braced,locomotionWeight:['walk','run'].includes(motion)?Math.min(1,(o?.progress??1)/.12,(1-(o?.progress??0))/.12):1,phase:motion==='brace'&&o?.pose!=='brace'?.45:phase,direction,health,selected:false};
}
export class BattleStage{
  constructor(canvas,encounter,{onPick=()=>{},onHover=()=>{},quality='balanced',reducedMotion=false,keyboardMode='orbit',onFrame=()=>{},chapter,rank}={}){
    this.chapter=chapter??Number(/^ch(\d+)/.exec(encounter.id)?.[1]??1);this.rank=rank;this.profile=getSceneProfile(encounter,{chapter:this.chapter});this.keyboardMode=keyboardMode;this.onFrame=onFrame;this.samples=[];this.paused=false;this.canvas=canvas;this.encounter=encounter;this.onPick=onPick;this.onHover=onHover;this.quality=quality;this.reducedMotion=reducedMotion;this.actors=new Map();this.labels=new Map();this.selected='hero';this.targets=[];this.lastPaint=0;this.elapsed=0;this.disposed=false;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.sound=createBattleSound();this.cuesPlayed=0;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=this.profile.exposure??1.05;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
    this.scene=new T.Scene();this.scene.background=new T.Color(this.profile.sky);this.scene.fog=new T.FogExp2(this.profile.fog,this.profile.fogDensity);
    this.camera=new T.PerspectiveCamera(40,1,.1,220);this.orbit={yaw:-.55,pitch:.64,distance:27,target:new T.Vector3(0,0,0)};this.lookTarget=new T.Vector3(0,.25,0);this.baseTarget=new T.Vector3(0,.25,0);this.cameraKick=0;
    const sky=new T.HemisphereLight(this.profile.ambient,this.profile.ambientGround??'#61533b',this.profile.ambientIntensity);this.scene.add(sky);
    this.sun=new T.DirectionalLight(this.profile.sun,this.profile.sunIntensity);this.sun.position.fromArray(this.profile.sunPosition??[-16,24,-12]);this.sun.castShadow=true;Object.assign(this.sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:80});this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00008;this.sun.shadow.radius=3;this.scene.add(this.sun);
    const rim=new T.DirectionalLight('#b9d8e9',.65);rim.position.set(15,6,9);this.scene.add(rim);
    this.environment=createEnvironment(this.scene,encounter,{tileSize:2.5,quality,chapter:this.chapter});
    this.overlay=new T.Group();this.scene.add(this.overlay);this.effectGroup=new T.Group();this.scene.add(this.effectGroup);
    this.ringGeometry=new T.RingGeometry(.78,.83,48);this.targetGeometry=new T.RingGeometry(.63,.7,40);
    this.targetMaterial=new T.MeshBasicMaterial({color:'#89cfcb',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide});
    this.selectionMaterial=new T.MeshBasicMaterial({color:'#edcf7c',transparent:true,opacity:.95,depthWrite:false,side:T.DoubleSide});
    this.hoverMaterial=new T.MeshBasicMaterial({color:'#fff2c1',transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide});
    this.selectedRing=new T.Mesh(this.ringGeometry,this.selectionMaterial);this.selectedRing.rotation.x=-Math.PI/2;this.overlay.add(this.selectedRing);
    this.hoverRing=new T.Mesh(this.targetGeometry,this.hoverMaterial);this.hoverRing.rotation.x=-Math.PI/2;this.hoverRing.visible=false;this.overlay.add(this.hoverRing);
    this.goalMarker=new T.Mesh(new T.RingGeometry(.96,1.02,48),new T.MeshBasicMaterial({color:'#edcf7c',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}));this.goalMarker.rotation.x=-Math.PI/2;this.overlay.add(this.goalMarker);
    this.effectRings=[];this.missionMarkers=new Map();this.hovered=null;this.canvas.dataset.scene=this.profile.key;this.canvas.dataset.chapter=String(this.chapter);this.canvas.dataset.kind=encounter.kind;
    this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.hit=new T.Vector3();
    this.labelLayer=document.createElement('div');this.labelLayer.className='world-labels';this.labelLayer.setAttribute('aria-hidden','true');canvas.parentElement.append(this.labelLayer);
    this.projectile=new T.Group();const shaft=new T.Mesh(new T.CylinderGeometry(.025,.025,1.45,8),new T.MeshStandardMaterial({color:'#7d4e24',roughness:.85}));shaft.rotation.x=Math.PI/2;const tip=new T.Mesh(new T.ConeGeometry(.075,.32,6),new T.MeshStandardMaterial({color:'#afb3b1',metalness:.8,roughness:.35}));tip.rotation.x=Math.PI/2;tip.position.z=.85;this.projectile.add(shaft,tip);this.effectGroup.add(this.projectile);this.projectile.visible=false;
    const count=32,positions=new Float32Array(count*3);this.sparkGeometry=new T.BufferGeometry();this.sparkGeometry.setAttribute('position',new T.BufferAttribute(positions,3));this.sparkMaterial=new T.PointsMaterial({color:'#ffe4a1',size:.065,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});this.sparks=new T.Points(this.sparkGeometry,this.sparkMaterial);this.sparks.frustumCulled=false;this.effectGroup.add(this.sparks);this.projectiles=[this.projectile];this.sparkClouds=[this.sparks];
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.applyQuality(quality);this.sync(encounter);this.bind();this.resize();this.frame=requestAnimationFrame(t=>this.tick(t));
  }
  world(tile){const p=gridToWorld(tile,this.encounter,2.5);return new T.Vector3(p.x,this.environment.groundHeight(p.x,p.z),p.z);}
  sync(encounter){
    this.encounter=encounter;const visible=new Set(encounter.units.filter(u=>!u.hidden).map(u=>u.id));
    for(const [id,a] of this.actors)if(!visible.has(id)){this.scene.remove(a.group);a.dispose();this.actors.delete(id);this.labels.get(id)?.remove();this.labels.delete(id);}
    this.labelLayer.dataset.dense=String(visible.size>9);
    for(const u of encounter.units.filter(u=>!u.hidden)){
      const styleKey=`${u.side}:${u.role}:${u.name}:${this.quality}`;let actor=this.actors.get(u.id);
      // A committed defection changes the uniform and allegiance together.
      if(actor&&actor.group.userData.styleKey!==styleKey){this.scene.remove(actor.group);actor.dispose();this.actors.delete(u.id);actor=null;}
      if(!actor){actor=createActor(u,{quality:this.quality,chapter:this.chapter,rank:this.rank});actor.group.userData.unitId=u.id;actor.group.userData.styleKey=styleKey;this.scene.add(actor.group);this.actors.set(u.id,actor);}
      if(!this.labels.has(u.id)){const label=document.createElement('div');label.innerHTML='<span class="world-name"></span><span class="world-signal"></span><span class="world-health"><i></i></span><span class="world-detail"></span><strong></strong>';this.labelLayer.append(label);this.labels.set(u.id,label);}
      const label=this.labels.get(u.id),readout=actorReadout(u,encounter);
      label.className=`world-unit ${u.side==='enemy'?'enemy':u.side==='neutral'?'neutral':'friendly'} ${readout.tone}${civicActor(u)&&!isAlive(u)?' withdrawn':''}`;label.dataset.type=readout.type;
      label.querySelector('.world-name').textContent=u.name||u.id;label.querySelector('.world-signal').textContent=readout.signal;label.querySelector('.world-detail').textContent=readout.detail;
      label.querySelector('i').style.width=`${readout.ratio*100}%`;label.hidden=!actorVisible(u);
      actor.group.position.copy(this.world(u));actor.group.visible=actorVisible(u);
    }
    this.goalMarker.visible=false;
    const marks=missionReadouts(encounter),wanted=new Set(marks.map(mark=>mark.id));
    for(const [id,marker] of this.missionMarkers)if(!wanted.has(id)){this.overlay.remove(marker.mesh);marker.mesh.material.dispose();marker.label.remove();this.missionMarkers.delete(id);}
    for(const mark of marks){
      if(!this.missionMarkers.has(mark.id)){const mesh=new T.Mesh(this.goalMarker.geometry,this.goalMarker.material.clone());mesh.rotation.x=-Math.PI/2;this.overlay.add(mesh);const label=document.createElement('span');label.className='world-objective';this.labelLayer.append(label);this.missionMarkers.set(mark.id,{mesh,label});}
      const marker=this.missionMarkers.get(mark.id);marker.mesh.position.copy(this.world(mark));marker.mesh.position.y+=.07;marker.mesh.material.color.set(mark.tone==='warning'?'#df9d85':mark.tone==='secured'?'#b0d0a1':'#edcf7c');marker.label.textContent=mark.label;marker.label.dataset.tone=mark.tone;
    }
  }
  setSelection(selected,targets=[],target=null){this.selected=selected;this.targets=targets;for(const child of [...this.overlay.children])if(child.userData.legal){this.overlay.remove(child);}
    for(const t of targets){const marker=new T.Mesh(this.targetGeometry,this.targetMaterial);marker.rotation.x=-Math.PI/2;marker.position.copy(this.world(t));marker.position.y+=.055;marker.userData.legal=true;this.overlay.add(marker);}
    this.inspected=target&&(target.unitId??this.encounter.units.find(u=>u.x===target.x&&u.y===target.y)?.id);
    this.hoverRing.visible=!!target;if(target){this.hoverRing.position.copy(this.world(target));this.hoverRing.position.y+=.08;}
  }
  setAudio(enabled,volume){this.sound.setEnabled(enabled,volume);}
  setPaused(value){this.paused=!!value;if(value){this.finishMotion();this.sound.stop();}}
  setGrid(show){
    if(!this.grid){const lines=[];for(let x=0;x<this.encounter.width;x++)for(let y=0;y<this.encounter.height;y++){const p=this.world({x,y});for(const [a,b,c,d]of [[-1.25,-1.25,1.25,-1.25],[-1.25,-1.25,-1.25,1.25]])lines.push(p.x+a,p.y+.04,p.z+b,p.x+c,p.y+.04,p.z+d);}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(lines,3));this.grid=new T.LineSegments(geometry,new T.LineBasicMaterial({color:'#dfd6b3',transparent:true,opacity:.32,depthWrite:false}));this.scene.add(this.grid);}
    this.grid.visible=!!show;
  }
  applyQuality(quality){const previous=this.quality;this.quality=quality in QUALITY?quality:'balanced';const q=QUALITY[this.quality];this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.ratio));if(this.sun.shadow.mapSize.x!==q.shadow){this.sun.shadow.mapSize.set(q.shadow,q.shadow);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}if(previous!==this.quality&&this.environment){this.environment.dispose();this.environment=createEnvironment(this.scene,this.encounter,{tileSize:2.5,quality:this.quality,chapter:this.chapter});this.sync(this.encounter);}this.resize();}
  setReducedMotion(value){this.reducedMotion=value;if(value)this.finishMotion();}
  overviewDistance(){
    const drill=this.encounter.id==='ch1-training',yaw=this.orbit.yaw??-.55,pitch=this.orbit.pitch??.64;
    const right=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),up=new T.Vector3(-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)),out=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    const tangent=Math.tan(this.camera.fov*Math.PI/360)*.82,points=this.encounter.units.filter(actorVisible).flatMap(unit=>[this.world(unit),this.world(unit).add(new T.Vector3(0,['cavalry','heavy'].includes(unit.role)?3.1:2.55,0))]);
    if(!drill)for(const x of [-.35,this.encounter.width-.65])for(const y of [-.35,this.encounter.height-.65])points.push(this.world({x,y}),this.world({x,y}).add(new T.Vector3(0,2.7,0)));
    return Math.max(drill?14:24,...points.map(point=>{const p=point.clone().sub(this.baseTarget);return p.dot(out)+Math.max(Math.abs(p.dot(right))/(tangent*this.camera.aspect),Math.abs(p.dot(up))/tangent);}));
  }
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;const previous=this.camera.aspect;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();if(Math.abs(previous-this.camera.aspect)>.01&&!this.focusMode)this.orbit.distance=this.overviewDistance();}
  home(){this.focusMode=false;this.orbit.yaw=-.55;this.orbit.pitch=.64;this.baseTarget.set(0,.25,0);if(this.encounter.id==='ch1-training'){const alive=this.encounter.units.filter(isAlive);if(alive.length){const center=alive.reduce((v,u)=>v.add(this.world(u)),new T.Vector3()).divideScalar(alive.length);this.baseTarget.copy(center);this.orbit.pitch=.58;}}this.orbit.distance=this.overviewDistance();}
  focusSelected(){const u=this.encounter.units.find(u=>u.id===this.selected);if(u){this.focusMode=true;this.baseTarget.copy(this.world(u));this.baseTarget.y=.7;this.orbit.distance=['cavalry','heavy'].includes(u.role)?10:7.5;this.orbit.pitch=.36;this.orbit.yaw=1.1;}}
  zoom(delta){this.orbit.distance=clamp(this.orbit.distance+delta,5.5,Math.max(85,this.orbit.distance,this.overviewDistance()));}
  pick(event){const r=this.canvas.getBoundingClientRect();this.ndc.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.ndc,this.camera);
    const pickable=new Set(this.encounter.units.filter(isAlive).map(u=>u.id));
    const hits=this.ray.intersectObjects([...this.actors].filter(([id,a])=>a.group.visible&&pickable.has(id)).map(([,a])=>a.group),true);
    const hit=hits.find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});if(hit){let obj=hit.object;while(obj&&!obj.userData.unitId)obj=obj.parent;const u=this.encounter.units.find(u=>u.id===obj?.userData.unitId);if(u&&isAlive(u))return {x:u.x,y:u.y,unitId:u.id};}
    if(!intersectGround(this.ray.ray,this.environment.groundHeight,this.hit))return null;const x=Math.round(this.hit.x/2.5+(this.encounter.width-1)/2),y=Math.round(this.hit.z/2.5+(this.encounter.height-1)/2);return x>=0&&y>=0&&x<this.encounter.width&&y<this.encounter.height?{x,y}:null;
  }
  bind(){this.events=[];const on=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);this.events.push(()=>target.removeEventListener(type,fn,opts));};
    on(this.canvas,'pointerdown',e=>{this.sound.unlock();this.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};this.canvas.setPointerCapture(e.pointerId);});
    on(this.canvas,'pointermove',e=>{if(this.drag){const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>7)this.drag.moved=true;if(this.drag.moved){this.orbit.yaw-=dx*.006;this.orbit.pitch=clamp(this.orbit.pitch+dy*.004,.28,1.15);}this.drag.lastX=e.clientX;this.drag.lastY=e.clientY;}else{const point=this.pick(e);this.hovered=point?.unitId??null;this.onHover(point);}});
    on(this.canvas,'pointerleave',()=>{this.hovered=null;this.onHover(null);});
    on(this.canvas,'pointerup',e=>{if(this.drag&&!this.drag.moved&&!this.animation)this.onPick(this.pick(e));this.drag=null;});on(this.canvas,'pointercancel',()=>this.drag=null);
    on(this.canvas,'wheel',e=>{e.preventDefault();this.zoom(e.deltaY*.022);},{passive:false});
    on(this.canvas,'keydown',e=>{this.sound.unlock();if(this.keyboardMode==='grid'&&e.key.startsWith('Arrow'))return;let handled=true;switch(e.key){case'ArrowLeft':this.orbit.yaw-=.12;break;case'ArrowRight':this.orbit.yaw+=.12;break;case'ArrowUp':this.orbit.pitch=clamp(this.orbit.pitch+.08,.28,1.15);break;case'ArrowDown':this.orbit.pitch=clamp(this.orbit.pitch-.08,.28,1.15);break;case'+':case'=':this.zoom(-2);break;case'-':this.zoom(2);break;case'Home':this.home();break;case'f':case'F':this.focusSelected();break;default:handled=false;}if(handled)e.preventDefault();});
    on(document,'visibilitychange',()=>{if(document.hidden)this.finishMotion();});
    on(this.canvas,'webglcontextlost',e=>{e.preventDefault();this.finishMotion();this.contextLost=true;this.onError?.('The 3D graphics context was interrupted.');});
  }
  play(before,after,command){this.finishMotion();this.sync(after);if(this.reducedMotion||this.paused)return Promise.resolve();this.sound.unlock();const timeline=buildEncounterTimeline(before,after,{command,quality:this.quality});if(!timeline.duration)return Promise.resolve();
    this.animation={timeline,start:performance.now(),scale:1.65,cues:combatCues(timeline,{encounter:after}),nextCue:0};return new Promise(resolve=>this.animation.resolve=resolve);
  }
  finishMotion(){if(!this.animation)return;const resolve=this.animation.resolve;this.animation=null;this.projectiles.forEach(p=>p.visible=false);this.sparkClouds.forEach(p=>p.material.opacity=0);this.effectRings.forEach(p=>p.visible=false);this.sync(this.encounter);resolve?.();}
  tick(now){if(this.disposed)return;this.frame=requestAnimationFrame(t=>this.tick(t));if(document.hidden||this.contextLost||this.paused)return;const interval=1000/QUALITY[this.quality].fps;if(now-this.lastPaint<interval)return;const dt=Math.min(.08,(now-this.lastPaint)/1000||.016);this.lastPaint=now-(now-this.lastPaint)%interval;this.elapsed+=dt;const renderStart=performance.now();let frame=null;
    if(this.animation){const a=this.animation;const elapsed=(now-a.start)/a.scale;frame=sampleEncounterTimeline(a.timeline,elapsed);while(a.nextCue<a.cues.length&&a.cues[a.nextCue].time<=elapsed){const cue=a.cues[a.nextCue++];if(elapsed-cue.time<150&&this.sound.cue(cue.kind,cue))this.cuesPlayed++;}if(frame.complete){this.finishMotion();frame=null;}}
    this.environment.update(this.reducedMotion?0:this.elapsed);
    for(const unit of this.encounter.units.filter(u=>!u.hidden)){
      const a=this.actors.get(unit.id),o=frame?.unitOverrides[unit.id],position=o??unit;
      a.group.position.copy(this.world(position));const contact=meleeOffset(unit,o,this.animation?.timeline);a.group.position.x+=contact.x;a.group.position.z+=contact.z;a.group.position.y=this.environment.groundHeight(a.group.position.x,a.group.position.z);a.group.visible=actorVisible(unit)||!!o&&o.alpha>0;if(!a.group.visible){this.labels.get(unit.id).hidden=true;continue;}
      a.update(stageActorPose(unit,frame,this.animation?.timeline,{time:this.elapsed,dt,reducedMotion:this.reducedMotion}));
      const label=this.labels.get(unit.id);label.hidden=false;label.classList.toggle('selected',unit.id===this.selected);label.classList.toggle('inspected',unit.id===this.inspected||unit.id===this.hovered);label.querySelector('strong').textContent='';
    }
    const selected=this.actors.get(this.selected);this.selectedRing.visible=!!selected?.group.visible;if(selected){this.selectedRing.position.copy(selected.group.position);this.selectedRing.position.y+=.065;}
    this.projectiles.forEach(p=>p.visible=false);this.sparkClouds.forEach(p=>p.material.opacity=0);this.effectRings.forEach(p=>p.visible=false);let projectileCount=0,sparkCount=0,ringCount=0;
    for(const fx of frame?.effects??[]){const readout=effectReadout(fx);
      if(fx.at&&readout.text){const unit=this.encounter.units.find(u=>!u.hidden&&u.x===fx.at.x&&u.y===fx.at.y),label=this.labels.get(unit?.id)?.querySelector('strong');if(label){label.textContent=readout.text;label.style.color=readout.color;}}
      if(readout.ring&&fx.at&&ringCount<6){
        if(!this.effectRings[ringCount]){const ring=new T.Mesh(this.targetGeometry,new T.MeshBasicMaterial({color:readout.color,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;this.effectGroup.add(ring);this.effectRings.push(ring);}
        const ring=this.effectRings[ringCount++];ring.position.copy(this.world(fx.at));ring.position.y+=.09;ring.scale.setScalar(.65+fx.progress*1.2);ring.material.color.set(readout.color);ring.material.opacity=(1-fx.progress)*.75;ring.visible=true;
      }
      if(fx.type==='projectile'&&projectileCount<4){
      if(!this.projectiles[projectileCount]){const p=this.projectile.clone();this.effectGroup.add(p);this.projectiles.push(p);}const projectile=this.projectiles[projectileCount++];projectile.scale.setScalar(fx.projectile==='arrow'?.52:1);
      const from=this.world(fx.from).add(new T.Vector3(0,1.4,0)),to=this.world(fx.to).add(new T.Vector3(0,1.1,0)),t=fx.progress;projectile.position.copy(from).lerp(to,t);projectile.position.y+=Math.sin(t*Math.PI)*1.8;const next=from.clone().lerp(to,Math.min(1,t+.02));next.y+=Math.sin(Math.min(1,t+.02)*Math.PI)*1.8;projectile.lookAt(next);projectile.visible=true;
    }else if(['impact','shield'].includes(fx.type)&&!fx.political){
      if(sparkCount>=8)continue;if(!this.sparkClouds[sparkCount]){const cloud=new T.Points(this.sparkGeometry.clone(),this.sparkMaterial.clone());cloud.frustumCulled=false;this.effectGroup.add(cloud);this.sparkClouds.push(cloud);}const cloud=this.sparkClouds[sparkCount++];
      const p=this.world(fx.at).add(new T.Vector3(0,1.05,0)),v=cloud.geometry.attributes.position.array;for(let i=0;i<32;i++){const angle=i*2.39996;v[i*3]=p.x+Math.cos(angle)*fx.progress*.7;v[i*3+1]=p.y+Math.sin(i*1.83)*fx.progress*.6-fx.progress*fx.progress*.4;v[i*3+2]=p.z+Math.sin(angle)*fx.progress*.7;}cloud.geometry.attributes.position.needsUpdate=true;cloud.material.opacity=(1-fx.progress)*.85;cloud.material.color.set(fx.type==='shield'?'#ffe2a3':'#bdac91');
      const u=this.encounter.units.find(u=>u.x===fx.at.x&&u.y===fx.at.y);if(u&&fx.delta)this.labels.get(u.id)?.querySelector('strong')?.replaceChildren(document.createTextNode(String(fx.delta)));
    }}
    const target=this.focusMode&&selected?selected.group.position.clone().add(new T.Vector3(0,.7,0)):this.baseTarget.clone();if(frame&&!this.reducedMotion&&!this.focusMode){const active=Object.keys(frame.unitOverrides).map(id=>this.actors.get(id)?.group.position).filter(Boolean);if(active.length&&active.length<3){const center=active.reduce((p,v)=>p.add(v),new T.Vector3()).divideScalar(active.length);target.lerp(center,.14);target.y=.5;}}
    this.lookTarget.lerp(target,this.reducedMotion?1:Math.min(1,dt*3));const {yaw,pitch,distance}=this.orbit;this.scene.fog.density=(this.profile?.fogDensity??.017)*Math.min(1,27/distance);this.camera.position.set(this.lookTarget.x+Math.sin(yaw)*Math.cos(pitch)*distance,this.lookTarget.y+Math.sin(pitch)*distance,this.lookTarget.z+Math.cos(yaw)*Math.cos(pitch)*distance);this.camera.lookAt(this.lookTarget);this.camera.updateMatrixWorld();
    for(const [id,actor] of this.actors){if(!actor.group.visible)continue;const label=this.labels.get(id),screen=actor.group.position.clone().add(new T.Vector3(0,(actor.group.userData.actor?.height??2.03)+.15,0)).project(this.camera);label.style.transform=`translate(${(screen.x*.5+.5)*this.canvas.clientWidth}px,${(-screen.y*.5+.5)*this.canvas.clientHeight}px) translate(-50%,-100%)`;label.style.visibility=screen.z>1||screen.z< -1||screen.x<-1.1||screen.x>1.1?'hidden':'visible';}
    for(const marker of this.missionMarkers.values()){const point=marker.mesh.position.clone().add(new T.Vector3(0,.14,0)).project(this.camera);marker.label.style.transform=`translate(${(point.x*.5+.5)*this.canvas.clientWidth}px,${(-point.y*.5+.5)*this.canvas.clientHeight}px) translate(-50%,0)`;marker.label.style.visibility=Math.abs(point.x)>1||Math.abs(point.y)>1||Math.abs(point.z)>1?'hidden':'visible';}
    this.renderer.render(this.scene,this.camera);const cost=performance.now()-renderStart;this.samples.push(cost);if(this.samples.length>120)this.samples.shift();this.onFrame(cost);if(now-(this.lastStats||0)>1000){this.lastStats=now;this.canvas.dataset.renderStats=JSON.stringify(this.stats());}
  }
  stats(){return {cuesPlayed:this.cuesPlayed,renderMs:this.samples.reduce((a,b)=>a+b,0)/Math.max(1,this.samples.length),samples:this.samples.length,calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,geometries:this.renderer.info.memory.geometries,quality:this.quality};}
  dispose(){if(this.disposed)return;this.disposed=true;this.sound.dispose();this.finishMotion();cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.events.forEach(fn=>fn());this.actors.forEach(a=>a.dispose());this.environment.dispose();this.labelLayer.remove();const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();}
}
