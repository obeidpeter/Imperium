import {OATH} from './campaign.js';

// The living camps of Chapters IV–XII (worlds and gameplay plan, release 8):
// the named cast's conversations in each camp, the chapters' errands and the
// pages history keeps of a lost encounter. Original prose for this project;
// history follows docs/historical-research.md. Conversations use the dialogue
// engine's data (core/dialogue.js): an errand is offered once, never blocks the
// story, and its reward is given once, when it is done. Replies that need
// something of the soldier (an attribute, a decoration, a title, a meter or a
// training path) are shown dimmed with what they need; they open words, not
// rewards.

const freeze=value=>Object.freeze(value);
const opt=(text,next=null,more={})=>freeze({text,next,conditions:freeze(more.conditions??{}),effects:freeze(more.effects??{}),once:!!more.once,
  ...(more.news===false?{news:false}:{})});
const node=(speaker,text,options,more={})=>freeze({speaker,text,options:freeze(options),...more});
const tree=(start,nodes,more={})=>freeze({start,nodes:freeze(nodes),...more});
const variant=(conditions,text,speaker)=>freeze({conditions:freeze(conditions),text,...(speaker?{speaker}:{})});
const bye=opt('Farewell.');
const back=(text='Back.',next='greet')=>opt(text,next);
const errand=(id,chapter,giver,title,summary,reward)=>freeze({id,chapter,giver,title,summary,reward:freeze(reward)});
// An errand's offer, its acceptance and its completion, as replies.
const offered=id=>({errand:{[id]:'none'}}),inHand=(id,more={})=>({errand:{[id]:'accepted'},...more}),finished=id=>({errand:{[id]:'done'}});

// Two errands a chapter, each worth two training points (src/core/tp-audit.js counts
// them); the five titles no other deed awards are given by one each.
export const LIVING_ERRANDS=freeze({
  gate_braces:errand('gate_braces',4,'Quartermaster Aper','Braces for the gate',
    'Carry a spare brace from the granary to the rack inside the gate, then tell Aper it is in place.',{tp:2,title:'shield_of_cohort'}),
  ford_count:errand('ford_count',4,'Explorator Brennus','Rafts below the far bank',
    'Count the rafts the raiders are lashing below the far bank from the lookout by the postern, and tell Brennus what you saw.',{tp:2}),
  listening_bowl:errand('listening_bowl',5,'The fortress engineer','A bowl of water on the paving',
    'Borrow a bronze bowl from the water steward and bring it to the engineer, who sets it on the tower’s paving to watch for the miners’ blows.',{tp:2}),
  letter_home:errand('letter_home',5,'Your companion','A letter downriver',
    'Take your companion’s letter to the evacuation officer, whose boats carry the households’ mail downriver, then tell him it is on its way.',{tp:2}),
  western_wells:errand('western_wells',6,'Marcus Felix','Water to the west',
    'Read the western road marker and the tracks beside the refuge, then tell Felix which track leads to water.',{tp:2,title:'pathfinder'}),
  eagle_cords:errand('eagle_cords',6,'The eagle-bearer','Leather for the pole',
    'Buy leather thongs from the water-seller at the refuge and bring them to the eagle-bearer, whose bindings have worn through.',{tp:2}),
  boot_sizes:errand('boot_sizes',7,'Aulus Naso','Boots for the march',
    'Read the quartermaster’s boot tally against the cohort’s list of sizes, then put the men’s case to Aper.',{tp:2,title:'advocate_of_ranks'}),
  theon_order:errand('theon_order',7,'Rhetor Theon','The order of a speech',
    'Hear Theon’s lesson, then tell him in what order you will speak before the officers.',{tp:2}),
  ford_soundings:errand('ford_soundings',8,'Marcus Felix','Depth at the landing',
    'Sound the landing with the ferrymen’s pole and read their depth board, then tell Felix where the carts can cross.',{tp:2,title:'river_scout'}),
  seed_jar:errand('seed_jar',8,'Aelia Dacia','The Ulpii’s seed',
    'Find the Ulpii’s seed jar among the ferry stores and bring it to Aelia before the boats are loaded.',{tp:2}),
  recall_signal:errand('recall_signal',9,'Your companion','The recall signal',
    'Agree the wing’s recall call with the cornicen, then tell your companion what he will hear.',{tp:2}),
  market_keys:errand('market_keys',9,'The city’s envoy','The granaries’ count',
    'Read the requisition court’s tally of the city’s granaries and tell the envoy how many the army has counted.',{tp:2}),
  granary_receipts:errand('granary_receipts',10,'The provincial clerk','The diverted grain',
    'Read the granary receipts and the seized warehouse tally, then tell the provincial clerk how much grain left by the back door.',{tp:2}),
  frightened_witness:errand('frightened_witness',10,'Rhetor Theon','A witness who will not speak',
    'Persuade Licinia of the river farms to tell the tribunal what she saw at the survey markers, then tell Theon she will speak.',{tp:2}),
  station_report:errand('station_report',11,'Lucius Cassius Paullus','The station report',
    'Find your first report, the recovery at the road station, among the service records and bring Paullus a fair copy.',{tp:2,title:'scribe_of_council'}),
  province_accounts:errand('province_accounts',11,'Gaius Valerius Crispus','A question in writing',
    'Bring Crispus a copy of your province’s audited accounts from the household stores.',{tp:2}),
  seal_shown:errand('seal_shown',12,'Signifer Quintus','The seal at the standards',
    'Hold up the lead seal of your oath at the standards, where Quintus has gathered the loyal legions’ signiferi, then tell him it is done.',{tp:2}),
  spring_seed:errand('spring_seed',12,'Aelia Dacia','Seed for next spring',
    'Bring Aelia seed grain for the households’ fields: have Aper release the army’s spare seed, or buy it from the sutler.',{tp:2})
});

export const LIVING_DIALOGUE=freeze({
  // ——— Chapter IV: the frontier ford court ———
  'ch4:varro':tree('greet',{
    greet:node('Varro','Optio. The staff is yours, and so are the six men behind it. Learn their names before you learn their faults; you will need both.',[
      opt('Teach me a course.',null,{effects:{open:'trainer:campidoctor'}}),
      opt('How do I give one order and make it count?','orders'),
      opt('I was first at the post once.','post',{conditions:{title:'drill_first'}}),
      opt('The men listen when I speak. I want them to listen when I am silent.','silence',{conditions:{attribute:{auth:13}}}),
      bye],{variants:freeze([
        variant({decision:{ch4:'withdraw'}},'Optio. You opened the postern. Good or bad, the men in the outwork will know whose order it was, and so will their wives. Wear it.'),
        variant({decision:{ch4:'hold'}},'Optio. You kept them in the outwork. Go and look at them before the assault, not after; it is easier for them and harder for you, which is the right way round.')])}),
    orders:node('Varro','In the field your voice reaches a few men, not all. A squad with an order does it; a squad without one does what it had already planned. So give the order that changes the most, give it plainly, and then stop talking.',[back('Understood.')]),
    post:node('Varro','I remember. You struck it as if it owed you money. Now you must make six men want to strike it. That is harder, and nobody gives you a title for it.',[back('No one ever said it was fair.')]),
    silence:node('Varro','Then stand where they can see you and do not fidget. Most of authority is not moving at the wrong moment. The rest is being right often enough that they forgive you the times you are not.',[back('I will try to keep still.')])
  }),
  'ch4:crispus':tree('greet',{
    greet:node('Tribune Crispus','Optio. I am writing the fort’s report before the fort has finished deciding what happened. That is how headquarters prefers its reports.',[
      opt('What will you write about the outwork?','outwork'),
      opt('Write the names first, then the stores.','names',{conditions:{attribute:{elo:14}}}),
      opt('The corona vallaris is on the record now.','crown',{conditions:{decoration:'corona_vallaris'}}),
      bye],{variants:freeze([
        variant({decision:{ch3:'claim'}},'Optio. Your name heads the station report, I see. You will forgive me if I read this one twice before I sign it.'),
        variant({decision:{ch3:'share'}},'Optio. Your acknowledgement is still in my papers from the road station. I have not forgotten it, though some evenings I wish it were shorter.')])}),
    outwork:node('Tribune Crispus','Whatever you order. If you withdraw it, I write that we lost the grain and the firing platform. If you hold it, I write that we kept them, and I add the names. Headquarters reads the first sentence. The families read the second.',[back('Then write both carefully.')]),
    names:node('Tribune Crispus','Names first. You sound like a clerk. That was meant kindly; I suspect it did not sound so. Very well: the names, then the grain. Headquarters will have to turn the page.',[back('Thank you, tribune.')]),
    crown:node('Tribune Crispus','So it is. Mine says that I was present. Rome will remember which of us was first over the rampart, and I suspect it will remember at the least convenient moment.',[back('Rome has a long memory.')])
  }),
  'ch4:quintus':tree('greet',{
    greet:node('Signifer Quintus','Optio. I held the standards when you swore at Novae. You have the look of a man who remembers the words and not the weather. It was raining.',[
      opt('Teach me a course.',null,{effects:{open:'trainer:signifer'}}),
      opt('What can a signifer teach an optio?','voice'),
      opt('The oath still stands.','oath',{conditions:{oath:true}}),
      bye]),
    voice:node('Signifer Quintus','How to be seen and heard over noise. A standard is a voice that never grows hoarse. If your men can see where you are, half your orders give themselves; the other half, you will still have to shout.',[back('I will remember it.')]),
    oath:node('Signifer Quintus','It does. I have watched men break it from fear and keep it from habit. Keep it from choice. It lasts longer, and it weighs less on a march.',[back('From choice, then.')])
  }),
  'ch4:brennus':tree('greet',{
    greet:node('Explorator Brennus','The raiders have been cutting branches on the far bank all morning, and they are not building fires. Count their rafts from the wall walk if your eyes are still good.',[
      opt('Teach me a course.',null,{effects:{open:'trainer:explorator'}}),
      opt('I will count them for you.','errand',{conditions:offered('ford_count')}),
      opt('I counted the rafts.','report',{conditions:inHand('ford_count',{flag:'rafts_counted'})}),
      opt('Where will they try to land?','landing',{conditions:{path:'explorator'}}),
      opt('Six rafts, then.','after',{conditions:finished('ford_count'),news:false}),
      bye]),
    errand:node('Explorator Brennus','Use the lookout by the postern. Count every raft, large and small; a small raft carries as many men as a large one when the men are desperate. Then come back and tell me.',[
      opt('I will.','greet',{effects:{errand:{ford_count:'accepted'}}}),back('Another time.')]),
    report:node('Explorator Brennus','How many?',[
      opt('Four large rafts.','wrong'),
      opt('Six: four large and two small.','right',{effects:{errand:{ford_count:'done'}}}),
      opt('Too many to count.','wrong')]),
    wrong:node('Explorator Brennus','Count again. The raft you did not count is the one that lands behind you.',[back('I will look again.')]),
    right:node('Explorator Brennus','Six, two of them small. Then they come at two places, the ford and the reeds below the postern. That is worth knowing before the drum cracks again.',[back('I will tell the wall.')]),
    after:node('Explorator Brennus','Six it was. The ford and the reeds. If they bring a seventh, it will be because they saw us counting.',[back('Then we keep counting.')]),
    landing:node('Explorator Brennus','Where the reeds are already trampled. Men like to cross where other men have crossed; you know that. I taught it to you above the road station, and you were a poor pupil for a whole morning.',[back('Only the first morning.')])
  }),
  'ch4:lookout':tree('post',{
    post:node('The postern lookout','A ladder climbs to the wall walk beside the postern. From the top you can see the ford, the reeds on the far bank and the trees behind them.',[
      opt('Count the rafts.','count',{conditions:inHand('ford_count',{notFlag:'rafts_counted'}),effects:{flags:['rafts_counted']}}),
      opt('Look at the far bank.','look'),opt('Climb down.')]),
    count:node('The postern lookout','In the reeds below the far bank lie four large rafts of lashed branches, and two smaller ones beside them. Men are still carrying branches down from the trees.',[opt('Climb down.')]),
    look:node('The postern lookout','The far bank is quiet except for the axes. Smoke rises in two places, too thin for cooking fires.',[back('Look again.','post'),opt('Climb down.')])
  }),
  'ch4:quartermaster':tree('greet',{
    greet:node('Quartermaster Aper','The granary is counted, the braces are stacked and the porters are on the wall carrying stones. Everything else waits, including me.',[
      opt('Equipment and pay.',null,{effects:{open:'quartermaster'}}),
      opt('Is there work while the porters are on the wall?','errand',{conditions:offered('gate_braces')}),
      opt('The brace is in the rack.','thanks',{conditions:inHand('gate_braces',{flag:'brace_racked'}),effects:{errand:{gate_braces:'done'}}}),
      opt('I could carry two at once.','two',{conditions:{attribute:{str:15}}}),
      bye]),
    errand:node('Quartermaster Aper','The engineer wants a spare brace in the rack inside the gate before the assault. Each one weighs as much as a man and complains less. Take one, set it in the rack and come back.',[
      opt('I will carry it.','greet',{effects:{errand:{gate_braces:'accepted'},give:['gate_brace']}}),back('Another time.')]),
    thanks:node('Quartermaster Aper','Then the gate has one more argument. The men will have seen who carried it. They always do, and then they pretend they did not.',[back('Let them pretend.')]),
    two:node('Quartermaster Aper','You could. Then you would have one shoulder for the braces and none for the man who falls beside you. One at a time, optio; it is what the braces are for.',[back('One at a time.')])
  }),
  'ch4:brace-rack':tree('rack',{
    rack:node('The gate’s brace rack','Iron-shod timbers the height of a man lean in a rack inside the gate, beside the post where the cracked drum hangs.',[
      opt('Set the brace in the rack.','set',{conditions:inHand('gate_braces',{item:'gate_brace',notFlag:'brace_racked'}),effects:{take:['gate_brace'],flags:['brace_racked']}}),
      opt('Leave the rack.')]),
    set:node('The gate’s brace rack','The brace drops into its place with a sound the gate seems to approve of.',[opt('Leave the rack.')])
  }),
  'ch4:trader':tree('greet',{
    greet:node('Syra the sutler','I follow the legion because the legion pays, optio, and because it is the only crowd on the river that buys wax tablets.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('Any news from the far bank?','rumour'),bye]),
    rumour:node('Syra the sutler','The ferrymen say the raiders are counting boats again. They also say my wine is watered. Only one of those is true, and it is not the wine.',[back('I will keep watch.')])
  }),
  'ch4:lucan':tree('greet',{
    greet:node('Aurelius Lucan','An optio’s staff. When we were recruits you would have hidden it under your cloak so that nobody asked you to carry anything with it.',[
      opt('Review our company.',null,{effects:{open:'company'}}),opt('How are the men?','men'),bye],
      {variants:freeze([variant({recovering:'lucan'},'They have put me on a cot again. The leg from the marsh complains before rain and after fights. Review the company; I can still tell you who is pretending.')])}),
    men:node('Aurelius Lucan','Frightened, and pretending not to be. The new ones watch you to see whether they should be. So do not stare at the ford too long; they will think there is something there.',[back('There is something there.')])
  }),
  'ch4:sabinus':tree('greet',{
    greet:node('Gaius Sabinus','There are men in the outwork I trained beside. Whatever you order, tell me before you tell the drum.',[
      opt('Review our company.',null,{effects:{open:'company'}}),opt('How are the men?','men'),bye],
      {variants:freeze([variant({recovering:'sabinus'},'Didius says two more days. I say tomorrow. Review the company; he cannot stop me reading the roll.')])}),
    men:node('Gaius Sabinus','Steady enough while they have something to carry. It is the waiting they cannot do. Give them work and they will give you a wall.',[back('Then they will have work.')])
  }),
  'ch4:naso':tree('greet',{
    greet:node('Aulus Naso','The gate drum sounds like my uncle’s cough. My uncle died of it, so I would rather the drum did not.',[
      opt('What do you make of the gate?','gate'),bye],
      {variants:freeze([variant({recovering:'naso'},'Didius has me counting bandages until the arm mends. I am very good at it now. I can count to three without looking.')])}),
    gate:node('Aulus Naso','Good oak, bad hinges, like most of the men in this fort. It will hold if somebody leans on it. I am large, optio. I intend to lean.',[back('Lean well.')])
  }),
  'ch4:felix':tree('greet',{
    greet:node('Marcus Felix','If they come at night, my bow is worth about as much as a good pair of ears. I have good ears.',[
      opt('What can you see from the wall?','wall'),bye],
      {variants:freeze([variant({recovering:'felix'},'I can draw the bow again, almost. Didius says almost is not a measurement. Didius has never been shot.')])}),
    wall:node('Marcus Felix','Reeds, water, and men pretending to be reeds. Give me a clear morning and I will tell you which is which. Give me fog and I will tell you a story instead.',[back('Hope for a clear morning.')])
  }),
  // ——— Chapter V: the Euphrates staging courtyard (its other conversations are in dialogue.js) ———
  'ch5:trader':tree('greet',{
    greet:node('Barnaios the date-seller','Dates, water and linen, centurion. The households buy dates for the boats; the soldiers buy them for the wall. Nobody buys them for pleasure any more.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('What are the households saying?','rumour'),bye]),
    rumour:node('Barnaios the date-seller','That the miners can be heard from the bakers’ quarter at night. That the river is the only road left. That the centurion who decides the boats has a kind face. I told them faces are free.',[back('Faces are free.')])
  }),
  // ——— Chapter VI: the eagle’s retreat halt ———
  'ch6:varro':tree('greet',{
    greet:node('Varro','Primus pilus. The eagle is yours to carry and mine to complain about. Do not look at me like that; I am standing up, which is the whole of my duty this morning.',[
      opt('You are wounded.','wound'),
      opt('You are hiding something in your left side.','side',{conditions:{attribute:{per:13}}}),
      opt('What does the oath say when two duties pull against each other?','oath'),
      bye],{variants:freeze([
        variant({decision:{ch6:'save'}},'The western road, then. I shall complain about the wagon all the way to the river. Let me. It is how an old drill instructor says thank you.')])}),
    wound:node('Varro','A scratch I have carried since the wells. It travels well. Do not tell Didius; he will make me lie down, and a man lying down is counted with the baggage.',[back('I will not tell him.')]),
    side:node('Varro','Your eyes have improved. Your discretion has not. Leave it, primus pilus. The legion needs one man who is not looking at me, and today that man is you.',[back('Today, then.')]),
    oath:node('Varro','I gave you a drill instead of an answer once. I will not do it twice. Choose what you can still defend when the ink is dry, and then defend it, whoever reads it.',[back('I will choose.')])
  }),
  'ch6:aquilifer':tree('greet',{
    greet:node('The eagle-bearer','The bindings on the pole have worn through twice since the wells. If they part on the road, the eagle goes into the dust in front of the whole legion.',[
      opt('I will find you leather.','errand',{conditions:offered('eagle_cords')}),
      opt('Here is the leather.','bound',{conditions:inHand('eagle_cords',{item:'leather_thongs'}),effects:{take:['leather_thongs'],errand:{eagle_cords:'done'}}}),
      opt('Is the eagle bound?','after',{conditions:finished('eagle_cords'),news:false}),
      bye]),
    errand:node('The eagle-bearer','The water-seller at the refuge cuts thongs from old harness. Bring me a hank of good leather and I will bind her again before the march.',[
      opt('I will bring it.','greet',{effects:{errand:{eagle_cords:'accepted'}}}),back('Another time.')]),
    bound:node('The eagle-bearer','Wet it, pull it, let the sun dry it tight. There. She will not fall today. Tomorrow I will worry about tomorrow.',[back('Tomorrow, then.')]),
    after:node('The eagle-bearer','Bound tight. I have tested the knots four times. The men think I am praying. In a way I am.',[back('Keep praying.')])
  }),
  'ch6:severianus':tree('greet',{
    greet:node('Marcus Aurelius Severianus','Primus pilus. The order is authentic, the camp it names is not, and both facts will be in my report. Which of them comes first is still yours to decide.',[
      opt('What do you want from me?','want'),
      opt('The transport favour from the Euphrates still stands.','favour',{conditions:{decision:{ch5:'civilians'}}}),
      opt('Headquarters listens to you.','listens',{conditions:{meter:{political:{min:20}}}}),
      bye],{variants:freeze([
        variant({decision:{ch6:'save'}},'You turned west. Headquarters will call it disobedience until the army is safe, and judgment afterwards. I shall be careful to use the second word first.'),
        variant({decision:{ch6:'obey'}},'You kept to the order. The record is clean. I am sorry about Varro. I say so once, because the record has no column for it.')])}),
    want:node('Marcus Aurelius Severianus','Today? Nothing but a legion that still exists tomorrow. Favours keep better than men do; I can afford to wait for mine.',[back('You are patient.')]),
    favour:node('Marcus Aurelius Severianus','It does, and it falls due in a province you have not yet been given. Do not trouble yourself with it now. Troubling myself is my part of the bargain.',[back('As you say.')]),
    listens:node('Marcus Aurelius Severianus','Headquarters listens to whoever is still standing when it stops running. I intend to be standing. So, I think, do you.',[back('I do.')])
  }),
  'ch6:felix':tree('greet',{
    greet:node('Marcus Felix','Two tracks leave the halt to the west, and only one has water at the end of it. I would rather not find out which by walking both.',[
      opt('I will read the tracks.','errand',{conditions:offered('western_wells')}),
      opt('I have read the marker and the tracks.','report',{conditions:inHand('western_wells',{all:[{flag:'western_marker_read'},{flag:'refuge_tracks_read'}]})}),
      opt('The left-hand track.','after',{conditions:finished('western_wells'),news:false}),
      bye],{variants:freeze([variant({recovering:'felix'},'Didius has me in the shade with a bandage on my arm. I can still read ground from here, a little. Two tracks go west, and only one of them has water.')])}),
    errand:node('Marcus Felix','Read the marker on the western road, then the ground beside the refuge, where the caravans stopped before the army came. Then tell me which track the water is on.',[
      opt('I will.','greet',{effects:{errand:{western_wells:'accepted'}}}),back('Another time.')]),
    report:node('Marcus Felix','Which track?',[
      opt('The right-hand track: the horses went that way.','horses'),
      opt('The left-hand track: the wavy mark and the camels.','right',{effects:{errand:{western_wells:'done'}}}),
      opt('Neither. We dig here.','dig')]),
    horses:node('Marcus Felix','They did, and they were not our horses. Riders in a hurry go to their own water, not to ours.',[back('I will look again.')]),
    dig:node('Marcus Felix','The ground here is three men deep before it is damp. We do not have three men’s time.',[back('I will look again.')]),
    right:node('Marcus Felix','The wavy line is a well-sign; the camel men cut it for each other. Left, then. You have spared a few thousand men a long thirst, and me a long walk.',[back('Left it is.')]),
    after:node('Marcus Felix','Left. The scouts found the well where the marker said. The water tastes of camel. Nobody is complaining.',[back('Good.')])
  }),
  'ch6:marker':tree('marker',{
    marker:node('The western road marker','A milestone, its painted figures long gone, stands where the road divides into two tracks.',[
      opt('Read the marker.','read',{conditions:inHand('western_wells',{notFlag:'western_marker_read'}),effects:{flags:['western_marker_read']}}),
      opt('Look along the road.','look'),opt('Leave the marker.')]),
    read:node('The western road marker','Someone has cut fresh marks into the stone’s base: a wavy line beside the left-hand track, and a cross scratched over the right.',[opt('Leave the marker.')]),
    look:node('The western road marker','Dust hangs over the road to the east, where the army came from. The western road is empty, which is either very good or very bad.',[back('Look again.','marker'),opt('Leave the marker.')])
  }),
  'ch6:caravan':tree('tracks',{
    tracks:node('Tracks beside the refuge','The ground beside the refuge shelters is trodden hard by carts, camels and horses.',[
      opt('Read the tracks.','read',{conditions:inHand('western_wells',{notFlag:'refuge_tracks_read'}),effects:{flags:['refuge_tracks_read']}}),
      opt('Leave the tracks.')]),
    read:node('Tracks beside the refuge','Fresh camel droppings lie along the left-hand track. The right-hand one is cut up by the hooves of many horses, ridden hard, all going the same way.',[opt('Leave the tracks.')])
  }),
  'ch6:trader':tree('greet',{
    greet:node('Abgar the water-seller','Water, dates and leather, primus pilus. The water costs what it costs; I do not set the price, the desert does.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('What do you hear on the road?','rumour'),bye]),
    rumour:node('Abgar the water-seller','The riders water their horses at the wells east of here at dawn. If you want those wells, be there at night. If you want to live, do not want those wells.',[back('We go west.')])
  }),
  'ch6:lucan':tree('greet',{
    greet:node('Aurelius Lucan','The eagle. I used to think it would be heavier. It is not the bird that weighs; it is everyone watching the man who carries it.',[
      opt('Review our company.',null,{effects:{open:'company'}}),opt('How are the men?','men'),bye],
      {variants:freeze([variant({recovering:'lucan'},'Didius says the leg will carry me to the river if I let a wagon carry me first. I have agreed, with a poor grace. Review the company; I can still count.')])}),
    men:node('Aurelius Lucan','Thirsty and quiet. Quiet is worse. When they stop complaining, look for the man who has stopped walking.',[back('I will look.')])
  }),
  'ch6:sabinus':tree('greet',{
    greet:node('Gaius Sabinus','We have done this before, in the marsh. Different ground, same arithmetic: keep the people whose names you know.',[
      opt('Review our company.',null,{effects:{open:'company'}}),opt('How are the men?','men'),bye],
      {variants:freeze([variant({recovering:'sabinus'},'A spear-butt in the ribs at the wells. Didius says nothing is broken. I say it feels broken. Review the company; we can both be right.')])}),
    men:node('Gaius Sabinus','Steady while they can see the eagle. Keep it where they can see it.',[back('I will.')])
  }),
  'ch6:naso':tree('greet',{
    greet:node('Aulus Naso','I have carried water skins so long I have forgotten what it is like to carry anything heavy. I used to carry a shield, I think.',[
      opt('How are you holding up?','holding'),bye],
      {variants:freeze([variant({recovering:'naso'},'Didius says I lost a great deal of blood. I told him I have a great deal. He did not laugh. Nobody laughs at the aid awning.')])}),
    holding:node('Aulus Naso','Like a tent peg: hammered, crooked, still in the ground. Ask again at the river.',[back('At the river.')])
  }),
  // ——— Chapter VII: the council camp before Milan ———
  'ch7:severianus':tree('greet',{
    greet:node('Marcus Aurelius Severianus','Prefect. A legion, a seat at the council and a narrow stripe: I recommended all three, and I should like the record to show that I was right.',[
      opt('What do you know about the note going round the officers?','note'),
      opt('The ranks have a voice at the council now.','ranks',{conditions:{title:'advocate_of_ranks'}}),
      opt('The legion trusts me.','trust',{conditions:{meter:{army:{min:40}}}}),
      bye],{variants:freeze([
        variant({decision:{ch7:'warn'}},'You sent the warning. It will fail; good warnings usually do. But it was sent, and it was written, and one day that will matter more than whether it arrived.'),
        variant({decision:{ch7:'refuse'}},'You kept your legion out of it. Prudent. Prudence is seldom thanked and almost never punished; there are worse bargains.'),
        variant({decision:{ch7:'join'}},'You promised your silence. I will not ask what it cost. I will only remind you that silences are paid for later, with interest.')])}),
    note:node('Marcus Aurelius Severianus','That it exists, that I have not read it, and that I shall go on not having read it until the day it is safe to have done so. You may borrow the method.',[back('I may.')]),
    ranks:node('Marcus Aurelius Severianus','So I hear. Be careful: a man who speaks for the ranks once is soon expected to speak for all of them, every day, about everything.',[back('I will be careful.')]),
    trust:node('Marcus Aurelius Severianus','Then do not spend it at the council. Trust is for the field. The council runs on obligation, and you have plenty of that as well.',[back('Understood.')])
  }),
  'ch7:crispus':tree('greet',{
    greet:node('Gaius Valerius Crispus','Prefect. You have your legion. I have a letter informing me that men of my birth are of more use to the state in Rome. I am going to be of use. Watch for it.',[
      opt('Do you blame me?','blame'),
      opt('We both stood under the eagle.','eagle',{conditions:{decoration:'torques'}}),
      bye],{variants:freeze([
        variant({decision:{ch3:'claim'}},'Prefect. You have your legion, and your name at the head of every report since the road station. I have a letter sending me to Rome. I am going to be of use there. Watch for it.'),
        variant({decision:{ch3:'share'}},'Prefect. You have your legion. I have a letter sending me to Rome, and in my baggage the station report you let me present. I may yet need it. Watch for that.')])}),
    blame:node('Gaius Valerius Crispus','I blame the arithmetic. You are simply the sum it produced.',[back('That is not an answer.')]),
    eagle:node('Gaius Valerius Crispus','We did. You came out of the East with a torques, and I came out with a recommendation. Rome will weigh them differently. I intend to make Rome weigh them again.',[back('Then we will see.')])
  }),
  'ch7:theon':tree('greet',{
    greet:node('Rhetor Theon','Theon of Nicomedia, teacher of speaking, at your service and at my fee. A council is a battle in which nobody bleeds and everybody remembers.',[
      opt('Teach me a course.',null,{effects:{open:'trainer:rhetor'}}),
      opt('Teach me how to speak before the officers.','lesson',{conditions:offered('theon_order')}),
      opt('I have the order of a speech.','order',{conditions:inHand('theon_order')}),
      opt('I learned the order of a speech from the clerks’ copybooks.','copybooks',{conditions:{attribute:{elo:15}}}),
      bye]),
    lesson:node('Rhetor Theon','Five parts, prefect. First you make them willing to listen. Then you tell them what happened. Then you prove it. Then you answer the man who will object. Then you stop, before they stop listening. Tell me the order when you have it.',[
      opt('I will think it over.','greet',{effects:{errand:{theon_order:'accepted'}}}),back('Another time.')]),
    order:node('Rhetor Theon','Well?',[
      opt('Prove it, tell what happened, win them over, answer, close.','wrong'),
      opt('Win them over, tell what happened, prove it, answer the objection, close.','right',{effects:{errand:{theon_order:'done'}}}),
      opt('Answer the objection first; the rest will follow.','wrong')]),
    wrong:node('Rhetor Theon','No. You have built the roof before the walls. Again.',[back('Again.')]),
    right:node('Rhetor Theon','Exordium, narratio, confirmatio, refutatio, peroratio. You will forget the Greek and remember the order, which is the right way round.',[back('Thank you, rhetor.')]),
    copybooks:node('Rhetor Theon','Then you learned it from bad copies of Cicero. Never mind; Cicero has survived worse than clerks.',[back('He has.')])
  }),
  'ch7:quartermaster':tree('greet',{
    greet:node('Quartermaster Aper','The legion’s stores are counted to the last hobnail. If you have a complaint, prefect, let it be about something I have not already counted.',[
      opt('Equipment and pay.',null,{effects:{open:'quartermaster'}}),
      opt('The cohort’s boots were all cut on one last.','case',{conditions:inHand('boot_sizes',{flag:'boot_tally_read'})}),
      bye]),
    case:node('Quartermaster Aper','Sixty pairs on one last, yes. The contractor had one last. I had one contractor. What would you have me do, prefect, cut feet?',[
      opt('Exchange the large and small pairs from the cobblers’ stock.','agreed',{effects:{errand:{boot_sizes:'done'}}}),
      opt('Twenty men with blisters cannot march, and you will carry them.','carried',{conditions:{attribute:{elo:14}},effects:{errand:{boot_sizes:'done'}}}),
      back('I will think about it.')]),
    agreed:node('Quartermaster Aper','From the cobblers’ stock, then. They will grumble. Let them grumble at me; it is what I am for.',[back('Thank you, Aper.')]),
    carried:node('Quartermaster Aper','I would, too; I am the only man in this legion who carries everything. Very well. The cobblers will have the right pairs out by evening.',[back('Thank you, Aper.')])
  }),
  'ch7:boot-tally':tree('tally',{
    tally:node('The boot tally','A wax tablet on the stores’ table lists the boots issued to the cohort this month.',[
      opt('Read the tally against Naso’s list.','read',{conditions:inHand('boot_sizes',{notFlag:'boot_tally_read'}),effects:{flags:['boot_tally_read']}}),
      opt('Leave the tally.')]),
    read:node('The boot tally','Aper’s tally issues sixty pairs of boots, all cut on the same last. Naso’s list asks for twenty large, thirty middling and ten small.',[opt('Leave the tally.')])
  }),
  'ch7:naso':tree('greet',{
    greet:node('Aulus Naso','The new boots came. They are all the same size, which is not the size of anyone’s feet.',[
      opt('I will take it up with Aper.','errand',{conditions:offered('boot_sizes')}),
      opt('How are the boots?','after',{conditions:finished('boot_sizes'),news:false}),
      bye],{variants:freeze([variant({recovering:'naso'},'Didius has me resting a knee. The new boots came while I was lying here; they are all the same size, which is not the size of anyone’s feet.')])}),
    errand:node('Aulus Naso','Here is the cohort’s list: twenty large, thirty middling, ten small. Look at Aper’s tally before you speak to him. He believes nothing that is not in his own writing.',[
      opt('I will.','greet',{effects:{errand:{boot_sizes:'accepted'}}}),back('Another time.')]),
    after:node('Aulus Naso','The cobblers came round with the right pairs. The men are calling it the battle of the boots. You won it, and nobody died, which is more than most battles manage.',[back('A good battle.')])
  }),
  'ch7:felix':tree('greet',{
    greet:node('Marcus Felix','Italy smells of rain and wet leather. In the East rain was a rumour. Here it is a habit.',[
      opt('What do you hear in the camp?','hear'),bye],
      {variants:freeze([variant({recovering:'felix'},'Didius has my bow arm in a sling. Italy smells of rain and wet leather, and of the officers’ tents, which smell of secrets.')])}),
    hear:node('Marcus Felix','That the emperor sleeps badly, and that certain officers sleep very well. I would not stand near those officers in a storm.',[back('Nor would I.')])
  }),
  'ch7:lucan':tree('greet',{
    greet:node('Aurelius Lucan','There is a note going round the officers’ tents. Men stop talking when I walk in. I am a centurion; men always stop talking when I walk in, but not like this.',[
      opt('Review our company.',null,{effects:{open:'company'}}),opt('What would you do?','advice'),bye],
      {variants:freeze([variant({recovering:'lucan'},'Back on a cot, prefect. The leg again. From here I can hear the officers’ tents go quiet when the wrong man walks past. Review the company; I will tell you who is listening.')])}),
    advice:node('Aurelius Lucan','Keep the legion’s name off it. Whatever you decide for yourself, the men did not swear to a note.',[back('I will remember.')])
  }),
  'ch7:sabinus':tree('greet',{
    greet:node('Gaius Sabinus','The officers are whispering. In the marsh nobody whispered; we shouted, and the shouting was honest. I preferred the marsh.',[
      opt('Review our company.',null,{effects:{open:'company'}}),opt('What would you do?','advice'),bye],
      {variants:freeze([variant({recovering:'sabinus'},'Didius has me resting. The officers are whispering again; I can hear them from here. Review the company; I can still tell you who is steady.')])}),
    advice:node('Gaius Sabinus','Decide in daylight, where the men can see you decide. Whatever happens in that tent will be told around a fire within a day.',[back('In daylight, then.')])
  }),
  'ch7:trader':tree('greet',{
    greet:node('Vibia the wine-seller','Wine from Mediolanum, oil from the lakes and fish sauce from somewhere you would rather not ask about, prefect. Everything is fresh except the gossip.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('What is the gossip?','rumour'),bye]),
    rumour:node('Vibia the wine-seller','In Mediolanum they say the emperor sleeps badly. In Mediolanum they say a great many things; most of them are about the price of wine.',[back('I will keep it in mind.')])
  }),
  // ——— Chapter VIII: the Danube ferry assembly ———
  'ch8:severianus':tree('greet',{
    greet:node('Marcus Aurelius Severianus','Praepositus. Every family on that sand will remember who crossed first. So will every veteran. Choose which memory you can live beside.',[
      opt('What do the Goths and Carpi want?','want'),
      opt('My silence before Milan.','silence',{conditions:{decision:{ch7:'join'}}}),
      bye],{variants:freeze([
        variant({decision:{ch8:'families'}},'Families first. Generous. The land pledge will fall due in your governorship; I do hope you are given one.'),
        variant({decision:{ch8:'soldiers'}},'Veterans first. Sensible. The families will forgive you eventually; families are better at it than armies.')])}),
    want:node('Marcus Aurelius Severianus','Grain, captives and reassurance, in a different order depending on whom you ask. Ask each of them separately. It saves time at the vote.',[back('Separately, then.')]),
    silence:node('Marcus Aurelius Severianus','Is not spoken of here. That is how silence works, praepositus. It is also how it is paid for.',[back('I understand.')])
  }),
  'ch8:aelia':tree('greet',{
    greet:node('Aelia Dacia','Aelia Dacia. I keep the households’ names. If you have come to count us, count carefully; we have been counted wrongly before.',[
      opt('Is there anything the households need before the boats?','errand',{conditions:offered('seed_jar')}),
      opt('Here is the Ulpii’s jar.','found',{conditions:inHand('seed_jar',{item:'seed_jar'}),effects:{take:['seed_jar'],errand:{seed_jar:'done'}}}),
      opt('I carried a man out of the marsh at Abritus.','marsh',{conditions:{decoration:'corona_civica'}}),
      opt('The people trust the army a little more these days.','trust',{conditions:{meter:{public:{min:30}}}}),
      bye],{variants:freeze([
        variant({decision:{ch8:'families'}},'You put the families first. I have written it beside your name. I write everything beside your name; you may come to regret that.'),
        variant({decision:{ch8:'soldiers'}},'Veterans first. I understand the arithmetic. I have also written down the people who will wait because of it.')])}),
    errand:node('Aelia Dacia','The Ulpii left their seed jar among the ferry stores when the porters moved the bundles. Seed is next year. Without it the far bank is only a place to be hungry. Find the jar; it has a blue thread round its neck.',[
      opt('I will find it.','greet',{effects:{errand:{seed_jar:'accepted'}}}),back('Another time.')]),
    found:node('Aelia Dacia','A blue thread. That is the one. Old Ulpius will pretend he never lost it. Let him.',[back('Let him.')]),
    marsh:node('Aelia Dacia','Then you know what I keep telling the clerks: a name is a person with somewhere to be. Help me get them there.',[back('I will.')]),
    trust:node('Aelia Dacia','A little. Trust is like seed. You do not eat it in the year you are given it.',[back('I know.')])
  }),
  'ch8:seed-jar':tree('jar',{
    jar:node('A seed jar among the stores','Among the ferry stores stands a small sealed jar with a blue thread tied round its neck.',[
      opt('Take the jar for Aelia.','taken',{conditions:inHand('seed_jar',{notFlag:'seed_jar_taken'}),effects:{give:['seed_jar'],flags:['seed_jar_taken']}}),
      opt('Leave it.')]),
    taken:node('A seed jar among the stores','The jar is heavier than it looks. Something inside it rustles like dry rain.',[opt('Leave the stores.')])
  }),
  'ch8:felix':tree('greet',{
    greet:node('Marcus Felix','The ferrymen say the carts can cross at the landing if the water is low. The ferrymen say that about every landing. Let us find out.',[
      opt('I will sound the landing.','errand',{conditions:offered('ford_soundings')}),
      opt('I have sounded the landing and read the board.','report',{conditions:inHand('ford_soundings',{all:[{flag:'landing_sounded'},{flag:'depth_board_read'}]})}),
      opt('The carts go by the shallows.','after',{conditions:finished('ford_soundings'),news:false}),
      bye],{variants:freeze([variant({recovering:'felix'},'I am on the aid station’s bench with my arm bound, which leaves my eyes free. The ferrymen say the carts can cross at the landing. Somebody should find out.')])}),
    errand:node('Marcus Felix','Take the sounding pole at the landing and see how deep it goes near the bank, in the middle and by the far mooring. The ferrymen’s board in the stores says how deep a cart can go. Then tell me where the carts can cross.',[
      opt('I will.','greet',{effects:{errand:{ford_soundings:'accepted'}}}),back('Another time.')]),
    report:node('Marcus Felix','Where can the carts go?',[
      opt('Straight across the middle.','middle'),
      opt('Along the near bank, then out to the far mooring.','right',{effects:{errand:{ford_soundings:'done'}}}),
      opt('Nowhere. Everything goes by boat.','boats')]),
    middle:node('Marcus Felix','The middle took the pole to the third notch. A cart goes in at two and comes out as firewood.',[back('I will look again.')]),
    boats:node('Marcus Felix','Then we will still be here at midsummer. Look again.',[back('I will look again.')]),
    right:node('Marcus Felix','The near bank at one notch, the mooring at two. The carts go along the shallows. That is the first kind thing the river has done for us.',[back('Along the shallows.')]),
    after:node('Marcus Felix','Along the shallows. Two carts have crossed already with nothing worse than wet axles. The ferrymen are claiming it was their idea.',[back('Let them.')])
  }),
  'ch8:sounding-pole':tree('pole',{
    pole:node('The sounding pole','A long pole marked with notches leans against the mooring post at the landing.',[
      opt('Sound the landing.','sounded',{conditions:inHand('ford_soundings',{notFlag:'landing_sounded'}),effects:{flags:['landing_sounded']}}),
      opt('Leave the pole.')]),
    sounded:node('The sounding pole','The pole sinks to the first notch near the bank, to the third at the middle of the landing, and finds gravel again at the second notch by the far mooring.',[opt('Leave the pole.')])
  }),
  'ch8:depth-marks':tree('board',{
    board:node('The ferrymen’s depth board','A board chalked with the ferrymen’s rules hangs on the stores’ post.',[
      opt('Read the board.','read',{conditions:inHand('ford_soundings',{notFlag:'depth_board_read'}),effects:{flags:['depth_board_read']}}),
      opt('Leave the board.')]),
    read:node('The ferrymen’s depth board','A loaded cart crosses where the pole goes in to two notches. A horse swims at four. Below that the board says only, in large letters: boat.',[opt('Leave the board.')])
  }),
  'ch8:naso':tree('greet',{
    greet:node('Aulus Naso','The rope at the landing is older than I am, and in better health.',[
      opt('How are the men taking the crossing?','men'),bye],
      {variants:freeze([variant({recovering:'naso'},'Didius has me on the bank with my arm in a sling, watching the boats. It is the most restful duty I have had since Novae. Do not tell anyone.')])}),
    men:node('Aulus Naso','The veterans want the first boats and are ashamed of wanting them. The children think it is a holiday. I am on the children’s side.',[back('So am I.')])
  }),
  'ch8:lucan':tree('greet',{
    greet:node('Aurelius Lucan','The children think the boats are a game. Let them. Somebody ought to enjoy the river.',[
      opt('Review our company.',null,{effects:{open:'company'}}),opt('Who should cross first?','first'),bye],
      {variants:freeze([variant({recovering:'lucan'},'I am on the landing aid station’s bench, which has the best view of the boats in Dacia. Review the company; I can watch the river and the roll at once.')])}),
    first:node('Aurelius Lucan','Whoever you choose, someone will say it was the wrong people first. Choose so that you can say why to their faces.',[back('To their faces.')])
  }),
  'ch8:sabinus':tree('greet',{
    greet:node('Gaius Sabinus','Give me a clear order and I will bring the rear guard across after it. I learned that much in the marsh.',[
      opt('Review our company.',null,{effects:{open:'company'}}),opt('Who should cross first?','first'),bye],
      {variants:freeze([variant({recovering:'sabinus'},'Didius has me resting a bad shoulder by the landing. Give me a clear order anyway; I can shout it across the water.')])}),
    first:node('Gaius Sabinus','The ones who cannot wait. The ones who can will tell you they cannot. Learn the difference before the boats are full.',[back('I will.')])
  }),
  'ch8:trader':tree('greet',{
    greet:node('Dida the honey-seller','Honey from the hills and fish from the river, praepositus. I am selling everything I cannot carry across.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('What do they say in the hills?','rumour'),bye]),
    rumour:node('Dida the honey-seller','The Carpi in the hills say the Romans are leaving because they are afraid. The Romans on this bank say the Carpi are coming because they are hungry. Both may be right.',[back('Both may be.')])
  }),
  // ——— Chapter IX: the surrender court on campaign ———
  'ch9:severianus':tree('greet',{
    greet:node('Marcus Aurelius Severianus','Commander. Six cohorts and a wing of horse. The emperor will remember the victory; I should like him also to remember who recommended the man who won it.',[
      opt('Which approach would you choose?','approach'),
      opt('The hasta pura came with the keys.','spear',{conditions:{decoration:'hasta_pura'}}),
      bye],{variants:freeze([
        variant({decision:{ch9:'mercy'}},'You protected the city. The soldiers grumble, and grumbling soldiers are living soldiers, which is a kind of victory the emperor does not count.'),
        variant({decision:{ch9:'severity'}},'Exemplary punishment. Effective. The city will remember it longer than the army remembers the plunder.')])}),
    approach:node('Marcus Aurelius Severianus','Every approach asks the army to believe something difficult. Choose the one you can explain to a frightened man in one sentence.',[back('One sentence.')]),
    spear:node('Marcus Aurelius Severianus','So it did. A spear without a point: the army’s way of saying you may command without stabbing anyone yourself. Enjoy it while it lasts.',[back('I will.')])
  }),
  'ch9:envoy':tree('greet',{
    greet:node('The city’s envoy','I speak for the council of the city. We will give you the keys if you secure the approach. Before we give them, we would like to know what the keys will open.',[
      opt('What does the council need from me?','errand',{conditions:offered('market_keys')}),
      opt('I have read the requisition tally.','count',{conditions:inHand('market_keys',{flag:'granaries_counted'})}),
      opt('The granaries are counted.','after',{conditions:finished('market_keys'),news:false}),
      opt('Rome keeps the terms it gives.','terms',{conditions:{meter:{public:{min:35}}}}),
      bye],{variants:freeze([
        variant({decision:{ch9:'mercy'}},'Your terms protect our households and our markets. The council has read them twice, commander: once to believe them, and once to be sure.'),
        variant({decision:{ch9:'severity'}},'Your terms are known. The council will obey them. Do not ask the council to be grateful as well.')])}),
    errand:node('The city’s envoy','A number. Your requisition court has counted our granaries. Tell me how many it has counted, and the council will know whether your army counts honestly.',[
      opt('I will find out.','greet',{effects:{errand:{market_keys:'accepted'}}}),back('Another time.')]),
    count:node('The city’s envoy','How many?',[
      opt('Eleven inside the walls, and the river warehouse.','right',{effects:{errand:{market_keys:'done'}}}),
      opt('Three granaries.','three'),
      opt('Thirty.','thirty')]),
    three:node('The city’s envoy','Three are the temple stores. You have counted only the gods’ share.',[back('I will read it again.')]),
    thirty:node('The city’s envoy','Thirty! Commander, if we had thirty granaries we would have bought the emperor’s favour, not asked for it.',[back('I will read it again.')]),
    right:node('The city’s envoy','Eleven, and the river warehouse. That is what we have. Your clerks counted honestly. I did not expect it, and I will say so to the council.',[back('Say so.')]),
    terms:node('The city’s envoy','Rome keeps the terms it gives when its commanders are watched, commander. The council will watch you. So, I think, will Rome.',[back('Let them watch.')]),
    after:node('The city’s envoy','The council has the number. It is arguing about what the number means, which is what councils are for.',[back('Let it argue.')])
  }),
  'ch9:requisition-tally':tree('tally',{
    tally:node('The requisition tally','The requisition court’s tablets are stacked under a weighted cloth against the dust.',[
      opt('Read the tally of the city’s granaries.','read',{conditions:inHand('market_keys',{notFlag:'granaries_counted'}),effects:{flags:['granaries_counted']}}),
      opt('Leave the tally.')]),
    read:node('The requisition tally','The tally lists eleven granaries inside the walls, three of them marked as temple stores, and a river warehouse outside the gate.',[opt('Leave the tally.')])
  }),
  'ch9:cornicen':tree('greet',{
    greet:node('The wing’s cornicen','I can blow anything the commander likes, as long as the commander likes it loud.',[
      opt('Agree the wing’s recall signal.','choose',{conditions:inHand('recall_signal',{all:[{notFlag:'recall_three'},{notFlag:'recall_long'},{notFlag:'recall_rising'}]})}),
      bye]),
    choose:node('The wing’s cornicen','Which call shall it be? Choose one the horses have not heard every morning, or they will come back for breakfast.',[
      opt('Three short calls.','agreed',{effects:{flags:['recall_three']}}),
      opt('One long call, then one short.','agreed',{effects:{flags:['recall_long']}}),
      opt('A rising call, twice.','agreed',{effects:{flags:['recall_rising']}})]),
    agreed:node('The wing’s cornicen','Then that is the recall. I will blow it, the wing will hear it, and whether it obeys is between the wing and the gods.',[back('Thank you.')])
  }),
  ...Object.fromEntries(['lucan','sabinus'].map(id=>{
    const name=id==='lucan'?'Aurelius Lucan':'Gaius Sabinus',signal=[['recall_three','Three short calls.'],['recall_long','One long call, then one short.'],['recall_rising','A rising call, twice.']];
    return [`ch9:${id}`,tree('greet',{
      greet:node(name,id==='lucan'?'I will take the detached wing. If you call it back, make the signal plain.':'My wing knows how to yield ground. It needs to know the call that brings it back.',[
        opt('Review our company.',null,{effects:{open:'company'}}),
        opt('I will agree the recall with the cornicen.','errand',{conditions:offered('recall_signal')}),
        opt('The recall signal is agreed.','recall',{conditions:inHand('recall_signal',{any:signal.map(([flag])=>({flag}))})}),
        opt('About the recall.','after',{conditions:finished('recall_signal'),news:false}),
        bye],{variants:freeze([variant({recovering:id},id==='lucan'?'The surgeons have my leg strapped, and they want me on a horse by the morning. I will take the wing. If you call it back, make the signal plain.':'The surgeons have strapped my shoulder. I will ride anyway. Agree the recall with the cornicen; my wing needs to know the call that brings it back.')])}),
      errand:node(name,'Then go and choose it with the wing’s cornicen, and come and tell me what it is. I would rather hear it from you than guess it in the dust.',[
        opt('I will.','greet',{effects:{errand:{recall_signal:'accepted'}}}),back('Another time.')]),
      recall:node(name,'Then tell me. What will I hear?',signal.flatMap(([flag,text])=>[
        opt(text,'right',{conditions:{flag},effects:{errand:{recall_signal:'done'}}}),
        opt(text,'wrong',{conditions:{notFlag:flag}})])),
      wrong:node(name,'That is not what the cornicen told me; I asked him myself. Go and hear it again. I would rather be sure than brave.',[back('I will ask him.')]),
      right:node(name,'Then I will listen for it, and so will every man in the wing. Plain enough for a frightened horse.',[back('Plain enough.')]),
      after:node(name,'The wing has practised the recall twice. The horses know it now. So do the men, which was the harder part.',[back('Good.')])
    })];
  })),
  'ch9:naso':tree('greet',{
    greet:node('Aulus Naso','The cavalry eat first, drink first and sleep in the shade. I have asked whether I can become a horse. Nobody has answered.',[
      opt('How is the infantry?','infantry'),bye],
      {variants:freeze([variant({recovering:'naso'},'The field surgeons say I am to sit in the shade, which makes me the only infantryman treated like a horse. I am enjoying it more than I should.')])}),
    infantry:node('Aulus Naso','Hot, steady and cross. That is the right mixture. Do not let them cool down before the city.',[back('I will not.')])
  }),
  'ch9:felix':tree('greet',{
    greet:node('Marcus Felix','The armoured horse wear their iron in the noon heat as if it were silk. It is not silk. Make them chase you long enough and they will find that out.',[
      opt('What do you see from the walls?','walls'),
      opt('How long can armoured horse ride in this heat?','heat',{conditions:{attribute:{field:12}}}),bye],
      {variants:freeze([variant({recovering:'felix'},'The surgeons have stitched my arm. I can still watch, and what I see is armoured horse who think the noon heat is their friend.')])}),
    heat:node('Marcus Felix','Until noon at a walk, an hour less at the gallop, and then the horses stop deciding for their riders. You knew that. You only wanted to hear me say it.',[back('I did.')]),
    walls:node('Marcus Felix','Women carrying jars to the cisterns, men carrying nothing at all. The city is waiting to see what you are. So am I, commander; it has been an interesting few years.',[back('It has.')])
  }),
  'ch9:trader':tree('greet',{
    greet:node('Malku the incense-seller','Incense, dates and a blue eye against envy, commander. You will need the eye; a man with your victories is envied twice a day.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('What does the city say?','rumour'),bye]),
    rumour:node('Malku the incense-seller','The merchants are hiding their silver in the cisterns. The merchants’ wives are hiding the merchants in the same place.',[back('I will not look there.')])
  }),
  // ——— Chapter X: the governor’s relief courtyard ———
  'ch10:severianus':tree('greet',{
    greet:node('Marcus Aurelius Severianus','Governor. A province is a great honour; I said so when you were given it, and I say so now, standing in your courtyard, with my veterans waiting outside it.',[
      opt('What do your veterans want?','want'),bye]),
    want:node('Marcus Aurelius Severianus','Grain, governor, like everyone else in your province.',[back('Like everyone else.')],{variants:freeze([
      variant({decision:{ch5:'civilians'}},'Priority in your next supply requisition, as you promised on the Euphrates when the households needed my transport. Nothing unlawful is written there. Nothing in a favour’s first sentence ever is.'),
      variant({decision:{ch5:'countermine'}},'Nothing from you. You kept your century under the tower and owed me nothing for it. They want grain, governor, like everyone else in your province.')])})
  }),
  'ch10:provincial-clerk':tree('greet',{
    greet:node('The provincial clerk','I allocate convoys and copy judgments, governor, and I should like it known that I have never sold a measure of grain to my brother. I have no brother.',[
      opt('How much grain went missing?','errand',{conditions:offered('granary_receipts')}),
      opt('I have read the receipts and the warehouse tally.','count',{conditions:inHand('granary_receipts',{all:[{flag:'receipts_read'},{flag:'warehouse_read'}]})}),
      opt('The eighty modii.','after',{conditions:finished('granary_receipts'),news:false}),
      bye]),
    errand:node('The provincial clerk','That is what I cannot yet prove. The granary receipts are at the relief granary; the warehouse tally we seized is on the hearing table. Read both and tell me how much grain went out by the back door.',[
      opt('I will read them.','greet',{effects:{errand:{granary_receipts:'accepted'}}}),back('Another time.')]),
    count:node('The provincial clerk','How much?',[
      opt('Eighty modii.','right',{effects:{errand:{granary_receipts:'done'}}}),
      opt('Four hundred modii.','all'),
      opt('None; the tallies agree.','none')]),
    all:node('The provincial clerk','That is what came in, governor. If all of it had been stolen, the towns would have told us so, loudly.',[back('I will read them again.')]),
    none:node('The provincial clerk','They agree only if you do not read them. Read them.',[back('I will read them again.')]),
    right:node('The provincial clerk','Eighty. Four hundred came in from the barges, three hundred and twenty went out to the towns, and eighty went to a warehouse that bought what it never paid for. I will write it plainly. Plainness is the only revenge a clerk has.',[back('Write it plainly.')]),
    after:node('The provincial clerk','The eighty modii are in the record, plainly. The clerk’s neighbours keep their ration; his brother keeps his warehouse, for now, with nothing in it.',[back('Good.')])
  }),
  'ch10:granary-receipts':tree('receipts',{
    receipts:node('The granary receipts','Receipts for the relief granary hang on a cord by the granary door, one tablet for each barge and each convoy.',[
      opt('Read the receipts.','read',{conditions:inHand('granary_receipts',{notFlag:'receipts_read'}),effects:{flags:['receipts_read']}}),
      opt('Leave the receipts.')]),
    read:node('The granary receipts','The receipts record four hundred modii received from the river barges this month, and three hundred and twenty issued to the towns.',[opt('Leave the receipts.')])
  }),
  'ch10:warehouse-tally':tree('tally',{
    tally:node('The seized warehouse tally','The warehouse’s own tablets, seized from the clerk’s brother, lie on the hearing table under the court’s seal.',[
      opt('Read the warehouse tally.','read',{conditions:inHand('granary_receipts',{notFlag:'warehouse_read'}),effects:{flags:['warehouse_read']}}),
      opt('Leave the tally.')]),
    read:node('The seized warehouse tally','The tally records eighty modii bought from the provincial granary this month. No payment is entered beside them.',[opt('Leave the tally.')])
  }),
  'ch10:theon':tree('greet',{
    greet:node('Rhetor Theon','Governor. A tribunal is a council with a judge in it, which makes everyone more honest and nobody braver.',[
      opt('Teach me a course.',null,{effects:{open:'trainer:rhetor'}}),
      opt('Is there a witness I should hear?','errand',{conditions:offered('frightened_witness')}),
      opt('Licinia will speak.','spoken',{conditions:inHand('frightened_witness',{flag:'witness_persuaded'}),effects:{errand:{frightened_witness:'done'}}}),
      bye]),
    errand:node('Rhetor Theon','Licinia, a widow from the river farms. She saw who moved the survey markers, and she will not say so in front of the men who own the fields beside hers. Persuade her, governor. I can teach a man to speak. I cannot teach him to be unafraid.',[
      opt('I will talk to her.','greet',{effects:{errand:{frightened_witness:'accepted'}}}),back('Another time.')]),
    spoken:node('Rhetor Theon','Then the tribunal will hear something true, which is rarer than you would think. Thank you, governor.',[back('Thank her, not me.')])
  }),
  'ch10:witness':tree('greet',{
    greet:node('Licinia of the river farms','I have nothing to say to the tribunal, governor. I have neighbours.',[
      opt('The tribunal hears the quiet as well as the loud, and I will see that it does.','persuaded',{conditions:inHand('frightened_witness',{notFlag:'witness_persuaded',attribute:{elo:14}}),effects:{flags:['witness_persuaded']}}),
      opt('I carried a wounded man out of the marsh at Abritus. I will not leave you standing alone.','persuaded',{conditions:inHand('frightened_witness',{notFlag:'witness_persuaded',decoration:'corona_civica'}),effects:{flags:['witness_persuaded']}}),
      opt('Aelia Dacia will stand beside you.','persuaded',{conditions:inHand('frightened_witness',{notFlag:'witness_persuaded',flag:'aelia_vouched'}),effects:{flags:['witness_persuaded']}}),
      opt('Please.','please',{conditions:inHand('frightened_witness',{notFlag:'witness_persuaded'})}),
      opt('Will you still speak?','ready',{conditions:{flag:'witness_persuaded'},news:false}),
      bye]),
    persuaded:node('Licinia of the river farms','Then I will say it once, and you will write it down, and nobody will make me say it twice.',[back('Once is enough.')]),
    please:node('Licinia of the river farms','Please is what the men with the fields say too, governor.',[back('I understand.')]),
    ready:node('Licinia of the river farms','Once. I said once. I am a woman of my word, which is more than the markers were.',[back('Once.')])
  }),
  'ch10:aelia':tree('greet',{
    greet:node('Aelia Dacia','Governor. You once told us the river was the hard part. I do not remember whether I believed you.',[
      opt('Will you vouch for me to Licinia?','vouch',{conditions:inHand('frightened_witness',{notFlag:'aelia_vouched'}),effects:{flags:['aelia_vouched']}}),
      opt('We put the families first at the river.','families',{conditions:{decision:{ch8:'families'}}}),
      opt('How is the Ulpii’s seed?','seed',{conditions:finished('seed_jar'),news:false}),
      bye],{variants:freeze([
        variant({decision:{ch10:'shared'}},'Shared tenure. Neither side has thanked you, governor, which is how I know it was fair.'),
        variant({decision:{ch10:'settlers'}},'First title to the displaced. My people will plant this spring. Their neighbours will remember the fields they lost; I will remember both.')])}),
    vouch:node('Aelia Dacia','I will. Licinia’s husband carried my brother’s bundles at the crossing. She owes me nothing, which is why she will listen.',[back('Thank you.')]),
    families:node('Aelia Dacia','You did. It is written. I am about to find out whether writing it was enough.',[back('So am I.')]),
    seed:node('Aelia Dacia','Planted, on the south slope. The first green came up crooked, like old Ulpius. He says it is the best barley in Dacia. He says that of everything he grows.',[back('He may be right.')])
  }),
  ...Object.fromEntries([['lucan','Aurelius Lucan','A governor’s guard. We stand about in a courtyard and frighten petitioners. I preferred the frontier; at least the raiders knew why they were frightened.','The province has given me a cot and a view of the granary. Review the company; I can tell you who is bored, which is everyone.'],
    ['sabinus','Gaius Sabinus','A guard in a courtyard. The petitioners look at our spears as if we were the reason they are hungry. Sometimes, I think, we were.','A sprain from the grain road. Didius has me sitting with the petitioners, which has taught me more about this province than the road did.']].map(([id,name,text,recovering])=>
    [`ch10:${id}`,tree('greet',{greet:node(name,text,[opt('Review our company.',null,{effects:{open:'company'}}),bye],{variants:freeze([variant({recovering:id},recovering)])})})])),
  'ch10:naso':tree('greet',{
    greet:node('Aulus Naso','The petitioners bring their children to look at the soldiers. I have been looked at by more children this month than in my whole life.',[bye],
      {variants:freeze([variant({recovering:'naso'},'I am in the public aid shelter with the petitioners’ sick. They have decided I am a soldier and therefore know everything. I do not.')])})
  }),
  'ch10:felix':tree('greet',{
    greet:node('Marcus Felix','The grain road is open. I walked it twice. Nothing on it now but carts, and a dog that follows the carts.',[bye],
      {variants:freeze([variant({recovering:'felix'},'An arrow on the grain road. Didius says I was lucky; I say lucky men are not shot at. The road is open, at least.')])})
  }),
  'ch10:trader':tree('greet',{
    greet:node('Caecilia the grain-seller','Oil, honey and wax, governor, and grain when the tribunal lets me sell it, which is not today.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('What do the petitioners say?','rumour'),bye]),
    rumour:node('Caecilia the grain-seller','The tribunal’s benches are full of men who have never sat on a bench before. They sit like men who expect to be told to stand up.',[back('They may be.')])
  }),
  // ——— Chapter XI: the service-record portico at Rome ———
  'ch11:paullus':tree('greet',{
    greet:node('Lucius Cassius Paullus','I sit on the committee that will read your accounts, which is why I am reading them now, before anyone has a reason to read them badly.',[
      opt('What does the committee want to see?','errand',{conditions:offered('station_report')}),
      opt('Here is a fair copy of the station report.','read',{conditions:inHand('station_report',{item:'report_copy'}),effects:{take:['report_copy'],errand:{station_report:'done'}}}),
      opt('I would rather be judged on my record than on my friends.','record',{conditions:{attribute:{auth:16}}}),
      opt('I kept the legion’s rolls once.','rolls',{conditions:{title:'clerk_of_rolls'}}),
      bye]),
    errand:node('Lucius Cassius Paullus','The first report that bears your name: the recovery at the road station, years ago. Crispus will bring his copy. I should like to see yours. It is among the records on the table; make me a fair copy.',[
      opt('I will copy it.','greet',{effects:{errand:{station_report:'accepted'}}}),back('Another time.')]),
    read:node('Lucius Cassius Paullus','I have read it.',[back('What will you tell the committee?')],{variants:freeze([
      variant({decision:{ch3:'claim'}},'Your own name heads it. Crispus will say you were ambitious. I shall say you were accurate. We shall both be right, which is the trouble with records.'),
      variant({decision:{ch3:'share'}},'Crispus presented it, and acknowledged your work in his own hand. He will find that harder to forget than he would like. So, I think, will the committee.')])}),
    record:node('Lucius Cassius Paullus','So would every candidate, until he sees his record. Yours bears looking at. Your friends I have not yet met.',[back('You will.')]),
    rolls:node('Lucius Cassius Paullus','Then you know that a roll is the only part of an army that remembers anything. Keep this one honest; I shall be reading it.',[back('I will.')])
  }),
  'ch11:station-report':tree('records',{
    records:node('The service records','Your service tablets lie on the records table in order, the oldest at the bottom: the recovery report from the road station.',[
      opt('Make a fair copy of the station report.','copied',{conditions:inHand('station_report',{notFlag:'station_report_copied'}),effects:{give:['report_copy'],flags:['station_report_copied']}}),
      opt('Read the station report.','read'),opt('Leave the records.')]),
    copied:node('The service records','You copy it line by line, the faded ink beside the fresh. The hand that wrote the first was younger than yours.',[opt('Leave the records.')]),
    read:node('The service records','The report of the recovery at the road station, with the pay chest and the rolls.',[back('Look at the other tablets.','records'),opt('Leave the records.')],{variants:freeze([
      variant({decision:{ch3:'claim'}},'The report of the recovery at the road station. Your own name heads it, above the pay chest, the rolls and the names of the men who carried them.'),
      variant({decision:{ch3:'share'}},'The report of the recovery at the road station, presented by the tribune Crispus. Beneath his name, in his own hand, he acknowledges your work in finding the chest.')])})
  }),
  'ch11:crispus':tree('greet',{
    greet:node('Gaius Valerius Crispus','Candidate. I have a question for the committee, about how a soldier counts hunger. I thought it fair to ask it of you first.',[
      opt('Ask it, and I will bring you the answer in writing.','errand',{conditions:offered('province_accounts')}),
      opt('Here are the provincial accounts.','read',{conditions:inHand('province_accounts',{item:'accounts_copy'}),effects:{take:['accounts_copy'],errand:{province_accounts:'done'}}}),
      opt('You presented the station recovery.','share',{conditions:{decision:{ch3:'share'}}}),
      bye]),
    errand:node('Gaius Valerius Crispus','Bring me the audited accounts of your province. If they are honest, I will say so in the committee, briefly. If they are not, I will say so at length.',[
      opt('You will have them.','greet',{effects:{errand:{province_accounts:'accepted'}}}),back('Another time.')]),
    read:node('Gaius Valerius Crispus','Honest, I see. Inconveniently honest. I will have to find a better question.',[back('Find one.')],{variants:freeze([
      variant({decision:{ch10:'shared'}},'Shared tenure, seed relief, and a granary thief caught with eighty modii. Honest, I see. Inconveniently honest. I shall have to find a better question.'),
      variant({decision:{ch10:'settlers'}},'Title for the displaced, debts for the tenants, and a granary thief caught with eighty modii. Honest. I shall have to find a better question, and I think the tenants will give me one.')])}),
    share:node('Gaius Valerius Crispus','I did, with your acknowledgement in my own hand. Do not remind the committee of it. I shall remind them myself, so that it sounds like generosity.',[back('As you like.')])
  }),
  'ch11:province-accounts':tree('accounts',{
    accounts:node('The provincial accounts','The audited accounts of your province, copied by the household’s clerks, lie in a locked box in the stores.',[
      opt('Take a copy for Crispus.','taken',{conditions:inHand('province_accounts',{notFlag:'province_accounts_taken'}),effects:{give:['accounts_copy'],flags:['province_accounts_taken']}}),
      opt('Leave the box.')]),
    taken:node('The provincial accounts','The copy is heavy with numbers: convoys, receipts, the eighty modii and the names of the towns that received the rest.',[opt('Leave the box.')])
  }),
  'ch11:theon':tree('greet',{
    greet:node('Rhetor Theon','Rome, candidate. Here every man is a speaker and every speaker is a critic. Practise on me; I am cheaper than the Senate.',[
      opt('Teach me a course.',null,{effects:{open:'trainer:rhetor'}}),opt('How do I speak to the Senate?','senate'),bye]),
    senate:node('Rhetor Theon','Briefly, and as if you had all afternoon. They admire a man who does not need their time. They vote for a man who has used it well.',[back('Briefly, then.')])
  }),
  'ch11:severianus':tree('greet',{
    greet:node('Marcus Aurelius Severianus','Candidate. I can introduce you to a dependable bloc. You have heard my price; I have not changed it, and I do not intend to.',[
      opt('Why do you still help me?','why'),bye],{variants:freeze([
        variant({decision:{ch11:'independent'}},'You refused the bloc. Admirable. The Senate admires independence the way it admires a storm: from indoors.'),
        variant({decision:{ch11:'patron'}},'You accepted. My nephew thanks you, in advance, which is the only way he ever thanks anyone.')])}),
    why:node('Marcus Aurelius Severianus','Because a man who rises without me is a man who will not remember me. And because you are good at this, which I find I enjoy watching.',[back('I will remember.')])
  }),
  ...Object.fromEntries([['lucan','Aurelius Lucan','Rome. I have seen it now. It is very large, and nobody in it has heard of my father’s mill.','Didius found me a couch in the household aid room. Rome’s couches are softer than the frontier’s and worse for the temper.'],
    ['sabinus','Gaius Sabinus','An escort in Rome. We walk behind you and look as if we could fight the Senate. We could not.','Didius has me on a couch in the aid room. Rome is very loud from a couch.']].map(([id,name,text,recovering])=>
    [`ch11:${id}`,tree('greet',{greet:node(name,text,[opt('Review our company.',null,{effects:{open:'company'}}),bye],{variants:freeze([variant({recovering:id},recovering)])})})])),
  'ch11:trader':tree('greet',{
    greet:node('Atticus the bookseller','Papyrus, wax, a little oil and a great deal of advice, candidate. The papyrus is from Egypt; the advice is my own.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('What is the city reading?','rumour'),bye]),
    rumour:node('Atticus the bookseller','The senators are buying Cicero again. They do that whenever they expect to lose an argument.',[back('Then sell them Cicero.')])
  }),
  // ——— Chapter XII: the loyal standards court ———
  'ch12:severianus':tree('greet',{
    greet:node('Marcus Aurelius Severianus','Senator. I find myself at the head of a column of supporters, which is new to me; usually I stand at the back, with the ledger.',[
      opt('What do you expect, if I win?','expect'),bye]),
    expect:node('Marcus Aurelius Severianus','An audience, when I ask for one. Obedience I stopped expecting when you were a centurion.',[back('An audience, then.')])
  }),
  'ch12:messenger':tree('greet',{
    greet:node('Severianus’s messenger','My master sends his greetings and no promises, senator. He is waiting to see which way the standards face.',[
      opt('Tell him they face Rome.','rome'),bye]),
    rome:node('Severianus’s messenger','I will tell him. He will ask whose face is in front of them. He always asks the second question.',[back('Tell him that too.')])
  }),
  'ch12:treasury-envoy':tree('greet',{
    greet:node('The treasury envoy','Severianus has gone elsewhere, senator. Our syndicate has not. We can advance what he would have; you know our terms.',[
      opt('Your terms are a claim on the empire’s revenue.','terms'),bye]),
    terms:node('The treasury envoy','Our terms are a loan, senator. Empires are built on them and occasionally fall under them. We are patient either way.',[back('So I see.')])
  }),
  'ch12:quintus':tree('greet',{
    greet:node('Signifer Quintus','Senator. I held the standards at Novae when you swore. I have brought them here, with every signifer of the loyal legions, so that they can see whom they are marching for.',[
      opt('What do you need of me?','errand',{conditions:offered('seal_shown')}),
      opt('The seal is shown.','oath',{conditions:inHand('seal_shown',{flag:'seal_held_up'}),effects:{errand:{seal_shown:'done'}}}),
      opt('Teach me a course.',null,{effects:{open:'trainer:signifer'}}),
      opt('I carried braces for the gate at the Danube fort.','braces',{conditions:{title:'shield_of_cohort'}}),
      bye]),
    braces:node('Signifer Quintus','I remember. The tribune’s report called it labour. The men called it something better, and they still do. You stand like a man who carries things.',[back('I still do.')]),
    errand:node('Signifer Quintus','Show them the seal. The lead one, from the oath; you still carry it. Hold it up at the standards, so that men who have never seen you can see you were once one of them.',[
      opt('I will.','greet',{effects:{errand:{seal_shown:'accepted'}}}),back('Another time.')]),
    oath:node('Signifer Quintus',`“${OATH}” That is what you swore, in the rain at Novae. They heard it again today, in your hand.`,[back('They did.')])
  }),
  'ch12:standards':tree('standards',{
    standards:node('The legions’ standards','The standards of the loyal legions stand in a long row in the paved court, their bearers beside them.',[
      opt('Hold up the lead seal.','held',{conditions:inHand('seal_shown',{oath:true,notFlag:'seal_held_up'}),effects:{flags:['seal_held_up']}}),
      opt('Leave the standards.')]),
    held:node('The legions’ standards','You hold the worn lead seal up before the standards. Along the row, men who have never seen you look at a small grey disc and then, for a long moment, at you.',[opt('Leave the standards.')])
  }),
  'ch12:paullus':tree('greet',{
    greet:node('Lucius Cassius Paullus','Senator. I have come under the old courtesy that lets a rival visit a camp and leave it alive. I intend to test the custom.',[
      opt('Why are you here?','why'),
      opt('The Senate will have its settlement, if it will have me.','settlement',{conditions:{attribute:{elo:15}}}),bye],{variants:freeze([
        variant({decision:{ch12:'honour'}},'Senator. You will offer settlement and mercy, I hear. I shall still oppose you, but I shall sleep.'),
        variant({decision:{ch12:'release'}},'Senator. Unconditional submission, I hear. Then I shall oppose you with everything I have, and I suspect it will not be enough.')])}),
    settlement:node('Lucius Cassius Paullus','A good sentence. I would vote for it from a man I trusted. Make them trust you, and the sentence will do the rest of the work.',[back('I will try.')]),
    why:node('Lucius Cassius Paullus','To see whether you will offer the Senate a settlement or the army a crown. I think you do not yet know. That makes two of us, which is more honest than most rooms in Rome.',[back('More honest, yes.')])
  }),
  'ch12:aelia':tree('greet',{
    greet:node('Aelia Dacia','Senator. Whatever title the soldiers shout, those fields will still need seed next spring.',[
      opt('What do the households need?','errand',{conditions:offered('spring_seed')}),
      opt('Here is seed grain from the sutler.','seeded',{conditions:inHand('spring_seed',{item:'seed_grain'}),effects:{take:['seed_grain'],errand:{spring_seed:'done'}}}),
      opt('Aper has released the army’s spare seed.','seeded',{conditions:inHand('spring_seed',{flag:'seed_released'}),effects:{errand:{spring_seed:'done'}}}),
      opt('The households will keep their fields, whoever wins.','fields',{conditions:{meter:{public:{min:40}}}}),
      bye]),
    fields:node('Aelia Dacia','Then say it to them, not to me. I believe you, senator. I am not the one who needs to.',[back('I will say it.')]),
    errand:node('Aelia Dacia','Seed. The army’s stores carry spare seed grain against a long campaign, and the sutler sells it at a soldier’s price. Either will do. Bring it to me before the march, and the fields will not care whose name is on the decree.',[
      opt('I will bring it.','greet',{effects:{errand:{spring_seed:'accepted'}}}),back('Another time.')]),
    seeded:node('Aelia Dacia','Then there will be a harvest, whoever wins. That is the only victory my people have ever been sure of.',[back('Whoever wins.')])
  }),
  'ch12:quartermaster':tree('greet',{
    greet:node('Quartermaster Aper','Senator. Twenty-five years and I am still counting your boots. They are better boots now. The counting is the same.',[
      opt('Equipment and pay.',null,{effects:{open:'quartermaster'}}),
      opt('Release the army’s spare seed grain to Aelia’s households.','released',{conditions:inHand('spring_seed',{notFlag:'seed_released',attribute:{auth:15}}),effects:{flags:['seed_released']}}),
      bye]),
    released:node('Quartermaster Aper','On your authority, senator. I shall write that it was on your authority. Everything is, now.',[back('Write it.')])
  }),
  'ch12:trader':tree('greet',{
    greet:node('Syra the sutler','I sold you wine at Novae when you had a recruit’s pay and a recruit’s taste. You have better taste now. I still have the same wine.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('What do you hear from the rival camp?','rumour'),bye]),
    rumour:node('Syra the sutler','They are buying bread from three villages and paying for it in promises. The villages have started asking for coin.',[back('Villages are wise.')])
  }),
  ...Object.fromEntries([['lucan','Aurelius Lucan','The legion is here. Ask me what we intend to do with it. I asked you that once, in the marsh, and you did not have an answer either.','A fall from my horse on the road south, which I shall deny if asked. Review the company; the legion is here, whatever my leg thinks.'],
    ['sabinus','Gaius Sabinus','The legion has come under my command. Lucan should have had this place. I cannot lend you his forgiveness, but I have brought you his men.','Strained ribs from the march. Didius has me sitting down, which is not how a man should meet the purple.']].map(([id,name,text,recovering])=>
    [`ch12:${id}`,tree('greet',{greet:node(name,text,[opt('Review our company.',null,{effects:{open:'company'}}),bye],{variants:freeze([variant({recovering:id},recovering)])})})])),
  'ch12:naso':tree('greet',{
    greet:node('Aulus Naso','I said at Novae that I would stand behind you until somebody gave me a better offer. Nobody has. It has been twenty years.',[bye],
      {variants:freeze([variant({recovering:'naso'},'Didius has me in the aid shelter for one more day. I told him I have waited twenty years to see this; one more day is nothing. I lied.')])})
  }),
  'ch12:felix':tree('greet',{
    greet:node('Marcus Felix','From the camp wall you can see Rome’s new walls, and the masons still on them. Whoever wins will have to finish them.',[bye],
      {variants:freeze([variant({recovering:'felix'},'An arrow on the road south. I can see Rome’s new walls from the aid shelter, and the masons still on them. Whoever wins will have to finish them.')])})
  })
});

// How history remembers the day, when an encounter is lost. Retry restores the checkpoint.
// The public events stay where history put them: a lost field changes only the page.
export const LIVING_DEFEAT_PAGES=freeze({
  'ch4-gate':'The fort above the ford fell back from its gate before noon. The report that reached headquarters blamed the drum, which could not be punished, and listed the men who had stood behind it by century rather than by name.',
  'ch4-wall':'The wall walk was crossed, but not by the men it was meant to bring home. The squads that came down at the far end carried fewer shields than names, and the fort’s report counted the shields.',
  'ch5-mine':'The cracked tower came down on its own props. The garrison’s report gives the mine one line and the men beneath it none; in the fortress’s last weeks there was no time to write longer reports.',
  'ch5-wall':'The river gate was lost before the households reached the boats. The fortress passed into the victors’ accounts and out of Rome’s, and the families who waited behind the gate appear in neither.',
  'ch6-wells':'The wells were the enemy’s by noon. The column that reached the western road was smaller than the one that left the halt, and the clerks who counted it were careful to write that it withdrew.',
  'ch6-eagle':'The eagle did not come home. In the camps it was said that the bearer had buried it beside the road; the inquiry, which wanted a simpler story, recorded that it was lost with the rear guard.',
  'ch7-council':'The council voted for another man’s plan. It was a reasonable plan, it was carried out, and nobody afterwards remembered that a prefect had argued against it, except the prefect.',
  'ch7-legion':'The legion was beaten in the field and withdrew in good order, which is how the dispatch put it. Gallienus died outside Milan as he would have in any case; the legion’s part in those weeks is a short paragraph in a long year.',
  'ch8-parley':'The words above the ford came to nothing. The crossing went ahead without terms, and for a season every boat that left the bank was watched from the hills by men who had agreed to nothing.',
  'ch8-ferry':'The last boats left without their column. The households who never reached the crossing marker were counted afterwards, by people who had not been there, as having chosen to stay.',
  'ch8-crossing':'The far bank was given up before the rear guard was over. The withdrawal from Dacia went on, as it did for years, but the families who crossed at this ford crossed without the men who were meant to hold it.',
  'ch9-wing':'The armoured horse were never drawn out, and the wing came back without hearing its recall. The campaign went on and Aurelian’s victories were won, but not on this field and not by these men.',
  'ch9-city':'The approach to the city was not secured, and its keys were handed to another officer on another day. The city’s envoys remembered the commander who had not come, and did not remember him kindly.',
  'ch10-road':'The grain road stayed closed through the harvest. The convoys turned back at the ford, and the province learned that a governor’s judgment cannot feed a town his escort cannot reach.',
  'ch10-tribunal':'The tribunal did not back the settlement. The two claims passed to the next governor and to the one after him, and in the meantime the fields were farmed by whoever rose earliest.',
  'ch11-accounts':'The committee found the soldier’s accounts wanting, though not dishonest. The minutes record the vote and not the arguments; the arguments were remembered by the men who lost them.',
  'ch11-adlection':'The petition for the broad stripe failed. The emperor’s grant waited on backing that never came, and the candidate’s name went back into the service record, where it had always been safer.',
  'ch12-legitimacy':'The decree carried another name. The majority held at the deadline, and for a season Rome believed it had settled its succession by a vote, which it had not managed for a long time.',
  'ch12-confrontation':'The armies met on the road to the purple, and the purple went elsewhere. The oath was sworn again, as it always is, to someone; the legions that had marched with you swore it too, because that is what an oath is for.'
});
