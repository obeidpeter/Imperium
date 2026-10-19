import {createScenePainting,paintingWeather} from '../src/ui/scene-parallax.js';
import {loadArt} from '../src/ui/art.js';

// Development harness: the browser's animation frames are replaced by a
// manual clock, so a capture shows the painting at an exact time.
let sequence=0;const pending=new Map();
window.requestAnimationFrame=fn=>{pending.set(++sequence,fn);return sequence;};
window.cancelAnimationFrame=id=>{pending.delete(id);};
const step=ms=>{const batch=[...pending.values()];pending.clear();for(const fn of batch)fn(ms);return batch.length;};
const painting=createScenePainting({load:src=>loadArt(src)});
const $=id=>document.getElementById(id),status=text=>{$('status').textContent=text;};
$('chapter').innerHTML=Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function show(){
  const name=$('painting').value,chapter=Number($('chapter').value),seconds=Number($('seconds').value)||0;
  document.documentElement.dataset.arrival=$('arrival').checked?'on':'off';
  painting.release();
  const host=$('host'),img=host.querySelector('img');img.src=`./assets/scenes/${name}.webp`;await img.decode().catch(()=>{});
  status('Mounting…');
  const canvas=painting.mount(host,{chapter,quality:$('quality').value,reducedMotion:$('reduced-motion').checked});
  if(!canvas){status(`Rendered still painting · ${name} · chapter ${chapter} · no canvas`);return;}
  for(let i=0;i<200&&!painting.stats().ready;i++)await wait(25);
  if(!painting.stats().ready){status('Failed · '+JSON.stringify(painting.stats()));return;}
  for(let i=0;i<40&&!pending.size;i++)await wait(25);
  step(0);step(seconds*1000);
  const stats=painting.stats();
  status(`Rendered · ${name} · chapter ${chapter} · ${paintingWeather(img.getAttribute('src'),chapter)} · ${seconds}s · frames ${stats.paintingFrames} · ${canvas.width}×${canvas.height}`);
}
$('show').addEventListener('click',()=>{show().catch(error=>status('Failed · '+error.message));});
globalThis.__painting={painting,step,show};
status('Ready');
