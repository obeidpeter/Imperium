import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {operationPlanning,veteranAcademy,agreementConversation,relationshipLedger} from '../src/ui/progression-views.js';
import {fieldGuide,fieldLesson} from '../src/ui/field-guide.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {playEncounter} from '../scripts/autoplay.mjs';
import {createPanels} from '../src/ui/panels.js';

const clone=x=>JSON.parse(JSON.stringify(x)),checkpoints=new Map();let generated=false;
function camp(id){if(!generated){runProgressionCampaign({onCheckpoint:s=>checkpoints.set(G.getChapter(s).encounters[s.encounterIndex].id,clone(s))});generated=true;}return clone(checkpoints.get(id));}
function start(id){const s=camp(id);assert.ok(G.startEncounter(s).ok);return s;}
function pure(s,fn){const before=G.serialize(s),out=fn();assert.equal(G.serialize(s),before,'Rendering must not alter any campaign or RNG field');return out;}

test('Operation choices show actual resources, conditional next-field benefits and selected state without changing the save',()=>{
  const legacy=G.newGame();assert.equal(operationPlanning(legacy),'');assert.equal(veteranAcademy(legacy),'');assert.equal(relationshipLedger(legacy),'');
  const s=camp('ch1-road'),html=pure(s,()=>operationPlanning(s));
  assert.match(html,/\+2 supplies/);assert.match(html,/\+2 Public Confidence/);assert.match(html,/no veteran withdrawn/);assert.match(html,/one extra javelin/);assert.doesNotMatch(html,/<b>If successful:<\/b> stores/);assert.doesNotMatch(html,/Tradeoff:/);
  assert.ok(G.chooseOperation(s,'screen').ok);assert.match(pure(s,()=>operationPlanning(s)),/data-id="screen" aria-pressed="true"/);
  assert.ok(G.startEncounter(s).ok);assert.equal(operationPlanning(s),'','Operation choice must disappear after departure');
});

test('Earned training controls report eligible veterans without expanding optional training, and escape companion names',()=>{
  const s=start('ch2-rearguard');assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);assert.ok(G.advanceChapter(s).ok);
  const veteran=G.veteranTraining(s).veterans.find(v=>v.eligible);assert.ok(veteran);
  // Isolated display-string fixture; progression is earned by legal commands.
  s.company.find(v=>v.id===veteran.id).name='<img src=x onerror=alert(1)>';
  const html=pure(s,()=>veteranAcademy(s));assert.match(html,/<details id="veteran-academy" class="progression-panel"><summary>Veteran training · \d+ ready<\/summary>/);assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html,/<img src=x/);assert.ok(html.includes(`for="veteran-path-${veteran.id}"`));assert.match(html,/Train permanently/);
  assert.ok(G.specializeVeteran(s,veteran.id,'protector').ok);const trained=pure(s,()=>veteranAcademy(s));assert.ok(!trained.includes(`data-cmd="specialize-veteran" data-id="${veteran.id}"`));assert.match(trained,/Protector/);
});

test('Named negotiation remains discoverable outside range, explains speech ownership and disables spent commands',()=>{
  const s=start('ch7-council'),voters=s.encounter.units.filter(u=>u.role==='voter'),far=voters.find(u=>!G.agreementOptions(s,u.id).enabled),near=voters.find(u=>G.agreementOptions(s,u.id).enabled);assert.ok(far&&near);
  const disabled=pure(s,()=>agreementConversation(s,far.id));assert.match(disabled,/Move within two tiles/);assert.match(disabled,/disabled aria-describedby="agreement-reason-/);assert.match(disabled,/supplies paid later/);
  const ready=pure(s,()=>agreementConversation(s,near.id));assert.match(ready,/even if another speaker is selected/);assert.match(ready,/At most two agreements/);assert.match(ready,/data-cmd="agreement-counter"/);
  assert.ok(G.negotiateAgreement(s,near.id,'demand').ok);const spent=pure(s,()=>agreementConversation(s,near.id));assert.match(spent,/commander must have a speech available/);assert.match(spent,/unavailable now/);
  assert.equal(agreementConversation(s,'hero'),'');
});

test('Ledger explains affordability, auto-opens in compact camp view when due now, and drill never asks for an already-spent action',()=>{
  const s=start('ch7-council'),target=s.encounter.units.find(u=>G.agreementOptions(s,u.id).enabled);assert.ok(G.negotiateAgreement(s,target.id,'demand').ok);
  assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);assert.ok(G.startEncounter(s).ok);assert.equal(playEncounter(s).status,'won');assert.ok(G.commitEncounter(s).ok);assert.ok(G.advanceChapter(s).ok);
  s.supplies=0; // Isolated low-treasury display case; the agreement was earned.
  const ledger=pure(s,()=>relationshipLedger(s));assert.match(ledger,/1 open agreement/);assert.match(ledger,/You need 3 supplies/);assert.match(ledger,/Leave it open/);assert.match(ledger,/data-cmd="agreement-honour"[^>]*disabled/);
  const compact=pure(s,()=>relationshipLedger(s,{compact:true}));assert.match(compact,/<details id="persistent-coalition" class="progression-panel" open><summary>Relationships & agreements · 1 open · 1 due now<\/summary>/);
  const drill=G.newGame('Learner',275,{progression:true});assert.ok(G.choose(drill,G.getChapter(drill).decision.options[0].id).ok);assert.ok(G.startEncounter(drill).ok);
  const move=G.getTargets(drill,'hero','move')[0];assert.ok(G.act(drill,{unitId:'hero',action:'move',x:move.x,y:move.y}).ok);
  const self=G.getTargets(drill,'hero','brace')[0];assert.ok(G.act(drill,{unitId:'hero',action:'brace',x:self.x,y:self.y}).ok);
  const lesson=pure(drill,()=>fieldLesson(drill));assert.match(lesson.title,/End the turn/);assert.equal(lesson.action,undefined);assert.equal(fieldGuide(drill,{enabled:false}),'');
});

test('Ledger distinguishes a legally negotiated pending agreement from committed debt and Retry removes it',()=>{
  const s=start('ch7-council'),target=s.encounter.units.find(u=>G.agreementOptions(s,u.id).enabled);
  assert.ok(G.negotiateAgreement(s,target.id,'counteroffer').ok);
  const staged=s.encounter.staged.agreements[0];assert.equal(G.coalition(s).agreements.some(a=>a.id===staged.id),false);
  const html=pure(s,()=>relationshipLedger(s));assert.match(html,/Pending this Contest · 1/);assert.match(html,/PENDING · NOT COMMITTED/);assert.ok(html.includes(staged.personName));assert.ok(html.includes(staged.pledge));assert.match(html,/1 supplies paid later · due Chapter VIII/);assert.match(html,/Record a victory to commit them/);assert.match(html,/Honour later: −1 supplies, trust \+1, \+1 Political Backing/);assert.doesNotMatch(html,/data-cmd="agreement-(?:honour|break)"/);
  assert.ok(G.retry(s).ok);assert.doesNotMatch(pure(s,()=>relationshipLedger(s)),/Pending this Contest/);assert.equal(G.coalition(s).agreements.some(a=>a.id===staged.id),false);
});

test('Pending ledger promises become a single committed entry only after recording victory',()=>{
  const s=start('ch7-council'),target=s.encounter.units.find(u=>G.agreementOptions(s,u.id).enabled);
  assert.ok(G.negotiateAgreement(s,target.id,'demand').ok);const pledge=s.encounter.staged.agreements[0].pledge;
  assert.equal(playEncounter(s).status,'won');assert.match(pure(s,()=>relationshipLedger(s)),/Pending this Contest · 1/);
  assert.ok(G.commitEncounter(s).ok);const html=pure(s,()=>relationshipLedger(s));assert.doesNotMatch(html,/Pending this Contest/);assert.equal(html.split(pledge).length-1,1);assert.match(html,/1 open agreement/);
});

test('Help describes earned Chapter III specializations and their command requirement',()=>{
  let body='';createPanels(()=>({showModal:(_title,html)=>{body=html;}})).showHelp('full-rules');
  assert.match(body,/two completed deployments to specialize from Chapter III/);assert.match(body,/Specialist actions require available command capacity/);assert.match(body,/formation leader adds one command per round/);assert.match(body,/Ordinary Order unlocks in IV/);assert.doesNotMatch(body,/I–III you control only yourself/);
});

test('Order advance destination selector, 3D playback speed toggle, and Imperial epilogue service summary render cleanly',async()=>{
  const {encounterView,selectedCommand}=await import('../src/ui/encounter-view.js');
  const {createCampaignViews}=await import('../src/ui/campaign-views.js');
  const s=start('ch4-gate');
  const allyTarget=G.getTargets(s,'hero','order')[0];assert.ok(allyTarget?.unitId);
  const destinations=G.allyDestinations(s,allyTarget.unitId);assert.ok(destinations.length>0);
  const chosen=destinations[0];
  const cmd=selectedCommand({selected:'hero',action:'order',target:allyTarget,orderAction:'advance',orderDestination:{x:chosen.x,y:chosen.y}});
  assert.deepEqual(cmd.destination,{x:chosen.x,y:chosen.y});
  assert.ok(G.preview(s,cmd).ok);
  const html=pure(s,()=>encounterView({view3D:true,can3D:true,fastMotion:true,state:s,selected:'hero',action:'order',target:allyTarget,orderAction:'advance',orderDestination:{x:chosen.x,y:chosen.y}}));
  assert.match(html,/id="order-destination"/);
  assert.match(html,/data-cmd="camera-speed" aria-pressed="true"[^>]*>Speed 2×<\/button>/);
  const views=createCampaignViews(()=>({state:s,screen:'game',settings:{}}));
  const epilogueHtml=pure(s,()=>views.ending());
  assert.match(epilogueHtml,/IMPERIAL ARCHIVE · SERVICE SUMMARY/);
  assert.match(epilogueHtml,/epilogue-service-record/);
});
