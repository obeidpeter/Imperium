import * as THREE from '../../vendor/three/three.module.js';
import {gridToWorld,terrainAt,hash,noise,smooth,roadSegments,isTrainingGround,RIVER_WATER_LEVEL,MARSH_WATER_LEVEL} from './environment-layout.js';
import {createRoadSurfaceSampler} from './environment-road-surface.js';
import {isChapterFivePilot} from './environment-ch5-pilot.js';
import {hasRegionalWorld} from './environment-regional-world.js';

// Authored terrain reads as landform, not as tile squares. Plateaus carry rock
// outcrops on their slopes; rivers fill a channel under one water surface whose
// shoreline is wherever the terrain rises above it; fords are shallow gravel
// bars; walls join along the cell edge facing the enemy side; paving is laid
// as irregular flagstones; marsh cells hold reed beds. Every legal standing
// centre stays clear, and nothing here changes movement or visibility.
const STONE_WALLS=new Set(['fortress','rome','accession','palmyra']),MUD_WALLS=new Set(['siege','desert']);
export function wallStyle(profile){return STONE_WALLS.has(profile.setting)?'stone':MUD_WALLS.has(profile.setting)?'mudbrick':'timber';}
// A run of wall cells shares one face: north-south runs face east (the usual
// enemy side), anything else faces north. Isolated cells follow the old edge.
export function wallFace(e,x,y){const wall=(a,b)=>terrainAt(e,a,b)==='wall'&&a>=0&&b>=0&&a<e.width&&b<e.height;const vertical=wall(x,y-1)||wall(x,y+1),horizontal=wall(x-1,y)||wall(x+1,y);return vertical&&!horizontal?'east':'north';}
// A clump of tapered reed blades (double-sided, so it never reads as solid cover).
export function createReedGeometry(blades=7){
  const vertices=[],indices=[];
  for(let k=0;k<blades;k++){const angle=k*2.399+hash(k,61)*.8,dx=Math.cos(angle),dz=Math.sin(angle),lean=.08+hash(k,63)*.16,h=.82+hash(k,67)*.36,start=vertices.length/3,base=.07*hash(k,71);
    for(const [t,width]of [[0,.016],[.35,.013],[.7,.008],[1,0]])for(const side of [-1,1])vertices.push(dx*(base+lean*t*t)-dz*width*side,h*t,dz*(base+lean*t*t)+dx*width*side);
    for(let j=0;j<3;j++){const n=start+j*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function addCampaignTerrain({root,e,p,m,profile,height,tileSize,instance,rockGeometry}){
  const cells=[];
  if(profile.civic){
    const floor=p.mesh(root,p.geo(new THREE.PlaneGeometry(e.width*tileSize+3,e.height*tileSize+3)),m.floor,0,.018,0);floor.rotation.x=-Math.PI/2;floor.name='continuous civic stone floor';floor.castShadow=false;
    floor.geometry.attributes.uv.array.forEach((_,i,a)=>a[i]*=5);
    for(const side of [-1,1]){p.plank(root,side*(e.width*tileSize/2+.4),.026,0,.12,.018,e.height*tileSize+1,m.inlay);p.plank(root,0,.026,side*(e.height*tileSize/2+.4),e.width*tileSize+1,.018,.12,m.inlay);}
    for(const radius of [2.7,2.85]){const ring=p.mesh(root,p.geo(new THREE.RingGeometry(radius,radius+.06,64)),m.inlay,0,.03,0);ring.rotation.x=-Math.PI/2;ring.castShadow=false;}
    root.userData.terrainFeatures=[{type:'chamber',cells:e.width*e.height}];return;
  }
  const half=tileSize/2,hx=e.width*tileSize/2,hz=e.height*tileSize/2,at=(x,y)=>x>=0&&y>=0&&x<e.width&&y<e.height?terrainAt(e,x,y):null;
  const pebble=p.geo(new THREE.IcosahedronGeometry(1,0)),rounded=p.geo(new THREE.IcosahedronGeometry(1,1)),reed=p.geo(createReedGeometry());
  const tint=(base,k,seed)=>new THREE.Color(base).multiplyScalar(.86+hash(k,seed,7)*.22);
  // Squared blocks of one material share a batch: wall courses, copings,
  // merlons, terrace faces and kerbs are one draw per stone (or mudbrick).
  const masonry=material=>material===m.brick?'squared mudbrick masonry':'squared stone masonry';
  if(profile.setting==='wetland'){
    const w=e.width*tileSize+12,d=e.height*tileSize+12,rows=96,g=p.geo(new THREE.PlaneGeometry(w,d,rows,rows));g.rotateX(-Math.PI/2);const pos=g.attributes.position,colors=[];
    const wet=(x,y)=>terrainAt(e,Math.max(0,Math.min(e.width-1,x)),Math.max(0,Math.min(e.height-1,y)))==='marsh'?1:0;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),gx=x/tileSize+(e.width-1)/2,gy=z/tileSize+(e.height-1)/2,ix=Math.floor(gx),iy=Math.floor(gy),u=smooth(gx-ix),v=smooth(gy-iy),weight=(wet(ix,iy)*(1-u)+wet(ix+1,iy)*u)*(1-v)+(wet(ix,iy+1)*(1-u)+wet(ix+1,iy+1)*u)*v;
      const contour=noise(x*.31,z*.31,37)*.48+noise(x*.94,z*.94,43)*.12,alpha=smooth((weight-.30-contour)*3.4);pos.setY(i,MARSH_WATER_LEVEL);colors.push(.91,.95,.88,alpha);
    }g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));const flood=p.mesh(root,g,m.marshWater);flood.name='continuous irregular marsh water';flood.castShadow=false;
  }

  // One water surface for every river and ford cell, extended where a river
  // leaves the board. Vertex alpha carries depth, so shallows show their bed.
  const wet=[];for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(['river','ford'].includes(at(x,y)))wet.push({x,y,type:at(x,y)});
  if(wet.length){
    const xs=wet.map(c=>gridToWorld(c,e,tileSize).x),zs=wet.map(c=>gridToWorld(c,e,tileSize).z),exits=wet.some(c=>c.type==='river'&&(c.y===0||c.y===e.height-1));
    const minX=Math.min(...xs)-tileSize,maxX=Math.max(...xs)+tileSize,minZ=exits?-hz-16:Math.min(...zs)-tileSize,maxZ=exits?hz+16:Math.max(...zs)+tileSize,step=.32;
    const nx=Math.max(2,Math.ceil((maxX-minX)/step)),nz=Math.max(2,Math.ceil((maxZ-minZ)/step)),geometry=p.geo(new THREE.PlaneGeometry(maxX-minX,maxZ-minZ,nx,nz));geometry.rotateX(-Math.PI/2);geometry.translate((minX+maxX)/2,0,(minZ+maxZ)/2);
    const pos=geometry.attributes.position,colors=[];
    for(let i=0;i<pos.count;i++){const depth=RIVER_WATER_LEVEL-height(pos.getX(i),pos.getZ(i));pos.setY(i,RIVER_WATER_LEVEL);colors.push(1,1,1,depth<=0?0:.36+.64*smooth(depth/.75));}
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
    const water=p.mesh(root,geometry,m.riverWater);water.name='authored river channel water';water.castShadow=false;water.receiveShadow=true;water.renderOrder=2;
  }
  for(const cell of wet){
    const {x,y}=cell,point=gridToWorld(cell,e,tileSize);cells.push({type:cell.type,x,y});
    if(cell.type!=='ford')continue;
    // Stepping stones break the surface; gravel shows through the shallows.
    for(let k=0;k<6;k++){const sx=point.x+(hash(k,x,y)-.5)*tileSize*.78,sz=point.z+(hash(x,k,y)-.5)*tileSize*.72;if(Math.hypot(sx-point.x,sz-point.z)<.45)continue;instance('ford stepping stones',rounded,m.stone,[sx,RIVER_WATER_LEVEL+.04,sz],[.34+hash(k,y)*.14,.12,.28+hash(y,k)*.12],[0,hash(k,y,x)*3,0],tint('#d8d2c3',k,x+y));}
    for(let k=0;k<34;k++){const sx=point.x+(hash(k,x,y,3)-.5)*tileSize*.96,sz=point.z+(hash(y,k,x,5)-.5)*tileSize*.96;instance('ford gravel bed',pebble,m.gravel,[sx,height(sx,sz)+.03,sz],[.07+hash(k,x)*.07,.04,.06+hash(x,k)*.06],[hash(k,1)*3,hash(k,2)*3,0],tint('#b1a68f',k,y));}
  }

  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++){
    const type=at(x,y),point=gridToWorld({x,y},e,tileSize),xx=point.x,zz=point.z;
    if(type==='marsh'){
      cells.push({type,x,y});
      // Reed beds hug the cell; the standing centre stays open water and mud.
      for(let k=0;k<11;k++){const angle=hash(k,x,y)*Math.PI*2,r=.62+hash(y,k,x)*.5,sx=xx+Math.cos(angle)*r,sz=zz+Math.sin(angle)*r,s=.9+hash(k,y)*.55;instance('marsh reed beds',reed,m.dryGrass,[sx,height(sx,sz)-.02,sz],[s,s*(1.15+hash(x,k)*.4),s],[0,hash(k,x,y,9)*6.28,0],tint('#8f8a62',k,x*y));}
    }
    if(type==='wall'){
      cells.push({type,x,y});
      const face=wallFace(e,x,y),style=wallStyle(profile),material=style==='stone'?m.stone:style==='mudbrick'?m.brick:m.wood,length=tileSize+.1,base=height(xx,zz);
      // Local frame: u runs along the wall, the face sits 0.36 of a cell from centre.
      const place=(u,offset,size,key,mat=material,color=null,geometry=p.masonryBlock)=>{const pos=face==='east'?[xx+tileSize*.36+offset[1],base+offset[0],zz+u]:[xx+u,base+offset[0],zz-tileSize*.36-offset[1]];const scale=face==='east'?[size[2],size[1],size[0]]:size;instance(key,geometry,mat,pos,scale,[0,0,0],color);};
      if(style==='timber'){
        for(let u=-length/2+.12;u<length/2;u+=.42)instance('timber breastwork posts',p.cylinder,m.wood,face==='east'?[xx+tileSize*.36+.12,base+.62,zz+u]:[xx+u,base+.62,zz-tileSize*.36-.12],[.075,1.24,.075],[0,hash(u,x,y)*.3,0],tint('#8a6a48',u*10,x+y));
        for(const row of [.28,.62,.96])place(0,[row,0],[length,.17,.07],'timber breastwork planks',m.darkWood,null,p.box);
      }else{
        const course=style==='stone'?.34:.28;
        for(let row=0;row<3;row++)for(let u=-length/2+(row%2?.3:0);u<length/2-.05;u+=.6){const w=Math.min(.58,length/2-u);if(w<.12)continue;place(u+w/2,[course*(row+.5),0],[w-.03,course-.02,.58],masonry(material),material,tint(style==='stone'?'#cfc6b3':'#b88d68',u*7+row,x*3+y));}
        place(0,[course*3+.05,0],[length,.1,.66],masonry(material),material);
        for(let u=-length/2+.2;u<length/2;u+=.62)place(u,[course*3+.28,.13],[.34,.36,.36],masonry(material),material,tint(style==='stone'?'#d6cdb9':'#c09470',u*5,y));
      }
    }
    if(type==='stone'){
      cells.push({type,x,y});
      // Flagstones in courses of irregular length; a few lift or go missing at the edges.
      // The approved pilot's broader paving now carries through each region
      // and reads from the normal follow camera without
      // dense subpixel grout. It uses fewer instances in the same draw batch;
      // reduced yaw keeps the narrower joints physically separated.
      const pilot=isChapterFivePilot(e)||hasRegionalWorld(e),courses=pilot?3:4,joint=pilot?.025:.045;
      for(let row=0;row<courses;row++){let u=-half+.02;const depth=tileSize/courses;
        while(u<half-.12){const w=Math.min(half-u,(pilot?.75:.42)+hash(row,u*3,x+y)*.5),missing=(row===0||row===courses-1)&&hash(u*5,row,x*y)>.95;
          if(!missing)instance('authored flagstones',p.box,m.marble,[xx+u+w/2,height(xx+u+w/2,zz-half+(row+.5)*depth)+.012+hash(u,row,y)*.012,zz-half+(row+.5)*depth],[w-joint,.034,depth-joint],[0,(hash(row,u,x)-.5)*(pilot?.012:.03),0],tint('#e4dccb',u*11+row,x*5+y));
          u+=w;}
      }
    }
  }

  // Rocky outcrops break each exposed plateau bank above open ground. Beside
  // a road, paving or water the bank is faced as a masonry terrace instead.
  // Neither reaches within 0.6 m of a neighbour's standing centre.
  const high=(x,y)=>['high','hill'].includes(at(x,y)),open=(x,y)=>[null,'grass','rock','rubble','marsh'].includes(at(x,y));
  const terraceMaterial=wallStyle(profile)==='mudbrick'?m.brick:m.stone;
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++){
    if(!high(x,y))continue;const c=gridToWorld({x,y},e,tileSize);cells.push({type:'high',x,y});
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){if(high(x+dx,y+dy))continue;
      if(!open(x+dx,y+dy)){
        if(at(x+dx,y+dy)==='wall')continue;
        // Courses of squared stone from the plateau rim (0.85 m) to just past the cell edge.
        // The foot follows the lower ground beside it (a river cut, a sunken road).
        const top=height(c.x,c.z),depth=.5,mid=tileSize*.34+depth/2,foot=Math.min(0,height(c.x+dx*(mid+depth/2+.05),c.z+dy*(mid+depth/2+.05))),course=(top-foot)/4;
        for(let row=0;row<4;row++){const offset=row%2?.3:0;
          for(let u=-half+offset;u<half-.05;u+=.62){const w=Math.min(.6,half-u);if(w<.15)continue;const along=u+w/2,px=c.x+dx*mid+(dy?along:0),pz=c.z+dy*mid+(dx?along:0);
            instance(masonry(terraceMaterial),p.masonryBlock,terraceMaterial,[px,foot+course*(row+.5),pz],dx?[depth,course-.02,w-.03]:[w-.03,course-.02,depth],[0,0,0],tint('#cbc2ad',along*7+row,x+y*3));}}
        continue;
      }
      for(let k=0;k<4;k++){const along=(k-1.5)*.62+(hash(k,x,y)-.5)*.2,out=half-.05+hash(y,k)*.1,rx=c.x+dx*out+(dy?along:0),rz=c.z+dy*out+(dx?along:0),s=.32+hash(k,dx,dy+x)*.18;
        instance('limestone',rockGeometry??rounded,m.stone,[rx,height(rx,rz)+s*.15,rz],[s*1.2,s*1.15,s*.8],[hash(k,1)*.4,Math.atan2(dx,dy)+hash(k,2)*.6,hash(k,3)*.3],tint('#bdb5a3',k+x,y+dx));}}
  }

  // Kerb stones edge the board's roads (training yards keep their beaten track).
  const roads=isTrainingGround(e)?[]:roadSegments(e,tileSize),roadDistance=createRoadSurfaceSampler(roads,tileSize).distance;
  for(const [a,b]of roads){
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(!length)continue;const ux=dx/length,uz=dz/length;
    for(let s=0;s<=length;s+=.46){const cx=a.x+ux*s,cz=a.z+uz*s;if(Math.abs(cx)>hx+.2||Math.abs(cz)>hz+.2)continue;
      for(const side of [-1,1]){const kx=cx-uz*side*1.08,kz=cz+ux*side*1.08;
        // At a junction or bend this point lies inside another road's tread: no kerb there.
        if(roadDistance(kx,kz)<1.0)continue;
        instance(masonry(m.stone),p.masonryBlock,m.stone,[kx,height(kx,kz)+.05,kz],[ux?.42:.16,.12,ux?.16:.42],[0,(hash(s,side)-.5)*.06,0],tint('#cfc7b5',s*9,side+3));}
    }
  }
  root.userData.terrainFeatures=cells;
}
