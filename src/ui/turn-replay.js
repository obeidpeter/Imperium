// A bounded presentation of the committed turn. It never mutates game state.
export function turnReplaySteps(before, after, events = []) {
  if (!before || !after || before.id !== after.id || after.turn === before.turn && after.status === before.status) return [];
  const lines = events.filter(line => typeof line === 'string' && line.trim());
  if (lines.length) return lines.slice(-6);
  const previous = new Map(before.units.map(unit => [unit.id, unit]));
  return after.units.flatMap(unit => {
    const old = previous.get(unit.id);
    if (!old || unit.hidden || old.hidden) return [];
    const changes = [];
    if (old.x !== unit.x || old.y !== unit.y) changes.push(`moves to ${unit.x + 1}${String.fromCharCode(65 + unit.y)}`);
    const delta = (unit.resolve ?? unit.hp) - (old.resolve ?? old.hp);
    if (delta) changes.push(`${delta < 0 ? 'loses' : 'recovers'} ${Math.abs(delta)} ${unit.resolve === undefined ? 'health' : 'Resolve'}`);
    return changes.length ? [`${unit.name} ${changes.join(' and ')}.`] : [];
  }).slice(-6);
}

export function turnScrubberItems(encounter, events = []) {
  if (!encounter) return [];
  const raw = (events?.length ? events : encounter.turnEvents?.length ? encounter.turnEvents : (encounter.log ?? []).slice(-6)).filter(line => typeof line === 'string' && line.trim()).slice(-6);
  return raw.map((text, index) => {
    const unit = (encounter.units ?? []).find(u => u.name && text.includes(u.name));
    const coord = /\b([1-8])([A-H])\b/.exec(text);
    const x = coord ? Number(coord[1]) - 1 : (unit?.x ?? null);
    const y = coord ? coord[2].charCodeAt(0) - 65 : (unit?.y ?? null);
    return { index, text, unitId: unit?.id ?? null, x, y, label: coord ? `${coord[1]}${coord[2]}` : (unit?.name ?? `Step ${index + 1}`) };
  });
}

export function createTurnReplay({show, finish, delay = fn => setTimeout(fn, 380), cancelDelay = clearTimeout}) {
  let timer, generation = 0, active = false;
  function stop() {
    generation++;
    if (timer !== undefined) cancelDelay(timer);
    timer = undefined;
    if (active) { active = false; finish(); }
  }
  return {
    start(steps, reducedMotion = false) {
      stop();
      if (reducedMotion || !steps.length) return;
      active = true;
      const current = generation;
      let index = 0;
      const next = () => {
        if (current !== generation) return;
        if (index === steps.length) { stop(); return; }
        show(steps[index], ++index, steps.length);
        timer = delay(next);
      };
      next();
    },
    stop,
    get active() { return active; }
  };
}
