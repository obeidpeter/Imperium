import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {runProgressionCampaign} from './progression-autoplay.mjs';

const reports=[];
for(const options of [{difficulty:'standard',seed:275},{difficulty:'standard',seed:275,alternate:true},{difficulty:'story',seed:137},{difficulty:'veteran',seed:831}]){
  const {state,...report}=runProgressionCampaign({...options,featureEdition:31});
  assert.equal(state.completed.length,12);assert.equal(report.encounters.length,25);assert.ok(report.checks.every(c=>c.exactRetry));
  reports.push(report);console.log(JSON.stringify({difficulty:report.difficulty,seed:report.seed,alternate:report.alternate,rank:report.rank,encounters:report.encounters.length,turns:report.turns}));
}
if(process.argv.includes('--write'))await writeFile(new URL('../docs/evidence/expanded-campaign-v031.json',import.meta.url),JSON.stringify({method:'New Game, public commands only, no injected progression; exact checkpoint retry before every encounter',reports},null,2)+'\n');
