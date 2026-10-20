import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {playEncounter} from '../scripts/autoplay.mjs';
import {commandDoctrine,commandAssignment,chapterOpportunity} from '../src/core/command-campaign.js';
import {clone,distance,pathDistance} from '../src/core/shared.js';
import {combatBreakdown,planBattleUnit} from '../src/core/battle.js';
import {BATTLE_BALANCE} from '../src/data/battle-balance.js';
const camps=new Map();let campaign;
function baseline(){return campaign??=runCommandCampaign({onCheckpoint:s=>camps.set(G.getChapter(s).encounters[s.encounterIndex].id,clone(s))});}
function started(id='ch5-mine',plan='balanced'){
  baseline();const s=clone(camps.get(id));
  // Fund focused plan comparisons equally. This fixture is not a completion run.
  s.supplies=20;
  if(G.operationalPlan(s).enabled)assert.ok(G.chooseOperationalPlan(s,plan).ok);
  assert.ok(G.startEncounter(s,s.chapter===12?{route:'backer'}:{}).ok);return s;
}
// Position/HP injections in focused tests below are mechanic fixtures. Only
// the New Game harness above is used as evidence of campaign completion.
function beside(s,id){
  const e=s.encounter,o=e.field.objects.find(o=>o.id===id),hero=e.units.find(u=>u.id==='hero');
  const p=[{x:o.x-1,y:o.y},{x:o.x+1,y:o.y},{x:o.x,y:o.y-1},{x:o.x,y:o.y+1}].find(p=>p.x>=0&&p.y>=0&&p.x<e.width&&p.y<e.height&&!['rock','river'].includes(e.terrain[p.y][p.x]));
  assert.ok(p);e.units=e.units.filter(u=>u.id==='hero'||u.x!==p.x||u.y!==p.y);Object.assign(hero,p,{acted:false,moved:false});return hero;
}
test('edition34 full campaign covers twelve chapters, six issue cases and exact Retry',()=>{
  const r=baseline();assert.equal(r.rank,'Augustus');assert.equal(r.checks.length,25);assert.equal(r.cases.length,6);assert.equal(r.state.commandCampaign.records.length,25);
});
test('older editions retain their state and active checkpoints until camp opt-in',()=>{
  const s=G.newGame('Legacy',275,{featureEdition:31,progression:true});assert.equal(s.campaignEdition,undefined);
  G.choose(s,'report');G.startEncounter(s);const before=G.serialize(s);assert.equal(G.enableCommandCampaign(s).ok,false);assert.equal(G.serialize(s),before);
  assert.equal(playEncounter(s).status,'won');G.commitEncounter(s);assert.ok(G.enableCommandCampaign(s).ok);assert.equal(s.featureEdition,31);assert.equal(s.campaignEdition,34);assert.equal(s.history.length,1);G.deserialize(G.serialize(s));
});
test('operational plan descriptions, affordability and combined package costs are truthful',()=>{
  const s=clone((baseline(),camps.get('ch5-mine')));s.supplies=2;
  const before=G.serialize(s);assert.ok(G.operationalPlan(s).options.find(p=>p.id==='engineers').available);assert.equal(G.serialize(s),before);
  assert.ok(G.prepareCompany(s,'rearm').ok);assert.equal(G.chooseOperationalPlan(s,'engineers').ok,false);assert.equal(s.supplies,2);
  assert.ok(G.prepareCompany(s,'none').ok);assert.ok(G.chooseOperationalPlan(s,'engineers').ok);s.supplies=1;
  const poor=G.serialize(s);assert.equal(G.startEncounter(s).ok,false);assert.equal(G.serialize(s),poor);
});
test('operational and company costs both determine exhaustion before deployment, with exact paid Retry',()=>{
  // This unchanged fixture was earned by the older legal command campaign.
  // Its Chapter X camp has exactly two supplies; none are injected here.
  const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
  const camp=fixtures.scenes.find(scene=>scene.id==='board-ch10-road').state.snapshot;
  const deploy=(plan,pack)=>{
    const s=G.deserialize(JSON.stringify(camp));assert.equal(s.supplies,2);
    assert.ok(G.enableCommandCampaign(s).ok);assert.ok(G.prepareCompany(s,pack).ok);
    assert.ok(G.chooseOperationalPlan(s,plan).ok);assert.ok(G.startEncounter(s).ok);return s;
  };
  const packagePaid=deploy('balanced','rearm'),operationPaid=deploy('engineers','none'),unspent=deploy('balanced','none');
  const allies=s=>s.encounter.units.filter(u=>u.side==='ally').map(u=>({id:u.id,hp:u.hp,morale:u.morale}));
  assert.equal(unspent.encounter.condition,'strained');
  assert.equal(packagePaid.encounter.condition,'exhausted');assert.equal(operationPaid.encounter.condition,'exhausted');
  assert.deepEqual(allies(operationPaid),allies(packagePaid));
  assert.ok(allies(operationPaid).every((u,i)=>u.hp===allies(unspent)[i].hp-2&&u.morale===60));
  for(const s of [packagePaid,operationPaid]){
    assert.equal(s.supplies,0);assert.equal(s.snapshot.supplies,2);
    const before=G.serialize(s);assert.ok(G.endTurn(s).ok);assert.ok(G.retry(s).ok);
    assert.equal(G.serialize(s),before);G.deserialize(G.serialize(s));
  }
});
test('initial battlefield progress includes prepared integrity and delayed reinforcement timing',()=>{
  const engineers=started('ch5-mine','engineers').encounter;
  assert.ok(engineers.objectiveProgress.includes(`line ${engineers.defence}`),engineers.objectiveProgress);
  const recon=started('ch5-wall','recon').encounter,wave=recon.mission.waves.find(w=>!w.arrived);
  assert.ok(wave);assert.ok(recon.pressure.includes(`turn ${wave.turn} `),recon.pressure);
  const normal=started('ch5-wall').encounter;
  assert.equal(wave.turn,normal.mission.waves.find(w=>!w.arrived).turn+1);
});
test('engineer preparation opens real routes, costs supplies once and reduces commander marching',()=>{
  const ordinary=started(),s=started('ch5-mine','engineers'),e=s.encounter;
  assert.equal(s.supplies,ordinary.supplies-2);assert.equal(e.units[0].move,ordinary.encounter.units[0].move-1);
  assert.equal(e.field.objects.find(o=>o.id==='gate').state,'open');assert.equal(e.terrain[5][8],'ford');
  const before=G.serialize(s);G.endTurn(s);G.retry(s);assert.equal(G.serialize(s),before);
});
test('reconnaissance and reserve plans have real benefits and real tradeoffs',()=>{
  const s=started('ch3-station','recon'),normal=started('ch3-station');
  assert.ok(s.encounter.units.every(u=>!u.hidden));assert.equal(s.encounter.units[0].cohesion,normal.encounter.units[0].cohesion-10);
  const r=started('ch5-wall','reserve'),b=started('ch5-wall');
  assert.equal(r.encounter.commandCapacity,b.encounter.commandCapacity+1);assert.equal(r.encounter.units[0].ammo,b.encounter.units[0].ammo-1);
});
test('chapter opportunities change mechanics and preserve the competing-choice transaction',()=>{
  const s=started(),e=s.encounter;
  assert.equal(chapterOpportunity(e,'stores').effect,'engineering');beside(s,'stores');
  const before=G.serialize(s),forecast=G.previewFieldAction(s,'stores');assert.match(forecast.message,/side gate/);assert.equal(G.serialize(s),before);
  assert.ok(G.fieldAction(s,'stores').ok);assert.equal(e.field.objects.find(o=>o.id==='bridge').state,'repaired');
  assert.equal(e.commandCampaign.opportunity,'stores');assert.equal(G.fieldAction(s,'signal').ok,false);G.deserialize(G.serialize(s));G.retry(s);assert.equal(s.encounter.commandCampaign.opportunity,null);
  const second=started('ch2-marsh');const h=beside(second,'stores');h.hp-=4;const hp=h.hp;G.fieldAction(second,'stores');assert.equal(h.hp,hp+3);
  const fortified=started('ch4-gate');fortified.encounter.defence=120;beside(fortified,'stores');
  assert.ok(G.fieldAction(fortified,'stores').ok);assert.equal(fortified.encounter.defence,120,'Repairs never weaken an already stronger position');
});
for(const [id,opportunity]of [['ch5-mine','stores'],['ch5-wall','signal']])test(`Chapter V ${id} supports a legal ${opportunity} detour and winning continuation`,()=>{
  const s=clone((baseline(),camps.get(id)));
  assert.ok(G.chooseOperationalPlan(s,'balanced').ok);assert.ok(G.startEncounter(s).ok);
  let secured=false;
  const outcome=playEncounter(s,{beforeTurn:state=>{
    const e=state.encounter,h=e.units.find(u=>u.id==='hero'),o=e.field.objects.find(o=>o.id===opportunity);
    if(!secured){
      if(distance(h,o)>1){
        const p=G.getTargets(state,'hero','move').sort((a,b)=>pathDistance(e,a,o,h.id)-pathDistance(e,b,o,h.id)||a.cost-b.cost)[0];
        if(p)assert.ok(G.act(state,{unitId:'hero',action:'move',x:p.x,y:p.y}).ok);
      }
      const before=G.serialize(state),preview=G.previewFieldAction(state,opportunity);
      assert.equal(G.serialize(state),before);
      if(preview.ok){assert.ok(G.fieldAction(state,opportunity).ok);secured=true;}
    }
    if(h.hp<=h.maxHp-4&&G.getActions(state,'hero').includes('rally')){
      const t=G.getTargets(state,'hero','rally')[0];assert.ok(G.act(state,{unitId:'hero',action:'rally',x:t.x,y:t.y,targetId:t.unitId}).ok);
    }
  }});
  assert.ok(secured,'The commander reached and secured the opportunity through legal commands');
  assert.equal(outcome.status,'won');assert.ok(G.commitEncounter(s).ok);
  assert.equal(s.commandCampaign.records.at(-1).opportunity,opportunity);G.deserialize(G.serialize(s));
});
test('every field chapter has authored opportunities instead of a repeated supply trade',()=>{
  baseline();const effects=new Set(),labels=new Set();
  for(const [id,c]of camps){if(G.getChapter(c).encounters[c.encounterIndex].kind!=='battle'||id==='ch1-training')continue;const s=started(id);for(const o of G.commandBriefing(s).opportunities){labels.add(o.label);effects.add(o.effect);}}
  assert.ok(labels.size>=20);assert.ok(effects.size>=10);
});
test('side-level doctrines are pure, reserve release and loss of a focus trigger replanning',()=>{
  const s=started(),e=s.encounter,before=G.serialize(s),d=commandDoctrine(e);assert.ok(d.reserveId);
  const unit=e.units.find(u=>u.id===d.reserveId);assert.equal(commandAssignment(e,unit).hold,true);
  assert.deepEqual(planBattleUnit(e,unit),planBattleUnit(e,unit));assert.equal(G.serialize(s),before);
  e.turn=3;assert.equal(commandDoctrine(e).reserveId,null);
  e.units.find(u=>u.id===d.focusId).hp=0;assert.notEqual(commandDoctrine(e).focusId,d.focusId);
});
test('interdiction uses visible columns, while hidden units cannot supply a focus',()=>{
  const s=started('ch8-ferry'),e=s.encounter;assert.equal(e.units.find(u=>u.id===commandDoctrine(e).focusId).role,'escort');
  for(const u of e.units.filter(u=>u.role==='escort'))u.hidden=true;assert.notEqual(e.units.find(u=>u.id===commandDoctrine(e).focusId).role,'escort');
});
test('frontal mounted charge reaction is exact, once per round and absent on flanks or ranged attacks',()=>{
  const s=started('ch9-wing'),e=s.encounter,h=e.units.find(u=>u.id==='hero'),enemy=e.units.find(u=>u.role==='cavalry');
  // Inject a player-controlled mounted test attacker with legal adjacency.
  Object.assign(h,{x:2,y:3,role:'cavalry',lastMoveDistance:2,damage:3});Object.assign(enemy,{x:3,y:3,facing:'west',braced:true,hp:20,maxHp:20});
  e.units=e.units.filter(u=>u===h||u===enemy);e.terrain[3][2]='grass';e.terrain[3][3]='grass';
  let hit=combatBreakdown(e,h,enemy);assert.equal(hit.counterDamage,1);const hp=h.hp;
  const command={unitId:'hero',action:'strike',targetId:enemy.id,x:enemy.x,y:enemy.y};assert.match(G.preview(s,command).message,/1 damage to/);assert.ok(G.act(s,command).ok);assert.equal(h.hp,hp-1);assert.equal(enemy.reactionTurn,e.turn);
  assert.equal(combatBreakdown(e,h,enemy).counterDamage,0);delete enemy.reactionTurn;enemy.facing='east';assert.equal(combatBreakdown(e,h,enemy).counterDamage,0);enemy.facing='west';assert.equal(combatBreakdown(e,h,enemy,true).counterDamage,0);
});
test('a mounted attacker withdrawn by the counter blow shakes nearby companions like any other loss',()=>{
  const s=started('ch9-wing'),e=s.encounter,h=e.units.find(u=>u.id==='hero'),enemy=e.units.find(u=>u.role==='cavalry');
  // Injected mechanic fixture: a one-hit-point mounted attacker, a companion within two tiles and one beyond.
  const near=e.units.find(u=>u.side==='ally'),far=e.units.filter(u=>u.side==='ally')[1];assert.ok(near&&far);
  Object.assign(h,{x:2,y:3,role:'cavalry',lastMoveDistance:2,damage:3,hp:1});Object.assign(enemy,{x:3,y:3,facing:'west',braced:true,hp:20,maxHp:20});
  Object.assign(near,{x:1,y:4,morale:80});Object.assign(far,{x:0,y:0,morale:80});
  e.units=e.units.filter(u=>[h,enemy,near,far].includes(u));for(const p of [[3,2],[3,3],[4,1],[0,0]])e.terrain[p[0]][p[1]]='grass';
  const command={unitId:'hero',action:'strike',targetId:enemy.id,x:enemy.x,y:enemy.y},before=G.serialize(s);
  assert.ok(G.preview(s,command).message.endsWith(`${h.name} would withdraw, shaking companions within 2 tiles.`));assert.equal(G.serialize(s),before,'The forecast changes nothing');
  assert.ok(G.act(s,command).ok);assert.equal(h.hp,0);
  assert.equal(near.morale,80-BATTLE_BALANCE.withdrawalShock,'A companion within two tiles is shaken');assert.equal(far.morale,80,'One farther away is not');
});
test('earned issue evidence forecasts exact clamped shifts, costs one speech and cannot repeat',()=>{
  const s=started('ch11-accounts'),e=s.encounter,c=G.caseOptions(s).find(c=>c.preview.ok);assert.ok(c);
  const before=G.serialize(s),preview=G.previewCase(s,c.id);assert.equal(G.serialize(s),before);
  const stances=new Map(e.units.filter(u=>u.role==='voter').map(u=>[u.id,u.stance]));
  assert.ok(G.presentCase(s,c.id).ok);assert.equal(e.units.find(u=>u.id==='hero').acted,true);
  for(const u of e.units.filter(u=>u.role==='voter'))assert.equal(u.stance,preview.changes.find(c=>c.id===u.id)?.to??stances.get(u.id));
  const after=G.serialize(s);assert.equal(G.presentCase(s,c.id).ok,false);assert.equal(G.serialize(s),after);G.deserialize(after);G.retry(s);assert.equal(s.encounter.commandCampaign.case,null);
});
test('command saves reject mixed editions, forged case or opportunity effects and invalid reactions',()=>{
  for(const mutate of [s=>s.snapshot.campaignEdition=35,s=>s.campaignEdition=35,s=>s.encounter.commandCampaign.case='imaginary',s=>s.encounter.commandCampaign.escortPace=3,s=>s.encounter.commandCampaign.cavalryDenied=true,s=>s.encounter.units[0].reactionTurn=99]){
    const s=started();mutate(s);assert.throws(()=>G.deserialize(G.serialize(s)),/Invalid save/);
  }
});
test('documented witnesses honor Lucan’s authored absence and have no autonomous death rule',()=>{
  const s=started('ch7-council');assert.equal(G.commandBriefing(s).witness.id,'lucan');
  const c=clone(camps.get('ch7-council'));c.decisions.ch2='leave';c.company[0]={...c.company[0],id:'sabinus',name:'Sabinus'};c.companyOrders.priority=c.companyOrders.priority.map(id=>id==='lucan'?'sabinus':id);if(c.progression.specializations.lucan){c.progression.specializations.sabinus=c.progression.specializations.lucan;delete c.progression.specializations.lucan;}
  assert.equal(G.commandBriefing(c).witness.id,'sabinus');assert.match(G.commandBriefing(c).witness.description,/Lucan remains absent/);
});
test('archive replay isolates the chronicle and clears an incompatible future operational plan',()=>{
  const s=clone(baseline().state);s.commandCampaign.plan='engineers';const original=G.serialize(s);
  const replay=G.createArchiveReplay(s,'ch1-training');assert.ok(replay.ok,replay.message);
  assert.equal(G.serialize(s),original);assert.equal(replay.state.commandCampaign.plan,'balanced');
  assert.equal(replay.state.encounter.commandCampaign.plan,'balanced');
  const practice=replay.state;
  for(let turn=0;turn<10&&practice.encounter.status==='active';turn++){
    const e=practice.encounter,hero=e.units.find(u=>u.id==='hero'),enemy=e.units.find(u=>u.side==='enemy'&&u.hp>0);
    for(const action of ['move','brace','throw','strike']){
      if(e.status!=='active'||e.usedAbilities.includes(action))continue;
      if(action==='strike'&&!G.getTargets(practice,'hero','strike').length&&enemy){
        const p=G.getTargets(practice,'hero','move').sort((a,b)=>distance(a,enemy)-distance(b,enemy))[0];
        if(p)assert.ok(G.act(practice,{unitId:'hero',action:'move',x:p.x,y:p.y}).ok);
      }
      const t=G.getTargets(practice,'hero',action)[0];if(t)assert.ok(G.act(practice,{unitId:'hero',action,x:t.x,y:t.y,targetId:t.unitId}).ok);
    }
    if(e.status==='active')assert.ok(G.endTurn(practice).ok);
  }
  assert.equal(practice.encounter.status,'won');assert.equal(G.commitEncounter(practice).ok,false);
  assert.equal(G.serialize(s),original);
});
test('both authored evidence cases remain playable in every hearing',()=>{
  const primary=baseline(),other=runCommandCampaign({caseVariant:1});
  assert.equal(other.rank,'Augustus');assert.equal(other.cases.length,6);
  for(const c of primary.cases){
    assert.notEqual(other.cases.find(x=>x.encounter===c.encounter).id,c.id);
    assert.equal(primary.state.commandCampaign.records.find(r=>r.id===c.encounter).case,c.id);
  }
  const committed=G.serialize(other.state);assert.equal(G.commitEncounter(other.state).ok,false);assert.equal(G.serialize(other.state),committed);
});
test('edition34 preserves the zero-standing backing floor and the authored parley perimeter',()=>{
  const s=clone((baseline(),camps.get('ch12-confrontation')));
  // Explicit adverse-meter fixture, not a claimed legal full-route profile.
  Object.assign(s.meters,{army:0,political:0,public:0});s.commandCampaign.plan='balanced';
  assert.ok(G.finaleForecast(s).routes.some(r=>r.id==='backer'));assert.ok(G.startEncounter(s,{route:'backer'}).ok);
  const outcome=playEncounter(s,{beforeTurn:state=>{const h=state.encounter.units.find(u=>u.id==='hero'),t=G.getTargets(state,'hero','rally')[0];if(t&&h.hp<=h.maxHp-4)assert.ok(G.act(state,{unitId:'hero',action:'rally',x:t.x,y:t.y,targetId:t.unitId}).ok);}});
  assert.equal(outcome.status,'won');G.deserialize(G.serialize(s));
  const parley=started('ch12-confrontation'),e=parley.encounter;e.mission.mode='settlement';
  for(const u of e.units.filter(u=>u.side==='enemy'))assert.equal(commandAssignment(e,u),null);
});
