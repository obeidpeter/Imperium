import {createAssetLoader,constrainedConnection,prefetchFiles} from './asset-loader.js';
import {paintedJourneyMap} from './campaign-map.js';
import {PRESENTATION_BUDGET} from './presentation-budget.js';
import {animationAssets} from './sprite-frames.js';
// Presentation assets never infer or award campaign milestones.
const artLoader=createAssetLoader({maxEntries:PRESENTATION_BUDGET.decodedEntries,maxBytes:PRESENTATION_BUDGET.decodedBytes});
export function heroPortrait(rank='Tiro') {
  const r=rank.toLowerCase();
  const stage=r==='augustus'?'emperor':r==='senator'?'senator':/praeses|governor|candidate/.test(r)?'governor':/praefectus|praepositus|acting commander|dux/.test(r)?'prefect':/centurio|primus/.test(r)?'centurion':r==='tiro'?'recruit':'miles';
  return `./assets/portraits/hero-${stage}.webp`;
}
export function speakerPortrait(speaker='',expression='neutral') {
  const names={mentor:'varro',comrade:'lucan',rival:'crispus',patron:'severianus',settler:'aelia',senator:'paullus'};
  const key=names[speaker]||['varro','lucan','crispus','severianus','aelia','paullus','sabinus'].find(n=>speaker.toLowerCase().includes(n));
  return key?`./assets/portraits/${key}${expression==='intense'?'-intense':''}.webp`:null;
}
export function chapterScene(chapter=1) {
  const scenes=['danube','marsh','danube','danube','eastern-fort','eastern-fort','danube','river-crossing','eastern-fort','province','rome','rome'];
  return `./assets/scenes/${scenes[chapter-1]||'danube'}.webp`;
}
// The promotion ceremony's painting: the province for the civil chapters, Rome from the Senate on.
export function promotionScene(chapter=1) {
  const n=Math.max(1,Math.min(12,Math.trunc(chapter)||1));
  return n===9||n===10?'./assets/scenes/province.webp':n>=11?'./assets/scenes/rome.webp':chapterScene(n);
}
// A scene painting's greyscale depth map, for the 2.5D drift (scene-parallax.js).
export function sceneDepth(src='') {
  const match=/^\.\/assets\/scenes\/([a-z-]+)\.webp$/.exec(String(src||''));
  return match?`./assets/scenes/depth/${match[1]}.webp`:null;
}
export const loadArt=(src,options)=>artLoader.load(src,options);
export const peekArt=src=>artLoader.peek(src);
export const artCacheStats=()=>artLoader.stats();
export const clearArtCache=()=>artLoader.clear();
const ranks=['Tiro','Miles','Immunis','Optio','Centurio','Primus pilus','Praefectus legionis','Praepositus','Acting commander','Praeses','Candidate for the Senate','Senator'];
const promotions=['Miles','Immunis','Optio','Centurio','Primus pilus','Praefectus legionis','Praepositus','Acting commander','Dux','Former governor','Senator','Augustus'];
const sharedSpeakers=['varro','lucan','crispus','severianus','aelia','paullus','sabinus'];
const speakers=[['varro','lucan'],['varro','lucan','sabinus'],['crispus','varro','lucan','sabinus'],['varro','crispus'],['severianus','varro'],['varro','severianus'],['crispus','severianus','varro'],['aelia','severianus','lucan','sabinus'],['severianus','lucan','sabinus'],['aelia','severianus'],['crispus','paullus','severianus','varro'],['varro','lucan','sabinus','crispus','severianus','paullus','aelia']];
export function chapterAssets(chapter=1) {
  const n=Math.max(1,Math.min(12,Math.trunc(chapter)||1));
  // The ledger is available in every chapter and displays the complete recurring cast.
  const files=[chapterScene(n),promotionScene(n),heroPortrait(ranks[n-1]),heroPortrait(promotions[n-1]),'./assets/portraits/oath-seal.webp',...sharedSpeakers.map(s=>speakerPortrait(s)),...speakers[n-1].map(s=>speakerPortrait(s,'intense'))];
  if(n===12)files.push('./assets/scenes/accession.webp');
  // Depth maps for this chapter's paintings, and for the oath's (its painting is in the opening shell).
  files.push(...files.map(sceneDepth));
  if(n===1||n===12)files.push(sceneDepth('./assets/scenes/frontier-oath.webp'));
  if(n!==11)files.push('./assets/tactical/units-roman.webp','./assets/tactical/units-frontier.webp','./assets/tactical/units-specialists.webp');
  if([2,3,4,6,7,8,10,11,12].includes(n))files.push('./assets/tactical/units-civic.webp');
  files.push('./assets/tactical/environment-props.webp','./assets/world/ground-materials.webp','./assets/world/natural-props.webp','./assets/world/camp-props.webp');
  if(n!==11)files.push(...animationAssets(n,false));
  files.push(...animationAssets(n,true));
  return [...new Set(files.filter(Boolean))];
}
// Offline resources include code and textures; chapterAssets above stays image-
// only because its consumers decode every entry through the artwork Image loader.
export function chapterAudioAssets(chapter=1){
  const n=Math.max(1,Math.min(12,Math.trunc(chapter)||1)),council=[7,8,10,11,12].includes(n);
  const keys=['music-frontier','foley-step','foley-impact','foley-shield'];
  if(n!==11)keys.push('music-battle',n===2?'ambience-rain':[5,6,9].includes(n)?'ambience-dry':'ambience-frontier');
  else keys.push('ambience-frontier'); // Chapter XI camp precedes its civic encounters.
  if(council)keys.push('music-council','ambience-council','voice-council');
  if(n===1)keys.push('voice-arrival','voice-varro');
  if(n>=4)keys.push('voice-rally');
  return keys.map(key=>`./assets/audio/${key}.mp3`);
}
export function chapterOfflineAssets(chapter,availableFiles=[]) {
  // A restored later chapter may be the first one visited on this device.
  // Every chapter therefore owns the shared renderer dependencies; the worker
  // deduplicates their URLs, so subsequent chapters reuse the same cached bytes.
  // The v0.15 character atlas is retained in the complete historical pack,
  // and the original material maps remain in the complete historical pack.
  // Cold chapter restores need only active artwork and anatomy. Aelia's model
  // is deferred until Chapter VIII; the complete inventory retains it always.
  const n=Math.max(1,Math.min(12,Math.trunc(chapter)||1));
  const shared3D=availableFiles.filter(path=>path!=='./src/showcase/showcase.css'&&!(n<8&&['./assets/models/roman-woman-v018.glb','./assets/textures/complexion-female-v018.webp'].includes(path))&&!['./assets/showcase/character-materials-v015.webp','./assets/showcase/earth.webp','./assets/showcase/stone.webp','./assets/showcase/timber.webp'].includes(path)&&['./src/showcase/','./assets/showcase/','./assets/models/','./assets/textures/','./vendor/three/','./vendor/makehuman/'].some(prefix=>path.startsWith(prefix)));
  return [...new Set([...chapterAssets(chapter),...shared3D,...chapterAudioAssets(chapter)])];
}
let chapterRequest=0;
// Atlases only the 2D tactical view draws. The 3D view never decodes them; they
// stay in the offline chapter group and the 2D view loads them on demand.
export const TACTICAL_2D_ONLY=Object.freeze(['./assets/tactical/environment-props.webp','./assets/world/ground-materials.webp','./assets/world/natural-props.webp','./assets/world/camp-props.webp']);
export async function prefetchChapter(chapter,{next=true,onProgress,retry=false,connection=globalThis.navigator?.connection,shouldPrefetchNext=()=>true,skip=()=>false}={}) {
  const request=++chapterRequest;
  const current=await artLoader.prefetch(chapterAssets(chapter).filter(path=>!skip(path)),{onProgress,retry});
  const nextAllowed=request===chapterRequest&&next&&chapter<12&&!constrainedConnection(connection)&&shouldPrefetchNext();
  // Optional next-chapter requests warm compressed responses only: decoding them
  // here would evict sprites still used by the current battlefield.
  const nextResult=nextAllowed?await prefetchFiles(chapterAssets(chapter+1),{shouldContinue:()=>request===chapterRequest&&shouldPrefetchNext()}):null;
  return {...current,nextPrefetched:Boolean(nextResult&&nextResult.completed===nextResult.total&&!nextResult.failed)};
}
// The painted Imperial Tabula (campaign-map.js) keeps the theatre-node contract.
export function journeyMap(current,completed=[],selectedTheatre=null) {
  return paintedJourneyMap(current,completed,selectedTheatre);
}
