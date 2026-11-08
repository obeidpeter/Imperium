// node scripts/steam-trailer.mjs [--only id,…] [--cut] [--recover]: the draft trailer for the Steam store page (the Steam
// plan, S4), recorded from the game itself and cut to Steam's trailer specification as reported: 1920 × 1080 at 30
// frames a second, H.264 video and AAC sound in an MP4, at more than 5,000 kbps. It has the game's own battle music and
// no voice-over. It is a draft: record it again once 0.40.0 and the owner's Gate 4 sign-off have settled what the game
// shows (docs/steam-store-art.md#the-trailer-a-draft).
// - Every clip starts from a moment reached from New Game by legal commands, as the screenshots' do
//   (scripts/steam-screenshots.mjs): the real-time campaign bot plays the campaign as the engaged reference player, seed
//   275 on Standard. A battle is kept mid-fight as the game keeps one when play pauses, a camp as the chronicle stands
//   there, a Contest as it opens, a promotion as the chapter's last encounter is recorded.
// - Each save is restored through the desktop build's Restore dialog (dist-desktop/: run npm run build:desktop first) in
//   headless Chromium, with the player's settings for real time at High quality. The clip then plays on with the
//   player's own keys: T and Enter (attack the nearest enemy), the − key's zoom, the held H's glance at the horizon.
//   Nothing is injected into the page, and no request may leave it.
// - Software WebGL takes seconds to draw a frame, so the page keeps Playwright's clock (clock.install). Once the
//   restored world is ready, time stands still between frames and moves on by 1/30 s for each one, so a frame shows
//   1/30 s of play however long it took to draw. The game, its rules and its commands are untouched: only the wait
//   between frames changes. The script fails unless every frame was drawn at High quality, without page errors.
// - Needs Playwright (PLAYWRIGHT_MODULE) and ffmpeg (FFMPEG, or ffmpeg on the PATH), like the other development tools;
//   neither is a project dependency. About five seconds a frame in software rendering: an hour and a half on four cores.
// Writes desktop/steam/trailer/draft.mp4 and its record, docs/evidence/steam-trailer.json. Each clip is kept in
// tests/visual-results/steam-trailer/ (not committed): --cut cuts the trailer again from them without recording.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {access,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CAMPAIGN,SIZE,earnMoments} from './steam-screenshots.mjs';
import {CAPTURE_KINDS,readCaptureRecord,recoverCapture,writeCapture,withCaptureLock} from './steam-capture-records.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const KIND=CAPTURE_KINDS.trailer;
export const RECORD=KIND.record;
export const FPS=30;
// Each clip fades into the next over half a second; the last into the end card, the game's library logo on black.
export const FADE=0.5;
export const MUSIC='assets/audio/music-battle.mp3';
export const END_CARD={logo:'desktop/steam/store-art/library_logo.png',seconds:4};
export const TRAILER={id:'draft',file:`${KIND.dir}/draft.mp4`,caption:'Draft trailer: from the ford of Chapter VIII to the Aurelian Walls'};
export const CLIPS_DIR='tests/visual-results/steam-trailer';
// Loudness for the web, and the bit rate floor Steam reports for a trailer. The video is encoded in two passes at a fifth
// above that floor, so the file's size is known beforehand (about 26 MB for the draft) and the bit rate is spent where the
// pictures need it.
export const LOUDNESS={integrated:-16,truePeak:-1.5,range:11};
export const MIN_KBPS=5000;
export const VIDEO_KBPS=6000;

// The clips, in the trailer's order. `moment` is a screenshot's (scripts/steam-screenshots.mjs): a battle mid-fight
// ({fight, from, to}, with the seed and weather it needs), a camp before an encounter ({camp}), a Contest as it opens
// ({contest}) or a chapter's promotion ({promotion}). `play` lists the player's keys, each at a second of the clip: keys
// pressed in turn on the scene (T and Enter attack the nearest enemy; − and = zoom out and in two metres a press), or a key held
// (hold) from then to the clip's end (H glances toward the horizon's landmark). Keys at 0 are given in a pause before
// the clip starts. `lead` plays that many seconds of a page with no world before recording.
export const CLIPS=[
  {id:'river-crossing',caption:'Chapter VIII: the legion forces the ford at the far bank',seconds:6,
    moment:{fight:'ch8-crossing',from:200,to:400,weather:'clear'},play:[{at:0,keys:['KeyT','Enter']},{at:2,keys:['Minus','Minus','Minus']}]},
  {id:'camp',caption:'Chapter V: the fortress camp before the red river gate',seconds:5,
    moment:{camp:'ch5-wall'},play:[{at:1.5,hold:'KeyH'}]},
  {id:'promotion',caption:'Chapter VI: the promotion to praefectus legionis, with its painting',seconds:4,
    moment:{promotion:6},lead:3,play:[]},
  {id:'cavalry',caption:'Chapter IX: the turning cavalry on the Euphrates',seconds:6,
    moment:{fight:'ch9-wing',from:240,to:560,weather:'clear'},play:[{at:0,keys:['KeyT','Enter']},{at:2,keys:['Minus','Minus','Minus']}]},
  {id:'curia',caption:'Chapter XI: the Senate’s Contest in the Curia',seconds:5,
    moment:{contest:'ch11-accounts'},play:[{at:1,keys:['Equal','Equal']}]},
  {id:'finale',caption:'Chapter XII: the road to the purple, before the Aurelian Walls',seconds:7,
    moment:{fight:'ch12-confrontation',from:140,to:320,seed:276,weather:'clear'},play:[{at:0,keys:['KeyT','Enter']},{at:3.5,hold:'KeyH'}]},
];
export const frames=clip=>Math.round(clip.seconds*FPS);
// The cut's length: the clips and the end card, less a fade's overlap at each join.
export const trailerSeconds=(clips=CLIPS)=>clips.reduce((n,c)=>n+c.seconds,0)+END_CARD.seconds-clips.length*FADE;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

// The size, length, frame rate and streams of an MP4, read from its boxes (ISO/IEC 14496-12), for the tests.
export function mp4Info(bytes){
  const boxes=(start,end)=>{
    const out=[];
    for(let at=start;at+8<=end;){
      let size=bytes.readUInt32BE(at),head=8;const type=bytes.toString('latin1',at+4,at+8);
      if(size===1){size=Number(bytes.readBigUInt64BE(at+8));head=16;}else if(size===0)size=end-at;
      if(size<head||at+size>end)throw new Error(`A malformed MP4 box: ${type}`);
      out.push({type,start:at+head,end:at+size});at+=size;
    }
    return out;
  };
  const child=(box,type)=>{const found=boxes(box.start,box.end).find(b=>b.type===type);if(!found)throw new Error(`No ${type} box`);return found;};
  // mvhd and mdhd: a version byte, then the time scale and duration after two dates of 4 or 8 bytes.
  const timing=box=>{const v=bytes[box.start];return {scale:bytes.readUInt32BE(box.start+(v?20:12)),length:v?Number(bytes.readBigUInt64BE(box.start+24)):bytes.readUInt32BE(box.start+16)};};
  const moov=boxes(0,bytes.length).find(b=>b.type==='moov');if(!moov)throw new Error('No moov box');
  const movie=timing(child(moov,'mvhd'));
  const tracks=boxes(moov.start,moov.end).filter(b=>b.type==='trak').map(trak=>{
    const mdia=child(trak,'mdia'),hdlr=child(mdia,'hdlr'),handler=bytes.toString('latin1',hdlr.start+8,hdlr.start+12),media=timing(child(mdia,'mdhd'));
    const stbl=child(child(mdia,'minf'),'stbl'),stsd=child(stbl,'stsd'),entry=boxes(stsd.start+8,stsd.end)[0];
    const track={handler,codec:entry.type,seconds:media.length/media.scale};
    if(handler==='vide'){
      track.width=bytes.readUInt16BE(entry.start+24);track.height=bytes.readUInt16BE(entry.start+26);
      const stts=child(stbl,'stts');let count=0;for(let i=0,n=bytes.readUInt32BE(stts.start+4);i<n;i++)count+=bytes.readUInt32BE(stts.start+8+i*8);
      track.frames=count;track.fps=count/track.seconds;
    }
    if(handler==='soun'){track.channels=bytes.readUInt16BE(entry.start+16);track.sampleRate=bytes.readUInt32BE(entry.start+24)>>>16;}
    return track;
  });
  return {seconds:movie.length/movie.scale,tracks};
}

// ffmpeg, given its arguments; resolves with what it printed to stderr. With `input`, frames are written to its stdin.
function ffmpeg(args,{input}={}){
  const child=spawn(process.env.FFMPEG||'ffmpeg',['-hide_banner','-nostdin',...args],{stdio:[input?'pipe':'ignore','ignore','pipe']});
  let log='';child.stderr.on('data',d=>{log=(log+d).slice(-20000);});
  const done=new Promise((resolve,reject)=>{
    child.on('error',error=>reject(new Error(`ffmpeg could not start (${error.message}): install it, or set FFMPEG.`)));
    child.on('close',code=>code===0?resolve(log):reject(new Error(`ffmpeg failed (${code}):\n${log}`)));
  });
  if(!input)return done;
  return {done,async write(bytes){if(!child.stdin.write(bytes))await new Promise(r=>child.stdin.once('drain',r));},end(){child.stdin.end();return done;}};
}

// Records one clip: the save restored through the Restore dialog, then frame by frame on Playwright's clock. Returns
// what the clip's record says about it; its frames go to ffmpeg as JPEG and come out as a near-lossless clip to cut.
async function recordClip(browser,base,moment,{settings,navigation,file,limit}){
  const {menuCommand,settingsCommand,closedBy,revealControl}=navigation,clip=moment.shot;
  const kind=clip.moment.fight?'field':clip.moment.contest?'chamber':clip.moment.promotion?null:'camp';
  const context=await browser.newContext({viewport:SIZE,deviceScaleFactor:1}),outside=[];
  // The page is the game alone: a request to anywhere but the local copy of the desktop build fails the clip.
  await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(base)||/^(data|blob):/.test(url))return route.continue();outside.push(url);return route.abort();});
  // Time flows as usual until the world is ready; then it moves only when a frame is drawn.
  await context.clock.install();
  try{
    const page=await context.newPage();page.setDefaultTimeout(600000);
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(s=>{try{localStorage.setItem('sacramentum.settings',JSON.stringify(s));}catch{}},settings);
    await page.goto(base);await settingsCommand(page,'restore');
    await page.fill('#restore-code',moment.code);await page.click('[data-cmd="import-code"]');
    await closedBy(page,()=>page.click('[data-cmd="confirm-import"]'));
    if(clip.moment.contest)await (await revealControl(page,'[data-cmd="start"]')).click();
    if(kind)await page.waitForSelector(`.rt-field[data-kind="${kind}"] .rt-scene[data-ready="true"]`);
    else await page.waitForFunction(()=>{const img=document.querySelector('.cinematic-promotion .ceremony-scene img'),drift=document.querySelector('.cinematic-promotion .ceremony-scene canvas');
      return img?.complete&&img.naturalWidth>0&&(!drift||drift.dataset.ready==='true');});
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-preview-status]')].every(e=>!e.offsetParent||!/^Preparing/.test(e.textContent)));
    // From here time stands still between frames. While it flowed, slow frames held the page's clock back, and once it
    // stops the page's next animation frames can fall due seconds after the time it reads. One step to the last of them
    // draws each once; from there every step below draws one frame. (Playwright's clock keeps its timers in
    // __pwClock.controller; the scene's own last frame time stands in where that is missing.)
    await page.clock.pauseAt(Math.max(await page.evaluate(()=>Date.now()),Date.now())+500);
    // How far past the clock the page's next animation frame is due, or the scene last drew. A frame just asked for is
    // due within one display frame (16 ms): that is in step.
    const behind=()=>page.evaluate(()=>{const c=window.__pwClock?.controller,s=window.__chamber?.stage?.();
      const due=c?._timers&&c._now?[...c._timers.values()].filter(t=>t.type==='AnimationFrame').map(t=>t.callAt-c._now.ticks):[];
      if(Number.isFinite(s?.lastPaint)&&s.lastPaint>0)due.push(s.lastPaint-performance.now());
      return Math.max(0,...due);});
    for(let tries=0,ahead=await behind();ahead>17;tries++,ahead=await behind()){
      assert.ok(tries<3,`${clip.id}: the page's frames fall due on its clock (${Math.round(ahead)} ms ahead)`);await page.clock.fastForward(Math.ceil(ahead)+1);
    }
    const frameId=()=>page.evaluate(()=>window.__chamber?.stage?.()?.frame??null),before=await frameId();
    await page.clock.fastForward(Math.round(1000/FPS));
    if(before!==null)assert.notEqual(await frameId(),before,`${clip.id}: the scene draws on the page's clock`);
    const look=()=>page.evaluate(()=>{const stage=window.__chamber?.stage?.(),world=window.__realtime?.world?.();
      return {quality:document.documentElement.dataset.quality,stageQuality:stage?.stats?.().quality??null,tick:world?.tick??null,modal:!!document.querySelector('#modal')?.open,
        announcement:document.querySelector('#announcement')?.textContent||''};});
    if((await look()).modal)await page.click('#modal [data-cmd="close-modal"] >> nth=0');
    // The mouse rests on the page's top strip, where it points at nothing in the world.
    const rest=()=>page.mouse.move(SIZE.width/2,6);await rest();
    const pending=[...clip.play].sort((a,b)=>a.at-b.at),held=[];
    const give=async input=>{
      if(kind)await page.locator('#rt-board').focus();
      for(const key of input.keys??[])await page.keyboard.press(key);
      if(input.hold){await page.keyboard.down(input.hold);held.push(input.hold);}
      await rest();
    };
    // P pauses the world while the camera comes to rest on the soldier, as it does once a restored world has loaded,
    // and the clip's first keys are given in that pause, as a player gives orders; P then resumes it.
    const paused=()=>page.evaluate(()=>window.__realtime?.paused?.()??null);
    const toggle=async want=>{await page.locator('#rt-board').focus();await page.keyboard.press('KeyP');
      assert.equal(await paused(),want,`${clip.id}: P ${want?'pauses':'resumes'} the world`);};
    const running=kind&&await paused()===false;if(running)await toggle(true);
    // The paused world draws on until the camera rests, a tenth of a second a frame.
    const camera=()=>page.evaluate(()=>{const p=window.__chamber?.stage?.()?.camera?.position;return p?[p.x,p.y,p.z]:null;});
    const settle=async(least=0)=>{
      for(let steps=0,last=await camera();last&&steps<least+60;steps++){
        await page.clock.fastForward(100);const now=await camera();const moved=Math.hypot(...now.map((v,k)=>v-last[k]));last=now;if(steps>=least&&moved<0.01)break;
      }
    };
    if(kind){
      // The game judges its quality on its last 30 frames' costs (src/ui/graphics-quality.js). Those drawn while time
      // flowed took seconds each in software rendering, so they would step it down, as on a slow PC. The first 32 frames
      // on the stopped clock take no time on it, and leave none of those in its count.
      await settle(32);
      // If it stepped down meanwhile, the player's own choice of High in Settings puts it back without rebuilding the world.
      if((await look()).quality!=='high'){
        await menuCommand(page,'settings');await page.waitForSelector('#modal[open] .settings-nav');
        await (await revealControl(page,'#graphics-quality')).selectOption('high');
        await closedBy(page,()=>page.click('#modal [data-cmd="close-modal"] >> nth=0'));await rest();await settle();
      }
      const now=await look();
      assert.equal(now.quality,'high',`${clip.id}: the clip starts at High quality (${JSON.stringify(now)})`);
      if(running)assert.equal(await paused(),true,`${clip.id}: the world stays paused until the clip starts`);
    }
    while(pending.length&&pending[0].at<=0)await give(pending.shift());
    if(running)await toggle(false);
    // A page with no world to pause (a ceremony) plays its first seconds unrecorded: the restored chronicle's notice
    // clears, and the ceremony has settled.
    for(let t=0;t<(clip.lead??0)*1000;t+=100)await page.clock.fastForward(100);
    const start=await look(),count=Math.min(frames(clip),limit??Infinity),out=ffmpeg(['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-',
      '-c:v','libx264','-preset','fast','-crf','12','-pix_fmt','yuv420p','-r',String(FPS),file],{input:true});
    let shown=0;
    try{
      for(let i=0;i<count;i++){
        // The player's keys due by this frame, pressed on the scene while time stands still.
        while(pending.length&&pending[0].at<=i/FPS)await give(pending.shift());
        // 1/30 s of play, drawn once: the page's next frame falls due and is drawn, and no other.
        const at=Math.round((i+1)*1000/FPS);await page.clock.fastForward(at-shown);shown=at;
        await out.write(await page.screenshot({type:'jpeg',quality:95,timeout:600000}));
        if(kind){const now=await look();assert.equal(now.quality,'high',`${clip.id}: frame ${i+1} is drawn at High quality (${JSON.stringify(now)})`);}
        if(i%30===29||i===count-1)process.stdout.write(`  ${clip.id}: ${i+1} of ${count} frames\n`);
      }
    }finally{for(const key of held)await page.keyboard.up(key);await out.end();}
    const end=await look();
    if(kind)assert.equal(end.stageQuality,'high',`${clip.id}: the 3D view draws at High quality`);
    assert.deepEqual(errors,[],`${clip.id}: no page errors`);
    assert.deepEqual(outside,[],`${clip.id}: no request leaves the page`);
    return {frames:count,ticks:kind?[start.tick,end.tick]:null,quality:end.quality};
  }finally{await context.close();}
}

// The trailer: the clips joined by fades, the end card, and the battle music measured and set to the web's loudness.
export async function cutTrailer(clips,file,dir=join(root,CLIPS_DIR)){
  const total=trailerSeconds(clips),music=join(root,MUSIC);
  const fadeOut=Math.min(3,END_CARD.seconds),musicFilter=`atrim=0:${total},afade=t=in:d=0.4,afade=t=out:st=${(total-fadeOut).toFixed(3)}:d=${fadeOut}`;
  const target=`I=${LOUDNESS.integrated}:TP=${LOUDNESS.truePeak}:LRA=${LOUDNESS.range}`;
  const log=await ffmpeg(['-stream_loop','-1','-i',music,'-t',String(total),'-af',`${musicFilter},loudnorm=${target}:print_format=json`,'-f','null','-']);
  const m=JSON.parse(log.slice(log.lastIndexOf('{'),log.lastIndexOf('}')+1));
  const loudnorm=`loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const inputs=clips.flatMap(c=>['-i',join(dir,`${c.id}.mp4`)]),n=clips.length;
  const graph=[...clips.map((c,i)=>`[${i}:v]setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p,setsar=1[c${i}]`),
    `color=c=black:s=${SIZE.width}x${SIZE.height}:r=${FPS}:d=${END_CARD.seconds}[bg]`,
    `[bg][${n}:v]overlay=x=(W-w)/2:y=(H-h)/2:shortest=1,format=yuv420p,setsar=1,fade=t=in:st=0:d=1,fade=t=out:st=${END_CARD.seconds-1}:d=1[card]`];
  let joined='c0',length=clips[0].seconds;
  for(let i=1;i<=n;i++){
    const next=i<n?`c${i}`:'card',name=i<n?`x${i}`:'xv';
    graph.push(`[${joined}][${next}]xfade=transition=fade:duration=${FADE}:offset=${(length-FADE).toFixed(3)}[${name}]`);
    joined=name;length+=(i<n?clips[i].seconds:END_CARD.seconds)-FADE;
  }
  graph.push(`[xv]fade=t=in:st=0:d=0.5[v]`);
  const pictures=[...inputs,'-loop','1','-framerate',String(FPS),'-t',String(END_CARD.seconds),'-i',join(root,END_CARD.logo)],passes=join(dir,'trailer-x264');
  const x264=['-c:v','libx264','-preset','slow','-profile:v','high','-b:v',`${VIDEO_KBPS}k`,'-pix_fmt','yuv420p','-r',String(FPS),'-g',String(FPS),'-passlogfile',passes];
  try{
    // The first pass measures the pictures alone; the second encodes them by that measure, with the music under them.
    await ffmpeg(['-y','-loglevel','error',...pictures,'-filter_complex',graph.join(';'),'-map','[v]','-t',String(total),...x264,'-pass','1','-an','-f','null','-']);
    await ffmpeg(['-y','-loglevel','error',...pictures,'-stream_loop','-1','-i',music,
      '-filter_complex',[...graph,`[${n+1}:a]${musicFilter},${loudnorm},aresample=48000[a]`].join(';'),'-map','[v]','-map','[a]','-t',String(total),...x264,'-pass','2',
      '-c:a','aac','-b:a','192k','-ac','2','-ar','48000','-map_metadata','-1','-movflags','+faststart',file]);
  }finally{for(const end of ['-0.log','-0.log.mbtree','-0.log.temp','-0.log.mbtree.temp'])await rm(passes+end,{force:true});}
  return {seconds:total,videoKbps:VIDEO_KBPS,loudness:{target:{...LOUDNESS},measured:{integrated:Number(m.input_i),truePeak:Number(m.input_tp),range:Number(m.input_lra)}}};
}

async function main(){
  const recovered=await recoverCapture(root,KIND);
  if(process.argv.includes('--recover')){console.log(recovered?'Recovered the interrupted trailer and its record.':'No interrupted trailer to recover.');return;}
  const arg=name=>{const i=process.argv.indexOf(`--${name}`);return i<0?null:process.argv[i+1];};
  const only=arg('only')?.split(',')??null,cutOnly=process.argv.includes('--cut'),limit=arg('frames')?Number(arg('frames')):null;
  assert.ok(!only||only.every(id=>CLIPS.some(c=>c.id===id)),'--only contains an unknown clip');
  const dist=join(root,'dist-desktop');
  await access(join(dist,'index.html')).catch(()=>{throw new Error('Build the desktop edition first: npm run build:desktop');});
  const build=JSON.parse(await readFile(join(dist,'build-report.json'),'utf8'));
  assert.equal(build.target,'desktop','Record the desktop build');
  await ffmpeg(['-version']);
  const clipsDir=join(root,CLIPS_DIR);await mkdir(clipsDir,{recursive:true});
  const kept=async clip=>JSON.parse(await readFile(join(clipsDir,`${clip.id}.json`),'utf8').catch(()=>'null'));
  const started=Date.now(),moments=earnMoments(CLIPS);
  console.log(`Earned ${moments.length} moments from New Game in ${((Date.now()-started)/1000).toFixed(0)} s.`);
  // A clip is recorded again when asked, or when what it would show has changed: its save, its keys or the build.
  const plan=[];
  for(const moment of moments){
    const clip=moment.shot,saveSha256=sha256(moment.code),old=await kept(clip),current=!!old&&old.saveSha256===saveSha256&&old.build===build.revision
      &&old.frames===frames(clip)&&JSON.stringify(old.play)===JSON.stringify(clip.play)&&(old.lead??0)===(clip.lead??0);
    plan.push({moment,saveSha256,current,record:only?only.includes(clip.id):!current&&!cutOnly});
  }
  const wanted=plan.filter(p=>p.record);
  if(wanted.length){
    let pw;for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean))try{const m=await import(isAbsolute(p)?pathToFileURL(p).href:p);pw=m.chromium?m:m.default;break;}catch{}
    assert.ok(pw?.chromium,'Set PLAYWRIGHT_MODULE to an installed Playwright.');
    const {serveRequest}=await import('./serve.mjs'),navigation=await import('./ui-smoke-navigation.mjs');
    const server=http.createServer((req,res)=>serveRequest(req,res,dist));await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const browser=await pw.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
    const settings={controlsModel:'realtime',controlsChosen:true,battleView:'3d',quality:'high',qualityChoice:'high',adaptiveResolution:false,coach:false};
    try{
      for(const {moment,saveSha256} of wanted){
        const clip=moment.shot,t=Date.now(),file=join(clipsDir,`${clip.id}.mp4`);
        const seen=await recordClip(browser,`http://127.0.0.1:${server.address().port}/`,moment,{settings,navigation,file,limit});
        const entry={id:clip.id,caption:clip.caption,chapter:moment.chapter,encounter:moment.encounter,seed:moment.seed,weather:moment.weather,
          moment:clip.moment.fight?`mid-fight from tick ${moment.tick} (${moment.action.engaged} of the soldier's side fighting within 22 m)`
            :clip.moment.contest?'the Contest as it opens':clip.moment.promotion?'the promotion ceremony at the chapter\'s end':'the camp before the encounter',
          saveSha256,seconds:clip.seconds,frames:seen.frames,lead:clip.lead??0,play:clip.play,ticks:seen.ticks,quality:seen.quality,build:build.revision};
        await writeFile(join(clipsDir,`${clip.id}.json`),JSON.stringify(entry,null,1)+'\n');
        console.log(`${clip.id}: Chapter ${moment.chapter}, ${moment.encounter}, ${seen.frames} frames${seen.ticks?`, ticks ${seen.ticks.join('–')}`:''}, ${((Date.now()-t)/60000).toFixed(1)} min.`);
      }
    }finally{await browser.close();server.close();}
  }
  if(limit){console.log('Recorded the first frames only (--frames): the trailer is not cut.');return;}
  // Every clip of the cut shows the current save, keys and build.
  const stale=plan.filter(p=>!p.record&&!p.current).map(p=>p.moment.shot.id);
  assert.deepEqual(stale,[],`Record these clips again before cutting: node scripts/steam-trailer.mjs --only ${stale.join(',')}`);
  const clips=[];for(const clip of CLIPS){const entry=await kept(clip);assert.ok(entry?.frames===frames(clip),`${clip.id}: recorded in full`);clips.push(entry);}
  const cutFile=join(clipsDir,'trailer.mp4'),cut=await cutTrailer(CLIPS,cutFile,clipsDir);
  const bytes=await readFile(cutFile),info=mp4Info(bytes),kbps=Math.round(bytes.length*8/info.seconds/1000),video=info.tracks.find(t=>t.handler==='vide');
  assert.deepEqual({width:video.width,height:video.height},SIZE,'The trailer is 1920 × 1080');
  assert.ok(kbps>=MIN_KBPS,`The trailer's bit rate, ${kbps} kbps, is at least ${MIN_KBPS} kbps`);
  const record=await readCaptureRecord(root,KIND)??{method:'Each clip starts from a save reached from New Game by legal commands (the real-time campaign bot, the engaged reference player), '+
    'restored through the desktop build’s Restore dialog in Chromium at High quality and played on with the player’s own keys. Playwright’s clock moves the page on by 1/30 s a frame. A draft, to record again after 0.40.0.',
    campaign:CAMPAIGN,size:SIZE,fps:FPS,trailers:[]};
  const musicBytes=await readFile(join(root,MUSIC)),logoBytes=await readFile(join(root,END_CARD.logo));
  await writeCapture(root,KIND,record,{...TRAILER,seconds:Number(info.seconds.toFixed(3)),kbps,videoKbps:cut.videoKbps,
    music:{file:MUSIC,sha256:sha256(musicBytes),loudness:cut.loudness},endCard:{...END_CARD,sha256:sha256(logoBytes)},fade:FADE,clips},bytes);
  console.log(`Wrote ${TRAILER.file}: ${info.seconds.toFixed(1)} s at ${kbps} kbps, and its record ${RECORD}.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await withCaptureLock(root,main,KIND);
