import {FIGURE_STYLES} from '../ui/graphics-quality.js';
import {FORMATION_LIMIT,createSkinnedCrowd,formationEligible,formationShape,formationSlots} from './formation.js';
import {actorAssetStatus} from './actor-assets.js';
import {actorVisible,civicActor} from './stage-readout.js';
import {createActor} from './actors.js';
import {createPaintedActor} from './painted-actor.js';
import {loadTacticalArt} from '../ui/unit-sprites.js';
import {paintedFallenKind,sculptedFallenKind} from './battle-remains.js';
import {replaceStageActor} from './actor-replacement.js';

// The 3D figures: each unit's sculpted or painted figure, its formation
// followers, and how the defeated lie.
// A figure is rebuilt when its key changes: a committed defection changes the
// uniform and allegiance together, and quality and figure style change how it is built.
export function figureStyleKey(unit,{commendations,quality,figureStyle}){return `${unit.side}:${unit.role}:${unit.name}:${commendations}:${quality}:${figureStyle}`;}
// The finish the scene adds for each figure style: painted figures a tilt-shift, inked ones outlines and washes.
export const figureStyleFinish=style=>({tiltShift:style==='painted'?1:0,ink:style==='inked'?1:0});
// Delegates show their stance in posture: assent leans in, dissent folds its arms.
export function voterPosture(unit){const stance=Number(unit?.stance)||0;return stance>=1?{motion:'assent',phase:Math.min(1,stance/3)}:stance<=-1?{motion:'dissent',phase:Math.min(1,-stance/3)}:null;}
export const stageFigures={
  // A veteran's commendations, or the standing a unit's training gives it.
  commendationsOf(u){return this.commendations?.[u.veteranId]??(u.moraleResistance?6:u.specialization?3:0);},
  // The unit's figure, replaced when its key changed. A new figure waits in the
  // queue while the stage is first built (prepare builds them a few at a time).
  syncFigure(u,encounter){
    const vComm=this.commendationsOf(u),styleKey=figureStyleKey(u,{commendations:vComm,quality:this.quality,figureStyle:this.figureStyle});
    const actor=this.actors.get(u.id);if(actor&&actor.group.userData.styleKey===styleKey)return actor;
    if(!actor&&this.figureQueue){this.figureQueue.add(u.id);return null;}
    return this.placeFigure(u,{styleKey,vComm,encounter});
  },
  placeFigure(u,{styleKey,vComm,encounter=this.encounter}){
    const actor=replaceStageActor({actors:this.actors,id:u.id,scene:this.scene,
      create:()=>(this.figureStyle==='painted'&&createPaintedActor(u,{chapter:this.chapter,contest:encounter.kind==='contest',light:this.paintedLight,lighting:this.paintedLighting}))||createActor(u,{quality:this.quality,chapter:this.chapter,rank:this.rank,commendations:vComm,palette:this.ceremony?.palettes?.[u.id]}),
      prepare:candidate=>{if(candidate.painted)this.loadPaintedArt();this.attachFormation(u,candidate);candidate.group.userData.unitId=u.id;candidate.group.userData.styleKey=styleKey;}
    });
    this.poseReset.add(u.id);actor.ready?.then(()=>{if(!this.disposed&&this.actors.get(u.id)===actor){this.shadowDirty=true;this.poseReset.add(u.id);if(!actor.painted&&actor.rebuilt!==false)this.attachFormation(u,actor);this.canvas.dataset.actorAssets=actorAssetStatus().ready?'imported':'fallback';this.canvas.dataset.generatedBodies=String([...this.actors.values()].filter(a=>a.group.userData.actor?.body).length);}});
    return actor;
  },
  // A defeated unit is laid down once its fall has played (at once on a rebuilt stage).
  layFallen(unit,actor){
    if(!this.remains||civicActor(unit)||actorVisible(unit)||this.remains.hasLaid(unit.id))return;
    this.remains.layUnit(unit,{...this.fallenKind(unit,actor),world:actor.group.position.clone(),yaw:actor.group.rotation.y+.4,animate:!!this.animation&&!this.reducedMotion});
  },
  // One appearance per fallen batch: a painted unit's own painting, or a sculpted kind of man.
  fallenKind(unit,actor){
    if(actor.painted)return {key:`painted:${unit.id}`,make:paintedFallenKind(actor)};
    const kit=actor.group.userData.actor??{};return {key:`sculpted:${unit.role}:${unit.side}:${kit.faction??''}:${kit.mounted?'mounted':'foot'}`,make:sculptedFallenKind(actor,{label:unit.role})};
  },
  // Military units from Chapter IV stand as formations; a rebuilt rig gets a new crowd.
  attachFormation(unit,actor){
    const ranks=actor.crowd?.ranks??[];actor.crowd?.dispose();actor.crowd=null;
    if(!formationEligible(unit,{chapter:this.chapter,contest:this.encounter?.kind==='contest'}))return;
    const max=Math.min(FORMATION_LIMIT[this.quality]??FORMATION_LIMIT.balanced,formationSlots(unit).length);
    actor.crowd=actor.painted?actor.createCrowd?.(max)??null:createSkinnedCrowd(actor.group,{max});actor.crowd?.inherit?.(ranks);
    if(actor.crowd&&!actor.crowdOwned){const dispose=actor.dispose.bind(actor);actor.dispose=()=>{actor.crowd?.dispose();dispose();};actor.crowdOwned=true;}
  },
  followerSlots(unit){
    this.slotCache??=new Map();const key=`${unit.id}:${formationShape(unit)}`;
    if(!this.slotCache.has(key))this.slotCache.set(key,formationSlots(unit));return this.slotCache.get(key);
  },
  // The painted atlases are the 2D view's own; repaint the cards once decoded.
  loadPaintedArt(){
    if(this.paintedArt)return;
    this.paintedArt=loadTacticalArt(this.encounter).then(()=>{if(this.disposed)return;for(const a of this.actors.values())a.repaint?.();this.shadowDirty=true;}).catch(()=>{});
  },
  // Swapping style rebuilds only the figure presentation; the encounter is untouched.
  setFigureStyle(style){
    const next=FIGURE_STYLES.includes(style)?style:'sculpted';if(next===this.figureStyle||this.disposed)return;
    // The style is part of each figure's style key, so sync replaces every figure
    // and keeps the old one until its replacement is ready (as a quality change does).
    this.figureStyle=next;
    this.compositor?.setStyle?.(figureStyleFinish(next));this.sync(this.encounter);this.shadowDirty=true;this.ready=this.prepare();
  }
};
