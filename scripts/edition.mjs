import {chapterFlatAssets,chapterOfflineAssets} from '../src/ui/art.js';

// The web demo (the Steam plan, docs/steam-plan.md, S2): `npm run build:demo` (scripts/build.mjs --edition demo) builds
// the opening chapters into dist-demo/, ending at the last one's promotion. The full game is the default edition.
export const CAMPAIGN_CHAPTERS=12,DEMO_LAST_CHAPTER=3;

// Files the demo's title page shows from later chapters: the landing page's picture of the Senate.
export const DEMO_KEPT=Object.freeze(['./assets/scenes/rome.webp']);

// What the demo leaves out: every file that only later chapters use, in their 3D packs or their 2D art, and in none of
// the demo's chapters or its first download (`initial`). A file in no chapter's pack stays, such as the landing page's
// screenshots and the study pages, and so does what DEMO_KEPT names.
export function laterChapterOnly(assets,{initial,lastChapter=DEMO_LAST_CHAPTER}){
  const kept=new Set([...initial,...DEMO_KEPT]),later=new Set();
  for(let chapter=1;chapter<=CAMPAIGN_CHAPTERS;chapter++)
    for(const file of [...chapterOfflineAssets(chapter,assets),...chapterFlatAssets(chapter)])(chapter<=lastChapter?kept:later).add(file);
  return assets.filter(url=>later.has(url)&&!kept.has(url));
}

// The files a build copies (scripts/build.mjs), as its offline lists name them ('./src/ui/app.js'): for checks that
// work out the demo's files from the source tree without building.
export async function sourceAssetUrls(root){
  const {readdir,stat}=await import('node:fs/promises'),{join,relative}=await import('node:path');
  const urls=[];
  async function walk(path){
    if((await stat(path)).isDirectory()){for(const entry of await readdir(path))await walk(join(path,entry));return;}
    if(!path.endsWith('debug.js')&&!/(?:^|[\\/])(?:sw\.js|build-report\.json)$/.test(path))urls.push('./'+relative(root,path).replaceAll('\\','/'));
  }
  for(const entry of ['index.html','icon.svg','manifest.webmanifest','src','icons','assets','showcase','vendor'])await walk(join(root,entry));
  return urls.sort();
}
