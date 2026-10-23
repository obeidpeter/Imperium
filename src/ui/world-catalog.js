// The world's generated and photographed assets (docs/asset-pipeline.md), and
// the chapters that use each. Pure data in the startup shell, like the body
// catalog (actor-body-catalog.js): the download groups (art.js), the build and
// npm run verify read a chapter's world files from it without loading the 3D
// modules. A file belongs to the offline packs of its chapters alone. Where an
// asset stands stays with the code that places it (scenery-models.js).
//
// Kinds: a prop or landmark is a placed model; a kit piece dresses a board
// structure; a texture set is the maps of one surface; a panorama is a skyline.
// Files live under assets/models/ or assets/textures/ (assets/world/ holds the
// 2D board's atlases).
export const WORLD_KINDS=Object.freeze(['prop','landmark','kit','texture','panorama']);
const asset=(kind,files,chapters)=>Object.freeze({kind,files:Object.freeze(files),chapters:Object.freeze(chapters)});
const prop=(id,chapter)=>asset('prop',[`assets/models/chapters/${String(chapter).padStart(2,'0')}/${id}.glb`],[chapter]);
export const WORLD_CATALOG=Object.freeze({
  // Chapter V's supply camp: Tripo models processed in Blender.
  'ch5-leather-tent':prop('ch5-leather-tent',5),
  'ch5-spoil-baskets':prop('ch5-spoil-baskets',5),
  'ch5-storage-jars':prop('ch5-storage-jars',5),
  'ch5-gallery-timbers':prop('ch5-gallery-timbers',5),
  'ch5-mudbrick-stack':prop('ch5-mudbrick-stack',5)
});
/** The model of a placed world asset, or null. */
export const worldModelUrl=id=>WORLD_CATALOG[id]?.files.find(file=>file.endsWith('.glb'))??null;
/** A chapter's world files, for its offline pack. */
export const chapterWorldFiles=chapter=>Object.values(WORLD_CATALOG).filter(entry=>entry.chapters.includes(chapter)).flatMap(entry=>entry.files);
/** Every world file, whichever chapters use it. */
export const worldFiles=()=>Object.values(WORLD_CATALOG).flatMap(entry=>entry.files);
