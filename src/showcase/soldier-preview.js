import * as T from '../../vendor/three/three.module.js';
import {createActor} from './actors.js';
import {wornIds} from '../core/soldier.js';
import {ITEMS} from '../data/items.js';

// The inventory and field use the same equipment-aware rig. No campaign
// values, simulation clocks, slots or shared model materials are changed.
// Creation shows the chosen cloak colour (cloaked), cloak or no cloak in his kit.
export function soldierPreviewUnit(soldier,{name='Your soldier',uncovered=false,cloaked=false}={}){
  const worn=wornIds(soldier),equipment=worn.filter(id=>!uncovered||!['galea','galea_crest','conical_helmet','segmented_helmet','arming_cap'].includes(id));
  if(cloaked&&!worn.some(id=>ITEMS[id]?.visuals?.cloak))equipment.push('sagum');
  return {id:'hero',name,side:'player',role:'infantry',trained:true,hp:1,maxHp:1,equipment,appearance:{...soldier.appearance},crowd:false};
}

/** A demand-rendered inspection turntable. The soldier wears the generated body
 * closest to his kit, as in the field (actor-body-catalog.js), and the
 * articulated kit rig until it loads or if it cannot.
 * Modal owner must dispose on close/replacement. No timer runs while idle. */
export function mountSoldierPreview(canvas,{soldier,name,chapter=1,rank,uncovered=false,cloaked=false,reducedMotion=false,onError=()=>{}}={}){
  // A cloaked creation preview starts turned to show the cloak behind him as well as his face.
  const home=cloaked?-.6:.35;
  let renderer=null,actor=null,observer=null,frame=0,disposed=false,drag=null,yaw=home,detail=false;
  const events=[],scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,30),unit=soldierPreviewUnit(soldier,{name,uncovered,cloaked});
  const geometry=new T.CircleGeometry(1.1,48),material=new T.MeshBasicMaterial({color:'#1c2426',transparent:true,opacity:.8});
  const floor=new T.Mesh(geometry,material);floor.rotation.x=-Math.PI/2;floor.position.y=-.012;scene.add(floor);
  scene.background=new T.Color('#273336');scene.add(new T.HemisphereLight('#e2e9e4','#746959',2.5));
  for(const [color,intensity,position]of [['#fff0d6',3,[3,5,4]],['#cbdde9',1.2,[-4,2,3]],['#e7c79c',1.1,[2,3,-4]]]){
    const light=new T.DirectionalLight(color,intensity);light.position.fromArray(position);scene.add(light);
  }
  function render(){frame=0;if(disposed||!renderer||!actor||!canvas.isConnected)return;
    const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
    renderer.setSize(Math.round(rect.width),Math.round(rect.height),false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
    const distance=detail?Math.max(1.05,.8/Math.max(.55,camera.aspect)):Math.max(4.2,3.1/Math.max(.55,camera.aspect));camera.position.set(0,detail?1.64:1.2,distance);camera.lookAt(0,detail?1.63:1.0,0);
    actor.update({motion:'idle',time:0,dt:0,direction:yaw,selected:false,reducedMotion:true,detailDistance:4,active:true,resetPose:true});
    renderer.render(scene,camera);canvas.dataset.preview='ready';
  }
  function invalidate(){if(!disposed&&!frame)frame=requestAnimationFrame(render);}
  function rotate(delta){if(!Number.isFinite(delta)||disposed)return;yaw+=delta;invalidate();}
  function reset(){yaw=home;detail=false;invalidate();}
  function inspectFace(){detail=true;yaw=.15;invalidate();}
  function on(type,handler,options){canvas.addEventListener(type,handler,options);events.push(()=>canvas.removeEventListener(type,handler,options));}
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer?.disconnect();for(const off of events)off();actor?.dispose();geometry.dispose();material.dispose();renderer?.dispose();scene.clear();}
  try{
    renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(1.5,globalThis.devicePixelRatio||1));
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    actor=createActor(unit,{quality:'balanced',chapter,rank});scene.add(actor.group);
    canvas.tabIndex=0;canvas.setAttribute('aria-label','Your equipped soldier. Drag or use Left and Right arrows to rotate. Home resets the view.');
    on('keydown',event=>{if(['ArrowLeft','ArrowRight','Home'].includes(event.key)){event.preventDefault();event.stopPropagation();event.key==='Home'?reset():rotate(event.key==='ArrowLeft'?-.22:.22);}});
    on('pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX};canvas.focus({preventScroll:true});canvas.setPointerCapture?.(event.pointerId);});
    on('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;rotate((event.clientX-drag.x)*.012);drag.x=event.clientX;});
    on('pointerup',event=>{if(drag?.id===event.pointerId){drag=null;if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);}});
    on('pointercancel',()=>{drag=null;});on('lostpointercapture',()=>{drag=null;});
    on('webglcontextlost',event=>{event.preventDefault();canvas.dataset.preview='unavailable';onError('The 3D preview was interrupted. Your equipment list remains available.');dispose();});
    observer=new ResizeObserver(invalidate);observer.observe(canvas);invalidate();
    const ready=actor.ready.then(()=>{if(!disposed)invalidate();return !disposed;}).catch(()=>{if(!disposed)invalidate();return false;});
    return {ready,rotate,reset,inspectFace,dispose};
  }catch(error){canvas.dataset.preview='unavailable';onError('The 3D preview is unavailable. Your equipment list remains available.');dispose();return {ready:Promise.resolve(false),rotate(){},reset(){},dispose};}
}
