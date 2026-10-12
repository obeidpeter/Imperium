import * as THREE from '../../vendor/three/three.module.js';
import {gridToWorld,terrainAt,hash,noise,smooth} from './environment-layout.js';

// Low surfaces occupy authored terrain only. Solid wall cover sits against a
// cell edge, leaving its legal centre clear; deep rivers remain visibly water.
export function addCampaignTerrain({root,e,p,m,profile,height,tileSize,instance}){
  const cells=[];
  if(profile.civic){
    const floor=p.mesh(root,p.geo(new THREE.PlaneGeometry(e.width*tileSize+3,e.height*tileSize+3)),m.floor,0,.018,0);floor.rotation.x=-Math.PI/2;floor.name='continuous civic stone floor';floor.castShadow=false;
    floor.geometry.attributes.uv.array.forEach((_,i,a)=>a[i]*=5);
    for(const side of [-1,1]){p.plank(root,side*(e.width*tileSize/2+.4),.026,0,.12,.018,e.height*tileSize+1,m.inlay);p.plank(root,0,.026,side*(e.height*tileSize/2+.4),e.width*tileSize+1,.018,.12,m.inlay);}
    for(const radius of [2.7,2.85]){const ring=p.mesh(root,p.geo(new THREE.RingGeometry(radius,radius+.06,64)),m.inlay,0,.03,0);ring.rotation.x=-Math.PI/2;ring.castShadow=false;}
    root.userData.terrainFeatures=[{type:'chamber',cells:e.width*e.height}];return;
  }
  const riverGeo=p.geo(new THREE.PlaneGeometry(tileSize,tileSize));riverGeo.rotateX(-Math.PI/2);
  if(profile.setting==='wetland'){
    const w=e.width*tileSize+12,d=e.height*tileSize+12,rows=96,g=p.geo(new THREE.PlaneGeometry(w,d,rows,rows));g.rotateX(-Math.PI/2);const pos=g.attributes.position,colors=[];
    const wet=(x,y)=>terrainAt(e,Math.max(0,Math.min(e.width-1,x)),Math.max(0,Math.min(e.height-1,y)))==='marsh'?1:0;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),gx=x/tileSize+(e.width-1)/2,gy=z/tileSize+(e.height-1)/2,ix=Math.floor(gx),iy=Math.floor(gy),u=smooth(gx-ix),v=smooth(gy-iy),weight=(wet(ix,iy)*(1-u)+wet(ix+1,iy)*u)*(1-v)+(wet(ix,iy+1)*(1-u)+wet(ix+1,iy+1)*u)*v;
      const contour=noise(x*.31,z*.31,37)*.48+noise(x*.94,z*.94,43)*.12,alpha=smooth((weight-.30-contour)*3.4);pos.setY(i,-.027);colors.push(.91,.95,.88,alpha);
    }g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));const flood=p.mesh(root,g,m.marshWater);flood.name='continuous irregular marsh water';flood.castShadow=false;
  }
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++){
    const type=terrainAt(e,x,y),point=gridToWorld({x,y},e,tileSize),xx=point.x,zz=point.z;
    if(type==='river'){instance('authored deep river',riverGeo,m.water,[xx,-.06,zz],[1,1,1]);cells.push({type,x,y});}
    if(type==='marsh')cells.push({type,x,y});
    if(type==='ford'){
      instance('shallow ford',riverGeo,m.water,[xx,-.028,zz],[1,1,1]);for(let k=0;k<5;k++)instance('ford stepping stones',p.masonryBlock,m.stone,[xx+(hash(k,x,y)-.5)*tileSize*.84,.015,zz+(hash(x,k,y)-.5)*tileSize*.76],[.33,.07,.26],[0,hash(k,y)*.4,0]);cells.push({type,x,y});
    }
    if(type==='wall'){
      for(let row=0;row<3;row++)for(let k=0;k<4;k++)instance('authored low wall cover',p.masonryBlock,profile.setting==='siege'?m.brick:m.stone,[xx+(k-1.5)*tileSize*.22+(row%2?tileSize*.055:0),height(xx,zz)+.12+row*.19,zz-tileSize*.37],[tileSize*.21,.18,tileSize*.20],[0,0,0]);cells.push({type,x,y});
    }
    if(type==='stone'){
      for(let k=0;k<4;k++)instance('authored stone paving',p.box,m.marble,[xx+(k%2-.5)*tileSize*.5,.014,zz+(Math.floor(k/2)-.5)*tileSize*.5],[tileSize*.48,.028,tileSize*.48]);cells.push({type,x,y});
    }
  }
  const extension=p.geo(new THREE.PlaneGeometry(tileSize,28));extension.rotateX(-Math.PI/2);
  for(const y of [0,e.height-1])for(let x=0;x<e.width;x++)if(terrainAt(e,x,y)==='river'){
    const point=gridToWorld({x,y},e,tileSize),side=y===0?-1:1;instance('river beyond authored boundary',extension,m.water,[point.x,-.06,side*(e.height*tileSize/2+14)],[1,1,1]);
  }
  root.userData.terrainFeatures=cells;
}
