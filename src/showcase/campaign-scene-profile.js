// Presentation metadata only. No campaign state or random generator is touched.
const regions=[
  ['Danube frontier','frontier','fort','#acbdba','#a1b1a7','#ffe4b4','#afc3cd','#859271',.017,1.10],
  ['Marshes after Abritus','wetland','marsh','#979f92','#98a091','#e1d9ba','#b9c1af','#747e65',.019,1.06],
  ['Danube road station','station','road-station','#aeb1a0','#aaa997','#f2d5a4','#bbc6bf','#968d74',.021,1.08],
  ['Fort above a Danube ford','fortress','stone-fort','#abb9bf','#a7b6b6','#f4e3bd','#becbd2','#879386',.018,1.08],
  ['Euphrates siege frontier','siege','eastern-fort','#c1ae91','#c2ad8d','#ffe0ae','#c6c6b4','#b29b79',.018,1.09],
  ['Retreat near Edessa','desert','desert-camp','#c4b69d','#cbb79a','#ffdda1','#c9d2d0','#b5a482',.018,1.10],
  ['The army before Milan','italy','legion-camp','#adbdc4','#afbebc','#ffe4bd','#c2d1d2','#8b9d7c',.015,1.08],
  ['Dacia and the Danube crossings','crossing','ferry','#9db3bb','#a4b9bb','#f7e0b4','#bed4d9','#859c8c',.021,1.10],
  ['Aurelian’s eastern campaign','palmyra','colonnaded-city','#c9b89d','#cebca1','#ffe6b3','#ced6d1','#baa986',.015,1.12],
  ['Dacia Aureliana','province','granary','#b0c3bf','#b4c2b6','#ffe8bb','#c6d8d0','#91a184',.016,1.08],
  ['Rome within Aurelian’s walls','rome','senate','#a4adb5','#a2aaad','#ffe0b0','#b9c8d0','#a99c88',.012,1.09],
  ['Rome and the rival armies','accession','imperial-road','#b7aba2','#b9aaa0','#ffd3a1','#c0c7d1','#a39682',.015,1.10]
];
const civicArchitecture={7:'command-council',8:'river-parley',10:'provincial-tribunal',11:'senate',12:'imperial-court'};
export function getSceneProfile(encounter={},options={}){
  const inferred=Number(/^ch(\d+)-/.exec(encounter.id??'')?.[1]),candidate=options.chapter??encounter.chapter??inferred,chapter=Number.isInteger(candidate)&&candidate>=1&&candidate<=12?candidate:1;
  const [region,setting,architecture,sky,fog,sun,ambient,groundTint,fogDensity,exposure]=regions[chapter-1],civic=encounter.kind==='contest',training=encounter.id==='ch1-training'||encounter.id==='ch1-drill'||encounter.type==='training'||encounter.mission?.mode==='training';
  const court=civic&&chapter>=10;
  return Object.freeze({key:`ch${chapter}-${civic?'civic':training?'training':'battle'}`,chapter,title:encounter.title||`${region}${civic?' — council':''}`,region,setting,civic,training,architecture:civic?(civicArchitecture[chapter]??'provincial-tribunal'):architecture,
    sky:court?'#8a8174':sky,fog:court?'#928779':fog,sun,ambient:court?'#ded4be':ambient,groundTint,fogDensity:court?.006:fogDensity,exposure:court?1.12:exposure,sunIntensity:chapter===2?2.55:court?2.4:3.3,ambientIntensity:court?2.15:2.1,ambientGround:court?'#9c8871':'#60694f',sunPosition:Object.freeze(chapter===2?[-12,18,-8]:court?[-9,22,-9]:[-16,24,-12]),
    vegetation:['desert','siege','palmyra'].includes(setting)?'arid':setting==='wetland'?'reeds':civic?'court':'meadow',soilMix:['desert','siege','palmyra'].includes(setting)?.85:setting==='wetland'?.62:.18,
    distantWater:['frontier','wetland','fortress','crossing','province'].includes(setting)&&(!civic||chapter===8),stoneColor:chapter===5?'#c7b08a':chapter>=9?'#d5c8ab':'#bab9ad',waterColor:chapter===2?'#59766e':'#608f94'});
}
export const getCampaignSceneProfile=getSceneProfile;
