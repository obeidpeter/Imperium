import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {battleVariety} from '../src/core/realtime/variety.js';
import {splitStreams} from '../src/core/realtime/rng-streams.js';
import {createEncounterWorld} from '../src/core/realtime/campaign-encounter.js';
import {worldHash} from '../src/core/realtime/simulation.js';
import {FIELD_OBJECT_PLACES,fieldTileFree} from '../src/core/expanded-campaign.js';
import {FIELD_WEATHERS,PLACES,TEMPERAMENTS} from '../src/data/realtime-variety.js';
import {playRealtime} from '../scripts/realtime-autoplay.mjs';

// A battle's variety (worlds and gameplay plan, release 3): drawn from the
// world stream once, before the world is built, from the 0.38 record, which
// it leaves unchanged.

const near=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
// An 0.38-shaped battle: Chapter III's map, its hidden man, a reinforcement and the four field objects.
const record=()=>({id:'ch3-station',kind:'battle',type:'recover',width:8,height:8,goal:{x:6,y:1},weather:'rain',
  terrain:['..XXX...','.....#s.','..^..#..','====....','..XX....','....^...','........','........'].map(r=>[...r].map(c=>({'.':'grass','X':'rock','#':'wall','^':'high','=':'road','s':'stone'})[c])),
  units:[{id:'hero',side:'player',x:0,y:3,hp:20},{id:'enemy0',side:'enemy',x:6,y:3,hp:8},{id:'enemy1',side:'enemy',x:4,y:6,hp:8,hidden:true}],
  mission:{mode:'recover',waves:[{turn:3,x:7,y:5,role:'raider',arrived:false}]},
  field:{objects:[{id:'stores',kind:'stores',x:2,y:2},{id:'signal',kind:'signal',x:3,y:5},{id:'barricade',kind:'barricade',x:4,y:2},{id:'brazier',kind:'brazier',x:5,y:5}]}});

test('a battle’s variety is drawn from the world stream alone and leaves the 0.38 record unchanged; the same seed gives the same battle',()=>{
  const e=record(),before=JSON.stringify(e),streams=splitStreams(11),fresh=splitStreams(11);
  const v=battleVariety({chapter:3,encounterOptions:{}},e,streams);
  assert.equal(JSON.stringify(e),before,'the record is only read');
  assert.deepEqual([streams.combat,streams.ai],[fresh.combat,fresh.ai],'no combat or ai draw');assert.notEqual(streams.world,fresh.world);
  assert.deepEqual(battleVariety({chapter:3,encounterOptions:{}},record(),splitStreams(11)),v,'same seed, same battle');
  const kinds=new Set(Array.from({length:40},(_,i)=>JSON.stringify(battleVariety({chapter:3,encounterOptions:{}},record(),splitStreams(i+1)))));
  assert.ok(kinds.size>=20,`${kinds.size} different battles in 40 seeds`);
});

test('the weather comes from the chapter’s set; an explicit choice is kept; the drill keeps its own',()=>{
  const seen=new Set();for(let i=1;i<=60;i++)seen.add(battleVariety({chapter:3,encounterOptions:{}},record(),splitStreams(i)).weather);
  assert.deepEqual([...seen].sort(),FIELD_WEATHERS[3].map(([w])=>w).sort(),'every weather of the set, and none other');
  assert.equal(battleVariety({chapter:3,encounterOptions:{weather:'dust'}},record(),splitStreams(5)).weather,'rain','an explicit weather is the record’s own');
  assert.equal(battleVariety({chapter:1,encounterOptions:{}},{...record(),type:'training',weather:'clear'},splitStreams(5)).weather,'clear');
});

test('field objects, the hidden man and reinforcements take free tiles near their own; temperaments are drawn for each band',()=>{
  for(let seed=1;seed<=40;seed++){
    const e=record(),v=battleVariety({chapter:3,encounterOptions:{}},e,splitStreams(seed)),used=new Set();
    for(const [id,p]of Object.entries(v.objects)){
      const o=e.field.objects.find(x=>x.id===id),place=FIELD_OBJECT_PLACES[o.kind];
      assert.ok(fieldTileFree(e,p)&&near(p,e.goal)>1&&!e.units.some(u=>u.x===p.x&&u.y===p.y),`${id} on a free tile`);
      assert.ok(!used.has(`${p.x},${p.y}`),'one object a tile');used.add(`${p.x},${p.y}`);
      const ranks=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(fieldTileFree(e,{x,y})&&near({x,y},e.goal)>1&&!e.units.some(u=>u.x===x&&u.y===y))ranks.push(near({x,y},place));
      assert.ok(near(p,place)<=[...ranks].sort((a,b)=>a-b)[PLACES.objects-1+Object.keys(v.objects).length],`${id} among the nearest`);
    }
    const h=v.hidden.enemy1;assert.ok(h&&fieldTileFree(e,h)&&Math.max(Math.abs(h.x-4),Math.abs(h.y-6))<=PLACES.hiddenReach,'the hidden man within two tiles');
    const w=v.waves[0];assert.ok(fieldTileFree(e,w)&&near(w,{x:7,y:5})<=1,'the reinforcement at its tile or beside it');
    assert.ok(TEMPERAMENTS.kinds[v.band],'Chapter III’s war band has a temperament');assert.deepEqual(v.temperaments,{});
  }
  const v=battleVariety({chapter:5,encounterOptions:{}},record(),splitStreams(3));assert.equal(v.band,null);
  assert.deepEqual(Object.keys(v.temperaments).sort(),['enemy0','enemy1'],'from Chapter IV each enemy band has its own');
});

test('in the campaign the encounter takes the battle’s weather, the world is pure to build, and a retry gives the same battle',()=>{
  const state=G.newGame('Aurelius Marcellus',275,{featureEdition:35,progression:true});G.choose(state,G.getChapter(state).decision.options[0].id);
  assert.ok(G.startEncounter(state,{controls:'realtime'}).ok);assert.equal(playRealtime(state).status,'won');assert.ok(G.commitEncounter(state).ok);G.swearOath(state);
  assert.ok(G.startEncounter(state,{controls:'realtime'}).ok);const w=G.realtimeWorld(state);
  assert.ok(FIELD_WEATHERS[1].some(([x])=>x===w.weather));assert.equal(state.encounter.weather,w.weather,'the scene and the rules agree');
  assert.equal(worldHash(createEncounterWorld(state,{seed:state.snapshot.rng})),worldHash(createEncounterWorld(state,{seed:state.snapshot.rng})),'built twice, the same world');
  const first=worldHash(w);assert.ok(G.retry(state).ok);assert.equal(worldHash(G.realtimeWorld(state)),first,'a retry restores the same battle');
});
