import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {createActorAssetLibrary,createActorAssetCatalog,ACTOR_MODEL_URL,FEMALE_ACTOR_MODEL_URL} from '../src/showcase/actor-assets.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {actorKit} from '../src/showcase/actor-kit.js';
import {createActor} from '../src/showcase/actors.js';
import * as T from '../vendor/three/three.module.js';

const male=actorIdentity({id:'hero'},actorKit({id:'hero'})),female=actorIdentity({id:'aelia',name:'Aelia',role:'voter'},actorKit({id:'aelia',name:'Aelia',role:'voter'}));
const bytes=await Promise.all([ACTOR_MODEL_URL,FEMALE_ACTOR_MODEL_URL].map(url=>readFile(new URL('../'+url,import.meta.url))));
const parse=sex=>{const b=bytes[sex==='female'?1:0];return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const release=model=>{for(const key of ['geometry','hair','beard'])model?.[key]?.dispose();};

test('Male/default requests never load female anatomy; matching concurrent requests share one immutable master',async()=>{
  const calls={male:0,female:0},catalog=createActorAssetCatalog({maleLoad:()=>{calls.male++;return parse('male');},femaleLoad:()=>{calls.female++;return parse('female');}});
  assert.deepEqual(calls,{male:0,female:0});assert.equal(catalog.anatomy(female),null);
  const first=catalog.warm(),same=catalog.warm(male);assert.equal(first,same);assert.equal(await first,true);assert.deepEqual(calls,{male:1,female:0});assert.equal(catalog.status().ready,true);assert.equal(catalog.status(female).ready,false);assert.equal(catalog.anatomy(female),null,'A warm male master must never silently replace missing female anatomy');
  const a=catalog.warm(female),b=catalog.warm(female);assert.equal(a,b);assert.equal(await a,true);assert.deepEqual(calls,{male:1,female:1});assert.equal(catalog.status(female).ready,true);
});

test('Female failure is reported independently and leaves the existing single-loader contract intact',async()=>{
  let femaleCalls=0;const catalog=createActorAssetCatalog({maleLoad:()=>parse('male'),femaleLoad:async()=>{femaleCalls++;throw Error('female asset offline');}});
  assert.equal(await catalog.warm(female),false);assert.equal(await catalog.warm(female),false);assert.equal(femaleCalls,1);assert.match(catalog.status(female).error,/female asset offline/);assert.equal(catalog.anatomy(female),null);assert.equal(await catalog.warm(),true);assert.equal(catalog.status().error,null);
  let customCalls=0;const custom=createActorAssetLibrary(()=>{customCalls++;return parse('female');});assert.equal(await custom.warm(female),true);assert.equal(await custom.warm(),true);assert.equal(customCalls,1);const model=custom.anatomy(female);assert.equal(model.geometry.attributes.position.count,5393);release(model);
});

test('Female adapted clones preserve the female mesh, valid weights and independent ownership after another clone is disposed',async()=>{
  const catalog=createActorAssetCatalog({maleLoad:()=>parse('male'),femaleLoad:()=>parse('female')});await Promise.all([catalog.warm(),catalog.warm(female)]);
  const a=catalog.anatomy(female),b=catalog.anatomy(female),m=catalog.anatomy(male),expected=Array.from(b.geometry.attributes.position.array);
  assert.equal(a.geometry.attributes.position.count,5393);assert.equal(m.geometry.attributes.position.count,5255);assert.notEqual(a.geometry,b.geometry);assert.deepEqual(a.bones,m.bones);assert.equal(a.bones.length,6);
  const weights=a.geometry.attributes.skinWeight;for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6);
  let otherDisposed=0;b.geometry.addEventListener('dispose',()=>otherDisposed++);release(a);assert.equal(otherDisposed,0);assert.deepEqual(Array.from(b.geometry.attributes.position.array),expected);const again=catalog.anatomy(female);assert.deepEqual(Array.from(again.geometry.attributes.position.array),expected,'Disposing a clone never corrupts the retained female master');release(again);release(b);release(m);assert.equal(otherDisposed,1);
});

test('A pending female load keeps separate readiness and never returns the wrong anatomical model',async()=>{
  let finish;const catalog=createActorAssetCatalog({maleLoad:()=>parse('male'),femaleLoad:()=>new Promise(resolve=>{finish=resolve;})});await catalog.warm();const pending=catalog.warm(female);assert.equal(catalog.status(female).pending,true);assert.equal(catalog.status().ready,true);assert.equal(catalog.anatomy(female),null);finish(await parse('female'));assert.equal(await pending,true);assert.equal(catalog.status(female).pending,false);const anatomy=catalog.anatomy(female);assert.equal(anatomy.geometry.attributes.position.count,5393);release(anatomy);
});

test('Late female readiness preserves Aelia placement and cannot revive a disposed actor; another clone remains usable',async()=>{
  let finish;const catalog=createActorAssetCatalog({maleLoad:()=>{throw Error('Aelia must not request the male model');},femaleLoad:()=>new Promise(resolve=>{finish=resolve;})}),unit=Object.freeze({id:'aelia',name:'Aelia',role:'voter',side:'ally'}),options={chapter:10,assetLibrary:catalog};
  const living=createActor(unit,options),removed=createActor(unit,options),group=living.group,contacts=living.contacts,scene=new T.Scene();scene.add(living.group,removed.group);living.group.position.set(4,.3,-2);living.update({motion:'speak',phase:.4});removed.dispose();finish(await parse('female'));
  assert.equal(await living.ready,true);assert.equal(await removed.ready,false);assert.equal(living.group,group);assert.equal(living.contacts,contacts);assert.deepEqual(living.group.position.toArray(),[4,.3,-2]);assert.equal(scene.children.length,1);assert.equal(living.group.userData.actor.imported,true);assert.equal(living.group.getObjectByName('imported-anatomy').geometry.attributes.position.count,5393);
  const second=createActor(unit,options);await second.ready;const geometry=second.group.getObjectByName('imported-anatomy').geometry,original=Array.from(geometry.attributes.position.array);living.dispose();living.dispose();second.update({motion:'speak',phase:.7});assert.deepEqual(Array.from(geometry.attributes.position.array),original);second.dispose();assert.equal(scene.children.length,0);
});
