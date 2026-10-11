// Presentation assets never infer or award campaign milestones.
export function heroPortrait(rank='Tiro') {
  const r=rank.toLowerCase();
  const stage=r==='augustus'?'emperor':r==='senator'?'senator':/praeses|governor|candidate/.test(r)?'governor':/praefectus|praepositus|acting commander|dux/.test(r)?'prefect':/centurio|primus/.test(r)?'centurion':r==='tiro'?'recruit':'miles';
  return `./assets/portraits/hero-${stage}.webp`;
}
export function speakerPortrait(speaker='') {
  const names={mentor:'varro',comrade:'lucan',rival:'crispus',patron:'severianus',settler:'aelia',senator:'paullus'};
  const key=names[speaker]||['varro','lucan','crispus','severianus','aelia','paullus','sabinus'].find(n=>speaker.toLowerCase().includes(n));
  return key?`./assets/portraits/${key}.webp`:null;
}
export function chapterScene(chapter=1) {
  const scenes=['danube','marsh','danube','danube','eastern-fort','eastern-fort','danube','river-crossing','eastern-fort','province','rome','rome'];
  return `./assets/scenes/${scenes[chapter-1]||'danube'}.webp`;
}
export function loadArt(src) {
  return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;});
}
export function journeyMap(current,completed=[]) {
  const sites=[['Danube',325,87,[1,3,4,7]],['Abritus',390,128,[2]],['Euphrates',606,204,[5,6]],['River crossing',374,67,[8]],['Palmyra',571,251,[9]],['Province',365,110,[10]],['Rome',167,164,[11,12]]];
  return `<figure class="campaign-geography"><svg viewBox="0 0 720 330" role="img" aria-label="Schematic journey from the Danube frontier through the eastern campaigns to Rome. Chapter details follow below."><rect width="720" height="330" fill="#dce0d2"/><path d="M0 0H720V156L647 154L610 179L576 170L546 192L492 187L472 151L413 154L416 193L382 183L351 151L329 164L310 144L280 136L277 185L250 197L219 178L235 161L215 131L187 117L164 118L175 152L209 194L200 215L177 198L151 167L131 130L87 132L53 161L0 148Z M0 251L123 240L192 271L277 284L351 269L431 299L527 288L555 250L598 226L634 174L720 163V330H0Z" fill="#c7b58e" stroke="#8a7049" stroke-width="1.3"/><path d="M181 61Q260 35 322 68T426 93" fill="none" stroke="#738f91" stroke-width="3"/><path d="M325 87L390 128L325 87L606 204L325 87L374 67L571 251L365 110L167 164" fill="none" stroke="#8a7049" stroke-width="2" stroke-dasharray="5 7"/>${sites.map(([name,x,y,chapters])=>{const here=chapters.includes(current),done=chapters.some(n=>completed.includes(n));return `<g><circle cx="${x}" cy="${y}" r="${here?8:5}" fill="${here?'#6b2428':done?'#4e6951':'#626357'}" stroke="#f4ead5" stroke-width="2"/><text x="${x+11}" y="${y-9}" font-size="15" fill="#292b26" font-family="Georgia,serif">${name}</text></g>`;}).join('')}<text x="257" y="238" font-size="18" letter-spacing="3" fill="#4c696a" font-family="Georgia,serif">MARE INTERNUM</text></svg><figcaption>Schematic journey, not to scale. ● Current region · ✓ Completed chapters are recorded below.</figcaption></figure>`;
}
