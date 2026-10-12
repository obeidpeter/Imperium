import * as THREE from '../../vendor/three/three.module.js';
import {createEnvironmentMaterials} from './environment-materials.js';
import {createPropFactory} from './environment-props.js';
import {TILE_SIZE,hash,noise,smooth,clamp,gridToWorld,terrainAt,worldToGrid,createGroundHeight,roadSegments,isPlayable} from './environment-layout.js';
export {gridToWorld} from './environment-layout.js';

/** Self-contained 3D presentation. The supplied encounter is never modified.
 * time is elapsed seconds; repeated updates cannot advance simulation state. */
export function createEnvironment(scene,encounter,{tileSize=TILE_SIZE,quality='balanced',loadTextures=true}={}){
  if(!scene?.add||!Number.isInteger(encounter?.width)||!Number.isInteger(encounter?.height)||!Number.isFinite(tileSize)||tileSize<=0)throw new TypeError('Environment requires a scene, legal terrain and a positive tile size.');
  const root=new THREE.Group();root.name='Danube frontier environment';scene.add(root);
  const geometries=new Set(),extraMaterials=new Set(),animated=[];let disposed=false;
  const library=createEnvironmentMaterials({loadTextures}),m=library.materials,p=createPropFactory(m,geometries),height=createGroundHeight(encounter,tileSize);
  const terrainSnapshot=encounter.terrain.map(row=>row.map(t=>typeof t==='string'?t:{...t}));
  const e={width:encounter.width,height:encounter.height,terrain:terrainSnapshot};
  const perf=quality==='performance',high=quality==='high',halfX=e.width*tileSize/2,halfZ=e.height*tileSize/2;
  const ownMaterial=material=>{extraMaterials.add(material);return material;};
  const wind={value:0};
  if(!perf)for(const material of [m.grass,m.leaves]){
    material.onBeforeCompile=shader=>{shader.uniforms.environmentWind=wind;shader.vertexShader='uniform float environmentWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        float phase = environmentWind * 1.15 + instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        transformed.x += sin(phase) * position.y * position.y * 0.09;
        transformed.z += cos(phase * 0.79) * position.y * 0.035;
      #endif`);};
    material.customProgramCacheKey=()=>`frontier-foliage-wind-v1`;
  }
  const rows=perf?120:high?200:160,groundGeometry=p.geo(new THREE.PlaneGeometry(80,80,rows,rows));groundGeometry.rotateX(-Math.PI/2);
  const pos=groundGeometry.attributes.position,colors=[];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,height(x,z));
    const patch=noise(x*.23,z*.23,8),damp=smooth((-z-17)/4)*(1-smooth((-z-40)/5)),edge=.93+noise(x*.06,z*.06,2)*.07;
    colors.push((.91+patch*.09)*edge*(1-damp*.2),(.94+patch*.06)*edge*(1-damp*.13),(.88+patch*.09)*edge*(1-damp*.12));
  }
  groundGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const groundUV=groundGeometry.attributes.uv;for(let i=0;i<groundUV.count;i++)groundUV.setXY(i,groundUV.getX(i)*40,groundUV.getY(i)*40);
  groundGeometry.computeVertexNormals();const ground=p.mesh(root,groundGeometry,m.ground);ground.name='continuous ground';ground.castShadow=false;ground.userData.environmentGround=true;

  const roads=roadSegments(e,tileSize),roadVertices=[],roadUV=[],roadColors=[],roadIndices=[];
  const roadDistance=(x,z)=>roads.reduce((nearest,[a,b])=>{const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz));return Math.min(nearest,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));},Infinity);
  // A single distance-field surface follows the authored road, with rounded
  // joins and a feathered verge. No tile-sized quads or overlapping junctions.
  if(roads.length){const points=roads.flat(),step=tileSize/10,pad=tileSize*.66,minX=Math.min(...points.map(v=>v.x))-pad,minZ=Math.min(...points.map(v=>v.z))-pad,nx=Math.ceil((Math.max(...points.map(v=>v.x))+pad-minX)/step),nz=Math.ceil((Math.max(...points.map(v=>v.z))+pad-minZ)/step);
    for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
      const x=minX+ix*step,z=minZ+iz*step,d=roadDistance(x,z),edge=(noise(x*1.3,z*1.3,17)-.5)*.20,alpha=1-smooth((d+edge-tileSize*.25)/(tileSize*.34));
      roadVertices.push(x,height(x,z)+.021,z);roadUV.push(x*.55,z*.55);roadColors.push(1,1,1,alpha*.97);
      if(ix<nx&&iz<nz){const j=iz*(nx+1)+ix;roadIndices.push(j,j+nx+1,j+1,j+1,j+nx+1,j+nx+2);}
    }
  }
  const roadGeometry=p.geo(new THREE.BufferGeometry());roadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roadVertices,3));roadGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(roadUV,2));roadGeometry.setAttribute('color',new THREE.Float32BufferAttribute(roadColors,4));roadGeometry.setIndex(roadIndices);roadGeometry.computeVertexNormals();
  const road=p.mesh(root,roadGeometry,m.road);road.name='authored boundary road';road.castShadow=false;

  // Shared instance batches keep structural detail from becoming thousands of
  // independent draw calls. Matrices use real solid geometry and cast shadows.
  const batches=new Map(),dummy=new THREE.Object3D();
  function instance(key,g,material,position,scale,rotation=[0,0,0],color=null){if(!batches.has(key))batches.set(key,{geometry:g,material,items:[]});batches.get(key).items.push({position,scale,rotation,color});}
  function branch(a,b,r,key='timber',material=m.wood){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),mid=av.clone().add(bv).multiplyScalar(.5),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.clone().sub(av).normalize()),rot=new THREE.Euler().setFromQuaternion(q);instance(key,p.cylinder,material,mid.toArray(),[r,av.distanceTo(bv),r],[rot.x,rot.y,rot.z]);}
  const rockGeometry=p.geo(new THREE.IcosahedronGeometry(1,2));
  const rockPos=rockGeometry.attributes.position;
  for(let i=0;i<rockPos.count;i++){const x=rockPos.getX(i),y=rockPos.getY(i),z=rockPos.getZ(i),k=.83+noise(x*3+5,z*3+2,y*3)*.3;rockPos.setXYZ(i,x*k,y*(.85+hash(x,z,y)*.12),z*k);}rockGeometry.computeVertexNormals();
  function boulder(x,z,scale=1,seed=0){instance('limestone',rockGeometry,m.stone,[x,height(x,z)+scale*.32,z],[scale,scale*.72,scale*.83],[.1*hash(x,z),seed*.7,.1*hash(z,x)],new THREE.Color().setRGB(.72+hash(x,z)*.24,.74+hash(z,x)*.2,.68+hash(x,z,3)*.2));}
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(['rock','rubble','wall'].includes(terrainAt(e,x,y))){const point=gridToWorld({x,y},e,tileSize);boulder(point.x,point.z,tileSize*.43,x+y);for(let k=0;k<3;k++)boulder(point.x+(hash(k,x,y)-.5)*tileSize*.78,point.z+(hash(y,k,x)-.5)*tileSize*.78,tileSize*(.15+hash(k,y)*.16),k);}
  for(let i=0;i<45;i++){const x=(hash(i,1)-.5)*67,z=(hash(i,2)-.5)*58;if(isPlayable(x,z,e,tileSize,3)||z< -19&&z> -41)continue;boulder(x,z,.35+hash(i,3)*1.15,i);}

  // The gate meets the real west-edge road. Its walls and camp are outside the
  // playable rectangle; nothing here becomes an invented pathfinding blocker.
  const edgeRoad=roads.find(([a,b])=>a.x< -halfX&&b.x>=-halfX),gateZ=edgeRoad?.[1].z??-tileSize*1.5,fortX=-halfX-3.1,gateWidth=4.8;
  const pointed=p.geo(new THREE.ConeGeometry(1,1,12));
  for(let z=-22;z<=18;z+=.46){if(Math.abs(z-gateZ)<gateWidth/2)continue;const y=height(fortX,z),h=3.1+hash(z,fortX)*.32;
    instance('stockade posts',p.cylinder,m.wood,[fortX,y+h/2,z],[.235,h,.235],[0,hash(z)*.2,0]);instance('stockade points',pointed,m.wood,[fortX,y+h+.31,z],[.235,.62,.235]);
  }
  for(const y of [1.0,2.45])for(const [za,zb]of [[-22,gateZ-gateWidth/2],[gateZ+gateWidth/2,18]])branch([fortX-.23,y,za],[fortX-.23,y,zb],.14,'cross rails',m.darkWood);
  for(const side of [-1,1]){
    const zz=gateZ+side*(gateWidth/2+.75),base=height(fortX,zz);
    for(const xx of [fortX-.85,fortX+.6])for(const dz of [-.75,.75])branch([xx,base,zz+dz],[xx,base+5.05,zz+dz],.17);
    for(let j=0;j<11;j++)instance('watch platform',p.box,m.wood,[fortX-.15,base+3.57,zz+(j-5)*.18],[2.25,.13,.17]);
    for(const xx of [fortX-1.2,fortX+.9]){branch([xx,base+4.6,zz-1],[xx,base+4.6,zz+1],.075);for(const dz of [-1,-.35,.35,1])branch([xx,base+3.6,zz+dz],[xx,base+4.65,zz+dz],.065);}
    branch([fortX+.65,base+.15,zz-.7],[fortX+.65,base+3.45,zz+.7],.095);
  }
  for(const yy of [3.5,4.15])branch([fortX,yy,gateZ-gateWidth/2-.5],[fortX,yy,gateZ+gateWidth/2+.5],.21,'gate lintels',m.darkWood);
  for(let i=0;i<12;i++)instance('gate walkway',p.box,m.wood,[fortX-.15,3.56,gateZ+(i-5.5)*.43],[1.9,.12,.41]);
  p.banner(root,fortX+.35,height(fortX+.35,gateZ+4),gateZ+4);
  for(const [x,z,s,r]of [[fortX-6,gateZ-7,1.1,.1],[fortX-7,gateZ+5,1.05,-.13],[fortX-13,gateZ+9,.8,.04]]){p.tent(root,x,height(x,z),z,s,r);p.crate(root,x+3,height(x+3,z+1),z+1,.8);p.amphora(root,x+2.7,height(x+2.7,z+2.2),z+2.2,.9);}
  for(let i=0;i<5;i++){const x=fortX-2.3-hash(i,3)*2,z=gateZ+7+hash(i,5)*3;p.amphora(root,x,height(x,z),z,.75+hash(i,7)*.3);}
  const cartX=halfX+3.5,cartZ=3.8;p.wagon(root,cartX,height(cartX,cartZ),cartZ,-.2);

  // Volumetric branches and thousands of individual bent leaves build tree
  // crowns. Leaves are small 3D surfaces, never a whole-tree billboard.
  const leafGeometry=p.geo(new THREE.BufferGeometry());leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.12,.13,.015,0,.32,.05,.12,.13,.015,0,.14,.06],3));leafGeometry.setIndex([0,1,4,1,2,4,2,3,4,3,0,4]);leafGeometry.computeVertexNormals();
  const trees=[[-8,-15,7],[-15,-19,8],[9,-17,7],[17,-12,8],[19,14,7],[-15,15,7],[-6,18,6],[28,-18,9],[-30,-17,9],[33,9,8]];
  for(let t=0;t<trees.length;t++){
    const [x,z,h]=trees[t],base=height(x,z);branch([x,base-.15,z],[x+.18,base+h*.75,z-.1],.28,'oak trunk',m.darkWood);
    for(let k=0;k<8;k++){
      const angle=k*2.399+t,reach=h*(.26+hash(t,k)*.15),cy=base+h*(.55+hash(k,t)*.36),cx=x+Math.cos(angle)*reach,cz=z+Math.sin(angle)*reach;
      branch([x+.12,base+h*(.35+k*.033),z],[cx,cy,cz],.10,'oak bough',m.darkWood);
      const n=perf?38:high?95:70;
      for(let j=0;j<n;j++){const a=hash(j,k,t)*6.283,rr=Math.sqrt(hash(j,t,k))*h*.24,px=cx+Math.cos(a)*rr,pz=cz+Math.sin(a)*rr,py=cy+(hash(t+j,k,9)-.5)*h*.24,scale=.85+hash(j,k,12)*1.25;
        instance('oak leaves',leafGeometry,m.leaves,[px,py,pz],[scale,scale,scale],[hash(j,8)*1.5,hash(j,k)*6.28,hash(j,4)*1.5],new THREE.Color().setRGB(.60+hash(j,k)*.36,.72+hash(k,j)*.23,.47+hash(j,k,4)*.22));}
    }
  }
  // Grasses use crossed, tapered geometry with varying height, not a flat
  // green carpet. Board tufts are shorter and sparser than the framing meadow.
  const blade=p.geo(new THREE.BufferGeometry()),bladeVertices=[],bladeIndices=[];
  for(let k=0;k<5;k++){const angle=k*2.399,dx=Math.cos(angle),dz=Math.sin(angle),h=.65+hash(k,41)*.3,bend=.17+hash(k,44)*.17,start=bladeVertices.length/3;
    for(const [t,width]of [[0,.038],[.38,.028],[.72,.016],[1,0]])for(const side of [-1,1])bladeVertices.push(dx*bend*t*t-dz*width*side,h*t,dz*bend*t*t+dx*width*side);
    for(let j=0;j<3;j++){const n=start+j*2;bladeIndices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }blade.setAttribute('position',new THREE.Float32BufferAttribute(bladeVertices,3));blade.setIndex(bladeIndices);blade.computeVertexNormals();
  const grassCount=perf?2400:high?13000:8500;
  for(let i=0;i<grassCount;i++){
    const x=(hash(i,31)-.5)*65,z=(hash(i,32)-.5)*55;if(z< -18)continue;
    const tile=worldToGrid(x,z,e,tileSize),inside=isPlayable(x,z,e,tileSize),type=inside?terrainAt(e,tile.x,tile.y):'grass';
    const patch=noise(x*.55,z*.55,71);
    if(['rock','wall'].includes(type)||hash(i,9)>patch*.85+(inside?.1:.24)||Math.abs(x-fortX)<1)continue;
    if(roadDistance(x,z)<tileSize*(.34+hash(i,15)*.14))continue;
    const s=inside?.14+hash(i,4)*.15:.23+hash(i,4)*.37;
    instance('meadow grass',blade,m.grass,[x,height(x,z)-.01,z],[s,s,s],[0,hash(i,4)*6.28,0],new THREE.Color().setRGB(.63+hash(i,2)*.36,.68+hash(i,5)*.28,.44+hash(i,1)*.24));
  }
  // Fern fronds are compound leaves along bent stems, kept outside the board.
  for(let i=0;i<(perf?12:30);i++){const x=(hash(i,83)-.5)*42,z=(hash(i,86)-.5)*34;if(isPlayable(x,z,e,tileSize,1))continue;const base=height(x,z);
    for(let f=0;f<5;f++){const angle=f*1.256+i,dx=Math.cos(angle),dz=Math.sin(angle);for(let j=1;j<8;j++)for(const side of [-1,1]){const t=j/8,reach=t*.85,s=.30*(1-t*.8);instance('fern leaves',leafGeometry,m.leaves,[x+dx*reach+dz*side*s*.2,base+Math.sin(t*2.5)*.47,z+dz*reach-dx*side*s*.2],[s*1.6,s*2,s],[.4,angle+side*.9,.4],new THREE.Color(.50,.70,.42));}}
  }
  for(const [name,batch]of batches){
    const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.items.length);mesh.name=name;mesh.castShadow=!['meadow grass','fern leaves'].includes(name)&&!perf;mesh.receiveShadow=true;
    batch.items.forEach((item,i)=>{dummy.position.set(...item.position);dummy.scale.set(...item.scale);dummy.rotation.set(...item.rotation);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(item.color)mesh.setColorAt(i,item.color);});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
  }

  // The Danube occupies a shallow channel beyond the legal map. Subtle real
  // surface waves and rough reflections sit below mist supplied by the scene.
  const riverGeometry=p.geo(new THREE.PlaneGeometry(125,16,perf?70:130,12));riverGeometry.rotateX(-Math.PI/2);
  const river=p.mesh(root,riverGeometry,m.water,0,-1.24,-29);river.name='Danube';river.castShadow=false;river.receiveShadow=true;
  const riverBase=Float32Array.from(riverGeometry.attributes.position.array);
  animated.push(time=>{const a=riverGeometry.attributes.position;for(let i=0;i<a.count;i++){const xx=riverBase[i*3],zz=riverBase[i*3+2];a.setY(i,.023*Math.sin(xx*.64+time*.9)+.017*Math.sin(zz*1.7+xx*.17-time*.55));}a.needsUpdate=true;if(!perf)riverGeometry.computeVertexNormals();});
  for(let layer=0;layer<3;layer++){
    const hillGeometry=p.geo(new THREE.PlaneGeometry(200,55,80,22));hillGeometry.rotateX(-Math.PI/2);const a=hillGeometry.attributes.position;
    for(let i=0;i<a.count;i++){const xx=a.getX(i),zz=a.getZ(i),rise=Math.pow(Math.max(0,Math.sin((xx+layer*31)*.027)),2)*(10+layer*7)+noise(xx*.08,zz*.07,layer+22)*4;a.setY(i,rise+3+layer*1.5);}
    hillGeometry.computeVertexNormals();const material=ownMaterial(new THREE.MeshStandardMaterial({color:[0x63756b,0x75867f,0x94a19a][layer],roughness:1}));const mountain=p.mesh(root,hillGeometry,material,layer*13,0,-63-layer*25);mountain.castShadow=false;mountain.name='distant rolling ridge';
  }
  const flames=[];
  function fire(x,z,scale=1){const y=height(x,z),g=p.group(root,x,y,z);for(let i=0;i<5;i++){const a=i*1.256;p.beam(g,[Math.cos(a)*.47,.09,Math.sin(a)*.47],[-Math.cos(a)*.25,.18,-Math.sin(a)*.25],.065,m.charcoal);}
    for(let k=0;k<3;k++){const mat=ownMaterial(new THREE.MeshBasicMaterial({color:[0xf3a143,0xf5c777,0xbc502c][k],transparent:true,opacity:[.67,.6,.3][k],depthWrite:false,blending:THREE.AdditiveBlending}));const flame=p.mesh(g,p.sphere,mat,(k-1)*.11,.38,0,.12,.5,.12);flame.castShadow=false;flame.receiveShadow=false;flames.push({mesh:flame,seed:k+x,base:.40,scale});}
    if(!perf){const light=new THREE.PointLight(0xe99b53,1.6*scale,6,2);light.position.set(0,.9,0);g.add(light);animated.push(t=>light.intensity=scale*(1.4+Math.sin(t*7+x)*.17+Math.sin(t*11)*.12));}
  }
  fire(fortX-4,gateZ+2.2,.8);fire(cartX,cartZ,1.2);
  // Consolidate repeated solid prop parts after their parent transforms have
  // been composed. Animated flames/water and unique cloth remain independent.
  root.updateMatrixWorld(true);const staticParts=new Map(),inverseRoot=root.matrixWorld.clone().invert();
  root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||extraMaterials.has(o.material)||o===river)return;const key=o.geometry.uuid+':'+o.material.uuid;if(!staticParts.has(key))staticParts.set(key,[]);staticParts.get(key).push(o);});
  for(const parts of staticParts.values())if(parts.length>2){
    const source=parts[0],batch=new THREE.InstancedMesh(source.geometry,source.material,parts.length);batch.name='static prop parts';batch.castShadow=true;batch.receiveShadow=true;
    parts.forEach((o,i)=>{batch.setMatrixAt(i,inverseRoot.clone().multiply(o.matrixWorld));o.parent.remove(o);});batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();root.add(batch);
  }
  let lastTime=-1;
  return {group:root,ground,groundHeight:height,
    update(time=0){if(disposed||!Number.isFinite(time)||time===lastTime)return;lastTime=time;const bounded=time%3600;wind.value=bounded;for(const fn of animated)fn(bounded);for(const f of flames){f.mesh.scale.y=f.base*f.scale*(1+.13*Math.sin(bounded*7+f.seed));f.mesh.position.x=Math.sin(bounded*2.1+f.seed)*.045;}},
    dispose(){if(disposed)return;disposed=true;scene.remove(root);for(const g of geometries)g.dispose();for(const material of extraMaterials)material.dispose();library.dispose();root.clear();},
    stats(){let meshes=0,instances=0;root.traverse(o=>{if(o.isMesh)meshes++;if(o.isInstancedMesh)instances+=o.count;});return {meshes,instances,geometries:geometries.size,quality,disposed};}
  };
}
