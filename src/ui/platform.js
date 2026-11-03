import {CONFIG} from '../config.js';
import {earnedAchievements} from '../core/achievements.js';

// The platform boundary (CLAUDE.md; the Steam plan, docs/steam-plan.md). The game runs as the web site or inside the
// desktop app (desktop/, for Steam). The desktop build writes CONFIG.platform 'desktop', and the app's preload
// (desktop/preload.cjs) adds the bridge `window.imperiumDesktop`. What differs between them asks here, so the rest of
// the game stays one program. Nothing here may touch the page when imported: the build and the Node tests import it.

/** 'desktop' in the desktop build, otherwise 'web'. */
export const platformKind=()=>CONFIG.platform==='desktop'?'desktop':'web';

/** The desktop app's bridge, or null: on the web, under Node, or for a desktop build opened in a browser. */
export function desktopBridge(){
  try{const bridge=globalThis.imperiumDesktop;return bridge&&typeof bridge==='object'?bridge:null;}catch{return null;}
}

/** Inside the desktop app: the desktop build with its bridge. Without the bridge a desktop build behaves as the web. */
export const inDesktopApp=()=>platformKind()==='desktop'&&!!desktopBridge();

/** The web build caches chapters for offline play through its service worker; the desktop app has every file installed. */
export const usesOfflineCache=()=>platformKind()==='web';

/** The connection that optional downloads respect. The desktop app reads its own files, so none limits them: an
 * offline PC can report a downlink of 0, which would otherwise hold back the title's images. */
export function networkConnection(){
  if(platformKind()==='desktop')return null;
  try{return globalThis.navigator?.connection??null;}catch{return null;}
}

/** The desktop app's copy of the chronicle as a file (written atomically by desktop/main.js, with one backup), for
 * the save store (storage.js): null on the web. */
export function desktopSaveMirror(){
  const saves=platformKind()==='desktop'?desktopBridge()?.saves:null;
  if(!saves||typeof saves.read!=='function'||typeof saves.write!=='function')return null;
  return {read:()=>saves.read('campaign'),write:text=>saves.write('campaign',text)};
}

// The edition (the Steam plan, S2): the free web demo plays the opening chapters and ends at the last one's promotion;
// the full game is the web build for development and playtests, and the desktop app. The demo's build
// (scripts/build.mjs --edition demo) writes CONFIG.edition 'demo', its last chapter and the store's address.

/** 'demo' in the web demo's build, otherwise 'full'. */
export const buildEdition=()=>CONFIG.edition==='demo'?'demo':'full';

/** The demo's last chapter, or null in the full game. The rules refuse to advance past it (core/game.js advanceChapter);
 * it comes from the build, never the save, so the demo's saves are the full game's. */
export function demoLastChapter(){
  if(buildEdition()!=='demo')return null;
  const chapter=Math.trunc(Number(CONFIG.lastChapter));
  return chapter>=1&&chapter<12?chapter:3;
}

/** The full game's store page, which the demo's build takes from STORE_URL, or '' until there is one. */
export function storeUrl(){
  const url=buildEdition()==='demo'?String(CONFIG.storeUrl??''):'';
  return /^https:\/\/[^\s"'<>]+$/.test(url)?url:'';
}

/** What the page says and offers in the demo, or null in the full game: the views take it from their context. */
export function demoEdition(){
  const lastChapter=demoLastChapter();
  return lastChapter?{lastChapter,storeUrl:storeUrl()}:null;
}

/** What the offline notices call everything there is to download: the full game's twelve chapters, or the demo's. */
export function allChaptersLabel(demo=demoEdition()){
  return demo?`all ${['one','two','three','four','five','six'][demo.lastChapter-1]??demo.lastChapter} chapters of the demo`:'all twelve chapters';
}

const ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
/** A chronicle past the demo's last chapter (the full game's, by a save code): the demo never plays it, and says why. */
export const pastDemo=(state,demo=demoEdition())=>!!demo&&!!state&&Number(state.chapter)>demo.lastChapter;
export const pastDemoMessage=(state,demo=demoEdition())=>`This chronicle has reached Chapter ${ROMAN[state.chapter-1]??state.chapter}, past the end of the demo with Chapter ${ROMAN[demo.lastChapter-1]}. Continue it in the full game.`;

/** Steam's achievements (the Steam plan, S3): the desktop app unlocks what the chronicle has earned
 * (core/achievements.js) after each save and when a chronicle loads. Nothing happens on the web, or in the app without
 * Steam; a failure is never the game's. Resolves to the ids Steam newly unlocked. */
export async function reportAchievements(state,{bridge=inDesktopApp()?desktopBridge():null}={}){
  const steam=bridge?.steam;
  if(!state||typeof steam?.unlock!=='function')return [];
  const ids=earnedAchievements(state).map(a=>a.id);
  if(!ids.length)return [];
  try{const result=await steam.unlock(ids);return Array.isArray(result?.unlocked)?result.unlocked:[];}catch{return [];}
}
