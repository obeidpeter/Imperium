import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REGIONAL_WORLD_KITS,REGIONAL_PLANS,REGIONAL_FRONTAGE,REGIONAL_CHAPTER_EXTRAS,REGIONAL_HEARINGS,ENCOUNTER_LAYOUTS,CH5_FORTRESS_LAYOUT,
  presentationSeed,presentationRandom} from '../src/ui/world-layouts.js';
import {REGIONAL_KIT_COMPONENTS} from '../src/showcase/regional-kit-components.js';
import {CH5_KIT_COMPONENTS} from '../src/showcase/environment-ch5-pilot.js';
import {CHAPTERS} from '../src/data/campaign.js';

const components=kit=>kit==='ch5-fortress-kit'?CH5_KIT_COMPONENTS:REGIONAL_KIT_COMPONENTS[kit];
const EDGES=new Set(['front','opposite','back','north','south','east','west']);

test('every regional plan names eight pieces its own kit provides',()=>{
  assert.deepEqual(Object.keys(REGIONAL_PLANS).map(Number),Object.keys(REGIONAL_WORLD_KITS).map(Number));
  for(const [chapter,plan]of Object.entries(REGIONAL_PLANS)){
    assert.equal(plan.length,8,`Chapter ${chapter}`);
    for(const piece of plan)assert.ok(components(REGIONAL_WORLD_KITS[chapter])?.[piece],`Chapter ${chapter}: ${piece}`);
  }
});

test('every layout entry names a real piece on a known edge, by slot or by name',()=>{
  const check=(chapter,entry,where)=>{
    assert.ok(EDGES.has(entry.edge),`${where}: edge ${entry.edge}`);assert.ok(Number.isFinite(entry.gap)&&entry.gap>0,`${where}: gap`);
    assert.ok(Number.isFinite(entry.along)!==Boolean(entry.beside),`${where}: along or beside, not both`);
    if('slot'in entry)assert.ok(Number.isInteger(entry.slot)&&entry.slot>=0&&entry.slot<8,`${where}: slot`);
    else assert.ok(components(entry.kit??REGIONAL_WORLD_KITS[chapter])?.[entry.component],`${where}: ${entry.component}`);
  };
  for(const chapter of Object.keys(REGIONAL_WORLD_KITS))for(const [i,entry]of REGIONAL_FRONTAGE.entries())check(chapter,entry,`frontage ${i}`);
  for(const [chapter,list]of Object.entries(REGIONAL_CHAPTER_EXTRAS))for(const entry of list)check(chapter,entry,`Chapter ${chapter} extra`);
  for(const [chapter,list]of Object.entries(REGIONAL_HEARINGS))for(const entry of list)check(chapter,entry,`Chapter ${chapter} hearing`);
  const ids=new Set(CHAPTERS.flatMap(c=>c.encounters.map(e=>e.id)));
  for(const [id,list]of Object.entries(ENCOUNTER_LAYOUTS)){
    assert.ok(ids.has(id),`${id} is a campaign encounter`);
    for(const entry of list)check(Number(/^ch(\d+)-/.exec(id)[1]),entry,id);
  }
});

test('the Chapter V fortress layout uses only fortress pieces, with camp and field variants',()=>{
  for(const entry of CH5_FORTRESS_LAYOUT.frontage){
    const names=entry.wall?[entry.wall.bay,entry.wall.breach.field,entry.wall.buttress.component]:
      typeof entry.component==='string'?[entry.component]:Object.values(entry.component);
    for(const name of names)assert.ok(CH5_KIT_COMPONENTS[name],name);
  }
  for(const q of CH5_FORTRESS_LAYOUT.quay)assert.ok(CH5_KIT_COMPONENTS[q.component],q.component);
  assert.deepEqual([...CH5_FORTRESS_LAYOUT.encounters].sort(),['ch5-camp','ch5-mine','ch5-wall']);
});

test('layouts are frozen data, and the presentation seed never touches gameplay randomness',()=>{
  for(const value of [REGIONAL_WORLD_KITS,REGIONAL_PLANS,REGIONAL_FRONTAGE,REGIONAL_FRONTAGE[1].beside,REGIONAL_CHAPTER_EXTRAS[9][0],CH5_FORTRESS_LAYOUT.frontage[3].wall])
    assert.ok(Object.isFrozen(value));
  // Pure data and arithmetic: the module imports nothing, so it cannot reach the rules' generator.
  assert.doesNotMatch(readFileSync(new URL('../src/ui/world-layouts.js',import.meta.url),'utf8'),/^\s*import\b/m);
  assert.equal(presentationSeed('ch5-mine'),presentationSeed('ch5-mine'));
  assert.notEqual(presentationSeed('ch5-mine'),presentationSeed('ch5-wall'));
  assert.equal(presentationSeed(''),0x811c9dc5);
  const a=presentationRandom(presentationSeed('ch1-road')),b=presentationRandom(presentationSeed('ch1-road'));
  const first=Array.from({length:50},a);assert.deepEqual(Array.from({length:50},b),first);
  assert.ok(first.every(v=>v>=0&&v<1));assert.ok(new Set(first).size>45);
});
