import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createMasonryBlockGeometry,createPalmFrondGeometry,createColumnGeometry,smoothCoincidentNormals} from '../src/showcase/environment-primitives.js';
import {createEnvironmentMaterials} from '../src/showcase/environment-materials.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {readFile} from 'node:fs/promises';
const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));

test('Masonry bevels stay within the original collision envelope and expose finite normalized edge normals',()=>{
  const g=createMasonryBlockGeometry(),p=g.attributes.position,n=g.attributes.normal;let diagonal=0,flat=0;
  for(let i=0;i<p.count;i++){
    for(let c=0;c<3;c++)assert.ok(Math.abs(p.array[i*3+c])<=.5000001,'No vertex expands the old block bounds');
    assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);const axes=[n.getX(i),n.getY(i),n.getZ(i)].filter(v=>Math.abs(v)>.01).length;if(axes>1)diagonal++;else flat++;
  }
  assert.ok(diagonal>0&&flat>0,'Broad planar faces and small light-catching bevels coexist');
  assert.deepEqual(g.boundingBox.min.toArray(),[-.5,-.5,-.5]);assert.deepEqual(g.boundingBox.max.toArray(),[.5,.5,.5]);g.dispose();
});

test('Compound palms and fluted columns use real bounded geometry, with leaf gaps and taper preserved',()=>{
  const palm=createPalmFrondGeometry(),column=createColumnGeometry();
  for(const g of [palm,column]){for(const a of Object.values(g.attributes))for(const v of a.array)assert.ok(Number.isFinite(v));for(const i of g.index.array)assert.ok(i>=0&&i<g.attributes.position.count);}
  palm.computeBoundingBox();assert.ok(palm.boundingBox.max.x<3.2);assert.ok(palm.boundingBox.min.y<-.5);assert.ok(palm.boundingBox.max.y>.3);assert.ok(palm.index.count/3<150,'Compound frond remains a small instanced primitive');
  const p=column.attributes.position,atHeight=y=>Array.from({length:p.count},(_,i)=>i).filter(i=>Math.abs(p.getY(i)-y)<.0001).map(i=>Math.hypot(p.getX(i),p.getZ(i)));
  const lower=atHeight(1.25),upper=atHeight(4.05);assert.ok(Math.max(...lower)-Math.min(...lower)>.01,'Shaft has actual shallow fluting');assert.ok(Math.min(...lower)>Math.max(...upper),'Entasis still tapers toward the capital');palm.dispose();column.dispose();
});

test('Material finishes preserve the existing soil texture and three quality tiers compose leaf wind without losing surface treatment',()=>{
  for(const chapter of [1,2,9,11]){
    const profile=getSceneProfile({id:`ch${chapter}-test`,kind:chapter===11?'contest':'battle'},{chapter}),library=createEnvironmentMaterials({loadTextures:false,profile}),m=library.materials;
    for(const key of ['ground','stone','wood','leaves','floor']){const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};m[key].onBeforeCompile(shader);assert.ok(shader.vertexShader.includes('vEnvironmentSurface=(modelMatrix*environmentPosition).xyz;'));assert.ok(shader.fragmentShader.includes('roughnessFactor*='));if(key==='ground')assert.equal(shader.uniforms.frontierSoil,m.ground.userData.soilTexture);}
    library.dispose();
  }
  const s=fixture.scenes.find(s=>s.id==='ch1-road');
  for(const quality of ['performance','balanced','high']){
    const w=createEnvironment(new T.Scene(),s.state.encounter,{loadTextures:false,quality}),leaves=w.group.getObjectByName('oak leaves'),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};leaves.material.onBeforeCompile(shader);
    assert.equal(leaves.material.userData.environmentFinish,'foliage');assert.ok(shader.fragmentShader.includes('if(!gl_FrontFacing)'));assert.equal(Boolean(shader.uniforms.environmentWind),quality!=='performance');w.dispose();
  }
});

test('New low vegetation stays beyond the playable perimeter and all decorative density remains bounded',()=>{
  const s=fixture.scenes.find(s=>s.id==='ch1-road'),before=JSON.stringify(s.state);
  for(const quality of ['performance','balanced','high']){
    const w=createEnvironment(new T.Scene(),s.state.encounter,{loadTextures:false,quality}),growth=w.group.getObjectByName('broadleaf verge growth'),matrix=new T.Matrix4(),position=new T.Vector3();assert.ok(growth?.isInstancedMesh);
    for(let i=0;i<growth.count;i++){growth.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);assert.ok(Math.abs(position.x)>11||Math.abs(position.z)>11,'Broadleaf plants remain outside every legal centre');}
    let triangles=0;w.group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});assert.ok(triangles<650000);assert.ok(w.stats().meshes<60);assert.ok(w.stats().instances<20000);w.update(4);assert.equal(JSON.stringify(s.state),before);w.dispose();
  }
});


test('Rock smoothing preserves every vertex while removing duplicate-face normal seams',()=>{
  const g=new T.IcosahedronGeometry(1,2),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)*(1+.10*Math.sin(p.getX(i)*5)));const before=Float32Array.from(p.array);smoothCoincidentNormals(g);assert.deepEqual(p.array,before);const seen=new Map(),n=g.attributes.normal;
  for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(','),normal=[n.getX(i),n.getY(i),n.getZ(i)];assert.ok(Math.abs(Math.hypot(...normal)-1)<1e-6);if(seen.has(key))assert.deepEqual(normal,seen.get(key));else seen.set(key,normal);}
  assert.ok(seen.size<p.count/2,'The check actually covered duplicated face vertices');g.dispose();
});
