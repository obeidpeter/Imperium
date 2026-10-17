import * as THREE from '../../vendor/three/three.module.js';
import {noise,hash,clamp} from './environment-layout.js';
import {finishEnvironmentMaterial} from './environment-surface-shaders.js';
import {createFoliagePixels,FOLIAGE_ATLAS_URL} from './environment-foliage.js';

export function createEnvironmentMaterials({loadTextures=true,profile=null}={}){
  const textures=new Set(),materials=new Set();let disposed=false;
  const texture=(data,size,color=true)=>{const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;t.needsUpdate=true;textures.add(t);return t;};
  function surface(kind,size=128){
    const bytes=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),height=new Float32Array(size*size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const fine=hash(x,y,2),grain=noise(x*.14,y*.14,4),broad=noise(x*.039,y*.039,8);
      height[y*size+x]=kind==='bark'?noise(x*.21,y*.019,21)*.49+Math.pow(.5+.5*Math.sin(x*.40+noise(x*.07,y*.04,22)*3),3)*.36+fine*.15:kind==='wood'?noise(x*.34,y*.023,5)*.6+noise(x*.73,y*.036,6)*.2+fine*.2:grain*.55+broad*.28+fine*.17;
    }
    const colors={earth:[115,104,76],grass:[81,88,60],stone:[129,126,108],wood:[84,64,43],bark:[134,125,105],cloth:[208,189,146]};
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=y*size+x,h=height[i],value=kind==='grass'?.88+h*.22:.65+h*.64,base=colors[kind],weave=kind==='cloth'?((x%4===0||y%4===0)?-.07:.025):0;
      for(let c=0;c<3;c++)bytes[i*4+c]=clamp((value+weave)*base[c],0,255);bytes[i*4+3]=255;
      const dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size],dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x],v=new THREE.Vector3(-dx*.7,-dy*.7,1).normalize();
      normal.set([Math.round((v.x*.5+.5)*255),Math.round((v.y*.5+.5)*255),Math.round((v.z*.5+.5)*255),255],i*4);
    }return {map:texture(bytes,size),normalMap:texture(normal,size,false)};
  }
  const make=(props)=>{const m=new THREE.MeshStandardMaterial(props);materials.add(m);return m;};
  const maps=Object.fromEntries(['earth','grass','stone','wood','bark','cloth'].map(k=>[k,surface(k)]));
  const m={
    ground:make({...maps.grass,color:0xeee5cf,roughness:1,vertexColors:true,normalScale:new THREE.Vector2(.24,.24)}),
    earth:make({...maps.earth,color:0xc5b997,roughness:.98,normalScale:new THREE.Vector2(.55,.55)}),
    road:make({...maps.earth,color:0xe3d6b9,roughness:.98,normalScale:new THREE.Vector2(.22,.22),vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
    stone:make({...maps.stone,color:0xeee8d6,roughness:.98,normalScale:new THREE.Vector2(.4,.4)}),
    wood:make({...maps.wood,color:0xc5b18d,roughness:.88}),
    darkWood:make({...maps.wood,color:0x65533c,roughness:1}),
    bark:make({...maps.bark,color:0xc7c1ac,roughness:.97,normalScale:new THREE.Vector2(.72,.72)}),
    cloth:make({...maps.cloth,color:0xeee2c9,roughness:1,side:THREE.DoubleSide}),
    rope:make({color:0x958162,roughness:1}),iron:make({color:0x3a3832,roughness:.75,metalness:.5}),
    terra:make({color:0x9c5837,roughness:.92}),red:make({color:0x722f2b,roughness:1,side:THREE.DoubleSide}),
    leaves:make({color:0x87976e,roughness:.88,side:THREE.DoubleSide}),
    foliage:make({map:texture(createFoliagePixels(),512),color:0xf2f3de,roughness:.86,side:THREE.DoubleSide,alphaTest:.42,transparent:false,depthWrite:true}),
    grass:make({color:0x8d986c,roughness:.94,side:THREE.DoubleSide}),
    dryGrass:make({color:0xb4a77b,roughness:1,side:THREE.DoubleSide}),
    water:make({color:0x4f7b7c,roughness:.2,metalness:.27,transparent:true,opacity:.83,depthWrite:false}),
    mud:make({...maps.earth,color:0x4d5344,roughness:.72}),charcoal:make({color:0x292822,roughness:1})
  };
  m.foliage.name='cutout leaf sprays';m.foliage.userData.environmentVegetation=true;m.leaves.userData.environmentVegetation=true;
  m.bark.name='weathered tree bark';
  // Fine original vein/grain fields for architectural surfaces; these remain
  // code-native and do not depend on additional image downloads.
  const marbleBytes=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const wave=x*.13+y*.035+noise(x*.035,y*.035,67)*5,vein=Math.pow(Math.max(0,Math.cos(wave)),16),grain=hash(x,y,71)*6;
    for(let c=0;c<3;c++)marbleBytes[(y*128+x)*4+c]=[217,211,197][c]-vein*32+grain;marbleBytes[(y*128+x)*4+3]=255;
  }
  const marbleMap=texture(marbleBytes,128);
  m.floor=make({map:marbleMap,color:0xeee5d2,roughness:.64});
  m.redMarble=make({map:marbleMap,color:0x765348,roughness:.66});
  m.ivory=make({map:maps.cloth.map,color:0xeadfc8,roughness:.89});
  m.plaster=make({map:maps.stone.map,color:0xc8b79a,roughness:.96,normalMap:maps.stone.normalMap,normalScale:new THREE.Vector2(.08,.08)});
  m.sand=make({...maps.earth,color:0xd6c098,roughness:1,normalScale:new THREE.Vector2(.18,.18)});
  m.marble=make({...maps.stone,color:0xe0d7bd,roughness:.70,normalScale:new THREE.Vector2(.12,.12)});
  m.brick=make({...maps.stone,color:0x9d7457,roughness:1,normalScale:new THREE.Vector2(.26,.26)});
  m.darkStone=make({...maps.stone,color:0x786f61,roughness:.94});
  m.inlay=make({color:0x9c7861,roughness:.72});m.brass=make({color:0xb8a36f,roughness:.52,metalness:.55});
  m.marshWater=make({color:0x3e5145,roughness:.34,metalness:.08,transparent:true,opacity:.70,depthWrite:false,vertexColors:true});
  if(profile){m.ground.color.set(profile.vegetation==='reeds'?'#c9ceb9':'#eee5cf');if(profile.chapter!==1)m.stone.color.set(profile.stoneColor);m.water.color.set(profile.waterColor);if(profile.setting==='wetland'){m.ground.roughness=.86;m.road.color.set('#b7ad8e');m.road.roughness=.83;}if(profile.vegetation==='arid'){m.ground.color.set('#ecdbc0');m.road.color.set('#cfb991');}}
  // One lit surface blends the generated soil image with the fine turf map.
  // Vertex weights describe worn ground; they never encode movement rules.
  const soilUniform={value:maps.earth.map};
  m.ground.userData.soilTexture=soilUniform;
  m.ground.onBeforeCompile=shader=>{
    shader.uniforms.frontierSoil=soilUniform;
    shader.vertexShader='attribute float soilMix; varying float vSoilMix;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSoilMix = soilMix;');
    shader.fragmentShader='uniform sampler2D frontierSoil; varying float vSoilMix;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
      vec4 turf = texture2D(map, vMapUv);
      vec3 soil = mix(texture2D(frontierSoil, vMapUv * 0.71).rgb, texture2D(frontierSoil, vec2(-vMapUv.y, vMapUv.x) * 0.47 + vec2(0.37, 0.19)).rgb, 0.36);
      diffuseColor *= vec4(mix(turf.rgb, soil * vec3(0.89, 0.91, 0.88), clamp(vSoilMix, 0.0, 1.0)), turf.a);
    #endif`);
  };
  m.ground.customProgramCacheKey=()=> 'frontier-soil-turf-v2';
  const finish={wet:profile?.setting==='wetland',arid:profile?.vegetation==='arid'};
  finishEnvironmentMaterial(m.ground,'ground',finish);
  for(const key of ['stone','marble','brick','darkStone','plaster','redMarble'])finishEnvironmentMaterial(m[key],'stone',finish);
  for(const key of ['wood','darkWood','bark'])finishEnvironmentMaterial(m[key],'wood',finish);
  for(const key of ['leaves','foliage'])finishEnvironmentMaterial(m[key],'foliage',finish);finishEnvironmentMaterial(m.floor,'floor',finish);
  // Local neutral colour maps; procedural surfaces remain usable on failure.
  if(loadTextures&&typeof document!=='undefined')for(const [kind,file]of [['earth','earth'],['stone','stone'],['wood','timber']])new THREE.TextureLoader().load(new URL(`../../assets/showcase/${file}.webp`,import.meta.url).href,t=>{
    if(disposed){t.dispose();return;}t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;textures.add(t);
    for(const key of kind==='wood'?['wood','darkWood']:kind==='earth'?['earth','road','mud','sand']:['stone','marble','brick','darkStone']){m[key].map=t;m[key].needsUpdate=true;}if(kind==='earth')soilUniform.value=t;
  },undefined,()=>{});
  if(loadTextures&&!profile?.civic&&typeof document!=='undefined')new THREE.TextureLoader().load(FOLIAGE_ATLAS_URL.href,t=>{
    if(disposed){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;textures.add(t);const fallback=m.foliage.map;m.foliage.map=t;m.foliage.needsUpdate=true;
    // The atlas replaces only this fallback; release its GPU allocation now.
    if(textures.delete(fallback))fallback.dispose();
  },undefined,()=>{});
  return {materials:m,textures,dispose(){if(disposed)return;disposed=true;for(const material of materials)material.dispose();for(const t of textures)t.dispose();}};
}
