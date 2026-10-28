import {mountCharacterDetail} from './character-detail.js';
import * as T from '../../vendor/three/three.module.js';
import {actorPose,horsePose,groundHumanPose,groundHorsePose,blendActorPose,blendHorsePose,createFootPlanting,actionEnvelope,horseGaitForSpeed} from './actor-pose.js';
import {actorKit} from './actor-kit.js';
import {acquireActorSurface,releaseActorSurface} from './actor-materials.js';
import {finishActorMaterial} from './actor-surface.js';
import {addNeutralMaps} from './model-materials.js';
import {createHorse} from './actor-horse.js';
import {horseBody,warmHorseBody,mountHorseBody,HORSE_REPLACES} from './horse-bodies.js';
import {bindActorSurfaces,createClothRig} from './actor-skin.js';
import {actorIdentity} from './actor-identity.js';
import {shieldDesign,shieldDecals} from './shield-patterns.js';
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
import {actorEye,actorBrow,actorExpression} from './actor-face.js';
import {BLOC_STYLE,trimBands} from '../ui/bloc-style.js';
import {FALLEN_POSE,MOUNTED_FALLEN_POSE,bakeFallenGeometry} from './battle-remains.js';
import {installCloudShadows} from './atmosphere.js';
import {actorWardrobe} from './actor-wardrobe.js';
import {applyCharacterPresence,performanceTransition,applyPerformance,applyTurnPerformance} from './actor-performance.js';
import {applyGaitTurn} from './actor-gait.js';
import {updateActorExpressionMorphs} from './actor-expression-mesh.js';
import {simplifyActorOverview} from './actor-overview.js';
import {cheekGuardGeometry,helmetBowlGeometry} from './actor-helmet.js';
import {ACTOR_BODIES,actorBodyId,horseBodyId} from '../ui/actor-body-catalog.js';
import {actorBody,warmActorBody,mountActorBody,blocTrimGeometry,BODY_REPLACES,BARE_HEAD_REPLACES} from './actor-bodies.js';
import {IDENTITY_HEAD_BODY,usesPersistentHead} from './generated-identity.js';
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
// A delegate's bloc reads from the toga trim, in the colour both views share
// (bloc-style.js) and in a trim shape of its own.
export const BLOC_TRIM=Object.freeze(Object.fromEntries(Object.entries(BLOC_STYLE).map(([bloc,style])=>[bloc,parseInt(style.color.slice(1),16)])));
export function createActor(unit={},options={}){
  let rig=createActorRig(unit,options),disposed=false,lastInput={},group=rig.group,rebuilt=false;
  const contacts=rig.contacts,source=options.assetLibrary;
  const kit=actorKit(unit,options),identity=actorIdentity(unit,kit);
  // A generated body, where one fits the figure's kit, replaces the procedural figure once it loads.
  const bodyId=actorBodyId(kit,identity.key),bodies=options.bodyLibrary;
  const warmBody=id=>bodies?bodies.warm(id):warmActorBody(id);
  // A mounted figure's generated horse, where its side has one, likewise replaces the code-built horse.
  const horseId=horseBodyId(kit),horses=options.horseLibrary;
  const horseReady=horseId&&(horses||typeof window!=='undefined')?(horses?horses.warm(horseId):warmHorseBody(horseId)):Promise.resolve(false);
  const bodyReady=(bodyId||usesPersistentHead(identity))&&(bodies||typeof window!=='undefined')?Promise.all([bodyId?warmBody(bodyId):warmBody(IDENTITY_HEAD_BODY),...(bodyId&&usesPersistentHead(identity)?[warmBody(IDENTITY_HEAD_BODY)]:[])]).then(([ready])=>ready):Promise.resolve(false);
  const complexion=options.complexionLibrary??defaultComplexion,preloadComplexion=!!options.complexionLibrary||typeof window!=='undefined';
  let pendingComplexion=false;
  const releasePendingComplexion=()=>{if(pendingComplexion){pendingComplexion=false;complexion.release(identity);}};
  // The temporary owner protects a shared decode until the imported rig owns
  // its map. An abandoned fallback must not leave a warm-only GPU texture.
  if(preloadComplexion){complexion.acquire(identity);pendingComplexion=true;}
  const assetReady=source?source.warm(identity):typeof window!=='undefined'?warmActorAssets(identity):Promise.resolve(actorAssetStatus(identity).ready);
  const hairReady=!identity.female&&!['bound','long','shaved'].includes(identity.hair)?warmActorHair():Promise.resolve(false);
  const ready=Promise.all([assetReady,preloadComplexion?complexion.warm(identity):null,hairReady,bodyReady,horseReady]).then(([loaded,,hairLoaded,bodyLoaded,horseLoaded])=>{
    if(disposed)return false;
    const built=group.userData.actor;
    if(!horseLoaded||built.horse===horseId){
      if(bodyLoaded){const headLoaded=usesPersistentHead(identity)&&!!(bodies?bodies.body(IDENTITY_HEAD_BODY):actorBody(IDENTITY_HEAD_BODY));if((bodyId?built.body===bodyId:true)&&(!headLoaded||built.persistentIdentity))return true;}
      else if(!loaded)return horseLoaded;
      else if(built.imported&&(!hairLoaded||built.hairImported))return true;
    }
    const parent=group.parent;rig.dispose();group.clear();rebuilt=true;
    rig=createActorRig(unit,options,group);Object.assign(contacts,rig.contacts);
    if(parent)parent.add(group);rig.update({...lastInput,resetPose:true});return true;
  }).finally(releasePendingComplexion);
  // rebuilt: whether arriving assets replaced the first build (the stage then
  // re-forms the figure's followers; a figure built complete keeps them).
  return {group,contacts,ready,get rebuilt(){return rebuilt;},update(input={}){if(!disposed){lastInput={...input};rig.update(input);}},
    // The figure's overview surfaces held in its collapse and laid on the
    // ground, for the battle's remains; its own pose is restored at once.
    bakeFallen(){if(disposed)return null;const mounted=!!group.userData.actor?.mounted;rig.update({...(mounted?MOUNTED_FALLEN_POSE:FALLEN_POSE),unit:lastInput.unit});const geometry=bakeFallenGeometry(group,{mounted});rig.update({...lastInput,resetPose:true});return geometry;},getReleasePoint(target){return rig.getReleasePoint(target);},dispose(){if(disposed)return;disposed=true;releasePendingComplexion();rig.dispose();}};
}
function createActorRig(unit={},options={},reuseGroup=null){
  const kit=actorKit(unit,options),{role,trainer,archer,mounted,civic,escort}=kit,veteran=kit.armored,raider=['Gothic','Persian','Palmyrene'].includes(kit.faction),armed=kit.armed,identity=actorIdentity(unit,kit);
  const spear=kit.equipped?kit.weapon==='spear':raider,bladeLength=kit.weapon==='knife'?.24:kit.weapon==='gladius'?.48:kit.weapon==='spatha'?.74:.59;
  const complexion=options.complexionLibrary??defaultComplexion;
  const bodyId=actorBodyId(kit,identity.key),body=bodyId?(options.bodyLibrary?options.bodyLibrary.body(bodyId):actorBody(bodyId)):null;
  // The donor head every named man's face is made from; a named man's own body brings his own.
  const donorBody=usesPersistentHead(identity)?(options.bodyLibrary?options.bodyLibrary.body(IDENTITY_HEAD_BODY):actorBody(IDENTITY_HEAD_BODY)):null;
  const identityBody=usesPersistentHead(identity)?(body?.head?body:donorBody):null;
  const horseId=horseBodyId(kit),horseCoat=horseId?(options.horseLibrary?options.horseLibrary.body(horseId):horseBody(horseId)):null;
  const anatomy=body||identityBody?null:options.assetLibrary?.anatomy(identity,{quality:options.quality})??actorAnatomy(identity,{quality:options.quality}),facePoint=(x,y,id,offset=0)=>anatomy?anatomy.facePoint(x,y,offset):faceSurfacePoint(x,y,id,offset);
  const detail=options.quality!=='performance',profile=(rings,spec={})=>{const g=garmentGeometry(rings,{...spec,subdivisions:spec.subdivisions??(detail&&(spec.anatomy||spec.folds)?2:1),segments:detail?Math.min(spec.segments??18,20):Math.min(spec.segments??18,12)});return spec.anatomy?sculptActorGeometry(g,spec.anatomy,spec.side?{...identity,side:spec.side}:identity):g;};
  const wardrobe=actorWardrobe(identity,kit),factionColors={Gothic:{cloth:0x82704f,hair:0x493526,shield:0x85392e},Persian:{cloth:0x9d8e72,hair:0x2c2521,shield:0x8b553f},Palmyrene:{cloth:0xd1bb90,hair:0x33251e,shield:0x7e4035},Civilian:{cloth:0xb8ae91,shield:0x8f714a}};
  const civicCloth={Veterans:0xc6aa98,Landholders:0xd8c39a,Civic:0xb8c9d7,Army:0xa9997a,Chamber:0xc4b3cf,People:0xb6c5b2};
  const p={...DEFAULTS,...factionColors[kit.faction],skin:identity.skin,...(kit.officer?{cloth:0xb8b097,shield:0x7b3034}:{}),...(civic?{cloth:unit.id==='hero'?0xe4dbc3:civicCloth[unit.bloc]??0xc2bba4}:{}),...(trainer?{cloth:0xb8aa86,hair:0x594739,shield:0x875c41,skin:0xb98364}:{}),...wardrobe.palette,...(kit.linen?{cloth:0xe1d8bc}:{}),...options.palette};
  if(kit.appearance&&!civic){p.cloth=[0xd1c6a8,0x994b42,0x456c88,0xbc9750][kit.appearance.tunic]??p.cloth;
    wardrobe.cloak=[0x665442,0x45494a,0x813c37,0x4b624a][kit.appearance.cloak]??wardrobe.cloak;}
  const geometries=new Set(),materials=new Set(),skeletons=new Set(),clothRigs=[],blocTrims=[],surfaces=new Map(),group=reuseGroup??new T.Group(),root=new T.Group();group.add(root);group.scale.y=1.05;
  group.name=`actor:${unit.id??role}`;group.userData.actor={unitId:unit.id,role,faction:kit.faction,veteranTier:kit.veteranTier,height:mounted?2.68:kit.officer?2.02:kit.eastern?1.97:1.86,forward:'+Z',mounted,armor:kit.armor,helmet:kit.helmet,equipment:kit.equipment??null,weapon:kit.weapon??(spear?'spear':'spatha'),identity:identity.key,age:identity.age,model:body?`generated body ${body.id}`:anatomy?'MakeHuman CC0 adapted anatomy':'original-landmark-sculpt',body:body?.id??null,imported:!!anatomy,hairImported:!!anatomy?.importedHair,clips:'authored-keyframes-v017-through-v035',shieldDesign:shieldDesign(kit,identity).id};
  const material=(color,extra={})=>{const Constructor=options.quality==='high'&&extra.roughnessMap&&extra.metalness===0?T.MeshPhysicalMaterial:T.MeshStandardMaterial;const m=new Constructor({color,roughness:.84,metalness:0,...extra,...(Constructor===T.MeshPhysicalMaterial?{sheen:.18,sheenRoughness:.85,sheenColor:new T.Color(color).multiplyScalar(.25)}:{})});materials.add(m);return m;};
  const surface=kind=>{if(!surfaces.has(kind))surfaces.set(kind,acquireActorSurface(kind));return surfaces.get(kind);};
  const clothSurface=surface('cloth'),leatherSurface=surface('leather'),paintSurface=surface('paint');
  const skin=material(new T.Color(p.skin).offsetHSL(0,-.01,((kit.identity%9)-4)*.008),{roughness:.78,...surface('skin')}),cloth=material(p.cloth,clothSurface),clothDark=material(new T.Color(p.cloth).lerp(new T.Color(0x705238),.32).multiplyScalar(.72),clothSurface),leather=material(p.leather,leatherSurface),hair=material(new T.Color(p.hair).lerp(new T.Color(0x807669),identity.grey),surface('hair')),metal=material(p.metal,surface('metal')),bronze=material(p.bronze,surface('metal')),white=material(0xd7cbaa),black=material(0x241b17),eyeWhite=material(0xbfb4a2,{roughness:.28}),iris=new T.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:.27,clearcoat:.8,clearcoatRoughness:.15}),shieldPaint=material(p.shield,paintSurface),lip=material(raider?0x925c47:0x85503f),practiceWood=trainer?material(0x9d8053,paintSurface):null;
  materials.add(iris);let armorMaterial=null;
  metal.roughness=wardrobe.metalRoughness;
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
  const skirt=part(torso,'tunic-hem');clothRigs.push(createClothRig(skirt,.055,hem*.45,hem));
  if(veteran)mesh(skirt,profile([[hem,.238,.156],[hem+.045,.239,.155],[hem*.55,.220,.146],[-.08,.197,.139],[-.025,.186,.132],[.03,.180,.125],[.055,.176,.116]],{folds:.07,foldCount:7}),cloth);
  // Garment folds belong to the shaped surface. Avoid separate chest tubes
  // whose fixed depth floated above narrower bodies at three-quarter angles.
  mesh(skirt,profile([[hem-.002,.241,.158],[hem+.016,.242,.158]],{folds:.07,foldCount:7}),clothDark);
  mesh(torso,profile([[.02,veteran?.204:.187,veteran?.157:.144],[.069,veteran?.204:.187,veteran?.157:.144]],{segments:24}),leather);
  mesh(torso,shapeGeometry([[-.028,-.025],[.028,-.025],[.028,.025],[-.028,.025]],.006),bronze,0,.044,veteran?.165:.152);
  replacingAnatomy=true;
  const neck=mesh(torso,profile([[.466,.077,.061],[.49,.064,.057],[.535,.057,.055],[.578,.060,.058],[.60,.061,.059]],{segments:18}),skin);
  const head=part(torso,'head',0,(identityBody&&!body)? .475 : .575,0);
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
  if(identity.hair!=='shaved')mesh(head,createHairGeometry(identity,{detail}),hair);
  if(identity.beard>.3)mesh(head,createHairGeometry(identity,{detail,beard:true}),hair);
  if(identity.hair==='bound'){replacingAnatomy=false;ellipsoid(head,hair,0,.09,-.105,.058,.048,.038);}
  replacingAnatomy=false;

  const legs=[];
  for(const side of [-1,1]){
    const thigh=part(hips,side<0?'right-thigh':'left-thigh',side*.104,0,0);
    mesh(thigh,profile([[.03,.092,.102],[-.055,.105,.115],[-.14,.099,.110],[-.24,.083,.089],[-.34,.067,.071],[-.40,.058,.062],[-.44,.057,.060]],{folds:.045,foldCount:5,anatomy:'thigh'}),kit.equipped&&!kit.trousers?skin:clothDark);
    const knee=part(thigh,'knee',0,-.43,0);
    mesh(knee,profile([[.035,.059,.063],[-.025,.065,.072],[-.085,.077,.090],[-.15,.079,.093],[-.23,.064,.074],[-.31,.049,.059],[-.38,.041,.048],[-.43,.041,.045]],{folds:.03,foldCount:5,anatomy:'calf'}),kit.equipped&&!kit.trousers?skin:clothDark);
    const ankle=part(knee,'ankle',0,-.43,0);
    const boot=bootGeometry({side,quality:options.quality}),overviewBoot=bootGeometry({side,detail:'overview'});
    for(const [piece,mat]of [['upper',kit.equipped&&!kit.boots?skin:leather],['sole',kit.equipped&&!kit.boots?skin:black]]){const item=mesh(ankle,boot[piece],mat);item.userData.overviewGeometry=overviewBoot[piece];geometries.add(overviewBoot[piece]);}
    if(kit.greaves){const guard=part(knee,'equipped-greave');mesh(guard,profile([[-.035,.072,.080],[-.10,.083,.099],[-.24,.069,.083],[-.33,.054,.063]],{segments:16,from:-1.35,to:1.35}),bronze);}
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
    if(kit.manica&&side<0){const guard=part(elbow,'equipped-manica');for(let j=0;j<6;j++)mesh(guard,profile([[.025-j*.038,.052-j*.002,.060-j*.003],[.003-j*.038,.054-j*.002,.062-j*.003]],{segments:16}),metal);}
    const hand=part(elbow,'hand',0,-.258,0);
    const handOptions={side,open:!armed&&side<0,quality:options.quality},handMesh=mesh(hand,handGeometry(handOptions),skin),overviewHand=handGeometry({...handOptions,detail:'overview'});
    handMesh.userData.overviewGeometry=overviewHand;geometries.add(overviewHand);
    arms.push({shoulder,elbow,hand});
  }
  const right=arms[0],left=arms[1];
  // The pilot’s service props belong to the existing figure rig, so their
  // geometry/materials follow its normal rebuild and disposal lifecycle.
  if(unit.campActivity==='carry'&&!armed){
    const bucket=part(right.hand,'courtyard-water-bucket',0,0,.025);
    mesh(bucket,new T.CylinderGeometry(.10,.075,.20,10),leather,0,-.22,0);
    mesh(bucket,new T.TorusGeometry(.10,.008,4,10,Math.PI),bronze,0,-.10,0);
    mesh(bucket,new T.CylinderGeometry(.087,.087,.006,10),black,0,-.118,0);
  }
  if(unit.campActivity==='work'&&!armed){
    const tablet=part(left.hand,'courtyard-stores-tablet',0,-.04,.025);
    mesh(tablet,new T.BoxGeometry(.15,.025,.21),leather);
    mesh(tablet,new T.BoxGeometry(.125,.005,.18),black,0,.015,0);
  }

  function makeShield(){
    const s=part(left.hand,'oval-shield',0,-.082,.065),rim=new T.Shape();rim.absellipse(0,0,.265,.40,0,TAU,false,0);
    const face=mesh(s,new T.ExtrudeGeometry(rim,{depth:.025,bevelEnabled:true,bevelSize:.007,bevelThickness:.008,bevelSegments:2,steps:1,curveSegments:40}),leather,0,.03,-.022);
    // A convex oval face: radial rings bulge forward with a rolled bronze edge.
    const verts=[],uv=[],ind=[];for(let j=0;j<=6;j++){const r=j/6;for(let i=0;i<=40;i++){const a=i/40*TAU;verts.push(Math.sin(a)*.257*r,Math.cos(a)*.392*r+.03,.019+.045*(1-r*r));uv.push(.5+Math.sin(a)*r*.5,.5+Math.cos(a)*r*.5);if(j&&i){const k=j*41+i;ind.push(k,k-1,k-41,k-1,k-42,k-41);}}}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();mesh(s,g,shieldPaint);
    const rimCurve=new T.CatmullRomCurve3(Array.from({length:41},(_,i)=>new T.Vector3(Math.sin(i/40*TAU)*.262,Math.cos(i/40*TAU)*.399+.03,.021)),true);
    mesh(s,new T.TubeGeometry(rimCurve,64,.008,6,true),bronze);
    const boss=ellipsoid(s,metal,0,.03,.075,.061,.064,.048);
    for(let i=0;i<12;i++){const a=i/12*TAU;faceDetail(s,bronze,Math.sin(a)*.238,Math.cos(a)*.37+.03,.027,.007,.007,.004);}
    // The unit's design from the faction's pattern library (shield-patterns.js), laid on the face.
    const design=shieldDesign(kit,identity);if(design.base)shieldPaint.color.set(design.base);
    const fieldPaint=design.field?material(design.field,paintSurface):null;if(fieldPaint)fieldPaint.name='painted shield field';
    for(const {paint,geometry}of shieldDecals(design.id))mesh(s,geometry,paint==='field'?fieldPaint??shieldPaint:paint==='dark'?black:white);
    for(const sign of [-1,1])strip(s,leather,[[sign*.055,.15,-.035],[sign*.064,.03,-.065],[sign*.055,-.10,-.035]],.014);
    strip(s,bronze,[[-.07,.03,-.045],[.07,.03,-.045]],.012);return s;
  }
  const shield=archer||!armed||kit.shield===false?null:makeShield();
  const shieldContact=shield?part(shield,'shield-contact',0,.03,.13):null;
  if(shield&&mounted)shield.scale.setScalar(.82);
  if(shield&&kit.eastern)shield.scale.set(.85,.84,1);
  if(shield&&kit.shieldShape==='round')shield.scale.set(1.03,.68,1);
  const weapon=armed?part(right.hand,trainer?'practice-sword':kit.weapon??(spear?'spear':'sword'),0,-.052,.018):null;
  if(weapon){weapon.rotation.x=Math.PI;
  mesh(weapon,new T.CylinderGeometry(.012,.012,.095,10),leather,0,-.006,0);
  if(spear&&!archer){
    mesh(weapon,new T.CylinderGeometry(.011,.015,1.65,10),leather,0,.42,0);
    mesh(weapon,shapeGeometry([[0,.19],[-.036,.035],[-.012,0],[.012,0],[.036,.035]],.009),metal,0,1.24,0);
    mesh(weapon,new T.CylinderGeometry(.016,.013,.07,10),bronze,0,1.24,0);
  }else if(kit.weapon==='axe'){
    mesh(weapon,new T.CylinderGeometry(.014,.018,.65,10),leather,0,.24,0);
    mesh(weapon,shapeGeometry([[0,.42],[.13,.40],[.18,.56],[.13,.65],[0,.59]],.028),metal);
  }else if(kit.weapon==='sling'){
    strip(weapon,leather,[[0,0,0],[-.06,.22,.01],[0,.38,0],[.06,.22,-.01],[0,0,0]],.009);
    ellipsoid(weapon,leather,0,.38,0,.043,.06,.013);
  }else{
    mesh(weapon,new T.CylinderGeometry(.016,.023,.035,12),bronze,0,-.07,0);
    const guard=ellipsoid(weapon,trainer?practiceWood:bronze,0,.056,0,.062,.018,.022);
    // Ridged diamond-section blade, individually modeled faces catch light.
    const blade=new T.BufferGeometry(),v=[-.027,.073,0, .027,.073,0, 0,.073,.009, 0,.073,-.009, -.022,.47,0, .022,.47,0, 0,.47,.006, 0,.47,-.006, 0,.59,0];
    blade.setAttribute('position',new T.Float32BufferAttribute(v,3));blade.setAttribute('uv',new T.Float32BufferAttribute(v.flatMap((_,i)=>i%3===0?[(v[i]+.027)/.054,v[i+1]/.59]:[]),2));blade.setIndex([0,4,6,0,6,2,2,6,5,2,5,1,1,5,7,1,7,3,3,7,4,3,4,0,4,8,6,6,8,5,5,8,7,7,8,4]);blade.computeVertexNormals();mesh(weapon,blade,trainer?practiceWood:metal).scale.y=bladeLength/.59;
  }
  weapon.visible=!archer;}
  const weaponContact=weapon?part(weapon,'weapon-contact',0,spear&&!archer?1.43:kit.weapon==='axe'?.6:bladeLength,0):null;
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
    const mail=material(wardrobe.armorTint,{...surface(kit.armor),roughness:wardrobe.armorRoughness});mail.name=kit.armor==='scale'?'overlapping scale armor':'interlinked mail';
    armorMaterial=mail;
    for(const side of [-1,1])strip(torso,leather,[[side*.10,.10,.142],[side*.13,.31,.155],[side*.15,.44,.102]],.019);
  }
  // A bare-headed generated body wears the helmet or cap fitted to its own head.
  const headwear=body?ACTOR_BODIES[identityBody?IDENTITY_HEAD_BODY:bodyId]?.headwear:null,fitted=piece=>{if(headwear){piece.position.fromArray(headwear.position);piece.scale.fromArray(headwear.scale);}return piece;};
  if(kit.helmet){
    const mail=armorMaterial??metal,helmetRoot=fitted(part(head,`${kit.helmet}-helmet`));
    if(kit.helmet==='conical'){
      mesh(helmetRoot,profile([[.135,.127,.127,-.012],[.19,.120,.121,-.012],[.28,.070,.075,-.018],[.345,.008,.01,-.024]],{segments:24}),metal);
      for(const side of [-1,1])strip(helmetRoot,bronze,[[side*.12,.14,.025],[side*.088,.24,.025],[0,.345,-.024]],.005);
      // Coif and neck guard wrap around the head, leaving the actual face open.
      mesh(helmetRoot,profile([[-.045,.123,.122,-.016],[.137,.126,.124,-.012]],{segments:24,from:1.05,to:TAU-1.05}),mail);
    }else if(kit.helmet==='segmented'){
      mesh(helmetRoot,helmetBowlGeometry({detail:false,seed:kit.identity}),leather);
      for(const a of [0,Math.PI/2]){const band=mesh(helmetRoot,profile([[.14,.132,.132,-.012],[.165,.130,.130,-.012]],{segments:20}),metal);band.rotation.y=a;}
      strip(helmetRoot,metal,[[0,.14,.125],[0,.225,.092],[0,.28,-.01],[0,.22,-.118]],.014);
    }else{
      // The front rim clears the brows; the deeper guard wraps only the rear.
      mesh(helmetRoot,helmetBowlGeometry({detail:Boolean(anatomy)&&detail,seed:kit.identity}),metal);
      strip(helmetRoot,bronze,[[-.12,.14,.047],[0,.146,.12],[.12,.14,.047]],.009);
      strip(helmetRoot,bronze,[[0,.146,.12],[0,.225,.092],[0,.28,-.01],[0,.22,-.118]],.007);
      mesh(helmetRoot,profile([[.078,.132,.133,-.013],[.134,.128,.130,-.012]],{segments:28,from:1.05,to:TAU-1.05}),metal);
      for(const side of [-1,1]){
        const cheek=mesh(helmetRoot,cheekGuardGeometry({detail:Boolean(anatomy)&&detail}),metal,side*.106,.077,.046);cheek.rotation.y=side*.65;
        if(anatomy)faceDetail(helmetRoot,bronze,side*.106,.126,.047,.008,.005,.005);
      }
    }
    if(kit.equipped?kit.crest:kit.officer){
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
  if(kit.cap&&!kit.helmet){const cap=fitted(part(head,'equipped-arming-cap'));mesh(cap,helmetBowlGeometry({detail:false,seed:kit.identity}),clothDark);}
  mountCharacterDetail(unit,kit,{torso,head,cloth,clothDark,leather,bronze,mesh,strip,ellipsoid:faceDetail,profile});
  if(identityBody&&body&&bodyId!==IDENTITY_HEAD_BODY){
    // A folded military neckcloth bridges independently generated necklines.
    // It sits over the cut seam and follows the torso rather than stretching
    // facial vertices down into a different rank body's collar.
    const wrap=part(torso,'identity-neck-wrap',-.018,0,.008);
    mesh(wrap,profile([[.55,.105,.085],[.565,.106,.086],[.585,.102,.082],[.595,.101,.081]],{segments:24,folds:.035,foldCount:8}),material(wardrobe.cloak??0x874b3e,surface('wool')));
  }
  if(kit.armored){
    // Padded neckline separates warm skin, textile and cold armor. It follows
    // the torso and has its own folded contour, not a dark line on the neck.
    mesh(torso,profile([[.466,.103,.089],[.477,.107,.091],[.492,.092,.079],[.500,.086,.075]],{segments:anatomy&&detail?32:16,folds:.035}),cloth);
    if(kit.eastern){
      for(const side of [-1,1])strip(torso,clothDark,[[side*.11,.45,.10],[side*.13,.38,.168],[side*.10,.29,.193]],.008);
    }else{
      for(const side of [-1,1])strip(torso,clothDark,[[side*.065,.49,.065],[side*.075,.471,.079],[side*.098,.473,.067]],.003);
    }
  }
  let cloak=null;
  if(kit.cloak){
    // A generated body's clothes are baked, so a scene's cloth colour (the accession's purple) dyes the cloak.
    cloak=part(torso,'command-cloak');clothRigs.push(createClothRig(cloak,.44,.08,-.42));const red=material(body&&options.palette?.cloth!==undefined?options.palette.cloth:wardrobe.cloak,{...surface('wool'),side:T.DoubleSide});
    mesh(cloak,drape([[.44,0,.37,-.16],[.28,.015,.46,-.20],[.09,.02,.51,-.23],[-.13,.025,.56,-.26],[-.42,.03,.54,-.28]]),red);
    if(kit.cloakKind==='paenula')mesh(cloak,profile([[.43,.19,.145],[.51,.16,.12],[.62,.09,.07]],{segments:16,from:1.1,to:TAU-1.1}),red,0,0,-.13);
    ellipsoid(torso,bronze,-.178,.41,.126,.024,.024,.009);
  }
  if(civic){
    const stripe=material(BLOC_TRIM[unit.bloc]??0x764653,{...clothSurface,side:T.DoubleSide});let gilt=null;
    const trimMaterial=band=>band.gilt?(gilt??=material(0xc9a64a,{...clothSurface,side:T.DoubleSide})):stripe;
    // Its bands (broad, double, broken or gilt-lined) name the bloc without colour.
    if(body?.band){
      // A senator's own toga: the bands lie on the one fitted across it, from the left
      // shoulder to the right of the waist, and follow his skin (mountActorBody).
      for(const band of trimBands(unit.bloc)){const geometry=blocTrimGeometry(body.band,band);geometries.add(geometry);blocTrims.push({geometry,material:trimMaterial(band)});}
    }else{
      const toga=part(torso,'draped-civic-robe');clothRigs.push(createClothRig(toga,.49,.04,-.54));const ivory=material(p.cloth,{...clothSurface,side:T.DoubleSide});
      const rows=[[.49,.18,.15,.15],[.37,.08,.38,.205],[.19,-.015,.46,.225],[.02,-.025,.48,.215],[-.22,.025,.49,.22],[-.40,.06,.42,.205],[-.54,.08,.34,.185]];
      mesh(toga,drape(rows),ivory);
      // The colored edging follows the same fold surface with a small outward
      // offset. Independent flat chest stripes formerly cut through the drape.
      for(const band of trimBands(unit.bloc))mesh(toga,drape(band.rows?rows.slice(band.rows[0],band.rows[1]+1):rows,{from:band.from,to:band.to,offset:band.offset??.009}),trimMaterial(band));
    }
    const scroll=part(left.hand,'rolled-petition',0,-.045,.035);mesh(scroll,new T.CylinderGeometry(.019,.019,.16,10),white,0,0,0).rotation.z=Math.PI/2;
  }else if(escort&&!kit.staff){
    const pack=part(torso,'travel-bundle',0,.23,-.20);mesh(pack,profile([[-.17,.15,.065],[-.08,.17,.09],[.15,.14,.08],[.20,.10,.055]],{segments:16,folds:.06}),clothDark);
    for(const x of [-.10,.10])strip(torso,leather,[[x,-.02,.13],[x,.43,.14],[x,.48,-.13],[x,.06,-.27]],.012);
    if(kit.wounded){const wrap=part(torso,'wounded-arm-sling');mesh(wrap,drape([[.32,-.15,.045,.17],[.18,0,.21,.24],[.13,.05,.22,.21]]),white);}
  }
  let signum=null;
  if(kit.signum){
    signum=part(torso,'actor-signum',.16,.12,-.15);signum.userData.signumKind=kit.signum;
    mesh(signum,new T.CylinderGeometry(.009,.011,1.32,8),bronze,0,.52,0);
    const bar=mesh(signum,new T.CylinderGeometry(.007,.007,.28,8),bronze,0,1.06,0);bar.rotation.z=Math.PI/2;
    for(const dy of [.62,.76,.90])faceDetail(signum,bronze,0,dy,.014,.022,.022,.005);
    if(kit.signum==='aquila')mesh(signum,shapeGeometry([[0,1.15],[-.12,1.22],[-.05,1.25],[0,1.19],[.05,1.25],[.12,1.22]],.012),bronze);
    else mesh(signum,shapeGeometry([[0,1.28],[-.035,1.17],[0,1.14],[.035,1.17]],.009),bronze);
  }
  const horse=mounted?createHorse(root,kit,{part,mesh,profile:(rings,spec={})=>profile(rings,{...spec,subdivisions:1}),ellipsoid,strip,material,surface,leather,metal,hair,cloth},{frame:horseCoat?.frame}):null;
  const ring=mesh(group,new T.RingGeometry(mounted?.72:.32,mounted?.75:.343,48),new T.MeshBasicMaterial({color:0xe6bc6c,transparent:true,opacity:.85,side:T.DoubleSide,forceSinglePass:true}),0,.009,0);materials.add(ring.material);ring.rotation.x=-Math.PI/2;ring.visible=false;ring.castShadow=false;ring.receiveShadow=false;
  // Build overview geometry once, before near-detail batching. One colored
  // draw per rigid joint keeps the real role silhouette while dropping tiny
  // rivets, fingers and surface sampling that cannot be read at this distance.
  let farMeshes=[],nearMeshes=[];const overviewMaterial=material(0xffffff,{vertexColors:true,roughness:.86,metalness:.08,side:T.DoubleSide});installCloudShadows(overviewMaterial);
  overviewMaterial.name='overview role colors';overviewMaterial.userData.overview=true;
  function overview(parent){
    for(const child of [...parent.children])if(child.isGroup||child.isBone)overview(child);
    const all=parent.children.filter(o=>o.isMesh&&o.material.isMeshStandardMaterial);if(!all.length)return;
    const kept=all.filter(item=>{item.geometry.computeBoundingBox();const size=item.geometry.boundingBox.getSize(new T.Vector3()).multiply(item.scale);return Math.max(size.x,size.y,size.z)>=.075;});
    if(!kept.length)kept.push(all.reduce((a,b)=>a.geometry.attributes.position.count>b.geometry.attributes.position.count?a:b));
    const positions=[],normals=[],colors=[];
    for(const item of kept){item.updateMatrix();const geometry=item.userData.overviewGeometry??item.geometry,source=geometry.index?geometry.toNonIndexed():geometry.clone();source.applyMatrix4(item.matrix);positions.push(...source.attributes.position.array);normals.push(...source.attributes.normal.array);for(let i=0;i<source.attributes.position.count;i++){const c=source.attributes.color;colors.push(item.material.color.r*(c?.getX(i)??1),item.material.color.g*(c?.getY(i)??1),item.material.color.b*(c?.getZ(i)??1));}source.dispose();if(geometry!==item.geometry){geometries.delete(geometry);geometry.dispose();delete item.userData.overviewGeometry;}}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const cell=/sword|spear|javelin|ankle|hand/.test(parent.name)?.009:/head/.test(parent.name)?.022:/horse/.test(parent.name)?.042:.030;
    // Hands and soles already have deliberately authored low-detail meshes;
    // keep their thin grip and floor contours instead of clustering twice.
    const reduced=/hand|ankle/.test(parent.name)?g:simplifyActorOverview(g,{cell});if(reduced!==g)g.dispose();
    const simple=mesh(parent,reduced,overviewMaterial);simple.name='overview-detail';simple.userData.overview=true;simple.visible=false;farMeshes.push(simple);
  }
  // A generated body takes the place of every procedural surface on its own joints.
  if(identityBody&&!body){neck.removeFromParent();geometries.delete(neck.geometry);neck.geometry.dispose();}
  if(body||identityBody){const replaced=[],replaces=body?(headwear?BARE_HEAD_REPLACES:BODY_REPLACES):/^(head|(right|left)-(brow|eyelid)|facial-jaw)$/;group.traverse(o=>{if(o.isMesh&&o.parent?.isBone&&replaces.test(o.parent.name))replaced.push(o);});
    for(const item of replaced){item.removeFromParent();for(const g of [item.geometry,item.userData.overviewGeometry])if(g){geometries.delete(g);g.dispose();}}}
  // A generated horse's coat takes the place of every code-built horse surface but the saddle.
  if(horse&&horseCoat){const replaced=[];horse.group.traverse(o=>{if(o.isMesh&&o.parent?.isBone&&HORSE_REPLACES.test(o.parent.name))replaced.push(o);});
    for(const item of replaced){item.removeFromParent();for(const g of [item.geometry,item.userData.overviewGeometry])if(g){geometries.delete(g);g.dispose();}}}
  overview(group);
  if(anatomy){const replaced=[];group.traverse(o=>{if(o.isMesh&&o.userData.anatomyReplacement)replaced.push(o);});for(const item of replaced){item.removeFromParent();geometries.delete(item.geometry);item.geometry.dispose();}}
  // Batch rigid details by material within each joint. Faces, folds, fingers
  // and equipment remain real geometry without hundreds of separate draws.
  const tintedMaterials=new Map();
  function batchKey(mat){return mat.isMeshStandardMaterial&&!mat.transparent?actorMaterialKey(mat):mat;}
  function batch(parent){
    for(const child of [...parent.children])if(child.isGroup||child.isBone)batch(child);
    const buckets=new Map();for(const child of parent.children)if(child.isMesh&&!child.userData.overview){const key=batchKey(child.material),bucket=buckets.get(key)??[];bucket.push(child);buckets.set(key,bucket);}
    for(const [key,items]of buckets){if(items.length<2)continue;const positions=[],normals=[],uv=[],colors=[],triangles=[],mixed=items.some(item=>item.material!==items[0].material||item.geometry.attributes.color);let mat=items[0].material;
      if(mixed){if(!tintedMaterials.has(key)){const merged=mat.clone();merged.color.set(0xffffff);merged.vertexColors=true;materials.add(merged);tintedMaterials.set(key,merged);}mat=tintedMaterials.get(key);}
      // Each detail keeps its shared vertices; its triangles join the batch's index.
      for(const item of items){item.updateMatrix();const source=item.geometry.clone().applyMatrix4(item.matrix),first=positions.length/3;positions.push(...source.attributes.position.array);normals.push(...source.attributes.normal.array);uv.push(...(source.attributes.uv?.array??new Float32Array(source.attributes.position.count*2)));if(mixed)for(let i=0;i<source.attributes.position.count;i++){const c=source.attributes.color;colors.push(item.material.color.r*(c?.getX(i)??1),item.material.color.g*(c?.getY(i)??1),item.material.color.b*(c?.getZ(i)??1));}
        if(source.index)for(let k=0;k<source.index.count;k++)triangles.push(first+source.index.getX(k));else for(let i=0;i<source.attributes.position.count;i++)triangles.push(first+i);
        source.dispose();parent.remove(item);geometries.delete(item.geometry);item.geometry.dispose();}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(mixed)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(triangles);mesh(parent,g,mat);
    }
  }
  batch(group);
  group.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial&&!o.userData.overview)nearMeshes.push(o);});
  nearMeshes=bindActorSurfaces(group,nearMeshes,{geometries,materials,skeletons,clothRigs});
  farMeshes=bindActorSurfaces(group,farMeshes,{geometries,materials,skeletons,clothRigs,overview:true});
  const costume=body?{nearMeshes:[],farMeshes:[]}:mountActorCostume(group,{kit,cloth:kit.equipped&&kit.padding&&!kit.armored?(kit.equipment.includes('jerkin')?leather:clothDark):cloth,armor:armorMaterial,quality:options.quality,hem,identity,geometries,materials,skeletons});
  nearMeshes.push(...costume.nearMeshes);farMeshes.push(...costume.farMeshes);
  if(anatomy){const fittedHair=hair.clone();materials.add(fittedHair);if(anatomy.importedHair)Object.assign(fittedHair,acquireActorHairSurface(identity));else fittedHair.alphaHash=true;const beardHair=hair.clone();beardHair.color.lerp(new T.Color(0x86725c),.18);beardHair.roughness=.92;beardHair.alphaHash=true;materials.add(beardHair);nearMeshes.push(...mountActorAnatomy(group,anatomy,{skin:importedSkin,hair:fittedHair,beardHair,geometries,materials,skeletons}));}
  if(body||identityBody){const worn=mountActorBody(group,body,{skeletons,identity,headBody:identityBody,donor:donorBody,geometries,materials,trims:blocTrims});nearMeshes.push(...[worn.near,...worn.heads.filter(m=>!m.userData.overview),...worn.trims].filter(Boolean));farMeshes.push(...[worn.overview,...worn.heads.filter(m=>m.userData.overview)].filter(Boolean));group.userData.actor.headSource=identityBody?(identityBody.head?identityBody.id:IDENTITY_HEAD_BODY):body.id;group.userData.actor.persistentIdentity=!!identityBody;}
  if(horse&&horseCoat){const coat=mountHorseBody(group,horse,horseCoat,{skeletons});nearMeshes.push(coat.near);farMeshes.push(coat.overview);}
  group.userData.actor.horse=horse&&horseCoat?horseCoat.id:null;
  const expressionMeshes=[...nearMeshes,...farMeshes].filter(m=>m.geometry.userData.expressionMorphs);
  // An opaque near surface missing some of the textured surfaces' four maps (eyes, lips,
  // brows, trim, a complexion without relief) takes neutral ones, so it shares their
  // program (model-materials.js) and looks as before. Not a bump map's only surface:
  // a normal map, even a flat one, would replace its relief.
  const opaque=m=>!m.transparent&&!m.alphaHash&&!(m.alphaTest>0)&&!m.alphaToCoverage;
  for(const m of materials)if(m.isMeshStandardMaterial&&!m.isMeshPhysicalMaterial&&!m.userData.overview&&opaque(m)&&(m.normalMap||!m.bumpMap))
    addNeutralMaps(m,['map','bumpMap','normalMap','roughnessMap']);
  // The overview's own clones (far detail) are lit as the overview material is: cloud
  // shadows, no near finish. A clone keeps its source's flags but not its shader hooks.
  for(const m of materials)if(m.isMeshStandardMaterial&&m!==overviewMaterial){
    if(m.userData.overview){delete m.userData.cloudShadows;installCloudShadows(m);}else finishActorMaterial(m);
  }
  const planting=createFootPlanting(),ankleRotation=new T.Quaternion(),footRotation=new T.Quaternion(),footEuler=new T.Euler(0,0,0,'ZXY'),tipPosition=new T.Vector3(),shoulderPosition=new T.Vector3();
  let disposed=false,far=false,lastMotion=null,lastPose=null,transition=null,previousYaw=null,pivot=null,lastHorsePose=null,horseTransition=null,lastHorseMotion=null;
  // The horse's speed over the ground (metres a second, smoothed), the gait it keeps by it, and
  // the stride's phase, carried across a change of gait for a horse whose gaits differ in stride.
  let horseSpeed=null,horseGait=null,horseCycle=null,horseDistance=null;
  const blendable=p=>({...p,leftArm:[...p.leftArm],rightArm:[...p.rightArm],feet:p.feet.map(f=>({...f}))});
  function detailLevel(input){const distance=Number.isFinite(input.detailDistance)?input.detailDistance:0,next=input.active||input.selected?false:far?distance>=14:distance>18;
    if(next!==far){far=next;for(const m of nearMeshes)m.visible=!far;for(const m of farMeshes)m.visible=far;}
    group.userData.actor.detail=far?'overview':'near';
  }
  function update(input={}){
    if(disposed)return;
    detailLevel(input);
    if(input.resetPose){planting.reset();lastPose=null;lastMotion=null;transition=null;previousYaw=null;pivot=null;lastHorsePose=null;horseTransition=null;lastHorseMotion=null;horseSpeed=horseGait=horseCycle=horseDistance=null;}
    if(!(Number.isFinite(input.dt)&&input.dt>0)){transition=null;pivot=null;horseTransition=null;}
    const mapped=civic&&['withdrawn','dead'].includes(input.motion)?{...input,motion:'yield',health:1}:civic&&['attack','strike','throw'].includes(input.motion)?{...input,motion:'speak'}:input;
    let pose=actorPose({...mapped,health:kit.wounded?Math.min(mapped.health??1,.32):mapped.health,variant:kit.identity,weapon:spear?'spear':trainer?'practice':'sword',mounted});const motion=mapped.motion??'idle';
    applyCharacterPresence(pose,identity,kit,mapped);
    if(lastPose&&lastMotion!==motion&&Number.isFinite(input.dt)&&input.dt>0&&(input.phase===undefined||input.phase<.12||motion==='idle'))transition={from:blendable(lastPose),elapsed:0,duration:performanceTransition(lastMotion,motion),settle:motion==='idle'&&['walk','run','retreat'].includes(lastMotion),start:lastMotion==='idle'&&['walk','run','retreat'].includes(motion)};
    if(transition){transition.elapsed+=Math.min(.05,Math.max(0,input.dt||0));pose=blendActorPose(transition.from,pose,transition.elapsed/transition.duration);if(transition.settle)applyPerformance(pose,'stop',transition.elapsed/transition.duration);if(transition.start&&!Number.isFinite(input.movementProgress))applyPerformance(pose,'start',transition.elapsed/transition.duration);if(transition.elapsed>=transition.duration)transition=null;}
    lastMotion=motion;
    if(previousYaw!==null&&!input.reducedMotion&&input.dt>0){
      const turn=Math.atan2(Math.sin(pose.yaw-previousYaw),Math.cos(pose.yaw-previousYaw));
      if(['walk','run','retreat'].includes(motion))applyGaitTurn(pose,turn/Math.max(.008,input.dt),{mounted});
      else if(motion==='idle'&&!mounted&&Math.abs(turn)>.008&&!pivot)pivot={elapsed:0,side:Math.sign(turn)};
    }
    if(pivot){if(motion==='idle'&&!input.reducedMotion){pivot.elapsed+=Math.min(.05,Math.max(0,input.dt||0));applyTurnPerformance(pose,pivot.elapsed/.32,pivot.side);if(pivot.elapsed>=.32)pivot=null;}else pivot=null;}
    previousYaw=pose.yaw;
    if(civic){if(!['yield','speak','rally','order','assent','dissent'].includes(mapped.motion)){pose.leftArm[0]=-.45;pose.leftElbow=-1.15;}if(['hit','hurt'].includes(mapped.motion)){pose.bodyX*=.35;pose.bodyZ*=.35;pose.headX*=.5;}}
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
    if(horse){
      const frame=horse.frame,distance=input.locomotionDistance,step=Number.isFinite(distance)&&Number.isFinite(horseDistance)?distance-horseDistance:NaN,moved=step>=0&&step<3;
      if(moved&&input.dt>0){const now=step/input.dt;horseSpeed=horseSpeed===null?now:horseSpeed+(now-horseSpeed)*Math.min(1,input.dt/.35);}else if(!moved)horseSpeed=null;
      const fast=['run','cavalry-move'].includes(motion);horseGait=fast?horseGaitForSpeed(horseSpeed,{current:horseGait}):null;
      let cycle;
      if(frame.motion&&Number.isFinite(distance)){const stride=frame.motion.gaits[horseGait??(fast?(Number.isFinite(input.locomotionWeight)&&input.locomotionWeight<.72?'trot':'canter'):'walk')].stride;
        horseCycle=moved&&horseCycle!==null?horseCycle+step/stride:distance/stride;cycle=horseCycle;}
      horseDistance=Number.isFinite(distance)?distance:null;
      let authored=horsePose({...input,frame,cycle,...(horseGait?{gait:horseGait}:{})});
      if(lastHorsePose&&input.dt>0&&(lastHorseMotion!==motion||lastHorsePose.gait!==authored.gait))horseTransition={from:lastHorsePose,elapsed:0};
      if(horseTransition){horseTransition.elapsed+=Math.min(.05,Math.max(0,input.dt||0));authored=blendHorsePose(horseTransition.from,authored,horseTransition.elapsed/.24);if(horseTransition.elapsed>=.24)horseTransition=null;}
      lastHorsePose={...authored,feet:authored.feet.map(f=>({...f}))};lastHorseMotion=motion;
      const samples=planting.sample({pose:authored,mounted:true,position:group.position,direction:pose.yaw,motion,phase:input.phase,groundHeight:input.groundHeight,scaleY:group.scale.y,reset:input.resetPose});horseMotion=horse.update(input,groundHorsePose(authored,samples,frame));
      pose.hipY=1.56+horseMotion.riderBob+horseMotion.riderHeave-.38*horseMotion.fall;pose.hipZ=-.08+pose.hipZ*.4;pose.bodyX+=horseMotion.bodyPitch+horseMotion.riderPitch;pose.bodyZ+=horseMotion.bodyRoll+horseMotion.riderRoll;
    }else{const samples=planting.sample({pose,position:group.position,direction:pose.yaw,motion,phase:input.phase,groundHeight:input.groundHeight,scaleY:group.scale.y,reset:input.resetPose});
      // Blending feet also needs a fresh IK solve when no terrain is supplied.
      groundHumanPose(pose,samples??pose.feet.map((f,i)=>({height:0,x:f.x??(i?1:-1)*.104,z:f.z})));
    }
    const expr=actorExpression({...mapped,seed:kit.identity,gazeYaw:input.gazeYaw,gazePitch:input.gazePitch,reducedMotion:input.reducedMotion});
    group.rotation.y=pose.yaw;hips.position.set(pose.hipX??0,pose.hipY,pose.hipZ);hips.rotation.z=horseMotion?-horseMotion.fall*.6:0;torso.rotation.set(pose.bodyX,pose.bodyY,pose.bodyZ);head.rotation.set(pose.headX+expr.headPitchOffset,pose.headY+expr.headYawOffset,0);skirt.rotation.x=pose.skirt;
    const seconds=Number.isFinite(input.time)?Math.max(0,input.time):0,blinkPhase=(seconds+((kit.identity%13)*.13))%4.7,blink=input.reducedMotion?0:blinkPhase>4.46?Math.sin((blinkPhase-4.46)/.24*Math.PI):0,closure=Math.min(1,blink+expr.lidFocus*(1-blink));
    updateActorExpressionMorphs(expressionMeshes,expr,{...mapped,blink:closure});
    for(const lid of lids){if(lid.userData.closeDistance){lid.position.y=-closure*lid.userData.closeDistance;lid.position.z=closure*.0006;}else{lid.position.y=lid.userData.openY-closure*.005;lid.scale.y=1+closure*2.5;}}
    for(const brow of brows){brow.position.y=expr.browY;brow.position.z=Math.abs(expr.browY)*.25;brow.rotation.z=brow.userData.side*expr.browTilt;}
    const speaking=!input.reducedMotion&&['speak','conversation','rally','order'].includes(motion),emphasis=speaking?Math.abs(sampleActorClip('speech',input.phase??0).rightArmX??0):0,jaw=Math.max(emphasis,expr.jawOpen);
    mouth.rotation.x=jaw*.12;mouth.position.y=.001-jaw*.0024;
    for(let i=0;i<2;i++){legs[i].thigh.rotation.set(mounted?-1.05-(horseMotion?.riderPitch??0):pose.legs[i].thigh,0,mounted?(i?1:-1)*.48+(horseMotion?.riderRoll??0):pose.legs[i].splay??0,'ZXY');legs[i].knee.rotation.x=mounted?1.75+(horseMotion?.riderHeave??0)*1.4:pose.legs[i].knee;
      if(mounted)legs[i].ankle.rotation.set(-.60,0,0);else {ankleRotation.copy(legs[i].thigh.quaternion).multiply(legs[i].knee.quaternion).invert();footRotation.setFromEuler(footEuler.set(pose.feet[i].roll+(pose.feet[i].pitch??0),0,pose.feet[i].bank??0,'ZXY'));legs[i].ankle.quaternion.copy(ankleRotation.multiply(footRotation));}
    }
    right.shoulder.rotation.set(...pose.rightArm);left.shoulder.rotation.set(...pose.leftArm);right.elbow.rotation.x=pose.rightElbow;left.elbow.rotation.x=pose.leftElbow;right.hand.rotation.x=pose.rightWrist;left.hand.rotation.x=pose.leftWrist;
    // Turn the gripping hand with the shield instead of rotating the board
    // independently through the fingers. Its boss sits over the closed grip.
    if(shield){left.hand.rotation.set(-(pose.leftArm[0]+pose.leftElbow)+pose.shieldTilt,0,-pose.leftArm[2]);shield.rotation.set(0,0,0);}
    if(weapon&&spear&&!archer){const ready=['attack','strike'].includes(input.motion)?actionEnvelope(input.motion,input.phase).preparation:0;weapon.rotation.x=Math.PI/2-pose.rightArm[0]-pose.rightElbow-.18*(1-ready);}
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
  const contacts={weapon:weaponContact,shield:shieldContact,body:torso,feet:horse?.feet??legs.map(l=>l.ankle),footClearance:(mounted?horse.frame.clearance:.07)*group.scale.y};
  function getReleasePoint(target=new T.Vector3()){
    if(archer&&nockedArrow){target.set(0,0,.694);return nockedArrow.localToWorld(target);}
    return (javelinRelease??right.hand).getWorldPosition(target);
  }
  update();return {group,update,dispose,contacts,getReleasePoint};
}
