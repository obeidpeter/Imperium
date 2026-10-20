import * as T from '../../vendor/three/three.module.js';
import {actorPose,horsePose,groundHumanPose,groundHorsePose,blendActorPose,createFootPlanting,actionEnvelope} from './actor-pose.js';
import {actorKit} from './actor-kit.js';
import {acquireActorSurface,releaseActorSurface} from './actor-materials.js';
import {finishActorMaterial} from './actor-surface.js';
import {createHorse} from './actor-horse.js';
import {bindActorSurfaces,createClothRig} from './actor-skin.js';
import {actorIdentity} from './actor-identity.js';
import {createHeadGeometry,createHairGeometry,faceSurfacePoint} from './actor-head.js';
import {garmentGeometry} from './actor-geometry.js';
import {sampleActorClip} from './actor-clips.js';
import {sculptActorGeometry} from './actor-anatomy.js';
import {actorAnatomy,warmActorAssets,actorAssetStatus,mountActorAnatomy} from './actor-assets.js';
import {mountActorCostume} from './actor-costume.js';
import {actorMaterialKey} from './actor-material-key.js';
import {handGeometry,bootGeometry} from './actor-extremities.js';
import {acquireActorHairSurface,releaseActorHairSurface} from './actor-hair-asset.js';
import {acquireActorComplexion,releaseActorComplexion,warmActorComplexion} from './actor-complexion.js';
import {warmActorHair} from './actor-hair-asset.js';
import {aquilaGeometry,warmAquilaAsset} from './aquila-asset.js';
import {actorEye,actorBrow,actorExpression} from './actor-face.js';
export {actorPose,horsePose} from './actor-pose.js';
export {actorKit} from './actor-kit.js';

const TAU=Math.PI*2;
const DEFAULTS={skin:0xbe8966,cloth:0xc7bea0,leather:0x46352c,hair:0x30231e,shield:0x285f67,metal:0x727b7b,bronze:0xa78a50};
const defaultComplexion={acquire:acquireActorComplexion,release:releaseActorComplexion,warm:warmActorComplexion};

function irisGeometry(seed){
  const p=[],colors=[],uv=[],indices=[],rings=[0,.0018,.002,.0045,.0053],n=40;
  for(let j=0;j<rings.length;j++)for(let i=0;i<=n;i++){
    const a=i/n*TAU,r=rings[j],fiber=.82+.18*Math.sin(i*7.2+seed),base=j<2?new T.Color(0x100d0b):new T.Color(seed%4===0?0x606447:0x735633).multiplyScalar(j===4?.39:fiber);
    p.push(Math.cos(a)*r,Math.sin(a)*r,.0018*(1-(r/.0055)**2));colors.push(base.r,base.g,base.b);uv.push(.5+Math.cos(a)*r/.011,.5+Math.sin(a)*r/.011);
    if(j&&i){const k=j*(n+1)+i;indices.push(k-n-1,k-1,k,k-n-1,k-n-2,k-1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

// Elliptical profile mesh with small sewn folds. Used for clothing, anatomy,
// footwear and armor, so silhouettes are shaped rather than primitive stacks.
function shapeGeometry(points,depth=.008){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.002,bevelThickness:.002});}
function drape(rows,{from=0,to=1,offset=0}={}){const p=[],uv=[],indices=[],n=16;for(let j=0;j<rows.length;j++){const[y,cx,w,z]=rows[j];for(let i=0;i<=n;i++){const u=from+(to-from)*i/n,q=u*n,k=Math.floor(q),t=q-k,fold=f=>f(k/n)*(1-t)+f(Math.min(1,(k+1)/n))*t;p.push(cx+(u-.5)*w,y+fold(v=>-.018*Math.sin(v*Math.PI)),z+fold(v=>.009*Math.cos(v*Math.PI*12)+.018*Math.sin(v*Math.PI))+offset);uv.push(u,j/(rows.length-1));if(j&&i){const k=j*(n+1)+i;indices.push(k,k-1,k-n-1,k-1,k-n-2,k-n-1);}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}

/** Procedural 3D rig, feet at local y=0 and anatomical forward +Z.
 * Direction is yaw radians. Caller owns group.position. Phase is normalized
 * action progress, or one walking cycle (about .72m); omitted gait uses time.
 */
export function createActor(unit={},options={}){
  let rig=createActorRig(unit,options),disposed=false,lastInput={},group=rig.group;
  const contacts=rig.contacts,source=options.assetLibrary;
  const identity=actorIdentity(unit,actorKit(unit,options));
  const complexion=options.complexionLibrary??defaultComplexion,preloadComplexion=!!options.complexionLibrary||typeof window!=='undefined';
  let pendingComplexion=false;
  const releasePendingComplexion=()=>{if(pendingComplexion){pendingComplexion=false;complexion.release(identity);}};
  // The temporary owner protects a shared decode until the imported rig owns
  // its map. An abandoned fallback must not leave a warm-only GPU texture.
  if(preloadComplexion){complexion.acquire(identity);pendingComplexion=true;}
  const assetReady=source?source.warm(identity):typeof window!=='undefined'?warmActorAssets(identity):Promise.resolve(actorAssetStatus(identity).ready);
  const hairReady=!identity.female&&!['bound','long'].includes(identity.hair)?warmActorHair():Promise.resolve(false);
  const ready=Promise.all([assetReady,preloadComplexion?complexion.warm(identity):null,hairReady]).then(([loaded,,hairLoaded])=>{
    if(!loaded||disposed)return loaded&&!disposed;
    if(group.userData.actor.imported&&(!hairLoaded||group.userData.actor.hairImported))return true;
    const parent=group.parent;rig.dispose();group.clear();
    rig=createActorRig(unit,options,group);Object.assign(contacts,rig.contacts);
    if(parent)parent.add(group);rig.update({...lastInput,resetPose:true});return true;
  }).finally(releasePendingComplexion);
  return {group,contacts,ready,update(input={}){if(!disposed){lastInput={...input};rig.update(input);}},getReleasePoint(target){return rig.getReleasePoint(target);},dispose(){if(disposed)return;disposed=true;releasePendingComplexion();rig.dispose();}};
}
function createActorRig(unit={},options={},reuseGroup=null){
  const kit=actorKit(unit,options),{role,trainer,archer,mounted,civic,escort}=kit,veteran=kit.armored,raider=['Gothic','Persian','Palmyrene'].includes(kit.faction),armed=kit.armed,identity=actorIdentity(unit,kit);
  const complexion=options.complexionLibrary??defaultComplexion;
  const anatomy=options.assetLibrary?.anatomy(identity,{quality:options.quality})??actorAnatomy(identity,{quality:options.quality}),facePoint=(x,y,id,offset=0)=>anatomy?anatomy.facePoint(x,y,offset):faceSurfacePoint(x,y,id,offset);
  const detail=options.quality!=='performance',profile=(rings,spec={})=>{const g=garmentGeometry(rings,{...spec,subdivisions:spec.subdivisions??(detail&&(spec.anatomy||spec.folds)?2:1),segments:detail?Math.min(spec.segments??18,20):Math.min(spec.segments??18,12)});return spec.anatomy?sculptActorGeometry(g,spec.anatomy,spec.side?{...identity,side:spec.side}:identity):g;};
  const factionColors={Gothic:{cloth:0x82704f,hair:0x493526,shield:0x85392e},Persian:{cloth:0x9d8e72,hair:0x2c2521,shield:0x8b553f},Palmyrene:{cloth:0xd1bb90,hair:0x33251e,shield:0x7e4035},Civilian:{cloth:0xb8ae91,shield:0x8f714a}};
  const p={...DEFAULTS,...factionColors[kit.faction],skin:identity.skin,...(kit.officer?{cloth:0xb8b097,shield:0x7b3034}:{}),...(civic?{cloth:unit.id==='hero'?0xe4dbc3:unit.bloc==='Army'?0xa9997a:unit.bloc==='Landholders'?0xd2c3a5:0xc2bba4}:{}),...(trainer?{cloth:0xb8aa86,hair:0x594739,shield:0x875c41,skin:0xb98364}:{}),...options.palette};
  const geometries=new Set(),materials=new Set(),skeletons=new Set(),clothRigs=[],surfaces=new Map(),group=reuseGroup??new T.Group(),root=new T.Group();group.add(root);group.scale.y=1.05;
  group.name=`actor:${unit.id??role}`;group.userData.actor={unitId:unit.id,role,faction:kit.faction,veteranTier:kit.veteranTier,height:mounted?2.68:kit.officer?2.02:kit.eastern?1.97:1.86,forward:'+Z',mounted,armor:kit.armor,helmet:kit.helmet,identity:identity.key,age:identity.age,model:anatomy?'MakeHuman CC0 adapted anatomy':'original-landmark-sculpt',imported:!!anatomy,hairImported:!!anatomy?.importedHair,clips:'authored-v017'};
  const material=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.84,metalness:0,...extra});materials.add(m);return m;};
  const surface=kind=>{if(!surfaces.has(kind))surfaces.set(kind,acquireActorSurface(kind));return surfaces.get(kind);};
  const clothSurface=surface('cloth'),leatherSurface=surface('leather'),paintSurface=surface('paint');
  const skin=material(new T.Color(p.skin).offsetHSL(0,-.01,((kit.identity%9)-4)*.008),{roughness:.78,...surface('skin')}),cloth=material(p.cloth,clothSurface),clothDark=material(new T.Color(p.cloth).lerp(new T.Color(0x705238),.32).multiplyScalar(.72),clothSurface),leather=material(p.leather,leatherSurface),hair=material(new T.Color(p.hair).lerp(new T.Color(0x807669),identity.grey),surface('hair')),metal=material(p.metal,surface('metal')),bronze=material(p.bronze,surface('metal')),white=material(0xd7cbaa),black=material(0x241b17),eyeWhite=material(0xbfb4a2,{roughness:.28}),iris=new T.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:.27,clearcoat:.8,clearcoatRoughness:.15}),shieldPaint=material(p.shield,paintSurface),lip=material(raider?0x925c47:0x85503f),practiceWood=trainer?material(0x9d8053,paintSurface):null;
  materials.add(iris);let armorMaterial=null;
  cloth.name='woven tunic';leather.name='worked leather';shieldPaint.name='painted wooden shield';
  const importedSkin=anatomy?skin.clone():null;if(importedSkin){Object.assign(importedSkin,complexion.acquire(identity));materials.add(importedSkin);}
  const browHair=material(new T.Color(p.hair).lerp(new T.Color(0x807669),identity.grey*.65).multiplyScalar(.65),{roughness:.95});
  let replacingAnatomy=false;
  const mesh=(parent,geometry,mat,x=0,y=0,z=0)=>{geometries.add(geometry);const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.anatomyReplacement=replacingAnatomy;parent.add(m);return m;};
  const ellipsoid=(parent,mat,x,y,z,rx,ry,rz)=>{const m=mesh(parent,new T.SphereGeometry(1,detail?16:10,detail?10:7),mat,x,y,z);m.scale.set(rx,ry,rz);return m;};
  const faceDetail=(parent,mat,x,y,z,rx,ry,rz)=>{const m=mesh(parent,new T.SphereGeometry(1,detail?10:8,detail?6:5),mat,x,y,z);m.scale.set(rx,ry,rz);return m;};
  const part=(parent,name,x=0,y=0,z=0)=>{const g=new T.Bone();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
  const strip=(parent,mat,points,radius=.008)=>mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),Math.max(4,Math.ceil(points.length*(detail?2:1.5))),radius,4,false),mat);
  const hips=part(root,'hips',0,.91,0),torso=part(hips,'torso');
  if(veteran)mesh(torso,profile([[.473,.104,.078],[.486,.078,.068],[.496,.066,.059]],{segments:16}),cloth);
  const hem=civic?-.68:escort?-.48:kit.eastern?-.36:-.28;
  const skirt=part(torso,'tunic-hem');clothRigs.push(createClothRig(skirt,.055,hem*.45,hem));mesh(skirt,profile([[hem,.238,.156],[hem+.045,.239,.155],[hem*.55,.220,.146],[-.08,.197,.139],[-.025,.186,.132],[.03,.180,.125],[.055,.176,.116]],{folds:.07,foldCount:7}),cloth);
  // Garment folds belong to the shaped surface. Avoid separate chest tubes
  // whose fixed depth floated above narrower bodies at three-quarter angles.
  mesh(skirt,profile([[hem-.002,.241,.158],[hem+.016,.242,.158]],{folds:.07,foldCount:7}),clothDark);
  mesh(torso,profile([[.02,veteran?.204:.187,veteran?.157:.144],[.069,veteran?.204:.187,veteran?.157:.144]],{segments:24}),leather);
  mesh(torso,shapeGeometry([[-.028,-.025],[.028,-.025],[.028,.025],[-.028,.025]],.006),bronze,0,.044,veteran?.165:.152);
  replacingAnatomy=true;
  const neck=mesh(torso,profile([[.466,.077,.061],[.49,.064,.057],[.535,.057,.055],[.578,.060,.058],[.60,.061,.059]],{segments:18}),skin);
  const head=part(torso,'head',0,.575,0);
  // A continuous landmark sculpt replaces the former ellipsoid/wedge face.
  const faceSkin=skin.clone();faceSkin.vertexColors=true;materials.add(faceSkin);
  mesh(head,createHeadGeometry(identity,{detail}),faceSkin);
  const lids=[],brows=[];
  for(const side of [-1,1]){
    const brow=part(head,side<0?'right-brow':'left-brow');brow.userData.side=side;brows.push(brow);
    replacingAnatomy=true;
    faceDetail(head,skin,side*.095,.069,-.008,.012,.027,.012);
    faceDetail(head,lip,side*.102,.069,-.004,.0025,.014,.004);
    replacingAnatomy=false;
    if(anatomy){
      const face=(x,y,offset)=>anatomy.facePoint(x,y,offset),eye=actorEye({side,seed:kit.identity,identity,facePoint:face});
      eyeWhite.vertexColors=true;mesh(head,eye.sclera,eyeWhite);mesh(head,eye.iris,iris);
      const lid=part(head,side<0?'right-eyelid':'left-eyelid');mesh(lid,eye.upperLid,importedSkin);mesh(head,eye.lowerLid,importedSkin);lid.userData.closeDistance=eye.closeDistance;lids.push(lid);
      mesh(brow,actorBrow({side,identity,facePoint:face}),browHair);
    }else{
    const eyeX=side*.036*identity.eyes,eyeZ=facePoint(eyeX,.096,identity)[2]+.002;
    faceDetail(head,eyeWhite,eyeX,.096,eyeZ,.0155,anatomy?.0065:.006,anatomy?.014:.005);
    mesh(head,irisGeometry(kit.identity),iris,eyeX-side*.001,.096,eyeZ+(anatomy?.0134:.0047));
    strip(brow,hair,[[side*.018,.116],[side*.036,.121],[side*.059,.113]].map(([x,y])=>facePoint(x,y,identity,.001)),(identity.female?.0011:.0015)*identity.brow);
    strip(head,skin,[[side*.021,.091],[eyeX,.088],[side*.052,.092]].map(([x,y])=>facePoint(x,y,identity,.0014)),.0016);
    strip(head,skin,[[side*.021,.100],[eyeX,.104],[side*.052,.100]].map(([x,y])=>facePoint(x,y,identity,.0014)),.0017);
    const lid=part(head,side<0?'right-eyelid':'left-eyelid',eyeX,.101,eyeZ+(anatomy?.012:.004));
    faceDetail(lid,skin,0,0,0,.0155,.0025,.0035);lid.userData.openY=.101;lids.push(lid);
    }
    // Nostrils and mature nasolabial creases are inset surface marks.
    if(!anatomy){const nostril=facePoint(side*.011,.031,identity,.0015);faceDetail(head,lip,...nostril,.004,.0018,.0018);}
    if(!anatomy&&identity.age>34&&detail)strip(head,lip,[[side*.026,.039],[side*.032,.021],[side*.034,.007]].map(([x,y])=>facePoint(x,y,identity,.001)),.0008);
  }
  replacingAnatomy=true;
  const mouthZ=facePoint(0,.003,identity)[2],mouth=part(head,'facial-jaw',0,.001,mouthZ);
  const lipPoints=[[-.026*identity.mouth,.003],[-.010,.006],[0,.004],[.010,.006],[.026*identity.mouth,.003]];
  strip(mouth,lip,lipPoints.map(([x,y])=>{const v=facePoint(x,y,identity,.002);return [v[0],v[1]-.001,v[2]-mouthZ];}),.0023);
  strip(mouth,skin,[[-.021,-.002],[0,-.005],[.021,-.002]].map(([x,y])=>{const v=facePoint(x,y,identity,.003);return [v[0],v[1]-.001,v[2]-mouthZ];}),.003);
  if(identity.scar)strip(head,skin,[[.063,.077],[.061,.065],[.058,.049]].map(([x,y])=>facePoint(x,y,identity,.001)),.0014);
  mesh(head,createHairGeometry(identity,{detail}),hair);
  if(identity.beard>.3)mesh(head,createHairGeometry(identity,{detail,beard:true}),hair);
  if(identity.hair==='bound'){replacingAnatomy=false;ellipsoid(head,hair,0,.09,-.105,.058,.048,.038);}
  replacingAnatomy=false;

  const legs=[];
  for(const side of [-1,1]){
    const thigh=part(hips,side<0?'right-thigh':'left-thigh',side*.104,0,0);
    mesh(thigh,profile([[.03,.092,.102],[-.055,.105,.115],[-.14,.099,.110],[-.24,.083,.089],[-.34,.067,.071],[-.40,.058,.062],[-.44,.057,.060]],{folds:.045,foldCount:5,anatomy:'thigh'}),clothDark);
    const knee=part(thigh,'knee',0,-.43,0);
    mesh(knee,profile([[.035,.059,.063],[-.025,.065,.072],[-.085,.077,.090],[-.15,.079,.093],[-.23,.064,.074],[-.31,.049,.059],[-.38,.041,.048],[-.43,.041,.045]],{folds:.03,foldCount:5,anatomy:'calf'}),clothDark);
    const ankle=part(knee,'ankle',0,-.43,0);
    const boot=bootGeometry({side,quality:options.quality}),overviewBoot=bootGeometry({side,detail:'overview'});
    for(const [piece,mat]of [['upper',leather],['sole',black]]){const item=mesh(ankle,boot[piece],mat);item.userData.overviewGeometry=overviewBoot[piece];geometries.add(overviewBoot[piece]);}
    if(raider)for(let i=0;i<4;i++)mesh(knee,profile([[-.27+i*.04,.044,.048],[-.255+i*.04,.045,.049]],{segments:16}),cloth);
    legs.push({thigh,knee,ankle});
  }
  const arms=[];
  for(const side of [-1,1]){
    const shoulder=part(torso,side<0?'right-shoulder':'left-shoulder',side*.240,.419,0);
    replacingAnatomy=true;
    mesh(shoulder,profile([[-.125,.059,.060],[-.17,.062,.061],[-.225,.055,.055],[-.278,.044,.047],[-.318,.040,.043]],{segments:18,anatomy:'arm'}),skin);
    const elbow=part(shoulder,'elbow',0,-.30,0);
    mesh(elbow,profile([[.037,.039,.043],[-.015,.048,.051],[-.055,.052,.054],[-.105,.046,.049],[-.18,.033,.037],[-.24,.026,.031],[-.266,.026,.029]],{segments:18,anatomy:'forearm'}),skin);
    replacingAnatomy=false;
    if(veteran)mesh(elbow,profile([[-.145,.038,.041],[-.20,.034,.037]],{segments:18}),leather);
    const hand=part(elbow,'hand',0,-.258,0);
    const handOptions={side,open:!armed&&side<0,quality:options.quality},handMesh=mesh(hand,handGeometry(handOptions),skin),overviewHand=handGeometry({...handOptions,detail:'overview'});
    handMesh.userData.overviewGeometry=overviewHand;geometries.add(overviewHand);
    arms.push({shoulder,elbow,hand});
  }
  const right=arms[0],left=arms[1];

  function makeShield(){
    const s=part(left.hand,'oval-shield',0,-.01,.065),rim=new T.Shape();rim.absellipse(0,0,.265,.40,0,TAU,false,0);
    const face=mesh(s,new T.ExtrudeGeometry(rim,{depth:.025,bevelEnabled:true,bevelSize:.007,bevelThickness:.008,bevelSegments:2,steps:1,curveSegments:40}),leather,0,.03,-.022);
    // A convex oval face: radial rings bulge forward with a rolled bronze edge.
    const verts=[],uv=[],ind=[];for(let j=0;j<=6;j++){const r=j/6;for(let i=0;i<=40;i++){const a=i/40*TAU;verts.push(Math.sin(a)*.257*r,Math.cos(a)*.392*r+.03,.019+.045*(1-r*r));uv.push(.5+Math.sin(a)*r*.5,.5+Math.cos(a)*r*.5);if(j&&i){const k=j*41+i;ind.push(k,k-1,k-41,k-1,k-42,k-41);}}}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();mesh(s,g,shieldPaint);
    const rimCurve=new T.CatmullRomCurve3(Array.from({length:41},(_,i)=>new T.Vector3(Math.sin(i/40*TAU)*.262,Math.cos(i/40*TAU)*.399+.03,.021)),true);
    mesh(s,new T.TubeGeometry(rimCurve,64,.008,6,true),bronze);
    const boss=ellipsoid(s,metal,0,.03,.075,.061,.064,.048);
    for(let i=0;i<12;i++){const a=i/12*TAU;faceDetail(s,bronze,Math.sin(a)*.238,Math.cos(a)*.37+.03,.027,.007,.007,.004);}
    for(const sign of [-1,1]){
      const em=mesh(s,shapeGeometry([[.025,.1],[.055,.21],[.08,.13],[.19,.25],[.12,.11],[.18,.08],[.07,.055]],.002),white,0,.03,.058);em.scale.x=sign;
      strip(s,leather,[[sign*.055,.15,-.035],[sign*.064,.03,-.065],[sign*.055,-.10,-.035]],.014);
    }
    strip(s,bronze,[[-.07,.03,-.045],[.07,.03,-.045]],.012);return s;
  }
  const shield=archer||!armed?null:makeShield();
  const shieldContact=shield?part(shield,'shield-contact',0,.03,.13):null;
  if(shield&&mounted)shield.scale.setScalar(.82);
  if(shield&&kit.eastern)shield.scale.set(.85,.84,1);
  const weapon=armed?part(right.hand,trainer?'practice-sword':raider?'spear':'sword',0,-.052,.018):null;
  if(weapon){weapon.rotation.x=Math.PI;
  mesh(weapon,new T.CylinderGeometry(.012,.012,.095,10),leather,0,-.006,0);
  if(raider&&!archer){
    mesh(weapon,new T.CylinderGeometry(.011,.015,1.65,10),leather,0,.42,0);
    mesh(weapon,shapeGeometry([[0,.19],[-.036,.035],[-.012,0],[.012,0],[.036,.035]],.009),metal,0,1.24,0);
    mesh(weapon,new T.CylinderGeometry(.016,.013,.07,10),bronze,0,1.24,0);
  }else{
    mesh(weapon,new T.CylinderGeometry(.016,.023,.035,12),bronze,0,-.07,0);
    const guard=ellipsoid(weapon,trainer?practiceWood:bronze,0,.056,0,.062,.018,.022);
    // Ridged diamond-section blade, individually modeled faces catch light.
    const blade=new T.BufferGeometry(),v=[-.027,.073,0, .027,.073,0, 0,.073,.009, 0,.073,-.009, -.022,.47,0, .022,.47,0, 0,.47,.006, 0,.47,-.006, 0,.59,0];
    blade.setAttribute('position',new T.Float32BufferAttribute(v,3));blade.setAttribute('uv',new T.Float32BufferAttribute(v.flatMap((_,i)=>i%3===0?[(v[i]+.027)/.054,v[i+1]/.59]:[]),2));blade.setIndex([0,4,6,0,6,2,2,6,5,2,5,1,1,5,7,1,7,3,3,7,4,3,4,0,4,8,6,6,8,5,5,8,7,7,8,4]);blade.computeVertexNormals();mesh(weapon,blade,trainer?practiceWood:metal);
  }
  weapon.visible=!archer;}
  const weaponContact=weapon?part(weapon,'weapon-contact',0,raider&&!archer?1.43:.59,0):null;
  const javelin=archer||!armed?null:part(right.hand,'held-javelin',0,-.052,.018);
  if(javelin){javelin.rotation.x=Math.PI;mesh(javelin,new T.CylinderGeometry(.009,.013,1.25,8),leather,0,.30,0);mesh(javelin,new T.ConeGeometry(.024,.19,4),trainer?practiceWood:metal,0,1.02,0);javelin.visible=false;}
  const javelinRelease=javelin?part(javelin,'javelin-release',0,1.115,0):null;
  let bow=null,bowString=null,nockedArrow=null;
  if(archer){
    bow=part(left.hand,'bow',0,-.025,.028);
    strip(bow,leather,[[0,-.55,-.09],[0,-.4,.065],[0,-.19,.13],[0,0,.022],[0,.19,.13],[0,.4,.065],[0,.55,-.09]],.014);
    strip(bow,bronze,[[0,-.075,.035],[0,.075,.035]],.017);
    const stringGeometry=new T.BufferGeometry().setFromPoints([new T.Vector3(0,-.55,-.09),new T.Vector3(0,0,-.09),new T.Vector3(0,.55,-.09)]);geometries.add(stringGeometry);
    const stringMaterial=new T.LineBasicMaterial({color:0xc6b792});materials.add(stringMaterial);bowString=new T.Line(stringGeometry,stringMaterial);bow.add(bowString);
    nockedArrow=part(bow,'nocked-arrow',0,0,-.09);
    const shaft=mesh(nockedArrow,new T.CylinderGeometry(.004,.004,.7,6),clothDark,0,0,.30);shaft.rotation.x=Math.PI/2;
    const point=mesh(nockedArrow,new T.ConeGeometry(.013,.048,4),metal,0,0,.67);point.rotation.x=Math.PI/2;
    const quiver=part(torso,'quiver',-.1,.24,-.14);quiver.rotation.z=-.24;
    mesh(quiver,profile([[-.16,.041,.038],[-.12,.049,.047],[.22,.055,.05]],{segments:16}),leather);
    for(let i=0;i<4;i++){const x=(i%2-.5)*.034,z=(Math.floor(i/2)-.5)*.028;mesh(quiver,new T.CylinderGeometry(.004,.004,.49,6),clothDark,x,.24,z);const f=mesh(quiver,shapeGeometry([[-.018,0],[.018,.045],[.018,.10],[-.018,.06]],.001),white,x,.38,z);f.rotation.y=i*.8;}
  }
  // Scabbard and suspension belt remain attached to the body during action.
  if(armed){const sheath=part(torso,'scabbard',-.18,.065,-.015);sheath.rotation.z=-.16;
  mesh(sheath,profile([[.03,.034,.018],[-.42,.029,.016],[-.49,.018,.014],[-.50,.005,.007]],{segments:10}),leather);
  mesh(sheath,profile([[.033,.036,.02],[.006,.036,.02]],{segments:10}),bronze);
  mesh(sheath,profile([[-.46,.027,.018],[-.49,.021,.017]],{segments:10}),bronze);
  strip(torso,leather,[[-.21,.06,-.02],[-.08,.3,.149],[.14,.47,.116]],.022);}
  if(veteran){
    const mail=material(kit.eastern?0x9d9b83:0xb4b5a9,{metalness:.50,roughness:.8,...surface(kit.armor)});mail.name=kit.armor==='scale'?'overlapping scale armor':'interlinked mail';
    armorMaterial=mail;
    for(const side of [-1,1])strip(torso,leather,[[side*.10,.10,.142],[side*.13,.31,.155],[side*.15,.44,.102]],.019);
    const helmetRoot=part(head,`${kit.helmet}-helmet`);
    if(kit.eastern){
      mesh(helmetRoot,profile([[.135,.127,.127,-.012],[.19,.120,.121,-.012],[.28,.070,.075,-.018],[.345,.008,.01,-.024]],{segments:24}),metal);
      for(const side of [-1,1])strip(helmetRoot,bronze,[[side*.12,.14,.025],[side*.088,.24,.025],[0,.345,-.024]],.005);
      // Coif and neck guard wrap around the head, leaving the actual face open.
      mesh(helmetRoot,profile([[-.045,.123,.122,-.016],[.137,.126,.124,-.012]],{segments:24,from:1.05,to:TAU-1.05}),mail);
    }else{
      // The front rim clears the brows; the deeper guard wraps only the rear.
      const helmet=mesh(helmetRoot,new T.SphereGeometry(1,28,14,0,TAU,0,Math.PI*.5),metal,0,.132,-.012);helmet.scale.set(.128,.140,.130);
      strip(helmetRoot,bronze,[[-.12,.14,.047],[0,.146,.12],[.12,.14,.047]],.009);
      strip(helmetRoot,bronze,[[0,.146,.12],[0,.225,.092],[0,.28,-.01],[0,.22,-.118]],.007);
      mesh(helmetRoot,profile([[.078,.132,.133,-.013],[.134,.128,.130,-.012]],{segments:28,from:1.05,to:TAU-1.05}),metal);
      for(const side of [-1,1]){const cheek=mesh(helmetRoot,shapeGeometry([[-.024,.055],[.027,.05],[.032,-.045],[.008,-.07],[-.025,-.044]],.009),metal,side*.108,.077,.046);cheek.rotation.y=side*.8;}
    }
    if(kit.officer){
      const crest=part(helmetRoot,'officer-horsehair-crest');
      const crestMat=material(0x742e31,clothSurface);
      strip(crest,bronze,[[-.11,.257,-.008],[0,.288,-.008],[.11,.257,-.008]],.012);
      const plume=[];for(let i=0;i<=28;i++){const x=(i/28-.5)*.28;plume.push([x,.367-.046*(x/.14)**2+(i%2)*.0015]);}
      for(let i=14;i>=0;i--){const x=(i/14-.5)*.23;plume.push([x,.292-.036*(x/.115)**2]);}
      mesh(crest,shapeGeometry(plume,.024),crestMat,0,0,-.02);
      for(let i=0;i<=22;i++){const x=(i/22-.5)*.22;strip(crest,crestMat,[[x,.294-.031*(x/.11)**2,.006],[x*1.13,.333-.035*(x/.11)**2,.008],[x*1.25,.365-.044*(x/.11)**2,.006]],.0015);}
    }else if(kit.veteranTier>=3){
      const vCrest=part(helmetRoot,'veteran-crest');
      strip(vCrest,bronze,[[-.085,.252,-.008],[0,.276,-.008],[.085,.252,-.008]],.01);
      mesh(vCrest,shapeGeometry([[-.095,.27],[-.07,.335],[0,.345],[.07,.335],[.095,.27]],.018),clothDark,0,0,-.016);
    }
    if(kit.veteranTier>=2){
      const phalerae=part(torso,'veteran-phalerae');
      strip(phalerae,leather,[[-.09,.33,.156],[0,.26,.162],[.09,.33,.156]],.009);
      for(const [px,py]of [[-.068,.315],[0,.325],[.068,.315],[-.042,.235],[.042,.235]])faceDetail(phalerae,bronze,px,py,.164,.018,.018,.006);
    }
  }
  let cloak=null;
  if(kit.cloak){
    cloak=part(torso,'command-cloak');clothRigs.push(createClothRig(cloak,.44,.08,-.42));const red=material(kit.officer?0x78333b:0x665c47,{...clothSurface,side:T.DoubleSide});
    mesh(cloak,drape([[.44,0,.37,-.16],[.28,.015,.46,-.20],[.09,.02,.51,-.23],[-.13,.025,.56,-.26],[-.42,.03,.54,-.28]]),red);
    ellipsoid(torso,bronze,-.178,.41,.126,.024,.024,.009);
  }
  if(civic){
    const toga=part(torso,'draped-civic-robe');clothRigs.push(createClothRig(toga,.49,.04,-.54));const ivory=material(p.cloth,{...clothSurface,side:T.DoubleSide}),stripe=material(unit.bloc==='Army'?0x786844:unit.bloc==='People'?0x6a7969:0x764653,{...clothSurface,side:T.DoubleSide});
    const rows=[[.49,.18,.15,.15],[.37,.08,.38,.205],[.19,-.015,.46,.225],[.02,-.025,.48,.215],[-.22,.025,.49,.22],[-.40,.06,.42,.205],[-.54,.08,.34,.185]];
    mesh(toga,drape(rows),ivory);
    // The colored edging follows the same fold surface with a small outward
    // offset. Independent flat chest stripes formerly cut through the drape.
    for(const from of [.12,.84])mesh(toga,drape(rows,{from,to:from+.035,offset:.009}),stripe);
    const scroll=part(left.hand,'rolled-petition',0,-.045,.035);mesh(scroll,new T.CylinderGeometry(.019,.019,.16,10),white,0,0,0).rotation.z=Math.PI/2;
  }else if(escort){
    const pack=part(torso,'travel-bundle',0,.23,-.20);mesh(pack,profile([[-.17,.15,.065],[-.08,.17,.09],[.15,.14,.08],[.20,.10,.055]],{segments:16,folds:.06}),clothDark);
    for(const x of [-.10,.10])strip(torso,leather,[[x,-.02,.13],[x,.43,.14],[x,.48,-.13],[x,.06,-.27]],.012);
    if(kit.wounded){const wrap=part(torso,'wounded-arm-sling');mesh(wrap,drape([[.32,-.15,.045,.17],[.18,0,.21,.24],[.13,.05,.22,.21]]),white);}
  }
  let signum=null;
  if(kit.signum){
    signum=part(torso,'actor-signum',.16,.12,-.15);signum.userData.signumKind=kit.signum;
    const importedAquila=kit.signum==='aquila'?(options.aquilaLibrary?.geometry()??aquilaGeometry()):null;
    if(importedAquila){
      if(!importedAquila.attributes.uv){const cnt=importedAquila.attributes.position.count;importedAquila.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(cnt*2),2));}
      const aqMesh=mesh(signum,importedAquila,bronze);aqMesh.name='imported-aquila-standard';signum.userData.importedAquila=true;group.userData.actor.aquilaImported=true;
    }else{
      if(kit.signum==='aquila'&&typeof window!=='undefined')warmAquilaAsset();
      mesh(signum,new T.CylinderGeometry(.009,.011,1.32,8),bronze,0,.52,0);
      const bar=mesh(signum,new T.CylinderGeometry(.007,.007,.28,8),bronze,0,1.06,0);bar.rotation.z=Math.PI/2;
      for(const dy of [.62,.76,.90])faceDetail(signum,bronze,0,dy,.014,.022,.022,.005);
      if(kit.signum==='aquila')mesh(signum,shapeGeometry([[0,1.15],[-.12,1.22],[-.05,1.25],[0,1.19],[.05,1.25],[.12,1.22]],.012),bronze);
      else mesh(signum,shapeGeometry([[0,1.28],[-.035,1.17],[0,1.14],[.035,1.17]],.009),bronze);
    }
  }
  const horse=mounted?createHorse(root,kit,{part,mesh,profile:(rings,spec={})=>profile(rings,{...spec,subdivisions:1}),ellipsoid,strip,material,surface,leather,metal,hair,cloth}):null;
  const ring=mesh(group,new T.RingGeometry(mounted?.72:.32,mounted?.75:.343,48),new T.MeshBasicMaterial({color:0xe6bc6c,transparent:true,opacity:.85,side:T.DoubleSide}),0,.009,0);materials.add(ring.material);ring.rotation.x=-Math.PI/2;ring.visible=false;ring.castShadow=false;ring.receiveShadow=false;
  // Build overview geometry once, before near-detail batching. One colored
  // draw per rigid joint keeps the real role silhouette while dropping tiny
  // rivets, fingers and surface sampling that cannot be read at this distance.
  let farMeshes=[],nearMeshes=[];const overviewMaterial=material(0xffffff,{vertexColors:true,roughness:.86,metalness:.08,side:T.DoubleSide});
  overviewMaterial.name='overview role colors';
  function overview(parent){
    for(const child of [...parent.children])if(child.isGroup||child.isBone)overview(child);
    const all=parent.children.filter(o=>o.isMesh&&o.material.isMeshStandardMaterial);if(!all.length)return;
    const kept=all.filter(item=>{item.geometry.computeBoundingBox();const size=item.geometry.boundingBox.getSize(new T.Vector3()).multiply(item.scale);return Math.max(size.x,size.y,size.z)>=.075;});
    if(!kept.length)kept.push(all.reduce((a,b)=>a.geometry.attributes.position.count>b.geometry.attributes.position.count?a:b));
    const positions=[],normals=[],colors=[];
    for(const item of kept){item.updateMatrix();const geometry=item.userData.overviewGeometry??item.geometry,source=geometry.index?geometry.toNonIndexed():geometry.clone();source.applyMatrix4(item.matrix);positions.push(...source.attributes.position.array);normals.push(...source.attributes.normal.array);for(let i=0;i<source.attributes.position.count;i++){const c=source.attributes.color;colors.push(item.material.color.r*(c?.getX(i)??1),item.material.color.g*(c?.getY(i)??1),item.material.color.b*(c?.getZ(i)??1));}source.dispose();if(geometry!==item.geometry){geometries.delete(geometry);geometry.dispose();delete item.userData.overviewGeometry;}}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const simple=mesh(parent,g,overviewMaterial);simple.name='overview-detail';simple.userData.overview=true;simple.visible=false;farMeshes.push(simple);
  }
  overview(group);
  if(anatomy){const replaced=[];group.traverse(o=>{if(o.isMesh&&o.userData.anatomyReplacement)replaced.push(o);});for(const item of replaced){item.removeFromParent();geometries.delete(item.geometry);item.geometry.dispose();}}
  // Batch rigid details by material within each joint. Faces, folds, fingers
  // and equipment remain real geometry without hundreds of separate draws.
  const tintedMaterials=new Map();
  function batchKey(mat){return mat.isMeshStandardMaterial&&!mat.transparent?actorMaterialKey(mat):mat;}
  function batch(parent){
    for(const child of [...parent.children])if(child.isGroup||child.isBone)batch(child);
    const buckets=new Map();for(const child of parent.children)if(child.isMesh&&!child.userData.overview){const key=batchKey(child.material),bucket=buckets.get(key)??[];bucket.push(child);buckets.set(key,bucket);}
    for(const [key,items]of buckets){if(items.length<2)continue;const positions=[],normals=[],uv=[],colors=[],mixed=items.some(item=>item.material!==items[0].material||item.geometry.attributes.color);let mat=items[0].material;
      if(mixed){if(!tintedMaterials.has(key)){const merged=mat.clone();merged.color.set(0xffffff);merged.vertexColors=true;materials.add(merged);tintedMaterials.set(key,merged);}mat=tintedMaterials.get(key);}
      for(const item of items){item.updateMatrix();const source=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone();source.applyMatrix4(item.matrix);positions.push(...source.attributes.position.array);normals.push(...source.attributes.normal.array);uv.push(...(source.attributes.uv?.array??new Float32Array(source.attributes.position.count*2)));if(mixed)for(let i=0;i<source.attributes.position.count;i++){const c=source.attributes.color;colors.push(item.material.color.r*(c?.getX(i)??1),item.material.color.g*(c?.getY(i)??1),item.material.color.b*(c?.getZ(i)??1));}source.dispose();parent.remove(item);geometries.delete(item.geometry);item.geometry.dispose();}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(mixed)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));mesh(parent,g,mat);
    }
  }
  batch(group);
  group.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial&&!o.userData.overview)nearMeshes.push(o);});
  nearMeshes=bindActorSurfaces(group,nearMeshes,{geometries,materials,skeletons,clothRigs});
  farMeshes=bindActorSurfaces(group,farMeshes,{geometries,materials,skeletons,clothRigs,overview:true});
  const costume=mountActorCostume(group,{kit,cloth,armor:armorMaterial,quality:options.quality,geometries,materials,skeletons});
  nearMeshes.push(...costume.nearMeshes);farMeshes.push(...costume.farMeshes);
  if(anatomy){const fittedHair=hair.clone();materials.add(fittedHair);if(anatomy.importedHair)Object.assign(fittedHair,acquireActorHairSurface(identity));else fittedHair.alphaHash=true;const beardHair=hair.clone();beardHair.color.lerp(new T.Color(0x86725c),.18);beardHair.roughness=.92;beardHair.alphaHash=true;materials.add(beardHair);nearMeshes.push(...mountActorAnatomy(group,anatomy,{skin:importedSkin,hair:fittedHair,beardHair,geometries,materials,skeletons}));}
  for(const m of materials)if(m.isMeshStandardMaterial&&m!==overviewMaterial)finishActorMaterial(m);
  const planting=createFootPlanting(),ankleRotation=new T.Quaternion(),footRotation=new T.Quaternion(),footEuler=new T.Euler(0,0,0,'ZXY'),tipPosition=new T.Vector3(),shoulderPosition=new T.Vector3();
  let disposed=false,far=false,lastMotion=null,lastPose=null,transition=null,previousYaw=null;
  const blendable=p=>({...p,leftArm:[...p.leftArm],rightArm:[...p.rightArm],feet:p.feet.map(f=>({...f}))});
  function detailLevel(input){const distance=Number.isFinite(input.detailDistance)?input.detailDistance:0,next=input.active||input.selected?false:far?distance>=14:distance>18;
    if(next!==far){far=next;for(const m of nearMeshes)m.visible=!far;for(const m of farMeshes)m.visible=far;}
    group.userData.actor.detail=far?'overview':'near';
  }
  function update(input={}){
    if(disposed)return;
    detailLevel(input);
    if(input.resetPose){planting.reset();lastPose=null;lastMotion=null;transition=null;previousYaw=null;}
    if(!(Number.isFinite(input.dt)&&input.dt>0))transition=null;
    const mapped=civic&&['withdrawn','dead'].includes(input.motion)?{...input,motion:'yield',health:1}:civic&&['attack','strike','throw'].includes(input.motion)?{...input,motion:'speak'}:input;
    let pose=actorPose({...mapped,weapon:raider?'spear':trainer?'practice':'sword',mounted});const motion=mapped.motion??'idle';
    if(lastPose&&lastMotion!==motion&&Number.isFinite(input.dt)&&input.dt>0&&(input.phase===undefined||input.phase<.12||motion==='idle'))transition={from:blendable(lastPose),elapsed:0};
    if(transition){transition.elapsed+=Math.min(.05,Math.max(0,input.dt||0));pose=blendActorPose(transition.from,pose,transition.elapsed/.12);if(transition.elapsed>=.12)transition=null;}
    lastMotion=motion;
    if(previousYaw!==null&&!input.reducedMotion&&['walk','run','retreat'].includes(motion)&&input.dt>0){const turn=Math.atan2(Math.sin(pose.yaw-previousYaw),Math.cos(pose.yaw-previousYaw)),lean=Math.max(-.18,Math.min(.18,turn/Math.max(.008,input.dt)*.028));pose.bodyY-=lean;pose.headY+=lean*.6;pose.bodyZ-=lean*.22;}
    previousYaw=pose.yaw;
    if(civic){if(!['yield','speak','rally','order'].includes(mapped.motion)){pose.leftArm[0]=-.45;pose.leftElbow=-1.15;}if(['hit','hurt'].includes(mapped.motion)){pose.bodyX*=.35;pose.bodyZ*=.35;pose.headX*=.5;}}
    if(kit.wounded){pose.leftArm[0]=-.60;pose.leftElbow=-1.3;pose.bodyZ-=.035;}
    const throwing=armed&&!archer&&input.motion==='throw';if(weapon)weapon.visible=!archer&&!throwing;if(javelin)javelin.visible=throwing&&(input.phase??0)<.5;
    if(archer){const firing=['throw','attack','strike'].includes(input.motion),p=Number.isFinite(input.phase)?Math.max(0,Math.min(1,input.phase)):0,draw=firing?(p<.5?Math.sin(p*Math.PI):Math.max(0,1-(p-.5)*8)):0;
      const smooth=t=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);},raise=firing?smooth(p/.18)*(1-smooth((p-.78)/.22)):0;
      pose.leftArm=[-.35-1.05*raise,0,-.12];pose.leftElbow=-.35+.19*raise;pose.rightArm=[-.1-1.1*raise,0,.08];pose.rightElbow=-.35-1.55*draw;pose.bodyY=-.12*draw;
      bow.rotation.x=-pose.leftArm[0]-pose.leftElbow;bowString.geometry.attributes.position.setZ(1,-.09-.26*draw);bowString.geometry.attributes.position.needsUpdate=true;
      nockedArrow.visible=firing&&p<.52;nockedArrow.position.z=-.09-.26*draw;
    }
    lastPose=blendable(pose);
    let horseMotion=null;
    if(horse){const authored=horsePose(input),samples=planting.sample({pose:authored,mounted:true,position:group.position,direction:pose.yaw,motion,phase:input.phase,groundHeight:input.groundHeight,scaleY:group.scale.y,reset:input.resetPose});horseMotion=horse.update(input,groundHorsePose(authored,samples));
      pose.hipY=1.56+horseMotion.riderBob-.38*horseMotion.fall;pose.hipZ=-.08+pose.hipZ*.4;pose.bodyX+=horseMotion.bodyPitch;pose.bodyZ+=horseMotion.tail*.12;
    }else{const samples=planting.sample({pose,position:group.position,direction:pose.yaw,motion,phase:input.phase,groundHeight:input.groundHeight,scaleY:group.scale.y,reset:input.resetPose});
      // Blending feet also needs a fresh IK solve when no terrain is supplied.
      groundHumanPose(pose,samples??pose.feet.map((f,i)=>({height:0,x:(i?1:-1)*.104,z:f.z})));
    }
    const expr=actorExpression({...mapped,seed:kit.identity,gazeYaw:input.gazeYaw,gazePitch:input.gazePitch,reducedMotion:input.reducedMotion});
    group.rotation.y=pose.yaw;hips.position.set(pose.hipX??0,pose.hipY,pose.hipZ);hips.rotation.z=horseMotion?-horseMotion.fall*.6:0;torso.rotation.set(pose.bodyX,pose.bodyY,pose.bodyZ);head.rotation.set(pose.headX+expr.headPitchOffset,pose.headY+expr.headYawOffset,0);skirt.rotation.x=pose.skirt;
    const seconds=Number.isFinite(input.time)?Math.max(0,input.time):0,blinkPhase=(seconds+((kit.identity%13)*.13))%4.7,blink=input.reducedMotion?0:blinkPhase>4.46?Math.sin((blinkPhase-4.46)/.24*Math.PI):0,closure=Math.min(1,blink+expr.lidFocus*(1-blink));
    for(const lid of lids){if(lid.userData.closeDistance){lid.position.y=-closure*lid.userData.closeDistance;lid.position.z=closure*.0006;}else{lid.position.y=lid.userData.openY-closure*.005;lid.scale.y=1+closure*2.5;}}
    for(const brow of brows){brow.position.y=expr.browY;brow.position.z=Math.abs(expr.browY)*.25;brow.rotation.z=brow.userData.side*expr.browTilt;}
    const speaking=!input.reducedMotion&&['speak','conversation','rally','order'].includes(motion),emphasis=speaking?Math.abs(sampleActorClip('speech',input.phase??0).rightArmX??0):0,jaw=Math.max(emphasis,expr.jawOpen);
    mouth.rotation.x=jaw*.12;mouth.position.y=.001-jaw*.0024;
    for(let i=0;i<2;i++){legs[i].thigh.rotation.set(mounted?-1.05:pose.legs[i].thigh,0,mounted?(i?1:-1)*.48:pose.legs[i].splay??0,'ZXY');legs[i].knee.rotation.x=mounted?1.75:pose.legs[i].knee;
      if(mounted)legs[i].ankle.rotation.set(-.60,0,0);else {ankleRotation.copy(legs[i].thigh.quaternion).multiply(legs[i].knee.quaternion).invert();footRotation.setFromEuler(footEuler.set(pose.feet[i].roll+(pose.feet[i].pitch??0),0,pose.feet[i].bank??0,'ZXY'));legs[i].ankle.quaternion.copy(ankleRotation.multiply(footRotation));}
    }
    right.shoulder.rotation.set(...pose.rightArm);left.shoulder.rotation.set(...pose.leftArm);right.elbow.rotation.x=pose.rightElbow;left.elbow.rotation.x=pose.leftElbow;right.hand.rotation.x=pose.rightWrist;left.hand.rotation.x=pose.leftWrist;
    if(shield){shield.rotation.x=-(pose.leftArm[0]+pose.leftElbow+pose.leftWrist)+pose.shieldTilt;shield.rotation.z=-pose.leftArm[2];}
    if(weapon&&raider&&!archer){const ready=['attack','strike'].includes(input.motion)?actionEnvelope(input.motion,input.phase).preparation:0;weapon.rotation.x=Math.PI/2-pose.rightArm[0]-pose.rightElbow-.18*(1-ready);}
    if(cloak){cloak.rotation.x=pose.skirt*.55+Math.max(0,-pose.bodyX)*.12;cloak.rotation.z=pose.bodyY*-.08;}
    if(signum){
      if(input.reducedMotion||!Number.isFinite(input.time)){signum.rotation.set(0,0,0);}
      else{const sway=input.time*2.2+(kit.identity%7)*.7;signum.rotation.set(Math.cos(sway*.78)*.035-pose.bodyX*.25,0,Math.sin(sway)*.045);}
    }
    for(const rig of clothRigs)rig.update(pose,{...input,mounted});
    ring.visible=!!input.selected;
    group.updateMatrixWorld(true);
    if(weaponContact&&!archer&&['attack','strike'].includes(input.motion)&&Number.isFinite(input.aimHeight)){
      const contact=actionEnvelope(input.motion,input.phase).reach;
      weaponContact.getWorldPosition(tipPosition);right.shoulder.getWorldPosition(shoulderPosition);
      const reach=Math.max(.4,Math.hypot(tipPosition.x-shoulderPosition.x,tipPosition.z-shoulderPosition.z));
      // Aim from the real shoulder/weapon chain, with a bounded arm correction.
      // No stretching, snapping to a hit point or change to the contact clock.
      right.shoulder.rotation.x+=Math.max(-.4,Math.min(.55,Math.atan2(tipPosition.y-input.aimHeight,reach)))*contact;
      group.updateMatrixWorld(true);
    }
    for(const skeleton of skeletons)skeleton.update();
  }
  function dispose(){if(disposed)return;disposed=true;for(const skeleton of skeletons)skeleton.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const kind of surfaces.keys())releaseActorSurface(kind);if(anatomy)complexion.release(identity);if(anatomy?.importedHair)releaseActorHairSurface();group.removeFromParent();}
  const contacts={weapon:weaponContact,shield:shieldContact,body:torso,feet:horse?.feet??legs.map(l=>l.ankle),footClearance:(mounted?.075:.07)*group.scale.y};
  function getReleasePoint(target=new T.Vector3()){
    if(archer&&nockedArrow){target.set(0,0,.694);return nockedArrow.localToWorld(target);}
    return (javelinRelease??right.hand).getWorldPosition(target);
  }
  update();return {group,update,dispose,contacts,getReleasePoint};
}
