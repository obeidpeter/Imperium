import {RIVER_WATER_LEVEL} from './environment-layout.js';
import * as T from '../../vendor/three/three.module.js';
import {actorVisible,reinforcementBeacons,tacticalLinks,targetRingColor,threatEnvelope} from './stage-readout.js';
import {createFlamePlume} from './stage-particles.js';

// What the 3D board draws over the field: selection and target rings, the
// route ink, morale rings, reinforcement beacons, chamber standards,
// fieldworks, battle marks on the ground, tactical links and the grid.
export const stageOverlays={
  releaseOverlay(group){
    this.overlay?.remove(group);
    group.traverse(o=>{
      if(o.geometry&&o.geometry!==this.targetGeometry&&o.geometry!==this.ringGeometry)o.geometry.dispose();
      for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.dispose();if(o.isLight)o.dispose?.();
    });
  },
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
  },
  updateReinforcementBeacons(encounter=this.encounter){
    if(!this.overlay)return;
    this.reinforcementBeacons=this.reinforcementBeacons??new Map();
    const waves=reinforcementBeacons(encounter);
    const wanted=new Set(waves.map(w=>w.id));
    for(const [id,group]of this.reinforcementBeacons)if(!wanted.has(id)){this.releaseOverlay(group);this.reinforcementBeacons.delete(id);}
    for(const w of waves){
      if(!this.reinforcementBeacons.has(w.id)){
        const group=this.beaconGroup();this.overlay.add(group);this.reinforcementBeacons.set(w.id,group);
      }
      const group=this.reinforcementBeacons.get(w.id),color=w.imminent?'#c44d3f':'#d89b3c';
      group.position.copy(this.world(w));group.position.y+=.06;
      group.children[0]?.material?.color?.set(color);
      group.children[1]?.material?.color?.set(color);
      group.userData.wave=w;
      group.visible=true;
    }
  },
  beaconGroup(){
    const group=new T.Group();group.name='reinforcement-beacon';
    const ring=new T.Mesh(this.targetGeometry,new T.MeshBasicMaterial({color:'#d89b3c',transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide}));
    ring.rotation.x=-Math.PI/2;
    const spire=new T.Mesh(new T.ConeGeometry(.16,.55,4),new T.MeshBasicMaterial({color:'#df9d85',transparent:true,opacity:.82}));
    spire.position.set(0,.32,0);spire.rotation.x=Math.PI;
    group.add(ring,spire);return group;
  },
  updateChamberStandards(encounter=this.encounter){
    if(!this.overlay)return;
    const isContest=encounter?.kind==='contest';
    for(const [bloc,x]of [['Veterans',-5.2],['Landholders',0],['Civic',5.2]]){
      if(!isContest){const existing=this.chamberStandards.get(bloc);if(existing)existing.group.visible=false;continue;}
      if(!this.chamberStandards.has(bloc)){
        const group=new T.Group();group.name=`bloc-standard:${bloc}`;group.position.set(x,0,-11.2);
        const pole=new T.Mesh(new T.CylinderGeometry(.045,.055,3.2,8),new T.MeshStandardMaterial({color:'#a98c55',metalness:.65,roughness:.38}));
        pole.position.y=1.6;
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
  },
  updateFieldworks(encounter=this.encounter){
    if(!this.overlay)return;
    this.fieldworkMeshes=this.fieldworkMeshes??new Map();
    const list=encounter?.kind==='battle'?(encounter.fieldworks??[]):[];
    const wanted=new Set(list.map(f=>`${f.type}:${f.x},${f.y}`));
    for(const [key,group]of this.fieldworkMeshes)if(!wanted.has(key)){this.releaseOverlay(group);this.fieldworkMeshes.delete(key);}
    for(const fw of list){
      const key=`${fw.type}:${fw.x},${fw.y}`;
      if(!this.fieldworkMeshes.has(key)){
        const group=this.fieldworkGroup(fw.type);group.userData.fieldwork=fw;
        this.overlay.add(group);this.fieldworkMeshes.set(key,group);
      }
      const group=this.fieldworkMeshes.get(key);group.position.copy(this.world(fw));group.visible=true;
    }
  },
  // A player-built fieldwork. A brazier borrows the stage's one point light
  // (tick): adding a light would recompile every lit program mid-battle.
  fieldworkGroup(type){
    const group=new T.Group();group.name=`fieldwork:${type}`;
    if(type==='stakes'){
      const wood=new T.MeshStandardMaterial({color:'#6e5034',roughness:.85});
      for(const x of [-.45,0,.45]){
        const stake=new T.Mesh(new T.ConeGeometry(.08,.85,6),wood);stake.position.set(x,.38,0);stake.rotation.z=-.38;group.add(stake);
      }
    }else if(type==='rampart'){
      const turf=new T.Mesh(new T.BoxGeometry(1.55,.48,.58),new T.MeshStandardMaterial({color:'#6b5a42',roughness:.9}));turf.position.set(0,.24,.55);
      group.add(turf);
    }else if(type==='brazier'){
      const stand=new T.Mesh(new T.CylinderGeometry(.24,.15,.52,8),new T.MeshStandardMaterial({color:'#46423d',metalness:.7,roughness:.45}));
      stand.position.set(.52,.26,.45);
      const fire=new T.Mesh(new T.SphereGeometry(.2,8,6),new T.MeshBasicMaterial({color:'#ff9b3d'}));fire.position.set(.52,.56,.45);
      const plume=createFlamePlume(this.particleMask??null);plume.position.set(.52,.56,.45);
      group.userData.brazierLightAt=new T.Vector3(.52,.88,.45);group.userData.flamePlume=plume;
      group.add(stand,fire,plume);
    }
    return group;
  },
  updateBattleDecals(encounter=this.encounter,extraTiles=[]){
    if(!this.overlay)return;
    this.battleDecals=this.battleDecals??new Map();
    if(encounter?.kind!=='battle'){for(const decal of this.battleDecals.values())decal.visible=false;return;}
    const tiles=[];
    for(const u of encounter.units??[])if(!u.hidden&&(u.hp??1)<=0&&Number.isFinite(u.x)&&Number.isFinite(u.y))tiles.push({x:u.x,y:u.y,kind:'fallen'});
    for(const ev of encounter.turnEvents??[])if(['strike','shot','focus','volley','charge'].includes(ev.kind)&&Number.isFinite(ev.x)&&Number.isFinite(ev.y))tiles.push({x:ev.x,
      y:ev.y,kind:'clash'});
    for(const extra of extraTiles)if(extra&&Number.isFinite(extra.x)&&Number.isFinite(extra.y))tiles.push({x:extra.x,y:extra.y,kind:extra.kind??'clash'});
    const wanted=new Set(tiles.map(t=>`${t.x},${t.y}`));
    for(const [key,group]of this.battleDecals)if(!wanted.has(key))group.visible=false;
    for(const tile of tiles){
      const key=`${tile.x},${tile.y}`;
      if(!this.battleDecals.has(key)){
        const group=new T.Group();group.name='battle-decal';group.userData.decal=tile;
        const ring=new T.Mesh(new T.RingGeometry(.28,.54,24),
          new T.MeshBasicMaterial({color:tile.kind==='fallen'?'#4a2822':'#3d3328',transparent:true,opacity:.36,depthWrite:false,side:T.DoubleSide}));
        ring.rotation.x=-Math.PI/2;
        const slash=new T.Mesh(new T.PlaneGeometry(.62,.07),
          new T.MeshBasicMaterial({color:'#2a231c',transparent:true,opacity:.32,depthWrite:false,side:T.DoubleSide}));
        slash.rotation.x=-Math.PI/2;slash.rotation.z=((tile.x*3+tile.y*5)%7)*.45;
        group.add(ring,slash);this.overlay.add(group);this.battleDecals.set(key,group);
      }
      const group=this.battleDecals.get(key);group.position.copy(this.world(tile));group.position.y+=.026;group.visible=true;
    }
  },
  // The timeline's own clock marks the ground, however few frames are drawn:
  // a shot leaves a spent arrow or javelin when its flight ends, a blow churns
  // the earth when it lands. Ending or skipping the motion marks the rest.
  markGround(time=Infinity){
    const live=Number.isFinite(time)&&!this.reducedMotion;
    for(const mark of this.animation?.marks??[]){
      if(mark.done||mark.at>time)continue;mark.done=true;const fx=mark.fx;
      // A blow that lands holds the motion for a beat and jolts the camera.
      if(live&&fx.type!=='projectile'){
        const hold=Math.min(70,220-(this.animation.hitStop??0));if(hold>0){this.animation.start+=hold;this.animation.hitStop=(this.animation.hitStop??0)+hold;}
        if(this.actionCamera!==false)this.cameraKick=Math.min(1,(this.cameraKick??0)+.75);
      }
      if(!this.remains)continue;
      if(fx.type==='projectile')this.remains.arrows({from:this.world(fx.from).add(new T.Vector3(0,1.4,0)),to:this.world(fx.to),
        count:Math.min(9,1+(mark.volley??0)),seed:`${fx.start}:${fx.from.x}:${fx.from.y}`,size:fx.projectile==='arrow'?1:2.1});
      else if(fx.at){const at=this.world(fx.at);this.remains.churn(at.x,at.z);}
    }
  },
  updateTacticalLinks(target=null,action=this.selectedAction){
    if(!this.overlay)return;
    this.tacticalArcs=this.tacticalArcs??[];
    const links=tacticalLinks(this.encounter,{selected:this.selected,target,action});
    this.tacticalArcs.forEach(line=>line.visible=false);
    for(const [i,link]of links.entries()){
      if(!this.tacticalArcs[i]){
        const line=this.tacticalLine(link.color);this.overlay.add(line);this.tacticalArcs.push(line);
      }
      const line=this.tacticalArcs[i],pos=line.geometry.attributes.position;
      if(link.kind==='path'&&link.points?.length>=2){
        const pts=link.points.map(p=>this.world(p)),segs=pts.length-1;
        for(let s=0;s<=16;s++){
          const f=(s/16)*segs,idx=Math.min(segs-1,Math.floor(f)),t=f-idx,a=pts[idx],b=pts[idx+1];
          const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=(this.surfaceHeight?.(x,z)??this.environment?.groundHeight?.(x,z)??a.y+(b.y-a.y)*t)+.11;
          pos.setXYZ(s,x,y,z);
        }
      }else{
        const from=this.world(link.from),to=this.world(link.to);
        const elevated=['aim','intent'].includes(link.kind),baseY=elevated?1.15:.22,peak=elevated?1.35:.36;
        for(let s=0;s<=16;s++){const t=s/16;pos.setXYZ(s,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t+baseY+Math.sin(t*Math.PI)*peak,from.z+(to.z-from.z)*t);}
      }
      pos.needsUpdate=true;line.material.color.set(link.color);line.userData.linkKind=link.kind;line.visible=true;
    }
  },
  tacticalLine(color){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(17*3),3));
    const line=new T.Line(g,new T.LineBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false}));line.name='tactical-link';line.frustumCulled=false;
    return line;
  },
  setSelection(selected,targets=[],target=null){
    this.wake();this.selected=selected;this.targets=targets;this.selectedAction=target?.action??null;this.labelSizeDirty=true;
    if(this.targetMaterial)this.targetMaterial.color.set(targetRingColor(this.selectedAction,this.encounter,targets[0]??target));
    const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2),scale=new T.Vector3(1,1,1);
    this.legalTargets.count=Math.min(targets.length,this.legalTargets.instanceMatrix.count);
    for(let i=0;i<this.legalTargets.count;i++){
      const point=this.world(targets[i]);point.y+=.055;this.matrix.compose(point,rotation,scale);this.legalTargets.setMatrixAt(i,this.matrix);
    }
    this.legalTargets.instanceMatrix.needsUpdate=true;
    this.inspected=target&&(target.unitId??this.unitAt(target)?.id);
    this.previewTarget=target?.previewBadge&&this.inspected?{unitId:this.inspected,...target.previewBadge}:null;
    this.previewTargets=target?.previewBadges??(this.previewTarget?{[this.previewTarget.unitId]:this.previewTarget}:null);
    this.hoverRing.visible=!!target;if(target){this.hoverRing.position.copy(this.world(target));this.hoverRing.position.y+=.08;}
    this.updateTacticalLinks(target,this.selectedAction);this.updateInk();
  },
  // The ink shows the chosen action's reach (or, with nothing chosen, the
  // ground the unit can walk to), the route a click there would walk and,
  // for an enemy under the pointer or inspected, everything it could strike
  // next turn.
  updateInk(){
    if(!this.ink||!this.encounter)return;const enemy=[this.inspected,this.hovered].find(id=>id&&this.encounter.units?.find(u=>u.id===id)?.side==='enemy');
    this.ink.paint({targets:this.targets??[],color:`#${this.targetMaterial?.color.getHexString()??'89cfcb'}`,
      threat:enemy?threatEnvelope(this.encounter,enemy):null,reach:this.reach??[],route:this.route??null});
  },
  // From the campaign UI (Game.moveRoute and the selected unit's move targets).
  setRoute(route=null,reach=[]){this.wake();this.route=route;this.reach=reach;this.updateInk();},
  setGrid(show){
    // Grid edges drape over plateau banks and lie on river water rather than floating at a cell's centre height.
    if(!this.grid){
      const lines=[],h=(x,z)=>Math.max(this.surfaceHeight?.(x,z)??this.environment.groundHeight(x,z),RIVER_WATER_LEVEL)+.04;
      for(let x=0;x<this.encounter.width;x++)for(let y=0;y<this.encounter.height;y++){
        const p=this.world({x,y});
        for(const [a,b,c,d]of [[-1.25,-1.25,1.25,-1.25],[-1.25,-1.25,-1.25,1.25]])for(let k=0;k<8;k++){
          const x0=p.x+a+(c-a)*k/8,z0=p.z+b+(d-b)*k/8,x1=p.x+a+(c-a)*(k+1)/8,z1=p.z+b+(d-b)*(k+1)/8;lines.push(x0,h(x0,z0),z0,x1,h(x1,z1),z1);
        }
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(lines,3));
      this.grid=new T.LineSegments(geometry,new T.LineBasicMaterial({color:'#dfd6b3',transparent:true,opacity:.32,depthWrite:false}));this.scene.add(this.grid);
    }
    this.grid.visible=!!show;
  },
  redrapeGroundOverlays(){
    this.ink?.redrape();
    if(!this.grid)return;
    const geometry=this.grid.geometry,pos=geometry.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,Math.max(this.surfaceHeight?.(x,z)??this.environment.groundHeight(x,z),RIVER_WATER_LEVEL)+.04);
    }
    pos.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
  }
};
