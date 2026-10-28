import * as T from '../../vendor/three/three.module.js';
import {hash,noise,terrainAt,worldToGrid,isPlayable,smooth} from './environment-layout.js';
import {createReedGeometry} from './environment-campaign-terrain.js';

// Ground cover round the view (worlds and gameplay plan, release 5): grass tufts, flowers,
// scrub, reeds by the water and rows of grain, laid in 4 m chunks round the point the
// camera looks at and redrawn as it moves. Each kind is one instanced draw in a material
// the world already draws its meadow with, so no shader program is added, and the meadow's
// wind sways it. On the board it stays short and sparse, so the cells read as before.
// Deterministic presentation: a chunk's plants come from its own coordinates, never from
// a random stream, and nothing here changes the encounter.
export const GROUND_COVER=Object.freeze({balanced:Object.freeze({radius:26,perChunk:24}),high:Object.freeze({radius:34,perChunk:38})});
export const GROUND_COVER_CHUNK=4;
const MOVE=3,CHUNK=GROUND_COVER_CHUNK,BUDGET=12;
// Board cells a plant may stand on; everything else (roads, stone, water, walls) stays bare.
const PLANTED=new Set(['grass','high','hill','camp']);
const WATER=new Set(['river','ford','marsh']);
// Chapters whose countryside is farmed: Moesia's and Thrace's valleys, Italy.
const FARMED=new Set([3,4,7,10,11,12]);
// Flower heads over the dry-grass material's beige: white, yellow, purple and blue.
const PETALS=[[1.34,1.38,1.66],[1.42,1.3,.42],[1.02,.66,1.62],[.82,.96,1.78]];

function tuftGeometry(){
  // Three crossed, tapered blades; normals lean up as the meadow's do, so a tuft reads as a mass.
  const positions=[],indices=[];
  for(let k=0;k<3;k++){const angle=k*2.094+.4,dx=Math.cos(angle),dz=Math.sin(angle),h=.7+hash(k,141)*.3,bend=.14+hash(k,144)*.16,start=positions.length/3;
    for(const [t,width]of [[0,.04],[.45,.028],[.8,.014],[1,0]])for(const side of [-1,1])positions.push(dx*bend*t*t-dz*width*side,h*t,dz*bend*t*t+dx*width*side);
    for(let j=0;j<3;j++){const n=start+j*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  return upright(positions,indices);
}
function flowerGeometry(){
  // A small crossed head 7 cm across, 0.24–0.31 m up; the tuft planted with it is its stem.
  const positions=[],indices=[];
  for(const a of [0,Math.PI/2]){const dx=Math.cos(a)*.035,dz=Math.sin(a)*.035,start=positions.length/3;
    positions.push(-dx,.24,-dz,dx,.24,dz,dx,.31,dz,-dx,.31,-dz);indices.push(start,start+1,start+2,start,start+2,start+3);}
  positions.push(-.035,.275,-.035,.035,.275,-.035,.035,.275,.035,-.035,.275,.035);indices.push(8,10,9,8,11,10);
  return upright(positions,indices,1);
}
function stalkGeometry(){
  // A stalk of grain: a thin blade with a broader ear at its top.
  const positions=[],indices=[];
  for(let k=0;k<2;k++){const a=k*Math.PI/2,dx=Math.cos(a),dz=Math.sin(a),start=positions.length/3;
    for(const [t,width]of [[0,.012],[.62,.01],[.7,.026],[.95,.022],[1,0]])for(const side of [-1,1])positions.push(-dz*width*side+dx*.04*t*t,.95*t,dx*width*side+dz*.04*t*t);
    for(let j=0;j<4;j++){const n=start+j*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  return upright(positions,indices);
}
function upright(positions,indices,lift=.85){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  const n=g.attributes.normal;for(let i=0;i<n.count;i++){const v=new T.Vector3(n.getX(i)*.5,Math.abs(n.getY(i))+lift,n.getZ(i)*.5).normalize();n.setXYZ(i,v.x,v.y,v.z);}
  g.computeBoundingSphere();return g;
}

/**
 * The cover's meshes in `group`, or null where none grows (Performance, indoors).
 * - e, tileSize, profile, quality: the world's snapshot and settings;
 * - height(x,z), roadDistance(x,z), route(x,z), architecture(x,z): the world's own samplers;
 * - occupied: boxes of inhabited set pieces; riverZ: the distant river's centre, or null;
 * - fortX: the frontier fort's stockade line, or null; m: the world's materials; scrub: the meadow spray's geometry.
 */
export function createGroundCover(group,{e,tileSize=2.5,profile,quality='balanced',height,roadDistance=()=>Infinity,route=()=>0,architecture=null,occupied=[],riverZ=null,fortX=null,m,scrub}){
  const tier=GROUND_COVER[quality];if(!tier||profile.civic||profile.vegetation==='court')return null;
  const arid=profile.vegetation==='arid',wetland=profile.vegetation==='reeds',farmed=FARMED.has(profile.chapter)&&!arid;
  const water=new Set();for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(WATER.has(terrainAt(e,x,y)))water.add(`${x},${y}`);
  const half=tileSize/2;
  // Within 1.3 m of a board water cell, outside it: the water's edge.
  function waterEdge(x,z){
    if(!water.size)return false;const c=worldToGrid(x,z,e,tileSize);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!water.has(`${c.x+dx},${c.y+dy}`))continue;
      const cx=(c.x+dx-(e.width-1)/2)*tileSize,cz=(c.y+dy-(e.height-1)/2)*tileSize;
      if(Math.max(Math.abs(x-cx),Math.abs(z-cz))<half+1.3)return true;}
    return false;
  }
  const kinds={
    grass:{name:'meadow grass (near view)',geometry:tuftGeometry(),material:m.grass,share:1},
    dry:{name:'dry meadow grass (near view)',geometry:null,material:m.dryGrass,share:arid?.9:.45},
    flower:{name:'meadow grass flowers (near view)',geometry:flowerGeometry(),material:m.dryGrass,share:.2},
    reed:{name:'meadow grass reeds (near view)',geometry:createReedGeometry(5),material:m.grass,share:wetland||water.size||riverZ!==null?.6:.05},
    crop:{name:'meadow grass crop rows (near view)',geometry:stalkGeometry(),material:m.dryGrass,share:farmed?.8:.02},
    scrub:{name:'meadow grass scrub (near view)',geometry:scrub,material:m.foliage,share:.06}
  };
  kinds.dry.geometry=kinds.grass.geometry;
  const span=Math.ceil(tier.radius/CHUNK)*2+2,capacity=Math.ceil(span*span*.8*tier.perChunk);
  const owned=new Set([kinds.grass.geometry,kinds.flower.geometry,kinds.reed.geometry,kinds.crop.geometry]);
  for(const [key,kind]of Object.entries(kinds)){
    kind.capacity=Math.max(16,Math.ceil(capacity*kind.share));
    const mesh=new T.InstancedMesh(kind.geometry,kind.material,kind.capacity);mesh.name=kind.name;mesh.count=0;
    mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(kind.capacity*3).fill(1),3);
    mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.raycast=()=>{};
    mesh.userData.environmentDynamic=true;mesh.userData.groundCover=key;kind.mesh=mesh;group.add(mesh);
  }
  const dummy=new T.Object3D(),colour=new T.Color();
  // One plant: its matrix and colour, kept in its chunk.
  function plant(items,key,x,z,s,yaw,r,g,b,width=1){
    dummy.position.set(x,height(x,z)-.01,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(s*width,s,s);dummy.updateMatrix();
    (items[key]??=[]).push({x,z,matrix:dummy.matrix.clone(),color:colour.setRGB(r,g,b).clone()});
  }
  function chunk(cx,cz){
    const items={};
    for(let i=0;i<tier.perChunk;i++){
      const x=(cx+hash(cx*31+i,cz*17-i,5))*CHUNK,z=(cz+hash(cz*29-i,cx*13+i,7))*CHUNK,h=hash(x,z,11),k=hash(z,x,13),yaw=hash(x,z,17)*6.283;
      const tint=[.71+hash(i,x,2)*.25,.77+hash(z,i,5)*.2,.59+hash(x,i,1)*.24];
      if(isPlayable(x,z,e,tileSize)){
        const c=worldToGrid(x,z,e,tileSize),type=terrainAt(e,c.x,c.y);
        // The board: short, sparse tufts on its open ground, a rare flower; water's edge reeds.
        if(waterEdge(x,z)&&!WATER.has(type)&&PLANTED.has(type)){if(h<.4)plant(items,'reed',x,z,.55+k*.35,yaw,.78+k*.12,.9,.68);continue;}
        if(!(PLANTED.has(type)||type==='sand'&&arid)||h>(arid?.12:.3))continue;
        if(!arid&&k<.06){plant(items,'flower',x,z,.6+h,yaw,...PETALS[Math.floor(hash(x,z,19)*PETALS.length)]);continue;}
        plant(items,k<(arid?.8:.2)?'dry':'grass',x,z,.1+h*.33,yaw,...tint,.7+k*.6);continue;
      }
      if(roadDistance(x,z)<tileSize*.45||route(x,z)>.12)continue;
      if(architecture&&architecture(x,z).footing>.12)continue;
      if(occupied.some(b=>x>b.min[0]&&x<b.max[0]&&z>b.min[2]&&z<b.max[2]))continue;
      if(fortX!==null&&Math.abs(x-fortX)<1.2)continue;
      const fromRiver=riverZ===null?Infinity:Math.abs(z-riverZ);if(fromRiver<7)continue;
      // Reeds line the water: the distant river's banks and the board's own water.
      if(fromRiver<9.5||waterEdge(x,z)||wetland&&noise(x*.21,z*.21,93)>.66){if(h<.7)plant(items,'reed',x,z,.7+k*.6,yaw,.74+k*.16,.86+h*.1,.6);continue;}
      // Farmed patches beyond the board: grain in rows, a stalk to each 0.4 m along a row.
      const out=Math.max(Math.abs(x)-e.width*tileSize/2,Math.abs(z)-e.height*tileSize/2);
      if(farmed&&out>6&&noise(x*.045,z*.045,91)>.7){
        const row=Math.round(z/.55)*.55;for(let j=0;j<3;j++){const px=x+(j-1)*.4+(hash(x,j,23)-.5)*.08;plant(items,'crop',px,row+(hash(j,z,29)-.5)*.08,.85+hash(px,row,31)*.3,hash(px,row,37)*6.28,1.04,.93+hash(j,x,41)*.06,.62);}
        continue;
      }
      if(arid&&h>.42)continue;
      if(k<(arid?.015:.05)){plant(items,'scrub',x,z,.42+h*.32,yaw,arid?.86:.74,arid?.8:.86,arid?.6:.62);continue;}
      if(k<(arid?.03:.16)){plant(items,'flower',x,z,.8+h*.5,yaw,...PETALS[Math.floor(hash(x,z,19)*PETALS.length)]);plant(items,'grass',x,z,.2+h*.2,yaw+1,...tint);continue;}
      plant(items,k<(arid?.85:.3)?'dry':'grass',x,z,.18+h*.42,yaw,...tint,.7+k*.6);
    }
    return items;
  }
  // A frame grows at most BUDGET new chunks; any still missing grow in the frames after.
  const chunks=new Map();let last=null,generated=0,pending=false;
  function layout(focus,budget=BUDGET){
    const r=tier.radius,cx0=Math.floor((focus.x-r)/CHUNK),cx1=Math.floor((focus.x+r)/CHUNK),cz0=Math.floor((focus.z-r)/CHUNK),cz1=Math.floor((focus.z+r)/CHUNK);
    for(const kind of Object.values(kinds))kind.mesh.count=0;
    pending=false;
    for(let cz=cz0;cz<=cz1;cz++)for(let cx=cx0;cx<=cx1;cx++){
      if(Math.hypot(Math.max(0,Math.abs((cx+.5)*CHUNK-focus.x)-CHUNK/2),Math.max(0,Math.abs((cz+.5)*CHUNK-focus.z)-CHUNK/2))>r)continue;
      const key=`${cx},${cz}`;let items=chunks.get(key);
      if(!items){if(budget<=0){pending=true;continue;}budget--;items=chunk(cx,cz);chunks.set(key,items);generated++;}
      for(const [name,list]of Object.entries(items)){const mesh=kinds[name].mesh;
        for(const item of list){
          const d=Math.hypot(item.x-focus.x,item.z-focus.z);if(d>r||mesh.count>=kinds[name].capacity)continue;
          // Plants shrink away over the last 6 m, so the cover has no hard edge.
          const fade=smooth((r-d)/6),me=dummy.matrix.copy(item.matrix).elements;for(const i of [0,1,2,4,5,6,8,9,10])me[i]*=fade;
          mesh.setMatrixAt(mesh.count,dummy.matrix);mesh.setColorAt(mesh.count,item.color);mesh.count++;
        }}
    }
    for(const kind of Object.values(kinds)){kind.mesh.instanceMatrix.needsUpdate=true;kind.mesh.instanceColor.needsUpdate=true;kind.mesh.visible=kind.mesh.count>0;}
    // Chunks well out of reach are forgotten; they come back the same.
    for(const [key,items]of chunks){const [cx,cz]=key.split(',').map(Number);if(Math.hypot((cx+.5)*CHUNK-focus.x,(cz+.5)*CHUNK-focus.z)>r*2)chunks.delete(key);}
  }
  layout({x:0,z:0},Infinity);last={x:0,z:0};
  return {
    radius:tier.radius,
    // Redraw round the view's focus when it has moved a few metres (the world's update).
    update(focus){if(!focus||!Number.isFinite(focus.x)||!Number.isFinite(focus.z)||!pending&&Math.hypot(focus.x-last.x,focus.z-last.z)<MOVE)return false;last={x:focus.x,z:focus.z};layout(focus);return true;},
    stats(){const counts=Object.fromEntries(Object.entries(kinds).map(([key,kind])=>[key,kind.mesh.count]));return {...counts,total:Object.values(counts).reduce((a,b)=>a+b,0),chunks:chunks.size,generated,pending,radius:tier.radius};},
    meshes:()=>Object.values(kinds).map(kind=>kind.mesh),
    dispose(){for(const kind of Object.values(kinds)){kind.mesh.removeFromParent();kind.mesh.dispose();}for(const g of owned)g.dispose();chunks.clear();}
  };
}
