import {readFile} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';

// Every module an entry point loads before it runs: its static imports and
// re-exports, followed through relative specifiers. Dynamic import() is left
// out, as the browser fetches it only when called. Paths are returned the way
// the offline lists name them ('./src/ui/app.js').
const STATIC=/(?:^|[;\s}])(?:import|export)\s*(?:[^'"();]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/g;
// Every module the page may load, its dynamic import()s followed too: the
// offline packs must hold all of them (scripts/build.mjs checks).
const DYNAMIC=/import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
export async function moduleClosure(root,entry){
  const seen=new Set(),queue=[resolve(root,entry)];
  while(queue.length){
    const file=queue.pop();if(seen.has(file))continue;seen.add(file);
    const source=(await readFile(file,'utf8')).replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`])\/\/.*$/gm,'$1');
    for(const pattern of [STATIC,DYNAMIC])for(const [,specifier]of source.matchAll(pattern))queue.push(join(dirname(file),specifier));
  }
  return [...seen].map(file=>'./'+relative(root,file).replaceAll('\\','/')).sort();
}
export async function staticImportClosure(root,entry){
  const seen=new Set(),queue=[resolve(root,entry)];
  while(queue.length){
    const file=queue.pop();if(seen.has(file))continue;seen.add(file);
    const source=(await readFile(file,'utf8')).replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`])\/\/.*$/gm,'$1');
    for(const [,specifier]of source.matchAll(STATIC))queue.push(join(dirname(file),specifier));
  }
  return [...seen].map(file=>'./'+relative(root,file).replaceAll('\\','/')).sort();
}

// The first download: the shell (everything the entry loads statically, the
// board readout included), the other page files and the opening art. The 3D
// study, the 3D modules, models, textures and vendor files wait for a chapter,
// unless the shell itself imports them.
const STUDY=['./showcase/','./src/showcase/','./assets/showcase/','./assets/models/','./assets/textures/','./vendor/'];
export function studyAssets(assets,{shellModules}){
  const shell=new Set(shellModules);
  return assets.filter(url=>!shell.has(url)&&STUDY.some(prefix=>url.startsWith(prefix)));
}
export function initialAssets(assets,{shellModules,openingArt}){
  const shell=new Set(shellModules),study=new Set(studyAssets(assets,{shellModules})),opening=new Set(openingArt);
  return assets.filter(url=>shell.has(url)||!study.has(url)&&(!url.startsWith('./assets/')||opening.has(url)));
}
