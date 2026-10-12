import * as T from '../../vendor/three/three.module.js';
import {actorPose,horsePose,groundHumanPose,groundHorsePose,blendActorPose,createFootPlanting,actionEnvelope} from './actor-pose.js';
import {actorKit} from './actor-kit.js';
import {acquireActorSurface,releaseActorSurface} from './actor-materials.js';
import {createHorse} from './actor-horse.js';
import {bindActorSurfaces,createClothRig} from './actor-skin.js';
export {actorPose,horsePose} from './actor-pose.js';
export {actorKit} from './actor-kit.js';

const TAU=Math.PI*2;
const DEFAULTS={skin:0xbe8966,cloth:0xc7bea0,leather:0x46352c,hair:0x30231e,shield:0x285f67,metal:0x727b7b,bronze:0xa78a50};

// Elliptical profile mesh with small sewn folds. Used for clothing, anatomy,
// footwear and armor, so silhouettes are shaped rather than primitive stacks.
function profileGeometry(rings,{segments=20,folds=0,foldCount=9}={}){
  const positions=[],uv=[],indices=[];
  for(let j=0;j<rings.length;j++){
    const [y,rx,rz,zc=0]=rings[j];
    for(let i=0;i<=segments;i++){
      const a=i/segments*TAU,f=1+folds*Math.sin(a*foldCount+j*.22);
      positions.push(Math.sin(a)*rx*f,y,Math.cos(a)*rz*f+zc);uv.push(i/segments,j/(rings.length-1));
      if(j&&i){const k=j*(segments+1)+i;indices.push(k,k-1,k-segments-1,k-1,k-segments-2,k-segments-1);}
    }
  }
  if(rings[0][0]>rings.at(-1)[0])for(let i=0;i<indices.length;i+=3)[indices[i],indices[i+1]]=[indices[i+1],indices[i]];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function shapeGeometry(points,depth=.008){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.002,bevelThickness:.002});}
function drape(rows,{from=0,to=1,offset=0}={}){const p=[],uv=[],indices=[],n=16;for(let j=0;j<rows.length;j++){const[y,cx,w,z]=rows[j];for(let i=0;i<=n;i++){const u=from+(to-from)*i/n,q=u*n,k=Math.floor(q),t=q-k,fold=f=>f(k/n)*(1-t)+f(Math.min(1,(k+1)/n))*t;p.push(cx+(u-.5)*w,y+fold(v=>-.018*Math.sin(v*Math.PI)),z+fold(v=>.009*Math.cos(v*Math.PI*12)+.018*Math.sin(v*Math.PI))+offset);uv.push(u,j/(rows.length-1));if(j&&i){const k=j*(n+1)+i;indices.push(k,k-1,k-n-1,k-1,k-n-2,k-n-1);}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}

/** Procedural 3D rig, feet at local y=0 and anatomical forward +Z.
 * Direction is yaw radians. Caller owns group.position. Phase is normalized
 * action progress, or one walking cycle (about .72m); omitted gait uses time.
 */
export function createActor(unit={},options={}){
  const kit=actorKit(unit,options),{role,trainer,archer,mounted,civic,escort}=kit,veteran=kit.armored,raider=['Gothic','Persian','Palmyrene'].includes(kit.faction),armed=kit.armed;
  const detail=options.quality!=='performance',profile=(rings,spec={})=>profileGeometry(rings,{...spec,segments:detail?(spec.segments??20):Math.min(spec.segments??20,12)});
  const factionColors={Gothic:{cloth:0x82704f,hair:0x70513b,shield:0x85392e},Persian:{cloth:0x9d8e72,hair:0x2c2521,shield:0x8b553f},Palmyrene:{cloth:0xd1bb90,hair:0x33251e,shield:0x7e4035},Civilian:{cloth:0xb8ae91,shield:0x8f714a}};
  const p={...DEFAULTS,...factionColors[kit.faction],...(kit.officer?{cloth:0xb8b097,shield:0x7b3034}:{}),...(civic?{cloth:unit.id==='hero'?0xe4dbc3:unit.bloc==='Army'?0xa9997a:unit.bloc==='Landholders'?0xd2c3a5:0xc2bba4}:{}),...(trainer?{cloth:0xb8aa86,hair:0x594739,shield:0x875c41,skin:0xb98364}:{}),...options.palette};
  const geometries=new Set(),materials=new Set(),skeletons=new Set(),clothRigs=[],surfaces=new Map(),group=new T.Group(),root=new T.Group();group.add(root);group.scale.y=1.05;
  group.name=`actor:${unit.id??role}`;group.userData.actor={unitId:unit.id,role,faction:kit.faction,height:mounted?2.68:kit.officer?2.02:kit.eastern?1.97:1.86,forward:'+Z',mounted,armor:kit.armor,helmet:kit.helmet};
  const material=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.84,metalness:0,...extra});materials.add(m);return m;};
  const surface=kind=>{if(!surfaces.has(kind))surfaces.set(kind,acquireActorSurface(kind));return surfaces.get(kind);};
  const clothSurface=surface('cloth'),leatherSurface=surface('leather'),paintSurface=surface('paint');
  const skin=material(new T.Color(p.skin).offsetHSL(0,-.01,((kit.identity%9)-4)*.008),{roughness:.78}),cloth=material(p.cloth,clothSurface),clothDark=material(new T.Color(p.cloth).lerp(new T.Color(0x705238),.32).multiplyScalar(.72),clothSurface),leather=material(p.leather,leatherSurface),hair=material(new T.Color(p.hair).lerp(new T.Color(0x807669),civic?.22:kit.officer?.10:0)),metal=material(p.metal,{metalness:.62,roughness:.38}),bronze=material(p.bronze,{metalness:.6,roughness:.42}),white=material(0xd7cbaa),black=material(0x241b17),eyeWhite=material(0xd0bca0),iris=material(0x31281c),shieldPaint=material(p.shield,paintSurface),lip=material(raider?0x925c47:0x85503f),practiceWood=trainer?material(0x9d8053,paintSurface):null;
  cloth.name='woven tunic';leather.name='worked leather';shieldPaint.name='painted wooden shield';
  const mesh=(parent,geometry,mat,x=0,y=0,z=0)=>{geometries.add(geometry);const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const ellipsoid=(parent,mat,x,y,z,rx,ry,rz)=>{const m=mesh(parent,new T.SphereGeometry(1,detail?16:10,detail?10:7),mat,x,y,z);m.scale.set(rx,ry,rz);return m;};
  const part=(parent,name,x=0,y=0,z=0)=>{const g=new T.Bone();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
  const strip=(parent,mat,points,radius=.008)=>mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),Math.max(4,Math.ceil(points.length*(detail?2:1.5))),radius,detail?5:4,false),mat);
  const hips=part(root,'hips',0,.91,0),torso=part(hips,'torso');
  mesh(torso,profile([[.025,.177,.120],[.10,.180,.135],[.20,.207,.158],[.31,.239,.166],[.39,.250,.149],[.435,.239,.132],[.47,.189,.110],[.496,.107,.079]],{folds:.037,foldCount:7}),cloth);
  const hem=civic?-.68:escort?-.48:kit.eastern?-.36:-.28;
  const skirt=part(torso,'tunic-hem');clothRigs.push(createClothRig(skirt,.055,hem*.45,hem));mesh(skirt,profile([[hem,.238,.156],[hem+.045,.239,.155],[hem*.55,.220,.146],[-.08,.197,.139],[-.025,.186,.132],[.03,.180,.125],[.055,.176,.116]],{folds:.07,foldCount:7}),cloth);
  // Hem tape and vertical seams are low relief, not disconnected armor plates.
  mesh(skirt,profile([[hem-.002,.241,.158],[hem+.016,.242,.158]],{folds:.07,foldCount:7}),clothDark);
  for(const x of [-.115,.115])strip(torso,clothDark,[[x,.075,.12],[x*1.18,.23,.142],[x*1.39,.42,.116]],.0035);
  for(const side of [-1,1]){strip(torso,cloth,[[side*.14,.08,.119],[side*.09,.18,.138],[side*.17,.34,.14]],.0045);strip(torso,clothDark,[[side*.082,.496,.069],[side*.064,.454,.096],[0,.423,.129]],.006);}
  mesh(torso,profile([[.02,.183,.127],[.069,.184,.127]],{segments:24}),leather);
  mesh(torso,shapeGeometry([[-.028,-.025],[.028,-.025],[.028,.025],[-.028,.025]],.006),bronze,0,.044,.132);
  const neck=mesh(torso,profile([[.47,.078,.068],[.56,.071,.065],[.59,.074,.066]],{segments:18}),skin);
  const head=part(torso,'head',0,.575,0);
  mesh(head,profile([[-.04,.047,.056,.023],[-.02,.078,.074,.014],[.015,.093,.077,.008],[.056,.101,.085],[.09,.105,.086],[.125,.104,.088,-.003],[.175,.093,.081,-.008],[.204,.062,.058,-.01],[.218,.007,.008,-.01]],{segments:32}),skin);
  // Nose bridge and alae, brow ridge, inset almond eyes and ears establish an
  // actual face at close range without oversize toy eyes.
  mesh(head,shapeGeometry([[-.012,.015],[.012,.015],[.017,.044],[.009,.094],[-.008,.097],[-.014,.046]],.025),skin,0,0,.077);
  ellipsoid(head,skin,0,.035,.108,.019,.012,.015);
  for(const side of [-1,1]){
    ellipsoid(head,skin,side*.062,.045,.067,.034,.022,.023);
    ellipsoid(head,skin,side*.041,.115,.074,.038,.010,.015);
    ellipsoid(head,skin,side*.104,.071,-.002,.015,.033,.015);
    ellipsoid(head,lip,side*.112,.068,.001,.004,.019,.006);
    ellipsoid(head,eyeWhite,side*.044,.093,.077,.026,.010,.011);
    ellipsoid(head,iris,side*.043,.093,.088,.008,.008,.004);
    strip(head,hair,[[side*.022,.111,.082],[side*.046,.116,.081],[side*.069,.109,.071]],.0045);
    strip(head,skin,[[side*.019,.091,.085],[side*.044,.102,.086],[side*.066,.091,.078]],.003);
  }
  strip(head,lip,[[-.031,.007,.076],[0,.004,.084],[.032,.007,.076]],.0035);
  strip(head,skin,[[-.023,-.009,.073],[0,-.013,.082],[.024,-.009,.073]],.0035);
  const facialWidth=.985+(kit.identity%7)*.005;head.scale.x=facialWidth;
  // Sculpted hair cap follows the skull with a swept, uneven hairline.
  const hairGeo=new T.SphereGeometry(1,24,12,0,TAU,0,Math.PI*.60),hp=hairGeo.getAttribute('position');
  for(let i=0;i<hp.count;i++){const x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i),wave=1+.025*Math.sin(Math.atan2(x,z)*9+y*5);hp.setXYZ(i,x*.109*wave,y*.113+.105,z*.095*wave-.012);}hairGeo.computeVertexNormals();mesh(head,hairGeo,hair);
  for(let i=0;i<6;i++){const a=-1.2+i*.46;strip(head,hair,[[Math.sin(a)*.097,.145,Math.cos(a)*.081],[Math.sin(a+.10)*.106,.183,Math.cos(a+.10)*.067],[Math.sin(a+.2)*.080,.216,Math.cos(a+.2)*.035]],.005);}
  if(raider||kit.officer||civic&&kit.identity%3===0){mesh(head,profile([[-.053,.027,.021,.067],[-.026,.067,.037,.054],[.018,.069,.032,.045]],{segments:16,folds:.08}),hair);}
  if(kit.faction==='Gothic')for(const side of [-1,1])strip(head,hair,[[side*.089,.13,-.054],[side*.105,.03,-.065],[side*.085,-.034,-.055]],.025);

  const legs=[];
  for(const side of [-1,1]){
    const thigh=part(hips,side<0?'right-thigh':'left-thigh',side*.104,0,0);
    mesh(thigh,profile([[.03,.093,.101],[-.05,.106,.113],[-.16,.103,.108],[-.27,.083,.084],[-.37,.067,.070],[-.44,.061,.060]],{folds:.032,foldCount:6}),clothDark);
    const knee=part(thigh,'knee',0,-.43,0);
    mesh(knee,profile([[.035,.062,.064],[-.035,.071,.073],[-.12,.088,.093],[-.205,.077,.082],[-.29,.058,.063],[-.35,.056,.059],[-.40,.047,.051],[-.43,.043,.047]],{folds:.045,foldCount:6}),clothDark);
    const ankle=part(knee,'ankle',0,-.43,0);
    mesh(ankle,profile([[-.066,.047,.10,.055],[-.059,.061,.132,.057],[-.025,.061,.136,.058],[.018,.052,.083,.036],[.075,.047,.052,.005],[.125,.052,.054,0],[.145,.052,.054,0]],{segments:20}),leather);
    mesh(ankle,profile([[-.07,.060,.13,.059],[-.057,.063,.134,.059]],{segments:20}),black);
    mesh(ankle,profile([[.117,.055,.057],[.146,.055,.057]],{segments:16}),leather);
    for(let i=0;i<3;i++)strip(ankle,bronze,[[.036,.045+i*.018,.032],[0,.052+i*.018,.047],[-.036,.045+i*.018,.032]],.003);
    if(raider)for(let i=0;i<4;i++)mesh(knee,profile([[-.27+i*.04,.044,.048],[-.255+i*.04,.045,.049]],{segments:16}),cloth);
    legs.push({thigh,knee,ankle});
  }
  const arms=[];
  for(const side of [-1,1]){
    const shoulder=part(torso,side<0?'right-shoulder':'left-shoulder',side*.240,.419,0);
    mesh(shoulder,profile([[.055,.061,.067],[.015,.096,.091],[-.055,.103,.096],[-.125,.088,.083],[-.17,.072,.067]],{folds:.045,foldCount:6}),cloth);
    mesh(shoulder,profile([[-.172,.074,.070],[-.155,.077,.073]],{segments:18}),clothDark);
    mesh(shoulder,profile([[-.13,.068,.065],[-.19,.065,.063],[-.25,.050,.052],[-.315,.042,.047]],{segments:18}),skin);
    const elbow=part(shoulder,'elbow',0,-.30,0);
    mesh(elbow,profile([[.035,.043,.047],[-.025,.056,.056],[-.09,.053,.052],[-.19,.036,.038],[-.260,.029,.033]],{segments:18}),skin);
    if(veteran)mesh(elbow,profile([[-.145,.038,.041],[-.20,.034,.037]],{segments:18}),leather);
    const hand=part(elbow,'hand',0,-.258,0);
    mesh(hand,profile([[.01,.028,.026],[-.022,.036,.024],[-.064,.034,.02],[-.087,.021,.018]],{segments:12}),skin);
    for(let finger=0;finger<4;finger++){
      const x=(finger-1.5)*.016,len=.048-(finger===0||finger===3?.009:0);
      strip(hand,skin,[[x,-.058,.010],[x,-.075,.027],[x,-.067-len*.2,.039],[x,-.051,.035]],.009);
    }
    strip(hand,skin,[[side*.028,-.022,.004],[side*.044,-.038,.026],[side*.024,-.055,.038]],.011);
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
    for(let i=0;i<12;i++){const a=i/12*TAU;ellipsoid(s,bronze,Math.sin(a)*.238,Math.cos(a)*.37+.03,.027,.007,.007,.004);}
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
    mesh(torso,profile([[.07,.193,.144],[.14,.199,.157],[.24,.231,.174],[.34,.260,.178],[.405,.269,.157],[.454,.225,.133],[.488,.117,.088]],{segments:28,folds:.03,foldCount:7}),mail);
    for(const arm of arms)mesh(arm.shoulder,profile([[.055,.074,.081],[.008,.108,.103],[-.06,.113,.108],[-.15,.090,.086]],{segments:24,folds:.029,foldCount:6}),mail);
    for(const side of [-1,1])strip(torso,leather,[[side*.10,.10,.142],[side*.13,.31,.155],[side*.15,.44,.14]],.019);
    const helmetRoot=part(head,`${kit.helmet}-helmet`);
    if(kit.eastern){
      mesh(helmetRoot,profile([[.087,.119,.103,-.013],[.15,.118,.106,-.013],[.26,.065,.067,-.018],[.325,.008,.01,-.024]],{segments:24}),metal);
      for(const side of [-1,1])strip(helmetRoot,bronze,[[side*.11,.12,.02],[side*.083,.22,.017],[0,.325,-.024]],.005);
      mesh(helmetRoot,profile([[-.045,.13,.12,-.016],[.092,.126,.112,-.018]],{segments:24}),mail).scale.z=.83;
    }else{
      const helmet=mesh(helmetRoot,new T.SphereGeometry(1,28,14,0,TAU,0,Math.PI*.56),metal,0,.109,-.012);helmet.scale.set(.119,.129,.106);
      strip(helmetRoot,bronze,[[-.113,.123,.046],[0,.13,.1],[.113,.123,.046]],.012);
      strip(helmetRoot,bronze,[[0,.126,.1],[0,.214,.071],[0,.247,-.01],[0,.203,-.098]],.009);
      mesh(helmetRoot,profile([[.073,.13,.117,-.013],[.094,.118,.103,-.012]],{segments:28}),metal);
      for(const side of [-1,1]){const cheek=mesh(helmetRoot,shapeGeometry([[-.024,.055],[.027,.05],[.032,-.045],[.008,-.07],[-.025,-.044]],.009),metal,side*.092,.07,.046);cheek.rotation.y=side*.8;}
    }
    if(kit.officer){
      const crest=part(helmetRoot,'officer-horsehair-crest');
      const crestMat=material(0x742e31,clothSurface);
      strip(crest,bronze,[[-.10,.234,-.008],[0,.267,-.008],[.10,.234,-.008]],.014);
      for(let i=0;i<11;i++){const x=(i-5)*.02;strip(crest,crestMat,[[x,.25-Math.abs(x)*.2,-.008],[x*1.12,.315-Math.abs(x)*.34,-.006],[x*1.3,.34-Math.abs(x)*.4,-.005]],.009);}
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
  const horse=mounted?createHorse(root,kit,{part,mesh,profile,ellipsoid,strip,material,surface,leather,metal,hair,cloth}):null;
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
    for(const item of kept){item.updateMatrix();const source=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone();source.applyMatrix4(item.matrix);positions.push(...source.attributes.position.array);normals.push(...source.attributes.normal.array);for(let i=0;i<source.attributes.position.count;i++)colors.push(item.material.color.r,item.material.color.g,item.material.color.b);source.dispose();}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const simple=mesh(parent,g,overviewMaterial);simple.name='overview-detail';simple.userData.overview=true;simple.visible=false;farMeshes.push(simple);
  }
  overview(group);
  // Batch rigid details by material within each joint. Faces, folds, fingers
  // and equipment remain real geometry without hundreds of separate draws.
  const tintedMaterials=new Map();
  function batchKey(mat){return mat.isMeshStandardMaterial&&!mat.transparent?[mat.map?.uuid,mat.bumpMap?.uuid,mat.roughnessMap?.uuid,mat.map?mat.roughness:.82,mat.metalness,mat.bumpScale,mat.side].join('|'):mat;}
  function batch(parent){
    for(const child of [...parent.children])if(child.isGroup||child.isBone)batch(child);
    const buckets=new Map();for(const child of parent.children)if(child.isMesh&&!child.userData.overview){const key=batchKey(child.material),bucket=buckets.get(key)??[];bucket.push(child);buckets.set(key,bucket);}
    for(const [key,items]of buckets){if(items.length<2)continue;const positions=[],normals=[],uv=[],colors=[],mixed=items.some(item=>item.material!==items[0].material);let mat=items[0].material;
      if(mixed){if(!tintedMaterials.has(key)){const merged=mat.clone();merged.color.set(0xffffff);merged.vertexColors=true;if(!merged.map)merged.roughness=.82;materials.add(merged);tintedMaterials.set(key,merged);}mat=tintedMaterials.get(key);}
      for(const item of items){item.updateMatrix();const source=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone();source.applyMatrix4(item.matrix);positions.push(...source.attributes.position.array);normals.push(...source.attributes.normal.array);uv.push(...(source.attributes.uv?.array??new Float32Array(source.attributes.position.count*2)));if(mixed)for(let i=0;i<source.attributes.position.count;i++)colors.push(item.material.color.r,item.material.color.g,item.material.color.b);source.dispose();parent.remove(item);geometries.delete(item.geometry);item.geometry.dispose();}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(mixed)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));mesh(parent,g,mat);
    }
  }
  batch(group);
  group.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial&&!o.userData.overview)nearMeshes.push(o);});
  nearMeshes=bindActorSurfaces(group,nearMeshes,{geometries,materials,skeletons,clothRigs});
  farMeshes=bindActorSurfaces(group,farMeshes,{geometries,materials,skeletons,clothRigs,overview:true});
  const planting=createFootPlanting(),ankleRotation=new T.Quaternion(),footRotation=new T.Quaternion(),footEuler=new T.Euler(0,0,0,'ZXY'),tipPosition=new T.Vector3(),shoulderPosition=new T.Vector3();
  let disposed=false,far=false,lastMotion=null,lastPose=null,transition=null;
  const blendable=p=>({...p,leftArm:[...p.leftArm],rightArm:[...p.rightArm],feet:p.feet.map(f=>({...f}))});
  function detailLevel(input){const distance=Number.isFinite(input.detailDistance)?input.detailDistance:0,next=input.active||input.selected?false:far?distance>=14:distance>18;
    if(next!==far){far=next;for(const m of nearMeshes)m.visible=!far;for(const m of farMeshes)m.visible=far;}
    group.userData.actor.detail=far?'overview':'near';
  }
  function update(input={}){
    if(disposed)return;
    detailLevel(input);
    if(input.resetPose){planting.reset();lastPose=null;lastMotion=null;transition=null;}
    if(!(Number.isFinite(input.dt)&&input.dt>0))transition=null;
    const mapped=civic&&['withdrawn','dead'].includes(input.motion)?{...input,motion:'yield',health:1}:civic&&['attack','strike','throw'].includes(input.motion)?{...input,motion:'speak'}:input;
    let pose=actorPose(mapped);const motion=mapped.motion??'idle';
    if(lastPose&&lastMotion!==motion&&Number.isFinite(input.dt)&&input.dt>0&&(input.phase===undefined||input.phase<.12||motion==='idle'))transition={from:blendable(lastPose),elapsed:0};
    if(transition){transition.elapsed+=Math.min(.05,Math.max(0,input.dt||0));pose=blendActorPose(transition.from,pose,transition.elapsed/.12);if(transition.elapsed>=.12)transition=null;}
    lastMotion=motion;
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
    group.rotation.y=pose.yaw;hips.position.set(pose.hipX??0,pose.hipY,pose.hipZ);hips.rotation.z=horseMotion?-horseMotion.fall*.6:0;torso.rotation.set(pose.bodyX,pose.bodyY,pose.bodyZ);head.rotation.set(pose.headX,pose.headY,0);skirt.rotation.x=pose.skirt;
    for(let i=0;i<2;i++){legs[i].thigh.rotation.set(mounted?-1.05:pose.legs[i].thigh,0,mounted?(i?1:-1)*.48:pose.legs[i].splay??0,'ZXY');legs[i].knee.rotation.x=mounted?1.75:pose.legs[i].knee;
      if(mounted)legs[i].ankle.rotation.set(-.60,0,0);else {ankleRotation.copy(legs[i].thigh.quaternion).multiply(legs[i].knee.quaternion).invert();footRotation.setFromEuler(footEuler.set(pose.feet[i].roll+(pose.feet[i].pitch??0),0,pose.feet[i].bank??0,'ZXY'));legs[i].ankle.quaternion.copy(ankleRotation.multiply(footRotation));}
    }
    right.shoulder.rotation.set(...pose.rightArm);left.shoulder.rotation.set(...pose.leftArm);right.elbow.rotation.x=pose.rightElbow;left.elbow.rotation.x=pose.leftElbow;right.hand.rotation.x=pose.rightWrist;left.hand.rotation.x=pose.leftWrist;
    if(shield){shield.rotation.x=-(pose.leftArm[0]+pose.leftElbow+pose.leftWrist)+pose.shieldTilt;shield.rotation.z=-pose.leftArm[2];}
    if(weapon&&raider&&!archer){const ready=['attack','strike'].includes(input.motion)?actionEnvelope(input.motion,input.phase).preparation:0;weapon.rotation.x=Math.PI/2-pose.rightArm[0]-pose.rightElbow-.18*(1-ready);}
    if(cloak){cloak.rotation.x=pose.skirt*.55+Math.max(0,-pose.bodyX)*.12;cloak.rotation.z=pose.bodyY*-.08;}
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
  function dispose(){if(disposed)return;disposed=true;for(const skeleton of skeletons)skeleton.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const kind of surfaces.keys())releaseActorSurface(kind);group.removeFromParent();}
  const contacts={weapon:weaponContact,shield:shieldContact,body:torso,feet:horse?.feet??legs.map(l=>l.ankle),footClearance:(mounted?.075:.07)*group.scale.y};
  function getReleasePoint(target=new T.Vector3()){
    if(archer&&nockedArrow){target.set(0,0,.694);return nockedArrow.localToWorld(target);}
    return (javelinRelease??right.hand).getWorldPosition(target);
  }
  update();return {group,update,dispose,contacts,getReleasePoint};
}
