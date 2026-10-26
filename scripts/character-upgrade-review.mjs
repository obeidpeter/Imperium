// Development-only inspection of the actual renderer. No fabricated campaign
// progression; software screenshots are not physical-device performance data.
import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {serveRequest} from './serve.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'tests/visual-results/character-upgrade');
await mkdir(out,{recursive:true});
const spec=process.env.PLAYWRIGHT_MODULE??'playwright',pw=await import(spec.startsWith('C:')?pathToFileURL(spec).href:spec);
const server=http.createServer((req,res)=>serveRequest(req,res,root));await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await pw.chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const results=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const specimens=[...['recruit','officer','hero-ch8','senator','varro','lucan','sabinus'].map(actor=>({name:actor,actor,view:'head'})),
    ...[.15,.65].map(phase=>({name:`cavalry-run-${phase}`,actor:'cavalry',view:'body',motion:'run',phase,yaw:70})),
    {name:'recruit-wounded',actor:'recruit',view:'body',motion:'walk',phase:.25,health:.2,morale:.2,yaw:35},
    {name:'recruit-steady',actor:'recruit',view:'body',motion:'walk',phase:.25,health:1,morale:1,yaw:35}];
  for(const {name,...sample} of specimens.filter(s=>!process.env.CHARACTER_REVIEW||s.name===process.env.CHARACTER_REVIEW)){
    await page.goto(`http://127.0.0.1:${server.address().port}/tests/actor-model-browser.html?${new URLSearchParams(sample)}`);
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent.startsWith('Ready:'),null,{timeout:60000});
    await page.locator('#stage').screenshot({path:resolve(out,`${name}.png`)});
    const report=JSON.parse(await page.locator('#report').textContent());results.push({specimen:name,report});
  }
  await writeFile(resolve(out,process.env.CHARACTER_REVIEW?`report-${process.env.CHARACTER_REVIEW}.json`:'report.json'),JSON.stringify({scope:'Production actor viewer; software renderer, no hardware frame-rate claim.',errors,results},null,2));
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify({out,characters:results.length,errors}));
}finally{await browser.close();server.close();}
