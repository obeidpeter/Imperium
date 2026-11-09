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
import {CAMP_TENT_PITCHES} from '../data/camp-regions.js';
import {CONFIG} from '../config.js';

export const WORLD_KINDS=Object.freeze(['prop','landmark','kit','texture','panorama']);
// `web` names the chapters whose web download carries the asset, where its download limit leaves room
// (presentation-budget.js): the desktop app installs every file (the owner's decision of 8 November), so there an
// asset is in every chapter it names. Where the web leaves it out, its scenery keeps the code-built stand-in.
const asset=(kind,files,chapters,web=chapters)=>Object.freeze({kind,files:Object.freeze(files),chapters:Object.freeze(chapters),web:Object.freeze(web)});
/** Whether this page is the desktop app's (scripts/build.mjs --target desktop writes it into the configuration). */
export const desktopApp=()=>CONFIG.platform==='desktop';
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
// The camps whose tent lines pitch Chapter V's leather tent (graphics plan, G3; camp-regions.js).
export const TENT_LINE_CHAPTERS=Object.freeze(Object.entries(CAMP_TENT_PITCHES).filter(([,list])=>list.length).map(([chapter])=>Number(chapter)));
const reused=id=>asset('prop',[`assets/models/chapters/05/${id}.glb`],
  id==='ch5-leather-tent'?[...new Set([...REGIONAL_REUSED_PROP_CHAPTERS[id],...TENT_LINE_CHAPTERS])].sort((a,b)=>a-b):REGIONAL_REUSED_PROP_CHAPTERS[id]);
// Life about the camps and towns (release 9): Tripo props set out beyond the board like the
// regional ones (environment-regional-world.js), but never on a camp's service pad.
export const LIFE_PROP_CHAPTERS=Object.freeze(Object.fromEntries(Object.entries({
  'life-laundry-line':[1,3,8,10],'life-camel-gear':[6,9],'life-amphora-rack':[7,11,12],
  'life-beehives':[3,7],'life-bread-oven':[1,3,6,9],'life-handcart':[3,4],'life-grindstone':[1,4],
  'life-hay-rick':[2,8,10],'life-ox-cart':[8,10],'life-woodpile':[1,2,4],'life-loom':[8,10],
  'life-travel-carriage':[7,11,12],'life-market-stall':[9,10,11,12],
  'life-pottery-stall':[6,9,11,12]
}).map(([id,chapters])=>[id,Object.freeze(chapters)])));
// The camps' own furniture (graphics plan, G3's pilot): Tripo props set out in a camp's courts beyond
// the board, each beside the service it belongs to (camp-composition.js). Only in a camp, and like
// life with no code-built stand-in: without its model the place stays empty.
export const CAMP_PROP_CHAPTERS=Object.freeze(Object.fromEntries(Object.entries({
  'g3-officers-tent':[1,3,4,6,7,8,9,12],'g3-tent-struck':[2,6,8],'g3-horse-lines':[7,9,12],
  'g3-training-post':[1,3,4,7],'g3-supply-stack':[1,2,3,4,6,7,8,9,10,12],'g3-granary':[4,10]
}).map(([id,chapters])=>[id,Object.freeze(chapters)])));
// The timber camps' palisade and towers (G3's pilot), on their wall cells (camp-walls.js). The palisade
// stands for the code-built breastwork, which stays as its fallback.
export const CAMP_WALL_CHAPTERS=Object.freeze({
  'g3-palisade-timber':Object.freeze([1,2,3,7,8,10]),'g3-watchtower-timber':Object.freeze([1,2,3,7,8,10])
});
// What a chapter's web download has room for of G3's models (presentation-budget.js): Chapter I's 3D
// download stood at 17.69 of its 18 MB and the largest chapter's (XII, with the 2D view) at 27.71 of
// 28 MB, so Chapter I takes the palisade alone and Chapter XII none. The desktop app has them all.
const G3_WEB_ROOM=Object.freeze({1:Object.freeze(['g3-palisade-timber']),12:Object.freeze([])});
const g3=(id,chapters)=>asset('prop',[`assets/models/world/${id}.glb`],chapters,chapters.filter(c=>!G3_WEB_ROOM[c]||G3_WEB_ROOM[c].includes(id)));
// The generated landmarks on the chapters' horizons (release 9), with the chapters whose
// LANDMARK_LAYOUT (world-layouts.js) names each. The Colosseum keeps its code-built outline.
export const LANDMARK_CHAPTERS=Object.freeze(Object.fromEntries(Object.entries({
  'landmark-novae-gate':[1],'landmark-signal-tower':[1,4],'landmark-burial-mound':[1,4],
  'landmark-pile-hut':[2],'landmark-bridge-piers':[2],'landmark-river-quay':[2],
  'landmark-road-station':[3,4],'landmark-small-temple':[3],'landmark-burned-farmstead':[3],
  'landmark-river-citadel':[5],'landmark-ruined-watchtower':[5],
  'landmark-necropolis-tower-tomb':[5],'landmark-caravan-station':[6],
  'landmark-syrian-temple-court':[6],'landmark-rock-cut-tombs':[6],'landmark-adda-bridge':[7],
  'landmark-mediolanum-walls':[7],'landmark-roadside-tomb':[7],'landmark-fort-gate':[8],
  'landmark-river-warehouses':[8],'landmark-dacian-sanctuary':[8],'landmark-tetrapylon':[9],
  'landmark-walled-sanctuary':[9],'landmark-city-gate':[9],'landmark-villa':[10],
  'landmark-provincial-basilica':[10],'landmark-aqueduct':[10],'landmark-pantheon':[11],
  'landmark-arch-of-severus':[11],'landmark-mausoleum-of-hadrian':[12],
  'landmark-temple-of-sol':[12],'landmark-milvian-bridge':[12]
}).map(([id,chapters])=>[id,Object.freeze(chapters)])));
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
  // The Senate's Curia in marble, around the chamber board of Chapters XI and XII (release 9).
  'roman-curia-kit':asset('kit',['assets/models/scenery/roman-curia-kit.glb'],[11,12]),
  // Aurelian's walls and gate before the finale's field (release 9).
  'aurelian-walls-kit':asset('kit',['assets/models/scenery/aurelian-walls-kit.glb'],[12]),
  // The field's own structures, fitted to its cells (worlds and gameplay plan, release 4):
  // one kit for each curtain material of the chapters whose battles are fortified.
  'board-kit-timber':asset('kit',['assets/models/scenery/board-kit-timber.glb'],[4]),
  'board-kit-mudbrick':asset('kit',['assets/models/scenery/board-kit-mudbrick.glb'],[5,6,9]),
  'board-kit-stone':asset('kit',['assets/models/scenery/board-kit-stone.glb'],[8,12]),
  // The regions' trees, with near, mid and impostor levels (release 5): one kit for each
  // group of chapters that plants the same species (tree-kit.js).
  'trees-temperate':asset('kit',['assets/models/scenery/trees-temperate.glb'],[1,2,3,4,8,10]),
  'trees-italy':asset('kit',['assets/models/scenery/trees-italy.glb'],[7,11,12]),
  'trees-arid':asset('kit',['assets/models/scenery/trees-arid.glb'],[5,6,9]),
  // Their stones: four Tripo rocks for each of the same groups (rock-kit.js).
  'rocks-temperate':asset('kit',['assets/models/scenery/rocks-temperate.glb'],[1,2,3,4,8,10]),
  'rocks-italy':asset('kit',['assets/models/scenery/rocks-italy.glb'],[7,11,12]),
  'rocks-arid':asset('kit',['assets/models/scenery/rocks-arid.glb'],[5,6,9]),
  ...Object.fromEntries(Object.entries(REGIONAL_PROP_CHAPTERS).map(([id,chapters])=>[id,asset('prop',[`assets/models/world/${id}.glb`],chapters)])),
  ...Object.fromEntries(Object.entries(LIFE_PROP_CHAPTERS).map(([id,chapters])=>[id,asset('prop',[`assets/models/world/${id}.glb`],chapters)])),
  ...Object.fromEntries(Object.entries({...CAMP_PROP_CHAPTERS,...CAMP_WALL_CHAPTERS}).map(([id,chapters])=>[id,g3(id,chapters)])),
  ...Object.fromEntries(Object.entries(LANDMARK_CHAPTERS).map(([id,chapters])=>[id,asset('landmark',[`assets/models/landmarks/${id}.glb`],chapters)])),
  // The ground's photographed layers (ground-layers.js), shared by every chapter.
  'ground-layers':asset('texture',Object.values(GROUND_FILES),[1,2,3,4,5,6,7,8,9,10,11,12]),
  // Each region's far skyline (panoramas.js), in the packs of its chapters.
  ...Object.fromEntries(PANORAMA_REGIONS.map(key=>[`panorama-${key}`,asset('panorama',[panoramaFile(key)],panoramaChapters(key))]))
});
/** The model of a placed world asset, or null. */
export const worldModelUrl=id=>WORLD_CATALOG[id]?.files.find(file=>file.endsWith('.glb'))??null;
/** The chapters an asset is in, on the web or in the desktop app. */
export const worldAssetChapters=(entry,{desktop=desktopApp()}={})=>desktop?entry.chapters:entry.web;
/** Whether a chapter shows an asset it names: on the web, only where its download carries it. An id the catalog
 * does not know is the caller's own business, and shows. */
export const worldAssetShown=(id,chapter,{desktop=desktopApp()}={})=>{const entry=WORLD_CATALOG[id];return !entry||!entry.chapters.includes(chapter)||worldAssetChapters(entry,{desktop}).includes(chapter);};
/** A chapter's world files, for its offline pack. */
export const chapterWorldFiles=(chapter,{desktop=desktopApp()}={})=>Object.values(WORLD_CATALOG).filter(entry=>worldAssetChapters(entry,{desktop}).includes(chapter)).flatMap(entry=>entry.files);
/** Every world file, whichever chapters use it. */
export const worldFiles=()=>Object.values(WORLD_CATALOG).flatMap(entry=>entry.files);
/** The files the web build leaves out, as no chapter's web download carries them (scripts/build.mjs). */
export const desktopOnlyWorldFiles=()=>Object.values(WORLD_CATALOG).filter(entry=>!entry.web.length).flatMap(entry=>entry.files);
