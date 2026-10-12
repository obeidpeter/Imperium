// Test-only adapters over the actual edition's pure animation timeline API.
export function actionScene(actionCase){
  return {id:`action-${actionCase.id}`,title:actionCase.title,chapter:actionCase.chapter,kind:'board',traceStep:actionCase.traceStep,state:actionCase.state,
    transition:{before:actionCase.before,after:actionCase.after,command:actionCase.command,traceStep:actionCase.traceStep}};
}
export function filmstripFrames(timeline,sample){
  // Fixed relative points compare the same action phases while retaining each
  // edition's actual duration. Before/after panels are separate static states.
  return [0,.2,.4,.6,.8,1].map(fraction=>({fraction,timeMs:timeline.duration*fraction,frame:sample(timeline,timeline.duration*fraction)}));
}
export function assertVisibleMeasurement(doc){
  if(doc.hidden)throw new Error('Tab became hidden during measurement; rerun in a visible tab.');
}
