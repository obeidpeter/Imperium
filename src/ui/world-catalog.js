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
import {GROUND_FILES} from './ground-layers.js';
import {PANORAMA_REGIONS,panoramaChapters,panoramaFile} from './panoramas.js';

export const WORLD_KINDS=Object.freeze(['prop','landmark','kit','texture','panorama']);
const asset=(kind,files,chapters)=>Object.freeze({kind,files:Object.freeze(files),chapters:Object.freeze(chapters)});
const prop=(id,chapter)=>asset('prop',[`assets/models/chapters/${String(chapter).padStart(2,'0')}/${id}.glb`],[chapter]);
export const REGIONAL_PROP_CHAPTERS=Object.freeze(Object.fromEntries(Object.entries({
  'legionary-cookstation':[1,3,7],'equipment-rack':[1,4,7],'courier-table':[3,7,11],
  'casualty-litter':[2,6,8],'broken-baggage-cart':[2,6],'river-ferry':[8],
  'mooring-ropes':[2,8],'eagle-rally-stand':[6,12],'caravan-trough':[9],
  'caravan-baggage':[9],'signal-brazier':[4,6],'command-table':[7,12],
  'grain-bins':[10],'relief-cart':[10],'archive-cabinet':[11],'civic-fountain':[11,12]
}).map(([id,chapters])=>[id,Object.freeze(chapters)])));
export const REGIONAL_REUSED_PROP_CHAPTERS=Object.freeze({
  'ch5-leather-tent':Object.freeze([5,6]),'ch5-storage-jars':Object.freeze([5,6,9,10]),
  'ch5-household-bundles':Object.freeze([2,5,8]),'ch5-cistern':Object.freeze([5,6]),
  'ch5-spoil-baskets':Object.freeze([4,5,9]),'ch5-mudbrick-stack':Object.freeze([5,9])
});
const reused=id=>asset('prop',[`assets/models/chapters/05/${id}.glb`],REGIONAL_REUSED_PROP_CHAPTERS[id]);
export const WORLD_CATALOG=Object.freeze({
  // Chapter V's supply camp: Tripo models processed in Blender.
  'ch5-leather-tent':reused('ch5-leather-tent'),
  'ch5-spoil-baskets':reused('ch5-spoil-baskets'),
  'ch5-storage-jars':reused('ch5-storage-jars'),
  'ch5-gallery-timbers':prop('ch5-gallery-timbers',5),
  'ch5-mudbrick-stack':reused('ch5-mudbrick-stack'),
  'ch5-cistern':reused('ch5-cistern'),
  'ch5-siege-hoist':prop('ch5-siege-hoist',5),
  'ch5-damaged-masonry':prop('ch5-damaged-masonry',5),
  'ch5-household-bundles':reused('ch5-household-bundles'),
  'ch5-fortress-kit':asset('kit',['assets/models/scenery/ch5-fortress-kit.glb'],[5,9]),
  'danube-military-kit':asset('kit',['assets/models/scenery/danube-military-kit.glb'],[1,3,4]),
  'river-wetlands-kit':asset('kit',['assets/models/scenery/river-wetlands-kit.glb'],[2,8]),
  'italian-marching-kit':asset('kit',['assets/models/scenery/italian-marching-kit.glb'],[6,7]),
  'provincial-civic-kit':asset('kit',['assets/models/scenery/provincial-civic-kit.glb'],[10]),
  'roman-monumental-kit':asset('kit',['assets/models/scenery/roman-monumental-kit.glb'],[9,11,12]),
  // The field's own structures, fitted to its cells (worlds and gameplay plan, release 4):
  // one kit for each curtain material of the chapters whose battles are fortified.
  'board-kit-timber':asset('kit',['assets/models/scenery/board-kit-timber.glb'],[4]),
  'board-kit-mudbrick':asset('kit',['assets/models/scenery/board-kit-mudbrick.glb'],[5,6,9]),
  'board-kit-stone':asset('kit',['assets/models/scenery/board-kit-stone.glb'],[8,12]),
  ...Object.fromEntries(Object.entries(REGIONAL_PROP_CHAPTERS).map(([id,chapters])=>[id,asset('prop',[`assets/models/world/${id}.glb`],chapters)])),
  // The ground's photographed layers (ground-layers.js), shared by every chapter.
  'ground-layers':asset('texture',Object.values(GROUND_FILES),[1,2,3,4,5,6,7,8,9,10,11,12]),
  // Each region's far skyline (panoramas.js), in the packs of its chapters.
  ...Object.fromEntries(PANORAMA_REGIONS.map(key=>[`panorama-${key}`,asset('panorama',[panoramaFile(key)],panoramaChapters(key))]))
});
/** The model of a placed world asset, or null. */
export const worldModelUrl=id=>WORLD_CATALOG[id]?.files.find(file=>file.endsWith('.glb'))??null;
/** A chapter's world files, for its offline pack. */
export const chapterWorldFiles=chapter=>Object.values(WORLD_CATALOG).filter(entry=>entry.chapters.includes(chapter)).flatMap(entry=>entry.files);
/** Every world file, whichever chapters use it. */
export const worldFiles=()=>Object.values(WORLD_CATALOG).flatMap(entry=>entry.files);
