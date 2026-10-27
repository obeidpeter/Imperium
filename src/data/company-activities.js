// Original camp situations. Evidence and completion use the existing chronicle
// flags; walking is optional and the service panel offers the identical replies.
export const activityId=chapter=>`company-activity:${chapter}`;
export const activityFlag=(chapter,step)=>`${activityId(chapter)}:${step}`;
export const COMPANY_ACTIVITIES=Object.freeze([
  {chapter:5,title:'Find the right boat',intro:'Help the shelter steward carry one verified message. Check the household list and the boat manifest, then match them at the shelter. Your clerk’s other assignment remains unchanged.',
    steps:[{key:'household',label:'Read the household list',place:'barracks',at:[-3.5,1.5],name:'Household list',text:'Tertia’s household waits under the blue awning. Their boat carried a fig-tree stamp; its number was rubbed away.'},
      {key:'manifest',label:'Check the boat manifest',place:'quartermaster',at:[-3,1.5],name:'Boat manifest',text:'The manifest lists boat III with a fish stamp, boat VI with a fig tree, and boat IX with a sheaf of grain.'},
      {key:'deliver',label:'Deliver the message at the shelter',place:'canabae',at:[-1.5,-2],name:'Shelter message desk',text:'The steward will send a runner only when the household and boat marks agree.'}],
    answers:['Boat III, marked with a fish.','Boat VI, marked with a fig tree.','Boat IX, marked with grain.'],correct:1,
    wrong:'That stamp does not match the household list. No runner has left. Compare the two records and try again.',
    result:'The steward joins the household clerk with the verified message. Tertia’s family knows which boat to seek. The military evacuation order and the company clerk’s assignment still stand.',
    completedName:'Verified shelter message',actor:'evacuation-officer',reunion:'barracks',reunionAt:[0,2.8]},
  {chapter:8,title:'Return the ferry token',intro:'The ferryman asks you to verify a loose pay token before it travels. Inspect the token and the receipt, then seal the correct delivery. This does not change the messenger’s priority in the company story.',
    steps:[{key:'token',label:'Inspect the recovered token',place:'canabae',at:[-1.5,-1.5],name:'Recovered ferry token',text:'The bronze token is punched with the letters M • R and a crescent. There is no name written on the bundle.'},
      {key:'receipt',label:'Read the payment receipts',place:'quartermaster',at:[0,3],name:'Payment receipts',text:'Marcus Rufus signed beside a crescent. Marcius Regulus used a wheel, and Marius Romanus used an anchor.'},
      {key:'deliver',label:'Seal the delivery at the company roll',place:'barracks',at:[-1.5,3],name:'Token delivery tray',text:'All three men share the initials. Match the personal mark before sealing the delivery.'}],
    answers:['Seal it for Marcius Regulus, the wheel.','Seal it for Marius Romanus, the anchor.','Seal it for Marcus Rufus, the crescent.'],correct:2,
    wrong:'The initials agree, but the personal mark does not. The token stays in the tray; no one loses his pay. Inspect both records again.',
    result:'The supply orderly takes the sealed token to the ferry desk. Its receipt names Marcus Rufus and his crescent mark; the company’s chosen delivery priority remains in force.',
    completedName:'Sealed token and receipt',actor:'porter',reunion:'canabae',reunionAt:[0,2.8]},
  {chapter:11,title:'Check the witness record',intro:'Before choosing how to present the veteran’s statement, compare the rough page with the staff copy. Ask the witness which detail must remain available to later readers.',
    steps:[{key:'original',label:'Inspect the rough statement',place:'barracks',at:[-3.5,1.5],name:'Veteran’s rough statement',text:'The veteran wrote: “I passed on the first watch signal wrongly. The commander stopped us and asked me to repeat it.” A correction is visible in the margin.'},
      {key:'copy',label:'Compare the staff copy',place:'principia',at:[2.5,1.5],name:'Staff copy',text:'The staff copy says: “The commander confirmed the watch signal.” It preserves the action but leaves out the witness’s mistake and correction.'},
      {key:'deliver',label:'Check the correction with the witness',place:'canabae',at:[-1.5,-2],name:'Witness interview desk',text:'The witness asks which difference you found between the two pages.'}],
    answers:['The first signal was wrong and had to be repeated.','The commander cancelled the watch.','The staff copy names a different commander.'],correct:0,
    wrong:'Neither page supports that account. Nothing is filed. Read the two pages again before attaching a correction.',
    result:'The clerk places a comparison slip beside the original. Readers can locate the admitted mistake whichever presentation you choose for the Senate. The witness’s words remain his own.',
    completedName:'Original with comparison slip',actor:'clerk',reunion:'barracks',reunionAt:[0,2.8]}
].map(a=>Object.freeze({...a,steps:Object.freeze(a.steps.map((s,i)=>Object.freeze({...s,id:`${activityId(a.chapter)}:${i}`})))})));
export const companyActivityFor=chapter=>COMPANY_ACTIVITIES.find(a=>a.chapter===chapter)??null;
export const activityObjects=chapter=>(companyActivityFor(chapter)?.steps??[]).map(s=>({id:s.id,kind:'table',name:s.name,place:s.place,at:s.at,talk:s.id}));
const option=(text,next=null,conditions={},effects={},news=false)=>({text,next,conditions,effects,once:false,news});
const node=(speaker,text,options,conditions={})=>({speaker,text,options,conditions});
export const COMPANY_ACTIVITY_DIALOGUE=Object.freeze(Object.fromEntries(COMPANY_ACTIVITIES.flatMap(a=>{
  const id=activityId(a.chapter),start=activityFlag(a.chapter,'started'),done=activityFlag(a.chapter,'done'),chapter={min:a.chapter,max:a.chapter};
  const open={chapter,flag:start,notFlag:done},evidence=a.steps.slice(0,2).map(s=>({flag:activityFlag(a.chapter,s.key)}));
  const complete={...open,all:evidence};
  const intro={start:'greet',conditions:{chapter:{min:a.chapter}},nodes:{
    greet:node('The company record',a.intro,[option('I will check it myself.','accepted',{chapter,notFlag:start},{flags:[start]},true),
      option('Review where to go.','accepted',{chapter,flag:start,notFlag:done}),option('Read what followed.','finished',{flag:done}),option('Leave it for now.')]),
    accepted:node('The company record',`${a.steps.map(s=>s.label).join('; ')}. These are marked desks in camp, also available under Company stories. You may leave the chapter without finishing.`,[option('Return to camp.')],open),
    finished:node('The company record',a.result,[option('Return to camp.')],{flag:done})}};
  const stations=a.steps.map((s,i)=>{
    const clue=activityFlag(a.chapter,s.key),last=i===2;
    return [s.id,{start:'greet',conditions:{chapter},nodes:{
      greet:node(s.name,last?s.text:'Examine this record, then keep the detail you need.',[
        option('Start this optional company task from the company record first.','not-started',{notFlag:start}),
        ...(!last?[option('Examine and remember the mark.','evidence',open,{flags:[clue]},true)]:[
          option('Compare the records.','compare',complete,{},true),
          option('I still need both pieces of evidence.','missing',{...open,any:evidence.map(c=>({notFlag:c.flag}))})]),
        option('Read the completed record.','finished',{flag:done}),option('Leave the desk.')]),
      'not-started':node('The company record','Open Company stories to take this optional task. It creates no departure requirement.',[option('Return to camp.')]),
      evidence:node(s.name,s.text,[option('Keep looking around camp.')],{flag:clue}),
      missing:node(s.name,'Check both records first. Their marks are available again at each desk and in Company stories.',[option('Return to camp.')],open),
      compare:node(a.chapter===11?'The veteran witness':s.name,s.text,a.answers.map((answer,index)=>option(answer,index===a.correct?'finished':'wrong',complete,index===a.correct?{flags:[done]}:{})),complete),
      wrong:node(s.name,a.wrong,[option('Compare again.','compare',complete),option('Return to camp.')],complete),
      finished:node('The company record',a.result,[option('Return to camp.')],{flag:done})}}];
  });
  // The witness is the survivor of the authored Chapter II choice. No new
  // speech is attributed to the companion who died.
  if(a.chapter===11){const compare=stations[2][1].nodes.compare;compare.variants=[
    {conditions:{decision:{ch2:'carry'}},speaker:'Aurelius Lucan',text:'Which difference did you find? I want the mistake kept where a reader can see how we corrected it.'},
    {conditions:{decision:{ch2:'leave'}},speaker:'Gaius Sabinus',text:'Which difference did you find? Lucan is not here to correct our record. Let us keep the correction made by those who are.'}];}
  return [[id,intro],...stations];
})));
