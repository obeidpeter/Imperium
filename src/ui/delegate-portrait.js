import {esc} from './view-helpers.js';

// Original code-drawn portrait medallions, not images of historical people.
// Identity controls the face, hair and toga; only the expression follows the
// current stance/Resolve. No random source, external assets or unique SVG IDs.
const hash=text=>{let n=2166136261;for(const char of text)n=Math.imul(n^char.charCodeAt(0),16777619)>>>0;return n;};
const SKIN=['#cb9c79','#d8b38f','#b98a68','#c48d69','#ddb99b','#aa7759'];
const HAIR=['#49382e','#756759','#a8a08d','#302a29','#655447'];
const TRIM={Veterans:'#9e5340',Landholders:'#8a7041',Civic:'#427e86',Chamber:'#735983'};

export function delegatePortrait(person={}, {decorative=false}={}){
  const n=hash(`${person.id??''}|${person.name??''}|${person.bloc??person.side??''}`),skin=SKIN[n%SKIN.length],hair=HAIR[(n>>>4)%HAIR.length];
  const trim=TRIM[person.bloc]??(person.side==='enemy'?'#895f86':'#547b73'),broad=11+(n>>>9)%4,eyes=5+(n>>>14)%3;
  const positive=person.role==='voter'?person.stance>=1:person.resolve>Math.max(1,person.maxResolve??10)/2;
  const expression=person.role==='voter'?(positive?'supports the motion':'opposes the motion'):person.resolve<=0?'withdrawn':positive?'composed':'under pressure';
  const hairStyle=(n>>>18)%4,mouth=positive?'M27 39 Q32 43 37 39':'M27 41 Q32 38 37 41';
  const beard=(n>>>22)%3===0?`<path d="M${32-broad} 32 Q${32-broad} 48 32 49 Q${32+broad} 47 ${32+broad} 32 L39 39 Q32 45 25 39Z" fill="${hair}" opacity=".8"/>`:'';
  const locks=[`M${32-broad} 28 Q15 10 32 11 Q49 10 ${32+broad} 28 L42 20 Q30 15 22 23Z`,
    `M${32-broad} 30 Q15 14 26 12 L24 22Z M${32+broad} 30 Q49 14 38 12 L40 22Z`,
    `M${32-broad} 26 Q15 10 34 10 Q49 13 ${32+broad} 26 L39 18 L33 22 L27 18 L21 25Z`,
    `M${32-broad} 27 Q17 14 26 12 Q32 17 38 12 Q48 14 ${32+broad} 27 L40 21 Q31 19 24 22Z`][hairStyle];
  return `<svg class="delegate-portrait" viewBox="0 0 64 72" width="56" height="63" ${decorative?'aria-hidden="true"':`role="img" aria-label="${esc(`Portrait of ${person.name??'the delegate'}: ${expression}.`)}"`} focusable="false" xmlns="http://www.w3.org/2000/svg">`+
    `<rect x="1" y="1" width="62" height="70" rx="17" fill="#273737" stroke="#a99161"/>`+
    `<path d="M6 70 Q8 49 25 47 L39 47 Q56 49 58 70Z" fill="#d9d0b6"/><path d="M39 47 L51 54 L42 71 L29 71Z" fill="${trim}"/>`+
    `<path d="M22 50 Q27 57 43 59 M14 58 Q22 65 34 66" fill="none" stroke="#968d77" stroke-width="1.4"/>`+
    `<path d="M27 42 L26 50 Q32 55 38 50 L37 42Z" fill="${skin}"/><ellipse cx="32" cy="29" rx="${broad}" ry="19" fill="${skin}"/>`+
    `<path d="${locks}" fill="${hair}"/>${beard}`+
    `<path d="M${30-eyes} 27 l5 ${positive?-1:1} M${34+eyes} 27 l-5 ${positive?-1:1}" stroke="${hair}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`+
    `<ellipse cx="${32-eyes}" cy="30" rx="1.4" ry="1.2" fill="#302b28"/><ellipse cx="${32+eyes}" cy="30" rx="1.4" ry="1.2" fill="#302b28"/>`+
    `<path d="M32 29 L30 36 L34 36" stroke="#96654d" fill="none" stroke-width="1.2"/><path d="${mouth}" fill="none" stroke="#6e4237" stroke-width="1.5" stroke-linecap="round"/>`+
    `<circle cx="45" cy="55" r="3" fill="#c9a665" stroke="#715b38"/></svg>`;
}
