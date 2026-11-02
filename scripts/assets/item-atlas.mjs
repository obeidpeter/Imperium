// The inventory's item atlas (release 13): every item picture packed into one WebP that the game draws from.
//
// art-source/items/item-pictures.json lists the pictures: each names the request its model came from, its shape in
// pack cells and the items it serves. A picture's master, art-source/items/pictures/item-<name>.png, is rendered at
// 128 pixels a cell from the request's model with the request's own picture settings (render-item-pictures.py).
// This checks the list against src/data/items.js (every item has a picture or keeps its drawn silhouette), then runs
// build-item-atlas.py under Blender's Python, which packs the masters into assets/items/item-atlas.webp and writes
// src/data/item-pictures.js, and records the atlas in docs/asset-manifest.json. The models never ship; only the atlas.
//
//   node scripts/assets/item-atlas.mjs [--cell 80] [--quality 78]
//   node scripts/assets/item-atlas.mjs --render [name …]   # first render those masters (default: all) from their models
//   (BLENDER_PYTHON, as npm run asset:setup writes it, names a Python with Blender's bpy module. Rendering needs the
//   raw models in art-source/models/raw/, which stay outside the repository.)
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {ITEMS} from '../../src/data/items.js';
import {upsertManifestText} from './cc0.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:fallback;};
const planPath=join(root,'art-source/items/item-pictures.json'),plan=JSON.parse(readFileSync(planPath,'utf8'));
const request=id=>JSON.parse(readFileSync(join(root,'art-source/models/requests',`${id}.json`),'utf8'));

// Every item has one picture or keeps its drawn silhouette: a new item must be given one or the other.
const pictured=new Map();
for(const [name,picture]of Object.entries(plan.pictures)){
  const settings=request(picture.request).picture;
  if(settings?.cells!==picture.cells)throw new Error(`${name}: its request renders ${settings?.cells}, the plan packs ${picture.cells}`);
  for(const id of picture.items){
    if(!ITEMS[id])throw new Error(`${name}: ${id} is not an item`);
    if(pictured.has(id))throw new Error(`${id} has two pictures: ${pictured.get(id)} and ${name}`);
    pictured.set(id,name);
  }
}
for(const id of plan.drawn){if(!ITEMS[id])throw new Error(`drawn: ${id} is not an item`);if(pictured.has(id))throw new Error(`${id} is both pictured and drawn`);}
const missing=Object.keys(ITEMS).filter(id=>!pictured.has(id)&&!plan.drawn.includes(id));
if(missing.length)throw new Error(`No picture and not listed as drawn: ${missing.join(', ')}`);

const python=process.env.BLENDER_PYTHON;
if(!python){console.error('Set BLENDER_PYTHON (npm run asset:setup writes it to .tools/env.sh or .tools/env.ps1).');process.exit(2);}
const blender=(script,list)=>{const run=spawnSync(python,[join(root,'scripts/assets',script),'--',...list],{stdio:'inherit',cwd:root});if(run.status!==0)process.exit(run.status??1);};

const render=args.indexOf('--render');
if(render>=0){
  const named=[];for(let i=render+1;i<args.length&&!args[i].startsWith('--');i++)named.push(args[i]);
  for(const name of named.length?named:Object.keys(plan.pictures)){
    const picture=plan.pictures[name];if(!picture)throw new Error(`${name} is not a picture in ${planPath}`);
    const model=join(root,'art-source/models/raw',`${picture.request}.glb`),settings=request(picture.request).picture;
    if(!existsSync(model))throw new Error(`${model}: the raw model is not here (it stays outside the repository)`);
    blender('render-item-pictures.py',['--input',model,'--output',join(root,'art-source/items/pictures',`item-${name}.png`),'--cells',settings.cells,'--cell-size',String(plan.masterCell),
      '--view',settings.view,'--turn',String(settings.turn??0),...(settings.across?['--across',settings.across]:[]),...(settings.dropStand?['--drop-stand',settings.dropStand]:[])]);
  }
}

const output='assets/items/item-atlas.webp',quality=option('quality','78');
mkdirSync(dirname(join(root,output)),{recursive:true});
blender('build-item-atlas.py',['--masters',join(root,'art-source/items/pictures'),'--plan',planPath,'--output',join(root,output),'--src',`./${output}`,
  '--data',join(root,'src/data/item-pictures.js'),'--cell',option('cell','80'),'--quality',quality,'--width',option('width','1024')]);

// Record the atlas in the asset manifest, its sources, bytes and digest, as the CC0 intake records its files.
const {ITEM_ATLAS,ITEM_PICTURES}=await import(pathToFileURL(join(root,'src/data/item-pictures.js')).href);
const bytes=readFileSync(join(root,output)),pictures=Object.entries(plan.pictures),first=request(pictures[0][1].request);
const entry={id:'item-atlas',path:output,
  subject:`The inventory's item pictures: ${pictures.length} pictures for ${Object.keys(ITEM_PICTURES).length} items, rendered from generated models`,
  source:{method:`Tripo text-to-model (${first.generator.options.model_version}) from text prompts only (no reference image or third-party model); each model rendered in Blender by scripts/assets/render-item-pictures.py into a master at ${plan.masterCell} pixels a pack cell, and the masters packed by scripts/assets/item-atlas.mjs`,
    generator:'Tripo',plan:'art-source/items/item-pictures.json',masters:'art-source/items/pictures/',credits:'art-source/models/item-pictures-credits.json',
    models:pictures.map(([name,picture])=>({picture:name,request:`art-source/models/requests/${picture.request}.json`,taskId:request(picture.request).provenance.taskId}))},
  usage:"The inventory's pack, worn places and ground, and the chests', the fallen's and the traders' goods (src/ui/item-art.js): decorative, beside each piece's name.",
  loading:'In every chapter\'s offline pack (src/ui/art.js); drawn only by the inventory, never in 3D.',
  export:{format:`WebP with alpha, lossy at quality ${quality}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
    width:ITEM_ATLAS.width,height:ITEM_ATLAS.height,cell:ITEM_ATLAS.cell},
  license:first.provenance.licence};
const manifestPath=join(root,'docs/asset-manifest.json');
writeFileSync(manifestPath,upsertManifestText(readFileSync(manifestPath,'utf8'),entry));
console.log(`docs/asset-manifest.json: item-atlas, ${bytes.length} bytes`);
