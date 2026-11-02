import * as T from '../../vendor/three/three.module.js';
import {createFieldworkKit} from './environment-fieldwork.js';
import {batchStaticEnvironment} from './environment-batching.js';
import {createMasonryBlockGeometry} from './environment-primitives.js';

// Chests, strongboxes, lockers, caches and the rest (release 11,
// data/containers.js) on the 3D stage, in camp and on the field. Code-built in
// the scenery's own materials (the environment's palette, environment.js), so
// they share its shaders and add no program; batched by material, so all of
// them together cost a draw for each material. Presentation only: drawn from
// the world's containers in sight (live-figures.js stageContainers), closed,
// open with something inside, or open and emptied. A hidden cache is not drawn
// until the soldier has found it. A change rebuilds only these few meshes.

// Each kind as boxes, cylinders and spheres: [width, height, depth] of its
// body, the materials of body, bands and lid, and how its lid opens.
const SHAPES=Object.freeze({
  chest:{size:[.9,.4,.52],body:'wood',band:'iron',lid:'dark',bands:[-.3,.3]},
  strongbox:{size:[.6,.36,.42],body:'dark',band:'iron',lid:'dark',bands:[-.2,0,.2]},
  coffer:{size:[.5,.26,.34],body:'dark',band:'bronze',lid:'dark',bands:[-.16,.16]},
  trunk:{size:[1.05,.42,.55],body:'dark',band:'rope',lid:'wood',bands:[-.33,.33]},
  crate:{size:[.75,.62,.75],body:'wood',band:'dark',lid:'wood',bands:[-.34,.34]},
  locker:{size:[.62,1,.45],body:'wood',band:'dark',lid:'dark',door:true,bands:[]},
  satchel:{size:[.38,.24,.14],body:'dark',band:'bronze',lid:'dark',bands:[]},
  basket:{round:true,size:[.3,.42,.3],body:'rope',lid:'rope'},
  sack:{bag:true},cache:{bundle:true},baggage:{pile:true},
  // Not a container: the road out of a won field (release 14), drawn with them in the same materials.
  waypost:{post:true}});

export const containerShape=kind=>SHAPES[kind]??SHAPES.chest;

// One container's meshes in its own group: its front faces +z before it is turned.
export function buildContainer(parts,parent,c){
  const {m,mesh,plank,beam,group,cylinder,sphere,sack}=parts,shape=containerShape(c.box),g=group(parent,c.x,c.y,c.z);
  g.name=`container ${c.id}`;g.rotation.y=Math.atan2(c.face?.[0]??0,c.face?.[1]??1);
  const full=c.open&&!c.empty;
  if(shape.post){
    // A post, its board pointing on (+z) and a red pennant behind, as the camps' wayposts (environment-waypost.js).
    plank(g,0,.9,0,.16,1.8,.16,m.dark);plank(g,0,1.46,.36,.06,.26,.62,m.wood);plank(g,0,1.46,.73,.06,.16,.14,m.wood);
    plank(g,0,1.6,-.19,.03,.32,.28,m.cloth);
    return g;
  }
  if(shape.bag){
    mesh(g,sack,m.cloth,0,0,0,c.open?1.05:1,c.open?.86:1,c.open?1.05:1);
    if(!c.open)mesh(g,cylinder,m.rope,0,.5,0,.075,.045,.075);
    if(full)plank(g,.27,.04,.12,.24,.05,.18,m.cloth);
    return g;
  }
  if(shape.bundle){
    // A cloth-wrapped bundle under stones; found, the stones are pushed aside.
    if(!c.open)mesh(g,sphere,m.cloth,0,.11,0,.34,.14,.25);
    else{plank(g,0,.02,0,.62,.03,.5,m.cloth);if(full)plank(g,.06,.07,0,.32,.08,.2,m.dark);}
    for(const [x,z,s]of c.open?[[-.48,.2,.11],[.46,-.26,.1],[.42,.3,.09]]:[[-.18,.12,.11],[.16,-.1,.1],[.04,.18,.09]])mesh(g,sphere,m.stone,x,s*.75+(c.open?0:.14),z,s,s*.8,s);
    return g;
  }
  if(shape.pile){
    // Abandoned baggage: two sacks and a strapped pack.
    mesh(g,sack,m.cloth,-.34,0,-.05,.85,.8,.85);mesh(g,sack,m.cloth,-.05,0,-.32,.7,.66,.7);
    plank(g,.24,.17,.05,.52,.34,.4,m.wood);for(const x of [.08,.4])plank(g,x,.17,.05,.04,.35,.41,m.rope);
    if(full)plank(g,.24,.36,.05,.4,.05,.3,m.cloth);
    else if(!c.open)plank(g,.24,.36,.05,.54,.04,.42,m.dark);
    return g;
  }
  const [w,h,d]=shape.size,mat=k=>m[k];
  if(shape.round){
    mesh(g,cylinder,mat(shape.body),0,h/2,0,w,h,w);mesh(g,cylinder,m.wood,0,h,0,w*1.04,.035,w*1.04);
    if(!c.open)mesh(g,cylinder,mat(shape.lid),0,h+.03,0,w*1.02,.04,w*1.02);
    else{const lid=mesh(g,cylinder,mat(shape.lid),w*1.35,w*.95,0,w*1.02,.04,w*1.02);lid.rotation.z=1.25;if(full)mesh(g,sphere,m.cloth,0,h-.02,0,w*.8,.07,w*.8);}
    return g;
  }
  plank(g,0,h/2,0,w,h,d,mat(shape.body));
  plank(g,0,.03,0,w+.04,.06,d+.04,m.dark);
  for(const x of shape.bands)plank(g,x,h/2,0,.055,h+.01,d+.015,mat(shape.band));
  if(shape.door){
    // A locker's door swings out from its left edge.
    const door=group(g,-w/2,h/2,d/2);door.rotation.y=c.open?-1.75:0;plank(door,w/2,0,.012,w-.02,h-.04,.024,mat(shape.lid));
    if(c.lockable)plank(door,w-.09,0,.03,.05,.12,.02,m.bronze);
    if(full)for(const y of [.32,.62])plank(g,0,y,d/2+.02,w*.7,.07,.04,m.cloth);
    return g;
  }
  // The lid is hinged along the back edge: open, it leans back past upright.
  const lid=group(g,0,h,-d/2);lid.rotation.x=c.open?-1.95:0;plank(lid,0,.045,d/2,w+.02,.09,d+.02,mat(shape.lid));
  for(const x of shape.bands)plank(lid,x,.05,d/2,.055,.1,d+.03,mat(shape.band));
  if(c.lockable){
    plank(g,0,h-.07,d/2+.008,.12,.12,.016,m.bronze);
    // Still locked: the hasp is down and a padlock hangs from it.
    if(c.locked){plank(g,0,h+.005,d/2+.02,.05,.13,.02,m.iron);mesh(g,sphere,m.iron,0,h-.13,d/2+.035,.035,.045,.02);}
  }
  if(full){plank(g,0,h+.012,0,w*.78,.025,d*.72,m.cloth);beam(g,[-w*.3,h+.03,-d*.1],[w*.12,h+.03,d*.18],.018,m.bronze);}
  return g;
}

// The pieces the containers are built from: unit shapes, and the materials of
// the scene's palette (wood, dark wood, iron, cloth, rope, stone; iron stands
// for bronze fittings, which the palette lacks). Without a palette (a test, or
// no scenery), the fieldwork kit's materials stand in.
function containerParts({palette=null,chapter=1,quality='balanced',finish=null,geometries,materials}){
  const segments=quality==='performance'?8:12,own=g=>(geometries.add(g),g);
  let m;
  if(palette)m={wood:palette.wood,dark:palette.darkWood,iron:palette.iron,bronze:palette.iron,cloth:palette.cloth,rope:palette.rope,stone:palette.stone};
  else{const kit=createFieldworkKit({chapter,quality,geometries:new Set(),materials,finish});m=kit.parts.m;}
  const box=own(createMasonryBlockGeometry()),cylinder=own(new T.CylinderGeometry(1,1,1,segments)),sphere=own(new T.SphereGeometry(1,segments,8));
  const sack=own(new T.LatheGeometry([[.08,0],[.20,.04],[.25,.17],[.24,.34],[.18,.45],[.06,.5],[.07,.55]].map(v=>new T.Vector2(...v)),segments));
  const mesh=(parent,g,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{const o=new T.Mesh(g,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const plank=(g,x,y,z,sx,sy,sz,mat=m.wood)=>mesh(g,box,mat,x,y,z,sx,sy,sz);
  const beam=(g,a,b,r,mat=m.wood)=>{const start=new T.Vector3(...a),end=new T.Vector3(...b),length=start.distanceTo(end);
    const o=mesh(g,cylinder,mat,...start.clone().add(end).multiplyScalar(.5).toArray(),r,length,r);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());return o;};
  const group=(parent,x=0,y=0,z=0)=>{const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;};
  return {m,mesh,plank,beam,group,box,cylinder,sphere,sack};
}

export function createContainerProps(scene,{heightAt=()=>0,quality='balanced',chapter=1,finish=null,palette=null}={}){
  const group=new T.Group();group.name='containers';scene.add(group);
  // The shapes and any stand-in materials are this set's; the palette's materials are the scenery's, never disposed here.
  const shared=new Set(),built=new Set(),materials=new Set(),parts=containerParts({palette,chapter,quality,finish,geometries:shared,materials});
  let signature='',stats={containers:0,drawBatches:0,triangles:0},disposed=false;
  const clear=()=>{for(const g of built)g.dispose();built.clear();group.clear();};
  function sync(list=[]){
    if(disposed)return false;
    const next=JSON.stringify(list);if(next===signature)return false;signature=next;clear();
    for(const c of list){const y=heightAt(c.x,c.z);buildContainer(parts,group,{...c,y:Number.isFinite(y)?y:0});}
    // Batched by material: the merged geometries are this build's to dispose; the shapes are kept.
    batchStaticEnvironment(group,{geometries:built,instanceThreshold:Infinity});
    let drawBatches=0,triangles=0;group.traverse(o=>{if(o.isMesh){drawBatches++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
    stats={containers:list.length,drawBatches,triangles};return true;
  }
  return {group,sync,stats:()=>({...stats}),materials:Object.values(parts.m),
    dispose(){if(disposed)return;disposed=true;clear();for(const g of shared)g.dispose();for(const m of materials)m.dispose();group.removeFromParent();}};
}
