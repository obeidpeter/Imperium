// Presentation classification only. Names preserve a defecting unit's original
// equipment; allegiance never changes its ancestry or rewrites campaign state.
export function actorKit(unit={},options={}){
  const name=String(unit.name??''),chapter=Number(options.chapter)||1,rank=String(options.rank??''),trainer=unit.role==='trainer'||unit.id==='dummy'||options.role==='trainer';
  const civic=['speaker','voter'].includes(unit.role),escort=unit.role==='escort'||unit.side==='neutral'&&!civic;
  const faction=/persian/i.test(name)?'Persian':/palmyrene/i.test(name)?'Palmyrene':/gothic/i.test(name)?'Gothic':/roman|civil-war|rival claimant/i.test(name)?'Roman':trainer||unit.side==='player'||unit.side==='ally'?'Roman':escort||civic?'Civilian':chapter===5||chapter===6?'Persian':chapter===9?'Palmyrene':chapter>=11?'Roman':'Gothic';
  const mounted=['cavalry','heavy'].includes(unit.role),archer=unit.role==='archer',eastern=['Persian','Palmyrene'].includes(faction);
  const officer=!civic&&!escort&&(unit.id==='hero'&&(chapter>=4||/Optio|Centurio|Primus|Praefectus|Praepositus|Dux|Senator|Augustus/i.test(rank))||/claimant/i.test(name));
  // A trained soldier (the real-time arena's Legionary) is never drawn as the chapter's recruit.
  const recruit=unit.id==='hero'&&chapter===1&&!officer&&options.role!=='veteran'&&!unit.trained;
  const armored=!trainer&&!civic&&!escort&&!recruit&&(faction==='Roman'||mounted||unit.role==='guard'||eastern);
  const role=civic?unit.role:escort?'escort':trainer?'trainer':mounted?'cavalry':archer?'archer':officer?'officer':recruit?'recruit':faction==='Roman'?'veteran':'raider';
  let identity=2166136261;for(const c of String(unit.veteranId??unit.name??unit.id??role))identity=Math.imul(identity^c.charCodeAt(0),16777619)>>>0;
  const commendations=Number.isFinite(options.commendations)?options.commendations:Number.isFinite(options.commendations?.[unit.veteranId])?options.commendations[unit.veteranId]:Number.isFinite(unit.commendations)?unit.commendations:unit.moraleResistance?6:unit.specialization?3:0;
  const veteranTier=!civic&&!escort&&!trainer&&faction==='Roman'?(commendations>=6?3:commendations>=3?2:commendations>=1?1:0):0;
  const signum=options.signum==='aquila'||escort&&/eagle-bearer/i.test(name)?'aquila':options.signum==='signum'||options.signum===true||(!civic&&!escort&&!trainer&&faction==='Roman'&&unit.specialization==='leader')?'signum':null;
  return {role,faction,chapter,rank,trainer,civic,escort,mounted,archer,officer,recruit,eastern,armored,armor:armored?(eastern?'scale':'mail'):null,armed:!civic&&!escort,identity,commendations,veteranTier,signum,
    helmet:armored?(eastern?'conical':faction==='Roman'?'ridge':'segmented'):null,
    cloak:officer||!archer&&armored&&faction==='Roman',wounded:escort&&/wounded|Varro/i.test(name),
    // A man the rules give no shield carries none (unit.shield false); otherwise the role decides.
    shield:unit.shield!==false};
}
