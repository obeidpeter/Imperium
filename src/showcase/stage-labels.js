import * as T from '../../vendor/three/three.module.js';
import {contextualLabelVisible} from './contextual-labels.js';
import {layoutStageLabels} from './stage-label-layout.js';
import {actorReadout,actorVisible,civicActor} from './stage-readout.js';
import {isAlive} from './session.js';

// The world labels over the 3D figures: laid out each frame from the figures'
// screen positions, skipped while nothing moves.
// Compact by default: a role glyph and strength bar; names for the people the
// story follows, the selection and whatever is under the pointer.
export function labelRole(unit){
  const r=unit?.role;
  return ['voter','speaker','commander','archer','guard','raider','trainer','escort'].includes(r)?r:['cavalry','heavy'].includes(r)?'cavalry':'infantry';
}
export function namedFigure(unit){
  return unit?.id==='hero'||!!unit?.veteranId||['escort','trainer','commander','speaker'].includes(unit?.role)||/claimant/i.test(unit?.name??'');
}
export const stageLabels={
  // A unit's label: created once, then its allegiance, readout and strength follow the encounter.
  syncLabel(u,encounter){
    if(!this.labels.has(u.id)){
      const label=document.createElement('div');label.dataset.unitId=u.id;
      label.innerHTML='<span class="world-role"></span>'+
      '<span class="world-name"></span><span class="world-signal"></span><span class="world-short"></span><span class="world-health"><i></i></span>'+
      '<span class="world-detail"></span><strong></strong><span class="world-leader">'+
      '</span>';this.labelLayer.append(label);this.labels.set(u.id,label);
      this.labelRefs.set(u.id,
        {name:label.querySelector('.world-name'),signal:label.querySelector('.world-signal'),short:label.querySelector('.world-short'),
          health:label.querySelector('i'),detail:label.querySelector('.world-detail'),effect:label.querySelector('strong'),
          leader:label.querySelector('.world-leader')});
    }
    const label=this.labels.get(u.id),readout=actorReadout(u,encounter);
    label.className=`world-unit ${u.side==='enemy'?'enemy':u.side==='neutral'?'neutral':'friendly'} ${readout.tone}${civicActor(u)&&!isAlive(u)?' withdrawn':''}`;
    label.dataset.type=readout.type;label.dataset.role=labelRole(u);if(u.bloc)label.dataset.bloc=u.bloc;else delete label.dataset.bloc;
    label.classList.toggle('named',namedFigure(u));
    const refs=this.labelRefs.get(u.id);refs.name.textContent=u.name||u.id;refs.signal.textContent=readout.signal;refs.detail.textContent=readout.detail;
    refs.short.textContent=readout.type==='vote'?`${readout.value>0?'+':''}${readout.value}`:readout.type==='resolve'?`${readout.value} R`:'';
    refs.short.title=readout.signal;
    refs.health.style.width=`${readout.ratio*100}%`;label.hidden=!actorVisible(u);refs.stateKey=null;
  },
  // Nothing to lay out again while the camera, the figures and the labels'
  // contents all hold still (most frames while the player is deciding).
  labelsUnchanged(){
    const e=this.camera.matrixWorld.elements,list=[this.viewportWidth,this.viewportHeight,...e],
      state=`${this.cameraView}|${this.selected}|${this.inspected}|${this.hovered}`;
    for(const a of this.actors.values()){const p=a.group.position;list.push(a.group.visible?1:0,p.x,p.y,p.z);}
    const last=this.labelSignature,same=!!last&&last.state===state&&last.list.length===list.length&&list.every((v,i)=>Math.abs(v-last.list[i])<1e-6);
    this.labelSignature={state,list};return same;
  },
  positionLabels(){
    const width=this.viewportWidth,height=this.viewportHeight,items=[],elements=new Map();if(!width||!height)return;
    const unchanged=this.labelsUnchanged();if(unchanged&&!this.animation&&!this.labelSizeDirty&&!this.labelContentDirty)return;this.labelContentDirty=false;
    for(const [id,actor]of this.actors){
      const label=this.labels.get(id),refs=this.labelRefs.get(id);if(!actor.group.visible){label.dataset.layout='offscreen';continue;}
      const screen=this.screenPoint.copy(actor.group.position);screen.y+=(actor.group.userData.actor?.height??2.03)+.12;screen.project(this.camera);
      if(this.labelSizeDirty||!refs.width||refs.effectText!==refs.effect.textContent){
        refs.width=label.offsetWidth;refs.height=label.offsetHeight;refs.effectText=refs.effect.textContent;
      }
      const effect=!!refs.effect.textContent,
        priority=id===this.inspected||id===this.hovered?110:id===this.selected?100:effect?80:label.dataset.type==='vote'?40:30;
      const selectedActor=this.actors.get(this.selected),
        relevant=contextualLabelVisible({view:this.cameraView,selected:id===this.selected,focused:id===this.inspected||id===this.hovered,effect,
          vote:label.dataset.type==='vote',enemy:label.classList.contains('enemy'),
          distance:selectedActor?actor.group.position.distanceTo(selectedActor.group.position):Infinity});
      if(!relevant){label.style.visibility='hidden';label.dataset.layout='context';continue;}
      items.push({id,x:(screen.x*.5+.5)*width,y:(-screen.y*.5+.5)*height,width:refs.width,height:refs.height,priority,visible:Math.abs(screen.z)<=1});
      elements.set(id,{label,leader:refs.leader});
    }
    for(const [id,marker]of this.missionMarkers){
      const key=`objective:${id}`,point=this.screenPoint.copy(marker.mesh.position);point.y+=.2;point.project(this.camera);
      if(this.labelSizeDirty||!marker.width){marker.width=marker.label.offsetWidth;marker.height=marker.label.offsetHeight;}
      items.push({id:key,x:(point.x*.5+.5)*width,y:(-point.y*.5+.5)*height,width:marker.width,height:marker.height,priority:60,visible:Math.abs(point.z)<=1});
      elements.set(key,{label:marker.label});
    }
    const obstacles=[],body=this.actors.get(this.selected);
    if(body?.group.visible&&(this.cameraView!=='overview'||this.animation)){
      const base=body.group.position,radius=body.group.userData.actor?.mounted?.72:.38,bodyHeight=body.group.userData.actor?.height??2.03,points=[];
      for(const x of [-radius,radius])for(const z of [-radius,radius])for(const y of [.05,bodyHeight]){
        const p=this.screenPoint.copy(base).add(new T.Vector3(x,y,z)).project(this.camera);
        if(p.z>=-1&&p.z<=1)points.push({x:(p.x*.5+.5)*width,y:(-p.y*.5+.5)*height});
      }
      if(points.length===8){
        const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
        obstacles.push({id:this.selected,x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y});
      }
    }
    const layout=layoutStageLabels(items,{width,height,top:this.canvas.parentElement.classList.contains('world-stage')?92:8,obstacles}),
      counts={visible:0,occluded:0,offscreen:0,overlaps:0};
    for(const [id,r]of layout){
      const {label,leader}=elements.get(id);label.dataset.layout=r.reason;counts[r.reason]++;label.style.visibility=r.visible?'visible':'hidden';
      if(!r.visible)continue;label.style.transform=`translate(${r.x}px,${r.y}px)`;
      if(leader){
        const dx=r.anchorX-(r.x+r.width/2),dy=r.anchorY-(r.y+r.height),length=Math.hypot(dx,dy);leader.style.width=`${length}px`;
        leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;leader.style.display=length>15?'block':'none';
      }
    }
    this.labelStats=counts;this.labelSizeDirty=false;
  }
};
