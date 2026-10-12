// v0.8 separates a small site shell from chapter-loaded production artwork.
// The old 2 MB whole-campaign gate prevented additional animation frames.
export const PRESENTATION_BUDGET=Object.freeze({
  initialGzipBytes:2_000_000,
  chapterOneGzipBytes:8_000_000,
  completeGzipBytes:24_000_000,
  decodedEntries:40,
  decodedBytes:64*1024*1024
});
