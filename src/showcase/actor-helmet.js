import * as T from '../../vendor/three/three.module.js';

/** A formed, slightly flattened iron bowl with an integral rolled rim.
 * Panel seams change the surface normal rather than adding painted stripes.
 * Dimensions are metres, relative to the head bone used by every chapter. */
export function helmetBowlGeometry({detail=true,seed=0}={}){
  const sections=detail?40:24,rows=detail?14:9,positions=[],uv=[],indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=sections;i++){
    const a=i/sections*Math.PI*2,t=j/rows,theta=t*Math.PI/2,r=Math.cos(theta);
    const panel=Math.pow(Math.abs(Math.sin(a*2)),28)*.0015*r;
    const hand=.00075*Math.sin(a*7+seed%11)*Math.sin(theta*2);
    const rolled=j===0?.003:0;
    positions.push(Math.sin(a)*(.130*r+panel+hand+rolled),.132+.141*Math.sin(theta)**.86,Math.cos(a)*(.133*r+panel+hand+rolled)-.012);
    uv.push(i/sections,t);
    if(j<rows&&i<sections){const n=j*(sections+1)+i;indices.push(n,n+1,n+sections+1,n+1,n+sections+2,n+sections+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.originalModel='formed-iron-bowl-v035';return g;
}

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
