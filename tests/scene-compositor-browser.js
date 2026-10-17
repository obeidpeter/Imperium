import * as T from '../vendor/three/three.module.js';
import {createSceneCompositor} from '../src/showcase/scene-compositor.js';

const button=document.querySelector('#run'),status=document.querySelector('#status'),result=document.querySelector('#result'),canvas=document.querySelector('#view'),samples=document.querySelector('#samples');
const width=720,height=400,luma=(r,g,b)=>r*.2126+g*.7152+b*.0722;
function pixel(data,x,y){const at=(Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x)))*4;return [...data.slice(at,at+3)];}
function imageStats(data){let lo=255,hi=0,sum=0;for(let i=0;i<data.length;i+=4){const v=luma(data[i],data[i+1],data[i+2]);lo=Math.min(lo,v);hi=Math.max(hi,v);sum+=v;}return {mean:sum/(width*height),range:hi-lo};}
function snapshot(label){const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption');image.src=canvas.toDataURL('image/png');image.alt=`Rendered ${label} diagnostic`;caption.textContent=label;figure.append(image,caption);samples.append(figure);}
button.addEventListener('click',async()=>{
  button.disabled=true;samples.replaceChildren();status.textContent='Running actual WebGL checks…';
  const report={status:'running',viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},drawingBuffer:{width,height},checks:[],qualities:[],shaderErrors:[]};let renderer,compositor,scene;
  const check=(name,passed,details)=>report.checks.push({name,passed:!!passed,...details&&{details}});
  try{
    renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    let expectedShaderFailure=false;
    renderer.debug.onShaderError=(gl,program,vertex,fragment)=>report.shaderErrors.push({expected:expectedShaderFailure,program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vertex),fragment:gl.getShaderInfoLog(fragment)});
    const camera=new T.PerspectiveCamera(42,width/height,.1,800);camera.position.set(3,4,8);camera.lookAt(0,.6,0);camera.updateMatrixWorld();
    scene=new T.Scene();scene.background=new T.Color('#6d8894');
    const add=(geometry,color,position)=>{const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color}));mesh.position.set(...position);scene.add(mesh);return mesh;};
    const floor=add(new T.PlaneGeometry(12,12),'#888888',[0,0,0]);floor.rotation.x=-Math.PI/2;
    add(new T.BoxGeometry(1,1.5,1),'#888888',[0,.75,0]);
    add(new T.PlaneGeometry(1.5,1.4),'#808080',[-2,1.2,.5]);
    add(new T.BoxGeometry(.8,.8,.8),'#c94b3e',[2,.4,0]);
    add(new T.BoxGeometry(.8,.8,.8),'#416eac',[2,.4,-1.5]);
    const gl=renderer.getContext(),read=()=>{const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
    const project=(x,y,z)=>{const p=new T.Vector3(x,y,z).project(camera);return [Math.round((p.x*.5+.5)*width),Math.round((p.y*.5+.5)*height)];};
    const grayAt=project(-2,1.2,.5),contactPoints=[];for(let x=-.4;x<=.4;x+=.1)for(let z=.56;z<=1.3;z+=.08)contactPoints.push(project(x,.002,z));
    renderer.render(scene,camera);const direct=read(),directGray=pixel(direct,...grayAt),baseMemory={...renderer.info.memory};snapshot('Direct reference');
    report.direct={...imageStats(direct),neutral:directGray,memory:baseMemory};
    check('Direct reference has visible, nonuniform color',report.direct.mean>10&&report.direct.range>25);
    const supported=renderer.extensions.has('EXT_color_buffer_float');report.floatTargetsSupported=supported;
    for(const quality of ['balanced','high','performance']){
      compositor=createSceneCompositor(renderer,camera,{quality});compositor.render(scene);
      const data=read(),stats=imageStats(data),gray=pixel(data,...grayAt),neutralDelta=Math.max(...gray.map((v,i)=>Math.abs(v-directGray[i])));
      const darkening=contactPoints.map(([x,y])=>{const before=pixel(direct,x,y),after=pixel(data,x,y);return luma(...before)-luma(...after);});
      const error=gl.getError(),entry={quality,...stats,neutral:gray,neutralDelta,contactDarkening:{max:Math.max(...darkening),mean:darkening.reduce((a,b)=>a+b,0)/darkening.length},compositor:compositor.stats(),glError:error};report.qualities.push(entry);snapshot(quality);
      check(`${quality}: visible nonblack, nonuniform output`,stats.mean>10&&stats.range>25);
      check(`${quality}: neutral transfer agrees with direct reference`,neutralDelta<=8,{neutralDelta,tolerance:8});
      check(`${quality}: no unexpected GPU error`,error===gl.NO_ERROR,{glError:error});
      if(quality!=='performance'&&supported){check(`${quality}: compositor remains enabled`,entry.compositor.enabled&&!entry.compositor.fallback);check(`${quality}: nearby geometry causes contact darkening`,entry.contactDarkening.max>3,{maximum:entry.contactDarkening.max});}
      if(quality==='performance')check('Performance remains a direct rendering path',!entry.compositor.enabled&&neutralDelta===0);
      compositor.dispose();compositor=null;
      check(`${quality}: render targets and fullscreen geometry are released`,renderer.info.memory.textures===baseMemory.textures&&renderer.info.memory.geometries===baseMemory.geometries,{before:baseMemory,after:{...renderer.info.memory}});
    }
    if(supported){
      // Explicitly reproduce the namespace failure that made the initial pass
      // black. This wrapper changes only this local diagnostic material.
      expectedShaderFailure=true;let injected=false;const facade=Object.create(renderer),realRender=renderer.render.bind(renderer);
      facade.render=(object,view)=>{if(object.isMesh&&!injected){injected=true;object.material.fragmentShader='float luminance(vec3 c){return c.x;}\n'+object.material.fragmentShader;object.material.needsUpdate=true;}return realRender(object,view);};
      const hook=renderer.debug.onShaderError;compositor=createSceneCompositor(facade,camera,{quality:'balanced'});compositor.render(scene);
      const fallback=imageStats(read());report.deliberateShaderFailure={...fallback,stats:compositor.stats()};snapshot('Expected shader failure → direct fallback');
      check('Prefix luminance collision is detected and gives a visible fallback',injected&&report.shaderErrors.some(e=>e.expected)&&!compositor.stats().enabled&&/shader failed/.test(compositor.stats().fallback??'')&&fallback.mean>10);
      check('Existing shader diagnostic hook is restored',renderer.debug.onShaderError===hook);
      compositor.dispose();compositor=null;expectedShaderFailure=false;
    }
    check('Normal compositor shaders compiled without errors',report.shaderErrors.every(error=>error.expected));
    report.status=report.checks.every(check=>check.passed)?'passed':'failed';
  }catch(error){report.status='failed';report.error=String(error?.stack??error);}
  finally{compositor?.dispose();if(scene){const geometry=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}renderer?.dispose();button.disabled=false;status.textContent=`${report.status.toUpperCase()}: ${report.checks.filter(c=>c.passed).length}/${report.checks.length} checks passed. See JSON and rendered samples.`;result.textContent=JSON.stringify(report,null,2);}
});
