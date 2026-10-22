import {fieldBlocked} from '../core/field-geometry.js';
// Read the committed encounter; these descriptors never predict an outcome.
import {movementPinned, reachable, lineOfSight} from '../core/shared.js';
import {combatBreakdown, enemyFormationLinks, reinforcementBeacons} from '../core/battle.js';
export {reinforcementBeacons};
import {politicalPosition, INTEREST_EFFECTS} from '../core/contest.js';
import {BLOC_AFFINITIES} from '../data/contest-balance.js';
const bounded = (n, max) => Math.max(0, Math.min(1, Number(n) / Math.max(1, Number(max)) || 0));
export const civicActor = unit => ['speaker', 'voter'].includes(unit.role);
export const actorVisible = unit => !unit.hidden && (civicActor(unit) || (unit.resolve ?? unit.hp ?? 0) > 0);
export function actorReadout(unit, encounter) {
  if (unit.role === 'voter') {
    const stance = Number(unit.stance) || 0, promised = encounter.promises?.includes(unit.id);
    const agreed = encounter.staged?.agreements?.some(a => a.personId === (unit.negotiatorId || unit.id));
    return {type:'vote', tone:stance >= 1 ? 'support' : 'opposition', value:stance,
      ratio:bounded(Math.abs(stance), 6), signal:`${stance >= 1 ? '✓' : '−'} ${stance > 0 ? '+' : ''}${stance} stance`,
      detail:`${unit.bloc || 'Delegate'} · ${Math.abs(stance) >= 3 ? 'Committed' : 'Wavering'}${promised ? ' · Promised' : ''}${agreed ? ' · Agreed' : ''}`};
  }
  // A hearing's presiding magistrate (the walk-and-talk chamber): he receives the evidence.
  if (unit.presides) return {type:'office', tone:'neutral', value:0, ratio:1, signal:'Presides', detail:'Talk to him to present evidence'};
  if (unit.resolve !== undefined) {
    const withdrawn = unit.resolve <= 0;
    return {type:'resolve', tone:unit.side === 'enemy' ? 'opposition' : 'support', value:unit.resolve,
      ratio:bounded(unit.resolve, unit.maxResolve), signal:withdrawn ? 'Withdrawn' : `${unit.resolve} Resolve`,
      detail:withdrawn ? `Vote retained · ${unit.vote === 'for' ? 'supports' : 'opposes'}` : unit.blunted ? 'Next argument blunted' : 'Speaker'};
  }
  const units = encounter?.units ?? [];
  const guarded = units.some(u => u.side === 'ally' && (u.hp ?? 0) > 0 && u.specialization === 'protector' && u.guardTargetId === unit.id && Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y) <= 1);
  const guarding = unit.specialization === 'protector' && !!unit.guardTargetId && units.some(u => u.id === unit.guardTargetId && (u.hp ?? 0) > 0 && Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y) <= 1);
  const intent = String(unit.intent || ''), state = unit.braced ? 'Braced' : guarding ? 'Guarding' : guarded ? 'Guarded' : unit.morale < 30 ? 'Low morale'
    : /withdraw|fall back|regroup/i.test(intent) ? 'Withdrawing' : /shoot|ranged|arrow/i.test(intent) ? 'Aiming'
    : /charge/i.test(intent) ? 'Charging' : unit.ordered ? 'Order spent' : '';
  const specTag = unit.specialization === 'ranged' && unit.specialistAmmo > 0 ? ` · Volley ${unit.specialistAmmo}` : guarded ? ' · Ward −2' : '';
  return {type:'health', tone:unit.side === 'enemy' ? 'opposition' : unit.side === 'neutral' ? 'neutral' : 'support',
    value:unit.hp, ratio:bounded(unit.hp, unit.maxHp), signal:state,
    detail:`${unit.hp}/${unit.maxHp} health${unit.role === 'escort' ? ' · Protect' : ''}${specTag}`};
}

export function missionReadouts(encounter) {
  if (encounter.kind !== 'battle') return [];
  const mission=encounter.mission??{},labels={extract:'Extraction',hold:'Hold this ground',recover:'Recover the records',supply:'Protect the stores',settlement:'Meeting point',surrender:'Claimant’s standard'};
  const phasePrefix=encounter.operation?.phases?.length&&Number.isInteger(encounter.operation.index)?`Phase ${encounter.operation.index+1} · `:'';
  const entries=labels[mission.mode]&&encounter.goal ? [{id:'goal',...encounter.goal,label:`${phasePrefix}${labels[mission.mode]}`,tone:'goal'}] : [];
  for (const [index,point] of (mission.points??[]).entries()) entries.push({id:`point-${index}`,...point,label:`${ index===0&&!entries.length?phasePrefix:''}${point.secured?'✓ Secured':'◇ Secure'} ${index+1}`,tone:point.secured?'secured':'goal'});
  // Only the next publicly announced wave is marked, matching the orders panel.
  const wave=mission.waves?.find(item=>!item.arrived);
  if (wave) entries.push({id:'wave',x:wave.x,y:wave.y,label:`Reinforcements · ${mission.rounds?'round':'turn'} ${wave.turn}`,tone:'warning'});
  // A real-time footbridge is drawn in sections; only its middle one is named.
  for(const o of encounter.field?.objects??[])if(!o.section&&['available','closed','damaged','burning'].includes(o.state))entries.push({id:`field-${o.id}`,x:o.x,y:o.y,label:`${o.label} · ${o.state}`,tone:o.state==='burning'?'warning':'goal'});
  return entries;
}

export function targetRingColor(action, encounter, target) {
  if (['strike', 'throw', 'volley', 'denounce', 'threaten'].includes(action)) return '#d97a6c';
  if (['guard', 'brace', 'order', 'formation', 'promise', 'rebut'].includes(action)) return '#edcf7c';
  if (['move', 'deploy', 'scout', 'assist', 'inspire', 'rally', 'persuade', 'address', 'record'].includes(action)) return '#89cfcb';
  const unit = target?.unitId && encounter?.units?.find(u => u.id === target.unitId);
  return unit?.side === 'enemy' ? '#d97a6c' : '#89cfcb';
}

export function stagePreviewPath(encounter, unit, target) {
  if (!encounter || !unit || !target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return [];
  if (unit.x === target.x && unit.y === target.y) return [];
  const blocked = t => ['wall', 'river', 'stone'].includes(t);
  const units = (encounter.units ?? []).filter(actorVisible);
  const occupied = (x, y) => units.some(u => u.id !== unit.id && u.x === x && u.y === y);
  const queue = [[{x:unit.x, y:unit.y}]], seen = new Set([`${unit.x},${unit.y}`]);
  while (queue.length) {
    const path = queue.shift(), cur = path[path.length - 1];
    if (cur.x === target.x && cur.y === target.y) return path;
    if (path.length - 1 >= (unit.move || 3)) continue;
    if (path.length > 1 && encounter.kind === 'battle' && movementPinned(encounter, unit, cur)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy, key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= (encounter.width || 8) || ny >= (encounter.height || 8) || seen.has(key)) continue;
      if (blocked(encounter.terrain?.[ny]?.[nx]) || fieldBlocked(encounter,nx,ny) || occupied(nx, ny)) continue;
      seen.add(key);
      queue.push([...path, {x:nx, y:ny}]);
    }
  }
  return [{x:unit.x, y:unit.y}, {x:target.x, y:target.y}];
}

function intentTarget(encounter, enemy, units) {
  const intent = String(enemy?.intent || '');
  if (!intent) return null;
  const named = units.filter(u => u.id !== enemy.id && u.side !== 'enemy' && intent.includes(u.name))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (named) return {x:named.x, y:named.y};
  if (/objective/i.test(intent) && encounter.goal) return {x:encounter.goal.x, y:encounter.goal.y};
  const coord = /\b([1-8])([A-H])\b/.exec(intent);
  if (coord) return {x:Number(coord[1]) - 1, y:coord[2].charCodeAt(0) - 65};
  return null;
}

export function tacticalLinks(encounter, {selected, target, action} = {}) {
  if (!encounter) return [];
  const units = (encounter.units ?? []).filter(actorVisible), links = [];
  if (encounter.kind === 'battle') {
    for (const unit of units) {
      if (unit.specialization === 'protector' && unit.guardTargetId) {
        const ward = units.find(u => u.id === unit.guardTargetId && Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y) <= 1);
        if (ward) links.push({id:`guard:${unit.id}:${ward.id}`, kind:'guard', from:{x:unit.x, y:unit.y}, to:{x:ward.x, y:ward.y}, color:'#edcf7c'});
      }
      if (['player', 'ally'].includes(unit.side) && unit.formation) {
        for (const other of units) {
          if (['player', 'ally'].includes(other.side) && other.formation === unit.formation && unit.id < other.id && Math.abs(unit.x - other.x) + Math.abs(unit.y - other.y) <= 1) {
            links.push({id:`cohesion:${unit.id}:${other.id}`, kind:'cohesion', from:{x:unit.x, y:unit.y}, to:{x:other.x, y:other.y}, color:'#89cfcb'});
          }
        }
      }
    }
    for (const link of enemyFormationLinks(encounter)) {
      links.push({id:`enemy-cohesion:${link.fromId}:${link.toId}`, kind:'enemy-cohesion', from:link.from, to:link.to, color:'#d97a6c'});
    }
  }
  const actor = selected && units.find(u => u.id === selected);
  if (actor && target && action === 'move' && Number.isFinite(target.x) && Number.isFinite(target.y)) {
    const path = stagePreviewPath(encounter, actor, target);
    if (path.length >= 2) links.push({id:`path:${actor.id}`, kind:'path', from:path[0], to:path[path.length - 1], points:path, color:'#89cfcb'});
  } else if (encounter.kind === 'battle' && actor && target && Number.isFinite(target.x) && Number.isFinite(target.y) && Math.abs(actor.x - target.x) + Math.abs(actor.y - target.y) > 1) {
    links.push({id:`aim:${actor.id}`, kind:'aim', from:{x:actor.x, y:actor.y}, to:{x:target.x, y:target.y}, color:targetRingColor(action, encounter, target)});
  }
  const inspected = target && units.find(u => (target.unitId && u.id === target.unitId) || (u.x === target.x && u.y === target.y));
  if (inspected?.side === 'enemy') {
    const goal = intentTarget(encounter, inspected, units);
    if (goal && (goal.x !== inspected.x || goal.y !== inspected.y)) {
      links.push({id:`intent:${inspected.id}`, kind:'intent', from:{x:inspected.x, y:inspected.y}, to:goal, color:'#df9d85'});
    }
  }
  return links;
}

export function effectReadout(effect) {
  const delta = Number(effect.delta) || 0, signed = `${delta > 0 ? '+' : ''}${delta}`;
  if (effect.type === 'stance') return {text:`${signed} stance`, color:delta > 0 ? '#c7d9a1' : '#ecb394', ring:true};
  if (effect.type === 'morale') return {text:`${signed} morale`, color:delta > 0 ? '#c7d9a1' : '#ddb089', ring:true};
  if (effect.type === 'allegiance') return {text:'Allegiance changed', color:'#87d9d3', ring:true};
  if (effect.type === 'speech') return {text:'', color:'#ddc491', ring:true};
  if (effect.political && delta) return {text:`${signed} Resolve`, color:'#d5badc', ring:true};
  if (effect.healing) return {text:'Restored', color:'#a7d7a9', ring:true};
  if (['ring','victory','defeat'].includes(effect.type)) return {text:'', color:effect.type === 'defeat' ? '#cb907e' : ['rally','inspire'].includes(effect.action) ? '#f0cf7b' : '#decc90', ring:true, radius:['rally','inspire'].includes(effect.action)?2.6:1.2};
  return {text:delta ? signed : '', color:effect.type === 'shield' ? '#ffe2a3' : '#bdac91', ring:false};
}

export function previewBadge(preview, action) {
  if (!preview?.ok || !action || ['move', 'deploy', 'scout'].includes(action)) return null;
  const f = preview.forecast, msg = String(preview.message || '');
  if (f) {
    if (f.stanceChanges?.length === 1) { const c = f.stanceChanges[0], d = c.to - c.from; return {text:`${d >= 0 ? '+' : ''}${d} stance (${c.from} → ${c.to})`, color:'#c7d9a1'}; }
    if (f.stanceChanges?.length > 1) return {text:`Support ${f.votesBefore} → ${f.votesAfter}`, color:'#c7d9a1'};
    if (f.resolveChanges?.length === 1) { const c = f.resolveChanges[0], d = c.to - c.from; return {text:`${d >= 0 ? '+' : ''}${d} Resolve`, color:d >= 0 ? '#a7d7a9' : '#ecb394'}; }
    if (f.bluntedIds?.length) return {text:'Blunt speech', color:'#89cfcb'};
  }
  const dmg = /(\d+) damage/.exec(msg);
  if (dmg && ['strike', 'throw', 'volley'].includes(action)) return {text:`−${dmg[1]} HP${/\bFlank(?:ing)?\b/.test(msg) ? ' · Flank' : ''}`, color:'#f3b78b'};
  if (action === 'guard') return {text:'Ward −2 dmg', color:'#edcf7c'};
  if (action === 'brace') return {text:'Brace −2 dmg', color:'#edcf7c'};
  if (action === 'inspire') return {text:'+20 morale · +1 HP', color:'#a7d7a9'};
  if (action === 'assist') return {text:'+3 HP · Brace', color:'#a7d7a9'};
  if (action === 'rally') return {text:'+25 morale · +2 HP', color:'#a7d7a9'};
  if (action === 'order' || action === 'formation') return {text:action === 'formation' ? 'Formation order' : 'Direct order', color:'#edcf7c'};
  const st = /stance (-?\d+) → (-?\d+)/.exec(msg);
  if (st) { const d = Number(st[2]) - Number(st[1]); return {text:`${d >= 0 ? '+' : ''}${d} stance (${st[1]} → ${st[2]})`, color:'#c7d9a1'}; }
  const res = /([+-−]\d+) Resolve/.exec(msg);
  if (res) return {text:`${res[1]} Resolve`, color:'#d5badc'};
  return null;
}

export function previewBadges(state, command, preview) {
  const e = state?.encounter, action = command?.action;
  if (!preview?.ok || !e || !action || ['move', 'deploy', 'scout'].includes(action)) return {};
  const badges = {}, units = (e.units ?? []).filter(actorVisible), f = preview.forecast;
  if (f) {
    for (const c of f.stanceChanges ?? []) {
      const d = c.to - c.from;
      badges[c.id] = {text:`${d >= 0 ? '+' : ''}${d} stance (${c.from} → ${c.to})`, color:d >= 0 ? '#c7d9a1' : '#ecb394'};
    }
    for (const c of f.resolveChanges ?? []) {
      const d = c.to - c.from;
      badges[c.id] = {text:`${d >= 0 ? '+' : ''}${d} Resolve`, color:d >= 0 ? '#a7d7a9' : '#ecb394'};
    }
    for (const id of f.bluntedIds ?? []) badges[id] = {text:'Blunt speech', color:'#89cfcb'};
    if (Object.keys(badges).length) return badges;
  }
  if (e.kind === 'battle' && action === 'formation') {
    const ally = units.find(u => u.id === command.targetId || (u.x === command.x && u.y === command.y));
    if (ally) {
      const group = [ally, ...units.filter(u => ['player', 'ally'].includes(u.side) && u.id !== ally.id && Math.abs(u.x - ally.x) + Math.abs(u.y - ally.y) <= 1)].slice(0, 3);
      const kind = command.formation || 'shield-wall';
      const label = `${kind === 'wedge' ? 'Wedge +1 dmg' : kind === 'line' ? 'Line formation' : 'Shield wall −2 dmg'}${command.orderAction === 'hold' ? ' · Brace' : ''}`;
      for (const u of group) badges[u.id] = {text:label, color:'#edcf7c'};
      return badges;
    }
  }
  if (e.kind === 'battle' && action === 'rally') {
    const actor = units.find(u => u.id === command.unitId);
    if (actor) {
      for (const u of units.filter(v => ['player', 'ally'].includes(v.side) && Math.abs(v.x - actor.x) + Math.abs(v.y - actor.y) <= 3)) {
        badges[u.id] = {text:'+25 morale · +2 HP', color:'#a7d7a9'};
      }
      if (e.route === 'defection') {
        const foe = units.find(v => v.side === 'enemy' && (v.id === command.targetId || (v.x === command.x && v.y === command.y)));
        if (foe) badges[foe.id] = {text:(foe.morale ?? 60) - 40 <= 25 ? '−40 morale · Defects' : '−40 morale', color:'#87d9d3'};
      }
      return badges;
    }
  }
  const single = previewBadge(preview, action);
  const targetUnit = units.find(u => (command.targetId && u.id === command.targetId) || (u.x === command.x && u.y === command.y));
  if (single && targetUnit) badges[targetUnit.id] = single;
  return badges;
}

export function threatEnvelope(encounter, unitId) {
  if (!encounter || encounter.kind !== 'battle' || !unitId) return null;
  const unit = (encounter.units ?? []).find(u => u.id === unitId && actorVisible(u));
  if (!unit || unit.side !== 'enemy') return null;
  const moveTiles = [{x: unit.x, y: unit.y, cost: 0}, ...reachable(encounter, {...unit, moved: false})];
  const range = unit.role === 'archer' ? 3 : 1;
  const friends = (encounter.units ?? []).filter(u => actorVisible(u) && ['player', 'ally', 'neutral'].includes(u.side));
  const threatenedUnits = friends.filter(f => moveTiles.some(p => {
    const d = Math.abs(p.x - f.x) + Math.abs(p.y - f.y);
    return d <= range && (range === 1 || lineOfSight(encounter, p, f));
  })).map(f => ({id: f.id, name: f.name, x: f.x, y: f.y}));
  return {unitId: unit.id, range, moveTiles, threatenedUnits};
}

export function combatModifiers(state, command) {
  const e = state?.encounter, action = command?.action;
  if (!e || !action) return [];
  const actor = e.units?.find(u => u.id === command.unitId);
  const target = e.units?.find(u => (command.targetId && u.id === command.targetId) || (u.x === command.x && u.y === command.y));
  if (e.kind === 'battle' && ['strike', 'throw', 'volley'].includes(action) && actor && target) {
    const ranged = action === 'throw' || action === 'volley' || actor.role === 'archer';
    const hit = combatBreakdown(e, actor, target, ranged);
    return [
      {label: 'Base', value: hit.base, tone: 'neutral'},
      ...hit.modifiers.map(m => ({label: m.label, value: m.value, tone: m.value > 0 ? 'bonus' : 'penalty'})),
      {label: hit.aspect === 'flank' ? 'Flank' : 'Front', value: null, tone: hit.aspect === 'flank' ? 'bonus' : 'neutral'},
      ...(hit.formationBreakLabel ? [{label: hit.formationBreakLabel, value: null, tone: 'bonus'}] : []),
    ];
  }
  if (e.kind === 'contest' && ['persuade', 'promise', 'threaten', 'record', 'address'].includes(action) && actor) {
    const member = target?.role === 'voter' ? target : e.units?.find(u => u.role === 'voter');
    if (!member) return [];
    const chips = [];
    const base = INTEREST_EFFECTS[member.interest]?.[action] ?? 2;
    chips.push({label: `Interest (${member.interest})`, value: base, tone: 'neutral'});
    const affinity = e.politicsVersion === 2 ? (BLOC_AFFINITIES[member.bloc]?.[action] ?? 0) : 0;
    if (affinity) chips.push({label: `${member.bloc} affinity`, value: affinity, tone: affinity > 0 ? 'bonus' : 'penalty'});
    if (action === 'persuade') {
      const coop = politicalPosition(state, actor.id).persuadeBonus;
      if (coop) chips.push({label: 'Speaker cooperation', value: coop, tone: 'bonus'});
    }
    if (action === 'threaten' && e.hardened?.includes(member.bloc)) chips.push({label: 'Hardened bloc', value: -1, tone: 'penalty'});
    return chips;
  }
  return [];
}





