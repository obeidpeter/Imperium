import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FRAME_ATLASES} from '../src/ui/animation-catalog.js';
import {ANIMATION_ASSETS,animationAssets,authoredFrame,actionFrameIndex} from '../src/ui/sprite-frames.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../src/ui/animation-timeline.js';
import {spriteHeight} from '../src/ui/unit-sprites.js';

test('All 156 authored frames fit their delivered alpha WebPs and have bounded source clips and sole anchors',async()=>{
  let total=0;
  for(const atlas of Object.values(FRAME_ATLASES)){
    const bytes=await readFile(new URL('../'+atlas.file,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,16),'WEBPVP8X');
    assert.ok(bytes[20]&16,'Delivered animation sheet must retain alpha.');
    const width=bytes.readUIntLE(24,3)+1,height=bytes.readUIntLE(27,3)+1;
    assert.ok(width<=2048&&height<=1536);assert.ok(atlas.bodyHeight>0);
    for(const f of atlas.frames){
      total++;const [x,y,w,h]=f.source;
      assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height);
      assert.ok(f.anchor.x>=0&&f.anchor.x<=w);assert.equal(f.anchor.y,h,'Sole stays at the board anchor, independent of cell padding.');
      assert.ok(f.clip.length>=3&&f.clip.length<80);
      assert.ok(f.clip.every(([px,py])=>Number.isFinite(px)&&Number.isFinite(py)&&px>=0&&py>=0&&px<=w&&py<=h));
    }
  }
  assert.equal(total,156);assert.equal(new Set(ANIMATION_ASSETS).size,5);
});

test('Six actual poses advance through anticipation, contact and recovery; distance determines gait',()=>{
  for(const pose of ['attack','brace','hit','throw','speak'])assert.deepEqual(new Set(Array.from({length:101},(_,i)=>actionFrameIndex(pose,i/100))),new Set([0,1,2,3,4,5]));
  assert.equal(actionFrameIndex('attack',.2),1);assert.equal(actionFrameIndex('attack',.37),2);assert.equal(actionFrameIndex('attack',.9),5);
  const phases=Array.from({length:6},(_,i)=>i*Math.PI/3+.01);
  assert.deepEqual(phases.map(p=>actionFrameIndex('walk',.3,p)),[0,1,2,3,4,5]);
  assert.deepEqual(phases.map(p=>actionFrameIndex('run',.8,p)),[0,1,2,3,4,5]);
});

test('Frame coverage never substitutes gear or a front-facing attack for an unpainted rear view',()=>{
  const attack=Object.freeze({pose:'attack',progress:.37}),recruit=Object.freeze({atlas:'roman',row:0});
  assert.ok(authoredFrame(recruit,'east',attack).asset.endsWith('recruit-actions.webp'));
  assert.equal(authoredFrame(recruit,'north',attack),null);
  assert.equal(authoredFrame({atlas:'roman',row:2},'east',attack),null,'Centurion keeps his cape and rank equipment.');
  assert.equal(authoredFrame({atlas:'specialists',row:2},'east',attack),null,'Persian infantry is not replaced by Roman mail.');
  assert.equal(authoredFrame({atlas:'frontier',row:2},'west',attack),null,'Riders cannot use an infantry animation.');
  assert.ok(authoredFrame({atlas:'frontier',row:0},'west',attack).asset.endsWith('gothic-actions.webp'));
  assert.ok(authoredFrame({atlas:'civic',row:1},'north',{pose:'speak',progress:.5}).asset.endsWith('civic-actions.webp'));
  assert.equal(authoredFrame({atlas:'civic',row:2},'north',{pose:'speak',progress:.5}),null,'The rival retains his own face and red robe.');
  for(const value of [NaN,Infinity,-Infinity,-10,10])for(const pose of ['walk','attack','brace','hit','throw']){
    const frame=authoredFrame(recruit,'east',Object.freeze({pose,progress:value,stridePhase:value}));
    assert.ok(frame&&frame.frame>=0&&frame.frame<6&&frame.source.every(Number.isFinite));
  }
});

test('Chapter prefetch is bounded and civic action art arrives only for the appropriate identity',()=>{
  assert.equal(animationAssets(1,false).length,4);
  assert.equal(animationAssets(5,false).length,1);
  assert.deepEqual(animationAssets(7,true),[]);
  assert.deepEqual(animationAssets(11,true),['./assets/animation/civic-actions.webp']);
  assert.ok(spriteHeight({tw:120},{role:'infantry'})>100);assert.equal(spriteHeight({tw:300},{role:'cavalry'}),140);
});

const unit=(id,x,extra={})=>({id,name:id,x,y:3,hp:12,maxHp:12,side:id==='hero'?'player':'enemy',role:'infantry',facing:id==='hero'?'east':'west',...extra});
const encounter=units=>({id:'timing-fixture',kind:'battle',width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill('grass')),units,log:[],status:'active'});
test('Actual strike contact and javelin release coincide with the correct painted frames',()=>{
  for(const action of ['strike','throw']){
    const before=encounter([unit('hero',1),unit('enemy',action==='strike'?2:4)]),after=structuredClone(before);after.units[1].hp-=3;
    const timeline=buildEncounterTimeline(before,after,{command:{unitId:'hero',action,targetId:'enemy'}}),actor=timeline.tracks.find(t=>t.unitId==='hero'&&['attack','throw'].includes(t.pose));
    const at=action==='throw'?timeline.effects.find(e=>e.type==='projectile').start:timeline.tracks.find(t=>t.unitId==='enemy'&&t.pose==='hit').start;
    const sample=sampleEncounterTimeline(timeline,at).unitOverrides.hero,frame=authoredFrame({atlas:'roman',row:0},'east',sample);
    assert.ok(actor.duration>=600);assert.equal(frame.frame,action==='throw'?3:2);
    assert.deepEqual(after.units.map(u=>u.x),before.units.map(u=>u.x),'Presentation timing cannot move rule units.');
  }
});

test('Formation acknowledgement cannot replace a committed allied attack with an unrelated gesture',()=>{
  const before=encounter([unit('hero',0),unit('ally',2,{side:'ally',ordered:false}),unit('enemy',3)]),after=structuredClone(before);
  Object.assign(after.units[1],{ordered:true,formation:'wedge'});after.units[2].hp-=4;after.log=['ally hits enemy for 4.'];
  const timeline=buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'formation',targetId:'ally',formation:'wedge',orderAction:'attack'}});
  const attack=timeline.tracks.find(t=>t.unitId==='ally'&&t.pose==='attack');assert.ok(attack);
  assert.equal(sampleEncounterTimeline(timeline,attack.start+attack.duration*.37).unitOverrides.ally.pose,'attack');
});
