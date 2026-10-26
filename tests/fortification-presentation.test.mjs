import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createGroundHeight,gridToWorld} from '../src/showcase/environment-layout.js';
import {createBattlefieldFeatures} from '../src/showcase/battlefield-features.js';

test('the fighting tower, stair and adjacent ground share the rules heights and retire rebuilt geometry',()=>{
  const e={id:'ch5-mine',kind:'battle',type:'battle',featureEdition:31,width:12,height:12,
    terrain:Array.from({length:12},()=>Array(12).fill('grass')),elevations:[[4,4,3.2],[3,4,1.6]],
    fortifications:{version:1,material:'mudbrick',walls:[[5,4]],platforms:[{x:4,y:4,height:3.2,steps:[3,4],orientation:'vertical'}],secured:[],revision:0},
    field:{objects:[{id:'wall',kind:'breach',state:'intact',x:5,y:4,orientation:'vertical'}]}};
  e.terrain[4][4]='high';e.terrain[4][3]='stone';
  const height=createGroundHeight(e),deck=gridToWorld({x:4,y:4},e),stairs=gridToWorld({x:3,y:4},e),scene=new T.Scene();
  assert.equal(height(deck.x,deck.z),3.2);assert.equal(height(deck.x,deck.z+1.35),0,'a tower does not grow a climbable earth bank outside its footprint');
  const field=createBattlefieldFeatures(scene,{heightAt:height,quality:'performance'});field.sync(e);
  assert.equal(field.surfaceHeight(deck.x,deck.z),3.25);assert.ok(Math.abs(field.surfaceHeight(stairs.x,stairs.z)-1.65)<1e-8);
  assert.equal(field.surfaceHeight(deck.x,deck.z+1.35),null);
  const old=[];let disposed=0;field.group.traverse(o=>{if(o.geometry&&!old.includes(o.geometry)){old.push(o.geometry);o.geometry.addEventListener('dispose',()=>disposed++);}});
  e.field.objects[0].state='breached';e.fortifications.revision++;assert.equal(field.sync(e),true);assert.equal(disposed,old.length);
  assert.ok(field.stats().drawBatches<16);assert.ok(field.stats().triangles<20000);field.dispose();assert.equal(scene.children.length,0);
});
