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

// Mixing direction for the existing recordings, not twelve newly recorded
// scores. Low-pass colour and restrained stereo placement distinguish places
// without changing musical pitch/tempo or consuming gameplay randomness.
const DIRECTIONS=[
  ['First oath',7000,8800,-.04],['After the rain',5200,7200,.03],
  ['The silent station',5600,6200,-.06],['The watch above the ford',7800,9300,.04],
  ['The siege curtain',6200,5700,-.05],['The long retreat',4600,4900,.06],
  ['The assembled legion',8500,8100,-.03],['The river crossing',6800,9700,.05],
  ['The eastern city',9200,6900,-.04],['The provincial harvest',7600,8500,.03],
  ['The marble chamber',6000,5300,0],['The imperial threshold',8100,6400,0]
].map(([title,musicHz,ambienceHz,pan])=>Object.freeze({title,musicHz,ambienceHz,pan}));
const bounded=(value,min,max)=>Math.max(min,Math.min(max,value));
export function audioDirection(state,screen='game'){
  const chapter=Number.isInteger(state?.chapter)?bounded(state.chapter,1,12):1,base=DIRECTIONS[chapter-1],e=state?.encounter;
  const playing=Boolean(state&&screen!=='title'),inEncounter=playing&&state.phase==='encounter'&&e,civic=inEncounter&&e.kind==='contest';
  const weather=civic?'clear':e?.weather??(chapter===2?'rain':[5,12].includes(chapter)?'embers':[6,9].includes(chapter)?'dust':'clear');
  let pressure=0;
  if(inEncounter&&(!e.status||e.status==='active')){
    const remaining=Number.isFinite(e.turnLimit)&&Number.isFinite(e.turn)?e.turnLimit-e.turn:null;
    if(remaining!==null&&remaining<=2)pressure=Math.max(pressure,remaining<=1?.78:.52);
    if(!civic){
      const visible=(e.units??[]).filter(u=>!u.hidden),hero=visible.find(u=>u.id==='hero');
      if(hero&&Number.isFinite(hero.hp)&&hero.maxHp>0)pressure=Math.max(pressure,hero.hp/hero.maxHp<=.3?.82:hero.hp/hero.maxHp<=.55?.48:0);
      if(Number.isFinite(e.defence)&&e.defence<=35)pressure=Math.max(pressure,.75);
      // Only an opponent already visible beside the player can affect the
      // mix. Hidden reinforcements and their count cannot leak through sound.
      if(hero&&visible.some(u=>u.side==='enemy'&&u.hp>0&&Math.abs(u.x-hero.x)+Math.abs(u.y-hero.y)<=2))pressure=Math.max(pressure,.35);
      const escorted=visible.find(u=>u.role==='escort'&&u.side!=='enemy'&&u.hp>0&&u.maxHp>0);
      if(escorted&&escorted.hp/escorted.maxHp<=.4)pressure=Math.max(pressure,.68);
    }
  }
  const mood=!playing?'silent':e?.status==='won'&&inEncounter?'victory':e?.status==='lost'&&inEncounter?'defeat':!inEncounter?'camp':pressure>=.65?'urgent':pressure>=.2?'engaged':'calm';
  const resolved=mood==='victory'||mood==='defeat',musicGain=mood==='urgent'?.76:mood==='engaged'?.88:mood==='defeat'?.62:mood==='victory'?.86:1;
  return Object.freeze({chapter,title:base.title,mood,pressure,weather,
    musicGain,ambienceGain:resolved?.88:pressure>=.65?.82:1,
    musicHz:bounded(base.musicHz+(pressure>=.2?1600:0)-(resolved?1400:0),3000,12000),
    ambienceHz:bounded(base.ambienceHz-(weather==='rain'?1500:weather==='dust'?1300:0)-(pressure>=.65?900:0),2200,12000),
    ambiencePan:civic?0:base.pan,transitionSeconds:resolved?2.4:pressure>=.65?1.15:1.8,
    ambienceOverride:playing&&!civic&&weather==='rain'?'ambience-rain':null});
}
