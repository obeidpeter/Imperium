// The people of a real-time encounter as data: enemy archetypes by faction
// and role, scaled by the chapter's tier, the drill partner and the protected
// columns. A 0.38 unit's role chooses its archetype (build brief §3.4: in
// Chapters I–III each 0.38 unit becomes one individual actor). Numbers are
// tuning, chosen so the 0.38 balance of each encounter survives the change
// of controls; the phase reports record them.

const freeze=value=>Object.freeze(value);

// 0.38's factions by chapter (battle.js enemyUnit).
export const factionFor=chapter=>chapter===5||chapter===6?'persian':chapter===9?'palmyrene':chapter>=11?'rival':'gothic';
export const FACTION_NAMES=freeze({gothic:'Gothic',persian:'Persian',palmyrene:'Palmyrene',rival:'Rival Roman'});

// The chapter's tier adds to every enemy's Combat and Constitution.
// Chapter I's raiders are poor farmers' sons against a recruit; the tiers rise
// with the campaign. Each field adds to the archetype's attribute.
export const TIERS=freeze([
  freeze({chapters:freeze([1]),mods:freeze({combat:-5,con:-3,agi:-2,per:-3,str:-2})}),
  freeze({chapters:freeze([2]),mods:freeze({combat:-3,con:-2,agi:-1,per:-2,str:-1})}),
  freeze({chapters:freeze([3]),mods:freeze({combat:-2,con:-1,per:-1})}),
  freeze({chapters:freeze([4,5,6]),mods:freeze({})}),freeze({chapters:freeze([7,8,9]),mods:freeze({combat:2,con:1})}),
  freeze({chapters:freeze([10,11,12]),mods:freeze({combat:3,con:2})})]);
export const tierFor=chapter=>TIERS.find(t=>t.chapters.includes(chapter))??TIERS[3];

const a=(str,agi,con,per,combat,field)=>freeze({str,agi,con,per,combat,field});
// Archetypes: attributes before the tier, worn kit, ammunition and behaviour.
export const ARCHETYPES=freeze({
  gothic:freeze({
    raider:freeze([
      freeze({name:'raider',attributes:a(13,12,10,10,8,8),kit:freeze(['tunic','jerkin','axe'])}),
      freeze({name:'spearman',attributes:a(12,12,12,10,7,8),kit:freeze(['tunic','jerkin','round_shield','spear'])}),
      freeze({name:'skirmisher',attributes:a(11,14,10,12,7,9),kit:freeze(['tunic','spatha']),ammo:freeze({javelin:2}),skirmisher:true})]),
    infantry:freeze([freeze({name:'warrior',attributes:a(13,11,12,10,8,6),kit:freeze(['tunic','jerkin','segmented_helmet','round_shield','spear'])})]),
    archer:freeze([freeze({name:'archer',attributes:a(11,14,10,13,7,9),kit:freeze(['tunic','bow','quiver']),ammo:freeze({arrow:12})})]),
    guard:freeze([freeze({name:'shield guard',attributes:a(13,11,13,10,9,6),kit:freeze(['tunic','jerkin','segmented_helmet','round_shield','spear']),guard:true})]),
    cavalry:freeze([freeze({name:'horseman',attributes:a(13,13,12,11,9,6),kit:freeze(['tunic','jerkin','round_shield','spear']),mounted:true})])}),
  persian:freeze({
    raider:freeze([freeze({name:'skirmisher',attributes:a(11,14,10,12,8,9),kit:freeze(['linen_tunic','spatha']),ammo:freeze({javelin:2}),skirmisher:true})]),
    infantry:freeze([freeze({name:'spearman',attributes:a(12,12,12,10,8,6),kit:freeze(['linen_tunic','jerkin','conical_helmet','parma','spear'])})]),
    archer:freeze([freeze({name:'archer',attributes:a(11,15,10,14,8,8),kit:freeze(['linen_tunic','bow','quiver']),ammo:freeze({arrow:16})})]),
    guard:freeze([freeze({name:'guard',attributes:a(13,12,13,10,10,6),kit:freeze(['linen_tunic','scale_eastern','conical_helmet','parma','spear']),guard:true})]),
    cavalry:freeze([freeze({name:'clibanarius',attributes:a(14,12,13,10,10,5),kit:freeze(['linen_tunic','scale_eastern','conical_helmet','spear']),
      mounted:true,heavy:true})])}),
  palmyrene:freeze({
    raider:freeze([freeze({name:'skirmisher',attributes:a(11,14,10,12,9,9),kit:freeze(['linen_tunic','spatha']),ammo:freeze({javelin:2}),skirmisher:true})]),
    infantry:freeze([freeze({name:'spearman',attributes:a(12,12,12,10,9,6),kit:freeze(['linen_tunic','jerkin','conical_helmet','parma','spear'])})]),
    archer:freeze([freeze({name:'archer',attributes:a(11,15,10,14,9,8),kit:freeze(['linen_tunic','bow','quiver']),ammo:freeze({arrow:16})})]),
    guard:freeze([freeze({name:'guard',attributes:a(13,12,13,10,10,6),kit:freeze(['linen_tunic','scale_eastern','conical_helmet','parma','spear']),guard:true})]),
    cavalry:freeze([freeze({name:'cataphract',attributes:a(14,12,14,10,11,5),kit:freeze(['linen_tunic','scale_eastern','conical_helmet','spear']),
      mounted:true,heavy:true})])}),
  rival:freeze({
    raider:freeze([freeze({name:'skirmisher',attributes:a(12,13,11,11,9,8),kit:freeze(['tunic','subarmalis','parma','spatha']),ammo:freeze({dart:5}),skirmisher:true})]),
    infantry:freeze([freeze({name:'legionary',attributes:a(13,12,13,9,10,6),kit:freeze(['tunic','subarmalis','hamata','galea','scutum','spatha']),ammo:freeze({pilum:1})})]),
    archer:freeze([freeze({name:'archer',attributes:a(11,14,10,13,8,8),kit:freeze(['tunic','subarmalis','galea','bow','quiver']),ammo:freeze({arrow:14})})]),
    guard:freeze([freeze({name:'guardsman',attributes:a(14,12,14,10,11,6),kit:freeze(['tunic','subarmalis','squamata','galea_crest','scutum','spatha']),guard:true})]),
    cavalry:freeze([freeze({name:'horseman',attributes:a(13,13,12,11,10,6),kit:freeze(['tunic','hamata','galea','parma','hasta']),mounted:true})])})});

// The drill partner: practice blows that never fell anyone (Chapter I).
export const TRAINER=freeze({name:'Training partner',attributes:a(12,11,14,10,4,5),kit:freeze(['tunic','training_shield','knife']),practice:true});
// Protected columns walk; a wounded man starts down until helped.
export const ESCORTS=freeze({attributes:a(10,9,12,9,2,4),kit:freeze(['tunic','paenula'])});
// The 0.38 ally in Chapters I–II (Lucan or Sabinus) fights on his own.
export const LEGACY_ALLY_KIT=freeze(['tunic','subarmalis','hamata','galea','bracae','caligae','cingulum','scutum','spatha']);
