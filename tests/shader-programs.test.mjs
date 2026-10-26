import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {finishEnvironmentMaterial} from '../src/showcase/environment-surface-shaders.js';
import {plainShadowDepth} from '../src/showcase/shadow-depth.js';
import {createCombatEffects} from '../src/showcase/combat-effects.js';
import {createParticleMask,createImpactCloud,createWeatherField,createFlamePlume,sampleImpactParticles,sampleWeatherParticles,sampleFlamePlume} from '../src/showcase/stage-particles.js';
import {drawableShape} from '../src/showcase/scene-compositor.js';
import {createActor} from '../src/showcase/actors.js';

// What three compiles for a material: its key and the shader its hooks produce.
function compiled(material){
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader);return {key:material.customProgramCacheKey(),shader};
}

test('stone, wood, cloth and the other standing surfaces share one program; their grain and roughness are uniforms', () => {
  const standing=[['stone',{}],['stone',{wet:true}],['wood',{arid:true}],['wood',{rain:true}],['cloth',{}],['leather',{marsh:true}]].map(([kind,flags])=>{
    const material=new T.MeshStandardMaterial();finishEnvironmentMaterial(material,kind,flags);return {kind,flags,material,...compiled(material)};
  });
  for(const s of standing){
    assert.equal(s.key,standing[0].key,`${s.kind} ${JSON.stringify(s.flags)} has the shared key`);
    assert.equal(s.shader.vertexShader,standing[0].shader.vertexShader);assert.equal(s.shader.fragmentShader,standing[0].shader.fragmentShader,'and the same source');
    assert.equal(s.material.userData.environmentFinish,s.kind,'The surface keeps its kind');
  }
  const uniforms=({shader})=>[shader.uniforms.environmentGrain.value,shader.uniforms.environmentRoughness.value];
  assert.deepEqual(uniforms(standing[0]),[[2.7,3.4],[.91,1]],'Stone: square grain, matt');
  assert.deepEqual(uniforms(standing[1]),[[2.7,3.4],[.58,.92]],'Wet stone is glossier');
  assert.deepEqual(uniforms(standing[2]),[[7,.8],[.91,1]],'Wood grain runs along the timber');
  assert.deepEqual(uniforms(standing[3]),[[7,.8],[.91,1]]);
  // Water, ground, foliage and floor keep a finish of their own.
  const own=['water','ground','foliage','floor'].map(kind=>{const material=new T.MeshStandardMaterial();finishEnvironmentMaterial(material,kind);return compiled(material).key;});
  assert.equal(new Set([...own,standing[0].key]).size,5);
});

test('a caster’s colour map reaches the shadow pass only where an alpha test cuts its outline', () => {
  const map=new T.Texture(),alphaMap=new T.Texture();
  const plain=new T.MeshDepthMaterial({map,alphaMap});plainShadowDepth(plain);
  assert.equal(plain.map,null);assert.equal(plain.alphaMap,null);
  const cut=new T.MeshDepthMaterial({map,alphaMap,alphaTest:.4});plainShadowDepth(cut);
  assert.equal(cut.map,map,'Leaves and hair keep their cut-out shadows');assert.equal(cut.alphaMap,alphaMap);
  // Every caster does this by default, between three choosing the depth material and drawing it.
  const depth=new T.MeshDepthMaterial({map});new T.Mesh().onBeforeShadow(null,null,null,null,null,depth,null);assert.equal(depth.map,null);
  plainShadowDepth(null);
});

test('flat and additive overlays draw in one pass, not back faces and front faces with a program each', () => {
  const scene=new T.Scene(),effects=createCombatEffects(scene,{particleMask:createParticleMask(),quality:'balanced'});
  const actor=createActor({id:'hero',name:'Aurelius Marcellus',side:'player',role:'infantry'},{chapter:1,quality:'balanced'});scene.add(actor.group);
  let twoSided=0;
  scene.traverse(o=>{for(const m of [o.material].flat())if(m?.transparent&&m.side===T.DoubleSide&&m.isMeshBasicMaterial){twoSided++;assert.equal(m.forceSinglePass,true,m.name||o.name);}});
  assert.ok(twoSided>=2,'The blade trail and the figure’s selection ring are checked');
  effects.dispose?.();actor.dispose();
});

function particleProgram(cloud){
  const m=cloud.material,shader={uniforms:{},vertexShader:T.ShaderLib.points.vertexShader,fragmentShader:T.ShaderLib.points.fragmentShader};
  m.onBeforeCompile(shader);
  // These are the material/geometry differences Three uses for the points
  // program. Blend equations, colours, sizes and alpha cutoffs stay uniforms
  // or draw state, so their original effect-specific values need not agree.
  const flags={shape:drawableShape(cloud),map:!!m.map,mapChannel:m.map?.channel,alphaMap:!!m.alphaMap,alphaTest:m.alphaTest>0,
    vertexColors:m.vertexColors,vertexAlphas:cloud.geometry.attributes.color?.itemSize===4,sizeAttenuation:m.sizeAttenuation,
    fog:m.fog,transparent:m.transparent,side:m.side,premultipliedAlpha:m.premultipliedAlpha,dithering:m.dithering,toneMapped:m.toneMapped};
  return {key:m.customProgramCacheKey(),flags,shader};
}

test('weather, fire, impacts and thrown dust share shader source and program flags without sharing effect state',()=>{
  const mask=createParticleMask(),scene=new T.Scene(),effects=createCombatEffects(scene,{particleMask:mask});
  const impacts=Array.from({length:8},()=>createImpactCloud(mask)),weather=createWeatherField(mask),flame=createFlamePlume(mask),unmappedFlame=createFlamePlume();
  const dust=scene.getObjectByName('thrown dust'),clouds=[...impacts,weather,flame,unmappedFlame,dust],reference=particleProgram(impacts[0]);
  for(const cloud of clouds){
    const actual=particleProgram(cloud);assert.equal(actual.key,reference.key);assert.deepEqual(actual.flags,reference.flags);
    assert.equal(actual.shader.vertexShader,reference.shader.vertexShader,'A shared cache key must compile identical vertex source');
    assert.equal(actual.shader.fragmentShader,reference.shader.fragmentShader,'A shared cache key must compile identical fragment source');
    assert.equal(cloud.geometry.attributes.color.count,cloud.geometry.attributes.position.count);
    if(cloud!==impacts[0])assert.notEqual(actual.shader.uniforms.particleMode,reference.shader.uniforms.particleMode,'Each draw owns its uniform state');
  }
  sampleWeatherParticles(weather,'rain',13,{anchor:{x:40,y:2,z:-20},chapter:3});
  assert.deepEqual(weather.material.userData.particleUniforms.weatherAnchor.value.toArray(),[40,2,-20]);
  for(const cloud of [...impacts,flame,unmappedFlame,dust])assert.equal(cloud.material.userData.particleUniforms.weatherTime.value,0);
  assert.equal(weather.material.userData.particleUniforms.particleMode.value,1);
  assert.equal(flame.material.userData.particleUniforms.particleMode.value,2);
  assert.equal(dust.material.userData.particleUniforms.particleMode.value,0);
  assert.equal(impacts[0].material.blending,T.AdditiveBlending);assert.equal(flame.material.blending,T.NormalBlending);
  assert.equal(weather.material.alphaTest,.04);assert.equal(flame.material.alphaTest,.015);assert.equal(dust.material.alphaTest,.01);
  for(const cloud of [...impacts,weather,flame,unmappedFlame]){cloud.geometry.dispose();cloud.material.dispose();}effects.dispose();mask.dispose();
});

test('neutral particle attributes preserve impact strength and dust opacity while plumes keep their own size and alpha',()=>{
  const impact=createImpactCloud(),weather=createWeatherField(),flame=createFlamePlume(),scene=new T.Scene(),effects=createCombatEffects(scene);
  const dust=scene.getObjectByName('thrown dust'),dustColors=dust.geometry.attributes.color.array;
  for(const cloud of [impact,weather,dust])for(const key of ['plumeAlpha','plumeScale'])assert.ok(cloud.geometry.attributes[key].array.every(v=>v===1));
  for(const cloud of [impact,weather])assert.ok(cloud.geometry.attributes.color.array.every(v=>v===1),'White RGBA changes neither tint nor opacity');
  sampleImpactParticles(impact,{x:2,y:1,z:3},.5,{shield:true,source:{x:1,z:3}});
  assert.equal(impact.material.opacity,.205);assert.equal(impact.material.size,.055);assert.ok(impact.geometry.attributes.position.array.every(Number.isFinite));
  sampleImpactParticles(impact,{x:2,y:1,z:3},1);assert.equal(impact.material.opacity,0);
  effects.dust(2,0,3,{amount:2,seed:'particle-regression'});effects.update(.18);
  assert.equal(dust.geometry.attributes.color.array,dustColors,'The established dynamic dust RGBA buffer is retained');
  assert.ok(Math.abs(dustColors[3]-.496)<1e-6);assert.ok(Math.abs(dustColors[0]-.8)<1e-6);assert.equal(dust.visible,true);
  effects.update(1);assert.equal(dust.visible,false);assert.ok(Array.from({length:dustColors.length/4},(_,i)=>dustColors[i*4+3]).every(v=>v===0));
  sampleFlamePlume(flame,3);const {color,plumeScale,plumeAlpha}=flame.geometry.attributes;
  for(let i=0;i<color.count;i++)assert.equal(color.getW(i),1,'Fire opacity stays in its own plume attribute, without a second alpha fade');
  assert.ok(plumeScale.getX(24)>2);assert.ok(plumeAlpha.array.some(v=>v>0&&v<1));
  for(const cloud of [impact,weather,flame]){cloud.geometry.dispose();cloud.material.dispose();}effects.dispose();
});

test('normalizing an unmapped particle owns only its white fallback and never disposes a borrowed mask',()=>{
  const mask=createParticleMask(),mapped=createFlamePlume(mask),unmapped=createFlamePlume(),weather=createWeatherField();
  let borrowedDisposals=0,flameDisposals=0,weatherDisposals=0;
  mask.addEventListener('dispose',()=>borrowedDisposals++);
  unmapped.material.map.addEventListener('dispose',()=>flameDisposals++);weather.material.map.addEventListener('dispose',()=>weatherDisposals++);
  assert.equal(mapped.material.map,mask);assert.deepEqual([...unmapped.material.map.image.data],[255,255,255,255]);
  assert.notEqual(unmapped.material.map,weather.material.map);
  mapped.material.dispose();unmapped.material.dispose();unmapped.material.dispose();weather.material.dispose();weather.material.dispose();
  assert.equal(borrowedDisposals,0);assert.equal(flameDisposals,1);assert.equal(weatherDisposals,1);
  for(const cloud of [mapped,unmapped,weather])cloud.geometry.dispose();mask.dispose();assert.equal(borrowedDisposals,1);
});
