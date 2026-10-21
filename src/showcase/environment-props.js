import * as THREE from '../../vendor/three/three.module.js';
import {hash} from './environment-layout.js';
import {createMasonryBlockGeometry} from './environment-primitives.js';

// Geometry factories share materials with the owning environment. No timers,
// assets or scene-global lighting are created here.
export function createPropFactory(materials,geometries,{quality='balanced'}={}){
  const m=materials;
  const geo=g=>{geometries.add(g);return g;};
  const box=geo(new THREE.BoxGeometry(1,1,1)),cylinder=geo(new THREE.CylinderGeometry(1,1,1,12)),sphere=geo(new THREE.SphereGeometry(1,16,10));
  const masonryBlock=quality==='performance'?box:geo(createMasonryBlockGeometry()),masonryMaterials=new Set([m.stone,m.marble,m.brick,m.darkStone,m.plaster,m.redMarble,m.ivory]);
  function mesh(parent,g,material,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new THREE.Mesh(g,material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function beam(parent,a,b,r,material=m.wood){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),o=mesh(parent,cylinder,material,...va.clone().add(vb).multiplyScalar(.5).toArray(),r,va.distanceTo(vb),r);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());return o;}
  function plank(parent,x,y,z,w,h,d,material=m.wood){return mesh(parent,masonryMaterials.has(material)?masonryBlock:box,material,x,y,z,w,h,d);}
  function group(parent,x,y,z,angle=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=angle;parent.add(g);return g;}
  function crate(parent,x,y,z,scale=1){const g=group(parent,x,y,z);g.scale.setScalar(scale);
    for(let side=-1;side<=1;side+=2)for(let i=0;i<5;i++){plank(g,side*.5,.48,(i-2)*.205,.07,.92,.19);plank(g,(i-2)*.205,.48,side*.5,.19,.92,.07);}
    for(let i=0;i<5;i++)plank(g,(i-2)*.205,.99,0,.19,.07,1.04);
    for(const yy of [.15,.78]){plank(g,0,yy,.545,1.1,.08,.025,m.iron);plank(g,0,yy,-.545,1.1,.08,.025,m.iron);}
    return g;
  }
  const profile=[[.05,0],[.16,.07],[.26,.22],[.34,.48],[.31,.71],[.19,.9],[.105,.97],[.105,1.10],[.15,1.12],[.15,1.17],[.09,1.17]].map(v=>new THREE.Vector2(...v));
  const amphoraGeometry=geo(new THREE.LatheGeometry(profile,24));
  function amphora(parent,x,y,z,scale=1){const g=group(parent,x,y,z,hash(x,z)*6.28);g.scale.setScalar(scale);mesh(g,amphoraGeometry,m.terra);
    for(const side of [-1,1]){const path=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.105,.98,0),new THREE.Vector3(side*.27,1.02,0),new THREE.Vector3(side*.35,.81,0),new THREE.Vector3(side*.25,.64,0)]);mesh(g,geo(new THREE.TubeGeometry(path,12,.028,6,false)),m.terra);}
    const rim=mesh(g,geo(new THREE.CylinderGeometry(.09,.09,.012,20)),m.darkWood,0,1.166,0);rim.castShadow=false;return g;
  }
  function tent(parent,x,y,z,scale=1,angle=0){const g=group(parent,x,y,z,angle);g.scale.setScalar(scale);const positions=[],uvs=[],indices=[],length=4.7;
    // Raised ridge and gently sagging tensioned cloth panels; both sides have
    // actual thickness-free 3D surfaces with lit folds, not billboards.
    for(let row=0;row<=14;row++)for(let col=0;col<=12;col++){
      const u=col/12,v=row/14,xx=(u-.5)*4.2,zz=(v-.5)*length;
      const yy=.28+2.95*(1-Math.abs(u*2-1))-.16*Math.sin(v*Math.PI)*Math.sin(Math.abs(u-.5)*Math.PI*2)+.025*Math.sin(v*25+u*7);
      positions.push(xx,yy,zz);uvs.push(u*3,v*4);
      if(row<14&&col<12){const a=row*13+col;indices.push(a,a+13,a+1,a+1,a+13,a+14);}
    }
    const roof=geo(new THREE.BufferGeometry());roof.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));roof.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));roof.setIndex(indices);roof.computeVertexNormals();mesh(g,roof,m.cloth);
    // Stitched panel seams follow the sagging cloth; poles and guys stay rigid.
    for(const u of [.17,.33,.67,.83]){const points=[];for(let k=0;k<=10;k++){const v=k/10;points.push(new THREE.Vector3((u-.5)*4.2,.29+2.95*(1-Math.abs(u*2-1))-.16*Math.sin(v*Math.PI)*Math.sin(Math.abs(u-.5)*Math.PI*2),(v-.5)*length));}mesh(g,geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),10,.006,3,false)),m.rope);}
    for(const zz of [-length/2,length/2]){
      beam(g,[0,0,zz],[0,3.37,zz],.065);beam(g,[-2.13,.22,zz],[0,3.28,zz],.025,m.rope);beam(g,[0,3.28,zz],[2.13,.22,zz],.025,m.rope);
      for(const side of [-1,1]){const panel=geo(new THREE.BufferGeometry());panel.setAttribute('position',new THREE.Float32BufferAttribute([side*.18,2.95,zz,side*.4,.15,zz,side*2.04,.25,zz],3));panel.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,0,0,1,0],2));panel.computeVertexNormals();mesh(g,panel,m.cloth);}
    }
    beam(g,[0,3.23,-2.6],[0,3.23,2.6],.055);
    for(const zz of [-2.2,0,2.2])for(const side of [-1,1]){beam(g,[side*2,.45,zz],[side*3.1,.05,zz],.018,m.rope);beam(g,[side*3.1,-.03,zz],[side*3.15,.22,zz],.035);}
    return g;
  }
  function wagon(parent,x,y,z,angle=.2){const g=group(parent,x,y,z,angle);
    for(let i=0;i<6;i++)plank(g,(i-2.5)*.3,.85,0,.27,.15,2.8,m.darkWood);
    for(const side of [-1,1]){beam(g,[side*.95,.52,-1.1],[side*.95,.52,1.1],.10,m.charcoal);for(let i=0;i<4;i++)plank(g,side*.98,1.1+i*.18,0,.11,.15,2.85,m.darkWood);}
    const wheelGeo=geo(new THREE.TorusGeometry(.67,.065,8,28));
    for(const xx of [-1.1,1.1])for(const zz of [-.9,.9]){const wheel=group(g,xx,.65,zz,0);wheel.rotation.y=Math.PI/2;mesh(wheel,wheelGeo,m.darkWood);for(let i=0;i<10;i++){const a=i*Math.PI/5;beam(wheel,[0,0,0],[Math.sin(a)*.62,Math.cos(a)*.62,0],.025,m.wood);}mesh(wheel,cylinder,m.iron,0,0,0,.10,.17,.10).rotation.x=Math.PI/2;}
    for(const side of [-1,1])beam(g,[side*.65,.78,-1.3],[side*.65,.58,-3.9],.065,m.darkWood);
    crate(g,.16,.97,.26,.65);amphora(g,-.4,.98,-.45,.6);return g;
  }
  function banner(parent,x,y,z){const g=group(parent,x,y,z);beam(g,[0,0,0],[0,5.1,0],.045);beam(g,[-.7,4.7,0],[.7,4.7,0],.035);mesh(g,sphere,m.terra,0,5.2,0,.11,.16,.11);
    const cloth=geo(new THREE.PlaneGeometry(1.3,1.8,8,12));const attr=cloth.attributes.position;
    for(let i=0;i<attr.count;i++){const yy=attr.getY(i);attr.setZ(i,.07*Math.sin(attr.getX(i)*4+yy*2)*(.9-yy));}cloth.computeVertexNormals();const fabric=mesh(g,cloth,m.red,0,3.79,0);fabric.name='hanging standard';fabric.userData.windCloth=true;return g;
  }
  function watchRoof(parent,x,y,z){const g=group(parent,x,y,z);g.name='watchtower canopy';
    for(const xx of [-1.12,1.12])for(const zz of [-1.02,1.02])beam(g,[xx,-1.4,zz],[xx,.04,zz],.075);
    for(const side of [-1,1])for(let row=0;row<5;row++)for(let j=0;j<6;j++){const a=(row+.5)/5,xx=side*a*1.5,yy=.7-a*.8,zz=(j-2.5)*.48;const board=plank(g,xx,yy,zz,.34,.055,.50,m.wood);board.rotation.z=-side*Math.atan(.8/1.5);}
    beam(g,[0,.73,-1.55],[0,.73,1.55],.07);for(const zz of [-1.33,1.33]){beam(g,[-1.45,-.09,zz],[0,.7,zz],.045);beam(g,[0,.7,zz],[1.45,-.09,zz],.045);}
    return g;
  }
  function practiceRack(parent,x,y,z,angle=0){const g=group(parent,x,y,z,angle);g.name='drill equipment rack';
    for(const side of [-1,1]){beam(g,[side*1.22,0,-.30],[side*1.22,1.72,.05],.06);beam(g,[side*1.22,0,.44],[side*1.22,1.72,.05],.06);}beam(g,[-1.35,1.45,0],[1.35,1.45,0],.07);
    for(let k=0;k<6;k++){const xx=(k-2.5)*.36;beam(g,[xx,.05,.35],[xx,2.20,-.03],.018,m.wood);beam(g,[xx,1.90,.015],[xx,2.26,-.045],.028,m.wood);}
    for(const side of [-1,1]){const shield=mesh(g,geo(new THREE.SphereGeometry(1,16,10)),m.wood,side*.70,.60,.30,.33,.51,.045);shield.rotation.x=-.15;mesh(g,sphere,m.iron,side*.70,.60,.36,.08,.08,.025);}
    return g;
  }
  function practicePost(parent,x,y,z,angle=0){const g=group(parent,x,y,z,angle);g.name='practice post outside yard';
    beam(g,[0,-.06,0],[0,2.06,0],.105);beam(g,[-.65,1.3,0],[.65,1.3,0],.07);
    mesh(g,cylinder,m.rope,0,1.36,0,.26,.88,.20);mesh(g,sphere,m.rope,0,1.99,0,.17,.19,.16);
    for(let k=0;k<5;k++){const rope=geo(new THREE.TorusGeometry(.265,.012,4,16));const loop=mesh(g,rope,m.darkWood,0,1.04+k*.15,0);loop.rotation.x=Math.PI/2;loop.scale.y=.77;}
    return g;
  }
  return {mesh,beam,plank,group,crate,amphora,tent,wagon,banner,watchRoof,practiceRack,practicePost,box,masonryBlock,cylinder,sphere,geo};
}
