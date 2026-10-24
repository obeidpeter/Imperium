import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {getSceneProfile,SUN_POSITIONS} from '../src/showcase/campaign-scene-profile.js';
import {createSky} from '../src/showcase/sky.js';
import {groundMistStrength,groundMistChunks,installGroundMist} from '../src/showcase/atmosphere.js';

const elevation=([x,y,z])=>Math.atan2(y,Math.hypot(x,z))*180/Math.PI;
const warmth=hex=>{const c=new T.Color(hex);return c.r/Math.max(c.b,1e-3);};

test('the sun stands low in the east at dawn and in the west at dusk, warmer and weaker; high by day',()=>{
  const day=getSceneProfile({},{chapter:1});
  assert.ok(elevation(day.sunPosition)>45);assert.deepEqual(day.sunPosition,SUN_POSITIONS.day);
  for(const chapter of [5,6,12]){const p=getSceneProfile({},{chapter});assert.equal(p.timeOfDay,'dusk');
    assert.ok(elevation(p.sunPosition)<20&&p.sunPosition[0]<0,`Chapter ${chapter}: a low western sun`);
    assert.ok(p.sunIntensity<day.sunIntensity);assert.ok(warmth(p.sun)>warmth(getSceneProfile({kind:'contest'},{chapter}).sun),'warmer than the same chapter indoors');}
  const dawn=getSceneProfile({},{chapter:8});assert.equal(dawn.timeOfDay,'dawn');assert.ok(elevation(dawn.sunPosition)<20&&dawn.sunPosition[0]>0,'a low eastern sun');
  const overcast=getSceneProfile({},{chapter:2});assert.ok(elevation(overcast.sunPosition)>20&&elevation(overcast.sunPosition)<30&&overcast.sunPosition[0]>0,'Chapter II\'s grey dawn: higher, from the east');
  assert.deepEqual(getSceneProfile({},{chapter:5,timeOfDay:'night'}).sunPosition,SUN_POSITIONS.night);
  assert.deepEqual(getSceneProfile({kind:'contest'},{chapter:11}).sunPosition,SUN_POSITIONS.court);
});

test('the sky lights its clouds by the sun and shows the moon and stars only at night',()=>{
  const night=createSky(new T.Scene(),getSceneProfile({},{chapter:5,timeOfDay:'night'})),day=createSky(new T.Scene(),getSceneProfile({},{chapter:5}));
  const uniforms=sky=>sky.group.children[0].material.uniforms;
  assert.equal(uniforms(night).nightSky.value,1);assert.equal(uniforms(day).nightSky.value,0);
  const source=day.group.children[0].material.fragmentShader;
  for(const term of ['cloudField(p+sunBearing','float moon=','starSeed'])assert.ok(source.includes(term),term);
  assert.equal(day.stats().textures,0,'still no textures: stars and clouds are procedural');night.dispose();day.dispose();
});

test('ground mist: by weather and time, none indoors, written into the fog chunks and taken out again',()=>{
  assert.equal(groundMistStrength(getSceneProfile({kind:'contest'},{chapter:11})),0);
  assert.ok(groundMistStrength(getSceneProfile({},{chapter:1}))>groundMistStrength(getSceneProfile({},{chapter:7})),'the misty Danube more than clear Italy');
  for(let chapter=1;chapter<=12;chapter++){const s=groundMistStrength(getSceneProfile({},{chapter}));assert.ok(s>0&&s<=.5,`Chapter ${chapter}`);}
  const base=groundMistChunks(0),misty=groundMistChunks(.4);
  for(const key of ['fog_pars_vertex','fog_vertex','fog_pars_fragment','fog_fragment']){assert.notEqual(misty[key],base[key],key);assert.ok(misty[key].includes('vFogHeight'),key);}
  assert.ok(misty.fog_fragment.includes('0.400'));assert.ok(misty.fog_fragment.includes('fogFactor = smoothstep( fogNear, fogFar, vFogDepth );'),'the distance fog is kept');
  const original=T.ShaderChunk.fog_fragment;
  try{
    assert.equal(installGroundMist(getSceneProfile({},{chapter:1})),.42);assert.ok(T.ShaderChunk.fog_fragment.includes('groundMist'));
    assert.equal(installGroundMist(getSceneProfile({kind:'contest'},{chapter:11})),0);assert.equal(T.ShaderChunk.fog_fragment,base.fog_fragment,'an interior restores three\'s own fog');
  }finally{T.ShaderChunk.fog_fragment=original;Object.assign(T.ShaderChunk,groundMistChunks(0));}
});
