import {TIME} from '../../data/realtime-rules.js';

// The fixed-step driver (§3.1): accumulator += realDelta × rate, and every
// whole 50 ms runs one tick. The page passes the real time between its frames;
// the simulation itself never sees it. Game speed, slow time and pause change
// only how many ticks run per real second. Step (N while paused) plays one
// round at the current pace, then the clock is paused again.

export function createClock({speed=1,paused=false}={}){
  return {accumulator:0,paused:!!paused,speed:TIME.speeds.includes(speed)?speed:1,slow:false,stepTicks:0};
}
export function setSpeed(clock,speed){if(TIME.speeds.includes(speed))clock.speed=speed;return clock.speed;}
// Resuming runs the next tick on the next frame: what was ordered while
// paused starts at once, and the drawn frame carries on from the latest tick.
export function setPaused(clock,paused){
  const resume=clock.paused&&!paused;clock.paused=!!paused;clock.stepTicks=0;
  if(resume)clock.accumulator=Math.max(clock.accumulator,TIME.tickMs*.999);return clock.paused;
}
export function setSlow(clock,slow){clock.slow=!!slow;return clock.slow;}
// Play `ticks` more (one round by default) and pause again; only while paused.
export function stepRound(clock,ticks=TIME.roundTicks){
  if(!clock.paused)return false;clock.stepTicks=ticks;clock.accumulator=Math.max(clock.accumulator,TIME.tickMs*.999);return true;
}
export const stepping=clock=>clock.paused&&clock.stepTicks>0;
// Simulated milliseconds per real millisecond.
export function clockRate(clock){return clock.paused&&!clock.stepTicks?0:clock.speed*(clock.slow?TIME.slowFactor:1);}

// The ticks one frame of `realMs` runs. A long frame (a backgrounded tab) is
// capped, and a step never runs past its round.
export function advanceClock(clock,realMs){
  const rate=clockRate(clock);if(!rate)return 0;
  clock.accumulator+=Math.min(Math.max(0,Number(realMs)||0),TIME.maxFrameMs)*rate;
  let ticks=Math.floor(clock.accumulator/TIME.tickMs);clock.accumulator-=ticks*TIME.tickMs;
  if(clock.stepTicks>0){
    if(ticks>=clock.stepTicks){ticks=clock.stepTicks;clock.stepTicks=0;clock.accumulator=0;}else clock.stepTicks-=ticks;
  }
  return ticks;
}
// Stop at once mid-frame (auto-pause): the caller drops the frame's remaining ticks.
export function interruptClock(clock){clock.paused=true;clock.stepTicks=0;}
// How far the rendered frame lies between the last two ticks. A paused world
// is drawn as it stands after its latest tick.
export const clockAlpha=clock=>clock.paused&&!clock.stepTicks?1:Math.min(1,Math.max(0,clock.accumulator/TIME.tickMs));
