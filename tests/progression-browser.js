import * as G from '../src/core/game.js';
import {operationPlanning,veteranAcademy,agreementConversation,relationshipLedger} from '../src/ui/progression-views.js';
import {esc} from '../src/ui/view-helpers.js';
const fixtures=await fetch(new URL('./fixtures/progression-browser.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Generate the progression fixtures first.');return r.json();});
let state,selected='chapter3-training',events=[];
const view=document.querySelector('#view'),status=document.querySelector('#status'),report=document.querySelector('#report');
function load(){state=G.deserialize(fixtures.checkpoints[selected].payload);render();status.textContent=`Loaded ${selected}: legal checkpoint, isolated memory.`;exportCode();}
function exportCode(){document.querySelector('#save-code').value=G.encodeSave(state);}
function render(){
 const e=state.encounter,agreementTarget=e?.kind==='contest'?e.units.find(u=>G.agreementOptions(state,u.id).enabled):null;
 const decision=state.phase==='camp'&&!state.decisions[G.getChapter(state).decision.id]?`<section><h3>Current chapter decision</h3>${G.getChapter(state).decision.options.map(o=>`<button data-lab="decision" data-id="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</section>`:'';
 const actions=e?.kind==='battle'?`<section><h3>Specialist actions</h3>${e.units.filter(u=>u.specialization).map(u=>`<article><h4>${esc(u.name)} · ${esc(u.specialization)}</h4>${G.getActions(state,u.id).filter(a=>['guard','inspire','volley'].includes(a)).flatMap(a=>G.getTargets(state,u.id,a).slice(0,2).map(t=>`<button data-lab="specialist" data-unit="${esc(u.id)}" data-action="${a}" data-target="${esc(t.unitId)}" data-x="${t.x}" data-y="${t.y}">${esc(a)} → ${esc(t.label)}</button>`)).join('')||'<p>No legal specialist target in current position.</p>'}</article>`).join('')}<button data-lab="end">End turn</button><button data-lab="retry">Retry encounter</button></section>`:'';
 view.innerHTML=`<h2>${esc(state.rank)} · Chapter ${state.chapter} · ${esc(state.phase)}</h2><p>Supplies ${state.supplies} · ${state.history.length} committed encounters${e?` · turn ${e.turn}`:''}</p>${decision}${operationPlanning(state)}${veteranAcademy(state)}${agreementTarget?agreementConversation(state,agreementTarget.id):e?.kind==='contest'?'<p>No agreement is currently available: the commander has spent the speech or has no eligible representative in range.</p><button data-lab="end">End turn</button><button data-lab="retry">Retry encounter</button>':''}${actions}${relationshipLedger(state)}<p>Last campaign event: ${esc(state.log.at(-1)||'')}</p>`;
 for(const d of view.querySelectorAll('details'))d.open=true;
 report.textContent=JSON.stringify({checkpoint:selected,fixtureSource:fixtures.source,routeEvidence:{scope:'Prior automated legal route, not this browser interaction',rank:fixtures.route.rank,encounters:fixtures.route.encounters.length,turns:fixtures.route.turns,specialistActions:fixtures.route.specialistActions,operationChoices:fixtures.route.choices.length,agreements:fixtures.route.agreements.length,exactRetries:fixtures.route.checks.length},browserInteractions:events},null,2);
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.checkpoint){selected=b.dataset.checkpoint;load();return;}
 if(b.id==='reset'){load();return;}if(b.id==='export'){exportCode();status.textContent='Portable code exported from this isolated state. Restore it explicitly in the real game.';return;}
 if(b.id==='checks'){runChecks();return;}
 let r;const id=b.dataset.id,cmd=b.dataset.cmd,lab=b.dataset.lab;
 if(cmd==='operation-choice')r=G.chooseOperation(state,id);
 if(cmd==='specialize-veteran')r=G.specializeVeteran(state,id,document.getElementById(`veteran-path-${id}`).value);
 if(cmd==='agreement-demand'||cmd==='agreement-counter')r=G.negotiateAgreement(state,id,cmd==='agreement-demand'?'demand':'counteroffer');
 if(cmd==='agreement-honour'||cmd==='agreement-break')r=G.settleAgreement(state,id,cmd==='agreement-honour');
 if(lab==='decision')r=G.choose(state,id);
 if(lab==='end')r=G.endTurn(state);if(lab==='retry')r=G.retry(state);
 if(lab==='specialist')r=G.act(state,{unitId:b.dataset.unit,action:b.dataset.action,targetId:b.dataset.target,x:Number(b.dataset.x),y:Number(b.dataset.y)});
 if(r){G.deserialize(G.serialize(state));events.push({command:cmd||lab,ok:r.ok,message:r.message});render();exportCode();status.textContent=r.message;}
});
function runChecks(){
 const checks=[],assert=(name,ok)=>{checks.push({name,pass:Boolean(ok)});if(!ok)throw Error(name);};
 try{
  const s=G.deserialize(fixtures.checkpoints['chapter3-training'].payload),before=G.serialize(s),v=G.veteranTraining(s).veterans.find(v=>v.eligible);assert('Legal Chapter III has an earned eligible veteran',v&&v.service>=2);G.veteranTraining(s);assert('Training read is pure',G.serialize(s)===before);assert('Unknown path rejects without mutation',!G.specializeVeteran(s,v.id,'wizard').ok&&G.serialize(s)===before);assert('Real permanent path command succeeds',G.specializeVeteran(s,v.id,'protector').ok);const trained=G.serialize(s);assert('Changing a permanent path rejects without mutation',!G.specializeVeteran(s,v.id,'leader').ok&&G.serialize(s)===trained);
  const c=G.deserialize(fixtures.checkpoints['chapter7-agreement'].payload),target=c.encounter.units.find(u=>G.agreementOptions(c,u.id).enabled),initial=G.serialize(c);assert('Legal Chapter VII offers a named agreement',target);G.previewAgreement(c,target.id,'counteroffer');assert('Agreement preview is pure',G.serialize(c)===initial);assert('Agreement consumes the commander’s actual speech',G.negotiateAgreement(c,target.id,'counteroffer').ok&&c.encounter.units.find(u=>u.id==='hero').acted);assert('Agreement remains staged until commit',c.progression.agreements.length===0&&c.encounter.staged.agreements.length===1);assert('Retry restores exact agreement-start state',G.retry(c).ok&&G.serialize(c)===initial);
  const legacy=G.newGame();assert('Legacy/default campaigns retain no new progression controls',!G.veteranTraining(legacy).enabled&&!G.operationChoices(legacy).enabled&&!G.coalition(legacy).enabled);
  events.push({scope:'Isolated public-API checks on copied legal fixtures',checks,pass:checks.every(c=>c.pass)});status.textContent=`${checks.length}/${checks.length} isolated API checks passed. Production UI/storage not exercised by these checks.`;
 }catch(error){events.push({checks,error:error.message});status.textContent=`Check failed: ${error.message}`;}
 render();
}
load();
