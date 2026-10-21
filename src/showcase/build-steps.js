// A long build written as a generator yields wherever it may pause. runSteps
// runs one to the end at once (tests, the standalone study); runSliced runs it
// in slices of about a frame's work, giving the page a turn between slices, so
// a battle is made behind its veil without freezing the page.
// Presentation only: no game state, rules or gameplay randomness.
export const FRAME_SLICE_MS=8;
export const nextSlice=()=>globalThis.scheduler?.yield?.()??new Promise(done=>setTimeout(done,0));

export function runSteps(steps){
  let step;do step=steps.next();while(!step.done);
  return step.value;
}

// Resolves to the build's result, or to undefined if current() turns false at
// a pause (the generator is closed, so its finally blocks run).
export async function runSliced(steps,{current=()=>true,budget=FRAME_SLICE_MS,pause=nextSlice}={}){
  let slice=performance.now();
  for(;;){
    const step=steps.next();if(step.done)return step.value;
    if(performance.now()-slice<budget)continue;
    await pause();
    if(!current()){steps.return();return undefined;}
    slice=performance.now();
  }
}
