import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {runCampaign} from './autoplay.mjs';

const primary=['ch1-road','ch2-marsh','ch3-station','ch4-gate','ch5-mine','ch6-wells','ch7-legion','ch8-ferry','ch9-wing','ch10-road','ch11-adlection','ch12-confrontation'];
const clone=value=>JSON.parse(JSON.stringify(value));
const argumentsFor=item=>item.kind==='act'?[item.payload]:item.kind==='choose'?[item.option]:item.kind==='startEncounter'?[item.options]:['prepare','negotiate','selectStratagem','allocate','judge'].includes(item.kind)?[item.value]:[];

/** Development QA only: every captured state is reached by replaying legal commands. */
export async function generateGraphicsScenes(){
  const run=await runCampaign(),state=Game.newGame('Aurelius Marcellus',275),scenes=new Map(),transitions=new Map();
  function capture(id,kind,step){const chapter=CHAPTERS[state.chapter-1];scenes.set(id,{id,kind,chapter:state.chapter,title:kind==='board'?`Chapter ${state.chapter} · ${state.encounter.title}`:kind==='promotion'?`Chapter ${state.chapter} promotion · ${chapter.promotion}`:kind==='ending'?'The imperial accession':`Chapter ${state.chapter} camp · ${chapter.title}`,primary:kind==='board'&&primary.includes(state.encounter.id),traceStep:step,state:Game.deserialize(Game.serialize(state))});}
  capture('camp-1','camp',0);
  for(const[index,item]of run.trace.entries()){
    const old=state.encounter?clone(state.encounter):null,response=Game[item.kind](state,...argumentsFor(item));
    assert.equal(response.ok,true,`Trace ${index}: ${item.kind}: ${response.message}`);
    if(item.kind==='startEncounter')capture(`board-${state.encounter.id}`,'board',index+1);
    if(item.kind==='endTurn'&&state.encounter?.turn===3&&state.encounter.status==='active')capture(`board-${state.encounter.id}`,'board',index+1);
    if(item.kind==='act'&&old&&['move','strike','throw','rally','formation','persuade','address','denounce'].includes(item.payload.action)){
      const id=`board-${state.encounter.id}`,prior=transitions.get(id),score={move:1,formation:2,persuade:2,address:3,rally:3,strike:4,throw:5,denounce:5}[item.payload.action];
      if(!prior||score>prior.score)transitions.set(id,{score,before:old,after:clone(state.encounter),command:clone(item.payload),traceStep:index+1});
    }
    if(state.phase==='promotion'&&item.kind==='commitEncounter')capture(`promotion-${state.chapter}`,'promotion',index+1);
    if(item.kind==='advanceChapter')capture(state.phase==='epilogue'?'ending':`camp-${state.chapter}`,state.phase==='epilogue'?'ending':'camp',index+1);
  }
  assert.deepEqual(state,run.state,'Graphics fixture replay must reproduce the full legal campaign exactly.');
  for(const[id,transition]of transitions){const scene=scenes.get(id);if(scene)scene.transition=transition;}
  return {format:'sacramentum-graphics-lab-v1',source:'New Game, seed275. Every state and motion pair is copied after a validated legal command; no debug injection or saved-state editing.',generatedAt:new Date().toISOString(),seed:275,commandCount:run.trace.length,finalRank:state.rank,completed:state.completed,primaryScenes:primary.map(id=>`board-${id}`),scenes:[...scenes.values()]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=await generateGraphicsScenes(),directory=new URL('../tests/fixtures/',import.meta.url);await mkdir(directory,{recursive:true});await writeFile(new URL('graphics-scenes.json',directory),JSON.stringify(result));console.log(JSON.stringify({scenes:result.scenes.length,boards:result.scenes.filter(s=>s.kind==='board').length,primary:result.primaryScenes.length,commands:result.commandCount,finalRank:result.finalRank,source:result.source},null,2));}
