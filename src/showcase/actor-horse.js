import * as T from '../../vendor/three/three.module.js';
import {horsePose} from './actor-pose.js';

// A real quadruped mesh, with independent leg joints and a separate saddle.
// Uses the actor's resource registry and static-joint batching/disposal.
export function createHorse(root,kit,b){
  const {part,mesh,profile,ellipsoid,strip,material,surface,leather,metal,hair,cloth}=b;
  const coat=material([0x6b4937,0x8b694b,0x5e5349][kit.identity%3],surface('horse')),hoof=material(0x322e29),mark=material(0xbdb39c),horse=part(root,'horse'),body=part(horse,'horse-body',0,1.04,0);
  const trunk=mesh(body,profile([[-.86,.075,.17],[-.72,.28,.29],[-.53,.365,.345],[-.26,.378,.373],[.05,.36,.385],[.31,.34,.37],[.53,.29,.325],[.68,.16,.20]],{segments:24}),coat);trunk.rotation.x=Math.PI/2;
  const neck=part(body,'horse-neck');
  mesh(neck,profile([[.0,.245,.23,.49],[.16,.265,.25,.54],[.32,.24,.245,.59],[.47,.193,.21,.67],[.60,.15,.178,.76],[.72,.12,.148,.82],[.79,.10,.125,.85]],{segments:20}),coat);
  const head=part(neck,'horse-head',0,.72,.87);head.rotation.x=.32;
  mesh(head,profile([[-.265,.09,.10,.202],[-.19,.114,.115,.155],[-.10,.106,.135,.115],[.025,.12,.157,.045],[.12,.115,.133,-.015],[.195,.073,.082,-.022]],{segments:20}),coat);
  ellipsoid(head,coat,0,-.235,.205,.115,.073,.104);
  // Separate broad cheek planes and a softer poll avoid a tube-shaped head.
  for(const side of [-1,1])ellipsoid(head,coat,side*.077,-.035,.015,.064,.101,.115);
  for(const side of [-1,1]){
    const ear=mesh(head,profile([[0,.04,.033],[.09,.031,.02],[.18,.006,.01]],{segments:12}),coat,side*.067,.14,-.035);ear.rotation.z=side*-.15;
    ellipsoid(head,hoof,side*.103,.023,.09,.014,.017,.012);
    ellipsoid(head,hoof,side*.074,-.218,.263,.018,.010,.007);
    strip(head,leather,[[side*.11,-.16,.22],[side*.12,.03,.05],[side*.07,.15,-.04]],.011);
  }
  strip(head,leather,[[-.103,-.20,.21],[0,-.19,.293],[.103,-.20,.21]],.012);
  strip(head,mark,[[0,.17,.047],[0,.04,.177],[0,-.13,.23]],.014);
  for(let i=0;i<8;i++)strip(neck,hair,[[0,.72-i*.077,.75-i*.04],[-.016,.62-i*.077,.68-i*.04],[.025,.53-i*.077,.65-i*.04]],.023);
  const tail=part(body,'horse-tail',0,.04,-.78);strip(tail,hair,[[0,0,0],[.03,-.27,-.18],[.01,-.67,-.24]],.055);
  const saddle=part(body,'saddle');
  const blanket=mesh(saddle,profile([[-.30,.25,.39],[-.24,.36,.40],[.16,.37,.38],[.29,.22,.25]],{segments:20}),cloth,0,.34,-.1);blanket.rotation.x=Math.PI/2;
  mesh(saddle,profile([[.30,.23,.30],[.43,.24,.25],[.46,.22,.22]],{segments:20}),leather,0,0,-.08);
  // Four small saddle horns suggest a period four-horned saddle, not stirrups.
  for(const x of [-.18,.18])for(const z of [-.24,.13]){const horn=mesh(saddle,new T.ConeGeometry(.044,.16,10),leather,x,.48,z);horn.rotation.z=-x*.9;}
  strip(body,leather,[[-.31,.32,-.06],[-.36,-.12,-.06],[0,-.35,-.06],[.36,-.12,-.06],[.31,.32,-.06]],.016);
  for(const side of [-1,1])strip(body,leather,[[side*.1,.53,.85],[side*.28,.44,.44],[side*.24,.55,.0]],.009);
  const legs=[];
  for(let i=0;i<4;i++){
    const front=i<2,side=i%2?-1:1,pivot=part(horse,`${front?'fore':'hind'}-${side<0?'left':'right'}-leg`,side*.235,1.04,front?.54:-.54);
    mesh(pivot,profile([[.04,front?.12:.15,.15],[-.10,front?.105:.13,.135],[-.25,.074,.097],[-.40,.051,.066],[-.55,.043,.052]],{segments:16}),coat);
    const knee=part(pivot,'horse-knee',0,-.53,0);mesh(knee,profile([[.035,.050,.059],[-.07,.052,.059],[-.26,.035,.043],[-.41,.033,.039],[-.53,.043,.045]],{segments:14}),coat);
    const ankle=part(knee,'horse-fetlock',0,-.53,0);mesh(ankle,profile([[.03,.043,.058],[-.018,.054,.071,.015],[-.075,.071,.096,.025]],{segments:14}),hoof);
    legs.push({pivot,knee,ankle});
  }
  let lastPose=horsePose();
  const ankleRotation=new T.Quaternion(),surfaceRotation=new T.Quaternion(),surfaceEuler=new T.Euler(0,0,0,'ZXY');
  function update(input,suppliedPose){const p=suppliedPose??horsePose(input);lastPose=p;horse.rotation.z=p.fall*-.84;horse.position.y=-.44*p.fall;body.position.y=p.bodyY;body.rotation.x=p.bodyPitch;neck.rotation.x=p.neckPitch;tail.rotation.z=p.tail;
    for(let i=0;i<4;i++){legs[i].pivot.position.y=p.bodyY;legs[i].pivot.rotation.set(p.legs[i].upper,0,p.legs[i].splay??0,'ZXY');legs[i].knee.rotation.x=p.legs[i].knee;
      ankleRotation.copy(legs[i].pivot.quaternion).multiply(legs[i].knee.quaternion).invert();surfaceRotation.setFromEuler(surfaceEuler.set(p.feet[i].roll+(p.feet[i].pitch??0),0,p.feet[i].bank??0,'ZXY'));legs[i].ankle.quaternion.copy(ankleRotation.multiply(surfaceRotation));}
    return p;
  }
  update({});return {group:horse,update,feet:legs.map(l=>l.ankle),get pose(){return lastPose;}};
}
