import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {combatReadability,createLivePresenter,stageUnit,stageEncounter} from '../src/showcase/live-figures.js';
import {readableLighting} from '../src/showcase/scene-lighting.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {BattleStage,STAGE_QUALITY} from '../src/showcase/stage.js';
import {COMPOSITOR_TIERS} from '../src/showcase/scene-compositor.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {createActor} from '../src/showcase/actors.js';
import {actorKit} from '../src/showcase/actor-kit.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {actorBodyId} from '../src/ui/actor-body-catalog.js';
import {soldierPreviewUnit} from '../src/showcase/soldier-preview.js';
import {createSoldier} from '../src/core/soldier.js';

test('Telegraphs use the real contact/release boundary and exclude unavailable or hidden men',()=>{
  for(const kind of ['swing','throw','shot','bash']){
    const a={alive:true,action:{kind,start:10,end:30,...(['swing','bash'].includes(kind)?{contact:17}:{release:24})}},before=JSON.stringify(a),contact=a.action.contact??a.action.release;
    assert.equal(combatReadability(a,9),null);assert.equal(combatReadability(a,contact-.01),'windup');
    assert.equal(combatReadability(a,contact),'recovery');assert.equal(combatReadability(a,29),'recovery');assert.equal(combatReadability(a,30),null);
    assert.equal(JSON.stringify(a),before);
    for(const invalid of [{alive:false},{down:true},{hidden:true},{carriedBy:'hero'}])assert.equal(combatReadability({...a,...invalid},15),null);
    assert.equal(combatReadability({...a,staggerUntil:25},15),'stagger');
  }
});

test('Live political figures show actual support and dissent, and a horizon target follows only a nearby visible exchange',()=>{
  const hero={id:'hero',alive:true,hp:10,maxHp:10,x:8,z:8,px:8,pz:8,fx:1,fz:0,pfx:1,pfz:0,lock:'delegate',kit:[],civic:{role:'speaker'}},
    delegate={...hero,id:'delegate',x:12,px:12,lock:null,civic:{role:'voter',stance:-3}},w={tick:20,controlled:'hero',heroId:'hero',party:[],map:{width:8,height:8},actors:[hero,delegate]},before=JSON.stringify(w);
  const stage={surfaceHeight:()=>0,wake(){},overlay:new T.Group()},presenter=createLivePresenter(stage,{world:()=>w,alpha:()=>1});
  assert.equal(presenter.pose(stageUnit(delegate),{time:0,dt:0,reducedMotion:true}).pose.motion,'dissent');
  delegate.civic.stance=2;assert.equal(presenter.pose(stageUnit(delegate),{time:0,dt:0,reducedMotion:true}).pose.motion,'assent');delegate.civic.stance=-3;
  assert.deepEqual(presenter.cameraTarget().toArray(),[-.8,1.4,-2]);
  delegate.hidden=true;assert.deepEqual(presenter.cameraTarget().toArray(),[-2,1.4,-2]);delete delegate.hidden;
  assert.equal(JSON.stringify(w),before);presenter.dispose();
});

test('Live horizon frames the actual exchange on wide and narrow canvases without shrinking to fit a hundred-metre field',()=>{
  for(const aspect of [.7,1,2.4]){
    const stage=Object.create(BattleStage.prototype),target=new T.Vector3(22,1.4,-18);
    Object.assign(stage,{live:{cameraTarget:()=>target.clone()},camera:new T.PerspectiveCamera(40,aspect,.1,800),orbit:{},baseTarget:new T.Vector3()});stage.horizon();
    assert.equal(stage.focusMode,true);assert.equal(stage.cameraView,'horizon');assert.ok(stage.orbit.distance>=20&&stage.orbit.distance<=34);
    const {yaw,pitch,distance}=stage.orbit;stage.camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);stage.camera.lookAt(target);stage.camera.updateMatrixWorld();
    for(const y of [0,2.2]){const p=new T.Vector3(target.x,y,target.z).project(stage.camera);assert.ok(Math.abs(p.x)<.9&&Math.abs(p.y)<.9);}
  }
});

test('Civic conversation framing follows actual speech or selection, fits both people and respects camera preferences',()=>{
  const hero={id:'hero',alive:true,hp:10,maxHp:10,x:8,z:8,kit:[],civic:{role:'speaker'}},
    delegate={...hero,id:'delegate',x:16,z:12,civic:{role:'voter',stance:0}},
    rival={...hero,id:'rival',x:22,z:5},world={tick:1,controlled:'hero',heroId:'hero',map:{width:12,height:12},actors:[hero,delegate,rival]},before=JSON.stringify(world);
  let targetId='delegate';const stub={surfaceHeight:()=>0,wake(){},overlay:new T.Group()},presenter=createLivePresenter(stub,{world:()=>world,alpha:()=>1,view:()=>({targetId})});
  const pair=presenter.cameraFraming();assert.equal(pair.points.length,2);assert.deepEqual(pair.target.toArray(),[-3,1.15,-5]);
  presenter.gesture('rival','speak',{toward:'delegate'});assert.deepEqual(presenter.cameraFraming().target.toArray(),[4,1.15,-6.5]);
  presenter.gesture('rival','speak',{toward:'delegate',ms:-1});assert.deepEqual(presenter.cameraFraming().target.toArray(),pair.target.toArray());
  for(const aspect of [.7,2.4])for(const cameraView of ['follow','horizon']){
    const stage=Object.create(BattleStage.prototype);Object.assign(stage,{live:presenter,cameraView,camera:new T.PerspectiveCamera(40,aspect,.1,800),orbit:{yaw:-.55,pitch:cameraView==='horizon'?.14:.45,distance:7}});
    const frame=stage.conversationFrame(),{yaw,pitch}=stage.orbit,d=frame.distance;assert.ok(Number.isFinite(d));
    stage.camera.position.set(frame.target.x+Math.sin(yaw)*Math.cos(pitch)*d,frame.target.y+Math.sin(pitch)*d,frame.target.z+Math.cos(yaw)*Math.cos(pitch)*d);stage.camera.lookAt(frame.target);stage.camera.updateMatrixWorld();
    for(const p of pair.points)for(const y of [0,2.6]){const projected=p.clone().add(new T.Vector3(0,y,0)).project(stage.camera);assert.ok(Math.abs(projected.x)<=.76&&Math.abs(projected.y)<=.76,'Both whole bodies remain inside the clear canvas');}
    for(const [key,value]of [['cameraView','overview'],['reducedMotion',true],['drag',{}],['actionCamera',false]]){const previous=stage[key];stage[key]=value;assert.equal(stage.conversationFrame(),null);stage[key]=previous;}
  }
  targetId=null;assert.equal(presenter.cameraFraming(),null);targetId='delegate';delegate.hidden=true;assert.equal(presenter.cameraFraming(),null);delete delegate.hidden;
  assert.equal(JSON.stringify(world),before);presenter.dispose();
});

test('All twelve chapters retain readable shadow-side fill and High rendering caps avoid the former 4096 shadow pass',()=>{
  for(let chapter=1;chapter<=12;chapter++)for(const kind of ['battle','contest']){
    const profile=getSceneProfile({kind},{chapter}),before=JSON.stringify(profile),lighting=readableLighting(profile);
    assert.ok(lighting.ambient>=1.4);assert.ok(lighting.fill>=.5);assert.ok(lighting.environment>=.5);assert.equal(JSON.stringify(profile),before);
  }
  const night=readableLighting(getSceneProfile({},{chapter:5,timeOfDay:'night'}));assert.ok(night.fill>0&&night.fill<.5);
  assert.equal(STAGE_QUALITY.high.shadow**2,4096**2/4);assert.equal(COMPOSITOR_TIERS.high.samples,10);
  assert.equal(STAGE_QUALITY.high.fps,60);assert.equal(STAGE_QUALITY.high.ratio,2);
});

test('Expanded real-time maps retain detailed terrain beyond every playable edge and an exact horizon material join',()=>{
  for(const [width,height]of [[32,32],[44,28]]){
    const encounter={id:'ch5-mine',kind:'battle',width,height,units:[],terrain:Array.from({length:height},()=>Array(width).fill('grass'))};
    for(let y=0;y<height;y++)encounter.terrain[y][Math.floor(width/2)]='road';
    const before=JSON.stringify(encounter),environment=createEnvironment(new T.Scene(),encounter,{chapter:5,quality:'performance',loadTextures:false}),ground=environment.ground.geometry,
      bridge=environment.horizon.bridge.geometry,segments=ground.parameters.widthSegments,count=environment.horizon.stats.innerEdgeSamples;
    assert.ok(environment.horizon.stats.innerRadius>=Math.max(width,height)*1.25+20);assert.ok(environment.horizon.stats.triangles<=15000);
    for(let i=0;i<count;i++){
      const edge=Math.floor(i/segments),j=i%segments,k=edge===0?j:edge===1?j*(segments+1)+segments:edge===2?segments*(segments+1)+segments-j:(segments-j)*(segments+1);
      for(const name of ['position','normal','color','uv','soilMix']){const a=ground.attributes[name],b=bridge.attributes[name];for(let c=0;c<a.itemSize;c++)assert.equal(a.array[k*a.itemSize+c],b.array[i*b.itemSize+c]);}
    }
    assert.equal(JSON.stringify(encounter),before);environment.dispose();
  }
});

test('Preview and field use detached real worn items and chosen appearance instead of chapter-assumed equipment',()=>{
  const soldier=createSoldier({appearance:{hair:2,beard:2,tunic:2,cloak:3}}),before=JSON.stringify(soldier),unit=soldierPreviewUnit(soldier,{name:'Aurelius'}),kit=actorKit(unit,{chapter:5});
  assert.equal(kit.armored,false);assert.equal(kit.helmet,'ridge');assert.equal(kit.weapon,'spatha');assert.equal(kit.cloak,false);assert.equal(kit.shield,true);
  assert.equal(actorIdentity(unit,kit).hair,'shaved');assert.equal(actorIdentity(unit,kit).beard,.85);assert.equal(actorBodyId(kit),'roman-recruit','Unarmoured, he wears the recruit\'s generated body; the chosen hair and beard show on the procedural figure');
  const world={map:{width:8,height:8},actors:[{id:'hero',name:'Aurelius',side:'player',role:'soldier',x:2,z:3,hp:10,maxHp:10,kit:[...unit.equipment]}]};
  const scene=stageEncounter({width:8,height:8},world,{appearance:soldier.appearance}),field=scene.units[0];
  assert.deepEqual(field.equipment,unit.equipment);assert.deepEqual(field.appearance,unit.appearance);
  field.equipment.pop();field.appearance.hair=0;assert.equal(JSON.stringify(soldier),before);assert.equal(world.actors[0].kit.length,unit.equipment.length);
  const mail=actorKit({...unit,equipment:['hamata','galea','bracae','caligae','spatha','scutum']},{chapter:5});assert.equal(actorBodyId(mail),'roman-officer','In mail he wears the generated body of his rank');
});

test('Equipped weapon, shield, helmet and armour combinations create distinct finite rigs without changing input',()=>{
  for(const [weapon,armor,helmet,shield]of [['spatha','hamata','galea','scutum'],['spear','squamata','conical_helmet','parma'],['axe',null,'segmented_helmet',null],['knife',null,null,null],['bow',null,'arming_cap',null],['sling',null,null,'round_shield']]){
    const unit={id:'hero',name:'Aurelius',side:'player',role:'infantry',equipment:['tunic','bracae','caligae',weapon,armor,helmet,shield,'manica','ocreae','paenula'].filter(Boolean)},before=JSON.stringify(unit),actor=createActor(unit,{chapter:5,quality:'performance'});
    assert.equal(actor.group.userData.actor.weapon,weapon);assert.equal(actor.group.userData.actor.armor,armor==='hamata'?'mail':armor==='squamata'?'scale':null);
    assert.ok(actor.group.getObjectByName('equipped-manica'));assert.ok(actor.group.getObjectByName('equipped-greave'));assert.equal(!!actor.group.getObjectByName('oval-shield'),!!shield&&weapon!=='bow');
    for(const motion of ['idle','attack','brace','hit']){actor.update({motion,phase:.4,time:0,reducedMotion:true});actor.group.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}
    assert.equal(JSON.stringify(unit),before);actor.dispose();
  }
});
