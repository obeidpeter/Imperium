// The painted campaign map: paper, washed land with a hand-inked coast,
// hatched mountain chains, and the career route drawn chapter by chapter in
// ink. Completed legs are solid, the leg into the current chapter draws itself
// (a CSS animation that reduced motion simply skips: the resting state is
// fully drawn), and legs still ahead are faint. Pure SVG: no download.
// Each theatre: slug, name, position, chapters, and the side its name sits on, clear of
// the routes that meet there.
export const THEATRES=Object.freeze([['danube','Danube',325,87,[1,3,4],'w'],['abritus','Abritus',330,124,[2],'w'],['euphrates','Euphrates',606,204,[5,6],'ne'],
  ['milan','Milan',140,106,[7],'nw'],['crossing','River crossing',374,67,[8],'ne'],['palmyra','Palmyra',571,251,[9],'sw'],['province','Province',360,130,[10],'ne'],['rome','Rome',167,164,[11,12],'w']]);
const LABEL={ne:[14,-10,'start'],nw:[-14,-10,'end'],se:[14,20,'start'],sw:[-14,20,'end'],e:[16,5,'start'],w:[-16,5,'end']};
const ROMAN=['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
// Where the plain drawing would crowd: the long eastern leg bows wider round the Danube
// theatres, and some numerals stand further along their legs, or inside the bow, where
// another route or a name would crowd the middle.
const LEG_STYLE={2:{at:.6},3:{at:.6},5:{bow:.2},9:{at:.58,side:-1},10:{at:.35},11:{at:.72}};
const site=chapter=>THEATRES.find(t=>t[4].includes(chapter));
// One leg per change of theatre, labelled with the chapter it leads into.
export function careerLegs(){
  const legs=[];
  for(let chapter=2;chapter<=12;chapter++){const from=site(chapter-1),to=site(chapter);if(from&&to&&from!==to)legs.push({chapter,from:from[0],to:to[0],a:[from[2],from[3]],b:[to[2],to[3]]});}
  return legs;
}
export function legStatus(leg,current,completed=[]){return completed.includes(leg.chapter)||leg.chapter<current?'done':leg.chapter===current?'current':'ahead';}
// Advance of each numeral letter in the route's 11-unit italic serif.
const GLYPH={I:4.3,V:7.4,X:7.6};
function arc([x1,y1],[x2,y2],bend,numeral,{at=.5,side=1}={}){
  const mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy)||1,cx=mx-dy/length*length*bend,cy=my+dx/length*length*bend;
  let total=0,px=x1,py=y1;for(let i=1;i<=16;i++){const t=i/16,qx=(1-t)*(1-t)*x1+2*(1-t)*t*cx+t*t*x2,qy=(1-t)*(1-t)*y1+2*(1-t)*t*cy+t*t*y2;total+=Math.hypot(qx-px,qy-py);px=qx;py=qy;}
  // The numeral stands beside the line (outside the bow unless side is -1), far enough along
  // the normal that its whole box, not just its centre, clears the line whichever way it runs.
  const nx=-dy/length*Math.sign(bend||1)*side,ny=dx/length*Math.sign(bend||1)*side;
  const away=Math.abs(nx)*([...numeral].reduce((w,c)=>w+GLYPH[c],0)/2+2)+Math.abs(ny)*5.5+3.5;
  const qx=(1-at)*(1-at)*x1+2*(1-at)*at*cx+at*at*x2,qy=(1-at)*(1-at)*y1+2*(1-at)*at*cy+at*at*y2;
  return {d:`M${x1} ${y1}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`,length:Math.ceil(total),mid:[qx+nx*away,qy+ny*away]};
}
const chevrons=(points)=>points.map(([x,y,s=1])=>`M${x-5*s} ${y+3*s}L${x} ${y-4*s}L${x+5*s} ${y+3*s}`).join('');
// The landing page shows the whole route as an illustration: its own ids (the Menu can
// open a second map over it), no theatre buttons and its own words.
export function paintedJourneyMap(current,completed=[],selectedTheatre=null,{ids='tabula',interactive=true,label=null,caption=null}={}){
  // Every leg bows to the left of its direction of travel, so a journey back never retraces
  // the way out; short legs bow at least enough to keep the two apart.
  const legs=careerLegs().map(leg=>{const style=LEG_STYLE[leg.chapter]??{},bow=style.bow??Math.max(.12,14/Math.hypot(leg.b[0]-leg.a[0],leg.b[1]-leg.a[1]));
    return {...leg,...arc(leg.a,leg.b,-bow,ROMAN[leg.chapter],style),status:legStatus(leg,current,completed)};});
  const nodes=THEATRES.map(([slug,name,x,y,chapters,side])=>{
    const [lx,ly,anchor]=LABEL[side];
    const here=chapters.includes(current),done=chapters.some(n=>completed.includes(n)),active=selectedTheatre?selectedTheatre===slug:here;
    return `<g class="tabula-node${here?' current':done?' completed':''}${active?' selected':''}" data-theatre="${slug}"${interactive?` tabindex="0" role="button" aria-label="${name} theatre (Chapters ${chapters.join(', ')})"`:''}>${active?`<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#6b2428" stroke-width="1.6" stroke-dasharray="3 2"/>`:''}<circle cx="${x}" cy="${y}" r="${here?8.5:6.5}" fill="${here?'#7a2a2c':done?'#4e6951':'#6b6a5c'}" stroke="#f4ead5" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${here?3.2:2.4}" fill="#f4ead5" opacity=".55"/><text class="tabula-name" x="${x+lx}" y="${y+ly}" text-anchor="${anchor}" font-size="15" fill="#2b2a24" font-family="Georgia,serif" font-style="italic">${name}</text></g>`;
  }).join('');
  const route=legs.map(leg=>`<path class="career-leg ${leg.status}" d="${leg.d}" style="--len:${leg.length}px" filter="url(#${ids}-ink)"/>`).join('');
  const numerals=legs.filter(leg=>leg.status!=='ahead').map(leg=>`<text class="career-numeral" x="${leg.mid[0].toFixed(1)}" y="${(leg.mid[1]+3.8).toFixed(1)}">${ROMAN[leg.chapter]}</text>`).join('');
  const land='M0 0H720V156L647 154L610 179L576 170L546 192L492 187L472 151L413 154L416 193L382 183L351 151L329 164L310 144L280 136L277 185L250 197L219 178L235 161L215 131L187 117L164 118L175 152L209 194L200 215L177 198L151 167L131 130L87 132L53 161L0 148Z M0 251L123 240L192 271L277 284L351 269L431 299L527 288L555 250L598 226L634 174L720 163V330H0Z';
  return `<figure class="campaign-geography painted-tabula"><svg viewBox="0 0 720 330" role="img" aria-label="${label??'Painted map of the career from the Danube frontier through the eastern campaigns to Rome. Completed legs are inked; chapter details follow below.'}">
<defs>
<filter id="${ids}-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .42 0 0 0 0 .34 0 0 0 0 .22 0 0 0 .2 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="${ids}-wash" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7"/><feGaussianBlur stdDeviation=".6"/></filter>
<filter id="${ids}-ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter>
<linearGradient id="${ids}-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d5cc"/><stop offset="1" stop-color="#b3c4be"/></linearGradient>
<pattern id="${ids}-ripples" width="34" height="18" patternUnits="userSpaceOnUse"><path d="M3 12q5-4 10 0M19 5q5-4 10 0" fill="none" stroke="#7f9893" stroke-width=".8" opacity=".55"/></pattern>
</defs>
<rect width="720" height="330" fill="url(#${ids}-sea)"/><rect width="720" height="330" fill="url(#${ids}-ripples)"/>
<path d="${land}" fill="#d6c39a" filter="url(#${ids}-wash)"/>
<path d="${land}" fill="none" stroke="#a88d61" stroke-width="7" opacity=".35" filter="url(#${ids}-wash)"/>
<path d="${land}" fill="none" stroke="#6d5638" stroke-width="1.3" filter="url(#${ids}-ink)"/>
<path class="tabula-mountains" d="${chevrons([[196,112],[210,107,1.1],[224,104],[238,108,.9],[252,113],[372,140,.9],[386,137],[400,141,.9],[414,146,.8],[522,180],[536,177,1.1],[550,181],[564,186,.9]])}" filter="url(#${ids}-ink)"/>
<path d="M181 61Q260 35 322 68T426 93" fill="none" stroke="#5f7f82" stroke-width="2.6" filter="url(#${ids}-ink)"/><path d="M598 158Q612 182 606 204T628 246" fill="none" stroke="#5f7f82" stroke-width="2.2" filter="url(#${ids}-ink)"/>
<g class="career-route">${route}${numerals}</g>
<text x="257" y="238" font-size="18" letter-spacing="3" fill="#4c696a" font-family="Georgia,serif" font-style="italic">MARE INTERNUM</text>
<text x="168" y="196" class="tabula-region">ITALIA</text><text x="352" y="38" class="tabula-region">DACIA</text><text x="596" y="270" class="tabula-region">SYRIA</text><text x="586" y="128" class="tabula-region">MESOPOTAMIA</text>
<g class="tabula-compass" transform="translate(674 290)"><circle r="16" fill="none" stroke="#6d5638" stroke-width=".9"/><path d="M0 -20L4 0L0 20L-4 0Z" fill="#6d5638" opacity=".75"/><text y="-23" text-anchor="middle" font-size="9" fill="#4a3c28" font-family="Georgia,serif">N</text></g>
${nodes}
<rect width="720" height="330" fill="#fff" opacity=".9" filter="url(#${ids}-paper)" pointer-events="none"/>
</svg><figcaption>${caption??'Interactive Imperial Tabula · The inked route is your career so far; the leg into this chapter is being drawn. Select a theatre node or dossier below to inspect regional records. ● Current region · ✓ Completed chapters.'}</figcaption></figure>`;
}
