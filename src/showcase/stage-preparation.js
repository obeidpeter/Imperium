import {figureStyleKey} from './stage-figures.js';
import * as T from '../../vendor/three/three.module.js';
import {civicActor} from './stage-readout.js';
import {drawableShape} from './scene-compositor.js';

// Preparing a battle behind the "Preparing" veil: figures built a few at a
// time, every shader program compiled and every texture uploaded in short
// tasks, so the battle shows already drawn and plays without a stall.
// A build slice before the page is given a turn; then the next slice.
const FRAME_SLICE_MS=8,nextSlice=()=>globalThis.scheduler?.yield?.()??new Promise(done=>setTimeout(done,0));
// How long a battle waits for its figures' downloads before it is shown anyway.
const PREPARE_FIGURES_MS=12000;
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
    const queue=[...this.figureQueue];let slice=performance.now();
    for(const [index,id]of queue.entries()){
      if(performance.now()-slice>FRAME_SLICE_MS){this.showProgress(index,queue.length);await nextSlice();if(!current())return;slice=performance.now();}
      const unit=this.visibleUnits.find(u=>u.id===id);if(!unit||this.actors.has(id))continue;
      const vComm=this.commendationsOf(unit);
      this.placeFigure(unit,{styleKey:figureStyleKey(unit,{commendations:vComm,quality:this.quality,figureStyle:this.figureStyle}),vComm});
    }
    this.figureQueue=null;this.showProgress(queue.length,queue.length);this.sync(this.encounter);
  },
  // The shadow pass makes its depth programs on first use, out of reach of a
  // compile. One probe render per depth variant, with a single caster and the
  // view turned away, links each variant in its own short task instead of all
  // of them in the first frame. Three's shared depth material changes program
  // only when a caster's instancing or skinning differs from the last one's,
  // so which variants a frame makes depends on draw order; each probe asks for
  // its caster's exact variant (needsUpdate), covering every order.
  async warmShadows(current=()=>!this.disposed){
    if(!this.renderer?.shadowMap.enabled||!this.compositor?.probe)return 0;
    const variants=new Map(),casters=[];
    this.scene.traverse(o=>{if(o.castShadow&&(o.isMesh||o.isPoints||o.isLine))casters.push(o);});
    // Hidden casters count too: a figure's far-view meshes appear only once
    // the camera pulls back, and hidden stand-ins wait for later effects.
    this.scene.traverse(o=>{
      if(!o.castShadow||!(o.isMesh||o.isPoints||o.isLine)||!o.material)return;
      // What three's shadow pass copies from each material into its depth material.
      const depth=m=>[!!m.map,m.map?.channel??0,!!m.alphaMap,m.alphaTest>0||m.alphaToCoverage===true,!!m.displacementMap&&m.displacementScale!==0,m.shadowSide??m.side,m.clippingPlanes?.length??0].join();
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
        caster.castShadow=true;caster.frustumCulled=false;caster.onBeforeShadow=(renderer,object,camera,shadowCamera,geometry,depthMaterial)=>{depthMaterial.needsUpdate=true;};
        try{this.renderer.shadowMap.needsUpdate=true;this.compositor.probe(this.scene);probes++;}
        finally{caster.castShadow=false;caster.frustumCulled=culled;for(const o of hidden)o.visible=false;if(own)caster.onBeforeShadow=hook;else delete caster.onBeforeShadow;}
        if(performance.now()-slice>FRAME_SLICE_MS){await nextSlice();slice=performance.now();}
      }
    }finally{
      for(const o of casters)o.castShadow=true;
      this.camera.position.copy(position);this.camera.quaternion.copy(quaternion);this.camera.updateMatrixWorld();this.shadowDirty=true;
    }
    return probes;
  },
  showProgress(done,total){const veil=this.canvas?.parentElement?.querySelector('.battle-loading');if(veil)veil.dataset.progress=total?`${done} of ${total} figures`:'';},
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
    for(const unit of this.visibleUnits){const actor=this.actors.get(unit.id);if(!actor||civicActor(unit))continue;const kind=this.fallenKind(unit,actor);if(!kinds.has(kind.key))kinds.set(kind.key,kind);}
    return [...kinds.values()];
  }
};
