// Conversations as data (build brief §3.12): each tree is nodes of
// { speaker, text, options: [{ text, conditions, effects, next, once }] }.
// Conditions: attribute ≥ n, decoration, title, flag, item, chapter, path,
// meter threshold, decision, errand stage, oath. Effects: flags, meters,
// items, TP, denarii, errands, titles, the chapter's decision, the oath, and
// `open` (a panel the page shows next). An option whose conditions fail is
// shown dimmed with what it needs. Rewards are given once (core/dialogue.js).
// Original prose for this project; history follows docs/historical-research.md.

const freeze=value=>Object.freeze(value);
const opt=(text,next=null,more={})=>freeze({text,next,conditions:freeze(more.conditions??{}),effects:freeze(more.effects??{}),once:!!more.once});
const node=(speaker,text,options)=>freeze({speaker,text,options:freeze(options)});
const tree=(start,nodes)=>freeze({start,nodes:freeze(nodes)});
const bye=opt('Farewell.');

// Errands (§3.12): optional, once only, never blocking the story. A path
// errand is offered only to a soldier of that training and awards a title.
export const ERRANDS=freeze({
  drill_first:freeze({id:'drill_first',chapter:1,giver:'Varro',title:'First at the post',summary:'Work the practice post until Varro sees you there first.',
    reward:freeze({tp:2,title:'drill_first'})}),
  names_roll:freeze({id:'names_roll',chapter:2,giver:'Gaius Sabinus',title:'Names for the roll',
    summary:'Bring Sabinus the capsarius’s list of the wounded and the dead, so no name is lost with the wagons.',reward:freeze({tp:2,meters:freeze({army:1})})}),
  medicine:freeze({id:'medicine',chapter:2,giver:'Capsarius Didius',title:'A box of medicines',
    summary:'Bring Didius a medicine box from the sutler in the canabae.',reward:freeze({tp:2,denarii:10})}),
  shields:freeze({id:'shields',chapter:2,giver:'Aulus Naso',title:'The broken shields',path:'legionary',
    summary:'Carry the split shields from the tent lines to the quartermaster before the march.',reward:freeze({tp:2,title:'hammer_of_line'})}),
  letter:freeze({id:'letter',chapter:3,giver:'Tribune Crispus',title:'The tribune’s letter',
    summary:'Carry Crispus’s sealed letter to the clerk at the principia.',reward:freeze({tp:1,denarii:15})}),
  well:freeze({id:'well',chapter:3,giver:'Capsarius Didius',title:'The station well',
    summary:'Look at the station well before the company drinks from it, and tell Didius what you find.',reward:freeze({tp:2,meters:freeze({public:1})})}),
  tracks:freeze({id:'tracks',chapter:3,giver:'Explorator Brennus',title:'Tracks above the road',path:'explorator',
    summary:'Read the ground at the drill field’s edge the way Brennus taught you, and tell him what passed there.',reward:freeze({tp:2,title:'trail_reader'})}),
  second_copy:freeze({id:'second_copy',chapter:3,giver:'Clerk Tertius',title:'The second copy',path:'librarius',
    summary:'Help Tertius make a second copy of the muster roll before the column leaves.',reward:freeze({tp:2,title:'clerk_of_rolls'})})
});

// How history remembers the day, when an encounter is lost (§3.12). Retry restores the checkpoint.
export const DEFEAT_PAGES=freeze({
  'ch1-training':'Varro writes nothing on his tablet about the morning a recruit went down in the drill yard. That is the only mercy of the yard: the post does not remember, and tomorrow the sand is raked smooth.',
  'ch1-road':'The boundary road burned that night. The cart was found at dawn, empty, and the watch report names no one who held the bend. The raiders were across the river before the cavalry saddled.',
  'ch2-marsh':'The causeway kept what it took. When the rolls were written again at the rally point, the wounded from the broken wagon were entered as lost in the marsh, without names.',
  'ch2-rearguard':'The torches came through the reeds before the last men assembled. Those who reached the rally ground told it as a rout; the clerks, who were not there, called it a withdrawal.',
  'ch3-station':'The station kept its silence. The pay chest was never found, and in the winter quarters a widow’s claim was refused because her husband’s name was on no surviving roll.',
  'ch3-rolls':'The records went into the river with the cart. For a generation the legion paid its veterans from memory and argument, and the argument was settled by whoever spoke loudest.'
});

export const DIALOGUE=freeze({
  // ——— Chapter I: the legionary base at Novae ———
  'ch1:varro':tree('greet',{
    greet:node('Varro','Tiro. Recruit. For now it means you listen. Ask what you need to ask; the post does not wait for questions.',[
      opt('How do I fight in the field?','fighting'),
      opt('Teach me a course.',null,{effects:{open:'trainer:campidoctor'}}),
      opt('Is there work for a recruit at the post?','errand',{conditions:{errand:{drill_first:'none'}}}),
      opt('I have been first at the post this morning.','errand-done',{conditions:{errand:{drill_first:'accepted'},flag:'post_struck'}}),
      opt('About the oath…','oath',{conditions:{oath:false,encounterIndex:{min:1}}}),bye]),
    fighting:node('Varro','Draw before you close; a sheathed blade counts for nothing. Brace when a heavy man winds up, throw your pila before the shields meet, and keep a wall or a friend at your back. When it all happens too fast, stop the world: P. Nobody will think less of you. The dead think nothing at all.',[
      opt('What does bracing give me?','brace'),opt('Back to the drill.','greet')]),
    brace:node('Varro','A braced shield blocks more and you do not stagger; every blow loses a little on it. It costs breath, fifteen of your Stamina, so do not brace at shadows. Brace at the man who has already raised his axe.',[opt('Understood.','greet')]),
    errand:node('Varro','Work. Every morning before the cornicen sounds, the post is struck by the first man in the yard. Be that man. Strike it properly, not like a boy beating a carpet, and I will know.',[
      opt('I will be first.','greet',{effects:{errand:{drill_first:'accepted'}}}),opt('Another time.','greet')]),
    'errand-done':node('Varro','I saw. Your shield stayed low and your feet stayed under you. The others will call you something unkind for it. Let them; it means they noticed.',[
      opt('Thank you, Varro.','greet',{effects:{errand:{drill_first:'done'}}})]),
    oath:node('Varro','The oath is sworn at the standards, before the signifer, with the lead seal in your hand. It binds you to the emperor and to the man beside you. Mean every word or do not say any of them.',[
      opt('I will go to the standards.','greet')])
  }),
  'ch1:lucan':tree('greet',{
    greet:node('Aurelius Lucan','The clerk asked my father’s trade. I said miller; he wrote labourer. Perhaps that is how Rome becomes so large: it makes every small thing sound smaller.',[
      opt('What will you do with your pay?','pay'),opt('About the javelin…','javelin',{conditions:{decision:{ch1:null}}}),
      opt('Varro knows about the javelin now.','after',{conditions:{decision:{ch1:'report'}}}),opt('The javelin is paid for.','after-cover',{conditions:{decision:{ch1:'cover'}}}),bye]),
    pay:node('Aurelius Lucan','Repair my father’s mill. You can keep whatever grand title Rome gives you. I shall make you carry a sack of flour through the village so they remember who you were.',[opt('A fair bargain.','greet')]),
    javelin:node('Aurelius Lucan','I dropped one in the river. If Varro asks, I was never near the bank. You were, perhaps. No, forget I said that. Varro will ask at the commander’s table tonight.',[opt('We will see.','greet')]),
    after:node('Aurelius Lucan','You told him. I would have, in your place. Probably. Give me a few days before you expect me to be glad of it.',[opt('Take the days.','greet')]),
    'after-cover':node('Aurelius Lucan','You paid for my javelin out of your own allowance. I will remember it. I will also remember that you are a terrible liar, so do not try it on Varro twice.',[opt('Once was enough.','greet')])
  }),
  'ch1:quartermaster':tree('greet',{
    greet:node('Quartermaster Aper','Kit, pay and complaints, in that order. The complaints go in the river.',[
      opt('Show me the stores.',null,{effects:{open:'quartermaster'}}),opt('What do recruits usually buy?','advice'),bye]),
    advice:node('Quartermaster Aper','A cloak, if they have any sense; it is cold on the river at night and a dark cloak hides a man on watch. Boots that fit. Nothing that rattles. Draw your pay first: you have earned it, whatever Varro says.',[opt('Thank you.','greet')])
  }),
  'ch1:signifer':tree('greet',{
    greet:node('Signifer Quintus','The standards stand here day and night. A recruit who passes them without looking up will be made to stand beside them until he does.',[
      opt('Swear the military oath.',null,{conditions:{oath:false,encounterIndex:{min:1}},effects:{oath:true}}),
      opt('When is the oath sworn?','when',{conditions:{oath:false,encounterIndex:{max:0}}}),
      opt('The oath is sworn.','sworn',{conditions:{oath:true}}),bye]),
    when:node('Signifer Quintus','After the drill. Varro decides when you are fit to hold a shield in the line; then you swear, and the lead seal is yours.',[opt('Understood.','greet')]),
    sworn:node('Signifer Quintus','Then carry the seal. Men have been buried with theirs. Better men have lived long enough to wear them smooth.',[opt('I will.','greet')])
  }),
  'ch1:orderly':tree('greet',{
    greet:node('Orderly Mamertus','The valetudinarium. Every man leaves here whole between encounters, if he leaves at all. Nobody is in the beds yet; give it a week.',[
      opt('What should I carry for wounds?','bandages'),bye]),
    bandages:node('Orderly Mamertus','Each man takes three bandages into the field. Binding a wound takes three breaths of quiet: if somebody hits you while you work, you stop, and the bandage stays rolled. From the second year the capsarius teaches better.',[opt('Thank you.','greet')])
  }),
  'ch1:trader':tree('greet',{
    greet:node('Syra the sutler','Wine, wax and a little luck, soldier. The luck is extra.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('Any news from across the river?','rumour'),bye]),
    rumour:node('Syra the sutler','Fires on the far bank every night this week, more than the villages need. The ferrymen say the Goths are counting boats. The ferrymen say a great many things, but they are rarely wrong about boats.',[opt('I will keep watch.','greet')])
  }),
  'ch1:post':tree('post',{
    post:node('The practice post','A scarred oak post, shoulder-high, older than any man in the yard.',[
      opt('Strike it the way Varro taught.','struck',{conditions:{errand:{drill_first:'accepted'},notFlag:'post_struck'},effects:{flags:['post_struck']}}),
      opt('Practise a completed encounter.',null,{conditions:{history:{min:1}},effects:{open:'practice'}}),opt('Leave it.')]),
    struck:node('The practice post','Low, then high, then the shield boss. The yard is still grey and empty, and your arms ache in the good way.',[opt('Done.')])
  }),

  // ——— Chapter II: the march camp after Abritus ———
  'ch2:varro':tree('greet',{
    greet:node('Varro','Decius is dead. That is news, not an order to die beside him. Ask quickly.',[
      opt('How do we get the wounded out?','wounded'),opt('Teach me a course.',null,{effects:{open:'trainer:campidoctor'}}),bye]),
    wounded:node('Varro','Bind them where they fall if you can: three breaths, a bandage, and he walks. If he cannot walk, sheathe your blade and carry him. You walk while you carry, your shield will not block, and every raider in the reeds will see you. Choose your moment, then do not hesitate.',[opt('Understood.','greet')])
  }),
  'ch2:lucan':tree('greet',{
    greet:node('Aurelius Lucan','My leg. It is not broken, Didius says; it only feels like a mill-wheel went over it. My mother will ask whether I was afraid. You can lie about that.',[
      opt('We will get you out.','promise',{conditions:{decision:{ch2:null}}}),opt('Rest.','rest',{conditions:{decision:{ch2:'carry'}}}),bye]),
    promise:node('Aurelius Lucan','Do not promise in front of the capsarius; he writes things down. Just do not tell her the marsh was beautiful. I always hated this place.',[opt('I will not.','greet')]),
    rest:node('Aurelius Lucan','I owe you a walk home. A long one. When I can stand again, I will start practising.',[opt('Start soon.','greet')])
  }),
  'ch2:sabinus':tree('greet',{
    greet:node('Gaius Sabinus','Sabinus, file-leader. I am trying to keep a roll of who came out of the marsh. Clerks change names on their tablets; I would rather they had the right ones to change.',[
      opt('Can I help with the roll?','errand',{conditions:{errand:{names_roll:'none'}}}),
      opt('Didius’s list of the wounded and the dead.','errand-done',{conditions:{errand:{names_roll:'accepted'},flag:'names_list'}}),bye]),
    errand:node('Gaius Sabinus','Didius at the valetudinarium keeps a list of the men he has treated and the men he could not. Bring it to me before the column moves.',[
      opt('I will bring it.','greet',{effects:{errand:{names_roll:'accepted'}}}),opt('Later.','greet')]),
    'errand-done':node('Gaius Sabinus','Every name. Good. If you cannot carry a man, you can still carry the truth of him.',[
      opt('It is the least we can do.','greet',{effects:{errand:{names_roll:'done'},clear:['names_list']}})])
  }),
  'ch2:naso':tree('greet',{
    greet:node('Aulus Naso','Half the company’s shields split in the reeds. The quartermaster wants them back for the leather and the bosses, and nobody wants to carry them.',[
      opt('I will carry them.','errand',{conditions:{errand:{shields:'none'},path:'legionary'}}),
      opt('The quartermaster has the shields.','errand-done',{conditions:{errand:{shields:'accepted'},flag:'shields_delivered'}}),bye]),
    errand:node('Aulus Naso','They are piled by the tent lines. Mind your back; Aper counts every boss.',[
      opt('On my way.','greet',{effects:{errand:{shields:'accepted'}}})]),
    'errand-done':node('Aulus Naso','The whole pile, in one trip? The lads will call you the hammer of the line for a week. Longer, if I have anything to do with it.',[
      opt('Let them.','greet',{effects:{errand:{shields:'done'}}})])
  }),
  'ch2:shields':tree('pile',{
    pile:node('The broken shields','Split scuta, their bosses still bright. A heavy load, but a short walk to the quartermaster.',[
      opt('Carry them to the quartermaster.','carried',{conditions:{errand:{shields:'accepted'},notFlag:'shields_delivered'},effects:{flags:['shields_delivered']}}),opt('Leave them.')]),
    carried:node('The broken shields','Aper counts every boss twice, grunts, and writes your name in a column you did not know existed.',[opt('Done.')])
  }),
  'ch2:capsarius':tree('greet',{
    greet:node('Capsarius Didius','Didius, capsarius. Do not bleed on the clean linen. What do you need?',[
      opt('Teach me a course.',null,{effects:{open:'trainer:capsarius'}}),
      opt('Sabinus asks for your list of the wounded and the dead.','list',{conditions:{errand:{names_roll:'accepted'},notFlag:'names_list'}}),
      opt('Is there anything you need?','errand',{conditions:{errand:{medicine:'none'}}}),
      opt('A medicine box, from the sutler.','errand-done',{conditions:{errand:{medicine:'accepted'},item:'medicine_box'}}),bye]),
    list:node('Capsarius Didius','Here. Wax, both sides. The second side is the shorter one, and the worse.',[opt('Thank you.','greet',{effects:{flags:['names_list']}})]),
    errand:node('Capsarius Didius','Medicines. Syra the sutler had a box from Oescus before the battle; if she still has it, bring it. I will pay what the army will not.',[
      opt('I will find it.','greet',{effects:{errand:{medicine:'accepted'}}}),opt('Later.','greet')]),
    'errand-done':node('Capsarius Didius','Poppy, wound-salt, clean probes. You have saved three men you will never meet. Here, for the box.',[
      opt('Use it well.','greet',{effects:{errand:{medicine:'done'},take:['medicine_box']}})])
  }),
  'ch2:quartermaster':tree('greet',{
    greet:node('Quartermaster Aper','Whatever came out of the marsh, I have. Whatever did not, I do not.',[opt('Show me the stores.',null,{effects:{open:'quartermaster'}}),bye])
  }),
  'ch2:trader':tree('greet',{
    greet:node('Syra the sutler','Still alive, soldier? Good. Dead men buy nothing.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('What are people saying?','rumour'),bye]),
    rumour:node('Syra the sutler','That the army has a new emperor, Gallus, and that he will pay the Goths to go home. That the Goths will take the money and come back. Both are probably true.',[opt('Probably.','greet')])
  }),

  // ——— Chapter III: the camp below the road station ———
  'ch3:varro':tree('greet',{
    greet:node('Varro','The eagle is the legion’s honour; the rolls are its memory. Bring back both.',[
      opt('How do I lead the others?','companions'),opt('Teach me a course.',null,{effects:{open:'trainer:campidoctor'}}),bye]),
    companions:node('Varro','You do not lead them; you set their orders and keep your own place. Three men march with you now. In the barracks, give each standing orders: guard you, strike your target, tend the wounded. In the field they follow those orders unless you take one of them in hand, a portrait or the brackets. Then let him go again.',[opt('Understood.','greet')])
  }),
  'ch3:crispus':tree('greet',{
    greet:node('Tribune Crispus','Gaius Valerius Crispus, tribune. My father says soldiers respect certainty. I am certain the chest holds our pay. I am less certain which track leads to it.',[
      opt('Scout first, then move.','scout'),opt('Is there anything I can carry for you?','errand',{conditions:{errand:{letter:'none'}}}),bye]),
    scout:node('Tribune Crispus','Scout. Yes. Brennus says the same, in fewer words. Reveal what is hidden before the file walks into it. I shall try to look as if I meant to say so.',[opt('You will learn.','greet')]),
    errand:node('Tribune Crispus','A letter to my father, sealed. The clerk at the principia sends the post south. Please do not read it; it is mostly complaints about the food.',[
      opt('I will take it.','greet',{effects:{errand:{letter:'accepted'},give:['wax_tablet']}}),opt('Not today.','greet')])
  }),
  'ch3:clerk':tree('greet',{
    greet:node('Clerk Tertius','Tertius, clerk to the cohort. Speak slowly; I am writing.',[
      opt('A letter from Tribune Crispus, for the post south.','letter',{conditions:{errand:{letter:'accepted'},item:'wax_tablet'}}),
      opt('Can I help with the rolls?','copy',{conditions:{errand:{second_copy:'none'},path:'librarius'}}),
      opt('The second copy is finished.','copy-done',{conditions:{errand:{second_copy:'accepted'}}}),bye]),
    letter:node('Clerk Tertius','Sealed with the family ring, I see. It will go south with the next courier. The tribune pays the post himself, and you for carrying it.',[
      opt('Thank you.','greet',{effects:{errand:{letter:'done'},take:['wax_tablet']}})]),
    copy:node('Clerk Tertius','A second copy of the muster roll, in case the first goes into a river. Sit. Your letters are better than most. Read me the names; I will check the ranks.',[
      opt('Begin with the first century.','greet',{effects:{errand:{second_copy:'accepted'}}})]),
    'copy-done':node('Clerk Tertius','Every name twice, and both copies agree. You would make a keeper of the rolls, if the army let anyone keep anything.',[
      opt('It was worth doing.','greet',{effects:{errand:{second_copy:'done'}}})])
  }),
  'ch3:brennus':tree('greet',{
    greet:node('Explorator Brennus','Brennus. Scout. I watch; you talk.',[
      opt('Teach me a course.',null,{effects:{open:'trainer:explorator'}}),opt('How do I scout?','scout'),
      opt('Is there ground for me to read?','tracks',{conditions:{errand:{tracks:'none'},path:'explorator'}}),
      opt('Three men passed the drill field’s edge before dawn, one of them limping.','tracks-done',{conditions:{errand:{tracks:'accepted'},flag:'tracks_read'}}),bye]),
    scout:node('Explorator Brennus','Stop. Look. Twenty breaths of Stamina and you see every hidden man within thirty paces for a while. Then you wait half a minute before you can do it again. Walk, do not run; sheathe your blade; stay in shadow. They notice what is loud and bright.',[opt('Understood.','greet')]),
    tracks:node('Explorator Brennus','The drill field’s edge, by the ditch. Something passed there before dawn. Tell me what.',[
      opt('I will look.','greet',{effects:{errand:{tracks:'accepted'}}})]),
    'tracks-done':node('Explorator Brennus','Deserters, going for the river. The limping one will not get far. You read it right. Reader of trails, then.',[
      opt('Should we tell the tribune?','greet',{effects:{errand:{tracks:'done'}}})])
  }),
  'ch3:capsarius':tree('greet',{
    greet:node('Capsarius Didius','The sickness came up the river ahead of us. Cover your mouth if it helps you; it does not hurt.',[
      opt('Teach me a course.',null,{effects:{open:'trainer:capsarius'}}),
      opt('Is there anything you need?','errand',{conditions:{errand:{well:'none'}}}),
      opt('The station well is foul: something is dead in it.','well-done',{conditions:{errand:{well:'accepted'},flag:'well_seen'}}),bye]),
    errand:node('Capsarius Didius','The station well. Before the company drinks from it, look. Smell. If anything died in it, I want to know before the cooks do.',[
      opt('I will look.','greet',{effects:{errand:{well:'accepted'}}})]),
    'well-done':node('Capsarius Didius','Then we boil everything and the cooks will hate us both. That is a good day’s work in a plague year.',[
      opt('Better hated than buried.','greet',{effects:{errand:{well:'done'}}})])
  }),
  'ch3:well':tree('well',{
    well:node('The station well','Stone-lined, deep, and silent. The rope is new; the smell is not.',[
      opt('Lower a lamp and look.','seen',{conditions:{errand:{well:'accepted'},notFlag:'well_seen'},effects:{flags:['well_seen']}}),opt('Leave it.')]),
    seen:node('The station well','A drowned dog, days old, turning slowly at the bottom. Nobody should drink this water unboiled.',[opt('Tell Didius.')])
  }),
  'ch3:tracks':tree('ground',{
    ground:node('The ditch at the field’s edge','Trodden mud along the ditch, and the grass flattened toward the river.',[
      opt('Read the ground the way Brennus taught.','read',{conditions:{errand:{tracks:'accepted'},notFlag:'tracks_read'},effects:{flags:['tracks_read']}}),opt('Leave it.')]),
    read:node('The ditch at the field’s edge','Three men, hobnailed, before the dew: two long strides and one short, dragging. Toward the river, not the road.',[opt('Tell Brennus.')])
  }),
  'post':tree('post',{
    post:node('The practice post','A scarred post, the yard’s oldest soldier.',[
      opt('Practise a completed encounter.',null,{conditions:{history:{min:1}},effects:{open:'practice'}}),opt('Leave it.')])
  }),
  'ch3:lucan':tree('greet',{
    greet:node('Aurelius Lucan','A tribune who asks where to step may be worth more than one who already knows. If he learns, let him. I learned something in that marsh.',[
      opt('How is the leg?','leg'),bye]),
    leg:node('Aurelius Lucan','It holds. I practise the walk home every evening, as promised. Set my orders in the barracks and I will keep your back.',[opt('I will.','greet')])
  }),
  'ch3:sabinus':tree('greet',{
    greet:node('Gaius Sabinus','Lucan’s entry was nearly left off the new roll. I put it back. Recover that book, and no clerk will call our missing men a mistake in arithmetic.',[bye])
  }),
  'ch3:felix':tree('greet',{
    greet:node('Marcus Felix','Felix. Bow. I shoot from behind your shield and I keep my distance; that is the skirmisher’s way. If you want me closer, tell me in the barracks.',[
      opt('Keep your distance.','greet'),bye])
  }),
  'ch3:quartermaster':tree('greet',{
    greet:node('Quartermaster Aper','Plague or no plague, the army eats, marches and pays. Mostly in that order.',[opt('Show me the stores.',null,{effects:{open:'quartermaster'}}),bye])
  }),
  'ch3:trader':tree('greet',{
    greet:node('Syra the sutler','I followed the army up the river. Do not ask me why; I ask myself every morning.',[
      opt('Show me your goods.',null,{effects:{open:'trader'}}),opt('Any news?','rumour'),bye]),
    rumour:node('Syra the sutler','The station emptied a week ago. The courier who came through said the raiders took the road above it, not the road itself. Look up the hill before you look down it.',[opt('Thank you.','greet')])
  })
});
