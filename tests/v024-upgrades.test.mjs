import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {actorKit} from '../src/showcase/actor-kit.js';
import {createActor} from '../src/showcase/actors.js';
import {combatCues} from '../src/showcase/combat-presentation.js';
import {threatEnvelope, combatModifiers} from '../src/showcase/stage-readout.js';
import {encounterView} from '../src/ui/encounter-view.js';
import {createPanels} from '../src/ui/panels.js';

const clone = x => JSON.parse(JSON.stringify(x));
const checkpoints = new Map();
let campaignResult = null;
function ensureCampaign() {
  if (!campaignResult) {
    campaignResult = runProgressionCampaign({
      onCheckpoint: s => checkpoints.set(Game.getChapter(s).encounters[s.encounterIndex].id, clone(s)),
    });
  }
  return campaignResult;
}
function camp(id) {
  ensureCampaign();
  return clone(checkpoints.get(id));
}
function start(id) {
  const s = camp(id);
  assert.ok(Game.startEncounter(s).ok);
  return s;
}

test('v0.24.0: Tactical Field Engineering (Munitiones) erects ramparts, stakes, and braziers and modifies combatBreakdown', () => {
  const s = start('ch4-gate');
  const plan = Game.fieldworkOptions(s);
  assert.equal(plan.options.length, 3);
  assert.ok(plan.options.every(t => t.unlocked));

  const preview = Game.previewFieldwork(s, 'rampart');
  assert.equal(preview.ok, true);
  assert.match(preview.message, /Earthwork Rampart/i);

  const invoked = Game.invokeFieldwork(s, 'rampart');
  assert.equal(invoked.ok, true);
  assert.equal(s.encounter.fieldworkUsed, 'rampart');
  assert.equal(s.encounter.fieldworks.length, 1);

  const hero = s.encounter.units.find(u => u.id === 'hero');
  const enemy = s.encounter.units.find(u => u.side === 'enemy');
  enemy.x = hero.x + 1;
  enemy.y = hero.y;
  const breakdown = Game.combatBreakdown(s.encounter, enemy, hero, false);
  assert.ok(breakdown.modifiers.some(m => m.label === 'Earthwork rampart' && m.value === -2));

  const view = encounterView({state: s, selected: 'hero', action: null, target: null});
  assert.match(view, /battle-fieldworks/);
  assert.match(view, /Erected \(rampart\)/);
});

test('v0.24.0: Stake palings negate enemy cavalry charge bonus and Signal brazier boosts ranged fire', () => {
  const s = start('ch5-mine');
  const hero = s.encounter.units.find(u => u.id === 'hero');
  const invoked = Game.invokeFieldwork(s, 'stakes');
  assert.equal(invoked.ok, true);

  const cav = s.encounter.units.find(u => u.side === 'enemy');
  cav.role = 'cavalry';
  cav.lastMoveDistance = 2;
  cav.x = hero.x + 1;
  cav.y = hero.y;
  const breakdown = Game.combatBreakdown(s.encounter, cav, hero, false);
  assert.ok(breakdown.modifiers.some(m => m.label === 'Stake palings' && m.value === -1));
  assert.ok(!breakdown.modifiers.some(m => m.label === 'Mounted charge'));
});

test('v0.24.0: Archive War-Room Mutators customize difficulty, weather, time of day, and approach in sandbox replay', () => {
  const completed = clone(ensureCampaign().state);
  const replay = Game.createArchiveReplay(completed, 'ch5-mine', {
    difficulty: 'veteran',
    weather: 'rain',
    timeOfDay: 'night',
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.state.difficulty, 'veteran');
  assert.equal(replay.state.encounter.weather, 'rain');
  assert.equal(replay.state.encounter.timeOfDay, 'night');
  assert.equal(replay.state.archiveReplay.weather, 'rain');

  const view = encounterView({state: replay.state, selected: 'hero', action: null, target: null});
  assert.match(view, /archive-mutators/);
  assert.match(view, /apply-archive-mutators/);
});

test('v0.24.0: 3D Legionary Aquila & Signum standards and Roman Cornu brass cues', () => {
  const eagleBearer = {id: 'escort0', name: 'Wounded Eagle-Bearer Varro', side: 'ally', role: 'escort', hp: 10, maxHp: 10, x: 2, y: 2};
  const leaderUnit = {id: 'ally0', name: 'Lucan', side: 'ally', role: 'legionary', specialization: 'leader', hp: 14, maxHp: 14, x: 2, y: 3};

  const eagleSpec = actorKit(eagleBearer, {chapter: 4, kind: 'battle'});
  const leaderSpec = actorKit(leaderUnit, {chapter: 6, kind: 'battle'});
  assert.equal(eagleSpec.signum, 'aquila');
  assert.equal(leaderSpec.signum, 'signum');

  const eagleRig = createActor(eagleBearer, {chapter: 4, kind: 'battle'});
  const leaderRig = createActor(leaderUnit, {chapter: 6, kind: 'battle'});
  assert.ok(eagleRig.group.getObjectByName('actor-signum'), 'Eagle-bearer mounts a 3D Aquila standard');
  assert.ok(leaderRig.group.getObjectByName('actor-signum'), 'Formation leader mounts a 3D Signum standard');
  eagleRig.dispose();
  leaderRig.dispose();

  const battle = {kind: 'battle', chapter: 6, units: [leaderUnit]};
  const cues = combatCues({tracks: [{unitId: 'ally0', action: 'formation', start: 0, duration: 0.5}], effects: []}, {encounter: battle});
  assert.ok(cues.some(c => c.kind === 'cornu'));
});

test('v0.24.0: Interactive 3D Threat Envelopes and Modifier Breakdown Chips (Oculus Tactica)', () => {
  const s = start('ch2-marsh');
  const hero = s.encounter.units.find(u => u.id === 'hero');
  const enemy = s.encounter.units.find(u => u.side === 'enemy');
  enemy.x = hero.x + 1;
  enemy.y = hero.y;

  const env = threatEnvelope(s.encounter, enemy.id);
  assert.ok(env);
  assert.equal(env.unitId, enemy.id);
  assert.ok(env.moveTiles.length > 0);
  assert.ok(env.threatenedUnits.some(u => u.id === 'hero'));

  const cmd = {unitId: 'hero', action: 'strike', x: enemy.x, y: enemy.y, targetId: enemy.id};
  const mods = combatModifiers(s, cmd);
  assert.ok(mods.length > 0);
  assert.ok(mods.some(m => m.label === 'Base'));

  const view = encounterView({
    state: s,
    selected: 'hero',
    action: 'strike',
    target: {x: enemy.x, y: enemy.y, unitId: enemy.id},
    focusTile: {x: enemy.x, y: enemy.y, unitId: enemy.id},
  });
  assert.match(view, /modifier-chips/);
  assert.match(view, /threat-envelope-readout/);
});

test('v0.24.0: Living Senate Chamber Named Delegate Interjections and 3D Rostra Dais', async () => {
  const s = start('ch7-council');
  const voter = s.encounter.units.find(u => u.role === 'voter');
  const callout = Game.delegateCallout(s.encounter, {
    unitId: 'hero',
    action: 'persuade',
    x: voter.x,
    y: voter.y,
    targetId: voter.id,
  });
  assert.ok(callout);
  assert.equal(callout.speaker, voter.name);
  assert.equal(callout.bloc, voter.bloc);
  assert.ok(callout.text.length > 10);

  const {BattleStage} = await import('../src/showcase/stage.js');
  const T = await import('../vendor/three/three.module.js');
  const stage = Object.create(BattleStage.prototype);
  Object.assign(stage, {
    overlay: new T.Group(),
    chamberStandards: new Map(),
    chamberRostra: null,
    world: tile => new T.Vector3(tile.x * 2.5, 0, tile.y * 2.5),
  });
  stage.updateChamberStandards(s.encounter);
  assert.ok(stage.chamberRostra, 'Senate chamber builds a 3D Rostra speaker dais');
  assert.equal(stage.chamberRostra.visible, true);

  stage.fieldworkMeshes = new Map();
  stage.updateFieldworks({
    kind: 'battle',
    fieldworks: [
      {type: 'stakes', x: 1, y: 1},
      {type: 'rampart', x: 2, y: 2},
      {type: 'brazier', x: 3, y: 3},
    ],
  });
  assert.equal(stage.fieldworkMeshes.size, 3);
});

test('v0.24.0: Interactive Cursus Honorum Monument in character dossier', () => {
  const s = camp('ch4-gate');
  const cursus = Game.cursusHonorum(s);
  assert.equal(cursus.length, 12);
  assert.equal(cursus[0].status, 'completed');
  assert.ok(cursus[0].turns > 0);
  assert.equal(cursus[3].status, 'current');
  assert.equal(cursus[11].status, 'locked');

  let modalHtml = '';
  const panels = createPanels(() => ({
    state: s,
    settings: {},
    meters: () => '<div>meters</div>',
    requirements: () => '<div>reqs</div>',
    showModal: (_title, body) => { modalHtml = body; },
  }));
  panels.showCharacter();
  assert.match(modalHtml, /cursus-monument/);
  assert.match(modalHtml, /Cursus Honorum · The Roman ladder/);
});
