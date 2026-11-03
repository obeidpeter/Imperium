import {campNextTask} from './camp-runtime.js';
import {esc} from './view-helpers.js';

// A spatial guide, including undiscovered places. Buttons below use the normal
// walking command; only the separate fast-travel action needs discovery.
export function campMapView(state,world){
  const task=campNextTask(state,world);if(!task||!world?.places)return '';
  const places=Object.entries(world.places),hero=world.actors.find(a=>a.id===world.heroId);
  const xs=places.map(([,p])=>p.x),zs=places.map(([,p])=>p.z),minX=Math.min(...xs)-8,minZ=Math.min(...zs)-8;
  const width=Math.max(...xs)-minX+8,depth=Math.max(...zs)-minZ+8;
  const x=p=>30+(p.x-minX)/width*580,y=p=>25+(p.z-minZ)/depth*270;
  return `<div class="camp-next-task"><strong>${esc(task.label)}</strong><p>${esc(task.detail)} · ${esc(task.location)}</p><button data-cmd="camp-next">Show me the way</button></div>`+
    `<svg class="camp-navigation-map" viewBox="0 0 640 320" role="img" aria-label="Camp map. Gold marks the next required task; blue marks your soldier. Places are listed below.">`+
    `<rect x="1" y="1" width="638" height="318" rx="12" fill="#e8dfc8" stroke="#a78c56"/>`+
    places.map(([id,p],i)=>`<g><circle cx="${x(p)}" cy="${y(p)}" r="${id===task.place?10:6}" fill="${id===task.place?'#94651d':'#526457'}"/><text class="camp-map-name" x="${x(p)}" y="${y(p)-14}" text-anchor="middle" font-size="13" fill="#202e29">${i+1}. ${esc(p.name)}</text><text class="camp-map-number" x="${x(p)}" y="${y(p)-14}" text-anchor="middle" fill="#202e29">${i+1}</text></g>`).join('')+
    (hero?`<circle cx="${x(hero)}" cy="${y(hero)}" r="5" fill="#247c94" stroke="white" stroke-width="2"/>`:'')+`</svg>`;
}
