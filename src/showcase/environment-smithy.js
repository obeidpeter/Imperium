import * as T from '../../vendor/three/three.module.js';

// The armourer's forge in every camp (release 11): an anvil on its block, a
// quench tub and a rack of spears and blades, from the scenery's own pieces
// and materials (no new shader program). It stands behind the armourer, away
// from the place's centre the soldier comes from (camp-world.js smithyOf), so
// walking up to him never crosses it. Presentation only.
export function addSmithy({p,m,height},parent,smithy){
  if(!smithy)return null;
  const g=p.group(parent,smithy.x,height(smithy.x,smithy.z),smithy.z,Math.atan2(smithy.face[0],smithy.face[1]));g.name='camp smithy';
  // The anvil on its stump.
  p.mesh(g,p.cylinder,m.darkWood,0,.29,0,.27,.58,.27);
  p.plank(g,0,.65,0,.17,.14,.44,m.iron);p.plank(g,0,.75,-.02,.24,.06,.52,m.iron);p.plank(g,0,.74,.33,.1,.07,.18,m.iron);
  // The quench tub.
  p.mesh(g,p.cylinder,m.wood,-.95,.21,.05,.3,.42,.3);
  const water=p.mesh(g,p.geo(new T.CircleGeometry(.27,12)),m.water,-.95,.43,.05);water.rotation.x=-Math.PI/2;water.castShadow=false;
  // The rack: two posts and a bar, spears leaning on it and blades hung from it.
  for(const x of [.62,1.48])p.plank(g,x,.6,-.25,.08,1.2,.08,m.wood);p.plank(g,1.05,1.12,-.25,1,.07,.07,m.darkWood);
  for(const x of [.75,.9,1.05]){p.beam(g,[x,0,-.02],[x+.05,1.75,-.3],.018,m.wood);p.beam(g,[x+.05,1.75,-.3],[x+.055,1.9,-.32],.024,m.iron);}
  for(const x of [1.22,1.36])p.plank(g,x,.78,-.2,.045,.62,.018,m.iron);
  return g;
}
