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
