// Champions and officers (release 11, docs/worlds-and-gameplay-plan.md): one
// authored single man in each of the squad battles of Chapters IV–XII who
// seeks the soldier out. He fights by the full blow rules (combat.js), so the
// soldier's armour, shield and weapon count against him as they do in
// Chapters I–III, and he carries fine or named kit, or a key, to be taken from
// him. He is the same on every level (campaign-options.js: no enemy is
// hardier or hits harder on any level). His figure follows his faction.

const freeze=value=>Object.freeze(value);
const a=(str,agi,con,per,combat,field)=>freeze({str,agi,con,per,elo:8,auth:12,combat,field});
const champion=(id,data)=>freeze({id,role:'champion',mounted:false,...data,kit:freeze([...data.kit]),loot:freeze([...data.loot]),attributes:data.attributes});

export const CHAMPIONS=freeze({
  'ch4-gate':champion('champion-gate',{name:'The war band’s chieftain',faction:'gothic',attributes:a(14,12,12,11,9,8),
    kit:['tunic','jerkin','segmented_helmet','round_shield','axe_chieftain'],loot:['axe_chieftain','gothic_torc']}),
  'ch4-wall':champion('champion-wall',{name:'The war band’s war leader',faction:'gothic',attributes:a(14,12,13,11,11,8),
    kit:['tunic','jerkin','conical_helmet','round_shield','spear'],loot:['key_f4','silver_brooch']}),
  'ch5-mine':champion('champion-mine',{name:'A Persian sapper captain',faction:'persian',attributes:a(13,12,13,12,11,9),
    kit:['linen_tunic','jerkin','conical_helmet','parma','spatha'],loot:['eye_amulet','coin_purse']}),
  // The red river gate has none: a champion there drew the squads off the wall they must hold (Veteran sweeps, release 11).
  'ch6-wells':champion('champion-wells',{name:'A Persian captain of the pursuit',faction:'persian',attributes:a(14,13,13,12,12,9),
    kit:['linen_tunic','jerkin','conical_helmet','parma','spatha'],loot:['dates','coin_purse']}),
  'ch6-eagle':champion('champion-eagle',{name:'The raiders’ standard-breaker',faction:'persian',attributes:a(15,12,14,11,12,8),
    kit:['linen_tunic','scale_eastern','conical_helmet','parma','spatha'],loot:['silver_brooch','coin_purse']}),
  'ch7-legion':champion('champion-legion',{name:'A mercenary captain in the usurper’s pay',faction:'gothic',attributes:a(15,13,15,12,14,8),
    kit:['tunic','jerkin','conical_helmet','round_shield','spatha'],loot:['silver_brooch','coin_purse']}),
  'ch8-crossing':champion('champion-crossing',{name:'The war band’s champion',faction:'gothic',attributes:a(16,12,15,11,14,8),
    kit:['tunic','jerkin','segmented_helmet','round_shield','axe'],loot:['gothic_torc','coin_purse']}),
  'ch9-wing':champion('champion-wing',{name:'A Palmyrene armoured officer',faction:'palmyrene',mounted:true,attributes:a(15,13,15,12,14,8),
    kit:['linen_tunic','scale_eastern','conical_helmet','spear'],loot:['incense','coin_purse']}),
  'ch9-city':champion('champion-city',{name:'The city’s defending captain',faction:'palmyrene',attributes:a(15,13,15,12,14,9),
    kit:['linen_tunic','scale_eastern','conical_helmet','parma','spatha'],loot:['key_f9','coin_purse']}),
  'ch10-road':champion('champion-road',{name:'The raiders’ chief',faction:'gothic',attributes:a(15,13,15,12,15,9),
    kit:['tunic','jerkin','segmented_helmet','round_shield','axe'],loot:['silver_brooch','coin_purse']}),
  'ch12-confrontation':champion('champion-guard',{name:'The claimant’s guard captain',faction:'rival',attributes:a(16,13,16,12,15,8),
    kit:['tunic','hamata','galea_crest','scutum','spatha'],loot:['coin_purse','coin_purse']})});
export const championFor=encounterId=>CHAMPIONS[encounterId]??null;
