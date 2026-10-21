import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {finishEnvironmentMaterial} from '../src/showcase/environment-surface-shaders.js';
import {plainShadowDepth} from '../src/showcase/shadow-depth.js';
import {createCombatEffects} from '../src/showcase/combat-effects.js';
import {createParticleMask} from '../src/showcase/stage-particles.js';
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
