// The real-time key map (build brief §7, §2.7, §3.14). Bindings name the
// physical key (KeyboardEvent.code), so they follow the key on every layout;
// labels come from the browser's layout map where it has one, or are learnt
// from the keys as they are pressed. The browser keeps its own keys: no F1,
// F3, F5–F7 or F10–F12, nothing with Ctrl, Cmd or Alt, no Alt alone and no
// Tab. Esc, Enter, Tab and the arrows cannot be remapped. Pure, except the
// optional layout lookup.

const digits=['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0'];
export const DEFAULT_KEYMAP=Object.freeze({
  move_up:['ArrowUp'],move_down:['ArrowDown'],move_left:['ArrowLeft'],move_right:['ArrowRight'],
  combat_toggle:['Space'],target_next_enemy:['KeyT'],target_next_friend:['Shift+KeyT'],act_on_target:['Enter'],force_attack_target:['Shift+Enter'],
  interact_nearest:['KeyE'],...Object.fromEntries(digits.map((code,i)=>[`ability_${i+1}`,[code]])),ability_bar:['KeyS'],pause:['KeyP','Pause'],
  slow_time:['KeyV'],step_round:['KeyN'],walk_toggle:['KeyW'],show_usable:['KeyU'],party_prev:['BracketLeft'],party_next:['BracketRight'],
  control_hero:['Home'],...Object.fromEntries([1,2,3,4,5,6].map(n=>[`select_squad_${n}`,[`Shift+Digit${n}`]])),yield_floor:['KeyY'],war_cry:['KeyB'],
  quick_save:['F2'],cancel_or_menu:['Escape'],camera_follow:['KeyF'],camera_overview:['KeyZ'],camera_horizon:['KeyH'],camera_rotate_left:['Comma'],
  camera_rotate_right:['Period'],zoom_in:['Equal','NumpadAdd'],zoom_out:['Minus','NumpadSubtract'],see_through:['KeyX'],show_ranges:['KeyG'],
  panel_kit:['KeyI'],panel_character:['KeyC'],panel_journal:['KeyJ'],panel_orders:['KeyQ'],panel_chronicle:['KeyL'],panel_map:['KeyM'],panel_company:['KeyR'],
  panel_decorations:['KeyA'],panel_options:['KeyO'],map_overlay:['Shift+KeyM'],help:['Shift+Slash']});
// Keys that keep their meaning whatever the player chooses.
export const FIXED_ACTIONS=Object.freeze(['move_up','move_down','move_left','move_right','act_on_target','force_attack_target','cancel_or_menu']);
const FORBIDDEN_CODES=new Set(['F1','F3','F5','F6','F7','F10','F11','F12','Tab','AltLeft','AltRight','MetaLeft','MetaRight','ControlLeft','ControlRight','ContextMenu']);
const FIXED_CODES=new Set(['Escape','Enter','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);

// A binding is a code, optionally after Shift ('Shift+KeyT').
export function bindingProblem(binding){
  const parts=String(binding??'').split('+'),code=parts.pop();
  if(!code)return 'No key chosen.';
  if(parts.some(m=>m!=='Shift'))return 'Ctrl, Cmd and Alt belong to the browser.';
  if(FORBIDDEN_CODES.has(code))return `${code} belongs to the browser.`;
  if(FIXED_CODES.has(code))return `${code} cannot be remapped.`;
  return null;
}
// The binding an event presses: null for anything with Ctrl, Cmd or Alt,
// which the game never takes from the browser.
export function eventBinding(event){
  if(!event||event.ctrlKey||event.metaKey||event.altKey||!event.code)return null;
  return event.shiftKey&&!/^Shift/.test(event.code)?`Shift+${event.code}`:event.code;
}
// The action an event asks for. `?` opens help on every layout.
export function actionFor(event,keymap=DEFAULT_KEYMAP){
  if(event?.key==='?'&&!event.ctrlKey&&!event.metaKey&&!event.altKey)return 'help';
  const binding=eventBinding(event);if(!binding)return null;
  for(const [action,keys]of Object.entries(keymap))if(keys.includes(binding))return action;
  // Shift with an unbound key falls back to the plain key's action (Shift+Space still draws).
  if(binding.startsWith('Shift+')){const plain=binding.slice(6);for(const [action,keys]of Object.entries(keymap))if(keys.includes(plain))return action;}
  return null;
}
// Rebind an action: { keymap } or { problem }. A key already in use swaps the two actions.
export function remapAction(keymap,action,binding){
  if(!keymap[action])return {problem:'Unknown action.'};
  if(FIXED_ACTIONS.includes(action))return {problem:'This key cannot be remapped.'};
  const problem=bindingProblem(binding);if(problem)return {problem};
  const next=Object.fromEntries(Object.entries(keymap).map(([a,keys])=>[a,[...keys]]));
  const holder=Object.keys(next).find(a=>a!==action&&next[a].includes(binding));
  if(holder){if(FIXED_ACTIONS.includes(holder))return {problem:'That key cannot be taken.'};next[holder]=next[holder].map(k=>k===binding?keymap[action][0]:k);}
  next[action]=[binding,...next[action].slice(1).filter(k=>k!==binding)];
  return {keymap:next};
}
// The player's map: the defaults with the changes they made (settings.realtimeKeys), or the
// defaults whole when the stored changes are damaged (a key the browser keeps, a fixed action
// moved, one key for two actions).
export function keymapFrom(changes){
  const map=Object.fromEntries(Object.entries(DEFAULT_KEYMAP).map(([action,keys])=>[action,[...keys]]));
  if(!changes||typeof changes!=='object'||Array.isArray(changes))return map;
  for(const [action,keys]of Object.entries(changes)){
    if(!map[action]||FIXED_ACTIONS.includes(action)||!Array.isArray(keys)||!keys.length||keys.length>2||keys.some(k=>typeof k!=='string'||bindingProblem(k)))return keymapFrom();
    map[action]=[...keys];
  }
  const all=Object.values(map).flat();return new Set(all).size===all.length?map:keymapFrom();
}
// What a map changes from the defaults: what the settings keep.
export const keymapChanges=map=>Object.fromEntries(Object.entries(map).filter(([action,keys])=>keys.join(' ')!==DEFAULT_KEYMAP[action]?.join(' '))
  .map(([action,keys])=>[action,[...keys]]));
// The remappable actions as Menu → Controls & readability lists them (guide "Keyboard" and "Panels").
export const KEY_GROUPS=Object.freeze([
  ['Acting',[['combat_toggle','Draw or sheathe'],['target_next_enemy','Next target'],['target_next_friend','Next friend'],['interact_nearest','Talk to or use the nearest'],
    ['ability_bar','Open the ability bar'],['walk_toggle','Walk everywhere, or run'],['show_usable','Label what you can use (hold)'],['war_cry','War cry']]],
  ['Abilities',Array.from({length:10},(_,i)=>[`ability_${i+1}`,`Ability ${i+1}`])],
  ['Time',[['pause','Pause and resume'],['slow_time','Slow time'],['step_round','Play one round while paused']]],
  ['Party and squads',[['party_prev','Previous party member'],['party_next','Next party member'],['control_hero','Your own soldier'],
    ...Array.from({length:6},(_,i)=>[`select_squad_${i+1}`,`Squad ${i+1} in or out of the selection`])]],
  ['Contests',[['yield_floor','Yield the floor']]],
  ['Camera',[['camera_follow','Follow'],['camera_overview','Overview'],['camera_horizon','Horizon (3D)'],['camera_rotate_left','Turn the view left (3D)'],
    ['camera_rotate_right','Turn the view right (3D)'],['zoom_in','Zoom in'],['zoom_out','Zoom out'],['see_through','See through'],['show_ranges','Show ranges']]],
  ['Panels and saving',[['panel_kit','Kit'],['panel_character','Character'],['panel_journal','Journal'],['panel_orders','Mission orders'],['panel_chronicle','Chronicle'],
    ['panel_map','Map'],['map_overlay','Map over the scene'],['panel_company','Company'],['panel_decorations','Decorations and titles'],['panel_options','Options'],
    ['help','Controls & rules'],['quick_save','Quick save']]]
].map(([title,rows])=>Object.freeze([title,Object.freeze(rows.map(Object.freeze))])));
// Every binding in a map is legal (the defaults included).
export const keymapProblems=keymap=>Object.entries(keymap).flatMap(([action,keys])=>keys.filter(k=>!FIXED_ACTIONS.includes(action)&&!['Escape','Enter',
  'Shift+Enter'].includes(k)&&bindingProblem(k)).map(k=>`${action}: ${k}`));

// Labels for the keys as this layout prints them.
const learnt=new Map();let layout=null;
export async function loadKeyLabels(nav=globalThis.navigator){try{layout=await nav?.keyboard?.getLayoutMap?.()??null;}catch{layout=null;}return !!layout;}
// Without a layout map (Firefox, Safari), learn each key's label as it is pressed.
export function learnKey(event){if(event?.code&&event.key&&event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey)learnt.set(event.code,event.key);}
const NAMES={Space:'Space',Enter:'Enter',Escape:'Esc',Comma:',',Period:'.',Equal:'+',Minus:'−',NumpadAdd:'Num +',NumpadSubtract:'Num −',BracketLeft:'[',
  BracketRight:']',Slash:'/',Home:'Home',Pause:'Pause',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'};
export function keyLabel(binding){
  const parts=String(binding).split('+'),code=parts.pop();
  const own=layout?.get?.(code)??learnt.get(code),base=own?(own.length===1?own.toUpperCase():own):NAMES[code]??code.replace(/^Key|^Digit/,'');
  return [...parts,base].join('+');
}
export const actionLabel=(action,keymap=DEFAULT_KEYMAP)=>keymap[action]?.map(keyLabel).join(' or ')??'';
// The first of an action's keys, for a message that names one.
export const firstKeyLabel=(action,keymap=DEFAULT_KEYMAP)=>keyLabel(keymap[action]?.[0]??'');
