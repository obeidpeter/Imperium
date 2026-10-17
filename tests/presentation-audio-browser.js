import {SOUND_FILES} from '../src/ui/soundscape-data.js';
const $=id=>document.getElementById(id),status=$('audio-status'),result=$('audio-result');
let context=null,source=null,run=0,request=null;
for(const id of Object.keys(SOUND_FILES)){const option=document.createElement('option');option.value=id;option.textContent=id;$('audio-clip').append(option);}
const report=value=>{result.textContent=JSON.stringify(value,null,2);result.dataset.status=value.status;};
async function unlock(){const Context=globalThis.AudioContext??globalThis.webkitAudioContext;if(!Context)throw new Error('Web Audio is unavailable.');context??=new Context();await context.resume();return context;}
function stop(){run++;request?.abort();request=null;if(source){try{source.stop();}catch{}source.disconnect();source=null;}$('decode-all').disabled=false;$('play-clip').disabled=false;void context?.suspend().catch(()=>{});}
async function decode(id,signal){const response=await fetch(SOUND_FILES[id],{signal});if(!response.ok)throw new Error(`${id}: HTTP ${response.status}`);const bytes=await response.arrayBuffer();return context.decodeAudioData(bytes);}
function measure(buffer){
  let sum=0,peak=0,clipped=0,finite=true,first=buffer.length;const count=buffer.length*buffer.numberOfChannels;
  for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<channel.length;i++){const n=channel[i],a=Math.abs(n);if(!Number.isFinite(n)){finite=false;continue;}sum+=n*n;peak=Math.max(peak,a);if(a>=.999)clipped++;if(a>.001)first=Math.min(first,i);}}
  return {durationSeconds:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate,pcmBytes:count*4,peak,rms:Math.sqrt(sum/Math.max(1,count)),fractionClipped:clipped/Math.max(1,count),initialSilenceSeconds:first/buffer.sampleRate,valid:finite&&peak>0&&buffer.duration>0&&buffer.duration<180&&buffer.numberOfChannels>=1&&buffer.numberOfChannels<=2&&buffer.sampleRate>=8000&&buffer.sampleRate<=192000};
}
$('decode-all').addEventListener('click',async()=>{
  stop();const token=run,rows=[];request=new AbortController();const signal=request.signal;$('decode-all').disabled=true;$('play-clip').disabled=true;report({status:'running',rows});
  try{await unlock();for(const id of Object.keys(SOUND_FILES)){if(token!==run)return;status.textContent=`Decoding ${rows.length+1} / ${Object.keys(SOUND_FILES).length}: ${id}`;
      try{const buffer=await decode(id,signal);if(token!==run)return;rows.push({id,...measure(buffer)});}catch(error){if(token!==run)return;rows.push({id,valid:false,error:String(error.message??error)});}
      report({status:'running',rows});await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(token!==run)return;const passed=rows.filter(row=>row.valid).length;report({status:passed===rows.length?'passed':'failed',scope:'Actual browser decode of local recordings; no automatic playback or human listening verdict.',total:rows.length,passed,rows});status.textContent=`Complete: ${passed} / ${rows.length} recordings decoded with valid samples.`;
  }catch(error){if(token===run){report({status:'failed',error:String(error.message??error),rows});status.textContent='Diagnostic could not run.';}}
  finally{if(token===run){request=null;$('decode-all').disabled=false;$('play-clip').disabled=false;void context?.suspend().catch(()=>{});}}
});
$('play-clip').addEventListener('click',async()=>{
  stop();const token=run,id=$('audio-clip').value;request=new AbortController();const signal=request.signal;
  try{await unlock();const buffer=await decode(id,signal);if(token!==run)return;source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.onended=()=>{if(token!==run)return;source?.disconnect();source=null;status.textContent=`Finished: ${id}`;};source.start();status.textContent=`Playing: ${id}`;}
  catch(error){if(token===run)status.textContent=`Could not play ${id}: ${error.message??error}`;}
});
$('cancel-audio').addEventListener('click',()=>{stop();status.textContent='Stopped. No recording is playing.';report({status:'stopped'});});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();status.textContent='Stopped while this page is hidden.';}});
window.addEventListener('pagehide',()=>{stop();void context?.close().catch(()=>{});context=null;});
