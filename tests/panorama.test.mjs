import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {PANORAMA_BAND,PANORAMA_REGIONS,panoramaChapters,panoramaFile,panoramaKey} from '../src/ui/panoramas.js';
import {WORLD_CATALOG,chapterWorldFiles} from '../src/ui/world-catalog.js';
import {bleedColumns,foldRows,checkRender} from '../scripts/assets/build-panoramas.mjs';
import {PANORAMA_RADIUS,createPanorama,createPanoramaMaterial,panoramaHaze,panoramaLoaded,panoramaTexture,panoramaTint,warmPanorama} from '../src/showcase/environment-panorama.js';
import {BACKDROP_RADIUS} from '../src/showcase/environment-backdrop.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {createHash} from 'node:crypto';

const luminance=c=>.2126*c.r+.7152*c.g+.0722*c.b;

test('every chapter has a skyline, every skyline a chapter, and each chapter\'s pack carries its own alone',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const key=panoramaKey(chapter);assert.ok(PANORAMA_REGIONS.includes(key),`Chapter ${chapter}`);
    assert.ok(chapterWorldFiles(chapter).includes(panoramaFile(key)));
    for(const other of PANORAMA_REGIONS)if(other!==key)assert.ok(!chapterWorldFiles(chapter).includes(panoramaFile(other)),`Chapter ${chapter} does not carry ${other}`);
  }
  for(const key of PANORAMA_REGIONS){assert.ok(panoramaChapters(key).length,key);assert.equal(WORLD_CATALOG[`panorama-${key}`].kind,'panorama');assert.match(panoramaFile(key),/^assets\/textures\/panoramas\/[a-z]+-v1\.ktx2$/);}
  assert.equal(panoramaKey(7),'alps');assert.equal(panoramaKey(11),'rome');assert.equal(panoramaKey(12),'campagna');assert.equal(panoramaKey(13),null);
  // 8192 pixels around for 14.0625 degrees: square pixels, folded into rows no wider than 4096.
  const {width,height,rows,minLatitude,maxLatitude}=PANORAMA_BAND;
  assert.equal(width/360,height/(maxLatitude-minLatitude));assert.equal(width/rows,4096);
});

test('the build fills clear sky from the skyline below it and folds the west half above the east',()=>{
  // Two columns, four rows: a covered pixel in row 2 (red) and in rows 1-2 (blue).
  const px=(r,g,b,a)=>[r,g,b,a],rgba=Uint8Array.from([
    ...px(0,0,0,0),...px(0,0,0,0),
    ...px(0,0,0,0),...px(0,0,255,255),
    ...px(255,0,0,128),...px(0,0,250,255),
    ...px(0,0,0,0),...px(0,0,0,0)]);
  bleedColumns(rgba,2,4);
  assert.deepEqual([...rgba.subarray(0,4)],[255,0,0,0],'the sky takes the skyline\'s colour and stays clear');
  assert.deepEqual([...rgba.subarray(4,8)],[0,0,255,0]);
  assert.deepEqual([...rgba.subarray(24,28)],[255,0,0,0],'below the nearest ground too');
  assert.deepEqual([...rgba.subarray(28,32)],[0,0,250,0]);
  // A band of four columns (two west, two east) and two rows folds into the west half above the east.
  const p=v=>[v,v,v,v],band=Uint8Array.from([...p(1),...p(2),...p(3),...p(4),...p(5),...p(6),...p(7),...p(8)]),folded=foldRows(band,4,2,2);
  assert.deepEqual({width:folded.width,height:folded.height},{width:2,height:4});
  assert.deepEqual([...folded.data].filter((_,i)=>i%4===0),[1,2,5,6,3,4,7,8]);
  assert.throws(()=>foldRows(band,3,2,2));
});

test('a render is checked against its report: digest, band and proportion',()=>{
  const png=Buffer.from('a render'),sha256=createHash('sha256').update(png).digest('hex');
  const report={key:'alps',latitude:[PANORAMA_BAND.minLatitude,PANORAMA_BAND.maxLatitude],eye:12,width:2048,height:80,png:{sha256}};
  assert.equal(checkRender(report,png,'alps'),report);
  assert.throws(()=>checkRender(report,Buffer.from('another'),'alps'),/digest/);
  assert.throws(()=>checkRender({...report,latitude:[-4,10]},png,'alps'),/band/);
  assert.throws(()=>checkRender({...report,height:81},png,'alps'),/proportion/);
  assert.throws(()=>checkRender(report,png,'mesa'),/reports alps/);
});

test('the panorama stands where the painted backdrop stood, on the band\'s own elevations, in one program',()=>{
  const texture=new T.DataTexture(new Uint8Array(64*10*4),64,10);
  const profile=getSceneProfile({},{chapter:7}),panorama=createPanorama(profile,{texture});
  const mesh=panorama.group.children[0],box=new T.Box3().setFromObject(mesh);
  assert.equal(PANORAMA_RADIUS,BACKDROP_RADIUS);assert.equal(mesh.geometry.parameters.radiusTop,PANORAMA_RADIUS);
  const y=deg=>PANORAMA_BAND.eye+PANORAMA_RADIUS*Math.tan(deg*Math.PI/180);
  assert.ok(box.min.y<y(PANORAMA_BAND.minLatitude)&&box.max.y>y(PANORAMA_BAND.maxLatitude),'the cylinder covers the band');
  assert.equal(panorama.stats.panorama,'alps');assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.side,T.BackSide);
  const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};
  mesh.material.onBeforeCompile(shader);
  assert.ok(shader.fragmentShader.includes('textureGrad(map'));assert.ok(!shader.fragmentShader.includes('#include <fog_fragment>'),'its own haze replaces the plain fog');
  assert.ok(shader.vertexShader.includes('vPanorama=position;'));
  // Another region's texture draws with the same program.
  assert.equal(createPanoramaMaterial(texture,getSceneProfile({},{chapter:5})).customProgramCacheKey(),mesh.material.customProgramCacheKey());
  let freed=false,textureFreed=false;mesh.geometry.addEventListener('dispose',()=>freed=true);texture.addEventListener('dispose',()=>textureFreed=true);
  panorama.dispose();assert.equal(freed,true);assert.equal(textureFreed,false,'the texture is the session\'s, not the scene\'s');
});

test('without a loaded panorama, and in council chambers, the painted backdrop stands in',()=>{
  const missing=createPanorama(getSceneProfile({},{chapter:9}));
  assert.equal(missing.stats.panorama,null);assert.equal(missing.group.userData.environmentBackdrop,true);
  const chamber=createPanorama(getSceneProfile({kind:'contest'},{chapter:11}),{texture:new T.DataTexture(new Uint8Array(4),1,1)});
  assert.equal(chamber.stats.panorama,null,'a council chamber has no skyline');
});

test('haze and light follow the chapter: hazier in rain and mist, darker at night, warmer at dusk',()=>{
  const clear=panoramaHaze(getSceneProfile({},{chapter:7})),rain=panoramaHaze({weather:'rain'}),mist=panoramaHaze({weather:'mist'}),night=panoramaHaze({timeOfDay:'night'});
  assert.ok(rain>clear&&mist>clear&&night>clear);assert.ok(rain<=.7&&clear>=.3);
  const day=panoramaTint(getSceneProfile({},{chapter:7})),dusk=panoramaTint(getSceneProfile({},{chapter:5})),dark=panoramaTint(getSceneProfile({},{chapter:5,timeOfDay:'night'}));
  assert.ok(Math.abs(luminance(day)-1)<1e-6);assert.ok(luminance(dusk)<luminance(day));assert.ok(luminance(dark)<.3);
  assert.ok(dusk.r/dusk.b>day.r/day.b,'dusk is warmer');
});

test('a panorama loads once for the session; a failure or a wrong shape leaves the stand-in and is tried again',async()=>{
  assert.equal(await warmPanorama(null),false);
  assert.equal(await warmPanorama('reeds',{load:()=>Promise.reject(new Error('offline'))}),false);assert.equal(panoramaLoaded('reeds'),false);
  const shaped=(w,h)=>()=>Promise.resolve(Object.assign(new T.Texture(),{image:{width:w,height:h}}));
  assert.equal(await warmPanorama('reeds',{load:shaped(64,64)}),false,'a square image is not the band');
  let calls=0;const load=(...args)=>{calls++;return shaped(1024,160)(...args);};
  assert.equal(await warmPanorama('reeds',{load}),true);assert.equal(panoramaLoaded('reeds'),true);
  assert.equal(await warmPanorama('reeds',{load}),true);assert.equal(calls,1,'held for the session');
  assert.equal(panoramaTexture('reeds').colorSpace,T.SRGBColorSpace);
  assert.equal(createPanorama(getSceneProfile({},{chapter:2})).stats.panorama,'reeds','the next scene in the region uses it');
});
