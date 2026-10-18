import * as T from '../../vendor/three/three.module.js';
import {drawUnitSprite,spriteSpec} from '../ui/unit-sprites.js';

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
function makeCanvas(width,height){
  if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(width,height);
  const canvas=globalThis.document?.createElement?.('canvas');if(!canvas)return null;canvas.width=width;canvas.height=height;return canvas;
}
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

export function createPaintedActor(unit={},{chapter=1,contest=false,light=[1,1,1]}={}){
  const {width,height,feet}=PAINTED_CANVAS,canvas=makeCanvas(width,height),c=canvas?.getContext?.('2d');if(!c)return null;
  const mounted=['cavalry','heavy'].includes(unit.role),spec=spriteSpec(unit,chapter,contest);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  // The card's origin is the sole point; the card extends past it only by the
  // canvas margin, which the alpha test discards.
  const geometry=new T.PlaneGeometry(width/PER_METRE,height/PER_METRE);geometry.translate(0,(feet-height/2)/PER_METRE,0);
  const material=new T.MeshBasicMaterial({name:'Painted figure',map:texture,color:new T.Color().fromArray(light),alphaTest:.5,alphaToCoverage:true,side:T.DoubleSide});
  const card=new T.Mesh(geometry,material);card.name='painted figure card';card.castShadow=false;card.receiveShadow=false;card.renderOrder=1;
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
  let state={direction:0,override:null,unit},key='',disposed=false,painted=false;
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
    update(input={}){if(disposed)return;state={direction:Number.isFinite(input.direction)?input.direction:state.direction,override:input.override??null,unit:input.unit??state.unit};group.rotation.y=state.direction;},
    // Called after the camera moves each frame: face it, choose the painted
    // column for this view and repaint only when what is shown has changed.
    faceCamera(camera,{sunYaw=null}={}){
      if(disposed||!camera)return;
      camera.getWorldPosition(view);view.sub(group.getWorldPosition(origin));const toward={x:view.x,z:view.z};
      if(Math.hypot(toward.x,toward.z)<1e-6){camera.getWorldDirection(view);toward.x=-view.x;toward.z=-view.z;}
      const column=paintedColumn(state.direction,toward),o=state.override??{},u=state.unit??{};
      const next=[column,o.pose??'idle',Math.round((o.progress??0)*36),Math.round((o.stridePhase??0)*6),u.braced?1:0,Number.isFinite(u.morale)&&u.morale<35?1:0,(u.hp??u.resolve??1)/(u.maxHp??u.maxResolve??1)<.35?1:0].join(':');
      // A placeholder is replaced when the stage calls repaint() after the atlas decodes.
      if(next!==key){key=next;draw(column);}
      group.updateWorldMatrix(true,false);group.getWorldQuaternion(parentInverse).invert();
      card.quaternion.copy(parentInverse).multiply(camera.getWorldQuaternion(quaternion));
      if(Number.isFinite(sunYaw))shadow.quaternion.setFromAxisAngle(UP,sunYaw-group.rotation.y);
    },
    repaint(){key='';},
    setLight(value){material.color.fromArray(value);},
    getReleasePoint(target=new T.Vector3()){return body.getWorldPosition(target).add(new T.Vector3(Math.sin(state.direction)*.35,.35,Math.cos(state.direction)*.35));},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometry.dispose();material.dispose();shadowMaterial.dispose();texture.dispose();}
  };
}
