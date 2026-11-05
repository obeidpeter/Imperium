// node scripts/steam-screenshots.mjs [--only id,…]: draft screenshots for the Steam store page (the Steam plan, S4), taken
// from the game itself at Steam's 1920 × 1080. They are drafts: take them again once 0.40.0 and the owner's Gate 4
// sign-off have settled what the game shows (docs/steam-store-art.md#the-screenshots-drafts).
// - Every moment is reached from New Game by legal commands. The real-time campaign bot (scripts/realtime-autoplay.mjs,
//   seed 275, Standard, the 'engaged' reference player of scripts/kit-policy.mjs) plays the campaign; a shot may take the
//   campaign of another seed, for its battle's weather. A camp is kept as the chronicle stands there, a promotion as the
//   chapter's last encounter is recorded. A battle is kept mid-fight as the game keeps one when play pauses, as a resume
//   point (Game.saveRealtime): at the moment within the shot's window when the most men are fighting near the soldier.
// - Every save code is restored through the game's own Restore dialog, in the desktop build (dist-desktop/: run
//   npm run build:desktop first) in headless Chromium. The page has the player's settings for real time at High quality,
//   and the shot is framed with the game's own controls: Pause, the − key's zoom, the held H's glance, the bar's Kit.
//   Nothing is injected into the page, and the script fails unless the shot is taken at High quality without page errors.
// - Software WebGL: a few minutes a shot. Needs Playwright (PLAYWRIGHT_MODULE), like the other browser scripts.
// Writes desktop/steam/screenshots/<id>.jpg, the record of each moment in docs/evidence/steam-screenshots.json, and a
// contact sheet in tests/visual-results/steam-screenshots/ (not committed).
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as G from '../src/core/game.js';
import {runRealtimeCampaign,playRealtime} from './realtime-autoplay.mjs';
import {readScreenshotRecord,recoverScreenshots,writeScreenshot,withCaptureLock} from './steam-capture-records.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
export const SIZE={width:1920,height:1080};
export const CAMPAIGN={seed:275,difficulty:'standard',kit:'engaged'};
export const SCREENSHOTS_DIR='desktop/steam/screenshots';
export const RECORD='docs/evidence/steam-screenshots.json';

// What each shot shows and how it is framed. `moment` is a camp before an encounter ({camp}), a Contest opened from its
// camp ({contest}), a chapter's promotion ceremony ({promotion}: its chapter), or a battle mid-fight ({fight, from, to}: the ticks the moment is chosen between). It may name a
// campaign seed of its own (`seed`) and the weather its battle must have (`weather`): a battle's weather is drawn from
// the seed, as a player's is. `frame` lists the
// player's own inputs, in order: pause, zoomOut (presses of the − key), glance (H held), panel (a button of the bar's
// panels), key, talk (a camp conversation), until (a selector the page must show), click (a control in it).
export const SCREENSHOTS=[
  {id:'01-river-crossing',caption:'Chapter VIII: the legion forces the ford at the far bank, in real time with pause',
    moment:{fight:'ch8-crossing',from:200,to:400,weather:'clear'},frame:[{pause:true},{zoomOut:5}]},
  {id:'02-finale',caption:'Chapter XII: the road to the purple, before the Aurelian Walls',
    moment:{fight:'ch12-confrontation',from:140,to:320,seed:276,weather:'clear'},frame:[{pause:true},{glance:true}]},
  {id:'03-curia',caption:'Chapter XI: the Senate’s Contest, walked and argued in the Curia',
    moment:{contest:'ch11-accounts'},frame:[]},
  {id:'04-cavalry',caption:'Chapter IX: the turning cavalry on the Euphrates',
    moment:{fight:'ch9-wing',from:240,to:560,weather:'clear'},frame:[{pause:true},{zoomOut:3}]},
  {id:'05-camp',caption:'Chapter V: the fortress camp before the red river gate',
    moment:{camp:'ch5-wall'},frame:[{glance:true}]},
  {id:'06-kit',caption:'The soldier’s kit in Chapter X’s camp: what he wears, carries and finds',
    moment:{camp:'ch10-tribunal'},frame:[{panel:'kit',until:'#modal[open] .inventory'},{click:'#modal [data-cmd="kit-select"][data-id="worn:weapon:0"]'}]},
  {id:'07-promotion',caption:'Chapter VI: the promotion to praefectus legionis, with its painting',
    moment:{promotion:6},frame:[]},
];
export const fileName=shot=>`${shot.id}.jpg`;

const clone=state=>G.deserialize(G.serialize(state));
const ALL_CHAPTERS=Array.from({length:12},(_,i)=>i+1);
// How much of the fight a Follow view round the soldier shows: men of both sides within 22 m of him, and those of his own
// side within reach of an enemy.
export function actionNear(world){
  const hero=world.actors.find(a=>a.id===world.heroId);if(!hero)return null;
  const near=world.actors.filter(a=>a.alive&&!a.down&&Math.hypot(a.x-hero.x,a.z-hero.z)<=22);
  const foes=near.filter(a=>a.side==='enemy'),friends=near.filter(a=>a.side!=='enemy');
  const engaged=friends.filter(f=>foes.some(e=>Math.hypot(e.x-f.x,e.z-f.z)<=2.6)).length;
  return {foes:foes.length,friends:friends.length,engaged};
}

/** Plays the campaign from New Game and keeps every shot's moment as a save code (deterministic: the same codes each run).
 * A shot may name a seed of its own (`moment.seed`); each seed's campaign is played once, for the shots that use it. */
export function earnMoments(shots=SCREENSHOTS,campaign=CAMPAIGN){
  const groups=new Map();for(const shot of shots){const seed=shot.moment.seed??campaign.seed;groups.set(seed,[...(groups.get(seed)??[]),shot]);}
  const earned=new Map();for(const [seed,group] of groups)for(const moment of earnFromSeed(group,{...campaign,seed}))earned.set(moment.shot.id,moment);
  return shots.map(shot=>earned.get(shot.id));
}
function earnFromSeed(shots,{seed,difficulty,kit}){
  const camps=new Map(),promotions=new Map(),fights=new Map(),wanted=new Map(shots.filter(s=>s.moment.fight).map(s=>[s.moment.fight,s.moment]));
  const run=runRealtimeCampaign({throughChapter:12,ready:ALL_CHAPTERS,seed,difficulty,kit,
    // A won encounter, recorded and promoted on a copy as the player would: the camp before the next encounter.
    onEncounter(state){
      const next=clone(state);if(!G.commitEncounter(next).ok)return;
      if(next.phase==='promotion'){if(!promotions.has(next.chapter))promotions.set(next.chapter,G.encodeSave(next));if(!G.advanceChapter(next).ok)return;}
      if(next.phase!=='camp')return;const id=G.getChapter(next).encounters[next.encounterIndex]?.id;if(id&&!camps.has(id))camps.set(id,G.encodeSave(next));
    },
    // A wanted battle: the fight kept every second within its window, as the game keeps it when play pauses.
    play(state,options){
      const moment=wanted.get(state.encounter.id);if(!moment)return playRealtime(state,options);
      let best=null;
      const summary=playRealtime(state,{...options,onTick(world){
        if(world.tick%20||world.tick<moment.from||world.tick>moment.to)return;
        const action=actionNear(world);if(!action||(best&&action.engaged<=best.action.engaged))return;
        const kept=clone(state);if(G.saveRealtime(kept,world).ok)best={tick:world.tick,action,weather:world.weather,code:G.encodeSave(kept)};
      }});
      if(summary.status==='won'&&best)fights.set(state.encounter.id,best);return summary;
    }});
  assert.equal(run.state.phase,'epilogue',`seed ${seed}: the campaign is played to its end`);
  return shots.map(shot=>{
    const m=shot.moment,id=m.fight??m.contest??m.camp??`promotion ${m.promotion}`;
    let code=m.fight?fights.get(id)?.code:m.promotion?promotions.get(m.promotion):camps.get(id);
    assert.ok(code,`${shot.id}: the campaign reaches ${id}`);
    if(m.contest){
      // A chapter's first Contest opens once its decision is taken: the one the bot takes, by the same legal command.
      const camp=G.decodeSave(code),decision=G.getChapter(camp).decision;
      if(!camp.decisions[decision.id]){assert.ok(G.choose(camp,decision.options[0].id).ok,`${shot.id}: the chapter's decision`);code=G.encodeSave(camp);}
      assert.ok(G.startEncounter(G.decodeSave(code),{controls:'realtime'}).ok,`${shot.id}: ${id} opens from its camp`);
    }
    const fight=m.fight?fights.get(id):null;
    if(m.weather)assert.equal(fight?.weather,m.weather,`${shot.id}: the battle is fought in ${m.weather} weather`);
    return {shot,seed,encounter:id,chapter:G.decodeSave(code).chapter,code,tick:fight?.tick??null,action:fight?.action??null,weather:fight?.weather??null};
  });
}

// In the page, once restored: counts the frames drawn and how far the camera moved in the last one.
function watchFrames(){
  const w=window.__steamShot={frames:0,moved:Infinity,last:null};
  const tick=()=>{const p=window.__chamber?.stage?.()?.camera?.position;
    if(p){if(w.last)w.moved=Math.hypot(p.x-w.last[0],p.y-w.last[1],p.z-w.last[2]);w.last=[p.x,p.y,p.z];}
    w.frames++;requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
}
const observe=page=>page.evaluate(()=>{const stage=window.__chamber?.stage?.();return {frames:window.__steamShot?.frames??0,moved:window.__steamShot?.moved??null,
  quality:document.documentElement.dataset.quality,stageQuality:stage?.stats?.().quality??null,view:stage?.cameraView??null,
  paused:window.__realtime?.paused?.()??null,tick:window.__realtime?.world?.()?.tick??null};});
// The camera at rest: it moved less than a centimetre in the last frame.
// A page with no 3D world (a ceremony) has no camera to wait for.
const settle=page=>page.evaluate(()=>{window.__steamShot.moved=Infinity;return !!window.__chamber?.stage?.();}).then(world=>world&&
  page.waitForFunction(()=>window.__steamShot.moved<0.01,null,{timeout:300000,polling:250}));
// Software WebGL draws every frame far over the game's budget, so after thirty frames the game steps its quality down on its
// own, as it would on a slow PC (graphics-quality.js). That changes the shadows and particles at once but not the world,
// which stays built at High. The player's own choice of High in Settings puts them back without rebuilding anything, and
// starts the thirty frames again; a shot is taken just after it.
async function chooseHigh(page,{menuCommand,closedBy,revealControl}){
  await menuCommand(page,'settings');await page.waitForSelector('#modal[open] .settings-nav');
  await (await revealControl(page,'#graphics-quality')).selectOption('high');
  await closedBy(page,()=>page.click('#modal [data-cmd="close-modal"] >> nth=0'));
}

async function take(browser,base,moment,{settings,navigation}){
  const {menuCommand,settingsCommand,closedBy,revealControl,settingsPage}=navigation,{shot}=moment;
  const context=await browser.newContext({viewport:SIZE,deviceScaleFactor:1});
  try{
    const page=await context.newPage();page.setDefaultTimeout(300000);
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    // The player's settings, as Settings stores them: real time, the 3D view at High quality, coaching off.
    await page.addInitScript(s=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify(s));}catch{}},settings);
    await page.goto(base);await settingsCommand(page,'restore');
    await page.fill('#restore-code',moment.code);await page.click('[data-cmd="import-code"]');
    await closedBy(page,()=>page.click('[data-cmd="confirm-import"]'));
    if(shot.moment.contest)await (await revealControl(page,'[data-cmd="start"]')).click();
    // A world is ready when its scene is; a ceremony when its painting is drawn, and drifting where the quality has it drift.
    const kind=shot.moment.fight?'field':shot.moment.contest?'chamber':shot.moment.promotion?null:'camp';
    if(kind)await page.waitForSelector(`.rt-field[data-kind="${kind}"] .rt-scene[data-ready="true"]`);
    else await page.waitForFunction(()=>{const img=document.querySelector('.cinematic-promotion .ceremony-scene img'),drift=document.querySelector('.cinematic-promotion .ceremony-scene canvas');
      return img?.complete&&img.naturalWidth>0&&(!drift||drift.dataset.ready==='true');});
    await page.evaluate(watchFrames);
    const started=Date.now(),note=what=>observe(page).then(o=>console.log(`  ${shot.id}: ${what} after ${((Date.now()-started)/1000).toFixed(0)} s, ${o.frames} frames, ${o.quality}, ${o.view??'no 3D'} view`));
    await note('ready');
    if(await page.evaluate(()=>document.querySelector('#modal')?.open))await page.click('#modal [data-cmd="close-modal"] >> nth=0');
    // The mouse rests on the page's top strip, where it points at nothing in the world.
    const rest=()=>page.mouse.move(SIZE.width/2,6);
    const glance=shot.frame.some(s=>s.glance),dialog=shot.frame.some(s=>s.talk||s.key||s.panel);
    for(const step of shot.frame){
      if(step.pause&&!await page.evaluate(()=>window.__realtime.paused()))await page.click('[data-role="pauseButton"]');
      // The − key zooms out two metres a press, with the mouse kept off the world, so the bar shows no walk to it.
      if(step.zoomOut){await settle(page);await page.locator('#rt-board').focus();for(let i=0;i<step.zoomOut;i++)await page.keyboard.press('Minus');}
    }
    await rest();await settle(page);await note('settled');
    let image,seen;
    for(let attempt=1;attempt<=3;attempt++){
      // Settings first, then what it would close or end: a dialog, or the held H's glance, which lowers the view toward
      // the chapter's landmark for as long as the key is held. A dialog's world behind it stands still. A page with no 3D
      // world (a ceremony) has no quality to put back.
      if(kind)await chooseHigh(page,navigation);
      for(const step of shot.frame){
        if(step.key){await page.locator('#rt-board').focus();await page.keyboard.press(step.key);}
        if(step.panel)await navigation.fieldPanel(page,step.panel);
        if(step.talk){await (await revealControl(page,`[data-cmd="conversation"][data-id="${step.talk}"]`)).click();await page.waitForSelector('#modal[open] [data-cmd="reply"]');}
        if(step.until)await page.waitForSelector(step.until);
        if(step.click)await page.click(step.click);
      }
      if(dialog)await rest();
      // A figure of the soldier on the page (a ceremony's) says when it is drawn.
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-preview-status]')].every(e=>!e.offsetParent||!/^Preparing/.test(e.textContent)),null,{timeout:300000});
      if(glance){await page.keyboard.down('h');await settle(page);}
      const before=await observe(page);
      image=await page.screenshot({type:'jpeg',quality:90,timeout:600000});
      seen=await observe(page);await note(`taken (attempt ${attempt}, from ${before.quality} to ${seen.quality})`);
      if(glance)await page.keyboard.up('h');
      // Taken through and through at High: the quality did not step down while the shot was taken.
      if(before.quality==='high'&&seen.quality==='high')break;
      if(dialog)await closedBy(page,()=>page.click('#modal [data-cmd="close-modal"] >> nth=0'));
    }
    assert.equal(seen.quality,'high',`${shot.id}: the page is at High quality (${JSON.stringify(seen)})`);
    if(seen.stageQuality)assert.equal(seen.stageQuality,'high',`${shot.id}: the 3D view draws at High quality`);
    if(glance)assert.equal(seen.view,'horizon',`${shot.id}: the view glances at the horizon`);
    if(shot.moment.fight)assert.equal(seen.paused,true,`${shot.id}: the fight is paused`);
    assert.deepEqual(errors,[],`${shot.id}: no page errors`);
    return {image,seen};
  }finally{await context.close();}
}

async function main(){
  const recovered=await recoverScreenshots(root);
  if(process.argv.includes('--recover')){console.log(recovered?'Recovered the interrupted screenshot and its record.':'No interrupted screenshot to recover.');return;}
  const arg=name=>{const i=process.argv.indexOf(`--${name}`);return i<0?null:process.argv[i+1];};
  const only=arg('only')?.split(',')??null,shots=only?SCREENSHOTS.filter(s=>only.includes(s.id)):SCREENSHOTS;
  assert.ok(!only||only.every(id=>SCREENSHOTS.some(s=>s.id===id)),'--only contains an unknown screenshot');
  assert.ok(shots.length,'--only names no screenshot');
  const dist=join(root,'dist-desktop');
  await access(join(dist,'index.html')).catch(()=>{throw new Error('Build the desktop edition first: npm run build:desktop');});
  const build=JSON.parse(await readFile(join(dist,'build-report.json'),'utf8'));
  assert.equal(build.target,'desktop','Capture the desktop build');
  let record=await readScreenshotRecord(root)??{method:'From New Game by legal commands: the real-time campaign bot with the engaged reference player. '+
    'Each save is restored through the desktop build’s Restore dialog in Chromium, at High quality, and framed with the game’s controls. Drafts, to take again after 0.40.0.',
    campaign:CAMPAIGN,size:SIZE,screenshots:[]};
  let pw;for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean))try{const m=await import(isAbsolute(p)?pathToFileURL(p).href:p);pw=m.chromium?m:m.default;break;}catch{}
  assert.ok(pw?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright.');
  const {serveRequest}=await import('./serve.mjs'),navigation=await import('./ui-smoke-navigation.mjs');
  const started=Date.now(),moments=earnMoments(shots);
  console.log(`Earned ${moments.length} moments from New Game in ${((Date.now()-started)/1000).toFixed(0)} s.`);
  const server=http.createServer((req,res)=>serveRequest(req,res,dist));await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const browser=await pw.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const settings={controlsModel:'realtime',controlsChosen:true,battleView:'3d',quality:'high',qualityChoice:'high',adaptiveResolution:false,coach:false};
  try{
    await mkdir(join(root,SCREENSHOTS_DIR),{recursive:true});
    for(const moment of moments){
      const t=Date.now(),{image,seen}=await take(browser,`http://127.0.0.1:${server.address().port}/`,moment,{settings,navigation});
      const entry={id:moment.shot.id,file:`${SCREENSHOTS_DIR}/${fileName(moment.shot)}`,caption:moment.shot.caption,chapter:moment.chapter,
        encounter:moment.encounter,seed:moment.seed,weather:moment.weather,moment:moment.shot.moment.fight?`mid-fight, tick ${moment.tick} (${moment.action.engaged} of the soldier's side fighting within 22 m)`
          :moment.shot.moment.contest?'the Contest as it opens':moment.shot.moment.promotion?'the promotion ceremony at the chapter\'s end':'the camp before the encounter',
        saveSha256:createHash('sha256').update(moment.code).digest('hex'),frame:moment.shot.frame,
        captured:{quality:seen.quality,view:seen.view,paused:seen.paused,tick:seen.tick,build:build.revision}};
      record=await writeScreenshot(root,record,entry,image);
      console.log(`${moment.shot.id}: Chapter ${moment.chapter}, ${moment.encounter}${moment.tick===null?'':` at tick ${moment.tick}`}, ${seen.view??'no 3D'} view, ${seen.quality}, ${((Date.now()-t)/1000).toFixed(0)} s.`);
    }
    // The contact sheet: every screenshot at a third of its size, in Steam's order, with its caption.
    const images=[];for(const s of SCREENSHOTS)images.push(await readFile(join(root,SCREENSHOTS_DIR,fileName(s))).then(b=>({caption:`${s.id} · ${s.caption}`,src:`data:image/jpeg;base64,${b.toString('base64')}`}),()=>null));
    const page=await browser.newPage();
    const sheet=await page.evaluate(async list=>{
      const w=640,h=360,gap=20,cols=2,rows=Math.ceil(list.length/cols),c=document.createElement('canvas');c.width=cols*w+(cols+1)*gap;c.height=rows*(h+40)+gap;
      const x=c.getContext('2d');x.fillStyle='#2b2925';x.fillRect(0,0,c.width,c.height);x.font='15px sans-serif';
      for(const [i,item] of list.entries()){const px=gap+(i%cols)*(w+gap),py=gap+Math.floor(i/cols)*(h+40);x.fillStyle='#f3ead6';x.fillText(item?.caption??'(missing)',px,py+h+22);
        if(!item)continue;const img=new Image();img.src=item.src;await img.decode();x.drawImage(img,px,py,w,h);}
      return c.toDataURL('image/png');
    },images);
    const review=join(root,'tests/visual-results/steam-screenshots');await mkdir(review,{recursive:true});
    await writeFile(join(review,'contact-sheet.png'),Buffer.from(sheet.slice(sheet.indexOf(',')+1),'base64'));
  }finally{await browser.close();server.close();}
  console.log(`Wrote ${moments.length} screenshots to ${SCREENSHOTS_DIR}/ and the record to ${RECORD}.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await withCaptureLock(root,main);
