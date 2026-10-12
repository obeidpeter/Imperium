import {deserialize,getChapter,choose,startEncounter} from '../src/core/game.js';
import {drawBattle} from '../src/ui/renderer.js';

const canvas=document.querySelector('#board'),button=document.querySelector('#run');
const status=document.querySelector('#status'),body=document.querySelector('#results');
const label=new URLSearchParams(location.search).get('label')||'current';
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const percentile=(sorted,p)=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];
const environment={label,userAgent:navigator.userAgent,devicePixelRatio:globalThis.devicePixelRatio||1,viewport:[innerWidth,innerHeight],platform:'desktop browser surface; no physical-device claim',measurement:'synchronous drawBattle CPU submission, no GPU flush'};
document.querySelector('#environment').textContent=JSON.stringify(environment);

async function fixture(chapter){
  const response=await fetch('./fixtures/chapter-'+chapter+'-legal-checkpoint.json',{cache:'no-store'});
  if(!response.ok)throw Error('Missing legal checkpoint '+chapter+': '+response.status);
  const state=deserialize(await response.text()),data=getChapter(state);
  if(!state.decisions[data.decision.id]){const result=choose(state,data.decision.options[0].id);if(!result.ok)throw Error(result.message);}
  const result=startEncounter(state);if(!result.ok)throw Error(result.message);
  return state;
}

async function run(){
  button.disabled=true;body.replaceChildren();const rows=[];
  try{
    for(const chapter of [1,11])for(const [width,height] of [[360,420],[720,540]]){
      status.textContent='Measuring chapter '+chapter+' at '+width+' CSS pixels…';
      const state=await fixture(chapter),before=JSON.stringify(state);
      canvas.style.width=width+'px';canvas.style.height=height+'px';
      await nextFrame();
      const draw=()=>drawBattle(canvas,state.encounter,'hero',[],null,chapter,{reducedMotion:true});
      for(let i=0;i<5;i++)draw();
      const samples=[];
      for(let i=0;i<60;i++){await nextFrame();const start=performance.now();draw();samples.push(performance.now()-start);}
      samples.sort((a,b)=>a-b);
      const unchanged=before===JSON.stringify(state);
      const row={label,chapter,encounter:state.encounter.id,width,height,draws:60,warmups:5,medianMs:(samples[29]+samples[30])/2,p95Ms:percentile(samples,.95),stateUnchanged:unchanged};
      rows.push(row);const tr=document.createElement('tr');
      for(const value of [label,chapter+' / '+row.encounter,width+' × '+height,60,row.medianMs.toFixed(3),row.p95Ms.toFixed(3),unchanged?'PASS':'FAIL']){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}body.append(tr);
      if(!unchanged)throw Error('Renderer mutated the isolated chapter '+chapter+' campaign state.');
    }
    document.querySelector('#json').textContent=JSON.stringify({environment,rows},null,2);
    status.textContent='Complete: 240 measured draws; all isolated campaign states unchanged.';
  }catch(error){status.textContent='FAILED: '+error.message;document.querySelector('#json').textContent=JSON.stringify({environment,rows,error:error.message},null,2);}
  finally{button.disabled=false;}
}
button.addEventListener('click',run);run();
