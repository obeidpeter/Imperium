import * as T from '../../vendor/three/three.module.js';
import {createSceneryOcclusion} from './environment-occlusion.js';
import {createFrameCadence,createGpuTimer,createResolutionBudget} from './frame-budget.js';
import {createActor} from './actors.js';
import {createPaintedActor,paintedLight} from './painted-actor.js';
import {loadTacticalArt} from '../ui/unit-sprites.js';
import {FIGURE_STYLES} from '../ui/graphics-quality.js';
import {actorAssetStatus} from './actor-assets.js';
import {warmActorMaterials} from './actor-materials.js';
import {campaignSoundscape} from '../ui/soundscape.js';
import {createEnvironment,gridToWorld} from './environment.js';
import {HIGH_GROUND_HEIGHT,RIVER_BED,RIVER_WATER_LEVEL,terrainAt} from './environment-layout.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../ui/animation-timeline.js';
import {facingYaw,isAlive} from './session.js';
import {createBattleSound} from './battle-sound.js';
import {meleeOffset,combatCues,retimeStageTimeline,locomotionPhase,combatReaction} from './combat-presentation.js';
import {getSceneProfile} from './campaign-scene-profile.js';
import {actorVisible,civicActor,actorReadout,effectReadout,missionReadouts,reinforcementBeacons,tacticalLinks,targetRingColor} from './stage-readout.js';
import {layoutStageLabels} from './stage-label-layout.js';
import {findFocusCamera} from './stage-focus-camera.js';
import {createSky} from './sky.js';
import {createSceneLighting} from './scene-lighting.js';
import {createSceneCompositor} from './scene-compositor.js';
import {createContactShadows} from './contact-shadows.js';
import {createParticleMask,sampleImpactParticles,createWeatherField,sampleWeatherParticles,createFlamePlume,sampleFlamePlume} from './stage-particles.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>t*t*(3-2*t);
// Frame targets divide common refresh rates; see createFrameCadence.
const QUALITY={performance:{ratio:1,shadow:1024,fps:30},balanced:{ratio:1.5,shadow:2048,fps:60},high:{ratio:2,shadow:4096,fps:60}};
// Presentation styles for the figures (FIGURE_STYLES). Painted stands the 2D
// campaign's own figure paintings in the diorama (HD-2D) with a tilt-shift
// finish; inked keeps sculpted figures with ink outlines and washes.
export {FIGURE_STYLES};
export const figureStyleFinish=style=>({tiltShift:style==='painted'?1:0,ink:style==='inked'?1:0});
// Painted figures were authored for diagonal views; the overview settles there.
export const diagonalYaw=yaw=>Math.round((yaw-Math.PI/4)/(Math.PI/2))*(Math.PI/2)+Math.PI/4;
const blendYaw=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*ease(clamp(t,0,1));
const pathYaw=(a,b)=>Math.atan2(b.x-a.x,b.y-a.y);

// The authored release anchor and impact point describe the missile tip, not
// its mesh origin. Preserve those endpoints through either projectile scale.
export function positionProjectileTip(projectile,from,to,progress){
  const t=clamp(progress,0,1),tip=from.clone().lerp(to,t),direction=to.clone().sub(from);tip.y+=Math.sin(t*Math.PI)*1.8;direction.y+=Math.cos(t*Math.PI)*Math.PI*1.8;direction.normalize();
  projectile.position.copy(tip);projectile.lookAt(tip.clone().add(direction));projectile.position.addScaledVector(direction,-1.01*projectile.scale.z);
}

// Picking follows the visible relief: march the ray through the band between
// the river bed and the plateau tops, then bisect the crossing. Refining a flat
// plane alone would slide past a 1.6m rise to the ground behind it.
export function intersectGround(ray,height,target=new T.Vector3(),{top=HIGH_GROUND_HEIGHT+.5,bottom=RIVER_BED-.5,maxDistance=900,step=.2}={}){
  const o=ray.origin,d=ray.direction,above=t=>o.y+d.y*t-height(o.x+d.x*t,o.z+d.z*t);
  if(d.y>=0&&o.y>top)return null;
  const start=d.y<0?Math.max(0,(top-o.y)/d.y):0,end=d.y<0?Math.min(maxDistance,(bottom-o.y)/d.y):maxDistance;
  if(!(end>=start))return null;
  if(above(start)<=0)return ray.at(start,target);
  for(let previous=start,t=start+step;previous<end;previous=t,t+=step){
    const next=Math.min(t,end);if(above(next)>0)continue;
    let lo=previous,hi=next;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(above(mid)>0)lo=mid;else hi=mid;}
    return ray.at(hi,target);
  }
  return null;
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
  constructor(canvas,encounter,{onPick=()=>{},onHover=()=>{},quality='balanced',adaptiveResolution=true,reducedMotion=false,motionSpeed=1,keyboardMode='orbit',onFrame=()=>{},chapter,rank,stratagem,weather,timeOfDay,commendations,figureStyle='sculpted'}={}){
    try{
    this.chapter=chapter??Number(/^ch(\d+)/.exec(encounter.id)?.[1]??1);this.rank=rank;this.stratagem=stratagem??encounter.stratagem??null;this.commendations=commendations??{};this.profile=getSceneProfile(encounter,{chapter:this.chapter,stratagem:this.stratagem,weather:weather??encounter.weather,timeOfDay:timeOfDay??encounter.timeOfDay});this.keyboardMode=keyboardMode;this.onFrame=onFrame;this.samples=[];this.paused=false;this.canvas=canvas;this.encounter=encounter;this.onPick=onPick;this.onHover=onHover;this.quality=quality;this.reducedMotion=reducedMotion;this.motionSpeed=Number(motionSpeed)>1?2:1;this.figureStyle=FIGURE_STYLES.includes(figureStyle)?figureStyle:'sculpted';this.paintedLight=paintedLight(this.profile);this.actors=new Map();this.labels=new Map();this.selected='hero';this.targets=[];this.lastPaint=0;this.elapsed=0;this.disposed=false;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.sound=createBattleSound({recordedCue:(kind,options)=>campaignSoundscape().cue(kind,options),stopRecordings:()=>campaignSoundscape().stopEffects()});this.cuesPlayed=0;
    this.gpuTimer=createGpuTimer(this.renderer.getContext());this.adaptiveResolution=adaptiveResolution;
    this.resolutionBudget=createResolutionBudget({fps:QUALITY[quality]?.fps??60,enabled:adaptiveResolution,onChange:()=>this.updatePixelRatio()});this.cadence=createFrameCadence({fps:QUALITY[quality]?.fps??60});
    this.materialReady=warmActorMaterials().then(ready=>{if(!this.disposed){this.shadowDirty=true;this.canvas.dataset.materials=ready?'atlas':'fallback';}return ready;});
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=this.profile.exposure??1.05;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.shadowMap.autoUpdate=false;this.shadowDirty=true;this.shadowUpdates=0;this.lastShadow=-Infinity;this.renderCounts=[];
    this.labelRefs=new Map();this.labelStats={visible:0,occluded:0,offscreen:0,overlaps:0};this.poseReset=new Set();this.visibleUnits=[];this.labelSizeDirty=true;this.screenPoint=new T.Vector3();this.matrix=new T.Matrix4();
    this.scene=new T.Scene();this.scene.background=new T.Color(this.profile.sky);this.scene.fog=new T.Fog(this.profile.fog,40,200);
    this.camera=new T.PerspectiveCamera(40,1,.1,800);this.orbit={yaw:-.55,pitch:.64,distance:27,target:new T.Vector3(0,0,0)};this.lookTarget=new T.Vector3(0,.25,0);this.baseTarget=new T.Vector3(0,.25,0);this.cameraKick=0;this.cameraView='overview';
    this.sky=createSky(this.scene,this.profile,{quality,reducedMotion});
    this.lighting=createSceneLighting(this.renderer,this.scene,this.profile,{quality});
    this.contactShadows=createContactShadows(this.scene);
    const balance=this.profile.grade??{},sky=new T.HemisphereLight(this.profile.ambient,this.profile.ambientGround??'#61533b',this.profile.ambientIntensity*.72*(balance.ambient??1));this.scene.add(sky);
    this.sun=new T.DirectionalLight(this.profile.sun,this.profile.sunIntensity*(balance.sun??1));this.sun.position.fromArray(this.profile.sunPosition??[-16,24,-12]);this.sun.castShadow=true;Object.assign(this.sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:80});this.sun.shadow.normalBias=.012;this.sun.shadow.bias=-.00008;this.sun.shadow.radius=3;this.scene.add(this.sun);this.scene.add(this.sun.target);this.sunOffset=this.sun.position.clone();this.shadowFit={x:0,z:0,half:23};
    // A back light kept behind the subject, facing the camera, separates figures from the ground.
    this.rim=new T.DirectionalLight(balance.rim??'#b9d8e9',balance.rimIntensity??.38);this.rim.position.set(15,6,9);this.scene.add(this.rim);this.scene.add(this.rim.target);this.rimDirection=new T.Vector3();
    this.environment=createEnvironment(this.scene,encounter,{tileSize:2.5,quality,chapter:this.chapter});
    this.sceneryOcclusion=createSceneryOcclusion(this.environment.group);
    this.overlay=new T.Group();this.scene.add(this.overlay);this.effectGroup=new T.Group();this.scene.add(this.effectGroup);
    this.ringGeometry=new T.RingGeometry(.78,.83,48);this.targetGeometry=new T.RingGeometry(.63,.7,40);
    this.targetMaterial=new T.MeshBasicMaterial({color:'#89cfcb',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide});
    this.legalTargets=new T.InstancedMesh(this.targetGeometry,this.targetMaterial,Math.max(64,encounter.width*encounter.height));this.legalTargets.count=0;this.legalTargets.frustumCulled=false;this.overlay.add(this.legalTargets);
    this.selectionMaterial=new T.MeshBasicMaterial({color:'#edcf7c',transparent:true,opacity:.95,depthWrite:false,side:T.DoubleSide});
    this.hoverMaterial=new T.MeshBasicMaterial({color:'#fff2c1',transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide});
    this.selectedRing=new T.Mesh(this.ringGeometry,this.selectionMaterial);this.selectedRing.rotation.order='YXZ';this.selectedRing.rotation.x=-Math.PI/2;
    this.facingChevron=new T.Mesh(new T.CircleGeometry(.13,3),this.selectionMaterial);this.facingChevron.position.set(0,-.92,0);this.facingChevron.rotation.z=-Math.PI/2;this.selectedRing.add(this.facingChevron);
    this.overlay.add(this.selectedRing);
    this.hoverRing=new T.Mesh(this.targetGeometry,this.hoverMaterial);this.hoverRing.rotation.x=-Math.PI/2;this.hoverRing.visible=false;this.overlay.add(this.hoverRing);
    this.goalMarker=new T.Mesh(new T.RingGeometry(.96,1.02,48),new T.MeshBasicMaterial({color:'#edcf7c',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}));this.goalMarker.rotation.x=-Math.PI/2;this.overlay.add(this.goalMarker);
    this.effectRings=[];this.missionMarkers=new Map();this.chamberStandards=new Map();this.hovered=null;this.canvas.dataset.scene=this.profile.key;this.canvas.dataset.chapter=String(this.chapter);this.canvas.dataset.kind=encounter.kind;this.canvas.dataset.weather=this.profile.weather;this.canvas.dataset.timeOfDay=this.profile.timeOfDay;
    this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.hit=new T.Vector3();
    this.labelLayer=document.createElement('div');this.labelLayer.className='world-labels';this.labelLayer.setAttribute('aria-hidden','true');canvas.parentElement.append(this.labelLayer);
    this.projectile=new T.Group();const shaft=new T.Mesh(new T.CylinderGeometry(.025,.025,1.45,8),new T.MeshStandardMaterial({color:'#7d4e24',roughness:.85}));shaft.rotation.x=Math.PI/2;const tip=new T.Mesh(new T.ConeGeometry(.075,.32,6),new T.MeshStandardMaterial({color:'#afb3b1',metalness:.8,roughness:.35}));tip.rotation.x=Math.PI/2;tip.position.z=.85;const trail=new T.Mesh(new T.ConeGeometry(.045,1.35,8,1,true),new T.MeshBasicMaterial({color:'#f5e4bc',transparent:true,opacity:.34,depthWrite:false,side:T.DoubleSide}));trail.name='projectile-trail';trail.rotation.x=-Math.PI/2;trail.position.z=-.55;this.projectile.add(shaft,tip,trail);this.effectGroup.add(this.projectile);this.projectile.visible=false;
    this.particleMask=createParticleMask();const count=24,positions=new Float32Array(count*3);this.sparkGeometry=new T.BufferGeometry();this.sparkGeometry.setAttribute('position',new T.BufferAttribute(positions,3));this.sparkMaterial=new T.PointsMaterial({map:this.particleMask,alphaTest:.015,color:'#ffe4a1',size:.065,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});this.sparks=new T.Points(this.sparkGeometry,this.sparkMaterial);this.sparks.frustumCulled=false;this.effectGroup.add(this.sparks);this.projectiles=[this.projectile];this.sparkClouds=[this.sparks];
    this.weatherCloud=createWeatherField(this.particleMask);this.effectGroup.add(this.weatherCloud);sampleWeatherParticles(this.weatherCloud,this.profile.weather,0,{reducedMotion:this.reducedMotion});
    this.nightLight=new T.PointLight('#ffad5c',this.profile.torchlight?2.4:0,16,1.6);this.nightLight.position.set(0,3.2,0);this.effectGroup.add(this.nightLight);
    this.compositor=createSceneCompositor(this.renderer,this.camera,{quality});this.compositor.setGrade?.(this.profile.grade??{});this.compositor.setStyle?.(figureStyleFinish(this.figureStyle));
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.applyQuality(quality);this.sync(encounter);this.bind();this.resize();this.frame=requestAnimationFrame(t=>this.tick(t));
    }catch(error){this.releasePartial();throw error;}
  }
  // A constructor failure must not strand the overlay, renderer, observer or audio.
  releasePartial(){this.disposed=true;try{this.sound?.dispose?.();}catch{}this.resizeObserver?.disconnect();this.events?.forEach(fn=>fn());this.labelLayer?.remove();try{this.renderer?.dispose();if(this.canvas&&!this.canvas.isConnected)this.renderer?.forceContextLoss?.();}catch{}}
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
      const vComm=this.commendations?.[u.veteranId]??(u.moraleResistance?6:u.specialization?3:0);
      const styleKey=`${u.side}:${u.role}:${u.name}:${vComm}:${this.quality}:${this.figureStyle}`;let actor=this.actors.get(u.id);
      // A committed defection changes the uniform and allegiance together.
      if(actor&&actor.group.userData.styleKey!==styleKey){this.scene.remove(actor.group);actor.dispose();this.actors.delete(u.id);actor=null;}
      if(!actor){actor=(this.figureStyle==='painted'&&createPaintedActor(u,{chapter:this.chapter,contest:encounter.kind==='contest',light:this.paintedLight}))||createActor(u,{quality:this.quality,chapter:this.chapter,rank:this.rank,commendations:vComm});if(actor.painted)this.loadPaintedArt();actor.group.userData.unitId=u.id;actor.group.userData.styleKey=styleKey;this.scene.add(actor.group);this.actors.set(u.id,actor);this.poseReset.add(u.id);actor.ready?.then(()=>{if(!this.disposed&&this.actors.get(u.id)===actor){this.shadowDirty=true;this.poseReset.add(u.id);this.canvas.dataset.actorAssets=actorAssetStatus().ready?'imported':'fallback';}});}
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
      const marker=this.missionMarkers.get(mark.id);marker.mesh.position.copy(this.world(mark));marker.mesh.position.y+=.07;marker.mesh.scale.setScalar(['high','hill'].includes(terrainAt(encounter,mark.x,mark.y))?.85:1);marker.mesh.material.color.set(mark.tone==='warning'?'#df9d85':mark.tone==='secured'?'#b0d0a1':'#edcf7c');marker.label.textContent=mark.label;marker.label.dataset.tone=mark.tone;
    }
    this.updateChamberStandards(encounter);
    this.updateFieldworks(encounter);
    this.updateBattleDecals(encounter);
    this.updateMoraleRings(encounter);
    this.updateReinforcementBeacons(encounter);
    this.updateTacticalLinks();
  }
  releaseOverlay(group){this.overlay?.remove(group);group.traverse(o=>{if(o.geometry&&o.geometry!==this.targetGeometry&&o.geometry!==this.ringGeometry)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.dispose();if(o.isLight)o.dispose?.();});}
  updateMoraleRings(encounter=this.encounter){
    if(!this.overlay)return;
    this.moraleRings=this.moraleRings??new Map();
    const units=encounter?.kind==='battle'?(encounter.units??[]).filter(u=>actorVisible(u)&&((u.morale??80)<=40||u.name==='Pledged cohort')):[];
    const wanted=new Set(units.map(u=>u.id));
    for(const [id,mesh]of this.moraleRings)if(!wanted.has(id)){this.overlay.remove(mesh);mesh.material.dispose();this.moraleRings.delete(id);}
    for(const u of units){
      if(!this.moraleRings.has(u.id)){
        const mesh=new T.Mesh(this.targetGeometry,new T.MeshBasicMaterial({color:'#d89b3c',transparent:true,opacity:.78,depthWrite:false,side:T.DoubleSide}));
        mesh.name='unit-morale-ring';mesh.rotation.x=-Math.PI/2;this.overlay.add(mesh);this.moraleRings.set(u.id,mesh);
      }
      const mesh=this.moraleRings.get(u.id),broken=(u.morale??80)<=20,shaken=(u.morale??80)<=40;
      mesh.position.copy(this.world(u));mesh.position.y+=.048;
      mesh.material.color.set(broken?'#c44d3f':shaken?'#d89b3c':'#e8c86b');
      mesh.userData.moraleState=broken?'broken':shaken?'shaken':'pledged';
      mesh.visible=true;
    }
  }
  updateReinforcementBeacons(encounter=this.encounter){
    if(!this.overlay)return;
    this.reinforcementBeacons=this.reinforcementBeacons??new Map();
    const waves=reinforcementBeacons(encounter);
    const wanted=new Set(waves.map(w=>w.id));
    for(const [id,group]of this.reinforcementBeacons)if(!wanted.has(id)){this.releaseOverlay(group);this.reinforcementBeacons.delete(id);}
    for(const w of waves){
      if(!this.reinforcementBeacons.has(w.id)){
        const group=new T.Group();group.name='reinforcement-beacon';
        const ring=new T.Mesh(this.targetGeometry,new T.MeshBasicMaterial({color:'#d89b3c',transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide}));
        ring.rotation.x=-Math.PI/2;
        const spire=new T.Mesh(new T.ConeGeometry(.16,.55,4),new T.MeshBasicMaterial({color:'#df9d85',transparent:true,opacity:.82}));
        spire.position.set(0,.32,0);spire.rotation.x=Math.PI;
        group.add(ring,spire);this.overlay.add(group);this.reinforcementBeacons.set(w.id,group);
      }
      const group=this.reinforcementBeacons.get(w.id),color=w.imminent?'#c44d3f':'#d89b3c';
      group.position.copy(this.world(w));group.position.y+=.06;
      group.children[0]?.material?.color?.set(color);
      group.children[1]?.material?.color?.set(color);
      group.userData.wave=w;
      group.visible=true;
    }
  }
  updateChamberStandards(encounter=this.encounter){
    if(!this.overlay)return;
    const isContest=encounter?.kind==='contest';
    for(const [bloc,x]of [['Veterans',-5.2],['Landholders',0],['Civic',5.2]]){
      if(!isContest){const existing=this.chamberStandards.get(bloc);if(existing)existing.group.visible=false;continue;}
      if(!this.chamberStandards.has(bloc)){
        const group=new T.Group();group.name=`bloc-standard:${bloc}`;group.position.set(x,0,-11.2);
        const pole=new T.Mesh(new T.CylinderGeometry(.045,.055,3.2,8),new T.MeshStandardMaterial({color:'#a98c55',metalness:.65,roughness:.38}));pole.position.y=1.6;
        const bar=new T.Mesh(new T.CylinderGeometry(.035,.035,1.25,8),pole.material);bar.rotation.z=Math.PI/2;bar.position.y=2.95;
        const bannerMat=new T.MeshStandardMaterial({color:'#9b8e74',roughness:.78,side:T.DoubleSide});
        const banner=new T.Mesh(new T.PlaneGeometry(1.08,1.55),bannerMat);banner.name='bloc-banner';banner.position.set(0,2.12,.04);
        group.add(pole,bar,banner);this.overlay.add(group);
        this.chamberStandards.set(bloc,{group,banner,bannerMat});
      }
      const std=this.chamberStandards.get(bloc),voters=encounter.units.filter(u=>u.role==='voter'&&u.bloc===bloc),support=voters.filter(u=>u.stance>=1).length;
      const state=support>=2?'support':support===1?'split':'opposed';
      std.group.visible=true;std.banner.userData.bloc=bloc;std.banner.userData.support=support;std.banner.userData.blocState=state;
      std.bannerMat.color.set(state==='support'?'#cfa855':state==='split'?'#9b8e74':'#8c443c');
    }
    if(isContest&&!this.chamberRostra){
      const rostra=new T.Mesh(new T.BoxGeometry(2.6,.42,1.3),new T.MeshStandardMaterial({color:'#d8d0be',roughness:.72}));
      rostra.name='chamber-rostra';rostra.position.set(0,.21,-9.8);this.overlay.add(rostra);this.chamberRostra=rostra;
    }
    if(this.chamberRostra)this.chamberRostra.visible=isContest;
  }
  updateFieldworks(encounter=this.encounter){
    if(!this.overlay)return;
    this.fieldworkMeshes=this.fieldworkMeshes??new Map();
    const list=encounter?.kind==='battle'?(encounter.fieldworks??[]):[];
    const wanted=new Set(list.map(f=>`${f.type}:${f.x},${f.y}`));
    for(const [key,group]of this.fieldworkMeshes)if(!wanted.has(key)){this.releaseOverlay(group);this.fieldworkMeshes.delete(key);}
    for(const fw of list){
      const key=`${fw.type}:${fw.x},${fw.y}`;
      if(!this.fieldworkMeshes.has(key)){
        const group=new T.Group();group.name=`fieldwork:${fw.type}`;group.userData.fieldwork=fw;
        if(fw.type==='stakes'){
          const wood=new T.MeshStandardMaterial({color:'#6e5034',roughness:.85});
          for(const x of [-.45,0,.45]){const stake=new T.Mesh(new T.ConeGeometry(.08,.85,6),wood);stake.position.set(x,.38,0);stake.rotation.z=-.38;group.add(stake);}
        }else if(fw.type==='rampart'){
          const turf=new T.Mesh(new T.BoxGeometry(1.55,.48,.58),new T.MeshStandardMaterial({color:'#6b5a42',roughness:.9}));turf.position.set(0,.24,.55);group.add(turf);
        }else if(fw.type==='brazier'){
          const stand=new T.Mesh(new T.CylinderGeometry(.24,.15,.52,8),new T.MeshStandardMaterial({color:'#46423d',metalness:.7,roughness:.45}));stand.position.set(.52,.26,.45);
          const fire=new T.Mesh(new T.SphereGeometry(.2,8,6),new T.MeshBasicMaterial({color:'#ff9b3d'}));fire.position.set(.52,.56,.45);
          const light=new T.PointLight('#ff9a3c',1.85,8,1.8);light.name='brazier-light';light.position.set(.52,.88,.45);
          const plume=createFlamePlume(this.particleMask??null);plume.position.set(.52,.56,.45);
          group.userData.brazierLight=light;group.userData.flamePlume=plume;
          group.add(stand,fire,light,plume);
        }
        this.overlay.add(group);this.fieldworkMeshes.set(key,group);
      }
      const group=this.fieldworkMeshes.get(key);group.position.copy(this.world(fw));group.visible=true;
    }
  }
  updateBattleDecals(encounter=this.encounter,extraTiles=[]){
    if(!this.overlay)return;
    this.battleDecals=this.battleDecals??new Map();
    if(encounter?.kind!=='battle'){for(const decal of this.battleDecals.values())decal.visible=false;return;}
    const tiles=[];
    for(const u of encounter.units??[])if(!u.hidden&&(u.hp??1)<=0&&Number.isFinite(u.x)&&Number.isFinite(u.y))tiles.push({x:u.x,y:u.y,kind:'fallen'});
    for(const ev of encounter.turnEvents??[])if(['strike','shot','focus','volley','charge'].includes(ev.kind)&&Number.isFinite(ev.x)&&Number.isFinite(ev.y))tiles.push({x:ev.x,y:ev.y,kind:'clash'});
    for(const extra of extraTiles)if(extra&&Number.isFinite(extra.x)&&Number.isFinite(extra.y))tiles.push({x:extra.x,y:extra.y,kind:extra.kind??'clash'});
    const wanted=new Set(tiles.map(t=>`${t.x},${t.y}`));
    for(const [key,group]of this.battleDecals)if(!wanted.has(key))group.visible=false;
    for(const tile of tiles){
      const key=`${tile.x},${tile.y}`;
      if(!this.battleDecals.has(key)){
        const group=new T.Group();group.name='battle-decal';group.userData.decal=tile;
        const ring=new T.Mesh(new T.RingGeometry(.28,.54,24),new T.MeshBasicMaterial({color:tile.kind==='fallen'?'#4a2822':'#3d3328',transparent:true,opacity:.36,depthWrite:false,side:T.DoubleSide}));
        ring.rotation.x=-Math.PI/2;
        const slash=new T.Mesh(new T.PlaneGeometry(.62,.07),new T.MeshBasicMaterial({color:'#2a231c',transparent:true,opacity:.32,depthWrite:false,side:T.DoubleSide}));
        slash.rotation.x=-Math.PI/2;slash.rotation.z=((tile.x*3+tile.y*5)%7)*.45;
        group.add(ring,slash);this.overlay.add(group);this.battleDecals.set(key,group);
      }
      const group=this.battleDecals.get(key);group.position.copy(this.world(tile));group.position.y+=.026;group.visible=true;
    }
  }
  updateTacticalLinks(target=null,action=this.selectedAction){
    if(!this.overlay)return;
    this.tacticalArcs=this.tacticalArcs??[];
    const links=tacticalLinks(this.encounter,{selected:this.selected,target,action});
    this.tacticalArcs.forEach(line=>line.visible=false);
    for(const [i,link]of links.entries()){
      if(!this.tacticalArcs[i]){
        const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(17*3),3));
        const m=new T.LineBasicMaterial({color:link.color,transparent:true,opacity:.85,depthWrite:false});
        const line=new T.Line(g,m);line.name='tactical-link';line.frustumCulled=false;this.overlay.add(line);this.tacticalArcs.push(line);
      }
      const line=this.tacticalArcs[i],pos=line.geometry.attributes.position;
      if(link.kind==='path'&&link.points?.length>=2){
        const pts=link.points.map(p=>this.world(p)),segs=pts.length-1;
        for(let s=0;s<=16;s++){
          const f=(s/16)*segs,idx=Math.min(segs-1,Math.floor(f)),t=f-idx,a=pts[idx],b=pts[idx+1];
          const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=(this.environment?.groundHeight?this.environment.groundHeight(x,z):a.y+(b.y-a.y)*t)+.11;
          pos.setXYZ(s,x,y,z);
        }
      }else{
        const from=this.world(link.from),to=this.world(link.to);
        const elevated=['aim','intent'].includes(link.kind),baseY=elevated?1.15:.22,peak=elevated?1.35:.36;
        for(let s=0;s<=16;s++){const t=s/16;pos.setXYZ(s,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t+baseY+Math.sin(t*Math.PI)*peak,from.z+(to.z-from.z)*t);}
      }
      pos.needsUpdate=true;line.material.color.set(link.color);line.userData.linkKind=link.kind;line.visible=true;
    }
  }
  setSelection(selected,targets=[],target=null){this.selected=selected;this.targets=targets;this.selectedAction=target?.action??null;this.labelSizeDirty=true;
    if(this.targetMaterial)this.targetMaterial.color.set(targetRingColor(this.selectedAction,this.encounter,targets[0]??target));
    const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2),scale=new T.Vector3(1,1,1);this.legalTargets.count=Math.min(targets.length,this.legalTargets.instanceMatrix.count);
    for(let i=0;i<this.legalTargets.count;i++){const point=this.world(targets[i]);point.y+=.055;this.matrix.compose(point,rotation,scale);this.legalTargets.setMatrixAt(i,this.matrix);}this.legalTargets.instanceMatrix.needsUpdate=true;
    this.inspected=target&&(target.unitId??this.unitAt(target)?.id);
    this.previewTarget=target?.previewBadge&&this.inspected?{unitId:this.inspected,...target.previewBadge}:null;
    this.previewTargets=target?.previewBadges??(this.previewTarget?{[this.previewTarget.unitId]:this.previewTarget}:null);
    this.hoverRing.visible=!!target;if(target){this.hoverRing.position.copy(this.world(target));this.hoverRing.position.y+=.08;}
    this.updateTacticalLinks(target,this.selectedAction);
  }
  setAudio(enabled,volume){this.sound.setEnabled(enabled,volume);campaignSoundscape().configure({audio:enabled,audioVolume:volume});}
  setPaused(value){this.paused=!!value;if(value){this.finishMotion();this.sound.stop();}}
  setMotionSpeed(speed){this.motionSpeed=Number(speed)>1?2:1;if(this.animation)this.animation.scale=Math.min(this.animation.scale,1/this.motionSpeed);}
  setGrid(show){
    // Grid edges drape over plateau banks and lie on river water rather than floating at a cell's centre height.
    if(!this.grid){const lines=[],h=(x,z)=>Math.max(this.environment.groundHeight(x,z),RIVER_WATER_LEVEL)+.04;for(let x=0;x<this.encounter.width;x++)for(let y=0;y<this.encounter.height;y++){const p=this.world({x,y});for(const [a,b,c,d]of [[-1.25,-1.25,1.25,-1.25],[-1.25,-1.25,-1.25,1.25]])for(let k=0;k<8;k++){const x0=p.x+a+(c-a)*k/8,z0=p.z+b+(d-b)*k/8,x1=p.x+a+(c-a)*(k+1)/8,z1=p.z+b+(d-b)*(k+1)/8;lines.push(x0,h(x0,z0),z0,x1,h(x1,z1),z1);}}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(lines,3));this.grid=new T.LineSegments(geometry,new T.LineBasicMaterial({color:'#dfd6b3',transparent:true,opacity:.32,depthWrite:false}));this.scene.add(this.grid);}
    this.grid.visible=!!show;
  }
  applyQuality(quality){const previous=this.quality;this.quality=quality in QUALITY?quality:'balanced';const q=QUALITY[this.quality];this.resolutionBudget?.reset(q.fps);this.cadence?.reset(q.fps);this.gpuTimer?.reset();this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.ratio)*(this.resolutionBudget?.scale??1));if(this.sun.shadow.mapSize.x!==q.shadow){this.sun.shadow.mapSize.set(q.shadow,q.shadow);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}if(previous!==this.quality&&this.environment){this.sceneryOcclusion?.dispose();this.environment.dispose();this.environment=createEnvironment(this.scene,this.encounter,{tileSize:2.5,quality:this.quality,chapter:this.chapter});this.sceneryOcclusion=createSceneryOcclusion(this.environment.group);this.sky.dispose();this.sky=createSky(this.scene,this.profile,{quality:this.quality,reducedMotion:this.reducedMotion});this.lighting.dispose();this.lighting=createSceneLighting(this.renderer,this.scene,this.profile,{quality:this.quality});this.sync(this.encounter);}this.compositor?.setQuality(this.quality);this.resize();}
  updatePixelRatio(){this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,QUALITY[this.quality].ratio)*(this.resolutionBudget?.scale??1));this.resize();}
  setAdaptiveResolution(value){if(this.adaptiveResolution===!!value)return;this.adaptiveResolution=!!value;this.resolutionBudget?.setEnabled(value);}
  // Swapping style rebuilds only the figure presentation; the encounter is untouched.
  setFigureStyle(style){
    const next=FIGURE_STYLES.includes(style)?style:'sculpted';if(next===this.figureStyle||this.disposed)return;
    this.figureStyle=next;for(const a of this.actors.values()){this.scene.remove(a.group);a.dispose();}this.actors.clear();
    this.compositor?.setStyle?.(figureStyleFinish(next));this.sync(this.encounter);this.shadowDirty=true;
  }
  // The painted atlases are the 2D view's own; repaint the cards once decoded.
  loadPaintedArt(){
    if(this.paintedArt)return;
    this.paintedArt=loadTacticalArt(this.encounter).then(()=>{if(this.disposed)return;for(const a of this.actors.values())a.repaint?.();this.shadowDirty=true;}).catch(()=>{});
  }
  setReducedMotion(value){if(this.reducedMotion!==value){this.shadowDirty=true;this.poseReset=new Set(this.actors.keys());}this.reducedMotion=value;if(value)this.finishMotion();}
  overviewDistance(){
    const drill=this.encounter.id==='ch1-training',yaw=this.orbit.yaw??-.55,pitch=this.orbit.pitch??.64;
    const right=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),up=new T.Vector3(-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)),out=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    const tangent=Math.tan(this.camera.fov*Math.PI/360)*.86,points=this.encounter.units.filter(actorVisible).flatMap(unit=>[this.world(unit),this.world(unit).add(new T.Vector3(0,['cavalry','heavy'].includes(unit.role)?3.1:2.55,0))]);
    if(!drill)for(const x of [-.18,this.encounter.width-.82])for(const y of [-.18,this.encounter.height-.82])points.push(this.world({x,y}));
    return Math.max(drill?13:20,...points.map(point=>{const p=point.clone().sub(this.baseTarget);return p.dot(out)+Math.max(Math.abs(p.dot(right))/(tangent*this.camera.aspect),Math.abs(p.dot(up))/tangent);}));
  }
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.viewportWidth=r.width;this.viewportHeight=r.height;this.labelSizeDirty=true;const previous=this.camera.aspect;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.compositor?.resize();if(Math.abs(previous-this.camera.aspect)>.01&&!this.focusMode)this.orbit.distance=Math.max(this.cameraView==='horizon'?28:0,this.overviewDistance());}
  home(){this.focusMode=false;this.cameraView='overview';this.orbit.yaw=this.profile?.staging?.camera.yaw??(this.encounter.kind==='contest'?-.28:-.55);this.orbit.pitch=this.profile?.staging?.camera.pitch??(this.encounter.kind==='contest'?.76:.67);this.baseTarget.set(0,.7,0);if(this.encounter.id==='ch1-training'){const alive=this.encounter.units.filter(isAlive);if(alive.length){const center=alive.reduce((v,u)=>v.add(this.world(u)),new T.Vector3()).divideScalar(alive.length);this.baseTarget.copy(center);this.baseTarget.y+=.5;this.orbit.pitch=.58;}}this.orbit.distance=this.overviewDistance();}
  horizon(){
    // Lift the point of interest, rather than merely flattening an orbit aimed
    // at the ground. The sky occupies the upper third while units remain framed.
    this.focusMode=false;this.cameraView='horizon';this.orbit.yaw=-.55;this.orbit.pitch=.105;
    this.baseTarget.set(0,2.7,0);this.orbit.distance=Math.max(28,this.overviewDistance());
  }
  focusSelected(){const u=this.encounter.units.find(u=>u.id===this.selected);if(u){const position=this.world(u),mounted=['cavalry','heavy'].includes(u.role),view=findFocusCamera(this.environment,{position,mounted});if(!view){this.home();return;}this.focusMode=true;this.cameraView='follow';this.baseTarget.copy(position);this.baseTarget.y+=mounted?1.2:.85;Object.assign(this.orbit,view);}}
  focusPoint(tile){if(!tile||!Number.isFinite(tile.x)||!Number.isFinite(tile.y)){this.home();return;}const pos=this.world(tile);this.focusMode=false;this.baseTarget.set(pos.x,pos.y+.85,pos.z);this.hoverRing.visible=true;this.hoverRing.position.copy(pos);this.hoverRing.position.y+=.08;}
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
    on(this.canvas,'pointerdown',e=>{this.sound.unlock();campaignSoundscape().unlock();this.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};this.canvas.setPointerCapture(e.pointerId);});
    on(this.canvas,'pointermove',e=>{if(this.drag){const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>7)this.drag.moved=true;if(this.drag.moved){this.orbit.yaw-=dx*.006;this.orbit.pitch=clamp(this.orbit.pitch+dy*.004,.04,1.15);}this.drag.lastX=e.clientX;this.drag.lastY=e.clientY;}else this.pendingHover={clientX:e.clientX,clientY:e.clientY};});
    on(this.canvas,'pointerleave',()=>{this.pendingHover=null;this.hovered=null;this.onHover(null);});
    on(this.canvas,'pointerup',e=>{if(this.drag&&!this.drag.moved){if(this.animation)this.animation.scale=Math.min(this.animation.scale,.42);else this.onPick(this.pick(e));}this.drag=null;});on(this.canvas,'pointercancel',()=>this.drag=null);
    on(this.canvas,'wheel',e=>{e.preventDefault();this.zoom(e.deltaY*.022);},{passive:false});
    on(this.canvas,'keydown',e=>{this.sound.unlock();campaignSoundscape().unlock();if(this.keyboardMode==='grid'&&e.key.startsWith('Arrow'))return;let handled=true;switch(e.key){case'ArrowLeft':this.orbit.yaw-=this.figureStyle==='painted'?Math.PI/2:.12;break;case'ArrowRight':this.orbit.yaw+=this.figureStyle==='painted'?Math.PI/2:.12;break;case'ArrowUp':this.orbit.pitch=clamp(this.orbit.pitch+.08,.04,1.15);break;case'ArrowDown':this.orbit.pitch=clamp(this.orbit.pitch-.08,.04,1.15);break;case'+':case'=':this.zoom(-2);break;case'-':this.zoom(2);break;case'Home':this.home();break;case'h':case'H':this.horizon();break;case'f':case'F':this.focusSelected();break;case' ':if(this.animation)this.animation.scale=Math.min(this.animation.scale,.42);else handled=false;break;default:handled=false;}if(handled)e.preventDefault();});
    on(document,'visibilitychange',()=>{if(document.hidden)this.finishMotion();});
    on(this.canvas,'webglcontextlost',e=>{e.preventDefault();this.finishMotion();this.contextLost=true;clearTimeout(this.restoreTimer);this.restoreTimer=setTimeout(()=>{if(this.contextLost&&!this.disposed)this.onError?.('The 3D graphics context was interrupted.');},5000);});
    on(this.canvas,'webglcontextrestored',()=>{clearTimeout(this.restoreTimer);this.restoreTimer=null;this.contextLost=false;this.shadowDirty=true;this.labelSizeDirty=true;this.poseReset=new Set(this.actors.keys());this.compositor?.resize();this.cadence?.reset(QUALITY[this.quality].fps);});
  }
  play(before,after,command){this.finishMotion();this.sync(after);if((before?.operation?.index??0)<(after?.operation?.index??0)&&!this.focusMode&&this.cameraView==='overview')this.home?.();if(this.reducedMotion||this.paused||this.contextLost)return Promise.resolve();this.sound.unlock();const timeline=retimeStageTimeline(buildEncounterTimeline(before,after,{command,quality:this.quality}));if(!timeline.duration)return Promise.resolve();
    this.poseReset=new Set(this.actors.keys());this.shadowDirty=true;this.animation={timeline,start:performance.now(),scale:1/(this.motionSpeed||1),cues:combatCues(timeline,{encounter:after}),nextCue:0,releasePoints:new Map()};return new Promise(resolve=>this.animation.resolve=resolve);
  }
  finishMotion(cancelAudio=true){if(!this.animation)return;if(cancelAudio)this.sound?.stop?.();const resolve=this.animation.resolve;this.animation=null;this.projectiles.forEach(p=>p.visible=false);this.sparkClouds.forEach(p=>p.material.opacity=0);this.effectRings.forEach(p=>p.visible=false);this.sync(this.encounter);this.poseReset=new Set(this.actors.keys());resolve?.();}
  tick(now){if(this.disposed)return;this.frame=requestAnimationFrame(t=>this.tick(t));if(document.hidden||this.contextLost||this.paused){this.lastPaint=0;return;}if(!this.cadence.shouldRender(now))return;const sincePaint=this.lastPaint?now-this.lastPaint:0,dt=Math.min(.08,sincePaint/1000||.016);this.lastPaint=now;if(sincePaint&&!this.gpuTimer?.stats().supported)this.resolutionBudget?.recordInterval(sincePaint,this.cadence.expectedMs);this.elapsed+=dt;
    if(this.pendingHover&&!this.drag){const point=this.pick(this.pendingHover);this.pendingHover=null;this.hovered=point?.unitId??null;this.onHover(point);}
    const renderStart=performance.now();let frame=null;
    if(this.animation){const a=this.animation;const elapsed=(now-a.start)/a.scale;frame=sampleEncounterTimeline(a.timeline,elapsed);while(a.nextCue<a.cues.length&&a.cues[a.nextCue].time<=elapsed){const cue=a.cues[a.nextCue++];const tile=cue.at??this.encounter.units.find(u=>u.id===cue.unitId),pan=tile?clamp(this.world(tile).project(this.camera).x,-1,1):0;if(elapsed-cue.time<150&&this.sound.cue(cue.kind,{...cue,pan}))this.cuesPlayed++;}if(frame.complete){this.finishMotion(false);frame=null;}}
    this.environment.update(this.reducedMotion?0:this.elapsed);
    for(const unit of this.visibleUnits){
      const a=this.actors.get(unit.id),o=frame?.unitOverrides[unit.id],position=o??unit;
      a.group.position.copy(this.world(position));const contact=meleeOffset(unit,o,this.animation?.timeline);a.group.position.x+=contact.x;a.group.position.z+=contact.z;a.group.position.y=this.environment.groundHeight(a.group.position.x,a.group.position.z);a.group.visible=actorVisible(unit)||!!o&&o.alpha>0;if(!a.group.visible){this.labels.get(unit.id).hidden=true;continue;}
      const active=unit.id===this.selected||unit.id===this.inspected||unit.id===this.hovered||!!o&&o.pose!=='idle';
      const attack=this.animation?.timeline.tracks.find(t=>t.unitId===unit.id&&t.pose===o?.pose&&t.target),victim=attack&&this.unitAt(attack.target);
      const aimHeight=victim?this.world(victim).y+(['cavalry','heavy'].includes(victim.role)?2.05:1.2):undefined;
      const pose=stageActorPose(unit,frame,this.animation?.timeline,{time:this.elapsed,dt,reducedMotion:this.reducedMotion});
      if(unit.id===this.selected)this.selectedYaw=pose.direction;
      const focusUnit=victim??(unit.id===this.selected&&this.inspected&&this.inspected!==unit.id?this.encounter.units.find(u=>u.id===this.inspected):null);
      let gazeYaw=0,gazePitch=0;
      if(focusUnit){const d=this.world(focusUnit).sub(a.group.position),rel=Math.atan2(Math.sin(Math.atan2(d.x,d.z)-pose.direction),Math.cos(Math.atan2(d.x,d.z)-pose.direction));if(Math.abs(rel)<1.35){gazeYaw=clamp(rel*.45,-.32,.32);gazePitch=clamp(-Math.atan2(d.y,Math.max(.5,Math.hypot(d.x,d.z)))*.35,-.18,.18);}}
      a.update({...pose,unit,override:o??null,gazeYaw,gazePitch,groundHeight:this.environment.groundHeight,aimHeight,detailDistance:this.camera.position.distanceTo(a.group.position),active,resetPose:this.poseReset.has(unit.id)});this.poseReset.delete(unit.id);
      const label=this.labels.get(unit.id),refs=this.labelRefs.get(unit.id),key=`${unit.id===this.selected}:${unit.id===this.inspected||unit.id===this.hovered}`;label.hidden=false;
      if(refs.stateKey!==key){refs.stateKey=key;label.classList.toggle('selected',unit.id===this.selected);label.classList.toggle('inspected',unit.id===this.inspected||unit.id===this.hovered);refs.width=0;this.labelSizeDirty=true;}
      const preview=!this.animation&&(this.previewTargets?.[unit.id]??(this.previewTarget?.unitId===unit.id?this.previewTarget:null));
      if(preview){refs.effect.textContent=preview.text;refs.effect.style.color=preview.color;}else if(refs.effect.textContent)refs.effect.textContent='';
    }
    if(this.tacticalArcs)for(const [i,line]of this.tacticalArcs.entries())if(line.visible)line.material.opacity=this.reducedMotion?.85:(line.userData.linkKind==='guard'?.78+.17*Math.sin(this.elapsed*3.2+i):.75+.2*Math.sin(this.elapsed*4.8+i));
    this.contactShadows.update(this.actors,this.environment.groundHeight);
    const selected=this.actors.get(this.selected);this.selectedRing.visible=!!selected?.group.visible;if(selected){this.selectedRing.position.copy(selected.group.position);this.selectedRing.position.y+=.065;this.selectedRing.rotation.y=this.selectedYaw??0;this.selectedRing.scale.setScalar(selected.group.userData.actor?.mounted?1.45:1);}
    this.projectiles.forEach(p=>p.visible=false);this.sparkClouds.forEach(p=>p.material.opacity=0);this.effectRings.forEach(p=>p.visible=false);let projectileCount=0,sparkCount=0,ringCount=0;
    for(const fx of frame?.effects??[]){const readout=effectReadout(fx);
      if(fx.at&&readout.text){const unit=this.unitAt(fx.at),label=this.labelRefs.get(unit?.id)?.effect;if(label){label.textContent=readout.text;label.style.color=readout.color;}}
      if(readout.ring&&fx.at&&ringCount<6){
        if(!this.effectRings[ringCount]){const ring=new T.Mesh(this.targetGeometry,new T.MeshBasicMaterial({color:readout.color,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;this.effectGroup.add(ring);this.effectRings.push(ring);}
        const ring=this.effectRings[ringCount++];ring.position.copy(this.world(fx.at));ring.position.y+=.09;ring.scale.setScalar(.65+fx.progress*(readout.radius??1.2));ring.material.color.set(readout.color);ring.material.opacity=(1-fx.progress)*.75;ring.visible=true;
      }
      if(fx.type==='projectile'&&projectileCount<4){
      if(!this.projectiles[projectileCount]){const p=this.projectile.clone();this.effectGroup.add(p);this.projectiles.push(p);}const projectile=this.projectiles[projectileCount++];projectile.scale.setScalar(fx.projectile==='arrow'?.52:1);
      const key=`${fx.start}:${fx.from.x}:${fx.from.y}`,origins=this.animation.releasePoints;
      if(!origins.has(key)){const source=this.unitAt(fx.from),actor=this.actors.get(source?.id);origins.set(key,actor?.getReleasePoint(new T.Vector3())??this.world(fx.from).add(new T.Vector3(0,1.4,0)));}
      positionProjectileTip(projectile,origins.get(key),this.bodyPoint(fx.to),fx.progress);projectile.visible=true;
    }else if(['impact','shield'].includes(fx.type)&&!fx.political){
      if(fx.at)this.updateBattleDecals(this.encounter,[fx.at]);
      if(sparkCount>=8)continue;if(!this.sparkClouds[sparkCount]){const cloud=new T.Points(this.sparkGeometry.clone(),this.sparkMaterial.clone());cloud.frustumCulled=false;this.effectGroup.add(cloud);this.sparkClouds.push(cloud);}const cloud=this.sparkClouds[sparkCount++];
      const defender=this.unitAt(fx.at),actor=this.actors.get(defender?.id),anchor=fx.type==='shield'?actor?.contacts.shield:null;
      const p=anchor?.getWorldPosition(new T.Vector3())??actor?.contacts.body?.localToWorld(new T.Vector3(0,.27,.10))??this.bodyPoint(fx.at);sampleImpactParticles(cloud,p,fx.progress,{shield:fx.type==='shield',source:fx.source?this.world(fx.source):undefined});
      if(defender&&fx.delta)this.labelRefs.get(defender.id).effect.textContent=String(fx.delta);
    }}
    if(this.chamberStandards)for(const [bloc,std]of this.chamberStandards)if(std.group.visible&&std.banner)std.banner.rotation.z=this.reducedMotion?0:Math.sin(this.elapsed*2.1+bloc.length)*.035;
    if(this.fieldworkMeshes)for(const group of this.fieldworkMeshes.values())if(group.visible&&group.userData.flamePlume){
      sampleFlamePlume(group.userData.flamePlume,this.elapsed,{reducedMotion:this.reducedMotion});
      if(group.userData.brazierLight)group.userData.brazierLight.intensity=this.reducedMotion?1.85:1.85+.28*Math.sin(this.elapsed*8.5+group.position.x);
    }
    sampleWeatherParticles(this.weatherCloud,this.profile.weather,this.elapsed,{reducedMotion:this.reducedMotion});
    if(this.nightLight){this.nightLight.intensity=this.profile.torchlight?(this.reducedMotion?2.35:2.35+.22*Math.sin(this.elapsed*7.5)):0;if(selected)this.nightLight.position.set(selected.group.position.x,selected.group.position.y+2.8,selected.group.position.z);}
    const target=this.focusMode&&selected?selected.group.position.clone().add(new T.Vector3(0,selected.group.userData.actor?.mounted?1.2:.85,0)):this.baseTarget.clone();
    if(this.animation&&!this.focusMode&&this.cameraView==='overview'&&!this.reducedMotion){const elapsed=(now-this.animation.start)/this.animation.scale,activeTrack=this.animation.timeline.tracks.find(t=>elapsed>=t.start&&elapsed<=t.end&&(t.target||t.from));if(activeTrack){const focusTile=activeTrack.target??activeTrack.from;if(focusTile)target.lerp(this.world(focusTile).add(new T.Vector3(0,.85,0)),.18);}}
    if(this.figureStyle==='painted'&&!this.drag&&this.cameraView==='overview'){const goal=diagonalYaw(this.orbit.yaw);this.orbit.yaw+=(goal-this.orbit.yaw)*(this.reducedMotion?1:Math.min(1,dt*5));}
    this.lookTarget.lerp(target,this.reducedMotion?1:Math.min(1,dt*3));const {yaw,pitch,distance}=this.orbit;this.camera.position.set(this.lookTarget.x+Math.sin(yaw)*Math.cos(pitch)*distance,this.lookTarget.y+Math.sin(pitch)*distance,this.lookTarget.z+Math.cos(yaw)*Math.cos(pitch)*distance);this.camera.position.y=Math.max(this.camera.position.y,this.environment.cameraGroundHeight(this.camera.position.x,this.camera.position.z)+.9);this.camera.lookAt(this.lookTarget);this.camera.updateMatrixWorld();this.sky.update(this.elapsed,this.camera,this.reducedMotion);this.fitShadow();
    // Painted cards face the camera only after it has moved this frame.
    const sunYaw=Math.atan2(this.sunOffset.x,this.sunOffset.z);for(const a of this.actors.values())if(a.group.visible)a.faceCamera?.(this.camera,{sunYaw});this.compositor?.setFocus?.(this.camera.position.distanceTo(this.lookTarget));
    // Aerial haze starts past the board's far corner from this camera (half-diagonal ~14m).
    const focusDistance=this.camera.position.distanceTo(this.lookTarget);this.compositor?.setHaze?.({near:focusDistance+14,far:focusDistance+140,color:this.profile.grade?.haze});
    // Scene fog likewise begins past the board (sooner in mist and rain), so the
    // playable ground keeps its contrast while the surrounding land recedes.
    const misty=['mist','rain'].includes(this.profile.weather),fog=this.scene.fog;fog.near=focusDistance+(misty?6:12);fog.far=fog.near+(misty?1.4:2)/(this.profile.fogDensity??.017);
    this.rimDirection.copy(this.lookTarget).sub(this.camera.position).setY(0);if(this.rimDirection.lengthSq()>1e-6){this.rimDirection.normalize();this.rim.position.copy(this.lookTarget).addScaledVector(this.rimDirection,14);this.rim.position.y+=7;this.rim.target.position.copy(this.lookTarget);this.rim.target.updateMatrixWorld();}
    const cutawayUnits=[selected,this.actors.get(this.inspected)].filter((actor,index,list)=>actor?.group.visible&&list.indexOf(actor)===index);
    this.sceneryOcclusion?.update(this.camera,{targets:cutawayUnits.map(actor=>({position:actor.group.position.clone().add(new T.Vector3(0,actor.group.userData.actor?.mounted?1.8:1.1,0)),radius:actor.group.userData.actor?.mounted?1.7:1.35})),enabled:this.cameraView!=='overview'||!!this.animation,delta:dt,reducedMotion:this.reducedMotion});
    this.positionLabels();
    const shadowInterval=this.quality==='high'?70:100;
    if(this.shadowDirty||this.animation||!this.reducedMotion&&now-this.lastShadow>=shadowInterval){this.renderer.shadowMap.needsUpdate=true;this.shadowDirty=false;this.lastShadow=now;this.shadowUpdates++;}
    for(const gpuMs of this.gpuTimer?.poll()??[])this.resolutionBudget?.record(gpuMs);
    this.gpuTimer?.begin();
    try{if(this.compositor)this.compositor.render(this.scene);else this.renderer.render(this.scene,this.camera);}finally{this.gpuTimer?.end();}
    const cost=performance.now()-renderStart;this.samples.push(cost);this.renderCounts.push(this.renderer.info.render.calls);if(this.samples.length>120)this.samples.shift();if(this.renderCounts.length>120)this.renderCounts.shift();this.onFrame(cost);if(now-(this.lastStats||0)>1000){this.lastStats=now;this.canvas.dataset.renderStats=JSON.stringify(this.stats());}
  }
  // Fit the sun's shadow box to what the camera can see: close views gain
  // texel density, the overview keeps the whole board and nearby casters.
  fitShadow(){
    const half=Math.round(clamp(this.orbit.distance*.55+3,9,23)),x=Math.round(this.lookTarget.x*2)/2,z=Math.round(this.lookTarget.z*2)/2,fit=this.shadowFit;
    if(Math.abs(fit.half-half)<1&&Math.hypot(fit.x-x,fit.z-z)<1.5)return;
    fit.half=half;fit.x=x;fit.z=z;const camera=this.sun.shadow.camera;Object.assign(camera,{left:-half,right:half,top:half,bottom:-half});camera.updateProjectionMatrix();
    this.sun.target.position.set(x,0,z);this.sun.position.set(x+this.sunOffset.x,this.sunOffset.y,z+this.sunOffset.z);this.sun.target.updateMatrixWorld();this.shadowDirty=true;
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
    const obstacles=[],body=this.actors.get(this.selected);
    if(body?.group.visible&&(this.cameraView!=='overview'||this.animation)){
      const base=body.group.position,radius=body.group.userData.actor?.mounted?.72:.38,bodyHeight=body.group.userData.actor?.height??2.03,points=[];
      for(const x of [-radius,radius])for(const z of [-radius,radius])for(const y of [.05,bodyHeight]){const p=this.screenPoint.copy(base).add(new T.Vector3(x,y,z)).project(this.camera);if(p.z>=-1&&p.z<=1)points.push({x:(p.x*.5+.5)*width,y:(-p.y*.5+.5)*height});}
      if(points.length===8){const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));obstacles.push({id:this.selected,x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y});}
    }
    const layout=layoutStageLabels(items,{width,height,top:this.canvas.parentElement.classList.contains('world-stage')?92:8,obstacles}),counts={visible:0,occluded:0,offscreen:0,overlaps:0};
    for(const [id,r]of layout){const {label,leader}=elements.get(id);label.dataset.layout=r.reason;counts[r.reason]++;label.style.visibility=r.visible?'visible':'hidden';
      if(!r.visible)continue;label.style.transform=`translate(${r.x}px,${r.y}px)`;
      if(leader){const dx=r.anchorX-(r.x+r.width/2),dy=r.anchorY-(r.y+r.height),length=Math.hypot(dx,dy);leader.style.width=`${length}px`;leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;leader.style.display=length>15?'block':'none';}
    }
    this.labelStats=counts;this.labelSizeDirty=false;
  }
  stats(){return {cuesPlayed:this.cuesPlayed,renderMs:this.samples.reduce((a,b)=>a+b,0)/Math.max(1,this.samples.length),samples:this.samples.length,calls:this.renderer.info.render.calls,callsMean:this.renderCounts.reduce((a,b)=>a+b,0)/Math.max(1,this.renderCounts.length),callsMax:Math.max(0,...this.renderCounts),shadowUpdates:this.shadowUpdates,labels:{...this.labelStats},triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,geometries:this.renderer.info.memory.geometries,quality:this.quality,cameraView:this.cameraView,actorAssets:actorAssetStatus(),gpu:this.gpuTimer?.stats(),resolution:this.resolutionBudget?.stats(),occlusion:this.sceneryOcclusion?.stats(),compositor:this.compositor?.stats(),figureStyle:this.figureStyle,lighting:this.lighting.stats(),contactShadows:this.contactShadows.stats(),sky:this.sky.stats(),horizon:this.environment.horizon.stats};}
  dispose(){if(this.disposed)return;this.disposed=true;this.sound.dispose();this.finishMotion();cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.events.forEach(fn=>fn());this.actors.forEach(a=>a.dispose());this.sceneryOcclusion?.dispose();this.gpuTimer?.dispose();this.environment.dispose();this.sky.dispose();this.lighting.dispose();this.compositor?.dispose();this.contactShadows.dispose();this.particleMask.dispose();this.labelLayer.remove();clearTimeout(this.restoreTimer);const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.sun.shadow?.dispose?.();this.renderer.dispose();
    // A discarded canvas releases its context now instead of waiting for GC; a
    // canvas that stays in the page (a reused host) keeps its context.
    if(!this.canvas.isConnected)this.renderer.forceContextLoss?.();}
}
