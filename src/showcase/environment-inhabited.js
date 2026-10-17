import * as T from '../../vendor/three/three.module.js';
import {hash} from './environment-layout.js';

// A small, original settlement kit. Every solid lives beyond the legal board;
// furnishings imply habitation without inventing NPCs, doors or destinations.
export function addInhabitedEnvironment({root,e,p,m,profile,height,tileSize,quality}){
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2,perf=quality==='performance',groups=[];
  const place=(name,x,z,angle=0)=>{const g=p.group(root,x,height(x,z),z,angle);g.name=name;groups.push(g);return g;};
  const ring=p.geo(new T.TorusGeometry(.43,.035,5,perf?12:20));
  const basket=p.geo(new T.LatheGeometry([[.22,0],[.34,.08],[.43,.50],[.42,.58]].map(a=>new T.Vector2(...a)),perf?10:18));
  const quern=p.geo(new T.LatheGeometry([[.1,0],[.55,.05],[.62,.21],[.44,.40],[.18,.44]].map(a=>new T.Vector2(...a)),perf?12:20));
  const roofGeo=p.geo(new T.BufferGeometry()),rv=[],ru=[],ri=[];
  for(let row=0;row<=6;row++)for(let col=0;col<=8;col++){
    const x=(col/8-.5)*2,z=row/6-.5,y=1-Math.abs(x)+.026*Math.cos(col*Math.PI)*Math.sin(row*.8);
    rv.push(x,y,z);ru.push(col/2,row/2);if(row<6&&col<8){const a=row*9+col;ri.push(a,a+9,a+1,a+1,a+9,a+10);}
  }
  roofGeo.setAttribute('position',new T.Float32BufferAttribute(rv,3));roofGeo.setAttribute('uv',new T.Float32BufferAttribute(ru,2));roofGeo.setIndex(ri);roofGeo.computeVertexNormals();
  const canopyGeo=p.geo(new T.PlaneGeometry(1,1,perf?3:8,perf?3:6));canopyGeo.rotateX(-Math.PI/2);
  const cp=canopyGeo.attributes.position;for(let i=0;i<cp.count;i++){const x=cp.getX(i),z=cp.getZ(i);cp.setY(i,-.13*Math.cos(x*Math.PI)*Math.cos(z*Math.PI)+.017*Math.sin(x*24));}canopyGeo.computeVertexNormals();
  function bowl(g,x,y,z,s=.7){p.mesh(g,basket,m.rope,x,y,z,s,s,s);const rim=p.mesh(g,ring,m.darkWood,x,y+.56*s,z,s,1,s);rim.rotation.x=Math.PI/2;}
  function table(g,x,z,kind='household'){
    p.plank(g,x,.87,z,2.2,.14,.9,m.wood);for(const dx of [-.9,.9])for(const dz of [-.32,.32])p.plank(g,x+dx,.41,z+dz,.12,.82,.12,m.darkWood);
    if(kind==='records'){
      for(let i=0;i<4;i++){const roll=p.mesh(g,p.cylinder,m.ivory,x-.7+i*.38,1.04,z,.095,.58,.095);roll.rotation.x=Math.PI/2;}p.plank(g,x+.74,1.01,z,.26,.12,.32,m.darkWood);
    }else if(kind==='smith'){
      p.plank(g,x,.99,z,.72,.15,.42,m.iron);p.beam(g,[x-.7,1.02,z-.2],[x+.3,1.02,z+.2],.035,m.wood);p.plank(g,x+.3,1.06,z+.2,.26,.14,.10,m.iron);
      for(let i=0;i<3;i++)p.beam(g,[x-.5+i*.25,.98,z+.36],[x-.5+i*.25,.98,z-.2],.018,m.iron);
    }else{bowl(g,x-.55,.94,z,.55);p.amphora(g,x+.5,.94,z,.35);}
  }
  function awning(g,w=5,d=2.7,y=2.7){
    p.mesh(g,canopyGeo,m.cloth,0,y,d/2+.2,w,1,d);
    for(const x of [-w/2,w/2])p.beam(g,[x,0,d+.2],[x,y+.06,d+.2],.055,m.darkWood);
    p.beam(g,[-w/2,y+.06,d+.2],[w/2,y+.06,d+.2],.045,m.wood);
    for(const x of [-w*.3,0,w*.3])p.plank(g,x,y-.19,d+.23,w*.14,.38,.035,m.red);
  }
  function shutters(g,x,z,w=.75){
    p.plank(g,x,1.95,z,w+.18,1.05,.10,m.darkWood);
    for(const side of [-1,1]){const leaf=p.group(g,x+side*(w/2+.10),1.95,z+.13,side*.45);p.plank(leaf,side*.15,0,0,.33,.91,.065,m.wood);for(const yy of [-.32,.32])p.plank(leaf,side*.15,yy,.04,.34,.045,.04,m.iron);}
  }
  function dwelling(name,x,z,{east=false,raised=false,angle=0,work='household',width=5.9,depth=4.8}={}){
    const g=place(name,x,z,angle),base=raised?.72:.22,wall=profile.chapter===5?m.brick:m.plaster,h=east?3.6:2.9;
    if(raised)for(const xx of [-width/2+.25,width/2-.25])for(const zz of [-depth/2+.25,depth/2-.25])p.beam(g,[xx,-.2,zz],[xx,base+.1,zz],.16,m.darkWood);
    p.plank(g,0,base-.13,0,width+.32,.26,depth+.28,raised?m.darkWood:m.darkStone);
    p.plank(g,0,base+h/2,-depth/2,width,h,.23,wall);
    for(const side of [-1,1])p.plank(g,side*(width/2-.1),base+h/2,0,.22,h,depth,wall);
    // True doorway gap, recessed dark interior and two independent wall bays.
    const bay=(width-1.3)/2;
    for(const side of [-1,1])p.plank(g,side*(.65+bay/2),base+h/2,depth/2,bay,h,.23,wall);
    p.plank(g,0,base+h-.30,depth/2,1.3,.60,.23,wall);
    p.plank(g,0,base+1.0,depth/2-.4,1.15,2.0,.10,m.darkWood);
    for(const side of [-1,1])p.plank(g,side*.71,base+1.12,depth/2+.13,.13,2.25,.19,m.wood);
    p.plank(g,0,base+2.25,depth/2+.13,1.64,.16,.22,m.wood);
    for(const side of [-1,1]){shutters(g,side*1.95,depth/2+.17);p.plank(g,side*width/2,base+h/2,depth/2+.04,.15,h+.1,.17,m.darkWood);}
    p.plank(g,0,base+.35,depth/2+.14,width,.35,.05,east?m.redMarble:m.darkStone);
    if(east){
      p.plank(g,0,base+h+.1,0,width+.6,.22,depth+.5,m.earth);
      for(const side of [-1,1]){p.plank(g,side*(width/2+.13),base+h+.44,0,.16,.66,depth+.5,wall);p.plank(g,0,base+h+.44,side*(depth/2+.13),width+.6,.66,.16,wall);}
      for(let i=0;i<4;i++)p.beam(g,[-width/2-.3,base+h-.12,(i-1.5)*1.2],[width/2+.3,base+h-.12,(i-1.5)*1.2],.07,m.wood);
    }else{
      p.mesh(g,roofGeo,raised?m.rope:m.terra,0,base+h-.05,0,(width+.8)/2,1.55,depth+.85);
      for(const side of [-1,1]){p.beam(g,[-width/2-.4,base+h,side*(depth/2+.4)],[0,base+h+1.55,side*(depth/2+.4)],.075,m.darkWood);p.beam(g,[0,base+h+1.55,side*(depth/2+.4)],[width/2+.4,base+h,side*(depth/2+.4)],.075,m.darkWood);}
      p.beam(g,[0,base+h+1.56,-depth/2-.5],[0,base+h+1.56,depth/2+.5],.09,m.terra);
    }
    const porch=p.group(g,0,base,depth/2+.3);awning(porch,width-.8,2.3,east?2.85:2.55);table(porch,-1.0,1.2,work);bowl(porch,1.5,.04,1.6,.9);p.amphora(porch,2.05,0,.65,.7);
    if(raised)for(let i=0;i<3;i++)p.plank(g,0,base*(1-(i+.5)/3),depth/2+2.8+i*.33,1.5,base/3,.36,m.wood);
    else{p.plank(g,0,.08,depth/2+.65,1.5,.16,.8,m.stone);}
    return g;
  }
  function oven(g,x,z){
    p.mesh(g,p.sphere,m.brick,x,.65,z,1.05,.75,1.0);p.plank(g,x,.17,z,2.2,.34,2.2,m.darkStone);
    const mouth=p.mesh(g,p.sphere,m.charcoal,x,.55,z+.86,.46,.43,.09);mouth.castShadow=false;
    p.plank(g,x,1.6,z-.30,.45,1.8,.48,m.brick);p.plank(g,x,2.48,z-.30,.60,.17,.60,m.darkStone);
    p.plank(g,x,.22,z+1.2,1.35,.14,.8,m.stone);p.beam(g,[x+.85,.20,z+1.8],[x+.85,.2,z-.2],.025,m.wood);
  }
  function workshop(name,x,z,angle=0){const g=place(name,x,z,angle);awning(g,5,3.4,2.85);table(g,-1.1,1.8,'smith');oven(g,2.1,.9);
    for(let i=0;i<(perf?5:9);i++){const xx=-2+(i%3)*.3,yy=.15+Math.floor(i/3)*.25;p.beam(g,[xx,yy,-.4],[xx+.08,yy,1.0],.13,m.wood);}return g;}
  function recordFurniture(name,x,z,angle=0){const g=place(name,x,z,angle);table(g,0,0,'records');
    for(const side of [-1,1]){p.plank(g,side*1.5,.41,-.1,.62,.13,.65,m.darkWood);for(const dx of [-.22,.22])p.plank(g,side*1.5+dx,.2,-.1,.08,.40,.55,m.wood);}
    p.mesh(g,quern,m.brass,0,1.03,.02,.16,.18,.16);return g;}

  if(profile.civic){
    const indoor=profile.chapter>=10;
    recordFurniture(profile.chapter===11?'clerks’ audit desk and wax tablets':'petition clerks’ writing table',-hx-3.8,hz-3,-Math.PI/2);
    recordFurniture('delegate record chest and writing seats',hx+3.8,-hz+3,Math.PI/2);
    if(indoor){
      // Tall folded drapes give the chamber a coherent civic silhouette. The
      // curtains and side seats stay wholly outside the playable rectangle.
      const clothGeo=p.geo(new T.PlaneGeometry(2.1,4.7,perf?8:16,2)),a=clothGeo.attributes.position;
      for(let i=0;i<a.count;i++)a.setZ(i,Math.sin(a.getX(i)*13)*.14);clothGeo.computeVertexNormals();
      for(const side of [-1,1]){const g=place('folded audience-hall drapery',side*(hx+4.7),-hz+4,side*-Math.PI/2);p.mesh(g,clothGeo,m.red,0,4.5,0);p.beam(g,[-1.2,6.9,.08],[1.2,6.9,.08],.045,m.brass);}
      const g=place('civic ceremonial lamp stands',0,-hz-2.5);
      for(const x of [-3.9,3.9]){p.mesh(g,quern,m.marble,x,0,0,.85,.65,.85);p.beam(g,[x,.25,0],[x,2.65,0],.05,m.brass);p.mesh(g,basket,m.brass,x,2.55,0,.7,.18,.7);}
    }else{
      const g=place('council field kitchen',-hx-7,hz+2,.5);awning(g,4.7,3.3,2.7);oven(g,1.2,1);bowl(g,-1,.04,1.3,.9);
    }
  }else if(profile.setting==='wetland'||profile.setting==='crossing'){
    dwelling('raised river household and drying porch',hx+7,-hz+1,{raised:true,angle:-Math.PI/2,width:5.4});
    const g=place('fisher’s gear and boat-repair shelter',-hx-6,-hz-5,.25);awning(g,4.2,2.8,2.5);
    for(let i=0;i<4;i++)p.beam(g,[-1.4+i*.5,.08,.2],[-1.4+i*.5,.10,2.8],.035,m.wood);
    for(let i=0;i<7;i++)p.beam(g,[-1.6,.5+i*.18,2.3],[1.6,.5+i*.18,2.3],.009,m.rope);
    for(let i=0;i<9;i++)p.beam(g,[-1.6+i*.4,.4,2.3],[-1.6+i*.4,1.65,2.3],.008,m.rope);bowl(g,-.5,0,.2,1);
  }else if(profile.setting==='palmyra'){
    for(const side of [-1,1])for(const z of perf?[-7.5]:[-7.5,7.5])dwelling('Palmyrene merchant house and shaded market arcade',side*(hx+8),z,{east:true,angle:-side*Math.PI/2,width:6.5,depth:5.4});
  }else if(['siege','desert'].includes(profile.setting)){
    dwelling('eastern courtyard house with shaded work porch',hx+8,hz-2,{east:true,angle:-Math.PI/2,width:6.5,depth:5.4});
    dwelling(profile.setting==='siege'?'abandoned siege-side workshop':'caravan market house',-hx-8,-hz-8,{east:true,angle:.35,work:'smith'});
    const g=place('water merchant’s yard',-hx-5,hz+5,.3);awning(g,4.5,2.8,2.7);for(let i=0;i<4;i++)p.amphora(g,(i-1.5)*.73,0,1,.65+(i%2)*.2);
  }else{
    dwelling(profile.training?'recruits’ timber barrack':'frontier roadside household',hx+7,-hz+1,{angle:-Math.PI/2,work:profile.chapter===3?'records':'household'});
    dwelling(profile.chapter===10?'granary keeper’s residence':'tile-roofed settlement dwelling',-2,-hz-8,{angle:.08,work:profile.chapter===10?'records':'household'});
    workshop(profile.chapter===4?'fortress armourer’s repair yard':'smith and cook’s working yard',-hx-7,hz+4,Math.PI/2);
    if(!perf&&profile.chapter!==7)dwelling('outer settlement bakehouse',hx+12,hz+11,{angle:-.65,width:5.2,depth:4.3});
  }
  root.updateWorldMatrix(true,true);
  root.userData.inhabitedSetpieces=groups.map(g=>{const box=new T.Box3().setFromObject(g);return {name:g.name,min:box.min.toArray(),max:box.max.toArray()};});
  root.userData.environmentLandmarks.push(...groups.map(g=>g.name));
  return groups;
}
