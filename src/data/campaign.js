// Original campaign fiction. Historical adaptations are disclosed below.
// The same oath constant is spoken at both ends of the campaign.
export const OATH = 'I swear to obey the emperor’s lawful commands, never to desert the standards, and never to refuse death when the safety of the Roman state requires it.';
export const MENTOR_LESSON = 'A shield is a promise to the person beside you.';

export const CAST = {
  mentor: { name: 'Titus Flavius Varro', role: 'Veteran centurion · the mentor', description: 'An old Danube soldier who counts those brought home before counting those defeated.', color: '#bca06c' },
  comrade: { name: 'Aurelius Lucan', role: 'Tent-mate · the comrade', description: 'A miller’s son from your village. A quick laugh conceals his fear of being left behind.', color: '#72988b' },
  rival: { name: 'Gaius Valerius Crispus', role: 'Tribune, then political rival', description: 'A senator’s son whose inherited place in the army disappears while your earned place grows.', color: '#a789b6' },
  patron: { name: 'Marcus Aurelius Severianus', role: 'Equestrian commander · the patron', description: 'A patient sponsor who treats every favour as a line in a ledger.', color: '#c19a50' },
  settler: { name: 'Aelia Dacia', role: 'Representative of the evacuated families', description: 'A literate widow who keeps the names of the displaced and refuses to let them become a number.', color: '#78a0aa' },
  senator: { name: 'Lucius Cassius Paullus', role: 'Elder senator · rival claimant', description: 'A respected administrator who believes Rome must be rescued from the men who defend it.', color: '#b98479' },
};

const L = (speaker, text, when) => ({ speaker, text, ...(when ? { when } : {}) });
const E = (id, kind, title, objective, type, terrain, turnLimit, requiredAbility) => ({ id, kind, title, objective, type, terrain, turnLimit, ...(requiredAbility ? { requiredAbility } : {}) });
const O = (id, label, description, army, political, publicConfidence, supplies, consequence, obligation) => ({
  id, label, description, effects: { army, political, public: publicConfidence, supplies }, consequence, ...(obligation ? { obligation } : {}),
});

export const CHAPTERS = [
  {
    id: 1, title: 'The Oath', year: 'c. AD 250', location: 'A legionary base on the Danube',
    rank: 'Tiro', rankMeaning: 'Recruit in training', promotion: 'Miles', promotionMeaning: 'Legionary',
    capability: 'Move · Strike · Brace · Throw', description: 'One young man, one oval shield, and an oath whose weight he cannot yet imagine.',
    objective: 'Pass training, swear the military oath, and protect the boundary road.',
    intro: [
      L('Narrator', 'The river is wider than anything you have seen. Across it, fires wink between trees. Behind you stand the fields where you were born; ahead, a gate painted red and a clerk who has already forgotten your face. You are Aurelius Marcellus, twenty years old. Your whole property fits inside a folded cloak.'),
      L('Varro', 'Tiro means recruit. For now it means you listen. That oval shield covers more than your own ribs. Hold it low and the man beside you pays. Hold it too high and you pay together. Remember this before you remember the paymaster: ' + MENTOR_LESSON),
      L('Narrator', 'In the yard, move to a clear tile, strike a practice enemy, brace against an announced blow, and throw a javelin before closing. Select an action, select its target, read the preview, then confirm. You control only yourself. Your companions have their own intentions, shown before they act.'),
      L('Lucan', 'The clerk asked my father’s trade. I said miller. He put down labourer. Perhaps that is how Rome becomes so large: it makes every small thing sound smaller. I dropped a javelin in the river. If Varro asks, I was never near the bank.'),
      L('Lucan', 'When we come home, I want to arrive with enough pay to repair my father’s mill. You can keep whatever grand title Rome gives you. I shall make you carry a sack of flour through the village so they remember who you were.'),
    ],
    oath: [L('Oath · original reconstruction', OATH)],
    decision: { id: 'ch1', prompt: 'Varro asks who lost the javelin. Lucan watches you.', options: [
      O('report', 'Tell Varro the truth', 'Accept a colder friendship to establish a reputation for honest reports.', -2, 4, 1, 2, 'Lucan remembers the public correction. Later officers trust your written record.'),
      O('cover', 'Take responsibility with Lucan', 'Replace the javelin from your allowance and bind your fortunes to his.', 5, -1, 0, -2, 'Lucan remembers that you stood beside him before you had anything to gain.'),
    ] },
    encounters: [
      E('ch1-training', 'battle', 'The drill yard', 'Demonstrate Move, Strike, Brace, and Throw; complete Varro’s exercise.', 'training', 'grass', 12, 'throw'),
      E('ch1-road', 'battle', 'Fire on the boundary road', 'Clear the raiders and secure the road beside the cart.', 'battle', 'grass', 12, 'brace'),
    ],
    requirements: ['Complete the drill yard', 'Swear the original military oath', 'Complete the first field assignment'],
    reward: 'A military belt, a repaired mail shirt, and the title Miles. Your oath and lead seal enter the journal.',
    aftermath: [
      L('Varro', 'Miles. Legionary. Do not grin so broadly; the title comes with the same blisters. You held when the road narrowed. That matters more than how loudly you struck.'),
      L('Narrator', 'That night the lead seal touches your new military belt. Lucan falls asleep before finishing a story about home. Before dawn, orders arrive to march south. The Goths have crossed, and an emperor is taking the field.'),
    ],
  },
  {
    id: 2, title: 'First Blood', year: 'AD 251', location: 'The marshes after Abritus',
    rank: 'Miles', rankMeaning: 'Legionary', promotion: 'Immunis', promotionMeaning: 'Trusted specialist, excused from routine labour',
    capability: 'Assist · carry or shield a wounded soldier', description: 'The emperor is dead. The marsh has swallowed the road. Survival is a kind of command.',
    objective: 'Use Assist, survive the marsh patrol, and bring the survivors to the rally point.',
    intro: [
      L('Narrator', 'You do not see the emperor die. You see a horse return without a rider, reeds shivering where men should be, and a standard sink until only its bright tip remains. Later, someone will call this Abritus. For now it is mud that grips your ankles and shouting that gives no direction.'),
      L('Varro', 'Decius is dead. That is news, not an order to die beside him. We find the rally point. Keep to firm ground. A charging warband will follow your noise; let the marsh break its run before you stand.'),
      L('Narrator', 'Lucan lies beside a broken wagon, his leg caught beneath the axle. The wound will kill him if he is abandoned here. Carrying him will slow the retreat and consume supplies. This is a decision about his life; no random blow from an ally’s automatic turn will decide it for you.'),
      L('Lucan', 'My mother will ask whether I was afraid. You can lie about that. Just do not tell her the marsh was beautiful. I always hated this place, even before I saw it.'),
      L('Narrator', 'Other wounded men gather under a torn cloak. Even if you cannot save Lucan, one of them still needs your shield. Assist a casualty before reaching the rally marker. Watch the raiders’ announced intentions, brace where the path narrows, and spend your javelin where it opens an escape.'),
      L('Varro', 'The army has proclaimed Trebonianus Gallus. Tomorrow clerks will change the names on their tablets. Today you keep the people whose names you know. I can show you the causeway; I cannot choose what you carry across it.'),
    ],
    decision: { id: 'ch2', prompt: 'Lucan cannot walk. The patrol must move.', options: [
      O('carry', 'Carry Lucan out', 'Lucan survives; the rescue costs supplies and makes the march harder.', 8, 0, 4, -5, 'Lucan survives to rise through the ranks. He can command the loyal legion in the succession crisis.'),
      O('leave', 'Save the mobile survivors', 'Lucan dies in the marsh. An unnamed wounded soldier still needs Assist.', -5, 2, -3, 4, 'Lucan is permanently absent. Sabinus, another survivor of the retreat, eventually takes command of his would-be legion.'),
    ] },
    encounters: [
      E('ch2-marsh', 'battle', 'The broken causeway', 'Use Assist on a wounded soldier, then lead the survivors to the rally marker.', 'rescue', 'marsh', 14, 'assist'),
      E('ch2-rearguard', 'battle', 'Torches in the reeds', 'Hold the rally ground until the last survivors can assemble.', 'defend', 'marsh', 12),
    ],
    requirements: ['Use Assist on a casualty', 'Survive the marsh', 'Secure the rally point'],
    reward: 'Immunis: your care with wounded men and route records earns specialist duties.',
    aftermath: [
      L('Lucan', 'I owe you a walk home. A long one. When I can stand again, I will start practising.', 'comradeAlive'),
      L('Sabinus', 'I have written Lucan’s name. It will not be lost with the wagons. If you cannot carry a man, you can still carry the truth of him.', 'comradeAbsent'),
      L('Narrator', 'Varro assigns you to survey roads and keep the casualty rolls. An immunis is excused from ordinary fatigue duties for specialist work. The shovel passes to another hand; the names do not.'),
    ],
  },
  {
    id: 3, title: 'Under the Eagle', year: 'AD 252–253', location: 'A plague-struck Danube road station',
    rank: 'Immunis', rankMeaning: 'Trusted specialist', promotion: 'Optio', promotionMeaning: 'The centurion’s deputy, steadying the rear ranks',
    capability: 'Scout · reveal concealed enemies and difficult ground', description: 'An army needs bread, names, and someone willing to look past the obvious road.',
    objective: 'Scout the abandoned station and recover the legion’s missing pay chest and muster rolls.',
    intro: [
      L('Narrator', 'The road station has no smoke. A bowl of yesterday’s porridge sits beside a doorway, untouched. Illness has followed the army up the river, emptying barracks faster than raiders can fill graves. You cover your mouth with a cloth because it feels like doing something. No one claims it is a cure.'),
      L('Crispus', 'Gaius Valerius Crispus, tribune. My father says soldiers respect certainty. I am certain that the missing chest contains our pay, and that those rolls are the only record of several hundred men. I am less certain about which of these tracks leads to it.'),
      L('Narrator', 'Crispus is young, clean-shaven, and furious with his own trembling hands. His senatorial family has given him a place near command, but no gift can show him an ambush. Scout before moving into the station. Revealed ground and hidden enemies remain marked for this encounter; you cannot order the tribune or the other soldiers.'),
      L('Varro', 'The eagle is the legion’s honour. The rolls are its memory. Lose one and men can rally to a new pole; lose the other and a widow may never prove that her husband existed. Bring both the money and the writing back. Then decide how much of the truth you intend to tell.'),
      L('Lucan', 'A tribune who asks where to step may be worth more than one who already knows. If he learns, let him. I learned something in that marsh.', 'comradeAlive'),
      L('Sabinus', 'Lucan’s entry was nearly left off the new roll. I put it back. Recover that book, and no clerk will be able to call our missing men a mistake in arithmetic.', 'comradeAbsent'),
      L('Narrator', 'From the ridge, you can see the beginning of a narrow trail above the road. Crispus asks you to scout it, then hesitates before his own orderly: who should present the recovery if your approach succeeds? Here is the first small hinge of a long rivalry: whether a useful deed must have a single owner.'),
    ],
    decision: { id: 'ch3', prompt: 'Before the recovery, agree whose name will lead its report.', options: [
      O('claim', 'Sign your own discovery', 'Gain the troops’ respect and a clear service record; Crispus feels exposed.', 5, -3, 1, 0, 'Your military record is stronger, but Crispus will attack your ambition before the Senate.'),
      O('share', 'Let Crispus present the recovery', 'Give the tribune public credit in exchange for his written acknowledgement.', -1, 6, 1, 1, 'Crispus owes you an early kindness. In Rome he must answer the record he once signed.'),
    ] },
    encounters: [
      E('ch3-station', 'battle', 'The silent station', 'Scout concealed ground, then recover the marked chest.', 'recover', 'grass', 14, 'scout'),
      E('ch3-rolls', 'battle', 'Names on the road', 'Escort the recovered records through the raiders’ second line.', 'escort', 'grass', 12),
    ],
    requirements: ['Use Scout', 'Recover the chest and rolls', 'Return with the recovery party'],
    reward: 'Optio: Varro names you his deputy. An optio’s staff will mark your first authority over others.',
    aftermath: [
      L('Varro', 'Stand at the rear tomorrow. An optio sees who is falling away, who is limping, who is pretending not to be afraid. You have spent three years learning to keep your own place. Now you begin helping others keep theirs.'),
      L('Narrator', 'The recovered roll returns to the eagle’s chest. Crispus’s letter travels to Rome. Your staff is plain wood, but men move aside for it. At the next fort, the hinges of the north gate are already splintering.'),
    ],
  },
  {
    id: 4, title: 'Hold the Line', year: 'c. AD 255', location: 'A frontier fort above a Danube ford',
    rank: 'Optio', rankMeaning: 'The centurion’s deputy', promotion: 'Centurio', promotionMeaning: 'Commander of a century, approximately eighty men',
    capability: 'Order · one ally per turn', description: 'For the first time, another soldier must act because you tell him to.',
    objective: 'Give an Order, hold the gate, and bring the squad through the threatened wall section.',
    intro: [
      L('Narrator', 'The gate drum has a split in its hide. Every alarm sounds like a cough. Beyond the ditch, raiders drag branches toward the ford, and the outwork casts a long shadow over a road it no longer controls. Varro goes to the main wall. He leaves six frightened men and a wooden staff with you.'),
      L('Varro', 'You can change one man’s announced action each turn. One. Your own feet and shield remain your responsibility. Do not shout three orders because you wish you had three voices. Decide which action matters, then make it plain enough for a frightened man to obey.'),
      L('Narrator', 'Each token now represents a small squad, while your own figure remains distinct. Your command capacity is one. Inspect an ally’s intention, choose Order, and replace that intention with a legal move or attack. Unordered squads follow their displayed plan. The relief is startling: someone can finally hold a place you cannot reach yourself.'),
      L('Crispus', 'The outwork is on the engineer’s plan, therefore headquarters will call its loss a failure. The men inside it are on your roll. I can carry a report about either. I cannot make both reports pleasing.'),
      L('Narrator', 'A runner brings the outwork’s last request. Its commander can withdraw now through the postern, or stay until the main gate is secure. Staying will cost lives. Withdrawing will surrender stored grain and a useful firing position. The choice is visible from every shield along the wall.'),
      L('Varro', 'Do not confuse a place with the reason we built it. Equally, do not imagine every retreat is wisdom. Look at the road, the people, the time. Then give the order under your own name.'),
    ],
    decision: { id: 'ch4', prompt: 'The isolated outwork cannot hold without losses.', options: [
      O('withdraw', 'Withdraw its defenders', 'Preserve trained soldiers; lose grain and political credit for the fort’s defence.', 7, -3, 3, -3, 'Surviving outwork veterans later join your household guard and remember the opened postern.'),
      O('hold', 'Hold the outwork', 'Save the fort’s stores and satisfy headquarters; accept a costly stand.', -4, 6, -2, 5, 'The fort’s defence enters your official honours, while bereaved families remember its price.'),
    ] },
    encounters: [
      E('ch4-gate', 'battle', 'The gate with the broken drum', 'Use Order and hold the gate against the first assault.', 'defend', 'stone', 13, 'order'),
      E('ch4-wall', 'battle', 'Across the wall walk', 'Bring the surviving squads through the threatened wall sector.', 'escort', 'stone', 12),
    ],
    requirements: ['Use Order', 'Hold the gate', 'Complete the squad’s withdrawal through the wall'],
    reward: 'Centurio: a vine stick and command of a century. Command capacity rises to three.',
    aftermath: [
      L('Narrator', 'The vine stick feels heavier than the optio’s staff. A century is a living argument of roughly eighty men, each certain his own boots are the worst. You learn their names before learning their complaints.'),
      L('Varro', 'Your first order will return to you for years. That is the part no ceremony explains. Pack for the East. They need centurions on the Euphrates, and the river there has a different colour.'),
    ],
  },
  {
    id: 5, title: 'The Centurion', year: 'c. AD 256', location: 'A fictional Euphrates fortress inspired by Dura-Europos',
    rank: 'Centurio', rankMeaning: 'Commander of a century', promotion: 'Primus pilus', promotionMeaning: 'The legion’s senior centurion, responsible for its eagle',
    capability: 'Formations · line, shield wall, wedge · capacity 3', description: 'Below the wall, a mine. Behind the wall, a city. Your century cannot be everywhere.',
    objective: 'Use a Formation and hold the fortress through the siege’s turning point.',
    intro: [
      L('Narrator', 'The Euphrates shines like beaten bronze below the walls. Dust turns your mail white. Men with long bows move beyond javelin range while armoured horsemen wait in the heat. At night, with your ear against the paving, you hear the Persian miners knocking beneath the tower.'),
      L('Severianus', 'Marcus Aurelius Severianus. I have read your reports. You explain what happened before explaining why it was somebody else’s fault; a rare gift. Hold this sector and I will remember the name. No, do not thank me. Remembering works in both directions.'),
      L('Narrator', 'You have three commands per turn. A Formation can direct up to three adjacent units for a single command, but it cannot give anyone a second move or attack. Use a shield wall to weather arrows, a line to cover the wall, or a wedge when one narrow opening matters more than frontage.'),
      L('Varro', 'A wall is a formation made of stone. Men must fill its cracks. Listen to the ground before you choose where those men go. These tunnels are close and foul; once the props come down, courage will not lift the ceiling.'),
      L('Narrator', 'Families crowd the inner stairs carrying bread ovens’ worth of possessions. The engineer needs your strongest squads for a countermine. The evacuation officer needs those same squads to open the river gate. The fortress is fictional, but neither demand is: a siege consumes labour before it consumes walls.'),
      L('Severianus', 'I can obtain a transport train if you need one. In return, a later requisition of mine must not sit at the bottom of your pile. Nothing unlawful is written here. Nothing in a favour’s first sentence ever is.'),
    ],
    decision: { id: 'ch5', prompt: 'Your century can secure the countermine or lead the families to the river first.', options: [
      O('civilians', 'Open the civilian evacuation route', 'Protect households and accept Severianus’s transport favour.', 1, -2, 8, -4, 'Evacuees spread your name east and west. Severianus records the transport debt.', { id: 'transport-favour', to: 'Severianus', promise: 'Give his veterans priority in a later supply requisition', due: 10, cost: 5, consequence: 'Honouring costs five supplies; breaking it cools the patron’s support.' }),
      O('countermine', 'Commit the century below ground', 'Preserve the wall and military stores; delay the families’ escape.', 5, 5, -5, 3, 'The army praises the counterstroke. Refugees remember being held behind the gate.'),
    ] },
    encounters: [
      E('ch5-mine', 'battle', 'The cracked tower', 'Use a Formation to control the narrow approaches to the tower.', 'siege', 'sand', 14, 'formation'),
      E('ch5-wall', 'battle', 'The red river gate', 'Hold the wall while the fortress reaches its evacuation window.', 'defend', 'stone', 13),
    ],
    requirements: ['Use a Formation', 'Secure the tower approach', 'Hold through the siege’s turning point'],
    reward: 'Primus pilus: senior centurion and guardian of the eagle, on Severianus’s recommendation.',
    aftermath: [
      L('Narrator', 'This fortress survives long enough for its survivors to depart; it is not a claim that historical Dura was saved. Severianus gives you a place beside the eagle. The promotion is swift, born of emptied offices and a report that makes useful reading at headquarters.'),
      L('Varro', 'Primus pilus. First among the centurions. Carry the eagle carefully, but remember that a bird of metal cannot drink. The men beneath it can.'),
    ],
  },
  {
    id: 6, title: 'The Broken Standard', year: 'AD 260', location: 'The retreat after the defeat near Edessa',
    rank: 'Primus pilus', rankMeaning: 'Senior centurion and guardian of the eagle', promotion: 'Praefectus legionis', promotionMeaning: 'Equestrian commander of a legion',
    capability: 'Rally · restore morale · capacity 4', description: 'Valerian is a prisoner. An order arrives from an army that no longer exists.',
    objective: 'Rally shaken units, ration the retreat, and bring the legion and its eagle out.',
    intro: [
      L('Narrator', 'The emperor Valerian has fallen into Persian hands. The details travel faster than certainty: a parley, a trap, a battle, a betrayal. What you can verify lies on the ground. The roads are broken with carts. Water skins pass from hand to hand without growing lighter, because they are already empty.'),
      L('Varro', 'Do not spend your voice telling frightened men not to fear. Give them a place to stand, a drink, and a name to answer. Rally those nearest you. Morale is now as real a danger as a sword. A broken unit leaves a hole that an enemy will find.'),
      L('Narrator', 'Your command capacity rises to four. Rally restores the morale of nearby troops, and every march asks something of their condition and your supplies. The eagle has been lashed to a shortened pole. Its bearer will follow the route you open; your life remains a separate, visible point of failure.'),
      L('Severianus', 'A messenger has brought an order to return to the imperial camp. There is no imperial camp. There are Persian riders around its wells. The written command is authentic; that does not make the army it addresses real.'),
      L('Narrator', 'Varro has a fever and a wound he has concealed for two days. Obeying the return order will put him in the rear guard; he will not come back. Turning toward the western road gives him a place on a wagon. The legion can escape either way, but this choice fixes his fate. A random battlefield fall does not.'),
      L('Varro', 'You asked me once what the oath means when two duties pull against each other. I gave you a drill instead of an answer. Now you have a legion and I have no more drills. Choose what you can still defend when the ink dries.'),
    ],
    decision: { id: 'ch6', prompt: 'The authentic order leads back toward a destroyed headquarters.', options: [
      O('save', 'Turn west and save the legion', 'Defy the written order, preserve Varro, and accept an inquiry.', 8, -5, 4, -3, 'Varro survives to see the oath’s final meaning. Your independence alarms political superiors.'),
      O('obey', 'Make the ordered rear-guard stand', 'Preserve the official record of obedience. Varro dies covering the eventual retreat.', -3, 7, -2, 2, 'Varro is permanently absent. His vine stick and remembered lesson pass into your keeping.'),
    ] },
    encounters: [
      E('ch6-wells', 'battle', 'The empty wells', 'Use Rally to steady the withdrawal and reach the western route.', 'retreat', 'sand', 15, 'rally'),
      E('ch6-eagle', 'battle', 'A pole bound with leather', 'Protect the eagle’s route through the final Persian pursuit.', 'escort', 'sand', 14),
    ],
    requirements: ['Use Rally', 'Bring the legion through the retreat', 'Bring the eagle out'],
    reward: 'Equestrian standing, a gold ring, and appointment as prefect of the legion.',
    aftermath: [
      L('Varro', 'The ring is handsome. Keep it out of the cookpot. I shall retire before you grow entirely impossible to advise.', 'mentorAlive'),
      L('Narrator', 'Varro’s vine stick reaches you wrapped in his cloak. Its handle is smooth where his thumb rested. You find yourself putting your thumb in the same place.', 'mentorAbsent'),
      L('Severianus', 'Gallienus needs commanders who can bring an army out as well as send one in. Your service brings equestrian standing; my recommendation brings the appointment. Neither makes us equal in years. Time may correct that.'),
    ],
  },
  {
    id: 7, title: 'A Legion to Lead', year: 'AD 267–268', location: 'Northern Italy; the army before Milan',
    rank: 'Praefectus legionis', rankMeaning: 'Equestrian commander of a legion', promotion: 'Praepositus', promotionMeaning: 'Commander of a detached expeditionary force',
    capability: 'Deploy · Prepare · Persuade · capacity 5', description: 'Your narrow stripe opens headquarters. It also shows another man the door.',
    objective: 'Carry the council, prepare and deploy the legion, then win its battle.',
    intro: [
      L('Narrator', 'A narrow purple stripe now runs down your tunic. At the map table, men wait until you speak. Outside, a legion turns your smallest hesitation into rumour. Gallienus has increasingly entrusted commands to equestrian professionals. Crispus’s family once made his future seem certain; now his senatorial standing closes a military door.'),
      L('Crispus', 'They call it efficiency. Perhaps it is. You have earned your legion. That does not mean the men removing my name from the army list have earned the right to despise it. I am going to Rome. There are still rooms where a soldier must ask permission to enter.'),
      L('Narrator', 'The council is your first Contest. Speakers move among voting members on the same grid as soldiers. Each has Resolve and one speech per turn. Persuade shifts a nearby member’s stance. The vote is taken at the deadline, not when you first reach a majority; a tie preserves the present plan.'),
      L('Severianus', 'After the council, choose how the camp spends the night. Fortification protects, rest steadies tired men, drill sharpens their work, and forced marching spends condition for position. Deploy the command before battle. Five orders do not make every cohort obedient at once; they make your priorities visible.'),
      L('Narrator', 'Your legion’s assignment brings you into the Italian campaign. A sealed note circulates among officers outside Milan. Gallienus will be called from his tent on a false alarm. You cannot undo the recorded history: the emperor will be murdered in 268. You can decide whose hand is found near the knife.'),
      L('Varro', 'Men can swear the same oath and use it to explain opposite deeds. Ask which explanation they will still offer without an audience.', 'mentorAlive'),
      L('Narrator', 'You turn Varro’s vine stick in your hands. You remember how carefully he distinguished an order from an excuse.', 'mentorAbsent'),
    ],
    decision: { id: 'ch7', prompt: 'The plot against Gallienus reaches your tent.', options: [
      O('warn', 'Send a warning', 'Attempt to warn the emperor; lose the conspirators’ favour when the warning fails.', 2, -6, 6, 0, 'Gallienus still dies. Your failed warning becomes evidence of loyalty in the final succession.'),
      O('refuse', 'Keep your legion outside the plot', 'Refuse participation and preserve a cautious distance.', 4, 1, 1, 0, 'Gallienus still dies. Your legion remembers being spared a part in the murder.'),
      O('join', 'Promise the plotters your silence', 'Gain a political connection at the cost of complicity and a future debt.', -2, 8, -5, 2, 'Gallienus still dies. The conspirators’ heirs later demand immunity.', { id: 'milan-immunity', to: 'The officers of Milan', promise: 'Protect their households from a later purge', due: 12, cost: 7, consequence: 'Honouring preserves a compromised alliance; breaking it loses their political support.' }),
    ] },
    encounters: [
      E('ch7-council', 'contest', 'The officers’ table', 'Persuade the council to back your deployment by the vote deadline.', 'council', 'chamber', 8, 'persuade'),
      E('ch7-legion', 'battle', 'A legion at your word', 'Prepare camp, Deploy your command, and win the legion’s engagement.', 'battle', 'grass', 14, 'deploy'),
    ],
    requirements: ['Win the council', 'Prepare and Deploy', 'Win the legion’s battle'],
    reward: 'Praepositus: command of a detached expeditionary force. Army Loyalty, Political Backing, and Public Confidence now stand openly beside your orders.',
    aftermath: [
      L('Narrator', 'The murder changes the names at headquarters, not the hunger in the camp. Your detached command receives a new seal and old wagons. Crispus departs for Rome, carrying the memory of a road station and a career that ended too soon.'),
      L('Severianus', 'The next emperor will need crossings, supplies, and men who can speak to people outside an army. Go back to your river. It has work for you.'),
    ],
  },
  {
    id: 8, title: 'Beyond the Frontier', year: 'Early AD 270s', location: 'Dacia and the Danube crossings',
    rank: 'Praepositus', rankMeaning: 'Commander of a detached expeditionary force', promotion: 'Acting commander', promotionMeaning: 'Acting commander of the campaign army',
    capability: 'Negotiate · Promise · Threaten', description: 'A frontier moves. The people who lived behind it must move with it.',
    objective: 'Negotiate passage, bring the settlers across, and secure the river crossings.',
    intro: [
      L('Narrator', 'The roads of Dacia point toward the river. Carts carry roof beams, hens, jars of ashes, and children who think this is a journey. Aurelian’s withdrawal unfolds across years whose precise sequence is debated. Here it becomes your immediate problem: more people than boats, more claims than grain, and a crossing threatened at both ends.'),
      L('Aelia', 'Aelia Dacia. I keep the households’ names. Not because names make room on a boat, but because a list of “three hundred mouths” can disappear much more easily. These people have paid taxes to Rome all their lives. Do not tell them they become foreigners by crossing a Roman river.'),
      L('Narrator', 'Gothic and Carpic representatives meet your officers above the ford. Neither side is a single people with a single wish. One leader needs grain; another wants captives returned; both want to know whether your retiring frontier conceals a new attack. Begin Negotiate before attempting the council’s vote.'),
      L('Severianus', 'Promise is powerful because tomorrow is cheaper than today. Every promise names its recipient, its due date, and its cost. A member can receive one; this Contest permits two altogether. Threaten works quickly, but people carry the memory of a threat farther than the sound of it.'),
      L('Lucan', 'I can put the veterans on the first boats and make the southern bank safe. Or I can keep them here while the children cross. Either way, someone will say we chose the wrong people first.', 'comradeAlive'),
      L('Sabinus', 'The veterans want the first boats. The families need them. Give me a clear order, and I will get the rear guard across after it. I learned that much in the marsh.', 'comradeAbsent'),
      L('Narrator', 'Aelia opens her ledger. There is a blank column headed “land”. Passage ends at the far bank; responsibility does not. Whatever you promise now will be waiting when the same displaced families stand before your future tribunal.'),
    ],
    decision: { id: 'ch8', prompt: 'The first ferry loads must be assigned, and Aelia demands a settlement pledge.', options: [
      O('families', 'Families first; pledge protected farms', 'Gain the settlers’ trust; spend supplies and owe them secure southern land.', -2, 1, 9, -5, 'Aelia becomes a willing witness to your care; the land pledge returns during your governorship.', { id: 'settler-farms', to: 'Aelia’s households', promise: 'Protect displaced families’ farms south of the river', due: 10, cost: 6, consequence: 'Honouring costs six supplies and protects the settlers’ claim; shared tenure can fulfil it. Breaking it damages Public Confidence and Aelia’s trust.' }),
      O('soldiers', 'Secure the far bank with veterans first', 'Keep the army strong and pledge ferry wages to the rear guard; families wait.', 7, 3, -4, 2, 'Aelia cooperates out of necessity and later demands evidence that civilians matter to your rule.', { id: 'ferry-wages', to: 'The crossing veterans', promise: 'Pay the soldiers who remain with the final ferry', due: 12, cost: 4, consequence: 'Honouring costs four supplies; breaking it damages Army Loyalty.' }),
    ] },
    encounters: [
      E('ch8-parley', 'contest', 'Words above the ford', 'Negotiate and carry a majority for safe passage at the deadline.', 'council', 'chamber', 10, 'negotiate'),
      E('ch8-ferry', 'battle', 'The last boats', 'Escort the settlement column to the secure crossing marker.', 'escort', 'river', 15),
      E('ch8-crossing', 'battle', 'The far bank', 'Hold the crossing while the rear guard completes the passage.', 'defend', 'river', 12),
    ],
    requirements: ['Use Negotiate', 'Secure a passage agreement', 'Bring settlers across and hold the crossing'],
    reward: 'Acting command of the campaign army, exercised in a superior’s place. Your mandate leads south and east into Aurelian’s wars.',
    aftermath: [
      L('Aelia', 'We are across. I will write that beside your name. I will leave room for what comes next.'),
      L('Narrator', 'The last ferry lands beneath a wet dawn. Your orders appoint you to act in a superior’s place, not to inherit a new permanent rank. An army can be entrusted provisionally; its mistakes will still carry your full name.'),
    ],
  },
  {
    id: 9, title: 'Rome’s Sword', year: 'AD 272–274', location: 'Aurelian’s eastern campaign and reunification',
    rank: 'Acting commander', rankMeaning: 'Acting commander of the campaign army', promotion: 'Dux', promotionMeaning: 'Senior commander of a major multi-legion campaign',
    capability: 'Stratagems · night march, feigned retreat, flank march · capacity 6', description: 'You have learned to win a road, a wall, a legion. Now you must win a campaign.',
    objective: 'Choose and execute a stratagem, then win the campaign’s decisive engagement.',
    intro: [
      L('Narrator', 'The road east fills with cavalry. Their mail shines in the morning and hangs like a furnace at noon. Aurelian’s campaigns will break Palmyrene power and restore the Gallic provinces to imperial rule. Your missions take place at their edges, where named victories depend on nameless detachments being in the right place.'),
      L('Severianus', 'A command of six does not mean six chances to repeat a mistake. Decide the approach before the first horn. A night march gives position at a cost; a flank march opens an angle; a feigned retreat invites heavy cavalry to spend itself on a chase. Every approach asks the army to believe something difficult.'),
      L('Narrator', 'Choose a Stratagem in preparation. Tokens now represent cohorts and cavalry wings; you remain the command unit whose fall would lose the battle. Terrain, facing, fatigue, and orderly withdrawal matter more than the number of swords drawn at once. Heavy horse in the heat is dangerous, but not inexhaustible.'),
      L('Lucan', 'I used to think command meant standing where everyone could see you. Now I think it means knowing which man cannot see anyone else. I will take the detached wing. If you call it back, make the signal plain.', 'comradeAlive'),
      L('Sabinus', 'My wing knows the recall signal. No second Abritus if I can help it. We will yield ground, not one another.', 'comradeAbsent'),
      L('Narrator', 'Envoys from a nearby city arrive before the decisive engagement. They offer its keys if you secure the approach, and ask what surrender will mean for their households. Your soldiers expect recompense; its inhabitants fear punishment. Aurelian’s history remains his. The terms attached to your own name are yours to decide.'),
      L('Severianus', 'The emperor values victory. He also notices who the soldiers cheer when the fighting stops. Take your honour with a bowed head. It may be the last thing he permits you to carry without an escort.'),
    ],
    decision: { id: 'ch9', prompt: 'The city’s envoys offer surrender. Declare the terms your army will enforce when the approach is secured.', options: [
      O('mercy', 'Protect the surrendered city', 'Forbid sack and preserve its grain markets; disappoint men expecting plunder.', -2, 2, 9, 2, 'Your mercy becomes evidence for opening Rome’s gates in the succession crisis.'),
      O('severity', 'Impose exemplary punishment', 'Seize stores and reward the army; spread fear among civilians.', 7, 4, -8, 7, 'The troops profit and officials praise discipline, but Rome remembers what surrender cost this city.'),
    ] },
    encounters: [
      E('ch9-wing', 'battle', 'The turning cavalry', 'Execute your chosen Stratagem against the armoured wing.', 'battle', 'sand', 15, 'stratagem'),
      E('ch9-city', 'battle', 'The road to the keys', 'Break the final field resistance and secure the approach to the city.', 'battle', 'sand', 15),
    ],
    requirements: ['Choose and use a Stratagem', 'Win the decisive engagement', 'Secure the defeated city'],
    reward: 'Dux: the game’s highest non-imperial military command, and a general’s cloak.',
    aftermath: [
      L('Narrator', 'Your appointment as dux recognises command of a major campaign force; the title is not a single fixed empire-wide office. Then another appointment arrives: praeses, governor of Dacia Aureliana. The army cheers the first document. The second sends you away from it.'),
      L('Severianus', 'A province is a great honour. That is why an emperor can use one as a quiet door out of his army. Pack the cloak. Leave the command seal.'),
    ],
  },
  {
    id: 10, title: 'The Province', year: 'AD 274–275', location: 'Dacia Aureliana, south of the Danube',
    rank: 'Praeses', rankMeaning: 'Equestrian provincial governor', promotion: 'Former governor', promotionMeaning: 'Eligible for imperial admission to the Senate',
    capability: 'Allocate · Judge · Address the Chamber · Rebut', description: 'The emperor has promoted you away from the men who love you. A starving province receives you.',
    objective: 'Allocate relief, defeat the raiders, and win a binding provincial judgment.',
    intro: [
      L('Narrator', 'The governor’s residence has a painted garden on its inner wall. Beyond the real wall, people wait for grain. You are praeses, an equestrian provincial governor, in the new Dacia south of the Danube. Your gold ring is unchanged. The army’s standards have been replaced by petition bundles tied with string. Aurelian has given you more responsibility and less force.'),
      L('Aelia', 'These are the households you brought across. Some have seed and no ground. Some have ground and no seed. The people already living here are no less hungry. You once told us the river was the hard part. I do not remember whether I believed you.'),
      L('Narrator', 'The crisis has three faces. Raiders strike the road that feeds the towns. A clerk has sold relief grain through his brother’s warehouse. Settlers and established households claim the same fields under documents signed by different officials. Winning a battle can reopen the road. It cannot decide whose child eats the first loaf.'),
      L('Provincial clerk', 'Allocate the six-convoy relief reserve among the river, farms, and town. Each must receive at least one convoy. The allocation is recorded, and its effects are visible before confirmation. River relief supports Army Loyalty; farm relief supports Public Confidence; town relief supports Political Backing. These are the province’s six convoys, not an unlimited granary.'),
      L('Narrator', 'Use Allocate before the raid, then Judge before the tribunal Contest. You still command trained men, but your small escort cannot replace a field army. On the tribunal grid, Address the Chamber shifts several nearby members and then cools down. Rebut restores a fellow speaker’s Resolve or blunts the rival’s next speech. Position now controls whose argument can be heard.'),
      L('Severianus', 'The capital is pleased by an orderly province. It is less pleased by unpaid accounts. If the transport favour remains in your ledger, my veterans have reached the point where they expect the return. They are not the only people waiting for you to remember a promise.'),
      L('Narrator', 'The corrupt clerk offers a familiar defence: every superior has borrowed against next year’s grain, so surely no one man can be blamed for an empty granary. His books also contain evidence useful to Crispus in Rome. You can expose the diversion and still refuse to make a hungry district pay for its official’s theft.'),
      L('Aelia', 'Let me be plain. A promise to us cannot be fulfilled by stealing from a family already here. But do not ask the people who lost their homes to be endlessly patient because patience is the cheapest thing a governor can order.'),
      L('Narrator', 'The tribunal must back a practical settlement at the deadline. Shared tenure and seed relief spread the loss but anger wealthy title-holders. Exclusive settlement grants honour the displaced families’ strongest claim while pushing established tenants into debt. Both can end the immediate crisis. Neither permits you to pretend that law has no losers.'),
    ],
    decision: { id: 'ch10', prompt: 'Two lawful-looking claims cover the same fields. Whose settlement will you defend?', options: [
      O('shared', 'Order shared tenure and seed relief', 'Protect established tenants and resettle families with a funded compromise.', 1, -4, 9, -6, 'Aelia accepts a difficult shared settlement. Established households become witnesses for your fair government.'),
      O('settlers', 'Give the displaced families first title', 'Make firm resettlement grants, meet the clearest pledge, and alienate existing landholders.', 3, 6, -4, -2, 'Aelia’s households obtain secure title. Dispossessed tenants carry a grievance into your reign.'),
    ] },
    encounters: [
      E('ch10-road', 'battle', 'Grain under guard', 'Allocate relief, then drive the raiders from the provincial grain road.', 'raid', 'river', 14, 'allocate'),
      E('ch10-tribunal', 'contest', 'The governor’s tribunal', 'Judge the claims and use Address the Chamber while securing a majority at the deadline.', 'judgment', 'chamber', 12, 'address'),
    ],
    requirements: ['Allocate the relief reserve', 'Win the grain-road battle', 'Judge the dispute and win the tribunal Contest'],
    reward: 'The provincial crisis is resolved. You leave office with a record that can support a petition for the Senate.',
    aftermath: [
      L('Narrator', 'The grain road opens. The judgment is copied and nailed beside the market, where every reader finds a different injustice and a different mercy. The clerk’s accounts are sent for examination; his neighbours do not lose their ration because his hands were dishonest. For a season, the province can breathe.'),
      L('Aelia', 'I have filled another column beside your name. It is longer than the first. If Rome asks whether you governed here, I will answer. If Rome asks whether you pleased everyone, I will laugh.'),
      L('Narrator', 'Your governorship ends by imperial transfer. In Rome, Crispus has prepared an argument that a soldier’s service does not qualify him for the Senate. Severianus has prepared a letter of support. Neither man has forgotten what your rise has cost him.'),
    ],
  },
  {
    id: 11, title: 'The Senate', year: 'AD 275, before Aurelian’s assassination', location: 'Rome, within Aurelian’s new walls',
    rank: 'Candidate for the Senate', rankMeaning: 'A petitioner for imperial adlection', promotion: 'Senator', promotionMeaning: 'Admitted at consular rank by imperial grant',
    capability: 'Invoke Record · Denounce', description: 'No legion can carry you through this door. Your record must walk in first.',
    objective: 'Win the committee Contest and the decisive vote backing your imperial admission.',
    intro: [
      L('Narrator', 'Rome is louder than a battlefield because no one sound admits it is in command. Carts grind past new defensive walls, masons bargain for lime, and a child asks whether your narrow stripe means you collect taxes. You enter as a candidate, not a senator. Your province is behind you; its judgments have arrived ahead.'),
      L('Crispus', 'Aurelius Marcellus. I knew you when you were very good at finding a missing chest. A useful man. Rome has suffered lately from useful men deciding that usefulness entitles them to everything. Tell us: which of your victories taught you how to outvote hunger?'),
      L('Paullus', 'Crispus confuses a question with an insult, but there is a question. Aurelian alone can grant your admission by adlection. Our support gives that grant political weight. We will hear your record before deciding whether it merits a place among men who must govern after the army marches on.'),
      L('Narrator', 'Two substantial Contests stand between you and admission. First, a committee tests the provincial accounts and your fitness to hold civil authority. Then the assembled blocs vote on backing the petition. Neither victory makes the grant before the other is complete. Each has a fixed deadline, rival speakers, wavering members, and a majority that cannot be secured by shouting once.'),
      L('Narrator', 'Invoke Record draws strength from completed military achievements. You have earned those deeds through play; now use them as political evidence. Denounce attacks a rival speaker’s Resolve, reducing the opposition’s ability to act. A withdrawn speaker still keeps a vote, and the majority required does not shrink. Choose whether to win minds, disarm attacks, or combine both.'),
      L('Severianus', 'I can introduce you to a dependable bloc. Dependable means paid attention to, not purchased; one must preserve the language. In return, appoint my nephew to supervise military supplies when the opportunity comes. He is less gifted than you. That is exactly why he requires a position.'),
      L('Narrator', 'Accepting the patron’s price brings political backing and a recorded obligation. Refusing leaves more votes to win by your own record. A failed Contest can be retried from its complete starting checkpoint; a patron-assisted rerun buys another challenge, never automatic admission. You can arrive weak, exhausted, or compromised and still find a playable way forward.'),
      L('Varro', 'I received your letter. Rome has many words for who a man is permitted to become. I knew your name before any of them. Keep that name legible underneath the titles.', 'mentorAlive'),
      L('Narrator', 'Before entering the chamber, you touch the smooth handle of Varro’s vine stick. He never saw this city with you. His first lesson nevertheless seems better suited to its arguments than any speech your secretary has drafted.', 'mentorAbsent'),
      L('Narrator', 'Crispus places the old recovery report beside your newer accounts. The ink from Chapter Three has faded, but the name beneath it remains. Beyond the door, senators talk about the empire as though it were a house whose roof can be repaired without disturbing anyone seated comfortably beneath it.'),
    ],
    decision: { id: 'ch11', prompt: 'Severianus offers the votes of his friends at a precise price.', options: [
      O('independent', 'Win on the record you earned', 'Preserve independence; enter the debates with fewer guaranteed friends.', 2, -3, 7, 0, 'The Senate remembers that your admission was earned without a new patronage bargain.'),
      O('patron', 'Accept the bloc and its price', 'Gain Political Backing and owe Severianus a powerful supply appointment.', 1, 12, -3, 3, 'Severianus expects his family’s influence to survive every later promotion.', { id: 'nephew-office', to: 'Severianus', promise: 'Give his nephew oversight of military supply', due: 12, cost: 9, consequence: 'Honouring costs nine supplies and entrenches patronage; breaking it makes the patron hostile.' }),
    ] },
    encounters: [
      E('ch11-accounts', 'contest', 'The accounts of a soldier', 'Invoke Record and win the committee’s majority at its deadline.', 'senate', 'chamber', 12, 'record'),
      E('ch11-adlection', 'contest', 'The petition for the broad stripe', 'Use Denounce and secure the decisive vote backing imperial admission.', 'senate', 'chamber', 14, 'denounce'),
    ],
    requirements: ['Complete Chapters 1–9 and earn Dux', 'Resolve the governorship', 'Win both political Contests and secure the imperial grant'],
    reward: 'Senator by adlectio inter consulares: Aurelian’s grant admits you at consular rank. The narrow stripe becomes the broad stripe.',
    aftermath: [
      L('Paullus', 'The backing is recorded. The emperor’s grant has followed it. You enter at consular rank, by admission rather than a consulship retroactively invented for you. Sit. There will be another argument before midday.'),
      L('Narrator', 'A servant brings the broad-striped tunic. You fold the old one with unreasonable care. Weeks later, a messenger rides through the gate carrying news from the road toward Byzantium: Aurelian has been murdered. The empire that required your admission yesterday needs a ruler today.'),
    ],
  },
  {
    id: 12, title: 'The Purple', year: 'Late AD 275–276', location: 'Rome and the road of the rival armies',
    rank: 'Senator', rankMeaning: 'Admitted at consular rank', promotion: 'Augustus', promotionMeaning: 'Emperor, acclaimed by the army and confirmed by the Senate',
    capability: 'Every earlier lesson', description: 'The words you once spoke to an emperor are about to be spoken to you.',
    objective: 'Win legitimacy, resolve the playable confrontation, and accept the army’s acclamation and the Senate’s confirmation.',
    intro: [
      L('Narrator', 'Aurelian is dead, murdered by men of his own service in the autumn of 275. Until this moment, the great public events have followed recorded history. Here the succession divides. The historical throne will not pass in its historical sequence. Your twenty-five years of choices have brought another name into the argument.'),
      L('Paullus', 'I have served without seeking the affection of an army. That should recommend me, although I understand why it may not. Rome cannot endure a contest every time an emperor’s guard grows frightened. Give the Senate a ruler whose authority does not depend on the next camp’s applause.'),
      L('Crispus', 'He offers a settlement. You offer a career. Ask your admirers which one they believe they are choosing. I have watched your cloak change colour for twenty years. I intend to keep watching when it is purple.'),
      L('Lucan', 'My legion is coming. Do not ask whether it will come; ask what you intend to do with it. In the marsh you carried one frightened man. He has had a long time to decide whether that meant anything.', 'comradeAlive'),
      L('Sabinus', 'The legion is coming under my command. Lucan should have had this place. I cannot lend you his forgiveness, but I can bring you soldiers. Use them so that another village does not receive the same letter.', 'comradeAbsent'),
      L('Narrator', 'First comes the legitimacy Contest. Your speakers must hold a majority at the deadline while Paullus and Crispus challenge the claim. Earlier deeds, promises, and relationships enter the room with you. Every obligation can be honoured or broken with its cost shown in the ledger. Conflicting promises do not cancel each other by being inconvenient.'),
      L('Narrator', 'Then the confrontation must be played. Read its forecast before committing. Army Loyalty determines the veterans who march and the enemies who may defect. Political Backing shapes declarations of public enmity and access to negotiation. Public Confidence determines whether the gates and garrison resist you. Improving a meter cannot remove a route or weaken the same position.'),
      L('Narrator', 'If support is strong, hold the lines through a negotiated standoff, induce defections, or compel surrender. If it is weak, win a harder battle. A minimum loyal force always arrives under Lucan or Sabinus. A backer can supply additional help for a serious obligation, even at the lowest possible standing. That bargain still buys a challenge, never a crown.'),
      L('Severianus', 'I backed the centurion. I will stand with the senator. Do not mistake friendship for a cancelled ledger; the men who followed my advice expect your promises to survive your elevation.', 'patronSupport'),
      L('Severianus’s messenger', 'My master waits to see what is offered. The treasury faction is ready to advance its own support if he will not. Someone will always advance the money. You know that “always” is not the same as “freely”.', 'patronNeutral'),
      L('Treasury envoy', 'Severianus has offered his own name to officers who distrust you. His former clients are not his property. Our syndicate can provide the costly backing in his place, if you accept its claim on future revenue.', 'patronHostile'),
      L('Aelia', 'My people have heard that armies may march past their farms again. We remember the boats. We remember the judgment. Whatever title the soldiers shout, those fields will still need seed next spring.'),
      L('Varro', 'You have a larger shield now. That is all a throne is allowed to be, if the person holding it remembers the person beside him.', 'mentorAlive'),
      L('Narrator', 'Varro’s voice comes back without ceremony: ' + MENTOR_LESSON + ' You have carried the sentence farther than its speaker could travel.', 'mentorAbsent'),
      L('Narrator', 'Before the final march, you draw the old lead seal from beneath the broad stripe. Its edges have worn smooth against your skin. The clerk who gave it to you could not have imagined this day. Neither could the recruit who believed an oath was something finished once it had been spoken.'),
    ],
    decision: { id: 'ch12', prompt: 'Before the confrontation, declare the terms on which you will accept victory.', options: [
      O('honour', 'Offer lawful settlement and mercy', 'Protect surrendered rivals and honour every remaining open obligation at its stated cost. Earlier ledger settlements stand.', 1, 4, 7, -3, 'Defeated rivals retain life under supervision. All promises still open are honoured, with their supply costs and any shortfall paid in Public Confidence.'),
      O('release', 'Demand unconditional submission', 'Confiscate rival estates and repudiate every remaining open promise, paying its stated penalties. Earlier ledger settlements stand.', 7, 2, -6, 5, 'Rivals lose estates and freedom. All promises still open are broken; each costs Public Confidence and Political Backing, with any additional named penalty.'),
    ] },
    encounters: [
      E('ch12-legitimacy', 'contest', 'Whose name on the decree?', 'Secure a majority for your legitimacy at the vote deadline.', 'legitimacy', 'chamber', 14),
      E('ch12-confrontation', 'battle', 'The road to the purple', 'Complete the forecast route’s confrontation: battle, standoff, surrender, or defections.', 'confrontation', 'stone', 16),
    ],
    requirements: ['Complete Chapter 11', 'Earn Senator status through both Contests', 'Win legitimacy and the decisive confrontation'],
    reward: 'Augustus. The army acclaims you and the Senate confirms the accession. There is no new mechanic after the crown.',
    aftermath: [
      L('Narrator', 'The acclamation begins at one end of the line and crosses it like wind through grain. The broad stripe disappears beneath purple. A secretary waits for your first order. Before giving it, you hold the lead seal where the nearest soldiers can see it.'),
      L('The legions · the same original oath', OATH),
      L('Narrator', 'You hear the words as a recruit heard them, and as an emperor must. The decree confirms the acclamation. The crown is an ending for the climb, and a beginning for everyone who must live beneath it.'),
    ],
  },
];

function present(state, person) {
  if (person === 'comrade') return state?.decisions?.ch2 !== 'leave';
  if (person === 'mentor') return state?.decisions?.ch6 !== 'obey';
  return true;
}

// Call this accessor instead of rendering conditional arrays directly.
export function sceneLines(chapter, stage, state) {
  const data = typeof chapter === 'number' ? CHAPTERS.find(c => c.id === chapter) : chapter;
  return (data?.[stage] || []).filter(line => {
    if (!line.when) return true;
    if (line.when === 'comradeAlive') return present(state, 'comrade');
    if (line.when === 'comradeAbsent') return !present(state, 'comrade');
    if (line.when === 'mentorAlive') return present(state, 'mentor');
    if (line.when === 'mentorAbsent') return !present(state, 'mentor');
    if (line.when === 'patronSupport') return (state?.relationships?.patron || 0) >= 10;
    if (line.when === 'patronNeutral') return (state?.relationships?.patron || 0) >= 0 && (state?.relationships?.patron || 0) < 10;
    if (line.when === 'patronHostile') return (state?.relationships?.patron || 0) < 0;
    return false;
  }).map(({ speaker, text }) => ({ speaker, text: text.replaceAll('Aurelius Marcellus', state?.name || 'Aurelius Marcellus') }));
}

// Each persistent decision has an explicit, later reader. The journal and
// epilogue consume these echoes, so low and high meter paths remain narratable.
export const DECISION_READERS = {
  ch1: {
    report: 'The first report: you named Lucan’s mistake. Officers learned to trust your records; your tent-mate learned that your friendship had limits.',
    cover: 'The lost javelin: you paid beside Lucan. Veterans still repeat the story of a recruit who shared a small blame before bearing great authority.',
  },
  ch2: {
    carry: 'The marsh: you carried Lucan out of Abritus. His surviving legion gives the old rescue a thousand shields of consequence.',
    leave: 'The marsh: Lucan never returned. Sabinus commands the legion in his place, and the empty place remains part of your history.',
  },
  ch3: {
    claim: 'The recovery report bears your discovery in your own name. Crispus never forgot being made a witness to another man’s rise.',
    share: 'Crispus presented the recovered chest, but his signed acknowledgement survived. In Rome, an old courtesy complicated his opposition.',
  },
  ch4: {
    withdraw: 'The opened postern: the outwork’s survivors grew old under your standards. Their children remember the order that brought them home.',
    hold: 'The held outwork: its defence decorates the official record. Bereaved households keep a second record of the men who paid for it.',
  },
  ch5: {
    civilians: 'At the Euphrates fortress, families reached the river before the countermine received its full strength. Gratitude travelled farther than the transport debt.',
    countermine: 'At the Euphrates fortress, you sent the century beneath the tower. The rescued stores and delayed families tell different versions of that victory.',
  },
  ch6: {
    save: 'After Edessa, you chose the living legion over a dead headquarters’ order. Varro survived to measure the choice against the oath he taught.',
    obey: 'After Edessa, your formal obedience cost Varro his life. His vine stick became a reminder that a correct order can leave an unanswerable grief.',
  },
  ch7: {
    warn: 'The warning at Milan failed to save Gallienus, but its existence kept your name apart from his murderers.',
    refuse: 'At Milan, you kept the legion outside the conspiracy. Caution became one of the few accounts no faction could wholly claim.',
    join: 'Your silence helped the Milan plotters. Their heirs remembered the bargain after your own seals grew more impressive.',
  },
  ch8: {
    families: 'At the Danube ferries, families crossed first. Aelia entered both that mercy and the promised farms beside your name.',
    soldiers: 'At the Danube ferries, veterans secured the far bank first. Their wages and the waiting families’ distrust outlived the crossing.',
  },
  ch9: {
    mercy: 'The surrendered city kept its homes. When Rome considered opening its own gates, merchants could point to a mercy already tested.',
    severity: 'The surrendered city lost its stores to your army. Rome understood that your promises of order could arrive with confiscation.',
  },
  ch10: {
    shared: 'In Dacia Aureliana, shared tenure and seed relief made uneasy neighbours into a working province. Neither group received everything it wanted.',
    settlers: 'In Dacia Aureliana, the displaced households received first title. Aelia’s people gained security while established tenants carried the cost.',
  },
  ch11: {
    independent: 'You sought the broad stripe on your own record. The admission left you fewer guaranteed friends and one fewer purchased obligation.',
    patron: 'Severianus’s bloc backed your petition. His nephew’s promised supply office followed you from the Senate to the steps of the throne.',
  },
  ch12: {
    honour: 'Your accession terms preserved surrendered rivals under supervision and made the settlement of promises a public duty.',
    release: 'Your accession terms confiscated rival estates and demanded submission. The new administration began under the army’s watchful protection.',
  },
};

export function choiceEchoes(state) {
  return Object.entries(state?.decisions || {}).map(([id, value]) => {
    const option = typeof value === 'string' ? value : value?.id;
    return DECISION_READERS[id]?.[option] || `The recorded decision “${id}” (${String(option ?? value)}) remains in the imperial archive.`;
  });
}

export function epilogue(state) {
  const m = state?.meters || { army: 0, political: 0, public: 0 };
  const decisions = state?.decisions || {};
  const name = state?.name || 'Aurelius Marcellus';
  const route = state?.route || state?.encounter?.route || 'battle';
  const bloodless = ['settlement', 'negotiated', 'standoff', 'surrender', 'defection', 'defections'].includes(route);
  const obligations = (state?.obligations || []).map(o => {
    const status = o.status || (o.honoured || o.honored ? 'honoured' : o.broken ? 'broken' : 'outstanding');
    return `${o.to || o.recipient || 'A creditor'}: ${o.promise || o.description || 'a recorded bargain'} — ${status}.`;
  });
  return [
    { title: `${name} Augustus`, text: `The purple settles on the shoulders of a man who once carried his whole property in a folded cloak. ${bloodless ? 'Political backing helped secure the decisive field confrontation. Its survivors still remember the pressure brought to bear before the rival coalition yielded.' : 'Victory in the field secured the accession, and its losses remain the first account of the reign.'} The lead identity seal lies beneath the imperial cloak. It still bears the recruit’s name.` },
    { title: 'The first four chapters', text: ['ch1','ch2','ch3','ch4'].map(id => DECISION_READERS[id]?.[decisions[id]]).filter(Boolean).join(' ') || 'The first javelin, the marsh, the recovered rolls, and the fort’s postern remain the small places from which the imperial road began.' },
    { title: 'The army', text: `${m.army >= 60 ? 'Veterans attach themselves to the new reign through remembered service, giving the emperor room to command without buying every order.' : m.army >= 30 ? 'The legions accept the new emperor, but pay, supplies, and visible attention must renew that acceptance.' : 'A minimum loyal force made the accession possible. The wider army waits to see whether the new emperor can afford its patience.'} ${present(state, 'comrade') ? 'Lucan holds his legion’s command. When the court grows solemn, he still knows the miller’s son’s version of your childhood.' : 'Sabinus commands the loyal legion. Each year its casualty roll is read with Lucan’s name intact; replacement does not mean forgetting.'}` },
    { title: 'The Senate', text: `${m.political >= 60 ? 'A substantial coalition gives the imperial decrees a civil foundation. It also expects to be heard when the emperor grows impatient.' : m.political >= 30 ? 'The Senate confirms the rule with measured support. Committees become the place where old bargains are tested against new orders.' : 'Confirmation comes after a hard contest. Many senators obey the result while withholding affection, leaving the emperor dependent on careful bargaining.'} ${decisions.ch12 === 'honour' ? 'Paullus keeps his life and a supervised place in public affairs. Crispus remains a critic who must answer arguments rather than await a secret sentence.' : 'Paullus and Crispus lose freedom and estates under the accession settlement. Their surviving networks become a permanent subject of official attention.'}` },
    { title: 'The provinces', text: `${m.public >= 60 ? 'Markets and gates open more readily to the emperor’s officers because the provincial record gives ordinary households reasons to hope.' : m.public >= 30 ? 'Provincial confidence remains conditional: the grain must arrive, the tax clerk must listen, and soldiers must pay for what they take.' : 'The provinces greet the new name cautiously. A purple cloak does not refill a granary, and every requisition risks confirming the worst expectations.'} ${decisions.ch10 === 'settlers' ? 'Aelia’s settlers keep their grants, but the displaced former tenants demand redress.' : 'Aelia oversees the difficult work of shared tenure, seed distribution, and keeping two groups’ names on the same rolls.'}` },
    { title: 'The people behind the titles', text: `${present(state, 'mentor') ? `Varro sees the accession and refuses a gilded chair. He repeats his first lesson once more: “${MENTOR_LESSON}”` : `Varro does not see the accession. His vine stick rests beside the imperial writing table, carrying a sentence no herald needs to proclaim: “${MENTOR_LESSON}”`} ${(state?.relationships?.patron || 0) >= 10 ? 'Severianus stands among the new reign’s supporters. He expects his recommendations to receive an audience, even when they no longer receive obedience.' : (state?.relationships?.patron || 0) < 0 ? 'Severianus’s attempted candidacy finds no crown. The treasury syndicate replaces him wherever the accession requires a willing creditor.' : 'Severianus bargains openly with a former client whose independence he helped create. His ledger survives the change of reign.'}` },
    { title: 'What the record keeps', text: Object.entries(decisions).filter(([id]) => !['ch1','ch2','ch3','ch4'].includes(id)).map(([id,value]) => DECISION_READERS[id]?.[value] || `The archive retains ${id}: ${value}.`).join(' ') || 'The later service record remains available in the mission journal.' },
    { title: 'The working decisions', text: `${state?.negotiation ? ({ 'safe-passage': 'The crossing was negotiated as a safe-passage agreement: its test was whether people arrived alive.', grain: 'Grain bought cooperation at the crossing; the agreement reminded later governors that peace also consumes supplies.', hostages: 'Hostage terms secured the crossing under a threat whose memory survived the agreement.' }[state.negotiation] || `The crossing record preserves the terms: ${state.negotiation}.`) : 'The crossing agreement remains part of the service record.'} ${state?.allocation ? `The provincial relief roll records ${state.allocation.river} convoys for the river, ${state.allocation.farms} for farms, and ${state.allocation.town} for the town. Each recipient remembers that balance.` : ''} ${state?.judgment ? `The entered judgment established ${state.judgment === 'shared' ? 'shared tenure' : 'settler priority'}; the tribunal’s decision remains a precedent.` : ''}` },
    { title: 'The ledger at accession', text: obligations.length ? obligations.join(' ') : 'No private promises remain in the ledger. Public obligations—to soldiers, provinces, and the state—are only beginning.' },
    { title: 'The character of the reign', text: `${decisions.ch12 === 'honour' ? 'This reign begins by treating victory as an obligation to the defeated as well as the loyal.' : 'This reign begins by treating unquestioned command as the remedy for repeated civil war.'} Its durability is not foretold. The campaign ends at accession, with one last image: a line of soldiers lowering their voices after the oath, waiting to learn what the man who once spoke it will ask of them.` },
  ];
}

const HISTORICAL_SOURCES = {
  'History and the point of divergence': 'https://roman-emperors.sites.luc.edu/aurelian.htm',
  'The oath is original writing': 'https://www.thelatinlibrary.com/vegetius2.html',
  'The lead identity seal': 'https://eprints.nottingham.ac.uk/59935/1/MWUK%20A%20Language%20of%20Loyalty%20Oaths%20and%20their%20roles%20in%20Late%20Antiquity.pdf',
  'Abritus and the plague': 'https://roman-emperors.sites.luc.edu/decius.htm',
  'The Euphrates fortress': 'https://duraeuropos.artgallery.yale.edu/',
  'Valerian and professional commanders': 'https://roman-emperors.sites.luc.edu/gallval.htm',
  'Acting office and dux': 'https://roman-emperors.sites.luc.edu/aurelian.htm',
  'Withdrawal from Dacia': 'https://www.livius.org/sources/content/eutropius-short-history/eutropius-short-history-9/',
  'Aurelian’s campaigns': 'https://roman-emperors.sites.luc.edu/aurelian.htm',
  'The governorship and the Senate': 'https://dagr.univ-tlse2.fr/consulter/75/ADLECTIO/texte',
  'Civil-war endings': 'https://roman-emperors.sites.luc.edu/aemaem.htm',
  'Third-century equipment and scale': 'https://www.getty.edu/publications/mummyportraits/part-two/16/',
};

export const HISTORICAL_NOTES = [
  { title: 'History and the point of divergence', text: 'The protagonist and recurring cast are fictional. Major public events through Aurelian’s assassination in autumn 275 remain historical anchors. The imperial succession then diverges: the protagonist takes the purple instead of following the historical succession of Tacitus, Florian, and Probus. Individual battles, dialogues, local appointments, and the confrontation are authored fiction.' },
  { title: 'A composite career, not the standard ladder', text: 'Recruit, legionary, immunis, optio, centurion, and primus pilus draw on Roman military service. The later equestrian command, governorship, consular-rank adlection, and accession combine several possible career patterns into one exceptional life. Promotions and travel are compressed. Immunis is a privileged specialist status, not a universal rung every soldier had to pass.' },
  { title: 'The oath is original writing', text: 'The oath in this game is an original text inspired by ancient descriptions of obedience, fidelity to the standards, and readiness to die for the state. Vegetius II.5 is a later source whose surviving formula includes Christian language; it is not evidence for quoting that formula in AD 250. The word “lawful” is a deliberate dramatic qualification, not evidence for an ancient legal exemption. Exactly the same authored text appears at recruitment and accession.' },
  { title: 'The lead identity seal', text: 'The recruit’s lead signaculum is a reconstruction. A lead military sign associated with the recruit appears in the account of Maximilian dated AD 295; its form and precise use are debated. Placing a wearable identity seal in AD 250, and retaining the same object through the career, serves the narrative rather than claiming an established uniform practice.' },
  { title: 'Abritus and the plague', text: 'Decius died fighting the Goths at Abritus in 251. The marsh patrol takes place after the disaster and is fictional. The epidemic conventionally called the Plague of Cyprian afflicted the empire in the mid-third century; its pathogen and some aspects of its chronology remain debated. The game does not diagnose it or claim the soldiers’ cloths were effective medicine.' },
  { title: 'The Euphrates fortress', text: 'Chapter Five’s fortress is fictional and inspired by the siege archaeology of Dura-Europos, commonly dated to about 256. Its evacuation and survival window do not rewrite Dura’s destruction. Persian mining, Roman countermining, armour, and the siege environment are used as broad setting evidence, not a reconstruction of a particular documented century.' },
  { title: 'Valerian and professional commanders', text: 'Valerian was captured by Shapur I in 260 after the Roman defeat near Edessa. Ancient accounts of the circumstances differ. Gallienus’s preference for equestrian professional military commanders is reflected in the career shift; a single comprehensive edict excluding every senator at one moment is too certain a description of a debated process.' },
  { title: 'Equestrian standing and legion command', text: 'Service as primus pilus commonly opened equestrian opportunities, but the relationship among wealth, status, appointment, and chronology was not an automatic modern promotion system. The gold ring and prefecture are a compressed, sponsored transition in this fictional career.' },
  { title: 'Acting office and dux', text: 'Acting appointments, expressed by agens vice (“acting in place of”), provide a precedent for provisional senior responsibilities. The game’s acting campaign command is an authored appointment. Dux meant a leader or commander and covered varied regional and expeditionary commands; “highest military command” describes this game’s ladder, not one fixed third-century office.' },
  { title: 'Withdrawal from Dacia', text: 'Aurelian withdrew Roman administration and troops from Dacia north of the Danube and established a Dacia south of it. The exact chronology, stages, geographic extent, and civilian movement are debated. Chapter Eight compresses this process into a fictional evacuation campaign and uses local Gothic and Carpic representatives without treating either as one unified state.' },
  { title: 'Aurelian’s campaigns', text: 'The Palmyrene campaigns of 272 and the recovery of the Gallic territories in 274 form the background. Ancient accounts describe a Roman cavalry withdrawal that exhausted armoured opponents in heat; the playable operation is an inspired composite, not a claim that the protagonist commanded a recorded battle. The mercy decision concerns an invented city.' },
  { title: 'The governorship and the Senate', text: 'Praeses here is an equestrian provincial governor, with the specific governorship and its timing authored for the campaign. Senate admission by adlection was the emperor’s prerogative. The two Contests dramatize gathering backing for an imperial grant; the Senate does not independently confer membership by ordinary election. Adlectio inter consulares grants consular standing without inventing a previously held consulship.' },
  { title: 'Civil-war endings', text: 'Third-century armies could abandon or kill claimants, as in the cases of Aemilian in 253 and Florian in 276. These precedents inform surrender, defection, and standoff mechanics. The meters, fixed deadlines, surviving cast, minimum army, and always-available backer are explicit game systems rather than measurable ancient institutions.' },
  { title: 'Third-century equipment and scale', text: 'Mail or scale, long-sleeved tunics, trousers, cloaks, oval shields, spathae, spears, and javelins guide the visual language. Equipment varied by unit, region, date, and evidence. Oval shields are the visual default, not a claim that rectangular scuta disappeared: a mid-third-century example survives from Dura-Europos. The tokens progressively abstract individual soldiers, squads, and larger formations to keep the battle readable; unit counts and command budgets are not literal orders of battle.' },
].map(note => HISTORICAL_SOURCES[note.title] ? { ...note, url: HISTORICAL_SOURCES[note.title] } : note);
