import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {createEnvironment} from '../src/showcase/environment.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
const create=(id,quality='performance')=>{const s=fixture.scenes.find(s=>s.id===id);assert.ok(s,id);return createEnvironment(new T.Scene(),s.state.encounter,{chapter:s.chapter,quality,loadTextures:false});};
const borderKey=(a,i)=>`${a.getX(i).toFixed(4)},${a.getZ(i).toFixed(4)}`;

// This compares the real authored ground against the extension, including its
// textured shader inputs. Merely sharing a height function would miss cracks
// caused by a mismatched perimeter or training-yard soil weights.
test('Outer terrain meets every original edge sample exactly and leaves gameplay ground untouched',()=>{
  for(const id of ['ch1-training','ch2-marsh','ch9-wing','ch11-adlection']){
    const w=create(id),ground=w.ground.geometry.attributes,bridge=w.horizon.bridge.geometry.attributes,edge=new Map(),count=w.horizon.stats.innerEdgeSamples;
    for(let i=0;i<ground.position.count;i++)if(Math.max(Math.abs(ground.position.getX(i)),Math.abs(ground.position.getZ(i)))===40)edge.set(borderKey(ground.position,i),i);
    assert.equal(edge.size,count);
    for(let i=0;i<count;i++){
      const k=edge.get(borderKey(bridge.position,i));assert.notEqual(k,undefined);
      for(const name of ['position','color','uv','soilMix','normal'])for(let c=0;c<ground[name].itemSize;c++)assert.ok(Math.abs(ground[name].array[k*ground[name].itemSize+c]-bridge[name].array[i*bridge[name].itemSize+c])<1e-5,`${id} ${name} edge ${i}`);
    }
    const far=w.horizon.ridges.geometry.attributes.position,near=bridge.position;
    for(let i=0;i<count;i++)for(let c=0;c<3;c++)assert.equal(near.array[(near.count-count+i)*3+c],far.array[i*3+c],'Both extension meshes share a closed boundary');
    for(let i=0;i<near.count;i++)assert.ok(Math.max(Math.abs(near.getX(i)),Math.abs(near.getZ(i)))>=39.99999,'Horizon adds no geometry inside the existing ground');
    assert.equal(w.group.getObjectByName('distant rolling ridge'),undefined,'Old north-only planes are replaced');
    assert.equal(w.horizon.group.parent,w.group);assert.equal(w.stats().horizon,w.horizon.stats);w.dispose();
  }
});

test('Every regional horizon wraps all bearings, remains finite and respects a bounded geometry budget',()=>{
  const signatures=new Set();
  for(const s of fixture.scenes){const w=create(s.id),h=w.horizon,a=h.ridges.geometry.attributes.position,n=h.stats.innerEdgeSamples;let seen=0;
    assert.ok(h.stats.meshes<=8);assert.ok(h.stats.triangles<=15000);assert.equal(h.stats.outerRadius,550);assert.equal(h.ridges.material.fog,false);assert.equal(h.ridges.material.toneMapped,true);
    for(let i=a.count-n;i<a.count;i++){assert.ok(Math.abs(Math.hypot(a.getX(i),a.getZ(i))-550)<.0001);seen|=(a.getX(i)>=0?1:2)|(a.getZ(i)>=0?4:8);}
    assert.equal(seen,15,'All four quadrants have a continuous outer boundary');
    h.group.traverse(o=>{if(!o.isMesh)return;for(const attr of Object.values(o.geometry.attributes))for(const value of attr.array)assert.ok(Number.isFinite(value),s.id);const g=o.geometry;if(g.index)for(const i of g.index.array)assert.ok(i>=0&&i<g.attributes.position.count);assert.equal(o.castShadow,false);});
    assert.equal(Boolean(h.group.getObjectByName('distant meandering Danube')),w.profile.distantWater);
    signatures.add([h.stats.region,...Array.from(a.array.slice(0,18)).map(v=>v.toFixed(2))].join(','));w.dispose();
  }
  assert.ok(signatures.size>=12,'Regional silhouettes vary in shape, not only their tint');
  for(const quality of ['performance','balanced','high']){const w=create('ch1-road',quality);assert.ok(w.horizon.stats.triangles<=15000,`${quality}: ${w.horizon.stats.triangles}`);w.dispose();}
});

test('Ground and water face upward; distant built surfaces face outward rather than disappearing through culling',()=>{
  for(const id of ['ch1-road','ch9-wing','ch11-adlection']){
    const w=create(id),h=w.horizon;
    for(const name of ['continuous outer ground bridge','360 degree regional ridges','distant meandering Danube']){
      const mesh=h.group.getObjectByName(name);if(!mesh)continue;const p=mesh.geometry.attributes.position,ix=mesh.geometry.index;
      const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
      for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i));b.fromBufferAttribute(p,ix.getX(i+1)).sub(a);c.fromBufferAttribute(p,ix.getX(i+2)).sub(a);assert.ok(b.cross(c).y>0,`${id} ${name} triangle ${i/3} faces sky`);}
    }
    // Rays from outside the closed roofline must strike front-facing surfaces.
    if(id==='ch9-wing'){h.group.updateMatrixWorld(true);const mesh=h.group.getObjectByName('regional distant silhouettes'),p=mesh.geometry.attributes.position;
      const first=new T.Box3();for(let i=0;i<30;i++)first.expandByPoint(new T.Vector3().fromBufferAttribute(p,i));const center=first.getCenter(new T.Vector3()),size=first.getSize(new T.Vector3());
      const ray=new T.Raycaster(new T.Vector3(center.x,center.y,first.min.z-2),new T.Vector3(0,0,1),0,size.z+4);assert.ok(ray.intersectObject(mesh).length>0,'City wall is visible from its exterior');
    }
    w.dispose();
  }
});

test('Distant urban scenery remains a low roofline rather than filling the sky',()=>{
  for(const id of ['ch9-wing','ch11-adlection']){
    const w=create(id),p=w.horizon.group.getObjectByName('regional distant silhouettes').geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const distance=Math.hypot(p.getX(i),p.getZ(i));assert.ok(distance>180,'City buildings are distant scenery');
      assert.ok(Math.atan2(p.getY(i)-2.7,distance)<5*Math.PI/180,'Roofline stays within five degrees of a level horizon');
    }
    w.dispose();
  }
});

test('Horizon layout is deterministic, independent of campaign state and releases owned resources exactly once',()=>{
  const s=fixture.scenes.find(s=>s.id==='ch2-marsh'),before=JSON.stringify(s.state),a=create(s.id),b=create(s.id),owned=new Set(),disposed=new Map();
  assert.deepEqual(a.horizon.ridges.geometry.attributes.position.array,b.horizon.ridges.geometry.attributes.position.array);
  a.horizon.group.traverse(o=>{if(o.isMesh){owned.add(o.geometry);if(o.material!==a.ground.material)owned.add(o.material);}});
  let sharedDisposals=0;a.ground.material.addEventListener('dispose',()=>sharedDisposals++);
  for(const item of owned){disposed.set(item,0);item.addEventListener('dispose',()=>disposed.set(item,disposed.get(item)+1));}
  for(const t of [0,2,1000,NaN])a.update(t);assert.equal(JSON.stringify(s.state),before);
  a.horizon.dispose();a.horizon.dispose();assert.equal(sharedDisposals,0,'Independent horizon disposal does not free the ground material');a.dispose();a.dispose();assert.equal(sharedDisposals,1);for(const count of disposed.values())assert.equal(count,1);b.dispose();
});


test('Camera clearance follows actual outer ridge triangles, including the low-pitch station reproduction',()=>{
  const exactRay=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,2000);
  const check=(w,x,z)=>{w.horizon.group.updateWorldMatrix(true);exactRay.ray.origin.set(x,1000,z);const hit=exactRay.intersectObjects([w.horizon.bridge,w.horizon.ridges],false)[0];if(hit)assert.ok(Math.abs(w.cameraGroundHeight(x,z)-hit.point.y)<1e-8,'Camera height equals actual interpolated mesh height');return hit;};
  const station=create('ch3-station'),pitch=.04,distance=85,yaw=3*Math.PI/2,x=Math.sin(yaw)*Math.cos(pitch)*distance,z=Math.cos(yaw)*Math.cos(pitch)*distance,rawY=.7+Math.sin(pitch)*distance,hit=check(station,x,z);
  assert.ok(hit);assert.ok(hit.point.y>rawY+5,'Original camera was embedded several metres below the visible ridge');assert.ok(Math.max(rawY,station.cameraGroundHeight(x,z)+.9)>=hit.point.y+.9);
  let casts=0;for(const mesh of [station.horizon.bridge,station.horizon.ridges]){const original=mesh.raycast;mesh.raycast=function(...args){casts++;return original.apply(this,args);};}
  station.cameraGroundHeight(x,z);station.cameraGroundHeight(x,z);assert.equal(casts,0,'Stationary outside-ground camera reuses its previous sample');station.cameraGroundHeight(x+.1,z);assert.ok(casts>0,'Orbit movement refreshes triangle clearance');
  assert.equal(station.cameraGroundHeight(0,0),station.groundHeight(0,0));assert.equal(station.cameraGroundHeight(600,0),station.groundHeight(600,0));station.dispose();
  for(const s of fixture.scenes){const w=create(s.id),before=JSON.stringify(s.state);
    for(const [pitch,distance,targetY] of [[.105,85,2.7],[.04,85,.7],[.04,55,.7]])for(let direction=0;direction<8;direction++){
      const yaw=direction*Math.PI/4,x=Math.sin(yaw)*Math.cos(pitch)*distance,z=Math.cos(yaw)*Math.cos(pitch)*distance;
      if(Math.max(Math.abs(x),Math.abs(z))<=40)continue;
      const hit=check(w,x,z);assert.ok(hit,s.id+' visible extension covers camera position');const cameraY=Math.max(targetY+Math.sin(pitch)*distance,w.cameraGroundHeight(x,z)+.9);assert.ok(cameraY>=hit.point.y+.9-1e-8,s.id+' orbit clearance');
    }
    assert.equal(JSON.stringify(s.state),before);w.dispose();
  }
});

test('Distant river begins at the real near-water edge and matches every animated boundary vertex',()=>{
  for(const quality of ['performance','balanced','high']){
    const w=create('ch1-road',quality),near=w.group.getObjectByName('Danube'),far=w.horizon.group.getObjectByName('distant meandering Danube'),np=near.geometry.attributes.position,fp=far.geometry.attributes.position;
    const nearEdges=new Map();for(let i=0;i<np.count;i++)if(Math.abs(np.getX(i))===62.5)nearEdges.set(`${np.getX(i)},${(np.getZ(i)-29).toFixed(3)}`,i);
    assert.equal(nearEdges.size,26);let joins=0;
    for(let i=0;i<fp.count;i++){assert.ok(Math.abs(fp.getX(i))>=62.5,'Far water has no surface inside the animated river extent');if(Math.abs(fp.getX(i))===62.5)joins++;}
    assert.equal(joins,26);w.group.updateWorldMatrix(true);
    const ray=new T.Raycaster(new T.Vector3(57,10,-25),new T.Vector3(0,-1,0),0,20);assert.equal(ray.intersectObject(far).length,0,'The old crossing sample cannot hit distant water anymore');
    for(const time of [0,1,2,3,3601]){
      w.update(time);
      for(let i=0;i<fp.count;i++)if(Math.abs(fp.getX(i))===62.5){const n=nearEdges.get(`${fp.getX(i)},${fp.getZ(i).toFixed(3)}`);assert.notEqual(n,undefined);assert.ok(Math.abs(fp.getY(i)-(np.getY(n)+near.position.y))<1e-6,`${quality} shared wave sample at ${time}s`);}
    }
    assert.ok(w.horizon.stats.triangles<=15000);w.dispose();
  }
});
