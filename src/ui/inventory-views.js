import {esc,roman} from './view-helpers.js';
import {ITEMS,SLOTS,WORN_PLACES,PACK} from '../data/items.js';
import {DECORATIONS,TITLES,COMPANIONS,PAY,quartermasterStock,smithStock} from '../data/soldier.js';
import {ATTRIBUTES,ATTRIBUTE_NAMES,TRAINING_PATHS,DAMAGE_TYPES} from '../data/realtime-rules.js';
import {soldierAttributes,courseEffects,wornIds,wearProblem,priceOf,areaOf,campContainerView,packFits} from '../core/soldier.js';
import {CONTAINER_KINDS} from '../data/containers.js';
import {TRADER_STOCK} from '../data/camps.js';
import {derivedValues,protectionOf} from '../core/realtime/combat.js';
import {singleWard} from '../core/realtime/squads.js';
import {equipmentComparison} from './soldier-comparison.js';
import {itemPicture,slotArt} from './item-art.js';

// The inventory (release 13, guide "Your soldier"): one full-screen view over
// the world for the soldier's kit, and for what he finds and trades. His figure
// stands in the middle with the places he wears kit around it; his pack is the
// real 10 × 6 grid; what he left here lies on the ground below; beside them
// stands his character sheet, or the other side of the exchange: a chest's
// contents, a fallen man's belongings, a field's cache or a trader's goods.
// Pure views over the chronicle. Every action is a soldier command (or, in a
// fight, a world command) that the page sends; a refusal changes nothing.

export const SHOPS=Object.freeze({
  quartermaster:Object.freeze({title:'The quartermaster',heading:'The quartermaster’s shelves',stock:state=>quartermasterStock(state.chapter)}),
  smith:Object.freeze({title:'The armourer',heading:'The armourer’s rack',stock:state=>smithStock(state.chapter)}),
  trader:Object.freeze({title:'The sutler',heading:'The sutler’s goods',stock:state=>TRADER_STOCK[state.chapter]??[]})});
// The panels that open the inventory, and the other side each brings.
export const INVENTORY_PANELS=Object.freeze(['kit','quartermaster','smith','trader','container']);
export const otherFor=(name,arg)=>SHOPS[name]?{kind:'shop',shop:name}:name==='container'?{kind:'container',id:arg}:null;

// The worn places beside the figure, head to foot, two to a row so a place's layers sit together: clothing and
// armour on his left, what he carries and the rest on his right (the boots level with the trousers and greaves).
export const DOLL=Object.freeze({left:Object.freeze(['head:0','head:1','body:0','body:1','body:2','body:3','legs:0','legs:1']),
  right:Object.freeze(['weapon:0','shield:0','arms:0','belt:0','charm:0','charm:1','feet:0'])});
export const placeName=place=>{const [slot,layer]=place.split(':'),s=SLOTS[slot];return slot==='charm'?`Charm ${Number(layer)+1}`:s.layers.length>1?s.layers[Number(layer)]:s.name;};

const signed=n=>n>0?`+${n}`:`${n}`;
const percent=n=>`${Math.round(n*100)}%`;
const inCamp=state=>state.phase!=='encounter';
const gradeName=item=>item.grade==='named'?'Named':item.grade==='fine'?'Fine':'';
const disclosure=(id,label,body)=>`<details id="${esc(id)}" class="soldier-details"><summary>${esc(label)}</summary>${body}</details>`;
const button=(kind,label,data={},{primary=false,disabled=false,title='',key=''}={})=>`<button class="${primary?'primary':''}" data-cmd="soldier" data-kind="${esc(kind)}"`+
  `${Object.entries(data).map(([k,v])=>` data-${k}="${esc(v)}"`).join('')}${key?` data-key="${esc(key)}"`:''}${disabled?' disabled':''}${title?` title="${esc(title)}"`:''}>${esc(label)}</button>`;

// What the selection names: a pack piece by its uid, a ground piece by its uid (uids are unique
// across the pack and the ground), a worn place, a container's item, a trader's piece, or loot.
export function selectionOf(state,selected,{other=null}={}){
  const s=state.soldier;if(!s||!selected)return null;
  if(selected.startsWith('worn:')){const place=selected.slice(5);return WORN_PLACES.includes(place)?{from:'worn',place,id:s.worn[place]??null}:null;}
  if(selected.startsWith('shop:')){const id=selected.slice(5);return other?.kind==='shop'&&SHOPS[other.shop].stock(state).includes(id)?{from:'shop',id,shop:other.shop}:null;}
  if(selected.startsWith('box:')){
    const [,container,index]=selected.split(':'),view=other?.kind==='container'&&other.id===container?campContainerView(state,container):null,entry=view?.remaining.find(e=>e.index===Number(index));
    return entry&&view.unlocked?{from:'container',container,index:entry.index,id:entry.itemId}:null;
  }
  const pack=s.pack.find(e=>e.uid===selected);if(pack)return {from:'pack',uid:pack.uid,id:pack.id,x:pack.x,y:pack.y};
  const ground=(s.ground[areaOf(state)]??[]).find(g=>g.uid===selected);if(ground)return {from:'ground',uid:ground.uid,id:ground.id};
  return null;
}

// Dropping a piece on a place: the soldier command it makes, a reason it cannot, or null when nothing would change.
// `from` names the piece as selectionOf does; `to` is {to:'pack',x,y}, {to:'worn',place}, {to:'doll'}, {to:'ground'} or {to:'shop',shop}.
export function dropCommand(state,from,to){
  const s=state.soldier;if(!s||!from||!to)return null;
  const item=ITEMS[from.id];if(!item)return null;
  if(!inCamp(state))return {refusal:'Change your kit in camp.'};
  const fits=(x,y,except=null)=>packFits(s.pack,from.id,x,y,except);
  if(to.to==='pack'){
    if(!Number.isInteger(to.x)||!Number.isInteger(to.y))return null;
    if(from.from==='pack'){if(from.x===to.x&&from.y===to.y)return null;return fits(to.x,to.y,from.uid)?{command:{kind:'move',uid:from.uid,x:to.x,y:to.y}}:{refusal:'It does not fit there.'};}
    if(!fits(to.x,to.y))return {refusal:'It does not fit there.'};
    if(from.from==='worn')return {command:{kind:'takeOff',place:from.place,x:to.x,y:to.y}};
    if(from.from==='ground')return {command:{kind:'pickUp',uid:from.uid,x:to.x,y:to.y}};
    if(from.from==='container')return {command:{kind:'takeFrom',containerId:from.container,indices:[from.index],x:to.x,y:to.y}};
    if(from.from==='shop')return {command:{kind:'buy',itemId:from.id,from:from.shop,x:to.x,y:to.y}};
    return null;
  }
  if(to.to==='worn'||to.to==='doll'){
    if(from.from==='worn')return null;
    if(!item.slot)return {refusal:`The ${item.name} cannot be worn.`};
    if(to.to==='worn'){const [slot,layer]=to.place.split(':');if(item.slot!==slot||(slot!=='charm'&&item.layer!==Number(layer)))
      return {refusal:`The ${item.name} is worn as ${article(placeName(`${item.slot}:${item.layer}`))}.`};}
    if(from.from==='pack'||from.from==='ground'){
      const problem=wearProblem(state,from.id);if(problem)return {refusal:problem};
      return {command:{kind:'wear',uid:from.uid,...(to.to==='worn'&&item.slot==='charm'?{place:to.place}:{})}};
    }
    return {refusal:from.from==='shop'?'Buy it first: drag it into your pack.':'Take it first: drag it into your pack.'};
  }
  if(to.to==='ground'){
    if(from.from==='ground')return null;
    if(item.keep)return {refusal:`You keep the ${item.name}.`};
    if(from.from==='pack')return {command:{kind:'drop',uid:from.uid}};
    if(from.from==='worn')return {command:{kind:'takeOff',place:from.place,ground:true}};
    return {refusal:'Leave it where it is.'};
  }
  if(to.to==='shop'){
    if(from.from==='shop')return null;
    if(from.from!=='pack')return {refusal:from.from==='worn'?'Take it off first: sell from your pack.':'Sell from your pack.'};
    if(item.keep||item.kind==='quest')return {refusal:`You keep the ${item.name}.`};
    return {command:{kind:'sell',uid:from.uid}};
  }
  return null;
}
const article=name=>`${/^[AEIOU]/.test(name)?'an':'a'} ${name.toLowerCase()}`;

// One piece as a draggable tile's data attributes.
const pieceData=(from,data)=>` data-piece="${from}"${Object.entries(data).map(([k,v])=>` data-${k}="${esc(v)}"`).join('')}`;

function wornSocket(state,place,{selected,camp}){
  const s=state.soldier,id=s.worn[place],item=id?ITEMS[id]:null,name=placeName(place),chosen=selected===`worn:${place}`;
  const label=item?`${name}: ${item.name}${item.grade?` (${gradeName(item).toLowerCase()})`:''}`:`${name}: empty`;
  return `<button class="worn-socket${item?'':' is-empty'}${chosen?' is-selected':''}" data-cmd="kit-select" data-id="worn:${esc(place)}" data-key="worn:${esc(place)}" data-drop="worn" data-place="${esc(place)}"`+
    `${item&&camp?pieceData('worn',{place,item:id,w:item.shape.w,h:item.shape.h}):''} aria-pressed="${chosen}" aria-label="${esc(label)}" title="${esc(label)}">`+
    `${item?itemPicture(id):`<span class="item-picture is-empty" data-slot="${esc(place.split(':')[0])}">${slotArt(place.split(':')[0])}</span>`}`+
    `<span class="socket-name">${esc(item?item.name:name)}</span></button>`;
}

function packGrid(state,{selected,camp}){
  const s=state.soldier,attrs=soldierAttributes(s);
  const pieces=s.pack.map(e=>{const item=ITEMS[e.id],problem=item.slot?wearProblem(state,e.id,attrs):null,chosen=selected===e.uid;
    const label=`${item.name}${item.grade?` (${gradeName(item).toLowerCase()})`:''}, ${item.shape.w} by ${item.shape.h}, column ${e.x+1}, row ${e.y+1}${problem?`. ${problem}`:''}`;
    return `<button class="pack-item${chosen?' is-selected':''}${problem?' is-dimmed':''}" data-cmd="kit-select" data-id="${esc(e.uid)}" data-key="pack:${esc(e.uid)}" data-w="${item.shape.w}" data-h="${item.shape.h}"`+
      `${camp?pieceData('pack',{uid:e.uid,item:e.id,w:item.shape.w,h:item.shape.h,x:e.x,y:e.y}):''}`+
      ` style="grid-column:${e.x+1}/span ${item.shape.w};grid-row:${e.y+1}/span ${item.shape.h}" aria-pressed="${chosen}" aria-label="${esc(label)}" title="${esc(itemSummary(e.id))}">`+
      `${itemPicture(e.id)}<span class="pack-item-name">${esc(item.name)}</span>${problem?`<span class="pack-item-need">${esc(problem)}</span>`:''}</button>`;}).join('');
  const used=s.pack.reduce((n,e)=>n+ITEMS[e.id].shape.w*ITEMS[e.id].shape.h,0);
  return `<div class="pack-grid" data-drop="pack" data-key="pack-grid" style="--cols:${PACK.cols};--rows:${PACK.rows}" role="group"`+
    ` aria-label="${esc(`Pack, ${PACK.cols} by ${PACK.rows} places, ${PACK.cols*PACK.rows-used} free`)}">${pieces}`+
    `<span class="pack-ghost" data-key="pack-ghost" aria-hidden="true" hidden></span></div>`;
}

function groundStrip(state,{selected,camp,spoils}){
  const s=state.soldier,ground=s.ground[areaOf(state)]??[];
  const tiles=ground.map(g=>{const item=ITEMS[g.id],chosen=selected===g.uid;
    return `<li><button class="ground-item${chosen?' is-selected':''}" data-cmd="kit-select" data-id="${esc(g.uid)}" data-key="ground:${esc(g.uid)}"`+
      `${camp?pieceData('ground',{uid:g.uid,item:g.id,w:item.shape.w,h:item.shape.h}):''} aria-pressed="${chosen}" title="${esc(itemSummary(g.id))}">`+
      `${itemPicture(g.id)}<span>${esc(item.name)}</span></button></li>`;}).join('');
  return `<section class="inv-ground" data-drop="${camp?'ground':''}" aria-labelledby="inv-ground-title">`+
    `<h3 id="inv-ground-title" class="inv-heading">On the ground here</h3>`+
    `${ground.length?`<ul class="ground-strip">${tiles}</ul>`:`<p class="inv-empty">${camp?'Nothing. Drag a piece here to leave it.':'Nothing.'}</p>`}`+
    `${spoils.length?`<h4>Taken in this fight</h4><ul class="ground-strip is-spoils">${spoils.map(id=>`<li><span class="ground-item">${itemPicture(id)}<span>${esc(ITEMS[id]?.name??id)}</span></span></li>`).join('')}</ul>`+
      '<p class="inv-empty">Yours when the result is recorded.</p>':''}</section>`;
}

export function itemSummary(id){
  const item=ITEMS[id];if(!item)return '';
  const prot=Object.entries(item.protection).map(([t,v])=>`${t} ${v.absorb}/${percent(v.resist)}`).join(', ');
  const bits=[item.description,prot?`Protection ${prot}.`:'',item.restriction?`Restriction ${item.restriction}.`:'',
    Object.keys(item.bonus??{}).length?`Gives ${Object.entries(item.bonus).map(([k,v])=>`${signed(v)} ${ATTRIBUTE_NAMES[k]}`).join(', ')}.`:'',
    Object.keys(item.requires).length?`Needs ${Object.entries(item.requires).map(([k,v])=>k==='chapter'?`Chapter ${roman(v)}`:`${ATTRIBUTE_NAMES[k]} ${v}`).join(', ')}.`:''];
  return bits.filter(Boolean).join(' ');
}
const comparisonView=c=>!c?'':`<section class="kit-comparison" aria-label="Equipment comparison"><h4>If worn: ${esc(c.item)}</h4><p>Replaces ${esc(c.replaced)}.</p>`+
  (c.rows.length?`<table><thead><tr><th>Effect</th><th>Now</th><th>If worn</th></tr></thead><tbody>${c.rows.map(r=>`<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.before)}</td><td>${esc(r.after)}</td></tr>`).join('')}</tbody></table>`:'<p>The displayed combat totals stay the same.</p>')+'</section>';

// The selected piece: what it is, what it would change, and what can be done with it here.
function itemDetails(state,sel,{camp,other}){
  const s=state.soldier;
  if(!sel)return `<div class="inv-details is-empty" data-key="inv-details"><p>${camp?'Choose a piece to see it and what you can do with it<span class="hint-grid">, or drag it: '+
    'onto your soldier to wear it, into the pack to move it, onto the ground to leave it</span>.':'Choose a piece to see it. Kit changes in camp.'}</p></div>`;
  if(sel.from==='worn'&&!sel.id)return `<div class="inv-details" data-key="inv-details"><p><strong>${esc(placeName(sel.place))}</strong>: nothing worn. ${camp?'Drag a piece here from your pack, or choose one there and press Wear.':''}</p></div>`;
  const item=ITEMS[sel.id],elo=soldierAttributes(s).elo,problem=item.slot?wearProblem(state,sel.id):null;
  const where=item.slot?`${SLOTS[item.slot].name}: ${item.slot==='charm'?'Charm':SLOTS[item.slot].layers[item.layer]}`:item.kind==='trophy'?'Trophy':item.kind==='key'?'Key':item.kind==='quest'?'Kept for an errand':'Goods';
  const actions=[];
  if(camp&&sel.from==='pack'){
    if(item.slot)actions.push(button('wear','Wear',{uid:sel.uid},{primary:true,disabled:!!problem,title:problem??'',key:'act-wear'}));
    actions.push(`<button data-cmd="inventory-carry" data-id="${esc(sel.uid)}" data-key="act-carry">Move in pack</button>`);
    if(other?.kind==='shop'&&!item.keep&&item.kind!=='quest')actions.push(button('sell',`Sell (${priceOf(sel.id,elo,{selling:true})} d)`,{uid:sel.uid},{key:'act-sell'}));
  }
  if(camp&&sel.from==='worn')actions.push(button('takeOff','Take off',{place:sel.place},{primary:true,title:`Take off the ${item.name}`,key:'act-takeoff'}));
  if(camp&&sel.from==='ground'){actions.push(button('pickUp','Pick up',{uid:sel.uid},{primary:true,key:'act-pickup'}));
    if(item.slot)actions.push(button('wear','Wear',{uid:sel.uid},{disabled:!!problem,title:problem??'',key:'act-wear'}));}
  if(sel.from==='container')actions.push(button('takeFrom','Take',{container:sel.container,indices:String(sel.index)},{primary:true,key:'act-take'}));
  if(sel.from==='shop'){const price=priceOf(sel.id,elo);actions.push(button('buy',`Buy (${price} d)`,{item:sel.id,from:sel.shop},{primary:true,disabled:s.denarii<price,
    title:s.denarii<price?`Needs ${price} denarii.`:'',key:'act-buy'}));}
  const secondary=camp&&sel.from==='pack'?disclosure('kit-item-actions','Give or leave this item',[
    button('drop','Leave on the ground',{uid:sel.uid}),
    ...(item.slot&&item.slot!=='charm'?Object.keys(COMPANIONS).filter(id=>(state.company??[]).some(v=>v.id===id)).map(id=>
      button('give',`Give to ${COMPANIONS[id].name}`,{uid:sel.uid,companion:id})):[])].join('')):'';
  const compare=item.slot&&sel.from!=='worn'?comparisonView(equipmentComparison(s,sel.id)):'';
  return `<div class="inv-details" data-key="inv-details" aria-label="${esc(item.name)}"><div class="inv-details-head">${itemPicture(sel.id)}<div><h4>${esc(item.name)}</h4>`+
    `<small>${esc([gradeName(item),where,`${item.shape.w} × ${item.shape.h}`].filter(Boolean).join(' · '))}</small></div></div>`+
    `<p>${esc(itemSummary(sel.id))}</p>${problem&&sel.from!=='worn'?`<p class="panel-note">${esc(problem)}</p>`:''}${compare}`+
    `<div class="kit-actions" role="group" aria-label="${esc(item.name)}">${actions.join('')}${secondary}</div>`+
    `${!camp&&sel.from!=='shop'&&sel.from!=='container'?'<p class="panel-note">Change your kit in camp.</p>':''}</div>`;
}

// The soldier's numbers beside his kit: attributes, training points, combat values, honours.
function characterSheet(state){
  const s=state.soldier,attrs=soldierAttributes(s),v=derivedValues({attributes:attrs,kit:wornIds(s),effects:courseEffects(s.courses)});
  const ward=aspect=>Math.round((1-singleWard({kit:wornIds(s)},aspect).factor)*100);
  const attributes=ATTRIBUTES.map(k=>`<div><dt>${esc(ATTRIBUTE_NAMES[k])}</dt><dd>${attrs[k]}${attrs[k]!==s.base[k]?` <small title="${esc(`${s.base[k]} of his own, ${signed(attrs[k]-s.base[k])} from kit, honours and courses`)}">${signed(attrs[k]-s.base[k])}</small>`:''}</dd></div>`).join('');
  const combat=[['Health',v.health],['Stamina',v.stamina],['Attack',v.attack],['Defence',v.defence],['Missile',v.missile],['Restriction',v.restriction],
    ['Running',`${v.run.toFixed(1)} m/s`]].map(([k,n])=>`<div><dt>${k}</dt><dd>${n}</dd></div>`).join('')+
    `<div class="is-wide"><dt>Against squads</dt><dd>${ward('front')}% front · ${ward('flank')}% flank</dd></div>`;
  const honours=[...s.decorations.map(id=>DECORATIONS[id]?.name),...s.titles.map(id=>TITLES[id]?.name)].filter(Boolean);
  const protection=protectionOf({kit:wornIds(s)});
  return `<h3 id="inv-other-title" class="inv-heading">Your soldier</h3>`+
    `<p class="soldier-balance"><strong>${s.tp} training points</strong> · ${esc(TRAINING_PATHS[s.path].name)}</p>`+
    `<dl class="inv-attributes">${attributes}</dl><dl class="inv-combat">${combat}</dl>`+
    disclosure('kit-protection-details','Protection by damage type',`<table class="kit-protection"><caption>Protection (flat / share)</caption><tbody>`+
      `${DAMAGE_TYPES.map(t=>`<tr><th scope="row">${t[0].toUpperCase()+t.slice(1)}</th><td>${protection[t].absorb}</td><td>${percent(protection[t].resist)}</td></tr>`).join('')}</tbody></table>`)+
    `<p class="inv-honours"><strong>Honours:</strong> ${honours.length?esc(honours.join(', ')):'none yet'}.</p>`+
    `<div class="panel-actions inv-links"><button data-cmd="soldier-panel" data-id="character">Training <kbd>C</kbd></button>`+
    `<button data-cmd="soldier-panel" data-id="decorations">Honours <kbd>A</kbd></button></div>`;
}

function documentsBlock(documents){
  return documents.length?`<section class="inv-documents" aria-labelledby="kit-documents"><h3 id="kit-documents" class="inv-heading">Documents for this hearing</h3>
    <p class="panel-note">Your earlier service, choices and witnesses give you these. Inspecting one costs nothing; the presiding magistrate receives one, for your soldier’s speech, once a hearing.</p>
    <ul class="kit-documents">${documents.map(d=>`<li><strong>${esc(d.label)}</strong> <small>${esc(d.description)}</small>`+
      `<button data-cmd="inspect-case" data-id="${esc(d.id)}">Inspect</button>${d.presented?' <span class="status-pill">Presented</span>':''}</li>`).join('')}</ul></section>`:'';
}

// A trader's goods with their prices; the pack's pieces are sold by dragging them here or with Sell.
function shopPane(state,shop,{selected}){
  const s=state.soldier,def=SHOPS[shop],attributes=soldierAttributes(s),elo=attributes.elo,paid=s.paid.includes(state.chapter);
  const goods=def.stock(state).map(id=>{const item=ITEMS[id],price=priceOf(id,elo),chosen=selected===`shop:${id}`,short=s.denarii<price,
    needs=Object.entries(item.requires??{}).filter(([k,v])=>k!=='chapter'&&(attributes[k]??0)<v).map(([k,v])=>`${ATTRIBUTE_NAMES[k]??k} ${v}`);
    return `<li><button class="goods-item${chosen?' is-selected':''}" data-cmd="kit-select" data-id="shop:${esc(id)}" data-key="shop:${esc(id)}"`+
      `${pieceData('shop',{item:id,shop,w:item.shape.w,h:item.shape.h})} aria-pressed="${chosen}" title="${esc(itemSummary(id))}">${itemPicture(id)}`+
      `<span><strong>${esc(item.name)}</strong>${item.grade?` <small class="item-grade">${gradeName(item)}</small>`:''}`+
      `${short?`<small>Needs ${price} denarii; you have ${s.denarii}.</small>`:''}${needs.length?`<small>To wear it: ${esc(needs.join(', '))}.</small>`:''}</span></button>`+
      `${button('buy',`Buy (${price} d)`,{item:id,from:shop},{disabled:short,title:short?`Needs ${price} denarii.`:'',key:`buy:${id}`})}</li>`;}).join('');
  return `<h3 id="inv-other-title" class="inv-heading">${esc(def.heading)}</h3>`+
    `<p class="inv-purse-line">Your purse: <strong>${s.denarii} denarii</strong>.${shop==='quartermaster'?` ${paid?'This chapter’s pay is drawn.':
      button('pay',`Draw this chapter’s pay (${PAY[state.chapter]??0} d)`,{},{primary:true})}`:''}</p>`+
    `<ul class="inv-goods">${goods||'<li class="inv-empty">Nothing for sale.</li>'}</ul>`+
    `<p class="inv-drop-hint">Drag a piece from your pack here to sell it, or choose it and press Sell.</p>`+
    disclosure(`${shop}-prices`,'How prices work',`<p>Prices fall with Eloquence above 10, by up to a fifth. Everyone buys at half value.${shop==='smith'?' Named pieces are never for sale: they are found.':''}</p>`);
}

// A camp chest: its lock and the two ways to open it, then what is still inside.
function containerPane(state,id,{selected}){
  const s=state.soldier,view=campContainerView(state,id);
  if(!view)return '<h3 id="inv-other-title" class="inv-heading">Container</h3><p>There is nothing here.</p>';
  const c=view.container,kind=CONTAINER_KINDS[c.kind]?.name??'Container';
  const head=`<h3 id="inv-other-title" class="inv-heading">${esc(c.name)}</h3><p class="panel-lead"><span class="eyebrow">${esc(kind)}</span> ${esc(c.text)}</p>`;
  if(!view.unlocked){
    const key=c.lock.key,hasKey=s.pack.some(p=>p.id===key),attributes=soldierAttributes(s),need=Object.entries(c.lock.force??{}),
      needs=need.map(([k,v])=>`${ATTRIBUTE_NAMES[k]??k} ${v}`).join(', '),strong=need.length>0&&need.every(([k,v])=>(attributes[k]??0)>=v);
    return head+`<p><strong>Locked.</strong> ${hasKey?`You carry the ${esc(ITEMS[key].name.toLowerCase())}.`:'Its key is somewhere in this camp.'}</p>`+
      `<div class="panel-actions">${button('unlock','Use the key',{container:id,method:'key'},{primary:hasKey,disabled:!hasKey,title:hasKey?'':'You do not carry its key.'})}`+
      `${need.length?button('unlock',`Force the lock (${needs})`,{container:id,method:'force'},{disabled:!strong,title:strong?'':`Forcing it needs ${needs}.`}):''}</div>`;
  }
  if(view.empty)return head+'<p class="inv-empty">It is empty.</p>';
  const rows=view.remaining.map(e=>{const item=ITEMS[e.itemId],chosen=selected===`box:${id}:${e.index}`;
    return `<li><button class="goods-item${chosen?' is-selected':''}" data-cmd="kit-select" data-id="box:${esc(id)}:${e.index}" data-key="box:${esc(id)}:${e.index}"`+
      `${pieceData('container',{container:id,index:e.index,item:e.itemId,w:item.shape.w,h:item.shape.h})} aria-pressed="${chosen}" title="${esc(itemSummary(e.itemId))}">`+
      `${itemPicture(e.itemId)}<span><strong>${esc(item.name)}</strong>${item.grade?` <small class="item-grade">${gradeName(item)}</small>`:''}</span></button>`+
      `${button('takeFrom','Take',{container:id,indices:String(e.index)},{key:`take:${e.index}`})}</li>`;}).join('');
  return head+`<ul class="inv-goods">${rows}</ul><div class="panel-actions">${button('takeFrom','Take all',{container:id},{primary:true,key:'take-all'})}</div>`+
    '<p class="inv-drop-hint">Drag a piece into your pack to put it where you want it. What does not fit stays inside.</p>';
}

// In a fight: a fallen man's belongings or a field's cache, taken with world commands (the page's rt-take and
// rt-take-from); what is taken waits in "Taken in this fight" until the result is recorded.
function lootPane(other){
  const {title,id,left,pending,cmd,empty}=other,waiting=[...pending];
  const rows=left.map((item,i)=>{const at=waiting.indexOf(item),taken=at>=0;if(taken)waiting.splice(at,1);
    return `<li><span class="goods-item">${itemPicture(item)}<span><strong>${esc(ITEMS[item]?.name??item)}</strong></span></span>`+
      `${taken?'<span class="status-pill">Taken</span>':`<button data-cmd="${cmd}" data-id="${esc(id)}" data-item="${esc(item)}" data-key="${cmd}:${i}">Take</button>`}</li>`;}).join('');
  return `<h3 id="inv-other-title" class="inv-heading">${esc(title)}</h3>`+(left.length?`<ul class="inv-goods">${rows}</ul>`+
    `<div class="panel-actions"><button class="primary" data-cmd="${cmd}" data-id="${esc(id)}" data-item="*" data-key="${cmd}:all">Take all</button></div>`+
    '<p class="panel-note">What you take goes to your pack when the result is recorded.</p>':`<p class="inv-empty">${esc(empty)}</p>`);
}

function otherPane(state,other,{selected,documents}){
  const kind=other?.kind??'sheet';
  const body=kind==='shop'?shopPane(state,other.shop,{selected}):kind==='container'?containerPane(state,other.id,{selected}):kind==='loot'?lootPane(other):characterSheet(state);
  return `<aside class="inv-other" data-other="${kind}"${kind==='shop'?` data-drop="shop" data-shop="${esc(other.shop)}"`:''} aria-labelledby="inv-other-title">`+
    `${kind==='sheet'?documentsBlock(documents):''}${body}</aside>`;
}
const tabName=other=>!other?'Soldier':other.kind==='shop'?'Goods':'Contents';

// I (and the traders, chests and the fallen): the whole inventory. `other` is null (the character sheet),
// {kind:'shop',shop}, {kind:'container',id} or {kind:'loot',title,id,left,pending,cmd,empty}.
export function inventoryScreen(state,{selected=null,spoils=[],documents=[],other=null,tab=null,previewStatus='Preparing the model…'}={}){
  const s=state.soldier,camp=inCamp(state),sel=selectionOf(state,selected,{other});
  const values=derivedValues({attributes:soldierAttributes(s),kit:wornIds(s),effects:courseEffects(s.courses)});
  const current=tab??(other?'other':'pack'),tabs=[['worn','Worn'],['pack','Pack'],['ground','Ground'],['other',tabName(other)]];
  const sockets=side=>DOLL[side].map(place=>wornSocket(state,place,{selected,camp})).join('');
  return `<div class="inventory" data-inventory data-tab="${esc(current)}" data-other="${esc(other?.kind??'sheet')}" data-camp="${camp}">
    <div class="inventory-tabs" role="tablist" aria-label="Inventory sections">${tabs.map(([id,label])=>`<button role="tab" data-cmd="inventory-tab" data-id="${id}" data-key="tab:${id}"`+
      ` aria-selected="${current===id}" aria-controls="inv-${id}">${esc(label)}</button>`).join('')}</div>
    <section class="inv-doll" id="inv-worn" data-section="worn" aria-labelledby="kit-worn"><h3 id="kit-worn" class="inv-heading">Equipped</h3>
      <div class="doll"><div class="doll-side" role="group" aria-label="Clothing and armour">${sockets('left')}</div>`+
      `<figure class="soldier-model" data-key="soldier-model" data-drop="${camp?'doll':''}"><canvas data-soldier-preview data-key="soldier-preview" tabindex="0" role="img" aria-label="Your soldier wearing his current kit. Drag or use left and right arrows to rotate."></canvas>`+
      `<figcaption><span data-preview-status>${esc(previewStatus)}</span></figcaption>`+
      `<div class="soldier-model-controls"><button type="button" data-preview-turn="-1" aria-label="Turn model left">←</button><button type="button" data-preview-reset>Full kit</button>`+
      `<button type="button" data-preview-detail>Face</button><button type="button" data-preview-turn="1" aria-label="Turn model right">→</button></div></figure>`+
      `<div class="doll-side" role="group" aria-label="Arms and the rest">${sockets('right')}</div></div>
      <p class="inv-summary">Restriction <strong>${values.restriction}</strong>${values.restriction>=10?`: ${Math.floor(values.restriction/10)} off Attack and Defence`:''} · `+
      `Weapon <strong>${esc(values.weapon.name??'')}</strong></p></section>
    <div class="inv-middle"><section class="inv-pack" id="inv-pack" data-section="pack" aria-labelledby="kit-pack"><div class="inv-pack-head"><h3 id="kit-pack" class="inv-heading">Pack <small>${PACK.cols} × ${PACK.rows}</small></h3>`+
      `<span class="inv-purse">${s.denarii} denarii</span>${camp?button('sort','Sort',{},{key:'sort'}):''}</div>
      ${packGrid(state,{selected,camp})}</section>
    <div id="inv-ground" class="inv-ground-wrap" data-section="ground">${groundStrip(state,{selected,camp,spoils})}</div></div>
    <div class="inv-details-wrap" data-section="details">${itemDetails(state,sel,{camp,other})}</div>
    <div id="inv-other" class="inv-other-wrap" data-section="other">${otherPane(state,other,{selected,documents})}</div>
    <p class="sr-only" data-inventory-status aria-live="polite"></p>
  </div>`;
}
