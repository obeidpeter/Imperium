import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createSky,skyPalette,skyProjection,SKY_GRADIENT} from '../src/showcase/sky.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';

test('Sky remains a single bounded inward draw with no textures, shadow work or scene-state changes',()=>{
  for(const quality of ['performance','balanced','high']){
    const scene=new T.Scene(),fog=new T.FogExp2('#a1b1a7',.018),background=new T.Color('#123456');scene.fog=fog;scene.background=background;
    const profile=getSceneProfile({id:'ch2-marsh',kind:'battle'}),before=JSON.stringify(profile),sky=createSky(scene,profile,{quality}),mesh=sky.group.children[0],stats=sky.stats();
    assert.equal(stats.draws,1);assert.ok(stats.triangles<=1000&&stats.triangles>=500);assert.equal(stats.textures,0);assert.equal(mesh.material.side,T.BackSide);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.fog,false);assert.equal(mesh.material.toneMapped,true);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);
    assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));assert.equal(scene.fog,fog);assert.equal(scene.background,background);assert.equal(JSON.stringify(profile),before);sky.dispose();
  }
});

test('Camera-centered dome encloses translated and parented cameras and remains visible to upward/horizon rays',()=>{
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,800),parent=new T.Group();parent.position.set(160,25,-340);parent.add(camera);scene.add(parent);camera.position.set(2,3,4);const sky=createSky(scene,{});
  for(const x of [0,35,700]){parent.position.x=x;scene.updateMatrixWorld(true);sky.update(x,camera);scene.updateMatrixWorld(true);const center=camera.getWorldPosition(new T.Vector3());assert.ok(center.distanceTo(sky.group.position)<1e-8);
    for(const direction of [new T.Vector3(0,1,0),new T.Vector3(1,.01,0).normalize(),new T.Vector3(0,-1,0)]){const hits=new T.Raycaster(center,direction,0,800).intersectObject(sky.group,true);assert.ok(hits.length>0);assert.ok(hits[0].distance>690&&hits[0].distance<=700.001);}
  }
  sky.dispose();
});

test('Chapter sky colors use the same linear horizon as distant landscape and sun aligns with the authored light',()=>{
  const zeniths=new Set();
  for(let chapter=1;chapter<=12;chapter++){
    const profile=getSceneProfile({id:`ch${chapter}-fixture`,kind:'battle'}),palette=skyPalette(profile),sky=createSky(new T.Scene(),profile),material=sky.group.children[0].material;
    assert.deepEqual(palette.horizon,new T.Color(profile.fog));assert.deepEqual(material.uniforms.horizonColor.value,palette.horizon);assert.ok(palette.zenith.b>palette.zenith.r,'Upper sky has a readable blue atmospheric gradient.');zeniths.add(palette.zenith.getHex());
    assert.ok(material.uniforms.sunDirection.value.distanceTo(new T.Vector3(...profile.sunPosition).normalize())<1e-10);sky.dispose();
  }
  assert.ok(zeniths.size>=10,'Chapter palettes remain visibly differentiated rather than using a universal flat background.');
});

test('Reduced motion freezes cloud drift, including across camera movement and resume; disposal is idempotent',()=>{
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(),sky=createSky(scene,{}),mesh=sky.group.children[0];sky.update(0,camera);sky.update(3,camera);assert.equal(sky.stats().cloudTime,3);
  camera.position.set(5,2,8);sky.update(4,camera,true);sky.update(100,camera,true);assert.equal(sky.stats().cloudTime,3);assert.deepEqual(sky.group.position,camera.position);sky.update(101,camera,false);assert.equal(sky.stats().cloudTime,4,'Resume advances only since the last paused sample, without jumping through the paused period.');sky.update(NaN,camera);assert.equal(sky.stats().cloudTime,4);
  let geometryDisposals=0,materialDisposals=0;mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);mesh.material.addEventListener('dispose',()=>materialDisposals++);sky.dispose();sky.dispose();sky.update(102,camera);assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);assert.equal(scene.children.includes(sky.group),false);
});

test('Low-horizon clouds disappear before projection clamps, while a fourteen-degree view has blue upper sky',()=>{
  const ray=degrees=>new T.Vector3(Math.cos(degrees*Math.PI/180),Math.sin(degrees*Math.PI/180),0),low=skyProjection(ray(1)),four=skyProjection(ray(4)),six=skyProjection(ray(6)),eight=skyProjection(ray(8)),top=skyProjection(ray(14));
  assert.ok(SKY_GRADIENT.projectionFloor<SKY_GRADIENT.cloudFadeStart);assert.equal(low.cloudWeight,0);assert.equal(four.cloudWeight,0);assert.ok(six.cloudWeight>0&&six.cloudWeight<eight.cloudWeight);assert.ok(eight.x<six.x*.8,'Cloud sampling continues to vary with elevation rather than forming a constant-angle column.');assert.ok(top.blueWeight>.65,'The actual horizon camera top is visibly inside the blue gradient.');
  for(const degrees of [-89,-1,0,1,4,6,8,14,45,89]){const value=skyProjection(ray(degrees));assert.ok(Object.values(value).every(Number.isFinite));assert.ok(value.cloudWeight>=0&&value.cloudWeight<=1);}
});
