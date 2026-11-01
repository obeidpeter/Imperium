import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {CHAMPIONS} from '../src/data/champions.js';
import {FIELD_CONTAINERS} from '../src/data/containers.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {ITEMS} from '../src/data/items.js';
import {singleWard} from '../src/core/realtime/squads.js';
import {queueCommand,step} from '../src/core/realtime/simulation.js';

// Release 11: kit counts against squads and against the champions who seek the soldier out.
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const fieldOf=id=>{const s=Game.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id===`board-${id}`).state));assert.ok(Game.restartInRealtime(s).ok,id);return s;};

test('a single man’s armour and shield turn a share of a squad’s blows: more for better kit, nothing for no kit',()=>{
  const recruit={kit:['tunic','subarmalis','galea','bracae','caligae','training_shield']},issued={kit:['tunic','subarmalis','hamata','galea','bracae','caligae','scutum','manica']},
    engaged={kit:['tunic_winter','subarmalis_thick','hamata_fine','niederbieber','manica_scale','ocreae_fine','bracae_thick','calcei_nailed','scutum_rim']};
  const f=k=>singleWard(k,'front').factor;
  assert.equal(singleWard({kit:[]}).factor,1);
  assert.ok(f(recruit)<1&&f(issued)<f(recruit)&&f(engaged)<f(issued),`${f(recruit)} > ${f(issued)} > ${f(engaged)}`);
  assert.ok(singleWard(issued,'flank').factor>f(issued),'the shield counts only from the front');
  assert.ok(f(engaged)>=(1-.65)*(1-.36*.5)-1e-9,'capped');
});

test('each squad battle with a champion has him on the field, by the enemy, seeking the soldier, the same on every level',()=>{
  const battles=CHAPTERS.flatMap(c=>c.encounters).filter(e=>CHAMPIONS[e.id]);
  assert.ok(battles.length>=10);
  for(const e of battles){
    const c=CHAMPIONS[e.id];for(const id of [...c.kit,...c.loot])assert.ok(ITEMS[id],`${e.id}: ${id}`);
    const worlds=['story','standard','veteran'].map(d=>{const s=fieldOf(e.id);s.encounter.difficulty=d;return Game.realtimeWorld(s);});
    const specs=worlds.map(w=>w.actors.find(a=>a.role==='champion'));
    assert.ok(specs.every(Boolean),`${e.id}: the champion takes the field`);
    for(const a of specs.slice(1))assert.deepEqual([a.attributes,a.kit,a.loot,a.maxHp],[specs[0].attributes,specs[0].kit,specs[0].loot,specs[0].maxHp],`${e.id}: the same on every level`);
  }
  // He goes for the soldier, seen or not.
  const w=Game.realtimeWorld(fieldOf('ch4-wall')),champion=w.actors.find(a=>a.role==='champion');
  let sought=false;for(let t=0;t<400&&!sought;t++){step(w);sought=champion.order?.targetId==='hero';}
  assert.ok(sought,'the war leader seeks the soldier');
});

test('every key to a locked battlefield container is carried on that field: by an enemy, a champion or another container',()=>{
  for(const [id,list]of Object.entries(FIELD_CONTAINERS))for(const c of list.filter(x=>x.lock)){
    const w=Game.realtimeWorld(fieldOf(id));
    const carried=w.actors.some(a=>a.loot?.includes(c.lock.key))||w.objects.some(o=>o.id!==c.id&&o.contents?.includes(c.lock.key));
    assert.ok(carried,`${id}: ${c.lock.key} is on the field`);
  }
});

test('a campaign world refuses the arena’s kit command; only the standalone arena changes kit in the world',()=>{
  const w=Game.realtimeWorld(fieldOf('ch1-road'));
  assert.equal(queueCommand(w,{actorId:'hero',kind:'setKit',payload:{kit:['hamata_bronze']}}).ok,false);
});
