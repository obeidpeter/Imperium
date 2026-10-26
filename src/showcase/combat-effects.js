import * as T from '../../vendor/three/three.module.js';
import {createArrowGeometry,remainsHash} from './battle-remains.js';
import {createParticleMaterial,installParticleAttributes} from './stage-particles.js';

// Weight in combat, drawn from the timeline the stage already plays: a fading
// ribbon behind each swung blade (or, for painted figures, a brushed arc where
// the blow travels), every archer and javelin-man in a formation loosing with
// his leader, and dust thrown up by running men and horses on dry ground.
// Presentation only: fixed hashes, never gameplay randomness; nothing here is
// picked, and reduced motion draws none of it (the stage plays no timeline).
export const TRAIL_SECONDS=.16;
export const TRAIL_SAMPLES=12;
export const VOLLEY_LIMIT=32;
export const DUST_LIMIT=120;
const DUST_SECONDS=.9;

// Where a follower's shot is at `progress` of its flight: a parabola from
// shooter to mark, nose along the path. Scatter keeps a volley from stacking.
export function volleyPose(from,to,progress,{index=0,seed='',arc=.65}={}){
  const angle=remainsHash(seed,index,'s')*Math.PI*2,radius=.25+remainsHash(seed,index,'d')*.8;
  const tx=to.x+Math.cos(angle)*radius,tz=to.z+Math.sin(angle)*radius,ty=to.y,p=Math.max(0,Math.min(1,progress));
  const lift=(t)=>arc*4*t*(1-t)*Math.max(1,Math.hypot(tx-from.x,tz-from.z)*.12);
  const at=t=>new T.Vector3(from.x+(tx-from.x)*t,from.y+(ty-from.y)*t+lift(t),from.z+(tz-from.z)*t);
  const position=at(p),ahead=at(Math.min(1,p+.02)),back=at(Math.max(0,p-.02)),direction=ahead.sub(back).normalize();
  return {position,direction,target:new T.Vector3(tx,ty,tz)};
}

export function createCombatEffects(scene,{particleMask=null,quality='balanced'}={}){
  const group=new T.Group();group.name='combat effects';group.userData.cameraOcclusion=false;scene.add(group);
  const owned=[];let disposed=false,now=0;
  // Trails: a pool of ribbons, each the last few tip and inner-blade points.
  const trailMaterial=new T.MeshBasicMaterial({name:'blade trail',vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,blending:T.AdditiveBlending,fog:false,toneMapped:false});owned.push(trailMaterial);
  const trails=[];
  for(let k=0;k<4;k++){
    const geometry=new T.BufferGeometry(),positions=new Float32Array(TRAIL_SAMPLES*2*3),colors=new Float32Array(TRAIL_SAMPLES*2*4),index=[];
    for(let i=0;i<TRAIL_SAMPLES-1;i++){const a=i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
    geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('color',new T.BufferAttribute(colors,4).setUsage(T.DynamicDrawUsage));geometry.setIndex(index);
    const mesh=new T.Mesh(geometry,trailMaterial);mesh.name='blade trail';mesh.frustumCulled=false;mesh.visible=false;mesh.raycast=()=>{};mesh.renderOrder=3;group.add(mesh);owned.push(geometry);
    trails.push({mesh,positions,colors,samples:[],owner:null});
  }
  const trailFor=id=>trails.find(t=>t.owner===id)??trails.find(t=>!t.samples.length)??trails.reduce((a,b)=>a.samples[a.samples.length-1]?.time<b.samples[b.samples.length-1]?.time?a:b);
  function writeTrail(trail){
    const live=trail.samples.filter(s=>now-s.time<=TRAIL_SECONDS);trail.samples=live;
    if(live.length<2){trail.mesh.visible=false;if(!live.length)trail.owner=null;return;}
    for(let i=0;i<TRAIL_SAMPLES;i++){
      const s=live[Math.max(0,live.length-TRAIL_SAMPLES+i)]??live[0],fade=Math.max(0,1-(now-s.time)/TRAIL_SECONDS)*(i/(TRAIL_SAMPLES-1));
      trail.positions.set([s.tip.x,s.tip.y,s.tip.z,s.base.x,s.base.y,s.base.z],i*6);
      trail.colors.set([1,.94,.82,.55*fade,1,.9,.75,0],i*8);
    }
    trail.mesh.geometry.attributes.position.needsUpdate=true;trail.mesh.geometry.attributes.color.needsUpdate=true;trail.mesh.visible=true;
  }
  // Volley: follower shots in flight, one batch of instances.
  const arrowGeometry=createArrowGeometry();owned.push(arrowGeometry);
  const arrowMaterial=new T.MeshStandardMaterial({name:'volley arrows',vertexColors:true,roughness:.8,side:T.DoubleSide});owned.push(arrowMaterial);
  const volley=new T.InstancedMesh(arrowGeometry,arrowMaterial,VOLLEY_LIMIT);volley.name='volley arrows';volley.count=0;volley.frustumCulled=false;volley.castShadow=false;volley.raycast=()=>{};group.add(volley);
  const matrix=new T.Matrix4(),quaternion=new T.Quaternion(),scale=new T.Vector3(),UP=new T.Vector3(0,1,0);
  // Dust: a ring of soft particles that rise, spread and fade.
  const dustPositions=new Float32Array(DUST_LIMIT*3),dustColors=new Float32Array(DUST_LIMIT*4),dust=[];let dustNext=0,dustEmitted=0;
  const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3).setUsage(T.DynamicDrawUsage));dustGeometry.setAttribute('color',new T.BufferAttribute(dustColors,4).setUsage(T.DynamicDrawUsage));installParticleAttributes(dustGeometry);owned.push(dustGeometry);
  const dustMaterial=createParticleMaterial(particleMask,{name:'thrown dust',size:quality==='performance'?.95:1.25,alphaTest:.01});owned.push(dustMaterial);
  const dustPoints=new T.Points(dustGeometry,dustMaterial);dustPoints.name='thrown dust';dustPoints.frustumCulled=false;dustPoints.raycast=()=>{};group.add(dustPoints);
  for(let i=0;i<DUST_LIMIT;i++)dust.push({born:-Infinity,x:0,y:0,z:0,dx:0,dz:0});
  return {group,
    // One sample of a blade (or a painted arc) for unit `id` at the stage's clock.
    trail(id,tip,base){if(disposed||!tip||!base)return;const trail=trailFor(id);if(trail.owner!==id){trail.owner=id;trail.samples=[];}trail.samples.push({time:now,tip:tip.clone(),base:base.clone()});if(trail.samples.length>TRAIL_SAMPLES*2)trail.samples.shift();},
    // Follower shots this frame: [{from,to,progress,index,seed,size}].
    volley(shots=[]){
      if(disposed)return 0;let n=0;
      for(const shot of shots){if(n>=VOLLEY_LIMIT)break;const pose=volleyPose(shot.from,shot.to,shot.progress,shot);quaternion.setFromUnitVectors(UP,pose.direction.clone().negate());scale.setScalar(shot.size??1);
        // The arrow geometry stands tip-down; flying, the tip leads.
        volley.setMatrixAt(n++,matrix.compose(pose.position,quaternion,scale));}
      volley.count=n;volley.instanceMatrix.needsUpdate=true;return n;
    },
    // A puff of dust at a runner's feet; the stage gates wet ground.
    dust(x,y,z,{amount=1,seed=''}={}){
      if(disposed)return;const count=Math.max(1,Math.round(amount));
      for(let k=0;k<count;k++){const p=dust[dustNext],a=remainsHash(seed,dustEmitted,'a')*Math.PI*2,r=.15+remainsHash(seed,dustEmitted,'r')*.25;
        Object.assign(p,{born:now,x:x+Math.cos(a)*r,y:y+.08,z:z+Math.sin(a)*r,dx:Math.cos(a)*.35,dz:Math.sin(a)*.35});dustNext=(dustNext+1)%DUST_LIMIT;dustEmitted++;}
    },
    update(time=0){
      if(disposed||!Number.isFinite(time))return;now=time;
      for(const trail of trails)if(trail.samples.length)writeTrail(trail);else trail.mesh.visible=false;
      let live=0;
      dust.forEach((p,i)=>{const age=(now-p.born)/DUST_SECONDS;
        if(age<0||age>=1){dustColors[i*4+3]=0;return;}live++;
        dustPositions.set([p.x+p.dx*age,p.y+.45*Math.sqrt(age),p.z+p.dz*age],i*3);dustColors.set([.8,.72,.57,.62*(1-age)*Math.min(1,age*8)],i*4);});
      dustGeometry.attributes.position.needsUpdate=true;dustGeometry.attributes.color.needsUpdate=true;dustPoints.visible=live>0;
    },
    stats(){return {trails:trails.filter(t=>t.mesh.visible).length,volley:volley.count,dust:dust.filter(p=>now-p.born<DUST_SECONDS&&now>=p.born).length,disposed};},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();volley.dispose();for(const o of owned)o.dispose?.();}
  };
}
