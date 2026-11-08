// Generated kit (the graphics plan, step 0): weapons and helmets made from the inventory's item
// models (scripts/assets/process-kit.py), worn in place of the code-built pieces by the figures
// dressed in those items (actorKitModelIds, actors.js). Every chapter's 3D pack holds the files
// (art.js counts assets/models/ as shared); actor-kit-models.js loads them. Shields stay
// code-built: they carry each unit's own design (shield-patterns.js).
const model=(source,kind)=>Object.freeze({source,kind});
export const KIT_MODELS=Object.freeze({
  'kit-spatha':model('item-spatha','sword'),
  'kit-gladius':model('item-gladius-b','sword'),
  'kit-pugio':model('item-pugio','sword'),
  'kit-axe':model('item-axe','axe'),
  'kit-galea':model('item-galea','helmet'),
  'kit-niederbieber':model('item-niederbieber','helmet'),
  'kit-arming-cap':model('item-arming-cap','helmet')
});
// The model each weapon the inventory's items show takes (their visuals, src/data/items.js); spears,
// bows and slings stay code-built.
export const KIT_WEAPON_MODELS=Object.freeze({spatha:'kit-spatha',gladius:'kit-gladius',knife:'kit-pugio',axe:'kit-axe'});
// The model each helmet takes, and the felt cap worn without one. The Gothic cap helmet stays
// code-built, and so does the conical one: the inventory's spangenhelm closes its nasal and cheek
// guards over the face, which the figures' faces are drawn to show.
export const KIT_HEADWEAR_MODELS=Object.freeze({ridge:'kit-galea',niederbieber:'kit-niederbieber',cap:'kit-arming-cap'});
export const kitModelUrl=id=>`assets/models/kit/${id}.glb`;
