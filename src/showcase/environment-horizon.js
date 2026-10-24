import * as T from '../../vendor/three/three.module.js';
import {hash,noise,smooth,clamp} from './environment-layout.js';

// The woods' budget: crowns per quality, each an icosahedron of 20 triangles.
export const FOREST_CROWNS=Object.freeze({performance:320,balanced:700,high:1100});
// Lone trees stand between the woods at this fraction of a wood's density.
const LONE_TREES=.05;
const FOLIAGE={wetland:'#4f5f45',italy:'#3e4f33'};
// A unit icosahedron's triangles, and each corner's direction (its own position).
const CROWN=new T.IcosahedronGeometry(1,0).attributes.position.array;
// Which of its twelve corners each of the 60 is, so a corner shared by five faces moves as one.
const CORNER=(()=>{const seen=new Map();return Array.from({length:CROWN.length/3},(_,i)=>{const key=[0,1,2].map(c=>CROWN[i*3+c].toFixed(4)).join();if(!seen.has(key))seen.set(key,seen.size);return seen.get(key);});})();
// Crowns in a clump: from five to eight, so a wood's outline is a canopy, not a few balls.
const MEMBERS=[5,8];
/**
 * The ridges' trees: woods where a broad noise allows, and lone trees between
 * them, in clumps of five to eight overlapping crowns on points of the
 * ridges' own triangles, from 160 m out (clear of the board, its scenery and
 * the landmark clusters) and off the river. Presentation only: hash, never
 * the game's random draws.
 */
export function forestStandIns({ridges,profile,quality='balanced',share,haze,seed,wet=false,riverCentre=null,riverWidth=null,clear=[]}){
  const pos=ridges.geometry.attributes.position,index=ridges.geometry.index.array,limit=FOREST_CROWNS[quality]??FOREST_CROWNS.balanced;
  const A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3(),wood=(x,z)=>noise(x*.009,z*.009,seed+21)>1-share;
  const open=(x,z)=>{const d=Math.hypot(x,z);if(d<160||d>535)return false;
    if(riverCentre&&Math.abs(z-riverCentre(x))<riverWidth(x)+14)return false;return clear.every(([cx,cz])=>Math.hypot(x-cx,z-cz)>34);};
  const weight=(x,z)=>open(x,z)?(wood(x,z)?1:LONE_TREES):0;
  // First the wooded area, then clumps in proportion to it: an even wood whatever the budget.
  const area=t=>{A.fromBufferAttribute(pos,index[t]);B.fromBufferAttribute(pos,index[t+1]);C.fromBufferAttribute(pos,index[t+2]);return B.sub(A).cross(C.sub(A)).length()/2;};
  const centre=t=>[(pos.getX(index[t])+pos.getX(index[t+1])+pos.getX(index[t+2]))/3,(pos.getZ(index[t])+pos.getZ(index[t+1])+pos.getZ(index[t+2]))/3];
  let wooded=0;for(let t=0;t<index.length;t+=3)wooded+=area(t)*weight(...centre(t));
  if(wooded<1)return null;
  const density=limit/((MEMBERS[0]+MEMBERS[1])/2)/wooded,sun=new T.Vector3(...(profile.sunPosition??[-16,24,-12])).setY(0).normalize(),positions=[],colors=[];
  const foliage=new T.Color(FOLIAGE[profile.setting]??(wet?FOLIAGE.wetland:'#34492c'));let crowns=0;
  const surface=(t,u,v)=>{A.fromBufferAttribute(pos,index[t]);B.fromBufferAttribute(pos,index[t+1]);C.fromBufferAttribute(pos,index[t+2]);
    return [A.x+(B.x-A.x)*u+(C.x-A.x)*v,A.y+(B.y-A.y)*u+(C.y-A.y)*v,A.z+(B.z-A.z)*u+(C.z-A.z)*v];};
  for(let t=0;t<index.length&&crowns<limit;t+=3){
    const w=weight(...centre(t));if(!w)continue;
    const expected=area(t)*density*w,n=Math.floor(expected)+(hash(t,seed,7)<expected%1?1:0);
    for(let k=0;k<n&&crowns<limit;k++){
      let u=hash(t,k,seed+3),v=hash(k,t,seed+5);if(u+v>1){u=1-u;v=1-v;}
      const [cx,,cz]=surface(t,u,v);if(!open(cx,cz))continue;
      const size=(wet?4.5:6)+hash(cx,cz,seed+9)*(wet?2.5:3),members=MEMBERS[0]+Math.floor(hash(cz,cx,seed+15)*(MEMBERS[1]-MEMBERS[0]+1));
      for(let m=0;m<members&&crowns<limit;m++){
        // Each crown of the clump on a point of this or the next quads round the ring, so it stands on the ridge exactly.
        const tri=Math.min(t+3*m,index.length-3);let mu=hash(tri,m,seed+17),mv=hash(m,tri,seed+19);if(mu+mv>1){mu=1-mu;mv=1-mv;}
        const [x,y,z]=surface(tri,mu,mv);if(!open(x,z))continue;
        // Sunk a little, so no crown shows daylight under it on a slope.
        const wide=size*(wet?.62:.5)*(.8+hash(x,z,seed+11)*.4),tall=size*(.65+hash(z,x,seed+12)*.3),distance=Math.hypot(x,z),foot=y-.5;
        // Darker below and away from the sun. Only a trace of haze: the blend is in linear
        // light, where a little of a pale haze outweighs a dark green, and the fog does the rest.
        const base=foliage.clone().multiplyScalar(.75+hash(x,z,seed+13)*.4).lerp(haze,clamp(.015+smooth((distance-60)/490)*.07));
        // Each corner in or out a little, so no crown shows a regular outline; the foot stays.
        for(let i=0;i<CROWN.length;i+=3){
          const dx=CROWN[i],dy=CROWN[i+1],dz=CROWN[i+2],lump=.76+hash(crowns,CORNER[i/3],seed+23)*.48;
          positions.push(x+dx*wide*lump,foot+tall*(.42+dy*.5*(dy>0?lump:1)),z+dz*wide*lump);
          const light=.62+(dy+1)*.2+Math.max(0,dx*sun.x+dz*sun.z)*.14;colors.push(base.r*light,base.g*light,base.b*light);
        }
        crowns++;
      }
    }
  }
  if(!crowns)return null;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
  return {geometry,crowns};
}

// A finite, 360-degree landscape around the authoritative 80m ground. Only the
// inner edge samples gameplay height; this mesh never becomes picking terrain.
export function createEnvironmentHorizon({ground,profile,height,quality='balanced',innerRadius=40,waterMaterial=null,riverZ=-29}){
  const group=new T.Group();group.name='regional distant landscape';group.userData.environmentHorizon=true;
  const geometries=new Set(),materials=new Set(),edges=[],segments=ground.geometry.parameters.widthSegments;
  const arid=profile.vegetation==='arid',wet=profile.setting==='wetland',city=['palmyra','rome','accession'].includes(profile.setting);
  const haze=new T.Color(profile.fog),land=new T.Color(arid?'#9c8b6a':wet?'#657461':'#68765d'),seed=profile.chapter*17;
  const rows=[innerRadius,innerRadius+8,innerRadius+24,Math.max(100,innerRadius+60),Math.max(155,innerRadius+110),Math.max(235,innerRadius+180),Math.max(355,innerRadius+280),550],size=segments*4,riverJoin=62.5;
  let waterGeometry=null;
  let disposed=false;
  for(let edge=0;edge<4;edge++)for(let i=0;i<segments;i++){
    const t=i/segments*2-1;edges.push(edge===0?[t,-1]:edge===1?[1,t]:edge===2?[-t,1]:[-1,-t]);
  }
  function riverCentre(x){const d=Math.max(0,Math.abs(x)-riverJoin);return riverZ+Math.sin(d*.011)*d*.075;}
  function riverWidth(x){return 8+smooth((Math.abs(x)-riverJoin)/320)*13;}
  function terrainHeight(x,z){
    const edge=Math.max(Math.abs(x),Math.abs(z)),distance=Math.hypot(x,z),blend=smooth((edge-innerRadius)/65),amplitude=city?12:wet?9:arid?20:22;
    const broad=noise(x*.009,z*.009,seed),spine=Math.pow(noise(x*.021,z*.021,seed+4),1.35),distant=smooth((distance-80)/290);
    // The relief settles from 120 m on, so the region's panorama, not a bowl of
    // near ridges, makes the skyline; a quarter of it remains at the edge.
    const settle=1-smooth((distance-120)/330)*.75;
    let y=height(x,z)+blend*((broad-.20)*amplitude*(.34+distant*.72)+spine*amplitude*.43)*settle;
    if(profile.distantWater&&Math.abs(x)>40){const channel=1-smooth((Math.abs(z-riverCentre(x))-riverWidth(x))/(10+Math.abs(x)*.015));y=y*(1-channel)+Math.min(y,-2.05)*channel;}
    return y;
  }
  function point(q,r){const length=Math.hypot(...q),round=smooth((r-innerRadius)/140);return [q[0]*r*(1-round)+q[0]/length*r*round,q[1]*r*(1-round)+q[1]/length*r*round];}
  function tint(x,z,y,extra=0){const distance=Math.hypot(x,z),variation=(noise(x*.05,z*.05,seed+2)-.5)*.12,c=land.clone().multiplyScalar(.93+variation+y*.0014);return c.lerp(haze,clamp(.32+smooth((distance-60)/490)*.60+extra));}
  function addMesh(name,geometry,material){geometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.environmentHorizon=true;group.add(mesh);return mesh;}
  function ring(from,to,material,near=false){
    const positions=[],colors=[],uv=[],soil=[],indices=[];
    for(let row=from;row<=to;row++)for(let i=0;i<size;i++){
      const [x,z]=point(edges[i],rows[row]),y=terrainHeight(x,z);positions.push(x,y,z);uv.push((x+40)/2,(40-z)/2);
      if(near){
        // Identical inputs to the original ground shader at the shared edge.
        const patch=noise(x*.23,z*.23,8),damp=smooth((riverZ-z+12)/4)*(1-smooth((riverZ-z-11)/5)),edge=.93+noise(x*.06,z*.06,2)*.07;
        colors.push((.91+patch*.09)*edge*(1-damp*.2),(.94+patch*.06)*edge*(1-damp*.13),(.88+patch*.09)*edge*(1-damp*.12));
        soil.push(clamp((profile.training?.12:profile.soilMix)+(profile.training?0:Math.pow(noise(x*.19,z*.19,31),2)*.48)+damp*.42));
      }else colors.push(...tint(x,z,y).toArray());
      if(row<to){const a=(row-from)*size+i,b=(row-from)*size+(i+1)%size,c=a+size,d=b+size;indices.push(a,b,c,b,d,c);}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(near)geometry.setAttribute('soilMix',new T.Float32BufferAttribute(soil,1));geometry.setIndex(indices);geometry.computeVertexNormals();
    if(near&&from===0){
      // Preserve the fine ground's edge normals too: a coarser outer ring must
      // not create a lighting seam where its first vertices meet that ground.
      // Copy all boundary shader inputs. Expanded real-time ground may have a
      // road verge or a plateau near this join; recomputing only a generic soil
      // mix created an obvious square material edge around those maps.
      for(let i=0;i<size;i++){const edge=Math.floor(i/segments),j=i%segments,k=edge===0?j:edge===1?j*(segments+1)+segments:edge===2?segments*(segments+1)+segments-j:(segments-j)*(segments+1);
        for(const name of ['position','normal','color','uv','soilMix']){const source=ground.geometry.attributes[name],target=geometry.attributes[name];
          if(source&&target)for(let c=0;c<source.itemSize;c++)target.array[i*target.itemSize+c]=source.array[k*source.itemSize+c];}}
    }
    geometry.computeBoundingSphere();
    const mesh=addMesh(near?'continuous outer ground bridge':'360 degree regional ridges',geometry,material);mesh.userData.innerRadius=rows[from];mesh.userData.outerRadius=rows[to];return mesh;
  }
  // Ground, water and silhouettes share scene fog. Keeping silhouettes outside
  // that fog left towers and wall strips visible after their support vanished.
  const distant=new T.MeshBasicMaterial({vertexColors:true,fog:true});materials.add(distant);
  const bridge=ring(0,2,ground.material,true),ridges=ring(2,rows.length-1,ground.material,true);
  ridges.name='360 degree regional ridges';
  // Keep texture, roughness, lighting and normals continuous at the second
  // join too. A flat unlit colour here used to outline the entire play area.
  for(const name of ['position','normal','color','uv','soilMix']){
    const a=bridge.geometry.attributes[name],b=ridges.geometry.attributes[name];
    for(let i=0;i<size;i++)for(let c=0;c<a.itemSize;c++)b.array[i*a.itemSize+c]=a.array[(a.count-size+i)*a.itemSize+c];
  }

  const cameraRay=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,2000),cameraHits=[],cameraSurfaces=[bridge,ridges];
  for(const mesh of cameraSurfaces)mesh.updateWorldMatrix(true,false);
  function renderedGroundHeight(x,z){
    cameraRay.ray.origin.set(x,1000,z);cameraHits.length=0;
    cameraRay.intersectObjects(cameraSurfaces,false,cameraHits);
    const result=cameraHits.length?cameraHits[0].point.y:height(x,z);cameraHits.length=0;return result;
  }
  const foundations=[];
  function foundation(x,z,w,d){
    // The analytical noise function does not equal the coarse rendered mesh
    // between its rings. Sample the visible triangles at the entire footprint
    // and bury the bottom slightly, instead of leaving a roofline in mid-air.
    const y=Math.min(...[[x,z],[x-w/2,z-d/2],[x+w/2,z-d/2],[x-w/2,z+d/2],[x+w/2,z+d/2]].map(([px,pz])=>renderedGroundHeight(px,pz)))-.04;
    foundations.push({x,z,width:w,depth:d,base:y,firstVertex:silhouettePositions.length/3});return y;
  }

  if(profile.distantWater){
    const positions=[],colors=[],indices=[],steps=50;
    for(const side of [-1,1]){
      const offsets=[];
      for(let i=0;i<=steps;i++){
        const x=side*(riverJoin+i/steps*(510-riverJoin)),z=riverCentre(x),w=riverWidth(x),c=new T.Color(profile.waterColor).multiplyScalar(.9).lerp(haze,.35+smooth(i/steps)*.6),samples=i===0?13:2;
        offsets.push(positions.length/3);
        for(let j=0;j<samples;j++){
          // Match all thirteen vertices along the near river's edge.
          // The following row reduces to two points: only 22 extra triangles
          // are needed for the complete join, not a dense distant water mesh.
          const localZ=i===0?Math.fround(-8+j*16/12):-w+j*w*2;
          positions.push(x,-1.24,z+localZ);colors.push(...c.toArray());
        }
      }
      const face=(a,b,c)=>indices.push(...(side===1?[a,b,c]:[a,c,b]));
      for(let i=0;i<steps;i++){
        const a=offsets[i],b=offsets[i+1],samples=i===0?13:2;
        for(let j=0;j<samples-1;j++)face(a+j,a+j+1,b);
        face(a+samples-1,b+1,b);
      }
    }
    waterGeometry=new T.BufferGeometry();waterGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));waterGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));waterGeometry.setIndex(indices);waterGeometry.computeVertexNormals();addMesh('distant meandering Danube',waterGeometry,waterMaterial??distant);
  }

  const silhouettePositions=[],silhouetteColors=[];
  const triangle=(a,b,c,color)=>{silhouettePositions.push(...a,...c,...b);for(let i=0;i<3;i++)silhouetteColors.push(...color.toArray());};
  function box(x,y,z,w,h,d,color){
    const p=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2,y+b*h,z+c*d/2]);
    for(const [face,[a,b,c,d]]of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].entries()){const shade=color.clone().multiplyScalar([.94,1.02,.88,.98,1.05][face]);triangle(p[a],p[b],p[c],shade);triangle(p[a],p[c],p[d],shade);}
  }
  if(city){
    for(let i=0;i<(quality==='performance'?45:70);i++){
      const angle=i*2.39996,r=190+hash(i,seed)*175,x=Math.cos(angle)*r,z=Math.sin(angle)*r,w=5+hash(i,31)*11,d=5+hash(i,33)*9,y=foundation(x,z,w,d),h=3+hash(i,32)*(profile.setting==='palmyra'?5:7),c=tint(x,z,y,.05);
      box(x,y,z,w,h,d,c);const roof=tint(x,z,y).multiplyScalar(.86),a=[x-w*.55,y+h,z-d*.55],b=[x+w*.55,y+h,z-d*.55],c1=[x+w*.55,y+h,z+d*.55],d1=[x-w*.55,y+h,z+d*.55],top1=[x,y+h+2,z-d*.55],top2=[x,y+h+2,z+d*.55];
      triangle(a,b,top1,roof);triangle(d1,top2,c1,roof);triangle(a,top1,top2,roof);triangle(a,top2,d1,roof);triangle(b,c1,top2,roof);triangle(b,top2,top1,roof);
    }
    group.userData.silhouetteKind=profile.setting==='palmyra'?'Palmyrene rooflines':'Roman urban rooflines';
  }else if(!arid){
    // Trees stand on the ridges as the woods below (forestStandIns).
    group.userData.silhouetteKind=wet?'distant willow wetlands':'wooded ridgelines';
  }else group.userData.silhouetteKind='open eastern escarpments';
  // Three authored bearings establish a middle distance before the far hills.
  // Closed volumes share the distant batch: no billboards or playable cells.
  const landmarkKinds=['frontier watch','marsh watch','road station','marching camp','siege aqueduct','frontier watch','colonnade','river watch','hill sanctuary','farm settlement','urban temple','urban temple'];
  const landmarkKind=landmarkKinds[(profile.chapter??1)-1]??'frontier watch';
  for(let cluster=0;cluster<3;cluster++){
    const angle=-Math.PI/2+cluster*2.08+(profile.chapter%3)*.27,r=(city?195:115)+cluster*28,cx=Math.cos(angle)*r,cz=Math.sin(angle)*r,temple=landmarkKind==='urban temple'||landmarkKind==='hill sanctuary',base=temple?foundation(cx,cz,18,11):renderedGroundHeight(cx,cz)-.04,c=tint(cx,cz,base,.03);
    if(landmarkKind==='siege aqueduct'||landmarkKind==='colonnade'){
      const aqueduct=landmarkKind==='siege aqueduct',count=aqueduct?8:6;
      for(let i=0;i<count;i++){
        const x=cx+(i-(count-1)/2)*3.5,y=foundation(x,cz,aqueduct?1.25:.65,1.25);
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
      for(let i=0;i<7;i++){const x=cx+(i%4)*6,z=cz+Math.floor(i/4)*9,y=foundation(x,z,4,5);box(x,y,z,4,landmarkKind==='marching camp'?2.5:4.5,5,c);}
    }else{
      const floor=foundation(cx,cz,5.8,5.8);
      box(cx,floor,cz,5.8,8.5,5.8,c);box(cx,floor+8.5,cz,6.4,.7,6.4,c);
      for(const side of [-1,1])for(let i=0;i<3;i++)box(cx+(i-1)*2,floor+9.2,cz+side*2.7,.9,1.1,1,c);
      box(cx+11,foundation(cx+11,cz,12,1.3),cz,12,2.3,1.3,c);
    }
  }
  if(silhouettePositions.length){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(silhouettePositions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(silhouetteColors,3));geometry.computeVertexNormals();addMesh('regional distant silhouettes',geometry,distant);}
  group.userData.distantFoundations=foundations;
  let triangles=0;group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  // Forest stand-ins: woods of low crowns on the ridges, where a broad noise
  // says wood, so the trees by the board run on into the panorama's forests.
  // Each stands on a point of the ridges' own triangles, from 150 m out (clear
  // of the board, its scenery and the landmark clusters) and off the river.
  // Their light is in their colours, in the same unlit batch as the silhouettes.
  const forestShare=city||arid?0:{frontier:.5,fortress:.5,crossing:.5,wetland:.42,station:.36,province:.34,italy:.22}[profile.setting]??.3;
  const forest=forestShare?forestStandIns({ridges,profile,quality,share:forestShare,haze,seed,wet,riverCentre:profile.distantWater?riverCentre:null,riverWidth,
    clear:Array.from({length:3},(_,cluster)=>{const angle=-Math.PI/2+cluster*2.08+(profile.chapter%3)*.27,r=115+cluster*28;return [Math.cos(angle)*r,Math.sin(angle)*r];})}):null;
  if(forest){geometries.add(forest.geometry);addMesh('distant forest stand-ins',forest.geometry,distant);}
  const stats=Object.freeze({meshes:group.children.length,triangles,innerEdgeSamples:size,innerRadius,outerRadius:550,region:profile.setting,silhouetteKind:group.userData.silhouetteKind,landmarkKind,landmarkBearings:3,
    forestCrowns:forest?.crowns??0,forestTriangles:forest?forest.geometry.attributes.position.count/3:0});
  group.userData.horizonStats=stats;
  let lastCameraX=NaN,lastCameraZ=NaN,lastCameraHeight=0;
  function cameraGroundHeight(x,z){
    // Camera clearance samples rendered triangles, not the higher-resolution
    // procedural function: the coarse ridges interpolate a different surface.
    // This never participates in gameplay elevation or board picking.
    if(disposed||Math.max(Math.abs(x),Math.abs(z))<=innerRadius||Math.hypot(x,z)>550)return height(x,z);
    if(x===lastCameraX&&z===lastCameraZ)return lastCameraHeight;
    for(const mesh of cameraSurfaces)mesh.updateWorldMatrix(true,false);
    lastCameraX=x;lastCameraZ=z;lastCameraHeight=renderedGroundHeight(x,z);return lastCameraHeight;
  }
  return {group,bridge,ridges,stats,cameraGroundHeight,
    // The water's waves move in its shader (world position), joined with the near river's.
    update(){},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();}};
}
