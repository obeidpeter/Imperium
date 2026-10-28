import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createMistBanks,mistBankRegions,mistBankStrength} from '../src/showcase/water-mist.js';
import {createParticleMask,createWeatherField} from '../src/showcase/stage-particles.js';
import {createEnvironmentMaterials} from '../src/showcase/environment-materials.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {distantRiverCentre} from '../src/showcase/environment-layout.js';

// Water (worlds and gameplay plan, release 5): mist banks in the weather's own program,
// and the distant river's foam held to its banks. Presentation only.
const KEY={'.':'grass','~':'river','f':'ford','m':'marsh'};
const field=(id,rows)=>({id,kind:'battle',width:rows[0].length,height:rows.length,terrain:rows.map(r=>[...r].map(c=>KEY[c]))});
const E=field('ch2-marsh',['...~....','...~.mm.','...f.mm.','...~....']);

test('mist banks lie over water at dawn, at night and in mist or rain, never indoors', () => {
  assert.equal(mistBankStrength({weather:'clear',timeOfDay:'day'}),0);
  assert.equal(mistBankStrength({civic:true,weather:'mist'}),0);
  for(const p of [{timeOfDay:'dawn'},{timeOfDay:'night'},{weather:'mist'},{weather:'rain'}])assert.ok(mistBankStrength(p)>0,JSON.stringify(p));
  const regions=mistBankRegions(E);assert.equal(regions.length,2,'the river and its ford, and the marsh');
  assert.ok(regions[0].minX<regions[0].maxX&&regions[1].level>regions[0].level);
  const withRiver=mistBankRegions(E,{distantWater:true});assert.equal(withRiver.at(-1).minZ+6,distantRiverCentre(E));
});

test('each bank is the weather\'s own mist, so no shader program is added; none on Performance', () => {
  const mask=createParticleMask(),group=new T.Group(),profile={...getSceneProfile(E,{chapter:2}),weather:'mist'};
  assert.equal(createMistBanks(group,{e:E,profile,mask,quality:'performance'}),null);
  const banks=createMistBanks(group,{e:E,profile,mask,quality:'balanced'}),weather=createWeatherField(mask);
  assert.equal(banks.banks,mistBankRegions(E,{distantWater:profile.distantWater}).length);
  for(const cloud of group.children)assert.equal(cloud.material.customProgramCacheKey(),weather.material.customProgramCacheKey());
  banks.update(12);banks.dispose();assert.equal(group.children.length,0);mask.dispose();
});

test('the distant river\'s foam gathers on its banks: the world sets them, open water elsewhere has none', () => {
  const library=createEnvironmentMaterials({loadTextures:false});assert.deepEqual(library.waterBank.value.toArray(),[0,0],'off until a river sets it');library.dispose();
  const e=field('ch1-road',['........','........']),world=createEnvironment(new T.Scene(),e,{chapter:1,quality:'balanced',loadTextures:false});
  const river=world.group.getObjectByName('Danube'),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  river.material.onBeforeCompile(shader);
  assert.deepEqual(shader.uniforms.environmentWaterBank.value.toArray(),[distantRiverCentre(e),8]);
  world.dispose();
});
