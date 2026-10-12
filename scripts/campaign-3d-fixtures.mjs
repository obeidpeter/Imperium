import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {runCampaign} from './autoplay.mjs';

const argsFor=item=>item.kind==='act'?[item.payload]:item.kind==='choose'?[item.option]:item.kind==='startEncounter'?[item.options]:['prepare','negotiate','selectStratagem','allocate','judge'].includes(item.kind)?[item.value]:[];

/** All chapters are earned by replaying the legal autoplay trace from New Game. */
export async function generateCampaign3DFixtures(){
  const run=await runCampaign(),state=Game.newGame('Aurelius Marcellus',275),scenes=[];
  let current=null;
  for(const [index,item]of run.trace.entries()){
    if(current&&['act','endTurn'].includes(item.kind))current.commands.push({kind:item.kind,turn:state.encounter.turn,traceStep:index+1,...(item.payload?{payload:structuredClone(item.payload)}:{})});
    if(item.kind==='commitEncounter'){
      assert.equal(state.encounter.status,'won','Browser checkpoint must originate in a successful legal route');
      current.result={status:state.encounter.status,turn:state.encounter.turn,usedAbilities:[...state.encounter.usedAbilities]};current=null;
    }
    const response=Game[item.kind](state,...argsFor(item));
    assert.equal(response.ok,true,`Trace ${index+1} ${item.kind}: ${response.message}`);
    if(item.kind==='startEncounter'){
      const e=state.encounter;current={id:e.id,chapter:state.chapter,title:CHAPTERS[state.chapter-1].title,encounterTitle:e.title,kind:e.kind,traceStep:index+1,state:Game.deserialize(Game.serialize(state)),commands:[]};
      scenes.push(current);
    }
  }
  assert.deepEqual(state,run.state,'QA replay must reproduce the complete legal campaign exactly');
  assert.deepEqual(scenes.map(s=>s.id),CHAPTERS.flatMap(c=>c.encounters.map(e=>e.id)));
  return {format:'sacramentum-campaign-3d-v1',source:'New Game, seed 275. Full legal autoplay trace replay; complete encounter-start checkpoints and exact legal commands. No debug injection, progression editing or browser save writes.',seed:275,commandCount:run.trace.length,finalRank:state.rank,completed:[...state.completed],scenes};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=await generateCampaign3DFixtures(),folder=new URL('../tests/fixtures/',import.meta.url);
  await mkdir(folder,{recursive:true});await writeFile(new URL('campaign-3d.json',folder),JSON.stringify(result));
  console.log(JSON.stringify({format:result.format,scenes:result.scenes.length,battles:result.scenes.filter(s=>s.kind==='battle').length,contests:result.scenes.filter(s=>s.kind==='contest').length,chapters:result.completed.length,finalRank:result.finalRank,commands:result.commandCount,source:result.source},null,2));
}
