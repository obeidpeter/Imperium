// Explicit developer command. Reads pinned CC0 sources; never runs in the game.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
if(!process.argv[2])throw Error('Usage: node scripts/fetch-female-actor-source.mjs <source-directory>');
const destination=path.resolve(process.argv[2]),metadata=JSON.parse(await fs.readFile(new URL('../vendor/makehuman/female-source.json',import.meta.url),'utf8'));
await fs.mkdir(destination,{recursive:true});
for(const file of metadata.files){
  const response=await fetch(file.url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Source HTTP ${response.status}: ${file.file}`);
  const data=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(data).digest('hex')!==file.sha256)throw Error(`Source checksum mismatch: ${file.file}`);
  await fs.writeFile(path.join(destination,file.file),data);
}
console.log(`Verified ${metadata.files.length} CC0 female anatomy source files at pinned revision ${metadata.commit}.`);
