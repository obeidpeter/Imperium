import * as T from '../../vendor/three/three.module.js';

const TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

function builder(){
  const p=[],uv=[],color=[],index=[];
  return {p,index,vertex(point,u=0,v=0,tint=[1,1,1]){const n=p.length/3;p.push(...point);uv.push(u,v);color.push(...tint);return n;},quad(a,b,c,d){index.push(a,b,c,b,d,c);},finish(name){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(index);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.originalModel=name;return g;
  }};
}
function interpolate(rows,t,column){const f=clamp(t)*(rows.length-1),i=Math.min(rows.length-2,Math.floor(f));return rows[i][column]+(rows[i+1][column]-rows[i][column])*(f-i);}
// A shaped elliptical sweep. Radius changes at each anatomical landmark;
// fingers have knuckle volume, narrow interphalangeal folds and tapered tips.
function sweep(b,rows,{radial=10,samples=16,tint=[1,1,1],crease=false,cap=true}={}){
  const curve=new T.CatmullRomCurve3(rows.map(r=>new T.Vector3(...r.slice(0,3))),false,'centripetal');
  const rings=[],point=new T.Vector3(),direction=new T.Vector3(),across=new T.Vector3(1,0,0),normal=new T.Vector3();
  for(let j=0;j<=samples;j++){
    const t=j/samples;curve.getPoint(t,point);curve.getTangent(t,direction);across.set(1,0,0).addScaledVector(direction,-direction.x).normalize();normal.crossVectors(across,direction).normalize();
    const ring=[],fold=crease?1-.11*Math.exp(-(((t-.36)/.035)**2))-.095*Math.exp(-(((t-.69)/.035)**2)):1;
    const rx=interpolate(rows,t,3)*fold,rz=interpolate(rows,t,4)*fold;
    for(let i=0;i<radial;i++){
      const a=i/radial*TAU,s=Math.sin(a),c=Math.cos(a),v=point.clone().addScaledVector(across,s*rx).addScaledVector(normal,c*rz);
      const shade=crease&&fold<.94?.96:1;ring.push(b.vertex(v.toArray(),i/radial,j/samples,tint.map(x=>x*shade)));
    }
    if(j)for(let i=0;i<radial;i++)b.quad(rings[j-1][i],rings[j-1][(i+1)%radial],ring[i],ring[(i+1)%radial]);rings.push(ring);
  }
  if(cap)for(const [end,row] of [[0,rows[0]],[rings.length-1,rows.at(-1)]]){
    const center=b.vertex(row.slice(0,3),.5,end?1:0,tint),ring=rings[end];
    for(let i=0;i<radial;i++)if(end)b.index.push(ring[i],ring[(i+1)%radial],center);else b.index.push(ring[(i+1)%radial],ring[i],center);
  }
  return {curve,rings};
}
function nail(b,center,width,length,normal,tangent){
  const across=new T.Vector3(1,0,0),n=new T.Vector3(...normal),t=new T.Vector3(...tangent),p=new T.Vector3(...center),rings=[];
  for(let j=0;j<3;j++){
    const v=j/2,ring=[];
    for(let i=0;i<5;i++){
      const u=i/4,x=(u-.5)*2,round=Math.sqrt(Math.max(0,1-(v-.5)**2*.65));
      const point=p.clone().addScaledVector(across,x*width*.5*round).addScaledVector(t,(v-.5)*length).addScaledVector(n,.0006*(1-x*x));
      ring.push(b.vertex(point.toArray(),u,v,[1.045,1.015,.98]));
    }
    if(j)for(let i=0;i<4;i++){
      if(new T.Vector3().crossVectors(across,t).dot(n)<0)b.quad(rings[j-1][i],ring[i],rings[j-1][i+1],ring[i+1]);
      else b.quad(rings[j-1][i],rings[j-1][i+1],ring[i],ring[i+1]);
    }rings.push(ring);
  }
}

/** Original adult hand in the existing hand-bone frame. Open fingers are
 * relaxed rather than splayed flat; the cupped pose leaves the existing grip
 * at y≈-.052,z=.018. All fingers/nails share one batchable skin surface. */
export function handGeometry({side=-1,open=false,quality='balanced',detail='near'}={}){
  side=side<0?-1:1;const overview=detail==='overview',fine=!overview&&quality!=='performance',b=builder(),thumb=-side;
  sweep(b,[
    [0,.013,-.006,.025,.022],[thumb*.002,-.007,-.008,.027,.022],
    [thumb*.003,-.028,open?-.001:-.013,.034,.022],
    [thumb*.002,-.049,open?.001:-.014,.035,.019],
    [0,-.066,open?.003:-.009,.030,.014]
  ],{radial:overview?8:fine?16:10,samples:overview?4:fine?14:9});
  const lengths=[.057,.065,.061,.047];
  for(let finger=0;finger<4;finger++){
    const x=(finger-1.5)*.016,spread=open?(finger-1.5)*.003:0,len=lengths[finger],width=finger===3?.0070:.0083;
    const rows=open?[
      [x,-.061,.003,width,.009],
      [x+spread*.4,-.061-len*.34,.005,width*1.03,.0082],
      [x+spread*.8,-.061-len*.65,.010,width*.86,.0071],
      [x+spread,-.061-len*.88,.016,width*.73,.006],
      [x+spread,-.061-len,.020,width*.42,.0038]
    ]:[
      [x,-.060,-.004,width,.009],
      [x*1.03,-.083,.013,width*1.03,.0082],
      [x*1.01,-.084,.038,width*.86,.0071],
      [x*.97,-.067,.048,width*.73,.006],
      [x*.92,-.052,.039,width*.42,.0038]
    ];
    sweep(b,rows,{radial:overview?5:fine?10:6,samples:overview?4:fine?15:9,crease:!overview});
    if(fine){
      const a=rows[3],z=a[2]+(open?.006:.004),center=[a[0],a[1],z];
      nail(b,center,width*1.25,len*.19,open?[0,0,1]:[0,-.45,.9],open?[0,-1,.1]:[0,.75,-.4]);
    }
  }
  // Thenar volume flows from the wrist toward the opposable thumb. The bent
  // thumb crosses the grip, rather than forming a fifth parallel sausage.
  const thumbRows=open?[
    [thumb*.022,-.021,-.002,.013,.014],[thumb*.039,-.033,.002,.012,.012],
    [thumb*.052,-.048,.013,.010,.010],[thumb*.056,-.062,.025,.007,.008],
    [thumb*.053,-.072,.032,.004,.004]
  ]:[
    [thumb*.021,-.017,-.004,.013,.014],[thumb*.039,-.032,.005,.012,.012],
    [thumb*.039,-.049,.029,.010,.010],[thumb*.026,-.054,.046,.007,.008],
    [thumb*.012,-.050,.049,.004,.004]
  ];
  sweep(b,thumbRows,{radial:overview?6:fine?12:8,samples:overview?4:fine?16:10,crease:!overview});
  if(fine){const p=thumbRows[3];nail(b,[p[0],p[1],p[2]+.008],.010,.013,[0,0,1],[thumb*.4,-.8,0]);}
  const geometry=b.finish('sculpted-adult-hand');geometry.userData.pose=open?'relaxed-open':'cupped-grip';geometry.userData.side=side;geometry.userData.detail=detail;return geometry;
}

function ribbon(b,points,width,tint){
  const rings=[];for(let i=0;i<points.length;i++){
    const p=new T.Vector3(...points[i]),before=new T.Vector3(...points[Math.max(0,i-1)]),after=new T.Vector3(...points[Math.min(points.length-1,i+1)]),across=new T.Vector3(0,.3,1).cross(after.sub(before)).normalize().multiplyScalar(width*.5);
    const pair=[b.vertex(p.clone().sub(across).toArray(),0,i,tint),b.vertex(p.clone().add(across).toArray(),1,i,tint)];
    if(i)b.quad(rings[i-1][0],pair[0],rings[i-1][1],pair[1]);rings.push(pair);
  }
}

/** Leather ankle boot with a distinct heel, fitted instep, broad toe box,
 * raised stitched vamp and a separate sole. Its lowest sole is exactly -.07,
 * preserving the existing footClearance and IK contact contract. */
export function bootGeometry({side=-1,quality='balanced',detail='near'}={}){
  side=side<0?-1:1;const overview=detail==='overview',fine=!overview&&quality!=='performance',upper=builder(),sole=builder();
  // Cross-sections run heel→toe. The upper is deliberately not a vertically
  // lathed bag: its highest volume is the instep, not the broad toe box.
  sweep(upper,[
    [0,-.015,-.078,.031,.032],[0,-.002,-.060,.051,.052],
    [0,.004,-.024,.054,.058],[side*.002,-.002,.025,.058,.052],
    [side*.003,-.015,.077,.063,.038],[side*.002,-.028,.128,.064,.027],
    [0,-.034,.173,.052,.021],[0,-.038,.195,.019,.014]
  ],{radial:overview?8:fine?18:12,samples:overview?7:fine?26:16});
  // Supple ankle shaft is broad at the heel, narrower at the lower calf.
  sweep(upper,[
    [0,-.002,-.015,.052,.059],[0,.038,-.012,.048,.055],
    [0,.091,-.009,.047,.051],[0,.135,-.006,.052,.055],
    [0,.147,-.006,.053,.056]
  ],{radial:overview?8:fine?18:12,samples:overview?4:fine?15:9,cap:false});
  // Toe/heel sole follows the anatomical last; all bottom vertices share the
  // exact grounding plane even though the upper has a pronounced arch.
  const outline=[[-.037,-.082],[-.056,-.064],[-.060,-.012],[-.063,.048],[-.067,.116],[-.060,.155],[-.040,.191],[0,.204],[.040,.191],[.060,.155],[.067,.116],[.063,.048],[.060,-.012],[.056,-.064],[.037,-.082]].filter((_,i)=>!overview||![1,13].includes(i));
  const rings=[];for(const y of [-.07,-.058])rings.push(outline.map(([x,z])=>sole.vertex([x,y,z],x/.13+.5,z/.29+.3)));
  for(let i=0;i<outline.length;i++){const next=(i+1)%outline.length;sole.quad(rings[0][i],rings[0][next],rings[1][i],rings[1][next]);}
  for(let j=0;j<2;j++){const center=sole.vertex([0,j?-.058:-.07,.055],.5,.5);for(let i=0;i<outline.length;i++){const next=(i+1)%outline.length;if(j)sole.index.push(rings[j][i],rings[j][next],center);else sole.index.push(rings[j][i],center,rings[j][next]);}}
  const seamTint=[.83,.79,.72],threadTint=[1.12,1.04,.91];
  for(const sign of overview?[]:[-1,1]){
    ribbon(upper,[[sign*.037,.105,.029],[sign*.034,.058,.041],[sign*.031,.025,.063],[sign*.025,.005,.100],[sign*.017,-.008,.135]],.003,seamTint);
    if(fine)for(let i=0;i<8;i++){const t=i/7;ribbon(upper,[[sign*(.036-.019*t),.102-.109*t,.032+.101*t],[sign*(.039-.019*t),.100-.109*t,.033+.101*t]],.0014,threadTint);}
  }
  // Four short cross-laces follow the front of the ankle, remaining inside
  // its silhouette; they merge with the upper instead of adding draw calls.
  for(let i=0;i<(overview?0:4);i++){
    const y=.028+i*.024,z=.045-i*.003;
    ribbon(upper,[[-.023,y,z],[0,y+.006,z+.002],[.023,y+.003,z]],.004,threadTint);
  }
  const u=upper.finish('fitted-leather-boot'),s=sole.finish('stitched-boot-sole');
  u.userData.side=side;u.userData.detail=detail;s.userData.contactPlane=-.07;s.userData.detail=detail;return {upper:u,sole:s};
}
