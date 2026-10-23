import {CAMP_CONTEXT,CAMP_SCENERY_PADS} from './camp-regions.js';

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
  objects:freeze([...data.objects,...(data.chapter<=3?[{id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[-2.5,0],talk:'hub:report'}]:[])].map(freeze))});

// Later camps keep the services in a compact court. Each map follows its
// setting and gate; people stay clear of the service props and walking lanes.
const regionalCamp=(chapter,title,map,places,ground='grass')=>camp({
  id:`ch${chapter}-camp`,chapter,title,map,places,ground,scale:2,entry:'gate',
  people:[
    {id:'instructor',name:'The veteran instructor',role:'campidoctor',place:'drill',at:[1.5,0],talk:'hub:instructor'},
    {id:'clerk',name:'The duty clerk',role:'clerk',place:'principia',at:[-3,1.5],talk:'hub:clerk'},
    {id:'porter',name:'The supply orderly',role:'orderly',place:'quartermaster',at:[-3,2],talk:'hub:porter',routine:'carry'},
    {id:'capsarius',name:'Capsarius Didius',role:'capsarius',place:'valetudinarium',at:[1.5,1],talk:'hub:capsarius',routine:'rest'},
    {id:'quartermaster',name:'Quartermaster Aper',role:'quartermaster',place:'quartermaster',at:[0,-1],talk:'hub:quartermaster',routine:'work'},
    {id:'lucan',name:'Aurelius Lucan',role:'comrade',place:'barracks',at:[1.5,1],talk:'hub:lucan',requires:['ch2','carry']},
    {id:'sabinus',name:'Gaius Sabinus',role:'file-leader',place:'barracks',at:[1.5,1],talk:'hub:sabinus',requires:['ch2','leave']},
    {id:'local-steward',name:chapter>=10?'The petitions clerk':'The local steward',role:'clerk',place:'canabae',at:[1.5,0],talk:'hub:local'},
    {id:'sentry',name:'The gate sentry',role:'sentry',place:'gate',at:[2.2,-1.2],talk:'gate',routine:'watch'}],
  objects:[
    {id:'table',kind:'table',name:'The chapter decision',place:'principia',at:[0,0],talk:'table'},
    {id:'post',kind:'post',name:chapter>=10?'The practice lectern':'The formation post',place:'drill',at:[-2.5,1.5],talk:'hub:practice'},
    {id:'local-report',kind:'table',name:'The local report',place:'canabae',at:[-2.5,.5],talk:'hub:report'},
    {id:'gate',kind:'gate',name:'The departure gate',place:'gate',at:[0,1.6],talk:'gate'}]
});

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
  4:regionalCamp(4,'The frontier ford court',
    ['WWWWWWWWWW','WCCSSSCC.W','WCC.R.CC.W','WRRRRRRRRW','W...R..SSW','W...R..SSW','WWWWRWWWWW','....R.....'],
    {gate:[4,6.4],principia:[4,1.4],quartermaster:[7.5,2],drill:[2,4.5],valetudinarium:[7.5,4.7],barracks:[1.6,2],canabae:[6.3,5.9]}),
  6:regionalCamp(6,'The eagle’s retreat halt',
    ['WWWWWWWWWW','WDSSDDDCCW','WDRDDDDCCW','WRRRRRRRRW','WDRDDDDCCW','WDRDDDDCCW','WRRSSSSSSW','DRRDDDDDDD'],
    {gate:[1.5,6.4],principia:[2,1.5],quartermaster:[7.5,1.7],drill:[5,3.4],valetudinarium:[1.6,3.8],barracks:[7.5,4.5],canabae:[5,6]},'sand'),
  7:regionalCamp(7,'The council camp before Milan',
    ['WWWWWWWWWW','WSSCCCSSSW','W.R...RCCW','WRRRRRRRRW','W.R...RCCW','W.RSSSR..W','WSSSSSSRRW','.......RR.'],
    {gate:[7,6.4],principia:[6,1.5],quartermaster:[1.5,1.6],drill:[4,3.6],valetudinarium:[7.5,4.3],barracks:[1.5,4.5],canabae:[3,6]}),
  8:regionalCamp(8,'The Danube ferry assembly',
    ['WWWWWWWWWW','WCCSSSS..W','WCC.R.CC.W','WRRRRRRRRW','W...R.CC.W','W...RSSSSW','WSSSRSSSSW','MMMMFMMMMM'],
    {gate:[4,6.4],principia:[7,1.5],quartermaster:[1.6,1.6],drill:[2,4],valetudinarium:[7.5,4.5],barracks:[4.6,1.6],canabae:[5,5]}),
  9:regionalCamp(9,'The surrender court on campaign',
    ['WWWWWWWWWW','WDDSSSDDDW','WDDDRDDDDW','WRRRRRRRRW','WDDDRDDSSW','WDDDRDDSSW','WWWWRSSSSW','DDDDRDDDDD'],
    {gate:[4,6.4],principia:[4,1.4],quartermaster:[7.5,2],drill:[2,4.5],valetudinarium:[7.5,4.7],barracks:[1.6,2],canabae:[6.3,5.9]},'sand'),
  10:regionalCamp(10,'The governor’s relief courtyard',
    ['WWWWWWWWWW','WSSSSSSSSW','WSRSSSSSSW','WRRRRRRRRW','WSRSSSSSSW','WSRSSSSSSW','WRRSSSSSSW','SRRSSSSSSS'],
    {gate:[1.5,6.4],principia:[2,1.5],quartermaster:[7.5,1.7],drill:[5,3.4],valetudinarium:[1.6,3.8],barracks:[7.5,4.5],canabae:[5,6]},'stone'),
  11:regionalCamp(11,'The service-record portico at Rome',
    ['WWWWWWWWWW','WSSSSSSSSW','WSRSSSRSSW','WRRRRRRRRW','WSRSSSRSSW','WSRSSSRSSW','WSSSSSSRRW','SSSSSSSRRS'],
    {gate:[7,6.4],principia:[6,1.5],quartermaster:[1.5,1.6],drill:[4,3.6],valetudinarium:[7.5,4.3],barracks:[1.5,4.5],canabae:[3,6]},'stone'),
  12:regionalCamp(12,'The loyal standards court',
    ['WWWWWWWWWW','WSSSSSSSSW','WSSSRSSSSW','WRRRRRRRRW','WSSSRSSSSW','WSSSRSSSSW','WSSSRSSSSW','SSSSRSSSSS'],
    {gate:[4,6.4],principia:[7,1.5],quartermaster:[1.6,1.6],drill:[2,4],valetudinarium:[7.5,4.5],barracks:[4.6,1.6],canabae:[5,5]},'stone'),
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
      {id:'sentry',name:'The field gate sentry',role:'sentry',place:'gate',at:[2.2,-1.2],talk:'gate',routine:'watch'}],
    objects:[
      {id:'table',kind:'table',name:'The commander’s table',place:'principia',at:[0,0],talk:'table'},
      {id:'post',kind:'post',name:'The formation post',place:'drill',at:[-2.5,1.5],talk:'post'},
      {id:'water-board',kind:'table',name:'The courtyard report',place:'canabae',at:[-2.5,.5],talk:'ch5:report'},
      {id:'gate',kind:'gate',name:'The field gate',place:'gate',at:[0,1.6],talk:'gate'}]})
});
export const campFor=chapter=>CAMPS[chapter]??null;
export const campPersonPresent=(state,p)=>(!p.requires||state.decisions?.[p.requires[0]]===p.requires[1])&&!(p.absentAfter&&state.decisions?.[p.absentAfter[0]]===p.absentAfter[1]);
export const campPlaceName=(chapter,id)=>campFor(chapter)?.placeNames?.[id]??PLACE_NAMES[id];
export const campPlaceHint=(chapter,id)=>campFor(chapter)?.placeHints?.[id]??({
  gate:'Depart for the next encounter when the required orders are ready.',principia:'Your chapter decision and officers’ advice.',
  quartermaster:'Equipment, pay and field spoils.',drill:'Training and practice of completed encounters.',valetudinarium:'Company condition and medical training.',
  barracks:'Choose companions and their orders.',canabae:chapter<=3?'Local people, news and optional errands.':'Local people and the consequences of your orders.'}[id]??PLACE_HINTS[id]);

// What the canabae's traders sell beside the quartermaster (goods, charms, a little kit).
export const TRADER_STOCK=freeze({1:freeze(['wine_skin','wax_tablet','amulet_mars']),2:freeze(['wine_skin','medicine_box','phylactery']),
  3:freeze(['wine_skin','medicine_box','wax_tablet','amulet_mars','sling'])});
