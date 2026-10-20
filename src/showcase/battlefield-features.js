import * as T from '../../vendor/three/three.module.js';
import {gridToWorld} from './environment.js';

// Static fieldwork is instanced by shape/material. State changes rebuild these
// small batches; idle frames only animate the flame/smoke, never the rule state.
export function createBattlefieldFeatures(scene,{heightAt=()=>0}={}){
  const group=new T.Group();group.name='interactive-battlefield';scene.add(group);
  let signature='',meshes=[],fires=[],bounds=null;
  const clear=()=>{for(const m of meshes){m.geometry.dispose();m.material.dispose();m.removeFromParent();}meshes=[];fires=[];};
  function sync(e){
    const next=JSON.stringify([e.id,e.width,e.field]);if(next===signature)return;signature=next;clear();
    if(e.featureEdition!==31||e.kind!=='battle'||e.type==='training')return;
    const buckets=new Map(),matrix=new T.Matrix4(),rotation=new T.Quaternion();
    const add=(kind,color,x,y,z,sx,sy,sz,angle=0)=>{const key=`${kind}:${color}`,list=buckets.get(key)??[];rotation.setFromAxisAngle(new T.Vector3(0,0,1),angle);matrix.compose(new T.Vector3(x,y,z),rotation,new T.Vector3(sx,sy,sz));list.push(matrix.clone());buckets.set(key,list);};
    for(const o of e.field.objects){
      const p=gridToWorld(o,e,2.5),ground=o.kind==='bridge'?Math.max(heightAt(p.x-1.3,p.z),heightAt(p.x+1.3,p.z)):heightAt(p.x,p.z),wood='#6c5137',stone='#9a917d';
      const box=(x,y,z,sx,sy,sz,color=wood,angle=0)=>add('box',color,p.x+x,ground+y,p.z+z,sx,sy,sz,angle);
      const post=(x,z,h=1.6)=>box(x,h/2,z,.14,h,.14);
      if(o.kind==='gate'){
        post(0,-1,2);post(0,1,2);box(0,2,0,.22,.18,2.3);
        for(let i=0;i<7;i++)box(o.state==='open'?(i-3)*.25:0,.9,o.state==='open'?-1.05:(i-3)*.25,o.state==='open'?.18:.13,1.7,o.state==='open'?.13:.18);
        box(0,2.14,0,.3,.12,2.5,stone);
      }else if(o.kind==='bridge'){
        for(let i=0;i<11;i++){if(o.state==='damaged'&&i>=4&&i<=6)continue;box((i-5)*.22,.12,0,.18,.16,1.65);}
        for(const z of [-.8,.8]){box(0,.05,z,2.6,.18,.12);for(const x of [-1,1])post(x,z,.8);box(0,.75,z,2.3,.08,.08);}
      }else if(o.kind==='barricade'){
        for(let i=0;i<5;i++){const intact=o.state==='intact';box((i-2)*.32,intact?.48:.1,0,.15,intact?1.15:.18,intact?.15:.9,wood,intact?(i%2?.25:-.25):0);}
        if(o.state==='intact')box(0,.42,.08,1.7,.16,.18);
      }else if(o.kind==='stores'){
        box(0,.45,0,1.05,.12,.7);for(const x of [-.6,.6])add('wheel',wood,p.x+x,ground+.35,p.z,.12,.65,.65);
        if(o.state==='available'){box(-.2,.7,0,.42,.4,.5,'#b19e77');box(.25,.65,.04,.35,.3,.4,'#8c9b74');}
      }else if(o.kind==='signal'){
        post(0,0,2.3);box(.3,1.93,0,.65,.5,.05,o.state==='secured'?'#d0b36a':'#914541');box(0,.08,0,.6,.16,.6,stone);
      }else if(o.kind==='brazier'){
        for(const x of [-.2,.2])post(x,0,.6);box(0,.62,0,.6,.2,.5,'#3e4542');
        if(o.state==='burning'){
          const flame=new T.Mesh(new T.ConeGeometry(.25,.8,7),new T.MeshBasicMaterial({color:'#efa94a',transparent:true,opacity:.85,depthWrite:false}));flame.position.set(p.x,ground+1,p.z);group.add(flame);meshes.push(flame);fires.push(flame);
          for(let i=0;i<4;i++){const smoke=new T.Mesh(new T.IcosahedronGeometry(.45+i*.12,1),new T.MeshBasicMaterial({color:'#625f57',transparent:true,opacity:.2-i*.03,depthWrite:false}));smoke.position.set(p.x+i*.12,ground+1.5+i*.65,p.z);group.add(smoke);meshes.push(smoke);fires.push(smoke);}
        }
      }
    }
    // Chapter-specific skyline landmark outside the playable rectangle.
    const x=e.width*1.25+2.2,z=-e.height*1.25-1.5,y=heightAt(x,z),chapter=Number(e.id.match(/^ch(\d+)/)?.[1]??1);
    if([1,4,6,7].includes(chapter)){
      for(const dx of [-.8,.8])for(const dz of [-.8,.8])add('box','#6d5138',x+dx,y+1.8,z+dz,.22,3.6,.22);
      add('box','#a69879',x,y+3.3,z,2.2,.22,2.2);add('roof','#6d5138',x,y+4.3,z,1.7,1.2,1.7);
    }else{
      for(const dx of [-1.8,1.8]){add('box','#aaa08c',x+dx,y+1.5,z,.7,3,.7);add('box','#bcb09a',x+dx,y+3,z,.95,.2,.95);}
      add('box','#9b907d',x,y+3.25,z,4.4,.4,1);if([8,10].includes(chapter))add('roof','#8b5941',x,y+4.1,z,3.2,1.2,2.2);
    }
    for(const [key,matrices]of buckets){const [kind,color]=key.split(':'),geometry=kind==='wheel'?new T.CylinderGeometry(.5,.5,1,12).rotateZ(Math.PI/2):kind==='roof'?new T.ConeGeometry(1,1,4).rotateY(Math.PI/4):new T.BoxGeometry(1,1,1),material=new T.MeshStandardMaterial({color,roughness:.88});
      const mesh=new T.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);meshes.push(mesh);
    }
    bounds={objects:e.field.objects.length,drawBatches:meshes.length};
  }
  return {group,sync,update(time,reduced){fires.forEach((m,i)=>{const a=reduced?0:Math.sin(time*(i?1.4:8)+i);m.scale.setScalar(1+a*(i?.06:.15));});},stats:()=>bounds,dispose(){clear();group.removeFromParent();}};
}
