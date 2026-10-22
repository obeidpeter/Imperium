import {esc,roman} from './view-helpers.js';
import {ITEMS,SLOTS,WORN_PLACES,PACK} from '../data/items.js';
import {TP,COURSES,TRAINERS,DECORATIONS,TITLES,COMPANIONS,APPEARANCE,PATHS,PAY,quartermasterStock} from '../data/soldier.js';
import {ATTRIBUTES,ATTRIBUTE_NAMES,TRAINING_PATHS,ABILITIES,DAMAGE_TYPES,STANDING} from '../data/realtime-rules.js';
import {soldierAttributes,courseEffects,attributeCost,courseOptions,knownAbilities,wornIds,wearProblem,priceOf,companionWorn,companionRank,
  companionAttributes,areaOf} from '../core/soldier.js';
import {derivedValues,protectionOf} from '../core/realtime/combat.js';
import {summarizeOrders} from '../core/realtime/party.js';
import {summarizeSquadOrders} from '../core/realtime/squad-orders.js';
import {SQUAD_STANDING} from '../data/realtime-squads.js';
import {missionProgress} from '../core/realtime/mission.js';
import {alliedPlans,fieldIntelligence} from '../core/realtime/intel.js';
import {CHAPTERS} from '../data/campaign.js';
import {chapterScene} from './art.js';
import {TRADER_STOCK} from '../data/camps.js';
import {errandList} from '../core/dialogue.js';
import {ATTRIBUTE_EFFECTS,attributeImprovement,equipmentComparison} from './soldier-comparison.js';

// The soldier's panels (guide "Your soldier", build brief §3.12–§3.13): kit
// (I), character (C), decorations and titles (A), company and standing orders
// (R, Q), and the camp's quartermaster and trainers. Pure views over the
// chronicle; every button names a soldier command (Game.soldierCommand) the
// page sends, so a refusal changes nothing.

const button=(kind,label,data={},{primary=false,disabled=false,title=''}={})=>`<button class="${primary?'primary':''}" data-cmd="soldier" data-kind="${esc(kind)}"`+
  `${Object.entries(data).map(([k,v])=>` data-${k}="${esc(v)}"`).join('')}${disabled?' disabled':''}${title?` title="${esc(title)}"`:''}>${esc(label)}</button>`;
const signed=n=>n>0?`+${n}`:`${n}`;
const percent=n=>`${Math.round(n*100)}%`;
const inCamp=state=>state.phase!=='encounter';
const disclosure=(id,label,body)=>`<details id="${esc(id)}" class="soldier-details"><summary>${esc(label)}</summary>${body}</details>`;
const figurePreview=()=>`<figure class="soldier-model"><canvas data-soldier-preview tabindex="0" role="img" aria-label="Your soldier wearing his current kit. Drag or use left and right arrows to rotate."></canvas>`+
  `<figcaption><strong>Current equipped kit</strong><span data-preview-status>Preparing the model…</span></figcaption>`+
  `<div class="soldier-model-controls"><button type="button" data-preview-turn="-1" aria-label="Turn model left">←</button><button type="button" data-preview-reset>Front</button><button type="button" data-preview-turn="1" aria-label="Turn model right">→</button></div></figure>`;
const comparisonView=c=>!c?'':`<section class="kit-comparison" aria-label="Equipment comparison"><h4>If worn: ${esc(c.item)}</h4><p>Replaces ${esc(c.replaced)}.</p>`+
  (c.rows.length?`<table><thead><tr><th>Effect</th><th>Now</th><th>If worn</th></tr></thead><tbody>${c.rows.map(r=>`<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.before)}</td><td>${esc(r.after)}</td></tr>`).join('')}</tbody></table>`:'<p>The displayed combat totals stay the same.</p>')+'</section>';

// The numbers the rules use for the soldier as he stands (or for a companion).
export function soldierValues(state){
  const s=state.soldier;
  return derivedValues({attributes:soldierAttributes(s),kit:wornIds(s),effects:courseEffects(s.courses)});
}
function protectionRows(kit){
  const p=protectionOf({kit});
  return DAMAGE_TYPES.map(t=>`<tr><th scope="row">${t[0].toUpperCase()+t.slice(1)}</th><td>${p[t].absorb}</td><td>${percent(p[t].resist)}</td></tr>`).join('');
}
function itemSummary(id){
  const item=ITEMS[id];if(!item)return '';
  const prot=Object.entries(item.protection).map(([t,v])=>`${t} ${v.absorb}/${percent(v.resist)}`).join(', ');
  const bits=[item.description,prot?`Protection ${prot}.`:'',item.restriction?`Restriction ${item.restriction}.`:'',
    Object.keys(item.bonus??{}).length?`Gives ${Object.entries(item.bonus).map(([k,v])=>`${signed(v)} ${ATTRIBUTE_NAMES[k]}`).join(', ')}.`:'',
    Object.keys(item.requires).length?`Needs ${Object.entries(item.requires).map(([k,v])=>k==='chapter'?`Chapter ${roman(v)}`:`${ATTRIBUTE_NAMES[k]} ${v}`).join(', ')}.`:''];
  return bits.filter(Boolean).join(' ');
}

// I: what the soldier wears by place and layer, his pack grid, the ground strip here, and his coin.
export function kitPanel(state,{selected=null,spoils=[],documents=[]}={}){
  const s=state.soldier;if(!s)return adoptPanel(state);
  const camp=inCamp(state),attrs=soldierAttributes(s),values=soldierValues(state),area=areaOf(state),ground=s.ground[area]??[];
  const worn=WORN_PLACES.filter(place=>s.worn[place]).map(place=>{
    const [slot,layer]=place.split(':'),id=s.worn[place],label=`${SLOTS[slot].name}: ${SLOTS[slot].layers[Number(layer)]}`;
    return `<li class="kit-place"><span class="kit-place-name">${esc(label)}</span>${id?`<strong title="${esc(itemSummary(id))}">${esc(ITEMS[id].name)}</strong>`+
      (camp?button('takeOff','Take off',{place},{title:`Take off the ${ITEMS[id].name}`}):''):'<span class="muted">—</span>'}</li>`;
  }).join('');
  const cells=s.pack.map(e=>{const item=ITEMS[e.id],problem=item.slot?wearProblem(state,e.id,attrs):null;
    return `<button class="pack-item ${selected===e.uid?'is-selected':''} ${problem?'is-dimmed':''}" data-cmd="kit-select" data-id="${esc(e.uid)}"`+
      ` style="grid-column:${e.x+1}/span ${item.shape.w};grid-row:${e.y+1}/span ${item.shape.h}" aria-pressed="${selected===e.uid}"`+
      ` aria-label="${esc(`${item.name}${problem?`, ${problem}`:''}`)}" title="${esc(itemSummary(e.id))}">${esc(item.name)}</button>`;}).join('');
  const chosen=s.pack.find(e=>e.uid===selected),item=chosen&&ITEMS[chosen.id];
  const wearReason=chosen&&item.slot?wearProblem(state,chosen.id,attrs):null;
  const actions=chosen?comparisonView(equipmentComparison(s,chosen.id))+`<div class="kit-actions" role="group" aria-label="${esc(item.name)}"><p><strong>${esc(item.name)}</strong> · ${esc(item.description)}</p>`+
    (camp?(item.slot?button('wear','Wear',{uid:chosen.uid},{primary:true,disabled:!!wearReason,title:wearReason??''}):'')+
      (wearReason?`<p class="panel-note">${esc(wearReason)}</p>`:'')+disclosure('kit-item-actions','Give or leave this item',[
      button('drop','Leave on the ground',{uid:chosen.uid}),
      ...(item.slot&&item.slot!=='charm'?Object.keys(COMPANIONS).filter(id=>(state.company??[]).some(v=>v.id===id)).map(id=>
        button('give',`Give to ${COMPANIONS[id].name}`,{uid:chosen.uid,companion:id})):[])].join('')):'<p class="panel-note">Change your kit in camp.</p>')+
    disclosure('kit-item-details','Item details',`<p>${esc(itemSummary(chosen.id))}</p>`)+'</div>':'';
  return `<div class="kit-panel">
    <section aria-labelledby="kit-worn">${figurePreview()}<h3 id="kit-worn">Equipped</h3><ul class="kit-places">${worn}</ul>
      <p>Restriction <strong>${values.restriction}</strong>${values.restriction>=10?`: ${Math.floor(values.restriction/10)} off Attack and Defence`:''} · `+
      `Weapon <strong>${esc(values.weapon.name??'')}</strong> · Coin <strong>${s.denarii} denarii</strong></p>`+
      disclosure('kit-protection-details','Protection by damage type',`<table class="kit-protection"><caption>Protection (flat / share)</caption><tbody>${protectionRows(wornIds(s))}</tbody></table>`)+
      disclosure('kit-empty-slots','Unused equipment slots',`<ul>${WORN_PLACES.filter(place=>!s.worn[place]).map(place=>{const [slot,layer]=place.split(':');return `<li>${esc(SLOTS[slot].name)}: ${esc(SLOTS[slot].layers[Number(layer)])}</li>`;}).join('')||'<li>All slots are occupied.</li>'}</ul>`)+`</section>
    ${documents.length?`<section aria-labelledby="kit-documents"><h3 id="kit-documents">Documents for this hearing</h3>
      <p class="panel-note">Your earlier service, choices and witnesses give you these. Inspecting one costs nothing; the presiding magistrate receives one, for your soldier’s speech, once a hearing.</p>
      <ul class="kit-documents">${documents.map(d=>`<li><strong>${esc(d.label)}</strong> <small>${esc(d.description)}</small>`+
        `<button data-cmd="inspect-case" data-id="${esc(d.id)}">Inspect</button>${d.presented?' <span class="status-pill">Presented</span>':''}</li>`).join('')}</ul></section>`:''}
    <section aria-labelledby="kit-pack"><h3 id="kit-pack">Pack <small>${PACK.cols} × ${PACK.rows}</small></h3>
      <div class="pack-grid" style="--cols:${PACK.cols};--rows:${PACK.rows}" role="group" aria-label="Pack: choose an item">${cells}</div>
      ${camp?button('sort','Sort'):''}${actions}
      ${ground.length?`<h4>On the ground here</h4><ul class="kit-ground">${ground.map(g=>`<li>${esc(ITEMS[g.id].name)} ${camp?button('pickUp','Pick up',{uid:g.uid}):''}</li>`).join('')}</ul>`:''}
      ${spoils.length?`<h4>Taken in this fight</h4><p>${esc(spoils.map(id=>ITEMS[id]?.name??id).join(', '))}: yours when the result is recorded.</p>`:''}
    </section></div>`;
}

// C: the eight attributes with the numbers they produce, training points, path and courses.
export function characterPanel(state){
  const s=state.soldier;if(!s)return adoptPanel(state);
  const attrs=soldierAttributes(s),v=soldierValues(state),camp=inCamp(state);
  const rows=ATTRIBUTES.map(k=>{const cost=attributeCost(s.base[k]),bonus=attrs[k]-s.base[k];
    const delta=attributeImprovement(state,k),effect=delta.length?delta.map(r=>`${r.label} ${r.before} → ${r.after}`).join(' · '):'No displayed total changes at this step.';
    return `<tr><th scope="row">${esc(ATTRIBUTE_NAMES[k])}</th><td>${attrs[k]}${bonus?` <small>(${s.base[k]} ${signed(bonus)})</small>`:''}</td>`+
      `<td class="attribute-impact"><strong>Next point: ${esc(effect)}</strong>${disclosure(`attribute-help-${k}`,'What this affects',`<p>${esc(ATTRIBUTE_EFFECTS[k])}</p>`)}</td>`+
      `<td>${camp?button('raise',`Raise (${cost} TP)`,{attribute:k},{disabled:s.tp<cost||s.base[k]>=60,title:s.base[k]>=60?'Maximum reached.':s.tp<cost?`Needs ${cost} training points.`:''}):''}</td></tr>`;}).join('');
  const derived=[['Health',v.health],['Stamina',v.stamina],['Attack',v.attack],['Defence',v.defence],['Missile attack',v.missile],['Restriction',v.restriction],
    ['Running speed',`${v.run.toFixed(1)} m/s`]].map(([k,n])=>`<div><dt>${k}</dt><dd>${n}</dd></div>`).join('');
  const abilities=knownAbilities(state).map(id=>`<li><strong>${esc(ABILITIES[id].name)}</strong>: ${esc(ABILITIES[id].summary??'')}</li>`).join('');
  return `<div class="character-panel">
    <p class="soldier-balance"><strong>${s.tp} training points</strong> available · ${esc(TRAINING_PATHS[s.path].name)}${camp?'':' · Spend points in camp'}</p>
    <dl class="derived-values">${derived}</dl>
    <h3>Improve an attribute</h3>
    <table class="attribute-table"><thead><tr><th>Attribute</th><th>Value</th><th>What improves</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    ${disclosure('training-costs','How training costs work',`<p>Raising an attribute costs ${TP.below20} TP below 20, ${TP.from20} from 20, then one more for every ten. You have earned ${s.tpEarned} TP in total.</p>`)}
    ${disclosure('known-techniques',`Known techniques (${knownAbilities(state).length})`,`<ul>${abilities}</ul>`)}
    ${disclosure('completed-courses',`Completed courses (${s.courses.length})`,s.courses.length?`<ul>${s.courses.map(id=>`<li><strong>${esc(COURSES[id].name)}</strong>: ${esc(COURSES[id].summary)}</li>`).join('')}</ul>`:
      '<p>None yet. Visit a trainer in camp to learn a course.</p>')}
  </div>`;
}

// A: decorations and titles, with what each gives and why it was won.
export function decorationsPanel(state){
  const s=state.soldier;if(!s)return adoptPanel(state);
  const list=(ids,table)=>ids.length?`<ul class="honours">${ids.map(id=>`<li><strong>${esc(table[id].name)}</strong> · ${esc(table[id].summary)}${table[id].reason?` ${esc(table[id].reason)}`:''}</li>`).join('')}</ul>`:'<p>None yet.</p>';
  return `<div class="decorations-panel"><h3>Decorations (dona militaria)</h3>${list(s.decorations,DECORATIONS)}<h3>Titles</h3>${list(s.titles,TITLES)}
    <p class="panel-note">Decorations follow clearly marked deeds in the field; titles follow errands and earlier choices. Every bonus always counts.</p></div>`;
}

// R and Q: the company roll, who marches with the soldier, and each companion's standing orders.
export function companyPanel(state,{world=null}={}){
  const s=state.soldier;if(!s)return adoptPanel(state);
  const roll=(state.company??[]).filter(v=>COMPANIONS[v.id]),camp=inCamp(state),party=world?world.party:(s.party??null);
  const chosen=new Set(party??[]),names=Object.fromEntries(roll.map(v=>[v.id,(v.name??COMPANIONS[v.id].name).split(' ').at(-1)]));
  const rows=roll.map(v=>{const profile=COMPANIONS[v.id],rank=companionRank(v),a=companionAttributes(state,v.id),slots=s.orders?.[v.id]??STANDING.presets[profile.preset];
    const fit=(v.recovery??0)===0;
    return `<article class="companion-card"><h4>${esc(v.name??profile.name)} <small>${esc(rank.name)}</small></h4>
      <p>${fit?'Fit for duty':`Recovering (${v.recovery} more ${v.recovery===1?'battle':'battles'})`}</p>
      ${camp&&state.chapter>=3?`<label class="party-choice"><input type="checkbox" data-cmd="soldier-party" data-id="${esc(v.id)}" ${chosen.has(v.id)?'checked':''} ${fit?'':'disabled'}> Marches with you</label>`:''}
      <p class="orders-summary"><strong>Standing orders:</strong> ${esc(summarizeOrders(slots,{hero:'you'}))}</p>
      ${disclosure(`companion-orders-${v.id}`,camp?'Change orders & view attributes':'View squad orders & attributes',`<p>Combat ${a.combat} · Constitution ${a.con} · Agility ${a.agi}</p>`+
        (camp?`<div class="orders-presets" role="group" aria-label="Presets for ${esc(profile.name)}">${Object.entries(STANDING.presetNames).filter(([id])=>id!=='soldier')
        .map(([id,name])=>button('orders',name,{companion:v.id,preset:id})).join('')}${button('orders-edit','Edit the four orders…',{companion:v.id})}</div>`:'')+
        (state.chapter>=4?squadOrdersBlock(state,v,{camp,names}):''))}
    </article>`;}).join('');
  return `<div class="company-panel">${rows||'<p>No companions yet.</p>'}
    ${state.chapter<3?'<p class="panel-note">From Chapter III up to three companions march with you.</p>':''}
    ${camp?'':'<p class="panel-note">Standing orders are set in camp; in the field, choose a portrait (or [ and ]) to take direct control.</p>'}</div>`;
}
// From Chapter IV each deployed veteran's men fight as a squad: its standing
// orders, kept by another officer while he marches with the soldier.
function squadOrdersBlock(state,v,{camp,names}){
  const custom=state.soldier.squadOrders?.[v.id],name=names[v.id];
  return `<div class="squad-orders"><p class="orders-summary"><strong>${esc(name)}’s squad:</strong> ${custom?esc(summarizeSquadOrders(custom,{names}))
    :'the battle’s own orders (hold marked ground in a defence, guard a column, otherwise advance with you and strike what comes near).'}</p>
    ${camp?`<div class="orders-presets" role="group" aria-label="Presets for ${esc(name)}’s squad">${button('squad-orders','The battle’s own',{companion:v.id,preset:'battle'})}`+
      `${Object.entries(SQUAD_STANDING.presetNames).map(([id,label])=>button('squad-orders',label,{companion:v.id,preset:id})).join('')}`+
      `${button('squad-orders-edit','Edit the squad’s orders…',{companion:v.id})}</div>`:''}</div>`;
}
// The four-slot editor for a veteran's squad's standing orders.
export function squadOrdersEditor(state,id){
  const roll=(state.company??[]).filter(v=>COMPANIONS[v.id]),names=Object.fromEntries(roll.map(v=>[v.id,(v.name??COMPANIONS[v.id].name).split(' ').at(-1)]));
  const slots=state.soldier.squadOrders?.[id]??SQUAD_STANDING.presets.line_of_battle;
  const option=(value,label,chosen)=>`<option value="${esc(value??'')}" ${(value??'')===(chosen??'')?'selected':''}>${esc(label)}</option>`;
  const targets=[['hero','you'],['nearest_enemy_group','the nearest enemy group'],['enemy_cavalry','enemy cavalry'],['enemy_archers','enemy archers'],
    ...roll.filter(v=>v.id!==id).map(v=>[`squad:${v.id}`,`${names[v.id]}’s squad`])];
  const row=i=>{const [a,t]=slots[i]??['',null];
    return `<div class="orders-slot"><label>Order ${i+1}<select id="squad-orders-action-${i}"><option value="">None</option>${Object.entries(SQUAD_STANDING.actions).map(([v,l])=>option(v,l,a)).join('')}</select></label>`+
      `<label>Target<select id="squad-orders-target-${i}">${option('','(none)',t)}${targets.map(([v,l])=>option(v,l,t)).join('')}</select></label></div>`;};
  return `<div class="orders-editor" data-squad="${esc(id)}"><p>The first order the squad can carry out wins; the others wait their turn. Advance and Attack follow you; Hold the line takes no target; Screen a flank faces you, enemy cavalry, archers or the nearest group; Guard the standard guards you or another squad.</p>
    ${[0,1,2,3].map(row).join('')}<p class="orders-summary">${esc(summarizeSquadOrders(slots,{names}))}</p>
    <div class="panel-actions"><button class="primary" data-cmd="squad-orders-save" data-id="${esc(id)}">Save the squad’s orders</button></div></div>`;
}
// The four-slot editor for one companion's standing orders.
export function ordersEditor(state,id){
  const s=state.soldier,profile=COMPANIONS[id],slots=s.orders?.[id]??STANDING.presets[profile.preset];
  const option=(value,label,chosen)=>`<option value="${esc(value)}" ${value===chosen?'selected':''}>${esc(label)}</option>`;
  const targets=[...STANDING.enemyTargets,...STANDING.friendTargets],words={hero:'you',hero_target:'your target',hero_attacker:'whoever attacks you',
    nearest_enemy_to_hero:'the enemy nearest you',strongest_enemy:'the strongest enemy',weakest_enemy:'the weakest enemy',enemy_archers:'enemy archers',
    enemy_officer:'an officer or standard-bearer',any_companion:'any companion',any_ally:'any ally'};
  const row=i=>{const [a,t]=slots[i]??['',''];
    return `<div class="orders-slot"><label>Order ${i+1}<select id="orders-action-${i}"><option value="">None</option>${Object.entries(STANDING.actions).map(([v,l])=>option(v,l,a)).join('')}</select></label>`+
      `<label>Target<select id="orders-target-${i}">${targets.map(v=>option(v,words[v],t)).join('')}</select></label></div>`;};
  return `<div class="orders-editor" data-companion="${esc(id)}"><p>The first order he can carry out wins; the others wait their turn. He keeps within 25 metres of you (40 for an attack on a named enemy).</p>
    ${[0,1,2,3].map(row).join('')}<p class="orders-summary" id="orders-summary">${esc(summarizeOrders(slots,{hero:'you'}))}</p>
    <div class="panel-actions"><button class="primary" data-cmd="orders-save" data-id="${esc(id)}">Save orders</button></div></div>`;
}

// The quartermaster: pay, and the shelves for this chapter (buying and selling).
export function quartermasterPanel(state){
  const s=state.soldier;if(!s)return adoptPanel(state);
  const elo=soldierAttributes(s).elo,paid=s.paid.includes(state.chapter);
  const stock=quartermasterStock(state.chapter).map(id=>{const price=priceOf(id,elo),fits=!!s.pack;
    return `<li><div><strong>${esc(ITEMS[id].name)}</strong>${s.denarii<price?`<small>Needs ${price} denarii; you have ${s.denarii}.</small>`:''}${disclosure(`shop-item-${id}`,'Item details',`<p>${esc(itemSummary(id))}</p>`)}</div>${button('buy',`Buy (${price} d)`,{item:id},{disabled:s.denarii<price||!fits,
      title:s.denarii<price?`Needs ${price} denarii.`:''})}</li>`;}).join('');
  const sell=s.pack.filter(e=>!ITEMS[e.id].keep&&ITEMS[e.id].kind!=='quest').map(e=>`<li><span>${esc(ITEMS[e.id].name)}</span>`+
    `${button('sell',`Sell (${priceOf(e.id,elo,{selling:true})} d)`,{uid:e.uid})}</li>`).join('');
  return `<div class="quartermaster-panel"><p>Your purse: <strong>${s.denarii} denarii</strong>. ${paid?'This chapter’s pay is drawn.':
    button('pay',`Draw this chapter’s pay (${PAY[state.chapter]??0} d)`,{},{primary:true})}</p>
    <h3>Buy equipment</h3><ul class="shop-list">${stock}</ul>${disclosure('quartermaster-sell','Sell from your pack',sell?`<ul class="shop-list">${sell}</ul>`:'<p>Nothing to sell.</p>')}
    ${disclosure('quartermaster-prices','How prices work','<p>Prices fall with Eloquence above 10, by up to a fifth. Traders buy at half value.</p>')}</div>`;
}

// A trainer's courses (Campidoctor, Capsarius, Explorator, and later Signifer and Rhetor).
export function trainerPanel(state,trainerId){
  const s=state.soldier;if(!s)return adoptPanel(state);
  const t=TRAINERS[trainerId],options=courseOptions(state,trainerId);
  return `<div class="trainer-panel"><p><strong>${esc(t.name)}</strong>, ${esc(t.title)}. You have <strong>${s.tp}</strong> training points and ${s.denarii} denarii.</p>
    <ul class="shop-list">${options.map(c=>`<li><span><strong>${esc(c.name)}</strong> · ${esc(c.summary)} <small>${c.tp} TP${c.denarii?`, ${c.denarii} denarii`:''}</small></span>`+
      `${c.taken?'<span class="status-pill">Learnt</span>':`<div>${button('course','Learn',{course:c.id},{disabled:!c.available,title:c.reason??''})}${!c.available&&c.reason?`<small>${esc(c.reason)}</small>`:''}</div>`}</li>`).join('')}</ul></div>`;
}

// The one-time choice of training and appearance (a chronicle begun before 0.40 makes it here).
// The recruit's training and appearance (guide "Your recruit"): at New Game, and once for a chronicle begun
// before 0.40. Legionary is chosen first, as the easiest start. Read by the page when the choice is made.
const APPEARANCE_NAMES={hair:'Hair',beard:'Beard',tunic:'Tunic',cloak:'Cloak'};
export function recruitChoices({grants=null}={}){
  const mods=id=>Object.entries(TRAINING_PATHS[id].mods).map(([k,v])=>`${signed(v)} ${ATTRIBUTE_NAMES[k]}`).join(', ');
  return `<fieldset class="recruit-training"><legend>Training</legend>${PATHS.map((id,i)=>`<label class="difficulty-choice"><input type="radio" `+
    `name="recruit-path" value="${id}" ${i===0?'checked':''}><span><strong>${esc(TRAINING_PATHS[id].name)}</strong> <small>${esc(mods(id))}`+
    `${grants?` · ${grants[id]} training points for the service already done`:''}</small></span></label>`).join('')}</fieldset>`+
    `<fieldset class="recruit-appearance"><legend>Appearance</legend>${Object.entries(APPEARANCE).map(([key,list])=>`<label class="setting" `+
    `for="recruit-${key}"><span>${APPEARANCE_NAMES[key]??key}</span><select id="recruit-${key}" data-appearance="${key}">${list.map((name,i)=>`<option `+
    `value="${i}">${esc(name)}</option>`).join('')}</select></label>`).join('')}</fieldset>`;
}
export function adoptPanel(state,{grants=null}={}){
  return `<div class="adopt-panel"><p>This chronicle began before soldiers trained in their own way. Choose his training and appearance once; your `+
    `record is kept. Training sets his starting attributes, and training points raise them later. Choosing also grants the training points the campaign `+
    `could have given him through the chapters you have completed.</p>${recruitChoices({grants})}`+
    `<div class="panel-actions"><button class="primary" data-cmd="adopt-soldier">Choose this training</button></div></div>`;
}

// Q: the mission's orders — the objective and its progress, the capabilities still to demonstrate, and errands.
export function missionOrdersPanel(state,{world=null,requirements=''}={}){
  const chapter=CHAPTERS.find(c=>c.id===state.chapter),e=state.encounter,m=world?.mission;
  const objective=m?.objective??m?.label??e?.objective??chapter?.objective??'';
  const errands=errandList(state).filter(e=>e.stage!=='done');
  return `<div class="mission-orders"><p class="eyebrow">Chapter ${roman(state.chapter)} · ${esc(chapter?.year??'')}</p>
    <h3>${esc(e?.title??chapter?.title??'')}</h3><p>${esc(objective)}</p>${world?`<p><strong>${esc(missionProgress(world))}</strong></p>`:''}
    ${world&&world.kind!=='camp'?disclosure('mission-intelligence','Enemy intelligence & allied plans',fieldIntelligencePanel(world)):''}
    <h3>To demonstrate this chapter</h3><div class="journal-requirements">${requirements}</div>
    <h3>Errands</h3>${errands.length?`<ul>${errands.map(e=>`<li><strong>${esc(e.title)}</strong> (${esc(e.giver)}): ${esc(e.summary)}</li>`).join('')}</ul>`:'<p>No errands in hand.</p>'}</div>`;
}
// The field intelligence (guide "Knowing the enemy") and Allied plans & visible
// threats, in words (intel.js); the panel is drawn again as the field changes.
function fieldIntelligencePanel(world){
  const intel=fieldIntelligence(world),plans=alliedPlans(world),d=intel.doctrine;
  const state=s=>({available:'open',secured:'secured',forgone:'forgone',missed:'missed',closed:'shut',open:'open',damaged:'damaged',repaired:'repaired',
    intact:'standing',dismantled:'dismantled',unlit:'unlit',burning:'burning',spent:'burnt out'})[s]??s;
  const opps=intel.opportunities.length?`<ul>${intel.opportunities.map(o=>`<li><strong>${esc(o.name)}</strong> (${esc(state(o.state))}): ${esc(o.description)}</li>`).join('')}</ul>
    <p>${intel.closes?`Take one before the end of round ${intel.closes}; the other then closes.`:intel.outcome==='secured'?'One opportunity was taken.':'The opportunities have closed.'}</p>`:'';
  const objects=intel.objects.length?`<p>${intel.objects.map(o=>`${esc(o.name)}: ${esc(state(o.state))}${o.action?` (${esc(o.action)})`:''}`).join(' · ')}</p>`:'';
  const threats=plans.threats.length?`<ul>${plans.threats.map(t=>`<li><strong>${esc(t.name)}</strong>${t.role?` · ${esc(t.role)}`:''}: ${esc(t.intent)}${t.target?` Target: ${esc(t.target)}.`:''}${t.distance!==null?` ${t.distance} m away.`:''}</li>`).join('')}</ul>`:'<p>No enemy in sight.</p>';
  return `<section class="field-intel" aria-label="Field intelligence"><h3>Field intelligence</h3>
    ${d?`<p><strong>${esc(d.label)}.</strong> ${esc(d.purpose)}${d.focus?` Their focus: ${esc(d.focus)}.`:''}${d.reserve?` Held in reserve: ${esc(d.reserve)}.`:''}</p>`:''}
    ${intel.approach?`<p><strong>${esc(intel.approach.label)}:</strong> ${esc(intel.approach.description)}</p>`:''}${opps}${objects}</section>
    <section class="allied-plans" aria-label="Allied plans and visible threats"><h3>Allied plans &amp; visible threats</h3>
    ${plans.ours.length?`<ul>${plans.ours.map(o=>`<li><strong>${esc(o.name)}:</strong> ${esc(o.plan)}</li>`).join('')}</ul>`:''}${threats}</section>`;
}
// L: the story so far, a page for each chapter reached: its painting, the camp's passages (the
// chapter's opening, and its close once completed), the decision taken and the battles recorded.
// Lines that taught the 0.38 turn controls are left out: the pages are the story, not instructions.
const TURN_LESSON=/\b(tiles?|turns?|tokens?|select an action|then confirm|command capacity)\b/i;
const present=(state,line)=>!line.when||(line.when==='comradeAlive'?state.decisions?.ch2!=='leave':line.when==='comradeAbsent'?state.decisions?.ch2==='leave':true);
export function chroniclePanel(state){
  const reached=CHAPTERS.filter(c=>c.id<=state.chapter),lines=(c,list)=>(list??[]).filter(l=>present(state,l)&&!TURN_LESSON.test(l.text));
  return `<div class="chronicle-pages">${reached.map(c=>{
    const choice=c.decision?c.decision.options.find(o=>o.id===state.decisions?.[c.decision.id]):null;
    const fought=(state.history??[]).filter(h=>h.chapter===c.id),done=(state.completed??[]).includes(c.id);
    const passage=list=>list.map(l=>`<p><span class="chronicle-voice">${esc(l.speaker)}</span> ${esc(l.text)}</p>`).join('');
    return `<article class="chronicle-page"><img src="${esc(chapterScene(c.id))}" alt="" width="320" height="180" loading="lazy">
      <div><p class="eyebrow">Chapter ${roman(c.id)} · ${esc(c.year)} · ${esc(c.location??'')}</p><h3>${esc(c.title)}</h3>
      <details class="chronicle-passage" ${c.id===state.chapter&&!done?'open':''}><summary>The chapter opens</summary>${passage(lines(c,c.intro))}</details>
      ${choice?`<p><strong>Your choice:</strong> ${esc(choice.label)}. ${esc(choice.consequence??'')}</p>`:''}
      ${fought.length?`<ul>${fought.map(h=>`<li>${esc(h.title??h.id)}</li>`).join('')}</ul>`:''}
      ${done?`<details class="chronicle-passage"><summary>The chapter closes</summary>${passage(lines(c,c.aftermath))}</details>`:c.id===state.chapter?'<p>This page is still being written.</p>':''}
      </div></article>`;
  }).join('')}</div>`;
}

// The camp's card for the soldier: his panels, the quartermaster and the trainers present this chapter.
// (The walkable camp reaches the same people by walking up to them; this is the list path.)
export function soldierCampCard(state){
  if(!state.soldier)return `<section class="sidebar-card soldier-card"><p class="eyebrow">YOUR SOLDIER</p><h3>Choose his training</h3>`+
    `<p>This chronicle began before soldiers trained in their own way. Choose once; your record is kept.</p>`+
    `<button class="full" data-cmd="soldier-panel" data-id="adopt">Choose training →</button></section>`;
  const s=state.soldier,trainers=Object.values(TRAINERS).filter(t=>t.chapter<=state.chapter);
  const link=(id,label,key,arg='')=>`<button class="text-link full" data-cmd="soldier-panel" data-id="${esc(id)}"${arg?` data-arg="${esc(arg)}"`:''}>`+
    `${esc(label)}${key?` <kbd>${esc(key)}</kbd>`:''} <span aria-hidden="true">→</span></button>`;
  return `<section class="sidebar-card soldier-card"><p class="eyebrow">YOUR SOLDIER</p>
    <p class="soldier-balance"><strong>${s.tp} training points</strong> · ${s.denarii} denarii</p>
    <div class="camp-task-links">${link('kit','Equipment','I')}${link('character','Training','C')}
    ${link('company','Company','R')}${link('quartermaster','Trade & pay','')}</div>
    ${disclosure('camp-trainers',`Courses & trainers (${trainers.length})`,trainers.map(t=>link('trainer',`${t.name} · ${t.title.match(/\(([^)]+)\)/)?.[1]??t.title}`,'',t.id)).join(''))}
    ${disclosure('camp-honours','Service honours',link('decorations','Decorations and titles','A'))}</section>`;
}

// The canabae's sutler: her goods for coin, and she buys what you took from the field.
export function traderPanel(state){
  const s=state.soldier;if(!s)return adoptPanel(state);
  const elo=soldierAttributes(s).elo,stock=TRADER_STOCK[state.chapter]??[];
  const goods=stock.map(id=>{const price=priceOf(id,elo);return `<li><div><strong>${esc(ITEMS[id].name)}</strong>${s.denarii<price?`<small>Needs ${price} denarii; you have ${s.denarii}.</small>`:''}${disclosure(`trader-item-${id}`,'Item details',`<p>${esc(itemSummary(id))}</p>`)}</div>`+
    `${button('buy',`Buy (${price} d)`,{item:id,from:'trader'},{disabled:s.denarii<price,title:s.denarii<price?`Needs ${price} denarii.`:''})}</li>`;}).join('');
  const sell=s.pack.filter(e=>!ITEMS[e.id].keep&&ITEMS[e.id].kind!=='quest').map(e=>`<li><span>${esc(ITEMS[e.id].name)}</span>`+
    `${button('sell',`Sell (${priceOf(e.id,elo,{selling:true})} d)`,{uid:e.uid})}</li>`).join('');
  return `<div class="quartermaster-panel"><p>Your purse: <strong>${s.denarii} denarii</strong>.</p><h3>Buy supplies</h3><ul class="shop-list">${goods||'<li>Nothing for sale.</li>'}</ul>
    ${disclosure('trader-sell','Sell from your pack',sell?`<ul class="shop-list">${sell}</ul>`:'<p>Nothing to sell.</p>')}</div>`;
}
