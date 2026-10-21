import {visibleUnitAt,routeSummary} from './direct-controls.js';
import {terrainLabel,fieldLabel} from './tactical-intel.js';

// What the board says about a tile, in words: the readout under the pointer,
// the keyboard cursor's announcement, what selecting empty ground reports and
// the message after a walk. `route` is the walk a click there would make
// (clickRoute in direct-controls.js), or null.
export const gridName=point=>`${point.x+1}${String.fromCharCode(65+point.y)}`;

// What stands on a tile: the visible unit or the ground, and any field object either way.
export function placeName(encounter,point){
  const u=visibleUnitAt(encounter,point);
  return [u?.name,fieldLabel(encounter,point),u?'':terrainLabel(encounter,point)].filter(Boolean).join('. ');
}

// The readout under the pointer: "Side gate (closed) · Open ground · 9C · No passage until opened".
export function hoverText(encounter,point,route){
  if(!point||!encounter)return '';
  const u=visibleUnitAt(encounter,point),field=fieldLabel(encounter,point),walk=routeSummary(route);
  return `${u?u.name+' · ':''}${field?field+' · ':''}${terrainLabel(encounter,point)} · ${gridName(point)}${walk?` · ${walk}`:''}`;
}

// The keyboard cursor: "Grid 9C. Side gate (closed). Open ground. No passage until opened".
export function cursorAnnouncement(encounter,point,route){
  const walk=routeSummary(route);
  return `Grid ${gridName(point)}. ${placeName(encounter,point)}${walk?`. ${walk}`:''}`;
}

// A selection that chose no command: the unit's intent, or why its ground cannot be walked.
export function pointAnnouncement(encounter,point,route){
  const u=visibleUnitAt(encounter,point);
  if(u)return `${u.name}. ${u.intent||'Choose an action or move closer.'}`;
  const why=routeSummary(route);
  return `${placeName(encounter,point)}. ${why?`${why}.`:'Outside this unit’s movement range.'}`;
}

// After a walk: where, at what cost, how far short of the clicked ground, and how to take it back.
export function walkMessage(stop,intent,undoKey){
  const cost=intent.target.cost??intent.route?.cost??1,short=intent.route&&!intent.route.reachable;
  return `Walked to ${gridName(stop)} (${cost} movement).${short?` ${gridName(intent.goal)} is beyond this turn’s reach.`:''} Undo Move (${undoKey}) takes it back until you act.`;
}
