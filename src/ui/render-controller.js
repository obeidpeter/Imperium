// Coalesce DOM-to-Canvas work so discarded renders cannot bind stale controls.
export function createRenderScheduler(requestFrame, commit) {
  let revision = 0;
  return {
    schedule(payload) {
      const ticket = ++revision;
      requestFrame(() => { if (ticket === revision) commit(payload); });
      return ticket;
    },
    cancel() { revision++; }
  };
}

// Accepts an immutable campaign summary; delayed art cannot target a newer modal.
export async function prepareShareCard({canvas,summary,loadPortrait,loadScene,draw,downloadButton,shareButton,makeFile}) {
  downloadButton.disabled = true;
  shareButton.disabled = true;
  const [portrait, scene] = await Promise.all([loadPortrait(), loadScene()]);
  if (!canvas.isConnected) return null;
  draw(canvas, {...summary, portrait, scene});
  const blob = await new Promise(resolve => canvas.toBlob(resolve));
  if (!canvas.isConnected || !blob) return null;
  const file = makeFile(blob);
  downloadButton.disabled = false;
  downloadButton.textContent = 'Download card';
  shareButton.disabled = false;
  shareButton.textContent = 'Share with your device';
  return file;
}
