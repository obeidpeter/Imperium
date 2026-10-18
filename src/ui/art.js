import {createAssetLoader,constrainedConnection,prefetchFiles} from './asset-loader.js';
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
  const files=[chapterScene(n),heroPortrait(ranks[n-1]),heroPortrait(promotions[n-1]),'./assets/portraits/oath-seal.webp',...sharedSpeakers.map(s=>speakerPortrait(s)),...speakers[n-1].map(s=>speakerPortrait(s,'intense'))];
  if(n===12)files.push('./assets/scenes/accession.webp');
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
export function journeyMap(current,completed=[],selectedTheatre=null) {
  const sites=[['danube','Danube',325,87,[1,3,4,7]],['abritus','Abritus',390,128,[2]],['euphrates','Euphrates',606,204,[5,6]],['crossing','River crossing',374,67,[8]],['palmyra','Palmyra',571,251,[9]],['province','Province',365,110,[10]],['rome','Rome',167,164,[11,12]]];
  return `<figure class="campaign-geography"><svg viewBox="0 0 720 330" role="img" aria-label="Schematic journey from the Danube frontier through the eastern campaigns to Rome. Chapter details follow below."><rect width="720" height="330" fill="#dce0d2"/><path d="M0 0H720V156L647 154L610 179L576 170L546 192L492 187L472 151L413 154L416 193L382 183L351 151L329 164L310 144L280 136L277 185L250 197L219 178L235 161L215 131L187 117L164 118L175 152L209 194L200 215L177 198L151 167L131 130L87 132L53 161L0 148Z M0 251L123 240L192 271L277 284L351 269L431 299L527 288L555 250L598 226L634 174L720 163V330H0Z" fill="#c7b58e" stroke="#8a7049" stroke-width="1.3"/><path d="M181 61Q260 35 322 68T426 93" fill="none" stroke="#738f91" stroke-width="3"/><path d="M325 87L390 128L325 87L606 204L325 87L374 67L571 251L365 110L167 164" fill="none" stroke="#8a7049" stroke-width="2" stroke-dasharray="5 7"/>${sites.map(([slug,name,x,y,chapters])=>{const here=chapters.includes(current),done=chapters.some(n=>completed.includes(n)),active=selectedTheatre?selectedTheatre===slug:here;return `<g class="tabula-node${here?' current':done?' completed':''}${active?' selected':''}" data-theatre="${slug}" tabindex="0" role="button" aria-label="${name} theatre (Chapters ${chapters.join(', ')})">${active?`<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#6b2428" stroke-width="1.6" stroke-dasharray="3 2"/>`:''}<circle cx="${x}" cy="${y}" r="${here?8:6}" fill="${here?'#6b2428':done?'#4e6951':'#626357'}" stroke="#f4ead5" stroke-width="2"/><text x="${x+11}" y="${y-9}" font-size="15" fill="#292b26" font-family="Georgia,serif">${name}</text></g>`;}).join('')}<text x="257" y="238" font-size="18" letter-spacing="3" fill="#4c696a" font-family="Georgia,serif">MARE INTERNUM</text></svg><figcaption>Interactive Imperial Tabula · Select a theatre node or dossier below to inspect regional records. ● Current region · ✓ Completed chapters.</figcaption></figure>`;
}
