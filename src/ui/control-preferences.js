import {esc} from './view-helpers.js';

export const CONTROL_DEFAULTS=Object.freeze({undo:'u',next:'n',endTurn:'e',grid:'g',focus:'f',horizon:'h'});
export const CONTROL_LABELS=Object.freeze({undo:'Undo move',next:'Next ready unit',endTurn:'End turn',grid:'Show grid',focus:'Focus selected unit',horizon:'Horizon camera'});
const keys=Object.keys(CONTROL_DEFAULTS),letter=value=>typeof value==='string'&&/^[a-z]$/i.test(value);
export function controlBindings(input={}){
  // Reject a malformed or ambiguous map as a whole. No command loses its key.
  const proposed=Object.fromEntries(keys.map(id=>[id,letter(input?.[id])?input[id].toLowerCase():CONTROL_DEFAULTS[id]]));
  return new Set(Object.values(proposed)).size===keys.length?proposed:{...CONTROL_DEFAULTS};
}
export function remapControl(input,id,key){
  if(!keys.includes(id)||!letter(key))return null;
  const next=controlBindings(input),value=key.toLowerCase(),other=keys.find(k=>k!==id&&next[k]===value);
  // Swap occupied letters: every action always keeps one unique shortcut.
  if(other)next[other]=next[id];next[id]=value;return next;
}
export function controlAction(key,input){const map=controlBindings(input);return keys.find(id=>map[id]===String(key).toLowerCase())??null;}
export function controlKeys(input){return Object.fromEntries(Object.entries(controlBindings(input)).map(([id,key])=>[id,key.toUpperCase()]));}
export function holdDelay(value){const n=Number(value);return Number.isFinite(n)?Math.round(Math.max(250,Math.min(1200,n))):450;}
export function controlPreferences(settings={}){
  const bindings=controlBindings(settings.keyBindings);
  return `<section class="settings-group control-preferences"><h3>Controls & readability</h3>
    <label class="setting" for="high-contrast"><span>High-contrast interface<small class="muted">Stronger boundaries and brighter labels. Unit allegiance also has a symbol.</small></span><input id="high-contrast" type="checkbox" ${settings.highContrast?'checked':''}></label>
    <label class="setting" for="compact-hud"><span>Focus on the battlefield<small class="muted">A compact mission header and camera bar, with full orders still available.</small></span><input id="compact-hud" type="checkbox" ${settings.compactHud!==false?'checked':''}></label>
    <label class="setting" for="hold-delay"><span>Touch preview delay<small class="muted">Keep a finger still to inspect a tile. Lifting after a hold spends nothing.</small></span><select id="hold-delay">${[250,450,650,900,1200].map(ms=>`<option value="${ms}" ${holdDelay(settings.holdDelay)===ms?'selected':''}>${ms/1000} seconds</option>`).join('')}</select></label>
    <p class="settings-description">Choose a letter for each shortcut. Choosing an occupied letter swaps the two commands. Arrow keys, Enter, Escape and action keys 1–9 stay available.</p>
    <div class="control-binding-grid">${keys.map(id=>`<label for="binding-${id}">${CONTROL_LABELS[id]}<select id="binding-${id}" data-binding="${id}" aria-label="${CONTROL_LABELS[id]} shortcut">${'abcdefghijklmnopqrstuvwxyz'.split('').map(key=>`<option value="${key}" ${bindings[id]===key?'selected':''}>${key.toUpperCase()}</option>`).join('')}</select></label>`).join('')}</div>
    <button class="ghost" data-cmd="reset-controls">Restore default shortcuts</button></section>`;
}
export function controlHelp(settings={}){
  const bindings=controlBindings(settings.keyBindings);
  return `<dl class="control-key-reference">${keys.map(id=>`<div><dt>${CONTROL_LABELS[id]}</dt><dd><kbd>${esc(bindings[id].toUpperCase())}</kbd></dd></div>`).join('')}</dl>`;
}
export function applyControlLabels(html,settings={}){
  // Only use on fixed authored help copy, never rendered player names or state.
  const map=controlBindings(settings.keyBindings);
  // Translate fixed prose once without cascading when two bindings were swapped.
  const tokens=new Map([['Undo Move (U)',`Undo Move (${map.undo.toUpperCase()})`],['key U',`key ${map.undo.toUpperCase()}`],['key N',`key ${map.next.toUpperCase()}`],['N selects',`${map.next.toUpperCase()} selects`],['U takes',`${map.undo.toUpperCase()} takes`],['E ends',`${map.endTurn.toUpperCase()} ends`],['G toggles',`${map.grid.toUpperCase()} toggles`],['H switches',`${map.horizon.toUpperCase()} switches`],['H shows',`${map.horizon.toUpperCase()} shows`],['H for horizon',`${map.horizon.toUpperCase()} for horizon`],['F focuses',`${map.focus.toUpperCase()} focuses`],['(H)',`(${map.horizon.toUpperCase()})`],['aria-keyshortcuts="U"',`aria-keyshortcuts="${map.undo.toUpperCase()}"`],['aria-keyshortcuts="H"',`aria-keyshortcuts="${map.horizon.toUpperCase()}"`]]);
  return html.replace(/Undo Move \(U\)|key U|key N|N selects|U takes|E ends|G toggles|H switches|H shows|H for horizon|F focuses|\(H\)|aria-keyshortcuts="[UH]"/g,token=>tokens.get(token));
}
