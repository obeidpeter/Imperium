import {figureStyleKey} from './stage-figures.js';
import * as T from '../../vendor/three/three.module.js';
import {civicActor} from './stage-readout.js';
import {drawableShape} from './scene-compositor.js';
import {FRAME_SLICE_MS,nextSlice} from './build-steps.js';
import {plainShadowDepth} from './shadow-depth.js';

// Preparing a battle behind the "Preparing" veil: figures built a few at a
// time, every shader program compiled and every texture uploaded in short
// tasks, so the battle shows already drawn and plays without a stall.

// How long a battle waits for its figures' downloads before it is shown anyway.
const PREPARE_FIGURES_MS=12000;
// Geometry goes to the GPU in batches sized to take about this long, judged
// from the batch before (from 1 MB, between 256 KB and 32 MB).
const UPLOAD_BATCH_MS=6,UPLOAD_BYTES={start:1<<20,min:1<<18,max:1<<25};
// What a mesh still has to send: its vertex data, index and instances, each
// buffer counted once however many meshes share it.
function unsentBytes(object,sent){
  let bytes=0;const add=a=>{const buffer=a?.isInterleavedBufferAttribute?a.data:a;if(buffer?.array&&!sent.has(buffer)){sent.add(buffer);bytes+=buffer.array.byteLength;}};
  for(const attribute of Object.values(object.geometry.attributes))add(attribute);
  add(object.geometry.index);add(object.instanceMatrix);add(object.instanceColor);
  return bytes;
}
export const stagePreparation={
  // Nothing is drawn until everything the battle will draw is ready: figures
  // wear what they will wear (a slow download is waited on only briefly), the
  // batches for fallen men and one hidden example of each overlay, fieldwork
  // and beacon exist, and every shader program is compiled and linked (off the
  // main thread where the browser compiles in parallel, otherwise in short
  // tasks), shadow-pass variants included. All of it behind the veil.
  async prepare(){
    // A rebuild during preparation starts again; only the latest one reveals.
    const token=this.prepareToken=(this.prepareToken??0)+1,current=()=>!this.disposed&&token===this.prepareToken;
    this.isReady=false;
    try{
      await this.buildQueuedFigures(current);if(!current())return;
      const figures=Promise.all([...this.actors.values()].map(a=>a.ready).filter(Boolean));
      await Promise.race([figures,new Promise(done=>setTimeout(done,PREPARE_FIGURES_MS))]);
      if(!current())return;
      this.warmup??=this.createWarmup();
      let slice=performance.now();
      for(const kind of this.fallenKinds()){
        this.remains?.prepare([kind]);
        if(performance.now()-slice>FRAME_SLICE_MS){await nextSlice();if(!current())return;slice=performance.now();}
      }
      await this.compositor.compile(this.scene,{current});if(!current())return;
      await this.compositor.upload?.(this.scene,{current});if(!current())return;
      await this.uploadGeometry(current);if(!current())return;
      await this.warmShadows(current);
    }catch(error){this.prepareError=error?.message??String(error);}
    if(!current())return;
    this.isReady=true;this.shadowDirty=true;const programs=this.renderer?.info.programs?.length??0;
    await new Promise(done=>{this.firstFrameDone=done;});
    // Anything compiled by the first frame itself escaped the warm-up above.
    this.firstFramePrograms=(this.renderer?.info.programs?.length??0)-programs;
  },
  // The first build places figures a few per frame (each is a sizeable piece
  // of work), so the page keeps answering and the veil can count them in.
  async buildQueuedFigures(current=()=>!this.disposed){
    if(!this.figureQueue)return;
    // The build's last step has just run: the first figure starts a task of its own.
    await nextSlice();if(!current())return;
    const queue=[...this.figureQueue];let slice=performance.now();
    for(const [index,id]of queue.entries()){
      if(performance.now()-slice>FRAME_SLICE_MS){this.showProgress(index,queue.length);await nextSlice();if(!current())return;slice=performance.now();}
      const unit=this.visibleUnits.find(u=>u.id===id);if(!unit||this.actors.has(id))continue;
      const vComm=this.commendationsOf(unit);
      this.placeFigure(unit,{styleKey:figureStyleKey(unit,{commendations:vComm,quality:this.worldQuality,figureStyle:this.figureStyle}),vComm});
    }
    this.figureQueue=null;this.showProgress(queue.length,queue.length);this.sync(this.encounter);
  },
  // The shadow pass makes its depth programs on first use, out of reach of a
  // compile. One probe render per depth variant, with a single caster and the
  // view turned away, links each variant in its own short task instead of all
  // of them in the first frame. Three's shared depth material changes program
  // only when a caster's instancing or skinning differs from the last one's,
  // so which variants a frame makes depends on draw order; each probe asks for
  // its caster's exact variant (needsUpdate), covering every order. A caster's
  // colour map reaches the pass only where an alpha test cuts it (shadow-depth.js).
  async warmShadows(current=()=>!this.disposed){
    if(!this.renderer?.shadowMap.enabled||!this.compositor?.probe)return 0;
    const variants=new Map(),casters=[];
    this.scene.traverse(o=>{if(o.castShadow&&(o.isMesh||o.isPoints||o.isLine))casters.push(o);});
    // Hidden casters count too: a figure's far-view meshes appear only once
    // the camera pulls back, and hidden stand-ins wait for later effects.
    this.scene.traverse(o=>{
      if(!o.castShadow||!(o.isMesh||o.isPoints||o.isLine)||!o.material)return;
      // What three's shadow pass takes from each material into its depth material.
      const depth=m=>{const cut=m.alphaTest>0||m.alphaToCoverage===true;
        return [cut&&!!m.map,cut?m.map?.channel??0:0,cut&&!!m.alphaMap,cut,!!m.displacementMap&&m.displacementScale!==0,m.shadowSide??m.side,m.clippingPlanes?.length??0].join();};
      const key=`${drawableShape(o)}|${o.customDepthMaterial?.uuid??(Array.isArray(o.material)?o.material:[o.material]).map(depth).join('/')}`;
      if(!variants.has(key))variants.set(key,o);
    });
    const position=this.camera.position.clone(),quaternion=this.camera.quaternion.clone();let probes=0;
    try{
      for(const o of casters)o.castShadow=false;
      this.camera.position.set(0,1e4,0);this.camera.lookAt(0,2e4,0);this.camera.updateMatrixWorld();
      let slice=performance.now();
      for(const caster of variants.values()){
        if(!current())break;
        const culled=caster.frustumCulled,hidden=[],own=Object.hasOwn(caster,'onBeforeShadow'),hook=caster.onBeforeShadow;
        for(let o=caster;o;o=o.parent)if(!o.visible){hidden.push(o);o.visible=true;}
        caster.castShadow=true;caster.frustumCulled=false;
        caster.onBeforeShadow=(renderer,object,camera,shadowCamera,geometry,depthMaterial)=>{plainShadowDepth(depthMaterial);depthMaterial.needsUpdate=true;};
        try{this.renderer.shadowMap.needsUpdate=true;this.compositor.probe(this.scene);probes++;}
        finally{
          caster.castShadow=false;caster.frustumCulled=culled;for(const o of hidden)o.visible=false;
          if(own)caster.onBeforeShadow=hook;else delete caster.onBeforeShadow;
        }
        if(performance.now()-slice>FRAME_SLICE_MS){await nextSlice();slice=performance.now();}
      }
    }finally{
      for(const o of casters)o.castShadow=true;
      this.camera.position.copy(position);this.camera.quaternion.copy(quaternion);this.camera.updateMatrixWorld();this.shadowDirty=true;
    }
    return probes;
  },
  // A mesh's buffers are made the first time it is drawn, so the first frame
  // would send the whole battle's geometry to the GPU at once. Drawing a batch
  // at a time instead, through a material that places every vertex outside the
  // view (nothing is shaded), with the view turned away so nothing else is
  // drawn, sends it in short tasks; hidden meshes go too, for when they show.
  async uploadGeometry(current=()=>!this.disposed){
    if(!this.compositor?.probe)return 0;
    const pending=[],sent=new Set();
    this.scene.traverse(o=>{if((o.isMesh||o.isPoints||o.isLine)&&o.geometry){const bytes=unsentBytes(o,sent);if(bytes)pending.push([o,bytes]);}});
    const clip=new T.ShaderMaterial({name:'geometry upload',vertexShader:'void main(){gl_PointSize=1.0;gl_Position=vec4(2.0,2.0,2.0,1.0);}',
      fragmentShader:'void main(){gl_FragColor=vec4(0.0);}'});
    const position=this.camera.position.clone(),quaternion=this.camera.quaternion.clone(),override=this.scene.overrideMaterial,
      autoUpdate=this.scene.matrixWorldAutoUpdate,shadows=this.renderer.shadowMap.needsUpdate;
    let batch=[],bytes=0,budget=UPLOAD_BYTES.start,uploaded=0,slice=performance.now();
    try{
      // No shadow pass: it would draw every caster with its own material.
      this.renderer.shadowMap.needsUpdate=false;this.scene.updateMatrixWorld();this.scene.matrixWorldAutoUpdate=false;this.scene.overrideMaterial=clip;
      this.camera.position.set(0,1e4,0);this.camera.lookAt(0,2e4,0);this.camera.updateMatrixWorld();
      for(const [index,[object,size]]of pending.entries()){
        batch.push(object);bytes+=size;if(bytes<budget&&index<pending.length-1)continue;
        if(!current())break;
        const started=performance.now();this.drawOnce(batch);uploaded+=bytes;
        budget=Math.min(UPLOAD_BYTES.max,Math.max(UPLOAD_BYTES.min,bytes*UPLOAD_BATCH_MS/Math.max(.25,performance.now()-started)));
        batch=[];bytes=0;
        if(performance.now()-slice>FRAME_SLICE_MS){await nextSlice();slice=performance.now();}
      }
    }finally{
      this.scene.overrideMaterial=override;this.scene.matrixWorldAutoUpdate=autoUpdate;this.renderer.shadowMap.needsUpdate=shadows;clip.dispose();
      this.camera.position.copy(position);this.camera.quaternion.copy(quaternion);this.camera.updateMatrixWorld();
    }
    return uploaded;
  },
  // One pixel of a frame in which these meshes, hidden or out of view, are drawn.
  drawOnce(objects){
    const culled=objects.map(o=>o.frustumCulled),hidden=[];
    for(const o of objects){o.frustumCulled=false;for(let p=o;p;p=p.parent)if(!p.visible){hidden.push(p);p.visible=true;}}
    try{this.compositor.probe(this.scene);}
    finally{objects.forEach((o,i)=>{o.frustumCulled=culled[i];});for(const p of hidden)p.visible=false;}
  },
  showProgress(done,total){
    const veil=this.canvas?.parentElement?.querySelector('.battle-loading');if(veil)veil.dataset.progress=total?`${done} of ${total} figures`:'';
  },
  // One hidden example of each thing drawn only later in a battle, so its
  // program compiles with the rest and stays alive until the stage goes.
  createWarmup(){
    const group=new T.Group();group.name='shader warm-up';group.visible=false;
    for(const type of ['stakes','rampart','brazier'])group.add(this.fieldworkGroup(type));
    group.add(this.beaconGroup(),this.tacticalLine('#ffffff'));
    this.scene.add(group);return group;
  },
  fallenKinds(){
    const kinds=new Map();
    for(const unit of this.visibleUnits){
      const actor=this.actors.get(unit.id);if(!actor||civicActor(unit))continue;const kind=this.fallenKind(unit,actor);
      if(!kinds.has(kind.key))kinds.set(kind.key,kind);
    }
    return [...kinds.values()];
  }
};
