// Own one renderer across UI updates. Only presentation is retained; game state
// continues to belong to the campaign and its normal save transaction.
export function chapterHas3D(state){return state?.chapter===1&&state.phase==='encounter'&&state.encounter?.kind==='battle';}

export function createBattleStageController({load=()=>import('../showcase/stage.js'),onError=()=>{}}={}){
  let stage=null,key=null,version=0,latest=null,pending=null,lastMotion=null;
  const update=()=>{
    if(!stage||!latest)return;
    const {encounter,selected,targets,target,grid,quality,reducedMotion,audio,audioVolume,paused}=latest;
    stage.sync(encounter);stage.setSelection(selected,targets,target);stage.setGrid(grid);
    if(stage.quality!==quality)stage.applyQuality(quality);
    stage.setReducedMotion(reducedMotion);stage.setPaused(paused);stage.setAudio(audio,audioVolume);
    if(pending){const motion=pending;pending=null;stage.play(motion.before,motion.after,motion.command);}
  };
  function release(){version++;stage?.dispose();stage=null;key=null;latest=null;pending=null;lastMotion=null;}
  return {
    mount(canvas,options){
      const nextKey=options.encounter.id;
      if(key!==nextKey){release();key=nextKey;}
      latest=options;if(options.motion&&options.motion!==lastMotion){pending=options.motion;lastMotion=options.motion;}
      if(stage){canvas.replaceWith(stage.canvas);stage.canvas.parentElement.append(stage.labelLayer);stage.canvas.parentElement.dataset.ready='true';stage.resize();update();return stage;}
      const ticket=++version;
      load().then(({BattleStage})=>{
        if(ticket!==version||!canvas.isConnected||!latest)return;
        try{
          stage=new BattleStage(canvas,latest.encounter,{...latest,keyboardMode:'grid'});
          stage.onError=error=>{release();onError(error);};stage.home();update();
          canvas.parentElement.dataset.ready='true';
        }catch(error){release();onError(error.message||String(error));}
      }).catch(error=>{if(ticket===version){release();onError(error.message||String(error));}});
      return null;
    },
    stop(){pending=null;stage?.finishMotion();},
    pause(value){if(latest)latest.paused=value;stage?.setPaused(value);},
    unlock(){return stage?.sound?.unlock();},
    audio(enabled,volume){if(latest){latest.audio=enabled;latest.audioVolume=volume;}stage?.setAudio(enabled,volume);},
    quality(value){if(latest)latest.quality=value;stage?.applyQuality(value);},
    reduced(value){if(latest)latest.reducedMotion=value;stage?.setReducedMotion(value);},
    home(){stage?.home();},focus(){stage?.focusSelected();},
    zoom(delta){if(stage)stage.orbit.distance=Math.max(5.5,Math.min(55,stage.orbit.distance+delta));},
    release,get stage(){return stage;}
  };
}
