import {storyWhen} from './campaign.js';
import {CAMP_CONTEXT,CAMP_SCENERY_PADS} from './camp-regions.js';
import {campStoryId,campStoryFor} from './camp-stories.js';
import {activityObjects} from './company-activities.js';

// The walkable camps and civic courts of all twelve chapters.
// Each camp is a coarse map in the battles' tiles, upsampled for real time
// like a battle's (k fine 2.5 m tiles a side), with the places the guide
// names, the people who stand there and the objects that open a
// conversation or a panel. Camps have no clock and nothing in them fights.
//
// Map letters: W palisade, R road, S paved court, C tent lines, . open ground,
// M marsh, F ford. People and objects stand at a place, offset in metres.

const freeze=value=>Object.freeze(value);
const LETTERS=freeze({W:'wall',R:'road',S:'stone',C:'camp','.':'grass',M:'marsh',F:'ford',K:'rock',D:'sand'});
const grid=rows=>freeze(rows.map(row=>freeze([...row].map(ch=>LETTERS[ch]))));

// The places every camp has; their order is the map panel's.
export const CAMP_PLACES=freeze(['gate','principia','quartermaster','drill','valetudinarium','barracks','canabae']);
export const PLACE_NAMES=freeze({gate:'Camp gate',principia:'Principia',quartermaster:'Quartermaster',drill:'Drill field',valetudinarium:'Valetudinarium',
  barracks:'Barracks',canabae:'Canabae'});
export const PLACE_HINTS=freeze({gate:'March out to the next encounter.',principia:'The commander’s table: the chapter’s decision and the War Council.',
  quartermaster:'Pay, kit and selling what you took from the field.',drill:'Trainers and the practice post.',valetudinarium:'The wounded, and when they return to duty.',
  barracks:'The company roll: who marches with you, and their standing orders.',canabae:'Traders, rumours and errands from civilians.'});

const routineFor=p=>p.id==='sentry'?'watch':p.id==='quartermaster'?'work':['orderly','capsarius'].includes(p.id)?'rest':p.id==='trader'?'carry':null;
const camp=data=>freeze({peaceful:true,sceneryPads:CAMP_SCENERY_PADS[data.chapter]??[],...data,purpose:CAMP_CONTEXT[data.chapter].purpose,
  placeNames:CAMP_CONTEXT[data.chapter].placeNames,...(data.placeNames?{placeNames:data.placeNames}:{}),
  reportTree:data.chapter===5?'ch5:report':'hub:report',
  terrain:grid(data.map),places:freeze(data.places),people:freeze(data.people.map(p=>freeze({...p,...(p.routine?{}:routineFor(p)?{routine:routineFor(p)}:{})}))),
  objects:freeze([...data.objects,...activityObjects(data.chapter),...(data.chapter<=3?[{id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[-2.5,0],talk:'hub:report'}]:[]),
    ...(campStoryFor(data.chapter)?[{id:'company-record',kind:'table',name:campStoryFor(data.chapter).title,place:'barracks',at:[-2,-1.5],talk:campStoryId(data.chapter)}]:[])].map(freeze))});

// The camp's standing staff, whom every later camp places in its own court.
const STAFF=freeze({
  instructor:{id:'instructor',name:'The veteran instructor',role:'campidoctor',place:'drill',talk:'hub:instructor'},
  clerk:{id:'clerk',name:'The duty clerk',role:'clerk',place:'principia',talk:'hub:clerk'},
  porter:{id:'porter',name:'The supply orderly',role:'orderly',place:'quartermaster',talk:'hub:porter',routine:'carry'},
  capsarius:{id:'capsarius',name:'Capsarius Didius',role:'capsarius',place:'valetudinarium',talk:'hub:capsarius',routine:'rest'},
  quartermaster:{id:'quartermaster',name:'Quartermaster Aper',role:'quartermaster',place:'quartermaster',talk:'hub:quartermaster',routine:'work'},
  steward:{id:'local-steward',name:'The local steward',role:'clerk',place:'canabae',talk:'hub:local'},
  sentry:{id:'sentry',name:'The gate sentry',role:'sentry',place:'gate',talk:'gate',routine:'watch'}});
const staff=(id,at,more={})=>({...STAFF[id],at,...more});
// The company's named men, each at his barracks place or, while he recovers, at his `ward` there.
const COMPANY=freeze({
  lucan:{id:'lucan',name:'Aurelius Lucan',role:'comrade',requires:['ch2','carry']},sabinus:{id:'sabinus',name:'Gaius Sabinus',role:'file-leader',requires:['ch2','leave']},
  naso:{id:'naso',name:'Aulus Naso',role:'legionary'},felix:{id:'felix',name:'Marcus Felix',role:'archer'}});
const veteran=(chapter,id,at,ward,more={})=>({...COMPANY[id],place:'barracks',at,ward,veteran:id,talk:`ch${chapter}:${id}`,...more});

export const CAMPS=freeze({
  1:camp({id:'ch1-camp',chapter:1,title:'The legionary base at Novae',scale:3,ground:'grass',entry:'gate',
    map:['WWWWWWWWWW',
         'WCCSSSCC.W',
         'WCCSSSCC.W',
         'WRRRRRRRRW',
         'W...R..CCW',
         'W...R..CCW',
         'WWWWRWWWWW',
         '....R.....'],
    places:{gate:[4,6.4],principia:[4,1.5],quartermaster:[7.5,2.2],drill:[2,4.5],valetudinarium:[7.5,4.5],barracks:[1.5,2],canabae:[6.5,7.4]},
    people:[
      {id:'varro',name:'Varro',role:'campidoctor',place:'drill',at:[2,0],talk:'ch1:varro'},
      {id:'lucan',name:'Aurelius Lucan',role:'comrade',place:'barracks',at:[1.5,1],talk:'ch1:lucan'},
      {id:'quartermaster',name:'Quartermaster Aper',role:'quartermaster',place:'quartermaster',at:[0,-2],talk:'ch1:quartermaster'},
      {id:'signifer',name:'Signifer Quintus',role:'standard-bearer',place:'principia',at:[-3,1],talk:'ch1:signifer'},
      {id:'orderly',name:'Orderly Mamertus',role:'orderly',place:'valetudinarium',at:[1,1],talk:'ch1:orderly'},
      {id:'trader',name:'Syra the sutler',role:'trader',place:'canabae',at:[1.5,0],talk:'ch1:trader'},
      {id:'sentry',name:'The gate sentry',role:'sentry',place:'gate',at:[2.2,-1.2],talk:'gate'}],
    objects:[
      {id:'table',kind:'table',name:'The commander’s table',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The practice post',place:'drill',at:[-2.5,1.5],talk:'ch1:post'},
      {id:'gate',kind:'gate',name:'The camp gate',place:'gate',at:[0,1.6],talk:'gate'}]}),
  2:camp({id:'ch2-camp',chapter:2,title:'The march camp on the causeway',scale:3,ground:'grass',entry:'gate',
    map:['WWWWWWWWWW',
         'W..SSS.CCW',
         'WCC.R..CCW',
         'WRRRRRRRRW',
         'W...R..MMW',
         'WCC.R..MMW',
         'WWWWRWWWWW',
         'MM..R..MMM'],
    places:{gate:[4,6.4],principia:[4,1.4],quartermaster:[7.5,1.6],drill:[2,4.3],valetudinarium:[7,5],barracks:[1.5,2.2],canabae:[5.6,7.4]},
    people:[
      {id:'varro',name:'Varro',role:'campidoctor',place:'drill',at:[1.5,0],talk:'ch2:varro'},
      {id:'lucan',name:'Aurelius Lucan',role:'comrade',place:'valetudinarium',at:[-1.5,0.5],talk:'ch2:lucan',absentAfter:['ch2','leave']},
      {id:'sabinus',name:'Gaius Sabinus',role:'file-leader',place:'barracks',at:[1.5,1],talk:'ch2:sabinus'},
      {id:'naso',name:'Aulus Naso',role:'legionary',place:'barracks',at:[-1.5,-1],talk:'ch2:naso'},
      {id:'capsarius',name:'Capsarius Didius',role:'capsarius',place:'valetudinarium',at:[1.5,-1],talk:'ch2:capsarius'},
      {id:'quartermaster',name:'Quartermaster Aper',role:'quartermaster',place:'quartermaster',at:[0,-1.5],talk:'ch2:quartermaster'},
      {id:'trader',name:'Syra the sutler',role:'trader',place:'canabae',at:[1.5,0],talk:'ch2:trader'},
      {id:'sentry',name:'The gate sentry',role:'sentry',place:'gate',at:[2.2,-1.2],talk:'gate'}],
    objects:[
      {id:'table',kind:'table',name:'The commander’s table',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The practice post',place:'drill',at:[-2.5,1.5],talk:'post'},
      {id:'shields',kind:'pile',name:'The broken shields',place:'barracks',at:[-2.5,1.5],talk:'ch2:shields'},
      {id:'gate',kind:'gate',name:'The camp gate',place:'gate',at:[0,1.6],talk:'gate'}]}),
  3:camp({id:'ch3-camp',chapter:3,title:'The camp below the road station',scale:3,ground:'grass',entry:'gate',
    map:['WWWWWWWWWW',
         'WCC.SSS..W',
         'WCC.SSSCCW',
         'WRRRRRRRRW',
         'W...R..CCW',
         'W...R.K..W',
         'WWWWRWWWWW',
         '....R..K..'],
    places:{gate:[4,6.4],principia:[5,1.5],quartermaster:[8,1.6],drill:[2,4.5],valetudinarium:[7.5,4.5],barracks:[1.5,1.6],canabae:[5.8,7.4]},
    people:[
      {id:'varro',name:'Varro',role:'campidoctor',place:'drill',at:[1.5,0],talk:'ch3:varro'},
      {id:'crispus',name:'Tribune Crispus',role:'tribune',place:'principia',at:[-2,1.5],talk:'ch3:crispus'},
      {id:'brennus',name:'Explorator Brennus',role:'explorator',place:'drill',at:[-1.5,-1.5],talk:'ch3:brennus'},
      {id:'capsarius',name:'Capsarius Didius',role:'capsarius',place:'valetudinarium',at:[1.5,-1],talk:'ch3:capsarius'},
      {id:'clerk',name:'Clerk Tertius',role:'clerk',place:'principia',at:[2.5,-1],talk:'ch3:clerk'},
      {id:'lucan',name:'Aurelius Lucan',role:'comrade',place:'barracks',at:[1.5,1],talk:'ch3:lucan',requires:['ch2','carry']},
      {id:'sabinus',name:'Gaius Sabinus',role:'file-leader',place:'barracks',at:[1.5,1],talk:'ch3:sabinus',requires:['ch2','leave']},
      {id:'felix',name:'Marcus Felix',role:'archer',place:'barracks',at:[-1.5,-1],talk:'ch3:felix'},
      {id:'quartermaster',name:'Quartermaster Aper',role:'quartermaster',place:'quartermaster',at:[0,-1.5],talk:'ch3:quartermaster'},
      {id:'trader',name:'Syra the sutler',role:'trader',place:'canabae',at:[1.5,0],talk:'ch3:trader'},
      {id:'sentry',name:'The gate sentry',role:'sentry',place:'gate',at:[2.2,-1.2],talk:'gate'}],
    objects:[
      {id:'table',kind:'table',name:'The commander’s table',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The practice post',place:'drill',at:[-2.5,1.5],talk:'post'},
      {id:'well',kind:'well',name:'The station well',place:'canabae',at:[-2.5,0.5],talk:'ch3:well'},
      {id:'tracks',kind:'ground',name:'The ditch at the field’s edge',place:'drill',at:[-4,-2.5],talk:'ch3:tracks'},
      {id:'gate',kind:'gate',name:'The camp gate',place:'gate',at:[0,1.6],talk:'gate'}]}),
  // A fort above the Danube ford: the gate road runs down to the ford, the postern opens on
  // the reeds east of it, and the granary stands beside the principia's paved court.
  4:camp({id:'ch4-camp',chapter:4,title:'The frontier ford court',scale:2,ground:'grass',entry:'gate',
    map:['WWWWWWWWWW',
         'WCC.SSS.SW',
         'WCC.SSS.SW',
         'WRRRRRRRRW',
         'W...R.S..W',
         'WCC.R.S..W',
         'WWWWRWWW.W',
         '....R..MFM'],
    places:{gate:[4,6.4],principia:[5,1.5],quartermaster:[8,1.6],drill:[2,4.3],valetudinarium:[6,4.5],barracks:[1.6,1.6],canabae:[8,5.2]},
    people:[
      {id:'varro',name:'Varro',role:'campidoctor',place:'drill',at:[1.5,0],talk:'ch4:varro'},
      staff('clerk',[-3,1.5]),
      {id:'crispus',name:'Tribune Crispus',role:'tribune',place:'principia',at:[2.5,-1],talk:'ch4:crispus'},
      {id:'quintus',name:'Signifer Quintus',role:'standard-bearer',place:'principia',at:[-2,-1.5],talk:'ch4:quintus'},
      staff('porter',[-3,2]),staff('quartermaster',[0,1],{talk:'ch4:quartermaster'}),staff('capsarius',[1.5,1]),
      veteran(4,'lucan',[1.5,1],[-2,1.5]),veteran(4,'sabinus',[1.5,1],[-2,1.5]),veteran(4,'naso',[-3,1],[-2,-1.5]),veteran(4,'felix',[2.5,-1.5],[2,-1.5]),
      {id:'brennus',name:'Explorator Brennus',role:'explorator',place:'canabae',at:[0,-3],talk:'ch4:brennus'},
      {id:'trader',name:'Syra the sutler',role:'trader',place:'canabae',at:[-3,-2],talk:'ch4:trader'},
      staff('steward',[1.5,0]),staff('sentry',[2.2,-1.2])],
    objects:[
      {id:'table',kind:'table',name:'The chapter decision',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The formation post',place:'drill',at:[-2.5,1.5],talk:'hub:practice'},
      {id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[-2.5,.5],talk:'hub:report'},
      {id:'brace-rack',kind:'pile',name:'The gate’s brace rack',place:'gate',at:[-3,-5],talk:'ch4:brace-rack'},
      {id:'lookout',kind:'post',name:'The postern lookout',place:'canabae',at:[1.5,-1.5],talk:'ch4:lookout'},
      {id:'gate',kind:'gate',name:'The departure gate',place:'gate',at:[0,1.6],talk:'gate'}]}),
  // A halt in a broken mudbrick enclosure: the western road enters by the west wall's gap,
  // the eagle's paved stand faces it, and the refuge shelters sit beside the road.
  6:camp({id:'ch6-camp',chapter:6,title:'The eagle’s retreat halt',scale:2,ground:'sand',entry:'gate',
    map:['WWWW.WWWWW',
         'WCC.DDDSSW',
         'WCC.DDDSSW',
         'RRRRRRRR.W',
         'WDDDSSDDDW',
         'WCCDSSDCCW',
         'WWWWWW.WWW',
         'DDDDDDDDDD'],
    places:{gate:[.3,3.4],principia:[7.6,1.5],quartermaster:[5,1.5],drill:[4.5,4.5],valetudinarium:[1.5,4.6],barracks:[7.6,4.6],canabae:[1.5,1.4]},
    people:[
      {id:'varro',name:'Varro',role:'campidoctor',place:'drill',at:[-2.5,-1.5],talk:'ch6:varro',absentAfter:['ch6','obey']},
      {id:'aquilifer',name:'The eagle-bearer',role:'standard-bearer',place:'drill',at:[1.5,-1],talk:'ch6:aquilifer'},
      staff('instructor',[2,2]),staff('clerk',[-3,1.5]),
      {id:'severianus',name:'Marcus Aurelius Severianus',role:'tribune',place:'principia',at:[1.5,-1],talk:'ch6:severianus'},
      staff('quartermaster',[0,-1]),staff('porter',[-3,2]),staff('capsarius',[1.5,1]),
      veteran(6,'lucan',[1.5,1],[-2,1.5]),veteran(6,'sabinus',[1.5,1],[-2,1.5]),veteran(6,'naso',[-3,1],[-2,-1.5]),veteran(6,'felix',[2.5,-1.5],[2,-1.5]),
      staff('steward',[1.5,0]),
      {id:'trader',name:'Abgar the water-seller',role:'merchant',place:'canabae',at:[-3,-2],talk:'ch6:trader',routine:'carry'},
      staff('sentry',[2.2,-1.2])],
    objects:[
      {id:'table',kind:'table',name:'The chapter decision',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The formation post',place:'drill',at:[-2.5,1.5],talk:'hub:practice'},
      {id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[-2.5,.5],talk:'hub:report'},
      {id:'caravan-marks',kind:'ground',name:'Tracks beside the refuge',place:'canabae',at:[1.5,2.5],talk:'ch6:caravan'},
      {id:'road-marker',kind:'post',name:'The western road marker',place:'gate',at:[3,1.5],talk:'ch6:marker'},
      {id:'gate',kind:'gate',name:'The departure gate',place:'gate',at:[0,1.6],talk:'gate'}]}),
  // A regular camp before Milan: tent streets either side of the via principalis, which runs
  // out of the east gate toward the city; the council's awning stands at its head.
  7:camp({id:'ch7-camp',chapter:7,title:'The council camp before Milan',scale:2,ground:'grass',entry:'gate',
    map:['WWWWWWWWWW',
         'WCC.CC.SSW',
         'WCC.CC.SSW',
         'WRRRRRRRRR',
         'WSS.CC.CCW',
         'WSS.....CW',
         'WWWWWWWWWW',
         '..........'],
    places:{gate:[8.5,3.2],principia:[7.6,1.5],quartermaster:[1.5,4.5],drill:[5.5,5.2],valetudinarium:[1.5,1.5],barracks:[5,1.6],canabae:[7.6,4.4]},
    people:[
      {id:'severianus',name:'Marcus Aurelius Severianus',role:'tribune',place:'principia',at:[1.5,-1],talk:'ch7:severianus'},
      {id:'crispus',name:'Gaius Valerius Crispus',role:'tribune',place:'principia',at:[-2.5,-1.5],talk:'ch7:crispus',before:1},
      staff('clerk',[-3,1.5]),
      {id:'theon',name:'Rhetor Theon',role:'rhetor',place:'canabae',at:[1.5,0],talk:'ch7:theon'},
      staff('steward',[1,-2.5]),
      {id:'trader',name:'Vibia the wine-seller',role:'merchant',place:'canabae',at:[-1,2.5],talk:'ch7:trader',routine:'carry'},
      staff('instructor',[1.5,0]),
      staff('quartermaster',[0,-1],{talk:'ch7:quartermaster'}),staff('porter',[3,1]),staff('capsarius',[1.5,1]),
      veteran(7,'lucan',[1.5,1],[-2,1.5]),veteran(7,'sabinus',[1.5,1],[-2,1.5]),veteran(7,'naso',[-3,1],[-2,-1.5]),veteran(7,'felix',[2.5,-1.5],[2,-1.5]),
      staff('sentry',[-1.5,1.3])],
    objects:[
      {id:'table',kind:'table',name:'The chapter decision',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The formation post',place:'drill',at:[-2.5,-1],talk:'hub:practice'},
      {id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[-2.5,.5],talk:'hub:report'},
      {id:'boot-tally',kind:'table',name:'The boot tally',place:'quartermaster',at:[-2.5,1.5],talk:'ch7:boot-tally'},
      {id:'gate',kind:'gate',name:'The departure gate',place:'gate',at:[2.5,0],talk:'gate'}]}),
  // A riverbank assembly, palisaded on the landward side and open to the Danube, where the
  // households wait on the sand between the ferry stores and the landing.
  8:camp({id:'ch8-camp',chapter:8,title:'The Danube ferry assembly',scale:2,ground:'grass',entry:'gate',
    map:['WWWWWWWWWW',
         'W.SS.CC..W',
         'W.SS.CC..W',
         'WRRRRRRRRW',
         'W..CC..SSW',
         'WDDDRDDDDW',
         'WDDDRDDDDW',
         'MMMMFMMMMM'],
    places:{gate:[4,6.4],principia:[2.5,1.5],quartermaster:[7.6,4.5],drill:[1.5,4.4],valetudinarium:[7.5,1.5],barracks:[5.5,1.6],canabae:[6.5,5.8]},
    people:[
      {id:'severianus',name:'Marcus Aurelius Severianus',role:'tribune',place:'principia',at:[1.5,-1],talk:'ch8:severianus'},
      staff('clerk',[-3,1.5]),
      {id:'aelia',name:'Aelia Dacia',role:'settler',place:'canabae',at:[-4,.5],talk:'ch8:aelia'},
      staff('steward',[1.5,0]),
      {id:'trader',name:'Dida the honey-seller',role:'merchant',place:'canabae',at:[3.5,-2],talk:'ch8:trader',routine:'carry'},
      staff('quartermaster',[0,-1]),staff('porter',[-3,2]),staff('instructor',[1.5,0]),staff('capsarius',[1.5,1]),
      veteran(8,'lucan',[1.5,1],[-2,1.5]),veteran(8,'sabinus',[1.5,1],[-2,1.5]),veteran(8,'naso',[-3,1],[-2,-1.5]),veteran(8,'felix',[2.5,-1.5],[2,-1.5]),
      staff('sentry',[2.2,-1.2])],
    objects:[
      {id:'table',kind:'table',name:'The chapter decision',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The formation post',place:'drill',at:[-2.5,1.5],talk:'hub:practice'},
      {id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[1,2],talk:'hub:report'},
      {id:'seed-jar',kind:'pile',name:'A seed jar among the stores',place:'quartermaster',at:[-2.5,-1.5],talk:'ch8:seed-jar'},
      {id:'depth-marks',kind:'table',name:'The ferrymen’s depth board',place:'quartermaster',at:[2.5,-1],talk:'ch8:depth-marks'},
      {id:'sounding-pole',kind:'post',name:'The sounding pole',place:'gate',at:[3,.5],talk:'ch8:sounding-pole'},
      {id:'gate',kind:'gate',name:'The departure gate',place:'gate',at:[0,1.6],talk:'gate'}]}),
  // A campaign camp before the surrendering city: horse lines along the north wall, a paved
  // court where the envoys wait, and the requisition court beside the stores.
  9:camp({id:'ch9-camp',chapter:9,title:'The surrender court on campaign',scale:2,ground:'sand',entry:'gate',
    map:['WWWWWWWWWW',
         'WDDCCCC.SW',
         'WDDCCCC.SW',
         'WRRRRRRRRW',
         'WDD.SSS..W',
         'WDD.SSS..W',
         'WWWWRWWWWW',
         'DDDDRDDDDD'],
    places:{gate:[4,6.4],principia:[8,1.5],quartermaster:[1.5,4.5],drill:[5,1.6],valetudinarium:[8,4.5],barracks:[1.6,1.6],canabae:[5,4.5]},
    people:[
      {id:'severianus',name:'Marcus Aurelius Severianus',role:'tribune',place:'principia',at:[-1.5,-1],talk:'ch9:severianus'},
      staff('clerk',[-3,1.5]),
      {id:'envoy',name:'The city’s envoy',role:'envoy',place:'canabae',at:[1.5,-1],talk:'ch9:envoy'},
      staff('steward',[-1.5,-1]),
      {id:'trader',name:'Malku the incense-seller',role:'merchant',place:'canabae',at:[3,2],talk:'ch9:trader',routine:'carry'},
      {id:'cornicen',name:'The wing’s cornicen',role:'signaller',place:'drill',at:[-2,1],talk:'ch9:cornicen'},
      staff('instructor',[1.5,0]),
      staff('quartermaster',[0,-1]),staff('porter',[3,1]),staff('capsarius',[1.5,1]),
      veteran(9,'lucan',[1.5,1],[-2,1.5]),veteran(9,'sabinus',[1.5,1],[-2,1.5]),veteran(9,'naso',[-3,1],[-2,-1.5]),veteran(9,'felix',[2.5,-1.5],[0,-2]),
      staff('sentry',[2.2,-1.2])],
    objects:[
      {id:'table',kind:'table',name:'The chapter decision',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The formation post',place:'drill',at:[-2.5,-1.5],talk:'hub:practice'},
      {id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[-2.5,.5],talk:'hub:report'},
      {id:'requisition-tally',kind:'table',name:'The requisition tally',place:'quartermaster',at:[-2.5,1.5],talk:'ch9:requisition-tally'},
      {id:'gate',kind:'gate',name:'The departure gate',place:'gate',at:[0,1.6],talk:'gate'}]}),
  // The governor's paved courtyard in a provincial town: the hearing court and the granary on
  // either side of the north range, planted strips between the south rooms, the road out west.
  10:camp({id:'ch10-camp',chapter:10,title:'The governor’s relief courtyard',scale:2,ground:'stone',entry:'gate',
    map:['WWWWWWWWWW',
         'WSSS.SSSSW',
         'WSSS.SSSSW',
         'WRRRRRRRRW',
         'WSS.S.S.SW',
         'WSS.S.S.SW',
         'WRWWWWWWWW',
         'SRSSSSSSSS'],
    places:{gate:[1,6.4],principia:[6.5,1.5],quartermaster:[2,1.5],drill:[1.5,4.6],valetudinarium:[8.2,4.6],barracks:[6,4.6],canabae:[4,4.6]},
    people:[
      {id:'severianus',name:'Marcus Aurelius Severianus',role:'tribune',place:'principia',at:[2.5,-1],talk:'ch10:severianus'},
      {id:'provincial-clerk',name:'The provincial clerk',role:'clerk',place:'principia',at:[-2.5,-1],talk:'ch10:provincial-clerk'},
      staff('clerk',[-3,1.5]),
      {id:'theon',name:'Rhetor Theon',role:'rhetor',place:'canabae',at:[-2,-1],talk:'ch10:theon'},
      {id:'aelia',name:'Aelia Dacia',role:'settler',place:'canabae',at:[1.5,-1],talk:'ch10:aelia'},
      {id:'witness',name:'Licinia of the river farms',role:'settler',place:'canabae',at:[2,2],talk:'ch10:witness'},
      staff('steward',[-2,2],{name:'The petitions clerk'}),
      {id:'trader',name:'Caecilia the grain-seller',role:'merchant',place:'drill',at:[.5,3],talk:'ch10:trader',routine:'carry'},
      staff('instructor',[1.5,0]),
      staff('quartermaster',[0,-1]),staff('porter',[-3,2]),staff('capsarius',[0,1.5]),
      veteran(10,'lucan',[1.5,1],[-2,1.5]),veteran(10,'sabinus',[1.5,1],[-2,1.5]),veteran(10,'naso',[-3,1],[-2,-1.5]),veteran(10,'felix',[2.5,-1.5],[0,-2]),
      staff('sentry',[2.2,-1.2])],
    objects:[
      {id:'table',kind:'table',name:'The chapter decision',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The practice lectern',place:'drill',at:[-2.5,1.5],talk:'hub:practice'},
      {id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[0,.5],talk:'hub:report'},
      {id:'granary-receipts',kind:'table',name:'The granary receipts',place:'quartermaster',at:[3,1],talk:'ch10:granary-receipts'},
      {id:'warehouse-tally',kind:'table',name:'The seized warehouse tally',place:'principia',at:[1.5,2],talk:'ch10:warehouse-tally'},
      {id:'gate',kind:'gate',name:'The departure gate',place:'gate',at:[0,1.6],talk:'gate'}]}),
  // A quiet house in Rome around a planted court: the records table on the north walk, the
  // witness seats in the west portico, the stores and the aid room along the east.
  11:camp({id:'ch11-camp',chapter:11,title:'The service-record portico at Rome',scale:2,ground:'stone',entry:'gate',
    map:['WWWWWWWWWW',
         'WSSSSSSSSW',
         'WSS....SSW',
         'WSS....SSW',
         'WSSSSSSSSW',
         'WSSSRSSSSW',
         'WWWWRWWWWW',
         'SSSSRSSSSS'],
    places:{gate:[4,6.4],principia:[5,1.2],quartermaster:[8,4.5],drill:[4.5,2.5],valetudinarium:[8,1.5],barracks:[1.5,4.6],canabae:[1.5,1.5]},
    people:[
      {id:'paullus',name:'Lucius Cassius Paullus',role:'senator',place:'principia',at:[2,-1],talk:'ch11:paullus'},
      {id:'crispus',name:'Gaius Valerius Crispus',role:'senator',place:'principia',at:[-2.5,-1],talk:'ch11:crispus'},
      staff('clerk',[-4.5,1.5]),
      {id:'theon',name:'Rhetor Theon',role:'rhetor',place:'drill',at:[1.5,0],talk:'ch11:theon'},
      staff('instructor',[-2.5,-1]),
      {id:'severianus',name:'Marcus Aurelius Severianus',role:'tribune',place:'canabae',at:[1.5,-1],talk:'ch11:severianus'},
      staff('steward',[1.5,1.5],{name:'The petitions clerk'}),
      {id:'trader',name:'Atticus the bookseller',role:'merchant',place:'canabae',at:[-2,2],talk:'ch11:trader',routine:'carry'},
      staff('quartermaster',[0,-1]),staff('porter',[-3,2]),staff('capsarius',[1.5,1]),
      veteran(11,'lucan',[1.5,1],[-2,1.5]),veteran(11,'sabinus',[1.5,1],[-2,1.5]),
      staff('sentry',[2.2,-1.2])],
    objects:[
      {id:'table',kind:'table',name:'The chapter decision',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The practice lectern',place:'drill',at:[-2.5,1.5],talk:'hub:practice'},
      {id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[-2.5,.5],talk:'hub:report'},
      {id:'station-report',kind:'table',name:'The station report among the records',place:'principia',at:[4,-1],talk:'ch11:station-report'},
      {id:'province-accounts',kind:'table',name:'The provincial accounts',place:'quartermaster',at:[-2.5,-1.5],talk:'ch11:province-accounts'},
      {id:'gate',kind:'gate',name:'The departure gate',place:'gate',at:[0,1.6],talk:'gate'}]}),
  // The loyal legions' camp before the final march: the standards stand in a paved court at
  // its heart, with the decree table above it and the envoys kept to the tents by the wall.
  12:camp({id:'ch12-camp',chapter:12,title:'The loyal standards court',scale:2,ground:'stone',entry:'gate',
    map:['WWWWWWWWWW',
         'WCCCSSSCCW',
         'WCC.SSS.CW',
         'WRRRRRRRRW',
         'WCC.SSS..W',
         'WCC.SSS..W',
         'WWWWRWWWWW',
         '....R.....'],
    places:{gate:[4,6.4],principia:[5,1.5],quartermaster:[8,4.5],drill:[5,4.5],valetudinarium:[8,1.6],barracks:[1.6,4.6],canabae:[1.6,1.6]},
    people:[
      {id:'severianus',name:'Marcus Aurelius Severianus',role:'tribune',place:'principia',at:[2.5,-1],talk:'ch12:severianus',when:'patronSupport'},
      {id:'messenger',name:'Severianus’s messenger',role:'envoy',place:'principia',at:[2.5,-1],talk:'ch12:messenger',when:'patronNeutral'},
      {id:'treasury-envoy',name:'The treasury envoy',role:'envoy',place:'principia',at:[2.5,-1],talk:'ch12:treasury-envoy',when:'patronHostile'},
      staff('clerk',[-3,1.5]),
      {id:'quintus',name:'Signifer Quintus',role:'standard-bearer',place:'drill',at:[1.5,-1],talk:'ch12:quintus'},
      staff('instructor',[-2.5,1]),
      {id:'paullus',name:'Lucius Cassius Paullus',role:'senator',place:'canabae',at:[1.5,-1],talk:'ch12:paullus',before:1},
      {id:'aelia',name:'Aelia Dacia',role:'settler',place:'canabae',at:[-2,1.5],talk:'ch12:aelia'},
      staff('steward',[1.5,1.5],{name:'The petitions clerk'}),
      {id:'trader',name:'Syra the sutler',role:'trader',place:'quartermaster',at:[-3,2.5],talk:'ch12:trader'},
      staff('quartermaster',[0,-1],{talk:'ch12:quartermaster'}),staff('porter',[-3,-1]),staff('capsarius',[1.5,1]),
      veteran(12,'lucan',[1.5,1],[-2,1.5]),veteran(12,'sabinus',[1.5,1],[-2,1.5]),veteran(12,'naso',[-3,1],[-2,-1.5]),veteran(12,'felix',[2.5,-1.5],[1.5,-1.5]),
      staff('sentry',[2.2,-1.2])],
    objects:[
      {id:'table',kind:'table',name:'The chapter decision',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The practice lectern',place:'drill',at:[-2.5,-1.5],talk:'hub:practice'},
      {id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[-2.5,-1],talk:'hub:report'},
      {id:'standards',kind:'post',name:'The legions’ standards',place:'drill',at:[0,0],talk:'ch12:standards'},
      {id:'gate',kind:'gate',name:'The departure gate',place:'gate',at:[0,1.6],talk:'gate'}]}),
  5:camp({id:'ch5-camp',chapter:5,title:'The Euphrates staging courtyard',scale:2,ground:'sand',entry:'gate',pilot:true,peaceful:true,
    map:['WWWWWWWWWW',
         'WSSSSSSSSW',
         'WSSSRSSSSW',
         'WRRRRRSSSW',
         'WSSSRSSSSW',
         'WDDDRDDDDW',
         'WWWWRSSSSW',
         'DDDDRDDDDD'],
    // Explicit fine-grid collision pockets. The scene fits its service props
    // inside these rectangles; every interaction remains on the open paving.
    sceneryPads:[
      {id:'ch5-storage-jars',kind:'jars',cells:[[14,1],[15,1],[14,2],[15,2]]},
      {id:'ch5-cistern',kind:'cistern',cells:[[16,6],[17,6],[16,7],[17,7]]},
      {id:'ch5-household-bundles',kind:'bundles',cells:[[16,13],[17,13],[16,14],[17,14]]}],
    places:{gate:[4,6.4],principia:[4,1.5],quartermaster:[7.5,1.8],drill:[2,4.5],valetudinarium:[7.5,4.5],barracks:[1.5,2],canabae:[6.5,5.5]},
    placeNames:{gate:'Field gate',principia:'Command shelter',quartermaster:'Supply court',drill:'Formation yard',valetudinarium:'Aid shelter',barracks:'Company muster',canabae:'Evacuation shelter'},
    placeHints:{gate:'Depart for the tower or river gate.',principia:'Your decision, officers’ advice and battle preparation.',quartermaster:'Equipment and pay.',drill:'Training and completed-encounter practice.',valetudinarium:'The wounded and medical training.',barracks:'Choose your companions and their orders.',canabae:'Households waiting for the river route.'},
    people:[
      {id:'varro',name:'Varro',role:'campidoctor',place:'drill',at:[1.5,0],talk:'ch5:varro'},
      {id:'engineer',name:'The fortress engineer',role:'clerk',place:'principia',at:[-3,1.5],talk:'ch5:engineer'},
      {id:'water-steward',name:'The water steward',role:'orderly',place:'valetudinarium',at:[-2,-1],talk:'ch5:water',routine:'carry'},
      {id:'capsarius',name:'Capsarius Didius',role:'capsarius',place:'valetudinarium',at:[1.5,1],talk:'ch5:capsarius',routine:'rest'},
      {id:'quartermaster',name:'Quartermaster Aper',role:'quartermaster',place:'quartermaster',at:[0,0],talk:'ch5:quartermaster',routine:'work'},
      {id:'lucan',name:'Aurelius Lucan',role:'comrade',place:'barracks',at:[1.5,1],talk:'ch5:lucan',requires:['ch2','carry']},
      {id:'sabinus',name:'Gaius Sabinus',role:'file-leader',place:'barracks',at:[1.5,1],talk:'ch5:sabinus',requires:['ch2','leave']},
      {id:'evacuation-officer',name:'The evacuation officer',role:'clerk',place:'canabae',at:[1.5,0],talk:'ch5:evacuation'},
      {id:'trader',name:'Barnaios the date-seller',role:'merchant',place:'canabae',at:[-1,2.5],talk:'ch5:trader',routine:'carry'},
      {id:'sentry',name:'The field gate sentry',role:'sentry',place:'gate',at:[2.2,-1.2],talk:'gate',routine:'watch'}],
    objects:[
      {id:'table',kind:'table',name:'The commander’s table',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The formation post',place:'drill',at:[-2.5,1.5],talk:'post'},
      {id:'water-board',kind:'table',name:'The courtyard report',place:'canabae',at:[-2.5,.5],talk:'ch5:report'},
      {id:'gate',kind:'gate',name:'The field gate',place:'gate',at:[0,1.6],talk:'gate'}]})
});
export const campFor=chapter=>CAMPS[chapter]??null;
// Who stands in camp now: a person may need an earlier decision (`requires`), leave after
// one (`absentAfter`), follow the scenes' own conditions (`when`: mentorAlive, patronSupport
// and the rest, campaign.js) or stand there only before the chapter's nth encounter (`before`).
export const campPersonPresent=(state,p)=>(!p.requires||state.decisions?.[p.requires[0]]===p.requires[1])&&!(p.absentAfter&&state.decisions?.[p.absentAfter[0]]===p.absentAfter[1])&&
  storyWhen(state,p.when)&&(p.before===undefined||(state.encounterIndex??0)<p.before);
// Where a present person stands: a companion still recovering on the company roll
// (career.js) waits at the valetudinarium, at his `ward` offset, until he is fit.
export const campPersonSpot=(state,p)=>p.ward&&(state.company??[]).some(v=>v.id===p.veteran&&v.recovery>0)?{place:'valetudinarium',at:p.ward,recovering:true}:{place:p.place,at:p.at};
export const campPlaceName=(chapter,id)=>campFor(chapter)?.placeNames?.[id]??PLACE_NAMES[id];
export const campPlaceHint=(chapter,id)=>campFor(chapter)?.placeHints?.[id]??({
  gate:'Depart for the next encounter when the required orders are ready.',principia:'Your chapter decision and officers’ advice.',
  quartermaster:'Equipment, pay and field spoils.',drill:'Training and practice of completed encounters.',valetudinarium:'Company condition and medical training.',
  barracks:'Choose companions and their orders.',canabae:chapter<=3?'Local people, news and optional errands.':'Local people and the consequences of your orders.'}[id]??PLACE_HINTS[id]);

// What the canabae's traders sell beside the quartermaster (goods, charms, a little kit),
// from each region's own markets.
export const TRADER_STOCK=freeze({1:freeze(['wine_skin','wax_tablet','amulet_mars']),2:freeze(['wine_skin','medicine_box','phylactery']),
  3:freeze(['wine_skin','medicine_box','wax_tablet','amulet_mars','sling']),
  4:freeze(['wine_skin','smoked_fish','wax_tablet','medicine_box','amulet_mars','phylactery']),
  5:freeze(['dates','wine_skin','medicine_box','eye_amulet']),
  6:freeze(['dates','leather_thongs','wine_skin','medicine_box']),
  7:freeze(['wine_skin','olive_oil','garum','wax_tablet','amulet_mars']),
  8:freeze(['honey_jar','smoked_fish','wine_skin','medicine_box','phylactery']),
  9:freeze(['incense','dates','eye_amulet','wine_skin']),
  10:freeze(['olive_oil','honey_jar','wax_tablet','medicine_box','wine_skin']),
  11:freeze(['papyrus_roll','wax_tablet','olive_oil','amulet_mars','phylactery']),
  12:freeze(['seed_grain','wine_skin','smoked_fish','medicine_box','amulet_mars','phylactery'])});
