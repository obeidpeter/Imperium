import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {votes} from '../src/core/contest.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';
import {combatModifiers, tacticalLinks, effectReadout} from '../src/showcase/stage-readout.js';
import {coalitionPanel, encounterDebrief, resultRecord} from '../src/ui/tactical-intel.js';
import {warCouncilAdvisories, warCouncilPanel} from '../src/ui/campaign-upgrade-views.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {REIGN_CARD_THEMES, reignLaurels, drawReignCard} from '../src/ui/renderer.js';
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

test('v0.27.0: Tactical Counter-Play (Cuneus & Testudo) exposes enemy formation links and formation-breaker diagnostics', () => {
  const s = start('ch2-marsh');
  const e = s.encounter;
  const hero = e.units.find(u => u.id === 'hero');
  const ally = e.units.find(u => u.side === 'ally' && u.id !== 'hero');
  const enemies = e.units.filter(u => u.side === 'enemy' && !u.hidden && u.hp > 0);
  assert.ok(enemies.length >= 2);

  enemies[0].x = 4;
  enemies[0].y = 3;
  enemies[0].formation = 'shield-wall';
  enemies[1].x = 4;
  enemies[1].y = 4;
  enemies[1].formation = 'shield-wall';
  const links = Game.enemyFormationLinks(e);
  assert.ok(links.some(l => (l.fromId === enemies[0].id && l.toId === enemies[1].id) || (l.fromId === enemies[1].id && l.toId === enemies[0].id)));

  const stageLinks = tacticalLinks(e, {
    selected: 'hero',
    action: null,
    target: null,
  });
  assert.ok(stageLinks.some(l => l.kind === 'enemy-cohesion'));

  hero.formation = 'wedge';
  hero.x = 3;
  hero.y = 3;
  e.terrain[3][3] = 'grass';
  const wedgeHit = Game.combatBreakdown(e, hero, enemies[0], false);
  assert.equal(wedgeHit.formationBreak, true);
  assert.equal(wedgeHit.formationBreakLabel, 'Wedge splits shield wall');

  const chips = combatModifiers(s, {
    unitId: 'hero',
    action: 'strike',
    x: enemies[0].x,
    y: enemies[0].y,
    targetId: enemies[0].id,
  });
  assert.ok(chips.some(c => c.label === 'Wedge splits shield wall' && c.tone === 'bonus'));

  hero.formation = 'line';
  enemies[0].facing = 'east';
  hero.x = 3;
  hero.y = 3;
  const flankHit = Game.combatBreakdown(e, hero, enemies[0], false);
  assert.equal(flankHit.formationBreak, true);
  assert.equal(flankHit.formationBreakLabel, 'Flank breaks shield line');
});

test('v0.27.0: Political Chamber Strategy (Calculus Curiae) computes 1-speech flips and At-Risk supporters', () => {
  const s = start('ch7-council');
  const e = s.encounter;
  const hero = e.units.find(u => u.id === 'hero');
  const voters = e.units.filter(u => u.role === 'voter');
  voters[0].stance = 1;
  voters[1].stance = 0;
  voters[1].x = hero.x + 1;
  voters[1].y = hero.y;
  const rival = e.units.find(u => u.side === 'enemy' && u.role === 'speaker');
  if (rival) {
    rival.x = voters[0].x + 1;
    rival.y = voters[0].y;
  }

  const whip = Game.coalitionWhipForecast(s);
  assert.ok(whip);
  assert.ok(Array.isArray(whip.atRisk));
  assert.ok(Array.isArray(whip.oneSpeechFlips));
  assert.ok(whip.oneSpeechFlips.length > 0);

  const html = coalitionPanel(e, votes(e), s);
  assert.match(html, /whip-forecast/);
  assert.match(html, /1-speech flips:/);
});

test('v0.27.0: 3D & 2D Morale Spectacle (Signa & Terror) renders morale rings and rally shockwave radii', async () => {
  const rallyReadout = effectReadout({type: 'ring', action: 'rally'});
  const inspireReadout = effectReadout({type: 'ring', action: 'inspire'});
  assert.equal(rallyReadout.radius, 2.6);
  assert.equal(inspireReadout.radius, 2.6);

  const {BattleStage} = await import('../src/showcase/stage.js');
  const T = await import('../vendor/three/three.module.js');
  const stage = Object.create(BattleStage.prototype);
  Object.assign(stage, {
    overlay: new T.Group(),
    targetGeometry: new T.RingGeometry(0.4, 0.55, 24),
    moraleRings: new Map(),
    world: tile => new T.Vector3(tile.x * 2.5, 0, tile.y * 2.5),
  });

  stage.updateMoraleRings({
    kind: 'battle',
    units: [
      {id: 'u1', name: 'Pledged cohort', side: 'ally', role: 'legionary', hp: 10, maxHp: 12, morale: 18, x: 2, y: 2},
    ],
  });
  const ring = stage.moraleRings.get('u1');
  assert.ok(ring, 'Unit receives a 3D morale ring mesh');
  assert.equal(ring.visible, true);
  assert.equal(ring.userData.moraleState, 'broken');
});

test('v0.27.0: Camp Immersion (Consilium Castrorum) generates companion War Council advisories', () => {
  const s = camp('ch4-gate');
  const advisories = warCouncilAdvisories(s);
  assert.ok(advisories.length >= 2);
  assert.ok(advisories.some(a => a.name.includes('Varro')));

  const panelHtml = warCouncilPanel(s);
  assert.match(panelHtml, /war-council-panel/);
  assert.match(panelHtml, /Consult the War Council/);

  const views = createCampaignViews(() => ({
    state: s,
    settings: {guide: false},
    chapterArtMarkup: () => '',
    helpTip: () => '',
    consequenceCards: () => '',
    meters: () => '',
    requirements: () => '',
  }));
  const campHtml = views.camp();
  assert.match(campHtml, /war-council-panel/);
});

test('v0.27.0: Post-Encounter After-Action Chronicle & Defeat Diagnostics (Acta Diurna)', () => {
  const s = start('ch2-marsh');
  const e = s.encounter;
  const hero = e.units.find(u => u.id === 'hero');
  e.status = 'won';
  e.log = [
    `Turn 1: ${hero.name} strikes Raider for 5.`,
    'Raider is withdrawn.',
    'Turn 2: Varro rallies the line.',
  ];
  const winDebrief = encounterDebrief(e);
  assert.ok(winDebrief.distinguished.name === hero.name);
  assert.ok(winDebrief.turningPoints.some(tp => tp.includes('withdrawn') || tp.includes('strikes')));
  assert.equal(winDebrief.diagnostic, null);

  const winHtml = resultRecord(e);
  assert.match(winHtml, /encounter-debrief/);
  assert.match(winHtml, /Distinguished service/);

  e.status = 'lost';
  hero.hp = 0;
  const lossDebrief = encounterDebrief(e);
  assert.ok(lossDebrief.diagnostic.includes('commander was overwhelmed'));
  const lossHtml = resultRecord(e);
  assert.match(lossHtml, /defeat-diagnostic/);
});

test('v0.27.0: Customizable Reign Card & Career Trophy Themes (Monumentum Aeternum)', async () => {
  const {CONFIG} = await import('../src/config.js');
  assert.equal(CONFIG.version, '0.27.0');
  const completed = clone(ensureCampaign().state);
  assert.ok(REIGN_CARD_THEMES.imperial);
  assert.ok(REIGN_CARD_THEMES.marble);
  assert.ok(REIGN_CARD_THEMES.bronze);

  const laurels = reignLaurels(completed);
  assert.ok(laurels.length >= 1);

  const calls = [];
  const fakeCtx = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    rect() {},
    clip() {},
    translate() {},
    scale() {},
    rotate() {},
    fill() {},
    stroke() {},
    ellipse() {},
    fillRect() {},
    strokeRect() {},
    fillText(text) { calls.push(String(text)); },
    measureText(text) { return {width: String(text).length * 8}; },
    createLinearGradient() { return {addColorStop() {}}; },
    createRadialGradient() { return {addColorStop() {}}; },
  };
  const fakeCanvas = {
    width: 1080,
    height: 1350,
    getContext() { return fakeCtx; },
  };
  drawReignCard(fakeCanvas, {
    name: completed.name,
    route: completed.route,
    theme: 'marble',
    laurels,
    choices: ['Mercy after victory'],
    stats: {encounters: 24, turns: 72, commendations: 5},
    url: 'https://example.com',
  });
  assert.ok(calls.some(t => t.includes(laurels[0])));

  let modalBody = '';
  const panels = createPanels(() => ({
    state: completed,
    settings: {},
    meters: () => '',
    requirements: () => '',
    showModal: (_t, b) => { modalBody = b; },
  }));
  panels.showSharePreview('bronze');
  assert.match(modalBody, /reign-card-theme/);
  assert.match(modalBody, /Legionary Bronze/);
});
