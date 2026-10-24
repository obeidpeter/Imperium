import {getEncounterStaging} from './environment-staging.js';
import {chapterWeather,chapterTimeOfDay} from '../ui/chapter-weather.js';
import {regionalEnvironment} from './environment-regions.js';
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
// Campaign colour script: one grade and light balance per chapter, read in
// order as the career moves from Danube dawns to the imperial purple.
// shadow/highlight are linear multipliers split by luminance; haze is the
// aerial colour beyond the board; ambient/sun scale the base light balance.
const grade=(saturation,contrast,shadow,highlight,haze,ambient,sun,rim,rimIntensity)=>Object.freeze({saturation,contrast,shadow:Object.freeze(shadow),highlight:Object.freeze(highlight),haze,ambient,sun,rim,rimIntensity});
const GRADES=[
  grade(1.02,1.10,[0.92,0.99,1.10],[1.06,1.01,0.92],'#b8c6c2',.78,1.08,'#cfe2ee',.55), // Danube dawn mist
  grade(0.86,1.06,[0.92,1.00,1.04],[1.00,1.01,0.98],'#9fa99b',.85,.95,'#c2d0cc',.45),  // rain after Abritus
  grade(0.96,1.08,[0.95,0.99,1.06],[1.04,1.00,0.94],'#b9b9a8',.80,1.05,'#d6dcd8',.50), // overcast road station
  grade(1.00,1.12,[0.92,0.98,1.10],[1.05,1.01,0.93],'#b7c6cc',.78,1.10,'#d2e3ee',.55), // clear fort above the ford
  grade(1.06,1.08,[1.00,0.95,1.04],[1.12,1.02,0.88],'#d0b391',.92,1.12,'#ffc98f',.65), // Euphrates siege dusk
  grade(1.04,1.08,[1.02,0.96,0.95],[1.12,1.02,0.86],'#d1b896',.90,1.12,'#ffcf96',.60), // dust of the Edessa retreat
  grade(1.05,1.10,[0.95,0.97,1.06],[1.07,1.01,0.90],'#bcc8c8',.78,1.10,'#f6e2c0',.55), // Italian light before Milan
  grade(1.00,1.08,[0.92,0.97,1.12],[1.08,0.98,0.92],'#b4c3cb',.80,1.05,'#ffd6c2',.60), // dawn at the crossings
  grade(1.06,1.16,[1.00,0.95,0.92],[1.06,1.02,0.90],'#d6c6a6',.74,1.14,'#fff0cc',.60), // Palmyrene noon
  grade(1.06,1.10,[0.96,0.98,1.04],[1.08,1.02,0.88],'#c3cdbd',.78,1.10,'#ffe6b8',.55), // provincial harvest
  grade(0.96,1.08,[0.95,0.98,1.05],[1.03,1.01,0.96],'#b4b8bc',.82,1.05,'#e9eef2',.45), // Rome, marble and stone
  grade(1.05,1.10,[1.02,0.96,1.08],[1.12,1.02,0.88],'#c8b4a8',.88,1.12,'#ffd09a',.65)  // the purple at dusk
];
const NIGHT_GRADE=grade(0.85,1.12,[0.90,0.96,1.14],[1.08,0.98,0.86],'#2d3c58',.90,1.00,'#9eb8dc',.50);
const COURT_GRADE=grade(0.97,1.08,[0.97,0.97,1.03],[1.05,1.01,0.94],'#a59c8d',.90,1.00,'#f2e6d0',.40);
export function sceneGrade(chapter,{night=false,court=false}={}){return night?NIGHT_GRADE:court?COURT_GRADE:GRADES[Math.max(1,Math.min(12,chapter))-1];}
// Where the sun stands (its offset from what it lights, in metres): high by day,
// low in the east at dawn (II, VIII) and in the west at dusk (V, VI, XII), with
// long shadows. Chapter II's dawn is overcast, so its sun stands a little higher
// and its light is weaker. A low sun is warmer and dimmer.
export const SUN_POSITIONS=Object.freeze({day:Object.freeze([-16,24,-12]),dawn:Object.freeze([17,6.5,-10]),dusk:Object.freeze([-18,6,-8]),
  overcastDawn:Object.freeze([16,9,-9]),night:Object.freeze([-10,20,-14]),court:Object.freeze([-9,22,-9])});
const LOW_SUN=Object.freeze({dawn:Object.freeze({color:'#ffcf9e',warmth:.3,intensity:.88}),dusk:Object.freeze({color:'#ffb877',warmth:.38,intensity:.85})});
const blend=(a,b,t)=>{const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16),c=k=>Math.round(((x>>k)&255)*(1-t)+((y>>k)&255)*t);return '#'+[16,8,0].map(k=>c(k).toString(16).padStart(2,'0')).join('');};
export function getSceneProfile(encounter={},options={}){
  const inferred=Number(/^ch(\d+)-/.exec(encounter.id??'')?.[1]),candidate=options.chapter??encounter.chapter??inferred,chapter=Number.isInteger(candidate)&&candidate>=1&&candidate<=12?candidate:1;
  const [region,setting,architecture,sky,fog,sun,ambient,groundTint,fogDensity,exposure]=regions[chapter-1],civic=encounter.kind==='contest',training=encounter.id==='ch1-training'||encounter.id==='ch1-drill'||encounter.type==='training'||encounter.mission?.mode==='training';
  const court=civic&&chapter>=10,stratagem=options.stratagem??encounter.stratagem??null;
  const night=Boolean(!civic&&(stratagem==='night'||options.timeOfDay==='night'||encounter.timeOfDay==='night'));
  const timeOfDay=night?'night':civic?'interior':chapterTimeOfDay(chapter);
  const weather=civic?'clear':options.weather??encounter.weather??chapterWeather(chapter);
  return Object.freeze({key:`ch${chapter}-${civic?'civic':training?'training':night?'night':'battle'}`,chapter,grade:sceneGrade(chapter,{night,court}),title:encounter.title||`${region}${civic?' — council':''}`,region,setting,civic,training,timeOfDay,weather,torchlight:night||civic&&chapter===7,staging:getEncounterStaging(encounter,{chapter,civic,training}),architecture:civic?(civicArchitecture[chapter]??'provincial-tribunal'):architecture,
    sky:night?'#1d2b44':court?'#8a8174':sky,fog:night?'#24324c':court?'#928779':fog,sun:night?'#9eb8dc':LOW_SUN[timeOfDay]?blend(sun,LOW_SUN[timeOfDay].color,LOW_SUN[timeOfDay].warmth):sun,ambient:night?'#4d6282':court?'#ded4be':ambient,groundTint:night?'#3e4c5e':groundTint,fogDensity:night?.025:court?.006:fogDensity,exposure:night?.92:court?1.12:exposure,sunIntensity:night?1.45:chapter===2?2.55:court?2.4:3.3*(LOW_SUN[timeOfDay]?.intensity??1),ambientIntensity:night?1.35:court?2.15:2.1,ambientGround:night?'#25303f':court?'#9c8871':'#60694f',sunPosition:night?SUN_POSITIONS.night:court?SUN_POSITIONS.court:chapter===2&&!civic?SUN_POSITIONS.overcastDawn:SUN_POSITIONS[timeOfDay]??SUN_POSITIONS.day,
    artDirection:regionalEnvironment(chapter),
    vegetation:['desert','siege','palmyra'].includes(setting)?'arid':setting==='wetland'?'reeds':civic?'court':'meadow',soilMix:['desert','siege','palmyra'].includes(setting)?.85:setting==='wetland'?.62:.18,
    distantWater:['frontier','wetland','fortress','crossing','province'].includes(setting)&&(!civic||chapter===8),stoneColor:chapter===5?'#c7b08a':chapter>=9?'#d5c8ab':'#bab9ad',waterColor:night?'#2c475c':chapter===2?'#59766e':'#608f94'});
}
export const getCampaignSceneProfile=getSceneProfile;
