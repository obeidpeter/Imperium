// Original character direction, independent of allegiance and gameplay state.
// Shared skull landmarks remain recognizable as the protagonist ages.
const years=[0,1,3,4,6,10,12,21,22,24,25,26];
const named={
  varro:{key:'varro',age:49,jaw:1.17,cheek:1.06,nose:1.14,brow:1.2,eyes:.96,mouth:1.03,build:1.06,hair:'cropped',beard:.65,grey:.65,skin:0xb17b57},
  lucan:{key:'lucan',age:20,jaw:1.09,cheek:1.12,nose:.88,brow:.88,eyes:1.03,mouth:1.12,build:1.04,hair:'wavy',beard:0,grey:0,skin:0xc09068},
  crispus:{key:'crispus',age:27,jaw:.91,cheek:.94,nose:1.18,brow:1.05,eyes:.95,mouth:.88,build:.95,hair:'swept',beard:.12,grey:.05,skin:0xc69976},
  severianus:{key:'severianus',age:39,jaw:1.12,cheek:1.08,nose:1.08,brow:1.12,eyes:.97,mouth:1.05,build:1.08,hair:'receding',beard:.7,grey:.28,skin:0xae7d59},
  paullus:{key:'paullus',age:57,jaw:1.03,cheek:1.04,nose:1.2,brow:.96,eyes:.96,mouth:.95,build:1.07,hair:'receding',beard:.5,grey:.9,skin:0xc39a77},
  aelia:{key:'aelia',age:35,jaw:.84,cheek:1.04,nose:.88,brow:.82,eyes:1.04,mouth:.98,build:.94,hair:'bound',beard:0,grey:.08,skin:0xbe8d6b,female:true},
  sabinus:{key:'sabinus',age:29,jaw:1.13,cheek:.98,nose:1.03,brow:1.12,eyes:.98,mouth:.96,build:1.08,hair:'cropped',beard:.45,grey:.10,skin:0xad7858}
  ,felix:{key:'felix',age:23,jaw:.94,cheek:1.08,nose:.91,brow:.93,eyes:1.06,mouth:1.02,build:.97,hair:'wavy',beard:.12,grey:0,skin:0xb98763}
  ,naso:{key:'naso',age:34,jaw:1.06,cheek:.96,nose:1.22,brow:1.13,eyes:.96,mouth:.94,build:1.03,hair:'receding',beard:.48,grey:.18,skin:0xb78764}
  ,brennus:{key:'brennus',age:30,jaw:1.18,cheek:1.12,nose:1.05,brow:1.18,eyes:.96,mouth:1.07,build:1.10,hair:'long',beard:.76,grey:.08,skin:0xc69b78}
  ,theon:{key:'theon',age:42,jaw:.92,cheek:.97,nose:1.12,brow:1.02,eyes:1.01,mouth:.94,build:.96,hair:'receding',beard:.58,grey:.3,skin:0xad7c58}
  ,quintus:{key:'quintus',age:28,jaw:1.08,cheek:1.04,nose:.98,brow:1.08,eyes:1.02,mouth:1.04,build:1.04,hair:'cropped',beard:.22,grey:.03,skin:0xbd8d68}
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// A name draws the person it names, never those he leads or keeps: "Lucan’s squad",
// "Felix’s archers" and "Crispus’s advocate" are not Lucan, Felix or Crispus.
export function castMember(text=''){
  for(const word of String(text).toLowerCase().split(/[^a-z’']+/))if(word&&!/[’']s$/.test(word)&&Object.hasOwn(named,word))return word;
  return null;
}
/** How much a named man has greyed and grown a beard since his own generated head was made
 * (at his first age): what the shared head's shader adds to his paint. */
export function castAgeing(identity){
  const p=named[identity?.key];if(!p)return {grey:0,beard:0};
  return {grey:Math.max(0,identity.grey-p.grey),beard:Math.max(0,identity.beard-Math.min(.9,p.beard+(p.age>27?.12:0)))};
}
export function actorIdentity(unit={},kit={}){
  const chapter=clamp(Math.trunc(Number(kit.chapter)||1),1,12),elapsed=years[chapter-1],key=castMember(unit.veteranId??unit.name);
  if(unit.id==='hero')return Object.freeze({key:'marcellus',age:20+elapsed,jaw:1,cheek:1,nose:1,brow:1.04,eyes:1,mouth:1,build:1,
    hair:unit.appearance?['cropped','curly','shaved','long'][unit.appearance.hair]??'cropped':'curly',
    beard:unit.appearance?[0,.4,.85][unit.appearance.beard]??0:elapsed<3?0:elapsed<10?.24:.62,
    customAppearance:!!unit.appearance,grey:clamp((elapsed-12)/26,0,.55),skin:0xbe8966,scar:chapter>=5});
  if(key){const p=named[key],age=p.age+(key==='lucan'?elapsed:Math.max(0,elapsed-10));return Object.freeze({...p,age,grey:clamp(p.grey+Math.max(0,age-p.age)*.012,0,1),beard:p.female?0:Math.min(.9,p.beard+(age>27?.12:0))});}
  const seed=kit.identity??0,variation=n=>((seed>>>n)&7)/7,age=24+Math.round(variation(9)*22),eastern=kit.eastern;
  return Object.freeze({key:`figure-${seed}`,age,jaw:.91+variation(0)*.23,cheek:.94+variation(3)*.16,nose:.9+variation(6)*.22,brow:.92+variation(12)*.18,eyes:.95+variation(15)*.1,mouth:.92+variation(18)*.16,build:.96+variation(21)*.09,hair:kit.faction==='Gothic'?'long':eastern?'wavy':age>40?'receding':'cropped',beard:kit.trainer?.4:eastern?.75:kit.faction==='Gothic'?.85:variation(6)>.5?.5:.1,grey:Math.max(0,age-35)/42,skin:eastern?0xb07e59:kit.faction==='Gothic'?0xc49a76:0xbb8966});
}
