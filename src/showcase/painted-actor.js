import * as T from '../../vendor/three/three.module.js';
import {drawUnitSprite,spriteSpec} from '../ui/unit-sprites.js';
import {placeFollowers} from './formation.js';
import {installCloudShadows} from './atmosphere.js';

// Painted figures (HD-2D): the 2D campaign's own authored unit paintings stand
// in the 3D diorama as camera-facing cards. A second, sun-facing card casts the
// shadow, so the shadow keeps the figure's silhouette however the camera turns.
// Presentation only: it reads the unit and the shared timeline override, and
// never changes either. Without a 2D canvas (tests, workers) none is created.
export const PAINTED_CANVAS=Object.freeze({width:288,height:352,feet:330,figure:240,metres:1.95});
const SCALE=PAINTED_CANVAS.figure/117.5; // drawUnitSprite paints an infantryman 117.5 units tall at this tile width
const TILE_WIDTH=140/1.62,PER_METRE=PAINTED_CANVAS.figure/PAINTED_CANVAS.metres;
const GRID_FACING={east:Math.PI/2,south:0,west:-Math.PI/2,north:Math.PI};

// The authored columns show four 3/4 views. Pick the one whose painted
// direction matches the figure's yaw as seen from the camera: right/left on
// screen and toward/away from the viewer (the 2D board's own convention).
export function paintedColumn(direction,view){
  const fx=Math.sin(direction),fz=Math.cos(direction),length=Math.hypot(view?.x??0,view?.z??0)||1,ox=(view?.x??Math.SQRT1_2)/length,oz=(view?.z??Math.SQRT1_2)/length;
  const right=fx*oz-fz*ox,toward=fx*ox+fz*oz;
  return toward>=0?(right>=0?'east':'south'):(right>=0?'north':'west');
}
export const facingDirection=facing=>GRID_FACING[facing]??0;
// Painted figures carry their own painted light; the scene only tints them
// toward its sun and ambient colour, and darkens them at night or indoors.
export function paintedLight(profile={}){
  const sun=new T.Color(profile.sun??'#ffe4b4'),ambient=new T.Color(profile.ambient??'#a1b1a7'),light=ambient.lerp(sun,.55);
  light.multiplyScalar(1/Math.max(light.r,light.g,light.b,1e-3)).lerp(new T.Color(1,1,1),.6);
  const level={night:.62,interior:.96,dusk:.93,dawn:.97}[profile.timeOfDay]??1;
  return light.multiplyScalar(level*1.08).toArray().map(v=>Math.min(1.2,v));
}
// Painted figures are lit by the scene: a bevel at the painting's own edge
// (and a little relief from its brush values) gives each card a shape for the
// sun, torches and the rim light; light wraps a little past the terminator so a
// figure with the sun behind it is not lost; and a share of the painting's own
// light stays as self-illumination, so the art never goes muddy. The card takes
// its shadow from one point just sunward of the figure (in a wall's shade or
// out of it), never from its own sun-facing shadow card.
export const PAINTED_SHADING=Object.freeze({lit:.9,self:.3,wrap:.5,bevel:2.4,relief:.7,radius:3});
export function createPaintedLighting(){return {paintedSunShift:{value:new T.Vector3()}};}
const PAINTED_VERTEX_HEAD='uniform vec3 paintedSunShift;\nuniform float puppetTime;\nuniform float puppetSeed;\nuniform float puppetLean;\nuniform float puppetHit;\nuniform float puppetFacing;\n';
// Puppetry: breath lifts the shoulders, the figure sways from the feet, leans
// into an attack toward the side it faces on screen and squashes when struck.
// Followers take their own phase from where they stand. Reduced motion freezes
// the idle terms (the stage passes time 0).
const PAINTED_PUPPET=`
  float puppetHeight=clamp(position.y/2.0,0.0,1.25);
  float puppetPhase=puppetSeed*6.2831853;
  #ifdef USE_INSTANCING
    puppetPhase+=instanceMatrix[3].x*1.7+instanceMatrix[3].z*2.3;
  #endif
  float puppetBreath=sin(puppetTime*2.2+puppetPhase),puppetSway=sin(puppetTime*1.15+puppetPhase*1.3);
  transformed.x+=(puppetSway*.018+puppetLean*.16*puppetFacing)*puppetHeight*puppetHeight;
  transformed.y*=1.0+puppetBreath*.008*smoothstep(.35,.9,puppetHeight)-puppetHit*.06;
  transformed.x*=1.0+puppetHit*.045;
`;
const PAINTED_SHADOW_ANCHOR=`
  #ifdef USE_SHADOWMAP
    #ifdef USE_INSTANCING
      worldPosition=modelMatrix*vec4(instanceMatrix[3].xyz,1.0);
    #else
      worldPosition=modelMatrix*vec4(0.0,0.0,0.0,1.0);
    #endif
    worldPosition.xyz+=vec3(0.0,1.0,0.0)+paintedSunShift;
  #endif
`;
const PAINTED_NORMAL=`
  {
    vec2 paintTexel=${PAINTED_SHADING.radius.toFixed(1)}/vec2(textureSize(map,0));
    float aL=texture2D(map,vMapUv-vec2(paintTexel.x,0.0)).a,aR=texture2D(map,vMapUv+vec2(paintTexel.x,0.0)).a,aD=texture2D(map,vMapUv-vec2(0.0,paintTexel.y)).a,aU=texture2D(map,vMapUv+vec2(0.0,paintTexel.y)).a;
    vec3 lumaWeights=vec3(.299,.587,.114);
    float lL=dot(texture2D(map,vMapUv-vec2(paintTexel.x,0.0)).rgb,lumaWeights),lR=dot(texture2D(map,vMapUv+vec2(paintTexel.x,0.0)).rgb,lumaWeights),lD=dot(texture2D(map,vMapUv-vec2(0.0,paintTexel.y)).rgb,lumaWeights),lU=dot(texture2D(map,vMapUv+vec2(0.0,paintTexel.y)).rgb,lumaWeights);
    vec2 paintSlope=vec2(aR-aL,aU-aD)*${PAINTED_SHADING.bevel.toFixed(2)}+vec2(lR-lL,lU-lD)*${PAINTED_SHADING.relief.toFixed(2)};
    normal=normalize(vec3(-paintSlope,1.0));
  }
`;
function paintedShader(material,uniforms){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,...args)=>{
    previous.call(material,shader,...args);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=PAINTED_VERTEX_HEAD+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>'+PAINTED_PUPPET).replace('#include <shadowmap_vertex>',PAINTED_SHADOW_ANCHOR+'#include <shadowmap_vertex>');
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>'+PAINTED_NORMAL)
      .replace('#include <lights_lambert_pars_fragment>',T.ShaderChunk.lights_lambert_pars_fragment.replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );','float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + PAINTED_WRAP ) / ( 1.0 + PAINTED_WRAP ) );'));
  };
  material.defines={...material.defines,PAINTED_WRAP:PAINTED_SHADING.wrap.toFixed(2)};
  material.customProgramCacheKey=()=>`${key}:painted-lit-v1`;
}
function makeCanvas(width,height){
  if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(width,height);
  const canvas=globalThis.document?.createElement?.('canvas');if(!canvas)return null;canvas.width=width;canvas.height=height;return canvas;
}
const paintedSeed=id=>{let h=2166136261;for(const c of String(id??''))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295;};
const SIDE_COLOR={friendly:'#8e3a2f',enemy:'#5d5b3d',neutral:'#7c6a52'};
// Until the authored atlas has decoded, a plain painted silhouette keeps the
// unit visible in its side's colour (never an empty card).
function placeholder(c,unit,mounted){
  const color=SIDE_COLOR[unit.side]??SIDE_COLOR.neutral,{width,feet}=PAINTED_CANVAS,x=width/2,h=mounted?286:240;
  c.save();c.fillStyle='rgba(28,24,20,.9)';
  if(mounted){c.beginPath();c.ellipse(x,feet-h*.42,h*.36,h*.16,0,0,Math.PI*2);c.fill();for(const dx of [-.26,-.12,.14,.28])c.fillRect(x+dx*h,feet-h*.36,h*.035,h*.36);}
  c.fillStyle=color;c.beginPath();c.moveTo(x-h*.12,feet-(mounted?h*.5:0));c.lineTo(x+h*.12,feet-(mounted?h*.5:0));c.lineTo(x+h*.1,feet-h*.78);c.lineTo(x-h*.1,feet-h*.78);c.closePath();c.fill();
  c.fillStyle='#d9b892';c.beginPath();c.arc(x,feet-h*.86,h*.075,0,Math.PI*2);c.fill();
  c.fillStyle='#b7372d';c.beginPath();c.ellipse(x+h*.1,feet-h*(mounted?.66:.42),h*.09,h*.17,0,0,Math.PI*2);c.fill();c.restore();
}

export function createPaintedActor(unit={},{chapter=1,contest=false,light=[1,1,1],lighting=createPaintedLighting()}={}){
  const {width,height,feet}=PAINTED_CANVAS,canvas=makeCanvas(width,height),c=canvas?.getContext?.('2d');if(!c)return null;
  const mounted=['cavalry','heavy'].includes(unit.role),spec=spriteSpec(unit,chapter,contest);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  // The card's origin is the sole point; the card extends past it only by the
  // canvas margin, which the alpha test discards.
  const geometry=new T.PlaneGeometry(width/PER_METRE,height/PER_METRE,4,8);geometry.translate(0,(feet-height/2)/PER_METRE,0);
  const puppet={puppetTime:{value:0},puppetSeed:{value:paintedSeed(unit.id)},puppetLean:{value:0},puppetHit:{value:0},puppetFacing:{value:1}};
  const material=new T.MeshLambertMaterial({name:'Painted figure',map:texture,emissiveMap:texture,color:new T.Color(PAINTED_SHADING.lit,PAINTED_SHADING.lit,PAINTED_SHADING.lit),emissive:new T.Color().fromArray(light).multiplyScalar(PAINTED_SHADING.self),alphaTest:.5,alphaToCoverage:true,side:T.DoubleSide});
  paintedShader(material,{...lighting,...puppet});installCloudShadows(material);
  const card=new T.Mesh(geometry,material);card.name='painted figure card';card.castShadow=false;card.receiveShadow=true;card.renderOrder=1;
  // The shadow card never shows in the colour pass: it writes neither colour
  // nor depth there. Three builds the shadow pass's depth material from this
  // one (its map, alpha test and shadow side), which cuts the silhouette.
  const shadowMaterial=new T.MeshBasicMaterial({name:'Painted figure shadow card',map:texture,alphaTest:.5,colorWrite:false,depthWrite:false,shadowSide:T.DoubleSide});
  const shadow=new T.Mesh(geometry,shadowMaterial);shadow.name='painted figure shadow card';shadow.castShadow=true;shadow.receiveShadow=false;shadow.raycast=()=>{};
  const group=new T.Group();group.name='painted figure';group.add(card,shadow);
  const figureHeight=(mounted?2.36:1.95);
  group.userData.actor={mounted,height:figureHeight+.08,painted:true,spec};
  const body=new T.Object3D(),shield=new T.Object3D();body.position.set(0,mounted?1.75:1.1,0);shield.position.set(0,mounted?1.55:1,.28);group.add(body,shield);
  // Picking follows the painted silhouette, not the transparent card margin.
  const hits=[];
  card.raycast=(raycaster,intersects)=>{hits.length=0;T.Mesh.prototype.raycast.call(card,raycaster,hits);for(const hit of hits){if(!hit.uv)continue;const x=Math.min(width-1,Math.max(0,Math.floor(hit.uv.x*width))),y=Math.min(height-1,Math.max(0,Math.floor((1-hit.uv.y)*height)));if(c.getImageData(x,y,1,1).data[3]>90)intersects.push(hit);}};
  let state={direction:0,override:null,unit},key='',disposed=false,painted=false,crowd=null;
  const view=new T.Vector3(),origin=new T.Vector3(),quaternion=new T.Quaternion(),parentInverse=new T.Quaternion(),UP=new T.Vector3(0,1,0);
  function draw(column){
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,width,height);c.setTransform(SCALE,0,0,SCALE,0,0);
    const o=state.override??{},override={...o,facing:column,previousFacing:undefined,turnProgress:1};
    painted=drawUnitSprite(c,{tw:TILE_WIDTH},{x:width/2/SCALE,y:feet/SCALE},state.unit,chapter,contest,override);
    c.setTransform(1,0,0,1,0,0);if(!painted)placeholder(c,state.unit,mounted);
    texture.needsUpdate=true;
  }
  return {group,contacts:{body,shield,feet:[]},painted:true,
    ready:Promise.resolve(true),
    update(input={}){
      if(disposed)return;state={direction:Number.isFinite(input.direction)?input.direction:state.direction,override:['block','assent','dissent','yield','withdrawn'].includes(input.motion)?{...input.override,pose:input.motion,progress:input.phase??1}:input.override??null,unit:input.unit??state.unit};group.rotation.y=state.direction;
      const motion=input.motion??'idle',arc=Number.isFinite(input.phase)?Math.sin(Math.PI*Math.max(0,Math.min(1,input.phase))):0;
      puppet.puppetTime.value=input.reducedMotion?0:Number.isFinite(input.time)?input.time:0;
      puppet.puppetLean.value=['attack','strike','throw'].includes(motion)?arc:0;puppet.puppetHit.value=motion==='hit'?arc:0;
    },
    // Called after the camera moves each frame: face it, choose the painted
    // column for this view and repaint only when what is shown has changed.
    faceCamera(camera,{sunYaw=null}={}){
      if(disposed||!camera)return;
      camera.getWorldPosition(view);view.sub(group.getWorldPosition(origin));const toward={x:view.x,z:view.z};
      if(Math.hypot(toward.x,toward.z)<1e-6){camera.getWorldDirection(view);toward.x=-view.x;toward.z=-view.z;}
      const column=paintedColumn(state.direction,toward),o=state.override??{},u=state.unit??{};puppet.puppetFacing.value=['east','north'].includes(column)?1:-1;
      const next=[column,o.pose??'idle',Math.round((o.progress??0)*36),Math.round((o.stridePhase??0)*6),u.braced?1:0,Number.isFinite(u.morale)&&u.morale<35?1:0,(u.hp??u.resolve??1)/(u.maxHp??u.maxResolve??1)<.35?1:0].join(':');
      // A placeholder is replaced when the stage calls repaint() after the atlas decodes.
      if(next!==key){key=next;draw(column);}
      group.updateWorldMatrix(true,false);group.getWorldQuaternion(parentInverse).invert();
      card.quaternion.copy(parentInverse).multiply(camera.getWorldQuaternion(quaternion));
      if(Number.isFinite(sunYaw))shadow.quaternion.setFromAxisAngle(UP,sunYaw-group.rotation.y);
      crowd?.place();
    },
    // Followers are more cards of the same painting, each facing the camera and
    // casting its own silhouette; they never take a pick from the leader.
    createCrowd(max=8){
      if(disposed||max<1)return null;crowd?.dispose();
      const cards=new T.InstancedMesh(geometry,material,max),shadows=new T.InstancedMesh(geometry,shadowMaterial,max),matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3();
      cards.name='painted formation followers';shadows.name='painted formation shadows';cards.count=shadows.count=0;cards.castShadow=false;shadows.castShadow=true;cards.receiveShadow=true;shadows.receiveShadow=false;
      cards.frustumCulled=shadows.frustumCulled=false;cards.raycast=shadows.raycast=()=>{};group.add(cards,shadows);
      let placed=[],gone=false;const footprints=[];
      crowd={max,footprints,get count(){return placed.length;},get ranks(){return placed;},
        inherit(ranks=[]){if(!placed.length)placed=ranks.map(p=>({...p,world:p.world.clone()}));},
        update({slots=[],visible=0,heightAt=null,onFall=null}={}){if(gone)return;const next=placeFollowers(group,{slots,visible,heightAt,max});
          if(typeof onFall==='function')for(let i=next.length;i<placed.length;i++)onFall({world:placed[i].world.clone(),yaw:group.rotation.y+(placed[i].yaw??0),index:i});
          placed=next;footprints.length=0;for(const p of placed)footprints.push(p.world);},
        place(){if(gone)return;placed.forEach((p,i)=>{const s=1+p.yaw*.18;position.set(p.x,p.y,p.z);scale.set(s,s,s);cards.setMatrixAt(i,matrix.compose(position,card.quaternion,scale));shadows.setMatrixAt(i,matrix.compose(position,shadow.quaternion,scale));});cards.count=shadows.count=placed.length;cards.instanceMatrix.needsUpdate=shadows.instanceMatrix.needsUpdate=true;},
        dispose(){if(gone)return;gone=true;cards.removeFromParent();shadows.removeFromParent();cards.dispose();shadows.dispose();if(crowd===this)crowd=null;}};
      return crowd;
    },
    repaint(){key='';},
    // The painting as it is now, at half size, for a body laid on the ground.
    snapshot(scale=.5){
      if(disposed)return null;const w=Math.max(8,Math.round(width*scale)),h=Math.max(8,Math.round(height*scale)),out=makeCanvas(w,h),x=out?.getContext?.('2d');if(!x)return null;
      x.drawImage(canvas,0,0,w,h);return {canvas:out,width:width/PER_METRE,height:height/PER_METRE,feetOffset:(feet-height/2)/PER_METRE};
    },
    setLight(value){material.emissive.fromArray(value).multiplyScalar(PAINTED_SHADING.self);},
    puppet,material,
    getReleasePoint(target=new T.Vector3()){return body.getWorldPosition(target).add(new T.Vector3(Math.sin(state.direction)*.35,.35,Math.cos(state.direction)*.35));},
    dispose(){if(disposed)return;disposed=true;crowd?.dispose();group.removeFromParent();geometry.dispose();material.dispose();shadowMaterial.dispose();texture.dispose();}
  };
}
