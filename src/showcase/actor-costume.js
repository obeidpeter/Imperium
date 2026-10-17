import * as T from '../../vendor/three/three.module.js';

const TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
const BONE_NAMES=['torso','hips','right-shoulder','left-shoulder'];

// Original sewn-shell model. The two sleeve openings share actual indexed
// vertices with the body; they are not intersecting ellipsoids or rigid caps.
// Dimensions follow the existing 1.8 m rig. Local Y is relative to its torso.
const CLOTH=[
  [.025,.178,.125],[.075,.178,.134],[.14,.184,.143],[.205,.201,.155],
  [.26,.219,.162],[.285,.227,.160],[.325,.234,.157],[.365,.237,.148],
  [.405,.227,.130],[.445,.204,.105],[.468,.171,.088],
  [.484,.120,.073],[.495,.077,.064],[.502,.072,.062]
];
const ARMOR=[
  [-.135,.212,.151],[-.12,.215,.153],[-.075,.208,.149],[-.02,.197,.145],
  [.045,.195,.147],[.105,.201,.160],[.17,.211,.173],[.23,.233,.184],
  [.285,.245,.183],[.325,.252,.178],[.365,.253,.165],[.405,.243,.146],
  [.445,.220,.120],[.468,.186,.102],[.484,.131,.089],
  [.495,.093,.080],[.502,.088,.078]
];

function rowAt(rows,y){
  let i=0;while(i<rows.length-2&&rows[i+1][0]<y)i++;
  const a=rows[i],b=rows[i+1],t=clamp((y-a[0])/(b[0]-a[0]));
  return [y,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
}

/** Connected cloth/mail/scale geometry, including the turned neckline and
 * cuffs. No textures, timers, random numbers or campaign objects are read. */
export function costumeGeometry({kind='tunic',detail='near',quality='balanced'}={}){
  if(!['tunic','mail','scale'].includes(kind))throw new TypeError('Unknown costume shell.');
  const armor=kind!=='tunic',far=detail==='overview',columns=far?16:quality==='performance'?24:40;
  const base=armor?ARMOR:CLOTH,ys=[];
  for(let j=0;j<base.length;j++){
    ys.push(base[j][0]);
    if(!far&&j<base.length-1&&(base[j+1][0]-base[j][0])>.024)ys.push((base[j][0]+base[j+1][0])/2);
  }
  const rows=ys.map(y=>rowAt(base,y)),low=ys.indexOf(.285),high=ys.indexOf(.445),half=columns/8;
  const positions=[],uvs=[],colors=[],boneIndices=[],boneWeights=[],triangles=[],body=[];
  const seamLoops=[],boundaries=[];
  const tile=armor?.22:.18;
  const add=(p,u,v,shoulder=0,weight=0,tint=1)=>{
    const id=positions.length/3;positions.push(...p);uvs.push(u,v);colors.push(tint,tint,tint);
    // Waist follows hips; upper garment and cuffs blend to the real shoulders.
    const hip=(1-smooth((p[1]+.015)/.17))*(1-weight);
    boneIndices.push(0,1,shoulder,0);boneWeights.push(1-hip-weight,hip,weight,0);return id;
  };
  const surface=(y,a)=>{
    const [,rx,rz]=rowAt(base,y),front=Math.max(0,Math.cos(a)),waist=1-smooth((y-.07)/.29);
    const diagonal=Math.sin(a*5+y*19)*.55+Math.sin(a*9-y*13)*.25;
    // Tension folds converge toward the belt and armpits. Fine threads belong
    // in the material; these centimeter-scale folds alter the actual contour.
    const fold=(armor?.0035:.009)*(diagonal*(.35+.65*waist));
    const chest=armor?.003:.006*Math.exp(-(((y-.31)/.12)**2))*front;
    const scaleStep=kind==='scale'&&y<.285?.0045*Math.pow(.5+.5*Math.cos((y+.13)*TAU/.063),6):0;
    const scallop=armor&&y<-.10?.0035*Math.cos(a*12)*(1-smooth((y+.135)/.035)):0;
    const collarDrop=y>.468?.006*front*smooth((y-.468)/.034):0;
    return [Math.sin(a)*(rx+fold+scaleStep),y+scallop-collarDrop,Math.cos(a)*(rz+fold+scaleStep)+chest];
  };
  for(let j=0;j<rows.length;j++){
    const ring=[];
    for(let i=0;i<columns;i++){
      // Put the cylindrical UV seam at the garment's back, away from its
      // neckline and chest. The repeat density is shared with actor materials.
      const a=i/columns*TAU+Math.PI,p=surface(ys[j],a),side=p[0]<0?2:3;
      const shoulder=clamp((Math.abs(p[0])-.12)/.13)*smooth((ys[j]-.23)/.10)*.58;
      const tint=(ys[j]>.484||ys[j]<base[0][0]+.012)?.84:1;
      ring.push(add(p,(a-Math.PI)*.198/tile,ys[j]/tile,side,shoulder,tint));
    }body.push(ring);
  }
  const hole=(i,j)=>j>=low&&j<high&&[columns/4,columns*3/4].some(c=>i>=c-half&&i<c+half);
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<columns;i++)if(!hole(i,j)){
    const next=(i+1)%columns,a=body[j][i],b=body[j][next],c=body[j+1][i],d=body[j+1][next];
    triangles.push(a,b,c,b,d,c);
  }
  // Natural arms-down sleeve cut: the upper armhole slopes into the shoulder,
  // the lower armhole forms an underarm gusset, and both share skin weights.
  for(const side of [1,-1]){
    const center=side>0?columns*3/4:columns/4,start=center-half,end=center+half,loop=[];
    for(let i=start;i<=end;i++)loop.push(body[low][i]);
    for(let j=low+1;j<=high;j++)loop.push(body[j][end]);
    for(let i=end-1;i>=start;i--)loop.push(body[high][i]);
    for(let j=high-1;j>low;j--)loop.push(body[j][start]);
    seamLoops.push([...loop]);let previous=loop;
    const count=far?3:quality==='performance'?4:6;
    for(let row=1;row<=count;row++){
      const t=row/count,ring=[];
      for(let k=0;k<loop.length;k++){
        const index=loop[k],p=positions.slice(index*3,index*3+3),a=Math.atan2(p[2]/.11,(p[1]-.365)/.08);
        const radius=armor?.082:.067,cuffY=armor?.215:.245;
        const endP=[side*(.248+Math.cos(a)*radius),cuffY,Math.sin(a)*(armor?.083:.067)];
        const p2=p.map((v,i)=>v+(endP[i]-v)*t);
        p2[0]+=side*Math.sin(t*Math.PI)*(armor?.020:.012);
        const compression=Math.sin(a*3+t*9)*(armor?.002:.004)*Math.sin(t*Math.PI);
        p2[2]+=Math.sin(a)*compression;
        const shoulder=side<0?2:3,w=boneWeights[index*4+2]+(1-boneWeights[index*4+2])*smooth(t);
        const tint=row===count?.80:1;
        ring.push(add(p2,a*radius/tile,(.419-p2[1])/tile,shoulder,w,tint));
      }
      for(let k=0;k<loop.length;k++){
        const n=(k+1)%loop.length,a=previous[k],b=previous[n],c=ring[k],d=ring[n];
        triangles.push(a,b,c,b,d,c);
      }
      previous=ring;
    }
    boundaries.push(previous);
  }
  // Turned openings are connected to the main cloth, with actual thickness.
  // Their inside is a narrow sewn rim, not another complete shirt underlay.
  boundaries.push(body[0],body.at(-1));
  const finalBoundaries=[];
  for(let j=0;j<boundaries.length;j++){
    const original=boundaries[j],next=[];
    for(const index of original){
      const p=positions.slice(index*3,index*3+3),isCuff=j<2,side=p[0]<0?-1:1;
      if(isCuff){p[0]=side*.248+(p[0]-side*.248)*.95;p[2]*=.95;p[1]+=.006;}
      else{p[0]*=.972;p[2]*=.972;p[1]+=j===2?.006:-.006;}
      const id=add(p,uvs[index*2],uvs[index*2+1],boneIndices[index*4+2],boneWeights[index*4+2],.72);
      // Copy all weights, including the lower garment's hip influence.
      for(let k=0;k<4;k++)boneWeights[id*4+k]=boneWeights[index*4+k];next.push(id);
    }
    for(let k=0;k<original.length;k++){
      const n=(k+1)%original.length,a=original[k],b=original[n],c=next[k],d=next[n];
      if(j===2)triangles.push(a,c,b,b,c,d);else triangles.push(a,b,c,b,d,c);
    }finalBoundaries.push(next);
  }
  // The armhole interior was cut out, so remove its unused construction points.
  const used=[...new Set(triangles)].sort((a,b)=>a-b),remap=new Map(used.map((id,i)=>[id,i]));
  const pack=(values,size)=>used.flatMap(id=>values.slice(id*size,id*size+size));
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(pack(positions,3),3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(pack(uvs,2),2));
  geometry.setAttribute('color',new T.Float32BufferAttribute(pack(colors,3),3));
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(pack(boneIndices,4),4));
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(pack(boneWeights,4),4));
  geometry.setIndex(triangles.map(i=>remap.get(i)));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={originalModel:'connected-sewn-costume',kind,detail,metricUvTile:tile,boneNames:[...BONE_NAMES],seamLoops:seamLoops.map(loop=>loop.map(i=>remap.get(i))),boundaryLoops:finalBoundaries.map(loop=>loop.map(i=>remap.get(i)))};
  return geometry;
}

/** Install after the actor's ordinary surface batching. The returned arrays
 * join the existing near/far visibility lists. Resource sets retain ownership;
 * there are no independent caches, new joints, timers or pose state. */
export function mountActorCostume(group,{kit={},cloth,armor,quality='balanced',geometries,materials,skeletons}={}){
  const bones=BONE_NAMES.map(name=>group.getObjectByName(name));
  if(bones.some(b=>!b?.isBone))throw new TypeError('Costume requires the existing torso, hips and shoulder bones.');
  const source=kit.armored?armor:cloth;
  if(!source?.isMeshStandardMaterial)throw new TypeError('Costume requires its cloth or armor material.');
  if(!geometries||!materials||!skeletons)throw new TypeError('Costume resources require actor-owned disposal sets.');
  group.updateMatrixWorld(true);const local=new T.Matrix4().multiplyMatrices(group.matrixWorld.clone().invert(),bones[0].matrixWorld);
  const skeleton=new T.Skeleton(bones);skeletons.add(skeleton);
  const nearMeshes=[],farMeshes=[];let nearTriangles=0,farTriangles=0;
  for(const detail of ['near','overview']){
    const g=costumeGeometry({kind:kit.armored?kit.armor==='scale'?'scale':'mail':'tunic',quality,detail});
    g.applyMatrix4(local);geometries.add(g);
    const m=source.clone();m.vertexColors=true;
    if(detail==='overview'){m.name=`overview connected ${kit.armored?'armor':'tunic'}`;m.map=null;m.normalMap=null;m.bumpMap=null;m.roughnessMap=null;m.roughness=.86;}
    materials.add(m);const skin=new T.SkinnedMesh(g,m);skin.name=`${detail}-connected-${kit.armored?kit.armor:'tunic'}`;
    skin.userData.overview=detail==='overview';skin.userData.costume=true;skin.visible=detail==='near';skin.castShadow=true;skin.receiveShadow=true;
    skin.boundingSphere=new T.Sphere(new T.Vector3(0,1.25,0),2);skin.frustumCulled=false;group.add(skin);skin.bind(skeleton);
    if(detail==='near'){nearMeshes.push(skin);nearTriangles=g.index.count/3;}else{farMeshes.push(skin);farTriangles=g.index.count/3;}
  }
  skeleton.update();return {nearMeshes,farMeshes,stats:{nearDraws:1,farDraws:1,nearTriangles,farTriangles}};
}
