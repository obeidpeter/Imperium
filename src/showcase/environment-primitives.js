import * as THREE from '../../vendor/three/three.module.js';

// One reusable chamfered block. Its outer bounds are exactly the unit cube,
// so replacing a masonry box never expands a wall into a legal standing cell.
export function createMasonryBlockGeometry(bevel=.035){
  const geometry=new THREE.BoxGeometry(1,1,1,3,3,3),p=geometry.attributes.position,n=geometry.attributes.normal,inner=.5-bevel;
  for(let i=0;i<p.count;i++){
    const v=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));
    for(const axis of ['x','y','z'])if(Math.abs(v[axis])<.49)v[axis]=Math.sign(v[axis])*inner;
    const core=v.clone().clampScalar(-inner,inner),normal=v.clone().sub(core).normalize();v.copy(core).addScaledVector(normal,bevel);p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function createColumnGeometry(){
  const profile=[[.48,0],[.48,.15],[.34,.20],[.29,.40],[.295,1.25],[.278,2.65],[.24,4.05],[.32,4.20],[.43,4.28],[.43,4.45]].map(v=>new THREE.Vector2(...v));
  const geometry=new THREE.LatheGeometry(profile,24),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),y=p.getY(i),r=Math.hypot(x,z),fade=Math.min(1,Math.max(0,(y-.40)/.25),Math.max(0,(4.10-y)/.20)),flute=(.5+.5*Math.cos(Math.atan2(z,x)*12))*.014*fade,scale=(r-flute)/r;
    p.setXYZ(i,x*scale,y,z*scale);
  }
  geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}

// PolyhedronGeometry duplicates face vertices. Average only coincident points
// so weathered stones retain their outline without a plastic triangular sheen.
export function smoothCoincidentNormals(geometry){
  geometry.computeVertexNormals();const p=geometry.attributes.position,n=geometry.attributes.normal,sums=new Map(),keys=[];
  for(let i=0;i<p.count;i++){const key=`${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;keys.push(key);if(!sums.has(key))sums.set(key,new THREE.Vector3());sums.get(key).add(new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i)));}
  for(const normal of sums.values())normal.normalize();for(let i=0;i<p.count;i++){const normal=sums.get(keys[i]);n.setXYZ(i,normal.x,normal.y,normal.z);}return geometry;
}
