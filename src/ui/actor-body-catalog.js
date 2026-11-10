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
import {CONFIG} from '../config.js';
const fit=({position,scale})=>Object.freeze({position:Object.freeze(position),scale:Object.freeze(scale)});
// The chapters each named person appears in, in 3D (tests/actor-bodies.test.mjs checks them).
// Since the living camps (release 8) Varro, Crispus and Brennus also stand in later camps.
const CAST_CHAPTERS=Object.freeze({lucan:[1,2,3,4,5,6,7,8,9,10,11,12],varro:[1,2,3,4,5,6],
  // Sabinus takes Lucan's place from Chapter II when Lucan leaves.
  sabinus:[2,3,4,5,6,7,8,9,10,11,12],naso:[2,3,4,5,6,7,8,9,10,12],felix:[3,4,5,6,7,8,9,10,12],brennus:[3,4],crispus:[3,4,7,11],
  // Include conditional appearances: Severianus stands in XII's court when the
  // soldier earns his support, so the chapter's offline pack must carry his body.
  quintus:[1,4,12],aelia:[8,10,12],severianus:[6,7,8,9,10,11,12],paullus:[11,12],theon:[7,10,11]});
// The chapters whose chamber the members of the Senate sit in.
const SENATOR_CHAPTERS=[7,8,10,11,12];
// A woman's body (woman) is worn only by the camp's women (actor-kit.js), and a man's never by them.
// A named man in civilian dress (civilian) wears no soldier's neckcloth over his head's seam (actors.js).
// A body rides in the web download of its chapters that have room for it (web, all of its chapters unless named): a
// body made after the downloads filled (graphics plan, G6) names fewer, and on the web there its figures wear what
// they wore before (bodyShown). The desktop app carries a body in the chapters it names (desktop, all unless named):
// a named man's first body, which his face from his portrait replaces there, names none and rides the web alone.
const body=(fits,chapters,{headwear=null,cast=null,senator=false,woman=false,civilian=false,web=chapters,desktop=chapters}={})=>Object.freeze({fits:Object.freeze(fits.map(Object.freeze)),
  chapters:Object.freeze(chapters),web:Object.freeze(web.filter(c=>chapters.includes(c))),desktop:Object.freeze(desktop.filter(c=>chapters.includes(c))),
  headwear:headwear&&fit(headwear),cast,senator,woman,civilian});
// The recruit's head is the one every named man's face is made from, so a named man's
// own body wears the game's helmet or cap as the recruit does.
const SHARED_HEAD={position:[-.018,.04,.048],scale:[.85,.9,1.04]};
export const ACTOR_BODIES=Object.freeze({
  // A unit type's own body (graphics plan, release G1), ahead of the faction-wide bodies below,
  // since the first body whose fit matches is worn: chosen by what the rules made the unit
  // (its troop), a war band's skirmisher, a claimant's Roman, or a champion by his id.
  // The champions (data/champions.js), each by his id, in the kit the rules give him.
  'champion-gate':body([{champion:'champion-gate'}],[4]),
  'champion-wall':body([{champion:'champion-wall'}],[4]),
  'champion-mine':body([{champion:'champion-mine'}],[5]),
  'champion-wells':body([{champion:'champion-wells'}],[6]),
  'champion-eagle':body([{champion:'champion-eagle'}],[6]),
  'champion-legion':body([{champion:'champion-legion'}],[7]),
  'champion-crossing':body([{champion:'champion-crossing'}],[8]),
  'champion-wing':body([{champion:'champion-wing'}],[9]),
  'champion-city':body([{champion:'champion-city'}],[9]),
  'champion-road':body([{champion:'champion-road'}],[10]),
  'champion-guard':body([{champion:'champion-guard'}],[12]),
  // The war leader the rules name in a band that fights alone (Chapters I–III), whatever his weapon.
  'gothic-warleader':body([{faction:'Gothic',leader:true}],[1,2,3]),
  'gothic-skirmisher':body([{faction:'Gothic',troop:'raider',skirmisher:true}],[1,2]),
  'gothic-warband':body([{faction:'Gothic',troop:'infantry'}],[2,4,7,8]),
  // The shield guard, in the war band's jerkin and helmet but its own woven check.
  'gothic-guard':body([{faction:'Gothic',troop:'guard'}],[4,7]),
  'persian-skirmisher':body([{faction:'Persian',troop:'raider'}],[6]),
  // The spearman in the jerkin his kit lists; the scale coat below is the guard's.
  'persian-spearman':body([{faction:'Persian',troop:'infantry'}],[5]),
  'palmyrene-spearman':body([{faction:'Palmyrene',troop:'infantry'}],[9]),
  // The claimant's cohorts, his reserve among them; not the claimant himself (an officer, in the commander's cuirass).
  'rival-legionary':body([{faction:'Roman',rival:true,troop:'infantry',officer:false}],[12]),
  // The claimant's archers, in his colours, apart from the soldier's own.
  'rival-archer':body([{faction:'Roman',rival:true,troop:'archer'}],[12]),
  // Aurelian's Moorish horse, the Roman cavalry of the Palmyrene war (Zosimus 1.52).
  'roman-moorish-cavalry':body([{faction:'Roman',role:'cavalry',chapter:9}],[9]),
  // Aurelian's Dalmatian horse, the equites Dalmatae, the Roman cavalry of the finale.
  'roman-dalmatian-cavalry':body([{faction:'Roman',role:'cavalry',chapter:12,rival:false}],[12]),
  'roman-recruit':body([{faction:'Roman',role:'recruit'}],[1,2,3,4,5,6,7,8,9,10,11,12],{headwear:SHARED_HEAD}),
  'roman-trainer':body([{faction:'Roman',role:'trainer'}],[1]),
  'roman-legionary':body([{faction:'Roman',role:'veteran'}],[1,2,3,4,5,6,7,8,9,10,12]),
  'roman-archer':body([{faction:'Roman',role:'archer'}],[4,5,6,7,8,9,10,12]),
  // The protagonist's command shows in his armour: a centurion's mail, then a commander's cuirass.
  'roman-officer':body([{faction:'Roman',role:'officer',command:false}],[4,5,6]),
  'roman-commander':body([{faction:'Roman',role:'officer',command:true}],[7,8,9,10,11,12]),
  'gothic-warrior':body([{faction:'Gothic',role:'raider',armored:false}],[1,2,3,4,8,10]),
  'gothic-archer':body([{faction:'Gothic',role:'archer'}],[1,2,3,4,7,8,10]),
  'gothic-noble':body([{faction:'Gothic',role:'raider',armored:true},{faction:'Gothic',role:'cavalry'}],[7,8]),
  'persian-infantry':body([{faction:'Persian',role:'raider'}],[5]),
  'persian-archer':body([{faction:'Persian',role:'archer'}],[5,6]),
  'persian-cavalry':body([{faction:'Persian',role:'cavalry'}],[5,6]),
  'palmyrene-infantry':body([{faction:'Palmyrene',role:'raider'}],[9]),
  'palmyrene-archer':body([{faction:'Palmyrene',role:'archer'}],[9]),
  'palmyrene-cavalry':body([{faction:'Palmyrene',role:'cavalry'}],[9]),
  'roman-cavalry':body([{faction:'Roman',role:'cavalry'}],[7]),
  // The camps' people in bodies of their own (G6's first batch), each ahead of the shared bodies they wore (the first body that fits is worn), in the
  // desktop app: the complete web game has no room for them, and there they wear what they wore before, but Atticus, who stands in Chapter XI alone.
  'camp-sentry':body([{faction:'Civilian',role:'escort',staff:'sentry'}],[1,2,3,4,5,6,7,8,9,10,11,12],{web:[]}),
  'camp-quartermaster':body([{faction:'Civilian',role:'escort',staff:'quartermaster'}],[1,2,3,4,5,6,7,8,9,10,11,12],{web:[]}),
  'camp-instructor':body([{faction:'Civilian',role:'escort',staff:'campidoctor',chapter:[6,7,8,9,10,11,12]}],[6,7,8,9,10,11,12],{web:[]}),
  // The supply orderly; the camps' other orderlies (Mamertus in I, the water steward in V) keep the orderlies' body.
  'camp-porter':body([{faction:'Civilian',role:'escort',staff:'orderly',chapter:[4,6,7,8,9,10,11,12]}],[4,6,7,8,9,10,11,12],{web:[]}),
  'camp-barnaios':body([{faction:'Civilian',role:'escort',staff:'merchant',chapter:5}],[5],{web:[]}),
  'camp-abgar':body([{faction:'Civilian',role:'escort',staff:'merchant',chapter:6}],[6],{web:[]}),
  'camp-malku':body([{faction:'Civilian',role:'escort',staff:'merchant',chapter:9}],[9],{web:[]}),
  'camp-caecilia':body([{faction:'Civilian',role:'escort',staff:'merchant',chapter:10}],[10],{woman:true,web:[]}),
  'camp-licinia':body([{faction:'Civilian',role:'escort',staff:'settler',chapter:10}],[10],{woman:true,web:[]}),
  'camp-atticus':body([{faction:'Civilian',role:'escort',staff:'merchant',chapter:11}],[11]),
  // The camp's staff by their camp role (actor-kit.js), ahead of the escorts' civilian dress.
  // Aper wears it on the web, and in the desktop app his own body above: there the clerks wear it from III.
  'camp-clerk':body([{faction:'Civilian',role:'escort',staff:'clerk'},{faction:'Civilian',role:'escort',staff:'quartermaster'}],[1,2,3,4,5,6,7,8,9,10,11,12],{desktop:[3,4,5,6,7,8,9,10,11,12]}),
  'camp-capsarius':body([{faction:'Civilian',role:'escort',staff:'capsarius'},{faction:'Civilian',role:'escort',staff:'orderly'}],[1,2,3,4,5,6,7,8,9,10,11,12]),
  // Syra the sutler follows the legion from Novae to the Danube fort, and to the final march.
  'camp-sutler':body([{faction:'Civilian',role:'escort',staff:'trader'}],[1,2,3,4,12],{woman:true}),
  // Vibia the wine-seller of Chapter VII's canabae, in a body of her own (graphics plan, G6), in the desktop app
  // alone: the chapter's web download has no room for her, and there she keeps the procedural woman's figure.
  'camp-vibia':body([{faction:'Civilian',role:'escort',staff:'merchant',chapter:7}],[7],{woman:true,web:[]}),
  // Bassus the armourer at the quartermaster's of every camp, in a body of his own with its own leather apron (G6):
  // on the web only in Chapter XI, the one camp whose download has room; elsewhere there he wears the escorts'
  // body below with the code-built apron (actors.js).
  'camp-smith':body([{faction:'Civilian',role:'escort',staff:'smith'}],[1,2,3,4,5,6,7,8,9,10,11,12],{web:[11]}),
  // The camps' people above wear their own bodies in the desktop app, so there it is worn only where the escorts,
  // envoys, signallers and standard-bearers who have none stand.
  'civilian-escort':body([{faction:'Civilian',role:'escort'}],[1,2,3,4,5,6,7,8,9,10,11,12],{desktop:[2,3,4,6,8,9,12]}),
  // The chamber's members in plain togas, each with the band its bloc's trims are drawn on
  // (bind-character.py --bloc-band). Chosen by the member's identity, never by kit.
  'senator-elder':body([],SENATOR_CHAPTERS,{senator:true}),
  'senator-bearded':body([],SENATOR_CHAPTERS,{senator:true}),
  'senator-younger':body([],SENATOR_CHAPTERS,{senator:true}),
  // Named men in their own generated bodies, the shared head wrapped onto each man's own
  // generated head (scripts/assets/wrap-cast-head.py). Chosen by who he is, never by kit.
  'cast-lucan':body([],CAST_CHAPTERS.lucan,{headwear:SHARED_HEAD,cast:'lucan'}),
  // Faces from the men's campaign portraits (graphics plan, G6), on their own bodies, in the desktop app. The web's
  // downloads have no room for them, so there each man keeps his first body and face, below, in all his chapters.
  'cast-varro-portrait':body([],CAST_CHAPTERS.varro,{headwear:SHARED_HEAD,cast:'varro',web:[]}),
  'cast-sabinus-portrait':body([],CAST_CHAPTERS.sabinus,{headwear:SHARED_HEAD,cast:'sabinus',web:[]}),
  'cast-crispus-portrait':body([],CAST_CHAPTERS.crispus,{headwear:SHARED_HEAD,cast:'crispus',web:[]}),
  'cast-paullus-portrait':body([],CAST_CHAPTERS.paullus,{headwear:SHARED_HEAD,cast:'paullus',civilian:true,web:[]}),
  'cast-varro':body([],CAST_CHAPTERS.varro,{headwear:SHARED_HEAD,cast:'varro',desktop:[]}),
  'cast-sabinus':body([],CAST_CHAPTERS.sabinus,{headwear:SHARED_HEAD,cast:'sabinus',desktop:[]}),
  'cast-naso':body([],CAST_CHAPTERS.naso,{headwear:SHARED_HEAD,cast:'naso'}),
  'cast-felix':body([],CAST_CHAPTERS.felix,{headwear:SHARED_HEAD,cast:'felix'}),
  'cast-brennus':body([],CAST_CHAPTERS.brennus,{headwear:SHARED_HEAD,cast:'brennus'}),
  'cast-crispus':body([],CAST_CHAPTERS.crispus,{headwear:SHARED_HEAD,cast:'crispus',desktop:[]}),
  'cast-quintus':body([],CAST_CHAPTERS.quintus,{headwear:SHARED_HEAD,cast:'quintus'}),
  // The patron, the senator and the rhetor in their own civilian dress.
  'cast-severianus':body([],CAST_CHAPTERS.severianus,{headwear:SHARED_HEAD,cast:'severianus',civilian:true}),
  'cast-paullus':body([],CAST_CHAPTERS.paullus,{headwear:SHARED_HEAD,cast:'paullus',civilian:true,desktop:[]}),
  'cast-theon':body([],CAST_CHAPTERS.theon,{headwear:SHARED_HEAD,cast:'theon',civilian:true}),
  // Aelia's own body is a woman's, and keeps her own head as the camp's other women do.
  'cast-aelia':body([],CAST_CHAPTERS.aelia,{cast:'aelia',woman:true})
});
/** A named person's own bodies by their identity key (actor-identity.js), in the catalog's order: the first a chapter's
 * download carries is the one worn there. */
export const CAST_BODIES=Object.freeze(Object.entries(ACTOR_BODIES).filter(([,b])=>b.cast).reduce((all,[id,b])=>({...all,[b.cast]:Object.freeze([...(all[b.cast]??[]),id])}),{}));
export const SENATOR_BODIES=Object.freeze(Object.keys(ACTOR_BODIES).filter(id=>ACTOR_BODIES[id].senator));
export const actorBodyUrl=id=>`assets/models/characters/${id}.glb`;
const desktopApp=()=>CONFIG.platform==='desktop';
/** Whether a figure of a chapter may wear a body: only where the chapter's download carries it, on the web and in the
 * desktop app. A figure of a chapter the body does not name, or of none (a preview), may wear a body its platform
 * carries in some chapter. `desktop` overrides the build's platform (tests). */
export const bodyShown=(id,chapter,{desktop=desktopApp()}={})=>{const b=ACTOR_BODIES[id];if(!b)return false;const carried=desktop?b.desktop:b.web;
  return b.chapters.includes(chapter)?carried.includes(chapter):carried.length>0;};
/** The body files no chapter's web download carries, which the web build leaves out (scripts/build.mjs). */
export const desktopOnlyBodyFiles=()=>Object.keys(ACTOR_BODIES).filter(id=>!ACTOR_BODIES[id].web.length).map(actorBodyUrl);
/** The body files the desktop app shows in no chapter, which its build leaves out (scripts/build.mjs). */
export const webOnlyBodyFiles=()=>Object.keys(ACTOR_BODIES).filter(id=>!ACTOR_BODIES[id].desktop.length).map(actorBodyUrl);

/** The generated body for a kit (actor-kit.js) and the person drawn (his identity key),
 * or null to keep the procedural figure. A named man with a body of his own wears it in
 * every kit but the civic. A member of the chamber nobody names wears one of the
 * senators' togas, by who he is; the protagonist and the named keep the procedural
 * toga, their own faces above it. */
export function actorBodyId(kit={},cast=null,options={}){
  const shown=id=>bodyShown(id,kit.chapter,options);
  if(kit.civic)return kit.hero||cast&&!String(cast).startsWith('figure-')?null:SENATOR_BODIES[(kit.identity>>>0)%SENATOR_BODIES.length];
  // A named person's own body, where the chapter's download carries it; elsewhere they keep what they wore before.
  const own=cast&&Object.hasOwn(CAST_BODIES,cast)?CAST_BODIES[cast].find(shown):null;
  if(own)return own;
  // A named person in camp dress with no body of their own keeps the procedural figure and
  // their own face, never a stranger's body.
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
  // A body fits a figure of its own sex only: a woman of the camp with no woman's body to fit
  // her (the traders and the witness) keeps the procedural woman's figure.
  const traits={...kit,armored:!!kit.armored,command:!!kit.officer&&kit.chapter>=7};
  // A fit names each trait's value, or a list of them (a staff body worn in some of its role's chapters).
  const matches=(value,trait)=>Array.isArray(value)?value.includes(trait):trait===value;
  for(const [id,{fits,woman}]of Object.entries(ACTOR_BODIES))if(woman===!!kit.female&&shown(id)&&fits.some(fit=>Object.entries(fit).every(([key,value])=>matches(value,traits[key]))))return id;
  return null;
}
/** The bodies a chapter's figures can wear, for its offline download group: on the web those its download carries. */
export const chapterBodies=(chapter,{desktop=desktopApp()}={})=>Object.keys(ACTOR_BODIES).filter(id=>(desktop?ACTOR_BODIES[id].desktop:ACTOR_BODIES[id].web).includes(chapter));

// Generated horses (scripts/assets/bind-horse.py): Tripo horses skinned to the game's horse
// skeleton on their own legs' rest pose. A mounted figure's horse wears the coat of its
// side's horses, the code-built saddle on its back; a horse without one, or whose coat fails
// to load, keeps its procedural look (tests/horse-bodies.test.mjs checks the chapters).
export const HORSE_BODIES=Object.freeze({
  'horse-roman':Object.freeze({fits:Object.freeze(['Roman']),chapters:Object.freeze([7,9,12])}),
  'horse-northern':Object.freeze({fits:Object.freeze(['Gothic']),chapters:Object.freeze([7,8])}),
  // The Palmyrene cataphracts' horse, its bronze-scale trapper flat along the back under the saddle (release G1).
  'horse-cataphract':Object.freeze({fits:Object.freeze(['Palmyrene']),chapters:Object.freeze([9])}),
  // The Persian heavy cavalry's horse, remade in release G1 with its lamellar trapper flat along the back.
  'horse-eastern':Object.freeze({fits:Object.freeze(['Persian']),chapters:Object.freeze([5,6])})
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
