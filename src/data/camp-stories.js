import {companyActivityFor,activityFlag} from './company-activities.js';
// Original optional company stories. Small, previewed changes use the existing
// dialogue transaction and errand records; no story changes a companion's fate.
const freeze=value=>Object.freeze(value);
const choice=(id,label,meters,report,later)=>freeze({id,label,meters:freeze(meters),report,later});
export const CAMP_STORIES=freeze([
  {chapter:4,title:'The second watch',opening:'A new sentry admits he cannot hear the cracked alarm drum from the ford. The veterans can pair with the recruits, or mend the village bell and teach its signal to everyone. There is time for one task before departure.',
    lucan:'I remember being the recruit who pretended to understand. Ask him to repeat the signal, not to repeat an oath.',sabinus:'A watch roll proves a man was posted. It does not prove anyone could hear him ask for help.',
    choices:[choice('pairs','Pair the recruits with veteran sentries.',{army:2,public:-1},'The returning watch gives the alarm correctly. The village still relies on the old bell; its steward says the army looked after its own first.','The paired-watch drill is copied into the company roll. Recruits still name the veterans who learned their voices.'),
      choice('bell','Repair the village bell and teach a shared alarm.',{public:2,army:-1},'A ferryman recognises the new signal and brings the last patrol in. The veterans resent the hours spent teaching civilians instead of resting.','The ford sends a small bell-clapper with its thanks. The company keeps it beside the names of the first civilian watch.') ]},
  {chapter:5,title:'Names in the shade',opening:'At the evacuation shelter a child has lost the name of her family’s boat. Aper can spare one clerk: either reunite the household lists or make a second roll of the fortress crews. This does not change your military evacuation order.',
    lucan:'Someone once carried me when I could not give a useful answer. A name on a tablet can be another sort of hand.',sabinus:'Lucan should have answered the roll himself. Let us give the people who can still answer the chance.',
    choices:[choice('households','Assign the clerk to the separated households.',{public:2,army:-1},'The child’s aunt finds her by the copied household name. Two fortress crews wait longer for their pay entries to be checked.','A folded household list follows the baggage. Its corner bears a child’s drawing of the shelter gate.'),
      choice('crews','Make the fortress crews’ duplicate roll.',{army:2,public:-1},'Every returning crew can prove its service and pay. The shelter officer has had to find the separated households without the clerk.','The duplicate crew roll survives a soaking in the baggage. The quartermaster now copies every damaged service entry from it.') ]},
  {chapter:6,title:'What the baggage carries',opening:'The retreat baggage contains an old drill tablet and a packet of unsent letters. The remaining courier can carry the families’ letters or preserve the veterans’ written lessons for the new recruits.',
    lucan:'There is a mill in my letters. In the reports I am only a shield. Both are true; only one tells my mother why I am still walking.',sabinus:'A name in a report tells us who is missing. A letter tells someone at home that we remembered to look.',
    choices:[choice('letters','Give the courier the families’ letters.',{public:2,army:-1},'The courier’s receipt comes back with flour on it. The drill tablet stays in the baggage; the instructors must teach from memory.','Replies from home are read beside the cookfires. One bears the same miller’s mark as the oldest letter in the company packet.'),
      choice('lessons','Preserve the veterans’ drill lessons.',{army:2,public:-1},'A recruit traces the old shield diagram with his finger and finally understands it. The household letters await another courier.','The copied lessons have acquired corrections in three different hands. Their value is in being taught, not in being kept untouched.') ]},
  {chapter:7,title:'A voice below the officers',opening:'A junior standard-bearer has found an error in the council’s march tally. The correction can be heard before the assembled officers or sent privately to the staff clerk. The disputed deployment still needs your own vote.',
    lucan:'He practised the sentence with me six times. He is not afraid of arithmetic. He is afraid of who has already signed it.',sabinus:'If we keep a roll of names, we should be able to hear one spoken by its owner.',
    choices:[choice('hearing','Let the standard-bearer explain the error openly.',{army:2,political:-1},'The corrected tally is read with the standard-bearer’s name. The ranks notice; a senior officer complains that a private correction would have spared him embarrassment.','You receive a cleaner council tally, signed by the same junior hand. The officers have begun asking the ranks to check their figures.'),
      choice('private','Send the correction privately through the staff.',{political:2,army:-1},'The staff corrects the tally without disrupting the hearing. The standard-bearer notices that his name does not appear on the final copy.','The staff’s later note credits your discretion. In the company roll, the standard-bearer’s original calculation is still preserved.') ]},
  {chapter:8,title:'The ferry token',opening:'A ferryman finds a veteran’s pay token in an unclaimed bundle. The veteran is alive and waiting on the other bank. A messenger can deliver it now, or first register the unclaimed civilian bundles so families can recover them.',
    lucan:'The token is a small thing until it is the only thing a tired man has left to prove he was paid.',sabinus:'The bundle tags matter too. I have seen a clerk call a missing name an empty place.',
    choices:[choice('token','Send the token to its veteran owner first.',{army:2,public:-1},'The veteran sends back a receipt and a joke about honest ferrymen. The civilian bundles take another watch to sort.','The veteran lends the returned token as a counting weight when the company checks its pay. He insists it come back every evening.'),
      choice('bundles','Register the civilian bundles before sending the token.',{public:2,army:-1},'Several households recover their bedding by the new tags. The veteran receives his token late and asks why soldiers always wait after serving.','One of the recovered bundle tags is tied to the camp’s records. The ferry families have adopted the same simple marks.') ]},
  {chapter:9,title:'The surrendered workshop',opening:'A surrendered workshop contains repairs belonging to soldiers and townspeople. Aper can certify the military claims first or open the ledger for a joint count. Neither order permits plunder.',
    lucan:'A broken hinge means nothing on a campaign map. At home it means you cannot close the mill before rain.',sabinus:'Write down what changes hands. A victorious army can afford to leave an honest receipt.',
    choices:[choice('joint','Count the claims with the town’s craft workers.',{public:2,army:-1},'The joint ledger returns household tools to their owners. Soldiers grumble at the queue, then recognise their own repair marks when their turn comes.','A later repair arrives with both the craftsman’s seal and Aper’s tally. The workshop has kept the shared ledger.'),
      choice('military','Certify the military repairs first and issue receipts.',{army:2,public:-1},'The company’s shields are repaired promptly. The town keeps the receipts but says military order still means civilian waiting.','The quartermaster’s file contains every workshop receipt. Local petitioners quote those dates when asking when their own repairs will be done.') ]},
  {chapter:10,title:'The measure of grain',opening:'A storekeeper’s measure is worn short. There is no evidence he altered it deliberately. Your assistant can demonstrate a corrected measure at the relief queue or audit every storehouse quietly before announcing the result.',
    lucan:'My father kept his mill measure where anyone could see it. Trust was cheaper than arguing over every sack.',sabinus:'A clean account should survive being read aloud. It should also be right before we read it.',
    choices:[choice('public','Demonstrate the corrected measure in the relief queue.',{public:2,political:-1},'Households watch the first sack measured twice and accept the correction. The administrators dislike having their mistake made public.','The replacement measure remains on open display. Petitioners refer to it when asking for accounts they can understand.'),
      choice('audit','Complete a quiet audit before publishing corrections.',{political:2,public:-1},'The audit finds two other worn measures and corrects them together. While it runs, the relief queue has only the administration’s assurance.','The district clerks use your audit sheet for later stores. Families still ask why the first explanation took so long.') ]},
  {chapter:11,title:'The unpolished witness',opening:'The Senate’s clerks want a polished account of your service. A veteran has supplied a rough statement that includes an error you once admitted. You can enter his words intact or submit a concise staff summary alongside the original in the archive.',
    lucan:'Do not make me sound like a senator. They may believe the page, but you will no longer recognise the man who signed it.',sabinus:'Our record should survive someone asking to see the other copy.',
    choices:[choice('verbatim','Enter the veteran’s statement in his own words.',{army:2,political:-1},'The statement is awkward when read aloud, and unmistakably personal. Some senators object to its admitted mistake; the veterans recognise an honest witness.','The service archive keeps the rough statement at the front. Later readers can see the corrections without asking permission.'),
      choice('summary','Submit the staff summary and retain the original for inspection.',{political:2,army:-1},'The hearing follows the concise account readily. The veteran asks for written assurance that his original can still be requested.','The archive index names both versions. The polished account travels farther; the original remains available to anyone who questions it.') ]},
  {chapter:12,title:'A name beneath the titles',opening:'Before the legitimacy hearing, your attendants ask which personal record should lie with your papers: the company’s service roll or the petitions collected from households along the road. This gesture wins no throne and settles no unpaid pledge.',
    lucan:'I promised to make you carry a sack through the village. A larger title has not made that promise smaller.',sabinus:'Lucan should have been here to say something inconvenient. I will keep his place on the roll, and say something inconvenient myself.',
    choices:[choice('roll','Place the company’s service roll beside your papers.',{army:2,public:-1},'After the hearing, the veterans see their names still beside yours. The petitioners ask when their own pages will be read.','The first personal record in your later camp is the service roll. Its names remain a reminder that loyalty belongs to people, not an insignia.'),
      choice('petitions','Place the households’ petitions beside your papers.',{public:2,army:-1},'After the hearing, the petitions remain in view. Your veterans ask that the army’s sacrifices be remembered with equal care.','The household petitions remain with your personal papers. Their plain requests outlast the ceremonial language used around them.') ]}
].map(story=>freeze({...story,choices:freeze(story.choices)})));

export const campStoryId=chapter=>`company-story:${chapter}`;
export const campStoryFlag=(chapter,choiceId='chosen')=>`company-story:${chapter}:${choiceId}`;
export const campStoryFor=chapter=>CAMP_STORIES.find(s=>s.chapter===chapter)??null;
export const CAMP_STORY_ERRANDS=freeze(Object.fromEntries(CAMP_STORIES.map(story=>[campStoryId(story.chapter),freeze({id:campStoryId(story.chapter),chapter:story.chapter,
  giver:'The company record',title:story.title,summary:'Read the reply after completing an encounter. Earlier replies remain in Company stories at later camps.',reward:freeze({})})])));

const opt=(text,next=null,conditions={},effects={},news=true)=>freeze({text,next,conditions:freeze(conditions),effects:freeze(effects),once:false,news});
const node=(speaker,text,options,more={})=>freeze({speaker,text,options:freeze(options),...more});
export const CAMP_STORY_DIALOGUE=freeze(Object.fromEntries(CAMP_STORIES.map(story=>{
  const {chapter,choices}=story,id=campStoryId(chapter),chosen=campStoryFlag(chapter),after={any:[{chapter:{min:chapter+1}},{chapter:{min:chapter,max:chapter},encounterIndex:{min:1}}]};
  const activity=companyActivityFor(chapter),activityStarted=activityFlag(chapter,'started'),activityDone=activityFlag(chapter,'done');
  const recall=choices.map(c=>({conditions:{flag:campStoryFlag(chapter,c.id)},text:c.report}));
  return [id,freeze({start:'greet',conditions:freeze({chapter:{min:chapter}}),nodes:freeze({
    greet:node('The company record',story.opening,[
      opt('Read the company’s letter.','letter',{chapter:{max:chapter},notFlag:chosen}),
      ...(activity?[opt(`Help in camp: ${activity.title}.`,'activity',{chapter:{max:chapter},notFlag:activityStarted},{flags:[activityStarted]}),
        opt('Review the task in camp.','activity',{chapter:{max:chapter},flag:activityStarted,notFlag:activityDone},{},false),
        opt('Read the task’s completed record.','activity-finished',{flag:activityDone},{},false)]:[]),
      opt('Read the returning report.','report',{flag:chosen,errand:{[id]:'accepted'},...after}),
      opt('Read the filed report.','report',{flag:chosen,errand:{[id]:'done'},...after},{},false),
      opt('The reply has not arrived yet.','waiting',{flag:chosen,chapter:{max:chapter},encounterIndex:{max:0}},{},false),opt('Leave the record.')]),
    letter:node('The company clerk','The company asks you to choose which task should receive its attention.',[
      ...choices.map(c=>opt(c.label,'committed',{chapter:{max:chapter},notFlag:chosen},{meters:c.meters,flags:[chosen,campStoryFlag(chapter,c.id)],errand:{[id]:'accepted'}})),opt('Decide later.','greet')],
      {variants:freeze([{conditions:{decision:{ch2:'carry'}},speaker:'A letter from Aurelius Lucan',text:story.lucan},
        {conditions:{decision:{ch2:'leave'}},speaker:'A letter from Gaius Sabinus',text:story.sabinus}])}),
    committed:node('The company record','Your instruction is recorded. Return after an encounter to hear what followed. This is optional; it creates no departure requirement.',[opt('Return to camp.')]),
    waiting:node('The company record','The messenger has not returned. Continue the chapter, then read the report here or in Company stories at a later camp.',[opt('Return to camp.')]),
    report:node('The returning report','The company has kept a record of your instruction.',[
      opt('Enter the reply in the company record.','recorded',{flag:chosen,errand:{[id]:'accepted'},...after},{errand:{[id]:'done'}}),opt('Leave the report.')],
      {conditions:freeze({flag:chosen,...after}),paragraphs:freeze([...recall,
        ...(chapter===6?[{conditions:{decision:{ch6:'save'}},text:'Varro’s later letter adds a practical correction in the margin. He is alive to disagree with the way his lessons are remembered.'},
          {conditions:{decision:{ch6:'obey'}},text:'Varro died during the retreat. His vine stick lies with the papers; the clerk records his words as a memory, never as a new letter.'}]:[])])}),
    recorded:node('The company record','The reply is filed. You can read it in Company stories at every later camp.',[opt('Return to camp.')]),
    ...(activity?{activity:node('The company record',`${activity.intro} ${activity.steps.map(s=>s.label).join('; ')}.`,[opt('Return to camp.')],{conditions:{flag:activityStarted}}),
      'activity-finished':node('The company record',activity.result,[opt('Return to camp.')],{conditions:{flag:activityDone}})}:{})
  })})];
})));
