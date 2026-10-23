import {campPresentationFor} from '../core/realtime/camp-world.js';
import {soldierSpec} from '../core/realtime/campaign-encounter.js';

// Refresh the walkable camp when the soldier it draws and simulates changes.
// Use the same derived inputs as world creation, so unused training points,
// purse changes, visited flags and pack sorting do not restart an idle camp.
// Legacy soldierSpec is a read-only fallback; inspecting it never adopts one.
export function campRuntimeKey(state){
  return `camp:${state.chapter}:${state.encounterIndex}:${JSON.stringify({presentation:campPresentationFor(state),
    hero:soldierSpec(state),appearance:state.soldier?.appearance??null})}`;
}
