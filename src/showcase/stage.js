import * as T from '../../vendor/three/three.module.js';
import {createActor} from './actors.js';
import {createEnvironment,gridToWorld} from './environment.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../ui/animation-timeline.js';
import {facingYaw,isAlive} from './session.js';

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
  const health=motion==='withdrawn'?1:!isAlive(unit)&&o&&o.alpha>0?(pair?.before.hp??1)/(pair?.before.maxHp??1):unit.hp/unit.maxHp;
  return {time:reducedMotion?0:time,dt,motion,phase:motion==='brace'&&o?.pose!=='brace'?.45:phase,direction,health,selected:false};
}
export class BattleStage{
  constructor(canvas,encounter,{onPick=()=>{},onHover=()=>{},quality='balanced',reducedMotion=false}={}){
    this.canvas=canvas;this.encounter=encounter;this.onPick=onPick;this.onHover=onHover;this.quality=quality;this.reducedMotion=reducedMotion;this.actors=new Map();this.labels=new Map();this.selected='hero';this.targets=[];this.lastPaint=0;this.elapsed=0;this.disposed=false;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
    this.scene=new T.Scene();this.scene.background=new T.Color('#acbdba');this.scene.fog=new T.FogExp2('#a1b1a7',.017);
    this.camera=new T.PerspectiveCamera(40,1,.1,220);this.orbit={yaw:-.55,pitch:.64,distance:27,target:new T.Vector3(0,0,0)};this.lookTarget=new T.Vector3(0,.25,0);this.baseTarget=new T.Vector3(0,.25,0);this.cameraKick=0;
    const sky=new T.HemisphereLight('#d2e9f3','#61533b',2.1);this.scene.add(sky);
    this.sun=new T.DirectionalLight('#ffda9e',3.3);this.sun.position.set(-16,24,-12);this.sun.castShadow=true;Object.assign(this.sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:80});this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00008;this.sun.shadow.radius=3;this.scene.add(this.sun);
    const rim=new T.DirectionalLight('#b9d8e9',.65);rim.position.set(15,6,9);this.scene.add(rim);
    this.environment=createEnvironment(this.scene,encounter,{tileSize:2.5,quality});
    this.overlay=new T.Group();this.scene.add(this.overlay);this.effectGroup=new T.Group();this.scene.add(this.effectGroup);
    this.ringGeometry=new T.RingGeometry(.78,.83,48);this.targetGeometry=new T.RingGeometry(.63,.7,40);
    this.targetMaterial=new T.MeshBasicMaterial({color:'#89cfcb',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide});
    this.selectionMaterial=new T.MeshBasicMaterial({color:'#edcf7c',transparent:true,opacity:.95,depthWrite:false,side:T.DoubleSide});
    this.hoverMaterial=new T.MeshBasicMaterial({color:'#fff2c1',transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide});
    this.selectedRing=new T.Mesh(this.ringGeometry,this.selectionMaterial);this.selectedRing.rotation.x=-Math.PI/2;this.overlay.add(this.selectedRing);
    this.hoverRing=new T.Mesh(this.targetGeometry,this.hoverMaterial);this.hoverRing.rotation.x=-Math.PI/2;this.hoverRing.visible=false;this.overlay.add(this.hoverRing);
    this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.hit=new T.Vector3();
    this.labelLayer=document.createElement('div');this.labelLayer.className='world-labels';this.labelLayer.setAttribute('aria-hidden','true');canvas.parentElement.append(this.labelLayer);
    this.projectile=new T.Group();const shaft=new T.Mesh(new T.CylinderGeometry(.025,.025,1.45,8),new T.MeshStandardMaterial({color:'#7d4e24',roughness:.85}));shaft.rotation.x=Math.PI/2;const tip=new T.Mesh(new T.ConeGeometry(.075,.32,6),new T.MeshStandardMaterial({color:'#afb3b1',metalness:.8,roughness:.35}));tip.rotation.x=Math.PI/2;tip.position.z=.85;this.projectile.add(shaft,tip);this.effectGroup.add(this.projectile);this.projectile.visible=false;
    const count=32,positions=new Float32Array(count*3);this.sparkGeometry=new T.BufferGeometry();this.sparkGeometry.setAttribute('position',new T.BufferAttribute(positions,3));this.sparkMaterial=new T.PointsMaterial({color:'#ffe4a1',size:.065,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});this.sparks=new T.Points(this.sparkGeometry,this.sparkMaterial);this.sparks.frustumCulled=false;this.effectGroup.add(this.sparks);this.projectiles=[this.projectile];this.sparkClouds=[this.sparks];
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.applyQuality(quality);this.sync(encounter);this.bind();this.resize();this.frame=requestAnimationFrame(t=>this.tick(t));
  }
  world(tile){const p=gridToWorld(tile,this.encounter,2.5);return new T.Vector3(p.x,this.environment.groundHeight(p.x,p.z),p.z);}
  sync(encounter){this.encounter=encounter;for(const u of encounter.units.filter(u=>!u.hidden)){
    if(!this.actors.has(u.id)){const actor=createActor(u,{quality:this.quality});actor.group.userData.unitId=u.id;this.scene.add(actor.group);this.actors.set(u.id,actor);const label=document.createElement('div');label.className='world-unit '+(u.side==='enemy'?'enemy':'friendly');label.innerHTML='<span class="world-name"></span><span class="world-health"><i></i></span><strong></strong>';this.labelLayer.append(label);this.labels.set(u.id,label);}
    const actor=this.actors.get(u.id);actor.group.position.copy(this.world(u));actor.group.visible=isAlive(u);const label=this.labels.get(u.id);label.querySelector('.world-name').textContent=u.id==='hero'?'Aurelius':u.side==='ally'?'Lucan':u.role==='archer'?'Archer':'Raider';label.querySelector('i').style.width=Math.max(0,u.hp/u.maxHp*100)+'%';label.hidden=!isAlive(u);
  }}
  setSelection(selected,targets=[],target=null){this.selected=selected;this.targets=targets;for(const child of [...this.overlay.children])if(child.userData.legal){this.overlay.remove(child);}
    for(const t of targets){const marker=new T.Mesh(this.targetGeometry,this.targetMaterial);marker.rotation.x=-Math.PI/2;marker.position.copy(this.world(t));marker.position.y+=.055;marker.userData.legal=true;this.overlay.add(marker);}
    this.hoverRing.visible=!!target;if(target){this.hoverRing.position.copy(this.world(target));this.hoverRing.position.y+=.08;}
  }
  applyQuality(quality){const previous=this.quality;this.quality=quality in QUALITY?quality:'balanced';const q=QUALITY[this.quality];this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.ratio));if(this.sun.shadow.mapSize.x!==q.shadow){this.sun.shadow.mapSize.set(q.shadow,q.shadow);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}if(previous!==this.quality&&this.environment){this.environment.dispose();this.environment=createEnvironment(this.scene,this.encounter,{tileSize:2.5,quality:this.quality});}this.resize();}
  setReducedMotion(value){this.reducedMotion=value;if(value)this.finishMotion();}
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
  home(){this.focusMode=false;this.orbit.yaw=-.55;this.orbit.pitch=.64;this.orbit.distance=this.camera.aspect<.85?47:27;this.baseTarget.set(0,.25,0);}
  focusSelected(){const u=this.encounter.units.find(u=>u.id===this.selected);if(u){this.focusMode=true;this.baseTarget.copy(this.world(u));this.baseTarget.y=.7;this.orbit.distance=7.5;this.orbit.pitch=.36;this.orbit.yaw=1.1;}}
  pick(event){const r=this.canvas.getBoundingClientRect();this.ndc.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.ndc,this.camera);
    const hits=this.ray.intersectObjects([...this.actors.values()].filter(a=>a.group.visible).map(a=>a.group),true);
    if(hits.length){let obj=hits[0].object;while(obj&&!obj.userData.unitId)obj=obj.parent;const u=this.encounter.units.find(u=>u.id===obj?.userData.unitId);if(u&&isAlive(u))return {x:u.x,y:u.y,unitId:u.id};}
    if(!intersectGround(this.ray.ray,this.environment.groundHeight,this.hit))return null;const x=Math.round(this.hit.x/2.5+(this.encounter.width-1)/2),y=Math.round(this.hit.z/2.5+(this.encounter.height-1)/2);return x>=0&&y>=0&&x<this.encounter.width&&y<this.encounter.height?{x,y}:null;
  }
  bind(){this.events=[];const on=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);this.events.push(()=>target.removeEventListener(type,fn,opts));};
    on(this.canvas,'pointerdown',e=>{this.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};this.canvas.setPointerCapture(e.pointerId);});
    on(this.canvas,'pointermove',e=>{if(this.drag){const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>7)this.drag.moved=true;if(this.drag.moved){this.orbit.yaw-=dx*.006;this.orbit.pitch=clamp(this.orbit.pitch+dy*.004,.28,1.15);}this.drag.lastX=e.clientX;this.drag.lastY=e.clientY;}else this.onHover(this.pick(e));});
    on(this.canvas,'pointerup',e=>{if(this.drag&&!this.drag.moved&&!this.animation)this.onPick(this.pick(e));this.drag=null;});on(this.canvas,'pointercancel',()=>this.drag=null);
    on(this.canvas,'wheel',e=>{e.preventDefault();this.orbit.distance=clamp(this.orbit.distance+e.deltaY*.022,5.5,55);},{passive:false});
    on(this.canvas,'keydown',e=>{let handled=true;switch(e.key){case'ArrowLeft':this.orbit.yaw-=.12;break;case'ArrowRight':this.orbit.yaw+=.12;break;case'ArrowUp':this.orbit.pitch=clamp(this.orbit.pitch+.08,.28,1.15);break;case'ArrowDown':this.orbit.pitch=clamp(this.orbit.pitch-.08,.28,1.15);break;case'+':case'=':this.orbit.distance=clamp(this.orbit.distance-2,5.5,55);break;case'-':this.orbit.distance=clamp(this.orbit.distance+2,5.5,55);break;case'Home':this.home();break;case'f':case'F':this.focusSelected();break;default:handled=false;}if(handled)e.preventDefault();});
    on(document,'visibilitychange',()=>{if(document.hidden)this.finishMotion();});
    on(this.canvas,'webglcontextlost',e=>{e.preventDefault();this.finishMotion();this.contextLost=true;this.onError?.('The graphics context was interrupted. Reload this study to restore it. Your campaign is unaffected.');});
  }
  play(before,after,command){this.finishMotion();this.sync(after);if(this.reducedMotion)return Promise.resolve();const timeline=buildEncounterTimeline(before,after,{command,quality:this.quality});if(!timeline.duration)return Promise.resolve();
    this.animation={timeline,start:performance.now(),scale:2.5};return new Promise(resolve=>this.animation.resolve=resolve);
  }
  finishMotion(){if(!this.animation)return;const resolve=this.animation.resolve;this.animation=null;this.projectiles.forEach(p=>p.visible=false);this.sparkClouds.forEach(p=>p.material.opacity=0);this.sync(this.encounter);resolve?.();}
  tick(now){if(this.disposed)return;this.frame=requestAnimationFrame(t=>this.tick(t));if(document.hidden||this.contextLost)return;const interval=1000/QUALITY[this.quality].fps;if(now-this.lastPaint<interval)return;const dt=Math.min(.08,(now-this.lastPaint)/1000||.016);this.lastPaint=now;this.elapsed+=dt;let frame=null;
    if(this.animation){const a=this.animation;frame=sampleEncounterTimeline(a.timeline,(now-a.start)/a.scale);if(frame.complete){this.finishMotion();frame=null;}}
    this.environment.update(this.reducedMotion?0:this.elapsed);
    for(const unit of this.encounter.units.filter(u=>!u.hidden)){
      const a=this.actors.get(unit.id),o=frame?.unitOverrides[unit.id],position=o??unit;
      a.group.position.copy(this.world(position));a.group.visible=isAlive(unit)||!!o&&o.alpha>0;if(!a.group.visible){this.labels.get(unit.id).hidden=true;continue;}
      a.update(stageActorPose(unit,frame,this.animation?.timeline,{time:this.elapsed,dt,reducedMotion:this.reducedMotion}));
      const label=this.labels.get(unit.id);label.hidden=false;label.classList.toggle('selected',unit.id===this.selected);label.querySelector('strong').textContent='';
    }
    const selected=this.actors.get(this.selected);this.selectedRing.visible=!!selected?.group.visible;if(selected){this.selectedRing.position.copy(selected.group.position);this.selectedRing.position.y+=.065;}
    this.projectiles.forEach(p=>p.visible=false);this.sparkClouds.forEach(p=>p.material.opacity=0);let projectileCount=0,sparkCount=0;
    for(const fx of frame?.effects??[]){if(fx.type==='projectile'&&projectileCount<4){
      if(!this.projectiles[projectileCount]){const p=this.projectile.clone();this.effectGroup.add(p);this.projectiles.push(p);}const projectile=this.projectiles[projectileCount++];projectile.scale.setScalar(fx.projectile==='arrow'?.52:1);
      const from=this.world(fx.from).add(new T.Vector3(0,1.4,0)),to=this.world(fx.to).add(new T.Vector3(0,1.1,0)),t=fx.progress;projectile.position.copy(from).lerp(to,t);projectile.position.y+=Math.sin(t*Math.PI)*1.8;const next=from.clone().lerp(to,Math.min(1,t+.02));next.y+=Math.sin(Math.min(1,t+.02)*Math.PI)*1.8;projectile.lookAt(next);projectile.visible=true;
    }else if(['impact','shield'].includes(fx.type)){
      if(sparkCount>=8)continue;if(!this.sparkClouds[sparkCount]){const cloud=new T.Points(this.sparkGeometry.clone(),this.sparkMaterial.clone());cloud.frustumCulled=false;this.effectGroup.add(cloud);this.sparkClouds.push(cloud);}const cloud=this.sparkClouds[sparkCount++];
      const p=this.world(fx.at).add(new T.Vector3(0,1.05,0)),v=cloud.geometry.attributes.position.array;for(let i=0;i<32;i++){const angle=i*2.39996;v[i*3]=p.x+Math.cos(angle)*fx.progress*.7;v[i*3+1]=p.y+Math.sin(i*1.83)*fx.progress*.6-fx.progress*fx.progress*.4;v[i*3+2]=p.z+Math.sin(angle)*fx.progress*.7;}cloud.geometry.attributes.position.needsUpdate=true;cloud.material.opacity=(1-fx.progress)*.85;cloud.material.color.set(fx.type==='shield'?'#ffe2a3':'#bdac91');
      const u=this.encounter.units.find(u=>u.x===fx.at.x&&u.y===fx.at.y);if(u&&fx.delta)this.labels.get(u.id)?.querySelector('strong')?.replaceChildren(document.createTextNode(String(fx.delta)));
    }}
    const target=this.focusMode&&selected?selected.group.position.clone().add(new T.Vector3(0,.7,0)):this.baseTarget.clone();if(frame&&!this.reducedMotion&&!this.focusMode){const active=Object.keys(frame.unitOverrides).map(id=>this.actors.get(id)?.group.position).filter(Boolean);if(active.length&&active.length<3){const center=active.reduce((p,v)=>p.add(v),new T.Vector3()).divideScalar(active.length);target.lerp(center,.14);target.y=.5;}}
    this.lookTarget.lerp(target,this.reducedMotion?1:Math.min(1,dt*3));const {yaw,pitch,distance}=this.orbit;this.camera.position.set(this.lookTarget.x+Math.sin(yaw)*Math.cos(pitch)*distance,this.lookTarget.y+Math.sin(pitch)*distance,this.lookTarget.z+Math.cos(yaw)*Math.cos(pitch)*distance);this.camera.lookAt(this.lookTarget);this.camera.updateMatrixWorld();
    for(const [id,actor] of this.actors){if(!actor.group.visible)continue;const label=this.labels.get(id),screen=actor.group.position.clone().add(new T.Vector3(0,2.18,0)).project(this.camera);label.style.transform=`translate(${(screen.x*.5+.5)*this.canvas.clientWidth}px,${(-screen.y*.5+.5)*this.canvas.clientHeight}px) translate(-50%,-100%)`;label.style.visibility=screen.z>1||screen.z< -1||screen.x<-1.1||screen.x>1.1?'hidden':'visible';}
    this.renderer.render(this.scene,this.camera);
  }
  stats(){return {calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,geometries:this.renderer.info.memory.geometries,quality:this.quality};}
  dispose(){if(this.disposed)return;this.disposed=true;this.finishMotion();cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.events.forEach(fn=>fn());this.actors.forEach(a=>a.dispose());this.environment.dispose();this.labelLayer.remove();const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();}
}
