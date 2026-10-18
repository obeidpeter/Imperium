// Development-only screenshot regression for the 3D and 2D presentations.
// Drives the existing browser harnesses on legally reached checkpoints with
// reduced motion (frozen clocks), records baselines, then compares later runs
// pixel by pixel inside the browser. Not part of npm test: it needs Playwright
// and a browser, and software WebGL renders differ between machines, so keep
// baselines per machine.
//
//   node scripts/visual-regression.mjs --record     save baselines
//   node scripts/visual-regression.mjs              compare against them
//   options: --scenes=ch1-road,ch11-accounts  --boards=board-ch1-road  --quality=balanced
//            --threshold=0.02 (fraction of changed pixels allowed)  --baseline=DIR  --out=DIR
import http from 'node:http';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {serveRequest} from './serve.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const [key,...value]=arg.replace(/^--/,'').split('=');return [key,value.length?value.join('='):true];}));
const baselineDir=args.baseline??`${root}tests/visual-baselines`,outDir=args.out??`${root}tests/visual-results`;
const threshold=Number(args.threshold??0.02),quality=args.quality??'balanced';
const scenes=args.scenes?String(args.scenes).split(','):['ch1-training','ch1-road','ch2-marsh','ch3-station','ch4-gate','ch5-mine','ch6-wells','ch7-council','ch7-legion','ch8-ferry','ch9-city','ch10-road','ch10-tribunal','ch11-accounts','ch12-confrontation'];
const boards=args.boards?String(args.boards).split(','):['board-ch1-road','board-ch2-marsh','board-ch5-mine','board-ch8-ferry','board-ch11-adlection','board-ch12-confrontation'];

async function playwright(){
  for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){try{const module=await import(specifier);return module.chromium?module:module.default;}catch{}}
  console.error('Playwright is not installed. Install it separately (it is not a project dependency) or set PLAYWRIGHT_MODULE to its index.js path.');process.exit(2);
}
const exists=path=>access(path).then(()=>true,()=>false);

const server=http.createServer((req,res)=>serveRequest(req,res,root));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const {chromium}=await playwright();
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
const results=[];
try{
  await mkdir(args.record?baselineDir:outDir,{recursive:true});
  const shots=[];
  if(scenes.length){
    await page.goto(`${base}/tests/campaign-3d-browser.html`);
    await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Ready'),null,{timeout:120000});
    await page.selectOption('#quality',quality);await page.check('#reduced-motion');
    for(const id of scenes){
      await page.selectOption('#scene-select',id);await page.click('#inspect');
      await page.waitForFunction(scene=>document.getElementById('status').textContent.startsWith(`Rendered ${scene}`),id,{timeout:300000});
      await page.click('#overview');await page.waitForFunction(()=>!document.getElementById('status').textContent.startsWith('Running'),null,{timeout:300000});
      await page.waitForTimeout(800);const box=await page.locator('#stage-host').boundingBox();
      shots.push({name:`3d-${id}`,png:await page.screenshot({clip:box,fullPage:true,timeout:120000})});console.log(`captured 3d-${id}`);
    }
  }
  for(const id of boards){
    await page.goto(`${base}/tests/graphics-lab.html?scene=${id}&size=960x640&mode=scene&quality=${quality}`);
    await page.waitForFunction(()=>/^Ready/.test(document.getElementById('lab-status')?.textContent??''),null,{timeout:120000});
    await page.waitForTimeout(400);shots.push({name:`2d-${id}`,png:await page.locator('#lab-stage').screenshot()});console.log(`captured 2d-${id}`);
  }
  if(args.record){
    for(const shot of shots)await writeFile(`${baselineDir}/${shot.name}.png`,shot.png);
    console.log(`Recorded ${shots.length} baselines in ${baselineDir}.`);
  }else{
    // Compare in the browser: decode both PNGs on a canvas and count pixels whose
    // largest channel difference exceeds 24/255; changed pixels are drawn red.
    await page.goto('about:blank');
    for(const shot of shots){
      const baselinePath=`${baselineDir}/${shot.name}.png`;
      if(!await exists(baselinePath)){results.push({name:shot.name,status:'missing-baseline'});continue;}
      const baseline=(await readFile(baselinePath)).toString('base64'),current=shot.png.toString('base64');
      const diff=await page.evaluate(async([a,b])=>{
        const decode=data=>createImageBitmap(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'image/png'}));
        const [x,y]=await Promise.all([decode(a),decode(b)]);
        if(x.width!==y.width||x.height!==y.height)return {sizeMismatch:true,baseline:[x.width,x.height],current:[y.width,y.height]};
        const canvas=new OffscreenCanvas(x.width,x.height),c=canvas.getContext('2d');
        c.drawImage(x,0,0);const p=c.getImageData(0,0,x.width,x.height).data;c.drawImage(y,0,0);const q=c.getImageData(0,0,x.width,x.height),r=q.data;
        let changed=0;for(let i=0;i<p.length;i+=4){const d=Math.max(Math.abs(p[i]-r[i]),Math.abs(p[i+1]-r[i+1]),Math.abs(p[i+2]-r[i+2]));if(d>24){changed++;r[i]=255;r[i+1]=0;r[i+2]=0;}else{r[i]=r[i]*.35;r[i+1]=r[i+1]*.35;r[i+2]=r[i+2]*.35;}}
        c.putImageData(q,0,0);const blob=await canvas.convertToBlob({type:'image/png'}),bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(const v of bytes)binary+=String.fromCharCode(v);
        return {changed,total:p.length/4,image:btoa(binary)};
      },[baseline,current]);
      if(diff.sizeMismatch){results.push({name:shot.name,status:'size-mismatch',...diff});continue;}
      const ratio=diff.changed/diff.total,status=ratio>threshold?'changed':'match';
      await writeFile(`${outDir}/${shot.name}.png`,shot.png);if(status==='changed')await writeFile(`${outDir}/${shot.name}.diff.png`,Buffer.from(diff.image,'base64'));
      results.push({name:shot.name,status,changedPixels:diff.changed,changedRatio:Number(ratio.toFixed(5))});
    }
    await writeFile(`${outDir}/report.json`,JSON.stringify({quality,threshold,scope:'Software-rendered harness screenshots with reduced motion. Not a visual-quality verdict or a real-device check.',results},null,2)+'\n');
    for(const r of results)console.log(`${r.status.padEnd(16)} ${r.name}${r.changedRatio!==undefined?` (${(r.changedRatio*100).toFixed(2)}% changed)`:''}`);
    if(results.some(r=>r.status!=='match'))process.exitCode=1;
  }
}finally{await browser.close();server.close();}
