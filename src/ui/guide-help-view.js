import {esc} from './view-helpers.js';
import {DEFAULT_KEYMAP,keyLabel} from './action-map.js';

// The in-game Controls & rules: the player guide's chapters (src/data/guide-help.js,
// generated from docs/player-guide-0.40.md by scripts/guide-help.mjs). The keys in
// its Keyboard and Panels tables are shown as the player has set them, the
// default beside a changed one. Pure over the help and the key map.
const changed=(keymap,actions)=>actions.some(a=>keymap[a]?.join(' ')!==DEFAULT_KEYMAP[a]?.join(' '));
export function helpKeys(keymap,actions){
  return actions.length>2?actions.map(a=>keyLabel(keymap[a]?.[0]??'')).join(' '):actions.map(a=>(keymap[a]??[]).map(keyLabel).join(' or ')).join(' / ');
}
export function guideHelpView(help,{page='quick-reference',keymap=DEFAULT_KEYMAP}={}){
  const current=help.pages.find(p=>p.id===page)??help.pages.find(p=>p.sections.some(s=>s.id===page))??help.pages[0];
  const body=current.html.replace(/<span class="help-keys" data-actions="([^"]+)">([\s\S]*?)<\/span>/g,(m,list,inner)=>{
    const actions=list.split(',');if(!changed(keymap,actions))return m;
    return `<span class="help-keys changed" data-actions="${list}"><strong>${esc(helpKeys(keymap,actions))}</strong> <small>(by default ${inner})</small></span>`;
  });
  return `<div class="guide-help"><nav class="guide-toc" aria-label="The guide’s chapters"><ol>${help.pages.map(p=>`<li><button type="button" class="text-link" `+
    `data-cmd="help-section" data-id="${esc(p.id)}"${p===current?' aria-current="page"':''}>${esc(p.title)}</button></li>`).join('')}</ol></nav>`+
    `<article class="guide-page" aria-labelledby="guide-page-title"><h3 id="guide-page-title" tabindex="-1">${esc(current.title)}</h3>${body}</article></div>`;
}
