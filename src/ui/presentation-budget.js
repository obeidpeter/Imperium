// v0.8 separates a small site shell from chapter-loaded production artwork.
// The old 2 MB whole-campaign gate prevented additional animation frames.
// Each download figure is gzip bytes and includes the offline worker.
export const PRESENTATION_BUDGET=Object.freeze({
  initialGzipBytes:2_000_000,
  // The shell plus Chapter I for the 3D view. 0.37 raised it from 8 MB, as Chapter I's
  // figures wear generated bodies; the asset foundation (0.39) raised it from 10 MB
  // for the world models to come, as 3D players no longer download the 2D art.
  chapterOneGzipBytes:12_000_000,
  // The shell plus any one chapter with its 2D art: a device's first visit there.
  chapterGroupGzipBytes:14_000_000,
  // Raised from 24 MB with the asset foundation (0.39).
  completeGzipBytes:50_000_000,
  decodedEntries:40,
  decodedBytes:64*1024*1024
});
