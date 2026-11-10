// Generated kit (the graphics plan, step 0, and release G2): weapons and helmets made from the
// inventory's item models, and the standards made for the figures that carry them
// (scripts/assets/process-kit.py), worn in place of the code-built pieces (actorKitModelIds,
// actors.js); actor-kit-models.js loads them. Pure data, like the body catalog: a chapter's
// download group (art.js) and the build read it without loading the 3D modules. Shields stay
// code-built: they carry each unit's own design (shield-patterns.js).
import {CONFIG} from '../config.js';

const ALL=Object.freeze([1,2,3,4,5,6,7,8,9,10,11,12]);
// A piece rides in the web download of the chapters it names (web, all of its chapters unless named), where there is
// room for it; the desktop app carries it in every chapter it names. Elsewhere its figures keep the code-built piece.
const model=(source,kind,{chapters=ALL,web=chapters}={})=>Object.freeze({source,kind,chapters:Object.freeze([...chapters]),web:Object.freeze(web.filter(c=>chapters.includes(c)))});
export const KIT_MODELS=Object.freeze({
  'kit-spatha':model('item-spatha','sword'),
  'kit-gladius':model('item-gladius-b','sword'),
  'kit-pugio':model('item-pugio','sword'),
  'kit-axe':model('item-axe','axe'),
  'kit-galea':model('item-galea','helmet'),
  'kit-niederbieber':model('item-niederbieber','helmet'),
  'kit-arming-cap':model('item-arming-cap','helmet'),
  // The standards (G2): a century's signum, carried by Signifer Quintus in his camps and by a veteran trained to lead
  // in the battles from Chapter IV, and a legion's eagle, carried by the eagle-bearer in Chapter VI. Made after the web
  // downloads filled, they ride in the desktop app alone; on the web the code-built standards stay.
  'kit-signum':model('g2-signum','standard',{chapters:[1,4,5,6,7,8,9,10,12],web:[]}),
  'kit-aquila':model('g2-aquila-b','standard',{chapters:[6],web:[]})
});
// The model each weapon the inventory's items show takes (their visuals, src/data/items.js); spears,
// bows and slings stay code-built.
export const KIT_WEAPON_MODELS=Object.freeze({spatha:'kit-spatha',gladius:'kit-gladius',knife:'kit-pugio',axe:'kit-axe'});
// The model each helmet takes, and the felt cap worn without one. The Gothic cap helmet stays
// code-built, and so does the conical one: the inventory's spangenhelm closes its nasal and cheek
// guards over the face, which the figures' faces are drawn to show.
export const KIT_HEADWEAR_MODELS=Object.freeze({ridge:'kit-galea',niederbieber:'kit-niederbieber',cap:'kit-arming-cap'});
// The model each standard a figure carries takes (the kit's signum, actor-kit.js).
export const KIT_STANDARD_MODELS=Object.freeze({signum:'kit-signum',aquila:'kit-aquila'});
export const kitModelUrl=id=>`assets/models/kit/${id}.glb`;
const desktopApp=()=>CONFIG.platform==='desktop';
/** Whether a figure of a chapter may wear a piece: only where the chapter's download carries it, on the web and in
 * the desktop app. A figure of a chapter the piece does not name, or of none (a preview), may wear a piece its
 * platform carries in some chapter, as a body (bodyShown). `desktop` overrides the build's platform (tests). */
export const kitShown=(id,chapter,{desktop=desktopApp()}={})=>{const m=KIT_MODELS[id];if(!m)return false;const carried=desktop?m.chapters:m.web;
  return m.chapters.includes(chapter)?carried.includes(chapter):carried.length>0;};
/** A chapter's kit files, for its download group: on the web those its download carries. */
export const chapterKitFiles=(chapter,{desktop=desktopApp()}={})=>Object.keys(KIT_MODELS).filter(id=>(desktop?KIT_MODELS[id].chapters:KIT_MODELS[id].web).includes(chapter)).map(kitModelUrl);
/** The kit files no chapter's web download carries, which the web build leaves out (scripts/build.mjs). */
export const desktopOnlyKitFiles=()=>Object.keys(KIT_MODELS).filter(id=>!KIT_MODELS[id].web.length).map(kitModelUrl);
