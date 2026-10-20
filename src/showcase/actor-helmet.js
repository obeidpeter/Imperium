import * as T from '../../vendor/three/three.module.js';

/** Original formed-sheet cheek plate. A narrow hinge widens over the cheek,
 * then follows the jaw into a rounded tip; the face is gently dished rather
 * than a flat rectangular extrusion. Local +Z is the outside of the plate. */
export function cheekGuardGeometry({detail=true}={}){
  const shape=new T.Shape();
  shape.moveTo(-.012,.047);
  shape.quadraticCurveTo(-.019,.027,-.025,.012);
  shape.quadraticCurveTo(-.026,-.012,-.015,-.039);
  shape.quadraticCurveTo(-.007,-.055,.003,-.057);
  shape.quadraticCurveTo(.012,-.055,.018,-.038);
  shape.quadraticCurveTo(.028,-.014,.024,.009);
  shape.quadraticCurveTo(.019,.028,.014,.047);
  shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:true,bevelSegments:detail?2:1,steps:1,bevelSize:.002,bevelThickness:.0015,curveSegments:detail?5:2});
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i);
    p.setZ(i,p.getZ(i)+.007*Math.max(0,1-(y/.061)**2)+.003*(x/.028)**2);
  }
  geometry.computeVertexNormals();
  geometry.userData.originalModel='formed-tapered-cheek-guard';
  return geometry;
}
