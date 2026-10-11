/** Observe downloaded editions without activating them or interrupting play. */
export function watchEditionUpdates(registration, {hadController, onReady}) {
  // The first installation prepares offline play; it is not an update notice.
  if (!hadController) return () => {};
  if (typeof onReady !== 'function') throw new TypeError('An update notification callback is required.');
  const notified = new WeakSet();
  const watching = new Map();
  let stopped = false;

  function watch(worker) {
    if (!worker || stopped || notified.has(worker) || watching.has(worker)) return;
    // Capture this worker: registration.installing can become null before this event.
    const changed = () => {
      if (stopped) return;
      if (worker.state === 'installed') {
        worker.removeEventListener('statechange', changed);
        watching.delete(worker);
        if (!notified.has(worker)) {
          notified.add(worker);
          onReady(worker);
        }
      } else if (worker.state === 'redundant') {
        worker.removeEventListener('statechange', changed);
        watching.delete(worker);
      }
    };
    watching.set(worker, changed);
    worker.addEventListener('statechange', changed);
    changed();
  }

  const found = () => { watch(registration.installing); watch(registration.waiting); };
  registration.addEventListener('updatefound', found);
  // Registration/ready may already have resolved after installation completed.
  found();
  return () => {
    if (stopped) return;
    stopped = true;
    registration.removeEventListener('updatefound', found);
    for (const [worker, changed] of watching) worker.removeEventListener('statechange', changed);
    watching.clear();
  };
}
