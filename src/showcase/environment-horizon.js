import * as T from '../../vendor/three/three.module.js';
import {hash,noise,smooth,clamp} from './environment-layout.js';

// A finite, 360-degree landscape around the authoritative 80m ground. Only the
// inner edge samples gameplay height; this mesh never becomes picking terrain.
export function createEnvironmentHorizon({ground,profile,height,quality='balanced'}){
  const group=new T.Group();group.name='regional distant landscape';group.userData.environmentHorizon=true;
  const geometries=new Set(),materials=new Set(),edges=[],segments=ground.geometry.parameters.widthSegments;
  const arid=profile.vegetation==='arid',wet=profile.setting==='wetland',city=['palmyra','rome','accession'].includes(profile.setting);
  const haze=new T.Color(profile.fog),land=new T.Color(arid?'#9c8b6a':wet?'#657461':'#68765d'),seed=profile.chapter*17;
  const rows=[40,48,64,100,155,235,355,550],size=segments*4,riverJoin=62.5,riverEdges=[];
  let waterGeometry=null;
  let disposed=false;
  for(let edge=0;edge<4;edge++)for(let i=0;i<segments;i++){
    const t=i/segments*2-1;edges.push(edge===0?[t,-1]:edge===1?[1,t]:edge===2?[-t,1]:[-1,-t]);
  }
  function riverCentre(x){const d=Math.max(0,Math.abs(x)-riverJoin);return -29+Math.sin(d*.011)*d*.075;}
  function riverWidth(x){return 8+smooth((Math.abs(x)-riverJoin)/320)*13;}
  function terrainHeight(x,z){
    const edge=Math.max(Math.abs(x),Math.abs(z)),distance=Math.hypot(x,z),blend=smooth((edge-40)/65),amplitude=city?14:wet?10:arid?35:30;
    const broad=noise(x*.009,z*.009,seed),spine=Math.pow(noise(x*.021,z*.021,seed+4),1.35),distant=smooth((distance-80)/290);
    let y=height(x,z)+blend*((broad-.20)*amplitude*(.34+distant*.72)+spine*amplitude*.43);
    if(profile.distantWater&&Math.abs(x)>40){const channel=1-smooth((Math.abs(z-riverCentre(x))-riverWidth(x))/(10+Math.abs(x)*.015));y=y*(1-channel)+Math.min(y,-2.05)*channel;}
    return y;
  }
  function point(q,r){const length=Math.hypot(...q),round=smooth((r-40)/140);return [q[0]*r*(1-round)+q[0]/length*r*round,q[1]*r*(1-round)+q[1]/length*r*round];}
  function tint(x,z,y,extra=0){const distance=Math.hypot(x,z),variation=(noise(x*.05,z*.05,seed+2)-.5)*.12,c=land.clone().multiplyScalar(.93+variation+y*.0014);return c.lerp(haze,clamp(.32+smooth((distance-60)/490)*.60+extra));}
  function addMesh(name,geometry,material){geometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.environmentHorizon=true;group.add(mesh);return mesh;}
  function ring(from,to,material,near=false){
    const positions=[],colors=[],uv=[],soil=[],indices=[];
    for(let row=from;row<=to;row++)for(let i=0;i<size;i++){
      const [x,z]=point(edges[i],rows[row]),y=terrainHeight(x,z);positions.push(x,y,z);uv.push((x+40)/2,(40-z)/2);
      if(near){
        // Identical inputs to the original ground shader at the shared edge.
        const patch=noise(x*.23,z*.23,8),damp=smooth((-z-17)/4)*(1-smooth((-z-40)/5)),edge=.93+noise(x*.06,z*.06,2)*.07;
        colors.push((.91+patch*.09)*edge*(1-damp*.2),(.94+patch*.06)*edge*(1-damp*.13),(.88+patch*.09)*edge*(1-damp*.12));
        soil.push(clamp((profile.training?.12:profile.soilMix)+(profile.training?0:Math.pow(noise(x*.19,z*.19,31),2)*.48)+damp*.42));
      }else colors.push(...tint(x,z,y).toArray());
      if(row<to){const a=(row-from)*size+i,b=(row-from)*size+(i+1)%size,c=a+size,d=b+size;indices.push(a,b,c,b,d,c);}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(near)geometry.setAttribute('soilMix',new T.Float32BufferAttribute(soil,1));geometry.setIndex(indices);geometry.computeVertexNormals();
    if(near){
      // Preserve the fine ground's edge normals too: a coarser outer ring must
      // not create a lighting seam where its first vertices meet that ground.
      const source=ground.geometry.attributes.normal,target=geometry.attributes.normal;
      for(let i=0;i<size;i++){const edge=Math.floor(i/segments),j=i%segments,k=edge===0?j:edge===1?j*(segments+1)+segments:edge===2?segments*(segments+1)+segments-j:(segments-j)*(segments+1);target.setXYZ(i,source.getX(k),source.getY(k),source.getZ(k));}
    }
    geometry.computeBoundingSphere();
    const mesh=addMesh(near?'continuous outer ground bridge':'360 degree regional ridges',geometry,material);mesh.userData.innerRadius=rows[from];mesh.userData.outerRadius=rows[to];return mesh;
  }
  // The close bridge shares the actual material/textures and fog treatment.
  // Distant geometry handles its own atmospheric blend so scene FogExp2 cannot
  // erase the horizon completely when the camera lowers toward eye level.
  const distant=new T.MeshBasicMaterial({vertexColors:true,fog:false});materials.add(distant);
  const bridge=ring(0,2,ground.material,true),ridges=ring(2,rows.length-1,distant);

  if(profile.distantWater){
    const positions=[],colors=[],indices=[],steps=50;
    for(const side of [-1,1]){
      const offsets=[];
      for(let i=0;i<=steps;i++){
        const x=side*(riverJoin+i/steps*(510-riverJoin)),z=riverCentre(x),w=riverWidth(x),c=new T.Color(profile.waterColor).multiplyScalar(.9).lerp(haze,.35+smooth(i/steps)*.6),samples=i===0?13:2;
        offsets.push(positions.length/3);
        for(let j=0;j<samples;j++){
          // Match all thirteen vertices along the animated near river's edge.
          // The following row reduces to two points: only 22 extra triangles
          // are needed for the complete join, not a dense distant water mesh.
          const localZ=i===0?Math.fround(-8+j*16/12):-w+j*w*2,index=positions.length/3;
          positions.push(x,-1.24,z+localZ);colors.push(...c.toArray());if(i===0)riverEdges.push({index,x,localZ});
        }
      }
      const face=(a,b,c)=>indices.push(...(side===1?[a,b,c]:[a,c,b]));
      for(let i=0;i<steps;i++){
        const a=offsets[i],b=offsets[i+1],samples=i===0?13:2;
        for(let j=0;j<samples-1;j++)face(a+j,a+j+1,b);
        face(a+samples-1,b+1,b);
      }
    }
    waterGeometry=new T.BufferGeometry();waterGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));waterGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));waterGeometry.setIndex(indices);waterGeometry.computeVertexNormals();addMesh('distant meandering Danube',waterGeometry,distant);
  }

  const silhouettePositions=[],silhouetteColors=[];
  const triangle=(a,b,c,color)=>{silhouettePositions.push(...a,...c,...b);for(let i=0;i<3;i++)silhouetteColors.push(...color.toArray());};
  function box(x,y,z,w,h,d,color){
    const p=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2,y+b*h,z+c*d/2]);
    for(const [face,[a,b,c,d]]of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].entries()){const shade=color.clone().multiplyScalar([.94,1.02,.88,.98,1.05][face]);triangle(p[a],p[b],p[c],shade);triangle(p[a],p[c],p[d],shade);}
  }
  if(city){
    for(let i=0;i<(quality==='performance'?45:70);i++){
      const angle=i*2.39996,r=190+hash(i,seed)*175,x=Math.cos(angle)*r,z=Math.sin(angle)*r,y=terrainHeight(x,z),w=5+hash(i,31)*11,d=5+hash(i,33)*9,h=3+hash(i,32)*(profile.setting==='palmyra'?5:7),c=tint(x,z,y,.05);
      box(x,y,z,w,h,d,c);const roof=tint(x,z,y).multiplyScalar(.86),a=[x-w*.55,y+h,z-d*.55],b=[x+w*.55,y+h,z-d*.55],c1=[x+w*.55,y+h,z+d*.55],d1=[x-w*.55,y+h,z+d*.55],top1=[x,y+h+2,z-d*.55],top2=[x,y+h+2,z+d*.55];
      triangle(a,b,top1,roof);triangle(d1,top2,c1,roof);triangle(a,top1,top2,roof);triangle(a,top2,d1,roof);triangle(b,c1,top2,roof);triangle(b,top2,top1,roof);
    }
    group.userData.silhouetteKind=profile.setting==='palmyra'?'Palmyrene rooflines':'Roman urban rooflines';
  }else if(!arid){
    // Low-poly closed tree crowns are small distant silhouettes, never nearby
    // billboard scenery. They occupy every bearing, with broad natural gaps.
    for(let i=0;i<(quality==='performance'?20:29);i++){
      const angle=i*2.39996,r=(wet?105:155)+hash(i,seed)*135,x=Math.cos(angle)*r,z=Math.sin(angle)*r,y=terrainHeight(x,z),h=wet?4.8+hash(i,8)*4:5+hash(i,8)*5,c=tint(x,z,y,.06).multiplyScalar(.87);
      box(x,y,z,.32,h*.48,.32,c);
      // Three uneven, overlapping volumes break up a single ball-on-a-stick
      // contour. Their shared colour fades into the same atmospheric band.
      for(let clump=0;clump<3;clump++){
        const offset=clump*2.399+i,spread=h*(.16+hash(i,clump,11)*.12),cx=x+Math.cos(offset)*spread,cz=z+Math.sin(offset)*spread,cy=y+h*(.44+hash(i,clump,12)*.17),width=h*(.22+hash(clump,i,13)*.12),tall=h*(wet?.33:.29),colour=c.clone().multiplyScalar(.94+hash(i,clump,15)*.12);
        const crown=(k,row)=>{const theta=k*Math.PI/4,latitude=row*Math.PI/2,irregular=.86+hash(k%8,i,clump)*.25,lean=(row-1)*h*.045;return [cx+Math.cos(theta)*Math.sin(latitude)*width*irregular+lean,cy+Math.cos(latitude)*tall*(.91+hash(row,i,clump)*.14),cz+Math.sin(theta)*Math.sin(latitude)*width*irregular-lean*.7];};
        for(let row=0;row<2;row++)for(let k=0;k<8;k++){
          const a=crown(k,row),b=crown(k+1,row),c1=crown(k,row+1),d=crown(k+1,row+1);triangle(a,c1,b,colour);triangle(b,c1,d,colour);
        }
      }
    }
    group.userData.silhouetteKind=wet?'distant willow wetlands':'wooded ridgelines';
  }else group.userData.silhouetteKind='open eastern escarpments';
  // Three authored bearings establish a middle distance before the far hills.
  // Closed volumes share the distant batch: no billboards or playable cells.
  const landmarkKinds=['frontier watch','marsh watch','road station','marching camp','siege aqueduct','frontier watch','colonnade','river watch','hill sanctuary','farm settlement','urban temple','urban temple'];
  const landmarkKind=landmarkKinds[(profile.chapter??1)-1]??'frontier watch';
  for(let cluster=0;cluster<3;cluster++){
    const angle=-Math.PI/2+cluster*2.08+(profile.chapter%3)*.27,r=(city?195:115)+cluster*28,cx=Math.cos(angle)*r,cz=Math.sin(angle)*r,base=terrainHeight(cx,cz),c=tint(cx,cz,base,.03);
    if(landmarkKind==='siege aqueduct'||landmarkKind==='colonnade'){
      const aqueduct=landmarkKind==='siege aqueduct',count=aqueduct?8:6;
      for(let i=0;i<count;i++){
        const x=cx+(i-(count-1)/2)*3.5,y=terrainHeight(x,cz);
        box(x,y,cz,aqueduct?1.25:.65,base+8-y,1.25,c);
        box(x,base+7.4,cz,3.5,.9,1.55,c);
        if(aqueduct){box(x,base+6.5,cz,2.25,.9,1.3,c);box(x,base+5.9,cz,1.7,.6,1.3,c);}
      }
    }else if(landmarkKind==='urban temple'||landmarkKind==='hill sanctuary'){
      box(cx,base,cz,18,1.4,11,c);
      for(const side of [-1,1])for(let i=0;i<6;i++)box(cx+(i-2.5)*2.8,base+1.4,cz+side*4.6,.7,7,.7,c);
      box(cx,base+8.4,cz,19,1.1,12,c);
      const roof=c.clone().multiplyScalar(.88);
      for(const side of [-1,1])triangle([cx-9.5,base+9.5,cz+side*6],[cx+9.5,base+9.5,cz+side*6],[cx,base+13,cz+side*6],roof);
      triangle([cx-9.5,base+9.5,cz-6],[cx,base+13,cz-6],[cx,base+13,cz+6],roof);triangle([cx-9.5,base+9.5,cz-6],[cx,base+13,cz+6],[cx-9.5,base+9.5,cz+6],roof);
      triangle([cx+9.5,base+9.5,cz-6],[cx+9.5,base+9.5,cz+6],[cx,base+13,cz+6],roof);triangle([cx+9.5,base+9.5,cz-6],[cx,base+13,cz+6],[cx,base+13,cz-6],roof);
    }else if(landmarkKind==='farm settlement'||landmarkKind==='marching camp'){
      for(let i=0;i<7;i++){const x=cx+(i%4)*6,z=cz+Math.floor(i/4)*9,y=terrainHeight(x,z);box(x,y,z,4,landmarkKind==='marching camp'?2.5:4.5,5,c);}
    }else{
      box(cx,base,cz,5.8,8.5,5.8,c);box(cx,base+8.5,cz,6.4,.7,6.4,c);
      for(const side of [-1,1])for(let i=0;i<3;i++)box(cx+(i-1)*2,base+9.2,cz+side*2.7,.9,1.1,1,c);
      box(cx+11,terrainHeight(cx+11,cz),cz,12,2.3,1.3,c);
    }
  }
  if(silhouettePositions.length){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(silhouettePositions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(silhouetteColors,3));geometry.computeVertexNormals();addMesh('regional distant silhouettes',geometry,distant);}
  let triangles=0;group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  const stats=Object.freeze({meshes:group.children.length,triangles,innerEdgeSamples:size,outerRadius:550,region:profile.setting,silhouetteKind:group.userData.silhouetteKind,landmarkKind,landmarkBearings:3});
  group.userData.horizonStats=stats;
  const cameraRay=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,2000),cameraHits=[],cameraSurfaces=[bridge,ridges];
  let lastCameraX=NaN,lastCameraZ=NaN,lastCameraHeight=0;
  function cameraGroundHeight(x,z){
    // Camera clearance samples rendered triangles, not the higher-resolution
    // procedural function: the coarse ridges interpolate a different surface.
    // This never participates in gameplay elevation or board picking.
    if(disposed||Math.max(Math.abs(x),Math.abs(z))<=40||Math.hypot(x,z)>550)return height(x,z);
    if(x===lastCameraX&&z===lastCameraZ)return lastCameraHeight;
    for(const mesh of cameraSurfaces)mesh.updateWorldMatrix(true,false);
    cameraRay.ray.origin.set(x,1000,z);cameraHits.length=0;
    cameraRay.intersectObjects(cameraSurfaces,false,cameraHits);
    lastCameraX=x;lastCameraZ=z;lastCameraHeight=cameraHits.length?cameraHits[0].point.y:height(x,z);
    cameraHits.length=0;return lastCameraHeight;
  }
  return {group,bridge,ridges,stats,cameraGroundHeight,
    update(time){if(disposed||!waterGeometry||!Number.isFinite(time))return;const p=waterGeometry.attributes.position;for(const {index,x,localZ} of riverEdges)p.setY(index,-1.24+.023*Math.sin(x*.64+time*.9)+.017*Math.sin(localZ*1.7+x*.17-time*.55));p.needsUpdate=true;},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();}};
}
