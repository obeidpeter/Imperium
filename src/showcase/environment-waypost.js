// Release 14: the way out of camp, drawn as a waymarker the soldier walks to and leaves by: a post, a board
// pointing the way and a red pennant, from the scenery's own planks and materials, so it adds no shader
// program. `face` is the way out's direction on the ground ([x, z], from camp-world.js); the board points along it.
export function addWayPost(p,m,parent,{x,z,y=0,face=[1,0],name}){
  const yaw=-Math.atan2(face[1]??0,face[0]??1),g=p.group(parent,x,y,z,yaw);if(name)g.name=name;
  p.plank(g,0,.9,0,.16,1.8,.16,m.darkWood);
  p.plank(g,.36,1.46,0,.62,.26,.06,m.wood);p.plank(g,.73,1.46,0,.14,.16,.06,m.wood);
  p.plank(g,-.19,1.6,0,.28,.32,.03,m.red);
  return g;
}
