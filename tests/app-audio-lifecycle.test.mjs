import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {audioDirection} from '../src/ui/soundscape-data.js';

// Execute the app's actual field/audio reconciliation block. The DOM, renderer
// and field mount are boundary doubles; audio direction uses production rules.
// This catches callback ordering without a browser, audio device or new app API.
const source=readFileSync(new URL('../src/ui/app.js',import.meta.url),'utf8');
const start=source.indexOf('  syncSessionControls();',source.indexOf('function render(){'));
const end=source.indexOf('  const ceremonyHost=',start);
assert.ok(start>0&&end>start,'The actual render lifecycle block is available');
const reconciliation=source.slice(start,end);
const state=()=>({chapter:5,phase:'encounter',encounter:{id:'restored-battle',kind:'battle',status:'active',turn:1,turnLimit:10,units:[{id:'hero',side:'player',hp:10,maxHp:10,x:0,y:0}]}});
const world=(hp,status='active')=>({kind:'field',tick:0,status,actors:[{id:'hero',side:'player',hp,maxHp:10,x:0,z:0}],mission:{deadline:10,defence:100}});
function reconcile({oldWorld,newWorld=null}){
  const updates=[],calls=[];
  const context={state:state(),screen:'game',field:{runtime:{world:oldWorld}},syncSessionControls(){},
    fieldTarget:()=>newWorld?{kind:'field',key:'replacement'}:null,uses3D:()=>false,battleStage:{release:()=>calls.push('release-stage')},
    mountField(){calls.push('mount');context.field={runtime:{world:newWorld}};},
    disposeField(){calls.push('dispose');context.field=null;},
    soundscape:{update(state,screen,live){calls.push('audio');updates.push({world:live,direction:audioDirection(state,screen,live)});}}};
  runInNewContext(reconciliation,context);
  return {updates,calls};
}

test('restoring a turn battle discards the previous live health/status before choosing its audio mix',()=>{
  for(const oldWorld of [world(1),world(10,'won'),world(10,'lost')]){
    const {updates,calls}=reconcile({oldWorld});assert.equal(updates.length,1);
    assert.equal(updates[0].direction.mood,'calm','The restored healthy encounter must not inherit urgency, victory or defeat');
    assert.equal(updates[0].world,undefined);assert.ok(calls.indexOf('dispose')<calls.indexOf('audio'));
  }
});

test('a replaced or continuing real-time field supplies current live pressure after reconciliation',()=>{
  const current=world(2);
  for(const oldWorld of [world(10,'won'),current]){
    const {updates,calls}=reconcile({oldWorld,newWorld:current});assert.equal(updates.length,1);
    assert.equal(updates[0].world,current);assert.equal(updates[0].direction.mood,'urgent');
    assert.ok(calls.indexOf('mount')<calls.indexOf('audio'));
  }
});
