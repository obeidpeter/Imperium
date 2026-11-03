import {CONFIG} from '../config.js';

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
