// The walkable camps of Chapters I–III (build brief §3.12, guide "In camp").
// Each camp is a coarse map in the battles' tiles, upsampled for real time
// like a battle's (k fine 2.5 m tiles a side), with the places the guide
// names, the people who stand there and the objects that open a
// conversation or a panel. Camps have no clock and nothing in them fights.
//
// Map letters: W palisade, R road, S paved court, C tent lines, . open ground,
// M marsh, F ford. People and objects stand at a place, offset in metres.

const freeze=value=>Object.freeze(value);
const LETTERS=freeze({W:'wall',R:'road',S:'stone',C:'camp','.':'grass',M:'marsh',F:'ford',K:'rock'});
const grid=rows=>freeze(rows.map(row=>freeze([...row].map(ch=>LETTERS[ch]))));

// The places every camp has; their order is the map panel's.
export const CAMP_PLACES=freeze(['gate','principia','quartermaster','drill','valetudinarium','barracks','canabae']);
export const PLACE_NAMES=freeze({gate:'Camp gate',principia:'Principia',quartermaster:'Quartermaster',drill:'Drill field',valetudinarium:'Valetudinarium',
  barracks:'Barracks',canabae:'Canabae'});
export const PLACE_HINTS=freeze({gate:'March out to the next encounter.',principia:'The commander’s table: the chapter’s decision and the War Council.',
  quartermaster:'Pay, kit and selling what you took from the field.',drill:'Trainers and the practice post.',valetudinarium:'The wounded, and when they return to duty.',
  barracks:'The company roll: who marches with you, and their standing orders.',canabae:'Traders, rumours and errands from civilians.'});

const camp=data=>freeze({...data,terrain:grid(data.map),places:freeze(data.places),people:freeze(data.people.map(freeze)),objects:freeze(data.objects.map(freeze))});

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
      {id:'gate',kind:'gate',name:'The camp gate',place:'gate',at:[0,1.6],talk:'gate'}]})
});
export const campFor=chapter=>CAMPS[chapter]??null;

// What the canabae's traders sell beside the quartermaster (goods, charms, a little kit).
export const TRADER_STOCK=freeze({1:freeze(['wine_skin','wax_tablet','amulet_mars']),2:freeze(['wine_skin','medicine_box','phylactery']),
  3:freeze(['wine_skin','medicine_box','wax_tablet','amulet_mars','sling'])});
