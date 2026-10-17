import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Game from '../src/core/game.js';
import {debugJump} from '../src/core/debug.js';
import {clone} from '../src/core/shared.js';
import {recordCompanyService} from '../src/core/career.js';
import {CHAPTERS,OATH} from '../src/data/campaign.js';

// Scene fixtures isolate authored transitions. They are not legal route or
// pacing evidence, and they do not grant progress through the browser UI.
function storyFixture(chapter,index=0,decisions={}) {
  const state=Game.newGame('Aurelius Test');
  state.chapter=chapter;state.encounterIndex=index;state.decisions=decisions;
  if(index)state.history=[{id:CHAPTERS[chapter-1].encounters[index-1].id,chapter,kind:CHAPTERS[chapter-1].encounters[index-1].kind,turns:8,losses:0,veterans:[]}];
  return state;
}
function fieldFixture() {
  const state=debugJump(Game.newGame('Injected company scenario'),4,true);
  assert.equal(Game.choose(state,'withdraw').ok,true);
  assert.equal(Game.setStoryProgress(state,1).ok,true);
  assert.equal(Game.startEncounter(state).ok,true);
  return state;
}

test('Story: the oath and received seal follow the completed drill and legal oath command',()=>{
  const state=Game.newGame();
  assert.equal(Game.storyStageKey(state),'ch1:arrival');
  assert.ok(!Game.storyLines(state).some(line=>line.text===OATH));
  Game.choose(state,'cover');
  assert.equal(Game.storyStageKey(state),'ch1:briefing:0');
  assert.equal(Game.swearOath(state).ok,false);
  assert.ok(!state.inventory.includes('Lead identity seal'));
  state.encounterIndex=1;state.history=[{id:'ch1-training',chapter:1,kind:'battle',turns:4,losses:0}];
  assert.equal(Game.storyStageKey(state),'ch1:oath-ready');
  assert.ok(!Game.storyLines(state).some(line=>line.text===OATH));
  assert.equal(Game.swearOath(state).ok,true);
  assert.equal(Game.storyStageKey(state),'ch1:oath-sworn');
  assert.equal(Game.storyLines(state).filter(line=>line.text===OATH).length,1);
  assert.ok(state.inventory.includes('Lead identity seal'));
  assert.ok(Game.storyLines(state).some(line=>line.text.includes('Only now does the clerk')));
});

test('Story: every subsequent camp has the last result and a new encounter briefing, not the arrival',()=>{
  for(const chapter of CHAPTERS)for(let index=1;index<chapter.encounters.length;index++){
    const state=storyFixture(chapter.id,index,{[chapter.decision.id]:chapter.decision.options[0].id});
    state.oath=true;
    const before=JSON.stringify(state),lines=Game.storyLines(state);
    assert.ok(lines.length>=2,`Chapter ${chapter.id} needs an aftermath and a next step.`);
    assert.ok(!lines.some(line=>line.text===chapter.intro[0].text),`Repeated arrival in chapter ${chapter.id}.`);
    assert.equal(JSON.stringify(state),before,'Reading a scene must not mutate campaign or RNG.');
  }
});

test('Story: the final oath is received at accession, not repeated before accepting the appointment',()=>{
  const state=storyFixture(12,2,{ch12:'honour'});state.phase='promotion';
  assert.ok(!Game.storyLines(state).some(line=>line.text===OATH));
  state.phase='epilogue';
  assert.equal(Game.storyLines(state).filter(line=>line.text===OATH).length,1);
});

test('Story: each choice changes the immediate briefing, and absent companions get replacement responses',()=>{
  for(const chapter of CHAPTERS){
    const alternatives=chapter.decision.options.map(option=>Game.storyLines(storyFixture(chapter.id,0,{[chapter.decision.id]:option.id})).map(line=>line.text).join('\n'));
    assert.equal(new Set(alternatives).size,alternatives.length,`Chapter ${chapter.id} choices need distinct immediate responses.`);
  }
  const rescue=storyFixture(2,1,{ch2:'leave'});
  assert.ok(Game.storyLines(rescue).some(line=>line.speaker==='Sabinus'));
  assert.ok(!Game.storyLines(rescue).some(line=>line.speaker==='Lucan'));
  const retreat=storyFixture(6,1,{ch6:'obey'});
  assert.ok(!Game.storyLines(retreat).some(line=>line.speaker==='Varro'));
  assert.ok(Game.storyLines(retreat).some(line=>line.text.includes('vine stick')));
});

test('Story: reading position survives save/restore, changes by scene, and invalid navigation is inert',()=>{
  const state=Game.newGame();
  assert.equal(Game.setStoryProgress(state,2).ok,true);
  const restored=Game.deserialize(Game.serialize(state));
  assert.equal(Game.storyProgress(restored),2);
  const before=Game.serialize(restored);
  for(const invalid of [-1,1.5,999,NaN])assert.equal(Game.setStoryProgress(restored,invalid).ok,false);
  assert.equal(Game.serialize(restored),before);
  assert.equal(Game.choose(restored,'report').ok,true);
  assert.equal(Game.storyProgress(restored),0);
  assert.equal(restored.storyProgress['ch1:arrival'],2);
  assert.equal(Game.setStoryProgress(restored,1).ok,true);
  assert.equal(Game.startEncounter(restored).ok,true);
  const encounter=Game.serialize(restored);
  assert.equal(Game.setStoryProgress(restored,0).ok,false);
  assert.equal(Game.serialize(restored),encounter);
  assert.equal(restored.snapshot.storyProgress['ch1:briefing:0'],1);
});

test('Company: one successful commit records service, injuries and commendations exactly once',()=>{
  const state=fieldFixture(),allies=state.encounter.units.filter(unit=>unit.side==='ally');
  allies[0].hp=0;allies[1].hp=1;
  // Inject a settled outcome solely to exercise the transaction boundary.
  state.encounter.status='won';
  assert.equal(Game.commitEncounter(state).ok,true);
  assert.equal(state.company[0].service,1);
  assert.equal(state.company[0].recovery,2);
  assert.equal(state.company[1].recovery,1);
  assert.equal(state.company[0].commendations,0);
  assert.equal(state.history.at(-1).veterans[0].withdrawn,true);
  const committed=JSON.stringify(state);
  assert.equal(Game.commitEncounter(state).ok,false);
  assert.equal(JSON.stringify(state),committed);
  assert.match(Game.leadershipSummary(state),/formation withdrew/);
  const clean=fieldFixture();clean.encounter.status='won';Game.commitEncounter(clean);
  assert.ok(clean.company.slice(0,3).every(member=>member.commendations===1));
  assert.match(Game.leadershipSummary(clean),/every allied formation returned/);
});

test('Company: completed training does not claim undeployed formations returned from battle',()=>{
  const state=storyFixture(1,1,{ch1:'cover'});
  assert.match(Game.leadershipSummary(state),/Training is complete/);
  assert.ok(!Game.leadershipSummary(state).includes('every allied formation returned'));
});

test('Company: retry restores the exact roll and reading checkpoint; bounded recovery clears through service',()=>{
  const state=fieldFixture(),initial=clone(state);
  state.encounter.units.find(unit=>unit.side==='ally').hp=0;
  assert.equal(Game.retry(state).ok,true);
  assert.deepEqual(state,initial);
  state.company[0].recovery=2;
  recordCompanyService(state,{kind:'contest',units:[]});
  assert.equal(state.company[0].recovery,1);
  recordCompanyService(state,{kind:'contest',units:[]});
  assert.equal(state.company[0].recovery,0);
  assert.equal(state.company.length,5,'Recovery never removes a veteran.');
});

test('Company: the clearly chosen comrade loss replaces his place without inheriting his honours',()=>{
  const state=debugJump(Game.newGame(),2,true);
  state.company[0].service=1;state.company[0].commendations=1;
  assert.equal(Game.choose(state,'leave').ok,true);
  assert.deepEqual(state.company[0],{id:'sabinus',name:'Sabinus',service:0,commendations:0,recovery:0});
  assert.ok(!Game.companyRoster(state).some(member=>member.id==='lucan'));
});

test('Company: a rescued tagged veteran earns service, but defectors do not become undeployed veterans',()=>{
  const state=Game.newGame();
  const unit=(id,side,veteranId)=>({id,side,veteranId,role:side==='neutral'?'escort':'infantry',hp:10,maxHp:10});
  const encounter={kind:'battle',scenario:'ch2-marsh',units:[unit('ally0','ally','naso'),unit('escort','neutral','lucan'),unit('enemy0','ally'),unit('enemy1','ally')]};
  const reports=recordCompanyService(state,encounter);
  assert.deepEqual(reports.map(report=>report.id).sort(),['lucan','naso']);
  assert.equal(state.company[2].service,0);assert.equal(state.company[3].service,0);
});

test('Compatibility: old v1 active saves gain defaults without losing a transaction, choice, or rank',()=>{
  const state=Game.newGame();Game.choose(state,'report');Game.startEncounter(state);
  const legacy=JSON.parse(Game.serialize(state));
  // Simulate the complete historical schema, including absence of later campaign options.
  for(const record of [legacy,legacy.snapshot,legacy.encounter]){delete record.campaignRules;delete record.difficulty;delete record.companyOrders;delete record.companyPackage;}
  delete legacy.company;delete legacy.storyProgress;
  delete legacy.snapshot.company;delete legacy.snapshot.storyProgress;
  const restored=Game.deserialize(JSON.stringify(legacy));
  assert.equal(restored.company.length,5);assert.deepEqual(restored.storyProgress,{});
  assert.deepEqual(restored.snapshot.company,restored.company);
  const withoutAdditions=clone(restored);
  delete withoutAdditions.company;delete withoutAdditions.storyProgress;
  delete withoutAdditions.snapshot.company;delete withoutAdditions.snapshot.storyProgress;
  assert.deepEqual(withoutAdditions,legacy);
  assert.equal(Game.retry(restored).ok,true);
  assert.equal(restored.rank,'Tiro');assert.equal(restored.decisions.ch1,'report');
});

test('Compatibility: malformed new career/read fields are rejected rather than silently repaired',()=>{
  const state=Game.newGame();
  for(const mutate of [s=>s.company[0].recovery=3,s=>s.company[0].commendations=100,s=>s.company=null,s=>s.storyProgress={'ch1:arrival':999}]){
    const corrupted=clone(state);mutate(corrupted);
    assert.throws(()=>Game.deserialize(JSON.stringify(corrupted)),/Invalid save/);
  }
});

test('Compatibility: malformed authored mission and chamber data fail before an imported save can reach play',()=>{
  const battle=fieldFixture();
  const contest=debugJump(Game.newGame(),11,true);Game.choose(contest,'independent');Game.startEncounter(contest);
  assert.deepEqual(Game.deserialize(Game.serialize(battle)),battle);
  assert.deepEqual(Game.deserialize(Game.serialize(contest)),contest);
  const battleCases=[
    e=>e.mission=null,e=>delete e.mission,e=>e.scenario='another-map',e=>e.mission.mode='unknown',
    e=>e.mission.holdProgress=-1,e=>e.mission.rallyProgress=31,e=>e.mission.envoyProgress=1.5,
    e=>e.mission.points=[{x:8,y:1,secured:false}],e=>e.mission.points=[{x:1,y:1,secured:'yes'}],
    e=>e.mission.waves=[{turn:0,x:1,y:1,role:'infantry',arrived:false}],
    e=>e.mission.waves=[{turn:3,x:1,y:1,role:null,arrived:false}],
    e=>e.mission.escortIds='escort',e=>e.mission.escortIds=['missing'],e=>e.mission.escortIds=['hero'],
    e=>e.units[0].facing='diagonal',e=>e.units[0].formation='invincible',
    e=>e.units[0].veteranId='unknown',e=>e.turnEvents=[null],
  ];
  const contestCases=[
    e=>e.issue=null,e=>delete e.issue,e=>e.rivalStyle='unknown',e=>e.recordUses=['hero'],
    e=>e.recordUses=['member0','member0'],e=>e.recordUses=null,
    e=>e.units.find(u=>u.role==='voter').interest='anything',
  ];
  for(const[state,cases]of[[battle,battleCases],[contest,contestCases]])for(const mutate of cases){
    const corrupted=clone(state);mutate(corrupted.encounter);
    assert.throws(()=>Game.deserialize(JSON.stringify(corrupted)),/Invalid save/);
  }
});

test('Compatibility: a frozen pre-upgrade active battle retries to its exact original board, RNG and checkpoint',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./compatibility/legacy-battle-checkpoint.json',import.meta.url),'utf8'));
  const originalStart=Game.deserialize(JSON.stringify(fixture.start));
  const resumed=Game.deserialize(JSON.stringify(fixture.active));
  assert.equal(resumed.encounterOptions.legacyLayout,true);
  assert.equal(resumed.encounter.scenario,undefined);
  assert.equal(Game.retry(resumed).ok,true);
  assert.deepEqual(resumed,originalStart);
  const target=Game.getTargets(resumed,'hero','move')[0];
  assert.equal(Game.act(resumed,{unitId:'hero',action:'move',x:target.x,y:target.y}).ok,true);
  assert.equal(Game.endTurn(resumed).ok,true);
  assert.deepEqual(resumed,Game.deserialize(JSON.stringify(fixture.active)),'The original legal action and enemy response still produce the original saved state.');
  assert.equal(Game.retry(resumed).ok,true);
  assert.deepEqual(resumed,originalStart);
  // Inject only the settled status to isolate a reload-at-commit boundary.
  resumed.encounter.status='won';
  const atCommit=Game.deserialize(Game.serialize(resumed));
  assert.equal(Game.commitEncounter(atCommit).ok,true);
  assert.equal(atCommit.company[0].service,1);
  const once=Game.serialize(atCommit);
  assert.equal(Game.commitEncounter(atCommit).ok,false);
  assert.equal(Game.serialize(atCommit),once);
  assert.equal(Game.startEncounter(atCommit).ok,true);
  assert.equal(atCommit.encounter.scenario,'ch2-rearguard','Only the preserved active encounter keeps its old map; the next mission uses the authored map.');
});

test('Compatibility: a frozen pre-upgrade active Contest retains its rules, exact retry, and commit boundary',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./compatibility/legacy-contest-checkpoint.json',import.meta.url),'utf8'));
  const originalStart=Game.deserialize(JSON.stringify(fixture.start));
  const resumed=Game.deserialize(JSON.stringify(fixture.active));
  assert.equal(resumed.encounterOptions.legacyLayout,true);
  assert.equal(resumed.encounter.issue,undefined);
  assert.equal(Game.retry(resumed).ok,true);
  assert.deepEqual(resumed,originalStart);
  const target=Game.getTargets(resumed,'hero','move')[0];
  assert.equal(Game.act(resumed,{unitId:'hero',action:'move',x:target.x,y:target.y}).ok,true);
  assert.equal(Game.endTurn(resumed).ok,true);
  assert.deepEqual(resumed,Game.deserialize(JSON.stringify(fixture.active)),'The original legal speech-turn response remains deterministic after import.');
  assert.equal(Game.retry(resumed).ok,true);
  assert.deepEqual(resumed,originalStart);
  // This injected won status isolates the transaction boundary, not a legal campaign victory.
  resumed.encounter.status='won';
  const atCommit=Game.deserialize(Game.serialize(resumed));
  assert.equal(Game.commitEncounter(atCommit).ok,true);
  const once=Game.serialize(atCommit);
  assert.equal(Game.commitEncounter(atCommit).ok,false);
  assert.equal(Game.serialize(atCommit),once);
  assert.equal(Game.startEncounter(atCommit).ok,true);
  assert.ok(atCommit.encounter.issue,'The following chamber uses its new authored issue.');
  assert.equal(atCommit.encounterOptions.legacyLayout,undefined);
});

test('Governance: allocation and entered judgment have concrete, persistent province descriptions',()=>{
  const state=debugJump(Game.newGame(),10,true);Game.choose(state,'shared');
  assert.equal(Game.allocate(state,{river:2,farms:1,town:3}).ok,true);
  assert.equal(Game.judge(state,'shared').ok,true);
  const text=Game.provinceSummary(state).join(' ');
  assert.match(text,/5 additional morale/);assert.match(text,/0 integrity/);
  assert.match(text,/Landholder delegates begin/);assert.match(text,/Civic delegates begin/);
  assert.ok(Game.storyLines(state).some(line=>line.speaker==='The provincial record'));
});
