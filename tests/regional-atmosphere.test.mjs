import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {sampleWorldWind,regionalTreePlacements,regionalTreeSpecies,waterCurrentDirection} from '../src/showcase/world-weather.js';
import {createParticleMask,createWeatherField,sampleWeatherParticles,createFlamePlume,sampleFlamePlume} from '../src/showcase/stage-particles.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {sampleWaterSurface} from '../src/showcase/environment-surface-shaders.js';
import {createEnvironmentMaterials} from '../src/showcase/environment-materials.js';

test('All twelve regional tree plans are stable, distinct and outside movement, roads, buildings and water',()=>{
  const encounter=Object.freeze({id:'regional-plan',width:15,height:12}),before=JSON.stringify(encounter),sets=new Set();
  const original=Math.random;Math.random=()=>{throw Error('Presentation must not consume randomness');};
  try{for(let chapter=1;chapter<=12;chapter++){
    const options={encounter,chapter,route:(x,z)=>z>21?1:0,height:(x,z)=>x>25?-1:0,occupied:[{min:[-28,0,-8],max:[-17,8,8]}]};
    const trees=regionalTreePlacements(options);assert.deepEqual(trees,regionalTreePlacements(options));assert.ok(trees.length>=4&&trees.length<=11);
    for(const tree of trees){
      assert.ok(regionalTreeSpecies(chapter).includes(tree.kind));assert.ok(Math.abs(tree.x)>18.75||Math.abs(tree.z)>15);
      assert.equal(options.route(tree.x,tree.z),0);assert.ok(options.height(tree.x,tree.z)>=-.45);
      assert.ok(!(tree.x>-31&&tree.x<-14&&tree.z>-11&&tree.z<11));
    }
    sets.add(trees.map(t=>t.kind).join(','));
    assert.ok(regionalTreePlacements({...options,quality:'performance'}).length<=trees.length);
  }}finally{Math.random=original;}
  assert.ok(sets.size>=8);assert.equal(JSON.stringify(encounter),before);assert.deepEqual(regionalTreePlacements({encounter,civic:true}),[]);
});

test('Shared wind is finite, regional, bounded and still when reduced motion is selected',()=>{
  for(let chapter=1;chapter<=12;chapter++)for(const weather of ['rain','dust','mist','clear']){
    const wind=sampleWorldWind(23,{chapter,weather});assert.ok(Object.values(wind).every(Number.isFinite));assert.ok(Math.hypot(wind.x,wind.z)<=1.2);
    assert.deepEqual(sampleWorldWind(10,{chapter,weather,reducedMotion:true}),sampleWorldWind(100,{chapter,weather,reducedMotion:true}));
  }
  assert.notDeepEqual(sampleWorldWind(2,{chapter:1}),sampleWorldWind(2,{chapter:9}));
});

test('Camera-local weather updates uniforms without uploading geometry; quality, indoor and motion limits hold',()=>{
  let previous=0;
  for(const quality of ['performance','balanced','high']){
    const cloud=createWeatherField(null,{quality}),position=cloud.geometry.attributes.position,version=position.version,original=position.array.slice();
    assert.ok(position.count>previous&&position.count<=640);previous=position.count;
    for(const weather of ['rain','dust','mist','embers']){
      sampleWeatherParticles(cloud,weather,13,{anchor:{x:90,y:1.6,z:-75},chapter:5});
      const u=cloud.material.userData.weatherUniforms;
      assert.deepEqual(u.weatherAnchor.value.toArray(),[90,1.6,-75]);assert.equal(u.weatherTime.value,13);assert.equal(cloud.visible,true);
      sampleWeatherParticles(cloud,weather,99,{reducedMotion:true});assert.equal(u.weatherTime.value,0);
      assert.deepEqual(position.array,original);assert.equal(position.version,version);
    }
    const shader={uniforms:{},vertexShader:T.ShaderLib.points.vertexShader,fragmentShader:T.ShaderLib.points.fragmentShader};cloud.material.onBeforeCompile(shader);
    assert.match(shader.vertexShader,/transformed.xz=mod/);assert.match(shader.fragmentShader,/float streak=/);
    assert.equal(shader.uniforms.weatherTime,cloud.material.userData.weatherUniforms.weatherTime);
    sampleWeatherParticles(cloud,'rain',4,{indoors:true});assert.equal(cloud.visible,false);
    sampleWeatherParticles(cloud,'clear',4);assert.equal(cloud.visible,false);
    cloud.geometry.dispose();cloud.material.dispose();
  }
});

test('One flame draw contains warm fire, cooler expanding smoke and a stable reduced-motion pose',()=>{
  const cloud=createFlamePlume(),{position,color,plumeAlpha,plumeScale}=cloud.geometry.attributes;
  sampleFlamePlume(cloud,3,{chapter:5,weather:'dust'});
  assert.ok(position.count<=48);assert.ok(position.array.every(Number.isFinite));
  for(let i=0;i<24;i++)assert.ok(color.getX(i)>color.getY(i));
  for(let i=24;i<position.count;i++){
    assert.ok(Math.abs(color.getX(i)-color.getY(i))<.001);assert.ok(position.getY(i)>.65);assert.ok(plumeScale.getX(i)>2);
  }
  assert.ok(plumeAlpha.array.every(x=>x>=0&&x<=1));
  sampleFlamePlume(cloud,8,{reducedMotion:true});const stable=position.array.slice();sampleFlamePlume(cloud,90,{reducedMotion:true});assert.deepEqual(position.array,stable);
  const shader={uniforms:{},vertexShader:T.ShaderLib.points.vertexShader,fragmentShader:T.ShaderLib.points.fragmentShader};cloud.material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/gl_PointSize = size \* plumeScale/);assert.match(shader.fragmentShader,/vPlumeAlpha\*plumeEdge/);
  cloud.geometry.dispose();cloud.material.dispose();
});

test('Mist and dust retain their faint soft edges without changing the shared alpha-test program',()=>{
  const mask=createParticleMask(),cloud=createWeatherField(mask),material=cloud.material,version=material.version,key=material.customProgramCacheKey();
  // A texel in the falloff, roughly 60% of the way from centre to edge. The
  // old .04 cutoff removed it in both ordinary and reduced-motion weather.
  const x=25,y=16,r=Math.hypot((x+.5)/32-.5,(y+.5)/32-.5),t=Math.max(0,Math.min(1,(r-.08)/(.5-.08)));
  const softness=1-t*t*(3-2*t),texelAlpha=mask.image.data[(y*32+x)*4+3]/255;
  for(const weather of ['mist','rain','dust','embers','mist'])for(const reducedMotion of [false,true]){
    sampleWeatherParticles(cloud,weather,3,{reducedMotion});
    assert.equal(material.version,version,'Changing a positive cutoff must not compile a new material variant');
    assert.equal(material.customProgramCacheKey(),key);assert.ok(material.alphaTest>0);
    if(weather==='mist'||weather==='dust'){
      const edgeAlpha=material.opacity*texelAlpha*softness*softness;
      assert.ok(edgeAlpha>.001&&edgeAlpha<.04,'The regression texel is soft but was discarded by the old threshold');
      assert.ok(edgeAlpha>material.alphaTest,'Its faint outer falloff now survives');
      assert.equal(material.size,weather==='mist'?2.9:1.45);assert.equal(material.opacity,(weather==='mist'?.085:.12)*(reducedMotion?.55:1));
    }else assert.equal(material.alphaTest,.04,'Rain and embers keep their existing cutoff');
  }
  cloud.geometry.dispose();material.dispose();mask.dispose();
});

test('Current cues follow the authored channel and all water materials share its direction without another draw',()=>{
  const horizontal={width:4,height:3,terrain:[['grass','grass','grass','grass'],['river','ford','river','river'],['grass','grass','grass','grass']]};
  assert.deepEqual(waterCurrentDirection(horizontal),{x:1,z:0});
  const vertical={width:3,height:4,terrain:Array.from({length:4},()=>['grass','river','grass'])},flow=waterCurrentDirection(vertical);
  assert.ok(Math.abs(flow.x)<.00001&&Math.abs(flow.z-1)<.00001);
  assert.deepEqual(sampleWaterSurface(2,3,4,{current:{x:0,z:1}}),sampleWaterSurface(3,-2,4,{current:{x:1,z:0}}));
  const library=createEnvironmentMaterials({loadTextures:false});library.waterCurrent.value.set(flow.x,flow.z);
  for(const key of ['water','marshWater','riverWater']){
    const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};library.materials[key].onBeforeCompile(shader);
    assert.equal(shader.uniforms.environmentWaterCurrent,library.waterCurrent);assert.match(shader.fragmentShader,/envFlowUv/);
  }
  library.dispose();
});

test('Accession has a Roman court composition while retaining military figures, and the oath remains a frontier parade',()=>{
  const accession=getSceneProfile({id:'ceremony-accession',kind:'battle'},{chapter:12}),oath=getSceneProfile({id:'ceremony-oath',kind:'battle'},{chapter:1});
  assert.equal(accession.civic,false);assert.equal(accession.architecture,'imperial-court');assert.equal(accession.distantWater,false);assert.equal(accession.vegetation,'court');
  assert.equal(oath.civic,false);assert.equal(oath.architecture,'fort');assert.notDeepEqual(accession.staging,oath.staging);
});
