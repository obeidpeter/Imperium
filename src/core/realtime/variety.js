import {FIELD_WEATHERS,PLACES,TEMPERAMENTS} from '../../data/realtime-variety.js';
import {FIELD_OBJECT_PLACES,fieldTileFree} from '../expanded-campaign.js';
import {pickWeighted,randomInt} from './rng-streams.js';

// A battle's variety (worlds and gameplay plan, release 3): drawn from the
// world stream once, before the world is built, from the 0.38 encounter
// record, which it never changes. The weather within the chapter's set (an
// explicit choice keeps its own); each field object on one of the nearest free
// tiles to the place 0.38 reserves for it; Chapter III's hidden man on one of
// the nearest free tiles to his own; each reinforcement's entry on its tile or
// a neighbour; and each enemy band's temperament. Pure.

const near=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),far=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const byNearness=from=>(a,b)=>near(a,from)-near(b,from)||a.y-b.y||a.x-b.x;
const pick=(streams,list,n)=>list[randomInt(streams,'world',0,Math.min(n,list.length)-1)];
const tiles=e=>{const out=[];for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(fieldTileFree(e,{x,y}))out.push({x,y});return out;};

export function battleVariety(state,e,streams){
  const out={weather:e.weather??null,objects:{},hidden:{},waves:[],temperaments:{},band:null};
  if(e.type==='training'||e.mission?.mode==='training')return out;
  // The weather: an explicit choice (Archive practice, a test) is kept.
  const given=['clear','rain','embers','dust','mist'].includes(state.encounterOptions?.weather);
  const set=FIELD_WEATHERS[state.chapter];if(set&&!given)out.weather=pickWeighted(streams,'world',set);
  const free=tiles(e),living=e.units.filter(u=>u.hp>0);
  // Field objects: the tile 0.38 chose is the nearest free one to its place; the next nearest are as good.
  const objects=e.field?.objects??[],taken=new Set(objects.map(o=>`${o.x},${o.y}`));
  for(const o of [...objects].sort((a,b)=>a.id.localeCompare(b.id))){
    const place=FIELD_OBJECT_PLACES[o.kind];if(!place)continue;taken.delete(`${o.x},${o.y}`);
    const options=free.filter(p=>!taken.has(`${p.x},${p.y}`)&&!living.some(u=>u.x===p.x&&u.y===p.y)&&near(p,e.goal)>1).sort(byNearness(place));
    const chosen=options.length?pick(streams,options,PLACES.objects):{x:o.x,y:o.y};taken.add(`${chosen.x},${chosen.y}`);out.objects[o.id]={x:chosen.x,y:chosen.y};
  }
  // A man hidden at the start (Chapter III): his tile or one of the nearest free ones within two.
  for(const u of living.filter(u=>u.hidden).sort((a,b)=>a.id.localeCompare(b.id))){
    const options=free.filter(p=>far(p,u)<=PLACES.hiddenReach&&!living.some(v=>v!==u&&v.x===p.x&&v.y===p.y)).sort(byNearness(u));
    if(options.length)out.hidden[u.id]=pick(streams,options,PLACES.hidden);
  }
  // Reinforcements: each enters on its own tile or a free neighbour.
  for(const w of e.mission?.waves??[]){
    const options=free.filter(p=>near(p,w)<=1).sort(byNearness(w));out.waves.push(options.length?pick(streams,options,PLACES.waves):{x:w.x,y:w.y});
  }
  // Temperaments: each enemy band of squads (from Chapter IV), or the one war band before it.
  const weights=TEMPERAMENTS.weights;
  if(state.chapter>=4)for(const u of living.filter(u=>u.side==='enemy').sort((a,b)=>a.id.localeCompare(b.id)))out.temperaments[u.id]=pickWeighted(streams,'world',weights);
  else if(living.some(u=>u.side==='enemy'))out.band=pickWeighted(streams,'world',weights);
  return out;
}
