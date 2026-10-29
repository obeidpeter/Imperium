import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {LANDMARK_LAYOUT} from '../src/ui/world-layouts.js';
import {LANDMARK_HEIGHTS,LANDMARK_KINDS,LANDMARK_WATER,buildLandmarkStandIn,landmarkFootprint} from '../src/showcase/horizon-landmarks.js';
import {landmarkHaze,landmarkSlots} from '../src/showcase/environment-horizon.js';
import {landmarkModelUrls} from '../src/showcase/scenery-models.js';
import {LANDMARK_CHAPTERS,WORLD_CATALOG} from '../src/ui/world-catalog.js';
import {createEnvironment} from '../src/showcase/environment.js';

// Each chapter's landmarks at the middle distance (worlds and gameplay plan, release 9).
const campaign=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
const scene=id=>campaign.scenes.find(s=>s.id===id);

test('every chapter names three landmarks, each with a known stand-in and a model id, generated or to come',()=>{
  const all=new Map();
  for(let chapter=1;chapter<=12;chapter++){
    const slots=LANDMARK_LAYOUT[chapter];assert.equal(slots.length,3,`Chapter ${chapter}`);
    for(const slot of slots){
      assert.ok(LANDMARK_KINDS.includes(slot.kind)&&LANDMARK_HEIGHTS[slot.kind]>0&&landmarkFootprint(slot.kind),slot.kind);
      assert.match(slot.model,/^landmark-[a-z-]+$/);assert.ok(slot.name.length>4);
      if(all.has(slot.model))assert.deepEqual(all.get(slot.model),slot,`${slot.model} means one landmark wherever it stands`);
      all.set(slot.model,slot);
    }
  }
  assert.ok(all.size>=33,`${all.size} distinct landmarks`);
  assert.deepEqual(LANDMARK_LAYOUT[11].map(s=>s.kind),['arena','rotunda','arch']);
  // A generated landmark downloads with the chapters that name it, and only those; the rest
  // stand as silhouettes and download nothing.
  const generated=Object.entries(WORLD_CATALOG).filter(([,entry])=>entry.kind==='landmark');
  assert.deepEqual(generated.map(([id])=>id).sort(),Object.keys(LANDMARK_CHAPTERS).sort());
  for(const [id,entry] of generated){
    assert.ok(all.has(id),`${id} stands in a layout`);
    assert.deepEqual([...entry.chapters],Object.keys(LANDMARK_LAYOUT).map(Number).filter(chapter=>LANDMARK_LAYOUT[chapter].some(slot=>slot.model===id)),id);
    assert.deepEqual(entry.files,[`assets/models/landmarks/${id}.glb`]);
  }
  for(let chapter=1;chapter<=12;chapter++)assert.deepEqual(landmarkModelUrls({id:'x'},{chapter}),
    LANDMARK_LAYOUT[chapter].filter(slot=>WORLD_CATALOG[slot.model]).map(slot=>[slot.model,`assets/models/landmarks/${slot.model}.glb`]),`Chapter ${chapter}`);
  assert.deepEqual(landmarkModelUrls(null,{chapter:1}),[]);
  // In the Curia its walls hide the horizon: its outlines stand there, and nothing more is loaded.
  const senate=scene('ch11-accounts').state.encounter;assert.equal(senate.kind,'contest');
  assert.ok(landmarkModelUrls({id:'ch11-camp'},{chapter:11}).length>0);assert.deepEqual(landmarkModelUrls(senate,{chapter:11}),[]);
});

// Records the triangles a builder makes, with the horizon's own helpers' conventions.
function recordKind(kind,{cx=0,cz=-140,ground=3}={}){
  const tris=[],c=new T.Color('#808080');
  const triangle=(a,b,c1)=>tris.push([a,c1,b]);// as the horizon pushes them: its front faces
  const box=(x,y,z,w,h,d)=>{const p=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]].map(([a,b,e])=>[x+a*w/2,y+b*h,z+e*d/2]);
    for(const [a,b,e,f] of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]]){triangle(p[a],p[b],p[e]);triangle(p[a],p[e],p[f]);}};
  const base=buildLandmarkStandIn(kind,{cx,cz,box,triangle,foundation:()=>ground,tint:()=>c});
  return {tris,base};
}
const normal=([a,b,c])=>new T.Vector3(...b).sub(new T.Vector3(...a)).cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
test('each stand-in stands within its footprint and reaches its table height',()=>{
  for(const kind of LANDMARK_KINDS)for(const cz of [-140,140])for(const cx of [0,-150]){
    // Due north or south of the board the frame keeps its axes; to the west it is a quarter turn.
    const {tris,base}=recordKind(kind,{cx,cz}),[w,d]=landmarkFootprint(kind),[spanX,spanZ]=cx?[d,w]:[w,d];
    assert.ok(tris.length>0&&tris.length<=1600,`${kind}: ${tris.length} triangles`);
    let top=-Infinity;
    for(const t of tris)for(const [x,y,z] of t){
      assert.ok(Math.abs(x-cx)<=spanX/2+1e-6&&Math.abs(z-cz)<=spanZ/2+1e-6,`${kind} reaches beyond its footprint`);
      assert.ok(y>=base-.5&&y<=base+LANDMARK_HEIGHTS[kind]+1e-6,`${kind}: ${(y-base).toFixed(2)} m against ${LANDMARK_HEIGHTS[kind]}`);
      top=Math.max(top,y-base);
    }
    assert.ok(Math.abs(top-LANDMARK_HEIGHTS[kind])<1e-6,`${kind}: its stand-in is ${top.toFixed(2)} m, its table height ${LANDMARK_HEIGHTS[kind]}`);
  }
});

// The distance along a ray to a triangle (Möller–Trumbore), or Infinity.
function along(origin,direction,[a,b,c]){
  const o=new T.Vector3(...origin),d=new T.Vector3(...direction),A=new T.Vector3(...a),e1=new T.Vector3(...b).sub(A),e2=new T.Vector3(...c).sub(A);
  const p=d.clone().cross(e2),det=e1.dot(p);if(Math.abs(det)<1e-12)return Infinity;
  const t=o.clone().sub(A),u=t.dot(p)/det;if(u<-1e-9||u>1+1e-9)return Infinity;
  const q=t.cross(e1),v=d.dot(q)/det;if(v<-1e-9||u+v>1+1e-9)return Infinity;
  const s=e2.dot(q)/det;return s>1e-6?s:Infinity;
}
test('every stand-in shows its outer faces from all round and from above: none is turned inside out',()=>{
  for(const kind of LANDMARK_KINDS){
    const {tris,base}=recordKind(kind),[w,d]=landmarkFootprint(kind),reach=Math.hypot(w,d),height=LANDMARK_HEIGHTS[kind],rays=[];
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2;for(const k of [.08,.3,.5,.7,.92])rays.push([[Math.cos(a)*reach,base+height*k,-140+Math.sin(a)*reach],[-Math.cos(a),0,-Math.sin(a)]]);}
    for(const u of [-.3,-.1,.1,.3])for(const v of [-.3,-.1,.1,.3])rays.push([[u*w,base+height+10,-140+v*d],[0,-1,0]]);
    let seen=0;
    for(const [origin,direction] of rays){
      // The first surface the ray meets; of coplanar ones there, a front face if any.
      let first=Infinity;for(const t of tris)first=Math.min(first,along(origin,direction,t));if(first===Infinity)continue;
      const faces=tris.filter(t=>Math.abs(along(origin,direction,t)-first)<1e-6),dir=new T.Vector3(...direction);seen++;
      assert.ok(faces.some(t=>normal(t).dot(dir)<0),`${kind}: the face a ray from outside meets first is turned away`);
    }
    assert.ok(seen>=20,`${kind}: ${seen} rays met it`);
  }
});

test('the horizon sets each chapter\'s landmarks on its bearings, and a generated one takes its slot',()=>{
  for(const s of campaign.scenes.filter((s,i,list)=>list.findIndex(o=>o.chapter===s.chapter)===i)){
    const world=createEnvironment(new T.Scene(),s.state.encounter,{chapter:s.chapter,quality:'balanced',loadTextures:false});
    const listed=world.horizon.stats.landmarks;
    assert.deepEqual(listed.map(l=>l.model),LANDMARK_LAYOUT[s.chapter].map(l=>l.model),s.id);
    assert.ok(listed.every(l=>l.generated===false),`${s.id}: silhouettes until the models exist`);
    for(const slot of listed)assert.ok(Math.hypot(slot.x,slot.z)>=115-1e-9,`${s.id}: ${slot.model} at the middle distance`);
    // Away from a river each faces the board; its bearings are the layout's own.
    const plain=landmarkSlots(world.profile,{city:['palmyra','rome','accession'].includes(world.profile.setting)});
    for(const [i,slot] of listed.entries())if(!LANDMARK_WATER[slot.kind]||!world.profile.distantWater){
      assert.ok(Math.abs(slot.x-plain[i].x)<1e-9&&Math.abs(slot.z-plain[i].z)<1e-9&&Math.abs(slot.yaw-Math.atan2(-slot.x,-slot.z))<1e-12,`${s.id}: ${slot.model}`);
    }
    world.dispose();
  }
  // A loaded model stands in its slot, at its kind's height, on the ground, turned to the board.
  const road=scene('ch1-road'),[gate]=LANDMARK_LAYOUT[1],geometry=new T.BoxGeometry(2,5,3),source=new T.Group();source.add(new T.Mesh(geometry,new T.MeshStandardMaterial()));
  let freed=false;geometry.addEventListener('dispose',()=>{freed=true;});
  const world=createEnvironment(new T.Scene(),road.state.encounter,{chapter:1,quality:'balanced',loadTextures:false,landmarkModels:new Map([[gate.model,source]])});
  assert.deepEqual(world.horizon.stats.landmarks.map(l=>l.generated),[true,false,false]);
  const placed=world.horizon.group.getObjectByName(`landmark: ${gate.name}`);assert.ok(placed);
  const box=new T.Box3().setFromObject(placed,true),size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3()),[slot]=world.horizon.stats.landmarks;
  assert.ok(Math.abs(size.y-LANDMARK_HEIGHTS.gate)<1e-6,'scaled to the gate\'s height');
  assert.ok(Math.hypot(centre.x-slot.x,centre.z-slot.z)<1e-6,'centred on its bearing');
  assert.ok(Math.abs(placed.rotation.y-Math.atan2(-slot.x,-slot.z))<1e-9&&placed.rotation.y===slot.yaw,'turned to the board');
  // Its foundation is its own extent's, and it stands on it, emitting no silhouette.
  const record=world.horizon.group.userData.distantFoundations.find(f=>f.landmark===gate.model);
  assert.ok(Math.abs(record.width-size.x)<1e-6&&Math.abs(record.depth-size.z)<1e-6&&record.x===slot.x&&record.z===slot.z,'on the ground under its own extent');
  assert.ok(Math.abs(box.min.y-record.base)<1e-6,'its foot on that ground');assert.equal(record.vertices,0);
  placed.traverse(o=>{if(o.isMesh){assert.equal(o.castShadow,false);assert.equal(o.raycast(),undefined);}});
  // It takes the haze in clones of its materials, as an unlit share of its colour; the cached
  // model's own are untouched, and the world disposes only the clones.
  const own=source.children[0].material,hazed=placed.children[0].material,k=landmarkHaze(Math.hypot(slot.x,slot.z));
  assert.ok(hazed!==own&&k>.15&&k<.3,`a share of ${k}`);assert.ok(own.emissive.equals(new T.Color(0,0,0))&&own.color.equals(new T.Color(1,1,1)));
  assert.ok(hazed.color.equals(new T.Color(1,1,1).multiplyScalar(1-k))&&hazed.emissive.equals(new T.Color(world.profile.fog).multiplyScalar(k)));
  let clone=false,original=false;hazed.addEventListener('dispose',()=>{clone=true;});own.addEventListener('dispose',()=>{original=true;});
  world.dispose();assert.equal(freed,false,'the cached model stays whole');assert.ok(clone&&!original,'only the hazed clones are disposed');
  const performance=createEnvironment(new T.Scene(),road.state.encounter,{chapter:1,quality:'performance',loadTextures:false,landmarkModels:new Map([[gate.model,source]])});
  assert.ok(performance.horizon.stats.landmarks.every(l=>!l.generated),'Performance keeps the silhouettes');performance.dispose();
});

test('the old bridge\'s piers stand across the river and the quays on its near bank; a bridge with no river has its stream',()=>{
  const river=(world,x)=>{
    // The distant river's two banks at the sample nearest x.
    const p=world.horizon.group.getObjectByName('distant meandering Danube').geometry.attributes.position;let best=Infinity,banks=[];
    for(let i=0;i<p.count;i++){const d=Math.abs(p.getX(i)-x);if(d<best-1e-6){best=d;banks=[];}if(Math.abs(d-best)<1e-6)banks.push(p.getZ(i));}
    assert.ok(best<5);return [Math.min(...banks),Math.max(...banks)];
  };
  for(const id of ['ch2-marsh','ch8-ferry']){
    const s=scene(id),world=createEnvironment(new T.Scene(),s.state.encounter,{chapter:s.chapter,quality:'balanced',loadTextures:false});
    assert.equal(world.profile.distantWater,true,id);
    for(const slot of world.horizon.stats.landmarks.filter(l=>LANDMARK_WATER[l.kind])){
      const [north,south]=river(world,slot.x),[,depth]=landmarkFootprint(slot.kind);assert.equal(slot.stream,false);
      if(slot.kind==='piers'){
        assert.ok(slot.z>north&&slot.z<south,`${id}: the piers stand in the river`);
        // Their row runs across it: the frame's quarter turn puts its right (local +u) along z.
        assert.equal(Math.abs(Math.round(slot.yaw/(Math.PI/2)))%2,1,`${id}: the piers' row crosses the river`);
      }else{
        // The board lies south of the river: the quay stands on the south bank, its front to the water.
        assert.ok(Math.abs(slot.z-depth/2-south)<.6,`${id}: the quay's front at the water's edge`);
        assert.ok(Math.abs(slot.yaw-Math.PI)<1e-12,`${id}: the quay faces the river`);
      }
    }
    world.dispose();
  }
  for(const id of ['ch7-legion','ch12-confrontation']){
    const s=scene(id),world=createEnvironment(new T.Scene(),s.state.encounter,{chapter:s.chapter,quality:'balanced',loadTextures:false});
    assert.equal(world.profile.distantWater,false,id);
    const bridge=world.horizon.stats.landmarks.find(l=>l.kind==='bridge'),record=world.horizon.group.userData.distantFoundations.find(f=>f.landmark===bridge.model);
    assert.equal(bridge.stream,true);assert.equal(record.streamVertices,6,`${id}: one quad of water`);
    const p=world.horizon.group.getObjectByName('regional distant silhouettes').geometry.attributes.position,first=record.firstVertex+record.vertices,v=i=>new T.Vector3().fromBufferAttribute(p,first+i);
    for(let i=0;i<6;i++){assert.ok(Math.abs(v(i).y-(record.base+.35))<1e-5);assert.ok(Math.hypot(v(i).x-bridge.x,v(i).z-bridge.z)<20);}
    for(let i=0;i<6;i+=3)assert.ok(v(i+1).sub(v(i)).cross(v(i+2).sub(v(i))).y>0,`${id}: the stream faces the sky`);
    world.dispose();
  }
});
