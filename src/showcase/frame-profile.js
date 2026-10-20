// Bounded measured windows. CPU submission and display cadence are reported
// separately; neither is labelled GPU time without an actual GPU query.
export function createFrameProfile(limit=240){
  const windows={cpu:[],interval:[],reflection:[]};let frames=0;
  const push=(key,value)=>{if(Number.isFinite(value)&&value>=0){const a=windows[key];a.push(value);if(a.length>limit)a.shift();}};
  const summary=a=>{const s=[...a].sort((a,b)=>a-b);return {samples:s.length,meanMs:s.length?s.reduce((a,b)=>a+b,0)/s.length:0,p95Ms:s[Math.max(0,Math.ceil(s.length*.95)-1)]??0,worstMs:s.at(-1)??0};};
  return {record({cpuMs,intervalMs,reflectionMs}){frames++;push('cpu',cpuMs);if(intervalMs>0&&intervalMs<=60000)push('interval',intervalMs);push('reflection',reflectionMs);},
    reflectionStride(){const s=summary(windows.reflection);return s.samples>=30&&s.p95Ms>4?2:1;},
    stats(){return {frames,cpuSubmission:summary(windows.cpu),displayInterval:summary(windows.interval),reflectionSubmission:summary(windows.reflection),reflectionStride:this.reflectionStride(),note:'Measured on this browser; CPU submission excludes asynchronous GPU execution.'};}};
}
