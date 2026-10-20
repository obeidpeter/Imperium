import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {createActorAssetCatalog,ACTOR_MODEL_URL,FEMALE_ACTOR_MODEL_URL} from '../src/showcase/actor-assets.js';
import {createActorComplexionLibrary,ACTOR_COMPLEXION_ASSETS} from '../src/showcase/actor-complexion.js';
import {createActor} from '../src/showcase/actors.js';
import {exportCharacterGlb,characterSourceDigest} from './character-glb.mjs';
const root=new URL('../',import.meta.url),at=path=>new URL(path,root); // Paths are relative to the repository, not the working directory.
const sharp=(await import(process.env.ART_SHARP_MODULE?pathToFileURL(resolve(process.env.ART_SHARP_MODULE)).href:'sharp')).default;
const load=url=>async()=>{const b=await readFile(at(url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const library=createActorAssetCatalog({maleLoad:load(ACTOR_MODEL_URL),femaleLoad:load(FEMALE_ACTOR_MODEL_URL)});
const complexion=createActorComplexionLibrary(async(_,kind)=>{const {data,info}=await sharp(await readFile(at(ACTOR_COMPLEXION_ASSETS[kind]))).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height};});
const subjects=[
  {id:'marcellus',unit:{id:'hero',name:'Aurelius Marcellus',side:'player',role:'infantry'},options:{chapter:5,rank:'Centurio'}},
  {id:'lucan',unit:{id:'lucan',name:'Aurelius Lucan',veteranId:'lucan',side:'ally',role:'infantry'},options:{chapter:5}},
  {id:'persian-guard',unit:{id:'persian-guard',name:'Persian guard',side:'enemy',role:'guard'},options:{chapter:5}}
];
await mkdir(at('art-source/characters/'),{recursive:true});const manifest=[];
for(const subject of subjects){
  const actor=createActor(subject.unit,{...subject.options,quality:'balanced',assetLibrary:library,complexionLibrary:complexion});await actor.ready;
  const {bytes,document}=exportCharacterGlb(actor,{name:subject.id});
  const path=`art-source/characters/${subject.id}-v035.glb`;await writeFile(at(path),bytes);
  manifest.push({id:subject.id,path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),meshes:document.meshes.length,skins:document.skins.length,joints:new Set(document.skins.flatMap(s=>s.joints)).size,embeddedMaps:document.images.length,animations:document.animations.map(a=>a.name),source:subject});
  actor.dispose();
}
await writeFile(at('art-source/characters/manifest.json'),JSON.stringify({version:35,sourceDigest:await characterSourceDigest(),method:'Code-authored garments and performances over MakeHuman CC0 anatomy; self-contained editable glTF 2.0; no purchased or commissioned assets.',characters:manifest},null,2)+'\n');
console.log(JSON.stringify(manifest.map(({source,...s})=>s),null,2));complexion.dispose();
