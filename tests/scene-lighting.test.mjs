import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {lightingRadiance} from '../src/showcase/scene-lighting.js';
import {createContactShadows} from '../src/showcase/contact-shadows.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';

test('Outdoor reflection radiance follows the actual sun and stays finite in all campaign palettes',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const profile=getSceneProfile({}, {chapter}),before=JSON.stringify(profile),sun=new T.Vector3(...profile.sunPosition).normalize();
    const bright=lightingRadiance(profile,sun),away=lightingRadiance(profile,new T.Vector3(-sun.x,sun.y,-sun.z));
    assert.ok(bright.r+bright.g+bright.b>away.r+away.g+away.b+1,'Metal catches the authored sun bearing.');
    for(const d of [new T.Vector3(0,1,0),new T.Vector3(0,-1,0),new T.Vector3(1,0,0),new T.Vector3()]){
      assert.ok(lightingRadiance(profile,d).toArray().every(v=>Number.isFinite(v)&&v>=0));
    }
    assert.equal(JSON.stringify(profile),before);
  }
});

test('Pooled contact shadows follow elevated ground, cap capacity and exclude invisible actors without changing transforms',()=>{
  const scene=new T.Scene(),shadows=createContactShadows(scene,{capacity:2}),actors=new Map();
  for(let i=0;i<4;i++){const group=new T.Group();group.position.set(i*3,1,i*2);group.rotation.y=i*.7;group.visible=i!==1;group.userData.actor={mounted:i===2};actors.set(i,{group});}
  const prior=[...actors.values()].map(a=>a.group.matrix.toArray()),height=(x,z)=>.2+x*.1+z*.2;
  shadows.update(actors,height);assert.equal(shadows.stats().figures,2);assert.equal(shadows.stats().draws,1);assert.equal(shadows.mesh.geometry.drawRange.count,192);
  const positions=shadows.mesh.geometry.attributes.position;
  for(let i=0;i<50;i++)assert.ok(Math.abs(positions.getY(i)-height(positions.getX(i),positions.getZ(i))-.04)<1e-6);
  assert.deepEqual([...actors.values()].map(a=>a.group.matrix.toArray()),prior);
  for(const {group}of actors.values())group.visible=false;
  shadows.update(actors,height);assert.equal(shadows.mesh.visible,false);assert.equal(shadows.mesh.geometry.drawRange.count,0);
  let disposed=0;shadows.mesh.geometry.addEventListener('dispose',()=>disposed++);shadows.dispose();shadows.dispose();assert.equal(disposed,1);assert.equal(scene.children.length,0);
});
