import * as Game from '../src/core/game.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {createPanels} from '../src/ui/panels.js';
import {inspectInterface} from './interface-metrics.js';
const $=selector=>document.querySelector(selector),frame=$('#stage'),escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let fixtures,styles,state,before,current;
function report(){
  const doc=frame.contentDocument;if(!current||!doc)return;
  const result={format:'sacramentum-interface-component-v1',...current,capturedAt:new Date().toISOString(),userAgent:navigator.userAgent,frame:{width:frame.clientWidth,height:frame.clientHeight},renderLeftCampaignUnchanged:Game.serialize(state)===before,interface:inspectInterface(doc),failedImages:[...doc.images].filter(image=>image.getAttribute('src')&&image.complete&&!image.naturalWidth).map(image=>new URL(image.src).pathname),limits:['Component rendering only: no application router, storage, service worker, navigation or save test.','Synthetic stress notices are presentation fixtures, not reproduced platform failures.','Geometry is from this actual desktop-browser frame unless a physical device is separately used.','Production keyboard focus restoration and screen-reader behavior require separate checks.']};
  $('#report').value=JSON.stringify(result,null,2);return result;
}
async function render(){
  const key=$('#checkpoint').value,component=$('#component').value,stress=$('#stress').checked;
  state=['visitor','fresh'].includes(key)?Game.newGame(stress?'Aurelius Maximilianus Valerius Marcellinus':'Aurelius Marcellus'):Game.deserialize(Game.serialize(fixtures.scenes.find(scene=>scene.id===key).state));
  if(stress&&key!=='fresh')state.name='Aurelius Maximilianus Valerius Marcellinus'.slice(0,40);
  before=Game.serialize(state);
  const context={state:key==='visitor'&&component==='titleView'?null:state,screen:component==='titleView'?'title':'game',settings:{textScale:Number($('#text-scale').value),reducedMotion:true,highContrast:$('#contrast').checked,quality:'balanced'},saving:false,lastSaved:'',saveProblem:stress?'Synthetic fixture: this tab could not save because a newer chronicle is open elsewhere. Keep an export before switching tabs.':'',saveConflict:stress,offline:false,currentChapterOffline:false,offlineProgress:stress?'Synthetic fixture: chapter artwork download is incomplete. Retry when a connection is available.':'',artProgress:''};
  let panel=null;const views=createCampaignViews(()=>context);
  Object.assign(context,{showModal:(title,body)=>{panel={title,body};},meters:views.meters,requirements:views.requirements});const panels=createPanels(()=>context);
  let markup;
  if(component.startsWith('show')){
    if(typeof panels[component]!=='function'){$('#status').textContent=`This edition does not expose ${component}; no replacement or fabricated panel was rendered.`;return;}
    panels[component]();markup=state.phase==='epilogue'?views.ending():views.camp();
  }else markup=component==='camp'?(state.phase==='epilogue'?views.ending():views.camp()):views.titleView();
  const [width,height]=$('#size').value.split('x').map(Number);frame.style.width=width+'px';frame.style.height=height+'px';
  current={checkpoint:key,checkpointProvenance:key==='visitor'&&component==='titleView'?'Landing without a saved chronicle':['visitor','fresh'].includes(key)?'New Game through public rules API':fixtures.source,component,syntheticStress:stress,textScale:context.settings.textScale,highContrast:$('#contrast').checked};
  const doc=frame.contentDocument;doc.open();doc.write(`<!doctype html><html lang="en" data-phase="${context.screen==='title'?'title':state.phase}" data-stage="${state.phase==='epilogue'?'imperial':'service'}" data-reduced="true" data-quality="balanced" data-contrast="${$("#contrast").checked?"high":"normal"}" style="--text-scale:${context.settings.textScale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>Component fixture</title>${styles}</head><body><a class="skip" href="#main">Skip to game</a><div id="app">${markup}</div>${panel?`<dialog id="modal" aria-labelledby="panel-title"><div class="modal-head"><div><span class="eyebrow">COMPONENT PREVIEW</span><h2 id="panel-title" tabindex="-1">${escape(panel.title)}</h2></div><button class="ghost" aria-label="Close panel" data-cmd="close-modal">×</button></div><div class="modal-body">${panel.body}</div></dialog>`:''}</body></html>`);doc.close();
  doc.addEventListener('click',event=>{if(event.target.closest('[data-cmd]')){event.preventDefault();$('#status').textContent='Preview control is inert. Use the real application for interaction checks.';}});
  if(panel){doc.querySelector('dialog').showModal();doc.querySelector('#panel-title').focus();}
  await Promise.all([...doc.querySelectorAll('link[rel=stylesheet]')].map(link=>link.sheet?Promise.resolve():new Promise(resolve=>{link.onload=resolve;link.onerror=resolve;})));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));report();$('#capture').disabled=false;$('#status').textContent=`Rendered ${component}. Campaign state unchanged: ${Game.serialize(state)===before}. ${stress?'Synthetic stress case.':'Legal checkpoint presentation.'}`;
}
$('#render').addEventListener('click',()=>render().catch(error=>$('#status').textContent=error.message));$('#capture').addEventListener('click',report);
try{
  const [data,index]=await Promise.all([fetch('./fixtures/graphics-scenes.json').then(response=>response.json()),fetch('../index.html').then(response=>response.text())]);fixtures=data;
  const page=new DOMParser().parseFromString(index,'text/html');styles=[...page.querySelectorAll('link[rel=stylesheet]')].map(link=>`<link rel="stylesheet" href="${escape(link.getAttribute('href'))}">`).join('');
  for(const option of $('#component').options)if(option.value.startsWith('show')&&typeof createPanels(()=>({}))[option.value]!=='function')option.disabled=true;
  $('#render').disabled=false;await render();
}catch(error){$('#status').textContent=`Component lab could not initialize: ${error.message}`;}
