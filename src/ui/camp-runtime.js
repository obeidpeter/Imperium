import {campPresentationFor} from '../core/realtime/camp-world.js';
import {soldierSpec} from '../core/realtime/campaign-encounter.js';
import {departureCheck} from '../core/game.js';

// The camp's way out is marked like an objective once nothing keeps the column in camp (the departure check the
// way out itself runs), so it can be found from wherever the soldier stands: null while something is still to do.
export function campWayOut(state,world){
  const exit=world?.kind==='camp'?(world.objects??[]).find(o=>o.kind==='exit'):null;
  return exit&&state?.phase==='camp'&&!departureCheck(state)?{label:exit.name}:null;
}

// Refresh the walkable camp when the soldier it draws and simulates changes.
// Use the same derived inputs as world creation, so unused training points,
// purse changes, visited flags and pack sorting do not restart an idle camp.
// Legacy soldierSpec is a read-only fallback; inspecting it never adopts one.
// A chest opened or emptied (soldier.opened) refreshes the camp world, not its scenery.
export function campRuntimeKey(state){
  return `camp:${state.chapter}:${state.encounterIndex}:${JSON.stringify({presentation:campPresentationFor(state),
    hero:soldierSpec(state),appearance:state.soldier?.appearance??null,opened:state.soldier?.opened??[]})}`;
}
