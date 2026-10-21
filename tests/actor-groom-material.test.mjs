import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {createActorAssetCatalog,ACTOR_MODEL_URL,FEMALE_ACTOR_MODEL_URL} from '../src/showcase/actor-assets.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {actorKit} from '../src/showcase/actor-kit.js';
import {groomActorHair} from '../src/showcase/actor-groom.js';
import {actorMaterialKey} from '../src/showcase/actor-material-key.js';
import {bindActorSurfaces} from '../src/showcase/actor-skin.js';
import {createActor} from '../src/showcase/actors.js';

const bytes=await Promise.all([ACTOR_MODEL_URL,FEMALE_ACTOR_MODEL_URL].map(path=>readFile(new URL('../'+path,import.meta.url))));
const parse=i=>new GLTFLoader().parseAsync(bytes[i].buffer.slice(bytes[i].byteOffset,bytes[i].byteOffset+bytes[i].byteLength),'');
const catalog=createActorAssetCatalog({maleLoad:()=>parse(0),femaleLoad:()=>parse(1)});
const identity=unit=>actorIdentity(unit,actorKit(unit));
const identities=[identity({id:'hero'}),identity({name:'Varro'}),identity({name:'Aelia'})];
await Promise.all([catalog.warm(),catalog.warm(identities[2])]);
const release=model=>{for(const key of ['geometry','hair','beard'])model?.[key]?.dispose();};
const copyAttributes=g=>Object.fromEntries(Object.entries(g.attributes).map(([name,attr])=>[name,Array.from(attr.array)]));

test('Imported male and female grooms are deterministic, finite and bound wholly to the head without changing identity or master',()=>{
  for(const id of identities){
    const before=JSON.stringify(id),a=catalog.anatomy(id),b=catalog.anatomy(id);
    for(const key of ['hair','beard']){
      const g=a[key];if(!g)continue;
      assert.equal(g.userData.groom,true);assert.deepEqual(copyAttributes(g),copyAttributes(b[key]));
      const {position,normal,skinIndex,skinWeight}=g.attributes;
      assert.equal(position.count%3,0);assert.ok(position.count<150000,'The bounded groom cannot grow with frame count.');
      for(const [name,attr]of Object.entries(g.attributes))for(const value of attr.array)assert.ok(Number.isFinite(value),`${id.key} ${key}: finite ${name}`);
      for(let i=0;i<position.count;i++){
        assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<2e-5);
        assert.deepEqual([skinIndex.getX(i),skinIndex.getY(i),skinIndex.getZ(i),skinIndex.getW(i)],[1,0,0,0]);
        assert.deepEqual([skinWeight.getX(i),skinWeight.getY(i),skinWeight.getZ(i),skinWeight.getW(i)],[1,0,0,0]);
      }
      assert.ok(g.boundingSphere.radius>0&&g.boundingSphere.radius<.3);
    }
    const original=Array.from(b.geometry.attributes.position.array);release(a);
    const again=catalog.anatomy(id);assert.deepEqual(Array.from(again.geometry.attributes.position.array),original);assert.equal(JSON.stringify(id),before);release(again);release(b);
  }
});

test('Real cropped scalp, receding hair and beard triangles keep outward winding, including the displaced underlayer',()=>{
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),face=new T.Vector3(),average=new T.Vector3(),n=new T.Vector3();
  for(const id of [...identities,identity({name:'Paullus'})])for(const quality of ['performance','balanced']){
    const model=catalog.anatomy(id,{quality});
    for(const key of ['hair','beard']){
      const g=model[key];if(!g)continue;const p=g.attributes.position,normals=g.attributes.normal;let checked=0,opposed=0;
      for(let i=0;i<p.count;i+=3){
        a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);face.subVectors(b,a).cross(c.sub(a));
        // Clipping can leave effectively zero-area border triangles; they have no visible winding.
        if(face.lengthSq()<1e-20)continue;
        average.set(0,0,0);for(let j=0;j<3;j++)average.add(n.fromBufferAttribute(normals,i+j));
        if(face.normalize().dot(average.normalize())<-.0001)opposed++;checked++;
      }
      assert.ok(checked>500);assert.equal(opposed,0,`${id.key}/${quality}/${key}: outward geometry and shading normals must agree.`);
    }
    release(model);
  }
});

test('Performance quality reaches the real actor asset path and reduces both scalp and beard geometry while retaining identity',()=>{
  const unit=Object.freeze({id:'varro',name:'Varro',role:'soldier',side:'ally'}),actors={};
  for(const quality of ['performance','balanced','high'])actors[quality]=createActor(unit,{assetLibrary:catalog,quality});
  for(const name of ['fitted-hair','fitted-beard']){
    const low=actors.performance.group.getObjectByName(name),normal=actors.balanced.group.getObjectByName(name),high=actors.high.group.getObjectByName(name);
    assert.ok(low?.isSkinnedMesh&&normal?.isSkinnedMesh&&high?.isSkinnedMesh);
    assert.ok(low.geometry.attributes.position.count<normal.geometry.attributes.position.count);
    assert.equal(high.geometry.attributes.position.count,normal.geometry.attributes.position.count,'High does not multiply groom geometry beyond its documented bounded cap.');
    assert.ok(low.geometry.userData.locks<normal.geometry.userData.locks);
    assert.ok(low.geometry.userData.locks<=(name==='fitted-beard'?48:75));
    assert.ok(normal.geometry.userData.locks<=(name==='fitted-beard'?100:140));
  }
  for(const actor of Object.values(actors)){assert.equal(actor.group.userData.actor.identity,'varro');actor.update({motion:'rally',phase:.4});actor.dispose();actor.dispose();}
});

test('The groom consumes only its supplied clone and transfers ownership of generated geometry explicitly',()=>{
  const original=new T.SphereGeometry(.08,12,8).toNonIndexed();original.translate(0,1.62,0);
  const source=original.clone(),snapshot=copyAttributes(original);let inputDisposals=0,originalDisposals=0,outputDisposals=0;
  source.addEventListener('dispose',()=>inputDisposals++);original.addEventListener('dispose',()=>originalDisposals++);
  const groom=groomActorHair(source,identities[0],{quality:'performance'});groom.addEventListener('dispose',()=>outputDisposals++);
  assert.equal(inputDisposals,1);assert.equal(originalDisposals,0);assert.deepEqual(copyAttributes(original),snapshot);assert.notEqual(groom,source);
  groom.dispose();assert.equal(outputDisposals,1);assert.equal(inputDisposals,1);original.dispose();
});

test('Material batching merges tint-only differences but preserves maps, roughness and physical eye clearcoat',()=>{
  const base=new T.MeshStandardMaterial({color:0xff0000,roughness:.84}),tint=base.clone();tint.color.set(0x00ff00);
  const rough=base.clone();rough.roughness=.28;const mapped=base.clone();mapped.map=new T.Texture();
  const eye=new T.MeshPhysicalMaterial({roughness:.27,clearcoat:.8,clearcoatRoughness:.15}),lessCoated=eye.clone();lessCoated.clearcoat=.2;
  assert.equal(actorMaterialKey(base),actorMaterialKey(tint));assert.notEqual(actorMaterialKey(base),actorMaterialKey(rough));assert.notEqual(actorMaterialKey(base),actorMaterialKey(mapped));assert.notEqual(actorMaterialKey(eye),actorMaterialKey(lessCoated));
  const group=new T.Group(),bone=new T.Bone();bone.name='head';group.add(bone);
  const geometries=new Set(),materials=new Set([base,tint,eye]),skeletons=new Set(),sources=[base,tint,eye].map((material,i)=>{const geometry=new T.PlaneGeometry(.02,.02);geometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.position.x=i*.03;bone.add(mesh);return mesh;});
  const skins=bindActorSurfaces(group,sources,{geometries,materials,skeletons});assert.equal(skins.length,2);
  const painted=skins.find(m=>!m.material.isMeshPhysicalMaterial),physical=skins.find(m=>m.material.isMeshPhysicalMaterial);
  // Two quads and one, each keeping its four shared corners: 4 and 2 triangles.
  assert.equal(painted.geometry.index.count,12);assert.equal(painted.geometry.attributes.position.count,8);
  assert.equal(physical.geometry.index.count,6);assert.equal(physical.geometry.attributes.position.count,4);assert.equal(physical.material.roughness,.27);assert.equal(physical.material.clearcoat,.8);
  const colors=painted.geometry.attributes.color;assert.ok(colors.getX(0)>.99&&colors.getY(0)<.01);assert.ok(colors.getY(4)>.99&&colors.getX(4)<.01);
  for(const s of skeletons)s.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const m of [rough,mapped,lessCoated])m.dispose();mapped.map.dispose();
});

test('Final production actors retain two forward-facing physical irises through rigid and weighted batching',()=>{
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();
  for(const unit of [{id:'hero'},{id:'aelia',name:'Aelia',role:'voter'}]){
    const actor=createActor(unit,{assetLibrary:catalog,quality:'balanced'}),eyes=[];actor.group.traverse(o=>{if(o.isSkinnedMesh&&o.material?.isMeshPhysicalMaterial&&o.material.clearcoat===.8)eyes.push(o);});
    assert.equal(eyes.length,1,'Both irises share one physical material draw after batching.');const mesh=eyes[0],p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    const ix=mesh.geometry.index;assert.equal(ix.count,1920);assert.ok(p.count<ix.count,'The irises keep their shared vertices');assert.equal(mesh.material.roughness,.27);assert.equal(mesh.material.clearcoatRoughness,.15);assert.equal(mesh.material.vertexColors,true);
    // The center ring repeats its point; aperture-clipped outer rings also meet
    // at the eyelid boundary. Both legitimately create zero-area triangles.
    let nondegenerate=0;for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i));b.fromBufferAttribute(p,ix.getX(i+1));c.fromBufferAttribute(p,ix.getX(i+2));normal.subVectors(b,a).cross(c.sub(a));if(normal.lengthSq()<1e-22)continue;assert.ok(normal.z>0);for(let j=0;j<3;j++)assert.ok(n.getZ(ix.getX(i+j))>0,'Every rendered eye triangle shades forward.');nondegenerate++;}assert.ok(nondegenerate>400);
    actor.dispose();
  }
});
