import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {ROCK_KIT_NEAR,createRockKitPlacer,rockKitFor,rockKitTransform,rockKitUrl,sceneRockKitUrl} from '../src/showcase/rock-kit.js';
import {ROCK_KIT_COMPONENTS} from '../src/showcase/rock-kit-components.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {WORLD_CATALOG,chapterWorldFiles} from '../src/ui/world-catalog.js';

// The regional rock kits (worlds and gameplay plan, release 5): four Tripo rocks for each
// group of chapters, fitted to the footprint the code-built stones had, drawn in the
// field's stone program. Presentation only.

function standInKit(kit){
  const master=new T.Group(),map=new T.DataTexture(new Uint8Array([150,140,120,255]),1,1);map.needsUpdate=true;
  const material=new T.MeshStandardMaterial({map});
  for(const [id,b]of Object.entries(ROCK_KIT_COMPONENTS[kit]))for(const suffix of ['','_far']){
    const root=new T.Group();root.name=id+suffix;const size=b.max.map((v,i)=>v-b.min[i]);
    const mesh=new T.Mesh(new T.BoxGeometry(...size).translate(0,size[1]/2,0),material);mesh.name=`${id}${suffix}_mesh`;root.add(mesh);master.add(root);
  }
  return master;
}
const field=(id,width=12,height=10)=>{const terrain=Array.from({length:height},()=>Array(width).fill('grass'));terrain[4][5]=terrain[5][6]='rock';return {id,kind:'battle',width,height,terrain};};

test('every chapter has its region\'s rocks in its pack alone', () => {
  for(let chapter=1;chapter<=12;chapter++){
    const kit=rockKitFor(chapter);assert.ok(Object.keys(ROCK_KIT_COMPONENTS[kit]).length===4,`chapter ${chapter}: four rocks`);
    assert.ok(chapterWorldFiles(chapter).includes(rockKitUrl(chapter)));
  }
  for(const kit of ['temperate','italy','arid'])assert.ok(WORLD_CATALOG[`rocks-${kit}`]);
  assert.equal(sceneRockKitUrl({id:'ch11-council',kind:'contest'},11),null,'none indoors');
});

test('a kit rock never covers more ground, nor stands taller, than the stone it replaces', () => {
  for(const kit of Object.keys(ROCK_KIT_COMPONENTS))for(let seed=0;seed<60;seed++)for(const [radius,height]of [[.4,.4],[1.07,1.1],[1.5,.8],[.35,.6]]){
    const t=rockKitTransform(kit,{x:seed*1.3,y:0,z:-seed*.7,radius,height,seed});
    assert.ok(t.radius<=radius+1e-9&&t.height<=height+1e-9,`${kit} ${t.id}: ${t.radius.toFixed(2)} m wide and ${t.height.toFixed(2)} m tall within ${radius} and ${height}`);
  }
  const ids=new Set();for(let seed=0;seed<40;seed++)ids.add(rockKitTransform('arid',{x:seed,y:0,z:seed*2,radius:1,height:1,seed}).id);
  assert.equal(ids.size,4,'all four rocks are used');
});

test('each rock kit model holds every rock near and far, as its components record', () => {
  for(const kit of Object.keys(ROCK_KIT_COMPONENTS)){
    const bytes=readFileSync(new URL(`../${rockKitUrl(kit==='temperate'?1:kit==='italy'?7:5)}`,import.meta.url)),length=bytes.readUInt32LE(12);
    const gltf=JSON.parse(bytes.subarray(20,20+length).toString('utf8')),names=new Set(gltf.nodes.map(n=>n.name));
    for(const id of Object.keys(ROCK_KIT_COMPONENTS[kit]))for(const suffix of ['','_far'])assert.ok(names.has(id+suffix),`${kit}: ${id+suffix}`);
    const report=JSON.parse(readFileSync(new URL(`../art-source/models/processed/rocks-${kit}.json`,import.meta.url),'utf8'));
    for(const rock of report.rocks)assert.deepEqual(ROCK_KIT_COMPONENTS[kit][rock.id],{min:rock.min,max:rock.max});
  }
});

test('rocks take the level their distance asks for, one draw a rock and level', () => {
  const placer=createRockKitPlacer(standInKit('temperate'),'temperate',new Map()),group=new T.Group();
  for(let i=0;i<8;i++)assert.ok(placer.place({x:i*12,y:0,z:0,radius:1,height:1,seed:i}));
  placer.build(group);
  const count=level=>group.children.filter(m=>m.userData.rockKit.level===level).reduce((n,m)=>n+m.count,0);
  assert.deepEqual([count('near'),count('far')],[0,8],'the bake sees the far level');
  placer.update({x:0,z:0});assert.equal(count('near'),[0,12,24,36].filter(x=>x<=ROCK_KIT_NEAR).length);
  assert.equal(count('near')+count('far'),8);
  assert.ok(group.children.every(m=>m.raycast()===undefined));
  placer.dispose();assert.equal(group.children.length,0);
});

test('with the kit, the field\'s stones are kit rocks in the stone\'s own program', () => {
  const e=field('ch3-ridge'),before=JSON.stringify(e);
  const code=createEnvironment(new T.Scene(),e,{chapter:3,quality:'balanced',loadTextures:false});
  const world=createEnvironment(new T.Scene(),e,{chapter:3,quality:'balanced',loadTextures:false,rockKit:standInKit('temperate')});
  assert.equal(JSON.stringify(e),before);
  const rocks=[];world.group.traverse(o=>{if(o.isInstancedMesh&&o.userData.rockKit)rocks.push(o);});
  const stones=[];code.group.traverse(o=>{if(o.isInstancedMesh&&o.name==='limestone')stones.push(o);});
  assert.ok(rocks.length&&stones.length);
  // A rock cell holds four code-built stones, or a kit boulder and one smaller rock.
  const drawn=stones.reduce((n,m)=>n+m.count,0),placed=world.group.userData.rockKit.placed;
  assert.equal(drawn-placed,2*2,'two fewer stones in each of the two rock cells, the rest one for one');
  assert.equal(world.group.getObjectByName('limestone'),undefined,'no noise stone remains');
  assert.equal(rocks[0].material.customProgramCacheKey(),stones[0].material.customProgramCacheKey(),'the stone\'s program key');
  for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])assert.equal(!!rocks[0].material[key],!!stones[0].material[key],key);
  const low=createEnvironment(new T.Scene(),e,{chapter:3,quality:'performance',loadTextures:false,rockKit:standInKit('temperate')});
  assert.equal(low.group.userData.rockKit,undefined,'Performance keeps the code-built stones');
  code.dispose();world.dispose();low.dispose();
});
