// Owns at most one 3D ceremony (the oath or the accession) over its painted
// scene. The painting stays underneath as the fallback: until the stage is
// ready, and whenever 3D is off, unavailable or fails, the painting shows.
export function createCeremonyController({load=()=>Promise.all([import('../showcase/stage.js'),import('../showcase/ceremony.js')]),onError=()=>{}}={}){
  let stage=null,key=null,version=0,canvas=null,host=null;
  function release(){version++;stage?.dispose();stage=null;key=null;canvas?.remove();canvas=null;if(host)delete host.dataset.ceremonyReady;host=null;}
  return {
    mount(target,{kind,name,quality='balanced',reducedMotion=false,figureStyle='sculpted'}={}){
      const next=`${kind}:${name}`;
      if(key===next&&host===target&&canvas?.isConnected){if(stage){stage.setReducedMotion(reducedMotion);if(stage.quality!==quality)stage.applyQuality(quality);}return stage;}
      release();key=next;host=target;const ticket=++version;
      canvas=document.createElement('canvas');canvas.className='ceremony-canvas';canvas.setAttribute('aria-hidden','true');canvas.setAttribute('data-live','');target.append(canvas);
      load().then(async([{BattleStage,preloadBattleFigures},{ceremonyScene}])=>{
        if(ticket!==version||!canvas?.isConnected)return;
        const scene=ceremonyScene(kind,{name});if(!scene){release();return;}
        // The figures' bodies and textures arrive before the tableau is built.
        await Promise.race([preloadBattleFigures?.(scene.encounter,{chapter:scene.chapter,rank:scene.rank,figureStyle}),new Promise(done=>setTimeout(done,15000))]);
        if(ticket!==version||!canvas?.isConnected)return;
        try{
          stage=new BattleStage(canvas,scene.encounter,{quality,reducedMotion,chapter:scene.chapter,rank:scene.rank,figureStyle,ceremony:scene,onPick:()=>{},onHover:()=>{}});
          const own=stage;stage.onError=error=>{release();onError(error);};stage.home();
          // The painting stays until the tableau is prepared and drawn once.
          Promise.resolve(own.ready).then(()=>{if(stage===own&&host===target)target.dataset.ceremonyReady='true';});
        }catch(error){release();onError(error?.message||String(error));}
      }).catch(error=>{if(ticket===version){release();onError(error?.message||String(error));}});
      return null;
    },
    release,get stage(){return stage;}
  };
}
