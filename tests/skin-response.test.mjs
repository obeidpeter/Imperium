import test from 'node:test';
import assert from 'node:assert/strict';
import {skinMicroNormal,skinRoughness} from '../src/showcase/skin-response.js';
test('Original pores are deterministic, unit-length tangent normals with a restrained slope',()=>{
  const a=skinMicroNormal(),b=skinMicroNormal();assert.deepEqual(a,b);
  let varied=false;
  for(let i=0;i<a.data.length;i+=4){
    const n=[a.data[i],a.data[i+1],a.data[i+2]].map(x=>x/255*2-1);
    assert.ok(Math.abs(Math.hypot(...n)-1)<.012);assert.ok(n[2]>.9);varied||=a.data[i]!==128;
  }
  assert.ok(varied);assert.throws(()=>skinMicroNormal(1024),RangeError);
});
test('Pigment changes roughness without copying the painted shadow into a normal',()=>{
  const pixels=new Uint8Array([234,188,157,255,167,98,96,255,64,60,57,255]),before=pixels.slice(),map=skinRoughness(pixels);
  assert.deepEqual(pixels,before);assert.ok(map[4]<map[0]);assert.ok(map[8]>map[0]);assert.equal(map[7],255);
});
