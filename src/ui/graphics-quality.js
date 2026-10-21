// Quality affects optional presentation only. Essential art, labels, targeting,
// terrain rules and game state must remain identical in every profile.
export const GRAPHICS_MODES=Object.freeze({
  performance:Object.freeze({maxPixelRatio:1,particles:0,shadowLayers:1,atmosphere:false}),
  balanced:Object.freeze({maxPixelRatio:1.5,particles:6,shadowLayers:2,atmosphere:true}),
  high:Object.freeze({maxPixelRatio:2,particles:12,shadowLayers:3,atmosphere:true})
});
// 3D figure presentation: sculpted models, the painted 2D figures standing in
// the 3D scene (HD-2D), or sculpted figures finished in ink and wash.
export const FIGURE_STYLES=Object.freeze(['sculpted','painted','inked']);
const ORDER=['performance','balanced','high'];
const WINDOW=30,OVER_BUDGET_MS=22,OVER_BUDGET_COUNT=18;

/** These are conservative initial hints, not measured device capability: a
 * phone (a touch-first screen no wider than 820 CSS px on its short side),
 * a data saver or 2 GB of memory or less starts on Performance. The player's
 * choice, once saved, always wins; Settings → Run performance check measures. */
export function defaultGraphicsMode({saveData=false,deviceMemory,phone=false}={}) {
  return saveData||phone||(Number.isFinite(deviceMemory)&&deviceMemory>0&&deviceMemory<=2)?'performance':'balanced';
}
export function phoneLike(win=globalThis){
  try{return !!win.matchMedia?.('(pointer: coarse)').matches&&Math.min(win.screen?.width??Infinity,win.screen?.height??Infinity)<=820;}catch{return false;}
}

/** Feed actual rendering costs, not elapsed time while idle or hidden.
 * Thirty active samples and a majority over budget are needed for each step.
 * A faster run never raises quality automatically; the player can choose it.
 */
export function createGraphicsQuality({mode,saveData=false,deviceMemory,phone=false,onChange}={}) {
  let current=mode??defaultGraphicsMode({saveData,deviceMemory,phone});
  if(!Object.hasOwn(GRAPHICS_MODES,current))throw new TypeError('Unknown graphics mode.');
  let samples=[],totalSamples=0,downgrades=0,lastReason='initial';
  function setMode(next) {
    if(!Object.hasOwn(GRAPHICS_MODES,next))throw new TypeError('Unknown graphics mode.');
    const changed=next!==current;current=next;samples=[];lastReason='player';
    if(changed)onChange?.({mode:current,reason:'player'});
    return GRAPHICS_MODES[current];
  }
  function recordFrame(costMs,{hidden=false,active=true}={}) {
    if(hidden||!active||!Number.isFinite(costMs)||costMs<0)return {mode:current,changed:false,accepted:false};
    totalSamples++;samples.push(costMs);if(samples.length>WINDOW)samples.shift();
    if(current!=='performance'&&samples.length===WINDOW&&samples.filter(cost=>cost>OVER_BUDGET_MS).length>=OVER_BUDGET_COUNT){
      current=ORDER[ORDER.indexOf(current)-1];samples=[];downgrades++;lastReason='measured-cost';
      onChange?.({mode:current,reason:lastReason});
      return {mode:current,changed:true,accepted:true};
    }
    return {mode:current,changed:false,accepted:true};
  }
  // A 3D battle that stayed slow at its lowest resolution: the next one is
  // built a tier lower (never rebuilt mid-battle). Returns the new mode.
  function stepDown(reason='measured-cost') {
    if(current==='performance')return current;
    current=ORDER[ORDER.indexOf(current)-1];samples=[];downgrades++;lastReason=reason;
    onChange?.({mode:current,reason});return current;
  }
  function stats() {
    const sorted=[...samples].sort((a,b)=>a-b);
    return {mode:current,samples:samples.length,maxSamples:WINDOW,totalSamples,downgrades,
      overBudgetMs:OVER_BUDGET_MS,requiredOverBudget:OVER_BUDGET_COUNT,
      meanMs:samples.length?samples.reduce((sum,cost)=>sum+cost,0)/samples.length:0,
      p95Ms:sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:0,reason:lastReason};
  }
  return {get mode(){return current;},get profile(){return GRAPHICS_MODES[current];},setMode,recordFrame,stepDown,stats};
}
