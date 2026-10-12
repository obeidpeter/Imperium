import * as THREE from '../../vendor/three/three.module.js';
import {createEnvironmentMaterials} from './environment-materials.js';
import {createPropFactory} from './environment-props.js';
import {getSceneProfile} from './campaign-scene-profile.js';
import {addCampaignTerrain} from './environment-campaign-terrain.js';
import {addCampaignScenery} from './environment-campaign-scenery.js';
import {addEnvironmentDepth} from './environment-depth.js';
import {batchStaticEnvironment} from './environment-batching.js';
import {createEnvironmentHorizon} from './environment-horizon.js';
import {smoothCoincidentNormals} from './environment-primitives.js';
import {TILE_SIZE,hash,noise,smooth,clamp,gridToWorld,terrainAt,worldToGrid,createGroundHeight,roadSegments,isPlayable,isTrainingGround} from './environment-layout.js';
export {gridToWorld} from './environment-layout.js';

/** Self-contained 3D presentation. The supplied encounter is never modified.
 * time is elapsed seconds; repeated updates cannot advance simulation state. */
export function createEnvironment(scene,encounter,{tileSize=TILE_SIZE,quality='balanced',loadTextures=true,chapter}={}){
  if(!scene?.add||!Number.isInteger(encounter?.width)||!Number.isInteger(encounter?.height)||!Number.isFinite(tileSize)||tileSize<=0)throw new TypeError('Environment requires a scene, legal terrain and a positive tile size.');
  const profile=getSceneProfile(encounter,{chapter}),training=isTrainingGround(encounter),root=new THREE.Group();root.name=training?'Fort training yard environment':profile.region+' environment';root.userData.environmentMode=training?'training':profile.setting;root.userData.sceneProfile=profile;scene.add(root);
  const geometries=new Set(),extraMaterials=new Set(),animated=[];let disposed=false;
  const library=createEnvironmentMaterials({loadTextures,profile}),m=library.materials,p=createPropFactory(m,geometries,{quality}),height=createGroundHeight(encounter,tileSize,{profile});
  const terrainSnapshot=encounter.terrain.map(row=>row.map(t=>typeof t==='string'?t:{...t}));
  const e={width:encounter.width,height:encounter.height,terrain:terrainSnapshot};
  const perf=quality==='performance',high=quality==='high',halfX=e.width*tileSize/2,halfZ=e.height*tileSize/2;
  const ownMaterial=material=>{extraMaterials.add(material);return material;};
  const wind={value:0};
  if(!perf)for(const material of [m.grass,m.dryGrass,m.leaves]){
    const previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
    material.onBeforeCompile=shader=>{previousCompile.call(material,shader);shader.uniforms.environmentWind=wind;shader.vertexShader='uniform float environmentWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        float phase = environmentWind * 1.15 + instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        transformed.x += sin(phase) * position.y * position.y * 0.09;
        transformed.z += cos(phase * 0.79) * position.y * 0.035;
      #endif`);};
    material.customProgramCacheKey=()=>`${previousKey}:frontier-foliage-wind-v1`;
  }
  const rows=perf?120:high?200:160,groundGeometry=p.geo(new THREE.PlaneGeometry(80,80,rows,rows));groundGeometry.rotateX(-Math.PI/2);
  const pos=groundGeometry.attributes.position,colors=[],soilWeights=[];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,height(x,z));
    const patch=noise(x*.23,z*.23,8),damp=smooth((-z-17)/4)*(1-smooth((-z-40)/5)),edge=.93+noise(x*.06,z*.06,2)*.07;
    colors.push((.91+patch*.09)*edge*(1-damp*.2),(.94+patch*.06)*edge*(1-damp*.13),(.88+patch*.09)*edge*(1-damp*.12));
    const yard=1-smooth(Math.max(Math.abs(x)-halfX+.8,Math.abs(z)-halfZ+.8)/2.7),wear=training?yard*(.72+patch*.18):Math.pow(noise(x*.19,z*.19,31),2)*.48;
    soilWeights.push(clamp((training?.12:profile.soilMix)+wear+damp*.42));
  }
  groundGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  groundGeometry.setAttribute('soilMix',new THREE.Float32BufferAttribute(soilWeights,1));
  const groundUV=groundGeometry.attributes.uv;for(let i=0;i<groundUV.count;i++)groundUV.setXY(i,groundUV.getX(i)*40,groundUV.getY(i)*40);
  groundGeometry.computeVertexNormals();const ground=p.mesh(root,groundGeometry,m.ground);ground.name='continuous ground';ground.castShadow=false;ground.userData.environmentGround=true;

  const roads=roadSegments(e,tileSize),roadVertices=[],roadUV=[],roadColors=[],roadIndices=[];
  const roadDistance=(x,z)=>roads.reduce((nearest,[a,b])=>{const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz));return Math.min(nearest,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));},Infinity);
  // A single distance-field surface follows the authored road, with rounded
  // joins and a feathered verge. No tile-sized quads or overlapping junctions.
  if(roads.length){const points=roads.flat(),step=tileSize/10,pad=tileSize*.66,minX=Math.min(...points.map(v=>v.x))-pad,minZ=Math.min(...points.map(v=>v.z))-pad,nx=Math.ceil((Math.max(...points.map(v=>v.x))+pad-minX)/step),nz=Math.ceil((Math.max(...points.map(v=>v.z))+pad-minZ)/step);
    for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
      const x=minX+ix*step,z=minZ+iz*step,d=roadDistance(x,z),edge=(noise(x*1.3,z*1.3,17)-.5)*.20,alpha=1-smooth((d+edge-tileSize*.25)/(tileSize*.34));
      const rut=Math.exp(-Math.pow((d-tileSize*.19)/.105,2)),tone=1-rut*.14;
      roadVertices.push(x,height(x,z)+.021,z);roadUV.push(x*.38,z*.38);roadColors.push(tone,tone,tone,alpha*(training?.62:.95));
      if(ix<nx&&iz<nz){const j=iz*(nx+1)+ix;roadIndices.push(j,j+nx+1,j+1,j+1,j+nx+1,j+nx+2);}
    }
  }
  const roadGeometry=p.geo(new THREE.BufferGeometry());roadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roadVertices,3));roadGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(roadUV,2));roadGeometry.setAttribute('color',new THREE.Float32BufferAttribute(roadColors,4));roadGeometry.setIndex(roadIndices);roadGeometry.computeVertexNormals();
  const road=p.mesh(root,roadGeometry,m.road);road.name='authored boundary road';road.castShadow=false;

  // Shared instance batches keep structural detail from becoming thousands of
  // independent draw calls. Matrices use real solid geometry and cast shadows.
  const batches=new Map(),dummy=new THREE.Object3D();
  function instance(key,g,material,position,scale,rotation=[0,0,0],color=null){if(!batches.has(key))batches.set(key,{geometry:g,material,items:[]});batches.get(key).items.push({position,scale,rotation,color});}
  const taperedTimber=p.geo(new THREE.CylinderGeometry(.58,1,1,10));
  function branch(a,b,r,key='timber',material=m.wood){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),mid=av.clone().add(bv).multiplyScalar(.5),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.clone().sub(av).normalize()),rot=new THREE.Euler().setFromQuaternion(q);instance(key,/oak|willow|root buttress/.test(key)?taperedTimber:p.cylinder,material,mid.toArray(),[r,av.distanceTo(bv),r],[rot.x,rot.y,rot.z]);}
  const rockGeometry=p.geo(new THREE.IcosahedronGeometry(1,2));
  const rockPos=rockGeometry.attributes.position;
  for(let i=0;i<rockPos.count;i++){const x=rockPos.getX(i),y=rockPos.getY(i),z=rockPos.getZ(i),k=.83+noise(x*3+5,z*3+2,y*3)*.3;rockPos.setXYZ(i,x*k,y*(.85+hash(x,z,y)*.12),z*k);}smoothCoincidentNormals(rockGeometry);
  function boulder(x,z,scale=1,seed=0){instance('limestone',rockGeometry,m.stone,[x,height(x,z)+scale*.32,z],[scale,scale*.72,scale*.83],[.1*hash(x,z),seed*.7,.1*hash(z,x)],new THREE.Color().setRGB(.72+hash(x,z)*.24,.74+hash(z,x)*.2,.68+hash(x,z,3)*.2));}
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(['rock','rubble'].includes(terrainAt(e,x,y))){const point=gridToWorld({x,y},e,tileSize);boulder(point.x,point.z,tileSize*.43,x+y);for(let k=0;k<3;k++)boulder(point.x+(hash(k,x,y)-.5)*tileSize*.78,point.z+(hash(y,k,x)-.5)*tileSize*.78,tileSize*(.15+hash(k,y)*.16),k);}
  for(let i=0;i<(profile.civic?0:45);i++){const x=(hash(i,1)-.5)*67,z=(hash(i,2)-.5)*58;if(isPlayable(x,z,e,tileSize,3)||z< -19&&z> -41)continue;boulder(x,z,.35+hash(i,3)*1.15,i);}

  // The gate meets the real west-edge road. Its walls and camp are outside the
  // playable rectangle; nothing here becomes an invented pathfinding blocker.
  const edgeRoad=roads.find(([a,b])=>a.x< -halfX&&b.x>=-halfX),gateZ=edgeRoad?.[1].z??-tileSize*1.5,fortX=-halfX-3.1,gateWidth=4.8;
  const cartX=halfX+3.5,cartZ=3.8;
  if(profile.architecture==='fort'){
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
    branch([fortX-.87,base+.15,zz+.7],[fortX-.87,base+3.45,zz-.7],.095);
    p.watchRoof(root,fortX-.15,base+5.82,zz);
    for(const rail of [-.24,.24])branch([fortX-1.7,base,zz+rail],[fortX-.9,base+3.60,zz+rail],.04,'watchtower ladders');
    for(let k=1;k<=10;k++){const t=k/11;branch([fortX-1.7+t*.8,base+t*3.60,zz-.26],[fortX-1.7+t*.8,base+t*3.60,zz+.26],.025,'ladder rungs');}
  }
  for(const yy of [3.5,4.15])branch([fortX,yy,gateZ-gateWidth/2-.5],[fortX,yy,gateZ+gateWidth/2+.5],.21,'gate lintels',m.darkWood);
  for(let i=0;i<12;i++)instance('gate walkway',p.box,m.wood,[fortX-.15,3.56,gateZ+(i-5.5)*.43],[1.9,.12,.41]);
  const standard=p.banner(root,fortX+.35,height(fortX+.35,gateZ+4),gateZ+4);
  if(!perf)standard.traverse(o=>{if(!o.userData.windCloth)return;const a=o.geometry.attributes.position,base=Float32Array.from(a.array);animated.push(t=>{for(let i=0;i<a.count;i++){const weight=(.9-base[i*3+1])/1.8;a.setZ(i,base[i*3+2]+Math.sin(t*1.7+base[i*3]*3.5+weight*2)*.07*weight);}a.needsUpdate=true;o.geometry.computeVertexNormals();});});
  for(const [x,z,s,r]of [[fortX-6,gateZ-7,1.1,.1],[fortX-7,gateZ+5,1.05,-.13],[fortX-13,gateZ+9,.8,.04]]){p.tent(root,x,height(x,z),z,s,r);p.crate(root,x+3,height(x+3,z+1),z+1,.8);p.amphora(root,x+2.7,height(x+2.7,z+2.2),z+2.2,.9);}
  for(let i=0;i<5;i++){const x=fortX-2.3-hash(i,3)*2,z=gateZ+7+hash(i,5)*3;p.amphora(root,x,height(x,z),z,.75+hash(i,7)*.3);}
  const yardProps=[];
  if(training){
    const rack=p.practiceRack(root,halfX+2.3,height(halfX+2.3,3),3,Math.PI/2);yardProps.push(rack);
    for(const x of [-5,0,5])yardProps.push(p.practicePost(root,x,height(x,-halfZ-2.3),-halfZ-2.3));
    for(const x of [-5,0,5])p.crate(root,x,height(x,halfZ+3.1),halfZ+3.1,.7);
    for(let x=-halfX;x<=halfX;x+=2.2){branch([x,height(x,halfZ+1.6),halfZ+1.6],[x,height(x,halfZ+1.6)+.62,halfZ+1.6],.045,'training yard boundary');if(x<halfX-2)branch([x,.49,halfZ+1.6],[x+2.2,.49,halfZ+1.6],.019,'training yard rope',m.rope);}
  }else {const wagon=p.wagon(root,cartX,height(cartX,cartZ),cartZ,-.2);wagon.name='frontier supply wagon';}
  root.userData.trainingProps=yardProps.map(g=>{g.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(g);return {name:g.name,min:b.min.toArray(),max:b.max.toArray()};});
  }
  const campaignContext={root,e,p,m,profile,height,tileSize,quality,instance,branch,animated,ownMaterial};
  addCampaignTerrain(campaignContext);addCampaignScenery(campaignContext);addEnvironmentDepth(campaignContext);

  // Volumetric branches and thousands of individual bent leaves build tree
  // crowns. Leaves are small 3D surfaces, never a whole-tree billboard.
  const leafGeometry=p.geo(new THREE.BufferGeometry()),leafVertices=[],leafIndices=[];
  for(let row=0;row<=5;row++)for(let col=0;col<3;col++){const t=row/5,s=col-1,w=Math.sin(Math.PI*t)*.105;leafVertices.push(s*w,t*.31,.035*t*t+.028*(1-s*s)*Math.sin(Math.PI*t));if(row<5&&col<2){const a=row*3+col;leafIndices.push(a,a+1,a+3,a+1,a+4,a+3);}}
  leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute(leafVertices,3));leafGeometry.setIndex(leafIndices);leafGeometry.computeVertexNormals();
  const trees=profile.civic||['arid','reeds'].includes(profile.vegetation)?[]:[[-8,-15,7],[-15,-19,8],[9,-17,7],[17,-12,8],[19,14,7],[-15,15,7],[-6,18,6],[28,-18,9],[-30,-17,9],[33,9,8]];
  for(let t=0;t<trees.length;t++){
    const [x,z,h]=trees[t],base=height(x,z);
    for(let root=0;root<3;root++){const angle=root*2.399+t*.71,reach=.85+hash(root,t)*.6,xx=x+Math.cos(angle)*reach,zz=z+Math.sin(angle)*reach;branch([xx,height(xx,zz)+.025,zz],[x,base+.6,z],.13,'oak root buttresses',m.darkWood);}
    branch([x,base-.15,z],[x+.18,base+h*.75,z-.1],.28,'oak trunk',m.darkWood);
    for(let k=0;k<8;k++){
      const angle=k*2.399+t,reach=h*(.26+hash(t,k)*.15),cy=base+h*(.55+hash(k,t)*.36),cx=x+Math.cos(angle)*reach,cz=z+Math.sin(angle)*reach;
      branch([x+.12,base+h*(.35+k*.033),z],[cx,cy,cz],.10,'oak bough',m.darkWood);
      const n=perf?30:high?80:58;
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
  const normals=blade.attributes.normal;for(let i=0;i<normals.count;i++){const n=new THREE.Vector3(normals.getX(i)*.5,Math.abs(normals.getY(i))+.85,normals.getZ(i)*.5).normalize();normals.setXYZ(i,n.x,n.y,n.z);}
  const grassCount=profile.civic?0:Math.round((perf?2400:high?13000:8500)*(profile.vegetation==='arid'?.12:profile.vegetation==='reeds'?.4:1));
  for(let i=0;i<grassCount;i++){
    const x=(hash(i,31)-.5)*65,z=(hash(i,32)-.5)*55;if(z< -18)continue;
    const tile=worldToGrid(x,z,e,tileSize),inside=isPlayable(x,z,e,tileSize),type=inside?terrainAt(e,tile.x,tile.y):'grass';
    const patch=noise(x*.55,z*.55,71);
    if(['rock','wall','river','ford','stone','chamber','marsh'].includes(type)||hash(i,9)>patch*.85+(inside?(training?-.23:.1):.24)||(profile.architecture==='fort'&&Math.abs(x-fortX)<1))continue;
    if(roadDistance(x,z)<tileSize*(.34+hash(i,15)*.14))continue;
    const s=inside?(training?.065:.12)+hash(i,4)*.12:.18+hash(i,4)*.39,dry=hash(i,114)>.83;
    instance(dry?'dry meadow grass':'meadow grass',blade,dry?m.dryGrass:m.grass,[x,height(x,z)-.01,z],[s*(.7+hash(i,8)*.6),s,s],[0,hash(i,4)*6.28,0],new THREE.Color().setRGB(.71+hash(i,2)*.25,.77+hash(i,5)*.2,.59+hash(i,1)*.24));
  }
  // Low broadleaf growth occupies irregular verge patches, not the legal
  // board. Its shared leaves add a second scale to the fine grass tufts.
  if(profile.vegetation==='meadow')for(let i=0;i<(perf?40:high?150:100);i++){
    const x=(hash(i,204)-.5)*48,z=(hash(i,205)-.5)*36;if(isPlayable(x,z,e,tileSize,1.8)||z<-18||roadDistance(x,z)<tileSize*.7||noise(x*.24,z*.24,77)<.43)continue;
    for(let j=0;j<5;j++){const angle=j*2.399+hash(i,j)*.7,s=1.15+hash(i,j,207)*.65;instance('broadleaf verge growth',leafGeometry,m.leaves,[x+(hash(i,j,208)-.5)*.45,height(x,z)+.025,z+(hash(j,i,209)-.5)*.45],[s*1.4,s,s],[1.03+(hash(j,i)-.5)*.35,angle,0],new THREE.Color(.68+hash(i,j,210)*.24,.78+hash(j,i,211)*.18,.52+hash(i,j,212)*.25));}
  }
  // Fern fronds are compound leaves along bent stems, kept outside the board.
  for(let i=0;i<(profile.vegetation==='meadow'?(perf?12:30):0);i++){const x=(hash(i,83)-.5)*42,z=(hash(i,86)-.5)*34;if(isPlayable(x,z,e,tileSize,1))continue;const base=height(x,z);
    for(let f=0;f<5;f++){const angle=f*1.256+i,dx=Math.cos(angle),dz=Math.sin(angle);for(let j=1;j<8;j++)for(const side of [-1,1]){const t=j/8,reach=t*.85,s=.30*(1-t*.8);instance('fern leaves',leafGeometry,m.leaves,[x+dx*reach+dz*side*s*.2,base+Math.sin(t*2.5)*.47,z+dz*reach-dx*side*s*.2],[s*1.6,s*2,s],[.4,angle+side*.9,.4],new THREE.Color(.50,.70,.42));}}
  }
  for(const [name,batch]of batches){
    const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.items.length);mesh.name=name;mesh.castShadow=!['meadow grass','dry meadow grass','fern leaves'].includes(name)&&!perf;mesh.receiveShadow=true;
    batch.items.forEach((item,i)=>{dummy.position.set(...item.position);dummy.scale.set(...item.scale);dummy.rotation.set(...item.rotation);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(item.color)mesh.setColorAt(i,item.color);});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
  }

  // The Danube occupies a shallow channel beyond the legal map. Subtle real
  // surface waves and rough reflections sit below mist supplied by the scene.
  let river=null;
  if(profile.distantWater){
  const riverGeometry=p.geo(new THREE.PlaneGeometry(125,16,perf?70:130,12));riverGeometry.rotateX(-Math.PI/2);
  river=p.mesh(root,riverGeometry,m.water,0,-1.24,-29);river.name='Danube';river.castShadow=false;river.receiveShadow=true;
  const riverBase=Float32Array.from(riverGeometry.attributes.position.array);
  animated.push(time=>{const a=riverGeometry.attributes.position;for(let i=0;i<a.count;i++){const xx=riverBase[i*3],zz=riverBase[i*3+2];a.setY(i,.023*Math.sin(xx*.64+time*.9)+.017*Math.sin(zz*1.7+xx*.17-time*.55));}a.needsUpdate=true;if(!perf)riverGeometry.computeVertexNormals();});
  }
  const flames=[];
  function fire(x,z,scale=1){const y=height(x,z),g=p.group(root,x,y,z);for(let i=0;i<5;i++){const a=i*1.256;p.beam(g,[Math.cos(a)*.47,.09,Math.sin(a)*.47],[-Math.cos(a)*.25,.18,-Math.sin(a)*.25],.065,m.charcoal);}
    for(let k=0;k<3;k++){const mat=ownMaterial(new THREE.MeshBasicMaterial({color:[0xf3a143,0xf5c777,0xbc502c][k],transparent:true,opacity:[.67,.6,.3][k],depthWrite:false,blending:THREE.AdditiveBlending}));const flame=p.mesh(g,p.sphere,mat,(k-1)*.11,.38,0,.12,.5,.12);flame.castShadow=false;flame.receiveShadow=false;flames.push({mesh:flame,seed:k+x,base:.40,scale});}
    if(!perf){const light=new THREE.PointLight(0xe99b53,1.6*scale,6,2);light.position.set(0,.9,0);g.add(light);animated.push(t=>light.intensity=scale*(1.4+Math.sin(t*7+x)*.17+Math.sin(t*11)*.12));}
  }
  if(!training&&profile.architecture==='fort'){fire(fortX-4,gateZ+2.2,.8);fire(cartX,cartZ,1.2);}
  // Preserve animated surfaces and authoritative ground objects. Static
  // scenery is instanced where repeated, otherwise merged by exact material
  // and render flags, with all parent transforms baked into root space.
  const batching=batchStaticEnvironment(root,{geometries,exclude:new Set([ground,road,river,root.getObjectByName('continuous civic stone floor'),...flames.map(f=>f.mesh)])});
  const horizon=createEnvironmentHorizon({ground,profile,height,quality});root.add(horizon.group);
  let lastTime=-1;
  return {group:root,ground,groundHeight:height,cameraGroundHeight:horizon.cameraGroundHeight,profile,horizon,
    update(time=0){if(disposed||!Number.isFinite(time)||time===lastTime)return;lastTime=time;const bounded=time%3600;wind.value=bounded;for(const fn of animated)fn(bounded);horizon.update(bounded);for(const f of flames){f.mesh.scale.y=f.base*f.scale*(1+.13*Math.sin(bounded*7+f.seed));f.mesh.position.x=Math.sin(bounded*2.1+f.seed)*.045;}},
    dispose(){if(disposed)return;disposed=true;scene.remove(root);horizon.dispose();for(const g of geometries)g.dispose();for(const material of extraMaterials)material.dispose();library.dispose();root.clear();},
    stats(){let meshes=0,instances=0;root.traverse(o=>{if(o.isMesh)meshes++;if(o.isInstancedMesh)instances+=o.count;});return {meshes,instances,geometries:geometries.size,quality,mode:training?'training':profile.setting,batching,horizon:horizon.stats,disposed};}
  };
}
