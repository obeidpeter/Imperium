import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {helmetBowlGeometry} from '../src/showcase/actor-helmet.js';
const root=new URL('../',import.meta.url);
test('Formed helmet normals face outward and the lip stays inside a human head silhouette',()=>{
  const g=helmetBowlGeometry(),p=g.attributes.position,n=g.attributes.normal;
  let outward=0;for(let i=0;i<p.count;i++)if(p.getY(i)<.25){assert.ok(p.getX(i)*n.getX(i)+(p.getZ(i)+.012)*n.getZ(i)>0);outward++;}
  assert.ok(outward>100);g.computeBoundingBox();assert.ok(g.boundingBox.max.y<.29);assert.ok(g.boundingBox.max.x<.14);g.dispose();
});
// The committed GLBs are checked as files. Whether they still match the
// character source is reported by `npm run audit:handoff`, not here: a code
// change to the characters must not fail the test suite until 22 MB of
// development assets are re-exported.
test('Complete GLBs carry valid embedded maps, skins, morphs and four playable animation clips',async()=>{
  const manifest=JSON.parse(await readFile(new URL('art-source/characters/manifest.json',root),'utf8'));
  assert.match(manifest.sourceDigest,/^[0-9a-f]{64}$/,'The manifest records which character source it was exported from');
  for(const item of manifest.characters){
    const b=await readFile(new URL(item.path,root));assert.equal(createHash('sha256').update(b).digest('hex'),item.sha256);
    assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);
    const jsonSize=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+jsonSize).toString()),binary=b.subarray(28+jsonSize);
    assert.equal(doc.asset.version,'2.0');assert.equal(doc.buffers.length,1);assert.equal(doc.buffers[0].uri,undefined);
    for(const v of doc.bufferViews)assert.ok(v.byteOffset>=0&&v.byteOffset+v.byteLength<=binary.length);
    for(const image of doc.images){assert.equal(image.mimeType,'image/png');const v=doc.bufferViews[image.bufferView];assert.equal(binary.subarray(v.byteOffset+1,v.byteOffset+4).toString(),'PNG');}
    assert.ok(doc.skins.length>=12);assert.ok(doc.meshes.some(m=>m.primitives.some(p=>p.targets?.length)));
    for(const skin of doc.skins)assert.ok(skin.joints.every(i=>doc.nodes[i]));
    // The browser workshop checks actual PNG decoding. Node round-trips the
    // same geometry, joints and clips without a browser image decoder.
    const loader=new GLTFLoader();loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));
    const gltf=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
    assert.deepEqual(gltf.animations.map(c=>c.name),['idle','walk','attack','block']);
    const mixer=new T.AnimationMixer(gltf.scene);
    for(const clip of gltf.animations){
      mixer.stopAllAction();mixer.clipAction(clip).play();mixer.setTime(clip.duration*.37);gltf.scene.updateMatrixWorld(true);
      const bounds=new T.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new T.Vector3());
      assert.ok(size.toArray().every(Number.isFinite));assert.ok(size.y>1.5&&size.y<2.5);assert.ok(size.x<3.5&&size.z<3.5,`${item.id}/${clip.name}: intact skin and equipment`);
      gltf.scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
    }
    mixer.stopAllAction();gltf.scene.traverse(o=>{o.geometry?.dispose();o.skeleton?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.dispose();});
  }
});
