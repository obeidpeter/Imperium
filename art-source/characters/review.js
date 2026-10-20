import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
import {renderDeviceReport} from '../../src/showcase/device-report.js';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.1,30);
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
scene.background=new T.Color('#242d34');scene.add(new T.HemisphereLight(0xe6edf3,0x5b5141,2.4));
const key=new T.DirectionalLight(0xffe5c5,3.5);key.position.set(-3,5,4);scene.add(key);
const fill=new T.DirectionalLight(0xc1d8ed,1.7);fill.position.set(3,2,-3);scene.add(fill);
const floor=new T.Mesh(new T.PlaneGeometry(14,10),new T.MeshStandardMaterial({color:0x35404a,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;scene.add(floor);
const subjects=[],mixers=[];let paused=false,last=0;
const views={front:[0,1.4,5.8],'three-quarter':[3.4,1.6,5.1],back:[0,1.4,-5.8]};
function view(){camera.position.set(...views[document.querySelector('#view').value]);camera.lookAt(0,1.05,0);}
view();document.querySelector('#view').addEventListener('change',view);
function play(){const name=document.querySelector('#motion').value;subjects.forEach(({gltf,mixer})=>{mixer.stopAllAction();const clip=gltf.animations.find(a=>a.name===name);if(clip)mixer.clipAction(clip).reset().play();});canvas.dataset.motion=name;}
document.querySelector('#motion').addEventListener('change',play);
document.querySelector('#pause').addEventListener('click',e=>{paused=!paused;e.currentTarget.textContent=paused?'Resume':'Pause';e.currentTarget.setAttribute('aria-pressed',String(paused));});
try{
  for(const [i,id]of ['marcellus','lucan','persian-guard'].entries()){
    const gltf=await new GLTFLoader().loadAsync(`./${id}-v035.glb`);gltf.scene.position.x=(i-1)*1.45;scene.add(gltf.scene);
    const mixer=new T.AnimationMixer(gltf.scene);subjects.push({gltf,mixer});mixers.push(mixer);
  }
  play();canvas.dataset.ready='true';status.textContent='Three local GLBs loaded · four animation clips each · embedded material maps.';
}catch(error){canvas.dataset.error=String(error);status.textContent=`Asset load failed: ${error.message}`;throw error;}
const device=renderDeviceReport(renderer.getContext());new ResizeObserver(()=>{const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(canvas);
function frame(now){requestAnimationFrame(frame);const delta=Math.min(.1,(now-last)/1000||0);last=now;if(!paused)mixers.forEach(m=>m.update(delta));renderer.render(scene,camera);canvas.dataset.renderStats=JSON.stringify({device,subjects:subjects.length,motion:canvas.dataset.motion,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls});}
requestAnimationFrame(frame);
