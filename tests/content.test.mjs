import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CHAPTERS,CAST,DECISION_READERS,OATH,MENTOR_LESSON,choiceEchoes,epilogue,sceneLines} from '../src/data/campaign.js';
import {newGame} from '../src/core/game.js';

// These are editorial/state scenario checks, not a route or playtime simulation.
const stages=['intro','aftermath'];
const conditionalGroups=[['comradeAlive','comradeAbsent'],['mentorAlive','mentorAbsent'],['patronSupport','patronNeutral','patronHostile']];
const knownConditions=new Set(conditionalGroups.flat());
function contentState({comrade=true,mentor=true,patron=0}={}){
  const state=newGame();
  state.decisions={ch2:comrade?'carry':'leave',ch6:mentor?'save':'obey'};
  state.relationships.patron=patron;
  return state;
}

test('Content audit: every authored decision option has a specific later reader, not generic archive fallback',()=>{
  const ids=CHAPTERS.map(ch=>ch.decision.id);
  assert.equal(new Set(ids).size,ids.length,'Decision IDs must be unique.');
  assert.deepEqual(Object.keys(DECISION_READERS).sort(),[...ids].sort(),'Readers and recorded authored decisions must stay in sync.');
  for(const chapter of CHAPTERS){
    const decision=chapter.decision;
    assert.deepEqual(Object.keys(DECISION_READERS[decision.id]).sort(),decision.options.map(o=>o.id).sort(),`Every ${decision.id} option needs its own reader.`);
    const readings=new Set();
    for(const option of decision.options){
      const state=newGame();state.decisions={[decision.id]:option.id};
      const authored=DECISION_READERS[decision.id][option.id];
      assert.ok(authored.length>40,`${decision.id}/${option.id}: a substantive callback is required.`);
      assert.ok(choiceEchoes(state).includes(authored),`${decision.id}/${option.id}: journal reader is unreachable.`);
      assert.ok(epilogue(state).some(panel=>panel.text.includes(authored)),`${decision.id}/${option.id}: no later epilogue reads this decision.`);
      readings.add(authored);
    }
    assert.equal(readings.size,decision.options.length,`${decision.id}: alternatives must have distinct authored callbacks.`);
  }
});

test('Content audit: every character-conditional scene has all alternatives and each is reachable',()=>{
  const seen=new Map(),hidden=new Map();
  for(const chapter of CHAPTERS)for(const stage of stages){
    const lines=chapter[stage],conditions=new Set(lines.map(l=>l.when).filter(Boolean));
    for(const condition of conditions)assert.ok(knownConditions.has(condition),`Unknown condition ${condition} in chapter ${chapter.id} ${stage}.`);
    for(const group of conditionalGroups){
      if(group.some(condition=>conditions.has(condition)))assert.ok(group.every(condition=>conditions.has(condition)),`Incomplete ${group.join('/')} branch in chapter ${chapter.id} ${stage}.`);
    }
    for(const comrade of [true,false])for(const mentor of [true,false])for(const patron of [-10,0,10]){
      const state=contentState({comrade,mentor,patron}),rendered=sceneLines(chapter,stage,state);
      assert.ok(rendered.length>0,`Empty scene in chapter ${chapter.id} ${stage}.`);
      for(const group of conditionalGroups){
        const candidates=lines.filter(line=>group.includes(line.when));
        if(candidates.length)assert.equal(candidates.filter(line=>rendered.some(r=>r.speaker===line.speaker&&r.text===line.text)).length,1,`Exactly one ${group.join('/')} branch must render in chapter ${chapter.id} ${stage}.`);
      }
      lines.forEach((line,index)=>{
        if(!line.when)return;
        const key=`${chapter.id}:${stage}:${index}`;
        const present=rendered.some(r=>r.speaker===line.speaker&&r.text===line.text);
        (present?seen:hidden).set(key,true);
      });
    }
    lines.forEach((line,index)=>{if(line.when){const key=`${chapter.id}:${stage}:${index}`;assert.ok(seen.has(key),`Unreachable branch ${key}: ${line.when}.`);assert.ok(hidden.has(key),`Unconditional branch ${key}: ${line.when}.`);}});
  }
});

test('Content audit: absent companions never speak after their fate and replacements reach the finale',()=>{
  const absent=contentState({comrade:false,mentor:false,patron:-10});
  const aliases={comrade:new Set(['Lucan',CAST.comrade.name]),mentor:new Set(['Varro',CAST.mentor.name])};
  for(const chapter of CHAPTERS)for(const stage of stages){
    const lines=sceneLines(chapter,stage,absent);
    if(chapter.id>2||(chapter.id===2&&stage==='aftermath'))assert.ok(!lines.some(l=>aliases.comrade.has(l.speaker)),`Lucan speaks after his absence in chapter ${chapter.id} ${stage}.`);
    if(chapter.id>6||(chapter.id===6&&stage==='aftermath'))assert.ok(!lines.some(l=>aliases.mentor.has(l.speaker)),`Varro speaks after his absence in chapter ${chapter.id} ${stage}.`);
  }
  const finale=sceneLines(12,'intro',absent);
  assert.ok(finale.some(l=>l.speaker==='Sabinus'),'The absent comrade needs the authored replacement commander.');
  assert.ok(finale.some(l=>l.speaker==='Treasury envoy'),'The hostile patron needs a replacement backer.');
  assert.ok(finale.some(l=>l.text.includes(MENTOR_LESSON)),'The absent mentor’s lesson must survive.');
  const ending=epilogue(absent);
  assert.ok(ending.find(p=>p.title==='The army').text.includes('Sabinus commands'));
  assert.ok(ending.find(p=>p.title==='The people behind the titles').text.includes('Varro does not see the accession'));
});

test('Content audit: the original oath is identical at the bookends and all four early choices return',()=>{
  assert.ok(!CHAPTERS[0].intro.some(l=>l.text===OATH),'The oath must not precede completed training.');
  assert.equal(CHAPTERS[0].oath[0].text,OATH);
  assert.equal(CHAPTERS[11].aftermath.find(l=>l.speaker.startsWith('The legions')).text,OATH);
  const state=newGame();
  state.decisions=Object.fromEntries(CHAPTERS.slice(0,4).map(ch=>[ch.decision.id,ch.decision.options[0].id]));
  const early=epilogue(state).find(panel=>panel.title==='The first four chapters').text;
  for(const [id,option]of Object.entries(state.decisions))assert.ok(early.includes(DECISION_READERS[id][option]),`Missing early callback ${id}.`);
});

test('Content audit: the Contest rules sheet lists exactly the authored deadline turns',async()=>{
  const sheet=await readFile(new URL('../docs/contest-rules.md',import.meta.url),'utf8');
  const rows=[...sheet.matchAll(/^\| (ch\d+-[a-z]+) \| [^|]+ \| [^|]+ \| (\d+) \|$/gm)].map(([,id,turns])=>[id,Number(turns)]);
  const contests=CHAPTERS.flatMap(ch=>ch.encounters.filter(e=>e.kind==='contest').map(e=>[e.id,e.turnLimit]));
  assert.deepEqual(rows,contests,'The rules sheet must match every configured Contest deadline.');
});
