import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the production event functions, with a small deterministic DOM/clock.
// The checks exercise races; they do not assert source text or duplicate behavior.
const source=readFileSync(new URL('../src/ui/app.js',import.meta.url),'utf8');
function productionFunction(name){const start=source.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));assert.ok(start>=0,`Missing ${name}`);const rest=source.slice(start),next=rest.slice(1).search(/^(?:async )?function \w+\(/m);return next<0?rest:rest.slice(0,next+1);}

test('Repeated renders before a frame bind only the current board and consume motion once',()=>{
  const frames=[],boards=[],calls={paint:0,bind:0,motion:0},toast={hidden:false};let board;
  const context=vm.createContext({
    state:{phase:'encounter',chapter:1,encounter:{kind:'battle'}},screen:'game',renderTicket:0,settings:{reducedMotion:false,textScale:1},pendingMotion:{before:{},after:{}},
    document:{activeElement:{id:'battle-board'},documentElement:{dataset:{},style:{setProperty(){}}},querySelector(selector){return selector==='#toast'?toast:board;},getElementById(){return board;}},
    app:{set innerHTML(value){board={markup:value,bindings:0,focuses:0,focus(){this.focuses++;}};boards.push(board);}},
    titleView:()=>'',battle:()=>'<canvas id="battle-board"></canvas>',promotion:()=>'',ending:()=>'',camp:()=>'',
    requestAnimationFrame(fn){frames.push(fn);},paint(){calls.paint++;},bindBoard(){calls.bind++;board.bindings++;},playEncounterMotion(canvas){calls.motion++;assert.equal(canvas,board);}
  });
  vm.runInContext(productionFunction('render'),context);
  context.render();context.render();
  assert.equal(frames.length,2);frames.forEach(fn=>fn());
  assert.deepEqual(calls,{paint:1,bind:1,motion:1});assert.equal(boards[0].bindings,0);assert.equal(boards[1].bindings,1);assert.equal(boards[1].focuses,1);assert.equal(context.pendingMotion,null);
});

test('A delayed reign card cannot download blank art or overwrite a replacement card',async()=>{
  const pending=[],draws=[],canvases=[];let current,buttons;
  const campaign={name:'Aurelius',route:'settlement',decisions:{ch9:'mercy',ch4:'withdraw',ch11:'independent'}},before=JSON.stringify(campaign);
  const context=vm.createContext({
    state:campaign,shareFile:null,CONFIG:{siteUrl:'https://sacramentum.test/'},location:{href:'https://sacramentum.test/'},URL,File:class{constructor(parts,name,options){Object.assign(this,{parts,name,...options});}},
    document:{querySelector(selector){return selector==='#reign-card'?current:buttons.share;}},
    modal:{querySelector(){return buttons.download;}},
    showModal(title,html){if(current)current.isConnected=false;current={isConnected:true,toBlob(callback){callback({type:'image/png',size:1234});}};canvases.push(current);buttons={};for(const key of ['download','share']){const markup=html.match(new RegExp(`<button[^>]*data-cmd="${key}-card"[^>]*>`))[0];buttons[key]={disabled:/\sdisabled(?:[\s>])/.test(markup),textContent:'Preparing card…'};}},
    heroPortrait:()=>'/emperor.webp',chapterScene:()=>'/rome.webp',loadArt:()=>new Promise(resolve=>pending.push(resolve)),
    drawReignCard(canvas,values){draws.push({canvas,values});}
  });
  vm.runInContext(productionFunction('showShare'),context);
  const stale=context.showShare();const firstButtons=buttons;
  assert.equal(firstButtons.download.disabled,true);assert.equal(firstButtons.share.disabled,true);assert.equal(draws.length,0);
  const latest=context.showShare();const latestCanvas=current;
  pending[0]({id:'old-portrait'});pending[1]({id:'old-scene'});await stale;
  assert.equal(draws.length,0);assert.equal(buttons.download.disabled,true);assert.equal(context.shareFile,null);
  pending[2]({id:'portrait'});pending[3](null);await latest;
  assert.equal(draws.length,1);assert.equal(draws[0].canvas,latestCanvas);assert.equal(draws[0].values.portrait.id,'portrait');assert.equal(draws[0].values.scene,null);assert.equal(buttons.download.disabled,false);assert.equal(buttons.share.disabled,false);assert.equal(context.shareFile.name,'sacramentum-reign.png');assert.equal(JSON.stringify(campaign),before);
});
