import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {createFoliagePixels,createFoliageSprayGeometry,createNaturalBranchGeometry,FOLIAGE_CELLS} from '../src/showcase/environment-foliage.js';
import {createRoadSurfaceSampler} from '../src/showcase/environment-road-surface.js';
import {createEnvironmentMaterials,environmentImageUrls} from '../src/showcase/environment-materials.js';
import {createEnvironment} from '../src/showcase/environment.js';

test('Procedural fallback atlas has four distinct leafy cutouts with safe transparent cell gutters',()=>{
  const size=256,pixels=createFoliagePixels(size);assert.deepEqual(createFoliagePixels(size),pixels);
  const cells=[];
  for(let cell=0;cell<4;cell++){
    let clear=0,solid=0;const colors=new Set();
    for(let y=0;y<size/2;y++)for(let x=0;x<size/2;x++){
      const row=size-1-(Math.floor(cell/2)*size/2+y),col=cell%2*size/2+x,i=(row*size+col)*4,a=pixels[i+3];
      if(!a)clear++;if(a>200){solid++;colors.add([...pixels.subarray(i,i+3)].join(','));}
      if(x<4||y<4||x>=size/2-4||y>=size/2-4)assert.equal(a,0,'No neighboring cell leaks into a mipmapped cutout edge');
    }
    assert.ok(solid>500&&clear>1000);assert.ok(colors.size>50);cells.push(solid);
  }
  assert.equal(new Set(cells).size,4,'Species silhouettes are not repeated copies');
});

test('Leaf sprays use finite curved geometry and exact species UV bounds; natural branches taper and flare',()=>{
  for(const [kind,cell]of Object.entries(FOLIAGE_CELLS)){
    const g=createFoliageSprayGeometry(kind),uv=g.attributes.uv;
    for(const a of Object.values(g.attributes))for(const v of a.array)assert.ok(Number.isFinite(v));
    for(let i=0;i<uv.count;i++){assert.ok(uv.getX(i)>cell%2*.5&&uv.getX(i)<cell%2*.5+.5);assert.ok(uv.getY(i)>1-(Math.floor(cell/2)+1)*.5&&uv.getY(i)<1-Math.floor(cell/2)*.5);}
    assert.equal(g.index.count/3,24);assert.ok(g.boundingBox.max.z-g.boundingBox.min.z>.1);
    if(kind==='palm')assert.ok(g.boundingBox.min.y<-.3,'Palm tips droop in real geometry instead of a flat card');g.dispose();
  }
  for(let variant=0;variant<3;variant++){
    const g=createNaturalBranchGeometry(variant),p=g.attributes.position,n=g.attributes.normal,bottom=[],top=[];
    for(let i=0;i<p.count;i++){for(const a of [p,n])for(let k=0;k<a.itemSize;k++)assert.ok(Number.isFinite(a.array[i*a.itemSize+k]));if(p.getY(i)===0)bottom.push(Math.hypot(p.getX(i),p.getZ(i)));if(p.getY(i)===1)top.push(Math.hypot(p.getX(i),p.getZ(i)));}
    assert.ok(Math.min(...bottom)>Math.max(...top)*3,'Root flare transitions to a narrow crown');g.dispose();
  }
});

test('Road soil verge blends beyond the tread and stays stable at joins, endpoints and absent roads',()=>{
  const sample=createRoadSurfaceSampler([[{x:-5,z:0},{x:5,z:0}],[{x:5,z:0},{x:5,z:5}]]);
  for(const [x,z]of [[0,0],[5,0],[5,2]]){const s=sample.sample(x,z);assert.equal(s.distance,0);assert.ok(s.opacity>.7&&s.verge>.95);}
  for(let x=-4;x<=4;x+=.25)for(let z=0;z<=4;z+=.1){const s=sample.sample(x,z);assert.ok(s.verge>=s.opacity);assert.ok(s.verge>=0&&s.verge<=1&&s.opacity>=0&&s.opacity<=.78);}
  const outer=sample.sample(0,1.8);assert.equal(outer.opacity,0);assert.ok(outer.verge>0,'Mixed soil continues outside the transparent tread');assert.equal(sample.sample(0,4).verge,0);
  const none=createRoadSurfaceSampler([]).sample(0,0);assert.equal(none.verge,0);assert.equal(none.opacity,0);assert.equal(none.tone,1);
});

test('Cutout leaves remain opaque-depth alpha tested and all fallback resources release once',()=>{
  const library=createEnvironmentMaterials({loadTextures:false}),m=library.materials.foliage;
  assert.equal(m.transparent,false);assert.equal(m.depthWrite,true);assert.ok(m.alphaTest>.3);assert.equal(m.userData.environmentVegetation,true);assert.equal(m.map.isDataTexture,true);assert.equal(library.materials.bark.userData.environmentVegetation,undefined);
  let disposed=0;const owned=new Set([...library.textures,...Object.values(library.materials)]);for(const value of owned)value.addEventListener('dispose',()=>disposed++);
  library.dispose();library.dispose();assert.equal(disposed,owned.size);
});

// A stand-in for the session's image decoder: each decode waits for the test,
// and a "decoded image" is already the texture a stage would make from it.
function pendingImages(){
  const callbacks=[];
  return {callbacks,images:{decoded:()=>null,decode:url=>new Promise(ready=>callbacks.push([url,ready])),texture:image=>image}};
}
const settle=()=>new Promise(done=>setTimeout(done,0));
test('Images arriving after environment disposal cannot attach or leak a foliage texture',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document'),{callbacks,images}=pendingImages();
  try{
    Object.defineProperty(globalThis,'document',{configurable:true,value:{}});
    const library=createEnvironmentMaterials({loadTextures:true,images}),original=library.materials.foliage.map;library.dispose();assert.equal(callbacks.length,4);
    let disposed=0;for(const [,ready]of callbacks){const image=new T.Texture();image.addEventListener('dispose',()=>disposed++);ready(image);}
    await settle();assert.equal(disposed,callbacks.length);assert.equal(library.materials.foliage.map,original);
  }finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}
});

test('A loaded atlas replaces and releases its procedural map, while civic scenes request no foliage image',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document'),{callbacks,images}=pendingImages();
  try{
    Object.defineProperty(globalThis,'document',{configurable:true,value:{}});
    const library=createEnvironmentMaterials({loadTextures:true,images}),fallback=library.materials.foliage.map;let fallbackDisposals=0,atlasDisposals=0;fallback.addEventListener('dispose',()=>fallbackDisposals++);
    const atlas=new T.Texture();atlas.addEventListener('dispose',()=>atlasDisposals++);callbacks.find(([url])=>url.endsWith('foliage-v016.webp'))[1](atlas);await settle();
    assert.equal(library.materials.foliage.map,atlas);assert.equal(fallbackDisposals,1);assert.equal(library.textures.has(fallback),false);library.dispose();assert.equal(atlasDisposals,1);assert.equal(fallbackDisposals,1);
    callbacks.length=0;const civic=createEnvironmentMaterials({loadTextures:true,profile:{civic:true},images});assert.equal(callbacks.some(([url])=>url.endsWith('foliage-v016.webp')),false);civic.dispose();
    assert.deepEqual(environmentImageUrls({civic:true}).map(url=>url.split('/').pop()),['earth-v017.webp','stone-v017.webp','timber-v017.webp']);
    assert.ok(environmentImageUrls().at(-1).endsWith('foliage-v016.webp'));
  }finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}
});

test('Images decoded before a stage attach as it is built, so its materials never change program in play',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document'),made=[];
  try{
    Object.defineProperty(globalThis,'document',{configurable:true,value:{}});
    const images={decoded:url=>({url}),decode:()=>{throw Error('already decoded');},texture:image=>{const t=new T.Texture();t.userData.url=image.url;made.push(t);return t;}};
    const library=createEnvironmentMaterials({loadTextures:true,images}),m=library.materials;
    assert.equal(made.length,4,'each image becomes a texture at once');
    for(const key of ['earth','road','stone','brick','wood','darkWood'])assert.ok(m[key].map?.userData.url,`${key} has its map from the start`);
    assert.ok(m.foliage.map.userData.url.endsWith('foliage-v016.webp'));
    let disposed=0;for(const t of made)t.addEventListener('dispose',()=>disposed++);library.dispose();assert.equal(disposed,made.length,'the stage releases its own textures');
  }finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}
});

test('Foliage is instanced and quality bounded across frontier, wetland and palm settings without consuming state',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
  for(const [id,name]of [['ch1-road','oak leaves'],['ch2-marsh','willow leaves'],['ch9-wing','palm fronds']]){
    const s=fixture.scenes.find(s=>s.id===id),before=JSON.stringify(s.state);let previous=0;
    for(const quality of ['performance','balanced','high']){
      const scene=new T.Scene(),world=createEnvironment(scene,s.state.encounter,{chapter:s.chapter,quality,loadTextures:false}),mesh=world.group.getObjectByName(name);assert.ok(mesh?.isInstancedMesh);assert.ok(mesh.count>previous);previous=mesh.count;
      assert.equal(mesh.material.userData.environmentVegetation,true);let triangles=0,foliageDraws=0;world.group.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(o.material.userData.environmentVegetation)foliageDraws++;}});
      assert.ok(foliageDraws<=5);assert.ok(world.stats().meshes<60);assert.ok(triangles<650000);world.update(0);world.update(.5);world.update(5);assert.equal(JSON.stringify(s.state),before);world.dispose();assert.equal(scene.children.length,0);
    }
  }
});
