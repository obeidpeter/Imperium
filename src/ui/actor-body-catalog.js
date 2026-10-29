// Generated bodies (docs/asset-pipeline.md): Tripo characters bound in Blender
// to the game's skeleton by scripts/assets/bind-character.py. Pure data in the
// startup shell, so the download groups (art.js) can name each chapter's bodies
// without loading the 3D modules; src/showcase/actor-bodies.js loads them.
//
// A body replaces the procedural clothes, armour, head and limbs of the figures
// whose kit (actor-kit.js) it fits; the rig, clips, hands, weapons, shields,
// crests, cloaks and standards stay the game's own. The chamber's members wear the
// senators' togas, the trims that name their bloc drawn on each (actors.js); a
// figure without a fitting body, or whose body fails to load, keeps its procedural
// look, and a civic figure its procedural toga and trims.
// A bare-headed body keeps the figure's own helmet or cap, moved and scaled
// from the procedural head (head-joint metres) to cover its head and hair.
const fit=({position,scale})=>Object.freeze({position:Object.freeze(position),scale:Object.freeze(scale)});
// The chapters each named man appears in, in 3D (tests/actor-bodies.test.mjs checks them).
// Since the living camps (release 8) Varro, Crispus and Brennus also stand in later camps.
const CAST_CHAPTERS=Object.freeze({lucan:[1,2,3,4,5,6,7,8,9,10,11,12],varro:[1,2,3,4,5,6],
  // Sabinus takes Lucan's place from Chapter II when Lucan leaves.
  sabinus:[2,3,4,5,6,7,8,9,10,11,12],naso:[2,3,4,5,6,7,8,9,10,12],felix:[3,4,5,6,7,8,9,10,12],brennus:[3,4],crispus:[3,4,7,11]});
// The chapters whose chamber the members of the Senate sit in.
const SENATOR_CHAPTERS=[7,8,10,11,12];
const body=(fits,chapters,{headwear=null,cast=null,senator=false}={})=>Object.freeze({fits:Object.freeze(fits.map(Object.freeze)),chapters:Object.freeze(chapters),headwear:headwear&&fit(headwear),cast,senator});
// The recruit's head is the one every named man's face is made from, so a named man's
// own body wears the game's helmet or cap as the recruit does.
const SHARED_HEAD={position:[-.018,.04,.048],scale:[.85,.9,1.04]};
export const ACTOR_BODIES=Object.freeze({
  'roman-recruit':body([{faction:'Roman',role:'recruit'}],[1,2,3,4,5,6,7,8,9,10,11,12],{headwear:SHARED_HEAD}),
  'roman-trainer':body([{faction:'Roman',role:'trainer'}],[1]),
  'roman-legionary':body([{faction:'Roman',role:'veteran'}],[1,2,3,4,5,6,7,8,9,10,12]),
  'roman-archer':body([{faction:'Roman',role:'archer'}],[4,5,6,7,8,9,10,12]),
  // The protagonist's command shows in his armour: a centurion's mail, then a commander's cuirass.
  'roman-officer':body([{faction:'Roman',role:'officer',command:false}],[4,5,6]),
  'roman-commander':body([{faction:'Roman',role:'officer',command:true}],[7,8,9,10,11,12]),
  'gothic-warrior':body([{faction:'Gothic',role:'raider',armored:false}],[1,2,3,4,7,8,10]),
  'gothic-archer':body([{faction:'Gothic',role:'archer'}],[1,2,3,4,7,8,10]),
  'gothic-noble':body([{faction:'Gothic',role:'raider',armored:true},{faction:'Gothic',role:'cavalry'}],[4,7]),
  'persian-infantry':body([{faction:'Persian',role:'raider'}],[5,6]),
  'persian-archer':body([{faction:'Persian',role:'archer'}],[5,6]),
  'persian-cavalry':body([{faction:'Persian',role:'cavalry'}],[5,6]),
  'palmyrene-infantry':body([{faction:'Palmyrene',role:'raider'}],[9]),
  'palmyrene-archer':body([{faction:'Palmyrene',role:'archer'}],[9]),
  'palmyrene-cavalry':body([{faction:'Palmyrene',role:'cavalry'}],[9]),
  'roman-cavalry':body([{faction:'Roman',role:'cavalry'}],[7,9,12]),
  // The camp's staff by their camp role (actor-kit.js), ahead of the escorts' civilian dress.
  'camp-clerk':body([{faction:'Civilian',role:'escort',staff:'clerk'},{faction:'Civilian',role:'escort',staff:'quartermaster'}],[1,2,3,4,5,6,7,8,9,10,11,12]),
  'camp-capsarius':body([{faction:'Civilian',role:'escort',staff:'capsarius'},{faction:'Civilian',role:'escort',staff:'orderly'}],[1,2,3,4,5,6,7,8,9,10,11,12]),
  // Syra the sutler follows the legion from Novae to the Danube fort, and to the final march.
  'camp-sutler':body([{faction:'Civilian',role:'escort',staff:'trader'}],[1,2,3,4,12]),
  'civilian-escort':body([{faction:'Civilian',role:'escort'}],[1,2,3,4,5,6,7,8,9,10,11,12]),
  // The chamber's members in plain togas, each with the band its bloc's trims are drawn on
  // (bind-character.py --bloc-band). Chosen by the member's identity, never by kit.
  'senator-elder':body([],SENATOR_CHAPTERS,{senator:true}),
  'senator-bearded':body([],SENATOR_CHAPTERS,{senator:true}),
  'senator-younger':body([],SENATOR_CHAPTERS,{senator:true}),
  // Named men in their own generated bodies, the shared head wrapped onto each man's own
  // generated head (scripts/assets/wrap-cast-head.py). Chosen by who he is, never by kit.
  'cast-lucan':body([],CAST_CHAPTERS.lucan,{headwear:SHARED_HEAD,cast:'lucan'}),
  'cast-varro':body([],CAST_CHAPTERS.varro,{headwear:SHARED_HEAD,cast:'varro'}),
  'cast-sabinus':body([],CAST_CHAPTERS.sabinus,{headwear:SHARED_HEAD,cast:'sabinus'}),
  'cast-naso':body([],CAST_CHAPTERS.naso,{headwear:SHARED_HEAD,cast:'naso'}),
  'cast-felix':body([],CAST_CHAPTERS.felix,{headwear:SHARED_HEAD,cast:'felix'}),
  'cast-brennus':body([],CAST_CHAPTERS.brennus,{headwear:SHARED_HEAD,cast:'brennus'}),
  'cast-crispus':body([],CAST_CHAPTERS.crispus,{headwear:SHARED_HEAD,cast:'crispus'})
});
/** A named man's own body by his identity key (actor-identity.js). */
export const CAST_BODIES=Object.freeze(Object.fromEntries(Object.entries(ACTOR_BODIES).filter(([,b])=>b.cast).map(([id,b])=>[b.cast,id])));
export const SENATOR_BODIES=Object.freeze(Object.keys(ACTOR_BODIES).filter(id=>ACTOR_BODIES[id].senator));
export const actorBodyUrl=id=>`assets/models/characters/${id}.glb`;

/** The generated body for a kit (actor-kit.js) and the person drawn (his identity key),
 * or null to keep the procedural figure. A named man with a body of his own wears it in
 * every kit but the civic. A member of the chamber nobody names wears one of the
 * senators' togas, by who he is; the protagonist and the named keep the procedural
 * toga, their own faces above it. */
export function actorBodyId(kit={},cast=null){
  if(kit.civic)return kit.hero||cast&&!String(cast).startsWith('figure-')?null:SENATOR_BODIES[(kit.identity>>>0)%SENATOR_BODIES.length];
  if(cast&&Object.hasOwn(CAST_BODIES,cast))return CAST_BODIES[cast];
  // A named person in camp dress with no body of their own (Severianus, Aelia and the rest of
  // the cast, release 8) keeps the procedural figure and their own face, never a stranger's body.
  if(kit.escort&&cast&&!String(cast).startsWith('figure-'))return null;
  // A soldier drawn in his own kit (the real-time views and the kit panel)
  // wears the body closest to it: the protagonist the recruit's tunic until he
  // wears armour, then the legionary's mail and, as his rank rises, the
  // centurion's and the commander's; a bowman of his company the archer's. The
  // game still draws his shield, weapons and cloak, and his helmet or cap over
  // the recruit's bare head (an armoured body wears its own helmet). The body
  // brings its own tunic. The renderer now retains the generated recruit head
  // across the hero's ranks, with named identity sculpting, stubble and ageing;
  // full haircut/tunic customization still belongs to the procedural fallback.
  if(kit.equipped){
    if(kit.faction!=='Roman')return null;
    if(kit.archer&&!kit.hero)return 'roman-archer';
    if(!kit.armored)return 'roman-recruit';
    return kit.officer?(kit.chapter>=7?'roman-commander':'roman-officer'):'roman-legionary';
  }
  const traits={...kit,armored:!!kit.armored,command:!!kit.officer&&kit.chapter>=7};
  for(const [id,{fits}]of Object.entries(ACTOR_BODIES))if(fits.some(fit=>Object.entries(fit).every(([key,value])=>traits[key]===value)))return id;
  return null;
}
/** The bodies a chapter's figures can wear, for its offline download group. */
export const chapterBodies=chapter=>Object.keys(ACTOR_BODIES).filter(id=>ACTOR_BODIES[id].chapters.includes(chapter));

// Generated horses (scripts/assets/bind-horse.py): Tripo horses skinned to the game's horse
// skeleton on their own legs' rest pose. A mounted figure's horse wears the coat of its
// side's horses, the code-built saddle on its back; a horse without one, or whose coat fails
// to load, keeps its procedural look (tests/horse-bodies.test.mjs checks the chapters).
export const HORSE_BODIES=Object.freeze({
  'horse-roman':Object.freeze({fits:Object.freeze(['Roman']),chapters:Object.freeze([7,9,12])}),
  'horse-northern':Object.freeze({fits:Object.freeze(['Gothic']),chapters:Object.freeze([7])}),
  // The scale-armoured horse of the Persian and Palmyrene heavy cavalry.
  'horse-eastern':Object.freeze({fits:Object.freeze(['Persian','Palmyrene']),chapters:Object.freeze([5,6,9])})
});
export const horseBodyUrl=id=>`assets/models/horses/${id}.glb`;
/** The generated horse a mounted kit (actor-kit.js) rides, or null for the code-built horse. */
export function horseBodyId(kit={}){
  if(!kit.mounted)return null;
  for(const [id,{fits}]of Object.entries(HORSE_BODIES))if(fits.includes(kit.faction))return id;
  return null;
}
/** The horses a chapter's riders can ride, for its offline download group. */
export const chapterHorses=chapter=>Object.keys(HORSE_BODIES).filter(id=>HORSE_BODIES[id].chapters.includes(chapter));
