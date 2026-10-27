import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {sampleHumanGait,sampleHorseGait,applyGaitTurn} from '../src/showcase/actor-gait.js';
import {actorPose,horsePose,blendHorsePose,createFootPlanting,ACTOR_TIMING} from '../src/showcase/actor-pose.js';
import {samplePerformance} from '../src/showcase/actor-performance.js';
import {sculptGeneratedHead,generatedIdentityMaterial} from '../src/showcase/generated-identity.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {createActor} from '../src/showcase/actors.js';

test('injured gait shortens wounded support and extends sound support without changing planted travel',()=>{
  const support=injury=>{const count=[0,0];for(let i=0;i<1000;i++)sampleHumanGait({cycle:i/1000,injury}).feet.forEach((f,j)=>{if(f.y===.07)count[j]++;});return count;};
  const healthy=support(0),hurt=support(1);assert.ok(hurt[0]<healthy[0]-85);assert.ok(hurt[1]>healthy[1]+85);
  for(const injury of [0,.5,1])for(const retreat of [false,true])for(let foot=0;foot<2;foot++){
    const a=sampleHumanGait({cycle:.04,injury,retreat}),b=sampleHumanGait({cycle:.045,injury,retreat});
    assert.equal(a.feet[foot].y,.07);assert.equal(b.feet[foot].y,.07);
    assert.ok(Math.abs(b.feet[foot].z-a.feet[foot].z+.005*1.15*(retreat?-1:1))<1e-10,'A longer stance must not stretch a planted trajectory');
  }
  for(let i=0;i<=100;i++)assert.ok(sampleHumanGait({cycle:i/100,injury:1}).feet.every(f=>f.y>=.07));
  const good=actorPose({motion:'walk',phase:.22}),limp=actorPose({motion:'walk',phase:.22,health:.15});
  assert.notEqual(good.legs[0].knee,limp.legs[0].knee);assert.notEqual(good.hipX,limp.hipX);
});

test('authored starts, stops and pivots include sole steps and recover exactly; impact clocks stay fixed',()=>{
  const base=actorPose();
  for(const motion of ['start','stop','turn']){
    const middle=actorPose({motion,phase:.5});assert.ok(middle.feet.some(f=>f.y>.08),motion);
    assert.notDeepEqual(middle.legs,base.legs);assert.deepEqual(actorPose({motion,phase:0}),base);assert.deepEqual(actorPose({motion,phase:1}),base);
  }
  const right=actorPose({motion:'turn',phase:.5,turnSign:1}),left=actorPose({motion:'turn',phase:.5,turnSign:-1});
  assert.equal(right.feet[1].y,left.feet[0].y);assert.equal(right.feet[0].y,left.feet[1].y);assert.equal(right.hipX,-left.hipX);
  assert.ok(samplePerformance('recover',.58).leftFootY>.02);assert.ok(samplePerformance('recoil',.35).rightFootY>.03);
  assert.ok(Object.values(samplePerformance('strike',ACTOR_TIMING.contact)).every(v=>v===0));
  for(const motion of ['attack','throw','block'])assert.deepEqual(actorPose({motion,phase:ACTOR_TIMING.contact,health:.15}),actorPose({motion,phase:ACTOR_TIMING.contact}));
});

test('small turns move the free foot and pelvis while preserving the supporting sole target',()=>{
  const pose=actorPose({motion:'walk',phase:.22}),before=structuredClone(pose);applyGaitTurn(pose,3);
  assert.notEqual(pose.hipX,before.hipX);
  for(let i=0;i<2;i++)if(before.feet[i].y===.07)assert.deepEqual(pose.feet[i],before.feet[i]);else assert.notEqual(pose.feet[i].x,before.feet[i].x);
});

test('planting survives a stop and phase wrap, while reset and teleport discard old contacts',()=>{
  const planting=createFootPlanting(),groundHeight=()=>0,pose=actorPose({motion:'walk',phase:.1}),position={x:0,y:0,z:0};
  const first=planting.sample({pose,position,motion:'walk',phase:.1,groundHeight});
  const stopped=planting.sample({pose:actorPose(),position:{...position,z:.01},motion:'idle',groundHeight});
  assert.ok(Math.abs(stopped[0].z+.01-first[0].z)<1e-12);
  const reset=planting.sample({pose:actorPose(),position:{...position,z:10},motion:'idle',groundHeight});
  assert.ok(Math.abs(reset[0].z-.05)<1e-12);
  planting.reset();const before=planting.sample({pose:actorPose({motion:'walk',phase:.99}),position,motion:'walk',phase:.99,groundHeight});
  const after=planting.sample({pose:actorPose({motion:'walk',phase:1.01}),position:{...position,z:.0144},motion:'walk',phase:.01,groundHeight});
  assert.ok(Math.abs(after[1].z+.0144-before[1].z)<1e-12,'The planted opposite foot survives the wrapped cycle');
});

test('horse walk, trot and canter have distinct contact patterns, planted speed and coordinated rider channels',()=>{
  const signatures=[];
  for(const gait of ['walk','trot','canter']){
    const pattern=[];
    for(let i=0;i<100;i++){const p=sampleHorseGait({gait,cycle:i/100});assert.ok(p.feet.every(f=>f.y>=.075));pattern.push(p.feet.map(f=>f.y===.075?1:0).join(''));}
    signatures.push(pattern.join(','));
    const a=sampleHorseGait({gait,cycle:.1}),b=sampleHorseGait({gait,cycle:.1001});
    for(let i=0;i<4;i++)if(a.feet[i].y===.075&&b.feet[i].y===.075)assert.ok(Math.abs(b.feet[i].z-a.feet[i].z+.0001*1.8)<1e-10);
    const p=horsePose({motion:'run',gait,locomotionDistance:.6});assert.equal(p.riderBob,p.bodyY-1.04);assert.notEqual(p.riderPitch,0);assert.ok(p.legs.every(l=>Object.values(l).every(Number.isFinite)));
    assert.deepEqual(sampleHorseGait({gait,cycle:0}),sampleHorseGait({gait,cycle:1}));
  }
  assert.equal(new Set(signatures).size,3);
  const trot=sampleHorseGait({gait:'trot',cycle:.21});assert.equal(trot.feet[0].y,trot.feet[3].y);assert.equal(trot.feet[1].y,trot.feet[2].y);
  const from=horsePose(),to=horsePose({motion:'run',locomotionDistance:.8}),before=structuredClone(from),blended=blendHorsePose(from,to,.5);
  assert.deepEqual(from,before);assert.notDeepEqual(blended.feet,to.feet);assert.equal(blended.feet[0].y,(from.feet[0].y+to.feet[0].y)*.5);
});

test('cast hair silhouettes alter the existing scalp without adding topology, disturbing neck seams or shader variants',()=>{
  const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute([-.018,1.5,.02,-.07,1.71,.04,-.018,1.76,.035,.04,1.74,-.04,-.06,1.66,-.06],3));
  source.setAttribute('normal',new T.Float32BufferAttribute(Array.from({length:15},(_,i)=>i%3===1?1:0),3));source.setAttribute('uv',new T.Float32BufferAttribute([0,0,0,1,.5,1,1,1,1,0],2));
  const shapes=[],materials=[],shaderSources=[];
  for(const name of ['Varro','Lucan','Crispus','Severianus','Brennus']){
    const identity=actorIdentity({name},{chapter:5}),geometry=sculptGeneratedHead(source.clone(),identity);shapes.push(Array.from(geometry.attributes.position.array));
    assert.deepEqual(Array.from(geometry.attributes.uv.array),Array.from(source.attributes.uv.array));assert.equal(geometry.attributes.position.count,source.attributes.position.count);
    assert.deepEqual(Array.from(geometry.attributes.position.array.slice(0,3)),Array.from(source.attributes.position.array.slice(0,3)));
    const material=generatedIdentityMaterial(new T.MeshStandardMaterial(),identity),shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>',uniforms:{}};material.onBeforeCompile(shader);shaderSources.push(shader.vertexShader+shader.fragmentShader);materials.push(material);geometry.dispose();
  }
  assert.equal(new Set(shapes.map(s=>s.join(','))).size,5);assert.equal(new Set(shaderSources).size,1);assert.equal(new Set(materials.map(m=>m.customProgramCacheKey())).size,1);
  materials.forEach(m=>m.dispose());source.dispose();
});

test('the shared motion sampler runs through every chapter with read-only units and bounded rider transitions',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const unit=Object.freeze({id:'hero',name:'Marcellus',side:'player',role:chapter===5?'cavalry':'infantry'}),a=createActor(unit,{chapter});
    let previous=null;
    for(let i=0;i<30;i++){
      a.update({motion:i<5||i>=20?'idle':'run',time:i/60,dt:1/60,locomotionDistance:Math.max(0,Math.min(15,i-5))*.03,health:.25,groundHeight:()=>0,resetPose:i===0});
      const hips=a.group.getObjectByName('hips');assert.ok(hips.position.toArray().every(Number.isFinite));
      if(previous)assert.ok(hips.position.distanceTo(previous)<.13,`Chapter ${chapter} has no start/stop pelvis snap`);previous=hips.position.clone();
    }
    a.dispose();
  }
});
