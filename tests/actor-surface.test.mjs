import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {ACTOR_SURFACE_SPEC,actorSurfaceSample,createActorSurfaceData,composeActorAlbedo} from '../src/showcase/actor-surface.js';
import {acquireActorSurface,releaseActorSurface} from '../src/showcase/actor-materials.js';

const mean=(data,channel=0)=>{let n=0;for(let i=channel;i<data.length;i+=4)n+=data[i];return n/(data.length/4);};
test('Original material fields tile periodically, stay deterministic and distinguish rough cloth from skin and metal',()=>{
  for(const kind of Object.keys(ACTOR_SURFACE_SPEC)){
    assert.ok(Object.isFrozen(ACTOR_SURFACE_SPEC[kind].repeat));
    for(const [u,v]of [[0,0],[.125,.75],[.278,.493],[-.2,1.42]]){
      const a=actorSurfaceSample(kind,u,v),b=actorSurfaceSample(kind,u+1,v-2);
      assert.deepEqual(a,actorSurfaceSample(kind,u,v));
      assert.ok(a.every((n,i)=>Number.isFinite(n)&&n>=0&&n<=1&&Math.abs(n-b[i])<1e-12),kind);
    }
  }
  const cloth=createActorSurfaceData('cloth',{normalSize:32}),skin=createActorSurfaceData('skin',{normalSize:32}),metal=createActorSurfaceData('metal',{normalSize:32});
  assert.ok(mean(cloth.roughness)>220,'Woven fibers have a broad matte highlight.');
  assert.ok(mean(skin.roughness)>135&&mean(skin.roughness)<185,'Skin is neither fabric-matte nor metal-polished.');
  assert.ok(mean(metal.roughness)<110&&ACTOR_SURFACE_SPEC.metal.metalness>.8,'Hammered metal has a distinct reflective response.');
  assert.equal(ACTOR_SURFACE_SPEC.skin.metalness,0);assert.equal(ACTOR_SURFACE_SPEC.cloth.metalness,0);
});

test('Tangent normals are normalized, outward-facing and follow the actual periodic relief slopes',()=>{
  for(const kind of ['cloth','leather','mail','skin','metal']){
    const data=createActorSurfaceData(kind),size=data.normalSize,gain=ACTOR_SURFACE_SPEC[kind].normalGain,d=1/size;let tilted=0,checked=0;
    for(let y=0;y<size;y+=3)for(let x=0;x<size;x+=3){
      const i=(y*size+x)*4,n=[data.normal[i]/255*2-1,data.normal[i+1]/255*2-1,data.normal[i+2]/255*2-1];
      assert.ok(Math.abs(Math.hypot(...n)-1)<.012,kind);assert.ok(n[2]>.5,'No inverted or sideways detail normals.');assert.equal(data.normal[i+3],255);
      const u=(x+.5)/size,v=(y+.5)/size,dx=(actorSurfaceSample(kind,u+d,v)[0]-actorSurfaceSample(kind,u-d,v)[0])*gain/(2*d);
      if(Math.abs(dx)>.02){assert.ok(n[0]*dx<0,'A raised edge tilts against its uphill gradient.');checked++;}
      if(Math.abs(n[0])+Math.abs(n[1])>.02)tilted++;
    }
    if(kind!=='skin'){assert.ok(checked>10,kind);assert.ok(tilted>20,kind);}
    assert.deepEqual(data.normal,createActorSurfaceData(kind).normal,'No retained animation or random seed changes a surface.');
  }
  assert.throws(()=>createActorSurfaceData('mail',{normalSize:4096}),RangeError);
});

test('Interlinked mail retains raised crossing wires and bright bounded recesses after dark painted wear loads',()=>{
  const data=createActorSurfaceData('mail'),painted=new Uint8Array(96*96*4);let raised=0,recesses=0;
  for(let i=0;i<painted.length;i+=4){painted.set([i%8?35:255,i%8?35:255,i%8?35:255,255],i);if(data.height[i]>150)raised++;if(data.height[i]<80)recesses++;}
  assert.ok(raised>1000&&recesses>300,'The tile has both rounded wire crowns and openings.');
  const before=painted.slice(),composed=composeActorAlbedo(painted,'mail',96);assert.deepEqual(painted,before);
  let lowSum=0,highSum=0,lowCount=0,highCount=0;
  for(let i=0;i<composed.length;i+=4){assert.ok(composed[i]>=125,'Illustrated holes cannot turn into large near-black spots.');if(data.height[i]>150){highSum+=composed[i];highCount++;}if(data.height[i]<80){lowSum+=composed[i];lowCount++;}}
  assert.ok(highSum/highCount>lowSum/lowCount+35,'Diffuse links still align with relief, regardless of painted wear.');
  assert.throws(()=>composeActorAlbedo(painted,'mail',32),RangeError);
});

test('Hair follows cylindrical strands with subdued color and broad rough highlights',()=>{
  const data=createActorSurfaceData('hair');let across=0,along=0,min=255,max=0;
  for(let i=0;i<data.normal.length;i+=4){across+=Math.abs(data.normal[i]-127.5);along+=Math.abs(data.normal[i+1]-127.5);}
  for(let i=0;i<data.color.length;i+=4){min=Math.min(min,data.color[i]);max=Math.max(max,data.color[i]);}
  assert.ok(across>along*3,'Normal grooves follow the strand direction, not isotropic noise.');
  assert.ok(max-min<32,'Hair color stays cohesive rather than alternating bright stripes.');
  assert.ok(mean(data.roughness)>185&&mean(data.roughness)<220);assert.equal(ACTOR_SURFACE_SPEC.hair.metalness,0);
});

test('All four surface textures are shared, bounded and released once at the last actor owner',()=>{
  const keys=['map','bumpMap','roughnessMap','normalMap'];
  for(const kind of Object.keys(ACTOR_SURFACE_SPEC)){
    const first=acquireActorSurface(kind),second=acquireActorSurface(kind);assert.equal(first,second);
    assert.equal(first.map.colorSpace,T.SRGBColorSpace);assert.equal(first.normalMap.colorSpace,T.NoColorSpace);assert.equal(first.roughnessMap.colorSpace,T.NoColorSpace);
    assert.equal(first.normalMap.image.width,192);assert.equal(first.normalMap.image.height,192);
    assert.ok(first.normalScale.x>0&&first.normalScale.x<=1);assert.equal(first.emissive,undefined);
    let disposed=0,bytes=0;for(const key of keys){const texture=first[key];texture.addEventListener('dispose',()=>disposed++);bytes+=texture.image.data.byteLength;assert.equal(texture.wrapS,T.RepeatWrapping);assert.equal(texture.generateMipmaps,true);assert.equal(texture.anisotropy,4);assert.deepEqual(texture.repeat.toArray(),first.map.repeat.toArray());}
    assert.ok(bytes<=258048,'Per-kind native texture data has an explicit small bound.');
    releaseActorSurface(kind);assert.equal(disposed,0);releaseActorSurface(kind);assert.equal(disposed,4);releaseActorSurface(kind);assert.equal(disposed,4);
    const reopened=acquireActorSurface(kind);assert.notEqual(reopened.normalMap,first.normalMap);assert.deepEqual(reopened.normalMap.image.data,first.normalMap.image.data);releaseActorSurface(kind);
  }
});

test('Late atlas decode changes live diffuse data without replacing normals or reviving disposed owners',async()=>{
  const saved={Image:globalThis.Image,document:globalThis.document},images=[];
  globalThis.Image=class{constructor(){this.naturalWidth=this.naturalHeight=512;images.push(this);}set src(value){this.url=value;}};
  const painted=new Uint8ClampedArray(256*256*4).fill(190);
  globalThis.document={createElement:()=>({getContext:()=>({clearRect(){},drawImage(){},getImageData(){return {data:painted};}})})};
  try{
    const module=await import('../src/showcase/actor-materials.js?surface-lifecycle');
    const mail=module.acquireActorSurface('mail'),leather=module.acquireActorSurface('leather'),normal=mail.normalMap,original=normal.image.data.slice();
    let releasedNormal=0;leather.normalMap.addEventListener('dispose',()=>releasedNormal++);module.releaseActorSurface('leather');
    const pending=module.warmActorMaterials();assert.equal(images.length,1);images[0].onload();assert.equal(await pending,true);
    assert.equal(mail.normalMap,normal);assert.deepEqual(normal.image.data,original);assert.equal(mail.map.image.width,256);assert.equal(mail.map.userData.source,'character-materials-v016');
    assert.equal(leather.map.image.width,96);assert.equal(releasedNormal,1);module.releaseActorSurface('mail');
    const renewed=module.acquireActorSurface('mail');assert.equal(renewed.map.image.width,256);assert.notEqual(renewed.normalMap,normal);
    // The second, independent library replaces only cloth/wool/leather/metal
    // albedo. Mail keeps its authored link pattern and late loads must not
    // recreate the leather textures whose owner has already been disposed.
    assert.equal(images.length,2);assert.notEqual(images[0].url,images[1].url);
    const live=module.acquireActorSurface('cloth'),liveMap=live.map,liveNormal=live.normalMap,liveNormalData=liveNormal.image.data.slice();
    const premium=module.warmPremiumActorMaterials();assert.equal(module.warmPremiumActorMaterials(),premium);images[1].onload();assert.equal(await premium,true);
    assert.equal(live.map,liveMap);assert.equal(live.map.userData.source,'roman-surfaces-v034');assert.equal(live.normalMap,liveNormal);assert.deepEqual(liveNormal.image.data,liveNormalData);
    assert.equal(renewed.map.userData.source,'character-materials-v016');assert.equal(leather.map.image.width,96);assert.equal(releasedNormal,1);
    const restoredLeather=module.acquireActorSurface('leather');assert.equal(restoredLeather.map.userData.source,'roman-surfaces-v034');assert.notEqual(restoredLeather.normalMap,leather.normalMap);
    let liveDisposed=0;for(const key of ['map','normalMap','roughnessMap','bumpMap'])live[key].addEventListener('dispose',()=>liveDisposed++);
    module.releaseActorSurface('cloth');module.releaseActorSurface('cloth');assert.equal(liveDisposed,4);
    module.releaseActorSurface('leather');module.releaseActorSurface('mail');assert.equal(images.length,2,'Each source is decoded only once.');
  }finally{for(const key of ['Image','document'])if(saved[key]===undefined)delete globalThis[key];else globalThis[key]=saved[key];}
});
