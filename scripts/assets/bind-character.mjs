// Binds a Tripo-rigged character to the game's skeleton under Blender
// (scripts/assets/bind-character.py), or with --horse a Tripo horse to the game's
// horse skeleton (scripts/assets/bind-horse.py), then quantizes the GLB's vertex
// data (quantize-model.mjs) and records the final file in the report. Blender
// comes from BLENDER_PYTHON (a Python with Blender's bpy module) or BLENDER (the
// application); neither is a project dependency. See docs/asset-pipeline.md.
//
//   BLENDER_PYTHON=/path/to/python npm run asset:bind -- --input rigged.glb --output body.glb --report report.json [options]
//   BLENDER_PYTHON=/path/to/python npm run asset:bind -- --horse --input horse.glb --output horse-body.glb [options]
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {quantizeModel} from './quantize-model.mjs';

const horse=process.argv.includes('--horse'),args=process.argv.slice(2).filter(a=>a!=='--horse');
const script=fileURLToPath(new URL(horse?'./bind-horse.py':'./bind-character.py',import.meta.url));
const {BLENDER_PYTHON:python,BLENDER:blender}=process.env;
if(!python&&!blender){console.error('Set BLENDER_PYTHON to a Python with Blender\'s bpy module, or BLENDER to the Blender application. See docs/asset-pipeline.md.');process.exit(2);}
const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const output=option('--output'),report=option('--report')??output?.replace(/\.glb$/i,'.json');
if(!output){console.error('Missing --output.');process.exit(2);}
const run=python?spawnSync(python,[script,...args],{stdio:'inherit'}):spawnSync(blender,['--background','--python',script,'--',...args],{stdio:'inherit'});
if(run.error){console.error(run.error.message);process.exit(2);}
if(run.status)process.exit(run.status);
const {bytes,changed}=quantizeModel(await readFile(output));
await writeFile(output,bytes);
const record=JSON.parse(await readFile(report,'utf8'));
record.output={...record.output,unquantizedBytes:record.output.bytes,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),quantized:{tool:'scripts/assets/quantize-model.mjs',extension:'KHR_mesh_quantization',vertices:changed}};
await writeFile(report,JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({output,bytes:bytes.length,quantized:changed}));
