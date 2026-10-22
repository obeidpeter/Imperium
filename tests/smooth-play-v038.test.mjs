import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three/three.module.js';
import {staticImportClosure,studyAssets,initialAssets} from '../scripts/module-closure.mjs';
import {compileUnits,drawableShape,sceneTextures} from '../src/showcase/scene-compositor.js';
import {createInkOverlay} from '../src/showcase/ink-overlay.js';
import {rayToUpright} from '../src/showcase/stage.js';

const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);

test('the offline shell carries every module the page loads before it runs, the board readout included',async()=>{
  const closure=await staticImportClosure(rootPath,'src/ui/app.js');
  assert.ok(closure.includes('./src/ui/app.js')&&closure.includes('./src/showcase/stage-readout.js'));
  assert.ok(closure.every(path=>/^\.\/src\//.test(path)),'the shell needs no vendor or asset files');
  assert.ok(!closure.includes('./src/showcase/stage.js'),'the 3D stage arrives with a chapter, through a dynamic import');
  // The first download is the shell, the other page files and the opening art; 3D files wait for a chapter.
  const assets=[...closure,'./index.html','./src/showcase/stage.js','./vendor/three/three.module.js','./assets/models/props/basket.glb','./assets/scenes/frontier-oath.webp','./assets/scenes/marsh.webp','./showcase/index.html'];
  const initial=initialAssets(assets,{shellModules:closure,openingArt:['./assets/scenes/frontier-oath.webp']});
  assert.ok(closure.every(path=>initial.includes(path)),'every shell module, the 3D board readout included');
  assert.deepEqual(initial.filter(path=>!closure.includes(path)),['./index.html','./assets/scenes/frontier-oath.webp']);
  assert.deepEqual(studyAssets(assets,{shellModules:closure}),['./src/showcase/stage.js','./vendor/three/three.module.js','./assets/models/props/basket.glb','./showcase/index.html'],'a shell module is not counted as 3D-only');
});

test('one compile unit stands for each material and program shape; instancing is a shape of its own',()=>{
  const scene=new T.Scene(),shared=new T.MeshStandardMaterial(),other=new T.MeshBasicMaterial(),box=new T.BoxGeometry();
  const plain=[new T.Mesh(box,shared),new T.Mesh(box,shared)],instanced=new T.InstancedMesh(box,shared,4),coloured=new T.InstancedMesh(box,shared,4);
  coloured.setColorAt(0,new T.Color('red'));
  const hidden=new T.Group();hidden.visible=false;hidden.add(new T.Mesh(box,other));
  scene.add(...plain,instanced,coloured,hidden);
  assert.equal(instanced.type,'Mesh','an InstancedMesh reports the type "Mesh", so types alone would merge them');
  assert.notEqual(drawableShape(instanced),drawableShape(plain[0]));assert.notEqual(drawableShape(coloured),drawableShape(instanced));
  const units=compileUnits(scene);
  assert.deepEqual(units,[plain[0],instanced,coloured,hidden.children[0]],'hidden drawables compile too (they appear later)');
  assert.ok(drawableShape(plain[0]).split(':')[0].split('').every(c=>c==='0'||c==='1'),'flags are 0 or 1');
});

test('textures are collected from materials, their uniforms and their compiled hooks, never render targets',()=>{
  const map=new T.Texture(),hooked=new T.Texture(),uniform=new T.Texture(),target=new T.WebGLRenderTarget(4,4);
  const standard=new T.MeshStandardMaterial({map}),shader=new T.ShaderMaterial({uniforms:{a:{value:uniform},b:{value:target.texture}}});
  const scene=new T.Scene();scene.add(new T.Mesh(new T.BoxGeometry(),standard),new T.Mesh(new T.BoxGeometry(),shader));
  const properties={get:m=>m===standard?{uniforms:{baked:{value:hooked}}}:{}};
  assert.deepEqual(new Set(sceneTextures(scene,properties)),new Set([map,hooked,uniform]));
  target.dispose();
});

test('a throttled ink overlay uploads its first paint at once and a sweep of later paints at most every 50 ms',()=>{
  const scene=new T.Scene(),encounter={width:4,height:4},canvas={getContext:()=>({clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},arc(){},save(){},restore(){},rect(){},clip(){},setLineDash(){},closePath(){},quadraticCurveTo(){},bezierCurveTo(){},createLinearGradient:()=>({addColorStop(){}}),set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set globalAlpha(v){},set lineCap(v){},set lineJoin(v){}}),width:0,height:0};
  const prior=globalThis.OffscreenCanvas;globalThis.OffscreenCanvas=function(){return canvas;};
  try{
    const ink=createInkOverlay(scene,encounter,()=>0,{throttle:true}),texture=ink.mesh.material.map;let uploads=texture.version;
    const uploaded=()=>{const changed=texture.version!==uploads;uploads=texture.version;return changed;};
    assert.equal(ink.paint({targets:[{x:1,y:1}]}),true);assert.equal(uploaded(),true,'the first paint shows at once');
    assert.equal(ink.paint({targets:[{x:2,y:1}]}),true);assert.equal(uploaded(),false,'a paint within 50 ms waits');
    const start=performance.now();
    assert.equal(ink.flush(start+10),false);assert.equal(ink.flush(start+60),true);assert.equal(uploaded(),true,'the newest paint lands on a later frame');
    assert.equal(ink.flush(start+200),false,'nothing pending, nothing uploaded');
    const eager=createInkOverlay(scene,encounter,()=>0);const t=eager.mesh.material.map,before=t.version;
    eager.paint({targets:[{x:1,y:1}]});eager.paint({targets:[{x:2,y:2}]});assert.equal(t.version-before,2,'an unthrottled overlay uploads every paint');
    ink.dispose();eager.dispose();
  }finally{if(prior)globalThis.OffscreenCanvas=prior;else delete globalThis.OffscreenCanvas;}
});

test('the pick prefilter measures the true distance from a ray to a standing figure',()=>{
  const brute=(ray,x,y,z,h)=>{let best=Infinity;for(let i=0;i<=4000;i++){const t=i*.02,p=ray.at(t,new T.Vector3());const s=Math.min(h,Math.max(0,p.y-y));best=Math.min(best,Math.hypot(p.x-x,p.y-(y+s),p.z-z));}return best;};
  const cases=[[new T.Vector3(0,20,20),new T.Vector3(0,-1,-1)],[new T.Vector3(-10,2,0),new T.Vector3(1,0,0)],[new T.Vector3(3,30,-4),new T.Vector3(0,-1,0)],[new T.Vector3(5,1,5),new T.Vector3(1,.2,1)]];
  for(const [origin,direction]of cases){const ray=new T.Ray(origin,direction.normalize());
    for(const [x,y,z]of [[0,0,0],[2,.5,-1],[-3,0,4]]){const d=rayToUpright(ray,x,y,z,2.2);assert.ok(Math.abs(d-brute(ray,x,y,z,2.2))<.03,`${d} vs brute force`);}}
});

test('the performance check summarises frames and recommends the richest tier that keeps its target',async()=>{
  const {percentile,summarizeFrames,meetsTarget,recommendTier,checkOrder}=await import('../src/ui/performance-check.js');
  assert.equal(percentile([5,1,3,2,4],.5),3);assert.equal(percentile([],.5),null);
  const frames=Array.from({length:40},(_,i)=>[i*20,4,i%10===9?40:16]),summary=summarizeFrames(frames,{fps:60});
  assert.equal(summary.frames,40);assert.equal(summary.intervalMs.p50,16);assert.equal(summary.intervalMs.p95,40);assert.equal(summary.slowFrames,4);
  assert.equal(meetsTarget(summary,{fps:60}),false,'a 60 fps tier with hitches misses');assert.equal(meetsTarget(summary,{fps:30}),true);
  assert.equal(meetsTarget(summary,{fps:30,longTaskMaxMs:180}),false,'a long freeze misses the target');
  assert.equal(recommendTier([{tier:'performance',meetsTarget:true},{tier:'balanced',meetsTarget:true},{tier:'high',meetsTarget:false}]),'balanced');
  assert.equal(recommendTier([{tier:'balanced',meetsTarget:false}]),'performance');
  assert.deepEqual(checkOrder('balanced'),['performance','high','balanced'],'the check ends on the player\'s own tier');
});

test('the performance check rebuilds each tier, turns the camera, restores the player\'s settings and never touches the encounter',async()=>{
  const {runPerformanceCheck,CHECK_TOUR}=await import('../src/ui/performance-check.js');
  let clock=0,adaptive=[];const interval={performance:20,balanced:16,high:40};
  const encounter={id:'ch7-legion',units:[{id:'hero',x:1,y:1}]},before=JSON.stringify(encounter);
  const stage={quality:'balanced',chapter:7,figureStyle:'sculpted',encounter,orbit:{yaw:0},ready:Promise.resolve(),log:null,views:[],deviceReport:{renderer:'Test GPU',software:false},
    renderer:{info:{programs:new Array(60)},extensions:{has:()=>false}},gpuTimer:{stats:()=>({supported:true})},
    applyQuality(q){this.quality=q;this.ready=new Promise(done=>setTimeout(done,0));},
    startFrameLog(){this.log={frames:[],gpu:[]};return this.log;},stopFrameLog(){const l=this.log;this.log=null;return l;},
    home(){this.views.push('home');},focusSelected(){this.views.push('focusSelected');},horizon(){this.views.push('horizon');},
    stats(){return {calls:120,triangles:300000,textures:80,geometries:200,firstFramePrograms:0};}};
  const controller={stage,quality(q){stage.applyQuality(q);},adaptive(v){adaptive.push(v);}};
  const nextFrame=async()=>{const step=interval[stage.quality];clock+=step;stage.log?.frames.push([clock,5,step]);stage.log?.gpu.push(step*.6);};
  const progress=[];
  const simulation=async()=>({actors15:{ticks:10,p50:.1,p95:.2,max:.3},actors82:{ticks:10,p50:.4,p95:.6,max:.9},budgetMs:4});
  const report=await runPerformanceCheck(controller,{current:'balanced',adaptive:true,app:{version:'test'},now:()=>clock,nextFrame,longTasks:{entries:[],supported:true,dispose(){}},facts:()=>({hardwareConcurrency:8}),onProgress:p=>progress.push(`${p.step}:${p.tier}`),simulation});
  assert.deepEqual(report.tiers.map(t=>t.tier),['performance','high','balanced']);
  assert.ok(report.tiers.every(t=>t.rebuilt&&Number.isFinite(t.buildMs)),'every tier is a fresh build');
  assert.deepEqual(progress,['build:performance','tour:performance','build:high','tour:high','build:balanced','tour:balanced','simulation:undefined']);
  assert.equal(report.simulation.actors82.p95,.6,'the real-time tick is timed after the tiers');
  assert.equal(stage.quality,'balanced','the player\'s tier is in place at the end');assert.deepEqual(adaptive,[false,true],'adaptive resolution is off while measuring, then restored');
  assert.ok(stage.orbit.yaw>Math.PI*2*2,'the camera turned throughout');
  assert.deepEqual(stage.views.filter(v=>v!=='home').slice(0,2),CHECK_TOUR.filter(([v])=>v!=='home').map(([v])=>v));
  const byTier=Object.fromEntries(report.tiers.map(t=>[t.tier,t]));
  assert.equal(byTier.performance.meetsTarget,true);assert.equal(byTier.balanced.meetsTarget,true);assert.equal(byTier.high.meetsTarget,false);
  assert.equal(report.recommendation,'balanced');assert.equal(report.complete,true);
  assert.equal(byTier.high.tour.fps,25);assert.ok(byTier.balanced.tour.gpuMs.p95>0);
  assert.equal(report.device.renderer,'Test GPU');assert.equal(report.device.hardwareConcurrency,8);assert.equal(report.battle.encounter,'ch7-legion');
  assert.equal(JSON.stringify(encounter),before,'the encounter is untouched');
  JSON.parse(JSON.stringify(report));
  // Cancelling stops at the next step and still restores everything.
  let calls=0;stage.quality='performance';adaptive=[];
  const partial=await runPerformanceCheck(controller,{current:'performance',adaptive:false,now:()=>clock,nextFrame,isCancelled:()=>++calls>40,longTasks:{entries:[],supported:false,dispose(){}},facts:()=>({}),simulation});
  assert.equal(partial.complete,false);assert.equal(partial.simulation,null,'a cancelled check skips the tick timing');assert.equal(stage.quality,'performance');assert.deepEqual(adaptive,[false,false]);
  // A battle that goes away ends the check with an error.
  await assert.rejects(runPerformanceCheck({stage:null,quality(){},adaptive(){}}),/Open a 3D battle/);
});

test('Settings offers the performance check, and the page takes no game input while it runs',async()=>{
  const {createPanels}=await import('../src/ui/panels.js'),{createCheckBand}=await import('../src/ui/performance-check.js'),{createRenderHold}=await import('../src/ui/render-controller.js');
  const shown=[],panels=createPanels(()=>({settings:{},showModal:(title,body)=>shown.push(body)}));
  panels.showSettings();assert.match(shown[0],/<button data-cmd="performance-check">Run performance check<\/button>/);
  panels.showPerformanceCheck({tiers:[],recommendation:'balanced',current:'balanced',complete:false,device:{renderer:null,software:false}});assert.match(shown[1],/data-cmd="performance-check-save">Save results \(JSON\)/);
  // The band holds keys back before the board sees them: Escape cancels, Enter and Space still press Cancel.
  const element=()=>Object.assign(new EventTarget(),{children:[],attributes:{},textContent:'',setAttribute(k,v){this.attributes[k]=v;},append(...nodes){this.children.push(...nodes);},remove(){this.removed=true;},focus(){focused=this;}});
  let focused=null;const win=new EventTarget(),body=element(),doc={body,createElement:element};
  const band=createCheckBand({document:doc,window:win}),[node]=body.children,[status,cancel]=node.children;
  assert.equal(node.className,'performance-check');assert.equal(status.attributes.role,'status');assert.equal(focused,cancel,'Cancel takes the focus');
  const key=(key,target=null)=>{const event=Object.defineProperties(new Event('keydown',{cancelable:true}),{key:{value:key},target:{value:target}});let reached=true;win.addEventListener('keydown',()=>{},{once:true});
    const stop=event.stopImmediatePropagation.bind(event);event.stopImmediatePropagation=()=>{reached=false;stop();};win.dispatchEvent(event);return {held:!reached&&event.defaultPrevented};};
  assert.equal(key('e').held,true,'End turn never reaches the page');assert.equal(key('Enter').held,true);assert.equal(band.cancelled,false);
  assert.equal(key('Enter',cancel).held,false,'Enter on Cancel presses it');assert.equal(key(' ',cancel).held,false);
  assert.equal(key('Escape').held,true);assert.equal(band.cancelled,true,'Escape cancels');
  const again=createCheckBand({document:doc,window:win}),button=body.children[1].children[1];
  button.dispatchEvent(new Event('click'));assert.equal(again.cancelled,true);assert.equal(body.children[1].children[0].textContent,'Stopping after this step…');
  band.show('Performance check 1 of 3: building Balanced. Escape cancels.');assert.match(status.textContent,/1 of 3/);
  band.close();again.close();assert.equal(node.removed,true);assert.equal(key('e').held,false,'Closed, the band holds nothing back');
  // No page render remounts the stage mid-check: one asked for meanwhile happens once, after.
  let renders=0;const hold=createRenderHold(()=>renders++);
  assert.equal(hold.defer(),false,'Without a check, the page renders');hold.hold();
  assert.equal(hold.defer(),true);assert.equal(hold.defer(),true);assert.equal(renders,0);
  hold.release();assert.equal(renders,1);assert.equal(hold.defer(),false);
  hold.hold();hold.release();assert.equal(renders,1,'Nothing asked, nothing rendered');
});

test('phones start on Performance until the player chooses; a strained battle steps the tier down once at a time',async()=>{
  const {defaultGraphicsMode,phoneLike,createGraphicsQuality}=await import('../src/ui/graphics-quality.js');
  assert.equal(defaultGraphicsMode({phone:true}),'performance');assert.equal(defaultGraphicsMode({}),'balanced');assert.equal(defaultGraphicsMode({deviceMemory:2}),'performance');
  const win=(coarse,w,h)=>({matchMedia:()=>({matches:coarse}),screen:{width:w,height:h}});
  assert.equal(phoneLike(win(true,390,844)),true);assert.equal(phoneLike(win(true,820,1180)),true,'a small tablet too');assert.equal(phoneLike(win(true,1024,1366)),false);assert.equal(phoneLike(win(false,390,844)),false);assert.equal(phoneLike({}),false);
  const changes=[],quality=createGraphicsQuality({mode:'high',onChange:change=>changes.push(change)});
  assert.equal(quality.stepDown(),'balanced');assert.equal(quality.stepDown(),'performance');assert.equal(quality.stepDown(),'performance');
  assert.deepEqual(changes,[{mode:'balanced',reason:'measured-cost'},{mode:'performance',reason:'measured-cost'}]);
  // Strain counts only when measured at the current tier with adaptive resolution on.
  const strained=createGraphicsQuality({mode:'high'});
  assert.equal(strained.strained('balanced'),null,'measured at another tier');assert.equal(strained.strained('high',{adaptive:false}),null);
  assert.equal(strained.strained('high',{adaptive:true}),'balanced');assert.equal(strained.strained('balanced'),'performance');assert.equal(strained.strained('performance'),'performance');
  // The first-launch default knows phones; a stored choice stands, and an unknown one falls back to the device's default.
  const {loadSettings}=await import('../src/ui/settings.js');
  assert.equal(loadSettings(null,{phone:true}).quality,'performance');assert.equal(loadSettings(null,{}).quality,'balanced');
  assert.equal(loadSettings('{"quality":"high"}',{phone:true}).quality,'high');assert.equal(loadSettings('{"quality":"ultra"}',{phone:true}).quality,'performance');
});

test('no chapter downloads the superseded Roman atlas, which only the complete historical pack keeps',async()=>{
  const {chapterAssets}=await import('../src/ui/art.js');
  for(let n=1;n<=12;n++){const files=chapterAssets(n);assert.ok(!files.includes('./assets/tactical/units-roman.webp'),`Chapter ${n}`);if(n!==11)assert.ok(files.includes('./assets/tactical/units-roman-v031.webp'));}
  // Nothing draws it: the 2D board loads only the current atlases, in every legally reached battle and chamber.
  const {tacticalAssets}=await import('../src/ui/unit-sprites.js');
  const scenes=JSON.parse(await readFile(new URL('tests/fixtures/campaign-3d.json',root),'utf8')).scenes;assert.ok(scenes.length>=25);
  for(const scene of scenes){const atlases=tacticalAssets(scene.state.encounter);assert.ok(!atlases.includes('./assets/tactical/units-roman.webp'),scene.id);if(scene.state.encounter.kind==='battle')assert.ok(atlases.includes('./assets/tactical/units-roman-v031.webp'),scene.id);}
});

test('the road keeps every triangle that shows and the exact normals, and drops only clear ones',async()=>{
  const {dropClearRoadCells}=await import('../src/showcase/environment.js');
  // A 4x3 grid whose right part is clear; one bump makes the normals matter.
  const nx=3,nz=2,position=[],color=[],uv=[],index=[];
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){position.push(x,x===1&&z===1?.3:0,z);uv.push(x,z);color.push(1,1,1,x<=1?.8:0);if(x<nx&&z<nz){const j=z*(nx+1)+x;index.push(j,j+nx+1,j+1,j+1,j+nx+1,j+nx+2);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,4));g.setIndex(index);g.computeVertexNormals();
  const before=g.clone(),key=(geo,i)=>[geo.attributes.position.getX(i),geo.attributes.position.getY(i),geo.attributes.position.getZ(i)].join();
  const shown=new Map();for(let i=0;i<before.attributes.position.count;i++)shown.set(key(before,i),[before.attributes.normal.getX(i),before.attributes.normal.getY(i),before.attributes.normal.getZ(i),before.attributes.color.getW(i)]);
  const dropped=dropClearRoadCells(g);
  assert.ok(dropped>0&&g.index.count/3===index.length/3-dropped);
  for(let t=0;t<g.index.count;t+=3)assert.ok([0,1,2].some(k=>g.attributes.color.getW(g.index.array[t+k])>0),'no kept triangle is wholly clear');
  for(let i=0;i<g.attributes.position.count;i++){const [nx_,ny,nz_,a]=shown.get(key(g,i));assert.deepEqual([g.attributes.normal.getX(i),g.attributes.normal.getY(i),g.attributes.normal.getZ(i),g.attributes.color.getW(i)],[nx_,ny,nz_,a]);}
  const visible=index.length/3-[...Array(index.length/3).keys()].filter(t=>[0,1,2].every(k=>color[index[t*3+k]*4+3]===0)).length;
  assert.equal(g.index.count/3,visible,'every triangle with any opacity is kept');
  assert.ok(g.attributes.position.count<before.attributes.position.count,'vertices only clear triangles used are gone');
});

test('procedural surface tiles are generated once per session; each stage owns and frees its own textures',async()=>{
  const {createEnvironmentMaterials}=await import('../src/showcase/environment-materials.js');
  const first=createEnvironmentMaterials({loadTextures:false}),second=createEnvironmentMaterials({loadTextures:false});
  for(const key of ['earth','stone','wood','bark','cloth']){
    const a=first.materials[key].map,b=second.materials[key].map;
    assert.notEqual(a,b,`${key}: separate textures`);assert.equal(a.image.data,b.image.data,`${key}: shared pixels`);
  }
  let freed=0;first.materials.stone.map.addEventListener('dispose',()=>freed++);first.dispose();assert.equal(freed,1);
  assert.equal(second.materials.stone.map.image.data.length,128*128*4,'the other stage\'s pixels are intact');second.dispose();
});
