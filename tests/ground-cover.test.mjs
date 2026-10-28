import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {GROUND_COVER,GROUND_COVER_CHUNK} from '../src/showcase/ground-cover.js';
import {occluderEligible} from '../src/showcase/environment-baked-occlusion.js';
import {terrainAt,worldToGrid,isPlayable} from '../src/showcase/environment-layout.js';

// Ground cover round the view (worlds and gameplay plan, release 5): presentation only,
// deterministic, in the meadow's own materials, and kept off the board's bare cells.
const KEY={'.':'grass','=':'road','~':'river','f':'ford','m':'marsh','X':'rock','#':'wall','o':'stone','^':'high'};
const field=(id,rows)=>({id,kind:'battle',width:rows[0].length,height:rows.length,terrain:rows.map(r=>[...r].map(c=>KEY[c]))});
const E=field('ch3-ridge',['......~.......','..XX..~...mm..','......f.......','==============','..^^..~..#....','......~..o....','......~.......','..mm..~.......']);
const cover=world=>world.group.children.filter(o=>o.userData.groundCover);
const placed=mesh=>Array.from({length:mesh.count},(_,i)=>{const m=new T.Matrix4();mesh.getMatrixAt(i,m);const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();m.decompose(p,q,s);return {p,s};});

test('none on Performance or indoors; on Balanced and High, one draw a kind in the meadow\'s own materials', () => {
  assert.equal(createEnvironment(new T.Scene(),E,{chapter:3,quality:'performance',loadTextures:false}).group.userData.groundCover,undefined);
  assert.equal(createEnvironment(new T.Scene(),{...E,id:'ch7-council',kind:'contest'},{chapter:7,quality:'balanced',loadTextures:false}).group.userData.groundCover,undefined);
  const world=createEnvironment(new T.Scene(),E,{chapter:3,quality:'balanced',loadTextures:false}),meshes=cover(world);
  assert.deepEqual(meshes.map(m=>m.userData.groundCover).sort(),['crop','dry','flower','grass','reed','scrub']);
  const meadow=world.group.getObjectByName('meadow grass'),dry=world.group.getObjectByName('dry meadow grass');
  assert.equal(meshes.find(m=>m.userData.groundCover==='grass').material,meadow.material,'the meadow\'s grass material');
  assert.equal(meshes.find(m=>m.userData.groundCover==='dry').material,dry.material);
  assert.ok(meshes.every(m=>!m.castShadow&&!occluderEligible(m)&&m.raycast()===undefined),'no shadow, no part in the bake, no picks');
  assert.ok(world.group.userData.groundCover.total>300);
  world.dispose();
});

test('on the board it stands only on open ground, short and sparse; reeds keep to the water\'s edge', () => {
  const world=createEnvironment(new T.Scene(),E,{chapter:3,quality:'high',loadTextures:false});
  for(const mesh of cover(world))for(const {p,s}of placed(mesh)){
    if(!isPlayable(p.x,p.z,E))continue;const c=worldToGrid(p.x,p.z,E),type=terrainAt(E,c.x,c.y);
    assert.ok(['grass','high'].includes(type),`${mesh.userData.groundCover} on ${type} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
    if(['grass','dry'].includes(mesh.userData.groundCover))assert.ok(s.y<=.44,'board tufts stay short');
    assert.notEqual(mesh.userData.groundCover,'crop');
  }
  world.dispose();
});

test('it follows the view\'s focus a few chunks a frame, and grows the same plants again', () => {
  const a=createEnvironment(new T.Scene(),E,{chapter:3,quality:'balanced',loadTextures:false}),b=createEnvironment(new T.Scene(),E,{chapter:3,quality:'balanced',loadTextures:false});
  const sig=world=>cover(world).map(m=>placed(m).map(({p})=>p.toArray().map(v=>v.toFixed(3)).join()).join(';')).join('|');
  assert.equal(sig(a),sig(b),'deterministic');const home=sig(a);
  const far=new T.Vector3(60,0,40);a.update(1,far,far);
  assert.ok(a.stats().groundCover.pending,'a long jump grows over several frames');
  for(let i=0;i<40&&a.stats().groundCover.pending;i++)a.update(1,far,far);
  assert.equal(a.stats().groundCover.pending,false);
  const r=GROUND_COVER.balanced.radius;for(const mesh of cover(a))for(const {p}of placed(mesh))assert.ok(Math.hypot(p.x-far.x,p.z-far.z)<=r+1e-6);
  const back=new T.Vector3(0,0,0);for(let i=0;i<40;i++)a.update(1,back,back);
  assert.equal(sig(a),home,'the same plants come back');
  assert.ok(GROUND_COVER_CHUNK>0);a.dispose();b.dispose();
});
