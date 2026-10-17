// Original, locally bundled recordings. No synthesis service is contacted in play.
export const VOICE_LINES=Object.freeze({
  arrival:{speaker:'The chronicle',text:'You arrive at the edge of an empire. For now, your duty is simple: learn the ground, stand beside your comrades, and bring them home.'},
  varro:{speaker:'Varro',text:'Stay beside your comrades. Let the enemy come against a line, not a lone shield.'},
  rally:{speaker:'The commander',text:'Hold your ground. Watch the flanks. We leave this field together.'},
  council:{speaker:'The chamber',text:'The chamber is listening. Give them a reason to trust the promise.'}
});
export const SOUND_FILES=Object.freeze(Object.fromEntries([
  'music-frontier','music-battle','music-council','ambience-frontier','ambience-dry','ambience-council','ambience-rain',
  'foley-shield','foley-step','foley-impact',...Object.keys(VOICE_LINES).map(id=>'voice-'+id)
].map(id=>[id,new URL('../../assets/audio/'+id+'.mp3',import.meta.url).href])));

export function soundscapeFor(state,screen='game'){
  if(!state||screen==='title')return {music:null,ambience:null};
  const e=state.encounter,civic=e?.kind==='contest'&&state.phase==='encounter';
  return {music:civic?'music-council':state.phase==='encounter'&&e?.kind==='battle'?'music-battle':'music-frontier',
    ambience:civic?'ambience-council':state.chapter===2?'ambience-rain':[5,6,9].includes(state.chapter)?'ambience-dry':'ambience-frontier'};
}
export function briefingFor(state){
  if(!state)return null;
  const id=state.encounter?.kind==='contest'&&state.phase==='encounter'?'council':state.chapter===1?(state.encounterIndex===0?'arrival':'varro'):state.chapter>=4?'rally':null;
  return id?{id,...VOICE_LINES[id]}:null;
}
export function foleyFor(kind){return ({footstep:'foley-step',block:'foley-shield',clash:'foley-shield',impact:'foley-impact'})[kind]??null;}
