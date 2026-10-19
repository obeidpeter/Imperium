// The painted campaign map: paper, washed land with a hand-inked coast,
// hatched mountain chains, and the career route drawn chapter by chapter in
// ink. Completed legs are solid, the leg into the current chapter draws itself
// (a CSS animation that reduced motion simply skips: the resting state is
// fully drawn), and legs still ahead are faint. Pure SVG: no download.
export const THEATRES=Object.freeze([['danube','Danube',325,87,[1,3,4,7]],['abritus','Abritus',390,128,[2]],['euphrates','Euphrates',606,204,[5,6]],['crossing','River crossing',374,67,[8]],['palmyra','Palmyra',571,251,[9]],['province','Province',365,110,[10]],['rome','Rome',167,164,[11,12]]]);
const ROMAN=['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const site=chapter=>THEATRES.find(t=>t[4].includes(chapter));
// One leg per change of theatre, labelled with the chapter it leads into.
export function careerLegs(){
  const legs=[];
  for(let chapter=2;chapter<=12;chapter++){const from=site(chapter-1),to=site(chapter);if(from&&to&&from!==to)legs.push({chapter,from:from[0],to:to[0],a:[from[2],from[3]],b:[to[2],to[3]]});}
  return legs;
}
export function legStatus(leg,current,completed=[]){return completed.includes(leg.chapter)||leg.chapter<current?'done':leg.chapter===current?'current':'ahead';}
function arc([x1,y1],[x2,y2],bend){
  const mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy)||1,cx=mx-dy/length*length*bend,cy=my+dx/length*length*bend;
  let total=0,px=x1,py=y1;for(let i=1;i<=16;i++){const t=i/16,qx=(1-t)*(1-t)*x1+2*(1-t)*t*cx+t*t*x2,qy=(1-t)*(1-t)*y1+2*(1-t)*t*cy+t*t*y2;total+=Math.hypot(qx-px,qy-py);px=qx;py=qy;}
  // The numeral sits just outside the curve's bulge, clear of the line itself.
  const ox=-dy/length*Math.sign(bend||1)*9,oy=dx/length*Math.sign(bend||1)*9;
  return {d:`M${x1} ${y1}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`,length:Math.ceil(total),mid:[(x1+2*cx+x2)/4+ox,(y1+2*cy+y2)/4+oy]};
}
const chevrons=(points)=>points.map(([x,y,s=1])=>`M${x-5*s} ${y+3*s}L${x} ${y-4*s}L${x+5*s} ${y+3*s}`).join('');
export function paintedJourneyMap(current,completed=[],selectedTheatre=null){
  const legs=careerLegs().map((leg,i)=>({...leg,...arc(leg.a,leg.b,i%2?.12:-.12),status:legStatus(leg,current,completed)}));
  const nodes=THEATRES.map(([slug,name,x,y,chapters])=>{
    const here=chapters.includes(current),done=chapters.some(n=>completed.includes(n)),active=selectedTheatre?selectedTheatre===slug:here;
    return `<g class="tabula-node${here?' current':done?' completed':''}${active?' selected':''}" data-theatre="${slug}" tabindex="0" role="button" aria-label="${name} theatre (Chapters ${chapters.join(', ')})">${active?`<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#6b2428" stroke-width="1.6" stroke-dasharray="3 2"/>`:''}<circle cx="${x}" cy="${y}" r="${here?8.5:6.5}" fill="${here?'#7a2a2c':done?'#4e6951':'#6b6a5c'}" stroke="#f4ead5" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${here?3.2:2.4}" fill="#f4ead5" opacity=".55"/><text x="${x+11}" y="${y-9}" font-size="15" fill="#2b2a24" font-family="Georgia,serif" font-style="italic">${name}</text></g>`;
  }).join('');
  const route=legs.map(leg=>`<path class="career-leg ${leg.status}" d="${leg.d}" style="--len:${leg.length}px" filter="url(#tabula-ink)"/>`).join('');
  const numerals=legs.filter(leg=>leg.status!=='ahead').map(leg=>`<text class="career-numeral" x="${leg.mid[0].toFixed(1)}" y="${(leg.mid[1]-4).toFixed(1)}">${ROMAN[leg.chapter]}</text>`).join('');
  const land='M0 0H720V156L647 154L610 179L576 170L546 192L492 187L472 151L413 154L416 193L382 183L351 151L329 164L310 144L280 136L277 185L250 197L219 178L235 161L215 131L187 117L164 118L175 152L209 194L200 215L177 198L151 167L131 130L87 132L53 161L0 148Z M0 251L123 240L192 271L277 284L351 269L431 299L527 288L555 250L598 226L634 174L720 163V330H0Z';
  return `<figure class="campaign-geography painted-tabula"><svg viewBox="0 0 720 330" role="img" aria-label="Painted map of the career from the Danube frontier through the eastern campaigns to Rome. Completed legs are inked; chapter details follow below.">
<defs>
<filter id="tabula-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .42 0 0 0 0 .34 0 0 0 0 .22 0 0 0 .2 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="tabula-wash" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7"/><feGaussianBlur stdDeviation=".6"/></filter>
<filter id="tabula-ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter>
<linearGradient id="tabula-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d5cc"/><stop offset="1" stop-color="#b3c4be"/></linearGradient>
<pattern id="tabula-ripples" width="34" height="18" patternUnits="userSpaceOnUse"><path d="M3 12q5-4 10 0M19 5q5-4 10 0" fill="none" stroke="#7f9893" stroke-width=".8" opacity=".55"/></pattern>
</defs>
<rect width="720" height="330" fill="url(#tabula-sea)"/><rect width="720" height="330" fill="url(#tabula-ripples)"/>
<path d="${land}" fill="#d6c39a" filter="url(#tabula-wash)"/>
<path d="${land}" fill="none" stroke="#a88d61" stroke-width="7" opacity=".35" filter="url(#tabula-wash)"/>
<path d="${land}" fill="none" stroke="#6d5638" stroke-width="1.3" filter="url(#tabula-ink)"/>
<path class="tabula-mountains" d="${chevrons([[196,112],[210,107,1.1],[224,104],[238,108,.9],[252,113],[372,140,.9],[386,137],[400,141,.9],[414,146,.8],[522,180],[536,177,1.1],[550,181],[564,186,.9]])}" filter="url(#tabula-ink)"/>
<path d="M181 61Q260 35 322 68T426 93" fill="none" stroke="#5f7f82" stroke-width="2.6" filter="url(#tabula-ink)"/><path d="M598 158Q612 182 606 204T628 246" fill="none" stroke="#5f7f82" stroke-width="2.2" filter="url(#tabula-ink)"/>
<g class="career-route">${route}${numerals}</g>
<text x="257" y="238" font-size="18" letter-spacing="3" fill="#4c696a" font-family="Georgia,serif" font-style="italic">MARE INTERNUM</text>
<text x="168" y="196" class="tabula-region">ITALIA</text><text x="352" y="38" class="tabula-region">DACIA</text><text x="596" y="270" class="tabula-region">SYRIA</text><text x="520" y="146" class="tabula-region">MESOPOTAMIA</text>
<g class="tabula-compass" transform="translate(674 290)"><circle r="16" fill="none" stroke="#6d5638" stroke-width=".9"/><path d="M0 -20L4 0L0 20L-4 0Z" fill="#6d5638" opacity=".75"/><text y="-23" text-anchor="middle" font-size="9" fill="#4a3c28" font-family="Georgia,serif">N</text></g>
${nodes}
<rect width="720" height="330" fill="#fff" opacity=".9" filter="url(#tabula-paper)" pointer-events="none"/>
</svg><figcaption>Interactive Imperial Tabula · The inked route is your career so far; the leg into this chapter is being drawn. Select a theatre node or dossier below to inspect regional records. ● Current region · ✓ Completed chapters.</figcaption></figure>`;
}
