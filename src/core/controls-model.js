// Which controls an encounter uses during the 0.40 conversion (build brief
// §2.2): the 0.38 turns or real time. The setting is the player's (development)
// choice; realtimeChapters is the per-chapter fallback the kill criteria use,
// so a chapter can stay on turns while others play in real time. A chapter
// plays in real time only once its real-time content exists. Pure.

export const CONTROLS_MODELS=Object.freeze(['turns','realtime']);
export const ALL_CHAPTERS=Object.freeze(Array.from({length:12},(_,i)=>i+1));
// Chapters whose real-time encounters exist: Phase 1 converted Chapters I–III
// (with their walkable camps), Phase 2 the battles of IV–IX and Phase 4 the rest
// (Chapter X's road and the finale's confrontation; Chapter XI has no battle).
export const REALTIME_READY_CHAPTERS=ALL_CHAPTERS;

// Chambers whose walk-and-talk Curia exists: the Contests of VII, VIII, X and XI
// (Phase 3) and XII's (Phase 4). A chapter taken out of realtimeChapters keeps
// the 0.38 Contest board (kill criterion K3).
export const CHAMBER_READY_CHAPTERS=Object.freeze([7,8,10,11,12]);

export function normalizeControls({controlsModel,realtimeChapters}={}){
  const chapters=Array.isArray(realtimeChapters)?[...new Set(realtimeChapters.map(Number).filter(c=>ALL_CHAPTERS.includes(c)))].sort((a,b)=>a-b):[...ALL_CHAPTERS];
  return {controlsModel:CONTROLS_MODELS.includes(controlsModel)?controlsModel:'turns',realtimeChapters:chapters};
}
// The controls a chapter's encounters use under these settings.
export function controlsFor(settings,chapter,ready=REALTIME_READY_CHAPTERS){
  const {controlsModel,realtimeChapters}=normalizeControls(settings);
  return controlsModel==='realtime'&&realtimeChapters.includes(chapter)&&ready.includes(chapter)?'realtime':'turns';
}
// Whether a chapter's Contests are walked as a chamber under these settings.
export const chamberFor=(settings,chapter)=>controlsFor(settings,chapter,CHAMBER_READY_CHAPTERS)==='realtime';
// The standalone skirmish already has its real-time form (the arena).
export const skirmishControls=settings=>normalizeControls(settings).controlsModel;
