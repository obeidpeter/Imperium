// Renders a model as a 2 × 2 contact sheet (front, side, three-quarter and
// top) with a 1.8 m figure for scale, in headless Chromium through the
// vendored three.js and the game's model loader (KTX2 and meshopt included),
// so a generated asset can be reviewed as an image. A
// software renderer is correctness evidence, not the game's lighting or a
// hardware result. Development tool: it needs Playwright, which is not a
// project dependency (install it separately or set PLAYWRIGHT_MODULE).
//
//   node scripts/assets/preview-model.mjs model.glb sheet.png
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {serveRequest} from '../serve.mjs';

const [model,output]=process.argv.slice(2);
if(!model||!output){console.error('Usage: node scripts/assets/preview-model.mjs model.glb sheet.png');process.exit(2);}
const root=fileURLToPath(new URL('../../',import.meta.url)),bytes=await readFile(model);
async function playwright(){
  for(const specifier of [process.env.PLAYWRIGHT_MODULE,'playwright'].filter(Boolean)){try{const module=await import(specifier);return module.chromium?module:module.default;}catch{}}
  console.error('Playwright is not installed. Install it separately (it is not a project dependency) or set PLAYWRIGHT_MODULE to its index.js path.');process.exit(2);
}
const page=`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#2b2b2b">
<canvas id="sheet" width="1024" height="1024"></canvas>
<script type="module">
import * as T from '/vendor/three/three.module.js';
import {createModelLoader} from '/src/showcase/model-loader.js';
const canvas=document.querySelector('#sheet'),renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.outputColorSpace=T.SRGBColorSpace;renderer.setScissorTest(true);
const scene=new T.Scene();scene.background=new T.Color('#8f8f8a');
scene.add(new T.HemisphereLight('#fff6e8','#5a5248',1.4));const sun=new T.DirectionalLight('#ffffff',2.2);sun.position.set(-3,6,4);scene.add(sun);
try{
  const gltf=await createModelLoader().loadAsync('/model.glb');scene.add(gltf.scene);gltf.scene.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(gltf.scene,true),size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());
  // Scale reference: a plain 1.8 m figure beside the model.
  const figure=new T.Mesh(new T.CapsuleGeometry(.22,1.36,4,12),new T.MeshStandardMaterial({color:'#c45a3c'}));
  figure.position.set(box.max.x+.6,box.min.y+.9,centre.z);scene.add(figure);
  const ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:'#6d6b62'}));ground.rotation.x=-Math.PI/2;
  const framed=box.clone().union(new T.Box3().setFromObject(figure)),c=framed.getCenter(new T.Vector3()),radius=framed.getSize(new T.Vector3()).length()/2;
  ground.scale.setScalar(radius*3);ground.position.set(c.x,box.min.y-.002,c.z);scene.add(ground);
  const views=[[0,.25,1],[1,.25,0],[-.8,.55,.8],[0,1,.0001]];
  views.forEach(([x,y,z],i)=>{
    const camera=new T.PerspectiveCamera(30,1,radius/50,radius*20),d=radius/Math.sin(T.MathUtils.degToRad(15))*1.02;
    camera.position.copy(c).add(new T.Vector3(x,y,z).normalize().multiplyScalar(d));camera.lookAt(c);
    const px=(i%2)*512,py=(i<2?512:0);renderer.setViewport(px,py,512,512);renderer.setScissor(px,py,512,512);renderer.render(scene,camera);
  });
  window.result={ok:true,size:[size.x,size.y,size.z]};
}catch(error){window.result={ok:false,error:String(error)};}
</script>`;
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(page);return;}
  if(req.url==='/model.glb'){res.writeHead(200,{'content-type':'model/gltf-binary'});res.end(bytes);return;}
  if(req.url.startsWith('/vendor/three/')||req.url==='/src/showcase/model-loader.js')return serveRequest(req,res,root);
  res.writeHead(404);res.end();
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const {chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
let failed=false;
try{
  const tab=await browser.newPage({viewport:{width:1024,height:1024}}),errors=[];
  tab.on('pageerror',e=>errors.push(e.message));tab.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(()=>window.result,null,{timeout:120000});
  const result=await tab.evaluate(()=>window.result);
  if(!result.ok||errors.length){failed=true;console.error('Preview failed:',result.error??'',errors.join('\n'));}
  else{await tab.locator('#sheet').screenshot({path:output});console.log(JSON.stringify({output,sizeMetres:result.size.map(n=>+n.toFixed(3))}));}
}finally{await browser.close();server.close();}
process.exit(failed?1:0);
