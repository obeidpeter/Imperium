// Art direction, independent of game allegiance. The same person retains their
// dyed cloth, shield paint and metal finish after a legal change of side.
const CAST=Object.freeze({
  varro:{cloth:0xb4a78c,shield:0x695746,leather:0x493b30,metal:0x8f9288,bronze:0x998250},
  lucan:{cloth:0xcfc4aa,shield:0x28575b,leather:0x4c3529,metal:0xa8ada7,bronze:0xb09962},
  crispus:{cloth:0xb4b5a2,shield:0x495064,leather:0x3b352c,metal:0x959f9e,bronze:0xa38d64},
  severianus:{cloth:0xc8b598,shield:0x6e323a,leather:0x382a26,metal:0xa4a59b,bronze:0xb69b5f},
  paullus:{cloth:0xd6c9af,shield:0x655444,leather:0x554235,metal:0x8d948c,bronze:0xb19c69},
  aelia:{cloth:0xd5c8ab,shield:0x536052,leather:0x65503c,metal:0x9ba39e,bronze:0xad945c},
  sabinus:{cloth:0xb6ad8c,shield:0x73443b,leather:0x43332b,metal:0x9ca69d,bronze:0x9d8658}
});
for(const palette of Object.values(CAST))Object.freeze(palette);
export function actorWardrobe(identity={},kit={}){
  const veteran=kit.chapter>=5,command=kit.chapter>=7;
  const eastern=!CAST[identity.key]&&identity.key!=='marcellus'&&kit.eastern;
  const hero=identity.key==='marcellus'?{
    cloth:kit.civic?0xe0d4b9:kit.recruit?0xd1c6a8:command?0xc3b08c:veteran?0xc6b99b:0xccc1a4,
    shield:command?0x612a32:veteran?0x793738:0x345b60,
    leather:veteran?0x4a3329:0x5d4937,metal:command?0xa5ada7:0x929b95,
    bronze:command?0xbda167:0xab925e
  }:CAST[identity.key];
  return {
    palette:hero?{...hero}:{},
    cloak:identity.key==='lucan'?0x465c55:identity.key==='varro'?0x76664b:kit.officer?0x773c42:0x5e5b45,
    armorTint:eastern?0xaaa28b:command&&identity.key==='marcellus'?0xb0b4a7:0x9ba49b,
    armorRoughness:eastern?.78:identity.key==='varro'?.96:kit.officer?.80:.90,
    metalRoughness:kit.officer?.72:.88
  };
}
