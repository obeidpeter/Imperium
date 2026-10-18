import {createCeremonyController} from '../src/ui/ceremony-controller.js';
const $=id=>document.getElementById(id),status=$('status');
const controller=createCeremonyController({onError:message=>{status.textContent=`Failed: ${message}`;}});
async function show(){
  status.textContent='Running…';const host=$('host');host.dataset.ceremony=$('kind').value;controller.release();
  controller.mount(host,{kind:$('kind').value,name:'Aurelius Marcellus',quality:$('quality').value,reducedMotion:$('reduced-motion').checked,figureStyle:$('figure-style').value});
  for(let i=0;i<600&&!controller.stage;i++)await new Promise(r=>setTimeout(r,50));
  await new Promise(r=>setTimeout(r,1800));
  status.textContent=controller.stage?`Rendered ${$('kind').value}.`:'Failed: no stage.';
}
$('show').addEventListener('click',show);status.textContent='Ready.';
