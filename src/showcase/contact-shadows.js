import * as T from '../../vendor/three/three.module.js';

// One pooled draw for soft ambient contact beneath the figures, complementing
// directional cast shadows. The tessellated surface follows visible ground,
// including raised cells; it is neither a gameplay obstacle nor a pick target.
export function createContactShadows(scene,{capacity=256,segments=4}={}){
  const n=segments+1,vertices=n*n,positions=new Float32Array(capacity*vertices*3),uvs=[],indices=[],strengths=new Float32Array(capacity*vertices);
  for(let slot=0;slot<capacity;slot++)for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    uvs.push(x/segments,z/segments);
    if(x<segments&&z<segments){const i=slot*vertices+z*n+x;indices.push(i,i+n,i+1,i+1,i+n,i+n+1);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('strength',new T.BufferAttribute(strengths,1).setUsage(T.DynamicDrawUsage));geometry.setIndex(indices);geometry.setDrawRange(0,0);
  const material=new T.ShaderMaterial({name:'Soft ambient figure contact',transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    vertexShader:'attribute float strength; varying float contactStrength; varying vec2 contactUV; void main(){contactUV=uv;contactStrength=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying float contactStrength; varying vec2 contactUV; void main(){vec2 p=contactUV*2.0-1.0;float d=dot(p,p);float a=exp(-d*4.2)*(1.0-smoothstep(.45,1.0,d))*contactStrength;gl_FragColor=vec4(.045,.038,.028,a);#include <colorspace_fragment>}'.replace(';#include',';\n#include')
  });
  const mesh=new T.Mesh(geometry,material);mesh.name='Grounded figure contact shadows';mesh.frustumCulled=false;mesh.renderOrder=1;scene.add(mesh);let count=0,figures=0,disposed=false;
  function update(actors,heightAt){
    count=0;figures=0;
    function stamp(p,rx,rz,yaw,strength){
      if(count>=capacity||strength<=.005)return;
      const cs=Math.cos(yaw),sn=Math.sin(yaw);
      for(let z=0;z<n;z++)for(let x=0;x<n;x++){
        const lx=(x/segments*2-1)*rx,lz=(z/segments*2-1)*rz,wx=p.x+lx*cs+lz*sn,wz=p.z-lx*sn+lz*cs,index=(count*vertices+z*n+x)*3;
        positions[index]=wx;positions[index+1]=heightAt(wx,wz)+.04;positions[index+2]=wz;strengths[count*vertices+z*n+x]=strength;
      }
      count++;
    }
    const sole=new T.Vector3();
    for(const actor of actors.values()){
      if(!actor.group.visible||count>=capacity)continue;
      const g=actor.group,mounted=g.userData.actor?.mounted,yaw=g.rotation.y;
      stamp(g.position,mounted?.77:.58,mounted?1.28:.48,yaw,.24);figures++;
      // Formation followers stand on the same ground with a softer contact.
      for(const p of actor.crowd?.footprints??[])stamp(p,mounted?.66:.42,mounted?1.1:.36,yaw,.2);
      for(const foot of actor.contacts?.feet??[]){
        foot.localToWorld(sole.set(0,mounted?-.075:-.07,mounted?.015:.045));
        const lift=Math.max(0,sole.y-heightAt(sole.x,sole.z));
        stamp(sole,mounted?.19:.15,mounted?.23:.23,yaw,.50*Math.max(0,1-lift/.18));
      }
    }
    geometry.setDrawRange(0,count*segments*segments*6);geometry.attributes.position.needsUpdate=true;geometry.attributes.strength.needsUpdate=true;mesh.visible=count>0;
  }
  return {mesh,update,stats:()=>({draws:count?1:0,figures,stamps:count,triangles:count*segments*segments*2}),dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();material.dispose();}};
}
