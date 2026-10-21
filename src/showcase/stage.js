import {createBattlefieldFeatures} from './battlefield-features.js';
import {renderDeviceReport} from './device-report.js';
import {applyPairedContacts} from './paired-contact.js';
import {createFrameProfile} from './frame-profile.js';
import * as T from '../../vendor/three/three.module.js';
import {createSceneryOcclusion} from './environment-occlusion.js';
import {createFrameCadence,createGpuTimer,createResolutionBudget} from './frame-budget.js';
import {createPaintedLighting,paintedLight} from './painted-actor.js';
import {followerCount} from './formation.js';
import {createBattleRemains} from './battle-remains.js';
import {createSceneryModels} from './scenery-models.js';
import {createCombatEffects} from './combat-effects.js';
import {CLOUD_UNIFORMS,cloudStrength,cloudWind,createLightShafts,installCloudShadows} from './atmosphere.js';
import {installBakedOcclusion} from './environment-baked-occlusion.js';
import {createWaterReflection,reflectionAvailable} from './water-reflection.js';
import {FIGURE_STYLES} from '../ui/graphics-quality.js';
import {actorAssetStatus} from './actor-assets.js';
import {warmActorMaterials} from './actor-materials.js';
import {campaignSoundscape} from '../ui/soundscape.js';
import {buildEnvironment,createEnvironment,gridToWorld} from './environment.js';
import {runSliced,runSteps} from './build-steps.js';
import {terrainAt} from './environment-layout.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../ui/animation-timeline.js';
import {facingYaw,isAlive} from './session.js';
import {createBattleSound} from './battle-sound.js';
import {meleeOffset,combatCues,retimeStageTimeline,locomotionPhase,combatReaction} from './combat-presentation.js';
import {getSceneProfile} from './campaign-scene-profile.js';
import {actorVisible,civicActor,effectReadout,missionReadouts} from './stage-readout.js';
import {createInkOverlay} from './ink-overlay.js';
import {createSky} from './sky.js';
import {createSceneLighting} from './scene-lighting.js';
import {createSceneCompositor} from './scene-compositor.js';
import {createContactShadows} from './contact-shadows.js';
import {createParticleMask,sampleImpactParticles,createWeatherField,sampleWeatherParticles,sampleFlamePlume} from './stage-particles.js';
export {preloadBattleFigures} from './stage-preload.js';
import {stageInput} from './stage-input.js';
export {intersectGround,rayToUpright} from './stage-input.js';
import {stageCamera,sideOnYaw,actionFraming,diagonalYaw} from './stage-camera.js';
import {stageLabels,labelRole,namedFigure} from './stage-labels.js';
import {stageFigures,figureStyleFinish,voterPosture} from './stage-figures.js';
import {stagePreparation} from './stage-preparation.js';
import {stageOverlays} from './stage-overlays.js';
export {sideOnYaw,actionFraming,diagonalYaw,labelRole,namedFigure,figureStyleFinish,voterPosture};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>t*t*(3-2*t);
// Quiet (half-rate) drawing begins this long after the last input or change.
const QUIET_AFTER_MS=1200;
// Frame targets divide common refresh rates; see createFrameCadence.
const QUALITY={performance:{ratio:1,shadow:1024,fps:30},balanced:{ratio:1.5,shadow:2048,fps:60},high:{ratio:2,shadow:4096,fps:60}};
// Between motions the shadow map follows breathing and cloth only this often.
const SHADOW_REFRESH_MS={performance:250,balanced:125,high:70};
// The resolution budget's floor, and how many late frames there make a battle strained.
const STRAIN_SCALE=.66,STRAINED_FRAMES=180;
// Presentation styles for the figures (FIGURE_STYLES). Painted stands the 2D
// campaign's own figure paintings in the diorama (HD-2D) with a tilt-shift
// finish; inked keeps sculpted figures with ink outlines and washes.
export {FIGURE_STYLES};
// The poses whose exchange the action camera frames (actionFraming).
const ACTION_POSES=new Set(['attack','cavalry-attack','throw']);
// The division (discessio): once the rules have decided a Senate vote, each
// delegate walks to stand behind the champion of the side the rules counted
// him on, as the Senate voted. Deterministic arcs, clamped to the chamber.
export function discessioPlan(encounter){
  if(encounter?.kind!=='contest'||!['won','lost'].includes(encounter.status))return null;
  const units=(encounter.units??[]).filter(u=>!u.hidden),voters=units.filter(u=>u.role==='voter'),w=encounter.width??8,h=encounter.height??8;
  const aye=u=>u.vote==='for'||u.vote!=='against'&&(Number(u.stance)||0)>=1;
  const champions={for:units.find(u=>u.id==='hero')??units.find(u=>['player','ally'].includes(u.side)&&u.role==='speaker'),
    against:units.find(u=>u.side==='enemy'&&u.role==='speaker')};
  const moves=[],centre={x:(w-1)/2,y:(h-1)/2};
  for(const side of ['for','against']){
    const c=champions[side]??{x:side==='for'?1:w-2,y:centre.y},away=Math.atan2(c.y-centre.y,c.x-centre.x)||(side==='for'?Math.PI:0);
    voters.filter(u=>side==='for'?aye(u):!aye(u)).forEach((u,i)=>{
      const ring=Math.floor(i/5),slot=i%5,angle=away+(slot-2)*.55+(ring%2)*.27,r=1.05+ring*.62;
      moves.push({unitId:u.id,side,from:{x:u.x,y:u.y},to:{x:clamp(c.x+Math.cos(angle)*r,0,w-1),y:clamp(c.y+Math.sin(angle)*r,0,h-1)},face:{x:c.x,y:c.y},order:i});
    });
  }
  return {key:`${encounter.id}:${encounter.turn}:${encounter.status}`,moves};
}
const blendYaw=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*ease(clamp(t,0,1));
const pathYaw=(a,b)=>Math.atan2(b.x-a.x,b.y-a.y);

// The authored release anchor and impact point describe the missile tip, not
// its mesh origin. Preserve those endpoints through either projectile scale.
export function positionProjectileTip(projectile,from,to,progress){
  const t=clamp(progress,0,1),tip=from.clone().lerp(to,t),direction=to.clone().sub(from);tip.y+=Math.sin(t*Math.PI)*1.8;
  direction.y+=Math.cos(t*Math.PI)*Math.PI*1.8;direction.normalize();
  projectile.position.copy(tip);projectile.lookAt(tip.clone().add(direction));projectile.position.addScaledVector(direction,-1.01*projectile.scale.z);
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
  if(motion==='turn')motion=unit.braced?'brace':'turn';
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
  const health=motion==='withdrawn'?1
    :!isAlive(unit)&&o&&o.alpha>0?(prior.resolve??prior.hp??1)/(prior.maxResolve??prior.maxHp??1)
    :(unit.resolve??unit.hp??1)/(unit.maxResolve??unit.maxHp??1);
  return {time:reducedMotion?0:time,dt,motion,reducedMotion,locomotionDistance,movementProgress:o?.progress,
    turnSign:Math.sign(Math.sin(facingYaw(o?.facing??unit.facing)-facingYaw(o?.previousFacing??unit.facing)))||1,braced:unit.braced||pair?.before.braced,
    locomotionWeight:['walk','run'].includes(motion)?Math.min(1,(o?.progress??1)/.12,(1-(o?.progress??0))/.12):1,
    phase:motion==='brace'&&o?.pose!=='brace'?.45:phase,direction,health,selected:false,...combatReaction(unit,frame,timeline,direction)};
}
export class BattleStage{
  // A stage made in short steps behind the veil (build-steps.js), so the page
  // keeps answering while its world is built. Resolves to null when current()
  // turns false first; whatever was built by then is released.
  static async create(canvas,encounter,options={},{current=()=>true}={}){
    const stage=new BattleStage(canvas,encounter,{...options,deferBuild:true});
    await runSliced(stage.build(canvas,encounter,options),{current});
    if(!stage.built){stage.releasePartial();return null;}
    if(!current()){stage.dispose();return null;}
    return stage;
  }
  // Built at once (the standalone study and tests), unless create() builds it.
  constructor(canvas,encounter,options={}){
    if(!options.deferBuild)runSteps(this.build(canvas,encounter,options));
  }
  *build(canvas,encounter,
    {onPick=()=>{},onHover=()=>{},quality='balanced',adaptiveResolution=true,reducedMotion=false,motionSpeed=1,keyboardMode='orbit',onFrame=()=>{},chapter,rank,
      stratagem,weather,timeOfDay,commendations,figureStyle='sculpted',ceremony=null,battleRemains=true,debugShaders=false,input=true}={}){
    try{
    this.chapter=chapter??Number(/^ch(\d+)/.exec(encounter.id)?.[1]??1);this.rank=rank;this.stratagem=stratagem??encounter.stratagem??null;
    this.commendations=commendations??{};
    this.profile=getSceneProfile(encounter,
      {chapter:this.chapter,stratagem:this.stratagem,weather:weather??encounter.weather,timeOfDay:timeOfDay??encounter.timeOfDay});
    // input:false leaves the pointer and keys to the page (the real-time arena binds its own).
    this.keyboardMode=keyboardMode;this.inputEnabled=input!==false;this.onFrame=onFrame;this.samples=[];this.paused=false;this.canvas=canvas;
    this.encounter=encounter;this.onPick=onPick;
    this.onHover=onHover;this.quality=quality;this.reducedMotion=reducedMotion;this.motionSpeed=Number(motionSpeed)>1?2:1;
    this.figureStyle=FIGURE_STYLES.includes(figureStyle)?figureStyle:'sculpted';this.ceremony=ceremony;this.paintedLight=paintedLight(this.profile);
    this.paintedLighting=createPaintedLighting();this.actors=new Map();this.labels=new Map();this.selected='hero';this.targets=[];this.lastPaint=0;
    this.elapsed=0;this.disposed=false;
    // Balanced and High draw into the compositor's multisampled target, so a
    // multisampled canvas under it would only resolve one full-screen triangle.
    this.renderer=new T.WebGLRenderer({canvas,antialias:quality==='performance',alpha:false,powerPreference:'high-performance'});
    // Checking each program's link status on first use waits for the driver to
    // finish compiling it; programs are compiled ahead instead (prepare). Shader
    // diagnostics stay available for development: ?debug=shaders.
    this.renderer.debug.checkShaderErrors=!!debugShaders||/[?&]debug=shaders(&|$)/.test(globalThis.location?.search??'');
    yield;
    this.sound=createBattleSound({recordedCue:(kind,options)=>campaignSoundscape().cue(kind,options),stopRecordings:()=>campaignSoundscape().stopEffects()});
    this.cuesPlayed=0;
    this.deviceReport=renderDeviceReport(this.renderer.getContext());this.gpuTimer=createGpuTimer(this.renderer.getContext());
    this.adaptiveResolution=adaptiveResolution;
    this.resolutionBudget=createResolutionBudget({fps:QUALITY[quality]?.fps??60,enabled:adaptiveResolution,onChange:()=>this.updatePixelRatio()});
    this.cadence=createFrameCadence({fps:QUALITY[quality]?.fps??60});
    this.materialReady=warmActorMaterials().then(ready=>{
      if(!this.disposed){this.shadowDirty=true;this.canvas.dataset.materials=ready?'atlas':'fallback';}return ready;
    });
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=this.profile.exposure??1.05;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.shadowMap.autoUpdate=false;this.shadowDirty=true;
    this.shadowUpdates=0;this.lastShadow=-Infinity;this.renderCounts=[];
    this.labelRefs=new Map();this.labelStats={visible:0,occluded:0,offscreen:0,overlaps:0};this.poseReset=new Set();this.visibleUnits=[];
    this.labelSizeDirty=true;this.screenPoint=new T.Vector3();this.matrix=new T.Matrix4();
    this.scene=new T.Scene();this.scene.background=new T.Color(this.profile.sky);this.scene.fog=new T.Fog(this.profile.fog,40,200);
    this.camera=new T.PerspectiveCamera(40,1,.1,800);this.orbit={yaw:-.55,pitch:.64,distance:27,target:new T.Vector3(0,0,0)};
    this.lookTarget=new T.Vector3(0,.25,0);this.baseTarget=new T.Vector3(0,.25,0);this.cameraKick=0;this.cameraView='overview';
    this.sky=createSky(this.scene,this.profile,{quality,reducedMotion});yield;
    this.lighting=createSceneLighting(this.renderer,this.scene,this.profile,{quality});yield;
    this.contactShadows=createContactShadows(this.scene);
    const balance=this.profile.grade??{},
      sky=new T.HemisphereLight(this.profile.ambient,this.profile.ambientGround??'#61533b',this.profile.ambientIntensity*.72*(balance.ambient??1));
    this.scene.add(sky);
    this.sun=new T.DirectionalLight(this.profile.sun,this.profile.sunIntensity*(balance.sun??1));
    this.sun.position.fromArray(this.profile.sunPosition??[-16,24,-12]);this.sun.castShadow=true;
    Object.assign(this.sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:80});this.sun.shadow.normalBias=.012;this.sun.shadow.bias=-.00008;
    this.sun.shadow.radius=3;this.scene.add(this.sun);this.scene.add(this.sun.target);this.sunOffset=this.sun.position.clone();this.shadowFit={x:0,z:0,half:23};
    // A back light kept behind the subject, facing the camera, separates figures from the ground.
    this.rim=new T.DirectionalLight(balance.rim??'#b9d8e9',balance.rimIntensity??.38);
    this.rim.position.set(15,6,9);this.scene.add(this.rim);this.scene.add(this.rim.target);this.rimDirection=new T.Vector3();
    this.environment=yield* buildEnvironment(this.scene,encounter,{tileSize:2.5,quality,chapter:this.chapter});yield;
    this.rebuildSceneryModels();yield;
    this.rebuildFieldFeatures();this.fieldFeatures.sync(encounter);yield;
    this.surfaceHeight=(x,z)=>this.fieldFeatures.surfaceHeight(x,z)??this.environment.groundHeight(x,z);this.frameProfile=createFrameProfile();
    this.profileFrames=0;
    this.ink=createInkOverlay(this.scene,encounter,this.surfaceHeight,{throttle:true});yield;
    this.sceneryOcclusion=createSceneryOcclusion(this.environment.group,this.sceneryModels?.group,this.fieldFeatures?.group);yield;
    this.battleRemains=battleRemains!==false;this.rebuildRemains();yield;
    this.overlay=new T.Group();this.scene.add(this.overlay);this.effectGroup=new T.Group();this.scene.add(this.effectGroup);
    this.ringGeometry=new T.RingGeometry(.78,.83,48);this.targetGeometry=new T.RingGeometry(.63,.7,40);
    // Overlays are flat (or additive) and draw in one pass: three otherwise draws
    // a two-sided transparent surface twice, back faces first, with a program for each.
    this.targetMaterial=new T.MeshBasicMaterial({color:'#89cfcb',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});
    this.legalTargets=new T.InstancedMesh(this.targetGeometry,this.targetMaterial,Math.max(64,encounter.width*encounter.height));this.legalTargets.count=0;
    this.legalTargets.frustumCulled=false;this.overlay.add(this.legalTargets);
    this.selectionMaterial=new T.MeshBasicMaterial({color:'#edcf7c',transparent:true,opacity:.95,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});
    this.hoverMaterial=new T.MeshBasicMaterial({color:'#fff2c1',transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});
    this.selectedRing=new T.Mesh(this.ringGeometry,this.selectionMaterial);this.selectedRing.rotation.order='YXZ';this.selectedRing.rotation.x=-Math.PI/2;
    this.facingChevron=new T.Mesh(new T.CircleGeometry(.13,3),this.selectionMaterial);this.facingChevron.position.set(0,-.92,0);
    this.facingChevron.rotation.z=-Math.PI/2;this.selectedRing.add(this.facingChevron);
    this.overlay.add(this.selectedRing);
    this.hoverRing=new T.Mesh(this.targetGeometry,this.hoverMaterial);this.hoverRing.rotation.x=-Math.PI/2;this.hoverRing.visible=false;
    this.overlay.add(this.hoverRing);
    this.goalMarker=new T.Mesh(new T.RingGeometry(.96,1.02,48),
      new T.MeshBasicMaterial({color:'#edcf7c',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide,forceSinglePass:true}));
    this.goalMarker.rotation.x=-Math.PI/2;this.overlay.add(this.goalMarker);yield;
    this.effectRings=[];this.missionMarkers=new Map();this.chamberStandards=new Map();this.hovered=null;this.canvas.dataset.scene=this.profile.key;
    this.canvas.dataset.chapter=String(this.chapter);this.canvas.dataset.kind=encounter.kind;this.canvas.dataset.weather=this.profile.weather;
    this.canvas.dataset.timeOfDay=this.profile.timeOfDay;
    this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.hit=new T.Vector3();
    this.labelLayer=document.createElement('div');this.labelLayer.className='world-labels';this.labelLayer.setAttribute('aria-hidden','true');this.labelLayer.setAttribute('data-live','');
    canvas.parentElement.append(this.labelLayer);if(this.ceremony)this.labelLayer.hidden=true;
    this.projectile=new T.Group();const shaft=new T.Mesh(new T.CylinderGeometry(.025,.025,1.45,8),new T.MeshStandardMaterial({color:'#7d4e24',roughness:.85}));
    shaft.rotation.x=Math.PI/2;const tip=new T.Mesh(new T.ConeGeometry(.075,.32,6),new T.MeshStandardMaterial({color:'#afb3b1',metalness:.8,roughness:.35}));
    tip.rotation.x=Math.PI/2;tip.position.z=.85;
    const trail=new T.Mesh(new T.ConeGeometry(.045,1.35,8,1,true),
      new T.MeshBasicMaterial({color:'#f5e4bc',transparent:true,opacity:.34,depthWrite:false,side:T.DoubleSide,forceSinglePass:true}));
    trail.name='projectile-trail';trail.rotation.x=-Math.PI/2;trail.position.z=-.55;this.projectile.add(shaft,tip,trail);this.effectGroup.add(this.projectile);
    this.projectile.visible=false;yield;
    this.particleMask=createParticleMask();const count=24,positions=new Float32Array(count*3);this.sparkGeometry=new T.BufferGeometry();
    this.sparkGeometry.setAttribute('position',new T.BufferAttribute(positions,3));
    this.sparkMaterial=new T.PointsMaterial({map:this.particleMask,alphaTest:.015,color:'#ffe4a1',size:.065,transparent:true,opacity:0,depthWrite:false,
      blending:T.AdditiveBlending});
    this.sparks=new T.Points(this.sparkGeometry,this.sparkMaterial);this.sparks.frustumCulled=false;this.effectGroup.add(this.sparks);
    this.projectiles=[this.projectile];this.sparkClouds=[this.sparks];
    this.combat=createCombatEffects(this.scene,{particleMask:this.particleMask,quality});this.dustDebt=new Map();
    this.weatherCloud=createWeatherField(this.particleMask);this.effectGroup.add(this.weatherCloud);
    sampleWeatherParticles(this.weatherCloud,this.profile.weather,0,{reducedMotion:this.reducedMotion});yield;
    this.nightLight=new T.PointLight('#ffad5c',this.profile.torchlight?2.4:0,16,1.6);this.nightLight.position.set(0,3.2,0);
    this.effectGroup.add(this.nightLight);
    this.rebuildAtmosphere();yield;
    this.compositor=createSceneCompositor(this.renderer,this.camera,{quality});this.compositor.setGrade?.(this.profile.grade??{});
    this.compositor.setStyle?.(figureStyleFinish(this.figureStyle));yield;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.applyQuality(quality);this.figureQueue=new Set();
    this.sync(encounter);this.bind();this.resize();this.frame=requestAnimationFrame(t=>this.tick(t));
    this.ready=this.prepare();this.built=true;
    }catch(error){this.releasePartial();throw error;}
  }
  // A constructor failure must not strand the overlay, renderer, observer or audio.
  releasePartial(){
    this.disposed=true;try{this.sound?.dispose?.();}catch{}this.resizeObserver?.disconnect();this.events?.forEach(fn=>fn());this.labelLayer?.remove();
    try{this.renderer?.dispose();if(this.canvas&&!this.canvas.isConnected)this.renderer?.forceContextLoss?.();}catch{}
  }
  world(tile){const p=gridToWorld(tile,this.encounter,2.5);return new T.Vector3(p.x,this.surfaceHeight?.(p.x,p.z)??this.environment.groundHeight(p.x,p.z),p.z);}
  unitAt(tile){
    if(!tile)return undefined;
    const matches=u=>u.x===tile.x&&u.y===tile.y,prior=this.animation?.timeline.units;
    // Defeated tokens stay in the encounter. A reinforcement can reuse their
    // cell; only the current occupant or this animation's dying victim owns it.
    return this.visibleUnits.find(u=>matches(u)&&isAlive(u))??this.visibleUnits.find(u=>matches(u)&&prior?.[u.id]?.before&&isAlive(prior[u.id].before));
  }
  bodyPoint(tile){const unit=this.unitAt(tile);return this.world(tile).add(new T.Vector3(0,['cavalry','heavy'].includes(unit?.role)?2.05:1.2,0));}
  sync(encounter){
    this.wake();
    const division=discessioPlan(encounter);
    if(!division)this.discessio=null;else if(this.discessio?.key!==division.key){
      const start=performance.now(),span=Math.max(0,...division.moves.map(m=>m.order*220+this.world(m.from).distanceTo(this.world(m.to))/1.35*1000));
      this.discessio={...division,start,end:start+span,byUnit:new Map(division.moves.map(m=>[m.unitId,m]))};
    }
    this.encounter=encounter;if(this.fieldFeatures?.sync(encounter)){this.redrapeGroundOverlays();this.sceneryOcclusion?.add(this.fieldFeatures.group);}
    this.visibleUnits=encounter.units.filter(u=>!u.hidden);const visible=new Set(this.visibleUnits.map(u=>u.id));this.shadowDirty=true;this.labelSizeDirty=true;
    for(const [id,a] of this.actors)if(!visible.has(id)){
      this.scene.remove(a.group);a.dispose();this.actors.delete(id);this.labels.get(id)?.remove();this.labels.delete(id);this.labelRefs.delete(id);
      this.poseReset.delete(id);
    }
    this.labelLayer.dataset.dense=String(visible.size>9);
    for(const u of this.visibleUnits){
      // While the stage is first built, new figures wait for prepare(); the rest of their sync waits too.
      const actor=this.syncFigure(u,encounter);if(!actor)continue;
      this.syncLabel(u,encounter);
      const point=this.world(u);if(actor.group.position.distanceTo(point)>.25)this.poseReset.add(u.id);actor.group.position.copy(point);
      actor.group.visible=actorVisible(u);
    }
    this.goalMarker.visible=false;
    const marks=missionReadouts(encounter),wanted=new Set(marks.map(mark=>mark.id));
    for(const [id,marker] of this.missionMarkers)if(!wanted.has(id)){
      this.overlay.remove(marker.mesh);marker.mesh.material.dispose();marker.label.remove();this.missionMarkers.delete(id);
    }
    for(const mark of marks){
      if(!this.missionMarkers.has(mark.id)){
        const mesh=new T.Mesh(this.goalMarker.geometry,this.goalMarker.material.clone());mesh.rotation.x=-Math.PI/2;this.overlay.add(mesh);
        const label=document.createElement('span');label.className='world-objective';this.labelLayer.append(label);
        this.missionMarkers.set(mark.id,{mesh,label});
      }
      const marker=this.missionMarkers.get(mark.id);marker.mesh.position.copy(this.world(mark));marker.mesh.position.y+=.07;
      marker.mesh.scale.setScalar(['high','hill'].includes(terrainAt(encounter,mark.x,mark.y))?.85:1);
      marker.mesh.material.color.set(mark.tone==='warning'?'#df9d85':mark.tone==='secured'?'#b0d0a1':'#edcf7c');marker.label.textContent=mark.label;
      marker.label.dataset.tone=mark.tone;
    }
    this.updateChamberStandards(encounter);
    this.updateFieldworks(encounter);
    this.updateBattleDecals(encounter);
    this.updateInk();
    this.updateMoraleRings(encounter);
    this.updateReinforcementBeacons(encounter);
    this.updateTacticalLinks();
  }
  wake(){this.wokeAt=performance.now();}
  // Real time: `source` steps the world before each frame and poses every figure from it (live-figures.js).
  setLive(source){this.live=source??null;this.wake();}
  setAudio(enabled,volume){this.sound.setEnabled(enabled,volume);campaignSoundscape().configure({audio:enabled,audioVolume:volume});}
  setPaused(value){this.paused=!!value;if(value){this.finishMotion();this.sound.stop();}}
  setMotionSpeed(speed){this.motionSpeed=Number(speed)>1?2:1;if(this.animation)this.animation.scale=Math.min(this.animation.scale,1/this.motionSpeed);}
  rebuildFieldFeatures(){
    // Field objects stand in the scenery's light: cloud shadows and its baked
    // occlusion, and (sync) its camera cutaway. They then share its shaders.
    const finish=material=>{installCloudShadows(material);const baked=this.environment?.occlusion?.uniforms;if(baked)installBakedOcclusion(material,baked);};
    this.fieldFeatures?.dispose();
    this.fieldFeatures=createBattlefieldFeatures(this.scene,{heightAt:(x,z)=>this.environment.groundHeight(x,z),quality:this.quality,finish});
  }
  applyQuality(quality){
    const previous=this.quality;this.quality=quality in QUALITY?quality:'balanced';this.strainedFrames=0;const q=QUALITY[this.quality];
    this.resolutionBudget?.reset(q.fps);this.cadence?.reset(q.fps);this.gpuTimer?.reset();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.ratio)*(this.resolutionBudget?.scale??1));
    if(this.sun.shadow.mapSize.x!==q.shadow){this.sun.shadow.mapSize.set(q.shadow,q.shadow);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
    if(previous!==this.quality&&this.environment){
      this.sceneryOcclusion?.dispose();this.environment.dispose();
      this.environment=createEnvironment(this.scene,this.encounter,{tileSize:2.5,quality:this.quality,chapter:this.chapter});this.rebuildFieldFeatures();
      this.rebuildSceneryModels();this.sceneryOcclusion=createSceneryOcclusion(this.environment.group,this.sceneryModels?.group,this.fieldFeatures?.group);
      this.rebuildRemains();this.rebuildAtmosphere();this.sky.dispose();
      this.sky=createSky(this.scene,this.profile,{quality:this.quality,reducedMotion:this.reducedMotion});this.lighting.dispose();
      this.lighting=createSceneLighting(this.renderer,this.scene,this.profile,{quality:this.quality});this.sync(this.encounter);
      this.compositor?.setQuality(this.quality);this.ready=this.prepare();
    }
    this.compositor?.setQuality(this.quality);this.resize();
  }
  updatePixelRatio(){this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,QUALITY[this.quality].ratio)*(this.resolutionBudget?.scale??1));this.resize();}
  setAdaptiveResolution(value){if(this.adaptiveResolution===!!value)return;this.adaptiveResolution=!!value;this.resolutionBudget?.setEnabled(value);}
  // Where a delegate stands during the division: walking at an even pace,
  // one after another, then facing the champion. Reduced motion skips ahead.
  divisionStep(unit,now){
    const plan=this.discessio,move=plan?.byUnit.get(unit.id);if(!move)return null;
    plan.done=this.reducedMotion||!Number.isFinite(plan.start)||now>=plan.end;
    const from=this.world(move.from),to=this.world(move.to),length=from.distanceTo(to),
      t=plan.done?1:clamp((now-plan.start-move.order*220)/Math.max(1,length/1.35*1000),0,1),k=ease(t),
      at={x:move.from.x+(move.to.x-move.from.x)*k,y:move.from.y+(move.to.y-move.from.y)*k};
    const heading=t<1?Math.atan2(to.x-from.x,to.z-from.z):Math.atan2(this.world(move.face).x-to.x,this.world(move.face).z-to.z);
    return {at,moving:t>0&&t<1,distance:length*k,yaw:Number.isFinite(heading)?heading:0};
  }
  // Generated chapter scenery: re-placed on the rebuilt ground, absent at Performance quality.
  rebuildSceneryModels(){
    this.sceneryModels?.dispose();
    const own=this.sceneryModels=createSceneryModels(this.scene,this.encounter,
      {chapter:this.chapter,quality:this.quality,heightAt:(x,z)=>this.environment.groundHeight(x,z),
      prepare:model=>{this.sceneryOcclusion?.add(model);return this.compositor?.compile(this.scene,{object:model});}});
    // Models placed at once take the cutaway now (a first build's occlusion covers the group).
    this.sceneryOcclusion?.add(own.group);
    this.canvas.dataset.sceneryModels=own.placements.length?'loading':'0';
    own.ready.then(ids=>{if(this.sceneryModels!==own||this.disposed)return;this.canvas.dataset.sceneryModels=String(ids.length);this.shadowDirty=true;});
  }
  // What the battle leaves on the ground (bodies, spent arrows, trodden earth),
  // rebuilt with the ground it marks. Contests and ceremonies leave none.
  rebuildRemains(){
    this.remains?.dispose();this.remains=null;if(this.encounter.kind==='contest'||this.ceremony)return;
    const hx=this.encounter.width*1.25+2,hz=this.encounter.height*1.25+2;
    // Bodies and spent arrows rest on a repaired bridge deck, like the units who fell there.
    this.remains=createBattleRemains(this.scene,
      {quality:this.quality,ground:this.environment.ground,heightAt:(x,z)=>this.surfaceHeight(x,z),bounds:{minX:-hx,maxX:hx,minZ:-hz,maxZ:hz},
        visible:this.battleRemains});
  }
  setBattleRemains(value){this.battleRemains=value!==false;this.remains?.setVisible(this.battleRemains);}
  // Weather on the light: cloud shadows (shared uniforms), sun shafts at dawn,
  // in mist and indoors, and on High a mirror of the board's water.
  rebuildAtmosphere(){
    this.shafts?.dispose();this.reflection?.dispose();this.shafts=null;this.reflection=null;
    this.cloudLevel=this.ceremony?0:cloudStrength(this.profile);const [wx,wz]=cloudWind(this.chapter);CLOUD_UNIFORMS.cloudShape.value.set(1/22,wx,wz);
    const hx=this.encounter.width*1.25,hz=this.encounter.height*1.25;
    this.shafts=createLightShafts(this.scene,this.profile,
      {quality:this.quality,bounds:{minX:-hx,maxX:hx,minZ:-hz,maxZ:hz},sunDirection:this.sunOffset.clone().normalize(),seed:this.chapter});
    const level=this.environment.reflectionLevel;
    if(!this.ceremony&&level!==null&&reflectionAvailable(this.renderer,this.quality))this.reflection=createWaterReflection(this.renderer,
      this.environment.waterReflection,
      {level,hide:()=>[...this.environment.waterMeshes,this.ink?.mesh,this.overlay,this.grid,this.sky?.group,this.shafts?.group]});
  }
  setReducedMotion(value){
    if(this.reducedMotion!==value){this.shadowDirty=true;this.poseReset=new Set(this.actors.keys());}this.reducedMotion=value;if(value)this.finishMotion();
  }
  resize(){
    const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.viewportWidth=r.width;this.viewportHeight=r.height;this.labelSizeDirty=true;
    const previous=this.camera.aspect;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();
    this.compositor?.resize();
    if(Math.abs(previous-this.camera.aspect)>.01&&!this.focusMode&&!this.ceremony)this.orbit.distance=Math.max(this.cameraView==='horizon'?28:0,
      this.overviewDistance());
  }
  bind(){this.events=[];const on=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);this.events.push(()=>target.removeEventListener(type,fn,opts));};
    if(this.inputEnabled)this.bindInput(on);
    on(document,'visibilitychange',()=>{if(document.hidden)this.finishMotion();});
    on(this.canvas,'webglcontextlost',
      e=>{
        e.preventDefault();this.finishMotion();this.contextLost=true;clearTimeout(this.restoreTimer);
        this.restoreTimer=setTimeout(()=>{if(this.contextLost&&!this.disposed)this.onError?.('The 3D graphics context was interrupted.');},5000);
      });
    on(this.canvas,'webglcontextrestored',
      ()=>{
        clearTimeout(this.restoreTimer);this.restoreTimer=null;this.contextLost=false;this.shadowDirty=true;this.labelSizeDirty=true;
        this.poseReset=new Set(this.actors.keys());this.compositor?.resize();this.cadence?.reset(QUALITY[this.quality].fps);
      });
  }
  play(before,after,command){
    this.wake();this.finishMotion();this.sync(after);
    if((before?.operation?.index??0)<(after?.operation?.index??0)&&!this.focusMode&&this.cameraView==='overview')this.home?.();
    if(this.reducedMotion||this.paused||this.contextLost)return Promise.resolve();this.sound.unlock();
    const timeline=retimeStageTimeline(buildEncounterTimeline(before,after,{command,quality:this.quality}));if(!timeline.duration)return Promise.resolve();
    if(this.canvas?.dataset)this.canvas.dataset.motion='playing';this.poseReset=new Set(this.actors.keys());this.shadowDirty=true;
    this.animation={timeline,start:performance.now(),scale:1/(this.motionSpeed||1),cues:combatCues(timeline,{encounter:after}),nextCue:0,releasePoints:new Map(),
      marks:timeline.effects.filter(fx=>!fx.political&&(fx.type==='projectile'&&fx.from&&fx.to||['impact','shield'].includes(fx.type)&&fx.at)).map(fx=>({fx,
        at:fx.type==='projectile'?fx.start+fx.duration:fx.start,done:false,
        volley:fx.type==='projectile'?this.actors.get(this.unitAt(fx.from)?.id)?.crowd?.count??0:0}))};
    return new Promise(resolve=>this.animation.resolve=resolve);
  }
  // Per figure and frame: a ribbon behind the swung blade (a brushed arc for
  // painted figures) and dust under running men and horses on dry ground.
  combatMotion(unit,actor,pose,override,dt){
    if(!this.combat)return;const motion=pose.motion,phase=Number.isFinite(pose.phase)?pose.phase:0;
    if(['attack','strike'].includes(motion)&&phase>=.18&&phase<=.62){
      if(actor.painted){
        const facing=actor.puppet?.puppetFacing.value??1,right=new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0).setY(0).normalize(),
          center=actor.group.position.clone().add(new T.Vector3(0,actor.group.userData.actor?.mounted?1.7:1.15,0));
        const angle=2.2-(phase-.18)/.44*2.7,tip=center.clone().addScaledVector(right,Math.cos(angle)*.85*facing).add(new T.Vector3(0,Math.sin(angle)*.85,0));
        this.combat.trail(unit.id,tip,center.clone().lerp(tip,.45));
      }else{
        const tip=actor.contacts?.weapon?.getWorldPosition(new T.Vector3()),body=actor.contacts?.body?.getWorldPosition(new T.Vector3());
        if(tip&&body)this.combat.trail(unit.id,tip,tip.clone().lerp(body,.38));
      }
    }
    const mounted=!!actor.group.userData.actor?.mounted,running=motion==='run'||mounted&&motion==='walk';
    if(!running)return;
    const tile=override??unit,ground=this.encounter.terrain?.[Math.round(tile.y)]?.[Math.round(tile.x)];
    if(['rain','mist'].includes(this.profile.weather)&&!mounted||this.profile.weather==='rain'
      ||['marsh','ford','river'].includes(typeof ground==='string'?ground:ground?.type))return;
    const debt=(this.dustDebt.get(unit.id)??0)+dt*(mounted?14:6),puffs=Math.floor(debt);this.dustDebt.set(unit.id,debt-puffs);
    if(!puffs)return;const p=actor.group.position;this.combat.dust(p.x,p.y,p.z,{amount:puffs,seed:unit.id});
    if(mounted)for(const f of actor.crowd?.footprints??[])this.combat.dust(f.x,f.y,f.z,{amount:Math.max(1,puffs-1),seed:`${unit.id}:${f.x.toFixed(1)}`});
  }
  finishMotion(cancelAudio=true){
    if(!this.animation)return;this.markGround();if(cancelAudio)this.sound?.stop?.();const resolve=this.animation.resolve;
    if(this.canvas?.dataset)this.canvas.dataset.motion=cancelAudio?'cancelled':'complete';this.animation=null;this.projectiles.forEach(p=>p.visible=false);
    this.sparkClouds.forEach(p=>p.material.opacity=0);this.effectRings.forEach(p=>p.visible=false);this.sync(this.encounter);
    this.poseReset=new Set(this.actors.keys());resolve?.();
  }
  tick(now){
    if(this.disposed)return;this.frame=requestAnimationFrame(t=>this.tick(t));
    if(document.hidden||this.contextLost||this.paused||!this.isReady){this.lastPaint=0;return;}
    // Live mode: the real-time world steps before the frame that draws it.
    this.live?.beforeFrame?.(now);if(!this.cadence.shouldRender(now))return;
    // While nothing moves (no motion, input or camera change for a moment), a
    // 60 fps target draws every other frame: breathing, cloth, cloud and water
    // read the same at 30, for half the GPU work, heat and battery.
    const quiet=!this.live&&!this.animation&&!this.drag&&!this.pendingHover&&!(this.discessio&&!this.discessio.done)&&this.cameraSettled&&now-(this.wokeAt??0)>QUIET_AFTER_MS;
    if(quiet&&QUALITY[this.quality].fps>30&&(this.quietSkip=!this.quietSkip))return;
    const sincePaint=this.lastPaint?now-this.lastPaint:0,dt=Math.min(.08,sincePaint/1000||.016);this.lastPaint=now;
    if(sincePaint&&!quiet&&!this.gpuTimer?.stats().supported)this.resolutionBudget?.recordInterval(sincePaint,this.cadence.expectedMs);this.elapsed+=dt;
    // Strain: frames still late with the resolution already at its floor. The
    // shadow map then refreshes half as often, and the controller builds the
    // next battle a tier lower; this one is never rebuilt in play.
    const floor=this.adaptiveResolution&&(this.resolutionBudget?.scale??1)<=STRAIN_SCALE;
    if(sincePaint&&!quiet)this.strainedFrames=floor&&sincePaint>this.cadence.expectedMs*1.45?(this.strainedFrames??0)+1:Math.max(0,(this.strainedFrames??0)-1);
    if(this.pendingHover&&!this.drag){
      const point=this.pick(this.pendingHover);this.pendingHover=null;this.hovered=point?.unitId??null;this.onHover(point);
      if(this.hovered!==this.inkHover){this.inkHover=this.hovered;this.updateInk();}
    }
    const renderStart=performance.now();let frame=null;
    if(this.animation){
      const a=this.animation;const elapsed=(now-a.start)/a.scale;frame=sampleEncounterTimeline(a.timeline,elapsed);
      while(a.nextCue<a.cues.length&&a.cues[a.nextCue].time<=elapsed){
        const cue=a.cues[a.nextCue++];
        const tile=cue.at??this.encounter.units.find(u=>u.id===cue.unitId),pan=tile?clamp(this.world(tile).project(this.camera).x,-1,1):0;
        if(elapsed-cue.time<150&&this.sound.cue(cue.kind,{...cue,pan}))this.cuesPlayed++;
      }
      if(frame.complete){this.finishMotion(false);frame=null;}
    }
    this.environment.update(this.reducedMotion?0:this.elapsed);this.fieldFeatures?.update(this.elapsed,this.reducedMotion);
    for(const unit of this.visibleUnits){
      // A live figure's place and pose come from the real-time world (live-figures.js), not a turn's timeline.
      const lp=this.live?.pose(unit,{time:this.elapsed,dt,reducedMotion:this.reducedMotion});
      const a=this.actors.get(unit.id),o=lp?null:frame?.unitOverrides[unit.id],position=lp?.at??o??unit;
      const walk=lp?null:this.divisionStep(unit,now);
      a.group.position.copy(this.world(walk?.at??position));const contact=meleeOffset(unit,o,this.animation?.timeline);a.group.position.x+=contact.x;
      a.group.position.z+=contact.z;a.group.position.y=this.surfaceHeight(a.group.position.x,a.group.position.z)+(lp?.lift??0);
      a.group.visible=lp?lp.visible:actorVisible(unit)||!!o&&o.alpha>0;if(!a.group.visible){this.labels.get(unit.id).hidden=true;this.layFallen(unit,a);continue;}
      const active=unit.id===this.selected||unit.id===this.inspected||unit.id===this.hovered||!!o&&o.pose!=='idle'||!!lp?.active;
      const attack=this.animation?.timeline.tracks.find(t=>t.unitId===unit.id&&t.pose===o?.pose&&t.target),victim=lp?null:attack&&this.unitAt(attack.target);
      const aimHeight=lp?lp.aimHeight:victim?this.world(victim).y+(['cavalry','heavy'].includes(victim.role)?2.05:1.2):undefined;
      const pose=lp?.pose??stageActorPose(unit,frame,this.animation?.timeline,{time:this.elapsed,dt,reducedMotion:this.reducedMotion});
      if(walk)Object.assign(pose,
        walk.moving?{motion:'walk',locomotionDistance:walk.distance,locomotionWeight:1,phase:undefined,direction:walk.yaw}:{motion:'idle',direction:walk.yaw});
      else if(unit.role==='voter'&&pose.motion==='idle')Object.assign(pose,voterPosture(unit)??{});
      // Ceremony gestures loop gently, each figure a little out of step.
      const gesture=this.ceremony?.poses?.[unit.id];
      if(gesture&&!walk&&pose.motion==='idle'){pose.motion=gesture;pose.phase=this.reducedMotion?.55:(this.elapsed*.28+(unit.x*.37+unit.y*.61))%1;}
      if(unit.id===this.selected)this.selectedYaw=pose.direction;
      const focusUnit=lp?.focusId?this.encounter.units.find(u=>u.id===lp.focusId)
        :victim??(unit.id===this.selected&&this.inspected&&this.inspected!==unit.id?this.encounter.units.find(u=>u.id===this.inspected):null);
      let gazeYaw=0,gazePitch=0;
      if(focusUnit){
        const d=this.world(focusUnit).sub(a.group.position),
          rel=Math.atan2(Math.sin(Math.atan2(d.x,d.z)-pose.direction),Math.cos(Math.atan2(d.x,d.z)-pose.direction));
        if(Math.abs(rel)<1.35){gazeYaw=clamp(rel*.45,-.32,.32);gazePitch=clamp(-Math.atan2(d.y,Math.max(.5,Math.hypot(d.x,d.z)))*.35,-.18,.18);}
      }
      if(a.crowd){
        // Ranks thin when the blow lands, not when the order is given.
        const pair=this.animation?.timeline.units?.[unit.id],
          pending=pair&&this.animation.timeline.tracks.some(t=>t.unitId===unit.id&&['hit','retreat'].includes(t.pose)&&(frame?.time??Infinity)<t.start),
          ranks=pending?pair.before:unit;
        const slots=this.followerSlots(unit);
        a.crowd.update({slots,visible:followerCount(ranks,Math.min(slots.length,a.crowd.max)),heightAt:this.surfaceHeight,time:this.elapsed,
          reset:this.poseReset.has(unit.id),unitId:unit.id,
          onFall:this.remains?fall=>this.remains.fall({...this.fallenKind(unit,a),world:fall.world,yaw:fall.yaw+.35*(fall.index%2?1:-1),
            animate:!this.reducedMotion}):null});
      }
      a.update({...pose,unit,override:o??(walk?.moving?{pose:'walk',progress:.5,stridePhase:walk.distance*2.4}:null),gazeYaw,gazePitch,
        groundHeight:this.surfaceHeight,aimHeight,detailDistance:this.camera.position.distanceTo(a.group.position),active,resetPose:this.poseReset.has(unit.id)});
      this.poseReset.delete(unit.id);
      // Marching feet and hooves wear the ground of the board.
      if(this.remains&&!this.reducedMotion&&['walk','run'].includes(pose.motion)){
        const mounted=!!a.group.userData.actor?.mounted;this.remains.tread(a.group.position.x,a.group.position.z,{mounted,id:unit.id});
        (a.crowd?.footprints??[]).forEach((f,i)=>this.remains.tread(f.x,f.z,{mounted,id:`${unit.id}:${i}`}));
      }
      if(!this.reducedMotion)this.combatMotion(unit,a,pose,o,dt);
      const label=this.labels.get(unit.id),refs=this.labelRefs.get(unit.id),key=`${unit.id===this.selected}:${unit.id===this.inspected||unit.id===this.hovered}`;
      label.hidden=false;
      if(refs.stateKey!==key){
        refs.stateKey=key;label.classList.toggle('selected',unit.id===this.selected);
        label.classList.toggle('inspected',unit.id===this.inspected||unit.id===this.hovered);refs.width=0;this.labelSizeDirty=true;
      }
      const preview=!this.animation&&(this.previewTargets?.[unit.id]??(this.previewTarget?.unitId===unit.id?this.previewTarget:null));
      // Written only on change: an unchanged label keeps its layout (see positionLabels).
      if(preview){
        if(refs.effect.textContent!==preview.text||refs.effectColor!==preview.color){
          refs.effect.textContent=preview.text;refs.effect.style.color=refs.effectColor=preview.color;this.labelContentDirty=true;
        }
      }else if(refs.effect.textContent){refs.effect.textContent='';refs.effectColor=null;this.labelContentDirty=true;}
    }
    if(this.tacticalArcs)for(const [i,line]of this.tacticalArcs.entries())if(line.visible){
      line.material.opacity=this.reducedMotion?.85:(line.userData.linkKind==='guard'?.78+.17*Math.sin(this.elapsed*3.2+i):.75+.2*Math.sin(this.elapsed*4.8+i));
    }
    this.pairedContacts=this.reducedMotion?0:applyPairedContacts(this.actors,frame,this.animation?.timeline);
    this.contactShadows.update(this.actors,this.surfaceHeight);
    const selected=this.actors.get(this.selected);this.selectedRing.visible=!!selected?.group.visible&&!this.ceremony;
    if(selected){
      this.selectedRing.position.copy(selected.group.position);this.selectedRing.position.y+=.065;this.selectedRing.rotation.y=this.selectedYaw??0;
      this.selectedRing.scale.setScalar(selected.group.userData.actor?.mounted?1.45:1);
    }
    this.projectiles.forEach(p=>p.visible=false);this.sparkClouds.forEach(p=>p.material.opacity=0);this.effectRings.forEach(p=>p.visible=false);
    let projectileCount=0,sparkCount=0,ringCount=0;const volleyShots=[];
    for(const fx of frame?.effects??[]){const readout=effectReadout(fx);
      if(fx.at&&readout.text){
        const unit=this.unitAt(fx.at),refs=this.labelRefs.get(unit?.id),label=refs?.effect;
        if(label){label.textContent=readout.text;label.style.color=refs.effectColor=readout.color;}
      }
      if(readout.ring&&fx.at&&ringCount<6){
        if(!this.effectRings[ringCount]){
          const ring=new T.Mesh(this.targetGeometry,new T.MeshBasicMaterial({color:readout.color,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,forceSinglePass:true}));
          ring.rotation.x=-Math.PI/2;this.effectGroup.add(ring);this.effectRings.push(ring);
        }
        const ring=this.effectRings[ringCount++];ring.position.copy(this.world(fx.at));ring.position.y+=.09;
        ring.scale.setScalar(.65+fx.progress*(readout.radius??1.2));ring.material.color.set(readout.color);ring.material.opacity=(1-fx.progress)*.75;
        ring.visible=true;
      }
      if(fx.type==='projectile'&&projectileCount<4){
      if(!this.projectiles[projectileCount]){const p=this.projectile.clone();this.effectGroup.add(p);this.projectiles.push(p);}
      const projectile=this.projectiles[projectileCount++];projectile.scale.setScalar(fx.projectile==='arrow'?.52:1);
      const key=`${fx.start}:${fx.from.x}:${fx.from.y}`,origins=this.animation.releasePoints;
      if(!origins.has(key)){
        const source=this.unitAt(fx.from),actor=this.actors.get(source?.id);
        origins.set(key,actor?.getReleasePoint(new T.Vector3())??this.world(fx.from).add(new T.Vector3(0,1.4,0)));
      }
      positionProjectileTip(projectile,origins.get(key),this.bodyPoint(fx.to),fx.progress);projectile.visible=true;
      // The shooter's whole rank looses with him.
      const rank=this.actors.get(this.unitAt(fx.from)?.id)?.crowd;
      if(rank?.count)rank.footprints.forEach((f,i)=>volleyShots.push({from:f.clone().add(new T.Vector3(0,1.35,0)),to:this.world(fx.to),progress:fx.progress,
        index:i,seed:key,size:fx.projectile==='arrow'?1:2.1}));
    }else if(['impact','shield'].includes(fx.type)&&!fx.political){
      if(fx.at)this.updateBattleDecals(this.encounter,[fx.at]);
      if(sparkCount>=8)continue;
      if(!this.sparkClouds[sparkCount]){
        const cloud=new T.Points(this.sparkGeometry.clone(),this.sparkMaterial.clone());cloud.frustumCulled=false;this.effectGroup.add(cloud);
        this.sparkClouds.push(cloud);
      }
      const cloud=this.sparkClouds[sparkCount++];
      const defender=this.unitAt(fx.at),actor=this.actors.get(defender?.id),anchor=fx.type==='shield'?actor?.contacts.shield:null;
      const p=anchor?.getWorldPosition(new T.Vector3())??actor?.contacts.body?.localToWorld(new T.Vector3(0,.27,.10))??this.bodyPoint(fx.at);
      sampleImpactParticles(cloud,p,fx.progress,{shield:fx.type==='shield',source:fx.source?this.world(fx.source):undefined});
      if(defender&&fx.delta)this.labelRefs.get(defender.id).effect.textContent=String(fx.delta);
    }}
    // Live mode draws its own missiles, sparks and markers over the pools just cleared.
    this.live?.effects?.(this,{dt,now});
    if(this.chamberStandards)for(const [bloc,std]of this.chamberStandards){
      if(std.group.visible&&std.banner)std.banner.rotation.z=this.reducedMotion?0:Math.sin(this.elapsed*2.1+bloc.length)*.035;
    }
    let brazier=null;
    if(this.fieldworkMeshes)for(const group of this.fieldworkMeshes.values())if(group.visible&&group.userData.flamePlume){
      sampleFlamePlume(group.userData.flamePlume,this.elapsed,{reducedMotion:this.reducedMotion});brazier??=group;
    }
    sampleWeatherParticles(this.weatherCloud,this.profile.weather,this.elapsed,{reducedMotion:this.reducedMotion});
    CLOUD_UNIFORMS.cloudStrength.value=this.cloudLevel??0;CLOUD_UNIFORMS.cloudTime.value=this.reducedMotion?0:this.elapsed%3600;
    this.shafts?.update(this.elapsed,{reducedMotion:this.reducedMotion});
    this.combat?.volley(volleyShots);
    if(this.animation&&frame)this.markGround(frame.time);
    // Combat effects run on the motion's own clock (faster at double speed).
    this.combatClock=(this.combatClock??0)+dt*(this.animation?1/this.animation.scale:1);
    this.remains?.update(this.elapsed);this.combat?.update(this.combatClock);
    // One point light serves the night torch or, by day, the first burning brazier.
    if(this.nightLight){const light=this.nightLight;
      if(this.profile.torchlight){
        light.color.set('#ffad5c');light.distance=16;light.decay=1.6;light.intensity=this.reducedMotion?2.35:2.35+.22*Math.sin(this.elapsed*7.5);
        if(selected)light.position.set(selected.group.position.x,selected.group.position.y+2.8,selected.group.position.z);
      }
      else if(brazier){
        light.color.set('#ff9a3c');light.distance=8;light.decay=1.8;
        light.intensity=this.reducedMotion?1.85:1.85+.28*Math.sin(this.elapsed*8.5+brazier.position.x);
        light.position.copy(brazier.userData.brazierLightAt).add(brazier.position);
      }
      else light.intensity=0;}
    const target=this.focusMode&&selected?selected.group.position.clone().add(new T.Vector3(0,selected.group.userData.actor?.mounted?1.2:.85,0)):this.baseTarget.clone();
    let actionGoal=0;
    if(this.animation&&!this.focusMode&&this.cameraView==='overview'&&!this.reducedMotion){const elapsed=(now-this.animation.start)/this.animation.scale;
      const strike=this.actionCamera!==false
        ?this.animation.timeline.tracks.find(t=>ACTION_POSES.has(t.pose)&&t.target&&elapsed>=t.start-200&&elapsed<=(t.end??t.start+t.duration)+350):null;
      if(strike){
        const end=strike.end??strike.start+strike.duration,ease=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
        actionGoal=ease(strike.start-200,strike.start+120,elapsed)*(1-ease(end+50,end+350,elapsed));
        const from=this.actors.get(strike.unitId)?.group.position??this.world(strike.target),to=this.world(strike.target),
          mid=from.clone().add(to).multiplyScalar(.5);
        mid.y+=1;
        target.lerp(mid,.75*actionGoal);this.actionSideYaw=sideOnYaw(from,to,this.orbit.yaw);
      }else{
        const activeTrack=this.animation.timeline.tracks.find(t=>elapsed>=t.start&&elapsed<=t.end&&(t.target||t.from));
        if(activeTrack){const focusTile=activeTrack.target??activeTrack.from;if(focusTile)target.lerp(this.world(focusTile).add(new T.Vector3(0,.85,0)),.18);}
      }
    }
    this.actionBlend=(this.actionBlend??0)+(actionGoal-(this.actionBlend??0))*Math.min(1,dt*4);
    if(this.reducedMotion||!this.animation&&this.actionBlend<.002)this.actionBlend=0;
    if(this.ceremony&&!this.reducedMotion&&!this.drag)this.orbit.yaw+=dt*.045; // a slow, steady circuit of the tableau
    if(this.figureStyle==='painted'&&!this.drag&&this.cameraView==='overview'){
      const goal=diagonalYaw(this.orbit.yaw);this.orbit.yaw+=(goal-this.orbit.yaw)*(this.reducedMotion?1:Math.min(1,dt*5));
    }
    this.lookTarget.lerp(target,this.reducedMotion?1:Math.min(1,dt*3));
    const {yaw,pitch,distance}=actionFraming(this.orbit,{weight:this.actionBlend,sideYaw:this.actionSideYaw,painted:this.figureStyle==='painted'});
    this.camera.position.set(this.lookTarget.x+Math.sin(yaw)*Math.cos(pitch)*distance,this.lookTarget.y+Math.sin(pitch)*distance,
      this.lookTarget.z+Math.cos(yaw)*Math.cos(pitch)*distance);
    this.camera.position.y=Math.max(this.camera.position.y,this.environment.cameraGroundHeight(this.camera.position.x,this.camera.position.z)+.9);
    this.camera.lookAt(this.lookTarget);
    // A landed blow jolts the view a few centimetres and settles in a quarter second.
    if(this.cameraKick>.002&&!this.reducedMotion){
      const k=this.cameraKick,
        offset=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)).multiplyScalar(Math.sin(this.elapsed*61)*.07*k).add(new T.Vector3(0,
          Math.cos(this.elapsed*47)*.045*k,0));
      this.camera.position.add(offset);this.camera.lookAt(this.lookTarget.clone().add(offset));
    }
    this.cameraKick=this.reducedMotion?0:(this.cameraKick??0)*Math.exp(-dt*12);
    this.camera.updateMatrixWorld();this.cameraSettled=!!this.lastCamera&&this.lastCamera.distanceToSquared(this.camera.position)<1e-8;
    (this.lastCamera??=new T.Vector3()).copy(this.camera.position);this.sky.update(this.elapsed,this.camera,this.reducedMotion);this.fitShadow();
    // Painted cards face the camera only after it has moved this frame.
    const sunYaw=Math.atan2(this.sunOffset.x,this.sunOffset.z);
    // Painted cards read their shade from a point just sunward of the figure.
    const sunReach=Math.hypot(this.sunOffset.x,this.sunOffset.z)||1;
    this.paintedLighting.paintedSunShift.value.set(this.sunOffset.x/sunReach*.55,0,this.sunOffset.z/sunReach*.55);
    for(const a of this.actors.values())if(a.group.visible)a.faceCamera?.(this.camera,{sunYaw});
    this.compositor?.setFocus?.(this.camera.position.distanceTo(this.lookTarget));
    // Aerial haze starts past the board's far corner from this camera (half-diagonal ~14m).
    const focusDistance=this.camera.position.distanceTo(this.lookTarget);
    this.compositor?.setHaze?.({near:focusDistance+14,far:focusDistance+140,color:this.profile.grade?.haze});
    // Scene fog likewise begins past the board (sooner in mist and rain), so the
    // playable ground keeps its contrast while the surrounding land recedes.
    const misty=['mist','rain'].includes(this.profile.weather),fog=this.scene.fog;
    fog.near=focusDistance+(misty?6:12);fog.far=fog.near+(misty?1.4:2)/(this.profile.fogDensity??.017);
    this.rimDirection.copy(this.lookTarget).sub(this.camera.position).setY(0);
    if(this.rimDirection.lengthSq()>1e-6){
      this.rimDirection.normalize();this.rim.position.copy(this.lookTarget).addScaledVector(this.rimDirection,14);this.rim.position.y+=7;
      this.rim.target.position.copy(this.lookTarget);this.rim.target.updateMatrixWorld();
    }
    const cutawayUnits=[selected,this.actors.get(this.inspected)].filter((actor,index,list)=>actor?.group.visible&&list.indexOf(actor)===index);
    this.sceneryOcclusion?.update(this.camera,
      {targets:cutawayUnits.map(actor=>({position:actor.group.position.clone().add(new T.Vector3(0,actor.group.userData.actor?.mounted?1.8:1.1,0)),
        radius:actor.group.userData.actor?.mounted?1.7:1.35})),
        enabled:this.cameraView!=='overview'||!!this.animation,delta:dt,reducedMotion:this.reducedMotion});
    this.positionLabels();this.ink?.flush?.(now);
    const shadowInterval=(SHADOW_REFRESH_MS[this.quality]??125)*(floor?2:1);
    if(this.shadowDirty||this.animation||!this.reducedMotion&&now-this.lastShadow>=shadowInterval){
      this.renderer.shadowMap.needsUpdate=true;this.shadowDirty=false;this.lastShadow=now;this.shadowUpdates++;
    }
    for(const gpuMs of this.gpuTimer?.poll()??[]){this.resolutionBudget?.record(gpuMs);this.frameLog?.gpu.push(gpuMs);}
    this.gpuTimer?.begin();
    let reflectionMs=0;
    try{
      const start=performance.now();if(this.profileFrames++%this.frameProfile.reflectionStride()===0)this.reflection?.render(this.scene,this.camera);
      reflectionMs=performance.now()-start;if(this.compositor)this.compositor.render(this.scene);else this.renderer.render(this.scene,this.camera);
    }finally{this.gpuTimer?.end();}
    const cost=performance.now()-renderStart;this.frameProfile.record({cpuMs:cost,intervalMs:sincePaint,reflectionMs});this.samples.push(cost);
    this.frameLog?.frames.push([now,cost,sincePaint]);this.renderCounts.push(this.renderer.info.render.calls);if(this.samples.length>120)this.samples.shift();
    if(this.renderCounts.length>120)this.renderCounts.shift();this.onFrame(cost);
    if(this.firstFrameDone){const done=this.firstFrameDone;this.firstFrameDone=null;done();}
    if(now-(this.lastStats||0)>1000){this.lastStats=now;this.canvas.dataset.renderStats=JSON.stringify(this.stats());}
  }
  // Strained for long enough that the next battle should be built a tier lower.
  get strained(){return (this.strainedFrames??0)>=STRAINED_FRAMES;}
  // A log of painted frames (time, CPU cost, interval) and GPU times for the
  // Settings performance check; measurement only, nothing on screen changes.
  startFrameLog(){this.frameLog={frames:[],gpu:[]};return this.frameLog;}
  stopFrameLog(){const log=this.frameLog;this.frameLog=null;return log;}
  // Fit the sun's shadow box to what the camera can see: close views gain
  // texel density, the overview keeps the whole board and nearby casters.
  fitShadow(){
    const half=Math.round(clamp(this.orbit.distance*.55+3,9,23)),x=Math.round(this.lookTarget.x*2)/2,z=Math.round(this.lookTarget.z*2)/2,fit=this.shadowFit;
    if(Math.abs(fit.half-half)<1&&Math.hypot(fit.x-x,fit.z-z)<1.5)return;
    fit.half=half;fit.x=x;fit.z=z;const camera=this.sun.shadow.camera;Object.assign(camera,{left:-half,right:half,top:half,bottom:-half});
    camera.updateProjectionMatrix();
    this.sun.target.position.set(x,0,z);this.sun.position.set(x+this.sunOffset.x,this.sunOffset.y,z+this.sunOffset.z);this.sun.target.updateMatrixWorld();
    this.shadowDirty=true;
  }
  stats(){
    return {device:this.deviceReport,firstFramePrograms:this.firstFramePrograms??null,frameProfile:this.frameProfile.stats(),
      pairedContacts:this.pairedContacts??0,fieldFeatures:this.fieldFeatures?.stats(),cuesPlayed:this.cuesPlayed,
      renderMs:this.samples.reduce((a,b)=>a+b,0)/Math.max(1,this.samples.length),samples:this.samples.length,calls:this.renderer.info.render.calls,
      callsMean:this.renderCounts.reduce((a,b)=>a+b,0)/Math.max(1,this.renderCounts.length),callsMax:Math.max(0,...this.renderCounts),
      shadowUpdates:this.shadowUpdates,labels:{...this.labelStats},triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,
      geometries:this.renderer.info.memory.geometries,quality:this.quality,cameraView:this.cameraView,actorAssets:actorAssetStatus(),gpu:this.gpuTimer?.stats(),
      resolution:this.resolutionBudget?.stats(),occlusion:this.sceneryOcclusion?.stats(),compositor:this.compositor?.stats(),figureStyle:this.figureStyle,
      ink:this.ink?.stats()??null,remains:this.remains?.stats()??null,combat:this.combat?.stats()??null,
      atmosphere:{clouds:this.cloudLevel??0,shafts:this.shafts?.stats()??null,reflection:this.reflection?.stats()??null},lighting:this.lighting.stats(),
      contactShadows:this.contactShadows.stats(),sky:this.sky.stats(),horizon:this.environment.horizon.stats};
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.touchHold?.dispose();this.firstFrameDone?.();this.firstFrameDone=null;this.sceneryModels?.dispose();
    this.sound.dispose();this.finishMotion();cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.events.forEach(fn=>fn());
    this.actors.forEach(a=>a.dispose());this.sceneryOcclusion?.dispose();this.gpuTimer?.dispose();this.fieldFeatures?.dispose();this.environment.dispose();
    this.sky.dispose();this.lighting.dispose();this.compositor?.dispose();this.contactShadows.dispose();this.ink?.dispose();this.remains?.dispose();
    this.combat?.dispose();this.shafts?.dispose();this.reflection?.dispose();CLOUD_UNIFORMS.cloudStrength.value=0;this.particleMask.dispose();
    this.labelLayer.remove();clearTimeout(this.restoreTimer);const geometries=new Set(),materials=new Set();
    this.scene.traverse(o=>{
      if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);
    });
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.sun.shadow?.dispose?.();this.renderer.dispose();
    // A discarded canvas releases its context now instead of waiting for GC; a
    // canvas that stays in the page (a reused host) keeps its context.
    if(!this.canvas.isConnected)this.renderer.forceContextLoss?.();
  }
}
// The stage's methods are grouped by concern in the stage-*.js modules
// above; they join the class here, as ordinary (non-enumerable) methods.
for(const methods of [stageInput,stageCamera,stageLabels,stageFigures,stagePreparation,stageOverlays])Object.defineProperties(BattleStage.prototype,
  Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(methods)).map(([name,d])=>[name,{...d,enumerable:false}])));
