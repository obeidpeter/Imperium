import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseCharacter} from '../scripts/assets/measure-character-refinement.mjs';
import {digest} from '../scripts/assets/refine-character.mjs';
import {joinGeneratedNeck} from '../src/showcase/generated-neck.js';
const root=new URL('../',import.meta.url),file=p=>readFile(new URL(p,root));
const manifest=JSON.parse(await file('docs/asset-manifest.json'));
const row=(a,i)=>Array.from({length:a.itemSize},(_,k)=>a.getComponent(i,k));
const vertex=(g,i)=>JSON.stringify(['position','normal','uv','skinIndex','skinWeight'].map(key=>row(g.attributes[key],i)));

test('repaired distant heads retain the near source UV seams, geometry and exact skin weights',async()=>{
  const assets=manifest.assets.filter(a=>a.source?.surfaceRepair);
  assert.equal(assets.length,17);
  let painted=0,rebuilt=0;
  for(const asset of assets){
    const report=JSON.parse(await file(asset.source.surfaceRepair.report)),old=JSON.parse(await file(asset.source.refinement.report)),bytes=await file(asset.path);
    assert.equal(report.inputSha256,old.sha256);assert.equal(digest(bytes),report.sha256);assert.equal(bytes.length,asset.export.bytes);
    if(report.paint){painted++;assert.equal(report.paint.codec,'KTX2 UASTC / Zstandard');assert.equal(digest(await file(report.paint.source)),report.paint.sourceSha256);}
    const parsed=await parseCharacter(bytes);
    if(report.overview){
      rebuilt++;const near=parsed.scene.getObjectByName('cast-head').geometry,low=parsed.scene.getObjectByName('cast-head-overview').geometry;
      assert.equal(low.index.count/3,report.overview.triangles);assert.ok(low.index.count<near.index.count);assert.ok(low.index.count/3<=1200);
      const source=new Set(Array.from({length:near.attributes.position.count},(_,i)=>vertex(near,i)));
      for(let i=0;i<low.attributes.position.count;i++)assert.ok(source.has(vertex(low,i)),`${asset.id}: overview vertex ${i} keeps its source paint and binding`);
      for(let i=0;i<low.index.count;i++)assert.ok(low.index.getX(i)<low.attributes.position.count);
    }
    parsed.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [o.material].flat())m.dispose();}});
  }
  assert.equal(painted,5);assert.equal(rebuilt,15);
});

test('civilian neck joins stay below the face, retain normalized skinning and leave source masters unchanged',async()=>{
  for(const id of ['cast-severianus','cast-paullus','cast-theon']){
    const parsed=await parseCharacter(await file(`assets/models/characters/${id}.glb`));
    for(const suffix of ['', '-overview']){
      const body=parsed.scene.getObjectByName('body'+suffix).geometry,head=parsed.scene.getObjectByName('cast-head'+suffix).geometry;
      const before=[body,head].map(g=>digest(g.attributes.position.array));
      const joined=joinGeneratedNeck(body,head);assert.ok(joined,`${id}${suffix}`);
      assert.ok(joined.head.userData.neckTriangles>16&&joined.head.userData.neckTriangles<600);
      const p=joined.head.attributes.position,w=joined.head.attributes.skinWeight,j=joined.head.attributes.skinIndex;
      const start=p.count-joined.head.userData.neckTriangles*2;
      for(let i=start;i<p.count;i++){
        assert.ok(p.getY(i)>=1.48999&&p.getY(i)<=1.51001);
        assert.ok(row(p,i).every(Number.isFinite));assert.ok(Math.abs(row(w,i).reduce((a,b)=>a+b,0)-1)<1e-6);
        assert.ok(row(j,i).every(n=>Number.isInteger(n)&&n>=0&&n<15));
      }
      assert.deepEqual([body,head].map(g=>digest(g.attributes.position.array)),before);
      joined.body.dispose();joined.head.dispose();
    }
    parsed.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [o.material].flat())m.dispose();}});
  }
});
