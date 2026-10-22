import {esc} from './view-helpers.js';
import {DEFAULT_KEYMAP,keyLabel,actionLabel} from './action-map.js';

// The in-game Controls & rules: the player guide's chapters (src/data/guide-help.js,
// generated from docs/player-guide-0.40.md by scripts/guide-help.mjs). The keys in
// its Keyboard and Panels tables are shown as the player has set them, the
// default beside a changed one. Pure over the help and the key map.
const changed=(keymap,actions)=>actions.some(a=>keymap[a]?.join(' ')!==DEFAULT_KEYMAP[a]?.join(' '));
export function helpKeys(keymap,actions){
  return actions.length>2?actions.map(a=>keyLabel(keymap[a]?.[0]??'')).join(' '):actions.map(a=>(keymap[a]??[]).map(keyLabel).join(' or ')).join(' / ');
}
export function quickHelp({realtime=true,keymap=DEFAULT_KEYMAP}={}){
  const key=id=>esc(actionLabel(id,keymap));
  return `<section class="help-start" aria-labelledby="help-start-title"><h3 id="help-start-title">Start with these three actions</h3><ol class="help-basics">`+
    `<li><strong>Move</strong><p>Click open ground.${realtime?' Arrow keys also move your soldier.':' Point first to preview the route.'}</p></li>`+
    `<li><strong>${realtime?'Act':'Choose'}</strong><p>${realtime?'Click a person or object to attack, talk or interact.':'Choose an action and target. Read the result, then Confirm.'}</p></li>`+
    `<li><strong>${realtime?'Pause':'End turn'}</strong><p>${realtime?`Press <kbd>${key('pause')}</kbd> to plan. Resume when ready.`:'Let the opposition act when your units are ready.'}</p></li></ol>`+
    `<p class="help-recovery">Need a different approach? Menu → Campaign shows your mission. Retry returns to the encounter’s start.</p></section>`;
}

const plain=html=>html.replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g,' ').replace(/\s+/g,' ').trim();
export function searchHelp(help,query){
  const terms=String(query).toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0,12);
  if(!terms.length)return [];
  return help.pages.map(page=>{
    const text=plain(page.html),hay=`${page.title} ${text}`.toLowerCase();
    if(!terms.every(term=>hay.includes(term)))return null;
    const at=text.toLowerCase().indexOf(terms[0]),start=Math.max(0,at-45);
    return {id:page.id,title:page.title,excerpt:`${start?'…':''}${text.slice(start,start+170)}${text.length>start+170?'…':''}`};
  }).filter(Boolean);
}
export function helpSearchResults(help,query){
  const results=searchHelp(help,query);
  return `<p role="status">${results.length?`${results.length} topic${results.length===1?'':'s'} found.`:'No matching topics. Try “save”, “attack” or “training”.'}</p>`+
    results.map(r=>`<button class="help-search-result" data-cmd="help-section" data-id="${esc(r.id)}"><strong>${esc(r.title)}</strong><span>${esc(r.excerpt)}</span></button>`).join('');
}

export function guideHelpView(help,{page='start',keymap=DEFAULT_KEYMAP}={}){
  const current=help.pages.find(p=>p.id===page)??help.pages.find(p=>p.sections.some(s=>s.id===page))??help.pages[0];
  const body=current.html.replace(/<span class="help-keys" data-actions="([^"]+)">([\s\S]*?)<\/span>/g,(m,list,inner)=>{
    const actions=list.split(',');if(!changed(keymap,actions))return m;
    return `<span class="help-keys changed" data-actions="${list}"><strong>${esc(helpKeys(keymap,actions))}</strong> <small>(by default ${inner})</small></span>`;
  });
  const start=page==='start',topics=[['battles','Fight & survive'],['political-contests','Win a vote'],['your-soldier','Equip & train'],['companions-and-command','Lead your company'],['defeat-retry-and-saving','Save, load & retry']];
  const keyNote=!start&&changed(keymap,Object.keys(DEFAULT_KEYMAP))?'<p class="help-key-note">Shortcuts changed. Key tables show your keys; other reference text uses defaults. <button class="text-link" data-cmd="settings-section" data-id="controls">Settings → Controls</button></p>':'';
  return `<div class="guide-help"><div class="help-search"><label for="help-search">Find help</label><input id="help-search" type="search" placeholder="Try attack, equipment or saving" autocomplete="off" maxlength="120" aria-controls="help-search-results"></div>`+
    `<div id="help-search-results" class="help-search-results" hidden></div><div id="help-browse">${start?quickHelp({keymap})+
    `<nav class="help-topics" aria-label="Help by task">${topics.map(([id,label])=>`<button data-cmd="help-section" data-id="${id}">${label}</button>`).join('')}</nav>`:
    `<button class="text-link help-home" data-cmd="help-section" data-id="start">← Help overview</button><article class="guide-page" aria-labelledby="guide-page-title"><h3 id="guide-page-title" tabindex="-1">${esc(current.title)}</h3>${keyNote}${body}</article>`}`+
    `<details class="guide-index"><summary>All guide topics</summary><nav class="guide-toc" aria-label="The guide’s chapters"><ol>${help.pages.map(p=>`<li><button type="button" class="text-link" `+
    `data-cmd="help-section" data-id="${esc(p.id)}"${p===current?' aria-current="page"':''}>${esc(p.title)}</button></li>`).join('')}</ol></nav>`+
    `</details></div></div>`;
}
