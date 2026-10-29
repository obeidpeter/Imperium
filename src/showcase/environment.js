import * as THREE from '../../vendor/three/three.module.js';
import {createEnvironmentMaterials} from './environment-materials.js';
import {createPropFactory} from './environment-props.js';
import {getSceneProfile} from './campaign-scene-profile.js';
import {addCampaignTerrain} from './environment-campaign-terrain.js';
import {addCampaignScenery} from './environment-campaign-scenery.js';
import {addEnvironmentDepth} from './environment-depth.js';
import {addEncounterPrecinct} from './environment-precincts.js';
import {addInhabitedEnvironment} from './environment-inhabited.js';
import {createStagingRouteSampler} from './environment-staging.js';
import {batchStaticEnvironment} from './environment-batching.js';
import {createEnvironmentHorizon} from './environment-horizon.js';
import {createPanorama} from './environment-panorama.js';
import {addFinaleApproach} from './environment-finale.js';
import {addChapterFivePilot,isChapterFivePilot,chapterFivePilotHeight,chapterFiveServicePads,getChapterFiveKitPlacements} from './environment-ch5-pilot.js';
import {hasRegionalWorld,addRegionalWorld,regionalServicePads,regionalPropPlacements,addRegionalPropFallbacks,getRegionalKitPlacements,regionalComponentDimensions} from './environment-regional-world.js';
import {createArchitecturalGroundSampler} from './environment-composition.js';
import {groundArchitecturalFoundations} from './environment-foundations.js';
import {smoothCoincidentNormals} from './environment-primitives.js';
import {createVegetationFactory} from './environment-foliage.js';
import {regionalTreePlacements,sampleWorldWind,waterCurrentDirection} from './world-weather.js';
import {createParticleMask,createFlamePlume,sampleFlamePlume} from './stage-particles.js';
import {createRoadSurfaceSampler} from './environment-road-surface.js';
import {bakeEnvironmentOcclusion,installBakedOcclusion} from './environment-baked-occlusion.js';
import {buildTerrainSplat} from './terrain-splat.js';
import {setTerrainSplat,refreshTerrainTextures} from './terrain-material.js';
import {groundTextures} from './ground-textures.js';
import {groundBiome} from '../ui/ground-layers.js';
import {installCloudShadows} from './atmosphere.js';
import {runSteps} from './build-steps.js';
import {boardKitPieces} from './structure-registry.js';
import {createBoardKitPieces} from './board-kit.js';
import {createAurelianWalls} from './aurelian-walls.js';
import {createTreeKitPlanter,treeKitFor} from './tree-kit.js';
import {createRockKitPlacer,rockKitFor} from './rock-kit.js';
import {createGroundCover} from './ground-cover.js';
import {TILE_SIZE,hash,noise,smooth,clamp,gridToWorld,terrainAt,worldToGrid,createGroundHeight,roadSegments,isPlayable,isTrainingGround,distantRiverCentre,RIVER_WATER_LEVEL,MARSH_WATER_LEVEL} from './environment-layout.js';
export {gridToWorld} from './environment-layout.js';

/** Self-contained 3D presentation. The supplied encounter is never modified.
 * time is elapsed seconds; repeated updates cannot advance simulation state. */
export function createEnvironment(scene,encounter,options){return runSteps(buildEnvironment(scene,encounter,options));}
// The same build in steps: it yields wherever a time-sliced build may give the
// page a turn (build-steps.js); each step is a small part of the world.
export function* buildEnvironment(scene,encounter,{tileSize=TILE_SIZE,quality='balanced',loadTextures=true,chapter,boardKit=null,treeKit=null,rockKit=null,wallsKit=null,kitFinish=null}={}){
  if(!scene?.add||!Number.isInteger(encounter?.width)||!Number.isInteger(encounter?.height)||!Number.isFinite(tileSize)||tileSize<=0)throw new TypeError('Environment requires a scene, legal terrain and a positive tile size.');
  const profile=getSceneProfile(encounter,{chapter}),training=isTrainingGround(encounter),root=new THREE.Group();root.name=training?'Fort training yard environment':profile.region+' environment';root.userData.environmentMode=training?'training':profile.setting;root.userData.sceneProfile=profile;scene.add(root);
  const geometries=new Set(),extraMaterials=new Set(),animated=[];let disposed=false;
  const library=createEnvironmentMaterials({loadTextures,profile,quality}),m=library.materials,p=createPropFactory(m,geometries,{quality}),height=chapterFivePilotHeight(createGroundHeight(encounter,tileSize,{profile}),encounter,tileSize);
  const current=waterCurrentDirection(encounter);library.waterCurrent.value.set(current.x,current.z);
  const terrainSnapshot=encounter.terrain.map(row=>row.map(t=>typeof t==='string'?t:{...t}));
  // A real-time battle's structures: its fortification record (full-height curtains, rampart
  // breastworks). With the board kit's loaded model (board-kit.js) its pieces draw them instead.
  const e={id:encounter.id,kind:encounter.kind,width:encounter.width,height:encounter.height,terrain:terrainSnapshot,
    ...(encounter.campPresentation?{campPresentation:encounter.campPresentation}:{}),
    ...(encounter.fortifications?{fortifications:encounter.fortifications}:{}),...(boardKit?{boardKit:true}:{})};
  const perf=quality==='performance',high=quality==='high',halfX=e.width*tileSize/2,halfZ=e.height*tileSize/2,regional=hasRegionalWorld(e),riverZ=distantRiverCentre(e,tileSize);
  // The distant river's banks (its plane is 16 m wide), where its foam gathers.
  if(profile.distantWater)library.waterBank.value.set(riverZ,8);
  const precinctRoute=createStagingRouteSampler(e,profile.staging,tileSize);
  const architecturalFootprints=[...getChapterFiveKitPlacements(e,{chapter:profile.chapter,tileSize}),...getRegionalKitPlacements(e,{chapter:profile.chapter,tileSize})]
    .filter(p=>!Number.isFinite(p.groundY)).map(p=>{const [w,,d]=regionalComponentDimensions(p.id,p.component);return {...p,width:w*p.scale[0],depth:d*p.scale[2]};});
  const architecturalGround=createArchitecturalGroundSampler(architecturalFootprints,{wet:profile.weather==='rain'||profile.setting==='wetland'});
  root.userData.architecturalGround={footprints:architecturalFootprints.length,version:1};
  const ownMaterial=material=>{extraMaterials.add(material);return material;};
  // The region's tree kit (tree-kit.js), when its model is loaded and not on Performance:
  // its atlas drawn as the leaf sprays are, so its trees sway in the same wind and program.
  let kitAtlas=null;if(treeKit&&!perf)treeKit.traverse(o=>{if(o.isMesh&&o.material?.map&&!kitAtlas)kitAtlas=o.material.map;});
  const kitLeaves=kitAtlas&&treeKitFor(profile.chapter)?library.kitMaterial('foliage',{map:kitAtlas}):null;
  const planter=kitLeaves?createTreeKitPlanter(treeKit,treeKitFor(profile.chapter),kitLeaves):null;
  // The region's rock kit (rock-kit.js) likewise: each rock's own maps drawn as the field's stone.
  const rockMaterials=new Map();
  if(rockKit&&!perf&&rockKitFor(profile.chapter))rockKit.traverse(o=>{const k=o.isMesh&&o.material;if(k?.map&&!rockMaterials.has(k))rockMaterials.set(k,library.kitMaterial('stone',{map:k.map,normalMap:k.normalMap,normalScale:k.normalScale}));});
  const rocks=rockMaterials.size?createRockKitPlacer(rockKit,rockKitFor(profile.chapter),rockMaterials):null;
  const wind={value:0},windDirection={value:new THREE.Vector2()};
  if(!perf)for(const material of [m.grass,m.dryGrass,m.leaves,m.foliage,kitLeaves].filter(Boolean)){
    const previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
    material.onBeforeCompile=shader=>{previousCompile.call(material,shader);shader.uniforms.environmentWind=wind;shader.uniforms.environmentWindDirection=windDirection;shader.vertexShader='uniform float environmentWind; uniform vec2 environmentWindDirection;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        float phase = environmentWind * 1.15 + instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        float flutter = sin(phase * 2.6 + position.x * 5.4) * 0.014 * clamp(position.y, 0.0, 1.5);
        transformed.xz += environmentWindDirection * (sin(phase) * position.y * position.y * 0.14 + flutter);
        transformed.z += cos(phase * 0.79) * position.y * 0.018;
      #endif`);};
    material.customProgramCacheKey=()=>`${previousKey}:regional-foliage-wind-v3`;
  }
  const roads=roadSegments(e,tileSize),roadSurface=createRoadSurfaceSampler(roads,tileSize),roadDistance=roadSurface.distance;
  yield;
  // Real-time maps expand beyond the original 80 m terrain. Their playable
  // edge must remain on detailed ground, with a generous verge before the
  // distant ridge shader begins. Keep mesh counts bounded on every quality.
  const groundRadius=Math.max(40,halfX+20,halfZ+20);
  const rows=perf?120:high?200:160,groundGeometry=p.geo(new THREE.PlaneGeometry(groundRadius*2,groundRadius*2,rows,rows));groundGeometry.rotateX(-Math.PI/2);
  const pos=groundGeometry.attributes.position,colors=[],soilWeights=[];
  // Rows gather over the board and its margin (0.6 of the even spacing) and
  // spread toward the 80 m edge, which stays exactly where the outer bridge
  // meets it, so plateau banks and river cuts resolve without adding rows.
  const gather=r=>{if(r<=20)return r*.6;const t=(r-20)/20,t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*12+(t3-2*t2+t)*12+(3*t2-2*t3)*40+(t3-t2)*32;};
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),r=Math.max(Math.abs(x),Math.abs(z));if(groundRadius===40&&r>0&&r<40){const s=gather(r)/r;pos.setXYZ(i,x*s,0,z*s);}}
  for(let i=0;i<pos.count;i++){
    if(i%1024===1023)yield;
    const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,height(x,z));
    const patch=noise(x*.23,z*.23,8),damp=smooth((riverZ-z+12)/4)*(1-smooth((riverZ-z-11)/5)),edge=.93+noise(x*.06,z*.06,2)*.07;
    colors.push((.91+patch*.09)*edge*(1-damp*.2),(.94+patch*.06)*edge*(1-damp*.13),(.88+patch*.09)*edge*(1-damp*.12));
    const yard=1-smooth(Math.max(Math.abs(x)-halfX+.8,Math.abs(z)-halfZ+.8)/2.7),wear=training?yard*(.72+patch*.18):Math.pow(noise(x*.19,z*.19,31),2)*.48;
    // Steep relief near the board (plateau banks, river cuts) shows bare earth
    // rather than turf; it fades out well before the outer bridge's shared edge.
    const slope=Math.hypot(height(x+.3,z)-height(x-.3,z),height(x,z+.3)-height(x,z-.3))/.6,near=1-smooth((Math.max(Math.abs(x)-halfX,Math.abs(z)-halfZ)-16)/6);
    const contact=architecturalGround(x,z);
    soilWeights.push(clamp((training?.12:profile.soilMix)+wear+damp*.42+precinctRoute(x,z)*.78+roadSurface.sample(x,z).verge*.61+smooth(slope*.9)*.75*near+contact.footing*.7+contact.wear*.6));
  }
  groundGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  groundGeometry.setAttribute('soilMix',new THREE.Float32BufferAttribute(soilWeights,1));
  const groundUV=groundGeometry.attributes.uv;for(let i=0;i<groundUV.count;i++)groundUV.setXY(i,(pos.getX(i)+40)/2,(40-pos.getZ(i))/2);
  groundGeometry.computeVertexNormals();const ground=p.mesh(root,groundGeometry,m.ground);ground.name='continuous ground';ground.castShadow=false;ground.userData.environmentGround=true;
  yield;
  // Which photographed layers lie where (terrain-splat.js): the cells, the road's
  // tread and verge, slopes, the river's bank and wear, over the whole ground.
  const splat=yield* buildTerrainSplat({e,tileSize,biome:groundBiome(profile.chapter),height,road:roadSurface,route:precinctRoute,architecture:architecturalGround,training,
    damp:profile.distantWater?(x,z)=>smooth((riverZ-z+12)/4)*(1-smooth((riverZ-z-11)/5)):undefined,bounds:{minX:-groundRadius,minZ:-groundRadius,maxX:groundRadius,maxZ:groundRadius}});
  setTerrainSplat(library.terrain,splat);root.userData.terrainSplat={nx:splat.nx,nz:splat.nz,step:splat.step,minX:splat.minX,minZ:splat.minZ,maxX:splat.maxX,maxZ:splat.maxZ};
  yield;

  // The road's tread is part of the ground's splat map: no overlay to draw or sort.
  const road=null;

  // Shared instance batches keep structural detail from becoming thousands of
  // independent draw calls. Matrices use real solid geometry and cast shadows.
  const batches=new Map(),dummy=new THREE.Object3D();
  function instance(key,g,material,position,scale,rotation=[0,0,0],color=null){if(!batches.has(key))batches.set(key,{geometry:g,material,items:[]});batches.get(key).items.push({position,scale,rotation,color});}
  const taperedTimber=p.geo(new THREE.CylinderGeometry(.58,1,1,10));
  function branch(a,b,r,key='timber',material=m.wood){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),mid=av.clone().add(bv).multiplyScalar(.5),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.clone().sub(av).normalize()),rot=new THREE.Euler().setFromQuaternion(q);instance(key,/oak|willow|root buttress/.test(key)?taperedTimber:p.cylinder,material,mid.toArray(),[r,av.distanceTo(bv),r],[rot.x,rot.y,rot.z]);}
  const rockGeometry=p.geo(new THREE.IcosahedronGeometry(1,2));
  const rockPos=rockGeometry.attributes.position;
  for(let i=0;i<rockPos.count;i++){const x=rockPos.getX(i),y=rockPos.getY(i),z=rockPos.getZ(i),k=.83+noise(x*3+5,z*3+2,y*3)*.3;rockPos.setXYZ(i,x*k,y*(.85+hash(x,z,y)*.12),z*k);}smoothCoincidentNormals(rockGeometry);
  // A rock cell holds a boulder and three smaller stones, or with the region's rock kit, whose
  // rocks carry far more detail, a boulder and one: the field keeps its triangle budget.
  function boulder(x,z,scale=1,seed=0){if(rocks?.place({x,y:height(x,z),z,radius:scale,height:scale*1.04,seed}))return;instance('limestone',rockGeometry,m.stone,[x,height(x,z)+scale*.32,z],[scale,scale*.72,scale*.83],[.1*hash(x,z),seed*.7,.1*hash(z,x)],new THREE.Color().setRGB(.72+hash(x,z)*.24,.74+hash(z,x)*.2,.68+hash(x,z,3)*.2));}
  const serviceRockCells=new Set([...chapterFiveServicePads(e,tileSize),...regionalServicePads(e,tileSize)].flatMap(pad=>pad.cells.map(c=>`${c.x},${c.y}`)));
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(['rock','rubble'].includes(terrainAt(e,x,y))&&!serviceRockCells.has(`${x},${y}`)){const point=gridToWorld({x,y},e,tileSize);boulder(point.x,point.z,tileSize*.43,x+y);for(let k=0;k<(rocks?1:3);k++)boulder(point.x+(hash(k,x,y)-.5)*tileSize*.78,point.z+(hash(y,k,x)-.5)*tileSize*.78,tileSize*(.15+hash(k,y)*.16),k);}
  for(let i=0;i<(profile.civic?0:45);i++){const x=(hash(i,1)-.5)*67,z=(hash(i,2)-.5)*58;if(isPlayable(x,z,e,tileSize,3)||z< -19&&z> -41||precinctRoute(x,z)>.12)continue;boulder(x,z,.35+hash(i,3)*1.15,i);}
  yield;

  // The gate meets the real west-edge road. Its walls and camp are outside the
  // playable rectangle; nothing here becomes an invented pathfinding blocker.
  const edgeRoad=roads.find(([a,b])=>a.x< -halfX&&b.x>=-halfX),gateZ=edgeRoad?.[1].z??-tileSize*1.5,fortX=-halfX-3.1,gateWidth=4.8;
  const cartX=halfX+3.5,cartZ=3.8;
  if(profile.architecture==='fort'&&(!regional||training)){
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
  if(!perf)standard.traverse(o=>{if(!o.userData.windCloth)return;const a=o.geometry.attributes.position,base=Float32Array.from(a.array);animated.push(t=>{const breeze=sampleWorldWind(t,profile);for(let i=0;i<a.count;i++){const weight=(.9-base[i*3+1])/1.8,flutter=Math.sin(t*1.7+base[i*3]*3.5+weight*2)*.10*weight;a.setXYZ(i,base[i*3]+flutter*breeze.x,base[i*3+1],base[i*3+2]+flutter*breeze.z);}a.needsUpdate=true;o.geometry.computeVertexNormals();});});
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
  yield;
  const vegetation=createVegetationFactory({p,m,instance,height,quality,planter});
  const campaignContext={root,e,p,m,profile,height,tileSize,quality,instance,branch,animated,ownMaterial,vegetation,rockGeometry,rocks,geometries,regionalWorld:regional,wallsKit};
  const pilot=isChapterFivePilot(e)&&profile.chapter===5;
  if(pilot||regional){root.userData.environmentLandmarks=[];root.userData.inhabitedSetpieces=[];}
  for(const add of [addCampaignTerrain,addCampaignScenery,addEnvironmentDepth,addEncounterPrecinct,addFinaleApproach,addInhabitedEnvironment,
    addChapterFivePilot,addRegionalWorld,groundArchitecturalFoundations]){
    // Chapter V's unified modular frontage replaces the overlapping generic
    // wall, siege landmark and houses, including their Performance fallback.
    if(pilot&&[addCampaignScenery,addEncounterPrecinct,addInhabitedEnvironment].includes(add))continue;
    if(regional&&([addEncounterPrecinct,addInhabitedEnvironment].includes(add)||add===addCampaignScenery&&!profile.civic))continue;
    add(campaignContext);yield;
  }
  if(regional)addRegionalPropFallbacks(campaignContext,regionalPropPlacements(encounter,{chapter:profile.chapter,tileSize}));

  // Solid branching trunks carry curved, alpha-cut leaf sprays in shared
  // batches. The small geometric leaves below remain a low-growth fallback.
  const leafGeometry=p.geo(new THREE.BufferGeometry()),leafVertices=[],leafIndices=[];
  for(let row=0;row<=5;row++)for(let col=0;col<3;col++){const t=row/5,s=col-1,w=Math.sin(Math.PI*t)*.105;leafVertices.push(s*w,t*.31,.035*t*t+.028*(1-s*s)*Math.sin(Math.PI*t));if(row<5&&col<2){const a=row*3+col;leafIndices.push(a,a+1,a+3,a+1,a+4,a+3);}}
  leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute(leafVertices,3));leafGeometry.setIndex(leafIndices);leafGeometry.computeVertexNormals();
  // Ground no tree or ground cover takes: the set pieces, and the finale's walls.
  const occupied=[...(root.userData.inhabitedSetpieces??[]),...(root.userData.finaleOccupied??[])];
  const trees=regionalTreePlacements({encounter:e,chapter:profile.chapter,tileSize,quality,civic:profile.civic,route:precinctRoute,height,occupied});
  for(const t of trees)vegetation.tree(t.kind,t.x,t.z,t.height,t.seed);
  root.userData.regionalTrees=trees;
  // Grasses use crossed, tapered geometry with varying height, not a flat
  // green carpet. Board tufts are shorter and sparser than the framing meadow.
  const blade=p.geo(new THREE.BufferGeometry()),bladeVertices=[],bladeIndices=[];
  for(let k=0;k<5;k++){const angle=k*2.399,dx=Math.cos(angle),dz=Math.sin(angle),h=.65+hash(k,41)*.3,bend=.17+hash(k,44)*.17,start=bladeVertices.length/3;
    for(const [t,width]of [[0,.038],[.38,.028],[.72,.016],[1,0]])for(const side of [-1,1])bladeVertices.push(dx*bend*t*t-dz*width*side,h*t,dz*bend*t*t+dx*width*side);
    for(let j=0;j<3;j++){const n=start+j*2;bladeIndices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }blade.setAttribute('position',new THREE.Float32BufferAttribute(bladeVertices,3));blade.setIndex(bladeIndices);blade.computeVertexNormals();
  const normals=blade.attributes.normal;for(let i=0;i<normals.count;i++){const n=new THREE.Vector3(normals.getX(i)*.5,Math.abs(normals.getY(i))+.85,normals.getZ(i)*.5).normalize();normals.setXYZ(i,n.x,n.y,n.z);}
  const grassCount=profile.civic?0:Math.round((perf?2400:high?13000:8500)*(profile.vegetation==='arid'?.12:profile.vegetation==='reeds'?.4:1));
  yield;
  for(let i=0;i<grassCount;i++){
    if(i%1024===1023)yield;
    const x=(hash(i,31)-.5)*Math.max(65,halfX*2+24),z=(hash(i,32)-.5)*Math.max(55,halfZ*2+24);
    if(profile.distantWater&&z<riverZ+11&&z>riverZ-11)continue;
    const tile=worldToGrid(x,z,e,tileSize),inside=isPlayable(x,z,e,tileSize),type=inside?terrainAt(e,tile.x,tile.y):'grass';
    const patch=noise(x*.55,z*.55,71);
    if(['rock','wall','river','ford','stone','chamber','marsh'].includes(type)||hash(i,9)>patch*.85+(inside?(training?-.23:.1):.24)||(profile.architecture==='fort'&&Math.abs(x-fortX)<1))continue;
    if(roadDistance(x,z)<tileSize*(.34+hash(i,15)*.14)||precinctRoute(x,z)>.12)continue;
    const s=inside?(training?.065:.12)+hash(i,4)*.12:.18+hash(i,4)*.39,dry=hash(i,114)>.83;
    instance(dry?'dry meadow grass':'meadow grass',blade,dry?m.dryGrass:m.grass,[x,height(x,z)-.01,z],[s*(.7+hash(i,8)*.6),s,s],[0,hash(i,4)*6.28,0],new THREE.Color().setRGB(.71+hash(i,2)*.25,.77+hash(i,5)*.2,.59+hash(i,1)*.24));
  }
  // Low broadleaf growth occupies irregular verge patches, not the legal
  // board. Its shared leaves add a second scale to the fine grass tufts.
  if(profile.vegetation==='meadow')for(let i=0;i<(perf?40:high?150:100);i++){
    const x=(hash(i,204)-.5)*48,z=(hash(i,205)-.5)*36;if(isPlayable(x,z,e,tileSize,1.8)||z<-18||roadDistance(x,z)<tileSize*.7||precinctRoute(x,z)>.12||noise(x*.24,z*.24,77)<.43)continue;
    for(let j=0;j<(perf?2:3);j++){const angle=j*2.399+hash(i,j)*.7,s=.50+hash(i,j,207)*.30;vegetation.spray('meadow','broadleaf verge growth',x+(hash(i,j,208)-.5)*.25,height(x,z)+.025,z+(hash(j,i,209)-.5)*.25,[s,s,s],[.08,angle,(hash(i,j)-.5)*.3],i*7+j);}
  }
  // Fern fronds are compound leaves along bent stems, kept outside the board.
  for(let i=0;i<(profile.vegetation==='meadow'?(perf?12:30):0);i++){const x=(hash(i,83)-.5)*42,z=(hash(i,86)-.5)*34;if(isPlayable(x,z,e,tileSize,1)||precinctRoute(x,z)>.12)continue;const base=height(x,z);
    for(let f=0;f<5;f++){const angle=f*1.256+i,dx=Math.cos(angle),dz=Math.sin(angle);for(let j=1;j<8;j++)for(const side of [-1,1]){const t=j/8,reach=t*.85,s=.30*(1-t*.8);instance('fern leaves',leafGeometry,m.leaves,[x+dx*reach+dz*side*s*.2,base+Math.sin(t*2.5)*.47,z+dz*reach-dx*side*s*.2],[s*1.6,s*2,s],[.4,angle+side*.9,.4],new THREE.Color(.50,.70,.42));}}
  }
  yield;
  // Ground cover round the view (ground-cover.js): denser grass, flowers, scrub, reeds and
  // grain near what the camera looks at, in the meadow's own materials; none on Performance.
  const cover=createGroundCover(root,{e,tileSize,profile,quality,height,roadDistance,route:precinctRoute,architecture:architecturalGround,
    occupied,riverZ:profile.distantWater?riverZ:null,fortX:profile.architecture==='fort'&&(!regional||training)?fortX:null,m,scrub:vegetation.sprays.meadow});
  if(cover)root.userData.groundCover=cover.stats();
  yield;
  // The kit's trees, once every plan has planted them: one instanced draw a species and level.
  if(planter){planter.build(root,{castShadow:!perf});root.userData.treeKit=planter.stats();}
  if(rocks){rocks.build(root,{castShadow:!perf});root.userData.rockKit=rocks.stats();}
  // Every batch has an instance colour (white where an item has none), so a
  // material's instanced batches, tinted or not, share one shader program.
  const white=new THREE.Color(1,1,1);
  for(const [name,batch]of batches){
    yield;
    const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.items.length);mesh.name=name;mesh.castShadow=!['meadow grass','dry meadow grass','fern leaves'].includes(name)&&!perf;mesh.receiveShadow=true;
    batch.items.forEach((item,i)=>{dummy.position.set(...item.position);dummy.scale.set(...item.scale);dummy.rotation.set(...item.rotation);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,item.color??white);});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
  }
  yield;

  // The Danube occupies a shallow channel beyond the legal map. Subtle real
  // surface waves and rough reflections sit below mist supplied by the scene.
  let river=null;
  if(profile.distantWater){
  const riverGeometry=p.geo(new THREE.PlaneGeometry(125,16,perf?70:130,12));riverGeometry.rotateX(-Math.PI/2);
  // Its waves move in the water's vertex shader (finishEnvironmentMaterial, waves).
  river=p.mesh(root,riverGeometry,m.water,0,-1.24,riverZ);river.name='Danube';river.castShadow=false;river.receiveShadow=true;
  }
  const flames=[];let fireMask=null;
  function fire(x,z,scale=1){const y=height(x,z),g=p.group(root,x,y,z);for(let i=0;i<5;i++){const a=i*1.256;p.beam(g,[Math.cos(a)*.47,.09,Math.sin(a)*.47],[-Math.cos(a)*.25,.18,-Math.sin(a)*.25],.065,m.charcoal);}
    fireMask??=createParticleMask();const plume=createFlamePlume(fireMask);plume.scale.setScalar(scale);plume.position.y=.17;g.add(plume);geometries.add(plume.geometry);ownMaterial(plume.material);flames.push({mesh:plume,seed:x});
    if(!perf){const light=new THREE.PointLight(0xe99b53,1.6*scale,6,2);light.position.set(0,.9,0);g.add(light);animated.push(t=>light.intensity=scale*(1.4+Math.sin(t*7+x)*.17+Math.sin(t*11)*.12));}
  }
  if(!training&&!regional&&profile.architecture==='fort'){fire(fortX-4,gateZ+2.2,.8);fire(cartX,cartZ,1.2);}
  yield;
  // Preserve animated surfaces and authoritative ground objects. Static
  // scenery is instanced where repeated, otherwise merged by exact material
  // and render flags, with all parent transforms baked into root space.
  const batching=batchStaticEnvironment(root,{geometries,exclude:new Set([ground,road,river,root.getObjectByName('continuous civic stone floor'),root.getObjectByName('authored river channel water'),...flames.map(f=>f.mesh)])});
  yield;
  // Sky and contact occlusion baked from the finished static scene, sampled by
  // every environment surface on every tier (the horizon and panorama follow).
  // The board kit's pieces stand with the field's objects, not here. Its lasting ones
  // (curtains, towers, breastworks) are placed once more in a passing group, so they
  // shade the ground as the code-built works do; gates and bridges change state.
  const kitShade=boardKit&&e.fortifications?new THREE.Group():null,kitPieces=kitShade&&createBoardKitPieces(kitShade,boardKit,boardKitPieces(e,{tileSize,height}));
  const occlusion=bakeEnvironmentOcclusion(root,{groundAt:height,bounds:{minX:-halfX-6,maxX:halfX+6,minZ:-halfZ-6,maxZ:halfZ+6},quality,sun:profile.sunPosition,exclude:new Set([ground,road,river,...flames.map(f=>f.mesh)].filter(Boolean)),also:kitShade?[kitShade]:[]});
  kitPieces?.dispose();
  yield;
  const groundSurfaces=new Set([m.ground,m.road,m.floor]),occluded=new Set();
  root.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh)return;for(const material of [o.material].flat())if(material&&!occluded.has(material)){occluded.add(material);installCloudShadows(material);if(material.userData.environmentFinish!=='water')installBakedOcclusion(material,occlusion.uniforms,{ground:groundSurfaces.has(material)||material.userData.environmentFinish==='floor'});}});
  yield;
  // Aurelian's walls (environment-finale.js, aurelian-walls.js), added after the scene's own
  // material hooks: their materials belong to the cached kit and read the shared bake
  // (kitFinish), as the board kit's do.
  const walls=root.userData.finaleWalls&&wallsKit?createAurelianWalls(root,wallsKit,root.userData.finaleWalls.pieces,{finish:kitFinish}):null;
  if(walls)root.userData.finaleWalls.drawn=walls.stats();
  // The board's own water (river channel or marsh flood) is the mirror plane on High.
  const riverWater=root.getObjectByName('authored river channel water'),marshWater=root.getObjectByName('continuous irregular marsh water');
  const reflectionLevel=riverWater?RIVER_WATER_LEVEL:marshWater?MARSH_WATER_LEVEL:null;
  const horizon=createEnvironmentHorizon({ground,profile,height,quality,innerRadius:groundRadius,waterMaterial:m.water,riverZ});root.add(horizon.group);
  yield;
  // The far skyline: the region's panorama, or the painted backdrop until it loads.
  const backdrop=createPanorama(profile,{quality});root.add(backdrop.group);
  let lastTime=-1;
  return {group:root,ground,groundHeight:height,cameraGroundHeight:horizon.cameraGroundHeight,profile,horizon,occlusion,terrain:{splat,uniforms:library.terrain},
    waterReflection:library.waterReflection,reflectionFallback:library.reflectionFallback,reflectionLevel,waterMeshes:[riverWater,marshWater].filter(Boolean),
    // camera: its position, so the kit's trees and rocks take the level their distance asks
    // for; focus: the point it looks at, round which the ground cover grows.
    update(time=0,camera=null,focus=null){if(disposed)return;planter?.update(camera);rocks?.update(camera);cover?.update(focus??camera);if(!Number.isFinite(time)||time===lastTime)return;lastTime=time;if(library.terrain.groundAlbedoMap.value!==groundTextures().albedo)refreshTerrainTextures(library.terrain);const bounded=time%3600,currentWind=sampleWorldWind(bounded,profile);wind.value=bounded;windDirection.value.set(currentWind.x,currentWind.z);if(library.waterTime)library.waterTime.value=bounded;for(const fn of animated)fn(bounded);horizon.update(bounded);for(const f of flames)sampleFlamePlume(f.mesh,bounded+f.seed,{chapter:profile.chapter,weather:profile.weather});},
    dispose(){if(disposed)return;disposed=true;walls?.dispose();planter?.dispose();rocks?.dispose();cover?.dispose();scene.remove(root);horizon.dispose();backdrop.dispose();occlusion.dispose();fireMask?.dispose();for(const g of geometries)g.dispose();for(const material of extraMaterials)material.dispose();library.dispose();root.clear();},
    stats(){let meshes=0,instances=0;root.traverse(o=>{if(o.isMesh)meshes++;if(o.isInstancedMesh)instances+=o.count;});return {meshes,instances,geometries:geometries.size,quality,mode:training?'training':profile.setting,batching,horizon:horizon.stats,backdrop:backdrop.stats,occlusion:occlusion.stats,trees:planter?.stats()??null,rocks:rocks?.stats()??null,groundCover:cover?.stats()??null,disposed};}
  };
}
