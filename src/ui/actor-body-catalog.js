// Generated bodies (docs/asset-pipeline.md): Tripo characters bound in Blender
// to the game's skeleton by scripts/assets/bind-character.py. Pure data in the
// startup shell, so the download groups (art.js) can name each chapter's bodies
// without loading the 3D modules; src/showcase/actor-bodies.js loads them.
//
// A body replaces the procedural clothes, armour, head and limbs of the figures
// whose kit (actor-kit.js) it fits; the rig, clips, hands, weapons, shields,
// crests, cloaks and standards stay the game's own. Civic figures keep their
// procedural togas, whose trims name their bloc, and a figure without a fitting
// body, or whose body fails to load, keeps its procedural look.
// A bare-headed body keeps the figure's own helmet or cap, moved and scaled
// from the procedural head (head-joint metres) to cover its head and hair.
const fit=({position,scale})=>Object.freeze({position:Object.freeze(position),scale:Object.freeze(scale)});
// The chapters each named man appears in, in 3D (tests/actor-bodies.test.mjs checks them).
const CAST_CHAPTERS=Object.freeze({lucan:[1,2,3,4,5,6,7,8,9,10,11,12],varro:[1,2,3,5,6]});
const body=(fits,chapters,{headwear=null,cast=null}={})=>Object.freeze({fits:Object.freeze(fits.map(Object.freeze)),chapters:Object.freeze(chapters),headwear:headwear&&fit(headwear),cast});
// The recruit's head is the one every named man's face is made from, so a named man's
// own body wears the game's helmet or cap as the recruit does.
const SHARED_HEAD={position:[-.018,.04,.048],scale:[.85,.9,1.04]};
export const ACTOR_BODIES=Object.freeze({
  'roman-recruit':body([{faction:'Roman',role:'recruit'}],[1,2,3,4,5,6,7,8,9,10,11,12],{headwear:SHARED_HEAD}),
  'roman-trainer':body([{faction:'Roman',role:'trainer'}],[1]),
  'roman-legionary':body([{faction:'Roman',role:'veteran'}],[1,2,3,4,5,6,7,8,9,10,12]),
  'roman-archer':body([{faction:'Roman',role:'archer'}],[3,4,5,6,7,8,9,10,12]),
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
  'civilian-escort':body([{faction:'Civilian',role:'escort'}],[1,2,3,4,5,6,7,8,9,10,11,12]),
  // Named men in their own generated bodies, the shared head wrapped onto each man's own
  // generated head (scripts/assets/wrap-cast-head.py). Chosen by who he is, never by kit.
  'cast-lucan':body([],CAST_CHAPTERS.lucan,{headwear:SHARED_HEAD,cast:'lucan'}),
  'cast-varro':body([],CAST_CHAPTERS.varro,{headwear:SHARED_HEAD,cast:'varro'})
});
/** A named man's own body by his identity key (actor-identity.js). */
export const CAST_BODIES=Object.freeze(Object.fromEntries(Object.entries(ACTOR_BODIES).filter(([,b])=>b.cast).map(([id,b])=>[b.cast,id])));
export const actorBodyUrl=id=>`assets/models/characters/${id}.glb`;

/** The generated body for a kit (actor-kit.js) and the person drawn (his identity key),
 * or null to keep the procedural figure. A named man with a body of his own wears it in
 * every kit but the civic, whose togas name their bloc. */
export function actorBodyId(kit={},cast=null){
  if(kit.civic)return null;
  if(cast&&Object.hasOwn(CAST_BODIES,cast))return CAST_BODIES[cast];
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
