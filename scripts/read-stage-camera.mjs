// Test-only, read-only inspection of the already-loaded turn-stage instance.
// The production controller is deliberately private. CDP queries its class's
// existing instances; no globals, methods, game state or camera values change.
let auditSerial=0;
export async function readStageCamera(page,canvasId='battle-board'){
  const session=await page.context().newCDPSession(page),objectGroup=`stage-camera-audit-${++auditSerial}`;
  try{
    const prototype=await session.send('Runtime.evaluate',{expression:"import(new URL('src/showcase/stage.js',location.href).href).then(module=>module.BattleStage.prototype)",awaitPromise:true,returnByValue:false,objectGroup});
    if(prototype.exceptionDetails||!prototype.result.objectId)throw Error('Cannot inspect the already-loaded stage prototype');
    const objects=await session.send('Runtime.queryObjects',{prototypeObjectId:prototype.result.objectId,objectGroup});
    const result=await session.send('Runtime.callFunctionOn',{objectId:objects.objects.objectId,arguments:[{value:canvasId}],returnByValue:true,
      functionDeclaration:`function(canvasId){
        const matches=this.filter(stage=>!stage.disposed&&stage.canvas?.isConnected&&stage.canvas.id===canvasId);
        if(matches.length!==1)return {method:'read-only CDP instance query',matches:matches.length,cameraSettled:false};
        const stage=matches[0];return {method:'read-only CDP instance query',matches:1,view:stage.cameraView,cameraSettled:stage.cameraSettled===true,
          renderedFrames:stage.profileFrames,reducedMotion:stage.reducedMotion,position:stage.camera.position.toArray(),lookTarget:stage.lookTarget.toArray()};
      }`});
    if(result.exceptionDetails)throw Error('Cannot read stage camera diagnostics');return result.result.value;
  }finally{
    await session.send('Runtime.releaseObjectGroup',{objectGroup}).catch(()=>{});await session.detach().catch(()=>{});
  }
}
export async function waitForSettledStage(page,view,{timeout=120000,canvasId='battle-board',afterFrame=-2}={}){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){const camera=await readStageCamera(page,canvasId);if(camera.matches===1&&camera.view===view&&camera.cameraSettled&&camera.renderedFrames>=afterFrame+2)return camera;await new Promise(done=>setTimeout(done,200));}
  throw Error(`The ${view} camera did not settle within ${timeout} ms`);
}
