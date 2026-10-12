import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {drawBattle,geometry} from '../src/ui/renderer.js';
import {previewPath,rendererCacheStats,clearBattleCache} from '../src/ui/battle-art.js';
import {spriteSpec,drawUnitSprite,FACING_COLUMN,loadTacticalArt,tacticalAssets} from '../src/ui/unit-sprites.js';
import {clearArtCache} from '../src/ui/art.js';
import {scenery} from '../src/ui/world-art.js';
import {reachable} from '../src/core/shared.js';
import {createBattle,createLegacyBattle} from '../src/core/battle.js';
import {newGame} from '../src/core/game.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {authoredFrame} from '../src/ui/sprite-frames.js';
import {FRAME_ATLASES} from '../src/ui/animation-catalog.js';

const originalImage=globalThis.Image;
before(async()=>{
  globalThis.Image=class {
    naturalWidth=768;naturalHeight=1024;
    set src(value){this.url=value;const atlas=Object.values(FRAME_ATLASES).find(a=>a.file===value);if(atlas){this.naturalWidth=Math.max(...atlas.frames.map(f=>f.source[0]+f.source[2]));this.naturalHeight=Math.max(...atlas.frames.map(f=>f.source[1]+f.source[3]));}if(value)queueMicrotask(()=>this.onload?.());}
    get src(){return this.url;}
    async decode(){}
  };
  clearArtCache();await loadTacticalArt({kind:'battle'});await loadTacticalArt({kind:'contest'});
});
after(()=>{clearArtCache();clearBattleCache();if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;});
const clone=value=>structuredClone(value);
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
const unit=(id,x,y,extra={})=>({id,name:id,side:'ally',x,y,hp:12,maxHp:12,morale:80,role:'infantry',facing:'east',...extra});
const encounter=(units=[])=>({id:'render-fixture',kind:'battle',width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill('grass')),units});

// Canvas call recorder with a real transform stack. Assertions concern the
// submitted geometry/crops/order; it deliberately makes no pixel-quality claim.
function canvas(width=720,height=540,{cache=false}={}){
  const calls=[],surfaces=[],stack=[];let state={globalAlpha:1,matrix:[1,0,0,1,0,0],font:'12px Georgia'};
  const multiply=m=>{const[a,b,c,d,e,f]=state.matrix,[aa,bb,cc,dd,ee,ff]=m;state.matrix=[a*aa+c*bb,b*aa+d*bb,a*cc+c*dd,b*cc+d*dd,a*ee+c*ff+e,b*ee+d*ff+f];};
  const target={width,height,getBoundingClientRect:()=>({left:0,top:0,width,height}),calls,surfaces};
  const methods={
    save(){stack.push({...state,matrix:[...state.matrix]});},restore(){state=stack.pop()??state;},
    setTransform(...m){state.matrix=m;},translate(x,y){multiply([1,0,0,1,x,y]);},
    scale(x,y){multiply([x,0,0,y,0,0]);},rotate(a){multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},transform(...m){multiply(m);},
    measureText(text){return {width:String(text).length*7};},
    createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};}
  };
  const context=new Proxy({}, {
    get(_,key){if(key==='canvas')return target;if(key in methods)return methods[key];if(key in state)return state[key];return(...args)=>{
      for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${String(key)} received finite geometry`);
      if(key==='ellipse')assert.ok(args[2]>=0&&args[3]>=0);if(key==='arc')assert.ok(args[2]>=0);
      calls.push({method:key,args,alpha:state.globalAlpha,matrix:[...state.matrix],fill:state.fillStyle});
    };},set(_,key,value){state[key]=value;return true;}
  });
  target.getContext=()=>context;
  if(cache)target.ownerDocument={createElement(tag){assert.equal(tag,'canvas');const surface=canvas(1,1);surfaces.push(surface);return surface;}};
  return target;
}
const sprites=board=>board.calls.filter(call=>call.method==='drawImage'&&(call.args[0]?.src?.includes('/units-')||call.args[0]?.src?.includes('/animation/')));

test('Sprite atlas rows express career stage, military role and chamber role',()=>{
  const hero=unit('hero',1,1,{side:'player'});
  for(const [chapter,row] of [[1,0],[2,1],[4,1],[5,2],[6,2],[7,3],[12,3]])assert.deepEqual(spriteSpec(hero,chapter),{atlas:'roman',row});
  assert.deepEqual(spriteSpec(unit('enemy',1,1,{side:'enemy',name:'Gothic raider'}),7),{atlas:'frontier',row:0});
  assert.deepEqual(spriteSpec(unit('archer',1,1,{side:'enemy',role:'archer'}),9),{atlas:'frontier',row:1});
  assert.deepEqual(spriteSpec(unit('horse',1,1,{side:'enemy',role:'heavy'}),9),{atlas:'frontier',row:2});
  assert.deepEqual(spriteSpec(unit('horse',1,1,{role:'cavalry'}),9),{atlas:'frontier',row:3});
  assert.deepEqual(spriteSpec(hero,8,true),{atlas:'civic',row:0});
  assert.deepEqual(spriteSpec(hero,11,true),{atlas:'civic',row:1});
  assert.deepEqual(spriteSpec(unit('rival',1,1,{side:'enemy'}),11,true),{atlas:'civic',row:2});
  assert.deepEqual(spriteSpec(unit('delegate',1,1,{role:'voter',side:'neutral'}),11,true),{atlas:'civic',row:3});
});

test('Loaded sprites crop four authored facings within the real atlas bounds without mirrored hands',()=>{
  const board=canvas(),c=board.getContext('2d'),g={tw:48},u=freeze(unit('hero',1,1));
  for(const facing of ['east','south','north','west']){
    const override=freeze({facing,pose:'idle'});
    assert.equal(drawUnitSprite(c,g,{x:100,y:100},u,1,false,override),true);
    const call=sprites(board).at(-1),[sheet,sx,sy,sw,sh]=call.args;
    const frame=authoredFrame(spriteSpec(u,1),facing,override,u);assert.deepEqual([sx,sy,sw,sh],frame.source);assert.ok(sheet.src.endsWith('recruit-actions.webp'));
    const fallback=canvas();drawUnitSprite(fallback.getContext('2d'),g,{x:100,y:100},u,5,false,override);const old=sprites(fallback).at(-1);assert.deepEqual(old.args.slice(1,5),[FACING_COLUMN[facing]*192,512,192,256]);
    assert.ok(sx>=0&&sx+sw<=sheet.naturalWidth&&sy+sh<=sheet.naturalHeight);
    assert.ok(call.matrix[0]*call.matrix[3]-call.matrix[1]*call.matrix[2]>0,'Facing must not mirror shield and weapon hands');
  }
});

test('Actual current and legacy armies keep faction equipment, including allied and rival Roman archers',()=>{
  const observed=new Set();
  for(const create of [createBattle,createLegacyBattle])for(const chapter of CHAPTERS)for(const data of chapter.encounters.filter(e=>e.kind==='battle')){
    const state=newGame();state.chapter=chapter.id;
    const battle=create(state,data);
    for(const u of battle.units){
      if(u.role==='trainer'||u.role==='escort'||u.id==='hero')continue;
      const spec=spriteSpec(u,chapter.id);
      if(u.side==='ally'&&u.role==='archer'){assert.deepEqual(spec,{atlas:'specialists',row:1},`${data.id} ${u.name}`);observed.add('Roman archer');}
      if(u.side!=='enemy'||['cavalry','heavy'].includes(u.role))continue;
      const east=[5,6,9].includes(chapter.id);
      if(u.role==='archer'){
        assert.deepEqual(spec,east?{atlas:'frontier',row:1}:chapter.id>=11?{atlas:'specialists',row:1}:{atlas:'specialists',row:0},`${data.id} ${u.name}`);
        observed.add(chapter.id>=11?'Rival Roman archer':east?'Eastern archer':'Gothic archer');
      }else if([5,6].includes(chapter.id)){assert.deepEqual(spec,{atlas:'specialists',row:2},`${data.id} ${u.name}`);observed.add('Persian infantry');}
      else if(chapter.id===9){assert.deepEqual(spec,{atlas:'specialists',row:3},`${data.id} ${u.name}`);observed.add('Palmyrene infantry');}
      else if(chapter.id<11)assert.deepEqual(spec,{atlas:'frontier',row:0},`${data.id} ${u.name}`);
    }
  }
  assert.deepEqual([...observed].sort(),['Eastern archer','Gothic archer','Palmyrene infantry','Persian infantry','Rival Roman archer','Roman archer'].sort());
  const pledged=unit('enemy2',1,1,{name:'Pledged cohort',side:'ally',role:'archer'});
  assert.deepEqual(spriteSpec(pledged,12),{atlas:'specialists',row:1},'A pledge does not turn Roman archery equipment into infantry gear');
  assert.deepEqual(spriteSpec(unit('hero',1,1,{name:'Persian Gothic',side:'player'}),1),{atlas:'roman',row:0},'Player names do not assign an opposing faction');
});

test('Specialist loading leaves civic contests and military/civilian escorts distinct',()=>{
  const path='./assets/tactical/units-specialists.webp';
  assert.ok(tacticalAssets({kind:'battle'}).includes(path));
  assert.ok(!tacticalAssets({kind:'contest'}).includes(path));
  for(const [name,atlas,row] of [['Varro and his wounded guard','roman',2],['Wounded Lucan','roman',1],['Withdrawal squad','roman',1],['Eagle-bearer','roman',1],['Records party','civic',0],['Senate’s negotiating envoy','civic',0],['Settler families','civic',3],['Children and household carts','civic',3]]){
    assert.deepEqual(spriteSpec(unit('escort',1,1,{name,role:'escort',side:'neutral'}),8),{atlas,row},name);
  }
  const board=canvas(),u=unit('enemy1',1,1,{name:'Gothic archer',role:'archer',side:'enemy'});
  assert.equal(drawUnitSprite(board.getContext('2d'),{tw:48},{x:100,y:100},u,1,false),true);
  assert.ok(sprites(board)[0].args[0].src.endsWith('units-specialists.webp'),'The selected specialist atlas is loaded and actually drawn');
});

test('A turn blends authored old and new facings rather than flipping its sprite',()=>{
  const board=canvas();drawUnitSprite(board.getContext('2d'),{tw:48},{x:100,y:100},unit('hero',1,1),1,false,{pose:'turn',previousFacing:'west',facing:'north',turnProgress:.25});
  const draws=sprites(board);assert.equal(draws.length,2);assert.deepEqual(draws.map(c=>c.args.slice(1,5)),['west','north'].map(f=>authoredFrame({atlas:'roman',row:0},f,{pose:'turn'}).source));assert.deepEqual(draws.map(c=>c.alpha),[.75,.25]);
});

test('Animated positions determine unit depth and keep retreating units visible until alpha reaches zero',()=>{
  const board=canvas(),e=encounter([unit('hero',6,5,{side:'player'}),unit('archer',3,3,{side:'enemy',role:'archer'}),unit('gone',2,2,{hp:0}),unit('hidden',4,4,{hidden:true})]);
  const frame=freeze({time:100,unitOverrides:{hero:{x:1,y:1,alpha:1},gone:{x:4,y:4,alpha:.4}},effects:[]});
  freeze(e);drawBattle(board,e,'hero',[],null,1,{animation:frame,quality:'performance'});
  const draws=sprites(board);assert.equal(draws.length,3,'Hidden units stay hidden; retiring units remain visible');
  assert.deepEqual(draws.map(c=>c.args[0].src.split('/').at(-1)),['recruit-actions.webp','units-specialists.webp','roman-actions.webp']);assert.deepEqual(draws[1].args.slice(1,5),[0,0,192,256]);
  const g=geometry(board,e);assert.ok(Math.abs(draws[0].matrix[4]-g.ox)<1e-9);assert.ok(Math.abs(draws[0].matrix[5]-(g.oy+g.th))<1e-9);
  assert.equal(draws[2].alpha,.4);
  const final=canvas();drawBattle(final,e,'hero',[],null,1,{quality:'performance'});assert.equal(sprites(final).length,2);
});

test('Raised walls sort between rear and front units, fading only when covering the selected unit',()=>{
  const e=encounter([unit('hero',1,1,{side:'player'}),unit('ally',3,3)]);e.terrain[2][2]='wall';freeze(e);
  for(const [selected,expectedAlpha] of [['hero',.38],['ally',1]]){
    const board=canvas();drawBattle(board,e,selected,[],null,1,{quality:'performance'});
    const draws=sprites(board),wall=board.calls.find(c=>c.method==='drawImage'&&c.args[0]?.src?.endsWith('/natural-props.webp')&&c.args[1]===c.args[0].naturalWidth/2&&c.args[2]===c.args[0].naturalHeight/2);
    assert.ok(wall,'Raised wall uses the actual rampart cell of the loaded world atlas');assert.ok(board.calls.indexOf(draws[0])<board.calls.indexOf(wall));assert.ok(board.calls.indexOf(wall)<board.calls.indexOf(draws[1]));
    assert.equal(wall.alpha,expectedAlpha,'Only an occluded selected silhouette should fade the terrain');
  }
});

test('Preview paths avoid blocked and occupied tiles, and match actual weighted movement costs',()=>{
  const e=encounter([unit('hero',0,3,{move:14}),unit('blocker',1,3),unit('hidden',1,2,{hidden:true}),unit('fallen',1,4,{hp:0})]);
  e.terrain[2][2]='rock';e.terrain[3][2]='river';e.terrain[4][2]='marsh';e.terrain[4][3]='marsh';e.terrain[5][2]='marsh';
  const before=JSON.stringify(e);freeze(e);
  for(const target of reachable(e,e.units[0])){
    const path=previewPath(e,e.units[0],target);assert.deepEqual(path[0],{x:0,y:3});assert.deepEqual(path.at(-1),{x:target.x,y:target.y});
    let cost=0;for(let i=1;i<path.length;i++){const p=path[i],last=path[i-1];assert.equal(Math.abs(p.x-last.x)+Math.abs(p.y-last.y),1);assert.ok(!['rock','river'].includes(e.terrain[p.y][p.x]));assert.ok(!e.units.some(u=>u.id!=='hero'&&u.hp>0&&u.x===p.x&&u.y===p.y));cost+=e.terrain[p.y][p.x]==='marsh'?2:1;}
    assert.equal(cost,target.cost,'Preview must use the same cheapest path cost as actual reachable cells');
  }
  for(const target of [{x:1,y:3},{x:1,y:2},{x:2,y:2},{x:2,y:3},{x:-1,y:0}])assert.deepEqual(previewPath(e,e.units[0],target),[]);
  assert.equal(JSON.stringify(e),before);
  const line=clone(e);line.units[0].formation='line';for(const target of reachable(line,line.units[0]))assert.equal(previewPath(line,line.units[0],target).length-1,target.cost);
});

test('A completely sealed target produces no misleading straight preview shortcut',()=>{
  const e=encounter([unit('hero',0,0)]);for(let y=0;y<8;y++)e.terrain[y][3]='river';assert.deepEqual(previewPath(e,e.units[0],{x:6,y:3}),[]);
});

test('Ground caching reuses a bounded surface, invalidates terrain/size/quality, and releases prior backing stores',()=>{
  clearBattleCache();const e=freeze(encounter([unit('hero',1,3)])),board=canvas(720,540,{cache:true});
  drawBattle(board,e);const first=board.surfaces[0];assert.ok(first.width>=720);assert.equal(board.surfaces.length,1);
  drawBattle(board,e,'hero',[],null,1,{animation:{time:90,unitOverrides:{hero:{x:1.25,y:3}},effects:[]}});assert.equal(board.surfaces.length,1,'Motion reuses static ground');
  const changed=clone(e);changed.terrain[0][0]='sand';drawBattle(board,changed);assert.equal(board.surfaces.length,2);assert.equal(first.width,1);assert.equal(first.height,1);
  const oldRatio=globalThis.devicePixelRatio;globalThis.devicePixelRatio=3;
  try{for(const [width,height,quality,ratio] of [[360,196,'performance',1],[960,640,'high',2],[720,540,'balanced',1.5]]){
    const resized=canvas(width,height,{cache:true});drawBattle(resized,e,'hero',[],null,1,{quality});assert.equal(rendererCacheStats().surfaces,1);
    const surface=resized.surfaces[0];assert.equal(surface.width,Math.ceil(width*ratio));assert.equal(surface.height,Math.ceil(height*ratio));assert.equal(rendererCacheStats().estimatedBytes,surface.width*surface.height*4);
  }}finally{if(oldRatio===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=oldRatio;}
  clearBattleCache();assert.deepEqual(rendererCacheStats(),{surfaces:0,estimatedBytes:0});
});

test('Every region renders frozen campaign/animation inputs with all decorative scenery outside the rule grid',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const e=encounter([unit('hero',1,3,{side:'player'}),unit('enemy',4,4,{side:'enemy'}),unit('ally',2,5)]);e.kind=chapter===11?'contest':'battle';
    if(e.kind==='contest')for(const u of e.units){u.resolve=u.hp;u.maxResolve=u.hp;}
    e.terrain[0][2]='wall';e.terrain[2][2]='high';e.terrain[4][5]='cover';
    const animation={time:240,unitOverrides:{hero:{x:1.5,y:3,facing:'south',pose:'walk',progress:.5,alpha:1}},effects:[{type:'projectile',from:{x:1,y:3},to:{x:4,y:4},progress:.5,alpha:1}]};
    const input={e,animation,targets:[{x:2,y:3}],focus:{x:3,y:3},target:{x:2,y:3}};freeze(input);
    const before=JSON.stringify(input);for(const quality of ['performance','balanced','high'])drawBattle(canvas(360,196),e,'hero',input.targets,input.focus,chapter,{animation,quality,action:'move',target:input.target});
    assert.equal(JSON.stringify(input),before);assert.ok(scenery(e,chapter).every(p=>p.x<0||p.y<0||p.x>=e.width||p.y>=e.height));
  }
});
