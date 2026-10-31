import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,queueCommand,restoreWorld,snapshotWorld,step,worldHash} from '../src/core/realtime/simulation.js';
import {reservedCommand} from '../src/core/realtime/command.js';
import {validateWorld} from '../src/core/realtime/validate.js';
import {ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {ARENA,TIME} from '../src/data/realtime-rules.js';
import {createOrderReview,squadOrderReview,orderReviewRows} from '../src/ui/squad-order-review.js';
import {Document} from './mini-dom.mjs';

// Labelled isolated squads: test reservation accounting, without a campaign or
// artificial victory. Every change under test goes through legal commands.
function fixture(){
  return createWorld({seed:275,chapter:5,command:3,
    map:{id:'order-review-fixture',width:40,height:24,terrain:Array.from({length:24},()=>Array(40).fill('grass'))},
    actors:[{id:'hero',name:'Hero',side:'player',kit:ARENA.hero.kit,at:[6,30],face:[1,0]}],
    squads:[['a',20,30,'ally'],['b',20,36,'ally'],['c',20,42,'ally'],['foe',90,40,'enemy']].map(([id,x,z,side])=>
      ({id,name:`${id} squad`,side,role:'infantry',strength:16,maxStrength:16,at:[x,z],face:[1,0],standing:[['hold_line',null]],member:ROMAN_SQUADS.infantry}))});
}
const order=(w,ids,kind='hold',extra={})=>queueCommand(w,{actorId:'hero',kind:'order',payload:{squads:ids,order:{kind,...extra}}});
const cancel=(w,ids)=>queueCommand(w,{actorId:'hero',kind:'cancelOrder',payload:{squads:ids}});
const run=(w,n)=>{for(let i=0;i<n;i++)step(w);};

test('queued formation cancellation transfers its single reservation until the last member cancels',()=>{
  const w=fixture();assert.ok(order(w,['a','b','c'],'line').ok);const rng={...w.rng};
  assert.equal(w.command.left,2);assert.equal(cancel(w,['a']).refunded,0);
  assert.deepEqual(w.queue[0].payload.costs,{b:1,c:0});assert.equal(reservedCommand(w),1);
  assert.equal(cancel(w,['c']).refunded,0);assert.deepEqual(w.queue[0].payload.squads,['b']);
  assert.equal(cancel(w,['b']).refunded,1);assert.equal(w.command.left,3);assert.equal(w.queue.length,0);
  assert.equal(w.tick,0);assert.deepEqual(w.rng,rng);assert.equal(w.squads[0].formation,null);
});

test('travelling formation cancels exactly across snapshot/resume, leaving active orders intact',()=>{
  const w=fixture();order(w,['a'],'advance',{x:30,z:30});run(w,22);
  const active=structuredClone(w.squads[0].order);order(w,['a','b'],'line');step(w);
  assert.ok(w.squads[0].pending);const saved=snapshotWorld(w),resumed=restoreWorld(saved);
  for(const candidate of [w,resumed]){
    assert.equal(cancel(candidate,['a']).refunded,0);assert.equal(candidate.squads[1].pending.cost,1);
    assert.deepEqual(candidate.squads[0].order,active);assert.equal(cancel(candidate,['b']).refunded,1);
    assert.equal(candidate.squads[0].pending,null);run(candidate,25);
  }
  assert.equal(worldHash(w),worldHash(resumed));assert.equal(w.squads[0].formation,null);
  assert.doesNotThrow(()=>validateWorld(w,message=>assert.fail(message)));
});

test('cancellation across a round boundary returns new reservations but never earlier-round points',()=>{
  const w=fixture();run(w,TIME.roundTicks-2);order(w,['a','b'],'line');run(w,2);
  assert.equal(w.command.left,3);assert.ok(w.squads[0].pending);order(w,['a'],'hold');
  assert.equal(w.command.left,2);assert.equal(cancel(w,['a']).refunded,1);
  assert.equal(w.command.left,3);assert.equal(w.squads[1].pending.cost,1);
  assert.equal(cancel(w,['b']).refunded,0);assert.equal(w.command.left,3);
  assert.equal(reservedCommand(w),0);assert.equal(w.queue.length,0);
});

test('invalid cancellation is atomic, including mixed, duplicate, enemy and already-applied targets',()=>{
  const w=fixture();order(w,['a']);
  for(const ids of [[],['missing'],['foe'],['a','a'],['a','b'],null]){
    const before=snapshotWorld(w);assert.equal(cancel(w,ids).ok,false);assert.equal(snapshotWorld(w),before);
  }
  run(w,25);const active=snapshotWorld(w);assert.equal(cancel(w,['a']).ok,false);assert.equal(snapshotWorld(w),active);
  order(w,['b']);w.status='lost';const lost=snapshotWorld(w);assert.equal(cancel(w,['b']).ok,false);assert.equal(snapshotWorld(w),lost);
});

test('review derives every friendly order, costs, delay and active fallback without changing the world',()=>{
  const w=fixture();order(w,['a'],'advance',{x:40,z:32});step(w);order(w,['b','c'],'line');
  const before=snapshotWorld(w),rows=squadOrderReview(w);
  assert.equal(rows.length,3);assert.equal(rows[0].state,'On its way');assert.match(rows[0].destination,/40 m, 32 m/);
  assert.match(rows[0].timing,/remaining/);assert.equal(rows[1].state,'Queued');assert.match(rows[1].cost,/1 Command reserved.*shared/);
  assert.match(rows[2].cost,/0 Command reserved.*shared/);assert.match(rows[1].formation,/Line planned/);
  assert.equal(snapshotWorld(w),before);assert.equal(restoreWorld(before).version,w.version);
  w.squads[1].name='<script>bad</script>';assert.ok(!orderReviewRows(squadOrderReview(w)).includes('<script>'));
});

test('paused review opens by request, cancels through the rules, preserves focus and closes on resume',t=>{
  const doc=new Document(),previous=globalThis.document;globalThis.document=doc;t.after(()=>{globalThis.document=previous;});
  const w=fixture();order(w,['a']);let paused=true,changed=0;const dispatched=[],messages=[],replacements=[];
  const dom=Object.fromEntries(['orderReview','orderReviewButton','orderReviewRows','orderReviewTitle','closeOrderReview','canvas'].map(role=>[role,doc.createElement(role.includes('Button')||role==='closeOrderReview'?'button':'div')]));
  dom.orderReview.append(dom.orderReviewTitle,dom.orderReviewRows,dom.closeOrderReview);doc.body.append(dom.orderReviewButton,dom.orderReview,dom.canvas);
  const control=createOrderReview({dom,world:()=>w,paused:()=>paused,issue:c=>{dispatched.push(c);return queueCommand(w,c);},replace:id=>replacements.push(id),say:text=>messages.push(text),changed:()=>changed++});
  dom.orderReview.hidden=true;const before=worldHash(w);control.update();assert.equal(dom.orderReview.hidden,true);
  dom.orderReviewButton.onclick();assert.equal(dom.orderReview.hidden,false);assert.equal(doc.activeElement,dom.orderReviewTitle);assert.equal(worldHash(w),before);
  const button=dom.orderReviewRows.querySelector('[data-review-action="cancel"]');button.focus();dom.orderReviewRows.onclick({target:button});
  assert.equal(dispatched[0].kind,'cancelOrder');assert.equal(w.command.left,3);assert.equal(changed,1);
  assert.match(messages.at(-1),/1 Command returned/);assert.equal(doc.activeElement.dataset.reviewAction,'replace');
  const replace=dom.orderReviewRows.querySelector('[data-review-action="replace"]');dom.orderReviewRows.onclick({target:replace});assert.deepEqual(replacements,['a']);
  assert.equal(control.open,false);control.show();paused=false;control.update();assert.equal(dom.orderReview.hidden,true);assert.equal(dom.orderReviewButton.hidden,true);
  control.dispose();
});
