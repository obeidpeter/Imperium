import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UPGRADE_TARGETS,sweepFile,sweepRuns,upgradesFromEvidence,upgradesReport} from '../scripts/upgrades-check.mjs';

// The plan's "upgrades count" target, adopted by the owner on 1 November 2026 (docs/worlds-and-gameplay-plan.md):
// better kit leaves the soldier less hurt and wins sooner, in Chapters I–III and the eleven champion battles.
// Release 11's committed sweeps meet it; a sweep in which kit changed nothing would not.

test('release 11’s sweeps meet the upgrades target, and the check is repeatable',()=>{
  const report=upgradesFromEvidence('release11');
  assert.equal(report.met,true,report.targets.filter(t=>!t.met).map(t=>`${t.target}: ${t.value}`).join('; '));
  const m=report.measures;
  assert.ok(m.veteranHealth.difference>=UPGRADE_TARGETS.veteranHealth&&m.veteranHealth.low>0,'Veteran: less hurt, beyond the seeds’ noise');
  assert.ok(-m.veteranRounds.difference>=UPGRADE_TARGETS.veteranRounds&&m.veteranRounds.high<0,'Veteran: sooner, beyond the seeds’ noise');
  assert.ok(m.storyChampionHealth.difference>=UPGRADE_TARGETS.storyChampionHealth,'Story: kit rescues the unequipped soldier against champions');
  assert.equal(m.veteranHealth.seeds,20);
  assert.deepEqual(report.belowHalf,{story:[18,3],standard:[6,0],veteran:[8,2]},'the near-death wins, reported without a pass mark');
  assert.deepEqual(upgradesFromEvidence('release11'),report,'the same files give the same report');
});

test('a sweep in which kit changed nothing fails every part of the target',()=>{
  const read=(difficulty,kit)=>sweepRuns(JSON.parse(readFileSync(new URL(`../docs/evidence/${sweepFile('release11',difficulty,kit)}`,import.meta.url),'utf8')));
  const issued=read('veteran','issued'),bare=read('story','bare'),standard=read('standard','issued');
  const report=upgradesReport({storyBare:bare,storyIssued:bare,standardIssued:standard,standardEngaged:standard,veteranIssued:issued,veteranEngaged:issued});
  assert.equal(report.met,false);assert.deepEqual(report.targets.map(t=>t.met),[false,false,false]);
  assert.equal(report.measures.veteranHealth.difference,0);
});
