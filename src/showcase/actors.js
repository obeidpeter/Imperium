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
  const role=options.role??(unit.role==='trainer'||unit.id==='dummy'?'trainer':unit.side==='enemy'?'raider':unit.id==='hero'?'recruit':'veteran');
  const veteran=role==='veteran',trainer=role==='trainer',raider=role==='raider',archer=unit.role==='archer',p={...DEFAULTS,...(raider?{cloth:0x82704f,hair:0x70513b,shield:0x85392e,skin:0xc79775}:trainer?{cloth:0xb8aa86,hair:0x594739,shield:0x875c41,skin:0xb98364}:{}),...options.palette};
  const geometries=new Set(),materials=new Set(),textures=new Set(),group=new T.Group(),root=new T.Group();group.add(root);group.scale.y=1.05;
  group.name=`actor:${unit.id??role}`;group.userData.actor={unitId:unit.id,role:archer?'archer':role,height:1.83,forward:'+Z'};
  const material=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.84,metalness:0,...extra});materials.add(m);return m;};
  // Small seamless, deterministic material tiles. These are native geometry
  // surfaces (albedo/height/roughness), generated locally without a bitmap load.
  function surface(kind){
    const size=96,colour=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const hash=((Math.imul(x+1,374761393)^Math.imul(y+9,668265263))>>>0)%997/997;
      let h=.5,c=.94,r=.88;
      if(kind==='cloth'){const warp=Math.cos(x*Math.PI/2),weft=Math.cos(y*Math.PI/2);h=.5+.15*warp+.13*weft+.035*(hash-.5);c=.89+.055*warp+.03*weft;r=.86+.10*hash;}
      else if(kind==='leather'){const grain=Math.sin(x*.8+Math.cos(y*.6))*Math.cos(y*.7);h=.5+.12*grain+.12*(hash-.5);c=.84+.07*grain+.05*hash;r=.72+.16*hash;}
      else if(kind==='mail'){const row=Math.floor(y/12),xx=(x+(row%2)*6)%12-6,yy=y%12-6,d=Math.hypot(xx,yy*.83),ring=Math.max(0,1-Math.abs(d-3.65)/1.35);h=.16+.75*ring;c=.32+.58*ring;r=.38+.36*(1-ring);}
      else {h=.48+.10*Math.sin(x*.33+Math.sin(y*.09))+.03*(hash-.5);c=.90+.045*Math.sin(x*.33+Math.sin(y*.09));r=.76+.10*hash;}
      const i=(y*size+x)*4;colour.set([c*255,c*255,c*255,255],i);height.set([h*255,h*255,h*255,255],i);rough.set([r*255,r*255,r*255,255],i);
    }
    const texture=(data,color=false)=>{const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.repeat.set(kind==='mail'?3:kind==='cloth'?5:2,kind==='mail'?3:kind==='cloth'?4:2);if(color)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;textures.add(t);return t;};
    return {map:texture(colour,true),bumpMap:texture(height),roughnessMap:texture(rough),bumpScale:kind==='mail'?.014:kind==='cloth'?.004:.005};
  }
  const clothSurface=surface('cloth'),leatherSurface=surface('leather'),paintSurface=surface('paint');
  const skin=material(p.skin,{roughness:.78}),cloth=material(p.cloth,clothSurface),clothDark=material(new T.Color(p.cloth).multiplyScalar(.67),clothSurface),leather=material(p.leather,leatherSurface),hair=material(p.hair),metal=material(p.metal,{metalness:.62,roughness:.38}),bronze=material(p.bronze,{metalness:.6,roughness:.42}),white=material(0xd7cbaa),black=material(0x241b17),eyeWhite=material(0xd0bca0),iris=material(0x31281c),shieldPaint=material(p.shield,paintSurface),lip=material(raider?0x925c47:0x85503f),practiceWood=trainer?material(0x9d8053,paintSurface):null;
  cloth.name='woven tunic';leather.name='worked leather';shieldPaint.name='painted wooden shield';
  const mesh=(parent,geometry,mat,x=0,y=0,z=0)=>{geometries.add(geometry);const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const ellipsoid=(parent,mat,x,y,z,rx,ry,rz)=>{const m=mesh(parent,new T.SphereGeometry(1,16,10),mat,x,y,z);m.scale.set(rx,ry,rz);return m;};
  const part=(parent,name,x=0,y=0,z=0)=>{const g=new T.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
  const strip=(parent,mat,points,radius=.008)=>mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),Math.max(4,points.length*2),radius,5,false),mat);
  const hips=part(root,'hips',0,.91,0),torso=part(hips,'torso');
  mesh(torso,profile([[.03,.174,.115],[.13,.179,.129],[.30,.231,.141],[.43,.247,.129],[.48,.206,.108],[.5,.104,.079]],{folds:.023}),cloth);
  const skirt=part(torso,'tunic-hem');mesh(skirt,profile([[-.28,.222,.147],[-.22,.217,.147],[-.10,.197,.135],[-.04,.183,.129],[.03,.18,.119],[.055,.176,.111]],{folds:.035}),cloth);
  // Hem tape and vertical seams are low relief, not disconnected armor plates.
  mesh(skirt,profile([[-.282,.224,.149],[-.264,.223,.149]],{folds:.035}),clothDark);
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
    ellipsoid(head,skin,side*.104,.071,-.002,.015,.033,.015);
    ellipsoid(head,lip,side*.112,.068,.001,.004,.019,.006);
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
    const thigh=part(hips,side<0?'right-thigh':'left-thigh',side*.104,0,0);
    mesh(thigh,profile([[0,.087,.097],[-.05,.093,.101],[-.2,.078,.084],[-.33,.061,.068],[-.42,.054,.055]],{folds:.018}),clothDark);
    const knee=part(thigh,'knee',0,-.43,0);
    mesh(knee,profile([[.025,.054,.057],[-.04,.058,.06],[-.12,.071,.074],[-.22,.054,.060],[-.33,.040,.044],[-.43,.035,.038]],{folds:.021}),clothDark);
    const ankle=part(knee,'ankle',0,-.43,0);
    mesh(ankle,profile([[-.066,.043,.10,.055],[-.059,.056,.132,.057],[-.025,.056,.136,.058],[.018,.043,.082,.036],[.074,.038,.045,0],[.105,.039,.042,0]],{segments:20}),leather);
    mesh(ankle,profile([[-.07,.055,.13,.059],[-.057,.058,.134,.059]],{segments:20}),black);
    for(let i=0;i<3;i++)strip(ankle,bronze,[[.036,.045+i*.018,.032],[0,.052+i*.018,.047],[-.036,.045+i*.018,.032]],.003);
    if(raider)for(let i=0;i<4;i++)mesh(knee,profile([[-.27+i*.04,.044,.048],[-.255+i*.04,.045,.049]],{segments:16}),cloth);
    legs.push({thigh,knee,ankle});
  }
  const arms=[];
  for(const side of [-1,1]){
    const shoulder=part(torso,side<0?'right-shoulder':'left-shoulder',side*.240,.419,0);
    mesh(shoulder,profile([[.035,.064,.073],[-.015,.09,.084],[-.13,.074,.07],[-.16,.067,.064]],{folds:.03}),cloth);
    mesh(shoulder,profile([[-.159,.069,.066],[-.147,.07,.067]],{segments:18}),clothDark);
    mesh(shoulder,profile([[-.125,.061,.059],[-.195,.057,.054],[-.26,.044,.045],[-.31,.038,.042]],{segments:18}),skin);
    const elbow=part(shoulder,'elbow',0,-.30,0);
    mesh(elbow,profile([[.027,.038,.042],[-.025,.050,.050],[-.09,.046,.047],[-.2,.032,.035],[-.255,.028,.031]],{segments:18}),skin);
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
  const shield=archer?null:makeShield();
  const weapon=part(right.hand,trainer?'practice-sword':raider?'spear':'sword',0,-.052,.018);weapon.rotation.x=Math.PI;
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
  weapon.visible=!archer;
  const javelin=archer?null:part(right.hand,'held-javelin',0,-.052,.018);
  if(javelin){javelin.rotation.x=Math.PI;mesh(javelin,new T.CylinderGeometry(.009,.013,1.25,8),leather,0,.30,0);mesh(javelin,new T.ConeGeometry(.024,.19,4),trainer?practiceWood:metal,0,1.02,0);javelin.visible=false;}
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
  strip(torso,leather,[[-.21,.06,-.02],[-.08,.3,.149],[.14,.47,.116]],.022);
  if(veteran){
    const mail=material(0xb4b5a9,{metalness:.50,roughness:.8,...surface('mail')});mail.name='interlinked mail';
    mesh(torso,profile([[.078,.19,.139],[.15,.193,.143],[.32,.245,.154],[.43,.26,.145],[.47,.214,.127]],{segments:28,folds:.014}),mail);
    for(const arm of arms)mesh(arm.shoulder,profile([[.033,.077,.086],[-.025,.097,.093],[-.135,.080,.077]],{segments:24,folds:.016}),mail);
    for(const side of [-1,1])strip(torso,leather,[[side*.10,.10,.142],[side*.13,.31,.155],[side*.15,.44,.14]],.019);
    // Rounded ridge helmet, flared neck guard and hinged cheek pieces.
    const helmet=mesh(head,new T.SphereGeometry(1,28,14,0,TAU,0,Math.PI*.56),metal,0,.109,-.012);helmet.scale.set(.119,.129,.106);
    strip(head,bronze,[[-.113,.123,.046],[0,.13,.1],[.113,.123,.046]],.012);
    strip(head,bronze,[[0,.126,.1],[0,.214,.071],[0,.247,-.01],[0,.203,-.098]],.009);
    mesh(head,profile([[.073,.13,.117,-.013],[.094,.118,.103,-.012]],{segments:28}),metal);
    for(const side of [-1,1]){const cheek=mesh(head,shapeGeometry([[-.024,.055],[.027,.05],[.032,-.045],[.008,-.07],[-.025,-.044]],.009),metal,side*.092,.07,.046);cheek.rotation.y=side*.8;}
    // The soldier's cloak hangs as a shaped, folded panel behind the mail.
    const cloak=mesh(torso,profile([[-.10,.24,.055,-.16],[.1,.24,.055,-.16],[.32,.22,.05,-.14],[.45,.16,.035,-.115]],{segments:16,folds:.055}),material(0x773d32,clothSurface));cloak.scale.z=.8;
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
    const throwing=!archer&&input.motion==='throw';weapon.visible=!archer&&!throwing;if(javelin)javelin.visible=throwing&&(input.phase??0)<.5;
    if(archer){const firing=['throw','attack','strike'].includes(input.motion),p=Number.isFinite(input.phase)?Math.max(0,Math.min(1,input.phase)):0,draw=firing?(p<.5?Math.sin(p*Math.PI):Math.max(0,1-(p-.5)*8)):0;
      const smooth=t=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);},raise=firing?smooth(p/.18)*(1-smooth((p-.78)/.22)):0;
      pose.leftArm=[-.35-1.05*raise,0,-.12];pose.leftElbow=-.35+.19*raise;pose.rightArm=[-.1-1.1*raise,0,.08];pose.rightElbow=-.35-1.55*draw;pose.bodyY=-.12*draw;
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
