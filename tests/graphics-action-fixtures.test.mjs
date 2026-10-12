import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Game from '../src/core/game.js';
import {generateActionCases} from './graphics-action-fixtures.mjs';
import {actionScene,filmstripFrames,assertVisibleMeasurement} from './graphics-review-tools.js';
import {snapshotEncounter} from '../src/ui/motion.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../src/ui/animation-timeline.js';

test('Graphics action fixtures reproduce five distinct actions from a complete legal New Game trace',async()=>{
  const trace=JSON.parse(await readFile(new URL('./fixtures/legal-route-trace.json',import.meta.url),'utf8'));
  const result=generateActionCases(trace);assert.equal(result.finalRank,'Augustus');assert.equal(result.completed.length,12);assert.deepEqual(result.cases.map(value=>value.id),['move','strike','brace','projectile','hit']);
  for(const value of result.cases){
    assert.deepEqual(Game.deserialize(Game.serialize(value.state)),value.state);assert.deepEqual(value.state.encounter,value.after);assert.equal(value.before.id,value.after.id);
    const source=trace[value.traceStep-1];assert.deepEqual(value.command,source.kind==='act'?source.payload:{action:source.kind});
    if(['strike','projectile','hit'].includes(value.id))assert.ok(value.damage.some(unit=>unit.after<unit.before));
    if(value.id==='brace')assert.ok(value.after.units.find(unit=>unit.id===value.command.unitId).braced);
  }
  const stored=JSON.parse(await readFile(new URL('./fixtures/graphics-actions.json',import.meta.url),'utf8'));assert.deepEqual(result,stored,'Stored evidence must match direct legal replay exactly');
});

test('Filmstrip samples the actual timeline, preserves input and includes exact start/end times',async()=>{
  const {cases}=JSON.parse(await readFile(new URL('./fixtures/graphics-actions.json',import.meta.url),'utf8'));
  for(const value of cases){
    const before=JSON.stringify(value),scene=actionScene(value),timeline=buildEncounterTimeline(snapshotEncounter(value.before),snapshotEncounter(value.after),{command:value.command,quality:'balanced'}),frames=filmstripFrames(timeline,sampleEncounterTimeline);
    assert.equal(scene.transition.command,value.command);assert.equal(scene.state,value.state);assert.equal(frames.length,6);assert.equal(frames[0].timeMs,0);assert.equal(frames.at(-1).timeMs,timeline.duration);
    assert.ok(timeline.duration>0,`${value.id} should produce an actual animation timeline`);
    for(const frame of frames)assert.deepEqual(frame.frame,sampleEncounterTimeline(timeline,frame.timeMs));
    assert.equal(JSON.stringify(value),before);
  }
});

test('A hidden browser observation is rejected, never reported as a valid benchmark',()=>{
  assert.doesNotThrow(()=>assertVisibleMeasurement({hidden:false}));assert.throws(()=>assertVisibleMeasurement({hidden:true}),/hidden/);
});
