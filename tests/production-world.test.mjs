import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_ASSETS,worldAssetKey} from '../src/ui/world-assets.js';
import {materialIndex,texturePlacements,paintMaterial,drawNaturalProp} from '../src/ui/ground-materials.js';
import {loadArt,peekArt,clearArtCache} from '../src/ui/art.js';
import {drawBattle,geometry,pickTile} from '../src/ui/renderer.js';
import {clearBattleCache} from '../src/ui/battle-art.js';
import {drawScenery} from '../src/ui/world-art.js';

const originalImage=globalThis.Image;
globalThis.Image=class{naturalWidth=1152;naturalHeight=768;set src(path){this.url=path;if(path.includes('natural-props'))this.naturalWidth=this.naturalHeight=1024;if(path.includes('camp-props')){this.naturalWidth=1024;this.naturalHeight=512;}if(path)queueMicrotask(()=>this.onload?.());}get src(){return this.url;}async decode(){}};
after(()=>{clearArtCache();clearBattleCache();if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;});
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
const e=()=>({id:'world-proof',kind:'battle',width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill('grass')),units:[],rng:1234,turn:1});
function board(width=720,height=540,cache=false){
  const calls=[],surfaces=[],stack=[];let props={globalAlpha:1};
  const canvas={width,height,calls,surfaces,getBoundingClientRect:()=>({width,height,left:10,top:20})};
  const ctx=new Proxy({}, {get(_,key){
    if(key==='canvas')return canvas;if(key in props)return props[key];
    if(key==='save')return()=>stack.push({...props});if(key==='restore')return()=>{assert.ok(stack.length);props=stack.pop();};
    if(key==='createLinearGradient'||key==='createRadialGradient')return()=>({addColorStop(){}});
    if(key==='measureText')return text=>({width:String(text).length*7});
    return(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),String(key));calls.push({method:key,args,alpha:props.globalAlpha,stroke:props.strokeStyle});};
  },set(_,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value));props[key]=value;return true;}});
  canvas.getContext=()=>ctx;canvas.balanced=()=>assert.equal(stack.length,0);
  if(cache)canvas.ownerDocument={createElement:()=>{const child=board(1,1);surfaces.push(child);return child;}};
  return canvas;
}

test('Material classes preserve actual wet, road and chamber boundaries',()=>{
  assert.equal(materialIndex('river',1),materialIndex('ford',1));
  assert.notEqual(materialIndex('marsh',2),materialIndex('river',2));
  assert.equal(materialIndex('road',1),materialIndex('gate',1));
  assert.notEqual(materialIndex('road',1),materialIndex('grass',1));
  assert.equal(materialIndex('grass',9),materialIndex('sand',1));
  assert.equal(materialIndex('chamber',11,true),materialIndex('stone',11,true));
  const image1={},image2={},lookup=new Map();const key0=worldAssetKey(path=>lookup.get(path));lookup.set(WORLD_ASSETS[0],image1);
  const key1=worldAssetKey(path=>lookup.get(path));assert.notEqual(key0,key1);assert.equal(key1,worldAssetKey(path=>lookup.get(path)));lookup.set(WORLD_ASSETS[0],image2);assert.notEqual(key1,worldAssetKey(path=>lookup.get(path)));
});

test('Neighbouring clipped regions keep one continuous texture origin and bounded draw work',()=>{
  const a=texturePlacements({x:0,y:0,w:130,h:90},100),b=texturePlacements({x:70,y:30,w:130,h:90},100);
  for(const shared of a.filter(t=>t.x===100))assert.deepEqual(shared,b.find(t=>t.x===shared.x&&t.y===shared.y));
  assert.ok(a.some(t=>t.flipX));assert.ok(b.some(t=>t.flipY));
  assert.deepEqual(texturePlacements({x:0,y:0,w:Infinity,h:1},1),[]);assert.deepEqual(texturePlacements({x:0,y:0,w:10000,h:10000},.01),[]);
  assert.equal(texturePlacements({x:-200,y:-100,w:1600,h:900},80).length,252,'Only intersecting tiles plus partial edge tiles are submitted');
});

test('Loaded material crops stay within the six real cells and restore canvas state',async()=>{
  clearArtCache();await loadArt(WORLD_ASSETS[0]);const scene=board(),c=scene.getContext('2d'),g={tw:60};
  for(let index=0;index<6;index++)assert.equal(paintMaterial(c,g,{x:17,y:21,w:280,h:180},index,.8),true);
  const draws=scene.calls.filter(x=>x.method==='drawImage');assert.ok(draws.length>6&&draws.length<50);
  for(const {args:[image,sx,sy,sw,sh]}of draws){assert.ok(sx>=0&&sy>=0&&sx+sw<=image.naturalWidth&&sy+sh<=image.naturalHeight);assert.equal(sw,383);assert.equal(sh,383);}
  scene.balanced();
});

test('Natural props select separate normalized crops and preserve the shared ground anchor',async()=>{
  await loadArt(WORLD_ASSETS[1]);const scene=board(),c=scene.getContext('2d');
  for(const type of ['rock','palm','tree','wall'])assert.equal(drawNaturalProp(c,type,100),true);
  const draws=scene.calls.filter(x=>x.method==='drawImage');assert.equal(new Set(draws.map(d=>d.args.slice(1,3).join())).size,4);
  for(const {args:[image,sx,sy,sw,sh,x,y,w,h]}of draws){assert.ok(sx+sw<=image.naturalWidth&&sy+sh<=image.naturalHeight);assert.equal(x,-50);assert.equal(y,-100*480/512);assert.equal(w,100);assert.equal(h,100);}
  assert.equal(drawNaturalProp(c,'invented-obstacle',100),false);assert.equal(drawNaturalProp(c,'rock',Infinity),false);scene.balanced();
});

test('Stockade and supplies use distinct transparent cells with the same foot anchor',async()=>{
  await loadArt(WORLD_ASSETS[2]);const scene=board(),c=scene.getContext('2d');
  for(const type of ['palisade','supplies','amphorae'])assert.equal(drawNaturalProp(c,type,108),true);
  const draws=scene.calls.filter(x=>x.method==='drawImage');assert.deepEqual(draws.map(d=>d.args.slice(1,5)),[[0,0,512,512],[512,0,512,512],[512,0,512,512]]);
  for(const {args:[image,sx,sy,sw,sh,x,y,w,h]}of draws){assert.ok(sx+sw<=image.naturalWidth&&sy+sh<=image.naturalHeight);assert.equal(x,-54);assert.equal(y,-108*480/512);assert.equal(w,108);assert.equal(h,108);}scene.balanced();
});

test('Exterior foundation dressing reuses painted rubble without introducing a terrain blocker',async()=>{
  await loadArt(WORLD_ASSETS[1]);const scene=board(),item=freeze({x:4.3,y:-1.3,type:'foundation'}),before=JSON.stringify(item);
  drawScenery(scene.getContext('2d'),{ox:300,oy:80,tw:60,th:28.8},item,9);
  const draws=scene.calls.filter(x=>x.method==='drawImage');assert.equal(draws.length,1);assert.equal(draws[0].args[0],peekArt(WORLD_ASSETS[1]));assert.deepEqual(draws[0].args.slice(1,5),[0,0,512,512]);
  assert.equal(scene.calls.filter(x=>x.method==='fill').length,0,'Loaded rubble replaces the former flat block composition');assert.equal(JSON.stringify(item),before);scene.balanced();
});

test('Late art arrival invalidates cached fallback once; interactive grid and hover do not rebuild terrain',async()=>{
  clearArtCache();clearBattleCache();const canvas=board(720,540,true),state=freeze(e());
  drawBattle(canvas,state);assert.equal(canvas.surfaces.length,1);
  await loadArt(WORLD_ASSETS[0]);drawBattle(canvas,state);assert.equal(canvas.surfaces.length,2);assert.equal(canvas.surfaces[0].width,1,'Retired fallback storage is released');
  drawBattle(canvas,state,'hero',[],null,1,{grid:true,hover:{x:3,y:3}});assert.equal(canvas.surfaces.length,2);
  await loadArt(WORLD_ASSETS[1]);drawBattle(canvas,state);assert.equal(canvas.surfaces.length,3);drawBattle(canvas,state);assert.equal(canvas.surfaces.length,3);
  await loadArt(WORLD_ASSETS[2]);drawBattle(canvas,state);assert.equal(canvas.surfaces.length,4);drawBattle(canvas,state);assert.equal(canvas.surfaces.length,4);canvas.balanced();
});

test('No idle lattice is drawn; explicit Grid leaves legal picking, objectives and encounter state unchanged',()=>{
  const state=e();state.goal={x:4,y:3};freeze(state);const before=JSON.stringify(state),quiet=board(360,320),grid=board(360,320);
  const rng=Math.random;Math.random=()=>{throw Error('World rendering consumed gameplay randomness');};
  try{drawBattle(quiet,state);drawBattle(grid,state,'hero',[],null,1,{grid:true});}finally{Math.random=rng;}
  assert.equal(quiet.calls.filter(c=>c.method==='stroke'&&c.stroke==='#d5dec42b').length,0);assert.equal(grid.calls.filter(c=>c.method==='stroke'&&c.stroke==='#d5dec42b').length,64);
  const geom=geometry(grid,state);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const point=pickTile(grid,state,10+geom.ox+(x-y)*geom.tw/2,20+geom.oy+(x+y)*geom.th/2);assert.ok(point.x===x&&point.y===y);}
  assert.equal(JSON.stringify(state),before);quiet.balanced();grid.balanced();
});
