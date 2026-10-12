import * as T from '../../vendor/three/three.module.js';
import {actorPose} from './actor-pose.js';
export {actorPose} from './actor-pose.js';

const TAU=Math.PI*2;
const DEFAULTS={skin:0xbe8966,cloth:0xc7bea0,leather:0x46352c,hair:0x30231e,shield:0x285f67,metal:0x727b7b,bronze:0xa78a50};

// Elliptical profile mesh with small sewn folds. Used for clothing, anatomy,
// footwear and armor, so silhouettes are shaped rather than primitive stacks.
function profile(rings,{segments=20,folds=0,foldCount=9}={}){
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

/** Procedural 3D rig, feet at local y=0 and anatomical forward +Z.
 * Direction is yaw radians. Caller owns group.position. Phase is normalized
 * action progress, or one walking cycle (about .72m); omitted gait uses time.
 */
export function createActor(unit={},options={}){
  const role=options.role??(unit.side==='enemy'?'raider':unit.id==='hero'?'recruit':'veteran');
  const veteran=role==='veteran',raider=role==='raider',archer=unit.role==='archer',p={...DEFAULTS,...(raider?{cloth:0x82704f,hair:0x70513b,shield:0x85392e,skin:0xc79775}:{}),...options.palette};
  const geometries=new Set(),materials=new Set(),textures=new Set(),group=new T.Group(),root=new T.Group();group.add(root);group.scale.y=1.05;
  group.name=`actor:${unit.id??role}`;group.userData.actor={unitId:unit.id,role:archer?'archer':role,height:1.83,forward:'+Z'};
  const material=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.84,metalness:0,...extra});materials.add(m);return m;};
  const skin=material(p.skin),cloth=material(p.cloth),clothDark=material(new T.Color(p.cloth).multiplyScalar(.69)),leather=material(p.leather),hair=material(p.hair),metal=material(p.metal,{metalness:.72,roughness:.36}),bronze=material(p.bronze,{metalness:.68,roughness:.4}),white=material(0xd7cbaa),black=material(0x241b17),eyeWhite=material(0xd0bca0),iris=material(0x31281c),shieldPaint=material(p.shield),lip=material(raider?0x925c47:0x85503f);
  const mesh=(parent,geometry,mat,x=0,y=0,z=0)=>{geometries.add(geometry);const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const ellipsoid=(parent,mat,x,y,z,rx,ry,rz)=>{const m=mesh(parent,new T.SphereGeometry(1,16,10),mat,x,y,z);m.scale.set(rx,ry,rz);return m;};
  const part=(parent,name,x=0,y=0,z=0)=>{const g=new T.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
  const strip=(parent,mat,points,radius=.008)=>mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),Math.max(4,points.length*2),radius,5,false),mat);
  const hips=part(root,'hips',0,.91,0),torso=part(hips,'torso');
  mesh(torso,profile([[.03,.16,.103],[.13,.165,.115],[.30,.215,.118],[.43,.233,.115],[.48,.195,.104],[.5,.10,.073]],{folds:.02}),cloth);
  const skirt=part(torso,'tunic-hem');mesh(skirt,profile([[-.18,.213,.14],[-.13,.205,.14],[-.04,.178,.12],[.03,.166,.106],[.055,.161,.101]],{folds:.045}),cloth);
  // Hem tape and vertical seams are low relief, not disconnected armor plates.
  mesh(skirt,profile([[-.182,.215,.142],[-.164,.214,.142]],{folds:.045}),clothDark);
  for(const x of [-.115,.115])strip(torso,clothDark,[[x,.05,.108],[x*1.12,.23,.121],[x*1.35,.41,.108]],.004);
  mesh(torso,profile([[.02,.166,.11],[.069,.168,.111]],{segments:24}),leather);
  mesh(torso,shapeGeometry([[-.028,-.025],[.028,-.025],[.028,.025],[-.028,.025]],.006),bronze,0,.044,.116);
  const neck=mesh(torso,profile([[.47,.071,.061],[.56,.066,.06],[.59,.069,.063]],{segments:16}),skin);
  const head=part(torso,'head',0,.575,0);
  mesh(head,profile([[-.04,.035,.056,.024],[-.02,.066,.073,.013],[.015,.086,.079,.008],[.075,.103,.086],[.125,.104,.088,-.003],[.175,.089,.08,-.008],[.204,.058,.057,-.01],[.218,.007,.008,-.01]],{segments:28}),skin);
  // Nose bridge and alae, brow ridge, inset almond eyes and ears establish an
  // actual face at close range without oversize toy eyes.
  mesh(head,shapeGeometry([[-.012,.015],[.012,.015],[.017,.044],[.009,.094],[-.008,.097],[-.014,.046]],.025),skin,0,0,.077);
  ellipsoid(head,skin,0,.035,.108,.019,.012,.015);
  for(const side of [-1,1]){
    ellipsoid(head,skin,side*.101,.071,-.002,.019,.037,.015);
    ellipsoid(head,lip,side*.111,.068,.001,.006,.021,.006);
    ellipsoid(head,eyeWhite,side*.044,.093,.077,.026,.010,.011);
    ellipsoid(head,iris,side*.043,.093,.088,.008,.008,.004);
    strip(head,hair,[[side*.022,.111,.082],[side*.046,.116,.081],[side*.069,.109,.071]],.0045);
    strip(head,skin,[[side*.019,.091,.085],[side*.044,.102,.086],[side*.066,.091,.078]],.003);
  }
  strip(head,lip,[[-.031,.007,.076],[0,.004,.084],[.032,.007,.076]],.0035);
  strip(head,skin,[[-.023,-.009,.073],[0,-.013,.082],[.024,-.009,.073]],.0035);
  // Sculpted hair cap follows the skull with a swept, uneven hairline.
  const hairGeo=new T.SphereGeometry(1,24,12,0,TAU,0,Math.PI*.60),hp=hairGeo.getAttribute('position');
  for(let i=0;i<hp.count;i++){const x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i),wave=1+.025*Math.sin(Math.atan2(x,z)*9+y*5);hp.setXYZ(i,x*.109*wave,y*.113+.105,z*.095*wave-.012);}hairGeo.computeVertexNormals();mesh(head,hairGeo,hair);
  for(let i=0;i<8;i++){const a=-1.25+i*.35;strip(head,hair,[[Math.sin(a)*.094,.145,Math.cos(a)*.079],[Math.sin(a+.10)*.104,.183,Math.cos(a+.10)*.065],[Math.sin(a+.2)*.080,.216,Math.cos(a+.2)*.033]],.012);}
  if(raider){mesh(head,profile([[-.068,.027,.021,.067],[-.026,.067,.037,.054],[.018,.069,.032,.045]],{segments:16,folds:.1}),hair);}

  const legs=[];
  for(const side of [-1,1]){
    const thigh=part(hips,side<0?'right-thigh':'left-thigh',side*.091,0,0);
    mesh(thigh,profile([[0,.078,.092],[-.05,.085,.09],[-.2,.068,.074],[-.36,.054,.059],[-.42,.05,.05]],{folds:.023}),veteran?clothDark:leather);
    const knee=part(thigh,'knee',0,-.43,0);
    mesh(knee,profile([[.025,.049,.053],[-.04,.055,.055],[-.14,.06,.06],[-.3,.038,.041],[-.43,.035,.038]],{folds:.025}),raider?clothDark:leather);
    const ankle=part(knee,'ankle',0,-.43,0);
    mesh(ankle,profile([[-.066,.043,.10,.055],[-.059,.056,.132,.057],[-.025,.056,.136,.058],[.018,.043,.082,.036],[.074,.038,.045,0],[.105,.039,.042,0]],{segments:20}),leather);
    mesh(ankle,profile([[-.07,.055,.13,.059],[-.057,.058,.134,.059]],{segments:20}),black);
    for(let i=0;i<3;i++)strip(ankle,bronze,[[.036,.045+i*.018,.032],[0,.052+i*.018,.047],[-.036,.045+i*.018,.032]],.003);
    if(raider)for(let i=0;i<4;i++)mesh(knee,profile([[-.27+i*.04,.044,.048],[-.255+i*.04,.045,.049]],{segments:16}),cloth);
    legs.push({thigh,knee,ankle});
  }
  const arms=[];
  for(const side of [-1,1]){
    const shoulder=part(torso,side<0?'right-shoulder':'left-shoulder',side*.226,.419,0);
    mesh(shoulder,profile([[.035,.055,.069],[-.015,.083,.078],[-.13,.067,.064],[-.16,.061,.057]],{folds:.045}),veteran?metal:cloth);
    mesh(shoulder,profile([[-.125,.055,.052],[-.21,.05,.047],[-.285,.039,.04],[-.31,.035,.039]],{segments:16}),skin);
    const elbow=part(shoulder,'elbow',0,-.30,0);
    mesh(elbow,profile([[.027,.035,.039],[-.025,.044,.044],[-.09,.041,.042],[-.2,.03,.033],[-.255,.026,.029]],{segments:16}),skin);
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
    const verts=[],ind=[];for(let j=0;j<=6;j++){const r=j/6;for(let i=0;i<=40;i++){const a=i/40*TAU;verts.push(Math.sin(a)*.257*r,Math.cos(a)*.392*r+.03,.019+.045*(1-r*r));if(j&&i){const k=j*41+i;ind.push(k,k-1,k-41,k-1,k-42,k-41);}}}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(ind);g.computeVertexNormals();mesh(s,g,shieldPaint);
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
  const shield=archer?null:makeShield();
  const weapon=part(right.hand,raider?'spear':'sword',0,-.052,.018);weapon.rotation.x=Math.PI;
  mesh(weapon,new T.CylinderGeometry(.012,.012,.095,10),leather,0,-.006,0);
  if(raider&&!archer){
    mesh(weapon,new T.CylinderGeometry(.011,.015,1.65,10),leather,0,.42,0);
    mesh(weapon,shapeGeometry([[0,.19],[-.036,.035],[-.012,0],[.012,0],[.036,.035]],.009),metal,0,1.24,0);
    mesh(weapon,new T.CylinderGeometry(.016,.013,.07,10),bronze,0,1.24,0);
  }else{
    mesh(weapon,new T.CylinderGeometry(.016,.023,.035,12),bronze,0,-.07,0);
    const guard=ellipsoid(weapon,bronze,0,.056,0,.062,.018,.022);
    // Ridged diamond-section blade, individually modeled faces catch light.
    const blade=new T.BufferGeometry(),v=[-.027,.073,0, .027,.073,0, 0,.073,.009, 0,.073,-.009, -.022,.47,0, .022,.47,0, 0,.47,.006, 0,.47,-.006, 0,.59,0];
    blade.setAttribute('position',new T.Float32BufferAttribute(v,3));blade.setIndex([0,4,6,0,6,2,2,6,5,2,5,1,1,5,7,1,7,3,3,7,4,3,4,0,4,8,6,6,8,5,5,8,7,7,8,4]);blade.computeVertexNormals();mesh(weapon,blade,metal);
  }
  weapon.visible=!archer;
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
  const sheath=part(torso,'scabbard',-.18,.065,-.015);sheath.rotation.z=-.16;
  mesh(sheath,profile([[.03,.034,.018],[-.42,.029,.016],[-.49,.018,.014],[-.50,.005,.007]],{segments:10}),leather);
  mesh(sheath,profile([[.033,.036,.02],[.006,.036,.02]],{segments:10}),bronze);
  mesh(sheath,profile([[-.46,.027,.018],[-.49,.021,.017]],{segments:10}),bronze);
  strip(torso,leather,[[-.2,.06,-.02],[-.08,.3,.122],[.13,.47,.106]],.022);
  if(veteran){
    const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const xx=(x+(Math.floor(y/16)%2)*8)%16-8,yy=y%16-8,d=Math.hypot(xx,yy*.85),c=d>4.3&&d<6.4?148:72,i=(y*size+x)*4;data.set([c,c,c,255],i);}const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(5,5);texture.needsUpdate=true;textures.add(texture);
    const mail=material(0x9a9d94,{metalness:.6,roughness:.66,map:texture});
    mesh(torso,profile([[.071,.177,.124],[.15,.18,.126],[.32,.225,.128],[.43,.24,.126],[.47,.193,.114]],{segments:28,folds:.014}),mail);
    for(const side of [-1,1])strip(torso,leather,[[side*.10,.10,.122],[side*.13,.31,.132],[side*.15,.44,.119]],.019);
    // Rounded ridge helmet, flared neck guard and hinged cheek pieces.
    const helmet=mesh(head,new T.SphereGeometry(1,28,14,0,TAU,0,Math.PI*.56),metal,0,.109,-.012);helmet.scale.set(.119,.129,.106);
    strip(head,bronze,[[-.113,.123,.046],[0,.13,.1],[.113,.123,.046]],.012);
    strip(head,bronze,[[0,.126,.1],[0,.214,.071],[0,.247,-.01],[0,.203,-.098]],.009);
    mesh(head,profile([[.073,.13,.117,-.013],[.094,.118,.103,-.012]],{segments:28}),metal);
    for(const side of [-1,1]){const cheek=mesh(head,shapeGeometry([[-.024,.055],[.027,.05],[.032,-.045],[.008,-.07],[-.025,-.044]],.009),metal,side*.092,.07,.046);cheek.rotation.y=side*.8;}
    // The soldier's cloak hangs as a shaped, folded panel behind the mail.
    const cloak=mesh(torso,profile([[-.10,.23,.055,-.14],[.1,.23,.055,-.14],[.32,.20,.05,-.12],[.45,.145,.035,-.095]],{segments:16,folds:.065}),material(0x773d32));cloak.scale.z=.65;
  }
  const ring=mesh(group,new T.RingGeometry(.32,.343,48),new T.MeshBasicMaterial({color:0xe6bc6c,transparent:true,opacity:.85,side:T.DoubleSide}),0,.009,0);materials.add(ring.material);ring.rotation.x=-Math.PI/2;ring.visible=false;ring.castShadow=false;ring.receiveShadow=false;
  // Batch rigid details by material within each joint. Faces, folds, fingers
  // and equipment remain real geometry without hundreds of separate draws.
  function batch(parent){
    for(const child of [...parent.children])if(child.isGroup)batch(child);
    const buckets=new Map();for(const child of parent.children)if(child.isMesh){const bucket=buckets.get(child.material)??[];bucket.push(child);buckets.set(child.material,bucket);}
    for(const [mat,items]of buckets){if(items.length<2)continue;const positions=[],normals=[],uv=[];
      for(const item of items){item.updateMatrix();const source=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone();source.applyMatrix4(item.matrix);positions.push(...source.attributes.position.array);normals.push(...source.attributes.normal.array);uv.push(...(source.attributes.uv?.array??new Float32Array(source.attributes.position.count*2)));source.dispose();parent.remove(item);geometries.delete(item.geometry);item.geometry.dispose();}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));mesh(parent,g,mat);
    }
  }
  batch(group);
  let disposed=false;
  function update(input={}){
    if(disposed)return;const pose=actorPose(input);
    if(archer){const firing=['throw','attack','strike'].includes(input.motion),p=Number.isFinite(input.phase)?Math.max(0,Math.min(1,input.phase)):0,draw=firing?(p<.5?Math.sin(p*Math.PI):Math.max(0,1-(p-.5)*8)):0;
      pose.leftArm=[firing?-1.4:-.35,0,-.12];pose.leftElbow=firing?-.16:-.35;pose.rightArm=[firing?-1.2:-.1,0,.08];pose.rightElbow=-.35-1.55*draw;pose.bodyY=-.12*draw;
      bow.rotation.x=-pose.leftArm[0]-pose.leftElbow;bowString.geometry.attributes.position.setZ(1,-.09-.26*draw);bowString.geometry.attributes.position.needsUpdate=true;
      nockedArrow.visible=firing&&p<.52;nockedArrow.position.z=-.09-.26*draw;
    }
    group.rotation.y=pose.yaw;hips.position.set(0,pose.hipY,pose.hipZ);torso.rotation.set(pose.bodyX,pose.bodyY,pose.bodyZ);head.rotation.set(pose.headX,pose.headY,0);skirt.rotation.x=pose.skirt;
    for(let i=0;i<2;i++){legs[i].thigh.rotation.x=pose.legs[i].thigh;legs[i].knee.rotation.x=pose.legs[i].knee;legs[i].ankle.rotation.x=pose.legs[i].ankle;}
    right.shoulder.rotation.set(...pose.rightArm);left.shoulder.rotation.set(...pose.leftArm);right.elbow.rotation.x=pose.rightElbow;left.elbow.rotation.x=pose.leftElbow;right.hand.rotation.x=pose.rightWrist;left.hand.rotation.x=pose.leftWrist;
    if(shield){shield.rotation.x=-(pose.leftArm[0]+pose.leftElbow+pose.leftWrist)+pose.shieldTilt;shield.rotation.z=-pose.leftArm[2];}
    if(raider&&!archer)weapon.rotation.x=Math.PI/2-pose.rightArm[0]-pose.rightElbow+(['attack','strike'].includes(input.motion)?0:-.18);
    ring.visible=!!input.selected;
    group.updateMatrixWorld(true);
  }
  function dispose(){if(disposed)return;disposed=true;for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();group.removeFromParent();}
  update();return {group,update,dispose};
}
