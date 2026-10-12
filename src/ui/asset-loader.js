/** Browser decoding is bounded separately from the HTTP/service-worker cache. */
export function decodeImage(src) {
  return new Promise(resolve => {
    if (typeof Image !== 'function') { resolve(null); return; }
    const image = new Image();
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (!value) image.src = '';
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 15000);
    image.decoding = 'async';
    image.onload = async () => {
      try { if (image.decode) await image.decode(); finish(image.naturalWidth ? image : null); }
      catch { finish(null); }
    };
    image.onerror = () => finish(null);
    image.src = src;
  });
}

export function constrainedConnection(connection = globalThis.navigator?.connection) {
  return Boolean(connection?.saveData || ['slow-2g','2g'].includes(connection?.effectiveType) ||
    (typeof connection?.downlink === 'number' && connection.downlink < 1));
}

/** Entries/estimated RGBA bytes count only references retained by this cache.
 * Browsers own HTMLImageElement decoding and may retain additional HTTP/DOM data.
 * Eviction drops our reference; it never invalidates an image still being drawn.
 */
export function createAssetLoader({decode = decodeImage, maxEntries = 24, maxBytes = 24*1024*1024,
  concurrency = 2, failureRetryMs = 15000, now = () => Date.now()} = {}) {
  const ready = new Map(), pending = new Map(), failures = new Map(), queue = [];
  let bytes = 0, active = 0, peakActive = 0, hits = 0, decoded = 0, evictions = 0;
  function trim() {
    while (ready.size > maxEntries || bytes > maxBytes) {
      const key = ready.keys().next().value, entry = ready.get(key);
      ready.delete(key); bytes -= entry.bytes; evictions++;
    }
  }
  function remember(src, image) {
    const estimate = (image.naturalWidth || image.width || 0) * (image.naturalHeight || image.height || 0) * 4;
    if (!estimate || estimate > maxBytes || maxEntries < 1) return;
    ready.set(src, {image, bytes:estimate}); bytes += estimate; trim();
  }
  function pump() {
    while (active < concurrency && queue.length) {
      const job = queue.shift(); active++; peakActive = Math.max(peakActive, active);
      Promise.resolve().then(() => decode(job.src)).catch(() => null).then(image => {
        if (image) { decoded++; failures.delete(job.src); remember(job.src, image); }
        else failures.set(job.src, now());
        pending.delete(job.src); active--; job.resolve(image || null); pump();
      });
    }
  }
  function peek(src) {
    const entry = ready.get(src);
    if (!entry) return null;
    ready.delete(src); ready.set(src, entry); return entry.image;
  }
  function load(src, {retry = false} = {}) {
    if (!src) return Promise.resolve(null);
    const image = peek(src);
    if (image) { hits++; return Promise.resolve(image); }
    if (pending.has(src)) { hits++; return pending.get(src); }
    if (!retry && failures.has(src) && now()-failures.get(src) < failureRetryMs) return Promise.resolve(null);
    const promise = new Promise(resolve => queue.push({src,resolve}));
    pending.set(src,promise); pump(); return promise;
  }
  async function prefetch(sources, {onProgress,retry=false} = {}) {
    const files = [...new Set(sources.filter(Boolean))], total = files.length;
    let completed = 0, failed = 0;
    const notify = () => onProgress?.({completed, total, failed, percent:total ? Math.floor(completed*100/total) : 100});
    notify();
    await Promise.all(files.map(async src => { if (!await load(src,{retry})) failed++; completed++; notify(); }));
    return {completed,total,failed};
  }
  function clear() { ready.clear(); failures.clear(); bytes = 0; }
  function stats() { return {entries:ready.size,estimatedBytes:bytes,maxEntries,maxBytes,active,pending:pending.size,peakActive,hits,decoded,evictions}; }
  return {load,peek,prefetch,clear,stats};
}

/** Warm compressed HTTP/service-worker responses without decoding next-chapter art. */
export async function prefetchFiles(sources,{fetcher=globalThis.fetch,shouldContinue=()=>true}={}) {
  const files=[...new Set(sources.filter(Boolean))];let index=0,completed=0,failed=0;
  async function worker(){
    while(index<files.length&&shouldContinue()){
      const src=files[index++];
      try{const response=await fetcher(src,{cache:'force-cache'});if(!response.ok)throw new Error('Unavailable');await response.arrayBuffer();}
      catch{failed++;}
      completed++;
    }
  }
  await Promise.all([worker(),worker()]);
  return {completed,total:files.length,failed};
}
