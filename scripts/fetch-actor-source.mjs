// Explicit developer command, never imported by the game or production build.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
if(!process.argv[2])throw Error('Usage: node scripts/fetch-actor-source.mjs <source-directory>');
const destination=path.resolve(process.argv[2]),metadata=JSON.parse(await fs.readFile(new URL('../vendor/makehuman/source.json',import.meta.url),'utf8'));
await fs.mkdir(destination,{recursive:true});
for(const file of metadata.files){const response=await fetch(file.url);if(!response.ok)throw Error(`Source HTTP ${response.status}: ${file.file}`);const data=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(data).digest('hex')!==file.sha256)throw Error(`Source checksum mismatch: ${file.file}`);await fs.writeFile(path.join(destination,file.file),data);}
console.log(`Verified ${metadata.files.length} CC0 source files at pinned revision ${metadata.commit}.`);
