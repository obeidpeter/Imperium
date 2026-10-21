// Own one renderer across UI updates. Only presentation is retained; game state
// continues to belong to the campaign and its normal save transaction.
export function chapterHas3D(state){return Number.isInteger(state?.chapter)&&state.chapter>=1&&state.chapter<=12&&state.phase==='encounter'&&['battle','contest'].includes(state.encounter?.kind);}

const PRELOAD_MS=15000;

export function createBattleStageController({load=()=>import('../showcase/stage.js'),onError=()=>{}}={}){
  let stage=null,key=null,version=0,latest=null,pending=null,lastMotion=null;
  const update=()=>{
    if(!stage||!latest)return;
    const {encounter,selected,targets,target,grid,quality,reducedMotion,audio,audioVolume,paused}=latest;
    stage.sync(encounter);stage.setSelection(selected,targets,target);stage.setRoute?.(latest.route??null,latest.reach??[]);stage.setGrid(grid);
    if(stage.quality!==quality)stage.applyQuality(quality);
    if((stage.figureStyle??'sculpted')!==(latest.figureStyle??'sculpted'))stage.setFigureStyle?.(latest.figureStyle);
    stage.actionCamera=latest.actionCamera!==false;stage.setBattleRemains?.(latest.battleRemains!==false);
    stage.touchHold?.configure?.({delay:latest.holdDelay??450});
    stage.setAdaptiveResolution?.(latest.adaptiveResolution!==false);stage.setMotionSpeed?.(latest.motionSpeed??1);stage.setReducedMotion(reducedMotion);stage.setPaused(paused);stage.setAudio(audio,audioVolume);
    if(pending){const motion=pending;pending=null;stage.play(motion.before,motion.after,motion.command);}
  };
  function release(){version++;stage?.dispose();stage=null;key=null;latest=null;pending=null;lastMotion=null;}
  return {
    mount(canvas,options){
      const nextKey=`${options.chapter??''}:${options.encounter.id}:${options.encounter.kind}:${options.rank??''}:${options.stratagem??''}:${options.encounter.weather??options.weather??''}:${options.encounter.timeOfDay??options.timeOfDay??''}`;
      if(key!==nextKey){release();key=nextKey;}
      latest=options;if(options.motion&&options.motion!==lastMotion){pending=options.motion;lastMotion=options.motion;}
      if(stage){canvas.replaceWith(stage.canvas);stage.canvas.parentElement.append(stage.labelLayer);if(stage.revealed)stage.canvas.parentElement.dataset.ready='true';stage.resize();update();return stage;}
      const ticket=++version;
      load().then(async({BattleStage,preloadBattleFigures})=>{
        if(ticket!==version||!canvas.isConnected||!latest)return;
        // What the figures wear, the ground's images and the scenery arrive
        // first, so nothing is built twice or changes in play; a slow download
        // holds the battle back only so long.
        const {encounter,chapter,rank,commendations,figureStyle,quality}=latest;
        await Promise.race([preloadBattleFigures?.(encounter,{chapter,rank,commendations,figureStyle,quality}),new Promise(done=>setTimeout(done,PRELOAD_MS))]);
        if(ticket!==version||!canvas.isConnected||!latest)return;
        try{
          const own=stage=new BattleStage(canvas,latest.encounter,{...latest,keyboardMode:'grid'});
          stage.onError=error=>{release();onError(error);};stage.home();update();
          // The "Preparing" veil stays until the battle is prepared and drawn once.
          Promise.resolve(own.ready).then(()=>{if(stage!==own)return;own.revealed=true;if(own.canvas.parentElement)own.canvas.parentElement.dataset.ready='true';});
        }catch(error){release();onError(error.message||String(error));}
      }).catch(error=>{if(ticket===version){release();onError(error.message||String(error));}});
      return null;
    },
    stop(){pending=null;stage?.finishMotion();},
    pause(value){if(latest)latest.paused=value;stage?.setPaused(value);},
    unlock(){return stage?.sound?.unlock();},
    audio(enabled,volume){if(latest){latest.audio=enabled;latest.audioVolume=volume;}stage?.setAudio(enabled,volume);},
    quality(value){if(latest)latest.quality=value;stage?.applyQuality(value);},
    figures(value){if(latest)latest.figureStyle=value;stage?.setFigureStyle?.(value);},
    actionCamera(value){if(latest)latest.actionCamera=value;if(stage)stage.actionCamera=value!==false;},
    remains(value){if(latest)latest.battleRemains=value;stage?.setBattleRemains?.(value);},
    adaptive(value){if(latest)latest.adaptiveResolution=value;stage?.setAdaptiveResolution?.(value);},
    speed(value){if(latest)latest.motionSpeed=value;stage?.setMotionSpeed?.(value);},
    reduced(value){if(latest)latest.reducedMotion=value;stage?.setReducedMotion(value);},
    home(){stage?.home();},focus(){stage?.focusSelected();},focusPoint(tile){stage?.focusPoint?.(tile);},horizon(){stage?.horizon();},
    zoom(delta){if(stage)stage.zoom(delta);},
    release,get stage(){return stage;}
  };
}
