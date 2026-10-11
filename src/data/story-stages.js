import {CHAPTERS, OATH, sceneLines} from './campaign.js';

const line = (speaker, text) => ({speaker, text});
const companion = state => state.decisions?.ch2 === 'leave' ? 'Sabinus' : 'Lucan';

// Briefings are tied to the next encounter, rather than replaying the chapter's
// arrival whenever the player returns to camp. The original arrival and final
// scenes remain the long-form chronicle; these passages connect deeds to them.
const BRIEFINGS = {
  'ch1-training': ['Varro', 'Come into the yard. First move to the marked ground; then let the practice partner teach you what an unguarded flank feels like. We will take one lesson at a time. You have not sworn yet. Earn enough confidence to understand what you are promising.'],
  'ch1-road': ['Varro', 'A cart is burning on the boundary road. Stay near your companion, watch the raiders before closing, and keep a clear way back to the gate. This time the enemy will not stop because I lower my hand.'],
  'ch2-marsh': ['Narrator', 'The causeway lies beyond the reeds. Your rescue order now determines whom the patrol must reach and how much ground it must cover. Look at the casualty and the rally marker before spending your first movement.'],
  'ch2-rearguard': ['Varro', 'The causeway is behind us. Men are still following our torches through the marsh. Hold this patch of firm ground while they arrive; a retreat is not finished when its first survivors are safe.'],
  'ch3-station': ['Crispus', 'The chest was last seen in the silent station. Find the concealed approach before we commit to the road. I have given the clerk your undertaking about the report; now we must recover something worth reporting.'],
  'ch3-rolls': ['Narrator', 'The recovered names travel in a clerk’s oilskin bundle. Raiders are moving between the station and the legion. Escort the records through their line: finding a name was only half the work of keeping it.'],
  'ch4-gate': ['Varro', 'You have one order to give each turn. Use it where another squad can do something your own shield cannot. Your decision about the outwork is already being carried along the wall; the main gate still needs you.'],
  'ch4-wall': ['Narrator', 'Smoke hides the wall walk. The surviving squads must reach the inner position before the passage closes. The men now watch whether your orders leave them a route home, not whether headquarters will like your report.'],
  'ch5-mine': ['Severianus', 'The cracked tower controls both the miners’ approach and the river stairs. Put your formations where your chosen priority needs them. A formation is a promise that no man will find himself guarding an empty place.'],
  'ch5-wall': ['Narrator', 'The tower has bought a window, not a victory over the whole siege. Hold the red river gate while the remaining people and stores pass behind it. The fortress has become a queue measured in shields.'],
  'ch6-wells': ['Narrator', 'The imperial wells are lost. Your order now sets the withdrawal: Varro must be brought west if you chose to save him; obedience puts the eagle’s passage before the wagon that could have carried him. Rally the nearest men before opening the route.'],
  'ch6-eagle': ['Narrator', 'The eagle has reached the last line of abandoned carts. Persian riders follow the road you have opened. Its bearer must cross with you; neither a remembered lesson nor a written excuse can carry the standard alone.'],
  'ch7-council': ['Severianus', 'The officers are assembled. They know which answer you sent concerning Milan. Win their support for the course you have chosen, and remember that a council can wound a command without drawing a blade.'],
  'ch7-legion': ['Narrator', 'The council’s decision reaches the waiting cohorts. Prepare them, deploy the forward units, and prove that the men who trusted your argument can trust your command in the field.'],
  'ch8-parley': ['Aelia', 'We have spoken of who crosses first. Now make the agreement that will let anyone cross. The families are watching the envoys; the envoys are watching the soldiers. Give them a reason to keep their hands off their weapons.'],
  'ch8-ferry': ['Narrator', 'The ferrymen begin work under the agreed terms. Your priority now changes the column that must be protected: scattered households if families go first, or an organised column behind the soldiers’ foothold. Keep the promised people in view.'],
  'ch8-crossing': ['Aelia', 'The first boats are across. The last carry the people who own least and can run least. Keep the landing open until their feet touch the bank. A promise about a crossing has two shores.'],
  'ch9-wing': ['Narrator', 'Aurelian’s main army is moving. Your task is one wing of his campaign. Choose the stratagem before the cavalry closes, then let the cohorts do the work your earlier commands taught them to do.'],
  'ch9-city': ['Narrator', 'A second force bars the road into the surrendered settlement. The terms you announced will be read at its gate. Secure that road so the promise of mercy—or the order of confiscation—can become something more than a distant commander’s words.'],
  'ch10-road': ['Aelia', 'The convoy totals are written where everyone can see them. The river soldiers, farming villages, and town have made their own preparations from what you sent. Now protect the grain road on which those arrangements depend.'],
  'ch10-tribunal': ['Narrator', 'The grain has passed; the claimants have arrived. Your allocation and entered land judgment shape the delegates who take their seats. Show the chamber the settlement you actually made, not the one an easy speech might have promised.'],
  'ch11-accounts': ['Paullus', 'The province’s witnesses are here. Explain the relief accounts, invoke the service that brought you to office, and answer the households that paid for your decisions. A title is being considered; an account is being tested.'],
  'ch11-adlection': ['Crispus', 'The accounts have survived their committee. The petition still needs the wider chamber. I have objections that a committee’s arithmetic cannot settle. You may answer me, or show Rome why it should cease listening to me.'],
  'ch12-legitimacy': ['Paullus', 'Your terms have been declared. Put your claim before the chamber, then. The people who support it will have to live beneath it; so will the people who do not.'],
  'ch12-confrontation': ['Narrator', 'The decree has supporters. The road still has armies. Read who has come, who has stayed away, and what your chosen approach will require. These formations carry the accumulated weight of your service into the final confrontation.'],
};

const AFTER = {
  'ch1-training': 'The practice partner lowers his shield. Varro checks the marks in the sand, then waves the clerk over. You know enough now to recognise the distance between repeating an oath and keeping it.',
  'ch1-road': 'The cart’s surviving driver can take the road again. Your first field assignment ends with smoke in your tunic and another soldier walking beside you.',
  'ch2-marsh': 'The patrol reaches the rally ground. Reeds conceal the road behind it, but the survivors can finally stop looking over both shoulders at once.',
  'ch2-rearguard': 'The last torch comes out of the reeds. Varro counts the people at the rally ground before asking who deserves credit for holding it.',
  'ch3-station': 'The chest is open, the rolls are dry, and the concealed trail is marked. Crispus has to report a real discovery now; your earlier undertaking gives him its wording.',
  'ch3-rolls': 'The clerk takes the bundle with both hands. A widow who never saw this road will be able to prove a name because someone carried its record home.',
  'ch4-gate': 'The broken drum falls silent. The gate remains in Roman hands, but messengers from the outwork carry the cost of your order into the courtyard.',
  'ch4-wall': 'The withdrawal reaches the inner wall. The wooden staff you carried as an optio has become familiar enough that men look for it when the smoke hides your face.',
  'ch5-mine': 'The tower approach is secured for the moment. Above the miners’ abandoned tools, the river stairs fill with people following the priority you set.',
  'ch5-wall': 'The river gate closes behind the last protected movement. This small success does not undo the disasters of the eastern war; it gives these survivors a road beyond them.',
  'ch6-wells': 'The dry wells disappear behind the column. Your departure has made the authentic return order impossible to obey again. The people who crossed with you will be its living answer.',
  'ch6-eagle': 'The bearer plants the eagle beyond the pursuit. Men touch the shortened pole as they pass, checking that both the symbol and the hands carrying it survived.',
  'ch7-council': 'The officers leave the council with an agreed course. Some have given their word gladly, others because they can see no safer road; all can now ask whether you will keep yours.',
  'ch7-legion': 'The cohorts return beneath standards you placed. The officers’ council is no longer merely an argument: its decision has carried men through a field.',
  'ch8-parley': 'The agreement is spoken before witnesses on both banks. Aelia begins reading household names to the ferrymen. Terms that sounded tidy in council acquire tired faces at the water.',
  'ch8-ferry': 'The protected column reaches the far bank. Empty boats return for those still waiting, and the soldiers turn their shields toward the exposed landing.',
  'ch8-crossing': 'The landing remains open through the final crossing. Aelia folds the household roll against the damp. Its next column must concern farms, not boats.',
  'ch9-wing': 'Your wing has done its part in Aurelian’s victory. The main dispatch will name the emperor first, but the returning cohorts know which orders carried them through their own ground.',
  'ch9-city': 'The road to the settlement is secured. The gatekeepers hear the terms you chose from a commander who now has the strength to enforce them.',
  'ch10-road': 'The road is open and the guarded grain reaches its recipients. People can compare the convoy totals with what actually arrived. Your administration has acquired witnesses.',
  'ch10-tribunal': 'The tribunal backs the entered judgment. The clerk posts copies at the market, where each community reads both what it has gained and what it must accept.',
  'ch11-accounts': 'The committee certifies that the accounts can support a petition. It has not admitted you to the Senate. The wider chamber awaits, and Crispus has saved his sharpest objection for it.',
  'ch11-adlection': 'The petition has the chamber’s backing. Only now is the emperor’s grant brought forward. The broad stripe is laid out beside the narrow one you wore into Rome.',
  'ch12-legitimacy': 'The chamber has backed your legitimacy. Its decree leaves room for the names of the men who will enforce it; those men are assembling beyond the city.',
  'ch12-confrontation': 'The rival’s armed resistance is resolved. The soldiers can at last hear the words travelling along their own line, and those words are your name.',
};

const CONSEQUENCES = {
  ch1: {report: ['Varro', 'The report will be accurate. Lucan has heard you give it in public; you will have to earn back the ease that stood between you before it.'], cover: ['Lucan', 'Half the cost next payday. I mean it. You need not carry my mistakes alone merely because you stood beside this one.']},
  ch2: {carry: ['Narrator', 'The patrol will reach Lucan deeper in the marsh, release him, and protect the longer evacuation. The supplies have been committed to bringing him out.'], leave: ['Narrator', 'You order the mobile survivors toward the accessible rally route. Lucan will not be among them. A wounded survivor still needs your protection; Sabinus will carry Lucan’s name on the roll.']},
  ch3: {claim: ['Crispus', 'Your name, then. I will not erase it. Do not expect me to forget the moment you asked me to write it.'], share: ['Crispus', 'I will present the recovery, with your discovery acknowledged in my own hand. Keep the copy. If I am to learn anything here, let it include the value of that courtesy.']},
  ch4: {withdraw: ['Narrator', 'The postern is opened for the outwork’s defenders. Grain stays behind; trained men begin making their way toward the force you can still protect.'], hold: ['Narrator', 'The outwork receives the order to remain. Its stores will support the fort, but the men watching the gate now know what headquarters’ approval can cost.']},
  ch5: {civilians: ['Narrator', 'Severianus sends the transport train to the river stairs. Families take priority, and his quartermaster enters the veterans’ future requisition beside your name.'], countermine: ['Narrator', 'Your strongest squads receive the miners’ tools. The wall and stores take priority; families at the river stairs must wait for the route you have postponed.']},
  ch6: {save: ['Narrator', 'Varro is placed where your withdrawal can reach him. Turning west gives him a chance to leave with the legion, but his wagon must be protected through the extraction.'], obey: ['Narrator', 'Varro takes the rear guard named in the return order. The eagle’s passage will be your objective. The order preserves obedience in the record and closes his route home.']},
  ch7: {warn: ['Narrator', 'Your warning rides toward Milan. The legion’s officers must decide how to stand behind a commander who refused to keep that silence.'], refuse: ['Narrator', 'The answer keeps your legion outside the plot. Officers who wanted certainty now have to support a course built on restraint.'], join: ['Severianus', 'The word has been given. So has the protection you promised. The officers will expect both to mean something after the city’s gates change hands.']},
  ch8: {families: ['Aelia', 'The households go first. That means scattered people, carts, and children must reach the boats before the soldiers have finished securing the bank. I will keep the promised farms on the same roll.'], soldiers: ['Narrator', 'The soldiers go first to secure a shorter, protected crossing. The families wait under guard; the ferrymen enter the wages you promised the veterans.']},
  ch9: {mercy: ['Narrator', 'Your terms promise that surrender will protect homes. Merchants carry the wording ahead of the advancing army; its truth must survive the moment the gates open.'], severity: ['Narrator', 'Confiscation orders go ahead of the troops. The army will receive stores, and households will learn what your definition of order permits it to take.']},
  ch10: {shared: ['Aelia', 'My people gain a harvest share, not every field they asked for. I will defend that compromise before them if you defend the neighbours’ rights before the chamber.'], settlers: ['Narrator', 'The displaced receive first title. Established tenants begin preparing petitions against the loss; the veterans who brought the families south promise to speak for the grant.']},
  ch11: {independent: ['Severianus', 'Then let your own record carry the petition. I will not pretend independence costs nothing merely because I respect the decision.'], patron: ['Severianus', 'My friends have your name. My nephew’s appointment has yours. Neither undertaking will be lost when a new title is written above it.']},
  ch12: {honour: ['Narrator', 'Remaining promises are settled at their recorded costs. Surrendered rivals hear that their lives will be protected, and creditors can now measure your mercy against what you paid.'], release: ['Narrator', 'Remaining promises are repudiated and their penalties recorded. Confiscation accompanies the demand for submission; the armies hear the strength of it, the towns the threat.']},
};

export function storyStageKey(state) {
  const chapter = CHAPTERS[state.chapter - 1];
  if (state.phase === 'promotion' || state.phase === 'epilogue') return `ch${state.chapter}:${state.phase}`;
  if (state.chapter === 1 && state.encounterIndex === 1) return `ch1:${state.oath ? 'oath-sworn' : 'oath-ready'}`;
  if (!state.decisions?.[chapter.decision.id] && state.encounterIndex === 0) return `ch${state.chapter}:arrival`;
  return `ch${state.chapter}:briefing:${state.encounterIndex}`;
}

function report(state, record) {
  if (!record) return [];
  const lines = [line('Narrator', AFTER[record.id] || 'The completed undertaking is entered in the chronicle.')];
  if (record.kind === 'battle' && record.id !== 'ch1-training') {
    const withdrawn = (record.veterans || []).filter(veteran => veteran.withdrawn).map(veteran => veteran.name);
    lines.push(line('Narrator', record.losses
      ? `${record.losses} allied ${record.losses === 1 ? 'formation withdrew' : 'formations withdrew'} before the position was secured.${withdrawn.length ? ` The recovery roll names ${withdrawn.join(', ')}.` : ''} Their service is recorded; their injuries do not erase their place in your company.`
      : 'Every allied formation returned from this engagement. The company’s commendations record that safe return beside the victory.'));
  }
  if (record.id === 'ch2-marsh') lines.push(state.decisions.ch2 === 'carry'
    ? line('Lucan', 'I thought every step would be the one at which you put me down. I know what you carried now. When I can stand, I will find something of yours to carry.')
    : line('Sabinus', 'I wrote the letter before I slept. I have left room for you to add something if you can. Lucan’s mother ought to hear a human voice in it.'));
  if (record.id === 'ch6-wells') lines.push(state.decisions.ch6 === 'save'
    ? line('Varro', 'You have made the clerk’s task difficult and mine longer. I had intended to be done giving you advice. It appears that I shall have to endure you a little further.')
    : line('Narrator', 'The returning orderlies bring Varro’s vine stick. You set your thumb in the place his hand has polished and ask for the eagle’s position before anyone can ask about your face.'));
  if (record.id === 'ch10-road') lines.push(line('Aelia', 'The villages have counted the arriving grain. Bring that count to the tribunal. A speech about relief should begin with people who have received it.'));
  return lines;
}

export function stagedStoryLines(state) {
  const chapter = CHAPTERS[state.chapter - 1];
  const key = storyStageKey(state);
  if (state.phase === 'promotion' || state.phase === 'epilogue') {
    const last = state.history?.filter(record => record.chapter === state.chapter).at(-1);
    if (state.chapter === 12 && state.phase === 'promotion') return [
      ...report(state, last),
      line('Narrator', 'The field and the chamber have yielded. The purple is ready, but the army waits for you to receive its oath. Beneath the senatorial stripe, you find the worn lead seal with your thumb. There is one last appointment to accept.'),
    ];
    return [...report(state, last), ...sceneLines(chapter, 'aftermath', state)];
  }
  if (key.endsWith(':arrival')) return sceneLines(chapter, 'intro', state);
  const next = chapter.encounters[state.encounterIndex];
  const previous = state.history?.filter(record => record.chapter === state.chapter).at(-1);
  if (key === 'ch1:oath-ready') return [
    ...report(state, previous),
    line('Varro', 'The exercise is complete. The clerk is ready to enter your name. When you choose to swear, listen to the words as a duty that begins today, not a test you have already passed.'),
  ];
  if (key === 'ch1:oath-sworn') return [
    line('The recruit · the original oath', OATH),
    line('Narrator', 'Only now does the clerk enter the oath and place the cord with its stamped lead seal around your neck. You press it between finger and thumb. Beyond the gate, a mule cart burns on the boundary road.'),
    line(...BRIEFINGS['ch1-road']),
  ];
  const decision = state.decisions?.[chapter.decision.id];
  const consequence = state.encounterIndex === 0 ? CONSEQUENCES[chapter.decision.id]?.[decision] : null;
  const lines = [...report(state, previous)];
  if (consequence) lines.push(line(...consequence));
  if (next) lines.push(line(...BRIEFINGS[next.id]));
  if (state.encounterIndex > 0 && state.chapter === 3) lines.push(line(companion(state), 'The clerk knows what happened at the station. Let us bring him back to say it where the rest of the army can hear.'));
  return lines.map(item => ({...item, text: item.text.replaceAll('Aurelius Marcellus', state.name || 'Aurelius Marcellus')}));
}
