// v0.8 separates a small site shell from chapter-loaded production artwork.
// The old 2 MB whole-campaign gate prevented additional animation frames.
export const PRESENTATION_BUDGET=Object.freeze({
  initialGzipBytes:2_000_000,
  // 0.37: raised from 8 MB, as Chapter I's figures wear generated bodies (recruit, trainer, legionary, Gothic warrior and archer).
  chapterOneGzipBytes:10_000_000,
  completeGzipBytes:24_000_000,
  decodedEntries:40,
  decodedBytes:64*1024*1024
});
