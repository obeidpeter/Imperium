import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as Game from '../src/core/game.js';
import {runCommandCampaign} from './command-autoplay.mjs';
const runs=[];
for(const approach of ['balanced','breach','diversion','advance']){
  const selections=[];
  const run=runCommandCampaign({featureEdition:35,onCheckpoint(state){
    const view=Game.fieldApproachView(state);if(!view.enabled)return;
    assert.ok(Game.chooseFieldApproach(state,'balanced').ok);
    if(state.chapter!==5||approach==='balanced')return;
    assert.ok(Game.chooseOperationalPlan(state,'balanced').ok);
    const response=Game.chooseFieldApproach(state,approach);assert.ok(response.ok,response.message);
    selections.push(Game.getChapter(state).encounters[state.encounterIndex].id);
  }});
  assert.equal(run.rank,'Augustus');assert.equal(run.state.completed.length,12);assert.equal(run.encounters.length,25);
  assert.equal(run.checks.filter(c=>c.exactRetry).length,25);
  if(approach!=='balanced')assert.deepEqual(selections,['ch5-mine','ch5-wall']);
  runs.push({approach,chapters:12,encounters:25,exactRetries:25,rank:run.rank,selections,minimumSupplies:run.minimumSupplies,encounterResults:run.encounters});
}
const report={edition:35,method:'Four complete legal New Game campaigns through public commands; all three alternative Chapter V approaches; no injected victories, resources or positions. This is rules validation, not human balance approval.',runs};
const output=process.argv.indexOf('--output');if(output>=0)await writeFile(process.argv[output+1],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({edition:35,runs:runs.map(({encounterResults,...run})=>run)},null,2));
