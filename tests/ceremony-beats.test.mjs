import test from 'node:test';
import assert from 'node:assert/strict';
import {CEREMONY_KINDS,ceremonyScene,ceremonyShot} from '../src/showcase/ceremony.js';

// The oath and the accession framed as story beats rather than a slow orbit (worlds and
// gameplay plan, release 9).
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

test('each ceremony opens on its first beat, and every beat frames one of its figures',()=>{
  for(const kind of CEREMONY_KINDS){
    const scene=ceremonyScene(kind),{beats,encounter}=scene;
    assert.ok(beats.length>=4,`${kind} tells its moment in several beats`);
    assert.deepEqual([scene.focus,scene.yaw,scene.pitch,scene.distance],[beats[0].focus,beats[0].yaw,beats[0].pitch,beats[0].distance],`${kind} opens on its first beat`);
    assert.equal(new Set(beats.map(b=>b.id)).size,beats.length);
    for(const b of beats){
      assert.ok(b.focus.x>=0&&b.focus.x<encounter.width&&b.focus.y>=0&&b.focus.y<encounter.height,`${kind}:${b.id} looks at its own board`);
      assert.ok(encounter.units.some(u=>Math.hypot(u.x-b.focus.x,u.y-b.focus.y)<=1.6),`${kind}:${b.id} frames a figure`);
      assert.ok(b.distance>=4&&b.distance<=30&&b.pitch>0&&b.pitch<.6&&b.hold>=4&&b.move>=1.5,`${kind}:${b.id} is a steady, readable shot`);
    }
  }
});

test('the shot holds each beat, eases to the next by the shorter turn, and loops',()=>{
  const {beats}=ceremonyScene('oath'),cycle=beats.reduce((n,b)=>n+b.hold+b.move,0);
  assert.equal(ceremonyShot(null,3),null);assert.equal(ceremonyShot([],3),null);
  // Held: the beat's own framing throughout its hold.
  let start=0;
  for(const [i,b] of beats.entries()){
    for(const t of [start+.01,start+b.hold*.5,start+b.hold-.01]){
      const shot=ceremonyShot(beats,t);assert.equal(shot.beat,b.id);assert.equal(shot.index,i);
      assert.deepEqual([shot.focus,shot.yaw,shot.pitch,shot.distance,shot.lift],[{...b.focus},b.yaw,b.pitch,b.distance,b.lift]);
    }
    // Moving: halfway between this framing and the next, turning the short way round.
    const next=beats[(i+1)%beats.length],mid=ceremonyShot(beats,start+b.hold+b.move/2);
    assert.ok(Math.abs(wrap(mid.yaw-(b.yaw+wrap(next.yaw-b.yaw)/2)))<1e-9,`${b.id} to ${next.id} turns the short way`);
    assert.ok(Math.abs(mid.distance-(b.distance+next.distance)/2)<1e-9&&Math.abs(mid.focus.x-(b.focus.x+next.focus.x)/2)<1e-9);
    start+=b.hold+b.move;
  }
  assert.ok(Math.abs(start-cycle)<1e-9);
  // The camera never jumps: consecutive samples a frame apart stay close, round the loop too.
  for(let t=0;t<cycle*1.2;t+=1/30){
    const a=ceremonyShot(beats,t),b=ceremonyShot(beats,t+1/30);
    assert.ok(Math.abs(wrap(b.yaw-a.yaw))<.06&&Math.abs(b.distance-a.distance)<.4&&Math.hypot(b.focus.x-a.focus.x,b.focus.y-a.focus.y)<.1,`a jump at ${t.toFixed(2)} s`);
  }
  assert.deepEqual(ceremonyShot(beats,cycle+1),ceremonyShot(beats,1));
  // Reduced motion (time 0), a stopped clock or a bad time give the opening shot.
  for(const t of [0,NaN,undefined,-cycle])assert.equal(ceremonyShot(beats,t).beat,beats[0].id);
});
