import * as T from '../../vendor/three/three.module.js';

// What a battle leaves on the ground. Men who drop out of a formation and units
// the rules have defeated lie where they fell, darkened and low; spent arrows
// stand in the turf around their marks; and the ground is trodden dark where
// men have marched and fought. Presentation only: it is drawn from the units'
// own state and the timeline the stage already plays, it is never picked or
// read by the rules, it uses no gameplay randomness, and a setting hides it.
// It lasts as long as the stage; a rebuilt stage lays out again the units the
// rules record as defeated.
// A baked body is the figure's overview surfaces (around 11k triangles), so
// the count on the field is capped per quality tier, oldest first.
export const REMAINS_LIMIT=Object.freeze({performance:6,balanced:12,high:20});
export const ARROW_LIMIT=64;
export const WEAR_PIXELS_PER_METRE=16;
const FALL_SECONDS=.38;
export function remainsHash(...values){let h=2166136261;for(const c of values.join(':'))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295;}
const ease=t=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};
function makeCanvas(width,height){
  if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(width,height);
  const canvas=globalThis.document?.createElement?.('canvas');if(!canvas)return null;canvas.width=width;canvas.height=height;return canvas;
}

// The input that holds a sculpted figure in its collapse for baking. A horse's
// collapse leaves its legs through the ground, so horse and rider are baked
// standing and then laid on their side.
export const FALLEN_POSE=Object.freeze({motion:'dead',phase:1,health:0,reducedMotion:true,dt:0,resetPose:true,time:0});
export const MOUNTED_FALLEN_POSE=Object.freeze({motion:'idle',phase:0,health:1,reducedMotion:true,dt:0,resetPose:true,time:0});
// A figure's overview surfaces in its present pose, laid down: forward onto
// the ground for a man, onto its side for a horse and rider. Colours are
// darkened and drained a little, as for the dead. Figure-local metres.
export function bakeFallenGeometry(group,{mounted=false}={}){
  group.updateMatrixWorld(true);
  const inverse=group.matrixWorld.clone().invert(),local=new T.Matrix4(),v=new T.Vector3(),positions=[],colors=[];
  // Held weapons stay with the living pose; in the collapse they would spear the ground.
  const held=o=>{for(let p=o;p&&p!==group;p=p.parent)if(/^(sword|spear|practice-sword|held-javelin|nocked-arrow|bow)$/.test(p.name))return true;return false;};
  group.traverse(o=>{
    if(!o.isMesh||!o.userData.overview||o.userData.formationCrowd||!o.geometry?.attributes?.position||held(o))return;
    const g=o.geometry,p=g.attributes.position,c=g.attributes.color,tint=o.material?.color??new T.Color(1,1,1),index=g.index,count=index?index.count:p.count;
    local.multiplyMatrices(inverse,o.matrixWorld);
    for(let k=0;k<count;k++){
      const i=index?index.getX(k):k;v.fromBufferAttribute(p,i);
      if(o.isSkinnedMesh)o.applyBoneTransform(i,v);
      v.applyMatrix4(local);positions.push(v.x,v.y,v.z);
      const r=tint.r*(c?.getX(i)??1),gg=tint.g*(c?.getY(i)??1),b=tint.b*(c?.getZ(i)??1),l=r*.2126+gg*.7152+b*.0722;
      colors.push((l+(r-l)*.5)*.5,(l+(gg-l)*.5)*.5,(l+(b-l)*.5)*.5);
    }
  });
  if(!positions.length)return null;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const lay=new T.Matrix4();
  if(mounted)lay.makeTranslation(0,1,0).multiply(new T.Matrix4().makeRotationZ(1.42)).multiply(new T.Matrix4().makeTranslation(0,-1,0));
  else lay.makeTranslation(0,.32,0).multiply(new T.Matrix4().makeRotationX(.95)).multiply(new T.Matrix4().makeTranslation(0,-.32,0));
  geometry.applyMatrix4(lay);geometry.computeBoundingBox();geometry.translate(0,.02-geometry.boundingBox.min.y,0);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
// An arrow standing in the ground: tip at the origin, shaft up its +Y axis.
export function createArrowGeometry(){
  const shaft=new T.CylinderGeometry(.009,.009,.66,5,1,true);shaft.translate(0,.33,0);
  const parts=[shaft];
  for(const turn of [0,Math.PI/1.5,Math.PI*2/1.5]){const vane=new T.PlaneGeometry(.045,.12);vane.translate(.024,.56,0);vane.rotateY(turn);parts.push(vane);}
  const positions=[],normals=[],colors=[];
  parts.forEach((part,k)=>{const s=part.index?part.toNonIndexed():part;positions.push(...s.attributes.position.array);normals.push(...s.attributes.normal.array);for(let i=0;i<s.attributes.position.count;i++)colors.push(...(k?[.86,.82,.74]:[.52,.42,.30]));if(s!==part)s.dispose();part.dispose();});
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeBoundingSphere();return geometry;
}
// Where spent arrows land around a mark: deterministic, clear of the man
// standing there, leaning back toward whoever loosed them.
export function arrowLanding(from,to,index,seed=''){
  const angle=remainsHash(seed,index,'a')*Math.PI*2,radius=.42+remainsHash(seed,index,'r')*.78;
  const x=to.x+Math.cos(angle)*radius,z=to.z+Math.sin(angle)*radius,dx=from.x-to.x,dz=from.z-to.z,length=Math.hypot(dx,dz)||1;
  const pitch=.62+remainsHash(seed,index,'p')*.5,back=new T.Vector3(dx/length*Math.cos(pitch),Math.sin(pitch),dz/length*Math.cos(pitch)).normalize();
  return {x,z,axis:back};
}

export function createBattleRemains(scene,{quality='balanced',ground=null,heightAt=()=>0,bounds={minX:-12,maxX:12,minZ:-12,maxZ:12},visible=true}={}){
  const group=new T.Group();group.name='battle remains';group.userData.cameraOcclusion=false;group.visible=visible;scene.add(group);
  const limit=REMAINS_LIMIT[quality]??REMAINS_LIMIT.balanced,kinds=new Map(),bodies=[],laid=new Set(),owned=new Set();
  // Drawn from both sides like the spent arrows among them, so the two share a program.
  const bodyMaterial=new T.MeshStandardMaterial({name:'fallen figures',vertexColors:true,roughness:.96,metalness:0,side:T.DoubleSide});owned.add(bodyMaterial);
  const matrix=new T.Matrix4(),position=new T.Vector3(),quaternion=new T.Quaternion(),scale=new T.Vector3(1,1,1),UP=new T.Vector3(0,1,0),tilt=new T.Quaternion(),turn=new T.Quaternion(),side=new T.Vector3();
  let disposed=false,on=visible,now=0;const treads=new Map();
  // One instanced batch per figure appearance (or per painted unit).
  function kindFor(key,make){
    if(kinds.has(key))return kinds.get(key);
    const made=make();if(!made)return null;
    const material=made.material??bodyMaterial,mesh=new T.InstancedMesh(made.geometry,material,limit);mesh.name=`fallen ${made.label}`;mesh.count=0;mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.userData.bakedOcclusion=false;
    group.add(mesh);owned.add(made.geometry);owned.add(material);if(made.texture)owned.add(made.texture);
    const kind={key,mesh,items:[],flat:made.flat,scaleY:made.scaleY??1};kinds.set(key,kind);return kind;
  }
  function write(kind){
    kind.items.forEach((body,i)=>{
      const fall=body.start===null?1:ease((now-body.start)/FALL_SECONDS);
      // Falling: the figure drops the last of its height and settles flat.
      turn.setFromAxisAngle(UP,body.yaw);side.set(Math.cos(body.yaw),0,-Math.sin(body.yaw));
      tilt.setFromAxisAngle(side,kind.flat?(1-fall)*-.9:(1-fall)*-.55);quaternion.copy(tilt).multiply(turn);
      if(kind.flat)quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));
      position.set(body.world.x,body.world.y+(1-fall)*.25,body.world.z);scale.set(1,kind.scaleY,1);
      kind.mesh.setMatrixAt(i,matrix.compose(position,quaternion,scale));
    });
    kind.mesh.count=kind.items.length;kind.mesh.instanceMatrix.needsUpdate=true;
  }
  function addBody(kind,{world,yaw=0,animate=true}){
    const body={kind,world:world.clone(),yaw,start:animate?now:null};
    bodies.push(body);kind.items.push(body);
    while(bodies.length>limit){const old=bodies.shift();old.kind.items.splice(old.kind.items.indexOf(old),1);write(old.kind);}
    write(kind);return body;
  }
  // Arrows: one ring of instances, oldest replaced first.
  const arrowGeometry=createArrowGeometry(),arrowMaterial=new T.MeshStandardMaterial({name:'spent arrows',vertexColors:true,roughness:.85,side:T.DoubleSide});owned.add(arrowGeometry);owned.add(arrowMaterial);
  const arrows=new T.InstancedMesh(arrowGeometry,arrowMaterial,ARROW_LIMIT);arrows.name='spent arrows';arrows.count=0;arrows.castShadow=false;arrows.receiveShadow=true;arrows.frustumCulled=false;arrows.raycast=()=>{};group.add(arrows);
  let arrowNext=0,arrowTotal=0;
  // Trodden ground: a wear mask over the board, read by the ground's own shader.
  const width=Math.max(16,Math.ceil((bounds.maxX-bounds.minX)*WEAR_PIXELS_PER_METRE)),height=Math.max(16,Math.ceil((bounds.maxZ-bounds.minZ)*WEAR_PIXELS_PER_METRE));
  const canvas=makeCanvas(width,height),c=canvas?.getContext?.('2d');let wearTexture=null,wearDirty=false,wearUploaded=-1,dabs=0;
  const wear={battleWearMap:{value:null},battleWearBounds:{value:new T.Vector4(bounds.minX,bounds.minZ,1/(bounds.maxX-bounds.minX),1/(bounds.maxZ-bounds.minZ))},battleWearStrength:{value:visible?1:0}};
  if(c){c.fillStyle='#000';c.fillRect(0,0,width,height);wearTexture=new T.CanvasTexture(canvas);wearTexture.colorSpace=T.NoColorSpace;wearTexture.minFilter=wearTexture.magFilter=T.LinearFilter;wearTexture.generateMipmaps=false;wearTexture.name='battle ground wear';owned.add(wearTexture);wear.battleWearMap.value=wearTexture;}
  let wornMaterial=null;
  if(ground?.material&&wearTexture){
    const material=ground.material,previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
    material.onBeforeCompile=(shader,...args)=>{
      previous.call(material,shader,...args);Object.assign(shader.uniforms,wear);
      shader.vertexShader='varying vec3 vBattleWear;\n'+shader.vertexShader.replace('#include <project_vertex>','vBattleWear=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>');
      shader.fragmentShader='varying vec3 vBattleWear;\nuniform sampler2D battleWearMap;\nuniform vec4 battleWearBounds;\nuniform float battleWearStrength;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 wearUv=(vBattleWear.xz-battleWearBounds.xy)*battleWearBounds.zw;
        float trodden=texture2D(battleWearMap,clamp(wearUv,0.0,1.0)).r*step(0.0,min(min(wearUv.x,wearUv.y),min(1.0-wearUv.x,1.0-wearUv.y)))*battleWearStrength;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.74,.66,.55),trodden*.62);`);
    };
    material.customProgramCacheKey=()=>`${oldKey}:battle-wear-v1`;material.needsUpdate=true;wornMaterial={material,previous,oldKey};
  }
  function dab(x,z,radius,amount){
    if(!c||disposed)return false;
    const px=(x-bounds.minX)*WEAR_PIXELS_PER_METRE,pz=(z-bounds.minZ)*WEAR_PIXELS_PER_METRE,r=radius*WEAR_PIXELS_PER_METRE;
    if(px<-r||pz<-r||px>width+r||pz>height+r)return false;
    const g=c.createRadialGradient(px,pz,0,px,pz,r);g.addColorStop(0,`rgba(255,255,255,${Math.min(1,amount)})`);g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g;c.beginPath();c.arc(px,pz,r,0,Math.PI*2);c.fill();wearDirty=true;dabs++;return true;
  }
  return {group,wear,
    get visible(){return on;},
    setVisible(value){on=value!==false;group.visible=on;wear.battleWearStrength.value=on?1:0;},
    // A man leaves the rank: the actor (sculpted rig or painted card) shows who.
    fall({key,make,world,yaw=0,animate=true}){
      if(disposed||!world)return null;const kind=kindFor(key,make);if(!kind)return null;
      return addBody(kind,{world,yaw,animate});
    },
    // A unit the rules record as defeated, laid out once, clear of its tile's centre.
    layUnit(unit,{key,make,world,yaw=0,animate=true}){
      if(disposed||!unit?.id||laid.has(unit.id)||!world)return null;laid.add(unit.id);
      const a=remainsHash(unit.id,'lay')*Math.PI*2,offset=.42+remainsHash(unit.id,'off')*.3,x=world.x+Math.cos(a)*offset,z=world.z+Math.sin(a)*offset,y=heightAt(x,z);
      return this.fall({key,make,world:new T.Vector3(x,Number.isFinite(y)?y:world.y,z),yaw,animate});
    },
    hasLaid(id){return laid.has(id);},
    // The batch for each kind of figure on the field exists (empty) before the
    // battle is shown, so the first fall draws without compiling a shader.
    prepare(list=[]){if(disposed)return 0;let made=0;for(const {key,make}of list)if(!kinds.has(key)&&kindFor(key,make))made++;return made;},
    // count spent arrows (or javelins, at size) around the mark `to`, loosed from `from`.
    arrows({from,to,count=1,seed='',size=1}){
      if(disposed||!from||!to)return 0;let placed=0;
      for(let k=0;k<count;k++){
        const land=arrowLanding(from,to,arrowTotal+k,seed),y=heightAt(land.x,land.z);if(!Number.isFinite(y))continue;
        position.set(land.x,y-.07*size,land.z);quaternion.setFromUnitVectors(UP,land.axis);scale.set(size,size,size);
        arrows.setMatrixAt(arrowNext,matrix.compose(position,quaternion,scale));arrowNext=(arrowNext+1)%ARROW_LIMIT;placed++;
      }
      arrowTotal+=placed;arrows.count=Math.min(ARROW_LIMIT,arrowTotal);arrows.instanceMatrix.needsUpdate=true;return placed;
    },
    // Feet and hooves wear the ground along the whole path walked, a mark every
    // 30 cm however few frames are drawn; a clash churns it.
    tread(x,z,{mounted=false,id=''}={}){
      const last=treads.get(id),radius=mounted?.62:.38,amount=mounted?.16:.1;let marked=false;
      if(!last||Math.hypot(x-last.x,z-last.z)>3){marked=dab(x,z,radius,amount);treads.set(id,{x,z});return marked;}
      const steps=Math.floor(Math.hypot(x-last.x,z-last.z)/.3);
      for(let k=1;k<=steps;k++){const t=k/steps;marked=dab(last.x+(x-last.x)*t,last.z+(z-last.z)*t,radius,amount)||marked;}
      if(steps)treads.set(id,{x,z});return marked;
    },
    churn(x,z){return dab(x,z,.85,.22);},
    update(time=0){
      if(disposed||!Number.isFinite(time))return;now=time;
      for(const kind of kinds.values())if(kind.items.some(b=>b.start!==null&&now-b.start<FALL_SECONDS+.05))write(kind);
      if(wearDirty&&wearTexture&&(wearUploaded<0||now-wearUploaded>.25||now<wearUploaded)){wearTexture.needsUpdate=true;wearDirty=false;wearUploaded=now;}
    },
    stats(){return {visible:on,bodies:bodies.length,limit,kinds:kinds.size,arrows:arrows.count,dabs,wear:wearTexture?{width,height}:null,laid:laid.size,disposed};},
    dispose(){
      if(disposed)return;disposed=true;group.removeFromParent();
      if(wornMaterial){wornMaterial.material.onBeforeCompile=wornMaterial.previous;wornMaterial.material.customProgramCacheKey=()=>wornMaterial.oldKey;wornMaterial.material.needsUpdate=true;}
      for(const kind of kinds.values())kind.mesh.dispose();arrows.dispose();for(const item of owned)item.dispose?.();kinds.clear();bodies.length=0;
    }
  };
}
// Kind factories the stage hands to fall(): a sculpted figure baked in its
// collapse, or a painted figure's present painting laid flat.
export function sculptedFallenKind(actor,{label='figure'}={}){
  return ()=>{
    const geometry=actor?.bakeFallen?.();if(!geometry)return null;
    return {geometry,material:null,label,scaleY:actor.group?.scale?.y??1};
  };
}
export function paintedFallenKind(actor,{label='painted figure'}={}){
  return ()=>{
    const snap=actor?.snapshot?.();if(!snap)return null;
    const texture=new T.CanvasTexture(snap.canvas);texture.colorSpace=T.SRGBColorSpace;
    const geometry=new T.PlaneGeometry(snap.width,snap.height);geometry.translate(0,snap.feetOffset,0);
    const material=new T.MeshStandardMaterial({name:'fallen painted figure',map:texture,color:new T.Color(.5,.47,.44),alphaTest:.5,side:T.DoubleSide,roughness:1});
    return {geometry,material,texture,label,flat:true};
  };
}
