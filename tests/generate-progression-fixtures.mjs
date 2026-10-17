import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {serialize,deserialize,getChapter} from '../src/core/game.js';
const checkpoints={},put=(id,state)=>{if(!checkpoints[id]){const payload=serialize(state);checkpoints[id]={payload,sha256:createHash('sha256').update(payload).digest('hex'),chapter:state.chapter,phase:state.phase,encounterId:state.encounter?.id??getChapter(state).encounters[state.encounterIndex].id};deserialize(payload);}};
const r=runProgressionCampaign({alternate:true,beforeCamp:s=>{
 if(s.chapter===3&&s.encounterIndex===0)put('chapter3-training',s);
 if(s.chapter===8&&s.encounterIndex===0)put('chapter8-settlement',s);
},onCheckpoint:s=>{if(s.chapter===1&&s.encounterIndex===1)put('chapter1-operation',s);},onEncounter:s=>{
 if(s.encounter.id==='ch7-council')put('chapter7-agreement',s);
 if(s.encounter.id==='ch9-wing')put('chapter9-specialists',s);
}});
delete r.state;
const out=new URL('./fixtures/progression-browser.json',import.meta.url);await mkdir(new URL('./fixtures/',import.meta.url),{recursive:true});await writeFile(out,JSON.stringify({source:'Generated from a legal New Game progression campaign. No checkpoint data was injected or edited.',checkpoints,route:r},null,2)+'\n');
console.log(`Prepared ${Object.keys(checkpoints).length} progression checkpoints; ${r.encounters.length} wins, ${r.turns} turns, ${r.specialistActions.join(', ')}.`);
