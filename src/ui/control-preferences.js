import {esc} from './view-helpers.js';
import {KEY_GROUPS,keyLabel} from './action-map.js';

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
// The real-time keys (guide "Changing the controls"): Change listens for the next key; one already in
// use swaps the two commands. Esc, Enter, Tab and the arrows keep their meaning, and the browser its own keys.
export function keyPreferences(keymap){
  const now=action=>keymap[action].map(keyLabel).join(' or ');
  return `<details class="key-map" id="settings-key-map"><summary><span id="key-map-title">Keyboard shortcuts</span></summary><p class="settings-description">Choose <strong>Change</strong>, then press a key. Esc cancels. An occupied key swaps the two commands. `+
    `Arrow keys, Enter, Esc, Tab and browser shortcuts stay unchanged.</p><p id="rebind-status" class="settings-description" role="status" aria-live="polite"></p>`+
    KEY_GROUPS.map(([title,rows],i)=>`<details class="key-group" id="settings-key-group-${i}"><summary>${esc(title)}</summary>${rows.map(([action,label])=>`<div class="key-row" data-action="${action}">`+
      `<span>${esc(label)}</span><kbd>${esc(now(action))}</kbd><button class="ghost small" type="button" data-cmd="rebind" data-id="${action}" `+
      `aria-label="Change the key for ${esc(label)}, now ${esc(now(action))}">Change</button></div>`).join('')}</details>`).join('')+
    `<button class="ghost" type="button" data-cmd="reset-keys">Restore default keys</button></details>`;
}
// The pointer's habits and the labels (guide "Controls and readability"): each a stored setting the live field reads.
export const POINTER_SETTINGS=Object.freeze([
  ['draw-to-attack','drawToAttack','Draw to attack','Clicking an enemy draws your weapon.'],
  ['keep-fighting','keepFighting','Keep fighting','After a kill, your soldier engages whoever is attacking him.'],
  ['quick-cast','quickCast','Quick-cast','An ability’s number uses it at the pointer at once.'],
  ['hold-to-move','holdToMove','Hold to move','Hold the mouse button down to keep moving toward the pointer.'],
  ['edge-scroll','edgeScroll','Edge scrolling','The 3D view slides when the pointer reaches the edge of the scene.'],
  ['swap-buttons','swapButtons','Swap mouse buttons','For left-handed play.']]);
function pointerPreferences(settings){
  return POINTER_SETTINGS.map(([id,key,label,hint])=>`<label class="setting" for="${id}"><span>${label}<small class="muted">${hint}</small></span>`+
    `<input id="${id}" type="checkbox" data-rt-setting="${key}" ${settings[key]?'checked':''}></label>`).join('')+
    `<label class="setting" for="labels-setting"><span>Labels<small class="muted">Names over everyone in a crowded scene: while U is held, or always.</small></span>`+
    `<select id="labels-setting" data-rt-setting="labelsAlways"><option value="" ${settings.labelsAlways?'':'selected'}>While U is held</option>`+
    `<option value="1" ${settings.labelsAlways?'selected':''}>Always</option></select></label>`;
}
// The 0.38 board's Confirm moves. Real time has no moves to confirm: there it sits with the board's shortcuts.
export function confirmMovesSetting(settings={}){
  return `<label class="setting" for="confirm-moves"><span>Confirm moves<small class="muted">Off: selecting open ground walks there at once, or as far toward it `+
    `as this turn allows; Undo Move takes it back until you act. On: the first selection previews the move, and selecting it again or Confirm walks.</small>`+
    `</span><input id="confirm-moves" type="checkbox" ${settings.confirmMoves?'checked':''}></label>`;
}
export function controlPreferences(settings={},{keymap=null,readability=true}={}){
  const bindings=controlBindings(settings.keyBindings);
  return `<section class="settings-group control-preferences"><h3>Controls & readability</h3>
    ${keymap?`${keyPreferences(keymap)}<details id="settings-pointer"><summary>Mouse & touch</summary>${pointerPreferences(settings)}`:''}
    ${readability?`<label class="setting" for="high-contrast"><span>High-contrast interface<small class="muted">Stronger boundaries and brighter labels. Unit allegiance also has a symbol.</small></span><input id="high-contrast" type="checkbox" ${settings.highContrast?'checked':''}></label>
    <label class="setting" for="compact-hud"><span>Focus on the battlefield<small class="muted">A compact mission header and camera bar, with full orders still available.</small></span><input id="compact-hud" type="checkbox" ${settings.compactHud!==false?'checked':''}></label>`:''}
    <label class="setting" for="hold-delay"><span>Touch hold delay<small class="muted">${keymap?'How long to hold a finger still to inspect.':'Keep a finger still to inspect a tile. Lifting after a hold spends nothing.'}</small></span><select id="hold-delay">${[250,450,650,900,1200].map(ms=>`<option value="${ms}" ${holdDelay(settings.holdDelay)===ms?'selected':''}>${ms/1000} seconds</option>`).join('')}</select></label>
    ${keymap?`</details><details class="board-shortcuts" id="settings-board-keys"><summary>Turn-based controls</summary>${confirmMovesSetting(settings)}`:''}
    <p class="settings-description">Choose a letter for each shortcut. Choosing an occupied letter swaps the two commands. Arrow keys, Enter, Escape and action keys 1–9 stay available.</p>
    <div class="control-binding-grid">${keys.map(id=>`<label for="binding-${id}">${CONTROL_LABELS[id]}<select id="binding-${id}" data-binding="${id}" aria-label="${CONTROL_LABELS[id]} shortcut">${'abcdefghijklmnopqrstuvwxyz'.split('').map(key=>`<option value="${key}" ${bindings[id]===key?'selected':''}>${key.toUpperCase()}</option>`).join('')}</select></label>`).join('')}</div>
    <button class="ghost" data-cmd="reset-controls">Restore default shortcuts</button>${keymap?'</details>':''}</section>`;
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
