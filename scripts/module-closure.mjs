import {readFile} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';

// Every module an entry point loads before it runs: its static imports and
// re-exports, followed through relative specifiers. Dynamic import() is left
// out, as the browser fetches it only when called. Paths are returned the way
// the offline lists name them ('./src/ui/app.js').
const STATIC=/(?:^|[;\s}])(?:import|export)\s*(?:[^'"();]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/g;
export async function staticImportClosure(root,entry){
  const seen=new Set(),queue=[resolve(root,entry)];
  while(queue.length){
    const file=queue.pop();if(seen.has(file))continue;seen.add(file);
    const source=(await readFile(file,'utf8')).replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`])\/\/.*$/gm,'$1');
    for(const [,specifier]of source.matchAll(STATIC))queue.push(join(dirname(file),specifier));
  }
  return [...seen].map(file=>'./'+relative(root,file).replaceAll('\\','/')).sort();
}
