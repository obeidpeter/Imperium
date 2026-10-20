import * as T from '../../vendor/three/three.module.js';

/** Join broad masonry plinths to uneven peripheral terrain. The skirt only
 * extends downward from an existing foundation; it never raises walkable
 * ground, closes a doorway or expands the structure's horizontal footprint. */
export function groundArchitecturalFoundations({root,height,e,tileSize=2.5,p,m}){
  root.updateWorldMatrix(true,true);
  const masonry=new Set([m.stone,m.darkStone,m.brick,m.marble]),candidates=[];
  root.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||!masonry.has(o.material))return;
    const b=new T.Box3().setFromObject(o),size=b.getSize(new T.Vector3());
    if(size.x<2.5||size.z<2.3||size.y>.8||b.min.y>height((b.min.x+b.max.x)/2,(b.min.z+b.max.z)/2)+.8)return;
    // Whole footprint must stay beyond the rule board, including wider fields.
    const hx=e.width*tileSize/2,hz=e.height*tileSize/2;
    if(!(b.max.x< -hx||b.min.x>hx||b.max.z< -hz||b.min.z>hz))return;
    candidates.push({bounds:b,material:o.material});
  });
  let skirts=0,vertices=0;
  for(const {bounds:b,material}of candidates){
    const corners=[[b.min.x,b.min.z],[b.max.x,b.min.z],[b.max.x,b.max.z],[b.min.x,b.max.z]],positions=[],uv=[],indices=[];
    for(let edge=0;edge<4;edge++){
      const a=corners[edge],c=corners[(edge+1)%4],length=Math.hypot(c[0]-a[0],c[1]-a[1]),steps=Math.max(1,Math.ceil(length/.55));
      for(let i=0;i<steps;i++){
        const t=i/steps,u=(i+1)/steps,x0=a[0]+(c[0]-a[0])*t,z0=a[1]+(c[1]-a[1])*t,x1=a[0]+(c[0]-a[0])*u,z1=a[1]+(c[1]-a[1])*u;
        const floor0=height(x0,z0)-.06,floor1=height(x1,z1)-.06,top=b.min.y+.025;
        if(Math.max(top-floor0,top-floor1)<.045)continue;
        const n=positions.length/3;
        positions.push(x0,Math.min(top,floor0),z0,x1,Math.min(top,floor1),z1,x0,top,z0,x1,top,z1);
        uv.push(t*length,floor0,u*length,floor1,t*length,top,u*length,top);indices.push(n,n+2,n+1,n+1,n+2,n+3);
      }
    }
    if(!positions.length)continue;
    const geometry=p.geo(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const skirt=p.mesh(root,geometry,material);skirt.name='terrain-fitted masonry footing';skirts++;vertices+=positions.length/3;
  }
  root.userData.foundationContacts={skirts,vertices};
  return root.userData.foundationContacts;
}
