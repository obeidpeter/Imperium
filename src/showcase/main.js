import * as Game from '../core/game.js';
import {createShowcaseSession,commandFor,isAlive,tileName} from './session.js';
import {directIntent} from '../ui/direct-controls.js';

const $=id=>document.getElementById(id),names={move:'Move',strike:'Strike',brace:'Brace',throw:'Throw'};
let state=createShowcaseSession(),selected='hero',action='move',target=null,stage=null,busy=false,resultShown=false,Stage=null,graphicsError='';
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');$('motion-setting').checked=motionQuery.matches;
const text=(id,value)=>$(id).textContent=value;
const option=(value,label)=>{const el=document.createElement('option');el.value=value;el.textContent=label;return el;};
const currentUnit=()=>state.encounter.units.find(u=>u.id===selected);
const targets=()=>Game.getTargets(state,selected,action);
function targetLabel(t){return `${t.label??state.encounter.units.find(u=>u.id===t.unitId)?.name??state.encounter.terrain[t.y][t.x]} · ${tileName(t)}`;}
function updatePreview(){
  const command=commandFor(selected,action,target),preview=command?Game.preview(state,command):null;
  text('preview-text',busy?'The order is unfolding. Press Escape to finish its animation.':preview?.message??(action&&targets().length?`${names[action]}: choose a marked position or use the named target controls.`:Game.getActions(state,selected).length?'No targets in reach for this order. Move closer or choose another action.':selected==='hero'?'Your orders are spent. End the turn when ready.':'Lucan acts with the patrol at the end of your turn.'));
  $('confirm-action').disabled=busy||!preview?.ok;text('confirm-action',target?`Confirm ${names[action]?.toLowerCase()??'order'}`:'Confirm order');
  $('target-select').value=target?String(targets().findIndex(t=>t.x===target.x&&t.y===target.y&&t.unitId===target.unitId)):'';
  stage?.setSelection(selected,busy?[]:targets(),busy?null:target);
}
function render(){
  const e=state.encounter,u=currentUnit(),available=Game.getActions(state,selected),focus=document.activeElement?.dataset;
  if(!available.includes(action)){action=available.find(a=>Game.getTargets(state,selected,a).length)??available[0]??null;target=null;}
  text('turn-label',`Turn ${e.turn} / ${e.turnLimit} · ${e.status==='active'?'Your command':e.status==='won'?'Victory':'Battle ended'}`);
  text('objective-label',`${e.objectiveProgress}. ${e.pressure}.`);
  text('selection-name',u?.name??'Your patrol');text('selection-detail',u?`${u.hp}/${u.maxHp} health · ${u.morale} morale · ${tileName(u)}${u.id==='hero'?` · ${u.ammo} javelins · ${u.moved?'Move spent':'Move ready'} · ${u.acted?'Action spent':'Action ready'}`:' · Follows the patrol. '+u.intent}`:'');
  $('roster').replaceChildren(...e.units.filter(u=>['player','ally'].includes(u.side)).map(u=>{
    const b=document.createElement('button');b.type='button';b.className='roster-unit';b.dataset.unit=u.id;b.setAttribute('aria-pressed',String(selected===u.id));b.disabled=busy||!isAlive(u);b.textContent=`${u.id==='hero'?'Aurelius':u.name} · ${u.hp}/${u.maxHp}`;b.onclick=()=>selectUnit(u.id);return b;
  }));
  $('actions').replaceChildren(...Object.entries(names).map(([key,name])=>{
    const b=document.createElement('button');b.type='button';b.className='action-button';b.dataset.action=key;b.textContent=name;b.setAttribute('aria-pressed',String(action===key));b.disabled=busy||!available.includes(key);b.onclick=()=>selectAction(key);return b;
  }));
  $('action-select').replaceChildren(option('','Choose an order'),...available.map(a=>option(a,names[a]??a)));$('action-select').value=action??'';$('action-select').disabled=busy||!available.length;
  $('target-select').replaceChildren(option('','Choose a target'),...targets().map((t,i)=>option(String(i),targetLabel(t))));$('target-select').disabled=busy||!targets().length;
  $('end-turn').disabled=busy||e.status!=='active';$('reset-battle').disabled=busy;
  $('battle-log').replaceChildren(...e.log.slice(-8).reverse().map(entry=>{const li=document.createElement('li');li.textContent=typeof entry==='string'?entry:entry.text??entry.message??String(entry);return li;}));
  updatePreview();
  if(!busy&&focus?.action)$('actions').querySelector(`[data-action="${focus.action}"]`)?.focus({preventScroll:true});
  if(!busy&&focus?.unit)$('roster').querySelector(`[data-unit="${focus.unit}"]`)?.focus({preventScroll:true});
}
function selectUnit(id){if(busy)return;selected=id;target=null;action=Game.getActions(state,id)[0]??null;render();}
function selectAction(value){if(busy)return;action=value;target=null;const list=targets();if(value==='brace'&&list.length===1)target=list[0];render();}
function pick(point){
  if(busy||!point)return;
  const intent=directIntent(state,{selected,action,target,point});
  if(intent.kind==='select')selectUnit(intent.unitId);
  else if(intent.kind==='preview'){action=intent.action;target=intent.target;render();}
  else if(intent.kind==='confirm')commit();
  else if(intent.kind==='inspect'){const u=state.encounter.units.find(u=>u.id===intent.unitId);text('scene-status',u?`${u.name} · ${u.hp}/${u.maxHp} health · ${u.intent}`:`${tileName(point)} · ${state.encounter.terrain[point.y][point.x]}. Choose a highlighted destination.`);}
}
function hover(point){if(busy||target||graphicsError)return;const u=point&&state.encounter.units.find(u=>u.x===point.x&&u.y===point.y&&isAlive(u));text('scene-status',point?`${tileName(point)} · ${u?u.name+' · '+u.hp+'/'+u.maxHp+' health':state.encounter.terrain[point.y][point.x]}`:'Select a marked destination. Drag anywhere to turn the camera.');}
async function execute(command){
  if(busy||state.encounter.status!=='active')return;
  const focusAfter=document.activeElement?.id;
  const before=structuredClone(state.encounter),outcome=command?Game.act(state,command):Game.endTurn(state);
  if(!outcome.ok){text('preview-text',outcome.message);return;}
  busy=true;target=null;render();text('scene-status',command?`${names[command.action]} order committed.`:'The patrol and opposing force take their turns.');
  try{await stage?.play(before,state.encounter,command??{action:'endTurn'});}catch(error){console.error('Battle presentation:',error);graphicsError='The 3D animation was interrupted. Named commands remain available.';stage?.finishMotion();}
  busy=false;selected='hero';render();text('scene-status',graphicsError||outcome.message||'Your next order.');
  if(focusAfter&&['confirm-action','end-turn'].includes(focusAfter)&&state.encounter.status==='active')$(focusAfter==='confirm-action'?'end-turn':focusAfter).focus({preventScroll:true});
  if(state.encounter.status!=='active'&&!resultShown){resultShown=true;const won=state.encounter.status==='won';text('result-title',won?'The road is yours.':'The patrol must withdraw.');text('result-summary',`${won?'You defeated the raiders and their reinforcements.':'The frontier held more than this patrol could bear.'} ${state.encounter.turn} turns · Aurelius ${currentUnit().hp}/${currentUnit().maxHp} health.`);$('result-panel').showModal();}
}
function commit(){const c=commandFor(selected,action,target);if(c)execute(c);}
function makeStage(){
  if(!Stage)return;
  try{stage=new Stage($('scene'),state.encounter,{quality:$('quality').value,reducedMotion:$('motion-setting').checked,onPick:pick,onHover:hover});stage.onError=message=>{graphicsError=message;text('scene-status',message);$('named-controls').open=true;};stage.home();graphicsError='';}
  catch(error){console.error('3D scene unavailable:',error);graphicsError='3D graphics are unavailable in this browser. You can play using the named action and target controls below, or return to the campaign.';$('named-controls').open=true;}
}
function restart(){if(busy)return;$('result-panel').close();stage?.dispose();stage=null;state=createShowcaseSession();selected='hero';action='move';target=null;resultShown=false;makeStage();render();text('scene-status',graphicsError||'A fresh patrol awaits your orders.');}
$('action-select').onchange=e=>selectAction(e.target.value);
$('target-select').onchange=e=>{target=targets()[Number(e.target.value)]??null;if(e.target.value==='')target=null;updatePreview();};
$('confirm-action').onclick=commit;$('end-turn').onclick=()=>execute(null);$('reset-battle').onclick=restart;$('retry-battle').onclick=restart;
$('close-result').onclick=()=>$('result-panel').close();
$('start-battle').onclick=()=>{$('intro-panel').close();window.scrollTo(0,0);$('scene').focus({preventScroll:true});};
function updateGraphicsStats(){const output=$('graphics-stats');if(output){const s=stage?.stats();output.textContent=s?`Graphics: ${s.quality} · ${s.calls} draw calls · ${s.triangles.toLocaleString()} triangles · ${s.textures} textures. These counts describe the current view, not a frame-rate measurement.`:graphicsError;}}
$('help-toggle').onclick=()=>{const open=$('help-panel').hidden;$('help-panel').hidden=!open;$('help-toggle').setAttribute('aria-expanded',String(open));if(open)updateGraphicsStats();};
$('quality').onchange=e=>{stage?.applyQuality(e.target.value);requestAnimationFrame(()=>updateGraphicsStats());};$('motion-setting').onchange=e=>stage?.setReducedMotion(e.target.checked);
$('focus-camera')?.addEventListener('click',()=>stage?.focusSelected());$('home-camera')?.addEventListener('click',()=>stage?.home());
$('scene').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){stage?.finishMotion();target=null;updatePreview();}});
window.addEventListener('pagehide',()=>{stage?.dispose();stage=null;});
window.addEventListener('pageshow',event=>{if(event.persisted){makeStage();render();text('scene-status',graphicsError||'The battlefield is ready.');}});
render();
try{Stage=(await import('./stage.js')).BattleStage;makeStage();}catch(error){console.error('3D module unavailable:',error);graphicsError='The 3D scene could not load. Named battle commands are available below.';$('named-controls').open=true;}
render();text('scene-status',graphicsError||'Aurelius is ready. Move toward the road; Lucan will follow your lead.');$('intro-panel').showModal();
