/** One active session mutation. Busy work is rejected, never queued for later. */
export function createSessionGate() {
  let active = false;
  return {
    get busy() { return active; },
    async run(work) {
      if (active) {
        const error = new Error('Another chronicle operation is still in progress.');
        error.code = 'SESSION_BUSY';
        throw error;
      }
      if (typeof work !== 'function') throw new TypeError('A session operation is required.');
      active = true;
      try { return await work(); }
      finally { active = false; }
    }
  };
}

/** Publish replacement UI state only after its load and durable save succeed.
 * Omit save only when load itself completes an atomic recovery or takeover.
 * Call inside the shared session gate so no old-state work can overlap it.
 */
export async function commitReplacement({load, save, publish}) {
  if (typeof load !== 'function' || typeof publish !== 'function' ||
      (save !== undefined && typeof save !== 'function')) {
    throw new TypeError('Replacement requires load and publish functions, and an optional save function.');
  }
  const candidate = await load();
  if (save) await save(candidate);
  await publish(candidate);
  return candidate;
}
