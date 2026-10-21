// Named random streams for the real-time simulation, split from the campaign's
// one seeded generator (shared.js `rng`): each system draws from its own
// stream, so adding a draw to one (an AI choice, say) never shifts another's
// rolls. Every stream steps exactly as `rng` does; a stream's seed is the
// root seed mixed with the stream's name. Pure: no clock and no Math.random.

export const STREAMS=Object.freeze(['combat','ai','world']);

// FNV-1a over the name, then a 32-bit avalanche (murmur3's finaliser), so
// neighbouring seeds and similar names still start far apart.
function nameHash(name){let h=0x811c9dc5;for(let i=0;i<name.length;i++){h^=name.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h;}
export function mix32(x){
  x>>>=0;x^=x>>>16;x=Math.imul(x,0x85ebca6b)>>>0;x^=x>>>13;x=Math.imul(x,0xc2b2ae35)>>>0;x^=x>>>16;return x>>>0;
}
export function streamSeed(seed,name){return mix32((seed>>>0)^nameHash(name))||0x9e3779b9;}
export function splitStreams(seed,names=STREAMS){return Object.fromEntries(names.map(name=>[name,streamSeed(seed,name)]));}

// One step of the campaign generator on a stream held in `streams[name]`.
export function nextRandom(streams,name){
  if(!Number.isInteger(streams?.[name]))throw new Error(`Unknown random stream: ${name}`);
  streams[name]=(Math.imul(streams[name],1664525)+1013904223)>>>0;return streams[name]/4294967296;
}
// An integer in [min, max], both included.
export function randomInt(streams,name,min,max){return min+Math.floor(nextRandom(streams,name)*(max-min+1));}
