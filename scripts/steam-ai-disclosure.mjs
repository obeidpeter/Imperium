// node scripts/steam-ai-disclosure.mjs: writes docs/steam-ai-disclosure.md, the draft of the AI section of Steam's
// content survey (the Steam plan, S4), from docs/asset-manifest.json. Every file the game ships is in the manifest; each
// is sorted here by how it was made. A test fails while the draft differs from the manifest, and while a file's
// source fits none of the kinds below: a new kind of source has to be sorted before the draft is true again.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// How each kind of source was made, in the order the sheet lists them. `ai` marks what Steam's survey asks about.
export const KINDS=Object.freeze({
  illustration:{ai:true,tool:'OpenAI image generation (the built-in tool in the Codex app)'},
  model:{ai:true,tool:'Tripo text-to-model'},
  partly:{ai:true,tool:'Blender, by the game’s own script, with CC0 bark and plant textures from Poly Haven',
    then:'The oak and willow leaf cards use cells of a generated foliage texture (one of the surface textures above)'},
  music:{ai:true,tool:'Lyria 3 (`lyria-3-clip`), through Runway'},
  sound:{ai:true,tool:'Runway’s sound-effects workflow'},
  voice:{ai:true,tool:'ElevenLabs v3 (`eleven_v3`), through Runway'},
  depth:{ai:true,tool:'MiDaS v2.1 small (MIT), a depth-estimation model run offline'},
  blender:{ai:false,tool:'Blender, by the game’s own scripts; no external images or models'},
  trees:{ai:false,tool:'Blender, by the game’s own script, with CC0 bark and plant textures from Poly Haven'},
  makehuman:{ai:false,tool:'MakeHuman (CC0), adapted by the project’s scripts'},
  polyhaven:{ai:false,tool:'Poly Haven (CC0), resized and compressed'},
  code:{ai:false,tool:'The game’s own code'},
  capture:{ai:false,tool:'Captures of the game running in a browser'},
});

// A shipped file's kind, from its manifest record; null when the record fits none (the test then fails).
export function sourceKind(asset,byPath=new Map()){
  const s=asset?.source??{},m=String(s.method??'');
  if(/OpenAI built-in image_gen/.test(m))return 'illustration';
  if(/^Mechanical recompression of existing project-generated/.test(m)){
    const from=byPath.get(s.derivedFrom);return from?sourceKind(from,byPath):null;
  }
  if(/^Tripo\b/.test(m)||s.generator==='Tripo'||/^Mechanical vertex clustering of the shipped generated model/.test(m))return 'model';
  if(/Runway/.test(m))return {'lyria-3-clip':'music','workflow_audio_sfx':'sound','eleven_v3':'voice'}[s.model]??null;
  if(/MiDaS/.test(m))return 'depth';
  if(/^Original Blender-authored trunks/.test(m))return /generated foliage atlas/.test(m)?'partly':'trees';
  if(/^Original Blender-authored geometry|^Original procedural landscape/.test(m))return 'blender';
  if(/CC0 texture sets from Poly Haven/.test(m))return 'polyhaven';
  if(/MakeHuman CC0|official CC0/.test(m))return 'makehuman';
  if(/code-native project emblem/.test(m))return 'code';
  if(/actual local browser capture/.test(m))return 'capture';
  return null;
}

// What each file is, by where it lives (the first prefix that matches), in the order the sheet lists them.
const PLACES=[
  ['assets/scenes/depth/','Depth maps of the story paintings','Estimated from the paintings, to move their layers'],
  ['assets/scenes/','Story paintings','Cropped, resized and compressed by the project’s scripts'],
  ['assets/portraits/','Portraits and the oath seal','Cropped, resized and compressed'],
  ['assets/tactical/','2D figures and props','Cut out, packed into atlases and compressed'],
  ['assets/animation/','2D figures in action','Cut out, packed into atlases and compressed'],
  ['assets/world/','2D camp, ground and nature pictures','Cut out, packed and compressed'],
  ['assets/showcase/','Surface textures','Resized and compressed; some recompressed again'],
  ['assets/textures/roman-surfaces','Surface textures','Resized and compressed; some recompressed again'],
  ['assets/models/characters/','Characters’ bodies','Rigged by Tripo’s auto-rig, bound to the game’s own skeleton and motions, reduced and compressed'],
  ['assets/models/horses/','Horses','Bound to the game’s own horse rig and gaits, reduced and compressed'],
  ['assets/models/landmarks/','Landmarks','Processed in Blender by the project’s scripts, then compressed'],
  ['assets/models/world/','Camp and town props','Processed in Blender by the project’s scripts, then compressed'],
  ['assets/models/chapters/','Chapter V scenery','Processed in Blender by the project’s scripts, then compressed'],
  ['assets/models/scenery/rocks-','Rock kits','Reduced in Blender and gathered into one kit for each region'],
  ['assets/items/','Item pictures','Each model rendered in Blender, then packed into one atlas'],
  ['src/showcase/finale-crowd','The finale’s distant crowd','Reduced by the project’s script from one generated figure'],
  ['assets/models/scenery/trees-','Tree kits',''],
  ['assets/audio/music-','Music','Used as generated; re-encoded smaller'],
  ['assets/audio/ambience-','Ambience','Used as generated, without edits'],
  ['assets/audio/foley-','Combat and footstep sounds','Used as generated, without edits'],
  ['assets/audio/voice-','Voiced briefings','Used as generated, without edits; the words are the game’s own lines'],
  ['assets/models/scenery/','Building, fortification and board kits',''],
  ['assets/textures/panoramas/','Horizon panoramas',''],
  ['assets/models/roman-','Body anatomy',''],
  ['assets/textures/complexion-','Skin textures',''],
  ['assets/models/short-hair','Hair',''],
  ['assets/textures/short-hair','Hair',''],
  ['assets/textures/ground/','Ground textures',''],
  ['icons/','App icons',''],
  ['assets/site/','Screenshots of the game, for the web page',''],
];
const placeOf=path=>{const i=PLACES.findIndex(([prefix])=>path.startsWith(prefix));return i<0?{index:PLACES.length,what:path,then:''}:{index:i,what:PLACES[i][1],then:PLACES[i][2]};};
const KIND_ORDER=Object.keys(KINDS);

// The Tripo versions and the voices named in a group's records, so the sheet says exactly what made them.
const tripoVersions=list=>[...new Set(list.flatMap(a=>String(a.source.method).match(/\b(?:H\d\.\d|v\d\.\d)(?=[\s-])/g)??[]))].sort();
const voices=list=>[...new Set(list.map(a=>a.source.voice).filter(Boolean))];
const listed=names=>names.length<2?names.join(''):`${names.slice(0,-1).join(', ')} and ${names.at(-1)}`;
// Face and hair paint restored with OpenAI image generation from the game's own model renders (save-camp-art-refinements.md).
const repainted=asset=>/^Project-generated/.test(asset?.source?.surfaceRepair?.paint??'');
const COUNT_WORDS=['no','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const count=n=>COUNT_WORDS[n]??n.toLocaleString('en-GB'),plural=(n,word)=>`${word}${n===1?'':'s'}`;

export function aiInventory(manifest){
  const byPath=new Map(manifest.assets.map(a=>[a.path,a])),rows=new Map(),unsorted=[];
  for(const asset of manifest.assets){
    const kind=sourceKind(asset,byPath);
    if(!kind){unsorted.push(asset.path);continue;}
    const place=placeOf(asset.path),key=`${kind}|${place.what}`;
    if(!rows.has(key))rows.set(key,{kind,...place,assets:[]});
    rows.get(key).assets.push(asset);
  }
  const all=[...rows.values()].sort((a,b)=>KIND_ORDER.indexOf(a.kind)-KIND_ORDER.indexOf(b.kind)||a.index-b.index).map(r=>{
    let tool=KINDS[r.kind].tool;
    if(r.kind==='model'){const v=tripoVersions(r.assets);tool=`Tripo text-to-model${v.length?` (${v.join(', ')})`:''}${r.assets.some(a=>/auto-rig/.test(a.source.method))?' and Tripo’s auto-rig':''}`;const faces=r.assets.filter(repainted).length;if(faces)tool+=`; OpenAI image generation restored ${count(faces)} ${plural(faces,'face texture')} from the project’s own renders`;}
    if(r.kind==='voice'){const v=voices(r.assets);if(v.length)tool+=`, with the provider’s voices ${listed(v)}`;}
    const models=r.assets.reduce((n,a)=>n+(Array.isArray(a.source.models)?a.source.models.length:0),0);
    return {kind:r.kind,what:r.what,then:KINDS[r.kind].then??r.then,tool,files:r.assets.length,models};
  });
  const made=all.filter(r=>KINDS[r.kind].ai);
  return {made,without:all.filter(r=>!KINDS[r.kind].ai),unsorted,total:manifest.assets.length,
    aiFiles:made.reduce((n,r)=>n+r.files,0),faceRestorations:manifest.assets.filter(repainted).length,
    development:(manifest.developmentAssets??[]).length,runtimePolicy:manifest.runtimePolicy};
}

// The text for Steam's store page: a sentence for each kind of AI-made content the game ships, so a new kind adds
// its sentence and a kind that is gone takes its sentence with it.
const STORE_LINES=[
  ['illustration','Art: the story paintings, character portraits, 2D figures and some surface textures were generated with OpenAI’s image generation from original prompts written for this game, then cropped, packed and compressed for it.'],
  ['depth','An AI depth-estimation model made depth maps of the paintings, which give them their slight movement.'],
  ['model','3D models: the characters’ bodies and the horses, the camp and town props, the landmarks and rocks, and the models behind the inventory’s item pictures were generated with Tripo from original text prompts, then fitted to the game’s own skeleton and motions, reduced and compressed.'],
  ['music','Music: the music tracks were generated with Google’s Lyria, through Runway.'],
  ['sound','Sound: the ambience and the combat and footstep sounds were generated with Runway; the interface’s short cues are made by the game’s code.'],
  ['voice','Voices: the voiced briefings are AI voices from ElevenLabs’ catalogue (through Runway), reading lines written for the game; no voice was cloned from a recording.'],
];
export function storeText(inventory){
  const kinds=new Set(inventory.made.map(r=>r.kind)),bullets=[];
  // The depth maps belong to the paintings: their sentence joins the art line when there is one.
  for(const [kind,line] of STORE_LINES.filter(([kind])=>kinds.has(kind)))
    if(kind==='depth'&&kinds.has('illustration'))bullets[0]+=` ${line}`;else bullets.push(`- ${line}`);
  // The restored faces belong to the models' line; their number comes from the manifest.
  const faces=inventory.faceRestorations??0,models=bullets.findIndex(line=>line.startsWith('- 3D models:'));
  if(faces&&models>=0){const n=count(faces);bullets[models]+=` ${n[0].toUpperCase()+n.slice(1)} character ${plural(faces,'face texture')} ${faces===1?'was':'were'} restored with OpenAI image generation from the game’s own model renders and baked in Blender.`;}
  return ['This game was made with the help of generative AI tools. Everything described here was made before release: nothing is generated while you play, and the game connects to no AI service.','',
    ...bullets,
    '- Writing and code: the story, dialogue and in-game help, and the game’s code, were written with AI assistants (OpenAI Codex and Anthropic’s Claude) under the developer’s direction and review.','',
    'No third-party art, photographs or voice recordings were given to any generator. The building and fortification kits and the horizon panoramas were built in Blender by the game’s own scripts, the photographed ground textures and the skin textures come from CC0 libraries (Poly Haven and MakeHuman), and the interface is drawn by the game’s code: none of these was made with generative AI.'].join('\n');
}

const table=(head,rows)=>[`| ${head.join(' | ')} |`,`| ${head.map(()=>'---').join(' | ')} |`,...rows.map(r=>`| ${r.join(' | ')} |`)];
const filesCell=r=>r.models?`${r.files} (from ${r.models} models)`:String(r.files);

export function steamAiDisclosureSheet(manifest){
  const inv=aiInventory(manifest),text=storeText(inv);
  return ['# Steam’s AI-content disclosure: the draft','',
    `The draft answers to the AI section of Steam’s content survey ([the Steam plan](steam-plan.md), S4), for the owner to check and enter in Steamworks. Generated from [the asset manifest](asset-manifest.json) by \`node scripts/steam-ai-disclosure.mjs\`; do not edit it by hand. A test fails while it differs from the manifest, or while a shipped file’s source is not sorted here.`,'',
    'Steam’s own wording in Steamworks decides what is asked. This draft could not be checked against it: the session that wrote it could not reach Valve’s partner site. It rests on reports of the survey as Valve rewrote it in January 2026, which ask about AI-made content that players see or hear, in the game or on its store page, whether it was made before release or is generated while the game runs. This is not legal advice. The rights to the generated files are a separate question, in [the owner’s checklist](steam-release.md#rights-for-a-commercial-release).','',
    '## The answers','',
    `- **Made with AI before release (pre-generated): yes.** ${inv.aiFiles} of the ${inv.total} files the game ships were made with AI tools ([below](#what-it-rests-on-the-files-made-with-ai)), and so were its writing and code ([beyond the shipped files](#beyond-the-shipped-files)).`,
    `- **Generated while the game runs (live-generated): no.** The manifest’s runtime policy: “${inv.runtimePolicy}” The game connects to no AI service.`,'',
    '## The text for the store page','',
    'Steam shows it under “AI Generated Content Disclosure”. Edit it freely, but keep it true to the inventory below. The line on writing and code rests on the project’s history, not on the manifest; the owner confirmed it on 4 November 2026.','',
    '```text',text,'```','',
    `${text.length.toLocaleString('en-GB')} characters.`,'',
    '## What it rests on: the files made with AI','',
    ...table(['What','Files','Made with','Then'],inv.made.map(r=>[r.what,filesCell(r),r.tool,r.then])),'',
    `The manifest records that no third-party image, model or recording was given to a generator. ${inv.faceRestorations
      ?`Some generations were shown the project’s own art: a supplementary cast sheet was shown its first generated atlas ([the art record](art-generation.md)), and each of the ${count(inv.faceRestorations)} face ${plural(inv.faceRestorations,'restoration')} was given a render of the game’s own model ([the art record](art-generation.md#character-face-restorations--4-november-2026)).`
      :'One generation, a supplementary cast sheet, was shown the project’s own first generated atlas ([the art record](art-generation.md)).'}`,'',
    '## Made without AI','',
    ...table(['What','Files','Made with'],inv.without.map(r=>[r.what,filesCell(r),r.tool])),'',
    'What the game draws in code as it runs is made without AI too: the interface, maps, overlays and insignia, and the interface’s sound cues. The 3D terrain and scenery, the 2D board and the code-built figures that stand in when a generated body is missing are drawn in code as well, but painted with textures and pictures from the two tables, generated and CC0 alike.','',
    '## Beyond the shipped files','',
    '- **Writing and code (confirmed by the owner on 4 November 2026).** The game’s code and text were written with AI assistants, as the project’s history records: commits by Claude Code and by OpenAI Codex, under the owner’s direction and review. Reports of the January 2026 survey leave tools that only make development faster out of the question. The story, dialogue and help are text the player reads, so the draft names them.',
    '- **The Steam achievement icons** are cut from the same story paintings, item pictures, emperor’s portrait and oath seal, apart from five insignia drawn in code ([the list](steam-achievements.md)).',
    '- **The store’s and the library’s images** ([the drafts](steam-store-art.md)): the header, small and main capsules, the page background and the library’s header are made from the oath painting, so they are AI-generated art too, and the art line covers them. The vertical capsule and the library’s capsule and hero are renders of the game’s own 3D view, and show its generated models as the game does. Steam’s two icons are the game’s emblem, drawn in code.',
    '- **The draft screenshots** ([the record](steam-store-art.md#the-screenshots-drafts)) are captures of the game, and show its generated art, figures and item pictures as it plays. A trailer captured from the game will show them too; update this draft once it exists.',
    `- **${inv.development} development-only files** in \`art-source/\` are not shipped and are left out.`,'',
    '## Keeping it true','',
    '- After changing the manifest, run `node scripts/steam-ai-disclosure.mjs`. When the text for the store page changes, change it in Steamworks too.',
    '- A file whose source fits none of the kinds in the script fails the test until it is sorted, so a new tool, or a generated file where there was none, never goes unlisted.',''].join('\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const manifest=JSON.parse(await readFile(new URL('../docs/asset-manifest.json',import.meta.url),'utf8'));
  const inv=aiInventory(manifest);
  if(inv.unsorted.length){console.error(`Unsorted sources: ${inv.unsorted.join(', ')}`);process.exit(1);}
  await writeFile(new URL('../docs/steam-ai-disclosure.md',import.meta.url),steamAiDisclosureSheet(manifest));
  console.log(`Wrote docs/steam-ai-disclosure.md (${inv.aiFiles} of ${inv.total} shipped files made with AI).`);
}
