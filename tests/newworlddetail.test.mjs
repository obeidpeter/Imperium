import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainDetailPlan,drawTerrainDetail} from '../src/ui/terrain-detail.js';
import {scenery,drawScenery,worldGround,atmosphere,iso} from '../src/ui/world-art.js';
import {geometry} from '../src/ui/renderer.js';
import {newGame} from '../src/core/game.js';
import {createBattle} from '../src/core/battle.js';
import {createContest} from '../src/core/contest.js';
import {CHAPTERS} from '../src/data/campaign.js';

const palette=Object.freeze({light:'#eee0bf',ground:'#a7ad83',earth:'#969e75',water:'#78958a',darkWater:'#466d70'});
const map=rows=>({kind:'battle',width:rows[0].length,height:rows.length,terrain:rows,units:[]});
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
const fitted=(e,w=360,h=196)=>geometry({getBoundingClientRect:()=>({width:w,height:h})},e);
function recording(){
  const calls=[],stack=[];let props={},id=0;
  const finite=(args,name)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${name} has finite coordinates`);};
  const c=new Proxy({}, {get(_,key){
    if(key in props)return props[key];
    if(key==='save')return()=>{stack.push({...props});calls.push(['save']);};
    if(key==='restore')return()=>{assert.ok(stack.length,'Balanced canvas restore');props=stack.pop();calls.push(['restore']);};
    if(key==='createLinearGradient'||key==='createRadialGradient')return(...args)=>{
      finite(args,key);if(key==='createRadialGradient')assert.ok(args[2]>=0&&args[5]>=0);
      const gid=++id;calls.push([key,...args,gid]);return {id:gid,addColorStop(...stops){calls.push(['colorStop',gid,...stops]);}};
    };
    return(...args)=>{finite(args,key);if(key==='ellipse')assert.ok(args[2]>=0&&args[3]>=0);if(key==='arc')assert.ok(args[2]>=0);calls.push([key,...args]);};
  },set(_,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value),`${key} is finite`);props[key]=value;calls.push(['set',key,typeof value==='object'?value.id:value]);return true;}});
  return {c,calls,balanced:()=>assert.equal(stack.length,0)};
}

test('Connected banks are emitted once per actual wet/dry edge and never divide a ford from its river',()=>{
  const e=map([
    ['grass','river','grass','wall'],
    ['grass','ford','grass','rock'],
    ['grass','river','grass','grass']
  ]),plan=terrainDetailPlan(e,8);
  assert.deepEqual(plan.seams,Array.from({length:3},(_,y)=>[
    {x:0,y,dx:1,dy:0,kind:'shore',wet:-1},
    {x:1,y,dx:1,dy:0,kind:'shore',wet:1}
  ]).flat());
  assert.equal(new Set(plan.seams.map(s=>`${s.x},${s.y},${s.dx},${s.dy}`)).size,plan.seams.length);
  assert.ok(!plan.seams.some(s=>s.dy),'Continuous river/ford corridor has no artificial cross-bank');
  const g=fitted(e),end=iso(g,.5,.5),nextStart=iso(g,.5,1-.5);
  assert.deepEqual(end,nextStart,'Adjacent shoreline segments share the same projected corner');
  assert.equal(terrainDetailPlan(map([['river','wall'],['rock','marsh']]),2).seams.length,0,'Blocked terrain keeps its own raised silhouette');
});

test('Road wear joins only authored adjacent roads, while verges follow material changes',()=>{
  const e=map([['road','gate','grass'],['road','stone','sand']]),plan=terrainDetailPlan(e,5);
  assert.deepEqual(plan.tracks,[{x:0,y:0,dx:1,dy:0},{x:0,y:0,dx:0,dy:1}]);
  assert.deepEqual(plan.seams,[{x:1,y:0,dx:1,dy:0,kind:'verge'},{x:1,y:1,dx:1,dy:0,kind:'verge'}]);
  assert.ok(plan.patches.every(p=>p.kind==='gravel'),'Eastern ground uses sparse stone, not northern grass');
  assert.ok(plan.patches.every(p=>Math.round(p.x)===2),'Paved centres stay free of vegetation');
});

test('Quality levels bound detail while preserving the same truthful terrain boundaries',()=>{
  const e=map(Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>x===3?'river':y===4?'road':'grass')));
  const perf=terrainDetailPlan(e,1,'performance'),balanced=terrainDetailPlan(e,1,'balanced'),high=terrainDetailPlan(e,1,'high');
  assert.deepEqual(perf.seams,balanced.seams);assert.deepEqual(balanced.seams,high.seams);
  assert.equal(perf.patches.length,0);assert.equal(perf.tracks.length,0);
  const vegetated=e.terrain.flat().filter(t=>t==='grass').length;
  assert.equal(balanced.patches.length,vegetated*2);assert.equal(high.patches.length,vegetated*3);
  for(const plan of [balanced,high])for(const p of plan.patches){
    assert.ok(Math.hypot(p.x-Math.round(p.x),p.y-Math.round(p.y))>=.27,'Groundcover leaves the centre available for unit bases');
    assert.ok(p.x>=-.5&&p.y>=-.5&&p.x<e.width-.5&&p.y<e.height-.5);
  }
  for(const invalid of [{width:0,height:8},{width:Infinity,height:8},{width:100000,height:8},{width:8,height:1.5}]){
    const plan=terrainDetailPlan(invalid);assert.equal(plan.seams.length+plan.tracks.length+plan.patches.length,0);assert.deepEqual(scenery(invalid,1),[]);
  }
});

test('Ground planning ignores tactical state and deterministic drawing cannot consume game randomness',()=>{
  const e=freeze(map([['grass','river','road'],['marsh','ford','gate'],['grass','stone','wall']])),g=freeze(fitted(e)),before=JSON.stringify(e);
  const changed={...e,rng:98231,turn:29,units:[{id:'hero',x:0,y:0,hp:0,hidden:true}]};
  assert.deepEqual(terrainDetailPlan(e,2),terrainDetailPlan(changed,2),'Cached ground must not depend on units/turn/RNG');
  const a=recording(),b=recording(),random=Math.random;Math.random=()=>{throw new Error('Presentation consumed randomness');};
  try{drawTerrainDetail(a.c,g,e,palette,2);drawTerrainDetail(b.c,g,e,palette,2);}finally{Math.random=random;}
  assert.deepEqual(a.calls,b.calls);a.balanced();b.balanced();assert.equal(JSON.stringify(e),before);
  assert.equal(a.calls.filter(c=>c[0]==='clip').length,1,'All detail is clipped to the exact playable diamond');
});

test('Every region keeps added set dressing outside the grid and Performance reduces its count',()=>{
  const e=map(Array.from({length:8},()=>Array(8).fill('grass')));
  for(let chapter=1;chapter<=12;chapter++)for(const kind of ['battle','contest']){
    const scene={...e,kind},perf=scenery(scene,chapter,'performance'),balanced=scenery(scene,chapter,'balanced');
    assert.ok(balanced.length<=23,`${chapter}/${kind} bounds scenery cost`);assert.ok(perf.length<balanced.length);
    for(const p of balanced)assert.ok(p.x<-.5||p.y<-.5||p.x>e.width-.5||p.y>e.height-.5,`${p.type} remains outside playable tiles`);
  }
  const types=chapter=>new Set(scenery(e,chapter).map(p=>p.type));
  assert.ok(types(1).has('supplies'));assert.ok(types(2).has('driftwood'));assert.ok(types(8).has('mooring'));assert.ok(types(9).has('palm'));assert.ok(types(10).has('garden'));assert.ok(types(12).has('foundation'));
  assert.ok(scenery({...e,kind:'contest'},11).some(p=>p.type==='bench'&&p.grand));
});

test('Exterior water follows actual map edge material, with no water invented beside a dry edge',()=>{
  const dry=map(Array.from({length:4},()=>Array(4).fill('grass'))),wet=structuredClone(dry);wet.terrain[0][1]='river';
  const g=fitted(dry,640,400),a=recording(),b=recording();
  worldGround(a.c,640,400,g,dry,palette,8,'balanced');worldGround(b.c,640,400,g,wet,palette,8,'balanced');
  const waterCalls=r=>r.calls.filter(c=>c[0]==='set'&&c[1]==='fillStyle'&&c[2]===palette.water);
  assert.equal(waterCalls(a).length,0);assert.ok(waterCalls(b).length>0,'A river reaching the boundary continues into the surrounding landscape');
  assert.ok(waterCalls(b).length<=11,'One wet edge cell creates only its bounded exterior strip');
  a.balanced();b.balanced();
});

test('Small/collapsed geometry is guarded and phone geometry submits only finite non-negative shapes',()=>{
  const e=map(Array.from({length:8},()=>Array(8).fill('marsh')));
  for(const g of [{tw:0,th:0,ox:0,oy:0},{tw:NaN,th:10,ox:0,oy:0},{tw:10,th:-2,ox:0,oy:0}]){
    const r=recording();drawTerrainDetail(r.c,g,e,palette,2);worldGround(r.c,360,196,g,e,palette,2,'balanced');drawScenery(r.c,g,{x:-1,y:2,type:'amphorae'},2);assert.equal(r.calls.length,0);
  }
  for(const g of [{tw:.0001,th:.000048,ox:0,oy:0},fitted(e)]){
    const r=recording();drawTerrainDetail(r.c,g,e,palette,2,'high');for(let chapter=1;chapter<=12;chapter++)for(const item of scenery(e,chapter))drawScenery(r.c,g,item,chapter);r.balanced();assert.ok(r.calls.length>100);
  }
  const r=recording();worldGround(r.c,0,0,fitted(e),e,palette,2,'balanced');atmosphere(r.c,0,0,fitted(e),2,false,{},'high');assert.equal(r.calls.length,0);
});

test('All authored boards submit bounded finite geometry without changing encounter state',t=>{
  let encounters=0;const worst={};
  for(const chapter of CHAPTERS)for(const data of chapter.encounters){
    const state=newGame();state.chapter=chapter.id;
    const e=freeze((data.kind==='contest'?createContest:createBattle)(state,data)),g=freeze(fitted(e)),p=freeze({...palette,chamber:e.kind==='contest'}),before=JSON.stringify(e);
    for(const quality of ['performance','balanced','high']){
      const r=recording(),plan=terrainDetailPlan(e,chapter.id,quality),props=scenery(e,chapter.id,quality);
      worldGround(r.c,360,196,g,e,p,chapter.id,quality);const ground=r.calls.length;
      drawTerrainDetail(r.c,g,e,p,chapter.id,quality);const detail=r.calls.length-ground;
      for(const item of props)drawScenery(r.c,g,item,chapter.id);const exterior=r.calls.length-ground-detail;
      atmosphere(r.c,360,196,g,chapter.id,e.kind==='contest',{time:230},quality);r.balanced();const air=r.calls.length-ground-detail-exterior;
      // These are cold submission budgets, including property writes and the
      // complete no-atlas fallback. They are not timings or an FPS claim.
      const outsideTiles=(e.width+11)*(e.height+11)-e.width*e.height;
      const groundMarks=quality==='performance'?0:quality==='high'?6:4;
      assert.ok(ground<=20+outsideTiles*(11+groundMarks*8),`${data.id}/${quality}: exterior ground has bounded density`);
      assert.ok(detail<=10+plan.seams.length*24+plan.tracks.length*14+plan.patches.length*24+(plan.chamber?297:0),`${data.id}/${quality}: tile details have bounded density`);
      assert.ok(exterior<=props.length*160,`${data.id}/${quality}: fallback scenery has bounded complexity`);
      assert.ok(air<=80,`${data.id}/${quality}: atmosphere has a fixed particle ceiling`);
      if(!worst[quality]||r.calls.length>worst[quality].total)worst[quality]={encounter:data.id,total:r.calls.length,ground,detail,exterior,atmosphere:air};
    }
    assert.equal(JSON.stringify(e),before,data.id);encounters++;
  }
  assert.equal(encounters,25,'Every authored encounter is included, not only an invented terrain sample');
  t.diagnostic(`Cold recorded submissions at 360x196 (includes property writes; no image atlas): ${JSON.stringify(worst)}`);
});
