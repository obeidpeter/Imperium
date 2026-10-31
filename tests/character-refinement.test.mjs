import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {digest,splitFaceTriangles} from '../scripts/assets/refine-character.mjs';
import {parseCharacter,characterPoseMetrics} from '../scripts/assets/measure-character-refinement.mjs';
import {samplePerformance} from '../src/showcase/actor-performance.js';
import {actorPose,ACTOR_TIMING} from '../src/showcase/actor-pose.js';

const root=new URL('../',import.meta.url),file=path=>readFile(new URL(path,root)),manifest=JSON.parse(await file('docs/asset-manifest.json'));
const assets=manifest.assets.filter(a=>a.source?.refinement?.tool==='scripts/assets/refine-character.py');
const inFace=([x,y,z])=>y>1.53&&y<1.69&&Math.abs(x)<.13&&z>.035;
const contact=([x,y])=>y<.12||(Math.abs(x)>.16&&y<1.11);
const rows=a=>Array.from({length:a.count},(_,i)=>Array.from({length:a.itemSize},(_,k)=>a.getComponent(i,k)));

test('local face edge splits preserve winding and conform on both sides of a shared edge',()=>{
  const positions=[[0,0],[1,0],[0,1],[1,1]],indices=[0,1,2,1,3,2];
  for(const edges of [[[0,1]],[[0,1],[1,2]],[[0,1],[1,2],[0,2]],[[1,2]]]){
    const points=[...positions,...edges.map(([a,b])=>positions[a].map((v,k)=>(v+positions[b][k])/2))],split=splitFaceTriangles(indices,4,edges);
    let area=0;for(let i=0;i<split.length;i+=3){const [a,b,c]=split.slice(i,i+3).map(k=>points[k]),signed=((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;assert.ok(signed>0);area+=signed;}
    assert.equal(area,1);
    if(edges.some(([a,b])=>a===1&&b===2))for(let i=0;i<split.length;i+=3){const tri=split.slice(i,i+3);assert.ok(!(tri.includes(1)&&tri.includes(2)),'Neither adjacent triangle may retain the unsplit edge');}
  }
  assert.throws(()=>splitFaceTriangles(indices,4,[[1,2],[2,1]]),/unique/);
});

test('sixteen refined bodies preserve paint, identity coordinates, contact weights and bounded geometry on disk',async()=>{
  assert.equal(assets.length,16);
  let growth=0,addedTriangles=0;
  for(const asset of assets){
    const bytes=await file(asset.path),report=JSON.parse(await file(asset.source.refinement.report)),gltf=await parseCharacter(bytes);
    assert.equal(digest(bytes),report.sha256);assert.equal(bytes.length,report.bytes);assert.equal(asset.export.sha256,report.sha256);
    growth+=report.bytes-report.bytesBefore;
    const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString()),binStart=28+jsonLength;
    assert.deepEqual(json.images.map(im=>{const v=json.bufferViews[im.bufferView],image=bytes.subarray(binStart+(v.byteOffset??0),binStart+(v.byteOffset??0)+v.byteLength);return {mimeType:im.mimeType,bytes:image.length,sha256:digest(image)};}),report.textures,'Original compressed image payloads survive byte for byte');
    for(const [i,m]of report.meshes.entries()){
      const mesh=gltf.scene.getObjectByName(m.mesh),g=mesh.geometry,p=rows(g.attributes.position),normals=rows(g.attributes.normal),j=rows(g.attributes.skinIndex),w=rows(g.attributes.skinWeight),protectedSource=report.protectedGeometry[i];
      assert.equal(p.length,m.vertices);assert.equal(g.index.count/3,m.triangles);addedTriangles+=m.triangles-m.sourceTriangles;
      assert.equal(digest(p.slice(0,m.sourceVertices).map(([x,y])=>[x,y])),protectedSource.identityPlane);
      assert.equal(digest(p.flatMap((v,k)=>!inFace(v)?[[k,v]]:[])),protectedSource.nonFacePositions);
      assert.equal(digest(p.flatMap((v,k)=>contact(v)?[[k,v,j[k],w[k]]]:[])),protectedSource.contacts,'Wrists, hands and soles retain their exact vertices and influences');
      const uv=g.attributes.uv,uvArray=new Uint16Array(rows(uv).slice(0,m.sourceVertices).flat().map(v=>Math.round(v*65535)));
      assert.equal(digest(uvArray),protectedSource.uv,'All original UVs remain exact');
      for(let k=0;k<p.length;k++){
        assert.ok(p[k].every(Number.isFinite));assert.ok(j[k].every(v=>Number.isInteger(v)&&v>=0&&v<15));assert.ok(w[k].every(v=>Number.isFinite(v)&&v>=0));assert.ok(Math.abs(w[k].reduce((a,b)=>a+b,0)-1)<1e-6);
        if(inFace(p[k])){const n=normals[k];assert.ok(n.every(Number.isFinite));assert.ok(Math.hypot(...n)>.98&&Math.hypot(...n)<1.02);}
      }
      if(m.addedVertices)assert.ok(['body-roman-recruit','body-cast-aelia'].includes(asset.id)&&m.mesh==='body');
    }
    for(const region of Object.values(report.poseVerification.summary))for(const stat of Object.values(region))assert.ok(stat.improvement>0);
    assert.equal(report.poseVerification.baseline.contactSha256,report.poseVerification.refined.contactSha256);
    gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [o.material].flat())m.dispose();}});
  }
  assert.equal(growth,36432);assert.equal(addedTriangles,1257);
});

test('hero and Aelia production-rig pose strain still matches the measured refined geometry',async()=>{
  for(const id of ['roman-recruit','cast-aelia']){
    const asset=assets.find(a=>a.id===`body-${id}`),report=JSON.parse(await file(asset.source.refinement.report)),metrics=await characterPoseMetrics(await file(asset.path),id);
    assert.equal(metrics.contactSha256,report.poseVerification.refined.contactSha256);
    for(const [pose,regions]of Object.entries(metrics.poses))for(const [region,values]of Object.entries(regions))for(const stat of ['mean','p95'])assert.ok(Math.abs(values[stat]-report.poseVerification.refined.poses[pose][region][stat])<1e-9,`${id} ${pose} ${region} ${stat}`);
  }
});

test('starts plant before push-off, stops roll through braking, and shield recovery follows its unchanged impact apex',()=>{
  const base=actorPose(),load=actorPose({motion:'start',phase:.12}),push=actorPose({motion:'start',phase:.52});
  assert.deepEqual(load.feet,base.feet);assert.ok(load.hipY<base.hipY&&load.hipZ<0);assert.ok(push.feet.some(f=>f.y>.105));
  assert.ok(samplePerformance('stop',.2).rightFootRoll>.1);assert.ok(Object.values(samplePerformance('stop',.84)).filter(Number.isFinite).every(v=>Math.abs(v)<.013));
  for(const phase of [0,.09,1])assert.ok(Object.values(samplePerformance('shieldreceive',phase)).every(v=>v===0));
  assert.ok(samplePerformance('shieldreceive',.2).leftElbow<0);assert.ok(samplePerformance('shieldreceive',.42).rightFootY>.015);
  assert.deepEqual(actorPose({motion:'block',phase:.09}),actorPose({motion:'block',phase:.09,reducedMotion:true}));
  assert.notDeepEqual(actorPose({motion:'block',phase:.42}),actorPose({motion:'block',phase:.42,reducedMotion:true}));
  for(const motion of ['start','stop'])for(const phase of [0,1])assert.deepEqual(actorPose({motion,phase}),base);
  assert.equal(ACTOR_TIMING.contact,230/620);assert.equal(ACTOR_TIMING.release,310/620);
  assert.ok(Object.values(samplePerformance('strike',ACTOR_TIMING.contact)).every(v=>v===0));
  for(const motion of ['start','stop','hurt','block'])for(let i=0;i<=100;i++){
    const input=Object.freeze({motion,phase:i/100,time:0}),pose=actorPose(input);assert.deepEqual(pose,actorPose(input));assert.ok(pose.feet.every(f=>f.y>=.07));assert.ok(pose.legs.every(l=>Object.values(l).every(Number.isFinite)));
  }
});
