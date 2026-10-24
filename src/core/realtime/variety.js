import {FIELD_WEATHERS,HIDDEN_BANDS,PLACES,TEMPERAMENTS} from '../../data/realtime-variety.js';
import {FIELD_OBJECT_PLACES,fieldTileFree} from '../expanded-campaign.js';
import {nextRandom,pickWeighted,randomInt} from './rng-streams.js';

// A battle's variety (worlds and gameplay plan, release 3): drawn from the
// world stream once, before the world is built, from the 0.38 encounter
// record, which it never changes. The weather within the chapter's set (an
// explicit choice keeps its own); each field object on one of the nearest free
// tiles to the place 0.38 reserves for it; Chapter III's hidden man on one of
// the nearest free tiles to his own; each reinforcement's entry on its tile or
// a neighbour; whether a band of raiders lies in wait (from Chapter IV, by the
// level's chance, unless the battle opens with a column to bring out) and
// where; and each enemy band's temperament. Every tile it moves anything to is
// one the soldier can reach from his start. Pure.

const near=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),far=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const byNearness=from=>(a,b)=>near(a,from)-near(b,from)||a.y-b.y||a.x-b.x;
const pick=(streams,list,n)=>list[randomInt(streams,'world',0,Math.min(n,list.length)-1)];
// The free tiles the soldier can reach from where he starts, a shut gate and a broken bridge counted as closed.
function tiles(e){
  const hero=e.units.find(u=>u.id==='hero')??e.units[0],shut=new Set((e.field?.objects??[]).filter(o=>o.kind==='gate'&&o.state==='closed'||o.kind==='bridge'&&o.state==='damaged').map(o=>`${o.x},${o.y}`));
  const open=p=>fieldTileFree(e,p)&&!shut.has(`${p.x},${p.y}`),seen=new Set(),out=[],queue=hero&&open(hero)?[{x:hero.x,y:hero.y}]:[];
  if(queue.length)seen.add(`${hero.x},${hero.y}`);
  while(queue.length){const p=queue.shift();out.push(p);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const q={x:p.x+dx,y:p.y+dy},key=`${q.x},${q.y}`;if(!seen.has(key)&&open(q)){seen.add(key);queue.push(q);}}}
  return out;
}

export function battleVariety(state,e,streams){
  const out={weather:e.weather??null,objects:{},hidden:{},lying:{},waves:[],temperaments:{},band:null};
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
  // From Chapter IV a band of raiders may lie in wait, by the level's chance, on one of the nearest free tiles to its
  // own; not where the battle opens with a column to bring out.
  const chance=state.chapter>=4&&!HIDDEN_BANDS.except.includes(e.mission?.mode)?HIDDEN_BANDS.chance[e.difficulty??state.difficulty??'standard']??0:0;
  if(chance>0)for(const u of living.filter(u=>u.side==='enemy'&&HIDDEN_BANDS.roles.includes(u.role)).sort((a,b)=>a.id.localeCompare(b.id))){
    if(nextRandom(streams,'world')>=chance)continue;out.lying[u.id]=true;
    const options=free.filter(p=>far(p,u)<=HIDDEN_BANDS.reach&&!living.some(v=>v!==u&&v.x===p.x&&v.y===p.y)).sort(byNearness(u));
    if(options.length)out.hidden[u.id]=pick(streams,options,PLACES.hidden);
  }
  // Reinforcements: each enters on its own tile or a free neighbour the soldier could reach.
  for(const w of e.mission?.waves??[]){
    const options=[{x:w.x,y:w.y},...free.filter(p=>near(p,w)===1).sort(byNearness(w))];out.waves.push(pick(streams,options,PLACES.waves));
  }
  // Temperaments: each enemy band of squads (from Chapter IV), or the one war band before it.
  const weights=TEMPERAMENTS.weights;
  if(state.chapter>=4)for(const u of living.filter(u=>u.side==='enemy').sort((a,b)=>a.id.localeCompare(b.id)))out.temperaments[u.id]=pickWeighted(streams,'world',weights);
  else if(living.some(u=>u.side==='enemy'))out.band=pickWeighted(streams,'world',weights);
  return out;
}
