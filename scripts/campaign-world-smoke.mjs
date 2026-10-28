// Actual campaign 3D integration on an isolated local origin. Checkpoints come
// from legal commands; the browser imports them through the player's dialog.
// Software screenshots establish correctness, not a physical-device FPS claim.
// The sieges and the rainy crossing are drawn on Performance (code-built works);
// Palmyra's walls on Balanced, where the generated board kit draws the curtains,
// towers, barred gates and breach: every piece must take the camera cutaway and
// the battle keep to the shader program budget (MAX_PROGRAMS).
// --fortified checks every battle with authored structures (battle-structures.js)
// that way instead, in the weather each draws.
// --output=DIR keeps an accepted build's review evidence separate.
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {serveRequest} from './serve.mjs';
import {menuCommand,revealControl,closePanel} from './ui-smoke-navigation.mjs';
import {runCommandCampaign} from './command-autoplay.mjs';
import * as G from '../src/core/game.js';
import {BATTLE_STRUCTURES} from '../src/data/battle-structures.js';
const source=process.argv.includes('--source'),repo=fileURLToPath(new URL('../',import.meta.url)),root=source?repo:resolve(repo,'dist');
const build=source?null:JSON.parse(await readFile(resolve(root,'build-report.json'),'utf8')).revision;
const out=resolve(repo,process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)??'tests/visual-results/campaign-world');await mkdir(out,{recursive:true});
const cases=process.argv.includes('--fortified')?Object.keys(BATTLE_STRUCTURES).map(id=>[id,null,'balanced'])
  :[['ch5-mine','dust','performance'],['ch5-wall','clear','performance'],['ch8-ferry','rain','performance'],['ch9-city','clear','balanced']];
const codes=new Map(),wanted=new Set(cases.map(x=>x[0])),stop=Error('earned');
const MAX_PROGRAMS=50;
try{runCommandCampaign({featureEdition:35,onCheckpoint:s=>{const id=G.getChapter(s).encounters[s.encounterIndex].id;if(wanted.has(id)&&!codes.has(id)){
  const weather=cases.find(x=>x[0]===id)[1],field=G.deserialize(G.serialize(s));assert.ok(G.startEncounter(field,{controls:'realtime',...(weather?{weather}:{})}).ok);codes.set(id,G.encodeSave(field));
  if(codes.size===wanted.size)throw stop;
}}});}catch(error){if(error!==stop)throw error;}
const spec=process.env.PLAYWRIGHT_MODULE??'playwright',pw=await import(spec.startsWith('C:')?pathToFileURL(spec).href:spec);
const server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await pw.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const report={source,build,browser:browser.version(),method:'Legal earned campaign checkpoints; visible import/settings/camera controls; read-only browser diagnostics.',physicalDeviceTest:false,
  captureSettings:{reducedMotion:true,method:'Normal-motion camera movement verified first; Reduce motion then enabled through visible Settings for static whole-body captures'},normalMotion:[],checks:[],errors:[]};
let activePage,activeCondition;
async function cameraState(page){return page.evaluate(()=>{
  const stage=window.__chamber.stage(),world=window.__realtime.world(),actor=stage.actors.get(world.controlled),feet=actor?.group.position.clone(),head=feet?.clone();
  if(head)head.y+=actor.group.userData.actor?.mounted?3.1:2.55;
  return {view:stage.cameraView,settled:stage.cameraSettled,renderedFrames:stage.profileFrames,reducedMotion:stage.reducedMotion,controlled:world.controlled,selected:stage.selected,
    actorVisible:actor?.group.visible,actor:feet?.toArray(),feetNdc:feet?.clone().project(stage.camera).toArray(),headNdc:head?.project(stage.camera).toArray(),
    position:stage.camera.position.toArray(),lookTarget:stage.lookTarget.toArray(),tick:world.tick,worldPaused:window.__realtime.paused(),
    stagePaused:stage.paused,hidden:document.hidden,contextLost:stage.contextLost,isReady:stage.isReady};
});}
async function changingCamera(page,view,before){
  activeCondition={...activeCondition,view,previousFrame:before.renderedFrames,previousPosition:before.position};
  await page.waitForFunction(({view,before})=>{
    const stage=window.__chamber.stage(),position=stage?.camera.position.toArray(),target=stage?.lookTarget.toArray();
    return stage?.cameraView===view&&stage.reducedMotion===false&&stage.profileFrames>=before.renderedFrames+2
      &&[...position,...target].every(Number.isFinite)&&position.some((value,index)=>Math.abs(value-before.position[index])>1e-6);
  },{view,before});
  return cameraState(page);
}
try{
  for(const [id,weather,quality]of cases){
    // Balanced draws far more in software rendering than Performance.
    const wait=quality==='balanced'?240000:120000,context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();page.setDefaultTimeout(wait);
    activePage=page;activeCondition={id,phase:'restore'};
    page.on('pageerror',e=>report.errors.push(`${id}: ${e.message}`));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(`${id}: ${m.text().slice(0,500)}`);});
    await page.goto(`http://127.0.0.1:${server.address().port}/?dev`);await menuCommand(page,'settings');
    await (await revealControl(page,'#controls-model')).selectOption('realtime');await closePanel(page);await menuCommand(page,'settings');
    await (await revealControl(page,'#battle-view')).selectOption('3d');await (await revealControl(page,'#graphics-quality')).selectOption(quality);
    await (await revealControl(page,'#motion-setting')).uncheck();assert.equal(await page.locator('#motion-setting').isChecked(),false);
    await (await revealControl(page,'#modal [data-cmd="restore"]')).click();await page.locator('#restore-code').fill(codes.get(id));
    await page.locator('[data-cmd="import-code"]').click();await page.locator('[data-cmd="confirm-import"]').click();
    await page.waitForSelector('.realtime-frame .rt-scene[data-ready="true"]');
    if(!await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
    const measured=await page.evaluate(()=>{const w=window.__realtime.world(),c=document.querySelector('#rt-board');return {
      width:c.width,height:c.height,three:Boolean(c.getContext('webgl2')),world:w.encounterId,weather:w.weather,version:w.version,
      works:w.objects.filter(o=>['breach','countermine','siege-engine'].includes(o.kind)).map(o=>({id:o.id,state:o.state,x:o.x,z:o.z})),
      platforms:w.fortifications?.platforms??[],engineers:w.squads?.filter(q=>q.role==='engineer').length??0,tick:w.tick,
      gates:w.objects.filter(o=>o.kind==='gate'&&o.fortified).map(o=>({id:o.id,state:o.state,holder:o.holder,integrity:o.integrity})),
    };});
    assert.equal(measured.world,id);assert.equal(measured.three,true,'3D did not silently fall back to a flat canvas');if(weather)assert.equal(measured.weather,weather);
    if(id==='ch5-mine'){assert.ok(measured.works.some(o=>o.id==='fort-countermine'));assert.ok(measured.works.some(o=>o.id==='fort-siege-engine'));assert.ok(measured.engineers>0);}
    if(id==='ch9-city'){assert.equal(measured.platforms.length,2,'two towers');assert.ok(measured.gates.some(g=>g.state==='closed'&&g.holder==='enemy'),'a gate the enemy holds barred');}
    // Exercise actual normal-motion camera interpolation before using static
    // captures. Only visible controls change views/settings; poses are read-only.
    activeCondition={id,phase:'normal-motion'};
    const initial=await cameraState(page);assert.equal(initial.reducedMotion,false);
    await page.locator('[data-role="cameraSelect"]').selectOption('overview');
    const overview=await changingCamera(page,'overview',initial);
    await page.locator('[data-role="cameraSelect"]').selectOption('follow');
    const followStart=await changingCamera(page,'follow',overview),followEnd=await changingCamera(page,'follow',followStart);
    for(const sample of [initial,overview,followStart,followEnd]){
      assert.equal(sample.reducedMotion,false);assert.equal(sample.worldPaused,true);
      assert.equal(sample.tick,measured.tick,'Normal-motion camera movement preserves the paused simulation');
    }
    report.normalMotion.push({id,initial,overview,followStart,followEnd});
    await menuCommand(page,'settings');await (await revealControl(page,'#motion-setting')).check();
    assert.equal(await page.locator('#motion-setting').isChecked(),true);await closePanel(page);
    await page.waitForFunction(()=>window.__chamber.stage().reducedMotion===true);
    const cameras=[];
    for(const view of ['follow','overview','horizon']){
      const previousFrame=await page.evaluate(()=>window.__chamber.stage().profileFrames);
      activeCondition={id,phase:'static-capture',view,previousFrame};
      await page.locator('[data-role="cameraSelect"]').selectOption(view);await page.locator('#rt-board').scrollIntoViewIfNeeded();
      // A view name changes immediately. Even with reduced motion, require
      // actual settled renders and visible whole-body framing, including
      // when the simulation is paused at deployment.
      await page.waitForFunction(({view,previousFrame})=>{
        const stage=window.__chamber.stage(),world=window.__realtime.world(),actor=stage?.actors.get(world?.controlled);
        if(stage?.cameraView!==view||stage.reducedMotion!==true||!stage.cameraSettled||stage.profileFrames<=previousFrame+1||stage.selected!==world.controlled||!actor?.group.visible)return false;
        const feet=actor.group.position.clone(),head=feet.clone();head.y+=actor.group.userData.actor?.mounted?3.1:2.55;
        return [feet,head].every(point=>{point.project(stage.camera);return point.z>=-1&&point.z<=1&&Math.abs(point.x)<.92&&Math.abs(point.y)<.92;});
      },{view,previousFrame});
      const camera=await cameraState(page);assert.equal(camera.reducedMotion,true);
      cameras.push(camera);
      await page.screenshot({path:resolve(out,`${id}-${view}.png`),timeout:wait});
      assert.equal(await page.evaluate(()=>window.__realtime.world().tick),measured.tick,'camera selection preserves paused simulation');
    }
    if(quality==='balanced'){
      // The kit, not its code-built stand-in, draws the structures; the cutaway covers it.
      const kit=await page.evaluate(()=>{const stage=window.__chamber.stage(),materials=new Set();
        stage.scene.traverse(o=>{if(o.isInstancedMesh&&o.name.startsWith('board kit'))for(const m of [o.material].flat())materials.add(m);});
        return {pieces:stage.stats().fieldFeatures?.boardKit??null,materials:materials.size,cutaway:[...materials].filter(m=>m.userData.sceneryCutaway).length,programs:stage.renderer.info.programs.length};});
      assert.ok(kit.pieces?.instances>0&&kit.materials>0,'the board kit draws the field’s structures');assert.equal(kit.cutaway,kit.materials,'every kit piece takes the camera cutaway');
      assert.ok(kit.programs<=MAX_PROGRAMS,`${kit.programs} shader programs, at most ${MAX_PROGRAMS}`);measured.boardKit=kit;
    }
    report.checks.push({id,quality,...measured,cameras});
    console.log(`PASS ${id}: actual 3D ${measured.weather} (${quality}), ${measured.works.length} works, ${measured.platforms.length} platforms${measured.boardKit?`, board kit ${measured.boardKit.pieces.instances} pieces, ${measured.boardKit.programs} programs`:''}`);await context.close();
  }
  assert.deepEqual(report.errors,[]);
  if(!source)assert.equal(JSON.parse(await readFile(resolve(root,'build-report.json'),'utf8')).revision,build,'The tested production build remains unchanged');
  report.passed=true;
}catch(error){
  report.passed=false;report.failure=error.stack;let timer;
  try{report.cameraFailure={...activeCondition,capturedAt:new Date().toISOString(),observed:await Promise.race([
    cameraState(activePage),new Promise(resolve=>{timer=setTimeout(()=>resolve({diagnosticUnavailable:'Renderer did not return camera diagnostics within 5 seconds'}),5000);})
  ])};}catch(diagnosticError){report.cameraFailure={...activeCondition,diagnosticUnavailable:diagnosticError.message};}
  finally{clearTimeout(timer);}
  throw error;
}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(done=>server.close(done));}
