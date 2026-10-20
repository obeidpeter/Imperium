import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createActor} from '../src/showcase/actors.js';
import {handGeometry} from '../src/showcase/actor-extremities.js';

test('The closed shield hand stays behind the board through guard, strike and recovery',()=>{
  for(const role of ['infantry','guard','cavalry']){
    const actor=createActor({id:'hero',name:'Marcellus',side:'player',role},{chapter:5,quality:'balanced'});
    const geometry=handGeometry({side:1,quality:'balanced'});
    try{
      const hand=actor.group.getObjectByName('left-shoulder').getObjectByName('hand'),shield=actor.group.getObjectByName('oval-shield');
      assert.ok(hand&&shield);
      const vertex=new T.Vector3();
      for(const motion of ['idle','walk','attack','block','hit'])for(const phase of [0,.25,.5,.75,1]){
        actor.update({motion,phase,time:phase,direction:0,detailDistance:1,active:true,resetPose:true});
        actor.group.updateMatrixWorld(true);
        // The renderer batches this geometry into the skin; use its original
        // bone frame to check every vertex against the actual animated shield.
        const position=geometry.attributes.position;
        for(let i=0;i<position.count;i++){
          vertex.fromBufferAttribute(position,i);hand.localToWorld(vertex);shield.worldToLocal(vertex);
          const radius2=(vertex.x/.257)**2+((vertex.y-.03)/.392)**2;
          assert.ok(radius2<1,`${role} ${motion}: grip stays within the shield outline`);
          const faceZ=.019+.045*(1-radius2);
          assert.ok(vertex.z<faceZ-.02,`${role} ${motion}: fingers stay behind the shield face`);
        }
      }
    }finally{geometry.dispose();actor.dispose();}
  }
});
