// Development-only fixture generation. Every transition comes from a legal
// recorded New Game route; no rule state, outcome or unlocked capability is set.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import * as Game from '../src/core/game.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const args=item=>item.kind==='act'?[item.payload]:item.kind==='choose'?[item.option]:item.kind==='startEncounter'?[item.options]:['prepare','negotiate','selectStratagem','allocate','judge'].includes(item.kind)?[item.value]:[];
const damaged=(before,after)=>after?.units.filter(unit=>{const old=before?.units.find(other=>other.id===unit.id);return old&&unit.hp<old.hp;}).map(unit=>({id:unit.id,side:unit.side,before:before.units.find(other=>other.id===unit.id).hp,after:unit.hp}))??[];

export function generateActionCases(trace){
  const state=Game.newGame('Aurelius Marcellus',275),cases=new Map();
  for(const [index,item] of trace.entries()){
    const before=state.encounter?clone(state.encounter):null,seedBefore=state.rng;
    const result=Game[item.kind](state,...args(item));assert.equal(result.ok,true,`Trace ${index+1} ${item.kind}: ${result.message}`);
    if(!before||!state.encounter||before.id!==state.encounter.id||before.kind!=='battle')continue;
    const after=state.encounter,command=item.kind==='act'?clone(item.payload):{action:item.kind},losses=damaged(before,after);
    const oldActor=before.units.find(unit=>unit.id===command.unitId),actor=after.units.find(unit=>unit.id===command.unitId);
    let key;
    if(command.action==='move'&&oldActor&&actor&&Math.abs(actor.x-oldActor.x)+Math.abs(actor.y-oldActor.y)>=2)key='move';
    if(command.action==='strike'&&losses.length)key='strike';
    if(command.action==='brace'&&actor?.braced)key='brace';
    if(command.action==='throw'&&losses.length)key='projectile';
    if(item.kind==='endTurn'&&losses.some(unit=>unit.id==='hero'))key='hit';
    if(key&&!cases.has(key))cases.set(key,{id:key,title:{move:'Legal multi-tile move',strike:'Legal melee strike',brace:'Legal brace',projectile:'Legal javelin throw and hit',hit:'Enemy turn: commander takes damage'}[key],chapter:state.chapter,traceStep:index+1,command,before,after:clone(after),state:Game.deserialize(Game.serialize(state)),damage:losses,seedBefore,seedAfter:state.rng});
  }
  const order=['move','strike','brace','projectile','hit'];for(const key of order)assert.ok(cases.has(key),`The legal trace must supply ${key}`);
  assert.deepEqual(state.completed,[1,2,3,4,5,6,7,8,9,10,11,12]);assert.equal(state.rank,'Augustus');
  return {format:'sacramentum-graphics-action-cases-v1',source:'Seed275 New Game; full stored legal command trace replayed through the public rules API. All commands returned ok; no state injection or outcome assignment.',commandCount:trace.length,seed:275,completed:state.completed,finalRank:state.rank,cases:order.map(key=>cases.get(key))};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const trace=JSON.parse(await readFile(new URL('./fixtures/legal-route-trace.json',import.meta.url),'utf8')),result=generateActionCases(trace);
  await writeFile(new URL('./fixtures/graphics-actions.json',import.meta.url),JSON.stringify(result));
  console.log(JSON.stringify({commandCount:result.commandCount,cases:result.cases.map(({id,chapter,traceStep,command,damage})=>({id,chapter,traceStep,command,damage})),finalRank:result.finalRank},null,2));
}
