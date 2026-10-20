// Runs scripts/assets/process-model.py under Blender: BLENDER_PYTHON (a Python
// with Blender's bpy module) or BLENDER (the Blender application). Neither is a
// project dependency; see docs/asset-pipeline.md.
//
//   BLENDER_PYTHON=/path/to/python npm run asset:process -- --input raw.glb --output out.glb [options]
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('./process-model.py',import.meta.url)),args=process.argv.slice(2);
const {BLENDER_PYTHON:python,BLENDER:blender}=process.env;
if(!python&&!blender){console.error('Set BLENDER_PYTHON to a Python with Blender\'s bpy module, or BLENDER to the Blender application. See docs/asset-pipeline.md.');process.exit(2);}
const run=python?spawnSync(python,[script,...args],{stdio:'inherit'}):spawnSync(blender,['--background','--python',script,'--',...args],{stdio:'inherit'});
if(run.error){console.error(run.error.message);process.exit(2);}
process.exit(run.status??1);
