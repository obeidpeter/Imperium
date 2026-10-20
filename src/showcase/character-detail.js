// Costume details use the existing bones and material batches. No extra actor,
// skeleton, image request or per-frame draw object is needed for each buckle.
export function mountCharacterDetail(unit,kit,{torso,head,cloth,clothDark,leather,bronze,mesh,strip,ellipsoid,profile}){
  if(kit.civic){
    if(unit.id==='hero'||unit.negotiatorId){
      strip(torso,bronze,[[-.12,.42,.22],[0,.34,.245],[.12,.42,.22]],.003);
      ellipsoid(torso,bronze,0,.33,.247,.016,.022,.006);
    }return;
  }
  if(!kit.armed)return;
  // A suspended scabbard makes the belt a functional kit, with a visible chape
  // and suspension points. Officers carry a broader, more decorated balteus.
  const z=kit.armored?.19:.155;
  strip(torso,leather,[[.17,.42,z-.035],[.09,.28,z+.025],[-.03,.12,z+.025],[-.16,.02,z]],kit.officer?.019:.012);
  for(const t of [.13,.24,.35])ellipsoid(torso,bronze,(t-.13)*.52-.02,t,z+.038,.007,.008,.003);
  strip(torso,leather,[[.16,.045,.1],[.22,-.13,.09],[.26,-.38,.07]],.027);
  strip(torso,bronze,[[.245,-.34,.075],[.26,-.39,.07]],.029);
  // Edge binding and stitches follow the waist; small alternating stitches
  // avoid a bright continuous stripe at overview distance.
  mesh(torso,profile([[.019,.207,.163],[.025,.207,.163]],{segments:24}),clothDark);
  if(kit.officer||unit.veteranId){
    for(let i=0;i<9;i++){const a=(i-4)*.18;ellipsoid(torso,bronze,Math.sin(a)*.202,.055,Math.cos(a)*.166,.003,.004,.002);}
    const badges={lucan:1,sabinus:1,naso:2,felix:3,firmus:4,rufus:5};
    const badge=badges[unit.veteranId]??(unit.id==='hero'?6:0);
    if(badge){for(let i=0;i<Math.min(3,badge);i++)ellipsoid(torso,bronze,-.135+i*.025,.35,z+.005,.008,.012,.004);}
  }
  if(kit.recruit){
    strip(torso,clothDark,[[-.055,.49,.07],[0,.47,.085],[.055,.49,.07]],.003);
    // Plain lead identity token, deliberately subtler than an officer's clasp.
    ellipsoid(torso,cloth,0,.385,.161,.010,.014,.003);
  }
}
