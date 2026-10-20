// Reports whether the character GLBs in art-source/ were exported from the
// current character source. They are development assets excluded from the
// build, so a stale export does not fail npm test (which checks the committed
// files themselves). Re-export with `npm run art:handoff`, which needs Sharp
// (see art-source/characters/README.md). --warn reports without failing.
import {readFile} from 'node:fs/promises';
import {characterSourceDigest} from './character-glb.mjs';
const manifest=JSON.parse(await readFile(new URL('../art-source/characters/manifest.json',import.meta.url),'utf8'));
const current=await characterSourceDigest();
if(manifest.sourceDigest===current)console.log('Character handoff: the GLBs match the current character source.');
else{
  console.log(`Character handoff: the GLBs were exported from an earlier character source (${manifest.sourceDigest.slice(0,12)}, now ${current.slice(0,12)}). Re-export them with npm run art:handoff before the next art handoff.`);
  if(!process.argv.includes('--warn'))process.exitCode=1;
}
