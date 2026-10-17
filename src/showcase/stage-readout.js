// Read the committed encounter; these descriptors never predict an outcome.
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
  if (wave) entries.push({id:'wave',x:wave.x,y:wave.y,label:`Reinforcements · turn ${wave.turn}`,tone:'warning'});
  return entries;
}

export function tacticalLinks(encounter, {selected, target} = {}) {
  if (!encounter || encounter.kind !== 'battle') return [];
  const units = (encounter.units ?? []).filter(actorVisible), links = [];
  for (const unit of units) {
    if (unit.specialization !== 'protector' || !unit.guardTargetId) continue;
    const ward = units.find(u => u.id === unit.guardTargetId && Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y) <= 1);
    if (ward) links.push({id:`guard:${unit.id}:${ward.id}`, kind:'guard', from:{x:unit.x, y:unit.y}, to:{x:ward.x, y:ward.y}, color:'#edcf7c'});
  }
  const actor = selected && units.find(u => u.id === selected);
  if (actor && target && Number.isFinite(target.x) && Number.isFinite(target.y) && Math.abs(actor.x - target.x) + Math.abs(actor.y - target.y) > 1) {
    links.push({id:`aim:${actor.id}`, kind:'aim', from:{x:actor.x, y:actor.y}, to:{x:target.x, y:target.y}, color:'#89cfcb'});
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
  if (['ring','victory','defeat'].includes(effect.type)) return {text:'', color:effect.type === 'defeat' ? '#cb907e' : '#decc90', ring:true};
  return {text:delta ? signed : '', color:effect.type === 'shield' ? '#ffe2a3' : '#bdac91', ring:false};
}
